/** Barra divergente horizontal — um tema por linha, pior no topo.
 *
 *  SEM LEGENDA DE PROPÓSITO: a cor já diz tudo que precisa (laranja/vermelho
 *  é "abaixo de zero", turquesa é "acima"), o rótulo está em cada linha, e o
 *  valor com sinal está em cada ponta. Uma legenda repetiria informação que
 *  já está na própria linha.
 *
 *  A PONTA ARREDONDADA fica sempre no lado do DADO, nunca no lado do zero —
 *  é a mesma regra de `BarrasEmpilhadas`: a barra cresce de uma base (aqui, o
 *  centro) e o arredondamento marca onde ela termina.
 *
 *  CLICAR NUMA LINHA ABRE AS AGENDAS QUE COMPÕEM AQUELE NÚMERO. O score é um
 *  resumo, e todo resumo esconde caso — "6 agendas" só vira confiável quando
 *  dá para checar quais são as seis. Clicar de novo fecha; clicar numa
 *  agenda da lista aberta navega até ela, se `aoAbrirAgenda` existir.
 */

import { useState } from 'react';
import type { ScoreDeTema } from '@/dominio/derivacoes';
import { CORES_DE_CLIMA } from '@/dominio/frentes';
import { dataCompleta } from '@/dominio/formato';

const ALTURA_DA_FAIXA = 10;

/** "4 reativas, 2 neutras" — só o que não for zero, na ordem que mais
 *  importa para quem lê o score.
 *
 *  SEM ISTO, o score sozinho engana: -67 sai tanto de 4 reativas em 6
 *  quanto de 2 reativas em 3 com o resto neutro — a neutra nunca aparece na
 *  barra, só dilui o placar. Escrever a composição por extenso é o que
 *  fecha essa lacuna sem precisar desenhar um segundo gráfico.
 *
 *  "Reativa"/"proativa", e não "negativa"/"positiva" — o mesmo par que
 *  `clima` usa agora (`Proativo`/`Reativo`/`Neutro`, ver a migração
 *  `0030_clima_proativo_reativo.sql`). `item.positivas`/`item.negativas`
 *  continuam com esses nomes: são o mesmo campo que soma `clima ===
 *  'propositivo'`/`'tenso'`, e o código desses climas não mudou. */
function pluralizar(quantidade: number, singular: string): string {
  return `${quantidade} ${singular}${quantidade === 1 ? '' : 's'}`;
}

function composicao(item: ScoreDeTema): string {
  const neutras = item.total - item.positivas - item.negativas;
  const partes: string[] = [];
  if (item.negativas > 0) partes.push(pluralizar(item.negativas, 'reativa'));
  if (neutras > 0) partes.push(pluralizar(neutras, 'neutra'));
  if (item.positivas > 0) partes.push(pluralizar(item.positivas, 'proativa'));
  return partes.join(', ');
}

export function BarraDivergente({
  itens,
  aoAbrirAgenda,
}: {
  itens: ScoreDeTema[];
  /** Navega até a Ficha da agenda. Sem isto, a linha ainda abre a lista —
   *  só não dá para ir além dela. */
  aoAbrirAgenda?: (id: string) => void;
}) {
  //: Uma aberta por vez. Duas listas abertas ao mesmo tempo brigam por
  //: espaço vertical e confundem qual "Ver agendas" pertence a qual tema.
  const [aberto, definirAberto] = useState<string | null>(null);

  if (!itens.length) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--cinza-2)' }}>
        Nenhum tema com clima registrado neste recorte.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {itens.map((item) => {
        const positivo = item.score >= 0;
        const largura = Math.min(50, Math.abs(item.score) / 2);
        const expandido = aberto === item.chave;

        return (
          <div key={item.chave}>
            <div
              role="button"
              tabIndex={0}
              aria-expanded={expandido}
              onClick={() => definirAberto(expandido ? null : item.chave)}
              onKeyDown={(evento) => {
                if (evento.key !== 'Enter' && evento.key !== ' ') return;
                evento.preventDefault();
                definirAberto(expandido ? null : item.chave);
              }}
              title={`${composicao(item)} — clique para ver as interações`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2.2fr) 48px',
                alignItems: 'center',
                gap: 14,
                padding: '5px 6px',
                margin: '0 -6px',
                borderRadius: 'var(--r-btn)',
                cursor: 'pointer',
                background: expandido ? 'var(--bg-hover)' : undefined,
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
                <div style={{ fontSize: 11, color: 'var(--cinza-2)', marginTop: 1 }}>
                  {item.total} {item.total === 1 ? 'interação' : 'interações'} — {composicao(item)}
                </div>
              </div>

              <div style={{ position: 'relative', height: ALTURA_DA_FAIXA }}>
                {/* O trilho inteiro, recessivo — é o "0 a 100" dos dois lados. */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'var(--bg-trilho)',
                    borderRadius: 3,
                  }}
                />
                {/* A linha de zero — o único ponto que toda barra usa de base. */}
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
              </div>

              <div
                className="tabular"
                style={{
                  textAlign: 'right',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--azul-mar)',
                }}
              >
                {item.score > 0 ? '+' : ''}
                {item.score}
              </div>
            </div>

            {expandido ? (
              <div
                style={{
                  margin: '2px -6px 6px',
                  padding: '8px 10px',
                  background: 'var(--bg-trilho)',
                  borderRadius: 'var(--r-card-int)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {item.agendas.map((agenda) => (
                  <button
                    key={agenda.id}
                    type="button"
                    disabled={!aoAbrirAgenda}
                    onClick={(evento) => {
                      // Sem isto, o clique também fecharia/reabriria a
                      // linha por cima — os dois cliques disputariam o
                      // mesmo gesto.
                      evento.stopPropagation();
                      aoAbrirAgenda?.(agenda.id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      border: 'none',
                      borderRadius: 'var(--r-btn)',
                      background: 'transparent',
                      textAlign: 'left',
                      cursor: aoAbrirAgenda ? 'pointer' : 'default',
                      fontSize: 12.5,
                      color: 'var(--cinza-4)',
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: CORES_DE_CLIMA[agenda.clima] ?? 'var(--cinza-2)',
                      }}
                    />
                    <span style={{ flexShrink: 0, color: 'var(--cinza-2)' }}>
                      {dataCompleta(agenda.data)}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {agenda.titulo}
                    </span>
                    {aoAbrirAgenda ? (
                      <span aria-hidden style={{ color: 'var(--cinza-2)', flexShrink: 0 }}>
                        →
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
