# @con-ai/schemas — 입력·ScreenSpec·TraceLink·검증 결과 스키마 (zod)

> **초안 · 변경 예정.** 설계 §14 단계 1~2 를 시작하기 위한 첫 스키마 묶음이다. 필드·enum 값은 구현이 진행되면서 바뀔 수 있으며, 바뀔 때 이 README 와 테스트를 함께 갱신한다.

근거 문서: `docs/reference/UIUX_AI_기획에이전트_구현설계_v0.2.md`("설계"), `docs/reference/첨부자료_검토보고서_v0.2.md`("보고서"), `docs/reference/Claude_Code_개발시작_프롬프트_v0.2.md`("개발프롬프트"). 각 스키마 파일 머리와 필드 `describe()` 에 출처 절을 적었다.

외부 의존성은 `zod@4.5.4` 뿐이다. 예시·테스트는 모두 합성 데이터이며 S2B 요구사항 본문·화면 경로를 담지 않는다(공개 저장소).

## 실행

```bash
pnpm check            # 저장소 루트에서: typecheck + vitest
pnpm test -- packages/schemas
```

## 파일별 역할

| 파일 | 내용 | 주요 출처 |
|---|---|---|
| `src/common.ts` | `InternalId`(UUID), `ExternalId`(공백 없는 문자열; 프로젝트 내 유일은 도메인 규칙), `LocalId`(명세 안 로컬 ID), `Revision`, `ContentHash`(SHA-256 소문자 hex), `IsoDateTime`, `Actor`, `AnchorRef` | 설계 §6, §11 |
| `src/source.ts` | `SourceDocument` / `SourceVersion`(sha256·저장 위치·등록 시점) / `SourceAnchor`(시트·행·열 · CSV 레코드 · MD 절·행 · HTML 위치 + 원문 일부), `SourceType`(xlsx/md/csv/html/index) | 설계 §4, §6 |
| `src/requirement.ts` | `Requirement` / `RequirementRevision`(외부 REQ ID, 제목, 내용, 범위, 원문 근거, 상태) / `AcceptanceCriterion`(개별 조건, 검증 방식, UI/비UI) | 설계 §6, §7; 보고서 §4 |
| `src/policy.ts` | `PolicyRevision` / `Term` / `StateModel`(업무 상태값·전이·예외; 출처 체계마다 별도 레코드) | 설계 §6; 보고서 §4 |
| `src/baseline.ts` | `Baseline`(채택한 자료·요구사항·정책·상태 모델·화면·템플릿 버전 묶음) | 설계 §6, §8 |
| `src/screen.ts` | `IANode`, `ScreenPlan`(기존 외부 화면 ID, 별칭 이력, 수입 검토 상태) / `ScreenRevision`(목적, shell, 기기, 역할, 명세 hash), `NonUIScreenWork`, `ShellProfile`/`ShellId`(`<포털>-page|popup`), `DeviceProfile`, `RoleId` | 설계 §6, §9 |
| `src/screen-spec.ts` | `ScreenSpecShape`(구조) 와 `ScreenSpec`(구조 + 참조 무결성 superRefine), `Element`/`Section`/`Action`/`ScreenState`/`Message`/`DataMapping`/`Unresolved`, 허용 컴포넌트 `ElementType`, 제한된 동작 `ActionType`, `CaseKind`, `indexScreenSpec`/`checkScreenSpecReferences` | 설계 §8, §9, §10 V1, §12 |
| `src/examples.ts` | `DESIGN_EXAMPLE_ORDER_LIST`(설계 §9 예시 원문), `EXAMPLE_ORDER_LIST`(results 영역 보완본), `EXAMPLE_ORDER_LIST_EXTENDED`(검색·빈 결과·오류 CASE) | 설계 §9; 개발프롬프트 3항 |
| `src/trace-link.ts` | `TraceLink`(status candidate/approved/conflict/excluded/non_ui, 근거, 결정자·시점·사유), `TraceProposal`(항상 candidate), `TraceCoverage`(분모=승인 범위 수용조건) | 설계 §6, §7, §8, §13 |
| `src/validation.ts` | `ValidationStatus`(pass/fail/error/not_run), `ValidationStage`(V0~V7), `ValidationRun` / `ValidationResult`, `findApprovalBlockers`, `AcceptanceTest`(①~⑤) | 설계 §6, §10; 보고서 §5 |
| `src/job.ts` | `JobStatus`(queued→running→succeeded/failed/cancelled), `JobStage`, `GenerationJob`(idempotency key, 입력 hash, 제한 시간, 취소 요청, 실패 원인), `ArtifactStatus`(draft→validation_pending→review_ready→approved/stale), `Artifact`, `Approval`, `PromptTemplate` | 설계 §3, §5, §6, §11 |
| `src/prompt.ts` | `GenerationRequest`(입력 폼 7구역), `GenerationOutput`(ScreenSpec, trace_proposals, unresolved, change_summary — html 키 거부), `GenerationRecord`(템플릿·모델 식별자·입력 hash·anchor·결과) | 설계 §8, §12 |
| `src/import-config.ts` | `XlsxImportConfig`(sheet, header_row, id_column, 열 매핑, id_pattern; 프로젝트별 규칙) | 설계 §4; 보고서 §3 |
| `src/index.ts` | 재수출 | — |
| `src/test-utils.ts` | 테스트 보조(재수출하지 않음) | — |

