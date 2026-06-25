---
name: s2b-admin-spec-rework
description: Use when reworking / 정합화 an S2B 관리자포털 HTML screen — converting the legacy admin-shell.js auto-shell to the admin-nav.js root-shell, removing black section boxes (SECTION-CARD-V3), fixing section/field markers, rebuilding the right-panel 디스크립션(사양서), and verifying with a local server + Playwright. Also covers **신규 페이지 생성** (골든 복제 → 개조) and **검증 도구 인벤토리** (verify/audit/patch/fix scripts). Trigger on "디스크립션 보강", "레이아웃 정합", "마커 맞춰", "admin-member-sellList처럼", "새 페이지 만들", "검증 가이드".
---

# S2B 관리자포털 화면 정합 (디스크립션 · 레이아웃)

관리자포털 HTML 화면 1개를 **표준 셸 + 디스크립션 규격**으로 정합화한다.
적용 범위: `관리자포털/**/*.html` (팝업·탭 조각 제외, 좌/우 패널 본 화면).

> 본 SKILL은 (a) **기존 화면 정합화** (섹션 0~6) (b) **신규 페이지 생성** (섹션 "신규 페이지 생성") (c) **검증 도구 인벤토리** (섹션 "검증 가이드") 세 가지를 모두 다룬다.

> **포털 공통성**: 셸 구조(섹션 1)는 관리자포털 전용(`admin-nav.js`)이나, **SECTION-CARD-V3(섹션 2)·마커(섹션 3)·우측 디스크립션 골격(섹션 4)·콘텐츠 검증(섹션 5)은 포털 무관 공통 표준**이다. 공급자포털(`sup-nav.js`)·수요자포털(`buy-nav.js`) 마이데스크 화면도 동일 규격으로 정합하며 셸만 해당 포털 것을 유지한다. 골든 디스크립션 레퍼런스: `관리자포털/전시관리/몰관리/admin-notification-contentManage.html`.

## 기준 화면 (golden standard)
`관리자포털/공급업체관리/admin-member-sellList.html` — 셸·디스크립션 구조의 기준.
공통 자원: `_공통/프로토타입_템플릿/` 의 `common.css` · `admin-layout.css` · `admin-nav.js`.

## 작업 순서 (TodoWrite로 항목화)

### 0. 사전 확인
- 대상 파일을 Read. 현재 셸 시스템 확인: 구버전 `admin-shell.js`(`data-admin-shell-auto`) / 신버전 `admin-nav.js`.
- 화면 백킹 테이블이 필요하면 `테이블정의서`(CSV/xlsx)에서 해당 테이블 식별.
- 화면 JS의 `alert`/`confirm`/유효성 로직을 먼저 읽어 둔다 (디스크립션·메시지표 근거).

### 1. 셸 구조 — admin-nav.js root-shell
**head 교체:**
- `admin-shell.css` 링크 → `admin-layout.css` (admin-layout.css가 admin-shell.css를 @import)
- `admin-menu.js` + `admin-shell.js`(data-admin-shell-auto) 2줄 → `admin-nav.js` 1줄
- `../` 깊이는 파일 위치에 맞춰 유지 (admin-nav.js가 src로 basePath 자동 판별)

**body 구조:** `data-section`·`data-page`·`data-page-title`·`data-page-hint` 부여 후 root-shell:
```html
<body data-section="<섹션키>" data-page="<화면ID>" data-page-title="<화면명>"
      data-page-hint="<페이지안내 호버 안내문 — &#10; 로 줄바꿈>">
<div class="root-shell">
<div class="screen-wrap" style="flex:11.5;">
  <div id="admin-gnb" class="has-marker"></div>
  <div class="page-body">
    <div id="admin-lnb" class="h-full overflow-y-auto flex-shrink-0"
         style="min-width:200px;max-width:240px;border-right:1px solid #e5e7eb;"></div>
    <div class="flex flex-1 min-w-0 h-full">
      <div class="main-col">
        <div id="admin-breadcrumb"
             class="h-10 min-h-[40px] border-b border-gray-200 flex items-center px-5 gap-1 text-xs text-gray-500"></div>
        <div class="main-row">
          <div id="left-panel" class="flex left-panel flex-col min-w-0 h-full" style="flex:11.5;">
            <!-- 기존 좌측 본문 (header + scroll-area) 그대로 -->
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<div id="right-panel" style="flex:4.5" class="right-panel h-screen overflow-y-auto scroll-area border-l-2 border-black bg-white p-4">
  <!-- 디스크립션 -->
</div>
<div class="panel-toggle-wrap"><button class="panel-toggle-btn" onclick="togglePanel()"><i class="fa-solid fa-chevron-right" id="toggle-icon"></i></button></div>
</div><!-- /root-shell -->
```
- 핵심: **GNB·LNB·브레드크럼은 `screen-wrap`(화면 영역) 안**, `right-panel`(디스크립션)은 그 형제. GNB가 디스크립션을 덮으면 안 됨. 브레드크럼은 `main-col` 안 → LNB를 덮지 않음.
- `togglePanel()`은 `right-panel.collapsed` + `screen-wrap.expanded` 토글.
- 섹션키: 시스템관리=system · 기준정보관리=base · 이용자관리=user · 수요기관관리=buyer · 공급업체관리=supplier · 연계관리=link · 계약관리=contract · 견적정보관리=quote · 전시관리=display · 결제관리=payment · 정산관리=settlement · 통계관리=stats · VOC관리=voc · 알림커뮤니케이션=comm · 고객지원=support · 관리자정보관리=admininfo.

