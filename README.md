# con-ai — UIUX AI 기획 에이전트

기획자가 브라우저에서 요구사항정의서·IA·정책·AS-IS 분석서를 등록하고, 요구사항과 화면의 관계를 확정한 뒤, 표준 프롬프트로 화면명세와 동작하는 HTML 목업을 만드는 워크스페이스다. HTML 과 함께 **왜 이 화면을 만들었는지, 어떤 요구사항을 어디에서 충족하는지, 무엇을 검증했는지**를 보존한다.

Claude Code 는 이 제품의 **개발 도구**다. 운영 중 사용자의 요청을 처리하는 AI 호출은 서버의 모델 어댑터로 분리한다.

## 온라인 데모

**https://parkh37t.github.io/con-ai/** — 서버 없이 실제 UI 를 그대로 볼 수 있다. `main` 에 push 하면 GitHub Actions 가 자동 배포한다(`.github/workflows/pages.yml`).

> **최초 1회 설정**: 저장소 **Settings → Pages → Build and deployment → Source** 를 `GitHub Actions` 로 바꾼다. Pages 사이트 생성은 저장소 관리자만 할 수 있어 워크플로 토큰으로는 켤 수 없다. 켠 뒤 **Actions → Deploy demo to GitHub Pages → Re-run jobs** 를 누르면 배포된다.

### 4단계 전부 돌려보기 (프로토타입)

**https://parkh37t.github.io/con-ai/#/prototype** — 버튼 네 번으로 ① AS-IS 분석 → ② 화면 생성 → ③ 검토·수정 → ④ 완료(v1.0)·산출물 6파일까지 **서버 없이 끝까지** 돈다. 설치·로그인·API 키가 필요 없다. 자세한 안내는 [프로토타입 가이드](docs/plan/프로토타입_가이드.md).

브라우저 안에서 **실제로 실행되는 것**: 문맥 조립 · 화면명세 스키마·참조 검사 · 목업 렌더 · V1 명세 · V2 구조 · **V3 실행 검사(격리 iframe 에서 CASE 전환·검색·다운로드를 실제로 눌러 본다)** · 승인 게이트 · 산출물 6파일 생성 · AS-IS 페인포인트 규칙 · ID 매핑 커버리지·발번 판정.
**더미인 것**: 화면명세를 쓰는 모델(자격 증명을 넣으면 실제 모델이 쓴다).
**미리 기록해 둔 것**: AS-IS 대상의 페이지 구조·스크린샷(브라우저는 다른 사이트를 캡처할 수 없다).
**여전히 안 되는 것**: 임의 URL 의 AS-IS 분석(정직하게 실패한다) · 팀 공유(결과는 이 브라우저에만 남는다).

데모는 `apps/web/public/demo/` 의 스냅샷(실제 실행 결과: 화면명세·목업 HTML·검증·코멘트·AS-IS 캡처 4장과 샘플 대상 2건)을 초기 상태로 읽는다. 그 위에서 화면 검토·코멘트·페인포인트 채택·생성·수정·완료·**ID 매핑(`#/trace`)의 요구사항 연결·기능 정의·ID 발번**이 모두 동작한다.

`#/trace` 의 커버리지 계산과 발번 판정은 서버와 **같은 규칙**(`@con-ai/domain`)을 브라우저에서 그대로 부른다. 다만 발번·연결 결과는 **이 브라우저(localStorage)에만** 쌓이고 다른 사람에게는 보이지 않는다 — 팀이 함께 쓰는 값으로 남기려면 아래 로컬·사내 서버 실행에서 한다. 화면 상단에 그 사실을 적는다.

스냅샷을 다시 뜨려면 로컬에서 `pnpm demo:snapshot` 을 실행하고 결과를 커밋한다(브라우저와 서버가 필요해 CI 에서는 돌리지 않는다). 배포 전에 배포 주소와 같은 조건으로 열어 보려면 `pnpm demo:build && pnpm demo:serve` → http://127.0.0.1:4321/con-ai/ , 정적 데모 e2e 는 `pnpm e2e:demo` 다.

## 빠른 시작 (어떤 환경에서든 git clone 뒤 한 번)

```bash
git clone https://github.com/parkh37t/con-ai.git && cd con-ai
pnpm bootstrap            # Node 22·pnpm 확인 → 설치 → .env 생성(어댑터·인증 방식 선택) → 브라우저 확인 → 검사
pnpm dev                  # 웹 http://localhost:5173 , API http://localhost:8787 (.env 는 API 가 스스로 읽는다)
```

