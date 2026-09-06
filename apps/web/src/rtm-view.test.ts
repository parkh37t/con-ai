import { describe, expect, it } from 'vitest'
import { issuanceNotice } from './pages/TraceMatrixPage.js'
import { canSubmit, footnotes, idCellText, isIssuanceProposal, kpiCells, ratioText, showsFullCoverageBanner } from './rtm-view.js'
import type { RtmRow, RtmSummary } from './types.js'

function summary(over: Partial<RtmSummary> = {}): RtmSummary {
  return {
    requirements_total: 5,
    mapped: 2,
    partial: 1,
    non_ui_only: 0,
    unmapped: 2,
    req_to_scr_ratio: 0.4,
    ia_nodes_total: 5,
    ia_nodes_issued: 0,
    functions_total: 0,
    functions_issued: 0,
    screens_total: 3,
    test_pass: { status: 'not_run', reason: '수용 테스트가 아직 없다 — 미실행은 통과가 아니다' },
    element_tagging: { refs_total: 0, refs_live: 0, refs_stale: 0, not_run_screens: [] },
    ...over,
  }
}

function row(over: Partial<RtmRow> = {}): RtmRow {
  return { requirement_external_id: 'REQ-1', title: '제목', ui_criteria: 1, non_ui_criteria: 0, ia: [], fn: [], scr: [], status: 'mapped', ...over }
}

describe('ratioText', () => {
  it('분모가 없으면 «—» 다 — 0/0 을 100% 로 적지 않는다', () => {
    expect(ratioText(null)).toBe('—')
  })

  it('비율을 정수 퍼센트로 적는다', () => {
    expect(ratioText(0)).toBe('0%')
    expect(ratioText(0.4)).toBe('40%')
    expect(ratioText(1)).toBe('100%')
  })
})

describe('showsFullCoverageBanner — 없는 성취를 축하하지 않는다', () => {
  it('요구사항이 0건이면 띄우지 않는다', () => {
    expect(showsFullCoverageBanner(summary({ requirements_total: 0, req_to_scr_ratio: null }), [])).toBe(false)
  })

  it('비율이 1 이 아니면 띄우지 않는다', () => {
    expect(showsFullCoverageBanner(summary(), [row()])).toBe(false)
  })

  it('비율이 1 이어도 UI 수용조건이 하나도 없으면 띄우지 않는다', () => {
    const rows = [row({ ui_criteria: 0, non_ui_criteria: 2, status: 'non_ui_only' })]
    expect(showsFullCoverageBanner(summary({ mapped: 1, requirements_total: 1, partial: 0, unmapped: 0, req_to_scr_ratio: 1 }), rows)).toBe(false)
  })

  it('세 조건이 모두 맞아야 띄운다', () => {
    const rows = [row({ ui_criteria: 3 })]
    expect(showsFullCoverageBanner(summary({ mapped: 1, requirements_total: 1, partial: 0, unmapped: 0, req_to_scr_ratio: 1 }), rows)).toBe(true)
  })
})

describe('idCellText — 미발번을 빈칸으로 두지 않는다', () => {
  it('발번됐으면 그 값을 적는다', () => {
    expect(idCellText('IA-1.1.1', 'IA')).toBe('IA-1.1.1')
  })

  it('미발번이면 그렇게 적는다', () => {
    expect(idCellText(undefined, 'IA')).toBe('(IA 코드 미발번)')
    expect(idCellText(undefined, 'FN')).toBe('(FN 코드 미발번)')
  })
})

