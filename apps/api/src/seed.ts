/**
 * 샘플 시드 (계약 §10) — 프로젝트 "와일리 컨버전스 샘플 — 파트너 견적 포털". 모두 가상 데이터이며 실제 고객 데이터·S2B 원문은 쓰지 않는다.
 *
 * 내용: 요구사항 5건(수용조건 2~3, 그중 1건은 비UI 조건 포함), To-Be IA(파트너 포털 > 견적 > 목록/상세/등록 팝업),
 *       화면 3개(SAMPLE-quote-list / SAMPLE-quote-detail / SAMPLE-quote-create-popup), 레퍼런스 3개(목록/상세/팝업 골든 명세 — ScreenSpec 파싱 통과),
 *       더미데이터(fixture_id 별 행 배열; 레퍼런스용 REF-* 와 화면용 SAMPLE-* 둘 다), 프롬프트 템플릿 v1 레코드.
 * DB 가 비어 있을 때(project 문서 0건)만 실행한다.
 */
import { ScreenSpec, type IANode, type ScreenSpecInput } from '@con-ai/schemas'
import { sha256, type DummyDataDocument, type ProjectDocument, type PromptTemplateDocument, type ReferenceDocument, type RequirementDocument, type ScreenDocument, type Store } from '@con-ai/worker-generation'

/** 시드 문서 ID (테스트·API 가 참조). 합성 UUID 는 앞자리로 종류를 구분한다: a1 프로젝트, a2 IA, a3 요구사항, a4 화면, a5 레퍼런스, a6 템플릿, a7 anchor. */
export const SEED = {
  project_id: 'a1000000-0000-4000-8000-000000000001',
  project_slug: 'wyliy-partner-quote-sample',
  baseline_id: 'baseline-wyliy-partner-quote-sample-1',
  anchor_id: 'a7000000-0000-4000-8000-000000000001',
  requirements: {
    'REQ-QT-001': 'a3000000-0000-4000-8000-000000000001',
    'REQ-QT-002': 'a3000000-0000-4000-8000-000000000002',
    'REQ-QT-003': 'a3000000-0000-4000-8000-000000000003',
    'REQ-QT-004': 'a3000000-0000-4000-8000-000000000004',
    'REQ-QT-005': 'a3000000-0000-4000-8000-000000000005',
  },
  screens: {
    'SAMPLE-quote-list': 'a4000000-0000-4000-8000-000000000001',
    'SAMPLE-quote-detail': 'a4000000-0000-4000-8000-000000000002',
    'SAMPLE-quote-create-popup': 'a4000000-0000-4000-8000-000000000003',
  },
  references: {
    'REF-quote-list': 'a5000000-0000-4000-8000-000000000001',
    'REF-quote-detail': 'a5000000-0000-4000-8000-000000000002',
    'REF-quote-create-popup': 'a5000000-0000-4000-8000-000000000003',
  },
  ia_nodes: {
    portal: 'a2000000-0000-4000-8000-000000000001',
    quote: 'a2000000-0000-4000-8000-000000000002',
    list: 'a2000000-0000-4000-8000-000000000003',
    detail: 'a2000000-0000-4000-8000-000000000004',
    create: 'a2000000-0000-4000-8000-000000000005',
  },
  prompt_template_id: 'a6000000-0000-4000-8000-000000000001',
} as const

export const SEED_PROJECT_NAME = '와일리 컨버전스 샘플 — 파트너 견적 포털'

// ---------- 요구사항 ----------

