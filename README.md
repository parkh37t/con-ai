# con-ai — 화면설계 방법론 워크벤치

S2B 전자조달 재구축에서 검증된 **AI 화면설계 생산 방법론(7계층 운영체계)**을 코어로 두고, **여러 프로젝트의 화면설계를 테스트·프로토타이핑하고 S2B처럼 GitHub Pages로 배포**하는 워크벤치입니다.

## 구조

| 영역 | 위치 | 설명 |
|------|------|------|
| 방법론 코어 | `방법론/` | 7계층 OS 학습 보고서·골든 템플릿·공용 표준 (프로젝트 무관) |
| 공용 스킬/훅 | `.claude/` | `screen-spec` 스킬 + `html-lint` 훅 |
| 일괄 검증 | `scripts/` | 전 프로젝트 화면 전수 검증 |
| 프로젝트들 | `projects/<name>/` | 각 프로젝트 인스턴스(SSOT·요구사항·화면설계) |
| Pages | `index.html` · `.github/workflows/pages.yml` | 프로젝트 카탈로그 + 자동 배포 |

## 프로젝트

| 프로젝트 | 도메인 | 상태 |
|---------|--------|------|
| [`lotte-dutyfree`](projects/lotte-dutyfree/) | 롯데면세점 (프론트·관리자) | 부트스트랩 (도메인 콘텐츠는 PPTX 대기) |

## 시작하기

1. 방법론 이해 → [`방법론/s2b-methodology-study.md`](방법론/s2b-methodology-study.md)
2. 작업 규칙 → [`CLAUDE.md`](CLAUDE.md)
3. 화면 생산법 → [`.claude/skills/screen-spec/SKILL.md`](.claude/skills/screen-spec/SKILL.md)
4. 새 프로젝트 추가 → `CLAUDE.md` §1

## GitHub Pages

저장소 Settings → Pages → Source = **GitHub Actions** 설정 시, push마다 `index.html`(프로젝트 카탈로그)과 각 프로젝트 프로토타입이 자동 배포됩니다.
