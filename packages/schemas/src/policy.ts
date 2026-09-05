/**
 * 정책·용어·상태 모델 — PolicyRevision / Term / StateModel. 초안(변경 예정, 최소 형태).
 *
 * 출처: 설계 §6 표 (PolicyRevision / Term / StateModel: 적용 범위, 정의, 값, 전이, 예외, 근거),
 *       보고서 §4 (기존 더미 규칙의 상태 체계·개정 용어집의 업무 상태·별도 매크로 상태를 같은 enum 으로 합치지 않는다;
 *       적용 범위·채택 버전은 사람이 정한다).
 *
 * 여기서의 StateModel 은 "업무 상태값"(주문 상태 등)을 말한다. 이 저장소 자체의 작업/산출물/검증 상태 enum 은
 * job.ts·validation.ts 에 별도로 두며 여기와 무관하다.
 */
import { z } from 'zod'
import { AnchorRef, InternalId, IsoDateTime, NonEmptyText, Revision } from './common.js'

/** 기준정보 채택 상태 (설계 §3: 채택/보류; 미확정은 별도 목록). */
export const AdoptionStatus = z.enum(['proposed', 'adopted', 'held', 'conflict', 'retired']).describe('기준정보 채택 상태 (설계 §3)')

/** 정책 revision. */
export const PolicyRevision = z
  .object({
    id: InternalId,
    policy_id: InternalId.describe('정책 식별 단위 (버전 무관)'),
    revision: Revision,
    title: NonEmptyText,
    scope: z.string().describe('적용 범위 — 포털·역할·화면군 등 (설계 §6)'),
    definition: z.string().describe('정의 (설계 §6). 원문 지시문을 실행 지시로 승격하지 않는다 (설계 §8)'),
    exceptions: z.array(z.string()).default([]).describe('예외 (설계 §6)'),
    evidence: z.array(AnchorRef).describe('근거 anchor (설계 §6)'),
    status: AdoptionStatus,
    created_at: IsoDateTime,
  })
  .describe('PolicyRevision (설계 §6)')

/** 용어. */
export const Term = z
  .object({
    id: InternalId,
    project_id: InternalId,
    term: NonEmptyText.describe('용어'),
    definition: z.string().describe('정의'),
    scope: z.string().optional().describe('적용 범위'),
    evidence: z.array(AnchorRef).default([]),
    status: AdoptionStatus,
  })
  .describe('Term (설계 §6)')

/** 업무 상태 모델의 값 하나. */
export const StateValue = z.object({
  value: NonEmptyText.describe('상태 코드/값'),
  label: NonEmptyText.describe('표시 명칭'),
  description: z.string().optional(),
})

/** 상태 전이. from/to 는 같은 모델의 값이어야 한다. */
export const StateTransition = z.object({
  from: NonEmptyText,
  to: NonEmptyText,
  trigger: z.string().optional().describe('전이를 일으키는 동작·사건'),
})

/**
 * 업무 상태 모델 — 원본 체계 하나당 레코드 하나.
 * 서로 다른 원본의 상태 체계를 하나의 enum 으로 합치지 않는다 (보고서 §4). 어느 것을 채택할지는 status 로 사람이 정한다.
 */
export const StateModel = z
  .object({
    id: InternalId,
    project_id: InternalId,
    name: NonEmptyText.describe('모델 이름 (예: 주문 상태 — 용어집 개정판)'),
    origin: NonEmptyText.describe('출처 체계 표기 (예: 기존 더미 규칙 / 개정 용어집 / 매크로 상태). 체계마다 별도 레코드 (보고서 §4)'),
    scope: z.string().describe('적용 범위 (설계 §6)'),
    values: z.array(StateValue).min(1).describe('값 목록 (설계 §6)'),
    transitions: z.array(StateTransition).default([]).describe('전이 (설계 §6)'),
    exceptions: z.array(z.string()).default([]).describe('예외 (설계 §6)'),
    evidence: z.array(AnchorRef).describe('근거 anchor'),
    status: AdoptionStatus,
  })
  .superRefine((model, ctx) => {
    const seen = new Set<string>()
    model.values.forEach((v, i) => {
      if (seen.has(v.value)) ctx.addIssue({ code: 'custom', path: ['values', i, 'value'], message: `상태값 중복: ${v.value}` })
      seen.add(v.value)
    })
    model.transitions.forEach((t, i) => {
      if (!seen.has(t.from)) ctx.addIssue({ code: 'custom', path: ['transitions', i, 'from'], message: `전이 출발 상태가 값 목록에 없다: ${t.from}` })
      if (!seen.has(t.to)) ctx.addIssue({ code: 'custom', path: ['transitions', i, 'to'], message: `전이 도착 상태가 값 목록에 없다: ${t.to}` })
    })
  })
  .describe('StateModel (설계 §6, 보고서 §4)')

export type AdoptionStatus = z.infer<typeof AdoptionStatus>
export type PolicyRevision = z.infer<typeof PolicyRevision>
export type Term = z.infer<typeof Term>
export type StateModel = z.infer<typeof StateModel>
