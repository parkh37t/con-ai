/**
 * 우측 설명 모델 — 명세에서 설명 절을 만든다 (설계 §9 설명 순서).
 *
 * 절 key 는 프로파일 description_order 를 따른다:
 * screen_id → overview → cases → flow → policy → data_mapping → sections → messages.
 * 'sections' 절의 항목은 element_index 와 같은 순서·같은 번호다 (영역 항목 뒤에 요소 항목).
 */
import { shellKindOf } from '@con-ai/schemas'
import type { Action, Element as SpecElement, ScreenSpecShape } from '@con-ai/schemas'
import type { Numbering } from './element-index.js'
import {
  ACTION_TYPE_LABELS,
  CASE_KIND_LABELS,
  ELEMENT_TYPE_LABELS,
  MESSAGE_KIND_LABELS,
  UNRESOLVED_KIND_LABELS,
  VALIDATION_RULE_LABELS,
  labelOf,
} from './labels.js'
import type { DescriptionModel, DescriptionSection, RenderInput } from './types.js'

type Item = DescriptionSection['items'][number]

export const DESCRIPTION_TITLES: Record<string, string> = {
  screen_id: '화면 ID',
  overview: '화면명·목적·REQ',
  cases: 'CASE',
  flow: '처리 흐름',
  policy: '정책',
  data_mapping: '데이터 매핑 · 근거',
  sections: '영역별 디스크립션',
  messages: '메시지 · 알림',
}

function item(label: string, text: string, ref?: { element_id: string; display_no?: string | undefined }): Item {
  const out: Item = { label, text }
  if (ref !== undefined) {
    out.element_id = ref.element_id
    if (ref.display_no !== undefined) out.display_no = ref.display_no
  }
  return out
}

function refOf(numbering: Numbering, id: string | undefined): { element_id: string; display_no?: string | undefined } | undefined {
  if (id === undefined) return undefined
  const entry = numbering.by_id.get(id)
  if (!entry) return undefined
  return { element_id: id, display_no: entry.display_no }
}

/** 여러 줄 카피를 설명 한 줄로 (줄바꿈만 공백으로 바꾼다 — 글자는 그대로 둔다). */
function oneLine(text: string): string {
  return text.replace(/\r?\n/g, ' ')
}

function joinParts(parts: Array<string | undefined>): string {
  return parts.filter((p): p is string => p !== undefined && p !== '').join(' · ')
}

/** 요소 한 줄 설명 (영역·필드 설명 절). */
export function describeElement(el: SpecElement, locked: boolean): string {
  const parts: Array<string | undefined> = [labelOf(ELEMENT_TYPE_LABELS, el.type)]
  if (el.required) parts.push('필수 입력')
  if (el.placeholder) parts.push(`placeholder: ${el.placeholder}`)
  if (el.max_length !== undefined) parts.push(`최대 ${el.max_length}자`)
  if (el.options && el.options.length > 0) parts.push(`선택지: ${el.options.map((o) => o.label).join(' / ')}`)
  if (el.columns && el.columns.length > 0) {
    parts.push(`컬럼: ${el.columns.map((c) => c.label + (c.sortable ? '(정렬)' : '')).join(', ')}`)
    if (el.default_sort) {
      const col = el.columns.find((c) => c.id === el.default_sort?.column_id)
      parts.push(`기본 정렬: ${col?.label ?? el.default_sort.column_id} ${el.default_sort.direction === 'desc' ? '내림차순' : '오름차순'}`)
    }
  }
  // 내용 표현 3종 — 설명에도 «무엇이 쓰여 있는가» 를 **빠짐없이** 옮긴다.
  // 필드 목록은 content.ts contentTexts 와 같아야 한다 (render.test 가 한 글자도 빠지지 않았는지 본다).
  if (el.hero) {
    const h = el.hero
    if (h.eyebrow !== undefined) parts.push(`머리말: ${h.eyebrow}`)
    parts.push(`카피: ${oneLine(h.headline)}`)
    if (h.subcopy !== undefined) parts.push(`보조 문장: ${oneLine(h.subcopy)}`)
    if (h.search_placeholder !== undefined) parts.push(`통합검색 입력: ${h.search_placeholder}`)
    if (h.chips && h.chips.length > 0) parts.push(`인기어: ${h.chips.join(' / ')}`)
    if (h.visual_note !== undefined) parts.push(`키비주얼 자리: ${h.visual_note} (이미지 미포함)`)
  }
  if (el.stats && el.stats.length > 0) {
    const items = el.stats.map((x) => joinParts([`${x.label} ${x.value}`, x.delta, x.caption]))
    parts.push(`KPI ${el.stats.length}칸 — ${items.join(' / ')}`)
    parts.push('표시값은 명세의 예시 값 · 실제 데이터 미연결')
  }
  if (el.cards && el.cards.length > 0) {
    const items = el.cards.map((c) => joinParts([c.badge === undefined ? undefined : `[${c.badge}]`, c.title, c.desc, c.meta]))
    parts.push(`카드 ${el.cards.length}장 — ${items.join(' / ')}`)
  }
  if (el.trace && el.trace.length > 0) parts.push(`수용조건: ${el.trace.join(', ')}`)
  if (locked || el.locked) parts.push('잠긴 요소')
  const head = joinParts(parts)
  return el.note ? `${head} — ${el.note}` : head
}