### 2. SECTION-CARD-V3 — 검정 섹션 박스 제거 (마커는 노출)
대상 화면 `<style>` 끝에 추가 (좌측 본문 한정). **`SECTION-CARD-V3` 주석 마커는 반드시 유지** — 린트 훅이 이 문자열로 적용 여부를 검사한다:
```css
/* SECTION-CARD-V3 : 검정 섹션 박스 제거 — 카드화 + 테이블 포함 섹션 플랫 (260524: 좌측 마커 노출) */
.section-box { border:1px solid #e5e7eb !important; background:#fff !important; border-radius:6px !important; padding:14px !important; margin-bottom:14px !important; box-shadow:0 1px 2px rgba(0,0,0,0.04) !important; }
.section-box:has(table) { border:0 !important; background:transparent !important; padding:0 !important; box-shadow:none !important; border-radius:0 !important; }
.section-box > * { max-width:100%; }
```
- **260524 변경**: 이전 표준은 `.section-box .ui-marker, .ui-marker { display:none !important; }` 라인으로 좌측 영역 마커(num-badge 1/2/3/4)를 숨겼으나, 좌·우 마커 미러 일관성을 위해 폐기. 좌측 영역 마커도 우측 spec-header-2와 동일하게 노출한다. 기존 화면 일괄 정정: `scripts/patch_show_left_markers.py` + `scripts/fix_patch_collision.py`.
- split-view 화면이면 `.split-detail.section-box { border-left:1px dashed #d1d5db !important; padding:0 0 0 14px !important; }` 추가.
- 섹션 헤더는 회색/검정 바 대신 `<h2 class="section-title-2">` 통일.
- **중요**: 좌측 본문 섹션이 `.section-box` 클래스가 아니라 raw Tailwind(`border border-black …`)면 위 CSS가 적용되지 않는다 → 해당 `<div>`를 `class="section-box"`로 바꿔야 검정 박스가 제거된다. 화면 전수 확인할 것.

### 2-A. 검색 조건 영역 + 섹션 단위 (목록 화면)

**섹션 단위 — 목록 화면은 보통 섹션 2개만:** ① 검색 조건 ② 목록. 목록 상단 도구(총건수·페이지당 건수 select·엑셀·일괄버튼)와 페이지네이션은 **목록 섹션의 일부**다 — 별도 `section-box`·`num-badge`·`section-title-2`로 쪼개지 말 것. "목록 상단 기능"·"페이지네이션" 같은 타이틀 금지. `section-title-2`는 의미 있는 콘텐츠 섹션에만(검색 영역엔 미부여).

