/**
 * API 통합 테스트 — Hono `app.request` 로 메모리 DB + 시드 + 가짜 어댑터·렌더러·검증기·프롬프트 조립기를 주입한다.
 * 흐름: 프로젝트 조회 → prompt-preview → 생성 작업 → 완료 대기 → revision 조회 → HTML(CSP) → 코멘트 → revision-prompt → edit 작업 →
 *       코멘트 resolved → 승인 성공(임시 EXPORT_DIR) → manifest·trace 파일 → /exports 정적 제공. 검증 fail·차단 코멘트 open 이면 승인 400.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AdapterResult, ModelAdapter } from '@con-ai/model-adapter'
import type { GenerationContext } from '@con-ai/prompt-templates'
import type { RenderInput, RenderOutput } from '@con-ai/renderer'
import { GenerationJob, type ScreenSpecInput, type ValidationResult } from '@con-ai/schemas'
import { sha256, type JobDocument, type PromptAssembler } from '@con-ai/worker-generation'
import { ARTIFACT_HTML_CSP, HUMAN_REVIEW_CHECK_ID, createApp, type ConAiApp } from './app.js'
import type { ExportManifest, TraceDocument } from './export.js'
import { SEED, goldenCreatePopupSpec, goldenDetailSpec, goldenListSpec, seedIfEmpty } from './seed.js'
import { SqliteStore } from './store.js'

// ---------- 가짜 의존성 ----------

const REQUIRED = ['V1.schema', 'V1.references', 'V2.shell']

let idSeq = 0
const newId = (): string => `c0000000-0000-4000-8000-${String(++idSeq).padStart(12, '0')}`
let clock = 0
const now = (): string => new Date(Date.UTC(2026, 8, 5, 10, 0, ++clock)).toISOString()

/** 시드 골든 명세를 대상 화면 ID·기준 버전으로 바꿔 돌려주는 가짜 어댑터 (fixture 어댑터의 최소 흉내). */
function specFor(ctx: GenerationContext): ScreenSpecInput {
  const id = ctx.screen.external_id
  if (id.endsWith('detail')) return goldenDetailSpec(id, ctx.baseline_id, id, 'SAMPLE-quote-list')
  if (id.endsWith('popup')) return goldenCreatePopupSpec(id, ctx.baseline_id, id)
  return goldenListSpec(id, ctx.baseline_id, id, 'SAMPLE-quote-detail', 'SAMPLE-quote-create-popup')
}

function fakeAdapter(): ModelAdapter & { calls: string[] } {
  const calls: string[] = []
  return {
    kind: 'fixture',
    model: 'fixture',
    auth: 'none',
    calls,
    async generateSpec({ ctx }): Promise<AdapterResult> {
      calls.push(`generate:${ctx.screen.external_id}`)
      return { output: { screen_spec: specFor(ctx), trace_proposals: [], unresolved: [], change_summary: { summary: `${ctx.screen.external_id} 신규 생성` } } }
    },
    async reviseSpec({ current, ctx }): Promise<AdapterResult> {
      calls.push(`revise:${ctx.screen.external_id}:${(ctx.comments ?? []).length}`)
      const next = structuredClone(current) as ScreenSpecInput
      // 코멘트 문장을 반영한 것처럼 첫 검색 요소 라벨을 바꾼다.
      const first = next.sections[0]?.elements[0]
      if (first) first.label = '견적번호(수정)'
      return { output: { screen_spec: next, trace_proposals: [], unresolved: [], change_summary: { summary: '코멘트 반영: 라벨 변경', changed_ids: first ? [first.id] : [] } } }
    },
    async draftRevisionPrompt({ comments }) {
      return { prompt: `다음 코멘트를 반영해 수정: ${comments.map((c) => c.text).join(' / ')}`, rationale: `${comments.length}건의 코멘트를 요약했다` }
    },
    // 계약 §12 (AS-IS) — 이 통합 테스트는 asis 를 실행하지 않지만 ModelAdapter 인터페이스가 요구한다 (asis 통합은 asis.test.ts).
    async draftPainPoints() {
      return { summary: '가짜 요약', pain_points: [] }
    },
  }
}

const fakeAssembler: PromptAssembler = {
  assemblePrompt: (req, ctx) => ({ system: `[system] ${ctx.project.name}`, user: `[user] ${ctx.screen.external_id} ${req.purpose}`, template_version: 'fake-v1', context_summary: [`요구사항 ${ctx.requirements.length}건`] }),
  assembleRevisionPrompt: (ctx, instruction) => ({ system: `[system-rev] ${ctx.project.name}`, user: `[user-rev] ${instruction}`, template_version: 'fake-v1-rev', context_summary: [] }),
}

