/**
 * 「메뉴에서 화면 만들기」의 **순수 규칙** — 메뉴구조도 → 화면 ID → 근거(SSOT) → 프롬프트 → 생성.
 *
 * 이 화면이 있는 이유: 한 줄 문장만 받으면 「무엇을 근거로 무엇을 만들었는가」가 사라진다.
 * 화면설계서는 그 사슬이 보여야 검토·이관이 된다. 그래서 만들기 전에 **네 가지를 먼저 보여 준다**:
 *   ① 어느 메뉴인가(메뉴구조도 노드·경로·IA 외부 ID)
 *   ② 화면 ID 는 무엇인가
 *   ③ 근거(SSOT)는 무엇인가 — 기준 버전·요구사항·수용조건·참고 골든·프로파일 규칙
 *   ④ 그래서 프롬프트는 무엇인가 (실제로 보낼 것을 그 자리에서 조립해 보여 준다)
 *
 * 여기에는 화면 그리기·API 호출을 두지 않는다 (테스트가 규칙만 본다).
 */
import type { IANode, ProjectDetail, Reference, Requirement, ScreenSummary, SliceCase, SliceGenerationRequest } from './types.js'

/** 생성에 넣을 CASE — 만들기 화면과 같은 기본값. */
export const PLAN_CASES: readonly SliceCase[] = ['normal', 'empty', 'error']

/** 이 메뉴 노드의 화면이 어느 단계인가. 세 층을 구분한다 — 뭉뚱그리면 «없음» 과 «아직 안 만듦» 이 섞인다. */
export type PlanScreenState =
  | 'no_screen' // 메뉴에 화면이 아예 붙지 않았다
  | 'missing' // 붙었는데 그 화면 문서가 없다 (고아 참조)
  | 'draft' // 화면은 있고 아직 설계서를 만들지 않았다
  | 'built' // 설계서가 있다

export interface PlanNode {
  node: IANode
  depth: number
  /** 포털부터 이 노드의 부모까지의 이름. */
  path: string[]
  screen?: ScreenSummary | undefined
  state: PlanScreenState
  /** 이 노드가 담당하는 요구사항 외부 ID (노드에 적힌 것). */
  requirement_ids: string[]
}

/** 트리를 화면에 그릴 순서(깊이 우선)로 펼친다. 형제는 order → 이름 순이다. */
export function flattenMenu(nodes: readonly IANode[], screens: readonly ScreenSummary[]): PlanNode[] {
  const byId = new Set(nodes.map((n) => n.id))
  const screenById = new Map(screens.map((s) => [s.id, s]))
  const childrenOf = (parent: string | null): IANode[] =>
    nodes
      .filter((n) => (n.parent_id !== null && byId.has(n.parent_id) ? n.parent_id : null) === parent)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ko'))

  const out: PlanNode[] = []
  const seen = new Set<string>()
  const walk = (parent: string | null, depth: number, path: string[]): void => {
    for (const node of childrenOf(parent)) {
      if (seen.has(node.id)) continue
      seen.add(node.id)
      const screen = node.screen_plan_id === undefined ? undefined : screenById.get(node.screen_plan_id)
      out.push({ node, depth, path: [...path], screen, state: screenStateOf(node, screen), requirement_ids: [...(node.requirement_ids ?? [])] })
      walk(node.id, depth + 1, [...path, node.name])
    }
  }
  walk(null, 0, [])
  return out
}

/**
 * 화면 상태 판정. 데모 스냅샷은 `current_revision_id` 를 **null** 로 직렬화하므로 `== null` 로 둘 다 잡는다
 * (`=== undefined` 만 쓰면 null 을 «만들어짐» 으로 오판한다).
 */
export function screenStateOf(node: IANode, screen: ScreenSummary | undefined): PlanScreenState {
  if (node.kind === 'category') return node.screen_plan_id === undefined ? 'no_screen' : 'missing'
  if (node.screen_plan_id === undefined) return 'no_screen'
  if (screen === undefined) return 'missing'
  return screen.current_revision_id == null ? 'draft' : 'built'
}

/** 지금 만들 수 있는 메뉴 — 화면 문서가 있고 아직 설계서가 없는 것. */
export function buildableNodes(list: readonly PlanNode[]): PlanNode[] {
  return list.filter((n) => n.state === 'draft')
}

export interface SsotItem {
  /** 근거의 종류. 화면에 그대로 라벨로 쓴다. */
  kind: '기준 버전' | '요구사항' | '수용조건' | '참고 골든' | '프로파일 규칙'
  /** 그 근거의 값 (ID·제목). */
  label: string
  /** 어디서 왔는지 — 사람이 되짚을 수 있게 적는다. */
  source: string
}

