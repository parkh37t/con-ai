/**
 * 웹이 보는 API 응답 타입 — 세로 조각 계약 §1(레코드 필드)·§2(생성 요청)·§7(API) 기준.
 * 다른 패키지를 import 하지 않고 계약 문서의 필드를 그대로 옮긴다. 계약이 바뀌면 이 파일과 문서를 같이 고친다.
 */

// ---------------------------------------------------------------- 메타 (§7 GET /api/meta)
export type AdapterKind = 'anthropic' | 'fixture'
/** 인증 방식 — 구버전 API 는 이 필드가 없을 수 있다. */
export type AuthKind = 'api_key' | 'token' | 'profile' | 'none'
export interface Meta {
  adapter: AdapterKind
  model: string
  version: string
  playwright: boolean
  auth?: AuthKind
}

// ---------------------------------------------------------------- 프로젝트·요구사항·IA·화면 (§1)
export interface Project {
  id: string
  name: string
  org: string
  description: string
  profile_id: string
  created_at: string
}

export type CriterionKind = 'ui' | 'non_ui'
export interface Criterion {
  id: string
  text: string
  kind: CriterionKind
}
export interface Requirement {
  id: string
  project_id: string
  external_id: string
  title: string
  body: string
  criteria: Criterion[]
}

export type IANodeKind = 'category' | 'screen'
export interface IANode {
  id: string
  project_id: string
  parent_id: string | null
  name: string
  order: number
  portal: string
  kind: IANodeKind
  screen_plan_id?: string
}

export type ScreenStatus = 'draft' | 'review' | 'approved'
export type Device = 'desktop' | 'mobile'

/** 프로젝트 상세의 화면 요약 (§7 GET /api/projects/:id). shell·device 는 계약의 요약 목록에 없어 선택으로 둔다. */
export interface ScreenSummary {
  id: string
  external_id: string
  title: string
  status: ScreenStatus
  version?: string
  current_revision_id?: string
  revision_count: number
  open_comments: number
  shell?: string
  device?: Device
}

export interface Screen {
  id: string
  project_id: string
  external_id: string
  title: string
  shell: string
  device: Device
  status: ScreenStatus
  current_revision_id?: string
  version?: string
  aliases: unknown[]
}

export interface ProjectDetail {
  project: Project
  requirements: Requirement[]
  ia_nodes: IANode[]
  screens: ScreenSummary[]
}

// ---------------------------------------------------------------- ScreenSpec (표시에 필요한 부분만)
export interface SpecElementLike {
  id: string
  type: string
  label: string
  display_no?: string
  required?: boolean
  locked?: boolean
}
export interface SpecSectionLike {
  id: string
  title: string
  display_no?: string
  elements: SpecElementLike[]
}
export type CaseKind = 'normal' | 'empty' | 'error' | 'permission' | 'processing'
export interface SpecStateLike {
  id: string
  fixture_id?: string
  expected?: string
  case_kind?: CaseKind
  role?: string
}
export interface ScreenSpecLike {
  schema_version?: string
  screen_id?: string
  baseline_id?: string
  purpose?: string
  shell?: string
  device?: string
  roles?: string[]
  requirements?: Array<{ id: string; criterion_ids: string[] }>
  sections?: SpecSectionLike[]
  actions?: Array<{ id: string; type: string; label?: string }>
  states?: SpecStateLike[]
  messages?: Array<{ id: string; kind: string; text: string }>
  locked_elements?: string[]
  locked_actions?: string[]
  unresolved?: Array<{ kind: string; text: string }>
}

// ---------------------------------------------------------------- 레퍼런스 포트폴리오 (§1 reference)
export type ReferenceCategory = 'list' | 'detail' | 'popup' | 'form'
export interface Reference {
  id: string
  project_id?: string
  title: string
  category: ReferenceCategory
  description: string
  spec: ScreenSpecLike
  tags: string[]
  source: string
}

