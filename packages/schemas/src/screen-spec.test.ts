import { describe, expect, it } from 'vitest'
import { DESIGN_EXAMPLE_ORDER_LIST, EXAMPLE_ANCHOR_ID, EXAMPLE_ORDER_LIST, EXAMPLE_ORDER_LIST_EXTENDED, EXAMPLE_PORTAL_MAIN } from './examples.js'
import { ActionType, ElementType, ScreenSpec, ScreenSpecShape, checkScreenSpecReferences, type ScreenSpecInput } from './screen-spec.js'
import { at, issueMessages, issuePaths, unrecognizedKeys } from './test-utils.js'

const extended = (): ScreenSpecInput => structuredClone(EXAMPLE_ORDER_LIST_EXTENDED)

describe('ScreenSpec — 설계 §9 예시', () => {
  it('설계 §9 예시 JSON 이 구조 스키마(ScreenSpecShape)로 그대로 파싱된다', () => {
    const r = ScreenSpecShape.safeParse(DESIGN_EXAMPLE_ORDER_LIST)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.screen_id).toBe('EXAMPLE-order-list')
      expect(r.data.messages).toEqual([])
      expect(r.data.locked_elements).toEqual([])
    }
  })

  it('설계 §9 예시는 "형태 설명용 발췌"라 target=results 가 정의되지 않아 참조 검사(ScreenSpec)에서는 실패한다', () => {
    const r = ScreenSpec.safeParse(DESIGN_EXAMPLE_ORDER_LIST)
    expect(r.success).toBe(false)
    expect(issuePaths(r)).toEqual(['actions.0.target'])
    expect(checkScreenSpecReferences(ScreenSpecShape.parse(DESIGN_EXAMPLE_ORDER_LIST))).toHaveLength(1)
  })

  it('results 영역을 보완한 최소 완성본은 참조 검사까지 통과한다', () => {
    expect(ScreenSpec.safeParse(EXAMPLE_ORDER_LIST).success).toBe(true)
  })

  it('검색·빈 결과·오류 CASE 를 가진 확장 예시가 파싱된다', () => {
    const r = ScreenSpec.safeParse(EXAMPLE_ORDER_LIST_EXTENDED)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.states.map((s) => s.case_kind)).toEqual(['normal', 'normal', 'empty', 'error'])
      expect(r.data.actions.map((a) => a.type)).toEqual(['filter-fixture', 'sort-fixture', 'download-fixture', 'open-popup', 'set-state'])
      expect(at(r.data.data_mapping, 0).evidence).toEqual([{ anchor_id: EXAMPLE_ANCHOR_ID }])
    }
  })
})

