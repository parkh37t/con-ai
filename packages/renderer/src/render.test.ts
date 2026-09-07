import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { ElementType, EXAMPLE_ORDER_LIST, EXAMPLE_ORDER_LIST_EXTENDED, EXAMPLE_PORTAL_MAIN, ScreenSpecShape, type ScreenSpecInput } from '@con-ai/schemas'
import { DESCRIPTION_TITLES, buildDescription } from './description.js'
import { buildElementIndex, buildNumbering, toAlpha } from './element-index.js'
import { S2B_LEARNED_PROFILE } from './profile.js'
import { renderScreen } from './render.js'
import { contentTexts } from './content.js'
import { BRAND_THEMES, DEFAULT_BRAND_THEME, isSafeColor, themeStyle } from './theme.js'
import { EXAMPLE_META, at, loadFixtureSpec, renderInputOf } from './test-helpers.js'

function must(v: string | undefined): string {
  if (v === undefined) throw new Error('정규식 그룹이 비어 있다')
  return v
}

/** 지정 영역(화면/설명) 안에서 data-element-id 와 data-display-no 쌍을 모은다. */
function idsIn(html: string, region: 'screen' | 'description'): Array<{ id: string; no: string | undefined }> {
  const start = html.indexOf(`data-region="${region}"`)
  expect(start, `data-region="${region}" 이 있어야 한다`).toBeGreaterThan(-1)
  const end = region === 'screen' ? html.indexOf('data-region="description"') : html.indexOf('</aside>', start)
  const part = html.slice(start, end)
  const out: Array<{ id: string; no: string | undefined }> = []
  const re = /<[a-z][^>]*\bdata-element-id="([^"]+)"[^>]*>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(part)) !== null) {
    const no = /data-display-no="([^"]*)"/.exec(m[0])?.[1]
    out.push({ id: must(m[1]), no })
  }
  return out
}

function descKeys(html: string): string[] {
  return [...html.matchAll(/data-desc-key="([^"]+)"/g)].map((m) => must(m[1]))
}

function inlineScript(html: string): string {
  const m = /<script>([\s\S]*?)<\/script>/.exec(html)
  if (!m || m[1] === undefined) throw new Error('인라인 스크립트가 없다')
  return m[1]
}

function inlineData(html: string): unknown {
  const m = /<script id="con-ai-data" type="application\/json">([\s\S]*?)<\/script>/.exec(html)
  if (!m || m[1] === undefined) throw new Error('인라인 데이터가 없다')
  return JSON.parse(m[1])
}

describe('S2B 학습 규격 프로파일', () => {
  it('shell 클래스·설명 순서·번호 규칙과 프롬프트용 규칙 문장을 갖는다', () => {
    expect(S2B_LEARNED_PROFILE.page_shell).toEqual({ root: 'root-shell', screen: 'screen-wrap', panel: 'right-panel' })
    expect(S2B_LEARNED_PROFILE.popup_shell).toEqual({ root: 'popup-shell', screen: 'popup-wrap', panel: 'spec-side' })
    expect(S2B_LEARNED_PROFILE.description_order).toEqual(['screen_id', 'overview', 'cases', 'flow', 'policy', 'data_mapping', 'sections', 'messages'])
    expect(S2B_LEARNED_PROFILE.rules.length).toBeGreaterThanOrEqual(8)
    const all = S2B_LEARNED_PROFILE.rules.join('\n')
    for (const must of ['.root-shell', '#right-panel', '.popup-shell', '.spec-side', '초기화', 'a, b, c', '실제 업무 API', '오프라인']) expect(all).toContain(must)
  })
})

