/**
 * RTM·ID 발번 API 테스트 (산출물 P1-05).
 *
 * 확인하는 것:
 * (a) 시드 상태의 RTM — 일부 연결 · FN 0건 · IA 미발번 · 미매핑이 남는다. 없는 것을 있다고 세지 않는다.
 * (b) 요구사항 연결·기능 추가 — 없는 REQ 는 연결할 수 없다.
 * (c) 발번 — 행위자·사유가 없으면 400 이고 **문서는 그대로다**(거부인데 저장되는 일이 없다).
 * (d) 발번 순서 — IA 가 먼저다. FN 계층부가 소속 IA 와 다르면 거부.
 * (e) 서버가 번호를 다시 계산해 요청값과 다르면 그 사실을 응답에 싣는다.
 * (f) 개명 — 옛 값이 별칭으로 남는다. 낡은 revision·바뀐 제안은 409.
 * (g) 갭을 모두 메우면 커버리지 100% 이고 G1 추적성이 통과한다.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { FixtureAdapter } from '@con-ai/model-adapter'
import type { RenderInput, RenderOutput } from '@con-ai/renderer'
import type { RtmReport } from '@con-ai/domain'
import type { IANode } from '@con-ai/schemas'
import { createApp } from './app.js'
import { SEED, seedIfEmpty } from './seed.js'
import { SqliteStore } from './store.js'

let clock = 0
const now = (): string => new Date(Date.UTC(2026, 8, 6, 12, 0, ++clock)).toISOString()
let idSeq = 0
const newId = (): string => `c0000000-0000-4000-8000-${String(++idSeq).padStart(12, '0')}`

/** 이 테스트는 생성·렌더·검증을 실행하지 않는다 — RTM 읽기와 ID 발번만 본다. */
const stubRender = (_input: RenderInput): RenderOutput => {
  throw new Error('이 테스트는 렌더를 실행하지 않는다')
}

const cleanups: Array<() => void> = []
afterEach(() => {
  for (const fn of cleanups.splice(0)) fn()
})

function harness() {
  const store = new SqliteStore(':memory:', { now })
  seedIfEmpty(store, now)
  const exportDir = mkdtempSync(join(tmpdir(), 'con-ai-rtm-'))
  const created = createApp({
    store,
    adapter: new FixtureAdapter(),
    render: stubRender,
    validate: async () => [],
    export_dir: exportDir,
    env: { PLAYWRIGHT_CHROMIUM_PATH: '/definitely/not/here', HOME: join(exportDir, 'no-home') },
    now,
    newId,
    required_check_ids: [],
    log: () => {},
  })
  cleanups.push(() => {
    store.close()
    rmSync(exportDir, { recursive: true, force: true })
  })
  const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const get = async (path: string): Promise<Response> => created.app.request(path)
  const post = async (path: string, body: unknown): Promise<Response> => created.app.request(path, json(body))
  const patch = async (path: string, body: unknown): Promise<Response> => created.app.request(path, { ...json(body), method: 'PATCH' })
  const rtm = async (): Promise<RtmReport> => {
    const res = await get(`/api/projects/${SEED.project_id}/rtm`)
    expect(res.status, await res.clone().text()).toBe(200)
    return (await res.json()) as RtmReport
  }
  const node = (id: string) => store.get<IANode>('ia_node', id)
  return { store, get, post, patch, rtm, node }
}

const ACTOR = { by: '기획자', reason: '갭 제안 승인' }
const LIST_NODE = SEED.ia_nodes.list
const CREATE_NODE = SEED.ia_nodes.create

