/**
 * ScreenSpec — 화면명세. UI 와 우측 설명의 공통 원본. 초안(변경 예정).
 *
 * 출처: 설계 §9 (예시 JSON EXAMPLE-order-list; 구현 스키마에 표·필드·검증·상태 전이·접근성·이벤트·메시지·출처·요소별 추적 관계 포함;
 *       `target` 은 실제 정의된 컴포넌트로 참조 검증; 렌더러 허용 동작: 검색=더미데이터 필터, 정렬=명세 기본 정렬,
 *       팝업=지정 전이, 다운로드=명세 컬럼의 예제 파일; 실제 거래·개인정보·외부 API 미연결;
 *       내부 요소 ID 와 표시 번호 구분, 영역마다 반복되는 a 는 전역 중복 오류가 아님),
 *       설계 §8 (CASE: 정상·빈값·오류·권한·처리중; 빠진 근거는 unresolved; 산출: 질문·가정·충돌),
 *       설계 §12 (잠긴 요소·동작), 설계 §10 V1 (스키마·참조·역할·상태·수용조건 연결 검사).
 *
 * 두 층으로 나눈다.
 * - ScreenSpecShape: 구조(형태)만 검사. 설계 §9 의 예시 JSON 이 그대로 파싱된다.
 * - ScreenSpec: ScreenSpecShape + 참조 무결성(superRefine). 설계 §9 예시는 "형태 설명용 발췌"라서
 *   actions[0].target=`results` 가 정의되어 있지 않으므로 여기서는 실패한다 (examples.ts 의 보완본은 통과).
 *
 * 아직 반영하지 않은 것(README "남은 제한"): 접근성 속성, 이벤트 모델, 상태 전이 표(CASE 간 전이), 처리 흐름 서술.
 */
import { z } from 'zod'
import { AnchorRef, ExternalId, LocalId, NonEmptyText } from './common.js'
import { DeviceProfile, RoleId, ShellId } from './screen.js'

/** 화면명세 스키마 버전. 설계 §9 예시의 "1.0". */
export const SCREEN_SPEC_SCHEMA_VERSION = '1.0' as const

/** 허용 컴포넌트 (설계 §9: 렌더러는 승인된 컴포넌트 목록만 사용). 초안 목록. */
export const ElementType = z
  .enum([
    'text-input',
    'number-input',
    'textarea',
    'select',
    'radio',
    'checkbox',
    'date-input',
    'date-range',
    'button',
    'table',
    'text',
    'link',
    'pagination',
    // 내용 표현 3종 — 목록·상세·폼 밖의 «메인/홈» 화면을 만들 수 있게 넓힌 어휘.
    // 입력 컨트롤이 아니라 «무엇을 보여주는 자리인가» 를 말한다.
    'hero',
    'stat-strip',
    'card-grid',
  ])
  .describe('허용 컴포넌트 (설계 §9)')

/**
 * 제한된 동작 (설계 §9): filter-fixture=검색(더미데이터 필터), sort-fixture=정렬(명세 기본 정렬),
 * open-popup/close-popup=팝업(지정 전이), download-fixture=다운로드(명세 컬럼의 예제 파일),
 * navigate=화면 이동(뒤로가기 등), set-state=CASE 전이. 실제 거래·개인정보 조회·외부 API 동작은 없다.
 */
export const ActionType = z
  .enum(['filter-fixture', 'sort-fixture', 'open-popup', 'close-popup', 'download-fixture', 'navigate', 'set-state'])
  .describe('제한된 동작 (설계 §9)')

/** CASE 종류 (설계 §8: 정상·빈값·오류·권한·처리중). */
export const CaseKind = z.enum(['normal', 'empty', 'error', 'permission', 'processing']).describe('CASE 종류 (설계 §8)')

/** 메시지 종류 (설계 §9 설명 순서의 "메시지 표"). */
export const MessageKind = z.enum(['info', 'success', 'warning', 'error', 'confirm']).describe('메시지 종류 (설계 §9)')

/** 필드 검증 규칙 (설계 §9 "검증"; 파일럿 과제의 글자수 제한 포함 §14). */
export const ValidationRule = z.enum(['required', 'min_length', 'max_length', 'pattern', 'range', 'date_range']).describe('필드 검증 규칙 (설계 §9)')

