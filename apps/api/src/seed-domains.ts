/**
 * 도메인 샘플 시드 — 뱅킹 앱 · 커머스 스토어. 모두 **가상 데이터**이며 실제 고객 데이터가 아니다.
 *
 * 왜 있나: 견적 포털 하나만으로는 «다른 업무에서도 되나» 를 볼 수 없다. 기획자가 「뱅킹 앱에서 조회 화면이다」
 * 같은 문장을 넣었을 때 그 도메인의 요구사항·IA·참고 화면·더미데이터가 함께 있어야 체인이 말이 된다.
 *
 * 견적 포털의 골든 명세(seed.ts)는 견적 전용이라 그대로 쓸 수 없다. 그래서 여기서는 목록·상세 두 종류를
 * **도메인 서술(DomainSeed)** 로 만들고, 그 서술에서 ScreenSpec 을 찍어 낸다. 견적 시드는 손대지 않는다.
 *
 * 두 도메인 모두 화면은 `draft`(생성 전)로 둔다 — 프로토타입에서 직접 만들어 보는 것이 목적이기 때문이다.
 */
import { ScreenSpec, type IANode, type ScreenSpecInput } from '@con-ai/schemas'
import type { DummyDataDocument, ProjectDocument, ReferenceDocument, RequirementDocument, ScreenDocument } from '@con-ai/worker-generation'

// ---------------------------------------------------------------- 서술 타입

type ColumnFormat = 'text' | 'number' | 'currency' | 'date' | 'status' | 'link'

interface DomainColumn {
  id: string
  label: string
  format: ColumnFormat
  sortable?: boolean
}

interface DomainSelectFilter {
  kind: 'select'
  id: string
  label: string
  options: Array<{ value: string; label: string }>
}

interface DomainTextFilter {
  kind: 'text'
  id: string
  label: string
  placeholder: string
  max_length: number
}

interface DomainPeriodFilter {
  kind: 'period'
  id: string
  label: string
  note: string
}

type DomainFilter = DomainSelectFilter | DomainTextFilter | DomainPeriodFilter

interface DomainRequirement {
  external_id: string
  uuid: string
  title: string
  body: string
  criteria: Array<{ id: string; text: string; kind: 'ui' | 'non_ui' }>
}

/** 한 도메인의 샘플 전부. 여기 적은 것만으로 프로젝트·요구사항·IA·화면·레퍼런스·더미데이터가 만들어진다. */
interface DomainSeed {
  key: string
  project_id: string
  slug: string
  name: string
  description: string
  baseline_id: string
  anchor_id: string
  /** 포털 이름 — IA 최상위이자 shell 접두사. */
  portal: string
  shell: string
  device: 'desktop' | 'mobile'
  role: string
  ia: { portal: string; category: string; category_name: string; list: string; detail: string }
  requirements: DomainRequirement[]
  list: {
    screen_uuid: string
    reference_uuid: string
    external_id: string
    reference_id: string
    title: string
    purpose: string
    section_title: string
    filters: DomainFilter[]
    columns: DomainColumn[]
    default_sort: { column_id: string; direction: 'asc' | 'desc' }
    /** 표에서 상세로 넘어가는 컬럼. */
    link_column: string
    rows: Array<Record<string, unknown>>
    /** searched CASE 가 남길 행을 고르는 값 (link_column 기준). */
    searched_value: string
    empty_text: string
    error_text: string
    permission_text: string
    permission_role: string
    /** 데이터 매핑 근거 표기 (원본 테이블·컬럼 이름은 합성). */
    mapping: Array<{ column_id: string; source: string }>
    assumption: string
  }
  detail: {
    screen_uuid: string
    reference_uuid: string
    external_id: string
    reference_id: string
    title: string
    purpose: string
    /** 상단 기본 정보 항목 (레이블만 표시). */
    facts: Array<{ id: string; label: string }>
    line_title: string
    line_columns: DomainColumn[]
    line_rows: Array<Record<string, unknown>>
    error_text: string
  }
}

// ---------------------------------------------------------------- 명세 만들기

type SpecElement = ScreenSpecInput['sections'][number]['elements'][number]

function filterElement(f: DomainFilter, no: string, trace: string[]): SpecElement {
  if (f.kind === 'text') {
    return {
      id: f.id,
      type: 'text-input',
      label: f.label,
      display_no: no,
      placeholder: f.placeholder,
      max_length: f.max_length,
      validations: [{ rule: 'max_length', value: f.max_length, message_id: `msg-${f.id}-too-long` }],
      trace,
    }
  }
  if (f.kind === 'period') return { id: f.id, type: 'date-range', label: f.label, display_no: no, trace, note: f.note }
  return { id: f.id, type: 'select', label: f.label, display_no: no, options: f.options, trace, note: '상태값은 합성 값이다. 정본은 unresolved 참조' }
}

