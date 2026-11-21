import type { IANode } from '@con-ai/schemas'
import { describe, expect, it } from 'vitest'
import { DomainRuleError } from './result.js'
import * as idRegistryModule from './id-registry.js'
import {
  canIssueFnExternalId,
  canIssueIaExternalId,
  canRelabelIaExternalId,
  externalIdAtFor,
  iaNumberOf,
  issuanceSummary,
  issueFnExternalId,
  issueIaExternalId,
  proposeFnExternalId,
  proposeIaExternalId,
  relabelFnExternalId,
  relabelIaExternalId,
  resolveIssuedId,
} from './id-registry.js'

const P = '00000000-0000-4000-8000-000000000000'
const AT1 = '2026-09-06T09:00:00Z'
const AT2 = '2026-09-07T09:00:00Z'
const AT3 = '2026-09-08T09:00:00Z'
const ACTOR = { by: '기획자', reason: '갭 제안 승인', at: AT1 }

let seq = 0
function uuid(): string {
  seq += 1
  return `${String(seq).padStart(8, '0')}-0000-4000-8000-000000000000`
}

function node(over: Partial<IANode> & Pick<IANode, 'id'>): IANode {
  return { project_id: P, parent_id: null, name: '노드', order: 0, portal: '파트너 포털', kind: 'category', ...over }
}

/** 기획자 결정(2026-09-06): 포털부터 3단. 파트너 포털 → 견적 → 견적 목록. */
function seedTree() {
  const portal = uuid()
  const quote = uuid()
  const list = uuid()
  const detail = uuid()
  const nodes: IANode[] = [
    node({ id: portal, parent_id: null, name: '파트너 포털', order: 0 }),
    node({ id: quote, parent_id: portal, name: '견적', order: 0 }),
    node({ id: list, parent_id: quote, name: '견적 목록', order: 0, kind: 'screen' }),
    node({ id: detail, parent_id: quote, name: '견적 상세', order: 1, kind: 'screen' }),
  ]
  return { nodes, portal, quote, list, detail }
}

describe('proposeIaExternalId — 포털부터 3단', () => {
  it('포털 = IA-1, 그 아래 = IA-1.1, 그 아래 = IA-1.1.1', () => {
    const { nodes, portal, quote, list, detail } = seedTree()
    expect(proposeIaExternalId(nodes, portal)).toBe('IA-1')
    expect(proposeIaExternalId(nodes, quote)).toBe('IA-1.1')
    expect(proposeIaExternalId(nodes, list)).toBe('IA-1.1.1')
    expect(proposeIaExternalId(nodes, detail)).toBe('IA-1.1.2')
  })

  it('형제 순번은 order 를 따른다', () => {
    const { nodes, quote, list, detail } = seedTree()
    const swapped = nodes.map((n) => (n.id === list ? { ...n, order: 5 } : n))
    expect(proposeIaExternalId(swapped, detail)).toBe('IA-1.1.1')
    expect(proposeIaExternalId(swapped, list)).toBe('IA-1.1.2')
    expect(proposeIaExternalId(swapped, quote)).toBe('IA-1.1')
  })

  it('포털이 둘이면 두 번째는 IA-2 로 시작한다 (산출물 예시 IA-2.3.1 의 첫 자리)', () => {
    const { nodes } = seedTree()
    const second = uuid()
    const all = [...nodes, node({ id: second, parent_id: null, name: '관리자 포털', order: 1 })]
    expect(proposeIaExternalId(all, second)).toBe('IA-2')
  })

  it('없는 노드는 번호를 지어내지 않고 null 을 준다', () => {
    const { nodes } = seedTree()
    expect(proposeIaExternalId(nodes, uuid())).toBeNull()
  })

  it('부모 고리가 있으면 무한 루프 대신 null 을 준다', () => {
    const a = uuid()
    const b = uuid()
    const cyclic: IANode[] = [node({ id: a, parent_id: b }), node({ id: b, parent_id: a })]
    expect(proposeIaExternalId(cyclic, a)).toBeNull()
  })
})

