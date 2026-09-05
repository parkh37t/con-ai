/**
 * 정적 데모 인메모리 API — 스냅샷 조회, 상태 변경(코멘트·페인포인트·승인),
 * 작업 단계 진행, 할 수 없는 일(새 URL 분석·스냅샷에 없는 화면 생성)의 정직한 실패를 확인한다.
 * 시각은 주입해 실제 대기 없이 검사한다.
 */
import { describe, expect, it } from 'vitest'
import {
  DEMO_ASIS_RUNNING_MS,
  DEMO_MARK,
  DEMO_STAGE_INTERVAL_MS,
  createDemoState,
  handleWith,
  type DemoFiles,
  type DemoState,
} from './demo-api.js'
import { browserRuntime, setBrowserRuntime } from './browser-run/runtime.js'
import type { AsisAnalysis, Comment, Job, ProjectDetail, RevisionDetail, ScreenDetail } from './types.js'

const PROJECT = 'P1'
const SCREEN_WITH_REVISION = 'S1'
const SCREEN_WITHOUT_REVISION = 'S2'
const REVISION = 'R1'
const ARTIFACT = 'A1'
const ANALYSIS = 'AN1'

function files(): DemoFiles {
  return {
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
    prompt_preview: { prompt: { system: 's', user: 'u', template_version: 'v1', context_summary: ['원본 문맥'] }, context_summary: ['원본 문맥'] },
    revision_prompt: { prompt: '수정 프롬프트', rationale: '코멘트 1건', adapter: 'fixture' },
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

describe('생성 작업 — 단계 진행 후 스냅샷 revision 을 결과로 연결', () => {
  it('단계를 지나 succeeded 가 되고 결과가 기존 revision 을 가리킨다', () => {
    const clock = { ms: 0 }
    const state = stateAt(clock)
    const created = handleWith(state, 'POST', `/api/screens/${SCREEN_WITH_REVISION}/generation-jobs`, { task_type: 'create', purpose: '목록 생성' })
    expect(created.status).toBe(202)
    const jobId = (created.data as { job_id: string }).job_id

    const running = handleWith(state, 'GET', `/api/jobs/${jobId}`).data as Job
    expect(running.status).toBe('running')
    expect(running.current_stage).toBe('context_build')
    expect(running.context_summary?.join(' ')).toContain(DEMO_MARK)

    clock.ms = DEMO_STAGE_INTERVAL_MS * 3
    expect((handleWith(state, 'GET', `/api/jobs/${jobId}`).data as Job).current_stage).toBe('render')

    clock.ms = DEMO_STAGE_INTERVAL_MS * 6
    const done = handleWith(state, 'GET', `/api/jobs/${jobId}`).data as Job
    expect(done.status).toBe('succeeded')
    expect(done.result).toEqual({ revision_id: REVISION, artifact_id: ARTIFACT })

    // 새 화면·새 revision 을 만들어내지 않는다
    const screen = handleWith(state, 'GET', `/api/screens/${SCREEN_WITH_REVISION}`).data as ScreenDetail
    expect(screen.revisions).toHaveLength(1)
  })

  it('스냅샷에 결과가 없는 화면은 작업을 만들지 않고 400 으로 거절한다', () => {
    const res = handleWith(newState(), 'POST', `/api/screens/${SCREEN_WITHOUT_REVISION}/generation-jobs`, { task_type: 'create', purpose: '상세 생성' })
    expect(res.status).toBe(400)
    expect(res.data).toMatchObject({ error: 'demo_unavailable' })
    expect(String((res.data as { message: string }).message)).toContain('pnpm dev')
  })
})

describe('AS-IS 분석 — 새 URL 은 성공으로 위장하지 않는다', () => {
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
  it('차단 코멘트가 열려 있으면 400, 해결하면 승인되고 다시 누르면 400', () => {
    const state = newState()
    const blocking = handleWith(state, 'POST', `/api/revisions/${REVISION}/comments`, { target: 'screen', author: '디자이너', role: 'designer', text: '막는 코멘트', blocking: true }).data as Comment

    const rejected = handleWith(state, 'POST', `/api/screens/${SCREEN_WITH_REVISION}/approvals`, { revision_id: REVISION, approver: '기획자' })
    expect(rejected.status).toBe(400)
    expect(JSON.stringify(rejected.data)).toContain('approval.blocking_comments_open')

    handleWith(state, 'PATCH', `/api/comments/${blocking.id}`, { status: 'resolved', revision: 1 })
    const approved = handleWith(state, 'POST', `/api/screens/${SCREEN_WITH_REVISION}/approvals`, { revision_id: REVISION, approver: '기획자' })
    expect(approved.status).toBe(200)
    expect(approved.data).toMatchObject({ version: '1.0', export_path: 'demo/SAMPLE-quote-list/v1.0' })

    const screen = handleWith(state, 'GET', `/api/screens/${SCREEN_WITH_REVISION}`).data as ScreenDetail
    expect(screen.screen.status).toBe('approved')
    expect(screen.screen.version).toBe('1.0')
    expect(screen.revisions[0]?.artifact_status).toBe('approved')
    const project = handleWith(state, 'GET', `/api/projects/${PROJECT}`).data as ProjectDetail
    expect(project.screens[0]).toMatchObject({ status: 'approved', version: '1.0' })

    const again = handleWith(state, 'POST', `/api/screens/${SCREEN_WITH_REVISION}/approvals`, { revision_id: REVISION, approver: '기획자' })
    expect(again.status).toBe(400)
    expect(JSON.stringify(again.data)).toContain('approval.screen_already_approved')
  })

  it('스냅샷에 내보내기가 없는 revision 은 승인하지 않는다', () => {
    const state = newState()
    const res = handleWith(state, 'POST', `/api/screens/${SCREEN_WITH_REVISION}/approvals`, { revision_id: '다른-revision', approver: '기획자' })
    expect(res.status).toBe(400)
  })
})

describe('저장된 예시 응답 — 정적 데모임을 남긴다', () => {
  it('prompt-preview·revision-prompt 는 표시를 붙여 돌려준다', () => {
    const state = newState()
    const preview = handleWith(state, 'POST', `/api/screens/${SCREEN_WITH_REVISION}/prompt-preview`, {}).data as { context_summary: string[]; prompt: { context_summary: string[] } }
    expect(preview.context_summary[0]).toContain(DEMO_MARK)
    expect(preview.prompt.context_summary[0]).toContain(DEMO_MARK)
    expect(preview.context_summary).toContain('원본 문맥')

    const draft = handleWith(state, 'POST', `/api/revisions/${REVISION}/revision-prompt`, { comment_ids: ['c1'] }).data as { prompt: string; rationale: string }
    expect(draft.prompt).toBe('수정 프롬프트')
    expect(draft.rationale).toContain(DEMO_MARK)
    expect(handleWith(state, 'POST', `/api/revisions/${REVISION}/revision-prompt`, { comment_ids: [] }).status).toBe(400)
  })

  it('재검증은 저장된 결과를 그대로 돌려준다', () => {
    const res = handleWith(newState(), 'POST', `/api/artifacts/${ARTIFACT}/validations`)
    expect(res.status).toBe(200)
    expect(res.data).toMatchObject({ summary: { pass: 2, fail: 0, error: 0, not_run: 0 } })
    expect(handleWith(newState(), 'POST', '/api/artifacts/없음/validations').status).toBe(404)
  })
})