// ---------------------------------------------------------------- 생성 요청 (§2, prompt-templates types.ts 와 동일)
export type SliceTaskType = 'create' | 'edit' | 'clone_reference'
export type SliceCase = CaseKind
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
  device: Device
  base_revision_id?: string
  comment_ids?: string[]
  prompt_override?: string
}
export interface AssembledPrompt {
  system: string
  user: string
  template_version: string
  context_summary: string[]
}
export interface PromptPreviewResponse {
  prompt: AssembledPrompt
  context_summary: string[]
}

// ---------------------------------------------------------------- 작업 (§1 job, schemas GenerationJob)
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
export type JobStage = 'context_build' | 'spec_generate' | 'schema_check' | 'render' | 'validate' | 'persist'
export interface JobFailure {
  code: string
  message: string
  stage?: JobStage
  details?: string[]
}
export interface Job {
  id: string
  status: JobStatus
  /** schemas GenerationJob.current_stage. 일부 응답은 `stage` 로 줄 수 있어 둘 다 읽는다. */
  current_stage?: JobStage
  stage?: JobStage
  failure?: JobFailure
  result?: { revision_id: string; artifact_id: string }
  adapter?: AdapterKind
  model?: string
  job_type?: string
  screen_plan_id?: string
  request?: SliceGenerationRequest
  context_summary?: string[]
  prompt_text?: string
  attempt?: number
  max_attempts?: number
  created_at?: string
  started_at?: string
  finished_at?: string
}

// ---------------------------------------------------------------- 화면 상세·revision (§7)
export type ArtifactStatus = 'draft' | 'validation_pending' | 'review_ready' | 'approved' | 'stale'
export type ValidationStatus = 'pass' | 'fail' | 'error' | 'not_run'
export interface ValidationSummary {
  pass: number
  fail: number
  error: number
  not_run: number
}
export interface RevisionListItem {
  id: string
  revision_no: number
  artifact_id: string
  artifact_hash: string
  artifact_status: ArtifactStatus
  validation_summary: ValidationSummary
  open_comments: number
  created_at: string
}
export interface ScreenDetail {
  screen: Screen
  revisions: RevisionListItem[]
}

export interface ChangeSummaryLike {
  summary?: string
  changed_elements?: string[]
  changed_actions?: string[]
  notes?: string[]
  [key: string]: unknown
}
export interface ScreenRevision {
  id: string
  screen_id: string
  revision_no: number
  spec_hash: string
  artifact_id: string
  job_id: string
  based_on_revision_id?: string
  change_summary?: ChangeSummaryLike
  created_at: string
}
export interface Artifact {
  id: string
  kind: string
  content_hash: string
  status: ArtifactStatus
  generation_job_id?: string
  renderer_version?: string
  stale_reason?: string
  created_at?: string
}
export interface ValidationResult {
  id: string
  validation_run_id?: string
  artifact_hash: string
  check_id: string
  stage: string
  status: ValidationStatus
  required: boolean
  message?: string
  evidence: string[]
  checker_version?: string
  duration_ms?: number
}

export type CommentTarget = 'screen' | 'description'
export type CommentRole = 'planner' | 'designer' | 'publisher' | 'developer' | 'client'
export type CommentStatus = 'open' | 'resolved' | 'wont_fix'
export interface Comment {
  id: string
  screen_id: string
  revision_id: string
  artifact_hash: string
  target: CommentTarget
  element_id?: string
  section_id?: string
  case_id?: string
  display_no?: string
  author: string
  role: CommentRole
  text: string
  blocking: boolean
  status: CommentStatus
  resolved_by_revision_id?: string
  created_at: string
  /** documents 테이블의 revision(낙관적 잠금). PATCH 에 다시 보낸다. */
  revision?: number
}
export interface CommentInput {
  target: CommentTarget
  element_id?: string
  section_id?: string
  case_id?: string
  display_no?: string
  author: string
  role: CommentRole
  text: string
  blocking: boolean
}
export interface ElementIndexEntry {
  element_id: string
  section_id: string
  display_no: string
}
export interface RevisionDetail {
  revision: ScreenRevision
  spec: ScreenSpecLike
  artifact: Artifact
  validation_results: ValidationResult[]
  comments: Comment[]
  element_index: ElementIndexEntry[]
}

