/**
 * 정적 데모 인메모리 API — 스냅샷 조회, 상태 변경(코멘트·페인포인트·승인),
 * 작업 단계 진행, 할 수 없는 일(새 URL 분석·스냅샷에 없는 화면 생성)의 정직한 실패를 확인한다.
 * 시각은 주입해 실제 대기 없이 검사한다.
 */
import { describe, expect, it } from 'vitest'
import { DEMO_ASIS_RUNNING_MS, createDemoState, handleAsyncWith, handleWith, type DemoFiles, type DemoState } from './demo-api.js'
import { browserRuntime, setBrowserRuntime } from './browser-run/runtime.js'
import type { AsisAnalysis, AsisAnalysisSummary, Comment, Job, ProjectDetail, RevisionDetail, ScreenDetail } from './types.js'

const PROJECT = 'P1'
const SCREEN_WITH_REVISION = 'S1'
const SCREEN_WITHOUT_REVISION = 'S2'
const REVISION = 'R1'
const ARTIFACT = 'A1'
const ANALYSIS = 'AN1'

/** 미리 분석해 둔 샘플 대상 (실제 스냅샷의 `asis-samples.json` 과 같은 모양). */
const SAMPLE_TARGET = {
  id: 'partner-mall',
  label: '레거시 파트너몰',
  description: '레이블 없는 입력과 모호한 버튼 문구가 많다.',
  url: 'https://sample.local/asis-sample',
  captured_at: '2026-09-05T00:00:00.000Z',
  structure: {
    title: '레거시 파트너몰(데모)',
    lang: 'ko',
    headings: [{ level: 2, text: '레거시 파트너몰(데모)' }],
    nav_links: Array.from({ length: 18 }, (_, i) => ({ text: `메뉴${i + 1}`, href: `#menu-${i + 1}` })),
    forms: [{ name: 'login', fields: [{ type: 'text', name: 'partner_id' }, { type: 'password', name: 'partner_pw' }, { type: 'text', name: 'branch_code' }] }],
    buttons: ['클릭', '여기'],
    counts: { links: 18, images: 2, images_without_alt: 2, tables: 1, fields_without_label: 3, iframes: 1 },
  },
  screenshots: { desktop: 'sample-desktop', mobile: 'sample-mobile' },
}

