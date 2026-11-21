/**
 * fixtures manifest 로더와 fixture 파일 형태 검사 — fixtures.test.ts 와 이후 validators 가 함께 쓴다.
 *
 * 루트 devDependencies 에는 zod 가 없어(워크스페이스 패키지 의존성) 여기서는 수동 형태 검사만 한다.
 * 스키마 파싱 자체는 @con-ai/schemas 가 내보낸 zod 객체의 safeParse 로 한다.
 *
 * 파일 형식
 * - manifest.json: { manifest_version, note, current_baseline_id, required_case_kinds, fixtures[] }
 * - layout=document: 파일 전체가 스키마 하나의 문서 (예: ScreenSpec)
 * - layout=records: { fixture_id, note, records: [{ schema, data }], ...사이드카 } 봉투
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ValidationStage } from '@con-ai/schemas'

export const FIXTURES_DIR = dirname(fileURLToPath(import.meta.url))
export const MANIFEST_PATH = 'manifest.json'

export const FIXTURE_KINDS = [
  'screen_spec',
  'requirements',
  'conflict',
  'non_ui_split',
  'registry_duplicate_id',
  'registry_missing_path',
  'dummy_data',
  'xlsx_import_config',
] as const
export type FixtureKind = (typeof FIXTURE_KINDS)[number]

export const FIXTURE_LAYOUTS = ['document', 'records'] as const
export type FixtureLayout = (typeof FIXTURE_LAYOUTS)[number]

/** manifest 의 기대 결과는 pass/fail 두 값만 쓴다 (error/not_run 은 실행 결과이지 fixture 의 기대가 아니다). */
export const EXPECTED_OUTCOMES = ['pass', 'fail'] as const
export type ExpectedOutcome = (typeof EXPECTED_OUTCOMES)[number]

export interface FixtureExpectation {
  /** 스키마 파싱 기대 */
  parse: ExpectedOutcome
  /** parse=fail 일 때 실패해야 하는 issue 경로 ('a.0.b' 형태) */
  fail_paths?: string[]
  /** 판정을 내는 검증 단계 (설계 §10) */
  stage: ValidationStage
  status: ExpectedOutcome
  /** 사람이 읽는 판정 이름 (예: 검토 필요) */
  verdict?: string
  reason: string
  /** states 에 없어야 하는 필수 CASE 종류 (missing-case) */
  missing_case_kinds?: string[]
  /** 요소·동작 trace 에 연결되지 않은 수용조건 (missing-case) */
  unlinked_criterion_ids?: string[]
}

export interface FixtureEntry {
  id: string
  /** fixtures/ 기준 상대 경로 */
  path: string
  kind: FixtureKind
  layout: FixtureLayout
  /** layout=document 일 때 파싱할 스키마 이름 */
  schema?: string
  expected: FixtureExpectation
  /** 출처 절 */
  source: string[]
}

export interface FixtureManifest {
  manifest_version: '1'
  note: string
  current_baseline_id: string
  required_case_kinds: string[]
  fixtures: FixtureEntry[]
}

export interface FixtureRecord {
  schema: string
  data: unknown
}

export interface RecordsFile {
  fixture_id: string
  note: string
  records: FixtureRecord[]
  /** 봉투 전체 (index_rows, resolution 등 사이드카 접근용) */
  raw: Record<string, unknown>
}

/** 더미데이터 파일 (설계 §9 fixture; @con-ai/schemas README "fixture 스키마와 존재 검사는 fixtures/ 에서"). */
export type DummyCell = string | number | boolean | null
export interface DummyRow {
  [column: string]: DummyCell
}
export interface DummyFilter {
  element_id: string
  column: string
  value: string
}
export interface DummyFixture {
  fixture_id: string
  case_kind: string
  rows: DummyRow[]
  derived_from?: string
  filter?: DummyFilter
  error?: { message_id: string; simulated: boolean }
}
export interface DummyDataFile {
  fixture_file_version: '1'
  note: string
  screen_id: string
  table_element_id: string
  columns: string[]
  fixtures: DummyFixture[]
}

export class FixtureShapeError extends Error {
  constructor(path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'FixtureShapeError'
  }
}

function fail(path: string, message: string): never {
  throw new FixtureShapeError(path, message)
}

function asObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, '객체여야 한다')
  return value as Record<string, unknown>
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, '배열이어야 한다')
  return value
}

function asText(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(path, '비어 있지 않은 문자열이어야 한다')
  return value
}

