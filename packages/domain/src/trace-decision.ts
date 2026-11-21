/**
 * 매핑 판정 — 후보(candidate) TraceLink 를 approved / conflict / excluded / non_ui 로 결정하는 조건.
 *
 * 출처:
 * - 설계 §7 표: 매핑 후보 = HTML 토큰·IA·유사도 기반 추출, 아직 미승인; 승인 매핑 = 동일 기준 버전에서 담당자가 의미·범위를 확인;
 *              제외·비UI = 사유와 별도 책임·검증 연결이 있어야 함.
 * - 설계 §7 본문: "REQ ID 가 HTML 에 등장한다는 이유만으로 충족 처리하지 않는다";
 *              REQ-SFR-066-001 사례 — 화면 설명과 원장의 의미가 다르면 `conflict` 로 표시하고 올바른 ID 를 임의 생성·대체하지 않는다.
 * - 설계 §2: 승인자·대상 버전·승인 시점을 남긴다. 설계 §13: PATCH /trace-links/:id 는 revision 필수.
 * - 개발프롬프트 4항: "토큰이 발견됐다는 이유로 승인 처리하지 않습니다." 보고서 §7: 문자열 기반 후보를 의미 확인 없이 승인하지 않는다.
 *
 * "HTML 토큰만" 의 판정: 근거 anchor 를 SourceAnchor 본체로 풀었을 때 원문(시트·CSV·MD) 위치가 하나도 없고 HTML 위치뿐이면 승인 불가.
 * HTML 근거는 원문 근거에 덧붙일 수는 있다.
 */
import { IsoDateTime, TraceLink, type AnchorRef, type InternalId, type NonUIScreenWork, type ScreenRevision, type SourceAnchor } from '@con-ai/schemas'
import { assertAllowed, decide, type RuleDecision, type RuleReason } from './result.js'

/** 결정 공통 필드 — 담당자·시점·본 revision (설계 §2, §13). */
export interface TraceDecisionMeta {
  decided_by: string
  decided_at: string
  /** 결정자가 본 TraceLink revision. 현재 revision 과 다르면 오래된 화면에서 누른 결정이다 (설계 §11, §13). */
  revision: number
  reason?: string | undefined
}

/** 정본 확정 결정 — conflict 후보를 승인하려면 필요하다 (설계 §7 REQ-SFR-066-001; 설계 §15 "충돌하는 REQ 의 정본"). */
export interface ConflictResolution {
  decided_by: string
  decided_at: string
  /** 어느 원문을 정본으로 봤는지 — 반드시 `anchors` 에 있는 원문 anchor 여야 한다. */
  canonical_anchor_id: InternalId
  reason: string
}

/** 승인 입력. */
export interface TraceApprovalInput {
  link: TraceLink
  /** 프로젝트의 현재 기준 버전. 후보의 baseline 과 같아야 한다 (설계 §7 동일 기준 버전). */
  current_baseline_id: string
  decision: TraceDecisionMeta & {
    screen_revision_id: InternalId
    element_or_action_id: string
    evidence: readonly AnchorRef[]
  }
  /** 근거 anchor 본체. 근거 종류(원문/HTML) 판정과 존재 확인에 쓴다. */
  anchors: readonly SourceAnchor[]
  /** 대상 화면 revision (선택). 있으면 ID·기준 버전 일치를 확인한다. */
  screen_revision?: Pick<ScreenRevision, 'id' | 'baseline_id'> | undefined
  /** conflict 후보에 대한 정본 확정 결정 (선택). 없으면 conflict 는 승인할 수 없다. */
  conflict_resolution?: ConflictResolution | undefined
}

function metaReasons(meta: TraceDecisionMeta, link: TraceLink): RuleReason[] {
  const reasons: RuleReason[] = []
  if (meta.decided_by.trim() === '') reasons.push({ code: 'trace.decided_by_required', message: '결정에는 담당자가 필요하다 (설계 §2, §7)' })
  if (!IsoDateTime.safeParse(meta.decided_at).success) reasons.push({ code: 'trace.decided_at_required', message: '결정 시점은 ISO 8601 시각이어야 한다 (설계 §2)' })
  if (meta.revision !== link.revision) {
    reasons.push({ code: 'trace.revision_conflict', message: `revision 불일치: 결정자가 본 ${meta.revision}, 현재 ${link.revision} — 오래된 저장을 차단한다 (설계 §11, §13)` })
  }
  return reasons
}

/** 원문(시트·CSV·MD) 위치 anchor 인지. HTML 위치는 토큰 출현 근거라 승인의 단독 근거가 될 수 없다. */
export function isSourceTextAnchor(anchor: SourceAnchor): boolean {
  return anchor.locator.kind !== 'html'
}

