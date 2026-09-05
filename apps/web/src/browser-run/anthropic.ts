/**
 * 브라우저에서 Anthropic Messages API 를 직접 호출한다 (서버 없음, GitHub Pages 정적 배포용).
 *
 * - `POST https://api.anthropic.com/v1/messages`, `anthropic-version: 2023-06-01`,
 *   `anthropic-dangerous-direct-browser-access: true` (브라우저 직접 호출 허용 헤더).
 * - 인증: `api_key` → `x-api-key`, `token` → `authorization: Bearer …` + `anthropic-beta: oauth-2025-04-20`.
 * - 구조화 출력: `output_config: { format: { type: 'json_schema', schema }, effort: 'high' }`.
 *   SDK(@anthropic-ai/sdk)를 웹 번들에 넣지 않으므로 zod→JSON Schema 변환기 대신 손으로 쓴 JSON Schema 를 쓴다.
 * - 자격 증명 값은 헤더에만 넣는다. 콘솔·오류 메시지·저장 데이터에 넣지 않는다 (redact 로 한 번 더 가린다).
 * - fetch 는 주입할 수 있다 (테스트).
 */
import { ActionType, CaseKind, ColumnFormat, DeviceProfile, ElementType, MessageKind, SortDirection, UnresolvedKind, ValidationRule } from './deps.js'
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
 * 구조화 출력 제약(문서): 모든 object 에 additionalProperties:false, 재귀 금지, 숫자·문자열 길이 제약 미지원.
 */

type JsonSchema = Record<string, unknown>

function obj(properties: Record<string, JsonSchema>, required: string[]): JsonSchema {
  return { type: 'object', properties, required, additionalProperties: false }
}
function arr(items: JsonSchema): JsonSchema {
  return { type: 'array', items }
}
function str(description?: string): JsonSchema {
  return description === undefined ? { type: 'string' } : { type: 'string', description }
}
function enumOf(values: readonly string[]): JsonSchema {
  return { type: 'string', enum: [...values] }
}

const anchorRef = obj({ anchor_id: str('SourceAnchor 의 내부 UUID (uuid 형식). 실제 근거가 없으면 data_mapping 대신 unresolved 로 보낸다'), note: str() }, ['anchor_id'])

const tableColumn = obj(
  { id: str(), label: str(), sortable: { type: 'boolean' }, downloadable: { type: 'boolean' }, format: enumOf(ColumnFormat.options) },
  ['id', 'label'],
)

const defaultSort = obj({ column_id: str(), direction: enumOf(SortDirection.options) }, ['column_id', 'direction'])

const fieldValidation = obj({ rule: enumOf(ValidationRule.options), value: { anyOf: [{ type: 'string' }, { type: 'number' }] }, message_id: str() }, ['rule'])

const elementOption = obj({ value: str(), label: str() }, ['value', 'label'])

const element = obj(
  {
    id: str('영역·요소 이름공간에서 유일한 로컬 ID (영숫자로 시작, 영숫자 . _ : - 만)'),
    type: enumOf(ElementType.options),
    label: str(),
    required: { type: 'boolean' },
    display_no: str(),
    placeholder: str(),
    options: arr(elementOption),
    columns: arr(tableColumn),
    default_sort: defaultSort,
    max_length: { type: 'integer' },
    validations: arr(fieldValidation),
    trace: arr(str('수용조건 외부 ID')),
    locked: { type: 'boolean' },
    note: str(),
  },
  ['id', 'type', 'label'],
)

const section = obj({ id: str(), title: str(), display_no: str(), elements: arr(element), note: str() }, ['id', 'title', 'elements'])

const action = obj(
  {
    id: str(),
    type: enumOf(ActionType.options),
    label: str(),
    trigger: str('동작을 일으키는 요소 id'),
    target: str('정의된 영역·요소 id'),
    target_screen_id: str('대상 화면 외부 ID'),
    target_state_id: str('전이할 CASE id'),
    trace: arr(str()),
    note: str(),
  },
  ['id', 'type'],
)

const screenState = obj(
  { id: str(), fixture_id: str('더미데이터 fixture 외부 ID'), expected: str(), case_kind: enumOf(CaseKind.options), role: str(), message_ids: arr(str()), note: str() },
  ['id', 'fixture_id', 'expected'],
)

const message = obj({ id: str(), kind: enumOf(MessageKind.options), text: str(), when: str() }, ['id', 'kind', 'text'])

const dataMapping = obj({ element_id: str(), column_id: str(), source: str(), evidence: arr(anchorRef) }, ['element_id', 'source', 'evidence'])

const unresolved = obj({ id: str(), kind: enumOf(UnresolvedKind.options), text: str(), related_ids: arr(str()) }, ['kind', 'text'])

const requirementRef = obj({ id: str('REQ 외부 ID'), criterion_ids: arr(str('수용조건 외부 ID')) }, ['id', 'criterion_ids'])

const screenSpec = obj(
  {
    schema_version: { type: 'string', const: '1.0' },
    screen_id: str('대상 화면의 외부 ID (변경 금지)'),
    baseline_id: str('기준 버전 ID (변경 금지)'),
    purpose: str(),
    shell: str('`<포털>-page` 또는 `<포털>-popup`'),
    device: enumOf(DeviceProfile.options),
    roles: arr(str()),
    requirements: arr(requirementRef),
    sections: arr(section),
    actions: arr(action),
    states: arr(screenState),
    messages: arr(message),
    data_mapping: arr(dataMapping),
    locked_elements: arr(str()),
    locked_actions: arr(str()),
    unresolved: arr(unresolved),
  },
  ['schema_version', 'screen_id', 'baseline_id', 'purpose', 'shell', 'device', 'requirements', 'sections', 'actions', 'states', 'messages', 'data_mapping', 'locked_elements', 'locked_actions', 'unresolved'],
)

const traceProposal = obj(
  { requirement_id: str(), criterion_id: str(), element_or_action_id: str(), evidence: arr(anchorRef), rationale: str(), confidence: { type: 'number' } },
  ['requirement_id', 'criterion_id', 'element_or_action_id'],
)

const changeSummary = obj(
  { summary: str(), added_ids: arr(str()), changed_ids: arr(str()), removed_ids: arr(str()), locked_violations: arr(str()) },
  ['summary', 'added_ids', 'changed_ids', 'removed_ids', 'locked_violations'],
)

/** 생성·수정 작업의 모델 출력 전체 (wire-schema.ts WireOutput). html 키는 없다. */
export const SCREEN_OUTPUT_JSON_SCHEMA: JsonSchema = obj(
  { screen_spec: screenSpec, trace_proposals: arr(traceProposal), unresolved: arr(unresolved), change_summary: changeSummary },
  ['screen_spec', 'trace_proposals', 'unresolved', 'change_summary'],
)

/** 코멘트 → 수정 지시문 초안 (wire-schema.ts WireRevisionDraft). */
export const REVISION_DRAFT_JSON_SCHEMA: JsonSchema = obj({ prompt: str(), rationale: str() }, ['prompt', 'rationale'])