**검색 조건 영역 표준** (관리자포털 검색 테이블 공통 규칙 — 기준: `admin-masterdata-NotifiedAmount.html`, 정산관리 예: `admin-settlement-PreTax.html`):
- 검색 영역에 **"검색 조건" 섹션 타이틀(h2 `section-title-2`) 미부여** — 검색 테이블만 바로 노출.
- **[초기화] 버튼 없음** ([조회]/[검색] 버튼만). 안 쓰게 된 `resetSearch` 등 함수는 제거.
- [검색]/[조회] 버튼은 검색 영역 **우하단** `<div class="srch-actions">`(`display:flex; justify-content:flex-end`).
- 검색 `<table>`에 `id="srch-tbl"`. 검색어(부분일치) 입력 행을 첫 행, 나머지 조건 행은 `<tr class="srch-row-extra">`.
- 펼치기/접기 토글: 테이블을 `<div class="srch-tbl-wrap">`(position:relative)로 감싸고 우상단 모서리에 `srch-fold-btn`(아이콘 전용 fa-chevron-up/down, **텍스트 없음**) absolute 배치. 인라인 `toggleSrchFold()`가 `#srch-tbl`의 `folded` 클래스 토글 → `#srch-tbl.folded .srch-row-extra { display:none }`.
- **디폴트 = 펼침**(`folded` 클래스 없이 로드 — 전체 조건 노출, 버튼 초기 `fa-chevron-up`+title "접기"). [접기] 클릭 시 `folded` 추가되어 첫 행만 남김.
- 검색 조건이 1행뿐이면 토글 미적용(타이틀·초기화 제거만).
- 기간 빠른날짜 버튼(오늘/N개월/전체) 미사용.
- CSS(`.srch-tbl-wrap`·`.srch-fold-btn`·`#srch-tbl.folded .srch-row-extra`·`.srch-actions`)·JS(`toggleSrchFold`)는 NotifiedAmount/PreTax에서 그대로 복사.
- **검색 테이블 폭 고정** (와이드 검색표 패널 초과 방지 — 검색필드 많은 화면 필수): 토글 CSS 블록에 2줄 추가 — `.srch-tbl-wrap table { width:100%; table-layout:fixed; }` (검색표를 wrap=패널 폭에 가둠; `.srch-tbl-wrap` 안만 타깃이라 목록표·2탭 안전) + `.srch-tbl-wrap td input, .srch-tbl-wrap td select { max-width:100%; box-sizing:border-box; }` (고정폭 입력칸이 셀 초과 방지). 미적용 시 검색필드 많은 화면(예: 13필드)은 검색표가 패널 밖으로 넘쳐 fold 버튼이 테이블 우측 끝에 안 붙는다.
- **레거시 검색영역 정합 시 제거 대상**: 회색/검정 타이틀바(`<div class="bg-gray-100 border-b border-black">…검색 조건…</div>`)·구 `srch-head` 헤더·공통 `srch-fold.js`·`[초기화]`(btn-reset)·기간 빠른날짜버튼(`srch-quick`). 메뉴마다 레거시 형태가 다름(기준정보관리=`srch-head` 헤더 / 견적정보관리·시스템관리=회색 타이틀바+srch-fold.js)이나 목표 표준은 동일. 검색 섹션이 `num-badge`를 점유했으면 제거 후 후속 섹션을 1씩 당겨 재번호.
- 주의: 구 공통 `_공통/프로토타입_템플릿/srch-fold.js`(3행↑ 자동폴딩)와 병행 금지 — 인라인 토글 적용 시 해당 `<script>`는 제거.

### 3. 마커 (화면 ↔ 디스크립션 1:1)
- 섹션: `num-badge` 1·2·3 — 좌·우 모두 노출(260524 정책 변경). 좌측은 `<div class="ui-marker">` 안에서 박스 좌상단 -10px에 absolute 표시, 우측은 `spec-header-2` 안 인라인.
- 필드: `num-badge-sm` a·b·c — **섹션별로 리셋**.
- 화면 필드 배지 == 디스크립션 `spec-field` 배지 (개수·라벨·순서 일치).
- 섹션 타이틀엔 미부여. 설명이 필요한 항목만 배지.
- **데이터 테이블 컬럼**: 목록/그리드의 `<th>` 컬럼 헤더에도 `num-badge-sm`을 부여하고(No·순번 컬럼 제외) 우측에 컬럼별 `spec-field`로 1:1 미러한다 — 골든(contentManage 몰목록)이 의미있는 컬럼 전부 배지+spec-field. "배지를 단 항목은 곧 spec-field로 설명한다"가 원칙이므로 데이터테이블 컬럼 배지를 임의 제거하지 말 것.
- ①②③ 원숫자·A/B/C 섹션문자 혼용 금지. 중복 번호 금지.
- **num-badge에 알파벳 금지(p3)**: `<span class="num-badge">P</span>프로세스` 같은 패턴(P/Q/D/R 알파벳)은 골든 외 — 알파벳 span을 통째로 제거(`scripts/patch_phase3_p3.py`).
- **num-badge-sm에 숫자 금지(p2)**: sub-section ID(1, 1-2, 3-1 등)는 num-badge가 표준 — 잘못 num-badge-sm으로 들어가 있으면 클래스만 바꿔 정정(`scripts/patch_phase2_p2.py`).
- **인접 중복 num-badge-sm 금지(p1b)**: `<span class="num-badge-sm">a</span><span class="num-badge-sm">a</span>` 식 같은 라벨 안 두 span 패턴은 첫 번째만 유지(`scripts/patch_phase1_p1b.py`).
- **`num-badge-xs` 클래스 폐기(p4)**: 컨벤션은 num-badge·num-badge-sm 둘만 사용. xs 정의 발견 시 제거.
- **인라인 `bg-black rounded-full` 배지 폐기(p5)**: 옛 sub-section 표기(1-1·1-2…)는 num-badge로 옮기거나 제거. X-close 버튼만 예외.

