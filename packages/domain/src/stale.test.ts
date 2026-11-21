import { describe, expect, it } from 'vitest'
import { DomainRuleError } from './result.js'
import { applyStaleTargets, findChangeImpact, markStale } from './stale.js'
import { BASELINE, acceptanceTest, approvedLink, artifact, traceLink, uuid } from './test-fixtures.js'

const SCREEN_A = uuid(600)
const SCREEN_B = uuid(601)
const REV_CHANGED = uuid(300)
const REV_OTHER = uuid(301)

const links = [
  approvedLink(1, SCREEN_A), // 변경된 요구사항 revision(300) 의 승인 매핑 → 화면 A
  traceLink(2, { screen_revision_id: SCREEN_A }), // 같은 요구사항의 후보
  approvedLink(3, SCREEN_B, { requirement_revision_id: REV_OTHER }), // 무관한 요구사항 → 화면 B
]
const approvedA = artifact(1, { screen_revision_id: SCREEN_A, status: 'approved', approval_id: uuid(1000) })
const specA = artifact(2, { screen_revision_id: SCREEN_A, kind: 'spec', status: 'review_ready' })
const alreadyStaleA = artifact(3, { screen_revision_id: SCREEN_A, status: 'stale', stale_reason: '이전 변경' })
const approvedB = artifact(4, { screen_revision_id: SCREEN_B, status: 'approved', approval_id: uuid(1001) })
const artifacts = [approvedA, specA, alreadyStaleA, approvedB]

describe('변경 영향 (설계 §11)', () => {
  it('요구사항 revision 변경 → TraceLink 로 영향 화면·산출물·테스트를 찾고 기존 승인을 stale 대상으로 만든다', () => {
    const tests = [acceptanceTest(uuid(201), approvedA.content_hash), acceptanceTest(uuid(203), approvedB.content_hash)]
    const impact = findChangeImpact({ changed_requirement_revision_ids: [REV_CHANGED], links, artifacts, tests })
    expect(impact.affected_links.map((l) => l.id)).toEqual([uuid(401), uuid(402)])
    expect(impact.approved_links_to_review.map((l) => l.id)).toEqual([uuid(401)])
    expect(impact.affected_screen_revision_ids).toEqual([SCREEN_A])
    expect(impact.affected_artifacts.map((a) => a.id)).toEqual([approvedA.id, specA.id, alreadyStaleA.id])
    expect(impact.affected_tests.map((t) => t.criterion_id)).toEqual([uuid(201)])
    expect(impact.stale_targets).toEqual([
      { artifact_id: approvedA.id, content_hash: approvedA.content_hash, previous_status: 'approved', reason: `요구사항 revision ${REV_CHANGED} 변경` },
      { artifact_id: specA.id, content_hash: specA.content_hash, previous_status: 'review_ready', reason: `요구사항 revision ${REV_CHANGED} 변경` },
    ])
    // 무관한 화면 B 의 승인본은 건드리지 않는다
    expect(impact.stale_targets.some((t) => t.artifact_id === approvedB.id)).toBe(false)
  })

  it('수용조건 단위 변경과 기준 버전 갱신(정책 변경)도 영향을 찾는다', () => {
    const byCriterion = findChangeImpact({ changed_criterion_ids: [uuid(203)], links, artifacts })
    expect(byCriterion.affected_screen_revision_ids).toEqual([SCREEN_B])
    expect(byCriterion.stale_targets.map((t) => t.artifact_id)).toEqual([approvedB.id])

    const byBaseline = findChangeImpact({ changed_baseline_ids: [BASELINE], links: [], artifacts, screen_revisions: [{ id: SCREEN_A, baseline_id: BASELINE }, { id: SCREEN_B, baseline_id: 'EXAMPLE-baseline-0' }] })
    expect(byBaseline.affected_screen_revision_ids).toEqual([SCREEN_A])
    expect(byBaseline.stale_targets.map((t) => t.reason)).toEqual([`기준 버전 ${BASELINE} 갱신`, `기준 버전 ${BASELINE} 갱신`])

    expect(findChangeImpact({ links, artifacts })).toEqual({ affected_links: [], approved_links_to_review: [], affected_screen_revision_ids: [], affected_artifacts: [], affected_tests: [], stale_targets: [] })
  })

  it('markStale 은 사유를 남긴 새 산출물을 만들고 이미 stale 이면 거부한다; applyStaleTargets 는 대상만 바꾼다', () => {
    const stale = markStale(approvedA, '요구사항 변경(합성)')
    expect(stale.status).toBe('stale')
    expect(stale.stale_reason).toBe('요구사항 변경(합성)')
    expect(approvedA.status).toBe('approved') // 원본 불변
    expect(() => markStale(alreadyStaleA, '다시')).toThrow(DomainRuleError)

    const impact = findChangeImpact({ changed_requirement_revision_ids: [REV_CHANGED], links, artifacts })
    const applied = applyStaleTargets(artifacts, impact)
    expect(applied.map((a) => a.status)).toEqual(['stale', 'stale', 'stale', 'approved'])
    expect(applied[3]).toBe(approvedB) // 대상이 아니면 같은 객체
  })
})