function fakeRender(input: RenderInput): RenderOutput {
  const index: RenderOutput['element_index'] = []
  const parts: string[] = []
  for (const section of input.spec.sections) {
    for (const el of section.elements) {
      const display_no = `${section.display_no ?? ''}-${el.display_no ?? ''}`
      index.push({ element_id: el.id, section_id: section.id, display_no })
      parts.push(`<div data-element-id="${el.id}" data-section-id="${section.id}" data-display-no="${display_no}">${el.label}</div>`)
    }
  }
  const dummy = Object.entries(input.dummy).map(([k, rows]) => `${k}=${rows.length}`).join(';')
  return {
    html: `<!doctype html><html><body><div class="root-shell"><div class="screen-wrap" data-screen="${input.spec.screen_id}" data-rev="${input.meta.revision_label}">${parts.join('')}</div><aside id="right-panel">${dummy}</aside></div></body></html>`,
    description: { screen_id: input.spec.screen_id, title: input.meta.screen_title, sections: [] },
    element_index: index,
  }
}

type ValidateMode = 'pass' | 'fail'
function makeValidate(mode: { current: ValidateMode }) {
  return async ({ artifact_hash }: { artifact_hash: string }): Promise<ValidationResult[]> =>
    REQUIRED.map((check_id, i) => {
      const fail = mode.current === 'fail' && i === REQUIRED.length - 1
      return {
        id: newId(),
        validation_run_id: 'd0000000-0000-4000-8000-000000000001',
        artifact_hash,
        check_id,
        stage: check_id.startsWith('V1') ? 'V1' : 'V2',
        status: fail ? 'fail' : 'pass',
        required: true,
        ...(fail ? { message: `${check_id} 실패 (가짜)` } : {}),
        evidence: [],
        checker_version: 'fake-1',
      } satisfies ValidationResult
    })
}

interface Harness extends ConAiApp {
  store: SqliteStore
  adapter: ReturnType<typeof fakeAdapter>
  validateMode: { current: ValidateMode }
  export_dir: string
  get: (path: string) => Promise<Response>
  post: (path: string, body?: unknown) => Promise<Response>
  patch: (path: string, body: unknown) => Promise<Response>
  runJob: (path: string, body: unknown) => Promise<JobDocument>
}

const cleanups: Array<() => void> = []
afterEach(() => {
  for (const fn of cleanups.splice(0)) fn()
})

function harness(options: { seed?: boolean; store?: SqliteStore } = {}): Harness {
  const store = options.store ?? new SqliteStore(':memory:', { now })
  if (options.seed !== false) seedIfEmpty(store, now)
  const exportDir = mkdtempSync(join(tmpdir(), 'con-ai-exports-'))
  const adapter = fakeAdapter()
  const validateMode = { current: 'pass' as ValidateMode }
  const created = createApp({
    store,
    adapter,
    render: fakeRender,
    validate: makeValidate(validateMode),
    export_dir: exportDir,
    // 브라우저가 설치된 CI 에서도 결과가 같도록 HOME 까지 통제한다(meta.playwright 는 이 env 만 본다).
    env: { PLAYWRIGHT_CHROMIUM_PATH: '/definitely/not/here', PLAYWRIGHT_BROWSERS_PATH: join(exportDir, 'no-browsers'), HOME: join(exportDir, 'no-home') },
    now,
    newId,
    required_check_ids: REQUIRED,
    assembler: fakeAssembler,
    log: () => {},
  })
  cleanups.push(() => {
    store.close()
    rmSync(exportDir, { recursive: true, force: true })
  })
  const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const get = async (path: string): Promise<Response> => created.app.request(path)
  const post = async (path: string, body?: unknown): Promise<Response> => created.app.request(path, body === undefined ? { method: 'POST' } : json(body))
  const patch = async (path: string, body: unknown): Promise<Response> => created.app.request(path, { ...json(body), method: 'PATCH' })
  const runJob = async (path: string, body: unknown): Promise<JobDocument> => {
    const res = await post(path, body)
    expect(res.status, await res.clone().text()).toBe(202)
    const { job_id } = (await res.json()) as { job_id: string }
    await created.queue.whenIdle()
    const jobRes = await get(`/api/jobs/${job_id}`)
    expect(jobRes.status).toBe(200)
    return (await jobRes.json()) as JobDocument
  }
  return { ...created, store, adapter, validateMode, export_dir: exportDir, get, post, patch, runJob }
}

