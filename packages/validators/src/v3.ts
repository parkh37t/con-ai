/**
 * V3 실행 검사 (설계 §10 V3: 콘솔 오류, 검색·정렬·CASE·팝업·다운로드) — Playwright chromium headless.
 *
 * 브라우저 실행 순서: opts.executable_path → env PLAYWRIGHT_CHROMIUM_PATH → 기본 launch → (실패 시) /opt/pw-browsers/chromium 이 있으면 재시도.
 * 못 띄우면 모든 V3 결과를 status 'error' 로 기록한다 (통과 아님; 설계 §10 "도구 미설치를 성공으로 표시하지 않음"; 보고서 §5).
 *
 * - V3.console_errors: setContent 부터 모든 상호작용까지 console.error / pageerror 0건.
 * - V3.case_switch   : 툴바의 모든 data-case 버튼을 눌러 body[data-case] 가 바뀌고 오류가 없으며, CASE 간 표 행 수·메시지가 달라진다.
 * - V3.search_filter : (filter-fixture 동작이 있을 때만 required) 검색어 입력 → 필터 후 행 수 감소, 불일치 검색어 → 0행.
 * - V3.download      : (download-fixture 동작이 있을 때만 required) 다운로드 버튼 클릭 시 오류 없음 (download 이벤트는 evidence 로 기록).
 */
import { existsSync } from 'node:fs'
import { chromium, type Browser, type Page } from 'playwright'
import { makeResult, newRunId, notRun, type ResultFactoryInput } from './result.js'
import type { CheckResult, V3Options } from './types.js'

export const V3_CHECKS = ['V3.console_errors', 'V3.case_switch', 'V3.search_filter', 'V3.download'] as const
export const FALLBACK_CHROMIUM_PATH = '/opt/pw-browsers/chromium'
export const DEFAULT_V3_TIMEOUT_MS = 20000

export interface LaunchAttempt {
  label: string
  executablePath?: string
}

/** 실행 파일 결정 순서 (모듈 주석 참고). */
export function launchPlan(env: NodeJS.ProcessEnv, explicit?: string | undefined): LaunchAttempt[] {
  if (explicit !== undefined && explicit !== '') return [{ label: `executable_path=${explicit}`, executablePath: explicit }]
  const fromEnv = env.PLAYWRIGHT_CHROMIUM_PATH
  if (fromEnv !== undefined && fromEnv !== '') return [{ label: `PLAYWRIGHT_CHROMIUM_PATH=${fromEnv}`, executablePath: fromEnv }]
  const plan: LaunchAttempt[] = [{ label: '기본 launch (Playwright 번들 브라우저)' }]
  if (existsSync(FALLBACK_CHROMIUM_PATH)) plan.push({ label: `fallback ${FALLBACK_CHROMIUM_PATH}`, executablePath: FALLBACK_CHROMIUM_PATH })
  return plan
}

/** 렌더러가 body[data-action-types] 에 적은 명세 동작 종류 (없으면 트리거 표식으로 추정). */
export function actionTypesOf(html: string): Set<string> {
  const m = /<body\b[^>]*\bdata-action-types="([^"]*)"/.exec(html)
  if (m) return new Set((m[1] ?? '').split(/\s+/).filter(Boolean))
  const found = new Set<string>()
  const re = /data-action-type="([^"]+)"/g
  let a: RegExpExecArray | null
  while ((a = re.exec(html)) !== null) if (a[1] !== undefined) found.add(a[1])
  return found
}

/** 검사별 필수 여부 — 조건부 검사는 명세에 해당 동작이 있을 때만 필수 (index.ts requiredChecksFor 와 같은 규칙). */
export function v3RequiredFlags(html: string): Record<(typeof V3_CHECKS)[number], boolean> {
  const types = actionTypesOf(html)
  return {
    'V3.console_errors': true,
    'V3.case_switch': true,
    'V3.search_filter': types.has('filter-fixture'),
    'V3.download': types.has('download-fixture'),
  }
}

class V3Timeout extends Error {
  constructor(ms: number) {
    super(`V3 제한 시간 ${ms}ms 초과`)
    this.name = 'V3Timeout'
  }
}

