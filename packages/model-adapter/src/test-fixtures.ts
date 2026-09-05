/** 테스트 보조 — 합성 요청·문맥과 SDK 응답 흉내 (index.ts 에서 재수출하지 않는다). 실제 네트워크는 쓰지 않는다. */
import type { ClientOptions } from '@anthropic-ai/sdk'
import { EXAMPLE_ORDER_LIST_EXTENDED, type ScreenSpecInput } from '@con-ai/schemas'
import type { GenerationContext, SliceGenerationRequest } from '@con-ai/prompt-templates'
import type { WireOutput } from './wire-schema.js'

export const REQ_UUID = '33333333-3333-4333-8333-333333333333'
export const SCREEN_UUID = '44444444-4444-4444-8444-444444444444'

export function sampleRequest(overrides: Partial<SliceGenerationRequest> = {}): SliceGenerationRequest {
  return {
    screen_id: SCREEN_UUID,
    task_type: 'create',
    purpose: '파트너 견적 목록 조회 화면을 만든다',
    scope: '검색 영역과 목록 표',
    requirement_ids: [REQ_UUID],
    criterion_ids: ['SAMPLE-AC-01', 'SAMPLE-AC-02', 'SAMPLE-AC-03', 'SAMPLE-AC-04'],
    reference_ids: ['ref-list-golden'],
    cases: ['normal', 'empty', 'error'],
    keep_conditions: ['견적번호 컬럼 유지'],
    roles: ['partner'],
    device: 'desktop',
    ...overrides,
  }
}

export function sampleContext(overrides: Partial<GenerationContext> = {}): GenerationContext {
  return {
    project: { name: '와일리 컨버전스 샘플 — 파트너 견적 포털', org: '와일리', profile_id: 's2b-learned-v1' },
    screen: { external_id: 'SAMPLE-quote-list', title: '견적 목록', shell: 'partner-page', device: 'desktop' },
    requirements: [
      {
        external_id: 'SAMPLE-REQ-001',
        title: '견적 목록 조회',
        body: '파트너는 자신의 견적을 기간·상태로 검색해 목록으로 본다.',
        criteria: [
          { id: 'SAMPLE-AC-01', text: '견적번호·기간으로 검색할 수 있다', kind: 'ui' },
          { id: 'SAMPLE-AC-02', text: '목록은 견적일 내림차순으로 표시한다', kind: 'ui' },
          { id: 'SAMPLE-AC-03', text: '야간 배치로 견적 상태를 동기화한다', kind: 'non_ui' },
        ],
      },
      {
        external_id: 'SAMPLE-REQ-002',
        title: '견적 엑셀 다운로드',
        body: '목록을 엑셀로 내려받는다.',
        criteria: [{ id: 'SAMPLE-AC-04', text: '검색 결과를 엑셀 파일로 내려받을 수 있다', kind: 'ui' }],
      },
    ],
    references: [{ id: 'ref-list-golden', title: '목록 화면 골든 예시', category: 'list', spec: EXAMPLE_ORDER_LIST_EXTENDED }],
    profile_rules: ['페이지는 .root-shell 안에서 .screen-wrap 과 #right-panel 을 분리한다'],
    baseline_id: 'sample-baseline-1',
    ...overrides,
  }
}

/** 모델이 냈다고 가정하는 wire 출력 (schemas 예시 명세 기반). */
export function sampleWireOutput(): WireOutput {
  const spec = structuredClone(EXAMPLE_ORDER_LIST_EXTENDED) as ScreenSpecInput
  return {
    screen_spec: {
      ...spec,
      actions: spec.actions ?? [],
      messages: spec.messages ?? [],
      data_mapping: spec.data_mapping ?? [],
      locked_elements: spec.locked_elements ?? [],
      locked_actions: spec.locked_actions ?? [],
      unresolved: spec.unresolved.map((u) => ({ kind: u.kind, text: u.text, ...(u.related_ids === undefined ? {} : { related_ids: u.related_ids }) })),
    } as WireOutput['screen_spec'],
    trace_proposals: [{ requirement_id: 'EXAMPLE-REQ-001', criterion_id: 'EXAMPLE-AC-01', element_or_action_id: 'query', rationale: '검색어 입력' }],
    unresolved: [],
    change_summary: { summary: '예시 명세 생성', added_ids: ['query'], changed_ids: [], removed_ids: [], locked_violations: [] },
  }
}

export interface CapturedRequest { url: string; method: string; headers: Headers; body: Record<string, unknown> }

/** SDK 응답 본문 (Message). */
export function messageBody(over: Partial<{ text: string; content: unknown[]; stop_reason: string; stop_details: unknown; usage: { input_tokens: number; output_tokens: number } }> = {}): Record<string, unknown> {
  const content = over.content ?? (over.text === undefined ? [] : [{ type: 'text', text: over.text, citations: null }])
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5',
    content,
    stop_reason: over.stop_reason ?? 'end_turn',
    stop_sequence: null,
    stop_details: over.stop_details ?? null,
    usage: over.usage ?? { input_tokens: 123, output_tokens: 45 },
  }
}

export function errorBody(type: string, message: string): Record<string, unknown> {
  return { type: 'error', error: { type, message } }
}

/**
 * 네트워크 없는 fetch — 요청을 기록하고 정해진 응답을 돌려준다. SDK 가 `fetch` 옵션을 받는지는 client.d.ts(ClientOptions.fetch)로 확인했다.
 */
export function fakeFetch(respond: (req: CapturedRequest) => { status: number; body: Record<string, unknown> } | Promise<{ status: number; body: Record<string, unknown> }>): { fetch: NonNullable<ClientOptions['fetch']>; requests: CapturedRequest[] } {
  const requests: CapturedRequest[] = []
  const fetch: NonNullable<ClientOptions['fetch']> = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {}
    const req: CapturedRequest = { url, method: init?.method ?? 'GET', headers: new Headers(init?.headers as HeadersInit | undefined), body }
    requests.push(req)
    const res = await respond(req)
    return new Response(JSON.stringify(res.body), { status: res.status, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } })
  }
  return { fetch, requests }
}
