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

function screen(id: string, external_id: string): RtmScreen {
  return { id, external_id, title: `${external_id} 화면`, status: 'draft' }
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
