/**
 * RFP 분석 화면의 **순수 함수** — 라벨·판정·요약 문구. 컴포넌트 안에 묶어 두면 실행 테스트를 쓸 수 없다
 * (지난번 `link_screen` 분기가 화면 안에 묶여 있어 결함에 테스트가 없었던 자리와 같은 교훈).
 */
import type { MoscowPriority, NfrAxis, RfpAnalysis, RfpNfrGap, RfpRejectedDraft, RfpRequirementClass, RfpStatus } from './types.js'

export const RFP_STATUS_LABELS: Readonly<Record<RfpStatus, string>> = {
  queued: '대기',
  running: '분석 중',
  succeeded: '완료',
  failed: '실패',
}

export const RFP_STATUS_TONES: Readonly<Record<RfpStatus, 'gray' | 'blue' | 'green' | 'red'>> = {
  queued: 'gray',
  running: 'blue',
  succeeded: 'green',
  failed: 'red',
}

/** 종료 상태인가 — 폴링을 멈출 기준. */
export function isTerminalRfp(status: RfpStatus): boolean {
  return status === 'succeeded' || status === 'failed'
}

export const RFP_CLASS_LABELS: Readonly<Record<RfpRequirementClass, string>> = {
  FR: '기능',
  NFR: '비기능',
  TR: '기술',
  OR: '운영',
  CR: '컴플라이언스',
}

export const MOSCOW_LABELS: Readonly<Record<MoscowPriority, string>> = {
  M: '필수(M)',
  S: '권장(S)',
  C: '부가(C)',
  W: '범위 외(W)',
}

export const MOSCOW_TONES: Readonly<Record<MoscowPriority, 'red' | 'amber' | 'blue' | 'gray'>> = {
  M: 'red',
  S: 'amber',
  C: 'blue',
  W: 'gray',
}

export const NFR_AXIS_LABELS: Readonly<Record<NfrAxis, string>> = {
  performance: '성능',
  availability: '가용성',
  security: '보안',
  accessibility: '접근성',
  compatibility: '호환성',
  audit: '감리',
}

/** 왜 떨어졌는지 — 사람 말로 적는다. 조용히 버리지 않는다. */
export const RFP_REJECT_LABELS: Readonly<Record<RfpRejectedDraft['reason'], string>> = {
  quote_not_found: '원문에서 인용을 찾지 못했다 (지어낸 인용일 수 있어 채택하지 않았다)',
  empty_title: '요구사항명이 비어 있다',
  empty_priority_reason: '우선순위 근거가 없다 (임의 판단은 채택하지 않는다)',
}

/** 실패 코드 → 사람이 **할 일**. 모르는 코드는 그대로 보여준다. */
export const RFP_FAILURE_LABELS: Readonly<Record<string, string>> = {
  auth: '모델을 부를 수 없습니다 — 터미널에서 `claude` 로 로그인했는지 확인하세요 (설치가 없으면 먼저 설치)',
  limit: '내 Claude 계정의 사용 한도에 걸렸습니다 — 한도가 회복된 뒤 다시 실행하세요',
  timeout: '시간이 너무 걸려 중단했습니다 — 원문을 장(章) 단위로 나눠 넣어 보세요',
  extract: '원문에서 요구사항을 뽑지 못했습니다 — 표·이미지 위주라면 텍스트로 붙여넣어야 합니다',
  internal: '서버 오류입니다',
}

export function rfpFailureText(failure: RfpAnalysis['failure']): string | null {
  if (failure === undefined) return null
  const hint = RFP_FAILURE_LABELS[failure.code]
  return hint === undefined ? `${failure.code}: ${failure.message}` : `${hint} (${failure.message})`
}

/** 채택된 외부 ID 집합 — 표에서 「채택됨」을 표시하고 중복 채택을 막는다. */
export function adoptedIds(analysis: Pick<RfpAnalysis, 'adoptions'>): Set<string> {
  return new Set(analysis.adoptions.map((a) => a.external_id))
}

/**
 * 체크리스트 각주 — **빈 축을 「없음」이 아니라 「세지 못함」으로** 적는다.
 * 모두 덮였으면 null (없는 문제를 만들지 않는다).
 */
export function nfrGapNote(gaps: readonly RfpNfrGap[]): string | null {
  const missing = gaps.filter((g) => g.status === 'missing')
  if (missing.length === 0) return null
  return `금융권 비기능 체크리스트 ${missing.length}축에 요구사항이 하나도 없습니다 — ${missing
    .map((g) => NFR_AXIS_LABELS[g.axis])
    .join(' · ')}. 「해당 없음」이 아니라 「세지 못함」입니다. 원문을 다시 보거나 발주처에 확인하세요.`
}

/** 분석 결과 한 줄 요약 — 숫자만 적고 추론하지 않는다. */
export function rfpSummaryLine(analysis: Pick<RfpAnalysis, 'requirements' | 'rejected' | 'evaluation_items' | 'whitespace_matches' | 'adoptions' | 'source_chars'>): string {
  const parts = [
    `원문 ${analysis.source_chars.toLocaleString('ko-KR')}자`,
    `요구사항 후보 ${analysis.requirements.length}건`,
    `평가항목 ${analysis.evaluation_items.length}건`,
    `채택 ${analysis.adoptions.length}건`,
  ]
  if (analysis.rejected.length > 0) parts.push(`인용 검사 거부 ${analysis.rejected.length}건`)
  if (analysis.whitespace_matches > 0) parts.push(`공백만 다른 인용 ${analysis.whitespace_matches}건`)
  return parts.join(' · ')
}

/** 채택 버튼을 누를 수 있는가 — 행위자·사유·선택이 모두 있어야 한다 (서버도 같은 검사를 한다). */
export function canAdopt(input: { by: string; reason: string; selected: ReadonlySet<string>; busy: boolean; status: RfpStatus }): boolean {
  return input.status === 'succeeded' && !input.busy && input.by.trim().length > 0 && input.reason.trim().length > 0 && input.selected.size > 0
}

/** 긴 인용을 표에 넣기 위한 줄임 — 전체는 title 속성과 상세 영역에서 본다. */
export function shortQuote(quote: string, max = 80): string {
  const one = quote.replace(/\s+/gu, ' ').trim()
  return one.length <= max ? one : `${one.slice(0, max - 1)}…`
}