- 비대화형: `bash scripts/setup.sh --yes` (fixture 더미 어댑터). 실제 모델: `--adapter claude_code`.
- **내 Claude 계정으로 돌리는 것이 1순위다 — API 키도, 토큰 붙여넣기도 없다.** 이 기계에 로그인된
  **Claude Code CLI** 를 서버가 불러 쓴다(`MODEL_ADAPTER=claude_code`). 자격 증명은 우리가 보지 않는다.

  ```bash
  claude                                      # 한 번 로그인 (Pro·Max·Team·Enterprise 구독)
  # .env: MODEL_ADAPTER=claude_code
  pnpm dev                                    # API 가 .env 를 스스로 읽는다 (source 불필요)
  ```

  실측(2026-10): 이 경로로 화면명세 생성이 **87초에 성공**했고 검증 14건 전부 pass 였다. 모델 호출은
  `claude -p --output-format json --json-schema …` 이고, 도구·설정·MCP 를 모두 끈 빈 디렉터리에서 돈다
  (원본 자료를 도구 붙은 세션에 먹이지 않는다).

  > **`ANTHROPIC_AUTH_TOKEN`(구독 토큰) 직접 호출은 더 이상 권하지 않는다.** Anthropic 이 2026-02 부터
  > 구독 OAuth 토큰의 **제3자 도구 사용을 금지**했고, `sk-ant-oat01-…` 을 Messages API 에 보내면
  > `OAuth authentication is currently not supported` 로 거부된다는 보고가 다수다. 그 경로는 남아 있지만
  > (`MODEL_ADAPTER=anthropic` · `MODEL_AUTH=token`) **동작을 보장하지 않는다.**

  API 키(`MODEL_ADAPTER=anthropic` · `MODEL_AUTH=api_key` · `ANTHROPIC_API_KEY`, platform.claude.com)는
  사용한 만큼 과금되는 대안이다. 값은 `.env` 에만 두고 커밋하지 않는다.
- Claude Code 로 이 저장소를 열면 `.claude/hooks/session-start.sh` 가 같은 세팅을 자동으로 수행한다.

## 현재 상태

**세로 조각 v0 동작**: 샘플 프로젝트(와일리 컨버전스 파트너 견적 포털, 가상)로 다음 흐름이 브라우저에서 끝까지 돌아간다.

1. 생성 작업대에서 대상 화면·작업 유형·목적·수용조건·참고 화면(레퍼런스 포트폴리오)·CASE·유지 조건을 입력 → 자동 조립 프롬프트 미리보기 → 실행
2. 서버 파이프라인: 문맥 구성 → 모델 어댑터(anthropic 실제 호출 또는 fixture 더미) → 화면명세 스키마·참조 검사 → HTML 목업 + 우측 설명 렌더 → V1 명세·V2 구조·V3 실행(Playwright) 검증 → 저장 (새로고침 후 유지)
3. 화면 검토: 격리 iframe 미리보기, CASE·PC/모바일 전환, 요소·설명 클릭 코멘트(역할·차단 여부), 검증 결과 표
4. 수정: 코멘트 선택 → AI 수정 프롬프트 초안 또는 직접 입력 → 단건 수정 → 새 revision, 코멘트 해결
5. 완료: 승인 판정(필수 검사 pass, hash 일치, 차단 코멘트 0) → v1.0 → `exports/<프로젝트>/<화면>/v1.0/` 에 index.html·spec·trace·validation·comments·manifest(디자인 이관 필드)

**AS-IS 분석(①) 동작**: URL 을 입력하면 Playwright 로 방문해 데스크톱·모바일 스크린샷과 페이지 구조를 수집하고, 어댑터가 페인포인트 초안을 만들며, 기획자가 채택/거부로 확정한다. 외부 네트워크 없이 시연할 수 있도록 합성 레거시 페이지 `/asis-sample` 을 제공한다.

다음 단계는 `docs/plan/구현계획.md` (채택한 페인포인트 → 요구사항 연결, 다중 화면·프로젝트, V4·V5, 사용자별 계정 인증(`docs/decisions/0014`), 디자인 에이전트 연계).

## 문서 안내

