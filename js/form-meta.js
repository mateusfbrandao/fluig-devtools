// js/form-meta.js — Cabeçalho da aba Formulário
// Script classico (escopo global compartilhado); ordem de carga definida em panel.html.
//
// Lê nome, versão e ids na página (ECM.workflowView, URL e campos ocultos).
// O id da ficha da solicitação vem do que a aba Processo já resolveu.
// Se faltar nome, versão ou o id do formulário, consulta o dataset document
// em segundo plano. Sem ficha, mostra a widget que contém os campos.

var formMetaState = null;
var formMetaToken = 0;
var formDocPending = '';
var formDocKey = '';
var formDocTries = 0;
var formDocTryKey = '';

function formMetaText() {
  for (var i = 0; i < arguments.length; i++) {
    if (arguments[i] != null && String(arguments[i]) !== '') { return String(arguments[i]); }
  }
  return '';
}

function formMetaFromSolicitacao() {
  if (typeof solicitacaoView === 'undefined' || !solicitacaoView || !solicitacaoView.ok) { return null; }
  var wv = solicitacaoView.workflowView || {};
  var meta = solicitacaoView.process || {};
  return {
    name: wv.formDescription || '',
    version: wv.formVersion || '',
    formId: solicitacaoView.cardIndexDocumentId || '',
    cardId: solicitacaoView.documentId || '',
    companyId: meta.companyId || ''
  };
}

