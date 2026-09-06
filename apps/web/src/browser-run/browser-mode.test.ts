/**
 * 브라우저 모드 통합 — 인메모리 API(demo-api)가 자격 증명 상태에 따라 어떻게 달라지는지.
 * 자격 증명이 없으면 스냅샷 동작 그대로, 있으면 실제 파이프라인(주입한 fetch)으로 새 revision 을 만든다.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { applyBrowserOverlay, createDemoState, handleAsyncWith, handleWith, metaOf, type DemoFiles, type DemoState } from '../demo-api.js'
import type { AsisAnalysis, Job, Meta, ProjectDetail, PromptPreviewResponse, RevisionDetail, RevisionPromptDraft, ScreenDetail, SliceGenerationRequest } from '../types.js'
import { browserRuntime, setBrowserRuntime } from './runtime.js'
import { BrowserStore } from './store.js'
import { runV3InBrowser } from './v3-browser.js'
import { V3_CHECKS, makeResult, type CheckResult } from './deps.js'
import { fakeFetch, modelOutput, modelResponse, snapshotFile, snapshotSpec, MemoryStorage } from './test-helpers.js'
import type { StoredCredential } from './credential.js'

const TOKEN: StoredCredential = { kind: 'token', value: '비밀-브라우저-토큰-4321', persist: false }
const PROJECT = 'a1000000-0000-4000-8000-000000000001'
const SCREEN_LIST = 'a4000000-0000-4000-8000-000000000001'
/** 스냅샷에 생성 결과가 없는 화면 — 브라우저 모드에서 처음 생성해 본다. */
const SCREEN_DETAIL = 'a4000000-0000-4000-8000-000000000002'

const REQUEST: SliceGenerationRequest = {
  screen_id: SCREEN_LIST,
  task_type: 'create',
  purpose: '견적 목록을 조회한다',
  requirement_ids: [],
  criterion_ids: [],
  reference_ids: [],
  cases: ['normal', 'empty', 'error'],
  keep_conditions: [],
  roles: ['partner'],
  device: 'desktop',
}

function files(): DemoFiles {
  return {
    asis_samples: [],
    snapshot: snapshotFile(),
    approval: { screen_id: SCREEN_LIST, revision_id: 'x', approver: '데모 기획자', response: { approval: { id: 'AP', artifact_id: 'A', artifact_hash: 'h', approved_by: '데모 기획자', approved_at: 'now' }, version: '1.0', export_path: 'p', files: [] } },
  }
}

/** 자격 증명·fetch·저장소를 갈아끼운 상태에서 데모 API 를 만든다. */
function browserState(responses: Parameters<typeof fakeFetch>[0]): { state: DemoState; store: BrowserStore; calls: ReturnType<typeof fakeFetch>['calls'] } {
  const { fetch, calls } = fakeFetch(responses)
  const store = new BrowserStore(() => new MemoryStorage())
  let seq = 0
  setBrowserRuntime({ credential: () => TOKEN, fetch, store, now: () => '2026-09-05T00:00:00.000Z', newId: () => `browser-id-${++seq}` })
  return { state: createDemoState(files(), { now: () => 0, store }), store, calls }
}

/** 자격 증명 없는 기본 상태로 되돌린다. */
function snapshotOnly(): DemoState {
  const store = new BrowserStore(() => new MemoryStorage())
  setBrowserRuntime({ credential: () => null, fetch: undefined, store })
  return createDemoState(files(), { now: () => 0, store })
}

afterEach(() => {
  setBrowserRuntime({ credential: () => null, fetch: undefined, store: new BrowserStore(() => new MemoryStorage()), now: () => new Date().toISOString(), newId: () => crypto.randomUUID(), runV3: runV3InBrowser })
})

/** V3 를 모두 통과로 만든 결과 (승인 게이트 통과 경로 검사용). */
function passingV3(opts: { artifact_hash: string; validation_run_id: string }): CheckResult[] {
  const base = { artifact_hash: opts.artifact_hash, validation_run_id: opts.validation_run_id, stage: 'V3' as const }
  return V3_CHECKS.map((id) => makeResult(base, { check_id: id, status: 'pass', required: true, evidence: ['테스트에서 주입한 통과 결과'] }))
}

