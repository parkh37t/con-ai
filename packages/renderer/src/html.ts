/**
 * HTML 조립 — 목업(shell 의 screen 영역) + 우측 설명(panel) + 툴바 + 모달 + 인라인 데이터/JS.
 *
 * 구조(계약 §4): 페이지 `.root-shell > .screen-wrap + #right-panel`, 팝업 `.popup-shell > .popup-wrap + .spec-side`.
 * 모든 영역·요소·설명 항목에 data-element-id / data-section-id / data-display-no 를 붙인다.
 * 외부 CDN·폰트·이미지 참조는 없다.
 *
 * 시각 언어는 목표 화면설계서 문서를 따른다(styles.ts 주석 참조):
 *  - 영역은 둥근 카드이고 좌상단 바깥으로 검은 사각 번호 배지가 걸친다.
 *  - 요소는 라벨 앞에 파란 원형 배지를 둔다. 번호는 element_index 하나에서 나온다.
 *  - GNB(로고 pill·메뉴·활성 밑줄·유틸) 와 breadcrumb 는 페이지 목업 머리에만 둔다(팝업에는 복사하지 않는다).
 *  - 모바일은 폰 프레임(검은 테두리·상태 표시줄·햄버거) 안에 목업을 넣는다.
 */
import { shellKindOf } from '@con-ai/schemas'
import type { Element as SpecElement, ScreenSpecShape } from '@con-ai/schemas'
import { CLIENT_SCRIPT } from './client-script.js'
import { buildClientData, toInlineJson, type ClientData } from './client-data.js'
import type { ElementIndexEntry, NumberedElement, NumberedSection, Numbering } from './element-index.js'
import { CASE_KIND_LABELS, MESSAGE_KIND_LABELS, labelOf } from './labels.js'
import { BRAND_STYLES, STYLES } from './styles.js'
import { themeById, themeStyle } from './theme.js'
import type { DescriptionModel, DescriptionSection, RenderInput, RenderNavItem } from './types.js'

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

/** 화면·설명이 함께 쓰는 번호 배지. 영역=검은 사각, 요소=파란 원형 (styles.ts 참조). */
function badge(kind: 'section' | 'element', element_id: string, display_no: string): string {
  return `<span class="badge badge-${kind}" data-badge-for="${escapeHtml(element_id)}">${escapeHtml(display_no)}</span>`
}

/* ---------- GNB · breadcrumb (명세·메타에서 받고 없으면 합리적 기본) ---------- */

const PORTAL_LABELS: Record<string, string> = { partner: '파트너', buyer: '구매', supplier: '공급사', admin: '관리자', member: '회원', seller: '판매자' }

/** 포털 이름 — meta.portal_name 이 있으면 그대로, 없으면 shell 접두어에서 만든다. */
export function portalNameOf(ctx: Ctx): string {
  const given = ctx.input.meta.portal_name
  if (given !== undefined && given.trim() !== '') return given.trim()
  const key = portalOf(ctx.spec.shell)
  return `${PORTAL_LABELS[key] ?? key} 포털`
}

/** 화면명의 첫 낱말을 메뉴 그룹으로 본다 ("견적 목록" → "견적"). */
function menuGroupOf(title: string): string {
  const head = title.trim().split(/\s+/)[0]
  return head !== undefined && head !== '' ? head : title.trim()
}

/** GNB 메뉴 — meta.menus 가 있으면 그대로, 없으면 화면명에서 만든 기본 메뉴. */
export function menusOf(ctx: Ctx): RenderNavItem[] {
  const given = ctx.input.meta.menus
  if (given !== undefined && given.length > 0) return given
  const group = menuGroupOf(ctx.input.meta.screen_title)
  const rest = ['공지사항', '고객지원'].filter((m) => m !== group)
  return [{ label: '홈' }, ...(group === '홈' ? [] : [{ label: group, active: true }]), ...rest.map((label) => ({ label }))]
}

function renderGnb(ctx: Ctx): string {
  const portal = portalNameOf(ctx)
  const menus = menusOf(ctx)
  const items = menus.map((m) => `<span class="m${m.active === true ? ' on' : ''}">${escapeHtml(m.label)}</span>`).join('')
  return (
    `<nav class="gnb" aria-label="GNB"><span class="logo">${escapeHtml(portal)}</span>` +
    `<span class="gnb-menu">${items}</span>` +
    `<span class="util"><span>통합검색 ⌕</span><span>KOR/ENG</span><span>전체메뉴 ▾</span></span>` +
    `<button type="button" class="ham" data-gnb-toggle aria-label="모바일 메뉴 열기">☰</button></nav>`
  )
}

