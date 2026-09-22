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

import { useState } from 'react';
import type { ItemContado } from '@/dominio/derivacoes';
import { numero, percentual } from '@/dominio/formato';

const TAMANHO_PADRAO = 168;
const ESPESSURA_PADRAO = 24;

export function Rosca({
  itens,
  ativo,
  aoClicar,
  rotuloCentral,
  detalheAoPassarMouse,
  vazio = 'Nenhum registro no recorte.',
  tamanho = TAMANHO_PADRAO,
  espessura = ESPESSURA_PADRAO,
}: {
  itens: ItemContado[];
  ativo?: string;
  aoClicar?: (chave: string) => void;
  /** O texto abaixo do número, no centro — "interações", por exemplo. */
  rotuloCentral?: string;
  /** Linhas extras no tooltip ao passar o mouse numa fatia — mesma ideia de
   *  `detalheDoMes` em `BarrasEmpilhadas`: quem desenha a rosca não precisa
   *  saber o que são essas linhas, só que existem. */
  detalheAoPassarMouse?: (chave: string) => { rotulo: string; valor: string }[];
  vazio?: string;
  /** Diâmetro do círculo em px. Opcional — a maioria dos usos (Top 5
   *  instituições, por tier...) fica no padrão; "% de Interações por Temas"
   *  pede uma rosca maior, sem mudar as outras. */
  tamanho?: number;
  /** Espessura do anel — não escala junto com `tamanho` automaticamente;
   *  quem pedir uma rosca maior e quiser o traço proporcionalmente mais
   *  grosso passa os dois. */
  espessura?: number;
}) {
  //: Uma fatia em foco por vez — mouse ou teclado, o que vier primeiro.
  const [emFoco, definirEmFoco] = useState<string | null>(null);
  const total = itens.reduce((soma, item) => soma + item.total, 0);
  const TAMANHO = tamanho;
  const ESPESSURA = espessura;
  const RAIO = (TAMANHO - ESPESSURA) / 2;
  const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

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
    // LARGURA TRAVADA NO TAMANHO DO CÍRCULO: sem isto, uma legenda com um
    // rótulo longo (uma área como "Relações com Investidores", por exemplo)
    // esticaria a coluna inteira em vez de truncar em reticências — e num
    // cartão com a rosca lado a lado de outra coisa (ver "Interações por
    // áreas" no Painel), isso empurra o vizinho para a linha de baixo.
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18,
        width: TAMANHO,
      }}
    >
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
                onMouseEnter={() => definirEmFoco(item.chave)}
                onMouseLeave={() => definirEmFoco(null)}
                onFocus={() => definirEmFoco(item.chave)}
                onBlur={() => definirEmFoco(null)}
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

        {emFoco && detalheAoPassarMouse ? (
          <TooltipDaFatia
            item={visiveis.find((item) => item.chave === emFoco)!}
            total={total}
            detalhe={detalheAoPassarMouse(emFoco)}
          />
        ) : null}
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

/** O tooltip de uma fatia — mesmo desenho do tooltip de `BarrasEmpilhadas`
 *  (fundo escuro, cantos arredondados, `pointerEvents: 'none'` para não
 *  disputar o hover com a própria fatia). Centralizado acima da rosca: com
 *  uma fatia só em foco por vez, não há necessidade da lógica de "encostar
 *  na borda" que a barra empilhada precisa para dezenas de colunas. */
function TooltipDaFatia({
  item,
  total,
  detalhe,
}: {
  item: ItemContado;
  total: number;
  detalhe: { rotulo: string; valor: string }[];
}) {
  return (
    <div
      role="tooltip"
      style={{
        position: 'absolute',
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginBottom: 10,
        zIndex: 20,
        minWidth: 210,
        background: 'var(--cinza-4)',
        color: 'var(--branco)',
        borderRadius: 'var(--r-card-int)',
        padding: '11px 13px',
        boxShadow: 'var(--sh-tooltip)',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 7,
        }}
      >
        <span>{item.rotulo}</span>
        <span className="tabular">
          {numero(item.total)} ({percentual(item.total, total)})
        </span>
      </div>

      {detalhe.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontSize: 11, color: '#8C91A4', marginBottom: 2 }}>Top instituições</div>
          {detalhe.map((linha) => (
            <div
              key={linha.rotulo}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}
            >
              <span
                style={{
                  color: '#D5DAEA',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 150,
                }}
              >
                {linha.rotulo}
              </span>
              {/* A COR DA FATIA EM FOCO, e não branco neutro — é o que liga
                  visualmente esta lista de instituições de volta à fatia que
                  o mouse está sobre, sem precisar repetir o nome do tier na
                  frente de cada linha. */}
              <span className="tabular" style={{ color: item.cor ?? 'var(--branco)', fontWeight: 700 }}>
                {linha.valor}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: '#8C91A4' }}>Sem instituição registrada.</div>
      )}
    </div>
  );
}