const LETTERS = 'abcdefghijklmnop'

/** 목록 화면 명세 — 검색·정렬·다운로드·상세 이동, CASE 정상/검색/빈값/오류/권한. */
export function domainListSpec(d: DomainSeed, screenId: string, fixturePrefix: string, detailScreenId: string): ScreenSpecInput {
  const [reqList, reqDetail, reqDownload, reqGuard] = d.requirements
  if (reqList === undefined || reqDetail === undefined || reqDownload === undefined || reqGuard === undefined) {
    throw new Error(`${d.key}: 요구사항 4건이 필요하다`)
  }
  const searchTrace = [reqList.criteria[0]?.id ?? '']
  const evidence = [{ anchor_id: d.anchor_id, note: '합성 요구사항 문서의 데이터 항목' }]
  const filters = d.list.filters.map((f, i) => filterElement(f, LETTERS[i] ?? 'z', searchTrace))
  const lengthMessages = d.list.filters.flatMap((f) =>
    f.kind === 'text' ? [{ id: `msg-${f.id}-too-long`, kind: 'warning' as const, text: `${f.label}은(는) ${f.max_length}자 이내로 입력하세요.`, when: '검색어 글자수 초과' }] : [],
  )
  return {
    schema_version: '1.0',
    screen_id: screenId,
    baseline_id: d.baseline_id,
    purpose: d.list.purpose,
    shell: d.shell,
    device: d.device,
    roles: [d.role],
    requirements: [
      { id: reqList.external_id, criterion_ids: reqList.criteria.map((c) => c.id) },
      { id: reqDownload.external_id, criterion_ids: reqDownload.criteria.filter((c) => c.kind === 'ui').map((c) => c.id) },
      { id: reqGuard.external_id, criterion_ids: reqGuard.criteria.filter((c) => c.kind === 'ui').map((c) => c.id) },
    ],
    sections: [
      {
        id: 'search',
        title: '검색 조건',
        display_no: '1',
        elements: [...filters, { id: 'search-button', type: 'button', label: '검색', display_no: LETTERS[filters.length] ?? 'z', note: '검색 조건으로 더미데이터를 거른다' }],
      },
      {
        id: 'results',
        title: d.list.section_title,
        display_no: '2',
        elements: [
          {
            id: 'result-table',
            type: 'table',
            label: `${d.list.section_title} 표`,
            display_no: 'a',
            columns: d.list.columns.map((c) => ({ id: c.id, label: c.label, format: c.format, ...(c.sortable === true ? { sortable: true } : {}) })),
            default_sort: d.list.default_sort,
            trace: [reqList.criteria[1]?.id ?? ''],
            note: `${d.list.link_column} 을(를) 누르면 상세로 이동한다`,
          },
          { id: 'download-button', type: 'button', label: '목록 다운로드', display_no: 'b', trace: [reqDownload.criteria[0]?.id ?? ''] },
          { id: 'pager', type: 'pagination', label: '페이지', display_no: 'c', note: '10건 단위' },
        ],
      },
    ],
    actions: [
      { id: 'search-submit', type: 'filter-fixture', label: '검색', trigger: 'search-button', target: 'results', trace: searchTrace, note: '검색 조건으로 fixture 행을 거른다. 0건이면 empty CASE 로 전이' },
      { id: 'sort-rows', type: 'sort-fixture', label: '정렬', target: 'result-table', trace: [reqList.criteria[1]?.id ?? ''] },
      { id: 'download-rows', type: 'download-fixture', label: '목록 다운로드', trigger: 'download-button', target: 'result-table', trace: reqDownload.criteria.filter((c) => c.kind === 'ui').map((c) => c.id), note: '표 컬럼 그대로 현재 검색 결과를 예제 파일로 만든다' },
      { id: 'open-detail', type: 'navigate', label: '상세 이동', target: 'result-table', target_screen_id: detailScreenId },
      { id: 'show-empty', type: 'set-state', label: '결과 없음 표시', target_state_id: 'empty', trace: [reqList.criteria[2]?.id ?? ''] },
      { id: 'show-error', type: 'set-state', label: '조회 오류 표시', target_state_id: 'error', trace: [reqGuard.criteria[1]?.id ?? reqGuard.criteria[0]?.id ?? ''] },
      { id: 'show-permission', type: 'set-state', label: '권한 없음 표시', target_state_id: 'permission', trace: [reqGuard.criteria[0]?.id ?? ''] },
    ],
    states: [
      { id: 'normal', fixture_id: `${fixturePrefix}-normal`, expected: `${d.list.rows.length}건이 ${d.list.default_sort.column_id} 기준으로 표시`, case_kind: 'normal' },
      { id: 'searched', fixture_id: `${fixturePrefix}-searched`, expected: `${d.list.searched_value} 과(와) 일치하는 1건 표시`, case_kind: 'normal' },
      { id: 'empty', fixture_id: `${fixturePrefix}-empty`, expected: '결과 없음 안내 표시, 표 본문은 비움', case_kind: 'empty', message_ids: ['msg-empty'] },
      { id: 'error', fixture_id: `${fixturePrefix}-error`, expected: '조회 오류 메시지 표시, 표는 비움', case_kind: 'error', message_ids: ['msg-error'] },
      { id: 'permission', fixture_id: `${fixturePrefix}-permission`, expected: '권한 안내를 표시하고 다운로드 버튼을 비활성화', case_kind: 'permission', role: d.list.permission_role, message_ids: ['msg-no-permission'] },
    ],
    messages: [
      { id: 'msg-empty', kind: 'info', text: d.list.empty_text, when: '검색 결과 0건' },
      { id: 'msg-error', kind: 'error', text: d.list.error_text, when: '조회 오류' },
      { id: 'msg-no-permission', kind: 'warning', text: d.list.permission_text, when: '권한 없는 사용자' },
      ...lengthMessages,
    ],
    data_mapping: d.list.mapping.map((m) => ({ element_id: 'result-table', column_id: m.column_id, source: m.source, evidence })),
    locked_elements: [],
    locked_actions: [],
    unresolved: [{ kind: 'assumption', text: d.list.assumption, related_ids: ['result-table'] }],
  }
}

