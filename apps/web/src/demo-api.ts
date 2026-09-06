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
import { FixtureAdapter, ScreenSpecShape, assemblePrompt, assembleRevisionPrompt, type PainPointDraftResult } from './browser-run/deps.js'
import { findAsisSample, loadAsisSamples, type AsisSampleTarget } from './asis-samples.js'
import { buildContext, draftRevisionPromptInBrowser, engineNote, engineOf, revisionInstruction, runBrowserPipeline, type PipelineInput } from './browser-run/pipeline.js'
import { browserRuntime, toJobFailure } from './browser-run/runtime.js'
import { buildExportBundle } from './browser-run/export-bundle.js'
import { registerArtifactHtml, type BrowserApprovalRecord, type BrowserIaNodeRecord, type BrowserRevisionRecord, type BrowserScreenRecord, type BrowserStore } from './browser-run/store.js'
import { demoIaNode, demoIssueId, demoPatchIaNode, demoRelabelId, demoRtm } from './demo-rtm.js'
import { nextScreenExternalId } from './simple-flow.js'
import { DEMO_BASE } from './demo-mode.js'
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
  Reference,
  Requirement,
  RevisionDetail,
  RevisionListItem,
  RevisionPromptDraft,
  Screen,
  ScreenDetail,
  ScreenSpecLike,
  SliceGenerationRequest,
} from './types.js'

// ---------------------------------------------------------------- 상수·문구

/** AS-IS 분석: 대기 → 실행 중 → 실패 로 넘어가는 시점. */
export const DEMO_ASIS_QUEUED_MS = 1200
export const DEMO_ASIS_RUNNING_MS = 3600

export const DEMO_ASIS_FAILURE_MESSAGE = '브라우저에서는 다른 사이트를 캡처할 수 없습니다. AS-IS 분석은 서버 실행(`pnpm serve`)에서 동작합니다.'
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
  /** AS-IS 샘플 대상 (미리 분석해 둔 합성 대상). 없으면 빈 배열 — 없는 대상을 지어내지 않는다. */
  asis_samples: AsisSampleTarget[]
  approval: DemoApprovalFile
}

interface DemoAsisRun {
  id: string
  started_ms: number
  summary: AsisAnalysisSummary
  /** 미리 분석해 둔 샘플 대상이면 그 기록. 없으면 이 브라우저가 캡처할 수 없는 대상이다. */
  sample?: AsisSampleTarget
  /** 지금 이 브라우저에서 규칙으로 만든 페인포인트 초안 (준비되면 채워진다). */
  draft?: PainPointDraftResult
  /** 초안 만들기에 실패한 이유 (성공으로 위장하지 않는다). */
  draft_error?: string
}

