/**
 * 인라인 JS 가 읽는 데이터 모델 — 명세에서 동작에 필요한 것만 추린다.
 * 동작의 대상 표·검색 입력은 여기서 미리 풀어 두어 클라이언트가 명세 구조를 다시 해석하지 않게 한다.
 */
import type { Action, ScreenSpecShape } from '@con-ai/schemas'
import type { RenderInput } from './types.js'

export const INPUT_TYPES = new Set<string>(['text-input', 'number-input', 'textarea', 'select', 'radio', 'checkbox', 'date-input', 'date-range'])

export interface ClientColumn {
  id: string
  label: string
  sortable: boolean
  downloadable: boolean
  format: string
}
export interface ClientTable {
  element_id: string
  section_id: string
  columns: ClientColumn[]
  default_sort?: { column_id: string; direction: 'asc' | 'desc' }
  /** 행 클릭으로 실행하는 동작 (open-popup / navigate) */
  row_action?: string
}
export interface ClientAction {
  id: string
  type: Action['type']
  label?: string
  trigger?: string
  target?: string
  target_screen_id?: string
  target_state_id?: string
  /** filter-fixture 가 읽는 입력 요소 id */
  inputs: string[]
  /** 동작이 다루는 표 요소 id */
  tables: string[]
}
export interface ClientState {
  id: string
  fixture_id: string
  expected: string
  case_kind: string
  message_ids: string[]
}
export interface ClientData {
  screen_id: string
  device: 'desktop' | 'mobile'
  initial_case: string
  states: ClientState[]
  messages: Array<{ id: string; kind: string; text: string }>
  tables: ClientTable[]
  actions: ClientAction[]
  dummy: Record<string, unknown[]>
}

interface Lookup {
  sectionOfElement: Map<string, string>
  tablesInSection: Map<string, string[]>
  tableIds: Set<string>
  inputsInSection: Map<string, string[]>
}

function lookupOf(spec: ScreenSpecShape): Lookup {
  const sectionOfElement = new Map<string, string>()
  const tablesInSection = new Map<string, string[]>()
  const inputsInSection = new Map<string, string[]>()
  const tableIds = new Set<string>()
  for (const s of spec.sections) {
    const tables: string[] = []
    const inputs: string[] = []
    for (const e of s.elements) {
      sectionOfElement.set(e.id, s.id)
      if (e.type === 'table') {
        tables.push(e.id)
        tableIds.add(e.id)
      }
      // 히어로의 통합검색도 검색 입력이다 (hero.search_placeholder 가 있을 때만 입력이 그려진다 — html.ts renderHero).
      if (INPUT_TYPES.has(e.type) || (e.type === 'hero' && e.hero?.search_placeholder !== undefined && e.hero.search_placeholder !== '')) inputs.push(e.id)
    }
    tablesInSection.set(s.id, tables)
    inputsInSection.set(s.id, inputs)
  }
  return { sectionOfElement, tablesInSection, tableIds, inputsInSection }
}

/** 동작 target 이 가리키는 표 목록. 표 요소 → 그 표, 영역 → 영역 안의 표, 다른 요소 → 같은 영역의 표, 없음 → 모든 표. */
export function tablesOfTarget(lookup: Lookup, target: string | undefined): string[] {
  if (target === undefined) return [...lookup.tableIds]
  if (lookup.tableIds.has(target)) return [target]
  const inSection = lookup.tablesInSection.get(target)
  if (inSection) return inSection
  const sectionId = lookup.sectionOfElement.get(target)
  if (sectionId !== undefined) return lookup.tablesInSection.get(sectionId) ?? []
  return []
}

function inputsOfAction(lookup: Lookup, a: Action, targetTables: string[]): string[] {
  if (a.trigger !== undefined) {
    const sectionId = lookup.sectionOfElement.get(a.trigger)
    if (sectionId !== undefined) {
      const own = lookup.inputsInSection.get(sectionId) ?? []
      if (own.length > 0) return own
    }
  }
  const tableSections = new Set(targetTables.map((t) => lookup.sectionOfElement.get(t)))
  const out: string[] = []
  for (const [sectionId, inputs] of lookup.inputsInSection) {
    if (tableSections.has(sectionId)) continue
    out.push(...inputs)
  }
  return out
}

export function buildClientData(input: RenderInput): ClientData {
  const { spec } = input
  const lookup = lookupOf(spec)

  const actions: ClientAction[] = spec.actions.map((a) => {
    const tables = tablesOfTarget(lookup, a.target)
    const out: ClientAction = { id: a.id, type: a.type, inputs: a.type === 'filter-fixture' ? inputsOfAction(lookup, a, tables) : [], tables }
    if (a.label !== undefined) out.label = a.label
    if (a.trigger !== undefined) out.trigger = a.trigger
    if (a.target !== undefined) out.target = a.target
    if (a.target_screen_id !== undefined) out.target_screen_id = a.target_screen_id
    if (a.target_state_id !== undefined) out.target_state_id = a.target_state_id
    return out
  })

  const tables: ClientTable[] = []
  for (const s of spec.sections) {
    for (const e of s.elements) {
      if (e.type !== 'table') continue
      const t: ClientTable = {
        element_id: e.id,
        section_id: s.id,
        columns: (e.columns ?? []).map((c) => ({ id: c.id, label: c.label, sortable: c.sortable === true, downloadable: c.downloadable !== false, format: c.format ?? 'text' })),
      }
      if (e.default_sort) t.default_sort = { column_id: e.default_sort.column_id, direction: e.default_sort.direction }
      const rowAction = spec.actions.find((a) => (a.type === 'open-popup' || a.type === 'navigate') && a.trigger === undefined && (a.target === e.id || a.target === s.id))
      if (rowAction) t.row_action = rowAction.id
      tables.push(t)
    }
  }

  const states: ClientState[] = spec.states.map((s) => ({ id: s.id, fixture_id: s.fixture_id, expected: s.expected, case_kind: s.case_kind ?? 'normal', message_ids: s.message_ids ?? [] }))
  const initial = spec.states.find((s) => s.case_kind === undefined || s.case_kind === 'normal') ?? spec.states[0]

  const dummy: Record<string, unknown[]> = {}
  for (const s of spec.states) {
    const rows = input.dummy[s.fixture_id]
    if (Array.isArray(rows)) dummy[s.fixture_id] = rows
  }

  return {
    screen_id: spec.screen_id,
    device: spec.device,
    initial_case: initial?.id ?? '',
    states,
    messages: spec.messages.map((m) => ({ id: m.id, kind: m.kind, text: m.text })),
    tables,
    actions,
    dummy,
  }
}

/** JSON 을 <script type="application/json"> 안에 안전하게 넣는다 (</script>·주석 시작·줄 구분자 이스케이프). */
export function toInlineJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}
