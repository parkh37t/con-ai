import { describe, expect, it } from 'vitest'
import { EXAMPLE_ORDER_LIST_EXTENDED, type ScreenSpecInput } from '@con-ai/schemas'
import { S2B_LEARNED_PROFILE } from '@con-ai/renderer'
import { findExternalRefs, runV2, scanTags, V2_CHECKS } from './v2.js'
import { byId, expectSchemaConform, loadFixtureSpec, renderFixture, statusOf } from './test-helpers.js'

const valid = renderFixture(loadFixtureSpec('valid'))

function replaceOnce(html: string, from: string, to: string): string {
  const i = html.indexOf(from)
  expect(i, `훼손 대상 문자열이 있어야 한다: ${from}`).toBeGreaterThan(-1)
  return html.slice(0, i) + to + html.slice(i + from.length)
}

describe('V2 렌더 구조 검사 — 정상 HTML (설계 §10 V2)', () => {
  it('valid 명세를 렌더한 HTML 은 다섯 검사 모두 pass', () => {
    const results = runV2(valid.html, valid.spec, S2B_LEARNED_PROFILE, { artifact_hash: valid.artifact_hash })
    expect(results.map((r) => r.check_id)).toEqual([...V2_CHECKS])
    expect(statusOf(results)).toEqual({ 'V2.shell': 'pass', 'V2.description_order': 'pass', 'V2.element_ids': 'pass', 'V2.display_numbers': 'pass', 'V2.no_external_refs': 'pass' })
    expect(results.every((r) => r.required && r.stage === 'V2' && r.artifact_hash === valid.artifact_hash)).toBe(true)
    expect(byId(results, 'V2.display_numbers').evidence).toEqual(['search=1', 'query=a', 'period=b', 'status-filter=c', 'search-button=d', 'results=2', 'order-table=a', 'download-button=b', 'pager=c'])
    expect(byId(results, 'V2.description_order').evidence).toEqual(['order=screen_id → overview → cases → flow → policy → data_mapping → sections → messages'])
    expectSchemaConform(results)
  })

  it('팝업 shell 명세는 .popup-shell/.popup-wrap/.spec-side 로 pass', () => {
    const spec: ScreenSpecInput = { ...structuredClone(EXAMPLE_ORDER_LIST_EXTENDED), shell: 'buyer-popup' }
    const popup = renderFixture(spec)
    const results = runV2(popup.html, popup.spec, S2B_LEARNED_PROFILE, { artifact_hash: popup.artifact_hash })
    expect(statusOf(results)).toEqual({ 'V2.shell': 'pass', 'V2.description_order': 'pass', 'V2.element_ids': 'pass', 'V2.display_numbers': 'pass', 'V2.no_external_refs': 'pass' })
    expect(byId(results, 'V2.shell').evidence).toContain('root=.popup-shell')
  })

  it('페이지 명세인데 팝업 shell 로 렌더된 HTML 은 V2.shell fail (설계 §9 shell 을 기계적으로 섞지 않음)', () => {
    const popupSpec: ScreenSpecInput = { ...structuredClone(EXAMPLE_ORDER_LIST_EXTENDED), shell: 'buyer-popup' }
    const popupHtml = renderFixture(popupSpec).html
    const pageSpec = renderFixture(EXAMPLE_ORDER_LIST_EXTENDED).spec
    const shell = byId(runV2(popupHtml, pageSpec, S2B_LEARNED_PROFILE, { artifact_hash: valid.artifact_hash }), 'V2.shell')
    expect(shell.status).toBe('fail')
    expect(shell.evidence).toContain('루트 .root-shell 없음')
    expect(shell.evidence).toContain('페이지 shell 에 다른 shell 의 루트 .popup-shell 가 섞여 있다 (설계 §9)')
  })
})