export const SEED_REQUIREMENTS: RequirementDocument[] = [
  {
    id: SEED.requirements['REQ-QT-001'],
    project_id: SEED.project_id,
    external_id: 'REQ-QT-001',
    title: '견적 목록 조회',
    body: '파트너는 자신이 요청한 견적 목록을 견적번호·요청 기간·상태로 검색하고 결과를 표로 확인한다. 결과가 없으면 안내 문구를 본다.',
    criteria: [
      { id: 'AC-QT-001-01', text: '견적번호·요청 기간·견적 상태로 목록을 검색한다', kind: 'ui' },
      { id: 'AC-QT-001-02', text: '검색 결과를 요청일 내림차순 표로 표시하고 컬럼 정렬을 지원한다', kind: 'ui' },
      { id: 'AC-QT-001-03', text: '검색 결과가 없으면 결과 없음 안내를 표시한다', kind: 'ui' },
    ],
  },
  {
    id: SEED.requirements['REQ-QT-002'],
    project_id: SEED.project_id,
    external_id: 'REQ-QT-002',
    title: '견적 상세 조회',
    body: '파트너는 견적 한 건의 기본 정보·품목·상태 이력을 확인한다.',
    criteria: [
      { id: 'AC-QT-002-01', text: '견적 기본 정보(견적번호·파트너·요청일·상태·합계)와 품목 표를 표시한다', kind: 'ui' },
      { id: 'AC-QT-002-02', text: '상태 변경 이력을 최신순 표로 표시한다', kind: 'ui' },
    ],
  },
  {
    id: SEED.requirements['REQ-QT-003'],
    project_id: SEED.project_id,
    external_id: 'REQ-QT-003',
    title: '견적 등록',
    body: '파트너는 팝업에서 견적 제목·품목·수량·희망 납기를 입력해 견적을 등록한다. 등록되면 담당자에게 알림 메일이 간다.',
    criteria: [
      { id: 'AC-QT-003-01', text: '필수 입력과 글자수·범위를 검증하고 위반 시 항목별 오류 메시지를 표시한다', kind: 'ui' },
      { id: 'AC-QT-003-02', text: '저장이 성공하면 완료 안내를 표시하고 목록을 갱신한다', kind: 'ui' },
      { id: 'AC-QT-003-03', text: '등록 시 담당자에게 알림 메일을 발송한다 (배치·연계 책임, 화면 범위 아님)', kind: 'non_ui' },
    ],
  },
  {
    id: SEED.requirements['REQ-QT-004'],
    project_id: SEED.project_id,
    external_id: 'REQ-QT-004',
    title: '견적 목록 다운로드',
    body: '파트너는 현재 조회 결과를 표 컬럼 그대로 파일로 내려받는다.',
    criteria: [
      { id: 'AC-QT-004-01', text: '현재 조회 결과를 표 컬럼 그대로 예제 파일로 내려받는다', kind: 'ui' },
      { id: 'AC-QT-004-02', text: '다운로드에는 현재 검색 조건이 그대로 적용된다', kind: 'ui' },
    ],
  },
  {
    id: SEED.requirements['REQ-QT-005'],
    project_id: SEED.project_id,
    external_id: 'REQ-QT-005',
    title: '권한·오류 처리',
    body: '견적 등록 권한이 없는 파트너에게는 등록 버튼을 비활성화하고 안내한다. 조회 오류가 나면 오류 메시지를 표시하고 표를 비운다.',
    criteria: [
      { id: 'AC-QT-005-01', text: '등록 권한이 없는 파트너에게는 등록 버튼을 비활성화하고 권한 안내를 표시한다', kind: 'ui' },
      { id: 'AC-QT-005-02', text: '조회 오류 시 오류 메시지를 표시하고 표 본문을 비운다', kind: 'ui' },
    ],
  },
]

// ---------- 화면·IA ----------

export const SEED_SCREENS: ScreenDocument[] = [
  { id: SEED.screens['SAMPLE-quote-list'], project_id: SEED.project_id, external_id: 'SAMPLE-quote-list', title: '견적 목록', shell: 'partner-page', device: 'desktop', status: 'draft', aliases: [] },
  { id: SEED.screens['SAMPLE-quote-detail'], project_id: SEED.project_id, external_id: 'SAMPLE-quote-detail', title: '견적 상세', shell: 'partner-page', device: 'desktop', status: 'draft', aliases: [] },
  { id: SEED.screens['SAMPLE-quote-create-popup'], project_id: SEED.project_id, external_id: 'SAMPLE-quote-create-popup', title: '견적 등록 팝업', shell: 'partner-popup', device: 'desktop', status: 'draft', aliases: [] },
]

const PORTAL = '파트너 포털'
/**
 * IA 트리 — 포털 → 견적 → 화면 3개 (3단).
 *
 * `requirement_ids` 는 일부만 연결한다: 목록·상세에는 그 화면의 골든 명세가 선언한 REQ 를 붙이고,
 * 등록 팝업과 나머지 요구사항은 일부러 비워 둔다. P1-05 화면이 처음부터 「미매핑 · 갭 제안」 을
 * 보여 주어야 무엇을 하는 화면인지 알 수 있기 때문이다 (기획자 결정, 2026-09-06).
 * 이 배치는 골든 명세를 참고한 **개발용 합성 값**이지 실제 업무 매핑이 아니다.
 *
 * `external_id`(IA-1 …)와 `functions` 는 **한 건도 넣지 않는다.** 발번은 사람이 화면에서
 * 사유와 함께 누르는 명시적 작업이고, 시드가 미리 박아 두면 그 규칙이 무의미해진다 (CLAUDE.md).
 */