function buildFormMetaExpr() {
  return [
    '(function () {',
    PAGE_HELPERS,
    '  function clean(v) {',
    '    if (v == null || typeof v === "function" || typeof v === "object") { return ""; }',
    '    return String(v).replace(/^\\s+|\\s+$/g, "");',
    '  }',
    '  function wvText(wv, key) {',
    '    try { return clean(wv[key]); } catch (e) { return ""; }',
    '  }',
    '  var bag = { name: "", version: "", formId: "", cardId: "", companyId: "", widgets: [] };',
    '  function takeId(slot, val) {',
    '    if (bag[slot] || !/^\\d+$/.test(String(val || ""))) { return; }',
    '    bag[slot] = String(val);',
    '  }',
    '  function absorbQuery(href, allowVersion) {',
    '    var qs = String(href || "").split("#")[0].split("?").slice(1).join("?");',
    '    if (!qs) { return; }',
    '    var parts = qs.split("&");',
    '    for (var i = 0; i < parts.length; i++) {',
    '      var eq = parts[i].indexOf("=");',
    '      if (eq < 0) { continue; }',
    '      var key, val;',
    '      try {',
    '        key = decodeURIComponent(parts[i].slice(0, eq)).toLowerCase();',
    '        val = decodeURIComponent(parts[i].slice(eq + 1)).replace(/^\\s+|\\s+$/g, "");',
    '      } catch (e) { continue; }',
    '      if (!val) { continue; }',
    '      if (key === "documentid" || key === "wdnrdocto" || key === "nrdocto" || key === "cardid") { takeId("cardId", val); }',
    '      else if (key === "parentdocumentid" || key === "cardindexdocumentid" || key === "formid") { takeId("formId", val); }',
    '      else if ((key === "companyid" || key === "wdcompanyid") && !bag.companyId) { bag.companyId = val; }',
    '      else if (allowVersion && !bag.version && (key === "version" || key === "wdnrversao" || key === "nrversao" || key === "documentversion")) { bag.version = val; }',
    '    }',
    '  }',
    '  function isCustom(node) {',
    '    try {',
    '      if (node.classList && node.classList.contains("widget-custom-inside")) { return true; }',
    '      if (node.closest && node.closest(".widget-custom-inside")) { return true; }',
    '      if (node.querySelector && node.querySelector(".widget-custom-inside")) { return true; }',
    '    } catch (e) {}',
    '    return false;',
    '  }',
    '  function widgetHasField(node) {',
    '    var nodes;',
    '    try { nodes = node.querySelectorAll("input, select, textarea, span[name]"); } catch (e) { return false; }',
    '    for (var n = 0; n < nodes.length; n++) {',
    '      var el = nodes[n];',
    '      var raw = el.getAttribute("name") || el.id;',
    '      if (!raw) { continue; }',
    '      var t = String(el.type || el.tagName || "").toLowerCase();',
    '      if (t === "button" || t === "submit" || t === "reset" || t === "image") { continue; }',
    '      return true;',
    '    }',
    '    return false;',
    '  }',
    '  var wins = collectWindows(window, [], 0);',
    '  for (var w = 0; w < wins.length; w++) {',
    '    var win = wins[w];',
    '    var wv = null;',
    '    try {',
    '      if (win.ECM && win.ECM.workflowView) { wv = win.ECM.workflowView; }',
    '      else if (win.parent && win.parent.ECM && win.parent.ECM.workflowView) { wv = win.parent.ECM.workflowView; }',
    '      else if (win.top && win.top.ECM && win.top.ECM.workflowView) { wv = win.top.ECM.workflowView; }',
    '    } catch (e) {}',
    '    if (wv) {',
    '      if (!bag.name) { bag.name = wvText(wv, "formDescription"); }',
    '      if (!bag.version) { bag.version = wvText(wv, "formVersion"); }',
    '      if (!bag.formId) { takeId("formId", wvText(wv, "formId") || wvText(wv, "cardIndexDocumentId") || wvText(wv, "parentDocumentId")); }',
    '      if (!bag.cardId) { takeId("cardId", wvText(wv, "cardDocumentId") || wvText(wv, "documentId")); }',
    '      if (!bag.companyId) { bag.companyId = wvText(wv, "companyId"); }',
    '    }',
    '    var href = "";',
    '    try { href = String(win.location && win.location.href || ""); } catch (e2) {}',
    '    var processUrl = /processinstanceid|pageworkflowview/i.test(href);',
    '    absorbQuery(href, !processUrl);',
    '    var doc;',
    '    try { doc = win.document; } catch (e3) { continue; }',
    '    if (!doc) { continue; }',
    '    var frames;',
    '    try { frames = doc.querySelectorAll("iframe, frame"); } catch (e4) { frames = []; }',
    '    for (var f = 0; f < frames.length; f++) {',
    '      var src = frames[f].getAttribute("src") || "";',
    '      var srcProcess = /processinstanceid|pageworkflowview/i.test(src);',
    '      absorbQuery(src, !srcProcess);',
    '    }',
    '    var inputs;',
    '    try { inputs = doc.querySelectorAll("input[name], input[id]"); } catch (e5) { inputs = []; }',
    '    for (var p = 0; p < inputs.length; p++) {',
    '      var input = inputs[p];',
    '      if (w === 0) {',
    '        var inWidget = false;',
    '        try { inWidget = !!(input.closest && input.closest(".wcm-widget-class, .super-widget, .widget-custom-inside")); } catch (e5b) {}',
    '        if (!inWidget) { continue; }',
    '      }',
    '      var nm = String(input.getAttribute("name") || input.id || "").toLowerCase();',
    '      var val = clean(input.value);',
    '      if (!nm || !val) { continue; }',
    '      if (nm === "documentid" || nm === "wdnrdocto" || nm === "cardid") { takeId("cardId", val); }',
    '      else if (nm === "parentdocumentid" || nm === "cardindexdocumentid" || nm === "formid") { takeId("formId", val); }',
    '      else if ((nm === "companyid" || nm === "wdcompanyid") && !bag.companyId) { bag.companyId = val; }',
    '      else if (!bag.version && (nm === "version" || nm === "wdnrversao" || nm === "formversion")) { bag.version = val; }',
    '    }',
    '    var roots;',
    '    try { roots = doc.querySelectorAll(".wcm-widget-class, .super-widget, .widget-custom-inside"); } catch (e6) { roots = []; }',
    '    var seen = {};',
    '    for (var r = 0; r < roots.length && bag.widgets.length < 8; r++) {',
    '      var node = roots[r];',
    '      var isMarker = false;',
    '      var isRoot = false;',
    '      try {',
    '        isMarker = node.classList && node.classList.contains("widget-custom-inside");',
    '        isRoot = node.classList && (node.classList.contains("wcm-widget-class") || node.classList.contains("super-widget"));',
    '        if (isMarker && !isRoot && node.querySelector(".wcm-widget-class, .super-widget")) { continue; }',
    '      } catch (e7) {}',
    '      if (!widgetHasField(node)) { continue; }',
    '      var id = node.id || "";',
    '      var key = w + "|" + (id || ("#" + r));',
    '      if (seen[key]) { continue; }',
    '      seen[key] = true;',
    '      var us = id.indexOf("_");',
    '      bag.widgets.push({',
    '        code: us > 0 ? id.slice(0, us) : "",',
    '        instanceId: us > 0 ? id.slice(us + 1) : "",',
    '        id: id,',
    '        custom: isCustom(node)',
    '      });',
    '    }',
    '  }',
    '  return bag;',
    '})()'
  ].join('\n');
}

