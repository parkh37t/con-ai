/**
 * AS-IS 분석 러너 (계약 §12) — 대상 URL 을 Playwright chromium 으로 방문해 스크린샷·structure 를 수집하고,
 * 모델 어댑터(draftPainPoints)로 페인포인트 초안을 만들어 asis_analysis 문서로 저장한다.
 *
 * - chromium 실행 파일 결정은 validators V3 와 같은 규칙(launchPlan): env PLAYWRIGHT_CHROMIUM_PATH →
 *   기본 launch → (실패 시) /opt/pw-browsers/chromium 이 있으면 재시도. 전부 실패하면 failed(code 'browser').
 * - goto 는 { waitUntil: 'domcontentloaded', timeout: 20초 }. 실패하면 failed(code 'navigation', 원인 포함).
 * - 데스크톱 1280×800 fullPage PNG → 모바일 390×844 PNG(viewport 변경) → page.evaluate 로 structure 추출(각 목록 상위 30 절단).
 * - draftPainPoints 실패는 failed(code 'draft'), 그 밖의 예외는 failed(code 'internal').
 * - 절대 실패를 succeeded 로 표시하지 않는다. 성공 시에만 asis_asset 2건과 pain_points(`PP-001`…, status 'proposed')를 저장한다.
 *
 * SSRF 차단 (ssrf.ts, docs/plan/배포.md §7) — 요청 접수(app.ts POST)와 별개로 러너에서도 막는다.
 * 접수 때 통과한 URL 이 리다이렉트로 내부 주소에 도달할 수 있기 때문이다.
 *  1. 나가는 요청: `page.route('**\/*')` 로 http/https 요청마다 checkUrl → 차단 대역이면 abort(요청 자체를 막는다).
 *     해석 결과는 cacheResolve 로 호스트 단위 캐시라 요청마다 DNS 를 치지 않는다.
 *  2. 리다이렉트 각 단계: **route 핸들러는 리다이렉트로 이어진 요청에는 다시 불리지 않는다**(이 저장소의
 *     Playwright 1.63 으로 확인했다 — 302 를 따라간 요청은 `page.on('request')` 로만 보인다). 그래서
 *     redirectedFrom 이 있는 요청을 따로 검사한다. 이미 나간 요청이라 **막지는 못하고 탐지**만 한다 —
 *     메인 문서 체인에 내부 주소가 끼어 있었으면 캡처하지 않고 failed(code 'blocked') 로 끝낸다.
 *  3. 최종 URL: goto 후 `page.url()`(리다이렉트 결과)을 다시 checkUrl → 위반이면 캡처·구조 추출을 하지 않는다.
 * 차단된 **하위 리소스**는 분석을 실패시키지 않는다 — structure 에만 영향을 주고 `blocked_requests` 로 몇 건인지 남긴다.
 */
import { chromium, type Browser, type Page } from 'playwright'
import type { AsisStructure, ModelAdapter, PainPointSeverity } from '@con-ai/model-adapter'
import { launchPlan } from '@con-ai/validators'
import type { Store, StoredDocument } from '@con-ai/worker-generation'
import { cacheResolve, checkUrl, lookupResolve, parsePolicy, type SsrfPolicy, type SsrfResolve, type SsrfVerdict } from './ssrf.js'
import type { AssetStore } from './store.js'

export type AsisStore = Store & AssetStore

// ---------- 문서 타입 (계약 §12 kind `asis_analysis`) ----------

export type AsisStatus = 'queued' | 'running' | 'succeeded' | 'failed'
/**
 * 계약 §12 의 네 코드 + SSRF 차단용 'blocked'.
 * `navigation` 을 재사용하지 않은 이유: "대상이 죽어 있었다" 와 "정책이 거부했다" 는 운영자가 다르게 대응해야 한다
 * (전자는 재시도, 후자는 ASIS_ALLOW_PRIVATE/ASIS_ALLOWED_HOSTS 설정). 웹은 `AsisFailure.code` 를
 * `AsisFailureCode | (string & {})` 로 두고 모르는 코드는 그대로 보여주도록 이미 만들어져 있어(apps/web/src/types.ts,
 * asis.ts `ASIS_FAILURE_LABELS[code] ?? code`) 코드를 늘려도 표시가 깨지지 않는다. 한국어 설명은 message 에 담는다.
 */
