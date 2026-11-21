# fixtures — 합성 데이터와 실패 예제

> **모든 파일은 합성 데이터이며 승인된 사실이 아니다.** 실제 S2B 항목은 설계·검토보고서가 이미 인용한 수준(REQ ID, 제목, 원장 행 번호, INDEX 경로 소수)까지만 담고, 요구사항 본문·내부 경로는 싣지 않는다(공개 저장소). 정본이 확정되지 않은 충돌은 충돌 상태 그대로 보존한다.

목적은 개발프롬프트의 **첫 수용조건** — "원문에서 가져온 요구사항 하나를 화면 요소·CASE 에 연결하고, 같은 명세로 HTML 과 설명을 만든 뒤, 일부러 잘못된 매핑·누락 CASE 를 넣으면 검증이 실패하는 것" — 을 다음 단계(`packages/validators`, `packages/renderer`)가 검증할 입력을 미리 준비하는 것이다. 근거 문서: `docs/reference/` 의 설계 v0.2("설계"), 검토보고서 v0.2("보고서"), 개발시작 프롬프트 v0.2("개발프롬프트").

## 실행

```bash
pnpm vitest run fixtures   # 이 디렉터리만
pnpm check                 # 저장소 전체 (typecheck + vitest)
```

`fixtures.test.ts` 가 `manifest.json` 의 모든 항목을 순회해 기대(parse)와 실제 스키마 파싱 결과를 대조하고, validators 구현 전이라도 각 실패 예제의 기대를 고정 단언으로 남긴다. `manifest.ts` 는 manifest·records 봉투·더미데이터 파일의 형태 검사와 로더다(루트에서 `zod` 가 해석되지 않으므로 수동 검사; 스키마 파싱은 `@con-ai/schemas` 의 zod 객체로 한다).

## 목록·용도·기대 검증 결과

