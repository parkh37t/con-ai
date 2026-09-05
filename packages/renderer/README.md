# @con-ai/renderer — ScreenSpec → 오프라인 HTML 목업 + 우측 설명

> 세로 조각 계약 §4 구현. 화면(목업)과 설명은 **같은 ScreenSpec 과 같은 element_index** 에서 만든다 (설계 §9: "AI 가 각각 따로 작성한 UI 와 설명을 나중에 문자열로 맞추는 방식을 피한다").

근거 문서: `docs/reference/UIUX_AI_기획에이전트_구현설계_v0.2.md` §9·§10("설계"), `docs/reference/첨부자료_검토보고서_v0.2.md` §5("보고서"), `docs/plan/세로조각_계약.md` §4("계약").

## 실행

```bash
pnpm vitest run packages/renderer     # 이 패키지만
pnpm check                            # 저장소 전체 (typecheck + vitest)
```

```ts
import { renderScreen, S2B_LEARNED_PROFILE } from '@con-ai/renderer'

const { html, description, element_index } = renderScreen({
  spec,                                   // ScreenSpecShape (서버가 이미 ScreenSpec 으로 참조 검사한 것)
  profile: S2B_LEARNED_PROFILE,
  dummy: { 'orders-normal': rows, ... },  // states[].fixture_id → 행 목록
  meta: {
    screen_title, requirements: [{ external_id, title, criterion_ids }],
    revision_label: 'rev 3', generated_by: '더미 어댑터(fixture)',
    portal_name: '파트너 포털',                 // 선택. 없으면 spec.shell 접두어에서 만든다 (buyer-page → "구매 포털")
    menus: [{ label: '홈' }, { label: '견적', active: true }],  // 선택. 없으면 화면명 첫 낱말로 기본 메뉴를 만든다
  },
})
```

## 구조

| 파일 | 역할 |
|---|---|
| `src/types.ts` | 계약 §4 타입 (`RenderInput`, `RenderOutput`, `RenderProfile`, `DescriptionModel`). 바꾸지 않는다 |
| `src/profile.ts` | `S2B_LEARNED_PROFILE` — shell 클래스, 설명 순서, 번호 규칙, **프롬프트용 규칙 문장 `rules`** |
| `src/element-index.ts` | `buildNumbering` / `buildElementIndex` — 영역 1,2,3 · 요소 a,b,c(영역마다 다시 시작). 화면 배지와 설명 번호의 단일 원본. V2 검사도 같은 함수를 쓴다 |
| `src/description.ts` | `buildDescription` — 명세 → 설명 모델(8절) |
| `src/client-data.ts` | 인라인 JS 가 읽는 데이터(CASE·메시지·표·동작·더미데이터). 동작의 대상 표·검색 입력을 미리 푼다 |
| `src/html.ts` | HTML 조립: shell → 목업(영역·요소 컴포넌트) + 설명 패널 + 툴바 + 모달 + 인라인 데이터/JS |
| `src/styles.ts` | 인라인 CSS — 화면설계서 시각 규격을 토큰(`:root` 사용자 정의 속성)으로 둔다. 시스템 글꼴만 쓰고 외부 자원 없음 |
| `src/client-script.ts` | 인라인 JS (CASE 전환·검색·정렬·팝업·다운로드·postMessage) |
| `src/render.ts` | `renderScreen`, `RENDERER_VERSION` |
| `src/labels.ts` | 컴포넌트·동작·CASE·메시지 종류의 한국어 라벨 |

### 출력 HTML 구조

```text
body[data-screen-id][data-shell][data-shell-kind][data-case][data-action-types]
├─ .con-ai-toolbar[data-toolbar]        CASE 버튼(button[data-case]) · PC/모바일 토글 · 생성 어댑터/revision · 상태 (부모 창이 있으면 숨김)
├─ .root-shell[data-shell-root][data-device]              (팝업 shell 은 .popup-shell)
│  ├─ .screen-wrap[data-region="screen"]                  (팝업은 .popup-wrap > .popup-card; GNB·breadcrumb 없음)
│  │  ├─ .phone-status                                    모바일에서만 보이는 폰 상태 표시줄
│  │  ├─ header.screen-head
│  │  │  ├─ nav.gnb  로고 pill(포털명) · .gnb-menu .m(.on = 활성, 밑줄) · .util · button[data-gnb-toggle](모바일 햄버거)
│  │  │  └─ .breadcrumb                                   홈 › 그룹 › 화면명
│  │  ├─ .body-wrap                                       최대 1180px, 가운데 정렬
│  │  │  ├─ .screen-title-row                             화면명 + 화면 ID(모노스페이스), 2px 검은 밑줄
│  │  │  ├─ .screen-messages[data-messages]               현재 CASE 의 message_ids
│  │  │  └─ section.area[data-element-id=영역][data-section-id][data-display-no="1"]   둥근 카드
│  │  │     ├─ span.badge.badge-section[data-badge-for]   카드 바깥으로 걸친 검은 사각 번호
│  │  │     ├─ h2.area-title
│  │  │     └─ .area-body
│  │  │        └─ .field.field-<type>[data-element-id=요소][data-display-no="a"]
│  │  │           └─ .field-label(span.badge.badge-element = 파란 원형 번호 + 라벨) + .control
│  │  └─ .screen-status[data-status]                      더미 동작 결과 표시 (navigate 등)
│  └─ aside#right-panel[data-region="description"]        (팝업은 aside.spec-side)
│     └─ section.desc-section[data-desc-key=…] × 8        설명 항목 .desc-item[data-element-id][data-display-no]
├─ .con-ai-modal[data-modal]                              open-popup 용 간단 모달 (target_screen_id 표시)
├─ script#con-ai-data (application/json)                  클라이언트 데이터
└─ script                                                 인라인 JS
```

