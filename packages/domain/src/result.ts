/**
 * 판정 결과·규칙 오류 — 도메인 규칙의 공통 반환 형태.
 *
 * - 판정 함수(`can*` / `evaluate*` / `check*`)는 `RuleDecision` 을 돌려준다. 허용이면 `reasons` 가 비어 있고, 거부면 이유 목록이 있다.
 * - 적용 함수(`rename*` / `transition*` / `approve*` / `mark*`)는 같은 판정을 먼저 하고, 거부면 이유 목록이 붙은 `DomainRuleError` 를 던진다.
 *
 * 이유(`RuleReason`)는 코드와 한국어 메시지를 갖고, 메시지에 근거 문서의 절(설계 §n / 보고서 §n / 개발프롬프트)을 적는다.
 * "이유 없는 거부" 를 만들지 않기 위해 `deny()` 는 빈 이유 목록을 받지 않는다.
 */

/** 거부 이유 하나. `code` 는 `<모듈>.<규칙>` 형태의 안정된 식별자다. */
export interface RuleReason {
  code: string
  message: string
}

/** 판정 결과. allowed=true 이면 reasons 는 항상 빈 배열이다. */
export interface RuleDecision {
  allowed: boolean
  reasons: RuleReason[]
}

/** 허용 판정. */
export function allow(): RuleDecision {
  return { allowed: true, reasons: [] }
}

/** 거부 판정. 이유가 하나도 없으면 프로그래밍 오류로 보고 던진다. */
export function deny(reasons: readonly RuleReason[]): RuleDecision {
  if (reasons.length === 0) throw new Error('거부 판정에는 이유가 최소 1개 필요하다')
  return { allowed: false, reasons: [...reasons] }
}

/** 모아 둔 이유 목록으로 판정을 만든다: 비어 있으면 허용, 아니면 거부. */
export function decide(reasons: readonly RuleReason[]): RuleDecision {
  return reasons.length === 0 ? allow() : deny(reasons)
}

/** 도메인 규칙 위반. `reasons` 에 판정의 이유 목록이 그대로 붙는다. */
export class DomainRuleError extends Error {
  override readonly name = 'DomainRuleError'
  readonly code: string
  readonly reasons: readonly RuleReason[]

  constructor(context: string, reasons: readonly RuleReason[]) {
    const lines = reasons.map((r) => `- [${r.code}] ${r.message}`)
    super(`${context}\n${lines.join('\n')}`)
    this.code = reasons[0]?.code ?? 'domain.unknown'
    this.reasons = [...reasons]
  }
}

/** 판정이 거부이면 `DomainRuleError` 를 던진다. 적용 함수가 판정 함수 뒤에 부른다. */
export function assertAllowed(decision: RuleDecision, context: string): void {
  if (!decision.allowed) throw new DomainRuleError(context, decision.reasons)
}
