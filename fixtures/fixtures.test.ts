/**
 * fixtures 검사 — manifest 의 기대와 실제 스키마 파싱 결과가 일치하는지, 그리고 validators 구현 전이라도
 * 각 실패 예제의 기대(잘못된 매핑 → 참조 실패, 누락 CASE → 필수 CASE 없음, 기준 불일치 → 검토 필요)가 코드로 남도록 고정한다.
 * 개발프롬프트 첫 수용조건: 요구사항 하나를 화면 요소·CASE 에 연결하고, 일부러 잘못된 매핑·누락 CASE 를 넣으면 검증이 실패한다.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AcceptanceCriterion,
  Baseline,
  EXAMPLE_ANCHOR_ID,
  NonUIScreenWork,
  Requirement,
  RequirementRevision,
  ScreenPlan,
  ScreenRevision,
  ScreenSpec,
  ScreenSpecShape,
  SourceAnchor,
  SourceDocument,
  TraceCoverage,
  TraceLink,
  XlsxImportConfig,
  checkScreenSpecReferences,
} from '@con-ai/schemas'
import {
  FIXTURES_DIR,
  listFixtureFiles,
  loadManifest,
  parseDummyDataFile,
  parseRecordsFile,
  readFixtureJson,
  type DummyDataFile,
  type FixtureEntry,
  type RecordsFile,
} from './manifest.js'

// ---------- 보조 ----------

interface ParseIssue {
  path: readonly PropertyKey[]
  message: string
}
type ParseResult = { success: true; data: unknown } | { success: false; error: { issues: readonly ParseIssue[] } }
interface Parser {
  safeParse(value: unknown): ParseResult
}

/** manifest 의 schema 이름 → 파서. DummyDataFile 은 fixtures/ 의 수동 검사다. */
const PARSERS: Readonly<Record<string, Parser>> = {
  ScreenSpec,
  ScreenSpecShape,
  SourceDocument,
  SourceAnchor,
  Requirement,
  RequirementRevision,
  AcceptanceCriterion,
  Baseline,
  ScreenPlan,
  ScreenRevision,
  NonUIScreenWork,
  TraceLink,
  TraceCoverage,
  XlsxImportConfig,
  DummyDataFile: {
    safeParse: (value) => {
      try {
        return { success: true, data: parseDummyDataFile(value) }
      } catch (e) {
        return { success: false, error: { issues: [{ path: [], message: e instanceof Error ? e.message : String(e) }] } }
      }
    },
  },
}

function parserFor(name: string): Parser {
  const parser = PARSERS[name]
  if (parser === undefined) throw new Error(`알 수 없는 스키마 이름: ${name}`)
  return parser
}

function issuePaths(result: ParseResult): string[] {
  if (result.success) return []
  return result.error.issues.map((i) => i.path.map(String).join('.')).sort()
}

const manifest = loadManifest()

function entry(id: string): FixtureEntry {
  const found = manifest.fixtures.find((f) => f.id === id)
  if (found === undefined) throw new Error(`manifest 에 fixture 가 없다: ${id}`)
  return found
}

const document = (id: string): unknown => readFixtureJson(entry(id).path)
const records = (id: string): RecordsFile => parseRecordsFile(document(id))
const spec = (id: string): ScreenSpec => ScreenSpec.parse(document(id))
const shape = (id: string): ScreenSpecShape => ScreenSpecShape.parse(document(id))

function recordsOf<T>(file: RecordsFile, schemaName: string, parser: { parse(value: unknown): T }): T[] {
  return file.records.filter((r) => r.schema === schemaName).map((r) => parser.parse(r.data))
}

function single<T>(items: readonly T[], what: string): T {
  const [first] = items
  if (first === undefined || items.length !== 1) throw new Error(`${what}: 정확히 1개여야 한다 (실제 ${items.length})`)
  return first
}

