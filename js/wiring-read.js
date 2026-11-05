// js/wiring-read.js — Wiring: eventos de leitura/historico
// Script classico (escopo global compartilhado); ordem de carga definida em panel.html.

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

// Autocomplete ANTES dos handlers de Enter: listener na mesma tecla e no mesmo
// elemento dispara na ordem de registro, e o dropdown precisa poder consumir o
// Enter (escolher a sugestao) sem que o Ler/Setar rode junto.
attachAutocomplete('read-field', 'read-field-ac');

var tabBtnProcesso = document.getElementById('tab-btn-processo');
if (tabBtnProcesso) { tabBtnProcesso.addEventListener('click', function () { switchTab('processo'); }); }

var tabBtnFormulario = document.getElementById('tab-btn-formulario');
if (tabBtnFormulario) {
  tabBtnFormulario.addEventListener('click', function () {
    switchTab('formulario');
    var rf = document.getElementById('read-field');
    if (rf) { rf.focus(); }
  });
}

var tabBtnRede = document.getElementById('tab-btn-rede');
if (tabBtnRede) { tabBtnRede.addEventListener('click', function () { switchTab('rede'); }); }

var tabBtnDump = document.getElementById('tab-btn-dump');
if (tabBtnDump) { tabBtnDump.addEventListener('click', function () { switchTab('dump'); }); }

document.getElementById('btn-read').addEventListener('click', readField);
document.getElementById('read-field').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { readField(); }
});

// Delegacao em read-output para aplicar o valor no DOM nos cards de busca
document.getElementById('read-output').addEventListener('click', function (e) {
  if (!e.target.closest) { return; }

  // Setar DOM no card de busca
  var matchApplyDom = e.target.closest('[data-match-apply-dom]');
  if (matchApplyDom) {
    var rawName = matchApplyDom.getAttribute('data-match-apply-dom');
    var cardId = matchApplyDom.getAttribute('data-card-id');
    var ta = document.getElementById('match-val-' + cardId);
    var statusEl = document.getElementById('match-status-' + cardId);
    var newVal = ta ? ta.value : '';

    if (statusEl) { statusEl.innerHTML = '<span class="muted">Aplicando no DOM…</span>'; }

    evalInPage(buildSetExpr(rawName, newVal))
      .then(function (res) {
        if (!res || res.setCount === 0) {
          if (statusEl) { statusEl.innerHTML = '<span class="err">Elemento ' + esc(rawName) + ' não encontrado no DOM.</span>'; }
          return;
        }
        var readBackVal = res.readBack != null ? res.readBack : newVal;
        recordSet(rawName, '', readBackVal, { name: rawName });
        if (statusEl) { statusEl.innerHTML = '<span class="ok">✓ Valor aplicado no DOM (' + esc(res.setCount) + ' elemento(s))!</span>'; }
      })
      .catch(function (err) {
        if (statusEl) { statusEl.innerHTML = '<span class="err">Erro: ' + esc(formatErr(err)) + '</span>'; }
      });
    return;
  }
});
