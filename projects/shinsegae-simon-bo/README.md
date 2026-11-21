# 신세계사이먼 BO (shinsegae-simon-bo)

S2B 2단 화면설계 방법론을 **PPTX 사양서로 검증한 테스트 프로젝트**.

| 항목 | 내용 |
|------|------|
| 도메인 | PREMIUM OUTLETS · SHINSEGAE SIMON 백오피스(BO, 운영자) |
| 원본 | `SSTM BO 사양서`(2023-08-28, 67슬라이드, 신세계아이앤씨) |
| 산출물 | 단일 HTML 2단 화면설계서 (좌 화면 + 우 사양서) |
| 방식 | PPTX 화면ID·메뉴경로·번호사양 → S2B 마커 1:1 미러로 변환 |

## 생산 화면 (대표 추출)
| 화면ID | 화면명 | 메뉴 | 파일 |
|--------|--------|------|------|
| BO006 | 상품목록 | 상품관리 | `화면설계/관리자/bo006-product-list.html` |
| BO316 | 컬러 변경이력 조회 | 기준정보 | `화면설계/관리자/bo316-color-history.html` |

## 적용한 방법론 요소
- 2단 셸(root-shell): 좌 screen-wrap(GNB·LNB·브레드크럼·본문) + 우 right-panel(사양서)
- 마커 1:1: 좌 `num-badge`(섹션)/`num-badge-sm`(필드) ↔ 우 `spec-header-2`/`spec-field`
- 우측 디스크립션 고정 순서: 화면ID → info-table 3행 → CASE → proc → policy → spec → msg-tbl(맨 아래)
- 더미데이터: PPTX 고정 캐스트 사용(브랜드 까날리/울리치/지미추/쁘띠바또, 컬러 CL0001~, 상점 036014 럭스보이, boadmin)

## 검증
- `python3 .claude/hooks/html-lint.py <file>` · `python scripts/verify_all_pages.py` · `python scripts/audit_mirror_lr.py`

> 나머지 65슬라이드(상품등록 BO007, 주문상세 BO009, 프로모션 BO102, 테넌트관리 BO018 등)도 동일 방식으로 확장 가능.
