/**
 * 내보내기 (계약 §8) — 승인된 revision 을 `exports/<project_slug>/<screen_external_id>/v1.0/` 에 기록한다.
 * index.html(오프라인 목업+설명), spec.json, trace.json(요구사항·수용조건↔요소·동작·CASE), validation.json, comments.json, manifest.json.
 * 각 파일의 sha256 을 manifest.files 와 승인 기록(files)에 남긴다.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { ScreenSpec, ValidationResult } from '@con-ai/schemas'
import { sha256, type ArtifactDocument, type CommentDocument, type ExportedFile, type ProjectDocument, type RequirementDocument, type ScreenDocument, type ScreenRevisionDocument } from '@con-ai/worker-generation'

export const EXPORT_VERSION = '1.0' as const
export const ALLOWED_DESIGN_TOKENS = ['color', 'font', 'spacing'] as const

export interface ValidationSummary { pass: number; fail: number; error: number; not_run: number }

export function summarizeValidation(results: readonly ValidationResult[]): ValidationSummary {
  const summary: ValidationSummary = { pass: 0, fail: 0, error: 0, not_run: 0 }
  for (const r of results) summary[r.status] += 1
  return summary
}

export interface TraceElementLink { section_id: string; element_id: string; label: string; display_no: string | undefined }
export interface TraceActionLink { action_id: string; type: string; label: string | undefined; target_state_id: string | undefined }
export interface TraceCaseLink { state_id: string; case_kind: string | undefined; via_action_id: string }
export interface TraceCriterion { id: string; text: string | undefined; kind: 'ui' | 'non_ui' | undefined; elements: TraceElementLink[]; actions: TraceActionLink[]; cases: TraceCaseLink[] }
export interface TraceRequirement { id: string; title: string | undefined; criteria: TraceCriterion[] }
export interface TraceDocument {
  screen_external_id: string
  baseline_id: string
  spec_hash: string
  requirements: TraceRequirement[]
  /** 명세 requirements 에는 있지만 어떤 요소·동작도 가리키지 않는 수용조건. */
  unlinked_criterion_ids: string[]
}

/** spec 의 trace 필드에서 추적 문서를 만든다 (설계 §7: 요구사항 → 수용조건 → 요소·동작·CASE). */
export function buildTrace(spec: ScreenSpec, specHash: string, requirements: readonly RequirementDocument[]): TraceDocument {
  const reqByExternal = new Map(requirements.map((r) => [r.external_id, r] as const))
  const stateById = new Map(spec.states.map((s) => [s.id, s] as const))
  const out: TraceRequirement[] = []
  const unlinked: string[] = []
  for (const req of spec.requirements) {
    const reqDoc = reqByExternal.get(req.id)
    const criteria: TraceCriterion[] = []
    for (const criterionId of req.criterion_ids) {
      const critDoc = reqDoc?.criteria.find((c) => c.id === criterionId)
      const elements: TraceElementLink[] = []
      for (const section of spec.sections) {
        for (const el of section.elements) {
          if (el.trace?.includes(criterionId)) elements.push({ section_id: section.id, element_id: el.id, label: el.label, display_no: joinDisplayNo(section.display_no, el.display_no) })
        }
      }
      const actions: TraceActionLink[] = []
      const cases: TraceCaseLink[] = []
      for (const action of spec.actions) {
        if (!action.trace?.includes(criterionId)) continue
        actions.push({ action_id: action.id, type: action.type, label: action.label, target_state_id: action.target_state_id })
        if (action.type === 'set-state' && action.target_state_id !== undefined) {
          const state = stateById.get(action.target_state_id)
          cases.push({ state_id: action.target_state_id, case_kind: state?.case_kind, via_action_id: action.id })
        }
      }
      if (elements.length === 0 && actions.length === 0) unlinked.push(criterionId)
      criteria.push({ id: criterionId, text: critDoc?.text, kind: critDoc?.kind, elements, actions, cases })
    }
    out.push({ id: req.id, title: reqDoc?.title, criteria })
  }
  return { screen_external_id: spec.screen_id, baseline_id: spec.baseline_id, spec_hash: specHash, requirements: out, unlinked_criterion_ids: unlinked }
}