| 파일 | 용도 | 스키마 | 파싱 기대 | 단계 | 판정 기대 | 출처 |
|---|---|---|---|---|---|---|
| `screen-specs/example-order-list.valid.json` | 정상 목록 화면. 합성 요구사항 EXAMPLE-REQ-001(수용조건 3개)·EXAMPLE-REQ-002(1개)를 요소·동작 trace 로 연결. 검색·정상·빈 결과·오류 CASE | ScreenSpec | pass | V1 | pass | 설계 §9, 개발프롬프트 3항·첫 수용조건 |
| `screen-specs/example-order-list.bad-mapping.json` | valid 에서 두 곳만 바꾼 잘못된 매핑: `order-table.trace → EXAMPLE-AC-99`(미정의 수용조건), `search-submit.target → result-table`(미정의 요소) | ScreenSpec | **fail** (`actions.0.target`, `sections.1.elements.0.trace.0`) | V1 | fail | 설계 §9 target 참조 검증, §10 V1 |
| `screen-specs/example-order-list.missing-case.json` | valid 에서 empty·error CASE 와 전이 동작(show-empty, show-error)을 뺀 명세 | ScreenSpec | pass (현재 스키마는 CASE 종류를 강제하지 않음) | V1 (V3 도) | **fail** — 필수 CASE `empty, error` 누락, 수용조건 EXAMPLE-AC-03 미연결 | 설계 §8, §10 V1·V3 |
| `screen-specs/example-order-list.stale-baseline.json` | valid 에서 `baseline_id` 만 `example-baseline-0` 으로 바꾼 명세 | ScreenSpec | pass | V0 (V5 도) | **검토 필요**(fail) — 현재 기준 `example-baseline-1` 과 다름, 산출물 stale | 설계 §6, §10, §11 |
| `conflicts/req-sfr-066-001.conflict.json` | 원장 SFR 행 308 제목 "관심 물품·공급업체 관리 기능 제공" 과 참고 HTML 설명의 "몰 통합 관리" 를 SourceAnchor 두 개로 보존. TraceLink `conflict`, RequirementRevision `conflict`, 정본 미확정 | records | pass | V0 | **fail** — 미해결 의미 충돌 | 설계 §7, 보고서 §4, 개발프롬프트 |
| `conflicts/req-sfr-038-001.non-ui-split.json` | 원장 행 183 세금계산서 자동발행 관리를 화면 책임(설정·조회, `candidate`) 2건과 배치 책임(NonUIScreenWork, `non_ui`) 2건으로 분리. 커버리지 승인 0 | records | pass | V0 | pass (승인 매핑 0 → 완료 아님) | 설계 §7, 보고서 §4 |
| `registry/duplicate-id.sample.json` | INDEX 중복 ID `admin-display-contentManageCategoryMapping` 이 `관리자포털/전시관리/몰관리/admin-display-contentManageCategoryMapping-cat.html` 과 `관리자포털/전시관리/몰관리/admin-display-contentManageCategoryMapping.html` 두 경로. 임시 레코드(`duplicate_id`) 두 개로 분리, 자동 병합 금지 | records | pass | V0 | **fail** — 중복 ID 미해결 | 보고서 §3, 설계 §6 |
| `registry/missing-path.sample.json` | 경로확인 52건의 형태(합성 ID·경로). `_legacy` 같은 파일명 후보는 `linked=false`, 후보 없는 행도 `path_resolution_required` | records | pass | V0 | **fail** — 경로 확인 필요 | 보고서 §3·§7 |
| `synthetic/orders.fixture.json` | 더미데이터 `orders-normal / orders-searched / orders-empty / orders-error` — valid 명세 `states[].fixture_id` 와 1:1 | DummyDataFile (fixtures/manifest.ts) | pass | V3 | pass | 설계 §9 |
| `synthetic/xlsx-import-config.example.json` | SFR 시트·헤더 행·ID 열(A) 지정 예 | XlsxImportConfig | pass | V0 | pass | 설계 §4, 보고서 §3 |
| `synthetic/example-requirements.json` | 합성 요구사항·수용조건(EXAMPLE-AC-01~04)·anchor·기준 버전 `example-baseline-1` | records | pass | V0 | pass | 설계 §6, §9 |

단계(V0~V7)는 설계 §10 의 검증 파이프라인이다. "판정 기대" 는 validators 가 이 입력에 대해 내야 할 결과이며, 현재는 `fixtures.test.ts` 의 단언(예: 필수 CASE 가 states 에 없음, baseline 불일치, conflict 상태·근거 2개)으로 고정되어 있다.

## 파일 형식

- `manifest.json`: `{ manifest_version, note, current_baseline_id, required_case_kinds, fixtures[] }`. 각 항목은 `{ id, path, kind, layout, schema?, expected: { parse, fail_paths?, stage, status, verdict?, reason, missing_case_kinds?, unlinked_criterion_ids? }, source[] }`.
- `layout=document`: 파일 전체가 스키마 하나의 문서(ScreenSpec, XlsxImportConfig, DummyDataFile).
- `layout=records`: `{ fixture_id, note, records: [{ schema, data }], …사이드카 }` 봉투. 스키마에 없는 정보(INDEX 제목·행 번호, 후보 경로, 해결 규칙)는 `index_rows`, `resolution`, `canonical_source` 같은 사이드카에 둔다.
- 변형 명세 3종은 valid 에서 정해진 변경만 적용한 것이며, 테스트가 "valid + 변경 = 변형본" 을 단언해 드리프트를 막는다.
- 합성 UUID 는 앞자리로 종류를 구분한다: `1…` 프로젝트, `11…` anchor, `2…` 원본 문서/버전, `3…` 요구사항, `31…` revision, `32…` 수용조건, `4…` 화면, `43…` 비UI 작업, `5…` TraceLink, `6…` 가져오기 설정, `7…` baseline. anchor `11111111-1111-4111-8111-111111111111` 은 `@con-ai/schemas` examples.ts 의 `EXAMPLE_ANCHOR_ID` 와 같다.