**마커 부여 5가지 기법** (260524 Calendar 시리즈 수동 patch에서 확립 — 좌측 마커 누락 화면에 재사용):
1. **영역 1 헤더 wrap**: 좌측 영역 1이 `<div class="section-box">`로 감싸지지 않은 헤더 영역이면 `<div class="section-box has-marker" style="border:0 !important; background:transparent !important; padding:0 !important; box-shadow:none !important;">` 로 감싸고 `<div class="ui-marker"><span class="num-badge">1</span></div>` 부여 (시각적 박스는 평면화).
2. **정적 button/select 인라인**: `<button>오늘</button>` → `<button><span class="num-badge-sm">c</span>오늘</button>`. select는 앞에 span: `<span class="num-badge-sm">d</span><select>...`.
3. **JS 동적 element**: 카드·더보기 같은 JS 생성 요소는 정적 anchor 없음 → `<div style="display:none"><span class="num-badge-sm">b</span>방문교육 신청 카드</div>` 데모 sample HTML 추가.
4. **컨테이너 has-marker**: 빈 그리드(`<div id="cal-body"></div>`)는 `<div class="cal-grid has-marker" id="cal-body"><div class="ui-marker"><span class="num-badge-sm">a</span></div></div>`로 마커 부여.
5. **screen-wrap 외부 요소**: `side-panel` 같이 left-panel 외부지만 화면 일부인 element는 `<h3 id="side-panel-title"><span class="num-badge-sm">d</span>날짜 선택</h3>`로 직접 부여 (audit는 right-panel 직전까지를 LEFT로 인식).

### 4. 우측 디스크립션 골격 (순서 고정)
1. `<h2 ...>` = **화면ID**
2. `info-table` **3행만**: 화면명 / 화면목적 / 요구사항 ID — *화면ID 행 금지(h2와 중복)*, 깨진 `<td>span>` 금지
3. CASE 전환 (`border-t-2 border-black` 카드, `case-chip`/`case-group`) — info-table 바로 아래
4. `proc-table` — 프로세스 흐름
5. `policy-box` — 정책 요약
6. 데이터 매핑 (테이블정의서 있을 때): 화면항목↔물리컬럼/타입/필수 표 + 검토 bullet
7. `spec-header-2` / `spec-field` / `spec-bullets` — 영역별 사양
8. **메시지 · 알림 정의 테이블**(`msg-tbl`) — 화면 JS의 `alert`/`confirm` 전수 + 발생조건 (맨 아래). 유형 칸은 `t-warn`(검증)·`t-confirm`(확인)·`t-done`(완료)·무class(안내). **프로토타입 데모 alert 문구(`[프로토타입]…`·`…데모 단계입니다`·`{번호}`·`N건` 등 플레이스홀더)를 그대로 옮기지 말 것** — 실제 의도된 시스템 메시지로 환원해 기술한다(검증·확인 메시지는 실제 문구 유지). 린트 훅이 `msg-text` 안 스캐폴딩 문구를 검출함.

### 5. 콘텐츠 검증 규칙
- **화면에 실제로 있는 것만** 디스크립션에. 화면 JS(alert·confirm·validation·maxlength 등) 전수 대조.
- **데이터 모델에 없는 개념 금지**: 테이블정의서에 컬럼 근거가 없으면 그 규칙(계층·연쇄 등)을 서술하지 않는다.
- **범위 밖 영역 제거**: 원본에 있던 영역이라도 해당 화면 본연 기능을 벗어나는 타 화면 도메인의 현황·카운트 패널(다른 화면이 관리하는 데이터 건수 표시 등)은 화면·디스크립션에서 제거. 단순 연관 화면 링크 모음은 허용. (원본 콘텐츠를 무비판적으로 carry-forward 하지 말 것.)
- spec bullet은 **비즈니스 룰만** — 파일경로·함수명 금지. DB 물리컬럼명은 '데이터 매핑' 표에만.
- 와이어프레임 주석성 텍스트(예: 입력 힌트)는 화면에서 빼고 디스크립션 제약에만.
- 화면 상단 안내문(info-banner·서브타이틀)은 본문에서 빼고 `body[data-page-hint]` (페이지안내 호버)로. 다줄은 `&#10;`, 툴팁 다줄 노출용 `<style>`에 `.admin-breadcrumb .bc-hint-btn::after{white-space:pre-line!important;max-width:460px!important;}`.
- 의사확인 등 표준 문구는 화면 실제 구현과 일치 (네이티브 confirm이면 "공통 모달"이라 쓰지 말 것).
- 레거시/중복 요구사항 ID 등 제거.

### 6. 검증

**검증 환경 — 중요 (stale 주의)**
- 작업·편집은 항상 **작업 디렉터리(H: 드라이브)** 경로 기준. 동일 Google Drive 공유 폴더가 **G:** 등 다른 드라이브 문자로도 마운트될 수 있다(같은 폴더의 다른 마운트).
- 사용자가 `file:///G:/...` 로 직접 열면 Drive 동기화 지연 + 브라우저 캐시 때문에 **편집 전(정합 안 된) 내용이 그대로 보일 수 있다.** "아직도 GNB가 잘못됨" 같은 피드백은 실제로는 stale 뷰인 경우가 많다.
- 따라서 검증·리뷰는 **로컬 http 서버 URL**(`http://localhost:<포트>/...`)로 하고, 브라우저는 **강력 새로고침(Ctrl+Shift+R)**. `python -m http.server`는 작업 디렉터리 원본을 직접 서빙하므로 항상 최신. **파일 수정 후 서버 재시작.**
- `file://` 는 Playwright에서 차단되고 stale 위험도 크므로 검증에 쓰지 말 것.