/** 작업이 끝날 때까지 폴링한다 (파이프라인은 비동기로 돈다). */
async function waitJob(state: DemoState, jobId: string): Promise<Job> {
  for (let i = 0; i < 200; i += 1) {
    const job = handleWith(state, 'GET', `/api/jobs/${jobId}`).data as Job
    if (job.status === 'succeeded' || job.status === 'failed') return job
    await new Promise((r) => setTimeout(r, 5))
  }
  throw new Error('작업이 끝나지 않았다')
}

describe('/api/meta — 자격 증명 상태를 그대로 알린다', () => {
  it('없으면 스냅샷(fixture), 있으면 anthropic + 인증 방식 + playwright false', () => {
    const plain = snapshotOnly()
    expect((handleWith(plain, 'GET', '/api/meta').data as Meta).adapter).toBe('fixture')

    const { state } = browserState([modelResponse(modelOutput(snapshotSpec()))])
    const meta = metaOf(state)
    expect(meta).toMatchObject({ adapter: 'anthropic', model: 'claude-opus-5', auth: 'token', playwright: false })
  })
})

describe('생성 — 자격 증명이 있으면 실제 파이프라인이 돈다', () => {
  it('스냅샷에 결과가 없는 화면도 새 revision 을 만들고 검토 화면에 나타난다', async () => {
    const { state, store, calls } = browserState([modelResponse(modelOutput({ ...snapshotSpec(), screen_id: 'SAMPLE-quote-detail' }))])
    const created = await handleAsyncWith(state, 'POST', `/api/screens/${SCREEN_DETAIL}/generation-jobs`, { ...REQUEST, screen_id: SCREEN_DETAIL })
    expect(created.status).toBe(202)
    const jobId = (created.data as { job_id: string }).job_id

    const job = await waitJob(state, jobId)
    expect(job.status).toBe('succeeded')
    expect(job.adapter).toBe('anthropic')
    expect(job.result?.revision_id).toBeTruthy()
    expect(calls).toHaveLength(1)

    // 검토 화면이 읽는 경로가 모두 채워진다.
    const screen = handleWith(state, 'GET', `/api/screens/${SCREEN_DETAIL}`).data as ScreenDetail
    expect(screen.revisions).toHaveLength(1)
    expect(screen.screen.current_revision_id).toBe(job.result?.revision_id)
    const detail = handleWith(state, 'GET', `/api/revisions/${job.result?.revision_id ?? ''}`).data as RevisionDetail
    expect(detail.validation_results.some((r) => r.check_id === 'V1.schema' && r.status === 'pass')).toBe(true)
    // V3 는 격리 iframe 이 필요하다. 문서가 없는 이 환경에서는 error 로 기록된다 — 통과로 바꾸지 않는다.
    expect(detail.validation_results.filter((r) => r.stage === 'V3').every((r) => r.status !== 'pass')).toBe(true)
    // 프로젝트 홈 목록도 갱신된다.
    const project = handleWith(state, 'GET', `/api/projects/${PROJECT}`).data as ProjectDetail
    expect(project.screens.find((s) => s.id === SCREEN_DETAIL)?.revision_count).toBe(1)

    // 저장 데이터에는 토큰 값이 없다.
    expect(JSON.stringify(store.load())).not.toContain(TOKEN.value)
  })

  it('새로고침(새 상태)에서도 브라우저에 저장된 revision 이 그대로 보인다', async () => {
    const { state, store } = browserState([modelResponse(modelOutput({ ...snapshotSpec(), screen_id: 'SAMPLE-quote-detail' }))])
    const created = await handleAsyncWith(state, 'POST', `/api/screens/${SCREEN_DETAIL}/generation-jobs`, { ...REQUEST, screen_id: SCREEN_DETAIL })
    const job = await waitJob(state, (created.data as { job_id: string }).job_id)

    const reloaded = createDemoState(files(), { now: () => 0, store })
    const screen = handleWith(reloaded, 'GET', `/api/screens/${SCREEN_DETAIL}`).data as ScreenDetail
    expect(screen.revisions.map((r) => r.id)).toEqual([job.result?.revision_id])
    expect(handleWith(reloaded, 'GET', `/api/revisions/${job.result?.revision_id ?? ''}`).status).toBe(200)
  })

  it('모델이 401 을 주면 작업을 실패로 기록하고 revision 을 만들지 않는다', async () => {
    const { state, store } = browserState([{ status: 401, body: { error: { message: `bad ${TOKEN.value}` } } }])
    const created = await handleAsyncWith(state, 'POST', `/api/screens/${SCREEN_DETAIL}/generation-jobs`, { ...REQUEST, screen_id: SCREEN_DETAIL })
    const job = await waitJob(state, (created.data as { job_id: string }).job_id)

    expect(job.status).toBe('failed')
    expect(job.failure?.code).toBe('model_error')
    expect(job.failure?.stage).toBe('spec_generate')
    expect(JSON.stringify(job)).not.toContain(TOKEN.value)
    expect(store.load().revisions).toHaveLength(0)
    expect((handleWith(state, 'GET', `/api/screens/${SCREEN_DETAIL}`).data as ScreenDetail).revisions).toHaveLength(0)
  })

  it('자격 증명이 없으면 같은 파이프라인이 더미 어댑터(fixture)로 돈다 — 모델만 호출하지 않는다', async () => {
    const state = snapshotOnly()
    const res = await handleAsyncWith(state, 'POST', `/api/screens/${SCREEN_DETAIL}/generation-jobs`, { ...REQUEST, screen_id: SCREEN_DETAIL })
    expect(res.status).toBe(202)
    const job = await waitJob(state, (res.data as { job_id: string }).job_id)
    expect(job.status).toBe('succeeded')
    expect(job.adapter).toBe('fixture')
    // 실제 호출과 구분되는 문구를 남긴다.
    expect(job.context_summary?.join(' ')).toContain('더미 어댑터')
    expect(job.context_summary?.join(' ')).not.toContain('api.anthropic.com')
    const screen = handleWith(state, 'GET', `/api/screens/${SCREEN_DETAIL}`).data as ScreenDetail
    expect(screen.revisions).toHaveLength(1)
  })
})

