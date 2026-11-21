# @con-ai/domain — ID·버전·매핑 규칙

> **초안 · 변경 예정.** 설계 §14 단계 1(자료·ID·버전·매핑 기반)을 위한 도메인 규칙이다. 저장소·API 없이 순수 함수로만 규칙을 표현하며, 입력·출력 타입은 `@con-ai/schemas` 를 쓴다. 스키마 파일은 여기서 수정하지 않는다 — 부족한 점은 아래 "스키마에서 부족했던 점" 에 적었다.

근거 문서: `docs/reference/UIUX_AI_기획에이전트_구현설계_v0.2.md`("설계"), `docs/reference/첨부자료_검토보고서_v0.2.md`("보고서"), `docs/reference/Claude_Code_개발시작_프롬프트_v0.2.md`("개발프롬프트"). 각 파일 머리와 거부 이유 메시지에 출처 절을 적었다.

외부 의존성은 `@con-ai/schemas` 뿐이다(zod 를 직접 쓰지 않는다). 테스트 데이터는 모두 합성이며 S2B 요구사항 본문·화면 경로를 담지 않는다(공개 저장소).

## 실행

```bash
pnpm check                          # 저장소 루트: typecheck + vitest 전체
pnpm vitest run packages/domain     # 이 패키지만
```

## 판정·적용 규약 (`src/result.ts`)

| 종류 | 이름 형태 | 반환 | 거부 시 |
|---|---|---|---|
| 판정 | `can*`, `evaluate*`, `check*` | `RuleDecision { allowed, reasons[] }` | `allowed=false` 와 **이유 목록** (이유는 모두 모아 돌려준다) |
| 적용 | `rename*`, `promote*`, `transition*`, `approve*`, `exclude*`, `mark*` | 새 객체 (원본 객체는 바꾸지 않는다) | `DomainRuleError` (같은 이유 목록이 `.reasons` 에 붙는다) |

이유(`RuleReason`)는 `<모듈>.<규칙>` 코드와 출처 절이 적힌 한국어 메시지를 갖는다. `deny()` 는 빈 이유 목록을 받지 않는다 — 이유 없는 거부는 만들 수 없다.

## 파일별 역할

| 파일 | 내용 | 주요 출처 |
|---|---|---|
| `src/result.ts` | `RuleDecision`, `RuleReason`, `DomainRuleError`, `allow/deny/decide/assertAllowed` | — |
| `src/external-id.ts` | 프로젝트 내 현재 외부 ID 유일성(`checkExternalIdUnique`), 수입 분류(`planImport`: 중복 그룹·경로 미확인·별칭 충돌을 임시 레코드로 분리), 승격(`canPromoteToRegistry`/`promoteToRegistry`), 명시적 개명·경로 이동(`canRenameExternalId`/`renameExternalId`), 과거 ID 조회(`resolveExternalId`, `externalIdAt`) | 설계 §6; 보고서 §3, §4; 개발프롬프트 |
| `src/coverage.ts` | `computeCoverage` — 분모 = 승인된 범위의 수용조건, 승인 매핑 비율·테스트 통과 비율 별도, 비UI·제외·충돌 건수 동반, 금지 입력 거부 | 설계 §7, §10; 개발프롬프트 |
| `src/state-machines.ts` | `JOB_TRANSITIONS`/`ARTIFACT_TRANSITIONS` 표, `canTransitionJob`/`transitionJob`, `canTransitionArtifact`/`transitionArtifact` (모양만 검사; 다른 체계 값 거부) | 설계 §11; 보고서 §4 |
| `src/approval-gate.ts` | `evaluateApprovalGate` (상태·hash·revision·기준 버전·필수 검사·미실행 검사·사람 검토 V6), `approveArtifact` (게이트 + Approval 기록), `findReviewBlockers`/`canMarkReviewReady` (review_ready 조건) | 설계 §10, §11, §13; 개발프롬프트 |
| `src/trace-decision.ts` | `canApproveTraceLink`/`approveTraceLink` (동일 기준 버전·근거 anchor·담당자·시점·revision; 토큰만 거부; conflict 는 정본 확정 결정 필요), `canExcludeTraceLink`/`excludeTraceLink` (excluded/non_ui 사유·비UI 작업 연결), `markTraceConflict` | 설계 §7, §2, §13, §15; 보고서 §4, §7; 개발프롬프트 4항 |
| `src/stale.ts` | `findChangeImpact` (변경된 요구사항 revision·수용조건·기준 버전 → 영향 링크·화면·산출물·테스트·stale 대상), `markStale`, `applyStaleTargets` | 설계 §6, §11 |
| `src/index.ts` | 재수출 | — |
| `src/test-fixtures.ts` | 테스트용 합성 데이터 생성기·`captureRuleError` (재수출하지 않음) | — |

