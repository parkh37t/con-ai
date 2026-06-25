---
name: screen-spec
description: Use when creating or reworking a 화면설계서 (HTML storyboard) for ANY project in this workbench (projects/<name>/화면설계/) — building the 2-pane root-shell (좌 실제 화면 + 우 디스크립션/사양서), section/field 마커 1:1 미러링, the fixed-order right-panel 디스크립션 골격, golden-clone→modify for 신규 페이지, and verifying with html-lint + local server. Trigger on "화면 만들", "디스크립션 보강", "마커 맞춰", "새 페이지", "정합", "검증".
---

# 화면설계서 생산·정합 스킬 (워크벤치 공용)

S2B 방법론을 이식한 **프로젝트 무관** 화면 생산 메커니즘. 어떤 프로젝트(`projects/<name>/`)든 동일 규격으로 2단 화면설계서를 생산/정합한다.

> **규범 전문**: `방법론/와일리-OS/07_s2b-production-mechanism.md` (SSOT 4계층·8단 디스크립션·마커 5종금지(p1b~p5)/부여 5기법·검색 2-A·골든 복제→개조·콘텐츠 5원칙·도구 인벤토리·입력필드 정책). **원전**: `방법론/s2b-원전/`. 본 스킬은 그 실행 요약이다.

## 0. 활성 프로젝트 컨텍스트 먼저 로드
작업 전 **해당 프로젝트의 SSOT**를 읽는다 (가장 중요한 입력):
- `projects/<name>/docs/02_SSOT/*` — 권한·흐름·상태·정책·용어
- `projects/<name>/docs/01_규칙/명명규칙.md` — 화면ID·URL
- `projects/<name>/docs/04_공통표준/더미데이터_사전.md` — 고정 캐스트(창작 금지)
- 공용 표준: `방법론/표준/입력필드_정책.md`
- 골든 템플릿: `방법론/templates/template_screen.html`

## 1. 셸 구조 — root-shell 2단
```
root-shell
├── screen-wrap (flex:11.5)   ← 실제 화면 (#gnb · page-body(#lnb · main-col(#breadcrumb · main-row(#left-panel))))
├── #right-panel (flex:4.5)   ← 디스크립션(사양서) — screen-wrap의 형제
└── panel-toggle-wrap (togglePanel())
```
**불변식**: GNB·LNB·브레드크럼은 `screen-wrap` 안, `#right-panel`은 그 형제(덮으면 안 됨). 브레드크럼은 `main-col` 안(LNB 비침범).
`body` data: `data-portal` · `data-section` · `data-page`(화면ID) · `data-page-title` · `data-page-hint`.

## 2. 섹션 박스
좌측 본문 섹션은 `.section-box`(raw `border-black` 금지). `<style>`에 `SECTION-CARD` 주석 마커 유지(린트가 검사). 헤더는 `<h2 class="section-title-2">`.

## 2-A. 검색 조건 영역 (목록 화면)
"검색 조건" 타이틀 미부여, [초기화] 없음([조회]만), 버튼은 우하단 `.srch-actions`. 목록 상단 도구·페이지네이션은 목록 섹션의 일부(별도 마커 금지).

## 3. 마커 (화면 ↔ 디스크립션 1:1)
- 섹션 `num-badge` 1·2·3 (좌·우 노출) / 필드 `num-badge-sm` a·b·c (**섹션별 리셋**).
- 화면 배지 == 디스크립션 `spec-field` 배지(개수·라벨·순서 일치). 데이터테이블 컬럼 `<th>`(No 제외)도 배지+spec-field.
- 금지 5종: **p1b**(인접 중복 sm) / **p2**(num-badge-sm 안 숫자) / **p3**(num-badge 안 알파벳) / **p4**(`num-badge-xs`) / **p5**(인라인 `bg-black rounded-full`, X-close 예외).
- 마커 누락 보강 5기법: ①헤더 wrap(`section-box has-marker` 투명) ②정적 button/select 인라인 ③JS동적→데모샘플 ④빈 컨테이너 `has-marker` ⑤screen-wrap 외부 요소 제목에 직접 부여. (상세 07§C)

## 4. 우측 디스크립션 골격 (순서 고정)
1. `<h2>` = 화면ID → 2. `info-table` 3행(화면명/화면목적/요구사항 ID, 화면ID 행 금지) → 3. CASE 전환(`case-chip`) → 4. `proc-table` → 5. `policy-box` → 6. 데이터 매핑 → 7. `spec-header-2`/`spec-field`/`spec-bullets`(좌 num-badge와 1:1) → 8. **`msg-tbl`**(alert/confirm 전수, right-panel 내부 마지막 element).

## 5. 콘텐츠 검증 5원칙
①**화면 실재만**(JS alert/confirm/validation 전수 대조) ②**데이터모델 근거**(테이블정의서 없는 개념 금지) ③**비즈니스 룰만**(파일경로·함수명 금지, 물리컬럼은 데이터매핑 표에만) ④**프로토타입 문구 환원**(`[프로토타입]`·`{번호}`·`N건`→실제 메시지) ⑤**범위 밖 carry-forward 금지**. 더미는 고정 캐스트만. 상단 안내문은 `data-page-hint`(호버)로.
**입력필드 표준**: byte 제한(일반200·숫자12·통화12·날짜8·textarea500·에디터5000)·자동포맷(전화 하이픈·금액 콤마·날짜 구분자)·유효성 2단계(포커스아웃+저장) → `방법론/표준/입력필드_정책.md`(07§J).

## 6. 검증
- 저장 즉시: `python3 .claude/hooks/html-lint.py <file>` (회귀 13패턴)
- 단일 화면: `python -m http.server 18877` → `http://localhost:18877/...` + 강력 새로고침. **`file://` 금지**.
- 전체: `python scripts/verify_all_pages.py` · `python scripts/audit_mirror_lr.py` (전 프로젝트 스캔)

## 신규 페이지 (골든 복제 → 개조)
1. `방법론/templates/template_screen.html` 복제 → `projects/<name>/화면설계/<포털>/{prefix}-{section}-{screenId}.html`.
2. head CSS/JS 경로를 depth에 맞게 조정. 3. body data-* 설정. 4. 좌측 본문(검색=2-A, 섹션 `.section-box`+`num-badge`+필드 `num-badge-sm`). 5. 우측 디스크립션(§4 8단 순서). 6. 마커 1:1 검증.

### 커밋 전 체크리스트
- [ ] root-shell 자식 3개(screen-wrap + right-panel + panel-toggle-wrap)
- [ ] body data-portal/section/page/title/hint
- [ ] `<style>`에 SECTION-CARD 주석 마커
- [ ] info-table 3행(화면ID 행 금지)
- [ ] 좌 num-badge 수 == 우 spec-header-2 수, 필드 num-badge-sm set 좌↔우 일치
- [ ] alert·confirm 전 메시지 msg-tbl 등재 + msg-tbl이 right-panel 내부 마지막

## 회귀 13패턴 (html-lint.py)
미터미네이트 regex / 깨진 `<td>span>` / 공백 닫는태그 / nav 중복 / root-shell+SECTION-CARD 누락 / info-table 화면ID 행 / 스캐폴딩 문구 / num-badge-sm 숫자 / num-badge 알파벳 / num-badge-xs / 인라인 검정 마커 / 인접 중복 num-badge-sm / `.ui-marker{display:none}`.
