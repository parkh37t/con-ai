/**
 * 목업 인라인 JS — 오프라인 단일 파일에 그대로 들어간다 (외부 요청 없음).
 *
 * 동작(설계 §9 제한 목록): CASE 전환(data-case), 검색=더미데이터 필터, 정렬=기본 정렬·헤더 클릭, 팝업=간단 모달,
 * 다운로드=명세 컬럼 CSV, set-state, navigate(상태 표시만). postMessage 는 부모 창이 있을 때만 보낸다 (계약 §4).
 *
 * 주의: String.raw 안이므로 백틱과 "${" 를 쓰지 않는다. console.error/warn 은 쓰지 않는다 (V3 가 콘솔 오류를 센다).
 * 데이터는 <script id="con-ai-data" type="application/json"> 에서 읽는다 (client-data.ts).
 */
export const CLIENT_SCRIPT: string = String.raw`
(function () {
  'use strict';
  var dataEl = document.getElementById('con-ai-data');
  if (!dataEl) return;
  var D;
  try { D = JSON.parse(dataEl.textContent || '{}'); } catch (e) { return; }
  if (!D || !Array.isArray(D.states)) return;

  var embedded = window.parent !== window;
  var body = document.body;
  var root = document.querySelector('[data-shell-root]');
  var toolbar = document.querySelector('[data-toolbar]');
  var modal = document.querySelector('[data-modal]');
  var screenRegion = document.querySelector('[data-region="screen"]');
  var panelRegion = document.querySelector('[data-region="description"]');

  var stateById = {};
  D.states.forEach(function (s) { stateById[s.id] = s; });
  var msgById = {};
  (D.messages || []).forEach(function (m) { msgById[m.id] = m; });
  var tableById = {};
  var current = { caseId: D.initial_case, filtered: {}, sort: {} };
  (D.tables || []).forEach(function (t) {
    tableById[t.element_id] = t;
    current.sort[t.element_id] = t.default_sort ? { column_id: t.default_sort.column_id, direction: t.default_sort.direction } : null;
  });
  var actionsById = {};
  (D.actions || []).forEach(function (a) { actionsById[a.id] = a; });

  function each(list, fn) { Array.prototype.forEach.call(list, fn); }
  function q(sel, scope) { return (scope || document).querySelector(sel); }
  function qa(sel, scope) { return (scope || document).querySelectorAll(sel); }
  function cssId(v) { return String(v).replace(/["\\]/g, '\\$&'); }

  function setStatus(text) {
    each(qa('[data-status]'), function (el) { el.textContent = text; });
  }
  function currentState() { return stateById[current.caseId]; }
  function baseRows() {
    var st = currentState();
    if (!st) return [];
    var rows = D.dummy ? D.dummy[st.fixture_id] : null;
    return Array.isArray(rows) ? rows : [];
  }
  function isRecord(row) { return row !== null && typeof row === 'object' && !Array.isArray(row); }
  /* 상태 코드 → pill 색. html.ts 의 statusTone 과 같은 규칙이다 (한쪽만 고치면 CASE 를 바꿀 때 색이 달라진다). */
  function statusTone(code) {
    var upper = String(code).toUpperCase();
    if (/(APPROVED|DONE|PAID|COMPLETE|SUCCESS|ACTIVE|정상|승인|완료)/.test(upper)) return 'is-ok';
    if (/(REJECT|CANCEL|FAIL|ERROR|반려|취소|실패|오류)/.test(upper)) return 'is-danger';
    if (/(PENDING|REVIEW|WAIT|REQUEST|PREPAR|SHIP|검토|대기|요청|준비|배송)/.test(upper)) return 'is-warn';
    return '';
  }
  function cellValue(row, colId) {
    if (!isRecord(row)) return '';
    var v = row[colId];
    return v === undefined || v === null ? '' : v;
  }
  function rowCells(row) {
    if (isRecord(row)) return Object.keys(row).map(function (k) { return row[k]; });
    return [row];
  }
  function formatCell(value, format) {
    if (value === '' || value === null || value === undefined) return '';
    if ((format === 'number' || format === 'currency') && typeof value === 'number') return value.toLocaleString('ko-KR');
    return String(value);
  }
  function compareCells(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    var sa = String(a), sb = String(b);
    if (sa === '' && sb !== '') return 1;
    if (sb === '' && sa !== '') return -1;
    return sa.localeCompare(sb, 'ko');
  }
  function sortRows(rows, sort) {
    if (!sort) return rows.slice();
    var dir = sort.direction === 'desc' ? -1 : 1;
    return rows.slice().sort(function (a, b) { return compareCells(cellValue(a, sort.column_id), cellValue(b, sort.column_id)) * dir; });
  }
  function visibleRows(tableId) {
    var rows = current.filtered[tableId] || baseRows();
    return sortRows(rows, current.sort[tableId]);
  }

  function renderTable(tableId) {
    var t = tableById[tableId];
    if (!t) return 0;
    var tbody = q('[data-tbody-for="' + cssId(tableId) + '"]');
    if (!tbody) return 0;
    var rows = visibleRows(tableId);
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
    if (rows.length === 0) {
      var etr = document.createElement('tr');
      etr.className = 'empty-row';
      var etd = document.createElement('td');
      etd.colSpan = t.columns.length || 1;
      etd.textContent = '표시할 행이 없습니다';
      etr.appendChild(etd);
      tbody.appendChild(etr);
    }
    rows.forEach(function (row, i) {
      var tr = document.createElement('tr');
      tr.setAttribute('data-row', String(i));
      if (t.row_action) { tr.className = 'clickable'; tr.tabIndex = 0; }
      t.columns.forEach(function (c) {
        var td = document.createElement('td');
        var fmt = c.format || 'text';
        td.setAttribute('data-column-id', c.id);
        // 서버가 처음 그린 것과 **같은 모양**으로 다시 그린다 (숫자 오른쪽 정렬·상태 pill·링크 색).
        td.className = 'fmt-' + fmt + (fmt === 'number' || fmt === 'currency' ? ' num' : '') + (fmt === 'link' ? ' cell-link' : '');
        var text = formatCell(cellValue(row, c.id), c.format);
        if (fmt === 'status' && text !== '') {
          var pill = document.createElement('span');
          pill.className = 'pill ' + statusTone(text);
          pill.textContent = text;
          td.appendChild(pill);
        } else {
          td.textContent = text;
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    var sort = current.sort[tableId];
    each(qa('[data-table-id="' + cssId(tableId) + '"] th[data-column-id]'), function (th) {
      var active = sort && th.getAttribute('data-column-id') === sort.column_id;
      th.setAttribute('aria-sort', active ? (sort.direction === 'desc' ? 'descending' : 'ascending') : 'none');
    });
    var counter = q('[data-row-count-for="' + cssId(tableId) + '"]');
    if (counter) counter.textContent = '총 ' + rows.length + '건';
    return rows.length;
  }
  function renderAllTables() {
    var total = 0;
    (D.tables || []).forEach(function (t) { total += renderTable(t.element_id); });
    return total;
  }

  function renderMessages(ids) {
    var box = q('[data-messages]');
    if (!box) return;
    while (box.firstChild) box.removeChild(box.firstChild);
    (ids || []).forEach(function (id) {
      var m = msgById[id];
      if (!m) return;
      var div = document.createElement('div');
      div.className = 'msg msg-' + m.kind;
      div.setAttribute('data-message-id', m.id);
      div.setAttribute('role', m.kind === 'error' ? 'alert' : 'status');
      div.textContent = m.text;
      box.appendChild(div);
    });
    box.hidden = box.childNodes.length === 0;
  }

  function setCase(id) {
    var st = stateById[id];
    if (!st) { setStatus('알 수 없는 CASE: ' + id); return false; }
    current.caseId = id;
    current.filtered = {};
    body.setAttribute('data-case', id);
    body.setAttribute('data-case-kind', st.case_kind || 'normal');
    var total = renderAllTables();
    renderMessages(st.message_ids || []);
    each(qa('button[data-case]'), function (b) { b.classList.toggle('is-active', b.getAttribute('data-case') === id); });
    each(qa('[data-case-id]'), function (el) { el.classList.toggle('is-active', el.getAttribute('data-case-id') === id); });
    setStatus('CASE ' + id + ' (' + (st.case_kind || 'normal') + ') · 표 ' + total + '행 — ' + st.expected);
    return true;
  }

  function isDateLike(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v); }
  function readCriteria(ids) {
    var criteria = [];
    (ids || []).forEach(function (id) {
      var inputs = qa('[data-input-for="' + cssId(id) + '"]');
      if (!inputs.length) return;
      var type = inputs[0].getAttribute('data-input-type') || 'text-input';
      if (type === 'date-range') {
        var from = '', to = '';
        each(inputs, function (inp) {
          if (inp.getAttribute('data-range') === 'from') from = inp.value;
          if (inp.getAttribute('data-range') === 'to') to = inp.value;
        });
        if (from || to) criteria.push({ kind: 'date-range', from: from, to: to, id: id });
      } else if (type === 'checkbox' || type === 'radio') {
        var values = [];
        each(inputs, function (inp) { if (inp.checked && inp.value !== '' && inp.value !== 'on') values.push(inp.value); });
        if (values.length) criteria.push({ kind: 'any-of', values: values, id: id });
      } else if (type === 'select') {
        var sv = inputs[0].value;
        if (sv !== '') criteria.push({ kind: 'equals', value: sv, id: id });
      } else if (type === 'date-input') {
        var dv = inputs[0].value;
        if (dv !== '') criteria.push({ kind: 'date-prefix', value: dv, id: id });
      } else {
        var tv = String(inputs[0].value || '').trim();
        if (tv !== '') criteria.push({ kind: 'text', value: tv.toLowerCase(), id: id });
      }
    });
    return criteria;
  }
  function rowMatches(row, c) {
    var cells = rowCells(row);
    if (c.kind === 'text') return cells.some(function (v) { return String(v).toLowerCase().indexOf(c.value) >= 0; });
    if (c.kind === 'equals') return cells.some(function (v) { return String(v) === c.value; });
    if (c.kind === 'any-of') return cells.some(function (v) { return c.values.indexOf(String(v)) >= 0; });
    if (c.kind === 'date-prefix') return cells.some(function (v) { return isDateLike(v) && v.indexOf(c.value) === 0; });
    if (c.kind === 'date-range') return cells.some(function (v) { return isDateLike(v) && (!c.from || v >= c.from) && (!c.to || v <= c.to); });
    return true;
  }
  function runFilter(action) {
    var criteria = readCriteria(action.inputs);
    var base = baseRows();
    var rows = criteria.length ? base.filter(function (r) { return criteria.every(function (c) { return rowMatches(r, c); }); }) : base;
    var total = 0;
    (action.tables || []).forEach(function (tid) {
      current.filtered[tid] = rows;
      total += renderTable(tid);
    });
    var st = currentState();
    var emptyState = null;
    D.states.forEach(function (s) { if (!emptyState && s.case_kind === 'empty') emptyState = s; });
    if (total === 0 && emptyState && st && st.case_kind !== 'error') {
      renderMessages(emptyState.message_ids || []);
      setStatus('검색(더미 필터): 0건 · 조건 ' + criteria.length + '개 → 빈값 CASE 메시지 표시');
    } else {
      renderMessages(st ? st.message_ids || [] : []);
      setStatus('검색(더미 필터): ' + total + '건 · 조건 ' + criteria.length + '개');
    }
  }
  function toggleSort(tableId, columnId) {
    var cur = current.sort[tableId];
    if (cur && cur.column_id === columnId) current.sort[tableId] = { column_id: columnId, direction: cur.direction === 'asc' ? 'desc' : 'asc' };
    else current.sort[tableId] = { column_id: columnId, direction: 'asc' };
    renderTable(tableId);
    var s = current.sort[tableId];
    setStatus('정렬: ' + tableId + '.' + s.column_id + ' ' + (s.direction === 'desc' ? '내림차순' : '오름차순'));
  }
  function resetSort(tableId) {
    var t = tableById[tableId];
    if (!t) return;
    current.sort[tableId] = t.default_sort ? { column_id: t.default_sort.column_id, direction: t.default_sort.direction } : null;
    renderTable(tableId);
    setStatus('정렬: 명세 기본 정렬로 되돌림 (' + tableId + ')');
  }

  function csvField(v) {
    var s = v === null || v === undefined ? '' : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function buildCsv(tableId) {
    var t = tableById[tableId];
    if (!t) return '';
    var cols = t.columns.filter(function (c) { return c.downloadable !== false; });
    var lines = [cols.map(function (c) { return csvField(c.label); }).join(',')];
    visibleRows(tableId).forEach(function (row) {
      lines.push(cols.map(function (c) { return csvField(cellValue(row, c.id)); }).join(','));
    });
    return '\uFEFF' + lines.join('\r\n') + '\r\n';
  }
  function downloadCsv(action) {
    var tables = action.tables && action.tables.length ? action.tables : Object.keys(tableById);
    var count = 0;
    tables.forEach(function (tid) {
      var csv = buildCsv(tid);
      if (!csv) return;
      count++;
      try {
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = D.screen_id + '_' + tid + '.csv';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      } catch (e) {
        setStatus('다운로드(더미): 이 환경에서는 파일 저장이 막혀 있다 — CSV 는 명세 컬럼으로 만들어졌다');
        return;
      }
    });
    setStatus('다운로드(더미): 표 ' + count + '개를 명세 컬럼 CSV 로 내려받음 — 실제 업무 파일 아님');
  }

  function openModal(title, lines) {
    if (!modal) return;
    var t = q('[data-modal-title]', modal);
    var b = q('[data-modal-body]', modal);
    if (t) t.textContent = title;
    if (b) {
      while (b.firstChild) b.removeChild(b.firstChild);
      lines.forEach(function (line) {
        var p = document.createElement('p');
        p.textContent = line;
        b.appendChild(p);
      });
    }
    modal.hidden = false;
    var closeBtn = q('[data-modal-close]', modal);
    if (closeBtn) closeBtn.focus();
  }
  function closeModal() {
    if (modal) modal.hidden = true;
  }

  function runAction(action, row) {
    if (!action) return;
    if (action.type === 'filter-fixture') { runFilter(action); return; }
    if (action.type === 'sort-fixture') { (action.tables || []).forEach(resetSort); return; }
    if (action.type === 'open-popup') {
      var lines = ['대상 화면: ' + (action.target_screen_id || '(미지정)') + ' — 더미 전이. 실제 화면 이동·API 호출 없음'];
      if (isRecord(row)) Object.keys(row).forEach(function (k) { lines.push(k + ': ' + formatCell(row[k])); });
      openModal('팝업 ' + (action.target_screen_id || action.id), lines);
      setStatus('팝업 열기(더미): ' + (action.target_screen_id || action.id));
      return;
    }
    if (action.type === 'close-popup') { closeModal(); setStatus('팝업 닫기(더미)'); return; }
    if (action.type === 'download-fixture') { downloadCsv(action); return; }
    if (action.type === 'navigate') { setStatus('화면 이동(더미): ' + (action.target_screen_id || '(미지정)') + ' — 실제 이동 없음'); return; }
    if (action.type === 'set-state') { setCase(action.target_state_id); return; }
  }
  function runActionsFor(elementId, row) {
    var ran = 0;
    (D.actions || []).forEach(function (a) {
      if (a.trigger === elementId) { runAction(a, row); ran++; }
    });
    if (!ran) setStatus('동작 없음(더미): ' + elementId + ' 에 연결된 동작이 명세에 없다');
  }

  function post(msg) {
    if (!embedded) return;
    try { window.parent.postMessage(msg, '*'); } catch (e) { /* 부모가 없거나 막힘 */ }
  }
  function regionOf(el) {
    if (panelRegion && panelRegion.contains(el)) return 'description';
    if (screenRegion && screenRegion.contains(el)) return 'screen';
    return null;
  }
  function select(elementId) {
    each(qa('.is-selected'), function (el) { el.classList.remove('is-selected'); });
    each(qa('[data-element-id="' + cssId(elementId) + '"]'), function (el) { el.classList.add('is-selected'); });
  }
  function highlight(elementId) {
    each(qa('.is-highlighted'), function (el) { el.classList.remove('is-highlighted'); });
    var first = null;
    each(qa('[data-element-id="' + cssId(elementId) + '"]'), function (el) {
      el.classList.add('is-highlighted');
      if (!first && screenRegion && screenRegion.contains(el)) first = el;
    });
    if (first && typeof first.scrollIntoView === 'function') first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setStatus('강조: ' + elementId);
  }
  function notifyClick(el) {
    var target = regionOf(el);
    if (!target) return;
    var elementId = el.getAttribute('data-element-id');
    select(elementId);
    post({
      type: 'con-ai:element-click',
      element_id: elementId,
      section_id: el.getAttribute('data-section-id'),
      case_id: current.caseId,
      target: target,
      display_no: el.getAttribute('data-display-no'),
    });
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!(t instanceof Element)) return;
    var caseBtn = t.closest('button[data-case]');
    if (caseBtn) { setCase(caseBtn.getAttribute('data-case')); return; }
    var devBtn = t.closest('[data-device-toggle]');
    if (devBtn && root) {
      root.setAttribute('data-device', devBtn.getAttribute('data-device-toggle'));
      each(qa('[data-device-toggle]'), function (b) { b.classList.toggle('is-active', b === devBtn); });
      each(qa('.gnb.is-open'), function (g) { g.classList.remove('is-open'); });
      setStatus('기기 폭: ' + (devBtn.getAttribute('data-device-toggle') === 'mobile' ? '모바일(폰 프레임 420px)' : 'PC'));
      return;
    }
    // 모바일 폰 프레임의 햄버거 — GNB 메뉴를 시트로 펼친다 (표시만, 실제 이동 없음)
    var ham = t.closest('[data-gnb-toggle]');
    if (ham) {
      var gnb = ham.closest('.gnb');
      if (gnb) gnb.classList.toggle('is-open');
      setStatus('모바일 메뉴(더미): ' + (gnb && gnb.classList.contains('is-open') ? '펼침' : '접음'));
      return;
    }
    if (t.closest('[data-modal-close]') || (modal && t === modal)) { closeModal(); return; }
    var link = t.closest('a[data-link]');
    if (link) ev.preventDefault();
    var sortBtn = t.closest('th[data-sortable="true"] button');
    if (sortBtn) {
      var th = sortBtn.closest('th');
      var table = sortBtn.closest('[data-table-id]');
      if (th && table) toggleSort(table.getAttribute('data-table-id'), th.getAttribute('data-column-id'));
    } else {
      var pager = t.closest('[data-pager]');
      if (pager) setStatus('페이지 이동(더미): ' + pager.getAttribute('data-pager') + ' — 더미데이터는 한 페이지다');
      var trigger = t.closest('[data-action-trigger]');
      if (trigger) runActionsFor(trigger.getAttribute('data-action-trigger'), null);
      var tr = t.closest('tr[data-row]');
      if (tr && !trigger) {
        var tbl = tr.closest('[data-table-id]');
        var tinfo = tbl ? tableById[tbl.getAttribute('data-table-id')] : null;
        if (tinfo && tinfo.row_action) {
          var rows = visibleRows(tinfo.element_id);
          runAction(actionsById[tinfo.row_action], rows[Number(tr.getAttribute('data-row'))] || null);
        }
      }
    }
    var el = t.closest('[data-element-id]');
    if (el) notifyClick(el);
  });

  document.addEventListener('keydown', function (ev) {
    var t = ev.target;
    if (!(t instanceof Element)) return;
    if (ev.key === 'Escape' && modal && !modal.hidden) { closeModal(); return; }
    if (ev.key !== 'Enter') return;
    var inputFor = t.getAttribute('data-input-for');
    if (inputFor && t.tagName !== 'TEXTAREA') {
      var ran = false;
      (D.actions || []).forEach(function (a) {
        if (a.type === 'filter-fixture' && a.inputs && a.inputs.indexOf(inputFor) >= 0) { runFilter(a); ran = true; }
      });
      if (ran) ev.preventDefault();
      return;
    }
    if (t.matches('tr[data-row]')) { t.click(); }
  });

  window.addEventListener('message', function (ev) {
    if (embedded && ev.source !== window.parent) return;
    var m = ev.data;
    if (!m || typeof m !== 'object' || typeof m.type !== 'string') return;
    if (m.type === 'con-ai:set-case') setCase(String(m.case_id));
    else if (m.type === 'con-ai:highlight') highlight(String(m.element_id));
  });

  if (embedded) {
    body.classList.add('is-embedded');
    if (toolbar) toolbar.hidden = true;
  }
  if (root && !root.getAttribute('data-device')) root.setAttribute('data-device', D.device || 'desktop');
  each(qa('[data-device-toggle]'), function (b) { b.classList.toggle('is-active', b.getAttribute('data-device-toggle') === (root ? root.getAttribute('data-device') : D.device)); });
  setCase(D.initial_case);
})();
`
