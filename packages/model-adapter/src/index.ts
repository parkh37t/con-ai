/**
 * @con-ai/model-adapter — 모델 호출 어댑터 (세로 조각 계약 §3).
 * MODEL_ADAPTER=anthropic|fixture (기본 fixture), MODEL_ID (기본 claude-opus-5), MODEL_AUTH=api_key|token|auto (기본 auto).
 * 키·토큰은 환경변수(ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN)에서만 읽고 절대 로그·응답에 넣지 않는다.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import Anthropic, { type ClientOptions } from '@anthropic-ai/sdk'
import { AnthropicAdapter, DEFAULT_MODEL } from './anthropic-adapter.js'
import { FixtureAdapter } from './fixture-adapter.js'
import type { AdapterAuth, ModelAdapter } from './types.js'

export * from './types.js'
export { AdapterError, type AdapterErrorCode } from './errors.js'
export { AnthropicAdapter, DEFAULT_MAX_TOKENS, DEFAULT_MODEL, type AnthropicAdapterOptions } from './anthropic-adapter.js'
export { FixtureAdapter, FIXTURE_MODEL, deriveScreenName } from './fixture-adapter.js'
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
  '  1) API 키: ANTHROPIC_API_KEY=<키>  (콘솔에서 발급, x-api-key 헤더)',
  '  2) 토큰: ANTHROPIC_AUTH_TOKEN=<OAuth 토큰>  (`set -a; eval "$(ant auth print-credentials --env)"; set +a`, Authorization: Bearer + anthropic-beta oauth-2025-04-20)',
  '  3) 프로필: `ant auth login` 후 두 변수 없이 실행 (MODEL_AUTH=auto)',
  '또는 MODEL_ADAPTER=fixture 로 더미 어댑터를 쓴다.',
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

/** MODEL_ADAPTER=anthropic 이면 AnthropicAdapter, 그 외(기본)는 FixtureAdapter. */
export function createAdapter(env: NodeJS.ProcessEnv, opts: CreateAdapterOptions = {}): ModelAdapter {
  if (nonEmpty(env.MODEL_ADAPTER) !== 'anthropic') return new FixtureAdapter()
  const model = nonEmpty(env.MODEL_ID) ?? DEFAULT_MODEL
  const { client, auth, redact } = resolveAnthropicAuth(env, opts)
  return new AnthropicAdapter({ client, model, auth, redact })
}
