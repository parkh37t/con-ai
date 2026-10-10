/**
 * IA·FN 외부 ID 발번·개명 규칙 — 산출물 pipeline-v2 P1-05 「ID 매핑 매트릭스」.
 *
 * 왜 `external-id.ts` 가 아니라 새 모듈인가:
 * 그 파일은 헤더에서 "ID 를 생성·부여하는 함수가 없다" 를 스스로 선언했고, `external-id.test.ts` 가
 * 모듈의 export 이름에 생성 계열 낱말이 없음을 단언한다. 그 불변식은 **화면 external_id** 에 대한 것이며
 * (기존 화면 ID 를 새 번호로 일괄 바꾸지 않는다), 여기서 다루는 IA·FN 은 아직 아무 ID 도 없는 새 계층이다.
 * 두 규칙을 한 파일에 섞지 않는다.
 *
 * 이 파일이 코드로 고정하는 것:
 * - **번호를 제안(propose)하는 것과 발번(issue)하는 것을 분리한다.** 제안은 순수 계산이라 언제든 부를 수 있지만,
 *   발번은 행위자·사유·시각을 받아야만 성공한다. 사람 없는 발번 경로가 존재하지 않는다.
 * - **번호를 재사용하지 않는다.** 다음 번호는 현재 값뿐 아니라 별칭(옛 값)까지 본 최대값 + 1 이다.
 *   개명·폐기한 번호가 다른 대상에게 다시 붙으면 이력이 거짓말이 된다.
 * - **개명은 옛 값을 지우지 않는다.** 현재 값을 `valid_to` 와 함께 별칭으로 내리고 새 값을 올린다.
 * - 일괄 발번·자동 보정 함수를 두지 않는다. 한 대상씩, 사람이 준 사유와 함께만 움직인다.
 *
 * IA 번호 체계 (기획자 결정, 2026-09-06): **포털 노드부터 센다.**
 * 파트너 포털 = IA-1, 그 아래 견적 = IA-1.1, 그 아래 견적 목록 = IA-1.1.1. 카테고리 노드에도 번호를 준다.
 * 산출물 예시 `IA-2.3.1` 과 같은 3단 형태가 된다.
 */
import { FN_EXTERNAL_ID_PATTERN, IA_EXTERNAL_ID_PATTERN, IaExternalId, FnExternalId, type FunctionEntry, type IANode, type IdAlias, type IdIssuance, type InternalId } from '@con-ai/schemas'
import { DomainRuleError, allow, assertAllowed, decide, type RuleDecision, type RuleReason } from './result.js'

/** 발번·개명 요청의 사람 정보. 셋 다 필수인 것이 이 모듈의 핵심 규칙이다. */
export interface IdActorInput {
  by: string
  reason: string
  /** ISO 8601 시각. 호출자가 넘긴다 — 도메인은 시계를 읽지 않는다(결정적 테스트를 위해). */
  at: string
}

/** 발번 요청 — 사람이 화면에서 확인한 값. */
export interface IssueInput extends IdActorInput {
  external_id: string
}

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

/** 행위자·사유·시각 검사. 어떤 발번·개명이든 이 관문을 지난다. (ia-link.ts 도 같은 관문을 쓴다) */
export function actorReasons(input: IdActorInput, prefix: string): RuleReason[] {
  const reasons: RuleReason[] = []
  if (input.by.trim().length === 0) {
    reasons.push({ code: `${prefix}.actor_required`, message: '발번·개명은 사람이 한다 — 행위자가 필요하다 (CLAUDE.md: 채택·승인은 사람)' })
  }
  if (input.reason.trim().length === 0) {
    reasons.push({ code: `${prefix}.reason_required`, message: '사유 없이 ID 를 붙이거나 바꾸지 않는다 (CLAUDE.md: 개명은 사유·별칭 기록이 있는 명시적 작업)' })
  }
  if (!ISO_PATTERN.test(input.at)) {
    reasons.push({ code: `${prefix}.timestamp_invalid`, message: `시각이 ISO 8601 이 아니다: ${input.at}` })
  }
  return reasons
}

// ─────────────────────────────────────────────────────────── 번호 제안 (순수 계산)