describe('ScreenSpec — 참조 무결성 (설계 §9 target 참조 검증, §10 V1)', () => {
  it('actions.target 이 정의되지 않은 id 를 가리키면 실패한다', () => {
    const spec = extended()
    at(spec.actions, 0).target = 'ghost-section'
    const r = ScreenSpec.safeParse(spec)
    expect(issuePaths(r)).toEqual(['actions.0.target'])
    expect(issueMessages(r)[0]).toContain('ghost-section')
  })

  it('요소 trace 가 requirements 에 없는 수용조건을 가리키면 실패한다', () => {
    const spec = extended()
    at(at(spec.sections, 0).elements, 0).trace = ['EXAMPLE-AC-99']
    expect(issuePaths(ScreenSpec.safeParse(spec))).toEqual(['sections.0.elements.0.trace.0'])
  })

  it('동작 trace 가 정의되지 않은 수용조건을 가리키면 실패한다', () => {
    const spec = extended()
    at(spec.actions, 0).trace = ['EXAMPLE-AC-99']
    expect(issuePaths(ScreenSpec.safeParse(spec))).toEqual(['actions.0.trace.0'])
  })

  it('요소 id 가 중복되면 실패한다 (영역·요소 id 는 화면명세 안에서 유일)', () => {
    const spec = extended()
    at(at(spec.sections, 1).elements, 0).id = 'query'
    expect(issuePaths(ScreenSpec.safeParse(spec))).toContain('sections.1.elements.0.id')
  })

  it('요소 id 가 영역 id 와 겹쳐도 실패한다 (target 참조 공간 공유)', () => {
    const spec = extended()
    at(at(spec.sections, 0).elements, 2).id = 'results'
    expect(issuePaths(ScreenSpec.safeParse(spec))).toContain('sections.1.id')
  })

  it('표시 번호(display_no)는 영역마다 반복돼도 오류가 아니다 (설계 §9)', () => {
    const r = ScreenSpec.safeParse(EXAMPLE_ORDER_LIST_EXTENDED)
    expect(r.success).toBe(true)
    if (r.success) {
      const firstNos = r.data.sections.map((s) => at(s.elements, 0).display_no)
      expect(firstNos).toEqual(['a', 'a'])
    }
  })

  it('수용조건 id 가 요구사항 간에 중복되면 실패한다', () => {
    const spec = extended()
    spec.requirements = [
      { id: 'EXAMPLE-REQ-001', criterion_ids: ['EXAMPLE-AC-01', 'EXAMPLE-AC-02', 'EXAMPLE-AC-03'] },
      { id: 'EXAMPLE-REQ-002', criterion_ids: ['EXAMPLE-AC-03'] },
    ]
    expect(issuePaths(ScreenSpec.safeParse(spec))).toEqual(['requirements.1.criterion_ids.0'])
  })

  it('set-state 의 전이 대상 CASE 가 없으면 실패한다', () => {
    const spec = extended()
    at(spec.actions, 4).target_state_id = 'timeout'
    expect(issuePaths(ScreenSpec.safeParse(spec))).toEqual(['actions.4.target_state_id'])
  })

  it('CASE·검증 규칙의 메시지 id 는 messages 에 있어야 한다', () => {
    const spec = extended()
    at(spec.states, 2).message_ids = ['msg-none']
    at(at(at(spec.sections, 0).elements, 0).validations, 0).message_id = 'msg-none'
    expect(issuePaths(ScreenSpec.safeParse(spec))).toEqual(expect.arrayContaining(['states.2.message_ids.0', 'sections.0.elements.0.validations.0.message_id']))
  })

  it('데이터 매핑은 정의된 요소·컬럼을 가리키고 근거 anchor 가 최소 1개 있어야 한다', () => {
    const spec = extended()
    spec.data_mapping = [
      { element_id: 'nope', source: 'x', evidence: [{ anchor_id: EXAMPLE_ANCHOR_ID }] },
      { element_id: 'order-table', column_id: 'nope', source: 'x', evidence: [{ anchor_id: EXAMPLE_ANCHOR_ID }] },
      { element_id: 'query', source: 'x', evidence: [] },
    ]
    expect(issuePaths(ScreenSpec.safeParse(spec))).toEqual(expect.arrayContaining(['data_mapping.0.element_id', 'data_mapping.1.column_id', 'data_mapping.2.evidence']))
  })

  it('잠긴 요소·동작은 정의된 id 여야 한다 (설계 §12)', () => {
    const spec = extended()
    spec.locked_elements = ['ghost']
    spec.locked_actions = ['ghost-action']
    expect(issuePaths(ScreenSpec.safeParse(spec))).toEqual(['locked_elements.0', 'locked_actions.0'])
  })
})

