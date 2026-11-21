/**
 * 작업 상태·단계 표시 로직 (순수 함수). 계약 §6: context_build → spec_generate → schema_check → render → validate → persist.
 * 작업 상태(queued/running/succeeded/failed/cancelled)는 산출물·검증 상태와 합치지 않는다 (CLAUDE.md 상태 분리).
 */
import type { Job, JobStage, JobStatus } from './types.js'

export const JOB_STAGES: readonly JobStage[] = ['context_build', 'spec_generate', 'schema_check', 'render', 'validate', 'persist']

export const STAGE_LABELS: Readonly<Record<JobStage, string>> = {
  context_build: '문맥 구성',
  spec_generate: '명세 생성',
  schema_check: '스키마 검사',
  render: '렌더',
  validate: '검증',
  persist: '저장',
}

export const JOB_STATUS_LABELS: Readonly<Record<JobStatus, string>> = {
  queued: '대기',
  running: '실행 중',
  succeeded: '성공',
  failed: '실패',
  cancelled: '취소',
}

export type StageState = 'done' | 'active' | 'pending' | 'failed'
export interface StageProgress {
  stage: JobStage
  label: string
  state: StageState
}

/** 종료 상태이면 폴링을 멈춘다. */
export function isTerminalJob(status: JobStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled'
}

/** 응답이 `current_stage` 또는 `stage` 중 어느 이름을 쓰든 현재 단계를 읽는다. */
export function currentStageOf(job: Pick<Job, 'current_stage' | 'stage' | 'failure' | 'status'>): JobStage | undefined {
  if (job.status === 'failed' && job.failure?.stage) return job.failure.stage
  return job.current_stage ?? job.stage
}

/**
 * 단계별 표시 상태.
 * - queued: 전부 pending
 * - running: 현재 단계 active, 이전 done, 이후 pending (단계를 모르면 첫 단계 active)
 * - succeeded: 전부 done
 * - failed: 실패 단계 failed, 이전 done, 이후 pending (단계를 모르면 전부 pending — 성공처럼 보이지 않게)
 * - cancelled: 이전 done, 나머지 pending
 */
export function stageProgress(job: Pick<Job, 'current_stage' | 'stage' | 'failure' | 'status'>): StageProgress[] {
  const current = currentStageOf(job)
  const currentIndex = current === undefined ? -1 : JOB_STAGES.indexOf(current)
  return JOB_STAGES.map((stage, i) => {
    let state: StageState = 'pending'
    switch (job.status) {
      case 'queued':
        state = 'pending'
        break
      case 'succeeded':
        state = 'done'
        break
      case 'running': {
        const active = currentIndex === -1 ? 0 : currentIndex
        state = i < active ? 'done' : i === active ? 'active' : 'pending'
        break
      }
      case 'failed':
        if (currentIndex === -1) state = 'pending'
        else state = i < currentIndex ? 'done' : i === currentIndex ? 'failed' : 'pending'
        break
      case 'cancelled':
        state = currentIndex !== -1 && i < currentIndex ? 'done' : 'pending'
        break
    }
    return { stage, label: STAGE_LABELS[stage], state }
  })
}

/** 실패 원인 분류의 한국어 표시. 모르는 코드는 그대로 보여준다. */
export const FAILURE_CODE_LABELS: Readonly<Record<string, string>> = {
  model_error: '모델 오류',
  schema_invalid: '스키마 불일치',
  reference_invalid: '참조 오류',
  timeout: '제한 시간 초과',
  cancelled: '취소됨',
  renderer_error: '렌더러 오류',
  internal: '내부 오류',
}

export function failureCodeLabel(code: string): string {
  return FAILURE_CODE_LABELS[code] ?? code
}
