import { describe, expect, it } from 'vitest'
import {
  ASIS_SAMPLE_URL,
  asisDurationLabel,
  asisFailureLabel,
  asisSignalRows,
  asisStatusLabel,
  asisStatusTone,
  isTerminalAsis,
  filterPainPoints,
  painPointCountOf,
  painPointStatusLabel,
  painPointTally,
  painPointStatusTone,
  severityLabel,
  severityTone,
  structureSummaryRows,
  validateAsisUrl,
} from './asis.js'
import type { AsisStructure, PainPoint } from './types.js'

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

describe('asisSignalRows — 문제 있는 항목만 고른다', () => {
  const clean: AsisStructure = {
    title: '깨끗한 페이지',
    description: '서비스 한 줄 설명',
    lang: 'ko',
    headings: [{ level: 1, text: '제목' }],
    nav_links: [{ text: '홈', href: '/' }],
    forms: [],
    buttons: [],
    counts: { links: 5, images: 2, images_without_alt: 0, tables: 0, fields_without_label: 0, iframes: 0 },
  }

  it('정상값만 있으면 신호가 없다 (정상 항목을 신호로 올리지 않는다)', () => {
    expect(asisSignalRows(clean)).toEqual([])
  })

  it('레이블 없는 필드·alt 없는 이미지·iframe 은 0보다 클 때만 신호', () => {
    const rows = asisSignalRows({ ...clean, counts: { ...clean.counts, fields_without_label: 3, images_without_alt: 2, iframes: 1 } })
    const byKey = new Map(rows.map((r) => [r.key, r]))
    expect(byKey.get('fields_without_label')?.value).toBe('3개')
    expect(byKey.get('images_without_alt')?.value).toBe('2개')
    expect(byKey.get('iframes')?.value).toBe('1개')
    expect(byKey.get('h1_missing')).toBeUndefined()
    expect(byKey.get('description')).toBeUndefined()
  })

  it('h1 0건·내비 링크 15개 초과·meta description 없음', () => {
    const nav = Array.from({ length: 18 }, (_, i) => ({ text: `메뉴${i}`, href: `/${i}` }))
    const rows = asisSignalRows({ ...clean, description: '  ', headings: [{ level: 2, text: '소제목' }], nav_links: nav })
    const byKey = new Map(rows.map((r) => [r.key, r]))
    expect(byKey.get('h1_missing')?.value).toBe('0건')
    expect(byKey.get('nav_links')?.value).toBe('18개')
    expect(byKey.get('description')?.value).toBe('없음')
  })

  it('내비 링크가 기준(15) 이하면 신호가 아니다', () => {
    const nav = Array.from({ length: 15 }, (_, i) => ({ text: `메뉴${i}`, href: `/${i}` }))
    expect(asisSignalRows({ ...clean, nav_links: nav }).some((r) => r.key === 'nav_links')).toBe(false)
  })

  it('구조가 없으면 빈 배열', () => {
    expect(asisSignalRows(null)).toEqual([])
    expect(asisSignalRows(undefined)).toEqual([])
  })
})

describe('페인포인트 필터·집계', () => {
  const pp = (id: string, severity: PainPoint['severity'], status: PainPoint['status']): PainPoint => ({
    id,
    area: '입력 폼',
    severity,
    description: '설명',
    evidence: '근거',
    suggestion: '제안',
    status,
  })
  const list = [pp('PP-001', 'high', 'proposed'), pp('PP-002', 'medium', 'adopted'), pp('PP-003', 'low', 'rejected'), pp('PP-004', 'medium', 'proposed')]

  it('상태별 건수를 센다', () => {
    expect(painPointTally(list)).toEqual({ total: 4, proposed: 2, adopted: 1, rejected: 1 })
    expect(painPointTally([])).toEqual({ total: 0, proposed: 0, adopted: 0, rejected: 0 })
  })

  it("기본값('전체','전체')은 순서·건수를 그대로 둔다", () => {
    expect(filterPainPoints(list, 'all', 'all').map((p) => p.id)).toEqual(['PP-001', 'PP-002', 'PP-003', 'PP-004'])
  })

  it('심각도·상태 필터는 AND 로 걸린다', () => {
    expect(filterPainPoints(list, 'medium', 'all').map((p) => p.id)).toEqual(['PP-002', 'PP-004'])
    expect(filterPainPoints(list, 'all', 'proposed').map((p) => p.id)).toEqual(['PP-001', 'PP-004'])
    expect(filterPainPoints(list, 'medium', 'proposed').map((p) => p.id)).toEqual(['PP-004'])
    expect(filterPainPoints(list, 'high', 'rejected')).toEqual([])
  })
})

describe('asisDurationLabel — 소요 시간', () => {
  it('ms·초·분 단위로 표시한다', () => {
    expect(asisDurationLabel('2026-09-05T00:00:00.000Z', '2026-09-05T00:00:00.400Z')).toBe('400ms')
    expect(asisDurationLabel('2026-09-05T00:00:00.000Z', '2026-09-05T00:00:01.500Z')).toBe('1.5초')
    expect(asisDurationLabel('2026-09-05T00:00:00.000Z', '2026-09-05T00:01:30.000Z')).toBe('1분 30초')
  })
  it('값이 없거나 뒤집혔으면 null (0 으로 위장하지 않는다)', () => {
    expect(asisDurationLabel(undefined, '2026-09-05T00:00:01.000Z')).toBeNull()
    expect(asisDurationLabel('2026-09-05T00:00:01.000Z', undefined)).toBeNull()
    expect(asisDurationLabel('2026-09-05T00:00:02.000Z', '2026-09-05T00:00:01.000Z')).toBeNull()
    expect(asisDurationLabel('nope', '2026-09-05T00:00:01.000Z')).toBeNull()
  })
})
