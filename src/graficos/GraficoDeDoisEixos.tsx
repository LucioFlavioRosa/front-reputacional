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
 *  2. SÃO DUAS RÉGUAS, E AS DUAS SE AJUSTAM. Desde 21/10/2026, por pedido: a
 *     da esquerda nasce dos bonds visíveis no período, a da direita do score
 *     (múltiplos de 10, dentro de 0 a 100), e cada uma aceita zoom à mão,
 *     "estilo think-cell" — botões +/−/Auto, roda do mouse e arraste sobre a
 *     régua. As contas estão em `dominio/cotacoesDosBonds`.
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
import type { PointerEvent as ReactPointerEvent } from 'react';

import type { Escala, Faixa } from '@/dominio/cotacoesDosBonds';
import {
  aproximar,
  dataPorExtensoCurto,
  deslocar,
  escalaAutomatica,
  escalaDaFaixa,
  escalaDoScore,
  espalharEtiquetas,
  prender,
  rotuloDaMarca,
  rotulosDoTempo,
} from '@/dominio/cotacoesDosBonds';

const MARGEM_ESQUERDA = 52;
//: LARGA DE PROPÓSITO: cabem a etiqueta do último valor e, depois dela, a régua
//: do score.
const MARGEM_DIREITA = 84;
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

/** Uma curva MENSAL no eixo direito — o índice, ou a nota de uma lente.
 *
 *  SÃO VÁRIAS DESDE 20/10/2026, por pedido: o gráfico mostrava só o índice
 *  geral, e agora mostra também a nota da Imprensa, do Mercado e da
 *  Institucional, uma a uma, conforme os botões da tela.
 *
 *  TODAS NA MESMA RÉGUA (0–100) e todas em DEGRAUS tracejados, porque todas
 *  têm a mesma natureza: um valor por mês, ao lado de um bond que tem pregão
 *  diário. O degrau é o que diz isso na própria forma. */