function describeAction(a: Action, spec: ScreenSpecShape, labelById: Map<string, string>): string {
  const parts: Array<string | undefined> = [labelOf(ACTION_TYPE_LABELS, a.type)]
  if (a.trigger !== undefined) parts.push(`실행: ${labelById.get(a.trigger) ?? a.trigger}(${a.trigger})`)
  if (a.target !== undefined) parts.push(`대상: ${labelById.get(a.target) ?? a.target}(${a.target})`)
  if (a.target_screen_id !== undefined) parts.push(`대상 화면: ${a.target_screen_id}`)
  if (a.target_state_id !== undefined) parts.push(`전이 CASE: ${a.target_state_id}`)
  if (a.trace && a.trace.length > 0) parts.push(`수용조건: ${a.trace.join(', ')}`)
  if (spec.locked_actions.includes(a.id)) parts.push('잠긴 동작')
  const head = joinParts(parts)
  return a.note ? `${head} — ${a.note}` : head
}

export function buildDescription(input: RenderInput, numbering: Numbering): DescriptionModel {
  const { spec, meta, profile } = input
  const kind = shellKindOf(spec.shell)
  const labelById = new Map<string, string>()
  for (const s of spec.sections) {
    labelById.set(s.id, s.title)
    for (const e of s.elements) labelById.set(e.id, e.label)
  }
  const metaReq = new Map(meta.requirements.map((r) => [r.external_id, r]))

  const screenIdItems: Item[] = [
    item('화면 ID', spec.screen_id),
    item('revision', meta.revision_label),
    item('생성', meta.generated_by),
    item('기준 버전', spec.baseline_id),
    item('shell · 기기', `${spec.shell} (${kind === 'popup' ? '팝업' : '페이지'}) · ${spec.device === 'mobile' ? '모바일' : 'PC'}`),
  ]

  const overviewItems: Item[] = [
    item('화면명', meta.screen_title),
    item('목적', spec.purpose),
    item('역할', spec.roles && spec.roles.length > 0 ? spec.roles.join(', ') : '지정 없음'),
    ...spec.requirements.map((r) => {
      const title = metaReq.get(r.id)?.title ?? '(제목 없음)'
      return item(r.id, `${title} — 수용조건: ${r.criterion_ids.join(', ')}`)
    }),
  ]

  const caseItems: Item[] = spec.states.map((s) =>
    item(
      s.id,
      joinParts([
        `[${labelOf(CASE_KIND_LABELS, s.case_kind ?? 'normal')}] ${s.expected}`,
        `fixture: ${s.fixture_id}`,
        s.role !== undefined ? `역할: ${s.role}` : undefined,
        s.message_ids && s.message_ids.length > 0 ? `메시지: ${s.message_ids.join(', ')}` : undefined,
        s.note,
      ]),
    ),
  )

  const flowItems: Item[] =
    spec.actions.length > 0
      ? spec.actions.map((a) => item(a.label ?? a.id, describeAction(a, spec, labelById), refOf(numbering, a.trigger ?? a.target)))
      : [item('처리 흐름', '정의된 동작이 없다')]

  const policyItems: Item[] = []
  for (const ns of numbering.sections) {
    for (const ne of ns.elements) {
      const el = ne.element
      const rules: string[] = []
      if (el.required) rules.push('필수 입력')
      for (const v of el.validations ?? []) {
        rules.push(
          `${labelOf(VALIDATION_RULE_LABELS, v.rule)}${v.value !== undefined ? `=${String(v.value)}` : ''}${v.message_id !== undefined ? ` → ${v.message_id}` : ''}`,
        )
      }
      // 라벨에는 번호를 붙이지 않는다. 번호는 display_no(=element_index) 하나에서 나와 배지로만 표시한다.
      if (rules.length > 0) policyItems.push(item(el.label, rules.join('; '), { element_id: el.id, display_no: ne.display_no }))
    }
  }
  if (spec.locked_elements.length > 0) policyItems.push(item('잠긴 요소', spec.locked_elements.join(', ')))
  if (spec.locked_actions.length > 0) policyItems.push(item('잠긴 동작', spec.locked_actions.join(', ')))
  for (const u of spec.unresolved) {
    policyItems.push(
      item(`미확정(${labelOf(UNRESOLVED_KIND_LABELS, u.kind)})`, joinParts([u.text, u.related_ids && u.related_ids.length > 0 ? `관련: ${u.related_ids.join(', ')}` : undefined])),
    )
  }
  if (policyItems.length === 0) policyItems.push(item('정책', '명세에 정책 항목(검증 규칙·잠금·미확정)이 없다'))

  const mappingItems: Item[] =
    spec.data_mapping.length > 0
      ? spec.data_mapping.map((m) =>
          item(
            m.column_id !== undefined ? `${m.element_id}.${m.column_id}` : m.element_id,
            `${m.source} · 근거: ${m.evidence.map((e) => e.anchor_id + (e.note ? `(${e.note})` : '')).join(', ')}`,
            refOf(numbering, m.element_id),
          ),
        )
      : [item('데이터 매핑', '근거가 있는 데이터 매핑이 없다 (빠진 근거는 정책 절의 미확정 참조)')]

  // 영역·필드 설명 — 라벨은 영역 제목·요소 라벨 그대로다. 번호는 display_no(=element_index) 로만 전달하고
  // 화면 배지와 설명 배지가 같은 값을 쓴다 (설계 §9: 화면 숫자와 설명 숫자는 같은 데이터에서).
  const sectionItems: Item[] = []
  for (const ns of numbering.sections) {
    const s = ns.section
    sectionItems.push(item(s.title, s.note ?? `영역 · 요소 ${s.elements.length}개`, { element_id: s.id, display_no: ns.display_no }))
    for (const ne of ns.elements) {
      sectionItems.push(
        item(ne.element.label, describeElement(ne.element, spec.locked_elements.includes(ne.element.id)), {
          element_id: ne.element.id,
          display_no: ne.display_no,
        }),
      )
    }
  }

  const messageItems: Item[] =
    spec.messages.length > 0
      ? spec.messages.map((m) => item(m.id, joinParts([`[${labelOf(MESSAGE_KIND_LABELS, m.kind)}] ${m.text}`, m.when ? `조건: ${m.when}` : undefined])))
      : [item('메시지', '정의된 메시지가 없다')]

  const byKey: Record<string, Item[]> = {
    screen_id: screenIdItems,
    overview: overviewItems,
    cases: caseItems,
    flow: flowItems,
    policy: policyItems,
    data_mapping: mappingItems,
    sections: sectionItems,
    messages: messageItems,
  }

  return {
    screen_id: spec.screen_id,
    title: meta.screen_title,
    sections: profile.description_order.map((key) => ({ key, title: DESCRIPTION_TITLES[key] ?? key, items: byKey[key] ?? [] })),
  }
}