export const SortDirection = z.enum(['asc', 'desc'])

/** 표 컬럼 표시 형식 (초안). */
export const ColumnFormat = z.enum(['text', 'number', 'date', 'datetime', 'currency', 'status', 'link'])

/** 미확정 항목 종류 (설계 §8 산출: 질문·가정·충돌; 빠진 근거). */
export const UnresolvedKind = z.enum(['question', 'assumption', 'conflict', 'missing_evidence']).describe('미확정 종류 (설계 §8)')

/** 표 컬럼 (설계 §9 "표"; 다운로드 예제 파일과 기본 정렬의 기준). */
export const TableColumn = z.strictObject({
  id: LocalId,
  label: NonEmptyText.describe('컬럼 표시명'),
  sortable: z.boolean().optional().describe('정렬 가능 여부'),
  downloadable: z.boolean().optional().describe('다운로드 예제 파일 포함 여부 (기본 포함)'),
  format: ColumnFormat.optional(),
})

export const DefaultSort = z.strictObject({
  column_id: LocalId.describe('기본 정렬 컬럼 (표의 columns 안의 id)'),
  direction: SortDirection,
})

export const FieldValidation = z.strictObject({
  rule: ValidationRule,
  value: z.union([z.string(), z.number()]).optional().describe('규칙 값 (예: max_length=100, pattern 정규식)'),
  message_id: LocalId.optional().describe('위반 시 메시지 (messages[].id)'),
})

export const ElementOption = z.strictObject({
  value: z.string(),
  label: NonEmptyText,
})

/**
 * 히어로 — 화면 머리의 큰 카피 자리 (type='hero').
 * 검색창을 넣으려면 `search_placeholder` 를 채운다. 여기 있는 이유: 「타입 ↔ 내용 키」를 1:1 로 묶어 두기 위해서다
 * (공용 `placeholder` 를 빌려 쓰면 카드 그리드에 붙여도 아무도 불평하지 않는 예외가 생긴다).
 * 이미지는 두지 않는다. 키비주얼 자리는 렌더러가 CSS 도형으로 그린다 (V2.no_external_refs: 외부 이미지 금지).
 */
export const HeroContent = z
  .strictObject({
    eyebrow: NonEmptyText.optional().describe('머리 위 작은 라벨 (예: 브랜드명·영문 표기)'),
    headline: NonEmptyText.describe('큰 카피. 줄바꿈은 `\n` 으로 나눈다. 2줄 이내를 권장한다'),
    subcopy: NonEmptyText.optional().describe('카피 아래 보조 문장 (2문장 이내)'),
    search_placeholder: NonEmptyText.optional().describe('통합검색 입력의 안내 문구. 채우면 히어로 안에 검색 입력과 버튼이 그려진다. 없으면 검색 없는 히어로다'),
    chips: z.array(NonEmptyText).optional().describe('검색창 아래 인기어 칩. **4개 이하**. 클릭 동작은 없다 (표시용)'),
    visual_note: NonEmptyText.optional().describe('키비주얼 자리에 «무엇이 들어가는지» 설명 (예: "대표 이미지·브랜드 필름"). 자리표시 문구는 렌더러가 따로 붙이므로 여기 적지 않는다. 이미지 주소는 넣지 않는다'),
  })
  .describe('히어로 내용 (type=hero)')

/** KPI 인포스트립의 숫자 한 칸 (type='stat-strip'). 값은 명세에 적힌 **예시 값**이며 실제 시세·실적이 아니다. */
export const StatItem = z
  .strictObject({
    label: NonEmptyText.describe('항목명 (예: 시가총액)'),
    value: NonEmptyText.describe('표시값 (예: 5조 5,394억). 예시 값이며 실제 데이터가 아니다'),
    delta: NonEmptyText.optional().describe('증감 표기 (예: +150 (+0.85%)). 앞의 +/▲ 는 상승, -/▼ 는 하락 색으로 그린다'),
    caption: NonEmptyText.optional().describe('아래 작은 설명 (예: 20분 지연 시세)'),
  })
  .describe('KPI 한 칸 (type=stat-strip)')

