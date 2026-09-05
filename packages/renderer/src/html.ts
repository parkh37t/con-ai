/**
 * HTML 조립 — 목업(shell 의 screen 영역) + 우측 설명(panel) + 툴바 + 모달 + 인라인 데이터/JS.
 *
 * 구조(계약 §4): 페이지 `.root-shell > .screen-wrap + #right-panel`, 팝업 `.popup-shell > .popup-wrap + .spec-side`.
 * 모든 영역·요소·설명 항목에 data-element-id / data-section-id / data-display-no 를 붙인다.
 * 외부 CDN·폰트·이미지 참조는 없다.
 */
import { shellKindOf } from '@con-ai/schemas'
import type { Element as SpecElement, ScreenSpecShape } from '@con-ai/schemas'
import { CLIENT_SCRIPT } from './client-script.js'
import { buildClientData, toInlineJson, type ClientData } from './client-data.js'
import type { ElementIndexEntry, NumberedElement, NumberedSection, Numbering } from './element-index.js'
import { CASE_KIND_LABELS, labelOf } from './labels.js'
import { STYLES } from './styles.js'
import type { DescriptionModel, DescriptionSection, RenderInput } from './types.js'

export function escapeHtml(value: unknown): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

interface Ctx {
  input: RenderInput
  spec: ScreenSpecShape
  numbering: Numbering
  description: DescriptionModel
  element_index: ElementIndexEntry[]
  client: ClientData
  kind: 'page' | 'popup'
}

function idAttrs(element_id: string, section_id: string, display_no: string, kind: 'section' | 'element'): string {
  return `data-element-id="${escapeHtml(element_id)}" data-section-id="${escapeHtml(section_id)}" data-display-no="${escapeHtml(display_no)}" data-kind="${kind}"`
}

function portalOf(shell: string): string {
  const m = /^(.*)-(?:page|popup)$/.exec(shell)
  return m?.[1] ?? shell
}

/* ---------- 요소 컨트롤 ---------- */

function inputAttrs(el: SpecElement, extra = ''): string {
  const parts = [`data-input-for="${escapeHtml(el.id)}"`, `data-input-type="${el.type}"`, `name="${escapeHtml(el.id)}"`]
  if (el.placeholder) parts.push(`placeholder="${escapeHtml(el.placeholder)}"`)
  if (el.max_length !== undefined) parts.push(`maxlength="${el.max_length}"`)
  if (el.required) parts.push('required aria-required="true"')
  if (extra) parts.push(extra)
  return parts.join(' ')
}

function renderTable(el: SpecElement, ctx: Ctx): string {
  const columns = el.columns ?? []
  const table = ctx.client.tables.find((t) => t.element_id === el.id)
  const rows = initialRows(ctx, table?.default_sort)
  const head = columns
    .map((c) => {
      if (c.sortable) {
        const active = table?.default_sort?.column_id === c.id
        const ariaSort = active ? (table?.default_sort?.direction === 'desc' ? 'descending' : 'ascending') : 'none'
        return `<th data-column-id="${escapeHtml(c.id)}" data-sortable="true" aria-sort="${ariaSort}"><button type="button" class="sort-btn" title="정렬(더미)">${escapeHtml(c.label)}<span class="sort-ind"></span></button></th>`
      }
      return `<th data-column-id="${escapeHtml(c.id)}">${escapeHtml(c.label)}</th>`
    })
    .join('')
  const bodyRows =
    rows.length === 0
      ? `<tr class="empty-row"><td colspan="${Math.max(columns.length, 1)}">표시할 행이 없습니다</td></tr>`
      : rows
          .map((row, i) => {
            const cells = columns
              .map((c) => {
                const v = row !== null && typeof row === 'object' && !Array.isArray(row) ? (row as Record<string, unknown>)[c.id] : undefined
                const fmt = c.format ?? 'text'
                const text = v === undefined || v === null ? '' : (fmt === 'number' || fmt === 'currency') && typeof v === 'number' ? v.toLocaleString('ko-KR') : String(v)
                return `<td data-column-id="${escapeHtml(c.id)}" class="fmt-${fmt}">${escapeHtml(text)}</td>`
              })
              .join('')
            const clickable = table?.row_action ? ' class="clickable" tabindex="0"' : ''
            return `<tr data-row="${i}"${clickable}>${cells}</tr>`
          })
          .join('')
  return (
    `<div class="table-tools"><span data-row-count-for="${escapeHtml(el.id)}">총 ${rows.length}건</span>` +
    `<span class="table-note">더미데이터 · 실제 API 미연결</span></div>` +
    `<div class="table-scroll"><table class="grid" data-table-id="${escapeHtml(el.id)}"${table?.row_action ? ` data-row-action="${escapeHtml(table.row_action)}"` : ''}>` +
    `<thead><tr>${head}</tr></thead><tbody data-tbody-for="${escapeHtml(el.id)}">${bodyRows}</tbody></table></div>`
  )
}

