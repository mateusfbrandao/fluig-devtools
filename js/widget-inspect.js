// js/widget-inspect.js — Aba Widget: inspeção somente leitura de SuperWidget
// Script classico (escopo global compartilhado); ordem de carga definida em panel.html.

// Varre .wcm-widget-class / .super-widget em todos os frames e lê a definição
// global citada em data-params (MeuWidget.instance()). Não chama init, instance()
// nem handlers de binding.

var widgetScan = null;

function widgetSetStatus(html) {
  var el = document.getElementById('widget-status');
  if (el) { el.innerHTML = html; }
}

function buildWidgetScanExpr() {
  return [
    '(function () {',
    PAGE_HELPERS,
    '  var REQUIRED = ["fluig-style-guide", "super-widget", "wcm-widget-class"];',
    '  function ownNames(obj) {',
    '    try { return obj ? Object.getOwnPropertyNames(obj) : []; } catch (e) { return []; }',
    '  }',
    '  function fnNames(obj, skip) {',
    '    var names = [];',
    '    var keys = ownNames(obj);',
    '    for (var i = 0; i < keys.length; i++) {',
    '      var k = keys[i];',
    '      if (!k || k === "constructor" || k === "bindings" || k === "toString" || k === "valueOf") { continue; }',
    '      if (skip && skip[k]) { continue; }',
    '      var val;',
    '      try { val = obj[k]; } catch (e) { continue; }',
    '      if (typeof val === "function") { names.push(k); }',
    '    }',
    '    return names;',
    '  }',
    '  function bindingList(obj) {',
    '    if (!obj || typeof obj !== "object" || typeof obj === "function") { return []; }',
    '    var out = [];',
    '    var keys = ownNames(obj);',
    '    for (var i = 0; i < keys.length; i++) {',
    '      var k = keys[i];',
    '      var v;',
    '      try { v = obj[k]; } catch (e) { continue; }',
    '      var handlers = [];',
    '      if (Array.isArray(v)) {',
    '        for (var h = 0; h < v.length; h++) { handlers.push(String(v[h])); }',
    '      } else if (v != null && typeof v !== "object" && typeof v !== "function") {',
    '        handlers.push(String(v));',
    '      } else if (typeof v === "string") {',
    '        handlers.push(v);',
    '      }',
    '      out.push({ event: String(k), handlers: handlers });',
    '    }',
    '    return out;',
    '  }',
    '  function readDefinition(win, globalName) {',
    '    var empty = { found: false, methods: [], localBindings: [], globalBindings: [] };',
    '    if (!globalName) { return empty; }',
    '    var ctor = null;',
    '    try { ctor = win[globalName]; } catch (e) { return empty; }',
    '    if (!ctor) { return empty; }',
    '    var skip = {};',
    '    try {',
    '      if (win.SuperWidget && win.SuperWidget.prototype) {',
    '        var baseNames = ownNames(win.SuperWidget.prototype);',
    '        for (var b = 0; b < baseNames.length; b++) { skip[baseNames[b]] = true; }',
    '      }',
    '    } catch (e) {}',
    '    var methods = fnNames(ctor, skip);',
    '    var proto = null;',
    '    try { proto = ctor.prototype; } catch (e) {}',
    '    var protoNames = fnNames(proto, skip);',
    '    for (var p = 0; p < protoNames.length; p++) {',
    '      if (methods.indexOf(protoNames[p]) < 0) { methods.push(protoNames[p]); }',
    '    }',
    '    if (methods.length > 40) { methods = methods.slice(0, 40); }',
    '    var bindings = null;',
    '    try { bindings = ctor.bindings || (proto && proto.bindings) || null; } catch (e) {}',
    '    var localBindings = [];',
    '    var globalBindings = [];',
    '    if (bindings && typeof bindings === "object") {',
    '      localBindings = bindingList(bindings.local);',
    '      globalBindings = bindingList(bindings.global);',
    '    }',
    '    return { found: true, methods: methods, localBindings: localBindings, globalBindings: globalBindings, config: configList(ctor, proto) };',
    '  }',
    '  function configList(ctor, proto) {',
    '    var skip = { constructor: 1, prototype: 1, bindings: 1, length: 1, name: 1, toString: 1, valueOf: 1 };',
    '    var out = [];',
    '    var seen = {};',
    '    function take(obj) {',
    '      var keys = ownNames(obj);',
    '      for (var i = 0; i < keys.length; i++) {',
    '        var k = keys[i];',
    '        if (!k || skip[k] || seen[k] || k.charAt(0) === "_") { continue; }',
    '        var val;',
    '        try { val = obj[k]; } catch (e) { continue; }',
    '        var t = typeof val;',
    '        if (t !== "string" && t !== "number") { continue; }',
    '        if (t === "number" && !isFinite(val)) { continue; }',
    '        var text = String(val).replace(/^\\s+|\\s+$/g, "");',
    '        if (!text) { continue; }',
    '        if (text.length > 80) { text = text.slice(0, 80) + "\\u2026"; }',
    '        seen[k] = true;',
    '        out.push({ name: k, value: text });',
    '        if (out.length >= 8) { return; }',
    '      }',
    '    }',
    '    take(ctor);',
    '    if (out.length < 8) { take(proto); }',
    '    return out;',
    '  }',
    '  function slotOf(node) {',
    '    var el = node ? node.parentElement : null;',
    '    while (el) {',
    '      var id = "";',
    '      try { id = el.id || ""; } catch (e) { id = ""; }',
    '      if (/slot/i.test(id)) { return id; }',
    '      var cls = "";',
    '      try { cls = String(el.className || ""); } catch (e2) {}',
    '      var parts = cls.split(/\\s+/);',
    '      for (var i = 0; i < parts.length; i++) {',
    '        if (parts[i] && /slot/i.test(parts[i])) { return parts[i]; }',
    '      }',
    '      el = el.parentElement;',
    '    }',
    '    return "";',
    '  }',
    '  function readPage(wins) {',
    '    var keys = ["pageCode", "pageId", "pageTitle", "tenantCode"];',
    '    var page = { pageCode: "", pageId: "", pageTitle: "", tenantCode: "" };',
    '    for (var i = 0; i < wins.length; i++) {',
    '      var api = null;',
    '      try { api = wins[i].WCMAPI; } catch (e) {}',
    '      if (!api) { continue; }',
    '      for (var k = 0; k < keys.length; k++) {',
    '        if (page[keys[k]]) { continue; }',
    '        try {',
    '          var v = api[keys[k]];',
    '          if (v == null || typeof v === "object" || typeof v === "function") { continue; }',
    '          var s = String(v).replace(/^\\s+|\\s+$/g, "");',
    '          if (s) { page[keys[k]] = s.slice(0, 120); }',
    '        } catch (e2) {}',
    '      }',
    '    }',
    '    return page;',
    '  }',
    '  function hasClass(el, name) {',
    '    try { return !!(el && el.classList && el.classList.contains(name)); } catch (e) { return false; }',
    '  }',
    '  function isCustomWidget(node) {',
    '    if (hasClass(node, "widget-custom-inside")) { return true; }',
    '    try { if (node.closest && node.closest(".widget-custom-inside")) { return true; } } catch (e) {}',
    '    try { if (node.querySelector && node.querySelector(".widget-custom-inside")) { return true; } } catch (e) {}',
    '    return false;',
    '  }',
    '  var wins = collectWindows(window, [], 0);',
    '  var widgets = [];',
    '  var seen = {};',
    '  for (var i = 0; i < wins.length; i++) {',
    '    var w = wins[i];',
    '    var doc;',
    '    try { doc = w.document; } catch (e) { continue; }',
    '    var nodes;',
    '    try { nodes = doc.querySelectorAll(".wcm-widget-class, .super-widget, .widget-custom-inside"); } catch (e) { continue; }',
    '    for (var j = 0; j < nodes.length; j++) {',
    '      var node = nodes[j];',
    '      var isMarker = hasClass(node, "widget-custom-inside");',
    '      var isRoot = hasClass(node, "wcm-widget-class") || hasClass(node, "super-widget");',
    '      if (isMarker && !isRoot) {',
    '        try { if (node.querySelector(".wcm-widget-class, .super-widget")) { continue; } } catch (e) {}',
    '      }',
    '      var id = node.id || "";',
    '      var key = i + "|" + (id || ("#" + j));',
    '      if (seen[key]) { continue; }',
    '      seen[key] = true;',
    '      var className = "";',
    '      try { className = String(node.className || ""); } catch (e) {}',
    '      var classes = className.split(/\\s+/);',
    '      var cleanClasses = [];',
    '      for (var c = 0; c < classes.length; c++) { if (classes[c]) { cleanClasses.push(classes[c]); } }',
    '      var us = id.indexOf("_");',
    '      var underscoreCount = id ? (id.split("_").length - 1) : 0;',
    '      var code = us > 0 ? id.slice(0, us) : "";',
    '      var instanceId = us > 0 ? id.slice(us + 1) : "";',
    '      var dataParams = "";',
    '      try { dataParams = node.getAttribute("data-params") || ""; } catch (e) {}',
    '      var globalName = "";',
    '      var gm = String(dataParams).match(/^\\s*([A-Za-z_$][\\w$]*)\\s*\\./);',
    '      if (gm) { globalName = gm[1]; }',
    '      var warnings = [];',
    '      for (var r = 0; r < REQUIRED.length; r++) {',
    '        if (cleanClasses.indexOf(REQUIRED[r]) < 0) { warnings.push("falta a classe " + REQUIRED[r]); }',
    '      }',
    '      if (!id) { warnings.push("raiz sem id"); }',
    '      else if (underscoreCount !== 1) { warnings.push("o id da raiz deve ter exatamente um _ antes do instanceId"); }',
    '      if (instanceId && cleanClasses.indexOf(instanceId) >= 0) { warnings.push("instanceId está na class"); }',
    '      if (instanceId && node.attributes) {',
    '        for (var a = 0; a < node.attributes.length; a++) {',
    '          var attr = node.attributes[a];',
    '          var attrName = String(attr.name || "");',
    '          if (attrName.indexOf("data-") !== 0) { continue; }',
    '          var attrVal = String(attr.value || "");',
    '          if (attrVal.indexOf(instanceId) >= 0) { warnings.push("instanceId aparece em " + attrName); }',
    '        }',
    '      }',
    '      var specific = [];',
    '      for (var s = 0; s < cleanClasses.length; s++) {',
    '        if (REQUIRED.indexOf(cleanClasses[s]) < 0) { specific.push(cleanClasses[s]); }',
    '      }',
    '      var custom = isCustomWidget(node);',
    '      widgets.push({',
    '        frameIndex: i,',
    '        frame: (w === window ? "top" : "iframe"),',
    '        id: id,',
    '        code: code,',
    '        instanceId: instanceId,',
    '        specificClass: specific.join(" "),',
    '        dataParams: dataParams,',
    '        globalName: globalName,',
    '        origin: custom ? "custom" : "platform",',
    '        originDetail: custom ? "widget-custom-inside" : "",',
    '        slot: slotOf(node),',
    '        warnings: warnings,',
    '        definition: readDefinition(w, globalName)',
    '      });',
    '    }',
    '  }',
    '  return { count: widgets.length, widgets: widgets, frames: wins.length, page: readPage(wins) };',
    '})()'
  ].join('\n');
}

