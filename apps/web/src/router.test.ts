import { describe, expect, it } from 'vitest'
import { hrefTo, hrefToAsisDetail, hrefToDesign, hrefToScreen, parseRoute, withQuery } from './router.js'

describe('ID 매핑 라우트 (#/trace)', () => {
  it('`#/trace` 는 ID 매핑 화면이다', () => {
    expect(parseRoute('#/trace')).toEqual({ name: 'trace', query: {} })
    expect(parseRoute('#/trace/')).toEqual({ name: 'trace', query: {} })
    expect(parseRoute('#/trace?project=p1')).toEqual({ name: 'trace', query: { project: 'p1' } })
  })

  it('하위 경로는 없다', () => {
    expect(parseRoute('#/trace/x')).toEqual({ name: 'not_found', path: '/trace/x', query: {} })
  })

  it('링크와 쿼리 보존', () => {
    expect(hrefTo('trace')).toBe('#/trace')
    expect(hrefTo('trace', { project: 'p1' })).toBe('#/trace?project=p1')
    expect(withQuery({ name: 'trace', query: { project: 'p1' } }, { project: 'p2' })).toBe('#/trace?project=p2')
  })
})

describe('parseRoute — 해시 라우팅', () => {
  it('빈 해시·`#`·`#/` 는 메인 화면이다', () => {
    expect(parseRoute('')).toEqual({ name: 'main', query: {} })
    expect(parseRoute('#')).toEqual({ name: 'main', query: {} })
    expect(parseRoute('#/')).toEqual({ name: 'main', query: {} })
  })

  it('`#/new` 는 만들기 화면이다 (메인과 구분한다)', () => {
    expect(parseRoute('#/new')).toEqual({ name: 'create', query: {} })
    expect(parseRoute('#/new/')).toEqual({ name: 'create', query: {} })
    expect(parseRoute('#/new?job=j1')).toEqual({ name: 'create', query: { job: 'j1' } })
    expect(parseRoute('#/new/extra')).toEqual({ name: 'not_found', path: '/new/extra', query: {} })
  })

  it('설계서 결과(`#/d/:revisionId`)와 고급 화면(`#/advanced`)', () => {
    expect(parseRoute('#/d/rev-1')).toEqual({ name: 'design', revisionId: 'rev-1', query: {} })
    expect(parseRoute('#/d/rev%201?job=j1')).toEqual({ name: 'design', revisionId: 'rev 1', query: { job: 'j1' } })
    expect(parseRoute('#/d/')).toEqual({ name: 'not_found', path: '/d/', query: {} })
    expect(parseRoute('#/d/rev-1/extra')).toEqual({ name: 'not_found', path: '/d/rev-1/extra', query: {} })
    expect(parseRoute('#/advanced')).toEqual({ name: 'advanced', query: {} })
    expect(parseRoute('#/advanced?project=p1')).toEqual({ name: 'advanced', query: { project: 'p1' } })
  })

  it('레퍼런스 포트폴리오', () => {
    expect(parseRoute('#/references')).toEqual({ name: 'references', query: {} })
    expect(parseRoute('#/references/')).toEqual({ name: 'references', query: {} })
  })

  it('AS-IS 분석 — 목록·상세 (계약 §12)', () => {
    expect(parseRoute('#/asis')).toEqual({ name: 'asis', query: {} })
    expect(parseRoute('#/asis/')).toEqual({ name: 'asis', query: {} })
    expect(parseRoute('#/asis?project=p1')).toEqual({ name: 'asis', query: { project: 'p1' } })
    expect(parseRoute('#/asis/an-1')).toEqual({ name: 'asis_detail', analysisId: 'an-1', query: {} })
    expect(parseRoute('#/asis/an%201?tab=x')).toEqual({ name: 'asis_detail', analysisId: 'an 1', query: { tab: 'x' } })
    expect(parseRoute('#/asis/an-1/extra')).toEqual({ name: 'not_found', path: '/asis/an-1/extra', query: {} })
  })

  it('화면 경로 — generate / review / approve 와 화면 id', () => {
    expect(parseRoute('#/screens/abc-123/generate')).toEqual({ name: 'generate', screenId: 'abc-123', query: {} })
    expect(parseRoute('#/screens/abc-123/review')).toEqual({ name: 'review', screenId: 'abc-123', query: {} })
    expect(parseRoute('#/screens/abc-123/approve')).toEqual({ name: 'approve', screenId: 'abc-123', query: {} })
  })

  it('쿼리는 해시 뒤의 `?` 로 읽고 URL 디코딩한다', () => {
    expect(parseRoute('#/screens/s1/review?rev=r-2&job=j%2F9')).toEqual({ name: 'review', screenId: 's1', query: { rev: 'r-2', job: 'j/9' } })
    expect(parseRoute('#/?project=p1')).toEqual({ name: 'main', query: { project: 'p1' } })
    expect(parseRoute('#/screens/s1/generate?job=')).toEqual({ name: 'generate', screenId: 's1', query: { job: '' } })
  })

  it('화면 id 는 디코딩한다', () => {
    expect(parseRoute('#/screens/a%20b/generate')).toEqual({ name: 'generate', screenId: 'a b', query: {} })
  })

  it('알 수 없는 경로는 not_found (경로 보존)', () => {
    expect(parseRoute('#/nowhere')).toEqual({ name: 'not_found', path: '/nowhere', query: {} })
    expect(parseRoute('#/screens/s1')).toEqual({ name: 'not_found', path: '/screens/s1', query: {} })
    expect(parseRoute('#/screens/s1/delete')).toEqual({ name: 'not_found', path: '/screens/s1/delete', query: {} })
    expect(parseRoute('#/screens//review')).toEqual({ name: 'not_found', path: '/screens//review', query: {} })
  })
})