describe('번호 매기기 (설계 §9: 화면 숫자와 설명 숫자는 같은 데이터에서)', () => {
  it('spec 의 display_no 를 그대로 쓰고, 영역 뒤에 요소가 온다', () => {
    const index = buildElementIndex(renderInputOf(EXAMPLE_ORDER_LIST_EXTENDED).spec, S2B_LEARNED_PROFILE)
    expect(index).toEqual([
      { element_id: 'search', section_id: 'search', display_no: '1' },
      { element_id: 'query', section_id: 'search', display_no: 'a' },
      { element_id: 'period', section_id: 'search', display_no: 'b' },
      { element_id: 'search-button', section_id: 'search', display_no: 'c' },
      { element_id: 'results', section_id: 'results', display_no: '2' },
      { element_id: 'order-table', section_id: 'results', display_no: 'a' },
      { element_id: 'download-button', section_id: 'results', display_no: 'b' },
      { element_id: 'pager', section_id: 'results', display_no: 'c' },
    ])
  })

  it('display_no 가 없으면 영역 1,2,3 / 요소 a,b,c 이며 요소 번호는 영역마다 다시 시작한다 (영역마다 반복되는 a 는 오류가 아님)', () => {
    const index = buildElementIndex(renderInputOf(EXAMPLE_ORDER_LIST).spec, S2B_LEARNED_PROFILE)
    expect(index.map((e) => `${e.element_id}=${e.display_no}`)).toEqual(['search=1', 'query=a', 'results=2', 'order-table=a'])
    expect(index.filter((e) => e.display_no === 'a')).toHaveLength(2)
  })

  it('알파벳 번호는 z 다음 aa 로 이어진다', () => {
    expect([0, 1, 25, 26, 27].map(toAlpha)).toEqual(['a', 'b', 'z', 'aa', 'ab'])
  })
})

