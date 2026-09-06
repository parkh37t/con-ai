/**
 * 브라우저에서 Anthropic Messages API 를 직접 호출한다 (서버 없음, GitHub Pages 정적 배포용).
 *
 * - `POST https://api.anthropic.com/v1/messages`, `anthropic-version: 2023-06-01`,
 *   `anthropic-dangerous-direct-browser-access: true` (브라우저 직접 호출 허용 헤더).
 * - 인증: `api_key` → `x-api-key`, `token` → `authorization: Bearer …` + `anthropic-beta: oauth-2025-04-20`.
 * - 구조화 출력: `output_config: { format: { type: 'json_schema', schema }, effort: 'high' }`.
 *   보내는 JSON Schema 는 `packages/model-adapter/src/structured-schema.ts` (SDK 변환기가 만든 생성물) 한 벌을 그대로 쓴다.
 * - 자격 증명 값은 헤더에만 넣는다. 콘솔·오류 메시지·저장 데이터에 넣지 않는다 (redact 로 한 번 더 가린다).
 * - fetch 는 주입할 수 있다 (테스트).
 */
import type { CredentialKind, StoredCredential } from './credential.js'

export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'
export const ANTHROPIC_VERSION = '2023-06-01'
export const OAUTH_BETA = 'oauth-2025-04-20'
export const DEFAULT_BROWSER_MODEL = 'claude-opus-5'
export const DEFAULT_MAX_TOKENS = 16000

/** 실패 분류 — 화면에서 원인별로 다르게 안내한다. */
export type BrowserModelErrorCode = 'auth' | 'rate_limit' | 'bad_request' | 'refusal' | 'empty_output' | 'parse' | 'network' | 'api_error'

export class BrowserModelError extends Error {
  override readonly name = 'BrowserModelError'
  readonly code: BrowserModelErrorCode
  readonly status: number | undefined
  readonly details: string[]

  constructor(code: BrowserModelErrorCode, message: string, opts: { status?: number | undefined; details?: string[] } = {}) {
    super(message)
    this.code = code
    this.status = opts.status
    this.details = opts.details ?? []
  }
}

/** 테스트에서 갈아끼우는 fetch 형태. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>

export interface CallInput {
  credential: StoredCredential
  system: string
  user: string
  /** output_config.format.schema 로 보낼 JSON Schema. */
  schema: Record<string, unknown>
  model?: string
  max_tokens?: number
  signal?: AbortSignal
}

export interface CallResult<T> {
  output: T
  raw_text: string
  usage: { input_tokens: number; output_tokens: number }
  stop_reason: string | undefined
  model: string
}

/** 인증 방식별 헤더. 값은 여기서만 쓰고 밖으로 돌려주지 않는다. */
export function authHeaders(credential: StoredCredential): Record<string, string> {
  if (credential.kind === 'token') {
    return { authorization: `Bearer ${credential.value}`, 'anthropic-beta': OAUTH_BETA }
  }
  return { 'x-api-key': credential.value }
}

/** 오류 문구에 자격 증명 값이 섞여 들어가지 않게 한 번 더 가린다. */
function redactWith(secret: string): (text: string) => string {
  return (text: string) => (secret.length >= 8 ? text.split(secret).join('***') : text)
}

function firstText(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const rec = body as Record<string, unknown>
  const err = rec['error']
  if (typeof err === 'object' && err !== null) {
    const m = (err as Record<string, unknown>)['message']
    if (typeof m === 'string' && m.trim()) return m
  }
  const m = rec['message']
  return typeof m === 'string' && m.trim() ? m : undefined
}

const AUTH_HINT: Readonly<Record<CredentialKind, string>> = {
  api_key: 'API 키(sk-ant-…)가 유효한지, 콘솔에서 삭제되지 않았는지 확인하세요.',
  token: '토큰이 만료되지 않았는지 확인하세요 (만료되면 다시 발급해 넣어야 합니다).',
}

