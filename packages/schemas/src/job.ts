/**
 * 생성 작업·산출물 — GenerationJob / Artifact / Approval. 초안(변경 예정).
 *
 * 출처: 설계 §11 (작업 상태 queued → running → succeeded/failed/cancelled; 산출물 draft → validation_pending → review_ready → approved,
 *       변경 시 새 draft 또는 stale; 작업 성공과 산출물 승인은 독립; idempotency key·입력 버전·진행 단계·제한 시간·취소 요청;
 *       제한 횟수 재시도; 모델 오류 후 이전 HTML 을 새 결과처럼 보여주지 않음),
 *       설계 §6 표 (PromptTemplate / GenerationJob: 템플릿 버전, 입력 스냅샷, 모델 설정, 실행 상태, 비용·시간;
 *       Artifact: HTML·자산·명세, content hash, 생성 작업, 렌더러 버전; Approval: 승인 대상 hash),
 *       설계 §5 (단계: 문맥 구성 → AI 명세 작성 → 스키마 검사 → 렌더링 → 자동 검증 → 결과 저장), 설계 §3 (다섯 작업 유형).
 *
 * JobStatus 와 ArtifactStatus 는 서로 다른 enum 이며 validation.ts 의 ValidationStatus 와도 합치지 않는다.
 */
import { z } from 'zod'
import { Actor, ContentHash, ExternalId, InternalId, IsoDateTime, NonEmptyText } from './common.js'

/** 작업 상태 (설계 §11). */
export const JobStatus = z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']).describe('작업 상태 (설계 §11)')

/** 진행 단계 (설계 §5 작업 큐 흐름). */
export const JobStage = z.enum(['context_build', 'spec_generate', 'schema_check', 'render', 'validate', 'persist']).describe('진행 단계 (설계 §5, §11)')

/** 작업 유형 — BNK 의 다섯 유형 (설계 §3). MVP 는 create/edit/clone_reference 먼저. */
export const GenerationJobType = z.enum(['create', 'edit', 'clone_reference', 'page_to_popup', 'structural_regenerate']).describe('작업 유형 (설계 §3)')

/** 실패 원인 분류 (설계 §11: 일시적 모델 오류는 제한 재시도, 스키마 실패는 구체 오류 전달). */
export const JobFailureCode = z.enum(['model_error', 'schema_invalid', 'reference_invalid', 'timeout', 'cancelled', 'renderer_error', 'internal']).describe('실패 원인 분류 (설계 §11)')

export const JobFailure = z.object({
  code: JobFailureCode,
  message: NonEmptyText.describe('구체 오류. 사용자에게 실제 실패 원인을 보여준다 (설계 §13 GET /jobs/:id)'),
  stage: JobStage.optional().describe('실패한 단계'),
  details: z.array(z.string()).default([]).describe('스키마 오류 목록 등'),
})

