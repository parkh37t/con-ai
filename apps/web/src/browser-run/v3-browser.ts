/**
 * 브라우저에서 도는 V3 실행 검사 — 서버 `packages/validators/src/v3.ts` 와 **같은 판정 규칙**.
 *
 * 왜 이게 필요한가: 정적 배포에서 V3 가 미실행이면 승인(완료 v1.0)을 통과할 수 없어 4단계가 끝나지 않는다.
 * 미실행을 통과로 바꾸는 대신, **실제로 실행한다** — 지금 이 화면이 이미 진짜 브라우저이기 때문이다.
 *
 * 어떻게: 산출물 HTML 사본에 조사 스크립트를 끼워 격리 iframe(`sandbox="allow-scripts"`)에서 열고,
 * 그 안에서 CASE 전환·검색·다운로드를 실제로 눌러 본 관찰값을 받아 여기서 판정한다.
 *
 * 서버 V3 와 다른 점 (근거에 그대로 적는다)
 * - 파일 저장(download 이벤트)은 sandbox 가 막는다. v3.ts 도 저장이 막힌 환경을 허용하며 화면 상태 문구로 판정한다.
 * - 돌릴 수 없으면(문서 없음·시간 초과·조사 실패) `error` 다. **통과가 아니다.**
 */
import { V3_CHECKS, makeResult, notRun, type CheckResult, type ResultFactoryInput } from './deps.js'
import { v3RequiredFlags } from './deps.js'
import { V3_DONE_MESSAGE, V3_READY_MESSAGE, V3_RUN_MESSAGE, injectHarness, type V3Probe } from './v3-harness.js'

export const DEFAULT_BROWSER_V3_TIMEOUT_MS = 20000

export interface BrowserV3Options {
  artifact_hash: string
  validation_run_id: string
  timeout_ms?: number | undefined
}

type CheckId = (typeof V3_CHECKS)[number]

/** 이 실행이 서버 V3 와 무엇이 다른지 — 모든 결과의 근거 첫 줄에 붙는다. */
export const BROWSER_V3_EVIDENCE = '실행기: 이 브라우저의 격리 iframe (서버는 Playwright chromium). 파일 저장은 sandbox 가 막으므로 화면 상태 문구로 확인한다.'

/**
 * 관찰값 → 검사 결과. **순수 함수** — v3.ts 의 판정과 같은 조건을 쓴다.
 * (v3.ts: 전환 실패 / 전환 중 오류 / CASE 1개 / 서명 1종 → fail, 그 밖에 pass)
 */
