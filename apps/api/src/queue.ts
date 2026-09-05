/**
 * 작업 큐 — API 프로세스 안의 메모리 순차 큐 (계약 §7·§12). enqueue(id, kind) 하면 실행 중이 아닐 때 즉시 실행을 시작한다.
 * kind 'generation'(기본)은 runGenerationJob, 'asis' 는 주입된 runAsis(AS-IS 분석 러너)를 부른다 — 두 종류가 같은 큐를 순차로 쓴다.
 * 상태는 모두 DB(job / asis_analysis 문서)에 있으므로 새로고침 후에도 GET API 로 읽는다.
 * 서버 재시작 시 queued/running 으로 남은 작업·분석은 recoverInterruptedJobs / recoverInterruptedAsisAnalyses 가
 * failed(internal) 로 정리한다 — 메모리 큐는 복원하지 않는다.
 */
import { runGenerationJob, type JobDocument, type PipelineDeps, type Store } from '@con-ai/worker-generation'
import { markAsisFailedIfUnfinished } from './asis-runner.js'

/** 큐에 넣는 작업 종류 (계약 §12: asis 실행은 생성 작업과 같은 순차 큐를 쓴다). */
export type QueueJobKind = 'generation' | 'asis'

interface QueueEntry {
  id: string
  kind: QueueJobKind
}

export interface JobQueueOptions {
  deps: PipelineDeps
  /** AS-IS 분석 실행 함수 (계약 §12). enqueue(id, 'asis') 를 쓰려면 주입해야 한다. */
  runAsis?: ((analysisId: string) => Promise<void>) | undefined
  /** 파이프라인·러너가 예외로 끝났을 때(정상 실패는 문서 failure 로 기록되므로 여기 오지 않는다) 호출. */
  onError?: ((jobId: string, err: unknown) => void) | undefined
}

export class JobQueue {
  private readonly pending: QueueEntry[] = []
  private running = false
  private idleWaiters: Array<() => void> = []
  private readonly deps: PipelineDeps
  private readonly runAsis: ((analysisId: string) => Promise<void>) | undefined
  private readonly onError: (jobId: string, err: unknown) => void

  constructor(options: JobQueueOptions) {
    this.deps = options.deps
    this.runAsis = options.runAsis
    this.onError = options.onError ?? ((jobId, err) => console.error(`[queue] 작업 ${jobId} 실행 중 예외:`, err))
  }

  get size(): number {
    return this.pending.length + (this.running ? 1 : 0)
  }

  get isRunning(): boolean {
    return this.running
  }

  enqueue(jobId: string, kind: QueueJobKind = 'generation'): void {
    this.pending.push({ id: jobId, kind })
    if (!this.running) void this.drain()
  }

  /** 큐가 빌 때까지 기다린다 (테스트·종료용). */
  whenIdle(): Promise<void> {
    if (!this.running && this.pending.length === 0) return Promise.resolve()
    return new Promise((resolve) => this.idleWaiters.push(resolve))
  }

  private async drain(): Promise<void> {
    this.running = true
    try {
      while (this.pending.length > 0) {
        const entry = this.pending.shift()
        if (entry === undefined) break
        try {
          if (entry.kind === 'asis') {
            if (this.runAsis === undefined) throw new Error('asis 실행 함수(runAsis)가 주입되지 않았다')
            await this.runAsis(entry.id)
          } else {
            await runGenerationJob(entry.id, this.deps)
          }
        } catch (err) {
          this.onError(entry.id, err)
          const message = `실행 중 예외: ${err instanceof Error ? err.message : String(err)}`
          if (entry.kind === 'asis') markAsisFailedIfUnfinished(this.deps.store, entry.id, this.deps.now(), message)
          else markFailedIfUnfinished(this.deps.store, entry.id, this.deps.now(), message)
        }
      }
    } finally {
      this.running = false
      const waiters = this.idleWaiters
      this.idleWaiters = []
      for (const w of waiters) w()
    }
  }
}

/** 파이프라인 밖에서 예외가 났는데 작업이 아직 종료 상태가 아니면 failed(internal) 로 닫는다. */
function markFailedIfUnfinished(store: Store, jobId: string, at: string, message: string): void {
  const doc = store.get<JobDocument>('job', jobId)
  if (!doc) return
  if (doc.data.status !== 'queued' && doc.data.status !== 'running') return
  store.put<JobDocument>('job', jobId, { ...doc.data, status: 'failed', finished_at: at, failure: { code: 'internal', message, stage: doc.data.stage ?? 'context_build', details: [] } }, doc.revision)
}

/** 서버 시작 시: queued/running 으로 남은 작업을 failed(internal, "서버 재시작으로 중단") 로 정리한다. 정리한 작업 id 목록을 돌려준다. */
export function recoverInterruptedJobs(store: Store, now: () => string): string[] {
  const interrupted = store.list<JobDocument>('job', (d) => d.data.status === 'queued' || d.data.status === 'running')
  const at = now()
  const ids: string[] = []
  for (const doc of interrupted) {
    const failure: JobDocument['failure'] = { code: 'internal', message: '서버 재시작으로 중단', details: [] }
    if (doc.data.stage) failure.stage = doc.data.stage
    store.put<JobDocument>('job', doc.id, { ...doc.data, status: 'failed', finished_at: at, failure }, doc.revision)
    ids.push(doc.id)
  }
  return ids
}
