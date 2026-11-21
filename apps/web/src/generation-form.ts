/**
 * 생성 작업대 폼 → SliceGenerationRequest (계약 §2). 순수 함수: 초기값, 검사, 요청 변환.
 */
import type { Device, Screen, SliceCase, SliceGenerationRequest, SliceTaskType } from './types.js'

export const TASK_TYPE_LABELS: Readonly<Record<SliceTaskType, string>> = {
  create: '신규 생성',
  edit: '단건 수정',
  clone_reference: '참조 복제',
}

export const ALL_CASES: readonly SliceCase[] = ['normal', 'empty', 'error', 'permission', 'processing']

export interface GenerationFormState {
  task_type: SliceTaskType
  purpose: string
  scope: string
  requirement_ids: string[]
  criterion_ids: string[]
  reference_ids: string[]
  cases: SliceCase[]
  keep_conditions_text: string
  roles_text: string
  device: Device
  base_revision_id: string
  use_prompt_override: boolean
  prompt_override: string
}

export function initialFormState(screen?: Pick<Screen, 'device' | 'current_revision_id'> | null): GenerationFormState {
  return {
    task_type: 'create',
    purpose: '',
    scope: '',
    requirement_ids: [],
    criterion_ids: [],
    reference_ids: [],
    cases: ['normal'],
    keep_conditions_text: '',
    roles_text: '',
    device: screen?.device ?? 'desktop',
    base_revision_id: screen?.current_revision_id ?? '',
    use_prompt_override: false,
    prompt_override: '',
  }
}

/** 줄 단위 입력 → 빈 줄 제거·trim. */
export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** 역할 입력 — 쉼표·공백·줄바꿈으로 나눈다 (역할 ID 에는 공백이 없다). 중복 제거. */
export function splitRoles(text: string): string[] {
  const out: string[] = []
  for (const r of text.split(/[\s,]+/)) {
    const v = r.trim()
    if (v && !out.includes(v)) out.push(v)
  }
  return out
}

/** 배열 안의 값을 켜고 끈다 (순서 유지). */
export function toggleIn<T>(list: readonly T[], value: T, on: boolean): T[] {
  const has = list.includes(value)
  if (on && !has) return [...list, value]
  if (!on && has) return list.filter((v) => v !== value)
  return [...list]
}

/** 폼 검사 — 실행 전에 보여줄 오류 문구. 비어 있으면 실행 가능. */
export function validateForm(form: GenerationFormState): string[] {
  const errors: string[] = []
  const override = form.use_prompt_override ? form.prompt_override.trim() : ''
  if (!form.purpose.trim() && !override) errors.push('목적을 입력하거나 직접 프롬프트를 쓰세요.')
  if (form.use_prompt_override && !override) errors.push('직접 프롬프트를 켰지만 내용이 비어 있습니다.')
  if (form.cases.length === 0) errors.push('CASE 를 최소 1개 선택하세요 (정상 CASE 권장).')
  if (form.task_type === 'edit' && !form.base_revision_id) errors.push('단건 수정은 기준 revision 이 필요합니다. 먼저 신규 생성을 실행하세요.')
  if (form.task_type === 'clone_reference' && form.reference_ids.length === 0) errors.push('참조 복제는 참고 화면을 최소 1개 선택하세요.')
  return errors
}

export interface BuildRequestOptions {
  comment_ids?: string[]
}

/** 폼 → 요청. 선택 필드는 값이 있을 때만 넣는다 (exactOptionalPropertyTypes). */
export function buildRequest(screenId: string, form: GenerationFormState, opts: BuildRequestOptions = {}): SliceGenerationRequest {
  const req: SliceGenerationRequest = {
    screen_id: screenId,
    task_type: form.task_type,
    purpose: form.purpose.trim(),
    requirement_ids: [...form.requirement_ids],
    criterion_ids: [...form.criterion_ids],
    reference_ids: [...form.reference_ids],
    cases: ALL_CASES.filter((c) => form.cases.includes(c)),
    keep_conditions: splitLines(form.keep_conditions_text),
    roles: splitRoles(form.roles_text),
    device: form.device,
  }
  const scope = form.scope.trim()
  if (scope) req.scope = scope
  if (form.task_type === 'edit' && form.base_revision_id) req.base_revision_id = form.base_revision_id
  if (opts.comment_ids && opts.comment_ids.length > 0) req.comment_ids = [...opts.comment_ids]
  const override = form.use_prompt_override ? form.prompt_override.trim() : ''
  if (override) req.prompt_override = override
  return req
}

/**
 * 검토 화면의 "단건 수정 실행" 요청 — 기준 revision·코멘트·프롬프트를 고정한다.
 * 목적은 프롬프트 첫 줄을 요약으로 쓴다 (서버는 prompt_override 가 있으면 자동 조립 대신 그것을 쓴다).
 */
export function buildEditRequest(input: {
  screen_id: string
  base_revision_id: string
  comment_ids: string[]
  prompt: string
  device: Device
  cases: SliceCase[]
  roles?: string[]
  requirement_ids?: string[]
  criterion_ids?: string[]
}): SliceGenerationRequest {
  const prompt = input.prompt.trim()
  const firstLine = prompt.split(/\r?\n/).find((l) => l.trim().length > 0)?.trim() ?? ''
  const req: SliceGenerationRequest = {
    screen_id: input.screen_id,
    task_type: 'edit',
    purpose: firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine,
    requirement_ids: [...(input.requirement_ids ?? [])],
    criterion_ids: [...(input.criterion_ids ?? [])],
    reference_ids: [],
    cases: input.cases.length > 0 ? ALL_CASES.filter((c) => input.cases.includes(c)) : ['normal'],
    keep_conditions: [],
    roles: [...(input.roles ?? [])],
    device: input.device,
    base_revision_id: input.base_revision_id,
    comment_ids: [...input.comment_ids],
  }
  if (prompt) req.prompt_override = prompt
  return req
}