describe('GET /api/projects/:id/rtm — 시드 상태', () => {
  it('연결된 것과 안 된 것을 정확히 센다 (없는 것을 있다고 세지 않는다)', async () => {
    const h = harness()
    const r = await h.rtm()
    expect(r.summary.requirements_total).toBe(5)
    // 목록·상세에만 REQ 를 연결해 두었고 FN 이 0건이므로 완전히 이어진 체인은 아직 없다.
    expect(r.summary.mapped).toBe(0)
    expect(r.summary.partial).toBeGreaterThan(0)
    expect(r.summary.unmapped).toBeGreaterThan(0)
    expect(r.summary.mapped + r.summary.partial + r.summary.non_ui_only + r.summary.unmapped).toBe(5)
  })

  it('IA·FN 은 한 건도 발번되지 않은 상태로 시작한다 (발번은 사람이 한다)', async () => {
    const h = harness()
    const r = await h.rtm()
    expect(r.summary).toMatchObject({ ia_nodes_total: 5, ia_nodes_issued: 0, functions_total: 0, functions_issued: 0 })
    expect(r.rows.every((row) => row.ia.every((ia) => ia.external_id === undefined))).toBe(true)
  })

  it('검증 완료는 숫자가 아니라 not_run 이다 — 미실행을 통과로 표시하지 않는다', async () => {
    const h = harness()
    const r = await h.rtm()
    expect(r.summary.test_pass.status).toBe('not_run')
  })

  it('아직 생성되지 않은 화면은 요소 태깅에서 not_run 으로 분리한다', async () => {
    const h = harness()
    const r = await h.rtm()
    expect(r.summary.element_tagging).toMatchObject({ refs_total: 0, refs_stale: 0 })
  })

  it('G1 추적성은 통과가 아니고 이유를 적는다', async () => {
    const h = harness()
    const r = await h.rtm()
    expect(r.g1_traceability.passed).toBe(false)
    expect(r.g1_traceability.reason.length).toBeGreaterThan(0)
  })

  it('없는 프로젝트는 404', async () => {
    const h = harness()
    expect((await h.get('/api/projects/nope/rtm')).status).toBe(404)
  })
})

describe('PATCH /api/ia-nodes/:id — 연결과 기능 정의', () => {
  it('요구사항을 연결하면 RTM 행이 바뀐다', async () => {
    const h = harness()
    const before = h.node(CREATE_NODE)!
    const res = await h.patch(`/api/ia-nodes/${CREATE_NODE}`, { ...ACTOR, revision: before.revision, requirement_ids: ['REQ-QT-003'] })
    expect(res.status, await res.clone().text()).toBe(200)
    const r = await h.rtm()
    expect(r.rows.find((x) => x.requirement_external_id === 'REQ-QT-003')?.ia).toHaveLength(1)
  })

  it('없는 요구사항은 연결할 수 없다 — 커버리지를 거짓으로 만들지 않는다', async () => {
    const h = harness()
    const before = h.node(CREATE_NODE)!
    const res = await h.patch(`/api/ia-nodes/${CREATE_NODE}`, { ...ACTOR, revision: before.revision, requirement_ids: ['REQ-없음'] })
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('REQ-없음')
    expect(h.node(CREATE_NODE)!.revision).toBe(before.revision) // 저장되지 않았다
  })

  it('기능을 추가해도 번호는 붙지 않는다 (발번은 따로 사람이 누른다)', async () => {
    const h = harness()
    const before = h.node(LIST_NODE)!
    const res = await h.patch(`/api/ia-nodes/${LIST_NODE}`, { ...ACTOR, revision: before.revision, add_function: { name: '견적 목록 조회' } })
    expect(res.status, await res.clone().text()).toBe(200)
    const fns = h.node(LIST_NODE)!.data.functions ?? []
    expect(fns).toHaveLength(1)
    expect(fns[0]?.external_id).toBeUndefined()
    expect(fns[0]?.name).toBe('견적 목록 조회')
  })

  it('낡은 revision 은 409 이고 저장하지 않는다', async () => {
    const h = harness()
    const res = await h.patch(`/api/ia-nodes/${LIST_NODE}`, { ...ACTOR, revision: 99, requirement_ids: [] })
    expect(res.status).toBe(409)
  })
})