function renderBreadcrumb(ctx: Ctx): string {
  const title = ctx.input.meta.screen_title
  const group = menuGroupOf(title)
  const mid = group === title ? '' : `${escapeHtml(group)} › `
  return `<div class="breadcrumb" aria-label="breadcrumb">홈 › ${mid}<b>${escapeHtml(title)}</b></div>`
}

/* ---------- 요소 컨트롤 ---------- */

/**
 * `data-input-type` 은 «입력 유형» 이다 — 요소 타입을 그대로 내보내면 히어로의 통합검색이
 * `hero` 로 나가 검사·클라이언트의 텍스트 입력 화이트리스트에 걸리지 않는다.
 */
function inputTypeOf(el: SpecElement): string {
  return el.type === 'hero' ? 'text-input' : el.type
}

function inputAttrs(el: SpecElement, extra = ''): string {
  const parts = [`data-input-for="${escapeHtml(el.id)}"`, `data-input-type="${inputTypeOf(el)}"`, `name="${escapeHtml(el.id)}"`]
  if (el.placeholder) parts.push(`placeholder="${escapeHtml(el.placeholder)}"`)
  if (el.max_length !== undefined) parts.push(`maxlength="${el.max_length}"`)
  if (el.required) parts.push('required aria-required="true"')
  if (extra) parts.push(extra)
  return parts.join(' ')
}

/** 자릿수를 맞춰 오른쪽으로 붙이는 열인가. */
function isNumericFormat(format: string | undefined): boolean {
  return format === 'number' || format === 'currency'
}

/**
 * 상태 코드 → pill 색. **코드 문자열은 바꾸지 않고** 보이는 색만 고른다.
 * 판단 근거가 없으면 중립색이다 — 모르는 코드를 «정상» 으로 칠하지 않는다.
 */
function statusTone(code: string): string {
  const upper = code.toUpperCase()
  if (/(APPROVED|DONE|PAID|COMPLETE|SUCCESS|ACTIVE|정상|승인|완료)/.test(upper)) return 'is-ok'
  if (/(REJECT|CANCEL|FAIL|ERROR|반려|취소|실패|오류)/.test(upper)) return 'is-danger'
  if (/(PENDING|REVIEW|WAIT|REQUEST|PREPAR|SHIP|검토|대기|요청|준비|배송)/.test(upper)) return 'is-warn'
  return ''
}

/**
 * 증감 표기 → 색. 코드가 아니라 «오르내림» 으로 읽히게 한다.
 * 판단 근거(부호·화살표)가 없으면 중립이다 — 모르는 값을 상승으로 칠하지 않는다.
 */
function deltaTone(text: string): string {
  const t = text.trim()
  if (/^[+▲△]/.test(t) || /상승|증가/.test(t)) return 'is-up'
  if (/^[-−▼▽]/.test(t) || /하락|감소/.test(t)) return 'is-down'
  return ''
}

/** 여러 줄 카피 — `\n` 을 <br> 로 바꾼다 (escape 뒤에 바꾼다). */
function multiline(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, '<br>')
}

/**
 * 히어로 — 큰 카피 + (placeholder 가 있으면) 통합검색 + 인기어 칩 + 키비주얼 자리.
 * 이미지는 넣지 않는다. 키비주얼 자리는 CSS 도형이다 (V2.no_external_refs).
 */
