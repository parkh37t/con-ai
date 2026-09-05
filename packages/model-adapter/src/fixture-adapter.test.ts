import { EXAMPLE_ORDER_LIST_EXTENDED, GenerationOutput, ScreenSpec, ScreenSpecShape, type ScreenSpecShape as Shape } from '@con-ai/schemas'
import { assemblePrompt } from '@con-ai/prompt-templates'
import { describe, expect, it } from 'vitest'
import { deriveScreenName, FixtureAdapter } from './fixture-adapter.js'
import { sampleContext, sampleRequest } from './test-fixtures.js'

const adapter = new FixtureAdapter()

function parseOutput(output: unknown) {
  const r = GenerationOutput.safeParse(output)
  if (!r.success) throw new Error(`GenerationOutput 파싱 실패: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`)
  return r.data
}

function elementsOf<E>(spec: { sections: Array<{ elements: E[] }> }): E[] {
  return spec.sections.flatMap((s) => s.elements)
}

describe('FixtureAdapter.generateSpec — 더미 어댑터 (결정적, 네트워크 없음)', () => {
  it('kind/model/auth 를 더미로 표시한다', () => {
    expect(adapter.kind).toBe('fixture')
    expect(adapter.model).toBe('fixture')
    expect(adapter.auth).toBe('none')
  })

  it('참고 spec 을 복제해 screen_id·baseline·purpose·requirements·CASE·메시지를 맞추고, 결과가 ScreenSpec(참조 검사 포함)으로 파싱된다', async () => {
    const req = sampleRequest({ task_type: 'clone_reference' })
    const ctx = sampleContext()
    const result = await adapter.generateSpec({ prompt: assemblePrompt(req, ctx), ctx, req })
    const out = parseOutput(result.output)
    const spec = out.screen_spec
    expect(spec.screen_id).toBe('SAMPLE-quote-list')
    expect(spec.baseline_id).toBe('sample-baseline-1')
    expect(spec.purpose).toBe(req.purpose)
    expect(spec.shell).toBe('partner-page')
    expect(spec.roles).toEqual(['partner'])
    expect(spec.requirements).toEqual([
      { id: 'SAMPLE-REQ-001', criterion_ids: ['SAMPLE-AC-01', 'SAMPLE-AC-02'] },
      { id: 'SAMPLE-REQ-002', criterion_ids: ['SAMPLE-AC-04'] },
    ])
    // 참고 spec 의 영역·요소는 유지된다
    expect(spec.sections.map((s) => s.id)).toEqual(['search', 'results'])
    // CASE 는 요청에 맞게 다시 만들고 fixture_id 는 <screen>-<case>
    expect(spec.states.map((s) => [s.id, s.fixture_id, s.case_kind])).toEqual([
      ['normal', 'SAMPLE-quote-list-normal', 'normal'],
      ['empty', 'SAMPLE-quote-list-empty', 'empty'],
      ['error', 'SAMPLE-quote-list-error', 'error'],
    ])
    expect(spec.states.find((s) => s.id === 'empty')?.message_ids).toEqual(['msg-empty'])
    expect(spec.messages.map((m) => m.id)).toEqual(expect.arrayContaining(['msg-empty', 'msg-error', 'msg-query-too-long']))
    expect(spec.actions.filter((a) => a.type === 'set-state').map((a) => a.target_state_id)).toEqual(['empty', 'error'])
    // 근거 anchor 가 없는 데이터 매핑은 비우고 unresolved 로 남긴다
    expect(spec.data_mapping).toEqual([])
    expect(out.unresolved.some((u) => u.kind === 'missing_evidence' && u.text.includes('data_mapping'))).toBe(true)
    expect(result.usage).toEqual({ input_tokens: 0, output_tokens: 0 })
    expect(result.stop_reason).toBe('fixture')
  })

  it('UI 수용조건을 요소·동작 trace 에 배분하고 제안(trace_proposals)을 내며, 비UI 조건은 unresolved 질문으로 남긴다', async () => {
    const req = sampleRequest()
    const ctx = sampleContext()
    const out = parseOutput((await adapter.generateSpec({ prompt: assemblePrompt(req, ctx), ctx, req })).output)
    const traced = new Set([...elementsOf(out.screen_spec).flatMap((e) => e.trace ?? []), ...out.screen_spec.actions.flatMap((a) => a.trace ?? [])])
    expect([...traced].sort()).toEqual(['SAMPLE-AC-01', 'SAMPLE-AC-02', 'SAMPLE-AC-04'])
    expect(out.trace_proposals.map((p) => p.criterion_id)).toEqual(['SAMPLE-AC-01', 'SAMPLE-AC-02', 'SAMPLE-AC-04'])
    for (const p of out.trace_proposals) expect(p.status).toBe('candidate')
    expect(out.unresolved.some((u) => u.kind === 'question' && u.related_ids?.includes('SAMPLE-AC-03'))).toBe(true)
    expect(traced.has('SAMPLE-AC-03')).toBe(false)
    // 참고 spec 의 예전 trace(EXAMPLE-AC-*) 는 남지 않는다
    expect([...traced].some((t) => t.startsWith('EXAMPLE-'))).toBe(false)
  })

  it('참고 spec 이 없으면 목록 기본 템플릿(검색 영역 + 표 + 버튼)을 만들고 create 는 화면명을 반영한다', async () => {
    const req = sampleRequest({ task_type: 'create', reference_ids: [], cases: ['normal', 'empty'] })
    const ctx = sampleContext({ references: [] })
    const result = await adapter.generateSpec({ prompt: assemblePrompt(req, ctx), ctx, req })
    const out = parseOutput(result.output)
    const spec = out.screen_spec
    expect(spec.purpose).toBe('견적 목록 — 파트너 견적 목록 조회 화면을 만든다')
    expect(spec.sections.map((s) => s.id)).toEqual(['search', 'results'])
    expect(spec.sections[1]?.title).toBe('견적 목록 목록')
    expect(elementsOf(spec).map((e) => e.id)).toEqual(['query', 'period', 'search-button', 'result-table', 'download-button', 'pager'])
    expect(spec.actions.map((a) => a.type)).toEqual(['filter-fixture', 'sort-fixture', 'download-fixture', 'set-state'])
    expect(spec.states.map((s) => s.fixture_id)).toEqual(['SAMPLE-quote-list-normal', 'SAMPLE-quote-list-empty'])
    expect(out.change_summary.added_ids).toEqual(expect.arrayContaining(['search', 'result-table', 'search-submit', 'empty']))
    expect(out.change_summary.summary).toContain('기본 목록 템플릿')
  })

  it('CASE 5종을 모두 요청하면 5개 상태·메시지를 만들고 권한 CASE 에 역할을 적는다; normal 이 빠져도 넣는다', async () => {
    const req = sampleRequest({ cases: ['empty', 'error', 'permission', 'processing'] })
    const ctx = sampleContext()
    const out = parseOutput((await adapter.generateSpec({ prompt: assemblePrompt(req, ctx), ctx, req })).output)
    expect(out.screen_spec.states.map((s) => s.id)).toEqual(['normal', 'empty', 'error', 'permission', 'processing'])
    expect(out.screen_spec.states.find((s) => s.id === 'permission')?.role).toBe('partner')
    expect(out.screen_spec.messages.map((m) => m.id)).toEqual(expect.arrayContaining(['msg-permission', 'msg-processing']))
  })

  it('수용조건을 고르지 않으면(criterion_ids 빈 배열) 모든 UI 조건을 쓰고, UI 조건이 없으면 missing_evidence 를 남긴다', async () => {
    const ctx = sampleContext()
    const all = parseOutput((await adapter.generateSpec({ prompt: assemblePrompt(sampleRequest({ criterion_ids: [] }), ctx), ctx, req: sampleRequest({ criterion_ids: [] }) })).output)
    expect(all.trace_proposals).toHaveLength(3)
    const none = sampleRequest({ criterion_ids: ['SAMPLE-AC-03'] })
    const out = parseOutput((await adapter.generateSpec({ prompt: assemblePrompt(none, ctx), ctx, req: none })).output)
    expect(out.screen_spec.requirements).toEqual([])
    expect(out.unresolved.some((u) => u.kind === 'missing_evidence' && u.text.includes('UI 수용조건'))).toBe(true)
  })

  it('결정적이다 — 같은 입력이면 같은 출력', async () => {
    const req = sampleRequest()
    const ctx = sampleContext()
    const a = await adapter.generateSpec({ prompt: assemblePrompt(req, ctx), ctx, req })
    const b = await adapter.generateSpec({ prompt: assemblePrompt(req, ctx), ctx, req })
    expect(a).toEqual(b)
  })

  it('deriveScreenName 은 제목을 우선하고 없으면 목적 문장에서 화면명을 뽑는다', () => {
    expect(deriveScreenName('아무 목적', '견적 상세')).toBe('견적 상세')
    expect(deriveScreenName('견적 등록 팝업을 만든다', '')).toBe('견적 등록 팝업')
    expect(deriveScreenName('파트너 견적 목록 화면을 작성한다.', '')).toBe('파트너 견적 목록')
    expect(deriveScreenName('', '')).toBe('목록')
  })
})

