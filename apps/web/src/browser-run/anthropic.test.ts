/**
 * 브라우저 직접 호출 — 헤더(인증 방식별), 요청 본문(구조화 출력), 오류 분류(401·429·400·거부·네트워크),
 * 그리고 토큰 값이 오류 메시지에 새어 나가지 않는지.
 */
import { describe, expect, it } from 'vitest'
import {
  ANTHROPIC_MESSAGES_URL,
  ANTHROPIC_VERSION,
  BrowserModelError,
  DEFAULT_BROWSER_MODEL,
  OAUTH_BETA,
  REVISION_DRAFT_JSON_SCHEMA,
  SCREEN_OUTPUT_JSON_SCHEMA,
  authHeaders,
  callAnthropic,
  extractStructured,
} from './anthropic.js'
import type { StoredCredential } from './credential.js'
import { fakeFetch, modelResponse } from './test-helpers.js'

const TOKEN: StoredCredential = { kind: 'token', value: 'oauth-토큰-값-비밀-0000', persist: false }
const API_KEY: StoredCredential = { kind: 'api_key', value: 'sk-ant-키-값-비밀-1111', persist: false }

function call(credential: StoredCredential, responses: Array<{ status?: number; body: unknown } | Error>) {
  const { fetch, calls } = fakeFetch(responses)
  return { promise: callAnthropic<Record<string, unknown>>({ credential, system: 's', user: 'u', schema: SCREEN_OUTPUT_JSON_SCHEMA }, { fetch }), calls }
}

describe('요청 형태', () => {
  it('토큰이면 Authorization Bearer + oauth 베타 헤더, API 키면 x-api-key', () => {
    expect(authHeaders(TOKEN)).toEqual({ authorization: `Bearer ${TOKEN.value}`, 'anthropic-beta': OAUTH_BETA })
    expect(authHeaders(API_KEY)).toEqual({ 'x-api-key': API_KEY.value })
  })

  it('브라우저 직접 호출 헤더와 구조화 출력 본문을 보낸다', async () => {
    const { promise, calls } = call(API_KEY, [modelResponse({ ok: true })])
    await promise
    const sent = calls[0]
    expect(sent?.url).toBe(ANTHROPIC_MESSAGES_URL)
    expect(sent?.headers['anthropic-version']).toBe(ANTHROPIC_VERSION)
    expect(sent?.headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    expect(sent?.headers['content-type']).toBe('application/json')
    expect(sent?.body['model']).toBe(DEFAULT_BROWSER_MODEL)
    expect(sent?.body['max_tokens']).toBe(16000)
    const outputConfig = sent?.body['output_config'] as { format: { type: string; schema: unknown }; effort: string }
    expect(outputConfig.effort).toBe('high')
    expect(outputConfig.format.type).toBe('json_schema')
    expect(outputConfig.format.schema).toEqual(SCREEN_OUTPUT_JSON_SCHEMA)
    // thinking 파라미터는 넣지 않는다 (claude-opus-5 기본 adaptive).
    expect(sent?.body['thinking']).toBeUndefined()
  })

  it('성공하면 구조화 결과와 사용량을 돌려준다', async () => {
    const { promise } = call(TOKEN, [modelResponse({ hello: '결과' })])
    const result = await promise
    expect(result.output).toEqual({ hello: '결과' })
    expect(result.usage).toEqual({ input_tokens: 100, output_tokens: 200 })
    expect(result.stop_reason).toBe('end_turn')
  })
})

describe('오류 분류 — 원인을 구분해 한국어로 알린다', () => {
  it('401 은 인증 오류이며 토큰 값을 담지 않는다', async () => {
    const { promise } = call(TOKEN, [{ status: 401, body: { error: { message: `invalid token ${TOKEN.value}` } } }])
    const error = await promise.catch((e: unknown) => e)
    expect(error).toBeInstanceOf(BrowserModelError)
    const err = error as BrowserModelError
    expect(err.code).toBe('auth')
    expect(err.message).toContain('인증')
    expect(`${err.message} ${err.details.join(' ')}`).not.toContain(TOKEN.value)
  })

  it('429 는 요청 한도', async () => {
    const { promise } = call(API_KEY, [{ status: 429, body: { error: { message: 'rate limited' } } }])
    const err = (await promise.catch((e: unknown) => e)) as BrowserModelError
    expect(err.code).toBe('rate_limit')
    expect(err.message).toContain('한도')
  })

  it('400 은 요청 형식 오류', async () => {
    const { promise } = call(API_KEY, [{ status: 400, body: { error: { message: 'bad schema' } } }])
    const err = (await promise.catch((e: unknown) => e)) as BrowserModelError
    expect(err.code).toBe('bad_request')
    expect(err.details).toEqual(['bad schema'])
  })

  it('500 은 API 오류', async () => {
    const { promise } = call(API_KEY, [{ status: 500, body: { error: { message: 'oops' } } }])
    const err = (await promise.catch((e: unknown) => e)) as BrowserModelError
    expect(err.code).toBe('api_error')
  })

  it('거부(stop_reason=refusal)는 분류를 붙여 알린다', async () => {
    const { promise } = call(API_KEY, [
      { status: 200, body: { content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'cyber', explanation: '설명' }, usage: {} } },
    ])
    const err = (await promise.catch((e: unknown) => e)) as BrowserModelError
    expect(err.code).toBe('refusal')
    expect(err.message).toContain('거부')
    expect(err.message).toContain('cyber')
  })

  it('네트워크 실패는 연결 오류로 구분한다', async () => {
    const { promise } = call(API_KEY, [new TypeError('Failed to fetch')])
    const err = (await promise.catch((e: unknown) => e)) as BrowserModelError
    expect(err.code).toBe('network')
    expect(err.message).toContain('api.anthropic.com')
  })

  it('빈 응답·JSON 이 아닌 응답을 통과시키지 않는다', async () => {
    const empty = await call(API_KEY, [{ status: 200, body: { content: [], stop_reason: 'end_turn' } }]).promise.catch((e: unknown) => e)
    expect((empty as BrowserModelError).code).toBe('empty_output')
    const bad = await call(API_KEY, [{ status: 200, body: { content: [{ type: 'text', text: '설명 문장' }], stop_reason: 'max_tokens' } }]).promise.catch((e: unknown) => e)
    expect((bad as BrowserModelError).code).toBe('parse')
    expect((bad as BrowserModelError).message).toContain('max_tokens')
  })
})

