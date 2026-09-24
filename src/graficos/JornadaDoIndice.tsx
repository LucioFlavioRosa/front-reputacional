/** A jornada do índice: colunas por mês, faixas ao fundo, curva por cima.
 *
 *  NENHUMA CONTA MORA AQUI. Domínio do eixo, faixas recortadas, caminho da
 *  curva e posição de cada rótulo saem de `dominio/jornadaDoIndice`, testado
 *  linha a linha. Este arquivo desenha.
 *
 *  COLUNAS E GRÁFICO COMPARTILHAM AS MARGENS LATERAIS, e é isso que os alinha:
 *  a grade tem uma coluna de largura igual por mês, e o ponto do mês i cai em
 *  (i + 0,5)/n da largura — o centro exato da coluna i. Margens diferentes
 *  fariam a terceira coluna apontar para o segundo ponto, e o leitor atribuiria
 *  o fato ao mês errado.
 *
 *  DUAS CAMADAS SVG com o mesmo viewBox: as faixas esticam (a cor de fundo não
 *  tem proporção a preservar) e a curva mantém a razão de aspecto. Numa camada
 *  só, esticar o fundo deformaria a curva junto.
 */

import { VB, jornadaDoIndice } from '@/dominio/jornadaDoIndice';
import type { ColunaDoMes, PontoDaJornada } from '@/dominio/jornadaDoIndice';
import { mesCurto } from '@/dominio/dossie';
import type { PontoDaSerie } from '@/dominio/score';

/** A margem que o eixo pede à esquerda, e os nomes das faixas à direita. */
const MARGEM = { esquerda: 34, direita: 92 } as const;

