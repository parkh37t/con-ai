import { describe, expect, it } from 'vitest'
import { TraceCoverage, TraceLink, TraceLinkStatus, TraceProposal } from './trace-link.js'
import { issuePaths } from './test-utils.js'

const UUID = '11111111-1111-4111-8111-111111111111'
const base = { id: UUID, revision: 1, baseline_id: 'example-baseline-1', requirement_revision_id: UUID, criterion_id: UUID, origin: 'html_token' }
const decided = { decided_by: 'planner-1', decided_at: '2026-09-05T00:00:00Z' }

describe('TraceLink (설계 §6, §7)', () => {
  it('status 는 candidate/approved/conflict/excluded/non_ui 다섯 값이다', () => {
    expect(TraceLinkStatus.options).toEqual(['candidate', 'approved', 'conflict', 'excluded', 'non_ui'])
    expect(TraceLinkStatus.safeParse('verified').success).toBe(false)
  })

  it('후보는 요소 연결·결정자 없이 저장할 수 있다 (문자열 기반 후보; 승인 아님)', () => {
    expect(TraceLink.safeParse({ ...base, status: 'candidate', screen_revision_id: UUID }).success).toBe(true)
  })

  it('승인 매핑은 화면 버전·요소/동작·근거·결정자가 모두 필요하다', () => {
    const r = TraceLink.safeParse({ ...base, status: 'approved' })
    expect(issuePaths(r)).toEqual(expect.arrayContaining(['decided_by', 'screen_revision_id', 'element_or_action_id', 'evidence']))
    const ok = TraceLink.safeParse({ ...base, ...decided, status: 'approved', screen_revision_id: UUID, element_or_action_id: 'order-table', evidence: [{ anchor_id: UUID }] })
    expect(ok.success).toBe(true)
  })

  it('conflict/excluded 는 사유가, non_ui 는 비UI 작업 연결이 필요하다', () => {
    expect(issuePaths(TraceLink.safeParse({ ...base, ...decided, status: 'conflict' }))).toEqual(['reason'])
    expect(issuePaths(TraceLink.safeParse({ ...base, ...decided, status: 'excluded' }))).toEqual(['reason'])
    expect(issuePaths(TraceLink.safeParse({ ...base, ...decided, status: 'non_ui', reason: '배치 책임' }))).toEqual(['non_ui_work_id'])
    expect(TraceLink.safeParse({ ...base, ...decided, status: 'non_ui', reason: '배치 책임', non_ui_work_id: UUID }).success).toBe(true)
  })

  it('TraceProposal 은 항상 candidate 이며 approved 로 만들 수 없다', () => {
    const p = TraceProposal.safeParse({ requirement_id: 'EXAMPLE-REQ-001', criterion_id: 'EXAMPLE-AC-01', element_or_action_id: 'query' })
    expect(p.success).toBe(true)
    if (p.success) expect(p.data.status).toBe('candidate')
    expect(TraceProposal.safeParse({ requirement_id: 'EXAMPLE-REQ-001', criterion_id: 'EXAMPLE-AC-01', element_or_action_id: 'query', status: 'approved' }).success).toBe(false)
  })

  it('커버리지 분자는 분모(승인된 범위의 수용조건)를 넘을 수 없다', () => {
    const ok = TraceCoverage.safeParse({ baseline_id: 'b', criteria_in_scope: 10, approved_links: 4, tests_passed: 2, non_ui: 1, excluded: 1, conflicts: 1 })
    expect(ok.success).toBe(true)
    expect(issuePaths(TraceCoverage.safeParse({ baseline_id: 'b', criteria_in_scope: 3, approved_links: 5, tests_passed: 0, non_ui: 0, excluded: 0, conflicts: 0 }))).toEqual(['approved_links'])
  })
})
