# Consulta em profundidade · QA

Verificação final de 10/10/2026, na branch `feature/consulta-profundidade`, com as correções da revisão ainda **sem commit** (sobre `b722f45`). O checklist segue a Parte H da spec, adaptada por `DECISOES.md`. `[x]` quer dizer que o item foi conferido nesta verificação, com a evidência ao lado. `[ ]` quer dizer que o item falhou ou ficou pendente, com o motivo. "Não se aplica" diz qual decisão tirou o item.

## Comandos rodados nesta verificação

| Comando | Resultado |
|---|---|
| `npx vitest run` | 92 arquivos, 1.291 testes, todos passando (44,7 s). A suíte imprime uma vez o aviso do jsdom "Not implemented: navigation to another Document". Ele não vem da consulta: rodando só `src/paginas/score/consulta`, `Score.test.tsx`, `BuscaDoRadar.test.tsx` e `DossieDaLente.test.tsx` (353 testes), o aviso não aparece. |
| `npx tsc -b --force` | sem erros (exit 0) |
| `npm run typecheck:e2e` | sem erros (exit 0) |
| `npm run lint` | 24 avisos, nenhum erro. Nenhum aviso é novo: os três que caem em arquivos tocados (`DossieDaLente.tsx:145`, `DossieDaLente.tsx:165` e `Score.tsx:684`, todos `set-state-in-effect`) vêm, pelo `git blame`, de commits de 24/09 a 02/10, anteriores à consulta. `e2e/` não tem aviso. |
| `npm run build` | sem erro (`tsc -b && vite build`, 561 módulos). O Vite avisa que um chunk passa de 500 kB (`index-*.js`, 936 kB, 268 kB com gzip). O aviso já existia: o código-fonte inteiro da consulta, com o JSON e os comentários, soma 264 kB antes de minificar, e o bundle passaria de 500 kB mesmo sem ele. |
| `npx playwright test` | 14 testes, todos passando (49,5 s), Edge, Vite próprio na 5179, API simulada. Depois de uma correção na captura 07 (ver "Correção desta verificação"), o teste "passos 1 a 12" foi rodado de novo e passou. |
| Captura avulsa (spec temporária, já apagada) | `/score/geral` (Jornada do índice, Radar Reputacional, Comparação de períodos) e `/score/lentes` com a Síntese executiva aberta: telas montadas, sem `console.error`, sem `pageerror` e sem chamada fora das fixtures. |

## Checklist de aceite (Parte H, adaptada)