describe('proposeFnExternalId — 번호를 재사용하지 않는다', () => {
  it('IA 가 미발번이면 FN 번호를 만들 수 없다', () => {
    expect(proposeFnExternalId({ external_id: undefined, functions: [] })).toBeNull()
  })

  it('첫 기능은 -01 이다', () => {
    expect(proposeFnExternalId({ external_id: 'IA-1.1.1', functions: [] })).toBe('FN-1.1.1-01')
  })

  it('현재 최대값 다음 번호를 준다', () => {
    const fns = [
      { id: uuid(), name: 'a', kind: 'normal' as const, external_id: 'FN-1.1.1-01', issued: { by: 'x', at: AT1, reason: 'r' } },
      { id: uuid(), name: 'b', kind: 'normal' as const, external_id: 'FN-1.1.1-02', issued: { by: 'x', at: AT1, reason: 'r' } },
    ]
    expect(proposeFnExternalId({ external_id: 'IA-1.1.1', functions: fns })).toBe('FN-1.1.1-03')
  })

  it('별칭(개명으로 내려온 옛 번호)도 세어 재사용하지 않는다', () => {
    const fns = [
      {
        id: uuid(),
        name: 'a',
        kind: 'normal' as const,
        external_id: 'FN-1.1.1-01',
        issued: { by: 'x', at: AT2, reason: 'r' },
        aliases: [{ external_id: 'FN-1.1.1-07', valid_from: AT1, valid_to: AT2, reason: '재분류', by: 'x' }],
      },
    ]
    // 현재 최대는 01 이지만 07 이 쓰인 적 있으므로 다음은 08 이다.
    expect(proposeFnExternalId({ external_id: 'IA-1.1.1', functions: fns })).toBe('FN-1.1.1-08')
  })

  it('99 를 넘으면 null 을 주고 조용히 형식을 어기지 않는다', () => {
    const fns = [{ id: uuid(), name: 'a', kind: 'normal' as const, external_id: 'FN-1-99', issued: { by: 'x', at: AT1, reason: 'r' } }]
    expect(proposeFnExternalId({ external_id: 'IA-1', functions: fns })).toBeNull()
  })
})

describe('IA 발번 — 사람 없이는 못 한다', () => {
  it('행위자·사유·시각이 있으면 발번된다', () => {
    const { nodes, list } = seedTree()
    const target = nodes.find((n) => n.id === list)!
    const next = issueIaExternalId(nodes, target, { ...ACTOR, external_id: 'IA-1.1.1' })
    expect(next.external_id).toBe('IA-1.1.1')
    expect(next.issued).toEqual({ by: '기획자', at: AT1, reason: '갭 제안 승인' })
  })

  it.each([
    ['행위자', { by: '  ', reason: 'r', at: AT1 }, 'id_registry.actor_required'],
    ['사유', { by: '기획자', reason: '   ', at: AT1 }, 'id_registry.reason_required'],
    ['시각', { by: '기획자', reason: 'r', at: '2026-09-06' }, 'id_registry.timestamp_invalid'],
  ])('%s 가 없으면 거부한다', (_label, actor, code) => {
    const { nodes, list } = seedTree()
    const target = nodes.find((n) => n.id === list)!
    const decision = canIssueIaExternalId(nodes, target, { ...actor, external_id: 'IA-1.1.1' })
    expect(decision.allowed).toBe(false)
    expect(decision.reasons.map((r) => r.code)).toContain(code)
  })

  it('거부면 적용 함수가 던진다 — 거부인데 저장되는 일이 없다', () => {
    const { nodes, list } = seedTree()
    const target = nodes.find((n) => n.id === list)!
    expect(() => issueIaExternalId(nodes, target, { by: '', reason: 'r', at: AT1, external_id: 'IA-1.1.1' })).toThrow(DomainRuleError)
  })

  it('형식이 아니면 거부한다', () => {
    const { nodes, list } = seedTree()
    const target = nodes.find((n) => n.id === list)!
    expect(canIssueIaExternalId(nodes, target, { ...ACTOR, external_id: 'IA-1.1.1.' }).reasons.map((r) => r.code)).toContain('id_registry.format_invalid')
  })

  it('이미 다른 노드가 쓰는 번호는 거부한다', () => {
    const { nodes, list, detail } = seedTree()
    const withIssued = nodes.map((n) => (n.id === detail ? { ...n, external_id: 'IA-1.1.1', issued: { by: 'x', at: AT1, reason: 'r' } } : n))
    const target = withIssued.find((n) => n.id === list)!
    expect(canIssueIaExternalId(withIssued, target, { ...ACTOR, external_id: 'IA-1.1.1' }).reasons.map((r) => r.code)).toContain('id_registry.duplicate')
  })

  it('과거 별칭으로 쓰인 번호도 재사용하지 않는다', () => {
    const { nodes, list, detail } = seedTree()
    const withAlias = nodes.map((n) =>
      n.id === detail ? { ...n, aliases: [{ external_id: 'IA-1.1.9', valid_from: AT1, valid_to: AT2, reason: '재편', by: 'x' }] } : n,
    )
    const target = withAlias.find((n) => n.id === list)!
    expect(canIssueIaExternalId(withAlias, target, { ...ACTOR, external_id: 'IA-1.1.9' }).reasons.map((r) => r.code)).toContain('id_registry.duplicate')
  })

  it('이미 발번된 노드는 발번이 아니라 개명이다', () => {
    const { nodes, list } = seedTree()
    const target = { ...nodes.find((n) => n.id === list)!, external_id: 'IA-1.1.1', issued: { by: 'x', at: AT1, reason: 'r' } }
    expect(canIssueIaExternalId(nodes, target, { ...ACTOR, external_id: 'IA-1.1.2' }).reasons.map((r) => r.code)).toContain('id_registry.already_issued')
  })
})

