# Documentação de Desenvolvimento: Fluig devtools v2.0 (Cursor AI)

Esta documentação serve como contexto principal para o agente de IA (Cursor) desenvolver a extensão **Fluig devtools v2.0**. Ela define o escopo do produto, a arquitetura, regras de negócio e estrutura da interface.

## 1. Escopo e Visão Geral do Produto
O **Fluig devtools** é uma extensão para Chrome DevTools (F12) criada para inspecionar e manipular formulários Fluig, servindo como uma ferramenta interna de debug. Ela é ativada automaticamente em páginas da plataforma TOTVS Fluig.

Seu objetivo é eliminar o trabalho manual de inspecionar frames, decifrar nomes dinâmicos no DOM e colar scripts jQuery repetitivos no console durante a depuração de formulários e processos de workflow.

### ✨ Novidades da Versão 2.0
*   **Interface Moderna em Abas:** Organização limpa entre Ler campo, Alterar e Dump.
*   **Browser de Campos & Tabelas Pai-Filho no Topo:** Acordeões colapsáveis com contagem de linhas/campos, sem limite de corte e alternância entre visão de Linhas (`___N`) e Colunas (resumo).
*   **Localizador no Formulário com Auto-Uncollapse:** Encontra o campo na tela, abre automaticamente painéis/sanfonas colapsados (`.collapse`, `.tab-pane`, `<details>`) e rola a tela com destaque visual.
*   **Dump JSON para IAs:** Exporta o estado completo do formulário com logs capturados com 1 clique para colar no ChatGPT, Gemini ou Claude.
*   **Botões de Cópia Rápida:** Cópia de nomes, valores e JSONs com feedback visual imediato.

### 🛡️ Privacidade e Segurança
*   **Zero Permissões Requisitadas:** Não exige permissões de rede, armazenamento persistente nem `<all_urls>`.
*   **100% Local:** Todo o processamento ocorre exclusivamente dentro da aba inspecionada. Nenhum dado é enviado para servidores externos.
*   **Inerte fora do Fluig:** A aba do DevTools só é instanciada ao detectar os objetos globais `WCMAPI` ou `FLUIGC`.

## 2. Estrutura de Arquivos Exigida
O projeto utiliza **Manifest V3**.

```text
fluig-debug/
├── manifest.json         # Configuração V3 e definição da devtools_page
├── devtools.html         # Página oculta que carrega o devtools.js
├── devtools.js           # Lógica de detecção do Fluig e criação do painel
├── panel.html            # Interface visual do painel (UI)
├── panel.css             # Estilização baseada no tema escuro do DevTools
├── panel.js              # Controladores da UI e comunicação via eval()
└── content-script.js     # Script (se necessário) ou funções enviadas via eval()
```

## 3. Especificações de Interface (UI/UX)
O layout deve seguir estritamente o tema escuro padrão do DevTools e a estrutura visual aprovada.
*   **Aba Processo:** Dados da solicitação: número, código, descrição e versão do processo, situação, solicitante, início e fim, `documentId`, formulário, atividade atual e responsáveis das tarefas abertas (`processTask`), destinos seguintes com a regra de atribuição (`processLink` / `processState`), movimento e empresa. Sem solicitação, aponta para a aba Formulário.
*   **Aba Formulário:** Campos da página, no processo ou numa widget: ler, localizar e alterar no DOM. Não grava no Fluig. No topo, nome, versão, id do formulário, id da ficha e empresa quando a página tem ficha. Sem ficha, a widget que contém os campos.
*   **Aba Widget:** Lista as instâncias SuperWidget da página (código, instanceId, slot, classes da raiz, bindings, métodos e configurações em texto da definição, como datasets). No topo, código, id, título e empresa da página (`WCMAPI`). Não chama init nem handlers. Não depende de solicitação. Não lista os campos do formulário.
*   **Navegação:** **Processo**, **Formulário**, **Widget**, **Consultar Dataset**, **Rede Fluig** e **Dump JSON**.
*   **Atualização automática:** Processo, Formulário e Widget releem a página quando a URL, o `src` de um iframe, os widgets ou os nomes dos campos mudam — inclusive troca de página do portal e carga do `pageworkflowview`, sem fechar o DevTools.
*   **Aba Formulário (campos):**
    *   Input com **Autocomplete**: Sugestões instantâneas ao digitar, badges de status, prévia do valor atual e atalho `___` para navegar por linhas.
    *   Botões de ação primária: **Ler** e **Histórico** (Histórico por sessão com botão *Restaurar* para rollback).
*   **Listagem de Elementos (Acordeões):**
    *   **TABELAS PAI-FILHO:** Lista colapsável mostrando o nome das tabelas acompanhado da contagem total de linhas e campos.
    *   **CAMPOS SIMPLES:** Lista de campos nativos mapeados, exibindo o ID, valor e um badge (selo) com o tipo de dado.

## 4. Regras de Negócio e Desafios Técnicos do Fluig
O agente deve programar lógicas robustas para contornar as particularidades do Fluig:

### A. Varredura de iFrames
O formulário roda dentro de um iframe (`pageworkflowview`), exigindo trocar o contexto. Qualquer instrução de busca no DOM deve obrigatoriamente possuir uma lógica recursiva que atravesse o `document` principal e todos os `iframe.contentDocument` filhos.

### B. Resolução Dinâmica de Nomes de Campos
O identificador de um campo muda constantemente. A extensão deve varrer essas variações ao receber o "nome limpo":
1.  **Padrão:** `name="codigo"` ou `id="codigo"`.
2.  **Desabilitado:** Ganha prefixo `_` (ex: `codigo` vira `_codigo`).
3.  **Tabela Pai-Filho:** Ganha sufixo `___N` (ex: `item___1`, `item___2`).
4.  **Modo Visualização / Finalizado:** Vira tag `<span>` mantendo o nome mas com o valor no texto (`innerText`).

### C. Funcionalidade: Auto-Uncollapse e Destaque
Ao clicar em "Localizar no formulário", o script deve:
1.  Fazer um `Element.closest()` para encontrar se o campo está dentro de um container fechado (`.collapse`, `.tab-pane`, `<details>`).
2.  Remover as classes de ocultação e adicionar classes de exibição (`.in`, `.show`, `.active`).
3.  Executar `scrollIntoView({ behavior: 'smooth', block: 'center' })`.
4.  Aplicar um halo pulsante (ex: `box-shadow` vermelho) temporário de 2 segundos.

### D. Funcionalidades das Abas "Alterar" e "Dump"
*   **Alteração no DOM:** Aplica `$(campo).val(novoValor)` com releitura do valor. A extensão não grava no banco e não depende de dataset customizado (`dsSetCardValue` ou outro).
*   **Consultar Dataset:** A aba consulta datasets com `DatasetFactory.getDataset` (nome, colunas, ordenação e constraints). A chamada é somente leitura, na sessão do usuário logado.
*   **Dump JSON Estruturado:** Varrer todos os inputs e montar um objeto JSON estruturado contendo variáveis simples, tabelas pai-filho e erros/mensagens de console.

## 5. Instruções de Implementação para o Cursor
1.  Inicie pelo `manifest.json` com `manifest_version: 3`. Garanta que a aba seja inerte fora do Fluig.
2.  Crie a comunicação segura utilizando `chrome.devtools.inspectedWindow.eval`. Todo o processamento extração/injeção no DOM deve ser feito através deste método de avaliação no contexto da página.
3.  Estruture o HTML/CSS garantindo a ausência de bibliotecas externas pesadas. Mantenha 100% focado em Vanilla JS para a extensão ser rápida e leve.