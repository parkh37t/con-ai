/** 인라인 CSS — 시스템 글꼴만 쓰고 외부 자원(@import·url())을 넣지 않는다. */
export const STYLES: string = `
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif;font-size:14px;line-height:1.45;color:#1f2933;background:#f4f6f8}
button,input,select,textarea{font:inherit;color:inherit}
.con-ai-toolbar{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;padding:6px 12px;background:#1f2933;color:#e4e7eb;font-size:12px;position:sticky;top:0;z-index:20}
.con-ai-toolbar[hidden]{display:none}
.con-ai-toolbar .tb-group{display:inline-flex;gap:4px;align-items:center}
.con-ai-toolbar .tb-label{opacity:.7;margin-right:2px}
.con-ai-toolbar button{background:#3e4c59;color:#fff;border:1px solid #52606d;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:12px}
.con-ai-toolbar button.is-active{background:#2f80ed;border-color:#2f80ed}
.con-ai-toolbar .tb-status{margin-left:auto;opacity:.9;max-width:60%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.root-shell,.popup-shell{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:16px;padding:16px;align-items:start}
.root-shell[data-device="mobile"] .screen-wrap,.popup-shell[data-device="mobile"] .popup-wrap{max-width:420px;margin:0 auto}
.screen-wrap,.popup-wrap{background:#fff;border:1px solid #d9dee3;border-radius:6px;min-width:0;overflow:hidden}
.popup-wrap{max-width:760px;margin:0 auto;box-shadow:0 8px 24px rgba(0,0,0,.12)}
#right-panel,.spec-side{background:#fff;border:1px solid #d9dee3;border-radius:6px;padding:12px 14px;font-size:12px;position:sticky;top:44px;max-height:calc(100vh - 60px);overflow:auto;min-width:0}
body.is-embedded #right-panel,body.is-embedded .spec-side{top:0;max-height:100vh}
@media (max-width:960px){.root-shell,.popup-shell{grid-template-columns:1fr}#right-panel,.spec-side{position:static;max-height:none}}
.gnb{display:flex;gap:16px;align-items:center;padding:8px 16px;background:#243b53;color:#fff;font-size:13px}
.gnb .portal{font-weight:700}
.gnb .gnb-menu{opacity:.75}
.breadcrumb{padding:6px 16px;font-size:12px;color:#616e7c;background:#f8fafc;border-bottom:1px solid #eceff1}
.screen-title,.popup-title{margin:0;padding:12px 16px 4px;font-size:18px}
.screen-title small,.popup-title small{font-size:12px;font-weight:400;color:#7b8794;margin-left:8px}
.popup-head{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #d9dee3;background:#f8fafc}
.popup-head .popup-close{margin-right:12px;border:1px solid #cbd2d9;background:#fff;border-radius:4px;padding:4px 10px;cursor:pointer}
.screen-messages{padding:8px 16px 0}
.screen-messages[hidden]{display:none}
.msg{padding:8px 12px;border-radius:4px;border:1px solid;font-size:13px;margin-bottom:6px}
.msg-info{background:#eef5ff;border-color:#b6d4fe;color:#1d4f91}
.msg-success{background:#edf9f0;border-color:#b7e4c7;color:#1e6b3a}
.msg-warning{background:#fff8e6;border-color:#f7d774;color:#8a5a00}
.msg-error{background:#fdecec;border-color:#f5b5b5;color:#9b1c1c}
.msg-confirm{background:#f3f0ff;border-color:#cdc1ff;color:#4b3a9a}
.area{padding:12px 16px 14px;border-bottom:1px solid #eceff1}
.area:last-of-type{border-bottom:0}
.area-title{margin:0 0 10px;font-size:15px;display:flex;align-items:center}
.area-body{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:flex-end}
.badge{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:#2f80ed;color:#fff;font-size:11px;font-weight:700;margin-right:6px;flex:none}
.badge-section{background:#e03131}
.field{display:flex;flex-direction:column;gap:4px;min-width:180px;padding:2px;border-radius:4px}
.field-table,.field-pagination,.field-text,.field-textarea{flex-basis:100%}
.field-button{min-width:0}
.field-label{display:flex;align-items:center;font-size:12px;color:#3e4c59}
.field-label .req{color:#e03131;margin-left:2px}
.field-label .lock{margin-left:6px;font-size:11px;color:#7b8794;border:1px solid #cbd2d9;border-radius:3px;padding:0 4px}
.control input[type="text"],.control input[type="number"],.control input[type="date"],.control select,.control textarea{width:100%;padding:6px 8px;border:1px solid #cbd2d9;border-radius:4px;background:#fff}
.control textarea{min-height:72px;resize:vertical}
.control.range{display:flex;align-items:center;gap:6px}
.control.range input{width:auto;flex:1}
.control.choices{display:flex;flex-wrap:wrap;gap:6px 12px}
.control.choices label{display:inline-flex;align-items:center;gap:4px}
.btn{padding:6px 14px;border:1px solid #2f80ed;background:#2f80ed;color:#fff;border-radius:4px;cursor:pointer}
.btn.btn-secondary{background:#fff;color:#2f80ed}
.static-text{margin:0;color:#3e4c59}
a.link{color:#2f80ed;text-decoration:underline}
.table-tools{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#616e7c;margin-bottom:4px}
.table-scroll{overflow-x:auto}
table.grid{width:100%;border-collapse:collapse;font-size:13px}
table.grid th,table.grid td{border:1px solid #d9dee3;padding:6px 8px;text-align:left;white-space:nowrap}
table.grid th{background:#f0f4f8;font-weight:600}
table.grid th button{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:4px}
table.grid th[aria-sort="ascending"] .sort-ind::after{content:"▲";font-size:10px}
table.grid th[aria-sort="descending"] .sort-ind::after{content:"▼";font-size:10px}
table.grid th[aria-sort="none"] .sort-ind::after{content:"↕";font-size:10px;opacity:.5}
table.grid td.fmt-number,table.grid td.fmt-currency{text-align:right}
table.grid tr.clickable{cursor:pointer}
table.grid tr.clickable:hover{background:#f8fafc}
table.grid tr.empty-row td{text-align:center;color:#7b8794;padding:16px}
.pager{display:flex;gap:4px;justify-content:center;align-items:center}
.pager button{border:1px solid #cbd2d9;background:#fff;border-radius:3px;padding:2px 8px;cursor:pointer}
.pager button.is-current{background:#2f80ed;color:#fff;border-color:#2f80ed}
.screen-status{padding:6px 16px;font-size:11px;color:#616e7c;background:#f8fafc;border-top:1px solid #eceff1;min-height:24px}
.field.is-selected,.desc-item.is-selected,.area.is-selected{outline:2px solid #f2994a;outline-offset:2px}
.is-highlighted{outline:3px solid #f2c94c!important;outline-offset:2px;background:#fffbe6}
.panel-head{margin-bottom:10px}
.panel-head .desc-screen-id{margin:0;font-size:15px;font-family:ui-monospace,Menlo,Consolas,monospace}
.panel-head .panel-meta{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:11px;color:#616e7c;margin-top:4px}
.panel-meta .tag{border:1px solid #cbd2d9;border-radius:3px;padding:0 5px;background:#f8fafc}
.desc-section{margin-bottom:14px}
.desc-title{font-size:13px;margin:0 0 6px;padding-bottom:4px;border-bottom:2px solid #243b53;display:flex;align-items:center;gap:6px}
.desc-title .desc-no{color:#7b8794;font-weight:400;font-size:11px}
.desc-item{display:grid;grid-template-columns:120px minmax(0,1fr);gap:6px;padding:4px 2px;border-bottom:1px dashed #eceff1;cursor:pointer;border-radius:3px}
.desc-item:hover{background:#f8fafc}
.desc-item.is-active{background:#eef5ff}
.desc-item.is-section{background:#f0f4f8;font-weight:600}
.desc-label{font-weight:600;color:#3e4c59;word-break:break-all}
.desc-text{color:#1f2933;word-break:break-word;white-space:pre-wrap}
.desc-text .trace{display:inline-block;margin-left:4px;font-size:10px;color:#1d4f91;background:#eef5ff;border-radius:3px;padding:0 4px}
table.desc-table{width:100%;border-collapse:collapse;font-size:12px}
table.desc-table th,table.desc-table td{border:1px solid #d9dee3;padding:4px 6px;text-align:left;vertical-align:top}
table.desc-table th{background:#f0f4f8}
table.desc-table tr.desc-item{display:table-row;cursor:pointer}
table.desc-table tr.is-active td{background:#eef5ff}
.con-ai-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:30}
.con-ai-modal[hidden]{display:none}
.modal-card{background:#fff;border-radius:6px;min-width:320px;max-width:min(90vw,560px);padding:16px 18px;box-shadow:0 12px 32px rgba(0,0,0,.25)}
.modal-card h2{margin:0 0 8px;font-size:16px}
.modal-card .modal-body p{margin:4px 0;font-size:13px}
.modal-card .modal-foot{margin-top:12px;text-align:right}
`