/** 형제 정렬 — order 오름차순, 같으면 id 로 안정 정렬. */
function sortSiblings(nodes: readonly IANode[]): IANode[] {
  return [...nodes].sort((a, b) => (a.order !== b.order ? a.order - b.order : a.id.localeCompare(b.id)))
}

/**
 * 트리 위치에서 IA 번호를 제안한다. 포털(최상위) 노드부터 1 로 센다.
 * 대상 노드를 찾지 못하면 null — 없는 것을 지어내지 않는다.
 */
export function proposeIaExternalId(nodes: readonly IANode[], targetId: InternalId): string | null {
  const byParent = new Map<string, IANode[]>()
  for (const n of nodes) {
    const key = n.parent_id ?? '\u0000root'
    const list = byParent.get(key)
    if (list) list.push(n)
    else byParent.set(key, [n])
  }
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const target = byId.get(targetId)
  if (!target) return null

  // 대상에서 루트까지 거슬러 올라간 뒤 뒤집어 각 단계의 형제 순번을 잇는다.
  const chain: IANode[] = []
  let cursor: IANode | undefined = target
  const guard = new Set<string>()
  while (cursor) {
    if (guard.has(cursor.id)) return null // 부모 고리 — 번호를 지어내지 않는다
    guard.add(cursor.id)
    chain.push(cursor)
    cursor = cursor.parent_id === null ? undefined : byId.get(cursor.parent_id)
  }
  chain.reverse()

  const parts: number[] = []
  for (const node of chain) {
    const siblings = sortSiblings(byParent.get(node.parent_id ?? '\u0000root') ?? [])
    const index = siblings.findIndex((s) => s.id === node.id)
    if (index < 0) return null
    parts.push(index + 1)
  }
  return `IA-${parts.join('.')}`
}

/** IA 외부 ID 에서 계층 번호만 떼어낸다 (`IA-2.3.1` → `2.3.1`). 형식이 아니면 null. */
export function iaNumberOf(externalId: string): string | null {
  return IA_EXTERNAL_ID_PATTERN.test(externalId) ? externalId.slice('IA-'.length) : null
}

/** 이 노드가 지금까지 쓴 FN 일련번호 전부 — 현재 값과 별칭(옛 값)을 함께 본다. 번호 재사용을 막는 근거다. */
function usedFnSequences(node: Pick<IANode, 'functions'>): number[] {
  const used: number[] = []
  for (const fn of node.functions ?? []) {
    const values = [fn.external_id, ...(fn.aliases ?? []).map((a) => a.external_id)]
    for (const v of values) {
      if (v === undefined || !FN_EXTERNAL_ID_PATTERN.test(v)) continue
      const seq = Number.parseInt(v.slice(v.lastIndexOf('-') + 1), 10)
      if (Number.isFinite(seq)) used.push(seq)
    }
  }
  return used
}

/**
 * 다음 FN 번호를 제안한다. 노드에 IA 외부 ID 가 없으면 null — IA 가 발번되기 전에는 FN 번호를 만들 수 없다.
 * 일련번호는 현재·별칭을 통틀어 쓰인 적 있는 최대값 + 1 이다 (번호 재사용 금지).
 * 99 를 넘으면 null 을 돌려주고 호출자가 사람에게 알린다 — 형식을 조용히 어기지 않는다.
 */
export function proposeFnExternalId(node: Pick<IANode, 'external_id' | 'functions'>): string | null {
  if (node.external_id === undefined) return null
  const number = iaNumberOf(node.external_id)
  if (number === null) return null
  const used = usedFnSequences(node)
  const next = (used.length === 0 ? 0 : Math.max(...used)) + 1
  if (next > 99) return null
  return `FN-${number}-${String(next).padStart(2, '0')}`
}

// ─────────────────────────────────────────────────────────── IA 발번·개명

/** 같은 프로젝트 안에서 이 외부 ID 가 이미 쓰이고 있는가 (현재 값·별칭 모두). */
function iaExternalIdTaken(nodes: readonly IANode[], externalId: string, exceptId?: InternalId): boolean {
  return nodes.some((n) => {
    if (exceptId !== undefined && n.id === exceptId) return false
    if (n.external_id === externalId) return true
    return (n.aliases ?? []).some((a) => a.external_id === externalId)
  })
}

