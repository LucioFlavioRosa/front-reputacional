/** Gráfico de árvore (treemap) — cada tema é um retângulo, a ÁREA
 *  proporcional ao total de interações. Onde a rosca lê melhor "qual fatia
 *  do bolo", o treemap lê melhor "qual item pesa mais que o vizinho" —
 *  pedido do usuário para "% de Interações por Temas": entender de cara
 *  quais temas tiveram mais interações, sem precisar ler a legenda.
 *
 *  SVG puro, como o resto do produto (`Rosca`, `MapaUf`): nenhuma
 *  biblioteca de gráfico entra por um treemap só.
 *
 *  SEM CANTO ARREDONDADO, por pedido — `rect` sem `rx`, diferente do resto
 *  do produto (que usa `--r-chip`/`--r-card-int` em quase tudo). Um treemap
 *  lê como um mosaico de blocos que se encaixam; o canto vivo é o que
 *  reforça essa leitura — arredondado, cada célula pareceria um chip solto.
 *
 *  ALGORITMO SIMPLES, NÃO O "SQUARIFIED" CLÁSSICO: divide a lista ordenada
 *  (decrescente, que é como `temasMaisRecorrentes` já devolve) ao meio pelo
 *  VALOR — não pela quantidade de itens —, e alterna o corte entre vertical
 *  e horizontal conforme qual lado do retângulo atual é mais largo. Não
 *  minimiza a razão de aspecto de cada célula como o algoritmo de Bru&nbsp;
 *  et al., mas com poucos itens (5-20, o caso de uso aqui) o resultado já
 *  fica visualmente equilibrado, e o código cabe em uma função recursiva
 *  curta.
 *
 *  SEM AGRUPAMENTO GEOMÉTRICO: já existiu uma versão que separava as
 *  células em regiões por `Tema.nivel` (Sensível/Estratégico/Geral);
 *  cancelada a pedido — o layout agora é um treemap só, plano, e a
 *  classificação vira só COR (`corDeItem`), não posição.
 *
 *  COR POR QUEM CHAMA (`corDeItem`), não uma régua própria do componente —
 *  já existiu uma escala contínua de azul por peso e, antes dela, classes
 *  de Pareto (80/15/5); as duas foram substituídas a pedido por "pinte pela
 *  classificação" (ex.: o Painel usa `Tema.nivel`). Sem `corDeItem`, toda
 *  célula sai no mesmo azul (`AZUL_PADRAO`/`--azul-mar`). Ignora o
 *  `item.cor` recebido de propósito — quem passa `itens` (o Painel, com
 *  `temasMaisRecorrentes`) continua calculando uma cor por posição para o
 *  Ranking/"Temas no tempo", mas este componente tem sua própria régua.
 *
 *  LEGENDA (`legenda`) é só desenho — o componente não sabe o que as cores
 *  significam, só recebe uma lista de {cor, rotulo} e desenha embaixo do
 *  SVG. Sem isto, a classificação de `corDeItem` fica sem decodificador.
 *
 *  MEDE A LARGURA REAL DO CONTÊINER (`ResizeObserver`, mesma técnica de
 *  `FiltroDePeriodoArrastavel`): sem isto, as células ficariam distorcidas
 *  sempre que o cartão não tivesse a largura que o cálculo assumisse.
 */

import { useEffect, useRef, useState } from 'react';
import type { ItemContado } from '@/dominio/derivacoes';
import { numero, percentual, truncar } from '@/dominio/formato';

const AZUL_PADRAO = '#0027BD'; // var(--azul-mar) — usado só sem `corDeItem`.