describe('IA 개명 — 옛 값을 지우지 않는다', () => {
  function issuedNode() {
    const { nodes, list } = seedTree()
    const target = { ...nodes.find((n) => n.id === list)!, external_id: 'IA-1.1.1', issued: { by: '기획자', at: AT1, reason: '최초 발번' } }
    return { nodes: nodes.map((n) => (n.id === list ? target : n)), target }
  }

  it('현재 값이 별칭으로 내려가고 새 값이 올라온다', () => {
    const { nodes, target } = issuedNode()
    const next = relabelIaExternalId(nodes, target, { by: '기획자', reason: '메뉴 재편', at: AT2, external_id: 'IA-1.2.1' })
    expect(next.external_id).toBe('IA-1.2.1')
    expect(next.aliases).toEqual([{ external_id: 'IA-1.1.1', valid_from: AT1, valid_to: AT2, reason: '메뉴 재편', by: '기획자' }])
    expect(next.issued).toEqual({ by: '기획자', at: AT2, reason: '메뉴 재편' })
  })

  it('미발번 노드는 개명할 수 없다', () => {
    const { nodes, list } = seedTree()
    const target = nodes.find((n) => n.id === list)!
    expect(canRelabelIaExternalId(nodes, target, { ...ACTOR, external_id: 'IA-1.2.1' }).reasons.map((r) => r.code)).toContain('id_registry.not_issued')
  })

  it('같은 값으로는 개명하지 않는다', () => {
    const { nodes, target } = issuedNode()
    expect(canRelabelIaExternalId(nodes, target, { ...ACTOR, external_id: 'IA-1.1.1' }).reasons.map((r) => r.code)).toContain('id_registry.unchanged')
  })

  it('사유 없이 개명할 수 없다', () => {
    const { nodes, target } = issuedNode()
    expect(canRelabelIaExternalId(nodes, target, { by: '기획자', reason: '', at: AT2, external_id: 'IA-1.2.1' }).reasons.map((r) => r.code)).toContain('id_registry.reason_required')
  })

  it('두 번 개명하면 이력이 둘 다 남는다', () => {
    const { nodes, target } = issuedNode()
    const once = relabelIaExternalId(nodes, target, { by: 'a', reason: '1차', at: AT2, external_id: 'IA-1.2.1' })
    const twice = relabelIaExternalId([once], once, { by: 'b', reason: '2차', at: AT3, external_id: 'IA-1.3.1' })
    expect(twice.aliases?.map((a) => a.external_id)).toEqual(['IA-1.1.1', 'IA-1.2.1'])
  })
})

