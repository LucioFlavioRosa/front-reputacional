/** Colunas de impacto mês a mês (spec F.5): uma coluna por mês a partir da
 *  linha de base, para baixo quando o tema tirou pontos e para cima quando
 *  somou; volume de cada mês no topo.
 *
 *  A DICA DE CADA MÊS É UM `<title>` NATIVO DO SVG numa faixa invisível da
 *  altura do gráfico: o navegador mostra ao passar o mouse, sem estado, sem
 *  posição calculada e sem balão para fechar. Quem usa leitor de tela recebe
 *  os mesmos números no `aria-label` do gráfico inteiro.
 */

import { arred, corDoSinal, fmtInt, fmtPtCurto } from '../formatacao';
import {
  COR_COLUNA_ANTERIOR_NEGATIVA,
  COR_COLUNA_ANTERIOR_POSITIVA,
  COR_EIXO,
  COR_NEGATIVO_GRAFICO,
  COR_POSITIVO_GRAFICO,
} from '../cores';
import { COLUNAS, dominioDasColunas, rotuloDaColuna, xDaColuna, yDaColuna } from './escalas';

function corDaColuna(v: number, atual: boolean): string {
  if (atual) return v < 0 ? COR_NEGATIVO_GRAFICO : COR_POSITIVO_GRAFICO;
  return v < 0 ? COR_COLUNA_ANTERIOR_NEGATIVA : COR_COLUNA_ANTERIOR_POSITIVA;
}

export function GraficoColunasImpacto({
  meses,
  impactos,
  volumes,
  unidade = 'matérias',
}: {
  meses: string[];
  impactos: number[];
  volumes: number[];
  /** `lente.unidade`; na Imprensa, "matérias". */
  unidade?: string;
}) {
  const dominio = dominioDasColunas(impactos);
  const y0 = yDaColuna(0, dominio);
  const ultimo = meses.length - 1;
  const dicas = meses.map((m, i) => rotuloDaColuna(m, impactos[i] ?? 0, volumes[i] ?? 0, unidade));

  return (
    <svg
      viewBox="0 0 600 270"
      width="100%"
      role="img"
      aria-label={`Impacto na nota mês a mês: ${dicas.join('; ')}`}
      className="tabular"
      style={{ display: 'block', height: 'auto', overflow: 'visible' }}
    >
      <text x={10} y={18} fontSize={11} style={{ fill: 'var(--cinza-2)' }}>
        {unidade}
      </text>
      <line x1={30} x2={570} y1={y0} y2={y0} stroke={COR_EIXO} strokeWidth={1} />
      <text x={24} y={y0 + 4} fontSize={11} textAnchor="end" style={{ fill: 'var(--cinza-2)' }}>
        0
      </text>

      {meses.map((mes, i) => {
        const v = impactos[i] ?? 0;
        const atual = i === ultimo;
        const x = xDaColuna(i);
        const yv = yDaColuna(v, dominio);
        const negativo = v < 0;
        return (
          <g key={mes} data-mes={mes}>
            <text x={x} y={18} fontSize={12} fontWeight={700} textAnchor="middle" style={{ fill: 'var(--cinza-3)' }}>
              {fmtInt(volumes[i] ?? 0)}
            </text>
            {v !== 0 ? (
              <rect
                data-coluna={negativo ? 'negativa' : 'positiva'}
                x={x - COLUNAS.largura / 2}
                y={Math.min(yv, y0)}
                width={COLUNAS.largura}
                height={Math.abs(yv - y0)}
                style={{ fill: corDaColuna(v, atual) }}
              />
            ) : null}
            <text
              data-valor
              x={x}
              y={negativo ? yv + 16 : yv - 6}
              fontSize={atual ? 14 : 12}
              fontWeight={800}
              textAnchor="middle"
              style={{ fill: corDoSinal(arred(v, 1)) }}
            >
              {fmtPtCurto(v)}
            </text>
            <text
              x={x}
              y={258}
              fontSize={12}
              fontWeight={atual ? 700 : 400}
              textAnchor="middle"
              style={{ fill: atual ? 'var(--cinza-4)' : 'var(--cinza-2)' }}
            >
              {mes}
            </text>
          </g>
        );
      })}

      {/* Faixas invisíveis por cima de tudo, só para a dica. */}
      {meses.map((mes, i) => (
        <rect
          key={`dica-${mes}`}
          data-dica={mes}
          x={xDaColuna(i) - COLUNAS.passo / 2}
          y={0}
          width={COLUNAS.passo}
          height={270}
          fill="transparent"
        >
          <title>{dicas[i]}</title>
        </rect>
      ))}
    </svg>
  );
}
