/**
 * 상태 전이 — 작업(GenerationJob)과 산출물(Artifact). 검증 결과(ValidationStatus)는 생명주기가 아니라 결과 값이므로 전이가 없다.
 *
 * 출처:
 * - 설계 §11: "작업 상태: queued → running → succeeded / failed / cancelled. 작업 성공과 산출물 승인 상태는 독립이다.
 *             산출물은 draft → validation_pending → review_ready → approved, 변경 발생 시 새 draft 또는 stale 로 관리한다."
 * - 설계 §6: 승인본도 수정 시 새 버전을 만든다 (approved 를 제자리에서 draft 로 되돌리지 않는다).
 * - 설계 §10, 보고서 §4: 세 상태 체계(작업/산출물/검증)를 합치지 않는다 — 다른 체계의 값은 실행 시점에도 거부한다.
 *
 * 여기서는 전이의 "모양" 만 검사한다. `approved` 로 가려면 approval-gate 의 판정을, `stale` 로 가려면 stale 의 사유를 함께 써야 한다
 * (`approveArtifact`, `markStale` 참고). 이 파일은 그 판정을 대신하지 않는다.
 */
import { ArtifactStatus, JobStatus } from '@con-ai/schemas'
import { allow, assertAllowed, deny, type RuleDecision } from './result.js'

/** 작업 전이표 (설계 §11). queued 에서 취소 요청은 실행 전에도 받을 수 있다. */
export const JOB_TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  queued: ['running', 'cancelled'],
  running: ['succeeded', 'failed', 'cancelled'],
  succeeded: [],
  failed: [],
  cancelled: [],
}

/**
 * 산출물 전이표 (설계 §11).
 * - validation_pending → draft: 필수 검사 fail/error/not_run 이면 검토 후보가 아니므로 초안으로 돌아간다. 내용 수정은 새 산출물(새 hash)이다.
 * - review_ready → validation_pending: 검사 도구 버전 변경 등으로 재검증할 때.
 * - approved → stale 만 허용: 승인본은 제자리에서 고치지 않는다 (설계 §6). 변경은 새 draft 산출물로 만든다.
 * - stale 은 종료 상태: 사람이 영향 범위를 확인한 뒤 재생성한다 (설계 §11).
 */
export const ARTIFACT_TRANSITIONS: Readonly<Record<ArtifactStatus, readonly ArtifactStatus[]>> = {
  draft: ['validation_pending', 'stale'],
  validation_pending: ['review_ready', 'draft', 'stale'],
  review_ready: ['approved', 'validation_pending', 'stale'],
  approved: ['stale'],
  stale: [],
}

/** 전이 불가 이유 설명 (설계 §11 문장을 그대로 코드에 남긴다). */
const ARTIFACT_TRANSITION_NOTES: Readonly<Partial<Record<`${ArtifactStatus}->${ArtifactStatus}`, string>>> = {
  'approved->draft': '승인본은 제자리에서 수정하지 않는다 — 변경은 새 draft 산출물로 만들고 기존 승인본은 stale 로 표시한다 (설계 §6, §11)',
  'approved->review_ready': '승인본을 검토 대기로 되돌리지 않는다 — 재검토가 필요하면 stale 로 표시하고 새 산출물을 만든다 (설계 §11)',
  'approved->validation_pending': '승인본을 재검증 대기로 되돌리지 않는다 — 새 산출물에서 검증한다 (설계 §11)',
  'draft->approved': 'draft 는 검증(validation_pending)과 검토(review_ready)를 거쳐야 승인할 수 있다 (설계 §10, §11)',
  'draft->review_ready': '검증 없이 검토 대기로 갈 수 없다 — 필수 검사가 먼저 실행돼야 한다 (설계 §10)',
  'validation_pending->approved': '검토 준비(review_ready)를 건너뛰고 승인할 수 없다 — 사람 검토(V6)가 필요하다 (설계 §10)',
  'stale->approved': 'stale 산출물은 승인할 수 없다 — 변경 영향을 확인하고 재생성한다 (설계 §11)',
}