function files(): DemoFiles {
  return {
    asis_samples: [SAMPLE_TARGET],
    snapshot: {
      '/api/meta': { adapter: 'fixture', model: 'fixture', version: '0.0.0', playwright: true },
      [`/api/projects/${PROJECT}`]: {
        project: { id: PROJECT, name: '데모 프로젝트', org: '와일리', description: '', profile_id: 's2b-learned-v1', created_at: '2026-09-05T00:00:00.000Z' },
        requirements: [],
        ia_nodes: [],
        screens: [
          { id: SCREEN_WITH_REVISION, external_id: 'SAMPLE-quote-list', title: '견적 목록', status: 'review', revision_count: 1, open_comments: 0 },
          { id: SCREEN_WITHOUT_REVISION, external_id: 'SAMPLE-quote-detail', title: '견적 상세', status: 'draft', revision_count: 0, open_comments: 0 },
        ],
      } satisfies ProjectDetail,
      [`/api/projects/${PROJECT}/asis-analyses`]: [{ id: ANALYSIS, url: 'http://localhost/asis-sample', status: 'succeeded', created_at: '2026-09-05T00:00:00.000Z', pain_point_count: 1 }],
      [`/api/screens/${SCREEN_WITH_REVISION}`]: {
        screen: { id: SCREEN_WITH_REVISION, project_id: PROJECT, external_id: 'SAMPLE-quote-list', title: '견적 목록', shell: 'partner-page', device: 'desktop', status: 'review', current_revision_id: REVISION, aliases: [] },
        revisions: [
          {
            id: REVISION,
            revision_no: 1,
            artifact_id: ARTIFACT,
            artifact_hash: 'hash-1',
            artifact_status: 'review_ready',
            validation_summary: { pass: 2, fail: 0, error: 0, not_run: 0 },
            open_comments: 0,
            created_at: '2026-09-05T00:00:00.000Z',
          },
        ],
      } satisfies ScreenDetail,
      [`/api/screens/${SCREEN_WITHOUT_REVISION}`]: {
        screen: { id: SCREEN_WITHOUT_REVISION, project_id: PROJECT, external_id: 'SAMPLE-quote-detail', title: '견적 상세', shell: 'partner-page', device: 'desktop', status: 'draft', aliases: [] },
        revisions: [],
      } satisfies ScreenDetail,
      [`/api/revisions/${REVISION}`]: {
        revision: { id: REVISION, screen_id: SCREEN_WITH_REVISION, revision_no: 1, spec_hash: 'spec-1', artifact_id: ARTIFACT, job_id: 'J1', created_at: '2026-09-05T00:00:00.000Z' },
        spec: { sections: [] },
        artifact: { id: ARTIFACT, kind: 'html', content_hash: 'hash-1', status: 'review_ready' },
        validation_results: [
          { id: 'V-1', artifact_hash: 'hash-1', check_id: 'V1.schema', stage: 'V1', status: 'pass', required: true, evidence: [] },
          { id: 'V-2', artifact_hash: 'hash-1', check_id: 'V2.shell', stage: 'V2', status: 'pass', required: true, evidence: [] },
        ],
        comments: [],
        element_index: [{ element_id: 'quote_no', section_id: 'search', display_no: 'a' }],
      } satisfies RevisionDetail,
      [`/api/asis-analyses/${ANALYSIS}`]: {
        id: ANALYSIS,
        project_id: PROJECT,
        url: 'http://localhost/asis-sample',
        status: 'succeeded',
        adapter: 'fixture',
        model: 'fixture',
        created_at: '2026-09-05T00:00:00.000Z',
        pain_points: [{ id: 'PP-001', area: '폼', severity: 'high', description: '레이블 없음', evidence: 'input', suggestion: 'label 연결', status: 'proposed' }],
        revision: 1,
      } satisfies AsisAnalysis,
    },
    approval: {
      screen_id: SCREEN_WITH_REVISION,
      revision_id: REVISION,
      approver: '데모 기획자',
      response: {
        approval: { id: 'AP1', artifact_id: ARTIFACT, artifact_hash: 'hash-1', approved_by: '데모 기획자', approved_at: '2026-09-05T00:00:00.000Z' },
        version: '1.0',
        export_path: 'demo/SAMPLE-quote-list/v1.0',
        files: [{ path: 'index.html', sha256: 'hash-1' }],
      },
    },
  }
}

/** 시각을 직접 넘기는 상태 (작업 단계 진행 검사용). */
function stateAt(clock: { ms: number }): DemoState {
  return createDemoState(files(), { now: () => clock.ms })
}

function newState(): DemoState {
  return createDemoState(files(), { now: () => 0 })
}

describe('GET — 스냅샷 조회', () => {
  it('저장된 경로는 그대로, 없는 경로는 404 오류 형태', () => {
    const state = newState()
    // 스냅샷 meta 는 서버에서 찍혀 playwright:true 지만, 브라우저에서는 V3 를 돌릴 수 없으므로 false 로 덮어야 한다.
    expect(handleWith(state, 'GET', '/api/meta')).toEqual({ status: 200, data: { adapter: 'fixture', model: 'fixture', version: '0.0.0', playwright: false } })
    const missing = handleWith(state, 'GET', '/api/revisions/없는것')
    expect(missing.status).toBe(404)
    expect(missing.data).toMatchObject({ error: 'not_found' })
  })
  it('브라우저 모드는 자격 증명이 있어도 실행 검사(Playwright) 가능이라고 말하지 않는다', () => {
    const state = newState()
    const before = browserRuntime.credential
    setBrowserRuntime({ credential: () => ({ kind: 'api_key', value: 'sk-ant-test-1234', persist: false }) })
    try {
      const meta = handleWith(state, 'GET', '/api/meta').data as { adapter: string; playwright: boolean }
      expect(meta.adapter).toBe('anthropic') // 자격 증명이 있으면 실제 호출 상태로 알린다
      expect(meta.playwright).toBe(false) // 그래도 V3 는 브라우저에서 돌릴 수 없다
    } finally {
      setBrowserRuntime({ credential: before })
    }
  })
  it('처리하지 않는 요청은 404 로 알린다 (조용히 성공시키지 않는다)', () => {
    expect(handleWith(newState(), 'DELETE', '/api/comments/x').status).toBe(404)
  })
})