export interface RevisionPromptDraft {
  prompt: string
  rationale: string
  adapter: AdapterKind
}

// ---------------------------------------------------------------- 승인·내보내기 (§7, §8)
export interface ApprovalRecord {
  id: string
  artifact_id: string
  artifact_hash: string
  approved_by: string
  approved_at: string
  version?: string
  export_path?: string
  [key: string]: unknown
}
export interface ExportFile {
  path: string
  sha256: string
}
export interface DesignHandoff {
  screen_revision_id: string
  design_input_spec_hash: string
  locked_elements: string[]
  locked_actions: string[]
  allowed_tokens: string[]
}
export interface ExportManifest {
  project?: string
  screen_external_id?: string
  version?: string
  artifact_hash?: string
  spec_hash?: string
  approved_by?: string
  approved_at?: string
  adapter?: string
  model?: string
  validation_summary?: ValidationSummary
  design_handoff?: DesignHandoff
  files?: ExportFile[]
}
export interface ApprovalResponse {
  approval: ApprovalRecord
  version: string
  export_path: string
  files: ExportFile[]
  /** API 가 manifest 를 같이 주면 그대로 쓰고, 없으면 `/exports/.../manifest.json` 을 읽는다. */
  manifest?: ExportManifest
}

/** 거부 이유 — domain RuleReason 형태 또는 문자열. */
export type ReasonLike = string | { code?: string; message: string }

// ---------------------------------------------------------------- AS-IS 분석 (§12)
export type AsisStatus = 'queued' | 'running' | 'succeeded' | 'failed'
export type AsisFailureCode = 'navigation' | 'browser' | 'draft' | 'internal'
export interface AsisFailure {
  /** 계약의 네 코드 외 값이 와도 그대로 보여준다. */
  code: AsisFailureCode | (string & {})
  message: string
}

export type PainPointSeverity = 'high' | 'medium' | 'low'
export type PainPointStatus = 'proposed' | 'adopted' | 'rejected'
export interface PainPoint {
  id: string
  area: string
  severity: PainPointSeverity
  description: string
  evidence: string
  suggestion: string
  status: PainPointStatus
}

export interface AsisHeading {
  level: number
  text: string
}
export interface AsisNavLink {
  text: string
  href: string
}
export interface AsisFormField {
  type: string
  label?: string
  name?: string
}
export interface AsisForm {
  name?: string
  fields: AsisFormField[]
}
export interface AsisCounts {
  links: number
  images: number
  images_without_alt: number
  tables: number
  fields_without_label: number
  iframes: number
}
export interface AsisStructure {
  title: string
  description?: string
  lang?: string
  headings: AsisHeading[]
  nav_links: AsisNavLink[]
  forms: AsisForm[]
  buttons: string[]
  counts: AsisCounts
}

/** GET /api/asis-analyses/:id — kind `asis_analysis` 전체 문서. */
export interface AsisAnalysis {
  id: string
  project_id: string
  url: string
  note?: string
  status: AsisStatus
  failure?: AsisFailure
  adapter: AdapterKind
  model: string
  created_at: string
  finished_at?: string
  structure?: AsisStructure
  screenshots?: { desktop: string; mobile: string }
  summary?: string
  pain_points: PainPoint[]
  /** documents 테이블의 revision(낙관적 잠금). 페인포인트 PATCH 에 다시 보낸다. */
  revision?: number
}

/** GET /api/projects/:id/asis-analyses — 목록 요약(id, url, status, 페인포인트 수, created_at). */
export interface AsisAnalysisSummary {
  id: string
  url: string
  status: AsisStatus
  created_at: string
  note?: string
  finished_at?: string
  failure?: AsisFailure
  /** "페인포인트 수" 의 필드명이 계약에 고정되지 않아 어느 쪽이 와도 읽는다 (asis.ts painPointCountOf). */
  pain_point_count?: number
  pain_points?: number | unknown[]
}
