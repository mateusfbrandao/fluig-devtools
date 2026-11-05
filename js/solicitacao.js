// js/solicitacao.js — Solicitacao: documentId e helpers de dataset
// Script classico (escopo global compartilhado); ordem de carga definida em panel.html.

// ---------------------------------------------------------------------------
// Solicitação: documentId a partir do nº da solicitação (CU-03)
// ---------------------------------------------------------------------------
//
// Fluxo (roda automatico ao abrir o painel, sem clique):
//   1. Le o numero da solicitacao na URL, em qualquer parametro do workflowview
//      terminado em processInstanceId (o nome muda conforme a origem da
//      abertura: _detailsProcessInstanceID na consulta, _processInstanceId na
//      tarefa). Ver numProcessFromUrl.
//   2. Consulta o dataset workflowProcess (via DatasetFactory CLIENT-SIDE, que
//      existe no contexto do formulario Fluig) filtrando por
//      workflowProcessPK.processInstanceId e pedindo cardDocumentId.
//   3. cardDocumentId e o documentId da solicitacao.
//
// Nao garimpamos o DOM: o valor vem do proprio dataset do Fluig (autoritativo).
// O DatasetFactory client-side devolve { columns, values }, onde values e um
// array de objetos indexados por nome de coluna (diferente do server-side).
// Helpers de dataset (client-side) injetados no IIFE. Usados para resolver o
// documentId da solicitação via workflowProcess.
var DATASET_HELPERS = [
  '  // Frame que expoe o DatasetFactory client-side do Fluig.',
  '  function findDatasetWin(wins) {',
  '    for (var i = 0; i < wins.length; i++) {',
  '      try { if (wins[i].DatasetFactory && typeof wins[i].DatasetFactory.getDataset === "function") { return wins[i]; } } catch (e) {}',
  '    }',
  '    return null;',
  '  }',
  '  // Numero da solicitacao a partir da URL (param do workflowview). O nome do',
  '  // parametro MUDA conforme por onde a solicitacao foi aberta:',
  '  //   ...?app_ecm_workflowview_detailsProcessInstanceID=717  (consulta/detalhes)',
  '  //   ...?app_ecm_workflowview_processInstanceId=698707      (tarefa/movimentacao)',
  '  // Por isso nao fixamos um nome: varremos os parametros da query e aceitamos',
  '  // qualquer chave que termine em "processinstanceid" (case-insensitive) com',
  '  // valor numerico. O sufixo e especifico o bastante para nao pegar os vizinhos',
  '  // (currentMovto, taskUserId, managerMode).',
  '  function readWorkflowUrl(href) {',
    '    var found = {};',
    '    var qs = String(href).split("#")[0].split("?").slice(1).join("?");',
    '    if (!qs) { return found; }',
    '    var parts = qs.split("&");',
    '    for (var i = 0; i < parts.length; i++) {',
    '      var eq = parts[i].indexOf("=");',
    '      if (eq < 0) { continue; }',
    '      var key, val;',
    '      try { key = decodeURIComponent(parts[i].slice(0, eq)); val = decodeURIComponent(parts[i].slice(eq + 1)); } catch (e) { continue; }',
    '      if (!val) { continue; }',
    '      if (/processinstanceid$/i.test(key) && /^\\d+$/.test(val)) { found.numProcess = val; }',
    '      else if (/taskuserid$/i.test(key)) { found.taskUserId = val; }',
    '      else if (/currentmovto$/i.test(key)) { found.currentMovto = val; }',
    '      else if (/managermode$/i.test(key)) { found.managerMode = val; }',
    '      else if (/companyid$/i.test(key)) { found.companyId = val; }',
    '    }',
    '    return found;',
    '  }',
    '  function findWorkflowUrl(wins) {',
    '    var merged = {};',
    '    for (var i = 0; i < wins.length; i++) {',
    '      var href;',
    '      try { href = String(wins[i].location.href); } catch (e) { continue; }',
    '      var part = readWorkflowUrl(href);',
    '      for (var k in part) {',
    '        if (part[k] && !merged[k]) { merged[k] = part[k]; }',
    '      }',
    '    }',
    '    return merged;',
    '  }',
    '  function wvText(wv, key) {',
    '    try {',
    '      var v = wv[key];',
    '      if (v == null || typeof v === "function" || typeof v === "object") { return null; }',
    '      var s = String(v).replace(/^\\s+|\\s+$/g, "");',
    '      return s ? s : null;',
    '    } catch (e) { return null; }',
    '  }',
    '  function firstText() {',
    '    for (var i = 0; i < arguments.length; i++) {',
    '      if (arguments[i] != null && String(arguments[i]) !== "") { return String(arguments[i]); }',
    '    }',
    '    return null;',
    '  }',
    '  function statusLabel(v) {',
    '    var s = v == null ? "" : String(v).replace(/^\\s+|\\s+$/g, "");',
    '    if (s === "0") { return "Aberto"; }',
    '    if (s === "1") { return "Cancelado"; }',
    '    if (s === "2") { return "Finalizado"; }',
    '    return s || null;',
    '  }',
    '  function formatWhen(v) {',
    '    if (v == null || v === "") { return null; }',
    '    var raw = typeof v === "number" ? String(v) : String(v).replace(/^\\s+|\\s+$/g, "");',
    '    if (/^\\d{12,}$/.test(raw)) {',
    '      var d = new Date(Number(raw));',
    '      if (isNaN(d.getTime())) { return raw; }',
    '      function p(n) { return (n < 10 ? "0" : "") + n; }',
    '      var date = p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();',
    '      if (d.getHours() || d.getMinutes()) { return date + " " + p(d.getHours()) + ":" + p(d.getMinutes()); }',
    '      return date;',
    '    }',
    '    return raw || null;',
    '  }',
    '  function cell(row, name) {',
    '    if (!row || row[name] == null || row[name] === "") { return null; }',
    '    return row[name];',
    '  }',
  '  // documentId da solicitacao: workflowProcess -> cardDocumentId + metadados workflowView.',
  '  function resolveDocId(wins) {',
  '    var page = findWorkflowUrl(wins);',
    '    var numProcess = page.numProcess;',
    '    if (!numProcess) { return { ok: false, stage: "url", message: "Número da solicitação não encontrado na URL (nenhum parâmetro *processInstanceId). Abra a extensão sobre uma solicitação de workflow." }; }',
    '',
    '    // Tenta obter metadados do ECM.workflowView através dos frames',
    '    var wfInfo = {',
    '      formDescription: null, formVersion: null, sequence: null, currentStateDescription: null,',
    '      processId: null, processDescription: null, processVersion: null,',
    '      companyId: null, currentMovto: null, taskUserId: null',
    '    };',
  '    for (var wIdx = 0; wIdx < wins.length; wIdx++) {',
  '      var wObj = wins[wIdx];',
  '      var wv = null;',
  '      try {',
  '        if (wObj.ECM && wObj.ECM.workflowView) { wv = wObj.ECM.workflowView; }',
  '        else if (wObj.parent && wObj.parent.ECM && wObj.parent.ECM.workflowView) { wv = wObj.parent.ECM.workflowView; }',
  '        else if (wObj.top && wObj.top.ECM && wObj.top.ECM.workflowView) { wv = wObj.top.ECM.workflowView; }',
  '      } catch (e) {}',
  '',
  '      if (wv) {',
  '        if (!wfInfo.formDescription) { wfInfo.formDescription = wvText(wv, "formDescription"); }',
    '        if (!wfInfo.formVersion) { wfInfo.formVersion = wvText(wv, "formVersion"); }',
    '        if (!wfInfo.sequence) { wfInfo.sequence = wvText(wv, "sequence"); }',
    '        if (!wfInfo.currentStateDescription) { wfInfo.currentStateDescription = wvText(wv, "currentStateDescription"); }',
    '        if (!wfInfo.processId) { wfInfo.processId = wvText(wv, "processId"); }',
    '        if (!wfInfo.processDescription) { wfInfo.processDescription = wvText(wv, "processDescription"); }',
    '        if (!wfInfo.processVersion) { wfInfo.processVersion = wvText(wv, "version"); }',
    '        if (!wfInfo.companyId) { wfInfo.companyId = wvText(wv, "companyId"); }',
    '        if (!wfInfo.currentMovto) { wfInfo.currentMovto = firstText(wvText(wv, "currentMovto"), wvText(wv, "movementSequence")); }',
    '        if (!wfInfo.taskUserId) { wfInfo.taskUserId = firstText(wvText(wv, "taskUserId"), wvText(wv, "taskUser")); }',
    '        if (wfInfo.formDescription || wfInfo.sequence) { break; }',
  '      }',
  '    }',
  '',
  '    var dsWin = findDatasetWin(wins);',
  '    if (!dsWin) {',
  '      return {',
  '        ok: false,',
  '        stage: "dataset",',
  '        numProcess: numProcess,',
  '        workflowView: wfInfo,',
    '        page: page,',
    '        message: "DatasetFactory não disponível no client-side (formulário ainda carregando?). Tente Recarregar."',
  '      };',
  '    }',
  '    try {',
  '      var DF = dsWin.DatasetFactory, CT = dsWin.ConstraintType;',
  '      var c1 = DF.createConstraint("workflowProcessPK.processInstanceId", numProcess, numProcess, CT.MUST);',
  '      var c4 = DF.createConstraint("sqlLimit", "300", "300", CT.MUST);',
  '      var dataset = DF.getDataset("workflowProcess", ["processId", "version", "status", "requesterId", "startDateProcess", "endDateProcess", "companyId", "cardIndexDocumentId", "cardDocumentId"], [c1, c4], null);',
  '      var values = (dataset && dataset.values) ? dataset.values : [];',
  '      if (!values.length) {',
  '        return {',
  '          ok: false,',
  '          stage: "empty",',
  '          numProcess: numProcess,',
  '          workflowView: wfInfo,',
    '          page: page,',
    '          message: "Consulta ao workflowProcess retornou vazio para a solicitação " + numProcess + "."',
  '        };',
  '      }',
  '      var row = values[0];',
  '      var processMeta = {',
    '        processId: firstText(cell(row, "processId"), wfInfo.processId),',
    '        processDescription: wfInfo.processDescription,',
    '        version: firstText(cell(row, "version"), wfInfo.processVersion),',
    '        status: statusLabel(cell(row, "status")),',
    '        requesterId: cell(row, "requesterId") != null ? String(cell(row, "requesterId")) : null,',
    '        start: formatWhen(cell(row, "startDateProcess")),',
    '        end: formatWhen(cell(row, "endDateProcess")),',
    '        companyId: firstText(cell(row, "companyId"), cell(row, "workflowProcessPK.companyId"), wfInfo.companyId, page.companyId),',
    '        currentMovto: firstText(page.currentMovto, wfInfo.currentMovto),',
    '        taskUserId: firstText(page.taskUserId, wfInfo.taskUserId),',
    '        managerMode: page.managerMode || null',
    '      };',
    '      return {',
    '        ok: true,',
    '        numProcess: numProcess,',
    '        documentId: (row.cardDocumentId != null ? String(row.cardDocumentId) : null),',
    '        cardIndexDocumentId: (row.cardIndexDocumentId != null ? String(row.cardIndexDocumentId) : null),',
    '        process: processMeta,',
    '        workflowView: wfInfo,',
    '        page: page,',
    '        frame: (dsWin === window ? "top" : "iframe")',
    '      };',
  '    } catch (e) {',
  '      return {',
  '        ok: false,',
  '        stage: "query",',
  '        numProcess: numProcess,',
  '        workflowView: wfInfo,',
    '        page: page,',
    '        message: "Erro na consulta ao dataset: " + (e && e.message ? e.message : String(e))',
  '      };',
  '    }',
  '  }'
].join('\n');

