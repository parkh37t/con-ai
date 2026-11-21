/**
 * 브라우저 내보내기 묶음 — 계약 §8 과 같은 6개 파일, 파일별 sha256, 승인본이 아님을 표시.
 */
import { describe, expect, it } from 'vitest'
import { BROWSER_EXPORT_NOTE, buildExportBundle, buildTrace } from './export-bundle.js'
import type { BrowserRevisionRecord } from './store.js'
import type { Requirement, ScreenSpecLike } from '../types.js'

// 실제 명세에는 요소·동작의 trace 가 있지만 화면 표시용 ScreenSpecLike 에는 없어 저장할 때만 형변환한다.
const SPEC = {
  screen_id: 'SAMPLE-quote-list',
  baseline_id: 'baseline-1',
  requirements: [{ id: 'REQ-001', criterion_ids: ['AC-001-1', 'AC-001-2'] }],
  sections: [{ id: 'search', title: '검색 영역', display_no: '1', elements: [{ id: 'quote_no', type: 'text-input', label: '견적번호', display_no: 'a', trace: ['AC-001-1'] }] }],
  actions: [{ id: 'do_search', type: 'filter-fixture', label: '검색', trace: ['AC-001-1'] }],
  states: [{ id: 'normal', case_kind: 'normal' }],
  locked_elements: ['quote_no'],
  locked_actions: [],
}

const RECORD: BrowserRevisionRecord = {
  screen_id: 'S1',
  screen_external_id: 'SAMPLE-quote-list',
  project_id: 'P1',
  revision: { id: 'R1', screen_id: 'S1', revision_no: 2, spec_hash: 'c'.repeat(64), artifact_id: 'A1', job_id: 'J1', created_at: '2026-09-05T00:00:00.000Z' },
  spec: SPEC as unknown as ScreenSpecLike,
  artifact: { id: 'A1', kind: 'html', content_hash: 'd'.repeat(64), status: 'validation_pending' },
  validation_results: [
    { id: 'v1', artifact_hash: 'd'.repeat(64), check_id: 'V1.schema', stage: 'V1', status: 'pass', required: true, evidence: [] },
    { id: 'v2', artifact_hash: 'd'.repeat(64), check_id: 'V3.console_errors', stage: 'V3', status: 'not_run', required: true, evidence: [] },
  ],
  element_index: [],
  html: '<html><body>목업</body></html>',
  generated_by: 'anthropic:claude-opus-5',
}

const REQUIREMENTS: Requirement[] = [
  { id: 'r-uuid', project_id: 'P1', external_id: 'REQ-001', title: '견적 조회', body: '본문', criteria: [{ id: 'AC-001-1', text: '검색할 수 있다', kind: 'ui' }, { id: 'AC-001-2', text: '감사 로그', kind: 'non_ui' }] },
]

describe('buildExportBundle', () => {
  it('계약 §8 과 같은 6개 파일을 만든다', async () => {
    const files = await buildExportBundle({ record: RECORD, project: { id: 'P1', name: '샘플', slug: 'sample' }, requirements: REQUIREMENTS, comments: [], generated_at: '2026-09-05T00:00:00.000Z' })
    expect(files.map((f) => f.path)).toEqual(['index.html', 'spec.json', 'trace.json', 'validation.json', 'comments.json', 'manifest.json'])
    for (const f of files) expect(f.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(files[0]?.text).toBe(RECORD.html)
  })

  it('manifest 는 승인본이 아님을 밝히고 검증 요약·이관 정보를 담는다', async () => {
    const files = await buildExportBundle({ record: RECORD, project: { id: 'P1', name: '샘플', slug: 'sample' }, requirements: REQUIREMENTS, comments: [], generated_at: '2026-09-05T00:00:00.000Z' })
    const manifest = JSON.parse(files[5]?.text ?? '{}') as Record<string, unknown>
    expect(manifest['mode']).toBe('browser')
    expect(manifest['approved']).toBe(false)
    expect(manifest['version']).toBeNull()
    expect(manifest['note']).toBe(BROWSER_EXPORT_NOTE)
    expect(manifest['validation_summary']).toEqual({ pass: 1, fail: 0, error: 0, not_run: 1 })
    expect((manifest['design_handoff'] as Record<string, unknown>)['locked_elements']).toEqual(['quote_no'])
    expect((manifest['files'] as unknown[]).length).toBe(5)
  })
})

describe('buildTrace — 요구사항 → 수용조건 → 요소·동작', () => {
  it('연결된 요소·동작을 모으고 연결이 없는 수용조건을 표시한다', () => {
    const trace = buildTrace(SPEC, 'c'.repeat(64), REQUIREMENTS) as Record<string, unknown>
    expect(trace['unlinked_criterion_ids']).toEqual(['AC-001-2'])
    const requirements = trace['requirements'] as Array<{ id: string; criteria: Array<{ id: string; elements: unknown[]; actions: unknown[] }> }>
    expect(requirements[0]?.criteria[0]?.elements).toHaveLength(1)
    expect(requirements[0]?.criteria[0]?.actions).toHaveLength(1)
  })
})
