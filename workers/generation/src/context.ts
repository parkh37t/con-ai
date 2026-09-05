/**
 * context_build — 저장소에서 요청(SliceGenerationRequest)에 연결된 자료만 모아 GenerationContext 를 만든다 (설계 §8: 대상에 연결된 자료만).
 * API 의 prompt-preview 와 revision-prompt 도 같은 함수를 쓴다.
 */
import { assemblePrompt, assembleRevisionPrompt, type AssembledPrompt, type ContextComment, type ContextReference, type ContextRequirement, type GenerationContext, type SliceGenerationRequest } from '@con-ai/prompt-templates'
import { S2B_LEARNED_PROFILE } from '@con-ai/renderer'
import type { ScreenSpec } from '@con-ai/schemas'
import type { CommentDocument, ProjectDocument, ReferenceDocument, RequirementDocument, ScreenDocument, ScreenRevisionDocument } from './documents.js'
import { PipelineError } from './errors.js'
import type { PromptAssembler, Store, StoredDocument } from './types.js'

export interface ContextBuildResult {
  ctx: GenerationContext
  /** job.context_summary 에 기록할 문맥 목록. */
  summary: string[]
  project: StoredDocument<ProjectDocument>
  screen: StoredDocument<ScreenDocument>
  base_revision?: StoredDocument<ScreenRevisionDocument> | undefined
  comments: StoredDocument<CommentDocument>[]
}

/** 프로젝트의 기준 버전 ID — 문서에 있으면 그 값, 없으면 `baseline-<slug|id>-1`. */
export function baselineIdOf(project: ProjectDocument): string {
  return project.baseline_id || `baseline-${project.slug || project.id}-1`
}

