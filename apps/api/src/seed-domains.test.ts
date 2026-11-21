/**
 * 도메인 샘플 시드 (뱅킹·커머스) — 명세가 파싱되는 것만으로는 부족하다.
 * 실제로 **렌더되고 V1·V2 검사를 통과하는지**까지 본다. 통과하지 못하면 프로토타입의 ②③④ 가 그 도메인에서 막힌다.
 */
import { ScreenSpec, ShellId } from '@con-ai/schemas'
import { renderScreen, S2B_LEARNED_PROFILE } from '@con-ai/renderer'
import { runV1, runV2 } from '@con-ai/validators'
import { describe, expect, it } from 'vitest'
import { SEED_DOMAINS, domainDocuments, domainDetailSpec, domainListSpec, domainMainSpec } from './seed-domains.js'
import { seedIfEmpty } from './seed.js'
import { SqliteStore } from './store.js'

const AT = '2026-09-06T00:00:00.000Z'

describe('도메인 샘플 시드 — 뱅킹 앱 · 커머스 스토어', () => {
  it('두 도메인이 있고 ID·slug 가 견적 시드와 겹치지 않는다', () => {
    expect(SEED_DOMAINS.map((d) => d.key)).toEqual(['banking', 'commerce'])
    const ids = SEED_DOMAINS.map((d) => d.project_id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id.startsWith('a1')).toBe(false)
  })

  it.each(SEED_DOMAINS.map((d) => [d.key, d] as const))('%s: 목록·상세 명세가 ScreenSpec(참조 검사 포함)을 통과한다', (_key, d) => {
    const list = domainListSpec(d, d.list.external_id, d.list.external_id, d.detail.external_id)
    const detail = domainDetailSpec(d, d.detail.external_id, d.detail.external_id, d.list.external_id)
    for (const spec of [list, detail]) {
      const parsed = ScreenSpec.safeParse(spec)
      expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe(true)
      expect(ShellId.safeParse(spec.shell).success).toBe(true)
    }
  })

  it.each(SEED_DOMAINS.map((d) => [d.key, d] as const))('%s: 명세의 요구사항·수용조건은 그 도메인에 있는 ID 만 쓰고 비UI 조건은 화면에 매핑하지 않는다', (_key, d) => {
    const criteria = new Map<string, 'ui' | 'non_ui'>()
    for (const r of d.requirements) for (const c of r.criteria) criteria.set(c.id, c.kind)
    const list = domainListSpec(d, d.list.external_id, d.list.external_id, d.detail.external_id)
    for (const r of list.requirements) {
      expect(d.requirements.some((x) => x.external_id === r.id), r.id).toBe(true)
      for (const c of r.criterion_ids) expect(criteria.get(c), c).toBe('ui')
    }
    // 각 도메인에 비UI 수용조건이 하나씩 있어 커버리지 분모 규칙(비UI 를 빼지 않는다)을 실제로 밟는다.
    expect(d.requirements.flatMap((r) => r.criteria).filter((c) => c.kind === 'non_ui')).toHaveLength(1)
  })

  it.each(SEED_DOMAINS.map((d) => [d.key, d] as const))('%s: 목록 명세가 렌더되고 V1·V2 필수 검사를 모두 통과한다', (_key, d) => {
    const spec = ScreenSpec.parse(domainListSpec(d, d.list.external_id, d.list.external_id, d.detail.external_id))
    const docs = domainDocuments(d, AT)
    const dummy: Record<string, unknown[]> = {}
    for (const doc of docs.dummy_data) dummy[doc.id] = doc.rows
    const rendered = renderScreen({
      spec,
      profile: S2B_LEARNED_PROFILE,
      dummy,
      meta: { screen_title: d.list.title, requirements: [], revision_label: 'r1', generated_by: 'seed-domains 테스트' },
    })
    expect(rendered.html.length).toBeGreaterThan(1000)

    const base = { artifact_hash: 'a'.repeat(64), validation_run_id: 'run-1' }
    const results = [...runV1(spec, { required_cases: ['normal', 'empty', 'error'], ...base }), ...runV2(rendered.html, spec, S2B_LEARNED_PROFILE, base)]
    const failed = results.filter((r) => r.required && r.status !== 'pass')
    expect(failed.map((r) => `${r.check_id}: ${r.message ?? ''}`)).toEqual([])
  })

  it.each(SEED_DOMAINS.map((d) => [d.key, d] as const))('%s: 모든 states[].fixture_id 에 더미데이터가 있다 (빈 표로 렌더되지 않게)', (_key, d) => {
    const docs = domainDocuments(d, AT)
    const ids = new Set(docs.dummy_data.map((x) => x.id))
    for (const ref of docs.references) {
      for (const s of ref.spec.states) expect(ids.has(s.fixture_id), `${ref.title}: ${s.fixture_id}`).toBe(true)
    }
    // 화면(SAMPLE-*) 쪽도 같은 fixture 를 갖는다 — 프로토타입이 이 화면을 실제로 생성한다.
    for (const screen of docs.screens) {
      expect(ids.has(`${screen.external_id}-normal`), `${screen.external_id}-normal`).toBe(true)
      expect(ids.has(`${screen.external_id}-error`), `${screen.external_id}-error`).toBe(true)
    }
    expect(docs.dummy_data.find((x) => x.id === `${d.list.external_id}-normal`)?.rows).toHaveLength(5)
    expect(docs.dummy_data.find((x) => x.id === `${d.list.external_id}-empty`)?.rows).toEqual([])
  })

  it('뱅킹 도메인에는 메인 화면이 있고, 넓힌 어휘(히어로·KPI 인포스트립·카드 그리드)를 실제로 쓴다', () => {
    const banking = SEED_DOMAINS.find((d) => d.key === 'banking')
    expect(banking?.main, '뱅킹 도메인에 메인 화면 정의가 있어야 한다').toBeDefined()
    if (banking?.main === undefined) return
    const spec = ScreenSpec.parse(domainMainSpec(banking, banking.main.external_id, banking.main.external_id))
    const types = spec.sections.flatMap((s) => s.elements.map((e) => e.type))
    expect(types).toContain('hero')
    expect(types).toContain('stat-strip')
    expect(types).toContain('card-grid')
    // 내용이 실제로 들어 있어야 «만들었다» 고 할 수 있다 (빈 상자 금지).
    const elements = spec.sections.flatMap((s) => s.elements)
    expect(elements.find((e) => e.type === 'hero')?.hero?.headline).toBeTruthy()
    expect(elements.find((e) => e.type === 'stat-strip')?.stats?.length ?? 0).toBeGreaterThanOrEqual(3)
    expect(elements.find((e) => e.type === 'card-grid')?.cards?.length ?? 0).toBeGreaterThanOrEqual(3)
  })

  it('메인 화면 명세가 렌더되고 V1·V2 필수 검사를 모두 통과한다 (내용이 화면에 실제로 그려진다)', () => {
    const banking = SEED_DOMAINS.find((d) => d.key === 'banking')
    if (banking?.main === undefined) throw new Error('뱅킹 메인 화면 정의가 없다')
    const spec = ScreenSpec.parse(domainMainSpec(banking, banking.main.external_id, banking.main.external_id))
    const docs = domainDocuments(banking, AT)
    const dummy: Record<string, unknown[]> = {}
    for (const doc of docs.dummy_data) dummy[doc.id] = doc.rows
    const rendered = renderScreen({
      spec,
      profile: S2B_LEARNED_PROFILE,
      dummy,
      meta: { screen_title: banking.main.title, requirements: [], revision_label: 'r1', generated_by: 'seed-domains 테스트', theme_id: banking.key, portal_name: banking.portal },
    })
    const base = { artifact_hash: 'a'.repeat(64), validation_run_id: 'run-main' }
    const results = [...runV1(spec, { required_cases: ['normal', 'empty', 'error'], ...base }), ...runV2(rendered.html, spec, S2B_LEARNED_PROFILE, base)]
    const failed = results.filter((r) => r.required && r.status !== 'pass')
    expect(failed.map((r) => `${r.check_id}: ${r.message ?? ''}`)).toEqual([])
    // V2.component_content 는 «대상 없음» 으로 비어 통과하면 안 된다 — 실제로 요소를 세었는지 본다.
    const content = results.find((r) => r.check_id === 'V2.component_content')
    expect(content?.evidence?.[0]).toContain('요소 3개')
  })

  it('메인 화면도 화면·레퍼런스·IA·더미데이터가 함께 있다', () => {
    const banking = SEED_DOMAINS.find((d) => d.key === 'banking')
    if (banking?.main === undefined) throw new Error('뱅킹 메인 화면 정의가 없다')
    const main = banking.main
    const docs = domainDocuments(banking, AT)
    expect(docs.screens.map((s) => s.external_id)).toContain(main.external_id)
    expect(docs.references.map((r) => r.id)).toContain(main.reference_uuid)
    expect(docs.references.find((r) => r.id === main.reference_uuid)?.category).toBe('main')
    expect(docs.ia_nodes.map((n) => n.id)).toContain(main.ia_id)
    const ids = new Set(docs.dummy_data.map((x) => x.id))
    for (const prefix of [main.external_id, main.reference_id]) {
      for (const suffix of ['normal', 'empty', 'error']) expect(ids.has(`${prefix}-${suffix}`), `${prefix}-${suffix}`).toBe(true)
    }
    expect(docs.dummy_data.find((x) => x.id === `${main.external_id}-normal`)?.rows).toHaveLength(main.notice_rows.length)
  })

  it('seedIfEmpty 가 프로젝트 3개(견적·뱅킹·커머스)를 넣고, 두 번 실행해도 늘어나지 않는다', () => {
    const store = new SqliteStore(':memory:')
    try {
      expect(seedIfEmpty(store, () => AT).seeded).toBe(true)
      const projects = store.list('project')
      expect(projects).toHaveLength(3)
      const names = projects.map((p) => (p.data as { name: string }).name).sort()
      expect(names.some((n) => n.includes('뱅킹'))).toBe(true)
      expect(names.some((n) => n.includes('커머스'))).toBe(true)

      // 도메인 화면은 draft 로 둔다 — 프로토타입에서 직접 만들어 보는 것이 목적이다.
      for (const d of SEED_DOMAINS) {
        const screens = store.list('screen', (x) => (x.data as { project_id: string }).project_id === d.project_id)
        expect(screens).toHaveLength(d.main === undefined ? 2 : 3)
        for (const s of screens) expect((s.data as { status: string }).status).toBe('draft')
      }

      expect(seedIfEmpty(store, () => AT).seeded).toBe(false)
      expect(store.list('project')).toHaveLength(3)
    } finally {
      store.close()
    }
  })
})
