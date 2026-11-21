import { describe, expect, it } from 'vitest'
import { AnchorLocator, SourceAnchor, SourceType, SourceVersion } from './source.js'
import { issuePaths } from './test-utils.js'

const UUID = '11111111-1111-4111-8111-111111111111'

describe('원본 자료 (설계 §6 SourceDocument / SourceVersion / SourceAnchor)', () => {
  it('SourceVersion 은 sha256·저장 위치·등록 시점을 요구한다', () => {
    const ok = SourceVersion.safeParse({
      id: UUID, source_document_id: UUID, revision: 1, sha256: 'b'.repeat(64),
      storage_path: 'sources/example.xlsx', file_name: 'example.xlsx', registered_at: '2026-09-05T00:00:00Z',
    })
    expect(ok.success).toBe(true)
    const missing = SourceVersion.safeParse({ id: UUID, source_document_id: UUID, revision: 1, file_name: 'x', registered_at: '2026-09-05T00:00:00Z' })
    expect(issuePaths(missing)).toEqual(expect.arrayContaining(['sha256', 'storage_path']))
  })

  it('anchor 위치는 시트·행·열 / CSV 레코드 / MD 절·행 / HTML 위치를 구분한다', () => {
    expect(AnchorLocator.safeParse({ kind: 'sheet', sheet: 'SFR', row: 12, column: 'A' }).success).toBe(true)
    expect(AnchorLocator.safeParse({ kind: 'csv', record_number: 3 }).success).toBe(true)
    expect(AnchorLocator.safeParse({ kind: 'md', heading: '3. 정책', line: 40 }).success).toBe(true)
    expect(AnchorLocator.safeParse({ kind: 'html', path: 'example/list.html', selector: '#right-panel' }).success).toBe(true)
    expect(AnchorLocator.safeParse({ kind: 'pdf', page: 1 }).success).toBe(false)
    expect(AnchorLocator.safeParse({ kind: 'sheet', sheet: 'SFR', row: 0 }).success).toBe(false)
  })

  it('SourceAnchor 는 원본 버전과 원문 일부를 함께 가진다', () => {
    const anchor = SourceAnchor.safeParse({ id: UUID, source_version_id: UUID, locator: { kind: 'sheet', sheet: 'SFR', row: 5 }, excerpt: '합성 원문' })
    expect(anchor.success).toBe(true)
    expect(SourceAnchor.safeParse({ id: UUID, source_version_id: UUID, locator: { kind: 'sheet', sheet: 'SFR', row: 5 } }).success).toBe(false)
  })

  it('원본 유형은 MVP 범위(xlsx/md/csv/html/index)만 허용한다 (설계 §4)', () => {
    expect(SourceType.options).toEqual(['xlsx', 'md', 'csv', 'html', 'index'])
    expect(SourceType.safeParse('pdf').success).toBe(false)
  })
})