function buildFormDocExpr(spec) {
  return [
    '(function () {',
    PAGE_HELPERS,
    '  var spec = ' + JSON.stringify(spec) + ';',
    '  function rowsOf(data) {',
    '    if (!data) { return []; }',
    '    var content = data;',
    '    if (data.content && (data.content.values || data.content.columns)) { content = data.content; }',
    '    return Array.isArray(content.values) ? content.values : [];',
    '  }',
    '  function cellOf(row, key) {',
    '    try {',
    '      if (!row || !key) { return ""; }',
    '      if (row[key] != null && typeof row[key] !== "object") { return row[key]; }',
    '      var parts = key.split(".");',
    '      var cur = row;',
    '      for (var p = 0; p < parts.length; p++) {',
    '        if (cur == null || typeof cur !== "object") { return ""; }',
    '        cur = cur[parts[p]];',
    '      }',
    '      if (cur == null || typeof cur === "object") { return ""; }',
    '      return cur;',
    '    } catch (e) { return ""; }',
    '  }',
    '  function pick(row, keys) {',
    '    for (var i = 0; i < keys.length; i++) {',
    '      var v = cellOf(row, keys[i]);',
    '      if (v != null && String(v) !== "") { return String(v); }',
    '    }',
    '    return "";',
    '  }',
    '  function summarize(rows) {',
    '    var best = null;',
    '    var bestScore = -1;',
    '    for (var i = 0; i < rows.length; i++) {',
    '      var row = rows[i];',
    '      var ver = pick(row, ["documentPK.version", "version"]);',
    '      var score = 0;',
    '      if (spec.version && (ver === String(spec.version) || ver === String(Number(spec.version) * 1000))) { score += 5; }',
    '      var n = Number(ver);',
    '      if (!isNaN(n)) { score += Math.min(n, 100000) / 100000; }',
    '      if (score >= bestScore) { bestScore = score; best = row; }',
    '    }',
    '    if (!best) { return { description: "", version: "", parentId: "", documentType: "", documentId: "", companyId: "" }; }',
    '    return {',
    '      description: pick(best, ["documentDescription"]),',
    '      version: pick(best, ["documentPK.version", "version"]),',
    '      parentId: pick(best, ["parentDocumentId"]),',
    '      documentType: pick(best, ["documentType", "documentTypeId"]),',
    '      documentId: pick(best, ["documentPK.documentId", "documentId"]),',
    '      companyId: pick(best, ["documentPK.companyId", "companyId"])',
    '    };',
    '  }',
    '  var wins = collectWindows(window, [], 0);',
    '  var dsWin = null;',
    '  for (var i = 0; i < wins.length; i++) {',
    '    try { if (wins[i].DatasetFactory && typeof wins[i].DatasetFactory.getDataset === "function") { dsWin = wins[i]; break; } } catch (e) {}',
    '  }',
    '  if (!dsWin) { return { ok: false, message: "DatasetFactory indisponível." }; }',
    '  var jobs = dsWin.__FLUIG_DEBUG_DS__ || (dsWin.__FLUIG_DEBUG_DS__ = {});',
    '  jobs[spec.id] = { status: "pending" };',
    '  var DF = dsWin.DatasetFactory, CT = dsWin.ConstraintType;',
    '  var done = false;',
    '  function finish(rows, failed) {',
    '    if (done) { return; }',
    '    done = true;',
    '    if (failed) { jobs[spec.id] = { status: "error" }; return; }',
    '    var summary = summarize(rows || []);',
    '    summary.status = "ok";',
    '    jobs[spec.id] = summary;',
    '  }',
    '  try {',
    '    var constraints = [DF.createConstraint("documentPK.documentId", String(spec.documentId), String(spec.documentId), CT.MUST), DF.createConstraint("sqlLimit", "30", "30", CT.MUST)];',
    '    var ret = DF.getDataset("document", null, constraints, null, {',
    '      success: function (data) { finish(rowsOf(data), false); },',
    '      error: function () { finish([], true); }',
    '    });',
    '    var syncRows = rowsOf(ret);',
    '    if (syncRows.length) { finish(syncRows, false); }',
    '  } catch (e) {',
    '    try { finish(rowsOf(DF.getDataset("document", null, [DF.createConstraint("documentPK.documentId", String(spec.documentId), String(spec.documentId), CT.MUST)], null)), false); }',
    '    catch (e2) { finish([], true); }',
    '  }',
    '  setTimeout(function () { finish([], true); }, 7000);',
    '  return { ok: true, id: spec.id };',
    '})()'
  ].join('\n');
}

