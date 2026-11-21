# 00_INDEX — 롯데면세점 화면설계 SSOT 지도

> S2B 방법론 7계층 OS를 롯데면세점(프론트·관리자)으로 이식한 문서 체계의 단일 지도.
> 경로는 저장소 루트 기준. 채움 상태: ✅ 완료 / 🟡 스켈레톤(롯데 PPTX 대기)

## 핵심 축 3가지

- **메커니즘** → `.claude/skills/screen-spec/SKILL.md` (워크벤치 공용)
- **정책·맥락(SSOT)** → `projects/lotte-dutyfree/docs/02_SSOT/{프론트|관리자}_작업가이드.md`
- **명명 규칙** → `projects/lotte-dutyfree/docs/01_규칙/명명규칙.md`

## 문서 목록

| 계층 | 파일 (루트 기준) | 역할 | 상태 |
|------|------|------|:---:|
| — | `방법론/s2b-methodology-study.md` | 방법론 학습 보고서(원리) | ✅ |
| — | `CLAUDE.md` | 워크벤치 작업 규칙·가드레일 | ✅ |
| L0 | `projects/lotte-dutyfree/docs/01_규칙/명명규칙.md` | 화면ID·URL·ID 채번 | 🟡 |
| L0 | `projects/lotte-dutyfree/docs/01_규칙/아키텍처.md` | (옵션) 백엔드 레이어 표준 | 🟡 |
| L1 | `projects/lotte-dutyfree/docs/02_SSOT/프론트_작업가이드.md` | 프론트 권한·흐름·상태·정책·용어 | 🟡 |
| L1 | `projects/lotte-dutyfree/docs/02_SSOT/관리자_작업가이드.md` | 관리자 권한·흐름·상태·정책·용어 | 🟡 |
| L2 | `projects/lotte-dutyfree/docs/03_요구사항/요구사항_추적표.md` | RFP/SFR 추적표 | 🟡 |
| L3 | `projects/lotte-dutyfree/docs/04_공통표준/더미데이터_사전.md` | 고정 캐스트(환각 차단) | 🟡 |
| L3 | `방법론/표준/입력필드_정책.md` | 입력 타입·검증 규격(공용) | ✅ |
| L3 | `projects/lotte-dutyfree/docs/04_공통표준/용어집.md` | 용어 통일 | 🟡 |
| L3 | `방법론/templates/template_screen.html` | 골든 2단 템플릿(공용) | ✅ |
| L4 | `.claude/skills/screen-spec/SKILL.md` | 화면 생산/정합 메커니즘 | ✅ |
| L5 | `.claude/hooks/html-lint.py` | 저장 시 회귀 검출 | ✅ |
| L5 | `scripts/verify_all_pages.py` · `audit_mirror_lr.py` | 전 프로젝트 전수 검증 | ✅ |

## 우선 읽는 순서

1. `방법론/s2b-methodology-study.md` — 방법론 전체 그림
2. `.claude/skills/screen-spec/SKILL.md` — 산출물 규격·생산 메커니즘
3. `docs/02_SSOT/*` — 정책·상태·용어 맥락
4. `docs/03_요구사항/*` + `docs/01_규칙/*` + `docs/04_공통표준/*`

## 롯데 PPTX 도착 시 채울 항목 (TODO)

- [ ] L1: 프론트/관리자 권한 매트릭스·E2E 흐름·상태값·연계 이벤트
- [ ] L2: 요구사항 분류·추적표 (RFP/SFR 수치)
- [ ] L3: 고정 캐스트(브랜드·상품·회원·주문 더미)·용어집
- [ ] L0: 화면ID 규칙·URL 세그먼트(롯데 도메인 기준)