export const SEED_IA_NODES: IANode[] = [
  { id: SEED.ia_nodes.portal, project_id: SEED.project_id, parent_id: null, name: PORTAL, order: 0, portal: PORTAL, kind: 'category' },
  { id: SEED.ia_nodes.quote, project_id: SEED.project_id, parent_id: SEED.ia_nodes.portal, name: '견적', order: 0, portal: PORTAL, kind: 'category' },
  {
    id: SEED.ia_nodes.list,
    project_id: SEED.project_id,
    parent_id: SEED.ia_nodes.quote,
    name: '견적 목록',
    order: 0,
    portal: PORTAL,
    kind: 'screen',
    screen_plan_id: SEED.screens['SAMPLE-quote-list'],
    requirement_ids: ['REQ-QT-001', 'REQ-QT-004'],
  },
  {
    id: SEED.ia_nodes.detail,
    project_id: SEED.project_id,
    parent_id: SEED.ia_nodes.quote,
    name: '견적 상세',
    order: 1,
    portal: PORTAL,
    kind: 'screen',
    screen_plan_id: SEED.screens['SAMPLE-quote-detail'],
    requirement_ids: ['REQ-QT-002'],
  },
  { id: SEED.ia_nodes.create, project_id: SEED.project_id, parent_id: SEED.ia_nodes.quote, name: '견적 등록 팝업', order: 2, portal: PORTAL, kind: 'screen', screen_plan_id: SEED.screens['SAMPLE-quote-create-popup'] },
]

// ---------- 레퍼런스 골든 명세 (S2B 학습 규격: 영역 번호 1,2,3 / 요소 a,b,c / 설명 순서는 렌더러 프로파일) ----------

const EV = [{ anchor_id: SEED.anchor_id, note: '합성 요구사항 문서의 데이터 항목' }]

