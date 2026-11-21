/**
 * 「메뉴에서 화면 만들기」 규칙 — 메뉴구조도 → 화면 ID → 근거(SSOT) → 프롬프트.
 * 이 사슬이 화면과 프롬프트에서 다른 말을 하면 설계서를 되짚을 수 없다.
 */
import { describe, expect, it } from 'vitest'
import { buildPlanRequest, buildableNodes, flattenMenu, pickRequirements, planPurpose, screenStateOf, ssotFor } from './plan.js'
import type { IANode, Project, Reference, Requirement, ScreenSummary } from './types.js'

const node = (over: Partial<IANode> & Pick<IANode, 'id' | 'name' | 'kind'>): IANode => ({
  project_id: 'p', parent_id: null, order: 0, portal: 'MY 뱅킹', ...over,
})

const NODES: IANode[] = [
  node({ id: 'portal', name: 'MY 뱅킹', kind: 'category' }),
  node({ id: 'cat', name: '계좌', kind: 'category', parent_id: 'portal' }),
  node({ id: 'list', name: '거래내역 조회', kind: 'screen', parent_id: 'cat', order: 0, screen_plan_id: 's-list', requirement_ids: ['REQ-1'] }),
  node({ id: 'detail', name: '거래 상세', kind: 'screen', parent_id: 'cat', order: 1, screen_plan_id: 's-detail', requirement_ids: ['REQ-2'] }),
  node({ id: 'main', name: '메인 페이지', kind: 'screen', parent_id: 'portal', order: 1, screen_plan_id: 's-main', requirement_ids: ['REQ-5'] }),
]

const screen = (id: string, external: string, built = false): ScreenSummary => ({
  id, external_id: external, title: external, status: 'draft', revision_count: built ? 1 : 0, open_comments: 0,
  ...(built ? { current_revision_id: 'rev-1' } : {}),
})

const SCREENS = [screen('s-list', 'SAMPLE-list'), screen('s-detail', 'SAMPLE-detail'), screen('s-main', 'SAMPLE-main', true)]

const REQUIREMENTS: Requirement[] = [
  { id: 'r1', project_id: 'p', external_id: 'REQ-1', title: '거래내역 조회', body: '고객은 거래내역을 기간으로 검색한다.', criteria: [
    { id: 'AC-1', text: '검색한다', kind: 'ui' }, { id: 'AC-2', text: '감사 로그를 남긴다', kind: 'non_ui' } ] },
  { id: 'r5', project_id: 'p', external_id: 'REQ-5', title: '메인 화면 구성', body: '앱을 열면 요약을 본다.', criteria: [{ id: 'AC-5', text: '요약을 본다', kind: 'ui' }] },
]

const withoutBaseline = (p: Project): Project => {
  const { baseline_id: _drop, ...rest } = p
  return rest
}

const PROJECT: Project = { id: 'p', name: '뱅킹', org: '와일리', description: '', profile_id: 's2b-learned-v1', slug: 'bank', baseline_id: 'baseline-bank-1', created_at: '2026-01-01T00:00:00Z' }

describe('flattenMenu — 메뉴구조도를 화면에 그릴 순서로 편다', () => {
  it('깊이와 경로가 트리와 같다', () => {
    const list = flattenMenu(NODES, SCREENS)
    expect(list.map((n) => `${'  '.repeat(n.depth)}${n.node.name}`)).toEqual(['MY 뱅킹', '  계좌', '    거래내역 조회', '    거래 상세', '  메인 페이지'])
    expect(list.find((n) => n.node.id === 'detail')?.path).toEqual(['MY 뱅킹', '계좌'])
  })

  it('화면 상태 세 층을 구분한다 — 없음 / 고아 / 아직 안 만듦 / 만들어짐', () => {
    const list = flattenMenu(NODES, SCREENS)
    expect(list.find((n) => n.node.id === 'list')?.state).toBe('draft')
    expect(list.find((n) => n.node.id === 'main')?.state).toBe('built')
    expect(list.find((n) => n.node.id === 'cat')?.state).toBe('no_screen')
    // 붙었는데 화면 문서가 없으면 «고아» 다 — «아직 안 만듦» 과 섞지 않는다.
    expect(flattenMenu(NODES, []).find((n) => n.node.id === 'list')?.state).toBe('missing')
  })

  it('데모 스냅샷의 current_revision_id: null 을 «만들어짐» 으로 오판하지 않는다', () => {
    const nulled = { ...screen('s-list', 'SAMPLE-list'), current_revision_id: null } as unknown as ScreenSummary
    expect(screenStateOf(NODES[2] as IANode, nulled)).toBe('draft')
  })

  it('지금 만들 수 있는 메뉴만 고른다', () => {
    expect(buildableNodes(flattenMenu(NODES, SCREENS)).map((n) => n.node.name)).toEqual(['거래내역 조회', '거래 상세'])
  })

  it('부모 고리가 있어도 멈춘다', () => {
    const loop = [node({ id: 'a', name: 'A', kind: 'category', parent_id: 'b' }), node({ id: 'b', name: 'B', kind: 'category', parent_id: 'a' })]
    expect(() => flattenMenu(loop, [])).not.toThrow()
  })
})

