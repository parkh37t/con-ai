/**
 * 화면 ↔ IA 연결 규칙.
 *
 * 이 규칙이 없어서 RTM 의 `link_screen` 제안이 UI 에서 「기능 추가」로 샜고, 승인하면
 * 사유·행위자가 붙은 **거짓 기능**이 추적 기록에 남았다. 쓰는 경로를 열면서 막을 것을 함께 막는다.
 */
import { describe, expect, it } from 'vitest'
import { DomainRuleError } from './result.js'
import { canLinkScreenToIaNode, linkScreenToIaNode, type LinkableScreen } from './ia-link.js'
import type { IANode } from '@con-ai/schemas'

const PROJECT = 'a1000000-0000-4000-8000-000000000001'
const OTHER_PROJECT = 'a1000000-0000-4000-8000-000000000002'
const SCREEN = 'a4000000-0000-4000-8000-000000000001'
const SCREEN_2 = 'a4000000-0000-4000-8000-000000000002'

function node(over: Partial<IANode> = {}): IANode {
  return {
    id: 'b4000000-0000-4000-8000-000000000001',
    project_id: PROJECT,
    parent_id: null,
    name: '견적 상세',
    order: 0,
    portal: '파트너',
    kind: 'screen',
    ...over,
  } as IANode
}

const SCREENS: LinkableScreen[] = [
  { id: SCREEN, project_id: PROJECT, external_id: 'SCREEN-001' },
  { id: SCREEN_2, project_id: PROJECT, external_id: 'SCREEN-002' },
  { id: 'a4000000-0000-4000-8000-000000000009', project_id: OTHER_PROJECT, external_id: 'OTHER-001' },
]

const INPUT = { screen_plan_id: SCREEN, by: '기획자', reason: 'RTM 갭 승인', at: '2026-10-10T00:00:00.000Z' }

function codes(nodes: readonly IANode[], target: IANode, input = INPUT): string[] {
  const d = canLinkScreenToIaNode(nodes, target, SCREENS, input)
  return d.allowed ? [] : d.reasons.map((r) => r.code)
}

describe('canLinkScreenToIaNode', () => {
  it('화면 노드에 같은 프로젝트의 빈 화면을 붙이는 것은 허용한다', () => {
    const n = node()
    expect(codes([n], n)).toEqual([])
  })

  it('행위자·사유가 없으면 거부한다 — 연결도 사람이 사유와 함께 한다', () => {
    const n = node()
    expect(codes([n], n, { ...INPUT, by: '  ' })).toContain('ia_link.actor_required')
    expect(codes([n], n, { ...INPUT, reason: '' })).toContain('ia_link.reason_required')
    expect(codes([n], n, { ...INPUT, at: '어제' })).toContain('ia_link.timestamp_invalid')
  })

  it('분류(category) 노드에는 붙이지 않는다 (설계 §6)', () => {
    const n = node({ kind: 'category' })
    expect(codes([n], n)).toContain('ia_link.category_node')
  })

  it('없는 화면은 붙이지 않는다 — 붙으면 고아 참조가 된다', () => {
    const n = node()
    expect(codes([n], n, { ...INPUT, screen_plan_id: 'a4000000-0000-4000-8000-000000000404' })).toContain('ia_link.screen_not_found')
  })

  it('다른 프로젝트의 화면은 붙이지 않는다', () => {
    const n = node()
    expect(codes([n], n, { ...INPUT, screen_plan_id: 'a4000000-0000-4000-8000-000000000009' })).toContain('ia_link.other_project')
  })

  it('이미 같은 화면이 붙어 있으면 「바뀌는 것이 없다」로 거부한다 (빈 revision 을 만들지 않는다)', () => {
    const n = node({ screen_plan_id: SCREEN })
    expect(codes([n], n)).toContain('ia_link.already_linked')
  })

  it('이미 다른 화면이 붙어 있으면 갈아끼우지 않는다 — 별개 작업이다', () => {
    const n = node({ screen_plan_id: SCREEN_2 })
    expect(codes([n], n)).toContain('ia_link.occupied')
  })

  it('그 화면이 다른 메뉴에 이미 붙어 있으면 거부한다 — 한 화면은 메뉴 한 곳에만 붙는다', () => {
    const mine = node()
    const other = node({ id: 'b4000000-0000-4000-8000-000000000002', name: '견적 목록', external_id: 'IA-1.2', screen_plan_id: SCREEN })
    const found = codes([mine, other], mine)
    expect(found).toContain('ia_link.screen_taken')
    // 왜 막는지 사유에 적는다 (menusForScreen 이 첫 노드를 대표로 집는다).
    const d = canLinkScreenToIaNode([mine, other], mine, SCREENS, INPUT)
    expect(d.allowed).toBe(false)
    expect(d.reasons.map((r) => r.message).join(' ')).toContain('견적 목록')
  })
})

describe('linkScreenToIaNode', () => {
  it('연결을 적용하고 사유를 IA 변경 사유로 남긴다', () => {
    const n = node()
    const next = linkScreenToIaNode([n], n, SCREENS, INPUT)
    expect(next.screen_plan_id).toBe(SCREEN)
    expect(next.change_reason).toBe('RTM 갭 승인')
    // 원본을 고치지 않는다
    expect(n.screen_plan_id).toBeUndefined()
  })

  it('거부면 DomainRuleError 를 던진다 (조용히 통과시키지 않는다)', () => {
    const n = node({ kind: 'category' })
    expect(() => linkScreenToIaNode([n], n, SCREENS, INPUT)).toThrow(DomainRuleError)
  })
})