function initialRows(ctx: Ctx, sort: { column_id: string; direction: 'asc' | 'desc' } | undefined): unknown[] {
  const state = ctx.client.states.find((s) => s.id === ctx.client.initial_case)
  const rows = state ? ctx.client.dummy[state.fixture_id] ?? [] : []
  if (!sort) return rows.slice()
  const dir = sort.direction === 'desc' ? -1 : 1
  const cell = (r: unknown): unknown => (r !== null && typeof r === 'object' && !Array.isArray(r) ? (r as Record<string, unknown>)[sort.column_id] : undefined)
  return rows.slice().sort((a, b) => {
    const va = cell(a)
    const vb = cell(b)
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    const sa = va === undefined || va === null ? '' : String(va)
    const sb = vb === undefined || vb === null ? '' : String(vb)
    if (sa === '' && sb !== '') return 1
    if (sb === '' && sa !== '') return -1
    return sa.localeCompare(sb, 'ko') * dir
  })
}

function renderControl(el: SpecElement, ctx: Ctx): string {
  const triggered = ctx.spec.actions.filter((a) => a.trigger === el.id)
  const first = triggered[0]
  const triggerAttrs = first ? ` data-action-trigger="${escapeHtml(el.id)}" data-action-id="${escapeHtml(first.id)}" data-action-type="${first.type}"` : ''
  switch (el.type) {
    case 'text-input':
      return `<div class="control"><input type="text" id="el-${escapeHtml(el.id)}" ${inputAttrs(el)}></div>`
    case 'number-input':
      return `<div class="control"><input type="number" id="el-${escapeHtml(el.id)}" ${inputAttrs(el)}></div>`
    case 'textarea':
      return `<div class="control"><textarea id="el-${escapeHtml(el.id)}" ${inputAttrs(el)}></textarea></div>`
    case 'select':
      return (
        `<div class="control"><select id="el-${escapeHtml(el.id)}" ${inputAttrs(el)}>` +
        (el.options ?? []).map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('') +
        `</select></div>`
      )
    case 'radio':
      return (
        `<div class="control choices" role="radiogroup" aria-label="${escapeHtml(el.label)}">` +
        (el.options ?? []).map((o) => `<label><input type="radio" value="${escapeHtml(o.value)}" ${inputAttrs(el)}> ${escapeHtml(o.label)}</label>`).join('') +
        `</div>`
      )
    case 'checkbox':
      if (el.options && el.options.length > 0) {
        return (
          `<div class="control choices" role="group" aria-label="${escapeHtml(el.label)}">` +
          el.options.map((o) => `<label><input type="checkbox" value="${escapeHtml(o.value)}" ${inputAttrs(el)}> ${escapeHtml(o.label)}</label>`).join('') +
          `</div>`
        )
      }
      return `<div class="control choices"><label><input type="checkbox" id="el-${escapeHtml(el.id)}" ${inputAttrs(el)}> ${escapeHtml(el.label)}</label></div>`
    case 'date-input':
      return `<div class="control"><input type="date" id="el-${escapeHtml(el.id)}" ${inputAttrs(el)}></div>`
    case 'date-range':
      return (
        `<div class="control range"><input type="date" id="el-${escapeHtml(el.id)}" ${inputAttrs(el, 'data-range="from" aria-label="시작일"')}>` +
        `<span class="range-sep">~</span><input type="date" ${inputAttrs(el, 'data-range="to" aria-label="종료일"')}></div>`
      )
    case 'button': {
      const secondary = first && (first.type === 'download-fixture' || first.type === 'close-popup' || first.type === 'navigate') ? ' btn-secondary' : ''
      return `<div class="control"><button type="button" class="btn${secondary}" id="el-${escapeHtml(el.id)}"${triggerAttrs}>${escapeHtml(el.label)}</button></div>`
    }
    case 'table':
      return renderTable(el, ctx)
    case 'text':
      return `<p class="static-text">${escapeHtml(el.note ?? el.label)}</p>`
    case 'link':
      return `<div class="control"><a href="#" class="link" data-link="1" id="el-${escapeHtml(el.id)}"${triggerAttrs}>${escapeHtml(el.label)}</a></div>`
    case 'pagination':
      return (
        `<nav class="pager" aria-label="${escapeHtml(el.label)}"><button type="button" data-pager="prev" aria-label="이전">‹</button>` +
        `<button type="button" class="is-current" data-pager="1">1</button><button type="button" data-pager="next" aria-label="다음">›</button></nav>`
      )
    default:
      return `<div class="control"><span class="static-text">${escapeHtml(el.label)}</span></div>`
  }
}

