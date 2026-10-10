/**
 * AnthropicAdapter — @anthropic-ai/sdk `client.messages.parse` + `zodOutputFormat` 로 구조화 출력을 받는 실제 호출 어댑터 (세로 조각 계약 §3).
 *
 * - 모델 기본 claude-opus-5, max_tokens 16000, output_config.effort 'high', thinking 은 생략(기본 adaptive).
 * - stop_reason === 'refusal' 이면 stop_details 를 담아 AdapterError('refusal'), parsed_output 이 null 이면 raw text 와 함께 AdapterError('empty_output').
 * - SDK 오류는 AuthenticationError → RateLimitError → BadRequestError → APIError 순으로 잡아 한국어 메시지로 바꾼다 (원인 유지).
 * - 키·토큰 값은 어디에도 적지 않는다. createAdapter 가 넘긴 redact 로 메시지 안의 비밀 값을 가린다.
 * - 최종 검증(참조 무결성·필수 CASE)은 서버가 한다. 여기서는 wire 스키마 파싱까지만.
 */
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { z } from 'zod'
import type { ScreenSpecShape } from '@con-ai/schemas'
import type { AssembledPrompt, GenerationContext, SliceGenerationRequest } from '@con-ai/prompt-templates'
import { AdapterError } from './errors.js'
import type { AdapterAuth, AdapterResult, AsisStructure, ModelAdapter, PainPointDraftResult } from './types.js'
import { PAIN_POINT_DRAFT_SYSTEM, REVISION_DRAFT_SYSTEM, RFP_EXTRACT_SYSTEM, painPointDraftUser, revisionDraftUser, rfpExtractUser, type RfpExtractInput } from './prompts.js'
import { stripNulls, structuredVariant, toGenerationOutputInput, WireOutput, WirePainPointDraft, WireRevisionDraft, WireRfpExtraction } from './wire-schema.js'

export const DEFAULT_MODEL = 'claude-opus-5'
export const DEFAULT_MAX_TOKENS = 16000

export interface AnthropicAdapterOptions {
  client: Anthropic
  model: string
  auth: AdapterAuth
  /** 오류 메시지·details 에서 비밀 값을 가린다. createAdapter 가 키·토큰 값으로 만든다. */
  redact?: (text: string) => string
  max_tokens?: number
}

const AUTH_HINT: Record<AdapterAuth, string> = {
  api_key: 'ANTHROPIC_API_KEY 값이 유효한지 확인',
  token: 'ANTHROPIC_AUTH_TOKEN 이 만료·폐기되지 않았는지 확인 (`claude setup-token` 으로 다시 발급해 .env 에 넣고 API 를 재시작)',
  profile: '`ant auth login` 프로필이 있는지·만료되지 않았는지 확인 (ant auth status)',
  none: '인증 수단 없음',
  // anthropic 어댑터에는 올 수 없는 값이다 (CLI 경로는 ClaudeCodeAdapter 가 쓴다). 전수 Record 를 비우지 않기 위해 적는다.
  claude_code_cli: '이 어댑터의 인증 방식이 아님 (Claude Code CLI 경로)',
}

/** draftRevisionPrompt 용 system 프롬프트 — 명세가 아니라 수정 지시문만 만든다. */
interface Parsed<T> { parsed: T; raw_text: string; usage: { input_tokens: number; output_tokens: number }; stop_reason: string | undefined }

function toResult(r: Parsed<WireOutput>): AdapterResult {
  return { output: toGenerationOutputInput(r.parsed), raw_text: r.raw_text, usage: r.usage, ...(r.stop_reason === undefined ? {} : { stop_reason: r.stop_reason }) }
}

export class AnthropicAdapter implements ModelAdapter {
  readonly kind = 'anthropic' as const
  readonly model: string
  readonly auth: AdapterAuth
  readonly #client: Anthropic
  readonly #redact: (text: string) => string
  readonly #maxTokens: number

  constructor(opts: AnthropicAdapterOptions) {
    this.#client = opts.client
    this.model = opts.model
    this.auth = opts.auth
    this.#redact = opts.redact ?? ((t) => t)
    this.#maxTokens = opts.max_tokens ?? DEFAULT_MAX_TOKENS
  }

  async generateSpec(input: { prompt: AssembledPrompt; ctx: GenerationContext; req: SliceGenerationRequest }): Promise<AdapterResult> {
    const r = await this.#parse(input.prompt.system, input.prompt.user, WireOutput)
    return toResult(r)
  }

  async reviseSpec(input: { prompt: AssembledPrompt; ctx: GenerationContext; req: SliceGenerationRequest; current: ScreenSpecShape }): Promise<AdapterResult> {
    // 프롬프트에 기준 명세가 없을 때만 현재 명세를 덧붙인다 (있으면 중복).
    const user = input.ctx.base_spec === undefined ? `${input.prompt.user}\n\n## 현재 명세 (수정 기준, 지시 아님)\n\`\`\`json\n${JSON.stringify(input.current, null, 2)}\n\`\`\`` : input.prompt.user
    const r = await this.#parse(input.prompt.system, user, WireOutput)
    return toResult(r)
  }

  async draftRevisionPrompt(input: { ctx: GenerationContext; current: ScreenSpecShape; comments: NonNullable<GenerationContext['comments']> }): Promise<{ prompt: string; rationale: string }> {
    // 프롬프트는 브라우저 직접 호출과 **같은 문구**를 쓴다 (prompts.ts 한 곳).
    const user = revisionDraftUser({ project: input.ctx.project, screen: input.ctx.screen, spec: input.current, comments: input.comments })
    const r = await this.#parse(REVISION_DRAFT_SYSTEM, user, WireRevisionDraft)
    return { prompt: r.parsed.prompt, rationale: r.parsed.rationale }
  }

