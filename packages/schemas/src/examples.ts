/**
 * 화면명세 예시 — 합성 데이터. 실제 S2B 요구사항·화면을 담지 않는다 (공개 저장소).
 *
 * - DESIGN_EXAMPLE_ORDER_LIST: 설계 §9 의 예시 JSON 을 그대로 옮긴 것. "형태 설명용 발췌"라 actions[0].target=`results` 가 정의되어 있지 않다.
 * - EXAMPLE_ORDER_LIST: 발췌를 보완한 최소 완성본 (results 영역 추가).
 * - EXAMPLE_ORDER_LIST_EXTENDED: 검색·빈 결과·오류 CASE, 메시지, 검증, 데이터 매핑, 팝업·다운로드 동작, 잠긴 요소를 포함한 확장본
 *   (개발프롬프트 3항: 목록 화면 하나를 검색·빈 결과·오류 CASE 로 렌더링).
 */
import type { ScreenSpecInput } from './screen-spec.js'

/** 설계 §9 예시 원문 (EXAMPLE-order-list). 수정하지 않는다. */
export const DESIGN_EXAMPLE_ORDER_LIST = {
  schema_version: '1.0',
  screen_id: 'EXAMPLE-order-list',
  baseline_id: 'example-baseline-1',
  purpose: '주문 목록 조회 — 가상 예시',
  shell: 'buyer-page',
  device: 'desktop',
  requirements: [{ id: 'EXAMPLE-REQ-001', criterion_ids: ['EXAMPLE-AC-01'] }],
  sections: [
    {
      id: 'search',
      title: '검색',
      elements: [{ id: 'query', type: 'text-input', label: '검색어', required: false }],
    },
  ],
  actions: [{ id: 'search-submit', type: 'filter-fixture', target: 'results' }],
  states: [{ id: 'empty', fixture_id: 'orders-empty', expected: '조회 결과 없음 표시' }],
  unresolved: [],
} as const satisfies ScreenSpecInput

/** 발췌를 보완한 최소 완성본 — `results` 영역(표)을 정의해 target 참조가 풀린다. */
export const EXAMPLE_ORDER_LIST: ScreenSpecInput = {
  ...DESIGN_EXAMPLE_ORDER_LIST,
  sections: [
    ...DESIGN_EXAMPLE_ORDER_LIST.sections,
    {
      id: 'results',
      title: '주문 목록',
      elements: [
        {
          id: 'order-table',
          type: 'table',
          label: '주문 목록 표',
          columns: [
            { id: 'order_no', label: '주문번호', sortable: true },
            { id: 'ordered_at', label: '주문일', sortable: true, format: 'date' },
            { id: 'status', label: '상태', format: 'status' },
          ],
          default_sort: { column_id: 'ordered_at', direction: 'desc' },
          trace: ['EXAMPLE-AC-01'],
        },
      ],
    },
  ],
  states: [{ id: 'normal', fixture_id: 'orders-normal', expected: '주문 3건 표시', case_kind: 'normal' }, ...DESIGN_EXAMPLE_ORDER_LIST.states],
}

/** 합성 anchor UUID (fixtures 의 SourceAnchor 와 맞출 값). */
export const EXAMPLE_ANCHOR_ID = '11111111-1111-4111-8111-111111111111'