function asTextArray(value: unknown, path: string): string[] {
  return asArray(value, path).map((item, i) => asText(item, `${path}[${i}]`))
}

function asBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'boolean 이어야 한다')
  return value
}

function asOneOf<const T extends readonly string[]>(value: unknown, options: T, path: string): T[number] {
  if (typeof value !== 'string' || !options.includes(value)) fail(path, `허용 값: ${options.join(', ')}`)
  return value
}

function asStage(value: unknown, path: string): ValidationStage {
  const r = ValidationStage.safeParse(value)
  if (!r.success) fail(path, 'V0~V7 중 하나여야 한다 (설계 §10)')
  return r.data
}

function parseExpectation(value: unknown, path: string): FixtureExpectation {
  const o = asObject(value, path)
  const expectation: FixtureExpectation = {
    parse: asOneOf(o.parse, EXPECTED_OUTCOMES, `${path}.parse`),
    stage: asStage(o.stage, `${path}.stage`),
    status: asOneOf(o.status, EXPECTED_OUTCOMES, `${path}.status`),
    reason: asText(o.reason, `${path}.reason`),
  }
  if (o.fail_paths !== undefined) expectation.fail_paths = asTextArray(o.fail_paths, `${path}.fail_paths`)
  if (o.verdict !== undefined) expectation.verdict = asText(o.verdict, `${path}.verdict`)
  if (o.missing_case_kinds !== undefined) expectation.missing_case_kinds = asTextArray(o.missing_case_kinds, `${path}.missing_case_kinds`)
  if (o.unlinked_criterion_ids !== undefined) expectation.unlinked_criterion_ids = asTextArray(o.unlinked_criterion_ids, `${path}.unlinked_criterion_ids`)
  if (expectation.parse === 'fail' && expectation.fail_paths === undefined) fail(`${path}.fail_paths`, 'parse=fail 이면 실패 경로를 적어야 한다')
  if (expectation.parse === 'pass' && expectation.fail_paths !== undefined) fail(`${path}.fail_paths`, 'parse=pass 에는 실패 경로를 쓰지 않는다')
  return expectation
}

function parseEntry(value: unknown, path: string): FixtureEntry {
  const o = asObject(value, path)
  const entry: FixtureEntry = {
    id: asText(o.id, `${path}.id`),
    path: asText(o.path, `${path}.path`),
    kind: asOneOf(o.kind, FIXTURE_KINDS, `${path}.kind`),
    layout: asOneOf(o.layout, FIXTURE_LAYOUTS, `${path}.layout`),
    expected: parseExpectation(o.expected, `${path}.expected`),
    source: asTextArray(o.source, `${path}.source`),
  }
  if (o.schema !== undefined) entry.schema = asText(o.schema, `${path}.schema`)
  if (entry.layout === 'document' && entry.schema === undefined) fail(`${path}.schema`, 'layout=document 에는 schema 이름이 필요하다')
  if (entry.layout === 'records' && entry.schema !== undefined) fail(`${path}.schema`, 'layout=records 는 records[].schema 를 쓴다')
  if (entry.source.length === 0) fail(`${path}.source`, '출처 절을 최소 1개 적는다')
  return entry
}

export function parseManifest(value: unknown): FixtureManifest {
  const o = asObject(value, 'manifest')
  return {
    manifest_version: asOneOf(o.manifest_version, ['1'] as const, 'manifest.manifest_version'),
    note: asText(o.note, 'manifest.note'),
    current_baseline_id: asText(o.current_baseline_id, 'manifest.current_baseline_id'),
    required_case_kinds: asTextArray(o.required_case_kinds, 'manifest.required_case_kinds'),
    fixtures: asArray(o.fixtures, 'manifest.fixtures').map((entry, i) => parseEntry(entry, `manifest.fixtures[${i}]`)),
  }
}

export function parseRecordsFile(value: unknown): RecordsFile {
  const o = asObject(value, 'records-file')
  const records = asArray(o.records, 'records-file.records').map((item, i): FixtureRecord => {
    const r = asObject(item, `records-file.records[${i}]`)
    if (!('data' in r)) fail(`records-file.records[${i}].data`, 'data 가 필요하다')
    return { schema: asText(r.schema, `records-file.records[${i}].schema`), data: r.data }
  })
  if (records.length === 0) fail('records-file.records', '레코드가 최소 1개 필요하다')
  return {
    fixture_id: asText(o.fixture_id, 'records-file.fixture_id'),
    note: asText(o.note, 'records-file.note'),
    records,
    raw: o,
  }
}