/** 상세 화면 명세 — 기본 정보 + 내역 표, CASE 정상/오류. */
export function domainDetailSpec(d: DomainSeed, screenId: string, fixturePrefix: string, listScreenId: string): ScreenSpecInput {
  const reqDetail = d.requirements[1]
  if (reqDetail === undefined) throw new Error(`${d.key}: 상세 요구사항이 필요하다`)
  const evidence = [{ anchor_id: d.anchor_id, note: '합성 요구사항 문서의 데이터 항목' }]
  return {
    schema_version: '1.0',
    screen_id: screenId,
    baseline_id: d.baseline_id,
    purpose: d.detail.purpose,
    shell: d.shell,
    device: d.device,
    roles: [d.role],
    requirements: [{ id: reqDetail.external_id, criterion_ids: reqDetail.criteria.map((c) => c.id) }],
    sections: [
      {
        id: 'facts',
        title: '기본 정보',
        display_no: '1',
        elements: d.detail.facts.map((f, i) => ({ id: f.id, type: 'text' as const, label: f.label, display_no: LETTERS[i] ?? 'z', trace: [reqDetail.criteria[0]?.id ?? ''] })),
      },
      {
        id: 'lines',
        title: d.detail.line_title,
        display_no: '2',
        elements: [
          {
            id: 'line-table',
            type: 'table',
            label: `${d.detail.line_title} 표`,
            display_no: 'a',
            columns: d.detail.line_columns.map((c) => ({ id: c.id, label: c.label, format: c.format, ...(c.sortable === true ? { sortable: true } : {}) })),
            trace: [reqDetail.criteria[1]?.id ?? reqDetail.criteria[0]?.id ?? ''],
          },
          { id: 'back-button', type: 'button', label: '목록으로', display_no: 'b' },
        ],
      },
    ],
    actions: [
      { id: 'back-to-list', type: 'navigate', label: '목록으로', trigger: 'back-button', target_screen_id: listScreenId },
      { id: 'show-detail-error', type: 'set-state', label: '조회 오류 표시', target_state_id: 'error' },
    ],
    states: [
      { id: 'normal', fixture_id: `${fixturePrefix}-normal`, expected: `${d.detail.line_title} ${d.detail.line_rows.length}행 표시`, case_kind: 'normal' },
      { id: 'error', fixture_id: `${fixturePrefix}-error`, expected: '조회 오류 메시지 표시, 표는 비움', case_kind: 'error', message_ids: ['msg-detail-error'] },
    ],
    messages: [{ id: 'msg-detail-error', kind: 'error', text: d.detail.error_text, when: '조회 오류' }],
    data_mapping: [{ element_id: 'line-table', column_id: d.detail.line_columns[0]?.id ?? '', source: `${d.key}_lines.${d.detail.line_columns[0]?.id ?? ''}`, evidence }],
    locked_elements: [],
    locked_actions: [],
    unresolved: [{ kind: 'question', text: '상세 화면의 인쇄·공유 동작이 필요한지 확인해야 한다 (샘플에는 넣지 않았다)', related_ids: ['line-table'] }],
  }
}

