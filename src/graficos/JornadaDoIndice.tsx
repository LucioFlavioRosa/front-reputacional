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
 *  o fato ao mês errado. As três medidas vêm da mesma variável, em `index.css`.
 *
 *  O SVG DESENHA SÓ O QUE TOLERA SER ESTICADO — as faixas de fundo e os dois
 *  traços de curva, que têm `non-scaling-stroke`. Ponto, rótulo, marca de eixo
 *  e nome de faixa são HTML posicionado por porcentagem: com
 *  `preserveAspectRatio="none"`, um `<circle>` vira elipse assim que a largura
 *  do cartão deixa de ser proporcional ao viewBox — e era o que acontecia em
 *  toda tela que não fosse a do desenho.
 */

import { VB, jornadaDoIndice } from '@/dominio/jornadaDoIndice';
import type { ColunaDoMes, FaixaDeFundo, PontoDaJornada } from '@/dominio/jornadaDoIndice';
import { mesCurto } from '@/dominio/dossie';
import type { PontoDaSerie } from '@/dominio/score';

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

  const escolhida =
    jornada.colunas.find((coluna) => coluna.selecionada) ?? jornada.colunas.at(-1);

  return (
    <div
      className="jornada"
      style={{ ['--jornada-meses' as string]: String(jornada.colunas.length) }}
    >
      <div className="jornada__margens jornada__colunas">
        {jornada.colunas.map((coluna) => (
          <Coluna key={coluna.mes} coluna={coluna} aoEscolher={aoEscolherMes} />
        ))}
      </div>

      <div className="jornada__margens jornada__grafico">
        <svg
          viewBox={`0 0 ${VB.largura} ${VB.altura}`}
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          role="img"
          aria-label={jornada.resumo}
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

          {jornada.curvaDaLente ? (
            <path
              d={jornada.curvaDaLente}
              fill="none"
              stroke="var(--cinza-2)"
              strokeWidth={2}
              strokeDasharray="6 6"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}

          {/* O HALO dá à curva um contorno claro contra as faixas: sem ele o
              traço azul sobre a faixa Estável quase desaparece. */}
          <path
            d={jornada.curva}
            fill="none"
            stroke="var(--branco)"
            strokeOpacity={0.6}
            strokeWidth={10}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={jornada.curva}
            fill="none"
            stroke="var(--azul-mar)"
            strokeWidth={3}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {jornada.pontosDaLente.map((ponto) => (
          <span
            key={`${ponto.cx}-${ponto.cy}`}
            aria-hidden
            style={{
              position: 'absolute',
              left: `${(ponto.cx / VB.largura) * 100}%`,
              top: `${(ponto.cy / VB.altura) * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--branco)',
              border: '2px solid var(--cinza-2)',
              pointerEvents: 'none',
            }}
          />
        ))}

        {jornada.pontos.map((ponto) => (
          <Ponto key={ponto.mes} ponto={ponto} aoEscolher={aoEscolherMes} />
        ))}

        {jornada.marcas.map((marca) => (
          <span
            key={marca.valor}
            className="tabular"
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
            className="kicker jornada__nome-da-faixa"
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
            className="tabular"
            style={{
              position: 'absolute',
              left: `${jornada.fimDaLente.esquerda}%`,
              top: `${jornada.fimDaLente.topo}%`,
              transform: 'translate(12px, -50%)',
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

      <div className="jornada__margens jornada__meses" style={{ marginTop: 6 }}>
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
            <span className="jornada__mes-longo">{mesCurto(ponto.mes)}</span>
            <span className="jornada__mes-curto">{mesCurto(ponto.mes).slice(0, 3)}</span>
          </span>
        ))}
      </div>

      {/* Só aparece quando as colunas não cabem: o detalhe do mês escolhido,
          e os outros meses se alcançam tocando a curva. */}
      {escolhida ? (
        <div className="jornada__mes-unico" style={{ marginTop: 14 }}>
          <Coluna coluna={escolhida} aoEscolher={aoEscolherMes} sozinha />
        </div>
      ) : null}

      <div className="jornada__faixas-abaixo" style={{ gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
        {jornada.faixas.map((faixa) => (
          <FaixaNaLegenda key={faixa.rotulo} faixa={faixa} />
        ))}
      </div>
    </div>
  );
}

/** A coluna de um mês: o que aconteceu, quanto o índice andou, por qual lente.
 *
 *  `sozinha` é a versão que aparece no lugar da grade quando ela não cabe: a
 *  mesma informação, com o nome do mês em destaque — sem as vizinhas ao lado,
 *  o filete no topo perde a função de comparar e vira só cor. */
function Coluna({
  coluna,
  aoEscolher,
  sozinha = false,
}: {
  coluna: ColunaDoMes;
  aoEscolher: (mes: string) => void;
  sozinha?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => aoEscolher(coluna.mes)}
      title={`Ver ${coluna.nome}`}
      style={{
        textAlign: 'left',
        background: coluna.selecionada && !sozinha ? 'var(--bg-trilho)' : 'transparent',
        border: sozinha ? '1px solid var(--borda)' : 'none',
        borderTop: `3px solid ${coluna.filete}`,
        borderRadius: sozinha ? 'var(--r-card-int)' : 0,
        padding: sozinha ? '12px 14px 14px' : '10px 10px 12px',
        cursor: 'pointer',
        font: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        minWidth: 0,
        width: '100%',
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

/** O ponto do mês e o rótulo dele — um controle só.
 *
 *  EM HTML, E NÃO `<circle>`: o SVG é esticado para as faixas encherem a
 *  largura, e nesse esticamento um círculo vira elipse. Aqui ele é redondo em
 *  qualquer tela, e ainda ganha de graça o foco do navegador. */
function Ponto({
  ponto,
  aoEscolher,
}: {
  ponto: PontoDaJornada;
  aoEscolher: (mes: string) => void;
}) {
  const raio = ponto.selecionado ? 22 : 16;
  return (
    <button
      type="button"
      onClick={() => aoEscolher(ponto.mes)}
      aria-label={ponto.descricao}
      aria-current={ponto.selecionado ? 'true' : undefined}
      style={{
        position: 'absolute',
        left: `${ponto.esquerda}%`,
        top: `${ponto.topo}%`,
        transform: 'translate(-50%, -50%)',
        width: raio,
        height: raio,
        borderRadius: '50%',
        background: ponto.cor,
        border: `2.5px solid ${ponto.selecionado ? 'var(--cinza-4)' : 'var(--branco)'}`,
        padding: 0,
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, ${ponto.acima ? 'calc(-100% - 16px)' : 'calc(0% + 16px)'})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        <span
          className="tabular"
          style={{ fontSize: 15, fontWeight: 700, color: ponto.corDoTexto }}
        >
          {ponto.isr}
        </span>
        {ponto.tag ? (
          <span className="kicker" style={{ color: ponto.corDaTag }}>
            {ponto.tag}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function FaixaNaLegenda({ faixa }: { faixa: FaixaDeFundo }) {
  return (
    <span
      style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5 }}
    >
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 3,
          background: faixa.fundo,
          border: '1px solid var(--borda)',
        }}
      />
      <span style={{ color: faixa.cor, fontWeight: 700 }}>{faixa.rotulo}</span>
    </span>
  );
}
