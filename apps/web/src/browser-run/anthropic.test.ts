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
  REDACT_SKIPPED,
  REVISION_DRAFT_JSON_SCHEMA,
  SCREEN_OUTPUT_JSON_SCHEMA,
  authHeaders,
  callAnthropic,
  extractStructured,
} from './anthropic.js'
import { countOptionalParameters, STRUCTURED_OUTPUT_OPTIONAL_LIMIT } from './deps.js'
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
    // **실제로 나가는 본문**의 선택 파라미터 수 — 상한(24)을 넘으면 API 가 400 으로 거부한다.
    expect(countOptionalParameters(outputConfig.format.schema)).toBeLessThanOrEqual(STRUCTURED_OUTPUT_OPTIONAL_LIMIT)
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

  it('ScreenSpec 은 모든 키를 요구하고, 선택 키는 null 을 허용하는 모양이다', () => {
    const spec = (SCREEN_OUTPUT_JSON_SCHEMA['properties'] as Record<string, Record<string, unknown>>)['screen_spec']
    const props = spec?.['properties'] as Record<string, Record<string, unknown>>
    // 선택 파라미터 상한(24) 때문에 모든 키가 required 다 — 「없음」은 null 로 온다.
    expect(spec?.['required']).toEqual(Object.keys(props))
    expect(Object.keys(props)).toContain('roles')
    // 원래 선택이던 roles 는 «배열 또는 null»
    expect(props['roles']).toEqual({ anyOf: [{ type: 'array', items: { type: 'string' } }, { type: 'null' }] })
    // 원래 필수이던 screen_id 는 그대로 문자열이다 (null 을 허용하지 않는다).
    expect((props['screen_id'] as Record<string, unknown>)['anyOf']).toBeUndefined()
  })

  /**
   * 구조화 출력의 선택 파라미터 상한 — 이 검사가 없어서 실제 모델 호출이 400 으로 죽었다.
   * (API: "Schemas contains too many optional parameters (41) … limit: 24")
   */
  it('선택 파라미터가 상한(24) 이하다 — 서버 wire-schema 와 같은 규칙', () => {
    expect(countOptionalParameters(SCREEN_OUTPUT_JSON_SCHEMA)).toBeLessThanOrEqual(STRUCTURED_OUTPUT_OPTIONAL_LIMIT)
    expect(countOptionalParameters(REVISION_DRAFT_JSON_SCHEMA)).toBeLessThanOrEqual(STRUCTURED_OUTPUT_OPTIONAL_LIMIT)
  })

  it('수정 초안 스키마는 prompt·rationale 두 개', () => {
    expect(REVISION_DRAFT_JSON_SCHEMA['required']).toEqual(['prompt', 'rationale'])
  })
})

/**
 * 짧은 자격 증명의 가리기.
 *
 * 예전 구현은 8자 미만이면 **치환을 건너뛰고 외부 문장을 그대로** 넘겼다 — 값이 화면에 남을 수 있었다.
 * 지금은 치환이 위험한 경우 외부 문장을 아예 쓰지 않는다.
 */
describe('가리기(redact) — 짧은 값도 새지 않는다', () => {
  const SHORT: StoredCredential = { kind: 'token', value: 'abc', persist: false }

  it('8자 미만이면 API 가 돌려준 문장을 쓰지 않는다', async () => {
    const { fetch } = fakeFetch([{ status: 401, body: { error: { message: 'bad key abc here' } } }])
    const err = (await callAnthropic({ credential: SHORT, system: 's', user: 'u', schema: SCREEN_OUTPUT_JSON_SCHEMA }, { fetch }).catch((e: unknown) => e)) as BrowserModelError
    expect(err.code).toBe('auth')
    expect(err.details).toEqual([REDACT_SKIPPED])
    expect(err.details.join(' ')).not.toContain('abc')
  })

  it('8자 이상이면 값만 가리고 나머지 문장은 남긴다', async () => {
    const long: StoredCredential = { kind: 'token', value: 'sk-ant-oat01-저장된토큰값', persist: false }
    const { fetch } = fakeFetch([{ status: 401, body: { error: { message: `invalid token ${long.value} supplied` } } }])
    const err = (await callAnthropic({ credential: long, system: 's', user: 'u', schema: SCREEN_OUTPUT_JSON_SCHEMA }, { fetch }).catch((e: unknown) => e)) as BrowserModelError
    expect(err.details[0]).toBe('invalid token *** supplied')
  })
})

/**
 * 원인을 원인대로 말하기.
 *
 * 예전에는 (1) 구조화 출력이 상한에서 끊겨도 stop_reason 을 보지 않아 뒤의 스키마 실패가
 * «모델 품질 문제» 로 읽혔고, (2) 529·5xx 에 재시도 안내가 없어 사용자가 자기 토큰을 의심했고,
 * (3) parse 실패 details 만 가리기를 거치지 않았다.
 */
describe('실패 원인 분류 — 토큰·요청 문제가 아닌 것을 그렇게 말하지 않는다', () => {
  it('구조화 결과가 와도 max_tokens 에서 끊겼으면 truncated 로 올린다', () => {
    const out = extractStructured<{ a: number }>({ parsed_output: { a: 1 }, stop_reason: 'max_tokens' })
    expect(out.output).toEqual({ a: 1 })
    expect(out.truncated).toBe(true)
    expect(extractStructured<{ a: number }>({ parsed_output: { a: 1 }, stop_reason: 'end_turn' }).truncated).toBe(false)
  })

  it('529(과부하)·5xx 는 재시도를 안내하고 토큰 문제가 아니라고 밝힌다', async () => {
    for (const status of [529, 503, 500]) {
      const { fetch } = fakeFetch([{ status, body: { error: { message: 'overloaded' } } }])
      const err = (await callAnthropic({ credential: TOKEN, system: 's', user: 'u', schema: SCREEN_OUTPUT_JSON_SCHEMA }, { fetch }).catch((e: unknown) => e)) as BrowserModelError
      expect(err.message, `HTTP ${status}`).toContain('다시 실행하세요')
      expect(err.message, `HTTP ${status}`).toContain('토큰·요청 문제가 아닙니다')
    }
  })

  it('404 는 모델 권한 문제로 안내한다 (요청 형식 오류로 적지 않는다)', async () => {
    const { fetch } = fakeFetch([{ status: 404, body: { error: { message: 'model not found' } } }])
    const err = (await callAnthropic({ credential: TOKEN, system: 's', user: 'u', schema: SCREEN_OUTPUT_JSON_SCHEMA }, { fetch }).catch((e: unknown) => e)) as BrowserModelError
    expect(err.message).toContain('모델을 찾을 수 없습니다')
    expect(err.message).not.toContain('요청 형식')
  })

  it('JSON 으로 못 읽은 본문도 가리기를 거친다 — 입력칸에 붙여 넣은 토큰이 메아리로 돌아올 수 있다', async () => {
    const echo = `모델이 그대로 되돌린 문장: ${TOKEN.value} 입니다`
    const { fetch } = fakeFetch([
      { status: 200, body: { id: 'm', model: 'claude-opus-5', content: [{ type: 'text', text: echo }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } } },
    ])
    const err = (await callAnthropic({ credential: TOKEN, system: 's', user: 'u', schema: SCREEN_OUTPUT_JSON_SCHEMA }, { fetch }).catch((e: unknown) => e)) as BrowserModelError
    expect(err.code).toBe('parse')
    expect(err.details.join(' ')).not.toContain(TOKEN.value)
    expect(err.details.join(' ')).toContain('***')
  })
})
