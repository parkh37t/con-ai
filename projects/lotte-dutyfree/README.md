# 롯데면세점 화면설계 (lotte-dutyfree)

S2B 방법론 OS를 적용한 **롯데면세점 프론트·관리자** 화면설계 프로젝트.

| 항목 | 내용 |
|------|------|
| 도메인 | 롯데면세점 (Lotte Duty Free) |
| 포털 | 프론트(고객) · 관리자(운영) |
| 파일 프리픽스 | `front-` · `admin-` |
| 산출물 | 단일 HTML 2단 화면설계서 (좌 화면 + 우 사양서) |
| 상태 | 부트스트랩 — 도메인 콘텐츠(L1/L2/L3)는 PPTX 대기 |

## 구조
```
projects/lotte-dutyfree/
├── index.html            프로토타입 인덱스
├── docs/
│   ├── 00_INDEX.md        SSOT 지도
│   ├── 01_규칙/           명명·아키텍처 (L0)
│   ├── 02_SSOT/           프론트·관리자 작업가이드 (L1) ★
│   ├── 03_요구사항/        요구사항 추적표 (L2)
│   └── 04_공통표준/        더미데이터·용어집 (L3)
└── 화면설계/
    ├── 프론트/  관리자/  _공통/
```

## 작업 순서
1. `docs/02_SSOT/*` 정독 (권한·흐름·상태·정책·용어 — 가장 중요)
2. `screen-spec` 스킬로 `방법론/templates/template_screen.html` 복제→개조
3. `python3 .claude/hooks/html-lint.py` + `scripts/verify_all_pages.py` 검증

## PPTX 도착 시 채울 것
- [ ] L1 SSOT: 권한 매트릭스·E2E·상태값·연계 이벤트
- [ ] L2: 요구사항 분류·추적
- [ ] L3: 고정 캐스트(브랜드·상품·회원·주문)·용어집
