/**
 * 승인 게이트 — 산출물을 승인할 수 있는지 판정하고 이유 목록을 돌려준다.
 *
 * 출처:
 * - 설계 §10: 각 검사는 pass/fail/error/not_run; "필수 검사가 error 또는 not_run 이면 승인 후보가 될 수 없다";
 *            "자동 검사 통과는 사람의 업무 의미 검토(V6)를 대체하지 않는다"; V7 내보내기 차단 조건 "승인 대상 불일치".
 * - 설계 §6: ValidationRun/Result 는 artifact hash 에 고정; Approval 은 승인 대상 hash 를 기록.
 * - 설계 §11: revision 기반 충돌 검사로 오래된 저장을 차단; 산출물 review_ready → approved.
 * - 설계 §13: POST /artifacts/:id/approvals — "필수 검사·권한·버전 확인 후 승인".
 * - 개발프롬프트: "필수 검증이 실패·오류·미실행이면 승인할 수 없습니다. 승인은 정확한 artifact hash 에 연결합니다."
 *
 * 필수 검사 판정은 schemas 의 `findApprovalBlockers` 를 재사용한다. 권한(누가 승인할 수 있는가)은 API 계층의 몫이라 여기서 다루지 않는다.
 */
import { Approval, Artifact, findApprovalBlockers, type ValidationResult } from '@con-ai/schemas'
import { assertAllowed, decide, type RuleDecision, type RuleReason } from './result.js'
import { canTransitionArtifact } from './state-machines.js'

/** 승인 게이트 입력. */
export interface ApprovalGateInput {
  artifact: Pick<Artifact, 'id' | 'content_hash' | 'status'>
  /** 승인 요청이 가리키는 hash. `artifact.content_hash` 와 같아야 한다 (개발프롬프트: 정확한 artifact hash 에 연결). */
  target_hash: string
  /** 승인자가 본 revision 과 저장소의 현재 revision. 다르면 오래된 화면에서 누른 승인이다 (설계 §11). */
  revision: { expected: number; current: number }
  /** 이 산출물에 대해 기록된 검증 결과. 다른 hash 의 결과는 무시한다 (hash 가 바뀌면 결과는 무효; 설계 §6). */
  validation_results: readonly ValidationResult[]
  /** 프로젝트 프로파일이 정한 필수 검사 ID. 결과가 없는 항목은 not_run 으로 본다 (설계 §10: 실행하지 않은 검사는 통과가 아님). */
  required_check_ids?: readonly string[] | undefined
  /** 기준 버전 일치 확인 (선택): 승인 시점의 현재 baseline 과 산출물이 고정한 baseline. */
  baseline?: { current: string; artifact: string | undefined } | undefined
}

/** 승인 게이트 결과 — 판정 + 차단한 검증 결과. */
export interface ApprovalGateResult extends RuleDecision {
  /** 승인 대상 hash 에 대한 결과 중 필수인데 pass 가 아닌 것 (schemas.findApprovalBlockers). */
  blockers: ValidationResult[]
  /** 필수 검사 ID 중 결과가 아예 없는 것 (not_run 으로 취급). */
  missing_required_check_ids: string[]
}

/** 사람 검토 단계. 자동 검사 통과와 별개로 반드시 pass 결과가 있어야 한다 (설계 §10 V6). */
export const HUMAN_REVIEW_STAGE = 'V6'

/**
 * 승인 가능 판정. 허용이면 reasons 가 비어 있다. 거부 이유는 모두 모아서 돌려준다 (하나만 고치고 다시 막히지 않도록).
 */