// ---------------------------------------------------------------- 도메인 1: 뱅킹 앱

const BANKING: DomainSeed = {
  key: 'banking',
  project_id: 'b1000000-0000-4000-8000-000000000001',
  slug: 'wyliy-banking-sample',
  name: '와일리 컨버전스 샘플 — 뱅킹 앱',
  description: '개인 고객이 계좌 거래내역을 조회하는 가상 모바일 뱅킹. 합성 데이터이며 실제 계좌·거래가 아니다.',
  baseline_id: 'baseline-wyliy-banking-sample-1',
  anchor_id: 'b7000000-0000-4000-8000-000000000001',
  portal: 'MY 뱅킹',
  shell: 'banking-page',
  device: 'mobile',
  role: 'customer',
  ia: {
    portal: 'b2000000-0000-4000-8000-000000000001',
    category: 'b2000000-0000-4000-8000-000000000002',
    category_name: '계좌',
    list: 'b2000000-0000-4000-8000-000000000003',
    detail: 'b2000000-0000-4000-8000-000000000004',
  },
  requirements: [
    {
      external_id: 'REQ-BK-001',
      uuid: 'b3000000-0000-4000-8000-000000000001',
      title: '거래내역 조회',
      body: '고객은 선택한 계좌의 거래내역을 기간·거래구분·적요로 검색하고 결과를 목록으로 확인한다.',
      criteria: [
        { id: 'AC-BK-001-01', text: '조회 기간·거래구분·적요로 거래내역을 검색한다', kind: 'ui' },
        { id: 'AC-BK-001-02', text: '검색 결과를 거래일시 내림차순으로 표시하고 정렬을 지원한다', kind: 'ui' },
        { id: 'AC-BK-001-03', text: '검색 결과가 없으면 안내 문구를 표시한다', kind: 'ui' },
      ],
    },
    {
      external_id: 'REQ-BK-002',
      uuid: 'b3000000-0000-4000-8000-000000000002',
      title: '거래 상세 조회',
      body: '고객은 거래 한 건을 눌러 거래일시·적요·금액·잔액과 수수료 내역을 확인한다.',
      criteria: [
        { id: 'AC-BK-002-01', text: '거래 기본 정보(거래일시·적요·금액·잔액)를 표시한다', kind: 'ui' },
        { id: 'AC-BK-002-02', text: '수수료·이자 등 부가 내역을 표로 표시한다', kind: 'ui' },
      ],
    },
    {
      external_id: 'REQ-BK-003',
      uuid: 'b3000000-0000-4000-8000-000000000003',
      title: '거래내역 내려받기',
      body: '고객은 조회한 거래내역을 파일로 내려받는다. 내려받기 이력은 감사 목적으로 보관한다.',
      criteria: [
        { id: 'AC-BK-003-01', text: '현재 검색 결과를 화면의 표 항목 그대로 내려받는다', kind: 'ui' },
        { id: 'AC-BK-003-02', text: '내려받기 요청 시각·계정을 감사 로그에 남긴다', kind: 'non_ui' },
      ],
    },
    {
      external_id: 'REQ-BK-004',
      uuid: 'b3000000-0000-4000-8000-000000000004',
      title: '권한·오류 처리',
      body: '조회 권한이 없거나 조회에 실패하면 사용자가 다음 행동을 알 수 있게 안내한다.',
      criteria: [
        { id: 'AC-BK-004-01', text: '조회 권한이 없으면 안내를 표시하고 내려받기를 막는다', kind: 'ui' },
        { id: 'AC-BK-004-02', text: '조회 오류 시 오류 안내를 표시하고 표를 비운다', kind: 'ui' },
      ],
    },
  ],
  list: {
    screen_uuid: 'b4000000-0000-4000-8000-000000000001',
    reference_uuid: 'b5000000-0000-4000-8000-000000000001',
    external_id: 'SAMPLE-bank-txn-list',
    reference_id: 'REF-bank-txn-list',
    title: '거래내역 조회',
    purpose: '고객이 계좌 거래내역을 기간·거래구분·적요로 검색하고 상세·내려받기로 이어진다',
    section_title: '거래내역',
    filters: [
      { kind: 'period', id: 'period', label: '조회 기간', note: '거래일 기준. 시작일이 종료일보다 늦으면 입력 불가' },
      {
        kind: 'select',
        id: 'txn-type',
        label: '거래구분',
        options: [
          { value: '', label: '전체' },
          { value: 'BK_DEPOSIT', label: '입금' },
          { value: 'BK_WITHDRAWAL', label: '출금' },
        ],
      },
      { kind: 'text', id: 'memo', label: '적요', placeholder: '적요 입력', max_length: 30 },
    ],
    columns: [
      { id: 'txn_at', label: '거래일시', format: 'date', sortable: true },
      { id: 'memo', label: '적요', format: 'link' },
      { id: 'withdrawal', label: '출금', format: 'currency', sortable: true },
      { id: 'deposit', label: '입금', format: 'currency', sortable: true },
      { id: 'balance', label: '거래 후 잔액', format: 'currency' },
      { id: 'channel', label: '채널', format: 'text' },
    ],
    default_sort: { column_id: 'txn_at', direction: 'desc' },
    link_column: 'memo',
    rows: [
      { txn_at: '2026-09-05', memo: '예시상점 결제', withdrawal: 24800, deposit: 0, balance: 1284300, channel: '체크카드' },
      { txn_at: '2026-09-04', memo: '급여', withdrawal: 0, deposit: 3200000, balance: 1309100, channel: '이체' },
      { txn_at: '2026-09-03', memo: '통신요금 자동이체', withdrawal: 41000, deposit: 0, balance: -1890900, channel: '자동이체' },
      { txn_at: '2026-09-02', memo: 'ATM 출금', withdrawal: 100000, deposit: 0, balance: -1849900, channel: 'ATM' },
      { txn_at: '2026-09-01', memo: '이자', withdrawal: 0, deposit: 1230, balance: -1749900, channel: '이자' },
    ],
    searched_value: '적요 「급여」',
    empty_text: '조회 기간에 거래내역이 없습니다.',
    error_text: '거래내역을 불러오지 못했습니다. 잠시 후 다시 시도하세요.',
    permission_text: '이 계좌의 거래내역 조회 권한이 없습니다.',
    permission_role: 'customer-readonly',
    mapping: [
      { column_id: 'txn_at', source: 'transactions.transacted_at' },
      { column_id: 'balance', source: 'transactions.balance_after' },
    ],
    assumption: '거래구분 코드(BK_DEPOSIT 등)는 합성 값이다. 실제 코드 체계 정본은 미확정이며 채택 시 StateModel 로 기록한다',
  },
  detail: {
    screen_uuid: 'b4000000-0000-4000-8000-000000000002',
    reference_uuid: 'b5000000-0000-4000-8000-000000000002',
    external_id: 'SAMPLE-bank-txn-detail',
    reference_id: 'REF-bank-txn-detail',
    title: '거래 상세',
    purpose: '고객이 거래 한 건의 기본 정보와 수수료·이자 부가 내역을 확인한다',
    facts: [
      { id: 'fact-txn-at', label: '거래일시' },
      { id: 'fact-memo', label: '적요' },
      { id: 'fact-amount', label: '거래 금액' },
      { id: 'fact-balance', label: '거래 후 잔액' },
    ],
    line_title: '부가 내역',
    line_columns: [
      { id: 'line_name', label: '항목', format: 'text' },
      { id: 'line_amount', label: '금액', format: 'currency' },
      { id: 'line_note', label: '비고', format: 'text' },
    ],
    line_rows: [
      { line_name: '이체 수수료', line_amount: 500, line_note: '타행 이체' },
      { line_name: '우대 감면', line_amount: -500, line_note: '급여 이체 실적' },
    ],
    error_text: '거래 상세를 불러오지 못했습니다.',
  },
}

