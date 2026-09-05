/**
 * Baseline — 채택한 자료·요구사항·정책·화면·템플릿의 정확한 버전 묶음. 초안(변경 예정).
 *
 * 출처: 설계 §6 표 (Baseline), 설계 §6 본문 (생성 작업은 사용한 기준 버전을 고정; 완료 시 최신 기준과 달라졌으면 `검토 필요`),
 *       설계 §8 (기준 구역: baseline ID), 설계 §13 (POST /projects/:id/baselines).
 */
import { z } from 'zod'
import { Actor, ExternalId, InternalId, IsoDateTime, Revision } from './common.js'

export const Baseline = z
  .object({
    id: InternalId,
    baseline_id: ExternalId.describe('사용자에게 보이는 baseline ID. ScreenSpec/TraceLink/GenerationJob 의 baseline_id 가 이 값을 쓴다 (설계 §8, §9)'),
    project_id: InternalId,
    revision: Revision,
    source_version_ids: z.array(InternalId).describe('채택한 원본 버전 (설계 §6)'),
    requirement_revision_ids: z.array(InternalId).describe('채택한 요구사항 revision'),
    policy_revision_ids: z.array(InternalId).default([]).describe('채택한 정책 revision'),
    state_model_ids: z.array(InternalId).default([]).describe('채택한 업무 상태 모델 (보고서 §4: 체계별 별도)'),
    screen_revision_ids: z.array(InternalId).default([]).describe('포함한 화면 revision (golden 승인본 등)'),
    prompt_template_version: z.string().optional().describe('고정한 프롬프트 템플릿 버전 (설계 §6 템플릿)'),
    locked_at: IsoDateTime.describe('고정 시점'),
    locked_by: Actor.describe('고정한 사람 (기획 리더; 설계 §2)'),
    note: z.string().optional(),
  })
  .describe('Baseline (설계 §6)')

export type Baseline = z.infer<typeof Baseline>
