# con-ai — UIUX AI 기획 에이전트

기획자가 브라우저에서 요구사항정의서·IA·정책·AS-IS 분석서를 등록하고, 요구사항과 화면의 관계를 확정한 뒤, 표준 프롬프트로 화면명세와 동작하는 HTML 목업을 만드는 워크스페이스다. HTML 과 함께 **왜 이 화면을 만들었는지, 어떤 요구사항을 어디에서 충족하는지, 무엇을 검증했는지**를 보존한다.

Claude Code 는 이 제품의 **개발 도구**다. 운영 중 사용자의 요청을 처리하는 AI 호출은 서버의 모델 어댑터로 분리한다.

## 현재 상태

**준비 단계(0)**: 참고자료 학습, 개발 규칙(`CLAUDE.md`), 지식 문서, 결정 기록, 구현 계획, 스키마 초안, fixture, 모노레포 골격까지 완료. 설계 §14 의 단계 1(자료·ID·버전·매핑 기반)부터 구현을 시작할 수 있다. 자세한 진행 상태와 남은 제한은 `docs/plan/` 을 본다.

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