function asDummyRow(value: unknown, path: string): DummyRow {
  const o = asObject(value, path)
  const row: DummyRow = {}
  for (const [key, cell] of Object.entries(o)) {
    if (cell !== null && typeof cell !== 'string' && typeof cell !== 'number' && typeof cell !== 'boolean') {
      fail(`${path}.${key}`, '셀 값은 문자열·숫자·boolean·null 만 허용한다')
    }
    row[key] = cell as DummyCell
  }
  return row
}

export function parseDummyDataFile(value: unknown): DummyDataFile {
  const o = asObject(value, 'dummy-data')
  const columns = asTextArray(o.columns, 'dummy-data.columns')
  if (new Set(columns).size !== columns.length) fail('dummy-data.columns', '컬럼 이름이 중복된다')
  const fixtures = asArray(o.fixtures, 'dummy-data.fixtures').map((item, i): DummyFixture => {
    const path = `dummy-data.fixtures[${i}]`
    const f = asObject(item, path)
    const fixture: DummyFixture = {
      fixture_id: asText(f.fixture_id, `${path}.fixture_id`),
      case_kind: asText(f.case_kind, `${path}.case_kind`),
      rows: asArray(f.rows, `${path}.rows`).map((row, j) => asDummyRow(row, `${path}.rows[${j}]`)),
    }
    fixture.rows.forEach((row, j) => {
      const keys = Object.keys(row).sort()
      const expected = [...columns].sort()
      if (keys.join('|') !== expected.join('|')) fail(`${path}.rows[${j}]`, `행의 키(${keys.join(',')})가 columns(${expected.join(',')})와 다르다`)
    })
    if (f.derived_from !== undefined) fixture.derived_from = asText(f.derived_from, `${path}.derived_from`)
    if (f.filter !== undefined) {
      const flt = asObject(f.filter, `${path}.filter`)
      fixture.filter = {
        element_id: asText(flt.element_id, `${path}.filter.element_id`),
        column: asText(flt.column, `${path}.filter.column`),
        value: asText(flt.value, `${path}.filter.value`),
      }
      if (!columns.includes(fixture.filter.column)) fail(`${path}.filter.column`, 'columns 에 없는 컬럼이다')
      if (fixture.derived_from === undefined) fail(`${path}.derived_from`, 'filter 가 있으면 어느 fixture 를 거른 것인지 적는다')
    }
    if (f.error !== undefined) {
      const err = asObject(f.error, `${path}.error`)
      fixture.error = { message_id: asText(err.message_id, `${path}.error.message_id`), simulated: asBoolean(err.simulated, `${path}.error.simulated`) }
      if (fixture.rows.length !== 0) fail(`${path}.rows`, '오류 fixture 는 행을 갖지 않는다')
    }
    return fixture
  })
  const ids = fixtures.map((f) => f.fixture_id)
  if (new Set(ids).size !== ids.length) fail('dummy-data.fixtures', 'fixture_id 가 중복된다')
  for (const f of fixtures) {
    if (f.derived_from !== undefined && !ids.includes(f.derived_from)) fail('dummy-data.fixtures', `derived_from 이 가리키는 fixture 가 없다: ${f.derived_from}`)
  }
  return {
    fixture_file_version: asOneOf(o.fixture_file_version, ['1'] as const, 'dummy-data.fixture_file_version'),
    note: asText(o.note, 'dummy-data.note'),
    screen_id: asText(o.screen_id, 'dummy-data.screen_id'),
    table_element_id: asText(o.table_element_id, 'dummy-data.table_element_id'),
    columns,
    fixtures,
  }
}

/** fixtures/ 기준 상대 경로의 JSON 을 읽는다. */
export function readFixtureJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, relativePath), 'utf8')) as unknown
}

export function loadManifest(): FixtureManifest {
  return parseManifest(readFixtureJson(MANIFEST_PATH))
}

/** fixtures/ 아래의 파일을 확장자로 골라 상대 경로(posix, 정렬)로 돌려준다. node_modules 는 제외. */
export function listFixtureFiles(extensions: readonly string[]): string[] {
  const found: string[] = []
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules') continue
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (extensions.includes(extname(name))) found.push(relative(FIXTURES_DIR, full).split('\\').join('/'))
    }
  }
  walk(FIXTURES_DIR)
  return found.sort()
}
