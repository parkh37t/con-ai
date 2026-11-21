/**
 * renderScreen — ScreenSpec 하나에서 HTML 목업 + 우측 설명 모델 + element_index 를 만든다 (계약 §4).
 * 화면 배지와 설명 번호는 같은 Numbering(element_index)에서 만든다 (설계 §9).
 */
import { buildDescription } from './description.js'
import { buildNumbering, toElementIndex } from './element-index.js'
import { renderHtmlDocument } from './html.js'
import type { RenderInput, RenderOutput } from './types.js'

/** 렌더러 버전 — 산출물 재현성 기록용 (설계 §6 렌더러 버전). 출력 구조가 바뀌면 올린다. */
export const RENDERER_VERSION = 'con-ai-renderer/0.1.0'

export function renderScreen(input: RenderInput): RenderOutput {
  const numbering = buildNumbering(input.spec, input.profile)
  const element_index = toElementIndex(numbering)
  const description = buildDescription(input, numbering)
  const html = renderHtmlDocument({ input, numbering, description, element_index })
  return { html, description, element_index }
}
