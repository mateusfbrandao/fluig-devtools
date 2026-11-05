# Fluig devtools

Painel do Chrome DevTools (F12) para depurar páginas da plataforma TOTVS Fluig. Versão **1.0.0**.

A extensão evita o trabalho manual de atravessar iframes, decifrar nomes dinâmicos de campos e colar scripts no console. O painel só aparece quando a página tem os objetos globais `WCMAPI` ou `FLUIGC`. Fora do Fluig, ela fica inerte.

Tudo roda na aba inspecionada. A extensão não pede permissão de rede, armazenamento nem `<all_urls>`, e não envia dados para servidores externos.

## Abas

| Aba | O que faz |
| --- | --- |
| **Processo** | Número, código, descrição e versão do processo, situação, solicitante, início e fim, formulário, atividade atual, responsáveis e destinos seguintes. Sem solicitação, indica a aba Formulário. |
| **Formulário** | Lista campos simples e tabelas pai-filho. Lê, localiza e altera o valor no DOM. No topo, mostra nome, versão, id do formulário, id da ficha e empresa quando a página tem ficha. |
| **Widget** | Instâncias SuperWidget da página: código, instanceId, slot, classes, bindings, métodos e configurações em texto. Não chama `init` nem handlers. |
| **Consultar Dataset** | Consulta somente leitura com `DatasetFactory.getDataset` (nome, colunas, ordenação e filtros), na sessão de quem está logado. |
| **Rede Fluig** | Chamadas de dataset e REST capturadas com o DevTools aberto. Filtra por tipo, oculta ruído interno do portal e permite inspecionar cada chamada. |
| **Dump JSON** | Exporta campos, tabelas, logs do console, contexto da solicitação e chamadas de rede, para colar numa IA. Dados sensíveis podem ser mascarados. |

Processo, Formulário e Widget releem a página quando a URL, o `src` de um iframe, os widgets ou os nomes dos campos mudam, sem fechar o DevTools.

## O que a alteração de campo faz

Alterar um campo aplica o valor no DOM da página (`jQuery.val` ou o equivalente nativo) e relê o resultado. Isso não grava no Fluig e não depende de dataset customizado.

O localizador abre painéis fechados (`.collapse`, `.tab-pane`, `<details>`), rola até o campo e aplica um destaque temporário.

Nomes de campo são resolvidos nas formas que o Fluig usa:

- nome ou id simples (`codigo`)
- campo desabilitado com prefixo `_` (`_codigo`)
- linha de tabela pai-filho com sufixo `___N` (`item___1`)
- modo visualização, em que o valor fica no texto de um `<span>`

## Requisitos

- Google Chrome 88 ou superior (Manifest V3)
- Uma página Fluig aberta e autenticada na sessão do usuário

## Instalação

1. Abra `chrome://extensions`.
2. Ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta deste repositório (a que contém `manifest.json`).
5. Abra uma página Fluig, pressione F12 e escolha o painel **Fluig devtools**.

Se o painel não aparecer, a página ainda não expôs `WCMAPI` ou `FLUIGC`. Recarregue a página com o DevTools aberto.

Depois de atualizar os arquivos, clique em **Recarregar** no cartão da extensão em `chrome://extensions`.

## Limitações

- A aba **Rede Fluig** e as chamadas incluídas no dump só veem requisições feitas com o DevTools aberto.
- A consulta de dataset usa a sessão de quem está logado e é somente leitura.
- Valores alterados no formulário existem só na página atual. Um recarregamento descarta a alteração.

## Estrutura

```text
manifest.json          Manifest V3 e página do DevTools
devtools.html          Página oculta que carrega devtools.js
devtools.js            Detecta o Fluig e cria o painel
panel.html             Interface do painel
css/panel.css          Tema escuro do painel
js/                    Leitura da página, abas e comunicação via eval
icons/                 Ícones da extensão
```

A comunicação com a página usa `chrome.devtools.inspectedWindow.eval`. A busca no DOM percorre o documento principal e os iframes de mesma origem, inclusive o `pageworkflowview`.

## Licença

Fluig devtools é software livre sob a [GNU General Public License v3.0](LICENSE) (GPL-3.0). Você pode usar, estudar, modificar e redistribuir o programa, e as versões modificadas precisam permanecer sob a mesma licença. O texto completo está em `LICENSE`.