## 규칙 ↔ 출처

| 규칙 | 코드 | 출처 |
|---|---|---|
| 프로젝트 내 현재 외부 ID 는 유일. 공식 레지스트리(`registered`)뿐 아니라 미해결 임시 레코드와 겹쳐도 등록 불가 | `checkExternalIdUnique` → `external_id.duplicate` / `external_id.duplicate_pending` | 설계 §6 |
| 중복 수입은 별도 임시 레코드로 받고 해결 전 공식 레지스트리에 합치지 않는다. 경로가 같아도 병합하지 않으며 서로 다른 경로 그룹은 `paths_differ` 로 표시 | `planImport` → `duplicate_groups`; `canPromoteToRegistry` | 설계 §6; 보고서 §3 (중복 43그룹, 서로 다른 경로 32그룹 자동 병합 금지) |
| 경로 미확인 행은 연결 후보일 뿐 등록하지 않는다 | `planImport` → `path_unresolved`; `external_id.path_required` | 보고서 §3 (52건); 설계 §15 |
| 과거 별칭과 같은 ID 는 이름만으로 자동 연결하지 않는다 | `planImport` → `alias_collisions` (`import_candidate`) | 보고서 §4 (폐기 ID 중복) |
| 파일명·화면 ID 변경은 별칭 이력과 경로 이동 기록을 남기는 명시적 변경 작업. 사유·행위자·시점 없으면 실패 | `canRenameExternalId` → `external_id.rename.reason_required` 등; `renameExternalId` 가 `aliases` 에 추가 | 설계 §6, §2 |
| 내부 UUID 와 외부 ID 분리: 개명해도 `ScreenPlan.id` 와 과거 `ScreenRevision.external_id` 는 불변 | `renameExternalId` 는 `id` 를 건드리지 않고 revision 을 받지 않는다; `externalIdAt` 으로 당시 ID 조회 | 설계 §6 ("과거 승인본은 당시 ID 유지") |
| 새 SP 번호를 기존 ID 대신 강제하지 않는다 — ID 생성·일괄 개명 API 없음, 개명은 한 화면씩 | 모듈에 `generate*/bulk*/batch*` 없음 (테스트로 고정); `renameExternalId(registry, plan 한 건, change)` | 설계 §6; 개발프롬프트 |
| 커버리지 분모 = baseline 이 채택한 요구사항 revision 의 수용조건. 범위 밖은 `out_of_scope_criteria` 로만 보고 | `computeCoverage` | 설계 §7, §6 Baseline |
| 승인 매핑 비율과 테스트 통과 비율은 별도. 통과는 승인 매핑 화면 revision 의 artifact hash 에서 `pass` 한 테스트만 (not_run 은 통과 아님) | `approved_mapping_ratio`, `test_pass_ratio` | 설계 §7 표 "검증 완료", §10 |
| 비UI·제외·충돌 건수는 분모에서 빼지 않고 함께 반환 | `coverage.non_ui/excluded/conflicts` | 설계 §7 |
| 다른 기준 버전의 링크는 세지 않는다; 승인 링크가 여럿이어도 수용조건은 한 번 | `computeCoverage` | 설계 §7 (동일 기준 버전, 다대다) |
| 중복 ID 수·문자열 출현 수·INDEX 행 수는 입력이 아니다 | `CoverageInput` 에 자리 없음 + `assertCoverageInputKeys` → `coverage.forbidden_input` | 설계 §7; 개발프롬프트 (INDEX 1,428행 금지) |
| 작업: queued → running → succeeded/failed/cancelled (queued → cancelled 허용). 실행 없이 성공 표시 불가 | `JOB_TRANSITIONS`; `job.transition_not_allowed` | 설계 §11; 보고서 §2 |
| 산출물: draft → validation_pending → review_ready → approved; approved 는 stale 로만. approved → draft 직접 전이 거부 | `ARTIFACT_TRANSITIONS`; `artifact.transition_not_allowed` | 설계 §11, §6 |
| 세 상태 체계(작업/산출물/검증)를 합치지 않는다 — 다른 체계 값은 실행 시점에도 거부 | `job.status_foreign`, `artifact.status_foreign` | 설계 §10, §11; 보고서 §4 |
| 필수 검사 fail/error/not_run 이면 승인 불가; 결과 없는 필수 검사는 not_run | `evaluateApprovalGate` → `approval.required_check_*` (schemas `findApprovalBlockers` 재사용) | 설계 §10; 개발프롬프트 5항 |
| 승인은 정확한 artifact hash 에 연결. 다른 hash 의 검증 결과는 무효 | `approval.hash_mismatch`, `approval.validation_hash_mismatch`, `approval.no_validation` | 설계 §6, §10 V7; 개발프롬프트 |
| revision 불일치(오래된 저장) 차단 | `approval.revision_conflict`, `trace.revision_conflict` | 설계 §11, §13 |
| 자동 검사 통과는 사람 검토(V6)를 대체하지 않는다 | `approval.human_review_incomplete` / `human_review_not_passed` | 설계 §10 |
| review_ready 는 V6 를 제외한 자동 필수 검사가 모두 pass | `canMarkReviewReady`, `findReviewBlockers` | 설계 §10, §11 |
| 승인 매핑 = 동일 기준 버전 + 근거 anchor + 담당자·시점 + 요소/동작 연결 | `canApproveTraceLink` → `trace.baseline_mismatch`, `trace.evidence_required`, … | 설계 §7 표, §2 |
| HTML 토큰 출현(HTML 위치 anchor)만으로는 승인 불가 — 원문(시트·CSV·MD) 근거 필요 | `trace.token_only` (`isSourceTextAnchor`) | 설계 §7; 개발프롬프트 4항; 보고서 §7 |
| conflict 는 정본 확정 결정(결정자·시점·사유·원문 anchor) 없이 approved 불가; HTML 설명을 정본으로 삼지 않음 | `trace.conflict_unresolved`, `trace.conflict_resolution.*` | 설계 §7 (REQ-SFR-066-001), §15; 보고서 §4 |
| excluded 는 사유, non_ui 는 사유 + 이 수용조건을 연결한 `NonUIScreenWork` 필요 | `trace.reason_required`, `trace.non_ui_work_required`, `trace.non_ui_work_criterion_mismatch` | 설계 §7 "제외·비UI" |
| 요구사항·수용조건·기준 버전 변경 → TraceLink 로 영향 화면·산출물·테스트 탐색, 기존 승인(및 검토 중 산출물)을 stale 대상으로 | `findChangeImpact`, `applyStaleTargets` | 설계 §11 |
| stale 에는 사유가 필요하고 이미 stale 이면 거부 | `markStale` (Artifact 스키마 + 전이표) | 설계 §11 |

