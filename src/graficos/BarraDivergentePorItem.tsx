/** Barra divergente genérica, um item por linha — mesma técnica visual de
 *  `BarraDivergente` (o trilho, a linha de zero, a faixa colorida que cresce
 *  do centro), mas sem a lista de interações que se abre ao clicar: aqui o
 *  clique só filtra o recorte por aquele item, e é só isso que ele faz.
 *
 *  `BarraDivergente` não serve para isto porque está presa ao formato de
 *  `ScoreDeTema` (agenda por agenda, expandível) — um acoplamento certo para
 *  "Barra divergente por tema", errado para uma lista simples de itens com
 *  score.
 */

import { numero } from '@/dominio/formato';

const ALTURA_DA_FAIXA = 10;

export interface ItemDivergente {
  chave: string;
  rotulo: string;
  total: number;
  /** (positivas − negativas) ÷ total, em pontos de −100 a 100. */
  score: number;
}

/** O que o `total` conta. O padrão é a agenda, que foi quem inaugurou esta
 *  barra; o Score conta menção. Sem isto, a tela do Score diria "1.983
 *  interações" sobre matérias de jornal — e a palavra errada num rótulo faz
 *  quem lê procurar o número na tela errada. */
export interface UnidadeDoTotal {
  singular: string;
  plural: string;
}

export function BarraDivergentePorItem({
  itens,
  ativo,
  aoClicar,
  vazio = 'Nenhum item com clima registrado neste recorte.',
  unidade = { singular: 'interação', plural: 'interações' },
  variante = 'padrao',
}: {
  itens: ItemDivergente[];
  ativo?: string;
  aoClicar?: (chave: string) => void;
  vazio?: string;
  unidade?: UnidadeDoTotal;
  /** MESMA IDEIA de `BarraDivergente` (ver o comentário lá) — `'termometro'`
   *  escurece o trilho e troca o número na coluna à direita por um pino
   *  (seta + número) preso na ponta da barra colorida, com linhas mais
   *  próximas umas das outras. */
  variante?: 'padrao' | 'termometro';
}) {
  if (!itens.length) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--cinza-2)' }}>
        {vazio}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: variante === 'termometro' ? 1 : 4,
      }}
    >
      {itens.map((item) => {
        const positivo = item.score >= 0;
        const largura = Math.min(50, Math.abs(item.score) / 2);
        const selecionado = ativo === item.chave;

        return (
          <div
            key={item.chave}
            role={aoClicar ? 'button' : undefined}
            tabIndex={aoClicar ? 0 : undefined}
            onClick={() => aoClicar?.(item.chave)}
            onKeyDown={(evento) => {
              if (!aoClicar) return;
              if (evento.key !== 'Enter' && evento.key !== ' ') return;
              evento.preventDefault();
              aoClicar(item.chave);
            }}
            title={
              aoClicar
                ? selecionado
                  ? 'Clique para remover o filtro'
                  : `Filtrar por ${item.rotulo}`
                : undefined
            }
            style={{
              display: 'grid',
              gridTemplateColumns:
                variante === 'termometro'
                  ? 'minmax(0, 1fr) minmax(0, 2.6fr)'
                  : 'minmax(0, 1fr) minmax(0, 2.2fr) 48px',
              alignItems: 'center',
              gap: 14,
              padding: variante === 'termometro' ? '15px 6px 4px' : '5px 6px',
              margin: '0 -6px',
              borderRadius: 'var(--r-btn)',
              cursor: aoClicar ? 'pointer' : undefined,
              background: selecionado ? 'var(--bg-hover)' : undefined,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--cinza-4)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.rotulo}
              </div>
              <div className="tabular" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--cinza-3)', marginTop: 1 }}>
                {numero(item.total)}{' '}
                {item.total === 1 ? unidade.singular : unidade.plural}
              </div>
            </div>

            <div
              style={{ position: 'relative', height: ALTURA_DA_FAIXA }}
              role="img"
              aria-label={`${item.rotulo}: saldo ${item.score > 0 ? '+' : ''}${item.score} de −100 a 100`}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: variante === 'termometro' ? 'var(--cinza-1)' : 'var(--bg-trilho)',
                  borderRadius: 3,
                }}
              />
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: -3,
                  bottom: -3,
                  width: 1,
                  background: 'var(--borda-input)',
                }}
              />
              {item.score !== 0 ? (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: positivo ? '50%' : `${50 - largura}%`,
                    width: `${largura}%`,
                    background: positivo ? 'var(--turquesa-rio)' : 'var(--vermelho-pitanga)',
                    borderRadius: positivo ? '0 3px 3px 0' : '3px 0 0 3px',
                  }}
                />
              ) : null}

              {variante === 'termometro' ? (
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: `${item.score !== 0 ? (positivo ? 50 + largura : 50 - largura) : 50}%`,
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <span
                    className="tabular"
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--azul-mar)',
                      whiteSpace: 'nowrap',
                      marginBottom: 1,
                    }}
                  >
                    {item.score > 0 ? '+' : ''}
                    {item.score}
                  </span>
                  <span
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: '4px solid transparent',
                      borderRight: '4px solid transparent',
                      borderTop: '5px solid var(--azul-mar)',
                    }}
                  />
                </div>
              ) : null}
            </div>

            {variante === 'termometro' ? null : (
              <div
                className="tabular"
                style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: 'var(--azul-mar)' }}
              >
                {item.score > 0 ? '+' : ''}
                {item.score}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
