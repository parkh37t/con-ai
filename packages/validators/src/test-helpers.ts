/** 테스트 보조 — fixtures 로드·렌더·hash (테스트 파일에서만 쓴다; index.ts 에서 재수출하지 않는다). */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ScreenSpecShape, ValidationResult, type ScreenSpecInput } from '@con-ai/schemas'
import { S2B_LEARNED_PROFILE, renderScreen, type RenderInput, type RenderMeta } from '@con-ai/renderer'
import { hashHtml } from './index.js'
import type { CheckResult } from './types.js'
import { FALLBACK_CHROMIUM_PATH } from './v3.js'

const FIXTURES_URL = new URL('../../../fixtures/', import.meta.url)

export function readFixtureJson(relative: string): unknown {
  return JSON.parse(readFileSync(fileURLToPath(new URL(relative, FIXTURES_URL)), 'utf8')) as unknown
}

export type FixtureName = 'valid' | 'bad-mapping' | 'missing-case' | 'stale-baseline'

export function loadFixtureSpec(name: FixtureName): unknown {
  return readFixtureJson(`screen-specs/example-order-list.${name}.json`)
}

export function loadManifestRequiredCases(): string[] {
  return (readFixtureJson('manifest.json') as { required_case_kinds: string[] }).required_case_kinds
}

export function loadOrdersDummy(): Record<string, unknown[]> {
  const file = readFixtureJson('synthetic/orders.fixture.json') as { fixtures: Array<{ fixture_id: string; rows: unknown[] }> }
  const out: Record<string, unknown[]> = {}
  for (const f of file.fixtures) out[f.fixture_id] = f.rows
  return out
}

export const EXAMPLE_META: RenderMeta = {
  screen_title: '주문 목록',
  requirements: [{ external_id: 'EXAMPLE-REQ-001', title: '주문 목록 조회', criterion_ids: ['EXAMPLE-AC-01', 'EXAMPLE-AC-02', 'EXAMPLE-AC-03'] }],
  revision_label: 'rev 1',
  generated_by: '더미 어댑터(fixture)',
}

export function renderInputOf(spec: ScreenSpecInput | unknown, overrides: Partial<RenderInput> = {}): RenderInput {
  return { spec: ScreenSpecShape.parse(spec), profile: S2B_LEARNED_PROFILE, dummy: loadOrdersDummy(), meta: EXAMPLE_META, ...overrides }
}

/** 명세를 렌더해 html 과 artifact hash 를 돌려준다. */
export function renderFixture(spec: ScreenSpecInput | unknown, overrides: Partial<RenderInput> = {}): { html: string; artifact_hash: string; spec: ScreenSpecShape } {
  const input = renderInputOf(spec, overrides)
  const { html } = renderScreen(input)
  return { html, artifact_hash: hashHtml(html), spec: input.spec }
}

/** 테스트용 artifact hash — 씨앗 문자열의 SHA-256. */
export function hashOf(seed: string): string {
  return hashHtml(seed)
}

export function statusOf(results: readonly CheckResult[]): Record<string, string> {
  return Object.fromEntries(results.map((r) => [r.check_id, r.status]))
}

export function byId(results: readonly CheckResult[], id: string): CheckResult {
  const r = results.find((x) => x.check_id === id)
  if (!r) throw new Error(`결과에 ${id} 가 없다: ${results.map((x) => x.check_id).join(', ')}`)
  return r
}

/** 모든 결과가 schemas ValidationResult 로 파싱되는지 (fail/error 는 message 필수). */
export function expectSchemaConform(results: readonly CheckResult[]): void {
  for (const r of results) {
    const parsed = ValidationResult.safeParse(r)
    if (!parsed.success) throw new Error(`${r.check_id}: ${parsed.error.issues.map((i) => i.message).join('; ')}`)
  }
}

/** 이 환경처럼 Playwright 기본 브라우저가 없을 때 대체 실행 파일을 env 로 지정한다 (테스트는 skip 하지 않는다). */
export function ensureChromiumEnv(): void {
  if (!process.env.PLAYWRIGHT_CHROMIUM_PATH && existsSync(FALLBACK_CHROMIUM_PATH)) process.env.PLAYWRIGHT_CHROMIUM_PATH = FALLBACK_CHROMIUM_PATH
}