describe('단건 수정 — 기준 revision·코멘트를 반영한다', () => {
  it('새 revision 을 만들고 반영한 코멘트를 해결로 표시한다', async () => {
    const { state, calls } = browserState([modelResponse(modelOutput(snapshotSpec()))])
    const screenBefore = handleWith(state, 'GET', `/api/screens/${SCREEN_LIST}`).data as ScreenDetail
    const baseId = screenBefore.revisions[0]?.id ?? ''
    const base = handleWith(state, 'GET', `/api/revisions/${baseId}`).data as RevisionDetail
    const commentId = base.comments[0]?.id ?? ''
    // 반영 대상 코멘트를 다시 열어 둔다 (스냅샷은 이미 해결 상태).
    handleWith(state, 'PATCH', `/api/comments/${commentId}`, { status: 'open', revision: base.comments[0]?.revision ?? 1 })

    const created = await handleAsyncWith(state, 'POST', `/api/screens/${SCREEN_LIST}/generation-jobs`, {
      ...REQUEST,
      task_type: 'edit',
      base_revision_id: baseId,
      comment_ids: [commentId],
      prompt_override: '검색 영역의 라벨을 바꾼다',
    })
    const job = await waitJob(state, (created.data as { job_id: string }).job_id)
    expect(job.status).toBe('succeeded')

    // 수정 프롬프트(기준 명세·코멘트 포함)로 호출한다.
    const sentUser = String(((calls[0]?.body['messages'] as Array<{ content: string }>)[0] ?? { content: '' }).content)
    expect(sentUser).toContain('화면 수정 요청')
    expect(sentUser).toContain('검색 영역의 라벨을 바꾼다')
    expect(sentUser).toContain(base.comments[0]?.text ?? '없는 문장')

    const screenAfter = handleWith(state, 'GET', `/api/screens/${SCREEN_LIST}`).data as ScreenDetail
    expect(screenAfter.revisions.map((r) => r.revision_no)).toEqual([1, 2, 3])
    const baseAfter = handleWith(state, 'GET', `/api/revisions/${baseId}`).data as RevisionDetail
    expect(baseAfter.comments.find((c) => c.id === commentId)?.status).toBe('resolved')
    expect(baseAfter.comments.find((c) => c.id === commentId)?.resolved_by_revision_id).toBe(job.result?.revision_id)
  })
})

