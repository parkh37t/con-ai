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
| `#/` | 메인 (랜딩) | 히어로(«설계서 만들기»·«예시 열어보기») → 4단계 프로세스 카드(각 카드에 «지금 가능»/«서버 실행 필요» 표시) → 최근 만든 설계서 → 시작 안내(«Claude API 키 받는 법» 접이식, `#/?help=key` 로 펼친 채 열림). 시각 언어는 `packages/renderer` 의 설계서와 같다 |
| `#/new?job=&screen=` | 만들기 | 문장 한 줄 + 기기 토글 → «설계서 만들기»(화면 자동 생성 + 생성 작업). 진행·실패는 한 줄, 자동으로 채운 값은 «무엇을 자동으로 채웠나» |
| `#/d/:revisionId?job=` | 설계서 결과 | 설계서 HTML iframe(격리), 버전 칩, 이름 수정, 한 줄 «수정», HTML 다운로드, «자세히»(검토 화면) |
| `#/advanced?project=` | 프로젝트 홈 | 요구사항·수용조건(UI/비UI), To-Be IA 트리, 화면 목록(외부 ID·shell·상태·버전·revision·열린 코멘트, 생성/검토/완료 링크). fixture 어댑터면 `.env` 안내 한 줄 |
| `#/asis`, `#/asis/:id` | AS-IS 분석 | 대상 URL 실행·목록, 상세(스크린샷·구조 요약·페인포인트 채택/거부) |
| `#/references` | 레퍼런스 포트폴리오 | 골든 예시 카드(분류·태그·S2B 학습 규격), 선택 시 spec 요약(영역·요소·CASE) |
| `#/screens/:id/generate?job=` | 생성 작업대 | 작업 유형·목적·범위·요구사항/수용조건·참고 화면·CASE·유지 조건·역할·기기·직접 프롬프트 → 프롬프트 미리보기(`/prompt-preview`) → 생성 실행(`/generation-jobs` 202) → 작업 상태(2초 폴링, 단계 진행, 실패 원인). `?job=` 이 URL 에 남아 새로고침 후에도 상태를 다시 읽는다 |
| `#/screens/:id/review?rev=&job=` | 화면 검토 | revision 목록(검증 요약 pass/fail/error/not_run, artifact 상태, 열린 코멘트) → 격리 iframe + CASE 버튼(`con-ai:set-case`) + PC 1280/모바일 420 → 요소 클릭(`con-ai:element-click`) → 코멘트 폼 → 코멘트 목록·상태 변경(강조 `con-ai:highlight`) → 검증 결과 표·재검증 → 수정 요청(코멘트 선택 → AI 수정 프롬프트 초안 또는 직접 입력 → 단건 수정 실행 → 새 revision) |
| `#/screens/:id/approve?rev=` | 완료·내보내기 | 승인 사전 판정(검증 요약, 열린 차단 코멘트, 이유), 승인자 → 완료(v1.0) → 내보내기 경로·파일 링크(`/exports/...`)·index.html 열기·manifest `design_handoff` |

메인·만들기·결과 화면은 각자 얇은 상단 바를 쓰고(브랜드 + 자격 증명·어댑터 칩 + «고급»), 그 밖의 화면은 공용 상단 바를 쓴다: 프로젝트명, 어댑터 배지(`anthropic · 모델 · 인증 방식` 실제 호출 / `fixture 더미 어댑터(모델 호출 없음)`), Playwright 가능 여부.

## 브라우저 모드 (정적 배포 전용, `VITE_DEMO=1`)

GitHub Pages 같은 정적 주소에서 사용자가 자기 Claude 자격 증명을 넣으면 **브라우저가 직접 `api.anthropic.com` 을 호출해** 생성한다(서버 없음). 자세한 범위·보안·한계는 `docs/plan/브라우저모드.md`.

- `src/browser-run/` — `credential.ts`(자격 증명 보관: 기본 sessionStorage, 선택 시 localStorage), `anthropic.ts`(직접 호출 + 손으로 쓴 JSON Schema), `pipeline.ts`(서버와 같은 단계 이름), `store.ts`(`con-ai:browser:` 저장), `artifact-urls.ts`(Blob 미리보기), `export-bundle.ts`(6파일 다운로드), `runtime.ts`(주입 지점), `deps.ts`(워크스페이스 모듈 반입 지점).
- 자격 증명이 없으면 지금까지의 스냅샷 데모 그대로다. 있으면 `/api/meta` 가 `adapter: 'anthropic', playwright: false` 로 바뀌고 생성·수정·프롬프트 미리보기가 실제 모델을 쓴다.
- 브라우저에서 못 하는 일은 위장하지 않는다: V3 실행 검사는 `not_run`(그래서 완료 v1.0 승인은 거부되고 산출물은 파일 다운로드로 대체), AS-IS 새 URL 분석은 실패.
- 일반 빌드(서버 모드)에는 이 코드가 들어가지 않는다 — `api.ts` 가 데모 핸들러를 동적 import 로 분리한다.