/** IA 발번 판정. 거부 이유를 모두 모아 돌려준다. */
export function canIssueIaExternalId(nodes: readonly IANode[], target: IANode, input: IssueInput): RuleDecision {
  const reasons: RuleReason[] = actorReasons(input, 'id_registry')
  if (target.external_id !== undefined) {
    reasons.push({ code: 'id_registry.already_issued', message: `이 IA 노드에는 이미 ${target.external_id} 가 발번되어 있다. 바꾸려면 개명(relabel)을 쓴다` })
  }
  if (!IaExternalId.safeParse(input.external_id).success) {
    reasons.push({ code: 'id_registry.format_invalid', message: `IA 외부 ID 형식이 아니다: ${input.external_id} (예: IA-2.3.1)` })
  }
  if (iaExternalIdTaken(nodes, input.external_id, target.id)) {
    reasons.push({ code: 'id_registry.duplicate', message: `${input.external_id} 는 이미 쓰이고 있다 (현재 값이거나 과거 별칭). 번호는 재사용하지 않는다` })
  }
  return decide(reasons)
}

/** IA 발번 적용. 판정이 거부면 DomainRuleError 를 던진다 — 거부인데 저장되는 일이 없게 한다. */
export function issueIaExternalId(nodes: readonly IANode[], target: IANode, input: IssueInput): IANode {
  assertAllowed(canIssueIaExternalId(nodes, target, input), 'IA 외부 ID 를 발번할 수 없다')
  const issued: IdIssuance = { by: input.by.trim(), at: input.at, reason: input.reason.trim() }
  return { ...target, external_id: input.external_id, issued }
}

/** IA 개명 판정 — 이미 발번된 것만 바꿀 수 있고, 새 값은 형식·중복 검사를 지난다. */
export function canRelabelIaExternalId(nodes: readonly IANode[], target: IANode, input: IssueInput): RuleDecision {
  const reasons: RuleReason[] = actorReasons(input, 'id_registry')
  if (target.external_id === undefined) {
    reasons.push({ code: 'id_registry.not_issued', message: '아직 발번되지 않은 IA 노드는 개명할 수 없다. 먼저 발번한다' })
  } else if (target.external_id === input.external_id) {
    reasons.push({ code: 'id_registry.unchanged', message: '같은 값으로는 개명하지 않는다 (이력만 늘어난다)' })
  }
  if (!IaExternalId.safeParse(input.external_id).success) {
    reasons.push({ code: 'id_registry.format_invalid', message: `IA 외부 ID 형식이 아니다: ${input.external_id}` })
  }
  if (iaExternalIdTaken(nodes, input.external_id, target.id)) {
    reasons.push({ code: 'id_registry.duplicate', message: `${input.external_id} 는 이미 쓰이고 있다. 번호는 재사용하지 않는다` })
  }
  return decide(reasons)
}

/**
 * IA 개명 적용. 옛 값을 지우지 않고 `valid_to` 와 함께 별칭으로 내린다.
 * FN 외부 ID 의 계층부는 **자동으로 따라 바꾸지 않는다** — 그것은 FN 개명이며 사람이 따로 승인해야 한다.
 * 그 결과 IA 와 FN 번호가 어긋날 수 있고, 그 사실은 RTM 이 불일치로 보고한다.
 */
export function relabelIaExternalId(nodes: readonly IANode[], target: IANode, input: IssueInput): IANode {
  assertAllowed(canRelabelIaExternalId(nodes, target, input), 'IA 외부 ID 를 개명할 수 없다')
  const previous = target.external_id
  if (previous === undefined) throw new DomainRuleError('개명 대상에 현재 외부 ID 가 없다', [{ code: 'id_registry.not_issued', message: '발번되지 않았다' }])
  const validFrom = target.issued?.at ?? input.at
  const retired: IdAlias = { external_id: previous, valid_from: validFrom, valid_to: input.at, reason: input.reason.trim(), by: input.by.trim() }
  const issued: IdIssuance = { by: input.by.trim(), at: input.at, reason: input.reason.trim() }
  return { ...target, external_id: input.external_id, issued, aliases: [...(target.aliases ?? []), retired] }
}

// ─────────────────────────────────────────────────────────── FN 발번·개명

