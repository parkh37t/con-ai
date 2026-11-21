import { describe, expect, it } from 'vitest'
import { computeCoverage, type CoverageInput } from './coverage.js'
import { DomainRuleError } from './result.js'
import { BASELINE, T1, acceptanceTest, approvedLink, artifact, captureRuleError, criterion, hash, traceLink, uuid } from './test-fixtures.js'

const SCREEN_REV = uuid(600)
const IN_SCOPE_REV = uuid(300)
const OUT_OF_SCOPE_REV = uuid(301)
const baseline = { baseline_id: BASELINE, requirement_revision_ids: [IN_SCOPE_REV] }
const htmlArtifact = artifact(1, { screen_revision_id: SCREEN_REV })

describe('커버리지 (설계 §7)', () => {
  it('분모는 승인된 범위의 수용조건이다 — baseline 이 채택하지 않은 요구사항 revision 의 수용조건은 분모에서 뺀다', () => {
    const report = computeCoverage({
      baseline,
      criteria: [criterion(1), criterion(2), criterion(3, { requirement_revision_id: OUT_OF_SCOPE_REV })],
      links: [approvedLink(1, SCREEN_REV), approvedLink(3, SCREEN_REV, { requirement_revision_id: OUT_OF_SCOPE_REV })],
      tests: [],
      artifacts: [htmlArtifact],
    })
    expect(report.coverage.criteria_in_scope).toBe(2)
    expect(report.out_of_scope_criteria).toBe(1)
    expect(report.coverage.approved_links).toBe(1) // 범위 밖 승인 링크는 세지 않는다
    expect(report.undecided_criterion_ids).toEqual([uuid(202)])
  })

  it('승인 매핑 비율과 테스트 통과 비율은 따로 계산된다 — 통과는 승인 매핑 화면의 artifact 에서 pass 한 테스트만 센다', () => {
    const report = computeCoverage({
      baseline,
      criteria: [criterion(1), criterion(2), criterion(3), criterion(4)],
      links: [approvedLink(1, SCREEN_REV), approvedLink(2, SCREEN_REV), approvedLink(3, SCREEN_REV)],
      tests: [
        acceptanceTest(uuid(201), htmlArtifact.content_hash), // pass, 올바른 artifact
        acceptanceTest(uuid(202), hash('some-other-artifact')), // pass 지만 다른 artifact → 세지 않음
        acceptanceTest(uuid(203), htmlArtifact.content_hash, { result: 'not_run' }), // 실행 안 함 → 통과 아님
        acceptanceTest(uuid(204), htmlArtifact.content_hash), // pass 지만 승인 매핑 없음 → 세지 않음
      ],
      artifacts: [htmlArtifact],
    })
    expect(report.coverage.approved_links).toBe(3)
    expect(report.coverage.tests_passed).toBe(1)
    expect(report.approved_mapping_ratio).toBe(3 / 4)
    expect(report.test_pass_ratio).toBe(1 / 4)
  })

  it('비UI·제외·충돌 건수는 분모에서 빼지 않고 함께 돌려준다', () => {
    const decided = { decided_by: 'planner-1', decided_at: T1 }
    const report = computeCoverage({
      baseline,
      criteria: [criterion(1), criterion(2, { kind: 'non_ui', verification_method: 'non_ui_evidence' }), criterion(3), criterion(4), criterion(5)],
      links: [
        approvedLink(1, SCREEN_REV),
        traceLink(3, { status: 'excluded', reason: '범위 밖(합성)', ...decided }),
        traceLink(4, { status: 'conflict', reason: '원문 간 의미 불일치(합성)', ...decided }),
        traceLink(5, { status: 'non_ui', reason: '배치 책임(합성)', non_ui_work_id: uuid(999), ...decided }),
      ],
      tests: [],
      artifacts: [htmlArtifact],
    })
    expect(report.coverage).toEqual({ baseline_id: BASELINE, criteria_in_scope: 5, approved_links: 1, tests_passed: 0, non_ui: 2, excluded: 1, conflicts: 1 })
    expect(report.approved_mapping_ratio).toBe(1 / 5)
    expect(report.undecided_criterion_ids).toEqual([])
  })

  it('다른 기준 버전의 링크는 세지 않고, 승인 링크가 여럿이어도 수용조건은 한 번만 센다 (다대다)', () => {
    const report = computeCoverage({
      baseline,
      criteria: [criterion(1), criterion(2)],
      links: [
        approvedLink(1, SCREEN_REV, { id: uuid(401) }),
        approvedLink(1, SCREEN_REV, { id: uuid(402), element_or_action_id: 'element-1b' }),
        approvedLink(2, SCREEN_REV, { baseline_id: 'EXAMPLE-baseline-0' }),
      ],
      tests: [],
      artifacts: [htmlArtifact],
    })
    expect(report.coverage.approved_links).toBe(1)
    expect(report.undecided_criterion_ids).toEqual([uuid(202)])
  })

  it('분모가 0 이면 비율은 null 이다 (0/0 을 100% 로 표시하지 않음)', () => {
    const report = computeCoverage({ baseline, criteria: [], links: [], tests: [], artifacts: [] })
    expect(report.coverage.criteria_in_scope).toBe(0)
    expect(report.approved_mapping_ratio).toBeNull()
    expect(report.test_pass_ratio).toBeNull()
  })

  it('중복 ID 수·문자열 출현 수·INDEX 행 수는 입력이 아니다 — 시그니처에 없고 실행 시점에도 거부한다', () => {
    const input = { baseline, criteria: [], links: [], tests: [], artifacts: [], index_row_count: 1428 } as CoverageInput & { index_row_count: number }
    expect(() => computeCoverage(input)).toThrow(DomainRuleError)
    const err = captureRuleError(() => computeCoverage({ ...input, token_occurrences: 1212, duplicate_id_groups: 43 } as CoverageInput))
    expect(err.reasons[0]?.code).toBe('coverage.forbidden_input')
    expect(err.message).toContain('index_row_count')
    expect(err.message).toContain('token_occurrences')
  })
})