/** 요소·동작 trace 에 등장하는 수용조건 외부 ID 집합. */
function tracedCriteria(s: ScreenSpecShape): Set<string> {
  const traced = new Set<string>()
  for (const section of s.sections) for (const el of section.elements) for (const c of el.trace ?? []) traced.add(c)
  for (const action of s.actions) for (const c of action.trace ?? []) traced.add(c)
  return traced
}

function declaredCriteria(s: ScreenSpecShape): string[] {
  return s.requirements.flatMap((r) => r.criterion_ids)
}

// ---------- manifest 전체 순회 ----------

describe('manifest — 모든 항목의 기대와 실제 파싱 결과', () => {
  it('fixture id 와 path 는 중복이 없고 파일이 모두 존재한다', () => {
    const ids = manifest.fixtures.map((f) => f.id)
    const paths = manifest.fixtures.map((f) => f.path)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(paths).size).toBe(paths.length)
    for (const f of manifest.fixtures) expect(() => readFileSync(join(FIXTURES_DIR, f.path))).not.toThrow()
  })

  it('fixtures/ 의 모든 JSON 데이터 파일이 manifest 에 등록되어 있다', () => {
    const registered = new Set(manifest.fixtures.map((f) => f.path))
    const dataFiles = listFixtureFiles(['.json']).filter((p) => p !== 'manifest.json')
    expect(dataFiles.filter((p) => !registered.has(p))).toEqual([])
  })

  it('현재 기준 버전은 합성 요구사항 fixture 의 Baseline 과 같다', () => {
    const baseline = single(recordsOf(records('synthetic.example-requirements'), 'Baseline', Baseline), 'Baseline')
    expect(baseline.baseline_id).toBe(manifest.current_baseline_id)
  })

  for (const f of manifest.fixtures) {
    it(`${f.id} — 기대 parse=${f.expected.parse} 와 스키마 파싱 결과가 일치한다 (${f.expected.stage} ${f.expected.status})`, () => {
      if (f.layout === 'document') {
        if (f.schema === undefined) throw new Error('document 에는 schema 가 필요하다')
        const result = parserFor(f.schema).safeParse(document(f.id))
        expect(result.success, `${f.path} 파싱 결과가 기대(${f.expected.parse})와 다르다`).toBe(f.expected.parse === 'pass')
        if (f.expected.fail_paths !== undefined) expect(issuePaths(result)).toEqual([...f.expected.fail_paths].sort())
      } else {
        // records 봉투는 모든 레코드가 각자의 스키마로 파싱되어야 한다 (기대는 항상 pass)
        expect(f.expected.parse).toBe('pass')
        const file = records(f.id)
        const failures = file.records.flatMap((r, i) => {
          const result = parserFor(r.schema).safeParse(r.data)
          return result.success ? [] : [`records[${i}] ${r.schema}: ${result.error.issues.map((x) => `${x.path.map(String).join('.')} ${x.message}`).join('; ')}`]
        })
        expect(failures).toEqual([])
      }
    })
  }

  it('screen_spec 항목은 모두 구조 스키마(ScreenSpecShape)로 파싱된다 — 실패 예제는 참조·CASE·기준 문제이지 구조 문제가 아니다', () => {
    for (const f of manifest.fixtures.filter((x) => x.kind === 'screen_spec')) {
      expect(ScreenSpecShape.safeParse(document(f.id)).success, f.id).toBe(true)
    }
  })
})

// ---------- 화면명세: 첫 수용조건 ----------

