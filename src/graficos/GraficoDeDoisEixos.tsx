/** Cotação de bonds (eixo esquerdo) e índice reputacional (eixo direito).
 *
 *  SVG PURO, como o resto do produto (`GraficoDeLinha`, `Rosca`, `MapaUf`,
 *  `GraficoDeArvore`): nenhuma biblioteca de gráfico entra por uma tela só.
 *
 *  ───────────────────────────────────────────────────────────────────────────
 *  TRÊS DIFERENÇAS EM RELAÇÃO A `GraficoDeLinha`, e são o motivo de ser outro
 *  componente em vez de um parâmetro a mais naquele:
 *
 *  1. O EIXO X É TEMPORAL, não categórico. Lá cada ponto ocupa uma posição
 *     fixa (`xDoIndice`), o que funciona quando os pontos são meses iguais.
 *     Aqui o bond tem pregão e o índice tem mês: desenhá-los por índice poria
 *     o 12º pregão em cima do 12º mês. A posição sai da DATA.
 *
 *  2. SÃO DUAS RÉGUAS. A da esquerda nasce dos valores (`dominioDosBonds`); a
 *     da direita é FIXA em 0–100 (`faixaDoIndice`), e isso é o que impede o
 *     gráfico de mentir — ver o docstring daquela função.
 *
 *  3. A LINHA DO ÍNDICE É EM DEGRAUS e tracejada. Um valor por mês desenhado
 *     como reta inclinada afirmaria que o índice subiu um pouquinho a cada dia,
 *     e ele não foi medido assim. O degrau mostra na própria forma que a medida
 *     é mensal — é a informação mais importante que a tela dá sobre a diferença
 *     entre as duas curvas.
 *
 *  ───────────────────────────────────────────────────────────────────────────
 *  SEM CURVA SUAVE, e isto é decisão contra o que o outro gráfico faz.
 *  `GraficoDeLinha` usa Catmull-Rom porque "linhas retas entre os pontos
 *  pareciam quebradas demais para uma série de poucos períodos". Aqui são ~1.100
 *  pregões: suavizar inventaria valores entre dias que foram medidos, e numa
 *  série financeira isso é desenhar preço que não houve.
 *
 *  O VÃO É AUSÊNCIA DE PONTO. Dia sem pregão não vem na série (a rota já o
 *  exclui), e o traçado quebra quando o intervalo entre dois pontos passa de
 *  `DIAS_PARA_QUEBRAR` — senão um papel emitido no meio do período apareceria
 *  ligado por uma reta atravessando meses em que ele não existia.
 */

import { useEffect, useRef, useState } from 'react';

import type { FaixaDoEixo } from '@/dominio/eixoDaSerie';
import { dominioDosBonds, faixaDoIndice } from '@/dominio/eixoDaSerie';

const MARGEM_ESQUERDA = 44;
const MARGEM_DIREITA = 44;
const MARGEM_SUPERIOR = 12;
const ALTURA_DO_EIXO_X = 22;

/** Quantos dias de intervalo quebram a linha em vez de ligá-la.
 *
 *  DEZ, e não "qualquer intervalo": fim de semana são dois dias e feriado
 *  emendado chega a quatro — quebrar neles picaria a linha em 52 pedaços por
 *  ano. Dez dias sem pregão não é calendário, é o papel não existir ainda (ou
 *  o fornecedor ter falhado), e aí o vão é a informação. */
const DIAS_PARA_QUEBRAR = 10;

const UM_DIA = 24 * 60 * 60 * 1000;

export interface PontoDatado {
  /** `YYYY-MM-DD`. */
  data: string;
  valor: number;
}

export interface SerieDatada {
  chave: string;
  rotulo: string;
  cor: string;
  pontos: PontoDatado[];
}

export interface PontoMensal {
  /** `YYYY-MM-DD`, sempre o dia 1. */
  mes: string;
  valor: number | null;
}

const SO_DATA = /^\d{4}-\d{2}-\d{2}/;

