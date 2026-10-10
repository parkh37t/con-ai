/**
 * Claude Code CLI 경로 — **가짜 `claude` 실행 파일**로 실제 spawn·stdin·종료 코드를 그대로 지나게 한다.
 *
 * 왜 모킹이 아니라 진짜 프로세스인가: 이 경로의 결함은 전부 **프로세스 경계**에 있다 —
 * stdin 을 닫지 않아 3초를 버리거나, 프롬프트를 argv 에 넣어 `ps` 에 새거나, `.cmd` 를 못 띄우거나,
 * 구조화 출력의 `null` 을 그대로 zod 에 넣어 성공한 호출을 전건 거부하거나.
 * 가짜 실행 파일은 받은 argv·stdin 을 파일로 남기므로 그것들을 **값으로 단언**할 수 있다.
 *
 * 실제 `claude` 를 부르지 않는다 — `pnpm check` 는 자격 증명도, 네트워크도 쓰지 않는다.
 */
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { AdapterError } from './errors.js'
import { ARGV_LIMIT, describeCliAuth, resolveClaudeBin, runClaudeCli } from './claude-code-cli.js'
import { REVISION_DRAFT_JSON_SCHEMA } from './structured-schema.js'
import { WireRevisionDraft } from './wire-schema.js'

const Small = z.object({ greeting: z.string(), note: z.string().optional() })

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

/**
 * 가짜 `claude` 를 만든다. 받은 argv·stdin 을 `argv.json`·`stdin.txt` 로 남기고,
 * `FAKE_MODE` 에 따라 CLI envelope 를 흉내 낸다.
 */
function fakeCli(mode: string, extra: Record<string, string> = {}): { bin: string; out: string; env: NodeJS.ProcessEnv } {
  const dir = mkdtempSync(join(tmpdir(), 'con-ai-fakecli-'))
  dirs.push(dir)
  const bin = join(dir, 'claude')
  const script = `#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const out = process.env.FAKE_OUT
const mode = process.env.FAKE_MODE
fs.writeFileSync(path.join(out, 'argv.json'), JSON.stringify(process.argv.slice(2)))
let stdin = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (c) => { stdin += c })
process.stdin.on('end', () => {
  fs.writeFileSync(path.join(out, 'stdin.txt'), stdin)
  const usage = { input_tokens: 11, output_tokens: 22 }
  if (mode === 'hang') { setTimeout(() => {}, 60000); return }
  if (mode === 'nonjson') { process.stdout.write('이건 JSON 이 아니다'); process.exit(0) }
  if (mode === 'not_logged_in') { process.stdout.write(JSON.stringify({ is_error: true, subtype: 'error', result: 'Invalid API key · Please run /login' })); process.exit(1) }
  if (mode === 'limit') { process.stdout.write(JSON.stringify({ is_error: true, subtype: 'error', result: 'Claude usage limit reached' })); process.exit(1) }
  if (mode === 'empty') { process.stdout.write(JSON.stringify({ is_error: false, subtype: 'success', result: '', usage })); process.exit(0) }
  if (mode === 'fence') { process.stdout.write(JSON.stringify({ is_error: false, subtype: 'success', result: '\\u0060\\u0060\\u0060json\\n{"greeting":"울타리"}\\n\\u0060\\u0060\\u0060', usage })); process.exit(0) }
  if (mode === 'repair') {
    const marker = path.join(out, 'tried')
    const second = fs.existsSync(marker)
    fs.writeFileSync(marker, '1')
    const body = second ? { greeting: '두 번째', note: null } : { greeting: 42, note: null }
    process.stdout.write(JSON.stringify({ is_error: false, subtype: 'success', structured_output: body, result: JSON.stringify(body), usage }))
    process.exit(0)
  }
  if (mode === 'always_bad') {
    process.stdout.write(JSON.stringify({ is_error: false, subtype: 'success', structured_output: { greeting: 42 }, result: '{}', usage }))
    process.exit(0)
  }
  if (mode === 'revision') {
    const body = { prompt: '라벨을 견적번호로 바꾼다', rationale: '코멘트 1건 반영' }
    process.stdout.write(JSON.stringify({ is_error: false, subtype: 'success', structured_output: body, result: JSON.stringify(body), usage, total_cost_usd: 0.0312, session_id: 'sess-1' }))
    process.exit(0)
  }
  // success: 선택 키를 **null 로** 보낸다 (실제 CLI 가 그렇게 보낸다)
  const body = { greeting: '안녕', note: null }
  process.stdout.write(JSON.stringify({ is_error: false, subtype: 'success', structured_output: body, result: JSON.stringify(body), usage, total_cost_usd: 0.0435, session_id: 'sess-0' }))
  process.exit(0)
})
`
  writeFileSync(bin, script, { encoding: 'utf8' })
  chmodSync(bin, 0o755)
  return { bin, out: dir, env: { ...process.env, CLAUDE_BIN: bin, FAKE_OUT: dir, FAKE_MODE: mode, ...extra } }
}

