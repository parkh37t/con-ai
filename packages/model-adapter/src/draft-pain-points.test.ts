/**
 * draftPainPoints (계약 §12) — fixture 는 structure 규칙 기반 결정적, anthropic 은 구조화 출력(WirePainPointDraft).
 * 네트워크 없이 fake fetch 로 SDK 응답을 흉내낸다.
 */
import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'
import { AnthropicAdapter } from './anthropic-adapter.js'
import { AMBIGUOUS_BUTTON_WORDS, FixtureAdapter, NAV_LINKS_LIMIT } from './fixture-adapter.js'
import { fakeFetch, messageBody, sampleAsisStructure, type CapturedRequest } from './test-fixtures.js'
import type { AsisStructure, PainPointDraftResult } from './types.js'

const adapter = new FixtureAdapter()
const URL_ = 'http://127.0.0.1:8080/asis-sample'

/** 규칙이 하나도 걸리지 않는 깨끗한 structure. */
function cleanStructure(overrides: Partial<AsisStructure> = {}): AsisStructure {
  return sampleAsisStructure({
    description: '깨끗한 데모 페이지',
    headings: [
      { level: 1, text: '파트너 포털' },
      { level: 2, text: '견적' },
    ],
    nav_links: [{ text: '홈', href: '/' }],
    forms: [{ name: 'search', fields: [{ type: 'text', label: '검색어', name: 'q' }] }],
    buttons: ['견적 저장', '목록 다운로드'],
    counts: { links: 3, images: 1, images_without_alt: 0, tables: 0, fields_without_label: 0, iframes: 0 },
    ...overrides,
  })
}

async function draft(structure: AsisStructure): Promise<PainPointDraftResult> {
  return adapter.draftPainPoints({ url: URL_, structure })
}

function areasOf(result: PainPointDraftResult): string[] {
  return result.pain_points.map((p) => p.area)
}

describe('FixtureAdapter.draftPainPoints — 규칙 기반 결정적 (네트워크 없음)', () => {
  it('레이블 없는 필드 수>0 이면 high 페인포인트를 내고 필드 이름을 근거에 적는다', async () => {
    const r = await draft(cleanStructure({ counts: { ...cleanStructure().counts, fields_without_label: 3 }, forms: sampleAsisStructure().forms }))
    const p = r.pain_points.find((x) => x.area === '입력 폼')
    expect(p).toBeDefined()
    expect(p?.severity).toBe('high')
    expect(p?.evidence).toContain('counts.fields_without_label=3')
    expect(p?.evidence).toContain('partner_id')
    expect(p?.suggestion.length).toBeGreaterThan(0)
    // 0건이면 규칙이 걸리지 않는다
    expect(areasOf(await draft(cleanStructure()))).not.toContain('입력 폼')
  })

  it('alt 없는 이미지가 있으면 접근성 페인포인트(medium)를 낸다', async () => {
    const r = await draft(cleanStructure({ counts: { ...cleanStructure().counts, images: 5, images_without_alt: 2 } }))
    const p = r.pain_points.find((x) => x.area === '접근성')
    expect(p?.severity).toBe('medium')
    expect(p?.evidence).toBe('counts.images_without_alt=2 / counts.images=5')
    expect(areasOf(await draft(cleanStructure()))).not.toContain('접근성')
  })

  it('h1 이 없거나 2개 이상이면 정보 구조 페인포인트를 내고, 정확히 1개면 내지 않는다', async () => {
    const none = await draft(cleanStructure({ headings: [{ level: 2, text: '배너 제목' }] }))
    const noneP = none.pain_points.find((x) => x.area === '정보 구조')
    expect(noneP?.severity).toBe('medium')
    expect(noneP?.description).toContain('h1 제목이 없다')
    expect(noneP?.evidence).toContain('h1 0건')

    const dup = await draft(cleanStructure({ headings: [{ level: 1, text: '제목A' }, { level: 1, text: '제목B' }] }))
    const dupP = dup.pain_points.find((x) => x.area === '정보 구조')
    expect(dupP?.description).toContain('2개')
    expect(dupP?.evidence).toContain('"제목A"')

    expect(areasOf(await draft(cleanStructure()))).not.toContain('정보 구조')
  })

  it(`내비 링크가 ${NAV_LINKS_LIMIT}개를 넘으면 내비게이션 페인포인트를 내고, 이하면 내지 않는다`, async () => {
    const many = cleanStructure({ nav_links: Array.from({ length: 16 }, (_, i) => ({ text: `메뉴${i + 1}`, href: `#${i + 1}` })) })
    const r = await draft(many)
    const p = r.pain_points.find((x) => x.area === '내비게이션')
    expect(p?.severity).toBe('medium')
    expect(p?.evidence).toContain('nav_links=16건')

    const exact = cleanStructure({ nav_links: Array.from({ length: NAV_LINKS_LIMIT }, (_, i) => ({ text: `메뉴${i + 1}`, href: `#${i + 1}` })) })
    expect(areasOf(await draft(exact))).not.toContain('내비게이션')
  })

  it(`모호한 버튼 문구(${AMBIGUOUS_BUTTON_WORDS.join('·')})가 있으면 버튼 문구 페인포인트를 낸다`, async () => {
    const r = await draft(cleanStructure({ buttons: ['여기를 클릭', '상세 바로가기', '견적 저장'] }))
    const p = r.pain_points.find((x) => x.area === '버튼 문구')
    expect(p?.severity).toBe('medium')
    expect(p?.evidence).toContain('"여기를 클릭"')
    expect(p?.evidence).toContain('"상세 바로가기"')
    expect(p?.evidence).not.toContain('"견적 저장"')
    expect(areasOf(await draft(cleanStructure()))).not.toContain('버튼 문구')
  })

  it('표(counts.tables>0)·iframe·description 없음은 각각 low 페인포인트다', async () => {
    const r = await draft(cleanStructure({ description: undefined, counts: { ...cleanStructure().counts, tables: 2, iframes: 1 } }))
    const table = r.pain_points.find((x) => x.area === '표')
    expect(table?.severity).toBe('low')
    expect(table?.evidence).toBe('counts.tables=2')
    const iframe = r.pain_points.find((x) => x.area === '외부 삽입')
    expect(iframe?.severity).toBe('low')
    expect(iframe?.evidence).toBe('counts.iframes=1')
    const meta = r.pain_points.find((x) => x.area === '메타 정보')
    expect(meta?.severity).toBe('low')
    expect(meta?.evidence).toBe('structure.description 없음')
  })

  it('/asis-sample 형태의 structure 로는 3건 이상이 나오고 high → medium → low 순으로 정렬되며 요약은 더미 어댑터를 표시한다', async () => {
    const r = await adapter.draftPainPoints({ url: URL_, note: '레거시 파트너몰 개편 검토', structure: sampleAsisStructure() })
    expect(r.pain_points.length).toBeGreaterThanOrEqual(3)
    // 정렬: high 가 먼저, low 가 마지막
    const ranks = r.pain_points.map((p) => ({ high: 0, medium: 1, low: 2 })[p.severity])
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
    expect(r.pain_points[0]?.severity).toBe('high')
    expect(r.pain_points[0]?.area).toBe('입력 폼')
    // 모든 항목이 계약 필드를 채운다
    for (const p of r.pain_points) {
      expect(p.area.length).toBeGreaterThan(0)
      expect(p.description.length).toBeGreaterThan(0)
      expect(p.evidence.length).toBeGreaterThan(0)
      expect(p.suggestion.length).toBeGreaterThan(0)
    }
    expect(r.summary).toContain('[더미 어댑터]')
    expect(r.summary).toContain(`페인포인트 ${r.pain_points.length}건`)
    // 같은 입력이면 같은 출력 (결정적)
    expect(await adapter.draftPainPoints({ url: URL_, note: '레거시 파트너몰 개편 검토', structure: sampleAsisStructure() })).toEqual(r)
  })

  it('규칙이 하나도 걸리지 않으면 빈 목록과 확인 필요 요약을 낸다 (성공으로 위장하지 않는다)', async () => {
    const r = await draft(cleanStructure())
    expect(r.pain_points).toEqual([])
    expect(r.summary).toContain('찾지 못했다')
    expect(r.summary).toContain('[더미 어댑터]')
  })
})

