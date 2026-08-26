/** Lista ordenada com barra de proporção. Todo item é clicável e aplica o
 *  filtro correspondente — clicar de novo no mesmo item remove. */

import type { ItemContado } from '@/dominio/derivacoes';
import { Barra } from '@/componentes/basicos';

export function Ranking({
  itens,
  ativo,
  aoClicar,
  cor = 'var(--azul-mar)',
  vazio = 'Sem dados no recorte.',
}: {
  itens: ItemContado[];
  ativo?: string;
  aoClicar?: (chave: string) => void;
  cor?: string;
  vazio?: string;
}) {
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
            tabIndex={aoClicar ? 0 : undefined}
            onKeyDown={(evento) => {
              if (!aoClicar) return;
              if (evento.key === 'Enter' || evento.key === ' ') {
                evento.preventDefault();
                aoClicar(item.chave);
              }
            }}
            title={
              aoClicar
                ? selecionado
                  ? 'Clique para remover o filtro'
                  : `Filtrar por ${item.rotulo}`
                : undefined
            }
            style={{
              cursor: aoClicar ? 'pointer' : undefined,
              padding: '2px 6px',
              margin: '0 -6px',
              borderRadius: 7,
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
              <span className="tabular" style={{ fontWeight: 700, flexShrink: 0 }}>
                {item.total}
              </span>
            </div>
            <Barra valor={item.total} maximo={maximo} cor={item.cor ?? cor} />
          </div>
        );
      })}
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
        borderRadius: 4,
        background: 'var(--bg-trilho)',
        // Quem separa os segmentos é o vão na cor da superfície, nunca um
        // contorno desenhado em volta da marca.
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
              borderRadius: 3,
              cursor: aoClicar ? 'pointer' : undefined,
            }}
          />
        ))}
    </div>
  );
}