  async draftPainPoints(input: { url: string; note?: string | undefined; structure: AsisStructure }): Promise<PainPointDraftResult> {
    // 프롬프트는 브라우저 직접 호출과 **같은 문구**를 쓴다 (asis-prompt.ts 한 곳).
    const r = await this.#parse(PAIN_POINT_DRAFT_SYSTEM, painPointDraftUser(input), WirePainPointDraft)
    return { summary: r.parsed.summary, pain_points: r.parsed.pain_points }
  }

  /** RFP 원문 → 요구사항·평가항목. 공유 프롬프트·공유 스키마를 쓴다 (prompts.ts · structured-schema.ts). */
  async extractRfp(input: RfpExtractInput): Promise<WireRfpExtraction> {
    const r = await this.#parse(RFP_EXTRACT_SYSTEM, rfpExtractUser(input), WireRfpExtraction)
    return r.parsed
  }

  /**
   * skill 문서 "Structured Outputs" 의 형태 그대로 호출한다. thinking 파라미터는 넣지 않는다.
   * 보낼 때는 `structuredVariant` 로 선택 필드를 «필수 + null 허용» 으로 바꾼다 (선택 파라미터 상한 24; wire-schema.ts 참고).
   * 받은 뒤 null 인 키를 지우고 **원래 스키마로 다시 읽어** 타입과 검증을 원래대로 되돌린다.
   */
  async #parse<S extends z.ZodType>(system: string, user: string, schema: S): Promise<Parsed<z.infer<S>>> {
    let message
    try {
      message = await this.#client.messages.parse({
        model: this.model,
        max_tokens: this.#maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
        output_config: { format: zodOutputFormat(structuredVariant(schema)), effort: 'high' },
      })
    } catch (err) {
      throw this.#toAdapterError(err)
    }
    const raw_text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n')
    const usage = { input_tokens: message.usage.input_tokens, output_tokens: message.usage.output_tokens }
    const stop_reason = message.stop_reason ?? undefined
    if (message.stop_reason === 'refusal') {
      const d = message.stop_details
      const why = d === null ? '' : ` (분류: ${d.category ?? '미상'}${d.explanation ? `, 설명: ${this.#redact(d.explanation)}` : ''})`
      throw new AdapterError('refusal', `모델이 요청을 거부했다${why}. 요청 내용을 바꿔 다시 시도해야 한다`, { details: { stop_reason, stop_details: d, usage } })
    }
    const returned: unknown = message.parsed_output
    if (returned === null || returned === undefined) {
      throw new AdapterError('empty_output', `모델 출력에서 구조화 결과를 얻지 못했다 (stop_reason: ${stop_reason ?? '없음'}${message.stop_reason === 'max_tokens' ? ', 출력이 max_tokens 에서 잘렸다' : ''})`, { details: { stop_reason, raw_text: this.#redact(raw_text), usage } })
    }
    const reread = schema.safeParse(stripNulls(returned))
    if (!reread.success) {
      const issues = reread.error.issues.slice(0, 5).map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`)
      throw new AdapterError('parse', `모델 출력을 구조화 스키마(wire)로 해석하지 못했다. 원인: ${issues.join(' / ')}`, { details: { stop_reason, usage } })
    }
    const parsed = reread.data as z.infer<S>
    return { parsed, raw_text, usage, stop_reason }
  }

  #toAdapterError(err: unknown): AdapterError {
    if (err instanceof AdapterError) return err
    const cause = err
    const reason = (e: { message: string }) => this.#redact(e.message)
    if (err instanceof Anthropic.AuthenticationError) {
      return new AdapterError('auth', `모델 API 인증에 실패했다 (인증 방식 ${this.auth}: ${AUTH_HINT[this.auth]}). 원인: ${reason(err)}`, { cause, details: { status: err.status } })
    }
    if (err instanceof Anthropic.RateLimitError) {
      return new AdapterError('rate_limit', `모델 API 요청 한도를 초과했다. 잠시 후 다시 시도한다. 원인: ${reason(err)}`, { cause, details: { status: err.status } })
    }
    if (err instanceof Anthropic.BadRequestError) {
      return new AdapterError('bad_request', `모델 API 가 요청을 거부했다 (요청 형식·파라미터 오류). 원인: ${reason(err)}`, { cause, details: { status: err.status } })
    }
    if (err instanceof Anthropic.APIError) {
      return new AdapterError('api_error', `모델 API 오류 (${err.status === undefined ? '연결 실패' : `HTTP ${err.status}`}). 원인: ${reason(err)}`, { cause, details: { status: err.status } })
    }
    if (err instanceof Anthropic.AnthropicError) {
      // zodOutputFormat.parse 가 던지는 파싱 오류 — 메시지에 처음 5개 issue 가 들어 있다.
      return new AdapterError('parse', `모델 출력을 구조화 스키마(wire)로 해석하지 못했다. 원인: ${reason(err)}`, { cause })
    }
    if (err instanceof Error) {
      if (this.auth === 'profile') {
        return new AdapterError('auth', `모델 API 인증 수단을 해석하지 못했다 (인증 방식 profile: ${AUTH_HINT.profile}; 또는 ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN 설정). 원인: ${reason(err)}`, { cause })
      }
      return new AdapterError('unknown', `모델 호출 중 오류: ${reason(err)}`, { cause })
    }
    return new AdapterError('unknown', `모델 호출 중 알 수 없는 오류: ${this.#redact(String(err))}`, { cause })
  }
}