/** 승인 가능 판정 (설계 §7). 이유는 모두 모아 돌려준다. */
export function canApproveTraceLink(input: TraceApprovalInput): RuleDecision {
  const { link, decision } = input
  const reasons: RuleReason[] = metaReasons(decision, link)

  if (link.status === 'approved') {
    reasons.push({ code: 'trace.already_approved', message: '이미 승인된 매핑이다 — 변경은 새 결정으로 기록한다' })
  }
  if (link.status === 'conflict') {
    if (input.conflict_resolution === undefined) {
      reasons.push({
        code: 'trace.conflict_unresolved',
        message: `conflict 매핑은 정본 확정 결정 없이 approved 로 바꿀 수 없다 — 어느 원문이 최신 승인본인지 사람이 정한다 (설계 §7 REQ-SFR-066-001 사례, §15)${link.reason ? ` [충돌 사유: ${link.reason}]` : ''}`,
      })
    } else {
      reasons.push(...conflictResolutionReasons(input.conflict_resolution, input.anchors))
    }
  }
  if (link.baseline_id !== input.current_baseline_id) {
    reasons.push({
      code: 'trace.baseline_mismatch',
      message: `후보의 기준 버전(${link.baseline_id})이 현재 기준 버전(${input.current_baseline_id})과 다르다 — 승인은 동일 기준 버전에서 확인한다; 현재 기준으로 후보를 다시 만든다 (설계 §7)`,
    })
  }
  const sr = input.screen_revision
  if (sr !== undefined) {
    if (sr.id !== decision.screen_revision_id) {
      reasons.push({ code: 'trace.screen_revision_mismatch', message: `결정의 화면 버전(${decision.screen_revision_id})이 전달된 화면 revision(${sr.id})과 다르다` })
    }
    if (sr.baseline_id !== undefined && sr.baseline_id !== input.current_baseline_id) {
      reasons.push({ code: 'trace.screen_baseline_mismatch', message: `화면 revision 이 고정한 기준 버전(${sr.baseline_id})이 현재 기준 버전(${input.current_baseline_id})과 다르다 (설계 §6, §7)` })
    }
  }
  if (decision.element_or_action_id.trim() === '') {
    reasons.push({ code: 'trace.element_required', message: '승인 매핑에는 요소/동작 연결이 필요하다 (설계 §7 요소/동작 연결)' })
  }
  reasons.push(...evidenceReasons(decision.evidence, input.anchors))
  return decide(reasons)
}

function evidenceReasons(evidence: readonly AnchorRef[], anchors: readonly SourceAnchor[]): RuleReason[] {
  const reasons: RuleReason[] = []
  if (evidence.length === 0) {
    reasons.push({ code: 'trace.evidence_required', message: '승인 매핑에는 근거 anchor 가 필요하다 (설계 §7 근거 확인)' })
    return reasons
  }
  const byId = new Map(anchors.map((a) => [a.id, a] as const))
  const resolved: SourceAnchor[] = []
  for (const ref of evidence) {
    const anchor = byId.get(ref.anchor_id)
    if (anchor === undefined) reasons.push({ code: 'trace.evidence_unknown_anchor', message: `근거 anchor ${ref.anchor_id} 를 찾을 수 없다 — 근거는 저장된 SourceAnchor 여야 한다 (설계 §6)` })
    else resolved.push(anchor)
  }
  if (resolved.length > 0 && !resolved.some(isSourceTextAnchor)) {
    reasons.push({
      code: 'trace.token_only',
      message: 'HTML 토큰 출현(HTML 위치 anchor)만으로는 승인할 수 없다 — 원문(시트·CSV·MD) 근거로 의미·범위를 확인해야 한다 (설계 §7; 개발프롬프트 4항; 보고서 §7)',
    })
  }
  return reasons
}

function conflictResolutionReasons(resolution: ConflictResolution, anchors: readonly SourceAnchor[]): RuleReason[] {
  const reasons: RuleReason[] = []
  if (resolution.decided_by.trim() === '') reasons.push({ code: 'trace.conflict_resolution.decided_by_required', message: '정본 확정 결정에는 결정자가 필요하다 (설계 §2, §15)' })
  if (!IsoDateTime.safeParse(resolution.decided_at).success) reasons.push({ code: 'trace.conflict_resolution.decided_at_required', message: '정본 확정 결정 시점은 ISO 8601 시각이어야 한다' })
  if (resolution.reason.trim() === '') reasons.push({ code: 'trace.conflict_resolution.reason_required', message: '정본 확정 결정에는 사유가 필요하다 (설계 §7: 날짜만 보고 자동 채택하지 않음)' })
  const canonical = anchors.find((a) => a.id === resolution.canonical_anchor_id)
  if (canonical === undefined) reasons.push({ code: 'trace.conflict_resolution.anchor_unknown', message: `정본 anchor ${resolution.canonical_anchor_id} 를 찾을 수 없다` })
  else if (!isSourceTextAnchor(canonical)) reasons.push({ code: 'trace.conflict_resolution.anchor_not_source', message: '정본은 HTML 설명이 아니라 원문 위치여야 한다 — 화면 설명의 REQ 표기를 정본으로 삼지 않는다 (설계 §7; 보고서 §4)' })
  return reasons
}

