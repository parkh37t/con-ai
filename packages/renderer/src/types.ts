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
/** GNB 메뉴 한 칸 (활성 메뉴는 밑줄로 표시한다). */
export interface RenderNavItem { label: string; active?: boolean }
export interface RenderMeta {
  screen_title: string
  requirements: Array<{ external_id: string; title: string; criterion_ids: string[] }>
  revision_label: string
  generated_by: string
  /** 목업 GNB 의 포털 이름. 없으면 spec.shell 접두어에서 만든다 (html.ts portalNameOf) */
  portal_name?: string
  /** 목업 GNB 메뉴. 없으면 화면명에서 기본 메뉴를 만든다 (html.ts menusOf) */
  menus?: RenderNavItem[]
  /** 브랜드 테마 id (theme.ts). 없거나 모르는 값이면 기본 테마 — 없는 브랜드를 지어내지 않는다. */
  theme_id?: string
}
export interface RenderInput { spec: ScreenSpecShape; profile: RenderProfile; dummy: Record<string, unknown[]>; meta: RenderMeta }
export interface RenderOutput { html: string; description: DescriptionModel; element_index: Array<{ element_id: string; section_id: string; display_no: string }> }