// ---------------------------------------------------------------- 도메인 2: 커머스 스토어

const COMMERCE: DomainSeed = {
  key: 'commerce',
  project_id: 'c1000000-0000-4000-8000-000000000001',
  slug: 'wyliy-commerce-sample',
  name: '와일리 컨버전스 샘플 — 커머스 스토어',
  description: '판매자가 주문을 조회·처리하는 가상 스토어 관리자. 합성 데이터이며 실제 주문·구매자가 아니다.',
  baseline_id: 'baseline-wyliy-commerce-sample-1',
  anchor_id: 'c7000000-0000-4000-8000-000000000001',
  portal: '스토어 관리',
  shell: 'store-page',
  device: 'desktop',
  role: 'seller',
  ia: {
    portal: 'c2000000-0000-4000-8000-000000000001',
    category: 'c2000000-0000-4000-8000-000000000002',
    category_name: '주문',
    list: 'c2000000-0000-4000-8000-000000000003',
    detail: 'c2000000-0000-4000-8000-000000000004',
  },
  requirements: [
    {
      external_id: 'REQ-CM-001',
      uuid: 'c3000000-0000-4000-8000-000000000001',
      title: '주문 목록 조회',
      body: '판매자는 주문을 주문번호·주문기간·주문상태로 검색하고 결과를 표로 확인한다.',
      criteria: [
        { id: 'AC-CM-001-01', text: '주문번호·주문기간·주문상태로 주문을 검색한다', kind: 'ui' },
        { id: 'AC-CM-001-02', text: '검색 결과를 주문일시 내림차순 표로 표시하고 정렬을 지원한다', kind: 'ui' },
        { id: 'AC-CM-001-03', text: '검색 결과가 없으면 안내 문구를 표시한다', kind: 'ui' },
      ],
    },
    {
      external_id: 'REQ-CM-002',
      uuid: 'c3000000-0000-4000-8000-000000000002',
      title: '주문 상세 조회',
      body: '판매자는 주문 한 건의 구매자·배송지·결제 정보와 주문 상품 목록을 확인한다.',
      criteria: [
        { id: 'AC-CM-002-01', text: '주문 기본 정보(주문번호·주문일시·구매자·결제금액)를 표시한다', kind: 'ui' },
        { id: 'AC-CM-002-02', text: '주문 상품을 표로 표시한다', kind: 'ui' },
      ],
    },
    {
      external_id: 'REQ-CM-003',
      uuid: 'c3000000-0000-4000-8000-000000000003',
      title: '주문 목록 내려받기',
      body: '판매자는 조회한 주문 목록을 파일로 내려받아 정산에 사용한다.',
      criteria: [
        { id: 'AC-CM-003-01', text: '현재 검색 결과를 화면의 표 항목 그대로 내려받는다', kind: 'ui' },
        { id: 'AC-CM-003-02', text: '구매자 연락처는 내려받기 파일에 포함하지 않는다', kind: 'non_ui' },
      ],
    },
    {
      external_id: 'REQ-CM-004',
      uuid: 'c3000000-0000-4000-8000-000000000004',
      title: '권한·오류 처리',
      body: '정산 권한이 없거나 조회에 실패하면 판매자가 다음 행동을 알 수 있게 안내한다.',
      criteria: [
        { id: 'AC-CM-004-01', text: '정산 권한이 없으면 안내를 표시하고 내려받기를 막는다', kind: 'ui' },
        { id: 'AC-CM-004-02', text: '조회 오류 시 오류 안내를 표시하고 표를 비운다', kind: 'ui' },
      ],
    },
  ],
  list: {
    screen_uuid: 'c4000000-0000-4000-8000-000000000001',
    reference_uuid: 'c5000000-0000-4000-8000-000000000001',
    external_id: 'SAMPLE-order-list',
    reference_id: 'REF-order-list',
    title: '주문 목록',
    purpose: '판매자가 주문을 주문번호·기간·상태로 검색하고 상세·내려받기로 이어진다',
    section_title: '주문 목록',
    filters: [
      { kind: 'text', id: 'order-no', label: '주문번호', placeholder: '주문번호 입력', max_length: 20 },
      { kind: 'period', id: 'ordered-period', label: '주문 기간', note: '주문일 기준. 시작일이 종료일보다 늦으면 입력 불가' },
      {
        kind: 'select',
        id: 'order-status',
        label: '주문상태',
        options: [
          { value: '', label: '전체' },
          { value: 'CM_PAID', label: '결제완료' },
          { value: 'CM_PREPARING', label: '배송준비' },
          { value: 'CM_SHIPPED', label: '배송중' },
          { value: 'CM_DONE', label: '배송완료' },
          { value: 'CM_CANCELED', label: '취소' },
        ],
      },
    ],
    columns: [
      { id: 'order_no', label: '주문번호', format: 'link', sortable: true },
      { id: 'ordered_at', label: '주문일시', format: 'date', sortable: true },
      { id: 'buyer_name', label: '구매자', format: 'text' },
      { id: 'item_summary', label: '상품', format: 'text' },
      { id: 'qty', label: '수량', format: 'number' },
      { id: 'amount', label: '결제금액', format: 'currency', sortable: true },
      { id: 'status', label: '주문상태', format: 'status' },
    ],
    default_sort: { column_id: 'ordered_at', direction: 'desc' },
    link_column: 'order_no',
    rows: [
      { order_no: 'ORD-2026-0512', ordered_at: '2026-09-05', buyer_name: '예시구매자A', item_summary: '예시 상품 A 외 1건', qty: 2, amount: 48900, status: 'CM_PAID' },
      { order_no: 'ORD-2026-0511', ordered_at: '2026-09-05', buyer_name: '예시구매자B', item_summary: '예시 상품 C', qty: 1, amount: 12000, status: 'CM_PREPARING' },
      { order_no: 'ORD-2026-0510', ordered_at: '2026-09-04', buyer_name: '예시구매자C', item_summary: '예시 상품 B 외 3건', qty: 4, amount: 157000, status: 'CM_SHIPPED' },
      { order_no: 'ORD-2026-0509', ordered_at: '2026-09-03', buyer_name: '예시구매자A', item_summary: '예시 상품 D', qty: 1, amount: 33000, status: 'CM_DONE' },
      { order_no: 'ORD-2026-0508', ordered_at: '2026-09-02', buyer_name: '예시구매자D', item_summary: '예시 상품 A', qty: 1, amount: 24500, status: 'CM_CANCELED' },
    ],
    searched_value: '주문번호 ORD-2026-0510',
    empty_text: '조회 조건에 맞는 주문이 없습니다.',
    error_text: '주문 목록을 불러오지 못했습니다. 잠시 후 다시 시도하세요.',
    permission_text: '정산 권한이 없어 주문 목록을 내려받을 수 없습니다.',
    permission_role: 'seller-readonly',
    mapping: [
      { column_id: 'order_no', source: 'orders.order_no' },
      { column_id: 'amount', source: 'orders.paid_amount' },
    ],
    assumption: '주문상태 코드(CM_PAID 등)는 합성 값이다. 실제 상태 모델 정본은 미확정이며 채택 시 StateModel 로 기록한다',
  },
  detail: {
    screen_uuid: 'c4000000-0000-4000-8000-000000000002',
    reference_uuid: 'c5000000-0000-4000-8000-000000000002',
    external_id: 'SAMPLE-order-detail',
    reference_id: 'REF-order-detail',
    title: '주문 상세',
    purpose: '판매자가 주문 한 건의 기본 정보와 주문 상품 목록을 확인한다',
    facts: [
      { id: 'fact-order-no', label: '주문번호' },
      { id: 'fact-ordered-at', label: '주문일시' },
      { id: 'fact-buyer', label: '구매자' },
      { id: 'fact-amount', label: '결제금액' },
    ],
    line_title: '주문 상품',
    line_columns: [
      { id: 'product_name', label: '상품명', format: 'text' },
      { id: 'option_name', label: '옵션', format: 'text' },
      { id: 'qty', label: '수량', format: 'number' },
      { id: 'unit_price', label: '단가', format: 'currency' },
      { id: 'line_amount', label: '금액', format: 'currency' },
    ],
    line_rows: [
      { product_name: '예시 상품 A', option_name: '기본', qty: 1, unit_price: 24500, line_amount: 24500 },
      { product_name: '예시 상품 B', option_name: '大', qty: 1, unit_price: 24400, line_amount: 24400 },
    ],
    error_text: '주문 상세를 불러오지 못했습니다.',
  },
}