/** 카드 그리드의 카드 하나 (type='card-grid'). */
export const CardItem = z
  .strictObject({
    title: NonEmptyText.describe('카드 제목'),
    desc: NonEmptyText.optional().describe('카드 본문 한 줄'),
    badge: NonEmptyText.optional().describe('카드 위 분류 배지 (예: 보도자료)'),
    meta: NonEmptyText.optional().describe('카드 아래 보조 정보 (예: 날짜·용량)'),
  })
  .describe('카드 하나 (type=card-grid)')

const OPTION_TYPES = new Set<string>(['select', 'radio', 'checkbox'])

/** 내용 표현 3종 — 입력이 아니라 «보여주는» 컴포넌트. */
const CONTENT_TYPES = new Set<string>(['hero', 'stat-strip', 'card-grid'])

/**
 * 요소의 필드 (superRefine 전). wire 스키마와 **키가 같은지** 보는 검사가 이 모양을 본다
 * (ScreenSpecShape / ScreenSpec 과 같은 두 층 구조).
 */
export const ElementShape = z
  .strictObject({
    id: LocalId.describe('요소 로컬 ID (화면명세 안에서 유일; 표시 번호와 구분)'),
    type: ElementType,
    label: NonEmptyText.describe('레이블'),
    required: z.boolean().optional().describe('필수 입력 여부'),
    display_no: z.string().optional().describe('설명에 표시할 번호(a/b/c 등). 영역마다 반복돼도 오류가 아님 (설계 §9)'),
    placeholder: z.string().optional(),
    options: z.array(ElementOption).optional().describe('선택지 (select/radio/checkbox)'),
    columns: z.array(TableColumn).optional().describe('표 컬럼 (type=table)'),
    hero: HeroContent.optional().describe('히어로 내용 (type=hero 전용, 필수)'),
    stats: z.array(StatItem).optional().describe('KPI 항목 (type=stat-strip 전용, 1개 이상 6개 이하)'),
    cards: z.array(CardItem).optional().describe('카드 (type=card-grid 전용, 1개 이상 12개 이하)'),
    default_sort: DefaultSort.optional().describe('기본 정렬 (type=table; 설계 §9 정렬=명세 기본 정렬)'),
    max_length: z.int().min(1).optional().describe('글자수 제한'),
    validations: z.array(FieldValidation).optional().describe('검증 규칙 (설계 §9)'),
    trace: z.array(ExternalId).optional().describe('요소별 추적 관계 — 수용조건 외부 ID 목록 (설계 §9). requirements[].criterion_ids 안의 값이어야 함'),
    locked: z.boolean().optional().describe('잠긴 요소 표시 (설계 §12). 목록은 locked_elements 가 정본'),
    note: z.string().optional().describe('영역·필드 설명 (우측 설명용)'),
  })
  .describe('요소 필드 (설계 §9)')