function buildFocusWidgetExpr(frameIndex, rootId) {
  return [
    '(function () {',
    PAGE_HELPERS,
    '  var frameIndex = ' + JSON.stringify(frameIndex) + ';',
    '  var rootId = ' + JSON.stringify(String(rootId || '')) + ';',
    '  if (!rootId) { return { ok: false, reason: "Widget sem id." }; }',
    '  var wins = collectWindows(window, [], 0);',
    '  var order = [];',
    '  if (wins[frameIndex]) { order.push(wins[frameIndex]); }',
    '  for (var i = 0; i < wins.length; i++) { if (order.indexOf(wins[i]) < 0) { order.push(wins[i]); } }',
    '  for (var n = 0; n < order.length; n++) {',
    '    var w = order[n];',
    '    var doc;',
    '    try { doc = w.document; } catch (e) { continue; }',
    '    var node = null;',
    '    try { node = doc.getElementById(rootId); } catch (e) {}',
    '    if (!node) { continue; }',
    '    var jq = null;',
    '    try { jq = w.jQuery || w.$ || null; } catch (e) {}',
    '    uncollapseAncestors(node, jq, w);',
    '    var visible = isNodeVisible(node, w);',
    '    if (!visible) { return { ok: false, visible: false, reason: "Widget oculto no layout." }; }',
    '    try {',
    '      function doScroll() {',
    '        try {',
    '          node.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });',
    '          if (w !== window && w.frameElement) {',
    '            w.frameElement.scrollIntoView({ behavior: "smooth", block: "nearest" });',
    '          }',
    '        } catch (e) {}',
    '      }',
    '      doScroll();',
    '      setTimeout(doScroll, 80);',
    '      var prevOutline = node.style.outline;',
    '      var prevBoxShadow = node.style.boxShadow;',
    '      node.style.outline = "3px solid #016a71";',
    '      node.style.boxShadow = "0 0 12px rgba(1, 106, 113, 0.6)";',
    '      setTimeout(function () {',
    '        try { node.style.outline = prevOutline; node.style.boxShadow = prevBoxShadow; } catch (e) {}',
    '      }, 2200);',
    '      return { ok: true, visible: true };',
    '    } catch (e) {',
    '      return { ok: false, reason: "Erro ao rolar: " + String(e) };',
    '    }',
    '  }',
    '  return { ok: false, reason: "Raiz não encontrada no DOM." };',
    '})()'
  ].join('\n');
}

