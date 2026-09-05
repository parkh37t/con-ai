/**
 * data/review 의 검토 데이터가 집계기준_결과.json 과 일치하는지 확인한다.
 * 이 수치는 "고유 화면 수"나 "검증 완료 수"가 아니다(설계 §7, 보고서 §3).
 * 검토 데이터가 바뀌면 집계 기준도 같이 갱신해야 하므로 여기서 잡는다.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv.js'

const reviewDir = resolve(import.meta.dirname, '../../../data/review')
const REVIEW_FILES = [
  'S2B_요구사항_원문추출.csv',
  'S2B_INDEX_레지스트리.csv',
  'S2B_INDEX_경로확인52건.csv',
  'S2B_HTML_REQ_추적후보.csv',
  'MD_검토목록129건.csv',
]
const missing = REVIEW_FILES.filter((f) => !existsSync(resolve(reviewDir, f)))
if (missing.length > 0) {
  // 검토 CSV는 공개 저장소에 커밋하지 않는다(.gitignore). 없으면 이 검사는 "미실행(skipped)"이지 통과가 아니다.
  console.warn(`[review-data] 검토 데이터가 없어 무결성 검사를 건너뜀 (not_run): ${missing.join(', ')} — data/review/README.md 참고`)
}
const read = (name: string) => parseCsv(readFileSync(resolve(reviewDir, name), 'utf8'))
const agg = JSON.parse(readFileSync(resolve(reviewDir, '집계기준_결과.json'), 'utf8')) as Record<string, number>

describe.skipIf(missing.length > 0)('검토 데이터 무결성 (집계기준_결과.json 대조)', () => {
  it('요구사항 원문추출: 444행, 고유 ID 444, 전부 미승인 상태', () => {
    const { records } = read('S2B_요구사항_원문추출.csv')
    expect(records).toHaveLength(agg['requirements'] as number)
    expect(new Set(records.map((r) => r.values['requirement_id'])).size).toBe(agg['unique_requirements'])
    expect(records.every((r) => r.values['review_status'] === 'source_extracted_unapproved')).toBe(true)
    expect(records.every((r) => r.values['sheet'] === 'SFR')).toBe(true)
  })

  it('INDEX 레지스트리: 1,428행, 고유 ID 1,385, 고유 경로 1,410, 중복 ID 43그룹(서로 다른 경로 32), 경로 미확인 52', () => {
    const { records } = read('S2B_INDEX_레지스트리.csv')
    expect(records).toHaveLength(agg['index_rows'] as number)
    const byId = new Map<string, Set<string>>()
    for (const r of records) {
      const id = r.values['id'] as string
      const set = byId.get(id) ?? new Set<string>()
      set.add(r.values['href'] as string)
      byId.set(id, set)
    }
    expect(byId.size).toBe(agg['unique_index_ids'])
    expect(new Set(records.map((r) => r.values['href'])).size).toBe(agg['unique_paths'])
    const idCounts = new Map<string, number>()
    for (const r of records) idCounts.set(r.values['id'] as string, (idCounts.get(r.values['id'] as string) ?? 0) + 1)
    const dupGroups = [...idCounts.entries()].filter(([, n]) => n > 1).map(([id]) => id)
    expect(dupGroups).toHaveLength(agg['duplicate_id_groups'] as number)
    expect(dupGroups.filter((id) => (byId.get(id)?.size ?? 0) > 1)).toHaveLength(agg['duplicate_id_distinct_paths'] as number)
    expect(records.filter((r) => r.values['file_exists'] === 'False')).toHaveLength(agg['missing_paths'] as number)
    expect(records.every((r) => r.values['review_status'] === 'import_candidate')).toBe(true)
  })

  it('경로확인 52건: 전부 path_resolution_required, 파일명 후보가 있는 행 43', () => {
    const { records } = read('S2B_INDEX_경로확인52건.csv')
    expect(records).toHaveLength(agg['missing_paths'] as number)
    expect(records.every((r) => r.values['status'] === 'path_resolution_required')).toBe(true)
    expect(records.filter((r) => (r.values['candidates'] ?? '').trim() !== '')).toHaveLength(agg['missing_with_basename_candidates'] as number)
  })

  it('HTML REQ 추적후보: 1,212행, 전부 unverified_candidate, 고유 artifact 937', () => {
    const { records } = read('S2B_HTML_REQ_추적후보.csv')
    expect(records).toHaveLength(agg['candidate_edges'] as number)
    expect(records.every((r) => r.values['status'] === 'unverified_candidate')).toBe(true)
    expect(new Set(records.map((r) => r.values['artifact_path'])).size).toBe(agg['html_req_token_files'])
  })

  it('추적후보의 declared_id 가 원장에 없는 행이 존재한다 (자동 승인 금지 근거)', () => {
    const reqIds = new Set(read('S2B_요구사항_원문추출.csv').records.map((r) => r.values['requirement_id']))
    const { records } = read('S2B_HTML_REQ_추적후보.csv')
    const notInLedger = records.filter((r) => !reqIds.has(r.values['declared_id']))
    expect(notInLedger.length).toBeGreaterThan(0)
    // requirement_exists_exact 컬럼과 실제 원장 대조가 일치해야 한다
    expect(records.filter((r) => r.values['requirement_exists_exact'] === 'False')).toHaveLength(notInLedger.length)
  })

  it('MD 검토목록: 129행 (S2B2 110, apex 19)', () => {
    const { records } = read('MD_검토목록129건.csv')
    expect(records).toHaveLength(agg['md_files'] as number)
    expect(records.filter((r) => r.values['archive'] === 'S2B2.zip')).toHaveLength(110)
    expect(records.filter((r) => r.values['archive'] === 'apex-office-starter_2.zip')).toHaveLength(19)
  })
})
