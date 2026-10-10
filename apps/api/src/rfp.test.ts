/**
 * RFP 분석 API — 접수 → 추출(가짜 어댑터) → 채택 → **RTM 분모 변화**까지.
 *
 * 여기서 못 박는 것:
 * - **모델이 지어낸 인용은 저장되지 않는다.** `rejected` 로 남고 요구사항 후보에 들어가지 않는다.
 * - **채택 전에는 RTM 분모가 그대로다.** 분석만으로 커버리지 분모가 늘면 숫자가 거짓이 된다.
 * - **채택은 사유·행위자와 함께**, 두 번 채택되지 않고, 끝나지 않은 분석에는 할 수 없다.
 * - 상세 응답에 **원문을 담지 않는다** (고객 자료를 응답에 싣지 않는다).
 * - 실패를 succeeded 로 적지 않는다 — 어댑터 오류 종류별로 다른 코드가 남는다.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AdapterError, type ModelAdapter } from '@con-ai/model-adapter'
import type { RenderInput, RenderOutput } from '@con-ai/renderer'
import type { RtmReport } from '@con-ai/domain'
import { createApp } from './app.js'
import { SEED, seedIfEmpty } from './seed.js'
import { SqliteStore } from './store.js'

let clock = 0
const now = (): string => new Date(Date.UTC(2026, 9, 10, 12, 0, ++clock)).toISOString()
let idSeq = 0
const newId = (): string => `e0000000-0000-4000-8000-${String(++idSeq).padStart(12, '0')}`

const SOURCE = [
  '발주처: 샘플 금융',
  '3.1 파트너는 견적 목록을 조회할 수 있어야 한다.',
  '3.2 시스템은 응답시간 2초 이내를 보장해야 한다.',
  '4.1 평가는 사업 이해도 20점으로 한다.',
].join('\n')

/** 모델 대신 쓰는 가짜 추출기 — 본 테스트의 관심은 **서버가 무엇을 믿는가**다. */
function fakeExtraction(over: { fabricate?: boolean } = {}) {
  return {
    overview: { org: '샘플 금융', project_name: '', period: '', budget: '', deliverables: [], constraints: [] },
    evaluation_items: [{ label: '사업 이해도', weight: 20, description: '', source: { label: 'RFP 4.1', quote: '4.1 평가는 사업 이해도 20점으로 한다.' } }],
    requirements: [
      {
        kind: 'FR' as const,
        title: '견적 목록 조회',
        detail: '파트너가 견적 목록을 조회한다',
        priority: 'M' as const,
        priority_reason: 'RFP 3.1 의무 표현',
        source: { label: 'RFP 3.1', quote: '3.1 파트너는 견적 목록을 조회할 수 있어야 한다.' },
        criteria: [{ text: '목록을 조회한다', kind: 'ui' as const }],
      },
      {
        kind: 'NFR' as const,
        title: '응답시간',
        detail: '2초 이내',
        priority: 'M' as const,
        priority_reason: 'RFP 3.2 보장 표현',
        source: { label: 'RFP 3.2', quote: '3.2 시스템은 응답시간 2초 이내를 보장해야 한다.' },
        criteria: [],
        nfr_axis: 'performance' as const,
      },
      ...(over.fabricate === true
        ? [
            {
              kind: 'FR' as const,
              title: '블록체인 공증',
              detail: '지어낸 요구사항',
              priority: 'M' as const,
              priority_reason: '지어낸 근거',
              source: { label: 'RFP 9.9', quote: '시스템은 블록체인으로 견적을 공증해야 한다.' },
              criteria: [],
            },
          ]
        : []),
    ],
    unresolved: [],
  }
}

const cleanups: Array<() => void> = []
afterEach(() => {
  for (const fn of cleanups.splice(0)) fn()
})