describe('코멘트 — 작성·상태 변경이 메모리에 실제로 반영된다', () => {
  it('작성하면 목록·열린 수(화면 요약 포함)에 반영된다', () => {
    const state = newState()
    const created = handleWith(state, 'POST', `/api/revisions/${REVISION}/comments`, {
      target: 'screen',
      element_id: 'quote_no',
      author: '데모 디자이너',
      role: 'designer',
      text: '라벨을 바꿔주세요',
      blocking: true,
    })
    expect(created.status).toBe(201)
    const comment = created.data as Comment
    expect(comment).toMatchObject({ status: 'open', blocking: true, revision_id: REVISION, screen_id: SCREEN_WITH_REVISION, artifact_hash: 'hash-1', revision: 1 })

    const detail = handleWith(state, 'GET', `/api/revisions/${REVISION}`).data as RevisionDetail
    expect(detail.comments).toHaveLength(1)
    const screen = handleWith(state, 'GET', `/api/screens/${SCREEN_WITH_REVISION}`).data as ScreenDetail
    expect(screen.revisions[0]?.open_comments).toBe(1)
    const project = handleWith(state, 'GET', `/api/projects/${PROJECT}`).data as ProjectDetail
    expect(project.screens[0]?.open_comments).toBe(1)
  })

  it('작성자·내용이 비면 400', () => {
    const state = newState()
    expect(handleWith(state, 'POST', `/api/revisions/${REVISION}/comments`, { target: 'screen', author: ' ', role: 'planner', text: '내용', blocking: false }).status).toBe(400)
  })

  it('상태 PATCH 는 열린 수를 줄이고, 오래된 revision 은 409', () => {
    const state = newState()
    const comment = handleWith(state, 'POST', `/api/revisions/${REVISION}/comments`, { target: 'screen', author: '작성자', role: 'planner', text: '내용', blocking: false }).data as Comment
    const stale = handleWith(state, 'PATCH', `/api/comments/${comment.id}`, { status: 'resolved', revision: 99 })
    expect(stale.status).toBe(409)
    const ok = handleWith(state, 'PATCH', `/api/comments/${comment.id}`, { status: 'resolved', revision: 1 })
    expect(ok.status).toBe(200)
    expect((ok.data as Comment).status).toBe('resolved')
    expect((ok.data as Comment).revision).toBe(2)
    const screen = handleWith(state, 'GET', `/api/screens/${SCREEN_WITH_REVISION}`).data as ScreenDetail
    expect(screen.revisions[0]?.open_comments).toBe(0)
  })
})

describe('페인포인트 채택/거부', () => {
  it('상태가 바뀌고 문서 revision 이 올라간다', () => {
    const state = newState()
    const res = handleWith(state, 'PATCH', `/api/asis-analyses/${ANALYSIS}/pain-points/PP-001`, { status: 'adopted', revision: 1 })
    expect(res.status).toBe(200)
    const doc = res.data as AsisAnalysis
    expect(doc.pain_points[0]?.status).toBe('adopted')
    expect(doc.revision).toBe(2)
    expect(handleWith(state, 'PATCH', `/api/asis-analyses/${ANALYSIS}/pain-points/PP-001`, { status: 'rejected', revision: 1 }).status).toBe(409)
    expect(handleWith(state, 'PATCH', `/api/asis-analyses/${ANALYSIS}/pain-points/없음`, { status: 'adopted', revision: 2 }).status).toBe(404)
  })
})

/** 파이프라인은 비동기로 도므로 끝날 때까지 폴링한다. */
async function waitJob(state: DemoState, jobId: string): Promise<Job> {
  for (let i = 0; i < 400; i += 1) {
    const job = handleWith(state, 'GET', `/api/jobs/${jobId}`).data as Job
    if (job.status === 'succeeded' || job.status === 'failed') return job
    await new Promise((r) => setTimeout(r, 5))
  }
  throw new Error('작업이 끝나지 않았다')
}