export type AsisFailureCode = 'navigation' | 'browser' | 'draft' | 'internal' | 'blocked'
export type AsisPainPointStatus = 'proposed' | 'adopted' | 'rejected'

export interface AsisPainPoint {
  id: string
  area: string
  severity: PainPointSeverity
  description: string
  evidence: string
  suggestion: string
  status: AsisPainPointStatus
}

export interface AsisFailure {
  code: AsisFailureCode
  message: string
}

export interface AsisAnalysisDocument {
  id: string
  project_id: string
  url: string
  note?: string | undefined
  status: AsisStatus
  failure?: AsisFailure | undefined
  adapter: ModelAdapter['kind']
  model: string
  created_at: string
  finished_at?: string | undefined
  structure?: AsisStructure | undefined
  screenshots?: { desktop: string; mobile: string } | undefined
  summary?: string | undefined
  pain_points: AsisPainPoint[]
  /**
   * SSRF 정책이 막은 요청 수(하위 리소스 포함). route 로 abort 한 것과, 리다이렉트 단계에서 뒤늦게 잡은 것을 함께 센다.
   * 계약 §12 에 없는 추가 필드이지만 저장은 kind 별 JSON 이고 웹은 모르는 필드를 무시하므로
   * (apps/web 의 AsisAnalysis 는 TS 인터페이스일 뿐이다) 스키마·표시를 깨지 않는다.
   * 스크린샷에 이미지가 비어 보이는 이유를 설명하기 위해 남긴다.
   */
  blocked_requests?: number | undefined
}

// ---------- 러너 ----------

export const ASIS_NAVIGATION_TIMEOUT_MS = 20_000
export const ASIS_DESKTOP_VIEWPORT = { width: 1280, height: 800 } as const
export const ASIS_MOBILE_VIEWPORT = { width: 390, height: 844 } as const
/** structure 의 각 목록(headings·nav_links·forms·필드·buttons) 상한 (계약 §12: 상위 30). */
export const STRUCTURE_LIST_LIMIT = 30

export interface AsisRunnerDeps {
  store: AsisStore
  adapter: ModelAdapter
  now: () => string
  /** launchPlan 이 읽는 환경 (기본 process.env). */
  env?: NodeJS.ProcessEnv | undefined
  /** goto 제한 시간 (기본 20초, 계약 §12). 테스트에서만 바꾼다. */
  navigation_timeout_ms?: number | undefined
  /** SSRF 정책 (기본 parsePolicy(env)). */
  ssrf_policy?: SsrfPolicy | undefined
  /** 호스트 해석기 (기본 node:dns lookup). 테스트에서 특정 호스트만 사설로 보이게 주입한다. */
  ssrf_resolve?: SsrfResolve | undefined
}

/** 메인 프레임의 문서 요청인가 (리다이렉트 각 단계 포함). 서비스 워커 요청 등에서는 frame() 이 던질 수 있어 감싼다. */
function isMainNavigation(request: { isNavigationRequest: () => boolean; frame: () => unknown }, page: Page): boolean {
  try {
    return request.isNavigationRequest() && request.frame() === page.mainFrame()
  } catch {
    return false
  }
}

function firstLine(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.split('\n')[0] ?? msg
}

/** 페인포인트 초안에 서버가 id(`PP-001`…)와 status 'proposed' 를 부여한다 (계약 §12). */
export function assignPainPointIds(drafts: ReadonlyArray<Omit<AsisPainPoint, 'id' | 'status'>>): AsisPainPoint[] {
  return drafts.map((p, i) => ({ ...p, id: `PP-${String(i + 1).padStart(3, '0')}`, status: 'proposed' as const }))
}

