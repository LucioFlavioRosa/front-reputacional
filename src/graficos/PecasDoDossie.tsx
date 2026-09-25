/** Os tipos de visualização do dossiê das lentes.
 *
 *  PEÇAS GENÉRICAS, e não gráficos "da Imprensa" ou "do Mercado": cada uma
 *  recebe dados por props e não sabe de qual lente vieram. É a regra 3 do
 *  pacote, e é o que faz uma lente nova custar uma linha de configuração em
 *  vez de um componente.
 *
 *  Três dos oito tipos já existiam e não foram reescritos: `barras_empilhadas`
 *  é `BarrasEmpilhadas`, `barras_horizontais` é `Ranking`, e a divergente de
 *  atributo é `BarraDivergentePorItem`. Aqui estão os cinco que faltavam.
 *
 *  OS ESTADOS DE FALTA SÃO PARTE DO CONTRATO, e não um caso de erro:
 *
 *      sem base            o mês não tem dado nenhum — hachurado, "—" no topo
 *      sem classificação   há volume, mas ninguém classificou — barra cinza
 *      célula vazia        "—" em cinza claro, nunca zero
 *
 *  Zero e ausência são coisas diferentes, e desenhá-las igual faz a tela
 *  afirmar que algo foi medido e deu nada.
 */

import { useId, useState } from 'react';

import { numero } from '@/dominio/formato';
import { COR_DO_EFEITO, corDaPrioridade, mesCurto } from '@/dominio/dossie';

const COR = {
  positivo: 'var(--ok-fg)',
  neutro: 'var(--cinza-1)',
  negativo: 'var(--erro-fg)',
  recebidas: 'var(--azul-claro, #C3CDF7)',
  respondidas: 'var(--azul-mar)',
  //: Distinto do neutro de propósito: neutro é leitura, isto é ausência dela.
  semClassificacao: 'var(--cinza-2)',
};

/** O "—" que ocupa o lugar de um número que não existe. */
export function SemDado({ titulo }: { titulo?: string }) {
  return (
    <span style={{ color: 'var(--cinza-1)' }} title={titulo ?? 'sem dado'}>
      —
    </span>
  );
}

/* -- barras_100: a composição de cada item, sempre em 100% --------------------- */

export interface ItemDeComposicao {
  rotulo: string;
  positivo: number;
  neutro: number;
  negativo: number;
  /** Volume que chegou sem ninguém classificar — a §2 o desenha em cinza
   *  único, e NÃO como neutro: neutro é leitura, isto é ausência de leitura. */
  sem_classificacao?: number;
  sem_base?: boolean;
}

