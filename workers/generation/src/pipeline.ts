/**
 * 생성 파이프라인 (계약 §6): context_build → spec_generate → schema_check → render → validate → persist.
 *
 * - 각 단계 진입 시 job.stage 를 저장한다 (새로고침 후에도 진행 상태가 보인다).
 * - 단계 진입 전 취소 요청(job.cancel_requested)을 확인해 cancelled 로 끝낸다.
 * - 어떤 실패도 이전 revision/artifact 를 결과로 연결하지 않는다 (개발프롬프트: 실패 시 예전 HTML 을 새 결과처럼 표시하지 않음).
 * - 모델 출력은 서버에서 ScreenSpec 스키마·참조 검사로 재검사한다 (설계 §8).
 */
import type { AdapterResult } from '@con-ai/model-adapter'
import type { AssembledPrompt, SliceGenerationRequest } from '@con-ai/prompt-templates'
import { S2B_LEARNED_PROFILE, type RenderOutput, type RenderProfile } from '@con-ai/renderer'
import { ChangeSummary, ScreenSpecShape, checkScreenSpecReferences, type ChangeSummary as ChangeSummaryType, type JobStage, type ScreenSpec, type ValidationResult } from '@con-ai/schemas'
import { canMarkReviewReady } from '@con-ai/domain'
import { DEFAULT_ASSEMBLER, assembleForRequest, buildGenerationContext, type ContextBuildResult } from './context.js'
import type { ArtifactDocument, CommentDocument, DummyDataDocument, JobDocument, ScreenDocument, ScreenRevisionDocument } from './documents.js'
import { PipelineError } from './errors.js'
import { sha256, specHash } from './hash.js'
import type { PipelineDeps, Store, StoredDocument } from './types.js'

/** 렌더러 버전 표기 — Artifact.renderer_version. 프로파일 id 를 붙여 재현 조건을 남긴다. */
export function rendererVersionOf(profile: RenderProfile): string {
  return `renderer@${profile.id}`
}

class JobCancelled extends Error {
  override readonly name = 'JobCancelled'
}

/** job 문서를 항상 최신 revision 으로 다시 읽어 저장한다 (큐가 순차라 충돌은 없지만 취소 플래그를 놓치지 않기 위해). */
class JobHandle {
  private doc: StoredDocument<JobDocument>

  constructor(private readonly store: Store, doc: StoredDocument<JobDocument>) {
    this.doc = doc
  }

  get id(): string {
    return this.doc.id
  }

  get data(): JobDocument {
    return this.doc.data
  }

  reload(): JobDocument {
    const fresh = this.store.get<JobDocument>('job', this.doc.id)
    if (!fresh) throw new PipelineError('internal', `작업 문서가 사라졌다: ${this.doc.id}`)
    this.doc = fresh
    return fresh.data
  }

  save(patch: Partial<JobDocument>): JobDocument {
    const current = this.reload()
    const next: JobDocument = { ...current, ...patch }
    this.doc = this.store.put<JobDocument>('job', this.doc.id, next, this.doc.revision)
    return this.doc.data
  }

  /** 단계 진입: 취소 요청이 있으면 JobCancelled, 아니면 stage 기록. */
  enter(stage: JobStage): void {
    const current = this.reload()
    if (current.cancel_requested || current.status === 'cancelled') throw new JobCancelled(`취소 요청으로 ${stage} 진입 전에 중단`)
    this.save({ stage, current_stage: stage })
  }
}