describe('screen-specs/valid — 요구사항 하나를 요소·동작·CASE 에 연결한 정상 명세', () => {
  const valid = spec('screen-spec.valid')

  it('EXAMPLE-REQ-001 의 수용조건 3개와 EXAMPLE-REQ-002 의 1개가 모두 요소 또는 동작 trace 에 연결된다', () => {
    const declared = declaredCriteria(valid)
    expect(declared).toEqual(['EXAMPLE-AC-01', 'EXAMPLE-AC-02', 'EXAMPLE-AC-03', 'EXAMPLE-AC-04'])
    const traced = tracedCriteria(valid)
    expect(declared.filter((c) => !traced.has(c))).toEqual([])
  })

  it('필수 CASE(normal·empty·error)가 모두 있고 검색 CASE 도 있다', () => {
    const kinds = new Set(valid.states.map((s) => s.case_kind))
    for (const required of manifest.required_case_kinds) expect(kinds.has(required as never), required).toBe(true)
    expect(valid.states.map((s) => s.id)).toEqual(['normal', 'searched', 'empty', 'error'])
  })

  it('빈 결과 CASE 는 set-state 동작을 통해 수용조건 EXAMPLE-AC-03 에 연결된다 (CASE 자체에는 trace 필드가 없다)', () => {
    const toEmpty = valid.actions.filter((a) => a.type === 'set-state' && a.target_state_id === 'empty')
    expect(single(toEmpty, 'empty 전이 동작').trace).toEqual(['EXAMPLE-AC-03'])
  })

  it('수용조건 외부 ID 와 데이터 매핑 근거 anchor 가 합성 요구사항 fixture 로 해석된다', () => {
    const reqs = records('synthetic.example-requirements')
    const criteria = recordsOf(reqs, 'AcceptanceCriterion', AcceptanceCriterion)
    expect(criteria.map((c) => c.external_id).sort()).toEqual(declaredCriteria(valid).sort())
    expect(criteria.every((c) => c.kind === 'ui')).toBe(true)
    const anchorIds = new Set(recordsOf(reqs, 'SourceAnchor', SourceAnchor).map((a) => a.id))
    expect(anchorIds.has(EXAMPLE_ANCHOR_ID)).toBe(true)
    for (const m of valid.data_mapping) for (const e of m.evidence) expect(anchorIds.has(e.anchor_id), e.anchor_id).toBe(true)
    const revisions = recordsOf(reqs, 'RequirementRevision', RequirementRevision)
    expect(revisions.map((r) => r.external_id).sort()).toEqual(valid.requirements.map((r) => r.id).sort())
    expect(recordsOf(reqs, 'Requirement', Requirement)).toHaveLength(2)
  })

  it('표시 번호(a/b/c)는 영역마다 반복되며 오류가 아니다 (설계 §9)', () => {
    const firstDisplayNos = valid.sections.map((s) => s.elements[0]?.display_no)
    expect(firstDisplayNos).toEqual(['a', 'a'])
  })
})

describe('screen-specs/bad-mapping — 잘못된 매핑은 V1 참조 검사에서 실패한다', () => {
  const badEntry = entry('screen-spec.bad-mapping')

  it('valid 에서 order-table 의 trace 와 search-submit 의 target 두 곳만 바꾼 것이다', () => {
    const mutated = structuredClone(document('screen-spec.valid')) as { sections: { elements: { trace?: string[] }[] }[]; actions: { target?: string }[] }
    const table = mutated.sections[1]?.elements[0]
    const search = mutated.actions[0]
    if (table === undefined || search === undefined) throw new Error('valid 명세의 형태가 바뀌었다')
    table.trace = ['EXAMPLE-AC-99']
    search.target = 'result-table'
    expect(document('screen-spec.bad-mapping')).toEqual(mutated)
  })

  it('ScreenSpec 파싱이 actions.0.target 과 sections.1.elements.0.trace.0 에서 실패하고 checkScreenSpecReferences 도 같은 경로를 보고한다', () => {
    const result = ScreenSpec.safeParse(document('screen-spec.bad-mapping'))
    expect(result.success).toBe(false)
    expect(issuePaths(result)).toEqual(['actions.0.target', 'sections.1.elements.0.trace.0'])
    const issues = checkScreenSpecReferences(shape('screen-spec.bad-mapping'))
    expect(issues.map((i) => i.path.map(String).join('.')).sort()).toEqual([...(badEntry.expected.fail_paths ?? [])].sort())
    expect(issues.map((i) => i.message).join('\n')).toContain('EXAMPLE-AC-99')
    expect(issues.map((i) => i.message).join('\n')).toContain('result-table')
  })

  it('잘못 가리킨 수용조건 EXAMPLE-AC-99 는 합성 요구사항 fixture 에도 없다', () => {
    const criteria = recordsOf(records('synthetic.example-requirements'), 'AcceptanceCriterion', AcceptanceCriterion)
    expect(criteria.some((c) => c.external_id === 'EXAMPLE-AC-99')).toBe(false)
  })
})