function harness(opts: { extract?: ModelAdapter['extractRfp'] } = {}) {
  const store = new SqliteStore(':memory:', { now })
  seedIfEmpty(store, now)
  const exportDir = mkdtempSync(join(tmpdir(), 'con-ai-rfp-'))
  const adapter: ModelAdapter = {
    kind: 'fixture',
    model: 'fake',
    auth: 'none',
    generateSpec: () => Promise.reject(new Error('이 테스트는 생성을 실행하지 않는다')),
    reviseSpec: () => Promise.reject(new Error('이 테스트는 수정을 실행하지 않는다')),
    draftRevisionPrompt: () => Promise.reject(new Error('이 테스트는 수정 지시문을 만들지 않는다')),
    draftPainPoints: () => Promise.reject(new Error('이 테스트는 AS-IS 를 실행하지 않는다')),
    extractRfp: opts.extract ?? (() => Promise.resolve(fakeExtraction())),
  }
  const created = createApp({
    store,
    adapter,
    render: (_input: RenderInput): RenderOutput => {
      throw new Error('이 테스트는 렌더를 실행하지 않는다')
    },
    validate: async () => [],
    export_dir: exportDir,
    env: { PLAYWRIGHT_CHROMIUM_PATH: '/definitely/not/here', HOME: join(exportDir, 'no-home') },
    now,
    newId,
    required_check_ids: [],
    log: () => {},
  })
  cleanups.push(() => {
    store.close()
    rmSync(exportDir, { recursive: true, force: true })
  })
  const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const post = async (path: string, body: unknown): Promise<Response> => created.app.request(path, json(body))
  const get = async (path: string): Promise<Response> => created.app.request(path)
  const start = async (over: Record<string, unknown> = {}): Promise<string> => {
    const res = await post(`/api/projects/${SEED.project_id}/rfp-analyses`, { source_name: '샘플 RFP', project_code: 'SMP', text: SOURCE, ...over })
    expect(res.status, await res.clone().text()).toBe(202)
    const { analysis_id } = (await res.json()) as { analysis_id: string }
    await created.queue.whenIdle()
    return analysis_id
  }
  const detail = async (id: string) => (await (await get(`/api/rfp-analyses/${id}`)).json()) as Record<string, unknown>
  const rtm = async (): Promise<RtmReport> => (await (await get(`/api/projects/${SEED.project_id}/rtm`)).json()) as RtmReport
  return { store, app: created.app, queue: created.queue, post, get, start, detail, rtm }
}

const ACTOR = { by: '기획자', reason: 'RFP 요구사항 채택' }

describe('POST /api/projects/:id/rfp-analyses — 접수', () => {
  it('접수하면 202 와 분석 id 를 주고, 큐가 돌아 succeeded 가 된다', async () => {
    const h = harness()
    const id = await h.start()
    const d = await h.detail(id)
    expect(d['status']).toBe('succeeded')
    expect(d['project_code']).toBe('SMP')
    expect(d['source_chars']).toBe(SOURCE.length)
    expect(d['source_hash']).toMatch(/^[0-9a-f]{8}$/)
  })

  it('**상세 응답에 원문을 담지 않는다** (고객 자료를 응답에 싣지 않는다)', async () => {
    const h = harness()
    const d = await h.detail(await h.start())
    expect(d['source_text']).toBeUndefined()
    expect(JSON.stringify(d)).not.toContain('발주처: 샘플 금융')
  })

  it('외부 ID 를 서버가 발번한다 ({코드}-{분류}-{번호})', async () => {
    const h = harness()
    const d = await h.detail(await h.start())
    const reqs = d['requirements'] as Array<{ external_id: string; kind: string }>
    expect(reqs.map((r) => r.external_id)).toEqual(['SMP-FR-001', 'SMP-NFR-001'])
  })

  it('없는 프로젝트는 404, 짧은 원문·잘못된 코드는 400 이고 작업을 만들지 않는다', async () => {
    const h = harness()
    expect((await h.post('/api/projects/nope/rfp-analyses', { source_name: 'x', project_code: 'SMP', text: SOURCE })).status).toBe(404)
    expect((await h.post(`/api/projects/${SEED.project_id}/rfp-analyses`, { source_name: 'x', project_code: 'SMP', text: '짧다' })).status).toBe(400)
    expect((await h.post(`/api/projects/${SEED.project_id}/rfp-analyses`, { source_name: 'x', project_code: '소문자', text: SOURCE })).status).toBe(400)
    expect(h.store.list('rfp_analysis')).toHaveLength(0)
  })

  it('목록은 건수 요약을 준다', async () => {
    const h = harness()
    await h.start()
    const list = (await (await h.get(`/api/projects/${SEED.project_id}/rfp-analyses`)).json()) as Array<Record<string, unknown>>
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ source_name: '샘플 RFP', status: 'succeeded', requirement_count: 2, rejected_count: 0, adopted_count: 0 })
  })
})

