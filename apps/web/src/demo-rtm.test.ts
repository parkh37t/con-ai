/**
 * 정적 데모의 추적 체인·ID 발번 (`#/trace` 가 배포 주소에서 동작하는 근거).
 *
 * 확인하는 것:
 * - 커버리지·갭 제안이 서버와 같은 도메인 함수로 계산된다 (숫자를 화면이 지어내지 않는다).
 * - 발번은 행위자·사유가 있어야 하고, 낙관적 잠금·제안 해시·스키마 검사를 서버와 같은 지점에서 한다.
 * - 발번 결과가 이 브라우저에 남고 새로고침(상태 재생성) 후에도 이어진다.
 * - 저장하지 못하면 그 사실을 응답에 적는다 (조용히 성공으로 보이게 두지 않는다).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { BrowserStore } from './browser-run/store.js'
import { browserRuntime, setBrowserRuntime } from './browser-run/runtime.js'
import { MemoryStorage } from './browser-run/test-helpers.js'
import { createDemoState, handleWith, type DemoFiles, type DemoState } from './demo-api.js'
import { demoRtmInput } from './demo-rtm.js'
import type { IANode, IdIssueResponse, ProjectDetail, RevisionDetail, RtmReport, ScreenDetail } from './types.js'

const PROJECT = 'a1000000-0000-4000-8000-000000000001'
const NODE_PORTAL = 'a2000000-0000-4000-8000-000000000001'
const NODE_CATEGORY = 'a2000000-0000-4000-8000-000000000002'
const NODE_LIST = 'a2000000-0000-4000-8000-000000000003'
const NODE_POPUP = 'a2000000-0000-4000-8000-000000000005'
const SCREEN_LIST = 'a4000000-0000-4000-8000-000000000001'
const SCREEN_POPUP = 'a4000000-0000-4000-8000-000000000003'
const REVISION = 'a5000000-0000-4000-8000-000000000001'
const ARTIFACT = 'a6000000-0000-4000-8000-000000000001'

const ORIGINAL_STORE = browserRuntime.store
const ORIGINAL_NEW_ID = browserRuntime.newId
const ORIGINAL_NOW = browserRuntime.now

/** 이 브라우저를 흉내낸 저장소로 갈아끼운다 (실제 localStorage 는 node 에 없다). */
function useMemoryStore(): BrowserStore {
  const store = new BrowserStore(() => new MemoryStorage())
  setBrowserRuntime({ store, now: () => '2026-09-06T00:00:00.000Z' })
  return store
}

afterEach(() => {
  setBrowserRuntime({ store: ORIGINAL_STORE, newId: ORIGINAL_NEW_ID, now: ORIGINAL_NOW })
})

function iaNodes(): IANode[] {
  return [
    { id: NODE_PORTAL, project_id: PROJECT, parent_id: null, name: '파트너 포털', order: 0, portal: '파트너 포털', kind: 'category' },
    { id: NODE_CATEGORY, project_id: PROJECT, parent_id: NODE_PORTAL, name: '견적', order: 0, portal: '파트너 포털', kind: 'category' },
    { id: NODE_LIST, project_id: PROJECT, parent_id: NODE_CATEGORY, name: '견적 목록', order: 0, portal: '파트너 포털', kind: 'screen', screen_plan_id: SCREEN_LIST, requirement_ids: ['REQ-QT-001'] },
    { id: NODE_POPUP, project_id: PROJECT, parent_id: NODE_CATEGORY, name: '견적 등록 팝업', order: 1, portal: '파트너 포털', kind: 'screen', screen_plan_id: SCREEN_POPUP },
  ]
}

