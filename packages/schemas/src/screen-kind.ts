/**
 * 화면 종류 짐작 — 「이 문장은 목록인가 메인인가」를 **한 곳에서만** 판단한다.
 *
 * 왜 여기 있나: 같은 질문에 답이 여러 개면 사용자가 「목록으로 짐작」이라는 화면 안내를 보고
 * 히어로 화면을 받는다. 화면(만들기)·더미 어댑터가 이 함수 하나를 부른다.
 *
 * 규칙
 * - **낱말 경계**를 본다. `indexOf` 부분일치는 「도메인」에서 「메인」을 찾아낸다 (실제로 겪은 오판).
 * - 문장에서 **먼저 나온** 낱말이 이긴다. 같은 자리면 KIND_WORDS 의 순서.
 * - 짐작하지 못하면 'list' 다 (기본값을 바꾸지 않는다).
 * - 근거 낱말을 함께 돌려준다 — 화면과 프롬프트가 「왜 그렇게 봤는지」를 사람에게 보여줄 수 있어야 한다.
 */

/** 짐작할 수 있는 화면 종류. 레퍼런스 분류(ReferenceCategory)와 같은 값이다. */
export type ScreenKind = 'main' | 'popup' | 'form' | 'detail' | 'list'

/** 종류를 가리키는 낱말. 한글은 앞뒤에 한글이 붙지 않을 때만, 영문은 낱말 경계에서만 맞춘다. */
export const SCREEN_KIND_WORDS: ReadonlyArray<{ kind: ScreenKind; words: readonly string[] }> = [
  { kind: 'main', words: ['메인', '홈 화면', '홈화면', '홈페이지', '첫 화면', '대표 화면', '랜딩', 'main', 'home', 'landing'] },
  { kind: 'popup', words: ['팝업', '모달', '레이어', 'popup', 'modal'] },
  { kind: 'form', words: ['등록', '입력', '작성', '신청', '수정 폼', '폼'] },
  { kind: 'detail', words: ['상세', '보기', '조회 화면', '디테일', 'detail'] },
  { kind: 'list', words: ['목록', '리스트', '조회', '검색', '내역', 'list'] },
]

const HANGUL = /[가-힣]/

/**
 * 낱말 경계에서 찾은 첫 위치. 없으면 -1.
 *
 * 한국어는 교착어라 **오른쪽에는 조사가 붙는다**("상세에서", "목록을"). 그래서 한글 낱말은 **왼쪽만** 본다 —
 * 「도메인」이 「메인」을 품는 오판은 왼쪽 경계로 걸러지고, 조사는 그대로 허용된다.
 * 영문 낱말은 양쪽 모두 영숫자가 아니어야 한다("domain" 안의 "main" 을 막는다).
 */
export function indexOfWord(haystack: string, word: string): number {
  const lower = haystack.toLowerCase()
  const needle = word.toLowerCase()
  let from = 0
  for (;;) {
    const at = lower.indexOf(needle, from)
    if (at === -1) return -1
    const before = lower[at - 1]
    const after = lower[at + needle.length]
    const startsHangul = HANGUL.test(needle[0] ?? '')
    const endsHangul = HANGUL.test(needle[needle.length - 1] ?? '')
    const leftOk = before === undefined || (startsHangul ? !HANGUL.test(before) : !/[a-z0-9]/.test(before))
    const rightOk = after === undefined || endsHangul || !/[a-z0-9]/.test(after)
    if (leftOk && rightOk) return at
    from = at + 1
  }
}

export interface ScreenKindGuess {
  kind: ScreenKind
  /** 그렇게 본 근거 낱말. 짐작하지 못했으면 undefined (기본값 list). */
  matched_word?: string
}

/** 문장에서 화면 종류를 짐작한다. 근거 낱말을 함께 돌려준다. */
export function guessScreenKind(sentence: string): ScreenKindGuess {
  let best: { kind: ScreenKind; word: string; at: number } | undefined
  for (const { kind, words } of SCREEN_KIND_WORDS) {
    for (const w of words) {
      const at = indexOfWord(sentence, w)
      if (at === -1) continue
      if (best === undefined || at < best.at) best = { kind, word: w, at }
    }
  }
  return best === undefined ? { kind: 'list' } : { kind: best.kind, matched_word: best.word }
}

/** 메인(홈) 화면 요청인가. 확실하지 않으면 false — 모르는 것을 메인으로 만들지 않는다. */
export function looksLikeMainScreen(...texts: Array<string | undefined>): boolean {
  return guessScreenKind(texts.filter((t): t is string => t !== undefined && t !== '').join(' ')).kind === 'main'
}