export function JornadaDoIndice({
  serie,
  mes,
  comparada,
  aoEscolherMes,
}: {
  serie: PontoDaSerie[];
  mes: string;
  comparada: string | null;
  aoEscolherMes: (mes: string) => void;
}) {
  const jornada = jornadaDoIndice(serie, mes, comparada);
  if (!jornada.pontos.length) {
    return (
      <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>
        Sem série ainda — o índice nasce quando o primeiro mês é ingerido.
      </p>
    );
  }

  const margens = { marginLeft: MARGEM.esquerda, marginRight: MARGEM.direita };

  return (
    <div>
      <div
        style={{
          ...margens,
          display: 'grid',
          gridTemplateColumns: `repeat(${jornada.colunas.length}, minmax(0, 1fr))`,
        }}
      >
        {jornada.colunas.map((coluna) => (
          <Coluna key={coluna.mes} coluna={coluna} aoEscolher={aoEscolherMes} />
        ))}
      </div>

      <div style={{ ...margens, position: 'relative' }}>
        <svg
          viewBox={`0 0 ${VB.largura} ${VB.altura}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: 260, display: 'block' }}
          aria-hidden
        >
          {jornada.faixas.map((faixa) => (
            <rect
              key={faixa.rotulo}
              x={0}
              y={faixa.y}
              width={VB.largura}
              height={faixa.altura}
              fill={faixa.fundo}
            />
          ))}
        </svg>

        <svg
          viewBox={`0 0 ${VB.largura} ${VB.altura}`}
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: 260 }}
          role="img"
          aria-label={jornada.resumo}
        >
          {jornada.curvaDaLente ? (
            <path
              d={jornada.curvaDaLente}
              fill="none"
              stroke="var(--cinza-2)"
              strokeWidth={2.5}
              strokeDasharray="6 6"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {jornada.pontosDaLente.map((ponto) => (
            <circle
              key={`${ponto.cx}-${ponto.cy}`}
              cx={ponto.cx}
              cy={ponto.cy}
              r={4}
              fill="var(--branco)"
              stroke="var(--cinza-2)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* O HALO dá à curva um contorno claro contra as faixas de fundo:
              sem ele o traço azul sobre a faixa Estável quase some. */}
          <path
            d={jornada.curva}
            fill="none"
            stroke="var(--branco)"
            strokeOpacity={0.55}
            strokeWidth={12}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={jornada.curva}
            fill="none"
            stroke="var(--azul-mar)"
            strokeWidth={3.5}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {jornada.pontos.map((ponto) => (
            <circle
              key={ponto.mes}
              cx={ponto.cx}
              cy={ponto.cy}
              r={ponto.selecionado ? 11 : 8}
              fill={ponto.cor}
              stroke={ponto.selecionado ? 'var(--cinza-4)' : 'var(--branco)'}
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {jornada.pontos.map((ponto) => (
          <RotuloDoPonto key={ponto.mes} ponto={ponto} aoEscolher={aoEscolherMes} />
        ))}

        {jornada.marcas.map((marca) => (
          <span
            key={marca.valor}
            style={{
              position: 'absolute',
              right: 'calc(100% + 8px)',
              top: `${marca.topo}%`,
              transform: 'translateY(-50%)',
              fontSize: 11,
              color: 'var(--cinza-2)',
              pointerEvents: 'none',
            }}
          >
            {marca.valor}
          </span>
        ))}

        {/* FORA DO GRÁFICO, à direita: dentro, o nome da faixa colide com o
            primeiro e o último ponto, que ficam a 1/(2n) da borda. */}
        {jornada.faixas.map((faixa) => (
          <span
            key={faixa.rotulo}
            className="kicker"
            style={{
              position: 'absolute',
              left: 'calc(100% + 10px)',
              top: `${faixa.centro}%`,
              transform: 'translateY(-50%)',
              whiteSpace: 'nowrap',
              color: faixa.cor,
              pointerEvents: 'none',
            }}
          >
            {faixa.rotulo}
          </span>
        ))}

        {jornada.fimDaLente ? (
          <span
            style={{
              position: 'absolute',
              left: `${jornada.fimDaLente.esquerda}%`,
              top: `${jornada.fimDaLente.topo}%`,
              transform: 'translate(14px, -50%)',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--cinza-3)',
              whiteSpace: 'nowrap',
              background: 'var(--branco)',
              padding: '2px 6px',
              borderRadius: 5,
              border: '1px solid var(--borda)',
              pointerEvents: 'none',
            }}
          >
            {jornada.fimDaLente.texto}
          </span>
        ) : null}
      </div>

      <div
        style={{
          ...margens,
          display: 'grid',
          gridTemplateColumns: `repeat(${jornada.pontos.length}, minmax(0, 1fr))`,
          marginTop: 4,
        }}
      >
        {jornada.pontos.map((ponto) => (
          <span
            key={ponto.mes}
            className="kicker"
            style={{
              textAlign: 'center',
              color: ponto.selecionado ? 'var(--azul-mar)' : 'var(--cinza-2)',
              fontWeight: ponto.selecionado ? 700 : 500,
            }}
          >
            {mesCurto(ponto.mes)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A coluna de um mês: o que aconteceu, quanto o índice andou, por qual lente. */
function Coluna({
  coluna,
  aoEscolher,
}: {
  coluna: ColunaDoMes;
  aoEscolher: (mes: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => aoEscolher(coluna.mes)}
      title={`Ver ${coluna.nome}`}
      style={{
        textAlign: 'left',
        background: coluna.selecionada ? 'var(--bg-trilho)' : 'transparent',
        border: 'none',
        borderTop: `3px solid ${coluna.filete}`,
        padding: '10px 10px 12px',
        cursor: 'pointer',
        font: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        minWidth: 0,
      }}
    >
      <span className="kicker">{coluna.nome}</span>
      {/* EM LINHA PRÓPRIA, e sem quebra: com seis colunas não há largura para
          o nome do mês e a variação lado a lado. */}
      <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
        {coluna.variacao}
      </span>
      <span style={{ fontSize: 11.5, lineHeight: 1.45, color: 'var(--cinza-3)' }}>
        {coluna.fato}
      </span>
      {coluna.movimento ? (
        <span style={{ fontSize: 11, color: 'var(--cinza-2)' }}>{coluna.movimento}</span>
      ) : null}
    </button>
  );
}

/** A nota do mês, e a tag do fato — acima ou abaixo do ponto, conforme couber. */
function RotuloDoPonto({
  ponto,
  aoEscolher,
}: {
  ponto: PontoDaJornada;
  aoEscolher: (mes: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => aoEscolher(ponto.mes)}
      aria-label={ponto.descricao}
      style={{
        position: 'absolute',
        left: `${ponto.esquerda}%`,
        top: `${ponto.topo}%`,
        transform: `translate(-50%, ${ponto.acima ? 'calc(-100% - 16px)' : '16px'})`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        border: 'none',
        background: 'none',
        padding: 0,
        cursor: 'pointer',
        font: 'inherit',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        className="tabular"
        style={{ fontSize: 16, fontWeight: 700, color: ponto.corDoTexto }}
      >
        {ponto.isr}
      </span>
      {ponto.tag ? (
        <span className="kicker" style={{ color: ponto.corDaTag }}>
          {ponto.tag}
        </span>
      ) : null}
    </button>
  );
}
