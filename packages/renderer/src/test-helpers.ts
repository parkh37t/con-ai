/** 테스트 보조 — fixtures 의 명세·더미데이터를 읽는다 (테스트 파일에서만 쓴다; index.ts 에서 재수출하지 않는다). */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ScreenSpecShape, type ScreenSpecInput } from '@con-ai/schemas'
import type { RenderInput, RenderMeta } from './types.js'
import { S2B_LEARNED_PROFILE } from './profile.js'

const FIXTURES_URL = new URL('../../../fixtures/', import.meta.url)

export function readFixtureJson(relative: string): unknown {
  return JSON.parse(readFileSync(fileURLToPath(new URL(relative, FIXTURES_URL)), 'utf8')) as unknown
}

export function loadFixtureSpec(name: 'valid' | 'bad-mapping' | 'missing-case' | 'stale-baseline'): unknown {
  return readFixtureJson(`screen-specs/example-order-list.${name}.json`)
}

/** fixtures/synthetic/orders.fixture.json → fixture_id → rows */
export function loadOrdersDummy(): Record<string, unknown[]> {
  const file = readFixtureJson('synthetic/orders.fixture.json') as { fixtures: Array<{ fixture_id: string; rows: unknown[] }> }
  const out: Record<string, unknown[]> = {}
  for (const f of file.fixtures) out[f.fixture_id] = f.rows
  return out
}

export const EXAMPLE_META: RenderMeta = {
  screen_title: '주문 목록',
  requirements: [
    { external_id: 'EXAMPLE-REQ-001', title: '주문 목록 조회', criterion_ids: ['EXAMPLE-AC-01', 'EXAMPLE-AC-02', 'EXAMPLE-AC-03'] },
    { external_id: 'EXAMPLE-REQ-002', title: '주문 목록 내려받기', criterion_ids: ['EXAMPLE-AC-04'] },
  ],
  revision_label: 'rev 1 (초안)',
  generated_by: '더미 어댑터(fixture)',
}

export function renderInputOf(spec: ScreenSpecInput | unknown, overrides: Partial<RenderInput> = {}): RenderInput {
  return { spec: ScreenSpecShape.parse(spec), profile: S2B_LEARNED_PROFILE, dummy: loadOrdersDummy(), meta: EXAMPLE_META, ...overrides }
}

/** 배열 요소를 꺼내되 없으면 실패시킨다 (noUncheckedIndexedAccess 대응). */
export function at<T>(items: readonly T[] | undefined, index: number): T {
  const item = items?.[index]
  if (item === undefined) throw new Error(`테스트 데이터에 index ${index} 가 없다`)
  return item
}