export async function runGenerationJob(jobId: string, deps: PipelineDeps): Promise<void> {
  const stored = deps.store.get<JobDocument>('job', jobId)
  if (!stored) throw new Error(`작업을 찾을 수 없다: ${jobId}`)
  if (stored.data.status === 'cancelled') return
  if (stored.data.status !== 'queued') throw new Error(`queued 상태의 작업만 실행할 수 있다: ${jobId} 는 ${stored.data.status}`)

  const job = new JobHandle(deps.store, stored)
  const profile = deps.profile ?? S2B_LEARNED_PROFILE
  const assembler = deps.assembler ?? DEFAULT_ASSEMBLER
  const startedAt = deps.now()
  let stage: JobStage = 'context_build'

  try {
    if (job.data.cancel_requested) throw new JobCancelled('실행 전에 취소 요청')
    job.save({ status: 'running', started_at: startedAt, attempt: job.data.attempt + 1, adapter: deps.adapter.kind, model: deps.adapter.model, model_id: deps.adapter.model })

    // 1. context_build
    stage = 'context_build'
    job.enter(stage)
    const req = job.data.request
    const built = buildGenerationContext(deps.store, req, { profile_rules: profile.rules })
    job.save({ context_summary: built.summary, baseline_id: built.ctx.baseline_id })

    // 2. spec_generate
    stage = 'spec_generate'
    job.enter(stage)
    let prompt: AssembledPrompt
    try {
      prompt = assembleForRequest(req, built.ctx, assembler)
    } catch (err) {
      throw new PipelineError('internal', `프롬프트 조립 실패: ${messageOf(err)}`, { stage })
    }
    job.save({ prompt_text: promptText(prompt), prompt_template_version: prompt.template_version })
    const result = await callAdapter(deps, prompt, built, req, stage)
    if (result.usage) job.save({ cost: { input_tokens: result.usage.input_tokens, output_tokens: result.usage.output_tokens } })

    // 3. schema_check
    stage = 'schema_check'
    job.enter(stage)
    const spec = checkSpec(result, built, stage)
    const changeSummary = parseChangeSummary(result, req.purpose)

    // 4. render
    stage = 'render'
    job.enter(stage)
    const revisionNo = nextRevisionNo(deps.store, built.screen.id)
    const dummy = collectDummy(deps.store, spec)
    let rendered: RenderOutput
    try {
      rendered = deps.render({
        spec,
        profile,
        dummy,
        meta: {
          screen_title: built.screen.data.title,
          requirements: built.ctx.requirements.map((r) => ({ external_id: r.external_id, title: r.title, criterion_ids: r.criteria.map((c) => c.id) })),
          revision_label: `r${revisionNo}`,
          generated_by: `${deps.adapter.kind}:${deps.adapter.model}`,
        },
      })
    } catch (err) {
      throw new PipelineError('renderer_error', `렌더링 실패: ${messageOf(err)}`, { stage })
    }
    if (typeof rendered.html !== 'string' || rendered.html.length === 0) throw new PipelineError('renderer_error', '렌더러가 빈 HTML 을 돌려줬다', { stage })
    const artifactHash = sha256(rendered.html)

    // 5. validate
    stage = 'validate'
    job.enter(stage)
    let results: ValidationResult[]
    try {
      results = await deps.validate({ spec, html: rendered.html, required_cases: [...req.cases], artifact_hash: artifactHash })
    } catch (err) {
      throw new PipelineError('internal', `검증 실행 실패: ${messageOf(err)}`, { stage })
    }
    const foreign = results.filter((r) => r.artifact_hash !== artifactHash)
    if (foreign.length > 0) {
      throw new PipelineError('internal', `검증 결과 ${foreign.length}건이 산출물 hash 와 다른 hash 를 가리킨다 (${foreign.map((r) => r.check_id).join(', ')})`, { stage })
    }

    // 6. persist
    stage = 'persist'
    job.enter(stage)
    persist(deps, { job, built, spec, changeSummary, rendered, artifactHash, results, revisionNo, profile })
  } catch (err) {
    finishWithError(job, deps, stage, err)
  }
}

interface PersistInput {
  job: JobHandle
  built: ContextBuildResult
  spec: ScreenSpec
  changeSummary: ChangeSummaryType
  rendered: RenderOutput
  artifactHash: string
  results: ValidationResult[]
  revisionNo: number
  profile: RenderProfile
}