const LIST = SEED.screens['SAMPLE-quote-list']
const createBody = {
  task_type: 'create',
  purpose: '견적 목록 화면 신규 생성',
  requirement_ids: [SEED.requirements['REQ-QT-001'], SEED.requirements['REQ-QT-004'], SEED.requirements['REQ-QT-005']],
  criterion_ids: [],
  reference_ids: [SEED.references['REF-quote-list']],
  cases: ['normal', 'empty', 'error'],
  keep_conditions: [],
  roles: ['partner'],
  device: 'desktop',
}

// ---------- 테스트 ----------

describe('API 통합 — 생성 → 검토 → 수정 → 완료·내보내기', () => {
  it('메타·프로젝트·레퍼런스를 돌려준다 (키·토큰 값 없음)', async () => {
    const h = harness()
    const meta = await (await h.get('/api/meta')).json()
    expect(meta).toEqual({ adapter: 'fixture', model: 'fixture', auth: 'none', version: expect.any(String), playwright: false })
    expect(JSON.stringify(meta)).not.toMatch(/sk-|key=|token=/i)

    const projects = (await (await h.get('/api/projects')).json()) as Array<{ id: string; name: string }>
    expect(projects).toHaveLength(1)
    expect(projects[0]?.id).toBe(SEED.project_id)

    const detail = (await (await h.get(`/api/projects/${SEED.project_id}`)).json()) as { requirements: unknown[]; ia_nodes: unknown[]; screens: Array<{ external_id: string; status: string; revision_count: number; open_comments: number }> }
    expect(detail.requirements).toHaveLength(5)
    expect(detail.ia_nodes).toHaveLength(5)
    expect(detail.screens.map((s) => s.external_id)).toEqual(['SAMPLE-quote-list', 'SAMPLE-quote-detail', 'SAMPLE-quote-create-popup'])
    expect(detail.screens[0]).toMatchObject({ status: 'draft', revision_count: 0, open_comments: 0 })

    const refs = (await (await h.get(`/api/projects/${SEED.project_id}/references`)).json()) as Array<{ category: string }>
    expect(refs.map((r) => r.category)).toEqual(['list', 'detail', 'popup'])
    expect((await h.get('/api/projects/없는-프로젝트')).status).toBe(404)
    expect((await h.get('/api/없는-경로')).status).toBe(404)
  })

  it('전체 흐름이 끝까지 동작한다', async () => {
    const h = harness()

    // 프롬프트 미리보기
    const previewRes = await h.post(`/api/screens/${LIST}/prompt-preview`, createBody)
    expect(previewRes.status, await previewRes.clone().text()).toBe(200)
    const preview = (await previewRes.json()) as { prompt: { system: string; user: string; template_version: string }; context_summary: string[] }
    expect(preview.prompt.user).toContain('SAMPLE-quote-list')
    expect(preview.prompt.template_version).toBe('fake-v1')
    expect(preview.context_summary.some((s) => s.includes('REQ-QT-001'))).toBe(true)
    expect(preview.context_summary.some((s) => s.includes('목록 골든'))).toBe(true)

    // 생성 작업 → 완료 대기
    const job = await h.runJob(`/api/screens/${LIST}/generation-jobs`, createBody)
    expect(job.status, JSON.stringify(job.failure)).toBe('succeeded')
    expect(job.stage).toBe('persist')
    expect(job.adapter).toBe('fixture')
    expect(job.prompt_text).toContain('[user] SAMPLE-quote-list')
    expect(job.result).toBeDefined()
    expect(GenerationJob.safeParse(job).success).toBe(true)
    expect(h.adapter.calls).toEqual(['generate:SAMPLE-quote-list'])

    // 화면·revision 조회
    const screenRes = (await (await h.get(`/api/screens/${LIST}`)).json()) as { screen: { status: string; current_revision_id: string }; revisions: Array<{ id: string; revision_no: number; artifact_id: string; artifact_hash: string; artifact_status: string; validation_summary: Record<string, number>; open_comments: number }> }
    expect(screenRes.screen.status).toBe('review')
    expect(screenRes.revisions).toHaveLength(1)
    const rev1 = screenRes.revisions[0]!
    expect(rev1.revision_no).toBe(1)
    expect(rev1.id).toBe(job.result!.revision_id)
    expect(rev1.artifact_status).toBe('review_ready')
    expect(rev1.validation_summary).toEqual({ pass: 3, fail: 0, error: 0, not_run: 0 })

    const revRes = (await (await h.get(`/api/revisions/${rev1.id}`)).json()) as { revision: { revision_no: number; spec_hash: string }; spec: { screen_id: string; baseline_id: string }; artifact: { id: string; content_hash: string; status: string; revision: number }; validation_results: ValidationResult[]; comments: unknown[]; element_index: Array<{ element_id: string }> }
    expect(revRes.spec.screen_id).toBe('SAMPLE-quote-list')
    expect(revRes.spec.baseline_id).toBe(SEED.baseline_id)
    expect(revRes.artifact.status).toBe('review_ready')
    expect(revRes.validation_results.map((r) => r.check_id).sort()).toEqual([...REQUIRED].sort())
    expect(revRes.element_index.some((e) => e.element_id === 'quote-table')).toBe(true)
    expect(revRes.comments).toEqual([])

    // HTML + CSP
    const htmlRes = await h.get(`/api/artifacts/${revRes.artifact.id}/html`)
    expect(htmlRes.status).toBe(200)
    expect(htmlRes.headers.get('content-type')).toMatch(/^text\/html/)
    expect(htmlRes.headers.get('content-security-policy')).toBe(ARTIFACT_HTML_CSP)
    const html = await htmlRes.text()
    expect(html).toContain('data-element-id="quote-table"')
    expect(html).toContain('SAMPLE-quote-list-normal=5')
    expect(sha256(html)).toBe(revRes.artifact.content_hash)
    expect((await h.get('/api/artifacts/없음/html')).status).toBe(404)

    // 코멘트 작성 (차단)
    const commentRes = await h.post(`/api/revisions/${rev1.id}/comments`, { target: 'screen', element_id: 'quote_no', section_id: 'search', display_no: '1-a', author: '디자이너A', role: 'designer', text: '검색어 라벨을 견적번호로 바꿔주세요', blocking: true })
    expect(commentRes.status, await commentRes.clone().text()).toBe(201)
    const comment = (await commentRes.json()) as { id: string; status: string; revision: number; artifact_hash: string; blocking: boolean }
    expect(comment.status).toBe('open')
    expect(comment.revision).toBe(1)
    expect(comment.artifact_hash).toBe(revRes.artifact.content_hash)
    const afterComment = (await (await h.get(`/api/screens/${LIST}`)).json()) as { revisions: Array<{ open_comments: number }> }
    expect(afterComment.revisions[0]?.open_comments).toBe(1)

    // 차단 코멘트가 열려 있으면 승인 400
    const blocked = await h.post(`/api/screens/${LIST}/approvals`, { revision_id: rev1.id, approver: '기획자K' })
    expect(blocked.status).toBe(400)
    const blockedBody = (await blocked.json()) as { reasons: Array<{ code: string }> }
    expect(blockedBody.reasons.map((r) => r.code)).toContain('approval.blocking_comments_open')

    // AI 수정 프롬프트 초안
    const draftRes = await h.post(`/api/revisions/${rev1.id}/revision-prompt`, { comment_ids: [comment.id] })
    expect(draftRes.status, await draftRes.clone().text()).toBe(200)
    const draft = (await draftRes.json()) as { prompt: string; rationale: string; adapter: string }
    expect(draft.prompt).toContain('견적번호로 바꿔주세요')
    expect(draft.adapter).toBe('fixture')

    // edit 작업 → revision 2, 코멘트 resolved
    const editJob = await h.runJob(`/api/screens/${LIST}/generation-jobs`, { ...createBody, task_type: 'edit', purpose: '코멘트 반영', base_revision_id: rev1.id, comment_ids: [comment.id], prompt_override: draft.prompt })
    expect(editJob.status, JSON.stringify(editJob.failure)).toBe('succeeded')
    expect(editJob.prompt_text).toContain('[user-rev] 다음 코멘트를 반영해 수정')
    expect(h.adapter.calls).toEqual(['generate:SAMPLE-quote-list', 'revise:SAMPLE-quote-list:1'])
    const rev2Id = editJob.result!.revision_id
    const rev2 = (await (await h.get(`/api/revisions/${rev2Id}`)).json()) as { revision: { revision_no: number; based_on_revision_id: string; change_summary: { summary: string } }; spec: { sections: Array<{ elements: Array<{ label: string }> }> }; artifact: { id: string; content_hash: string; status: string } }
    expect(rev2.revision.revision_no).toBe(2)
    expect(rev2.revision.based_on_revision_id).toBe(rev1.id)
    expect(rev2.revision.change_summary.summary).toBe('코멘트 반영: 라벨 변경')
    expect(rev2.spec.sections[0]?.elements[0]?.label).toBe('견적번호(수정)')
    const rev1After = (await (await h.get(`/api/revisions/${rev1.id}`)).json()) as { comments: Array<{ status: string; resolved_by_revision_id: string; revision: number }> }
    expect(rev1After.comments[0]?.status).toBe('resolved')
    expect(rev1After.comments[0]?.resolved_by_revision_id).toBe(rev2Id)

    // 승인 성공 → 내보내기
    const approveRes = await h.post(`/api/screens/${LIST}/approvals`, { revision_id: rev2Id, approver: '기획자K', artifact_hash: rev2.artifact.content_hash })
    expect(approveRes.status, await approveRes.clone().text()).toBe(200)
    const approved = (await approveRes.json()) as { approval: { artifact_hash: string; approved_by: string; version: string; export_path: string; files: Array<{ path: string; sha256: string }> }; version: string; export_path: string; export_url: string; files: Array<{ path: string; sha256: string }>; manifest: ExportManifest }
    expect(approved.version).toBe('1.0')
    expect(approved.approval.artifact_hash).toBe(rev2.artifact.content_hash)
    expect(approved.export_path).toBe(join(SEED.project_slug, 'SAMPLE-quote-list', 'v1.0'))
    expect(approved.files.map((f) => f.path).sort()).toEqual(['comments.json', 'index.html', 'manifest.json', 'spec.json', 'trace.json', 'validation.json'])

    const dir = join(h.export_dir, approved.export_path)
    expect(existsSync(join(dir, 'manifest.json'))).toBe(true)
    const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as ExportManifest
    expect(manifest.screen_external_id).toBe('SAMPLE-quote-list')
    expect(manifest.artifact_hash).toBe(rev2.artifact.content_hash)
    expect(manifest.approved_by).toBe('기획자K')
    expect(manifest.adapter).toBe('fixture')
    expect(manifest.validation_summary).toEqual({ pass: 4, fail: 0, error: 0, not_run: 0 })
    expect(manifest.design_handoff).toMatchObject({ screen_revision_id: rev2Id, allowed_tokens: ['color', 'font', 'spacing'], locked_elements: [], locked_actions: [] })
    expect(manifest.files.map((f) => f.path)).toEqual(['index.html', 'spec.json', 'trace.json', 'validation.json', 'comments.json'])
    for (const f of approved.files) expect(sha256(readFileSync(join(dir, f.path), 'utf8'))).toBe(f.sha256)
    expect(sha256(readFileSync(join(dir, 'index.html'), 'utf8'))).toBe(rev2.artifact.content_hash)

    const trace = JSON.parse(readFileSync(join(dir, 'trace.json'), 'utf8')) as TraceDocument
    const req001 = trace.requirements.find((r) => r.id === 'REQ-QT-001')
    expect(req001?.title).toBe('견적 목록 조회')
    const ac01 = req001?.criteria.find((c) => c.id === 'AC-QT-001-01')
    expect(ac01?.elements.map((e) => e.element_id)).toEqual(['quote_no', 'period', 'status-filter'])
    expect(ac01?.actions.map((a) => a.action_id)).toEqual(['search-submit'])
    const ac03 = req001?.criteria.find((c) => c.id === 'AC-QT-001-03')
    expect(ac03?.cases).toEqual([{ state_id: 'empty', case_kind: 'empty', via_action_id: 'show-empty' }])
    expect(trace.unlinked_criterion_ids).toEqual([])

    const validation = JSON.parse(readFileSync(join(dir, 'validation.json'), 'utf8')) as { results: ValidationResult[] }
    expect(validation.results.some((r) => r.check_id === HUMAN_REVIEW_CHECK_ID && r.stage === 'V6' && r.status === 'pass')).toBe(true)
    const commentsFile = JSON.parse(readFileSync(join(dir, 'comments.json'), 'utf8')) as { revision_id: string; comments: unknown[] }
    expect(commentsFile.revision_id).toBe(rev2Id)

    // 상태 반영
    const finalScreen = (await (await h.get(`/api/screens/${LIST}`)).json()) as { screen: { status: string; version: string }; revisions: Array<{ artifact_status: string }> }
    expect(finalScreen.screen).toMatchObject({ status: 'approved', version: '1.0' })
    expect(finalScreen.revisions[1]?.artifact_status).toBe('approved')
    const project = (await (await h.get(`/api/projects/${SEED.project_id}`)).json()) as { screens: Array<{ external_id: string; status: string; version: string; revision_count: number }> }
    expect(project.screens[0]).toMatchObject({ external_id: 'SAMPLE-quote-list', status: 'approved', version: '1.0', revision_count: 2 })

    // 정적 제공
    const staticRes = await h.get(`/exports/${approved.export_path}/manifest.json`)
    expect(staticRes.status).toBe(200)
    expect(((await staticRes.json()) as ExportManifest).artifact_hash).toBe(rev2.artifact.content_hash)
    expect((await h.get(approved.export_url)).status).toBe(200)
    expect((await h.get('/exports/없는/폴더/index.html')).status).toBe(404)

    // 같은 화면을 다시 승인하면 거부 (이미 v1.0)
    const again = await h.post(`/api/screens/${LIST}/approvals`, { revision_id: rev2Id, approver: '기획자K' })
    expect(again.status).toBe(400)
    expect(((await again.json()) as { reasons: Array<{ code: string }> }).reasons.map((r) => r.code)).toContain('approval.already_approved')
  })

  it('필수 검사가 fail 인 artifact 는 승인할 수 없고, 재검증으로 통과하면 승인할 수 있다', async () => {
    const h = harness()
    h.validateMode.current = 'fail'
    const detailId = SEED.screens['SAMPLE-quote-detail']
    const body = { ...createBody, purpose: '견적 상세 생성', requirement_ids: [SEED.requirements['REQ-QT-002'], SEED.requirements['REQ-QT-005']], reference_ids: [SEED.references['REF-quote-detail']], cases: ['normal', 'error'] }
    const job = await h.runJob(`/api/screens/${detailId}/generation-jobs`, body)
    expect(job.status, JSON.stringify(job.failure)).toBe('succeeded')
    const revisionId = job.result!.revision_id
    const artifactId = job.result!.artifact_id
    const screen = (await (await h.get(`/api/screens/${detailId}`)).json()) as { revisions: Array<{ artifact_status: string; validation_summary: Record<string, number> }> }
    expect(screen.revisions[0]?.artifact_status).toBe('validation_pending')
    expect(screen.revisions[0]?.validation_summary).toEqual({ pass: 2, fail: 1, error: 0, not_run: 0 })

    const rejected = await h.post(`/api/screens/${detailId}/approvals`, { revision_id: revisionId, approver: '기획자K' })
    expect(rejected.status).toBe(400)
    const reasons = ((await rejected.json()) as { reasons: Array<{ code: string; message: string }> }).reasons
    expect(reasons.map((r) => r.code)).toContain('approval.required_check_fail')
    expect(reasons.map((r) => r.code)).toContain('approval.status')
    // 거부된 승인은 V6 결과를 남기지 않는다.
    const rev = (await (await h.get(`/api/revisions/${revisionId}`)).json()) as { validation_results: ValidationResult[] }
    expect(rev.validation_results.some((r) => r.stage === 'V6')).toBe(false)
    expect(existsSync(join(h.export_dir, SEED.project_slug))).toBe(false)

    // 재검증 (통과) → review_ready → 승인 성공
    h.validateMode.current = 'pass'
    const revalidate = await h.post(`/api/artifacts/${artifactId}/validations`)
    expect(revalidate.status, await revalidate.clone().text()).toBe(200)
    const revalidated = (await revalidate.json()) as { artifact: { status: string }; summary: Record<string, number> }
    expect(revalidated.artifact.status).toBe('review_ready')
    expect(revalidated.summary).toEqual({ pass: 3, fail: 0, error: 0, not_run: 0 })
    const revAfter = (await (await h.get(`/api/revisions/${revisionId}`)).json()) as { validation_results: ValidationResult[] }
    expect(revAfter.validation_results).toHaveLength(3)
    expect(revAfter.validation_results.every((r) => r.status === 'pass')).toBe(true)

    const approved = await h.post(`/api/screens/${detailId}/approvals`, { revision_id: revisionId, approver: '기획자K' })
    expect(approved.status, await approved.clone().text()).toBe(200)
    expect(existsSync(join(h.export_dir, SEED.project_slug, 'SAMPLE-quote-detail', 'v1.0', 'index.html'))).toBe(true)

    // 승인 요청 hash 가 산출물 hash 와 다르면 거부 (다른 화면으로 확인)
    const popupId = SEED.screens['SAMPLE-quote-create-popup']
    const popupJob = await h.runJob(`/api/screens/${popupId}/generation-jobs`, { ...createBody, purpose: '팝업 생성', requirement_ids: [SEED.requirements['REQ-QT-003'], SEED.requirements['REQ-QT-005']], reference_ids: [SEED.references['REF-quote-create-popup']], cases: ['normal', 'error'] })
    expect(popupJob.status, JSON.stringify(popupJob.failure)).toBe('succeeded')
    const wrongHash = await h.post(`/api/screens/${popupId}/approvals`, { revision_id: popupJob.result!.revision_id, approver: '기획자K', artifact_hash: 'f'.repeat(64) })
    expect(wrongHash.status).toBe(400)
    expect(((await wrongHash.json()) as { reasons: Array<{ code: string }> }).reasons.map((r) => r.code)).toContain('approval.hash_mismatch')
  })

  it('요청 본문 검증·revision 충돌·없는 자원을 올바른 상태 코드로 알린다', async () => {
    const h = harness()
    const bad = await h.post(`/api/screens/${LIST}/generation-jobs`, { task_type: 'create' })
    expect(bad.status).toBe(400)
    const badBody = (await bad.json()) as { error: string; issues: Array<{ path: string }> }
    expect(badBody.error).toBe('invalid_request')
    expect(badBody.issues.map((i) => i.path)).toContain('purpose')

    const notJson = await h.app.request(`/api/screens/${LIST}/prompt-preview`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' })
    expect(notJson.status).toBe(400)
    expect(((await notJson.json()) as { error: string }).error).toBe('invalid_json')

    const mismatch = await h.post(`/api/screens/${LIST}/generation-jobs`, { ...createBody, screen_id: '다른-화면' })
    expect(mismatch.status).toBe(400)

    const unknownRef = await h.post(`/api/screens/${LIST}/generation-jobs`, { ...createBody, reference_ids: ['a5000000-0000-4000-8000-000000000099'] })
    expect(unknownRef.status).toBe(400)
    expect(((await unknownRef.json()) as { error: string }).error).toBe('reference_invalid')

    const editWithoutBase = await h.post(`/api/screens/${LIST}/prompt-preview`, { ...createBody, task_type: 'edit' })
    expect(editWithoutBase.status).toBe(400)

    expect((await h.post('/api/screens/없는-화면/generation-jobs', createBody)).status).toBe(404)
    expect((await h.get('/api/jobs/없는-작업')).status).toBe(404)
    expect((await h.get('/api/revisions/없는-revision')).status).toBe(404)
    expect((await h.post('/api/screens/없는-화면/approvals', { revision_id: 'x', approver: 'y' })).status).toBe(404)

    // 코멘트 revision 충돌
    const job = await h.runJob(`/api/screens/${LIST}/generation-jobs`, createBody)
    const revisionId = job.result!.revision_id
    const comment = (await (await h.post(`/api/revisions/${revisionId}/comments`, { target: 'description', author: '개발자D', role: 'developer', text: '정렬 기준 확인 필요' })).json()) as { id: string; revision: number; blocking: boolean }
    expect(comment.blocking).toBe(false)
    const stale = await h.patch(`/api/comments/${comment.id}`, { status: 'wont_fix', revision: 99 })
    expect(stale.status).toBe(409)
    expect(((await stale.json()) as { error: string }).error).toBe('stale_revision')
    const ok = await h.patch(`/api/comments/${comment.id}`, { status: 'wont_fix', revision: comment.revision })
    expect(ok.status).toBe(200)
    const patched = (await ok.json()) as { status: string; revision: number }
    expect(patched).toMatchObject({ status: 'wont_fix', revision: 2 })
    expect((await h.patch(`/api/comments/${comment.id}`, { status: 'open', revision: 1 })).status).toBe(409)
    expect((await h.patch('/api/comments/없음', { status: 'open', revision: 1 })).status).toBe(404)
    expect((await h.post(`/api/revisions/${revisionId}/revision-prompt`, { comment_ids: [] })).status).toBe(400)
    expect((await h.post(`/api/revisions/${revisionId}/revision-prompt`, { comment_ids: ['없는-코멘트'] })).status).toBe(400)
  })

  it('작업은 순차로 실행되고, queued 작업은 취소할 수 있으며, 실패한 작업은 이전 revision 을 결과로 연결하지 않는다', async () => {
    const h = harness()
    const first = await h.runJob(`/api/screens/${LIST}/generation-jobs`, createBody)
    const previousRevision = first.result!.revision_id

    // 첫 작업을 잡아 두고 두 번째를 queued 상태에서 취소한다.
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    const originalGenerate = h.adapter.generateSpec.bind(h.adapter)
    h.adapter.generateSpec = async (input) => {
      await gate
      return originalGenerate(input)
    }
    const aRes = await h.post(`/api/screens/${LIST}/generation-jobs`, { ...createBody, purpose: '작업 A' })
    const bRes = await h.post(`/api/screens/${LIST}/generation-jobs`, { ...createBody, purpose: '작업 B' })
    const a = ((await aRes.json()) as { job_id: string }).job_id
    const b = ((await bRes.json()) as { job_id: string }).job_id
    await new Promise((r) => setTimeout(r, 5))
    expect(((await (await h.get(`/api/jobs/${a}`)).json()) as JobDocument).status).toBe('running')
    expect(((await (await h.get(`/api/jobs/${b}`)).json()) as JobDocument).status).toBe('queued')
    const cancelRes = await h.post(`/api/jobs/${b}/cancel`)
    expect(cancelRes.status).toBe(200)
    expect(((await cancelRes.json()) as JobDocument).status).toBe('cancelled')
    release()
    await h.queue.whenIdle()
    expect(((await (await h.get(`/api/jobs/${a}`)).json()) as JobDocument).status).toBe('succeeded')
    const cancelled = (await (await h.get(`/api/jobs/${b}`)).json()) as JobDocument
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.result).toBeUndefined()
    expect((await h.post(`/api/jobs/${b}/cancel`)).status).toBe(409)

    // 실패 작업: 어댑터가 참조 깨진 명세를 돌려준다.
    h.adapter.generateSpec = async ({ ctx }) => ({ output: { screen_spec: { ...specFor(ctx), actions: [{ id: 'x', type: 'filter-fixture', target: 'no-such-target' }] }, trace_proposals: [], unresolved: [], change_summary: { summary: '깨짐' } } })
    const failed = await h.runJob(`/api/screens/${LIST}/generation-jobs`, { ...createBody, purpose: '깨진 명세' })
    expect(failed.status).toBe('failed')
    expect(failed.failure?.code).toBe('reference_invalid')
    expect(failed.result).toBeUndefined()
    const screen = (await (await h.get(`/api/screens/${LIST}`)).json()) as { screen: { current_revision_id: string }; revisions: unknown[] }
    expect(screen.revisions).toHaveLength(2)
    expect(screen.screen.current_revision_id).not.toBe(previousRevision)
    expect(screen.screen.current_revision_id).toBe(((await (await h.get(`/api/jobs/${a}`)).json()) as JobDocument).result!.revision_id)
  })

  it('서버 시작 시 queued/running 으로 남은 작업을 failed(internal, 서버 재시작으로 중단) 로 정리한다', async () => {
    const store = new SqliteStore(':memory:', { now })
    seedIfEmpty(store, now)
    const base: JobDocument = {
      id: 'e0000000-0000-4000-8000-000000000001',
      project_id: SEED.project_id,
      screen_plan_id: LIST,
      job_type: 'create',
      status: 'running',
      idempotency_key: 'k',
      input_snapshot_hash: '0'.repeat(64),
      baseline_id: SEED.baseline_id,
      prompt_template_version: 'v1',
      model_id: 'fixture',
      attempt: 1,
      max_attempts: 1,
      timeout_ms: 1000,
      cancel_requested: false,
      created_at: now(),
      started_at: now(),
      stage: 'render',
      current_stage: 'render',
      request: { screen_id: LIST, task_type: 'create', purpose: '중단된 작업', requirement_ids: [], criterion_ids: [], reference_ids: [], cases: ['normal'], keep_conditions: [], roles: [], device: 'desktop' },
      adapter: 'fixture',
      model: 'fixture',
      prompt_text: '',
      context_summary: [],
    }
    store.put('job', base.id, base, 0)
    store.put('job', 'e0000000-0000-4000-8000-000000000002', { ...base, id: 'e0000000-0000-4000-8000-000000000002', status: 'queued', started_at: undefined, stage: undefined, current_stage: undefined }, 0)
    store.put('job', 'e0000000-0000-4000-8000-000000000003', { ...base, id: 'e0000000-0000-4000-8000-000000000003', status: 'succeeded', finished_at: now(), result: { revision_id: 'r', artifact_id: 'a' } }, 0)

    const h = harness({ store, seed: false })
    expect(h.recovered_job_ids.sort()).toEqual(['e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002'])
    const recovered = (await (await h.get(`/api/jobs/${base.id}`)).json()) as JobDocument
    expect(recovered.status).toBe('failed')
    expect(recovered.failure).toMatchObject({ code: 'internal', message: '서버 재시작으로 중단', stage: 'render' })
    expect(recovered.finished_at).toBeDefined()
    expect(GenerationJob.safeParse(recovered).success).toBe(true)
    const untouched = (await (await h.get('/api/jobs/e0000000-0000-4000-8000-000000000003')).json()) as JobDocument
    expect(untouched.status).toBe('succeeded')
  })
})
