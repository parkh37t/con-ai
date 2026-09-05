/**
 * 운영 모드 — 한 포트에서 UI(웹 빌드)와 API 를 함께 제공한다.
 *
 * 개발은 웹(5173, Vite)과 API(8787)가 따로 뜨고 Vite 가 `/api`·`/exports` 를 API 로 프록시한다(apps/web/vite.config.ts).
 * 운영은 프록시가 없으므로 API 프로세스가 웹 빌드 산출물을 직접 제공한다.
 *
 * - `WEB_DIST`(기본: 저장소 `apps/web/dist`)에 `index.html` 이 있으면 정적 제공을 켠다. 없으면 켜지 않고 안내만 남긴다(죽지 않는다).
 * - `/api/*`·`/exports/*`·`/asis-sample`·`/healthz` 는 API 가 예약한 경로다. 정적 파일·SPA 폴백이 절대 가로채지 않는다.
 * - 그 밖의 GET 경로는 파일이 있으면 파일, 없으면 `index.html`(SPA 폴백). 웹은 해시 라우터라 사실상 `/` 만 필요하지만 하위 경로도 안전하게 받는다.
 * - 캐시: `assets/*` 는 파일명에 해시가 들어가므로 1년 불변, 그 밖(특히 `index.html`)은 `no-cache`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { serveStatic } from '@hono/node-server/serve-static'
import type { Hono } from 'hono'
import type { AdapterKind } from '@con-ai/model-adapter'

/** API 가 쓰는 경로 접두사. 정적 제공·SPA 폴백에서 제외한다. */
export const RESERVED_PREFIXES = ['/api', '/exports', '/asis-sample', '/healthz'] as const