function persist(deps: PipelineDeps, input: PersistInput): void {
  const { store } = deps
  const { job, built, spec, rendered, artifactHash, results, revisionNo } = input
  const at = deps.now()
  const revisionId = deps.newId()
  const artifactId = deps.newId()
  const req = job.data.request

  // 산출물 상태: 자동 필수 검사(V6 제외)가 이 hash 에서 전부 pass 면 review_ready, 아니면 validation_pending (설계 §10, §11).
  const ready = canMarkReviewReady({ content_hash: artifactHash, status: 'validation_pending' }, results, deps.required_check_ids ?? [])
  const artifact: ArtifactDocument = {
    id: artifactId,
    project_id: built.project.id,
    screen_revision_id: revisionId,
    kind: 'html',
    content_hash: artifactHash,
    generation_job_id: job.id,
    renderer_version: rendererVersionOf(input.profile),
    status: ready.allowed ? 'review_ready' : 'validation_pending',
    created_at: at,
  }
  const revision: ScreenRevisionDocument = {
    id: revisionId,
    screen_id: built.screen.id,
    revision_no: revisionNo,
    spec,
    spec_hash: specHash(spec),
    artifact_id: artifactId,
    job_id: job.id,
    change_summary: input.changeSummary,
    element_index: rendered.element_index.map((e) => ({ element_id: e.element_id, section_id: e.section_id, display_no: e.display_no })),
    created_at: at,
  }
  if (built.base_revision) revision.based_on_revision_id = built.base_revision.id

  store.putHtml(artifactId, rendered.html)
  store.put<ArtifactDocument>('artifact', artifactId, artifact, 0)
  for (const r of results) store.put<ValidationResult>('validation_result', r.id, r, 0)
  store.put<ScreenRevisionDocument>('screen_revision', revisionId, revision, 0)

  const screen = store.get<ScreenDocument>('screen', built.screen.id)
  if (!screen) throw new PipelineError('internal', `화면 문서가 사라졌다: ${built.screen.id}`, { stage: 'persist' })
  store.put<ScreenDocument>('screen', screen.id, { ...screen.data, current_revision_id: revisionId, status: 'review' }, screen.revision)

  // edit 작업이면 반영한 코멘트를 이 revision 으로 해결 표시한다.
  if (req.task_type === 'edit') {
    for (const id of req.comment_ids ?? []) {
      const c = store.get<CommentDocument>('comment', id)
      if (!c) continue
      store.put<CommentDocument>('comment', id, { ...c.data, status: 'resolved', resolved_by_revision_id: revisionId }, c.revision)
    }
  }

  job.save({ status: 'succeeded', finished_at: deps.now(), result: { revision_id: revisionId, artifact_id: artifactId } })
}

function finishWithError(job: JobHandle, deps: PipelineDeps, stage: JobStage, err: unknown): void {
  const at = deps.now()
  if (err instanceof JobCancelled) {
    job.save({ status: 'cancelled', finished_at: at, cancel_requested: true })
    return
  }
  const failure = err instanceof PipelineError
    ? { code: err.code, message: err.message, stage: err.stage ?? stage, details: err.details }
    : { code: 'internal' as const, message: `예기치 않은 오류: ${messageOf(err)}`, stage, details: [] }
  job.save({ status: 'failed', finished_at: at, failure })
}

/** 모델 호출 — edit 는 reviseSpec(기준 명세 포함), 나머지는 generateSpec. 어댑터 예외·거부(refusal)는 model_error. */
async function callAdapter(deps: PipelineDeps, prompt: AssembledPrompt, built: ContextBuildResult, req: SliceGenerationRequest, stage: JobStage): Promise<AdapterResult> {
  let result: AdapterResult
  try {
    if (req.task_type === 'edit') {
      const current = built.base_revision?.data.spec
      if (!current) throw new PipelineError('reference_invalid', '수정 작업에는 기준 명세가 필요하다', { stage })
      result = await deps.adapter.reviseSpec({ prompt, ctx: built.ctx, req, current })
    } else {
      result = await deps.adapter.generateSpec({ prompt, ctx: built.ctx, req })
    }
  } catch (err) {
    if (err instanceof PipelineError) throw err
    throw new PipelineError('model_error', `모델 호출 실패 (${deps.adapter.kind}/${deps.adapter.model}): ${messageOf(err)}`, { stage })
  }
  if (result.stop_reason === 'refusal') throw new PipelineError('model_error', '모델이 요청을 거부했다 (stop_reason=refusal)', { stage })
  if (!result.output || typeof result.output !== 'object') throw new PipelineError('model_error', '어댑터가 출력(output)을 돌려주지 않았다', { stage })
  return result
}

