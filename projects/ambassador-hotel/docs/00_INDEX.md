# 00_INDEX — 앰배서더 호텔 화면설계 SSOT 지도

> S2B 방법론 7계층 OS를 앰배서더 호텔(프론트·관리자)로 이식한 문서 체계의 단일 지도.
> 경로는 저장소 루트 기준. 채움 상태: ✅ 완료 / 🟢 인테이크 확보 / 🟡 스켈레톤(RFP 대기)

## 핵심 축 3가지

- **메커니즘** → `.claude/skills/screen-spec/SKILL.md` (워크벤치 공용)
- **정책·맥락(SSOT)** → `projects/ambassador-hotel/docs/02_SSOT/{프론트|관리자}_작업가이드.md`
- **명명 규칙** → `projects/ambassador-hotel/docs/01_규칙/명명규칙.md`

## 문서 목록

| 계층 | 파일 (루트 기준) | 역할 | 상태 |
|------|------|------|:---:|
| 입력 | `projects/ambassador-hotel/docs/00_입력원본/` | **RFP·요구사항서 투입소** | 🟡 |
| L0 | `projects/ambassador-hotel/docs/01_규칙/명명규칙.md` | 화면ID·URL·ID 채번 | 🟡 |
| L1 | `projects/ambassador-hotel/docs/02_SSOT/프론트_작업가이드.md` | 고객 권한·흐름·상태·정책 | 🟡 |
| L1 | `projects/ambassador-hotel/docs/02_SSOT/관리자_작업가이드.md` | 운영 권한·흐름·상태·정책 | 🟡 |
| L2 | `projects/ambassador-hotel/docs/03_요구사항/요구사항_추적표.md` | RFP/SFR 추적표 | 🟡 |
| L3 | `projects/ambassador-hotel/docs/04_공통표준/더미데이터_사전.md` | 고정 캐스트(환각 차단) | 🟡 |
| L3 | `projects/ambassador-hotel/docs/04_공통표준/용어집.md` | 용어 통일 | 🟡 |
| L3 | `방법론/templates/template_screen.html` | 골든 2단 템플릿(공용) | ✅ |
| 리서치 | `projects/ambassador-hotel/IA/as-is-ia.html` | As-Is 정보구조 | 🟢 |
| 리서치 | `projects/ambassador-hotel/inventory/index.html` | 화면 본수 카탈로그 | 🟢 |
| 리서치 | `projects/ambassador-hotel/benchmark/benchmark-report.html` | 경쟁 벤치마킹·페인포인트 | 🟢 |
| L4 | `.claude/skills/screen-spec/SKILL.md` | 화면 생산/정합 메커니즘 | ✅ |
| L5 | `scripts/verify_all_pages.py` · `audit_mirror_lr.py` | 전수 검증 | ✅ |

## 우선 읽는 순서

1. `docs/00_입력원본/README.md` — **RFP·요구사항서 투입 방법**
2. `방법론/s2b-methodology-study.md` — 방법론 전체 그림
3. `.claude/skills/screen-spec/SKILL.md` — 산출물 규격
4. `IA/` · `inventory/` · `benchmark/` — 확보된 As-Is 리서치
5. `docs/02_SSOT/*` — 정책·상태·용어 (RFP 확정 후 채움)

## RFP 도착 시 채울 항목 (TODO)

- [ ] L1: 프론트/관리자 권한 매트릭스·예약 E2E 흐름·상태값
- [ ] L2: 요구사항 분류·추적표 (RFP/SFR 수치)
- [ ] L3: 고정 캐스트(객실·요금·고객·다이닝 더미)·용어집
- [ ] L0: 화면ID 규칙·URL 세그먼트(앰배서더 도메인 기준)