| 경로 | 내용 |
|---|---|
| `CLAUDE.md` | 개발 규칙: 제품 목적, 실행·검사 방법, 원본 불변, 임의 ID 변경 금지, 실패를 pass 로 표시하지 않는 규칙, 허용 수정 범위 |
| `AGENTS.md` | 같은 내용을 `AGENTS.md` 를 읽는 에이전트(OpenAI Codex 등)용으로 정리한 것. **규칙 본문은 `CLAUDE.md`** 이고 이쪽은 파생이다 |
| `.claude/skills/` | Claude Code 용 skill 3개: 명세 어휘 추가 · 배포 전 점검 · ID 와 추적 체인 |
| `docs/plan/세션_통합프롬프트.md` | 한 세션의 요청 전체를 붙여 넣을 수 있는 하나의 프롬프트로 합친 것 |
| `docs/reference/` | 구현 기준 원본 문서 3종 (구현설계 v0.2, 첨부자료 검토보고서 v0.2, 개발시작 프롬프트 v0.2). 수정하지 않는다 |
| `docs/knowledge/` | 원본을 관점별로 학습·검증한 지식 문서 (출처 표기) |
| `docs/decisions/` | 착수 시 고정한 결정 기록(ADR) |
| `docs/plan/` | MVP 구현 계획·완료 조건·미확정 목록 |
| `data/review/` | 검토 데이터(CSV·JSON). 공개 저장소이므로 고객 데이터는 커밋하지 않는다 → `data/review/README.md` |
| `fixtures/` | 합성 데이터와 실패 예제 (충돌·중복·누락 CASE) |

### 다른 에이전트에 학습시키기

```bash
pnpm bundle:knowledge
# → .bundle/files/                              개별 파일 34개 (ASCII 이름, 번호가 읽는 순서)
# → .bundle/con-ai-learning-bundle-<날짜>.md     전부 이어 붙인 단일 파일
```

`AGENTS.md` · `CLAUDE.md` · skills · 통합 프롬프트 · `docs/knowledge|decisions|plan` · 패키지 README 를 모은다.
ChatGPT 등에는 **단일 합본 한 파일**을 올리고, Codex 가 저장소에서 작업할 때는 **연결만 하면 된다**(루트 `AGENTS.md` 를 자동으로 읽는다).
원본 입력자료(`docs/reference/`, `data/review/*.csv`)는 담지 않는다 — 제자리에서 읽는다. zip 으로 묶지 않는다(한국어 파일명이 깨진다).

## 저장소 구조 (설계 §13)

```text
apps/web/                   브라우저 작업대
apps/api/                   권한·편집·승인 API
workers/generation/         단계별 생성 실행
packages/domain/            ID·버전·매핑 규칙
packages/schemas/           입력·ScreenSpec·검증 결과 스키마
packages/importers/         XLSX·MD·INDEX·CSV 읽기
packages/prompt-templates/  버전 관리된 프롬프트
packages/renderer/          컴포넌트·shell·설명 렌더링
packages/validators/        구조·동작·추적 검사
fixtures/                   합성 데이터와 실패 예제
docs/                       제품 결정·계약·수용조건
.claude/                    개발용 지침과 선택적 skills
```

## 실행·검사

```bash
pnpm install          # Node 22, pnpm 10.33 (package.json 의 packageManager)
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest run (테스트 파일이 없으면 실패한다)
pnpm check            # 위 둘을 순서대로
```

데모·프로토타입은 더미 어댑터로 자격 증명 없이 끝까지 돈다. 아래는 **선택 사항**으로, 「실제 Claude 모델도 새 어휘를 쓰는가」를 볼 때만 쓴다 (비결정적이고 유료라 `pnpm check` 에 넣지 않는다):

```bash
# .env 는 API 가 스스로 읽는다. 셸에 이미 있는 환경변수가 파일보다 우선한다
MODEL_ADAPTER=anthropic pnpm probe:vocab    # 모델이 히어로·KPI 인포스트립·카드 그리드를 실제로 쓰는지
```

자격 증명이 없으면 전 항목을 `not_run` 으로 적고 끝난다 — 돌지 않은 검사를 통과로 표시하지 않는다.

검사 결과는 `pass / fail / error / not_run` 을 구분한다. 실행되지 않은 검사(예: 검토 데이터가 없어 건너뛴 테스트)는 통과로 표시하지 않는다.
