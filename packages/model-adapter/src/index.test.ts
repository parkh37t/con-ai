import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { assemblePrompt } from '@con-ai/prompt-templates'
import { AdapterError, AnthropicAdapter, createAdapter, defaultProfileAvailable, FixtureAdapter, OAUTH_BETA_HEADER, type ModelAdapter } from './index.js'
import { fakeFetch, messageBody, sampleContext, sampleModelOutputText, sampleRequest } from './test-fixtures.js'

const KEY = 'sk-ant-test-1234567890'
const TOKEN = 'oauth-test-token-abcdefghijklmnop'
const scratch = mkdtempSync(join(tmpdir(), 'con-ai-adapter-'))

const req = sampleRequest()
const ctx = sampleContext()
const prompt = assemblePrompt(req, ctx)

/** 어댑터를 만들고 한 번 호출해 실제로 보낸 헤더를 돌려준다. */
async function headersSentBy(env: NodeJS.ProcessEnv, opts: { profileAvailable?: () => boolean } = {}) {
  const { fetch, requests } = fakeFetch(() => ({ status: 200, body: messageBody({ text: sampleModelOutputText() }) }))
  const adapter = createAdapter(env, { clientOptions: { fetch, maxRetries: 0 }, ...opts })
  await adapter.generateSpec({ prompt, ctx, req })
  const sent = requests[0]
  if (sent === undefined) throw new Error('요청 없음')
  return { adapter, headers: sent.headers }
}

const savedConfigDir = process.env.ANTHROPIC_CONFIG_DIR
afterEach(() => {
  if (savedConfigDir === undefined) delete process.env.ANTHROPIC_CONFIG_DIR
  else process.env.ANTHROPIC_CONFIG_DIR = savedConfigDir
})

describe('createAdapter — 어댑터 선택 (MODEL_ADAPTER)', () => {
  it('MODEL_ADAPTER 가 없거나 anthropic 이 아니면 FixtureAdapter (더미) 다', () => {
    const a: ModelAdapter = createAdapter({})
    expect(a).toBeInstanceOf(FixtureAdapter)
    expect([a.kind, a.model, a.auth]).toEqual(['fixture', 'fixture', 'none'])
    expect(createAdapter({ MODEL_ADAPTER: 'fixture', ANTHROPIC_API_KEY: KEY }).kind).toBe('fixture')
    expect(createAdapter({ MODEL_ADAPTER: 'other' }).kind).toBe('fixture')
  })

  it('MODEL_ADAPTER=anthropic 이면 AnthropicAdapter, 모델은 MODEL_ID (기본 claude-opus-5)', () => {
    const a = createAdapter({ MODEL_ADAPTER: 'anthropic', ANTHROPIC_API_KEY: KEY })
    expect(a).toBeInstanceOf(AnthropicAdapter)
    expect(a.model).toBe('claude-opus-5')
    expect(createAdapter({ MODEL_ADAPTER: 'anthropic', ANTHROPIC_API_KEY: KEY, MODEL_ID: 'claude-sonnet-5' }).model).toBe('claude-sonnet-5')
  })
})

