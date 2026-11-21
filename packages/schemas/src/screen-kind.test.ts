/**
 * 화면 종류 짐작 — 부분일치 오판을 막는 회귀 검사.
 * 이 판정이 틀리면 사용자는 「목록으로 짐작」이라는 안내를 보고 히어로 화면을 받는다.
 */
import { describe, expect, it } from 'vitest'
import { guessScreenKind, indexOfWord, looksLikeMainScreen, SCREEN_KIND_WORDS } from './screen-kind.js'

describe('guessScreenKind — 문장에서 화면 종류를 짐작한다', () => {
  it('먼저 나온 낱말이 이기고, 짐작하지 못하면 목록이다', () => {
    expect(guessScreenKind('견적 요청 목록을 조회하는 화면').kind).toBe('list')
    expect(guessScreenKind('견적 상세에서 이력 목록을 본다').kind).toBe('detail')
    expect(guessScreenKind('견적 등록 팝업').kind).toBe('form')
    expect(guessScreenKind('무언가')).toEqual({ kind: 'list' })
  })

  it('메인·홈 요청을 알아본다', () => {
    for (const s of ['뱅킹 앱 메인 페이지를 만든다', '그룹 포털 홈 화면', '대표 화면을 만들어줘', 'home page 만들어', '랜딩 페이지']) {
      expect(guessScreenKind(s).kind, s).toBe('main')
      expect(looksLikeMainScreen(s), s).toBe(true)
    }
  })

  it('«도메인» 이 «메인» 으로 읽히지 않는다 (부분일치 오판 회귀)', () => {
    // 낱말 경계가 없으면 목록 요청에 히어로 골든이 근거로 붙는다 — 실제로 겪은 오판이다.
    expect(guessScreenKind('커머스 도메인 주문 목록 화면을 만들어줘').kind).toBe('list')
    expect(guessScreenKind('도메인별 주문 내역 조회 목록').kind).toBe('list')
    expect(guessScreenKind('이메일 domain 관리 목록').kind).toBe('list')
    expect(looksLikeMainScreen('커머스 도메인 주문 목록')).toBe(false)
  })

  it('한글은 조사가 붙어도 맞고, 앞에 다른 글자가 붙으면 아니다', () => {
    expect(indexOfWord('목록을 조회한다', '목록')).toBe(0)
    expect(indexOfWord('상세에서 본다', '상세')).toBe(0)
    expect(indexOfWord('도메인 관리', '메인')).toBe(-1)
    expect(indexOfWord('subdomain 관리', 'main')).toBe(-1)
    expect(indexOfWord('main page', 'main')).toBe(0)
  })

  it('근거 낱말을 함께 돌려준다 (사람에게 왜 그렇게 봤는지 보여줄 수 있어야 한다)', () => {
    expect(guessScreenKind('뱅킹 앱 메인 페이지')).toEqual({ kind: 'main', matched_word: '메인' })
  })

  it('짐작 목록의 종류는 레퍼런스 분류와 같은 값만 쓴다', () => {
    expect(SCREEN_KIND_WORDS.map((k) => k.kind)).toEqual(['main', 'popup', 'form', 'detail', 'list'])
  })
})
