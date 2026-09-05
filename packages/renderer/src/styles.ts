/**
 * 인라인 CSS — 화면설계서(설계 문서) 시각 언어.
 *
 * 근거: 목표 예시 문서(BNK 정기주주총회 화면설계서 계열)에서 가져온 규칙을 토큰으로 옮겼다.
 *  - 좌측 목업 : 우측 설명 = flex 11.5 : 4.5, 설명 최소 폭 360px, 사이에 2px 검은 세로 경계선
 *  - 영역은 둥근 테두리 카드(.sec 1.5px solid #333 / radius 10px)이고 좌상단 바깥으로 검은 사각 번호 배지가 걸친다
 *  - 요소 표시는 파란 원형 배지(#1d6ef5)가 라벨 앞에 인라인으로 붙는다
 *  - 표는 회색 머리(#f1f3f5) + 얇은 테두리(#444) + 넉넉한 행 높이(8~10px 패딩)
 *  - 버튼은 검은 채움(주요)과 흰 배경 테두리(보조) 두 단계
 *  - 우측 패널은 모노스페이스 화면 ID + 2.5px 밑줄 → 개요 표 → 작은 회색 절 라벨 → 영역/요소 목록 → 검은 머리 메시지 표
 *  - 전체가 흰 바탕·검정 위주이며 여백이 넉넉하다("웹앱"이 아니라 "설계 문서")
 *
 * 제약: 외부 자원(@import·url()·웹폰트·이미지)을 넣지 않는다. 글꼴은 시스템에 있는 것만 고른다.
 * 다크모드는 두지 않는다 — 설계 문서는 흰 바탕 고정이다.
 */