## 파일

- `src/api.ts` — 계약 §7 엔드포인트 함수. 오류는 `ApiError{status, reasons}` 로 화면에 표시.
- `src/types.ts` — 계약 §1·§2 필드 기준 응답 타입 (다른 패키지 import 없음).
- 순수 로직(vitest, DOM 불필요): `router.ts`(라우트 파싱·링크), `job-progress.ts`(단계 진행), `summary.ts`(검증 요약·승인 사전 판정·IA 트리·spec 요약), `preview-messages.ts`(postMessage 프로토콜), `export-paths.ts`(내보내기 링크), `generation-form.ts`(폼 → 요청), `adapter-badge.ts`(배지 문구), `main-steps.ts`(메인의 4단계 카드·실행 모드별 가능 여부).
- `src/hooks.ts` — 해시 라우트, 비동기 로딩, 작업 폴링, 자격 증명 변경 알림(`useCredentialTick`).
- `src/pages/*` — 화면 5개, `src/components/*` — 상단 바·배지·작업 상태 패널·레퍼런스 카드.

## 검사

```bash
pnpm --filter @con-ai/web build
pnpm vitest run apps/web
pnpm typecheck          # 루트 tsconfig 가 apps/web/src 를 함께 검사한다 (strict)
pnpm e2e                # 루트 e2e/slice.spec.ts — API·웹을 띄워 생성→검토→수정→완료→내보내기→재승인 거부를 실제 브라우저로 확인
```

e2e 는 `data-testid` 로 요소를 찾는다(문구 변경에 영향받지 않게). 주요 id: `adapter-badge`, `screen-row`, `purpose`, `criterion-<AC id>`, `case-<kind>`, `preview-button`, `run-button`, `job-status`, `preview-iframe`, `case-button-<id>`, `comment-*`, `validation-row`, `revision-row`, `draft-button`, `edit-prompt`, `run-edit-button`, `approve-button`, `export-result`, `export-file`, `approve-error`. 브라우저 모드: `cred-panel`, `cred-kind-token`/`cred-kind-api-key`, `cred-value`, `cred-persist`, `cred-save`, `cred-clear`, `cred-status`, `browser-mode-hint`, `v3-not-run-note`, `browser-export`, `browser-export-build`, `browser-export-file`.

## 남은 제한

- 승인 사전 판정은 웹의 미리보기다. 최종 판정(사람 검토 V6 포함)은 서버 승인 게이트가 하며 거부 이유를 그대로 표시한다.
- 코멘트 상태 변경(PATCH)은 응답 레코드의 `revision`(문서 revision)을 다시 보낸다. 응답에 없으면 1 을 보낸다.
- 작업 응답의 현재 단계는 `current_stage`(schemas) 를 우선 읽고 `stage` 도 받는다. 실패 단계는 `failure.stage`.
- 완료 응답에 `manifest` 가 없으면 `/exports/<경로>/manifest.json` 을 읽어 `design_handoff` 를 보여준다. 정적 파일 제공이 없으면 오류로 표시한다.
- 이미 완료된 화면의 내보내기 경로는 승인 응답에서만 알 수 있어, 새로고침 후에는 "완료 상태" 안내만 남는다(승인 기록 조회 API 없음).
- 페이지→팝업·구조적 재생성 작업 유형, 프로젝트·화면 편집, 수입(XLSX) 은 이 조각의 범위 밖이다.
- 브라우저 모드는 이 저장소에서 **실제 모델 호출을 검증하지 못했다**(개발 컨테이너의 브라우저는 외부 네트워크가 막혀 있다). 모든 검사는 fetch 를 주입해 동작을 재현한다 — 미검증 항목은 `docs/plan/브라우저모드.md` §6.
- 이 패키지의 vitest 는 순수 함수와 브라우저 모드 단위 검사만 한다. 브라우저 동작은 루트 `pnpm e2e`(Playwright, `/opt/pw-browsers/chromium` 또는 `PLAYWRIGHT_CHROMIUM_PATH`)가 검사한다.
