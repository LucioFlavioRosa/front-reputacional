/** Barras empilhadas por mês, com tooltip na coluna.
 *
 *  Especificações de marca seguidas aqui:
 *   - coluna com no máximo 24px de espessura — a sobra do slot vira ar, não barra;
 *   - ponta arredondada em 4px no topo e reta na linha de base, porque a barra
 *     cresce de uma base só;
 *   - 2px de vão na cor da superfície entre segmentos empilhados: quem separa é
 *     o branco, nunca um contorno desenhado em volta da marca;
 *   - rótulo **seletivo**: só o pico e o mês mais recente. Número em cima de toda
 *     coluna vira ruído e ninguém lê — o resto vive no tooltip e na Base.
 *
 *  O total vai numa faixa de altura fixa ACIMA do trilho e o mês ABAIXO, nunca
 *  dentro da barra: um mês zerado não teria onde escrever e desalinharia a régua.
 */

import { useState } from 'react';
import type { ColunaMensal } from '@/dominio/derivacoes';
import { rotuloDoMes } from '@/dominio/formato';

const ALTURA_DO_ROTULO = 16;
const ALTURA_DO_MES = 14;
const ESPESSURA_MAXIMA = 24;
const VAO_ENTRE_SEGMENTOS = 2;

export function BarrasEmpilhadas({
  colunas,
  altura = 150,
  aoClicarSegmento,
  detalheDoMes,
}: {
  colunas: ColunaMensal[];
  altura?: number;
  aoClicarSegmento?: (chave: string) => void;
  /** Linhas extras no tooltip — Tier 1 e tema dominante, por exemplo. */
  detalheDoMes?: (coluna: ColunaMensal) => { rotulo: string; valor: string }[];
}) {
  const [emFoco, setEmFoco] = useState<number | null>(null);

  if (!colunas.length) {
    return (
      <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--cinza-2)' }}>
        Sem registros no recorte.
      </div>
    );
  }

  const maximo = Math.max(1, ...colunas.map((c) => c.total));
  const alturaDoTrilho = altura - ALTURA_DO_ROTULO - ALTURA_DO_MES;

  // Rotula só o que a leitura precisa: o pico do período e o mês mais recente.
  const indiceDoPico = colunas.reduce(
    (melhor, coluna, indice) => (coluna.total > colunas[melhor].total ? indice : melhor),
    0,
  );
  const indiceDoUltimo = colunas.length - 1;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
      {colunas.map((coluna, indice) => {
        const alturaDaBarra = (coluna.total / maximo) * alturaDoTrilho;

        // Uma pilha de N segmentos precisa de N×2px de altura mínima mais
        // (N-1)×2px de vão. Numa coluna baixa com muitas frentes isso passa da
        // altura proporcional, e a barra vazaria para cima — mentindo sobre o
        // valor. Quando aperta, o vão e o mínimo saem: os segmentos viram
        // fatias proporcionais e o tooltip continua com todos os números.
        const quantidade = coluna.segmentos.length;
        const alturaNecessaria =
          quantidade * 2 + Math.max(0, quantidade - 1) * VAO_ENTRE_SEGMENTOS;
        const apertada = alturaDaBarra < alturaNecessaria;

        const rotulado =
          coluna.total > 0 && (indice === indiceDoPico || indice === indiceDoUltimo);

        // Colunas das pontas alinham o tooltip pela borda, senão ele vazaria
        // para fora do card.
        const naEsquerda = indice <= 1;
        const naDireita = indice >= colunas.length - 2;

        return (
          <div
            key={coluna.mes}
            style={{ flex: 1, minWidth: 0, position: 'relative' }}
            onMouseEnter={() => setEmFoco(indice)}
            onMouseLeave={() => setEmFoco(null)}
            onFocus={() => setEmFoco(indice)}
            onBlur={() => setEmFoco(null)}
            tabIndex={0}
            aria-label={`${rotuloDoMes(coluna.mes)}: ${coluna.total}`}
          >
            <div
              style={{
                height: ALTURA_DO_ROTULO,
                fontSize: 11,
                fontWeight: 700,
                textAlign: 'center',
                color: 'var(--cinza-4)',
              }}
            >
              {rotulado || emFoco === indice ? coluna.total : ''}
            </div>

            <div
              style={{
                height: alturaDoTrilho,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: ESPESSURA_MAXIMA,
                  height: Math.max(coluna.total ? 3 : 0, alturaDaBarra),
                  display: 'flex',
                  flexDirection: 'column',
                  // O vão é feito com gap na cor da superfície, não com borda.
                  gap: apertada ? 0 : VAO_ENTRE_SEGMENTOS,
                }}
              >
                {coluna.segmentos.map((segmento, posicao) => (
                  <div
                    key={segmento.chave}
                    onClick={() => aoClicarSegmento?.(segmento.chave)}
                    title={`${segmento.rotulo}: ${segmento.total}`}
                    style={{
                      flex: segmento.total,
                      minHeight: apertada ? 0 : 2,
                      background: segmento.cor,
                      // Ponta arredondada no topo da pilha; reta na base.
                      borderRadius: posicao === 0 ? '4px 4px 0 0' : 0,
                      cursor: aoClicarSegmento ? 'pointer' : undefined,
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
              }}
            >
              {rotuloDoMes(coluna.mes)}
            </div>

            {emFoco === indice && coluna.total > 0 ? (
              <Tooltip
                coluna={coluna}
                alinhamento={naEsquerda ? 'esquerda' : naDireita ? 'direita' : 'centro'}
                detalhe={detalheDoMes?.(coluna)}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Tooltip({
  coluna,
  alinhamento,
  detalhe,
}: {
  coluna: ColunaMensal;
  alinhamento: 'esquerda' | 'centro' | 'direita';
  detalhe?: { rotulo: string; valor: string }[];
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
        <span style={{ textTransform: 'capitalize' }}>{rotuloDoMes(coluna.mes)}</span>
        <span className="tabular">{coluna.total}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {coluna.segmentos.map((segmento) => (
          <div
            key={segmento.chave}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: segmento.cor,
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1, color: '#D5DAEA' }}>{segmento.rotulo}</span>
            <span className="tabular">{segmento.total}</span>
          </div>
        ))}
      </div>

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
}: {
  itens: { chave: string; rotulo: string; cor: string }[];
  ativo?: string;
  aoClicar?: (chave: string) => void;
}) {
  if (itens.length < 2) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 14 }}>
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
              // O texto usa token de tinta, nunca a cor da série: a identidade
              // vem do quadrado colorido ao lado.
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
            {item.rotulo}
          </button>
        );
      })}
    </div>
  );
}
