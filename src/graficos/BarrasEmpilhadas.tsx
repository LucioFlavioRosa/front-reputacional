/** Barras empilhadas por mês, com tooltip na coluna.
 *
 *  Especificações de marca seguidas aqui:
 *   - coluna com no máximo 24px de espessura — a sobra do slot vira ar, não barra;
 *   - ponta arredondada em 3px no topo e reta na linha de base, porque a barra
 *     cresce de uma base só (o guia pedia 4px; um pouco menos a pedido do
 *     usuário);
 *   - 2px de vão na cor da superfície entre segmentos empilhados: quem separa é
 *     o branco, nunca um contorno desenhado em volta da marca;
 *   - o TOTAL vai em cima de TODA coluna, não só do pico e da mais recente —
 *     era assim antes, e uma leitura pediu para ver o valor de cada uma sem
 *     precisar passar o mouse por elas. O EIXO DE BAIXO (a data) continua
 *     seletivo: é texto mais largo, e junto de dezenas de colunas (semana) um
 *     rótulo por coluna colide com o vizinho — ver `LIMITE_DE_ROTULOS_NO_EIXO`.
 *
 *  O total vai numa faixa de altura fixa ACIMA do trilho e o mês ABAIXO, nunca
 *  dentro da barra: um mês zerado não teria onde escrever e desalinharia a régua.
 */

import { useState } from 'react';
import type { ColunaMensal, Segmento } from '@/dominio/derivacoes';
import { percentual, rotuloDoMes } from '@/dominio/formato';

const ALTURA_DO_ROTULO = 16;
const ALTURA_DO_MES = 14;
const ESPESSURA_MAXIMA = 24;
//: 2px é a especificação: o vão que separa é sempre a cor da superfície, nunca
//: um contorno. O problema do print não era a largura do vão — era a barra
//: baixa demais para um vão de QUALQUER largura não comer uma fatia grande
//: dela. A correção certa é dar mais altura à pilha (ver `altura` em
//: `Painel.tsx`), não encolher o espaçador até ele deixar de separar.
const VAO_ENTRE_SEGMENTOS = 2;