describe('생성 작업 — 자격 증명이 없으면 더미 어댑터로 «실제로» 돈다', () => {
  it('스냅샷에 결과가 없는 화면도 새 revision 을 만든다 (문맥·스키마·렌더·V1·V2 는 진짜로 실행된다)', async () => {
    const state = newState()
    const created = handleWith(state, 'POST', `/api/screens/${SCREEN_WITHOUT_REVISION}/generation-jobs`, {
      screen_id: SCREEN_WITHOUT_REVISION,
      task_type: 'create',
      purpose: '견적 상세를 조회한다',
      requirement_ids: [],
      criterion_ids: [],
      reference_ids: [],
      cases: ['normal', 'empty', 'error'],
      keep_conditions: [],
      roles: ['partner'],
      device: 'desktop',
    })
    expect(created.status).toBe(202)
    const jobId = (created.data as { job_id: string }).job_id

    const job = await waitJob(state, jobId)
    expect(job.status).toBe('succeeded')
    // 더미 어댑터라는 사실을 숨기지 않는다.
    expect(job.adapter).toBe('fixture')
    expect(job.model).toBe('fixture')
    expect(job.context_summary?.join(' ')).toContain('더미 어댑터')
    // 토큰을 쓰지 않았으므로 사용량 0 을 «사용량» 처럼 적지 않는다.
    expect(job.context_summary?.join(' ')).toContain('토큰 사용량 없음')

    const revisionId = job.result?.revision_id ?? ''
    expect(revisionId).not.toBe('')
    const screen = handleWith(state, 'GET', `/api/screens/${SCREEN_WITHOUT_REVISION}`).data as ScreenDetail
    expect(screen.revisions).toHaveLength(1)
    expect(screen.screen.current_revision_id).toBe(revisionId)

    const detail = handleWith(state, 'GET', `/api/revisions/${revisionId}`).data as RevisionDetail
    expect(detail.validation_results.some((r) => r.check_id === 'V1.schema' && r.status === 'pass')).toBe(true)
    // V3 는 격리 iframe 이 필요하다. 문서가 없는 이 환경에서는 error 로 기록된다 — 통과로 바꾸지 않는다.
    expect(detail.validation_results.filter((r) => r.stage === 'V3').every((r) => r.status !== 'pass')).toBe(true)
  })

  it('기존 revision 이 있는 화면은 다음 번호로 쌓인다 (옛 결과를 새 결과처럼 보이지 않는다)', async () => {
    const state = newState()
    const created = handleWith(state, 'POST', `/api/screens/${SCREEN_WITH_REVISION}/generation-jobs`, {
      screen_id: SCREEN_WITH_REVISION,
      task_type: 'create',
      purpose: '견적 목록을 조회한다',
      requirement_ids: [],
      criterion_ids: [],
      reference_ids: [],
      cases: ['normal', 'empty', 'error'],
      keep_conditions: [],
      roles: ['partner'],
      device: 'desktop',
    })
    const job = await waitJob(state, (created.data as { job_id: string }).job_id)
    expect(job.status).toBe('succeeded')
    expect(job.result?.revision_id).not.toBe(REVISION)

    const screen = handleWith(state, 'GET', `/api/screens/${SCREEN_WITH_REVISION}`).data as ScreenDetail
    expect(screen.revisions.map((r) => r.revision_no)).toEqual([1, 2])
  })

  it('없는 화면은 404 다', () => {
    expect(handleWith(newState(), 'POST', '/api/screens/없는것/generation-jobs', { task_type: 'create', purpose: 'x' }).status).toBe(404)
  })
})