/** 요소 — 영역 안의 컴포넌트 하나 (설계 §9 "필드"). 구조 + 타입별 내용 규칙. */
export const Element = ElementShape
  .superRefine((el, ctx) => {
    if (el.type === 'table') {
      if (!el.columns || el.columns.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['columns'], message: 'table 요소에는 columns 가 최소 1개 필요하다 (설계 §9 표)' })
      } else {
        const seen = new Set<string>()
        el.columns.forEach((c, i) => {
          if (seen.has(c.id)) ctx.addIssue({ code: 'custom', path: ['columns', i, 'id'], message: `컬럼 id 중복: ${c.id}` })
          seen.add(c.id)
        })
        if (el.default_sort && !seen.has(el.default_sort.column_id)) {
          ctx.addIssue({ code: 'custom', path: ['default_sort', 'column_id'], message: `기본 정렬 컬럼이 columns 에 없다: ${el.default_sort.column_id}` })
        }
      }
    } else {
      if (el.columns !== undefined) ctx.addIssue({ code: 'custom', path: ['columns'], message: `columns 는 table 요소에만 쓴다 (type=${el.type})` })
      if (el.default_sort !== undefined) ctx.addIssue({ code: 'custom', path: ['default_sort'], message: `default_sort 는 table 요소에만 쓴다 (type=${el.type})` })
    }
    if (OPTION_TYPES.has(el.type)) {
      if (el.type !== 'checkbox' && (!el.options || el.options.length === 0)) {
        ctx.addIssue({ code: 'custom', path: ['options'], message: `${el.type} 요소에는 options 가 최소 1개 필요하다` })
      }
    } else if (el.options !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: `options 는 select/radio/checkbox 에만 쓴다 (type=${el.type})` })
    }
    // 내용 표현 3종 — 타입과 내용 키를 1:1 로 묶는다. 내용 없는 hero/stat-strip/card-grid 는 빈 상자로 렌더되므로 여기서 막는다.
    if (el.type === 'hero') {
      if (el.hero === undefined) ctx.addIssue({ code: 'custom', path: ['hero'], message: 'hero 요소에는 hero 내용(headline)이 필요하다' })
    } else if (el.hero !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['hero'], message: `hero 는 hero 요소에만 쓴다 (type=${el.type})` })
    }
    if (el.type === 'stat-strip') {
      if (!el.stats || el.stats.length === 0) ctx.addIssue({ code: 'custom', path: ['stats'], message: 'stat-strip 요소에는 stats 가 최소 1개 필요하다' })
    } else if (el.stats !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['stats'], message: `stats 는 stat-strip 요소에만 쓴다 (type=${el.type})` })
    }
    if (el.type === 'card-grid') {
      if (!el.cards || el.cards.length === 0) ctx.addIssue({ code: 'custom', path: ['cards'], message: 'card-grid 요소에는 cards 가 최소 1개 필요하다' })
    } else if (el.cards !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['cards'], message: `cards 는 card-grid 요소에만 쓴다 (type=${el.type})` })
    }
    // 내용 표현 3종은 입력 컨트롤이 아니다. 히어로의 검색 안내 문구는 hero.search_placeholder 로만 적는다.
    if (CONTENT_TYPES.has(el.type) && el.placeholder !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['placeholder'], message: `placeholder 는 입력 컴포넌트에만 쓴다 (type=${el.type}). 히어로의 검색 안내 문구는 hero.search_placeholder 다` })
    }
  })
  .describe('요소 (설계 §9)')

/** 영역 — 설명의 "영역·필드 설명" 단위. */
export const Section = z
  .strictObject({
    id: LocalId.describe('영역 로컬 ID'),
    title: NonEmptyText.describe('영역 제목'),
    display_no: z.string().optional().describe('설명에 표시할 영역 번호'),
    elements: z.array(Element).min(1, '영역에는 최소 1개 요소가 필요하다'),
    note: z.string().optional(),
  })
  .describe('영역 (설계 §9)')

const TARGET_REQUIRED_TYPES = new Set<string>(['filter-fixture', 'sort-fixture', 'download-fixture'])
const SCREEN_TARGET_TYPES = new Set<string>(['open-popup', 'navigate'])

/** 동작 — 제한된 동작 목록 안의 하나. */
export const Action = z
  .strictObject({
    id: LocalId,
    type: ActionType,
    label: z.string().optional().describe('설명용 동작명'),
    trigger: LocalId.optional().describe('동작을 일으키는 요소 id (예: 버튼)'),
    target: LocalId.optional().describe('대상 컴포넌트 — 정의된 영역/요소 id (설계 §9: 실제 정의된 컴포넌트로 참조 검증)'),
    target_screen_id: ExternalId.optional().describe('이동/팝업 대상 화면의 외부 ID (open-popup, navigate)'),
    target_state_id: LocalId.optional().describe('전이할 CASE id (set-state)'),
    trace: z.array(ExternalId).optional().describe('동작별 추적 관계 — 수용조건 외부 ID'),
    note: z.string().optional().describe('처리 흐름 설명'),
  })
  .superRefine((a, ctx) => {
    if (TARGET_REQUIRED_TYPES.has(a.type) && a.target === undefined) {
      ctx.addIssue({ code: 'custom', path: ['target'], message: `${a.type} 동작에는 target 이 필요하다 (설계 §9)` })
    }
    if (SCREEN_TARGET_TYPES.has(a.type) && a.target_screen_id === undefined) {
      ctx.addIssue({ code: 'custom', path: ['target_screen_id'], message: `${a.type} 동작에는 target_screen_id 가 필요하다 (설계 §9 팝업=지정된 전이)` })
    }
    if (a.type === 'set-state' && a.target_state_id === undefined) {
      ctx.addIssue({ code: 'custom', path: ['target_state_id'], message: 'set-state 동작에는 target_state_id 가 필요하다' })
    }
  })
  .describe('동작 (설계 §9 제한된 동작)')

