import type { IANode } from '@con-ai/schemas'
import { describe, expect, it } from 'vitest'
import { computeRtm, judgeG1Traceability, proposalHash, type RtmInput, type RtmRequirement, type RtmScreen } from './rtm.js'

const P = '00000000-0000-4000-8000-000000000000'
const AT = '2026-09-06T09:00:00Z'

let seq = 0
function uuid(): string {
  seq += 1
  return `${String(seq).padStart(8, '0')}-0000-4000-8000-000000000000`
}

function node(over: Partial<IANode> & Pick<IANode, 'id'>): IANode {
  return { project_id: P, parent_id: null, name: '노드', order: 0, portal: '파트너 포털', kind: 'category', ...over }
}

function req(external_id: string, ui: number, nonUi = 0): RtmRequirement {
  const criteria = [
    ...Array.from({ length: ui }, (_, i) => ({ id: `AC-${external_id}-U${i}`, kind: 'ui' as const })),
    ...Array.from({ length: nonUi }, (_, i) => ({ id: `AC-${external_id}-N${i}`, kind: 'non_ui' as const })),
  ]
  return { external_id, title: `${external_id} 제목`, criteria }
}

/**
 * `built` 가 false 면 **메뉴에 연결만 된 미생성 화면**이다 (목업 없음).
 * 기본값을 true 로 두어 체인 테스트들이 「연결」 이 아니라 「닿았는가」 를 계속 보게 한다 —
 * 미생성 분기는 아래에 자기 테스트가 따로 있다.
 */
function screen(id: string, external_id: string, built = true): RtmScreen {
  return { id, external_id, title: `${external_id} 화면`, status: 'draft', ...(built ? { current_revision_id: `rev-${id}` } : {}) }
}

function issued() {
  return { by: '기획자', at: AT, reason: 'r' }
}

describe('분모 규칙', () => {
  it('요구사항이 0건이면 비율은 null 이다 — 0/0 을 100% 로 표시하지 않는다', () => {
    const r = computeRtm({ requirements: [], ia_nodes: [], screens: [] })
    expect(r.summary.requirements_total).toBe(0)
    expect(r.summary.req_to_scr_ratio).toBeNull()
    expect(r.g1_traceability.passed).toBe(false)
  })

  it('분모는 요구사항 수이지 화면 수나 IA 수가 아니다', () => {
    const r = computeRtm({
      requirements: [req('REQ-1', 1), req('REQ-2', 1)],
      ia_nodes: [node({ id: uuid() }), node({ id: uuid() }), node({ id: uuid() })],
      screens: [screen(uuid(), 'S-1'), screen(uuid(), 'S-2'), screen(uuid(), 'S-3'), screen(uuid(), 'S-4')],
    })
    expect(r.summary.requirements_total).toBe(2)
    expect(r.summary.screens_total).toBe(4)
  })

  it('한 REQ 가 두 화면에 걸쳐도 분자는 1 이다 (비율이 100% 를 넘지 않는다)', () => {
    const s1 = uuid()
    const s2 = uuid()
    const parent = uuid()
    const nodes = [
      node({ id: parent, requirement_ids: ['REQ-1'], functions: [{ id: uuid(), name: '조회', kind: 'normal' }] }),
      node({ id: uuid(), parent_id: parent, kind: 'screen', screen_plan_id: s1 }),
      node({ id: uuid(), parent_id: parent, kind: 'screen', screen_plan_id: s2, order: 1 }),
    ]
    const r = computeRtm({ requirements: [req('REQ-1', 1)], ia_nodes: nodes, screens: [screen(s1, 'S-1'), screen(s2, 'S-2')] })
    expect(r.summary.mapped).toBe(1)
    expect(r.summary.req_to_scr_ratio).toBe(1)
    expect(r.rows[0]?.scr).toHaveLength(2)
  })

  it('허용되지 않는 입력 키는 실행 시점에 거부한다 (분모를 부풀리는 값 차단)', () => {
    const bad = { requirements: [], ia_nodes: [], screens: [], index_rows: 1428 } as unknown as RtmInput
    expect(() => computeRtm(bad)).toThrow(/index_rows/)
  })
})

