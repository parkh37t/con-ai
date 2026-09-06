/**
 * Hono 앱 (계약 §7). 모든 상태는 Store(DB)에 있고, 작업 실행은 프로세스 안의 순차 큐(JobQueue)로 시작한다.
 * 의존성(store·adapter·render·validate)은 주입한다 — 테스트는 메모리 DB 와 가짜 어댑터·렌더러·검증기를 넣는다.
 */
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { Hono, type Context } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import {
  DomainRuleError,
  assertAllowed,
  canIssueIaExternalId,
  canMarkReviewReady,
  computeRtm,
  evaluateApprovalGate,
  issueFnExternalId,
  issueIaExternalId,
  proposeFnExternalId,
  proposeIaExternalId,
  relabelFnExternalId,
  relabelIaExternalId,
  type RuleReason,
} from '@con-ai/domain'
import type { ModelAdapter } from '@con-ai/model-adapter'
import type { SliceGenerationRequest } from '@con-ai/prompt-templates'
import { S2B_LEARNED_PROFILE, type RenderProfile } from '@con-ai/renderer'
import { IANode as IANodeSchema, type ValidationResult } from '@con-ai/schemas'
import {
  PipelineError,
  StoreConflictError,
  assembleForRequest,
  baselineIdOf,
  buildGenerationContext,
  sha256,
  stableStringify,
  type ApprovalDocument,
  type ArtifactDocument,
  type CommentDocument,
  type IANodeDocument,
  type JobDocument,
  type PipelineDeps,
  type ProjectDocument,
  type PromptAssembler,
  type PromptTemplateDocument,
  type DummyDataDocument,
  type ReferenceDocument,
  type RequirementDocument,
  type ScreenDocument,
  type ScreenRevisionDocument,
  type Store,
  type StoredDocument,
} from '@con-ai/worker-generation'
import { recoverInterruptedAsisAnalyses, runAsisAnalysis, type AsisAnalysisDocument, type AsisStore } from './asis-runner.js'
import { ASIS_SAMPLE_2_HTML, ASIS_SAMPLE_HTML } from './asis-sample.js'
import { EXPORT_VERSION, exportApprovedRevision, summarizeValidation } from './export.js'
import { buildMeta, detectPlaywright } from './meta.js'
import { JobQueue, recoverInterruptedJobs } from './queue.js'
import { mountWebStatic, notFoundBody } from './runtime.js'
import { ApprovalBody, AsisCreateBody, AsisPainPointPatchBody, CommentBody, CommentPatchBody, IaNodePatchBody, IdIssueBody, RevisionPromptBody, ScreenCreateBody, ScreenPatchBody, SliceGenerationRequestBody, toSliceRequest } from './schemas.js'
import { buildRtmInput } from './rtm-adapter.js'
import { copyDummyForNewScreen, deriveShell, newScreenDocument, nextScreenExternalId } from './screens.js'
import { checkUrl, lookupResolve, parsePolicy, type SsrfPolicy, type SsrfResolve } from './ssrf.js'

/** 생성 HTML 응답의 CSP (계약 §7): 외부 자원 없음, 인라인 스타일·스크립트만, 이미지는 data: 만. */
export const ARTIFACT_HTML_CSP = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:"

/** 사람 검토(V6) 결과 — 기획자가 완료 버튼을 누른 것을 pass 로 기록한다. */
export const HUMAN_REVIEW_CHECK_ID = 'V6.human_review'
export const HUMAN_REVIEW_CHECKER_VERSION = 'human-review-v0'

export interface AppOptions {
  /** 문서 저장소 + AS-IS 스크린샷 저장소 (계약 §1·§12). SqliteStore 가 둘 다 구현한다. */
  store: AsisStore
  adapter: ModelAdapter
  render: PipelineDeps['render']
  validate: PipelineDeps['validate']
  /** 내보내기 폴더 (EXPORT_DIR). 없으면 만든다. */
  export_dir: string
  /**
   * 운영 모드(한 포트) — 웹 빌드 디렉터리 절대 경로. 주면 그 정적 파일과 SPA 폴백을 함께 제공한다(runtime.ts).
   * 개발(웹 5173 + API 8787)에서는 주지 않는다. 존재 확인은 부르는 쪽(server.ts resolveWebDist)이 한다.
   */
  web_dist?: string | undefined
  env?: NodeJS.ProcessEnv | undefined
  /** AS-IS 분석 대상 URL 정책 (SSRF 차단, ssrf.ts). 기본은 env 에서 읽는다. 테스트에서 주입한다. */
  ssrf_policy?: SsrfPolicy | undefined
  /** 호스트 → IP 해석기. 기본은 node:dns lookup. 테스트에서 특정 호스트만 사설로 보이게 주입한다. */
  ssrf_resolve?: SsrfResolve | undefined
  now?: (() => string) | undefined
  newId?: (() => string) | undefined
  required_check_ids?: readonly string[] | undefined
  profile?: RenderProfile | undefined
  assembler?: PromptAssembler | undefined
  log?: ((message: string) => void) | undefined
}

export interface ConAiApp {
  app: Hono
  queue: JobQueue
  deps: PipelineDeps
  /** 시작 시 failed 로 정리한(서버 재시작으로 중단된) 작업 id. */
  recovered_job_ids: string[]
  /** 시작 시 failed 로 정리한(서버 재시작으로 중단된) AS-IS 분석 id (계약 §12). */
  recovered_asis_ids: string[]
  /** 정적 제공 중인 웹 빌드 경로. 켜지 않았으면 null. */
  web_dist: string | null
}