export function judgeV3(probe: V3Probe, base: ResultFactoryInput, required: Record<CheckId, boolean>, startedAt: number): CheckResult[] {
  const results: CheckResult[] = []

  // --- V3.console_errors
  const consoleEvidence = [BROWSER_V3_EVIDENCE, `load errors=${probe.load_errors}`, `total errors=${probe.total_errors}`, ...probe.errors]
  results.push(
    probe.total_errors > 0
      ? makeResult(base, { check_id: 'V3.console_errors', status: 'fail', required: true, message: `콘솔 오류 ${probe.total_errors}건`, evidence: consoleEvidence, started_at: startedAt })
      : makeResult(base, { check_id: 'V3.console_errors', status: 'pass', required: true, evidence: consoleEvidence, started_at: startedAt }),
  )

  // --- V3.case_switch
  const caseEvidence = [
    BROWSER_V3_EVIDENCE,
    ...probe.case_steps.map((s) => `case ${s.id}: ${s.switched ? '' : '전환 실패(body[data-case] 불변) '}rows=${s.rows} messages=${s.messages || '(없음)'} errors=${s.errors}`),
  ]
  const notSwitched = probe.case_steps.filter((s) => !s.switched).length
  const switchErrors = probe.case_steps.reduce((n, s) => n + s.errors, 0)
  const signatures = new Set(probe.case_steps.map((s) => `${s.rows}|${s.messages}`))
  const caseFail = (message: string): CheckResult => makeResult(base, { check_id: 'V3.case_switch', status: 'fail', required: true, message, evidence: caseEvidence, started_at: startedAt })
  if (probe.case_ids.length === 0) {
    results.push(caseFail('CASE 전환 버튼(button[data-case])이 없다'))
  } else if (notSwitched > 0) {
    results.push(caseFail(`CASE ${notSwitched}개가 전환되지 않았다 (data-case 클릭 후 body[data-case] 불변)`))
  } else if (switchErrors > 0) {
    results.push(caseFail(`CASE 전환 중 콘솔 오류 ${switchErrors}건`))
  } else if (probe.case_ids.length < 2) {
    results.push(caseFail('CASE 가 1개뿐이라 전환에 따른 변화를 검증할 수 없다 (설계 §8: 정상·빈값·오류 CASE)'))
  } else if (signatures.size < 2) {
    results.push(caseFail('CASE 를 바꿔도 표 행 수·메시지가 달라지지 않는다 (fixture 가 같거나 전환이 동작하지 않음)'))
  } else {
    results.push(makeResult(base, { check_id: 'V3.case_switch', status: 'pass', required: true, evidence: caseEvidence, started_at: startedAt }))
  }

  // --- V3.search_filter
  if (!required['V3.search_filter']) {
    results.push(notRun(base, 'V3.search_filter', false, '검색(filter-fixture) 동작이 없어 검사하지 않음'))
  } else if (!probe.search.ran) {
    results.push(
      makeResult(base, {
        check_id: 'V3.search_filter',
        status: 'fail',
        required: true,
        message: probe.search.reason ?? '검색 필터를 실행하지 못했다',
        evidence: [BROWSER_V3_EVIDENCE, `cases=${probe.case_ids.join(',')}`],
        started_at: startedAt,
      }),
    )
  } else {
    const s = probe.search
    const before = s.before ?? 0
    const matched = s.matched ?? 0
    const none = s.none ?? 0
    const fresh = s.errors ?? 0
    const evidence = [
      BROWSER_V3_EVIDENCE,
      `case=${s.case_id} input=${s.selector} submit=${s.submit === 'trigger' ? 'trigger click' : 'Enter'} value="${s.value}" rows ${before} → ${matched}`,
      `value="__con-ai-no-match__" rows ${before} → ${none} messages=${s.messages || '(없음)'}`,
      ...(fresh > 0 ? [`errors=${fresh}`] : []),
    ]
    const decreased = before >= 2 ? matched >= 1 && matched < before : matched === before
    const emptied = none === 0
    if (fresh === 0 && decreased && emptied) {
      results.push(makeResult(base, { check_id: 'V3.search_filter', status: 'pass', required: true, evidence, started_at: startedAt }))
    } else {
      const reasons: string[] = []
      if (!decreased) reasons.push(before >= 2 ? `일치 검색어로 행 수가 줄지 않았다 (${before} → ${matched})` : `일치 검색어인데 행이 사라졌다 (${before} → ${matched})`)
      if (!emptied) reasons.push(`불일치 검색어인데 행이 남았다 (${none})`)
      if (fresh > 0) reasons.push(`검색 중 콘솔 오류 ${fresh}건`)
      results.push(makeResult(base, { check_id: 'V3.search_filter', status: 'fail', required: true, message: reasons.join('; '), evidence, started_at: startedAt }))
    }
  }

  // --- V3.download
  if (!required['V3.download']) {
    results.push(notRun(base, 'V3.download', false, '다운로드(download-fixture) 동작이 없어 검사하지 않음'))
  } else if (!probe.download.ran) {
    results.push(
      makeResult(base, {
        check_id: 'V3.download',
        status: 'fail',
        required: true,
        message: probe.download.reason ?? '다운로드를 실행하지 못했다',
        evidence: [BROWSER_V3_EVIDENCE],
        started_at: startedAt,
      }),
    )
  } else {
    const status = probe.download.status_text ?? ''
    const fresh = probe.download.errors ?? 0
    const evidence = [BROWSER_V3_EVIDENCE, 'download event 없음 (sandbox iframe 은 파일 저장이 막힌다; 오류 여부와 상태 문구로 판정)', ...(status ? [`status: ${status}`] : [])]
    if (fresh > 0) {
      results.push(makeResult(base, { check_id: 'V3.download', status: 'fail', required: true, message: `다운로드 클릭 중 콘솔 오류 ${fresh}건`, evidence, started_at: startedAt }))
    } else if (!status.includes('다운로드')) {
      results.push(makeResult(base, { check_id: 'V3.download', status: 'fail', required: true, message: '다운로드 버튼을 눌렀지만 상태 표시가 없다 (동작하지 않음)', evidence, started_at: startedAt }))
    } else {
      results.push(makeResult(base, { check_id: 'V3.download', status: 'pass', required: true, evidence, started_at: startedAt }))
    }
  }

  return results
}