describe('FixtureAdapter.reviseSpec — 코멘트 단순 규칙', () => {
  const current: Shape = ScreenSpecShape.parse(EXAMPLE_ORDER_LIST_EXTENDED)
  const comments = [
    { id: 'c-req', role: 'developer', author: '개발자B', text: '검색어는 필수 입력으로 해주세요', element_id: 'query', target: 'screen' },
    { id: 'c-label', role: 'designer', author: '디자이너A', text: '기간 라벨을 "주문일자"로 변경', element_id: 'period', target: 'screen' },
    { id: 'c-msg', role: 'client', author: '고객C', text: '빈 결과 문구는 "검색 조건에 맞는 주문이 없습니다."로', case_id: 'empty', target: 'description' },
    { id: 'c-del', role: 'planner', author: '기획자D', text: '페이지 요소는 삭제', element_id: 'pager', target: 'screen' },
    { id: 'c-lock', role: 'developer', author: '개발자B', text: '표 컬럼을 제거해 주세요', element_id: 'order-table', target: 'screen' },
    { id: 'c-etc', role: 'designer', author: '디자이너A', text: '전체 톤을 밝게', target: 'screen' },
  ]

  it('필수/라벨/메시지/삭제 규칙을 적용하고 잠긴 요소·기타는 unresolved 에 남기며 결과가 ScreenSpec 으로 파싱된다', async () => {
    const ctx = sampleContext({ base_spec: current, comments })
    const req = sampleRequest({ task_type: 'edit', base_revision_id: 'rev-1' })
    const result = await adapter.reviseSpec({ prompt: assemblePrompt(req, ctx), ctx, req, current })
    const out = parseOutput(result.output)
    const spec = out.screen_spec
    const el = (id: string) => elementsOf(spec).find((e) => e.id === id)
    expect(el('query')?.required).toBe(true)
    expect(el('period')?.label).toBe('주문일자')
    expect(spec.messages.find((m) => m.id === 'msg-empty')?.text).toBe('검색 조건에 맞는 주문이 없습니다.')
    expect(el('pager')).toBeUndefined()
    // 잠긴 요소는 그대로
    expect(el('order-table')).toBeDefined()
    expect(el('order-table')?.columns).toHaveLength(3)
    expect(out.unresolved.find((u) => u.kind === 'conflict')?.related_ids).toEqual(['order-table'])
    expect(out.unresolved.find((u) => u.kind === 'question')?.text).toContain('전체 톤을 밝게')
    expect(out.change_summary.changed_ids).toEqual(['query', 'period', 'msg-empty'])
    expect(out.change_summary.removed_ids).toEqual(['pager'])
    expect(out.change_summary.locked_violations).toEqual([])
    expect(out.change_summary.summary).toContain('4건 반영')
    expect(ScreenSpec.safeParse(spec).success).toBe(true)
  })

  it('요소 삭제 시 그 요소를 가리키는 동작·잠금 참조도 정리한다', async () => {
    const ctx = sampleContext({ base_spec: current, comments: [{ id: 'c-1', role: 'planner', author: 'P', text: '엑셀 다운로드 버튼 제거', element_id: 'download-button', target: 'screen' }] })
    const req = sampleRequest({ task_type: 'edit' })
    const out = parseOutput((await adapter.reviseSpec({ prompt: assemblePrompt(req, ctx), ctx, req, current })).output)
    expect(out.screen_spec.actions.map((a) => a.id)).not.toContain('download-orders')
    expect(out.screen_spec.locked_actions).toEqual([])
    expect(out.change_summary.removed_ids).toEqual(['download-button'])
  })

  it('메시지가 없는 CASE 에 문구 코멘트가 오면 메시지를 추가하고 CASE 에 연결한다; "필수 아님" 은 required=false', async () => {
    const base = structuredClone(current)
    const searched = base.states.find((s) => s.id === 'searched')
    if (searched === undefined) throw new Error('테스트 데이터 오류')
    delete searched.message_ids
    const ctx = sampleContext({
      base_spec: base,
      comments: [
        { id: 'c-1', role: 'client', author: 'C', text: '검색 결과 안내 문구 "1건이 검색되었습니다." 추가', case_id: 'searched', target: 'description' },
        { id: 'c-2', role: 'developer', author: 'D', text: '검색어는 필수 아님', element_id: 'query', target: 'screen' },
      ],
    })
    const req = sampleRequest({ task_type: 'edit' })
    const out = parseOutput((await adapter.reviseSpec({ prompt: assemblePrompt(req, ctx), ctx, req, current: base })).output)
    expect(out.screen_spec.messages.find((m) => m.id === 'msg-searched')?.text).toBe('1건이 검색되었습니다.')
    expect(out.screen_spec.states.find((s) => s.id === 'searched')?.message_ids).toEqual(['msg-searched'])
    expect(out.change_summary.added_ids).toEqual(['msg-searched'])
    expect(elementsOf(out.screen_spec).find((e) => e.id === 'query')?.required).toBe(false)
  })

  it('comment_ids 로 고른 코멘트만 반영하고, 코멘트가 없으면 바꾸지 않고 질문을 남긴다', async () => {
    const ctx = sampleContext({ base_spec: current, comments })
    const req = sampleRequest({ task_type: 'edit', comment_ids: ['c-req'] })
    const out = parseOutput((await adapter.reviseSpec({ prompt: assemblePrompt(req, ctx), ctx, req, current })).output)
    expect(out.change_summary.changed_ids).toEqual(['query'])
    expect(elementsOf(out.screen_spec).find((e) => e.id === 'pager')).toBeDefined()
    const none = sampleRequest({ task_type: 'edit', comment_ids: [] })
    const outNone = parseOutput((await adapter.reviseSpec({ prompt: assemblePrompt(none, ctx), ctx, req: none, current })).output)
    expect(outNone.change_summary.changed_ids).toEqual([])
    expect(outNone.unresolved[0]?.text).toContain('반영할 코멘트가 없어')
    expect(outNone.screen_spec.sections).toEqual(current.sections)
  })
})