**구조 자가 점검 (코드 레벨 — Playwright 불가 시 필수)**
변환 후 대상 파일을 grep/Read로 다음을 확인:
- head: `admin-layout.css` 1개 + `admin-nav.js` 1개. `admin-shell.css`·`admin-menu.js`·`admin-shell.js` 잔존 0건.
- `class="root-shell"` 안에 `class="screen-wrap"`(그 안에 `id="admin-gnb"`) + `id="right-panel"`(screen-wrap의 형제).
- `id="admin-breadcrumb"` 는 `class="main-col"` 안.
- `<style>`에 `SECTION-CARD-V3` 주석 마커 존재. 좌측 섹션 박스가 모두 `.section-box` 클래스인지(raw `border-black` 아님).
- 우측 info-table 3행(화면명/화면목적/요구사항 ID) — `IA 경로`·`화면ID` 등 레거시 행 0건.
- 닫는 태그 순서: left-panel→main-row→main-col→page-body→screen-wrap 으로 닫히고 right-panel 이 그 뒤 형제.
- **`.claude/hooks/html-lint.ps1` 를 대상 파일에 실행해 exit 0 확인** — 셸 구조·SECTION-CARD-V3·IA행·마커 컨벤션 등 13패턴 자동 검출.

**마커 정합 검증 (260524 추가 — 일제 점검에 필수)**
- `scripts/audit_markers_admin_v2.py` — p1b(인접 중복)·p2(num-badge-sm 안 숫자)·p3(num-badge 안 알파벳)·p4(num-badge-xs)·p5(인라인 검정 원형) 위반 일괄 스캔. sub-group reset(thead 컬럼) false-positive 자동 보정.
- `scripts/audit_p1b_adjacent.py` — 같은 라벨 안 인접 num-badge-sm 중복 전용 스캔.
- `scripts/audit_mirror_lr.py` — **좌(`screen-wrap`~`right-panel` 직전) ↔ 우(`right-panel`)** 마커 1:1 미러 검증. `right_only`(화면 마커 누락) vs `left_only`(디스크립션 spec-field 누락) 분리 보고. LEFT 범위가 right-panel 직전까지라 side-panel 같은 screen-wrap 외부 형제도 인식.
- `scripts/analyze_mirror.py` — audit 결과 카테고리별 통계 + 위반 TOP 출력.
- `scripts/show_diffs.py <file>` — 특정 파일의 누락 마커 조회.

**자동 patch 도구 (대규모 일괄 정정용)**
- `scripts/patch_show_left_markers.py` — 폐기된 `.ui-marker { display:none }` 류 CSS 일괄 제거. `scripts/fix_patch_collision.py`로 정규식 부작용(인접 selector 결합) 사후 정정.
- `scripts/patch_phase1_p1b.py`~`patch_phase5_p5.py` — 5종 위반 패턴별 일괄 patch.
- `scripts/patch_right_renumber.py` — 우측 디스크립션 spec-field 알파벳을 spec-header-2 섹션별로 a부터 재번호.
- `scripts/patch_left_only_to_right.py` — 좌측에만 있는 마커의 라벨을 우측 디스크립션에 spec-field로 보강 (placeholder spec-bullets 포함).
- `scripts/patch_right_only_to_left.py` + `_partial.py` — 우측 spec-field 라벨을 좌측 텍스트와 매칭해 인라인 마커 부여 (partial 매칭은 따옴표·괄호 안 키워드 등 추출 시도).

**Playwright 가능 시:** 각 영역·CASE(detail/register/empty) 렌더, GNB가 디스크립션 영역 미침범, 브레드크럼이 LNB 미침범, 콘솔 에러 favicon 외 없음 확인. 검증용 스크린샷·http 서버는 작업 후 정리.

## 회귀 방지
`.claude/hooks/html-lint.ps1` (PostToolUse 훅)이 HTML 저장 시 13개 회귀 패턴을 자동 검출:
1. 미터미네이트 regex `replace(/\/g,`
2. 깨진 `<td>span>`
3. 공백 닫는태그 `< / div>`
4. admin-shell.js + admin-nav.js 동시 로드
5. `root-shell` + admin-shell.js 또는 SECTION-CARD-V3 누락 / GNB·breadcrumb 위치
6. info-table 레거시 `IA 경로` 행
7. msg-text 안 프로토타입 스캐폴딩 문구
8. **(260524 신규)** 폐기 마커 숨김 CSS `.ui-marker { display:none }`·`.has-marker { position:static !important }`
9. **(260524 신규)** num-badge-sm 안 숫자/N-M
10. **(260524 신규)** num-badge 안 알파벳(P/Q/D/R)
11. **(260524 신규)** 폐기 클래스 `num-badge-xs`
12. **(260524 신규)** 인라인 `bg-black rounded-full` 마커(X-close 제외)
13. **(260524 신규)** 인접 중복 num-badge-sm
경고가 뜨면 즉시 수정.

