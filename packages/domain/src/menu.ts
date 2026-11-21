/**
 * 메뉴구조도(IA) → 목업의 GNB 메뉴.
 *
 * 왜 여기 있나: 「이 화면이 어느 메뉴의 화면인가」는 화면명에서 짐작할 것이 아니라 **메뉴구조도에서 읽어야** 한다.
 * 목업의 GNB 가 IA 트리와 다르면 설계서가 스스로를 반박한다. 그래서 규칙을 한 곳에 두고
 * 서버 파이프라인과 브라우저 파이프라인이 같은 함수를 쓴다.
 *
 * 규칙
 * - GNB 한 칸 = **최상위(포털) 노드의 직속 자식**. 자식이 화면이면 그 화면, 분류면 그 아래 첫 화면을 대표로 삼는다.
 * - 대표 화면이 아직 없으면 `screen_id` 를 비운다 — 없는 화면으로 가는 척하지 않는다.
 * - 메뉴 경로는 포털부터 이 화면의 **부모까지**다 (화면 이름 자체는 넣지 않는다; 화면명은 따로 표시된다).
 * - 이 화면이 메뉴구조도에 없으면 아무것도 돌려주지 않는다. 지어내지 않는다.
 */

export interface MenuIaNode {
  id: string
  parent_id: string | null
  name: string
  order: number
  kind: 'category' | 'screen'
  screen_plan_id?: string | undefined
  external_id?: string | undefined
}

export interface MenuScreen {
  /** 화면의 내부 UUID (IANode.screen_plan_id 가 가리키는 값). */
  id: string
  external_id: string
}

export interface MenuItem {
  label: string
  active?: boolean
  /** 이 메뉴의 대표 화면 외부 ID. 없으면 아직 만들지 않은(또는 연결되지 않은) 메뉴다. */
  screen_id?: string
  /** 이 메뉴 노드의 IA 외부 ID. 발번 전이면 없다. */
  ia_id?: string
}

export interface ScreenMenus {
  /** GNB 메뉴 칸. 메뉴구조도에서 이 화면을 찾지 못하면 빈 배열이다. */
  menus: MenuItem[]
  /** 포털부터 이 화면의 부모까지의 이름. */
  path: string[]
  /** 이 화면이 붙은 IA 노드의 외부 ID (발번 전이면 없다). */
  ia_id?: string
}

const EMPTY: ScreenMenus = { menus: [], path: [] }

function childrenOf(nodes: readonly MenuIaNode[], parentId: string | null): MenuIaNode[] {
  return nodes.filter((n) => n.parent_id === parentId).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ko'))
}

/**
 * 이 노드(자기 자신 포함)에서 처음 만나는 화면 노드. 순서는 형제 정렬을 따른다.
 * `seen` 은 부모 고리에서 무한히 도는 것을 막는다 — 저장 데이터가 늘 옳다고 가정하지 않는다.
 */
function firstScreenNode(nodes: readonly MenuIaNode[], node: MenuIaNode, seen: Set<string> = new Set()): MenuIaNode | undefined {
  if (seen.has(node.id)) return undefined
  seen.add(node.id)
  if (node.kind === 'screen' && node.screen_plan_id !== undefined) return node
  for (const child of childrenOf(nodes, node.id)) {
    const found = firstScreenNode(nodes, child, seen)
    if (found !== undefined) return found
  }
  return undefined
}

/** 부모를 따라 올라가며 조상 목록을 만든다 (가까운 부모부터). 고리가 있으면 멈춘다. */
function ancestorsOf(nodes: readonly MenuIaNode[], node: MenuIaNode): MenuIaNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out: MenuIaNode[] = []
  const seen = new Set<string>([node.id])
  let cursor = node.parent_id
  while (cursor !== null && cursor !== undefined && !seen.has(cursor)) {
    const parent = byId.get(cursor)
    if (parent === undefined) break
    out.push(parent)
    seen.add(parent.id)
    cursor = parent.parent_id
  }
  return out
}

/** 그 노드가 어떤 화면들을 품고 있는가 (자기 자신 포함). 고리에서 멈춘다. */
function screenPlanIdsUnder(nodes: readonly MenuIaNode[], node: MenuIaNode, seen: Set<string> = new Set()): Set<string> {
  const out = new Set<string>()
  if (seen.has(node.id)) return out
  seen.add(node.id)
  if (node.screen_plan_id !== undefined) out.add(node.screen_plan_id)
  for (const child of childrenOf(nodes, node.id)) for (const id of screenPlanIdsUnder(nodes, child, seen)) out.add(id)
  return out
}

/**
 * 이 화면(내부 UUID)의 GNB 메뉴와 메뉴 경로.
 * 메뉴구조도에 없는 화면이면 빈 결과다 — 부르는 쪽이 기본 메뉴로 되돌아간다.
 */
export function menusForScreen(nodes: readonly MenuIaNode[], screens: readonly MenuScreen[], screenPlanId: string): ScreenMenus {
  const node = nodes.find((n) => n.screen_plan_id === screenPlanId)
  if (node === undefined) return EMPTY
  const externalById = new Map(screens.map((s) => [s.id, s.external_id]))
  const ancestors = ancestorsOf(nodes, node)
  const portal = ancestors[ancestors.length - 1] ?? node
  const top = childrenOf(nodes, portal.id === node.id ? node.parent_id : portal.id)

  const menus: MenuItem[] = top.map((child) => {
    const rep = firstScreenNode(nodes, child)
    const external = rep?.screen_plan_id === undefined ? undefined : externalById.get(rep.screen_plan_id)
    const item: MenuItem = { label: child.name }
    if (screenPlanIdsUnder(nodes, child).has(screenPlanId)) item.active = true
    if (external !== undefined) item.screen_id = external
    if (child.external_id !== undefined) item.ia_id = child.external_id
    return item
  })

  const path = [...ancestors].reverse().map((a) => a.name)
  const out: ScreenMenus = { menus, path }
  if (node.external_id !== undefined) out.ia_id = node.external_id
  return out
}
