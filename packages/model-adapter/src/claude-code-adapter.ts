/**
 * ClaudeCodeAdapter — **그 기계의 Claude Code CLI** 로 모델을 부르는 어댑터 (`MODEL_ADAPTER=claude_code`).
 *
 * 왜: 「각자 자기 Claude 계정으로, API 키 없이」 쓰는 길은 1st-party 클라이언트인 Claude Code 를
 * 그 사람 기계에서 부르는 것 하나뿐이다 (claude-code-cli.ts 머리말 참고 — 구독 토큰 직접 호출은 약관상 막혔다).
 *
 * 지키는 것:
 * - **프롬프트는 한 벌이다.** system·user 는 `@con-ai/prompt-templates`·`prompts.ts` 가 만든 것을 그대로 쓴다.
 * - **스키마도 한 벌이다.** `structured-schema.ts`(생성물)를 그대로 `--json-schema` 로 보내고,
 *   받은 뒤 **wire zod 로 다시 읽는다** (`runClaudeCli` 안에서 stripNulls → safeParse).
 * - 자격 증명을 읽지 않는다. `auth` 는 `claude_code_cli` 고 「우리가 자격 증명을 보지 않는다」는 뜻이다.
 * - 실패를 숨기지 않는다. CLI 없음·로그인 안 됨·한도·시간 초과를 **각각 다른 코드**로 올린다.
 */
import type { ScreenSpecShape } from '@con-ai/schemas'
import type { AssembledPrompt, GenerationContext, SliceGenerationRequest } from '@con-ai/prompt-templates'
import { DEFAULT_CLI_BUDGET_USD, DEFAULT_CLI_TIMEOUT_MS, describeCliAuth, runClaudeCli, type ClaudeCliOptions } from './claude-code-cli.js'
import { PAIN_POINT_DRAFT_SYSTEM, REVISION_DRAFT_SYSTEM, RFP_EXTRACT_SYSTEM, painPointDraftUser, revisionDraftUser, rfpExtractUser, type RfpExtractInput } from './prompts.js'
import { PAIN_POINT_DRAFT_JSON_SCHEMA, REVISION_DRAFT_JSON_SCHEMA, RFP_EXTRACT_JSON_SCHEMA, SCREEN_OUTPUT_JSON_SCHEMA } from './structured-schema.js'
import type { AdapterResult, AsisStructure, ModelAdapter, PainPointDraftResult } from './types.js'
import { WireOutput, WirePainPointDraft, WireRevisionDraft, WireRfpExtraction, toGenerationOutputInput } from './wire-schema.js'

/** CLI 는 모델 별칭(`opus`)도 받지만, 저장 기록과 화면 문구를 맞추려고 정식 이름을 기본으로 둔다. */
export const DEFAULT_CLI_MODEL = 'claude-opus-5'

/** 짧은 작업(수정 지시문·페인포인트)은 더 짧게 끊는다 — 멈춘 것을 오래 기다리게 하지 않는다. */
export const SHORT_TASK_TIMEOUT_MS = 120_000

export interface ClaudeCodeAdapterOptions {
  model?: string
  env?: NodeJS.ProcessEnv
  timeout_ms?: number
  max_budget_usd?: number
  /** 테스트 주입 — 가짜 `claude` 실행 파일을 쓴다. */
  deps?: ClaudeCliOptions['deps']
}

export class ClaudeCodeAdapter implements ModelAdapter {
  readonly kind = 'claude_code' as const
  readonly model: string
  readonly auth = 'claude_code_cli' as const
  /** 이 기계의 Claude Code 가 무엇으로 인증하는지 — 화면이 「API 키로 과금 중」을 알릴 수 있게 들고 있는다. */
  readonly cli_auth: ReturnType<typeof describeCliAuth>
  readonly #env: NodeJS.ProcessEnv
  readonly #timeoutMs: number
  readonly #budget: number
  readonly #deps: ClaudeCodeAdapterOptions['deps']