describe('프롬프트 미리보기 — 실제로 보낼 프롬프트를 그 자리에서 조립한다', () => {
  it('모델을 호출하지 않고 이번 요청의 문맥으로 만든다 (스냅샷 예시가 아니다)', async () => {
    const { state, calls } = browserState([modelResponse(modelOutput(snapshotSpec()))])
    const res = await handleAsyncWith(state, 'POST', `/api/screens/${SCREEN_DETAIL}/prompt-preview`, { ...REQUEST, screen_id: SCREEN_DETAIL, purpose: '견적 상세를 만든다' })
    expect(res.status).toBe(200)
    const preview = res.data as PromptPreviewResponse
    expect(calls).toHaveLength(0)
    expect(preview.prompt.user).toContain('견적 상세를 만든다')
    expect(preview.prompt.user).toContain('SAMPLE-quote-detail')
    expect(preview.context_summary[0]).toContain('브라우저 모드')
    expect(JSON.stringify(preview)).not.toContain(TOKEN.value)
  })

  it('자격 증명이 없어도 이번 요청으로 조립한다 — 다만 더미 어댑터라고 적는다', async () => {
    const state = snapshotOnly()
    const res = await handleAsyncWith(state, 'POST', `/api/screens/${SCREEN_LIST}/prompt-preview`, REQUEST)
    expect(res.status).toBe(200)
    const preview = res.data as PromptPreviewResponse
    expect(preview.prompt.user).toContain('SAMPLE-quote-list')
    expect(preview.context_summary[0]).toContain('더미 어댑터')
    expect(preview.context_summary[0]).not.toContain('api.anthropic.com')
  })
})

describe('수정 프롬프트 초안 — 자격 증명이 있으면 모델이 만든다', () => {
  it('anthropic 어댑터로 표시되고 모델 응답을 그대로 쓴다', async () => {
    const { state } = browserState([modelResponse({ prompt: '검색 라벨을 바꾼다', rationale: '코멘트 1건 반영' })])
    const revisionId = Object.keys(snapshotFile()).find((k) => k.startsWith('/api/revisions/'))?.replace('/api/revisions/', '') ?? ''
    const detail = handleWith(state, 'GET', `/api/revisions/${revisionId}`).data as RevisionDetail
    const commentId = detail.comments[0]?.id ?? 'none'
    const res = await handleAsyncWith(state, 'POST', `/api/revisions/${revisionId}/revision-prompt`, { comment_ids: [commentId] })
    expect(res.status).toBe(200)
    expect(res.data as RevisionPromptDraft).toEqual({ prompt: '검색 라벨을 바꾼다', rationale: '코멘트 1건 반영', adapter: 'anthropic' })
  })
})