/** 목록 골든 — 검색·정렬·다운로드·팝업 열기·상세 이동, CASE 정상/검색/빈값/오류/권한. */
export function goldenListSpec(screenId: string, baselineId: string, fixturePrefix: string, detailScreenId: string, popupScreenId: string): ScreenSpecInput {
  return {
    schema_version: '1.0',
    screen_id: screenId,
    baseline_id: baselineId,
    purpose: '파트너가 요청한 견적 목록을 검색하고 결과 표에서 상세·등록·다운로드로 이어진다',
    shell: 'partner-page',
    device: 'desktop',
    roles: ['partner'],
    requirements: [
      { id: 'REQ-QT-001', criterion_ids: ['AC-QT-001-01', 'AC-QT-001-02', 'AC-QT-001-03'] },
      { id: 'REQ-QT-004', criterion_ids: ['AC-QT-004-01', 'AC-QT-004-02'] },
      { id: 'REQ-QT-005', criterion_ids: ['AC-QT-005-01', 'AC-QT-005-02'] },
    ],
    sections: [
      {
        id: 'search',
        title: '검색 조건',
        display_no: '1',
        elements: [
          {
            id: 'quote_no',
            type: 'text-input',
            label: '견적번호',
            display_no: 'a',
            placeholder: '견적번호 입력',
            max_length: 20,
            validations: [{ rule: 'max_length', value: 20, message_id: 'msg-quote-no-too-long' }],
            trace: ['AC-QT-001-01'],
            note: '견적번호 부분 일치 검색. 검색 초기화 버튼은 두지 않는다(학습 규격)',
          },
          { id: 'period', type: 'date-range', label: '요청 기간', display_no: 'b', trace: ['AC-QT-001-01'], note: '요청일 기준. 시작일이 종료일보다 늦으면 입력 불가' },
          {
            id: 'status-filter',
            type: 'select',
            label: '견적 상태',
            display_no: 'c',
            options: [
              { value: '', label: '전체' },
              { value: 'QT_REQUESTED', label: '요청' },
              { value: 'QT_REVIEWING', label: '검토중' },
              { value: 'QT_APPROVED', label: '승인' },
              { value: 'QT_REJECTED', label: '반려' },
            ],
            trace: ['AC-QT-001-01'],
            note: '상태값은 합성 값. 정본은 unresolved 참조',
          },
          { id: 'search-button', type: 'button', label: '검색', display_no: 'd', note: '검색 조건으로 더미데이터를 거른다' },
        ],
      },
      {
        id: 'results',
        title: '견적 목록',
        display_no: '2',
        elements: [
          {
            id: 'quote-table',
            type: 'table',
            label: '견적 목록 표',
            display_no: 'a',
            columns: [
              { id: 'quote_no', label: '견적번호', sortable: true, format: 'link' },
              { id: 'requested_at', label: '요청일', sortable: true, format: 'date' },
              { id: 'partner_name', label: '파트너', format: 'text' },
              { id: 'item_count', label: '품목 수', format: 'number' },
              { id: 'amount', label: '견적 금액', sortable: true, format: 'currency' },
              { id: 'status', label: '상태', format: 'status' },
            ],
            default_sort: { column_id: 'requested_at', direction: 'desc' },
            trace: ['AC-QT-001-02'],
            note: '견적번호를 누르면 견적 상세로 이동(open-quote-detail)',
          },
          { id: 'download-button', type: 'button', label: '목록 다운로드', display_no: 'b', trace: ['AC-QT-004-01'] },
          { id: 'create-button', type: 'button', label: '견적 등록', display_no: 'c', trace: ['AC-QT-005-01'], note: '등록 권한이 없으면 비활성화하고 권한 안내 메시지를 표시' },
          { id: 'pager', type: 'pagination', label: '페이지', display_no: 'd', note: '10건 단위' },
        ],
      },
    ],
    actions: [
      { id: 'search-submit', type: 'filter-fixture', label: '검색', trigger: 'search-button', target: 'results', trace: ['AC-QT-001-01'], note: '검색 조건으로 fixture 행을 거른다. 0건이면 empty CASE 로 전이' },
      { id: 'sort-quotes', type: 'sort-fixture', label: '정렬', target: 'quote-table', trace: ['AC-QT-001-02'] },
      { id: 'download-quotes', type: 'download-fixture', label: '목록 다운로드', trigger: 'download-button', target: 'quote-table', trace: ['AC-QT-004-01', 'AC-QT-004-02'], note: '표 컬럼 그대로 현재 검색 결과를 예제 파일로 만든다' },
      { id: 'open-quote-detail', type: 'navigate', label: '견적 상세 이동', target: 'quote-table', target_screen_id: detailScreenId },
      { id: 'open-quote-create', type: 'open-popup', label: '견적 등록 팝업', trigger: 'create-button', target_screen_id: popupScreenId },
      { id: 'show-empty', type: 'set-state', label: '결과 없음 표시', target_state_id: 'empty', trace: ['AC-QT-001-03'] },
      { id: 'show-error', type: 'set-state', label: '조회 오류 표시', target_state_id: 'error', trace: ['AC-QT-005-02'] },
      { id: 'show-permission', type: 'set-state', label: '권한 없음 표시', target_state_id: 'permission', trace: ['AC-QT-005-01'] },
    ],
    states: [
      { id: 'normal', fixture_id: `${fixturePrefix}-normal`, expected: '견적 5건이 요청일 내림차순으로 표시', case_kind: 'normal' },
      { id: 'searched', fixture_id: `${fixturePrefix}-searched`, expected: '견적번호 QT-2026-0003 과 일치하는 1건 표시', case_kind: 'normal' },
      { id: 'empty', fixture_id: `${fixturePrefix}-empty`, expected: '결과 없음 안내 표시, 표 본문은 비움', case_kind: 'empty', message_ids: ['msg-empty'] },
      { id: 'error', fixture_id: `${fixturePrefix}-error`, expected: '조회 오류 메시지 표시, 표는 비움', case_kind: 'error', message_ids: ['msg-error'] },
      { id: 'permission', fixture_id: `${fixturePrefix}-permission`, expected: '목록은 보이지만 견적 등록 버튼이 비활성화되고 권한 안내 표시', case_kind: 'permission', role: 'partner-viewer', message_ids: ['msg-no-permission'] },
    ],
    messages: [
      { id: 'msg-empty', kind: 'info', text: '조회 결과가 없습니다.', when: '검색 결과 0건' },
      { id: 'msg-error', kind: 'error', text: '견적 목록을 불러오지 못했습니다. 잠시 후 다시 시도하세요.', when: '조회 오류' },
      { id: 'msg-no-permission', kind: 'warning', text: '견적 등록 권한이 없습니다. 담당자에게 권한을 요청하세요.', when: '등록 권한 없는 파트너' },
      { id: 'msg-quote-no-too-long', kind: 'warning', text: '견적번호는 20자 이내로 입력하세요.', when: '검색어 글자수 초과' },
    ],
    data_mapping: [
      { element_id: 'quote-table', column_id: 'quote_no', source: 'quotes.quote_no', evidence: EV },
      { element_id: 'quote-table', column_id: 'amount', source: 'quotes.total_amount', evidence: EV },
      { element_id: 'quote-table', column_id: 'status', source: 'quotes.status (합성 상태 모델)', evidence: [{ anchor_id: SEED.anchor_id, note: '상태값 정본은 미확정' }] },
    ],
    locked_elements: [],
    locked_actions: [],
    unresolved: [{ kind: 'assumption', text: '견적 상태값(QT_REQUESTED 등)은 합성 값이다. 실제 상태 모델 정본은 미확정이며 채택 시 StateModel 로 기록한다', related_ids: ['status-filter', 'quote-table'] }],
  }
}