/**
 * 이 메뉴의 화면을 만들 때 **실제로 프롬프트에 들어가는 근거**를 모은다.
 * 여기 없는 것은 프롬프트에도 없다 — 화면과 프롬프트가 다른 말을 하지 않게 같은 규칙으로 고른다.
 */
export function ssotFor(input: {
  plan: PlanNode
  project: ProjectDetail['project']
  requirements: readonly Requirement[]
  references: readonly Reference[]
  reference_ids: readonly string[]
  profile_rule_count: number
}): SsotItem[] {
  const out: SsotItem[] = []
  const baseline = input.project.baseline_id
  out.push({ kind: '기준 버전', label: baseline ?? `baseline-${input.project.slug ?? input.project.id}-1`, source: baseline ? '프로젝트 문서의 baseline_id' : '프로젝트 slug 로 만든 기본값' })

  const picked = pickRequirements(input.plan, input.requirements)
  if (picked.length === 0) {
    out.push({ kind: '요구사항', label: '없음 — 이 메뉴에 연결된 요구사항이 없다', source: '메뉴구조도 노드의 requirement_ids' })
  }
  for (const r of picked) {
    out.push({ kind: '요구사항', label: `${r.external_id} ${r.title}`, source: '메뉴구조도 노드의 requirement_ids' })
    const ui = r.criteria.filter((c) => c.kind === 'ui')
    const nonUi = r.criteria.filter((c) => c.kind === 'non_ui')
    out.push({
      kind: '수용조건',
      label: `${r.external_id}: UI ${ui.length}건${nonUi.length > 0 ? ` · 비UI ${nonUi.length}건(화면에 매핑하지 않음)` : ''}`,
      source: '요구사항 문서의 수용조건',
    })
  }

  const refs = input.references.filter((r) => input.reference_ids.includes(r.id))
  if (refs.length === 0) out.push({ kind: '참고 골든', label: '없음', source: '화면 종류에 맞는 골든이 이 프로젝트에 없다' })
  for (const r of refs) out.push({ kind: '참고 골든', label: `${r.id} ${r.title}`, source: `분류 ${r.category} 의 승인 템플릿` })

  out.push({ kind: '프로파일 규칙', label: `${input.profile_rule_count}건`, source: `프로파일 ${input.project.profile_id} (system 프롬프트에만 들어간다)` })
  return out
}

/** 이 메뉴가 담당하는 요구사항. 노드에 적힌 것만 쓴다 — 프로젝트 전체를 넣지 않는다. */
export function pickRequirements(plan: PlanNode, requirements: readonly Requirement[]): Requirement[] {
  const wanted = new Set(plan.requirement_ids)
  return requirements.filter((r) => wanted.has(r.external_id))
}

/**
 * 이 메뉴의 화면을 만드는 생성 요청.
 * 목적 문장은 **요구사항 본문에서** 만든다 (사람이 도메인마다 문장을 적어 두지 않는다).
 */
export function buildPlanRequest(input: {
  plan: PlanNode
  screen_id: string
  device: 'desktop' | 'mobile'
  requirements: readonly Requirement[]
  reference_ids: readonly string[]
}): SliceGenerationRequest {
  const picked = pickRequirements(input.plan, input.requirements)
  const criterion_ids = picked.flatMap((r) => r.criteria.filter((c) => c.kind === 'ui').map((c) => c.id))
  return {
    screen_id: input.screen_id,
    task_type: 'create',
    purpose: planPurpose(input.plan, picked),
    // 요청의 requirement_ids 는 **내부 문서 id** 다 (파이프라인이 그것으로 찾는다).
    // 메뉴구조도 노드는 **외부 ID**(REQ-BK-001)로 적혀 있으므로 여기서 옮긴다 — 사람에게는 외부 ID 를 보여주고 API 에는 내부 id 를 보낸다.
    requirement_ids: picked.map((r) => r.id),
    criterion_ids,
    reference_ids: [...input.reference_ids],
    cases: [...PLAN_CASES],
    keep_conditions: [],
    roles: [],
    device: input.device,
  }
}

/** 목적 문장 — 「<메뉴 경로>의 <화면명>」 + 요구사항 본문. 근거가 없으면 그렇게 적는다. */
export function planPurpose(plan: PlanNode, picked: readonly Requirement[]): string {
  const where = [...plan.path, plan.node.name].join(' > ')
  if (picked.length === 0) return `${where} 화면을 만든다. 이 메뉴에 연결된 요구사항이 없어 근거가 없다.`
  return `${where} 화면을 만든다. ${picked.map((r) => r.body).join(' ')}`
}