function firstLine(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.split('\n')[0] ?? msg
}

function cssEscape(v: string): string {
  return v.replace(/["\\]/g, '\\$&')
}

async function launchBrowser(plan: LaunchAttempt[], timeout: number): Promise<{ browser: Browser | undefined; evidence: string[] }> {
  const evidence: string[] = []
  for (const attempt of plan) {
    try {
      const options: Parameters<typeof chromium.launch>[0] = { headless: true, timeout }
      if (attempt.executablePath !== undefined) options.executablePath = attempt.executablePath
      const browser = await chromium.launch(options)
      evidence.push(`launch ok: ${attempt.label} (chromium ${browser.version()})`)
      return { browser, evidence }
    } catch (e) {
      evidence.push(`launch failed: ${attempt.label} — ${firstLine(e)}`)
    }
  }
  return { browser: undefined, evidence }
}

interface Session {
  page: Page
  errors: string[]
  remaining: () => number
}

async function rowCount(page: Page): Promise<number> {
  return page.locator('tr[data-row]').count()
}

async function visibleMessageIds(page: Page): Promise<string> {
  return page.$$eval('[data-messages] [data-message-id]', (els) => els.map((e) => e.getAttribute('data-message-id') ?? '').join(','))
}

/** 짧게 기다리는 상한 — 전환은 동기 동작이므로 이 안에 안 바뀌면 전환 실패로 본다. */
const SWITCH_WAIT_MS = 1500

async function currentCase(s: Session): Promise<string> {
  return s.page.evaluate(() => document.body.getAttribute('data-case') ?? '')
}

/**
 * CASE 버튼을 눌러 body[data-case] 가 다른 값에서 id 로 바뀌면 true. 이미 그 CASE 였다면 전환을 확인할 수 없으므로 false
 * (전환 실패는 도구 오류가 아니라 판정 근거).
 */
async function clickCase(s: Session, id: string): Promise<boolean> {
  if ((await currentCase(s)) === id) return false
  await s.page.click(`button[data-case="${cssEscape(id)}"]`, { timeout: s.remaining() })
  try {
    await s.page.waitForFunction((want) => document.body.getAttribute('data-case') === want, id, { timeout: Math.min(SWITCH_WAIT_MS, s.remaining()) })
    return true
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') return false
    throw e
  }
}

/** 이미 그 CASE 면 그대로 두고, 아니면 전환한다. */
async function ensureCase(s: Session, id: string): Promise<boolean> {
  if ((await currentCase(s)) === id) return true
  return clickCase(s, id)
}

async function checkCaseSwitch(s: Session, base: ResultFactoryInput, started: number): Promise<CheckResult> {
  const caseIds = await s.page.$$eval('button[data-case]', (els) => els.map((e) => e.getAttribute('data-case') ?? ''))
  if (caseIds.length === 0) {
    return makeResult(base, { check_id: 'V3.case_switch', status: 'fail', required: true, message: 'CASE 전환 버튼(button[data-case])이 없다', started_at: started })
  }
  // 현재 CASE 를 먼저 누르면 body[data-case] 가 그대로라 전환을 확인할 수 없으므로, 현재 CASE 다음부터 돌아가며 누른다.
  const current = await currentCase(s)
  const startAt = caseIds.indexOf(current) + 1
  const order = caseIds.map((_, i) => caseIds[(startAt + i) % caseIds.length] ?? '')
  const evidence: string[] = []
  const signatures = new Set<string>()
  let switchErrors = 0
  let notSwitched = 0
  for (const id of order) {
    const before = s.errors.length
    const switched = await clickCase(s, id)
    const rows = await rowCount(s.page)
    const msgs = await visibleMessageIds(s.page)
    const fresh = s.errors.length - before
    switchErrors += fresh
    if (!switched) notSwitched++
    signatures.add(`${rows}|${msgs}`)
    evidence.push(`case ${id}: ${switched ? '' : '전환 실패(body[data-case] 불변) '}rows=${rows} messages=${msgs || '(없음)'} errors=${fresh}`)
  }
  if (notSwitched > 0) {
    return makeResult(base, { check_id: 'V3.case_switch', status: 'fail', required: true, message: `CASE ${notSwitched}개가 전환되지 않았다 (data-case 클릭 후 body[data-case] 불변)`, evidence, started_at: started })
  }
  if (switchErrors > 0) {
    return makeResult(base, { check_id: 'V3.case_switch', status: 'fail', required: true, message: `CASE 전환 중 콘솔 오류 ${switchErrors}건`, evidence, started_at: started })
  }
  if (caseIds.length < 2) {
    return makeResult(base, { check_id: 'V3.case_switch', status: 'fail', required: true, message: 'CASE 가 1개뿐이라 전환에 따른 변화를 검증할 수 없다 (설계 §8: 정상·빈값·오류 CASE)', evidence, started_at: started })
  }
  if (signatures.size < 2) {
    return makeResult(base, { check_id: 'V3.case_switch', status: 'fail', required: true, message: 'CASE 를 바꿔도 표 행 수·메시지가 달라지지 않는다 (fixture 가 같거나 전환이 동작하지 않음)', evidence, started_at: started })
  }
  return makeResult(base, { check_id: 'V3.case_switch', status: 'pass', required: true, evidence, started_at: started })
}

/** 표시된 행들 가운데 한 행에만 나오는 셀 값을 고른다 (첫 컬럼 우선). */
async function pickUniqueCellValue(page: Page): Promise<string | undefined> {
  const grid = await page.$$eval('tr[data-row]', (trs) => trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent ?? '').trim())))
  if (grid.length === 0) return undefined
  const width = Math.max(...grid.map((r) => r.length))
  for (let col = 0; col < width; col++) {
    const values = grid.map((r) => r[col] ?? '')
    for (const v of values) {
      if (v !== '' && values.filter((x) => x === v).length === 1) return v
    }
  }
  const first = grid[0]?.find((v) => v !== '')
  return first
}

