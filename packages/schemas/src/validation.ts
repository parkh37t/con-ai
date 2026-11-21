/**
 * 검증 — ValidationRun / ValidationResult / AcceptanceTest. 초안(변경 예정).
 *
 * 출처: 설계 §10 (단계 V0~V7; 각 검사는 pass/fail/error/not_run; 도구 실행 오류·미설치를 성공으로 표시하지 않음;
 *       필수 검사가 error/not_run 이면 승인 후보 불가; 수용 테스트 ①수용조건 ②초기 상태·역할 ③사용자 동작 ④기대 결과 ⑤검증 artifact hash),
 *       설계 §6 표 (ValidationRun / ValidationResult: artifact hash, 검사 버전, 결과, 근거),
 *       보고서 §5 (실행 오류를 별도 상태로 보존).
 *
 * ValidationStatus 는 작업 상태(job.ts JobStatus)·산출물 상태(job.ts ArtifactStatus)와 별도 enum 이다. 합치지 않는다.
 */
import { z } from 'zod'
import { ContentHash, InternalId, IsoDateTime, LocalId, NonEmptyText } from './common.js'
import { RoleId } from './screen.js'

/** 검사 결과 — 네 값만 허용 (설계 §10). */
export const ValidationStatus = z.enum(['pass', 'fail', 'error', 'not_run']).describe('검사 결과 (설계 §10)')

/** 검증 단계 (설계 §10 표). */
export const ValidationStage = z.enum(['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7']).describe('검증 단계 (설계 §10)')

/** 단계 이름 (설계 §10 표). */
export const VALIDATION_STAGE_LABELS: Record<z.infer<typeof ValidationStage>, string> = {
  V0: '입력',
  V1: '명세',
  V2: '렌더링',
  V3: '실행',
  V4: '표시·접근성',
  V5: '회귀',
  V6: '사람 검토',
  V7: '내보내기',
}

export const ValidationRun = z
  .object({
    id: InternalId,
    artifact_id: InternalId.describe('검증 대상 산출물'),
    artifact_hash: ContentHash.describe('검증 시점의 artifact hash (설계 §6). hash 가 바뀌면 결과는 무효'),
    checker_version: NonEmptyText.describe('검사 도구 버전 (설계 §6 검사 버전)'),
    started_at: IsoDateTime,
    finished_at: IsoDateTime.optional(),
    triggered_by: z.string().optional().describe('실행 주체 (사람/작업)'),
  })
  .describe('ValidationRun (설계 §6, §10)')

export const ValidationResult = z
  .object({
    id: InternalId,
    validation_run_id: InternalId,
    artifact_hash: ContentHash.describe('결과가 고정된 artifact hash'),
    check_id: NonEmptyText.describe('검사 식별자 (예: v1.schema, v3.case.empty)'),
    stage: ValidationStage,
    status: ValidationStatus,
    required: z.boolean().describe('필수 검사 여부. 필수가 error/not_run 이면 승인 후보 불가 (설계 §10)'),
    message: z.string().optional().describe('요약 (fail/error 는 원인을 적는다)'),
    evidence: z.array(z.string()).default([]).describe('근거 (로그·스크린샷 경로·비교 결과 등; 설계 §6)'),
    checker_version: NonEmptyText,
    duration_ms: z.int().min(0).optional(),
  })
  .superRefine((r, ctx) => {
    if ((r.status === 'fail' || r.status === 'error') && !r.message) {
      ctx.addIssue({ code: 'custom', path: ['message'], message: `status=${r.status} 에는 원인(message)이 필요하다 (설계 §10: 실행 오류를 성공으로 표시하지 않음)` })
    }
  })
  .describe('ValidationResult (설계 §6, §10)')

export type ValidationStatus = z.infer<typeof ValidationStatus>
export type ValidationStage = z.infer<typeof ValidationStage>
export type ValidationRun = z.infer<typeof ValidationRun>
export type ValidationResult = z.infer<typeof ValidationResult>

/**
 * 승인 후보를 막는 결과를 돌려준다 (설계 §10: 필수 검사가 fail/error/not_run 이면 승인 불가).
 * 빈 배열이면 필수 검사 기준으로는 승인 후보가 될 수 있다 — 사람 검토(V6)를 대체하지는 않는다.
 */
export function findApprovalBlockers(results: readonly ValidationResult[]): ValidationResult[] {
  return results.filter((r) => r.required && r.status !== 'pass')
}

/** 수용 테스트 — 설계 §10 의 다섯 항목을 모두 기록한다. */
export const AcceptanceTest = z
  .object({
    id: InternalId,
    criterion_id: InternalId.describe('① 수용조건 (AcceptanceCriterion 내부 UUID)'),
    initial: z
      .object({
        state_id: LocalId.describe('초기 CASE (ScreenSpec.states[].id)'),
        role: RoleId.describe('역할'),
      })
      .describe('② 초기 상태·역할'),
    user_actions: z
      .array(
        z.object({
          action_id: LocalId.optional().describe('ScreenSpec.actions[].id (있으면)'),
          description: NonEmptyText.describe('사용자 동작 서술'),
        }),
      )
      .min(1, '③ 사용자 동작이 최소 1개 필요하다')
      .describe('③ 사용자 동작'),
    expected_result: NonEmptyText.describe('④ 기대 결과'),
    artifact_hash: ContentHash.describe('⑤ 검증 artifact hash'),
    result: ValidationStatus.optional().describe('실행 결과. 실행하지 않았으면 not_run 또는 생략 (통과로 표시하지 않음)'),
    validation_result_id: InternalId.optional().describe('연결된 ValidationResult'),
  })
  .describe('AcceptanceTest (설계 §10)')

export type AcceptanceTest = z.infer<typeof AcceptanceTest>