export const STYLES: string = `
:root{
  /* 색 — 목표 문서에서 그대로 옮긴 값 */
  --ink:#111;              /* 번호 배지·세로 경계선 (목표 .mk background:#000, .screen-wrap border-right 2px solid #000) */
  --ink-text:#222;         /* 본문 글자·버튼 테두리 (목표 body color:#222) */
  --line-card:#333;        /* 영역 카드 테두리 (목표 .sec border 1.5px solid #333) */
  --line-cell:#444;        /* 표 셀 테두리 (목표 table.w th,td border 1px solid #444) */
  --line-item:#ddd;        /* 설명 항목 구분선 (목표 .spec border-bottom 1px solid #ddd) */
  --line-soft:#e5e8eb;     /* 머리·구분 보조선 */
  --fill-head:#f1f3f5;     /* 표 머리·라벨 열 배경 (목표 table.w th / table.info th) */
  --fill-bar:#fafafa;      /* GNB·팝업 머리 배경 (목표 .gnb background:#fafafa) */
  --stage:#e9edf1;         /* 모바일·팝업 무대 배경 (목표 모바일 문서의 .screen-wrap background) */
  --muted:#777;            /* 유틸 메뉴 (목표 .gnb .util color:#777) */
  --muted-2:#888;          /* 보조 설명 (목표 .note color:#888) */
  --muted-3:#999;          /* 절 라벨 (목표 .mk-lbl color:#999) */
  --accent:#1d6ef5;        /* 요소 원형 배지 (목표 .sm background:#1d6ef5) */
  --accent-soft:#eef4ff;   /* 정책 강조 배경 (목표 .pol background) */
  /* 간격 — 목표 문서의 .body-wrap padding:26px 30px 60px / .sec margin-bottom:26px */
  --gap-page:26px 30px 60px;
  --gap-card:22px 20px 18px;
  --gap-stack:26px;
  --page-max:1180px;
  /* 글꼴 — 시스템에 있는 것만. 외부 웹폰트를 불러오지 않는다 */
  --font:'Pretendard','Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif;
  --font-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:var(--font);font-size:14px;line-height:1.55;color:var(--ink-text);background:#fff;display:flex;flex-direction:column;height:100vh;overflow:hidden}
button,input,select,textarea{font:inherit;color:inherit}

/* ── 미리보기 도구 막대 (문서 위 얇은 흰 띠. 격리 표시 때는 숨긴다) ── */
.con-ai-toolbar{flex:none;display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;padding:8px 20px;background:#fff;border-bottom:1.5px solid var(--ink-text);font-size:12px;color:#555}
.con-ai-toolbar[hidden]{display:none}
.con-ai-toolbar .tb-group{display:inline-flex;gap:6px;align-items:center}
.con-ai-toolbar .tb-label{font-size:10.5px;letter-spacing:.12em;color:var(--muted-3);font-weight:700}
.con-ai-toolbar button{background:#fff;color:#444;border:1.2px solid #b9c0c7;border-radius:999px;padding:3px 12px;cursor:pointer;font-size:12px;font-weight:700}
.con-ai-toolbar button small{font-weight:600;color:inherit;opacity:.75}
.con-ai-toolbar button:hover{border-color:var(--ink-text);color:#000}
.con-ai-toolbar button.is-active{background:var(--ink);border-color:var(--ink);color:#fff}
.con-ai-toolbar .tb-meta{color:var(--muted-2)}
.con-ai-toolbar .tb-status{margin-left:auto;color:var(--muted-2);max-width:46%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* ── shell: 좌 목업 / 우 설명 (목표 문서 flex 11.5 : 4.5, 최소 360px) ── */
.root-shell,.popup-shell{flex:1 1 auto;min-height:0;display:flex;width:100%}
.screen-wrap,.popup-wrap{flex:11.5;min-width:0;overflow-y:auto;overflow-x:hidden;background:#fff}
#right-panel,.spec-side{flex:4.5;min-width:360px;overflow-y:auto;background:#fff;border-left:2px solid var(--ink);padding:22px 24px 64px}
@media (max-width:1000px){
  body{height:auto;overflow:visible}
  .root-shell,.popup-shell{flex-direction:column}
  .screen-wrap,.popup-wrap,#right-panel,.spec-side{overflow:visible}
  #right-panel,.spec-side{border-left:0;border-top:2px solid var(--ink);min-width:0}
}

/* ── GNB · breadcrumb (목표 문서 .gnb: 56px, 로고 pill, 활성 메뉴 밑줄, 우측 유틸) ── */
.screen-head{position:relative;flex:none}
.gnb{height:58px;border-bottom:1.5px solid var(--ink-text);display:flex;align-items:center;gap:26px;padding:0 28px;background:var(--fill-bar)}
.gnb .logo{min-width:124px;height:28px;padding:0 12px;border:1.5px solid var(--ink-text);border-radius:4px;display:grid;place-items:center;font-size:12px;font-weight:800;letter-spacing:.06em;white-space:nowrap}
.gnb-menu{display:flex;align-items:center;gap:24px;min-width:0}
.gnb-menu .m{font-size:14px;font-weight:600;color:#333;white-space:nowrap}
.gnb-menu .m.on{color:#000;font-weight:800;border-bottom:2px solid var(--ink-text);padding-bottom:3px}
.gnb .util{margin-left:auto;display:flex;gap:12px;font-size:12px;color:var(--muted);white-space:nowrap}
.gnb .ham{display:none;width:36px;height:36px;margin-left:auto;border:1.5px solid var(--ink-text);border-radius:8px;background:#fff;font-size:15px;font-weight:800;cursor:pointer;place-items:center}
.breadcrumb{padding:9px 30px;font-size:12px;color:var(--muted);background:#fff;border-bottom:1px solid var(--line-soft)}
.breadcrumb b{color:#333;font-weight:700}

/* ── 목업 본문 (목표 .body-wrap: 26px 30px 60px, 최대 1180px 가운데) ── */
.body-wrap{padding:var(--gap-page);max-width:var(--page-max);margin:0 auto}
.screen-title-row{display:flex;align-items:baseline;gap:14px;justify-content:space-between;border-bottom:2px solid var(--ink);padding-bottom:12px;margin-bottom:26px}
.screen-title{margin:0;font-size:22px;font-weight:800;letter-spacing:-.01em;color:#111}
.screen-title-row .screen-id{font-family:var(--font-mono);font-size:11.5px;color:var(--muted-3);white-space:nowrap}

/* 화면 메시지 (CASE 전환으로 나타난다) */
.screen-messages{margin:0 0 22px;display:grid;gap:8px}
.screen-messages[hidden]{display:none}
.msg{padding:10px 14px;border:1px solid var(--line-cell);border-left-width:5px;border-radius:0 6px 6px 0;font-size:13px;background:#fff}
.msg-info{border-left-color:var(--accent);background:var(--accent-soft)}
.msg-success{border-left-color:#1e7d43;background:#f0f8f2}
.msg-warning{border-left-color:#b3730a;background:#fdf7e8}
.msg-error{border-left-color:#b42318;background:#fdf1f0}
.msg-confirm{border-left-color:#4b3a9a;background:#f4f2fd}

/* ── 영역 카드 + 걸친 번호 배지 (목표 .sec + .mk) ── */
.area{position:relative;border:1.5px solid var(--line-card);border-radius:10px;padding:var(--gap-card);margin:0 0 var(--gap-stack);background:#fff}
.area-title{margin:0 0 14px;font-size:16px;font-weight:800;color:#111;display:flex;align-items:center;gap:8px}
.area-title .lock{margin-left:2px}
.area-note{margin:-8px 0 14px;font-size:12px;color:var(--muted-2)}
.area-body{display:flex;flex-wrap:wrap;gap:16px 22px;align-items:flex-end}
/* 요소가 모두 텍스트인 영역은 "기본 정보 표"처럼 행을 붙여 쌓는다 */
.area-info .area-body{display:block}

/* 배지: 영역=검은 사각(카드 바깥으로 걸침) / 요소=파란 원형(라벨 앞 인라인) */
.badge{display:inline-grid;place-items:center;font-weight:800;flex:none}
.badge-section{position:absolute;top:-14px;left:-14px;width:28px;height:28px;border-radius:7px;background:var(--ink);color:#fff;font-size:14px;border:2px solid #fff;box-shadow:0 0 0 1.5px var(--ink);z-index:1}
.badge-element{min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:var(--accent);color:#fff;font-size:11.5px;margin-right:6px}

/* ── 요소(필드) ── */
.field{display:flex;flex-direction:column;gap:6px;min-width:190px;padding:2px;border-radius:4px}
.field-table,.field-pagination,.field-textarea{flex-basis:100%;min-width:0}
.field-button,.field-link{min-width:0;flex-direction:row;align-items:center;gap:0}
.field-text{flex-basis:100%;min-width:0;flex-direction:row;align-items:stretch;gap:0;border:1px solid var(--line-cell);margin-bottom:-1px;padding:0;border-radius:0}
.field-text .field-label{width:150px;flex:none;background:var(--fill-head);border-right:1px solid var(--line-cell);padding:9px 11px;margin:0;font-weight:700}
.field-text .control{flex:1;min-width:0;padding:9px 11px;display:flex;align-items:center}
.field-label{display:flex;align-items:center;font-size:12.5px;font-weight:700;color:#333}
.field-label .label-text{white-space:nowrap}
.field-label .req{color:#c1121f;margin-left:3px}
.field-label .lock{margin-left:6px;font-size:10.5px;font-weight:700;color:#555;border:1px solid #aaa;border-radius:3px;padding:0 5px;background:#fff}
.field-button .field-label,.field-link .field-label{margin-right:0}
.control{min-width:0}
.control input[type="text"],.control input[type="number"],.control input[type="date"],.control select,.control textarea{width:100%;padding:8px 10px;border:1.5px solid #b6bec6;border-radius:5px;background:#fff;color:#333}
/* 한 줄 컨트롤 높이를 맞춰 검색 줄의 라벨·입력·버튼 바닥선이 어긋나지 않게 한다 */
.control input[type="text"],.control input[type="number"],.control input[type="date"],.control select{height:38px}
.control input::placeholder,.control textarea::placeholder{color:#a8b0b8}
.control textarea{min-height:84px;resize:vertical}
.control.range{display:flex;align-items:center;gap:8px}
.control.range input{width:auto;flex:1;min-width:130px}
.control.range .range-sep{color:var(--muted-2)}
.control.choices{display:flex;flex-wrap:wrap;gap:8px 16px}
.control.choices label{display:inline-flex;align-items:center;gap:5px;font-size:13px}
.static-text{margin:0;color:#333}
.static-text.is-placeholder{color:var(--muted-2)}
a.link{color:#111;text-decoration:underline;text-underline-offset:3px;font-weight:700}

/* 버튼 위계 — 주요=검은 채움, 보조=흰 배경 테두리 (목표 .btn / .btn.dark) */
.btn{padding:9px 20px;border:1.5px solid var(--ink-text);background:var(--ink-text);color:#fff;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer}
.btn:hover{background:#000;border-color:#000}
.btn.btn-secondary{background:#fff;color:#111}
.btn.btn-secondary:hover{background:#f4f6f8}

/* ── 표 (목표 table.w: 회색 머리, 얇은 테두리, 넉넉한 행) ── */
.table-tools{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:12px;color:var(--muted-2);margin-bottom:7px}
.table-tools .row-count{font-weight:700;color:#333}
.table-scroll{overflow-x:auto}
table.grid{width:100%;border-collapse:collapse;font-size:13px;background:#fff}
table.grid th,table.grid td{border:1px solid var(--line-cell);padding:9px 11px;text-align:left;white-space:nowrap}
table.grid th{background:var(--fill-head);font-weight:700;color:#111}
table.grid th button{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:5px;font-weight:700}
table.grid th[aria-sort="ascending"] .sort-ind::after{content:"▲";font-size:9px}
table.grid th[aria-sort="descending"] .sort-ind::after{content:"▼";font-size:9px}
table.grid th[aria-sort="none"] .sort-ind::after{content:"↕";font-size:9px;color:var(--muted-3)}
table.grid td.fmt-number,table.grid td.fmt-currency{text-align:right;font-variant-numeric:tabular-nums}
table.grid tr.clickable{cursor:pointer}
table.grid tr.clickable:hover{background:#f6f8fa}
table.grid tr.empty-row td{text-align:center;color:var(--muted-2);padding:26px 10px;white-space:normal}

/* 페이지 이동 */
.pager{display:flex;gap:6px;justify-content:center;align-items:center;margin-top:4px}
.pager button{min-width:30px;height:30px;border:1px solid var(--line-cell);background:#fff;border-radius:4px;padding:0 8px;cursor:pointer;font-size:12.5px;font-weight:700}
.pager button.is-current{background:var(--ink);color:#fff;border-color:var(--ink)}

/* 상태 줄 — 더미 동작 결과를 적는 곳 */
.screen-status{margin:0 auto;padding:12px 30px 26px;font-size:11.5px;color:var(--muted-2);border-top:1px dashed #cfd6dd;max-width:var(--page-max);min-height:22px}

/* ── 팝업 shell — 무대 위의 카드 (페이지 구조를 복사하지 않는다) ── */
.popup-wrap{background:var(--stage);padding:36px 24px 64px}
.popup-card{max-width:780px;margin:0 auto;background:#fff;border:1.5px solid var(--ink-text);border-radius:10px;box-shadow:0 18px 44px rgba(0,0,0,.18);overflow:hidden}
.popup-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:15px 20px;background:var(--fill-bar);border-bottom:1.5px solid var(--ink-text)}
.popup-title{margin:0;font-size:16.5px;font-weight:800;color:#111}
.popup-title small{margin-left:9px;font-family:var(--font-mono);font-size:11.5px;font-weight:400;color:var(--muted-3)}
.popup-close{border:1.5px solid var(--ink-text);background:#fff;border-radius:6px;padding:6px 14px;font-size:12.5px;font-weight:700;cursor:pointer}
.popup-body{padding:24px 22px 8px}
.popup-body .area:last-of-type{margin-bottom:22px}
.popup-wrap .screen-status{max-width:780px;border-top:0;padding:6px 4px 0}

/* ── 모바일: 폰 프레임 (목표 모바일 문서 .phone: 9px 검은 테두리, radius 34px, 그림자) ── */
.phone-status{display:none}
.root-shell[data-device="mobile"],.popup-shell[data-device="mobile"]{background:var(--stage)}
.root-shell[data-device="mobile"] #right-panel,.popup-shell[data-device="mobile"] .spec-side{flex:0 0 auto;width:30%;min-width:360px;max-width:480px}
.root-shell[data-device="mobile"] .screen-wrap{flex:0 0 auto;width:420px;max-width:420px;margin:26px auto;align-self:flex-start;max-height:calc(100% - 52px);border:9px solid var(--ink);border-radius:34px;box-shadow:0 20px 55px rgba(0,0,0,.28)}
.popup-shell[data-device="mobile"] .popup-wrap{flex:1 1 auto}
.popup-shell[data-device="mobile"] .popup-card{max-width:420px}
[data-device="mobile"] .phone-status{display:flex;height:28px;justify-content:space-between;align-items:center;padding:0 18px;font-size:10.5px;font-weight:700;letter-spacing:.04em;color:#333;background:#fff}
[data-device="mobile"] .gnb{height:50px;padding:0 14px;gap:10px}
[data-device="mobile"] .gnb .logo{min-width:96px;height:24px;font-size:11px}
[data-device="mobile"] .gnb-menu,[data-device="mobile"] .gnb .util{display:none}
[data-device="mobile"] .gnb .ham{display:grid}
[data-device="mobile"] .gnb.is-open .gnb-menu{display:flex;flex-direction:column;align-items:stretch;gap:0;position:absolute;left:0;right:0;top:100%;background:#fff;border-bottom:2px solid var(--ink-text);z-index:6}
[data-device="mobile"] .gnb.is-open .gnb-menu .m{padding:13px 18px;border-bottom:1px solid #eee;font-size:14px;font-weight:700}
[data-device="mobile"] .gnb.is-open .gnb-menu .m.on{background:var(--fill-head);border-bottom:1px solid #eee;padding-bottom:13px}
[data-device="mobile"] .breadcrumb{padding:8px 14px;font-size:11.5px}
[data-device="mobile"] .body-wrap{padding:16px 13px 44px;max-width:none}
[data-device="mobile"] .screen-title-row{margin-bottom:20px;padding-bottom:10px;flex-wrap:wrap;gap:4px}
[data-device="mobile"] .screen-title{font-size:18px}
[data-device="mobile"] .area{padding:18px 13px 14px;margin-bottom:22px}
[data-device="mobile"] .area-title{font-size:14.5px}
[data-device="mobile"] .badge-section{top:-12px;left:-9px;width:25px;height:25px;font-size:13px}
/* 폰 폭에서는 요소를 한 줄씩 쌓는다. block 배치라 넓은 표가 열 폭을 밀어내지 못한다(표는 .table-scroll 안에서 가로 스크롤). */
[data-device="mobile"] .area-body{display:block}
[data-device="mobile"] .area-body>.field{margin-bottom:14px}
[data-device="mobile"] .area-body>.field:last-child{margin-bottom:0}
[data-device="mobile"] .field{min-width:0}
[data-device="mobile"] .field-text .field-label{width:104px}
[data-device="mobile"] .table-tools{flex-wrap:wrap;gap:2px 8px}
[data-device="mobile"] table.grid{font-size:12px}
[data-device="mobile"] table.grid th,[data-device="mobile"] table.grid td{padding:7px 8px}
[data-device="mobile"] .screen-status{padding:10px 14px 20px}
[data-device="mobile"] .control.range{flex-wrap:wrap}
[data-device="mobile"] .control.range input{min-width:0}

/* ── 우측 설명 패널 (목표 문서 우측 디스크립션) ── */
.desc-screen-id{margin:0 0 10px;font-family:var(--font-mono);font-size:17px;font-weight:800;color:#000;border-bottom:2.5px solid #000;padding-bottom:10px;word-break:break-all}
.panel-meta{display:flex;flex-wrap:wrap;gap:5px 7px;font-size:10.5px;color:var(--muted);margin-bottom:6px}
.panel-meta .tag{border:1px solid #ccc;border-radius:3px;padding:1px 6px;background:#fafafa}
.desc-section{margin-bottom:6px}
.desc-kicker{font-size:11px;letter-spacing:.12em;color:var(--muted-3);font-weight:700;margin:20px 0 7px}
.desc-items{margin:0}

/* 개요 표 (목표 table.info: 라벨 열 회색, 1.5px 검은 테두리) */
table.info-table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:4px}
table.info-table th,table.info-table td{border:1.5px solid var(--line-card);padding:9px 10px;text-align:left;vertical-align:top}
table.info-table th{width:92px;background:var(--fill-head);font-weight:700;white-space:nowrap}
table.info-table tr.desc-item{display:table-row;border-bottom:0;padding:0}
table.info-table tr.is-active td,table.info-table tr.desc-item:hover td{background:var(--accent-soft)}

/* 항목 한 줄 (목표 .spec: 파란 원형 배지 + 굵은 이름 + " — " + 설명, 옅은 구분선) */
.desc-item{padding:9px 2px;border-bottom:1px solid var(--line-item);font-size:13px;color:#333;cursor:pointer}
.desc-item:hover{background:#f7f9fb}
.desc-item.is-active{background:var(--accent-soft)}
.desc-item .desc-label{font-weight:800;color:#000}
.desc-item .desc-sep{color:var(--muted-2);margin:0 5px}
.desc-item .desc-text{color:#333;word-break:break-word}

/* 영역 머리 (목표 .sp-h: 정적 검은 사각 배지 + 굵은 제목 + 2px 검은 밑줄) */
.desc-item.desc-area-head{display:flex;align-items:center;gap:8px;font-size:14.5px;font-weight:800;color:#111;border-bottom:2px solid #000;padding:15px 2px 8px;margin:8px 0 0}
.desc-item.desc-area-head .badge-section{position:static;width:24px;height:24px;border:0;box-shadow:none;font-size:13px;border-radius:6px}
.desc-item.desc-area-head .desc-label{font-weight:800}
.desc-text .trace{display:inline-block;margin-left:4px;font-size:10.5px;color:#123f7b;background:var(--accent-soft);border:1px solid #c9dbf7;border-radius:3px;padding:0 5px;font-weight:700}

/* 정책 강조 (목표 .pol: 파란 왼쪽 막대 + 연한 파란 배경) */
.desc-policy{border-left:4px solid var(--accent);background:var(--accent-soft);border-radius:0 8px 8px 0;padding:4px 12px 6px}
.desc-policy .desc-item{border-bottom:1px solid #d7e3f7}
.desc-policy .desc-item:last-child{border-bottom:0}
.desc-policy .desc-item:hover{background:#e3edfd}

/* 표형 절 (CASE·데이터 매핑) */
table.desc-table{width:100%;border-collapse:collapse;font-size:12.5px}
table.desc-table th,table.desc-table td{border:1px solid var(--line-cell);padding:8px 9px;text-align:left;vertical-align:top}
table.desc-table th{background:var(--fill-head);font-weight:700;color:#111}
table.desc-table .col-kind,table.msg-table .col-kind{white-space:nowrap;width:1%}
table.desc-table tr.desc-item{display:table-row;border-bottom:0}
table.desc-table tr.is-active td{background:var(--accent-soft)}
table.desc-table td .desc-label{font-weight:700}

/* 메시지 표 (목표 .msg: 검은 머리 행) */
table.msg-table{width:100%;border-collapse:collapse;font-size:12.5px}
table.msg-table th,table.msg-table td{border:1px solid #555;padding:8px 9px;text-align:left;vertical-align:top}
table.msg-table th{background:var(--ink-text);color:#fff;font-weight:700}
table.msg-table tr.desc-item{display:table-row;border-bottom:0}
table.msg-table tr.is-active td{background:var(--accent-soft)}

/* 선택·강조 (부모 창의 코멘트·하이라이트 연동) */
.field.is-selected,.desc-item.is-selected,.area.is-selected{outline:2px solid #f2994a;outline-offset:3px}
.is-highlighted{outline:3px solid #f2c94c!important;outline-offset:3px;background:#fffbe6}

/* 간단 모달 (팝업 열기 더미 동작) */
.con-ai-modal{position:fixed;inset:0;background:rgba(17,17,17,.45);display:flex;align-items:center;justify-content:center;z-index:30;padding:20px}
.con-ai-modal[hidden]{display:none}
.modal-card{background:#fff;border:1.5px solid var(--ink-text);border-radius:10px;min-width:320px;max-width:min(92vw,560px);max-height:86vh;overflow:auto;padding:20px 22px;box-shadow:0 18px 44px rgba(0,0,0,.28)}
.modal-card h2{margin:0 0 10px;font-size:16px;font-weight:800;border-bottom:2px solid var(--ink);padding-bottom:8px}
.modal-card .modal-body p{margin:5px 0;font-size:13px;color:#333}
.modal-card .modal-foot{margin-top:16px;text-align:right}
`
