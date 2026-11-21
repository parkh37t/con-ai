/**
 * 격리 iframe 과의 postMessage 프로토콜 (계약 §4).
 * iframe → 부모: `{type:'con-ai:element-click', element_id, section_id, case_id, target:'screen'|'description', display_no}`
 * 부모 → iframe: `{type:'con-ai:set-case', case_id}`, `{type:'con-ai:highlight', element_id}`
 * iframe 은 `sandbox="allow-scripts"`(같은 출처 아님)이므로 targetOrigin 은 '*' 이고, 수신은 `event.source` 로 iframe 창인지 확인한다.
 * 메시지 본문은 신뢰되지 않은 데이터로 취급해 형태만 읽는다.
 */
import type { CommentTarget, Device } from './types.js'

export const ELEMENT_CLICK_TYPE = 'con-ai:element-click'
export const SET_CASE_TYPE = 'con-ai:set-case'
export const HIGHLIGHT_TYPE = 'con-ai:highlight'

export interface ElementClick {
  element_id: string
  section_id: string
  case_id: string
  target: CommentTarget
  display_no: string
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : ''
}

/** 요소 클릭 메시지를 읽는다. 형태가 맞지 않으면 null. target 이 없거나 이상하면 'screen' 으로 본다. */
export function parseElementClick(data: unknown): ElementClick | null {
  if (typeof data !== 'object' || data === null) return null
  const d = data as Record<string, unknown>
  if (d['type'] !== ELEMENT_CLICK_TYPE) return null
  const element_id = str(d['element_id'])
  const section_id = str(d['section_id'])
  if (!element_id && !section_id) return null
  const target: CommentTarget = d['target'] === 'description' ? 'description' : 'screen'
  return { element_id, section_id, case_id: str(d['case_id']), target, display_no: str(d['display_no']) }
}

export function setCaseMessage(caseId: string): { type: typeof SET_CASE_TYPE; case_id: string } {
  return { type: SET_CASE_TYPE, case_id: caseId }
}

export function highlightMessage(elementId: string): { type: typeof HIGHLIGHT_TYPE; element_id: string } {
  return { type: HIGHLIGHT_TYPE, element_id: elementId }
}

/** 미리보기 폭 — PC 1280 / 모바일 420. */
export const DEVICE_WIDTHS: Readonly<Record<Device, number>> = { desktop: 1280, mobile: 420 }
export const DEVICE_LABELS: Readonly<Record<Device, string>> = { desktop: 'PC', mobile: '모바일' }

/** 코멘트 대상 표시 문자열 (예: "화면 · search.query (a) · CASE empty"). */
export function describeTarget(click: Partial<ElementClick> | null | undefined): string {
  if (!click) return '대상 없음 (화면 전체)'
  const parts: string[] = [click.target === 'description' ? '설명' : '화면']
  const id = [click.section_id, click.element_id].filter((s): s is string => Boolean(s)).join(' › ')
  if (id) parts.push(click.display_no ? `${id} (${click.display_no})` : id)
  if (click.case_id) parts.push(`CASE ${click.case_id}`)
  return parts.join(' · ')
}