export const SEED_DOMAINS: readonly DomainSeed[] = [BANKING, COMMERCE]

// ---------------------------------------------------------------- 문서 만들기

function projectOf(d: DomainSeed, createdAt: string): ProjectDocument {
  return {
    id: d.project_id,
    name: d.name,
    slug: d.slug,
    org: '와일리 컨버전스 본부',
    description: d.description,
    profile_id: 's2b-learned-v1',
    baseline_id: d.baseline_id,
    created_at: createdAt,
  }
}

function requirementsOf(d: DomainSeed): RequirementDocument[] {
  return d.requirements.map((r) => ({ id: r.uuid, project_id: d.project_id, external_id: r.external_id, title: r.title, body: r.body, criteria: r.criteria }))
}

function screensOf(d: DomainSeed): ScreenDocument[] {
  return [
    { id: d.list.screen_uuid, project_id: d.project_id, external_id: d.list.external_id, title: d.list.title, shell: d.shell, device: d.device, status: 'draft', aliases: [] },
    { id: d.detail.screen_uuid, project_id: d.project_id, external_id: d.detail.external_id, title: d.detail.title, shell: d.shell, device: d.device, status: 'draft', aliases: [] },
  ]
}

/**
 * IA 트리 — 포털 → 분류 → 화면 2개 (3단). 견적 시드와 같은 규칙으로
 * 요구사항을 **일부만** 연결하고 `external_id`·`functions` 는 넣지 않는다 (발번은 사람이 한다).
 */