async function fillSearchInput(s: Session, value: string): Promise<string> {
  // 검색 동작에 연결된 입력 중 텍스트 계열을 우선 고른다 (인라인 데이터의 action.inputs).
  const selector = await s.page.evaluate(() => {
    const dataEl = document.getElementById('con-ai-data')
    let inputs: string[] = []
    try {
      const data = JSON.parse(dataEl?.textContent ?? '{}') as { actions?: Array<{ type: string; inputs?: string[] }> }
      const action = (data.actions ?? []).find((a) => a.type === 'filter-fixture')
      inputs = action?.inputs ?? []
    } catch {
      inputs = []
    }
    const textTypes = ['text-input', 'number-input', 'textarea']
    for (const id of inputs) {
      const el = document.querySelector(`[data-input-for="${id.replace(/["\\]/g, '\\$&')}"]`)
      if (el && textTypes.includes(el.getAttribute('data-input-type') ?? '')) return `[data-input-for="${id}"]`
    }
    const any = document.querySelector('[data-region="screen"] input[type="text"][data-input-for]')
    if (any) return `[data-input-for="${any.getAttribute('data-input-for') ?? ''}"]`
    return ''
  })
  if (selector === '') throw new Error('검색 동작에 연결된 텍스트 입력이 없다')
  await s.page.fill(selector, value, { timeout: s.remaining() })
  return selector
}

