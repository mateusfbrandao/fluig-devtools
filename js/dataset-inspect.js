// js/dataset-inspect.js — Aba Consultar Dataset: consulta somente leitura de datasets
// Script classico (escopo global compartilhado); ordem de carga definida em panel.html.

// Consulta DatasetFactory.getDataset no frame da pagina, com callback, e devolve
// o resultado por um job em __FLUIG_DEBUG_DS__. O eval nao espera XHR; o painel
// faz poll ate o job sair de "pending". Nao ha gravacao: dsSetCardValue fica
// bloqueado de proposito.

var DS_LIMIT_DEFAULT = 50;
var DS_LIMIT_MAX = 300;
var DS_CELL_MAX = 2000;
var DS_POLL_MS = 200;
var DS_POLL_MAX = 225; // ~45s

var dsRunToken = 0;
var dsLastPayload = null;
var dsCatalogNames = [];
var dsCatalogRequested = false;

function dsSetStatus(html) {
  var el = document.getElementById('ds-status');
  if (el) { el.innerHTML = html; }
}

function dsSplitList(raw) {
  if (raw == null) { return null; }
  var parts = String(raw).split(',');
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var s = parts[i].replace(/^\s+|\s+$/g, '');
    if (s) { out.push(s); }
  }
  return out.length ? out : null;
}

function dsReadLimit() {
  var el = document.getElementById('ds-limit');
  var n = el ? parseInt(el.value, 10) : DS_LIMIT_DEFAULT;
  if (!n || n < 1) { n = DS_LIMIT_DEFAULT; }
  if (n > DS_LIMIT_MAX) { n = DS_LIMIT_MAX; }
  return n;
}

function dsConstraintTypeName(raw) {
  var key = String(raw == null ? '' : raw).toUpperCase();
  if (key === '1' || key === 'MUST') { return 'MUST'; }
  if (key === '2' || key === 'SHOULD') { return 'SHOULD'; }
  if (key === '3' || key === 'MUST_NOT') { return 'MUST_NOT'; }
  return 'MUST';
}

