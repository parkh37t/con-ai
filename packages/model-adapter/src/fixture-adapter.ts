/**
 * FixtureAdapter — 네트워크 없이 결정적으로 명세를 만드는 더미 어댑터 (세로 조각 계약 §3).
 *
 * - generateSpec: 참고 spec(ctx.references[0].spec)이 ScreenSpecShape 로 파싱되면 복제해 screen_id/purpose/requirements/states/messages 를
 *   요청에 맞게 바꾸고, 없으면 목록 화면 기본 템플릿(검색 영역 + 표 + 버튼)을 만든다. 수용조건은 요소·동작 trace 에 순서대로 배분한다.
 *   CASE 마다 fixture_id `<screen>-<case>` 를 만든다. 참고 spec 의 data_mapping 은 근거 anchor 가 이 문맥에 없으므로 비우고 unresolved 로 남긴다.
 * - reviseSpec: 코멘트 문장에 단순 규칙("필수" → required, "라벨/이름을 X로" → label, "메시지/문구" → messages, "삭제/제거" → 요소 제거)을
 *   적용하고 나머지는 unresolved 질문으로 남긴다. 잠긴 요소는 바꾸지 않고 unresolved(conflict)에 기록한다. change_summary 에 변경 목록을 적는다.
 * - draftRevisionPrompt: 코멘트를 역할·요소·CASE 별로 묶어 한국어 수정 지시문과 rationale 을 만든다.
 * - draftPainPoints: AS-IS structure(계약 §12)에 규칙을 적용해 페인포인트 초안을 만든다 (레이블 없는 필드 → high,
 *   alt 없는 이미지·h1 없음/중복·내비 링크 과다·모호한 버튼 문구 → medium, caption 미확인 표·iframe·description 없음 → low).
 *
 * 화면에는 "더미 어댑터" 로 표시된다 (CLAUDE.md: 더미 동작과 실제 호출을 구분). 시각·난수를 쓰지 않는다.
 */
import { ScreenSpecShape } from '@con-ai/schemas'
import type { GenerationContext, SliceCase, SliceGenerationRequest } from '@con-ai/prompt-templates'
import type { AdapterResult, AsisStructure, ModelAdapter, PainPointDraft, PainPointDraftResult } from './types.js'
import type { WireOutput, WireScreenSpec } from './wire-schema.js'

export const FIXTURE_MODEL = 'fixture' as const

type Comment = NonNullable<GenerationContext['comments']>[number]
type WireSection = WireScreenSpec['sections'][number]
type WireElement = WireSection['elements'][number]
type WireState = WireScreenSpec['states'][number]
type WireMessage = WireScreenSpec['messages'][number]
type WireUnresolved = WireScreenSpec['unresolved'][number]

const CASE_ORDER: SliceCase[] = ['normal', 'empty', 'error', 'permission', 'processing']

const CASE_EXPECTED: Record<SliceCase, string> = {
  normal: '더미데이터 행이 기본 정렬로 표시된다',
  empty: '조회 결과 없음 안내가 표시되고 표는 비어 있다',
  error: '조회 오류 메시지가 표시되고 표는 비어 있다',
  permission: '권한 없음 안내가 표시되고 목록·버튼은 숨긴다',
  processing: '처리 중 안내가 표시되고 입력·버튼은 비활성화된다',
}

const CASE_MESSAGE: Record<Exclude<SliceCase, 'normal'>, { kind: WireMessage['kind']; text: string; when: string }> = {
  empty: { kind: 'info', text: '조회 결과가 없습니다.', when: '검색 결과 0건' },
  error: { kind: 'error', text: '목록을 불러오지 못했습니다. 잠시 후 다시 시도하세요.', when: '조회 오류' },
  permission: { kind: 'warning', text: '이 화면을 볼 권한이 없습니다.', when: '권한 없는 역할' },
  processing: { kind: 'info', text: '처리 중입니다. 잠시만 기다리세요.', when: '요청 처리 중' },
}

const ROLE_LABEL: Record<string, string> = { planner: '기획자', designer: '디자이너', publisher: '퍼블리셔', developer: '개발자', client: '고객' }

/** 클릭해도 무엇이 일어나는지 알 수 없는 모호한 버튼 문구 (계약 §12 fixture 규칙). */
export const AMBIGUOUS_BUTTON_WORDS = ['클릭', '여기', '확인', '바로가기'] as const