/** 승인 적용 — approved TraceLink(새 revision)를 돌려준다. schemas 의 TraceLink 로 재검사한다. 거부면 DomainRuleError. */
export function approveTraceLink(input: TraceApprovalInput): TraceLink {
  assertAllowed(canApproveTraceLink(input), `매핑 ${input.link.id} 을(를) 승인할 수 없다`)
  const { link, decision } = input
  const resolutionNote = input.conflict_resolution ? `정본 확정: ${input.conflict_resolution.reason} (${input.conflict_resolution.decided_by}, anchor ${input.conflict_resolution.canonical_anchor_id})` : undefined
  const reason = [decision.reason, resolutionNote].filter((s): s is string => s !== undefined && s !== '').join(' / ')
  return TraceLink.parse({
    ...link,
    revision: link.revision + 1,
    status: 'approved',
    screen_revision_id: decision.screen_revision_id,
    element_or_action_id: decision.element_or_action_id,
    evidence: [...decision.evidence],
    decided_by: decision.decided_by,
    decided_at: decision.decided_at,
    ...(reason !== '' ? { reason } : {}),
  })
}

/** 제외·비UI 결정 입력 (설계 §7 "사유와 별도 책임·검증 연결"). */
export interface TraceExclusionInput {
  link: TraceLink
  current_baseline_id: string
  decision: TraceDecisionMeta & { status: 'excluded' | 'non_ui' }
  /** status=non_ui 이면 필수 — 이 수용조건을 연결한 비UI 작업(담당·검증 근거 포함). */
  non_ui_work?: NonUIScreenWork | undefined
}

/** 제외·비UI 판정. */
export function canExcludeTraceLink(input: TraceExclusionInput): RuleDecision {
  const { link, decision } = input
  const reasons: RuleReason[] = metaReasons(decision, link)
  if (link.baseline_id !== input.current_baseline_id) {
    reasons.push({ code: 'trace.baseline_mismatch', message: `후보의 기준 버전(${link.baseline_id})이 현재 기준 버전(${input.current_baseline_id})과 다르다 (설계 §7)` })
  }
  if (decision.reason === undefined || decision.reason.trim() === '') {
    reasons.push({ code: 'trace.reason_required', message: `${decision.status} 결정에는 사유가 필요하다 (설계 §7 제외·비UI)` })
  }
  if (decision.status === 'non_ui') {
    const work = input.non_ui_work
    if (work === undefined) {
      reasons.push({ code: 'trace.non_ui_work_required', message: '비UI 결정에는 별도 책임·검증(NonUIScreenWork) 연결이 필요하다 (설계 §7)' })
    } else if (!work.criterion_ids.includes(link.criterion_id)) {
      reasons.push({ code: 'trace.non_ui_work_criterion_mismatch', message: `비UI 작업 ${work.id} 은(는) 이 수용조건(${link.criterion_id})을 연결하지 않았다 — 배치·연계 책임은 수용조건 단위로 연결한다 (설계 §6, §7)` })
    }
  }
  return decide(reasons)
}

/** 제외·비UI 적용. */
export function excludeTraceLink(input: TraceExclusionInput): TraceLink {
  assertAllowed(canExcludeTraceLink(input), `매핑 ${input.link.id} 을(를) ${input.decision.status} 로 결정할 수 없다`)
  const { link, decision } = input
  return TraceLink.parse({
    ...link,
    revision: link.revision + 1,
    status: decision.status,
    decided_by: decision.decided_by,
    decided_at: decision.decided_at,
    reason: decision.reason,
    ...(decision.status === 'non_ui' && input.non_ui_work !== undefined ? { non_ui_work_id: input.non_ui_work.id } : {}),
  })
}

/** 충돌 표시 입력. 어떤 상태에서든 충돌을 발견하면 표시할 수 있다 (승인 후 발견 포함). ID 를 임의 생성·대체하지 않는다 (설계 §7). */
export interface TraceConflictInput {
  link: TraceLink
  decision: TraceDecisionMeta & { reason: string }
}

export function canMarkTraceConflict(input: TraceConflictInput): RuleDecision {
  const reasons = metaReasons(input.decision, input.link)
  if (input.decision.reason.trim() === '') reasons.push({ code: 'trace.reason_required', message: 'conflict 표시에는 어떤 원문이 어떻게 다른지 사유가 필요하다 (설계 §7; 보고서 §4)' })
  return decide(reasons)
}

export function markTraceConflict(input: TraceConflictInput): TraceLink {
  assertAllowed(canMarkTraceConflict(input), `매핑 ${input.link.id} 을(를) conflict 로 표시할 수 없다`)
  const { link, decision } = input
  return TraceLink.parse({
    ...link,
    revision: link.revision + 1,
    status: 'conflict',
    decided_by: decision.decided_by,
    decided_at: decision.decided_at,
    reason: decision.reason,
  })
}
