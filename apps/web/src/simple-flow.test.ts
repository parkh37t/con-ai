/** 만들기 화면의 자동 채움 규칙 — 문장 하나에서 제목·shell·참고 화면·요청을 만든다. */
import { describe, expect, it } from 'vitest'
import {
  autoReferenceIds,
  buildSimpleCreateRequest,
  buildSimpleEditRequest,
  casesOfSpec,
  deriveShell,
  deriveTitle,
  failureLine,
  guessCategory,
  nextScreenExternalId,
  progressLine,
  recentDesigns,
} from './simple-flow.js'
import type { ProjectDetail, Reference, ScreenSpecLike } from './types.js'

const references = [
  { id: 'ref-list', title: '목록 골든', category: 'list', description: '', spec: {}, tags: [], source: 'S2B 학습 규격 적용 합성 예시' },
  { id: 'ref-detail', title: '상세 골든', category: 'detail', description: '', spec: {}, tags: [], source: 'S2B 학습 규격 적용 합성 예시' },
  { id: 'ref-popup', title: '팝업 골든', category: 'popup', description: '', spec: {}, tags: [], source: 'S2B 학습 규격 적용 합성 예시' },
] satisfies Reference[]

describe('guessCategory · autoReferenceIds', () => {
  it('문장의 낱말로 화면 종류를 짐작한다 (기본 목록)', () => {
    expect(guessCategory('견적 요청 목록을 조회하는 화면')).toBe('list')
    expect(guessCategory('견적 상세 화면')).toBe('detail')
    expect(guessCategory('견적 등록 팝업')).toBe('form')
    expect(guessCategory('무언가')).toBe('list')
    // 여러 낱말이 나오면 먼저 나온 쪽 — "목록을 조회하고 상세로 이동" 은 목록 화면이다
    expect(guessCategory('견적 요청 목록을 조회하고 목록에서 상세로 이동한다')).toBe('list')
    expect(guessCategory('견적 상세에서 이력 목록을 본다')).toBe('detail')
  })

  it('같은 종류의 레퍼런스 1개만 자동으로 고른다', () => {
    expect(autoReferenceIds('견적 목록 조회', references)).toEqual(['ref-list'])
    expect(autoReferenceIds('견적 상세 보기', references)).toEqual(['ref-detail'])
    expect(autoReferenceIds('견적 등록 팝업', references)).toEqual(['ref-popup'])
    // 등록/입력(form)은 팝업 골든으로 대신한다
    expect(autoReferenceIds('견적 등록 입력', references)).toEqual(['ref-popup'])
    expect(autoReferenceIds('견적 등록 팝업', references)).toEqual(['ref-popup'])
    // 목록이 먼저 나오면 상세가 뒤에 있어도 목록 골든을 붙인다
    expect(autoReferenceIds('견적 목록을 조회하고 상세로 이동한다', references)).toEqual(['ref-list'])
    // 맞는 종류가 없으면 아무것도 붙이지 않는다
    expect(autoReferenceIds('견적 목록', [])).toEqual([])
  })
})

describe('deriveTitle · deriveShell', () => {
  it('첫 문장에서 제목을 뽑고 30자로 줄인다', () => {
    expect(deriveTitle('파트너가 견적 요청 목록을 조회하는 화면. 검색이 된다.')).toBe('파트너가 견적 요청 목록을 조회하는 화면')
    expect(deriveTitle('견적 목록 화면을 만들어')).toBe('견적 목록 화면')
    expect(deriveTitle('   ')).toBe('새 화면')
    expect(deriveTitle('가'.repeat(40))).toHaveLength(30)
  })

  it('포털 이름은 기존 화면에서 가져오고 팝업 낱말이면 popup', () => {
    const screens = [{ shell: 'partner-page' }, { shell: 'partner-popup' }, { shell: 'admin-page' }]
    expect(deriveShell('견적 목록', screens)).toBe('partner-page')
    expect(deriveShell('견적 등록 팝업', screens)).toBe('partner-popup')
    expect(deriveShell('견적 목록', [])).toBe('partner-page')
  })
})

describe('buildSimpleCreateRequest', () => {
  it('문장 하나로 나머지를 채운다 (CASE 3개·참고 화면 자동·요구사항 없음)', () => {
    const { request, notes } = buildSimpleCreateRequest({ screen_id: 'S1', sentence: '  파트너가 견적 목록을 조회한다  ', device: 'desktop', references })
    expect(request).toEqual({
      screen_id: 'S1',
      task_type: 'create',
      purpose: '파트너가 견적 목록을 조회한다',
      requirement_ids: [],
      criterion_ids: [],
      reference_ids: ['ref-list'],
      cases: ['normal', 'empty', 'error'],
      keep_conditions: [],
      roles: [],
      device: 'desktop',
      prompt_override: '파트너가 견적 목록을 조회한다',
    })
    expect(notes.join(' ')).toContain('목록 골든')
    expect(notes.join(' ')).toContain('정상·빈값·오류')
  })

  it('모바일 토글과 참고 화면 없음이 근거에 남는다', () => {
    const { request, notes } = buildSimpleCreateRequest({ screen_id: 'S1', sentence: '무언가', device: 'mobile', references: [] })
    expect(request.device).toBe('mobile')
    expect(request.reference_ids).toEqual([])
    expect(notes.join(' ')).toContain('참고 화면: 없음')
  })
})