/** A data em milissegundos, ou `null` quando a string não é uma data.
 *
 *  `T00:00:00Z` EXPLÍCITO: `new Date('2026-01-05')` já é UTC, mas
 *  `new Date('2026-01-05T00:00:00')` é LOCAL — e a diferença de fuso move o
 *  ponto um dia inteiro no eixo.
 *
 *  POR ISSO RECORTA OS DEZ PRIMEIROS CARACTERES em vez de concatenar, e isto é
 *  conserto de achado: a versão anterior fazia `iso + 'T00:00:00Z'`, então um
 *  `2026-01-05T00:00:00` vindo da API virava `…T00:00:00T00:00:00Z` e
 *  `Date.parse` devolvia `NaN`. Como `inicio` e `fim` saem de `Math.min`/`max`,
 *  UM ponto ruim contaminava TODAS as coordenadas do eixo, e o gráfico ficava
 *  vazio sem nenhuma mensagem.
 *
 *  DEVOLVE `null` EM VEZ DE `NaN` para que quem chama tenha de decidir o que
 *  fazer com o ponto inválido — `NaN` se propaga em silêncio por toda
 *  aritmética, e é assim que ele apagou o eixo. */
function emMilissegundos(iso: string): number | null {
  if (!SO_DATA.test(iso)) return null;
  const ms = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
}

/** Os pontos com data válida, já em milissegundos. Os inválidos SAEM.
 *
 *  Descartar o ponto é melhor que deixá-lo contaminar o eixo — e melhor que
 *  levantar, porque um papel com uma data torta não deve apagar os outros trinta.
 */
function datados(pontos: PontoDatado[]): { ms: number; valor: number }[] {
  const bons: { ms: number; valor: number }[] = [];
  for (const ponto of pontos) {
    const ms = emMilissegundos(ponto.data);
    if (ms !== null) bons.push({ ms, valor: ponto.valor });
  }
  return bons;
}

/** A data sob um pixel da área do gráfico — a inversa da escala do eixo x.
 *
 *  FUNÇÃO PURA, E EXPORTADA, porque é esta conta que erra: um erro de meia tela
 *  aqui aponta uma janela inteira errada sem nada parecer quebrado. Testar a
 *  inversa direto é mais barato e mais exato que caçá-la por cliques simulados.
 *
 *  PRENDE NAS PONTAS em vez de extrapolar: arrastar o clique para fora da área
 *  pediria uma janela que o gráfico não mostra — ou, para a esquerda, uma data
 *  anterior ao próprio eixo.
 *
 *  LARGURA ZERO DEVOLVE O COMEÇO, e não `NaN`: há um quadro, antes de o
 *  `ResizeObserver` responder, em que a largura é zero. `NaN` ali faria
 *  `toISOString` lançar `RangeError` — e fora da renderização, onde o
 *  `LimiteDeErro` não alcança.
 */
export function dataNoPixel(
  px: number,
  inicio: number,
  fim: number,
  larguraDoPlot: number,
): string {
  if (!(larguraDoPlot > 0)) return new Date(inicio).toISOString().slice(0, 10);
  const fracao = Math.min(1, Math.max(0, px / larguraDoPlot));
  const ms = inicio + fracao * (fim - inicio);
  return new Date(ms).toISOString().slice(0, 10);
}

/** O último dia do mês de `iso`, sem passar do fim do eixo.
 *
 *  O RÓTULO DO EIXO É UM MÊS E A JANELA PRECISA DE UM DIA. O último do mês é o
 *  que faz os quinze dias caírem DENTRO do mês clicado; pegar o dia 1º jogaria a
 *  janela quase toda para o mês anterior, que não é o que alguém clicando em
 *  "set" quer ver.
 */
function ultimoDiaDoMes(iso: string, fimDoEixo: number): string {
  const [ano, mes] = iso.split('-').map(Number);
  //: DIA 0 DO MÊS SEGUINTE é o último do mês atual, inclusive em fevereiro de
  //: ano bissexto — a conta de dias por mês fica com o calendário, não comigo.
  const ultimo = Date.UTC(ano, mes, 0);
  return new Date(Math.min(ultimo, fimDoEixo)).toISOString().slice(0, 10);
}