function renderElement(ne: NumberedElement, ctx: Ctx): string {
  const el = ne.element
  const locked = el.locked === true || ctx.spec.locked_elements.includes(el.id)
  const showLabel = el.type !== 'button' && el.type !== 'text' && el.type !== 'link'
  const label = showLabel
    ? `<div class="field-label"><span class="badge badge-element" data-badge-for="${escapeHtml(el.id)}">${escapeHtml(ne.display_no)}</span><span class="label-text">${escapeHtml(el.label)}</span>${el.required ? '<span class="req" aria-hidden="true">*</span>' : ''}${locked ? '<span class="lock">잠김</span>' : ''}</div>`
    : `<div class="field-label"><span class="badge badge-element" data-badge-for="${escapeHtml(el.id)}">${escapeHtml(ne.display_no)}</span>${locked ? '<span class="lock">잠김</span>' : ''}</div>`
  const trace = el.trace && el.trace.length > 0 ? ` data-criterion-ids="${escapeHtml(el.trace.join(' '))}"` : ''
  return `<div class="field field-${el.type}" ${idAttrs(el.id, ne.section_id, ne.display_no, 'element')} data-element-type="${el.type}"${trace}${locked ? ' data-locked="true"' : ''}>${label}${renderControl(el, ctx)}</div>`
}

function renderSection(ns: NumberedSection, ctx: Ctx): string {
  const s = ns.section
  const locked = ctx.spec.locked_elements.includes(s.id)
  return (
    `<section class="area" ${idAttrs(s.id, s.id, ns.display_no, 'section')}${locked ? ' data-locked="true"' : ''}>` +
    `<h2 class="area-title"><span class="badge badge-section" data-badge-for="${escapeHtml(s.id)}">${escapeHtml(ns.display_no)}</span>${escapeHtml(s.title)}${locked ? '<span class="lock">잠김</span>' : ''}</h2>` +
    `<div class="area-body">${ns.elements.map((e) => renderElement(e, ctx)).join('')}</div></section>`
  )
}

/* ---------- 목업(shell 의 screen 영역) ---------- */

function renderScreenRegion(ctx: Ctx): string {
  const { spec, input } = ctx
  const initial = ctx.client.states.find((s) => s.id === ctx.client.initial_case)
  const messages = (initial?.message_ids ?? [])
    .map((id) => spec.messages.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => m !== undefined)
    .map((m) => `<div class="msg msg-${m.kind}" data-message-id="${escapeHtml(m.id)}" role="${m.kind === 'error' ? 'alert' : 'status'}">${escapeHtml(m.text)}</div>`)
    .join('')
  const messagesBox = `<div class="screen-messages" data-messages${messages ? '' : ' hidden'}>${messages}</div>`
  const sections = ctx.numbering.sections.map((ns) => renderSection(ns, ctx)).join('')
  const status = `<div class="screen-status" data-screen-status><span data-status></span></div>`
  const portal = portalOf(spec.shell)
  if (ctx.kind === 'popup') {
    const closeAction = spec.actions.find((a) => a.type === 'close-popup' && a.trigger === undefined)
    return (
      `<div class="popup-wrap" data-region="screen" role="dialog" aria-labelledby="popup-title">` +
      `<header class="popup-head"><h1 class="popup-title" id="popup-title">${escapeHtml(input.meta.screen_title)}<small>${escapeHtml(spec.screen_id)}</small></h1>` +
      `<button type="button" class="popup-close" data-modal-close="1"${closeAction ? ` data-action-id="${escapeHtml(closeAction.id)}" data-action-type="close-popup"` : ''} aria-label="닫기">닫기</button></header>` +
      messagesBox +
      sections +
      status +
      `</div>`
    )
  }
  return (
    `<div class="screen-wrap" data-region="screen">` +
    `<header class="screen-head"><nav class="gnb" aria-label="GNB"><span class="portal">${escapeHtml(portal)} 포털</span><span class="gnb-menu">GNB · LNB 자리 (프로파일 규칙)</span></nav>` +
    `<div class="breadcrumb" aria-label="breadcrumb">${escapeHtml(portal)} 포털 › ${escapeHtml(input.meta.screen_title)}</div>` +
    `<h1 class="screen-title">${escapeHtml(input.meta.screen_title)}<small>${escapeHtml(spec.screen_id)}</small></h1></header>` +
    messagesBox +
    sections +
    status +
    `</div>`
  )
}