/** CASE(상태) — fixture 와 기대 결과 (설계 §8 CASE, §9 예시 states). */
export const ScreenState = z
  .strictObject({
    id: LocalId,
    fixture_id: ExternalId.describe('더미데이터 fixture ID (fixtures/ 에서 관리; 여기서는 참조만)'),
    expected: NonEmptyText.describe('기대 결과'),
    case_kind: CaseKind.optional().describe('CASE 종류 (설계 §8)'),
    role: RoleId.optional().describe('이 CASE 를 적용할 역할 (권한 CASE)'),
    message_ids: z.array(LocalId).optional().describe('이 CASE 에서 표시하는 메시지 (messages[].id)'),
    note: z.string().optional(),
  })
  .describe('CASE (설계 §8, §9)')

/** 메시지 — 설명의 메시지 표 (설계 §9). */
export const Message = z
  .strictObject({
    id: LocalId,
    kind: MessageKind,
    text: NonEmptyText.describe('메시지 문구'),
    when: z.string().optional().describe('표시 조건'),
  })
  .describe('메시지 (설계 §9)')

/** 데이터 매핑 — 근거가 있는 데이터 매핑 (설계 §9). 근거가 없으면 unresolved 로 보낸다 (설계 §8). */
export const DataMapping = z
  .strictObject({
    element_id: LocalId.describe('대상 요소'),
    column_id: LocalId.optional().describe('표 요소의 컬럼'),
    source: NonEmptyText.describe('데이터 출처 표기 (데이터 계약의 항목명 등). 실제 업무 API 는 연결하지 않음 (설계 §9)'),
    evidence: z.array(AnchorRef).min(1, '데이터 매핑에는 근거 anchor 가 최소 1개 필요하다 (설계 §9)'),
  })
  .describe('데이터 매핑 (설계 §9)')

/** 미확정 항목 (설계 §8: 질문·가정·충돌, 빠진 근거). */
export const Unresolved = z
  .strictObject({
    id: LocalId.optional(),
    kind: UnresolvedKind,
    text: NonEmptyText,
    related_ids: z.array(z.string()).optional().describe('관련 요소·요구사항·정책 ID (검증하지 않음)'),
  })
  .describe('미확정 (설계 §8)')

/** 화면이 지원하는 요구사항과 수용조건 (설계 §9 예시 requirements). */
export const ScreenRequirementRef = z
  .strictObject({
    id: ExternalId.describe('외부 REQ ID'),
    criterion_ids: z.array(ExternalId).min(1, '요구사항에는 연결한 수용조건이 최소 1개 필요하다 (설계 §7 수용조건 단위 추적)'),
  })
  .describe('요구사항 참조 (설계 §9)')

/** 구조(형태) 스키마 — 참조 무결성은 검사하지 않는다. */
export const ScreenSpecShape = z
  .strictObject({
    schema_version: z.literal(SCREEN_SPEC_SCHEMA_VERSION).describe('스키마 버전 (설계 §9)'),
    screen_id: ExternalId.describe('외부 화면 ID (설계 §9)'),
    baseline_id: ExternalId.describe('고정한 기준 버전 (설계 §6, §9)'),
    purpose: NonEmptyText.describe('화면 목적'),
    shell: ShellId.describe('shell 프로파일 (설계 §9)'),
    device: DeviceProfile,
    roles: z.array(RoleId).optional().describe('사용자 역할'),
    requirements: z.array(ScreenRequirementRef).describe('지원 요구사항과 수용조건'),
    sections: z.array(Section).min(1, '화면명세에는 최소 1개 영역이 필요하다'),
    actions: z.array(Action).default([]),
    states: z.array(ScreenState).min(1, '화면명세에는 최소 1개 CASE 가 필요하다 (설계 §4 CASE·더미데이터)'),
    messages: z.array(Message).default([]),
    data_mapping: z.array(DataMapping).default([]),
    locked_elements: z.array(LocalId).default([]).describe('잠긴 요소/영역 id (설계 §12)'),
    locked_actions: z.array(LocalId).default([]).describe('잠긴 동작 id (설계 §12)'),
    unresolved: z.array(Unresolved).describe('미확정 목록. 없어도 빈 배열을 명시한다 (설계 §8)'),
  })
  .describe('ScreenSpec 구조 (설계 §9)')