/** Esta série desenha alguma curva?
 *
 *  A REGRA ÚNICA, exportada porque a TELA precisa da MESMA: o aviso de "sem
 *  cotação no período" nasceu olhando `pontos.length`, e o desenho olha os
 *  pontos com DATA VÁLIDA. Uma série com pontos e datas tortas não desenhava
 *  curva e não disparava o aviso — exatamente o estado silencioso que o aviso
 *  existe para acabar. Achado de revisão.
 *
 *  MORA AQUI porque é aqui que "o que é desenhável" se decide: `datados`
 *  descarta data inválida e `trechos` agrupa o que sobra. */
export function temCurva(pontos: PontoDatado[]): boolean {
  return trechos(datados(pontos)).length > 0;
}

/** Os trechos contínuos de uma série, separados nos vãos grandes.
 *
 *  DEVOLVE OS TRECHOS, e não o `d` pronto, porque o desenho precisa saber quais
 *  deles têm UM PONTO SÓ: um `M x,y` sem segmento não desenha NADA, e a série
 *  de um pregão único ficava invisível — achado de revisão. O ponto isolado
 *  recebe um marcador em vez de uma linha de comprimento zero.
 */
function trechos(pontos: { ms: number; valor: number }[]): { ms: number; valor: number }[][] {
  const grupos: { ms: number; valor: number }[][] = [];
  let atual: { ms: number; valor: number }[] = [];
  let anterior: number | null = null;
  for (const ponto of pontos) {
    if (anterior !== null && ponto.ms - anterior > DIAS_PARA_QUEBRAR * UM_DIA) {
      grupos.push(atual);
      atual = [];
    }
    atual.push(ponto);
    anterior = ponto.ms;
  }
  if (atual.length) grupos.push(atual);
  return grupos;
}

