/**
 * 정적 데모용 인메모리 API — `pnpm demo:snapshot` 이 실제 서버에서 떠 둔 스냅샷을 읽어 서버를 흉내낸다.
 *
 * 규칙 (CLAUDE.md)
 * - 할 수 없는 일을 성공으로 위장하지 않는다. 새 URL 의 AS-IS 분석은 running 을 잠깐 보인 뒤 실패로 끝내고,
 *   스냅샷에 생성 결과가 없는 화면의 생성 요청은 실제 서버의 문맥 구성 실패처럼 400 으로 즉시 거절한다.
 * - 상태 변경(코멘트·페인포인트 채택·승인)은 메모리에서 실제로 반영해 화면이 살아 있게 한다.
 * - 데모에서 되돌려주는 예시 응답에는 "정적 데모" 표시를 남긴다.
 *
 * 저장물 (apps/web/public/demo/, `pnpm demo:snapshot` 이 만든다)
 *   snapshot.json        경로별 GET 응답 맵
 *   prompt-preview.json  POST /api/screens/:id/prompt-preview 응답 예시
 *   revision-prompt.json POST /api/revisions/:id/revision-prompt 응답 예시
 *   approval.json        POST /api/screens/:id/approvals 응답 예시 (대상 화면·revision 포함)
 *   artifacts/·asis/·exports/  정적 파일 (api.ts 가 URL 을 직접 가리킨다)
 */
import { DEMO_BASE } from './demo-mode.js'
import { JOB_STAGES } from './job-progress.js'
import { summarizeValidation } from './summary.js'
import type {
  ApprovalResponse,
  AsisAnalysis,
  AsisAnalysisSummary,
  Comment,
  CommentInput,
  CommentStatus,
  Job,
  Meta,
  PainPointStatus,
  ProjectDetail,
  PromptPreviewResponse,
  RevisionDetail,
  RevisionPromptDraft,
  ScreenDetail,
  SliceGenerationRequest,
} from './types.js'

// ---------------------------------------------------------------- 상수·문구

/** 생성 작업 단계 진행 간격 (작업 상태 폴링 UI 가 실제처럼 보이도록). */
export const DEMO_STAGE_INTERVAL_MS = 1200
/** AS-IS 분석: 대기 → 실행 중 → 실패 로 넘어가는 시점. */
export const DEMO_ASIS_QUEUED_MS = 1200
export const DEMO_ASIS_RUNNING_MS = 3600

export const DEMO_MARK = '정적 데모'
export const DEMO_ASIS_FAILURE_MESSAGE = '정적 데모에서는 새 URL 을 분석할 수 없습니다. 로컬에서 `pnpm dev` 로 실행하세요.'
export const DEMO_GENERATION_UNAVAILABLE_MESSAGE =
  '정적 데모에는 이 화면의 생성 결과가 저장되어 있지 않습니다. 스냅샷에 결과가 있는 화면에서 실행해 보거나, 로컬에서 `pnpm dev` 로 실행하세요.'
export const DEMO_EXPORT_NOT_CAPTURED_MESSAGE =
  '정적 데모에는 스냅샷을 만들 때 승인한 revision 의 내보내기 산출물만 들어 있습니다. 다른 revision 의 완료 처리는 로컬에서 `pnpm dev` 로 실행하세요.'

// ---------------------------------------------------------------- 타입

export interface DemoResponse {
  status: number
  data: unknown
}

/** 승인 응답 예시 파일 (`demo/approval.json`). */
export interface DemoApprovalFile {
  screen_id: string
  revision_id: string
  approver: string
  response: ApprovalResponse
}

export interface DemoFiles {
  snapshot: Record<string, unknown>
  prompt_preview: PromptPreviewResponse
  revision_prompt: RevisionPromptDraft
  approval: DemoApprovalFile
}

interface DemoJobRun {
  id: string
  started_ms: number
  revision_id: string
  artifact_id: string
}

interface DemoAsisRun {
  id: string
  started_ms: number
  summary: AsisAnalysisSummary
}

export interface DemoState {
  /** 경로 → GET 응답. 데모에서 만든 작업·분석도 여기에 등록해 폴링이 그대로 동작한다. */
  gets: Map<string, unknown>
  files: DemoFiles
  jobs: Map<string, DemoJobRun>
  analyses: Map<string, DemoAsisRun>
  seq: number
  now: () => number
}

