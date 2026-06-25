# 07 S2B 생산 메커니즘 — 컨버전스 내재화 표준

> 원전: `방법론/s2b-원전/`(SKILL_s2b-admin-spec-rework·규칙·작업가이드·IA·glossary·더미데이터·input-field-policy·거래프로세스).
> S2B(학교장터) 재구축에서 **AI로 1,424개 화면설계서를 생산·검증**한 메커니즘의 정수를, 프로젝트 무관 컨버전스 표준으로 고정한다.
> 적용: `screen-spec` 스킬이 이 문서를 규범으로 삼는다. 모든 화면은 이 규격을 통과해야 출고.

---

## A. SSOT 4계층 (컨텍스트 누적 순서)

AI가 일관된 화면을 내려면 "무엇을, 어떤 규칙으로"가 계층적으로 쌓여야 한다.

```
① 규칙(전역)     명명·URL·아키텍처 표준        → projects/<p>/docs/01_규칙/
② IA·요구사항    포털 IA + 요구사항 추적표      → projects/<p>/docs/03_요구사항/ + s2b-원전 IA
③ 작업가이드     포털 SSOT(권한·E2E·상태·정책·용어) → projects/<p>/docs/02_SSOT/  ★가장 중요
④ 화면 README    화면 단위 스펙 카드(작업지시서)  → 화면별
⑤ 공통 자원      디자인시스템·용어집·더미사전·거래프로세스 → 방법론/ + projects/<p>/docs/04_공통표준/
```

> **작업가이드(③)가 최상위 컨텍스트.** 화면 생성 전 반드시 로드 → 환각·불일치 억제.
> 화면 README 스펙 카드 스키마: `화면ID|Phase/Step|액터|원본 · 선행/후행/팝업 · 화면목적 · 주요기능 · 제작 체크리스트(요구사항→섹션분해→CASE식별→템플릿복사→좌측→우측→품질→메타)`.

---

## B. 우측 디스크립션 8단 골격 (순서 절대 고정)

| # | 요소 | 내용 | 규칙 |
|---|------|------|------|
| 1 | `<h2>` | **화면ID** | info-table에 화면ID 행 중복 금지 |
| 2 | `info-table` **3행만** | 화면명 / 화면목적 / **요구사항 ID** | `IA 경로`·`화면ID` 레거시 행 금지 |
| 3 | **CASE 전환** | `border-t-2` 카드 + `case-chip`/`case-group` | info-table 바로 아래 |
| 4 | `proc-table` | 프로세스 흐름 | 필요 시 |
| 5 | `policy-box` | 정책 요약 | 필요 시 |
| 6 | **데이터 매핑** | 화면항목↔물리컬럼/타입/필수 | 테이블정의서 있을 때 |
| 7 | `spec-header-2`/`spec-field`/`spec-bullets` | 영역별 사양(좌 num-badge와 1:1) | **비즈니스 룰만** |
| 8 | **`msg-tbl`** | alert/confirm 전수 + 발생조건 | **right-panel 내부 마지막 element** |

- msg-tbl 유형: `t-warn`(검증)·`t-confirm`(확인)·`t-done`(완료)·무class(안내).
- **흔한 이탈**: msg-tbl이 right-panel 밖/`panel-toggle-wrap` 안으로 빠짐 → root-shell 시각적 자식이 4개 이상이면 의심.

---

## C. 마커 시스템 — 화면 ↔ 디스크립션 1:1

### C-1. 표준
- **섹션** `num-badge` 1·2·3 — 좌·우 모두 노출(좌: `.ui-marker` 박스 좌상단 -10px / 우: `spec-header-2` 인라인).
- **필드** `num-badge-sm` a·b·c — **섹션별 리셋**.
- **데이터테이블 컬럼** `<th>`(No 제외)도 배지 → 우측 컬럼별 `spec-field` 1:1. "배지 단 항목은 곧 spec-field로 설명" — 임의 제거 금지.
- 섹션 타이틀엔 미부여. 설명 필요한 항목만.