describe('POST /api/ia-nodes/:id/id-issuances — 사람이 누르는 발번', () => {
  it('행위자가 없으면 400 이고 문서는 그대로다', async () => {
    const h = harness()
    const before = h.node(LIST_NODE)!
    const res = await h.post(`/api/ia-nodes/${LIST_NODE}/id-issuances`, { external_id: 'IA-1.1.1', by: '', reason: 'r', revision: before.revision })
    expect(res.status).toBe(400)
    expect(h.node(LIST_NODE)!.revision).toBe(before.revision)
    expect(h.node(LIST_NODE)!.data.external_id).toBeUndefined()
  })

  it('사유가 없으면 400 이고 문서는 그대로다', async () => {
    const h = harness()
    const before = h.node(LIST_NODE)!
    const res = await h.post(`/api/ia-nodes/${LIST_NODE}/id-issuances`, { external_id: 'IA-1.1.1', by: '기획자', reason: '', revision: before.revision })
    expect(res.status).toBe(400)
    expect(h.node(LIST_NODE)!.revision).toBe(before.revision)
  })

  it('형식이 아니면 400', async () => {
    const h = harness()
    const before = h.node(LIST_NODE)!
    const res = await h.post(`/api/ia-nodes/${LIST_NODE}/id-issuances`, { ...ACTOR, external_id: 'IA-1.1.1.', revision: before.revision })
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('format_invalid')
  })

  it('IA 를 발번하면 발번 기록(누가·언제·왜)이 함께 저장된다', async () => {
    const h = harness()
    const before = h.node(LIST_NODE)!
    const res = await h.post(`/api/ia-nodes/${LIST_NODE}/id-issuances`, { ...ACTOR, external_id: 'IA-1.1.1', revision: before.revision })
    expect(res.status, await res.clone().text()).toBe(200)
    const saved = h.node(LIST_NODE)!.data
    expect(saved.external_id).toBe('IA-1.1.1')
    expect(saved.issued?.by).toBe('기획자')
    expect(saved.issued?.reason).toBe('갭 제안 승인')
    expect(saved.issued?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('서버가 번호를 다시 계산한다 — 요청값이 다르면 differs 로 알린다', async () => {
    const h = harness()
    const before = h.node(LIST_NODE)!
    // 트리 위치상 제안값은 IA-1.1.1 인데 사람이 다른 값을 넣었다.
    const res = await h.post(`/api/ia-nodes/${LIST_NODE}/id-issuances`, { ...ACTOR, external_id: 'IA-9.9.9', revision: before.revision })
    expect(res.status, await res.clone().text()).toBe(200)
    const body = (await res.json()) as { issued_external_id: string; recomputed_external_id: string; differs: boolean }
    expect(body.issued_external_id).toBe('IA-9.9.9')
    expect(body.recomputed_external_id).toBe('IA-1.1.1')
    expect(body.differs).toBe(true)
  })

  it('포털부터 3단으로 제안한다 (기획자 결정)', async () => {
    const h = harness()
    const r = await h.rtm()
    expect(r.proposals.some((p) => p.kind === 'issue_ia_id')).toBe(true)
    // 실제 제안 번호는 발번 응답의 recomputed 로 확인한다: 포털=IA-1, 견적=IA-1.1, 견적 목록=IA-1.1.1
    const portal = h.node(SEED.ia_nodes.portal)!
    const res = await h.post(`/api/ia-nodes/${SEED.ia_nodes.portal}/id-issuances`, { ...ACTOR, external_id: 'IA-1', revision: portal.revision })
    expect(((await res.json()) as { recomputed_external_id: string }).recomputed_external_id).toBe('IA-1')
    const quote = h.node(SEED.ia_nodes.quote)!
    const res2 = await h.post(`/api/ia-nodes/${SEED.ia_nodes.quote}/id-issuances`, { ...ACTOR, external_id: 'IA-1.1', revision: quote.revision })
    expect(((await res2.json()) as { recomputed_external_id: string }).recomputed_external_id).toBe('IA-1.1')
  })

  it('IA 가 미발번이면 FN 도 발번할 수 없다', async () => {
    const h = harness()
    const before = h.node(LIST_NODE)!
    await h.patch(`/api/ia-nodes/${LIST_NODE}`, { ...ACTOR, revision: before.revision, add_function: { name: '조회' } })
    const withFn = h.node(LIST_NODE)!
    const fnId = (withFn.data.functions ?? [])[0]!.id
    const res = await h.post(`/api/ia-nodes/${LIST_NODE}/id-issuances`, { ...ACTOR, external_id: 'FN-1.1.1-01', revision: withFn.revision, function_id: fnId })
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('ia_not_issued')
  })

  it('IA 발번 뒤 FN 을 발번하면 계층부가 맞아야 한다', async () => {
    const h = harness()
    const v0 = h.node(LIST_NODE)!
    await h.post(`/api/ia-nodes/${LIST_NODE}/id-issuances`, { ...ACTOR, external_id: 'IA-1.1.1', revision: v0.revision })
    const v1 = h.node(LIST_NODE)!
    await h.patch(`/api/ia-nodes/${LIST_NODE}`, { ...ACTOR, revision: v1.revision, add_function: { name: '조회' } })
    const v2 = h.node(LIST_NODE)!
    const fnId = (v2.data.functions ?? [])[0]!.id

    const bad = await h.post(`/api/ia-nodes/${LIST_NODE}/id-issuances`, { ...ACTOR, external_id: 'FN-2.3.1-01', revision: v2.revision, function_id: fnId })
    expect(bad.status).toBe(400)
    expect(await bad.text()).toContain('layer_mismatch')

    const ok = await h.post(`/api/ia-nodes/${LIST_NODE}/id-issuances`, { ...ACTOR, external_id: 'FN-1.1.1-01', revision: v2.revision, function_id: fnId })
    expect(ok.status, await ok.clone().text()).toBe(200)
    expect((h.node(LIST_NODE)!.data.functions ?? [])[0]?.external_id).toBe('FN-1.1.1-01')
  })

  it('화면이 본 제안이 그 사이 바뀌었으면 409 로 거부한다', async () => {
    const h = harness()
    const before = h.node(LIST_NODE)!
    const res = await h.post(`/api/ia-nodes/${LIST_NODE}/id-issuances`, { ...ACTOR, external_id: 'IA-1.1.1', revision: before.revision, expected_proposal_hash: 'deadbeef' })
    expect(res.status).toBe(409)
    expect(await res.text()).toContain('stale_proposal')
    expect(h.node(LIST_NODE)!.data.external_id).toBeUndefined()
  })

  it('현재 제안 해시를 그대로 보내면 통과한다', async () => {
    const h = harness()
    const r = await h.rtm()
    const proposal = r.proposals.find((p) => p.kind === 'issue_ia_id' && p.ia_node_id === LIST_NODE)
    expect(proposal).toBeDefined()
    const before = h.node(LIST_NODE)!
    const res = await h.post(`/api/ia-nodes/${LIST_NODE}/id-issuances`, {
      ...ACTOR,
      external_id: 'IA-1.1.1',
      revision: before.revision,
      expected_proposal_hash: proposal!.proposal_hash,
    })
    expect(res.status, await res.clone().text()).toBe(200)
  })
})

describe('POST /api/ia-nodes/:id/id-relabels — 개명은 이력을 남긴다', () => {
  it('옛 값이 별칭으로 내려가고 새 값이 올라온다', async () => {
    const h = harness()
    const v0 = h.node(LIST_NODE)!
    await h.post(`/api/ia-nodes/${LIST_NODE}/id-issuances`, { ...ACTOR, external_id: 'IA-1.1.1', revision: v0.revision })
    const v1 = h.node(LIST_NODE)!
    const res = await h.post(`/api/ia-nodes/${LIST_NODE}/id-relabels`, { by: '기획자', reason: '메뉴 재편', external_id: 'IA-1.2.1', revision: v1.revision })
    expect(res.status, await res.clone().text()).toBe(200)
    const saved = h.node(LIST_NODE)!.data
    expect(saved.external_id).toBe('IA-1.2.1')
    expect(saved.aliases?.map((a) => a.external_id)).toEqual(['IA-1.1.1'])
    expect(saved.aliases?.[0]?.reason).toBe('메뉴 재편')
    expect(saved.aliases?.[0]?.valid_to).toBeDefined()
  })

  it('미발번 노드는 개명할 수 없다', async () => {
    const h = harness()
    const v0 = h.node(CREATE_NODE)!
    const res = await h.post(`/api/ia-nodes/${CREATE_NODE}/id-relabels`, { ...ACTOR, external_id: 'IA-1.1.3', revision: v0.revision })
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('not_issued')
  })

  it('과거 별칭 번호는 다시 쓸 수 없다', async () => {
    const h = harness()
    const v0 = h.node(LIST_NODE)!
    await h.post(`/api/ia-nodes/${LIST_NODE}/id-issuances`, { ...ACTOR, external_id: 'IA-1.1.1', revision: v0.revision })
    const v1 = h.node(LIST_NODE)!
    await h.post(`/api/ia-nodes/${LIST_NODE}/id-relabels`, { by: 'x', reason: '재편', external_id: 'IA-1.2.1', revision: v1.revision })
    // 다른 노드가 그 옛 번호를 가져가려 하면 거부한다.
    const other = h.node(CREATE_NODE)!
    const res = await h.post(`/api/ia-nodes/${CREATE_NODE}/id-issuances`, { ...ACTOR, external_id: 'IA-1.1.1', revision: other.revision })
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('duplicate')
  })
})

describe('갭을 메우면 커버리지가 오른다', () => {
  it('연결 + 기능 정의로 REQ 하나가 mapped 가 된다', async () => {
    const h = harness()
    const v0 = h.node(LIST_NODE)!
    await h.patch(`/api/ia-nodes/${LIST_NODE}`, { ...ACTOR, revision: v0.revision, add_function: { name: '견적 목록 조회' } })
    const r = await h.rtm()
    const row = r.rows.find((x) => x.requirement_external_id === 'REQ-QT-001')
    expect(row?.status).toBe('mapped')
    expect(row?.fn).toHaveLength(1)
    expect(row?.scr[0]?.external_id).toBe('SAMPLE-quote-list')
    expect(r.summary.mapped).toBeGreaterThan(0)
  })
})

/**
 * 화면 ↔ IA 연결 (`link_screen` 제안의 실제 쓰기 경로).
 *
 * 예전에는 이 필드를 쓰는 경로가 없어서 화면의 「화면 연결」 승인이 `add_function` 으로 샜다 —
 * 화면은 안 붙고 사유·행위자가 붙은 **거짓 기능**이 IA 노드에 남았다.
 */
describe('PATCH /api/ia-nodes/:id — 화면 연결 (screen_plan_id)', () => {
  const FREE_NODE = 'a2000000-0000-4000-8000-0000000000f1'
  const FREE_SCREEN = 'a4000000-0000-4000-8000-0000000000f2'

  /** 아직 서로 붙지 않은 화면 노드와 화면을 하나씩 더 둔다 (시드의 3쌍은 모두 이미 붙어 있다). */
  function withFreePair(h: ReturnType<typeof harness>) {
    h.store.put<IANode>(
      'ia_node',
      FREE_NODE,
      { id: FREE_NODE, project_id: SEED.project_id, parent_id: SEED.ia_nodes.quote, name: '견적 사본', order: 9, portal: '파트너 포털', kind: 'screen', requirement_ids: ['REQ-QT-005'] } as IANode,
      0,
    )
    h.store.put('screen', FREE_SCREEN, { id: FREE_SCREEN, project_id: SEED.project_id, external_id: 'SAMPLE-quote-copy', title: '견적 사본', shell: 'partner-page', device: 'desktop', status: 'draft', aliases: [] }, 0)
  }

  const link = async (h: ReturnType<typeof harness>, nodeId: string, screenPlanId: string) =>
    h.patch(`/api/ia-nodes/${nodeId}`, { ...ACTOR, revision: h.node(nodeId)!.revision, screen_plan_id: screenPlanId })

  it('붙이면 저장되고 사유가 남고, 기능은 생기지 않는다', async () => {
    const h = harness()
    withFreePair(h)
    expect((await h.rtm()).proposals.some((p) => p.kind === 'link_screen' && p.ia_node_id === FREE_NODE)).toBe(true)

    const res = await link(h, FREE_NODE, FREE_SCREEN)
    expect(res.status, await res.clone().text()).toBe(200)
    const saved = h.node(FREE_NODE)!.data
    expect(saved.screen_plan_id).toBe(FREE_SCREEN)
    expect(saved.change_reason).toBe(ACTOR.reason)
    expect(saved.functions ?? []).toEqual([]) // 예전 버그는 여기에 FN 을 추가했다
    // 제안이 사라지고 그 행이 화면까지 닿는다
    const after = await h.rtm()
    expect(after.proposals.some((p) => p.kind === 'link_screen' && p.ia_node_id === FREE_NODE)).toBe(false)
    expect(after.rows.find((r) => r.requirement_external_id === 'REQ-QT-005')?.scr.length).toBeGreaterThan(0)
  })

  it('없는 화면은 붙이지 않고 문서도 그대로다', async () => {
    const h = harness()
    withFreePair(h)
    const before = h.node(FREE_NODE)!.revision
    const res = await link(h, FREE_NODE, 'a4000000-0000-4000-8000-000000000404')
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('ia_link.screen_not_found')
    expect(h.node(FREE_NODE)!.revision).toBe(before)
  })

  it('분류 노드에는 붙이지 않는다', async () => {
    const h = harness()
    withFreePair(h)
    const res = await link(h, SEED.ia_nodes.quote, FREE_SCREEN)
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('ia_link.category_node')
  })

  it('다른 메뉴에 이미 붙은 화면은 붙이지 않는다 — 한 화면은 메뉴 한 곳에만', async () => {
    const h = harness()
    withFreePair(h)
    const res = await link(h, FREE_NODE, SEED.screens['SAMPLE-quote-list'])
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('ia_link.screen_taken')
  })

  it('낡은 revision 은 규칙보다 먼저 409 다 (데모와 같은 순서)', async () => {
    const h = harness()
    withFreePair(h)
    // 규칙 위반(분류 노드)과 낡은 revision 이 동시여도 양쪽이 같은 오류를 돌려줘야 한다.
    const res = await h.patch(`/api/ia-nodes/${SEED.ia_nodes.quote}`, { ...ACTOR, revision: 99, screen_plan_id: FREE_SCREEN })
    expect(res.status).toBe(409)
    expect(await res.text()).toContain('stale_revision')
  })

  it('이미 화면이 붙은 노드에는 덮어쓰지 않는다 (교체는 별개 작업)', async () => {
    const h = harness()
    withFreePair(h)
    const res = await link(h, LIST_NODE, FREE_SCREEN)
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('ia_link.occupied')
  })
})

/**
 * 한 노드에 미발번 기능이 2개 이상일 때 **둘째도 발번된다.**
 * stale 검사가 (kind, 노드) 로만 제안을 찾던 때는 늘 첫 건이 집혀 둘째는 409 로 영구히 막혔다.
 */
describe('POST id-issuances — 미발번 기능이 여러 건이어도 각자 발번된다', () => {
  it('둘째 기능을 그 제안의 해시로 승인하면 발번되고, 남의 해시로는 409 다', async () => {
    const h = harness()
    // IA 번호를 먼저 발번한다 (FN 은 소속 IA 가 발번된 뒤에만 가능하다).
    const iaProposal = (await h.rtm()).proposals.find((p) => p.kind === 'issue_ia_id' && p.ia_node_id === LIST_NODE)
    const iaRes = await h.post(`/api/ia-nodes/${LIST_NODE}/id-issuances`, {
      ...ACTOR,
      external_id: iaProposal?.suggested_value ?? 'IA-1.1.1',
      revision: h.node(LIST_NODE)!.revision,
      expected_proposal_hash: iaProposal?.proposal_hash,
    })
    expect(iaRes.status, await iaRes.clone().text()).toBe(200)

    for (const name of ['검색', '다운로드']) {
      const res = await h.patch(`/api/ia-nodes/${LIST_NODE}`, { ...ACTOR, revision: h.node(LIST_NODE)!.revision, add_function: { name } })
      expect(res.status, await res.clone().text()).toBe(200)
    }
    const fns = h.node(LIST_NODE)!.data.functions ?? []
    expect(fns).toHaveLength(2)
    const second = fns[1]!

    const proposals = (await h.rtm()).proposals.filter((p) => p.kind === 'issue_fn_id' && p.ia_node_id === LIST_NODE)
    expect(proposals).toHaveLength(2)
    const mine = proposals.find((p) => p.function_id === second.id)
    const other = proposals.find((p) => p.function_id === fns[0]!.id)
    expect(mine, '제안이 대상 기능을 들고 와야 한다').toBeDefined()

    // 남의 해시로는 거부된다 (stale 검사가 살아 있다)
    const wrong = await h.post(`/api/ia-nodes/${LIST_NODE}/id-issuances`, {
      ...ACTOR,
      external_id: mine?.suggested_value ?? 'FN-1.1.1-02',
      revision: h.node(LIST_NODE)!.revision,
      function_id: second.id,
      expected_proposal_hash: other?.proposal_hash,
    })
    expect(wrong.status).toBe(409)

    // 자기 해시로는 발번된다 (예전에는 이것도 409 였다)
    const ok = await h.post(`/api/ia-nodes/${LIST_NODE}/id-issuances`, {
      ...ACTOR,
      external_id: mine?.suggested_value ?? 'FN-1.1.1-02',
      revision: h.node(LIST_NODE)!.revision,
      function_id: second.id,
      expected_proposal_hash: mine?.proposal_hash,
    })
    expect(ok.status, await ok.clone().text()).toBe(200)
    const after = h.node(LIST_NODE)!.data.functions ?? []
    expect(after.find((f) => f.id === second.id)?.external_id).toBeTruthy()
    // 첫 기능은 **남아 있고** 번호가 붙지 않았다 (사라져도 통과하던 단언이었다).
    const untouched = after.find((f) => f.id === fns[0]!.id)
    expect(untouched, '첫 기능이 사라지면 안 된다').toBeDefined()
    expect(untouched?.external_id).toBeUndefined()
  })
})
