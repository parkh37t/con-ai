/**
 * AS-IS 페인포인트 초안을 **내 자격 증명으로** 브라우저에서 직접 만든다 (서버 없음).
 *
 * 왜 필요했나: 정적 배포에서 페인포인트 초안은 자격 증명이 있어도 **항상 더미 어댑터**였다.
 * 그래서 `#/asis` 와 `#/prototype` ① 단계만 토큰을 쓰지 못했다. 이 파일이 그 구멍을 메운다.
 *
 * 그대로 남는 제약: **브라우저는 다른 사이트를 캡처할 수 없다.** 구조 요약(structure)·스크린샷은
 * 미리 녹화해 둔 샘플 대상의 것을 쓰고, 모델은 그 structure 를 **자료로** 읽어 초안만 만든다.
 * 임의 URL 은 여전히 정직하게 실패한다 (`demo-api.ts` advanceAsis).
 *
 * 프롬프트와 구조화 출력 스키마는 서버 어댑터와 **같은 한 벌**이다:
 * `packages/model-adapter/src/prompts.ts` · `structured-schema.ts` (생성물).
 */
import { PAIN_POINT_DRAFT_JSON_SCHEMA, callAnthropic, BrowserModelError, DEFAULT_BROWSER_MODEL, type FetchLike } from './anthropic.js'
import { PAIN_POINT_DRAFT_SYSTEM, WirePainPointDraft, painPointDraftUser, stripNulls, type AsisStructure, type PainPointDraftResult } from './deps.js'
import type { StoredCredential } from './credential.js'

/** 서버와 같은 문구를 쓰는지 테스트가 확인한다 (structured-schema.test.ts). */
export { PAIN_POINT_DRAFT_SYSTEM }

export interface BrowserPainPointInput {
  credential: StoredCredential
  url: string
  note?: string | undefined
  structure: AsisStructure
  model?: string | undefined
}

/**
 * 모델이 낸 초안을 **스키마로 검증**한 뒤 돌려준다.
 * 구조화 출력은 `enum` 을 설명으로 밀어내므로 severity 같은 값은 API 가 강제하지 않는다 —
 * 모델 판단에 맡기지 않고 여기서 다시 읽는다 (CLAUDE.md: AI 출력은 스키마로 검증한다).
 */
export async function draftPainPointsInBrowser(input: BrowserPainPointInput, deps: { fetch?: FetchLike | undefined } = {}): Promise<PainPointDraftResult> {
  const call = await callAnthropic<unknown>(
    {
      credential: input.credential,
      system: PAIN_POINT_DRAFT_SYSTEM,
      user: painPointDraftUser({ url: input.url, structure: input.structure, ...(input.note === undefined ? {} : { note: input.note }) }),
      schema: PAIN_POINT_DRAFT_JSON_SCHEMA,
      model: input.model ?? DEFAULT_BROWSER_MODEL,
    },
    { fetch: deps.fetch },
  )
  const parsed = WirePainPointDraft.safeParse(stripNulls(call.output))
  if (!parsed.success) {
    throw new BrowserModelError('parse', '모델이 낸 페인포인트 초안이 스키마에 맞지 않습니다.', {
      details: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    })
  }
  if (parsed.data.pain_points.length === 0) {
    throw new BrowserModelError('empty_output', '모델이 페인포인트를 하나도 내지 않았습니다.')
  }
  return { summary: parsed.data.summary, pain_points: parsed.data.pain_points }
}