describe('AS-IS 분석 — 샘플 대상은 실제로 규칙을 돌린다', () => {
  it('대기 → 실행 중 → 성공. 구조·스크린샷은 기록, 페인포인트는 지금 만든다', async () => {
    const clock = { ms: 0 }
    const state = stateAt(clock)
    const created = handleWith(state, 'POST', `/api/projects/${PROJECT}/asis-analyses`, { url: SAMPLE_TARGET.url, note: '샘플' })
    expect(created.status).toBe(202)
    const id = (created.data as { analysis_id: string }).analysis_id

    expect((handleWith(state, 'GET', `/api/asis-analyses/${id}`).data as AsisAnalysis).status).toBe('queued')
    clock.ms = DEMO_ASIS_RUNNING_MS + 1
    // 초안이 끝날 때까지 running 이다 (미완성을 성공으로 바꾸지 않는다).
    for (let i = 0; i < 100; i += 1) {
      const doc = handleWith(state, 'GET', `/api/asis-analyses/${id}`).data as AsisAnalysis
      if (doc.status === 'succeeded') break
      expect(doc.status).toBe('running')
      await new Promise((r) => setTimeout(r, 5))
    }

    const doc = handleWith(state, 'GET', `/api/asis-analyses/${id}`).data as AsisAnalysis
    expect(doc.status).toBe('succeeded')
    // 더미 어댑터 규칙이라는 사실을 그대로 적는다.
    expect(doc.adapter).toBe('fixture')
    expect(doc.structure).toEqual(SAMPLE_TARGET.structure)
    expect(doc.screenshots).toEqual(SAMPLE_TARGET.screenshots)
    expect(doc.pain_points.length).toBeGreaterThan(0)
    expect(doc.pain_points[0]?.id).toBe('PP-001')
    expect(doc.pain_points.every((p) => p.status === 'proposed')).toBe(true)
    // 레이블 없는 입력 3개는 반드시 잡혀야 한다 (규칙이 실제로 돌았다는 근거).
    expect(JSON.stringify(doc.pain_points)).toContain('fields_without_label=3')

    const list = handleWith(state, 'GET', `/api/projects/${PROJECT}/asis-analyses`).data as AsisAnalysisSummary[]
    expect(list.find((a) => a.id === id)?.pain_point_count).toBe(doc.pain_points.length)
  })
})

describe('AS-IS 분석 — 샘플이 아닌 URL 은 성공으로 위장하지 않는다', () => {
  it('실행 중을 보인 뒤 실패로 끝나고 안내 문구를 남긴다', () => {
    const clock = { ms: 0 }
    const state = stateAt(clock)
    const created = handleWith(state, 'POST', `/api/projects/${PROJECT}/asis-analyses`, { url: 'https://example.com', note: '메모' })
    expect(created.status).toBe(202)
    const id = (created.data as { analysis_id: string }).analysis_id

    clock.ms = 2000
    expect((handleWith(state, 'GET', `/api/asis-analyses/${id}`).data as AsisAnalysis).status).toBe('running')

    clock.ms = DEMO_ASIS_RUNNING_MS
    const failed = handleWith(state, 'GET', `/api/asis-analyses/${id}`).data as AsisAnalysis
    expect(failed.status).toBe('failed')
    expect(failed.failure?.message).toContain('브라우저에서는 다른 사이트를 캡처할 수 없습니다')
    expect(failed.pain_points).toEqual([])

    // 목록 요약에도 같은 상태가 반영된다
    const list = handleWith(state, 'GET', `/api/projects/${PROJECT}/asis-analyses`).data as Array<{ id: string; status: string }>
    expect(list.find((a) => a.id === id)?.status).toBe('failed')
    // 스냅샷에 이미 있는 분석은 그대로 성공
    expect(list.find((a) => a.id === ANALYSIS)?.status).toBe('succeeded')
    expect((handleWith(state, 'GET', `/api/asis-analyses/${ANALYSIS}`).data as AsisAnalysis).status).toBe('succeeded')
  })

  it('http/https 가 아니면 400', () => {
    expect(handleWith(newState(), 'POST', `/api/projects/${PROJECT}/asis-analyses`, { url: 'ftp://x' }).status).toBe(400)
  })
})