describe('kpiCells', () => {
  it('다섯 칸을 산출물 순서대로 만든다', () => {
    expect(kpiCells(summary()).map((k) => k.key)).toEqual(['coverage', 'req', 'fn', 'scr', 'unmapped'])
  })

  it('총계와 비율의 분모를 문구로 구분한다 — FN·SCR 총계는 분모가 아니다', () => {
    const cells = kpiCells(summary())
    expect(cells.find((c) => c.key === 'req')?.note).toBe('비율의 분모')
    expect(cells.find((c) => c.key === 'fn')?.note).toContain('분모 아님')
    expect(cells.find((c) => c.key === 'scr')?.note).toContain('분모 아님')
  })

  it('미매핑 칸은 부분 연결까지 함께 세고 남아 있으면 강조한다', () => {
    const cell = kpiCells(summary()).find((c) => c.key === 'unmapped')
    expect(cell?.value).toBe('3') // 미매핑 2 + 부분 1
    expect(cell?.note).toBe('미매핑 2 · 부분 1')
    expect(cell?.alert).toBe(true)
  })

  it('갭이 없으면 강조하지 않는다', () => {
    const cell = kpiCells(summary({ unmapped: 0, partial: 0, mapped: 5, req_to_scr_ratio: 1 })).find((c) => c.key === 'unmapped')
    expect(cell?.alert).toBe(false)
  })

  it('요구사항이 0건이면 커버리지 칸이 «—» 이고 그 사실을 적는다', () => {
    const cells = kpiCells(summary({ requirements_total: 0, mapped: 0, partial: 0, unmapped: 0, req_to_scr_ratio: null }))
    const coverage = cells.find((c) => c.key === 'coverage')
    expect(coverage?.value).toBe('—')
    expect(coverage?.note).toBe('요구사항 없음')
  })
})

describe('footnotes — 세지 않은 것을 자백한다', () => {
  it('검증 미실행·출처 미기록·충돌 미집계를 항상 적는다', () => {
    const notes = footnotes(summary())
    expect(notes.some((n) => n.includes('미실행은 통과가 아니다'))).toBe(true)
    expect(notes.some((n) => n.includes('출처'))).toBe(true)
    expect(notes.some((n) => n.includes('「충돌 없음」 이 아니라'))).toBe(true)
  })

  it('요소 태깅 미실행 화면이 있으면 이름과 함께 적는다', () => {
    const notes = footnotes(summary({ element_tagging: { refs_total: 2, refs_live: 0, refs_stale: 0, not_run_screens: ['S-1', 'S-2'] } }))
    expect(notes.some((n) => n.includes('S-1, S-2'))).toBe(true)
  })

  it('고아 참조가 있으면 자동 복구하지 않는다고 적는다', () => {
    const notes = footnotes(summary({ element_tagging: { refs_total: 3, refs_live: 1, refs_stale: 2, not_run_screens: [] } }))
    expect(notes.some((n) => n.includes('자동 복구하지 않는다'))).toBe(true)
  })
})

describe('제안 판정', () => {
  it('발번 제안만 ID 발번으로 본다', () => {
    expect(isIssuanceProposal({ kind: 'issue_ia_id', rationale: '', proposal_hash: 'a' })).toBe(true)
    expect(isIssuanceProposal({ kind: 'issue_fn_id', rationale: '', proposal_hash: 'a' })).toBe(true)
    expect(isIssuanceProposal({ kind: 'link_requirement', rationale: '', proposal_hash: 'a' })).toBe(false)
  })

  it('행위자와 사유가 둘 다 있어야 누를 수 있다 (서버도 같은 검사를 한다)', () => {
    expect(canSubmit('기획자', '갭 승인')).toBe(true)
    expect(canSubmit('', '갭 승인')).toBe(false)
    expect(canSubmit('기획자', '')).toBe(false)
    expect(canSubmit('   ', '   ')).toBe(false)
  })
})

describe('issuanceNotice — 다시 계산한 번호가 다르면 반드시 알린다', () => {
  const node = { id: 'x', project_id: 'p', parent_id: null, name: '견적 목록', order: 0, portal: 'P', kind: 'screen' as const }

  it('같으면 발번 사실만 적는다', () => {
    const msg = issuanceNotice({ ia_node: node, revision: 2, issued_external_id: 'IA-1.1.1', recomputed_external_id: 'IA-1.1.1', differs: false })
    expect(msg).toBe('IA-1.1.1 를 발번했습니다.')
  })

  it('다르면 두 값을 모두 적고 확인을 요청한다 — 조용히 넘어가지 않는다', () => {
    const msg = issuanceNotice({ ia_node: node, revision: 2, issued_external_id: 'IA-9.9.9', recomputed_external_id: 'IA-1.1.1', differs: true }, '견적 목록')
    expect(msg).toContain('IA-9.9.9')
    expect(msg).toContain('IA-1.1.1')
    expect(msg).toContain('확인해 주세요')
  })

  it('다시 계산할 수 없었으면 그 사실을 적는다', () => {
    const msg = issuanceNotice({ ia_node: node, revision: 2, issued_external_id: 'IA-9.9.9', recomputed_external_id: null, differs: true })
    expect(msg).toContain('(계산 불가)')
  })
})
