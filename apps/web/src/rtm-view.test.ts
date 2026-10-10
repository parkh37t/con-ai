import { describe, expect, it } from 'vitest'
import { issuanceNotice } from './pages/TraceMatrixPage.js'
import { PROPOSAL_INPUT_PLACEHOLDERS, PROPOSAL_SUBMIT_LABELS, canSubmit, footnotes, idCellText, isIssuanceProposal, issuanceFunctionId, kpiCells, proposalAction, ratioText, resolveScreenPlanId, showsFullCoverageBanner, withStorageWarning } from './rtm-view.js'
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
    screens_built: 1,
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

  it('요소 태깅을 판정하지 못한 화면이 있으면 이름과 **두 가지 이유**를 함께 적는다', () => {
    const notes = footnotes(summary({ element_tagging: { refs_total: 2, refs_live: 0, refs_stale: 0, not_run_screens: ['S-1', 'S-2'] } }))
    expect(notes.some((n) => n.includes('S-1, S-2'))).toBe(true)
    // 이 목록은 「목업 미생성」과 「명세를 읽지 못함」을 함께 담는다 — 한쪽 문구로만 적으면 다른 쪽을 틀리게 적는다.
    const note = notes.find((n) => n.includes('S-1, S-2')) ?? ''
    expect(note).toContain('목업 미생성')
    expect(note).toContain('명세를 읽지 못함')
  })

  it('화면이 모두 생성됐으면 생성 수 각주를 적지 않는다 (없는 문제를 만들지 않는다)', () => {
    const notes = footnotes(summary({ screens_total: 3, screens_built: 3 }))
    expect(notes.some((n) => n.includes('목업이 만들어진 것은'))).toBe(false)
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

/**
 * 제안 → 요청 변환.
 *
 * 예전에는 화면이 「보고서 전체의 첫 미발번 기능」을 집어 보냈다. 그게 다른 노드의 기능이면
 * `기능 <uuid> 가 이 IA 노드에 없다` 로 400 이 났다. 이제 제안이 대상을 직접 들고 온다.
 */
describe('issuanceFunctionId — 대상 기능을 짐작하지 않는다', () => {
  it('issue_fn_id 는 제안이 들고 온 기능 id 를 그대로 쓴다', () => {
    expect(issuanceFunctionId({ kind: 'issue_fn_id', function_id: 'fn-uuid-1' })).toBe('fn-uuid-1')
  })

  it('발번이 아닌 제안·IA 발번에는 기능 id 가 없다', () => {
    expect(issuanceFunctionId({ kind: 'issue_ia_id' })).toBeUndefined()
    expect(issuanceFunctionId({ kind: 'link_screen' })).toBeUndefined()
    expect(issuanceFunctionId({ kind: 'define_function' })).toBeUndefined()
    expect(issuanceFunctionId({ kind: 'link_requirement' })).toBeUndefined()
  })

  it('issue_fn_id 인데 대상이 없으면 요청을 보내지 않고 사람에게 알린다', () => {
    expect(() => issuanceFunctionId({ kind: 'issue_fn_id' })).toThrow('대상 기능이 없습니다')
    expect(() => issuanceFunctionId({ kind: 'issue_fn_id', function_id: '  ' })).toThrow('대상 기능이 없습니다')
  })
})

describe('제안 버튼·입력칸 문구 — 종류마다 다른 일을 한다', () => {
  const KINDS = ['link_requirement', 'define_function', 'link_screen', 'issue_ia_id', 'issue_fn_id'] as const

  it('다섯 종류 모두 버튼·안내 문구가 있다 (빠지면 엉뚱한 버튼이 된다)', () => {
    for (const k of KINDS) {
      expect(PROPOSAL_SUBMIT_LABELS[k], k).toBeTruthy()
      expect(PROPOSAL_INPUT_PLACEHOLDERS[k], k).toBeTruthy()
    }
    expect(Object.keys(PROPOSAL_SUBMIT_LABELS).sort()).toEqual([...KINDS].sort())
    expect(Object.keys(PROPOSAL_INPUT_PLACEHOLDERS).sort()).toEqual([...KINDS].sort())
  })

  it('화면 연결은 「기능 추가」가 아니라 「화면 연결」이고, 사람이 보는 화면 외부 ID 를 받는다', () => {
    expect(PROPOSAL_SUBMIT_LABELS.link_screen).toBe('화면 연결')
    expect(PROPOSAL_SUBMIT_LABELS.link_screen).not.toBe(PROPOSAL_SUBMIT_LABELS.define_function)
    expect(PROPOSAL_INPUT_PLACEHOLDERS.link_screen).toContain('화면 외부 ID')
  })
})

/**
 * 저장 실패를 삼키지 않는다.
 *
 * 정적 데모는 결과를 localStorage 에 쌓는다. 용량 초과·사생활 보호 모드면 저장이 실패하고
 * 응답에 `storage_warning` 이 실리는데, 그걸 버리면 아무것도 남지 않았는데 초록색
 * 「연결했습니다」 가 뜬다.
 */
describe('withStorageWarning — 조용히 성공으로 보이게 두지 않는다', () => {
  it('경고가 있으면 성공 문구에 덧붙인다', () => {
    const msg = withStorageWarning('연결했습니다', { storage_warning: '이 브라우저에 저장하지 못했습니다 — 새로고침하면 사라집니다.' })
    expect(msg).toContain('연결했습니다')
    expect(msg).toContain('저장하지 못했습니다')
  })

  it('경고가 없으면 문구를 그대로 둔다', () => {
    expect(withStorageWarning('연결했습니다', { ia_node: {}, revision: 2 })).toBe('연결했습니다')
    expect(withStorageWarning('연결했습니다', null)).toBe('연결했습니다')
    expect(withStorageWarning('연결했습니다', undefined)).toBe('연결했습니다')
    expect(withStorageWarning('연결했습니다', { storage_warning: '  ' })).toBe('연결했습니다')
  })
})

/**
 * 제안 종류 → 쓰기. **고친 버그 본체**다.
 *
 * 예전에는 `submit` 이 `else` 폴백으로 끝나 `link_screen`(화면 연결)이 `onDefineFunction`(기능 추가)으로
 * 샜다. 승인하면 화면은 안 붙고 사유·행위자가 붙은 거짓 기능이 IA 노드에 남았다.
 *
 * 정확히 적자면 — `proposalAction` 은 **이번에 꺼낸 함수**이므로 고치기 전 코드에서는 돌 수조차 없었다.
 * 이 테스트가 하는 일은 그때의 잘못된 매핑(link_screen → define_function)이 **다시 들어오지 못하게
 * 못 박는 것**이다. 분기가 화면 안에 묶여 있던 동안은 실행 테스트가 아예 불가능했다.
 */
describe('proposalAction — 화면 연결이 기능 추가로 새지 않는다', () => {
  it('종류마다 가는 쓰기가 정해져 있다', () => {
    expect(proposalAction('issue_ia_id')).toBe('issue')
    expect(proposalAction('issue_fn_id')).toBe('issue')
    expect(proposalAction('link_requirement')).toBe('link_requirement')
    expect(proposalAction('link_screen')).toBe('link_screen')
    expect(proposalAction('define_function')).toBe('define_function')
  })

  it('link_screen 은 define_function 으로 가지 않는다 (고친 결함)', () => {
    expect(proposalAction('link_screen')).not.toBe('define_function')
  })

  it('다섯 종류가 서로 다른 쓰기로 흩어지지 않고, 발번 둘만 같은 쓰기를 쓴다', () => {
    const kinds = ['link_requirement', 'define_function', 'link_screen', 'issue_ia_id', 'issue_fn_id'] as const
    const actions = kinds.map((k) => proposalAction(k))
    expect(new Set(actions).size).toBe(4)
    expect(actions.filter((a) => a === 'issue')).toHaveLength(2)
  })

  it('모르는 종류가 런타임에 오면 조용히 넘어가지 않고 던진다', () => {
    expect(() => proposalAction('무엇인가' as Parameters<typeof proposalAction>[0])).toThrow('모르는 제안 종류')
  })
})

/**
 * 사람이 넣은 화면 **외부 ID** → 저장에 쓰는 **내부 UUID**.
 * 섞으면 연결이 조용히 어긋난다 (`.claude/skills/ID와-추적체인`).
 */
describe('resolveScreenPlanId — 외부 ID 를 내부 UUID 로 옮긴다', () => {
  const SCREENS = [
    { id: 'a4000000-0000-4000-8000-000000000001', external_id: 'SCREEN-001' },
    { id: 'a4000000-0000-4000-8000-000000000002', external_id: 'SCREEN-002' },
  ]

  it('외부 ID 로 찾아 내부 UUID 를 돌려준다 (앞뒤 공백은 떼고)', () => {
    expect(resolveScreenPlanId('SCREEN-002', SCREENS)).toBe('a4000000-0000-4000-8000-000000000002')
    expect(resolveScreenPlanId('  SCREEN-001  ', SCREENS)).toBe('a4000000-0000-4000-8000-000000000001')
  })

  it('내부 UUID 를 그대로 넣으면 **찾지 못한다** — 사람이 보는 값만 받는다', () => {
    expect(() => resolveScreenPlanId('a4000000-0000-4000-8000-000000000001', SCREENS)).toThrow('없습니다')
  })

  it('없는 화면이면 있는 화면 목록을 함께 알린다 (외부 ID 를 외우게 하지 않는다)', () => {
    const err = (() => {
      try {
        resolveScreenPlanId('SCREEN-999', SCREENS)
        return ''
      } catch (e) {
        return e instanceof Error ? e.message : String(e)
      }
    })()
    expect(err).toContain('SCREEN-999')
    expect(err).toContain('SCREEN-001, SCREEN-002')
  })

  it('화면이 하나도 없으면 목록 문구를 붙이지 않는다', () => {
    expect(() => resolveScreenPlanId('SCREEN-001', [])).toThrow(/없습니다\. 화면 외부 ID 를 넣으세요$/)
  })
})