describe('브라우저에서 못 하는 일 — 성공으로 위장하지 않는다', () => {
  it('AS-IS 새 URL 분석은 실패로 끝내고 이유를 정확히 적는다', async () => {
    const state = snapshotOnly()
    const created = handleWith(state, 'POST', `/api/projects/${PROJECT}/asis-analyses`, { url: 'https://example.com' })
    expect(created.status).toBe(202)
    const id = (created.data as { analysis_id: string }).analysis_id
    // 데모 시계는 0 고정이라 실패 시점까지 진행되지 않는다 → 시계를 옮겨 확인한다.
    const clock = { ms: 0 }
    const timed = createDemoState(files(), { now: () => clock.ms, store: browserRuntime.store })
    const again = handleWith(timed, 'POST', `/api/projects/${PROJECT}/asis-analyses`, { url: 'https://example.com' })
    clock.ms = 10_000
    const doc = handleWith(timed, 'GET', `/api/asis-analyses/${(again.data as { analysis_id: string }).analysis_id}`).data as AsisAnalysis
    expect(doc.status).toBe('failed')
    expect(doc.failure?.message).toContain('브라우저에서는 다른 사이트를 캡처할 수 없습니다')
    expect(doc.failure?.message).toContain('pnpm serve')
    expect(id).toBeTruthy()
  })

  it('필수 실행 검사(V3)가 통과하지 못하면 완료(v1.0) 승인을 거부하고 이유를 알린다', async () => {
    const { state, store } = browserState([modelResponse(modelOutput({ ...snapshotSpec(), screen_id: 'SAMPLE-quote-detail' }))])
    const created = await handleAsyncWith(state, 'POST', `/api/screens/${SCREEN_DETAIL}/generation-jobs`, { ...REQUEST, screen_id: SCREEN_DETAIL })
    const job = await waitJob(state, (created.data as { job_id: string }).job_id)
    const revisionId = job.result?.revision_id ?? ''

    // 이 환경에는 문서가 없어 V3 가 error 로 기록된다 — 오류를 통과로 바꾸지 않으므로 승인은 거부된다.
    const res = await handleAsyncWith(state, 'POST', `/api/screens/${SCREEN_DETAIL}/approvals`, { revision_id: revisionId, approver: '기획자' })
    expect(res.status).toBe(400)
    const body = JSON.stringify(res.data)
    expect(body).toContain('approval.required_checks')
    expect(body).toContain('V3')
    expect(store.load().approvals).toEqual({})
  })

  it('V3 가 모두 통과하면 승인되고 산출물 6개 파일을 실제로 만든다 (승인 manifest 로)', async () => {
    const { state, store } = browserState([modelResponse(modelOutput({ ...snapshotSpec(), screen_id: 'SAMPLE-quote-detail' }))])
    // V3 실행기를 «모두 통과» 로 갈아끼운다 (실제 iframe 실행은 v3-browser.test.ts 와 e2e 가 확인한다).
    setBrowserRuntime({ runV3: async (_html, opts) => passingV3(opts) })
    const created = await handleAsyncWith(state, 'POST', `/api/screens/${SCREEN_DETAIL}/generation-jobs`, { ...REQUEST, screen_id: SCREEN_DETAIL })
    const job = await waitJob(state, (created.data as { job_id: string }).job_id)
    const revisionId = job.result?.revision_id ?? ''

    const res = await handleAsyncWith(state, 'POST', `/api/screens/${SCREEN_DETAIL}/approvals`, { revision_id: revisionId, approver: '기획자' })
    expect(res.status).toBe(200)
    const approval = res.data as { version: string; export_path: string; files: Array<{ path: string; sha256: string }> }
    expect(approval.version).toBe('1.0')
    expect(approval.files.map((f) => f.path).sort()).toEqual(['comments.json', 'index.html', 'manifest.json', 'spec.json', 'trace.json', 'validation.json'])
    expect(approval.files.every((f) => /^[0-9a-f]{64}$/.test(f.sha256))).toBe(true)
    // 서버 폴더에 쓰지 않았다는 사실을 그대로 적는다 (없는 경로를 지어내지 않는다).
    expect(approval.export_path).toContain('이 브라우저')
    expect(store.load().approvals[SCREEN_DETAIL]?.version).toBe('1.0')

    const screen = handleWith(state, 'GET', `/api/screens/${SCREEN_DETAIL}`).data as ScreenDetail
    expect(screen.screen.status).toBe('approved')
    expect(screen.screen.version).toBe('1.0')
  })
})

describe('applyBrowserOverlay — 저장된 코멘트·승인을 스냅샷 위에 얹는다', () => {
  it('코멘트는 덮어쓰고 승인은 화면 상태에 반영된다', () => {
    const store = new BrowserStore(() => new MemoryStorage())
    const snapshot = snapshotFile()
    const revisionId = Object.keys(snapshot).find((k) => k.startsWith('/api/revisions/'))?.replace('/api/revisions/', '') ?? ''
    store.setComments(revisionId, [
      { id: 'c-저장', screen_id: SCREEN_LIST, revision_id: revisionId, artifact_hash: 'h', target: 'screen', author: '디자이너', role: 'designer', text: '저장된 코멘트', blocking: false, status: 'open', created_at: 'now' },
    ])
    store.setApproval({ screen_id: SCREEN_LIST, revision_id: revisionId, artifact_hash: 'h', approved_by: '기획자', approved_at: 'now', version: '1.0' })
    setBrowserRuntime({ credential: () => null, store })

    const state = createDemoState(files(), { now: () => 0, store })
    applyBrowserOverlay(state, store)
    const detail = handleWith(state, 'GET', `/api/revisions/${revisionId}`).data as RevisionDetail
    expect(detail.comments.map((c) => c.id)).toContain('c-저장')
    const screen = handleWith(state, 'GET', `/api/screens/${SCREEN_LIST}`).data as ScreenDetail
    expect(screen.screen.status).toBe('approved')
    expect(screen.screen.version).toBe('1.0')
  })
})

