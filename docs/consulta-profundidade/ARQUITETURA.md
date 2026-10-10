# Consulta em profundidade · contrato de arquitetura

Documento de trabalho para quem constrói. A spec (`SPEC_consulta_profundidade.md`) diz **o quê**; `DECISOES.md` diz **o que mudou** por causa do encaixe; este arquivo diz **onde e com que forma**. Se este arquivo e a spec divergirem num ponto que `DECISOES.md` não cobre, vale a spec.

## Convenções do repositório (obrigatórias)

- React 19 + TypeScript estrito; `verbatimModuleSyntax` (use `import type`), `noUnusedLocals`, `erasableSyntaxOnly` (sem `enum`).
- Nomes em português, comentários no estilo do repositório (blocos explicativos com a razão da decisão em CAIXA ALTA no início da frase; não exagere).
- Estilo inline com os tokens de `src/index.css` (`var(--azul-mar)`, `var(--borda)`, `var(--bg-trilho)`, `var(--erro-fg)`, `var(--ok-fg)`, `var(--cinza-2|3|4)`, `var(--bg-rodape-card)`, `var(--bg-hover)`, `var(--borda-input)`, `var(--r-card)`…). Cor sem token (ex.: `#8C91A4`, `#B0B9C8`, `#F1F4FD`, `#E6EAFB`, `#FFB8BA`, `#A2F1E8`) vai como constante nomeada em `consulta/cores.ts`.
- Classes utilitárias: `.kicker`, `.tabular`, `.cartao` (via `Cartao`), `.sem-png` / `.sem-impressao` em todo controle interativo que não deve sair no PNG.
- Lint (`oxlint`): arquivo `.tsx` exporta **só componentes**; funções puras e constantes não-componente ficam em `.ts`. Não chamar `setState` de forma síncrona dentro de `useEffect` (derive no render, ou atualize no handler/assinatura de evento).
- Testes: Vitest sem `globals` (importar `describe/it/expect` de `vitest`); testes de componente com `// @vitest-environment jsdom` na 1ª linha; Testing Library + user-event.
- Texto de tela: só o que vem da resposta da consulta (as frases são montadas pelo back, D5) ou da spec, literal. Sinal de menos é `−` (U+2212). Sem travessão `—` em texto de tela, sem emoji. Nenhum link para `#` nem URL inventada.
- Títulos de cartão usam `var(--cor-dos-titulos, var(--azul-mar))` (A9). Links, trilha, setas, botões primários e curvas usam `var(--azul-mar)`.

## Pastas

```
src/paginas/score/consulta/
  dados/tipos.ts                           tipos da spec C.2 (Dados, Lente, Pilar, Tema, Subtema, Item, CartaoLateral…) = forma da resposta do endpoint /consulta
  dados/useConsultaDaLente.ts              hook dos dados do mês (D5): { dados, erro, carregando }, cache por 'lente|mes', LENTES_COM_DRILL
  dados/useConsultaDaLente.test.ts
  dados/fixtures/consulta-profundidade.dados.json   JSON ilustrativo, SÓ PARA TESTES (cópia literal de docs/consulta-profundidade/)
  dados/fixtures/ilustrativo.ts            DADOS (o JSON com o tipo afirmado) e consultaIlustrativa(lente) (a resposta simulada do endpoint)
  dados/seletores.ts                       navegabilidade, resolverCaminho, irmãos, grupos, escalas, lista, busca
  dados/seletores.test.ts
  dados/invariantes.test.ts                as 12 regras da C.4 (mesmas de validar_dados.py) sobre o JSON ilustrativo, tolerando os nós sem-*
  formatacao.ts / formatacao.test.ts       E.2 (+ arred da C.5, faixaDe da E.1)
  endereco.ts / endereco.test.ts           ler/escrever o hash (puro) — A3
  useEnderecoDoDrill.ts                    hook: estado do hash + navegar(push|replace) + popstate
  cores.ts                                 constantes de cor sem token
  ConsultaEmProfundidade.tsx               raiz montada dentro do BlocoExpansivel "Drill down"
  componentes/
    CabecalhoDoDrill.tsx                   linha "Agosto de 2026 · corte em …" + selo (A11)
    Trilha.tsx                             E.3.4 (sem chip de nota na lente — D1)
    IndicadorDeNivel.tsx                   5 segmentos + "Nível N de 4 · <nome>" + selo
    SeloIlustrativo.tsx
    CartaoDoDrill.tsx                      cartão base: kicker, título 20px, subtítulo, botão PNG
    TabelaDeImpacto.tsx                    E.4.2 (Níveis 1, 2, 3)
    ResumoDoNivel.tsx                      E.5.2 / E.6.2 / E.7.2
    CartoesLaterais.tsx                    E.4.3 + E.8 (oQueMudou, historia, divergentes, eventos)
    CartaoDeRecortes.tsx                   E.6.4 (quatro quadros)
    ListaDeMaterias.tsx                    F.9
    ModalDePrevia.tsx                      F.8 (usa Modal de basicos)
    LimiteDoBloco.tsx                      A7
  graficos/
    BarraSentimento.tsx  BarraVolume.tsx  BarraImpacto.tsx
    GraficoColunasImpacto.tsx  ListaConcentracao.tsx  GraficoDiario.tsx
  niveis/
    NivelLente.tsx  NivelPilar.tsx  NivelTema.tsx  NivelSubtema.tsx
e2e/consulta-profundidade.spec.ts  (+ e2e/fixtures/*.json, e2e/fixtures/consulta.ts, e2e/tsconfig.json fora das references, playwright.config.ts na raiz)
```