## 유출 방지 회귀 테스트

`fixtures.test.ts` 의 마지막 describe 가 `fixtures/` 의 모든 JSON·MD 를 읽어 다음을 검사한다.

- 원장 문장의 머리 기호(U+274D)와 원장 문장 어미가 없다(합성 문장은 "~한다" 체).
- `REQ-SFR-…` ID 는 설계 문서가 인용한 두 건(066-001, 038-001)만 등장한다.
- `.html` 경로는 인용된 3건(`관리자포털/전시관리/몰관리/admin-display-contentManage.html`, `관리자포털/전시관리/몰관리/admin-display-contentManageCategoryMapping-cat.html`, `관리자포털/전시관리/몰관리/admin-display-contentManageCategoryMapping.html`)과 `index.html`, 그리고 `EXAMPLE` 을 포함한 합성 경로만 등장한다.
- 실제 원장 항목의 RequirementRevision.body 는 자리표시 문구만 갖는다.

## 스키마에서 부족했던 점 (packages/schemas 는 수정하지 않음)

- `ScreenState`(CASE) 에 `trace` 가 없다. "요구사항을 CASE 에 연결" 은 `set-state` 동작의 `trace` 로 우회했다(valid 의 `show-empty → EXAMPLE-AC-03`).
- `ScreenSpecShape` 가 필수 CASE 종류(normal/empty/error)를 강제하지 않는다. missing-case 는 파싱을 통과하므로 필수 CASE 검사는 validators(V1) 몫이다. 필수 목록은 `manifest.required_case_kinds` 에 두었다.
- `ScreenPlan` 에 INDEX 제목·행 번호·후보 경로·근거(anchor) 필드가 없다. 레지스트리 fixture 는 `index_rows` 사이드카로 보완했다.
- `SourceVersion.sha256` 이 필수라 원본 없이 합성 버전 레코드를 만들 수 없다. 충돌·비UI fixture 는 `SourceDocument` 와 합성 `source_version_id` 만 참조한다.
- `RequirementRevision.body` 가 필수 문자열이라 본문을 싣지 않는 실제 항목에는 자리표시 문구를 넣었다. "본문 미수록" 을 나타내는 필드가 없다.
- `TraceLink` 는 수용조건을 내부 UUID 로만 가리켜 `records` 봉투 안에서 사람이 대조하기 어렵다(외부 ID 병기 필드 없음).
- 더미데이터 fixture 스키마가 `@con-ai/schemas` 에 없다(README "남은 제한"). `fixtures/manifest.ts` 의 `parseDummyDataFile` 이 임시 형태 검사다.
- 검증 판정 "검토 필요" 는 `ValidationStatus`(pass/fail/error/not_run)에 없다. manifest 는 `status: fail` + `verdict: 검토 필요` 로 표현했다.

## 판단하지 못해 남긴 것

- REQ-SFR-066-001 의 정본(원장 vs 화면 설명) — 담당 기획자 결정 사항(설계 §15). fixture 는 `canonical_source: unresolved`.
- REQ-SFR-038-001 의 화면 책임 범위와 실제 연결 화면 — 합성 화면 `EXAMPLE-fee-invoice-schedule` 로 대체했고 UI 매핑은 `candidate`.
- `xlsx-import-config.example.json` 의 `header_row`, `data_row_start`, `columns.title=I` 는 형태 예시값이다(설계 §7 의 A308/I308 인용에 따름). 실제 열은 원장 등록 시 확인한다.
- 중복 ID 두 행이 같은 화면의 변형인지 별개 화면인지, 경로 미확인 행의 이동·폐기 여부 — `resolution.status: pending`.
- `registry/missing-path.sample.json` 은 실제 52건 CSV 의 첫 행 형태만 따르고 ID·경로는 합성으로 바꿨다(인용 경로 수를 늘리지 않기 위해).
