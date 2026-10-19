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

function emMilissegundos(iso: string): number {
  //: `T00:00:00Z` EXPLÍCITO: `new Date('2026-01-05')` já é UTC, mas
  //: `new Date('2026-01-05T00:00:00')` é local — e a diferença de fuso move o
  //: ponto um dia inteiro no eixo. Fixar o sufixo tira a ambiguidade.
  return Date.parse(`${iso}T00:00:00Z`);
}

/** O traçado de uma série datada, quebrado nos vãos grandes. */
function caminhoDatado(
  pontos: PontoDatado[],
  x: (ms: number) => number,
  y: (valor: number) => number,
): string {
  let d = '';
  let anterior: number | null = null;
  for (const ponto of pontos) {
    const ms = emMilissegundos(ponto.data);
    const quebra = anterior === null || ms - anterior > DIAS_PARA_QUEBRAR * UM_DIA;
    d += `${quebra ? 'M' : 'L'} ${x(ms).toFixed(1)},${y(ponto.valor).toFixed(1)} `;
    anterior = ms;
  }
  return d.trim();
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
function caminhoEmDegraus(
  pontos: PontoMensal[],
  x: (ms: number) => number,
  y: (valor: number) => number,
  fimDoEixo: number,
): string {
  const comValor = pontos.filter(
    (p): p is PontoMensal & { valor: number } => p.valor != null,
  );
  if (comValor.length === 0) return '';

  let d = '';
  let fimDoAnterior: number | null = null;
  comValor.forEach((ponto, i) => {
    const comeca = emMilissegundos(ponto.mes);
    const ehOUltimo = i === comValor.length - 1;
    const termina = ehOUltimo ? Math.max(fimDoEixo, comeca) : mesSeguinte(ponto.mes);
    const altura = y(ponto.valor).toFixed(1);
    //: EMENDA SÓ QUANDO O MÊS ANTERIOR TERMINA ONDE ESTE COMEÇA. Qualquer
    //: buraco de calendário quebra o traçado, e o vão é a informação.
    d += `${fimDoAnterior === comeca ? 'L' : 'M'} ${x(comeca).toFixed(1)},${altura} `;
    d += `L ${x(termina).toFixed(1)},${altura} `;
    fimDoAnterior = termina;
  });
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
  altura = 320,
  vazio = 'Sem cotação no período.',
}: {
  bonds: SerieDatada[];
  indice: PontoMensal[];
  /** "Preço (% do par)" ou "Yield (%)" — o que o eixo esquerdo mede. */
  rotuloDaEsquerda: string;
  altura?: number;
  vazio?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [largura, definirLargura] = useState(0);

  //: MEDE A LARGURA REAL, mesma técnica de `GraficoDeLinha` e
  //: `GraficoDeArvore`: sem isto o SVG nasce com uma largura adivinhada e o
  //: último ponto fica fora da área visível em telas estreitas.
  useEffect(() => {
    const alvo = container.current;
    if (!alvo) return;
    const observador = new ResizeObserver(([entrada]) => {
      definirLargura(entrada.contentRect.width);
    });
    observador.observe(alvo);
    return () => observador.disconnect();
  }, []);

  const comPontos = bonds.filter((s) => s.pontos.length > 0);
  const todosOsValores = comPontos.flatMap((s) => s.pontos.map((p) => p.valor));
  const faixaEsquerda = dominioDosBonds(todosOsValores);
  const faixaDireita = faixaDoIndice();

  const datas = comPontos.flatMap((s) => s.pontos.map((p) => emMilissegundos(p.data)));
  const dosMeses = indice
    .filter((p) => p.valor != null)
    .map((p) => emMilissegundos(p.mes));
  //: O EIXO X COBRE AS DUAS SÉRIES. Recortá-lo só pelos bonds deixaria o degrau
  //: de um mês sem cotação fora da tela — e é justamente o mês em que o papel
  //: não negociou que a pessoa quer ver ao lado do índice.
  const todasAsDatas = [...datas, ...dosMeses];
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

  if (comPontos.length === 0 && dosMeses.length === 0) {
    return (
      <div ref={container}>
        <p style={{ color: 'var(--cinza-2)', fontSize: 13, margin: 0 }}>{vazio}</p>
      </div>
    );
  }

  const meses = indice.filter((p) => p.valor != null).map((p) => p.mes);

  return (
    <div ref={container} style={{ width: '100%' }}>
      {largura > 0 ? (
        <svg
          width={largura}
          height={altura}
          role="img"
          aria-label={`${rotuloDaEsquerda} dos bonds e índice reputacional, no período`}
        >
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
          <path
            d={caminhoEmDegraus(indice, x, yDireita, fim)}
            fill="none"
            stroke="var(--ok-fg)"
            strokeWidth={2}
            strokeDasharray="6 4"
          />

          {/* os bonds, em linha reta entre pregões */}
          {comPontos.map((serie) => (
            <path
              key={serie.chave}
              d={caminhoDatado(serie.pontos, x, yEsquerda)}
              fill="none"
              stroke={serie.cor}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          ))}

          {/* o eixo x: um rótulo por mês, no máximo seis */}
          {meses
            .filter((_, i) => i % Math.ceil(Math.max(1, meses.length) / 6) === 0)
            .map((mes) => (
              <text
                key={mes}
                x={x(emMilissegundos(mes))}
                y={altura - 6}
                textAnchor="middle"
                fontSize={11}
                fill="var(--cinza-2)"
              >
                {mesLegivel(mes)}
              </text>
            ))}
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
