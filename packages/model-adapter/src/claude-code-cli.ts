/**
 * Claude Code CLI 를 모델 호출 수단으로 쓰는 **리프 모듈** (SDK 를 import 하지 않는다).
 *
 * 왜 이 경로가 필요한가: Anthropic 은 2026-02 부터 **구독 OAuth 토큰을 제3자 앱에서 쓰는 것을 금지**했고,
 * `sk-ant-oat01-…` 토큰은 Messages API 에서 거부된다는 보고가 다수다. 그래서 「각자 자기 Claude 계정으로,
 * API 키 없이」 쓰는 길은 **1st-party 클라이언트인 Claude Code 를 그 사람 기계에서 부르는 것** 하나뿐이다.
 * 이 모듈이 그 호출 한 벌이고, 서버 어댑터(`ClaudeCodeAdapter`)와 로컬 브리지가 **같이** 쓴다.
 *
 * 이 파일의 사실들은 추측이 아니라 `claude 2.1.296` 으로 **실측**한 것이다:
 * - `-p --output-format json --json-schema <inline>` → 응답 envelope 에 `structured_output`(파싱된 객체)과
 *   `result`(같은 내용의 문자열)가 함께 온다. `is_error`·`subtype`·`total_cost_usd`·`usage` 도 같은 객체에 있다.
 * - 구조화 출력은 **선택 키를 `null` 로 보낸다** → `stripNulls` 후 zod 로 읽어야 한다. 안 하면 성공한 호출이 전건 거부된다.
 * - `--system-prompt-file <파일>` 이 동작한다 → system 프롬프트를 argv 에 넣지 않는다(Windows 명령행 상한·`ps` 노출 회피).
 * - **`--tools ""` 만으로는 격리가 안 된다.** cwd 의 `CLAUDE.md` 와 `.claude/settings.json` 훅이 그대로 돈다(실측).
 *   그래서 빈 임시 디렉터리에서 돌리고 `--setting-sources ""` · `--strict-mcp-config` 를 함께 준다.
 *   **원본 자료(RFP·요구사항)는 신뢰되지 않은 데이터**이므로 도구가 붙은 세션에 먹이지 않는다 (CLAUDE.md).
 * - `total_cost_usd` 는 `costBasis: "list"` 다 — **구독 사용자가 실제로 낸 돈이 아니다.** 그래서 이름을
 *   `list_cost_usd` 로 돌려주고, 화면 문구도 「정가 환산 추정」이라고 적는다.
 *
 * 값(토큰·키)을 읽거나 적지 않는다. 인증은 **그 기계의 Claude Code 로그인**이 한다.
 */
import { spawn as nodeSpawn } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { tmpdir } from 'node:os'
import type { z } from 'zod'
import { AdapterError } from './errors.js'
import { stripNulls } from './wire-schema.js'

/** 기본 제한 시간 — 화면명세 생성은 길다. 브리지·어댑터가 작업별로 줄인다. */
export const DEFAULT_CLI_TIMEOUT_MS = 300_000
/** 한 호출의 정가 환산 상한 (`--max-budget-usd`). 구독 사용자에게는 과금이 아니라 **폭주 방지**다. */
export const DEFAULT_CLI_BUDGET_USD = 3
/** SIGTERM 후 이 시간이 지나면 SIGKILL. */
const KILL_GRACE_MS = 3_000

/**
 * argv 길이 상한. Windows 는 명령행 전체가 32,767자이고, 우리가 argv 에 넣는 가장 큰 값은
 * JSON Schema 한 개다(실측: 화면 생성 스키마 9,108자). 넉넉히 잡되 **조용히 터지지 않게** 미리 거절한다.
 */
export const ARGV_LIMIT = 30_000

export type ClaudeCliAuth = 'subscription' | 'api_key' | 'bearer_token' | 'managed' | 'unknown'

/**
 * 그 기계의 Claude Code 가 **무엇으로 인증하는지** 환경변수로 판정한다.
 * 「API 키를 쓰지 않는다」가 이번 설계의 전제이므로, 키가 설정돼 있으면 **조용히 쓰지 않고 화면에 알린다.**
 * (Claude Code 인증 우선순위: ANTHROPIC_AUTH_TOKEN > ANTHROPIC_API_KEY > … > `/login` 구독 자격.)
 */