export type ScreenSpecShape = z.infer<typeof ScreenSpecShape>
export type ScreenSpecInput = z.input<typeof ScreenSpecShape>
export type Element = z.infer<typeof Element>
export type HeroContent = z.infer<typeof HeroContent>
export type StatItem = z.infer<typeof StatItem>
export type CardItem = z.infer<typeof CardItem>
export type Section = z.infer<typeof Section>
export type Action = z.infer<typeof Action>
export type ScreenState = z.infer<typeof ScreenState>
export type Message = z.infer<typeof Message>

/** 참조 검사용 ID 색인. */
export interface ScreenSpecIndex {
  sections: Map<string, Section>
  elements: Map<string, { section_id: string; element: Element }>
  actions: Map<string, Action>
  states: Map<string, ScreenState>
  messages: Map<string, Message>
  requirements: Set<string>
  criteria: Set<string>
}

export interface ReferenceIssue {
  path: PropertyKey[]
  message: string
}

/** ID 를 색인하고 중복을 잡는다. 영역·요소는 target 참조 공간을 공유하므로 한 이름공간에서 유일해야 한다. */
export function indexScreenSpec(spec: ScreenSpecShape): { index: ScreenSpecIndex; issues: ReferenceIssue[] } {
  const issues: ReferenceIssue[] = []
  const index: ScreenSpecIndex = {
    sections: new Map(),
    elements: new Map(),
    actions: new Map(),
    states: new Map(),
    messages: new Map(),
    requirements: new Set(),
    criteria: new Set(),
  }
  spec.requirements.forEach((r, i) => {
    if (index.requirements.has(r.id)) issues.push({ path: ['requirements', i, 'id'], message: `요구사항 id 중복: ${r.id}` })
    index.requirements.add(r.id)
    r.criterion_ids.forEach((c, j) => {
      if (index.criteria.has(c)) issues.push({ path: ['requirements', i, 'criterion_ids', j], message: `수용조건 id 중복: ${c}` })
      index.criteria.add(c)
    })
  })
  spec.sections.forEach((s, i) => {
    if (index.sections.has(s.id) || index.elements.has(s.id)) issues.push({ path: ['sections', i, 'id'], message: `영역 id 중복: ${s.id}` })
    index.sections.set(s.id, s)
    s.elements.forEach((e, j) => {
      if (index.elements.has(e.id) || index.sections.has(e.id)) {
        issues.push({ path: ['sections', i, 'elements', j, 'id'], message: `요소 id 중복: ${e.id} (영역·요소 id 는 화면명세 안에서 유일)` })
      }
      index.elements.set(e.id, { section_id: s.id, element: e })
    })
  })
  spec.actions.forEach((a, i) => {
    if (index.actions.has(a.id)) issues.push({ path: ['actions', i, 'id'], message: `동작 id 중복: ${a.id}` })
    index.actions.set(a.id, a)
  })
  spec.states.forEach((s, i) => {
    if (index.states.has(s.id)) issues.push({ path: ['states', i, 'id'], message: `CASE id 중복: ${s.id}` })
    index.states.set(s.id, s)
  })
  spec.messages.forEach((m, i) => {
    if (index.messages.has(m.id)) issues.push({ path: ['messages', i, 'id'], message: `메시지 id 중복: ${m.id}` })
    index.messages.set(m.id, m)
  })
  return { index, issues }
}

/** target 이 표 요소이거나 표를 포함한 영역인지 (정렬·다운로드는 표를 대상으로 한다; 설계 §9). */
function resolvesToTable(index: ScreenSpecIndex, target: string): boolean {
  const el = index.elements.get(target)
  if (el) return el.element.type === 'table'
  const section = index.sections.get(target)
  return section !== undefined && section.elements.some((e) => e.type === 'table')
}