## 주요 필드 ↔ 출처

| 스키마.필드 | 출처 | 비고 |
|---|---|---|
| `ScreenSpec.schema_version/screen_id/baseline_id/purpose/shell/device/requirements/sections/actions/states/unresolved` | 설계 §9 예시 JSON | 예시가 `ScreenSpecShape` 로 그대로 파싱된다 |
| `ScreenSpec.sections[].elements[].trace`, `actions[].trace` | 설계 §9 "요소별 추적 관계" | `requirements[].criterion_ids` 안의 값만 허용 |
| `Action.target` | 설계 §9 "`target` 은 실제 정의된 컴포넌트로 참조 검증" | 정의된 영역/요소 id 만 허용; 정렬·다운로드는 표 대상 |
| `ActionType` | 설계 §9 렌더러 허용 동작 | 검색=filter-fixture, 정렬=sort-fixture, 팝업=open/close-popup, 다운로드=download-fixture; 거래·외부 API 동작 없음 |
| `Element.columns/default_sort/validations`, `Message`, `DataMapping.evidence` | 설계 §9 "표·필드·검증·메시지·출처" | 데이터 매핑은 근거 anchor 필수 |
| `Element.display_no` | 설계 §9 "내부 요소 ID 와 표시 번호 구분" | 영역마다 반복돼도 오류 아님(테스트 있음) |
| `ScreenSpec.locked_elements/locked_actions` | 설계 §12 잠긴 요소·동작 | 정의된 id 여야 함 |
| `CaseKind` | 설계 §8 CASE 구역 | normal/empty/error/permission/processing |
| `ValidationStatus`, `ValidationStage`, `ValidationResult.required` | 설계 §10 | 필수 검사가 pass 가 아니면 `findApprovalBlockers` 가 반환 |
| `AcceptanceTest.criterion_id/initial/user_actions/expected_result/artifact_hash` | 설계 §10 수용 테스트 ①~⑤ | 다섯 항목 모두 필수 |
| `JobStatus`, `ArtifactStatus`, `GenerationJob.idempotency_key/input_snapshot_hash/current_stage/timeout_ms/cancel_requested` | 설계 §11 | 세 상태 enum 은 별도 정의(테스트 `status-enums.test.ts`) |
| `TraceLinkStatus`, `TraceLink.evidence/decided_by/reason/non_ui_work_id` | 설계 §7 판정 원칙 | 제외·비UI 는 사유와 별도 책임 연결 필요 |
| `TraceCoverage.criteria_in_scope` | 설계 §7 커버리지 분모 | 중복 ID·문자열 출현 수·INDEX 행 수는 분모가 아님 |
| `GenerationRequest.target/task/baseline/references/cases/constraints/output` | 설계 §8 입력 폼 7구역 | 폼 밖 키(모델 이름 등) 거부 |
| `GenerationOutput` | 설계 §8 출력 계약 | html 키가 있으면 실패 |
| `GenerationRecord.prompt_template_version/model_id/input_hash/context_anchors/output_hash` | 설계 §8 기록 항목 | |
| `XlsxImportConfig.sheet/header_row/id_column` | 설계 §4 | 보고서 §3: 지정 ID 열 기준 수입 |
| `RequirementStatus.source_extracted_unapproved` | `data/review` CSV 의 `review_status` | 수입 결과와 같은 표기 |

