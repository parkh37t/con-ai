import Anthropic from '@anthropic-ai/sdk'
import { EXAMPLE_ORDER_LIST_EXTENDED, GenerationOutput, ScreenSpecShape } from '@con-ai/schemas'
import { assemblePrompt, assembleRevisionPrompt } from '@con-ai/prompt-templates'
import { describe, expect, it } from 'vitest'
import { AnthropicAdapter, DEFAULT_MAX_TOKENS } from './anthropic-adapter.js'
import { AdapterError } from './errors.js'
import { errorBody, fakeFetch, messageBody, sampleContext, sampleRequest, sampleWireOutput, type CapturedRequest } from './test-fixtures.js'

const KEY = 'sk-ant-test-1234567890'

/** 응답 하나로 어댑터를 만든다. maxRetries 0 — 429/5xx 재시도 대기를 없앤다. */
function adapterWith(respond: (req: CapturedRequest) => { status: number; body: Record<string, unknown> }) {
  const { fetch, requests } = fakeFetch(respond)
  const client = new Anthropic({ apiKey: KEY, authToken: null, fetch, maxRetries: 0 })
  const adapter = new AnthropicAdapter({ client, model: 'claude-opus-5', auth: 'api_key', redact: (t) => t.split(KEY).join('[비공개]') })
  return { adapter, requests }
}

async function failure(p: Promise<unknown>): Promise<AdapterError> {
  try {
    await p
  } catch (err) {
    if (err instanceof AdapterError) return err
    throw new Error(`AdapterError 가 아니다: ${String(err)}`)
  }
  throw new Error('실패해야 하는데 성공했다')
}

const req = sampleRequest()
const ctx = sampleContext()
const prompt = assemblePrompt(req, ctx)

