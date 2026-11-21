/**
 * 번호 매기기 — 화면 배지와 설명 번호의 단일 원본 (설계 §9: 화면 숫자와 설명 숫자, 영역 내 a/b/c 표시는 동일 데이터에서 만든다).
 *
 * - 영역: spec 의 display_no 가 있으면 그대로, 없으면 순서대로 1, 2, 3.
 * - 요소: spec 의 display_no 가 있으면 그대로, 없으면 영역마다 a, b, c 부터 다시 시작 (영역마다 반복되는 a 는 전역 중복이 아니다).
 * - element_index 에는 영역과 요소를 모두 넣는다. 영역 항목은 element_id === section_id 다.
 */
import type { Element as SpecElement, Section as SpecSection, ScreenSpecShape } from '@con-ai/schemas'
import type { RenderOutput, RenderProfile } from './types.js'

export type ElementIndexEntry = RenderOutput['element_index'][number]

export interface NumberedElement {
  element: SpecElement
  section_id: string
  display_no: string
}

export interface NumberedSection {
  section: SpecSection
  display_no: string
  elements: NumberedElement[]
}

export interface NumberingEntry {
  kind: 'section' | 'element'
  section_id: string
  display_no: string
}

export interface Numbering {
  sections: NumberedSection[]
  /** 영역·요소 id → 번호 (참조 조회용) */
  by_id: Map<string, NumberingEntry>
}

/** 0 → a, 1 → b, …, 25 → z, 26 → aa. */
export function toAlpha(index: number): string {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(97 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

function sectionNo(section: SpecSection, index: number, profile: RenderProfile): string {
  if (section.display_no !== undefined && section.display_no.trim() !== '') return section.display_no.trim()
  return profile.numbering.section === 'number' ? String(index + 1) : toAlpha(index)
}

function elementNo(element: SpecElement, index: number, profile: RenderProfile): string {
  if (element.display_no !== undefined && element.display_no.trim() !== '') return element.display_no.trim()
  return profile.numbering.element === 'alpha' ? toAlpha(index) : String(index + 1)
}

/** 명세와 프로파일에서 번호를 만든다. 렌더러와 V2 검사가 같은 함수를 쓴다. */
export function buildNumbering(spec: ScreenSpecShape, profile: RenderProfile): Numbering {
  const by_id = new Map<string, NumberingEntry>()
  const sections = spec.sections.map((section, i): NumberedSection => {
    const display_no = sectionNo(section, i, profile)
    by_id.set(section.id, { kind: 'section', section_id: section.id, display_no })
    const elements = section.elements.map((element, j): NumberedElement => {
      const no = elementNo(element, j, profile)
      by_id.set(element.id, { kind: 'element', section_id: section.id, display_no: no })
      return { element, section_id: section.id, display_no: no }
    })
    return { section, display_no, elements }
  })
  return { sections, by_id }
}

/** 계약 §4 의 element_index — 영역 항목 뒤에 그 영역의 요소 항목이 온다. */
export function toElementIndex(numbering: Numbering): ElementIndexEntry[] {
  const out: ElementIndexEntry[] = []
  for (const s of numbering.sections) {
    out.push({ element_id: s.section.id, section_id: s.section.id, display_no: s.display_no })
    for (const e of s.elements) out.push({ element_id: e.element.id, section_id: e.section_id, display_no: e.display_no })
  }
  return out
}

export function buildElementIndex(spec: ScreenSpecShape, profile: RenderProfile): ElementIndexEntry[] {
  return toElementIndex(buildNumbering(spec, profile))
}
