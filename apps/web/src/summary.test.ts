import { describe, expect, it } from 'vitest'
import { approvalPrecheck, buildIATree, caseButtons, countOpenBlockingComments, countOpenComments, summarizeSpec, summarizeValidation } from './summary.js'
import type { IANode, ValidationResult } from './types.js'

const H = 'a'.repeat(64)
const vr = (check_id: string, status: ValidationResult['status'], over: Partial<ValidationResult> = {}): ValidationResult => ({
  id: `vr-${check_id}`,
  artifact_hash: H,
  check_id,
  stage: check_id.slice(0, 2).toUpperCase(),
  status,
  required: true,
  evidence: [],
  ...over,
})

describe('summarizeValidation — 검증 요약 집계', () => {
  it('네 상태를 각각 세고 빈 목록은 전부 0', () => {
    expect(summarizeValidation([])).toEqual({ pass: 0, fail: 0, error: 0, not_run: 0 })
    expect(summarizeValidation([vr('v1.schema', 'pass'), vr('v2.shell', 'pass'), vr('v3.console', 'error'), vr('v1.cases', 'fail'), vr('v3.search', 'not_run')])).toEqual({
      pass: 2,
      fail: 1,
      error: 1,
      not_run: 1,
    })
  })

  it('알 수 없는 상태 값은 어느 칸에도 넣지 않는다 (통과·미실행으로 위장하지 않음)', () => {
    expect(summarizeValidation([{ status: 'ok' as ValidationResult['status'] }])).toEqual({ pass: 0, fail: 0, error: 0, not_run: 0 })
  })
})

describe('코멘트 집계', () => {
  const comments = [
    { status: 'open' as const, blocking: true },
    { status: 'open' as const, blocking: false },
    { status: 'resolved' as const, blocking: true },
    { status: 'wont_fix' as const, blocking: true },
  ]
  it('열린 코멘트·열린 차단 코멘트 수', () => {
    expect(countOpenComments(comments)).toBe(2)
    expect(countOpenBlockingComments(comments)).toBe(1)
    expect(countOpenBlockingComments([])).toBe(0)
  })
})

describe('approvalPrecheck — 승인 사전 판정(서버 판정 대신이 아님)', () => {
  const base = { artifact_status: 'review_ready' as const, artifact_hash: H, validation_results: [vr('v1.schema', 'pass'), vr('v2.shell', 'pass')], comments: [] }

  it('필수 검사 전부 pass + 차단 코멘트 0 + review_ready 면 ok', () => {
    const r = approvalPrecheck(base)
    expect(r.ok).toBe(true)
    expect(r.reasons).toEqual([])
    expect(r.summary).toEqual({ pass: 2, fail: 0, error: 0, not_run: 0 })
    expect(r.open_blocking).toBe(0)
  })

  it('필수 검사 fail/error/not_run 은 각각 이유가 된다. 선택 검사는 막지 않는다', () => {
    const r = approvalPrecheck({
      ...base,
      validation_results: [...base.validation_results, vr('v3.console', 'error'), vr('v3.case', 'not_run'), vr('v4.a11y', 'fail', { required: false })],
    })
    expect(r.ok).toBe(false)
    expect(r.required_blockers).toEqual(['v3.console(V3) 오류', 'v3.case(V3) 미실행'])
    expect(r.reasons).toHaveLength(2)
    expect(r.reasons[0]).toContain('v3.console')
    expect(r.reasons[1]).toContain('v3.case')
  })

  it('다른 hash 의 결과는 무시하고 그 사실을 이유로 남긴다; 결과가 하나도 없으면 통과가 아니다', () => {
    const foreign = approvalPrecheck({ ...base, validation_results: [vr('v1.schema', 'pass', { artifact_hash: 'b'.repeat(64) })] })
    expect(foreign.ok).toBe(false)
    expect(foreign.summary).toEqual({ pass: 0, fail: 0, error: 0, not_run: 0 })
    expect(foreign.reasons.some((m) => m.includes('검증 결과가 없습니다'))).toBe(true)
    expect(foreign.reasons.some((m) => m.includes('다른 artifact hash'))).toBe(true)
  })

  it('열린 차단 코멘트와 review_ready 가 아닌 상태는 막는다', () => {
    const r = approvalPrecheck({ ...base, artifact_status: 'validation_pending', comments: [{ status: 'open', blocking: true }, { status: 'open', blocking: true }, { status: 'resolved', blocking: true }] })
    expect(r.ok).toBe(false)
    expect(r.open_blocking).toBe(2)
    expect(r.reasons[0]).toContain('검증 대기')
    expect(r.reasons[1]).toContain('열린 차단 코멘트 2건')
  })
})

describe('buildIATree — To-Be IA 트리', () => {
  const node = (id: string, parent_id: string | null, order: number, kind: IANode['kind'] = 'category'): IANode => ({ id, project_id: 'p', parent_id, name: id, order, portal: '포털', kind })

  it('parent_id 로 계층을 만들고 형제는 order 순으로 정렬한다', () => {
    const tree = buildIATree([node('list', 'quote', 0, 'screen'), node('portal', null, 0), node('quote', 'portal', 0), node('create', 'quote', 2, 'screen'), node('detail', 'quote', 1, 'screen')])
    expect(tree.map((t) => t.node.id)).toEqual(['portal'])
    expect(tree[0]?.children.map((t) => t.node.id)).toEqual(['quote'])
    expect(tree[0]?.children[0]?.children.map((t) => t.node.id)).toEqual(['list', 'detail', 'create'])
  })

  it('부모가 목록에 없는 노드는 잃지 않고 최상위로 올린다', () => {
    const tree = buildIATree([node('orphan', 'missing', 0), node('root', null, 1)])
    expect(tree.map((t) => t.node.id)).toEqual(['orphan', 'root'])
  })

  it('빈 목록은 빈 트리', () => {
    expect(buildIATree([])).toEqual([])
  })
})

describe('summarizeSpec / caseButtons — 레퍼런스 spec 요약', () => {
  const spec = {
    sections: [
      { id: 'search', title: '검색', elements: [{ id: 'q', type: 'text-input', label: '검색어' }] },
      { id: 'results', title: '결과', elements: [{ id: 'table', type: 'table', label: '목록' }, { id: 'pager', type: 'pagination', label: '페이지' }] },
    ],
    states: [{ id: 'normal', case_kind: 'normal' as const }, { id: 'empty-result' }, { id: 'err', case_kind: 'error' as const }],
    actions: [{ id: 'a', type: 'filter-fixture' }],
    messages: [],
    unresolved: [{ kind: 'question', text: '?' }],
    locked_elements: ['table'],
    locked_actions: [],
  }

  it('영역·요소·CASE·동작·메시지·미확정·잠금 수', () => {
    expect(summarizeSpec(spec)).toEqual({ sections: 2, elements: 3, cases: 3, actions: 1, messages: 0, unresolved: 1, locked: 1 })
    expect(summarizeSpec(undefined)).toEqual({ sections: 0, elements: 0, cases: 0, actions: 0, messages: 0, unresolved: 0, locked: 0 })
  })

  it('CASE 버튼은 case_kind 를 쓰고 없으면 id 에서 추정한다', () => {
    expect(caseButtons(spec)).toEqual([
      { id: 'normal', kind: 'normal', label: '정상 (normal)' },
      { id: 'empty-result', kind: 'empty', label: '빈값 (empty-result)' },
      { id: 'err', kind: 'error', label: '오류 (err)' },
    ])
    expect(caseButtons(null)).toEqual([])
  })
})