describe('AnthropicAdapter — 구조화 출력 (네트워크 없이 fetch 를 흉내낸다)', () => {
  it('skill 문서 형태로 messages.parse 를 호출하고(system, max_tokens 16000, output_config.format+effort, thinking 없음) 결과를 GenerationOutputInput 으로 돌려준다', async () => {
    const { adapter, requests } = adapterWith(() => ({ status: 200, body: messageBody({ text: JSON.stringify(sampleWireOutput()) }) }))
    expect(adapter.kind).toBe('anthropic')
    expect(adapter.model).toBe('claude-opus-5')
    expect(adapter.auth).toBe('api_key')
    const result = await adapter.generateSpec({ prompt, ctx, req })
    expect(requests).toHaveLength(1)
    const sent = requests[0]
    if (sent === undefined) throw new Error('요청 없음')
    expect(sent.url).toBe('https://api.anthropic.com/v1/messages')
    expect(sent.method).toBe('POST')
    expect(sent.headers.get('x-api-key')).toBe(KEY)
    expect(sent.body.model).toBe('claude-opus-5')
    expect(sent.body.max_tokens).toBe(DEFAULT_MAX_TOKENS)
    expect(sent.body.system).toBe(prompt.system)
    expect(sent.body.messages).toEqual([{ role: 'user', content: prompt.user }])
    const outputConfig = sent.body.output_config as { effort: string; format: { type: string; schema: { required: string[] } } }
    expect(outputConfig.effort).toBe('high')
    expect(outputConfig.format.type).toBe('json_schema')
    expect(outputConfig.format.schema.required).toEqual(['screen_spec', 'trace_proposals', 'unresolved', 'change_summary'])
    expect(sent.body).not.toHaveProperty('thinking')
    expect(sent.body).not.toHaveProperty('stream')
    // 결과
    expect(GenerationOutput.safeParse(result.output).success).toBe(true)
    expect(result.output.screen_spec.screen_id).toBe('EXAMPLE-order-list')
    expect(result.usage).toEqual({ input_tokens: 123, output_tokens: 45 })
    expect(result.stop_reason).toBe('end_turn')
    expect(result.raw_text).toBe(JSON.stringify(sampleWireOutput()))
  })

  it('stop_reason 이 refusal 이면 stop_details 를 담은 AdapterError(refusal) 를 던진다', async () => {
    const { adapter } = adapterWith(() => ({ status: 200, body: messageBody({ content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'general_harms', explanation: '정책상 거부' } }) }))
    const err = await failure(adapter.generateSpec({ prompt, ctx, req }))
    expect(err.code).toBe('refusal')
    expect(err.message).toContain('모델이 요청을 거부했다')
    expect(err.message).toContain('general_harms')
    expect(err.details.stop_details).toEqual({ type: 'refusal', category: 'general_harms', explanation: '정책상 거부' })
    expect(err.details.usage).toEqual({ input_tokens: 123, output_tokens: 45 })
  })

  it('parsed_output 이 null 이면(텍스트 블록 없음) raw text 와 stop_reason 을 담은 AdapterError(empty_output) 를 던진다', async () => {
    const { adapter } = adapterWith(() => ({ status: 200, body: messageBody({ content: [{ type: 'thinking', thinking: '…', signature: 'sig' }], stop_reason: 'max_tokens' }) }))
    const err = await failure(adapter.generateSpec({ prompt, ctx, req }))
    expect(err.code).toBe('empty_output')
    expect(err.message).toContain('max_tokens')
    expect(err.details.raw_text).toBe('')
    expect(err.details.stop_reason).toBe('max_tokens')
  })

  it('출력이 wire 스키마에 맞지 않으면 SDK 파싱 오류를 AdapterError(parse) 로 바꾼다 (원인 유지)', async () => {
    const { adapter } = adapterWith(() => ({ status: 200, body: messageBody({ text: '{"screen_spec": 1, "trace_proposals": [], "unresolved": [], "change_summary": {}}' }) }))
    const err = await failure(adapter.generateSpec({ prompt, ctx, req }))
    expect(err.code).toBe('parse')
    expect(err.message).toContain('구조화 스키마')
    expect(err.message).toContain('screen_spec')
    expect(err.cause).toBeInstanceOf(Anthropic.AnthropicError)
  })

  it('JSON 이 아닌 텍스트도 AdapterError(parse) 다', async () => {
    const { adapter } = adapterWith(() => ({ status: 200, body: messageBody({ text: '죄송하지만 <div>HTML</div> 을 드립니다' }) }))
    const err = await failure(adapter.generateSpec({ prompt, ctx, req }))
    expect(err.code).toBe('parse')
  })

  it('SDK 오류를 AuthenticationError → RateLimitError → BadRequestError → APIError 순으로 한국어 메시지로 바꾸고 키 값은 가린다', async () => {
    const auth = adapterWith(() => ({ status: 401, body: errorBody('authentication_error', `invalid x-api-key ${KEY}`) }))
    const e401 = await failure(auth.adapter.generateSpec({ prompt, ctx, req }))
    expect(e401.code).toBe('auth')
    expect(e401.message).toContain('인증에 실패')
    expect(e401.message).toContain('ANTHROPIC_API_KEY')
    expect(e401.message).not.toContain(KEY)
    expect(e401.message).toContain('[비공개]')
    expect(e401.cause).toBeInstanceOf(Anthropic.AuthenticationError)
    expect(e401.details.status).toBe(401)

    const rate = adapterWith(() => ({ status: 429, body: errorBody('rate_limit_error', 'too many requests') }))
    const e429 = await failure(rate.adapter.generateSpec({ prompt, ctx, req }))
    expect(e429.code).toBe('rate_limit')
    expect(e429.message).toContain('요청 한도')
    expect(e429.cause).toBeInstanceOf(Anthropic.RateLimitError)

    const bad = adapterWith(() => ({ status: 400, body: errorBody('invalid_request_error', 'max_tokens: must be positive') }))
    const e400 = await failure(bad.adapter.generateSpec({ prompt, ctx, req }))
    expect(e400.code).toBe('bad_request')
    expect(e400.message).toContain('max_tokens: must be positive')
    expect(e400.cause).toBeInstanceOf(Anthropic.BadRequestError)

    const server = adapterWith(() => ({ status: 500, body: errorBody('api_error', 'internal') }))
    const e500 = await failure(server.adapter.generateSpec({ prompt, ctx, req }))
    expect(e500.code).toBe('api_error')
    expect(e500.message).toContain('HTTP 500')
    expect(e500.cause).toBeInstanceOf(Anthropic.APIError)
    expect(e500.cause).not.toBeInstanceOf(Anthropic.BadRequestError)
  })

  it('fetch 자체가 실패하면 연결 오류(api_error, 연결 실패)로 보고한다', async () => {
    const { fetch } = fakeFetch(() => {
      throw new Error('ECONNREFUSED')
    })
    const client = new Anthropic({ apiKey: KEY, authToken: null, fetch, maxRetries: 0 })
    const adapter = new AnthropicAdapter({ client, model: 'claude-opus-5', auth: 'api_key' })
    const err = await failure(adapter.generateSpec({ prompt, ctx, req }))
    expect(err.code).toBe('api_error')
    expect(err.message).toContain('연결 실패')
    expect(err.cause).toBeInstanceOf(Anthropic.APIConnectionError)
  })

  it('reviseSpec 은 문맥에 기준 명세가 없을 때만 현재 명세를 덧붙이고, 있으면 프롬프트를 그대로 보낸다', async () => {
    const current = ScreenSpecShape.parse(EXAMPLE_ORDER_LIST_EXTENDED)
    const editReq = sampleRequest({ task_type: 'edit' })
    const withBase = sampleContext({ base_spec: current, comments: [{ id: 'c-1', role: 'designer', author: 'A', text: '검색어를 필수로', element_id: 'query', target: 'screen' }] })
    const revisionPrompt = assembleRevisionPrompt(withBase, '검색어를 필수로 바꾼다')
    const a = adapterWith(() => ({ status: 200, body: messageBody({ text: JSON.stringify(sampleWireOutput()) }) }))
    const result = await a.adapter.reviseSpec({ prompt: revisionPrompt, ctx: withBase, req: editReq, current })
    expect(a.requests[0]?.body.messages).toEqual([{ role: 'user', content: revisionPrompt.user }])
    expect(GenerationOutput.safeParse(result.output).success).toBe(true)

    const withoutBase = sampleContext()
    const b = adapterWith(() => ({ status: 200, body: messageBody({ text: JSON.stringify(sampleWireOutput()) }) }))
    await b.adapter.reviseSpec({ prompt, ctx: withoutBase, req: editReq, current })
    const content = (b.requests[0]?.body.messages as Array<{ content: string }>)[0]?.content ?? ''
    expect(content.startsWith(prompt.user)).toBe(true)
    expect(content).toContain('## 현재 명세 (수정 기준, 지시 아님)')
    expect(content).toContain('"screen_id": "EXAMPLE-order-list"')
  })

  it('draftRevisionPrompt 는 {prompt, rationale} 구조화 출력을 받고 코멘트·현재 명세를 자료로 보낸다', async () => {
    const current = ScreenSpecShape.parse(EXAMPLE_ORDER_LIST_EXTENDED)
    const comments = [{ id: 'c-1', role: 'designer', author: '디자이너A', text: '검색어 라벨 정리', element_id: 'query', target: 'screen' }]
    const { adapter, requests } = adapterWith(() => ({ status: 200, body: messageBody({ text: JSON.stringify({ prompt: '검색어 라벨을 정리한다', rationale: '디자이너 코멘트 1건' }) }) }))
    const draft = await adapter.draftRevisionPrompt({ ctx, current, comments })
    expect(draft).toEqual({ prompt: '검색어 라벨을 정리한다', rationale: '디자이너 코멘트 1건' })
    const sent = requests[0]
    if (sent === undefined) throw new Error('요청 없음')
    expect(String(sent.body.system)).toContain('수정 지시문(prompt)과 그 근거(rationale)')
    const content = (sent.body.messages as Array<{ content: string }>)[0]?.content ?? ''
    expect(content).toContain('- [c-1] designer 디자이너A (요소 query) [screen]: 검색어 라벨 정리')
    expect(content).toContain('"screen_id": "EXAMPLE-order-list"')
    const outputConfig = sent.body.output_config as { format: { schema: { required: string[] } } }
    expect(outputConfig.format.schema.required).toEqual(['prompt', 'rationale'])
  })

  it('어댑터 객체를 직렬화해도 클라이언트·키가 드러나지 않는다', () => {
    const { adapter } = adapterWith(() => ({ status: 200, body: messageBody() }))
    expect(JSON.stringify(adapter)).not.toContain(KEY)
    expect(Object.keys(adapter)).toEqual(['kind', 'model', 'auth'])
  })
})