/** 내비 링크가 이 수를 넘으면 과다로 본다 (계약 §12 fixture 규칙: nav_links > 15). */
export const NAV_LINKS_LIMIT = 15

const SEVERITY_RANK: Record<PainPointDraft['severity'], number> = { high: 0, medium: 1, low: 2 }
const SEVERITY_LABEL: Record<PainPointDraft['severity'], string> = { high: '심각', medium: '보통', low: '낮음' }

const TASK_LABEL: Record<SliceGenerationRequest['task_type'], string> = { create: '신규', edit: '수정', clone_reference: '참조 복제' }

function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role
}

/** 목록 화면 기본 템플릿 — 검색 영역 + 표 + 버튼. 참고 spec 이 없을 때 쓴다. */
function listTemplate(name: string): Pick<WireScreenSpec, 'sections' | 'actions'> {
  return {
    sections: [
      {
        id: 'search',
        title: '검색',
        display_no: '1',
        elements: [
          { id: 'query', type: 'text-input', label: '검색어', required: false, display_no: 'a', placeholder: '검색어 입력', max_length: 50 },
          { id: 'period', type: 'date-range', label: '기간', display_no: 'b' },
          { id: 'search-button', type: 'button', label: '검색', display_no: 'c' },
        ],
      },
      {
        id: 'results',
        title: `${name} 목록`,
        display_no: '2',
        elements: [
          {
            id: 'result-table',
            type: 'table',
            label: `${name} 표`,
            display_no: 'a',
            columns: [
              { id: 'no', label: '번호', sortable: true },
              { id: 'title', label: '제목', sortable: true },
              { id: 'status', label: '상태', format: 'status' },
              { id: 'created_at', label: '등록일', sortable: true, format: 'date' },
            ],
            default_sort: { column_id: 'created_at', direction: 'desc' },
          },
          { id: 'download-button', type: 'button', label: '엑셀 다운로드', display_no: 'b' },
          { id: 'pager', type: 'pagination', label: '페이지', display_no: 'c' },
        ],
      },
    ],
    actions: [
      { id: 'search-submit', type: 'filter-fixture', label: '검색', trigger: 'search-button', target: 'results' },
      { id: 'sort-results', type: 'sort-fixture', label: '정렬', target: 'result-table' },
      { id: 'download-results', type: 'download-fixture', label: '다운로드', trigger: 'download-button', target: 'result-table' },
    ],
  }
}