/** 상세 골든 — 기본 정보·품목 표·상태 이력, CASE 정상/오류. */
export function goldenDetailSpec(screenId: string, baselineId: string, fixturePrefix: string, listScreenId: string): ScreenSpecInput {
  return {
    schema_version: '1.0',
    screen_id: screenId,
    baseline_id: baselineId,
    purpose: '견적 한 건의 기본 정보·품목·상태 이력을 확인한다',
    shell: 'partner-page',
    device: 'desktop',
    roles: ['partner'],
    requirements: [
      { id: 'REQ-QT-002', criterion_ids: ['AC-QT-002-01', 'AC-QT-002-02'] },
      { id: 'REQ-QT-005', criterion_ids: ['AC-QT-005-02'] },
    ],
    sections: [
      {
        id: 'summary',
        title: '견적 기본 정보',
        display_no: '1',
        elements: [
          { id: 'quote_no', type: 'text', label: '견적번호', display_no: 'a', trace: ['AC-QT-002-01'] },
          { id: 'partner_name', type: 'text', label: '파트너', display_no: 'b', trace: ['AC-QT-002-01'] },
          { id: 'requested_at', type: 'text', label: '요청일', display_no: 'c', trace: ['AC-QT-002-01'] },
          { id: 'status', type: 'text', label: '상태', display_no: 'd', trace: ['AC-QT-002-01'], note: '상태 배지로 표시' },
          { id: 'total_amount', type: 'text', label: '견적 합계', display_no: 'e', trace: ['AC-QT-002-01'], note: '품목 금액 합계 (더미 계산)' },
        ],
      },
      {
        id: 'items',
        title: '품목',
        display_no: '2',
        elements: [
          {
            id: 'item-table',
            type: 'table',
            label: '품목 표',
            display_no: 'a',
            columns: [
              { id: 'item_name', label: '품목명', format: 'text' },
              { id: 'spec', label: '규격', format: 'text' },
              { id: 'qty', label: '수량', sortable: true, format: 'number' },
              { id: 'unit_price', label: '단가', format: 'currency' },
              { id: 'amount', label: '금액', sortable: true, format: 'currency' },
            ],
            trace: ['AC-QT-002-01'],
          },
        ],
      },
      {
        id: 'history',
        title: '상태 이력',
        display_no: '3',
        elements: [
          {
            id: 'history-table',
            type: 'table',
            label: '상태 이력 표',
            display_no: 'a',
            columns: [
              { id: 'changed_at', label: '변경 시각', sortable: true, format: 'datetime' },
              { id: 'from_status', label: '이전 상태', format: 'status' },
              { id: 'to_status', label: '변경 상태', format: 'status' },
              { id: 'actor', label: '처리자', format: 'text' },
              { id: 'note', label: '비고', format: 'text' },
            ],
            default_sort: { column_id: 'changed_at', direction: 'desc' },
            trace: ['AC-QT-002-02'],
          },
        ],
      },
      {
        id: 'footer',
        title: '하단 버튼',
        display_no: '4',
        elements: [{ id: 'back-button', type: 'button', label: '목록으로', display_no: 'a' }],
      },
    ],
    actions: [
      { id: 'sort-items', type: 'sort-fixture', label: '품목 정렬', target: 'item-table' },
      { id: 'sort-history', type: 'sort-fixture', label: '이력 정렬', target: 'history-table', trace: ['AC-QT-002-02'] },
      { id: 'go-back', type: 'navigate', label: '목록으로', trigger: 'back-button', target_screen_id: listScreenId },
      { id: 'show-error', type: 'set-state', label: '조회 오류 표시', target_state_id: 'error', trace: ['AC-QT-005-02'] },
    ],
    states: [
      { id: 'normal', fixture_id: `${fixturePrefix}-normal`, expected: '기본 정보와 품목 3건, 상태 이력 표시', case_kind: 'normal' },
      { id: 'error', fixture_id: `${fixturePrefix}-error`, expected: '조회 오류 메시지 표시, 표는 비움', case_kind: 'error', message_ids: ['msg-error'] },
    ],
    messages: [{ id: 'msg-error', kind: 'error', text: '견적 상세를 불러오지 못했습니다.', when: '조회 오류' }],
    data_mapping: [
      { element_id: 'item-table', column_id: 'item_name', source: 'quote_items.item_name', evidence: EV },
      { element_id: 'history-table', column_id: 'to_status', source: 'quote_status_history.to_status (합성 상태 모델)', evidence: EV },
    ],
    locked_elements: [],
    locked_actions: [],
    unresolved: [{ kind: 'question', text: '상태 이력 더미데이터는 품목 fixture 와 별도 fixture 로 관리할지 확인이 필요하다', related_ids: ['history-table'] }],
  }
}

