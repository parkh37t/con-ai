/**
 * 브라우저 V3 — 판정 규칙(순수)과 조사 스크립트 주입.
 * 판정은 서버 `packages/validators/src/v3.ts` 와 같은 조건이어야 한다. 실제 iframe 실행은 e2e 가 확인한다.
 */
import { describe, expect, it } from 'vitest'
import { BROWSER_V3_EVIDENCE, judgeV3, runV3InBrowser, v3ErrorResults } from './v3-browser.js'
import { V3_HARNESS_SOURCE, injectHarness, type V3Probe } from './v3-harness.js'
import type { ResultFactoryInput } from './deps.js'

const BASE: ResultFactoryInput = { artifact_hash: 'a'.repeat(64), validation_run_id: 'run-1', stage: 'V3' }
const ALL_REQUIRED = { 'V3.console_errors': true, 'V3.case_switch': true, 'V3.search_filter': true, 'V3.download': true } as const

function probe(over: Partial<V3Probe> = {}): V3Probe {
  return {
    case_ids: ['normal', 'empty', 'error'],
    load_errors: 0,
    total_errors: 0,
    errors: [],
    case_steps: [
      { id: 'empty', switched: true, rows: 0, messages: 'MSG-empty', errors: 0 },
      { id: 'error', switched: true, rows: 0, messages: 'MSG-error', errors: 0 },
      { id: 'normal', switched: true, rows: 5, messages: '', errors: 0 },
    ],
    search: { ran: true, case_id: 'normal', selector: '[data-input-for="q"]', submit: 'trigger', value: 'Q-1001', before: 5, matched: 1, none: 0, messages: '', errors: 0 },
    download: { ran: true, status_text: '다운로드(더미): 표 5개를 명세 컬럼 CSV 로 내려받음', errors: 0 },
    ...over,
  }
}

function byId(results: ReturnType<typeof judgeV3>) {
  return new Map(results.map((r) => [r.check_id, r]))
}

describe('judgeV3 — 서버 V3 와 같은 조건으로 판정한다', () => {
  it('모두 정상이면 네 검사가 통과한다', () => {
    const m = byId(judgeV3(probe(), BASE, ALL_REQUIRED, Date.now()))
    expect([...m.values()].every((r) => r.status === 'pass')).toBe(true)
    // 서버 V3 와 실행기가 다르다는 사실을 근거에 남긴다.
    expect(m.get('V3.console_errors')?.evidence?.[0]).toBe(BROWSER_V3_EVIDENCE)
  })

  it('콘솔 오류가 있으면 실패다', () => {
    const m = byId(judgeV3(probe({ total_errors: 2, errors: ['console.error: x', 'pageerror: y'] }), BASE, ALL_REQUIRED, Date.now()))
    expect(m.get('V3.console_errors')?.status).toBe('fail')
    expect(m.get('V3.console_errors')?.message).toContain('2건')
  })

  it('CASE 가 전환되지 않으면 실패다', () => {
    const steps = probe().case_steps.map((s, i) => (i === 0 ? { ...s, switched: false } : s))
    const m = byId(judgeV3(probe({ case_steps: steps }), BASE, ALL_REQUIRED, Date.now()))
    expect(m.get('V3.case_switch')?.status).toBe('fail')
    expect(m.get('V3.case_switch')?.message).toContain('전환되지 않았다')
  })

  it('CASE 를 바꿔도 행 수·메시지가 같으면 실패다 (fixture 가 같다는 뜻)', () => {
    const steps = probe().case_steps.map((s) => ({ ...s, rows: 5, messages: '' }))
    const m = byId(judgeV3(probe({ case_steps: steps }), BASE, ALL_REQUIRED, Date.now()))
    expect(m.get('V3.case_switch')?.status).toBe('fail')
    expect(m.get('V3.case_switch')?.message).toContain('달라지지 않는다')
  })

  it('CASE 버튼이 없으면 실패다', () => {
    const m = byId(judgeV3(probe({ case_ids: [], case_steps: [] }), BASE, ALL_REQUIRED, Date.now()))
    expect(m.get('V3.case_switch')?.status).toBe('fail')
    expect(m.get('V3.case_switch')?.message).toContain('button[data-case]')
  })

  it('일치 검색어로 행이 줄지 않으면 실패다', () => {
    const m = byId(judgeV3(probe({ search: { ...probe().search, matched: 5 } }), BASE, ALL_REQUIRED, Date.now()))
    expect(m.get('V3.search_filter')?.status).toBe('fail')
    expect(m.get('V3.search_filter')?.message).toContain('줄지 않았다')
  })

  it('불일치 검색어인데 행이 남으면 실패다', () => {
    const m = byId(judgeV3(probe({ search: { ...probe().search, none: 2 } }), BASE, ALL_REQUIRED, Date.now()))
    expect(m.get('V3.search_filter')?.status).toBe('fail')
    expect(m.get('V3.search_filter')?.message).toContain('행이 남았다')
  })

  it('행이 1개면 일치 검색어로 그대로 남아야 통과다 (v3.ts 와 같은 완화 규칙)', () => {
    const m = byId(judgeV3(probe({ search: { ...probe().search, before: 1, matched: 1, none: 0 } }), BASE, ALL_REQUIRED, Date.now()))
    expect(m.get('V3.search_filter')?.status).toBe('pass')
  })

  it('검색·다운로드 동작이 없으면 not_run 이고 필수가 아니다 (통과로 세지 않는다)', () => {
    const required = { ...ALL_REQUIRED, 'V3.search_filter': false, 'V3.download': false }
    const m = byId(judgeV3(probe({ search: { ran: false }, download: { ran: false } }), BASE, required, Date.now()))
    expect(m.get('V3.search_filter')?.status).toBe('not_run')
    expect(m.get('V3.search_filter')?.required).toBe(false)
    expect(m.get('V3.download')?.status).toBe('not_run')
  })

  it('다운로드 상태 문구가 없으면 실패다 (파일 저장이 막힌 것과 동작하지 않은 것을 구분한다)', () => {
    const m = byId(judgeV3(probe({ download: { ran: true, status_text: '', errors: 0 } }), BASE, ALL_REQUIRED, Date.now()))
    expect(m.get('V3.download')?.status).toBe('fail')
    expect(m.get('V3.download')?.message).toContain('상태 표시가 없다')
  })

  it('다운로드 트리거가 없으면 실패다', () => {
    const m = byId(judgeV3(probe({ download: { ran: false, reason: 'download-fixture 동작을 실행할 trigger 요소(버튼·링크)가 화면에 없다' } }), BASE, ALL_REQUIRED, Date.now()))
    expect(m.get('V3.download')?.status).toBe('fail')
    expect(m.get('V3.download')?.message).toContain('trigger')
  })
})