export function evaluateApprovalGate(input: ApprovalGateInput): ApprovalGateResult {
  const reasons: RuleReason[] = []
  const { artifact } = input

  // 1. 산출물 상태: review_ready 에서만 approved 로 갈 수 있다 (설계 §11).
  if (artifact.status === 'approved') {
    reasons.push({ code: 'approval.already_approved', message: '이미 승인된 산출물이다 — 변경은 새 산출물로 만든다 (설계 §6)' })
  } else {
    const transition = canTransitionArtifact(artifact.status, 'approved')
    if (!transition.allowed) reasons.push(...transition.reasons.map((r) => ({ code: 'approval.status', message: r.message })))
  }

  // 2. 승인 대상 hash 일치 (개발프롬프트; 설계 §10 V7 "승인 대상 불일치").
  if (input.target_hash !== artifact.content_hash) {
    reasons.push({
      code: 'approval.hash_mismatch',
      message: `승인 요청 hash(${short(input.target_hash)})가 산출물 hash(${short(artifact.content_hash)})와 다르다 — 승인은 정확한 artifact hash 에 연결한다 (설계 §6, §10 V7; 개발프롬프트)`,
    })
  }

  // 3. revision 일치 (설계 §11 오래된 저장 차단).
  if (input.revision.expected !== input.revision.current) {
    reasons.push({
      code: 'approval.revision_conflict',
      message: `revision 불일치: 승인자가 본 ${input.revision.expected}, 현재 ${input.revision.current} — 최신 상태를 다시 읽은 뒤 승인한다 (설계 §11)`,
    })
  }

  // 4. 기준 버전 일치 (선택).
  if (input.baseline !== undefined && input.baseline.artifact !== input.baseline.current) {
    reasons.push({
      code: 'approval.baseline_mismatch',
      message: `산출물이 고정한 기준 버전(${input.baseline.artifact ?? '없음'})이 현재 기준 버전(${input.baseline.current})과 다르다 — 검토 필요 (설계 §6)`,
    })
  }

  // 5. 검증 결과는 승인 대상 hash 의 것만 유효하다 (설계 §6 "hash 가 바뀌면 결과는 무효").
  const relevant = input.validation_results.filter((r) => r.artifact_hash === artifact.content_hash)
  const foreign = input.validation_results.length - relevant.length
  if (foreign > 0) {
    reasons.push({
      code: 'approval.validation_hash_mismatch',
      message: `검증 결과 ${foreign}건이 다른 artifact hash 에 대한 것이라 무시했다 — 승인 대상 hash 에서 검증을 다시 실행한다 (설계 §6, §10)`,
    })
  }
  if (relevant.length === 0) {
    reasons.push({ code: 'approval.no_validation', message: '승인 대상 hash 에 대한 검증 결과가 없다 — 실행하지 않은 검사는 통과가 아니다 (설계 §10)' })
  }

  // 6. 필수 검사: fail/error/not_run 이면 불가 (schemas.findApprovalBlockers 재사용).
  const blockers = findApprovalBlockers(relevant)
  for (const b of blockers) {
    reasons.push({
      code: `approval.required_check_${b.status}`,
      message: `필수 검사 ${b.check_id}(${b.stage}) 결과가 ${b.status} 다${b.message ? `: ${b.message}` : ''} — 필수 검사가 fail/error/not_run 이면 승인 불가 (설계 §10)`,
    })
  }

  // 7. 필수 검사 목록 중 결과가 없는 것은 not_run 으로 취급한다.
  const seen = new Set(relevant.map((r) => r.check_id))
  const missing = (input.required_check_ids ?? []).filter((id) => !seen.has(id))
  for (const id of missing) {
    reasons.push({ code: 'approval.required_check_not_run', message: `필수 검사 ${id} 의 결과가 없다(not_run) — 실행하지 않은 검사를 통과로 표시하지 않는다 (설계 §10; 개발프롬프트 5항)` })
  }

  // 8. 사람 검토(V6) 완료 — 자동 검사 통과가 대체하지 않는다 (설계 §10).
  const human = relevant.filter((r) => r.stage === HUMAN_REVIEW_STAGE)
  if (!human.some((r) => r.status === 'pass')) {
    reasons.push({ code: 'approval.human_review_incomplete', message: '사람 검토(V6)가 완료되지 않았다 — 자동 검사 통과는 업무 의미 검토를 대체하지 않는다 (설계 §10)' })
  }
  for (const r of human) {
    if (r.status !== 'pass' && !r.required) {
      reasons.push({ code: 'approval.human_review_not_passed', message: `사람 검토 ${r.check_id} 결과가 ${r.status} 다 — 필수 표시와 무관하게 사람 검토 실패는 승인을 막는다 (설계 §10)` })
    }
  }

  const decision = decide(reasons)
  return { ...decision, blockers, missing_required_check_ids: missing }
}