describe('ScreenSpec — 동작·요소 규칙 (설계 §9 제한된 동작·표)', () => {
  it('정렬·다운로드 동작의 target 은 표(또는 표를 포함한 영역)여야 한다', () => {
    const spec = extended()
    at(spec.actions, 2).target = 'query'
    expect(issuePaths(ScreenSpec.safeParse(spec))).toEqual(['actions.2.target'])
    const bySection = extended()
    at(bySection.actions, 2).target = 'results'
    expect(ScreenSpec.safeParse(bySection).success).toBe(true)
  })

  it('open-popup 은 target_screen_id, filter-fixture 는 target 이 없으면 실패한다', () => {
    const spec = extended()
    delete at(spec.actions, 3).target_screen_id
    delete at(spec.actions, 0).target
    expect(issuePaths(ScreenSpec.safeParse(spec))).toEqual(expect.arrayContaining(['actions.3.target_screen_id', 'actions.0.target']))
  })

  it('표의 기본 정렬 컬럼은 columns 안에 있어야 하고, 표가 아닌 요소는 columns 를 가질 수 없다', () => {
    const spec = extended()
    at(at(spec.sections, 1).elements, 0).default_sort = { column_id: 'amount', direction: 'asc' }
    at(at(spec.sections, 0).elements, 0).columns = [{ id: 'x', label: 'x' }]
    expect(issuePaths(ScreenSpec.safeParse(spec))).toEqual(expect.arrayContaining(['sections.1.elements.0.default_sort.column_id', 'sections.0.elements.0.columns']))
  })

  it('허용 컴포넌트·동작 목록 밖의 값(오타 포함)은 실패한다', () => {
    expect(ElementType.safeParse('text_input').success).toBe(false)
    expect(ActionType.safeParse('submit-order').success).toBe(false)
    expect(ActionType.safeParse('call-api').success).toBe(false)
    const spec = extended()
    at(spec.states, 0).case_kind = 'blank' as never
    spec.device = 'Desktop' as never
    expect(issuePaths(ScreenSpec.safeParse(spec))).toEqual(expect.arrayContaining(['states.0.case_kind', 'device']))
  })

  it('unresolved 는 빈 배열이라도 명시해야 하며, 정의되지 않은 최상위 키(html 등)는 거부한다', () => {
    const { unresolved: _omitted, ...withoutUnresolved } = extended()
    expect(issuePaths(ScreenSpec.safeParse(withoutUnresolved))).toEqual(['unresolved'])
    expect(unrecognizedKeys(ScreenSpec.safeParse({ ...extended(), html: '<div/>' }))).toEqual(['html'])
  })
})

describe('내용 표현 3종 — 히어로 · KPI 인포스트립 · 카드 그리드', () => {
  const main = (): ScreenSpecInput => structuredClone(EXAMPLE_PORTAL_MAIN)
  const firstElement = (spec: ScreenSpecInput, section: number, element: number) => at(at(spec.sections, section).elements, element) as Record<string, unknown>

  it('허용 컴포넌트에 세 값이 있고 메인 골든이 참조 검사까지 통과한다', () => {
    for (const t of ['hero', 'stat-strip', 'card-grid']) expect(ElementType.safeParse(t).success, t).toBe(true)
    const r = ScreenSpec.safeParse(EXAMPLE_PORTAL_MAIN)
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(true)
  })

  it('내용 없는 요소는 거부한다 — 빈 상자를 «만들었다» 고 하지 않는다', () => {
    const noHero = main()
    delete firstElement(noHero, 0, 0)['hero']
    expect(issuePaths(ScreenSpec.safeParse(noHero))).toContain('sections.0.elements.0.hero')

    const emptyStats = main()
    firstElement(emptyStats, 1, 0)['stats'] = []
    expect(issuePaths(ScreenSpec.safeParse(emptyStats))).toContain('sections.1.elements.0.stats')

    const emptyCards = main()
    firstElement(emptyCards, 2, 0)['cards'] = []
    expect(issuePaths(ScreenSpec.safeParse(emptyCards))).toContain('sections.2.elements.0.cards')

    const noHeadline = main()
    firstElement(noHeadline, 0, 0)['hero'] = { subcopy: '헤드라인 없음' }
    expect(issuePaths(ScreenSpec.safeParse(noHeadline))).toContain('sections.0.elements.0.hero.headline')
  })

  it('내용 키를 다른 타입에 붙이면 거부한다 (타입 ↔ 내용은 1:1)', () => {
    const wrong = main()
    firstElement(wrong, 1, 0)['hero'] = { headline: '엉뚱한 히어로' }
    firstElement(wrong, 2, 0)['stats'] = [{ label: 'x', value: '1' }]
    firstElement(wrong, 0, 0)['cards'] = [{ title: 'x' }]
    expect(issuePaths(ScreenSpec.safeParse(wrong))).toEqual(
      expect.arrayContaining(['sections.1.elements.0.hero', 'sections.2.elements.0.stats', 'sections.0.elements.0.cards']),
    )
  })

  it('히어로의 검색 안내 문구는 hero.search_placeholder 다 — 공용 placeholder 를 빌려 쓰지 않는다', () => {
    const borrowed = main()
    firstElement(borrowed, 0, 0)['placeholder'] = '통합검색'
    const r = ScreenSpec.safeParse(borrowed)
    expect(issuePaths(r)).toContain('sections.0.elements.0.placeholder')
    expect(issueMessages(r).join(' ')).toContain('hero.search_placeholder')
  })
})