// ---------------------------------------------------------------- 보조

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function nowIso(state: DemoState): string {
  return new Date(state.now()).toISOString()
}

function notFound(what: string): DemoResponse {
  return { status: 404, data: { error: 'not_found', message: `${what}을(를) 찾을 수 없습니다 (정적 데모 스냅샷에 없음)` } }
}

function badRequest(error: string, message: string, extra: Record<string, unknown> = {}): DemoResponse {
  return { status: 400, data: { error, message, ...extra } }
}

function conflict(expected: number, current: number): DemoResponse {
  return {
    status: 409,
    data: { error: 'stale_revision', message: `문서가 그 사이 바뀌었습니다 (본 revision ${expected}, 현재 ${current}). 새로고침 후 다시 시도하세요.`, expected, current },
  }
}

function isNonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}
}

function revisionDetail(state: DemoState, id: string): RevisionDetail | undefined {
  return state.gets.get(`/api/revisions/${id}`) as RevisionDetail | undefined
}

function screenDetail(state: DemoState, id: string): ScreenDetail | undefined {
  return state.gets.get(`/api/screens/${id}`) as ScreenDetail | undefined
}

function allRevisionDetails(state: DemoState): RevisionDetail[] {
  const out: RevisionDetail[] = []
  for (const [path, value] of state.gets) {
    if (path.startsWith('/api/revisions/')) out.push(value as RevisionDetail)
  }
  return out
}

function allScreenDetails(state: DemoState): ScreenDetail[] {
  const out: ScreenDetail[] = []
  for (const [path, value] of state.gets) {
    if (path.startsWith('/api/screens/')) out.push(value as ScreenDetail)
  }
  return out
}

function allProjectDetails(state: DemoState): ProjectDetail[] {
  const out: ProjectDetail[] = []
  for (const [path, value] of state.gets) {
    // `/api/projects/:id` 만 (references·asis-analyses 는 제외)
    if (/^\/api\/projects\/[^/]+$/.test(path)) out.push(value as ProjectDetail)
  }
  return out
}

function metaOf(state: DemoState): Meta {
  return (state.gets.get('/api/meta') as Meta | undefined) ?? { adapter: 'fixture', model: 'fixture', version: '0.0.0', playwright: false }
}

/**
 * 열린 코멘트 수를 다시 센다 (실제 서버와 같은 정의).
 * revision 목록 항목 = 그 revision 의 열린 코멘트, 화면 요약 = 그 화면의 모든 열린 코멘트.
 */
function syncCommentCounts(state: DemoState): void {
  const perRevision = new Map<string, number>()
  const perScreen = new Map<string, number>()
  for (const detail of allRevisionDetails(state)) {
    const open = detail.comments.filter((c) => c.status === 'open').length
    perRevision.set(detail.revision.id, open)
    perScreen.set(detail.revision.screen_id, (perScreen.get(detail.revision.screen_id) ?? 0) + open)
  }
  for (const screen of allScreenDetails(state)) {
    for (const r of screen.revisions) r.open_comments = perRevision.get(r.id) ?? 0
  }
  for (const project of allProjectDetails(state)) {
    for (const s of project.screens) s.open_comments = perScreen.get(s.id) ?? 0
  }
}

// ---------------------------------------------------------------- 상태 만들기

export function createDemoState(files: DemoFiles, opts: { now?: () => number } = {}): DemoState {
  const gets = new Map<string, unknown>()
  for (const [path, value] of Object.entries(clone(files.snapshot))) gets.set(path, value)
  return {
    gets,
    files: clone(files),
    jobs: new Map(),
    analyses: new Map(),
    seq: 0,
    now: opts.now ?? (() => Date.now()),
  }
}

function nextId(state: DemoState, prefix: string): string {
  state.seq += 1
  return `demo-${prefix}-${state.seq}`
}

// ---------------------------------------------------------------- 진행 중 작업·분석