function checkSpec(result: AdapterResult, built: ContextBuildResult, stage: JobStage): ScreenSpec {
  const raw: unknown = result.output?.screen_spec
  if (raw === undefined || raw === null) throw new PipelineError('schema_invalid', '모델 출력에 screen_spec 이 없다', { stage })
  const shape = ScreenSpecShape.safeParse(raw)
  if (!shape.success) {
    const details = shape.error.issues.map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`)
    throw new PipelineError('schema_invalid', `화면명세가 스키마에 맞지 않는다 (${details.length}건)`, { stage, details })
  }
  const refIssues = checkScreenSpecReferences(shape.data)
  if (refIssues.length > 0) {
    const details = refIssues.map((i) => `${i.path.map(String).join('.')}: ${i.message}`)
    throw new PipelineError('reference_invalid', `화면명세의 참조가 깨져 있다 (${details.length}건)`, { stage, details })
  }
  const spec = shape.data
  const details: string[] = []
  if (spec.screen_id !== built.screen.data.external_id) details.push(`screen_id: 기대 ${built.screen.data.external_id}, 출력 ${spec.screen_id}`)
  if (spec.baseline_id !== built.ctx.baseline_id) details.push(`baseline_id: 기대 ${built.ctx.baseline_id}, 출력 ${spec.baseline_id}`)
  if (details.length > 0) throw new PipelineError('reference_invalid', '화면명세의 screen_id/baseline_id 가 서버가 기대한 값과 다르다', { stage, details })
  return spec as ScreenSpec
}

function parseChangeSummary(result: AdapterResult, purpose: string): ChangeSummaryType {
  const parsed = ChangeSummary.safeParse(result.output?.change_summary)
  if (parsed.success) return parsed.data
  return { summary: `변경 요약 없음 — 모델 출력에 유효한 change_summary 가 없어 목적으로 대체: ${purpose}`, added_ids: [], changed_ids: [], removed_ids: [], locked_violations: [] }
}

/** 기존 revision 최대 번호 + 1. */
export function nextRevisionNo(store: Store, screenId: string): number {
  let max = 0
  for (const r of store.list<ScreenRevisionDocument>('screen_revision', (d) => d.data.screen_id === screenId)) max = Math.max(max, r.data.revision_no)
  return max + 1
}

/** states[].fixture_id 에 맞는 더미데이터를 모은다. 없는 fixture 는 빈 배열로 두고 spec.unresolved 에 기록한다. */
export function collectDummy(store: Store, spec: ScreenSpec): Record<string, unknown[]> {
  const dummy: Record<string, unknown[]> = {}
  for (const state of spec.states) {
    if (state.fixture_id in dummy) continue
    const doc = store.get<DummyDataDocument>('dummy_data', state.fixture_id)
    if (doc) {
      dummy[state.fixture_id] = doc.data.rows
    } else {
      dummy[state.fixture_id] = []
      spec.unresolved.push({ kind: 'missing_evidence', text: `더미데이터 fixture 가 없다: ${state.fixture_id} (CASE ${state.id}) — 빈 배열로 렌더링했다`, related_ids: [state.id] })
    }
  }
  return dummy
}

function promptText(prompt: AssembledPrompt): string {
  return `[system]\n${prompt.system}\n\n[user]\n${prompt.user}`
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
