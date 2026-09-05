export * from './types.js'
import type { AssembledPrompt, GenerationContext, SliceGenerationRequest } from './types.js'
/** 미구현 스텁 — 구현 에이전트가 교체한다. */
export function assemblePrompt(_req: SliceGenerationRequest, _ctx: GenerationContext): AssembledPrompt {
  throw new Error('assemblePrompt 미구현')
}
export function assembleRevisionPrompt(_ctx: GenerationContext, _instruction: string): AssembledPrompt {
  throw new Error('assembleRevisionPrompt 미구현')
}