/** 경과 시간으로 단계를 진행시킨다. 마지막 단계를 지나면 스냅샷의 revision 을 결과로 연결하고 succeeded. */
function advanceJob(state: DemoState, run: DemoJobRun): Job {
  const job = state.gets.get(`/api/jobs/${run.id}`) as Job
  if (job.status === 'succeeded') return job
  const elapsed = state.now() - run.started_ms
  const index = Math.floor(elapsed / DEMO_STAGE_INTERVAL_MS)
  if (index >= JOB_STAGES.length) {
    job.status = 'succeeded'
    job.current_stage = 'persist'
    job.stage = 'persist'
    job.result = { revision_id: run.revision_id, artifact_id: run.artifact_id }
    job.finished_at = new Date(run.started_ms + JOB_STAGES.length * DEMO_STAGE_INTERVAL_MS).toISOString()
    return job
  }
  const stage = JOB_STAGES[index] ?? 'context_build'
  job.status = 'running'
  job.current_stage = stage
  job.stage = stage
  return job
}

/** 대기 → 실행 중 → 실패. 정적 데모는 새 URL 을 실제로 분석할 수 없으므로 성공으로 끝내지 않는다. */
function advanceAsis(state: DemoState, run: DemoAsisRun): AsisAnalysis {
  const doc = state.gets.get(`/api/asis-analyses/${run.id}`) as AsisAnalysis
  if (doc.status === 'failed') return doc
  const elapsed = state.now() - run.started_ms
  if (elapsed < DEMO_ASIS_QUEUED_MS) doc.status = 'queued'
  else if (elapsed < DEMO_ASIS_RUNNING_MS) doc.status = 'running'
  else {
    doc.status = 'failed'
    doc.failure = { code: 'browser', message: DEMO_ASIS_FAILURE_MESSAGE }
    doc.finished_at = new Date(run.started_ms + DEMO_ASIS_RUNNING_MS).toISOString()
  }
  run.summary.status = doc.status
  if (doc.finished_at !== undefined) run.summary.finished_at = doc.finished_at
  return doc
}

// ---------------------------------------------------------------- GET

function handleGet(state: DemoState, path: string): DemoResponse {
  // 진행 중인 작업·분석은 어느 GET 에서든 시간에 맞춰 진행시킨다
  // (목록 폴링만 하는 화면에서도 상태가 바뀌어야 하므로 상세 조회에 의존하지 않는다).
  for (const run of state.jobs.values()) advanceJob(state, run)
  for (const run of state.analyses.values()) advanceAsis(state, run)

  const found = state.gets.get(path)
  if (found === undefined) return notFound(`경로 ${path}`)
  return { status: 200, data: found }
}

// ---------------------------------------------------------------- POST·PATCH

function createComment(state: DemoState, revisionId: string, body: unknown): DemoResponse {
  const detail = revisionDetail(state, revisionId)
  if (!detail) return notFound('revision')
  const input = asRecord(body) as unknown as CommentInput
  if (!isNonEmpty(input.author) || !isNonEmpty(input.text)) {
    return badRequest('invalid_request', '요청 본문이 올바르지 않습니다', { issues: ['author·text 는 빈 문자열일 수 없습니다'] })
  }
  const comment: Comment = {
    id: nextId(state, 'comment'),
    screen_id: detail.revision.screen_id,
    revision_id: detail.revision.id,
    artifact_hash: detail.artifact.content_hash,
    target: input.target === 'description' ? 'description' : 'screen',
    author: input.author.trim(),
    role: input.role,
    text: input.text.trim(),
    blocking: input.blocking === true,
    status: 'open',
    created_at: nowIso(state),
    revision: 1,
  }
  if (isNonEmpty(input.element_id)) comment.element_id = input.element_id
  if (isNonEmpty(input.section_id)) comment.section_id = input.section_id
  if (isNonEmpty(input.case_id)) comment.case_id = input.case_id
  if (isNonEmpty(input.display_no)) comment.display_no = input.display_no
  detail.comments.push(comment)
  syncCommentCounts(state)
  return { status: 201, data: comment }
}

function patchComment(state: DemoState, commentId: string, body: unknown): DemoResponse {
  const b = asRecord(body)
  const status = b['status']
  const revision = b['revision']
  if (status !== 'open' && status !== 'resolved' && status !== 'wont_fix') {
    return badRequest('invalid_request', '요청 본문이 올바르지 않습니다', { issues: ['status 는 open·resolved·wont_fix 중 하나여야 합니다'] })
  }
  for (const detail of allRevisionDetails(state)) {
    const comment = detail.comments.find((c) => c.id === commentId)
    if (!comment) continue
    const current = comment.revision ?? 1
    if (typeof revision === 'number' && revision !== current) return conflict(revision, current)
    comment.status = status as CommentStatus
    if (status === 'open') delete comment.resolved_by_revision_id
    comment.revision = current + 1
    syncCommentCounts(state)
    return { status: 200, data: comment }
  }
  return notFound('코멘트')
}