/** 검색·빈 결과·오류 CASE 를 갖춘 확장본. */
export const EXAMPLE_ORDER_LIST_EXTENDED: ScreenSpecInput = {
  schema_version: '1.0',
  screen_id: 'EXAMPLE-order-list',
  baseline_id: 'example-baseline-1',
  purpose: '주문 목록 조회 — 가상 예시(확장)',
  shell: 'buyer-page',
  device: 'desktop',
  roles: ['buyer'],
  requirements: [
    { id: 'EXAMPLE-REQ-001', criterion_ids: ['EXAMPLE-AC-01', 'EXAMPLE-AC-02'] },
    { id: 'EXAMPLE-REQ-002', criterion_ids: ['EXAMPLE-AC-03'] },
  ],
  sections: [
    {
      id: 'search',
      title: '검색',
      display_no: '1',
      elements: [
        {
          id: 'query',
          type: 'text-input',
          label: '검색어',
          required: false,
          display_no: 'a',
          max_length: 50,
          validations: [{ rule: 'max_length', value: 50, message_id: 'msg-query-too-long' }],
          trace: ['EXAMPLE-AC-01'],
        },
        { id: 'period', type: 'date-range', label: '주문 기간', display_no: 'b', trace: ['EXAMPLE-AC-01'] },
        { id: 'search-button', type: 'button', label: '검색', display_no: 'c' },
      ],
    },
    {
      id: 'results',
      title: '주문 목록',
      display_no: '2',
      elements: [
        {
          id: 'order-table',
          type: 'table',
          label: '주문 목록 표',
          display_no: 'a',
          columns: [
            { id: 'order_no', label: '주문번호', sortable: true },
            { id: 'ordered_at', label: '주문일', sortable: true, format: 'date' },
            { id: 'status', label: '상태', format: 'status' },
          ],
          default_sort: { column_id: 'ordered_at', direction: 'desc' },
          trace: ['EXAMPLE-AC-02'],
        },
        { id: 'download-button', type: 'button', label: '엑셀 다운로드', display_no: 'b' },
        { id: 'pager', type: 'pagination', label: '페이지', display_no: 'c' },
      ],
    },
  ],
  actions: [
    { id: 'search-submit', type: 'filter-fixture', trigger: 'search-button', target: 'results', trace: ['EXAMPLE-AC-01'] },
    { id: 'sort-orders', type: 'sort-fixture', target: 'order-table' },
    { id: 'download-orders', type: 'download-fixture', trigger: 'download-button', target: 'order-table', trace: ['EXAMPLE-AC-03'] },
    { id: 'open-order-detail', type: 'open-popup', target: 'order-table', target_screen_id: 'EXAMPLE-order-detail-popup' },
    { id: 'show-error', type: 'set-state', target_state_id: 'error' },
  ],
  states: [
    { id: 'normal', fixture_id: 'orders-normal', expected: '주문 3건이 주문일 내림차순으로 표시', case_kind: 'normal' },
    { id: 'searched', fixture_id: 'orders-searched', expected: '검색어와 일치하는 주문 1건 표시', case_kind: 'normal' },
    { id: 'empty', fixture_id: 'orders-empty', expected: '조회 결과 없음 표시', case_kind: 'empty', message_ids: ['msg-empty'] },
    { id: 'error', fixture_id: 'orders-error', expected: '조회 오류 메시지 표시, 표는 비움', case_kind: 'error', message_ids: ['msg-error'] },
  ],
  messages: [
    { id: 'msg-empty', kind: 'info', text: '조회 결과가 없습니다.', when: '검색 결과 0건' },
    { id: 'msg-error', kind: 'error', text: '주문 목록을 불러오지 못했습니다.', when: '조회 오류' },
    { id: 'msg-query-too-long', kind: 'warning', text: '검색어는 50자 이내로 입력하세요.' },
  ],
  data_mapping: [
    { element_id: 'order-table', column_id: 'order_no', source: 'orders.order_no', evidence: [{ anchor_id: EXAMPLE_ANCHOR_ID }] },
    { element_id: 'order-table', column_id: 'status', source: 'orders.status (상태 모델: 예시)', evidence: [{ anchor_id: EXAMPLE_ANCHOR_ID, note: '상태값 정본은 미확정' }] },
  ],
  locked_elements: ['order-table'],
  locked_actions: ['download-orders'],
  unresolved: [{ kind: 'question', text: '주문 상태값의 정본(더미 규칙 vs 용어집)을 확인해야 한다', related_ids: ['order-table'] }],
}