## Fonte de dados (D5)

- **Endpoint:** `GET /api/score/lentes/{codigo}/consulta?mes=AAAA-MM` (back-reputacional, `app/api/lentes.py`), lido por `obterConsultaDaLente(codigo, mes)` em `src/api/cliente.ts` (via `requisitar`, como as outras chamadas do Score). Só `imprensa` e `mercado` respondem; outra lente volta 404.
- **Resposta = o tipo `Dados`** de `dados/tipos.ts`, com **uma** lente em `lentes` (Imprensa com `drill: true`, Mercado com `drill: false`), `meta.aviso` vazio, `meta.origem` (`'carga'` ou `'exemplo'`), `faixas` com as 5 faixas, `kpis: []`, `leitura: ''` e as frases já montadas pelos números no back. Assim `resolverCaminho` e os quatro níveis leem o mês real sem mudar de forma. O que a resposta real tem e o JSON ilustrativo não: `nota` e meses de `serie` `null` quando o mês não tem dado; sentimento `{0,0,0}` em nó de volume 0; `pilares: []` no mês vazio (`volumeTotal` 0); `de`/`para` do "O que mudou" como notas inteiras (fecham com as linhas só dentro de 0,5).
- **Hook `useConsultaDaLente(lente, mes)`** (`dados/useConsultaDaLente.ts`): `useSyncExternalStore` sobre um cache de módulo (`Map` por `lente|mes`). Uma requisição por chave, compartilhada entre a raiz do drill e a busca do cabeçalho; o efeito só dispara a busca (nenhum `setState` síncrono). Trocar de mês troca o retrato no mesmo render (nunca mostra a árvore do mês anterior). Erro não fica preso: a próxima montagem da mesma chave tenta de novo, e `tentarConsultaDeNovo(lente, mes)` faz o mesmo a partir de um gesto (botão "Tentar de novo" da faixa de erro; foco na busca do cabeçalho). **Invalidação:** toda escrita bem-sucedida em `/api/score/*` avisa `scoreMudou` (`src/dominio/sincronizacao.ts`, `escreveNoScore`, avisado em `requisitar` como `catalogoMudou` e `agendasMudaram`, também entre abas); o hook escuta `scoreMudou` e `catalogoMudou` e marca toda chave como obsoleta, descarta a resposta em voo e pede de novo, na hora, as chaves que estão na tela (mostrando a árvore antiga até a nova chegar, sem "Carregando"); as outras são pedidas na próxima montagem. Lentes fora de `LENTES_COM_DRILL` não buscam. `esquecerConsultas()` limpa o cache (testes).
- **Raiz:** `ConsultaEmProfundidade` mostra `Carregando`, `FaixaDeErro` com "Tentar de novo" ou o vazio "Sem matérias desta lente em <mês>" (`volumeTotal` 0). O drill (`DrillDoMes`) só monta com os dados, e **a correção de endereço (A20) só roda depois de eles chegarem**: um link profundo não é corrigido para o Nível 1 durante o carregamento. Na troca de mês o hash fica intacto enquanto o mês novo carrega; se os nós existem no mês novo, o drill continua no mesmo caminho; senão a correção leva ao nível válido mais fundo.
- **Meta por prop:** nenhum componente lê o JSON. `meta` desce da raiz para `CabecalhoDoDrill`, `IndicadorDeNivel` (`aviso`), `NivelPilar/Tema/Subtema`, `CartaoDeRecortes` (`rotuloMes`), `GraficoDiario` (`mes`) e `ListaDeMaterias` (`fonte`, `dataCorte`). `SeloIlustrativo` devolve `null` com `aviso` vazio; quem o chama passa `avisoDaConsulta(meta)` (`seletores.ts`): o `meta.aviso`, ou "Dados de exemplo" com `meta.origem === 'exemplo'`, ou vazio na carga real. `ModalDePrevia` recebe `dadosReais` (`!meta.aviso`) para a frase de link ausente (A22).
- **Nós de fechamento** `sem-pilar`, `sem-tema`, `sem-subtema` ("Sem … identificado"): irmãos comuns nas tabelas e nas somas, nunca navegáveis (`ehNoDeFechamento` em `seletores.ts`, além da regra C.3), nunca destaque, fora da busca. O `title` de toda linha não navegável sai de `motivoSemDetalhamento(no, coluna, lente.drill)` (A21); `TabelaDeImpacto` recebe `lenteComDrill`.
- **Dados reais com buracos:** jornalista `''` mostra só o veículo (lista e prévia, sem "· ·"); trecho `''` não desenha parágrafo; `url` nula mostra a frase de link ausente e `url` http(s) mostra "Abrir no site de origem ↗".
- **Testes:** os testes jsdom simulam `obterConsultaDaLente` com `consultaIlustrativa(lente)` (aviso "Dados ilustrativos"). O Playwright responde `/imprensa/consulta` e `/mercado/consulta` (qualquer `mes`) com a lente ilustrativa derivada do mesmo JSON (`e2e/fixtures/consulta.ts`), e `api.responder` troca a resposta num teste (o de "dados reais sem selo").