function dsAddConstraintRow(preset) {
  var box = document.getElementById('ds-constraints');
  if (!box) { return; }
  var p = preset || {};
  var type = dsConstraintTypeName(p.type);
  var row = document.createElement('div');
  row.className = 'ds-constraint';
  row.innerHTML =
    '<input type="text" data-ds-field placeholder="campo" autocomplete="off" value="' + esc(p.field || '').replace(/"/g, '&quot;') + '" />' +
    '<input type="text" data-ds-initial placeholder="valor inicial" autocomplete="off" value="' + esc(p.initial != null ? p.initial : '').replace(/"/g, '&quot;') + '" />' +
    '<input type="text" data-ds-final placeholder="valor final" autocomplete="off" value="' + esc(p.final != null ? p.final : '').replace(/"/g, '&quot;') + '" />' +
    '<select data-ds-type>' +
      '<option value="MUST"' + (type === 'MUST' ? ' selected' : '') + '>MUST</option>' +
      '<option value="SHOULD"' + (type === 'SHOULD' ? ' selected' : '') + '>SHOULD</option>' +
      '<option value="MUST_NOT"' + (type === 'MUST_NOT' ? ' selected' : '') + '>MUST_NOT</option>' +
    '</select>' +
    '<label class="ds-like"><input type="checkbox" data-ds-like' + (p.like ? ' checked' : '') + ' /> LIKE</label>' +
    '<button type="button" data-ds-remove>Remover</button>';
  box.appendChild(row);
}

function dsReadConstraints() {
  var rows = document.querySelectorAll('#ds-constraints .ds-constraint');
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var fieldEl = row.querySelector('[data-ds-field]');
    var field = fieldEl ? fieldEl.value.replace(/^\s+|\s+$/g, '') : '';
    if (!field) { continue; }
    var initialEl = row.querySelector('[data-ds-initial]');
    var finalEl = row.querySelector('[data-ds-final]');
    var typeEl = row.querySelector('[data-ds-type]');
    var likeEl = row.querySelector('[data-ds-like]');
    var initial = initialEl ? initialEl.value : '';
    var finalVal = finalEl ? finalEl.value : '';
    if (!finalVal) { finalVal = initial; }
    out.push({
      field: field,
      initial: initial,
      final: finalVal,
      type: dsConstraintTypeName(typeEl ? typeEl.value : 'MUST'),
      like: !!(likeEl && likeEl.checked)
    });
  }
  return out;
}

function dsHasSqlLimit(constraints) {
  for (var i = 0; i < constraints.length; i++) {
    if (String(constraints[i].field).toLowerCase() === 'sqllimit') { return true; }
  }
  return false;
}

function buildDsStartExpr(spec) {
  return [
    '(function () {',
    PAGE_HELPERS,
    '  var spec = ' + JSON.stringify(spec) + ';',
    '  function clip(v) {',
    '    var s = v == null ? "" : String(v);',
    '    return s.length > ' + DS_CELL_MAX + ' ? s.slice(0, ' + DS_CELL_MAX + ') + "\\u2026" : s;',
    '  }',
    '  function colName(c) {',
    '    if (typeof c === "string") { return c; }',
    '    if (c && c.name) { return String(c.name); }',
    '    return c == null ? "" : String(c);',
    '  }',
    '  function unwrap(data) {',
    '    if (!data) { return null; }',
    '    if (data.content && (data.content.values || data.content.columns)) { return data.content; }',
    '    if (data.values || data.columns) { return data; }',
    '    return null;',
    '  }',
    '  function pack(data) {',
    '    var content = unwrap(data);',
    '    if (!content) { return null; }',
    '    var values = Array.isArray(content.values) ? content.values : [];',
    '    var columns = [];',
    '    if (Array.isArray(content.columns)) {',
    '      for (var c = 0; c < content.columns.length; c++) { columns.push(colName(content.columns[c])); }',
    '    }',
    '    if (!columns.length && values.length && values[0] && typeof values[0] === "object" && !Array.isArray(values[0])) {',
    '      columns = Object.keys(values[0]);',
    '    }',
    '    var limit = spec.limit;',
    '    var sliced = values.length > limit ? values.slice(0, limit) : values;',
    '    var rows = [];',
    '    for (var r = 0; r < sliced.length; r++) {',
    '      var src = sliced[r];',
    '      var line = [];',
    '      if (Array.isArray(src)) {',
    '        for (var a = 0; a < columns.length; a++) { line.push(clip(src[a])); }',
    '      } else {',
    '        for (var b = 0; b < columns.length; b++) { line.push(clip(src ? src[columns[b]] : "")); }',
    '      }',
    '      rows.push(line);',
    '    }',
    '    return { columns: columns, rows: rows, rowCount: values.length, truncated: values.length > limit };',
    '  }',
    '  var wins = collectWindows(window, [], 0);',
    '  var dsWin = null;',
    '  for (var i = 0; i < wins.length; i++) {',
    '    try {',
    '      if (wins[i].DatasetFactory && typeof wins[i].DatasetFactory.getDataset === "function") { dsWin = wins[i]; break; }',
    '    } catch (e) {}',
    '  }',
    '  if (!dsWin) {',
    '    return { ok: false, message: "DatasetFactory não disponível. Abra o DevTools sobre uma página Fluig já carregada." };',
    '  }',
    '  var jobs = dsWin.__FLUIG_DEBUG_DS__ || (dsWin.__FLUIG_DEBUG_DS__ = {});',
    '  jobs[spec.id] = { status: "pending" };',
    '  function finishOk(data) {',
    '    var packed = pack(data);',
    '    if (!packed) { jobs[spec.id] = { status: "error", message: "O dataset não devolveu colunas nem linhas." }; return; }',
    '    packed.status = "ok";',
    '    jobs[spec.id] = packed;',
    '  }',
    '  function finishErr(xhr, textStatus, errorThrown) {',
    '    var msg = errorThrown || textStatus || "falha na consulta";',
    '    try {',
    '      if (xhr && xhr.responseText) { msg = String(xhr.responseText).slice(0, 500); }',
    '      else if (xhr && xhr.status) { msg = "HTTP " + xhr.status + (msg ? " " + msg : ""); }',
    '    } catch (e) {}',
    '    jobs[spec.id] = { status: "error", message: String(msg) };',
    '  }',
    '  try {',
    '    var DF = dsWin.DatasetFactory, CT = dsWin.ConstraintType;',
    '    var constraints = [];',
    '    for (var k = 0; k < spec.constraints.length; k++) {',
    '      var c = spec.constraints[k];',
    '      var type = CT[c.type] || CT.MUST;',
    '      if (c.like) { constraints.push(DF.createConstraint(c.field, c.initial, c.final, type, true)); }',
    '      else { constraints.push(DF.createConstraint(c.field, c.initial, c.final, type)); }',
    '    }',
    '    if (!spec.hasSqlLimit) {',
    '      constraints.push(DF.createConstraint("sqlLimit", String(spec.limit), String(spec.limit), CT.MUST));',
    '    }',
    '    var sync = DF.getDataset(spec.name, spec.fields, constraints.length ? constraints : null, spec.order, {',
    '      success: function (content) { finishOk(content); },',
    '      error: function (xhr, textStatus, errorThrown) { finishErr(xhr, textStatus, errorThrown); }',
    '    });',
    '    var immediate = pack(sync);',
    '    if (immediate) { immediate.status = "ok"; jobs[spec.id] = immediate; }',
    '    return { ok: true, id: spec.id };',
    '  } catch (e) {',
    '    return { ok: false, message: "Erro ao consultar: " + (e && e.message ? e.message : String(e)) };',
    '  }',
    '})()'
  ].join('\n');
}

function buildDsPollExpr(id) {
  return [
    '(function () {',
    PAGE_HELPERS,
    '  var id = ' + JSON.stringify(id) + ';',
    '  var wins = collectWindows(window, [], 0);',
    '  for (var i = 0; i < wins.length; i++) {',
    '    try {',
    '      var jobs = wins[i].__FLUIG_DEBUG_DS__;',
    '      if (jobs && jobs[id]) { return jobs[id]; }',
    '    } catch (e) {}',
    '  }',
    '  return { status: "missing" };',
    '})()'
  ].join('\n');
}

function buildDsCatalogExpr(id) {
  return [
    '(function () {',
    PAGE_HELPERS,
    '  var id = ' + JSON.stringify(id) + ';',
    '  function namesOf(list) {',
    '    var src = list;',
    '    if (src && src.values && Array.isArray(src.values)) { src = src.values; }',
    '    if (src && src.content && Array.isArray(src.content)) { src = src.content; }',
    '    if (!Array.isArray(src)) { return []; }',
    '    var out = [];',
    '    for (var i = 0; i < src.length; i++) {',
    '      var item = src[i];',
    '      var name = "";',
    '      if (typeof item === "string") { name = item; }',
    '      else if (item && typeof item === "object") { name = item.datasetId || item.datasetName || item.name || item.id || ""; }',
    '      name = String(name || "").replace(/^\\s+|\\s+$/g, "");',
    '      if (name && out.indexOf(name) < 0) { out.push(name); }',
    '    }',
    '    return out;',
    '  }',
    '  var wins = collectWindows(window, [], 0);',
    '  var dsWin = null;',
    '  for (var i = 0; i < wins.length; i++) {',
    '    try {',
    '      if (wins[i].DatasetFactory && typeof wins[i].DatasetFactory.getDataset === "function") { dsWin = wins[i]; break; }',
    '    } catch (e) {}',
    '  }',
    '  if (!dsWin || typeof dsWin.DatasetFactory.getAvailableDatasets !== "function") {',
    '    return { ok: false, message: "Lista de datasets indisponível." };',
    '  }',
    '  var jobs = dsWin.__FLUIG_DEBUG_DS__ || (dsWin.__FLUIG_DEBUG_DS__ = {});',
    '  jobs[id] = { status: "pending" };',
    '  try {',
    '    var sync = dsWin.DatasetFactory.getAvailableDatasets({',
    '      success: function (list) { jobs[id] = { status: "ok", names: namesOf(list) }; },',
    '      error: function () { jobs[id] = { status: "ok", names: [] }; }',
    '    });',
    '    var syncNames = namesOf(sync);',
    '    if (syncNames.length) { jobs[id] = { status: "ok", names: syncNames }; }',
    '    return { ok: true, id: id };',
    '  } catch (e) {',
    '    return { ok: false, message: e && e.message ? e.message : String(e) };',
    '  }',
    '})()'
  ].join('\n');
}

function dsRefreshNameList() {
  var list = document.getElementById('ds-names');
  if (!list) { return; }
  var names = dsCatalogNames.slice();
  if (typeof netMonitorItems !== 'undefined') {
    for (var i = 0; i < netMonitorItems.length; i++) {
      var info = netMonitorItems[i].datasetInfo;
      var name = info && info.dataset;
      if (name && names.indexOf(name) < 0) { names.push(name); }
    }
  }
  names.sort(function (a, b) { return a.localeCompare(b); });
  list.innerHTML = names.map(function (n) {
    return '<option value="' + esc(n).replace(/"/g, '&quot;') + '"></option>';
  }).join('');
}

function dsLoadCatalog() {
  if (dsCatalogRequested) { return; }
  dsCatalogRequested = true;
  var id = 'catalog-' + Date.now();
  evalInPage(buildDsCatalogExpr(id))
    .then(function (started) {
      if (!started || !started.ok) { return; }
      var attempts = 0;
      function poll() {
        attempts++;
        evalInPage(buildDsPollExpr(id)).then(function (job) {
          if (job && job.status === 'ok') {
            dsCatalogNames = job.names || [];
            dsRefreshNameList();
            return;
          }
          if (attempts < 40 && (!job || job.status === 'pending' || job.status === 'missing')) {
            setTimeout(poll, DS_POLL_MS);
          }
        }).catch(function () {});
      }
      poll();
    })
    .catch(function () {});
}

function dsMaskRows(columns, rows) {
  var objects = [];
  for (var r = 0; r < rows.length; r++) {
    var obj = {};
    var line = rows[r] || [];
    for (var c = 0; c < columns.length; c++) {
      obj[columns[c] || String(c)] = line[c];
    }
    objects.push(obj);
  }
  var masked = maskDeep(objects, null);
  var out = [];
  for (var i = 0; i < masked.length; i++) {
    var row = [];
    for (var j = 0; j < columns.length; j++) {
      var key = columns[j] || String(j);
      row.push(masked[i] && masked[i][key] != null ? masked[i][key] : '');
    }
    out.push(row);
  }
  return out;
}

function dsRenderResult(job, spec) {
  var box = document.getElementById('ds-result');
  if (!box) { return; }
  var columns = job.columns || [];
  var rows = job.rows || [];
  var maskEl = document.getElementById('ds-opt-mask');
  if (maskEl && maskEl.checked && typeof maskDeep === 'function') {
    rows = dsMaskRows(columns, rows);
  }
  var view = { dataset: spec.name, columns: columns, rowCount: job.rowCount, truncated: !!job.truncated, rows: rows };
  dsLastPayload = view;

  if (!rows.length) {
    box.innerHTML = '<span class="muted">O dataset respondeu sem linhas.</span>';
    return;
  }

  var html = '<div class="ds-result-wrap"><table class="ds-result"><thead><tr>';
  for (var c = 0; c < columns.length; c++) {
    html += '<th>' + esc(columns[c]) + '</th>';
  }
  html += '</tr></thead><tbody>';
  for (var r = 0; r < rows.length; r++) {
    html += '<tr>';
    var line = rows[r] || [];
    for (var i = 0; i < columns.length; i++) {
      var cell = line[i];
      html += '<td>' + (cell === '' || cell == null ? '<span class="muted">(vazio)</span>' : esc(cell)) + '</td>';
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  box.innerHTML = html;
}

function dsRunQuery() {
  var nameEl = document.getElementById('ds-name');
  var name = nameEl ? nameEl.value.replace(/^\s+|\s+$/g, '') : '';
  if (!name) {
    dsSetStatus('<span class="muted">Informe o nome do dataset.</span>');
    return;
  }
  if (/^dsSetCardValue$/i.test(name)) {
    dsSetStatus('<span class="err">Esta consulta fica desligada: dsSetCardValue grava no banco.</span>');
    return;
  }

  var constraints = dsReadConstraints();
  var limit = dsReadLimit();
  var spec = {
    id: 'q-' + Date.now() + '-' + (++dsRunToken),
    name: name,
    fields: dsSplitList((document.getElementById('ds-fields') || {}).value),
    order: dsSplitList((document.getElementById('ds-order') || {}).value),
    constraints: constraints,
    hasSqlLimit: dsHasSqlLimit(constraints),
    limit: limit
  };
  var token = dsRunToken;
  var startedAt = Date.now();
  dsLastPayload = null;
  var result = document.getElementById('ds-result');
  if (result) { result.innerHTML = ''; }
  dsSetStatus('<span class="muted">Consultando <code>' + esc(name) + '</code>…</span>');

  evalInPage(buildDsStartExpr(spec), { track: true })
    .then(function (started) {
      if (token !== dsRunToken) { return; }
      if (!started || !started.ok) {
        dsSetStatus('<span class="err">' + esc((started && started.message) || 'Não foi possível consultar.') + '</span>');
        return;
      }
      var attempts = 0;
      function poll() {
        if (token !== dsRunToken) { return; }
        attempts++;
        evalInPage(buildDsPollExpr(spec.id))
          .then(function (job) {
            if (token !== dsRunToken) { return; }
            if (!job || job.status === 'pending' || job.status === 'missing') {
              if (attempts >= DS_POLL_MAX) {
                dsSetStatus('<span class="err">A consulta passou de 45s sem resposta.</span>');
                return;
              }
              setTimeout(poll, DS_POLL_MS);
              return;
            }
            if (job.status === 'error') {
              dsSetStatus('<span class="err">' + esc(job.message || 'Falha na consulta.') + '</span>');
              return;
            }
            var ms = Date.now() - startedAt;
            var shown = (job.rows || []).length;
            var total = job.rowCount != null ? job.rowCount : shown;
            var note = shown + ' linha(s)';
            if (job.truncated || total > shown) { note += ' de ' + total; }
            note += ' em ' + ms + ' ms';
            if (shown === limit) { note += '. O limite é ' + limit + '; pode haver mais.'; }
            dsSetStatus('<span class="ok">' + esc(note) + '</span>');
            dsRenderResult(job, spec);
          })
          .catch(function (err) {
            if (token !== dsRunToken) { return; }
            dsSetStatus('<span class="err">Erro ao ler o retorno: ' + esc(formatErr(err)) + '</span>');
          });
      }
      poll();
    })
    .catch(function (err) {
      if (token !== dsRunToken) { return; }
      dsSetStatus('<span class="err">Erro ao consultar: ' + esc(formatErr(err)) + '</span>');
    });
}

function dsFillFromNetwork() {
  var item = null;
  if (typeof netMonitorItems !== 'undefined') {
    for (var i = 0; i < netMonitorItems.length; i++) {
      if (netMonitorItems[i].id === netMonitorSelectedId) { item = netMonitorItems[i]; break; }
    }
  }
  var info = item && item.datasetInfo;
  if (!item || item.kind !== 'dataset' || !info || !info.dataset) {
    dsSetStatus('<span class="muted">Na aba Rede, selecione uma chamada de dataset e volte aqui.</span>');
    return;
  }
  var nameEl = document.getElementById('ds-name');
  var fieldsEl = document.getElementById('ds-fields');
  var orderEl = document.getElementById('ds-order');
  if (nameEl) { nameEl.value = info.dataset; }
  if (fieldsEl) { fieldsEl.value = (info.fields || []).join(', '); }
  if (orderEl) { orderEl.value = (info.order || []).join(', '); }
  var box = document.getElementById('ds-constraints');
  if (box) { box.innerHTML = ''; }
  var constraints = info.constraints || [];
  if (!constraints.length) { dsAddConstraintRow(); }
  for (var c = 0; c < constraints.length; c++) {
    dsAddConstraintRow({
      field: constraints[c].field,
      initial: constraints[c].initial,
      final: constraints[c].final,
      type: constraints[c].type,
      like: !!constraints[c].like
    });
  }
  var more = document.getElementById('ds-more');
  if (more) { more.open = true; }
  dsSetStatus('<span class="ok">Filtros copiados de <code>' + esc(info.dataset) + '</code>. Clique em Consultar.</span>');
}

function dsCopyResult(btn) {
  if (!dsLastPayload) {
    dsSetStatus('<span class="muted">Consulte um dataset antes de copiar.</span>');
    return;
  }
  copyWithFeedback(JSON.stringify(dsLastPayload, null, 2), btn);
}

(function initDatasetInspect() {
  dsAddConstraintRow();

  var tabBtn = document.getElementById('tab-btn-dados');
  if (tabBtn) {
    tabBtn.addEventListener('click', function () {
      switchTab('dados');
      dsRefreshNameList();
      dsLoadCatalog();
    });
  }

  var runBtn = document.getElementById('btn-ds-run');
  if (runBtn) { runBtn.addEventListener('click', dsRunQuery); }

  var nameEl = document.getElementById('ds-name');
  if (nameEl) {
    nameEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { dsRunQuery(); }
    });
  }

  var addBtn = document.getElementById('btn-ds-add');
  if (addBtn) { addBtn.addEventListener('click', function () { dsAddConstraintRow(); }); }

  var fromNet = document.getElementById('btn-ds-from-net');
  if (fromNet) { fromNet.addEventListener('click', dsFillFromNetwork); }

  var copyBtn = document.getElementById('btn-ds-copy');
  if (copyBtn) { copyBtn.addEventListener('click', function () { dsCopyResult(copyBtn); }); }

  var box = document.getElementById('ds-constraints');
  if (box) {
    box.addEventListener('click', function (e) {
      if (!e.target.closest) { return; }
      var removeBtn = e.target.closest('[data-ds-remove]');
      if (!removeBtn) { return; }
      var row = removeBtn.closest('.ds-constraint');
      if (row && row.parentNode) { row.parentNode.removeChild(row); }
      if (!box.querySelector('.ds-constraint')) { dsAddConstraintRow(); }
    });
  }
})();