function files(): DemoFiles {
  const project: ProjectDetail = {
    project: { id: PROJECT, name: '데모 프로젝트', org: '와일리', description: '', profile_id: 's2b-learned-v1', created_at: '2026-09-05T00:00:00.000Z' },
    requirements: [
      { id: 'r1', project_id: PROJECT, external_id: 'REQ-QT-001', title: '견적 목록 조회', body: '', criteria: [{ id: 'c1', text: '목록을 본다', kind: 'ui' }] },
      { id: 'r2', project_id: PROJECT, external_id: 'REQ-QT-002', title: '견적 상세 조회', body: '', criteria: [{ id: 'c2', text: '상세를 본다', kind: 'ui' }] },
    ],
    ia_nodes: iaNodes(),
    screens: [
      { id: SCREEN_LIST, external_id: 'SAMPLE-quote-list', title: '견적 목록', status: 'review', revision_count: 1, open_comments: 0, current_revision_id: REVISION },
      { id: SCREEN_POPUP, external_id: 'SAMPLE-quote-new', title: '견적 등록 팝업', status: 'draft', revision_count: 0, open_comments: 0 },
    ],
  }
  const screen: ScreenDetail = {
    screen: { id: SCREEN_LIST, project_id: PROJECT, external_id: 'SAMPLE-quote-list', title: '견적 목록', shell: 'partner-page', device: 'desktop', status: 'review', current_revision_id: REVISION, aliases: [] },
    revisions: [
      {
        id: REVISION,
        revision_no: 1,
        artifact_id: ARTIFACT,
        artifact_hash: 'hash-1',
        artifact_status: 'review_ready',
        validation_summary: { pass: 1, fail: 0, error: 0, not_run: 0 },
        open_comments: 0,
        created_at: '2026-09-05T00:00:00.000Z',
      },
    ],
  }
  const revision: RevisionDetail = {
    revision: { id: REVISION, screen_id: SCREEN_LIST, revision_no: 1, spec_hash: 'spec-1', artifact_id: ARTIFACT, job_id: 'J1', created_at: '2026-09-05T00:00:00.000Z' },
    spec: { sections: [] },
    artifact: { id: ARTIFACT, kind: 'html', content_hash: 'hash-1', status: 'review_ready' },
    validation_results: [],
    comments: [],
    element_index: [{ element_id: 'quote_no', section_id: 'search', display_no: 'a' }],
  }
  return {
    asis_samples: [],
    snapshot: {
      '/api/meta': { adapter: 'fixture', model: 'fixture', version: '0.0.0', playwright: true },
      [`/api/projects/${PROJECT}`]: project,
      [`/api/screens/${SCREEN_LIST}`]: screen,
      [`/api/revisions/${REVISION}`]: revision,
    },
    approval: {
      screen_id: SCREEN_LIST,
      revision_id: REVISION,
      approver: '데모 기획자',
      response: {
        approval: { id: 'AP1', artifact_id: ARTIFACT, artifact_hash: 'hash-1', approved_by: '데모 기획자', approved_at: '2026-09-05T00:00:00.000Z' },
        version: '1.0',
        export_path: 'demo/SAMPLE-quote-list/v1.0',
        files: [],
      },
    },
  }
}

function newState(store?: BrowserStore): DemoState {
  return createDemoState(files(), { now: () => 0, ...(store ? { store } : {}) })
}

function rtm(state: DemoState): RtmReport {
  const res = handleWith(state, 'GET', `/api/projects/${PROJECT}/rtm`)
  expect(res.status).toBe(200)
  return res.data as RtmReport
}

function issue(state: DemoState, nodeId: string, body: Record<string, unknown>) {
  return handleWith(state, 'POST', `/api/ia-nodes/${nodeId}/id-issuances`, body)
}