describe('지어낸 인용', () => {
  it('원문에 없는 인용은 요구사항 후보에 넣지 않고 rejected 로 남긴다', async () => {
    const h = harness({ extract: () => Promise.resolve(fakeExtraction({ fabricate: true })) })
    const d = await h.detail(await h.start())
    const reqs = d['requirements'] as Array<{ title: string }>
    const rejected = d['rejected'] as Array<{ reason: string; title: string; quote: string }>
    expect(reqs.map((r) => r.title)).toEqual(['견적 목록 조회', '응답시간'])
    expect(rejected).toHaveLength(1)
    expect(rejected[0]).toMatchObject({ reason: 'quote_not_found', title: '블록체인 공증' })
    // 왜 떨어졌는지 보려면 인용이 필요하다 — 조용히 버리지 않는다.
    expect(rejected[0]?.quote).toContain('블록체인')
  })

  it('거부된 요구사항은 채택할 수 없다 (목록에 없다)', async () => {
    const h = harness({ extract: () => Promise.resolve(fakeExtraction({ fabricate: true })) })
    const id = await h.start()
    const d = await h.detail(id)
    const res = await h.post(`/api/rfp-analyses/${id}/adoptions`, { ...ACTOR, external_ids: ['SMP-FR-002'], revision: d['revision'] })
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('unknown_requirement')
  })
})

describe('NFR 체크리스트', () => {
  it('요구사항이 없는 축을 missing 으로 적는다 (「없음」이 아니다)', async () => {
    const h = harness()
    const d = await h.detail(await h.start())
    const gaps = d['nfr_gaps'] as Array<{ axis: string; status: string }>
    expect(gaps.find((g) => g.axis === 'performance')?.status).toBe('covered')
    expect(gaps.find((g) => g.axis === 'audit')?.status).toBe('missing')
    expect(gaps.filter((g) => g.status === 'missing')).toHaveLength(5)
  })
})