export function buildGenerationContext(store: Store, req: SliceGenerationRequest, options: { profile_rules?: readonly string[] | undefined } = {}): ContextBuildResult {
  const stage = 'context_build' as const
  const screen = store.get<ScreenDocument>('screen', req.screen_id)
  if (!screen) throw new PipelineError('internal', `대상 화면을 찾을 수 없다: ${req.screen_id}`, { stage })
  const project = store.get<ProjectDocument>('project', screen.data.project_id)
  if (!project) throw new PipelineError('internal', `화면 ${screen.data.external_id} 의 프로젝트를 찾을 수 없다: ${screen.data.project_id}`, { stage })

  // 요구사항: 선택한 요구사항 + 선택한 수용조건이 속한 요구사항. 수용조건을 골랐으면 그 조건만 남긴다.
  const wantedReq = new Set(req.requirement_ids)
  const wantedCrit = new Set(req.criterion_ids)
  const unknownReq = new Set(req.requirement_ids)
  const foundCrit = new Set<string>()
  const requirements: ContextRequirement[] = []
  for (const doc of store.list<RequirementDocument>('requirement', (d) => d.data.project_id === project.id)) {
    const r = doc.data
    unknownReq.delete(doc.id)
    const hasWantedCrit = r.criteria.some((c) => wantedCrit.has(c.id))
    if (!wantedReq.has(doc.id) && !hasWantedCrit) continue
    const criteria = wantedCrit.size > 0 && hasWantedCrit ? r.criteria.filter((c) => wantedCrit.has(c.id)) : r.criteria
    for (const c of r.criteria) if (wantedCrit.has(c.id)) foundCrit.add(c.id)
    requirements.push({ external_id: r.external_id, title: r.title, body: r.body, criteria: criteria.map((c) => ({ id: c.id, text: c.text, kind: c.kind })) })
  }
  if (unknownReq.size > 0) throw new PipelineError('reference_invalid', `요구사항을 찾을 수 없다: ${[...unknownReq].join(', ')}`, { stage })
  const unknownCrit = [...wantedCrit].filter((id) => !foundCrit.has(id))
  if (unknownCrit.length > 0) throw new PipelineError('reference_invalid', `수용조건을 찾을 수 없다: ${unknownCrit.join(', ')}`, { stage })

  const references: ContextReference[] = []
  for (const id of req.reference_ids) {
    const ref = store.get<ReferenceDocument>('reference', id)
    if (!ref) throw new PipelineError('reference_invalid', `참고 레퍼런스를 찾을 수 없다: ${id}`, { stage })
    references.push({ id: ref.id, title: ref.data.title, category: ref.data.category, spec: ref.data.spec })
  }

  // edit 기준 revision: 요청의 base_revision_id, 없으면 화면의 현재 revision.
  let baseRevision: StoredDocument<ScreenRevisionDocument> | undefined
  const baseId = req.base_revision_id ?? (req.task_type === 'edit' ? screen.data.current_revision_id : undefined)
  if (baseId !== undefined) {
    baseRevision = store.get<ScreenRevisionDocument>('screen_revision', baseId)
    if (!baseRevision) throw new PipelineError('reference_invalid', `기준 revision 을 찾을 수 없다: ${baseId}`, { stage })
    if (baseRevision.data.screen_id !== screen.id) {
      throw new PipelineError('reference_invalid', `기준 revision ${baseId} 은(는) 화면 ${screen.data.external_id} 의 것이 아니다`, { stage })
    }
  }
  if (req.task_type === 'edit' && !baseRevision) {
    throw new PipelineError('reference_invalid', `수정 작업에는 기준 revision 이 필요하다 — 화면 ${screen.data.external_id} 에 아직 생성 결과가 없다`, { stage })
  }

  const comments: StoredDocument<CommentDocument>[] = []
  for (const id of req.comment_ids ?? []) {
    const c = store.get<CommentDocument>('comment', id)
    if (!c) throw new PipelineError('reference_invalid', `코멘트를 찾을 수 없다: ${id}`, { stage })
    if (c.data.screen_id !== screen.id) throw new PipelineError('reference_invalid', `코멘트 ${id} 은(는) 화면 ${screen.data.external_id} 의 것이 아니다`, { stage })
    comments.push(c)
  }

  const profileRules = [...(options.profile_rules ?? S2B_LEARNED_PROFILE.rules)]
  const baseline_id = baselineIdOf(project.data)
  const ctx: GenerationContext = {
    project: { name: project.data.name, org: project.data.org, profile_id: project.data.profile_id },
    screen: { external_id: screen.data.external_id, title: screen.data.title, shell: screen.data.shell, device: req.device },
    requirements,
    references,
    profile_rules: profileRules,
    baseline_id,
  }
  if (baseRevision) ctx.base_spec = baseRevision.data.spec
  if (comments.length > 0) ctx.comments = comments.map(toContextComment)

  const summary: string[] = [
    `프로젝트: ${project.data.name} (${project.data.org}, 프로파일 ${project.data.profile_id})`,
    `대상 화면: ${screen.data.external_id} — ${screen.data.title} (${screen.data.shell}, ${req.device})`,
    `작업 유형: ${req.task_type} / 목적: ${req.purpose}`,
    `기준 버전: ${baseline_id}`,
    ...requirements.map((r) => `요구사항 ${r.external_id} ${r.title} — 수용조건 ${r.criteria.map((c) => `${c.id}(${c.kind})`).join(', ') || '없음'}`),
    ...references.map((r) => `참고 레퍼런스: ${r.title} [${r.category}] (${r.id})`),
    `CASE: ${req.cases.join(', ') || '없음'}`,
  ]
  if (req.keep_conditions.length > 0) summary.push(`유지 조건: ${req.keep_conditions.join(' / ')}`)
  if (baseRevision) summary.push(`기준 revision: #${baseRevision.data.revision_no} (${baseRevision.id})`)
  if (comments.length > 0) summary.push(`반영할 코멘트 ${comments.length}건: ${comments.map((c) => `[${c.data.role}] ${c.data.text}`).join(' / ')}`)
  if (req.prompt_override) summary.push('기획자가 직접 쓴 프롬프트를 사용한다 (문맥은 그대로 첨부)')
  summary.push(`규격 규칙 ${profileRules.length}개`)

  return { ctx, summary, project, screen, base_revision: baseRevision, comments }
}

export function toContextComment(c: StoredDocument<CommentDocument>): ContextComment {
  const out: ContextComment = { id: c.id, role: c.data.role, author: c.data.author, text: c.data.text, target: c.data.target }
  if (c.data.element_id !== undefined) out.element_id = c.data.element_id
  if (c.data.case_id !== undefined) out.case_id = c.data.case_id
  return out
}

export const DEFAULT_ASSEMBLER: PromptAssembler = { assemblePrompt, assembleRevisionPrompt }

/** 수정 지시문 — 기획자가 직접 쓴 프롬프트가 있으면 그것, 없으면 목적(+범위). */
export function revisionInstruction(req: SliceGenerationRequest): string {
  if (req.prompt_override && req.prompt_override.trim().length > 0) return req.prompt_override
  return req.scope ? `${req.purpose}\n변경 범위: ${req.scope}` : req.purpose
}

/** 작업 유형에 맞는 프롬프트 조립 — edit 는 기준 명세·코멘트를 포함한 수정 프롬프트, 나머지는 생성 프롬프트. */
export function assembleForRequest(req: SliceGenerationRequest, ctx: GenerationContext, assembler: PromptAssembler = DEFAULT_ASSEMBLER): AssembledPrompt {
  return req.task_type === 'edit' ? assembler.assembleRevisionPrompt(ctx, revisionInstruction(req)) : assembler.assemblePrompt(req, ctx)
}

/** edit 기준 명세를 ScreenSpec 타입으로 돌려준다 (context 의 base_spec 은 unknown). */
export function baseSpecOf(result: ContextBuildResult): ScreenSpec | undefined {
  return result.base_revision?.data.spec
}