function caminhoDoTrecho(
  trecho: { ms: number; valor: number }[],
  x: (ms: number) => number,
  y: (valor: number) => number,
): string {
  return trecho
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.ms).toFixed(1)},${y(p.valor).toFixed(1)}`)
    .join(' ');
}

/** O mês de calendário seguinte, em milissegundos. */
function mesSeguinte(iso: string): number {
  const [ano, mes] = iso.split('-').map(Number);
  return mes === 12
    ? Date.parse(`${ano + 1}-01-01T00:00:00Z`)
    : Date.parse(`${ano}-${String(mes + 1).padStart(2, '0')}-01T00:00:00Z`);
}

/** O traçado do índice: um degrau por mês.
 *
 *  CADA DEGRAU VALE O SEU MÊS DE CALENDÁRIO, e não "até o próximo ponto da
 *  série" — a diferença aparece quando falta um mês. Com janeiro e março
 *  medidos e fevereiro sem dado, "até o próximo ponto" esticaria o valor de
 *  janeiro por fevereiro inteiro: índice desenhado para um mês que não foi
 *  medido, indistinguível de medida real. O degrau termina no fim de janeiro e
 *  o de março começa do zero, com o vão entre eles dizendo a verdade.
 *
 *  O ÚLTIMO SE ESTENDE ATÉ O FIM DO EIXO, porque o mês corrente não acabou:
 *  parar a linha no dia 1 deixaria o trecho mais recente do gráfico — o que a
 *  pessoa está olhando — sem a curva que ele existe para comparar.
 *
 *  A EMENDA ENTRE MESES CONSECUTIVOS é uma linha vertical, que é o que faz
 *  disto um degrau em vez de traços soltos: ela mostra o salto de um mês para o
 *  outro, que é exatamente a grandeza que o índice mede.
 */
function mesesDoIndice(
  pontos: PontoMensal[],
): { comeca: number; termina: number; valor: number }[] {
  const bons: { comeca: number; termina: number; valor: number }[] = [];
  for (const ponto of pontos) {
    if (ponto.valor == null) continue;
    const comeca = emMilissegundos(ponto.mes);
    if (comeca === null) continue;
    //: TERMINA NO FIM DO PRÓPRIO MÊS, SEMPRE — inclusive o último.
    //:
    //: A versão anterior fazia `Math.max(fimDoEixo, comeca)` no último, e com um
    //: mês só (sem bonds no gráfico) `fimDoEixo` era igual a `comeca`: o degrau
    //: saía com comprimento ZERO e não desenhava nada. Achado de revisão, e o
    //: meu teste da régua direita renderizava exatamente esse caso e passava,
    //: porque só olhava os rótulos do eixo.
    //:
    //: O mês é a unidade de medida do índice, então o degrau tem a largura do
    //: mês. Quem garante que ele caiba no eixo é o cálculo do `fim`, que inclui
    //: o fim do último mês.
    bons.push({ comeca, termina: mesSeguinte(ponto.mes), valor: ponto.valor });
  }
  return bons;
}

function caminhoEmDegraus(
  meses: { comeca: number; termina: number; valor: number }[],
  x: (ms: number) => number,
  y: (valor: number) => number,
): string {
  let d = '';
  let fimDoAnterior: number | null = null;
  for (const mes of meses) {
    const altura = y(mes.valor).toFixed(1);
    //: EMENDA SÓ QUANDO O MÊS ANTERIOR TERMINA ONDE ESTE COMEÇA. Qualquer
    //: buraco de calendário quebra o traçado, e o vão é a informação.
    d += `${fimDoAnterior === mes.comeca ? 'L' : 'M'} ${x(mes.comeca).toFixed(1)},${altura} `;
    d += `L ${x(mes.termina).toFixed(1)},${altura} `;
    fimDoAnterior = mes.termina;
  }
  return d.trim();
}

function mesLegivel(iso: string): string {
  const [ano, mes] = iso.split('-');
  return `${mes}/${ano.slice(2)}`;
}

export function GraficoDeDoisEixos({
  bonds,
  indice,
  rotuloDaEsquerda,
  faixaFixa,
  altura = 320,
  vazio = 'Sem cotação no período.',
  aoEscolherData,
  dataEscolhida = null,
  diasDaJanela = 15,
}: {
  bonds: SerieDatada[];
  indice: PontoMensal[];
  /** "Preço (% do par)" ou "Yield (%)" — o que o eixo esquerdo mede. */
  rotuloDaEsquerda: string;
  /** A FAIXA FIXA DA MÉTRICA (`FAIXA_FIXA_DO_PRECO` / `FAIXA_FIXA_DO_YIELD`).
   *
   *  Ela é o que faz o eixo ESQUERDO não se reformar quando o período muda —
   *  sem isto, só o eixo direito estava estável, e a coincidência visual entre
   *  as duas curvas continuava sendo artefato do recorte. Omiti-la volta à
   *  régua puramente automática. */
  faixaFixa?: FaixaDoEixo;
  altura?: number;
  vazio?: string;
  /** Escolher um dia clicando no gráfico ou num rótulo do eixo.
   *
   *  OMITIDA, O GRÁFICO NÃO FICA CLICÁVEL — e isso é de propósito: as outras
   *  telas montam este componente e não devem ganhar uma área de clique
   *  invisível, nem um cursor de mãozinha prometendo interação que não existe. */
  aoEscolherData?: (iso: string) => void;
  /** O dia escolhido, para o gráfico marcá-lo. Sem a marca, o clique muda o que
   *  está embaixo e o gráfico fica igual — e aí não há como saber qual janela
   *  está na tela. */
  dataEscolhida?: string | null;
  /** Quantos dias a janela cobre, só para sombreá-la. A conta de verdade é do
   *  servidor (ver `impacto_por_n1_na_janela`); aqui é desenho. */
  diasDaJanela?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [largura, definirLargura] = useState(0);

  //: MEDE A LARGURA REAL, mesma técnica de `GraficoDeLinha` e
  //: `GraficoDeArvore`: sem isto o SVG nasce com uma largura adivinhada e o
  //: último ponto fica fora da área visível em telas estreitas.
  useEffect(() => {
    const alvo = container.current;
    if (!alvo) return;
    const observador = new ResizeObserver((entradas) => {
      //: A LISTA PODE VIR VAZIA, e `entradas[0].contentRect` então lança DENTRO
      //: do callback do observador — fora da renderização, onde o
      //: `LimiteDeErro` não alcança: o erro sobe sem nada na tela explicando, e
      //: a largura nunca mais chega. Achado de revisão, defensivo e barato.
      const entrada = entradas[0];
      if (!entrada) return;
      definirLargura(entrada.contentRect.width);
    });
    observador.observe(alvo);
    return () => observador.disconnect();
  }, []);

  //: CADA SÉRIE VIRA SEUS TRECHOS, uma vez: o desenho precisa deles e a conta
  //: do eixo também, e refazê-los duas vezes deixaria as duas discordarem no
  //: dia em que a regra de quebra mudasse.
  //: UMA TRANSFORMAÇÃO SÓ, e duas vistas dela: `series` é o que se DESENHA e
  //: `comTrechos` é o que se DESCREVE (inclui quem não tem ponto). Calcular
  //: `datados`/`trechos` duas vezes — uma para cada — era convite para as duas
  //: discordarem no dia em que a regra de quebra mudasse; achado de revisão.
  const comTrechos = bonds.map((s) => ({ ...s, trechos: trechos(datados(s.pontos)) }));
  const series = comTrechos.filter((s) => s.trechos.length > 0);
  const todosOsValores = series.flatMap((s) =>
    s.trechos.flatMap((t) => t.map((p) => p.valor)),
  );
  const faixaEsquerda = dominioDosBonds(todosOsValores, faixaFixa);
  const faixaDireita = faixaDoIndice();

  const meses = mesesDoIndice(indice);

  const datas = series.flatMap((s) => s.trechos.flatMap((t) => t.map((p) => p.ms)));
  //: O EIXO X COBRE AS DUAS SÉRIES, E O FIM DO ÚLTIMO DEGRAU. Recortá-lo só
  //: pelos bonds deixaria o degrau de um mês sem cotação fora da tela — e é
  //: justamente o mês em que o papel não negociou que a pessoa quer ver ao lado
  //: do índice. Incluir o `termina` é o que dá largura ao degrau de um mês só.
  const todasAsDatas = [
    ...datas,
    ...meses.map((m) => m.comeca),
    ...meses.map((m) => m.termina),
  ];
  const inicio = todasAsDatas.length ? Math.min(...todasAsDatas) : 0;
  const fim = todasAsDatas.length ? Math.max(...todasAsDatas) : 1;
  const intervalo = Math.max(1, fim - inicio);

  const alturaDoPlot = altura - MARGEM_SUPERIOR - ALTURA_DO_EIXO_X;
  const larguraDoPlot = Math.max(1, largura - MARGEM_ESQUERDA - MARGEM_DIREITA);

  const x = (ms: number) =>
    MARGEM_ESQUERDA + ((ms - inicio) / intervalo) * larguraDoPlot;
  const yEsquerda = (valor: number) =>
    MARGEM_SUPERIOR +
    alturaDoPlot *
      (1 - (valor - faixaEsquerda.minimo) / (faixaEsquerda.maximo - faixaEsquerda.minimo));
  const yDireita = (valor: number) =>
    MARGEM_SUPERIOR +
    alturaDoPlot *
      (1 - (valor - faixaDireita.minimo) / (faixaDireita.maximo - faixaDireita.minimo));

  if (series.length === 0 && meses.length === 0) {
    return (
      <div ref={container}>
        <p style={{ color: 'var(--cinza-2)', fontSize: 13, margin: 0 }}>{vazio}</p>
      </div>
    );
  }

  /** O que um leitor de tela ouve.
   *
   *  OS VALORES ENTRAM, como `GraficoDeLinha` faz — era divergência minha dar
   *  só uma frase genérica ("preço dos bonds e índice reputacional"), que não
   *  diz quais papéis, nem quanto, nem quando. Para uma série longa vão as
   *  pontas: ler 1.100 pregões em voz alta não é acesso, é ruído.
   */
  /** Onde desenhar a faixa da janela, em pixels — `null` sem data escolhida.
   *
   *  PRESO AO EIXO nas duas pontas: a janela de quinze dias pode começar antes
   *  do primeiro ponto do gráfico, e uma faixa que vaza para a esquerda da
   *  régua sugere dado que o gráfico não mostra. */
  const janela = (() => {
    if (!dataEscolhida) return null;
    const ms = emMilissegundos(dataEscolhida);
    if (ms === null) return null;
    const comeca = ms - (diasDaJanela - 1) * UM_DIA;
    return {
      de: x(Math.max(inicio, Math.min(fim, comeca))),
      ate: x(Math.max(inicio, Math.min(fim, ms))),
    };
  })();

  const descricao = [
    `${rotuloDaEsquerda} e índice reputacional de 0 a 100.`,
    //: DE `bonds`, E NÃO DE `series`: `series` já descartou (linha 263) quem não
    //: tem ponto nenhum, e descrever só os que sobraram faz a série escolhida
    //: desaparecer de TUDO — do desenho, da descrição e de qualquer aviso. Quem
    //: ligou o papel clica, nada muda, e a conclusão é que a tela travou.
    //:
    //: É O CASO DO PAPEL SEM COTAÇÃO NO PERÍODO — um papel emitido depois do
    //: início da janela, ou que só tem preço e não tem yield na métrica
    //: escolhida. Relatado em 19/10/2026 como "mudo a fonte de dados e a tela
    //: trava": o servidor respondia 200 em 60ms com a série vazia, de propósito,
    //: e era a tela que engolia a resposta em silêncio.
    ...comTrechos.map((s) => {
      const pontos = s.trechos.flat();
      const primeiro = pontos[0];
      const ultimo = pontos[pontos.length - 1];
      const comoData = (ms: number) => new Date(ms).toISOString().slice(0, 10);
      if (pontos.length === 0) return `${s.rotulo}: sem cotação no período.`;
      return pontos.length === 1
        ? `${s.rotulo}: ${primeiro.valor} em ${comoData(primeiro.ms)}.`
        : `${s.rotulo}: de ${primeiro.valor} em ${comoData(primeiro.ms)} a ` +
          `${ultimo.valor} em ${comoData(ultimo.ms)}, ${pontos.length} pregões.`;
    }),
    meses.length
      ? `Índice: ${meses.map((m) => m.valor).join(', ')} nos ${meses.length} meses do período.`
      : 'Índice sem valor no período.',
  ].join(' ');

  return (
    <div ref={container} style={{ width: '100%' }}>
      {largura > 0 ? (
        <svg width={largura} height={altura} role="img" aria-label={descricao}>
          {/* A JANELA ESCOLHIDA, ATRÁS DE TUDO. Primeiro no documento é primeiro
              a ser pintado, então a faixa fica por baixo das curvas — ela é
              contexto, e cobrir o dado com o recorte do dado seria inverter o
              que importa. */}
          {janela ? (
            <>
              <rect
                data-testid="faixa-da-janela"
                x={janela.de}
                y={MARGEM_SUPERIOR}
                width={Math.max(1, janela.ate - janela.de)}
                height={alturaDoPlot}
                fill="var(--azul-mar)"
                opacity={0.08}
              />
              <line
                data-testid="marca-da-data"
                x1={janela.ate}
                x2={janela.ate}
                y1={MARGEM_SUPERIOR}
                y2={MARGEM_SUPERIOR + alturaDoPlot}
                stroke="var(--azul-mar)"
                strokeWidth={2}
              />
            </>
          ) : null}

          {/* a régua da esquerda: três marcas, que é o que cabe sem poluir */}
          {[0, 0.5, 1].map((fracao) => {
            const valor =
              faixaEsquerda.minimo + fracao * (faixaEsquerda.maximo - faixaEsquerda.minimo);
            const alturaDaMarca = yEsquerda(valor);
            return (
              <g key={`e-${fracao}`}>
                <line
                  x1={MARGEM_ESQUERDA}
                  x2={largura - MARGEM_DIREITA}
                  y1={alturaDaMarca}
                  y2={alturaDaMarca}
                  stroke="var(--borda)"
                  strokeWidth={1}
                />
                <text
                  x={MARGEM_ESQUERDA - 6}
                  y={alturaDaMarca + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill="var(--cinza-2)"
                >
                  {valor.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* a régua da direita: FIXA, e por isso os rótulos são sempre os
              mesmos — é o que torna dois recortes comparáveis */}
          {[0, 50, 100].map((valor) => (
            <text
              key={`d-${valor}`}
              x={largura - MARGEM_DIREITA + 6}
              y={yDireita(valor) + 4}
              textAnchor="start"
              fontSize={11}
              fill="var(--ok-fg)"
            >
              {valor}
            </text>
          ))}

          {/* o índice, em degraus e tracejado */}
          {meses.length ? (
            <path
              d={caminhoEmDegraus(meses, x, yDireita)}
              fill="none"
              stroke="var(--ok-fg)"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          ) : null}

          {/* os bonds: um traçado por trecho contínuo, e um MARCADOR para o
              trecho de um ponto só — `M x,y` sem segmento não desenha nada, e a
              série de um pregão único ficava invisível. */}
          {series.map((serie) => (
            <g key={serie.chave}>
              <title>{serie.rotulo}</title>
              {serie.trechos.map((trecho, i) =>
                trecho.length === 1 ? (
                  <circle
                    key={i}
                    cx={x(trecho[0].ms)}
                    cy={yEsquerda(trecho[0].valor)}
                    r={3}
                    fill={serie.cor}
                  />
                ) : (
                  <path
                    key={i}
                    d={caminhoDoTrecho(trecho, x, yEsquerda)}
                    fill="none"
                    stroke={serie.cor}
                    strokeWidth={2}
                    strokeLinejoin="round"
                  />
                ),
              )}
            </g>
          ))}

          {/* o eixo x: um rótulo por mês, no máximo seis */}
          {meses
            .filter((_, i) => i % Math.ceil(Math.max(1, meses.length) / 6) === 0)
            .map((mes) => {
              const iso = new Date(mes.comeca).toISOString().slice(0, 10);
              const escolher = aoEscolherData
                ? () => aoEscolherData(ultimoDiaDoMes(iso, fim))
                : undefined;
              return (
                <text
                  key={mes.comeca}
                  data-mes={iso}
                  x={x(mes.comeca)}
                  y={altura - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fill={aoEscolherData ? 'var(--azul-mar)' : 'var(--cinza-2)'}
                  //: O RÓTULO É BOTÃO DE VERDADE quando dá para clicar: papel,
                  //: foco e tecla. Um `onClick` sozinho num `<text>` seria
                  //: inalcançável por teclado — e o eixo é justamente a porta
                  //: que ele pediu ("seja no gráfico ou seja no eixo").
                  role={aoEscolherData ? 'button' : undefined}
                  tabIndex={aoEscolherData ? 0 : undefined}
                  style={aoEscolherData ? { cursor: 'pointer' } : undefined}
                  onClick={escolher}
                  onKeyDown={
                    escolher
                      ? (evento) => {
                          if (evento.key === 'Enter' || evento.key === ' ') {
                            evento.preventDefault();
                            escolher();
                          }
                        }
                      : undefined
                  }
                >
                  {mesLegivel(iso)}
                </text>
              );
            })}

          {/* A ÁREA DE CLIQUE VEM POR ÚLTIMO, por cima de tudo: em SVG a ordem
              do documento é a ordem de pintura, e uma área de clique desenhada
              antes das curvas teria os cliques capturados por elas em cima dos
              traços. Transparente e sem traço — ela existe para receber o
              clique, não para aparecer. */}
          {aoEscolherData ? (
            <rect
              data-testid="area-de-clique"
              x={MARGEM_ESQUERDA}
              y={MARGEM_SUPERIOR}
              width={larguraDoPlot}
              height={alturaDoPlot}
              fill="transparent"
              style={{ cursor: 'crosshair' }}
              onClick={(evento) => {
                //: O PIXEL É RELATIVO AO SVG, e não à janela: o gráfico pode
                //: estar rolado ou deslocado na página.
                const svg = evento.currentTarget.ownerSVGElement;
                const caixa = svg?.getBoundingClientRect();
                const px = evento.clientX - (caixa?.left ?? 0) - MARGEM_ESQUERDA;
                aoEscolherData(dataNoPixel(px, inicio, fim, larguraDoPlot));
              }}
            />
          ) : null}
        </svg>
      ) : null}

      {/* A LEITURA É DE COINCIDÊNCIA NO TEMPO, não de causalidade — é o que a
          própria especificação afirma na seção 1, e dizê-lo na tela é o que
          impede o gráfico de dois eixos de ser lido como prova de relação. */}
      <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '8px 0 0' }}>
        {rotuloDaEsquerda} à esquerda; índice reputacional (0–100) à direita, em
        degraus porque é mensal. As curvas coincidem no tempo — o gráfico não
        afirma que uma explica a outra.
      </p>
    </div>
  );
}