## Tipos-chave (dados/tipos.ts)

Os da spec C.2, literalmente, com `Lente['id']` = `'imprensa' | 'mercado' | 'sociedade' | 'clientes' | 'institucional'`.

## formatacao.ts

```ts
export const MENOS = '−';
export function arred(x: number, casas = 0): number;          // C.5 (Math.round + EPSILON)
export function fmtPt(x: number): string;                     // −7,4 pt | +1,2 pt | 0,0 pt
export function fmtPtItem(x: number): string;                 // −0,12 | +0,12 | 0,00
export function fmtPtCurto(x: number): string;                // −3,4 | +0,7 | 0,0  (1 casa, sem "pt": F.6, recortes)
export function fmtInt(n: number): string;                    // 18.420
export function fmtPct(n: number): string;                    // 61%
export function fmtSaldo(pos: number, neg: number): string;   // −36 | +23 | 0
export function fmtDelta(d: number): { texto: string; cor: string };  // ▼ 6 pt / ▲ 4 pt
export function fmtDataCurta(iso: string): string;            // 12/08
export function fmtDataLonga(iso: string): string;            // 12/08/2026
export function corDoSinal(x: number): string;                // var(--erro-fg) | var(--ok-fg) | var(--cinza-3)
export function faixaDe(nota: number, faixas: Dados['faixas']): Dados['faixas'][number];
```
Zero exato não leva sinal; valor que arredonda para zero mostra `0,0` (ou `0,00`).

## endereco.ts (puro)

```ts
export interface EnderecoDoDrill {
  ativo: boolean;                 // o hash tem o marcador "consulta"
  lente?: string; pilar?: string; tema?: string; subtema?: string;
  sent?: 'todas' | 'negativas' | 'neutras' | 'positivas';
  ordem?: 'impacto' | 'data';
  tier?: string; conc?: string; uf?: string; item?: string;
}
export function lerEndereco(hash: string): EnderecoDoDrill;          // '#consulta&pilar=x' → {...}
export function escreverEndereco(e: EnderecoDoDrill): string;        // → '#consulta&lente=…&pilar=…' (ordem fixa de chaves, omite vazios e padrões sent=todas/ordem=impacto)
```

## useEnderecoDoDrill.ts

