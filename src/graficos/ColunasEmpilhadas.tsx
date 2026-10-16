/** Barras DEITADAS empilhadas por sentimento, em QUANTIDADE (não 100%), do maior
 *  para o menor total, de cima para baixo — as abas do painel de aprofundamento
 *  (N1 › N2 › N3). A conta mora em `dominio/colunasEmpilhadas`.
 *
 *  DEITADAS, por pedido: o rótulo fica inteiro numa linha à esquerda e a barra
 *  cresce para a direita. Em pé, os nomes dos subtemas só cabiam cortados.
 *
 *  CADA BARRA É UM BOTÃO quando há para onde descer: clicar empilha o valor no
 *  recorte do painel, como a barra de 100% fazia antes.
 *
 *  MUITAS BARRAS ROLAM NA VERTICAL dentro do painel (os subtemas são até 104),
 *  com a legenda parada em cima.
 */

import { useId } from 'react';

import { numero } from '@/dominio/formato';
import { ordenarPeloTotal, topoDaEscala, totalDa } from '@/dominio/colunasEmpilhadas';
import type { ColunaDeSentimento } from '@/dominio/colunasEmpilhadas';

//: AS CORES DO SENTIMENTO DAS OUTRAS PEÇAS DO DOSSIÊ (`PecasDoDossie`), para o
//: painel e os cartões se lerem igual.
const CORES_PADRAO: [string, string, string] = ['var(--ok-fg)', 'var(--cinza-1)', 'var(--erro-fg)'];
const ALTURA_MAXIMA = 440;

export function ColunasEmpilhadas({
  itens,
  legenda = ['Positivo', 'Neutro', 'Negativo'],
  cores = CORES_PADRAO,
  vazio = 'Sem dado no mês.',
  aoClicar,
}: {
  itens: ColunaDeSentimento[];
  legenda?: [string, string, string] | string[];
  cores?: [string, string, string] | string[];
  vazio?: string;
  aoClicar?: (rotulo: string) => void;
}) {
  const idDaLegenda = useId();
  if (!itens.length) {
    return <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>{vazio}</p>;
  }
  const barras = ordenarPeloTotal(itens);
  const topo = topoDaEscala(barras);
  const [rotuloPos, rotuloNeu, rotuloNeg] = legenda;
  const [corPos, corNeu, corNeg] = cores;

  return (
    <div>
      <div
        id={idDaLegenda}
        style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--cinza-3)', marginBottom: 10 }}
      >
        {[
          [rotuloPos, corPos],
          [rotuloNeu, corNeu],
          [rotuloNeg, corNeg],
        ].map(([rotulo, cor]) => (
          <span key={rotulo} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 2, background: cor }} />
            {rotulo}
          </span>
        ))}
        {aoClicar ? (
          <span style={{ marginLeft: 'auto', color: 'var(--cinza-2)' }}>Clique numa barra para descer</span>
        ) : null}
      </div>

      <div className="rolagem-interna" style={{ maxHeight: ALTURA_MAXIMA, overflowY: 'auto', paddingRight: 4 }}>
        <ul
          aria-describedby={idDaLegenda}
          style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}
        >
          {barras.map((barra) => {
            const total = totalDa(barra);
            const largura = (total / topo) * 100;
            const descricao =
              `${barra.rotulo}: ${numero(total)} ${total === 1 ? 'menção' : 'menções'} — ` +
              `${numero(barra.positivo)} ${rotuloPos.toLowerCase()}, ${numero(barra.neutro)} ` +
              `${rotuloNeu.toLowerCase()}, ${numero(barra.negativo)} ${rotuloNeg.toLowerCase()}`;
            const corpo = (
              <>
                <span
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.3,
                    color: 'var(--cinza-4)',
                    textAlign: 'right',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {barra.rotulo}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span
                    aria-hidden
                    style={{
                      display: 'flex',
                      width: `${largura}%`,
                      minWidth: total ? 3 : 0,
                      height: 16,
                      borderRadius: '0 4px 4px 0',
                      overflow: 'hidden',
                      gap: 2,
                      background: 'var(--branco)',
                    }}
                  >
                    {/* DA ESQUERDA PARA A DIREITA: positivo, neutro, negativo — a
                        mesma ordem da barra de 100% do topo do painel. */}
                    {[
                      [barra.positivo, corPos],
                      [barra.neutro, corNeu],
                      [barra.negativo, corNeg],
                    ].map(([valor, cor], indice) =>
                      Number(valor) > 0 ? (
                        <span key={indice} style={{ flex: `${valor} 0 0`, background: String(cor) }} />
                      ) : null,
                    )}
                  </span>
                  <span className="tabular" style={{ fontSize: 12, fontWeight: 700, color: 'var(--cinza-4)', flex: '0 0 auto' }}>
                    {numero(total)}
                  </span>
                </span>
              </>
            );
            const estilo = {
              display: 'grid',
              gridTemplateColumns: 'minmax(140px, 32%) 1fr',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              padding: '5px 6px',
              border: 'none',
              background: 'transparent',
              font: 'inherit',
              textAlign: 'left' as const,
            };
            return (
              <li key={barra.rotulo} title={descricao}>
                {aoClicar ? (
                  <button
                    type="button"
                    className="coluna-empilhada"
                    aria-label={`${descricao}. Abrir este recorte.`}
                    onClick={() => aoClicar(barra.rotulo)}
                    style={{ ...estilo, cursor: 'pointer', borderRadius: 6 }}
                  >
                    {corpo}
                  </button>
                ) : (
                  <span role="img" aria-label={descricao} style={estilo}>
                    {corpo}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