export async function runAsisAnalysis(analysisId: string, deps: AsisRunnerDeps): Promise<void> {
  const stored = deps.store.get<AsisAnalysisDocument>('asis_analysis', analysisId)
  if (!stored) throw new Error(`AS-IS 분석 문서를 찾을 수 없다: ${analysisId}`)
  if (stored.data.status !== 'queued') throw new Error(`queued 상태의 분석만 실행할 수 있다: ${analysisId} 는 ${stored.data.status}`)

  const env = deps.env ?? process.env
  const timeout = deps.navigation_timeout_ms ?? ASIS_NAVIGATION_TIMEOUT_MS
  const policy = deps.ssrf_policy ?? parsePolicy(env)
  // 이 분석 실행 동안만 사는 호스트 단위 캐시 — 하위 리소스마다 DNS 를 다시 치지 않는다.
  const resolve = cacheResolve(deps.ssrf_resolve ?? lookupResolve)
  const guard = (target: string) => checkUrl(target, policy, resolve)

  /** 항상 최신 revision 을 다시 읽어 저장한다 (PATCH 와의 충돌 방지 — 큐는 순차라 실제 충돌은 드물다). */
  const save = (patch: Partial<AsisAnalysisDocument>): StoredDocument<AsisAnalysisDocument> => {
    const fresh = deps.store.get<AsisAnalysisDocument>('asis_analysis', analysisId)
    if (!fresh) throw new Error(`AS-IS 분석 문서가 사라졌다: ${analysisId}`)
    return deps.store.put<AsisAnalysisDocument>('asis_analysis', analysisId, { ...fresh.data, ...patch }, fresh.revision)
  }
  const fail = (code: AsisFailureCode, message: string, extra?: Partial<AsisAnalysisDocument>): void => {
    save({ status: 'failed', failure: { code, message }, finished_at: deps.now(), ...extra })
  }

  save({ status: 'running' })
  const url = stored.data.url

  try {
    // 1. 브라우저 실행 — validators V3 와 같은 executablePath 규칙. 전부 실패하면 failed('browser').
    let browser: Browser | undefined
    const launchErrors: string[] = []
    for (const attempt of launchPlan(env)) {
      try {
        const options: Parameters<typeof chromium.launch>[0] = { headless: true }
        if (attempt.executablePath !== undefined) options.executablePath = attempt.executablePath
        browser = await chromium.launch(options)
        break
      } catch (e) {
        launchErrors.push(`${attempt.label} — ${firstLine(e)}`)
      }
    }
    if (browser === undefined) {
      fail('browser', `브라우저를 띄우지 못했다: ${launchErrors.join(' / ')}`)
      return
    }

    let desktopPng: Uint8Array
    let mobilePng: Uint8Array
    let structure: AsisStructure
    /** 정책이 막은 요청 수 — route 로 abort 한 것 + 리다이렉트 단계에서 뒤늦게 잡은 것(이미 나갔다). */
    let blockedRequests = 0
    /** 메인 문서(리다이렉트 각 단계 포함)가 막혔을 때의 사유 — goto 실패를 'navigation' 이 아니라 'blocked' 로 분류한다. */
    let blockedNavigation: string | undefined
    try {
      const page = await browser.newPage({ viewport: { ...ASIS_DESKTOP_VIEWPORT } })

      // 1-2. 나가는 요청마다 검사 — 차단 대역이면 abort. 메인 문서의 첫 요청과 모든 하위 리소스가 여기를 지난다
      //      (리다이렉트로 이어진 요청은 여기 오지 않는다 — 아래 1-3).
      await page.route('**/*', async (route) => {
        const request = route.request()
        const target = request.url()
        let verdict: SsrfVerdict
        try {
          // http/https 가 아닌 스킴(data:·blob:)은 네트워크로 나가지 않으므로 검사 대상이 아니다.
          verdict = /^https?:$/i.test(new URL(target).protocol) ? await guard(target) : { allowed: true, ips: [] }
        } catch (e) {
          // 검사 자체가 실패하면 통과시키지 않는다 (fail closed).
          verdict = { allowed: false, code: 'invalid_url', reason: `요청 URL 을 검사하지 못했다: ${firstLine(e)}` }
        }
        // 페이지가 이동·종료되면 route 처리가 이미 끝나 있을 수 있다 — 그때의 예외는 분석 실패 사유가 아니다.
        if (verdict.allowed) {
          await route.continue().catch(() => undefined)
          return
        }
        blockedRequests += 1
        if (isMainNavigation(request, page) && blockedNavigation === undefined) blockedNavigation = `${target} — ${verdict.reason}`
        await route.abort('blockedbyclient').catch(() => undefined)
      })

      // 1-3. 리다이렉트로 이어진 요청은 route 핸들러가 다시 불리지 않는다 — 여기서만 보인다.
      //      이미 나간 요청이라 막을 수는 없지만, 체인 중간에 내부 주소가 끼었는지 탐지해 캡처를 막는다.
      const pendingChecks: Array<Promise<void>> = []
      page.on('request', (request) => {
        if (request.redirectedFrom() === null) return // 첫 요청은 위 route 핸들러가 이미 막는다 (중복 집계 방지)
        const target = request.url()
        pendingChecks.push(
          (async () => {
            if (!/^https?:$/i.test(new URL(target).protocol)) return
            const verdict = await guard(target)
            if (verdict.allowed) return
            blockedRequests += 1
            if (isMainNavigation(request, page) && blockedNavigation === undefined) blockedNavigation = `${target} — ${verdict.reason}`
          })().catch(() => undefined),
        )
      })

      // 2. 이동 — 실패하면 failed('navigation') 에 원인을 남긴다. 정책이 막아서 실패한 것이면 'blocked'.
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout })
      } catch (e) {
        await Promise.all(pendingChecks)
        if (blockedNavigation !== undefined) fail('blocked', `분석 대상이 정책에 막혔다: ${blockedNavigation}`, { blocked_requests: blockedRequests })
        else fail('navigation', `URL 로 이동하지 못했다 (${url}): ${firstLine(e)}`)
        return
      }
      // 2-2. 리다이렉트 체인 검사 결과를 반영한 뒤 판단한다 (내부 주소를 거쳐 왔으면 캡처하지 않는다).
      await Promise.all(pendingChecks)
      if (blockedNavigation !== undefined) {
        fail('blocked', `분석 대상이 정책에 막힌 주소를 거쳐 갔다: ${blockedNavigation}`, { blocked_requests: blockedRequests })
        return
      }
      // 2-3. 최종 URL 재검사 — 리다이렉트 후 실제로 열린 주소가 정책을 지키는지 본다.
      //      위반이면 캡처·구조 추출을 하지 않고 끝낸다 (내부 페이지를 스크린샷으로 유출하지 않는다).
      const finalUrl = page.url()
      const finalVerdict = await guard(finalUrl)
      if (!finalVerdict.allowed) {
        fail('blocked', `리다이렉트 후 최종 URL 이 정책에 막혔다 (${finalUrl}): ${finalVerdict.reason}`, { blocked_requests: blockedRequests })
        return
      }
      // 3. 스크린샷 — 데스크톱 fullPage → 모바일(viewport 변경).
      desktopPng = await page.screenshot({ fullPage: true, type: 'png' })
      await page.setViewportSize({ ...ASIS_MOBILE_VIEWPORT })
      mobilePng = await page.screenshot({ type: 'png' })
      // 4. structure 추출.
      structure = await extractStructure(page)
      // 캡처 중에 늦게 나간 요청(리다이렉트 하위 리소스)의 검사까지 반영해 blocked_requests 를 센다.
      await Promise.all(pendingChecks)
    } finally {
      await browser.close().catch(() => undefined)
    }

    // 5. 페인포인트 초안 — 실패하면 failed('draft').
    let drafted
    try {
      drafted = await deps.adapter.draftPainPoints({ url, ...(stored.data.note === undefined ? {} : { note: stored.data.note }), structure })
    } catch (e) {
      fail('draft', `페인포인트 초안 생성 실패: ${e instanceof Error ? e.message : String(e)}`)
      return
    }

    // 6. 자산·문서 저장 — 성공했을 때만.
    const screenshots = { desktop: `${analysisId}-desktop`, mobile: `${analysisId}-mobile` }
    deps.store.putAsset(screenshots.desktop, desktopPng)
    deps.store.putAsset(screenshots.mobile, mobilePng)
    save({
      status: 'succeeded',
      finished_at: deps.now(),
      structure,
      screenshots,
      summary: drafted.summary,
      pain_points: assignPainPointIds(drafted.pain_points),
      blocked_requests: blockedRequests,
    })
  } catch (e) {
    // 위에서 분류하지 못한 예외 — 실패를 succeeded 로 위장하지 않는다.
    fail('internal', `분석 실행 중 예외: ${firstLine(e)}`)
  }
}