function renderHero(el: SpecElement, ctx: Ctx): string {
  const hero = el.hero
  if (hero === undefined) return `<div class="control"><p class="static-text is-placeholder">히어로 내용 없음</p></div>`
  const triggered = ctx.spec.actions.filter((a) => a.trigger === el.id)[0]
  const triggerAttrs = triggered ? ` data-action-trigger="${escapeHtml(el.id)}" data-action-id="${escapeHtml(triggered.id)}" data-action-type="${triggered.type}"` : ''
  const eyebrow = hero.eyebrow === undefined ? '' : `<p class="hero-eyebrow">${escapeHtml(hero.eyebrow)}</p>`
  const sub = hero.subcopy === undefined ? '' : `<p class="hero-sub">${multiline(hero.subcopy)}</p>`
  const search =
    hero.search_placeholder === undefined || hero.search_placeholder === ''
      ? ''
      : `<div class="hero-search"><input type="text" id="el-${escapeHtml(el.id)}" ${inputAttrs(el, `placeholder="${escapeHtml(hero.search_placeholder)}"`)}>` +
        `<button type="button" class="btn hero-search-btn"${triggerAttrs}>검색</button></div>`
  const chips =
    hero.chips === undefined || hero.chips.length === 0
      ? ''
      : `<div class="hero-chips"><span class="hero-chips-label">인기</span>${hero.chips.map((c) => `<span class="chip">${escapeHtml(c)}</span>`).join('')}</div>`
  // 자리표시 배지는 **항상** 그린다. visual_note 가 그 자리를 대체하면 모델이 적은 문장이 실제 이미지 설명처럼 읽힌다.
  const visualNote = hero.visual_note === undefined ? '' : `<span class="hero-visual-note">${escapeHtml(hero.visual_note)}</span>`
  const visual = `<div class="hero-visual" aria-hidden="true"><span class="hero-visual-tag">키비주얼 자리 · 이미지 없음</span>${visualNote}</div>`
  return (
    `<div class="control hero-control"><div class="hero">` +
    `<div class="hero-copy">${eyebrow}<p class="hero-headline">${multiline(hero.headline)}</p>${sub}${search}${chips}</div>` +
    `${visual}</div></div>`
  )
}

/** KPI 인포스트립 — 숫자 묶음. 값은 명세에 적힌 예시 값이다 (실제 시세·실적이 아니다). */
function renderStatStrip(el: SpecElement): string {
  const stats = el.stats ?? []
  if (stats.length === 0) return `<div class="control"><p class="static-text is-placeholder">KPI 항목 없음</p></div>`
  const items = stats
    .map((s) => {
      const delta = s.delta === undefined ? '' : `<span class="stat-delta ${deltaTone(s.delta)}">${escapeHtml(s.delta)}</span>`
      const caption = s.caption === undefined ? '' : `<span class="stat-caption">${escapeHtml(s.caption)}</span>`
      return `<div class="stat"><span class="stat-label">${escapeHtml(s.label)}</span><span class="stat-value">${escapeHtml(s.value)}</span>${delta}${caption}</div>`
    })
    .join('')
  return `<div class="control"><div class="stat-strip">${items}</div><p class="static-note">표시값은 명세에 적힌 예시 값 · 실제 데이터 미연결</p></div>`
}

/** 카드 그리드 — 카드 폭에 맞춰 흐른다 (열 수를 명세에 두지 않는다). */
function renderCardGrid(el: SpecElement): string {
  const cards = el.cards ?? []
  if (cards.length === 0) return `<div class="control"><p class="static-text is-placeholder">카드 없음</p></div>`
  const items = cards
    .map((c) => {
      const badge = c.badge === undefined ? '' : `<span class="card-badge">${escapeHtml(c.badge)}</span>`
      const desc = c.desc === undefined ? '' : `<p class="card-desc">${escapeHtml(c.desc)}</p>`
      const meta = c.meta === undefined ? '' : `<span class="card-meta">${escapeHtml(c.meta)}</span>`
      return `<article class="card">${badge}<p class="card-title">${escapeHtml(c.title)}</p>${desc}${meta}</article>`
    })
    .join('')
  // KPI 와 같은 고지 — 카드의 meta 에 날짜가 들어가면 실제 데이터로 오해되기 쉽다.
  return `<div class="control"><div class="card-grid">${items}</div><p class="static-note">카드 내용은 명세에 적힌 예시 값 · 실제 데이터 미연결</p></div>`
}