describe('hrefTo / hrefToScreen / withQuery — 링크 생성', () => {
  it('메인·만들기·포트폴리오 링크', () => {
    expect(hrefTo('main')).toBe('#/')
    expect(hrefTo('create')).toBe('#/new')
    expect(hrefTo('references')).toBe('#/references')
    expect(hrefTo('main', { project: 'p1' })).toBe('#/?project=p1')
    expect(hrefTo('main', { help: 'key' })).toBe('#/?help=key')
    expect(hrefTo('create', { job: 'j1' })).toBe('#/new?job=j1')
    expect(parseRoute(hrefTo('create', { job: 'j1' }))).toEqual({ name: 'create', query: { job: 'j1' } })
  })

  it('설계서·고급 링크는 다시 파싱하면 같은 라우트가 되고, withQuery 가 라우트를 유지한다', () => {
    expect(hrefTo('advanced')).toBe('#/advanced')
    expect(hrefToDesign('r 1')).toBe('#/d/r%201')
    expect(parseRoute(hrefToDesign('x/y'))).toEqual({ name: 'design', revisionId: 'x/y', query: {} })
    expect(withQuery(parseRoute('#/d/r1'), { job: 'j1' })).toBe('#/d/r1?job=j1')
    expect(withQuery(parseRoute('#/d/r1?job=j1'), { job: '' })).toBe('#/d/r1')
    expect(withQuery(parseRoute('#/advanced?project=p1'), { project: 'p2' })).toBe('#/advanced?project=p2')
  })

  it('AS-IS 분석 링크는 id 를 인코딩하고 다시 파싱하면 같은 라우트가 된다', () => {
    expect(hrefTo('asis')).toBe('#/asis')
    expect(hrefTo('asis', { project: 'p1' })).toBe('#/asis?project=p1')
    expect(hrefToAsisDetail('a b')).toBe('#/asis/a%20b')
    expect(parseRoute(hrefToAsisDetail('x/y'))).toEqual({ name: 'asis_detail', analysisId: 'x/y', query: {} })
    expect(withQuery(parseRoute('#/asis?project=p1'), { project: '' })).toBe('#/asis')
    expect(withQuery(parseRoute('#/asis/an-1'), { shot: 'mobile' })).toBe('#/asis/an-1?shot=mobile')
  })

  it('화면 링크는 id 와 쿼리를 인코딩하고 빈 값은 뺀다', () => {
    expect(hrefToScreen('review', 's1', { rev: 'r 2', job: '' })).toBe('#/screens/s1/review?rev=r%202')
    expect(hrefToScreen('generate', 'a b')).toBe('#/screens/a%20b/generate')
  })

  it('생성한 링크를 다시 파싱하면 같은 라우트가 된다', () => {
    const href = hrefToScreen('approve', 'x/y', { rev: 'r1' })
    expect(parseRoute(href)).toEqual({ name: 'approve', screenId: 'x/y', query: { rev: 'r1' } })
  })

  it('withQuery 는 현재 라우트를 유지한 채 쿼리를 덮어쓰고 빈 값은 제거한다', () => {
    const route = parseRoute('#/screens/s1/review?rev=r1&job=j1')
    expect(withQuery(route, { job: '' })).toBe('#/screens/s1/review?rev=r1')
    expect(withQuery(route, { rev: 'r2' })).toBe('#/screens/s1/review?rev=r2&job=j1')
    expect(withQuery(parseRoute('#/'), { project: 'p2' })).toBe('#/?project=p2')
    expect(withQuery(parseRoute('#/new?job=j1'), { job: '' })).toBe('#/new')
    expect(withQuery(parseRoute('#/new'), { job: 'j2', screen: 's1' })).toBe('#/new?job=j2&screen=s1')
    expect(withQuery(parseRoute('#/nowhere?a=1'), { b: '2' })).toBe('#/nowhere?a=1&b=2')
  })
})
