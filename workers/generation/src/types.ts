/** 세로 조각 계약 §6 — 파이프라인 의존성. 저장소(Store)는 apps/api 가 구현한다. */
import type { ModelAdapter } from '@con-ai/model-adapter'
import type { AssembledPrompt, GenerationContext, SliceGenerationRequest } from '@con-ai/prompt-templates'
import type { RenderInput, RenderOutput, RenderProfile } from '@con-ai/renderer'
import type { ValidationResult } from '@con-ai/schemas'

/**
 * 문서 종류 (계약 §1). `dummy_data` 는 계약 표에 없던 종류로, 더미데이터(fixture_id → 행 목록)를 reference 와 분리해 두기 위해 추가했다.
 * 문서 id 는 fixture_id(예: `SAMPLE-quote-list-normal`) 그대로다 (documents.ts DummyDataDocument).
 * `asis_analysis` 는 AS-IS 분석 문서 (계약 §12; 문서 타입은 apps/api/src/asis-runner.ts AsisAnalysisDocument).
 */
export type DocumentKind =
  | 'project' | 'requirement' | 'ia_node' | 'screen' | 'screen_revision' | 'job' | 'artifact'
  | 'validation_result' | 'comment' | 'approval' | 'reference' | 'prompt_template' | 'dummy_data'
  | 'asis_analysis'

export interface StoredDocument<T = unknown> { kind: DocumentKind; id: string; revision: number; data: T; created_at: string; updated_at: string }

export interface Store {
  get<T = unknown>(kind: DocumentKind, id: string): StoredDocument<T> | undefined
  list<T = unknown>(kind: DocumentKind, filter?: (doc: StoredDocument<T>) => boolean): StoredDocument<T>[]
  /** revision 이 현재와 다르면 거부한다(오래된 저장 차단; 오류 code 'stale_revision'). 새 문서는 expectedRevision 0. */
  put<T = unknown>(kind: DocumentKind, id: string, data: T, expectedRevision: number): StoredDocument<T>
  /** 문서 삭제 (재검증 시 이전 검증 결과 정리용). 없는 문서는 무시한다. 계약에 없던 추가 메서드. */
  delete(kind: DocumentKind, id: string): void
  getHtml(artifactId: string): string | undefined
  putHtml(artifactId: string, html: string): void
}

/** 프롬프트 조립 함수 묶음 — 기본값은 @con-ai/prompt-templates 의 실제 구현이며 테스트에서 가짜를 주입한다. */
export interface PromptAssembler {
  assemblePrompt: (req: SliceGenerationRequest, ctx: GenerationContext) => AssembledPrompt
  assembleRevisionPrompt: (ctx: GenerationContext, instruction: string) => AssembledPrompt
}

export interface PipelineDeps {
  store: Store
  adapter: ModelAdapter
  render: (input: RenderInput) => RenderOutput
  validate: (input: { spec: unknown; html: string; required_cases: string[]; artifact_hash: string }) => Promise<ValidationResult[]>
  now: () => string
  newId: () => string
  /** 승인에 필수인 check_id 목록 (validators REQUIRED_CHECKS). 결과가 없으면 not_run 으로 보고 review_ready 로 올리지 않는다. 기본 []. */
  required_check_ids?: readonly string[] | undefined
  /** 렌더 프로파일. 기본 renderer 의 S2B_LEARNED_PROFILE. */
  profile?: RenderProfile | undefined
  /** 프롬프트 조립기. 기본 @con-ai/prompt-templates. */
  assembler?: PromptAssembler | undefined
}
