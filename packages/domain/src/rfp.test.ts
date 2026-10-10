/**
 * RFP 분석 규칙 — 모델 출력을 원문과 맞춰 보는 자리.
 *
 * 여기서 못 박는 것:
 * - **지어낸 인용은 채택하지 않는다.** 모델이 그럴듯한 문장을 만들어도 원문에 없으면 떨어진다.
 * - 공백·줄바꿈만 다른 인용은 통과시키되 **그 사실을 센다** (PDF·HWP 붙여넣기는 줄바꿈이 제멋대로다).
 * - 외부 ID 는 **서버가 다시 계산**한다. 모델이 준 번호를 쓰지 않고, 기존 번호를 재사용하지 않는다.
 * - 체크리스트 축이 비면 「없음」이 아니라 `missing` 이다.
 */
import { describe, expect, it } from 'vitest'
import type { RfpRequirementDraft } from '@con-ai/schemas'
import { NFR_AXES, checkRfpExtraction, findQuote, nextRfpExternalId, normalizeQuote, rfpNfrGaps, sortRfpRequirements } from './rfp.js'

const SOURCE = [
  '3.2.1 파트너는 견적 목록을 조회할 수 있어야 한다.',
  '3.2.2 시스템은 동시접속 500명에서 응답시간 95p 2초 이내를 보장해야 한다.',
  '4.1 제안서는 사업 이해도(20점), 기술 적합성(30점)으로 평가한다.',
].join('\n')

function draft(over: Partial<RfpRequirementDraft> = {}): RfpRequirementDraft {
  return {
    external_id: '모델이-준-값',
    kind: 'FR',
    title: '견적 목록 조회',
    detail: '파트너 포털에서 견적 목록을 조회한다',
    priority: 'M',
    priority_reason: 'RFP 3.2.1 "조회할 수 있어야 한다"',
    source: { label: 'RFP 3.2.1', quote: '파트너는 견적 목록을 조회할 수 있어야 한다.' },
    criteria: [{ text: '목록을 조회한다', kind: 'ui' }],
    ...over,
  }
}

describe('findQuote — 지어낸 인용을 잡는다', () => {
  it('글자 그대로 있으면 exact 와 위치를 준다', () => {
    const m = findQuote(SOURCE, '파트너는 견적 목록을 조회할 수 있어야 한다.')
    expect(m.kind).toBe('exact')
    expect(m.offset).toBe(SOURCE.indexOf('파트너는'))
  })

  it('공백·줄바꿈만 다르면 whitespace 다 (위치는 적지 않는다 — 원문 위치와 다르다)', () => {
    const m = findQuote(SOURCE, '파트너는  견적\n목록을 조회할 수 있어야 한다.')
    expect(m.kind).toBe('whitespace')
    expect(m.offset).toBeUndefined()
  })

  it('원문에 없으면 none 이다', () => {
    expect(findQuote(SOURCE, '파트너는 견적서를 PDF 로 내려받을 수 있어야 한다.').kind).toBe('none')
    expect(findQuote(SOURCE, '   ').kind).toBe('none')
  })

  it('normalizeQuote 는 공백을 한 칸으로 줄인다', () => {
    expect(normalizeQuote('  가\n\n 나\t다  ')).toBe('가 나 다')
  })
})

describe('nextRfpExternalId — 서버가 다시 계산한다', () => {
  it('비어 있으면 001 부터', () => {
    expect(nextRfpExternalId('S2B', 'FR', [])).toBe('S2B-FR-001')
  })

  it('분류별로 따로 센다', () => {
    const used = ['S2B-FR-001', 'S2B-FR-002', 'S2B-NFR-001']
    expect(nextRfpExternalId('S2B', 'FR', used)).toBe('S2B-FR-003')
    expect(nextRfpExternalId('S2B', 'NFR', used)).toBe('S2B-NFR-002')
    expect(nextRfpExternalId('S2B', 'CR', used)).toBe('S2B-CR-001')
  })

  it('번호를 재사용하지 않는다 — 중간이 비어도 최대값 다음이다', () => {
    expect(nextRfpExternalId('S2B', 'FR', ['S2B-FR-001', 'S2B-FR-007'])).toBe('S2B-FR-008')
  })

  it('다른 프로젝트 코드는 세지 않는다', () => {
    expect(nextRfpExternalId('S2B', 'FR', ['BNK-FR-009'])).toBe('S2B-FR-001')
  })
})

