import { describe, expect, it } from 'vitest'
import { EXAMPLE_ORDER_LIST_EXTENDED } from './examples.js'
import { GenerationOutput, GenerationRequest, type GenerationOutputInput, type GenerationRequestInput } from './prompt.js'
import { issuePaths, unrecognizedKeys } from './test-utils.js'

const UUID = '11111111-1111-4111-8111-111111111111'

const request = (): GenerationRequestInput => ({
  target: { project_id: UUID, screen_external_id: 'EXAMPLE-order-list', portal: '수요기관', device: 'desktop', roles: ['buyer'] },
  task: { type: 'edit', purpose: '검색 결과 없음 문구 변경', change_scope: 'results 영역 빈 상태 문구만' },
  baseline: { baseline_id: 'example-baseline-1', requirement_ids: ['EXAMPLE-REQ-001'], criterion_ids: ['EXAMPLE-AC-01'] },
  references: { golden_screen_revision_ids: [UUID], shell: 'buyer-page' },
  cases: [{ kind: 'normal' }, { kind: 'empty', condition: '검색 결과 0건' }, { kind: 'error' }],
  constraints: { locked_element_ids: ['order-table'], preserved_behaviors: ['기본 정렬 유지'] },
  output: { kinds: ['screen_spec', 'trace_proposals', 'unresolved', 'change_summary'] },
})

const output = (): GenerationOutputInput => ({
  screen_spec: structuredClone(EXAMPLE_ORDER_LIST_EXTENDED),
  trace_proposals: [{ requirement_id: 'EXAMPLE-REQ-001', criterion_id: 'EXAMPLE-AC-01', element_or_action_id: 'query', rationale: '검색어 입력' }],
  unresolved: [],
  change_summary: { summary: '빈 상태 문구 변경', changed_ids: ['msg-empty'] },
})

describe('프롬프트 입력 폼 (설계 §8 7구역)', () => {
  it('대상/작업/기준/참고/CASE/유지 조건/산출 7구역이 모두 있으면 파싱된다', () => {
    const r = GenerationRequest.safeParse(request())
    expect(r.success).toBe(true)
    if (r.success) expect(Object.keys(r.data)).toEqual(['target', 'task', 'baseline', 'references', 'cases', 'constraints', 'output'])
  })

  it('수정 작업에 기존 화면 ID 가 없거나 참조 복제에 golden 버전이 없으면 실패한다', () => {
    const edit = request()
    delete edit.target.screen_external_id
    expect(issuePaths(GenerationRequest.safeParse(edit))).toEqual(['target.screen_external_id'])
    const clone = request()
    clone.task = { type: 'clone_reference', purpose: '유사 목록 복제' }
    clone.references = {}
    expect(issuePaths(GenerationRequest.safeParse(clone))).toEqual(['references.golden_screen_revision_ids'])
  })

  it('폼에 없는 구역(모델 이름 등)은 거부한다 — 모델 설정은 서버가 관리한다 (설계 §2, §8)', () => {
    expect(unrecognizedKeys(GenerationRequest.safeParse({ ...request(), model: 'some-model' }))).toEqual(['model'])
  })
})

describe('프롬프트 출력 계약 (설계 §8)', () => {
  it('ScreenSpec·trace_proposals·unresolved·change_summary 를 담은 출력이 파싱되고 제안은 candidate 다', () => {
    const r = GenerationOutput.safeParse(output())
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.trace_proposals.map((p) => p.status)).toEqual(['candidate'])
  })

  it('HTML 은 이 단계의 출력이 아니므로 html 키가 있으면 실패한다', () => {
    expect(unrecognizedKeys(GenerationOutput.safeParse({ ...output(), html: '<div/>' }))).toEqual(['html'])
  })

  it('제안이 화면명세에 없는 요소·수용조건을 가리키면 실패한다', () => {
    const out = output()
    out.trace_proposals = [{ requirement_id: 'EXAMPLE-REQ-009', criterion_id: 'EXAMPLE-AC-99', element_or_action_id: 'ghost' }]
    expect(issuePaths(GenerationOutput.safeParse(out))).toEqual(
      expect.arrayContaining(['trace_proposals.0.element_or_action_id', 'trace_proposals.0.criterion_id', 'trace_proposals.0.requirement_id']),
    )
  })

  it('출력 안의 화면명세도 참조 무결성 검사를 받는다', () => {
    const out = output()
    out.screen_spec.locked_elements = ['ghost']
    expect(issuePaths(GenerationOutput.safeParse(out))).toEqual(['screen_spec.locked_elements.0'])
  })
})
