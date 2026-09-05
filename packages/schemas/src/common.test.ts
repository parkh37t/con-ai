import { describe, expect, it } from 'vitest'
import { ContentHash, ExternalId, InternalId, IsoDateTime, LocalId, Revision } from './common.js'

describe('공통 타입 (설계 §6, §11)', () => {
  it('ContentHash 는 SHA-256 소문자 hex 64자만 허용한다', () => {
    expect(ContentHash.safeParse('a'.repeat(64)).success).toBe(true)
    expect(ContentHash.safeParse('A'.repeat(64)).success).toBe(false)
    expect(ContentHash.safeParse('a'.repeat(63)).success).toBe(false)
    expect(ContentHash.safeParse('sha256:' + 'a'.repeat(64)).success).toBe(false)
  })

  it('ExternalId 는 공백을 허용하지 않고 InternalId 는 UUID 형식이어야 한다', () => {
    expect(ExternalId.safeParse('EXAMPLE-order-list').success).toBe(true)
    expect(ExternalId.safeParse('EXAMPLE order').success).toBe(false)
    expect(ExternalId.safeParse('').success).toBe(false)
    expect(InternalId.safeParse('11111111-1111-4111-8111-111111111111').success).toBe(true)
    expect(InternalId.safeParse('EXAMPLE-order-list').success).toBe(false)
  })

  it('LocalId 는 영숫자로 시작하며 Revision 은 1 이상의 정수다', () => {
    expect(LocalId.safeParse('search-submit').success).toBe(true)
    expect(LocalId.safeParse('-search').success).toBe(false)
    expect(LocalId.safeParse('검색').success).toBe(false)
    expect(Revision.safeParse(1).success).toBe(true)
    expect(Revision.safeParse(0).success).toBe(false)
    expect(Revision.safeParse(1.5).success).toBe(false)
  })

  it('IsoDateTime 은 오프셋 표기를 허용한다', () => {
    expect(IsoDateTime.safeParse('2026-09-05T09:00:00+09:00').success).toBe(true)
    expect(IsoDateTime.safeParse('2026-09-05T00:00:00Z').success).toBe(true)
    expect(IsoDateTime.safeParse('2026-09-05').success).toBe(false)
  })
})