describe('행 상태 분류', () => {
  function chain(opts: { link?: boolean; fn?: boolean; scr?: boolean }) {
    const sid = uuid()
    const nid = uuid()
    const n = node({
      id: nid,
      kind: 'screen',
      ...(opts.scr ? { screen_plan_id: sid } : {}),
      ...(opts.link ? { requirement_ids: ['REQ-1'] } : {}),
      ...(opts.fn ? { functions: [{ id: uuid(), name: '조회', kind: 'normal' as const }] } : {}),
    })
    return { input: { requirements: [req('REQ-1', 2)], ia_nodes: [n], screens: opts.scr ? [screen(sid, 'S-1')] : [] } satisfies RtmInput }
  }

  it('IA 연결이 없으면 unmapped', () => {
    const r = computeRtm(chain({}).input)
    expect(r.rows[0]?.status).toBe('unmapped')
    expect(r.rows[0]?.gap_reason).toContain('IA 노드가 없다')
  })

  it('IA 는 연결됐지만 FN 이 없으면 partial (통과로 세지 않는다)', () => {
    const r = computeRtm(chain({ link: true, scr: true }).input)
    expect(r.rows[0]?.status).toBe('partial')
    expect(r.rows[0]?.gap_reason).toContain('기능(FN)')
    expect(r.summary.mapped).toBe(0)
  })

  it('IA·FN 은 있지만 화면이 없으면 partial', () => {
    const r = computeRtm(chain({ link: true, fn: true }).input)
    expect(r.rows[0]?.status).toBe('partial')
    expect(r.rows[0]?.gap_reason).toContain('화면(SCR)')
  })

  it('IA·FN·SCR 이 모두 닿으면 mapped', () => {
    const r = computeRtm(chain({ link: true, fn: true, scr: true }).input)
    expect(r.rows[0]?.status).toBe('mapped')
    expect(r.rows[0]?.gap_reason).toBeUndefined()
  })

  it('화면이 «연결» 만 되고 아직 생성되지 않았으면 mapped 가 아니다', () => {
    // 여기가 커버리지가 거짓으로 오르던 자리다: `screen_plan_id` 만 붙어도 mapped 로 셌기 때문에
    // 목업이 0건인데 커버리지 100% · G1 통과가 떴다. 연결과 생성은 다른 사건이다.
    const sid = uuid()
    const n = node({ id: uuid(), kind: 'screen', screen_plan_id: sid, requirement_ids: ['REQ-1'], functions: [{ id: uuid(), name: 'f', kind: 'normal' }] })
    const r = computeRtm({ requirements: [req('REQ-1', 1)], ia_nodes: [n], screens: [screen(sid, 'S-1', false)] })
    expect(r.rows[0]?.status).toBe('partial')
    expect(r.rows[0]?.gap_reason).toContain('아직 생성되지 않았다')
    expect(r.rows[0]?.gap_reason).toContain('S-1') // 어느 화면이 비었는지 적는다
    expect(r.rows[0]?.scr[0]?.built).toBe(false)
    expect(r.summary.mapped).toBe(0)
    expect(r.summary.req_to_scr_ratio).toBe(0)
    expect(r.summary).toMatchObject({ screens_total: 1, screens_built: 0 })
    expect(r.g1_traceability.passed).toBe(false)
    // 각주가 실제로 뜬다 — 예전에는 element_refs 만 세서 이 목록이 늘 비어 있었다.
    expect(r.summary.element_tagging.not_run_screens).toEqual(['S-1'])
  })

  it('데모 스냅샷의 current_revision_id: null 을 «생성됨» 으로 오판하지 않는다', () => {
    // 스냅샷은 이 값을 null 로 직렬화한다. `=== undefined` 만 비교하면 null 이 통과한다.
    const sid = uuid()
    const n = node({ id: uuid(), kind: 'screen', screen_plan_id: sid, requirement_ids: ['REQ-1'], functions: [{ id: uuid(), name: 'f', kind: 'normal' }] })
    const nulled = { ...screen(sid, 'S-1'), current_revision_id: null } as unknown as RtmScreen
    const r = computeRtm({ requirements: [req('REQ-1', 1)], ia_nodes: [n], screens: [nulled] })
    expect(r.rows[0]?.status).toBe('partial')
    expect(r.summary.screens_built).toBe(0)
  })

  it('미생성 화면 때문에 막힌 요구사항만 센다 — 아무 메뉴에도 붙지 않은 미생성 화면은 세지 않는다', () => {
    // 각주가 「화면 N건 중 M건만 생성 → 그 행은 부분 연결로 남는다」고 **추론**하던 자리다.
    // 떠 있는 화면(메뉴 미연결)은 어떤 행도 막지 않는다.
    const sid = uuid()
    const floating = uuid()
    const n = node({ id: uuid(), kind: 'screen', screen_plan_id: sid, requirement_ids: ['REQ-1'], functions: [{ id: uuid(), name: 'f', kind: 'normal' }] })
    const built = computeRtm({ requirements: [req('REQ-1', 1)], ia_nodes: [n], screens: [screen(sid, 'S-1'), screen(floating, 'S-떠있음', false)] })
    expect(built.rows[0]?.status).toBe('mapped')
    expect(built.summary).toMatchObject({ screens_total: 2, screens_built: 1, partial_screen_not_built: 0 })

    const blocked = computeRtm({ requirements: [req('REQ-1', 1)], ia_nodes: [n], screens: [screen(sid, 'S-1', false), screen(floating, 'S-떠있음', false)] })
    expect(blocked.rows[0]?.gap_kind).toBe('screen_not_built')
    expect(blocked.summary.partial_screen_not_built).toBe(1)
  })

  it('사유의 종류를 값으로 적는다 (화면이 사유 문장을 다시 파싱하지 않는다)', () => {
    const sid = uuid()
    const noIa = computeRtm({ requirements: [req('REQ-X', 1)], ia_nodes: [], screens: [] })
    expect(noIa.rows[0]?.gap_kind).toBe('no_ia')
    const noFn = node({ id: uuid(), kind: 'screen', screen_plan_id: sid, requirement_ids: ['REQ-1'] })
    expect(computeRtm({ requirements: [req('REQ-1', 1)], ia_nodes: [noFn], screens: [screen(sid, 'S-1')] }).rows[0]?.gap_kind).toBe('no_function')
    const noScr = node({ id: uuid(), kind: 'screen', requirement_ids: ['REQ-1'], functions: [{ id: uuid(), name: 'f', kind: 'normal' }] })
    expect(computeRtm({ requirements: [req('REQ-1', 1)], ia_nodes: [noScr], screens: [] }).rows[0]?.gap_kind).toBe('no_screen')
    const nonUi = computeRtm({ requirements: [req('REQ-N', 0, 1)], ia_nodes: [], screens: [] })
    expect(nonUi.rows[0]?.gap_kind).toBe('non_ui_only')
    // mapped 면 사유도 종류도 없다
    const ok = node({ id: uuid(), kind: 'screen', screen_plan_id: sid, requirement_ids: ['REQ-1'], functions: [{ id: uuid(), name: 'f', kind: 'normal' }] })
    const mapped = computeRtm({ requirements: [req('REQ-1', 1)], ia_nodes: [ok], screens: [screen(sid, 'S-1')] })
    expect(mapped.rows[0]?.gap_kind).toBeUndefined()
    expect(mapped.rows[0]?.gap_reason).toBeUndefined()
  })

  it('걸친 화면 중 하나라도 미생성이면 partial 이다 (부분 생성을 분자로 올리지 않는다)', () => {
    const s1 = uuid()
    const s2 = uuid()
    const parent = uuid()
    const nodes = [
      node({ id: parent, requirement_ids: ['REQ-1'], functions: [{ id: uuid(), name: 'f', kind: 'normal' }] }),
      node({ id: uuid(), parent_id: parent, kind: 'screen', screen_plan_id: s1 }),
      node({ id: uuid(), parent_id: parent, kind: 'screen', screen_plan_id: s2, order: 1 }),
    ]
    const r = computeRtm({ requirements: [req('REQ-1', 1)], ia_nodes: nodes, screens: [screen(s1, 'S-1'), screen(s2, 'S-2', false)] })
    expect(r.rows[0]?.status).toBe('partial')
    expect(r.rows[0]?.gap_reason).toContain('S-2')
    expect(r.rows[0]?.gap_reason).not.toContain('S-1') // 만들어진 화면을 미생성으로 적지 않는다
    expect(r.summary).toMatchObject({ screens_total: 2, screens_built: 1 })
  })

  it('UI 수용조건이 0건이면 non_ui_only 이고, 분모에서 빼지 않는다', () => {
    const sid = uuid()
    const n = node({ id: uuid(), kind: 'screen', screen_plan_id: sid, requirement_ids: ['REQ-N'], functions: [{ id: uuid(), name: 'f', kind: 'normal' }] })
    const r = computeRtm({ requirements: [req('REQ-N', 0, 3), req('REQ-U', 1)], ia_nodes: [n], screens: [screen(sid, 'S-1')] })
    expect(r.summary.requirements_total).toBe(2) // 분모 유지 — 빼면 비율이 저절로 올라간다
    expect(r.summary.non_ui_only).toBe(1)
    expect(r.summary.mapped).toBe(0)
    expect(r.rows.find((x) => x.requirement_external_id === 'REQ-N')?.status).toBe('non_ui_only')
  })

  it('네 상태의 합은 항상 요구사항 총계와 같다 (분류에서 조용히 사라지지 않는다)', () => {
    const sid = uuid()
    const linked = node({ id: uuid(), kind: 'screen', screen_plan_id: sid, requirement_ids: ['REQ-M'], functions: [{ id: uuid(), name: 'f', kind: 'normal' }] })
    const partial = node({ id: uuid(), kind: 'screen', requirement_ids: ['REQ-P'] })
    const r = computeRtm({
      requirements: [req('REQ-M', 1), req('REQ-P', 1), req('REQ-U', 1), req('REQ-N', 0, 1)],
      ia_nodes: [linked, partial],
      screens: [screen(sid, 'S-1')],
    })
    const s = r.summary
    expect(s.mapped + s.partial + s.non_ui_only + s.unmapped).toBe(s.requirements_total)
    expect(s).toMatchObject({ mapped: 1, partial: 1, unmapped: 1, non_ui_only: 1, requirements_total: 4 })
    expect(s.req_to_scr_ratio).toBe(0.25)
  })

  it('카테고리 노드에 REQ 를 붙이면 하위 화면까지 체인이 닿는다', () => {
    const sid = uuid()
    const cat = uuid()
    const nodes = [
      node({ id: cat, requirement_ids: ['REQ-1'], functions: [{ id: uuid(), name: 'f', kind: 'normal' }] }),
      node({ id: uuid(), parent_id: cat, kind: 'screen', screen_plan_id: sid }),
    ]
    const r = computeRtm({ requirements: [req('REQ-1', 1)], ia_nodes: nodes, screens: [screen(sid, 'S-1')] })
    expect(r.rows[0]?.status).toBe('mapped')
  })
})