/* ---------- 우측 설명(panel) ---------- */

function itemAttrs(item: DescriptionSection['items'][number], ctx: Ctx, extra: string): string {
  const parts: string[] = ['data-target="description"']
  if (item.element_id !== undefined) {
    const entry = ctx.numbering.by_id.get(item.element_id)
    parts.push(`data-element-id="${escapeHtml(item.element_id)}"`)
    parts.push(`data-section-id="${escapeHtml(entry?.section_id ?? item.element_id)}"`)
    if (item.display_no !== undefined) parts.push(`data-display-no="${escapeHtml(item.display_no)}"`)
  }
  if (extra) parts.push(extra)
  return parts.join(' ')
}

function withTraceTags(text: string): string {
  // "수용조건: A, B" 조각을 trace 태그로 표시한다 (설명 안의 수용조건 ID 를 눈에 띄게).
  return escapeHtml(text).replace(/수용조건: ([^·—]+)/g, (_m, ids: string) => {
    const tags = ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((id) => `<span class="trace" data-criterion-id="${id}">${id}</span>`)
      .join('')
    return `수용조건:${tags}`
  })
}

function renderDescriptionSection(sec: DescriptionSection, order: number, ctx: Ctx): string {
  const title = `<h3 class="desc-title"><span class="desc-no">${order}</span>${escapeHtml(sec.title)}</h3>`
  if (sec.key === 'screen_id') {
    const meta = ctx.input.meta
    return (
      `<section class="desc-section panel-head" data-desc-key="screen_id">` +
      `<h2 class="desc-screen-id">${escapeHtml(ctx.spec.screen_id)}</h2>` +
      `<div class="panel-meta"><span class="tag" data-revision-label>${escapeHtml(meta.revision_label)}</span><span class="tag" data-generated-by>생성: ${escapeHtml(meta.generated_by)}</span>` +
      `<span class="tag">기준 ${escapeHtml(ctx.spec.baseline_id)}</span><span class="tag">${escapeHtml(ctx.spec.shell)} · ${ctx.spec.device === 'mobile' ? '모바일' : 'PC'}</span></div>` +
      `<div class="desc-items">${sec.items.map((it) => `<div class="desc-item" ${itemAttrs(it, ctx, '')}><span class="desc-label">${escapeHtml(it.label)}</span><span class="desc-text">${escapeHtml(it.text)}</span></div>`).join('')}</div>` +
      `</section>`
    )
  }
  if (sec.key === 'cases' || sec.key === 'messages') {
    const isCase = sec.key === 'cases'
    const rows = sec.items
      .map((it, i) => {
        const extra = isCase ? `data-case-id="${escapeHtml(it.label)}"` : `data-message-id="${escapeHtml(it.label)}"`
        const kind = isCase ? ctx.spec.states[i]?.case_kind ?? 'normal' : ctx.spec.messages[i]?.kind ?? ''
        return `<tr class="desc-item" ${itemAttrs(it, ctx, extra)}><td class="desc-label">${escapeHtml(it.label)}</td><td>${escapeHtml(isCase ? labelOf(CASE_KIND_LABELS, kind) : kind)}</td><td class="desc-text">${withTraceTags(it.text)}</td></tr>`
      })
      .join('')
    return (
      `<section class="desc-section" data-desc-key="${sec.key}">${title}` +
      `<table class="desc-table"><thead><tr><th>${isCase ? 'CASE' : '메시지 ID'}</th><th>${isCase ? '종류' : '종류'}</th><th>${isCase ? '기대 결과' : '문구·조건'}</th></tr></thead><tbody>${rows}</tbody></table></section>`
    )
  }
  const items = sec.items
    .map((it) => {
      const entry = it.element_id !== undefined ? ctx.numbering.by_id.get(it.element_id) : undefined
      const cls = entry?.kind === 'section' && sec.key === 'sections' ? 'desc-item is-section' : 'desc-item'
      return `<div class="${cls}" ${itemAttrs(it, ctx, '')}><span class="desc-label">${escapeHtml(it.label)}</span><span class="desc-text">${withTraceTags(it.text)}</span></div>`
    })
    .join('')
  return `<section class="desc-section" data-desc-key="${escapeHtml(sec.key)}">${title}<div class="desc-items">${items}</div></section>`
}