## 신규 페이지 생성 (260525)

새 HTML 화면을 만들 때는 **정합화와 동일한 표준**을 처음부터 적용한다. 기존 화면 1개를 **복제 → 개조** 방식이 가장 안전 (셸 + SECTION-CARD-V3 + 마커 + 디스크립션 골격이 한 번에 따라옴).

### 골든 참조 (포털별)
| 포털 | 골든 본화면 | 골든 별창 팝업 |
|------|------------|---------------|
| 관리자 | `관리자포털/공급업체관리/admin-member-sellList.html` | `관리자포털/전시관리/몰관리/admin-notification-displayTemplateManage.html` |
| 공급업체 | `공급자포털/마이데스크/공급업체정보관리/sell-mydesk-companyInfo.html` | (popup-shell + spec-side 사용 — 골든: `관리자포털/기준정보관리/admin-masterdata-companyAdd.html`) |
| 수요기관 | `수요자포털/마이데스크/기관정보관리/buy-mydesk-organizationinfo.html` | (popup-shell + spec-side) |

> 본화면은 모두 **`<div class="root-shell">` 풀 셸**, 별창은 `<div class="popup-shell">` + `<aside class="spec-side">`. 절대 섞지 말 것.

### 절차
1. **포털·메뉴 위치 결정** → 골든 파일 1개 선택 → 동일 폴더에 복사 후 파일명을 `{portal-prefix}-{section}-{screenId}.html` 패턴으로 변경.
   - prefix: `admin-` (관리자) / `sell-` (공급업체) / `buy-` (수요기관).
2. **head 정합**: 골든의 `<link rel="stylesheet" href="../../_공통/프로토타입_템플릿/admin-layout.css">` + `<script src="../../_공통/프로토타입_템플릿/admin-nav.js"></script>` (sup-nav.js / buy-nav.js)를 파일 depth에 맞게 ../ 깊이 조정.
3. **body data-* 설정**:
   ```html
   <body data-section="{섹션키}" data-page="{화면ID}" data-page-title="{화면명}"
         data-page-hint="페이지 안내 호버&#10;줄바꿈은 &amp;#10;">
   ```
   섹션키: 본 SKILL "1. 셸 구조"의 16개 키 중 하나 (관리자) / sup-nav·buy-nav도 동일 키 체계.
4. **좌측 본문 작성**:
   - 검색 영역(목록 화면) → 2-A 규약 그대로 (h2 미부여·[조회]만·우하단 srch-actions·접기버튼 우상단·디폴트 펼침).
   - 본문 섹션은 `<div class="section-box">` + `<h2 class="section-title-2">N. 영역명</h2>` + `num-badge` 부여.
   - 필드별 `num-badge-sm`(섹션별 a/b/c 리셋) — **설명 필요한 것만** 부여.
   - 데이터 테이블 컬럼 `<th>`도 (No 제외) `num-badge-sm` 부여.
5. **우측 디스크립션 작성** (순서 고정):
   ```html
   <div id="right-panel" style="flex:4.5" class="right-panel ...">
   <h2 ...>{화면ID}</h2>
   <table class="info-table">
     <tr><th>화면명</th><td>...</td></tr>
     <tr><th>화면목적</th><td>...</td></tr>
     <tr><th>요구사항 ID</th><td>...</td></tr>
   </table>
   <!-- CASE 전환 (있을 때만) -->
   <div class="border-t-2 border-black pt-3 mb-4">
     <h3 ...><i class="fa-solid fa-sliders mr-1"></i>CASE 전환</h3>
     <div class="case-group">
       <div class="case-group-title">{group}</div>
       <div class="flex gap-1 flex-wrap">
         <a class="case-chip active" onclick="setCase('{g}','{v1}',this)">{v1}</a>
         <a class="case-chip" onclick="setCase('{g}','{v2}',this)">{v2}</a>
       </div>
     </div>
   </div>
   <!-- 프로세스 흐름 (필요 시) -->
   <table class="proc-table mb-4">...</table>
   <!-- 정책 요약 (필요 시) -->
   <div class="policy-box mb-4">...</div>
   <!-- 영역별 사양 — 좌측 num-badge=N과 1:1 -->
   <h3 class="spec-header-2"><span class="num-badge">1</span>{섹션1 제목}</h3>
   <p class="spec-field"><span class="num-badge-sm">a</span>{필드 라벨}</p>
   <ul class="spec-bullets"><li>...</li></ul>
   <!-- 메시지 · 알림 정의 (맨 아래, right-panel 내부 마지막 element) -->
   <h3 class="text-xs font-bold mb-1 mt-5"><i class="fa-solid fa-bell mr-1 text-gray-500"></i>메시지 · 알림 정의</h3>
   <table class="msg-tbl mb-2">
     <thead><tr><th style="width:54px;">유형</th><th>메시지</th><th style="width:150px;">발생 시점·조건</th></tr></thead>
     <tbody>
       <tr><td class="t-type t-warn">검증</td><td class="msg-text">...</td><td>...</td></tr>
       <tr><td class="t-type t-confirm">확인</td><td class="msg-text">...</td><td>...</td></tr>
     </tbody>
   </table>
   </div><!-- /right-panel -->
   ```
