import { describe, expect, it } from 'vitest'
import { filterScreensByStage, STAGE_NAV, stageCounts, stageFilterLabel, stageValueText } from './project-nav.js'
import type { AsisAnalysisSummary, ScreenSummary } from './types.js'

function screen(over: Partial<ScreenSummary>): ScreenSummary {
  return { id: 'x', external_id: 'X', title: '화면', status: 'draft', revision_count: 0, open_comments: 0, ...over }
}

describe('stageCounts', () => {
  it('아직 읽지 못한 목록은 0 이 아니라 «—» 로 구분한다', () => {
    const counts = stageCounts({ screens: null, analyses: null })
    expect(counts.screens.value).toBeNull()
    expect(counts.review.value).toBeNull()
    expect(stageValueText(counts.screens)).toBe('—') // 세지 않은 것을 0건으로 단정하지 않는다
  })

  it('빈 목록은 0 으로 센다 (읽었는데 없는 것과 못 읽은 것은 다르다)', () => {
    const counts = stageCounts({ screens: [], analyses: [] })
    expect(counts.screens.value).toBe(0)
    expect(stageValueText(counts.screens)).toBe('0')
  })

  it('화면 상태별로 검토 중·완료를 세고 revision·열린 코멘트를 덧붙인다', () => {
    const screens = [
      screen({ id: 'a', status: 'draft', revision_count: 1 }),
      screen({ id: 'b', status: 'review', revision_count: 3, open_comments: 2 }),
      screen({ id: 'c', status: 'review', revision_count: 2, open_comments: 1 }),
      screen({ id: 'd', status: 'approved', revision_count: 4 }),
    ]
    const counts = stageCounts({ screens, analyses: [] })
    expect(counts.screens.value).toBe(4)
    expect(counts.screens.note).toBe('개 · revision 10')
    expect(counts.review.value).toBe(2)
    expect(counts.review.note).toBe('화면 · 열린 코멘트 3')
    expect(counts.done.value).toBe(1)
  })

  it('열린 코멘트는 검토 중인 화면 것만 센다 (완료된 화면의 코멘트를 섞지 않는다)', () => {
    const screens = [screen({ id: 'b', status: 'review', open_comments: 2 }), screen({ id: 'd', status: 'approved', open_comments: 9 })]
    expect(stageCounts({ screens, analyses: [] }).review.note).toBe('화면 · 열린 코멘트 2')
  })

  it('AS-IS 는 분석 건수를 세고, 채택 수를 넘기면 함께 적는다', () => {
    const analyses = [{ id: '1' }, { id: '2' }] as unknown as AsisAnalysisSummary[]
    expect(stageCounts({ screens: [], analyses }).asis).toEqual({ value: 2, note: '건' })
    expect(stageCounts({ screens: [], analyses, adoptedPainPoints: 5 }).asis).toEqual({ value: 2, note: '건 · 채택 5' })
  })
})

describe('STAGE_NAV', () => {
  it('4단계 프로세스의 번호·순서를 그대로 쓴다', () => {
    expect(STAGE_NAV.map((s) => s.no)).toEqual([1, 2, 3, 4])
    expect(STAGE_NAV.map((s) => s.key)).toEqual(['asis', 'screens', 'review', 'done'])
  })
})

describe('filterScreensByStage', () => {
  const screens = [screen({ id: 'a', status: 'draft' }), screen({ id: 'b', status: 'review' }), screen({ id: 'c', status: 'approved' })]

  it('검토·완료로 좁힌다', () => {
    expect(filterScreensByStage(screens, 'review').map((s) => s.id)).toEqual(['b'])
    expect(filterScreensByStage(screens, 'done').map((s) => s.id)).toEqual(['c'])
  })

  it('알 수 없는 값이나 없는 값이면 전체를 준다 (임의로 비우지 않는다)', () => {
    expect(filterScreensByStage(screens, undefined)).toHaveLength(3)
    expect(filterScreensByStage(screens, 'screens')).toHaveLength(3)
    expect(filterScreensByStage(screens, '이상한값')).toHaveLength(3)
  })
})

describe('stageFilterLabel', () => {
  it('좁혔을 때만 안내 문구를 준다', () => {
    expect(stageFilterLabel('review')).toBe('검토 중')
    expect(stageFilterLabel('done')).toBe('완료(v1.0)')
    expect(stageFilterLabel(undefined)).toBeNull()
    expect(stageFilterLabel('screens')).toBeNull()
  })
})