- [x] **Fase 0 aprovada e decisões registradas em DECISOES.md.** O arquivo registra D1 a D4 (Guilherme, 09/10/2026), A1 a A20 (regra A.7) e as pendências P1 a P4, que ficaram sem mudança no código.
- [x] **Testes de invariantes (C.4), `resolverCaminho` (D.2), `faixaDe` (E.1), formatação (E.2), ordenação (F.9) e busca (E.9) passando.** `dados/invariantes.test.ts` (17 casos), `dados/seletores.test.ts` (66, com `resolverCaminho (D.2 adaptada)`, `ordenarItens (F.9)` e `buscarNoDrill (E.9)`), `formatacao.test.ts` (20, com `faixaDe (E.1)` nos limites 39/40/54/55/69/70/84/85) e `endereco.test.ts` (13). Todos estão na suíte verde.
- [x] **Roteiro G completo passando, com capturas.** Foi adaptado pelas decisões (tabela abaixo). O passo 14 não se aplica (D2). As capturas estão em `qa/`.
- [x] **Zero erro de console, zero aviso de chave (`key`) do React.** Os 14 testes e2e reprovam com qualquer `console.error`, `pageerror` ou aviso do React, e também com chamada sem resposta gravada. A conferência roda antes de cada captura e de novo na desmontagem. Todos passaram.
- [x] **Nenhum texto de tela diferente do JSON ou da spec.** Conferi no JSON (ou na spec) os 15 títulos e textos que aparecem nas capturas: títulos das tabelas e dos cartões dos Níveis 1 a 4 da Imprensa, o Nível 4 de Fiscalização regulatória, os cartões do Mercado, "Rompimento de adutora na Zona Norte do Rio" e "Governança saiu de…". Os testes e2e conferem esses títulos pelo texto literal. A descrição "Do pilar ao tema e ao subtema, descendo até a menção." não está no JSON, mas já existia no bloco "Drill down" antes da consulta (está em `289d0e7`). Dos 8 cenários de referência, o da Sociedade digital, o dos Clientes e o do Institucional não se aplicam (D2).
- [x] **Nenhum travessão nem emoji em texto de tela; o sinal de menos é `−`.** A busca por `—` nos `.tsx` da consulta (fora de comentário) e no JSON não achou nada. A busca de emoji em `src/paginas/score` também não. Nas capturas, todo negativo aparece com `−` (U+2212), e os testes conferem `−11,1 pt`, `−7,4 pt`, `−3,1 pt` e `−0,06 pt`. O travessão do subtítulo do Radar Reputacional e de "CRM — termômetro…" fica na Visão geral, que já existia e está fora da consulta.
- [x] **Nenhum link para `#` nem URL inventada.** Os `href` da consulta são endereços reais do drill (`#consulta&lente=…&pilar=…`, que o Ctrl+clique abre noutra aba) e a `url` do JSON. Na demonstração a `url` é nula e a tela mostra "O link para a fonte original entra com a integração do clipping." (captura 07).
- [x] **Selo "Dados ilustrativos" visível em todos os níveis.** O selo aparece ao lado do indicador nas capturas 01, 03, 04, 05 e 13, e também na linha "Agosto de 2026 · corte em 31/08/2026" (A11) e no grupo da busca (10).
- [x] **Barras de uma mesma tabela com a mesma escala.** Na captura 01, a barra de Eficiência (−7,4) tem mais que o dobro da de Governança (−3,1), e Responsabilidade Ambiental (−0,6) fica com um traço curto. A escala única é testada em `escalaDeImpacto`.
- [ ] **Rótulos do gráfico de linha sem sobreposição nas 5 lentes.** Não se aplica. O gráfico F.1 era do cartão da nota, que saiu pela D1, e a consulta não desenha gráfico de linha. A "Jornada" acima do drill é a tela real que já existia. Nas capturas 14 e 15a, o rótulo do primeiro ponto (46 na Sociedade, 53 nos Clientes) encosta na linha tracejada do vale. Isso é da Jornada e não foi mexido.
- [x] **Contraste: nenhum texto em `#17E3CB` nem em `#FF5C60` sobre branco.** As constantes `COR_POSITIVO_GRAFICO` e `COR_NEGATIVO_GRAFICO` (tokens `--turquesa-rio` e `--vermelho-pitanga`) só pintam barras, `rect` e bolinhas (`background`/`fill`). Nenhum `color:` as usa. O texto de sinal usa `var(--erro-fg)` e `var(--ok-fg)`.
- [x] **Rolagem horizontal ausente nas 4 resoluções.** Antes de cada captura, `semRolagemHorizontal` confere `scrollWidth <= clientWidth` e também que nenhum elemento com `overflow-x` dentro de `[data-consulta-profundidade]` role por dentro. Ela roda em 1440×900 e nos passos 1, 3, 5 e 13 em 1280×720, 1366×768 e 1920×1080, com as barras de rolagem visíveis (`--hide-scrollbars` desligado). Abri as 34 capturas e nenhuma mostra corte nem transbordo.
- [x] **Páginas existentes do módulo continuam funcionando.** A Visão geral (Jornada do índice, Radar Reputacional e Comparação de períodos) e a Síntese executiva das Lentes montam sem erro (captura avulsa). O teste A6 parte da Visão geral e usa a busca do cabeçalho. Os testes de componente dessas telas (`ComparacaoDeRadares`, `PainelDaJornada`, `RecorteDaLente`, `BarraDeFiltroDaLente`, `OndeEstaACausa`…) estão na suíte verde. A barra de filtros do CRM preserva o hash (teste jsdom de `definirRecorte`).
- [x] **Build de produção sem erro.** `npm run build` terminou com exit 0. O aviso de tamanho de chunk já existia (ver acima).

## Roteiro G adaptado

Teste: `e2e/consulta-profundidade.spec.ts`. As capturas ficam em `docs/consulta-profundidade/qa/`. Todos os passos passaram nesta verificação.

