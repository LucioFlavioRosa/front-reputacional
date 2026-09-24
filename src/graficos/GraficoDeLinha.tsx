/** Gráfico de linha com um ponto (bolinha) por período — pedido para o Net
 *  Sentiment Score.
 *
 *  EIXO Y AUTOMÁTICO, não fixo em -100/+100: o NSS PODE ir de -100 a +100,
 *  mas na prática costuma oscilar bem menos que isso — e uma régua fixa
 *  nesse intervalo inteiro fazia qualquer variação real (10, 20 pontos)
 *  parecer uma linha quase reta colada no zero. A escala agora nasce do
 *  MENOR e MAIOR valor de TODAS as séries (mais uma folga de 25%), sempre
 *  incluindo o zero e nunca passando de -100/+100 — e os rótulos de eixo à
 *  esquerda (mínimo, zero, máximo) dizem exatamente que régua é essa, para
 *  a escala automática não enganar sobre o tamanho real da variação.
 *
 *  VÁRIAS SÉRIES (`series`), não uma linha só — pedido para comparar o NSS
 *  "Geral" contra o de um ou mais públicos adicionados (cada um com a
 *  própria cor). SÓ A PRIMEIRA série escreve o valor em cima de cada
 *  bolinha: com duas ou mais linhas, um número por bolinha de cada uma
 *  virava uma sopa de números sobrepostos — as demais mostram o valor só
 *  no `title` (hover). Uma legenda por fora (`Legenda`, de
 *  `BarrasEmpilhadas`) já diz qual cor é qual série.
 *
 *  SVG puro, como o resto do produto (`Rosca`, `MapaUf`, `GraficoDeArvore`):
 *  nenhuma biblioteca de gráfico entra por uma linha só.
 *
 *  `valor: null` ABRE UM VÃO na linha, não desenha um ponto em zero — a
 *  diferença entre "não houve dado nesse período" e "o placar empatou"
 *  importa demais para as duas caírem no mesmo desenho.
 *
 *  LINHA DE REFERÊNCIA (`linhaDeReferencia`) tracejada e horizontal, com o
 *  valor escrito na ponta — o comparativo "este período contra a média do
 *  recorte inteiro" que só uma segunda linha fixa consegue mostrar de cara.
 *  Ela também entra no cálculo do eixo automático, para nunca ficar fora da
 *  régua visível.
 *
 *  MEDE A LARGURA REAL DO CONTÊINER (`ResizeObserver`, mesma técnica de
 *  `GraficoDeArvore`/`FiltroDePeriodoArrastavel`).
 */

import { useEffect, useRef, useState } from 'react';
import { numero } from '@/dominio/formato';

const ALTURA_DO_ROTULO_DO_VALOR = 16;
const ALTURA_DO_EIXO = 16;
const MARGEM_ESQUERDA = 30;
const MARGEM_DIREITA = 8;
//: MESMA IDEIA de `LIMITE_DE_ROTULOS_NO_EIXO` em `BarrasEmpilhadas` — em
//: semana (dezenas de pontos), um rótulo por ponto colaria um no outro.
const LIMITE_DE_ROTULOS_NO_EIXO = 10;
//: QUANTO DE FOLGA acima do maior valor e abaixo do menor, em fração da
//: amplitude — sem isto, o ponto mais alto/baixo encostaria na borda do
//: gráfico, junto do próprio rótulo de valor dele.
const FRACAO_DE_FOLGA = 0.25;
//: AMPLITUDE MÍNIMA do eixo — um recorte com toda a série em 0 (ou muito
//: parecida) não vira uma régua de 1 ponto de altura, que exageraria
//: qualquer ruído mínimo como se fosse uma virada grande.
const AMPLITUDE_MINIMA = 10;

export interface PontoDeLinha {
  chave: string;
  /** `null` = sem dado no período — abre um vão na linha, sem ponto. */
  valor: number | null;
}

export interface SerieDeLinha {
  chave: string;
  cor: string;
  pontos: PontoDeLinha[];
}

function formatarComSinal(valor: number): string {
  return `${valor > 0 ? '+' : ''}${valor}`;
}

/** Traça `pontos` (JÁ EM PIXEL, sem vão) como uma curva suave — Catmull-Rom
 *  convertida em Bézier cúbica, o jeito padrão de curvar uma linha por
 *  PONTOS FIXOS (a curva sempre passa exatamente por cada um, diferente de
 *  uma Bézier "livre" que só usa os pontos como guia). Pedido do usuário:
 *  linhas retas entre os pontos pareciam "quebradas" demais para uma
 *  série de poucos períodos.
 *
 *  Cada segmento usa o ponto anterior e o seguinte para calcular os dois
 *  pontos de controle — nas pontas, sem vizinho, repete o próprio ponto
 *  (o jeito usual de fechar as bordas de uma Catmull-Rom). */
