import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { EXAMPLE_ORDER_LIST, EXAMPLE_ORDER_LIST_EXTENDED, type ScreenSpecInput } from '@con-ai/schemas'
import { actionTypesOf, launchPlan, runV3, V3_CHECKS, v3RequiredFlags } from './v3.js'
import { byId, ensureChromiumEnv, expectSchemaConform, loadFixtureSpec, renderFixture, statusOf } from './test-helpers.js'

const LONG = 60_000

beforeAll(() => ensureChromiumEnv())
afterEach(() => vi.unstubAllEnvs())

describe('V3 브라우저 실행 파일 결정', () => {
  it('명시 경로 > PLAYWRIGHT_CHROMIUM_PATH > 기본 launch(+ /opt/pw-browsers/chromium 재시도) 순서다', () => {
    expect(launchPlan({ PLAYWRIGHT_CHROMIUM_PATH: '/env/chrome' }, '/explicit/chrome')).toEqual([{ label: 'executable_path=/explicit/chrome', executablePath: '/explicit/chrome' }])
    expect(launchPlan({ PLAYWRIGHT_CHROMIUM_PATH: '/env/chrome' })).toEqual([{ label: 'PLAYWRIGHT_CHROMIUM_PATH=/env/chrome', executablePath: '/env/chrome' }])
    const plan = launchPlan({})
    expect(plan[0]?.label).toContain('기본 launch')
    expect(plan.length).toBeGreaterThanOrEqual(1)
    expect(plan.length).toBeLessThanOrEqual(2)
  })

  it('필수 여부는 body[data-action-types] 의 동작 종류로 정한다', () => {
    const { html } = renderFixture(loadFixtureSpec('valid'))
    expect([...actionTypesOf(html)]).toEqual(['filter-fixture', 'sort-fixture', 'download-fixture', 'open-popup', 'set-state'])
    expect(v3RequiredFlags(html)).toEqual({ 'V3.console_errors': true, 'V3.case_switch': true, 'V3.search_filter': true, 'V3.download': true })
    expect(v3RequiredFlags('<body><button data-action-type="filter-fixture"></button></body>')['V3.search_filter']).toBe(true)
    expect(v3RequiredFlags('<body data-action-types=""></body>')['V3.search_filter']).toBe(false)
  })
})