| # | Passo (adaptado) | Verificação automática | Resultado | Captura |
|---|---|---|---|---|
| 0 | Fumaça: `/score/lentes`, abrir "Drill down" | aba Imprensa ativa; `aria-expanded` passa de false a true | passou | `00-fumaca` |
| 1 | Abrir a aba Lentes e expandir o bloco (sem cartão da nota, D1) | "Nível 1 de 4"; título da tabela do JSON; "O que pressiona" `−11,1 pt` e "O que sustenta" `+3,1 pt`; selo visível; nenhum "42" solto no drill e nenhum "= nota"; abrir o bloco não escreve hash | passou | `01-nivel1-imprensa` (+ 1280, 1366, 1920) |
| 2 | Cartões laterais | sem "48" nem "42" no "O que mudou desde julho" (D1); "Rompimento de adutora na Zona Norte do Rio" visível | passou | `02-cartoes-laterais` (igual à 01, porque o passo só confere) |
| 3 | Clicar na linha "Eficiência Operacional e Qualidade" | hash com `pilar=eficiencia-operacional`; trilha com 2 itens; "Nível 2 de 4"; h2 com foco; "Abastecimento de água" com "Em destaque" (A10); rodapé `−7,4 pt` | passou | `03-nivel2-eficiencia` (+ 3 resoluções) |
| 4 | Clicar na linha "Abastecimento de água" | `tema=abastecimento-agua`; "Nível 3 de 4"; título "Rompimento de adutora responde por dois terços da perda do tema"; botão "Ver as 96 matérias" | passou | `04-nivel3-abastecimento` |
| 5 | "Ver as 96 matérias" | `subtema=rompimento-adutora`; "Nível 4 de 4"; h2 com foco; 11 linhas; a primeira é "Rompimento de adutora deixa 14 bairros…" | passou | `05-nivel4-rompimento` (+ 3 resoluções) |
| 6 | "Negativas 71" e depois "Data" | `sent=negativas` e `ordem=data` no hash; 9 linhas; a primeira é 19/08, Zero Hora | passou | `06-negativas-por-data` |
| 7 | "Abrir matéria ↗" da primeira linha, depois `Esc` | diálogo nomeado pelo título; texto do link do clipping; fecha; o foco volta ao botão | passou | `07-previa-da-materia` |
| 8 | "Imprensa" na trilha | Nível 1 completo; hash `#consulta&lente=imprensa` | passou | `08-trilha-volta-ao-nivel1` |
| 9 | Voltar do navegador | Nível 4 com "Negativas 71" e "Data" pressionados; 9 linhas; Zero Hora primeiro | passou | `09-voltar-do-navegador` |
| 10 | "adutora" na busca do cabeçalho (D3) | grupo "Consulta em profundidade · Subtema" com "Rompimento de adutora" e `−3,1 pt` | passou | `10-busca-adutora` |
| 11 | `Enter` | bloco aberto; Nível 4 de Rompimento de adutora; h2 com foco, na janela e abaixo do cabeçalho (A5/A6); hash canônico; "Todas 96"; 11 linhas | passou | `11-enter-abre-o-nivel4` |
| 12 | "fiscalizacao" (sem acento) e clique no subtema | `subtema=fiscalizacao-regulatoria`; h2 na janela e com foco; 7 linhas | passou | `12-busca-fiscalizacao` |
| 13 | Aba Mercado (no lugar do cartão "Sociedade digital", D2) | bloco continua aberto; Nível 1 do Mercado; cartões "Temas financeiros" e "Sinais do mercado no mês"; 7 linhas fixas, nenhum link nem seta | passou | `13-mercado-nivel1` (+ 3 resoluções) |
| 14 | Sociedade digital: bloco não aparece (D2) | Síntese executiva visível; nenhum botão "Drill down" nem raiz do drill | passou | `14-sociedade-sem-drill` |
| 14' | "Ver post ↗" | não se aplica: o cartão `post` é da Sociedade digital, que não tem drill nesta rodada (D2). O `ModalDePrevia` do post tem teste de componente. | não se aplica | |
| 15 | Clientes e Institucional: bloco não aparece (D2) | idem ao 14 | passou | `15a-clientes-sem-drill`, `15b-institucional-sem-drill` |
| 16 | Clicar numa linha de pilar do Mercado | URL e `history.length` não mudam; cursor `default`; sem seta | passou | `16-mercado-linha-sem-navegacao` |
| 17 | Endereço direto `#consulta&lente=imprensa&pilar=governanca&tema=contratos-regulacao&subtema=fiscalizacao-regulatoria` e recarregar | bloco aberto sozinho (A6); Nível 4; 7 linhas; mesmo hash antes e depois de recarregar | passou | `17-endereco-direto-recarregado` |
| 18 | `#consulta&lente=imprensa&pilar=xyz&tema=abc` | Nível 1 da Imprensa; hash corrigido para `#consulta&lente=imprensa`; a história não cresce (replace) | passou | `18-endereco-invalido-corrigido` |
| 19 | `#consulta&lente=mercado&pilar=governanca` | Nível 1 do Mercado; hash corrigido para `#consulta&lente=mercado` (A18) | passou | `19-mercado-com-pilar-no-endereco` |
| 20 | Do passo 1 ao 5 só com o teclado | Tab alcança o botão do bloco, a linha de Eficiência, a de Abastecimento, "Ver as 96 matérias" e o primeiro "Abrir matéria", todos com `:focus-visible` e anel de foco; `Enter` ativa; h2 de cada nível com foco | passou | `20-teclado-ate-o-nivel4` |
| R | Passos 1, 3, 5 e 13 em 1280×720, 1366×768 e 1920×1080 | captura e ausência de rolagem horizontal (página e blocos internos) | passou | sufixos `-1280x720`, `-1366x768`, `-1920x1080` |
| A6 | Busca com o bloco fechado, vindo da Visão geral e do Mercado | bloco abre; aba Imprensa; Nível 4; h2 com foco, na janela e abaixo do cabeçalho | passou | sem captura |
| V1 | N3 → aba Mercado → voltar → avançar | volta à Imprensa N2 com o hash do N2, sem push/replace; avançar devolve o Mercado | passou | sem captura |
| V2 | N4 rolado até o fim → voltar, voltar, avançar | h2 do nível na janela e abaixo do cabeçalho a cada passo (A5, `scrollRestoration` manual) | passou | sem captura |
| V3 | Clicar na aba ativa e em "Lentes" no cabeçalho, no N4 | hash e `history.length` intactos; continua no N4 | passou | sem captura |

