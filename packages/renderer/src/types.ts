/** 세로 조각 계약 §4 — 렌더러 입력·출력·프로파일. */
import type { ScreenSpecShape } from '@con-ai/schemas'

export interface RenderProfile {
  id: string
  name: string
  page_shell: { root: string; screen: string; panel: string }      // 예: .root-shell / .screen-wrap / #right-panel
  popup_shell: { root: string; screen: string; panel: string }     // 예: .popup-shell / .popup-wrap / .spec-side
  description_order: string[]                                      // 설명 절 순서 (설계 §9)
  numbering: { section: 'number'; element: 'alpha' }               // 영역 1,2,3 / 요소 a,b,c (영역마다 반복)
  rules: string[]                                                  // 프롬프트에 넣을 규격 요약 문장
}
export interface DescriptionSection { key: string; title: string; items: Array<{ label: string; text: string; element_id?: string; display_no?: string }> }
export interface DescriptionModel { screen_id: string; title: string; sections: DescriptionSection[] }
export interface RenderMeta {
  screen_title: string
  requirements: Array<{ external_id: string; title: string; criterion_ids: string[] }>
  revision_label: string
  generated_by: string
}
export interface RenderInput { spec: ScreenSpecShape; profile: RenderProfile; dummy: Record<string, unknown[]>; meta: RenderMeta }
export interface RenderOutput { html: string; description: DescriptionModel; element_index: Array<{ element_id: string; section_id: string; display_no: string }> }
