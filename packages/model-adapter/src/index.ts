/**
 * @con-ai/model-adapter — 모델 호출 어댑터 (세로 조각 계약 §3).
 *
 * `MODEL_ADAPTER` = **claude_code** | anthropic | fixture (기본 fixture), `MODEL_ID` (기본 claude-opus-5),
 * `MODEL_AUTH` = api_key|token|auto (anthropic 경로 전용, 기본 auto).
 *
 * - **claude_code (권장)**: 그 기계에 로그인된 **Claude Code CLI** 를 불러 쓴다. 우리가 자격 증명을 보지 않고
 *   **API 키도 쓰지 않는다.** 설치·로그인은 사용자가 터미널에서 한 번 한다 (`claude`).
 * - anthropic: `@anthropic-ai/sdk` 직접 호출. 구독 OAuth 토큰(`ANTHROPIC_AUTH_TOKEN`)은 Anthropic 이
 *   제3자 사용을 금지하고 Messages API 에서 거부한다는 보고가 많아 **API 키 경로로만 권한다**.
 * - fixture: 더미. 모델을 부르지 않는다.
 *
 * 키·토큰은 환경변수에서만 읽고 절대 로그·응답에 넣지 않는다.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import Anthropic, { type ClientOptions } from '@anthropic-ai/sdk'
import { AnthropicAdapter, DEFAULT_MODEL } from './anthropic-adapter.js'
import { ClaudeCodeAdapter, DEFAULT_CLI_MODEL } from './claude-code-adapter.js'
import { FixtureAdapter } from './fixture-adapter.js'
import type { AdapterAuth, ModelAdapter } from './types.js'

export * from './types.js'
export { AdapterError, type AdapterErrorCode } from './errors.js'
export { AnthropicAdapter, DEFAULT_MAX_TOKENS, DEFAULT_MODEL, type AnthropicAdapterOptions } from './anthropic-adapter.js'
export { FixtureAdapter, FIXTURE_MODEL, deriveScreenName } from './fixture-adapter.js'
export { ClaudeCodeAdapter, DEFAULT_CLI_MODEL, SHORT_TASK_TIMEOUT_MS, type ClaudeCodeAdapterOptions } from './claude-code-adapter.js'
export {
  ARGV_LIMIT,
  DEFAULT_CLI_BUDGET_USD,
  DEFAULT_CLI_TIMEOUT_MS,
  describeCliAuth,
  resolveClaudeBin,
  runClaudeCli,
  type ClaudeCliAuth,
  type ClaudeCliOptions,
  type ClaudeCliRequest,
  type ClaudeCliRun,
  type ResolvedClaudeBin,
} from './claude-code-cli.js'
export { PAIN_POINT_DRAFT_JSON_SCHEMA, REVISION_DRAFT_JSON_SCHEMA, RFP_EXTRACT_JSON_SCHEMA, SCREEN_OUTPUT_JSON_SCHEMA, type StructuredJsonSchema } from './structured-schema.js'
export { MATERIAL_BEGIN, MATERIAL_END, PAIN_POINT_DRAFT_SYSTEM, REVISION_DRAFT_SYSTEM, RFP_EXTRACT_SYSTEM, painPointDraftUser, revisionDraftUser, rfpExtractUser, type RfpExtractInput } from './prompts.js'
export { extractEvaluationItems, extractRfpByRules, splitSentences } from './rfp-fixture.js'
export { WireRfpExtraction, type WireRfpRequirement } from './wire-schema.js'
export { WireOutput, WirePainPoint, WirePainPointDraft, WireRevisionDraft, WireScreenSpec, toGenerationOutputInput } from './wire-schema.js'

/** OAuth 토큰(Authorization: Bearer)에 필요한 beta 헤더. SDK 는 authToken 을 직접 넘길 때 이 헤더를 붙이지 않으므로 defaultHeaders 로 넣는다. */
export const OAUTH_BETA_HEADER = 'oauth-2025-04-20'

