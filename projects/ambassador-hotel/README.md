# 앰배서더 호텔 — 화면설계 프로젝트

> con-ai 워크벤치의 프로젝트 인스턴스. 와일리 OS로 RFP·요구사항서 입력 → 2단 HTML 화면설계서 양산.

## 현재 단계

- ✅ **인테이크 리서치 확보**: As-Is IA · 화면 본수 카탈로그 · 경쟁 벤치마킹
- 🟡 **RFP 투입 대기**: `docs/00_입력원본/`에 RFP·요구사항서를 넣으면 SSOT 채움 → 화면 양산

## 구조

```
ambassador-hotel/
├── index.html                     프로젝트 랜딩(리서치 + 문서 인덱스)
├── README.md
├── docs/
│   ├── 00_입력원본/               ★ RFP·요구사항서 투입소
│   ├── 00_INDEX.md                SSOT 지도
│   ├── 01_규칙/명명규칙.md
│   ├── 02_SSOT/{프론트|관리자}_작업가이드.md   ★ 가장 중요(🟡 RFP 대기)
│   ├── 03_요구사항/요구사항_추적표.md
│   └── 04_공통표준/{더미데이터_사전,용어집}.md
├── 화면설계/                       (RFP 확정 후 화면 생산)
│   ├── 프론트/
│   └── 관리자/
├── IA/as-is-ia.html               As-Is 정보구조
├── inventory/index.html           화면 본수 카탈로그
├── benchmark/benchmark-report.html 경쟁 벤치마킹·페인포인트
└── _assets/research.css           리서치 DS
```

## 다음 단계

1. **RFP·요구사항서를 `docs/00_입력원본/`에 투입** (PDF/PPTX/XLSX. HWP는 PDF 변환)
2. 와일리가 요건 추출 → `03_요구사항/요구사항_추적표` + `02_SSOT` 채움
3. 우선순위 화면부터 골든 복제→개조로 양산 → lint·마커·verify → 배포

> 투입 방법 상세: `docs/00_입력원본/README.md`