function renderTable(el: SpecElement, ctx: Ctx): string {
  const columns = el.columns ?? []
  const table = ctx.client.tables.find((t) => t.element_id === el.id)
  const rows = initialRows(ctx, table?.default_sort)
  const head = columns
    .map((c) => {
      // 숫자·금액 열은 머리도 오른쪽으로 (본문 셀과 축을 맞춘다).
      const numClass = isNumericFormat(c.format) ? ' class="num"' : ''
      if (c.sortable) {
        const active = table?.default_sort?.column_id === c.id
        const ariaSort = active ? (table?.default_sort?.direction === 'desc' ? 'descending' : 'ascending') : 'none'
        return `<th data-column-id="${escapeHtml(c.id)}"${numClass} data-sortable="true" aria-sort="${ariaSort}"><button type="button" class="sort-btn" title="정렬(더미)">${escapeHtml(c.label)}<span class="sort-ind"></span></button></th>`
      }
      return `<th data-column-id="${escapeHtml(c.id)}"${numClass}>${escapeHtml(c.label)}</th>`
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
                const cls = `fmt-${fmt}${isNumericFormat(fmt) ? ' num' : ''}${fmt === 'link' ? ' cell-link' : ''}`
                // 상태 코드는 그대로 두면 «CM_PAID» 처럼 읽힌다. 코드는 유지하되 상태로 보이게 감싼다.
                const inner = fmt === 'status' && text !== '' ? `<span class="pill ${statusTone(text)}">${escapeHtml(text)}</span>` : escapeHtml(text)
                return `<td data-column-id="${escapeHtml(c.id)}" class="${cls}">${inner}</td>`
              })
              .join('')
            const clickable = table?.row_action ? ' class="clickable" tabindex="0"' : ''
            return `<tr data-row="${i}"${clickable}>${cells}</tr>`
          })
          .join('')
  return (
    `<div class="table-tools"><span class="row-count" data-row-count-for="${escapeHtml(el.id)}">총 ${rows.length}건</span>` +
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
    case 'hero':
      return renderHero(el, ctx)
    case 'stat-strip':
      return renderStatStrip(el)
    case 'card-grid':
      return renderCardGrid(el)
    case 'text': {
      // 표시값은 더미다. 명세 note 가 있으면 그 문장을, 없으면 자리표시 문구를 보여 준다.
      const placeholder = el.note === undefined || el.note === ''
      return `<div class="control"><p class="static-text${placeholder ? ' is-placeholder' : ''}">${escapeHtml(placeholder ? '표시값(더미)' : el.note)}</p></div>`
    }
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
  // 버튼·링크는 라벨 자체가 컨트롤 안에 있으므로 배지만 앞에 둔다.
  const showLabel = el.type !== 'button' && el.type !== 'link'
  const label =
    `<div class="field-label">${badge('element', el.id, ne.display_no)}` +
    (showLabel ? `<span class="label-text">${escapeHtml(el.label)}</span>${el.required ? '<span class="req" aria-hidden="true">*</span>' : ''}` : '') +
    (locked ? '<span class="lock">잠김</span>' : '') +
    `</div>`
  const trace = el.trace && el.trace.length > 0 ? ` data-criterion-ids="${escapeHtml(el.trace.join(' '))}"` : ''
  return `<div class="field field-${el.type}" ${idAttrs(el.id, ne.section_id, ne.display_no, 'element')} data-element-type="${el.type}"${trace}${locked ? ' data-locked="true"' : ''}>${label}${renderControl(el, ctx)}</div>`
}

function renderSection(ns: NumberedSection, ctx: Ctx): string {
  const s = ns.section
  const locked = ctx.spec.locked_elements.includes(s.id)
  // 요소가 모두 텍스트면 "기본 정보 표"처럼 붙여 쌓는다 (목표 문서의 개요 표 모양).
  const infoOnly = ns.elements.length > 0 && ns.elements.every((e) => e.element.type === 'text')
  const note = s.note !== undefined && s.note !== '' ? `<p class="area-note">${escapeHtml(s.note)}</p>` : ''
  return (
    `<section class="area${infoOnly ? ' area-info' : ''}" ${idAttrs(s.id, s.id, ns.display_no, 'section')}${locked ? ' data-locked="true"' : ''}>` +
    badge('section', s.id, ns.display_no) +
    `<h2 class="area-title">${escapeHtml(s.title)}${locked ? '<span class="lock">잠김</span>' : ''}</h2>` +
    note +
    `<div class="area-body">${ns.elements.map((e) => renderElement(e, ctx)).join('')}</div></section>`
  )
}

/* ---------- 목업(shell 의 screen 영역) ---------- */

function renderMessages(ctx: Ctx): string {
  const initial = ctx.client.states.find((s) => s.id === ctx.client.initial_case)
  const messages = (initial?.message_ids ?? [])
    .map((id) => ctx.spec.messages.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => m !== undefined)
    .map((m) => `<div class="msg msg-${m.kind}" data-message-id="${escapeHtml(m.id)}" role="${m.kind === 'error' ? 'alert' : 'status'}">${escapeHtml(m.text)}</div>`)
    .join('')
  return `<div class="screen-messages" data-messages${messages ? '' : ' hidden'}>${messages}</div>`
}