/** 승인 기록에 필요한 값 (Approval 스키마의 나머지 필드). */
export interface ApprovalDetails {
  id: string
  baseline_id: string
  validation_run_id: string
  approved_by: string
  approved_at: string
  note?: string | undefined
}

/**
 * 승인 적용 — 게이트를 통과하면 `approved` 산출물과 Approval 기록을 돌려준다. 둘 다 schemas 로 검사한다.
 * 거부면 DomainRuleError (이유 목록 포함). 원본 객체는 바꾸지 않는다.
 */
export function approveArtifact(
  artifact: Artifact,
  gate: Omit<ApprovalGateInput, 'artifact'>,
  details: ApprovalDetails,
): { artifact: Artifact; approval: Approval } {
  const result = evaluateApprovalGate({ ...gate, artifact })
  assertAllowed(result, `산출물 ${artifact.id} 을(를) 승인할 수 없다`)
  const approval = Approval.parse({
    id: details.id,
    artifact_id: artifact.id,
    artifact_hash: artifact.content_hash,
    baseline_id: details.baseline_id,
    validation_run_id: details.validation_run_id,
    approved_by: details.approved_by,
    approved_at: details.approved_at,
    ...(details.note !== undefined ? { note: details.note } : {}),
  })
  const approved = Artifact.parse({ ...artifact, status: 'approved', approval_id: approval.id })
  return { artifact: approved, approval }
}

/** 검토 준비 차단 항목 — 사람 검토(V6)를 제외한 필수 검사 중 pass 가 아닌 것. V6 는 review_ready 이후에 이뤄지므로 여기서는 요구하지 않는다. */
export function findReviewBlockers(results: readonly ValidationResult[]): ValidationResult[] {
  return findApprovalBlockers(results).filter((r) => r.stage !== HUMAN_REVIEW_STAGE)
}

/** validation_pending → review_ready 판정: 승인 대상 hash 의 자동 필수 검사가 모두 pass 여야 한다 (설계 §10, §11). */
export function canMarkReviewReady(artifact: Pick<Artifact, 'content_hash' | 'status'>, results: readonly ValidationResult[], requiredCheckIds: readonly string[] = []): RuleDecision {
  const reasons: RuleReason[] = []
  const transition = canTransitionArtifact(artifact.status, 'review_ready')
  if (!transition.allowed) reasons.push(...transition.reasons.map((r) => ({ code: 'review_ready.status', message: r.message })))
  const relevant = results.filter((r) => r.artifact_hash === artifact.content_hash)
  if (relevant.length === 0) reasons.push({ code: 'review_ready.no_validation', message: '이 hash 에 대한 검증 결과가 없다 (설계 §10)' })
  for (const b of findReviewBlockers(relevant)) {
    reasons.push({ code: `review_ready.required_check_${b.status}`, message: `필수 검사 ${b.check_id}(${b.stage}) 결과가 ${b.status} 다 (설계 §10)` })
  }
  const seen = new Set(relevant.map((r) => r.check_id))
  for (const id of requiredCheckIds) {
    if (!seen.has(id)) reasons.push({ code: 'review_ready.required_check_not_run', message: `필수 검사 ${id} 의 결과가 없다(not_run) (설계 §10)` })
  }
  return decide(reasons)
}

function short(hash: string): string {
  return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash
}