export const GenerationJob = z
  .object({
    id: InternalId,
    project_id: InternalId,
    screen_plan_id: InternalId.optional().describe('대상 화면 (신규 생성이면 없음)'),
    job_type: GenerationJobType,
    status: JobStatus,
    idempotency_key: NonEmptyText.describe('idempotency key (설계 §11)'),
    input_snapshot_hash: ContentHash.describe('입력 스냅샷(요청 폼+문맥) hash — 입력 버전 (설계 §6, §11)'),
    baseline_id: ExternalId.describe('고정한 기준 버전 (설계 §6)'),
    prompt_template_version: NonEmptyText.describe('프롬프트 템플릿 버전 (설계 §6, §8)'),
    model_id: NonEmptyText.describe('모델 식별자 — 실제 지원 모델 (설계 §8)'),
    attempt: z.int().min(0).describe('시도 횟수 (0=아직 실행 전)'),
    max_attempts: z.int().min(1).describe('재시도 제한 (설계 §11 무한 자동 수정 금지)'),
    timeout_ms: z.int().min(1).describe('제한 시간 (설계 §11)'),
    cancel_requested: z.boolean().default(false).describe('취소 요청 (설계 §11)'),
    current_stage: JobStage.optional().describe('진행 단계 (설계 §11)'),
    created_at: IsoDateTime,
    started_at: IsoDateTime.optional(),
    finished_at: IsoDateTime.optional(),
    failure: JobFailure.optional().describe('실패 원인 (status=failed 필수)'),
    cost: z.object({ input_tokens: z.int().min(0), output_tokens: z.int().min(0) }).optional().describe('비용 (설계 §6)'),
    requested_by: Actor.optional(),
  })
  .superRefine((job, ctx) => {
    if (job.attempt > job.max_attempts) ctx.addIssue({ code: 'custom', path: ['attempt'], message: '시도 횟수가 재시도 제한을 넘었다 (설계 §11)' })
    if (job.status === 'failed' && job.failure === undefined) ctx.addIssue({ code: 'custom', path: ['failure'], message: 'status=failed 에는 실패 원인이 필요하다 (설계 §11, §13)' })
    if ((job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') && job.finished_at === undefined) {
      ctx.addIssue({ code: 'custom', path: ['finished_at'], message: `status=${job.status} 에는 종료 시점이 필요하다` })
    }
    if (job.status === 'running' && job.started_at === undefined) ctx.addIssue({ code: 'custom', path: ['started_at'], message: 'status=running 에는 시작 시점이 필요하다' })
  })
  .describe('GenerationJob (설계 §6, §11)')

/** 산출물 상태 (설계 §11). 작업 상태와 독립. */
export const ArtifactStatus = z.enum(['draft', 'validation_pending', 'review_ready', 'approved', 'stale']).describe('산출물 상태 (설계 §11)')

/** 산출물 종류 (설계 §6: HTML·자산·명세; 검증 보고서). */
export const ArtifactKind = z.enum(['html', 'spec', 'asset', 'report']).describe('산출물 종류 (설계 §6)')

export const Artifact = z
  .object({
    id: InternalId,
    project_id: InternalId,
    screen_revision_id: InternalId.optional().describe('연결된 화면 revision'),
    kind: ArtifactKind,
    content_hash: ContentHash.describe('content hash (설계 §6). 승인·검증은 이 값에 고정'),
    generation_job_id: InternalId.describe('생성 작업 (설계 §6)'),
    renderer_version: NonEmptyText.describe('렌더러 버전 (설계 §6, §9 재현성)'),
    storage_path: z.string().optional().describe('저장 위치'),
    status: ArtifactStatus,
    approval_id: InternalId.optional().describe('승인 기록 (status=approved 필수)'),
    stale_reason: z.string().optional().describe('stale 사유 (요구사항·정책 변경 등; 설계 §11)'),
    created_at: IsoDateTime,
  })
  .superRefine((a, ctx) => {
    if (a.status === 'approved' && a.approval_id === undefined) ctx.addIssue({ code: 'custom', path: ['approval_id'], message: 'approved 산출물에는 승인 기록이 필요하다 (설계 §10, §13)' })
    if (a.status === 'stale' && !a.stale_reason) ctx.addIssue({ code: 'custom', path: ['stale_reason'], message: 'stale 산출물에는 사유가 필요하다 (설계 §11)' })
  })
  .describe('Artifact (설계 §6, §11)')

/** 승인 기록 — 정확한 artifact hash 에 연결 (설계 §6 Approval, §13 POST /artifacts/:id/approvals). */
export const Approval = z
  .object({
    id: InternalId,
    artifact_id: InternalId,
    artifact_hash: ContentHash.describe('승인 대상 hash (설계 §6)'),
    baseline_id: ExternalId.describe('승인 시점의 기준 버전'),
    validation_run_id: InternalId.describe('필수 검사를 확인한 ValidationRun'),
    approved_by: Actor,
    approved_at: IsoDateTime,
    note: z.string().optional(),
  })
  .describe('Approval (설계 §6)')

/** 프롬프트 템플릿 (설계 §6, §8: 서버가 버전이 있는 템플릿으로 조립). */
export const PromptTemplate = z
  .object({
    id: InternalId,
    name: NonEmptyText,
    version: NonEmptyText.describe('템플릿 버전'),
    body_hash: ContentHash.describe('템플릿 본문 hash'),
    created_at: IsoDateTime,
  })
  .describe('PromptTemplate (설계 §6)')

export type JobStatus = z.infer<typeof JobStatus>
export type JobStage = z.infer<typeof JobStage>
export type GenerationJobType = z.infer<typeof GenerationJobType>
export type GenerationJob = z.infer<typeof GenerationJob>
export type ArtifactStatus = z.infer<typeof ArtifactStatus>
export type ArtifactKind = z.infer<typeof ArtifactKind>
export type Artifact = z.infer<typeof Artifact>
export type Approval = z.infer<typeof Approval>
export type PromptTemplate = z.infer<typeof PromptTemplate>
