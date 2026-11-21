/**
 * RFP 화면의 순수 함수 — 화면이 **사실만 적는지** 확인한다.
 *
 * 특히: 체크리스트 각주가 빈 축을 「세지 못함」으로 적는지, 모두 덮였을 때 **없는 문제를 만들지 않는지**,
 * 채택 버튼이 사유·행위자·선택·상태를 모두 보는지 (서버도 같은 검사를 한다).
 */
import { describe, expect, it } from 'vitest'
import type { RfpAnalysis, RfpNfrGap } from './types.js'
import { adoptedIds, canAdopt, isTerminalRfp, nfrGapNote, rfpFailureText, rfpSummaryLine, shortQuote } from './rfp-view.js'

const AXES: RfpNfrGap['axis'][] = ['performance', 'availability', 'security', 'accessibility', 'compatibility', 'audit']
const gaps = (covered: readonly RfpNfrGap['axis'][]): RfpNfrGap[] =>
  AXES.map((axis) => ({ axis, status: covered.includes(axis) ? 'covered' : 'missing', found: covered.includes(axis) ? ['X-NFR-001'] : [] }))

function analysis(over: Partial<RfpAnalysis> = {}): RfpAnalysis {
  return {
    id: 'a1',
    project_id: 'p1',
    project_code: 'SMP',
    source_name: 'RFP',
    source_hash: '00000000',
    source_chars: 1234,
    status: 'succeeded',
    adapter: 'claude_code',
    model: 'claude-opus-5',
    created_at: '2026-10-10T00:00:00.000Z',
    evaluation_items: [],
    requirements: [],
    whitespace_matches: 0,
    rejected: [],
    nfr_gaps: gaps([]),
    unresolved: [],
    adoptions: [],
    revision: 1,
    ...over,
  }
}

describe('isTerminalRfp', () => {
  it('완료·실패만 종료다 (폴링을 멈출 기준)', () => {
    expect(isTerminalRfp('succeeded')).toBe(true)
    expect(isTerminalRfp('failed')).toBe(true)
    expect(isTerminalRfp('queued')).toBe(false)
    expect(isTerminalRfp('running')).toBe(false)
  })
})

describe('nfrGapNote — 빈 축을 「없음」이 아니라 「세지 못함」으로 적는다', () => {
  it('빈 축이 있으면 축 이름과 함께 적는다', () => {
    const note = nfrGapNote(gaps(['performance', 'security'])) ?? ''
    expect(note).toContain('4축')
    expect(note).toContain('가용성')
    expect(note).toContain('감리')
    expect(note).toContain('세지 못함')
    // 덮인 축을 빠뜨린 것처럼 적지 않는다
    expect(note).not.toContain('성능')
  })

  it('모두 덮였으면 각주를 적지 않는다 (없는 문제를 만들지 않는다)', () => {
    expect(nfrGapNote(gaps(AXES))).toBeNull()
  })

  it('판정이 아예 없으면(분석 실패) 각주도 없다', () => {
    expect(nfrGapNote([])).toBeNull()
  })
})

describe('rfpFailureText — 실패 코드마다 할 일을 적는다', () => {
  it('로그인·한도·시간 초과를 구분해 안내한다', () => {
    expect(rfpFailureText({ code: 'auth', message: 'cli' })).toContain('`claude` 로 로그인')
    expect(rfpFailureText({ code: 'limit', message: 'x' })).toContain('한도')
    expect(rfpFailureText({ code: 'timeout', message: 'x' })).toContain('나눠 넣어')
    expect(rfpFailureText({ code: 'extract', message: 'x' })).toContain('텍스트로 붙여넣어야')
  })

  it('모르는 코드는 그대로 보여준다 (코드를 늘려도 표시가 깨지지 않는다)', () => {
    expect(rfpFailureText({ code: 'brand_new', message: '새 오류' })).toBe('brand_new: 새 오류')
  })

  it('실패가 없으면 null 이다', () => {
    expect(rfpFailureText(undefined)).toBeNull()
  })
})

describe('rfpSummaryLine — 숫자만 적고 추론하지 않는다', () => {
  it('원문 길이·후보·평가항목·채택을 적는다', () => {
    const line = rfpSummaryLine(analysis({ requirements: [], evaluation_items: [], source_chars: 1234 }))
    expect(line).toContain('원문 1,234자')
    expect(line).toContain('요구사항 후보 0건')
    expect(line).toContain('채택 0건')
  })

  it('거부·공백 인용은 **있을 때만** 적는다', () => {
    const clean = rfpSummaryLine(analysis())
    expect(clean).not.toContain('거부')
    expect(clean).not.toContain('공백')
    const dirty = rfpSummaryLine(
      analysis({ rejected: [{ reason: 'quote_not_found', kind: 'FR', title: 'x', quote: 'y' }], whitespace_matches: 2 }),
    )
    expect(dirty).toContain('인용 검사 거부 1건')
    expect(dirty).toContain('공백만 다른 인용 2건')
  })
})

describe('canAdopt — 서버와 같은 검사를 화면이 먼저 한다', () => {
  const base = { by: '기획자', reason: '1차 범위', selected: new Set(['SMP-FR-001']), busy: false, status: 'succeeded' as const }
  it('행위자·사유·선택·완료 상태가 모두 있어야 누를 수 있다', () => {
    expect(canAdopt(base)).toBe(true)
    expect(canAdopt({ ...base, by: '  ' })).toBe(false)
    expect(canAdopt({ ...base, reason: '' })).toBe(false)
    expect(canAdopt({ ...base, selected: new Set() })).toBe(false)
    expect(canAdopt({ ...base, busy: true })).toBe(false)
    expect(canAdopt({ ...base, status: 'running' })).toBe(false)
    expect(canAdopt({ ...base, status: 'failed' })).toBe(false)
  })
})

describe('adoptedIds', () => {
  it('채택된 외부 ID 를 집합으로 준다 (중복 채택을 막는 기준)', () => {
    const set = adoptedIds(analysis({ adoptions: [{ external_id: 'SMP-FR-001', requirement_id: 'r1', by: 'x', reason: 'y', at: '2026-10-10T00:00:00.000Z' }] }))
    expect(set.has('SMP-FR-001')).toBe(true)
    expect(set.has('SMP-FR-002')).toBe(false)
  })
})

describe('shortQuote', () => {
  it('공백을 줄이고 길면 자른다 (전체는 title 속성으로 본다)', () => {
    expect(shortQuote('가\n나  다')).toBe('가 나 다')
    const long = '가'.repeat(100)
    expect(shortQuote(long, 10)).toBe(`${'가'.repeat(9)}…`)
  })
})
