/**
 * 모델 출력용 wire 스키마 — 구조화 출력(zodOutputFormat)에 넘기는 순수 zod 객체.
 *
 * schemas 의 ScreenSpec/GenerationOutput 은 superRefine(참조 무결성)·정규식·default 가 있어 JSON Schema 로 바꾸기 어렵고,
 * SDK 의 변환기는 enum·pattern·minItems>1 등을 description 으로 밀어낸다. 그래서 여기서는 z.object / z.enum / z.array / z.optional
 * 만으로 같은 구조를 정의한다. enum 값은 schemas 의 enum 을 그대로 써서 어긋나지 않게 한다.
 *
 * 어댑터는 파싱된 wire 결과를 그대로 `output`(GenerationOutputInput)으로 돌려주고, 최종 검증(참조·정규식·필수 CASE)은 서버가 한다 (설계 §8).
 *
 * **API 로 보낼 때는 `structuredVariant` 로 바꿔 보낸다.** 구조화 출력에는 스키마 전체의 선택 파라미터 수 상한(24)이 있어
 * 이 구조를 `.optional()` 그대로 보내면 38개가 되어 API 가 400 으로 거부한다
 * ("Schemas contains too many optional parameters"). 그래서 보낼 때만 선택(`optional`)을 «필수 + null 허용»(`nullable`)으로
 * 바꿔 상한을 0 으로 만들고, 받은 뒤 `stripNulls` 로 null 인 키를 지워 원래 스키마로 되읽는다.
 * 표현력은 그대로다. 개수는 optional-limit 테스트가 지킨다.
 */
import { z } from 'zod'
import { ActionType, CaseKind, ColumnFormat, DeviceProfile, ElementType, MessageKind, SortDirection, UnresolvedKind, ValidationRule, type GenerationOutputInput } from '@con-ai/schemas'

const WireTableColumn = z.object({
  id: z.string(),
  label: z.string(),
  sortable: z.boolean().optional(),
  downloadable: z.boolean().optional(),
  format: ColumnFormat.optional(),
})

const WireDefaultSort = z.object({ column_id: z.string(), direction: SortDirection })

const WireFieldValidation = z.object({
  rule: ValidationRule,
  value: z.union([z.string(), z.number()]).optional(),
  message_id: z.string().optional(),
})

const WireElementOption = z.object({ value: z.string(), label: z.string() })

export const WireElement = z.object({
  id: z.string(),
  type: ElementType,
  label: z.string(),
  required: z.boolean().optional(),
  display_no: z.string().optional(),
  placeholder: z.string().optional(),
  options: z.array(WireElementOption).optional(),
  columns: z.array(WireTableColumn).optional(),
  default_sort: WireDefaultSort.optional(),
  max_length: z.int().optional(),
  validations: z.array(WireFieldValidation).optional(),
  trace: z.array(z.string()).optional(),
  locked: z.boolean().optional(),
  note: z.string().optional(),
})

export const WireSection = z.object({
  id: z.string(),
  title: z.string(),
  display_no: z.string().optional(),
  elements: z.array(WireElement),
  note: z.string().optional(),
})

export const WireAction = z.object({
  id: z.string(),
  type: ActionType,
  label: z.string().optional(),
  trigger: z.string().optional(),
  target: z.string().optional(),
  target_screen_id: z.string().optional(),
  target_state_id: z.string().optional(),
  trace: z.array(z.string()).optional(),
  note: z.string().optional(),
})

export const WireScreenState = z.object({
  id: z.string(),
  fixture_id: z.string(),
  expected: z.string(),
  case_kind: CaseKind.optional(),
  role: z.string().optional(),
  message_ids: z.array(z.string()).optional(),
  note: z.string().optional(),
})

export const WireMessage = z.object({ id: z.string(), kind: MessageKind, text: z.string(), when: z.string().optional() })

const WireAnchorRef = z.object({ anchor_id: z.string(), note: z.string().optional() })

export const WireDataMapping = z.object({
  element_id: z.string(),
  column_id: z.string().optional(),
  source: z.string(),
  evidence: z.array(WireAnchorRef),
})

export const WireUnresolved = z.object({
  id: z.string().optional(),
  kind: UnresolvedKind,
  text: z.string(),
  related_ids: z.array(z.string()).optional(),
})

const WireRequirementRef = z.object({ id: z.string(), criterion_ids: z.array(z.string()) })

/** ScreenSpec 구조 (schemas ScreenSpecShape 와 같은 키). 배열은 비어 있어도 명시한다. */
export const WireScreenSpec = z.object({
  schema_version: z.literal('1.0'),
  screen_id: z.string(),
  baseline_id: z.string(),
  purpose: z.string(),
  shell: z.string(),
  device: DeviceProfile,
  roles: z.array(z.string()).optional(),
  requirements: z.array(WireRequirementRef),
  sections: z.array(WireSection),
  actions: z.array(WireAction),
  states: z.array(WireScreenState),
  messages: z.array(WireMessage),
  data_mapping: z.array(WireDataMapping),
  locked_elements: z.array(z.string()),
  locked_actions: z.array(z.string()),
  unresolved: z.array(WireUnresolved),
})

export const WireTraceProposal = z.object({
  requirement_id: z.string(),
  criterion_id: z.string(),
  element_or_action_id: z.string(),
  evidence: z.array(WireAnchorRef).optional(),
  rationale: z.string().optional(),
  confidence: z.number().optional(),
})

export const WireChangeSummary = z.object({
  summary: z.string(),
  added_ids: z.array(z.string()),
  changed_ids: z.array(z.string()),
  removed_ids: z.array(z.string()),
  locked_violations: z.array(z.string()),
})