describe('승인 — 차단 코멘트·중복 승인은 실제 서버처럼 거부한다', () => {
  it('차단 코멘트가 열려 있으면 400, 해결하면 승인되고 다시 누르면 400', async () => {
    const state = newState()
    const blocking = handleWith(state, 'POST', `/api/revisions/${REVISION}/comments`, { target: 'screen', author: '디자이너', role: 'designer', text: '막는 코멘트', blocking: true }).data as Comment

    const rejected = await handleAsyncWith(state, 'POST', `/api/screens/${SCREEN_WITH_REVISION}/approvals`, { revision_id: REVISION, approver: '기획자' })
    expect(rejected.status).toBe(400)
    expect(JSON.stringify(rejected.data)).toContain('approval.blocking_comments_open')

    handleWith(state, 'PATCH', `/api/comments/${blocking.id}`, { status: 'resolved', revision: 1 })
    const approved = await handleAsyncWith(state, 'POST', `/api/screens/${SCREEN_WITH_REVISION}/approvals`, { revision_id: REVISION, approver: '기획자' })
    expect(approved.status).toBe(200)
    expect(approved.data).toMatchObject({ version: '1.0', export_path: 'demo/SAMPLE-quote-list/v1.0' })

    const screen = handleWith(state, 'GET', `/api/screens/${SCREEN_WITH_REVISION}`).data as ScreenDetail
    expect(screen.screen.status).toBe('approved')
    expect(screen.screen.version).toBe('1.0')
    expect(screen.revisions[0]?.artifact_status).toBe('approved')
    const project = handleWith(state, 'GET', `/api/projects/${PROJECT}`).data as ProjectDetail
    expect(project.screens[0]).toMatchObject({ status: 'approved', version: '1.0' })

    const again = await handleAsyncWith(state, 'POST', `/api/screens/${SCREEN_WITH_REVISION}/approvals`, { revision_id: REVISION, approver: '기획자' })
    expect(again.status).toBe(400)
    expect(JSON.stringify(again.data)).toContain('approval.screen_already_approved')
  })

  it('스냅샷에 내보내기가 없는 revision 은 승인하지 않는다', async () => {
    const state = newState()
    const res = await handleAsyncWith(state, 'POST', `/api/screens/${SCREEN_WITH_REVISION}/approvals`, { revision_id: '다른-revision', approver: '기획자' })
    expect(res.status).toBe(400)
  })
})

describe('프롬프트 미리보기·수정 초안 — 저장된 예시가 아니라 이번 요청으로 조립한다', () => {
  it('프롬프트 미리보기는 이번 요청의 문맥으로 그 자리에서 조립된다', () => {
    const state = newState()
    const preview = handleWith(state, 'POST', `/api/screens/${SCREEN_WITH_REVISION}/prompt-preview`, {
      screen_id: SCREEN_WITH_REVISION,
      task_type: 'create',
      purpose: '견적 목록을 조회한다',
      requirement_ids: [],
      criterion_ids: [],
      reference_ids: [],
      cases: ['normal'],
      keep_conditions: [],
      roles: ['partner'],
      device: 'desktop',
    }).data as { context_summary: string[]; prompt: { system: string; user: string; context_summary?: string[] } }
    expect(preview.context_summary[0]).toContain('더미 어댑터')
    expect(preview.context_summary.join(' ')).toContain('견적 목록을 조회한다')
    expect(preview.prompt.user).toContain('견적 목록을 조회한다')
  })

  it('수정 프롬프트 초안은 더미 어댑터가 코멘트에서 만든다 (adapter 를 fixture 로 적는다)', async () => {
    const state = newState()
    const created = handleWith(state, 'POST', `/api/revisions/${REVISION}/comments`, {
      target: 'screen',
      element_id: 'quote_no',
      author: '데모 디자이너',
      role: 'designer',
      text: '견적번호 라벨을 「견적 번호」로 바꿔주세요',
      blocking: false,
    })
    const commentId = (created.data as Comment).id
    const res = await handleAsyncWith(state, 'POST', `/api/revisions/${REVISION}/revision-prompt`, { comment_ids: [commentId] })
    // 스냅샷 revision 의 spec 은 최소 형태라 명세를 읽지 못하면 지어내지 않고 실패로 알린다.
    if (res.status === 200) {
      const draft = res.data as { prompt: string; rationale: string; adapter: string }
      expect(draft.adapter).toBe('fixture')
      expect(draft.prompt).toContain('견적 번호')
    } else {
      expect(res.status).toBe(400)
      expect(res.data).toMatchObject({ error: 'model_error' })
    }
    expect((await handleAsyncWith(state, 'POST', `/api/revisions/${REVISION}/revision-prompt`, { comment_ids: [] })).status).toBe(400)
  })

  it('재검증은 저장된 결과를 그대로 돌려준다', () => {
    const res = handleWith(newState(), 'POST', `/api/artifacts/${ARTIFACT}/validations`)
    expect(res.status).toBe(200)
    expect(res.data).toMatchObject({ summary: { pass: 2, fail: 0, error: 0, not_run: 0 } })
    expect(handleWith(newState(), 'POST', '/api/artifacts/없음/validations').status).toBe(404)
  })
})
