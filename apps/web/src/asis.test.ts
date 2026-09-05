import { describe, expect, it } from 'vitest'
import {
  ASIS_SAMPLE_URL,
  asisFailureLabel,
  asisStatusLabel,
  asisStatusTone,
  isTerminalAsis,
  painPointCountOf,
  painPointStatusLabel,
  painPointStatusTone,
  severityLabel,
  severityTone,
  structureSummaryRows,
  validateAsisUrl,
} from './asis.js'
import type { AsisStructure } from './types.js'

describe('AS-IS 상태·심각도 표시', () => {
  it('상태 한국어 표시와 색', () => {
    expect(asisStatusLabel('queued')).toBe('대기')
    expect(asisStatusLabel('running')).toBe('실행 중')
    expect(asisStatusLabel('succeeded')).toBe('성공')
    expect(asisStatusLabel('failed')).toBe('실패')
    expect(asisStatusLabel('mystery')).toBe('mystery')
    expect(asisStatusTone('succeeded')).toBe('green')
    expect(asisStatusTone('failed')).toBe('red')
    expect(asisStatusTone('mystery')).toBe('gray')
  })

  it('종료 상태 판정 — succeeded·failed 만 폴링을 멈춘다', () => {
    expect(isTerminalAsis('queued')).toBe(false)
    expect(isTerminalAsis('running')).toBe(false)
    expect(isTerminalAsis('succeeded')).toBe(true)
    expect(isTerminalAsis('failed')).toBe(true)
  })

  it('심각도 — high 빨강, medium 주황, low 회색', () => {
    expect(severityLabel('high')).toBe('높음')
    expect(severityTone('high')).toBe('red')
    expect(severityTone('medium')).toBe('amber')
    expect(severityTone('low')).toBe('gray')
    expect(severityTone('??')).toBe('gray')
    expect(severityLabel('??')).toBe('??')
  })

  it('페인포인트 상태 — 제안/채택/거부', () => {
    expect(painPointStatusLabel('proposed')).toBe('제안')
    expect(painPointStatusLabel('adopted')).toBe('채택')
    expect(painPointStatusLabel('rejected')).toBe('거부')
    expect(painPointStatusTone('adopted')).toBe('green')
    expect(painPointStatusTone('proposed')).toBe('blue')
    expect(painPointStatusTone('rejected')).toBe('gray')
  })

  it('실패 코드 표시 — 계약의 네 코드와 모르는 코드', () => {
    expect(asisFailureLabel('navigation')).toBe('페이지 이동 실패')
    expect(asisFailureLabel('browser')).toBe('브라우저 실행 실패')
    expect(asisFailureLabel('draft')).toBe('페인포인트 초안 생성 실패')
    expect(asisFailureLabel('internal')).toBe('내부 오류')
    expect(asisFailureLabel('weird')).toBe('weird')
    expect(asisFailureLabel(undefined)).toBe('원인 미상')
  })
})

describe('painPointCountOf — 목록 요약의 페인포인트 수', () => {
  it('pain_point_count 숫자 / pain_points 숫자 / pain_points 배열을 모두 읽는다', () => {
    expect(painPointCountOf({ pain_point_count: 4 })).toBe(4)
    expect(painPointCountOf({ pain_points: 7 })).toBe(7)
    expect(painPointCountOf({ pain_points: [{}, {}, {}] })).toBe(3)
    expect(painPointCountOf({ pain_point_count: 2, pain_points: [{}] })).toBe(2)
  })
  it('알 수 없으면 null (0 으로 위장하지 않는다)', () => {
    expect(painPointCountOf({})).toBeNull()
    expect(painPointCountOf({ pain_point_count: Number.NaN })).toBeNull()
  })
})

describe('validateAsisUrl — http/https 만', () => {
  it('정상 URL 은 null', () => {
    expect(validateAsisUrl(ASIS_SAMPLE_URL)).toBeNull()
    expect(validateAsisUrl(' https://example.com/a?b=1 ')).toBeNull()
  })
  it('빈 값·비 http(s)·형식 오류는 한국어 오류 문구', () => {
    expect(validateAsisUrl('')).toContain('입력하세요')
    expect(validateAsisUrl('   ')).toContain('입력하세요')
    expect(validateAsisUrl('ftp://example.com')).toContain('http')
    expect(validateAsisUrl('javascript:alert(1)')).toContain('http')
    expect(validateAsisUrl('http://')).toContain('형식')
  })
})

describe('structureSummaryRows — 구조 요약 표', () => {
  const structure: AsisStructure = {
    title: '레거시 견적 포털',
    lang: 'ko',
    headings: [
      { level: 1, text: '견적' },
      { level: 2, text: '목록' },
    ],
    nav_links: [{ text: '홈', href: '/' }],
    forms: [
      { name: 'search', fields: [{ type: 'text', name: 'q' }, { type: 'select' }] },
      { fields: [{ type: 'checkbox', label: '동의' }] },
    ],
    buttons: ['확인', '전송', '버튼3'],
    counts: { links: 42, images: 5, images_without_alt: 2, tables: 1, fields_without_label: 3, iframes: 1 },
  }

  it('제목·counts 를 행으로 만든다 (레이블 없는 필드·alt 없는 이미지 포함)', () => {
    const rows = structureSummaryRows(structure)
    const byKey = new Map(rows.map((r) => [r.key, r]))
    expect(byKey.get('title')?.value).toBe('레거시 견적 포털')
    expect(byKey.get('lang')?.value).toBe('ko')
    expect(byKey.get('description')?.value).toBe('—')
    expect(byKey.get('headings')?.value).toBe('2')
    expect(byKey.get('nav_links')?.value).toBe('1')
    expect(byKey.get('forms')?.value).toBe('2')
    expect(byKey.get('fields')?.value).toBe('3')
    expect(byKey.get('fields_without_label')).toMatchObject({ label: '레이블 없는 필드 수', value: '3' })
    expect(byKey.get('images_without_alt')).toMatchObject({ label: 'alt 없는 이미지 수', value: '2' })
    expect(byKey.get('buttons')?.value).toBe('3')
    expect(byKey.get('links')?.value).toBe('42')
    expect(byKey.get('iframes')?.value).toBe('1')
  })

  it('구조가 없으면 빈 배열', () => {
    expect(structureSummaryRows(null)).toEqual([])
    expect(structureSummaryRows(undefined)).toEqual([])
  })
})
