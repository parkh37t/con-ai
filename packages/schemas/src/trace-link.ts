/**
 * TraceLink / TraceProposal — 요구사항 수용조건 ↔ 화면 요소·동작 매핑. 초안(변경 예정).
 *
 * 출처: 설계 §6 표 (TraceLink: 기준 버전, 요구사항 수용조건, 화면 버전, 요소/동작, 근거, 제안·승인 상태),
 *       설계 §7 (매핑 후보는 미승인; 승인 매핑은 동일 기준 버전에서 담당자 확인; 제외·비UI 는 사유와 별도 책임·검증 연결 필요;
 *       충돌은 conflict 로 표시하고 ID 를 임의 생성·대체하지 않음; 커버리지 분모는 승인된 범위의 수용조건),
 *       설계 §8 (산출 trace_proposals), 설계 §13 (PATCH /trace-links/:id 는 revision 필수),
 *       보고서 §7 (문자열 기반 후보를 의미 확인 없이 TraceLink 로 승인하지 않음).
 */
import { z } from 'zod'
import { Actor, AnchorRef, ExternalId, InternalId, IsoDateTime, LocalId, Revision } from './common.js'

/**
 * 매핑 상태 (설계 §7 판정 원칙).
 * candidate=후보(미승인), approved=승인 매핑, conflict=의미 충돌, excluded=제외(사유 필요), non_ui=비UI 책임(별도 작업 연결 필요).
 */
export const TraceLinkStatus = z.enum(['candidate', 'approved', 'conflict', 'excluded', 'non_ui']).describe('매핑 상태 (설계 §7)')

/** 후보의 출처 종류 (설계 §7: HTML 토큰·IA·유사도 기반 추출; AI 제안). */
export const TraceOrigin = z.enum(['html_token', 'ia', 'similarity', 'ai_proposal', 'manual']).describe('후보 출처 (설계 §7)')

export const TraceLink = z
  .object({
    id: InternalId,
    revision: Revision.describe('PATCH 시 필수 (설계 §13)'),
    baseline_id: ExternalId.describe('기준 버전 (설계 §6). 승인은 동일 기준 버전에서 확인 (설계 §7)'),
    requirement_revision_id: InternalId.describe('요구사항 revision'),
    criterion_id: InternalId.describe('수용조건 (AcceptanceCriterion 내부 UUID)'),
    screen_revision_id: InternalId.optional().describe('화면 버전. non_ui/excluded 는 비어 있을 수 있음'),
    element_or_action_id: LocalId.optional().describe('화면명세의 요소/동작 로컬 ID. approved 이면 필수'),
    non_ui_work_id: InternalId.optional().describe('비UI 작업 연결 (status=non_ui 이면 필수; 설계 §7)'),
    evidence: z.array(AnchorRef).default([]).describe('근거 anchor (설계 §6, §7)'),
    origin: TraceOrigin.describe('이 매핑이 어떻게 생겼는지'),
    status: TraceLinkStatus,
    decided_by: Actor.optional().describe('결정자 (approved/conflict/excluded/non_ui)'),
    decided_at: IsoDateTime.optional(),
    reason: z.string().optional().describe('결정 사유 (conflict/excluded/non_ui 필수)'),
  })
  .superRefine((link, ctx) => {
    const decided = link.status !== 'candidate'
    if (decided && (link.decided_by === undefined || link.decided_at === undefined)) {
      ctx.addIssue({ code: 'custom', path: ['decided_by'], message: `status=${link.status} 에는 결정자·결정 시점이 필요하다 (설계 §2, §7)` })
    }
    if (link.status === 'approved') {
      if (link.screen_revision_id === undefined) ctx.addIssue({ code: 'custom', path: ['screen_revision_id'], message: '승인 매핑에는 화면 버전이 필요하다' })
      if (link.element_or_action_id === undefined) ctx.addIssue({ code: 'custom', path: ['element_or_action_id'], message: '승인 매핑에는 요소/동작 연결이 필요하다 (설계 §7 요소/동작 연결)' })
      if (link.evidence.length === 0) ctx.addIssue({ code: 'custom', path: ['evidence'], message: '승인 매핑에는 근거가 필요하다 (설계 §7 근거 확인)' })
    }
    if ((link.status === 'conflict' || link.status === 'excluded' || link.status === 'non_ui') && !link.reason) {
      ctx.addIssue({ code: 'custom', path: ['reason'], message: `status=${link.status} 에는 사유가 필요하다 (설계 §7)` })
    }
    if (link.status === 'non_ui' && link.non_ui_work_id === undefined) {
      ctx.addIssue({ code: 'custom', path: ['non_ui_work_id'], message: '비UI 매핑에는 별도 책임·검증(NonUIScreenWork) 연결이 필요하다 (설계 §7)' })
    }
  })
  .describe('TraceLink (설계 §6, §7)')

/** AI 매핑 제안 — 승인이 아니다. 외부 ID 로 표현하며 서버가 내부 UUID 로 해석한 뒤 candidate TraceLink 로 저장한다 (설계 §8). */
export const TraceProposal = z
  .strictObject({
    requirement_id: ExternalId.describe('외부 REQ ID'),
    criterion_id: ExternalId.describe('수용조건 외부 ID'),
    element_or_action_id: LocalId.describe('화면명세의 요소/동작 로컬 ID'),
    evidence: z.array(AnchorRef).default([]).describe('근거 anchor. 없으면 unresolved 로 분리하는 것이 원칙'),
    rationale: z.string().optional().describe('제안 이유'),
    confidence: z.number().min(0).max(1).optional().describe('모델 자체 신뢰도 (참고값; 승인 기준이 아님)'),
    status: z.literal('candidate').default('candidate').describe('항상 candidate. 승인은 사람이 TraceLink 에서 한다 (설계 §7)'),
  })
  .describe('TraceProposal (설계 §8)')

/** 커버리지 요약 — 분모는 승인된 범위의 수용조건 (설계 §7). 중복 ID·문자열 출현 수·INDEX 행 수는 분모가 아니다. */
export const TraceCoverage = z
  .object({
    baseline_id: ExternalId,
    criteria_in_scope: z.int().min(0).describe('분모: 승인된 범위의 수용조건 수'),
    approved_links: z.int().min(0).describe('승인 매핑이 있는 수용조건 수'),
    tests_passed: z.int().min(0).describe('연결된 수용 테스트가 통과한 수용조건 수'),
    non_ui: z.int().min(0).describe('비UI 로 분류한 수용조건 수'),
    excluded: z.int().min(0).describe('제외한 수용조건 수'),
    conflicts: z.int().min(0).describe('충돌 상태 수용조건 수'),
  })
  .superRefine((c, ctx) => {
    for (const key of ['approved_links', 'tests_passed', 'non_ui', 'excluded', 'conflicts'] as const) {
      if (c[key] > c.criteria_in_scope) ctx.addIssue({ code: 'custom', path: [key], message: `${key} 는 분모(criteria_in_scope)를 넘을 수 없다` })
    }
  })
  .describe('커버리지 요약 (설계 §7)')

export type TraceLinkStatus = z.infer<typeof TraceLinkStatus>
export type TraceLink = z.infer<typeof TraceLink>
export type TraceProposal = z.infer<typeof TraceProposal>
export type TraceCoverage = z.infer<typeof TraceCoverage>