export type ModelAuthMode = 'api_key' | 'token' | 'auto'

export interface CreateAdapterOptions {
  /** 테스트용 — fetch/maxRetries 등을 SDK 클라이언트에 넘긴다. 인증 옵션(apiKey/authToken/defaultHeaders)은 여기서 덮어쓰지 않는다. */
  clientOptions?: Pick<ClientOptions, 'fetch' | 'maxRetries' | 'baseURL' | 'timeout'>
  /** 테스트용 — `ant auth login` 프로필 존재 판정을 바꾼다. */
  profileAvailable?: (env: NodeJS.ProcessEnv) => boolean
}

const AUTH_GUIDE = [
  'anthropic 어댑터에 쓸 인증 수단이 없다. 다음 중 하나를 설정한다:',
  '  1) 내 Claude 구독 토큰 (권장): MODEL_AUTH=token 과 ANTHROPIC_AUTH_TOKEN=<토큰>',
  '     발급은 `claude setup-token` (Claude Code CLI, 구독 필요 · 장수명). Authorization: Bearer + anthropic-beta oauth-2025-04-20 로 나간다',
  '  2) API 키: MODEL_AUTH=api_key 와 ANTHROPIC_API_KEY=<키>  (platform.claude.com 에서 발급, x-api-key 헤더)',
  '  3) 프로필: 두 변수 없이 MODEL_AUTH=auto — SDK 가 `ant auth login` 프로필을 찾는다 (Anthropic 내부 CLI 가 깔려 있을 때만)',
  '또는 MODEL_ADAPTER=fixture 로 더미 어댑터를 쓴다 (자격 증명 없이 전 경로가 돈다).',
  '값은 .env 에만 두고 로그·응답·커밋에 넣지 않는다.',
].join('\n')

function nonEmpty(value: string | undefined): string | undefined {
  const v = value?.trim()
  return v !== undefined && v.length > 0 ? v : undefined
}

/** SDK 가 프로필을 찾는 위치와 같은 규칙으로 설정 디렉터리를 계산한다 (ANTHROPIC_CONFIG_DIR > 플랫폼 기본). */
export function defaultProfileAvailable(env: NodeJS.ProcessEnv): boolean {
  if (nonEmpty(env.ANTHROPIC_PROFILE) !== undefined) return true
  const explicit = nonEmpty(env.ANTHROPIC_CONFIG_DIR)
  let dir: string | undefined
  if (explicit !== undefined) dir = explicit
  else if (process.platform === 'win32') dir = nonEmpty(env.APPDATA) !== undefined ? join(env.APPDATA as string, 'Anthropic') : nonEmpty(env.USERPROFILE) !== undefined ? join(env.USERPROFILE as string, 'AppData', 'Roaming', 'Anthropic') : undefined
  else if (nonEmpty(env.XDG_CONFIG_HOME) !== undefined) dir = join(env.XDG_CONFIG_HOME as string, 'anthropic')
  else if (nonEmpty(env.HOME) !== undefined) dir = join(env.HOME as string, '.config', 'anthropic')
  if (dir === undefined) return false
  return existsSync(join(dir, 'configs'))
}

/** 비밀 값을 메시지에서 가리는 함수. 8자 미만 값은 오탐이 커서 가리지 않는다. */
function makeRedactor(secrets: Array<string | undefined>): (text: string) => string {
  const values = secrets.filter((s): s is string => s !== undefined && s.length >= 8)
  return (text) => values.reduce((acc, v) => acc.split(v).join('[비공개]'), text)
}

interface ResolvedAuth { client: Anthropic; auth: AdapterAuth; redact: (text: string) => string }

/**
 * 인증 방식 선택 (MODEL_AUTH). auto 는 ANTHROPIC_API_KEY → ANTHROPIC_AUTH_TOKEN → `ant auth login` 프로필 순.
 * api_key 경로는 authToken 을 null 로, token 경로는 apiKey 를 null 로 명시해 SDK 가 다른 env 를 함께 읽어 두 헤더를 보내는 일을 막는다.
 */