async function checkSearchFilter(s: Session, base: ResultFactoryInput, started: number): Promise<CheckResult> {
  const evidence: string[] = []
  const caseIds = await s.page.$$eval('button[data-case]', (els) => els.map((e) => e.getAttribute('data-case') ?? ''))
  // 행이 가장 많은 CASE 를 고른다 (감소를 보이려면 2행 이상이 좋다).
  let bestCase: string | undefined
  let bestRows = 0
  for (const id of caseIds) {
    if (!(await ensureCase(s, id))) {
      return makeResult(base, { check_id: 'V3.search_filter', status: 'fail', required: true, message: `CASE ${id} 로 전환되지 않아 검색 필터를 검증할 수 없다`, evidence: [`cases=${caseIds.join(',')}`], started_at: started })
    }
    const rows = await rowCount(s.page)
    if (rows > bestRows) {
      bestRows = rows
      bestCase = id
    }
  }
  if (bestCase === undefined || bestRows === 0) {
    return makeResult(base, { check_id: 'V3.search_filter', status: 'fail', required: true, message: '어떤 CASE 에도 더미 행이 없어 검색 필터를 검증할 수 없다', evidence: [`cases=${caseIds.join(',')}`], started_at: started })
  }
  await ensureCase(s, bestCase)
  const before = await rowCount(s.page)
  const value = await pickUniqueCellValue(s.page)
  if (value === undefined) {
    return makeResult(base, { check_id: 'V3.search_filter', status: 'fail', required: true, message: '검색어로 쓸 셀 값이 없다', evidence: [`case=${bestCase} rows=${before}`], started_at: started })
  }
  const errorsBefore = s.errors.length
  const trigger = '[data-action-type="filter-fixture"]'
  const hasTrigger = (await s.page.locator(trigger).count()) > 0
  const submit = async (selector: string): Promise<void> => {
    if (hasTrigger) await s.page.click(trigger, { timeout: s.remaining() })
    else await s.page.press(selector, 'Enter', { timeout: s.remaining() })
  }
  const selector = await fillSearchInput(s, value)
  await submit(selector)
  const matched = await rowCount(s.page)
  evidence.push(`case=${bestCase} input=${selector} submit=${hasTrigger ? 'trigger click' : 'Enter'} value="${value}" rows ${before} → ${matched}`)

  await fillSearchInput(s, '__con-ai-no-match__')
  await submit(selector)
  const none = await rowCount(s.page)
  const msgs = await visibleMessageIds(s.page)
  evidence.push(`value="__con-ai-no-match__" rows ${before} → ${none} messages=${msgs || '(없음)'}`)
  const fresh = s.errors.length - errorsBefore
  if (fresh > 0) evidence.push(`errors=${fresh}`)

  const decreased = before >= 2 ? matched >= 1 && matched < before : matched === before
  const emptied = none === 0
  if (fresh === 0 && decreased && emptied) {
    return makeResult(base, { check_id: 'V3.search_filter', status: 'pass', required: true, evidence, started_at: started })
  }
  const reasons: string[] = []
  if (!decreased) reasons.push(before >= 2 ? `일치 검색어로 행 수가 줄지 않았다 (${before} → ${matched})` : `일치 검색어인데 행이 사라졌다 (${before} → ${matched})`)
  if (!emptied) reasons.push(`불일치 검색어인데 행이 남았다 (${none})`)
  if (fresh > 0) reasons.push(`검색 중 콘솔 오류 ${fresh}건`)
  return makeResult(base, { check_id: 'V3.search_filter', status: 'fail', required: true, message: reasons.join('; '), evidence, started_at: started })
}

async function checkDownload(s: Session, base: ResultFactoryInput, started: number): Promise<CheckResult> {
  const errorsBefore = s.errors.length
  const evidence: string[] = []
  if ((await s.page.locator('[data-action-type="download-fixture"]').count()) === 0) {
    return makeResult(base, { check_id: 'V3.download', status: 'fail', required: true, message: 'download-fixture 동작을 실행할 trigger 요소(버튼·링크)가 화면에 없다', started_at: started })
  }
  const waitMs = Math.min(3000, s.remaining())
  const download = s.page
    .waitForEvent('download', { timeout: waitMs })
    .then((d) => `download event: ${d.suggestedFilename()}`)
    .catch(() => 'download event 없음 (환경에 따라 저장이 막힐 수 있음; 오류 여부만 판정)')
  await s.page.click('[data-action-type="download-fixture"]', { timeout: s.remaining() })
  evidence.push(await download)
  const status = await s.page.$eval('[data-screen-status] [data-status]', (el) => el.textContent ?? '').catch(() => '')
  if (status) evidence.push(`status: ${status}`)
  const fresh = s.errors.length - errorsBefore
  if (fresh > 0) {
    return makeResult(base, { check_id: 'V3.download', status: 'fail', required: true, message: `다운로드 클릭 중 콘솔 오류 ${fresh}건`, evidence, started_at: started })
  }
  const fired = evidence[0]?.startsWith('download event:') === true
  if (!fired && !status.includes('다운로드')) {
    return makeResult(base, { check_id: 'V3.download', status: 'fail', required: true, message: '다운로드 버튼을 눌렀지만 download 이벤트도 상태 표시도 없다 (동작하지 않음)', evidence, started_at: started })
  }
  return makeResult(base, { check_id: 'V3.download', status: 'pass', required: true, evidence, started_at: started })
}

