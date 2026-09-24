/** Lista ordenada com barra de proporção. Todo item é clicável e aplica o
 *  filtro correspondente — clicar de novo no mesmo item remove. */

import { useState } from 'react';
import type { ItemContado } from '@/dominio/derivacoes';
import { Barra } from '@/componentes/basicos';

export function Ranking({
  itens,
  ativo,
  aoClicar,
  cor = 'var(--azul-mar)',
  vazio = 'Sem dados no recorte.',
  detalheAoPassarMouse,
}: {
  itens: ItemContado[];
  ativo?: string;
  aoClicar?: (chave: string) => void;
  cor?: string;
  vazio?: string;
  /** Linhas extras num tooltip ao passar o mouse no item — mesma ideia de
   *  `detalheDoMes` (`BarrasEmpilhadas`) e `detalheAoPassarMouse` (`Rosca`).
   *  Quando presente, substitui o `title` nativo de "clique para filtrar":
   *  os dois ao mesmo tempo duplicariam a mesma dica em dois lugares. */
  detalheAoPassarMouse?: (chave: string) => { rotulo: string; valor: string }[];
}) {
  //: Um item em foco por vez — mouse ou teclado, o que vier primeiro.
  const [emFoco, definirEmFoco] = useState<string | null>(null);

  if (!itens.length) {
    return <div style={{ fontSize: 13, color: 'var(--cinza-2)', padding: '8px 0' }}>{vazio}</div>;
  }

  const maximo = Math.max(...itens.map((item) => item.total));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {itens.map((item) => {
        const selecionado = ativo === item.chave;
        return (
          <div
            key={item.chave}
            onClick={() => aoClicar?.(item.chave)}
            role={aoClicar ? 'button' : undefined}
            // FOCÁVEL TAMBÉM QUANDO SÓ HÁ DETALHE. O tooltip aparece no
            // `focus`, e prendê-lo ao `aoClicar` escondia o conteúdo de quem
            // navega por teclado — num ranking sem clique, o detalhe era a
            // única forma de saber o total e a participação de cada item.
            tabIndex={aoClicar || detalheAoPassarMouse ? 0 : undefined}
            onKeyDown={(evento) => {
              if (!aoClicar) return;
              if (evento.key === 'Enter' || evento.key === ' ') {
                evento.preventDefault();
                aoClicar(item.chave);
              }
            }}
            onMouseEnter={() => detalheAoPassarMouse && definirEmFoco(item.chave)}
            onMouseLeave={() => definirEmFoco(null)}
            onFocus={() => detalheAoPassarMouse && definirEmFoco(item.chave)}
            onBlur={() => definirEmFoco(null)}
            title={
              detalheAoPassarMouse
                ? undefined
                : aoClicar
                  ? selecionado
                    ? 'Clique para remover o filtro'
                    : `Filtrar por ${item.rotulo}`
                  : undefined
            }
            style={{
              position: 'relative',
              cursor: aoClicar ? 'pointer' : undefined,
              padding: '3px 6px',
              margin: '0 -6px',
              borderRadius: 'var(--r-chip)',
              background: selecionado ? 'var(--bg-hover)' : undefined,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                fontSize: 13,
                marginBottom: 5,
              }}
            >
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: selecionado ? 700 : 400,
                  color: 'var(--cinza-3)',
                }}
              >
                {item.rotulo}
              </span>
              <span
                className="tabular"
                style={{ fontWeight: 700, fontSize: 14, color: 'var(--cinza-4)', flexShrink: 0 }}
              >
                {item.total}
              </span>
            </div>
            <Barra valor={item.total} maximo={maximo} cor={item.cor ?? cor} />

            {emFoco === item.chave && detalheAoPassarMouse ? (
              <TooltipDoItem detalhe={detalheAoPassarMouse(item.chave)} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** O tooltip de um item — mesmo desenho escuro/arredondado de `BarrasEmpilhadas`
 *  e `Rosca`, acima da linha para não disputar espaço com a barra de baixo. */
function TooltipDoItem({ detalhe }: { detalhe: { rotulo: string; valor: string }[] }) {
  return (
    <div
      role="tooltip"
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        marginBottom: 6,
        zIndex: 20,
        minWidth: 150,
        background: 'var(--cinza-4)',
        color: 'var(--branco)',
        borderRadius: 'var(--r-card-int)',
        padding: '9px 12px',
        boxShadow: 'var(--sh-tooltip)',
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      {detalhe.map((linha) => (
        <div
          key={linha.rotulo}
          style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}
        >
          <span style={{ color: '#D5DAEA' }}>{linha.rotulo}</span>
          <span className="tabular">{linha.valor}</span>
        </div>
      ))}
    </div>
  );
}

/** Barra empilhada horizontal — usada em resolutividade e resultado. */
export function BarraDeComposicao({
  segmentos,
  altura = 14,
  aoClicar,
}: {
  segmentos: { chave: string; rotulo: string; total: number; cor: string }[];
  altura?: number;
  aoClicar?: (chave: string) => void;
}) {
  const total = segmentos.reduce((soma, s) => soma + s.total, 0);
  if (!total) {
    return <div style={{ height: altura, background: 'var(--bg-trilho)', borderRadius: altura / 2 }} />;
  }

  return (
    <div
      style={{
        display: 'flex',
        height: altura,
        borderRadius: 2,
        background: 'var(--bg-trilho)',
        gap: 2,
      }}
    >
      {segmentos
        .filter((segmento) => segmento.total > 0)
        .map((segmento) => (
          <div
            key={segmento.chave}
            onClick={() => aoClicar?.(segmento.chave)}
            title={`${segmento.rotulo}: ${segmento.total}`}
            style={{
              width: `${(segmento.total / total) * 100}%`,
              background: segmento.cor,
              borderRadius: 2,
              cursor: aoClicar ? 'pointer' : undefined,
            }}
          />
        ))}
    </div>
  );
}