describe('GET /api/projects/:id/rtm — 서버와 같은 규칙으로 계산한다', () => {
  it('IA 까지만 닿은 요구사항을 통과로 세지 않는다 (분자는 SCR 까지 닿은 것뿐)', () => {
    useMemoryStore()
    const report = rtm(newState())
    expect(report.summary.requirements_total).toBe(2)
    expect(report.summary.mapped).toBe(0) // 기능(FN)이 없어 체인이 끊긴다
    expect(report.summary.partial).toBe(1) // REQ-QT-001 — IA 는 연결됐다
    expect(report.summary.unmapped).toBe(1) // REQ-QT-002 — 담당 IA 가 없다
    expect(report.summary.req_to_scr_ratio).toBe(0)
    expect(report.rows.find((r) => r.requirement_external_id === 'REQ-QT-001')?.gap_reason).toContain('기능(FN)')
    // 미실행 검증을 통과로 표시하지 않는다.
    expect(report.summary.test_pass.status).toBe('not_run')
    // 발번한 노드가 없으므로 0 이다 (스냅샷이 번호를 미리 박아 두지 않는다).
    expect(report.summary.ia_nodes_issued).toBe(0)
  })

  it('연결·기능 정의를 끝내면 체인이 SCR 까지 닿아 분자에 든다', () => {
    useMemoryStore()
    setBrowserRuntime({ newId: () => 'a7000000-0000-4000-8000-000000000001' })
    const state = newState()
    handleWith(state, 'PATCH', `/api/ia-nodes/${NODE_LIST}`, { revision: 1, by: '기획자', reason: '기능 정의', add_function: { name: '견적 검색' } })
    const report = rtm(state)
    expect(report.summary.mapped).toBe(1)
    expect(report.summary.req_to_scr_ratio).toBe(0.5)
  })

  it('없는 프로젝트는 404 다', () => {
    useMemoryStore()
    expect(handleWith(newState(), 'GET', '/api/projects/없는것/rtm').status).toBe(404)
  })

  it('아직 생성하지 않은 화면은 명세 색인에서 빼 «미실행» 으로 남긴다 (요소 0개로 넘기지 않는다)', () => {
    useMemoryStore()
    const state = newState()
    const detail = handleWith(state, 'GET', `/api/projects/${PROJECT}`).data as ProjectDetail
    const input = demoRtmInput(state, detail)
    expect(input.spec_indexes?.map((i) => i.screen_plan_id)).toEqual([SCREEN_LIST])
  })
})

describe('GET /api/ia-nodes/:id', () => {
  it('노드와 현재 revision 을 돌려준다 (스냅샷 노드는 1 에서 시작)', () => {
    useMemoryStore()
    const res = handleWith(newState(), 'GET', `/api/ia-nodes/${NODE_LIST}`)
    expect(res.status).toBe(200)
    expect(res.data).toMatchObject({ revision: 1, ia_node: { id: NODE_LIST, name: '견적 목록' } })
  })

  it('없는 노드는 404 다', () => {
    useMemoryStore()
    expect(handleWith(newState(), 'GET', '/api/ia-nodes/없는것').status).toBe(404)
  })
})

describe('PATCH /api/ia-nodes/:id — 연결·기능 정의 (번호는 붙이지 않는다)', () => {
  it('요구사항을 연결하면 미매핑이 줄고 revision 이 오른다 (그렇다고 통과가 되지는 않는다)', () => {
    useMemoryStore()
    const state = newState()
    const res = handleWith(state, 'PATCH', `/api/ia-nodes/${NODE_POPUP}`, { revision: 1, by: '기획자', reason: '갭 승인', requirement_ids: ['REQ-QT-002'] })
    expect(res.status).toBe(200)
    expect(res.data).toMatchObject({ revision: 2 })
    const report = rtm(state)
    expect(report.summary.unmapped).toBe(0)
    expect(report.summary.partial).toBe(2) // 둘 다 아직 기능(FN)이 없다
    expect(report.summary.mapped).toBe(0)
  })

  it('없는 요구사항은 연결하지 않는다 (커버리지가 거짓이 된다)', () => {
    useMemoryStore()
    const state = newState()
    const res = handleWith(state, 'PATCH', `/api/ia-nodes/${NODE_POPUP}`, { revision: 1, by: '기획자', reason: '갭 승인', requirement_ids: ['REQ-없음'] })
    expect(res.status).toBe(400)
    expect(res.data).toMatchObject({ error: 'requirement_not_found' })
    expect(rtm(state).summary.unmapped).toBe(1) // 저장되지 않았다
  })

  it('행위자·사유가 없으면 거절한다', () => {
    useMemoryStore()
    const res = handleWith(newState(), 'PATCH', `/api/ia-nodes/${NODE_POPUP}`, { revision: 1, by: '  ', reason: '', requirement_ids: [] })
    expect(res.status).toBe(400)
    expect(res.data).toMatchObject({ error: 'invalid_request' })
  })

  it('본 revision 이 낡았으면 409 로 알린다', () => {
    useMemoryStore()
    const state = newState()
    handleWith(state, 'PATCH', `/api/ia-nodes/${NODE_POPUP}`, { revision: 1, by: '기획자', reason: '연결', requirement_ids: ['REQ-QT-002'] })
    const again = handleWith(state, 'PATCH', `/api/ia-nodes/${NODE_POPUP}`, { revision: 1, by: '기획자', reason: '또', requirement_ids: [] })
    expect(again.status).toBe(409)
    expect(again.data).toMatchObject({ error: 'stale_revision', expected: 1, current: 2 })
  })

  it('기능을 추가해도 번호는 붙지 않는다 (발번은 따로 사람이 누른다)', () => {
    useMemoryStore()
    setBrowserRuntime({ newId: () => 'a7000000-0000-4000-8000-000000000001' })
    const state = newState()
    const res = handleWith(state, 'PATCH', `/api/ia-nodes/${NODE_LIST}`, { revision: 1, by: '기획자', reason: '기능 정의', add_function: { name: '견적 검색' } })
    expect(res.status).toBe(200)
    const node = (res.data as { ia_node: IANode }).ia_node
    expect(node.functions).toEqual([{ id: 'a7000000-0000-4000-8000-000000000001', name: '견적 검색', kind: 'normal' }])
    expect(rtm(state).summary.functions_issued).toBe(0)
  })
})

