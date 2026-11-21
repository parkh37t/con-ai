import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { EXAMPLE_ORDER_LIST, EXAMPLE_ORDER_LIST_EXTENDED, ValidationResult, findApprovalBlockers } from '@con-ai/schemas'
import { REQUIRED_CHECKS, hashHtml, requiredChecksFor, runAll } from './index.js'
import { V1_CHECKS } from './v1.js'
import { V2_CHECKS } from './v2.js'
import { V3_CHECKS } from './v3.js'
import { byId, ensureChromiumEnv, expectSchemaConform, loadFixtureSpec, loadManifestRequiredCases, renderFixture, renderInputOf, statusOf } from './test-helpers.js'

const LONG = 60_000
const required_cases = loadManifestRequiredCases()
const ALL_IDS = [...V1_CHECKS, ...V2_CHECKS, ...V3_CHECKS]

beforeAll(() => ensureChromiumEnv())
afterEach(() => vi.unstubAllEnvs())

describe('REQUIRED_CHECKS (계약 §5)', () => {
  it('V1·V2 전부와 V3 콘솔·CASE·검색·다운로드가 필수 목록이다', () => {
    expect(REQUIRED_CHECKS).toEqual([
      'V1.schema', 'V1.references', 'V1.required_cases', 'V1.criteria_linked',
      'V2.shell', 'V2.description_order', 'V2.element_ids', 'V2.display_numbers', 'V2.no_external_refs', 'V2.component_content',
      'V3.console_errors', 'V3.case_switch', 'V3.search_filter', 'V3.download',
    ])
  })

  it('requiredChecksFor 는 검색·다운로드 동작이 없는 명세에서 조건부 검사를 뺀다', () => {
    expect(requiredChecksFor(renderInputOf(loadFixtureSpec('valid')).spec)).toEqual(REQUIRED_CHECKS)
    expect(requiredChecksFor(renderInputOf(EXAMPLE_ORDER_LIST).spec)).toEqual(REQUIRED_CHECKS.filter((id) => id !== 'V3.download'))
    expect(requiredChecksFor({ actions: [] })).toEqual(REQUIRED_CHECKS.filter((id) => id !== 'V3.download' && id !== 'V3.search_filter'))
  })

  it('hashHtml 은 SHA-256 소문자 hex 64자다', () => {
    expect(hashHtml('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('runAll — V1 → V2 → V3 (계약 §5)', () => {
  it(
    'valid: 13개 검사 전부 pass, 한 validation_run_id, 승인 차단 결과 없음',
    async () => {
      const spec = loadFixtureSpec('valid')
      const { html, artifact_hash } = renderFixture(spec)
      const results = await runAll({ spec, html, required_cases, artifact_hash })
      expect(results.map((r) => r.check_id)).toEqual(ALL_IDS)
      expect(results.every((r) => r.status === 'pass')).toBe(true)
      expect(new Set(results.map((r) => r.validation_run_id)).size).toBe(1)
      expect(results.every((r) => r.artifact_hash === artifact_hash)).toBe(true)
      expectSchemaConform(results)
      const parsed = results.map((r) => ValidationResult.parse(r))
      expect(findApprovalBlockers(parsed)).toEqual([])
      // 승인 게이트가 요구하는 필수 목록과 결과 id 가 모두 대응한다
      for (const id of requiredChecksFor(renderInputOf(spec).spec)) expect(parsed.some((r) => r.check_id === id && r.required)).toBe(true)
    },
    LONG,
  )

  it(
    'bad-mapping: V1.references fail 이지만 구조는 통과하므로 V2·V3 도 실행된다 — 잘못된 target 은 실행 검사(검색 필터)에서도 드러난다',
    async () => {
      const spec = loadFixtureSpec('bad-mapping')
      const { html, artifact_hash } = renderFixture(spec)
      const results = await runAll({ spec, html, required_cases, artifact_hash })
      expect(results.map((r) => r.check_id)).toEqual(ALL_IDS)
      const status = statusOf(results)
      expect(status['V1.schema']).toBe('pass')
      expect(status['V1.references']).toBe('fail')
      expect(status['V1.criteria_linked']).toBe('pass')
      expect(V2_CHECKS.every((id) => status[id] === 'pass')).toBe(true)
      expect(status['V3.console_errors']).toBe('pass')
      expect(status['V3.case_switch']).toBe('pass')
      expect(status['V3.search_filter']).toBe('fail')
      expect(byId(results, 'V3.search_filter').message).toContain('행 수가 줄지 않았다')
      const blockers = findApprovalBlockers(results.map((r) => ValidationResult.parse(r)))
      expect(blockers.map((b) => b.check_id)).toEqual(['V1.references', 'V3.search_filter'])
    },
    LONG,
  )

  it(
    'missing-case: V1.required_cases fail → 승인 차단; 렌더·실행 자체는 남은 CASE 로 진행된다',
    async () => {
      const spec = loadFixtureSpec('missing-case')
      const { html, artifact_hash } = renderFixture(spec)
      const results = await runAll({ spec, html, required_cases, artifact_hash })
      const status = statusOf(results)
      expect(status['V1.required_cases']).toBe('fail')
      expect(status['V1.criteria_linked']).toBe('fail')
      expect(V2_CHECKS.every((id) => status[id] === 'pass')).toBe(true)
      expect(status['V3.case_switch']).toBe('pass')
      expect(byId(results, 'V3.case_switch').evidence).toHaveLength(2)
      const blockers = findApprovalBlockers(results.map((r) => ValidationResult.parse(r)))
      expect(blockers.map((b) => b.check_id)).toEqual(['V1.required_cases', 'V1.criteria_linked'])
    },
    LONG,
  )

  it('V1.schema 가 실패하면 V2·V3 는 not_run 으로 기록하고 브라우저를 띄우지 않는다', async () => {
    vi.stubEnv('PLAYWRIGHT_CHROMIUM_PATH', '/nonexistent/chromium-bin')
    const { html, artifact_hash } = renderFixture(EXAMPLE_ORDER_LIST_EXTENDED)
    const results = await runAll({ spec: { schema_version: '2.0' }, html, required_cases, artifact_hash })
    expect(results.map((r) => r.check_id)).toEqual(ALL_IDS)
    const status = statusOf(results)
    expect(status['V1.schema']).toBe('fail')
    for (const id of ALL_IDS.slice(1)) expect(status[id], id).toBe('not_run')
    expect(byId(results, 'V2.shell').message).toBe('V1.schema 실패로 실행하지 않음')
    expect(byId(results, 'V3.search_filter').required).toBe(true)
    expect(findApprovalBlockers(results.map((r) => ValidationResult.parse(r))).length).toBe(ALL_IDS.length)
    expectSchemaConform(results)
  })

  it(
    '브라우저를 못 띄우면 V1·V2 는 그대로 판정하고 V3 만 error 다 (승인 후보 불가)',
    async () => {
      vi.stubEnv('PLAYWRIGHT_CHROMIUM_PATH', '/nonexistent/chromium-bin')
      const spec = loadFixtureSpec('valid')
      const { html, artifact_hash } = renderFixture(spec)
      const results = await runAll({ spec, html, required_cases, artifact_hash, timeout_ms: 5000 })
      const status = statusOf(results)
      expect([...V1_CHECKS, ...V2_CHECKS].every((id) => status[id] === 'pass')).toBe(true)
      expect(V3_CHECKS.every((id) => status[id] === 'error')).toBe(true)
      const blockers = findApprovalBlockers(results.map((r) => ValidationResult.parse(r)))
      expect(blockers.map((b) => b.check_id)).toEqual([...V3_CHECKS])
    },
    LONG,
  )
})