describe('FixtureAdapter.draftRevisionPrompt — 코멘트 묶음 지시문', () => {
  it('역할·요소·CASE 별로 묶은 한국어 지시문과 rationale 을 만들고 잠긴 요소를 표시한다', async () => {
    const current: Shape = ScreenSpecShape.parse(EXAMPLE_ORDER_LIST_EXTENDED)
    const comments = [
      { id: 'c-1', role: 'designer', author: '디자이너A', text: '검색어 라벨 정리', element_id: 'query', target: 'screen' },
      { id: 'c-2', role: 'designer', author: '디자이너A', text: '빈 결과 문구 톤 조정', case_id: 'empty', target: 'description' },
      { id: 'c-3', role: 'developer', author: '개발자B', text: '표 컬럼 순서 변경', element_id: 'order-table', target: 'screen' },
      { id: 'c-4', role: 'client', author: '고객C', text: '전반적으로 좋아요', target: 'screen' },
    ]
    const { prompt, rationale } = await adapter.draftRevisionPrompt({ ctx: sampleContext(), current, comments })
    expect(prompt).toContain('화면 SAMPLE-quote-list(견적 목록) 명세를 수정한다')
    expect(prompt).toContain('[디자이너 코멘트]')
    expect(prompt).toContain('- 요소 query(검색어, 영역 search): "검색어 라벨 정리" (디자이너A)')
    expect(prompt).toContain('- CASE empty: "빈 결과 문구 톤 조정" (디자이너A)')
    expect(prompt).toContain('[개발자 코멘트]')
    expect(prompt).toContain('요소 order-table(주문 목록 표, 영역 results): "표 컬럼 순서 변경" (개발자B) ← 잠긴 요소')
    expect(prompt).toContain('[고객 코멘트]')
    expect(prompt).toContain('대상 미지정(screen): "전반적으로 좋아요" (고객C)')
    expect(prompt).toContain('잠긴 요소·동작(order-table, download-orders)은 변경하지 않는다')
    expect(prompt).toContain('change_summary')
    expect(rationale).toContain('코멘트 4건을 역할 3개(디자이너 2, 개발자 1, 고객 1)로 묶었다')
    expect(rationale).toContain('요소 지정 2건, CASE 지정 1건, 대상 미지정 1건')
    expect(rationale).toContain('잠긴 요소를 가리키는 코멘트 1건(order-table)')
  })
})
