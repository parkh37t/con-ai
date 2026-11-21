/** 화면 생성 규칙 (외부 ID 자동 부여·shell 추정·더미데이터 복제) 단위 테스트. */
import { describe, expect, it } from 'vitest'
import type { DummyDataDocument, ReferenceDocument } from '@con-ai/worker-generation'
import { copyDummyForNewScreen, deriveShell, fixtureSuffix, nextScreenExternalId, portalOf } from './screens.js'

describe('nextScreenExternalId', () => {
  it('빈 프로젝트는 SCREEN-001', () => {
    expect(nextScreenExternalId([])).toBe('SCREEN-001')
  })

  it('다른 형식의 기존 ID 는 세지 않는다 (기존 ID 를 새 번호로 바꾸지 않는다)', () => {
    expect(nextScreenExternalId(['SAMPLE-quote-list', 'SAMPLE-quote-detail'])).toBe('SCREEN-001')
  })

  it('가장 큰 번호 다음을 쓴다', () => {
    expect(nextScreenExternalId(['SCREEN-001', 'SCREEN-009', 'SAMPLE-x'])).toBe('SCREEN-010')
    expect(nextScreenExternalId(['SCREEN-099'])).toBe('SCREEN-100')
  })

  it('자리수가 달라도 번호로 읽어 충돌을 피한다', () => {
    // `SCREEN-0002` 도 번호 2 로 세므로 다음은 3 이다 (같은 번호를 다시 주지 않는다).
    expect(nextScreenExternalId(['SCREEN-0002', 'SCREEN-001'])).toBe('SCREEN-003')
  })
})

describe('portalOf · deriveShell', () => {
  it('가장 많이 쓰인 포털을 고르고, 없으면 partner', () => {
    expect(portalOf(['partner-page', 'partner-popup', 'admin-page'])).toBe('partner')
    expect(portalOf([])).toBe('partner')
    expect(portalOf(['bad', 'admin-page'])).toBe('admin')
  })

  it('팝업 낱말이 있으면 popup shell', () => {
    expect(deriveShell('견적 등록 팝업', ['partner-page'])).toBe('partner-popup')
    expect(deriveShell('상세 모달', ['admin-page', 'admin-page'])).toBe('admin-popup')
    expect(deriveShell('견적 목록', ['partner-page'])).toBe('partner-page')
  })
})

describe('copyDummyForNewScreen', () => {
  const reference = {
    id: 'ref-1',
    title: '목록 골든',
    category: 'list',
    description: '',
    spec: { screen_id: 'REF-quote-list' },
    tags: [],
    source: '합성 예시',
  } as unknown as ReferenceDocument

  const dummy: DummyDataDocument[] = [
    { id: 'REF-quote-list-normal', project_id: 'P', screen_external_id: 'REF-quote-list', case_kind: 'normal', rows: [{ quote_no: 'QT-1' }] },
    { id: 'REF-quote-list-empty', project_id: 'P', screen_external_id: 'REF-quote-list', case_kind: 'empty', rows: [] },
    { id: 'REF-quote-detail-normal', project_id: 'P', screen_external_id: 'REF-quote-detail', case_kind: 'normal', rows: [{ item_name: 'A' }] },
  ]

  it('레퍼런스의 fixture 를 새 화면 이름으로 복제한다 (행은 그대로)', () => {
    const copied = copyDummyForNewScreen({ reference, dummy, project_id: 'P', new_external_id: 'SCREEN-001' })
    expect(copied.map((d) => d.id)).toEqual(['SCREEN-001-normal', 'SCREEN-001-empty'])
    expect(copied[0]?.rows).toEqual([{ quote_no: 'QT-1' }])
    expect(copied[0]?.screen_external_id).toBe('SCREEN-001')
    expect(copied[0]?.note).toContain('목록 골든')
    // 원본은 그대로 (행 객체를 공유하지 않는다)
    expect(copied[0]?.rows[0]).not.toBe(dummy[0]?.rows[0])
  })

  it('레퍼런스가 없으면 복제하지 않는다', () => {
    expect(copyDummyForNewScreen({ reference: undefined, dummy, project_id: 'P', new_external_id: 'SCREEN-001' })).toEqual([])
  })

  it('fixtureSuffix 는 접두사가 다르면 null', () => {
    expect(fixtureSuffix('REF-quote-list-normal', 'REF-quote-list')).toBe('normal')
    expect(fixtureSuffix('OTHER-normal', 'REF-quote-list')).toBeNull()
  })
})