/** 참조 무결성 검사 (설계 §9, §10 V1). superRefine 과 validators 패키지가 함께 쓴다. */
export function checkScreenSpecReferences(spec: ScreenSpecShape): ReferenceIssue[] {
  const { index, issues } = indexScreenSpec(spec)
  const isComponent = (id: string) => index.sections.has(id) || index.elements.has(id)

  spec.sections.forEach((s, i) => {
    s.elements.forEach((e, j) => {
      e.trace?.forEach((c, k) => {
        if (!index.criteria.has(c)) {
          issues.push({ path: ['sections', i, 'elements', j, 'trace', k], message: `추적 대상 수용조건이 requirements 에 정의되어 있지 않다: ${c}` })
        }
      })
      e.validations?.forEach((v, k) => {
        if (v.message_id !== undefined && !index.messages.has(v.message_id)) {
          issues.push({ path: ['sections', i, 'elements', j, 'validations', k, 'message_id'], message: `검증 메시지가 messages 에 없다: ${v.message_id}` })
        }
      })
    })
  })

  spec.actions.forEach((a, i) => {
    if (a.target !== undefined && !isComponent(a.target)) {
      issues.push({ path: ['actions', i, 'target'], message: `target 이 정의된 영역/요소가 아니다: ${a.target} (설계 §9)` })
    }
    if (a.trigger !== undefined && !index.elements.has(a.trigger)) {
      issues.push({ path: ['actions', i, 'trigger'], message: `trigger 가 정의된 요소가 아니다: ${a.trigger}` })
    }
    if (a.target_state_id !== undefined && !index.states.has(a.target_state_id)) {
      issues.push({ path: ['actions', i, 'target_state_id'], message: `전이 대상 CASE 가 states 에 없다: ${a.target_state_id}` })
    }
    if ((a.type === 'sort-fixture' || a.type === 'download-fixture') && a.target !== undefined && isComponent(a.target) && !resolvesToTable(index, a.target)) {
      issues.push({ path: ['actions', i, 'target'], message: `${a.type} 의 target 은 표 요소이거나 표를 포함한 영역이어야 한다: ${a.target} (설계 §9)` })
    }
    a.trace?.forEach((c, k) => {
      if (!index.criteria.has(c)) issues.push({ path: ['actions', i, 'trace', k], message: `추적 대상 수용조건이 requirements 에 정의되어 있지 않다: ${c}` })
    })
  })

  spec.states.forEach((s, i) => {
    s.message_ids?.forEach((m, k) => {
      if (!index.messages.has(m)) issues.push({ path: ['states', i, 'message_ids', k], message: `CASE 메시지가 messages 에 없다: ${m}` })
    })
  })

  spec.data_mapping.forEach((d, i) => {
    const el = index.elements.get(d.element_id)
    if (!el) {
      issues.push({ path: ['data_mapping', i, 'element_id'], message: `데이터 매핑 대상 요소가 없다: ${d.element_id}` })
      return
    }
    if (d.column_id !== undefined) {
      if (el.element.type !== 'table') {
        issues.push({ path: ['data_mapping', i, 'column_id'], message: `column_id 는 표 요소에만 쓴다: ${d.element_id}` })
      } else if (!el.element.columns?.some((c) => c.id === d.column_id)) {
        issues.push({ path: ['data_mapping', i, 'column_id'], message: `컬럼이 표 ${d.element_id} 에 없다: ${d.column_id}` })
      }
    }
  })

  spec.locked_elements.forEach((id, i) => {
    if (!isComponent(id)) issues.push({ path: ['locked_elements', i], message: `잠긴 요소가 정의되어 있지 않다: ${id} (설계 §12)` })
  })
  spec.locked_actions.forEach((id, i) => {
    if (!index.actions.has(id)) issues.push({ path: ['locked_actions', i], message: `잠긴 동작이 정의되어 있지 않다: ${id} (설계 §12)` })
  })

  return issues
}

/** 화면명세 — 구조 + 참조 무결성. 서버는 모델의 구조화 출력이라도 이 스키마로 재검사한다 (설계 §8). */
export const ScreenSpec = ScreenSpecShape.superRefine((spec, ctx) => {
  for (const issue of checkScreenSpecReferences(spec)) {
    ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message })
  }
}).describe('ScreenSpec (설계 §9)')

export type ScreenSpec = z.infer<typeof ScreenSpec>
