/**
 * 격리 iframe 안에서 실행되는 V3 조사 스크립트 (문자열).
 *
 * 이 스크립트는 **판정하지 않는다.** 화면을 실제로 조작하고(콘솔 오류 수집 · CASE 전환 · 검색 · 다운로드)
 * 관찰값만 부모에게 돌려준다. pass/fail 판정은 부모의 `judgeV3`(타입 있는 코드)가 하며, 판정 규칙은
 * 서버의 `packages/validators/src/v3.ts` 와 같다.
 *
 * 안에서 무엇을 보는지는 v3.ts 와 같은 선택자다:
 *   행 `tr[data-row]` · 메시지 `[data-messages] [data-message-id]` · 현재 CASE `body[data-case]`
 *   CASE 버튼 `button[data-case]` · 검색 트리거 `[data-action-type="filter-fixture"]`
 *   다운로드 트리거 `[data-action-type="download-fixture"]` · 상태 `[data-screen-status] [data-status]`
 */

/** 부모 → iframe 요청. */
export const V3_RUN_MESSAGE = 'con-ai:v3-run'
/** iframe → 부모: 준비됨 / 결과. */
export const V3_READY_MESSAGE = 'con-ai:v3-ready'
export const V3_DONE_MESSAGE = 'con-ai:v3-done'

/** 검색어가 어떤 행에도 없도록 고른 문자열 (v3.ts 와 같은 값). */
export const NO_MATCH_VALUE = '__con-ai-no-match__'

/** CASE 전환을 기다리는 상한 (v3.ts SWITCH_WAIT_MS 와 같다). */
export const SWITCH_WAIT_MS = 1500

/** CASE 전환 한 걸음의 관찰값. */
export interface V3CaseStep {
  id: string
  /** body[data-case] 가 실제로 이 값으로 바뀌었는가. */
  switched: boolean
  rows: number
  /** 보이는 메시지 id 를 ',' 로 이은 값. */
  messages: string
  /** 이 걸음 동안 새로 생긴 콘솔 오류 수. */
  errors: number
}

export interface V3SearchProbe {
  ran: boolean
  reason?: string
  case_id?: string
  selector?: string
  submit?: 'trigger' | 'enter'
  value?: string
  before?: number
  matched?: number
  none?: number
  messages?: string
  errors?: number
}

export interface V3DownloadProbe {
  ran: boolean
  reason?: string
  status_text?: string
  errors?: number
}

/** iframe 이 돌려주는 관찰값 전부. */
export interface V3Probe {
  case_ids: string[]
  load_errors: number
  total_errors: number
  /** 앞 20건만 (근거로 적는다). */
  errors: string[]
  case_steps: V3CaseStep[]
  search: V3SearchProbe
  download: V3DownloadProbe
}

/**
 * iframe 안에 넣는 스크립트 본문. 화살표 함수·optional chaining 을 쓰지 않고 단순하게 둔다
 * (산출물 HTML 은 오프라인 단일 파일이고 이 스크립트도 그 안에서 그대로 돈다).
 */