describe('발번 여부 표시', () => {
  it('미발번 IA·FN 을 세고, 코드가 없으면 external_id 를 비운다 (지어내지 않는다)', () => {
    const sid = uuid()
    const nodes = [
      node({ id: uuid(), kind: 'screen', screen_plan_id: sid, requirement_ids: ['REQ-1'], functions: [{ id: uuid(), name: 'f', kind: 'normal' }] }),
      node({ id: uuid(), external_id: 'IA-2', issued: issued(), order: 1 }),
    ]
    const r = computeRtm({ requirements: [req('REQ-1', 1)], ia_nodes: nodes, screens: [screen(sid, 'S-1')] })
    expect(r.summary).toMatchObject({ ia_nodes_total: 2, ia_nodes_issued: 1, functions_total: 1, functions_issued: 0 })
    expect(r.rows[0]?.ia[0]?.external_id).toBeUndefined()
    expect(r.rows[0]?.fn[0]?.external_id).toBeUndefined()
  })
})

describe('검증 완료는 미실행이다', () => {
  it('숫자 0 이 아니라 not_run + 사유로 돌려준다', () => {
    const r = computeRtm({ requirements: [req('REQ-1', 1)], ia_nodes: [], screens: [] })
    expect(r.summary.test_pass.status).toBe('not_run')
    expect(r.summary.test_pass.reason).toContain('미실행은 통과가 아니다')
  })
})

