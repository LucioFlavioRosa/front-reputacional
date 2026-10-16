/** Colunas empilhadas por sentimento, em QUANTIDADE (não 100%), do maior para o
 *  menor total — as abas do painel de aprofundamento. A conta mora em
 *  `dominio/colunasEmpilhadas`.
 *
 *  CADA COLUNA É UM BOTÃO quando há para onde descer: clicar empilha o valor no
 *  recorte do painel (N1 › N2 › N3), como a barra fazia antes.
 *
 *  MUITAS COLUNAS ROLAM NA HORIZONTAL, e não encolhem: os subtemas são até 104,
 *  e uma coluna de 8px com rótulo ilegível não responde nada. Cada coluna tem
 *  largura mínima e o rótulo inteiro aparece ao passar o mouse.
 */

import { useId } from 'react';

import { numero } from '@/dominio/formato';
import { ordenarPeloTotal, topoDaEscala, totalDa } from '@/dominio/colunasEmpilhadas';
import type { ColunaDeSentimento } from '@/dominio/colunasEmpilhadas';

//: AS CORES DO SENTIMENTO DAS OUTRAS PEÇAS DO DOSSIÊ (`PecasDoDossie`), para o
//: painel e os cartões se lerem igual.
const CORES_PADRAO: [string, string, string] = ['var(--ok-fg)', 'var(--cinza-1)', 'var(--erro-fg)'];
const ALTURA_DA_AREA = 200;

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
  const colunas = ordenarPeloTotal(itens);
  const topo = topoDaEscala(colunas);
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
          <span style={{ marginLeft: 'auto', color: 'var(--cinza-2)' }}>Clique numa coluna para descer</span>
        ) : null}
      </div>

      <div className="rolagem-interna" style={{ overflowX: 'auto', overflowY: 'hidden', paddingBottom: 4 }}>
        <ul
          aria-describedby={idDaLegenda}
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 10,
            minWidth: '100%',
            width: 'max-content',
          }}
        >
          {colunas.map((coluna) => {
            const total = totalDa(coluna);
            const altura = (total / topo) * ALTURA_DA_AREA;
            const descricao =
              `${coluna.rotulo}: ${numero(total)} ${total === 1 ? 'menção' : 'menções'} — ` +
              `${numero(coluna.positivo)} ${rotuloPos.toLowerCase()}, ${numero(coluna.neutro)} ` +
              `${rotuloNeu.toLowerCase()}, ${numero(coluna.negativo)} ${rotuloNeg.toLowerCase()}`;
            const corpo = (
              <>
                <span className="tabular" style={{ fontSize: 12, fontWeight: 700, color: 'var(--cinza-4)' }}>
                  {numero(total)}
                </span>
                <span
                  aria-hidden
                  style={{
                    display: 'flex',
                    flexDirection: 'column-reverse',
                    width: '100%',
                    height: altura,
                    minHeight: total ? 3 : 0,
                    borderRadius: '4px 4px 0 0',
                    overflow: 'hidden',
                    gap: 1,
                    background: 'var(--branco)',
                  }}
                >
                  {/* DE BAIXO PARA CIMA: positivo, neutro, negativo — a mesma
                      ordem da esquerda para a direita da barra de 100%. */}
                  {[
                    [coluna.positivo, corPos],
                    [coluna.neutro, corNeu],
                    [coluna.negativo, corNeg],
                  ].map(([valor, cor], indice) =>
                    Number(valor) > 0 ? (
                      <span key={indice} style={{ flex: `${valor} 0 0`, background: String(cor) }} />
                    ) : null,
                  )}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    lineHeight: 1.3,
                    color: 'var(--cinza-3)',
                    textAlign: 'center',
                    hyphens: 'auto',
                    overflowWrap: 'anywhere',
                    height: '3.9em',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {coluna.rotulo}
                </span>
              </>
            );
            const estilo = {
              display: 'flex',
              flexDirection: 'column' as const,
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 4,
              width: 88,
              height: ALTURA_DA_AREA + 72,
              padding: '0 2px',
              border: 'none',
              background: 'transparent',
              font: 'inherit',
            };
            return (
              <li key={coluna.rotulo} title={descricao} style={{ flex: '0 0 auto' }}>
                {aoClicar ? (
                  <button
                    type="button"
                    className="coluna-empilhada"
                    aria-label={`${descricao}. Abrir este recorte.`}
                    onClick={() => aoClicar(coluna.rotulo)}
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
