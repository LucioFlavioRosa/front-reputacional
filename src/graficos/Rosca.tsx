/** Rosca (donut) proporcional, com o total no centro — SVG puro, como o
 *  resto do produto (`MapaUf`): nenhuma biblioteca de gráfico entra por um
 *  círculo só.
 *
 *  CADA FATIA É UM `<circle>` com `stroke-dasharray`/`stroke-dashoffset`: o
 *  trilho de baixo é um círculo inteiro na cor recessiva, e cada fatia por
 *  cima desenha só o trecho que lhe cabe, com um vão de 2px na cor da
 *  superfície separando uma da outra — a mesma regra de `BarrasEmpilhadas`.
 *  O `<svg>` gira -90° para a primeira fatia nascer às 12h, e não às 3h (o
 *  zero do círculo trigonométrico).
 */

import type { ItemContado } from '@/dominio/derivacoes';
import { numero, percentual } from '@/dominio/formato';

const TAMANHO = 168;
const ESPESSURA = 24;
const RAIO = (TAMANHO - ESPESSURA) / 2;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

export function Rosca({
  itens,
  ativo,
  aoClicar,
  rotuloCentral,
  vazio = 'Nenhum registro no recorte.',
}: {
  itens: ItemContado[];
  ativo?: string;
  aoClicar?: (chave: string) => void;
  /** O texto abaixo do número, no centro — "interações", por exemplo. */
  rotuloCentral?: string;
  vazio?: string;
}) {
  const total = itens.reduce((soma, item) => soma + item.total, 0);

  if (!total) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--cinza-2)' }}>
        {vazio}
      </div>
    );
  }

  const visiveis = itens.filter((item) => item.total > 0);
  // O vão entre fatias é o fundo do cartão, nunca um contorno — some quando
  // só sobra uma fatia (nada para separar dela mesma).
  const vao = visiveis.length > 1 ? 2 : 0;

  // O DESLOCAMENTO DE CADA FATIA VEM DE UM `reduce`, e não de uma variável
  // reatribuída dentro do `.map` de baixo: `.map` é a função que desenha, e
  // misturar "calcular onde cada fatia começa" com "desenhar a fatia" no
  // mesmo laço deixa o acumulador vivo entre execuções do componente.
  const arcos = visiveis.reduce<{ comprimento: number; offset: number }[]>((acc, item) => {
    const comprimento = (item.total / total) * CIRCUNFERENCIA;
    const offsetAnterior = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].comprimento : 0;
    return [...acc, { comprimento, offset: offsetAnterior }];
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <div style={{ position: 'relative', width: TAMANHO, height: TAMANHO, flexShrink: 0 }}>
        <svg
          width={TAMANHO}
          height={TAMANHO}
          style={{ transform: 'rotate(-90deg)' }}
          role="img"
          aria-label={`Total: ${numero(total)}${rotuloCentral ? ` ${rotuloCentral}` : ''}`}
        >
          <circle
            cx={TAMANHO / 2}
            cy={TAMANHO / 2}
            r={RAIO}
            fill="none"
            stroke="var(--bg-trilho)"
            strokeWidth={ESPESSURA}
          />
          {visiveis.map((item, indice) => {
            const { comprimento, offset } = arcos[indice];
            const selecionado = ativo === item.chave;

            return (
              <circle
                key={item.chave}
                cx={TAMANHO / 2}
                cy={TAMANHO / 2}
                r={RAIO}
                fill="none"
                stroke={item.cor ?? 'var(--azul-mar)'}
                strokeWidth={selecionado ? ESPESSURA + 4 : ESPESSURA}
                strokeDasharray={`${Math.max(comprimento - vao, 0)} ${CIRCUNFERENCIA}`}
                strokeDashoffset={-offset}
                style={{
                  cursor: aoClicar ? 'pointer' : undefined,
                  transition: 'stroke-width .12s',
                }}
                onClick={() => aoClicar?.(item.chave)}
              >
                <title>{`${item.rotulo}: ${numero(item.total)} (${percentual(item.total, total)})`}</title>
              </circle>
            );
          })}
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <span
            className="tabular"
            style={{ fontSize: 26, fontWeight: 700, color: 'var(--azul-mar)', lineHeight: 1.1 }}
          >
            {numero(total)}
          </span>
          {rotuloCentral ? (
            <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>{rotuloCentral}</span>
          ) : null}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
        {itens.map((item) => {
          const selecionado = ativo === item.chave;
          return (
            <button
              key={item.chave}
              type="button"
              onClick={() => aoClicar?.(item.chave)}
              title={
                aoClicar
                  ? selecionado
                    ? 'Clique para remover o filtro'
                    : `Filtrar por ${item.rotulo}`
                  : undefined
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: selecionado ? 'var(--bg-hover)' : 'none',
                border: 'none',
                borderRadius: 7,
                padding: '3px 6px',
                margin: '0 -6px',
                cursor: aoClicar ? 'pointer' : 'default',
                textAlign: 'left',
                font: 'inherit',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 2,
                  background: item.cor ?? 'var(--azul-mar)',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 12.5,
                  color: selecionado ? 'var(--cinza-4)' : 'var(--cinza-3)',
                  fontWeight: selecionado ? 700 : 400,
                }}
              >
                {item.rotulo}
              </span>
              <span className="tabular" style={{ fontSize: 12, color: 'var(--cinza-2)', flexShrink: 0 }}>
                {percentual(item.total, total)}
              </span>
              <span
                className="tabular"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--cinza-4)',
                  minWidth: 26,
                  textAlign: 'right',
                  flexShrink: 0,
                }}
              >
                {numero(item.total)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