/** 등록 팝업 골든 — 필수·글자수·범위 검증, 저장 완료 안내, CASE 정상/저장됨/오류. */
export function goldenCreatePopupSpec(screenId: string, baselineId: string, fixturePrefix: string): ScreenSpecInput {
  return {
    schema_version: '1.0',
    screen_id: screenId,
    baseline_id: baselineId,
    purpose: '팝업에서 견적 제목·품목·수량·희망 납기를 입력해 견적을 등록한다',
    shell: 'partner-popup',
    device: 'desktop',
    roles: ['partner'],
    requirements: [
      { id: 'REQ-QT-003', criterion_ids: ['AC-QT-003-01', 'AC-QT-003-02'] },
      { id: 'REQ-QT-005', criterion_ids: ['AC-QT-005-02'] },
    ],
    sections: [
      {
        id: 'form',
        title: '견적 입력',
        display_no: '1',
        elements: [
          {
            id: 'title',
            type: 'text-input',
            label: '견적 제목',
            required: true,
            display_no: 'a',
            max_length: 100,
            validations: [
              { rule: 'required', message_id: 'msg-title-required' },
              { rule: 'max_length', value: 100, message_id: 'msg-title-too-long' },
            ],
            trace: ['AC-QT-003-01'],
          },
          {
            id: 'item_name',
            type: 'text-input',
            label: '품목명',
            required: true,
            display_no: 'b',
            max_length: 100,
            validations: [{ rule: 'required', message_id: 'msg-item-required' }],
            trace: ['AC-QT-003-01'],
          },
          {
            id: 'qty',
            type: 'number-input',
            label: '수량',
            required: true,
            display_no: 'c',
            validations: [
              { rule: 'required', message_id: 'msg-qty-required' },
              { rule: 'range', value: '1-9999', message_id: 'msg-qty-range' },
            ],
            trace: ['AC-QT-003-01'],
          },
          { id: 'due_date', type: 'date-input', label: '희망 납기', display_no: 'd', note: '오늘 이후 날짜만 선택' },
          {
            id: 'memo',
            type: 'textarea',
            label: '요청 사항',
            display_no: 'e',
            max_length: 500,
            validations: [{ rule: 'max_length', value: 500, message_id: 'msg-memo-too-long' }],
            trace: ['AC-QT-003-01'],
          },
        ],
      },
      {
        id: 'buttons',
        title: '버튼',
        display_no: '2',
        elements: [
          { id: 'save-button', type: 'button', label: '등록', display_no: 'a', trace: ['AC-QT-003-02'] },
          { id: 'cancel-button', type: 'button', label: '취소', display_no: 'b' },
        ],
      },
    ],
    actions: [
      { id: 'save-quote', type: 'set-state', label: '등록', trigger: 'save-button', target_state_id: 'saved', trace: ['AC-QT-003-02'], note: '검증을 통과하면 저장 완료 메시지를 보이고 부모 목록 갱신을 안내한다 (더미 동작, 실제 저장 없음)' },
      { id: 'close', type: 'close-popup', label: '취소', trigger: 'cancel-button' },
      { id: 'show-error', type: 'set-state', label: '저장 오류 표시', target_state_id: 'error', trace: ['AC-QT-005-02'] },
    ],
    states: [
      { id: 'normal', fixture_id: `${fixturePrefix}-normal`, expected: '빈 입력 폼과 필수 표시', case_kind: 'normal' },
      { id: 'saved', fixture_id: `${fixturePrefix}-normal`, expected: '저장 완료 메시지 표시 후 팝업 닫힘 안내', case_kind: 'normal', message_ids: ['msg-saved'] },
      { id: 'error', fixture_id: `${fixturePrefix}-error`, expected: '저장 오류 메시지 표시, 입력값 유지', case_kind: 'error', message_ids: ['msg-error'] },
    ],
    messages: [
      { id: 'msg-title-required', kind: 'error', text: '견적 제목을 입력하세요.', when: '제목 미입력' },
      { id: 'msg-title-too-long', kind: 'warning', text: '견적 제목은 100자 이내로 입력하세요.', when: '제목 글자수 초과' },
      { id: 'msg-item-required', kind: 'error', text: '품목명을 입력하세요.', when: '품목명 미입력' },
      { id: 'msg-qty-required', kind: 'error', text: '수량을 입력하세요.', when: '수량 미입력' },
      { id: 'msg-qty-range', kind: 'warning', text: '수량은 1~9999 범위로 입력하세요.', when: '수량 범위 초과' },
      { id: 'msg-memo-too-long', kind: 'warning', text: '요청 사항은 500자 이내로 입력하세요.', when: '요청 사항 글자수 초과' },
      { id: 'msg-saved', kind: 'success', text: '견적이 등록되었습니다.', when: '저장 성공' },
      { id: 'msg-error', kind: 'error', text: '견적을 저장하지 못했습니다. 입력값을 확인하고 다시 시도하세요.', when: '저장 오류' },
    ],
    data_mapping: [{ element_id: 'title', source: 'quotes.title', evidence: EV }],
    locked_elements: [],
    locked_actions: [],
    unresolved: [{ kind: 'question', text: '등록 알림 메일(AC-QT-003-03)은 비UI 책임이라 화면에 포함하지 않았다. 발송 실패를 화면에 안내해야 하는지 확인이 필요하다', related_ids: ['save-button'] }],
  }
}