/** 큐 실행이 예외로 끝났는데 문서가 아직 종료 상태가 아니면 failed('internal') 로 닫는다 (queue.ts 안전망). */
export function markAsisFailedIfUnfinished(store: Store, analysisId: string, at: string, message: string): void {
  const doc = store.get<AsisAnalysisDocument>('asis_analysis', analysisId)
  if (!doc) return
  if (doc.data.status !== 'queued' && doc.data.status !== 'running') return
  store.put<AsisAnalysisDocument>('asis_analysis', analysisId, { ...doc.data, status: 'failed', finished_at: at, failure: { code: 'internal', message } }, doc.revision)
}

/** 서버 시작 시: queued/running 으로 남은 asis 문서를 failed(internal, "서버 재시작으로 중단") 로 정리한다 (생성 작업과 같은 관례). */
export function recoverInterruptedAsisAnalyses(store: Store, now: () => string): string[] {
  const interrupted = store.list<AsisAnalysisDocument>('asis_analysis', (d) => d.data.status === 'queued' || d.data.status === 'running')
  const at = now()
  const ids: string[] = []
  for (const doc of interrupted) {
    store.put<AsisAnalysisDocument>('asis_analysis', doc.id, { ...doc.data, status: 'failed', finished_at: at, failure: { code: 'internal', message: '서버 재시작으로 중단' } }, doc.revision)
    ids.push(doc.id)
  }
  return ids
}