## Conferência visual das capturas

Abri as 34 capturas de `qa/`. Nenhuma mostra erro, tela vazia, corte, sobreposição ou rolagem horizontal.

Comparação com o mockup:

- **Nível 1 (img1 × 01).** A estrutura é a mesma: tabela de pilares com "O que pressiona" e "O que sustenta", e lateral com "O que mudou desde julho" e "A história do mês". Diferenças esperadas: o seletor de 6 cartões, o cartão da nota, o par "48 → 42", o título "A nota caiu…" e o rodapé "A conta fecha" saíram (D1, A2). Não há faixa azul de filtros (D3). Os títulos usam a cor da lente (A9). Os cartões têm o botão PNG (A12). Os nomes de pilar do "O que mudou" são links (A16). A coluna Volume põe a unidade em linha própria (I.2). Em 1280 a lateral desce para baixo da tabela, com os dois cartões lado a lado.
- **Nível 2 (img2 × 03).** Os elementos são os mesmos: resumo com 5 métricas, tabela de temas, Evolução e Concentração. A spec prevalece em dois pontos: o selo diz "Em destaque", e não "Em análise" (A10), e só a linha navegável tem seta (C.3). A lista da busca ocupa a largura do campo, e não 460 px (P4). O grupo "Em outras lentes" não existe (I.6). Em 1280 e 1366 as listas de Concentração empilham; em 1440 e 1920 ficam lado a lado, como no mockup.
- **Nível 3 (img3/img4 × 04).** Resumo, tabela de subtemas e cartão de recortes com quatro quadros em grade (Por tier, Concessionária e UF, Veículos, Jornalistas). O botão "Ver as 96 matérias" fica no cabeçalho.
- **Nível 4 (img5 × 05).** Resumo com o gráfico diário, a lista de 11 linhas da amostra e o rodapé de amostra. Não há "Exportar lista" nem "Carregar mais" (I.4). Os filtros Tier, Concessionária e UF ficam na própria lista (D3). O indicador de nível desce para a linha de baixo, alinhado à direita, quando a trilha completa não cabe.

## Correção desta verificação

- **Captura 07 mostrava o modal sobre a Jornada, e não sobre a lista.** `fotografar` rolava a página ao topo também na captura da janela, que é a usada com o modal aberto. Agora só a captura da página inteira volta ao topo (`e2e/consulta-profundidade.spec.ts`, `fotografar`). Rodei de novo o teste "passos 1 a 12" (passou), o `typecheck:e2e` (sem erro) e o lint (os mesmos 24 avisos). A captura 07 regravada mostra o modal sobre a lista de matérias.

## Pendências

Não encontrei defeito aberto. As pendências de produto P1 a P4 continuam em `DECISOES.md`: dois selos próximos, "de 4" no Mercado, nota deduzível pelas somas e largura da lista da busca.