describe('renderScreen — 확장 예시 (EXAMPLE_ORDER_LIST_EXTENDED)', () => {
  const input = renderInputOf(EXAMPLE_ORDER_LIST_EXTENDED)
  const out = renderScreen(input)
  const { html } = out

  it('페이지 shell: .root-shell > .screen-wrap + #right-panel (팝업 shell 클래스는 없음)', () => {
    expect(html).toMatch(/<div class="root-shell"/)
    expect(html).toMatch(/<div class="screen-wrap"/)
    expect(html).toMatch(/<aside id="right-panel"/)
    expect(html.indexOf('class="root-shell"')).toBeLessThan(html.indexOf('class="screen-wrap"'))
    expect(html.indexOf('class="screen-wrap"')).toBeLessThan(html.indexOf('id="right-panel"'))
    expect(html).not.toMatch(/class="popup-shell"|class="popup-wrap"|class="spec-side"/)
  })

  it('모든 영역·요소 id 가 화면과 설명 양쪽에 data-element-id 로 있다', () => {
    const expected = input.spec.sections.flatMap((s) => [s.id, ...s.elements.map((e) => e.id)])
    const screen = new Set(idsIn(html, 'screen').map((x) => x.id))
    const desc = new Set(idsIn(html, 'description').map((x) => x.id))
    for (const id of expected) {
      expect(screen.has(id), `화면에 ${id}`).toBe(true)
      expect(desc.has(id), `설명에 ${id}`).toBe(true)
    }
    expect([...screen].sort()).toEqual([...expected].sort())
  })

  it('설명 절 순서가 프로파일 description_order 와 같다 (모델·HTML 모두)', () => {
    expect(out.description.sections.map((s) => s.key)).toEqual(S2B_LEARNED_PROFILE.description_order)
    expect(descKeys(html)).toEqual(S2B_LEARNED_PROFILE.description_order)
  })

  it('화면 배지·data-display-no 와 설명 번호가 element_index 와 일치한다', () => {
    const screen = idsIn(html, 'screen')
    const desc = idsIn(html, 'description')
    for (const entry of out.element_index) {
      const s = screen.filter((x) => x.id === entry.element_id)
      expect(s.length, `화면 ${entry.element_id}`).toBe(1)
      expect(at(s, 0).no).toBe(entry.display_no)
      const d = desc.filter((x) => x.id === entry.element_id)
      expect(d.length, `설명 ${entry.element_id}`).toBeGreaterThanOrEqual(1)
      for (const x of d) expect(x.no).toBe(entry.display_no)
      // 배지 텍스트
      expect(html).toContain(`data-badge-for="${entry.element_id}">${entry.display_no}</span>`)
    }
  })

  it('설명 모델의 영역·필드 절이 element_index 와 같은 순서·번호다', () => {
    const sec = out.description.sections.find((s) => s.key === 'sections')
    expect(sec).toBeDefined()
    expect(sec?.items.map((i) => ({ element_id: i.element_id, display_no: i.display_no }))).toEqual(
      out.element_index.map((e) => ({ element_id: e.element_id, display_no: e.display_no })),
    )
    // 라벨은 명세의 영역 제목·요소 라벨 그대로다. 번호는 display_no 하나에서만 나오고 라벨에 박아 넣지 않는다.
    expect(at(sec?.items, 1).label).toBe('검색어')
    expect(sec?.items.map((i) => i.label)).toEqual(input.spec.sections.flatMap((s) => [s.title, ...s.elements.map((e) => e.label)]))
    for (const item of sec?.items ?? []) expect(item.label, `라벨에 번호를 박아 넣지 않는다: ${item.label}`).not.toMatch(/^(\d+|[a-z]+)\.\s/)
    expect(at(sec?.items, 1).text).toContain('수용조건: EXAMPLE-AC-01')
    expect(at(sec?.items, 5).text).toContain('잠긴 요소')
  })

  it('설명 패널이 목표 문서 구조를 따른다: 모노스페이스 화면 ID → 개요 표 → 절 라벨 → 영역 머리·요소 줄 → 검은 머리 메시지 표', () => {
    const panel = html.slice(html.indexOf('data-region="description"'))
    expect(panel).toContain('<h2 class="desc-screen-id">EXAMPLE-order-list</h2>')
    // 개요는 표로(화면명·목적·역할·REQ), CASE·데이터 매핑도 표, 메시지는 검은 머리 표
    expect(panel).toMatch(/<section class="desc-section" data-desc-key="overview"><table class="info-table">/)
    expect(panel).toMatch(/data-desc-key="cases">[\s\S]*?<table class="desc-table">/)
    expect(panel).toMatch(/data-desc-key="messages">[\s\S]*?<table class="msg-table">/)
    // 절 라벨은 DESCRIPTION_TITLES 를 쓴다 (영역·필드 절은 목표 문서 표기인 "영역별 디스크립션")
    expect(panel).toContain('<div class="desc-kicker">영역별 디스크립션</div>')
    expect(DESCRIPTION_TITLES.sections).toBe('영역별 디스크립션')
    // 영역은 검은 사각 배지가 붙은 머리로, 요소는 파란 원형 배지 + 굵은 이름 + " — " + 설명 한 줄로
    expect(panel).toMatch(/<div class="desc-area-head desc-item"[^>]*data-element-id="search"[^>]*><span class="badge badge-section" data-badge-for="search">1<\/span><span class="desc-label">검색<\/span><\/div>/)
    expect(panel).toMatch(
      /<div class="desc-item"[^>]*data-element-id="query"[^>]*data-display-no="a"[^>]*><span class="badge badge-element" data-badge-for="query">a<\/span><b class="desc-label">검색어<\/b><span class="desc-sep">—<\/span>/,
    )
  })

  it('설명 패널의 번호 배지도 화면 배지와 같은 element_index 를 쓴다', () => {
    const panel = html.slice(html.indexOf('data-region="description"'))
    const badges = [...panel.matchAll(/<span class="badge badge-(section|element)" data-badge-for="([^"]+)">([^<]*)<\/span>/g)]
    expect(badges.length).toBeGreaterThanOrEqual(out.element_index.length)
    for (const m of badges) {
      const entry = out.element_index.find((e) => e.element_id === m[2])
      expect(entry, `설명 배지 ${m[2]} 는 element_index 에 있어야 한다`).toBeDefined()
      expect(m[3], `설명 배지 ${m[2]}`).toBe(entry?.display_no)
      expect(m[1]).toBe(entry?.element_id === entry?.section_id ? 'section' : 'element')
    }
  })

  it('목업 머리에 GNB(로고·메뉴·활성 밑줄·유틸)와 breadcrumb 를 두고 메타로 덮어쓸 수 있다', () => {
    expect(html).toMatch(/<nav class="gnb" aria-label="GNB"><span class="logo">구매 포털<\/span>/)
    expect(html).toContain('<span class="m on">주문</span>')
    expect(html).toContain('<span>통합검색 ⌕</span>')
    expect(html).toMatch(/<div class="breadcrumb" aria-label="breadcrumb">홈 › 주문 › <b>주문 목록<\/b><\/div>/)
    const custom = renderScreen(renderInputOf(EXAMPLE_ORDER_LIST_EXTENDED, { meta: { ...EXAMPLE_META, portal_name: '조달 포털', menus: [{ label: '입찰' }, { label: '계약', active: true }] } }))
    expect(custom.html).toContain('<span class="logo">조달 포털</span>')
    expect(custom.html).toContain('<span class="m">입찰</span><span class="m on">계약</span>')
    expect(custom.html).not.toContain('구매 포털')
  })

  it('외부 URL·CDN·폰트 참조가 없다 (오프라인 단일 파일)', () => {
    expect(html).not.toMatch(/https?:\/\//i)
    expect(html.toLowerCase()).not.toContain('http')
    expect(html).not.toMatch(/<link\b/)
    expect(html).not.toMatch(/@import|@font-face|url\(/)
    expect(html).not.toMatch(/<img\b/)
  })

  it('설명 머리에 화면 ID·revision·생성 어댑터를 표시하고 REQ·수용조건 ID 를 적는다', () => {
    expect(html).toContain('<h2 class="desc-screen-id">EXAMPLE-order-list</h2>')
    expect(html).toContain('data-revision-label>rev 1 (초안)<')
    expect(html).toContain('생성: 더미 어댑터(fixture)')
    const overview = out.description.sections.find((s) => s.key === 'overview')
    expect(overview?.items.map((i) => i.label)).toEqual(['화면명', '목적', '역할', 'EXAMPLE-REQ-001', 'EXAMPLE-REQ-002'])
    expect(at(overview?.items, 3).text).toBe('주문 목록 조회 — 수용조건: EXAMPLE-AC-01, EXAMPLE-AC-02')
  })

  it('CASE 표·처리 흐름·정책·데이터 매핑·메시지 표를 명세에서 만든다', () => {
    const byKey = Object.fromEntries(out.description.sections.map((s) => [s.key, s]))
    expect(byKey.cases?.items.map((i) => i.label)).toEqual(['normal', 'searched', 'empty', 'error'])
    expect(at(byKey.cases?.items, 2).text).toContain('메시지: msg-empty')
    expect(byKey.flow?.items.map((i) => i.label)).toEqual(['search-submit', 'sort-orders', 'download-orders', 'open-order-detail', 'show-error'])
    expect(at(byKey.flow?.items, 3).text).toContain('대상 화면: EXAMPLE-order-detail-popup')
    expect(at(byKey.flow?.items, 2).text).toContain('잠긴 동작')
    expect(byKey.policy?.items.map((i) => i.label)).toEqual(['검색어', '잠긴 요소', '잠긴 동작', '미확정(질문)'])
    expect(at(byKey.policy?.items, 0)).toMatchObject({ element_id: 'query', display_no: 'a' })
    expect(at(byKey.policy?.items, 0).text).toBe('최대 글자수=50 → msg-query-too-long')
    expect(byKey.data_mapping?.items.map((i) => i.label)).toEqual(['order-table.order_no', 'order-table.status'])
    expect(byKey.messages?.items.map((i) => i.label)).toEqual(['msg-empty', 'msg-error', 'msg-query-too-long'])
    expect(html).toMatch(/<tr class="desc-item"[^>]*data-case-id="empty"/)
    expect(html).toMatch(/<tr class="desc-item"[^>]*data-message-id="msg-error"/)
  })

  it('툴바에 CASE 버튼(data-case)과 PC/모바일 토글이 있고 body 에 동작 종류를 적는다', () => {
    for (const id of ['normal', 'searched', 'empty', 'error']) expect(html).toContain(`data-case="${id}"`)
    expect(html).toContain('data-device-toggle="mobile"')
    expect(html).toMatch(/<body[^>]*data-action-types="filter-fixture sort-fixture download-fixture open-popup set-state"/)
    expect(html).toMatch(/<body[^>]*data-case="normal"/)
  })

  it('인라인 스크립트는 문법 오류 없이 컴파일되고 인라인 데이터는 JSON 으로 읽힌다', () => {
    expect(() => new vm.Script(inlineScript(html))).not.toThrow()
    const data = inlineData(html) as { initial_case: string; tables: Array<{ element_id: string; row_action?: string }>; actions: Array<{ id: string; inputs: string[]; tables: string[] }> }
    expect(data.initial_case).toBe('normal')
    expect(at(data.tables, 0)).toMatchObject({ element_id: 'order-table', row_action: 'open-order-detail' })
    expect(at(data.actions, 0)).toMatchObject({ id: 'search-submit', inputs: ['query', 'period'], tables: ['order-table'] })
    expect(html).not.toContain('</script>' + '"')
  })
})

describe('renderScreen — fixtures/screen-specs/example-order-list.valid.json', () => {
  const input = renderInputOf(loadFixtureSpec('valid'))
  const out = renderScreen(input)
  const { html } = out

  it('영역 2개·요소 7개가 번호 1/a,b,c,d 와 2/a,b,c 로 화면·설명에 들어간다', () => {
    expect(out.element_index.map((e) => e.display_no)).toEqual(['1', 'a', 'b', 'c', 'd', '2', 'a', 'b', 'c'])
    const screen = idsIn(html, 'screen')
    expect(screen.map((x) => `${x.id}=${x.no}`)).toEqual(out.element_index.map((e) => `${e.element_id}=${e.display_no}`))
    expect(descKeys(html)).toEqual(S2B_LEARNED_PROFILE.description_order)
  })

  it('표는 명세 컬럼과 정상 CASE 더미데이터로 기본 정렬(주문일 내림차순)해 채운다', () => {
    expect(html).toMatch(/<th data-column-id="order_no" data-sortable="true" aria-sort="none">/)
    expect(html).toMatch(/<th data-column-id="ordered_at" data-sortable="true" aria-sort="descending">/)
    expect(html).toMatch(/<th data-column-id="supplier_name">공급업체<\/th>/)
    const rows = [...html.matchAll(/<tr data-row="\d+"[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => must(m[1]))
    expect(rows).toHaveLength(3)
    expect(at(rows, 0)).toContain('EX-2026-0003')
    expect(at(rows, 2)).toContain('EX-2026-0001')
    // 금액 열은 자릿수를 맞춰 오른쪽으로 붙인다 (num).
    expect(at(rows, 0)).toContain('<td data-column-id="amount" class="fmt-currency num">1,250,000</td>')
    expect(html).toContain('data-row-count-for="order-table">총 3건</span>')
  })

  it('컴포넌트별 렌더: 텍스트 입력·기간·선택 목록·버튼(동작 연결)·표·페이지 이동', () => {
    expect(html).toMatch(/<input type="text" id="el-query" data-input-for="query" data-input-type="text-input" name="query" placeholder="주문번호 입력" maxlength="20">/)
    expect(html).toMatch(/data-input-for="period" data-input-type="date-range" name="period" data-range="from"/)
    expect(html).toMatch(/<select id="el-status-filter"[^>]*>(<option value="[^"]*">[^<]*<\/option>){4}<\/select>/)
    expect(html).toMatch(/<button type="button" class="btn" id="el-search-button" data-action-trigger="search-button" data-action-id="search-submit" data-action-type="filter-fixture">검색<\/button>/)
    expect(html).toMatch(/id="el-download-button" data-action-trigger="download-button" data-action-id="download-orders" data-action-type="download-fixture"/)
    expect(html).toMatch(/<nav class="pager" aria-label="페이지">/)
    expect(html).toContain('data-row-action="open-order-detail"')
    // 검색 영역에 초기화 버튼 없음 (프로파일 규칙)
    const search = html.slice(html.indexOf('data-element-id="search"'), html.indexOf('data-element-id="results"'))
    expect(search).not.toMatch(/초기화|reset/i)
  })

  it('요소 설명 항목에 수용조건 trace 를 표시한다', () => {
    expect(html).toMatch(/<span class="trace" data-criterion-id="EXAMPLE-AC-04">EXAMPLE-AC-04<\/span>/)
    expect(html).toMatch(/data-element-id="download-button"[^>]*data-criterion-ids="EXAMPLE-AC-04"/)
  })

  it('description 모델과 element_index 의 항목 수·순서가 같다', () => {
    const sec = out.description.sections.find((s) => s.key === 'sections')
    expect(sec?.items.map((i) => i.element_id)).toEqual(out.element_index.map((e) => e.element_id))
    expect(buildDescription(input, buildNumbering(input.spec, input.profile))).toEqual(out.description)
  })
})

describe('renderScreen — 팝업 shell·모바일·이스케이프·컴포넌트 전체', () => {
  it('팝업 shell 은 .popup-shell > .popup-wrap + .spec-side 를 쓰고 GNB·breadcrumb 를 복사하지 않는다', () => {
    const spec: ScreenSpecInput = { ...structuredClone(EXAMPLE_ORDER_LIST_EXTENDED), screen_id: 'EXAMPLE-order-detail-popup', shell: 'buyer-popup' }
    const out = renderScreen(renderInputOf(spec, { meta: { ...EXAMPLE_META, screen_title: '주문 상세' } }))
    expect(out.html).toMatch(/<div class="popup-shell"/)
    expect(out.html).toMatch(/<div class="popup-wrap"/)
    expect(out.html).toMatch(/<aside class="spec-side" id="spec-side"/)
    expect(out.html).not.toContain('class="root-shell"')
    expect(out.html).not.toContain('class="screen-wrap"')
    expect(out.html).not.toContain('id="right-panel"')
    expect(out.html).not.toContain('class="gnb"')
    expect(out.html).not.toContain('class="breadcrumb"')
    expect(out.html).toMatch(/<body[^>]*data-shell-kind="popup"/)
    expect(descKeys(out.html)).toEqual(S2B_LEARNED_PROFILE.description_order)
    expect(idsIn(out.html, 'screen').map((x) => x.id)).toEqual(out.element_index.map((e) => e.element_id))
  })

  it('모바일 명세는 루트에 data-device="mobile" 을 두고 목업을 420px 폰 프레임에 넣는다', () => {
    const spec: ScreenSpecInput = { ...structuredClone(EXAMPLE_ORDER_LIST_EXTENDED), device: 'mobile' }
    const { html } = renderScreen(renderInputOf(spec))
    expect(html).toMatch(/<div class="root-shell" data-shell-root data-device="mobile">/)
    // 폰 프레임: 목업 열의 폭을 420px 로 묶고 검은 테두리·둥근 모서리를 준다 (목표 모바일 문서의 .phone)
    const frame = /\.root-shell\[data-device="mobile"\] \.screen-wrap\{[^}]*\}/.exec(html)?.[0] ?? ''
    expect(frame).toContain('max-width:420px')
    expect(frame).toMatch(/border:9px solid var\(--ink\)/)
    expect(frame).toMatch(/border-radius:34px/)
    // 상태 표시줄·햄버거는 마크업에 늘 있고 모바일에서만 보인다 (기기 토글로도 같은 모양이 된다)
    expect(html).toContain('<div class="phone-status" aria-hidden="true">')
    expect(html).toContain('data-gnb-toggle')
    expect(html).toContain('[data-device="mobile"] .phone-status{display:flex')
    expect(html).toContain('모바일')
  })

  it('명세 문자열은 HTML 이스케이프되고 인라인 JSON 은 </script> 를 만들지 않는다', () => {
    const spec = structuredClone(EXAMPLE_ORDER_LIST_EXTENDED)
    at(at(spec.sections, 0).elements, 0).label = '<b>검색어</b> & "따옴표"'
    const dummy = { 'orders-normal': [{ order_no: '</script><script>alert(1)</script>', ordered_at: '2026-09-01', status: 'x' }] }
    const { html } = renderScreen(renderInputOf(spec, { dummy }))
    expect(html).toContain('&lt;b&gt;검색어&lt;/b&gt; &amp; &quot;따옴표&quot;')
    expect(html).not.toContain('<b>검색어</b>')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html.match(/<\/script>/g)).toHaveLength(2)
  })

  it('허용 컴포넌트를 하나도 빠짐없이 렌더한다 (목록은 ElementType.options 에서 온다)', () => {
    // 손으로 적은 배열을 쓰면 enum 이 늘어도 초록불이 유지된다. 목록을 스키마에서 가져와 «모두» 를 참말로 만든다.
    const types = ElementType.options
    const spec: ScreenSpecInput = {
      schema_version: '1.0',
      screen_id: 'EXAMPLE-all-types',
      baseline_id: 'example-baseline-1',
      purpose: '컴포넌트 전체 렌더 확인',
      shell: 'admin-page',
      device: 'desktop',
      requirements: [{ id: 'EXAMPLE-REQ-009', criterion_ids: ['EXAMPLE-AC-09'] }],
      sections: [
        {
          id: 'all',
          title: '전체',
          elements: types.map((type) => {
            const base = { id: `el-${type}`, type, label: `라벨 ${type}` }
            if (type === 'select' || type === 'radio' || type === 'checkbox') return { ...base, options: [{ value: 'v1', label: '값1' }, { value: 'v2', label: '값2' }] }
            if (type === 'table') return { ...base, columns: [{ id: 'c1', label: '컬럼1' }], trace: ['EXAMPLE-AC-09'] }
            if (type === 'hero') return { ...base, hero: { headline: `카피 ${type}`, search_placeholder: '검색어' } }
            if (type === 'stat-strip') return { ...base, stats: [{ label: '지표', value: '1건' }] }
            if (type === 'card-grid') return { ...base, cards: [{ title: '카드1' }] }
            return base
          }),
        },
      ],
      actions: [],
      states: [{ id: 'normal', fixture_id: 'fx-normal', expected: '정상' }],
      unresolved: [],
    }
    const { html, element_index } = renderScreen(renderInputOf(spec, { dummy: { 'fx-normal': [{ c1: 'x' }, 'plain-row'] } }))
    for (const type of types) expect(html, type).toContain(`class="field field-${type}"`)
    expect(element_index.map((e) => e.display_no)).toEqual(['1', ...types.map((_, i) => toAlpha(i))])
    expect(html).toMatch(/<textarea id="el-el-textarea"/)
    expect(html).toMatch(/<input type="radio" value="v1"/)
    expect(html).toMatch(/<a href="#" class="link" data-link="1"/)
    // text 요소: 라벨은 필드 라벨로, 표시값은 note 가 있으면 note, 없으면 더미 자리표시 문구
    expect(html).toContain('<p class="static-text is-placeholder">표시값(더미)</p>')
    expect(html).toContain('<span class="label-text">라벨 text</span>')
    expect(html).toContain('<td data-column-id="c1" class="fmt-text">x</td>')
    expect(html).toContain('<td data-column-id="c1" class="fmt-text"></td>')
    expect(() => new vm.Script(inlineScript(html))).not.toThrow()
  })

  it('더미데이터가 없는 fixture 는 빈 표로 렌더한다 (오류 아님)', () => {
    const { html } = renderScreen(renderInputOf(EXAMPLE_ORDER_LIST_EXTENDED, { dummy: {} }))
    expect(html).toContain('표시할 행이 없습니다')
    expect(html).toContain('data-row-count-for="order-table">총 0건</span>')
  })
})

/**
 * 브랜드 테마 — 목업이 «설계용 와이어프레임» 이 아니라 실제 화면으로 보이게 하는 층.
 * 외부 자원을 끌어오지 않는지, 모르는 값이 스타일에 새어 들어오지 않는지를 본다.
 */
describe('브랜드 테마', () => {
  const themed = (theme_id: string | undefined): string =>
    renderScreen(
      renderInputOf(EXAMPLE_ORDER_LIST_EXTENDED, { meta: { ...EXAMPLE_META, ...(theme_id === undefined ? {} : { theme_id }) } }),
    ).html

  it('테마 id 를 주면 그 브랜드 색이 CSS 변수로 들어간다', () => {
    const banking = themed('banking')
    expect(banking).toContain(`--brand:${BRAND_THEMES['banking']?.primary}`)
    expect(banking).toContain(`--brand-top:${BRAND_THEMES['banking']?.top_bar}`)
  })

  it('테마를 주지 않거나 모르는 id 면 기본 테마다 — 없는 브랜드를 지어내지 않는다', () => {
    for (const html of [themed(undefined), themed('없는브랜드')]) {
      expect(html).toContain(`--brand:${DEFAULT_BRAND_THEME.primary}`)
    }
  })

  it('색 형식이 아닌 값은 스타일에 넣지 않는다 (주입 차단)', () => {
    expect(isSafeColor('#0c2071')).toBe(true)
    expect(isSafeColor('#abc')).toBe(true)
    expect(isSafeColor('red;}body{display:none')).toBe(false)
    const style = themeStyle({ ...DEFAULT_BRAND_THEME, primary: 'red;}body{display:none' })
    expect(style).not.toContain('display:none')
    expect(style).toContain(`--brand:${DEFAULT_BRAND_THEME.primary}`)
  })

  it('브랜드 층도 외부 자원을 끌어오지 않는다 (V2.no_external_refs)', () => {
    const html = themed('banking')
    expect(html).not.toMatch(/@import|url\(|<link|https?:\/\//)
  })

  it('상태 열은 코드를 그대로 두고 pill 로 감싼다 — 코드 문자열을 바꾸지 않는다', () => {
    const html = themed('commerce')
    expect(html).toMatch(/<span class="pill is-\w+">[A-Z_]+<\/span>/)
    // 클라이언트가 CASE 를 바꿔 다시 그릴 때도 같은 규칙을 쓴다 (한쪽만 고치면 색이 달라진다).
    expect(html).toContain("pill.className = 'pill ' + statusTone(text)")
  })
})

describe('내용 표현 3종 — 히어로 · KPI 인포스트립 · 카드 그리드', () => {
  const mainInput = () => renderInputOf(EXAMPLE_PORTAL_MAIN, { meta: { ...EXAMPLE_META, screen_title: '포털 메인', theme_id: 'partner' } })

  it('히어로는 머리말·큰 카피·보조 문장·검색·인기어 칩·키비주얼 자리를 그린다', () => {
    const { html } = renderScreen(mainInput())
    expect(html).toContain('class="hero-eyebrow">EXAMPLE PORTAL<')
    // 줄바꿈은 <br> 로 나뉜다 (문자열 그대로 넣지 않는다).
    expect(html).toMatch(/<p class="hero-headline">필요한 것을<br>한 곳에서<\/p>/)
    expect(html).toContain('class="hero-sub">')
    expect(html).toContain('placeholder="무엇을 찾으시나요? (더미 검색)"')
    expect(html).toContain('<span class="chip">공지사항</span>')
    expect(html).toContain('class="hero-visual"')
  })

  it('KPI 인포스트립은 값·증감·설명을 그리고 증감 부호로 색을 고른다', () => {
    const { html } = renderScreen(mainInput())
    expect(html).toContain('class="stat-value">128건<')
    expect(html).toContain('<span class="stat-delta is-up">+12</span>')
    expect(html).toContain('<span class="stat-delta is-down">-1건</span>')
    // 부호가 없으면 중립이다 — 모르는 값을 상승으로 칠하지 않는다.
    expect(html).not.toContain('<span class="stat-delta is-up">1.4일')
    expect(html).toContain('표시값은 명세에 적힌 예시 값 · 실제 데이터 미연결')
  })

  it('카드 그리드는 배지·제목·본문·보조 정보를 그리고 열 수를 명세에 두지 않는다', () => {
    const { html } = renderScreen(mainInput())
    expect(html).toContain('<span class="card-badge">자주 씀</span>')
    expect(html).toContain('class="card-title">주문 조회<')
    expect(html).toContain('class="card-desc">기간·상태로 주문을 찾는다.<')
    expect(html).toContain('class="card-meta">2026.09.01<')
    expect(html).toContain('카드 내용은 명세에 적힌 예시 값 · 실제 데이터 미연결')
    // 열 수는 CSS 가 정한다 (명세에 grid_columns 같은 키를 두지 않는다).
    expect(html).toContain('.card-grid{display:grid;grid-template-columns:repeat(auto-fill')
  })

  it('명세의 내용이 우측 설명에도 한 조각도 빠지지 않고 옮겨진다 (명세가 UI 와 설명의 공통 원본)', () => {
    const input = mainInput()
    const numbering = buildNumbering(input.spec, input.profile)
    const description = buildDescription(input, numbering)
    const descText = description.sections.flatMap((s) => s.items.map((i) => `${i.label} ${i.text}`)).join('\n')
    const oneLine = (t: string) => t.replace(/\r?\n/g, ' ')
    for (const el of input.spec.sections.flatMap((s) => s.elements)) {
      for (const text of contentTexts(el)) expect(oneLine(descText), `${el.id}: ${text}`).toContain(oneLine(text))
    }
  })

  it('내용 표현 3종을 써도 외부 자원을 끌어오지 않는다 (V2.no_external_refs)', () => {
    const { html } = renderScreen(mainInput())
    expect(html).not.toMatch(/@import|url\(|<link|https?:\/\//)
  })

  it('CASE 를 바꿔도 히어로·KPI·카드는 지워지지 않는다 (클라이언트는 표 본문만 다시 그린다)', () => {
    const { html } = renderScreen(mainInput())
    // 클라이언트 스크립트가 다시 그리는 대상은 표 본문뿐이다 — 여기가 늘어나면 이 단언이 먼저 깨진다.
    expect(html).toContain('data-tbody-for=')
    expect(html).not.toContain("qs('.hero').innerHTML")
    for (const marker of ['class="hero"', 'class="stat-strip"', 'class="card-grid"']) expect(html).toContain(marker)
  })

  it('내용 없는 hero·stat-strip·card-grid 는 스키마가 막는다 (빈 상자를 만들지 않는다)', () => {
    const broken = structuredClone(EXAMPLE_PORTAL_MAIN) as { sections: Array<{ elements: Array<Record<string, unknown>> }> }
    delete at(at(broken.sections, 0).elements, 0)['hero']
    expect(ScreenSpecShape.safeParse(broken).success).toBe(false)
  })
})