export function BarrasEmpilhadas({
  colunas,
  altura = 150,
  aoClicarSegmento,
  aoClicarMes,
  mesAtivo,
  detalheDoMes,
  detalheDoSegmento,
  formatarRotulo = rotuloDoMes,
  escala = 'absoluta',
}: {
  colunas: ColunaMensal[];
  altura?: number;
  /** `'absoluta'` (padrão): a altura da coluna é o volume, contra um máximo
   *  global — compara-se quanto aconteceu em cada período. `'percentual'`:
   *  toda coluna com registro enche a altura inteira, e o que varia é a
   *  fatia de cada categoria — compara-se a COMPOSIÇÃO, não o volume. O
   *  total continua no topo e no tooltip, com a % ao lado de cada fatia. */
  escala?: 'absoluta' | 'percentual';
  /** A faixa colorida clicada. `mes` é a coluna de onde veio, para quem
   *  filtra por eixos diferentes conforme a coluna — Antes × Depois na
   *  tela Preparar agenda; quem não precisa ignora o segundo argumento. */
  aoClicarSegmento?: (chave: string, mes: string) => void;
  /** Clique na COLUNA inteira, e não num segmento dela. Quem usa os dois
   *  escolhe o eixo pelo alvo: a faixa colorida filtra a categoria, o resto da
   *  coluna filtra o mês. */
  aoClicarMes?: (mes: string) => void;
  /** O mês em destaque, quando a tela mantém um escolhido. */
  mesAtivo?: string;
  /** Linhas extras no tooltip — Tier 1 e tema dominante, por exemplo. */
  detalheDoMes?: (coluna: ColunaMensal) => { rotulo: string; valor: string }[];
  /** Linhas extras ao passar o mouse num SEGMENTO da pilha — a mesma ideia
   *  de `detalheAoPassarMouse` na rosca de "Interações por tier": quem desenha
   *  a barra não precisa saber o que são (instituições daquele tier, no
   *  histórico), só que existem. */
  detalheDoSegmento?: (
    coluna: ColunaMensal,
    chave: string,
  ) => { rotulo: string; valor: string }[];
  /** Como ler `coluna.mes` em texto. Default `rotuloDoMes`; o Painel passa
   *  outra quando a coluna é semana ou semestre, e a Preparar agenda passa a
   *  identidade (as colunas são "Antes"/"Depois") — o gráfico em si não sabe
   *  nem precisa saber o que gerou a chave, só que existe um jeito de mostrá-la. */
  formatarRotulo?: (chave: string) => string;
}) {
  const [emFoco, setEmFoco] = useState<number | null>(null);
  const [segmentoEmFoco, setSegmentoEmFoco] = useState<string | null>(null);

  if (!colunas.length) {
    return (
      <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--cinza-2)' }}>
        Sem registros no recorte.
      </div>
    );
  }

  const maximo = Math.max(1, ...colunas.map((c) => c.total));
  const alturaDoTrilho = altura - ALTURA_DO_ROTULO - ALTURA_DO_MES;

  const indiceDoUltimo = colunas.length - 1;

  // O EIXO DE BAIXO (a data por extenso) não tinha a mesma seleção: toda
  // coluna escrevia a sua, e em semana — dezenas de colunas estreitas no
  // mesmo cartão — o texto de uma invadia a coluna vizinha e virava uma
  // sequência ilegível de números colados. `LIMITE_DE_ROTULOS_NO_EIXO` limita
  // quantos rótulos aparecem soltos no eixo, espaçados por um passo fixo; o
  // hover continua revelando a data exata de QUALQUER coluna (`emFoco`), e a
  // mais recente sempre aparece, do mesmo jeito que o total já fazia acima.
  const LIMITE_DE_ROTULOS_NO_EIXO = 12;
  const passoDoRotulo = Math.max(1, Math.ceil(colunas.length / LIMITE_DE_ROTULOS_NO_EIXO));

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
      {colunas.map((coluna, indice) => {
        const alturaDaBarra =
          escala === 'percentual'
            ? coluna.total > 0
              ? alturaDoTrilho
              : 0
            : (coluna.total / maximo) * alturaDoTrilho;

        // Uma pilha de N segmentos precisa de N×2px de altura mínima mais
        // (N-1)×2px de vão. Numa coluna baixa com muitas frentes isso passa da
        // altura proporcional, e a barra vazaria para cima — mentindo sobre o
        // valor. Quando aperta, o vão e o mínimo saem: os segmentos viram
        // fatias proporcionais e o tooltip continua com todos os números.
        const quantidade = coluna.segmentos.length;
        const alturaNecessaria =
          quantidade * 2 + Math.max(0, quantidade - 1) * VAO_ENTRE_SEGMENTOS;
        const apertada = alturaDaBarra < alturaNecessaria;
        const alturaEfetiva = Math.max(coluna.total ? 3 : 0, alturaDaBarra);

        // Colunas das pontas alinham o tooltip pela borda, senão ele vazaria
        // para fora do card.
        const naEsquerda = indice <= 1;
        const naDireita = indice >= colunas.length - 2;

        return (
          <div
            key={coluna.mes}
            style={{
              flex: 1,
              minWidth: 0,
              position: 'relative',
              cursor: aoClicarMes ? 'pointer' : undefined,
              // O destaque vai no trilho inteiro, e não na barra: um mês sem
              // registro também precisa poder aparecer como o escolhido.
              background: mesAtivo === coluna.mes ? 'var(--bg-hover)' : undefined,
              borderRadius: 7,
            }}
            onClick={aoClicarMes ? () => aoClicarMes(coluna.mes) : undefined}
            onKeyDown={
              aoClicarMes
                ? (evento) => {
                    if (evento.key !== 'Enter' && evento.key !== ' ') return;
                    evento.preventDefault();
                    aoClicarMes(coluna.mes);
                  }
                : undefined
            }
            onMouseEnter={() => setEmFoco(indice)}
            onMouseLeave={() => {
              setEmFoco(null);
              setSegmentoEmFoco(null);
            }}
            onFocus={() => setEmFoco(indice)}
            onBlur={() => {
              setEmFoco(null);
              setSegmentoEmFoco(null);
            }}
            tabIndex={0}
            role={aoClicarMes ? 'button' : undefined}
            aria-pressed={aoClicarMes ? mesAtivo === coluna.mes : undefined}
            aria-label={`${formatarRotulo(coluna.mes)}: ${coluna.total}`}
          >
            <div
              style={{
                height: alturaDoTrilho,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'center',
                position: 'relative',
                // A régua que faltava: sem ela, as colunas flutuavam soltas no
                // cartão branco, sem uma base comum para o olho comparar altura
                // contra ela. Hairline recessiva, um tom fora da superfície —
                // nunca tracejada, que leria como projeção.
                borderBottom: '1px solid var(--borda)',
              }}
            >
              {/* O número total agora acompanha dinamicamente a altura exata da barra */}
              <div
                style={{
                  position: 'absolute',
                  bottom: alturaEfetiva + 4,
                  height: ALTURA_DO_ROTULO,
                  width: '100%',
                  fontSize: 11,
                  fontWeight: 700,
                  textAlign: 'center',
                  color: 'var(--cinza-4)',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {coluna.total > 0 ? coluna.total : ''}
              </div>

              <div
                style={{
                  width: '100%',
                  maxWidth: ESPESSURA_MAXIMA,
                  height: alturaEfetiva,
                  display: 'flex',
                  flexDirection: 'column',
                  // O vão é feito com gap na cor da superfície, não com borda.
                  gap: apertada ? 0 : VAO_ENTRE_SEGMENTOS,
                }}
              >
                {coluna.segmentos.map((segmento, posicao) => (
                  <div
                    key={segmento.chave}
                    onClick={(evento) => {
                      if (!aoClicarSegmento) return;
                      // Sem isto o clique no segmento também escolheria o mês,
                      // e a tela aplicaria dois filtros de uma vez.
                      evento.stopPropagation();
                      aoClicarSegmento(segmento.chave, coluna.mes);
                    }}
                    onMouseEnter={
                      detalheDoSegmento
                        ? () => setSegmentoEmFoco(segmento.chave)
                        : undefined
                    }
                    title={
                      detalheDoSegmento
                        ? undefined
                        : escala === 'percentual'
                          ? `${segmento.rotulo}: ${segmento.total} · ${percentual(segmento.total, coluna.total)}`
                          : `${segmento.rotulo}: ${segmento.total}`
                    }
                    style={{
                      flex: segmento.total,
                      minHeight: apertada ? 0 : 2,
                      background: segmento.cor,
                      // Ponta arredondada no topo da pilha; reta na base.
                      borderRadius: posicao === 0 ? '3px 3px 0 0' : 0,
                      // Anel interno sutil, não um contorno: o validador de
                      // paleta aponta turquesa/laranja/amarelo abaixo de 3:1
                      // contra o branco do cartão — sem isto, o segmento pálido
                      // se dissolve na superfície em vez de ler como forma
                      // preenchida. O vão entre segmentos continua sendo o
                      // separador; isto só ancora CADA segmento contra o fundo.
                      boxShadow: 'inset 0 0 0 1px rgba(17,23,35,0.08)',
                      cursor: aoClicarSegmento || detalheDoSegmento ? 'pointer' : undefined,
                    }}
                  />
                ))}
              </div>
            </div>

            <div
              style={{
                height: ALTURA_DO_MES,
                fontSize: 11,
                textAlign: 'center',
                color: 'var(--cinza-2)',
                marginTop: 4,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'clip',
              }}
            >
              {indice % passoDoRotulo === 0 || indice === indiceDoUltimo || emFoco === indice
                ? formatarRotulo(coluna.mes)
                : ''}
            </div>

            {emFoco === indice && coluna.total > 0 ? (
              <Tooltip
                escala={escala}
                coluna={coluna}
                alinhamento={naEsquerda ? 'esquerda' : naDireita ? 'direita' : 'centro'}
                detalhe={
                  segmentoEmFoco && detalheDoSegmento
                    ? undefined
                    : detalheDoMes?.(coluna)
                }
                segmento={
                  segmentoEmFoco
                    ? coluna.segmentos.find((s) => s.chave === segmentoEmFoco)
                    : undefined
                }
                detalheDoSegmento={
                  segmentoEmFoco && detalheDoSegmento
                    ? detalheDoSegmento(coluna, segmentoEmFoco)
                    : undefined
                }
                instituicoesPorSegmento={
                  !segmentoEmFoco && detalheDoSegmento
                    ? Object.fromEntries(
                        coluna.segmentos.map((s) => [s.chave, detalheDoSegmento(coluna, s.chave)]),
                      )
                    : undefined
                }
                formatarRotulo={formatarRotulo}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Tooltip({
  escala,
  coluna,
  alinhamento,
  detalhe,
  segmento,
  detalheDoSegmento,
  instituicoesPorSegmento,
  formatarRotulo,
}: {
  escala: 'absoluta' | 'percentual';
  coluna: ColunaMensal;
  alinhamento: 'esquerda' | 'centro' | 'direita';
  detalhe?: { rotulo: string; valor: string }[];
  /** O segmento em foco, quando o mouse está numa fatia da pilha — o tooltip
   *  deixa de listar a coluna inteira e mostra o recorte daquela categoria,
   *  como a rosca faz com a fatia. */
  segmento?: Segmento;
  detalheDoSegmento?: { rotulo: string; valor: string }[];
  /** Top instituições de cada fatia, quando o mouse está na COLUNA e não
   *  numa fatia específica — o mesmo dado da rosca, só que uma lista por
   *  tier, para o hover da barra inteira não perder a informação. */
  instituicoesPorSegmento?: Record<string, { rotulo: string; valor: string }[]>;
  formatarRotulo: (chave: string) => string;
}) {
  const posicao =
    alinhamento === 'esquerda'
      ? { left: 0 }
      : alinhamento === 'direita'
        ? { right: 0 }
        : { left: '50%', transform: 'translateX(-50%)' };

  return (
    <div
      role="tooltip"
      style={{
        position: 'absolute',
        bottom: '100%',
        marginBottom: 6,
        zIndex: 20,
        minWidth: 190,
        background: 'var(--cinza-4)',
        color: 'var(--branco)',
        borderRadius: 'var(--r-card-int)',
        padding: '11px 13px',
        boxShadow: 'var(--sh-tooltip)',
        pointerEvents: 'none',
        ...posicao,
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
        <span style={{ textTransform: 'capitalize' }}>
          {segmento
            ? `${formatarRotulo(coluna.mes)} · ${segmento.rotulo}`
            : formatarRotulo(coluna.mes)}
        </span>
        <span className="tabular">{segmento ? segmento.total : coluna.total}</span>
      </div>

      {segmento && detalheDoSegmento ? (
        detalheDoSegmento.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 11, color: '#8C91A4', marginBottom: 2 }}>Top instituições</div>
            {detalheDoSegmento.map((linha) => (
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
                <span className="tabular" style={{ color: segmento.cor, fontWeight: 700 }}>
                  {linha.valor}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#8C91A4' }}>Sem instituição registrada.</div>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: instituicoesPorSegmento ? 7 : 3 }}>
          {coluna.segmentos.map((item) => {
            const instituicoes = instituicoesPorSegmento?.[item.chave] ?? [];
            return (
              <div key={item.chave} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
                  <span
                    aria-hidden
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: item.cor,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, color: '#D5DAEA' }}>{item.rotulo}</span>
                  <span className="tabular">
                    {item.total}
                    {escala === 'percentual' ? (
                      <span style={{ color: '#D5DAEA' }}> · {percentual(item.total, coluna.total)}</span>
                    ) : null}
                  </span>
                </div>
                {instituicoes.map((linha) => (
                  <div
                    key={linha.rotulo}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      fontSize: 11,
                      paddingLeft: 15,
                    }}
                  >
                    <span
                      style={{
                        color: '#8C91A4',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 150,
                      }}
                    >
                      {linha.rotulo}
                    </span>
                    <span className="tabular" style={{ color: item.cor, fontWeight: 600 }}>
                      {linha.valor}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {detalhe?.length ? (
        <div
          style={{
            marginTop: 8,
            paddingTop: 7,
            borderTop: '1px solid rgba(255,255,255,0.18)',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          {detalhe.map((linha) => (
            <div
              key={linha.rotulo}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11 }}
            >
              <span style={{ color: '#8C91A4' }}>{linha.rotulo}</span>
              <span>{linha.valor}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Legenda clicável — clicar num item aplica o filtro correspondente.
 *
 *  A legenda está sempre presente com duas ou mais séries: é o canal confiável
 *  de identidade. A paleta oficial da Aegea tem cores fora da faixa de contraste
 *  (turquesa, laranja e amarelo ficam abaixo de 3:1 sobre branco), então a
 *  identidade nunca pode depender só da cor. */
export function Legenda({
  itens,
  ativo,
  aoClicar,
  centralizada = false,
}: {
  itens: { chave: string; rotulo: string; cor: string; detalhe?: string }[];
  ativo?: string;
  aoClicar?: (chave: string) => void;
  /** Centraliza a legenda na caixa, em vez de colada à borda esquerda —
   *  pedido pontual para os gráficos de série no tempo do Painel. */
  centralizada?: boolean;
}) {
  if (itens.length < 2) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: centralizada ? 'center' : 'flex-start',
        gap: '6px 16px',
        marginTop: 14,
      }}
    >
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
                  : 'Clique para filtrar por este item'
                : undefined
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 12,
              color: selecionado ? 'var(--cinza-4)' : 'var(--cinza-3)',
              fontWeight: selecionado ? 700 : 400,
              cursor: aoClicar ? 'pointer' : 'default',
            }}
          >
            <span
              aria-hidden
              style={{ width: 9, height: 9, borderRadius: 2, background: item.cor }}
            />
            <span>{item.rotulo}</span>
            {item.detalhe ? (
              <span className="tabular" style={{ color: 'var(--cinza-2)', fontWeight: 500, opacity: 0.9 }}>
                ({item.detalhe})
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}