`section.area` 의 요소가 모두 `text` 면 `.area.area-info` 가 되어 행이 붙은 "기본 정보 표"로 쌓인다.

### 시각 규격 (화면설계서 문서)

출력은 웹앱이 아니라 **흰 바탕의 화면설계서**로 보이게 만든다. 값은 `styles.ts` 의 `:root` 토큰에 주석과 함께 모아 두었다.

| 요소 | 규격 |
|---|---|
| 배치 | 좌 목업 `flex:11.5` / 우 설명 `flex:4.5`(최소 360px), 사이에 2px 검은 세로선(`#right-panel{border-left}`) |
| 영역 | 둥근 카드(1.5px `#333`, radius 10px) + 좌상단 **바깥으로 걸친 검은 사각 번호 배지** |
| 요소 | 라벨 앞 **파란 원형 배지**(`#1d6ef5`) |
| 표 | 회색 머리(`#f1f3f5`) · 얇은 테두리(`#444`) · 9~11px 셀 여백 |
| 버튼 | 주요 `.btn`(검은 채움) / 보조 `.btn.btn-secondary`(흰 배경 테두리) |
| 우측 패널 | 모노스페이스 화면 ID + 2.5px 검은 밑줄 → 개요 표(`table.info-table`) → 작은 회색 절 라벨(`.desc-kicker`) → 영역 머리(`.desc-area-head`)·요소 한 줄(`.desc-item`) → 검은 머리 메시지 표(`table.msg-table`) |
| 정책 | 파란 왼쪽 막대 강조 상자(`.desc-policy`) |
| 모바일 | `[data-device="mobile"]` 이면 목업 열이 420px **폰 프레임**(9px 검은 테두리, radius 34px)이 되고 상태 표시줄·햄버거 시트가 보인다. 회색 무대 위에 가운데 배치 |

다크모드는 두지 않는다(설계 문서는 흰 바탕 고정). 글꼴은 `'Pretendard','Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif` — 시스템에 있는 것만 고르고 웹폰트를 불러오지 않는다.

### 설명 순서 (프로파일 `description_order`, 설계 §9)

`screen_id`(모노스페이스 화면 ID 제목 + revision·생성 어댑터·기준 버전 꼬리표) → `overview`(개요 표: 화면명·목적·역할·REQ 와 수용조건 ID) → `cases`(CASE 표) → `flow`(처리 흐름 = actions, 한 줄 목록) → `policy`(검증 규칙·잠금·미확정, 파란 강조 상자) → `data_mapping`(근거 anchor 가 있는 매핑 표) → `sections`("영역별 디스크립션" — element_index 와 같은 순서·번호, trace 수용조건 표시) → `messages`(검은 머리 메시지 표).

절의 라벨은 `DESCRIPTION_TITLES` 를 쓴다. 설명 항목의 `label` 에는 번호를 적지 않는다 — 번호는 `display_no`(=`element_index`) 하나에서 나와 배지로만 붙는다.

### 번호 규칙

- 영역: `display_no` 가 있으면 그대로, 없으면 순서대로 `1, 2, 3`.
- 요소: `display_no` 가 있으면 그대로, 없으면 영역마다 `a, b, c` 부터 다시 시작 (z 다음 aa). 영역마다 반복되는 a 는 전역 중복 오류가 아니다.
- `element_index` 에는 영역 항목(`element_id === section_id`)과 요소 항목이 모두 들어간다. 화면 배지(`.badge[data-badge-for]`), `data-display-no`, 설명 번호가 모두 여기서 나온다.

### 컴포넌트

