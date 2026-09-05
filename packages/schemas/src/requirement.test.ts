import { describe, expect, it } from 'vitest'
import { AcceptanceCriterion, CriterionKind, RequirementRevision, RequirementStatus } from './requirement.js'
import { issuePaths } from './test-utils.js'

const UUID = '11111111-1111-4111-8111-111111111111'
const base = {
  id: UUID, requirement_id: UUID, revision: 1, external_id: 'EXAMPLE-REQ-001', title: '주문 목록 조회', body: '합성 요구사항 본문',
  evidence: [{ anchor_id: UUID }], created_at: '2026-09-05T00:00:00Z',
}

describe('요구사항 (설계 §6 Requirement / RequirementRevision / AcceptanceCriterion)', () => {
  it('원문 추출 revision 은 data/review 와 같은 status 표기를 쓴다', () => {
    const r = RequirementRevision.safeParse({ ...base, status: 'source_extracted_unapproved' })
    expect(r.success).toBe(true)
    expect(RequirementStatus.options).toContain('conflict')
  })

  it('status 오타는 실패한다', () => {
    expect(issuePaths(RequirementRevision.safeParse({ ...base, status: 'approved' }))).toEqual(['status'])
  })

  it('conflict 상태는 충돌 내용을 요구한다 (보고서 §4: 임의 수정하지 않고 보존)', () => {
    expect(issuePaths(RequirementRevision.safeParse({ ...base, status: 'conflict' }))).toEqual(['conflict_note'])
    expect(RequirementRevision.safeParse({ ...base, status: 'conflict', conflict_note: '화면 설명과 원장의 제목이 다름' }).success).toBe(true)
  })

  it('수용조건은 UI/비UI 구분과 검증 방식을 갖는다', () => {
    expect(CriterionKind.options).toEqual(['ui', 'non_ui'])
    const ok = AcceptanceCriterion.safeParse({ id: UUID, requirement_revision_id: UUID, external_id: 'EXAMPLE-AC-01', text: '검색어로 목록을 필터한다', kind: 'ui', verification_method: 'ui_acceptance_test' })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.evidence).toEqual([])
    const bad = AcceptanceCriterion.safeParse({ id: UUID, requirement_revision_id: UUID, external_id: 'EXAMPLE-AC-02', text: '배치 발행', kind: 'nonui', verification_method: 'non_ui_evidence' })
    expect(issuePaths(bad)).toEqual(['kind'])
  })
})