describe('FN 발번 — IA 가 먼저다', () => {
  function nodeWithFn(iaIssued: boolean) {
    const fnId = uuid()
    const base = node({ id: uuid(), kind: 'screen', functions: [{ id: fnId, name: '견적 목록 조회', kind: 'normal' }] })
    const n: IANode = iaIssued ? { ...base, external_id: 'IA-1.1.1', issued: { by: 'x', at: AT1, reason: 'r' } } : base
    return { n, fnId }
  }

  it('IA 가 미발번이면 FN 도 발번할 수 없다', () => {
    const { n, fnId } = nodeWithFn(false)
    const fn = (n.functions ?? []).find((f) => f.id === fnId)!
    expect(canIssueFnExternalId(n, fn, { ...ACTOR, external_id: 'FN-1.1.1-01' }).reasons.map((r) => r.code)).toContain('id_registry.ia_not_issued')
  })

  it('IA 가 발번돼 있으면 FN 이 발번된다', () => {
    const { n, fnId } = nodeWithFn(true)
    const next = issueFnExternalId(n, fnId, { ...ACTOR, external_id: 'FN-1.1.1-01' })
    const fn = (next.functions ?? [])[0]
    expect(fn?.external_id).toBe('FN-1.1.1-01')
    expect(fn?.issued?.by).toBe('기획자')
  })

  it('계층부가 소속 IA 와 다르면 거부한다', () => {
    const { n, fnId } = nodeWithFn(true)
    const fn = (n.functions ?? []).find((f) => f.id === fnId)!
    expect(canIssueFnExternalId(n, fn, { ...ACTOR, external_id: 'FN-2.3.1-01' }).reasons.map((r) => r.code)).toContain('id_registry.layer_mismatch')
  })

  it('없는 기능에는 발번할 수 없다', () => {
    const { n } = nodeWithFn(true)
    expect(() => issueFnExternalId(n, uuid(), { ...ACTOR, external_id: 'FN-1.1.1-01' })).toThrow(DomainRuleError)
  })

  it('FN 개명도 옛 값을 별칭으로 남긴다', () => {
    const { n, fnId } = nodeWithFn(true)
    const issued = issueFnExternalId(n, fnId, { ...ACTOR, external_id: 'FN-1.1.1-01' })
    const relabeled = relabelFnExternalId(issued, fnId, { by: '기획자', reason: '기능 분리', at: AT2, external_id: 'FN-1.1.1-02' })
    const fn = (relabeled.functions ?? [])[0]
    expect(fn?.external_id).toBe('FN-1.1.1-02')
    expect(fn?.aliases).toEqual([{ external_id: 'FN-1.1.1-01', valid_from: AT1, valid_to: AT2, reason: '기능 분리', by: '기획자' }])
  })
})

describe('조회 — 지금 값과 과거 값을 구분한다', () => {
  const target = {
    external_id: 'IA-1.2.1',
    issued: { by: 'x', at: AT2, reason: 'r' },
    aliases: [{ external_id: 'IA-1.1.1', valid_from: AT1, valid_to: AT2, reason: '재편', by: 'x' }],
  }

  it('현재 값과 별칭을 다르게 판정한다', () => {
    expect(resolveIssuedId(target, 'IA-1.2.1')).toEqual({ kind: 'current' })
    expect(resolveIssuedId(target, 'IA-1.1.1')).toEqual({ kind: 'alias', retired_at: AT2 })
    expect(resolveIssuedId(target, 'IA-9.9.9')).toEqual({ kind: 'unknown' })
  })

  it('시점별 표시 ID 를 돌려준다', () => {
    expect(externalIdAtFor(target, AT1)).toBe('IA-1.1.1')
    expect(externalIdAtFor(target, AT3)).toBe('IA-1.2.1')
  })

  it('아무 ID 도 없던 시점은 null 이다 — 없었던 것을 현재 값으로 채우지 않는다', () => {
    expect(externalIdAtFor(target, '2026-01-01T00:00:00Z')).toBeNull()
  })

  it('발번 요약이 미발번을 정확히 센다', () => {
    const nodes: IANode[] = [
      node({ id: uuid(), external_id: 'IA-1', issued: { by: 'x', at: AT1, reason: 'r' }, functions: [{ id: uuid(), name: 'a', kind: 'normal' }] }),
      node({ id: uuid(), functions: [{ id: uuid(), name: 'b', kind: 'normal', external_id: 'FN-9-01', issued: { by: 'x', at: AT1, reason: 'r' } }] }),
      node({ id: uuid() }),
    ]
    expect(issuanceSummary(nodes)).toEqual({ ia_total: 3, ia_issued: 1, fn_total: 2, fn_issued: 1 })
  })
})

describe('모듈 경계', () => {
  it('일괄 발번·자동 보정 API 를 두지 않는다 — 한 대상씩, 사람이 준 사유와 함께만', () => {
    const names = Object.keys(idRegistryModule)
    expect(names.filter((n) => /bulk|batch|issueAll|relabelAll|backfill|autoIssue/i.test(n))).toEqual([])
  })

  it('iaNumberOf 는 형식이 아니면 null 이다', () => {
    expect(iaNumberOf('IA-2.3.1')).toBe('2.3.1')
    expect(iaNumberOf('FN-2.3.1-01')).toBeNull()
  })
})