function renderScreenRegion(ctx: Ctx): string {
  const { spec, input } = ctx
  const sections = ctx.numbering.sections.map((ns) => renderSection(ns, ctx)).join('')
  const status = `<div class="screen-status" data-screen-status><span data-status></span></div>`
  if (ctx.kind === 'popup') {
    const closeAction = spec.actions.find((a) => a.type === 'close-popup' && a.trigger === undefined)
    return (
      `<div class="popup-wrap" data-region="screen">` +
      `<div class="popup-card" role="dialog" aria-labelledby="popup-title">` +
      `<header class="popup-head"><h1 class="popup-title" id="popup-title">${escapeHtml(input.meta.screen_title)}<small>${escapeHtml(spec.screen_id)}</small></h1>` +
      `<button type="button" class="popup-close" data-modal-close="1"${closeAction ? ` data-action-id="${escapeHtml(closeAction.id)}" data-action-type="close-popup"` : ''} aria-label="닫기">닫기</button></header>` +
      `<div class="popup-body">${renderMessages(ctx)}${sections}</div></div>` +
      status +
      `</div>`
    )
  }
  return (
    `<div class="screen-wrap" data-region="screen">` +
    `<div class="phone-status" aria-hidden="true"><span>9:41</span><span>모바일 뷰 · 더미</span></div>` +
    `<header class="screen-head">${renderGnb(ctx)}${renderBreadcrumb(ctx)}</header>` +
    `<div class="body-wrap">` +
    `<div class="screen-title-row"><h1 class="screen-title">${escapeHtml(input.meta.screen_title)}</h1><span class="screen-id">${escapeHtml(spec.screen_id)}</span></div>` +
    renderMessages(ctx) +
    sections +
    `</div>` +
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

/** 설명 항목의 번호 배지 — 화면과 같은 element_index 를 쓴다. */
function itemBadge(item: DescriptionSection['items'][number], ctx: Ctx): string {
  if (item.element_id === undefined || item.display_no === undefined) return ''
  const entry = ctx.numbering.by_id.get(item.element_id)
  return badge(entry?.kind === 'section' ? 'section' : 'element', item.element_id, item.display_no)
}

/** 목표 문서의 .spec 한 줄: 배지 + 굵은 이름 + " — " + 설명. */
function descLine(item: DescriptionSection['items'][number], ctx: Ctx, extra = ''): string {
  return (
    `<div class="desc-item" ${itemAttrs(item, ctx, extra)}>${itemBadge(item, ctx)}` +
    `<b class="desc-label">${escapeHtml(item.label)}</b><span class="desc-sep">—</span>` +
    `<span class="desc-text">${withTraceTags(item.text)}</span></div>`
  )
}

function kicker(title: string): string {
  return `<div class="desc-kicker">${escapeHtml(title)}</div>`
}

function renderDescriptionSection(sec: DescriptionSection, ctx: Ctx): string {
  const open = `<section class="desc-section" data-desc-key="${escapeHtml(sec.key)}">`

  // 1) 화면 ID — 모노스페이스 제목 + 밑줄 + revision·생성 어댑터 꼬리표
  if (sec.key === 'screen_id') {
    const meta = ctx.input.meta
    const tags =
      `<span class="tag" data-revision-label>${escapeHtml(meta.revision_label)}</span>` +
      `<span class="tag" data-generated-by>생성: ${escapeHtml(meta.generated_by)}</span>` +
      `<span class="tag">기준 ${escapeHtml(ctx.spec.baseline_id)}</span>` +
      `<span class="tag">${escapeHtml(ctx.spec.shell)} · ${ctx.spec.device === 'mobile' ? '모바일' : 'PC'}</span>`
    // 이 절의 항목(화면 ID·revision·생성·기준 버전·shell·기기)은 제목과 위 꼬리표로 그대로 나타난다.
    return (
      `<section class="desc-section panel-head" data-desc-key="screen_id">` +
      `<h2 class="desc-screen-id">${escapeHtml(ctx.spec.screen_id)}</h2>` +
      `<div class="panel-meta">${tags}</div></section>`
    )
  }

  // 2) 개요 — 화면명·목적·역할·요구사항 ID 개요 표 (목표 문서 table.info)
  if (sec.key === 'overview') {
    const rows = sec.items
      .map((it) => `<tr class="desc-item" ${itemAttrs(it, ctx, '')}><th scope="row">${escapeHtml(it.label)}</th><td class="desc-text">${withTraceTags(it.text)}</td></tr>`)
      .join('')
    return `${open}<table class="info-table"><tbody>${rows}</tbody></table></section>`
  }

  // 3) CASE — 표
  if (sec.key === 'cases') {
    const rows = sec.items
      .map((it, i) => {
        const kind = ctx.spec.states[i]?.case_kind ?? 'normal'
        return (
          `<tr class="desc-item" ${itemAttrs(it, ctx, `data-case-id="${escapeHtml(it.label)}"`)}>` +
          `<td class="desc-label">${escapeHtml(it.label)}</td><td class="col-kind">${escapeHtml(labelOf(CASE_KIND_LABELS, kind))}</td><td class="desc-text">${withTraceTags(it.text)}</td></tr>`
        )
      })
      .join('')
    return `${open}${kicker(sec.title)}<table class="desc-table"><thead><tr><th>CASE</th><th class="col-kind">종류</th><th>기대 결과</th></tr></thead><tbody>${rows}</tbody></table></section>`
  }

  // 4) 메시지 — 검은 머리 표 (목표 문서 .msg)
  if (sec.key === 'messages') {
    const rows = sec.items
      .map((it, i) => {
        const kind = ctx.spec.messages[i]?.kind
        return (
          `<tr class="desc-item" ${itemAttrs(it, ctx, `data-message-id="${escapeHtml(it.label)}"`)}>` +
          `<td class="desc-label">${escapeHtml(it.label)}</td><td class="col-kind">${escapeHtml(kind === undefined ? '' : labelOf(MESSAGE_KIND_LABELS, kind))}</td><td class="desc-text">${withTraceTags(it.text)}</td></tr>`
        )
      })
      .join('')
    return `${open}${kicker(sec.title)}<table class="msg-table"><thead><tr><th>구분</th><th class="col-kind">종류</th><th>메시지 · 조건</th></tr></thead><tbody>${rows}</tbody></table></section>`
  }

  // 5) 데이터 매핑 — 근거 표
  if (sec.key === 'data_mapping') {
    const rows = sec.items
      .map((it) => `<tr class="desc-item" ${itemAttrs(it, ctx, '')}><td class="desc-label">${itemBadge(it, ctx)}${escapeHtml(it.label)}</td><td class="desc-text">${withTraceTags(it.text)}</td></tr>`)
      .join('')
    return `${open}${kicker(sec.title)}<table class="desc-table"><thead><tr><th>대상</th><th>원본 · 근거</th></tr></thead><tbody>${rows}</tbody></table></section>`
  }

  // 6) 정책 — 파란 왼쪽 막대 강조 상자 (목표 문서 .pol)
  if (sec.key === 'policy') {
    return `${open}${kicker(sec.title)}<div class="desc-policy">${sec.items.map((it) => descLine(it, ctx)).join('')}</div></section>`
  }

  // 7) 영역·필드 — "영역별 디스크립션" 라벨 + 영역 머리(검은 사각 배지) + 요소 한 줄
  if (sec.key === 'sections') {
    const body = sec.items
      .map((it) => {
        const entry = it.element_id !== undefined ? ctx.numbering.by_id.get(it.element_id) : undefined
        if (entry?.kind === 'section') {
          return (
            `<div class="desc-area-head desc-item" ${itemAttrs(it, ctx, '')}>${itemBadge(it, ctx)}` +
            `<span class="desc-label">${escapeHtml(it.label)}</span></div>`
          )
        }
        return descLine(it, ctx)
      })
      .join('')
    return `${open}${kicker(sec.title)}${body}</section>`
  }

  // 8) 처리 흐름 등 나머지 — 한 줄 목록
  return `${open}${kicker(sec.title)}${sec.items.map((it) => descLine(it, ctx)).join('')}</section>`
}

function renderPanel(ctx: Ctx): string {
  const body = ctx.description.sections.map((s) => renderDescriptionSection(s, ctx)).join('')
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
    `<span class="tb-group"><span class="tb-label">기기</span><button type="button" data-device-toggle="desktop">PC</button><button type="button" data-device-toggle="mobile">모바일</button></span>` +
    `<span class="tb-group tb-meta"><span class="tb-label">생성</span><span data-generated-by-toolbar>${escapeHtml(ctx.input.meta.generated_by)}</span> · <span>${escapeHtml(ctx.input.meta.revision_label)}</span></span>` +
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
    `<meta name="con-ai-renderer" content="${escapeHtml(profile.id)}">\n<title>${escapeHtml(title)}</title>\n<style>${STYLES}\n${BRAND_STYLES}\n${themeStyle(themeById(input.meta.theme_id))}</style>\n</head>\n` +
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