describe('createAdapter — 인증 방식 (MODEL_AUTH=api_key|token|auto)', () => {
  it('API 키 방식: x-api-key 헤더만 보내고 Authorization·oauth beta 헤더는 없다', async () => {
    const { adapter, headers } = await headersSentBy({ MODEL_ADAPTER: 'anthropic', ANTHROPIC_API_KEY: KEY })
    expect(adapter.auth).toBe('api_key')
    expect(headers.get('x-api-key')).toBe(KEY)
    expect(headers.get('authorization')).toBeNull()
    expect(headers.get('anthropic-beta') ?? '').not.toContain(OAUTH_BETA_HEADER)
  })

  it('토큰 방식: Authorization: Bearer 와 anthropic-beta oauth-2025-04-20 을 보내고 x-api-key 는 없다', async () => {
    const { adapter, headers } = await headersSentBy({ MODEL_ADAPTER: 'anthropic', ANTHROPIC_AUTH_TOKEN: TOKEN })
    expect(adapter.auth).toBe('token')
    expect(headers.get('authorization')).toBe(`Bearer ${TOKEN}`)
    expect(headers.get('anthropic-beta')?.split(',').map((s) => s.trim())).toContain(OAUTH_BETA_HEADER)
    expect(headers.get('x-api-key')).toBeNull()
  })

  it('auto 에서 키와 토큰이 둘 다 있으면 API 키가 이기고 토큰 헤더는 보내지 않는다 (두 헤더 동시 전송 금지)', async () => {
    const { adapter, headers } = await headersSentBy({ MODEL_ADAPTER: 'anthropic', ANTHROPIC_API_KEY: KEY, ANTHROPIC_AUTH_TOKEN: TOKEN })
    expect(adapter.auth).toBe('api_key')
    expect(headers.get('x-api-key')).toBe(KEY)
    expect(headers.get('authorization')).toBeNull()
  })

  it('MODEL_AUTH=token 이면 키가 있어도 토큰만 쓰고, MODEL_AUTH=api_key 면 토큰이 있어도 키만 쓴다', async () => {
    const t = await headersSentBy({ MODEL_ADAPTER: 'anthropic', MODEL_AUTH: 'token', ANTHROPIC_API_KEY: KEY, ANTHROPIC_AUTH_TOKEN: TOKEN })
    expect(t.adapter.auth).toBe('token')
    expect(t.headers.get('x-api-key')).toBeNull()
    expect(t.headers.get('authorization')).toBe(`Bearer ${TOKEN}`)
    const k = await headersSentBy({ MODEL_ADAPTER: 'anthropic', MODEL_AUTH: 'api_key', ANTHROPIC_API_KEY: KEY, ANTHROPIC_AUTH_TOKEN: TOKEN })
    expect(k.adapter.auth).toBe('api_key')
    expect(k.headers.get('authorization')).toBeNull()
  })

  it('지정한 방식의 값이 없으면 생성 시점에 한국어 오류로 안내한다', () => {
    expect(() => createAdapter({ MODEL_ADAPTER: 'anthropic', MODEL_AUTH: 'token', ANTHROPIC_API_KEY: KEY })).toThrow('MODEL_AUTH=token 인데 ANTHROPIC_AUTH_TOKEN 이 없다')
    expect(() => createAdapter({ MODEL_ADAPTER: 'anthropic', MODEL_AUTH: 'api_key', ANTHROPIC_AUTH_TOKEN: TOKEN })).toThrow('MODEL_AUTH=api_key 인데 ANTHROPIC_API_KEY 가 없다')
    expect(() => createAdapter({ MODEL_ADAPTER: 'anthropic', MODEL_AUTH: 'bogus', ANTHROPIC_API_KEY: KEY })).toThrow('MODEL_AUTH 값이 올바르지 않다')
    expect(() => createAdapter({ MODEL_ADAPTER: 'anthropic', ANTHROPIC_API_KEY: '   ' }, { profileAvailable: () => false })).toThrow('ANTHROPIC_API_KEY')
  })

  it('키·토큰·프로필이 모두 없으면 두 방법(과 프로필)을 안내하는 오류를 던진다', () => {
    let message = ''
    try {
      createAdapter({ MODEL_ADAPTER: 'anthropic' }, { profileAvailable: () => false })
    } catch (err) {
      message = err instanceof Error ? err.message : String(err)
    }
    expect(message).toContain('ANTHROPIC_API_KEY')
    expect(message).toContain('ANTHROPIC_AUTH_TOKEN')
    expect(message).toContain('ant auth login')
    expect(message).toContain('MODEL_ADAPTER=fixture')
  })

  it('키·토큰이 없고 `ant auth login` 프로필이 있으면 zero-arg 클라이언트로 profile 방식이 된다; 프로필이 실제로 없으면 호출 시 auth 오류다', async () => {
    process.env.ANTHROPIC_CONFIG_DIR = join(scratch, 'empty-config')
    mkdirSync(process.env.ANTHROPIC_CONFIG_DIR, { recursive: true })
    const { fetch, requests } = fakeFetch(() => ({ status: 200, body: messageBody({ text: sampleModelOutputText() }) }))
    const adapter = createAdapter({ MODEL_ADAPTER: 'anthropic' }, { clientOptions: { fetch, maxRetries: 0 }, profileAvailable: () => true })
    expect(adapter.auth).toBe('profile')
    expect(adapter.kind).toBe('anthropic')
    let caught: unknown
    try {
      await adapter.generateSpec({ prompt, ctx, req })
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(AdapterError)
    if (caught instanceof AdapterError) {
      expect(caught.code).toBe('auth')
      expect(caught.message).toContain('ant auth login')
    }
    expect(requests).toHaveLength(0)
  })

  it('defaultProfileAvailable 은 ANTHROPIC_PROFILE 또는 설정 디렉터리의 configs/ 존재로 판정한다', () => {
    const withConfigs = join(scratch, 'with-configs')
    mkdirSync(join(withConfigs, 'configs'), { recursive: true })
    const without = join(scratch, 'without')
    mkdirSync(without, { recursive: true })
    expect(defaultProfileAvailable({ ANTHROPIC_CONFIG_DIR: withConfigs })).toBe(true)
    expect(defaultProfileAvailable({ ANTHROPIC_CONFIG_DIR: without })).toBe(false)
    expect(defaultProfileAvailable({ ANTHROPIC_CONFIG_DIR: without, ANTHROPIC_PROFILE: 'work' })).toBe(true)
    expect(defaultProfileAvailable({ HOME: join(scratch, 'no-home') })).toBe(false)
  })

  it('키·토큰 값은 오류 메시지·details 에 나타나지 않는다 (401 본문이 값을 되돌려줘도 가린다)', async () => {
    const { fetch } = fakeFetch(() => ({ status: 401, body: { type: 'error', error: { type: 'authentication_error', message: `bad token ${TOKEN}` } } }))
    const adapter = createAdapter({ MODEL_ADAPTER: 'anthropic', ANTHROPIC_AUTH_TOKEN: TOKEN }, { clientOptions: { fetch, maxRetries: 0 } })
    let caught: unknown
    try {
      await adapter.generateSpec({ prompt, ctx, req })
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(AdapterError)
    if (caught instanceof AdapterError) {
      expect(caught.code).toBe('auth')
      expect(caught.message).not.toContain(TOKEN)
      expect(caught.message).toContain('ANTHROPIC_AUTH_TOKEN')
      expect(JSON.stringify(caught.details)).not.toContain(TOKEN)
    }
    expect(JSON.stringify(adapter)).not.toContain(TOKEN)
  })
})
