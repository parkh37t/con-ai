# @con-ai/web — 브라우저 작업대

React 19 + Vite. UI 라이브러리 없이 plain CSS(`src/styles.css`) 하나. 모든 문구는 한국어. 세로 조각 계약(`docs/plan/세로조각_계약.md`) §7 의 API 만 믿고 만든다.

## 실행

```bash
pnpm dev                          # 루트: api(8787) + web(5173) 동시 실행
pnpm --filter @con-ai/web dev     # web 만 → http://localhost:5173 (API 8787 이 떠 있어야 한다)
pnpm --filter @con-ai/web build   # dist/ 산출
```

`vite.config.ts` 가 `/api` 와 `/exports` 를 `http://localhost:8787` 로 proxy 한다(`CON_AI_API_ORIGIN` 으로 바꿀 수 있다). 생성 HTML 은 `/api/artifacts/:id/html` 을 `sandbox="allow-scripts"` iframe 으로 격리해 표시하며 모델 키·인증정보는 브라우저에 없다.

## 화면 흐름 (해시 라우팅, 라우터 라이브러리 없음)

| 경로 | 화면 | 내용 |
|---|---|---|
| `#/` | 프로젝트 홈 | 요구사항·수용조건(UI/비UI), To-Be IA 트리, 화면 목록(외부 ID·shell·상태·버전·revision·열린 코멘트, 생성/검토/완료 링크). fixture 어댑터면 `.env` 안내 한 줄 |
| `#/references` | 레퍼런스 포트폴리오 | 골든 예시 카드(분류·태그·S2B 학습 규격), 선택 시 spec 요약(영역·요소·CASE) |
| `#/screens/:id/generate?job=` | 생성 작업대 | 작업 유형·목적·범위·요구사항/수용조건·참고 화면·CASE·유지 조건·역할·기기·직접 프롬프트 → 프롬프트 미리보기(`/prompt-preview`) → 생성 실행(`/generation-jobs` 202) → 작업 상태(2초 폴링, 단계 진행, 실패 원인). `?job=` 이 URL 에 남아 새로고침 후에도 상태를 다시 읽는다 |
| `#/screens/:id/review?rev=&job=` | 화면 검토 | revision 목록(검증 요약 pass/fail/error/not_run, artifact 상태, 열린 코멘트) → 격리 iframe + CASE 버튼(`con-ai:set-case`) + PC 1280/모바일 420 → 요소 클릭(`con-ai:element-click`) → 코멘트 폼 → 코멘트 목록·상태 변경(강조 `con-ai:highlight`) → 검증 결과 표·재검증 → 수정 요청(코멘트 선택 → AI 수정 프롬프트 초안 또는 직접 입력 → 단건 수정 실행 → 새 revision) |
| `#/screens/:id/approve?rev=` | 완료·내보내기 | 승인 사전 판정(검증 요약, 열린 차단 코멘트, 이유), 승인자 → 완료(v1.0) → 내보내기 경로·파일 링크(`/exports/...`)·index.html 열기·manifest `design_handoff` |

상단 바: 프로젝트명, 어댑터 배지(`anthropic · 모델 · 인증 방식` 실제 호출 / `fixture 더미 어댑터(모델 호출 없음)`), Playwright 가능 여부.

## 파일

- `src/api.ts` — 계약 §7 엔드포인트 함수. 오류는 `ApiError{status, reasons}` 로 화면에 표시.
- `src/types.ts` — 계약 §1·§2 필드 기준 응답 타입 (다른 패키지 import 없음).
- 순수 로직(vitest, DOM 불필요): `router.ts`(라우트 파싱·링크), `job-progress.ts`(단계 진행), `summary.ts`(검증 요약·승인 사전 판정·IA 트리·spec 요약), `preview-messages.ts`(postMessage 프로토콜), `export-paths.ts`(내보내기 링크), `generation-form.ts`(폼 → 요청), `adapter-badge.ts`(배지 문구).
- `src/hooks.ts` — 해시 라우트, 비동기 로딩, 작업 폴링.
- `src/pages/*` — 화면 5개, `src/components/*` — 상단 바·배지·작업 상태 패널·레퍼런스 카드.

## 검사

```bash
pnpm --filter @con-ai/web build
pnpm vitest run apps/web
pnpm typecheck          # 루트 tsconfig 가 apps/web/src 를 함께 검사한다 (strict)
pnpm e2e                # 루트 e2e/slice.spec.ts — API·웹을 띄워 생성→검토→수정→완료→내보내기→재승인 거부를 실제 브라우저로 확인
```

e2e 는 `data-testid` 로 요소를 찾는다(문구 변경에 영향받지 않게). 주요 id: `adapter-badge`, `screen-row`, `purpose`, `criterion-<AC id>`, `case-<kind>`, `preview-button`, `run-button`, `job-status`, `preview-iframe`, `case-button-<id>`, `comment-*`, `validation-row`, `revision-row`, `draft-button`, `edit-prompt`, `run-edit-button`, `approve-button`, `export-result`, `export-file`, `approve-error`.

## 남은 제한

- 승인 사전 판정은 웹의 미리보기다. 최종 판정(사람 검토 V6 포함)은 서버 승인 게이트가 하며 거부 이유를 그대로 표시한다.
- 코멘트 상태 변경(PATCH)은 응답 레코드의 `revision`(문서 revision)을 다시 보낸다. 응답에 없으면 1 을 보낸다.
- 작업 응답의 현재 단계는 `current_stage`(schemas) 를 우선 읽고 `stage` 도 받는다. 실패 단계는 `failure.stage`.
- 완료 응답에 `manifest` 가 없으면 `/exports/<경로>/manifest.json` 을 읽어 `design_handoff` 를 보여준다. 정적 파일 제공이 없으면 오류로 표시한다.
- 이미 완료된 화면의 내보내기 경로는 승인 응답에서만 알 수 있어, 새로고침 후에는 "완료 상태" 안내만 남는다(승인 기록 조회 API 없음).
- 페이지→팝업·구조적 재생성 작업 유형, 프로젝트·화면 편집, 수입(XLSX) 은 이 조각의 범위 밖이다.
- 이 패키지의 vitest 는 순수 함수만 검사한다. 브라우저 동작은 루트 `pnpm e2e`(Playwright, `/opt/pw-browsers/chromium` 또는 `PLAYWRIGHT_CHROMIUM_PATH`)가 검사한다.
