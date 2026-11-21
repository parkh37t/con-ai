import { describe, expect, it } from 'vitest'
import { AcceptanceTest, VALIDATION_STAGE_LABELS, ValidationResult, ValidationStage, ValidationStatus, findApprovalBlockers } from './validation.js'
import { issuePaths } from './test-utils.js'

const UUID = '11111111-1111-4111-8111-111111111111'
const HASH = 'c'.repeat(64)
const result = (over: Partial<Record<string, unknown>>) =>
  ValidationResult.parse({ id: UUID, validation_run_id: UUID, artifact_hash: HASH, check_id: 'v1.schema', stage: 'V1', status: 'pass', required: true, checker_version: '0.1.0', ...over })

describe('검증 결과 (설계 §10)', () => {
  it('ValidationStatus 는 pass/fail/error/not_run 네 값만 허용한다', () => {
    expect(ValidationStatus.options).toEqual(['pass', 'fail', 'error', 'not_run'])
    for (const bad of ['skipped', 'success', 'ok', 'passed', 'warning']) expect(ValidationStatus.safeParse(bad).success).toBe(false)
  })

  it('단계는 V0~V7 이고 이름표가 있다', () => {
    expect(ValidationStage.options).toHaveLength(8)
    expect(ValidationStage.safeParse('V8').success).toBe(false)
    expect(VALIDATION_STAGE_LABELS.V3).toBe('실행')
  })

  it('fail/error 결과는 원인을 남겨야 한다 (실행 오류를 성공으로 표시하지 않음)', () => {
    expect(issuePaths(ValidationResult.safeParse({ id: UUID, validation_run_id: UUID, artifact_hash: HASH, check_id: 'v3.console', stage: 'V3', status: 'error', required: true, checker_version: '0.1.0' }))).toEqual(['message'])
    expect(() => result({ status: 'error', message: '브라우저 미설치' })).not.toThrow()
  })

  it('필수 검사가 fail/error/not_run 이면 승인 후보가 될 수 없고, 선택 검사는 막지 않는다', () => {
    const results = [
      result({ check_id: 'a', status: 'pass' }),
      result({ check_id: 'b', status: 'not_run' }),
      result({ check_id: 'c', status: 'error', message: '도구 오류' }),
      result({ check_id: 'd', status: 'fail', message: 'CASE 실패' }),
      result({ check_id: 'e', status: 'error', required: false, message: '선택 검사 오류' }),
    ]
    expect(findApprovalBlockers(results).map((r) => r.check_id)).toEqual(['b', 'c', 'd'])
    expect(findApprovalBlockers([result({ status: 'pass' })])).toEqual([])
  })

  it('수용 테스트는 ①수용조건 ②초기 상태·역할 ③사용자 동작 ④기대 결과 ⑤artifact hash 를 모두 요구한다', () => {
    const ok = AcceptanceTest.safeParse({
      id: UUID, criterion_id: UUID, initial: { state_id: 'normal', role: 'buyer' },
      user_actions: [{ action_id: 'search-submit', description: '검색어 입력 후 검색' }], expected_result: '일치하는 1건 표시', artifact_hash: HASH,
    })
    expect(ok.success).toBe(true)
    const bad = AcceptanceTest.safeParse({ id: UUID, criterion_id: UUID, initial: { state_id: 'normal', role: 'buyer' }, user_actions: [], expected_result: 'x' })
    expect(issuePaths(bad)).toEqual(expect.arrayContaining(['user_actions', 'artifact_hash']))
  })
})
