/** 세로 조각 계약 §3 — 모델 어댑터 인터페이스. */
import type { GenerationOutputInput, ScreenSpecShape } from '@con-ai/schemas'
import type { AssembledPrompt, GenerationContext, SliceGenerationRequest } from '@con-ai/prompt-templates'

export type AdapterKind = 'anthropic' | 'fixture'
/**
 * 인증 방식 (anthropic 어댑터): api_key=ANTHROPIC_API_KEY(x-api-key), token=ANTHROPIC_AUTH_TOKEN(Authorization: Bearer + oauth beta 헤더),
 * profile=`ant auth login` 프로필(SDK 기본 해석). fixture 는 none. 값(키·토큰)은 절대 노출·로그하지 않는다.
 */
export type AdapterAuth = 'api_key' | 'token' | 'profile' | 'none'
export interface AdapterResult {
  output: GenerationOutputInput
  raw_text?: string
  usage?: { input_tokens: number; output_tokens: number }
  stop_reason?: string
}
export interface ModelAdapter {
  readonly kind: AdapterKind
  readonly model: string
  readonly auth: AdapterAuth
  generateSpec(input: { prompt: AssembledPrompt; ctx: GenerationContext; req: SliceGenerationRequest }): Promise<AdapterResult>
  reviseSpec(input: { prompt: AssembledPrompt; ctx: GenerationContext; req: SliceGenerationRequest; current: ScreenSpecShape }): Promise<AdapterResult>
  draftRevisionPrompt(input: { ctx: GenerationContext; current: ScreenSpecShape; comments: NonNullable<GenerationContext['comments']> }): Promise<{ prompt: string; rationale: string }>
}