describe('요소 태깅 판정', () => {
  const sid = uuid()
  const fnId = uuid()
  const nodes = [
    node({
      id: uuid(),
      kind: 'screen',
      screen_plan_id: sid,
      functions: [{ id: fnId, name: 'f', kind: 'normal', element_refs: [{ screen_plan_id: sid, element_or_action_id: 'search-button' }] }],
    }),
  ]

  it('명세를 읽지 못하면 untagged 0 이 아니라 not_run 으로 분리한다', () => {
    const r = computeRtm({ requirements: [], ia_nodes: nodes, screens: [screen(sid, 'S-1')] })
    expect(r.summary.element_tagging).toMatchObject({ refs_total: 1, refs_live: 0, refs_stale: 0 })
    expect(r.summary.element_tagging.not_run_screens).toEqual(['S-1'])
  })

  it('명세에 요소가 있으면 live', () => {
    const r = computeRtm({
      requirements: [],
      ia_nodes: nodes,
      screens: [screen(sid, 'S-1')],
      spec_indexes: [{ screen_plan_id: sid, element_or_action_ids: ['search-button', 'result-table'] }],
    })
    expect(r.summary.element_tagging).toMatchObject({ refs_total: 1, refs_live: 1, refs_stale: 0, not_run_screens: [] })
  })

  it('화면을 다시 만들어 요소가 사라지면 stale 로 보고한다 (자동 복구하지 않는다)', () => {
    const r = computeRtm({
      requirements: [],
      ia_nodes: nodes,
      screens: [screen(sid, 'S-1')],
      spec_indexes: [{ screen_plan_id: sid, element_or_action_ids: ['result-table'] }],
    })
    expect(r.summary.element_tagging).toMatchObject({ refs_total: 1, refs_live: 0, refs_stale: 1 })
  })
})