/** 예약 경로인가 (정확히 일치하거나 그 하위 경로). */
export function isReservedPath(path: string): boolean {
  return RESERVED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

/** 없는 경로 응답 본문 — app.notFound 와 SPA 폴백이 같은 모양을 쓴다. */
export function notFoundBody(method: string, path: string): { error: 'not_found'; message: string } {
  return { error: 'not_found', message: `경로가 없다: ${method} ${path}` }
}

export interface WebDistResolution {
  /** 확인한 절대 경로. */
  dir: string
  /** `index.html` 까지 있어 정적 제공을 켤 수 있는지. */
  available: boolean
  /** WEB_DIST 환경변수로 지정됐는지 (안내 문구 구분용). */
  from_env: boolean
}

/** 웹 빌드 위치 결정: `WEB_DIST` 환경변수(상대 경로면 cwd 기준), 없으면 기본 경로. 존재 여부까지 확인한다. */
export function resolveWebDist(env: NodeJS.ProcessEnv, defaultDir: string): WebDistResolution {
  const raw = env.WEB_DIST?.trim()
  const fromEnv = raw !== undefined && raw.length > 0
  const dir = fromEnv ? resolve(raw) : defaultDir
  return { dir, available: existsSync(join(dir, 'index.html')), from_env: fromEnv }
}

/** Vite 가 내용 해시 파일명으로 내보내는 자산 경로. */
const ASSETS_PREFIX = '/assets/'

/** 경로 마지막 조각의 확장자를 뽑는다 (`/a/b/c.js` → `.js`). 확장자가 없으면 일치하지 않는다. */
const FILE_EXTENSION = /\.[A-Za-z0-9]{1,8}$/

/**
 * SPA 폴백(index.html)을 줄 경로인가.
 * 예약 경로(API)가 아니고, 파일을 가리키는 경로(`assets/*` 또는 확장자로 끝나는 경로)도 아니어야 한다.
 * 없는 파일에 HTML 200 을 주면 브라우저가 스크립트·스타일 자리에서 문법 오류를 내 원인을 찾기 어려워진다.
 * (예: 데모 빌드를 실수로 올리면 자산이 `/con-ai/assets/…` 로 요청된다 — 그때도 HTML 이 아니라 404 가 나가야 한다.)
 */
export function shouldFallbackToIndex(path: string): boolean {
  if (isReservedPath(path) || path.startsWith(ASSETS_PREFIX)) return false
  const last = path.slice(path.lastIndexOf('/') + 1)
  const ext = FILE_EXTENSION.exec(last)?.[0]?.toLowerCase()
  return ext === undefined || ext === '.html'
}

/**
 * 정적 자산 캐시 정책 (요청 경로 기준).
 * `assets/*` 는 Vite 가 내용 해시를 파일명에 넣으므로 불변으로 캐시해도 안전하다.
 * 그 밖(`index.html`·`favicon` 등)은 배포마다 같은 이름으로 바뀌므로 매번 확인시킨다.
 */
export function cacheControlFor(requestPath: string): string {
  return requestPath.startsWith(ASSETS_PREFIX) ? 'public, max-age=31536000, immutable' : 'no-cache'
}

/**
 * 웹 빌드 정적 제공 + SPA 폴백을 앱에 붙인다. **API 라우트를 모두 등록한 뒤** 마지막에 호출한다
 * (Hono 는 등록 순서대로 처리하므로, 먼저 등록된 API 핸들러가 응답하면 여기까지 오지 않는다).
 */
export function mountWebStatic(app: Hono, dir: string): void {
  const indexPath = join(dir, 'index.html')
  const files = serveStatic({ root: dir })

  // 1) 실제 파일 (예약 경로와 GET·HEAD 가 아닌 요청은 건드리지 않는다).
  app.use('*', async (c, next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') return next()
    if (isReservedPath(c.req.path)) return next()
    // 헤더는 serveStatic 을 부르기 **전에** 넣는다. serveStatic 은 응답 객체를 만든 뒤 onFound 를 부르므로
    // 그 안에서 붙인 헤더는 이미 만들어진 응답에 반영되지 않는다(확인함). 미리 넣은 헤더는 응답에 합쳐진다.
    // 파일이 없어 아래 폴백으로 넘어가면 폴백이 같은 헤더를 덮어쓴다.
    c.header('Cache-Control', cacheControlFor(c.req.path))
    c.header('X-Content-Type-Options', 'nosniff')
    return files(c, next)
  })

  // 2) 파일이 없으면 index.html (SPA). 예약 경로·파일을 가리키는 경로는 폴백하지 않고 404 JSON 을 준다.
  app.get('*', (c) => {
    if (!shouldFallbackToIndex(c.req.path)) return c.json(notFoundBody(c.req.method, c.req.path), 404)
    let html: string
    try {
      html = readFileSync(indexPath, 'utf8')
    } catch {
      // 서버 실행 중에 빌드를 지운 경우 — 정적 제공을 켤 때는 있었다.
      return c.json(notFoundBody(c.req.method, c.req.path), 404)
    }
    c.header('Cache-Control', 'no-cache')
    c.header('X-Content-Type-Options', 'nosniff')
    return c.html(html)
  })
}

/** 인증이 없다는 경고 — 공개 주소 배포 전에 반드시 읽어야 하는 문장. 문구를 바꾸면 테스트도 같이 고친다. */
export const NO_AUTH_WARNING =
  '[경고] 인증이 없다 — 공개 주소에 올리면 누구나 사용하고 모델 비용이 발생한다. 사설망·VPN·리버스 프록시 인증 뒤에 두거나 docs/decisions/0014 의 1단계를 구현하라.'

const RULE = '='.repeat(96)

export interface StartupInfo {
  /** 바인드 주소 (HOST, 기본 0.0.0.0). */
  host: string
  /** 실제로 열린 포트. */
  port: number
  adapter: AdapterKind
  web: WebDistResolution
}

/**
 * 시작 로그 줄 목록 (키·토큰 값은 절대 넣지 않는다).
 * 접속 주소 한 줄 → 웹 빌드 상태 한 줄 → 인증 경고. 어댑터가 anthropic(실제 호출·과금)이면 경고를 구분선으로 감싼다.
 */
export function buildStartupLines(info: StartupInfo): string[] {
  const anyInterface = info.host === '0.0.0.0' || info.host === '::' || info.host === ''
  const shown = anyInterface ? 'localhost' : info.host
  const lines: string[] = [
    `[con-ai] 접속: http://${shown}:${info.port}${anyInterface ? `  (바인드 ${info.host || '0.0.0.0'} — 같은 망의 다른 기기·컨테이너 밖에서도 열린다)` : ''}`,
  ]
  lines.push(
    info.web.available
      ? `[con-ai] 웹 빌드 제공: ${info.web.dir}${info.web.from_env ? ' (WEB_DIST)' : ''} — 이 주소 하나로 UI 와 API 를 함께 쓴다`
      : `[con-ai] 웹 빌드 없음 — pnpm build:web 후 다시 시작하면 같은 포트에서 UI 를 제공한다 (찾은 위치: ${info.web.dir})`,
  )
  if (info.adapter === 'anthropic') {
    lines.push(RULE, NO_AUTH_WARNING, '[경고] 어댑터 anthropic — 접속하는 누구나 실제 모델을 호출하고, 그 비용은 이 서버의 자격 증명으로 청구된다.', RULE)
  } else {
    lines.push(NO_AUTH_WARNING)
  }
  return lines
}