describe('POST /api/ia-nodes/:id/id-issuances — 사람이 누른 발번만 저장한다', () => {
  it('포털부터 3단으로 번호를 다시 계산하고 같으면 그대로 발번한다', () => {
    useMemoryStore()
    const state = newState()
    const proposed = rtm(state).proposals.find((p) => p.kind === 'issue_ia_id' && p.ia_node_id === NODE_LIST)
    expect(proposed?.suggested_value).toBe('IA-1.1.1')
    const res = issue(state, NODE_LIST, { external_id: 'IA-1.1.1', by: '기획자', reason: 'IA 확정', revision: 1, expected_proposal_hash: proposed?.proposal_hash })
    expect(res.status).toBe(200)
    const data = res.data as IdIssueResponse
    expect(data.differs).toBe(false)
    expect(data.ia_node.external_id).toBe('IA-1.1.1')
    expect(data.ia_node.issued).toMatchObject({ by: '기획자', reason: 'IA 확정' })
    expect(rtm(state).summary.ia_nodes_issued).toBe(1)
  })

  it('사람이 다른 번호를 넣으면 저장하되 다시 계산한 값과 다르다고 알린다', () => {
    useMemoryStore()
    const state = newState()
    const res = issue(state, NODE_LIST, { external_id: 'IA-9.9.9', by: '기획자', reason: '수동 지정', revision: 1 })
    expect(res.status).toBe(200)
    const data = res.data as IdIssueResponse
    expect(data.differs).toBe(true)
    expect(data.recomputed_external_id).toBe('IA-1.1.1')
  })

  it('사유가 없으면 발번하지 않는다', () => {
    useMemoryStore()
    const state = newState()
    const res = issue(state, NODE_LIST, { external_id: 'IA-1.1.1', by: '기획자', reason: '   ', revision: 1 })
    expect(res.status).toBe(400)
    expect(rtm(state).summary.ia_nodes_issued).toBe(0)
  })

  it('형식이 틀린 번호는 스키마에서 막는다', () => {
    useMemoryStore()
    const res = issue(newState(), NODE_LIST, { external_id: 'IA-01.1.1', by: '기획자', reason: '오타', revision: 1 })
    expect(res.status).toBe(400)
  })

  it('화면이 본 제안이 그 사이 바뀌었으면 승인하지 않는다', () => {
    useMemoryStore()
    const state = newState()
    const res = issue(state, NODE_LIST, { external_id: 'IA-1.1.1', by: '기획자', reason: 'IA 확정', revision: 1, expected_proposal_hash: '틀린해시' })
    expect(res.status).toBe(409)
    expect(res.data).toMatchObject({ error: 'stale_proposal' })
  })

  it('같은 번호를 다른 노드에 다시 발번하지 않는다', () => {
    useMemoryStore()
    const state = newState()
    expect(issue(state, NODE_LIST, { external_id: 'IA-1.1.1', by: '기획자', reason: '확정', revision: 1 }).status).toBe(200)
    const dup = issue(state, NODE_POPUP, { external_id: 'IA-1.1.1', by: '기획자', reason: '중복', revision: 1 })
    expect(dup.status).toBe(400)
    expect(dup.data).toMatchObject({ error: 'id_issuance_rejected' })
  })

  it('FN 번호는 소속 IA 번호를 따른다', () => {
    useMemoryStore()
    setBrowserRuntime({ newId: () => 'a7000000-0000-4000-8000-000000000002' })
    const state = newState()
    issue(state, NODE_LIST, { external_id: 'IA-1.1.1', by: '기획자', reason: '확정', revision: 1 })
    handleWith(state, 'PATCH', `/api/ia-nodes/${NODE_LIST}`, { revision: 2, by: '기획자', reason: '기능 정의', add_function: { name: '견적 검색' } })
    const proposal = rtm(state).proposals.find((p) => p.kind === 'issue_fn_id' && p.ia_node_id === NODE_LIST)
    expect(proposal?.suggested_value).toBe('FN-1.1.1-01')
    const res = issue(state, NODE_LIST, {
      external_id: 'FN-1.1.1-01',
      by: '기획자',
      reason: 'FN 확정',
      revision: 3,
      function_id: 'a7000000-0000-4000-8000-000000000002',
    })
    expect(res.status).toBe(200)
    expect(rtm(state).summary.functions_issued).toBe(1)
  })
})

