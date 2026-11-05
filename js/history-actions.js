// js/history-actions.js — Registro e acoes das entradas do historico
// Script classico (escopo global compartilhado); ordem de carga definida em panel.html.

// ---------------------------------------------------------------------------
// Historico — registro de cada acao
// ---------------------------------------------------------------------------

// Uma leitura. `matches` vazio = nao encontrado (fica no historico tambem: saber
// que o campo NAO existia naquele momento e informacao de debug).
function recordRead(typed, matches) {
  var rows;
  if (!matches.length) {
    rows = [{ k: 'resultado', v: '<span class="err">não encontrado</span>' }];
  } else {
    rows = matches.map(function (m) {
      return { k: m.name === typed ? 'valor' : m.name, v: '<code>' + renderValue(m.value) + '</code>' };
    });
  }

  pushHistory('read', {
    label: typed,
    tags: matches.length === 1 ? matchTags(matches[0]) : '',
    rows: rows,
    typed: typed,
    // Assinatura para colapsar leituras repetidas identicas em "N×".
    signature: matches.map(function (m) { return m.name + '=' + m.value; }).join('|'),
    canRestore: false
  });
}

// Uma alteracao no DOM. `newValue` e o read-back (o que de fato ficou no campo),
// nao o que foi pedido.
function recordSet(rawName, oldValue, newValue, target) {
  pushHistory('set', {
    label: rawName,
    tags: target ? matchTags(target) : '',
    rows: [
      { k: 'anterior', v: '<code>' + renderValue(oldValue) + '</code>' },
      { k: 'novo', v: '<code>' + renderValue(newValue) + '</code>' }
    ],
    fieldName: rawName,
    oldValue: oldValue,
    canRestore: true
  });
}

// ---------------------------------------------------------------------------
// Historico — acoes das entradas
// ---------------------------------------------------------------------------

// Restaurar: preenche os inputs da secao com o valor ANTERIOR e ja dispara o
// passo de resolucao, caindo direto na confirmacao. Um clique para chegar la,
// mas a alteracao em si continua passando pela confirmacao obrigatoria.
function restoreFromHistory(kind, id) {
  var e = findHistoryEntry(kind, id);
  if (!e || !e.canRestore) { return; }
  var rf = document.getElementById('read-field');
  if (rf && e.fieldName) {
    rf.value = e.fieldName;
    readField();
  }
}

// Reler: leitura nao altera nada, entao roda direto.
function rereadFromHistory(id) {
  var e = findHistoryEntry('read', id);
  if (!e) { return; }
  document.getElementById('read-field').value = e.typed;
  readField();
}