/** 같은 IA 노드 안에서 이 FN 외부 ID 가 이미 쓰이고 있는가 (현재 값·별칭 모두). */
function fnExternalIdTaken(node: Pick<IANode, 'functions'>, externalId: string, exceptId?: InternalId): boolean {
  return (node.functions ?? []).some((fn) => {
    if (exceptId !== undefined && fn.id === exceptId) return false
    if (fn.external_id === externalId) return true
    return (fn.aliases ?? []).some((a) => a.external_id === externalId)
  })
}

/** FN 발번 판정. IA 가 먼저 발번돼 있어야 하고, 계층부가 소속 IA 와 같아야 한다. */
export function canIssueFnExternalId(node: IANode, fn: FunctionEntry, input: IssueInput): RuleDecision {
  const reasons: RuleReason[] = actorReasons(input, 'id_registry')
  if (node.external_id === undefined) {
    reasons.push({ code: 'id_registry.ia_not_issued', message: 'IA 외부 ID 가 먼저 발번되어야 FN 번호를 붙일 수 있다 (FN 번호는 소속 IA 번호를 포함한다)' })
  }
  if (fn.external_id !== undefined) {
    reasons.push({ code: 'id_registry.already_issued', message: `이 기능에는 이미 ${fn.external_id} 가 발번되어 있다` })
  }
  if (!FnExternalId.safeParse(input.external_id).success) {
    reasons.push({ code: 'id_registry.format_invalid', message: `FN 외부 ID 형식이 아니다: ${input.external_id} (예: FN-2.3.1-02)` })
  } else if (node.external_id !== undefined) {
    const iaNumber = iaNumberOf(node.external_id)
    const fnNumber = input.external_id.slice('FN-'.length, input.external_id.lastIndexOf('-'))
    if (iaNumber !== null && fnNumber !== iaNumber) {
      reasons.push({ code: 'id_registry.layer_mismatch', message: `FN 번호의 계층부(${fnNumber})가 소속 IA(${node.external_id})와 다르다` })
    }
  }
  if (fnExternalIdTaken(node, input.external_id, fn.id)) {
    reasons.push({ code: 'id_registry.duplicate', message: `${input.external_id} 는 이 IA 노드 안에서 이미 쓰였다. 번호는 재사용하지 않는다` })
  }
  return decide(reasons)
}

/** FN 발번 적용 — 갱신된 IANode 를 돌려준다 (FN 은 노드 문서 안에 산다). */
export function issueFnExternalId(node: IANode, fnId: InternalId, input: IssueInput): IANode {
  const fns = node.functions ?? []
  const fn = fns.find((f) => f.id === fnId)
  if (!fn) throw new DomainRuleError('발번 대상 기능을 찾지 못했다', [{ code: 'id_registry.function_not_found', message: `기능 ${fnId} 가 이 IA 노드에 없다` }])
  assertAllowed(canIssueFnExternalId(node, fn, input), 'FN 외부 ID 를 발번할 수 없다')
  const issued: IdIssuance = { by: input.by.trim(), at: input.at, reason: input.reason.trim() }
  return { ...node, functions: fns.map((f) => (f.id === fnId ? { ...f, external_id: input.external_id, issued } : f)) }
}

/** FN 개명 판정. */
export function canRelabelFnExternalId(node: IANode, fn: FunctionEntry, input: IssueInput): RuleDecision {
  const reasons: RuleReason[] = actorReasons(input, 'id_registry')
  if (fn.external_id === undefined) {
    reasons.push({ code: 'id_registry.not_issued', message: '아직 발번되지 않은 기능은 개명할 수 없다' })
  } else if (fn.external_id === input.external_id) {
    reasons.push({ code: 'id_registry.unchanged', message: '같은 값으로는 개명하지 않는다' })
  }
  if (!FnExternalId.safeParse(input.external_id).success) {
    reasons.push({ code: 'id_registry.format_invalid', message: `FN 외부 ID 형식이 아니다: ${input.external_id}` })
  } else if (node.external_id !== undefined) {
    const iaNumber = iaNumberOf(node.external_id)
    const fnNumber = input.external_id.slice('FN-'.length, input.external_id.lastIndexOf('-'))
    if (iaNumber !== null && fnNumber !== iaNumber) {
      reasons.push({ code: 'id_registry.layer_mismatch', message: `FN 번호의 계층부(${fnNumber})가 소속 IA(${node.external_id})와 다르다` })
    }
  }
  if (fnExternalIdTaken(node, input.external_id, fn.id)) {
    reasons.push({ code: 'id_registry.duplicate', message: `${input.external_id} 는 이 IA 노드 안에서 이미 쓰였다` })
  }
  return decide(reasons)
}

