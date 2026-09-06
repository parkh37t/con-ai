/**
 * 프로토타입 진행 규칙 — 순서를 건너뛰지 않고, 실행 결과가 실제로 있어야 «끝남» 이다.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryStorage } from './browser-run/test-helpers.js'
import {
  PROTOTYPE_COMMENTS,
  PROTOTYPE_SENTENCE_FALLBACK,
  PROTOTYPE_STEPS,
  clearRun,
  doneCount,
  isComplete,
  isStepDone,
  loadRun,
  nextStep,
  progressText,
  prototypeSentence,
  runKey,
  saveRun,
  setPrototypeStorage,
  stepStatus,
  type PrototypeRun,
} from './prototype.js'

const AFTER_ASIS: PrototypeRun = { analysis_id: 'a1', pain_point_count: 8 }
const AFTER_GENERATE: PrototypeRun = { ...AFTER_ASIS, screen_id: 's1', screen_external_id: 'SCREEN-001', revision1_id: 'r1' }
const AFTER_REVIEW: PrototypeRun = { ...AFTER_GENERATE, comment_ids: ['c1', 'c2'], revision2_id: 'r2' }
const AFTER_APPROVE: PrototypeRun = { ...AFTER_REVIEW, approved_version: '1.0', export_file_count: 6 }

const P1 = 'a1000000-0000-4000-8000-000000000001'
const P2 = 'b1000000-0000-4000-8000-000000000001'

let memory = new MemoryStorage()
beforeEach(() => {
  memory = new MemoryStorage()
  setPrototypeStorage(() => memory)
})
afterEach(() => {
  clearRun(P1)
  clearRun(P2)
  setPrototypeStorage(null)
})

describe('단계 정의', () => {
  it('제품의 4단계와 같은 번호·순서다', () => {
    expect(PROTOTYPE_STEPS.map((s) => s.no)).toEqual([1, 2, 3, 4])
    expect(PROTOTYPE_STEPS.map((s) => s.id)).toEqual(['asis', 'generate', 'review', 'approve'])
  })

  it('단계마다 «지금 도는 것» 을 반드시 적는다', () => {
    for (const s of PROTOTYPE_STEPS) expect(s.runs.length).toBeGreaterThan(0)
  })

  it('검토 단계의 샘플 코멘트에는 차단 코멘트가 하나 있다 (승인 게이트가 실제로 막혀야 한다)', () => {
    expect(PROTOTYPE_COMMENTS.filter((c) => c.blocking)).toHaveLength(1)
    expect(PROTOTYPE_COMMENTS.filter((c) => !c.blocking).length).toBeGreaterThan(0)
  })

  it('생성 문장은 그 프로젝트의 요구사항에서 만든다 — 도메인마다 손으로 적어 두지 않는다', () => {
    const banking = prototypeSentence([
      { title: '거래내역 조회', body: '고객은 계좌 거래내역을 기간·거래구분으로 검색한다.' },
      { title: '거래 상세 조회', body: '고객은 거래 한 건의 상세를 본다.' },
      { title: '거래내역 내려받기', body: '고객은 조회한 거래내역을 파일로 내려받는다.' },
    ])
    expect(banking).toContain('거래내역')
    expect(banking).toContain('검색')
    expect(banking).toContain('내려받') // 다운로드 요구사항을 함께 넣는다 → download-fixture 동작이 생긴다
    expect(banking).not.toContain('견적') // 다른 도메인의 말이 새어 들어오지 않는다
  })

  it('요구사항을 아직 읽지 못했으면 대체 문장을 쓴다 (빈 문장으로 생성하지 않는다)', () => {
    expect(prototypeSentence([])).toBe(PROTOTYPE_SENTENCE_FALLBACK)
    expect(PROTOTYPE_SENTENCE_FALLBACK).toContain('검색')
    expect(PROTOTYPE_SENTENCE_FALLBACK).toContain('다운로드')
  })
})

describe('진행 판정 — 결과가 있어야 끝난 것이다', () => {
  it('빈 상태에서는 첫 단계만 누를 수 있다', () => {
    expect(stepStatus({}, 'asis')).toBe('ready')
    expect(stepStatus({}, 'generate')).toBe('blocked')
    expect(stepStatus({}, 'approve')).toBe('blocked')
    expect(nextStep({})).toBe('asis')
    expect(progressText({})).toContain('4단계 중 0단계')
  })

  it('단계가 끝날 때마다 다음 단계가 열린다', () => {
    expect(stepStatus(AFTER_ASIS, 'asis')).toBe('done')
    expect(stepStatus(AFTER_ASIS, 'generate')).toBe('ready')
    expect(stepStatus(AFTER_ASIS, 'review')).toBe('blocked')
    expect(nextStep(AFTER_GENERATE)).toBe('review')
    expect(doneCount(AFTER_REVIEW)).toBe(3)
  })

  it('id 만 있고 결과가 없으면 끝난 것이 아니다', () => {
    expect(isStepDone({ analysis_id: 'a1' }, 'asis')).toBe(false)
    expect(isStepDone({ screen_id: 's1' }, 'generate')).toBe(false)
  })

  it('네 단계가 모두 끝나야 완료다', () => {
    expect(isComplete(AFTER_REVIEW)).toBe(false)
    expect(isComplete(AFTER_APPROVE)).toBe(true)
    expect(nextStep(AFTER_APPROVE)).toBeNull()
    expect(progressText(AFTER_APPROVE)).toContain('모두 끝났습니다')
  })
})

describe('저장 — 깨진 값을 새 결과처럼 쓰지 않는다', () => {
  it('저장소를 쓸 수 없으면 저장 실패를 그대로 알린다 (조용히 성공으로 보이게 두지 않는다)', () => {
    setPrototypeStorage(() => null)
    expect(saveRun(P1, AFTER_ASIS)).toBe(false)
    expect(loadRun(P1)).toEqual({})
  })

  it('저장하고 다시 읽는다', () => {
    expect(saveRun(P1, AFTER_REVIEW)).toBe(true)
    expect(loadRun(P1)).toEqual(AFTER_REVIEW)
    clearRun(P1)
    expect(loadRun(P1)).toEqual({})
  })

  it('프로젝트마다 진행 기록이 따로 남는다 — 도메인을 바꿔도 섞이지 않는다', () => {
    expect(saveRun(P1, AFTER_REVIEW)).toBe(true)
    expect(loadRun(P2)).toEqual({})
    expect(saveRun(P2, AFTER_ASIS)).toBe(true)
    expect(loadRun(P1)).toEqual(AFTER_REVIEW)
    clearRun(P2)
    expect(loadRun(P1)).toEqual(AFTER_REVIEW) // 한쪽을 지워도 다른 쪽은 남는다
  })

  it('배열·문자열 등 모양이 깨진 값은 빈 상태로 시작한다', () => {
    memory.setItem(runKey(P1), '[1,2,3]')
    expect(loadRun(P1)).toEqual({})
    memory.setItem(runKey(P1), '깨진 JSON')
    expect(loadRun(P1)).toEqual({})
  })
})