export const V3_HARNESS_SOURCE = `(function () {
  var errors = [];
  var origError = console.error;
  console.error = function () {
    try { errors.push('console.error: ' + Array.prototype.join.call(arguments, ' ')); } catch (e) { errors.push('console.error: (읽을 수 없음)'); }
    try { origError.apply(console, arguments); } catch (e) { /* 무시 */ }
  };
  window.addEventListener('error', function (e) { errors.push('pageerror: ' + (e && e.message ? e.message : String(e))); });
  window.addEventListener('unhandledrejection', function (e) { errors.push('pageerror: unhandled rejection ' + String(e && e.reason)); });

  function qa(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function rowCount() { return qa('tr[data-row]').length; }
  function messageIds() {
    return qa('[data-messages] [data-message-id]').map(function (e) { return e.getAttribute('data-message-id') || ''; }).join(',');
  }
  function currentCase() { return document.body.getAttribute('data-case') || ''; }
  function caseIds() { return qa('button[data-case]').map(function (e) { return e.getAttribute('data-case') || ''; }); }
  function esc(v) { return String(v).replace(/["\\\\]/g, '\\\\$&'); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function clickCase(id) {
    if (currentCase() === id) return Promise.resolve(false);
    var btn = document.querySelector('button[data-case="' + esc(id) + '"]');
    if (!btn) return Promise.resolve(false);
    btn.click();
    var deadline = Date.now() + ${SWITCH_WAIT_MS};
    function check() {
      if (currentCase() === id) return Promise.resolve(true);
      if (Date.now() > deadline) return Promise.resolve(false);
      return sleep(20).then(check);
    }
    return check();
  }
  function ensureCase(id) { return currentCase() === id ? Promise.resolve(true) : clickCase(id); }

  /** 표시된 행들 가운데 한 행에만 나오는 셀 값 (첫 컬럼 우선) — v3.ts pickUniqueCellValue 와 같다. */
  function pickUniqueCellValue() {
    var grid = qa('tr[data-row]').map(function (tr) {
      return Array.prototype.slice.call(tr.querySelectorAll('td')).map(function (td) { return (td.textContent || '').trim(); });
    });
    if (grid.length === 0) return undefined;
    var width = 0;
    grid.forEach(function (r) { if (r.length > width) width = r.length; });
    for (var col = 0; col < width; col++) {
      var values = grid.map(function (r) { return r[col] || ''; });
      for (var i = 0; i < values.length; i++) {
        var v = values[i];
        if (v !== '' && values.filter(function (x) { return x === v; }).length === 1) return v;
      }
    }
    var first = grid[0] || [];
    for (var k = 0; k < first.length; k++) if (first[k] !== '') return first[k];
    return undefined;
  }

  /** 검색 동작에 연결된 텍스트 입력 선택자 — v3.ts fillSearchInput 과 같은 규칙. */
  function searchSelector() {
    var inputs = [];
    try {
      var dataEl = document.getElementById('con-ai-data');
      var data = JSON.parse((dataEl && dataEl.textContent) || '{}');
      var actions = data.actions || [];
      for (var i = 0; i < actions.length; i++) if (actions[i].type === 'filter-fixture') { inputs = actions[i].inputs || []; break; }
    } catch (e) { inputs = []; }
    var textTypes = ['text-input', 'number-input', 'textarea'];
    for (var j = 0; j < inputs.length; j++) {
      var el = document.querySelector('[data-input-for="' + esc(inputs[j]) + '"]');
      if (el && textTypes.indexOf(el.getAttribute('data-input-type') || '') >= 0) return '[data-input-for="' + inputs[j] + '"]';
    }
    var any = document.querySelector('[data-region="screen"] input[type="text"][data-input-for]');
    if (any) return '[data-input-for="' + (any.getAttribute('data-input-for') || '') + '"]';
    return '';
  }

  function fill(selector, value) {
    var el = document.querySelector(selector);
    if (!el) return false;
    el.focus();
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  function submit(selector) {
    var trigger = document.querySelector('[data-action-type="filter-fixture"]');
    if (trigger) { trigger.click(); return 'trigger'; }
    var el = document.querySelector(selector);
    if (el) el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return 'enter';
  }

  function statusText() {
    var el = document.querySelector('[data-screen-status] [data-status]');
    return el ? (el.textContent || '') : '';
  }

  function checkCases() {
    var ids = caseIds();
    var start = ids.indexOf(currentCase()) + 1;
    var order = ids.map(function (_, i) { return ids[(start + i) % ids.length]; });
    var steps = [];
    return order.reduce(function (chain, id) {
      return chain.then(function () {
        var before = errors.length;
        return clickCase(id).then(function (switched) {
          steps.push({ id: id, switched: switched, rows: rowCount(), messages: messageIds(), errors: errors.length - before });
        });
      });
    }, Promise.resolve()).then(function () { return { ids: ids, steps: steps }; });
  }

  function checkSearch() {
    var ids = caseIds();
    var best = '';
    var bestRows = 0;
    var failed = '';
    return ids.reduce(function (chain, id) {
      return chain.then(function () {
        if (failed) return;
        return ensureCase(id).then(function (ok) {
          if (!ok) { failed = id; return; }
          var rows = rowCount();
          if (rows > bestRows) { bestRows = rows; best = id; }
        });
      });
    }, Promise.resolve()).then(function () {
      if (failed) return { ran: false, reason: 'CASE ' + failed + ' 로 전환되지 않아 검색 필터를 검증할 수 없다' };
      if (!best || bestRows === 0) return { ran: false, reason: '어떤 CASE 에도 더미 행이 없어 검색 필터를 검증할 수 없다' };
      return ensureCase(best).then(function () {
        var before = rowCount();
        var value = pickUniqueCellValue();
        if (value === undefined) return { ran: false, reason: '검색어로 쓸 셀 값이 없다', case_id: best };
        var selector = searchSelector();
        if (!selector) return { ran: false, reason: '검색 동작에 연결된 텍스트 입력이 없다', case_id: best };
        var errorsBefore = errors.length;
        if (!fill(selector, value)) return { ran: false, reason: '검색 입력을 찾지 못했다: ' + selector, case_id: best };
        var how = submit(selector);
        var matched = rowCount();
        fill(selector, ${JSON.stringify(NO_MATCH_VALUE)});
        submit(selector);
        var none = rowCount();
        return {
          ran: true, case_id: best, selector: selector, submit: how, value: value,
          before: before, matched: matched, none: none, messages: messageIds(), errors: errors.length - errorsBefore,
        };
      });
    });
  }

  function checkDownload() {
    var trigger = document.querySelector('[data-action-type="download-fixture"]');
    if (!trigger) return Promise.resolve({ ran: false, reason: 'download-fixture 동작을 실행할 trigger 요소(버튼·링크)가 화면에 없다' });
    var before = errors.length;
    trigger.click();
    return sleep(120).then(function () {
      return { ran: true, status_text: statusText(), errors: errors.length - before };
    });
  }

  function run() {
    var loadErrors = errors.length;
    var out = { case_ids: [], load_errors: loadErrors, total_errors: 0, errors: [], case_steps: [], search: { ran: false }, download: { ran: false } };
    return checkCases()
      .then(function (cases) { out.case_ids = cases.ids; out.case_steps = cases.steps; return checkSearch(); })
      .then(function (search) { out.search = search; return checkDownload(); })
      .then(function (download) {
        out.download = download;
        out.total_errors = errors.length;
        out.errors = errors.slice(0, 20);
        return out;
      });
  }

  function post(type, payload) {
    try { parent.postMessage({ type: type, payload: payload }, '*'); } catch (e) { /* 무시 */ }
  }

  window.addEventListener('message', function (event) {
    var data = event && event.data;
    if (!data || data.type !== ${JSON.stringify(V3_RUN_MESSAGE)}) return;
    run().then(function (probe) { post(${JSON.stringify(V3_DONE_MESSAGE)}, probe); }, function (e) {
      post(${JSON.stringify(V3_DONE_MESSAGE)}, { failed: String(e && e.message ? e.message : e) });
    });
  });

  function ready() { post(${JSON.stringify(V3_READY_MESSAGE)}, null); }
  if (document.readyState === 'complete') setTimeout(ready, 0);
  else window.addEventListener('load', function () { setTimeout(ready, 0); });
})();`

/**
 * 조사 스크립트를 산출물 HTML **사본**에 끼워 넣는다.
 * 저장된 산출물과 그 hash 는 바뀌지 않는다 — 검사기가 자기 계측 코드를 넣는 것과 같다(Playwright 도 같은 일을 한다).
 * 콘솔 오류를 처음부터 잡으려면 화면 스크립트보다 먼저 실행돼야 하므로 `</head>` 앞에 넣는다.
 */
export function injectHarness(html: string): string {
  const tag = `<script data-con-ai-v3-harness>${V3_HARNESS_SOURCE}</script>`
  if (html.includes('</head>')) return html.replace('</head>', `${tag}\n</head>`)
  const bodyOpen = /<body\b[^>]*>/.exec(html)
  if (bodyOpen) return html.replace(bodyOpen[0], `${bodyOpen[0]}\n${tag}`)
  return `${tag}\n${html}`
}