## 설계 §9 예시와 참조 검사의 관계

설계 §9 의 예시 JSON 은 "형태 설명용 발췌"다. `actions[0].target` 이 `results` 를 가리키지만 예시에는 `results` 영역이 없다. 그래서 두 층으로 나눴다.

- `ScreenSpecShape` — 구조만 검사. 예시 원문이 그대로 통과한다.
- `ScreenSpec` — 구조 + 참조 무결성. 예시 원문은 `actions.0.target` 미정의로 실패하고, `EXAMPLE_ORDER_LIST`(results 영역을 보완) 는 통과한다.

서버의 V1 검사와 `GenerationOutput` 은 `ScreenSpec` 을 쓴다.

## 상태 enum 은 합치지 않는다

| enum | 값 | 파일 |
|---|---|---|
| `JobStatus` | queued, running, succeeded, failed, cancelled | job.ts |
| `ArtifactStatus` | draft, validation_pending, review_ready, approved, stale | job.ts |
| `ValidationStatus` | pass, fail, error, not_run | validation.ts |
| `TraceLinkStatus` | candidate, approved, conflict, excluded, non_ui | trace-link.ts |

업무 상태값(주문 상태 등)은 `StateModel` 레코드로 출처 체계마다 따로 둔다(보고서 §4). 위 제품 enum 과 무관하다.

## 남은 제한 (아직 반영하지 않음)

- **접근성**: 요소별 레이블 연결·키보드 순서·포커스 규칙 필드가 없다 (설계 §9, §10 V4).
- **이벤트 모델**: 동작은 `trigger`(요소) → `target` 만 표현한다. 이벤트 종류(click/change/submit)·순서·조건은 없다.
- **상태 전이 상세**: CASE 간 전이는 `set-state` 동작의 `target_state_id` 로만 표현한다. 전이 표(from/to/조건)와 처리 흐름 서술은 없다.
- **shell 규칙**: `ShellId` 의 `<포털>-page|popup` 형식은 초안 규칙이다. S2B 프로파일의 GNB/LNB·breadcrumb 규칙은 `ShellProfile.rules` 문자열로만 둔다.
- **fixture**: `states[].fixture_id` 는 문자열 참조다. fixture 스키마와 존재 검사는 `fixtures/`·validators 에서 한다.
- **요구사항 범위(scope)** 는 자유 텍스트다. 포털·역할·기기 구조화는 후속.
- **ChangeRequest / Decision** (설계 §6, §11) 는 아직 없다. `Approval` 만 있다.
- **Project** 엔터티(설계 §6) 는 없다. 각 스키마의 `project_id` 만 UUID 로 둔다.
- **외부 ID 의 프로젝트 내 유일성**, **revision 충돌 검사**, **커버리지 계산** 은 스키마가 아니라 `packages/domain`/저장소 규칙이다.
- **비UI 검증 방식**·**검증 방식 enum** 값은 초안이며 파일럿에서 조정한다.
- `SourceType` 은 MVP 범위(xlsx/md/csv/html/index)만 갖는다. HWP·PDF 는 후속(설계 §4).