/** HTTP 상태 → 한국어 메시지. 자격 증명 값은 넣지 않는다. */
function toHttpError(status: number, body: unknown, kind: CredentialKind, redact: (t: string) => string): BrowserModelError {
  const reason = firstText(body)
  const detail = reason === undefined ? [] : [redact(reason)]
  if (status === 401 || status === 403) {
    return new BrowserModelError('auth', `모델 API 인증에 실패했습니다 (HTTP ${status}). ${AUTH_HINT[kind]}`, { status, details: detail })
  }
  if (status === 429) {
    return new BrowserModelError('rate_limit', '모델 API 요청 한도를 초과했습니다 (HTTP 429). 잠시 뒤 다시 실행하세요.', { status, details: detail })
  }
  if (status === 400) {
    return new BrowserModelError('bad_request', '모델 API 가 요청을 거부했습니다 (HTTP 400 — 요청 형식·파라미터 오류).', { status, details: detail })
  }
  return new BrowserModelError('api_error', `모델 API 오류입니다 (HTTP ${status}).`, { status, details: detail })
}

/** ```json 울타리를 벗겨낸다 (구조화 출력이 아닌 텍스트로 올 때 대비). */
function stripFence(text: string): string {
  const m = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/.exec(text)
  return m?.[1] ?? text
}

interface MessageLike {
  content?: unknown
  parsed_output?: unknown
  stop_reason?: unknown
  stop_details?: unknown
  usage?: unknown
  model?: unknown
}

/** 응답 본문에서 text 블록을 모은다. */
export function collectText(message: MessageLike): string {
  const blocks = Array.isArray(message.content) ? message.content : []
  const out: string[] = []
  for (const b of blocks) {
    if (typeof b !== 'object' || b === null) continue
    const rec = b as Record<string, unknown>
    if (rec['type'] === 'text' && typeof rec['text'] === 'string') out.push(rec['text'])
  }
  return out.join('\n')
}

/** 구조화 결과 꺼내기 — parsed_output 이 있으면 그대로, 없으면 text 블록을 JSON 으로 읽는다. */
export function extractStructured<T>(message: MessageLike): { output: T; raw_text: string } {
  const raw_text = collectText(message)
  const parsed = message.parsed_output
  if (typeof parsed === 'object' && parsed !== null) return { output: parsed as T, raw_text }
  const stop = typeof message.stop_reason === 'string' ? message.stop_reason : undefined
  if (raw_text.trim().length === 0) {
    throw new BrowserModelError('empty_output', `모델 응답에서 구조화 결과를 얻지 못했습니다 (stop_reason: ${stop ?? '없음'}).`)
  }
  try {
    return { output: JSON.parse(stripFence(raw_text)) as T, raw_text }
  } catch {
    const truncated = stop === 'max_tokens' ? ' 출력이 max_tokens 에서 잘렸습니다 — 더 짧은 범위로 나눠 실행하세요.' : ''
    throw new BrowserModelError('parse', `모델 응답을 JSON 으로 읽지 못했습니다.${truncated}`, { details: [raw_text.slice(0, 300)] })
  }
}

