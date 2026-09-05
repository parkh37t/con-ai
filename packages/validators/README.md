# @con-ai/validators — V1 명세 · V2 렌더 구조 · V3 실행 검사

> 세로 조각 계약 §5 구현. 각 검사는 `pass / fail / error / not_run` 을 구분한다. **실행하지 않은 검사는 not_run, 도구(브라우저)를 못 띄운 것은 error 이며 둘 다 통과가 아니다** (설계 §10, 보고서 §5). 결과는 schemas `ValidationResult` 에 `executed_at` 을 더한 형태다.

근거 문서: 설계 §9·§10, 보고서 §5, 계약 §5, `fixtures/README.md`.

## 실행

```bash
pnpm vitest run packages/validators   # 이 패키지만 (V3 는 실제 headless chromium 을 띄운다)
pnpm check                            # 저장소 전체
```

이 실행 환경처럼 Playwright 번들 브라우저 revision 이 없으면 `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium` 을 준다 (`.env.example`). 테스트는 env 가 없고 그 경로가 있으면 스스로 설정하며, skip 하지 않는다.

```ts
import { runAll, runV1, runV2, runV3, REQUIRED_CHECKS, requiredChecksFor, hashHtml } from '@con-ai/validators'

const results = await runAll({ spec, html, required_cases: ['normal', 'empty', 'error'], artifact_hash: hashHtml(html) })
// profile 생략 시 S2B_LEARNED_PROFILE. timeout_ms(기본 20000), validation_run_id, executable_path 선택.
```

`runAll` 은 V1 → V2 → V3 순서로 한 `validation_run_id` 아래 모아 돌려주고, **V1.schema 가 실패하면 V2·V3 를 실행하지 않고 not_run 으로 기록**한다.

## check_id 표

| check_id | 단계 | 필수 | 검사 | fail 조건 |
|---|---|---|---|---|
| `V1.schema` | V1 | 필수 | `ScreenSpecShape` 구조 파싱 | 구조 오류 (evidence 에 `path: message`). 실패하면 나머지 V1 은 not_run |
| `V1.references` | V1 | 필수 | `checkScreenSpecReferences` — target·trigger·trace·message·data_mapping·잠금 참조 | 정의되지 않은 id (evidence `actions.0.target: …`) |
| `V1.required_cases` | V1 | 필수 | `opts.required_cases` 가 `states[].case_kind` 에 모두 있는지 (`case_kind` 없는 CASE 는 normal 로 본다) | 누락 (evidence `missing=empty,error`) |
| `V1.criteria_linked` | V1 | 필수 | `requirements[].criterion_ids` 가 요소·동작 `trace` 로 최소 1회 연결 | 미연결 수용조건 (evidence `unlinked=…`) |
| `V2.shell` | V2 | 필수 | 페이지 `.root-shell/.screen-wrap/#right-panel`, 팝업 `.popup-shell/.popup-wrap/.spec-side`; 다른 shell 루트가 섞이지 않음; `body[data-shell]` 일치 | 구조 위반 |
| `V2.description_order` | V2 | 필수 | 설명 영역의 `data-desc-key` 순서 = 프로파일 `description_order` | 순서·개수 불일치 |
| `V2.element_ids` | V2 | 필수 | 명세의 모든 영역·요소 id 가 화면·설명 양쪽에 `data-element-id` 로 있음, 명세에 없는 id 없음 | 누락·초과 |
| `V2.display_numbers` | V2 | 필수 | 렌더러와 같은 규칙(`buildElementIndex`)으로 만든 번호가 화면 `data-display-no`·배지 텍스트·설명 번호와 일치 | 불일치 |
| `V2.no_external_refs` | V2 | 필수 | `src/href/action/url()/@import` 에 `http(s)://`·`//` 참조 없음 (오프라인) | 외부 참조 |
| `V3.console_errors` | V3 | 필수 | setContent 부터 모든 상호작용까지 `console.error` + `pageerror` 0건 | 1건 이상 |
| `V3.case_switch` | V3 | 필수 | 모든 `button[data-case]` 를 (현재 CASE 다음부터 돌아가며) 눌러 `body[data-case]` 가 바뀌고, CASE 간 표 행 수·메시지가 달라짐 | 전환 안 됨 · 오류 · CASE 1개 · 변화 없음 |
| `V3.search_filter` | V3 | **조건부** | 행이 가장 많은 CASE 에서 한 행에만 있는 셀 값을 검색 → 행 수 감소(≥1), 불일치 검색어 → 0행. 트리거 버튼이 없으면 입력에서 Enter | 감소 없음 · 0행 아님 · 오류 |
| `V3.download` | V3 | **조건부** | 다운로드 버튼 클릭 시 오류 없음 + download 이벤트 또는 "다운로드" 상태 표시 | 오류 · 아무 반응 없음 · 트리거 없음 |