/** 모델 출력 전체 (설계 §8 산출 4종). html 키는 없다. */
export const WireOutput = z.object({
  screen_spec: WireScreenSpec,
  trace_proposals: z.array(WireTraceProposal),
  unresolved: z.array(WireUnresolved),
  change_summary: WireChangeSummary,
})

/** 코멘트 → 수정 지시문 초안 (draftRevisionPrompt 의 구조화 출력). */
export const WireRevisionDraft = z.object({ prompt: z.string(), rationale: z.string() })

/** AS-IS 분석 페인포인트 초안 (draftPainPoints 의 구조화 출력, 계약 §12). id·status 는 서버가 부여하므로 여기 없다. */
export const WirePainPoint = z.object({
  area: z.string(),
  severity: z.enum(['high', 'medium', 'low']),
  description: z.string(),
  evidence: z.string(),
  suggestion: z.string(),
})
export const WirePainPointDraft = z.object({ summary: z.string(), pain_points: z.array(WirePainPoint) })

export type WireScreenSpec = z.infer<typeof WireScreenSpec>
export type WireOutput = z.infer<typeof WireOutput>
export type WireRevisionDraft = z.infer<typeof WireRevisionDraft>
export type WirePainPointDraft = z.infer<typeof WirePainPointDraft>

/** wire 결과는 그대로 GenerationOutputInput 이어야 한다 — 어긋나면 여기서 컴파일이 실패한다. */
export function toGenerationOutputInput(wire: WireOutput): GenerationOutputInput {
  return wire
}

// ---------------------------------------------------------------- 구조화 출력용 변환

/**
 * 구조화 출력으로 보낼 스키마 — 선택 필드를 «필수 + null 허용» 으로 바꾼다.
 * 스키마를 두 벌 적지 않으려고 원본에서 **파생**한다 (한쪽만 고쳐 어긋나는 일을 만들지 않는다).
 */
export function structuredVariant<T extends z.ZodType>(schema: T): z.ZodType {
  if (schema instanceof z.ZodOptional) return structuredVariant(schema.unwrap() as z.ZodType).nullable()
  if (schema instanceof z.ZodNullable) return structuredVariant(schema.unwrap() as z.ZodType).nullable()
  if (schema instanceof z.ZodArray) return z.array(structuredVariant(schema.element as z.ZodType))
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodType>
    const next: Record<string, z.ZodType> = {}
    for (const [key, value] of Object.entries(shape)) next[key] = structuredVariant(value)
    const built = z.object(next)
    const description = schema.description
    return description === undefined ? built : built.describe(description)
  }
  return schema
}

/**
 * 값이 null 인 키를 지운다 — 구조화 출력의 «없음» 표기(null)를 스키마의 «없음» 표기(키 없음)로 되돌린다.
 * 배열 원소의 null 은 지우지 않는다. 형식 오류이므로 뒤 스키마가 거부해야 한다.
 */
export function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => stripNulls(v))
  if (value === null || typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === null) continue
    out[k] = stripNulls(v)
  }
  return out
}

/**
 * `stripNulls` 의 반대 — 없는 선택 키를 null 로 채운다. **모델이 실제로 보내는 모양**이다.
 * 테스트가 모델 응답을 흉내낼 때 쓴다 (없는 키를 그대로 두면 실제 응답과 달라 검사가 헛돈다).
 */
export function fillMissingWithNull<T extends z.ZodType>(schema: T, value: unknown): unknown {
  if (schema instanceof z.ZodOptional) return value === undefined ? null : fillMissingWithNull(schema.unwrap() as z.ZodType, value)
  if (schema instanceof z.ZodNullable) return value === undefined || value === null ? null : fillMissingWithNull(schema.unwrap() as z.ZodType, value)
  if (schema instanceof z.ZodArray) {
    return Array.isArray(value) ? value.map((v) => fillMissingWithNull(schema.element as z.ZodType, v)) : value
  }
  if (schema instanceof z.ZodObject) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return value
    const source = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [key, inner] of Object.entries(schema.shape as Record<string, z.ZodType>)) {
      out[key] = fillMissingWithNull(inner, source[key])
    }
    return out
  }
  return value
}

/**
 * 펼친 스키마 트리에서 선택 파라미터가 몇 개인지 — API 가 세는 방식대로 «나올 때마다» 센다.
 * 상한(24)을 넘으면 API 가 400 으로 거부하므로 테스트가 이 값을 지킨다.
 */
export const STRUCTURED_OUTPUT_OPTIONAL_LIMIT = 24

export function countOptionalParameters(jsonSchema: unknown): number {
  if (jsonSchema === null || typeof jsonSchema !== 'object') return 0
  const node = jsonSchema as Record<string, unknown>
  let n = 0
  const properties = node['properties']
  if (node['type'] === 'object' && properties !== undefined && typeof properties === 'object') {
    const required = new Set(Array.isArray(node['required']) ? (node['required'] as unknown[]).map(String) : [])
    for (const [key, value] of Object.entries(properties as Record<string, unknown>)) {
      if (!required.has(key)) n += 1
      n += countOptionalParameters(value)
    }
  }
  if (node['items'] !== undefined) n += countOptionalParameters(node['items'])
  for (const key of ['anyOf', 'oneOf', 'allOf']) {
    const branch = node[key]
    if (Array.isArray(branch)) for (const v of branch) n += countOptionalParameters(v)
  }
  const defs = node['$defs']
  if (defs !== undefined && typeof defs === 'object' && defs !== null) {
    for (const v of Object.values(defs as Record<string, unknown>)) n += countOptionalParameters(v)
  }
  return n
}