describe('V3 실행 검사 — 실제 headless chromium (설계 §10 V3)', () => {
  it(
    'valid 명세의 HTML: 콘솔 오류 0, CASE 전환마다 행 수·메시지 변화, 검색 필터 감소, 다운로드 오류 없음 → 전부 pass',
    async () => {
      const { html, artifact_hash } = renderFixture(loadFixtureSpec('valid'))
      const results = await runV3(html, { artifact_hash })
      expect(results.map((r) => r.check_id)).toEqual([...V3_CHECKS])
      expect(statusOf(results)).toEqual({ 'V3.console_errors': 'pass', 'V3.case_switch': 'pass', 'V3.search_filter': 'pass', 'V3.download': 'pass' })
      expect(results.every((r) => r.required && r.stage === 'V3' && r.artifact_hash === artifact_hash)).toBe(true)
      expectSchemaConform(results)

      const cases = byId(results, 'V3.case_switch')
      // 초기 CASE(normal) 다음부터 돌아가며 누른다 — 매 클릭이 실제 전환이 되도록
      expect(cases.evidence).toEqual([
        'case searched: rows=1 messages=(없음) errors=0',
        'case empty: rows=0 messages=msg-empty errors=0',
        'case error: rows=0 messages=msg-error errors=0',
        'case normal: rows=3 messages=(없음) errors=0',
      ])
      const search = byId(results, 'V3.search_filter')
      expect(search.evidence[0]).toMatch(/^case=normal input=\[data-input-for="query"\] submit=trigger click value="EX-2026-000\d" rows 3 → 1$/)
      expect(search.evidence[1]).toBe('value="__con-ai-no-match__" rows 3 → 0 messages=msg-empty')
      const download = byId(results, 'V3.download')
      expect(download.evidence.join('\n')).toContain('download')
      expect(download.evidence.join('\n')).toContain('다운로드(더미)')
      const console_ = byId(results, 'V3.console_errors')
      expect(console_.evidence[0]).toMatch(/^launch ok: /)
      expect(console_.evidence).toContain('total errors=0')
      expect(console_.duration_ms).toBeGreaterThanOrEqual(0)
    },
    LONG,
  )

  it(
    '트리거 버튼이 없는 검색은 Enter 로 실행하고, 다운로드 동작이 없으면 V3.download 는 not_run·required=false',
    async () => {
      const { html, artifact_hash } = renderFixture(EXAMPLE_ORDER_LIST)
      const results = await runV3(html, { artifact_hash })
      expect(statusOf(results)).toEqual({ 'V3.console_errors': 'pass', 'V3.case_switch': 'pass', 'V3.search_filter': 'pass', 'V3.download': 'not_run' })
      expect(byId(results, 'V3.search_filter').required).toBe(true)
      expect(byId(results, 'V3.search_filter').evidence[0]).toContain('submit=Enter')
      expect(byId(results, 'V3.download').required).toBe(false)
      expect(byId(results, 'V3.download').message).toContain('download-fixture')
      expectSchemaConform(results)
    },
    LONG,
  )

  it(
    '검색 동작이 없는 명세는 V3.search_filter 가 not_run·required=false 다 (통과가 아니라 미실행)',
    async () => {
      const spec: ScreenSpecInput = { ...structuredClone(EXAMPLE_ORDER_LIST_EXTENDED), actions: [{ id: 'show-error', type: 'set-state', target_state_id: 'error' }] }
      const { html, artifact_hash } = renderFixture(spec)
      const results = await runV3(html, { artifact_hash })
      expect(statusOf(results)).toEqual({ 'V3.console_errors': 'pass', 'V3.case_switch': 'pass', 'V3.search_filter': 'not_run', 'V3.download': 'not_run' })
      expect(byId(results, 'V3.search_filter').required).toBe(false)
    },
    LONG,
  )

  it(
    '스크립트 오류가 있는 HTML 은 V3.console_errors fail 이고 evidence 에 오류 문구가 남는다',
    async () => {
      const { html, artifact_hash } = renderFixture(loadFixtureSpec('valid'))
      const broken = html.replace('</body>', '<script>window.__boom = undefined.x;</script><script>console.error("의도한 콘솔 오류")</script></body>')
      const results = await runV3(broken, { artifact_hash })
      const c = byId(results, 'V3.console_errors')
      expect(c.status).toBe('fail')
      expect(c.message).toBe('콘솔 오류 2건')
      expect(c.evidence.some((e) => e.startsWith('pageerror: '))).toBe(true)
      expect(c.evidence).toContain('console.error: 의도한 콘솔 오류')
      expect(c.evidence).toContain('load errors=2')
      // 페이지 자체 동작은 살아 있으므로 나머지는 여전히 판정된다
      expect(byId(results, 'V3.case_switch').status).toBe('pass')
      expectSchemaConform(results)
    },
    LONG,
  )

  it(
    '스크립트가 동작하지 않는 HTML 은 콘솔 오류가 없어도 CASE 전환·검색·다운로드가 fail 이다 (콘솔 오류 0 만으로 통과하지 않음; 보고서 §5)',
    async () => {
      const { html, artifact_hash } = renderFixture(loadFixtureSpec('valid'))
      const dead = html.replace('<script id="con-ai-data"', '<script id="con-ai-data-off"')
      const results = await runV3(dead, { artifact_hash })
      expect(statusOf(results)).toEqual({ 'V3.console_errors': 'pass', 'V3.case_switch': 'fail', 'V3.search_filter': 'fail', 'V3.download': 'fail' })
      const cases = byId(results, 'V3.case_switch')
      expect(cases.message).toBe('CASE 4개가 전환되지 않았다 (data-case 클릭 후 body[data-case] 불변)')
      expect(cases.evidence[0]).toBe('case searched: 전환 실패(body[data-case] 불변) rows=3 messages=(없음) errors=0')
      expect(byId(results, 'V3.search_filter').message).toContain('전환되지 않아')
      expect(byId(results, 'V3.download').message).toContain('동작하지 않음')
      expectSchemaConform(results)
    },
    LONG,
  )

  it(
    '제한 시간을 넘기면 진행 중 검사는 error, 남은 검사는 not_run 으로 기록한다',
    async () => {
      const { html, artifact_hash } = renderFixture(loadFixtureSpec('valid'))
      const results = await runV3(html, { artifact_hash, timeout_ms: 1 })
      expect(results.map((r) => r.check_id)).toEqual([...V3_CHECKS])
      expect(results.every((r) => r.status === 'error' || r.status === 'not_run')).toBe(true)
      expect(byId(results, 'V3.console_errors').status).toBe('error')
      expect(byId(results, 'V3.console_errors').message).toMatch(/제한 시간|실행 오류/)
      expectSchemaConform(results)
    },
    LONG,
  )

  it(
    '브라우저 경로가 잘못되면 모든 V3 결과가 error 로 기록된다 (통과 아님; evidence 에 launch 오류)',
    async () => {
      vi.stubEnv('PLAYWRIGHT_CHROMIUM_PATH', '/nonexistent/chromium-bin')
      const { html, artifact_hash } = renderFixture(loadFixtureSpec('valid'))
      const results = await runV3(html, { artifact_hash, timeout_ms: 5000 })
      expect(results.map((r) => r.check_id)).toEqual([...V3_CHECKS])
      expect(results.every((r) => r.status === 'error')).toBe(true)
      for (const r of results) {
        expect(r.message).toContain('브라우저를 띄우지 못했다')
        expect(r.evidence).toHaveLength(1)
        expect(r.evidence[0]).toMatch(/^launch failed: PLAYWRIGHT_CHROMIUM_PATH=\/nonexistent\/chromium-bin — /)
      }
      expect(byId(results, 'V3.search_filter').required).toBe(true)
      expectSchemaConform(results)
      // 명시 옵션도 같은 규칙
      const explicit = await runV3(html, { artifact_hash, executable_path: '/nonexistent/other', timeout_ms: 5000 })
      expect(explicit.every((r) => r.status === 'error')).toBe(true)
      expect(explicit[0]?.evidence[0]).toContain('executable_path=/nonexistent/other')
    },
    LONG,
  )
})
