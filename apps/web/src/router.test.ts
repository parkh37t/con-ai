import { describe, expect, it } from 'vitest'
import { hrefTo, hrefToScreen, parseRoute, withQuery } from './router.js'

describe('parseRoute — 해시 라우팅', () => {
  it('빈 해시·`#`·`#/` 는 홈이다', () => {
    expect(parseRoute('')).toEqual({ name: 'home', query: {} })
    expect(parseRoute('#')).toEqual({ name: 'home', query: {} })
    expect(parseRoute('#/')).toEqual({ name: 'home', query: {} })
  })

  it('레퍼런스 포트폴리오', () => {
    expect(parseRoute('#/references')).toEqual({ name: 'references', query: {} })
    expect(parseRoute('#/references/')).toEqual({ name: 'references', query: {} })
  })

  it('화면 경로 — generate / review / approve 와 화면 id', () => {
    expect(parseRoute('#/screens/abc-123/generate')).toEqual({ name: 'generate', screenId: 'abc-123', query: {} })
    expect(parseRoute('#/screens/abc-123/review')).toEqual({ name: 'review', screenId: 'abc-123', query: {} })
    expect(parseRoute('#/screens/abc-123/approve')).toEqual({ name: 'approve', screenId: 'abc-123', query: {} })
  })

  it('쿼리는 해시 뒤의 `?` 로 읽고 URL 디코딩한다', () => {
    expect(parseRoute('#/screens/s1/review?rev=r-2&job=j%2F9')).toEqual({ name: 'review', screenId: 's1', query: { rev: 'r-2', job: 'j/9' } })
    expect(parseRoute('#/?project=p1')).toEqual({ name: 'home', query: { project: 'p1' } })
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
  it('홈·포트폴리오 링크', () => {
    expect(hrefTo('home')).toBe('#/')
    expect(hrefTo('references')).toBe('#/references')
    expect(hrefTo('home', { project: 'p1' })).toBe('#/?project=p1')
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
    expect(withQuery(parseRoute('#/nowhere?a=1'), { b: '2' })).toBe('#/nowhere?a=1&b=2')
  })
})
