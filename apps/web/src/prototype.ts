/**
 * 프로토타입 둘러보기 — 4단계(① AS-IS → ② 생성 → ③ 검토·수정 → ④ 완료·이관)를 처음부터 끝까지 한 번 돌린다.
 *
 * 이 파일은 **순수 규칙**만 갖는다(단계 정의·진행 상태·다음 할 일). 실행은 화면(PrototypePage)이
 * 다른 화면과 **똑같은 API** 로 한다 — 프로토타입 전용 뒷문을 만들지 않는다. 그래야 여기서 통과한 것이
 * 실제 화면에서도 통과한다.
 *
 * 정직 표기 규칙 (CLAUDE.md)
 * - 단계마다 «지금 실제로 도는 것» 과 «미리 기록해 둔 것» 을 나눠 적는다. 둘을 뭉뚱그리지 않는다.
 * - 샘플 문장·코멘트는 이 파일에 있는 **가상 데이터**다. 실제 고객 요구사항이 아니다.
 */

import type { CommentRole } from './types.js'

export type PrototypeStepId = 'asis' | 'generate' | 'review' | 'approve'

export interface PrototypeStepSpec {
  id: PrototypeStepId
  /** 화면에 찍는 단계 번호 (제품의 4단계와 같은 번호). */
  no: 1 | 2 | 3 | 4
  title: string
  goal: string
  /** 이 단계에서 **지금 실제로 도는 것**. */
  runs: string
  /** 이 단계에서 **미리 기록해 둔 것**(또는 샘플). 없으면 빈 문자열. */
  sampled: string
  action: string
}

export const PROTOTYPE_STEPS: readonly PrototypeStepSpec[] = [
  {
    id: 'asis',
    no: 1,
    title: 'AS-IS 분석',
    goal: '현행 화면의 페인포인트를 찾는다.',
    runs: '페인포인트 규칙(서버와 같은 더미 어댑터)을 이 브라우저에서 돌린다.',
    sampled: '대상 페이지의 구조·스크린샷은 서버 분석기(Playwright)가 합성 페이지를 분석해 남긴 기록이다.',
    action: '샘플 대상 분석',
  },
  {
    id: 'generate',
    no: 2,
    title: '화면 생성',
    goal: '요구사항·참고 화면을 붙여 화면명세와 HTML 목업을 만든다.',
    runs: '문맥 조립 → 명세 → 스키마·참조 검사 → 목업 렌더 → V1·V2·V3 검사 → 저장. 전부 이 브라우저에서 실제로 실행된다.',
    sampled: '명세를 쓰는 모델만 더미다(자격 증명을 넣으면 실제 모델이 쓴다). 한 줄 요청 문장은 아래 샘플 문장이다.',
    action: '샘플 문장으로 만들기',
  },
  {
    id: 'review',
    no: 3,
    title: '검토 · 수정',
    goal: '팀이 코멘트를 달고, 그 코멘트로 다시 만든다.',
    runs: '코멘트 저장 → 수정 프롬프트 초안 → 단건 수정 → 새 revision → 코멘트 해결까지 실제로 실행된다.',
    sampled: '코멘트 2건(디자이너 차단 1 · 퍼블리셔 비차단 1)은 아래 샘플 문장이다.',
    action: '샘플 코멘트로 수정',
  },
  {
    id: 'approve',
    no: 4,
    title: '완료 · 이관',
    goal: '승인 게이트를 통과하면 v1.0 과 산출물 6개 파일을 만든다.',
    runs: '승인 판정(필수 검사 전부 pass · 차단 코멘트 0 · hash 일치)과 산출물 6개 파일 생성이 실제로 실행된다.',
    sampled: '',
    action: '완료(v1.0) 처리',
  },
]

// ---------------------------------------------------------------- 샘플 데이터 (가상)

/** ② 생성에 쓰는 한 줄 요청. */
export const PROTOTYPE_SENTENCE =
  '파트너가 견적 요청 목록을 조회하고 상태·기간으로 검색한다. 목록에서 상세로 이동하고, 엑셀 다운로드 버튼으로 목록을 내려받는다.'

/** ③ 검토에 쓰는 코멘트 2건. 차단 1건이 있어야 승인 게이트가 실제로 막힌다. */
export const PROTOTYPE_COMMENTS: ReadonlyArray<{ author: string; role: CommentRole; text: string; blocking: boolean }> = [
  {
    author: '샘플 디자이너',
    role: 'designer',
    text: '검색 영역의 「견적번호」 라벨을 「견적 번호」로 띄어 써 주세요. 라벨이 붙어 있어 읽기 어렵습니다.',
    blocking: true,
  },
  {
    author: '샘플 퍼블리셔',
    role: 'publisher',
    text: '표의 금액 열은 오른쪽 정렬이 필요합니다. 자릿수 비교가 어렵습니다.',
    blocking: false,
  },
]

