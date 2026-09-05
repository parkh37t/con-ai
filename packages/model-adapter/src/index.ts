export * from './types.js'
import type { ModelAdapter } from './types.js'
/** 미구현 스텁 — 구현 에이전트가 교체한다. MODEL_ADAPTER=anthropic|fixture (기본 fixture) */
export function createAdapter(_env: NodeJS.ProcessEnv): ModelAdapter {
  throw new Error('createAdapter 미구현')
}