function buildDocumentIdExpr() {
  return [
    '(function () {',
    PAGE_HELPERS,
    DATASET_HELPERS,
    '  return resolveDocId(collectWindows(window, [], 0));',
    '})()'
  ].join('\n');
}

function renderCtxCard(label, copyVal, valueHtml) {
  var copyEsc = esc(copyVal != null ? copyVal : '').replace(/"/g, '&quot;');
  return '<div class="ctx-card" data-copy="' + copyEsc + '" title="Clique para copiar ' + copyEsc + '">' +
    '<div class="ctx-card-top">' +
    '<span class="ctx-label">' + esc(label) + '</span>' +
    '<span class="ctx-copy-ico">' + COPY_SVG + '</span>' +
    '</div>' +
    '<div class="ctx-val">' + valueHtml + '</div>' +
    '</div>';
}

function ctxRow(label, value, valueClass) {
  var text = value == null ? '' : String(value);
  if (!text) { return ''; }
  var attr = esc(text).replace(/"/g, '&quot;');
  var cls = 'ctx-val' + (valueClass ? ' ' + valueClass : '');
  return '<div class="ctx-row">' +
    '<dt>' + esc(label) + '</dt>' +
    '<dd><button type="button" class="' + cls + '" data-copy="' + attr + '" title="Copiar ' + esc(label) + ': ' + attr + '">' +
    esc(text) + '</button></dd></div>';
}

function ctxGroup(title, rows) {
  if (!rows) { return ''; }
  return '<div class="ctx-group"><h3>' + esc(title) + '</h3><dl>' + rows + '</dl></div>';
}

function statusValueClass(status) {
  if (status === 'Aberto') { return 'is-open'; }
  if (status === 'Cancelado') { return 'is-cancel'; }
  return '';
}

function solicitacaoHasStrip() {
  var out = document.getElementById('solicitacao-output');
  return !!(out && out.querySelector('.ctx-board, .ctx-strip'));
}

function tarefaRows(result, meta, ativText) {
  var flow = result.flow;
  var resp = meta.taskUserId || '';
  if (flow && flow.assignees && flow.assignees.length) {
    resp = flow.assignees.join(', ');
  }
  var rows = ctxRow('Atividade', ativText) +
    ctxRow('Movimento', meta.currentMovto) +
    ctxRow('Responsável', resp);
  var next = flow && flow.next;
  if (next && next.length) {
    for (var i = 0; i < next.length; i++) {
      var item = next[i];
      var label = next.length === 1 ? 'Seguinte' : 'Destino';
      var text = item.name || ('#' + item.sequence);
      if (item.assignment) { text += ' · ' + item.assignment; }
      rows += ctxRow(label, text);
    }
  }
  return rows;
}

function renderSolicitacao(result) {
  var status = document.getElementById('solicitacao-status');

  if (!result) {
    status.textContent = 'sem retorno';
    if (!solicitacaoHasStrip()) {
      render('solicitacao-output', '<span class="err">Sem retorno da página.</span>');
    }
    return;
  }

  if (!result.ok && (result.stage === 'url' || !result.numProcess)) {
    status.textContent = '';
    render('solicitacao-output',
      '<div class="ctx-strip ctx-strip-empty">' +
      '<span>Sem processo nesta página.</span>' +
      '<button type="button" class="chip" data-goto-tab="formulario">Abrir Formulário</button>' +
      '</div>');
    return;
  }

  if (!result.ok) {
    status.textContent = result.message || 'não resolvido';
    var pageBits = result.page || {};
    var partial = '<div class="ctx-board">' +
      ctxGroup('Solicitação', ctxRow('Número', result.numProcess)) +
      ctxGroup('Tarefa', ctxRow('Movimento', pageBits.currentMovto) + ctxRow('Responsável', pageBits.taskUserId)) +
      '</div>';
    render('solicitacao-output', partial);
    return;
  }

  status.textContent = '';
  var wv = result.workflowView || {};
  var meta = result.process || {};
  var formText = wv.formDescription || '';
  if (formText && wv.formVersion) { formText += ' v' + wv.formVersion; }
  else if (!formText && wv.formVersion) { formText = 'v' + wv.formVersion; }
  var ativText = '';
  if (wv.sequence && wv.currentStateDescription) {
    ativText = wv.sequence + ' · ' + wv.currentStateDescription;
  } else if (wv.sequence) {
    ativText = String(wv.sequence);
  } else if (wv.currentStateDescription) {
    ativText = wv.currentStateDescription;
  }
  var manager = String(meta.managerMode || '').toLowerCase();
  var isManager = manager === 'true' || manager === '1' || manager === 's' || manager === 'yes';

  var html = '<div class="ctx-board">' +
    ctxGroup('Solicitação',
      ctxRow('Número', result.numProcess, 'is-strong') +
      ctxRow('Situação', meta.status, statusValueClass(meta.status)) +
      ctxRow('Processo', meta.processId) +
      ctxRow('Descrição', meta.processDescription) +
      ctxRow('Versão', meta.version) +
      ctxRow('Solicitante', meta.requesterId) +
      ctxRow('Início', meta.start) +
      ctxRow('Fim', meta.end) +
      ctxRow('Empresa', meta.companyId) +
      (isManager ? ctxRow('Abertura', 'modo gestor') : '')
    ) +
    ctxGroup('Formulário',
      ctxRow('Nome', formText) +
      ctxRow('documentId', result.documentId) +
      (result.cardIndexDocumentId && result.cardIndexDocumentId !== result.documentId
        ? ctxRow('Card index', result.cardIndexDocumentId) : '')
    ) +
    ctxGroup('Tarefa', tarefaRows(result, meta, ativText)) +
    '</div>';
  render('solicitacao-output', html);
}

var solicitacaoView = null;
var flowToken = 0;
var flowCacheKey = '';
var flowCache = null;

function flowKey(result) {
  var meta = (result && result.process) || {};
  var wv = (result && result.workflowView) || {};
  return [
    result && result.numProcess ? result.numProcess : '',
    meta.processId || '',
    meta.version != null ? meta.version : '',
    wv.sequence != null ? wv.sequence : ''
  ].join('|');
}

function buildFlowStartExpr(spec) {
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
    '  function isOpen(row) {',
    '    var st = pick(row, ["status", "taskStatus"]);',
    '    if (st === "0" || st === "1") { return true; }',
    '    if (st === "2" || st === "3" || st === "4") { return false; }',
    '    var active = pick(row, ["active"]);',
    '    return active === "true" || active === "1";',
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
    '  var needLinks = !!(spec.processId && spec.version && spec.sequence);',
    '  var got = {};',
    '  var bagFail = {};',
    '  var bag = { tasks: [], links: [], states: [] };',
    '  function finish() {',
    '    var mov = spec.currentMovto ? String(spec.currentMovto) : "";',
    '    var openAll = [];',
    '    var openMov = [];',
    '    for (var t = 0; t < bag.tasks.length; t++) {',
    '      var task = bag.tasks[t];',
    '      if (!isOpen(task)) { continue; }',
    '      var who = pick(task, ["colleagueName", "processTaskPK.colleagueId", "colleagueId"]);',
    '      if (!who) { continue; }',
    '      if (openAll.indexOf(who) < 0) { openAll.push(who); }',
    '      var taskMov = pick(task, ["processTaskPK.movementSequence", "movementSequence"]);',
    '      if (mov && taskMov === mov && openMov.indexOf(who) < 0) { openMov.push(who); }',
    '    }',
    '    var assignees = openMov.length ? openMov : openAll;',
    '    var next = [];',
    '    var seenDest = {};',
    '    if (needLinks) {',
    '      for (var l = 0; l < bag.links.length; l++) {',
    '        var link = bag.links[l];',
    '        var from = pick(link, ["initialStateSequence"]);',
    '        if (from !== String(spec.sequence)) { continue; }',
    '        var dest = pick(link, ["finalStateSequence", "processLinkPK.finalStateSequence"]);',
    '        if (!dest || seenDest[dest]) { continue; }',
    '        seenDest[dest] = true;',
    '        var state = null;',
    '        for (var s = 0; s < bag.states.length; s++) {',
    '          if (pick(bag.states[s], ["processStatePK.sequence", "sequence"]) === dest) { state = bag.states[s]; break; }',
    '        }',
    '        var name = dest;',
    '        var assignment = "";',
    '        if (state) {',
    '          name = pick(state, ["stateDescription", "stateName"]) || dest;',
    '          var mech = pick(state, ["engineAllocationId"]);',
    '          var cfg = pick(state, ["engineAllocationConfiguration"]);',
    '          if (cfg.length > 80) { cfg = cfg.slice(0, 80) + "…"; }',
    '          if (mech && cfg) { assignment = mech + " · " + cfg; }',
    '          else { assignment = mech || cfg; }',
    '        }',
    '        next.push({ sequence: dest, name: name, assignment: assignment });',
    '        if (next.length >= 8) { break; }',
    '      }',
    '    }',
    '    jobs[spec.id] = {',
    '      status: "ok",',
    '      assignees: assignees,',
    '      next: next,',
    '      nextStatus: !needLinks || bagFail.links || !next.length ? "skipped" : "ok"',
    '    };',
    '  }',
    '  function done(key, rows, failed) {',
    '    if (got[key]) { return; }',
    '    got[key] = true;',
    '    bag[key] = rows || [];',
    '    if (failed) { bagFail[key] = true; }',
    '    if (got.tasks && (!needLinks || (got.links && got.states))) { finish(); }',
    '  }',
    '  function query(name, fields, constraints, key) {',
    '    var syncTaken = false;',
    '    try {',
    '      var ret = DF.getDataset(name, fields, constraints, null, {',
    '        success: function (data) { if (!syncTaken) { done(key, rowsOf(data), false); } },',
    '        error: function () { if (!syncTaken) { done(key, [], true); } }',
    '      });',
    '      var syncRows = rowsOf(ret);',
    '      if (syncRows.length) { syncTaken = true; done(key, syncRows, false); }',
    '    } catch (e) {',
    '      try { syncTaken = true; done(key, rowsOf(DF.getDataset(name, fields, constraints, null)), false); }',
    '      catch (e2) { done(key, [], true); }',
    '    }',
    '  }',
    '  function must(field, value) {',
    '    return DF.createConstraint(field, String(value), String(value), CT.MUST);',
    '  }',
    '  var cap = DF.createConstraint("sqlLimit", "200", "200", CT.MUST);',
    '  query("processTask", null, [must("processTaskPK.processInstanceId", spec.numProcess), cap], "tasks");',
    '  if (needLinks) {',
    '    query("processLink", null, [must("processLinkPK.processId", spec.processId), must("processLinkPK.version", spec.version), must("initialStateSequence", spec.sequence), cap], "links");',
    '    query("processState", null, [must("processStatePK.processId", spec.processId), must("processStatePK.version", spec.version), cap], "states");',
    '  }',
    '  setTimeout(function () {',
    '    if (!got.tasks) { done("tasks", []); }',
    '    if (needLinks) {',
    '      if (!got.links) { done("links", []); }',
    '      if (!got.states) { done("states", []); }',
    '    }',
    '  }, 7000);',
    '  return { ok: true, id: spec.id };',
    '})()'
  ].join('\n');
}

function buildFlowPollExpr(id) {
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

function startFlowLoad(result) {
  var meta = result.process || {};
  var wv = result.workflowView || {};
  if (!result.numProcess) { return; }
  var key = flowKey(result);
  if (flowCache && flowCacheKey === key) {
    result.flow = flowCache;
    renderSolicitacao(result);
    return;
  }
  if (flowCacheKey === key) { return; }
  flowCacheKey = key;
  flowCache = null;
  var token = ++flowToken;
  var spec = {
    id: 'flow-' + Date.now(),
    numProcess: String(result.numProcess),
    processId: meta.processId ? String(meta.processId) : '',
    version: meta.version != null ? String(meta.version) : '',
    sequence: wv.sequence != null ? String(wv.sequence) : '',
    currentMovto: meta.currentMovto != null ? String(meta.currentMovto) : ''
  };
  evalInPage(buildFlowStartExpr(spec), { track: true })
    .then(function (started) {
      if (token !== flowToken) { return; }
      if (!started || !started.ok) {
        if (flowCacheKey === key) { flowCacheKey = ''; }
        return;
      }
      var attempts = 0;
      function poll() {
        if (token !== flowToken) { return; }
        attempts++;
        evalInPage(buildFlowPollExpr(spec.id))
          .then(function (job) {
            if (token !== flowToken) { return; }
            if (job && job.status === 'ok') {
              flowCache = job;
              if (solicitacaoView && flowKey(solicitacaoView) === key) {
                solicitacaoView.flow = job;
                renderSolicitacao(solicitacaoView);
              }
              return;
            }
            if (job && job.status === 'error') { return; }
            if (attempts < 40) { setTimeout(poll, 200); }
          })
          .catch(function () {
            if (token !== flowToken) { return; }
            if (attempts < 40) { setTimeout(poll, 200); }
          });
      }
      poll();
    })
    .catch(function () {
      if (token === flowToken && flowCacheKey === key) { flowCacheKey = ''; }
    });
}

var solicitacaoRetryTimer = null;
var solicitacaoRetryCount = 0;
var SOLICITACAO_MAX_RETRIES = 25;
var SOLICITACAO_RETRY_MS = 650;

function cancelSolicitacaoRetry() {
  if (solicitacaoRetryTimer) {
    clearTimeout(solicitacaoRetryTimer);
    solicitacaoRetryTimer = null;
  }
}

function scheduleSolicitacaoRetry() {
  if (solicitacaoRetryCount >= SOLICITACAO_MAX_RETRIES) { return false; }
  solicitacaoRetryCount++;
  cancelSolicitacaoRetry();
  solicitacaoRetryTimer = setTimeout(function () {
    solicitacaoRetryTimer = null;
    loadSolicitacao(true);
  }, SOLICITACAO_RETRY_MS);
  return true;
}

function loadSolicitacao(isRetry) {
  var status = document.getElementById('solicitacao-status');
  if (!status) { return; }
  if (isRetry !== true) {
    cancelSolicitacaoRetry();
    solicitacaoRetryCount = 0;
    flowToken++;
    flowCacheKey = '';
    flowCache = null;
    status.textContent = 'atualizando';
  }

  evalInPage(buildDocumentIdExpr(), { track: true })
    .then(function (result) {
      // Enquanto a pagina / iframe ainda esta carregando o DatasetFactory,
      // aguarda e tenta novamente sem exibir erro prematuro.
      if (!result || (!result.ok && (result.stage === 'dataset' || result.stage === 'query'))) {
        if (scheduleSolicitacaoRetry()) {
          status.textContent = 'atualizando';
          return;
        }
      }

      solicitacaoView = result;
      renderSolicitacao(result);
      if (typeof noteFormMetaFromProcess === 'function') { noteFormMetaFromProcess(); }
      if (result && result.ok) { startFlowLoad(result); }

      // Se o documentId ja resolveu mas os metadados do ECM.workflowView
      // (formDescription / sequence) ainda nao chegaram via AJAX, faz mais
      // algumas tentativas silenciosas para preencher o cabeçalho completo.
      if (result && result.ok && !(result.workflowView && result.workflowView.formDescription)) {
        scheduleSolicitacaoRetry();
      } else {
        cancelSolicitacaoRetry();
      }
    })
    .catch(function (exceptionInfo) {
      if (scheduleSolicitacaoRetry()) {
        status.textContent = 'atualizando';
        return;
      }
      status.textContent = 'erro';
      if (!solicitacaoHasStrip()) {
        render('solicitacao-output', '<span class="err">Erro ao resolver: ' + esc(JSON.stringify(exceptionInfo)) + '</span>');
      }
    });
}

var solicitacaoOutputEl = document.getElementById('solicitacao-output');
if (solicitacaoOutputEl) {
  solicitacaoOutputEl.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-goto-tab]');
    if (!btn) { return; }
    var name = btn.getAttribute('data-goto-tab');
    if (typeof switchTab === 'function') { switchTab(name); }
    if (name === 'formulario') {
      var rf = document.getElementById('read-field');
      if (rf) { rf.focus(); }
    }
  });
}
