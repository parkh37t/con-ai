/**
 * AS-IS 분석 (계약 §12) 테스트.
 *
 * (a) /asis-sample HTML 이 의도된 페인포인트 신호를 담는다 (외부 리소스 없음).
 * (b) 러너를 실제 chromium 으로 로컬 http 서버의 asis-sample 에 실행 → succeeded, PNG 스크린샷 2건, structure·pain_points 검증.
 * (c) 닫힌 포트 URL → failed('navigation'), 브라우저 실행 불가 → failed('browser'), 초안 실패 → failed('draft') — 실패를 succeeded 로 위장하지 않는다.
 * (d) app 통합: POST → 큐 완료 대기 → GET 상세 → PATCH 채택 → 목록 반영. 존재하지 않는 프로젝트 404, 잘못된 URL 400, 오래된 revision 409.
 */
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { FixtureAdapter, type ModelAdapter } from '@con-ai/model-adapter'
import type { RenderInput, RenderOutput } from '@con-ai/renderer'
import { FALLBACK_CHROMIUM_PATH } from '@con-ai/validators'
import { runAsisAnalysis, type AsisAnalysisDocument } from './asis-runner.js'
import { ASIS_SAMPLE_HTML } from './asis-sample.js'
import { createApp } from './app.js'
import { SEED, seedIfEmpty } from './seed.js'
import { SqliteStore } from './store.js'

const LONG = 120_000
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47]

let clock = 0
const now = (): string => new Date(Date.UTC(2026, 8, 5, 12, 0, ++clock)).toISOString()
let idSeq = 0
const newId = (): string => `b0000000-0000-4000-8000-${String(++idSeq).padStart(12, '0')}`

/** 실제 chromium 환경 — PLAYWRIGHT_CHROMIUM_PATH 가 없으면 /opt/pw-browsers/chromium 을 스스로 설정한다. */
function chromiumEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  const explicit = env.PLAYWRIGHT_CHROMIUM_PATH?.trim()
  if ((explicit === undefined || explicit === '') && existsSync(FALLBACK_CHROMIUM_PATH)) env.PLAYWRIGHT_CHROMIUM_PATH = FALLBACK_CHROMIUM_PATH
  return env
}

const cleanups: Array<() => void | Promise<void>> = []
afterEach(async () => {
  for (const fn of cleanups.splice(0)) await fn()
})

/** asis-sample 을 제공하는 로컬 http 서버 (외부 egress 없이 분석 대상 URL 을 만든다). */
async function serveSample(): Promise<string> {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(ASIS_SAMPLE_HTML)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('로컬 서버 주소를 얻지 못했다')
  cleanups.push(() => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))))
  return `http://127.0.0.1:${address.port}/asis-sample`
}

/** 아무도 듣지 않는(방금 닫은) 포트의 URL — 접속 거부가 나는 잘못된 URL. */
async function closedPortUrl(): Promise<string> {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('로컬 서버 주소를 얻지 못했다')
  const port = address.port
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())))
  return `http://127.0.0.1:${port}/asis-sample`
}

function memoryStore(): SqliteStore {
  const store = new SqliteStore(':memory:', { now })
  cleanups.push(() => store.close())
  return store
}

function queuedDoc(id: string, url: string, note?: string): AsisAnalysisDocument {
  const doc: AsisAnalysisDocument = { id, project_id: SEED.project_id, url, status: 'queued', adapter: 'fixture', model: 'fixture', created_at: now(), pain_points: [] }
  if (note !== undefined) doc.note = note
  return doc
}

function getDoc(store: SqliteStore, id: string): AsisAnalysisDocument {
  const doc = store.get<AsisAnalysisDocument>('asis_analysis', id)
  if (!doc) throw new Error(`문서 없음: ${id}`)
  return doc.data
}

// ---------- (a) asis-sample HTML ----------