describe('갭 제안 — 저장하지 않고 계산한다', () => {
  it('미매핑 REQ 마다 연결 제안을 만든다', () => {
    const free = uuid()
    const r = computeRtm({ requirements: [req('REQ-1', 1)], ia_nodes: [node({ id: free, kind: 'screen' })], screens: [] })
    const p = r.proposals.find((x) => x.kind === 'link_requirement')
    expect(p?.requirement_external_id).toBe('REQ-1')
    expect(p?.ia_node_id).toBe(free)
    expect(p?.rationale).toContain('REQ-1')
  })

  it('FN 이 없는 부분 매핑에는 기능 정의 제안이 붙는다', () => {
    const sid = uuid()
    const nid = uuid()
    const r = computeRtm({
      requirements: [req('REQ-1', 1)],
      ia_nodes: [node({ id: nid, kind: 'screen', screen_plan_id: sid, requirement_ids: ['REQ-1'] })],
      screens: [screen(sid, 'S-1')],
    })
    expect(r.proposals.some((x) => x.kind === 'define_function' && x.ia_node_id === nid)).toBe(true)
  })

  it('체인에 쓰이는데 번호가 없으면 발번 제안이 붙는다', () => {
    const nid = uuid()
    const r = computeRtm({ requirements: [req('REQ-1', 1)], ia_nodes: [node({ id: nid, requirement_ids: ['REQ-1'] })], screens: [] })
    expect(r.proposals.some((x) => x.kind === 'issue_ia_id' && x.ia_node_id === nid)).toBe(true)
  })

  it('IA 가 발번된 뒤에는 FN 발번 제안이 나온다', () => {
    const nid = uuid()
    const nodes = [node({ id: nid, external_id: 'IA-1', issued: issued(), requirement_ids: ['REQ-1'], functions: [{ id: uuid(), name: 'f', kind: 'normal' }] })]
    const r = computeRtm({ requirements: [req('REQ-1', 1)], ia_nodes: nodes, screens: [] })
    expect(r.proposals.some((x) => x.kind === 'issue_fn_id')).toBe(true)
    expect(r.proposals.some((x) => x.kind === 'issue_ia_id')).toBe(false)
  })

  it('발번 제안에는 계산된 다음 번호를 초안으로 담는다 (사람이 고칠 수 있고, 저장할 때 다시 계산한다)', () => {
    const portal = uuid()
    const r = computeRtm({ requirements: [req('REQ-1', 1)], ia_nodes: [node({ id: portal, requirement_ids: ['REQ-1'] })], screens: [] })
    expect(r.proposals.find((x) => x.kind === 'issue_ia_id' && x.ia_node_id === portal)?.suggested_value).toBe('IA-1')
  })

  it('하위 노드는 포털부터 이어 센다 (초안일 뿐이며 저장할 때 다시 계산한다)', () => {
    const portal = uuid()
    const child = uuid()
    const nodes = [node({ id: portal }), node({ id: child, parent_id: portal, kind: 'screen', requirement_ids: ['REQ-1'] })]
    const r = computeRtm({ requirements: [req('REQ-1', 1)], ia_nodes: nodes, screens: [] })
    const p = r.proposals.find((x) => x.kind === 'issue_ia_id' && x.ia_node_id === child)
    expect(p?.suggested_value).toBe('IA-1.1')
    expect(p?.rationale).toContain('IA-1.1')
  })

  it('FN 발번 제안에는 소속 IA 아래의 다음 번호를 담는다', () => {
    const nid = uuid()
    const nodes = [node({ id: nid, external_id: 'IA-1', issued: issued(), requirement_ids: ['REQ-1'], functions: [{ id: uuid(), name: 'f', kind: 'normal' }] })]
    const r = computeRtm({ requirements: [req('REQ-1', 1)], ia_nodes: nodes, screens: [] })
    expect(r.proposals.find((x) => x.kind === 'issue_fn_id')?.suggested_value).toBe('FN-1-01')
  })

  it('mapped 행에는 제안을 만들지 않는다', () => {
    const sid = uuid()
    const nodes = [
      node({ id: uuid(), kind: 'screen', screen_plan_id: sid, requirement_ids: ['REQ-1'], external_id: 'IA-1', issued: issued(), functions: [{ id: uuid(), name: 'f', kind: 'normal', external_id: 'FN-1-01', issued: issued() }] }),
    ]
    const r = computeRtm({ requirements: [req('REQ-1', 1)], ia_nodes: nodes, screens: [screen(sid, 'S-1')] })
    expect(r.proposals).toEqual([])
  })

  it('제안 해시는 내용이 같으면 같고 다르면 다르다 (stale 제안 승인 차단용)', () => {
    expect(proposalHash(['a', 'b'])).toBe(proposalHash(['a', 'b']))
    expect(proposalHash(['a', 'b'])).not.toBe(proposalHash(['a', 'c']))
  })
})

