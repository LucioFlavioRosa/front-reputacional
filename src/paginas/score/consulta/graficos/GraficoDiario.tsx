/** Matérias por dia (spec F.7): barras empilhadas por dia, negativas embaixo
 *  em vermelho e as demais em cima em cinza, com a faixa dos dias em
 *  destaque atrás e a frase "12 a 18/08 · 69 matérias" no topo dela.
 *
 *  A SOMA DA FAIXA É CALCULADA DOS DADOS, e o mês vem da consulta
 *  (`meta.mesReferencia`, passado pelo nível), nunca fixo: outro subtema, outro intervalo ou
 *  outro mês continuam certos sem tocar no componente.
 *
 *  A DICA DE CADA DIA É UM `<title>` nativo numa faixa invisível da altura do
 *  gráfico, como na F.5.
 */

import type { Subtema } from '../dados/tipos';
import { COR_EIXO, COR_FUNDO_DESTAQUE, COR_NEGATIVO_GRAFICO, COR_NEUTRO_GRAFICO } from '../cores';
import {
  DIARIO,
  diaDePico,
  larguraDoDia,
  marcasDoDiario,
  rotuloDoDestaque,
  rotuloDoDia,
  xDaFraseDoDestaque,
  yMaxDoDiario,
} from './escalas';

type PorDia = NonNullable<Subtema['nivel4']>['porDia'];

export function GraficoDiario({
  porDia,
  mes,
}: {
  porDia: PorDia;
  /** Mês de dois dígitos ("08"), o de `meta.mesReferencia`. */
  mes: string;
}) {
  const { total, negativas, destaque } = porDia;
  const dias = total.length;
  const largura = larguraDoDia(dias);
  const unidade = DIARIO.alturaUtil / yMaxDoDiario(total);
  const xDoDia = (dia: number) => DIARIO.esquerda + (dia - 1) * largura;

  const frase = rotuloDoDestaque(total, destaque, mes);
  const faixaX = xDoDia(destaque.inicio);
  const faixaLargura = Math.max(destaque.fim - destaque.inicio + 1, 0) * largura;
  const pico = diaDePico(total);
  const resumo =
    pico === undefined
      ? `Matérias por dia. Destaque: ${frase}.`
      : `Matérias por dia. Destaque: ${frase}. Pico: ${rotuloDoDia(pico, mes, total[pico - 1], negativas[pico - 1] ?? 0)}.`;

  return (
    <svg
      viewBox="0 0 640 150"
      width="100%"
      role="img"
      aria-label={resumo}
      className="tabular"
      style={{ display: 'block', height: 'auto' }}
    >
      <rect
        data-faixa
        x={faixaX}
        y={DIARIO.topoDaFaixa}
        width={faixaLargura}
        height={DIARIO.base - DIARIO.topoDaFaixa}
        fill={COR_FUNDO_DESTAQUE}
      />
      <text
        data-frase
        x={xDaFraseDoDestaque(faixaX, faixaLargura, frase)}
        y={DIARIO.topoDaFaixa + 12}
        fontSize={11}
        fontWeight={700}
        textAnchor="middle"
        style={{ fill: 'var(--azul-mar)' }}
      >
        {frase}
      </text>

      {total.map((t, i) => {
        const neg = Math.min(negativas[i] ?? 0, t);
        const alturaNeg = neg * unidade;
        const alturaDemais = (t - neg) * unidade;
        const x = xDoDia(i + 1) + largura * 0.16;
        const w = largura * 0.68;
        return (
          <g key={i} data-dia={i + 1}>
            {neg > 0 ? (
              <rect
                data-parte="negativas"
                x={x}
                y={DIARIO.base - alturaNeg}
                width={w}
                height={alturaNeg}
                style={{ fill: COR_NEGATIVO_GRAFICO }}
              />
            ) : null}
            {t - neg > 0 ? (
              <rect
                data-parte="demais"
                x={x}
                y={DIARIO.base - alturaNeg - alturaDemais}
                width={w}
                height={alturaDemais}
                fill={COR_NEUTRO_GRAFICO}
              />
            ) : null}
          </g>
        );
      })}

      <line
        x1={DIARIO.esquerda}
        x2={DIARIO.direita}
        y1={DIARIO.base}
        y2={DIARIO.base}
        stroke={COR_EIXO}
        strokeWidth={1}
      />

      {marcasDoDiario(dias).map((dia) => (
        <text
          key={dia}
          data-marca={dia}
          x={xDoDia(dia) + largura / 2}
          y={138}
          fontSize={11}
          textAnchor="middle"
          style={{ fill: 'var(--cinza-2)' }}
        >
          {dia}
        </text>
      ))}

      {total.map((t, i) => (
        <rect
          key={`dica-${i}`}
          data-dica={i + 1}
          x={xDoDia(i + 1)}
          y={DIARIO.topoDaFaixa}
          width={largura}
          height={DIARIO.base - DIARIO.topoDaFaixa}
          fill="transparent"
        >
          <title>{rotuloDoDia(i + 1, mes, t, negativas[i] ?? 0)}</title>
        </rect>
      ))}
    </svg>
  );
}

/** Legenda do gráfico diário (E.7.2: "legenda (Negativas, Demais)"). Fica
 *  fora do SVG para o resumo do Nível 4 pô-la na linha do kicker, como no
 *  mockup. */
export function LegendaDoGraficoDiario() {
  const itens = [
    { cor: COR_NEGATIVO_GRAFICO, texto: 'Negativas' },
    { cor: COR_NEUTRO_GRAFICO, texto: 'Demais' },
  ];
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: 'var(--cinza-3)' }}>
      {itens.map((i) => (
        <span key={i.texto} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: i.cor }} />
          {i.texto}
        </span>
      ))}
    </span>
  );
}
