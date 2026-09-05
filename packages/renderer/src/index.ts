export * from './types.js'
import type { RenderInput, RenderOutput, RenderProfile } from './types.js'
/** S2B 학습 규격 프로파일 — 구현 에이전트가 채운다. */
export const S2B_LEARNED_PROFILE: RenderProfile = {
  id: 's2b-learned-v1',
  name: 'S2B 학습 규격 v1',
  page_shell: { root: 'root-shell', screen: 'screen-wrap', panel: 'right-panel' },
  popup_shell: { root: 'popup-shell', screen: 'popup-wrap', panel: 'spec-side' },
  description_order: ['screen_id', 'overview', 'cases', 'flow', 'policy', 'data_mapping', 'sections', 'messages'],
  numbering: { section: 'number', element: 'alpha' },
  rules: [],
}
/** 미구현 스텁 — 구현 에이전트가 교체한다. */
export function renderScreen(_input: RenderInput): RenderOutput {
  throw new Error('renderScreen 미구현')
}