### C-2. 5종 금지 패턴 (audit·lint 대상)
| 코드 | 위반 | 정정 |
|------|------|------|
| **p1b** | 같은 라벨 안 인접 중복 `num-badge-sm`(a a) | 첫 번째만 유지 |
| **p2** | `num-badge-sm` 안 숫자(1·3-1) | num-badge로 클래스 변경 |
| **p3** | `num-badge` 안 알파벳(P/Q/D/R) | 알파벳 span 제거 |
| **p4** | 폐기 클래스 `num-badge-xs` | 제거(둘만 사용) |
| **p5** | 인라인 `bg-black rounded-full` 마커 | num-badge로 이전(X-close만 예외) |

### C-3. 마커 부여 5기법 (마커 누락 화면 보강)
1. **영역1 헤더 wrap**: 박스 없는 헤더는 `section-box has-marker`(투명 평면화)로 감싸 `num-badge 1` 부여.
2. **정적 button/select**: `<button><span class="num-badge-sm">c</span>오늘</button>`, select는 앞에 span.
3. **JS 동적 요소**: 정적 anchor 없으면 `<div style="display:none"><span class="num-badge-sm">b</span>…</div>` 데모 샘플로 마커 확보.
4. **컨테이너 has-marker**: 빈 그리드는 `<div class="… has-marker"><div class="ui-marker"><span class="num-badge-sm">a</span></div></div>`.
5. **screen-wrap 외부 요소**: side-panel 등은 제목에 직접 배지(audit는 right-panel 직전까지를 LEFT로 인식).

---

## D. 검색 조건 영역 2-A 표준 (목록 화면)
- "검색 조건" **타이틀(h2) 미부여** — 검색 테이블만 노출. `section-title-2`는 의미있는 콘텐츠 섹션에만.
- **[초기화] 없음** ([조회]/[검색]만). 버튼은 검색 영역 **우하단** `.srch-actions`(flex-end).
- 검색 `<table id="srch-tbl">`. 첫 행=검색어, 나머지 `tr.srch-row-extra`. 우상단 접기 토글(`srch-fold-btn`, 아이콘 전용)·**디폴트 펼침**.
- 와이드 검색표 폭 고정: `.srch-tbl-wrap table{width:100%;table-layout:fixed}` + 입력칸 `max-width:100%`.
- **목록 상단 도구(총건수·노출 select·엑셀·일괄)·페이지네이션은 목록 섹션의 일부** — 별도 `section-box`/`num-badge`/타이틀로 쪼개지 말 것.

---

## E. 신규 페이지 = 골든 복제 → 개조 (백지 금지)
1. 포털·메뉴 위치 결정 → **골든 1개 복사** → 파일명 `{prefix}-{section}-{screenId}.html`.
2. head 정합(레이아웃 CSS + nav.js, `../` 깊이 조정).
3. `body data-*` 4개(portal/section/page/title/hint).
4. 좌측 본문(검색=2-A, 섹션 `.section-box`+`num-badge`+필드 `num-badge-sm`, 데이터테이블 컬럼 배지).
5. 우측 디스크립션(§B 8단 순서).
6. 좌↔우 마커 1:1 검증.
7. CASE 칩 fallback 1줄.

> **본화면=`root-shell` 풀 셸 / 별창 팝업=`popup-shell`+`aside.spec-side`. 절대 섞지 말 것.**

---

## F. 콘텐츠 검증 5원칙
1. **화면 실재만**: JS의 alert·confirm·validation·maxlength 전수 대조해, 화면에 실제 있는 것만 디스크립션에.
2. **데이터모델 근거**: 테이블정의서에 컬럼 근거 없는 개념·규칙(계층·연쇄) 금지.
3. **비즈니스 룰만**: spec bullet에 파일경로·함수명 금지. 물리컬럼명은 '데이터 매핑' 표에만.
4. **프로토타입 문구 환원**: `[프로토타입]`·`{번호}`·`N건`·`…데모 단계` → 실제 의도된 시스템 메시지로.
5. **범위 밖 제거**: 타 화면 도메인 현황·카운트 패널은 무비판 carry-forward 금지(연관 링크 모음은 허용).

---

## G. 13 회귀 패턴 (html-lint)
미터미네이트 regex `replace(/\/g,` · 깨진 `<td>span>` · 공백 닫는태그 · nav 중복로드 · root-shell+SECTION-CARD 누락/GNB·breadcrumb 위치 · info-table `IA 경로`행 · msg-text 스캐폴딩 문구 · `.ui-marker{display:none}` · num-badge-sm 안 숫자 · num-badge 안 알파벳 · `num-badge-xs` · 인라인 검정 원형 마커 · 인접 중복 num-badge-sm.
→ 구현: `.claude/hooks/html-lint.py` (PostToolUse 비차단 경고).