/** 돌릴 수 없을 때의 결과 — 전부 error 다. 미실행·오류를 통과로 바꾸지 않는다. */
export function v3ErrorResults(html: string, base: ResultFactoryInput, message: string, evidence: string[], startedAt: number): CheckResult[] {
  const required = v3RequiredFlags(html)
  return V3_CHECKS.map((id) => makeResult(base, { check_id: id, status: 'error', required: required[id], message, evidence: [BROWSER_V3_EVIDENCE, ...evidence], started_at: startedAt }))
}

interface HostDoc {
  createElement: Document['createElement']
  body: { appendChild: (n: never) => unknown }
}

/** 브라우저 문서가 있는가 (테스트·SSR 에서는 없다). */
function hostDocument(): HostDoc | null {
  const doc = (globalThis as { document?: unknown }).document
  if (typeof doc !== 'object' || doc === null) return null
  const d = doc as Document
  return typeof d.createElement === 'function' && d.body ? (d as unknown as HostDoc) : null
}

/**
 * 산출물 HTML 을 격리 iframe 에서 실제로 조작해 V3 를 실행한다.
 * 문서가 없거나 시간 안에 끝나지 않으면 `error` 를 돌려준다 (통과가 아니다).
 */
export async function runV3InBrowser(html: string, opts: BrowserV3Options): Promise<CheckResult[]> {
  const base: ResultFactoryInput = { artifact_hash: opts.artifact_hash, validation_run_id: opts.validation_run_id, stage: 'V3' }
  const startedAt = Date.now()
  const timeout = opts.timeout_ms ?? DEFAULT_BROWSER_V3_TIMEOUT_MS
  const doc = hostDocument()
  if (!doc) {
    return v3ErrorResults(html, base, '이 환경에는 문서(document)가 없어 실행 검사를 돌리지 못했다', ['document 없음 — 브라우저 밖에서 호출됨'], startedAt)
  }

  const iframe = (doc as unknown as Document).createElement('iframe')
  iframe.setAttribute('sandbox', 'allow-scripts')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.setAttribute('title', 'V3 실행 검사')
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:1280px;height:900px;border:0;visibility:hidden'
  iframe.srcdoc = injectHarness(html)

  const win = globalThis as unknown as Window
  let onMessage: ((e: MessageEvent) => void) | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    const probe = await new Promise<V3Probe>((resolve, reject) => {
      onMessage = (event: MessageEvent) => {
        if (event.source !== iframe.contentWindow) return
        const data = event.data as { type?: string; payload?: unknown } | null
        if (!data || typeof data.type !== 'string') return
        if (data.type === V3_READY_MESSAGE) {
          iframe.contentWindow?.postMessage({ type: V3_RUN_MESSAGE }, '*')
          return
        }
        if (data.type !== V3_DONE_MESSAGE) return
        const payload = data.payload as (V3Probe & { failed?: string }) | null
        if (!payload || typeof payload !== 'object') return reject(new Error('조사 결과를 읽지 못했다'))
        if (typeof payload.failed === 'string') return reject(new Error(`조사 중 오류: ${payload.failed}`))
        resolve(payload)
      }
      win.addEventListener('message', onMessage)
      timer = setTimeout(() => reject(new Error(`제한 시간 ${timeout}ms 초과`)), timeout)
      ;(doc.body as unknown as HTMLElement).appendChild(iframe)
    })
    return judgeV3(probe, base, v3RequiredFlags(html), startedAt)
  } catch (e) {
    return v3ErrorResults(html, base, `실행 오류: ${e instanceof Error ? e.message : String(e)}`, [], startedAt)
  } finally {
    if (timer !== undefined) clearTimeout(timer)
    if (onMessage) win.removeEventListener('message', onMessage)
    iframe.remove()
  }
}