export async function runV3(html: string, opts: V3Options): Promise<CheckResult[]> {
  const base: ResultFactoryInput = { artifact_hash: opts.artifact_hash, validation_run_id: opts.validation_run_id ?? newRunId(), stage: 'V3' }
  const timeout = opts.timeout_ms ?? DEFAULT_V3_TIMEOUT_MS
  const started = Date.now()
  const deadline = started + timeout
  const required = v3RequiredFlags(html)
  const remaining = (): number => {
    const r = deadline - Date.now()
    if (r <= 0) throw new V3Timeout(timeout)
    return r
  }

  const { browser, evidence: launchEvidence } = await launchBrowser(launchPlan(process.env, opts.executable_path), timeout)
  if (!browser) {
    const message = `브라우저를 띄우지 못했다 — 실행 오류는 통과가 아니다 (설계 §10). ${launchEvidence[launchEvidence.length - 1] ?? ''}`
    return V3_CHECKS.map((id) => makeResult(base, { check_id: id, status: 'error', required: required[id], message, evidence: launchEvidence, started_at: started }))
  }

  const errors: string[] = []
  const results: CheckResult[] = []
  const pending: Array<(typeof V3_CHECKS)[number]> = ['V3.case_switch', 'V3.search_filter', 'V3.download']
  const finish = (r: CheckResult): void => {
    results.push(r)
    const i = pending.indexOf(r.check_id as (typeof V3_CHECKS)[number])
    if (i >= 0) pending.splice(i, 1)
  }
  try {
    const page = await browser.newPage()
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console.error: ${m.text()}`)
    })
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    const s: Session = { page, errors, remaining }
    await page.setContent(html, { waitUntil: 'load', timeout: remaining() })
    const loadErrors = errors.length

    finish(await checkCaseSwitch(s, base, started))
    if (required['V3.search_filter']) finish(await checkSearchFilter(s, base, started))
    else finish(notRun(base, 'V3.search_filter', false, '검색(filter-fixture) 동작이 없어 검사하지 않음'))
    if (required['V3.download']) finish(await checkDownload(s, base, started))
    else finish(notRun(base, 'V3.download', false, '다운로드(download-fixture) 동작이 없어 검사하지 않음'))

    const consoleEvidence = [...launchEvidence, `load errors=${loadErrors}`, `total errors=${errors.length}`, ...errors.slice(0, 20)]
    results.unshift(
      errors.length > 0
        ? makeResult(base, { check_id: 'V3.console_errors', status: 'fail', required: true, message: `콘솔 오류 ${errors.length}건`, evidence: consoleEvidence, started_at: started })
        : makeResult(base, { check_id: 'V3.console_errors', status: 'pass', required: true, evidence: consoleEvidence, started_at: started }),
    )
  } catch (e) {
    const timedOut = e instanceof V3Timeout || (e instanceof Error && e.name === 'TimeoutError')
    const reason = `${timedOut ? '제한 시간 초과' : '실행 오류'}: ${firstLine(e)}`
    const evidence = [...launchEvidence, ...errors.slice(0, 20)]
    const current = pending[0]
    if (current !== undefined) finish(makeResult(base, { check_id: current, status: 'error', required: required[current], message: reason, evidence, started_at: started }))
    for (const id of [...pending]) finish(notRun(base, id, required[id], `이전 단계 오류로 실행하지 않음 (${reason})`))
    results.unshift(makeResult(base, { check_id: 'V3.console_errors', status: 'error', required: true, message: reason, evidence, started_at: started }))
  } finally {
    await browser.close().catch(() => undefined)
  }
  return results
}
