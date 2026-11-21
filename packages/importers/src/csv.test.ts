import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv.js'

describe('parseCsv', () => {
  it('BOM을 제거하고 헤더·레코드를 나눈다', () => {
    const parsed = parseCsv('﻿a,b\n1,2\n')
    expect(parsed.header).toEqual(['a', 'b'])
    expect(parsed.records).toEqual([{ recordNumber: 1, values: { a: '1', b: '2' } }])
  })

  it('따옴표 안의 줄바꿈·쉼표·이중 따옴표를 처리한다', () => {
    const parsed = parseCsv('id,text\r\nR1,"첫 줄\n둘째, 줄 ""인용"""\r\n')
    expect(parsed.records[0]?.values).toEqual({ id: 'R1', text: '첫 줄\n둘째, 줄 "인용"' })
  })

  it('열 수가 헤더와 다르면 실패한다 (조용히 통과시키지 않는다)', () => {
    expect(() => parseCsv('a,b\n1\n')).toThrow('열 수')
  })

  it('닫히지 않은 따옴표는 실패한다', () => {
    expect(() => parseCsv('a\n"열림\n')).toThrow('따옴표')
  })
})