function caminhoSuave(pontos: { x: number; y: number }[]): string {
  if (pontos.length < 2) return pontos.length ? `M ${pontos[0].x},${pontos[0].y}` : '';

  let d = `M ${pontos[0].x},${pontos[0].y}`;
  for (let i = 0; i < pontos.length - 1; i++) {
    const anterior = pontos[i - 1] ?? pontos[i];
    const atual = pontos[i];
    const proximo = pontos[i + 1];
    const depois = pontos[i + 2] ?? proximo;

    const cp1x = atual.x + (proximo.x - anterior.x) / 6;
    const cp1y = atual.y + (proximo.y - anterior.y) / 6;
    const cp2x = proximo.x - (depois.x - atual.x) / 6;
    const cp2y = proximo.y - (depois.y - atual.y) / 6;

    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${proximo.x},${proximo.y}`;
  }
  return d;
}

/** Um trilho contínuo (sem vãos) vira uma curva suave; um `null` no meio
 *  quebra em dois pedaços, em vez de a curva saltar por cima do período
 *  que faltou. Devolve os pedaços já em pixel, para desenhar a curva E as
 *  bolinhas com as mesmas coordenadas. */
function gruposSemVao(
  pontos: PontoDeLinha[],
  xDoIndice: (indice: number) => number,
  yDoValor: (valor: number) => number,
): { x: number; y: number }[][] {
  const grupos: { x: number; y: number }[][] = [];
  let atual: { x: number; y: number }[] = [];
  pontos.forEach((ponto, indice) => {
    if (ponto.valor == null) {
      if (atual.length) grupos.push(atual);
      atual = [];
      return;
    }
    atual.push({ x: xDoIndice(indice), y: yDoValor(ponto.valor) });
  });
  if (atual.length) grupos.push(atual);
  return grupos;
}

export function GraficoDeLinha({
  series,
  altura = 170,
  minimo,
  maximo,
  formatarRotulo,
  linhaDeReferencia,
  vazio = 'Sem registros no recorte.',
}: {
  series: SerieDeLinha[];
  altura?: number;
  /** Teto/piso do eixo Y — sem isto (o padrão), a régua é automática: nasce
   *  do menor e maior valor de todas as séries (ver o comentário no topo do
   *  arquivo). Só passe um valor fixo se quiser FORÇAR a régua, ex.: para
   *  comparar dois gráficos lado a lado na mesma escala. */
  minimo?: number;
  maximo?: number;
  /** Como ler `ponto.chave` em texto — mesma função que `BarrasEmpilhadas`
   *  já recebe (`FORMATADORES_DE_ROTULO[granularidade]`). */
  formatarRotulo: (chave: string) => string;
  /** A linha tracejada horizontal de comparação — o NSS do recorte inteiro,
   *  por exemplo, contra a oscilação período a período. */
  linhaDeReferencia?: { valor: number; rotulo: string };
  vazio?: string;
}) {
  const refDoContainer = useRef<HTMLDivElement>(null);
  const [largura, definirLargura] = useState(480);

  useEffect(() => {
    const elemento = refDoContainer.current;
    if (!elemento) return;
    const observador = new ResizeObserver(([entrada]) => {
      const medida = entrada?.contentRect.width;
      if (medida) definirLargura(medida);
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  const primeira = series[0];

  if (!primeira?.pontos.length) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--cinza-2)' }}>
        {vazio}
      </div>
    );
  }

  // A RÉGUA AUTOMÁTICA — ver o comentário no topo do arquivo. Sempre inclui
  // o zero (é a referência de "equilíbrio"), e sempre a linha de
  // referência, se houver uma — ela nunca pode ficar fora do que se vê.
  const valoresConhecidos = series.flatMap((serie) =>
    serie.pontos
      .filter((ponto): ponto is { chave: string; valor: number } => ponto.valor != null)
      .map((ponto) => ponto.valor),
  );
  const paraORango = linhaDeReferencia
    ? [...valoresConhecidos, linhaDeReferencia.valor]
    : valoresConhecidos;
  const menorValor = Math.min(0, ...paraORango);
  const maiorValor = Math.max(0, ...paraORango);
  const amplitude = Math.max(AMPLITUDE_MINIMA, maiorValor - menorValor);
  const folga = Math.round(amplitude * FRACAO_DE_FOLGA);
  const minimoEfetivo = minimo ?? Math.max(-100, menorValor - folga);
  const maximoEfetivo = maximo ?? Math.min(100, maiorValor + folga);

  const alturaDoTrilho = altura - ALTURA_DO_ROTULO_DO_VALOR - ALTURA_DO_EIXO;
  const larguraUtil = Math.max(0, largura - MARGEM_ESQUERDA - MARGEM_DIREITA);

  const xDoIndice = (indice: number) =>
    primeira.pontos.length > 1
      ? MARGEM_ESQUERDA + (indice / (primeira.pontos.length - 1)) * larguraUtil
      : MARGEM_ESQUERDA + larguraUtil / 2;

  const yDoValor = (valor: number) => {
    const fracao = (valor - minimoEfetivo) / (maximoEfetivo - minimoEfetivo);
    return ALTURA_DO_ROTULO_DO_VALOR + (1 - fracao) * alturaDoTrilho;
  };

  const passoDoRotulo = Math.max(1, Math.ceil(primeira.pontos.length / LIMITE_DE_ROTULOS_NO_EIXO));

  return (
    <div ref={refDoContainer} style={{ width: '100%' }}>
      <svg
        width={largura}
        height={altura}
        role="img"
        aria-label={series
          .map(
            (serie) =>
              `${serie.chave}: ${serie.pontos
                .map((p) => `${formatarRotulo(p.chave)} ${p.valor == null ? 'sem dado' : numero(p.valor)}`)
                .join(', ')}`,
          )
          .join(' — ')}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* OS RÓTULOS DA RÉGUA — máximo, zero e mínimo, à esquerda. Sem eles
            a escala automática (ver o comentário no topo do arquivo) não
            diria que intervalo está desenhado. */}
        <text x={MARGEM_ESQUERDA - 6} y={yDoValor(maximoEfetivo) + 3} textAnchor="end" fontSize={10} fill="var(--cinza-2)">
          {formatarComSinal(maximoEfetivo)}
        </text>
        <text x={MARGEM_ESQUERDA - 6} y={yDoValor(0) + 3} textAnchor="end" fontSize={10} fill="var(--cinza-2)">
          0
        </text>
        <text x={MARGEM_ESQUERDA - 6} y={yDoValor(minimoEfetivo) + 3} textAnchor="end" fontSize={10} fill="var(--cinza-2)">
          {formatarComSinal(minimoEfetivo)}
        </text>

        {/* A LINHA DE ZERO — "equilíbrio", a mesma referência de
            `BarraDivergente`. */}
        <line
          x1={MARGEM_ESQUERDA - 4}
          y1={yDoValor(0)}
          x2={largura}
          y2={yDoValor(0)}
          stroke="var(--borda-input)"
          strokeWidth={1}
        />

        {linhaDeReferencia ? (
          <>
            <line
              x1={MARGEM_ESQUERDA - 4}
              y1={yDoValor(linhaDeReferencia.valor)}
              x2={largura}
              y2={yDoValor(linhaDeReferencia.valor)}
              stroke="var(--cinza-2)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
            <text
              x={largura - 4}
              y={yDoValor(linhaDeReferencia.valor) - 4}
              textAnchor="end"
              fontSize={10.5}
              fontWeight={700}
              fill="var(--cinza-2)"
            >
              {linhaDeReferencia.rotulo}: {formatarComSinal(linhaDeReferencia.valor)}
            </text>
          </>
        ) : null}

        {series.map((serie, indiceDaSerie) => {
          const grupos = gruposSemVao(serie.pontos, xDoIndice, yDoValor);
          const mostrarValores = indiceDaSerie === 0;
          return (
            <g key={serie.chave}>
              {grupos.map((grupo, indice) => (
                <path
                  key={indice}
                  d={caminhoSuave(grupo)}
                  fill="none"
                  stroke={serie.cor}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
              ))}
              {serie.pontos.map((ponto, indice) => {
                if (ponto.valor == null) return null;
                const x = xDoIndice(indice);
                const y = yDoValor(ponto.valor);
                return (
                  <g key={ponto.chave}>
                    <circle cx={x} cy={y} r={3.5} fill={serie.cor}>
                      <title>{`${serie.chave} · ${formatarRotulo(ponto.chave)}: ${formatarComSinal(ponto.valor)}`}</title>
                    </circle>
                    {mostrarValores ? (
                      <text
                        x={x}
                        y={y - 8}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight={600}
                        className="tabular"
                        fill="var(--cinza-3)"
                      >
                        {formatarComSinal(ponto.valor)}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          );
        })}

        {primeira.pontos.map((ponto, indice) => {
          if (indice % passoDoRotulo !== 0 && indice !== primeira.pontos.length - 1) return null;
          return (
            <text
              key={ponto.chave}
              x={xDoIndice(indice)}
              y={altura - 3}
              textAnchor="middle"
              fontSize={10.5}
              fill="var(--cinza-2)"
            >
              {formatarRotulo(ponto.chave)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