## 해석해서 정한 것 (설계에 명시되지 않은 부분)

- **`validation_pending → draft`**: 필수 검사가 fail/error/not_run 이면 검토 후보가 아니므로 초안으로 되돌린다. 내용 수정은 새 hash = 새 산출물이다. 설계 §11 의 enum 에 "검증 실패" 상태가 없어 이렇게 두었다.
- **`review_ready → validation_pending`**: 검사 도구 버전 변경 등 재검증 요청. `approved` 에서는 허용하지 않는다.
- **`stale` 은 종료 상태**: 사람이 영향 범위를 확인한 뒤 재생성(새 draft)한다. stale 해제는 모델링하지 않았다.
- **커버리지의 non_ui**: 수용조건 `kind='non_ui'` 이거나 `non_ui` 링크가 있으면 센다. 분모에서 빼지 않는다(설계 §7 "함께 보여준다").
- **테스트 통과 판정의 artifact 연결**: TraceLink(screen_revision_id) → Artifact(screen_revision_id, content_hash) → AcceptanceTest(artifact_hash) 로 이었다. 승인 매핑이 없는 수용조건의 테스트는 통과로 세지 않는다.
- **정책 변경의 영향**: TraceLink 가 정책을 가리키지 않으므로 `changed_baseline_ids` (기준 버전 갱신)로 표현한다.
- **적용 함수의 revision**: `approveTraceLink`/`excludeTraceLink`/`markTraceConflict` 는 결과 링크의 `revision` 을 1 올린다. 실제 증가는 저장소가 맡을 수 있으며 그때 이 값은 기대값이다.