export function createApp(options: AppOptions): ConAiApp {
  const { store, adapter } = options
  const env = options.env ?? process.env
  const now = options.now ?? (() => new Date().toISOString())
  const newId = options.newId ?? (() => randomUUID())
  const profile = options.profile ?? S2B_LEARNED_PROFILE
  const requiredCheckIds = options.required_check_ids ?? []
  const log = options.log ?? ((m: string) => console.log(m))
  mkdirSync(options.export_dir, { recursive: true })

  const deps: PipelineDeps = { store, adapter, render: options.render, validate: options.validate, now, newId, required_check_ids: requiredCheckIds, profile, assembler: options.assembler }
  const recovered = recoverInterruptedJobs(store, now)
  const recoveredAsis = recoverInterruptedAsisAnalyses(store, now)
  // SSRF 정책은 접수(POST)와 러너가 **같은 것**을 쓴다 — 두 곳의 판단이 갈리면 우회가 생긴다.
  const ssrfPolicy = options.ssrf_policy ?? parsePolicy(env)
  const ssrfResolve = options.ssrf_resolve ?? lookupResolve
  const queue = new JobQueue({
    deps,
    runAsis: (analysisId) => runAsisAnalysis(analysisId, { store, adapter, now, env, ssrf_policy: ssrfPolicy, ssrf_resolve: ssrfResolve }),
    onError: (jobId, err) => log(`[queue] 작업 ${jobId} 예외: ${err instanceof Error ? err.message : String(err)}`),
  })

  const app = new Hono()
  /** 가동 시간 기준 시각 (GET /healthz). */
  const startedAt = Date.now()

  // ---------- 공통 ----------

  app.onError((err, c) => {
    if (err instanceof StoreConflictError) return c.json({ error: 'stale_revision', message: err.message, expected: err.expected, current: err.current }, 409)
    if (err instanceof DomainRuleError) return c.json({ error: 'rule_violation', message: err.message, reasons: err.reasons }, 400)
    if (err instanceof PipelineError) return c.json({ error: err.code, message: err.message, details: err.details }, err.code === 'internal' ? 404 : 400)
    log(`[api] ${c.req.method} ${c.req.path} 오류: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
    return c.json({ error: 'internal', message: err instanceof Error ? err.message : String(err) }, 500)
  })
  app.notFound((c) => c.json(notFoundBody(c.req.method, c.req.path), 404))

  // ---------- 상태 확인 ----------

  /**
   * 컨테이너 헬스체크용. 값(키·토큰)은 넣지 않는다 — 어댑터 종류·Playwright 유무·DB 접근 가능 여부·가동 시간만.
   * DB 를 읽지 못하면 status 'error' 와 503 을 준다(오케스트레이터가 재시작할 수 있도록).
   */
  app.get('/healthz', (c) => {
    const db = probeDb(store)
    const body = {
      status: db === 'ok' ? ('ok' as const) : ('error' as const),
      adapter: adapter.kind,
      playwright: detectPlaywright(env),
      db,
      uptime_s: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
    }
    return c.json(body, db === 'ok' ? 200 : 503)
  })

  // ---------- 메타·프로젝트 ----------

  app.get('/api/meta', (c) => c.json(buildMeta(adapter, env)))

  app.get('/api/projects', (c) => c.json(store.list<ProjectDocument>('project').map((d) => d.data)))

  app.get('/api/projects/:id', (c) => {
    const project = store.get<ProjectDocument>('project', c.req.param('id'))
    if (!project) return notFound(c, '프로젝트')
    const requirements = store.list<RequirementDocument>('requirement', (d) => d.data.project_id === project.id).map((d) => d.data)
    const ia_nodes = store.list<IANodeDocument>('ia_node', (d) => d.data.project_id === project.id).map((d) => d.data)
    const screens = store.list<ScreenDocument>('screen', (d) => d.data.project_id === project.id).map((d) => screenSummary(store, d.data))
    return c.json({ project: project.data, requirements, ia_nodes, screens })
  })

  /**
   * RTM — 추적 체인 REQ → IA → FN → SCR 의 집계·행·갭 제안 (산출물 P1-05, 읽기 전용).
   * 저장하지 않고 매번 문서에서 계산한다. 계산 규칙은 packages/domain 의 computeRtm 이 갖는다.
   */
  app.get('/api/projects/:id/rtm', (c) => {
    const project = store.get<ProjectDocument>('project', c.req.param('id'))
    if (!project) return notFound(c, '프로젝트')
    return c.json(computeRtm(buildRtmInput(store, project.id)))
  })

  /** IA 노드 한 건 — 화면이 저장 직전에 현재 revision 을 읽는다 (낙관적 잠금). */
  app.get('/api/ia-nodes/:id', (c) => {
    const doc = store.get<IANodeDocument>('ia_node', c.req.param('id'))
    if (!doc) return notFound(c, 'IA 노드')
    return c.json({ ia_node: doc.data, revision: doc.revision })
  })

  /**
   * IA 노드 연결·기능 정의 (발번과 분리).
   * 요구사항 연결과 기능 추가는 번호가 없어도 할 수 있다 — 번호는 사람이 따로 발번한다.
   */
  app.patch('/api/ia-nodes/:id', async (c) => {
    const doc = store.get<IANodeDocument>('ia_node', c.req.param('id'))
    if (!doc) return notFound(c, 'IA 노드')
    const parsed = await parseJson(c, IaNodePatchBody)
    if ('response' in parsed) return parsed.response
    const body = parsed.data

    let next: IANodeDocument = { ...doc.data }
    if (body.requirement_ids !== undefined) {
      // 존재하지 않는 REQ 를 연결하면 커버리지가 거짓이 된다 — 저장 전에 막는다.
      const known = new Set(store.list<RequirementDocument>('requirement', (d) => d.data.project_id === doc.data.project_id).map((d) => d.data.external_id))
      const unknown = body.requirement_ids.filter((r) => !known.has(r))
      if (unknown.length > 0) {
        return c.json({ error: 'requirement_not_found', message: '없는 요구사항은 연결할 수 없다', reasons: unknown.map((r) => ({ code: 'rtm.requirement_unknown', message: `${r} 는 이 프로젝트에 없다` })) }, 400)
      }
      next = { ...next, requirement_ids: body.requirement_ids, change_reason: body.reason }
    }
    if (body.add_function !== undefined) {
      const fn = body.add_function
      const entry = { id: randomUUID(), name: fn.name, kind: fn.kind, ...(fn.base_function_id === undefined ? {} : { base_function_id: fn.base_function_id }) }
      next = { ...next, functions: [...(next.functions ?? []), entry] }
    }

    const check = IANodeSchema.safeParse(next)
    if (!check.success) {
      return c.json({ error: 'invalid_ia_node', message: 'IA 노드 규칙에 어긋난다', reasons: check.error.issues.map((i) => ({ code: 'ia_node.invalid', message: `${i.path.map(String).join('.')}: ${i.message}` })) }, 400)
    }
    try {
      const saved = store.put<IANodeDocument>('ia_node', doc.id, check.data, body.revision)
      return c.json({ ia_node: saved.data, revision: saved.revision })
    } catch (e) {
      if (e instanceof StoreConflictError) return conflict(c, e)
      throw e
    }
  })

  /**
   * ID 발번 — 사람이 「승인 · ID 발번」 을 눌렀을 때만 온다.
   * 서버가 번호를 **다시 계산**해 요청값과 다르면 그 사실을 응답에 실어 화면이 알린다
   * (모델·클라이언트가 계산한 번호를 그대로 박지 않는다).
   */
  app.post('/api/ia-nodes/:id/id-issuances', async (c) => {
    const doc = store.get<IANodeDocument>('ia_node', c.req.param('id'))
    if (!doc) return notFound(c, 'IA 노드')
    const parsed = await parseJson(c, IdIssueBody)
    if ('response' in parsed) return parsed.response
    const body = parsed.data
    const nodes = store.list<IANodeDocument>('ia_node', (d) => d.data.project_id === doc.data.project_id).map((d) => d.data)
    const at = new Date().toISOString()

    // 화면이 본 제안이 그 사이 바뀌었으면 승인하지 않는다 (문서 revision 만으로는 제안 내용 변경을 못 잡는다).
    if (body.expected_proposal_hash !== undefined) {
      const kind = body.function_id === undefined ? 'issue_ia_id' : 'issue_fn_id'
      const current = computeRtm(buildRtmInput(store, doc.data.project_id)).proposals.find((p) => p.kind === kind && p.ia_node_id === doc.id)
      if (current === undefined || current.proposal_hash !== body.expected_proposal_hash) {
        return c.json({ error: 'stale_proposal', message: '화면에 보인 제안이 그 사이 바뀌었다. 새로고침 후 다시 확인한다' }, 409)
      }
    }

    const input = { external_id: body.external_id, by: body.by, reason: body.reason, at }
    try {
      let saved: IANodeDocument
      let recomputed: string | null
      if (body.function_id === undefined) {
        recomputed = proposeIaExternalId(nodes, doc.id)
        assertAllowed(canIssueIaExternalId(nodes, doc.data, input), 'IA 외부 ID 를 발번할 수 없다')
        saved = issueIaExternalId(nodes, doc.data, input)
      } else {
        recomputed = proposeFnExternalId(doc.data)
        saved = issueFnExternalId(doc.data, body.function_id, input)
      }
      const check = IANodeSchema.safeParse(saved)
      if (!check.success) {
        return c.json({ error: 'invalid_ia_node', message: '발번 결과가 IA 노드 규칙에 어긋난다', reasons: check.error.issues.map((i) => ({ code: 'ia_node.invalid', message: `${i.path.map(String).join('.')}: ${i.message}` })) }, 400)
      }
      const stored = store.put<IANodeDocument>('ia_node', doc.id, check.data, body.revision)
      return c.json({
        ia_node: stored.data,
        revision: stored.revision,
        issued_external_id: body.external_id,
        recomputed_external_id: recomputed,
        differs: recomputed !== null && recomputed !== body.external_id,
      })
    } catch (e) {
      if (e instanceof StoreConflictError) return conflict(c, e)
      if (e instanceof DomainRuleError) return c.json({ error: 'id_issuance_rejected', message: e.message, reasons: e.reasons }, 400)
      throw e
    }
  })

  /** ID 개명 — 옛 값을 지우지 않고 별칭으로 내린다. 사유·행위자 필수. */
  app.post('/api/ia-nodes/:id/id-relabels', async (c) => {
    const doc = store.get<IANodeDocument>('ia_node', c.req.param('id'))
    if (!doc) return notFound(c, 'IA 노드')
    const parsed = await parseJson(c, IdIssueBody)
    if ('response' in parsed) return parsed.response
    const body = parsed.data
    const nodes = store.list<IANodeDocument>('ia_node', (d) => d.data.project_id === doc.data.project_id).map((d) => d.data)
    const input = { external_id: body.external_id, by: body.by, reason: body.reason, at: new Date().toISOString() }
    try {
      const next = body.function_id === undefined ? relabelIaExternalId(nodes, doc.data, input) : relabelFnExternalId(doc.data, body.function_id, input)
      const check = IANodeSchema.safeParse(next)
      if (!check.success) {
        return c.json({ error: 'invalid_ia_node', message: '개명 결과가 IA 노드 규칙에 어긋난다', reasons: check.error.issues.map((i) => ({ code: 'ia_node.invalid', message: `${i.path.map(String).join('.')}: ${i.message}` })) }, 400)
      }
      const stored = store.put<IANodeDocument>('ia_node', doc.id, check.data, body.revision)
      return c.json({ ia_node: stored.data, revision: stored.revision })
    } catch (e) {
      if (e instanceof StoreConflictError) return conflict(c, e)
      if (e instanceof DomainRuleError) return c.json({ error: 'id_relabel_rejected', message: e.message, reasons: e.reasons }, 400)
      throw e
    }
  })

  app.get('/api/projects/:id/references', (c) => {
    const id = c.req.param('id')
    if (!store.get('project', id)) return notFound(c, '프로젝트')
    const refs = store.list<ReferenceDocument>('reference', (d) => d.data.project_id === undefined || d.data.project_id === id).map((d) => d.data)
    return c.json(refs)
  })

  /**
   * 화면 만들기 (한 줄 입력 흐름) — 프로젝트에 새 화면 레코드를 만든다.
   * 외부 ID 는 서버가 `SCREEN-001` 형식으로 자동 부여한다(기존 화면 ID 는 건드리지 않는다).
   * `sample_from` 레퍼런스가 있으면 그 예시 더미데이터를 새 화면 이름으로 복제해 표가 채워진 목업이 나오게 한다.
   */
  app.post('/api/projects/:id/screens', async (c) => {
    const project = store.get<ProjectDocument>('project', c.req.param('id'))
    if (!project) return notFound(c, '프로젝트')
    const parsed = await parseJson(c, ScreenCreateBody)
    if ('response' in parsed) return parsed.response
    const body = parsed.data
    const screens = store.list<ScreenDocument>('screen', (d) => d.data.project_id === project.id).map((d) => d.data)
    const externalId = nextScreenExternalId(screens.map((s) => s.external_id))
    const shell = body.shell ?? deriveShell(body.title, screens.map((s) => s.shell))
    const screen = newScreenDocument({ id: newId(), project_id: project.id, external_id: externalId, title: body.title, shell, device: body.device })
    const stored = store.put<ScreenDocument>('screen', screen.id, screen, 0)

    const reference = body.sample_from === undefined ? undefined : store.get<ReferenceDocument>('reference', body.sample_from)
    if (body.sample_from !== undefined && !reference) return c.json({ error: 'reference_invalid', message: `참고 레퍼런스를 찾을 수 없다: ${body.sample_from}` }, 400)
    const copied = copyDummyForNewScreen({
      reference: reference?.data,
      dummy: store.list<DummyDataDocument>('dummy_data').map((d) => d.data),
      project_id: project.id,
      new_external_id: externalId,
    })
    for (const doc of copied) store.put<DummyDataDocument>('dummy_data', doc.id, doc, 0)
    return c.json({ screen: stored.data, sample_fixtures: copied.map((d) => d.id) }, 201)
  })

  /** 화면 제목만 바꾼다 (외부 ID·별칭·상태는 그대로). 만든 직후 이름을 고치는 용도. */
  app.patch('/api/screens/:id', async (c) => {
    const doc = store.get<ScreenDocument>('screen', c.req.param('id'))
    if (!doc) return notFound(c, '화면')
    const parsed = await parseJson(c, ScreenPatchBody)
    if ('response' in parsed) return parsed.response
    const stored = store.put<ScreenDocument>('screen', doc.id, { ...doc.data, title: parsed.data.title }, doc.revision)
    return c.json(stored.data)
  })

  // ---------- 생성 ----------

  async function readSliceRequest(c: Context, screenId: string): Promise<{ req: SliceGenerationRequest } | { response: Response }> {
    const parsed = await parseJson(c, SliceGenerationRequestBody)
    if ('response' in parsed) return parsed
    if (parsed.data.screen_id !== undefined && parsed.data.screen_id !== screenId) {
      return { response: c.json({ error: 'invalid_request', message: `본문의 screen_id(${parsed.data.screen_id})가 경로(${screenId})와 다르다` }, 400) }
    }
    return { req: toSliceRequest(screenId, parsed.data) }
  }

  app.post('/api/screens/:id/prompt-preview', async (c) => {
    const screenId = c.req.param('id')
    if (!store.get('screen', screenId)) return notFound(c, '화면')
    const read = await readSliceRequest(c, screenId)
    if ('response' in read) return read.response
    const built = buildGenerationContext(store, read.req, { profile_rules: profile.rules })
    let prompt
    try {
      prompt = assembleForRequest(read.req, built.ctx, options.assembler)
    } catch (err) {
      return c.json({ error: 'prompt_assembly_failed', message: err instanceof Error ? err.message : String(err) }, 500)
    }
    return c.json({ prompt, context_summary: built.summary })
  })

  app.post('/api/screens/:id/generation-jobs', async (c) => {
    const screenId = c.req.param('id')
    const screen = store.get<ScreenDocument>('screen', screenId)
    if (!screen) return notFound(c, '화면')
    const read = await readSliceRequest(c, screenId)
    if ('response' in read) return read.response
    const req = read.req
    // 문맥이 만들어지지 않는 요청(없는 요구사항·레퍼런스·기준 revision)은 작업을 만들지 않고 400 으로 알린다.
    const built = buildGenerationContext(store, req, { profile_rules: profile.rules })
    const project = built.project.data
    const id = newId()
    const createdAt = now()
    const templateVersion = latestTemplateVersion(store)
    const job: JobDocument = {
      id,
      project_id: project.id,
      screen_plan_id: screen.id,
      job_type: req.task_type,
      status: 'queued',
      idempotency_key: id,
      input_snapshot_hash: sha256(stableStringify({ req, context_summary: built.summary })),
      baseline_id: baselineIdOf(project),
      prompt_template_version: templateVersion,
      model_id: adapter.model,
      attempt: 0,
      max_attempts: 1,
      timeout_ms: 180_000,
      cancel_requested: false,
      created_at: createdAt,
      request: req,
      adapter: adapter.kind,
      model: adapter.model,
      prompt_text: '',
      context_summary: built.summary,
    }
    store.put<JobDocument>('job', id, job, 0)
    queue.enqueue(id)
    return c.json({ job_id: id }, 202)
  })

  app.get('/api/jobs/:id', (c) => {
    const job = store.get<JobDocument>('job', c.req.param('id'))
    if (!job) return notFound(c, '작업')
    return c.json(job.data)
  })

  /** 계약 외 추가: 취소 요청. queued 면 바로 cancelled, running 이면 다음 단계 진입 전에 워커가 cancelled 로 끝낸다. */
  app.post('/api/jobs/:id/cancel', (c) => {
    const job = store.get<JobDocument>('job', c.req.param('id'))
    if (!job) return notFound(c, '작업')
    if (job.data.status === 'queued') {
      const updated = store.put<JobDocument>('job', job.id, { ...job.data, status: 'cancelled', cancel_requested: true, finished_at: now() }, job.revision)
      return c.json(updated.data)
    }
    if (job.data.status === 'running') {
      const updated = store.put<JobDocument>('job', job.id, { ...job.data, cancel_requested: true }, job.revision)
      return c.json(updated.data)
    }
    return c.json({ error: 'job_finished', message: `이미 끝난 작업(${job.data.status})은 취소할 수 없다` }, 409)
  })

  // ---------- 화면·revision·산출물 ----------

  app.get('/api/screens/:id', (c) => {
    const screen = store.get<ScreenDocument>('screen', c.req.param('id'))
    if (!screen) return notFound(c, '화면')
    const revisions = store
      .list<ScreenRevisionDocument>('screen_revision', (d) => d.data.screen_id === screen.id)
      .sort((a, b) => a.data.revision_no - b.data.revision_no)
      .map((r) => {
        const artifact = store.get<ArtifactDocument>('artifact', r.data.artifact_id)
        const results = artifact ? validationResultsFor(store, artifact.data.content_hash) : []
        return {
          id: r.id,
          revision_no: r.data.revision_no,
          artifact_id: r.data.artifact_id,
          artifact_hash: artifact?.data.content_hash ?? null,
          artifact_status: artifact?.data.status ?? null,
          validation_summary: summarizeValidation(results),
          open_comments: store.list<CommentDocument>('comment', (d) => d.data.revision_id === r.id && d.data.status === 'open').length,
          change_summary: r.data.change_summary ?? null,
          based_on_revision_id: r.data.based_on_revision_id ?? null,
          job_id: r.data.job_id,
          created_at: r.data.created_at,
        }
      })
    return c.json({ screen: screen.data, revisions })
  })

  app.get('/api/revisions/:id', (c) => {
    const revision = store.get<ScreenRevisionDocument>('screen_revision', c.req.param('id'))
    if (!revision) return notFound(c, 'revision')
    const artifact = store.get<ArtifactDocument>('artifact', revision.data.artifact_id)
    const validation_results = artifact ? validationResultsFor(store, artifact.data.content_hash) : []
    const comments = store.list<CommentDocument>('comment', (d) => d.data.revision_id === revision.id).map(withRevision)
    return c.json({
      revision: { ...revision.data, spec: undefined },
      spec: revision.data.spec,
      artifact: artifact ? { ...artifact.data, revision: artifact.revision } : null,
      validation_results,
      comments,
      element_index: revision.data.element_index,
    })
  })

  app.get('/api/artifacts/:id/html', (c) => {
    const id = c.req.param('id')
    const html = store.getHtml(id)
    if (html === undefined) return notFound(c, '산출물 HTML')
    c.header('Content-Security-Policy', ARTIFACT_HTML_CSP)
    c.header('X-Content-Type-Options', 'nosniff')
    c.header('Cache-Control', 'no-store')
    return c.html(html)
  })

  app.post('/api/artifacts/:id/validations', async (c) => {
    const artifactDoc = store.get<ArtifactDocument>('artifact', c.req.param('id'))
    if (!artifactDoc) return notFound(c, '산출물')
    const artifact = artifactDoc.data
    const revision = artifact.screen_revision_id ? store.get<ScreenRevisionDocument>('screen_revision', artifact.screen_revision_id) : undefined
    if (!revision) return c.json({ error: 'no_revision', message: '산출물에 연결된 revision 이 없다' }, 409)
    const html = store.getHtml(artifact.id)
    if (html === undefined) return c.json({ error: 'no_html', message: '산출물 HTML 이 없다' }, 409)
    if (sha256(html) !== artifact.content_hash) return c.json({ error: 'hash_mismatch', message: '저장된 HTML 의 hash 가 산출물 hash 와 다르다' }, 409)
    const job = store.get<JobDocument>('job', artifact.generation_job_id)
    const requiredCases = job ? [...job.data.request.cases] : ['normal']
    const results = await deps.validate({ spec: revision.data.spec, html, required_cases: requiredCases, artifact_hash: artifact.content_hash })
    const foreign = results.filter((r) => r.artifact_hash !== artifact.content_hash)
    if (foreign.length > 0) return c.json({ error: 'hash_mismatch', message: `검증 결과 ${foreign.length}건이 다른 hash 를 가리킨다` }, 500)
    // 같은 hash 의 이전 결과는 지우고 새 결과로 바꾼다 (사람 검토 V6 포함 — 재검증하면 다시 검토한다).
    for (const old of store.list<ValidationResult>('validation_result', (d) => d.data.artifact_hash === artifact.content_hash)) store.delete('validation_result', old.id)
    for (const r of results) store.put<ValidationResult>('validation_result', r.id, r, 0)
    let updated = artifact
    if (artifact.status !== 'approved' && artifact.status !== 'stale') {
      const ready = canMarkReviewReady({ content_hash: artifact.content_hash, status: 'validation_pending' }, results, requiredCheckIds).allowed
      const nextStatus = ready ? 'review_ready' : 'validation_pending'
      if (nextStatus !== artifact.status) updated = store.put<ArtifactDocument>('artifact', artifact.id, { ...artifact, status: nextStatus }, artifactDoc.revision).data
    }
    return c.json({ artifact: updated, validation_results: results, summary: summarizeValidation(results) })
  })

  // ---------- 코멘트 ----------

  app.post('/api/revisions/:id/comments', async (c) => {
    const revision = store.get<ScreenRevisionDocument>('screen_revision', c.req.param('id'))
    if (!revision) return notFound(c, 'revision')
    const artifact = store.get<ArtifactDocument>('artifact', revision.data.artifact_id)
    if (!artifact) return c.json({ error: 'no_artifact', message: 'revision 에 연결된 산출물이 없다' }, 409)
    const parsed = await parseJson(c, CommentBody)
    if ('response' in parsed) return parsed.response
    const body = parsed.data
    const id = newId()
    const comment: CommentDocument = {
      id,
      screen_id: revision.data.screen_id,
      revision_id: revision.id,
      artifact_hash: artifact.data.content_hash,
      target: body.target,
      author: body.author,
      role: body.role,
      text: body.text,
      blocking: body.blocking,
      status: 'open',
      created_at: now(),
    }
    if (body.element_id !== undefined) comment.element_id = body.element_id
    if (body.section_id !== undefined) comment.section_id = body.section_id
    if (body.case_id !== undefined) comment.case_id = body.case_id
    if (body.display_no !== undefined) comment.display_no = body.display_no
    const stored = store.put<CommentDocument>('comment', id, comment, 0)
    return c.json(withRevision(stored), 201)
  })

  app.patch('/api/comments/:id', async (c) => {
    const doc = store.get<CommentDocument>('comment', c.req.param('id'))
    if (!doc) return notFound(c, '코멘트')
    const parsed = await parseJson(c, CommentPatchBody)
    if ('response' in parsed) return parsed.response
    const next: CommentDocument = { ...doc.data, status: parsed.data.status }
    if (parsed.data.status === 'open') delete next.resolved_by_revision_id
    const stored = store.put<CommentDocument>('comment', doc.id, next, parsed.data.revision)
    return c.json(withRevision(stored))
  })

  app.post('/api/revisions/:id/revision-prompt', async (c) => {
    const revision = store.get<ScreenRevisionDocument>('screen_revision', c.req.param('id'))
    if (!revision) return notFound(c, 'revision')
    const parsed = await parseJson(c, RevisionPromptBody)
    if ('response' in parsed) return parsed.response
    const screen = store.get<ScreenDocument>('screen', revision.data.screen_id)
    if (!screen) return notFound(c, '화면')
    const spec = revision.data.spec
    const requirementIds = requirementIdsForSpec(store, screen.data.project_id, spec.requirements.map((r) => r.id))
    const req: SliceGenerationRequest = {
      screen_id: screen.id,
      task_type: 'edit',
      purpose: '코멘트 반영 수정 프롬프트 초안',
      requirement_ids: requirementIds,
      criterion_ids: [],
      reference_ids: [],
      cases: spec.states.map((s) => s.case_kind).filter((k): k is NonNullable<typeof k> => k !== undefined),
      keep_conditions: [],
      roles: spec.roles ?? [],
      device: spec.device,
      base_revision_id: revision.id,
      comment_ids: parsed.data.comment_ids,
    }
    const built = buildGenerationContext(store, req, { profile_rules: profile.rules })
    const draft = await adapter.draftRevisionPrompt({ ctx: built.ctx, current: spec, comments: built.ctx.comments ?? [] })
    return c.json({ prompt: draft.prompt, rationale: draft.rationale, adapter: adapter.kind, model: adapter.model, comment_ids: parsed.data.comment_ids })
  })

  // ---------- 승인·내보내기 ----------

  app.post('/api/screens/:id/approvals', async (c) => {
    const screenDoc = store.get<ScreenDocument>('screen', c.req.param('id'))
    if (!screenDoc) return notFound(c, '화면')
    const parsed = await parseJson(c, ApprovalBody)
    if ('response' in parsed) return parsed.response
    const body = parsed.data
    const revision = store.get<ScreenRevisionDocument>('screen_revision', body.revision_id)
    if (!revision || revision.data.screen_id !== screenDoc.id) return c.json({ error: 'invalid_request', message: `revision ${body.revision_id} 은(는) 이 화면의 것이 아니다` }, 400)
    const artifactDoc = store.get<ArtifactDocument>('artifact', revision.data.artifact_id)
    if (!artifactDoc) return c.json({ error: 'no_artifact', message: 'revision 에 연결된 산출물이 없다' }, 409)
    const artifact = artifactDoc.data
    const project = store.get<ProjectDocument>('project', screenDoc.data.project_id)
    if (!project) return notFound(c, '프로젝트')
    const html = store.getHtml(artifact.id)

    const reasons: RuleReason[] = []
    const screen = screenDoc.data
    if (screen.status === 'approved' && screen.version !== undefined) {
      reasons.push({ code: 'approval.screen_already_approved', message: `화면 ${screen.external_id} 은(는) 이미 v${screen.version} 으로 승인·내보내기됐다 — 이 세로 조각은 v1.0 한 번만 내보낸다` })
    }
    const comments = store.list<CommentDocument>('comment', (d) => d.data.revision_id === revision.id)
    const openBlocking = comments.filter((d) => d.data.blocking && d.data.status === 'open')
    if (openBlocking.length > 0) {
      reasons.push({ code: 'approval.blocking_comments_open', message: `차단 코멘트 ${openBlocking.length}건이 열려 있다: ${openBlocking.map((d) => `[${d.data.role}] ${d.data.text}`).join(' / ')}` })
    }
    if (html === undefined) reasons.push({ code: 'approval.no_html', message: '산출물 HTML 이 저장되어 있지 않다' })
    else if (sha256(html) !== artifact.content_hash) reasons.push({ code: 'approval.hash_mismatch', message: '저장된 HTML 의 hash 가 산출물 hash 와 다르다' })

    const existing = validationResultsFor(store, artifact.content_hash)
    const approvedAt = now()
    const runId = existing[0]?.validation_run_id ?? newId()
    // 기획자의 완료 버튼 = 사람 검토(V6) pass. 게이트가 통과할 때만 저장한다.
    const humanReview: ValidationResult = {
      id: newId(),
      validation_run_id: runId,
      artifact_hash: artifact.content_hash,
      check_id: HUMAN_REVIEW_CHECK_ID,
      stage: 'V6',
      status: 'pass',
      required: true,
      message: `기획자 ${body.approver} 완료 확인`,
      evidence: [`approver:${body.approver}`, `approved_at:${approvedAt}`],
      checker_version: HUMAN_REVIEW_CHECKER_VERSION,
    }
    const gate = evaluateApprovalGate({
      artifact: { id: artifact.id, content_hash: artifact.content_hash, status: artifact.status },
      target_hash: body.artifact_hash ?? artifact.content_hash,
      revision: { expected: artifactDoc.revision, current: artifactDoc.revision },
      validation_results: [...existing.filter((r) => r.check_id !== HUMAN_REVIEW_CHECK_ID), humanReview],
      required_check_ids: requiredCheckIds,
      baseline: { current: baselineIdOf(project.data), artifact: revision.data.spec.baseline_id },
    })
    reasons.push(...gate.reasons)
    if (reasons.length > 0 || html === undefined) return c.json({ error: 'approval_rejected', reasons }, 400)

    store.put<ValidationResult>('validation_result', humanReview.id, humanReview, 0)
    const allResults = validationResultsFor(store, artifact.content_hash)
    const requirements = store.list<RequirementDocument>('requirement', (d) => d.data.project_id === project.id).map((d) => d.data)
    const exported = exportApprovedRevision({
      export_dir: options.export_dir,
      project: project.data,
      screen,
      revision: revision.data,
      artifact,
      html,
      validation_results: allResults,
      comments: comments.map((d) => d.data),
      requirements,
      approved_by: body.approver,
      approved_at: approvedAt,
      adapter: adapter.kind,
      model: adapter.model,
    })
    const approval: ApprovalDocument = {
      id: newId(),
      artifact_id: artifact.id,
      artifact_hash: artifact.content_hash,
      baseline_id: revision.data.spec.baseline_id,
      validation_run_id: runId,
      approved_by: body.approver,
      approved_at: approvedAt,
      version: EXPORT_VERSION,
      export_path: exported.export_path,
      files: exported.files,
    }
    if (body.note !== undefined) approval.note = body.note
    store.put<ApprovalDocument>('approval', approval.id, approval, 0)
    store.put<ArtifactDocument>('artifact', artifact.id, { ...artifact, status: 'approved', approval_id: approval.id }, artifactDoc.revision)
    store.put<ScreenDocument>('screen', screen.id, { ...screen, status: 'approved', version: EXPORT_VERSION }, screenDoc.revision)
    return c.json({ approval, version: EXPORT_VERSION, export_path: exported.export_path, export_url: `/exports/${exported.export_path.split('\\').join('/')}/index.html`, files: exported.files, manifest: exported.manifest })
  })

  // ---------- AS-IS 분석 (계약 §12) ----------

  // 합성 레거시 데모 페이지 — 분석 데모·e2e 대상 (외부 egress 없이 자체 제공).
  app.get('/asis-sample', (c) => {
    c.header('X-Content-Type-Options', 'nosniff')
    return c.html(ASIS_SAMPLE_HTML)
  })

  app.get('/asis-sample-2', (c) => {
    c.header('X-Content-Type-Options', 'nosniff')
    return c.html(ASIS_SAMPLE_2_HTML)
  })

  app.post('/api/projects/:id/asis-analyses', async (c) => {
    const project = store.get<ProjectDocument>('project', c.req.param('id'))
    if (!project) return notFound(c, '프로젝트')
    const parsed = await parseJson(c, AsisCreateBody)
    if ('response' in parsed) return parsed.response
    // SSRF 차단 (docs/plan/배포.md §7) — 사설·루프백·링크로컬(클라우드 메타데이터)로 가는 URL 은 접수하지 않는다.
    // 문맥 검증 실패와 같은 관례: 400 + 이유. 분석 문서를 만들지 않으므로 큐에도 들어가지 않는다.
    const verdict = await checkUrl(parsed.data.url, ssrfPolicy, ssrfResolve)
    if (!verdict.allowed) {
      // 로그에는 호스트와 코드만 남긴다 — URL 에 자격 증명(user:pass@)이 들어 있을 수 있다.
      log(`[asis] 대상 URL 거부 (${verdict.code}): ${hostOf(parsed.data.url)}`)
      return c.json({ error: 'blocked_url', code: verdict.code, message: verdict.reason, reasons: [verdict.reason] }, 400)
    }
    const id = newId()
    const doc: AsisAnalysisDocument = {
      id,
      project_id: project.id,
      url: parsed.data.url,
      status: 'queued',
      adapter: adapter.kind,
      model: adapter.model,
      created_at: now(),
      pain_points: [],
    }
    if (parsed.data.note !== undefined) doc.note = parsed.data.note
    store.put<AsisAnalysisDocument>('asis_analysis', id, doc, 0)
    queue.enqueue(id, 'asis') // 생성 작업과 같은 순차 큐
    return c.json({ analysis_id: id }, 202)
  })

  app.get('/api/projects/:id/asis-analyses', (c) => {
    const project = store.get<ProjectDocument>('project', c.req.param('id'))
    if (!project) return notFound(c, '프로젝트')
    const list = store
      .list<AsisAnalysisDocument>('asis_analysis', (d) => d.data.project_id === project.id)
      .map((d) => ({ id: d.id, url: d.data.url, status: d.data.status, pain_point_count: d.data.pain_points.length, created_at: d.data.created_at }))
    return c.json(list)
  })

  app.get('/api/asis-analyses/:id', (c) => {
    const doc = store.get<AsisAnalysisDocument>('asis_analysis', c.req.param('id'))
    if (!doc) return notFound(c, 'AS-IS 분석')
    // revision 은 PATCH(채택/거부)의 오래된 저장 방지용 (코멘트와 같은 관례).
    return c.json({ ...doc.data, revision: doc.revision })
  })

  app.patch('/api/asis-analyses/:id/pain-points/:pid', async (c) => {
    const doc = store.get<AsisAnalysisDocument>('asis_analysis', c.req.param('id'))
    if (!doc) return notFound(c, 'AS-IS 분석')
    const parsed = await parseJson(c, AsisPainPointPatchBody)
    if ('response' in parsed) return parsed.response
    const pid = c.req.param('pid')
    if (!doc.data.pain_points.some((p) => p.id === pid)) return notFound(c, '페인포인트')
    const pain_points = doc.data.pain_points.map((p) => (p.id === pid ? { ...p, status: parsed.data.status } : p))
    // 클라이언트가 본 revision 으로 저장 — 오래되면 StoreConflictError → 409 stale_revision (onError).
    const stored = store.put<AsisAnalysisDocument>('asis_analysis', doc.id, { ...doc.data, pain_points }, parsed.data.revision)
    return c.json({ ...stored.data, revision: stored.revision })
  })

  app.get('/api/asis-assets/:id', (c) => {
    const png = store.getAsset(c.req.param('id'))
    if (png === undefined) return notFound(c, '스크린샷')
    c.header('Content-Type', 'image/png')
    c.header('Cache-Control', 'no-store')
    c.header('X-Content-Type-Options', 'nosniff')
    return c.body(png.slice().buffer)
  })

  // ---------- 내보낸 정적 파일 ----------

  app.use('/exports/*', serveStatic({ root: options.export_dir, rewriteRequestPath: (path) => path.replace(/^\/exports/, '') }))

  // ---------- 운영 모드: 웹 빌드 (반드시 API 라우트 등록 뒤) ----------

  const webDist = options.web_dist
  if (webDist !== undefined) mountWebStatic(app, webDist)

  return { app, queue, deps, recovered_job_ids: recovered, recovered_asis_ids: recoveredAsis, web_dist: webDist ?? null }
}

// ---------- 보조 ----------

/** 로그용 호스트만 뽑는다 (자격 증명·경로·질의는 남기지 않는다). 읽을 수 없으면 '(URL 아님)'. */
function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return '(URL 아님)'
  }
}

function notFound(c: Context, what: string): Response {
  return c.json({ error: 'not_found', message: `${what}을(를) 찾을 수 없다` }, 404)
}

/** 낙관적 잠금 충돌 — 클라이언트가 본 revision 이 낡았다. 저장하지 않고 현재 값을 알려 준다. */
function conflict(c: Context, err: StoreConflictError): Response {
  return c.json({ error: 'stale_revision', message: err.message, expected: err.expected, current: err.current }, 409)
}

/** DB 를 실제로 한 번 읽어본다 (없는 문서 조회 — 인덱스 조회라 비용이 거의 없다). 예외면 'error'. */
function probeDb(store: Store): 'ok' | 'error' {
  try {
    store.get('project', '__healthz_probe__')
    return 'ok'
  } catch {
    return 'error'
  }
}

type ParseOutcome<T> = { data: T } | { response: Response }

async function parseJson<T>(c: Context, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: Array<{ path: PropertyKey[]; message: string }> } } }): Promise<ParseOutcome<T>> {
  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    return { response: c.json({ error: 'invalid_json', message: '요청 본문이 JSON 이 아니다' }, 400) }
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message }))
    return { response: c.json({ error: 'invalid_request', message: '요청 본문이 올바르지 않다', issues }, 400) }
  }
  return { data: parsed.data }
}

function validationResultsFor(store: Store, hash: string): ValidationResult[] {
  return store.list<ValidationResult>('validation_result', (d) => d.data.artifact_hash === hash).map((d) => d.data)
}

function withRevision(doc: StoredDocument<CommentDocument>): CommentDocument & { revision: number } {
  return { ...doc.data, revision: doc.revision }
}

function screenSummary(store: Store, screen: ScreenDocument) {
  const revisions = store.list<ScreenRevisionDocument>('screen_revision', (d) => d.data.screen_id === screen.id)
  const open_comments = store.list<CommentDocument>('comment', (d) => d.data.screen_id === screen.id && d.data.status === 'open').length
  return {
    id: screen.id,
    external_id: screen.external_id,
    title: screen.title,
    shell: screen.shell,
    device: screen.device,
    status: screen.status,
    version: screen.version ?? null,
    current_revision_id: screen.current_revision_id ?? null,
    revision_count: revisions.length,
    open_comments,
  }
}

function latestTemplateVersion(store: Store): string {
  const templates = store.list<PromptTemplateDocument>('prompt_template')
  return templates[templates.length - 1]?.data.version ?? 'v1'
}

/** 명세가 참조하는 외부 REQ ID → 프로젝트 요구사항 내부 id. */
function requirementIdsForSpec(store: Store, projectId: string, externalIds: readonly string[]): string[] {
  const wanted = new Set(externalIds)
  return store.list<RequirementDocument>('requirement', (d) => d.data.project_id === projectId && wanted.has(d.data.external_id)).map((d) => d.id)
}
