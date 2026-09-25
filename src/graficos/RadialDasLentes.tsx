/** O gráfico radial das cinco lentes — SVG puro, como o resto do produto.
 *
 *  NENHUMA CONTA MORA AQUI. Ângulo, raio, cor e posição de rótulo saem de
 *  `dominio/radialDasLentes`, que é testado linha a linha; este arquivo pega
 *  caminhos prontos e os pinta. É a mesma divisão de `MapaUf` e `Rosca`.
 *
 *  OS TEXTOS FICAM FORA DO SVG, em overlay HTML posicionado por porcentagem.
 *  Dentro de `<text>` eles somem quando o valor é interpolado — foi o que
 *  aconteceu na primeira versão do protótipo, e a §3 do pacote manda evitar. Em
 *  HTML o texto é texto: herda a fonte do produto, é selecionável, e quebra
 *  onde a gente mandou.
 *
 *  O DESTAQUE É COMPARTILHADO com a lista ao lado (`aoDestacar`): passar o
 *  mouse numa linha acende a fatia e vice-versa. Sem isso, com cinco fatias de
 *  larguras diferentes, ninguém liga a terceira linha da lista à segunda fatia
 *  do círculo.
 */

import { VIEW_BOX, radialDasLentes } from '@/dominio/radialDasLentes';
import type { Ancora, PontoNaTela, SetorDaLente } from '@/dominio/radialDasLentes';
import type { LenteDoScore } from '@/dominio/score';

/** Os anéis de referência: régua discreta, na borda da casa. */
const TRACEJADO = 'var(--cinza-1)';