describe('G1 추적성 판정', () => {
  const base = {
    requirements_total: 3,
    mapped: 3,
    partial: 0,
    non_ui_only: 0,
    unmapped: 0,
    req_to_scr_ratio: 1,
    ia_nodes_total: 1,
    ia_nodes_issued: 1,
    functions_total: 1,
    functions_issued: 1,
    screens_total: 1,
    screens_built: 1,
    partial_screen_not_built: 0,
    test_pass: { status: 'not_run' as const, reason: 'r' },
    element_tagging: { refs_total: 0, refs_live: 0, refs_stale: 0, not_run_screens: [] },
  }

  it('전부 mapped 면 통과다', () => {
    expect(judgeG1Traceability(base).passed).toBe(true)
  })

  it('미매핑이 남으면 통과가 아니다', () => {
    expect(judgeG1Traceability({ ...base, mapped: 2, unmapped: 1, req_to_scr_ratio: 2 / 3 }).passed).toBe(false)
  })

  it('부분 매핑이 남으면 통과가 아니다', () => {
    expect(judgeG1Traceability({ ...base, mapped: 2, partial: 1, req_to_scr_ratio: 2 / 3 }).passed).toBe(false)
  })

  it('비UI 전용이 있으면 통과로 보지 않고 이유를 적는다', () => {
    const v = judgeG1Traceability({ ...base, mapped: 2, non_ui_only: 1, req_to_scr_ratio: 2 / 3 })
    expect(v.passed).toBe(false)
    expect(v.reason).toContain('비UI 전용')
  })

  it('요구사항이 0건이면 통과가 아니다', () => {
    expect(judgeG1Traceability({ ...base, requirements_total: 0, mapped: 0, req_to_scr_ratio: null }).passed).toBe(false)
  })
})

/**
 * 발번 제안이 **대상 기능을 들고 온다.**
 *
 * 들고 오지 않던 때: 화면이 보고서 전체의 첫 미발번 기능을 집어 보냈고, 서버·데모의 stale 검사는
 * (kind, 노드) 로만 제안을 찾았다. 그래서 한 노드에 미발번 기능이 2개 이상이면 둘째 제안은
 * 해시가 늘 어긋나 **영원히 승인할 수 없었다**.
 */