/** Messages API 한 번 호출 → 구조화 결과. */
export async function callAnthropic<T>(input: CallInput, opts: { fetch?: FetchLike | undefined } = {}): Promise<CallResult<T>> {
  const doFetch: FetchLike = opts.fetch ?? ((url, init) => fetch(url, init))
  const model = input.model ?? DEFAULT_BROWSER_MODEL
  const redact = redactWith(input.credential.value)
  const body = {
    model,
    max_tokens: input.max_tokens ?? DEFAULT_MAX_TOKENS,
    system: input.system,
    messages: [{ role: 'user', content: input.user }],
    // 구조화 출력 + 사고 강도. thinking 파라미터는 넣지 않는다 (claude-opus-5 는 기본 adaptive).
    output_config: { format: { type: 'json_schema', schema: input.schema }, effort: 'high' },
  }
  const init: RequestInit = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
      ...authHeaders(input.credential),
    },
    body: JSON.stringify(body),
  }
  if (input.signal) init.signal = input.signal

  let res: Response
  try {
    res = await doFetch(ANTHROPIC_MESSAGES_URL, init)
  } catch (e) {
    const reason = e instanceof Error ? redact(e.message) : ''
    throw new BrowserModelError('network', 'api.anthropic.com 에 연결하지 못했습니다 (네트워크·차단 프로그램·오프라인 여부를 확인하세요).', { details: reason ? [reason] : [] })
  }

  const text = await res.text()
  let payload: unknown
  try {
    payload = text ? (JSON.parse(text) as unknown) : undefined
  } catch {
    payload = text
  }
  if (!res.ok) throw toHttpError(res.status, payload, input.credential.kind, redact)

  const message = (typeof payload === 'object' && payload !== null ? payload : {}) as MessageLike
  const stop_reason = typeof message.stop_reason === 'string' ? message.stop_reason : undefined
  if (stop_reason === 'refusal') {
    const d = typeof message.stop_details === 'object' && message.stop_details !== null ? (message.stop_details as Record<string, unknown>) : {}
    const category = typeof d['category'] === 'string' ? d['category'] : '미상'
    const explanation = typeof d['explanation'] === 'string' ? redact(d['explanation']) : ''
    throw new BrowserModelError('refusal', `모델이 요청을 거부했습니다 (분류: ${category}). 요청 내용을 바꿔 다시 시도하세요.`, { details: explanation ? [explanation] : [] })
  }

  const { output, raw_text } = extractStructured<T>(message)
  const usageRec = typeof message.usage === 'object' && message.usage !== null ? (message.usage as Record<string, unknown>) : {}
  return {
    output,
    raw_text,
    usage: {
      input_tokens: typeof usageRec['input_tokens'] === 'number' ? usageRec['input_tokens'] : 0,
      output_tokens: typeof usageRec['output_tokens'] === 'number' ? usageRec['output_tokens'] : 0,
    },
    stop_reason,
    model: typeof message.model === 'string' ? message.model : model,
  }
}

// ---------------------------------------------------------------- JSON Schema (손으로 쓴 wire 스키마)

/*
 * packages/model-adapter/src/wire-schema.ts 의 zod 스키마와 1:1 로 맞춘다 (같은 키·같은 필수 여부).
 * enum 값은 @con-ai/schemas 의 enum 을 그대로 읽어 쓰므로 어긋나지 않는다.
 *
 * | wire-schema.ts (zod)  | 아래 JSON Schema        |
 * |---|---|
 * | WireTableColumn       | tableColumn             |
 * | WireDefaultSort       | defaultSort             |
 * | WireFieldValidation   | fieldValidation         |
 * | WireElementOption     | elementOption           |
 * | WireElement           | element                 |
 * | WireSection           | section                 |
 * | WireAction            | action                  |
 * | WireScreenState       | screenState             |
 * | WireMessage           | message                 |
 * | WireDataMapping       | dataMapping (+anchorRef)|
 * | WireUnresolved        | unresolved              |
 * | WireScreenSpec        | screenSpec              |
 * | WireTraceProposal     | traceProposal           |
 * | WireChangeSummary     | changeSummary           |
 * | WireOutput            | SCREEN_OUTPUT_JSON_SCHEMA |
 * | WireRevisionDraft     | REVISION_DRAFT_JSON_SCHEMA |
 *
 * 구조화 출력으로 보내는 JSON Schema 는 **손으로 적지 않는다.**
 * 서버(`packages/model-adapter`)가 SDK 변환기로 만든 한 벌(`structured-schema.ts`)을 그대로 가져다 쓴다.
 * 예전에는 같은 스키마를 여기에 한 벌 더 적었는데, 변환기가 구조화 출력이 받지 않는 것(enum·const·중첩 anyOf)을
 * 설명으로 옮기는 것을 사람이 따라 적을 수 없어 계속 어긋났고 실제 호출이 400 으로 죽었다.
 */

export { REVISION_DRAFT_JSON_SCHEMA, SCREEN_OUTPUT_JSON_SCHEMA } from './deps.js'