function widgetBindingHtml(title, pairs) {
  if (!pairs || !pairs.length) { return ''; }
  var html = '<div class="row"><span class="k">' + esc(title) + '</span><span>';
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i];
    var handlers = (pair.handlers || []).join(', ');
    html += '<span class="tag">' + esc(pair.event) + (handlers ? ' → ' + esc(handlers) : '') + '</span> ';
  }
  html += '</span></div>';
  return html;
}

function renderWidgetPage() {
  var el = document.getElementById('widget-page');
  if (!el || typeof ctxRow !== 'function' || typeof ctxGroup !== 'function') { return; }
  var page = (widgetScan && widgetScan.page) || {};
  var rows = ctxRow('Código', page.pageCode) +
    ctxRow('Id', page.pageId) +
    ctxRow('Título', page.pageTitle) +
    ctxRow('Empresa', page.tenantCode);
  el.innerHTML = rows ? '<div class="ctx-board">' + ctxGroup('Página', rows) + '</div>' : '';
}

function renderWidgetList() {
  renderWidgetPage();
  var box = document.getElementById('widget-list');
  if (!box) { return; }
  var widgets = (widgetScan && widgetScan.widgets) || [];
  var q = ((document.getElementById('widget-filter') || {}).value || '').trim().toLowerCase();
  var onlyCustomEl = document.getElementById('widget-opt-custom');
  var onlyCustom = !!(onlyCustomEl && onlyCustomEl.checked);
  if (!widgets.length) {
    box.innerHTML = '<span class="muted">Nenhum SuperWidget nesta página. A aba Processo cobre o formulário da solicitação; widget é o componente do portal.</span>';
    return;
  }
  var html = '';
  var shown = 0;
  for (var i = 0; i < widgets.length; i++) {
    var w = widgets[i];
    var defPreview = w.definition || {};
    var configHay = '';
    var configs = defPreview.config || [];
    for (var c = 0; c < configs.length; c++) {
      configHay += ' ' + (configs[c].name || '') + ' ' + (configs[c].value || '');
    }
    var hay = (w.code + ' ' + w.instanceId + ' ' + w.id + ' ' + w.globalName + ' ' + w.specificClass + ' ' + (w.slot || '') + configHay).toLowerCase();
    if (q && hay.indexOf(q) < 0) { continue; }
    if (onlyCustom && w.origin !== 'custom') { continue; }
    shown++;
    var title = w.code || w.id || '(sem id)';
    var idEsc = esc(w.id).replace(/"/g, '&quot;');
    var instEsc = esc(w.instanceId).replace(/"/g, '&quot;');
    var originTag = '<span class="tag">origem não identificada</span>';
    if (w.origin === 'custom') { originTag = '<span class="tag custom">Customizado</span>'; }
    else if (w.origin === 'platform') { originTag = '<span class="tag">Plataforma</span>'; }
    html += '<div class="match">';
    html += '<div class="row"><span class="k">widget</span><code>' + esc(title) + '</code> ' + originTag;
    if (w.instanceId) { html += ' <span class="tag">' + esc(w.instanceId) + '</span>'; }
    html += ' <span class="tag">' + esc(w.frame) + '</span>';
    if (w.specificClass) { html += ' <span class="tag">' + esc(w.specificClass) + '</span>'; }
    if (w.warnings && w.warnings.length) { html += ' <span class="tag danger">' + w.warnings.length + ' aviso(s)</span>'; }
    html += '</div>';
    if (w.id) {
      html += '<div class="row"><span class="k">id</span><code>' + esc(w.id) + '</code> ' +
        '<button type="button" class="btn-icon" data-copy="' + idEsc + '" title="Copiar id">' + COPY_SVG + '</button></div>';
    }
    if (w.instanceId) {
      html += '<div class="row"><span class="k">instanceId</span><code>' + esc(w.instanceId) + '</code> ' +
        '<button type="button" class="btn-icon" data-copy="' + instEsc + '" title="Copiar instanceId">' + COPY_SVG + '</button></div>';
    }
    if (w.slot) {
      var slotEsc = esc(w.slot).replace(/"/g, '&quot;');
      html += '<div class="row"><span class="k">slot</span><code>' + esc(w.slot) + '</code> ' +
        '<button type="button" class="btn-icon" data-copy="' + slotEsc + '" title="Copiar slot">' + COPY_SVG + '</button></div>';
    }
    if (w.dataParams) {
      html += '<div class="row"><span class="k">data-params</span><code>' + esc(w.dataParams) + '</code></div>';
    }
    if (w.originDetail) {
      html += '<div class="row"><span class="k">marca</span><code>' + esc(w.originDetail) + '</code></div>';
    }
    var def = w.definition || {};
    if (w.globalName) {
      html += '<div class="row"><span class="k">global</span><code>' + esc(w.globalName) + '</code> ' +
        (def.found ? '<span class="ok">definição encontrada</span>' : '<span class="err">global ausente neste frame</span>') +
        '</div>';
    }
    var config = def.config || [];
    for (var g = 0; g < config.length; g++) {
      var item = config[g];
      if (!item || !item.name) { continue; }
      var valueEsc = esc(item.value || '').replace(/"/g, '&quot;');
      html += '<div class="row"><span class="k">' + esc(item.name) + '</span><code>' + esc(item.value || '') + '</code> ' +
        '<button type="button" class="btn-icon" data-copy="' + valueEsc + '" title="Copiar ' + esc(item.name) + '">' + COPY_SVG + '</button></div>';
    }
    html += widgetBindingHtml('local', def.localBindings);
    html += widgetBindingHtml('global', def.globalBindings);
    if (def.methods && def.methods.length) {
      html += '<div class="row"><span class="k">métodos</span><span class="muted">' + esc(def.methods.join(', ')) + '</span></div>';
    }
    if (w.warnings && w.warnings.length) {
      for (var n = 0; n < w.warnings.length; n++) {
        html += '<div class="row"><span class="k">aviso</span><span class="err">' + esc(w.warnings[n]) + '</span></div>';
      }
    }
    html += '<div class="field-row">';
    if (w.id) {
      html += '<button type="button" class="btn-icon-text" data-widget-focus="' + i + '" title="Rolar e destacar a raiz do widget">' +
        TARGET_SVG + '<span>Localizar</span></button>';
    }
    html += '</div></div>';
  }
  if (!shown) {
    box.innerHTML = '<span class="muted">Nenhum widget combina com o filtro.</span>';
    return;
  }
  box.innerHTML = html;
}

function loadWidgets() {
  widgetSetStatus('<span class="muted">Lendo widgets…</span>');
  evalInPage(buildWidgetScanExpr())
    .then(function (result) {
      widgetScan = result || { widgets: [] };
      var n = (widgetScan.widgets || []).length;
      var custom = 0;
      var warn = 0;
      for (var i = 0; i < n; i++) {
        if (widgetScan.widgets[i].origin === 'custom') { custom++; }
        if (widgetScan.widgets[i].warnings && widgetScan.widgets[i].warnings.length) { warn++; }
      }
      widgetSetStatus('<span class="ok">' + n + ' instância(s), ' + custom + ' customizada(s)' + (warn ? ', ' + warn + ' com aviso' : '') + '</span>');
      renderWidgetList();
    })
    .catch(function (err) {
      widgetSetStatus('<span class="err">Erro ao ler widgets: ' + esc(formatErr(err)) + '</span>');
    });
}

function focusWidget(index, btn) {
  var w = widgetScan && widgetScan.widgets && widgetScan.widgets[index];
  if (!w || !w.id) { return; }
  var prev = btn ? btn.innerHTML : '';
  if (btn) { btn.innerHTML = '<span>Localizando…</span>'; }
  evalInPage(buildFocusWidgetExpr(w.frameIndex, w.id))
    .then(function (res) {
      if (btn) { btn.innerHTML = prev; }
      if (!res || !res.ok) {
        widgetSetStatus('<span class="err">' + esc((res && res.reason) || 'Não foi possível localizar.') + '</span>');
      }
    })
    .catch(function (err) {
      if (btn) { btn.innerHTML = prev; }
      widgetSetStatus('<span class="err">Erro ao localizar: ' + esc(formatErr(err)) + '</span>');
    });
}

(function initWidgetInspect() {
  var tabBtn = document.getElementById('tab-btn-widget');
  if (tabBtn) {
    tabBtn.addEventListener('click', function () {
      switchTab('widget');
      if (!widgetScan) { loadWidgets(); }
    });
  }
  var reloadBtn = document.getElementById('btn-widget-reload');
  if (reloadBtn) { reloadBtn.addEventListener('click', loadWidgets); }
  var filterEl = document.getElementById('widget-filter');
  if (filterEl) { filterEl.addEventListener('input', renderWidgetList); }
  var customEl = document.getElementById('widget-opt-custom');
  if (customEl) { customEl.addEventListener('change', renderWidgetList); }
  var list = document.getElementById('widget-list');
  if (list) {
    list.addEventListener('click', function (e) {
      if (!e.target.closest) { return; }
      var btn = e.target.closest('[data-widget-focus]');
      if (!btn) { return; }
      focusWidget(Number(btn.getAttribute('data-widget-focus')), btn);
    });
  }
})();
