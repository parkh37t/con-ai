/**
 * 저장 문서 형태 (계약 §1). apps/api 의 Store 와 workers/generation 파이프라인이 같은 형태를 쓴다.
 * schemas 타입이 있는 것은 그 이름을 그대로 쓰고, 계약에 없는 필드는 주석으로 표시한다.
 */
import type { SliceGenerationRequest } from '@con-ai/prompt-templates'
import type { Approval, Artifact, ChangeSummary, GenerationJob, IANode, JobStage, PromptTemplate, ScreenSpec, ValidationResult } from '@con-ai/schemas'

export interface ProjectDocument {
  id: string
  name: string
  /** 계약 외 추가: 내보내기 폴더 이름(`exports/<slug>/`)과 baseline_id 에 쓰는 영문 슬러그. */
  slug: string
  org: string
  description: string
  profile_id: string
  /** 계약 외 추가: 이 프로젝트의 고정 기준 버전 ID (`baseline-<slug>-1`). */
  baseline_id: string
  /** 목업의 브랜드 테마 id (renderer theme.ts). 없으면 기본 테마. */
  theme_id?: string
  /** 목업 GNB 에 쓸 포털 이름. 없으면 shell 접두어에서 만든다. */
  portal_name?: string
  created_at: string
}

export interface RequirementCriterion { id: string; text: string; kind: 'ui' | 'non_ui' }
export interface RequirementDocument {
  id: string
  project_id: string
  external_id: string
  title: string
  body: string
  criteria: RequirementCriterion[]
}

export type IANodeDocument = IANode

export type ScreenStatus = 'draft' | 'review' | 'approved'
export interface ScreenAliasEntry { external_id: string; valid_from: string; valid_to?: string; reason?: string }
export interface ScreenDocument {
  id: string
  project_id: string
  external_id: string
  title: string
  shell: string
  device: 'desktop' | 'mobile'
  status: ScreenStatus
  current_revision_id?: string | undefined
  version?: string | undefined
  aliases: ScreenAliasEntry[]
}

export interface ElementIndexEntry { element_id: string; section_id: string; display_no: string }
export interface ScreenRevisionDocument {
  id: string
  screen_id: string
  revision_no: number
  spec: ScreenSpec
  spec_hash: string
  artifact_id: string
  job_id: string
  based_on_revision_id?: string | undefined
  change_summary?: ChangeSummary | undefined
  /** 계약 외 추가: 렌더러가 만든 요소 번호 색인 (GET /api/revisions/:id 의 element_index). */
  element_index: ElementIndexEntry[]
  created_at: string
}

export interface JobResult { revision_id: string; artifact_id: string }
export interface JobDocument extends GenerationJob {
  request: SliceGenerationRequest
  adapter: 'anthropic' | 'fixture'
  model: string
  prompt_text: string
  context_summary: string[]
  /** 진행 단계. schemas 의 current_stage 와 같은 값을 두 이름으로 기록한다 (계약 §7 은 stage, schemas 는 current_stage). */
  stage?: JobStage | undefined
  result?: JobResult | undefined
}

export type ArtifactDocument = Artifact
export type ValidationResultDocument = ValidationResult

export type CommentRole = 'planner' | 'designer' | 'publisher' | 'developer' | 'client'
export type CommentStatus = 'open' | 'resolved' | 'wont_fix'
export interface CommentDocument {
  id: string
  screen_id: string
  revision_id: string
  artifact_hash: string
  target: 'screen' | 'description'
  element_id?: string | undefined
  section_id?: string | undefined
  case_id?: string | undefined
  display_no?: string | undefined
  author: string
  role: CommentRole
  text: string
  blocking: boolean
  status: CommentStatus
  resolved_by_revision_id?: string | undefined
  created_at: string
}

export interface ExportedFile { path: string; sha256: string }
export interface ApprovalDocument extends Approval {
  version: '1.0'
  export_path: string
  files: ExportedFile[]
}

export type ReferenceCategory = 'list' | 'detail' | 'popup' | 'form' | 'main'
export interface ReferenceDocument {
  id: string
  project_id?: string | undefined
  title: string
  category: ReferenceCategory
  description: string
  spec: ScreenSpec
  tags: string[]
  source: string
}

export interface PromptTemplateDocument extends PromptTemplate {
  /** 템플릿 본문 (body_hash = sha256(body)). */
  body: string
}

/** 더미데이터 문서 — id 는 fixture_id (ScreenSpec.states[].fixture_id 와 1:1). 계약 §1 에 없던 kind 'dummy_data'. */
export interface DummyDataDocument {
  id: string
  project_id: string
  screen_external_id: string
  case_kind: 'normal' | 'empty' | 'error' | 'permission' | 'processing'
  rows: Record<string, unknown>[]
  note?: string | undefined
}