6. **마커 1:1 검증** (좌측 ↔ 우측): 섹션 num-badge 개수 동일, 각 섹션 필드 num-badge-sm 알파벳 동일 set. 데이터 테이블 컬럼 헤더 배지 = 우측 spec-field 1:1.
7. **CASE 칩 토글 보장**: 새 case 그룹 추가 시 `_공통/프로토타입_템플릿/setcase-fallback.js`가 자동 처리 (914파일에 이미 주입됨). 페이지에 setCase 호출이 있으면 fallback이 generic toggle 제공. 신규 페이지도 `</body>` 직전에 `<script src=".../setcase-fallback.js"></script>` 1줄 포함.

### 신규 페이지 체크리스트 (커밋 전)
- [ ] head: `admin-layout.css` + `admin-nav.js` 단 1조 (포털 셸 1개)
- [ ] `<style>`에 SECTION-CARD-V3 주석 마커 + 4 줄 (세 셸 공통)
- [ ] body data-section/page/title/hint 4개 모두 설정
- [ ] root-shell 자식 3개: screen-wrap + right-panel + panel-toggle-wrap (또는 popup-shell + main + spec-side)
- [ ] info-table 3행 (화면명/화면목적/요구사항 ID — 화면ID 행 금지)
- [ ] 좌측 num-badge 수 == 우측 spec-header-2 수
- [ ] 각 섹션 필드 num-badge-sm set 좌↔우 일치
- [ ] alert·confirm 코드의 모든 메시지가 msg-tbl에 등재 (자동 추출은 보강 필요)
- [ ] msg-tbl이 right-panel 내부 마지막 element (260525 이탈 사례 [[msgtbl-outside-fix-260525]])
- [ ] setcase-fallback.js 스크립트 1줄

---

## 검증 가이드 — 도구 인벤토리 (260525)

검증은 **로컬 http 서버 + Playwright headless** 기준. file:// 사용 금지 (Drive 동기화/캐시로 stale 위험).

### 단일 페이지 빠른 검증 (Playwright MCP)
```
1. `python -m http.server 18877`  (반드시 작업 디렉터리 S2B2 루트에서)
2. mcp__playwright__browser_navigate → http://localhost:18877/{portal}/{path}/{file}.html
3. mcp__playwright__browser_evaluate → 아래 SHELL_CHECK JS
4. (수정 후) browser_evaluate `() => location.reload(true)` + 재검사
```
**SHELL_CHECK JS (본화면 표준):**
```javascript
() => {
  const rs = document.querySelector('.root-shell');
  const sw = document.querySelector('.screen-wrap');
  const rp = document.querySelector('#right-panel');
  if (!rs || !sw || !rp) return { ok: false, reason: 'no shell' };
  const swOk = sw.offsetWidth > 100;   // 좌측 본문 정상 폭
  const rpOk = rp.offsetWidth > 100;
  const visualKids = Array.from(rs.children).filter(c => c.tagName === 'DIV').length;
  const msgInRp = Array.from(rp.querySelectorAll('h3')).some(h => h.textContent.includes('메시지'));
  const toggleOutsideRp = !rp.querySelector('.panel-toggle-wrap');
  return { ok: swOk && rpOk && visualKids <= 3 && msgInRp && toggleOutsideRp,
           swW: sw.offsetWidth, rpW: rp.offsetWidth, visualKids, msgInRp, toggleOutsideRp };
}
```
**팝업 (popup-shell + spec-side) 표준:**
```javascript
() => {
  const aside = document.querySelector('aside.spec-side');
  const frame = document.querySelector('.popup-frame');
  return { ok: !!(aside && frame) && aside.offsetWidth > 100 && frame.offsetWidth > 100,
           asideW: aside?.offsetWidth, frameW: frame?.offsetWidth };
}
```