export function RadialDasLentes({
  lentes,
  isr,
  faixa,
  corDoIsr,
  porPeso,
  destacada,
  aoDestacar,
  aoAbrir,
}: {
  lentes: LenteDoScore[];
  isr: number | null;
  faixa: string;
  corDoIsr: string;
  porPeso: boolean;
  destacada: string | null;
  aoDestacar: (codigo: string | null) => void;
  aoAbrir: (codigo: string) => void;
}) {
  const radial = radialDasLentes(lentes, porPeso);
  const { x, y, largura, altura } = VIEW_BOX;

  return (
    <div>
      <div style={{ position: 'relative', width: '100%', maxWidth: 560, margin: '0 auto' }}>
        <svg
          viewBox={`${x} ${y} ${largura} ${altura}`}
          style={{ width: '100%', display: 'block' }}
          role="img"
          aria-label={`Índice ${isr ?? 'sem nota'}, faixa ${faixa}. ${radial.setores
            .map((setor) => setor.descricao)
            .join('. ')}.`}
        >
          {/* Os anéis por baixo de tudo: eles são régua, não conteúdo. */}
          {radial.aneis.map((anel) => (
            <circle
              key={anel.valor}
              cx={230}
              cy={230}
              r={anel.raio}
              fill="none"
              stroke={TRACEJADO}
              strokeDasharray="3 4"
            />
          ))}
          <circle cx={230} cy={230} r={190} fill="none" stroke={TRACEJADO} />

          {radial.setores.map((setor) => (
            <Setor
              key={setor.codigo}
              setor={setor}
              apagada={Boolean(destacada) && destacada !== setor.codigo}
              focada={destacada === setor.codigo}
              aoDestacar={aoDestacar}
              aoAbrir={aoAbrir}
            />
          ))}

          <circle cx={230} cy={230} r={68} fill={corDoIsr} />
        </svg>

        <Sobreposto ponto={radial.centro} ancora="centro">
          <div style={{ textAlign: 'center', color: 'var(--branco)', pointerEvents: 'none' }}>
            <div className="tabular" style={{ fontSize: 52, fontWeight: 800, lineHeight: 1 }}>
              {isr ?? '—'}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: 'var(--turquesa-sombra)',
              }}
            >
              {faixa}
            </div>
          </div>
        </Sobreposto>

        {radial.setores.map((setor) => (
          <Sobreposto key={setor.codigo} ponto={setor.rotulo} ancora={setor.ancora}>
            <button
              type="button"
              onMouseEnter={() => aoDestacar(setor.codigo)}
              onMouseLeave={() => aoDestacar(null)}
              onFocus={() => aoDestacar(setor.codigo)}
              onBlur={() => aoDestacar(null)}
              onClick={() => aoAbrir(setor.codigo)}
              title={`Abrir a lente ${setor.nome}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems:
                  setor.ancora === 'centro'
                    ? 'center'
                    : setor.ancora === 'inicio'
                      ? 'flex-start'
                      : 'flex-end',
                gap: 1,
                border: 'none',
                background: 'none',
                padding: 0,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                lineHeight: 1.15,
                font: 'inherit',
                opacity: destacada && destacada !== setor.codigo ? 0.45 : 1,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700 }}>{setor.nome}</span>
              <span
                className="tabular"
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: setor.ativa ? setor.corDoTexto : 'var(--cinza-2)',
                }}
              >
                {setor.notaEscrita}
              </span>
            </button>
          </Sobreposto>
        ))}

        {radial.aneis.map((anel) =>
          anel.rotulo ? (
            <Sobreposto key={anel.valor} ponto={anel.rotulo} ancora="centro">
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--cinza-2)',
                  background: 'var(--bg-trilho)',
                  padding: '0 3px',
                  borderRadius: 3,
                  pointerEvents: 'none',
                }}
              >
                {anel.valor}
              </span>
            </Sobreposto>
          ) : null,
        )}
      </div>

      <p
        style={{
          fontSize: 11.5,
          color: 'var(--cinza-2)',
          margin: '12px 0 0',
          textAlign: 'center',
        }}
      >
        {radial.legenda}
      </p>
    </div>
  );
}

/** Uma fatia: o fundo até 100, e a parte medida por cima.
 *
 *  O FUNDO É O QUE FALTA. Sem ele, uma nota 37 desenha um toco solto no meio
 *  do círculo e não se sabe de quanto ela está longe. */
function Setor({
  setor,
  apagada,
  focada,
  aoDestacar,
  aoAbrir,
}: {
  setor: SetorDaLente;
  apagada: boolean;
  focada: boolean;
  aoDestacar: (codigo: string | null) => void;
  aoAbrir: (codigo: string) => void;
}) {
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={setor.descricao}
      style={{ cursor: 'pointer', opacity: apagada ? 0.35 : 1 }}
      onMouseEnter={() => aoDestacar(setor.codigo)}
      onMouseLeave={() => aoDestacar(null)}
      onFocus={() => aoDestacar(setor.codigo)}
      onBlur={() => aoDestacar(null)}
      onClick={() => aoAbrir(setor.codigo)}
      onKeyDown={(evento) => {
        if (evento.key === 'Enter' || evento.key === ' ') {
          evento.preventDefault();
          aoAbrir(setor.codigo);
        }
      }}
    >
      <path d={setor.fundo} fill="var(--bg-trilho)" stroke="var(--borda)" />
      {setor.fatia ? (
        <path
          d={setor.fatia}
          fill={setor.cor}
          stroke={focada ? 'var(--cinza-4)' : 'none'}
          strokeWidth={focada ? 2 : 0}
        />
      ) : null}
    </g>
  );
}

/** Um texto colado sobre o SVG, na coordenada que o domínio calculou. */
function Sobreposto({
  ponto,
  ancora,
  children,
}: {
  ponto: PontoNaTela;
  ancora: Ancora;
  children: React.ReactNode;
}) {
  const horizontal = ancora === 'centro' ? '-50%' : ancora === 'inicio' ? '0' : '-100%';
  return (
    <div
      style={{
        position: 'absolute',
        left: `${ponto.esquerda}%`,
        top: `${ponto.topo}%`,
        transform: `translate(${horizontal}, -50%)`,
      }}
    >
      {children}
    </div>
  );
}