describe('/asis-sample 합성 레거시 페이지 (계약 §12)', () => {
  const html = ASIS_SAMPLE_HTML
  const count = (re: RegExp): number => (html.match(re) ?? []).length

  it('의도된 페인포인트 신호를 담는다: 레이블 없는 입력 3, alt 없는 이미지 2, nav 링크 18, 모호한 버튼, caption 없는 표, h1 없음, iframe, description 없음', () => {
    expect(html).toContain('레거시 파트너몰(데모)')
    // 레이블 없는 입력 3개 (label 요소가 아예 없다)
    expect(count(/<input type="(?:text|password)"/g)).toBe(3)
    expect(html).not.toContain('<label')
    // alt 없는 이미지 2개 — 전부 1px data URI (외부 이미지 없음)
    expect(count(/<img /g)).toBe(2)
    expect(count(/<img src="data:image\/gif;base64,/g)).toBe(2)
    expect(html).not.toContain('alt=')
    // nav 링크 18개
    expect(count(/<a href="#menu-/g)).toBe(18)
    // 모호한 버튼 문구
    expect(html).toContain('>클릭</button>')
    expect(html).toContain('>여기</button>')
    // caption 없는 표 1개
    expect(count(/<table>/g)).toBe(1)
    expect(html).not.toContain('<caption')
    // h1 없음, h2 만 있는 배너
    expect(html).not.toMatch(/<h1[\s>]/)
    expect(html).toMatch(/<h2[\s>]/)
    // iframe(srcdoc) 1개
    expect(count(/<iframe srcdoc=/g)).toBe(1)
    // meta description 없음
    expect(html).not.toContain('name="description"')
    // 긴 본문
    expect(html.length).toBeGreaterThan(3000)
  })

  it('외부 리소스가 없다 (http/https 참조·script·link 없음)', () => {
    expect(html).not.toMatch(/\b(?:src|href)\s*=\s*"https?:/)
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<link')
    expect(html).not.toContain('@import')
  })
})

// ---------- (b) 러너 성공 경로 (실제 chromium) ----------

describe('runAsisAnalysis — 실제 chromium 으로 asis-sample 분석', () => {
  it(
    'succeeded: PNG 스크린샷 2건, structure(레이블 없는 필드 ≥3 포함), 페인포인트 ≥3 전부 proposed(PP-001…)',
    async () => {
      const url = await serveSample()
      const store = memoryStore()
      store.put<AsisAnalysisDocument>('asis_analysis', 'asis-ok', queuedDoc('asis-ok', url, '레거시 개편 검토'), 0)

      await runAsisAnalysis('asis-ok', { store, adapter: new FixtureAdapter(), now, env: chromiumEnv() })

      const doc = getDoc(store, 'asis-ok')
      expect(doc.status, JSON.stringify(doc.failure)).toBe('succeeded')
      expect(doc.failure).toBeUndefined()
      expect(doc.finished_at).toBeDefined()

      // 스크린샷 2건 — PNG 시그니처(\x89PNG)
      expect(doc.screenshots).toEqual({ desktop: 'asis-ok-desktop', mobile: 'asis-ok-mobile' })
      const desktop = store.getAsset('asis-ok-desktop')
      const mobile = store.getAsset('asis-ok-mobile')
      expect(desktop).toBeDefined()
      expect(mobile).toBeDefined()
      expect([...(desktop ?? []).slice(0, 4)]).toEqual(PNG_SIGNATURE)
      expect([...(mobile ?? []).slice(0, 4)]).toEqual(PNG_SIGNATURE)

      // structure (계약 §12 필드)
      const s = doc.structure
      if (s === undefined) throw new Error('structure 없음')
      expect(s.title).toBe('레거시 파트너몰(데모)')
      expect(s.lang).toBe('ko')
      expect(s.description).toBeUndefined()
      expect(s.headings.length).toBe(5)
      expect(s.headings.every((h) => h.level !== 1)).toBe(true)
      expect(s.headings[0]).toEqual({ level: 2, text: '레거시 파트너몰(데모)' })
      expect(s.nav_links.length).toBe(18)
      expect(s.nav_links[0]).toEqual({ text: '상품조회', href: '#menu-1' })
      expect(s.buttons).toEqual(['클릭', '여기'])
      expect(s.forms.length).toBe(1)
      expect(s.forms[0]?.name).toBe('login')
      expect(s.forms[0]?.fields.map((f) => f.name)).toEqual(['partner_id', 'partner_pw', 'branch_code'])
      expect(s.forms[0]?.fields.every((f) => f.label === undefined)).toBe(true)
      expect(s.counts.fields_without_label).toBeGreaterThanOrEqual(3)
      expect(s.counts).toEqual({ links: 18, images: 2, images_without_alt: 2, tables: 1, fields_without_label: 3, iframes: 1 })

      // 페인포인트 — 서버가 id(PP-001…)와 proposed 를 부여
      expect(doc.pain_points.length).toBeGreaterThanOrEqual(3)
      expect(doc.pain_points.map((p) => p.id)).toEqual(doc.pain_points.map((_, i) => `PP-${String(i + 1).padStart(3, '0')}`))
      expect(doc.pain_points.every((p) => p.status === 'proposed')).toBe(true)
      expect(doc.pain_points[0]?.severity).toBe('high')
      expect(doc.summary).toContain('[더미 어댑터]')
    },
    LONG,
  )
})

// ---------- (c) 실패 경로 ----------

describe('runAsisAnalysis — 실패는 code 와 함께 failed 로 기록한다 (succeeded 로 위장 금지)', () => {
  it(
    '잘못된 URL(닫힌 포트) → failed("navigation"), message 에 원인',
    async () => {
      const url = await closedPortUrl()
      const store = memoryStore()
      store.put<AsisAnalysisDocument>('asis_analysis', 'asis-nav', queuedDoc('asis-nav', url), 0)

      await runAsisAnalysis('asis-nav', { store, adapter: new FixtureAdapter(), now, env: chromiumEnv() })

      const doc = getDoc(store, 'asis-nav')
      expect(doc.status).toBe('failed')
      expect(doc.failure?.code).toBe('navigation')
      expect(doc.failure?.message).toContain(url)
      expect(doc.failure?.message.length ?? 0).toBeGreaterThan(0)
      expect(doc.finished_at).toBeDefined()
      expect(doc.screenshots).toBeUndefined()
      expect(doc.structure).toBeUndefined()
      expect(doc.pain_points).toEqual([])
    },
    LONG,
  )

  it('브라우저 실행 파일이 전부 실패하면 failed("browser")', async () => {
    const store = memoryStore()
    store.put<AsisAnalysisDocument>('asis_analysis', 'asis-br', queuedDoc('asis-br', 'http://127.0.0.1:1/'), 0)

    await runAsisAnalysis('asis-br', { store, adapter: new FixtureAdapter(), now, env: { PLAYWRIGHT_CHROMIUM_PATH: '/definitely/not/here/chromium' } })

    const doc = getDoc(store, 'asis-br')
    expect(doc.status).toBe('failed')
    expect(doc.failure?.code).toBe('browser')
    expect(doc.failure?.message).toContain('브라우저를 띄우지 못했다')
    expect(doc.screenshots).toBeUndefined()
  })

  it(
    '어댑터 draftPainPoints 가 실패하면 failed("draft") — 스크린샷·구조가 있어도 succeeded 로 저장하지 않는다',
    async () => {
      const url = await serveSample()
      const store = memoryStore()
      store.put<AsisAnalysisDocument>('asis_analysis', 'asis-dr', queuedDoc('asis-dr', url), 0)
      const failing: ModelAdapter = {
        kind: 'fixture',
        model: 'fixture',
        auth: 'none',
        generateSpec: async () => {
          throw new Error('이 테스트에서 쓰지 않는다')
        },
        reviseSpec: async () => {
          throw new Error('이 테스트에서 쓰지 않는다')
        },
        draftRevisionPrompt: async () => {
          throw new Error('이 테스트에서 쓰지 않는다')
        },
        draftPainPoints: async () => {
          throw new Error('모델 출력 파싱 실패 (가짜)')
        },
      }

      await runAsisAnalysis('asis-dr', { store, adapter: failing, now, env: chromiumEnv() })

      const doc = getDoc(store, 'asis-dr')
      expect(doc.status).toBe('failed')
      expect(doc.failure?.code).toBe('draft')
      expect(doc.failure?.message).toContain('모델 출력 파싱 실패 (가짜)')
      expect(doc.summary).toBeUndefined()
      expect(doc.screenshots).toBeUndefined()
    },
    LONG,
  )
})

// ---------- (d) app 통합 ----------

function fakeRender(input: RenderInput): RenderOutput {
  return { html: '<div class="root-shell"></div>', description: { screen_id: input.spec.screen_id, title: input.meta.screen_title, sections: [] }, element_index: [] }
}

function appHarness(env: NodeJS.ProcessEnv) {
  const store = memoryStore()
  seedIfEmpty(store, now)
  const exportDir = mkdtempSync(join(tmpdir(), 'con-ai-asis-exports-'))
  cleanups.push(() => rmSync(exportDir, { recursive: true, force: true }))
  const created = createApp({ store, adapter: new FixtureAdapter(), render: fakeRender, validate: async () => [], export_dir: exportDir, env, now, newId, log: () => {} })
  const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return {
    ...created,
    store,
    get: (path: string) => created.app.request(path),
    post: (path: string, body: unknown) => created.app.request(path, json('POST', body)),
    patch: (path: string, body: unknown) => created.app.request(path, json('PATCH', body)),
  }
}

describe('AS-IS API 통합 (계약 §12) — POST → 큐 → GET → PATCH → 목록', () => {
  it(
    '전체 흐름: 202 → 순차 큐 완료 → 상세 succeeded → 채택 PATCH → 목록 반영',
    async () => {
      const url = await serveSample()
      const h = appHarness(chromiumEnv())

      // POST — 202 { analysis_id }
      const postRes = await h.post(`/api/projects/${SEED.project_id}/asis-analyses`, { url, note: '레거시 개편 검토' })
      expect(postRes.status, await postRes.clone().text()).toBe(202)
      const { analysis_id } = (await postRes.json()) as { analysis_id: string }
      expect(analysis_id.length).toBeGreaterThan(0)

      // 같은 순차 큐가 asis 실행을 끝낼 때까지 대기
      await h.queue.whenIdle()

      // GET 상세 — succeeded + 페인포인트 전부 proposed + revision
      const detailRes = await h.get(`/api/asis-analyses/${analysis_id}`)
      expect(detailRes.status).toBe(200)
      const detail = (await detailRes.json()) as AsisAnalysisDocument & { revision: number }
      expect(detail.status, JSON.stringify(detail.failure)).toBe('succeeded')
      expect(detail.adapter).toBe('fixture')
      expect(detail.note).toBe('레거시 개편 검토')
      expect(detail.pain_points.length).toBeGreaterThanOrEqual(3)
      expect(detail.pain_points.every((p) => p.status === 'proposed')).toBe(true)
      expect(detail.structure?.counts.fields_without_label).toBeGreaterThanOrEqual(3)
      expect(detail.revision).toBeGreaterThanOrEqual(3) // queued → running → succeeded

      // 스크린샷 자산 — image/png + no-store + PNG 시그니처
      const assetRes = await h.get(`/api/asis-assets/${detail.screenshots?.desktop}`)
      expect(assetRes.status).toBe(200)
      expect(assetRes.headers.get('content-type')).toContain('image/png')
      expect(assetRes.headers.get('cache-control')).toBe('no-store')
      const bytes = new Uint8Array(await assetRes.arrayBuffer())
      expect([...bytes.slice(0, 4)]).toEqual(PNG_SIGNATURE)

      // PATCH — PP-001 채택
      const patchRes = await h.patch(`/api/asis-analyses/${analysis_id}/pain-points/PP-001`, { status: 'adopted', revision: detail.revision })
      expect(patchRes.status, await patchRes.clone().text()).toBe(200)
      const patched = (await patchRes.json()) as AsisAnalysisDocument & { revision: number }
      expect(patched.pain_points.find((p) => p.id === 'PP-001')?.status).toBe('adopted')
      expect(patched.pain_points.filter((p) => p.id !== 'PP-001').every((p) => p.status === 'proposed')).toBe(true)
      expect(patched.revision).toBe(detail.revision + 1)

      // 오래된 revision 으로 다시 저장 → 409 stale_revision (기존 관례)
      const staleRes = await h.patch(`/api/asis-analyses/${analysis_id}/pain-points/PP-002`, { status: 'rejected', revision: detail.revision })
      expect(staleRes.status).toBe(409)
      expect(((await staleRes.json()) as { error: string }).error).toBe('stale_revision')

      // 없는 페인포인트 → 404
      expect((await h.patch(`/api/asis-analyses/${analysis_id}/pain-points/PP-999`, { status: 'adopted', revision: patched.revision })).status).toBe(404)

      // 목록 — 채택 상태가 반영된 문서 1건 요약
      const listRes = await h.get(`/api/projects/${SEED.project_id}/asis-analyses`)
      expect(listRes.status).toBe(200)
      const list = (await listRes.json()) as Array<{ id: string; url: string; status: string; pain_point_count: number; created_at: string }>
      expect(list).toHaveLength(1)
      expect(list[0]).toEqual({ id: analysis_id, url, status: 'succeeded', pain_point_count: detail.pain_points.length, created_at: detail.created_at })

      // 새로고침 시나리오: 상세를 다시 읽어도 채택 상태가 DB 에서 유지된다
      const again = (await (await h.get(`/api/asis-analyses/${analysis_id}`)).json()) as AsisAnalysisDocument
      expect(again.pain_points.find((p) => p.id === 'PP-001')?.status).toBe('adopted')
    },
    LONG,
  )

  it('존재하지 않는 프로젝트는 404, 잘못된 URL 은 400 이고 문서를 만들지 않는다', async () => {
    const h = appHarness({ PLAYWRIGHT_CHROMIUM_PATH: '/definitely/not/here/chromium' })
    expect((await h.post('/api/projects/없는-프로젝트/asis-analyses', { url: 'http://127.0.0.1:1/' })).status).toBe(404)
    expect((await h.get('/api/projects/없는-프로젝트/asis-analyses')).status).toBe(404)
    expect((await h.get('/api/asis-analyses/없는-분석')).status).toBe(404)
    expect((await h.get('/api/asis-assets/없는-자산')).status).toBe(404)

    for (const bad of ['ftp://example.invalid/x', 'javascript:alert(1)', '상대/경로', `http://127.0.0.1/${'a'.repeat(2000)}`]) {
      const res = await h.post(`/api/projects/${SEED.project_id}/asis-analyses`, { url: bad })
      expect(res.status, `url=${bad.slice(0, 40)}`).toBe(400)
      expect(((await res.json()) as { error: string }).error).toBe('invalid_request')
    }
    await h.queue.whenIdle()
    expect(h.store.list('asis_analysis')).toHaveLength(0)
  })

  it('GET /asis-sample 은 text/html 로 데모 페이지를 준다', async () => {
    const h = appHarness({ PLAYWRIGHT_CHROMIUM_PATH: '/definitely/not/here/chromium' })
    const res = await h.get('/asis-sample')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await res.text()).toContain('레거시 파트너몰(데모)')
  })

  it('서버 재시작 시 queued/running asis 문서는 failed("internal") 로 정리된다 (기존 관례)', async () => {
    const store = memoryStore()
    seedIfEmpty(store, now)
    store.put<AsisAnalysisDocument>('asis_analysis', 'asis-stuck', { ...queuedDoc('asis-stuck', 'http://127.0.0.1:1/'), status: 'running' }, 0)
    const exportDir = mkdtempSync(join(tmpdir(), 'con-ai-asis-restart-'))
    cleanups.push(() => rmSync(exportDir, { recursive: true, force: true }))

    const created = createApp({ store, adapter: new FixtureAdapter(), render: fakeRender, validate: async () => [], export_dir: exportDir, env: {}, now, newId, log: () => {} })
    expect(created.recovered_asis_ids).toEqual(['asis-stuck'])
    const doc = getDoc(store, 'asis-stuck')
    expect(doc.status).toBe('failed')
    expect(doc.failure).toEqual({ code: 'internal', message: '서버 재시작으로 중단' })
    expect(doc.finished_at).toBeDefined()
  })

  it('브라우저를 못 띄우는 환경에서는 큐 실행이 failed("browser") 로 남는다 (성공으로 위장하지 않는다)', async () => {
    const h = appHarness({ PLAYWRIGHT_CHROMIUM_PATH: '/definitely/not/here/chromium' })
    const postRes = await h.post(`/api/projects/${SEED.project_id}/asis-analyses`, { url: 'http://127.0.0.1:1/' })
    expect(postRes.status).toBe(202)
    const { analysis_id } = (await postRes.json()) as { analysis_id: string }
    await h.queue.whenIdle()
    const detail = (await (await h.get(`/api/asis-analyses/${analysis_id}`)).json()) as AsisAnalysisDocument
    expect(detail.status).toBe('failed')
    expect(detail.failure?.code).toBe('browser')
  })
})
