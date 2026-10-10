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
    {
      key: 'scr',
      label: '화면 SCR',
      value: String(summary.screens_total),
      // 「연결된 화면」과 「만들어진 화면」을 한 칸에서 구분해 적는다 — 연결만 된 화면은 분자에 들어가지 않는다.
      note: `총계(분모 아님) · 생성 ${summary.screens_built}`,
      alert: false,
    },
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
  if (summary.screens_built < summary.screens_total) {
    notes.push(
      `화면 ${summary.screens_total}건 중 목업이 만들어진 것은 ${summary.screens_built}건이다. 메뉴에 «연결» 만 된 화면은 커버리지 분자에 넣지 않는다 — 그 행은 부분 매핑으로 남는다.`,
    )
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

/**
 * 발번 요청에 실을 **대상 기능**(내부 UUID). `issue_fn_id` 가 아니면 없다(IA 발번).
 *
 * 제안이 대상을 들고 오지 않으면 **짐작하지 않는다.** 예전에는 화면이 보고서 전체의 첫 미발번 기능을
 * 집어 보냈고, 그게 다른 노드의 기능이면 `기능 <uuid> 가 이 IA 노드에 없다` 로 400 이 났다.
 */
export function issuanceFunctionId(proposal: Pick<RtmGapProposal, 'kind' | 'function_id'>): string | undefined {
  if (proposal.kind !== 'issue_fn_id') return undefined
  const id = proposal.function_id?.trim()
  if (id === undefined || id.length === 0) {
    throw new Error('이 FN 발번 제안에 대상 기능이 없습니다 — 새로고침 후 다시 확인하세요.')
  }
  return id
}

/** 제안 승인 버튼의 문구. 종류마다 하는 일이 다르므로 **빠짐없이** 적는다. */
export const PROPOSAL_SUBMIT_LABELS: Readonly<Record<RtmGapProposal['kind'], string>> = {
  link_requirement: '연결',
  define_function: '기능 추가',
  link_screen: '화면 연결',
  issue_ia_id: '승인 · ID 발번',
  issue_fn_id: '승인 · ID 발번',
}

/** 제안 입력칸의 안내 문구. `link_screen` 은 사람이 보는 **화면 외부 ID** 를 받는다. */
export const PROPOSAL_INPUT_PLACEHOLDERS: Readonly<Record<RtmGapProposal['kind'], string>> = {
  link_requirement: '요구사항 외부 ID',
  define_function: '기능 이름',
  link_screen: '화면 외부 ID (예: SCREEN-001)',
  issue_ia_id: '예: IA-1.1.1',
  issue_fn_id: '예: FN-1.1.1-01',
}

/**
 * 저장이 이 브라우저에 남지 않았으면 그 사실을 성공 문구에 **덧붙인다.**
 *
 * 정적 데모는 결과를 localStorage 에 쌓는데, 용량 초과·사생활 보호 모드면 저장이 실패하고
 * 응답에 `storage_warning` 이 실린다. 그걸 버리면 아무것도 남지 않았는데 초록색
 * 「연결했습니다」 가 뜬다 (CLAUDE.md: 조용히 성공으로 보이게 두지 않는다).
 */
export function withStorageWarning(message: string, res: unknown): string {
  if (typeof res !== 'object' || res === null) return message
  const warning = (res as { storage_warning?: unknown }).storage_warning
  return typeof warning === 'string' && warning.trim().length > 0 ? `${message} — 다만 ${warning}` : message
}

/** 제안 승인이 **어느 쓰기**로 가는가. 종류와 쓰기를 1:1 로 묶어 테스트가 직접 확인한다. */
export type ProposalAction = 'issue' | 'link_requirement' | 'link_screen' | 'define_function'

/**
 * 제안 종류 → 쓰기.
 *
 * 이 함수가 있는 이유: 예전에는 화면의 `submit` 이 `else` 폴백으로 끝나 `link_screen`(화면 연결)이
 * `onDefineFunction`(기능 추가)으로 샜다. 승인하면 화면은 안 붙고 사유·행위자가 붙은 **거짓 기능**이
 * IA 노드에 남았다. 분기를 순수 함수로 꺼내 **테스트가 직접 확인**하고, `never` 로 새 종류를 컴파일이 막는다.
 */
export function proposalAction(kind: RtmGapProposal['kind']): ProposalAction {
  switch (kind) {
    case 'issue_ia_id':
    case 'issue_fn_id':
      return 'issue'
    case 'link_requirement':
      return 'link_requirement'
    case 'link_screen':
      return 'link_screen'
    case 'define_function':
      return 'define_function'
    default: {
      const never: never = kind
      throw new Error(`모르는 제안 종류입니다: ${String(never)}`)
    }
  }
}

/**
 * 사람이 넣은 **화면 외부 ID** → 저장에 쓰는 **내부 UUID**.
 *
 * 섞으면 연결이 조용히 어긋난다(`.claude/skills/ID와-추적체인`). 못 찾으면 있는 화면을 함께 알린다 —
 * 외부 ID 를 외우게 하지 않는다.
 */
export function resolveScreenPlanId(externalId: string, screens: readonly { id: string; external_id: string }[]): string {
  const wanted = externalId.trim()
  const hit = screens.find((s) => s.external_id === wanted)
  if (hit !== undefined) return hit.id
  const known = screens.map((s) => s.external_id).join(', ')
  throw new Error(`${wanted} 라는 화면이 이 프로젝트에 없습니다. 화면 외부 ID 를 넣으세요${known.length === 0 ? '' : ` (있는 화면: ${known})`}`)
}
