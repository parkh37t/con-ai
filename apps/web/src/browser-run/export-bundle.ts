/**
 * 브라우저 모드 내보내기 — 서버 폴더(`exports/…`)를 쓸 수 없으므로 같은 6개 파일을 브라우저에서 만들어 내려받는다.
 * 파일 구성은 계약 §8·apps/api/src/export.ts 와 같다: index.html, spec.json, trace.json, validation.json, comments.json, manifest.json.
 *
 * 승인 여부는 manifest 에 그대로 적는다. `mode` 는 언제나 `'browser'` 이며(서버 폴더에 쓰지 않았다는 뜻),
 * 승인 전이면 `approved:false`·`version:null`, 승인 뒤면 `approved:true`·`version:'1.0'`·승인자·시각을 적는다.
 */
import type { Comment, Criterion, Requirement, ValidationResult, ValidationSummary } from '../types.js'
import { sha256Hex } from './hash.js'
import type { BrowserRevisionRecord } from './store.js'

export const BROWSER_EXPORT_NOTE =
  '브라우저 모드에서 내려받은 산출물입니다. 아직 승인(v1.0) 기록이 아닙니다 — 완료 처리를 먼저 해야 승인 산출물이 됩니다.'

export const BROWSER_EXPORT_APPROVED_NOTE =
  '브라우저 모드에서 만든 승인(v1.0) 산출물입니다. 서버 폴더(`exports/…`)에 쓰지 않고 이 브라우저에서 만들어 내려받습니다 — 팀이 함께 쓰는 이관 폴더는 서버 실행에서 만듭니다.'

/** `<adapter>:<model>` 표기를 나눈다. 모르면 지어내지 않고 그대로 둔다. */
export function splitGeneratedBy(generatedBy: string): { adapter: string; model: string } {
  const i = generatedBy.indexOf(':')
  if (i < 0) return { adapter: generatedBy, model: generatedBy }
  return { adapter: generatedBy.slice(0, i), model: generatedBy.slice(i + 1) }
}

/** 승인 기록 — 있으면 manifest 가 승인 산출물이 된다. */
export interface BundleApproval {
  version: string
  approved_by: string
  approved_at: string
}

export const ALLOWED_DESIGN_TOKENS = ['color', 'font', 'spacing'] as const

export interface BundleFile {
  path: string
  mime: string
  text: string
  sha256: string
}