describe('V2 렌더 구조 검사 — 훼손 HTML', () => {
  const run = (html: string) => runV2(html, valid.spec, S2B_LEARNED_PROFILE, { artifact_hash: valid.artifact_hash })

  it('shell 클래스를 바꾸면 V2.shell fail', () => {
    const results = run(replaceOnce(valid.html, 'class="root-shell"', 'class="root-shel1"'))
    expect(byId(results, 'V2.shell').status).toBe('fail')
    expect(byId(results, 'V2.shell').evidence).toEqual(['루트 .root-shell 없음'])
    const noPanel = run(replaceOnce(valid.html, 'id="right-panel" class="right-panel"', 'id="rp" class="rp"'))
    expect(byId(noPanel, 'V2.shell').evidence).toContain('설명 영역 #right-panel 없음')
    expect(byId(noPanel, 'V2.description_order').status).toBe('fail')
  })

  it('설명 절 순서를 바꾸면 V2.description_order fail', () => {
    const swapped = replaceOnce(replaceOnce(valid.html, 'data-desc-key="cases"', 'data-desc-key="__tmp__"'), 'data-desc-key="flow"', 'data-desc-key="cases"').replace('data-desc-key="__tmp__"', 'data-desc-key="flow"')
    const r = byId(run(swapped), 'V2.description_order')
    expect(r.status).toBe('fail')
    expect(r.evidence).toEqual([
      'expected=screen_id → overview → cases → flow → policy → data_mapping → sections → messages',
      'actual=screen_id → overview → flow → cases → policy → data_mapping → sections → messages',
    ])
    expect(statusOf(run(swapped))['V2.shell']).toBe('pass')
  })

  it('화면에서 요소의 data-element-id 를 지우면 V2.element_ids 와 V2.display_numbers fail', () => {
    const broken = replaceOnce(valid.html, 'data-element-id="period" data-section-id="search" data-display-no="b" data-kind="element"', 'data-section-id="search" data-kind="element"')
    const results = run(broken)
    expect(byId(results, 'V2.element_ids').status).toBe('fail')
    expect(byId(results, 'V2.element_ids').evidence).toEqual(['화면에 element period 의 data-element-id 없음'])
    expect(byId(results, 'V2.display_numbers').status).toBe('fail')
    expect(byId(results, 'V2.display_numbers').evidence).toEqual(['화면 period: 기대 b, 실제 없음'])
  })

  it('화면 배지 번호만 바꾸면 V2.display_numbers fail (설명 번호와 불일치)', () => {
    const wrongAttr = replaceOnce(valid.html, 'data-element-id="query" data-section-id="search" data-display-no="a"', 'data-element-id="query" data-section-id="search" data-display-no="b"')
    const r1 = byId(run(wrongAttr), 'V2.display_numbers')
    expect(r1.status).toBe('fail')
    expect(r1.evidence).toEqual(['화면 query: 기대 a, 실제 b'])
    const wrongBadge = replaceOnce(valid.html, 'data-badge-for="order-table">a</span>', 'data-badge-for="order-table">b</span>')
    const r2 = byId(run(wrongBadge), 'V2.display_numbers')
    expect(r2.status).toBe('fail')
    expect(r2.evidence).toEqual(['배지 order-table: 표시 b, 기대 a'])
    expect(byId(run(wrongBadge), 'V2.element_ids').status).toBe('pass')
  })

  it('명세에 없는 요소가 화면에 있으면 V2.element_ids fail', () => {
    const extra = replaceOnce(valid.html, '<div class="area-body">', '<div class="area-body"><div data-element-id="ghost" data-section-id="search" data-display-no="z"></div>')
    expect(byId(run(extra), 'V2.element_ids').evidence).toEqual(['화면에 명세에 없는 data-element-id ghost'])
  })

  it('외부 CDN·폰트·이미지 참조가 있으면 V2.no_external_refs fail', () => {
    const cdn = valid.html.replace('</head>', '<script src="https://cdn.example.test/lib.js"></script></head>')
    const r = byId(run(cdn), 'V2.no_external_refs')
    expect(r.status).toBe('fail')
    expect(r.evidence.length).toBe(1)
    expect(r.evidence[0]).toContain('cdn.example.test')
    expect(findExternalRefs('<link rel="stylesheet" href="//fonts.example.test/a.css">')).toHaveLength(1)
    expect(findExternalRefs('<style>@import "x.css"</style>')).toHaveLength(1)
    expect(findExternalRefs('<style>.a{background:url(https://img.example.test/a.png)}</style>')).toHaveLength(1)
    expect(findExternalRefs('<a href="#">x</a><img src="data:image/png;base64,AAAA">')).toHaveLength(0)
  })

  it('태그 스캐너는 큰따옴표·작은따옴표·따옴표 없는 속성을 읽는다', () => {
    const tags = scanTags(`<div class="a b" id='x' hidden data-n=3><span data-element-id="q"/></div>`)
    expect(tags.map((t) => t.name)).toEqual(['div', 'span'])
    expect(tags[0]?.attrs).toEqual({ class: 'a b', id: 'x', hidden: '', 'data-n': '3' })
    expect(tags[1]?.attrs).toEqual({ 'data-element-id': 'q' })
  })
})