describe('v3ErrorResults — 돌리지 못한 것을 통과로 바꾸지 않는다', () => {
  it('네 검사가 모두 error 이고 필수 여부는 HTML 의 동작에서 온다', () => {
    const html = '<body data-action-types="filter-fixture"></body>'
    const results = v3ErrorResults(html, BASE, '문서가 없다', ['document 없음'], Date.now())
    expect(results.every((r) => r.status === 'error')).toBe(true)
    expect(results.find((r) => r.check_id === 'V3.search_filter')?.required).toBe(true)
    expect(results.find((r) => r.check_id === 'V3.download')?.required).toBe(false)
  })
})

describe('injectHarness — 저장된 산출물을 바꾸지 않는다', () => {
  it('</head> 앞에 넣는다 (화면 스크립트보다 먼저 돌아야 콘솔 오류를 처음부터 잡는다)', () => {
    const html = '<html><head><title>t</title></head><body>본문</body></html>'
    const out = injectHarness(html)
    expect(out.indexOf('data-con-ai-v3-harness')).toBeLessThan(out.indexOf('</head>'))
    expect(out).toContain('본문')
  })

  it('head 가 없으면 body 여는 태그 뒤에 넣는다', () => {
    const out = injectHarness('<body data-case="normal">본문</body>')
    expect(out.startsWith('<body data-case="normal">')).toBe(true)
    expect(out).toContain('data-con-ai-v3-harness')
  })

  it('조사 스크립트는 v3.ts 와 같은 선택자를 쓴다', () => {
    for (const sel of ['tr[data-row]', '[data-messages] [data-message-id]', 'button[data-case]', '[data-action-type="filter-fixture"]', '[data-action-type="download-fixture"]', '[data-screen-status] [data-status]']) {
      expect(V3_HARNESS_SOURCE).toContain(sel)
    }
  })
})

describe('runV3InBrowser — 문서가 없으면 정직하게 error 다', () => {
  it('브라우저 밖에서 부르면 전부 error 이고 이유를 적는다', async () => {
    const results = await runV3InBrowser('<html><body></body></html>', { artifact_hash: 'b'.repeat(64), validation_run_id: 'run-2' })
    expect(results).toHaveLength(4)
    expect(results.every((r) => r.status === 'error')).toBe(true)
    expect(results[0]?.message).toContain('문서(document)가 없어')
  })
})
