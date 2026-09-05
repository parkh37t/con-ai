# .claude — 개발용 지침과 선택적 skills

이 폴더는 **Claude Code 로 이 제품을 개발할 때** 쓰는 지침·skill 자리다(설계 §13). 운영 사용자가 입력하는 화면 생성 프롬프트(`packages/prompt-templates`)와 분리한다.

- 개발 규칙 본문은 저장소 루트의 `CLAUDE.md` 에 있다.
- skill 은 반복 작업에만 둔다: 수입 규칙 점검, S2B 프로파일 렌더링 확인, 검증 실행 등. 아직 만들지 않았다.
- 원본 자료(S2B2.zip 의 `.claude/`, apex-office-starter 의 agents/commands)는 참고 대상이며 여기로 복사하지 않는다. 필요한 규칙만 출처와 적용 범위를 확인해 제품 프로파일(`packages/renderer`, `packages/validators`)로 옮긴다.
