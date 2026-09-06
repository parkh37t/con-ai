/** 시드 테스트 — 모든 레퍼런스 spec 이 ScreenSpec 으로 파싱되고, 화면 3개·요구사항 5건·더미데이터가 fixture_id 와 맞고, 두 번 실행해도 중복되지 않는다. */
import { describe, expect, it } from 'vitest'
import { IANode, PromptTemplate, ScreenSpec, ShellId } from '@con-ai/schemas'
import { sha256, type DocumentKind, type DummyDataDocument, type ProjectDocument, type ReferenceDocument, type RequirementDocument, type ScreenDocument } from '@con-ai/worker-generation'
import { SEED, SEED_DUMMY_DATA, SEED_PROJECT_NAME, SEED_REFERENCES, SEED_REQUIREMENTS, SEED_SCREENS, goldenCreatePopupSpec, goldenDetailSpec, goldenListSpec, seedIfEmpty } from './seed.js'
import { SqliteStore } from './store.js'

describe('시드 (계약 §10)', () => {
  it('레퍼런스 3개의 spec 은 모두 ScreenSpec(참조 검사 포함)으로 파싱된다', () => {
    expect(SEED_REFERENCES).toHaveLength(3)
    for (const ref of SEED_REFERENCES) {
      const parsed = ScreenSpec.safeParse(ref.spec)
      expect(parsed.success, `${ref.title}: ${parsed.success ? '' : JSON.stringify(parsed.error.issues)}`).toBe(true)
      expect(ShellId.safeParse(ref.spec.shell).success).toBe(true)
      expect(ref.source).toBe('S2B 학습 규격 적용 합성 예시')
    }
    expect(SEED_REFERENCES.map((r) => r.category)).toEqual(['list', 'detail', 'popup'])
  })

  it('골든 spec 을 화면 ID·기준 버전·fixture 접두어만 바꿔 만들어도 ScreenSpec 을 통과한다 (fixture 어댑터가 쓰는 변형)', () => {
    const list = goldenListSpec('SAMPLE-quote-list', SEED.baseline_id, 'SAMPLE-quote-list', 'SAMPLE-quote-detail', 'SAMPLE-quote-create-popup')
    const detail = goldenDetailSpec('SAMPLE-quote-detail', SEED.baseline_id, 'SAMPLE-quote-detail', 'SAMPLE-quote-list')
    const popup = goldenCreatePopupSpec('SAMPLE-quote-create-popup', SEED.baseline_id, 'SAMPLE-quote-create-popup')
    for (const spec of [list, detail, popup]) {
      const parsed = ScreenSpec.safeParse(spec)
      expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe(true)
    }
    expect(list.states.map((s) => s.fixture_id)).toEqual(['SAMPLE-quote-list-normal', 'SAMPLE-quote-list-searched', 'SAMPLE-quote-list-empty', 'SAMPLE-quote-list-error', 'SAMPLE-quote-list-permission'])
  })

  it('레퍼런스 spec 의 요구사항·수용조건은 시드 요구사항에 있는 ID 만 쓰고, 비UI 수용조건은 화면에 매핑하지 않는다', () => {
    const criteria = new Map<string, 'ui' | 'non_ui'>()
    for (const r of SEED_REQUIREMENTS) for (const c of r.criteria) criteria.set(c.id, c.kind)
    const reqIds = new Set(SEED_REQUIREMENTS.map((r) => r.external_id))
    for (const ref of SEED_REFERENCES) {
      for (const r of ref.spec.requirements) {
        expect(reqIds.has(r.id), `${ref.title}: ${r.id}`).toBe(true)
        for (const c of r.criterion_ids) expect(criteria.get(c), `${ref.title}: ${c}`).toBe('ui')
      }
    }
  })

  it('요구사항은 5건이고 수용조건은 각 2~3개이며 비UI 조건이 딱 1건 있다', () => {
    expect(SEED_REQUIREMENTS).toHaveLength(5)
    for (const r of SEED_REQUIREMENTS) {
      expect(r.criteria.length).toBeGreaterThanOrEqual(2)
      expect(r.criteria.length).toBeLessThanOrEqual(3)
      expect(r.external_id).toMatch(/^REQ-/)
      for (const c of r.criteria) expect(c.id).toMatch(/^AC-/)
    }
    const nonUi = SEED_REQUIREMENTS.flatMap((r) => r.criteria).filter((c) => c.kind === 'non_ui')
    expect(nonUi).toHaveLength(1)
  })

  it('레퍼런스와 화면의 모든 states[].fixture_id 에 더미데이터 문서가 있고, 목록 정상 CASE 는 5행이다', () => {
    const dummyIds = new Set(SEED_DUMMY_DATA.map((d) => d.id))
    expect(dummyIds.size).toBe(SEED_DUMMY_DATA.length)
    for (const ref of SEED_REFERENCES) {
      for (const s of ref.spec.states) expect(dummyIds.has(s.fixture_id), `${ref.title}: ${s.fixture_id}`).toBe(true)
    }
    for (const screen of SEED_SCREENS) {
      expect(SEED_DUMMY_DATA.some((d) => d.id === `${screen.external_id}-normal`)).toBe(true)
      expect(SEED_DUMMY_DATA.some((d) => d.id === `${screen.external_id}-error`)).toBe(true)
    }
    const normal = SEED_DUMMY_DATA.find((d) => d.id === 'SAMPLE-quote-list-normal')
    expect(normal?.rows).toHaveLength(5)
    expect(SEED_DUMMY_DATA.find((d) => d.id === 'SAMPLE-quote-list-searched')?.rows).toHaveLength(1)
    expect(SEED_DUMMY_DATA.find((d) => d.id === 'SAMPLE-quote-list-empty')?.rows).toEqual([])
    expect(SEED_DUMMY_DATA.find((d) => d.id === 'SAMPLE-quote-list-error')?.case_kind).toBe('error')
  })

  /**
   * 이 검사의 대상은 **견적 포털 시드**다. 같은 seedIfEmpty 가 도메인 샘플(뱅킹·커머스)도 넣으므로
   * 개수는 프로젝트로 걸러서 센다 (도메인 쪽은 seed-domains.test.ts 가 따로 본다).
   */
  it('빈 DB 에 시드하면 견적 프로젝트의 화면 3개·IA·레퍼런스·더미·템플릿이 들어가고, 두 번째 호출은 아무것도 하지 않는다', () => {
    const store = new SqliteStore(':memory:')
    const first = seedIfEmpty(store, () => '2026-09-05T09:00:00.000Z')
    expect(first.seeded).toBe(true)
    expect(first.project_id).toBe(SEED.project_id)

    const mine = <T extends { project_id?: string | undefined }>(kind: DocumentKind) => store.list<T>(kind, (d) => d.data.project_id === SEED.project_id)

    const project = store.list<ProjectDocument>('project').find((p) => p.id === SEED.project_id)
    expect(project?.data.name).toBe(SEED_PROJECT_NAME)
    expect(project?.data.baseline_id).toBe(SEED.baseline_id)

    const screens = mine<ScreenDocument>('screen')
    expect(screens.map((s) => s.data.external_id)).toEqual(['SAMPLE-quote-list', 'SAMPLE-quote-detail', 'SAMPLE-quote-create-popup'])
    expect(screens.map((s) => s.data.shell)).toEqual(['partner-page', 'partner-page', 'partner-popup'])
    for (const s of screens) expect(ShellId.safeParse(s.data.shell).success).toBe(true)

    const nodes = mine<IANode>('ia_node')
    expect(nodes).toHaveLength(5)
    for (const n of store.list<IANode>('ia_node')) expect(IANode.safeParse(n.data).success).toBe(true)
    const screenNodes = nodes.filter((n) => n.data.kind === 'screen')
    expect(new Set(screenNodes.map((n) => n.data.screen_plan_id))).toEqual(new Set(screens.map((s) => s.id)))

    expect(mine<RequirementDocument>('requirement')).toHaveLength(5)
    expect(mine<ReferenceDocument>('reference')).toHaveLength(3)
    expect(mine<DummyDataDocument>('dummy_data')).toHaveLength(SEED_DUMMY_DATA.length)

    const templates = store.list<{ version: string; body: string; body_hash: string }>('prompt_template')
    expect(templates).toHaveLength(1)
    expect(templates[0]?.data.version).toBe('v1')
    expect(templates[0]?.data.body_hash).toBe(sha256(templates[0]?.data.body ?? ''))
    expect(PromptTemplate.safeParse(templates[0]?.data).success).toBe(true)

    const before = store.count()
    const second = seedIfEmpty(store)
    expect(second.seeded).toBe(false)
    expect(store.count()).toBe(before) // 다시 불러도 늘지 않는다
    // 견적 시드가 넣은 문서 수는 그대로다 (도메인 샘플이 끼어들어도 이 프로젝트의 수는 변하지 않는다).
    expect(1 + mine('requirement').length + mine('ia_node').length + mine('screen').length + mine('reference').length + mine('dummy_data').length + 1).toBe(
      1 + 5 + 5 + 3 + 3 + SEED_DUMMY_DATA.length + 1,
    )
    store.close()
  })
})
