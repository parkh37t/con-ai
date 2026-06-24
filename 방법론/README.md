# 방법론 코어 (프로젝트 무관)

S2B에서 검증된 **AI 화면설계 생산 방법론(7계층 OS)**의 재사용 자산. 모든 `projects/<name>/`가 이 코어를 공유한다.

## 구성

| 파일 | 역할 |
|------|------|
| `s2b-methodology-study.md` | ★ 7계층 OS 학습 보고서 (방법론 원리 전체) |
| `templates/template_screen.html` | 골든 2단 템플릿 — 신규 화면은 이걸 복제→개조 |
| `표준/입력필드_정책.md` | 공용 입력 컴포넌트 표준 (타입·검증·포맷) |

## 7계층 OS 요약

```
L7 프롬프트 규율   "언급 외 코드 보존" 가드레일      → CLAUDE.md §3
L6 협업 파이프라인  기획자↔오퍼레이터, 폴더 큐
L5 자동 검증       html-lint 훅 + verify/audit 스크립트 → .claude/hooks · scripts/
L4 커스텀 스킬     골든 복제→개조 메커니즘            → .claude/skills/screen-spec
L3 산출물 규격     2단 템플릿 + 더미사전 + 입력정책    → 방법론/ · projects/*/docs/04
L2 요구사항        RFP/SFR 추적표                    → projects/*/docs/03
L1 SSOT 도메인     포털별 작업가이드                 → projects/*/docs/02 (가장 중요)
L0 전역 규칙       명명·URL·아키텍처                 → projects/*/docs/01
```

> 도메인 무관 자산은 여기(`방법론/`)에, 프로젝트별 콘텐츠(SSOT·요구사항·더미데이터·화면)는 `projects/<name>/`에 둔다.