## 스키마에서 부족했던 점 (schemas 는 수정하지 않았다)

- `ScreenRegistryStatus` 에 타입 별칭이 없어 `ScreenPlan['registry_status']` 로 파생했다. `ScreenAlias` 도 마찬가지(`ScreenPlan['aliases'][number]`).
- `TraceLinkStatus` 에 "재확인 필요"(stale) 값이 없어 변경 영향에서 승인 매핑은 `approved_links_to_review` 목록으로만 돌려준다.
- `TraceLink.status='excluded'` 에는 "별도 책임" 을 가리키는 필드가 없다(설계 §7 "사유와 별도 책임·검증 연결"). 지금은 사유 + 결정자만 요구한다.
- `TraceLink` 가 정책(PolicyRevision)을 가리키지 않아 정책 변경 영향은 기준 버전 단위로만 찾는다.
- `Artifact` 에 revision 이 없어 승인 게이트의 revision 은 호출자가 `{ expected, current }` 로 넘긴다.
- `ValidationRun` 에 baseline_id 가 없어 승인 시 기준 버전 일치는 선택 입력(`baseline`)이다.
- `AcceptanceTest` 가 화면 revision 을 직접 가리키지 않아 artifact hash 를 거쳐 연결한다.
- `Project` 엔터티가 없어 프로젝트 권한(누가 승인·개명할 수 있는가)은 다루지 않았다.

## 남은 제한 (아직 반영하지 않은 규칙)

- **권한**: 승인·개명·정본 확정의 역할별 권한(설계 §2 표)은 API 계층 몫으로 두었다.
- **중복 ID 해결 절차**: 임시 레코드 두 건 중 "실제 화면 구분"(설계 §15) 은 개명·폐기로 표현할 수 있으나, 폐기(retire) 자체의 상태·기록은 없다.
- **경로 이동 이력의 검증**: `renameExternalId` 는 새 경로가 실제 존재하는지 검사하지 않는다(파일 저장소 몫).
- **작업 재시도·idempotency**: 상태 전이만 있고 재시도 횟수·제한 시간 초과 판정(설계 §11)은 workers 에서 한다.
- **ChangeRequest / Decision**: 정본 확정 결정을 `ConflictResolution` 입력으로만 받고 별도 레코드로 저장하지 않는다(schemas 에 아직 없음).
- **커버리지의 UI 분모 분리**: 비UI 수용조건을 뺀 "UI 분모" 는 제공하지 않는다. 필요하면 `TraceCoverage` 에 필드를 더한 뒤 반영한다.
- **conflict 의 자동 감지**: 화면 설명의 REQ 표기와 원장 정의가 다른지 비교하는 것은 validators/importers 몫이다. 여기서는 표시·해제 규칙만 있다.
