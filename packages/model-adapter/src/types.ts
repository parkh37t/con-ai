/** 세로 조각 계약 §3 — 모델 어댑터 인터페이스. */
import type { GenerationOutputInput, ScreenSpecShape } from '@con-ai/schemas'
import type { AssembledPrompt, GenerationContext, SliceGenerationRequest } from '@con-ai/prompt-templates'

export type AdapterKind = 'anthropic' | 'fixture'
export interface AdapterResult {
  output: GenerationOutputInput
  raw_text?: string
  usage?: { input_tokens: number; output_tokens: number }
  stop_reason?: string
}
export interface ModelAdapter {
  readonly kind: AdapterKind
  readonly model: string
  generateSpec(input: { prompt: AssembledPrompt; ctx: GenerationContext; req: SliceGenerationRequest }): Promise<AdapterResult>
  reviseSpec(input: { prompt: AssembledPrompt; ctx: GenerationContext; req: SliceGenerationRequest; current: ScreenSpecShape }): Promise<AdapterResult>
  draftRevisionPrompt(input: { ctx: GenerationContext; current: ScreenSpecShape; comments: NonNullable<GenerationContext['comments']> }): Promise<{ prompt: string; rationale: string }>
}
