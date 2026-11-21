import { describe, expect, it } from 'vitest'
import { XlsxImportConfig } from './import-config.js'
import { issuePaths } from './test-utils.js'

const UUID = '11111111-1111-4111-8111-111111111111'
const minimal = { project_id: UUID, name: '요구사항 원장(합성)', sheet: 'SFR', header_row: 1, id_column: 'A' }

describe('XLSX 가져오기 설정 (설계 §4 시트·헤더·ID 열)', () => {
  it('시트·헤더 행·ID 열이 있으면 파싱되고 기본값이 채워진다', () => {
    const r = XlsxImportConfig.safeParse(minimal)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.columns).toEqual({})
      expect(r.data.skip_empty_id).toBe(true)
    }
  })

  it('필수 필드가 빠지면 실패한다 (범용 자동 추론을 하지 않는다)', () => {
    expect(issuePaths(XlsxImportConfig.safeParse({ project_id: UUID, name: 'x' }))).toEqual(expect.arrayContaining(['sheet', 'header_row', 'id_column']))
  })

  it('열은 열 문자 형식이어야 하고 필드 매핑이 ID 열과 겹치면 실패한다', () => {
    expect(issuePaths(XlsxImportConfig.safeParse({ ...minimal, id_column: 'a1' }))).toEqual(['id_column'])
    expect(issuePaths(XlsxImportConfig.safeParse({ ...minimal, columns: { title: 'A', body: 'C' } }))).toEqual(['columns.title'])
  })

  it('데이터 시작 행은 헤더 행보다 커야 하고 id_pattern 은 유효한 정규식이어야 한다', () => {
    expect(issuePaths(XlsxImportConfig.safeParse({ ...minimal, header_row: 3, data_row_start: 3 }))).toEqual(['data_row_start'])
    expect(issuePaths(XlsxImportConfig.safeParse({ ...minimal, id_pattern: '^REQ-(' }))).toEqual(['id_pattern'])
    expect(XlsxImportConfig.safeParse({ ...minimal, header_row: 3, data_row_start: 4, id_pattern: '^EXAMPLE-REQ-\\d{3}$', columns: { title: 'B', body: 'C' } }).success).toBe(true)
  })
})
