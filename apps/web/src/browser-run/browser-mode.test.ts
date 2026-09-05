/**
 * 브라우저 모드 통합 — 인메모리 API(demo-api)가 자격 증명 상태에 따라 어떻게 달라지는지.
 * 자격 증명이 없으면 스냅샷 동작 그대로, 있으면 실제 파이프라인(주입한 fetch)으로 새 revision 을 만든다.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { applyBrowserOverlay, createDemoState, handleAsyncWith, handleWith, metaOf, type DemoFiles, type DemoState } from '../demo-api.js'
import type { AsisAnalysis, Job, Meta, ProjectDetail, PromptPreviewResponse, RevisionDetail, RevisionPromptDraft, ScreenDetail, SliceGenerationRequest } from '../types.js'
import { browserRuntime, setBrowserRuntime } from './runtime.js'
import { BrowserStore } from './store.js'
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
    snapshot: snapshotFile(),
    prompt_preview: { prompt: { system: 's', user: 'u', template_version: 'v1', context_summary: [] }, context_summary: [] },
    revision_prompt: { prompt: '스냅샷 수정 프롬프트', rationale: '스냅샷 근거', adapter: 'fixture' },
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
  setBrowserRuntime({ credential: () => null, fetch: undefined, store: new BrowserStore(() => new MemoryStorage()), now: () => new Date().toISOString(), newId: () => crypto.randomUUID() })
})

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
    expect(detail.validation_results.filter((r) => r.stage === 'V3').every((r) => r.status === 'not_run')).toBe(true)
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

  it('자격 증명이 없으면 스냅샷 동작(결과가 없는 화면은 400)을 그대로 유지한다', async () => {
    const state = snapshotOnly()
    const res = await handleAsyncWith(state, 'POST', `/api/screens/${SCREEN_DETAIL}/generation-jobs`, { ...REQUEST, screen_id: SCREEN_DETAIL })
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.data)).toContain('정적 데모')
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

  it('자격 증명이 없으면 스냅샷 예시를 그대로 쓴다', async () => {
    const state = snapshotOnly()
    const res = await handleAsyncWith(state, 'POST', `/api/screens/${SCREEN_LIST}/prompt-preview`, REQUEST)
    expect(res.status).toBe(200)
    expect(JSON.stringify(res.data)).toContain('정적 데모')
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

  it('브라우저에서 만든 revision 은 완료(v1.0) 승인을 거부하고 이유를 알린다', async () => {
    const { state, store } = browserState([modelResponse(modelOutput({ ...snapshotSpec(), screen_id: 'SAMPLE-quote-detail' }))])
    const created = await handleAsyncWith(state, 'POST', `/api/screens/${SCREEN_DETAIL}/generation-jobs`, { ...REQUEST, screen_id: SCREEN_DETAIL })
    const job = await waitJob(state, (created.data as { job_id: string }).job_id)
    const revisionId = job.result?.revision_id ?? ''

    const res = handleWith(state, 'POST', `/api/screens/${SCREEN_DETAIL}/approvals`, { revision_id: revisionId, approver: '기획자' })
    expect(res.status).toBe(400)
    const body = JSON.stringify(res.data)
    expect(body).toContain('V3')
    expect(body).toContain('산출물 파일 내려받기')
    expect(store.load().approvals).toEqual({})
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
