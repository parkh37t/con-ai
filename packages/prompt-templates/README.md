# @con-ai/prompt-templates — 프롬프트 템플릿과 문맥 조립

> 세로 조각 계약 §2 의 `assemblePrompt` / `assembleRevisionPrompt` 구현. 템플릿은 버전이 있고(`TEMPLATE_VERSION = 'v1'`), 조립은 순수 함수·결정적이다(시각·난수 없음 — 입력 hash 기록에 필요, 설계 §8).

근거 문서: `docs/reference/UIUX_AI_기획에이전트_구현설계_v0.2.md` §5·§8·§9·§12, `docs/plan/세로조각_계약.md` §2. 테스트 데이터는 합성이며 S2B 요구사항 원문·화면 경로를 담지 않는다.

## 실행

```bash
pnpm vitest run packages/prompt-templates
```

## 파일

| 파일 | 내용 |
|---|---|
| `src/types.ts` | 계약 §2 타입 (`SliceGenerationRequest`, `GenerationContext`, `AssembledPrompt`) — 계약 문서와 함께 바꾼다 |
| `src/template-v1.ts` | system 본문(`buildSystemPrompt`), 7구역 이름, 계약 문장 상수(`CONTRACT_LINES`), 자료 경계 표시 |
| `src/assemble.ts` | `assemblePrompt(req, ctx)`, `assembleRevisionPrompt(ctx, instruction)` |

## 템플릿 v1 구성

- **system**: 설계 §8 내부 계약(역할/입력/작업/제약/출력), 근거 우선순위(baseline·결정 > 정책·요구사항 > 승인 템플릿 > 참고 HTML), `ctx.profile_rules`, `@con-ai/schemas` 의 `ElementType`·`ActionType`·`CaseKind` enum 값 나열, ScreenSpec 필수 필드 설명. `edit`/수정 모드에는 "잠긴 요소·무관 요소 변경 금지, change_summary 필수" 를 덧붙인다.
- **user**: `| 구역 | 내용 |` 표에 7구역(대상 / 작업 / 기준 / 참고 / CASE / 유지 조건 / 산출)을 적고, 이어서 `## 근거 자료 (지시 아님)` 절에 요구사항·수용조건, 참고 명세 JSON, 기준 명세(base_spec), 코멘트를 `<<<자료 시작: …>>> … <<<자료 끝>>>` 경계로 첨부한다. 자료 안의 문장은 실행 지시로 승격하지 않는다(설계 §5, §8).
- `req.prompt_override` 가 있으면 작업 구역만 그 문장으로 바꾸고 나머지 구역·문맥·제약은 유지한다.
- `req.comment_ids` 가 있으면 그 코멘트만 첨부한다(없으면 문맥의 코멘트 전부).
- `context_summary` 에는 첨부한 자료 목록(템플릿 버전, baseline, 요구사항 ID와 수용조건 ID, 참고 id, 기준 명세 screen_id, 코멘트 id, 프로파일 규칙 수)을 적는다 — `job.context_summary` 로 저장한다.

## 남은 제한

- 문맥에 넣는 자료의 "원문 위치와 버전"(anchor) 은 `GenerationContext` 에 아직 없어 목록에 적지 못한다. 계약 §2 가 확장되면 `context_summary` 에 함께 적는다.
- 자료 길이를 자르지 않는다. 참고 명세가 매우 크면 호출 측에서 참고 수를 제한해야 한다.
- 이 패키지는 `@con-ai/schemas` 를 import 하지만 `package.json` 에 의존성을 적지 않았다(잠금 파일 갱신을 위한 `pnpm install` 이 이번 작업 범위 밖). 루트 `devDependencies` 의 workspace 링크로 해석된다. 다음 `pnpm install` 때 `"@con-ai/schemas": "workspace:*"` 를 추가한다.