`text-input`, `number-input`, `textarea`, `select`, `radio`, `checkbox`, `date-input`, `date-range`, `button`, `table`, `text`, `link`, `pagination`. 입력 컨트롤에는 `data-input-for=<요소 id>`, `data-input-type`; 동작을 일으키는 버튼·링크에는 `data-action-trigger`, `data-action-id`, `data-action-type`. 표는 `table.grid[data-table-id]`, 헤더 `th[data-column-id][data-sortable]`, 본문 `tbody[data-tbody-for]` 의 `tr[data-row]`.

### 동작 (실제 API 호출 없음)

| 동작 | 구현 |
|---|---|
| CASE 전환 | `button[data-case]` 또는 postMessage → `body[data-case]` 갱신, 표를 `dummy[state.fixture_id]` 로 다시 채움, `message_ids` 표시 |
| `filter-fixture` | trigger 영역(없으면 표 밖)의 입력값으로 현재 CASE 행을 거른다 (텍스트=부분 일치, select/radio/checkbox=값 일치, 날짜/기간=범위). 0건이면 empty CASE 메시지 표시. 입력에서 Enter 도 실행 |
| `sort-fixture` | 초기값은 `default_sort`; 정렬 가능한 헤더 클릭으로 asc/desc 토글. trigger 로 실행하면 기본 정렬로 되돌림 |
| `open-popup` | 표 행 클릭(target 이 표/영역) 또는 trigger 클릭 → 모달에 `target_screen_id` 와 행 값 표시 |
| `close-popup` | 모달 닫기 |
| `download-fixture` | 표 컬럼(`downloadable !== false`)과 현재 표시 행으로 CSV 문자열(BOM 포함) → Blob 다운로드 |
| `navigate` | 상태 줄에 "화면 이동(더미): <id>" 표시. 실제 이동 없음 |
| `set-state` | `target_state_id` 로 CASE 전환 |

## 프로파일 (`S2B_LEARNED_PROFILE`)

S2B 자료에서 학습한 규격을 프로젝트 프로파일 데이터로 둔다 (설계 §9, 보고서 §5). `rules` 의 문장은 프롬프트 템플릿의 `profile_rules` 로 그대로 들어간다: 페이지/팝업 shell, 설명 8단계 순서, 영역 1·2·3 과 요소 a·b·c(영역마다 반복), 화면·설명 번호의 공통 원본, 검색 영역에 초기화 버튼 없음, 제한된 동작 목록, 실제 API 미연결, 오프라인 단일 파일, `data-element-id` 규칙. 이 규칙은 승인된 프로파일에만 적용하며 모든 프로젝트에 강제하지 않는다.

## postMessage 프로토콜 (계약 §4)

부모 창이 있을 때(`window.parent !== window`)만 보내고 받는다. 부모가 없으면 툴바의 CASE 버튼과 폭 토글로 조작한다.

| 방향 | 메시지 | 언제 |
|---|---|---|
| iframe → 부모 | `{ type: 'con-ai:element-click', element_id, section_id, case_id, target: 'screen' \| 'description', display_no }` | 화면의 영역·요소 또는 설명 항목을 클릭했을 때 (`data-element-id` 가 있는 가장 가까운 조상 기준) |
| 부모 → iframe | `{ type: 'con-ai:set-case', case_id }` | CASE 전환 |
| 부모 → iframe | `{ type: 'con-ai:highlight', element_id }` | 해당 요소(화면·설명 양쪽)에 `.is-highlighted` 외곽선을 주고 화면 쪽으로 스크롤 |

`postMessage(..., '*')` 로 보내며, 받을 때는 `event.source === window.parent` 인 메시지만 처리한다. 부모가 있으면 `body.is-embedded` 를 붙이고 툴바를 `hidden` 으로 숨긴다. 격리 표시(`sandbox="allow-scripts"`)를 전제로 하며 모델 키·인증정보는 HTML 에 들어가지 않는다.

## 남은 제한

- 접근성(V4): 레이블·포커스는 기본 수준만 있고 키보드 조작·overflow 검사는 하지 않는다.
- 페이지 이동(`pagination`)은 한 페이지 고정(더미데이터가 한 페이지). 정렬은 문자열/숫자 비교만 한다.
- 다운로드는 Blob 방식이라 `sandbox="allow-scripts"` iframe 에서는 브라우저가 저장을 막을 수 있다 (오류는 나지 않고 상태 줄에만 표시).
- GNB·LNB 는 포털 이름 자리표시만 있다. 포털별 실제 메뉴 규칙은 프로파일에 아직 없다.
- `text` 요소는 `note ?? label` 을 본문으로 보여준다. 리치 텍스트·이미지 컴포넌트는 없다.
- 더미데이터 행이 객체가 아니면 첫 컬럼에 문자열로만 표시한다.
- 명세 자체의 참조 검사는 하지 않는다 (서버 V1 몫). 정의되지 않은 target 을 가진 동작은 아무 표도 다루지 않는다 — V3 검색 필터 검사에서 드러난다.
