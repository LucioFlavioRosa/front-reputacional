/** Linha empilhada (área) por período — mesma base de dados que
 *  `BarrasEmpilhadas` (`ColunaMensal[]`), só que lida como tendência
 *  contínua no tempo: para o clima, o que importa é para onde a curva está
 *  indo mês a mês, não comparar a altura de uma coluna isolada contra a
 *  vizinha.
 *
 *  AS CATEGORIAS VÊM DA UNIÃO dos segmentos de todas as colunas, na ordem em
 *  que aparecem pela primeira vez — `serieMensal` só lista, em CADA coluna,
 *  o segmento com total > 0 (um mês sem nenhuma interação "tenso", por
 *  exemplo, não teria essa categoria na própria coluna) —, e a pilha precisa
 *  da mesma categoria em todo período para desenhar uma área contínua, com
 *  zero onde não houver registro.
 */

import { useState } from 'react';
import type { ColunaMensal, Segmento } from '@/dominio/derivacoes';
import { rotuloDoMes } from '@/dominio/formato';

const ALTURA_DO_MES = 14;
const LIMITE_DE_ROTULOS_NO_EIXO = 12;

export function LinhaEmpilhada({
  colunas,
  altura = 150,
  formatarRotulo = rotuloDoMes,
  ordem,
}: {
  colunas: ColunaMensal[];
  altura?: number;
  /** Como ler `coluna.mes` em texto — mesmo contrato de `BarrasEmpilhadas`. */
  formatarRotulo?: (chave: string) => string;
  /** Chaves de categoria, DE BAIXO PARA CIMA na pilha — por exemplo, o
   *  Reativo do clima sempre na base, em vez de seguir a ordem em que cada
   *  categoria apareceu pela primeira vez nas colunas. Quem não está nesta
   *  lista mantém a ordem de aparição, depois das listadas. */
  ordem?: string[];
}) {
  const [emFoco, definirEmFoco] = useState<number | null>(null);

  if (!colunas.length) {
    return (
      <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--cinza-2)' }}>
        Sem registros no recorte.
      </div>
    );
  }

  const categoriasNaOrdemDeAparicao: Segmento[] = [];
  for (const coluna of colunas) {
    for (const segmento of coluna.segmentos) {
      if (!categoriasNaOrdemDeAparicao.some((c) => c.chave === segmento.chave)) {
        categoriasNaOrdemDeAparicao.push(segmento);
      }
    }
  }

  const categorias = ordem
    ? [...categoriasNaOrdemDeAparicao].sort((a, b) => {
        const indiceA = ordem.indexOf(a.chave);
        const indiceB = ordem.indexOf(b.chave);
        if (indiceA === -1 && indiceB === -1) return 0;
        if (indiceA === -1) return 1;
        if (indiceB === -1) return -1;
        return indiceA - indiceB;
      })
    : categoriasNaOrdemDeAparicao;

  const maximo = Math.max(1, ...colunas.map((c) => c.total));
  const alturaDoTrilho = altura - ALTURA_DO_MES;
  const n = colunas.length;
  const x = (indice: number) => (n > 1 ? (indice / (n - 1)) * 100 : 50);
  const y = (valor: number) => alturaDoTrilho - (valor / maximo) * alturaDoTrilho;

  // O valor "cru" (não acumulado) de cada categoria, coluna a coluna — a
  // base para calcular onde cada camada da pilha começa e termina.
  const valoresPorCategoria = categorias.map((categoria) =>
    colunas.map((coluna) => coluna.segmentos.find((s) => s.chave === categoria.chave)?.total ?? 0),
  );

  // Acumulado camada sobre camada — a primeira categoria fica por baixo, a
  // última por cima, na mesma ordem em que a legenda de quem chama já lista.
  const camadas = valoresPorCategoria.reduce<number[][]>((acc, valores, indice) => {
    const base = acc[indice - 1] ?? colunas.map(() => 0);
    return [...acc, valores.map((v, i) => base[i] + v)];
  }, []);

  const indiceDoUltimo = n - 1;
  const passoDoRotulo = Math.max(1, Math.ceil(n / LIMITE_DE_ROTULOS_NO_EIXO));

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: alturaDoTrilho, position: 'relative' }}>
        <svg
          width="100%"
          height={alturaDoTrilho}
          viewBox={`0 0 100 ${alturaDoTrilho}`}
          preserveAspectRatio="none"
          style={{ display: 'block', overflow: 'visible' }}
        >
          <line
            x1={0}
            y1={alturaDoTrilho - 0.5}
            x2={100}
            y2={alturaDoTrilho - 0.5}
            stroke="var(--borda)"
            vectorEffect="non-scaling-stroke"
          />
          {categorias.map((categoria, indice) => {
            const topo = camadas[indice];
            const base = camadas[indice - 1] ?? colunas.map(() => 0);
            const pontosTopo = topo.map((v, i) => `${x(i)},${y(v)}`);
            const pontosBase = base.map((v, i) => `${x(i)},${y(v)}`).reverse();
            return (
              <g key={categoria.chave}>
                <path
                  d={`M ${pontosTopo.join(' L ')} L ${pontosBase.join(' L ')} Z`}
                  fill={categoria.cor}
                  opacity={0.2}
                  stroke="none"
                />
                <path
                  d={`M ${pontosTopo.join(' L ')}`}
                  fill="none"
                  stroke={categoria.cor}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
        </svg>

        {/* Uma faixa invisível por coluna só para detectar o hover — a linha
            em si não tem "corpo" para receber o evento, diferente da barra. */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
          {colunas.map((coluna, indice) => {
            const naEsquerda = indice <= 1;
            const naDireita = indice >= colunas.length - 2;
            return (
              <div
                key={coluna.mes}
                style={{ flex: 1, position: 'relative' }}
                onMouseEnter={() => definirEmFoco(indice)}
                onMouseLeave={() => definirEmFoco(null)}
              >
                {emFoco === indice && coluna.total > 0 ? (
                  <TooltipDaColuna
                    coluna={coluna}
                    alinhamento={naEsquerda ? 'esquerda' : naDireita ? 'direita' : 'centro'}
                    formatarRotulo={formatarRotulo}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex' }}>
        {colunas.map((coluna, indice) => (
          <div
            key={coluna.mes}
            style={{
              flex: 1,
              height: ALTURA_DO_MES,
              fontSize: 11,
              textAlign: 'center',
              color: 'var(--cinza-2)',
              marginTop: 4,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {indice % passoDoRotulo === 0 || indice === indiceDoUltimo || emFoco === indice
              ? formatarRotulo(coluna.mes)
              : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mesmo desenho do tooltip de `BarrasEmpilhadas`: fundo escuro, data e total
 *  em cima, a quebra por categoria embaixo. */
function TooltipDaColuna({
  coluna,
  alinhamento,
  formatarRotulo,
}: {
  coluna: ColunaMensal;
  alinhamento: 'esquerda' | 'centro' | 'direita';
  formatarRotulo: (chave: string) => string;
}) {
  const posicao =
    alinhamento === 'esquerda'
      ? { left: 0 }
      : alinhamento === 'direita'
        ? { right: 0 }
        : { left: '50%', transform: 'translateX(-50%)' };

  return (
    <div
      role="tooltip"
      style={{
        position: 'absolute',
        bottom: '100%',
        marginBottom: 6,
        zIndex: 20,
        minWidth: 190,
        background: 'var(--cinza-4)',
        color: 'var(--branco)',
        borderRadius: 'var(--r-card-int)',
        padding: '11px 13px',
        boxShadow: 'var(--sh-tooltip)',
        pointerEvents: 'none',
        ...posicao,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 7,
        }}
      >
        <span style={{ textTransform: 'capitalize' }}>{formatarRotulo(coluna.mes)}</span>
        <span className="tabular">{coluna.total}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {coluna.segmentos.map((segmento) => (
          <div
            key={segmento.chave}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}
          >
            <span
              aria-hidden
              style={{ width: 8, height: 8, borderRadius: 2, background: segmento.cor, flexShrink: 0 }}
            />
            <span style={{ flex: 1, color: '#D5DAEA' }}>{segmento.rotulo}</span>
            <span className="tabular">{segmento.total}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
