/**
 * RFC 4180 호환 최소 CSV 파서.
 * - 따옴표 안의 줄바꿈·쉼표·이중 따옴표("")를 처리한다.
 * - UTF-8 BOM을 제거한다(검토 CSV는 BOM이 있다).
 * - 원문 위치 보존을 위해 각 레코드에 1부터 시작하는 레코드 번호를 붙인다(헤더 제외).
 */
export interface CsvRecord {
  /** 헤더를 제외한 데이터 레코드 순번 (1부터) */
  recordNumber: number
  values: Record<string, string>
}

export interface ParsedCsv {
  header: string[]
  records: CsvRecord[]
}

export function parseCsv(text: string): ParsedCsv {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < src.length) {
    const ch = src[i] as string
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += ch
      i += 1
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (ch === ',') {
      row.push(field)
      field = ''
      i += 1
      continue
    }
    if (ch === '\r') {
      i += 1
      continue
    }
    if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i += 1
      continue
    }
    field += ch
    i += 1
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  if (inQuotes) {
    throw new Error('CSV 파싱 실패: 닫히지 않은 따옴표')
  }
  const header = rows[0] ?? []
  const records: CsvRecord[] = []
  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r] as string[]
    if (cells.length === 1 && cells[0] === '') continue // 빈 줄
    if (cells.length !== header.length) {
      throw new Error(`CSV 파싱 실패: 레코드 ${r} 의 열 수(${cells.length})가 헤더(${header.length})와 다름`)
    }
    const values: Record<string, string> = {}
    header.forEach((name, idx) => {
      values[name] = cells[idx] as string
    })
    records.push({ recordNumber: r, values })
  }
  return { header, records }
}
