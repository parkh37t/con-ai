/**
 * 좌측 레일·프로젝트 홈이 함께 쓰는 프로젝트 단계 집계 — 순수 함수.
 *
 * 설계 산출물(screens-v1)의 「작업 흐름」 4항목은 CLAUDE.md 의 4단계 프로세스와 같은 번호를 쓴다.
 * 여기서 세는 값은 화면에 그대로 적히므로, 세지 않은 것을 0 으로 단정하지 않고 `null` 로 구분한다
 * (아직 못 읽은 것과 정말 0건인 것은 다르다).
 */
import type { AsisAnalysisSummary, ScreenSummary } from './types.js'

/** 레일·KPI 의 단계 구분. 번호는 프로세스 순서이며 바꾸지 않는다. */
export type StageKey = 'asis' | 'screens' | 'review' | 'done'

export interface StageCount {
  /** 셀 수 없으면 null — 화면에서는 «—» 로 적는다. */
  value: number | null
  /** 큰 숫자 옆에 붙는 보조 설명. 세지 못했으면 빈 문자열. */
  note: string
}

export type StageCounts = Record<StageKey, StageCount>

const UNKNOWN: StageCount = { value: null, note: '' }

/**
 * 화면 목록과 AS-IS 분석 목록에서 4단계 집계를 만든다.
 * `screens`/`analyses` 가 `null`(아직 못 읽음)이면 그 단계는 «—» 가 된다.
 */
export function stageCounts(input: {
  screens: readonly ScreenSummary[] | null
  analyses: readonly AsisAnalysisSummary[] | null
  adoptedPainPoints?: number | null
}): StageCounts {
  const analyses = input.analyses
  const screens = input.screens
  const adopted = input.adoptedPainPoints

  const asis: StageCount = analyses
    ? { value: analyses.length, note: adopted === null || adopted === undefined ? '건' : `건 · 채택 ${adopted}` }
    : UNKNOWN

  if (!screens) return { asis, screens: UNKNOWN, review: UNKNOWN, done: UNKNOWN }

  const revisions = screens.reduce((n, s) => n + s.revision_count, 0)
  const reviewing = screens.filter((s) => s.status === 'review')
  const open = reviewing.reduce((n, s) => n + s.open_comments, 0)
  const approved = screens.filter((s) => s.status === 'approved').length

  return {
    asis,
    screens: { value: screens.length, note: `개 · revision ${revisions}` },
    review: { value: reviewing.length, note: `화면 · 열린 코멘트 ${open}` },
    done: { value: approved, note: '화면 · v1.0 이관' },
  }
}

/** 큰 숫자 자리에 적을 문자열. 세지 못했으면 «—». */
export function stageValueText(count: StageCount): string {
  return count.value === null ? '—' : String(count.value)
}

export interface StageNavItem {
  key: StageKey
  no: number
  label: string
  /** 프로젝트 홈의 화면 목록을 이 단계로 좁히는 값. AS-IS 는 별도 화면이라 없다. */
  stage?: 'screens' | 'review' | 'done'
}

/** 「작업 흐름」 4항목. 번호가 곧 프로세스 순서다 (CLAUDE.md 제품 목적). */
export const STAGE_NAV: readonly StageNavItem[] = [
  { key: 'asis', no: 1, label: 'AS-IS 분석' },
  { key: 'screens', no: 2, label: '화면', stage: 'screens' },
  { key: 'review', no: 3, label: '검토 중', stage: 'review' },
  { key: 'done', no: 4, label: '완료', stage: 'done' },
]

/** 프로젝트 홈의 화면 목록을 단계로 좁힌다. 알 수 없는 값이면 전체를 준다(임의로 비우지 않는다). */
export function filterScreensByStage(screens: readonly ScreenSummary[], stage: string | undefined): readonly ScreenSummary[] {
  if (stage === 'review') return screens.filter((s) => s.status === 'review')
  if (stage === 'done') return screens.filter((s) => s.status === 'approved')
  return screens
}

/** 화면 목록 위에 적는 좁힘 안내. 좁히지 않았으면 null. */
export function stageFilterLabel(stage: string | undefined): string | null {
  if (stage === 'review') return '검토 중'
  if (stage === 'done') return '완료(v1.0)'
  return null
}