```ts
export const EVENTO_DO_ENDERECO = 'consulta:endereco';   // CustomEvent disparado em toda navegação programática
export function navegarNoDrill(novo: EnderecoDoDrill, modo: 'push' | 'replace'): void;
//   history[pushState|replaceState](null, '', location.pathname + location.search + escreverEndereco(novo))
//   + window.dispatchEvent(new CustomEvent(EVENTO_DO_ENDERECO))
export function useEnderecoDoDrill(): EnderecoDoDrill;
//   useSyncExternalStore assinando 'popstate' e EVENTO_DO_ENDERECO; snapshot = location.hash
```
(funções não-componente: o arquivo é `.ts`.)

## dados/seletores.ts

```ts
export type Nivel = 1 | 2 | 3 | 4;
export const NOMES_DOS_NIVEIS: Record<Nivel, string>;   // 1 Lente e pilares, 2 Temas estratégicos, 3 Subtemas, 4 Matérias
export function lenteDoDrill(dados: Dados, id: string): Lente | undefined;
export function ehNoDeFechamento(no: { id: string }): boolean;         // id começa com 'sem-' (D5)
export function motivoSemDetalhamento(no, coluna: 'Pilar' | 'Tema estratégico' | 'Subtema', lenteComDrill: boolean): string;   // title da linha fixa (A21)
export function avisoDaConsulta(meta: Dados['meta']): string;           // aviso, ou 'Dados de exemplo' com origem 'exemplo', ou '' (D5)
export function pilarNavegavel(lente: Lente, pilar: Pilar): boolean;   // lente.drill && !sem-* && pilar.filhos?.length
export function temaNavegavel(tema: Tema): boolean;                     // !sem-* && filhos?.length && nivel3
export function subtemaNavegavel(subtema: Subtema): boolean;            // !sem-* && !!nivel4
export interface Caminho { lente: Lente; pilar?: Pilar; tema?: Tema; subtema?: Subtema; nivel: Nivel; corrigido?: EnderecoDoDrill }
export function resolverCaminho(dados: Dados, lenteId: string, e: EnderecoDoDrill): Caminho;   // D.2 adaptada (lente vem da aba); `corrigido` sempre que o endereço não é o canônico do caminho (A20)
export interface GruposDeImpacto<T> { pressiona: T[]; sustenta: T[]; somaPressiona: number; somaSustenta: number }
export function agruparPorImpacto<T extends No>(nos: T[]): GruposDeImpacto<T>;   // ordenações da E.4.2
export function escalaDeImpacto(valores: number[], folga = 1.05): number;        // max(|v|) × folga (1 se tudo zero)
export function participacao(volume: number, total: number): number;             // round(volume ÷ total × 100)
export function mediaArredondada(valores: number[]): number;
export function ordenarItens(itens: Item[], ordem: 'impacto' | 'data'): Item[];   // F.9
export function filtrarItens(itens: Item[], f: { sent?: string; tier?: string; conc?: string; uf?: string }): Item[];   // sent desconhecido não filtra (Map, imune a 'constructor')
export function opcoesDaAmostra(itens: Item[]): { tiers: string[]; concessionarias: string[]; ufs: string[] };
export interface ResultadoDeBusca { id: string; tipo: 'Subtema' | 'Tema' | 'Pilar' | 'Matéria'; nome: string; impacto?: number; caminho: string; destino: EnderecoDoDrill }
export interface EntradaDoIndice { resultado: ResultadoDeBusca; textos: readonly string[] }   // textos pesquisáveis crus (matéria: título, veículo, jornalista, concessionária)
export type IndiceDeBusca = readonly EntradaDoIndice[];
export function montarIndiceDeBusca(dados: Dados): IndiceDeBusca;   // pula os nós sem-* (e o que estiver abaixo deles)
export function buscarNoDrill(indice: IndiceDeBusca, termo: string): ResultadoDeBusca[];   // E.9 (normalização, ordem, máx 8, máx 3 matérias)
export function normalizarBusca(texto: string): string;
```

## Componentes (props)

