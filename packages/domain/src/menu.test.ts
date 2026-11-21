/**
 * 메뉴구조도 → GNB 메뉴. 목업의 메뉴가 IA 트리와 다르면 설계서가 스스로를 반박한다.
 */
import { describe, expect, it } from 'vitest'
import { menusForScreen, type MenuIaNode, type MenuScreen } from './menu.js'

// MY 뱅킹 ─ 계좌 ─ 거래내역 조회 / 거래 상세
//         └ 메인 페이지
const NODES: MenuIaNode[] = [
  { id: 'portal', parent_id: null, name: 'MY 뱅킹', order: 0, kind: 'category' },
  { id: 'cat', parent_id: 'portal', name: '계좌', order: 0, kind: 'category' },
  { id: 'list', parent_id: 'cat', name: '거래내역 조회', order: 0, kind: 'screen', screen_plan_id: 's-list', external_id: 'IA-1.1.1' },
  { id: 'detail', parent_id: 'cat', name: '거래 상세', order: 1, kind: 'screen', screen_plan_id: 's-detail' },
  { id: 'main', parent_id: 'portal', name: '메인 페이지', order: 1, kind: 'screen', screen_plan_id: 's-main' },
]
const SCREENS: MenuScreen[] = [
  { id: 's-list', external_id: 'SAMPLE-bank-txn-list' },
  { id: 's-detail', external_id: 'SAMPLE-bank-txn-detail' },
  { id: 's-main', external_id: 'SAMPLE-bank-main' },
]

describe('menusForScreen — 목업의 GNB 는 메뉴구조도에서 온다', () => {
  it('최상위 포털의 직속 자식이 메뉴가 되고, 분류는 그 아래 첫 화면을 대표로 삼는다', () => {
    const r = menusForScreen(NODES, SCREENS, 's-main')
    expect(r.menus.map((m) => m.label)).toEqual(['계좌', '메인 페이지'])
    expect(r.menus[0]?.screen_id).toBe('SAMPLE-bank-txn-list') // 계좌 분류의 대표 화면
    expect(r.menus[1]?.screen_id).toBe('SAMPLE-bank-main')
  })

  it('지금 보고 있는 화면이 속한 메뉴에 active 가 붙는다 (하위 화면이어도 그 분류가 켜진다)', () => {
    expect(menusForScreen(NODES, SCREENS, 's-main').menus.find((m) => m.active)?.label).toBe('메인 페이지')
    expect(menusForScreen(NODES, SCREENS, 's-detail').menus.find((m) => m.active)?.label).toBe('계좌')
  })

  it('메뉴 경로는 포털부터 부모까지다 (화면 이름 자체는 넣지 않는다)', () => {
    expect(menusForScreen(NODES, SCREENS, 's-detail').path).toEqual(['MY 뱅킹', '계좌'])
    expect(menusForScreen(NODES, SCREENS, 's-main').path).toEqual(['MY 뱅킹'])
  })

  it('IA 외부 ID 는 발번된 것만 싣는다 — 없으면 비운다 (지어내지 않는다)', () => {
    expect(menusForScreen(NODES, SCREENS, 's-list').ia_id).toBe('IA-1.1.1')
    expect(menusForScreen(NODES, SCREENS, 's-main').ia_id).toBeUndefined()
  })

  it('대표 화면의 화면 문서가 없으면 screen_id 를 비운다 — 없는 화면으로 가는 척하지 않는다', () => {
    const r = menusForScreen(NODES, [{ id: 's-main', external_id: 'SAMPLE-bank-main' }], 's-main')
    expect(r.menus.find((m) => m.label === '계좌')?.screen_id).toBeUndefined()
  })

  it('메뉴구조도에 없는 화면이면 빈 결과다 (부르는 쪽이 기본 메뉴로 되돌아간다)', () => {
    expect(menusForScreen(NODES, SCREENS, 's-없음')).toEqual({ menus: [], path: [] })
    expect(menusForScreen([], SCREENS, 's-main')).toEqual({ menus: [], path: [] })
  })

  it('부모 고리가 있어도 멈춘다 (무한 반복하지 않는다)', () => {
    const loop: MenuIaNode[] = [
      { id: 'a', parent_id: 'b', name: 'A', order: 0, kind: 'category' },
      { id: 'b', parent_id: 'a', name: 'B', order: 0, kind: 'screen', screen_plan_id: 's-x' },
    ]
    expect(() => menusForScreen(loop, [{ id: 's-x', external_id: 'X' }], 's-x')).not.toThrow()
  })
})
