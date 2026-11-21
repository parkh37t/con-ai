/**
 * 메뉴구조도(IA) ↔ 화면 연결 규칙.
 *
 * 연결은 **단방향 한 필드**다: `IANode.screen_plan_id → ScreenDocument.id`(내부 UUID).
 * 화면 쪽에 역참조는 없다.
 *
 * 왜 규칙이 필요한가 — 이 필드를 쓰는 경로가 없어서 RTM 의 `link_screen` 제안이 UI 에서
 * 「기능 추가」로 샜고, 승인하면 사유·행위자가 붙은 **거짓 기능**이 추적 기록에 남았다.
 * 쓰는 경로를 열면서 막을 것을 함께 막는다:
 *
 * - 카테고리 노드에는 화면을 직접 붙이지 않는다 (설계 §6; `IANode` 스키마도 거부한다).
 * - 없는 화면·다른 프로젝트의 화면은 붙이지 않는다 (붙으면 고아 참조가 된다).
 * - 한 화면은 메뉴 **한 곳**에만 붙는다 — `menusForScreen` 이 첫 노드를 대표로 집으므로
 *   둘 이상이 같은 화면을 가리키면 breadcrumb·GNB 가 조용히 모호해진다.
 * - 이미 다른 화면이 붙어 있으면 **바꾸지 않는다.** 개명(relabel)을 발번과 분리한 것과 같은 이유다 —
 *   연결을 갈아끼우는 것은 사유·이력이 따로 필요한 별개 작업이고, 이 제안(`link_screen`)은
 *   «화면이 없다» 일 때만 나온다.
 *
 * 판정 함수는 이유 목록을 돌려주고, 적용 함수는 거부 시 `DomainRuleError` 를 던진다 (result.ts).
 */
import type { IANode, InternalId } from '@con-ai/schemas'
import { actorReasons, type IdActorInput } from './id-registry.js'
import { assertAllowed, decide, type RuleDecision, type RuleReason } from './result.js'

/** 연결 대상 화면 — 존재·소속만 보므로 최소 모양이다. */
export interface LinkableScreen {
  id: InternalId
  project_id: InternalId
  /** 사람이 보는 화면 ID. 거부 사유 문구에만 쓴다. */
  external_id?: string | undefined
}

export interface LinkScreenInput extends IdActorInput {
  /** 붙일 화면의 **내부 UUID**. 사람이 보는 외부 ID 는 호출자가 미리 옮긴다. */
  screen_plan_id: InternalId
}

/** 이 IA 노드에 이 화면을 붙일 수 있는가. */
export function canLinkScreenToIaNode(nodes: readonly IANode[], target: IANode, screens: readonly LinkableScreen[], input: LinkScreenInput): RuleDecision {
  const reasons: RuleReason[] = actorReasons(input, 'ia_link')
  if (target.kind === 'category') {
    reasons.push({ code: 'ia_link.category_node', message: `「${target.name}」 는 분류(category) 노드다 — 화면은 화면(screen) 노드에만 붙인다 (설계 §6)` })
  }
  const screen = screens.find((s) => s.id === input.screen_plan_id)
  if (screen === undefined) {
    reasons.push({ code: 'ia_link.screen_not_found', message: '그 화면을 찾을 수 없다. 이미 지워졌거나 다른 프로젝트의 화면이다' })
  } else if (screen.project_id !== target.project_id) {
    reasons.push({ code: 'ia_link.other_project', message: `${screen.external_id ?? screen.id} 는 다른 프로젝트의 화면이다` })
  }
  if (target.screen_plan_id !== undefined) {
    reasons.push(
      target.screen_plan_id === input.screen_plan_id
        ? { code: 'ia_link.already_linked', message: `「${target.name}」 에는 이미 그 화면이 붙어 있다 — 바뀌는 것이 없다` }
        : { code: 'ia_link.occupied', message: `「${target.name}」 에는 이미 다른 화면이 붙어 있다. 연결을 바꾸는 것은 별개 작업이다 (사유·이력이 따로 필요하다)` },
    )
  }
  const owner = nodes.find((n) => n.id !== target.id && n.screen_plan_id === input.screen_plan_id)
  if (owner !== undefined) {
    reasons.push({
      code: 'ia_link.screen_taken',
      message: `그 화면은 이미 「${owner.name}」${owner.external_id === undefined ? '' : ` (${owner.external_id})`} 에 붙어 있다. 한 화면은 메뉴 한 곳에만 붙는다 — 그래야 breadcrumb·GNB 가 한 가지로 정해진다`,
    })
  }
  return decide(reasons)
}

/** 연결을 적용한 새 노드. 거부면 던진다. 사유는 IA 변경 사유로 남긴다. */
export function linkScreenToIaNode(nodes: readonly IANode[], target: IANode, screens: readonly LinkableScreen[], input: LinkScreenInput): IANode {
  assertAllowed(canLinkScreenToIaNode(nodes, target, screens, input), '화면을 IA 노드에 연결할 수 없다')
  return { ...target, screen_plan_id: input.screen_plan_id, change_reason: input.reason }
}