describe('ssotFor — 이 화면을 만드는 근거를 빠짐없이 적는다', () => {
  const plan = () => flattenMenu(NODES, SCREENS).find((n) => n.node.id === 'list')!
  const refs: Reference[] = [{ id: 'REF-list', title: '목록 골든', category: 'list', description: '', spec: {}, tags: [], source: '합성' }]

  it('기준 버전·요구사항·수용조건·참고 골든·프로파일 규칙을 모두 싣는다', () => {
    const items = ssotFor({ plan: plan(), project: PROJECT, requirements: REQUIREMENTS, references: refs, reference_ids: ['REF-list'], profile_rule_count: 11 })
    expect(items.map((i) => i.kind)).toEqual(['기준 버전', '요구사항', '수용조건', '참고 골든', '프로파일 규칙'])
    expect(items[0]?.label).toBe('baseline-bank-1')
    expect(items.find((i) => i.kind === '수용조건')?.label).toContain('비UI 1건(화면에 매핑하지 않음)')
  })

  it('근거가 없으면 «없음» 이라고 적는다 — 빈칸으로 두지 않는다', () => {
    const orphan = { ...plan(), requirement_ids: [] }
    const items = ssotFor({ plan: orphan, project: PROJECT, requirements: REQUIREMENTS, references: [], reference_ids: [], profile_rule_count: 11 })
    expect(items.find((i) => i.kind === '요구사항')?.label).toContain('없음')
    expect(items.find((i) => i.kind === '참고 골든')?.label).toBe('없음')
  })

  it('기준 버전이 없으면 무엇으로 만든 기본값인지 밝힌다', () => {
    const items = ssotFor({ plan: plan(), project: withoutBaseline(PROJECT), requirements: REQUIREMENTS, references: [], reference_ids: [], profile_rule_count: 0 })
    expect(items[0]?.label).toBe('baseline-bank-1')
    expect(items[0]?.source).toContain('기본값')
  })
})

describe('buildPlanRequest — 메뉴에서 만든 생성 요청', () => {
  const plan = () => flattenMenu(NODES, SCREENS).find((n) => n.node.id === 'list')!

  it('이 메뉴가 담당하는 요구사항의 UI 수용조건만 넣는다 (비UI 는 화면에 매핑하지 않는다)', () => {
    const req = buildPlanRequest({ plan: plan(), screen_id: 's-list', device: 'mobile', requirements: REQUIREMENTS, reference_ids: ['REF-list'] })
    // 요청에는 내부 문서 id 가 실린다 (메뉴 노드는 외부 ID 로 적혀 있다) — 이걸 안 옮기면 reference_invalid 로 죽는다.
    expect(req.requirement_ids).toEqual(['r1'])
    expect(req.criterion_ids).toEqual(['AC-1'])
    expect(req.cases).toEqual(['normal', 'empty', 'error'])
    expect(req.device).toBe('mobile')
    expect(req.reference_ids).toEqual(['REF-list'])
  })

  it('목적 문장은 메뉴 경로와 요구사항 본문에서 만든다 — 도메인마다 손으로 적지 않는다', () => {
    const purpose = planPurpose(plan(), pickRequirements(plan(), REQUIREMENTS))
    expect(purpose).toContain('MY 뱅킹 > 계좌 > 거래내역 조회')
    expect(purpose).toContain('고객은 거래내역을 기간으로 검색한다.')
  })

  it('연결된 요구사항이 없으면 근거가 없다고 목적에 적는다', () => {
    expect(planPurpose({ ...plan(), requirement_ids: [] }, [])).toContain('근거가 없다')
  })
})
