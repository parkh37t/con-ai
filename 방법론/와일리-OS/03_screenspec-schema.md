# 03 ScreenSpec — 정규 중간 스펙

> 모든 입력이 수렴하는 **단일 화면 명세 JSON**. 기계용 스키마: `screenspec.schema.json` · 실증: `examples/BO006.screenspec.json`.
> 이 스펙 하나로 좌(화면)·우(디스크립션)를 **코드로 동시 생성** → 마커 1:1 미러가 구조적으로 보장됨.

---

## 1. 최상위 구조

| 키 | 의미 | S2B 8단 매핑 |
|----|------|-------------|
| `screenId` | 화면ID = HTML 파일명 = 개발목록 ID (컨펌 3대 키) | 우측 `<h2>` |
| `screenName` | 화면명 | info-table 1행 |
| `purpose` | 화면목적 | info-table 2행 |
| `menuPath` | 메뉴경로 | info-table 3행 / 브레드크럼 |
| `portal` | `admin`/`front`/... + `section` | body data-* |
| `cases[]` | CASE 전환(그룹·옵션) | CASE 칩 |
| `proc[]` | 처리 흐름 단계 | proc-table |
| `policy[]` | 정책·제약 | policy-box |
| `sections[]` | 좌측 섹션(검색/목록/폼) + 필드 마커 | num-badge / spec-header-2 |
| `tables[]` | 그리드 컬럼·더미행 참조 | data-table |
| `messages[]` | 알림 정의 | msg-tbl (맨 아래) |
| `dummyCastRef` | 더미데이터 사전 참조 | 더미데이터_사전.md |

---

## 2. 그라운딩·신뢰성 규칙 (반드시)

1. **`sourceId` 의무**: 모든 `field`·`row`·`message`는 원본 추적 id(예: `slide38`, `figma:123:45`)를 가진다. 없으면 **폐기**(환각 차단).
2. **`dummyRef`만 허용**: 샘플 값은 사전(辭典) id 참조. LLM이 값 창작 금지 → enum으로 강제.
3. **마커는 코드 생성**: `field.marker`(a,b,c…)와 우측 `spec-field`를 한 JSON에서 함께 렌더. LLM이 좌/우 개수를 독립 추측하지 않는다.
4. **표 무결성**: `table.columns` 수 × `rows` 수를 원본과 대조.
5. **구조화 추출은 strict**: 스키마를 `output_format`/`strict` tool로 제약 디코딩. 단 *문법 보장 ≠ 의미 정확* → 내용 검증 별도.

---

## 3. 필드 타입 enum (닫힌 집합)

`field.type`: `text · number · date · select · radio · checkbox · popup · readonly · textarea · daterange · pricerange · category`
`message.type`: `확인 · 경고 · 안내 · 완료 · 오류`
`section.kind`: `search · list · form · detail · popup`

> enum 고정이 추출 신뢰성을 모델 성능보다 더 끌어올린다(스키마 설계 > 원시 모델력).

---

## 4. 생산으로의 인계

ScreenSpec → `screen-spec` 스킬:
- `sections[]` → 좌 `section-box` + `num-badge`, 각 `field.marker` → `num-badge-sm`.
- 동일 `sections[]`/`fields[]` → 우 `spec-header-2`/`spec-field`(개수·순서·라벨 일치).
- `messages[]` → `msg-tbl`(항상 맨 아래).
- 백지 생성 금지 → `방법론/templates/template_screen.html` 골든 복제→개조.