export function describeCliAuth(env: NodeJS.ProcessEnv): { auth: ClaudeCliAuth; note: string } {
  const has = (k: string): boolean => (env[k]?.trim().length ?? 0) > 0
  if (has('ANTHROPIC_AUTH_TOKEN')) {
    return { auth: 'bearer_token', note: 'ANTHROPIC_AUTH_TOKEN 이 설정돼 있어 Claude Code 가 그 토큰을 씁니다 (구독 로그인보다 우선합니다)' }
  }
  if (has('ANTHROPIC_API_KEY')) {
    return { auth: 'api_key', note: 'ANTHROPIC_API_KEY 가 설정돼 있어 Claude Code 가 **API 키로 과금**합니다. 구독으로 쓰려면 그 변수를 지우세요' }
  }
  if (has('ANTHROPIC_BASE_URL') || has('CLAUDE_CODE_USE_BEDROCK') || has('CLAUDE_CODE_USE_VERTEX') || has('CLAUDE_CODE_USE_FOUNDRY')) {
    return { auth: 'managed', note: '이 기계의 Claude Code 는 지정된 엔드포인트·클라우드 제공자를 통해 인증합니다 (구독 로그인이 아닙니다)' }
  }
  return { auth: 'subscription', note: '이 기계에 로그인된 Claude 계정(구독)으로 호출합니다 — API 키를 쓰지 않습니다' }
}

export interface ResolvedClaudeBin {
  /** 실제로 spawn 할 실행 파일. Windows 배치 shim 이면 ComSpec 이 된다. */
  exec: string
  /** exec 앞에 붙는 인자 (`cmd /d /s /c <claude.cmd>`). 유닉스에서는 빈 배열. */
  prefix_args: readonly string[]
  /** 어디서 찾았는가 — 오류 문구에 적는다. */
  source: 'env' | 'path'
  /** 찾은 경로 (문구용). */
  path: string
}

export interface BinLookupDeps {
  env: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  exists?: (path: string) => boolean
}

/**
 * `claude` 실행 파일을 찾는다. `CLAUDE_BIN` 이 있으면 그것을 쓴다.
 *
 * **Windows**: npm 전역 설치의 진입점은 `claude.cmd`(배치 shim)인데 CreateProcess 는 `.cmd` 를 직접 띄우지 못해
 * `shell:false` spawn 이 ENOENT 로 죽는다. 그 ENOENT 를 「CLI 가 없다」로 적으면 **설치한 사람에게 거짓 안내**가 된다.
 * 그래서 `.cmd`·`.bat` 는 ComSpec 으로 돌린다. (이 분기는 리눅스 컨테이너에서 **실행 검증하지 못했다** — not_run.)
 */
export function resolveClaudeBin(deps: BinLookupDeps): ResolvedClaudeBin | null {
  const platform = deps.platform ?? process.platform
  const exists = deps.exists ?? existsSync
  const win = platform === 'win32'
  const comSpec = deps.env['ComSpec']?.trim() ?? deps.env['COMSPEC']?.trim() ?? 'cmd.exe'
  const wrap = (path: string, source: ResolvedClaudeBin['source']): ResolvedClaudeBin => {
    const lower = path.toLowerCase()
    if (win && (lower.endsWith('.cmd') || lower.endsWith('.bat'))) {
      return { exec: comSpec, prefix_args: ['/d', '/s', '/c', path], source, path }
    }
    return { exec: path, prefix_args: [], source, path }
  }

  const fromEnv = deps.env['CLAUDE_BIN']?.trim()
  if (fromEnv !== undefined && fromEnv.length > 0) return wrap(fromEnv, 'env')

  const exts = win ? (deps.env['PATHEXT']?.split(';').map((e) => e.trim()).filter((e) => e.length > 0) ?? ['.COM', '.EXE', '.BAT', '.CMD']) : ['']
  for (const dir of (deps.env['PATH'] ?? '').split(delimiter)) {
    if (dir.trim().length === 0) continue
    for (const ext of exts) {
      const candidate = join(dir, `claude${ext.toLowerCase()}`)
      if (exists(candidate)) return wrap(candidate, 'path')
    }
  }
  return null
}

export type SpawnLike = typeof nodeSpawn

export interface ClaudeCliRequest {
  system: string
  user: string
  /** 생성물 JSON Schema 한 벌(`structured-schema.ts`)에서 그대로 온 값. 손으로 적은 사본을 쓰지 않는다. */
  json_schema: Record<string, unknown>
  /** 작업 이름 — 오류 문구에만 쓴다 (`화면명세`·`수정 지시문`·`페인포인트`). */
  label: string
}

