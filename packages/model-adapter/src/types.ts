/** 세로 조각 계약 §3 — 모델 어댑터 인터페이스. */
import type { GenerationOutputInput, ScreenSpecShape } from '@con-ai/schemas'
import type { AssembledPrompt, GenerationContext, SliceGenerationRequest } from '@con-ai/prompt-templates'
import type { RfpExtractInput } from './prompts.js'
import type { WireRfpExtraction } from './wire-schema.js'

/**
 * 어댑터 종류. `claude_code` 는 **그 기계의 Claude Code CLI** 를 불러 쓰는 경로다 (claude-code-cli.ts).
 * 화면은 세 값을 **구분해 적는다** — 더미(fixture)와 실제를 섞어 보여주지 않는다 (CLAUDE.md).
 */
export type AdapterKind = 'anthropic' | 'fixture' | 'claude_code'
/**
 * 인증 방식 (anthropic 어댑터): api_key=ANTHROPIC_API_KEY(x-api-key), token=ANTHROPIC_AUTH_TOKEN(Authorization: Bearer + oauth beta 헤더),
 * profile=`ant auth login` 프로필(SDK 기본 해석). fixture 는 none. 값(키·토큰)은 절대 노출·로그하지 않는다.
 *
 * `claude_code_cli` 는 **우리가 자격 증명을 보지 않는다**는 뜻이다 — 인증은 그 기계의 Claude Code 로그인이 한다.
 */
export type AdapterAuth = 'api_key' | 'token' | 'profile' | 'none' | 'claude_code_cli'
export interface AdapterResult {
  output: GenerationOutputInput
  raw_text?: string
  usage?: { input_tokens: number; output_tokens: number }
  stop_reason?: string
}

/**
 * AS-IS 분석 structure (계약 §12) — 러너(apps/api)가 Playwright `page.evaluate` 로 대상 페이지에서 추출한다.
 * 각 목록(headings·nav_links·forms·buttons)은 상위 30 으로 절단된 상태다.
 */
export interface AsisStructure {
  title: string
  description?: string | undefined
  lang?: string | undefined
  /** h1~h3 (상위 30). */
  headings: Array<{ level: number; text: string }>
  /** nav 안의 링크 (상위 30). */
  nav_links: Array<{ text: string; href: string }>
  forms: Array<{ name?: string | undefined; fields: Array<{ type: string; label?: string | undefined; name?: string | undefined }> }>
  /** 버튼·submit 문구 (상위 30). */
  buttons: string[]
  counts: {
    links: number
    images: number
    images_without_alt: number
    tables: number
    fields_without_label: number
    iframes: number
  }
}

export type PainPointSeverity = 'high' | 'medium' | 'low'

/** 모델(또는 규칙)이 낸 페인포인트 초안 한 건. id(`PP-001`…)와 status('proposed')는 서버가 부여한다 (계약 §12). */
export interface PainPointDraft {
  area: string
  severity: PainPointSeverity
  description: string
  evidence: string
  suggestion: string
}

export interface PainPointDraftResult {
  /** 발견 요약 (한국어 2~3문장). */
  summary: string
  pain_points: PainPointDraft[]
}

export interface ModelAdapter {
  readonly kind: AdapterKind
  readonly model: string
  readonly auth: AdapterAuth
  generateSpec(input: { prompt: AssembledPrompt; ctx: GenerationContext; req: SliceGenerationRequest }): Promise<AdapterResult>
  reviseSpec(input: { prompt: AssembledPrompt; ctx: GenerationContext; req: SliceGenerationRequest; current: ScreenSpecShape }): Promise<AdapterResult>
  draftRevisionPrompt(input: { ctx: GenerationContext; current: ScreenSpecShape; comments: NonNullable<GenerationContext['comments']> }): Promise<{ prompt: string; rationale: string }>
  /** AS-IS 분석 페인포인트 초안 (계약 §12) — anthropic 은 구조화 출력, fixture 는 structure 규칙 기반 결정적. */
  draftPainPoints(input: { url: string; note?: string | undefined; structure: AsisStructure }): Promise<PainPointDraftResult>
  /**
   * RFP 원문 → 요구사항·평가항목 추출 (사내 BA 표준).
   *
   * 돌려주는 것은 **wire 모양**이고 아직 기준정보가 아니다 — 서버가 `checkRfpExtraction` 으로
   * 인용을 원문과 맞춰 보고 외부 ID 를 다시 계산한 뒤에야 사람이 채택할 수 있다.
   * fixture 는 규칙으로 뽑으므로 **인용을 지어낼 수 없다**.
   */
  extractRfp(input: RfpExtractInput): Promise<WireRfpExtraction>
}