function revalidate(state: DemoState, artifactId: string): DemoResponse {
  for (const detail of allRevisionDetails(state)) {
    if (detail.artifact.id !== artifactId) continue
    // 정적 데모는 다시 검사할 수 없으므로 스냅샷에 저장된 결과를 그대로 돌려준다 (새로 실행한 것처럼 꾸미지 않는다).
    const results = detail.validation_results.filter((r) => r.artifact_hash === detail.artifact.content_hash)
    return { status: 200, data: { artifact: detail.artifact, validation_results: detail.validation_results, summary: summarizeValidation(results) } }
  }
  return notFound('산출물')
}

function promptPreview(state: DemoState): DemoResponse {
  const preview = clone(state.files.prompt_preview)
  const note = `${DEMO_MARK} — 스냅샷에 저장된 예시 프롬프트입니다 (실제 조립은 로컬 실행에서 동작합니다)`
  const summary = [note, ...(preview.context_summary ?? [])]
  preview.context_summary = summary
  if (preview.prompt) preview.prompt.context_summary = summary
  return { status: 200, data: preview }
}

function revisionPrompt(state: DemoState, revisionId: string, body: unknown): DemoResponse {
  if (!revisionDetail(state, revisionId)) return notFound('revision')
  const ids = asRecord(body)['comment_ids']
  if (!Array.isArray(ids) || ids.length === 0) {
    return badRequest('invalid_request', '요청 본문이 올바르지 않습니다', { issues: ['코멘트를 최소 1개 골라야 합니다'] })
  }
  const draft = clone(state.files.revision_prompt)
  draft.rationale = `${draft.rationale} (${DEMO_MARK} — 스냅샷에 저장된 예시 초안입니다)`
  return { status: 200, data: draft }
}

function createGenerationJob(state: DemoState, screenId: string, body: unknown): DemoResponse {
  const detail = screenDetail(state, screenId)
  if (!detail) return notFound('화면')
  const latest = [...detail.revisions].sort((a, b) => a.revision_no - b.revision_no).at(-1)
  // 실제 서버의 문맥 구성 실패(계약 §11)와 같은 형태로 즉시 거절한다 — 작업을 만들지 않는다.
  if (!latest) return badRequest('demo_unavailable', DEMO_GENERATION_UNAVAILABLE_MESSAGE, { details: [DEMO_GENERATION_UNAVAILABLE_MESSAGE] })

  const request = asRecord(body) as unknown as SliceGenerationRequest
  const meta = metaOf(state)
  const id = nextId(state, 'job')
  const created = nowIso(state)
  const job: Job = {
    id,
    status: 'running',
    current_stage: 'context_build',
    stage: 'context_build',
    adapter: meta.adapter,
    model: meta.model,
    job_type: typeof request.task_type === 'string' ? request.task_type : 'create',
    screen_plan_id: screenId,
    request,
    attempt: 1,
    max_attempts: 1,
    created_at: created,
    started_at: created,
    context_summary: [
      `${DEMO_MARK} — 실제 모델 호출 없이, 스냅샷에 저장된 revision 을 결과로 연결합니다`,
      `대상 화면: ${detail.screen.external_id} — ${detail.screen.title}`,
      `작업 유형: ${typeof request.task_type === 'string' ? request.task_type : 'create'} / 목적: ${typeof request.purpose === 'string' ? request.purpose : '(없음)'}`,
      `연결할 revision: #${latest.revision_no} (${latest.id}) — 이 작업이 새로 만든 화면이 아닙니다`,
      '실제 생성·검증·저장은 로컬에서 `pnpm dev` 로 실행하세요',
    ],
    prompt_text: `[${DEMO_MARK}] 정적 데모에서는 프롬프트를 조립해 모델에 보내지 않습니다. 저장된 예시는 생성 작업대의 "프롬프트 미리보기" 에서 볼 수 있습니다.`,
  }
  state.gets.set(`/api/jobs/${id}`, job)
  state.jobs.set(id, { id, started_ms: state.now(), revision_id: latest.id, artifact_id: latest.artifact_id })
  return { status: 202, data: { job_id: id } }
}