describe('screen-specs/missing-case — 필수 CASE 누락은 V1/V3 CASE 검사에서 실패한다', () => {
  const missingEntry = entry('screen-spec.missing-case')
  const missing = spec('screen-spec.missing-case')

  it('valid 에서 empty·error CASE 와 그 전이 동작(show-empty, show-error)만 뺀 것이다', () => {
    const mutated = structuredClone(document('screen-spec.valid')) as { states: { id: string }[]; actions: { id: string }[] }
    mutated.states = mutated.states.filter((s) => s.id !== 'empty' && s.id !== 'error')
    mutated.actions = mutated.actions.filter((a) => a.id !== 'show-empty' && a.id !== 'show-error')
    expect(document('screen-spec.missing-case')).toEqual(mutated)
  })

  it('현재 스키마로는 파싱되지만 필수 CASE empty·error 가 states 에 없다 (validators 가 fail 로 판정할 기대)', () => {
    expect(missingEntry.expected).toMatchObject({ parse: 'pass', status: 'fail', missing_case_kinds: ['empty', 'error'] })
    const present = new Set(missing.states.map((s) => s.case_kind))
    const absent = manifest.required_case_kinds.filter((k) => !present.has(k as never))
    expect(absent).toEqual(missingEntry.expected.missing_case_kinds)
    expect(missing.messages.map((m) => m.id)).toContain('msg-empty')
  })

  it('CASE 가 빠지면 수용조건 EXAMPLE-AC-03(결과 없음 안내)도 요소·동작에 연결되지 않는다', () => {
    const traced = tracedCriteria(missing)
    const unlinked = declaredCriteria(missing).filter((c) => !traced.has(c))
    expect(unlinked).toEqual(missingEntry.expected.unlinked_criterion_ids)
  })
})

describe('screen-specs/stale-baseline — 기준 버전 불일치는 검토 필요', () => {
  const staleEntry = entry('screen-spec.stale-baseline')
  const stale = spec('screen-spec.stale-baseline')
  const valid = spec('screen-spec.valid')

  it('valid 에서 baseline_id 만 바꾼 것이며 파싱은 통과한다', () => {
    expect({ ...stale, baseline_id: valid.baseline_id }).toEqual(valid)
  })

  it('baseline_id 가 현재 기준과 다르므로 V0 에서 검토 필요로 판정한다', () => {
    expect(valid.baseline_id).toBe(manifest.current_baseline_id)
    expect(stale.baseline_id).not.toBe(manifest.current_baseline_id)
    expect(staleEntry.expected).toMatchObject({ parse: 'pass', stage: 'V0', status: 'fail', verdict: '검토 필요' })
  })
})

// ---------- 충돌·비UI ----------