function argvOf(out: string): string[] {
  return JSON.parse(readFileSync(join(out, 'argv.json'), 'utf8')) as string[]
}

const SCHEMA = { type: 'object', properties: { greeting: { type: 'string' }, note: { type: 'string' } }, required: ['greeting', 'note'] }

function run(mode: string, over: Partial<Parameters<typeof runClaudeCli>[2]> = {}) {
  const fake = fakeCli(mode)
  return {
    fake,
    promise: runClaudeCli({ system: '너는 테스트 응답기다', user: '인사해라', json_schema: SCHEMA, label: '테스트' }, Small, { model: 'claude-opus-5', env: fake.env, timeout_ms: 20_000, ...over }),
  }
}

describe('runClaudeCli — 가짜 CLI 로 프로세스 경계를 그대로 지난다', () => {
  it('구조화 출력의 null 을 지우고 우리 스키마로 다시 읽는다', async () => {
    // 이걸 빼면 **성공한 호출이 전건 schema_invalid 로 떨어진다** (실제 CLI 가 선택 키를 null 로 보낸다).
    const { promise } = run('success')
    const result = await promise
    expect(result.output).toEqual({ greeting: '안녕' })
    expect(result.attempts).toBe(1)
    expect(result.usage).toEqual({ input_tokens: 11, output_tokens: 22 })
    expect(result.list_cost_usd).toBe(0.0435)
    expect(result.session_id).toBe('sess-0')
  })

  it('프롬프트를 argv 에 넣지 않고 stdin 으로 보낸다 (ps 에 자료가 새지 않는다)', async () => {
    const { fake, promise } = run('success')
    await promise
    const argv = argvOf(fake.out)
    expect(argv.join(' ')).not.toContain('인사해라')
    expect(readFileSync(join(fake.out, 'stdin.txt'), 'utf8')).toBe('인사해라')
    // system 프롬프트도 argv 가 아니라 파일로 간다
    expect(argv.join(' ')).not.toContain('너는 테스트 응답기다')
    const i = argv.indexOf('--system-prompt-file')
    expect(i).toBeGreaterThan(-1)
    expect(argv[i + 1]).toMatch(/system\.txt$/)
  })

  it('도구·설정·MCP 를 모두 끄고 부른다 (RFP 같은 미신뢰 자료를 도구 붙은 세션에 먹이지 않는다)', async () => {
    const { fake, promise } = run('success')
    await promise
    const argv = argvOf(fake.out)
    expect(argv).toContain('--strict-mcp-config')
    expect(argv).toContain('--disable-slash-commands')
    expect(argv).toContain('--no-session-persistence')
    expect(argv[argv.indexOf('--tools') + 1]).toBe('')
    expect(argv[argv.indexOf('--setting-sources') + 1]).toBe('')
    expect(argv[argv.indexOf('--permission-prompts') + 1]).toBe('none')
    expect(argv[argv.indexOf('--output-format') + 1]).toBe('json')
    expect(argv[argv.indexOf('--model') + 1]).toBe('claude-opus-5')
    expect(argv[argv.indexOf('--effort') + 1]).toBe('high')
    // 권한을 우회하는 플래그는 절대 쓰지 않는다
    expect(argv.join(' ')).not.toContain('--dangerously-skip-permissions')
    expect(argv.join(' ')).not.toContain('bypassPermissions')
    // 스키마는 생성물 한 벌을 그대로 넘긴다
    expect(JSON.parse(argv[argv.indexOf('--json-schema') + 1] ?? 'null')).toEqual(SCHEMA)
  })

  it('스키마가 맞지 않으면 **한 번만** 수리 재시도하고, 재시도 요청에 어긋난 경로를 적는다', async () => {
    const { fake, promise } = run('repair')
    const result = await promise
    expect(result.output).toEqual({ greeting: '두 번째' })
    expect(result.attempts).toBe(2)
    const sent = readFileSync(join(fake.out, 'stdin.txt'), 'utf8')
    expect(sent).toContain('greeting')
    expect(sent).toContain('스키마에 맞지 않았다')
  })

  it('두 번 틀리면 parse 로 끝낸다 (무한 재시도로 한도를 태우지 않는다)', async () => {
    const { promise } = run('always_bad')
    const err = (await promise.catch((e: unknown) => e)) as AdapterError
    expect(err).toBeInstanceOf(AdapterError)
    expect(err.code).toBe('parse')
    expect(err.details['attempts']).toBe(2)
  })

  it('로그인하지 않은 것과 CLI 가 없는 것을 구분한다 (사용자가 할 일이 다르다)', async () => {
    const { promise } = run('not_logged_in')
    const err = (await promise.catch((e: unknown) => e)) as AdapterError
    expect(err.code).toBe('not_logged_in')
    expect(err.message).toContain('`claude`')

    const missing = runClaudeCli({ system: 's', user: 'u', json_schema: SCHEMA, label: '테스트' }, Small, {
      model: 'claude-opus-5',
      env: { PATH: '/definitely/not/here' },
      deps: { exists: () => false },
    })
    const err2 = (await missing.catch((e: unknown) => e)) as AdapterError
    expect(err2.code).toBe('cli_missing')
  })

  it('사용 한도는 한도로 분류한다', async () => {
    const { promise } = run('limit')
    await expect(promise).rejects.toMatchObject({ code: 'rate_limit' })
  })

  it('응답이 JSON 이 아니면 성공으로 넘기지 않는다', async () => {
    const { promise } = run('nonjson')
    const err = (await promise.catch((e: unknown) => e)) as AdapterError
    expect(err.code).toBe('parse')
    expect(err.message).toContain('이건 JSON 이 아니다')
  })

  it('구조화 출력이 비고 본문도 없으면 empty_output 이다', async () => {
    const { promise } = run('empty')
    await expect(promise).rejects.toMatchObject({ code: 'empty_output' })
  })

  it('구조화 출력이 비어도 본문의 ```json 울타리에서 한 번 더 읽는다', async () => {
    const { promise } = run('fence')
    const result = await promise
    expect(result.output).toEqual({ greeting: '울타리' })
  })

  it('제한 시간을 넘기면 중단하고 timeout 으로 알린다', async () => {
    const { promise } = run('hang', { timeout_ms: 800 })
    const err = (await promise.catch((e: unknown) => e)) as AdapterError
    expect(err.code).toBe('timeout')
  })

  it('취소하면 cancelled 다 (실패로 뭉개지 않는다)', async () => {
    const controller = new AbortController()
    const { promise } = run('hang', { timeout_ms: 20_000, signal: controller.signal })
    setTimeout(() => controller.abort(), 200)
    const err = (await promise.catch((e: unknown) => e)) as AdapterError
    expect(err.code).toBe('cancelled')
  })

  it('생성물 스키마 한 벌(REVISION_DRAFT_JSON_SCHEMA)과 wire zod 로 실제 작업 모양을 지난다', async () => {
    const fake = fakeCli('revision')
    const result = await runClaudeCli(
      { system: 's', user: 'u', json_schema: REVISION_DRAFT_JSON_SCHEMA, label: '수정 지시문' },
      WireRevisionDraft,
      { model: 'claude-opus-5', env: fake.env, timeout_ms: 20_000 },
    )
    expect(result.output.prompt).toContain('견적번호')
    expect(result.output.rationale).toContain('코멘트')
  })

  it('스키마가 명령행 상한을 넘으면 호출하지 않고 미리 거절한다', async () => {
    const fake = fakeCli('success')
    const huge = { type: 'object', description: 'x'.repeat(ARGV_LIMIT + 10), properties: {} }
    const err = (await runClaudeCli({ system: 's', user: 'u', json_schema: huge, label: '테스트' }, Small, { model: 'm', env: fake.env }).catch((e: unknown) => e)) as AdapterError
    expect(err.code).toBe('bad_request')
    expect(existsSync(join(fake.out, 'argv.json'))).toBe(false) // 실행하지 않았다
  })
})

