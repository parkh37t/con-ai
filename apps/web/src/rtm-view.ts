/**
 * ID 매핑 화면의 표시 규칙 — 순수 함수 (산출물 P1-05).
 *
 * 화면이 숫자를 스스로 해석하지 않게 여기에 모은다. 특히 «없다» 와 «0» 과 «미실행» 을
 * 서로 다른 문구로 적는 규칙이 이 파일의 존재 이유다.
 */
import type { RtmGapProposal, RtmRow, RtmRowStatus, RtmSummary } from './types.js'

/** 비율 표시 — 분모가 0 이면 «—». 0/0 을 100% 로 적지 않는다. */
export function ratioText(ratio: number | null): string {
  if (ratio === null) return '—'
  return `${Math.round(ratio * 100)}%`
}

export const ROW_STATUS_LABELS: Readonly<Record<RtmRowStatus, string>> = {
  mapped: '연결됨',
  partial: '부분 연결',
  non_ui_only: '비UI 전용',
  unmapped: '미매핑',
}

export const ROW_STATUS_TONES: Readonly<Record<RtmRowStatus, 'green' | 'amber' | 'gray' | 'red'>> = {
  mapped: 'green',
  partial: 'amber',
  non_ui_only: 'gray',
  unmapped: 'red',
}

/**
 * 100% 배너를 띄울지 판정한다.
 * 다중 가드 — 요구사항이 있고, 비율이 1 이고, 화면으로 확인할 UI 수용조건이 실제로 있어야 한다.
 * 셋 중 하나라도 아니면 배너를 띄우지 않는다 (없는 성취를 축하하지 않는다).
 */
export function showsFullCoverageBanner(summary: RtmSummary, rows: readonly RtmRow[]): boolean {
  if (summary.requirements_total === 0) return false
  if (summary.req_to_scr_ratio !== 1) return false
  const uiCriteria = rows.reduce((n, r) => n + r.ui_criteria, 0)
  return uiCriteria > 0
}

/** 셀에 적을 외부 ID. 없으면 «미발번» 이라고 분명히 적는다 — 빈칸으로 두지 않는다. */
export function idCellText(externalId: string | undefined, layer: 'IA' | 'FN'): string {
  return externalId ?? `(${layer} 코드 미발번)`
}

/** KPI 한 칸. `note` 는 큰 숫자 옆의 작은 글씨다. */
export interface KpiCell {
  key: string
  label: string
  value: string
  note: string
  /** 강조할 값인가 (미매핑이 남아 있을 때 등). */
  alert: boolean
}

/** 산출물 P1-05 의 KPI 5칸. 총계와 비율의 분모를 문구로 구분해 적는다. */
export function kpiCells(summary: RtmSummary): KpiCell[] {
  return [
    {
      key: 'coverage',
      label: 'REQ → SCR 커버리지',
      value: ratioText(summary.req_to_scr_ratio),
      note: summary.requirements_total === 0 ? '요구사항 없음' : `${summary.mapped}/${summary.requirements_total} 요구사항`,
      alert: false,
    },
    { key: 'req', label: '요구사항 REQ', value: String(summary.requirements_total), note: '비율의 분모', alert: false },
    {
      key: 'fn',
      label: '기능 FN',
      value: String(summary.functions_total),
      note: `총계(분모 아님) · 발번 ${summary.functions_issued}`,
      alert: false,
    },
    { key: 'scr', label: '화면 SCR', value: String(summary.screens_total), note: '총계(분모 아님)', alert: false },
    {
      key: 'unmapped',
      label: '미매핑',
      value: String(summary.unmapped + summary.partial),
      note: `미매핑 ${summary.unmapped} · 부분 ${summary.partial}`,
      alert: summary.unmapped + summary.partial > 0,
    },
  ]
}

/** 화면 각주 — 이 조각에서 세지 못하는 것을 자백한다. 0 을 «문제 없음» 으로 읽히게 두지 않는다. */
export function footnotes(summary: RtmSummary): string[] {
  const notes: string[] = [
    `검증 완료: ${summary.test_pass.reason}`,
    'REQ 출처(회의·RFP·페인포인트) 필드가 아직 없어 표에 적지 않는다 — 값이 없는 칸을 만들지 않았다.',
    '충돌·제외 상태는 이 화면에서 기록할 수단이 없어 항상 0 이다. 「충돌 없음」 이 아니라 「세지 않음」 이다.',
  ]
  if (summary.element_tagging.not_run_screens.length > 0) {
    notes.push(`요소 태깅 미실행 화면 ${summary.element_tagging.not_run_screens.length}건 (아직 생성되지 않음): ${summary.element_tagging.not_run_screens.join(', ')}`)
  }
  if (summary.element_tagging.refs_stale > 0) {
    notes.push(`화면을 다시 만들어 사라진 요소 참조 ${summary.element_tagging.refs_stale}건 — 사람이 다시 연결해야 한다 (자동 복구하지 않는다).`)
  }
  return notes
}

export const PROPOSAL_KIND_LABELS: Readonly<Record<RtmGapProposal['kind'], string>> = {
  link_requirement: '요구사항 연결',
  define_function: '기능 정의',
  link_screen: '화면 연결',
  issue_ia_id: 'IA 번호 발번',
  issue_fn_id: 'FN 번호 발번',
}

/** 이 제안이 ID 발번인가 — 발번이면 사유·행위자 입력과 「승인 · ID 발번」 버튼을 붙인다. */
export function isIssuanceProposal(p: RtmGapProposal): boolean {
  return p.kind === 'issue_ia_id' || p.kind === 'issue_fn_id'
}

/** 발번·연결 버튼을 누를 수 있는가 — 행위자와 사유가 둘 다 있어야 한다 (서버도 같은 검사를 한다). */
export function canSubmit(by: string, reason: string): boolean {
  return by.trim().length > 0 && reason.trim().length > 0
}