export interface DemoState {
  /** 경로 → GET 응답. 데모에서 만든 작업·분석도 여기에 등록해 폴링이 그대로 동작한다. */
  gets: Map<string, unknown>
  /** 브라우저에서 만든 화면에 붙인 예시 더미데이터 (fixture_id → 행). 스냅샷에는 더미데이터가 없어 여기서 채운다. */
  extra_dummy: Record<string, unknown[]>
  files: DemoFiles
  analyses: Map<string, DemoAsisRun>
  /** IA 노드 문서 revision (낙관적 잠금). 스냅샷 노드는 1 에서 시작하고 발번·연결마다 오른다. */
  ia_revisions: Map<string, number>
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

/**
 * `/api/meta` — 자격 증명이 없으면 스냅샷 그대로(fixture 더미), 있으면 브라우저에서 실제 호출하는 상태를 알린다.
 * 브라우저에서는 Playwright 를 띄울 수 없으므로 playwright 는 항상 false 다.
 */
export function metaOf(state: DemoState): Meta {
  const snapshot = state.gets.get('/api/meta') as Meta | undefined
  // 스냅샷의 meta 는 서버에서 찍힌 것이라 playwright:true 일 수 있다. 브라우저에서는 V3 를 돌릴 수 없으므로 항상 false 로 덮는다.
  const base: Meta = { ...(snapshot ?? { adapter: 'fixture', model: 'fixture', version: '0.0.0' }), playwright: false }
  const cred = browserRuntime.credential()
  if (!cred) return base
  return { ...base, adapter: 'anthropic', model: browserRuntime.model, auth: cred.kind, playwright: false }
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

export function createDemoState(files: DemoFiles, opts: { now?: () => number; store?: BrowserStore } = {}): DemoState {
  const gets = new Map<string, unknown>()
  for (const [path, value] of Object.entries(clone(files.snapshot))) gets.set(path, value)
  const state: DemoState = {
    gets,
    extra_dummy: {},
    files: clone(files),
    analyses: new Map(),
    ia_revisions: new Map(),
    seq: 0,
    now: opts.now ?? (() => Date.now()),
  }
  // 스냅샷을 초기 상태로 두고, 이 브라우저에 쌓인 결과(생성 revision·코멘트·승인)를 그 위에 얹는다.
  applyBrowserOverlay(state, opts.store ?? browserRuntime.store)
  return state
}

function nextId(state: DemoState, prefix: string): string {
  state.seq += 1
  return `demo-${prefix}-${state.seq}`
}

// ---------------------------------------------------------------- 진행 중 작업·분석

/**
 * 대기 → 실행 중 → (샘플 대상이면) 성공 / (그 밖이면) 실패.
 *
 * 임의 URL 은 브라우저가 캡처할 수 없으므로 **성공으로 끝내지 않는다**.
 * 미리 분석해 둔 샘플 대상만 구조·스크린샷을 붙이고, 페인포인트는 지금 이 브라우저가 만든 초안을 넣는다.
 */
function advanceAsis(state: DemoState, run: DemoAsisRun): AsisAnalysis {
  const doc = state.gets.get(`/api/asis-analyses/${run.id}`) as AsisAnalysis
  if (doc.status === 'failed' || doc.status === 'succeeded') return doc
  const elapsed = state.now() - run.started_ms
  if (elapsed < DEMO_ASIS_QUEUED_MS) doc.status = 'queued'
  else if (elapsed < DEMO_ASIS_RUNNING_MS) doc.status = 'running'
  else if (run.sample === undefined) {
    doc.status = 'failed'
    doc.failure = { code: 'browser', message: DEMO_ASIS_FAILURE_MESSAGE }
    doc.finished_at = new Date(run.started_ms + DEMO_ASIS_RUNNING_MS).toISOString()
  } else if (run.draft_error !== undefined) {
    doc.status = 'failed'
    doc.failure = { code: 'internal', message: `페인포인트 초안을 만들지 못했습니다: ${run.draft_error}` }
    doc.finished_at = nowIso(state)
  } else if (run.draft !== undefined) {
    doc.status = 'succeeded'
    doc.structure = run.sample.structure
    doc.screenshots = run.sample.screenshots
    doc.summary = run.draft.summary
    doc.pain_points = run.draft.pain_points.map((p, i) => ({ ...p, id: `PP-${String(i + 1).padStart(3, '0')}`, status: 'proposed' as const }))
    doc.finished_at = nowIso(state)
    run.summary.pain_point_count = doc.pain_points.length
  } else {
    // 초안이 아직 안 끝났다 — 끝날 때까지 running 이다 (미완성을 성공으로 바꾸지 않는다).
    doc.status = 'running'
  }
  run.summary.status = doc.status
  if (doc.finished_at !== undefined) run.summary.finished_at = doc.finished_at
  return doc
}

// ---------------------------------------------------------------- GET

function handleGet(state: DemoState, path: string): DemoResponse {
  // 진행 중인 분석은 어느 GET 에서든 시간에 맞춰 진행시킨다
  // (목록 폴링만 하는 화면에서도 상태가 바뀌어야 하므로 상세 조회에 의존하지 않는다).
  // 생성 작업은 실제 파이프라인이 단계마다 job 문서를 직접 갱신하므로 여기서 진행시키지 않는다.
  for (const run of state.analyses.values()) advanceAsis(state, run)

  if (path === '/api/meta') return { status: 200, data: metaOf(state) }
  // 추적 체인·IA 노드는 스냅샷에 저장된 응답이 아니라 지금 상태에서 계산·조회한다.
  let m = /^\/api\/projects\/([^/]+)\/rtm$/.exec(path)
  if (m) return demoRtm(state, m[1] ?? '')
  m = /^\/api\/ia-nodes\/([^/]+)$/.exec(path)
  if (m) return demoIaNode(state, m[1] ?? '')
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

async function approve(state: DemoState, screenId: string, body: unknown): Promise<DemoResponse> {
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
  if (isBrowserRevision(revisionId)) {
    // 브라우저에서 만든 revision — 필수 검사(V3)가 미실행이라 승인 게이트를 통과할 수 없다.
    // 실행하지 않은 검사를 통과로 바꾸지 않는다 (CLAUDE.md). 대신 완료 화면에서 산출물을 파일로 내려받는다.
    for (const r of browserApprovalReasons(revision)) reasons.push(r)
  } else {
    const captured = state.files.approval
    if (screenId !== captured.screen_id || revisionId !== captured.revision_id) {
      reasons.push({ code: 'demo.export_not_captured', message: DEMO_EXPORT_NOT_CAPTURED_MESSAGE })
    }
  }
  if (reasons.length > 0) return { status: 400, data: { error: 'approval_rejected', reasons } }

  const approvedAt = nowIso(state)
  const response = isBrowserRevision(revisionId)
    ? await browserApprovalResponse(state, screenId, revisionId, approver.trim(), approvedAt)
    : clone(state.files.approval.response)

  // 메모리에서 실제로 승인 상태를 반영한다 (홈 목록·완료 화면이 그대로 살아 있게).
  markApproved(state, screenId, revisionId, response.version)
  browserRuntime.store.setApproval({
    screen_id: screenId,
    revision_id: revisionId,
    artifact_hash: revision?.artifact.content_hash ?? target.artifact_hash,
    approved_by: approver.trim(),
    approved_at: approvedAt,
    version: response.version,
  })
  return { status: 200, data: response }
}

/**
 * 브라우저에서 만든 revision 의 승인 응답 — 산출물 6개 파일을 **실제로 만들어** 그 목록·해시를 돌려준다.
 * 서버 폴더에 쓰지 않으므로 `export_path` 에 그 사실을 그대로 적는다 (없는 폴더 경로를 지어내지 않는다).
 */
async function browserApprovalResponse(state: DemoState, screenId: string, revisionId: string, approver: string, approvedAt: string): Promise<ApprovalResponse> {
  const record = browserRuntime.store.load().revisions.find((r) => r.revision.id === revisionId)
  if (!record) throw new Error(`브라우저 revision 을 찾을 수 없습니다: ${revisionId}`)
  const detail = revisionDetail(state, revisionId)
  const project = projectDetailFor(state, record.project_id)
  const projectRecord = (project?.project ?? {}) as unknown as Record<string, unknown>
  const files = await buildExportBundle({
    record,
    project: {
      id: record.project_id,
      name: project?.project.name ?? '(프로젝트 미상)',
      ...(typeof projectRecord['slug'] === 'string' ? { slug: projectRecord['slug'] as string } : {}),
    },
    requirements: project?.requirements ?? [],
    comments: detail?.comments ?? [],
    generated_at: approvedAt,
    approval: { version: '1.0', approved_by: approver, approved_at: approvedAt },
  })
  return {
    approval: {
      id: nextId(state, 'approval'),
      artifact_id: record.artifact.id,
      artifact_hash: record.artifact.content_hash,
      approved_by: approver,
      approved_at: approvedAt,
    },
    version: '1.0',
    export_path: BROWSER_APPROVAL_NOT_SHARED_NOTE,
    files: files.map((f) => ({ path: f.path, sha256: f.sha256 })),
  }
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
  const id = nextId(state, 'asis')
  const created = nowIso(state)
  const sample = findAsisSample(state.files.asis_samples, url.trim())
  const doc: AsisAnalysis = {
    id,
    project_id: projectId,
    url: url.trim(),
    status: 'queued',
    // 페인포인트 초안은 언제나 더미 어댑터(fixture) 규칙으로 만든다 — 자격 증명이 있어도 그렇다. 그대로 적는다.
    adapter: 'fixture',
    model: 'fixture',
    created_at: created,
    pain_points: [],
    revision: 1,
  }
  if (isNonEmpty(note)) doc.note = note.trim()
  const summary: AsisAnalysisSummary = { id, url: doc.url, status: 'queued', created_at: created, pain_point_count: 0 }
  state.gets.set(`/api/asis-analyses/${id}`, doc)
  list.push(summary)
  const run: DemoAsisRun = { id, started_ms: state.now(), summary, ...(sample ? { sample } : {}) }
  state.analyses.set(id, run)
  if (sample) {
    // 규칙을 지금 실제로 돌린다 (서버 `MODEL_ADAPTER=fixture` 와 같은 클래스).
    void new FixtureAdapter()
      .draftPainPoints({ url: sample.url, structure: sample.structure, ...(doc.note === undefined ? {} : { note: doc.note }) })
      .then((draft) => {
        run.draft = draft
      })
      .catch((e: unknown) => {
        run.draft_error = e instanceof Error ? e.message : String(e)
      })
  }
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

// ---------------------------------------------------------------- 브라우저 모드 (내 토큰으로 실제 호출)

export const BROWSER_APPROVAL_NOT_SHARED_NOTE =
  '이 승인은 이 브라우저에만 기록됩니다. 팀이 함께 쓰는 이관 폴더(`exports/…`)는 서버 실행(`pnpm serve`)에서 만듭니다 — 여기서는 산출물 6개 파일을 내려받아 넘깁니다.'

/** 승인 상태를 메모리에 반영한다 (화면 목록·검토·완료 화면이 같은 상태를 본다). */
function markApproved(state: DemoState, screenId: string, revisionId: string, version: string): void {
  const detail = screenDetail(state, screenId)
  if (detail) {
    detail.screen.status = 'approved'
    detail.screen.version = version
    const target = detail.revisions.find((r) => r.id === revisionId)
    if (target) target.artifact_status = 'approved'
  }
  const revision = revisionDetail(state, revisionId)
  if (revision) revision.artifact.status = 'approved'
  for (const project of allProjectDetails(state)) {
    for (const s of project.screens) {
      if (s.id !== screenId) continue
      s.status = 'approved'
      s.version = version
    }
  }
}

/** 이 revision 이 브라우저에서 생성된 것인지. */
export function isBrowserRevision(revisionId: string): boolean {
  return browserRuntime.store.load().revisions.some((r) => r.revision.id === revisionId)
}

/**
 * 브라우저 revision 의 승인 거부 사유 — 서버 승인 게이트와 같은 규칙이다.
 * **필수 검사가 모두 pass 여야 한다.** V3 를 실제로 실행하므로 미실행·실패·오류는 그대로 거부 사유가 된다.
 */
function browserApprovalReasons(revision: RevisionDetail | undefined): Array<{ code: string; message: string }> {
  const blockers = (revision?.validation_results ?? []).filter((r) => r.required && r.status !== 'pass')
  if (blockers.length === 0) return []
  return [{ code: 'approval.required_checks', message: `필수 검사 미통과: ${blockers.map((b) => `${b.check_id}(${b.status})`).join(', ')}` }]
}

/** 스냅샷 위에 브라우저 저장 데이터를 얹는다 (생성 revision → 코멘트 → 승인 순). */
export function applyBrowserOverlay(state: DemoState, store: BrowserStore): void {
  const data = store.load()
  // 화면 → revision → 코멘트 → 제목 → 승인 순 (revision 이 화면에 붙어야 목록이 맞는다).
  for (const record of data.screens) registerBrowserScreen(state, record)
  for (const record of data.revisions) registerBrowserRevision(state, record)
  for (const [revisionId, comments] of Object.entries(data.comments)) {
    const detail = revisionDetail(state, revisionId)
    if (detail) detail.comments = comments.map((c) => ({ ...c }))
  }
  for (const [screenId, title] of Object.entries(data.titles)) applyStoredTitle(state, screenId, title)
  // ID 매핑 화면에서 사람이 발번·연결한 IA 노드 (새로고침 후에도 이어진다).
  for (const record of Object.values(data.ia_nodes)) applyStoredIaNode(state, record)
  for (const approval of Object.values(data.approvals) as BrowserApprovalRecord[]) {
    markApproved(state, approval.screen_id, approval.revision_id, approval.version)
  }
  syncCommentCounts(state)
}

/** 브라우저에서 만든 revision 을 스냅샷 상태에 등록한다 (검토·수정·완료 화면이 그대로 읽는다). */
export function registerBrowserRevision(state: DemoState, record: BrowserRevisionRecord, comments: Comment[] = []): void {
  const detail: RevisionDetail = {
    revision: record.revision,
    spec: record.spec,
    artifact: record.artifact,
    validation_results: record.validation_results,
    comments: comments.map((c) => ({ ...c })),
    element_index: record.element_index,
  }
  const existing = revisionDetail(state, record.revision.id)
  if (existing) detail.comments = existing.comments
  state.gets.set(`/api/revisions/${record.revision.id}`, detail)
  registerArtifactHtml(record.artifact.id, record.html)

  const item: RevisionListItem = {
    id: record.revision.id,
    revision_no: record.revision.revision_no,
    artifact_id: record.artifact.id,
    artifact_hash: record.artifact.content_hash,
    artifact_status: record.artifact.status,
    validation_summary: summarizeValidation(record.validation_results),
    open_comments: detail.comments.filter((c) => c.status === 'open').length,
    created_at: record.revision.created_at,
  }
  const screen = screenDetail(state, record.screen_id)
  if (screen) {
    screen.revisions = [...screen.revisions.filter((r) => r.id !== record.revision.id), item].sort((a, b) => a.revision_no - b.revision_no)
    screen.screen.current_revision_id = record.revision.id
    if (screen.screen.status !== 'approved') screen.screen.status = 'review'
  }
  for (const project of allProjectDetails(state)) {
    for (const sc of project.screens) {
      if (sc.id !== record.screen_id) continue
      sc.revision_count = screen ? screen.revisions.length : sc.revision_count + 1
      sc.current_revision_id = record.revision.id
      if (sc.status !== 'approved') sc.status = 'review'
    }
  }
}

/**
 * 스냅샷의 더미데이터 + 이 브라우저에서 만든 화면의 예시 더미데이터.
 * 어느 쪽에도 없으면 파이프라인이 빈 배열로 렌더하고 unresolved 에 남긴다 (없는 것을 있는 것처럼 꾸미지 않는다).
 */
function dummyDataOf(state: DemoState): Record<string, unknown[]> {
  const raw = (state.files.snapshot as Record<string, unknown>)['dummy_data']
  const fromSnapshot = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown[]>) : {}
  return { ...fromSnapshot, ...state.extra_dummy }
}

function projectDetailFor(state: DemoState, projectId: string): ProjectDetail | undefined {
  return state.gets.get(`/api/projects/${projectId}`) as ProjectDetail | undefined
}

function referencesFor(state: DemoState, projectId: string): Reference[] {
  const list = state.gets.get(`/api/projects/${projectId}/references`)
  return Array.isArray(list) ? (list as Reference[]) : []
}

/** 요청 하나를 파이프라인 입력으로 옮긴다 (생성 실행과 프롬프트 미리보기가 같은 문맥을 쓰도록). */
function pipelineInputFor(state: DemoState, screenId: string, body: unknown): { error: DemoResponse } | { input: PipelineInput; base: RevisionDetail | undefined } {
  // 자격 증명이 없으면 더미 어댑터(fixture)로 돈다 — 실행 자체를 막지 않는다.
  const credential = browserRuntime.credential()
  const screen = screenDetail(state, screenId)
  if (!screen) return { error: notFound('화면') }
  const project = projectDetailFor(state, screen.screen.project_id)
  if (!project) return { error: notFound('프로젝트') }

  const request = asRecord(body) as unknown as SliceGenerationRequest
  const baseId = request.base_revision_id ?? (request.task_type === 'edit' ? screen.screen.current_revision_id : undefined)
  const baseDetail = baseId ? revisionDetail(state, baseId) : undefined
  if (baseId !== undefined && !baseDetail) return { error: badRequest('reference_invalid', `기준 revision 을 찾을 수 없습니다: ${baseId}`) }
  const revisionNo = screen.revisions.reduce((max, r) => Math.max(max, r.revision_no), 0) + 1
  const projectRecord = project.project as unknown as Record<string, unknown>

  return {
    base: baseDetail,
    input: {
      request,
      ...(credential ? { credential } : {}),
      project: {
        id: project.project.id,
        name: project.project.name,
        org: project.project.org,
        profile_id: project.project.profile_id,
        slug: typeof projectRecord['slug'] === 'string' ? (projectRecord['slug'] as string) : undefined,
        baseline_id: typeof projectRecord['baseline_id'] === 'string' ? (projectRecord['baseline_id'] as string) : undefined,
      },
      screen: { id: screen.screen.id, external_id: screen.screen.external_id, title: screen.screen.title, shell: screen.screen.shell, device: request.device ?? screen.screen.device },
      requirements: project.requirements as Requirement[],
      references: referencesFor(state, project.project.id),
      ...(baseDetail ? { base_revision: { id: baseDetail.revision.id, revision_no: baseDetail.revision.revision_no, spec: baseDetail.spec } } : {}),
      comments: baseDetail?.comments ?? [],
      dummy: dummyDataOf(state),
      revision_no: revisionNo,
      model: browserRuntime.model,
    },
  }
}

/**
 * 프롬프트 미리보기 — 실제로 보낼 프롬프트를 그 자리에서 조립한다 (모델 호출 없음).
 * 스냅샷 예시가 아니라 이번 요청의 문맥이므로 "미리보기" 가 실제 실행과 어긋나지 않는다.
 */
export function browserPromptPreview(state: DemoState, screenId: string, body: unknown): DemoResponse {
  const prepared = pipelineInputFor(state, screenId, body)
  if ('error' in prepared) return prepared.error
  try {
    const { ctx, summary } = buildContext(prepared.input)
    const req = prepared.input.request
    const prompt = req.task_type === 'edit' ? assembleRevisionPrompt(ctx, revisionInstruction(req)) : assemblePrompt(req, ctx)
    const preview: PromptPreviewResponse = { prompt: { ...prompt, context_summary: summary }, context_summary: summary }
    return { status: 200, data: preview }
  } catch (e) {
    const failure = toJobFailure(e, 'context_build')
    return badRequest(failure.code, failure.message, { details: failure.details ?? [] })
  }
}

/**
 * 실제 생성 작업 — 202 로 job_id 를 돌려주고 파이프라인은 뒤에서 돈다.
 * 단계마다 job 문서를 갱신하므로 기존 작업 상태 패널(2초 폴링)이 그대로 동작한다.
 */
export function browserCreateJob(state: DemoState, screenId: string, body: unknown): DemoResponse {
  const prepared = pipelineInputFor(state, screenId, body)
  if ('error' in prepared) return prepared.error
  const { input: pipelineInput, base: baseDetail } = prepared
  const request = pipelineInput.request
  const id = nextId(state, 'job')
  const created = nowIso(state)
  const engine = engineOf(pipelineInput)
  const model = engine.model
  const job: Job = {
    id,
    status: 'queued',
    current_stage: 'context_build',
    stage: 'context_build',
    adapter: engine.adapter,
    model,
    job_type: typeof request.task_type === 'string' ? request.task_type : 'create',
    screen_plan_id: screenId,
    request,
    attempt: 1,
    max_attempts: 1,
    created_at: created,
    started_at: created,
    context_summary: [engineNote(engine)],
  }
  state.gets.set(`/api/jobs/${id}`, job)

  void (async () => {
    try {
      const result = await runBrowserPipeline(pipelineInput, {
        fetch: browserRuntime.fetch,
        now: browserRuntime.now,
        newId: browserRuntime.newId,
        runV3: browserRuntime.runV3,
        onStage: (stage) => {
          job.status = 'running'
          job.current_stage = stage
          job.stage = stage
        },
      })
      result.record.revision.job_id = id
      registerBrowserRevision(state, result.record)
      const saved = browserRuntime.store.addRevision(result.record)
      resolveEditedComments(state, request, baseDetail, result.record.revision.id)
      syncCommentCounts(state)
      job.status = 'succeeded'
      job.current_stage = 'persist'
      job.stage = 'persist'
      job.finished_at = browserRuntime.now()
      job.result = { revision_id: result.record.revision.id, artifact_id: result.record.artifact.id }
      job.prompt_text = `[system]\n${result.prompt.system}\n\n[user]\n${result.prompt.user}`
      job.context_summary = [
        ...result.context_summary,
        // 더미 어댑터는 토큰을 쓰지 않는다 — 0 토큰을 «사용량» 인 것처럼 적지 않는다.
        result.usage
          ? `모델 사용량: 입력 ${result.usage.input_tokens} · 출력 ${result.usage.output_tokens} 토큰`
          : '모델을 호출하지 않았습니다 (더미 어댑터) — 토큰 사용량 없음',
        saved ? '결과를 이 브라우저(localStorage)에 저장했습니다' : `브라우저 저장 실패: ${browserRuntime.store.lastError ?? '원인 미상'}`,
      ]
    } catch (e) {
      job.status = 'failed'
      job.finished_at = browserRuntime.now()
      job.failure = toJobFailure(e, job.current_stage ?? 'context_build')
    }
  })()

  return { status: 202, data: { job_id: id } }
}

/** edit 작업이 성공하면 반영한 코멘트를 이 revision 으로 해결 표시한다 (서버 파이프라인과 같다). */
function resolveEditedComments(state: DemoState, request: SliceGenerationRequest, base: RevisionDetail | undefined, revisionId: string): void {
  if (request.task_type !== 'edit' || !base) return
  let changed = false
  for (const id of request.comment_ids ?? []) {
    const comment = base.comments.find((c) => c.id === id)
    if (!comment) continue
    comment.status = 'resolved'
    comment.resolved_by_revision_id = revisionId
    comment.revision = (comment.revision ?? 1) + 1
    changed = true
  }
  if (changed) browserRuntime.store.setComments(base.revision.id, base.comments)
}

/**
 * 수정 프롬프트 초안 (검토 화면의 "AI 수정 프롬프트 생성").
 * 자격 증명이 있으면 실제 모델, 없으면 서버와 같은 더미 어댑터(fixture)의 규칙으로 만든다 — 둘 다 실제로 실행된다.
 */
export async function browserRevisionPrompt(state: DemoState, revisionId: string, body: unknown): Promise<DemoResponse> {
  const credential = browserRuntime.credential()
  const detail = revisionDetail(state, revisionId)
  if (!detail) return notFound('revision')
  const ids = asRecord(body)['comment_ids']
  if (!Array.isArray(ids) || ids.length === 0) {
    return badRequest('invalid_request', '요청 본문이 올바르지 않습니다', { issues: ['코멘트를 최소 1개 골라야 합니다'] })
  }
  const screen = screenDetail(state, detail.revision.screen_id)
  const project = screen ? projectDetailFor(state, screen.screen.project_id) : undefined
  const wanted = new Set(ids.map(String))
  const picked = detail.comments.filter((c) => wanted.has(c.id))
  if (picked.length === 0) return badRequest('reference_invalid', '고른 코멘트를 이 revision 에서 찾을 수 없습니다')
  try {
    if (!credential) return { status: 200, data: await fixtureRevisionPrompt(detail, screen, project, picked) }
    const draft = await draftRevisionPromptInBrowser(
      {
        credential,
        project: { name: project?.project.name ?? '(프로젝트 미상)' },
        screen: { external_id: screen?.screen.external_id ?? '(화면 미상)', title: screen?.screen.title ?? '' },
        spec: detail.spec,
        comments: picked,
        model: browserRuntime.model,
      },
      { fetch: browserRuntime.fetch },
    )
    const result: RevisionPromptDraft = { prompt: draft.prompt, rationale: draft.rationale, adapter: 'anthropic' }
    return { status: 200, data: result }
  } catch (e) {
    return badRequest('model_error', `수정 프롬프트 초안 생성에 실패했습니다: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/**
 * 더미 어댑터의 수정 프롬프트 초안 — 서버의 `MODEL_ADAPTER=fixture` 와 같은 클래스가 만든다.
 * 명세를 읽지 못하면 지어내지 않고 실패로 알린다.
 */
async function fixtureRevisionPrompt(
  detail: RevisionDetail,
  screen: ScreenDetail | undefined,
  project: ProjectDetail | undefined,
  comments: Comment[],
): Promise<RevisionPromptDraft> {
  const parsed = ScreenSpecShape.safeParse(detail.spec)
  if (!parsed.success) throw new Error('이 revision 의 화면명세를 읽지 못했습니다 (스키마 불일치)')
  const ctx = {
    project: { name: project?.project.name ?? '(프로젝트 미상)', org: project?.project.org ?? '', profile_id: project?.project.profile_id ?? '' },
    screen: {
      external_id: screen?.screen.external_id ?? parsed.data.screen_id,
      title: screen?.screen.title ?? '',
      shell: screen?.screen.shell ?? parsed.data.shell,
      device: parsed.data.device,
    },
    requirements: [],
    references: [],
    profile_rules: [],
    baseline_id: parsed.data.baseline_id,
    comments: comments.map((c) => ({
      id: c.id,
      role: c.role,
      author: c.author,
      text: c.text,
      target: c.target,
      ...(c.element_id === undefined ? {} : { element_id: c.element_id }),
      ...(c.case_id === undefined ? {} : { case_id: c.case_id }),
    })),
  }
  const draft = await new FixtureAdapter().draftRevisionPrompt({ ctx, current: parsed.data, comments: ctx.comments })
  return { prompt: draft.prompt, rationale: draft.rationale, adapter: 'fixture' }
}

// ---------------------------------------------------------------- 화면 만들기 (한 줄 입력 흐름)

/** 새 화면에 붙일 예시 더미데이터의 CASE 별 행 수 (정상 5행, 검색 결과 1행, 나머지는 0행). */
const SAMPLE_FIXTURE_PLAN: ReadonlyArray<{ suffix: string; rows: number }> = [
  { suffix: 'normal', rows: 5 },
  { suffix: 'searched', rows: 1 },
  { suffix: 'empty', rows: 0 },
  { suffix: 'error', rows: 0 },
  { suffix: 'permission', rows: 5 },
  { suffix: 'processing', rows: 0 },
]

interface ColumnLike {
  id: string
  label?: string
  format?: string
}

/** 레퍼런스 명세의 첫 표에서 열 목록을 꺼낸다 (표가 없으면 빈 배열). */
export function columnsOfSpec(spec: ScreenSpecLike | undefined): ColumnLike[] {
  for (const section of spec?.sections ?? []) {
    for (const el of section.elements ?? []) {
      const columns = (el as unknown as Record<string, unknown>)['columns']
      if (!Array.isArray(columns)) continue
      const out: ColumnLike[] = []
      for (const c of columns) {
        if (typeof c !== 'object' || c === null) continue
        const rec = c as Record<string, unknown>
        if (typeof rec['id'] !== 'string') continue
        const col: ColumnLike = { id: rec['id'] }
        if (typeof rec['label'] === 'string') col.label = rec['label']
        if (typeof rec['format'] === 'string') col.format = rec['format']
        out.push(col)
      }
      if (out.length > 0) return out
    }
  }
  return []
}

/** 열 구성에 맞는 예시 행. 값은 합성 예시이며 실제 업무 데이터가 아니다 (렌더러가 "더미데이터" 로 표시한다). */
export function sampleRows(columns: readonly ColumnLike[], count: number): Record<string, unknown>[] {
  const statuses = ['요청', '검토', '승인', '반려', '완료']
  const rows: Record<string, unknown>[] = []
  for (let i = 0; i < count; i += 1) {
    const row: Record<string, unknown> = {}
    for (const c of columns) {
      const label = c.label ?? c.id
      switch (c.format) {
        case 'number':
          row[c.id] = (i + 1) * 3
          break
        case 'currency':
          row[c.id] = (i + 1) * 120000
          break
        case 'date':
        case 'datetime':
          row[c.id] = `2026-09-${String(20 - i).padStart(2, '0')}`
          break
        case 'status':
          row[c.id] = statuses[i % statuses.length]
          break
        default:
          row[c.id] = `예시 ${label} ${i + 1}`
      }
    }
    rows.push(row)
  }
  return rows
}

/** 새 화면에 붙일 fixture 묶음 (`<외부 ID>-<CASE>`). 레퍼런스 열 구성을 그대로 쓴다. */
export function sampleDummyFor(externalId: string, reference: Reference | undefined): Record<string, unknown[]> {
  const columns = columnsOfSpec(reference?.spec)
  if (columns.length === 0) return {}
  const out: Record<string, unknown[]> = {}
  for (const plan of SAMPLE_FIXTURE_PLAN) out[`${externalId}-${plan.suffix}`] = sampleRows(columns, plan.rows)
  return out
}

/** 만든 화면을 데모 상태에 등록한다 (프로젝트 목록·화면 상세·예시 더미데이터). */
function registerBrowserScreen(state: DemoState, record: BrowserScreenRecord): void {
  const screen = record.screen
  const existing = screenDetail(state, screen.id)
  state.gets.set(`/api/screens/${screen.id}`, { screen: { ...screen }, revisions: existing?.revisions ?? [] } satisfies ScreenDetail)
  Object.assign(state.extra_dummy, record.dummy)
  const project = projectDetailFor(state, screen.project_id)
  if (project && !project.screens.some((s) => s.id === screen.id)) {
    project.screens.push({
      id: screen.id,
      external_id: screen.external_id,
      title: screen.title,
      status: screen.status,
      revision_count: existing?.revisions.length ?? 0,
      open_comments: 0,
      shell: screen.shell,
      device: screen.device,
      ...(screen.current_revision_id ? { current_revision_id: screen.current_revision_id } : {}),
    })
  }
}

/**
 * 저장해 둔 IA 노드(요구사항 연결·기능 정의·ID 발번)를 스냅샷 위에 얹는다.
 * 스냅샷에 없는 노드는 무시한다 — 저장 데이터가 스냅샷보다 오래돼 없는 노드를 되살리지 않는다.
 */
function applyStoredIaNode(state: DemoState, record: BrowserIaNodeRecord): void {
  for (const project of allProjectDetails(state)) {
    const index = project.ia_nodes.findIndex((n) => n.id === record.node.id)
    if (index === -1) continue
    project.ia_nodes[index] = record.node
    state.ia_revisions.set(record.node.id, record.revision)
    return
  }
}

/** 저장해 둔 제목을 화면 상세·프로젝트 목록에 반영한다. */
function applyStoredTitle(state: DemoState, screenId: string, title: string): void {
  const detail = screenDetail(state, screenId)
  if (detail) detail.screen.title = title
  for (const project of allProjectDetails(state)) {
    for (const s of project.screens) if (s.id === screenId) s.title = title
  }
}

/** POST /api/projects/:id/screens — 서버와 같은 규칙(외부 ID 자동 부여·레퍼런스 예시 데이터 복제)으로 화면을 만든다. */
export function createScreen(state: DemoState, projectId: string, body: unknown): DemoResponse {
  const project = projectDetailFor(state, projectId)
  if (!project) return notFound('프로젝트')
  const b = asRecord(body)
  const title = b['title']
  if (!isNonEmpty(title)) return badRequest('invalid_request', '요청 본문이 올바르지 않습니다', { issues: ['title 은 빈 문자열일 수 없습니다'] })
  const device = b['device'] === 'mobile' ? 'mobile' : 'desktop'
  const shellRaw = b['shell']
  const shell = isNonEmpty(shellRaw) ? shellRaw.trim() : 'partner-page'
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:page|popup)$/.test(shell)) {
    return badRequest('invalid_request', '요청 본문이 올바르지 않습니다', { issues: ['shell 은 `<포털>-page` 또는 `<포털>-popup` 형식이어야 합니다'] })
  }
  const sampleFrom = b['sample_from']
  const references = referencesFor(state, projectId)
  const reference = isNonEmpty(sampleFrom) ? references.find((r) => r.id === sampleFrom) : undefined
  if (isNonEmpty(sampleFrom) && !reference) return badRequest('reference_invalid', `참고 레퍼런스를 찾을 수 없습니다: ${sampleFrom}`)

  const externalId = nextScreenExternalId(project.screens.map((s) => s.external_id))
  const screen: Screen = {
    id: nextId(state, 'screen'),
    project_id: projectId,
    external_id: externalId,
    title: title.trim(),
    shell,
    device,
    status: 'draft',
    aliases: [],
  }
  const record: BrowserScreenRecord = { screen, dummy: sampleDummyFor(externalId, reference) }
  registerBrowserScreen(state, record)
  browserRuntime.store.addScreen(record)
  return { status: 201, data: { screen, sample_fixtures: Object.keys(record.dummy) } }
}

/** PATCH /api/screens/:id — 제목만 바꾼다 (외부 ID·별칭은 그대로). */
export function patchScreen(state: DemoState, screenId: string, body: unknown): DemoResponse {
  const detail = screenDetail(state, screenId)
  if (!detail) return notFound('화면')
  const title = asRecord(body)['title']
  if (!isNonEmpty(title)) return badRequest('invalid_request', '요청 본문이 올바르지 않습니다', { issues: ['title 은 빈 문자열일 수 없습니다'] })
  applyStoredTitle(state, screenId, title.trim())
  browserRuntime.store.setTitle(screenId, title.trim())
  return { status: 200, data: detail.screen }
}

// ---------------------------------------------------------------- 라우팅

/** 스냅샷 상태를 받아 요청 하나를 처리한다 (테스트에서 직접 쓴다). */
export function handleWith(state: DemoState, method: string, path: string, body?: unknown): DemoResponse {
  if (method === 'GET') return handleGet(state, path)

  if (method === 'POST') {
    // 프롬프트 조립·생성은 언제나 실제로 돈다 (자격 증명이 없으면 더미 어댑터).
    let m = /^\/api\/screens\/([^/]+)\/prompt-preview$/.exec(path)
    if (m) return browserPromptPreview(state, m[1] ?? '', body)
    m = /^\/api\/screens\/([^/]+)\/generation-jobs$/.exec(path)
    if (m) return browserCreateJob(state, m[1] ?? '', body)
    m = /^\/api\/revisions\/([^/]+)\/comments$/.exec(path)
    if (m) return createComment(state, m[1] ?? '', body)
    m = /^\/api\/artifacts\/([^/]+)\/validations$/.exec(path)
    if (m) return revalidate(state, m[1] ?? '')
    m = /^\/api\/projects\/([^/]+)\/asis-analyses$/.exec(path)
    if (m) return createAsisAnalysis(state, m[1] ?? '', body)
    m = /^\/api\/projects\/([^/]+)\/screens$/.exec(path)
    if (m) return createScreen(state, m[1] ?? '', body)
    m = /^\/api\/ia-nodes\/([^/]+)\/id-issuances$/.exec(path)
    if (m) return demoIssueId(state, m[1] ?? '', body)
    m = /^\/api\/ia-nodes\/([^/]+)\/id-relabels$/.exec(path)
    if (m) return demoRelabelId(state, m[1] ?? '', body)
  }

  if (method === 'PATCH') {
    let m = /^\/api\/comments\/([^/]+)$/.exec(path)
    if (m) return patchComment(state, m[1] ?? '', body)
    m = /^\/api\/screens\/([^/]+)$/.exec(path)
    if (m) return patchScreen(state, m[1] ?? '', body)
    m = /^\/api\/asis-analyses\/([^/]+)\/pain-points\/([^/]+)$/.exec(path)
    if (m) return patchPainPoint(state, m[1] ?? '', m[2] ?? '', body)
    m = /^\/api\/ia-nodes\/([^/]+)$/.exec(path)
    if (m) return demoPatchIaNode(state, m[1] ?? '', body)
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
  // 프롬프트 미리보기·수정 초안은 저장된 예시가 아니라 그 자리에서 실제로 조립하므로 더 이상 읽지 않는다.
  const [snapshot, approval, samples] = await Promise.all([fetchJson('snapshot.json'), fetchJson('approval.json'), loadAsisSamples()])
  return { snapshot: snapshot as Record<string, unknown>, approval: approval as DemoApprovalFile, asis_samples: samples }
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

/** 비동기 처리가 필요한 요청만 여기서 받고, 나머지는 handleWith 가 그대로 처리한다. */
export async function handleAsyncWith(state: DemoState, method: string, path: string, body?: unknown): Promise<DemoResponse> {
  if (method === 'POST') {
    // 비동기인 것: 수정 프롬프트 초안(더미 어댑터도 Promise), 완료 승인(산출물 파일을 실제로 만든다).
    const draft = /^\/api\/revisions\/([^/]+)\/revision-prompt$/.exec(path)
    if (draft) return await browserRevisionPrompt(state, draft[1] ?? '', body)
    const approval = /^\/api\/screens\/([^/]+)\/approvals$/.exec(path)
    if (approval) return await approve(state, approval[1] ?? '', body)
  }
  return handleWith(state, method, path, body)
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
  return handleAsyncWith(state, method, path, body)
}