describe('화면 만들기 — 한 줄 입력 흐름 (브라우저 모드)', () => {
  it('화면을 만들고 바로 생성하면 새 화면·설계서가 이어지고 새로고침 후에도 남는다', async () => {
    const { state, store } = browserState([modelResponse(modelOutput({ ...snapshotSpec(), screen_id: 'SCREEN-001' }))])
    const references = handleWith(state, 'GET', `/api/projects/${PROJECT}/references`).data as Array<{ id: string; category: string }>
    const listRef = references.find((r) => r.category === 'list')

    const created = handleWith(state, 'POST', `/api/projects/${PROJECT}/screens`, { title: '견적 요청 목록', device: 'desktop', shell: 'partner-page', sample_from: listRef?.id })
    expect(created.status).toBe(201)
    const { screen, sample_fixtures } = created.data as { screen: { id: string; external_id: string; title: string; shell: string }; sample_fixtures: string[] }
    expect(screen.external_id).toBe('SCREEN-001')
    // 레퍼런스 열 구성으로 예시 더미데이터가 붙는다 (표가 빈 채로 나오지 않게)
    expect(sample_fixtures).toContain('SCREEN-001-normal')

    // 프로젝트 목록에 바로 보인다
    const project = handleWith(state, 'GET', `/api/projects/${PROJECT}`).data as ProjectDetail
    expect(project.screens.some((s) => s.external_id === 'SCREEN-001')).toBe(true)

    const job = await waitJob(
      state,
      (
        (await handleAsyncWith(state, 'POST', `/api/screens/${screen.id}/generation-jobs`, {
          ...REQUEST,
          screen_id: screen.id,
          reference_ids: listRef ? [listRef.id] : [],
          prompt_override: '파트너가 견적 요청 목록을 조회한다',
        })).data as { job_id: string }
      ).job_id,
    )
    expect(job.status, JSON.stringify(job.failure)).toBe('succeeded')
    const revisionId = job.result?.revision_id ?? ''
    const detail = handleWith(state, 'GET', `/api/revisions/${revisionId}`).data as RevisionDetail
    expect(detail.revision.screen_id).toBe(screen.id)

    // 제목만 수정 — 외부 ID 는 그대로
    const renamed = handleWith(state, 'PATCH', `/api/screens/${screen.id}`, { title: '견적 요청 목록(수정)' })
    expect(renamed.status).toBe(200)
    expect(renamed.data).toMatchObject({ external_id: 'SCREEN-001', title: '견적 요청 목록(수정)' })

    // 새로고침(새 상태)에서도 화면·설계서·바뀐 제목이 남는다
    const reloaded = createDemoState(files(), { now: () => 0, store })
    const after = handleWith(reloaded, 'GET', `/api/screens/${screen.id}`).data as ScreenDetail
    expect(after.screen.title).toBe('견적 요청 목록(수정)')
    expect(after.screen.external_id).toBe('SCREEN-001')
    expect(after.revisions.map((r) => r.id)).toEqual([revisionId])
    expect(handleWith(reloaded, 'GET', `/api/revisions/${revisionId}`).status).toBe(200)
  })

  it('빈 제목·잘못된 shell·없는 레퍼런스는 400, 없는 프로젝트는 404', () => {
    const { state } = browserState([])
    expect(handleWith(state, 'POST', `/api/projects/${PROJECT}/screens`, { title: '  ' }).status).toBe(400)
    expect(handleWith(state, 'POST', `/api/projects/${PROJECT}/screens`, { title: 'x', shell: 'nope' }).status).toBe(400)
    expect(handleWith(state, 'POST', `/api/projects/${PROJECT}/screens`, { title: 'x', sample_from: '없는-레퍼런스' }).status).toBe(400)
    expect(handleWith(state, 'POST', '/api/projects/없는것/screens', { title: 'x' }).status).toBe(404)
    expect(handleWith(state, 'PATCH', '/api/screens/없는것', { title: 'x' }).status).toBe(404)
  })
})