describe('채택 — 분모는 채택할 때 늘어난다', () => {
  it('**분석만으로는 RTM 분모가 늘지 않는다**', async () => {
    const h = harness()
    const before = (await h.rtm()).summary.requirements_total
    await h.start()
    expect((await h.rtm()).summary.requirements_total).toBe(before)
  })

  it('채택하면 requirement 가 되고 그때 분모가 늘어난다', async () => {
    const h = harness()
    const id = await h.start()
    const before = (await h.rtm()).summary.requirements_total
    const d = await h.detail(id)
    const res = await h.post(`/api/rfp-analyses/${id}/adoptions`, { ...ACTOR, external_ids: ['SMP-FR-001', 'SMP-NFR-001'], revision: d['revision'] })
    expect(res.status, await res.clone().text()).toBe(200)
    const body = (await res.json()) as { adopted: string[]; adoptions: Array<{ by: string; reason: string; external_id: string }> }
    expect(body.adopted).toEqual(['SMP-FR-001', 'SMP-NFR-001'])
    expect(body.adoptions[0]).toMatchObject({ by: '기획자', reason: 'RFP 요구사항 채택', external_id: 'SMP-FR-001' })

    const after = await h.rtm()
    expect(after.summary.requirements_total).toBe(before + 2)
    // 채택된 요구사항은 아직 어느 IA 에도 붙지 않았으므로 unmapped 다 (연결은 사람이 한다).
    const row = after.rows.find((r) => r.requirement_external_id === 'SMP-FR-001')
    expect(row?.status).toBe('unmapped')
  })

  it('요구사항 본문에 출처·인용·우선순위 근거를 남긴다 (추적이 RFP 까지 올라간다)', async () => {
    const h = harness()
    const id = await h.start()
    const d = await h.detail(id)
    await h.post(`/api/rfp-analyses/${id}/adoptions`, { ...ACTOR, external_ids: ['SMP-FR-001'], revision: d['revision'] })
    const saved = h.store.list<{ external_id: string; body: string; criteria: Array<{ id: string; kind: string }> }>('requirement').find((x) => x.data.external_id === 'SMP-FR-001')
    expect(saved?.data.body).toContain('출처: RFP 3.1')
    expect(saved?.data.body).toContain('인용: 3.1 파트너는 견적 목록을 조회할 수 있어야 한다.')
    expect(saved?.data.body).toContain('우선순위: M')
    expect(saved?.data.criteria[0]?.id).toBe('AC-SMP-FR-001-01')
    expect(saved?.data.criteria[0]?.kind).toBe('ui')
  })

  it('채택한 요구사항의 **출처가 RTM 행까지 닿는다** (추적이 RFP 까지 올라간다)', async () => {
    const h = harness()
    const id = await h.start()
    const d = await h.detail(id)
    await h.post(`/api/rfp-analyses/${id}/adoptions`, { ...ACTOR, external_ids: ['SMP-FR-001'], revision: d['revision'] })
    const row = (await h.rtm()).rows.find((r) => r.requirement_external_id === 'SMP-FR-001')
    expect(row?.source_label).toBe('RFP 3.1')
    // 시드 요구사항에는 출처가 없다 — 지어내지 않는다 (화면이 「출처 미기록」이라고 적는다).
    expect((await h.rtm()).rows.find((r) => r.requirement_external_id === 'REQ-QT-001')?.source_label).toBeUndefined()
  })

  it('두 번 채택할 수 없다', async () => {
    const h = harness()
    const id = await h.start()
    const first = await h.detail(id)
    await h.post(`/api/rfp-analyses/${id}/adoptions`, { ...ACTOR, external_ids: ['SMP-FR-001'], revision: first['revision'] })
    const second = await h.detail(id)
    const res = await h.post(`/api/rfp-analyses/${id}/adoptions`, { ...ACTOR, external_ids: ['SMP-FR-001'], revision: second['revision'] })
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('already_adopted')
  })

  it('행위자·사유가 없으면 거부한다', async () => {
    const h = harness()
    const id = await h.start()
    const d = await h.detail(id)
    const res = await h.post(`/api/rfp-analyses/${id}/adoptions`, { by: '  ', reason: '', external_ids: ['SMP-FR-001'], revision: d['revision'] })
    expect(res.status).toBe(400)
  })

  it('오래된 revision 으로 채택하면 409 다 (설계 §11)', async () => {
    const h = harness()
    const id = await h.start()
    const d = await h.detail(id)
    await h.post(`/api/rfp-analyses/${id}/adoptions`, { ...ACTOR, external_ids: ['SMP-FR-001'], revision: d['revision'] })
    const res = await h.post(`/api/rfp-analyses/${id}/adoptions`, { ...ACTOR, external_ids: ['SMP-NFR-001'], revision: d['revision'] })
    expect(res.status).toBe(409)
  })

  it('끝나지 않은 분석에는 채택할 수 없다', async () => {
    const h = harness({ extract: () => Promise.reject(new AdapterError('not_logged_in', '로그인되지 않았다')) })
    const id = await h.start()
    const d = await h.detail(id)
    expect(d['status']).toBe('failed')
    const res = await h.post(`/api/rfp-analyses/${id}/adoptions`, { ...ACTOR, external_ids: ['SMP-FR-001'], revision: d['revision'] })
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('not_succeeded')
  })
})

describe('실패를 succeeded 로 적지 않는다', () => {
  it('로그인 안 됨은 auth, 한도는 limit, 시간 초과는 timeout 으로 구분해 남긴다', async () => {
    for (const [code, expected] of [
      ['not_logged_in', 'auth'],
      ['cli_missing', 'auth'],
      ['rate_limit', 'limit'],
      ['timeout', 'timeout'],
      ['parse', 'extract'],
    ] as const) {
      const h = harness({ extract: () => Promise.reject(new AdapterError(code, `${code} 발생`)) })
      const d = await h.detail(await h.start())
      expect(d['status'], code).toBe('failed')
      expect((d['failure'] as { code: string }).code, code).toBe(expected)
      expect(d['requirements']).toEqual([])
    }
  })

  it('어댑터가 모르는 예외를 던지면 internal 이다 (extract 로 뭉개지 않는다)', async () => {
    const h = harness({ extract: () => Promise.reject(new Error('예상 못 한 오류')) })
    const d = await h.detail(await h.start())
    expect((d['failure'] as { code: string; message: string })).toMatchObject({ code: 'internal', message: '예상 못 한 오류' })
  })
})
