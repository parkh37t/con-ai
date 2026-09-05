import { describe, expect, it } from 'vitest'
import { approveArtifact, canMarkReviewReady, evaluateApprovalGate, findReviewBlockers } from './approval-gate.js'
import { DomainRuleError } from './result.js'
import { BASELINE, T1, artifact, hash, uuid, validationResult } from './test-fixtures.js'

const HASH = hash('artifact-1')
const reviewReady = artifact(1, { status: 'review_ready' })
const allPass = [
  validationResult('v1.schema', { stage: 'V1' }),
  validationResult('v2.shell', { stage: 'V2' }),
  validationResult('v3.case.empty', { stage: 'V3' }),
  validationResult('v6.human', { stage: 'V6' }),
]
const base = { artifact: reviewReady, target_hash: HASH, revision: { expected: 3, current: 3 }, validation_results: allPass }
const codes = (r: { reasons: { code: string }[] }) => r.reasons.map((x) => x.code)

describe('승인 게이트 (설계 §10, §11, §13; 개발프롬프트)', () => {
  it('필수 검사 전부 pass + 사람 검토(V6) 완료 + hash·revision 일치이면 승인할 수 있다', () => {
    const r = evaluateApprovalGate(base)
    expect(r.allowed).toBe(true)
    expect(r.reasons).toEqual([])
    expect(r.blockers).toEqual([])
  })

  it('필수 검사에 not_run 이나 error 가 있으면 승인할 수 없다 — 도구 미설치·미실행을 통과로 보지 않는다', () => {
    const withNotRun = [...allPass, validationResult('v4.a11y', { stage: 'V4', status: 'not_run' })]
    const r1 = evaluateApprovalGate({ ...base, validation_results: withNotRun })
    expect(r1.allowed).toBe(false)
    expect(codes(r1)).toEqual(['approval.required_check_not_run'])
    expect(r1.blockers.map((b) => b.check_id)).toEqual(['v4.a11y'])

    const withError = [...allPass, validationResult('v3.console', { stage: 'V3', status: 'error', message: '브라우저 미설치' })]
    expect(codes(evaluateApprovalGate({ ...base, validation_results: withError }))).toEqual(['approval.required_check_error'])

    const withFail = [...allPass, validationResult('v5.regression', { stage: 'V5', status: 'fail', message: '잠긴 요소 변경' })]
    expect(codes(evaluateApprovalGate({ ...base, validation_results: withFail }))).toEqual(['approval.required_check_fail'])

    // 선택 검사의 error 는 막지 않는다
    const optionalError = [...allPass, validationResult('v4.optional', { stage: 'V4', status: 'error', required: false, message: '선택 검사 오류' })]
    expect(evaluateApprovalGate({ ...base, validation_results: optionalError }).allowed).toBe(true)
  })

  it('필수 검사 목록에 있는데 결과가 아예 없는 검사는 not_run 으로 취급해 승인을 막는다', () => {
    const r = evaluateApprovalGate({ ...base, required_check_ids: ['v1.schema', 'v3.case.error'] })
    expect(codes(r)).toEqual(['approval.required_check_not_run'])
    expect(r.missing_required_check_ids).toEqual(['v3.case.error'])
  })

  it('검증 결과의 artifact hash 가 승인 대상과 다르면 승인할 수 없다 (hash 가 바뀌면 결과는 무효)', () => {
    const otherHash = hash('artifact-old')
    const staleResults = allPass.map((r) => ({ ...r, artifact_hash: otherHash }))
    const r = evaluateApprovalGate({ ...base, validation_results: staleResults })
    expect(r.allowed).toBe(false)
    expect(codes(r)).toEqual(['approval.validation_hash_mismatch', 'approval.no_validation', 'approval.human_review_incomplete'])
    // 승인 요청 자체가 다른 hash 를 가리켜도 불가
    expect(codes(evaluateApprovalGate({ ...base, target_hash: otherHash }))).toContain('approval.hash_mismatch')
  })

  it('사람 검토(V6)가 없거나 통과하지 않았으면 자동 검사가 모두 pass 여도 승인할 수 없다', () => {
    const noHuman = allPass.filter((r) => r.stage !== 'V6')
    expect(codes(evaluateApprovalGate({ ...base, validation_results: noHuman }))).toEqual(['approval.human_review_incomplete'])
    const humanFailedOptional = [...noHuman, validationResult('v6.human', { stage: 'V6', status: 'fail', required: false, message: 'REQ 의미 불일치' })]
    expect(codes(evaluateApprovalGate({ ...base, validation_results: humanFailedOptional }))).toEqual(['approval.human_review_incomplete', 'approval.human_review_not_passed'])
  })

  it('revision·기준 버전·산출물 상태가 맞지 않으면 승인할 수 없고, 이유는 모두 모아 돌려준다', () => {
    expect(codes(evaluateApprovalGate({ ...base, revision: { expected: 2, current: 3 } }))).toEqual(['approval.revision_conflict'])
    expect(codes(evaluateApprovalGate({ ...base, baseline: { current: BASELINE, artifact: 'EXAMPLE-baseline-0' } }))).toEqual(['approval.baseline_mismatch'])
    expect(codes(evaluateApprovalGate({ ...base, artifact: artifact(1, { status: 'draft' }) }))).toEqual(['approval.status'])
    expect(codes(evaluateApprovalGate({ ...base, artifact: artifact(1, { status: 'stale', stale_reason: '기준 변경' }) }))).toEqual(['approval.status'])
    expect(codes(evaluateApprovalGate({ ...base, artifact: artifact(1, { status: 'approved', approval_id: uuid(1) }) }))).toEqual(['approval.already_approved'])
    const many = evaluateApprovalGate({ ...base, revision: { expected: 1, current: 3 }, validation_results: allPass.filter((r) => r.stage !== 'V6') })
    expect(codes(many)).toEqual(['approval.revision_conflict', 'approval.human_review_incomplete'])
  })

  it('approveArtifact 는 게이트 통과 시 approved 산출물과 정확한 hash 에 연결된 Approval 을 만들고, 실패 시 이유가 붙은 오류를 던진다', () => {
    const details = { id: uuid(1000), baseline_id: BASELINE, validation_run_id: uuid(801), approved_by: 'lead-1', approved_at: T1 }
    const { artifact: approved, approval } = approveArtifact(reviewReady, { target_hash: HASH, revision: { expected: 3, current: 3 }, validation_results: allPass }, details)
    expect(approved.status).toBe('approved')
    expect(approved.approval_id).toBe(approval.id)
    expect(approval.artifact_hash).toBe(reviewReady.content_hash)
    expect(reviewReady.status).toBe('review_ready') // 원본 불변
    expect(() => approveArtifact(reviewReady, { target_hash: HASH, revision: { expected: 3, current: 3 }, validation_results: [] }, details)).toThrow(DomainRuleError)
  })

  it('검토 준비(review_ready)는 V6 를 제외한 필수 검사가 모두 pass 여야 한다', () => {
    const auto = allPass.filter((r) => r.stage !== 'V6')
    expect(findReviewBlockers([...auto, validationResult('v6.human', { stage: 'V6', status: 'not_run' })])).toEqual([])
    const pending = artifact(1, { status: 'validation_pending' })
    expect(canMarkReviewReady(pending, auto).allowed).toBe(true)
    expect(codes(canMarkReviewReady(pending, [...auto, validationResult('v3.x', { stage: 'V3', status: 'error', message: '오류' })]))).toEqual(['review_ready.required_check_error'])
    expect(codes(canMarkReviewReady(pending, auto, ['v3.case.error']))).toEqual(['review_ready.required_check_not_run'])
    expect(codes(canMarkReviewReady(artifact(1, { status: 'draft' }), auto))).toEqual(['review_ready.status'])
  })
})
