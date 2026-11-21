import { describe, expect, it } from 'vitest'
import { DEVICE_WIDTHS, describeTarget, highlightMessage, parseElementClick, setCaseMessage } from './preview-messages.js'

describe('parseElementClick — iframe → 부모 메시지 (계약 §4)', () => {
  it('정상 메시지를 읽는다', () => {
    expect(parseElementClick({ type: 'con-ai:element-click', element_id: 'query', section_id: 'search', case_id: 'normal', target: 'description', display_no: 'a' })).toEqual({
      element_id: 'query',
      section_id: 'search',
      case_id: 'normal',
      target: 'description',
      display_no: 'a',
    })
  })

  it('target 이 없거나 이상하면 screen 으로, 빠진 문자열 필드는 빈 문자열로 채운다', () => {
    expect(parseElementClick({ type: 'con-ai:element-click', element_id: 'table' })).toEqual({ element_id: 'table', section_id: '', case_id: '', target: 'screen', display_no: '' })
    expect(parseElementClick({ type: 'con-ai:element-click', section_id: 'results', target: 'popup', display_no: 2 })).toEqual({
      element_id: '',
      section_id: 'results',
      case_id: '',
      target: 'screen',
      display_no: '2',
    })
  })

  it('다른 type·비객체·요소 정보가 전혀 없는 메시지는 null', () => {
    expect(parseElementClick({ type: 'con-ai:set-case', case_id: 'x' })).toBeNull()
    expect(parseElementClick('con-ai:element-click')).toBeNull()
    expect(parseElementClick(null)).toBeNull()
    expect(parseElementClick(undefined)).toBeNull()
    expect(parseElementClick({ type: 'con-ai:element-click' })).toBeNull()
    expect(parseElementClick({ type: 'con-ai:element-click', element_id: { evil: true } })).toBeNull()
  })
})

describe('부모 → iframe 메시지', () => {
  it('set-case / highlight 형태', () => {
    expect(setCaseMessage('empty')).toEqual({ type: 'con-ai:set-case', case_id: 'empty' })
    expect(highlightMessage('search.query')).toEqual({ type: 'con-ai:highlight', element_id: 'search.query' })
  })

  it('기기 폭은 PC 1280 / 모바일 420', () => {
    expect(DEVICE_WIDTHS).toEqual({ desktop: 1280, mobile: 420 })
  })
})

describe('describeTarget — 코멘트 대상 표시', () => {
  it('영역·요소·번호·CASE 를 합친다', () => {
    expect(describeTarget({ target: 'screen', section_id: 'search', element_id: 'query', display_no: 'a', case_id: 'empty' })).toBe('화면 · search › query (a) · CASE empty')
    expect(describeTarget({ target: 'description', element_id: 'query', section_id: '', display_no: '', case_id: '' })).toBe('설명 · query')
    expect(describeTarget(null)).toBe('대상 없음 (화면 전체)')
  })
})