---

## H. 도구 인벤토리 (S2B 원전 ↔ 컨버전스 매핑)

| 분류 | S2B 원전 | 컨버전스(con-ai) | 상태 |
|------|----------|------------------|------|
| 저장 훅 | `html-lint.ps1`(13패턴) | `.claude/hooks/html-lint.py` | ✅ |
| 전수 검증 | `verify_all_pages.py` | `scripts/verify_all_pages.py` | ✅ |
| 좌우 미러 | `audit_mirror_lr.py` | `scripts/audit_mirror_lr.py` | ✅ |
| 마커 위반 | `audit_markers_admin_v2.py`(p1b~p5) | (확장 예정) | ⬜ |
| 콘텐츠 매칭 | `audit_content_match.py` | (확장 예정) | ⬜ |
| CASE 매칭 | `audit_cases.py` | (확장 예정) | ⬜ |
| 자동 정정 | `patch_*.py`(phase1~5·left/right·placeholder) | (확장 예정) | ⬜ |
| 단일 렌더 | Playwright SHELL_CHECK JS | (Playwright MCP 사용) | ◐ |

> 확장 로드맵: `audit_markers`(p1b~p5)·`audit_cases`·`patch_*` 를 con-ai `scripts/`로 이식해 대량 정정 자동화.

---

## I. 검증 환경 (file:// 금지 — stale 방지)
- 검증·리뷰는 **로컬 http 서버**(`python -m http.server 18877`) URL + **강력 새로고침(Ctrl+Shift+R)**. **파일 수정 후 서버 재시작.**
- `file://`는 동기화 지연·브라우저 캐시로 **수정 전(stale) 화면**을 보여줄 수 있음("아직도 잘못됨" 피드백의 다수가 실은 stale).
- 원격 산출물은 커밋 SHA 고정 URL(raw.githack)로 캐시 우회.

---

## J. 입력필드 정책 (원전 input-field-policy 내재화)
- **byte 기준 제한**: 일반 200·숫자 12·소수16·textarea 500·전화 9~11·통화 12(소수16)·날짜 8·시간 6·에디터 5,000.
- **자동 포맷**: 전화 하이픈·금액 콤마(3자리)·날짜/시간 구분자.
- **허용문자 강제**: 숫자필드 문자 차단(실시간), 타입별 엄격 분리.
- **유효성 2단계**: ① 포커스 아웃 ② 등록 클릭 일괄. Fail TYPE-A(필드 하단 메시지)/TYPE-B(별도 영역).
- 상세: `방법론/표준/입력필드_정책.md`.

---

## K. 학습 누적 (feedback/project 메모리 → 컨버전스)
S2B는 반복 피드백·합의를 `feedback_*`·`project_*` 메모리로 고정해 다음 작업에 자동 반영했다.
- 컨버전스 대응: **합의·교훈은 이 `와일리-OS/` 노하우 문서와 `screen-spec` 스킬에 환류**(예: 06의 "quadrantChart 한글 취약→CSS"). 사실=CLAUDE.md, 절차=스킬, 강제=훅.

---

## L. 협업·프롬프트 원리 (현장 검증)
- **대상 고정**: 화면ID/URL로 지칭(경로 전체 X — 토큰·오지정 방지).
- **"어디를·어떻게"** 명확화 → 요소 단위 셀렉터/라벨 타게팅 → `(추가)/(삭제)/(유지)` diff.
- **가드레일(절대)**: "위에서 언급한 수정 외 기존 코드는 절대 삭제·이동 금지, 수정 후 저장." (L7 가드레일과 동일)
- **디자인시스템 제약**: 기존 클래스만, 임의 CSS 금지.
- **컨펌 3대 키 일치**: 화면ID = HTML 파일명 = 개발목록 ID.
- 재사용 프롬프트 템플릿: `[대상]화면ID [변경]요소·전후·동작 [참조]화면/캡쳐 [가드레일]보존·DS·마커1:1·저장`.
