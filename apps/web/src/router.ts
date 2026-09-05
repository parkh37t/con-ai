/**
 * 해시 라우팅 — 라우터 라이브러리 없이 `#/…` 경로를 파싱한다 (순수 함수, 테스트 가능).
 *
 * 경로: `#/`(만들기), `#/d/:revisionId`(설계서 결과), `#/advanced`(프로젝트 전체), `#/references`, `#/asis`, `#/asis/:id`,
 *       `#/screens/:id/generate`, `#/screens/:id/review`, `#/screens/:id/approve`.
 * 쿼리(`?rev=…&job=…`)는 해시 뒤에 붙는다.
 */
export type Query = Record<string, string>

export type Route =
  | { name: 'home'; query: Query }
  | { name: 'design'; revisionId: string; query: Query }
  | { name: 'advanced'; query: Query }
  | { name: 'references'; query: Query }
  | { name: 'asis'; query: Query }
  | { name: 'asis_detail'; analysisId: string; query: Query }
  | { name: 'generate'; screenId: string; query: Query }
  | { name: 'review'; screenId: string; query: Query }
  | { name: 'approve'; screenId: string; query: Query }
  | { name: 'not_found'; path: string; query: Query }

export type ScreenRouteName = 'generate' | 'review' | 'approve'

function parseQuery(raw: string): Query {
  const query: Query = {}
  if (!raw) return query
  for (const part of raw.split('&')) {
    if (!part) continue
    const eq = part.indexOf('=')
    const key = decodeURIComponent(eq === -1 ? part : part.slice(0, eq))
    const value = eq === -1 ? '' : decodeURIComponent(part.slice(eq + 1))
    if (key) query[key] = value
  }
  return query
}

/** `location.hash` 전체(앞의 `#` 포함 여부 무관)를 받아 라우트로 바꾼다. */
export function parseRoute(hash: string): Route {
  let rest = hash.startsWith('#') ? hash.slice(1) : hash
  if (!rest.startsWith('/')) rest = `/${rest}`
  const qIndex = rest.indexOf('?')
  const path = qIndex === -1 ? rest : rest.slice(0, qIndex)
  const query = parseQuery(qIndex === -1 ? '' : rest.slice(qIndex + 1))
  const segments = path.split('/').filter((s) => s.length > 0)

  if (segments.length === 0) return { name: 'home', query }
  if (segments.length === 1 && segments[0] === 'advanced') return { name: 'advanced', query }
  if (segments.length === 2 && segments[0] === 'd') {
    const revisionId = decodeURIComponent(segments[1] ?? '')
    if (revisionId) return { name: 'design', revisionId, query }
  }
  if (segments.length === 1 && segments[0] === 'references') return { name: 'references', query }
  if (segments.length === 1 && segments[0] === 'asis') return { name: 'asis', query }
  if (segments.length === 2 && segments[0] === 'asis') {
    const analysisId = decodeURIComponent(segments[1] ?? '')
    if (analysisId) return { name: 'asis_detail', analysisId, query }
  }
  if (segments.length === 3 && segments[0] === 'screens') {
    const screenId = decodeURIComponent(segments[1] ?? '')
    const action = segments[2]
    if (screenId && (action === 'generate' || action === 'review' || action === 'approve')) {
      return { name: action, screenId, query }
    }
  }
  return { name: 'not_found', path, query }
}

function encodeQuery(query: Query | undefined): string {
  if (!query) return ''
  const parts = Object.entries(query)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
  return parts.length === 0 ? '' : `?${parts.join('&')}`
}

/** 만들기·고급(프로젝트 전체)·포트폴리오·AS-IS 분석 목록 링크. */
export function hrefTo(name: 'home' | 'advanced' | 'references' | 'asis', query?: Query): string {
  const base = name === 'home' ? '#/' : name === 'advanced' ? '#/advanced' : name === 'references' ? '#/references' : '#/asis'
  return `${base}${encodeQuery(query)}`
}

/** 설계서 결과 화면 링크 (`#/d/:revisionId`). */
export function hrefToDesign(revisionId: string, query?: Query): string {
  return `#/d/${encodeURIComponent(revisionId)}${encodeQuery(query)}`
}

/** AS-IS 분석 상세 링크. */
export function hrefToAsisDetail(analysisId: string, query?: Query): string {
  return `#/asis/${encodeURIComponent(analysisId)}${encodeQuery(query)}`
}

/** 화면 단위 링크. */
export function hrefToScreen(name: ScreenRouteName, screenId: string, query?: Query): string {
  return `#/screens/${encodeURIComponent(screenId)}/${name}${encodeQuery(query)}`
}

/** 현재 라우트의 쿼리 일부를 바꾼 해시를 만든다 (빈 값은 제거). */
export function withQuery(route: Route, patch: Query): string {
  const query: Query = { ...route.query }
  for (const [k, v] of Object.entries(patch)) {
    if (v === '') delete query[k]
    else query[k] = v
  }
  switch (route.name) {
    case 'home':
      return hrefTo('home', query)
    case 'design':
      return hrefToDesign(route.revisionId, query)
    case 'advanced':
      return hrefTo('advanced', query)
    case 'references':
      return hrefTo('references', query)
    case 'asis':
      return hrefTo('asis', query)
    case 'asis_detail':
      return hrefToAsisDetail(route.analysisId, query)
    case 'generate':
    case 'review':
    case 'approve':
      return hrefToScreen(route.name, route.screenId, query)
    case 'not_found':
      return `#${route.path}${encodeQuery(query)}`
  }
}