describe('conflicts/req-sfr-066-001 — 제공 자료 충돌 보존 (정본 미확정)', () => {
  const file = records('conflict.req-sfr-066-001')
  const anchors = recordsOf(file, 'SourceAnchor', SourceAnchor)
  const link = single(recordsOf(file, 'TraceLink', TraceLink), 'TraceLink')
  const revision = single(recordsOf(file, 'RequirementRevision', RequirementRevision), 'RequirementRevision')

  it('TraceLink 는 status=conflict 이고 근거가 2개이며 각각 원장(sheet)과 HTML 을 가리킨다', () => {
    expect(link.status).toBe('conflict')
    expect(link.evidence).toHaveLength(2)
    const byId = new Map(anchors.map((a) => [a.id, a]))
    const kinds = link.evidence.map((e) => byId.get(e.anchor_id)?.locator.kind)
    expect(kinds.sort()).toEqual(['html', 'sheet'])
    expect(link.reason).toContain('정본 미확정')
    expect(link.element_or_action_id).toBeUndefined()
  })

  it('두 근거의 제목 표기가 다르고, 원장 anchor 는 SFR 행 308, HTML anchor 는 설계 문서가 인용한 경로다', () => {
    const sheet = single(anchors.filter((a) => a.locator.kind === 'sheet'), 'sheet anchor')
    const html = single(anchors.filter((a) => a.locator.kind === 'html'), 'html anchor')
    expect(sheet.locator).toEqual({ kind: 'sheet', sheet: 'SFR', row: 308 })
    expect(sheet.excerpt).toContain('관심 물품·공급업체 관리 기능 제공')
    expect(html.locator.kind === 'html' && html.locator.path).toBe('관리자포털/전시관리/몰관리/admin-display-contentManage.html')
    expect(html.excerpt).toContain('몰 통합 관리')
    expect(sheet.excerpt).not.toBe(html.excerpt)
  })

  it('RequirementRevision 은 status=conflict 이며 conflict_note 를 갖고, 어느 레코드도 승인·채택 상태가 아니다', () => {
    expect(revision.external_id).toBe('REQ-SFR-066-001')
    expect(revision.status).toBe('conflict')
    expect(revision.conflict_note).toBeTruthy()
    expect(revision.evidence).toHaveLength(2)
    expect(file.raw.canonical_source).toBe('unresolved')
    const statuses = file.records.map((r) => (r.data as { status?: string }).status).filter((s) => s !== undefined)
    expect(statuses).not.toContain('approved')
    expect(statuses).not.toContain('adopted')
  })

  it('충돌 상태의 수용조건은 검증 방식이 unspecified 다 (정본 확정 전 분해 보류)', () => {
    const criterion = single(recordsOf(file, 'AcceptanceCriterion', AcceptanceCriterion), 'AcceptanceCriterion')
    expect(criterion.verification_method).toBe('unspecified')
    expect(link.criterion_id).toBe(criterion.id)
    expect(link.requirement_revision_id).toBe(revision.id)
  })
})