interface Retangulo {
  item: ItemContado;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Recorta `itens` (JÁ ORDENADOS, decrescente) num retângulo de `x,y,w,h` —
 *  ver o comentário do algoritmo no topo do arquivo. */
function recortar(itens: ItemContado[], x: number, y: number, w: number, h: number): Retangulo[] {
  if (!itens.length || w <= 0 || h <= 0) return [];
  if (itens.length === 1) return [{ item: itens[0], x, y, w, h }];

  const total = itens.reduce((soma, i) => soma + i.total, 0);
  if (total <= 0) return [];

  // ONDE CORTAR A LISTA: o primeiro ponto em que a soma acumulada alcança a
  // metade do total — não o meio da LISTA, o meio do VALOR.
  let acumulado = 0;
  let corte = itens.length - 1;
  const metade = total / 2;
  for (let i = 0; i < itens.length - 1; i++) {
    acumulado += itens[i].total;
    if (acumulado >= metade) {
      corte = i + 1;
      break;
    }
  }

  const grupoA = itens.slice(0, corte);
  const grupoB = itens.slice(corte);
  const totalA = grupoA.reduce((soma, i) => soma + i.total, 0);
  const fracaoA = totalA / total;

  // CORTA NO LADO MAIS LARGO — é o que evita células compridas e finas
  // quando o retângulo de partida já é bem desproporcional.
  if (w >= h) {
    const wA = w * fracaoA;
    return [...recortar(grupoA, x, y, wA, h), ...recortar(grupoB, x + wA, y, w - wA, h)];
  }
  const hA = h * fracaoA;
  return [...recortar(grupoA, x, y, w, hA), ...recortar(grupoB, x, y + hA, w, h - hA)];
}

/** Luminância aproximada (não é o cálculo de contraste WCAG completo, mas
 *  serve para decidir texto claro/escuro sobre uma célula colorida). */
function corDoTexto(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.6 ? 'var(--cinza-4)' : '#FFFFFF';
}

export function GraficoDeArvore({
  itens,
  ativo,
  aoClicar,
  altura = 240,
  vazio = 'Nenhum registro no recorte.',
  corDeItem,
  legenda,
}: {
  itens: ItemContado[];
  ativo?: string;
  aoClicar?: (chave: string) => void;
  altura?: number;
  vazio?: string;
  /** Cor de cada célula, pela CHAVE do item — sem isto, todas saem no mesmo
   *  azul. Deixa a régua de cor inteiramente para quem chama (ex.: o
   *  Painel, por `Tema.nivel`), em vez de o componente ter uma
   *  classificação própria embutida. */
  corDeItem?: (chave: string) => string;
  /** Decodificador de `corDeItem`, desenhado abaixo do gráfico — uma lista
   *  de quadradinho colorido + rótulo. Puramente visual: o componente não
   *  associa isto a `corDeItem`, quem chama garante que as cores combinam. */
  legenda?: { cor: string; rotulo: string }[];
}) {
  const refDoContainer = useRef<HTMLDivElement>(null);
  const [largura, definirLargura] = useState(480);
  const [emFoco, definirEmFoco] = useState<string | null>(null);

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

  const visiveis = itens.filter((i) => i.total > 0);
  const total = visiveis.reduce((soma, i) => soma + i.total, 0);

  if (!total) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--cinza-2)' }}>
        {vazio}
      </div>
    );
  }

  const retangulos = recortar(visiveis, 0, 0, largura, altura);

  return (
    <div ref={refDoContainer} style={{ width: '100%' }}>
      <svg
        width={largura}
        height={altura}
        role="img"
        aria-label={`Interações por tema: ${visiveis.map((i) => `${i.rotulo} ${numero(i.total)}`).join(', ')}`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {retangulos.map(({ item, x, y, w, h }) => {
          const selecionado = ativo === item.chave;
          const esmaecido = Boolean(ativo) && !selecionado;
          const cor = corDeItem?.(item.chave) ?? AZUL_PADRAO;
          // SÓ RÓTULO SE COUBER — uma célula pequena (um tema raro, no fim
          // da lista) ganha só a cor e o `<title>` no hover; forçar o texto
          // ali só produziria letras cortadas umas em cima das outras.
          const rotuloCabe = w > 54 && h > 30;
          const limiteDeCaracteres = Math.max(4, Math.floor((w - 16) / 7));

          return (
            <g
              key={item.chave}
              onClick={() => aoClicar?.(item.chave)}
              onMouseEnter={() => definirEmFoco(item.chave)}
              onMouseLeave={() => definirEmFoco(null)}
              onFocus={() => definirEmFoco(item.chave)}
              onBlur={() => definirEmFoco(null)}
              tabIndex={aoClicar ? 0 : undefined}
              style={{ cursor: aoClicar ? 'pointer' : undefined, outline: 'none' }}
            >
              <rect
                x={x + 1}
                y={y + 1}
                width={Math.max(0, w - 2)}
                height={Math.max(0, h - 2)}
                fill={cor}
                opacity={esmaecido ? 0.35 : 1}
                stroke={emFoco === item.chave || selecionado ? 'var(--cinza-4)' : 'var(--branco)'}
                strokeWidth={selecionado ? 2.5 : 1.5}
                style={{ transition: 'opacity .12s' }}
              >
                <title>{`${item.rotulo}: ${numero(item.total)} (${percentual(item.total, total)})`}</title>
              </rect>
              {rotuloCabe ? (
                <>
                  <text
                    x={x + 10}
                    y={y + 20}
                    fontSize={9}
                    fontWeight={400}
                    fill={corDoTexto(cor)}
                    style={{ pointerEvents: 'none' }}
                  >
                    {truncar(item.rotulo, limiteDeCaracteres)}
                  </text>
                  <text
                    x={x + 10}
                    y={y + h - 12}
                    fontSize={10.5}
                    fontWeight={400}
                    fill={corDoTexto(cor)}
                    className="tabular"
                    style={{ pointerEvents: 'none' }}
                  >
                    {numero(item.total)}
                  </text>
                </>
              ) : null}
            </g>
          );
        })}
      </svg>

      {legenda?.length ? (
        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            justifyContent: 'center',
            marginTop: 10,
          }}
        >
          {legenda.map(({ cor, rotulo }) => (
            <div key={rotulo} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span aria-hidden style={{ width: 11, height: 11, background: cor, flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, color: 'var(--cinza-3)' }}>{rotulo}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