describe('구조화 결과 꺼내기', () => {
  it('parsed_output 이 있으면 그대로 쓴다', () => {
    expect(extractStructured({ parsed_output: { a: 1 }, content: [] }).output).toEqual({ a: 1 })
  })
  it('```json 울타리가 있어도 읽는다', () => {
    expect(extractStructured({ content: [{ type: 'text', text: '```json\n{"a":2}\n```' }] }).output).toEqual({ a: 2 })
  })
})

describe('JSON Schema — wire-schema 와 같은 모양', () => {
  it('출력 4종을 필수로 요구하고 모든 object 는 additionalProperties:false', () => {
    expect(SCREEN_OUTPUT_JSON_SCHEMA['required']).toEqual(['screen_spec', 'trace_proposals', 'unresolved', 'change_summary'])
    const objects: Array<Record<string, unknown>> = []
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk)
      if (typeof node !== 'object' || node === null) return
      const rec = node as Record<string, unknown>
      if (rec['type'] === 'object') objects.push(rec)
      for (const v of Object.values(rec)) walk(v)
    }
    walk(SCREEN_OUTPUT_JSON_SCHEMA)
    expect(objects.length).toBeGreaterThan(10)
    for (const o of objects) expect(o['additionalProperties']).toBe(false)
  })

  it('ScreenSpec 필수 키가 빠지지 않는다', () => {
    const spec = (SCREEN_OUTPUT_JSON_SCHEMA['properties'] as Record<string, Record<string, unknown>>)['screen_spec']
    expect(spec?.['required']).toEqual([
      'schema_version',
      'screen_id',
      'baseline_id',
      'purpose',
      'shell',
      'device',
      'requirements',
      'sections',
      'actions',
      'states',
      'messages',
      'data_mapping',
      'locked_elements',
      'locked_actions',
      'unresolved',
    ])
  })

  it('수정 초안 스키마는 prompt·rationale 두 개', () => {
    expect(REVISION_DRAFT_JSON_SCHEMA['required']).toEqual(['prompt', 'rationale'])
  })
})