/** FN 개명 적용 — 옛 값을 별칭으로 내린다. */
export function relabelFnExternalId(node: IANode, fnId: InternalId, input: IssueInput): IANode {
  const fns = node.functions ?? []
  const fn = fns.find((f) => f.id === fnId)
  if (!fn) throw new DomainRuleError('개명 대상 기능을 찾지 못했다', [{ code: 'id_registry.function_not_found', message: `기능 ${fnId} 가 이 IA 노드에 없다` }])
  assertAllowed(canRelabelFnExternalId(node, fn, input), 'FN 외부 ID 를 개명할 수 없다')
  const previous = fn.external_id
  if (previous === undefined) throw new DomainRuleError('개명 대상에 현재 외부 ID 가 없다', [{ code: 'id_registry.not_issued', message: '발번되지 않았다' }])
  const retired: IdAlias = { external_id: previous, valid_from: fn.issued?.at ?? input.at, valid_to: input.at, reason: input.reason.trim(), by: input.by.trim() }
  const issued: IdIssuance = { by: input.by.trim(), at: input.at, reason: input.reason.trim() }
  return { ...node, functions: fns.map((f) => (f.id === fnId ? { ...f, external_id: input.external_id, issued, aliases: [...(f.aliases ?? []), retired] } : f)) }
}

// ─────────────────────────────────────────────────────────── 조회

/** 외부 ID 해석 결과 — 지금 쓰는 값인지, 과거 값인지 구분한다. 둘을 같은 것으로 뭉개지 않는다. */
export type IdResolution = { kind: 'current' } | { kind: 'alias'; retired_at: string | undefined } | { kind: 'unknown' }

/** 이 대상이 주어진 외부 ID 로 불린 적이 있는가. */
export function resolveIssuedId(target: { external_id?: string | undefined; aliases?: readonly IdAlias[] | undefined }, externalId: string): IdResolution {
  if (target.external_id === externalId) return { kind: 'current' }
  const alias = (target.aliases ?? []).find((a) => a.external_id === externalId)
  if (alias) return { kind: 'alias', retired_at: alias.valid_to }
  return { kind: 'unknown' }
}

/**
 * 주어진 시점에 이 대상이 어떤 외부 ID 로 보였는가. 과거 산출물의 ID 를 해석할 때 쓴다.
 * 해당 시점에 아무 ID 도 없었으면 null — 「없었다」를 현재 값으로 채우지 않는다.
 */
export function externalIdAtFor(target: { external_id?: string | undefined; issued?: IdIssuance | undefined; aliases?: readonly IdAlias[] | undefined }, at: string): string | null {
  for (const alias of target.aliases ?? []) {
    const startedBefore = alias.valid_from <= at
    const stillValid = alias.valid_to === undefined || at < alias.valid_to
    if (startedBefore && stillValid) return alias.external_id
  }
  if (target.external_id !== undefined && (target.issued === undefined || target.issued.at <= at)) return target.external_id
  return null
}

/** 발번 여부 요약 — 화면이 «미발번» 을 정확히 적기 위한 값. */
export function issuanceSummary(nodes: readonly IANode[]): { ia_total: number; ia_issued: number; fn_total: number; fn_issued: number } {
  let fnTotal = 0
  let fnIssued = 0
  for (const n of nodes) {
    for (const fn of n.functions ?? []) {
      fnTotal += 1
      if (fn.external_id !== undefined) fnIssued += 1
    }
  }
  return { ia_total: nodes.length, ia_issued: nodes.filter((n) => n.external_id !== undefined).length, fn_total: fnTotal, fn_issued: fnIssued }
}

/** 판정만 필요한 호출자를 위한 재수출 (allow 는 규칙이 없을 때의 기본값). */
export { allow }