const JOB_TRANSITION_NOTES: Readonly<Partial<Record<`${JobStatus}->${JobStatus}`, string>>> = {
  'queued->succeeded': '실행(running)하지 않은 작업을 성공으로 표시할 수 없다 (설계 §11; 보고서 §2 타이머 기반 성공 표시 금지)',
  'queued->failed': '실행하지 않은 작업은 실패가 아니라 취소(cancelled)다 (설계 §11)',
}

function describeStatus(kind: '작업' | '산출물', value: unknown): string {
  return `'${String(value)}' 은(는) ${kind} 상태가 아니다 — 작업/산출물/검증 상태 체계는 서로 합치지 않는다 (설계 §11; 보고서 §4)`
}

/** 작업 전이 판정. 다른 체계의 값(approved, pass 등)은 거부한다. */
export function canTransitionJob(from: JobStatus, to: JobStatus): RuleDecision {
  if (!JobStatus.safeParse(from).success) return deny([{ code: 'job.status_foreign', message: describeStatus('작업', from) }])
  if (!JobStatus.safeParse(to).success) return deny([{ code: 'job.status_foreign', message: describeStatus('작업', to) }])
  if (from === to) return deny([{ code: 'job.same_status', message: `작업은 이미 ${from} 상태다` }])
  if (JOB_TRANSITIONS[from].includes(to)) return allow()
  if (isTerminalJobStatus(from)) {
    return deny([{ code: 'job.terminal', message: `${from} 는 종료 상태라 ${to} 로 바꿀 수 없다 — 다시 실행하려면 새 작업을 만든다 (설계 §11)` }])
  }
  const note = JOB_TRANSITION_NOTES[`${from}->${to}`]
  return deny([{ code: 'job.transition_not_allowed', message: note ?? `작업 상태 ${from} → ${to} 전이는 허용되지 않는다 (설계 §11)` }])
}

/** 작업 전이 적용. 거부면 DomainRuleError. */
export function transitionJob(from: JobStatus, to: JobStatus): JobStatus {
  assertAllowed(canTransitionJob(from, to), `작업 상태를 ${String(from)} 에서 ${String(to)} 로 바꿀 수 없다`)
  return to
}

/** 산출물 전이 판정 (모양만). */
export function canTransitionArtifact(from: ArtifactStatus, to: ArtifactStatus): RuleDecision {
  if (!ArtifactStatus.safeParse(from).success) return deny([{ code: 'artifact.status_foreign', message: describeStatus('산출물', from) }])
  if (!ArtifactStatus.safeParse(to).success) return deny([{ code: 'artifact.status_foreign', message: describeStatus('산출물', to) }])
  if (from === to) return deny([{ code: 'artifact.same_status', message: `산출물은 이미 ${from} 상태다` }])
  if (ARTIFACT_TRANSITIONS[from].includes(to)) return allow()
  if (isTerminalArtifactStatus(from)) {
    return deny([{ code: 'artifact.terminal', message: `${from} 는 종료 상태라 ${to} 로 바꿀 수 없다 — 변경은 새 draft 산출물로 만든다 (설계 §11)` }])
  }
  const note = ARTIFACT_TRANSITION_NOTES[`${from}->${to}`]
  return deny([{ code: 'artifact.transition_not_allowed', message: note ?? `산출물 상태 ${from} → ${to} 전이는 허용되지 않는다 (설계 §11)` }])
}

/** 산출물 전이 적용. 거부면 DomainRuleError. */
export function transitionArtifact(from: ArtifactStatus, to: ArtifactStatus): ArtifactStatus {
  assertAllowed(canTransitionArtifact(from, to), `산출물 상태를 ${String(from)} 에서 ${String(to)} 로 바꿀 수 없다`)
  return to
}

export function isTerminalJobStatus(status: JobStatus): boolean {
  return JOB_TRANSITIONS[status].length === 0
}

export function isTerminalArtifactStatus(status: ArtifactStatus): boolean {
  return ARTIFACT_TRANSITIONS[status].length === 0
}