describe('resolveClaudeBin', () => {
  it('CLAUDE_BIN 을 먼저 쓴다', () => {
    const r = resolveClaudeBin({ env: { CLAUDE_BIN: '/opt/x/claude' }, platform: 'linux', exists: () => false })
    expect(r).toMatchObject({ exec: '/opt/x/claude', prefix_args: [], source: 'env' })
  })

  it('PATH 에서 찾는다', () => {
    const r = resolveClaudeBin({ env: { PATH: '/a:/b' }, platform: 'linux', exists: (p) => p === '/b/claude' })
    expect(r?.exec).toBe('/b/claude')
    expect(r?.source).toBe('path')
  })

  it('없으면 null 이다 (ENOENT 를 「로그인 안 됨」으로 오진하지 않기 위해 미리 구분한다)', () => {
    expect(resolveClaudeBin({ env: { PATH: '/a' }, platform: 'linux', exists: () => false })).toBeNull()
  })

  it('Windows 배치 shim(claude.cmd)은 ComSpec 으로 돌린다', () => {
    // CreateProcess 는 .cmd 를 직접 띄우지 못해 shell:false spawn 이 ENOENT 로 죽는다.
    // 이 분기는 리눅스에서 **실행 검증하지 못했다**(not_run) — 경로 계산만 단언한다.
    const r = resolveClaudeBin({
      env: { PATH: 'C:\\npm', PATHEXT: '.COM;.EXE;.BAT;.CMD', ComSpec: 'C:\\Windows\\system32\\cmd.exe' },
      platform: 'win32',
      exists: (p) => p.toLowerCase().endsWith('claude.cmd'),
    })
    expect(r?.exec).toBe('C:\\Windows\\system32\\cmd.exe')
    expect(r?.prefix_args.slice(0, 3)).toEqual(['/d', '/s', '/c'])
    expect(r?.prefix_args[3]?.toLowerCase()).toContain('claude.cmd')
  })
})