function resolveAnthropicAuth(env: NodeJS.ProcessEnv, opts: CreateAdapterOptions): ResolvedAuth {
  const mode = nonEmpty(env.MODEL_AUTH) ?? 'auto'
  if (mode !== 'api_key' && mode !== 'token' && mode !== 'auto') throw new Error(`MODEL_AUTH 값이 올바르지 않다: "${mode}" (api_key | token | auto 중 하나)`)
  const apiKey = nonEmpty(env.ANTHROPIC_API_KEY)
  const token = nonEmpty(env.ANTHROPIC_AUTH_TOKEN)
  const redact = makeRedactor([apiKey, token])
  const base: ClientOptions = { ...opts.clientOptions }

  const useApiKey = (): ResolvedAuth => {
    if (apiKey === undefined) throw new Error(`MODEL_AUTH=api_key 인데 ANTHROPIC_API_KEY 가 없다.\n${AUTH_GUIDE}`)
    return { client: new Anthropic({ ...base, apiKey, authToken: null }), auth: 'api_key', redact }
  }
  const useToken = (): ResolvedAuth => {
    if (token === undefined) throw new Error(`MODEL_AUTH=token 인데 ANTHROPIC_AUTH_TOKEN 이 없다.\n${AUTH_GUIDE}`)
    return { client: new Anthropic({ ...base, authToken: token, apiKey: null, defaultHeaders: { 'anthropic-beta': OAUTH_BETA_HEADER } }), auth: 'token', redact }
  }
  if (mode === 'api_key') return useApiKey()
  if (mode === 'token') return useToken()
  if (apiKey !== undefined) return useApiKey()
  if (token !== undefined) return useToken()
  const profileAvailable = opts.profileAvailable ?? defaultProfileAvailable
  if (profileAvailable(env)) {
    // 키·토큰 없이 zero-arg 클라이언트: SDK 가 `ant auth login` 프로필을 해석하고 OAuth beta 헤더도 스스로 붙인다.
    return { client: new Anthropic({ ...base }), auth: 'profile', redact }
  }
  throw new Error(`MODEL_ADAPTER=anthropic 인데 ANTHROPIC_API_KEY 도 ANTHROPIC_AUTH_TOKEN 도 없고 \`ant auth login\` 프로필도 찾지 못했다.\n${AUTH_GUIDE}`)
}

/**
 * MODEL_ADAPTER 로 어댑터를 고른다: `claude_code` → ClaudeCodeAdapter, `anthropic` → AnthropicAdapter, 그 외(기본) → FixtureAdapter.
 * 알 수 없는 값이면 **조용히 더미로 떨어지지 않고** 거절한다 — 오타 때문에 더미로 돌고 있는 것을 모르는 일을 막는다.
 */
export function createAdapter(env: NodeJS.ProcessEnv, opts: CreateAdapterOptions = {}): ModelAdapter {
  const requested = nonEmpty(env.MODEL_ADAPTER)
  if (requested !== undefined && requested !== 'anthropic' && requested !== 'fixture' && requested !== 'claude_code') {
    throw new Error(`MODEL_ADAPTER 값이 올바르지 않다: "${requested}" (claude_code | anthropic | fixture 중 하나)`)
  }
  if (requested === 'claude_code') {
    return new ClaudeCodeAdapter({ model: nonEmpty(env.MODEL_ID) ?? DEFAULT_CLI_MODEL, env })
  }
  if (requested !== 'anthropic') return new FixtureAdapter()
  const model = nonEmpty(env.MODEL_ID) ?? DEFAULT_MODEL
  const { client, auth, redact } = resolveAnthropicAuth(env, opts)
  return new AnthropicAdapter({ client, model, auth, redact })
}
