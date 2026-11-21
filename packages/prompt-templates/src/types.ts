/** 세로 조각 계약 §2 — 생성 요청·문맥·조립 프롬프트. docs/plan/세로조각_계약.md 와 함께 바꾼다. */
export type SliceTaskType = 'create' | 'edit' | 'clone_reference'
export type SliceCase = 'normal' | 'empty' | 'error' | 'permission' | 'processing'

export interface SliceGenerationRequest {
  screen_id: string
  task_type: SliceTaskType
  purpose: string
  scope?: string
  requirement_ids: string[]
  criterion_ids: string[]
  reference_ids: string[]
  cases: SliceCase[]
  keep_conditions: string[]
  roles: string[]
  device: 'desktop' | 'mobile'
  base_revision_id?: string
  comment_ids?: string[]
  prompt_override?: string
}

export interface ContextRequirement {
  external_id: string
  title: string
  body: string
  criteria: Array<{ id: string; text: string; kind: 'ui' | 'non_ui' }>
}
export interface ContextReference { id: string; title: string; category: string; spec: unknown }
export interface ContextComment {
  id: string
  role: string
  author: string
  text: string
  element_id?: string
  case_id?: string
  target: string
}
export interface GenerationContext {
  project: { name: string; org: string; profile_id: string }
  screen: { external_id: string; title: string; shell: string; device: string }
  requirements: ContextRequirement[]
  references: ContextReference[]
  base_spec?: unknown
  comments?: ContextComment[]
  profile_rules: string[]
  baseline_id: string
}
export interface AssembledPrompt { system: string; user: string; template_version: string; context_summary: string[] }
