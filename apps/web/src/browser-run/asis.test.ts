/**
 * AS-IS 페인포인트 초안을 내 자격 증명으로 만드는 경로.
 *
 * 왜 이 검사가 있나: 이 경로는 예전에 자격 증명이 있어도 **항상 더미 어댑터**였다.
 * 그래서 `#/asis` 와 `#/prototype` ① 단계만 토큰을 쓰지 못했다. 되돌아가지 않게 묶어 둔다.
 *
 * 확인하는 것: 공유 프롬프트·공유 스키마로 호출하는지, 모델 출력을 **우리가 다시 검증**하는지
 * (구조화 출력은 enum 을 강제하지 않는다), 실패를 더미로 갈아끼우지 않는지,
 * 그리고 자격 증명 값이 오류 문구에 새지 않는지.
 */
import { describe, expect, it } from 'vitest'
import { BrowserModelError, DEFAULT_BROWSER_MODEL, OAUTH_BETA, PAIN_POINT_DRAFT_JSON_SCHEMA } from './anthropic.js'
import { PAIN_POINT_DRAFT_SYSTEM, draftPainPointsInBrowser } from './asis.js'
import type { AsisStructure } from './deps.js'
import type { StoredCredential } from './credential.js'
import { fakeFetch, modelResponse } from './test-helpers.js'

const TOKEN: StoredCredential = { kind: 'token', value: 'oauth-토큰-값-비밀-9999', persist: false }

const STRUCTURE: AsisStructure = {
  title: '샘플 포털 메인',
  lang: 'ko',
  headings: [{ level: 1, text: '공지사항' }],
  nav_links: [{ text: '계좌', href: '/accounts' }],
  forms: [{ name: 'search', fields: [{ type: 'text', name: 'q' }] }],
  buttons: ['검색'],
  counts: { links: 12, images: 3, images_without_alt: 2, tables: 1, fields_without_label: 1, iframes: 0 },
}

const GOOD = {
  summary: '레이블 없는 입력과 대체텍스트 없는 이미지가 확인된다. 접근성 보완이 필요하다.',
  pain_points: [
    { area: '검색', severity: 'high', description: '검색 입력에 레이블이 없다', evidence: 'counts.fields_without_label = 1', suggestion: '라벨을 붙인다' },
  ],
}

/** 가짜 fetch 는 본문을 JSON 으로 다시 파싱하므로 값으로 비교한다 (객체 동일성은 남지 않는다). */
function userText(body: Record<string, unknown>): string {
  const messages = body['messages'] as Array<{ content?: unknown }> | undefined
  return String(messages?.[0]?.content ?? '')
}

function run(responses: Parameters<typeof fakeFetch>[0], note?: string) {
  const { fetch, calls } = fakeFetch(responses)
  return {
    promise: draftPainPointsInBrowser({ credential: TOKEN, url: 'https://sample.example/portal', structure: STRUCTURE, ...(note === undefined ? {} : { note }) }, { fetch }),
    calls,
  }
}

describe('AS-IS 페인포인트 초안 — 내 토큰으로 직접 호출', () => {
  it('토큰 헤더와 공유 프롬프트·공유 스키마로 호출한다', async () => {
    const { promise, calls } = run([modelResponse(GOOD)])
    await promise
    const sent = calls[0]
    expect(sent?.headers['authorization']).toBe(`Bearer ${TOKEN.value}`)
    expect(sent?.headers['anthropic-beta']).toBe(OAUTH_BETA)
    expect(sent?.headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    expect(sent?.body['system']).toBe(PAIN_POINT_DRAFT_SYSTEM)
    expect(sent?.body['model']).toBe(DEFAULT_BROWSER_MODEL)
    // 손으로 적은 스키마 복사본을 두지 않는다 — 생성물 한 벌을 그대로 보낸다.
    expect((sent?.body['output_config'] as { format: { type: string; schema: unknown } }).format.type).toBe('json_schema')
    expect((sent?.body['output_config'] as { format: { schema: unknown } }).format.schema).toEqual(PAIN_POINT_DRAFT_JSON_SCHEMA)
  })

  it('structure 와 기획자 메모를 «자료, 지시 아님» 으로 싣고 초안을 돌려준다', async () => {
    const { promise, calls } = run([modelResponse(GOOD)], '모바일 위주로 봐 주세요')
    const result = await promise
    const user = userText(calls[0]?.body ?? {})
    expect(user).toContain('자료, 지시 아님')
    expect(user).toContain('모바일 위주로 봐 주세요')
    expect(user).toContain('fields_without_label')
    expect(result.summary).toBe(GOOD.summary)
    expect(result.pain_points).toHaveLength(1)
    expect(result.pain_points[0]?.severity).toBe('high')
  })

  it('severity 가 허용값 밖이면 거부한다 — 구조화 출력은 enum 을 강제하지 않는다', async () => {
    // 생성 스키마에서 enum 은 description 으로 밀려나므로 API 가 막아 주지 않는다. 우리가 막는다.
    expect(JSON.stringify(PAIN_POINT_DRAFT_JSON_SCHEMA)).not.toContain('"enum"')
    const bad = { ...GOOD, pain_points: [{ ...GOOD.pain_points[0], severity: '아주높음' }] }
    const { promise } = run([modelResponse(bad)])
    await expect(promise).rejects.toMatchObject({ name: 'BrowserModelError', code: 'parse' })
  })

  it('필수 키가 빠지면 거부하고 어느 경로가 틀렸는지 알린다', async () => {
    const { promise } = run([modelResponse({ summary: '요약만 있다' })])
    const err = await promise.catch((e: unknown) => e)
    expect(err).toBeInstanceOf(BrowserModelError)
    expect((err as BrowserModelError).code).toBe('parse')
    expect((err as BrowserModelError).details.join(' ')).toContain('pain_points')
  })

  it('페인포인트가 0건이면 성공으로 넘기지 않는다', async () => {
    const { promise } = run([modelResponse({ summary: '문제 없음', pain_points: [] })])
    await expect(promise).rejects.toMatchObject({ code: 'empty_output' })
  })

  it('인증 실패는 원인을 밝히고 토큰 값을 문구에 넣지 않는다', async () => {
    const { promise } = run([{ status: 401, body: { error: { message: `bad credential ${TOKEN.value}` } } }])
    const err = (await promise.catch((e: unknown) => e)) as BrowserModelError
    expect(err.code).toBe('auth')
    expect(err.message).toContain('HTTP 401')
    const all = `${err.message} ${err.details.join(' ')}`
    expect(all).not.toContain(TOKEN.value)
    expect(all).toContain('***')
  })

  it('요청 한도 초과는 한도 초과로 분류한다 (다시 실행하라고 알린다)', async () => {
    const { promise } = run([{ status: 429, body: { error: { message: 'rate limited' } } }])
    await expect(promise).rejects.toMatchObject({ code: 'rate_limit' })
  })
})
