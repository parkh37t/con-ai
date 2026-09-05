# @con-ai/api — API·작업 실행·저장소

Hono + node:sqlite. 세로 조각 계약(`docs/plan/세로조각_계약.md`) §1 저장, §6 파이프라인 실행(큐), §7 API, §8 내보내기, §10 시드를 담당한다. 모델 호출은 `@con-ai/model-adapter` 를 통해서만 하고, 키·토큰 값은 응답·로그에 넣지 않는다.

## 실행

```bash
# 저장소 루트에서. .env 는 자동으로 읽지 않는다 — 셸에 올린다 (scripts/setup.sh 가 .env 를 만들어 준다)
set -a; source .env; set +a
pnpm --filter @con-ai/api dev        # tsx watch (기본 http://localhost:8787)
pnpm --filter @con-ai/api start
```

`.env` 가 없어도 기동한다: fixture(더미) 어댑터, `.local/con-ai.db`, `exports/` 를 저장소 루트 기준으로 자동 생성한다. 첫 기동 시 DB 가 비어 있으면 샘플 프로젝트를 시드한다. node:sqlite 는 Node 22 실험 기능이라 `ExperimentalWarning` 한 줄이 나오며 무시해도 된다.

시작 로그에 어댑터 종류·모델·인증 방식(종류만)·DB 경로·내보내기 폴더·Playwright 존재 여부를 찍는다. fixture 어댑터면 실제 모델 설정 방법을 안내한다.

## 환경변수