describe('issue_fn_id 제안 — 대상 기능을 들고 온다', () => {
  const NODE = uuid()
  const FN_A = uuid()
  const FN_B = uuid()

  function report() {
    return computeRtm({
      requirements: [req('REQ-1', 1)],
      ia_nodes: [
        node({
          id: NODE,
          kind: 'screen',
          external_id: 'IA-1.1',
          issued: issued(),
          requirement_ids: ['REQ-1'],
          functions: [
            { id: FN_A, name: '검색', kind: 'normal' },
            { id: FN_B, name: '다운로드', kind: 'normal' },
          ],
        }),
      ],
      screens: [],
    })
  }

  it('미발번 기능마다 제안이 하나씩 나오고 각자 자기 기능을 가리킨다', () => {
    const fn = report().proposals.filter((p) => p.kind === 'issue_fn_id')
    expect(fn).toHaveLength(2)
    expect(fn.map((p) => p.function_id)).toEqual([FN_A, FN_B])
    expect(fn.every((p) => p.ia_node_id === NODE)).toBe(true)
  })

  // 아래는 **성질 확인**이다 (고치기 전 코드에서도 통과했다). 결함의 재현은 API 층 테스트가 한다:
  // apps/api/src/rtm.test.ts · apps/web/src/demo-rtm.test.ts 의 「둘째 제안을 그 해시로 승인하면 발번된다」.
  it('두 제안의 해시가 서로 다르다 (기능 id 를 포함하므로)', () => {
    const fn = report().proposals.filter((p) => p.kind === 'issue_fn_id')
    expect(new Set(fn.map((p) => p.proposal_hash)).size).toBe(2)
    expect(fn[1]?.proposal_hash).toBe(proposalHash(['issue_fn_id', NODE, FN_B]))
  })

  it('서버·데모가 쓰는 조회(kind + 노드 + 기능)로 둘째 제안을 정확히 찾는다', () => {
    const proposals = report().proposals
    const second = proposals.find((p) => p.kind === 'issue_fn_id' && p.ia_node_id === NODE && p.function_id === FN_B)
    expect(second?.proposal_hash).toBe(proposalHash(['issue_fn_id', NODE, FN_B]))
  })

  it('IA 발번 제안에는 대상 기능이 없다 (IA 가 대상이다)', () => {
    const r = computeRtm({
      requirements: [req('REQ-1', 1)],
      ia_nodes: [node({ id: uuid(), kind: 'screen', requirement_ids: ['REQ-1'] })],
      screens: [],
    })
    const ia = r.proposals.find((p) => p.kind === 'issue_ia_id')
    expect(ia).toBeDefined()
    expect(ia?.function_id).toBeUndefined()
  })
})

/**
 * 분류 노드에는 화면을 직접 붙일 수 없다(설계 §6). 그런 제안을 내면 승인자·사유를 다 받고
 * 400 을 돌려주는 **막다른 버튼**이 된다 — 그래서 제안하지 않는다.
 */
describe('link_screen 제안 — 실행할 수 있는 대상에만 낸다', () => {
  it('화면(screen) 노드에는 제안하고, 분류(category) 노드에는 제안하지 않는다', () => {
    const screenNode = uuid()
    const categoryNode = uuid()
    const r = computeRtm({
      requirements: [req('REQ-S', 1), req('REQ-C', 1)],
      ia_nodes: [
        node({ id: screenNode, kind: 'screen', name: '화면 노드', requirement_ids: ['REQ-S'] }),
        node({ id: categoryNode, kind: 'category', name: '분류 노드', requirement_ids: ['REQ-C'] }),
      ],
      screens: [],
    })
    const targets = r.proposals.filter((p) => p.kind === 'link_screen').map((p) => p.ia_node_id)
    expect(targets).toContain(screenNode)
    expect(targets).not.toContain(categoryNode)
  })

  it('분류 노드의 행은 제안 대신 사유로 남는다 (갭을 숨기지 않는다)', () => {
    const categoryNode = uuid()
    const r = computeRtm({
      requirements: [req('REQ-C', 1)],
      ia_nodes: [node({ id: categoryNode, kind: 'category', name: '분류 노드', requirement_ids: ['REQ-C'] })],
      screens: [],
    })
    const row = r.rows.find((x) => x.requirement_external_id === 'REQ-C')
    expect(row?.status).not.toBe('mapped')
    expect(row?.gap_reason ?? '').not.toBe('')
  })
})