- **조건부 필수**: `V3.search_filter` 는 명세에 `filter-fixture` 동작이, `V3.download` 는 `download-fixture` 동작이 있을 때만 필수다 (렌더러가 `body[data-action-types]` 에 적은 값으로 판단). 없으면 결과를 `status: not_run, required: false` 로 기록하므로 승인 게이트(`findApprovalBlockers`)를 막지 않는다. 명세별 필수 목록은 `requiredChecksFor(spec)`.
- `REQUIRED_CHECKS` 는 위 13개 전부다.

## V3 브라우저 실행

`chromium.launch({ headless: true, executablePath })` 의 실행 파일은 다음 순서로 정한다: `opts.executable_path` → `process.env.PLAYWRIGHT_CHROMIUM_PATH` → 기본 launch → 실패 시 `/opt/pw-browsers/chromium` 이 있으면 재시도. 그래도 못 띄우면 **모든 V3 결과를 `error`** 로 기록하고 evidence 에 각 시도의 오류를 남긴다. 제한 시간(`timeout_ms`, 기본 20000)을 넘기면 진행 중 검사는 `error`, 남은 검사는 `not_run`.

## fixtures 기대 결과

| fixture | V1 | V2 | V3 |
|---|---|---|---|
| `example-order-list.valid.json` | 전부 pass | 전부 pass | 전부 pass |
| `example-order-list.bad-mapping.json` | `V1.references` fail (`sections.1.elements.0.trace.0`, `actions.0.target`) | pass | `V3.search_filter` fail — 정의되지 않은 target 이라 필터가 아무 표도 거르지 않는다 |
| `example-order-list.missing-case.json` | `V1.required_cases` fail (`missing=empty,error`), `V1.criteria_linked` fail (`EXAMPLE-AC-03`) | pass | pass (남은 CASE 2개로 판정) |
| 구조가 깨진 입력 | `V1.schema` fail, 나머지 V1 not_run | not_run | not_run (브라우저를 띄우지 않음) |

## 테스트 파일

| 파일 | 내용 |
|---|---|
| `src/v1.test.ts` | fixtures 3종(valid / bad-mapping / missing-case) + stale-baseline + 깨진 입력 + schemas 예시의 V1 기대 결과 |
| `src/v2.test.ts` | 정상 HTML(페이지·팝업) pass, 훼손 HTML(shell·설명 순서·요소 id·번호·외부 참조) fail |
| `src/v3.test.ts` | 실제 headless chromium: valid 전부 pass, Enter 검색, 조건부 not_run, 콘솔 오류 fail, 죽은 스크립트 fail, 제한 시간 error, 잘못된 브라우저 경로 error |
| `src/run-all.test.ts` | `REQUIRED_CHECKS`·`requiredChecksFor`·`runAll` 순서와 승인 게이트(`findApprovalBlockers`) 연동 |
| `src/embedded.test.ts` | 렌더 HTML 의 `sandbox="allow-scripts"` iframe 표시와 postMessage 프로토콜 (렌더러 패키지에 브라우저 의존성이 없어 여기서 검사) |

## 남은 제한

- V0(입력·baseline·충돌), V4(표시·접근성: overflow·키보드·레이블), V5(회귀: 변경 범위·잠긴 요소·이전 승인본 비교), V6(사람 검토), V7(내보내기)은 미구현이다. `stale-baseline` fixture 는 V1 로는 통과한다.
- V3 는 정렬·팝업·페이지 이동을 검사하지 않는다 (콘솔 오류로만 잡힌다). 설계 §10 의 "정렬·팝업" 시나리오는 후속.
- V3 는 렌더러의 표식(`button[data-case]`, `body[data-case]`, `tr[data-row]`, `[data-messages]`, `[data-action-type]`, `[data-input-for]`, `#con-ai-data`)에 의존한다. 다른 렌더러의 HTML 에는 그대로 쓸 수 없다.
- V2 는 정규식 태그 스캐너라 속성값 안의 `>` 같은 비정상 HTML 은 다루지 않는다 (렌더러 출력은 모두 이스케이프한다).
- 수용 테스트(①수용조건 ②초기 상태·역할 ③동작 ④기대 ⑤hash) 기록은 아직 만들지 않는다. V3 evidence 에 CASE·행 수·검색어를 남기는 데서 시작한다.