| 변수 | 기본 | 설명 |
|---|---|---|
| `PORT` | `8787` | API 포트 |
| `CON_AI_DB` | `<루트>/.local/con-ai.db` | SQLite 파일. 디렉터리는 자동 생성. 테스트는 `:memory:` |
| `EXPORT_DIR` | `<루트>/exports` | 완료(v1.0) 내보내기 폴더. `/exports/*` 로 정적 제공 |
| `MODEL_ADAPTER` | `fixture` | `anthropic` \| `fixture` (model-adapter 가 해석) |
| `MODEL_ID` | `claude-opus-5` | anthropic 모델 ID |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` | | anthropic 어댑터 인증. 서버에서만 읽는다 |
| `PLAYWRIGHT_CHROMIUM_PATH`, `PLAYWRIGHT_BROWSERS_PATH` | | `/api/meta` 의 `playwright` 판단(실행 파일 존재 여부)과 V3 실행 검사 |

## API (모두 JSON, `/api`)

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| GET `/api/meta` | | `{adapter, model, auth('api_key'\|'token'\|'profile'\|'none'), version, playwright}` |
| GET `/api/projects` | | `Project[]` |
| GET `/api/projects/:id` | | `{project, requirements, ia_nodes, screens[{id, external_id, title, shell, device, status, version, current_revision_id, revision_count, open_comments}]}` |
| GET `/api/projects/:id/references` | | `Reference[]` (프로젝트용 + 공용) |
| POST `/api/screens/:id/prompt-preview` | `SliceGenerationRequest`(screen_id 생략 가능) | `{prompt: AssembledPrompt, context_summary}` |
| POST `/api/screens/:id/generation-jobs` | `SliceGenerationRequest` | 202 `{job_id}`. 문맥을 만들 수 없는 요청(없는 요구사항·레퍼런스·기준 revision)은 400 |
| GET `/api/jobs/:id` | | `Job` — `status`(queued/running/succeeded/failed/cancelled), `stage`, `failure{code,message,stage,details}`, `result{revision_id, artifact_id}`, `prompt_text`, `context_summary` |
| POST `/api/jobs/:id/cancel` | | 취소 요청 (계약 외 추가). queued 는 즉시 cancelled, running 은 다음 단계 진입 전에 cancelled |
| GET `/api/screens/:id` | | `{screen, revisions[{id, revision_no, artifact_id, artifact_hash, artifact_status, validation_summary{pass,fail,error,not_run}, open_comments, change_summary, based_on_revision_id, job_id, created_at}]}` |
| GET `/api/revisions/:id` | | `{revision, spec, artifact(+revision), validation_results, comments(+revision), element_index}` |
| GET `/api/artifacts/:id/html` | | `text/html` + `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:` |
| POST `/api/artifacts/:id/validations` | | 재검증. 같은 hash 의 이전 결과(V6 포함)를 지우고 새 결과로 바꾼 뒤 산출물 상태를 다시 판정 → `{artifact, validation_results, summary}` |
| POST `/api/revisions/:id/comments` | `{target, element_id?, section_id?, case_id?, display_no?, author, role, text, blocking?}` | 201 `Comment`(+`revision`) |
| PATCH `/api/comments/:id` | `{status, revision}` | `Comment`. revision 이 다르면 409 `stale_revision` |
| POST `/api/revisions/:id/revision-prompt` | `{comment_ids}` | `{prompt, rationale, adapter, model, comment_ids}` (어댑터의 draftRevisionPrompt) |
| POST `/api/screens/:id/approvals` | `{revision_id, approver, artifact_hash?, note?}` | 200 `{approval, version:'1.0', export_path, export_url, files, manifest}` 또는 400 `{error:'approval_rejected', reasons[{code,message}]}` |
| GET `/exports/*` | | 내보낸 정적 파일 |

요청 본문은 zod 로 검증하며 실패하면 400 `{error:'invalid_request', issues[{path,message}]}`. 오래된 revision 저장은 409, 도메인 규칙 위반은 400 `{reasons}`.

### 승인 판정

`@con-ai/domain` `evaluateApprovalGate` — 산출물 상태(review_ready 만), 요청 hash = 산출물 hash, 기준 버전 일치, 승인 대상 hash 의 필수 검사 전부 pass(결과 없는 필수 검사는 not_run → 거부), 사람 검토(V6) pass — 에 더해 **차단(blocking) 코멘트 open 0건** 과 **이미 v1.0 승인된 화면 아님** 을 검사한다. 기획자의 완료 버튼이 곧 V6 이므로, 승인 요청 시 `V6.human_review` pass 결과를 만들어 게이트를 평가하고 **통과했을 때만** 그 결과를 저장한다. 통과하면 Approval 기록, artifact `approved`, screen `approved`/`version '1.0'`, 내보내기까지 한 번에 한다.

### 내보내기 (`EXPORT_DIR/<project_slug>/<screen_external_id>/v1.0/`)

`index.html`(산출물 HTML 그대로, hash 동일), `spec.json`, `trace.json`(요구사항 → 수용조건 → 요소·동작·CASE; spec 의 trace 필드에서 생성, 미연결 수용조건 목록 포함), `validation.json`, `comments.json`, `manifest.json`(계약 §8 필드 + `design_handoff`). 각 파일 sha256 은 manifest.files(manifest 자신 제외)와 승인 기록 files(manifest 포함)에 남는다.

## 작업 큐와 재시작

- 큐는 API 프로세스 안의 메모리 순차 큐다. `enqueue(jobId)` 하면 실행 중이 아닐 때 즉시 `runGenerationJob` 을 시작하고, 실행 중이면 뒤에 붙는다.
- 상태는 모두 DB 의 job 문서에 있다. 새로고침 후에도 `GET /api/jobs/:id` 로 단계(`stage`)·상태·실패 원인을 읽는다.
- 서버가 시작될 때 `queued`/`running` 으로 남은 작업은 `failed`(code `internal`, "서버 재시작으로 중단") 로 정리한다. 메모리 큐는 복원하지 않으므로 다시 실행하려면 새 작업을 만든다.
- 실패한 작업은 revision·artifact 를 만들지 않는다. 화면의 현재 revision 은 마지막 성공 결과로 남는다.

## 저장소 (`src/store.ts`)

`documents(kind, id, revision, json, created_at, updated_at)` + `artifact_html(artifact_id, html)`. `put` 은 기대 revision(새 문서 0)이 현재와 다르면 `StoreConflictError`(code `stale_revision`) 를 던진다. `delete` 는 재검증 시 이전 검증 결과 정리용으로 계약에 추가한 메서드다.

문서 종류는 계약 §1 + `dummy_data`(더미데이터; id = `states[].fixture_id`, 예 `SAMPLE-quote-list-normal`). 문서 형태는 `@con-ai/worker-generation` 의 `documents.ts` 에 있다.

## 시드 (`src/seed.ts`)

프로젝트 "와일리 컨버전스 샘플 — 파트너 견적 포털"(가상): 요구사항 5건(REQ-QT-001~005, 수용조건 AC-QT-…, 그중 AC-QT-003-03 이 비UI), IA(파트너 포털 > 견적 > 목록/상세/등록 팝업), 화면 3개(`SAMPLE-quote-list` partner-page, `SAMPLE-quote-detail` partner-page, `SAMPLE-quote-create-popup` partner-popup), 레퍼런스 3개(`REF-quote-list` / `REF-quote-detail` / `REF-quote-create-popup` 골든 명세, `ScreenSpec` 파싱 통과), 더미데이터(REF-*·SAMPLE-* 각 normal/searched/empty/error/permission 등), 프롬프트 템플릿 v1 레코드. 골든 명세 생성 함수(`goldenListSpec` 등)는 fixture 어댑터·테스트가 화면 ID·기준 버전·fixture 접두어만 바꿔 재사용할 수 있다.

## 검사

```bash
pnpm vitest run apps/api workers/generation
```

`store.test.ts`(revision 충돌·HTML·파일 DB), `seed.test.ts`(모든 spec 파싱, 화면 3개, fixture ↔ 더미데이터 대응, 멱등), `app.test.ts`(메모리 DB + 가짜 어댑터·렌더러·검증기 주입 통합 흐름, 승인 거부 사유, revision 충돌, 취소, 재시작 정리).

## 남은 제한

- 승인·내보내기는 화면당 v1.0 한 번이다. 승인 뒤 다시 생성하면 화면은 `review` 로 돌아가지만 기존 승인본을 `stale` 로 표시하거나 v1.1 을 만들지는 않는다.
- 상세 화면의 더미데이터는 품목 행만 있다(상태 이력 표는 별도 fixture 가 없다 — 명세 unresolved 에 질문으로 남김).
- 큐는 단일 프로세스·순차이며 제한 시간(`timeout_ms`)을 강제하지 않는다. 재시도도 하지 않는다(`max_attempts` 1).
- `/api/meta` 의 `playwright` 는 실행 파일 존재만 본다. 실제 실행 가능 여부는 V3 결과(`error`)로 드러난다.
- 권한·인증이 없다. 승인자는 요청 본문의 `approver` 문자열이다.
- `.env` 를 직접 읽지 않는다 (`set -a; source .env` 또는 `scripts/setup.sh`).