export interface ClaudeCliOptions {
  model: string
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  timeout_ms?: number
  max_budget_usd?: number
  env?: NodeJS.ProcessEnv
  signal?: AbortSignal
  /** 테스트 주입 — 실제 CLI 대신 가짜 실행 파일을 쓴다. */
  deps?: { spawn?: SpawnLike; platform?: NodeJS.Platform; exists?: (p: string) => boolean }
}

export interface ClaudeCliUsage {
  input_tokens: number
  output_tokens: number
}

export interface ClaudeCliRun<T> {
  output: T
  /** 모델이 낸 원문 텍스트 (envelope 의 `result`). */
  raw_text: string
  usage: ClaudeCliUsage
  /**
   * 정가 환산 추정액. **구독으로 호출하면 실제 과금액이 아니다** (envelope 의 `costBasis: "list"`).
   * 화면에 적을 때 그 사실을 함께 적는다.
   */
  list_cost_usd?: number | undefined
  /** 1 이면 한 번에 성공, 2 면 스키마 수리 재시도 후 성공. */
  attempts: number
  session_id?: string | undefined
}

/** CLI envelope 중 우리가 읽는 부분. 나머지 키는 무시한다. */
interface CliEnvelope {
  is_error?: boolean
  subtype?: string
  result?: unknown
  structured_output?: unknown
  total_cost_usd?: unknown
  session_id?: unknown
  stop_reason?: unknown
  usage?: { input_tokens?: unknown; output_tokens?: unknown }
  modelUsage?: Record<string, { costBasis?: unknown }>
}

interface SpawnOutcome {
  code: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
  timed_out: boolean
  aborted: boolean
  spawn_error?: NodeJS.ErrnoException
}

const NOT_LOGGED_IN = ['/login', 'please log in', 'not logged in', 'login expired', 'oauth', 'authentication_error', 'invalid api key', 'unauthorized']
const LIMIT = ['usage limit', 'rate limit', 'rate_limit', 'too many requests', '429', 'quota']
const BUDGET = ['max-budget', 'budget exceeded', 'budget limit']

function hasAny(text: string, needles: readonly string[]): boolean {
  const lower = text.toLowerCase()
  return needles.some((n) => lower.includes(n))
}

/** 실패 분류 — 「CLI 가 없다」와 「로그인하지 않았다」를 섞지 않는다. 사용자가 할 일이 다르다. */
function classify(label: string, out: SpawnOutcome, env: CliEnvelope | null): AdapterError {
  const tail = `${out.stderr}\n${typeof env?.result === 'string' ? env.result : ''}`.trim().slice(0, 800)
  if (out.aborted) return new AdapterError('cancelled', `${label} 생성을 취소했습니다.`, { details: { code: out.code } })
  if (out.timed_out) {
    return new AdapterError('timeout', `${label}을(를) 만드는 데 시간이 너무 걸려 중단했습니다. 다시 시도하거나 더 작은 범위로 나누세요.`, { details: { code: out.code } })
  }
  if (out.spawn_error?.code === 'ENOENT') {
    return new AdapterError('cli_missing', 'Claude Code CLI(`claude`)를 찾지 못했습니다. 설치 후 다시 시도하세요 (설치: https://code.claude.com/docs/en/setup).', {
      cause: out.spawn_error,
    })
  }
  if (out.spawn_error !== undefined) {
    return new AdapterError('cli_error', `Claude Code CLI 를 실행하지 못했습니다 (${out.spawn_error.code ?? out.spawn_error.message}).`, { cause: out.spawn_error })
  }
  if (hasAny(tail, NOT_LOGGED_IN)) {
    return new AdapterError('not_logged_in', 'Claude Code 에 로그인되어 있지 않습니다. 터미널에서 `claude` 를 실행해 로그인한 뒤 다시 시도하세요.', { details: { detail: tail } })
  }
  if (hasAny(tail, LIMIT)) {
    return new AdapterError('rate_limit', '내 Claude 계정의 사용 한도에 걸렸습니다. 한도가 회복된 뒤 다시 시도하세요.', { details: { detail: tail } })
  }
  if (hasAny(tail, BUDGET)) {
    return new AdapterError('budget', `${label} 한 건의 정가 환산 상한을 넘어 중단했습니다 (구독 사용 시 실제 과금액은 아닙니다).`, { details: { detail: tail } })
  }
  return new AdapterError('cli_error', `Claude Code CLI 가 실패했습니다 (종료 코드 ${out.code ?? out.signal ?? '미상'}).${tail.length > 0 ? ` 원인: ${tail}` : ''}`, {
    details: { code: out.code, signal: out.signal },
  })
}

