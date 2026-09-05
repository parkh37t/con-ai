/**
 * 운영 모드 테스트 — 한 포트에서 UI(웹 빌드)와 API 를 함께 제공하는 경로.
 * 임시 디렉터리에 가짜 웹 빌드(index.html + assets/*)를 만들어 createApp 에 넣고 Hono `app.request` 로 확인한다.
 * 확인 대상: 정적 제공 켜짐/꺼짐, `/api/*` 가 SPA 폴백에 먹히지 않음, index.html 폴백, 캐시 헤더, `/healthz` 응답과 비밀값 미포함.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ModelAdapter } from '@con-ai/model-adapter'
import type { RenderInput, RenderOutput } from '@con-ai/renderer'
import { createApp, type ConAiApp } from './app.js'
import { NO_AUTH_WARNING, buildStartupLines, cacheControlFor, isReservedPath, resolveWebDist, shouldFallbackToIndex } from './runtime.js'
import { SqliteStore } from './store.js'

// ---------- 가짜 의존성 (이 파일은 생성 파이프라인을 돌리지 않는다) ----------

function fakeAdapter(kind: ModelAdapter['kind'] = 'fixture'): ModelAdapter {
  const fail = async (): Promise<never> => {
    throw new Error('이 테스트는 모델을 호출하지 않는다')
  }
  return {
    kind,
    model: kind === 'anthropic' ? 'claude-opus-5' : 'fixture',
    auth: 'none',
    generateSpec: fail,
    reviseSpec: fail,
    draftRevisionPrompt: fail,
    draftPainPoints: fail,
  }
}

const fakeRender = (input: RenderInput): RenderOutput => ({
  html: `<!doctype html><html><body><div class="root-shell">${input.spec.screen_id}</div></body></html>`,
  description: { screen_id: input.spec.screen_id, title: input.meta.screen_title, sections: [] },
  element_index: [],
})

const cleanups: Array<() => void> = []
afterEach(() => {
  for (const fn of cleanups.splice(0)) fn()
})

const INDEX_HTML = '<!doctype html><html lang="ko"><head><title>con-ai</title><script type="module" src="/assets/index-abc123.js"></script></head><body><div id="root"></div></body></html>'

/** 임시 웹 빌드 디렉터리 (index.html + assets/index-abc123.js + favicon.svg). */
function fakeWebDist(): string {
  const dir = mkdtempSync(join(tmpdir(), 'con-ai-web-'))
  mkdirSync(join(dir, 'assets'))
  writeFileSync(join(dir, 'index.html'), INDEX_HTML)
  writeFileSync(join(dir, 'assets', 'index-abc123.js'), 'console.log("빌드 산출물")')
  writeFileSync(join(dir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

interface Harness extends ConAiApp {
  export_dir: string
  get: (path: string) => Promise<Response>
}

function harness(options: { web_dist?: string; adapter?: ModelAdapter } = {}): Harness {
  const store = new SqliteStore(':memory:')
  const exportDir = mkdtempSync(join(tmpdir(), 'con-ai-exports-'))
  const created = createApp({
    store,
    adapter: options.adapter ?? fakeAdapter(),
    render: fakeRender,
    validate: async () => [],
    export_dir: exportDir,
    web_dist: options.web_dist,
    // 브라우저가 설치된 환경에서도 결과가 같도록 감지에 쓰이는 env 를 통제한다.
    env: { PLAYWRIGHT_CHROMIUM_PATH: '/definitely/not/here', PLAYWRIGHT_BROWSERS_PATH: join(exportDir, 'no-browsers'), HOME: join(exportDir, 'no-home') },
    log: () => {},
  })
  cleanups.push(() => {
    store.close()
    rmSync(exportDir, { recursive: true, force: true })
  })
  return { ...created, export_dir: exportDir, get: async (path: string) => created.app.request(path) }
}

// ---------- 테스트 ----------

describe('운영 모드 — 웹 빌드 정적 제공', () => {
  it('웹 빌드가 있으면 같은 포트에서 index.html·자산을 제공한다 (캐시 헤더 포함)', async () => {
    const dir = fakeWebDist()
    const h = harness({ web_dist: dir })
    expect(h.web_dist).toBe(dir)

    const root = await h.get('/')
    expect(root.status).toBe(200)
    expect(root.headers.get('content-type')).toMatch(/text\/html/)
    expect(await root.text()).toContain('<div id="root">')
    expect(root.headers.get('cache-control')).toBe('no-cache')

    const asset = await h.get('/assets/index-abc123.js')
    expect(asset.status).toBe(200)
    expect(await asset.text()).toContain('빌드 산출물')
    expect(asset.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')

    const favicon = await h.get('/favicon.svg')
    expect(favicon.status).toBe(200)
    // assets/* 밖의 파일은 배포마다 같은 이름으로 바뀔 수 있으므로 캐시하지 않는다.
    expect(favicon.headers.get('cache-control')).toBe('no-cache')
  })

  it('없는 경로는 index.html 로 폴백한다 (SPA 라우팅). 존재하지 않는 자산은 폴백하지 않는다', async () => {
    const h = harness({ web_dist: fakeWebDist() })

    for (const path of ['/screens', '/projects/abc/review', '/한글경로']) {
      const res = await h.get(path)
      expect(res.status, path).toBe(200)
      expect(res.headers.get('content-type'), path).toMatch(/text\/html/)
      expect(await res.text(), path).toContain('<div id="root">')
      expect(res.headers.get('cache-control'), path).toBe('no-cache')
    }

    // 없는 assets 파일은 index.html 을 주면 안 된다(스크립트 자리에 HTML 이 오면 원인 파악이 어려워진다).
    const missingAsset = await h.get('/assets/없는파일.js')
    expect(missingAsset.status).toBe(404)
    expect(missingAsset.headers.get('content-type')).toMatch(/application\/json/)
    expect((await missingAsset.json()) as { error: string }).toMatchObject({ error: 'not_found' })
  })

  it('정적 제공이 켜져도 /api/*·/exports/*·/asis-sample·/healthz 는 그대로 동작하고 폴백에 먹히지 않는다', async () => {
    const h = harness({ web_dist: fakeWebDist() })

    const meta = await h.get('/api/meta')
    expect(meta.status).toBe(200)
    expect((await meta.json()) as { adapter: string }).toMatchObject({ adapter: 'fixture' })

    const projects = await h.get('/api/projects')
    expect(projects.status).toBe(200)
    expect(await projects.json()).toEqual([])

    const sample = await h.get('/asis-sample')
    expect(sample.status).toBe(200)
    expect(await sample.text()).toContain('<!doctype html>')

    // 없는 API 경로는 index.html 이 아니라 JSON 404 여야 한다 (프런트가 오류를 읽을 수 있어야 한다).
    for (const path of ['/api/없는경로', '/api/projects/없는아이디', '/exports/없는폴더/index.html', '/healthz/추가경로']) {
      const res = await h.get(path)
      expect(res.status, path).toBe(404)
      expect(res.headers.get('content-type'), path).toMatch(/application\/json/)
      expect((await res.json()) as { error: string }, path).toMatchObject({ error: 'not_found' })
    }

    // 실제 내보내기 파일은 계속 제공된다.
    mkdirSync(join(h.export_dir, 'sample'), { recursive: true })
    writeFileSync(join(h.export_dir, 'sample', 'index.html'), '<!doctype html><p>내보낸 산출물</p>')
    const exported = await h.get('/exports/sample/index.html')
    expect(exported.status).toBe(200)
    expect(await exported.text()).toContain('내보낸 산출물')
  })

  it('웹 빌드가 없으면 정적 제공을 켜지 않는다 (API 는 그대로, 그 밖의 경로는 404 JSON)', async () => {
    const h = harness()
    expect(h.web_dist).toBeNull()

    expect((await h.get('/api/meta')).status).toBe(200)

    const root = await h.get('/')
    expect(root.status).toBe(404)
    expect(root.headers.get('content-type')).toMatch(/application\/json/)
    expect((await root.json()) as { error: string }).toMatchObject({ error: 'not_found' })

    const spa = await h.get('/screens')
    expect(spa.status).toBe(404)
    expect((await spa.json()) as { error: string }).toMatchObject({ error: 'not_found' })
  })
})

describe('GET /healthz', () => {
  it('상태·어댑터·Playwright·DB·가동시간을 주고 키·토큰 값은 넣지 않는다', async () => {
    const h = harness({ web_dist: fakeWebDist() })
    const res = await h.get('/healthz')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).toEqual({ status: 'ok', adapter: 'fixture', playwright: false, db: 'ok', uptime_s: expect.any(Number) })
    expect(body['uptime_s'] as number).toBeGreaterThanOrEqual(0)
    // 비밀값·경로가 새지 않는지 (DB 파일 경로·키·토큰 어느 것도 넣지 않는다).
    expect(JSON.stringify(body)).not.toMatch(/sk-ant|api_key|auth_token|secret|\.db/i)
  })

  it('정적 제공이 꺼져 있어도 동작하고, DB 를 읽지 못하면 503 error 를 준다', async () => {
    const h = harness()
    expect((await h.get('/healthz')).status).toBe(200)

    // 저장소를 닫아 읽기가 실패하는 상황을 만든다.
    const store = new SqliteStore(':memory:')
    const exportDir = mkdtempSync(join(tmpdir(), 'con-ai-exports-'))
    cleanups.push(() => rmSync(exportDir, { recursive: true, force: true }))
    const app = createApp({ store, adapter: fakeAdapter(), render: fakeRender, validate: async () => [], export_dir: exportDir, log: () => {} })
    store.close()
    const res = await app.app.request('/healthz')
    expect(res.status).toBe(503)
    expect((await res.json()) as { status: string; db: string }).toMatchObject({ status: 'error', db: 'error' })
  })
})

describe('runtime 보조 함수', () => {
  it('예약 경로 판정 — 접두사와 정확히 같거나 그 하위만', () => {
    for (const p of ['/api', '/api/meta', '/exports', '/exports/a/b.html', '/asis-sample', '/healthz']) expect(isReservedPath(p), p).toBe(true)
    for (const p of ['/', '/apix', '/asis-sample-2', '/healthzz', '/assets/index.js', '/screens/api']) expect(isReservedPath(p), p).toBe(false)
  })

  it('SPA 폴백 대상 — 예약 경로·파일 경로는 폴백하지 않는다', () => {
    for (const p of ['/', '/screens', '/projects/1/review', '/index.html']) expect(shouldFallbackToIndex(p), p).toBe(true)
    // 데모 빌드(base /con-ai/)를 실수로 올렸을 때의 자산 경로도 HTML 이 아니라 404 로 알린다.
    for (const p of ['/api/meta', '/exports/a', '/healthz', '/assets/index-abc.js', '/con-ai/assets/index-abc.js', '/favicon.ico']) {
      expect(shouldFallbackToIndex(p), p).toBe(false)
    }
  })

  it('캐시 정책 — assets/* 만 불변, 나머지는 no-cache', () => {
    expect(cacheControlFor('/assets/index-abc.js')).toBe('public, max-age=31536000, immutable')
    expect(cacheControlFor('/')).toBe('no-cache')
    expect(cacheControlFor('/index.html')).toBe('no-cache')
    expect(cacheControlFor('/favicon.svg')).toBe('no-cache')
  })

  it('웹 빌드 위치 — WEB_DIST 우선, index.html 이 있어야 사용 가능', () => {
    const dir = fakeWebDist()
    const missing = join(dir, '없는하위')

    expect(resolveWebDist({ WEB_DIST: dir }, missing)).toEqual({ dir, available: true, from_env: true })
    expect(resolveWebDist({}, dir)).toEqual({ dir, available: true, from_env: false })
    expect(resolveWebDist({ WEB_DIST: '  ' }, missing)).toEqual({ dir: missing, available: false, from_env: false })
    expect(resolveWebDist({}, missing)).toEqual({ dir: missing, available: false, from_env: false })
  })

  it('시작 로그 — 접속 주소·웹 빌드 상태·인증 경고. anthropic 이면 더 눈에 띈다', () => {
    const dir = fakeWebDist()
    const on = buildStartupLines({ host: '0.0.0.0', port: 8787, adapter: 'fixture', web: { dir, available: true, from_env: false } })
    expect(on[0]).toContain('http://localhost:8787')
    expect(on.join('\n')).toContain(dir)
    expect(on).toContain(NO_AUTH_WARNING)

    const off = buildStartupLines({ host: '127.0.0.1', port: 3000, adapter: 'fixture', web: { dir: '/없는/경로', available: false, from_env: true } })
    expect(off[0]).toContain('http://127.0.0.1:3000')
    expect(off.join('\n')).toContain('웹 빌드 없음 — pnpm build:web 후 다시 시작하면 같은 포트에서 UI 를 제공한다')
    expect(off).toContain(NO_AUTH_WARNING)

    const real = buildStartupLines({ host: '0.0.0.0', port: 8787, adapter: 'anthropic', web: { dir, available: true, from_env: false } })
    expect(real).toContain(NO_AUTH_WARNING)
    expect(real.join('\n')).toContain('====')
    expect(real.join('\n')).toContain('어댑터 anthropic')
    expect(real.length).toBeGreaterThan(on.length)
  })
})
