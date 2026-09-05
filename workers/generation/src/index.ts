export * from './types.js'
import type { PipelineDeps } from './types.js'
/** 미구현 스텁 — 구현 에이전트가 교체한다. */
export async function runGenerationJob(_jobId: string, _deps: PipelineDeps): Promise<void> {
  throw new Error('runGenerationJob 미구현')
}