export function BarrasCemPorCento({
  itens,
  legenda = ['Positivo', 'Neutro', 'Negativo'],
  vazio = 'Sem dado no mês.',
}: {
  itens: ItemDeComposicao[];
  legenda?: [string, string, string] | string[];
  vazio?: string;
}) {
  if (!itens.length) {
    return <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>{vazio}</p>;
  }

  return (
    <div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {itens.map((item) => {
          const classificadas = item.positivo + item.neutro + item.negativo;
          const semClassificacao = item.sem_classificacao ?? 0;
          const total = classificadas + semClassificacao;
          // TRÊS ESTADOS, e não dois. "Sem base" é nada ter passado por ali;
          // "sem classificação" é ter passado e ninguém ter lido. Tratar os
          // dois como barra vazia apagaria justamente a diferença entre um mês
          // tranquilo e um mês não analisado.
          const semBase = item.sem_base || !total;
          const soSemClassificacao = !semBase && !classificadas;
          const dominante =
            item.negativo > item.positivo
              ? `${Math.round((item.negativo / classificadas) * 100)}% negativo`
              : `${Math.round((item.positivo / classificadas) * 100)}% positivo`;

          return (
            <li key={item.rotulo} style={{ padding: '9px 0' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{item.rotulo}</span>
                <span className="tabular" style={{ fontSize: 11.5, color: 'var(--cinza-2)' }}>
                  {semBase
                    ? 'sem base'
                    : soSemClassificacao
                      ? `${numero(total)} · sentimento a integrar`
                      : `${numero(total)} · ${dominante}`}
                </span>
              </div>

              {semBase ? (
                <div
                  title="sem base neste mês"
                  style={{
                    height: 12,
                    borderRadius: 3,
                    border: '1px dashed var(--borda)',
                    background:
                      'repeating-linear-gradient(45deg, transparent, transparent 4px, var(--cinza-0) 4px, var(--cinza-0) 8px)',
                  }}
                />
              ) : (
                <div
                  role="img"
                  aria-label={
                    soSemClassificacao
                      ? `${item.rotulo}: ${total} menções, sentimento a integrar`
                      : `${item.rotulo}: ${legenda[0]} ${item.positivo}, ${legenda[1]} ${item.neutro}, ${legenda[2]} ${item.negativo}`
                  }
                  style={{ display: 'flex', height: 12, borderRadius: 3, overflow: 'hidden', gap: 2 }}
                >
                  {(
                    [
                      ['positivo', item.positivo, COR.positivo, legenda[0]],
                      ['neutro', item.neutro, COR.neutro, legenda[1]],
                      ['negativo', item.negativo, COR.negativo, legenda[2]],
                      ['sem', semClassificacao, COR.semClassificacao, 'Sem classificação'],
                    ] as const
                  )
                    .filter(([, valor]) => valor > 0)
                    .map(([chave, valor, cor, rotulo]) => (
                      <div
                        key={chave}
                        title={`${rotulo}: ${numero(valor)} (${Math.round((valor / total) * 100)}%)`}
                        style={{ width: `${(valor / total) * 100}%`, background: cor }}
                      />
                    ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Legenda
        itens={[
          [legenda[0], COR.positivo],
          [legenda[1], COR.neutro],
          [legenda[2], COR.negativo],
          ...(itens.some((item) => (item.sem_classificacao ?? 0) > 0)
            ? ([['Sem classificação', COR.semClassificacao]] as [string, string][])
            : []),
        ]}
      />
    </div>
  );
}

function Legenda({ itens }: { itens: [string, string][] }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
      {itens.map(([rotulo, cor]) => (
        <span
          key={rotulo}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--cinza-2)' }}
        >
          <span style={{ width: 10, height: 10, borderRadius: 3, background: cor }} />
          {rotulo}
        </span>
      ))}
    </div>
  );
}

/* -- barras_pareadas: recebidas × respondidas ---------------------------------- */

export interface ParDoMes {
  mes: string;
  recebidas: number;
  /** Nulo quando ninguém sabe — e NÃO zero: zero acusaria a equipe de não ter
   *  respondido nada. */
  respondidas: number | null;
  sem_base?: boolean;
}

export function BarrasPareadas({
  meses,
  altura = 150,
  fatos = {},
}: {
  meses: ParDoMes[];
  altura?: number;
  /** O fato do mês, por chave. Vira um marcador acima da coluna — a §1 pede
   *  "marcadores de fato por mês", e uma lista embaixo do gráfico não diz QUAL
   *  coluna o fato explica. */
  fatos?: Record<string, { texto: string; efeito: string }>;
}) {
  const maximo = Math.max(1, ...meses.map((m) => Math.max(m.recebidas, m.respondidas ?? 0)));

  return (
    <div>
      <div
        role="img"
        aria-label={`Recebidas e respondidas por mês, de ${meses[0]?.mes ?? ''} a ${meses[meses.length - 1]?.mes ?? ''}`}
        style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: altura }}
      >
        {meses.map((mes) => {
          const taxa =
            mes.respondidas !== null && mes.recebidas
              ? Math.round((mes.respondidas / mes.recebidas) * 100)
              : null;
          return (
            <div key={mes.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ height: 16, fontSize: 11, textAlign: 'center', color: 'var(--cinza-2)' }} className="tabular">
                {taxa === null ? '—' : `${taxa}%`}
              </div>
              <div style={{ height: 6, display: 'flex', justifyContent: 'center' }}>
                {fatos[mes.mes] ? (
                  <span
                    title={fatos[mes.mes].texto}
                    aria-label={`Fato em ${mes.mes}: ${fatos[mes.mes].texto}`}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: COR_DO_EFEITO[fatos[mes.mes].efeito] ?? 'var(--cinza-2)',
                    }}
                  />
                ) : null}
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 2, justifyContent: 'center' }}>
                {mes.sem_base ? (
                  <div
                    title="sem base neste mês"
                    style={{
                      width: '100%',
                      maxWidth: 40,
                      height: '30%',
                      borderRadius: 3,
                      border: '1px dashed var(--borda)',
                      background:
                        'repeating-linear-gradient(45deg, transparent, transparent 4px, var(--cinza-0) 4px, var(--cinza-0) 8px)',
                    }}
                  />
                ) : (
                  <>
                    <div
                      title={`Recebidas: ${numero(mes.recebidas)}`}
                      style={{
                        width: '46%',
                        maxWidth: 20,
                        height: `${Math.max(2, (mes.recebidas / maximo) * 100)}%`,
                        background: COR.recebidas,
                        borderRadius: '3px 3px 0 0',
                      }}
                    />
                    <div
                      title={
                        mes.respondidas === null
                          ? 'não se sabe quantas foram respondidas'
                          : `Respondidas: ${numero(mes.respondidas)}`
                      }
                      style={{
                        width: '46%',
                        maxWidth: 20,
                        height:
                          mes.respondidas === null
                            ? '6%'
                            : `${Math.max(2, (mes.respondidas / maximo) * 100)}%`,
                        background: mes.respondidas === null ? 'transparent' : COR.respondidas,
                        border: mes.respondidas === null ? '1px dashed var(--borda)' : undefined,
                        borderRadius: '3px 3px 0 0',
                      }}
                    />
                  </>
                )}
              </div>
              <div style={{ height: 16, fontSize: 11, textAlign: 'center', color: 'var(--cinza-2)', marginTop: 4 }}>
                {mesCurto(mes.mes)}
              </div>
            </div>
          );
        })}
      </div>
      <Legenda
        itens={[
          ['Recebidas', COR.recebidas],
          ['Respondidas', COR.respondidas],
        ]}
      />
    </div>
  );
}

/* -- linha_do_tempo: o eventograma --------------------------------------------- */

export interface MesDeEventos {
  mes: string;
  eventos: { texto: string; efeito: string }[];
}

export function LinhaDoTempo({ meses }: { meses: MesDeEventos[] }) {
  const quantos = meses.reduce((soma, mes) => soma + mes.eventos.length, 0);
  return (
    <div
      role="img"
      aria-label={`Linha do tempo com ${quantos} ${quantos === 1 ? 'evento' : 'eventos'} de mercado`}
      style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}
    >
      {meses.map((mes) => {
        // A BORDA DO MÊS É O EFEITO PREDOMINANTE. Empate vira "misto": dizer
        // que um mês com um reforço e uma pressão foi bom seria escolher lado.
        const pressiona = mes.eventos.filter((e) => e.efeito === 'pressiona').length;
        const sustenta = mes.eventos.filter((e) => e.efeito === 'sustenta').length;
        const cor = !mes.eventos.length
          ? 'var(--borda)'
          : pressiona > sustenta
            ? COR_DO_EFEITO.pressiona
            : sustenta > pressiona
              ? COR_DO_EFEITO.sustenta
              : COR_DO_EFEITO.misto;

        return (
          <div key={mes.mes} style={{ flex: '1 0 108px', minWidth: 108 }}>
            <div style={{ height: 3, background: cor, borderRadius: 2, marginBottom: 8 }} />
            <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--cinza-2)' }}>
              {mesCurto(mes.mes)}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {mes.eventos.length ? (
                mes.eventos.map((evento) => (
                  <span
                    key={evento.texto}
                    style={{
                      fontSize: 11,
                      lineHeight: 1.35,
                      padding: '6px 7px',
                      borderRadius: 6,
                      overflowWrap: 'anywhere',
                      background:
                        evento.efeito === 'pressiona'
                          ? 'var(--erro-bg)'
                          : evento.efeito === 'sustenta'
                            ? 'var(--ok-bg)'
                            : 'var(--cinza-0)',
                    }}
                  >
                    {evento.texto}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: 11, color: 'var(--cinza-1)' }}>—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -- escala_1a5: a percepção do estudo ----------------------------------------- */

export interface ItemDaEscala {
  rotulo: string;
  nota: number;
  detalhe: string | null;
}

export function EscalaDeCinco({ itens, vazio }: { itens: ItemDaEscala[]; vazio: string }) {
  if (!itens.length) {
    return <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>{vazio}</p>;
  }

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {itens.map((item) => (
        <li key={item.rotulo} style={{ padding: '12px 0', borderTop: '1px solid var(--borda)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{item.rotulo}</span>
            <span
              className="tabular"
              style={{
                fontSize: 16,
                fontWeight: 700,
                // A MEIA ESCALA É O CORTE: 3 de 5 é o meio, e abaixo disso a
                // nota deixa de ser elogio.
                color: item.nota >= 3 ? 'var(--ok-fg)' : 'var(--erro-fg)',
              }}
            >
              {item.nota.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--cinza-2)' }}>de 5</span>
          </div>

          <div
            role="img"
            aria-label={`${item.rotulo}: ${item.nota.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} de 5`}
            style={{ position: 'relative', height: 8, marginTop: 8, background: 'var(--cinza-0)', borderRadius: 4 }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${((item.nota - 1) / 4) * 100}%`,
                background: item.nota >= 3 ? 'var(--ok-fg)' : 'var(--erro-fg)',
                borderRadius: 4,
              }}
            />
          </div>

          {item.detalhe ? (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--cinza-2)', lineHeight: 1.6 }}>
              {item.detalhe}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/* -- matriz_prioridade: com quem falar primeiro -------------------------------- */

export interface LinhaDaMatriz {
  nome: string;
  veiculo: string | null;
  relevancia: number;
  exposicao: number;
  proximidade: number;
  pontos: number;
  prioridade: number;
  cadencia: string;
}

export function MatrizDePrioridade({ linhas }: { linhas: LinhaDaMatriz[] }) {
  if (!linhas.length) {
    return (
      <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>
        Nenhum jornalista cadastrado na matriz.
      </p>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {['Jornalista', 'Relevância', 'Exposição', 'Proximidade', 'Prioridade'].map((titulo, i) => (
              <th
                key={titulo}
                style={{
                  textAlign: i === 0 ? 'left' : 'center',
                  padding: '8px 10px',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--cinza-2)',
                  borderBottom: '1px solid var(--azul-mar)',
                  whiteSpace: 'nowrap',
                }}
              >
                {titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => {
            const cor = corDaPrioridade(linha.prioridade);
            return (
              <tr key={`${linha.nome}-${linha.veiculo ?? ''}`} style={{ borderBottom: '1px solid var(--borda)' }}>
                <td style={{ padding: '9px 10px' }}>
                  <div style={{ fontWeight: 600 }}>{linha.nome}</div>
                  {linha.veiculo ? (
                    <div style={{ fontSize: 11.5, color: 'var(--cinza-2)' }}>{linha.veiculo}</div>
                  ) : null}
                </td>
                <Pontos nota={linha.relevancia} rotulo="Relevância" />
                <Pontos nota={linha.exposicao} rotulo="Exposição" />
                <Pontos nota={linha.proximidade} rotulo="Proximidade" />
                <td style={{ padding: '9px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <span
                    title={`${linha.pontos} pontos · ${linha.cadencia}`}
                    aria-label={`Prioridade ${linha.prioridade}: ${linha.pontos} pontos, ${linha.cadencia}`}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 9px',
                      borderRadius: 5,
                      background: cor.fundo,
                      color: cor.texto,
                    }}
                  >
                    P{linha.prioridade}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Pontos({ nota, rotulo }: { nota: number; rotulo: string }) {
  return (
    <td style={{ padding: '9px 10px', textAlign: 'center' }}>
      <span
        role="img"
        aria-label={`${rotulo}: ${nota} de 5`}
        title={`${rotulo}: ${nota} de 5`}
        style={{ display: 'inline-flex', gap: 3 }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            aria-hidden
            style={{
              width: 9,
              height: 9,
              borderRadius: 2,
              background: i <= nota ? 'var(--azul-mar)' : 'var(--cinza-0)',
            }}
          />
        ))}
      </span>
    </td>
  );
}

/* -- tabela: rating, teor ------------------------------------------------------ */

export interface ColunaDaTabela {
  chave: string;
  titulo: string;
  alinhamento?: 'esquerda' | 'direita';
  /** Destaca a célula quando a regra do bloco pede — reclamação acima de
   *  metade, rebaixamento de rating. Recebe a linha inteira. */
  destaque?: (linha: Record<string, unknown>) => 'alerta' | 'bom' | null;
  formatar?: (valor: unknown, linha: Record<string, unknown>) => string;
}

export function TabelaDeLeitura({
  colunas,
  linhas,
  vazio = 'Sem registro no período.',
}: {
  colunas: ColunaDaTabela[];
  linhas: Record<string, unknown>[];
  vazio?: string;
}) {
  const id = useId();
  const [linhaEmFoco, definirLinhaEmFoco] = useState<number | null>(null);

  if (!linhas.length) {
    return <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>{vazio}</p>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {colunas.map((coluna) => (
              <th
                key={coluna.chave}
                scope="col"
                style={{
                  textAlign: coluna.alinhamento === 'direita' ? 'right' : 'left',
                  padding: '8px 10px',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--cinza-2)',
                  borderBottom: '1px solid var(--azul-mar)',
                  whiteSpace: 'nowrap',
                }}
              >
                {coluna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, indice) => (
            <tr
              key={`${id}-${indice}`}
              onMouseEnter={() => definirLinhaEmFoco(indice)}
              onMouseLeave={() => definirLinhaEmFoco(null)}
              style={{
                borderBottom: '1px solid var(--borda)',
                background: linhaEmFoco === indice ? 'var(--bg-hover)' : undefined,
              }}
            >
              {colunas.map((coluna) => {
                const bruto = linha[coluna.chave];
                const destaque = coluna.destaque?.(linha) ?? null;
                const vazia = bruto === null || bruto === undefined || bruto === '';
                return (
                  <td
                    key={coluna.chave}
                    className={typeof bruto === 'number' ? 'tabular' : undefined}
                    style={{
                      padding: '9px 10px',
                      textAlign: coluna.alinhamento === 'direita' ? 'right' : 'left',
                      color:
                        destaque === 'alerta'
                          ? 'var(--erro-fg)'
                          : destaque === 'bom'
                            ? 'var(--ok-fg)'
                            : undefined,
                      fontWeight: destaque ? 700 : undefined,
                    }}
                  >
                    {vazia ? (
                      <SemDado />
                    ) : (
                      (coluna.formatar?.(bruto, linha) ?? String(bruto))
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