describe('conflicts/req-sfr-038-001 — 화면 책임과 배치 책임의 분리', () => {
  const file = records('non-ui-split.req-sfr-038-001')
  const criteria = recordsOf(file, 'AcceptanceCriterion', AcceptanceCriterion)
  const links = recordsOf(file, 'TraceLink', TraceLink)
  const work = single(recordsOf(file, 'NonUIScreenWork', NonUIScreenWork), 'NonUIScreenWork')

  it('수용조건이 UI 2건(설정·조회)과 비UI 2건(배치 발행·기발행 제외)으로 나뉜다', () => {
    expect(criteria.map((c) => c.kind)).toEqual(['ui', 'ui', 'non_ui', 'non_ui'])
    expect(criteria.filter((c) => c.kind === 'non_ui').every((c) => c.verification_method === 'non_ui_evidence')).toBe(true)
    expect(criteria.filter((c) => c.kind === 'ui').every((c) => c.verification_method === 'ui_acceptance_test')).toBe(true)
  })

  it('NonUIScreenWork(batch) 가 비UI 수용조건만 연결하고, status=non_ui 매핑이 이를 가리킨다', () => {
    const nonUiIds = criteria.filter((c) => c.kind === 'non_ui').map((c) => c.id)
    expect(work.kind).toBe('batch')
    expect([...work.criterion_ids].sort()).toEqual([...nonUiIds].sort())
    const nonUiLinks = links.filter((l) => l.status === 'non_ui')
    expect(nonUiLinks.map((l) => l.criterion_id).sort()).toEqual([...nonUiIds].sort())
    expect(nonUiLinks.every((l) => l.non_ui_work_id === work.id && l.reason !== undefined)).toBe(true)
  })

  it('UI 수용조건 매핑은 candidate 로 남고 승인 매핑은 없다 — 화면 하나 생성만으로 완료 처리하지 않는다', () => {
    const uiIds = criteria.filter((c) => c.kind === 'ui').map((c) => c.id)
    const uiLinks = links.filter((l) => uiIds.includes(l.criterion_id))
    expect(uiLinks).toHaveLength(2)
    expect(uiLinks.every((l) => l.status === 'candidate')).toBe(true)
    expect(links.some((l) => l.status === 'approved')).toBe(false)
    const coverage = single(recordsOf(file, 'TraceCoverage', TraceCoverage), 'TraceCoverage')
    expect(coverage).toMatchObject({ criteria_in_scope: 4, approved_links: 0, tests_passed: 0, non_ui: 2 })
  })

  it('원장 anchor 는 SFR 행 183 이며 모든 수용조건이 이를 근거로 든다', () => {
    const anchor = single(recordsOf(file, 'SourceAnchor', SourceAnchor), 'SourceAnchor')
    expect(anchor.locator).toEqual({ kind: 'sheet', sheet: 'SFR', row: 183 })
    expect(criteria.every((c) => c.evidence.some((e) => e.anchor_id === anchor.id))).toBe(true)
    const revision = single(recordsOf(file, 'RequirementRevision', RequirementRevision), 'RequirementRevision')
    expect(revision.status).toBe('source_extracted_unapproved')
  })
})

// ---------- 레지스트리 ----------

interface IndexRow {
  screen_plan_id: string
  id: string
  href: string
  candidates?: { path: string; linked: boolean }[]
  status?: string
}

function indexRows(file: RecordsFile): IndexRow[] {
  const rows = file.raw.index_rows
  if (!Array.isArray(rows)) throw new Error('index_rows 사이드카가 없다')
  return rows as IndexRow[]
}

describe('registry/duplicate-id — 같은 외부 ID 의 INDEX 두 행은 임시 레코드로 분리한다', () => {
  const file = records('registry.duplicate-id')
  const plans = recordsOf(file, 'ScreenPlan', ScreenPlan)

  it('두 ScreenPlan 이 같은 external_id, 다른 path, 다른 내부 UUID 를 갖고 모두 duplicate_id 상태다', () => {
    expect(plans).toHaveLength(2)
    expect(new Set(plans.map((p) => p.external_id)).size).toBe(1)
    expect(new Set(plans.map((p) => p.path)).size).toBe(2)
    expect(new Set(plans.map((p) => p.id)).size).toBe(2)
    expect(plans.every((p) => p.registry_status === 'duplicate_id')).toBe(true)
    expect(plans.every((p) => p.aliases.length === 0)).toBe(true)
  })

  it('INDEX 행 사이드카가 각 레코드에 대응하고 해결 상태는 pending 이다', () => {
    const rows = indexRows(file)
    expect(rows.map((r) => r.screen_plan_id).sort()).toEqual(plans.map((p) => p.id).sort())
    expect(rows.map((r) => r.href).sort()).toEqual(plans.map((p) => p.path).sort())
    expect((file.raw.resolution as { status?: string }).status).toBe('pending')
  })
})