export const SEED_REFERENCES: ReferenceDocument[] = [
  {
    id: SEED.references['REF-quote-list'],
    project_id: SEED.project_id,
    title: '목록 골든 — 검색·정렬·다운로드·팝업',
    category: 'list',
    description: '검색 조건 영역과 결과 표. 검색=더미데이터 필터, 정렬=기본 정렬, 다운로드=명세 컬럼 CSV, 등록 팝업 열기, 정상/검색/빈값/오류/권한 CASE.',
    spec: ScreenSpec.parse(goldenListSpec('REF-quote-list', SEED.baseline_id, 'REF-quote-list', 'REF-quote-detail', 'REF-quote-create-popup')),
    tags: ['list', 'search', 'table', 'download', 'popup'],
    source: 'S2B 학습 규격 적용 합성 예시',
  },
  {
    id: SEED.references['REF-quote-detail'],
    project_id: SEED.project_id,
    title: '상세 골든 — 기본 정보·품목·이력',
    category: 'detail',
    description: '기본 정보 영역, 품목 표, 상태 이력 표, 하단 버튼. 정상/오류 CASE.',
    spec: ScreenSpec.parse(goldenDetailSpec('REF-quote-detail', SEED.baseline_id, 'REF-quote-detail', 'REF-quote-list')),
    tags: ['detail', 'table', 'history'],
    source: 'S2B 학습 규격 적용 합성 예시',
  },
  {
    id: SEED.references['REF-quote-create-popup'],
    project_id: SEED.project_id,
    title: '팝업 골든 — 입력 폼과 검증',
    category: 'popup',
    description: '팝업 shell. 필수·글자수·범위 검증과 항목별 메시지, 저장 완료 안내, 오류 CASE.',
    spec: ScreenSpec.parse(goldenCreatePopupSpec('REF-quote-create-popup', SEED.baseline_id, 'REF-quote-create-popup')),
    tags: ['popup', 'form', 'validation'],
    source: 'S2B 학습 규격 적용 합성 예시',
  },
]

// ---------- 더미데이터 (합성; 실제 거래·개인정보 아님) ----------

const QUOTE_ROWS: Record<string, unknown>[] = [
  { quote_no: 'QT-2026-0005', requested_at: '2026-09-03', partner_name: '예시파트너A', item_count: 3, amount: 1250000, status: 'QT_REQUESTED' },
  { quote_no: 'QT-2026-0004', requested_at: '2026-09-02', partner_name: '예시파트너B', item_count: 1, amount: 380000, status: 'QT_REVIEWING' },
  { quote_no: 'QT-2026-0003', requested_at: '2026-09-01', partner_name: '예시파트너A', item_count: 5, amount: 2140000, status: 'QT_APPROVED' },
  { quote_no: 'QT-2026-0002', requested_at: '2026-08-29', partner_name: '예시파트너C', item_count: 2, amount: 99000, status: 'QT_REJECTED' },
  { quote_no: 'QT-2026-0001', requested_at: '2026-08-27', partner_name: '예시파트너B', item_count: 4, amount: 760000, status: 'QT_APPROVED' },
]
const QUOTE_ITEM_ROWS: Record<string, unknown>[] = [
  { item_name: '예시 품목 A', spec: '규격 A-1', qty: 10, unit_price: 12000, amount: 120000 },
  { item_name: '예시 품목 B', spec: '규격 B-2', qty: 5, unit_price: 48000, amount: 240000 },
  { item_name: '예시 품목 C', spec: '규격 C-3', qty: 2, unit_price: 990000, amount: 1980000 },
]

/** 화면 종류별 fixture 묶음. prefix 는 레퍼런스(REF-…) 와 화면(SAMPLE-…) 둘 다에 쓴다. */
function dummyFor(prefix: string, screenExternalId: string, kind: 'list' | 'detail' | 'popup'): DummyDataDocument[] {
  const doc = (suffix: string, case_kind: DummyDataDocument['case_kind'], rows: Record<string, unknown>[], note: string): DummyDataDocument => ({
    id: `${prefix}-${suffix}`,
    project_id: SEED.project_id,
    screen_external_id: screenExternalId,
    case_kind,
    rows,
    note,
  })
  switch (kind) {
    case 'list':
      return [
        doc('normal', 'normal', QUOTE_ROWS, '정상 5행 (요청일 내림차순)'),
        doc('searched', 'normal', QUOTE_ROWS.filter((r) => r.quote_no === 'QT-2026-0003'), '견적번호 QT-2026-0003 검색 결과 1행'),
        doc('empty', 'empty', [], '검색 결과 0건'),
        doc('error', 'error', [], '조회 오류 (표 비움, 오류 메시지)'),
        doc('permission', 'permission', QUOTE_ROWS, '등록 권한 없는 파트너 — 목록은 같고 등록 버튼 비활성'),
      ]
    case 'detail':
      return [doc('normal', 'normal', QUOTE_ITEM_ROWS, '품목 3행 (기본 정보·이력은 렌더러 표시값)'), doc('error', 'error', [], '조회 오류')]
    case 'popup':
      return [doc('normal', 'normal', [], '빈 입력 폼'), doc('error', 'error', [], '저장 오류')]
  }
}

export const SEED_DUMMY_DATA: DummyDataDocument[] = [
  ...dummyFor('REF-quote-list', 'REF-quote-list', 'list'),
  ...dummyFor('REF-quote-detail', 'REF-quote-detail', 'detail'),
  ...dummyFor('REF-quote-create-popup', 'REF-quote-create-popup', 'popup'),
  ...dummyFor('SAMPLE-quote-list', 'SAMPLE-quote-list', 'list'),
  ...dummyFor('SAMPLE-quote-detail', 'SAMPLE-quote-detail', 'detail'),
  ...dummyFor('SAMPLE-quote-create-popup', 'SAMPLE-quote-create-popup', 'popup'),
]