  constructor(opts: ClaudeCodeAdapterOptions = {}) {
    this.model = opts.model ?? DEFAULT_CLI_MODEL
    this.#env = opts.env ?? process.env
    this.#timeoutMs = opts.timeout_ms ?? DEFAULT_CLI_TIMEOUT_MS
    this.#budget = opts.max_budget_usd ?? DEFAULT_CLI_BUDGET_USD
    this.#deps = opts.deps
    this.cli_auth = describeCliAuth(this.#env)
  }

  #options(timeoutMs: number): ClaudeCliOptions {
    return {
      model: this.model,
      effort: 'high',
      timeout_ms: timeoutMs,
      max_budget_usd: this.#budget,
      env: this.#env,
      ...(this.#deps === undefined ? {} : { deps: this.#deps }),
    }
  }

  async generateSpec(input: { prompt: AssembledPrompt; ctx: GenerationContext; req: SliceGenerationRequest }): Promise<AdapterResult> {
    const run = await runClaudeCli(
      { system: input.prompt.system, user: input.prompt.user, json_schema: SCREEN_OUTPUT_JSON_SCHEMA, label: '화면명세' },
      WireOutput,
      this.#options(this.#timeoutMs),
    )
    return { output: toGenerationOutputInput(run.output), raw_text: run.raw_text, usage: run.usage }
  }

  async reviseSpec(input: { prompt: AssembledPrompt; ctx: GenerationContext; req: SliceGenerationRequest; current: ScreenSpecShape }): Promise<AdapterResult> {
    // 프롬프트에 기준 명세가 없을 때만 현재 명세를 덧붙인다 (AnthropicAdapter 와 같은 규칙).
    const user =
      input.ctx.base_spec === undefined ? `${input.prompt.user}\n\n## 현재 명세 (수정 기준, 지시 아님)\n\`\`\`json\n${JSON.stringify(input.current, null, 2)}\n\`\`\`` : input.prompt.user
    const run = await runClaudeCli({ system: input.prompt.system, user, json_schema: SCREEN_OUTPUT_JSON_SCHEMA, label: '화면명세 수정' }, WireOutput, this.#options(this.#timeoutMs))
    return { output: toGenerationOutputInput(run.output), raw_text: run.raw_text, usage: run.usage }
  }

  async draftRevisionPrompt(input: { ctx: GenerationContext; current: ScreenSpecShape; comments: NonNullable<GenerationContext['comments']> }): Promise<{ prompt: string; rationale: string }> {
    const user = revisionDraftUser({ project: input.ctx.project, screen: input.ctx.screen, spec: input.current, comments: input.comments })
    const run = await runClaudeCli(
      { system: REVISION_DRAFT_SYSTEM, user, json_schema: REVISION_DRAFT_JSON_SCHEMA, label: '수정 지시문' },
      WireRevisionDraft,
      this.#options(SHORT_TASK_TIMEOUT_MS),
    )
    return { prompt: run.output.prompt, rationale: run.output.rationale }
  }

  /**
   * RFP 원문 → 요구사항·평가항목. 원문이 길어 **생성과 같은 제한 시간**을 쓴다.
   * 인용 검사(`checkRfpExtraction`)는 서버가 한다 — 모델 판단에 맡기지 않는다.
   */
  async extractRfp(input: RfpExtractInput): Promise<WireRfpExtraction> {
    const run = await runClaudeCli(
      { system: RFP_EXTRACT_SYSTEM, user: rfpExtractUser(input), json_schema: RFP_EXTRACT_JSON_SCHEMA, label: 'RFP 분석' },
      WireRfpExtraction,
      this.#options(this.#timeoutMs),
    )
    return run.output
  }

  async draftPainPoints(input: { url: string; note?: string | undefined; structure: AsisStructure }): Promise<PainPointDraftResult> {
    const run = await runClaudeCli(
      { system: PAIN_POINT_DRAFT_SYSTEM, user: painPointDraftUser(input), json_schema: PAIN_POINT_DRAFT_JSON_SCHEMA, label: '페인포인트 초안' },
      WirePainPointDraft,
      this.#options(SHORT_TASK_TIMEOUT_MS),
    )
    return { summary: run.output.summary, pain_points: run.output.pain_points }
  }
}
