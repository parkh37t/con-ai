# con-ai — UIUX AI 기획 에이전트

기획자가 브라우저에서 요구사항정의서·IA·정책·AS-IS 분석서를 등록하고, 요구사항과 화면의 관계를 확정한 뒤, 표준 프롬프트로 화면명세와 동작하는 HTML 목업을 만드는 워크스페이스다. HTML 과 함께 **왜 이 화면을 만들었는지, 어떤 요구사항을 어디에서 충족하는지, 무엇을 검증했는지**를 보존한다.

Claude Code 는 이 제품의 **개발 도구**다. 운영 중 사용자의 요청을 처리하는 AI 호출은 서버의 모델 어댑터로 분리한다.

## 빠른 시작 (어떤 환경에서든 git clone 뒤 한 번)

```bash
git clone https://github.com/parkh37t/con-ai.git && cd con-ai
pnpm bootstrap            # Node 22·pnpm 확인 → 설치 → .env 생성(어댑터·인증 방식 선택) → 브라우저 확인 → 검사
set -a; source .env; set +a
pnpm dev                  # 웹 http://localhost:5173 , API http://localhost:8787
```

- 비대화형: `bash scripts/setup.sh --yes` (fixture 더미 어댑터). 실제 모델: `--adapter anthropic --auth api_key` 또는 `--auth token`.
- 모델 인증은 두 방식 모두 지원한다: **API 키**(`ANTHROPIC_API_KEY`) 또는 **토큰**(`ANTHROPIC_AUTH_TOKEN`, Bearer). `.env` 에만 두고 커밋하지 않는다.
- Claude Code 로 이 저장소를 열면 `.claude/hooks/session-start.sh` 가 같은 세팅을 자동으로 수행한다.

## 현재 상태

**세로 조각 v0 동작**: 샘플 프로젝트(와일리 컨버전스 파트너 견적 포털, 가상)로 다음 흐름이 브라우저에서 끝까지 돌아간다.

1. 생성 작업대에서 대상 화면·작업 유형·목적·수용조건·참고 화면(레퍼런스 포트폴리오)·CASE·유지 조건을 입력 → 자동 조립 프롬프트 미리보기 → 실행
2. 서버 파이프라인: 문맥 구성 → 모델 어댑터(anthropic 실제 호출 또는 fixture 더미) → 화면명세 스키마·참조 검사 → HTML 목업 + 우측 설명 렌더 → V1 명세·V2 구조·V3 실행(Playwright) 검증 → 저장 (새로고침 후 유지)
3. 화면 검토: 격리 iframe 미리보기, CASE·PC/모바일 전환, 요소·설명 클릭 코멘트(역할·차단 여부), 검증 결과 표
4. 수정: 코멘트 선택 → AI 수정 프롬프트 초안 또는 직접 입력 → 단건 수정 → 새 revision, 코멘트 해결
5. 완료: 승인 판정(필수 검사 pass, hash 일치, 차단 코멘트 0) → v1.0 → `exports/<프로젝트>/<화면>/v1.0/` 에 index.html·spec·trace·validation·comments·manifest(디자인 이관 필드)

다음 단계는 `docs/plan/구현계획.md` (AS-IS 분석 에이전트, 다중 화면·프로젝트, V4·V5, 디자인 에이전트 연계).

## 문서 안내

| 경로 | 내용 |
|---|---|
| `CLAUDE.md` | 개발 규칙: 제품 목적, 실행·검사 방법, 원본 불변, 임의 ID 변경 금지, 실패를 pass 로 표시하지 않는 규칙, 허용 수정 범위 |
| `docs/reference/` | 구현 기준 원본 문서 3종 (구현설계 v0.2, 첨부자료 검토보고서 v0.2, 개발시작 프롬프트 v0.2). 수정하지 않는다 |
| `docs/knowledge/` | 원본을 관점별로 학습·검증한 지식 문서 (출처 표기) |
| `docs/decisions/` | 착수 시 고정한 결정 기록(ADR) |
| `docs/plan/` | MVP 구현 계획·완료 조건·미확정 목록 |
| `data/review/` | 검토 데이터(CSV·JSON). 공개 저장소이므로 고객 데이터는 커밋하지 않는다 → `data/review/README.md` |
| `fixtures/` | 합성 데이터와 실패 예제 (충돌·중복·누락 CASE) |

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

검사 결과는 `pass / fail / error / not_run` 을 구분한다. 실행되지 않은 검사(예: 검토 데이터가 없어 건너뛴 테스트)는 통과로 표시하지 않는다.