/** ```json 울타리를 벗긴다 — 구조화 출력이 비어 `result` 문자열로 떨어질 때를 위한 보조 경로다. */
function stripFence(text: string): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith('```')) return trimmed
  const first = trimmed.indexOf('\n')
  const end = trimmed.lastIndexOf('```')
  if (first === -1 || end <= first) return trimmed
  return trimmed.slice(first + 1, end).trim()
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function runOnce(req: ClaudeCliRequest, userText: string, opts: ClaudeCliOptions, bin: ResolvedClaudeBin): Promise<SpawnOutcome> {
  const env = opts.env ?? process.env
  const spawnFn = opts.deps?.spawn ?? nodeSpawn
  const schemaJson = JSON.stringify(req.json_schema)
  // 빈 작업 디렉터리에서 돌린다 — cwd 의 CLAUDE.md·훅·.claude/settings.json 이 로드되는 것을 막는다(실측).
  const dir = mkdtempSync(join(tmpdir(), 'con-ai-cli-'))
  const systemFile = join(dir, 'system.txt')
  writeFileSync(systemFile, req.system, { encoding: 'utf8', mode: 0o600 })
  try {
    chmodSync(systemFile, 0o600)
  } catch {
    // 일부 파일 시스템(Windows·일부 컨테이너)은 chmod 를 무시한다 — 실패를 삼키지만 파일은 임시 디렉터리 안에 있다.
  }

  const args = [
    ...bin.prefix_args,
    '-p',
    '--output-format',
    'json',
    '--json-schema',
    schemaJson,
    '--system-prompt-file',
    systemFile,
    '--model',
    opts.model,
    '--effort',
    opts.effort ?? 'high',
    // 도구를 **아예 주지 않는다**. 권한을 우회하는 플래그(--dangerously-skip-permissions)는 쓰지 않는다.
    '--tools',
    '',
    '--setting-sources',
    '',
    '--strict-mcp-config',
    '--disable-slash-commands',
    '--permission-prompts',
    'none',
    '--no-session-persistence',
    '--max-budget-usd',
    String(opts.max_budget_usd ?? DEFAULT_CLI_BUDGET_USD),
  ]

  return new Promise<SpawnOutcome>((resolve) => {
    const child = spawnFn(bin.exec, args, { cwd: dir, env, stdio: ['pipe', 'pipe', 'pipe'], shell: false })
    let stdout = ''
    let stderr = ''
    let settled = false
    let timedOut = false
    let aborted = false
    let killTimer: NodeJS.Timeout | undefined

    const finish = (outcome: Omit<SpawnOutcome, 'stdout' | 'stderr' | 'timed_out' | 'aborted'>): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (killTimer !== undefined) clearTimeout(killTimer)
      opts.signal?.removeEventListener('abort', onAbort)
      rmSync(dir, { recursive: true, force: true })
      resolve({ ...outcome, stdout, stderr, timed_out: timedOut, aborted })
    }

    const stop = (): void => {
      child.kill('SIGTERM')
      killTimer = setTimeout(() => child.kill('SIGKILL'), KILL_GRACE_MS)
    }
    const timer = setTimeout(() => {
      timedOut = true
      stop()
    }, opts.timeout_ms ?? DEFAULT_CLI_TIMEOUT_MS)
    const onAbort = (): void => {
      aborted = true
      stop()
    }
    if (opts.signal?.aborted === true) {
      aborted = true
      setTimeout(stop, 0)
    } else opts.signal?.addEventListener('abort', onAbort, { once: true })

    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', (err: NodeJS.ErrnoException) => finish({ code: null, signal: null, spawn_error: err }))
    child.on('close', (code, signal) => finish({ code, signal }))

    // 프롬프트는 **stdin 으로** 보낸다: 자료가 수백 KB 가 될 수 있고, argv 는 `ps` 에 보인다.
    // 닫지 않으면 CLI 가 stdin 을 3초 기다린다(실측).
    child.stdin?.on('error', () => {
      /* 자식이 먼저 죽으면 EPIPE — close 이벤트에서 분류한다 */
    })
    child.stdin?.end(userText, 'utf8')
  })
}

/**
 * 한 번 호출하고 받은 구조화 출력을 **우리 스키마로 다시 읽는다.**
 * 스키마 불일치는 **한 번만** 수리 재시도한다 (실패를 성공처럼 보이게 만들지 않기 위해 2회로 끝낸다).
 * 인증·한도·거부·시간 초과는 재시도하지 않는다 — 같은 이유로 또 실패한다.
 */