function iaNodesOf(d: DomainSeed): IANode[] {
  const [reqList, reqDetail] = d.requirements
  return [
    { id: d.ia.portal, project_id: d.project_id, parent_id: null, name: d.portal, order: 0, portal: d.portal, kind: 'category' },
    { id: d.ia.category, project_id: d.project_id, parent_id: d.ia.portal, name: d.ia.category_name, order: 0, portal: d.portal, kind: 'category' },
    {
      id: d.ia.list,
      project_id: d.project_id,
      parent_id: d.ia.category,
      name: d.list.title,
      order: 0,
      portal: d.portal,
      kind: 'screen',
      screen_plan_id: d.list.screen_uuid,
      ...(reqList === undefined ? {} : { requirement_ids: [reqList.external_id] }),
    },
    {
      id: d.ia.detail,
      project_id: d.project_id,
      parent_id: d.ia.category,
      name: d.detail.title,
      order: 1,
      portal: d.portal,
      kind: 'screen',
      screen_plan_id: d.detail.screen_uuid,
      ...(reqDetail === undefined ? {} : { requirement_ids: [reqDetail.external_id] }),
    },
  ]
}

function referencesOf(d: DomainSeed): ReferenceDocument[] {
  return [
    {
      id: d.list.reference_uuid,
      project_id: d.project_id,
      title: `${d.list.title} 골든 — 검색·정렬·다운로드`,
      category: 'list',
      description: `${d.portal} 목록 규격. 검색 조건 영역과 결과 표, 정상/검색/빈값/오류/권한 CASE.`,
      spec: ScreenSpec.parse(domainListSpec(d, d.list.reference_id, d.list.reference_id, d.detail.reference_id)),
      tags: [d.key, 'list', 'search', 'table', 'download'],
      source: `${d.name} 합성 예시`,
    },
    {
      id: d.detail.reference_uuid,
      project_id: d.project_id,
      title: `${d.detail.title} 골든 — 기본 정보·내역 표`,
      category: 'detail',
      description: `${d.portal} 상세 규격. 기본 정보 영역과 내역 표, 정상/오류 CASE.`,
      spec: ScreenSpec.parse(domainDetailSpec(d, d.detail.reference_id, d.detail.reference_id, d.list.reference_id)),
      tags: [d.key, 'detail', 'table'],
      source: `${d.name} 합성 예시`,
    },
  ]
}