function buildFormDocPollExpr(id) {
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

function composeFormMeta(raw) {
  raw = raw || {};
  var proc = formMetaFromSolicitacao() || {};
  var widgets = Array.isArray(raw.widgets) ? raw.widgets : ((formMetaState && formMetaState.widgets) || []);
  var info = {
    name: formMetaText(raw.name, proc.name),
    version: formMetaText(raw.version, proc.version),
    formId: formMetaText(raw.formId, proc.formId),
    cardId: formMetaText(proc.cardId, raw.cardId),
    companyId: formMetaText(raw.companyId, proc.companyId),
    widgets: widgets
  };
  var hasForm = !!(info.name || info.version || info.formId || info.cardId);
  var custom = [];
  var other = [];
  for (var i = 0; i < info.widgets.length; i++) {
    var w = info.widgets[i];
    if (!w) { continue; }
    if (w.custom) { custom.push(w); }
    else { other.push(w); }
  }
  var pool = hasForm ? custom : custom.concat(other);
  info.widgets = pool.slice(0, 3);
  return info;
}

function renderFormMeta(info) {
  var el = document.getElementById('form-meta');
  if (!el || typeof ctxRow !== 'function' || typeof ctxGroup !== 'function') { return; }
  if (!info) {
    el.innerHTML = '';
    return;
  }
  var formRows = ctxRow('Nome', info.name, 'is-strong') +
    ctxRow('Versão', info.version) +
    ctxRow('Id do formulário', info.formId) +
    ctxRow('Id da ficha', info.cardId) +
    ctxRow('Empresa', info.companyId);
  var widgetRows = '';
  var widgets = info.widgets || [];
  for (var i = 0; i < widgets.length; i++) {
    var w = widgets[i];
    var text = w.code || w.id || '';
    if (w.instanceId) { text += (text ? ' · ' : '') + w.instanceId; }
    widgetRows += ctxRow('Widget', text);
  }
  if (!formRows && !widgetRows) {
    el.innerHTML = '';
    return;
  }
  var html = '<div class="ctx-board form-meta">';
  if (formRows) { html += ctxGroup('Formulário', formRows); }
  if (widgetRows) { html += ctxGroup(formRows ? 'Widget' : 'Formulário', widgetRows); }
  html += '</div>';
  el.innerHTML = html;
}

function applyFormDocument(info, job) {
  if (!info || !job || job.status !== 'ok') { return info; }
  if (!info.name && job.description) { info.name = String(job.description); }
  if (!info.version && job.version) { info.version = String(job.version); }
  if (!info.companyId && job.companyId) { info.companyId = String(job.companyId); }
  var parent = job.parentId ? String(job.parentId) : '';
  var isCard = String(job.documentType || '') === '5';
  if (!info.formId && isCard && parent && parent !== '0' && parent !== info.cardId) {
    info.formId = parent;
  }
  return info;
}

function startFormDocument(info) {
  if (!info) { return; }
  var queryId = info.formId || info.cardId;
  var need = queryId && (!info.name || !info.version || (info.cardId && !info.formId));
  if (!need) { return; }
  var key = [queryId, info.version || '', info.cardId || ''].join('|');
  if (formDocPending === key || formDocKey === key) { return; }
  if (formDocTryKey !== key) {
    formDocTryKey = key;
    formDocTries = 0;
  }
  if (formDocTries >= 4) { return; }
  formDocTries++;
  formDocPending = key;
  var token = formMetaToken;
  var spec = {
    id: 'formdoc-' + Date.now(),
    documentId: String(queryId),
    version: info.version ? String(info.version) : ''
  };
  evalInPage(buildFormDocExpr(spec), { track: true })
    .then(function (started) {
      if (token !== formMetaToken) { return; }
      if (!started || !started.ok) {
        if (formDocPending === key) { formDocPending = ''; }
        return;
      }
      var attempts = 0;
      function poll() {
        if (token !== formMetaToken) { return; }
        attempts++;
        evalInPage(buildFormDocPollExpr(spec.id))
          .then(function (job) {
            if (token !== formMetaToken) { return; }
            if (job && (job.status === 'ok' || job.status === 'error')) {
              if (formDocPending === key) { formDocPending = ''; }
              if (job.status === 'ok' && formMetaState) {
                formDocKey = key;
                applyFormDocument(formMetaState, job);
                renderFormMeta(formMetaState);
              }
              return;
            }
            if (attempts < 40) { setTimeout(poll, 200); }
          })
          .catch(function () {
            if (token === formMetaToken && attempts < 40) { setTimeout(poll, 200); }
          });
      }
      poll();
    })
    .catch(function () {
      if (token === formMetaToken && formDocPending === key) { formDocPending = ''; }
    });
}

function publishFormMeta(raw) {
  var info = composeFormMeta(raw);
  var prev = formMetaState ? [formMetaState.name, formMetaState.version, formMetaState.formId, formMetaState.cardId].join('|') : '';
  var next = [info.name, info.version, info.formId, info.cardId].join('|');
  if (prev !== next) {
    formMetaToken++;
    formDocPending = '';
    formDocKey = '';
  }
  formMetaState = info;
  renderFormMeta(info);
  startFormDocument(info);
}

function loadFormMeta() {
  if (!document.getElementById('form-meta')) { return; }
  evalInPage(buildFormMetaExpr())
    .then(function (raw) { publishFormMeta(raw || {}); })
    .catch(function () {});
}

function noteFormMetaFromProcess() {
  if (!document.getElementById('form-meta')) { return; }
  publishFormMeta(formMetaState || {});
}
