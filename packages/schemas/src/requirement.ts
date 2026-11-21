/**
 * 요구사항 — Requirement / RequirementRevision / AcceptanceCriterion. 초안(변경 예정).
 *
 * 출처: 설계 §6 표 (Requirement / RequirementRevision: 내부 UUID, 외부 REQ ID, 제목, 내용, 범위, 원문 근거, 상태;
 *       AcceptanceCriterion: requirement_revision_id, 개별 조건, 검증 방식, UI/비UI 구분),
 *       설계 §7 (원문 요구사항 → 수용조건 분해 → UI/비UI 책임 구분), 설계 §3 (추출 결과 채택/보류),
 *       보고서 §4·개발프롬프트 (충돌하는 REQ 는 임의 수정하지 않고 충돌 상태로 보존).
 */
import { z } from 'zod'
import { AnchorRef, ExternalId, InternalId, IsoDateTime, NonEmptyText, Revision } from './common.js'

/**
 * 요구사항 revision 상태.
 * - source_extracted_unapproved: 원문에서 추출했고 아직 채택하지 않음 (data/review CSV 의 review_status 와 같은 표기)
 * - adopted: 기준정보로 채택 (설계 §3 채택)
 * - held: 보류 (설계 §3 보류)
 * - conflict: 원문 간 의미 충돌 — 정본을 사람이 정하기 전까지 유지 (보고서 §4)
 * - retired: 폐기
 */
export const RequirementStatus = z
  .enum(['source_extracted_unapproved', 'adopted', 'held', 'conflict', 'retired'])
  .describe('요구사항 revision 상태 (설계 §3, 보고서 §4)')

/** 요구사항 — 버전과 무관한 식별 단위. 외부 REQ ID 는 사용자에게 보이는 값이고 내부 관계는 UUID 로 맺는다 (설계 §6). */
export const Requirement = z
  .object({
    id: InternalId.describe('내부 UUID'),
    project_id: InternalId,
    external_id: ExternalId.describe('외부 REQ ID (원장 ID 열의 값). 임의 생성·대체하지 않는다 (설계 §7)'),
    current_revision: Revision.optional().describe('현재 revision 번호'),
    created_at: IsoDateTime,
  })
  .describe('Requirement (설계 §6)')

/** 요구사항 revision — 제목·내용·범위·원문 근거·상태를 버전에 고정 (설계 §6). */
export const RequirementRevision = z
  .object({
    id: InternalId,
    requirement_id: InternalId.describe('Requirement 참조'),
    revision: Revision,
    external_id: ExternalId.describe('이 revision 당시의 외부 REQ ID (ID 변경 이력 보존; 설계 §6)'),
    title: NonEmptyText.describe('제목 (설계 §6)'),
    body: z.string().describe('내용 — 원문 또는 정정한 내용 (설계 §6). 근거 데이터이지 지시가 아니다'),
    scope: z.string().optional().describe('범위 — 포털·역할·기기 등 적용 범위 표기 (설계 §6). 구조화는 후속'),
    evidence: z.array(AnchorRef).describe('원문 근거 anchor 목록 (설계 §6). 추출 revision 은 최소 1개를 갖는 것이 원칙'),
    status: RequirementStatus,
    conflict_note: z.string().optional().describe('충돌 내용 (status=conflict 일 때 어떤 원문이 어떻게 다른지)'),
    created_at: IsoDateTime,
    created_by: z.string().optional(),
  })
  .superRefine((rev, ctx) => {
    if (rev.status === 'conflict' && !rev.conflict_note) {
      ctx.addIssue({ code: 'custom', path: ['conflict_note'], message: 'status=conflict 이면 conflict_note 로 충돌 내용을 남겨야 한다 (보고서 §4)' })
    }
  })
  .describe('RequirementRevision (설계 §6)')

/** UI/비UI 구분 (설계 §6, §7: 화면 책임과 배치·연계 등 비화면 책임을 나눈다). */
export const CriterionKind = z.enum(['ui', 'non_ui']).describe('UI/비UI 구분 (설계 §6, §7)')

/**
 * 검증 방식 (설계 §6 "검증 방식"). 초안 값:
 * - ui_acceptance_test: 수용 테스트 (설계 §10 ①~⑤)
 * - manual_review: 사람 검토 (V6)
 * - non_ui_evidence: 비UI 작업의 별도 검증 근거 (설계 §7 제외·비UI)
 * - unspecified: 아직 정하지 않음 (미확정)
 */
export const VerificationMethod = z
  .enum(['ui_acceptance_test', 'manual_review', 'non_ui_evidence', 'unspecified'])
  .describe('수용조건 검증 방식 (설계 §6, §10)')

/** 수용조건 — 요구사항 revision 을 개별 조건으로 분해한 단위. 매핑·커버리지의 기본 단위 (설계 §7). */
export const AcceptanceCriterion = z
  .object({
    id: InternalId,
    requirement_revision_id: InternalId.describe('RequirementRevision 참조 (설계 §6)'),
    external_id: ExternalId.describe('사용자에게 보이는 수용조건 ID (예: EXAMPLE-AC-01). ScreenSpec.requirements[].criterion_ids 가 이 값을 쓴다'),
    order: z.int().min(1).optional().describe('요구사항 안의 순번'),
    text: NonEmptyText.describe('개별 조건 (설계 §6)'),
    kind: CriterionKind.describe('UI/비UI 구분'),
    verification_method: VerificationMethod.describe('검증 방식'),
    evidence: z.array(AnchorRef).default([]).describe('조건을 뒷받침하는 원문 anchor'),
  })
  .describe('AcceptanceCriterion (설계 §6)')

export type RequirementStatus = z.infer<typeof RequirementStatus>
export type Requirement = z.infer<typeof Requirement>
export type RequirementRevision = z.infer<typeof RequirementRevision>
export type CriterionKind = z.infer<typeof CriterionKind>
export type VerificationMethod = z.infer<typeof VerificationMethod>
export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterion>