/** ④ 완료에 쓰는 승인자 이름 (사람이 바꿀 수 있다). */
export const PROTOTYPE_APPROVER = '프로토타입 기획자'

// ---------------------------------------------------------------- 진행 상태

/** 이 브라우저에 남는 진행 기록. 실제 실행이 만든 id 만 담는다 (지어낸 값 없음). */
export interface PrototypeRun {
  analysis_id?: string
  pain_point_count?: number
  screen_id?: string
  screen_external_id?: string
  revision1_id?: string
  comment_ids?: string[]
  revision2_id?: string
  approved_version?: string
  export_file_count?: number
}

export const PROTOTYPE_STORE_KEY = 'con-ai:prototype'

export function emptyRun(): PrototypeRun {
  return {}
}

/** 이 단계가 끝났는가 — 실행 결과가 실제로 남아 있어야 «끝남» 이다. */
export function isStepDone(run: PrototypeRun, id: PrototypeStepId): boolean {
  switch (id) {
    case 'asis':
      return typeof run.pain_point_count === 'number'
    case 'generate':
      return typeof run.revision1_id === 'string'
    case 'review':
      return typeof run.revision2_id === 'string'
    case 'approve':
      return typeof run.approved_version === 'string'
  }
}

export type PrototypeStepStatus = 'done' | 'ready' | 'blocked'

/** 앞 단계가 끝나야 다음 단계를 누를 수 있다 (순서를 건너뛰지 않는다). */
export function stepStatus(run: PrototypeRun, id: PrototypeStepId): PrototypeStepStatus {
  if (isStepDone(run, id)) return 'done'
  const index = PROTOTYPE_STEPS.findIndex((s) => s.id === id)
  const previous = PROTOTYPE_STEPS.slice(0, index)
  return previous.every((s) => isStepDone(run, s.id)) ? 'ready' : 'blocked'
}

/** 지금 해야 할 단계. 다 끝났으면 null. */
export function nextStep(run: PrototypeRun): PrototypeStepId | null {
  return PROTOTYPE_STEPS.find((s) => !isStepDone(run, s.id))?.id ?? null
}

export function doneCount(run: PrototypeRun): number {
  return PROTOTYPE_STEPS.filter((s) => isStepDone(run, s.id)).length
}

export function isComplete(run: PrototypeRun): boolean {
  return doneCount(run) === PROTOTYPE_STEPS.length
}

/** 진행 문구 — 끝난 뒤에도 「몇 단계 중 몇」 을 그대로 적는다. */
export function progressText(run: PrototypeRun): string {
  const done = doneCount(run)
  return isComplete(run) ? `${PROTOTYPE_STEPS.length}단계 모두 끝났습니다` : `${PROTOTYPE_STEPS.length}단계 중 ${done}단계 완료`
}

// ---------------------------------------------------------------- 저장 (이 브라우저에만)

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function localStorageOrNull(): StorageLike | null {
  try {
    const s = (globalThis as { localStorage?: unknown }).localStorage
    return s === undefined || s === null ? null : (s as StorageLike)
  } catch {
    return null
  }
}

/** 저장소 주입 지점 (테스트가 갈아끼운다). 기본은 이 브라우저의 localStorage. */
let storage: () => StorageLike | null = localStorageOrNull

export function setPrototypeStorage(get: (() => StorageLike | null) | null): void {
  storage = get ?? localStorageOrNull
}

/** 저장된 진행 기록. 모양이 깨졌으면 빈 상태로 시작한다 (예전 값을 새 결과처럼 쓰지 않는다). */
export function loadRun(): PrototypeRun {
  const s = storage()
  if (!s) return emptyRun()
  try {
    const raw = s.getItem(PROTOTYPE_STORE_KEY)
    if (raw === null || raw === '') return emptyRun()
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return emptyRun()
    return parsed as PrototypeRun
  } catch {
    return emptyRun()
  }
}

/** 저장한다. 실패해도 화면은 계속 동작한다 (false 를 돌려 화면이 알린다). */
export function saveRun(run: PrototypeRun): boolean {
  const s = storage()
  if (!s) return false
  try {
    s.setItem(PROTOTYPE_STORE_KEY, JSON.stringify(run))
    return true
  } catch {
    return false
  }
}

export function clearRun(): void {
  const s = storage()
  if (!s) return
  try {
    s.removeItem(PROTOTYPE_STORE_KEY)
  } catch {
    /* 무시 */
  }
}