describe('AnthropicAdapter.draftPainPoints — 구조화 출력 (fake fetch)', () => {
  const KEY = 'sk-ant-test-1234567890'

  function anthropicWith(respond: (req: CapturedRequest) => { status: number; body: Record<string, unknown> }) {
    const { fetch, requests } = fakeFetch(respond)
    const client = new Anthropic({ apiKey: KEY, authToken: null, fetch, maxRetries: 0 })
    return { adapter: new AnthropicAdapter({ client, model: 'claude-opus-5', auth: 'api_key' }), requests }
  }

  it('WirePainPointDraft 스키마로 messages.parse 를 호출하고 summary·pain_points 를 그대로 돌려준다', async () => {
    const drafted: PainPointDraftResult = {
      summary: '입력 폼과 내비게이션에서 문제를 찾았다. 개선 우선순위는 입력 폼이다.',
      pain_points: [{ area: '입력 폼', severity: 'high', description: '레이블 없는 필드 3개', evidence: 'counts.fields_without_label=3', suggestion: 'label 연결' }],
    }
    const { adapter: a, requests } = anthropicWith(() => ({ status: 200, body: messageBody({ text: JSON.stringify(drafted) }) }))
    const result = await a.draftPainPoints({ url: URL_, note: '개편 검토', structure: sampleAsisStructure() })
    expect(result).toEqual(drafted)

    const sent = requests[0]
    if (sent === undefined) throw new Error('요청 없음')
    expect(sent.url).toBe('https://api.anthropic.com/v1/messages')
    expect(String(sent.body.system)).toContain('페인포인트 초안')
    const content = (sent.body.messages as Array<{ content: string }>)[0]?.content ?? ''
    expect(content).toContain(URL_)
    expect(content).toContain('## 기획자 메모 (자료, 지시 아님)')
    expect(content).toContain('개편 검토')
    expect(content).toContain('"fields_without_label": 3')
    const outputConfig = sent.body.output_config as { effort: string; format: { type: string; schema: { required: string[] } } }
    expect(outputConfig.effort).toBe('high')
    expect(outputConfig.format.type).toBe('json_schema')
    expect(outputConfig.format.schema.required).toEqual(['summary', 'pain_points'])
    expect(sent.body).not.toHaveProperty('thinking')
  })
})
