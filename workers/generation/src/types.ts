/** 세로 조각 계약 §6 — 파이프라인 의존성. 저장소(Store)는 apps/api 가 구현한다. */
import type { ModelAdapter } from '@con-ai/model-adapter'
import type { RenderInput, RenderOutput } from '@con-ai/renderer'
import type { ValidationResult } from '@con-ai/schemas'

export type DocumentKind =
  | 'project' | 'requirement' | 'ia_node' | 'screen' | 'screen_revision' | 'job' | 'artifact'
  | 'validation_result' | 'comment' | 'approval' | 'reference' | 'prompt_template'

export interface StoredDocument<T = unknown> { kind: DocumentKind; id: string; revision: number; data: T; created_at: string; updated_at: string }

export interface Store {
  get<T = unknown>(kind: DocumentKind, id: string): StoredDocument<T> | undefined
  list<T = unknown>(kind: DocumentKind, filter?: (doc: StoredDocument<T>) => boolean): StoredDocument<T>[]
  /** revision 이 현재와 다르면 거부한다(오래된 저장 차단). 새 문서는 expectedRevision 0. */
  put<T = unknown>(kind: DocumentKind, id: string, data: T, expectedRevision: number): StoredDocument<T>
  getHtml(artifactId: string): string | undefined
  putHtml(artifactId: string, html: string): void
}

export interface PipelineDeps {
  store: Store
  adapter: ModelAdapter
  render: (input: RenderInput) => RenderOutput
  validate: (input: { spec: unknown; html: string; required_cases: string[]; artifact_hash: string }) => Promise<ValidationResult[]>
  now: () => string
  newId: () => string
}