function joinDisplayNo(section: string | undefined, element: string | undefined): string | undefined {
  if (section === undefined && element === undefined) return undefined
  return [section, element].filter((v) => v !== undefined).join('-')
}

export interface ExportInput {
  export_dir: string
  project: ProjectDocument
  screen: ScreenDocument
  revision: ScreenRevisionDocument
  artifact: ArtifactDocument
  html: string
  validation_results: readonly ValidationResult[]
  comments: readonly CommentDocument[]
  requirements: readonly RequirementDocument[]
  approved_by: string
  approved_at: string
  adapter: string
  model: string
}

export interface ExportManifest {
  project: { id: string; name: string; slug: string }
  screen_external_id: string
  version: typeof EXPORT_VERSION
  artifact_hash: string
  spec_hash: string
  approved_by: string
  approved_at: string
  adapter: string
  model: string
  validation_summary: ValidationSummary
  design_handoff: {
    screen_revision_id: string
    design_input_spec_hash: string
    locked_elements: string[]
    locked_actions: string[]
    allowed_tokens: string[]
  }
  files: ExportedFile[]
}

export interface ExportResult {
  /** export_dir 기준 상대 경로 (`<slug>/<screen>/v1.0`). */
  export_path: string
  /** 절대 경로. */
  absolute_path: string
  manifest: ExportManifest
  /** manifest.json 을 포함한 전체 파일 목록. */
  files: ExportedFile[]
}

/** 승인 산출물을 폴더에 기록한다. 파일은 모두 UTF-8 이며 HTML 은 저장된 산출물 본문 그대로다 (hash 가 같아야 한다). */
export function exportApprovedRevision(input: ExportInput): ExportResult {
  if (sha256(input.html) !== input.artifact.content_hash) {
    throw new Error(`내보낼 HTML 의 hash 가 산출물 hash 와 다르다 (artifact ${input.artifact.id})`)
  }
  const exportPath = join(input.project.slug, input.screen.external_id, `v${EXPORT_VERSION}`)
  const absolute = resolve(input.export_dir, exportPath)
  mkdirSync(absolute, { recursive: true })

  const trace = buildTrace(input.revision.spec, input.revision.spec_hash, input.requirements)
  const written: ExportedFile[] = []
  const write = (name: string, content: string): void => {
    writeFileSync(join(absolute, name), content, 'utf8')
    written.push({ path: name, sha256: sha256(content) })
  }
  write('index.html', input.html)
  write('spec.json', pretty(input.revision.spec))
  write('trace.json', pretty(trace))
  write('validation.json', pretty({ artifact_hash: input.artifact.content_hash, summary: summarizeValidation(input.validation_results), results: input.validation_results }))
  write('comments.json', pretty({ revision_id: input.revision.id, comments: input.comments }))

  const manifest: ExportManifest = {
    project: { id: input.project.id, name: input.project.name, slug: input.project.slug },
    screen_external_id: input.screen.external_id,
    version: EXPORT_VERSION,
    artifact_hash: input.artifact.content_hash,
    spec_hash: input.revision.spec_hash,
    approved_by: input.approved_by,
    approved_at: input.approved_at,
    adapter: input.adapter,
    model: input.model,
    validation_summary: summarizeValidation(input.validation_results),
    design_handoff: {
      screen_revision_id: input.revision.id,
      design_input_spec_hash: input.revision.spec_hash,
      locked_elements: [...input.revision.spec.locked_elements],
      locked_actions: [...input.revision.spec.locked_actions],
      allowed_tokens: [...ALLOWED_DESIGN_TOKENS],
    },
    files: [...written],
  }
  write('manifest.json', pretty(manifest))
  return { export_path: exportPath, absolute_path: absolute, manifest, files: written }
}

function pretty(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}