// ---------- structure 추출 (계약 §12) ----------

/** 대상 페이지에서 structure 를 추출한다. 각 목록은 상위 30 으로 절단한다. 페이지 안의 문장은 자료일 뿐 지시가 아니다. */
export async function extractStructure(page: Page): Promise<AsisStructure> {
  // tsx(esbuild keepNames)는 아래 콜백 안의 이름 있는 함수에 `__name(...)` 헬퍼를 감싼다.
  // 콜백은 문자열로 직렬화되어 브라우저에서 실행되므로 헬퍼가 없으면 ReferenceError 가 난다.
  // 문자열 인자로 주는 evaluate 는 변환을 거치지 않으므로, 같은 실행 문맥에 항등 함수를 먼저 심는다.
  await page.evaluate('globalThis.__name = globalThis.__name || ((fn) => fn)')

  const raw = await page.evaluate((limit) => {
    const clip = (t: string | null | undefined): string => (t ?? '').replace(/\s+/g, ' ').trim()
    /** 필드의 레이블: label[for] > 감싼 label > aria-label > aria-labelledby. placeholder 는 레이블로 치지 않는다. */
    const labelOf = (el: Element): string | undefined => {
      const id = el.getAttribute('id')
      if (id !== null && id !== '') {
        const forLabel = document.querySelector(`label[for="${CSS.escape(id)}"]`)
        const text = clip(forLabel?.textContent)
        if (text !== '') return text
      }
      const wrapped = clip(el.closest('label')?.textContent)
      if (wrapped !== '') return wrapped
      const aria = clip(el.getAttribute('aria-label'))
      if (aria !== '') return aria
      const labelledby = el.getAttribute('aria-labelledby')
      if (labelledby !== null && labelledby !== '') {
        const target = document.getElementById(labelledby.split(/\s+/)[0] ?? '')
        const text = clip(target?.textContent)
        if (text !== '') return text
      }
      return undefined
    }
    const FIELD_SELECTOR = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), select, textarea'
    const fieldsOf = (root: ParentNode): Element[] => Array.from(root.querySelectorAll(FIELD_SELECTOR))

    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
      .slice(0, limit)
      .map((h) => ({ level: Number(h.tagName.slice(1)), text: clip(h.textContent) }))
    const nav_links = Array.from(document.querySelectorAll('nav a[href]'))
      .slice(0, limit)
      .map((a) => ({ text: clip(a.textContent), href: a.getAttribute('href') ?? '' }))
    const forms = Array.from(document.querySelectorAll('form'))
      .slice(0, limit)
      .map((f) => ({
        name: f.getAttribute('name') ?? f.getAttribute('id') ?? undefined,
        fields: fieldsOf(f)
          .slice(0, limit)
          .map((el) => ({
            type: el.tagName.toLowerCase() === 'input' ? (el.getAttribute('type') ?? 'text') : el.tagName.toLowerCase(),
            label: labelOf(el),
            name: el.getAttribute('name') ?? undefined,
          })),
      }))
    const buttons = [
      ...Array.from(document.querySelectorAll('button')).map((b) => clip(b.textContent)),
      ...Array.from(document.querySelectorAll('input[type=submit], input[type=button], input[type=reset]')).map((b) => clip(b.getAttribute('value'))),
    ]
      .filter((t) => t !== '')
      .slice(0, limit)
    const images = Array.from(document.querySelectorAll('img'))
    const allFields = fieldsOf(document)
    const meta = document.querySelector('meta[name=description]')?.getAttribute('content')

    return {
      title: clip(document.title),
      description: meta === null || meta === undefined ? '' : clip(meta),
      lang: document.documentElement.getAttribute('lang') ?? '',
      headings,
      nav_links,
      forms,
      buttons,
      counts: {
        links: document.querySelectorAll('a[href]').length,
        images: images.length,
        // alt 속성이 없거나 비어 있으면 없는 것으로 센다 (장식 이미지 alt="" 구분은 초안 단계에서 하지 않는다).
        images_without_alt: images.filter((img) => clip(img.getAttribute('alt')) === '').length,
        tables: document.querySelectorAll('table').length,
        fields_without_label: allFields.filter((el) => labelOf(el) === undefined).length,
        iframes: document.querySelectorAll('iframe').length,
      },
    }
  }, STRUCTURE_LIST_LIMIT)

  // exactOptionalPropertyTypes: 빈 값은 필드 자체를 빼서 계약 §12 의 선택 필드로 만든다.
  const structure: AsisStructure = {
    title: raw.title,
    headings: raw.headings,
    nav_links: raw.nav_links,
    forms: raw.forms.map((f) => ({ ...(f.name === undefined ? {} : { name: f.name }), fields: f.fields.map((x) => ({ type: x.type, ...(x.label === undefined ? {} : { label: x.label }), ...(x.name === undefined ? {} : { name: x.name }) })) })),
    buttons: raw.buttons,
    counts: raw.counts,
  }
  if (raw.description !== '') structure.description = raw.description
  if (raw.lang !== '') structure.lang = raw.lang
  return structure
}
