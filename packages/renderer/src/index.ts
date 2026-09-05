/**
 * @con-ai/renderer — ScreenSpec → 오프라인 HTML 목업 + 우측 설명 (세로 조각 계약 §4).
 * 계약 export: renderScreen, S2B_LEARNED_PROFILE, RenderInput/RenderOutput/RenderProfile/DescriptionModel (types.ts).
 * 추가 export: buildElementIndex/buildNumbering(V2 검사가 같은 번호 규칙을 쓰기 위해), buildDescription, RENDERER_VERSION.
 */
export * from './types.js'
export { S2B_LEARNED_PROFILE } from './profile.js'
export { buildElementIndex, buildNumbering, toElementIndex, toAlpha, type ElementIndexEntry, type Numbering, type NumberedSection, type NumberedElement } from './element-index.js'
export { buildDescription, describeElement, DESCRIPTION_TITLES } from './description.js'
export { renderScreen, RENDERER_VERSION } from './render.js'
export { escapeHtml } from './html.js'