function renderPanel(ctx: Ctx): string {
  const body = ctx.description.sections.map((s, i) => renderDescriptionSection(s, i + 1, ctx)).join('')
  if (ctx.kind === 'popup') return `<aside class="spec-side" id="spec-side" data-region="description" aria-label="화면 설명">${body}</aside>`
  return `<aside id="right-panel" class="right-panel" data-region="description" aria-label="화면 설명">${body}</aside>`
}

/* ---------- 툴바·모달 ---------- */

function renderToolbar(ctx: Ctx): string {
  const cases = ctx.client.states
    .map(
      (s) =>
        `<button type="button" data-case="${escapeHtml(s.id)}" title="${escapeHtml(s.expected)}"${s.id === ctx.client.initial_case ? ' class="is-active"' : ''}>${escapeHtml(s.id)} <small>(${escapeHtml(labelOf(CASE_KIND_LABELS, s.case_kind))})</small></button>`,
    )
    .join('')
  return (
    `<div class="con-ai-toolbar" data-toolbar role="toolbar" aria-label="미리보기 도구">` +
    `<span class="tb-group"><span class="tb-label">CASE</span>${cases}</span>` +
    `<span class="tb-group"><span class="tb-label">폭</span><button type="button" data-device-toggle="desktop">PC</button><button type="button" data-device-toggle="mobile">모바일</button></span>` +
    `<span class="tb-group"><span class="tb-label">생성</span><span data-generated-by-toolbar>${escapeHtml(ctx.input.meta.generated_by)}</span> · <span>${escapeHtml(ctx.input.meta.revision_label)}</span></span>` +
    `<span class="tb-status" data-status></span></div>`
  )
}

function renderModal(): string {
  return (
    `<div class="con-ai-modal" data-modal hidden role="dialog" aria-modal="true" aria-labelledby="con-ai-modal-title">` +
    `<div class="modal-card"><h2 id="con-ai-modal-title" data-modal-title>팝업</h2><div class="modal-body" data-modal-body></div>` +
    `<div class="modal-foot"><button type="button" class="btn" data-modal-close="1">닫기</button></div></div></div>`
  )
}

/* ---------- 문서 ---------- */

export function renderHtmlDocument(args: {
  input: RenderInput
  numbering: Numbering
  description: DescriptionModel
  element_index: ElementIndexEntry[]
}): string {
  const { input } = args
  const spec = input.spec
  const kind = shellKindOf(spec.shell)
  const client = buildClientData(input)
  const ctx: Ctx = { input, spec, numbering: args.numbering, description: args.description, element_index: args.element_index, client, kind }
  const profile = input.profile
  const shell = kind === 'popup' ? profile.popup_shell : profile.page_shell
  const rootClass = shell.root
  const title = `${spec.screen_id} — ${input.meta.screen_title}`
  return (
    `<!DOCTYPE html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
    `<meta name="con-ai-renderer" content="${escapeHtml(profile.id)}">\n<title>${escapeHtml(title)}</title>\n<style>${STYLES}</style>\n</head>\n` +
    `<body data-screen-id="${escapeHtml(spec.screen_id)}" data-shell="${escapeHtml(spec.shell)}" data-shell-kind="${kind}" data-case="${escapeHtml(client.initial_case)}" data-profile="${escapeHtml(profile.id)}" data-action-types="${escapeHtml([...new Set(spec.actions.map((a) => a.type))].join(' '))}">\n` +
    renderToolbar(ctx) +
    `\n<div class="${rootClass}" data-shell-root data-device="${spec.device}">\n` +
    renderScreenRegion(ctx) +
    `\n` +
    renderPanel(ctx) +
    `\n</div>\n` +
    renderModal() +
    `\n<script id="con-ai-data" type="application/json">${toInlineJson(client)}</script>\n` +
    `<script>${CLIENT_SCRIPT}</script>\n</body>\n</html>\n`
  )
}