describe('checkRfpExtraction', () => {
  it('인용이 원문에 있으면 채택하고 외부 ID 를 다시 계산한다', () => {
    const r = checkRfpExtraction({ source_text: SOURCE, drafts: [draft()], project_code: 'S2B' })
    expect(r.rejected).toEqual([])
    expect(r.accepted).toHaveLength(1)
    expect(r.accepted[0]?.requirement.external_id).toBe('S2B-FR-001') // 모델이 준 값을 쓰지 않는다
    expect(r.accepted[0]?.requirement.source.char_offset).toBe(SOURCE.indexOf('파트너는'))
    expect(r.accepted[0]?.quote_match).toBe('exact')
  })

  it('**지어낸 인용은 채택하지 않고 이유를 남긴다** (조용히 버리지 않는다)', () => {
    const fabricated = draft({ source: { label: 'RFP 9.9', quote: '시스템은 블록체인으로 견적을 공증해야 한다.' } })
    const r = checkRfpExtraction({ source_text: SOURCE, drafts: [fabricated], project_code: 'S2B' })
    expect(r.accepted).toEqual([])
    expect(r.rejected).toHaveLength(1)
    expect(r.rejected[0]?.reason).toBe('quote_not_found')
  })

  it('우선순위 근거가 없으면 채택하지 않는다 (임의 판단 금지)', () => {
    const r = checkRfpExtraction({ source_text: SOURCE, drafts: [draft({ priority_reason: '   ' })], project_code: 'S2B' })
    expect(r.rejected[0]?.reason).toBe('empty_priority_reason')
  })

  it('요구사항명이 비면 채택하지 않는다', () => {
    const r = checkRfpExtraction({ source_text: SOURCE, drafts: [draft({ title: '  ' })], project_code: 'S2B' })
    expect(r.rejected[0]?.reason).toBe('empty_title')
  })

  it('공백만 다른 인용은 통과시키되 건수를 센다', () => {
    const reflowed = draft({ source: { label: 'RFP 3.2.1', quote: '파트너는\n견적 목록을  조회할 수 있어야 한다.' } })
    const r = checkRfpExtraction({ source_text: SOURCE, drafts: [reflowed], project_code: 'S2B' })
    expect(r.accepted).toHaveLength(1)
    expect(r.accepted[0]?.quote_match).toBe('whitespace')
    expect(r.accepted[0]?.requirement.source.char_offset).toBeUndefined()
    expect(r.whitespace_matches).toBe(1)
  })

  it('기존 번호를 건너뛰고, 같은 분류 여러 건을 차례로 발번한다', () => {
    const nfr = draft({
      kind: 'NFR',
      title: '성능',
      nfr_axis: 'performance',
      source: { label: 'RFP 3.2.2', quote: '시스템은 동시접속 500명에서 응답시간 95p 2초 이내를 보장해야 한다.' },
    })
    const r = checkRfpExtraction({ source_text: SOURCE, drafts: [draft(), nfr, draft()], project_code: 'S2B', used: ['S2B-FR-001'] })
    expect(r.accepted.map((a) => a.requirement.external_id)).toEqual(['S2B-FR-002', 'S2B-NFR-001', 'S2B-FR-003'])
  })

  it('채택된 것만으로 체크리스트를 판정한다 (떨어진 요구사항이 축을 덮은 것처럼 보이지 않게)', () => {
    const fabricatedSecurity = draft({ kind: 'NFR', nfr_axis: 'security', source: { label: 'RFP 9', quote: '없는 문장이다' } })
    const r = checkRfpExtraction({ source_text: SOURCE, drafts: [fabricatedSecurity], project_code: 'S2B' })
    expect(r.nfr_gaps.find((g) => g.axis === 'security')?.status).toBe('missing')
  })
})

describe('rfpNfrGaps — 비어 있는 축을 「없음」이 아니라 missing 으로 적는다', () => {
  it('요구사항이 없으면 여섯 축이 모두 missing 이다', () => {
    const gaps = rfpNfrGaps([])
    expect(gaps).toHaveLength(NFR_AXES.length)
    expect(gaps.every((g) => g.status === 'missing')).toBe(true)
  })

  it('축을 덮으면 covered 이고 어떤 요구사항이 덮는지 적는다', () => {
    const gaps = rfpNfrGaps([draft({ kind: 'NFR', nfr_axis: 'performance', external_id: 'S2B-NFR-001' })])
    expect(gaps.find((g) => g.axis === 'performance')).toEqual({ axis: 'performance', status: 'covered', found: ['S2B-NFR-001'] })
    expect(gaps.find((g) => g.axis === 'audit')?.status).toBe('missing')
  })

  it('기능 요구사항(FR)에 축을 붙여도 체크리스트를 덮지 못한다', () => {
    // 그렇지 않으면 「성능 축을 덮었다」가 기능 요구사항 하나로 만들어진다.
    const gaps = rfpNfrGaps([draft({ kind: 'FR', nfr_axis: 'performance', external_id: 'S2B-FR-001' })])
    expect(gaps.find((g) => g.axis === 'performance')?.status).toBe('missing')
  })

  it('CR(컴플라이언스)도 축을 덮는다 (전자금융감독규정이 보안 축이다)', () => {
    const gaps = rfpNfrGaps([draft({ kind: 'CR', nfr_axis: 'security', external_id: 'S2B-CR-001' })])
    expect(gaps.find((g) => g.axis === 'security')?.status).toBe('covered')
  })
})

describe('sortRfpRequirements', () => {
  it('우선순위(M→W) → 분류(FR→CR) → ID 순이다', () => {
    const list = [
      draft({ external_id: 'S2B-CR-001', kind: 'CR', priority: 'M' }),
      draft({ external_id: 'S2B-FR-002', kind: 'FR', priority: 'S' }),
      draft({ external_id: 'S2B-FR-001', kind: 'FR', priority: 'M' }),
      draft({ external_id: 'S2B-NFR-001', kind: 'NFR', priority: 'W' }),
    ]
    expect(sortRfpRequirements(list).map((r) => r.external_id)).toEqual(['S2B-FR-001', 'S2B-CR-001', 'S2B-FR-002', 'S2B-NFR-001'])
  })
})