```ts
<ConsultaEmProfundidade lente={codigoDaAba} mes={mesDaTela} />       // raiz; lê a consulta do mês e o hash, resolve o caminho, corrige com replace (só com os dados), rola/foca ao mudar de nível
<CabecalhoDoDrill meta={Dados['meta']} />                             // "<rotuloMes> · corte em <dataCorte>" + selo (só com aviso)
<Trilha caminho={Caminho} aoIr={(e: EnderecoDoDrill) => void} />
<IndicadorDeNivel nivel={Nivel} aviso={meta.aviso} />
<SeloIlustrativo aviso={meta.aviso} />                                // null com aviso ''
<CartaoDoDrill kicker? titulo? subtitulo? acao?: ReactNode children estilo? />   // é um Cartao (.cartao) e põe <BaixarPng titulo=…/> no cabeçalho
<TabelaDeImpacto titulo subtitulo rotuloColuna="Pilar"|"Tema estratégico"|"Subtema" unidade nos={No[]} destaqueId? navegavel={(no) => boolean} aoAbrir={(no) => void} rodape?: ReactNode lenteComDrill?: boolean />
<BarraImpacto valor escala compacta? />   <BarraSentimento sentimento={DistSentimento} />   <BarraVolume volume maximo />
<GraficoColunasImpacto meses impactos volumes />   <ListaConcentracao linhas={{nome,volume,impacto}[]} volumeTotal />   <GraficoDiario porDia mes="08" />
<ListaDeMaterias subtema={Subtema} unidade fonte="Clipei" dataCorte={meta.dataCorte} endereco={EnderecoDoDrill} aoMudar={(parcial) => void} aoAbrirItem={(item, botao) => void} />
<ModalDePrevia alvo={{ tipo: 'item'; item: Item } | { tipo: 'post'; post: … }} aoFechar devolverFocoPara? dadosReais? />
<LimiteDoBloco>{…}</LimiteDoBloco>
```

## Integração (arquivos existentes que mudam)

- **Ninguém pode apagar o hash.** Hoje dois pontos regravam o endereço sem ele (A3). Os ajustes abaixo em `painel.tsx` e em `Score.tsx` são obrigatórios, com teste jsdom.
- `src/paginas/score/DossieDaLente.tsx`: o bloco "Drill down" só aparece para as lentes de `LENTES_COM_DRILL` (`imprensa` e `mercado`, D2; a lista mora em `useConsultaDaLente.ts`) e monta `<ConsultaEmProfundidade lente={lente} mes={mes} />`. O estado `abertos.drill` passa a abrir sozinho quando o endereço tem nível > 1 ou quando a busca navega para o drill (A6).
- `src/paginas/Score.tsx`: `lenteAberta` sai da `lente` do hash enquanto ele é do drill e a lente é válida (A4), com o estado só como reserva sem hash; assim lente e hash mudam no mesmo render, e voltar a uma entrada de outra lente não faz a raiz regravar o hash com a lente antiga. Clicar na aba já aberta não reescreve nada; `trocarLente` reescreve o hash com a lente nova e sem níveis, só se o hash tiver o marcador; a escolha de uma sugestão do drill na busca abre Lentes, a lente Imprensa e navega no drill com pedido de foco (`{ focar: true }`, A5/A6), usando `replace` quando o destino é a tela atual. **`navegarNoDrill` roda DEPOIS de `irPara`**: `irPara` (`src/navegacao/useNavegacao.ts`) grava `caminho + consulta` sem o hash e apagaria o destino.
- `src/dominio/buscaDoRadar.ts` e `src/paginas/score/BuscaDoRadar.tsx`: grupo do drill (D3, A15). O índice é a árvore da Imprensa **do mês da tela** (`useConsultaDaLente('imprensa', mes)`, mesmo cache da raiz), pedida no primeiro foco do campo; enquanto carrega (ou se falhar), o grupo não aparece. O selo do grupo só aparece com `meta.aviso`.
- `src/estado/painel.tsx`: (1) `definirRecorte` preserva o hash: `replaceState(null, '', pathname + consultaDe(novo) + window.location.hash)`. Hoje ele grava sem o hash, e mexer em período, concessionária ou chip da barra de filtros real devolveria o drill ao Nível 1 em silêncio, sem volta pelo navegador (é `replaceState`). Teste: com `#consulta&lente=imprensa&pilar=governanca` no endereço, chamar `definirRecorte` e conferir que `location.hash` se mantém. (2) No `popstate`, não trocar o recorte quando a consulta não mudou (evita rebuscar a base do CRM a cada voltar dentro do drill).