describe('registry/missing-path — 경로 미확인 행은 후보를 자동 연결하지 않는다', () => {
  const file = records('registry.missing-path')
  const plans = recordsOf(file, 'ScreenPlan', ScreenPlan)

  it('모든 ScreenPlan 이 path_resolution_required 이며 path 는 INDEX href 그대로다', () => {
    expect(plans.length).toBeGreaterThanOrEqual(1)
    expect(plans.every((p) => p.registry_status === 'path_resolution_required')).toBe(true)
    const hrefByPlan = new Map(indexRows(file).map((r) => [r.screen_plan_id, r.href]))
    for (const p of plans) expect(p.path).toBe(hrefByPlan.get(p.id))
  })

  it('_legacy 같은 파일명 후보가 있어도 linked=false 이고, 후보가 없는 행도 같은 상태로 남는다', () => {
    const rows = indexRows(file)
    const withCandidates = rows.filter((r) => (r.candidates ?? []).length > 0)
    const withoutCandidates = rows.filter((r) => (r.candidates ?? []).length === 0)
    expect(withCandidates.length).toBeGreaterThanOrEqual(1)
    expect(withoutCandidates.length).toBeGreaterThanOrEqual(1)
    expect(withCandidates.some((r) => (r.candidates ?? []).some((c) => c.path.includes('/_legacy/')))).toBe(true)
    expect(rows.every((r) => (r.candidates ?? []).every((c) => c.linked === false))).toBe(true)
    expect(rows.every((r) => r.status === 'path_resolution_required')).toBe(true)
  })
})

// ---------- 합성 데이터 ----------

describe('synthetic/orders — 더미데이터는 명세의 CASE 와 1:1 로 맞는다', () => {
  const data: DummyDataFile = parseDummyDataFile(document('synthetic.orders'))
  const valid = spec('screen-spec.valid')
  const byId = new Map(data.fixtures.map((f) => [f.fixture_id, f]))

  it('fixture_id 집합이 valid 명세 states[].fixture_id 와 양방향으로 일치한다', () => {
    const inSpec = valid.states.map((s) => s.fixture_id).sort()
    expect([...byId.keys()].sort()).toEqual(inSpec)
    expect(data.screen_id).toBe(valid.screen_id)
  })

  it('행의 키가 명세 표(order-table) 컬럼과 같다', () => {
    const table = valid.sections.flatMap((s) => s.elements).find((e) => e.id === data.table_element_id)
    if (table === undefined || table.columns === undefined) throw new Error('명세에 표 요소가 없다')
    expect(data.columns).toEqual(table.columns.map((c) => c.id))
  })

  it('orders-normal 3건, orders-searched 는 normal 을 검색어로 거른 1건, orders-empty 0건, orders-error 는 msg-error 참조', () => {
    const normal = byId.get('orders-normal')
    const searched = byId.get('orders-searched')
    const empty = byId.get('orders-empty')
    const error = byId.get('orders-error')
    if (!normal || !searched || !empty || !error) throw new Error('fixture 가 빠졌다')
    expect(normal.rows).toHaveLength(3)
    expect(normal.rows.map((r) => r.order_no)).toEqual(['EX-2026-0003', 'EX-2026-0002', 'EX-2026-0001'])

    const applyFilter = (f: typeof searched) => {
      const source = byId.get(f.derived_from ?? '')
      if (source === undefined || f.filter === undefined) throw new Error(`${f.fixture_id}: derived_from/filter 가 없다`)
      const { column, value } = f.filter
      return source.rows.filter((r) => String(r[column] ?? '').includes(value))
    }
    expect(applyFilter(searched)).toEqual(searched.rows)
    expect(searched.rows).toHaveLength(1)
    expect(applyFilter(empty)).toEqual([])
    expect(empty.rows).toEqual([])
    expect(searched.filter?.element_id).toBe('query')
    expect(valid.sections.flatMap((s) => s.elements).some((e) => e.id === 'query')).toBe(true)

    expect(error.rows).toEqual([])
    expect(error.error?.simulated).toBe(true)
    expect(valid.messages.map((m) => m.id)).toContain(error.error?.message_id)
    const errorState = valid.states.find((s) => s.fixture_id === 'orders-error')
    expect(errorState?.message_ids).toContain(error.error?.message_id)
  })

  it('CASE 종류가 명세의 case_kind 와 같다', () => {
    for (const s of valid.states) expect(byId.get(s.fixture_id)?.case_kind, s.fixture_id).toBe(s.case_kind)
  })
})