function dummyOf(d: DomainSeed): DummyDataDocument[] {
  const doc = (prefix: string, screenExternalId: string, suffix: string, case_kind: DummyDataDocument['case_kind'], rows: Array<Record<string, unknown>>, note: string): DummyDataDocument => ({
    id: `${prefix}-${suffix}`,
    project_id: d.project_id,
    screen_external_id: screenExternalId,
    case_kind,
    rows,
    note,
  })
  const searched = d.list.rows.filter((r) => String(r[d.list.link_column] ?? '').includes(d.list.searched_value.replace(/^.*\s/, '')))
  const listRows = (prefix: string, screenExternalId: string): DummyDataDocument[] => [
    doc(prefix, screenExternalId, 'normal', 'normal', d.list.rows, `정상 ${d.list.rows.length}행`),
    doc(prefix, screenExternalId, 'searched', 'normal', searched.length > 0 ? searched : d.list.rows.slice(0, 1), `${d.list.searched_value} 검색 결과`),
    doc(prefix, screenExternalId, 'empty', 'empty', [], '검색 결과 0건'),
    doc(prefix, screenExternalId, 'error', 'error', [], '조회 오류 (표 비움, 오류 메시지)'),
    doc(prefix, screenExternalId, 'permission', 'permission', d.list.rows, '권한 없는 사용자 — 목록은 같고 내려받기 비활성'),
  ]
  const detailRows = (prefix: string, screenExternalId: string): DummyDataDocument[] => [
    doc(prefix, screenExternalId, 'normal', 'normal', d.detail.line_rows, `${d.detail.line_title} ${d.detail.line_rows.length}행`),
    doc(prefix, screenExternalId, 'error', 'error', [], '조회 오류'),
  ]
  return [
    ...listRows(d.list.reference_id, d.list.reference_id),
    ...detailRows(d.detail.reference_id, d.detail.reference_id),
    ...listRows(d.list.external_id, d.list.external_id),
    ...detailRows(d.detail.external_id, d.detail.external_id),
  ]
}

/** 한 도메인의 문서 전부 — seedIfEmpty 가 그대로 저장한다. */
export function domainDocuments(d: DomainSeed, createdAt: string): {
  project: ProjectDocument
  requirements: RequirementDocument[]
  ia_nodes: IANode[]
  screens: ScreenDocument[]
  references: ReferenceDocument[]
  dummy_data: DummyDataDocument[]
} {
  return {
    project: projectOf(d, createdAt),
    requirements: requirementsOf(d),
    ia_nodes: iaNodesOf(d),
    screens: screensOf(d),
    references: referencesOf(d),
    dummy_data: dummyOf(d),
  }
}