function pretty(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function summarize(results: readonly Pick<ValidationResult, 'status'>[]): ValidationSummary {
  const summary: ValidationSummary = { pass: 0, fail: 0, error: 0, not_run: 0 }
  for (const r of results) {
    if (r.status === 'pass' || r.status === 'fail' || r.status === 'error' || r.status === 'not_run') summary[r.status] += 1
  }
  return summary
}

interface SpecLike {
  screen_id?: string
  baseline_id?: string
  requirements?: Array<{ id: string; criterion_ids: string[] }>
  sections?: Array<{ id: string; display_no?: string; elements?: Array<{ id: string; label: string; display_no?: string; trace?: string[] }> }>
  actions?: Array<{ id: string; type: string; label?: string; target_state_id?: string; trace?: string[] }>
  states?: Array<{ id: string; case_kind?: string }>
  locked_elements?: string[]
  locked_actions?: string[]
}

/** 요구사항 → 수용조건 → 요소·동작·CASE (apps/api/src/export.ts buildTrace 와 같은 규칙). */
export function buildTrace(spec: SpecLike, specHash: string, requirements: readonly Requirement[]): Record<string, unknown> {
  const reqByExternal = new Map(requirements.map((r) => [r.external_id, r] as const))
  const stateById = new Map((spec.states ?? []).map((s) => [s.id, s] as const))
  const unlinked: string[] = []
  const out = (spec.requirements ?? []).map((req) => {
    const reqDoc = reqByExternal.get(req.id)
    const criteria = req.criterion_ids.map((criterionId) => {
      const critDoc: Criterion | undefined = reqDoc?.criteria.find((c) => c.id === criterionId)
      const elements: Array<Record<string, unknown>> = []
      for (const section of spec.sections ?? []) {
        for (const el of section.elements ?? []) {
          if (el.trace?.includes(criterionId)) {
            elements.push({ section_id: section.id, element_id: el.id, label: el.label, display_no: [section.display_no, el.display_no].filter((v) => v !== undefined).join('-') || undefined })
          }
        }
      }
      const actions: Array<Record<string, unknown>> = []
      const cases: Array<Record<string, unknown>> = []
      for (const action of spec.actions ?? []) {
        if (!action.trace?.includes(criterionId)) continue
        actions.push({ action_id: action.id, type: action.type, label: action.label, target_state_id: action.target_state_id })
        if (action.type === 'set-state' && action.target_state_id !== undefined) {
          cases.push({ state_id: action.target_state_id, case_kind: stateById.get(action.target_state_id)?.case_kind, via_action_id: action.id })
        }
      }
      if (elements.length === 0 && actions.length === 0) unlinked.push(criterionId)
      return { id: criterionId, text: critDoc?.text, kind: critDoc?.kind, elements, actions, cases }
    })
    return { id: req.id, title: reqDoc?.title, criteria }
  })
  return { screen_external_id: spec.screen_id, baseline_id: spec.baseline_id, spec_hash: specHash, requirements: out, unlinked_criterion_ids: unlinked }
}

export interface BundleInput {
  record: BrowserRevisionRecord
  project: { id: string; name: string; slug?: string | undefined }
  requirements: readonly Requirement[]
  comments: readonly Comment[]
  generated_at: string
  /** 승인 뒤에 만들면 그 기록. 없으면 승인 전 산출물이다. */
  approval?: BundleApproval | undefined
}

/** 6개 파일을 만든다 (각 파일의 sha256 포함). manifest 는 파일 목록을 담아 마지막에 만든다. */
export async function buildExportBundle(input: BundleInput): Promise<BundleFile[]> {
  const { record } = input
  const spec = record.spec as SpecLike
  const files: BundleFile[] = []
  const add = async (path: string, mime: string, text: string): Promise<void> => {
    files.push({ path, mime, text, sha256: await sha256Hex(text) })
  }
  await add('index.html', 'text/html;charset=utf-8', record.html)
  await add('spec.json', 'application/json', pretty(record.spec))
  await add('trace.json', 'application/json', pretty(buildTrace(spec, record.revision.spec_hash, input.requirements)))
  await add('validation.json', 'application/json', pretty({ artifact_hash: record.artifact.content_hash, summary: summarize(record.validation_results), results: record.validation_results }))
  await add('comments.json', 'application/json', pretty({ revision_id: record.revision.id, comments: input.comments }))

  const by = splitGeneratedBy(record.generated_by)
  const manifest = {
    mode: 'browser',
    approved: input.approval !== undefined,
    note: input.approval ? BROWSER_EXPORT_APPROVED_NOTE : BROWSER_EXPORT_NOTE,
    project: { id: input.project.id, name: input.project.name, slug: input.project.slug ?? null },
    screen_external_id: record.screen_external_id,
    version: input.approval?.version ?? null,
    approved_by: input.approval?.approved_by ?? null,
    approved_at: input.approval?.approved_at ?? null,
    artifact_hash: record.artifact.content_hash,
    spec_hash: record.revision.spec_hash,
    generated_at: input.generated_at,
    adapter: by.adapter,
    model: by.model,
    validation_summary: summarize(record.validation_results),
    design_handoff: {
      screen_revision_id: record.revision.id,
      design_input_spec_hash: record.revision.spec_hash,
      locked_elements: [...(spec.locked_elements ?? [])],
      locked_actions: [...(spec.locked_actions ?? [])],
      allowed_tokens: [...ALLOWED_DESIGN_TOKENS],
    },
    files: files.map((f) => ({ path: f.path, sha256: f.sha256 })),
  }
  await add('manifest.json', 'application/json', pretty(manifest))
  return files
}

/** 파일 하나를 내려받는다 (브라우저 전용 — URL·document 가 없으면 아무 것도 하지 않는다). */
export function downloadBundleFile(file: BundleFile, prefix = ''): boolean {
  try {
    const url = URL.createObjectURL(new Blob([file.text], { type: file.mime }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${prefix}${file.path}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    // 브라우저가 다운로드를 시작할 시간을 준 뒤 해제한다.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return true
  } catch {
    return false
  }
}
