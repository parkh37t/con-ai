/**
 * 프로토타입 진행 규칙 — 순서를 건너뛰지 않고, 실행 결과가 실제로 있어야 «끝남» 이다.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryStorage } from './browser-run/test-helpers.js'
import { PROTOTYPE_SENTENCE_FALLBACK, PROTOTYPE_STEPS, clearRun, doneCount, isComplete, isStepDone, loadRun, nextStep, progressText, prototypeComments, prototypeSentence, prototypeStepText, prototypeTarget, runKey, saveRun, setPrototypeStorage, stepStatus, type PrototypeRun } from './prototype.js'

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
    for (const kind of ['list', 'main'] as const) {
      const comments = prototypeComments(kind)
      expect(comments.filter((c) => c.blocking), kind).toHaveLength(1)
      expect(comments.filter((c) => !c.blocking).length, kind).toBeGreaterThan(0)
    }
  })

  it('코멘트는 그 화면에 있는 것을 가리킨다 — 메인 화면에 «표의 금액 열» 같은 말을 붙이지 않는다', () => {
    const main = prototypeComments('main').map((c) => c.text).join(' ')
    expect(main).toContain('히어로')
    expect(main).toContain('KPI')
    expect(main).not.toContain('금액 열')
    const list = prototypeComments('list').map((c) => c.text).join(' ')
    expect(list).not.toContain('히어로')
  })

  it('메인 골든 레퍼런스가 있는 프로젝트는 둘러보기에서 메인 화면을 만든다', () => {
    const requirements = [
      { title: '거래내역 조회', body: '고객은 계좌 거래내역을 기간으로 검색한다.' },
      { title: '메인 화면 구성', body: '앱을 열면 대표 안내와 요약 지표, 자주 쓰는 기능, 최근 공지를 한 화면에서 확인한다.' },
    ]
    const main = prototypeTarget(requirements, [{ category: 'list' }, { category: 'main' }])
    expect(main.kind).toBe('main')
    expect(main.title_suffix).toContain('메인')
    // 문장에 「메인」이 있어야 만들기와 같은 판정으로 메인 골든이 붙는다.
    expect(main.sentence).toContain('메인')

    // 메인 골든이 없으면 지금까지처럼 목록 화면이다.
    const list = prototypeTarget(requirements, [{ category: 'list' }])
    expect(list.kind).toBe('list')
    expect(list.title_suffix).toContain('목록')
    expect(list.sentence).not.toContain('메인')
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

/**
 * 단계 카드 문구가 어댑터를 따라간다.
 *
 * 고정 문자열이던 때는 자격 증명을 넣어 내 토큰으로 도는데도 ① 카드가 «더미 어댑터» 라고 적었다
 * (CLAUDE.md: 더미 동작과 실제 모델 연계를 사용자에게 구분해 보여준다).
 */
describe('prototypeStepText — 토큰으로 돌 때 «더미» 라고 적지 않는다', () => {
  const step = (id: string) => PROTOTYPE_STEPS.find((s) => s.id === id)!

  it('① AS-IS: 자격 증명이 있으면 실제 모델이라고 적고, 더미라는 말을 쓰지 않는다', () => {
    const real = prototypeStepText(step('asis'), 'anthropic')
    expect(real.runs).toContain('실제 모델')
    expect(real.runs).not.toContain('더미')
    const dummy = prototypeStepText(step('asis'), 'fixture')
    expect(dummy.runs).toContain('더미')
  })

  it('② 생성: 자격 증명이 있으면 «이 단계에 더미는 없다» 고 적는다', () => {
    expect(prototypeStepText(step('generate'), 'anthropic').sampled).toContain('더미는 없다')
    expect(prototypeStepText(step('generate'), 'fixture').sampled).toContain('모델만 더미')
  })

  it('어댑터를 아직 모르면(null) 원래 문구를 그대로 쓴다 — 실제라고 앞질러 말하지 않는다', () => {
    for (const s of PROTOTYPE_STEPS) {
      expect(prototypeStepText(s, null)).toEqual({ runs: s.runs, sampled: s.sampled })
    }
  })

  it('③·④ 는 어댑터와 무관하게 같은 문구다 (④ 는 모델을 쓰지 않는다)', () => {
    for (const id of ['review', 'approve']) {
      const s = step(id)
      expect(prototypeStepText(s, 'anthropic')).toEqual({ runs: s.runs, sampled: s.sampled })
    }
  })
})
