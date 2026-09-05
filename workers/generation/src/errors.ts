/** 파이프라인·저장소 오류. API 는 code 로 HTTP 상태를 정한다. */
import { JobFailureCode, type JobStage } from '@con-ai/schemas'
import type { z } from 'zod'

export type PipelineFailureCode = z.infer<typeof JobFailureCode>

/** 파이프라인 단계 실패. job.failure 로 기록된다. */
export class PipelineError extends Error {
  override readonly name = 'PipelineError'
  readonly code: PipelineFailureCode
  readonly stage: JobStage | undefined
  readonly details: string[]

  constructor(code: PipelineFailureCode, message: string, options: { stage?: JobStage | undefined; details?: readonly string[] | undefined } = {}) {
    super(message)
    this.code = code
    this.stage = options.stage
    this.details = [...(options.details ?? [])]
  }
}

/** 오래된 revision 으로 저장하려 할 때 (계약 §1: 저장 시 revision 을 비교해 오래된 저장을 거부). */
export class StoreConflictError extends Error {
  override readonly name = 'StoreConflictError'
  readonly code = 'stale_revision' as const
  readonly kind: string
  readonly id: string
  readonly expected: number
  readonly current: number

  constructor(kind: string, id: string, expected: number, current: number) {
    super(`${kind}/${id}: revision 불일치 — 기대 ${expected}, 현재 ${current} (오래된 저장을 거부한다; 설계 §11)`)
    this.kind = kind
    this.id = id
    this.expected = expected
    this.current = current
  }
}