### 전체 일제 검증 (스크립트)
| 도구 | 목적 | 출력 |
|------|------|------|
| `scripts/verify_all_pages.py` | 1,424 HTML headless 전수: 마커 mismatch · placeholder-h3 · 콘솔 에러 · setCase fallback 로드 | `scripts/verify_all.json` |
| `scripts/verify_msgtbl_60.py` | msg-tbl이 right-panel 내부 + 좌측 본문 정상 폭 검증 | stdout OK/BAD 리스트 |
| `scripts/verify_rename.py` | 공급자→공급업체·수요자→수요기관 치환 잔존 검사 | stdout |
| `scripts/audit_mirror_lr.py` | 좌·우 마커 set 정합 (left_only/right_only/mismatch) | JSON |
| `scripts/audit_markers_admin.py` (·_v2·_supplier_all) | 5+a 위반 패턴 검출 (p1b/p2/p3/p4/p5) | stdout/JSON |
| `scripts/audit_content_match.py` | 좌측 필드 라벨 ↔ 우측 spec-field 라벨 의미 매칭 | JSON |
| `scripts/audit_cases.py` | 화면 case-{g}-{v} 클래스 ↔ 우측 setCase 칩 매칭 | JSON |
| `scripts/audit_p1b_adjacent.py` | 인접 중복 num-badge-sm 검출 | stdout |

### 정정 도구
| 도구 | 처리 |
|------|------|
| `scripts/patch_phase{1..5}_*.py` | 5+a 패턴 정정 (위반 자동 수리) |
| `scripts/patch_left_only_to_right.py` | 좌측 마커 누락 시 우측에서 자동 spec-field 생성 |
| `scripts/patch_right_only_to_left.py` · `_partial` | 우측 잉여 마커 제거 또는 부분 보존 |
| `scripts/patch_placeholder_bullets.py` | `<ul class="spec-bullets">` 빈 li를 element-type 추론으로 보강 |
| `scripts/patch_case_chips.py` | left_only case → 우측 setCase 칩 자동 추가 / right_only 제거 |
| `scripts/fix_pathname_regex.py` | `replace(/\/g,'/')` → `replace(/\\/g,'/')` JS syntax 버그 |
| `scripts/fix_gnb_search_null.py` | `#gnb-search-panel button` null guard 주입 |
| `scripts/fix_stray_blob_export.py` | `;var a=document.createElement('a')...URL.revokeObjectURL` 가비지 잔재 제거 |
| `scripts/fix_msgtbl_outside_rightpanel.py` | msg-tbl이 right-panel 외부 또는 panel-toggle-wrap 내부로 이탈 (3패턴) |
| `scripts/fix_hidden_markers.py` | `.ui-marker { display:none }` 폐기 CSS 제거 |
| `scripts/fix_nonstandard_sec.py` | 비숫자 num-badge 정정 |
| `scripts/remove_placeholder_h3.py` | `(섹션 N)` placeholder h3 정리 |

### 검증 워크플로 (신규 페이지 + 정합 공통)
```
1. PostToolUse 훅 `.claude/hooks/html-lint.ps1` 자동 검출 (저장 시)
2. 단일 페이지 — Playwright MCP로 시각 확인
3. 묶음 작업 — 작업 시작 전 audit_*.py로 baseline, 작업 후 재실행으로 delta 확인
4. 전체 — verify_all_pages.py로 회귀 검사 (콘솔 에러·marker mismatch)
```

### 흔한 실패 패턴 (regression watch)
- **msg-tbl 이탈** → root-shell 자식이 4개 이상이면 의심. `verify_msgtbl_*.py` 확인.
- **좌측 본문 2px / 0px** → right-panel 닫는 `</div>` 위치 잘못. msg-tbl 위에 misplace된 `</div>` 검색.
- **콘솔 에러 `Cannot set properties of null`** → admin-nav.js 렌더 전 inline script가 GNB 엘리먼트 접근. null guard 추가.
- **CASE 칩 클릭 무동작** → setcase-fallback.js 미주입. `<script src=".../setcase-fallback.js"></script>` 확인.
- **CASE 전환 칩이 텍스트만** → setCase 호출/case-* 클래스 부재로 빈 case-group. `restore_case_chips.py` 또는 `remove_empty_case_groups.py`.
- **placeholder "(섹션 N)" 잔재** → patch_left_only_to_right의 자동 헤더. `remove_placeholder_h3.py`.
- **JS syntax 버그 미터미네이트 regex** → `replace(/\/g,` 패턴. `fix_pathname_regex.py`.

## 관련 메모리
`feedback_screen_marker_convention` · `feedback_right_panel_table_format` · `feedback_spec_no_impl_details` · `feedback_common_confirm_modal` · `feedback_python_http_server_cache` · `feedback_avoid_inline_window_open` · `project_regex_pathname_bug` · `project_msgtbl_outside_fix_260525` · `project_case_chip_audit_260524`