function approve(state: DemoState, screenId: string, body: unknown): DemoResponse {
  const detail = screenDetail(state, screenId)
  if (!detail) return notFound('화면')
  const b = asRecord(body)
  const revisionId = b['revision_id']
  const approver = b['approver']
  if (!isNonEmpty(revisionId) || !isNonEmpty(approver)) {
    return badRequest('invalid_request', '요청 본문이 올바르지 않습니다', { issues: ['revision_id·approver 는 빈 문자열일 수 없습니다'] })
  }
  const target = detail.revisions.find((r) => r.id === revisionId)
  if (!target) return badRequest('invalid_request', `revision ${revisionId} 은(는) 이 화면의 것이 아닙니다`)

  const reasons: Array<{ code: string; message: string }> = []
  if (detail.screen.status === 'approved' && detail.screen.version) {
    reasons.push({
      code: 'approval.screen_already_approved',
      message: `화면 ${detail.screen.external_id} 은(는) 이미 v${detail.screen.version} 으로 승인·내보내기됐습니다 — 이 세로 조각은 v1.0 한 번만 내보냅니다`,
    })
  }
  const revision = revisionDetail(state, revisionId)
  const openBlocking = (revision?.comments ?? []).filter((c) => c.blocking && c.status === 'open')
  if (openBlocking.length > 0) {
    reasons.push({
      code: 'approval.blocking_comments_open',
      message: `차단 코멘트 ${openBlocking.length}건이 열려 있습니다: ${openBlocking.map((c) => `[${c.role}] ${c.text}`).join(' / ')}`,
    })
  }
  const captured = state.files.approval
  if (screenId !== captured.screen_id || revisionId !== captured.revision_id) {
    reasons.push({ code: 'demo.export_not_captured', message: DEMO_EXPORT_NOT_CAPTURED_MESSAGE })
  }
  if (reasons.length > 0) return { status: 400, data: { error: 'approval_rejected', reasons } }

  // 메모리에서 실제로 승인 상태를 반영한다 (홈 목록·완료 화면이 그대로 살아 있게).
  const response = clone(captured.response)
  detail.screen.status = 'approved'
  detail.screen.version = response.version
  target.artifact_status = 'approved'
  if (revision) revision.artifact.status = 'approved'
  for (const project of allProjectDetails(state)) {
    for (const s of project.screens) {
      if (s.id !== screenId) continue
      s.status = 'approved'
      s.version = response.version
    }
  }
  return { status: 200, data: response }
}

function createAsisAnalysis(state: DemoState, projectId: string, body: unknown): DemoResponse {
  const listPath = `/api/projects/${projectId}/asis-analyses`
  const list = state.gets.get(listPath) as AsisAnalysisSummary[] | undefined
  if (!list) return notFound('프로젝트')
  const b = asRecord(body)
  const url = b['url']
  if (!isNonEmpty(url) || !/^https?:\/\//i.test(url.trim())) {
    return badRequest('invalid_request', '요청 본문이 올바르지 않습니다', { issues: ['http/https URL 만 허용합니다'] })
  }
  const note = b['note']
  const meta = metaOf(state)
  const id = nextId(state, 'asis')
  const created = nowIso(state)
  const doc: AsisAnalysis = {
    id,
    project_id: projectId,
    url: url.trim(),
    status: 'queued',
    adapter: meta.adapter,
    model: meta.model,
    created_at: created,
    pain_points: [],
    revision: 1,
  }
  if (isNonEmpty(note)) doc.note = note.trim()
  const summary: AsisAnalysisSummary = { id, url: doc.url, status: 'queued', created_at: created, pain_point_count: 0 }
  state.gets.set(`/api/asis-analyses/${id}`, doc)
  list.push(summary)
  state.analyses.set(id, { id, started_ms: state.now(), summary })
  return { status: 202, data: { analysis_id: id } }
}

function patchPainPoint(state: DemoState, analysisId: string, painPointId: string, body: unknown): DemoResponse {
  const doc = state.gets.get(`/api/asis-analyses/${analysisId}`) as AsisAnalysis | undefined
  if (!doc) return notFound('AS-IS 분석')
  const b = asRecord(body)
  const status = b['status']
  const revision = b['revision']
  if (status !== 'proposed' && status !== 'adopted' && status !== 'rejected') {
    return badRequest('invalid_request', '요청 본문이 올바르지 않습니다', { issues: ['status 는 proposed·adopted·rejected 중 하나여야 합니다'] })
  }
  const point = doc.pain_points.find((p) => p.id === painPointId)
  if (!point) return notFound('페인포인트')
  const current = doc.revision ?? 1
  if (typeof revision === 'number' && revision !== current) return conflict(revision, current)
  point.status = status as PainPointStatus
  doc.revision = current + 1
  return { status: 200, data: doc }
}