// ---------- 프롬프트 템플릿 v1 (설계 §8 7구역 + 내부 계약 문장). 실제 조립은 @con-ai/prompt-templates 가 한다 ----------

export const PROMPT_TEMPLATE_V1_BODY = `# 화면명세 생성 프롬프트 템플릿 v1 (설계 §8 7구역)

[1 대상] 프로젝트·포털·화면 ID·화면명·shell·PC/모바일·사용자 역할.
[2 작업] 신규 생성 / 단건 수정 / 참조 복제, 목적, 변경 범위.
[3 기준] 기준 버전(baseline_id), 승인된 요구사항과 수용조건(외부 ID·본문·UI/비UI 구분).
[4 참고] 골든 레퍼런스 명세(ScreenSpec JSON), shell 규격 요약, 허용 디자인 토큰.
[5 CASE] 정상·빈값·오류·권한·처리중 중 요청한 CASE 와 적용 조건. 각 CASE 는 states[] 에 fixture_id 와 기대 결과로 적는다.
[6 유지 조건] 잠긴 요소·동작, 데이터 계약, 유지할 동작. 수정 작업에서는 기준 명세와 반영할 코멘트를 함께 준다.
[7 산출] screen_spec(ScreenSpec JSON), trace_proposals(후보, 승인 아님), unresolved(질문·가정·충돌·빠진 근거), change_summary.

내부 계약 (모델 출력이 지켜야 하는 것 — 서버가 다시 검사한다):
- HTML 을 출력하지 않는다. 산출은 위 넷뿐이다.
- screen_id 와 baseline_id 는 지정한 값을 그대로 쓴다.
- 요소·동작의 trace 는 requirements[].criterion_ids 에 있는 수용조건 ID 만 가리킨다. 비UI 수용조건은 화면에 매핑하지 않고 unresolved 에 남긴다.
- actions[].target 은 정의된 영역/요소 id, target_state_id 는 정의된 CASE id, message_id 는 정의된 메시지 id 여야 한다.
- 근거가 없는 데이터 매핑은 data_mapping 에 넣지 않고 unresolved(missing_evidence) 로 보낸다.
- 잠긴 요소·동작은 바꾸지 않는다. 바꿨다면 change_summary.locked_violations 에 적는다.
- 영역 번호는 1,2,3, 요소 번호는 영역마다 a,b,c 로 반복한다. 요소 id 는 화면명세 안에서 유일하다.
- 실제 거래·개인정보·외부 API 는 연결하지 않는다. 동작은 검색(더미 필터)·정렬·팝업·다운로드(예제 파일)·화면 이동·CASE 전이만 쓴다.
`

export const SEED_PROMPT_TEMPLATE: PromptTemplateDocument = {
  id: SEED.prompt_template_id,
  name: '화면명세 생성 (7구역)',
  version: 'v1',
  body_hash: sha256(PROMPT_TEMPLATE_V1_BODY),
  body: PROMPT_TEMPLATE_V1_BODY,
  created_at: '2026-09-05T09:00:00+09:00',
}

// ---------- 시드 실행 ----------

export interface SeedResult {
  seeded: boolean
  project_id: string
}

/** DB 가 비어 있을 때(project 문서 0건)만 시드한다. 이미 있으면 아무것도 하지 않는다. */
export function seedIfEmpty(store: Store, now: () => string = () => new Date().toISOString()): SeedResult {
  if (store.list('project').length > 0) return { seeded: false, project_id: SEED.project_id }
  const project: ProjectDocument = {
    id: SEED.project_id,
    name: SEED_PROJECT_NAME,
    slug: SEED.project_slug,
    org: '와일리 컨버전스 본부',
    description: '파트너가 견적을 요청·조회·등록하는 가상 포털. 세로 조각 검증용 샘플이며 실제 고객 데이터를 담지 않는다.',
    profile_id: 's2b-learned-v1',
    baseline_id: SEED.baseline_id,
    created_at: now(),
  }
  store.put('project', project.id, project, 0)
  for (const r of SEED_REQUIREMENTS) store.put('requirement', r.id, r, 0)
  for (const n of SEED_IA_NODES) store.put('ia_node', n.id, n, 0)
  for (const s of SEED_SCREENS) store.put('screen', s.id, s, 0)
  for (const ref of SEED_REFERENCES) store.put('reference', ref.id, ref, 0)
  for (const d of SEED_DUMMY_DATA) store.put('dummy_data', d.id, d, 0)
  store.put('prompt_template', SEED_PROMPT_TEMPLATE.id, SEED_PROMPT_TEMPLATE, 0)
  return { seeded: true, project_id: project.id }
}