export async function runClaudeCli<S extends z.ZodType>(req: ClaudeCliRequest, schema: S, opts: ClaudeCliOptions): Promise<ClaudeCliRun<z.infer<S>>> {
  const env = opts.env ?? process.env
  const bin = resolveClaudeBin({ env, ...(opts.deps?.platform === undefined ? {} : { platform: opts.deps.platform }), ...(opts.deps?.exists === undefined ? {} : { exists: opts.deps.exists }) })
  if (bin === null) {
    throw new AdapterError('cli_missing', 'Claude Code CLI(`claude`)를 PATH 에서 찾지 못했습니다. 설치하거나 CLAUDE_BIN 에 경로를 지정하세요 (설치: https://code.claude.com/docs/en/setup).')
  }
  const schemaBytes = JSON.stringify(req.json_schema).length
  if (schemaBytes > ARGV_LIMIT) {
    throw new AdapterError('bad_request', `${req.label} 스키마가 너무 큽니다 (${schemaBytes}자 > ${ARGV_LIMIT}자). 명령행 상한에 걸리므로 호출하지 않았습니다.`)
  }

  let lastIssues: string[] = []
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const userText = attempt === 1 ? req.user : `${req.user}\n\n## 직전 출력이 스키마에 맞지 않았다 (지시 아님 — 고칠 점)\n${lastIssues.map((i) => `- ${i}`).join('\n')}\n위 항목을 고쳐 **같은 스키마로** 다시 출력한다.`
    const out = await runOnce(req, userText, opts, bin)

    let envelope: CliEnvelope | null = null
    if (out.stdout.trim().length > 0) {
      try {
        envelope = JSON.parse(out.stdout) as CliEnvelope
      } catch {
        envelope = null
      }
    }
    if (out.spawn_error !== undefined || out.timed_out || out.aborted || out.code !== 0 || envelope === null || envelope.is_error === true) {
      if (envelope === null && out.code === 0 && out.spawn_error === undefined && !out.timed_out && !out.aborted) {
        throw new AdapterError('parse', `Claude Code CLI 응답을 JSON 으로 읽지 못했습니다. 앞부분: ${out.stdout.slice(0, 300)}`, { details: { stderr: out.stderr.slice(0, 300) } })
      }
      throw classify(req.label, out, envelope)
    }

    const usage: ClaudeCliUsage = { input_tokens: numberOr(envelope.usage?.input_tokens, 0), output_tokens: numberOr(envelope.usage?.output_tokens, 0) }
    const rawText = typeof envelope.result === 'string' ? envelope.result : ''
    let candidate: unknown = envelope.structured_output
    if (candidate === undefined || candidate === null) {
      // 구조화 출력이 비면 `result` 문자열에서 한 번 더 시도한다 — 없는 것을 성공으로 넘기지 않는다.
      if (rawText.trim().length === 0) {
        throw new AdapterError('empty_output', `${req.label}을(를) 만들지 못했습니다 — 모델이 구조화 출력을 돌려주지 않았습니다.`, { details: { subtype: envelope.subtype } })
      }
      try {
        candidate = JSON.parse(stripFence(rawText))
      } catch {
        throw new AdapterError('empty_output', `${req.label}을(를) 만들지 못했습니다 — 구조화 출력이 없고 본문도 JSON 이 아닙니다.`, { details: { raw_text: rawText.slice(0, 300) } })
      }
    }

    const parsed = schema.safeParse(stripNulls(candidate))
    if (parsed.success) {
      return {
        output: parsed.data as z.infer<S>,
        raw_text: rawText,
        usage,
        attempts: attempt,
        ...(typeof envelope.total_cost_usd === 'number' ? { list_cost_usd: envelope.total_cost_usd } : {}),
        ...(typeof envelope.session_id === 'string' ? { session_id: envelope.session_id } : {}),
      }
    }
    lastIssues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`)
    if (attempt === 2) {
      throw new AdapterError('parse', `${req.label} 출력이 스키마에 맞지 않습니다 (한 번 수리 재시도 후에도). 원인: ${lastIssues.join(' / ')}`, { details: { attempts: 2 } })
    }
  }
  // 위 루프는 항상 return 하거나 throw 한다.
  throw new AdapterError('unknown', `${req.label} 호출이 결과 없이 끝났습니다.`)
}