describe('POST /api/ia-nodes/:id/id-relabels — 옛 번호를 지우지 않는다', () => {
  it('개명하면 옛 값이 별칭으로 남는다', () => {
    useMemoryStore()
    const state = newState()
    issue(state, NODE_LIST, { external_id: 'IA-1.1.1', by: '기획자', reason: '확정', revision: 1 })
    const res = handleWith(state, 'POST', `/api/ia-nodes/${NODE_LIST}/id-relabels`, { external_id: 'IA-1.1.2', by: '기획자', reason: '트리 이동', revision: 2 })
    expect(res.status).toBe(200)
    const node = (res.data as { ia_node: IANode }).ia_node
    expect(node.external_id).toBe('IA-1.1.2')
    expect(node.aliases).toEqual([expect.objectContaining({ external_id: 'IA-1.1.1', reason: '트리 이동', by: '기획자' })])
  })

  it('발번된 적 없는 노드는 개명할 수 없다', () => {
    useMemoryStore()
    const res = handleWith(newState(), 'POST', `/api/ia-nodes/${NODE_POPUP}/id-relabels`, { external_id: 'IA-1.1.2', by: '기획자', reason: '이동', revision: 1 })
    expect(res.status).toBe(400)
    expect(res.data).toMatchObject({ error: 'id_relabel_rejected' })
  })
})

describe('이 브라우저에 남는다 — 새로고침 후에도 이어진다', () => {
  it('발번·연결 결과가 저장되고 상태를 다시 만들어도 유지된다', () => {
    const store = useMemoryStore()
    const state = newState(store)
    issue(state, NODE_LIST, { external_id: 'IA-1.1.1', by: '기획자', reason: '확정', revision: 1 })
    handleWith(state, 'PATCH', `/api/ia-nodes/${NODE_POPUP}`, { revision: 1, by: '기획자', reason: '연결', requirement_ids: ['REQ-QT-002'] })

    // 새로고침 = 스냅샷 파일을 다시 읽고 이 브라우저의 저장분을 얹는다.
    const reloaded = newState(store)
    const node = handleWith(reloaded, 'GET', `/api/ia-nodes/${NODE_LIST}`).data as { ia_node: IANode; revision: number }
    expect(node.ia_node.external_id).toBe('IA-1.1.1')
    expect(node.revision).toBe(2) // 낙관적 잠금 값도 이어진다
    expect(rtm(reloaded).summary.ia_nodes_issued).toBe(1)
    expect(rtm(reloaded).summary.partial).toBe(2)
  })

  it('저장하지 못하면 그 사실을 응답에 적는다 (조용히 성공으로 보이게 두지 않는다)', () => {
    setBrowserRuntime({ store: new BrowserStore(() => null), now: () => '2026-09-06T00:00:00.000Z' })
    const res = issue(newState(), NODE_LIST, { external_id: 'IA-1.1.1', by: '기획자', reason: '확정', revision: 1 })
    expect(res.status).toBe(200)
    expect((res.data as { storage_warning?: string }).storage_warning).toContain('새로고침')
  })
})
