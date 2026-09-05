import { describe, expect, it } from 'vitest'
import { NonUIScreenWork } from '@con-ai/schemas'
import { DomainRuleError } from './result.js'
import { BASELINE, PROJECT, T1, htmlAnchor, sheetAnchor, traceLink, uuid } from './test-fixtures.js'
import { approveTraceLink, canApproveTraceLink, canExcludeTraceLink, excludeTraceLink, markTraceConflict, type TraceApprovalInput } from './trace-decision.js'

const SCREEN_REV = uuid(600)
const sheet = sheetAnchor(1)
const html = htmlAnchor(1)
const candidate = traceLink(1, { origin: 'html_token', screen_revision_id: SCREEN_REV, evidence: [{ anchor_id: html.id }] })
const decision = { decided_by: 'planner-1', decided_at: T1, revision: 1, screen_revision_id: SCREEN_REV, element_or_action_id: 'order-table' }
const input: TraceApprovalInput = {
  link: candidate,
  current_baseline_id: BASELINE,
  decision: { ...decision, evidence: [{ anchor_id: html.id }, { anchor_id: sheet.id, note: '원장 행 확인(합성)' }] },
  anchors: [sheet, html],
  screen_revision: { id: SCREEN_REV, baseline_id: BASELINE },
}
const codes = (r: { reasons: { code: string }[] }) => r.reasons.map((x) => x.code)

describe('매핑 승인 판정 (설계 §7; 개발프롬프트 4항)', () => {
  it('HTML 토큰 출현만 있는 후보는 승인할 수 없다 — 원문 근거를 더하면 승인된다', () => {
    const tokenOnly = canApproveTraceLink({ ...input, decision: { ...decision, evidence: [{ anchor_id: html.id }] } })
    expect(tokenOnly.allowed).toBe(false)
    expect(codes(tokenOnly)).toEqual(['trace.token_only'])
    expect(() => approveTraceLink({ ...input, decision: { ...decision, evidence: [{ anchor_id: html.id }] } })).toThrow(DomainRuleError)

    const approved = approveTraceLink(input)
    expect(approved.status).toBe('approved')
    expect(approved.revision).toBe(2)
    expect(approved.decided_by).toBe('planner-1')
    expect(approved.evidence.map((e) => e.anchor_id)).toEqual([html.id, sheet.id])
    expect(candidate.status).toBe('candidate') // 원본 불변
  })

  it('근거가 없거나 저장되지 않은 anchor 를 가리키면 승인할 수 없다', () => {
    expect(codes(canApproveTraceLink({ ...input, decision: { ...decision, evidence: [] } }))).toEqual(['trace.evidence_required'])
    expect(codes(canApproveTraceLink({ ...input, decision: { ...decision, evidence: [{ anchor_id: uuid(1234) }] } }))).toEqual(['trace.evidence_unknown_anchor'])
  })

  it('동일 기준 버전이 아니면 승인할 수 없다 (후보·화면 revision 모두)', () => {
    expect(codes(canApproveTraceLink({ ...input, current_baseline_id: 'EXAMPLE-baseline-2' }))).toEqual(['trace.baseline_mismatch', 'trace.screen_baseline_mismatch'])
    expect(codes(canApproveTraceLink({ ...input, screen_revision: { id: uuid(601), baseline_id: BASELINE } }))).toEqual(['trace.screen_revision_mismatch'])
  })

  it('담당자·시점·본 revision 이 맞지 않으면 승인할 수 없다', () => {
    expect(codes(canApproveTraceLink({ ...input, decision: { ...input.decision, decided_by: ' ' } }))).toEqual(['trace.decided_by_required'])
    expect(codes(canApproveTraceLink({ ...input, decision: { ...input.decision, decided_at: '오늘' } }))).toEqual(['trace.decided_at_required'])
    expect(codes(canApproveTraceLink({ ...input, decision: { ...input.decision, revision: 0 } }))).toEqual(['trace.revision_conflict'])
  })

  it('conflict 매핑은 정본 확정 결정 없이는 approved 로 바꿀 수 없다 (REQ-SFR-066-001 사례) — 결정이 있으면 가능하다', () => {
    const conflict = markTraceConflict({ link: candidate, decision: { decided_by: 'planner-1', decided_at: T1, revision: 1, reason: '화면 설명과 원장의 REQ 의미가 다름(합성)' } })
    expect(conflict.status).toBe('conflict')
    expect(conflict.revision).toBe(2)
    const direct = canApproveTraceLink({ ...input, link: conflict, decision: { ...input.decision, revision: 2 } })
    expect(direct.allowed).toBe(false)
    expect(codes(direct)).toEqual(['trace.conflict_unresolved'])
    expect(direct.reasons[0]?.message).toContain('정본')

    const resolution = { decided_by: 'lead-1', decided_at: T1, canonical_anchor_id: sheet.id, reason: '원장 SFR 행을 정본으로 확정(합성)' }
    const resolved = approveTraceLink({ ...input, link: conflict, decision: { ...input.decision, revision: 2 }, conflict_resolution: resolution })
    expect(resolved.status).toBe('approved')
    expect(resolved.reason).toContain('정본 확정')
    // 정본은 원문이어야 한다 — HTML 설명을 정본으로 삼을 수 없다
    const htmlCanonical = canApproveTraceLink({ ...input, link: conflict, decision: { ...input.decision, revision: 2 }, conflict_resolution: { ...resolution, canonical_anchor_id: html.id } })
    expect(codes(htmlCanonical)).toEqual(['trace.conflict_resolution.anchor_not_source'])
    expect(codes(canApproveTraceLink({ ...input, link: conflict, decision: { ...input.decision, revision: 2 }, conflict_resolution: { ...resolution, reason: '' } }))).toEqual(['trace.conflict_resolution.reason_required'])
  })

  it('excluded 는 사유가, non_ui 는 사유와 이 수용조건을 연결한 비UI 작업이 필요하다', () => {
    const meta = { decided_by: 'planner-1', decided_at: T1, revision: 1 }
    expect(codes(canExcludeTraceLink({ link: candidate, current_baseline_id: BASELINE, decision: { ...meta, status: 'excluded' } }))).toEqual(['trace.reason_required'])
    const excluded = excludeTraceLink({ link: candidate, current_baseline_id: BASELINE, decision: { ...meta, status: 'excluded', reason: '이번 범위 밖(합성)' } })
    expect(excluded.status).toBe('excluded')

    const nonUiNoWork = canExcludeTraceLink({ link: candidate, current_baseline_id: BASELINE, decision: { ...meta, status: 'non_ui', reason: '배치 책임(합성)' } })
    expect(codes(nonUiNoWork)).toEqual(['trace.non_ui_work_required'])
    const otherWork = NonUIScreenWork.parse({ id: uuid(990), project_id: PROJECT, kind: 'batch', title: '월말 집계 배치(합성)', criterion_ids: [uuid(299)], owner: 'dev-1' })
    expect(codes(canExcludeTraceLink({ link: candidate, current_baseline_id: BASELINE, decision: { ...meta, status: 'non_ui', reason: '배치 책임(합성)' }, non_ui_work: otherWork }))).toEqual(['trace.non_ui_work_criterion_mismatch'])
    const work = NonUIScreenWork.parse({ ...otherWork, criterion_ids: [candidate.criterion_id] })
    const nonUi = excludeTraceLink({ link: candidate, current_baseline_id: BASELINE, decision: { ...meta, status: 'non_ui', reason: '배치 책임(합성)' }, non_ui_work: work })
    expect(nonUi.status).toBe('non_ui')
    expect(nonUi.non_ui_work_id).toBe(work.id)
  })
})