describe('buildSimpleEditRequest · casesOfSpec', () => {
  const spec: ScreenSpecLike = { states: [{ id: 'normal', case_kind: 'normal' }, { id: 'empty', case_kind: 'empty' }, { id: 'empty2', case_kind: 'empty' }] }

  it('명세의 CASE 를 그대로 이어받는다 (중복 제거)', () => {
    expect(casesOfSpec(spec)).toEqual(['normal', 'empty'])
    expect(casesOfSpec(null)).toEqual(['normal'])
    expect(casesOfSpec({ states: [] })).toEqual(['normal'])
  })

  it('한 줄 지시가 prompt_override 와 purpose 로 들어가고 기준 버전이 붙는다', () => {
    const req = buildSimpleEditRequest({ screen_id: 'S1', base_revision_id: 'R1', instruction: ' 상태 열을 배지로 ', device: 'desktop', spec })
    expect(req.task_type).toBe('edit')
    expect(req.base_revision_id).toBe('R1')
    expect(req.purpose).toBe('상태 열을 배지로')
    expect(req.prompt_override).toBe('상태 열을 배지로')
    expect(req.cases).toEqual(['normal', 'empty'])
  })

  it('아주 긴 지시는 목적만 줄이고 지시문 전체는 그대로 보낸다', () => {
    const long = '가'.repeat(200)
    const req = buildSimpleEditRequest({ screen_id: 'S1', base_revision_id: 'R1', instruction: long, device: 'desktop', spec: null })
    expect(req.purpose).toHaveLength(120)
    expect(req.prompt_override).toBe(long)
  })
})

describe('progressLine · failureLine', () => {
  it('단계 이름 대신 사람 말 한 줄을 만든다', () => {
    expect(progressLine({ status: 'queued' })).toBe('설계서를 만들고 있습니다 · 준비 중')
    expect(progressLine({ status: 'running', stage: 'spec_generate' })).toBe('설계서를 만들고 있습니다 · 명세 작성 중')
    expect(progressLine({ status: 'running', stage: 'render', verb: '설계서를 고치는 중입니다' })).toBe('설계서를 고치는 중입니다 · 화면 그리는 중')
    expect(progressLine({ status: 'running' })).toBe('설계서를 만들고 있습니다')
  })

  it('실패는 무엇이 잘못됐는지 먼저 쓰고 원인 메시지를 붙인다', () => {
    expect(failureLine({ code: 'model_error', message: '429' })).toBe('AI 가 응답하지 못했습니다 — 429')
    expect(failureLine({ code: 'unknown_code' })).toBe('만들지 못했습니다.')
    expect(failureLine(null)).toBe('알 수 없는 문제가 생겼습니다.')
  })
})

describe('nextScreenExternalId · recentDesigns', () => {
  it('서버와 같은 규칙으로 외부 ID 를 정한다', () => {
    expect(nextScreenExternalId([])).toBe('SCREEN-001')
    expect(nextScreenExternalId(['SAMPLE-quote-list', 'SCREEN-002'])).toBe('SCREEN-003')
  })

  it('결과가 있는 화면만 최근 순으로 보여준다', () => {
    const detail = {
      project: { id: 'P', name: '', org: '', description: '', profile_id: '', created_at: '' },
      requirements: [],
      ia_nodes: [],
      screens: [
        { id: 's1', external_id: 'SAMPLE-1', title: '첫 화면', status: 'review', revision_count: 2, open_comments: 0, current_revision_id: 'r1' },
        { id: 's2', external_id: 'SAMPLE-2', title: '결과 없음', status: 'draft', revision_count: 0, open_comments: 0 },
        { id: 's3', external_id: 'SCREEN-001', title: '새 화면', status: 'review', revision_count: 1, open_comments: 0, current_revision_id: 'r3' },
      ],
    } satisfies ProjectDetail
    expect(recentDesigns(detail)).toEqual([
      { screen_id: 's3', revision_id: 'r3', external_id: 'SCREEN-001', title: '새 화면', versions: 1, status: 'review' },
      { screen_id: 's1', revision_id: 'r1', external_id: 'SAMPLE-1', title: '첫 화면', versions: 2, status: 'review' },
    ])
    expect(recentDesigns(null)).toEqual([])
    expect(recentDesigns(detail, 1)).toHaveLength(1)
  })
})
