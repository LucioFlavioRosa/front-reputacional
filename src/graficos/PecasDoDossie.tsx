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
import { COR_DO_EFEITO, ROTULO_DO_EFEITO, corDaPrioridade, mesCurto } from '@/dominio/dossie';

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
  // A COR, QUANDO O SERVIDOR MANDA (a lente institucional, com o cor_hex do
  // dicionário de clima que também pinta o Painel), VENCE o tom genérico —
  // mesmo contrato de `BarrasEmpilhadas`/`DossieDaLente.tsx`.
  cores = [COR.positivo, COR.neutro, COR.negativo],
  vazio = 'Sem dado no mês.',
  ativo,
  aoClicar,
}: {
  itens: ItemDeComposicao[];
  legenda?: [string, string, string] | string[];
  cores?: [string, string, string] | string[];
  vazio?: string;
  /** O rótulo que está recortado agora — fica marcado, e clicar nele desmarca. */
  ativo?: string;
  /** QUANDO PRESENTE, CADA LINHA VIRA BOTÃO. É o que faz este gráfico servir ao
   *  cartão "Onde está a causa": quem vê "Abastecimento · 67% negativo" tenta
   *  clicar NELE, e até agora tinha de procurar o mesmo nome num campo suspenso.
   *
   *  OPCIONAL porque os painéis que só ilustram continuam sem clique — uma
   *  linha que parece clicável e não é custa mais do que uma que não parece. */
  aoClicar?: (rotulo: string) => void;
}) {
  if (!itens.length) {
    return <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>{vazio}</p>;
  }

  return (
    <div>
      {/* MESMO RITMO VERTICAL DE `Ranking` (graficos/Ranking.tsx): `gap: 11`
          entre itens, e não padding igual em cima e embaixo de cada um — o
          `Ranking` ao lado usa esse padrão, e um espaçamento diferente aqui
          desalinhava a altura das duas colunas do dossiê. */}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
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

          const selecionado = ativo === item.rotulo;

          // UM `button` DENTRO DO `li`, e não o `li` virando botão — achado de
          // revisão (baixa): `role="button"` sobrescrito num filho direto de
          // `<ul>` tira dele o papel de `listitem`, e quem ouve a tela perde a
          // estrutura "lista com N itens" justamente no gráfico em que a
          // quantidade de linhas é parte da leitura.
          //
          // `button` DE VERDADE, e não um `div` com `role`: Enter e Espaço,
          // foco visível e `aria-pressed` vêm do elemento — é menos código que
          // o `Ranking` ao lado, que nasceu antes desta conclusão.
          const Linha = aoClicar ? 'button' : 'div';

          return (
            <li key={item.rotulo} style={{ padding: '3px 0' }}>
              <Linha
                type={aoClicar ? 'button' : undefined}
                onClick={aoClicar ? () => aoClicar(item.rotulo) : undefined}
                aria-pressed={aoClicar ? selecionado : undefined}
                //: "APROFUNDAR", E NÃO "FILTRAR": o clique abre o painel de
                //: aprofundamento do pacote (nível 3), que mede aquele pedaço e
                //: o decompõe por dentro. Quem lê "filtrar" espera a tela
                //: mudar — e a tela de trás continua onde estava.
                title={aoClicar ? `Aprofundar em ${item.rotulo}` : undefined}
                style={{
                  //: O BOTÃO TEM DE PARECER A LINHA QUE ERA: largura inteira,
                  //: texto à esquerda, sem moldura nem fundo próprios.
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  font: 'inherit',
                  color: 'inherit',
                  border: 'none',
                  padding: '3px 6px',
                  margin: '0 -6px',
                  borderRadius: 'var(--r-chip)',
                  cursor: aoClicar ? 'pointer' : undefined,
                  background: selecionado ? 'var(--bg-hover)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: selecionado ? 700 : 600, flex: 1 }}>
                    {item.rotulo}
                  </span>
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
                      // MESMA ESPESSURA DE `Barra` (componentes/basicos.tsx): o
                      // `Ranking` ao lado usa 7px, e um valor diferente aqui
                      // desalinhava a altura das duas colunas do dossiê que
                      // ficam lado a lado.
                      height: 7,
                      borderRadius: 2,
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
                    style={{ display: 'flex', height: 7, borderRadius: 2, overflow: 'hidden', gap: 2 }}
                  >
                    {(
                      [
                        ['positivo', item.positivo, cores[0], legenda[0]],
                        ['neutro', item.neutro, cores[1], legenda[1]],
                        ['negativo', item.negativo, cores[2], legenda[2]],
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
              </Linha>
            </li>
          );
        })}
      </ul>
      <Legenda
        itens={[
          [legenda[0], cores[0]],
          [legenda[1], cores[1]],
          [legenda[2], cores[2]],
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
    <div>
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
      <Legenda
        itens={[
          [ROTULO_DO_EFEITO.sustenta, COR_DO_EFEITO.sustenta],
          [ROTULO_DO_EFEITO.pressiona, COR_DO_EFEITO.pressiona],
          [ROTULO_DO_EFEITO.misto, COR_DO_EFEITO.misto],
        ]}
      />
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
    <div
      className="rolagem-das-duas-barras"
      tabIndex={0}
      role="group"
      aria-label="Tabela do dossiê, rolável"
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead className="cabecalho-que-fica">
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

/** O valor de uma célula: endereço vira link, o resto vira texto.
 *
 *  POR QUE AQUI. A lista de menções da Sociedade digital traz o LINK de cada
 *  post — a carga do padrão Aegea trouxe o endereço de 2.208 itens —, e a célula
 *  escrevia `String(valor)`: a URL inteira ocupava a largura de três colunas, não
 *  se clicava, e quem quisesse abrir tinha de selecionar e copiar.
 *
 *  NO COMPONENTE, E NÃO NO FORMATADOR: `dominio/dossie.ts` é TypeScript puro e
 *  devolve texto; um link é elemento, e elemento é coisa de componente. Pôr JSX
 *  no domínio misturaria as duas camadas por causa de uma âncora.
 *
 *  O CRITÉRIO É O ESQUEMA DA URL, e não a presença de um ponto: `aegea.com.br`
 *  sem `https://` pode ser o nome de um perfil, e transformá-lo em link daria um
 *  clique para lugar nenhum. Vale para qualquer tabela do dossiê — nenhuma
 *  precisa declarar que tem coluna de endereço.
 */
function ValorDaCelula({ valor }: { valor: unknown }) {
  const texto = String(valor);
  if (typeof valor === 'string' && /^https?:\/\//i.test(valor)) {
    return (
      <a
        href={valor}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'var(--azul-mar)', fontWeight: 600, whiteSpace: 'nowrap' }}
      >
        Abrir ↗
      </a>
    );
  }
  return <>{texto}</>;
}

export function TabelaDeLeitura({
  colunas,
  linhas,
  vazio = 'Sem registro no período.',
  enderecoDaLinha,
}: {
  colunas: ColunaDaTabela[];
  linhas: Record<string, unknown>[];
  vazio?: string;
  /** O endereço para onde a linha leva, quando há um.
   *
   *  CLIQUE NA LINHA **E** LINK DE VERDADE NO TEXTO, e os dois não são
   *  redundância:
   *
   *    o clique na linha   é o gesto que a pessoa já tenta — pedido do dono do
   *                        produto, "se clicar gostaria de acessar a página"
   *    o `a` no texto      é o que teclado e leitor de tela alcançam, e o que
   *                        permite abrir em outra aba pelo meio do mouse
   *
   *  O `tr` NÃO VIRA BOTÃO: sobrescrever o papel dele quebraria a semântica da
   *  tabela — é o mesmo achado de revisão que tirou o `role="button"` do `li` em
   *  `BarrasCemPorCento`. A linha fica linha, com um link dentro. */
  enderecoDaLinha?: (linha: Record<string, unknown>) => string | null;
}) {
  const id = useId();
  const [linhaEmFoco, definirLinhaEmFoco] = useState<number | null>(null);
  //: QUAL CÉLULA RECEBE O LINK: a PRIMEIRA COLUNA, e a decisão é da tabela —
  //: não de cada linha.
  //:
  //: EU HAVIA ESCRITO "a primeira célula com texto", POR LINHA, e isso faz o
  //: link pular de coluna: numa linha sem texto de menção ele cairia na coluna
  //: de rede ou de data, e a mesma tabela teria o link em lugares diferentes
  //: dependendo do que o fornecedor preencheu. Uma tabela em que o link muda de
  //: lugar não se aprende.
  //:
  //: A PRIMEIRA, E NÃO UMA ADIVINHADA: a ordem das colunas é decisão do
  //: servidor, e ele põe na frente o que se lê ("O TEXTO VEM PRIMEIRO porque é o
  //: que se lê", em `COLUNAS_DAS_MENCOES`). Célula vazia nessa coluna fica sem
  //: link, e o clique na linha continua levando.
  const colunaDoTexto = colunas[0];

  if (!linhas.length) {
    return <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>{vazio}</p>;
  }

  return (
    <div
      className="rolagem-das-duas-barras"
      tabIndex={0}
      role="group"
      aria-label="Tabela do dossiê, rolável"
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead className="cabecalho-que-fica">
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
          {linhas.map((linha, indice) => {
            const endereco = enderecoDaLinha?.(linha) ?? null;
            //: SÓ `http`/`https`, e a conferência é aqui porque o endereço vem do
            //: arquivo que o fornecedor entregou: um `javascript:` numa célula
            //: viraria código executando na sessão de quem clicou.
            const destino = endereco && /^https?:\/\//i.test(endereco) ? endereco : null;
            return (
            <tr
              key={`${id}-${indice}`}
              onMouseEnter={() => definirLinhaEmFoco(indice)}
              onMouseLeave={() => definirLinhaEmFoco(null)}
              //: ABRE EM OUTRA ABA, como o link do texto: a tela de trás é o
              //: aprofundamento que a pessoa estava lendo, e trocá-la pela página
              //: do fornecedor perderia o caminho inteiro.
              onClick={
                destino
                  ? () => {
                      //: SELECIONAR TEXTO NÃO ABRE NADA. A tabela de menções é
                      //: feita de texto que se copia, e um arrasto para
                      //: selecionar termina em `click` — sem esta guarda, copiar
                      //: meia frase abriria a página do fornecedor no meio do
                      //: gesto.
                      if (window.getSelection()?.toString()) return;
                      window.open(destino, '_blank', 'noopener,noreferrer');
                    }
                  : undefined
              }
              title={destino ? 'Abrir na fonte' : undefined}
              style={{
                borderBottom: '1px solid var(--borda)',
                background: linhaEmFoco === indice ? 'var(--bg-hover)' : undefined,
                cursor: destino ? 'pointer' : undefined,
              }}
            >
              {colunas.map((coluna) => {
                const bruto = linha[coluna.chave];
                const destaque = coluna.destaque?.(linha) ?? null;
                const vazia = bruto === null || bruto === undefined || bruto === '';
                const conteudo = vazia ? (
                  <SemDado />
                ) : coluna.formatar ? (
                  coluna.formatar(bruto, linha)
                ) : (
                  <ValorDaCelula valor={bruto} />
                );
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
                    {/* O LINK ENVOLVE O CONTEÚDO, qualquer que ele seja — e não
                        é um terceiro ramo ao lado do formatador. Como ramo,
                        bastava uma coluna formatada virar a primeira para o link
                        desaparecer em silêncio: o formatador ganharia o ternário,
                        e ninguém notaria, porque a linha continua clicável. */}
                    {/* `!vazia` PORQUE CÉLULA VAZIA NÃO VIRA LINK: sem isto, a
                        linha sem texto da menção publicava um "—" clicável — um
                        link cujo rótulo é um travessão, que o leitor de tela
                        anuncia como "link, travessão". O clique na linha continua
                        levando. (Teste pegou.) */}
                    {destino && !vazia && coluna.chave === colunaDoTexto?.chave ? (
                      //: QUEM NAVEGA POR TECLADO chega nele, o leitor de tela o
                      //: anuncia como link, e o meio do mouse abre em outra aba.
                      //: `stopPropagation` para o clique não contar duas vezes (o
                      //: link já abre; a linha abriria de novo).
                      <a
                        href={destino}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(evento) => {
                          //: A MESMA GUARDA DA LINHA, e ela faltava aqui: o
                          //: `stopPropagation` impede o `tr` de abrir, então a
                          //: guarda de lá não roda — e o comportamento padrão do
                          //: `a` abria a página de qualquer jeito. Selecionar
                          //: texto DENTRO do link é o caso mais provável de
                          //: todos, porque o texto da menção é o próprio link.
                          if (window.getSelection()?.toString()) evento.preventDefault();
                          evento.stopPropagation();
                        }}
                        style={{ color: 'inherit', textDecoration: 'none' }}
                      >
                        {conteudo}
                      </a>
                    ) : (
                      conteudo
                    )}
                  </td>
                );
              })}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
