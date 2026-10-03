# .claude — 개발용 지침과 skills

이 폴더는 **Claude Code 로 이 제품을 개발할 때** 쓰는 지침·skill 자리다(설계 §13). 운영 사용자가 입력하는 화면 생성 프롬프트(`packages/prompt-templates`)와 분리한다.

- 개발 규칙 본문은 저장소 루트의 `CLAUDE.md` 에 있다. **skill 보다 그것이 먼저다.**
- 원본 자료(S2B2.zip 의 `.claude/`, apex-office-starter 의 agents/commands)는 참고 대상이며 여기로 복사하지 않는다. 필요한 규칙만 출처와 적용 범위를 확인해 제품 프로파일(`packages/renderer`, `packages/validators`)로 옮긴다.

## skills

반복 작업과 **실제로 데인 함정**만 둔다. 설명문을 옮겨 적는 자리가 아니다.

| skill | 언제 읽히나 |
|---|---|
| `명세-어휘-추가` | ScreenSpec 의 허용 컴포넌트·동작을 추가·변경할 때. 스키마 → wire → 구조화 출력 → 프롬프트 → 더미 어댑터 → 렌더러 → 설명 → CSS → 검증 → 골든 예시의 10단계 사슬 |
| `배포-전-점검` | 푸시·배포 전. 검사 순서, 데모 스냅샷을 다시 떠야 하는 때, `pass/fail/error/not_run` 규율 |
| `ID와-추적체인` | ID 의 안팎이 헷갈릴 때. 내부 UUID ↔ 외부 ID, IA·FN 발번, 메뉴↔화면 연결, REQ→IA→FN→SCR |

skill 을 더하면 `scripts/bundle-knowledge.mjs` 의 매니페스트에도 한 줄 적는다(안 적으면 묶음에서 조용히 빠진다 — 스크립트가 경고는 한다).

## 다른 에이전트 — AGENTS.md

저장소 루트의 `AGENTS.md` 는 **OpenAI Codex 등 `AGENTS.md` 를 읽는 에이전트**용이다. Codex 는 `CLAUDE.md` 도 이 폴더도 읽지 않는다.
**규칙 본문은 `CLAUDE.md`** 이고 `AGENTS.md` 는 그중 작업하다 데이는 것을 앞으로 끌어낸 것이다. `CLAUDE.md` 의 규칙을 고치면 `AGENTS.md` 도 같이 본다.

## 학습 문서·skill 묶음

```bash
pnpm bundle:knowledge
# → .bundle/files/                               개별 파일 34개 (ASCII 이름, 번호가 읽는 순서)
# → .bundle/con-ai-learning-bundle-<날짜>.md      전부 이어 붙인 단일 파일
```

`AGENTS.md` · `CLAUDE.md` · skills · 세션 통합 프롬프트 · `docs/knowledge|decisions|plan` · 패키지 README 를 모은다.

- **zip 으로 묶지 않는다.** 한국어 파일명을 zip 에 담으면 UTF-8 플래그가 꺼져 윈도·맥 기본 해제기가 목록을 못 읽는다(실제로 겪었다). 그래서 파일명도 ASCII 로 둔다 — 내용은 전부 한국어다.
- 원본 입력자료(`docs/reference/`, `data/review/*.csv`)는 **담지 않는다** — 제자리에서 읽는다.

## 세션 통합 프롬프트

`docs/plan/세션_통합프롬프트.md` 는 한 세션의 요청 전체를 **붙여 넣을 수 있는 하나의 프롬프트**로 합친 것이다.
대화 기록이 아니다. 「무엇을 시켰나」는 그 파일이고, 「무엇이 됐나」는 `docs/plan/진행기록.md` 다.

## hooks

`hooks/session-start.sh` 가 세션 시작 때 Node·pnpm 확인 → 설치 → `.env` 생성을 수행한다(`scripts/setup.sh` 와 같은 세팅).