// ---------------------------------------------------------------- 라우팅

/** 스냅샷 상태를 받아 요청 하나를 처리한다 (테스트에서 직접 쓴다). */
export function handleWith(state: DemoState, method: string, path: string, body?: unknown): DemoResponse {
  if (method === 'GET') return handleGet(state, path)

  if (method === 'POST') {
    let m = /^\/api\/screens\/([^/]+)\/prompt-preview$/.exec(path)
    if (m) return screenDetail(state, m[1] ?? '') ? promptPreview(state) : notFound('화면')
    m = /^\/api\/screens\/([^/]+)\/generation-jobs$/.exec(path)
    if (m) return createGenerationJob(state, m[1] ?? '', body)
    m = /^\/api\/screens\/([^/]+)\/approvals$/.exec(path)
    if (m) return approve(state, m[1] ?? '', body)
    m = /^\/api\/revisions\/([^/]+)\/comments$/.exec(path)
    if (m) return createComment(state, m[1] ?? '', body)
    m = /^\/api\/revisions\/([^/]+)\/revision-prompt$/.exec(path)
    if (m) return revisionPrompt(state, m[1] ?? '', body)
    m = /^\/api\/artifacts\/([^/]+)\/validations$/.exec(path)
    if (m) return revalidate(state, m[1] ?? '')
    m = /^\/api\/projects\/([^/]+)\/asis-analyses$/.exec(path)
    if (m) return createAsisAnalysis(state, m[1] ?? '', body)
  }

  if (method === 'PATCH') {
    let m = /^\/api\/comments\/([^/]+)$/.exec(path)
    if (m) return patchComment(state, m[1] ?? '', body)
    m = /^\/api\/asis-analyses\/([^/]+)\/pain-points\/([^/]+)$/.exec(path)
    if (m) return patchPainPoint(state, m[1] ?? '', m[2] ?? '', body)
  }

  return { status: 404, data: { error: 'not_found', message: `정적 데모가 처리하지 않는 요청입니다: ${method} ${path}` } }
}

// ---------------------------------------------------------------- 스냅샷 로딩

async function fetchJson(name: string): Promise<unknown> {
  const url = `${DEMO_BASE}${name}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`데모 스냅샷 파일을 읽지 못했습니다: ${url} (HTTP ${res.status})`)
  return (await res.json()) as unknown
}

export async function loadDemoFiles(): Promise<DemoFiles> {
  const [snapshot, prompt_preview, revision_prompt, approval] = await Promise.all([
    fetchJson('snapshot.json'),
    fetchJson('prompt-preview.json'),
    fetchJson('revision-prompt.json'),
    fetchJson('approval.json'),
  ])
  return {
    snapshot: snapshot as Record<string, unknown>,
    prompt_preview: prompt_preview as PromptPreviewResponse,
    revision_prompt: revision_prompt as RevisionPromptDraft,
    approval: approval as DemoApprovalFile,
  }
}

let statePromise: Promise<DemoState> | null = null

function demoState(): Promise<DemoState> {
  if (!statePromise) {
    statePromise = loadDemoFiles()
      .then((files) => createDemoState(files))
      .catch((e: unknown) => {
        // 다음 요청에서 다시 시도할 수 있게 한다.
        statePromise = null
        throw e
      })
  }
  return statePromise
}

/**
 * 데모 모드의 단일 진입점. `/api/…` 는 인메모리로 처리하고, 그 밖의 경로(내보낸 정적 파일 등)는 실제로 가져온다.
 */
export async function handle(method: string, path: string, body?: unknown): Promise<DemoResponse> {
  if (!path.startsWith('/api/')) {
    const res = await fetch(path, { headers: { Accept: 'application/json' } })
    const text = await res.text()
    let data: unknown
    try {
      data = text ? (JSON.parse(text) as unknown) : undefined
    } catch {
      data = text
    }
    return { status: res.status, data }
  }
  const state = await demoState()
  return handleWith(state, method, path, body)
}
