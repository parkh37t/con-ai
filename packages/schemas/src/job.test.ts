import { describe, expect, it } from 'vitest'
import { Artifact, ArtifactStatus, GenerationJob, JobStatus } from './job.js'
import { issuePaths } from './test-utils.js'

const UUID = '11111111-1111-4111-8111-111111111111'
const HASH = 'd'.repeat(64)
const job = {
  id: UUID, project_id: UUID, job_type: 'create', idempotency_key: 'req-1', input_snapshot_hash: HASH, baseline_id: 'example-baseline-1',
  prompt_template_version: '0.1.0', model_id: 'example-model', attempt: 1, max_attempts: 3, timeout_ms: 60000, created_at: '2026-09-05T00:00:00Z',
}
const artifact = { id: UUID, project_id: UUID, kind: 'html', content_hash: HASH, generation_job_id: UUID, renderer_version: '0.1.0', created_at: '2026-09-05T00:00:00Z' }

describe('생성 작업·산출물 (설계 §11)', () => {
  it('작업 상태는 queued/running/succeeded/failed/cancelled 이다', () => {
    expect(JobStatus.options).toEqual(['queued', 'running', 'succeeded', 'failed', 'cancelled'])
    expect(JobStatus.safeParse('success').success).toBe(false)
  })

  it('큐 대기 작업은 idempotency key·입력 hash·제한 시간·취소 요청을 가진다', () => {
    const r = GenerationJob.safeParse({ ...job, status: 'queued' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.cancel_requested).toBe(false)
    expect(issuePaths(GenerationJob.safeParse({ ...job, status: 'queued', idempotency_key: undefined, timeout_ms: undefined }))).toEqual(expect.arrayContaining(['idempotency_key', 'timeout_ms']))
  })

  it('failed 작업은 실패 원인이, running 은 시작 시점이 필요하고 시도 횟수는 제한을 넘을 수 없다', () => {
    expect(issuePaths(GenerationJob.safeParse({ ...job, status: 'failed', finished_at: '2026-09-05T00:01:00Z' }))).toEqual(['failure'])
    expect(issuePaths(GenerationJob.safeParse({ ...job, status: 'running' }))).toEqual(['started_at'])
    expect(issuePaths(GenerationJob.safeParse({ ...job, status: 'queued', attempt: 4 }))).toEqual(['attempt'])
    const failed = GenerationJob.safeParse({ ...job, status: 'failed', finished_at: '2026-09-05T00:01:00Z', failure: { code: 'schema_invalid', message: 'actions.0.target 미정의', stage: 'schema_check' } })
    expect(failed.success).toBe(true)
  })

  it('산출물 상태는 draft/validation_pending/review_ready/approved/stale 이며 approved 는 승인 기록을 요구한다', () => {
    expect(ArtifactStatus.options).toEqual(['draft', 'validation_pending', 'review_ready', 'approved', 'stale'])
    expect(Artifact.safeParse({ ...artifact, status: 'draft' }).success).toBe(true)
    expect(issuePaths(Artifact.safeParse({ ...artifact, status: 'approved' }))).toEqual(['approval_id'])
    expect(issuePaths(Artifact.safeParse({ ...artifact, status: 'stale' }))).toEqual(['stale_reason'])
    expect(Artifact.safeParse({ ...artifact, status: 'approved', approval_id: UUID }).success).toBe(true)
  })
})