/** 목적 문장에서 화면명을 뽑는다 (create 용). 화면 제목이 있으면 그것을 우선한다. */
export function deriveScreenName(purpose: string, title: string): string {
  const t = title.trim()
  if (t.length > 0) return t
  const head = purpose.split(/[—:(\n]/)[0] ?? purpose
  const cleaned = head.replace(/\s*(화면|페이지)?\s*(을|를)?\s*(만든다|작성한다|생성한다|만들어라|만들어|구성한다)\.?$/u, '').trim()
  return cleaned.length > 0 ? cleaned : '목록'
}

/** 참고·기준 spec 을 구조 스키마로 읽는다 (참조 무결성은 보지 않는다). */
function readShape(spec: unknown): ScreenSpecShape | undefined {
  const r = ScreenSpecShape.safeParse(spec)
  return r.success ? r.data : undefined
}

function shapeToWire(shape: ScreenSpecShape): WireScreenSpec {
  return structuredClone(shape) as WireScreenSpec
}

function selectedCriteria(ctx: GenerationContext, req: SliceGenerationRequest): { requirements: WireScreenSpec['requirements']; ui: Array<{ requirement_id: string; criterion_id: string; text: string }>; non_ui: Array<{ requirement_id: string; criterion_id: string; text: string }> } {
  const wanted = new Set(req.criterion_ids)
  const requirements: WireScreenSpec['requirements'] = []
  const ui: Array<{ requirement_id: string; criterion_id: string; text: string }> = []
  const non_ui: Array<{ requirement_id: string; criterion_id: string; text: string }> = []
  for (const r of ctx.requirements) {
    const picked = r.criteria.filter((c) => wanted.size === 0 || wanted.has(c.id))
    const uiIds: string[] = []
    for (const c of picked) {
      if (c.kind === 'ui') {
        uiIds.push(c.id)
        ui.push({ requirement_id: r.external_id, criterion_id: c.id, text: c.text })
      } else non_ui.push({ requirement_id: r.external_id, criterion_id: c.id, text: c.text })
    }
    if (uiIds.length > 0) requirements.push({ id: r.external_id, criterion_ids: uiIds })
  }
  return { requirements, ui, non_ui }
}

/** trace 를 받을 수 있는 대상: 입력·표·버튼 요소와 동작 (text/link/pagination 은 뒤로). */
function traceTargets(spec: WireScreenSpec): Array<{ id: string; kind: 'element' | 'action'; label: string }> {
  const primary: Array<{ id: string; kind: 'element' | 'action'; label: string }> = []
  const secondary: Array<{ id: string; kind: 'element' | 'action'; label: string }> = []
  for (const s of spec.sections) {
    for (const e of s.elements) {
      const entry = { id: e.id, kind: 'element' as const, label: e.label }
      if (e.type === 'text' || e.type === 'link' || e.type === 'pagination') secondary.push(entry)
      else primary.push(entry)
    }
  }
  for (const a of spec.actions) primary.push({ id: a.id, kind: 'action', label: a.label ?? a.id })
  return [...primary, ...secondary]
}

function findElement(spec: WireScreenSpec, id: string): { section: WireSection; element: WireElement; index: number } | undefined {
  for (const section of spec.sections) {
    const index = section.elements.findIndex((e) => e.id === id)
    const element = section.elements[index]
    if (index >= 0 && element !== undefined) return { section, element, index }
  }
  return undefined
}

function isLocked(spec: WireScreenSpec, id: string): boolean {
  if (spec.locked_elements.includes(id)) return true
  const found = findElement(spec, id)
  return found?.element.locked === true
}

function uniqueMessageId(spec: WireScreenSpec, base: string): string {
  const ids = new Set(spec.messages.map((m) => m.id))
  if (!ids.has(base)) return base
  let n = 2
  while (ids.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

/** CASE 목록을 요청에 맞춰 다시 만든다 (fixture_id `<screen>-<case>`). 메시지는 없으면 추가하고 있으면 재사용한다. */
function rebuildStates(spec: WireScreenSpec, screenId: string, cases: SliceCase[], roles: string[]): void {
  const kinds = CASE_ORDER.filter((k) => cases.includes(k))
  if (!kinds.includes('normal')) kinds.unshift('normal')
  const states: WireState[] = []
  for (const kind of kinds) {
    const state: WireState = { id: kind, fixture_id: `${screenId}-${kind}`, expected: CASE_EXPECTED[kind], case_kind: kind }
    if (kind !== 'normal') {
      const wanted = CASE_MESSAGE[kind]
      const existing = spec.messages.find((m) => m.id === `msg-${kind}`)
      if (existing === undefined) spec.messages.push({ id: `msg-${kind}`, kind: wanted.kind, text: wanted.text, when: wanted.when })
      state.message_ids = [`msg-${kind}`]
    }
    if (kind === 'permission' && roles[0] !== undefined) state.role = roles[0]
    states.push(state)
  }
  spec.states = states
  // 기존 set-state 동작은 CASE 가 바뀌었으므로 버리고 새로 만든다.
  spec.actions = spec.actions.filter((a) => a.type !== 'set-state')
  for (const kind of kinds) {
    if (kind === 'normal') continue
    spec.actions.push({ id: `show-${kind}`, type: 'set-state', label: `${kind} CASE 전환`, target_state_id: kind })
  }
  spec.locked_actions = spec.locked_actions.filter((id) => spec.actions.some((a) => a.id === id))
}

function allIds(spec: WireScreenSpec): string[] {
  return [...spec.sections.flatMap((s) => [s.id, ...s.elements.map((e) => e.id)]), ...spec.actions.map((a) => a.id), ...spec.states.map((s) => s.id)]
}

export class FixtureAdapter implements ModelAdapter {
  readonly kind = 'fixture' as const
  readonly model = FIXTURE_MODEL
  readonly auth = 'none' as const

  async generateSpec(input: { prompt: unknown; ctx: GenerationContext; req: SliceGenerationRequest }): Promise<AdapterResult> {
    const { ctx, req } = input
    const screenId = ctx.screen.external_id
    const name = deriveScreenName(req.purpose, ctx.screen.title)
    const unresolved: WireUnresolved[] = []

    // 바탕이 될 명세: edit 면 기준 명세, 아니면 참고 spec, 둘 다 없으면 기본 템플릿.
    const baseShape = req.task_type === 'edit' ? readShape(ctx.base_spec) ?? readShape(ctx.references[0]?.spec) : readShape(ctx.references[0]?.spec)
    let spec: WireScreenSpec
    let source: string
    if (baseShape !== undefined) {
      spec = shapeToWire(baseShape)
      source = req.task_type === 'edit' && readShape(ctx.base_spec) !== undefined ? '기준 명세' : `참고 명세 ${ctx.references[0]?.id ?? ''}`.trim()
      if (spec.data_mapping.length > 0) {
        unresolved.push({ kind: 'missing_evidence', text: `${source}의 데이터 매핑 근거(anchor)가 이 문맥에 없어 data_mapping 을 비웠다. 근거를 확인해 다시 연결해야 한다`, related_ids: spec.data_mapping.map((d) => d.element_id) })
        spec.data_mapping = []
      }
      // 참고 명세의 trace 는 다른 요구사항 체계이므로 지운다.
      for (const s of spec.sections) for (const e of s.elements) delete e.trace
      for (const a of spec.actions) delete a.trace
      spec.unresolved = []
    } else {
      spec = { schema_version: '1.0', screen_id: screenId, baseline_id: ctx.baseline_id, purpose: req.purpose, shell: ctx.screen.shell, device: req.device, requirements: [], ...listTemplate(name), states: [], messages: [], data_mapping: [], locked_elements: [], locked_actions: [], unresolved: [] }
      source = '기본 목록 템플릿'
    }

    spec.screen_id = screenId
    spec.baseline_id = ctx.baseline_id
    spec.purpose = req.task_type === 'create' ? `${name} — ${req.purpose}` : req.purpose
    spec.shell = ctx.screen.shell
    spec.device = req.device
    spec.roles = [...req.roles]

    const { requirements, ui, non_ui } = selectedCriteria(ctx, req)
    spec.requirements = requirements
    const targets = traceTargets(spec)
    const trace_proposals: WireOutput['trace_proposals'] = []
    ui.forEach((c, i) => {
      const target = targets[i % targets.length]
      if (target === undefined) return
      if (target.kind === 'element') {
        const found = findElement(spec, target.id)
        if (found !== undefined) found.element.trace = [...(found.element.trace ?? []), c.criterion_id]
      } else {
        const action = spec.actions.find((a) => a.id === target.id)
        if (action !== undefined) action.trace = [...(action.trace ?? []), c.criterion_id]
      }
      trace_proposals.push({ requirement_id: c.requirement_id, criterion_id: c.criterion_id, element_or_action_id: target.id, rationale: `더미 어댑터: 수용조건 "${c.text}" 을(를) ${target.kind === 'element' ? '요소' : '동작'} ${target.id}(${target.label}) 에 순서대로 배분`, confidence: 0.2 })
    })
    for (const c of non_ui) unresolved.push({ kind: 'question', text: `${c.criterion_id} 는 비UI 조건("${c.text}")이라 화면 요소에 연결하지 않았다. 별도 비UI 작업으로 관리하는지 확인 필요`, related_ids: [c.requirement_id, c.criterion_id] })
    if (ui.length === 0) unresolved.push({ kind: 'missing_evidence', text: '연결된 UI 수용조건이 없어 요소 trace 를 만들지 못했다. 기준 구역의 요구사항·수용조건을 확인해야 한다' })

    rebuildStates(spec, screenId, req.cases, req.roles)
    spec.unresolved = [...spec.unresolved, ...unresolved]

    const output: WireOutput = {
      screen_spec: spec,
      trace_proposals,
      unresolved,
      change_summary: { summary: `[더미 어댑터] ${TASK_LABEL[req.task_type]}: ${source}에서 ${screenId} 명세를 만들고 CASE ${spec.states.map((s) => s.id).join('/')} 와 수용조건 ${ui.length}건 trace 를 배분했다`, added_ids: allIds(spec), changed_ids: [], removed_ids: [], locked_violations: [] },
    }
    return { output, raw_text: JSON.stringify(output), usage: { input_tokens: 0, output_tokens: 0 }, stop_reason: 'fixture' }
  }

  async reviseSpec(input: { prompt: unknown; ctx: GenerationContext; req: SliceGenerationRequest; current: ScreenSpecShape }): Promise<AdapterResult> {
    const { ctx, req, current } = input
    const spec = shapeToWire(current)
    const wanted = req.comment_ids === undefined ? undefined : new Set(req.comment_ids)
    const comments = (ctx.comments ?? []).filter((c) => wanted === undefined || wanted.has(c.id))
    const changes: string[] = []
    const added = new Set<string>()
    const changed = new Set<string>()
    const removed = new Set<string>()
    const unresolved: WireUnresolved[] = []
    const question = (c: Comment, why: string) => unresolved.push({ kind: 'question', text: `코멘트 ${c.id} (${roleLabel(c.role)} ${c.author}): "${c.text}" — ${why}`, related_ids: [c.element_id, c.case_id].filter((x): x is string => x !== undefined) })

    for (const c of comments) {
      const text = c.text
      const target = c.element_id === undefined ? undefined : findElement(spec, c.element_id)
      if (c.element_id !== undefined && isLocked(spec, c.element_id)) {
        unresolved.push({ kind: 'conflict', text: `코멘트 ${c.id} (${roleLabel(c.role)} ${c.author}) 가 잠긴 요소 ${c.element_id} 를 가리킨다: "${text}". 잠긴 요소는 바꾸지 않았다 (설계 §12)`, related_ids: [c.element_id] })
        continue
      }
      if (/필수/.test(text)) {
        if (target === undefined) { question(c, '필수 표시를 바꿀 요소가 지정되지 않았다'); continue }
        const off = /(필수\s*(아님|아니|해제|제거|삭제|취소)|선택\s*(입력|항목))/.test(text)
        target.element.required = !off
        changed.add(target.element.id)
        changes.push(`${target.element.id}: required=${String(!off)} (코멘트 ${c.id})`)
        continue
      }
      const label = /(?:라벨|레이블|이름|명칭|제목)\s*(?:을|를|은|는)?\s*["'“‘]?([^"'”’]+?)["'”’]?\s*(?:으로|로)\s*(?:바꿔|바꾸|변경|수정|해|고쳐|교체)/.exec(text)
      if (label !== null && label[1] !== undefined) {
        if (target === undefined) { question(c, '라벨을 바꿀 요소가 지정되지 않았다'); continue }
        const next = label[1].trim()
        changes.push(`${target.element.id}: label "${target.element.label}" → "${next}" (코멘트 ${c.id})`)
        target.element.label = next
        changed.add(target.element.id)
        continue
      }
      if (/(메시지|문구|안내문|안내 문구)/.test(text)) {
        const quoted = /["“‘']([^"”’']+)["”’']/.exec(text)?.[1]?.trim()
        if (quoted === undefined) { question(c, '바꿀 메시지 문구를 따옴표로 지정하지 않았다'); continue }
        const state = c.case_id === undefined ? undefined : spec.states.find((s) => s.id === c.case_id)
        const existingId = state?.message_ids?.[0] ?? target?.element.validations?.find((v) => v.message_id !== undefined)?.message_id
        const existing = existingId === undefined ? undefined : spec.messages.find((m) => m.id === existingId)
        if (existing !== undefined) {
          changes.push(`${existing.id}: text "${existing.text}" → "${quoted}" (코멘트 ${c.id})`)
          existing.text = quoted
          changed.add(existing.id)
        } else {
          const id = uniqueMessageId(spec, `msg-${c.case_id ?? c.element_id ?? c.id}`)
          spec.messages.push({ id, kind: 'info', text: quoted, when: state !== undefined ? `CASE ${state.id}` : target !== undefined ? `${target.element.label} 관련` : `코멘트 ${c.id}` })
          if (state !== undefined) state.message_ids = [...(state.message_ids ?? []), id]
          added.add(id)
          changes.push(`${id}: 메시지 추가 "${quoted}" (코멘트 ${c.id})`)
        }
        continue
      }
      if (/(삭제|제거|없애|빼\s*주|빼줘|빼세요)/.test(text)) {
        if (target === undefined) { question(c, '삭제할 요소가 지정되지 않았다'); continue }
        removeElement(spec, target)
        removed.add(target.element.id)
        changes.push(`${target.element.id}: 요소 제거 (코멘트 ${c.id})`)
        continue
      }
      question(c, '더미 어댑터가 자동 반영하지 못한 요청. 기획자 확인 필요')
    }
    if (comments.length === 0) unresolved.push({ kind: 'question', text: '반영할 코멘트가 없어 명세를 바꾸지 않았다. 직접 프롬프트는 더미 어댑터가 해석하지 않는다' })

    spec.unresolved = [...spec.unresolved, ...unresolved]
    const output: WireOutput = {
      screen_spec: spec,
      trace_proposals: [],
      unresolved,
      change_summary: {
        summary: changes.length > 0 ? `[더미 어댑터] 코멘트 ${comments.length}건 중 ${changes.length}건 반영: ${changes.join('; ')}` : `[더미 어댑터] 코멘트 ${comments.length}건 — 자동 반영한 변경 없음 (미확정 ${unresolved.length}건)`,
        added_ids: [...added],
        changed_ids: [...changed],
        removed_ids: [...removed],
        locked_violations: [],
      },
    }
    return { output, raw_text: JSON.stringify(output), usage: { input_tokens: 0, output_tokens: 0 }, stop_reason: 'fixture' }
  }

  async draftRevisionPrompt(input: { ctx: GenerationContext; current: ScreenSpecShape; comments: NonNullable<GenerationContext['comments']> }): Promise<{ prompt: string; rationale: string }> {
    const { ctx, current, comments } = input
    const spec = shapeToWire(current)
    const byRole = new Map<string, Comment[]>()
    for (const c of comments) byRole.set(c.role, [...(byRole.get(c.role) ?? []), c])
    const lines: string[] = [`다음 검토 코멘트를 반영해 화면 ${ctx.screen.external_id}(${ctx.screen.title}) 명세를 수정한다.`]
    let elementCount = 0
    let caseCount = 0
    let untargeted = 0
    let lockedCount = 0
    const lockedIds = new Set<string>()
    for (const [role, list] of byRole) {
      lines.push('', `[${roleLabel(role)} 코멘트]`)
      for (const c of list) {
        const found = c.element_id === undefined ? undefined : findElement(spec, c.element_id)
        const locked = c.element_id !== undefined && isLocked(spec, c.element_id)
        if (locked) { lockedCount += 1; if (c.element_id !== undefined) lockedIds.add(c.element_id) }
        const where: string[] = []
        if (c.element_id !== undefined) { elementCount += 1; where.push(found !== undefined ? `요소 ${c.element_id}(${found.element.label}, 영역 ${found.section.id})` : `요소 ${c.element_id}(명세에 없음)`) }
        if (c.case_id !== undefined) { caseCount += 1; where.push(`CASE ${c.case_id}`) }
        if (where.length === 0) { untargeted += 1; where.push(`대상 미지정(${c.target})`) }
        lines.push(`- ${where.join(', ')}: "${c.text}" (${c.author})${locked ? ' ← 잠긴 요소, 변경하지 말고 확인 요청으로 남긴다' : ''}`)
      }
    }
    const lockedAll = [...new Set([...spec.locked_elements, ...spec.locked_actions])]
    lines.push('', '제약:', `- 잠긴 요소·동작${lockedAll.length > 0 ? `(${lockedAll.join(', ')})` : ''}은 변경하지 않는다.`, '- 코멘트와 무관한 요소·동작·CASE 는 바꾸지 않는다.', '- 외부 ID·baseline·요구사항 연결은 유지한다.', '- change_summary 에 바꾼 id 를 모두 적고, 반영하지 못한 코멘트는 unresolved 에 질문으로 남긴다.')
    const roleSummary = [...byRole].map(([r, l]) => `${roleLabel(r)} ${l.length}`).join(', ')
    const rationale = `[더미 어댑터] 코멘트 ${comments.length}건을 역할 ${byRole.size}개(${roleSummary})로 묶었다. 요소 지정 ${elementCount}건, CASE 지정 ${caseCount}건, 대상 미지정 ${untargeted}건. 잠긴 요소를 가리키는 코멘트 ${lockedCount}건${lockedIds.size > 0 ? `(${[...lockedIds].join(', ')})` : ''}은 변경 대상에서 제외하고 확인 요청으로 남겼다.`
    return { prompt: lines.join('\n'), rationale }
  }

  /** AS-IS 페인포인트 초안 — structure 규칙 기반 결정적 (계약 §12). 시각·난수를 쓰지 않는다. */
  async draftPainPoints(input: { url: string; note?: string | undefined; structure: AsisStructure }): Promise<PainPointDraftResult> {
    const s = input.structure
    const points: PainPointDraft[] = []

    // 1. 레이블 없는 입력 필드 → high
    if (s.counts.fields_without_label > 0) {
      const unlabeled = s.forms.flatMap((f) => f.fields.filter((x) => x.label === undefined || x.label.trim().length === 0)).map((x) => x.name ?? x.type)
      points.push({
        area: '입력 폼',
        severity: 'high',
        description: `레이블 없는 입력 필드가 ${s.counts.fields_without_label}개다. 무엇을 입력해야 하는지 필드 이름 없이 추측해야 하고, 스크린리더는 항목을 읽지 못한다.`,
        evidence: `counts.fields_without_label=${s.counts.fields_without_label}${unlabeled.length > 0 ? ` (예: ${unlabeled.slice(0, 5).join(', ')})` : ''}`,
        suggestion: '모든 입력에 label 요소를 연결하고 필수 여부를 표시한다. placeholder 는 레이블을 대체하지 못한다.',
      })
    }

    // 2. alt 없는 이미지 → medium
    if (s.counts.images_without_alt > 0) {
      points.push({
        area: '접근성',
        severity: 'medium',
        description: `대체 텍스트(alt) 없는 이미지가 ${s.counts.images_without_alt}개다. 이미지가 전달하는 정보를 스크린리더·이미지 차단 환경에서 알 수 없다.`,
        evidence: `counts.images_without_alt=${s.counts.images_without_alt} / counts.images=${s.counts.images}`,
        suggestion: '정보 이미지에는 내용을 설명하는 alt 를, 장식 이미지에는 alt="" 를 명시한다.',
      })
    }

    // 3. h1 없음 / 2개 이상 → medium
    const h1 = s.headings.filter((h) => h.level === 1)
    if (h1.length === 0) {
      points.push({
        area: '정보 구조',
        severity: 'medium',
        description: '페이지에 h1 제목이 없다. 페이지의 주제를 나타내는 최상위 제목이 없어 문서 구조·검색·보조기술 탐색이 어렵다.',
        evidence: `headings 에 h1 0건 (수집된 헤딩 ${s.headings.length}건${s.headings[0] !== undefined ? `, 최상위 h${s.headings[0].level} "${s.headings[0].text}"` : ''})`,
        suggestion: '페이지 주제를 나타내는 h1 을 하나 두고 h2·h3 로 위계를 정리한다.',
      })
    } else if (h1.length >= 2) {
      points.push({
        area: '정보 구조',
        severity: 'medium',
        description: `h1 제목이 ${h1.length}개다. 최상위 제목이 여러 개면 페이지 주제가 무엇인지 구조로 판단할 수 없다.`,
        evidence: `h1 ${h1.length}건: ${h1.slice(0, 5).map((h) => `"${h.text}"`).join(', ')}`,
        suggestion: 'h1 은 페이지당 하나만 두고 나머지는 h2 이하로 낮춘다.',
      })
    }

    // 4. 내비 링크 과다 → medium
    if (s.nav_links.length > NAV_LINKS_LIMIT) {
      points.push({
        area: '내비게이션',
        severity: 'medium',
        description: `내비게이션 링크가 ${s.nav_links.length}개로 과다하다(기준 ${NAV_LINKS_LIMIT}개 초과). 원하는 메뉴를 찾으려면 전체를 훑어야 한다.`,
        evidence: `nav_links=${s.nav_links.length}건 (예: ${s.nav_links.slice(0, 5).map((l) => l.text).join(', ')} …)`,
        suggestion: '메뉴를 상위 범주로 묶어 단계화하고, 사용 빈도가 낮은 항목은 하위 메뉴·더보기로 이동한다.',
      })
    }

    // 5. 모호한 버튼 문구 → medium
    const vague = s.buttons.filter((b) => AMBIGUOUS_BUTTON_WORDS.some((w) => b.includes(w)))
    if (vague.length > 0) {
      points.push({
        area: '버튼 문구',
        severity: 'medium',
        description: `무슨 동작인지 알 수 없는 모호한 버튼 문구가 ${vague.length}건 있다("${AMBIGUOUS_BUTTON_WORDS.join('", "')}" 류). 누르기 전에 결과를 예측할 수 없다.`,
        evidence: `버튼 문구: ${vague.slice(0, 5).map((b) => `"${b}"`).join(', ')}`,
        suggestion: '버튼 문구를 "견적 저장", "목록 다운로드" 처럼 동작+대상이 드러나게 바꾼다.',
      })
    }

    // 6. caption 미확인 표 → low (structure 는 caption 을 수집하지 않으므로 counts.tables 를 근거로 확인 요청을 남긴다)
    if (s.counts.tables > 0) {
      points.push({
        area: '표',
        severity: 'low',
        description: `표 ${s.counts.tables}개에서 caption(표 제목)이 확인되지 않는다. 표가 무엇을 나열하는지 제목 없이 셀 내용으로 추측해야 한다.`,
        evidence: `counts.tables=${s.counts.tables}`,
        suggestion: '각 표에 caption 과 th 머리글을 넣어 표의 목적과 열 의미를 밝힌다.',
      })
    }

    // 7. iframe → low
    if (s.counts.iframes > 0) {
      points.push({
        area: '외부 삽입',
        severity: 'low',
        description: `iframe 이 ${s.counts.iframes}개 있다. 삽입 영역은 반응형·접근성·보안 정책을 본문과 함께 제어하기 어렵고 개편 시 별도 이관 대상이다.`,
        evidence: `counts.iframes=${s.counts.iframes}`,
        suggestion: 'iframe 콘텐츠를 본문 구성요소로 통합하거나, 유지한다면 title 과 크기·정책을 명시한다.',
      })
    }

    // 8. 메타 description 없음 → low
    if (s.description === undefined || s.description.trim().length === 0) {
      points.push({
        area: '메타 정보',
        severity: 'low',
        description: '메타 description 이 없다. 검색 결과·링크 공유 미리보기에서 서비스 설명이 비어 보인다.',
        evidence: 'structure.description 없음',
        suggestion: '페이지 목적을 한 문장으로 담은 meta description 을 추가한다.',
      })
    }

    points.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])

    if (points.length === 0) {
      return { summary: '[더미 어댑터] 구조 요약에서 규칙 기반 페인포인트를 찾지 못했다. 규칙에 걸리지 않았을 뿐 문제가 없다는 뜻은 아니므로 기획자 확인이 필요하다.', pain_points: [] }
    }
    const bySeverity = (sev: PainPointDraft['severity']): number => points.filter((p) => p.severity === sev).length
    const topAreas = [...new Set(points.map((p) => p.area))].slice(0, 3).join('·')
    const summary = [
      `[더미 어댑터] 대상 페이지 구조에서 페인포인트 ${points.length}건을 찾았다(${SEVERITY_LABEL.high} ${bySeverity('high')}건·${SEVERITY_LABEL.medium} ${bySeverity('medium')}건·${SEVERITY_LABEL.low} ${bySeverity('low')}건).`,
      `우선 개선 영역은 ${topAreas}이다.`,
      '규칙 기반 초안이므로 기획자 채택·거부 확인이 필요하다.',
    ].join(' ')
    return { summary, pain_points: points }
  }
}

/** 요소를 제거하고 그 요소를 가리키는 동작·매핑·잠금·검증 참조를 정리한다. 영역이 비면 영역도 제거한다. */
function removeElement(spec: WireScreenSpec, found: { section: WireSection; element: WireElement; index: number }): void {
  const id = found.element.id
  found.section.elements.splice(found.index, 1)
  const removedIds = new Set<string>([id])
  if (found.section.elements.length === 0) {
    spec.sections = spec.sections.filter((s) => s.id !== found.section.id)
    removedIds.add(found.section.id)
  }
  spec.actions = spec.actions.filter((a) => !(a.trigger !== undefined && removedIds.has(a.trigger)) && !(a.target !== undefined && removedIds.has(a.target)))
  spec.data_mapping = spec.data_mapping.filter((d) => !removedIds.has(d.element_id))
  spec.locked_elements = spec.locked_elements.filter((x) => !removedIds.has(x))
  spec.locked_actions = spec.locked_actions.filter((x) => spec.actions.some((a) => a.id === x))
}