export interface SerieMensal {
  chave: string;
  rotulo: string;
  cor: string;
  /** O tracejado desta curva (`stroke-dasharray`).
   *
   *  A COR NÃO PODE SER A ÚNICA PISTA quando há quatro linhas no mesmo eixo:
   *  quem não separa matiz — ou quem imprime em preto e branco — veria quatro
   *  curvas iguais. O padrão mantém o tracejado que o índice sempre teve. */
  traco?: string;
  pontos: PontoMensal[];
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

/** O valor vigente de uma curva mensal num instante: o do degrau que o cobre. */
function valorNoInstante(
  degraus: { comeca: number; termina: number; valor: number }[],
  ms: number,
): number | null {
  for (const degrau of degraus) {
    if (ms >= degrau.comeca && ms < degrau.termina) return degrau.valor;
  }
  return null;
}

/** O ponto do trecho mais perto de `ms`, se estiver a até `tolerancia` dias. */
function pontoMaisPerto(
  pontos: { ms: number; valor: number }[],
  ms: number,
  tolerancia = 5,
): { ms: number; valor: number } | null {
  let melhor: { ms: number; valor: number } | null = null;
  for (const ponto of pontos) {
    if (!melhor || Math.abs(ponto.ms - ms) < Math.abs(melhor.ms - ms)) melhor = ponto;
  }
  return melhor && Math.abs(melhor.ms - ms) <= tolerancia * UM_DIA ? melhor : null;
}

/** Os três controles de um eixo: aproximar, afastar e voltar ao automático. */
function ControlesDoEixo({
  rotulo,
  manual,
  aoAproximar,
  aoAfastar,
  aoAutomatico,
  alinhar,
}: {
  rotulo: string;
  manual: boolean;
  aoAproximar: () => void;
  aoAfastar: () => void;
  aoAutomatico: () => void;
  alinhar: 'esquerda' | 'direita';
}) {
  const estilo = {
    width: 26,
    height: 24,
    border: '1px solid var(--borda-input)',
    background: 'var(--branco)',
    color: 'var(--azul-mar)',
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1,
    cursor: 'pointer',
    padding: 0,
  } as const;
  return (
    <div
      role="group"
      aria-label={`Escala do eixo ${rotulo}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexDirection: alinhar === 'direita' ? 'row-reverse' : 'row',
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cinza-3)' }}>{rotulo}</span>
      <span style={{ display: 'inline-flex' }}>
        <button
          type="button"
          aria-label={`Afastar o eixo ${rotulo}`}
          title="Afastar (mostra uma faixa maior)"
          onClick={aoAfastar}
          style={{ ...estilo, borderRadius: '4px 0 0 4px' }}
        >
          −
        </button>
        <button
          type="button"
          aria-label={`Aproximar o eixo ${rotulo}`}
          title="Aproximar (mostra uma faixa menor)"
          onClick={aoAproximar}
          style={{ ...estilo, marginLeft: -1, borderRadius: '0 4px 4px 0' }}
        >
          +
        </button>
      </span>
      <button
        type="button"
        aria-pressed={!manual}
        title="Escala automática, ajustada ao período"
        onClick={aoAutomatico}
        style={{
          height: 24,
          padding: '0 8px',
          border: `1px solid ${manual ? 'var(--borda-input)' : 'var(--azul-mar)'}`,
          borderRadius: 4,
          background: manual ? 'var(--branco)' : 'var(--azul-mar)',
          color: manual ? 'var(--azul-mar)' : 'var(--branco)',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Auto
      </button>
    </div>
  );
}

/** Quanto um clique em +/− aproxima ou afasta. */
const PASSO_DO_ZOOM = 0.8;

export function GraficoDeDoisEixos({
  bonds,
  indice,
  rotuloDaEsquerda,
  rotuloDaDireita = 'Score',
  inicioDoPeriodo = null,
  fimDoPeriodo = null,
  formatarValor = (valor) => valor.toFixed(1).replace('.', ','),
  apoio = 'Preço em % do valor de face, fechamento diário. Score de 0 a 100. Coincidência no tempo não indica causa.',
  chaveDaEscala = '',
  altura = 340,
  vazio = 'Sem cotação no período.',
  aoEscolherData,
  dataEscolhida = null,
  diasDaJanela = 15,
}: {
  bonds: SerieDatada[];
  /** As curvas mensais do eixo direito. Vazio, o eixo continua existindo e
   *  nenhuma linha é desenhada — é o caso de quem desligou todas. */
  indice: SerieMensal[];
  /** "Preço (% do par)" ou "Yield (%)" — o que o eixo esquerdo mede. */
  rotuloDaEsquerda: string;
  rotuloDaDireita?: string;
  /** O primeiro dia do período escolhido (`YYYY-MM-DD`), ou `null` = desde o
   *  começo dos dados. O FIM é sempre o último pregão: o eixo X vai do começo
   *  do período ao último dado, sem sobra em branco nas pontas. */
  inicioDoPeriodo?: string | null;
  /** O último dia do período (`YYYY-MM-DD`), quando a janela do navegador não
   *  vai até o último pregão. `null` = o último dado. */
  fimDoPeriodo?: string | null;
  /** O valor de um bond no tooltip e na etiqueta da borda. */
  formatarValor?: (valor: number) => string;
  /** O texto de apoio embaixo do gráfico. */
  apoio?: string;
  /** Quando muda (período, métrica), o zoom à mão volta ao automático: uma
   *  faixa escolhida para o yield não serve para o preço. */
  chaveDaEscala?: string;
  altura?: number;
  vazio?: string;
  /** Escolher um dia clicando no gráfico ou num rótulo do eixo.
   *
   *  OMITIDA, O GRÁFICO NÃO FICA CLICÁVEL — e isso é de propósito: as outras
   *  telas montam este componente e não devem ganhar uma área de clique
   *  invisível, nem um cursor de mãozinha prometendo interação que não existe. */
  aoEscolherData?: (iso: string) => void;
  /** O dia escolhido, para o gráfico marcá-lo. */
  dataEscolhida?: string | null;
  /** Quantos dias a janela cobre, só para sombreá-la. A conta de verdade é do
   *  servidor (ver `impacto_por_n2_na_janela`); aqui é desenho. */
  diasDaJanela?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [largura, definirLargura] = useState(0);
  //: O ZOOM À MÃO DE CADA EIXO, "estilo think-cell": `null` é automático.
  //: Independentes de propósito — aproximar o preço não mexe no score.
  const [manualEsquerda, definirManualEsquerda] = useState<Faixa | null>(null);
  const [manualDireita, definirManualDireita] = useState<Faixa | null>(null);
  //: TROCAR PERÍODO OU MÉTRICA VOLTA AO AUTOMÁTICO, ajustado na renderização
  //: (e não num efeito, que pintaria um quadro com a faixa velha).
  const [chaveAnterior, definirChaveAnterior] = useState(chaveDaEscala);
  if (chaveAnterior !== chaveDaEscala) {
    definirChaveAnterior(chaveDaEscala);
    definirManualEsquerda(null);
    definirManualDireita(null);
  }
  const [hover, definirHover] = useState<number | null>(null);
  const arrasto = useRef<{ eixo: 'esquerda' | 'direita'; y: number; faixa: Faixa } | null>(null);

  //: MEDE A LARGURA REAL, mesma técnica de `GraficoDeLinha` e
  //: `GraficoDeArvore`: sem isto o SVG nasce com uma largura adivinhada e o
  //: último ponto fica fora da área visível em telas estreitas.
  useEffect(() => {
    const alvo = container.current;
    if (!alvo) return;
    const observador = new ResizeObserver((entradas) => {
      //: A LISTA PODE VIR VAZIA, e `entradas[0].contentRect` então lança DENTRO
      //: do callback do observador — fora da renderização, onde o
      //: `LimiteDeErro` não alcança. Achado de revisão, defensivo e barato.
      const entrada = entradas[0];
      if (!entrada) return;
      definirLargura(entrada.contentRect.width);
    });
    observador.observe(alvo);
    return () => observador.disconnect();
  }, []);

  //: UMA TRANSFORMAÇÃO SÓ, e duas vistas dela: `series` é o que se DESENHA e
  //: `comTrechos` é o que se DESCREVE (inclui quem não tem ponto).
  const comTrechos = bonds.map((s) => ({ ...s, trechos: trechos(datados(s.pontos)) }));
  const series = comTrechos.filter((s) => s.trechos.length > 0);

  const mensais = indice.map((serie) => ({
    ...serie,
    degraus: mesesDoIndice(serie.pontos),
  }));
  //: UM MÊS SÓ APARECE UMA VEZ (achado ALTO de revisão): juntar os degraus de
  //: quatro curvas repetia cada mês quatro vezes na lista.
  const meses = [...new Map(mensais.flatMap((s) => s.degraus).map((m) => [m.comeca, m])).values()].sort(
    (a, b) => a.comeca - b.comeca,
  );

  //: O EIXO X VAI DO COMEÇO DO PERÍODO AO ÚLTIMO PREGÃO, e é o pedido: "as
  //: séries começam e terminam em datas diferentes e o gráfico sobra em branco
  //: nas pontas". O degrau do score de um mês que passa do último pregão é
  //: CORTADO na borda (clipPath), em vez de esticar o eixo para caber nele.
  //: Sem bond nenhum, o eixo é o dos meses do score, como antes.
  const datasDosBonds = series.flatMap((s) => s.trechos.flatMap((t) => t.map((p) => p.ms)));
  const corte = inicioDoPeriodo ? emMilissegundos(inicioDoPeriodo) : null;
  const primeiroDado = datasDosBonds.length
    ? Math.min(...datasDosBonds)
    : meses.length
      ? meses[0].comeca
      : 0;
  const ultimoDado = datasDosBonds.length
    ? Math.max(...datasDosBonds)
    : meses.length
      ? meses[meses.length - 1].termina
      : 1;
  //: O CORTE NUNCA ANTES DO PRIMEIRO DADO: "12M" num papel emitido há seis
  //: meses começa no primeiro pregão dele, sem meio gráfico em branco.
  const inicio = corte !== null ? Math.max(corte, primeiroDado) : primeiroDado;
  const corteFinal = fimDoPeriodo ? emMilissegundos(fimDoPeriodo) : null;
  const fim = Math.max(corteFinal !== null ? Math.min(ultimoDado, corteFinal) : ultimoDado, inicio + UM_DIA);
  const intervalo = Math.max(1, fim - inicio);
  const visivel = (ms: number) => ms >= inicio && ms <= fim;

  //: OS EIXOS Y NASCEM DO QUE ESTÁ VISÍVEL: só os pontos dentro do período, e
  //: só os bonds e scores ligados. É o zoom que o pedido descreve.
  const valoresVisiveis = series.flatMap((s) =>
    s.trechos.flatMap((t) => t.filter((p) => visivel(p.ms)).map((p) => p.valor)),
  );
  const valoresDoScore = mensais.flatMap((s) =>
    s.degraus.filter((d) => d.termina > inicio && d.comeca <= fim).map((d) => d.valor),
  );
  const automaticaEsquerda: Escala = escalaAutomatica(valoresVisiveis) ?? {
    minimo: 0,
    maximo: 100,
    passo: 20,
    marcas: [0, 20, 40, 60, 80, 100],
  };
  const automaticaDireita = escalaDoScore(valoresDoScore);
  const escalaEsquerda = manualEsquerda ? escalaDaFaixa(manualEsquerda) : automaticaEsquerda;
  const escalaDireita = manualDireita ? escalaDaFaixa(manualDireita) : automaticaDireita;

  const alturaDoPlot = altura - MARGEM_SUPERIOR - ALTURA_DO_EIXO_X;
  const larguraDoPlot = Math.max(1, largura - MARGEM_ESQUERDA - MARGEM_DIREITA);
  const direitaDoPlot = MARGEM_ESQUERDA + larguraDoPlot;

  const x = (ms: number) => MARGEM_ESQUERDA + ((ms - inicio) / intervalo) * larguraDoPlot;
  const yEsquerda = (valor: number) =>
    MARGEM_SUPERIOR +
    alturaDoPlot *
      (1 - (valor - escalaEsquerda.minimo) / (escalaEsquerda.maximo - escalaEsquerda.minimo));
  const yDireita = (valor: number) =>
    MARGEM_SUPERIOR +
    alturaDoPlot *
      (1 - (valor - escalaDireita.minimo) / (escalaDireita.maximo - escalaDireita.minimo));

  /** O zoom de um eixo: aproximar (`fator < 1`) ou afastar, em volta de um valor. */
  const zoom = (eixo: 'esquerda' | 'direita', fator: number, centro?: number) => {
    if (eixo === 'esquerda') {
      definirManualEsquerda(aproximar(escalaEsquerda, fator, centro));
    } else {
      //: O SCORE NÃO SAI DE 0 A 100, nem afastando.
      definirManualDireita(prender(aproximar(escalaDireita, fator, centro), 0, 100));
    }
  };

  //: A RODA DO MOUSE SOBRE A RÉGUA APROXIMA E AFASTA, em volta do valor sob o
  //: cursor — o gesto do think-cell. Ouvinte NATIVO e não `onWheel`: o React
  //: registra a roda como passiva, e aí não dá para impedir a página de rolar.
  //: A REF GUARDA A VERSÃO ATUAL do tratador, para o ouvinte, registrado uma
  //: vez só, não ler escalas de uma renderização antiga.
  const aoRolar = useRef<(evento: WheelEvento) => void>(() => {});
  const tratarRoda = (evento: WheelEvento) => {
    const caixa = svg.current?.getBoundingClientRect();
    if (!caixa) return;
    const px = evento.clientX - caixa.left;
    const py = evento.clientY - caixa.top;
    const eixo = px < MARGEM_ESQUERDA ? 'esquerda' : px > direitaDoPlot ? 'direita' : null;
    if (!eixo || py < MARGEM_SUPERIOR || py > MARGEM_SUPERIOR + alturaDoPlot) return;
    evento.preventDefault();
    const escala = eixo === 'esquerda' ? escalaEsquerda : escalaDireita;
    const fracao = 1 - (py - MARGEM_SUPERIOR) / alturaDoPlot;
    const centro = escala.minimo + fracao * (escala.maximo - escala.minimo);
    zoom(eixo, evento.deltaY < 0 ? PASSO_DO_ZOOM : 1 / PASSO_DO_ZOOM, centro);
  };
  //: A REF É ESCRITA NUM EFEITO, e não na renderização (regra do React).
  useEffect(() => {
    aoRolar.current = tratarRoda;
  });
  useEffect(() => {
    const alvo = svg.current;
    if (!alvo) return;
    const ouvir = (evento: WheelEvent) => aoRolar.current(evento);
    alvo.addEventListener('wheel', ouvir, { passive: false });
    return () => alvo.removeEventListener('wheel', ouvir);
  }, [largura]);

  if (series.length === 0 && meses.length === 0) {
    return (
      <div ref={container}>
        <p style={{ color: 'var(--cinza-2)', fontSize: 13, margin: 0 }}>{vazio}</p>
      </div>
    );
  }

  /** Onde desenhar a faixa da janela, em pixels — `null` sem data escolhida.
   *  PRESO AO EIXO nas duas pontas. */
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

  /** O que um leitor de tela ouve: quais séries, com as pontas e o período. */
  const descricao = [
    `${rotuloDaEsquerda} e ${rotuloDaDireita.toLowerCase()} de 0 a 100.`,
    ...comTrechos.map((s) => {
      const pontos = s.trechos.flat().filter((p) => visivel(p.ms));
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

  //: AS ETIQUETAS DO ÚLTIMO VALOR, na borda direita do plot, sem sobreposição.
  const ultimos = [
    ...series.map((s) => {
      const pontos = s.trechos.flat().filter((p) => visivel(p.ms));
      const ultimo = pontos[pontos.length - 1];
      return ultimo
        ? { chave: s.chave, cor: s.cor, y: yEsquerda(ultimo.valor), texto: formatarValor(ultimo.valor) }
        : null;
    }),
    ...mensais.map((s) => {
      const valor = valorNoInstante(s.degraus, fim);
      const ultimoDegrau = s.degraus.filter((d) => d.comeca <= fim).at(-1);
      const v = valor ?? ultimoDegrau?.valor ?? null;
      return v === null ? null : { chave: s.chave, cor: s.cor, y: yDireita(v), texto: String(Math.round(v)) };
    }),
  ].filter((e): e is { chave: string; cor: string; y: number; texto: string } => e !== null);
  const baseDoPlot = MARGEM_SUPERIOR + alturaDoPlot;
  const ysDasEtiquetas = espalharEtiquetas(
    ultimos.map((e) => Math.min(baseDoPlot, Math.max(MARGEM_SUPERIOR, e.y))),
    16,
    MARGEM_SUPERIOR + 6,
    baseDoPlot - 6,
  );

  //: O HOVER: a linha na data, um ponto em cada série visível e o tooltip.
  const instante = hover;
  const linhasDoTooltip =
    instante === null
      ? []
      : [
          ...series.map((s) => {
            const ponto = pontoMaisPerto(s.trechos.flat(), instante);
            return ponto
              ? { chave: s.chave, cor: s.cor, nome: s.rotulo, texto: formatarValor(ponto.valor), y: yEsquerda(ponto.valor), ms: ponto.ms }
              : null;
          }),
          ...mensais.map((s) => {
            const valor = valorNoInstante(s.degraus, instante);
            return valor === null
              ? null
              : { chave: s.chave, cor: s.cor, nome: s.rotulo, texto: String(Math.round(valor)), y: yDireita(valor), ms: instante };
          }),
        ].filter(
          (l): l is { chave: string; cor: string; nome: string; texto: string; y: number; ms: number } =>
            l !== null,
        );

  const rotulos = rotulosDoTempo(inicio, fim);
  const pxDoHover = instante === null ? 0 : x(instante);

  /** O pixel horizontal do evento, relativo ao começo do plot. */
  const pxNoPlot = (evento: { clientX: number; currentTarget: Element }) =>
    evento.clientX - evento.currentTarget.getBoundingClientRect().left - MARGEM_ESQUERDA;

  const comecarArrasto = (eixo: 'esquerda' | 'direita') => (evento: ReactPointerEvent<SVGRectElement>) => {
    evento.currentTarget.setPointerCapture?.(evento.pointerId);
    arrasto.current = { eixo, y: evento.clientY, faixa: eixo === 'esquerda' ? escalaEsquerda : escalaDireita };
  };
  const arrastar = (evento: ReactPointerEvent<SVGRectElement>) => {
    const atual = arrasto.current;
    if (!atual) return;
    //: ARRASTAR PARA BAIXO DESCE AS CURVAS: a faixa sobe na mesma medida.
    const delta = ((evento.clientY - atual.y) / alturaDoPlot) * (atual.faixa.maximo - atual.faixa.minimo);
    const nova = deslocar(atual.faixa, delta);
    if (atual.eixo === 'esquerda') definirManualEsquerda(nova);
    else definirManualDireita(prender(nova, 0, 100));
  };
  const soltar = () => {
    arrasto.current = null;
  };

  return (
    <div ref={container} style={{ width: '100%', position: 'relative' }}>
      {/* OS CONTROLES DE CADA EIXO, em cima da régua dele. */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 6,
        }}
      >
        <ControlesDoEixo
          rotulo={rotuloDaEsquerda}
          manual={manualEsquerda !== null}
          aoAproximar={() => zoom('esquerda', PASSO_DO_ZOOM)}
          aoAfastar={() => zoom('esquerda', 1 / PASSO_DO_ZOOM)}
          aoAutomatico={() => definirManualEsquerda(null)}
          alinhar="esquerda"
        />
        <ControlesDoEixo
          rotulo={rotuloDaDireita}
          manual={manualDireita !== null}
          aoAproximar={() => zoom('direita', PASSO_DO_ZOOM)}
          aoAfastar={() => zoom('direita', 1 / PASSO_DO_ZOOM)}
          aoAutomatico={() => definirManualDireita(null)}
          alinhar="direita"
        />
      </div>

      {largura > 0 ? (
        <svg
          ref={svg}
          width={largura}
          height={altura}
          role="img"
          aria-label={descricao}
          style={aoEscolherData ? { cursor: 'crosshair', display: 'block' } : { display: 'block' }}
          onMouseMove={(evento) => {
            const px = pxNoPlot(evento);
            if (px < 0 || px > larguraDoPlot) {
              definirHover(null);
              return;
            }
            definirHover(inicio + (px / larguraDoPlot) * intervalo);
          }}
          onMouseLeave={() => definirHover(null)}
          onClick={
            aoEscolherData
              ? (evento) => {
                  const px = pxNoPlot(evento);
                  //: FORA DO PLOT NÃO ESCOLHE NADA: as réguas são de zoom.
                  if (px < 0 || px > larguraDoPlot) return;
                  aoEscolherData(dataNoPixel(px, inicio, fim, larguraDoPlot));
                }
              : undefined
          }
        >
          <defs>
            <clipPath id="recorte-do-plot">
              <rect x={MARGEM_ESQUERDA} y={MARGEM_SUPERIOR} width={larguraDoPlot} height={alturaDoPlot} />
            </clipPath>
          </defs>

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
                y2={baseDoPlot}
                stroke="var(--azul-mar)"
                strokeWidth={2}
              />
            </>
          ) : null}

          {/* A RÉGUA DA ESQUERDA: marcas redondas, com a grade. */}
          {escalaEsquerda.marcas.map((valor) => {
            const y = yEsquerda(valor);
            return (
              <g key={`e-${valor}`} data-marca-esquerda={valor}>
                <line
                  x1={MARGEM_ESQUERDA}
                  x2={direitaDoPlot}
                  y1={y}
                  y2={y}
                  stroke="var(--bg-trilho)"
                  strokeWidth={1}
                />
                <text x={MARGEM_ESQUERDA - 8} y={y + 4} textAnchor="end" fontSize={12} fill="var(--cinza-2)">
                  {rotuloDaMarca(valor, escalaEsquerda.passo)}
                </text>
              </g>
            );
          })}

          {/* A RÉGUA DA DIREITA: o score, em múltiplos de 10. */}
          {escalaDireita.marcas.map((valor) => (
            <text
              key={`d-${valor}`}
              data-marca-direita={valor}
              x={direitaDoPlot + 46}
              y={yDireita(valor) + 4}
              textAnchor="start"
              fontSize={12}
              fill="var(--ok-fg)"
            >
              {rotuloDaMarca(valor, escalaDireita.passo)}
            </text>
          ))}

          <g clipPath="url(#recorte-do-plot)">
            {/* AS CURVAS MENSAIS, tracejadas e em degraus. */}
            {mensais.map((serie) =>
              serie.degraus.length ? (
                <g key={serie.chave} data-mensal={serie.chave}>
                  <title>{serie.rotulo}</title>
                  <path
                    d={caminhoEmDegraus(serie.degraus, x, yDireita)}
                    fill="none"
                    stroke={serie.cor}
                    strokeWidth={2}
                    strokeDasharray={serie.traco ?? '6 4'}
                  />
                </g>
              ) : null,
            )}

            {/* os bonds: um traçado por trecho contínuo, e um MARCADOR para o
                trecho de um ponto só. */}
            {series.map((serie) => (
              <g key={serie.chave}>
                <title>{serie.rotulo}</title>
                {serie.trechos.map((trecho, i) =>
                  trecho.length === 1 ? (
                    <circle key={i} cx={x(trecho[0].ms)} cy={yEsquerda(trecho[0].valor)} r={3} fill={serie.cor} />
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
          </g>

          {/* O HOVER: linha vertical e um ponto por série. */}
          {instante !== null ? (
            <g data-testid="hover" pointerEvents="none">
              <line x1={pxDoHover} x2={pxDoHover} y1={MARGEM_SUPERIOR} y2={baseDoPlot} stroke="#191B23" strokeOpacity={0.3} />
              {linhasDoTooltip
                .filter((l) => l.y >= MARGEM_SUPERIOR && l.y <= baseDoPlot)
                .map((l) => (
                  <rect
                    key={l.chave}
                    x={x(l.ms) - 4.5}
                    y={l.y - 4.5}
                    width={9}
                    height={9}
                    rx={4.5}
                    fill={l.cor}
                    stroke="var(--branco)"
                    strokeWidth={2}
                  />
                ))}
            </g>
          ) : null}

          {/* AS ETIQUETAS DO ÚLTIMO VALOR, na borda direita, sem sobreposição. */}
          {ultimos.map((etiqueta, i) => (
            <g key={`u-${etiqueta.chave}`} data-ultimo={etiqueta.chave} pointerEvents="none">
              <rect
                x={direitaDoPlot + 4}
                y={ysDasEtiquetas[i] - 8}
                width={38}
                height={16}
                rx={3}
                fill={etiqueta.cor}
              />
              <text
                x={direitaDoPlot + 23}
                y={ysDasEtiquetas[i] + 4}
                textAnchor="middle"
                fontSize={11}
                fontWeight={800}
                fill="#FFFFFF"
              >
                {etiqueta.texto}
              </text>
            </g>
          ))}

          {/* AS RÉGUAS SÃO DE ZOOM: arrastar move a faixa. A roda aproxima e
              afasta, pelo ouvinte nativo lá em cima. */}
          <rect
            data-testid="regua-esquerda"
            x={0}
            y={MARGEM_SUPERIOR}
            width={MARGEM_ESQUERDA}
            height={alturaDoPlot}
            fill="transparent"
            style={{ cursor: 'ns-resize' }}
            onPointerDown={comecarArrasto('esquerda')}
            onPointerMove={arrastar}
            onPointerUp={soltar}
            onPointerCancel={soltar}
            onClick={(evento) => evento.stopPropagation()}
          >
            <title>Role para aproximar ou afastar; arraste para mover</title>
          </rect>
          <rect
            data-testid="regua-direita"
            x={direitaDoPlot}
            y={MARGEM_SUPERIOR}
            width={MARGEM_DIREITA}
            height={alturaDoPlot}
            fill="transparent"
            style={{ cursor: 'ns-resize' }}
            onPointerDown={comecarArrasto('direita')}
            onPointerMove={arrastar}
            onPointerUp={soltar}
            onPointerCancel={soltar}
            onClick={(evento) => evento.stopPropagation()}
          >
            <title>Role para aproximar ou afastar; arraste para mover</title>
          </rect>

          {/* O EIXO X: dia até dois meses, mês acima disso. */}
          {rotulos.map((rotulo) => {
            const escolher = aoEscolherData
              ? (evento?: { stopPropagation: () => void }) => {
                  evento?.stopPropagation();
                  aoEscolherData(rotulo.mensal ? ultimoDiaDoMes(rotulo.iso, fim) : rotulo.iso);
                }
              : undefined;
            return (
              <text
                key={rotulo.ms}
                data-mes={rotulo.iso}
                x={x(rotulo.ms)}
                y={altura - 6}
                //: NAS PONTAS, O RÓTULO CRESCE PARA DENTRO: centrado, o "21/08"
                //: da borda esquerda encostava no número da régua.
                textAnchor={
                  x(rotulo.ms) - MARGEM_ESQUERDA < 20
                    ? 'start'
                    : direitaDoPlot - x(rotulo.ms) < 20
                      ? 'end'
                      : 'middle'
                }
                fontSize={12}
                fill={aoEscolherData ? 'var(--azul-mar)' : 'var(--cinza-2)'}
                role={aoEscolherData ? 'button' : undefined}
                tabIndex={aoEscolherData ? 0 : undefined}
                style={aoEscolherData ? { cursor: 'pointer' } : undefined}
                onClick={escolher}
                onKeyDown={
                  escolher
                    ? (evento) => {
                        if (evento.key === 'Enter' || evento.key === ' ') {
                          evento.preventDefault();
                          escolher(evento);
                        }
                      }
                    : undefined
                }
              >
                {rotulo.texto}
              </text>
            );
          })}
        </svg>
      ) : null}

      {/* O TOOLTIP: data por extenso curto e o valor de cada série visível.
          Troca de lado perto da borda direita, e some ao sair do gráfico. */}
      {instante !== null && linhasDoTooltip.length ? (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            top: 40,
            left: pxDoHover,
            transform:
              pxDoHover > largura * 0.6 ? 'translateX(calc(-100% - 14px))' : 'translateX(14px)',
            width: 230,
            background: 'var(--branco)',
            border: '1px solid var(--borda)',
            borderRadius: 4,
            boxShadow: '0 4px 14px rgba(25,27,35,.16)',
            padding: '10px 12px',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {dataPorExtensoCurto(new Date(instante).toISOString())}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
            {linhasDoTooltip.map((linha) => (
              <div key={linha.chave} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: linha.cor, flex: '0 0 auto' }} />
                <span style={{ flex: 1, color: 'var(--cinza-3)' }}>{linha.nome}</span>
                <b className="tabular">{linha.texto}</b>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '8px 0 0' }}>{apoio}</p>
    </div>
  );
}

type WheelEvento = Pick<WheelEvent, 'clientX' | 'clientY' | 'deltaY' | 'preventDefault'>;