describe('synthetic/xlsx-import-config — SFR 시트 A열 ID 규칙', () => {
  const config = XlsxImportConfig.parse(document('synthetic.xlsx-import-config'))

  it('시트·ID 열이 설계 §4·보고서 §3 이 확인한 값이다', () => {
    expect(config.sheet).toBe('SFR')
    expect(config.id_column).toBe('A')
    expect(config.data_row_start).toBeGreaterThan(config.header_row)
  })

  it('id_pattern 은 REQ-SFR 형식만 받고 부모 RFP ID 등은 받지 않는다', () => {
    if (config.id_pattern === undefined) throw new Error('id_pattern 이 없다')
    const re = new RegExp(config.id_pattern)
    expect(re.test('REQ-SFR-066-001')).toBe(true)
    expect(re.test('REQ-SFR-038-001')).toBe(true)
    expect(re.test('RFP-001')).toBe(false)
    expect(re.test('REQ-SFR-066')).toBe(false)
  })
})

// ---------- 유출 방지 회귀 ----------

describe('유출 방지 — 공개 저장소에 S2B 요구사항 본문·내부 경로를 넣지 않는다', () => {
  const dataFiles = listFixtureFiles(['.json', '.md'])
  const contents = new Map(dataFiles.map((p) => [p, readFileSync(join(FIXTURES_DIR, p), 'utf8')]))
  /** 원장 문장의 머리 기호(U+274D). 원문 문장이 복사되면 함께 들어온다. */
  const LEDGER_BULLET = '\u274D'
  /** 원장 문장의 어미. 합성 문장은 '~한다' 체를 쓴다. */
  const LEDGER_ENDINGS = /(?:해야|되어야|어야|여야) ?함/

  it('검사 대상 파일이 있다', () => {
    expect(dataFiles.length).toBeGreaterThanOrEqual(12)
  })

  it('원장 문장 머리 기호와 원장 문장 어미가 없다', () => {
    for (const [path, text] of contents) {
      expect(text.includes(LEDGER_BULLET), `${path}: 원장 머리 기호`).toBe(false)
      expect(LEDGER_ENDINGS.test(text), `${path}: 원장 문장 어미`).toBe(false)
    }
  })

  it('REQ-SFR ID 는 설계·검토보고서가 인용한 두 건(066-001, 038-001)만 등장한다', () => {
    const allowed = new Set(['REQ-SFR-066-001', 'REQ-SFR-038-001'])
    for (const [path, text] of contents) {
      const found = [...new Set(text.match(/REQ-SFR-\d{3}-\d{3}/g) ?? [])]
      expect(found.filter((id) => !allowed.has(id)), path).toEqual([])
    }
  })

  it('.html 경로는 설계·검토보고서·작업 지시가 인용한 것과 합성(EXAMPLE) 경로만 등장한다', () => {
    const allowed = new Set([
      'index.html',
      'admin-display-contentManage.html',
      '관리자포털/전시관리/몰관리/admin-display-contentManage.html',
      '관리자포털/전시관리/몰관리/admin-display-contentManageCategoryMapping-cat.html',
      '관리자포털/전시관리/몰관리/admin-display-contentManageCategoryMapping.html',
    ])
    for (const [path, text] of contents) {
      const found = [...new Set(text.match(/[^\s"'`,()|]+\.html/g) ?? [])]
      expect(found.filter((p) => !allowed.has(p) && !p.includes('EXAMPLE')), path).toEqual([])
    }
  })

  it('요구사항 본문(body) 필드는 실제 원장 항목에서 자리표시 문구만 갖는다', () => {
    for (const id of ['conflict.req-sfr-066-001', 'non-ui-split.req-sfr-038-001']) {
      for (const rev of recordsOf(records(id), 'RequirementRevision', RequirementRevision)) {
        expect(rev.body, `${id} ${rev.external_id}`).toContain('공개 저장소 fixture 에 싣지 않는다')
      }
    }
  })
})