describe('describeCliAuth — 무엇으로 인증하는지 숨기지 않는다', () => {
  it('아무 변수도 없으면 그 기계의 구독 로그인이다', () => {
    expect(describeCliAuth({}).auth).toBe('subscription')
    expect(describeCliAuth({}).note).toContain('API 키를 쓰지 않습니다')
  })

  it('ANTHROPIC_API_KEY 가 있으면 **API 키로 과금된다**고 알린다 (조용히 쓰지 않는다)', () => {
    const d = describeCliAuth({ ANTHROPIC_API_KEY: 'sk-ant-xxxxxxxx' })
    expect(d.auth).toBe('api_key')
    expect(d.note).toContain('API 키로 과금')
  })

  it('ANTHROPIC_AUTH_TOKEN 이 더 우선이다 (Claude Code 의 인증 우선순위와 같다)', () => {
    expect(describeCliAuth({ ANTHROPIC_AUTH_TOKEN: 'oat', ANTHROPIC_API_KEY: 'sk' }).auth).toBe('bearer_token')
  })

  it('ANTHROPIC_BASE_URL·클라우드 제공자는 managed 로 적는다 (구독 로그인이 아니다)', () => {
    expect(describeCliAuth({ ANTHROPIC_BASE_URL: 'https://gw.example' }).auth).toBe('managed')
    expect(describeCliAuth({ CLAUDE_CODE_USE_BEDROCK: '1' }).auth).toBe('managed')
  })

  it('빈 문자열은 설정된 것으로 보지 않는다', () => {
    expect(describeCliAuth({ ANTHROPIC_API_KEY: '   ' }).auth).toBe('subscription')
  })
})
