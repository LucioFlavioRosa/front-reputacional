/** A matriz de risco corporativo: os 32 riscos em 8 clusters.
 *
 *  TODOS OS RISCOS DO CADASTRO, inclusive os sem incidente — "não houve" é
 *  informação, e a matriz é o mapa da empresa, não a lista do mês. Um mapa que
 *  muda de tamanho a cada recorte não deixa procurar, e esconder o risco zerado
 *  tiraria justamente a informação de que ele está limpo.
 *
 *  CLICAR NUM RISCO ABRE O APROFUNDAMENTO, e não recorta a tela — e esta é a
 *  regra que o dono do produto fixou nas Lentes: "ao clicar em um dado temos que
 *  abrir um modal com o deep diving, e não como é feito hoje". Filtrar a tela
 *  REFAZ a leitura inteira e quem clicou perde de vista de onde saiu; o modal põe
 *  o pedaço ao lado, com a trilha de volta. O protótipo ainda diz "clique em um
 *  risco para filtrar a tela" — a decisão posterior do dono do produto vale mais.
 *
 *  A SOMA DA GRADE SUPERA O TOTAL DE INCIDENTES, de propósito: um incidente pode
 *  tocar mais de um risco, e a matriz conta o fato em cada risco que ele atinge —
 *  é o que "este incidente toca estes dois riscos" significa. Os três números do
 *  topo, ao contrário, contam o INCIDENTE pela pior severidade dele, e por isso
 *  somam o total. A legenda diz isso, porque as duas contas certas dando números
 *  diferentes é a dúvida que aparece na primeira reunião.
 */

import { Secao } from '@/componentes/basicos';
import {
  areaDaSeveridade,
  corDaSeveridade,
  rotuloDaSeveridade,
} from '@/dominio/riscos';
import type { RiscoDaMatriz } from '@/dominio/riscos';
import { numero } from '@/dominio/formato';

export function MatrizDeRisco({
  matriz,
  riscoAberto,
  aoAprofundar,
}: {
  matriz: RiscoDaMatriz[];
  /** O risco do recorte atual, para ele aparecer marcado na grade. */
  riscoAberto?: string | null;
  aoAprofundar: (codigo: string) => void;
}) {
  const clusters = new Map<string, { nome: string; riscos: RiscoDaMatriz[] }>();
  for (const risco of matriz) {
    const cluster = clusters.get(risco.cluster) ?? { nome: risco.cluster_nome, riscos: [] };
    cluster.riscos.push(risco);
    clusters.set(risco.cluster, cluster);
  }

  return (
    <Secao
      titulo="Riscos"
      subtitulo="Matriz de risco corporativo Aegea · clique num risco para abrir o aprofundamento"
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {[...clusters.entries()].map(([codigo, cluster]) => (
          <div
            key={codigo}
            style={{
              flex: '1 1 300px',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: 14,
              border: '1px solid var(--borda)',
              borderRadius: 'var(--r-card)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 8,
                minHeight: 32,
                marginBottom: 2,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--cinza-2)',
                  lineHeight: 1.35,
                }}
              >
                {cluster.nome}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--cinza-3)',
                  whiteSpace: 'nowrap',
                }}
              >
                {numero(cluster.riscos.reduce((soma, risco) => soma + risco.incidentes, 0))}
              </span>
            </div>

            {cluster.riscos.map((risco) => {
              const aberto = risco.codigo === riscoAberto;
              const temIncidente = risco.incidentes > 0;
              return (
                <button
                  key={risco.codigo}
                  type="button"
                  aria-pressed={aberto}
                  //: O NOME DIZ O QUE O CLIQUE FAZ. Sem ele, o nome acessível é
                  //: o texto das três células lido em sequência — "Entrega de
                  //: água Crítico 3" —, que descreve a linha e não a ação. E
                  //: colide com o número do topo, que também contém "Crítico".
                  aria-label={
                    temIncidente
                      ? `Aprofundar no risco ${risco.nome} — ${rotuloDaSeveridade(risco.severidade)}, ${numero(risco.incidentes)} incidentes`
                      : `Risco ${risco.nome} — ${rotuloDaSeveridade(risco.severidade)}, sem incidente neste recorte`
                  }
                  onClick={() => aoAprofundar(risco.codigo)}
                  title={
                    temIncidente
                      ? `${numero(risco.mencoes)} em menções e ${numero(risco.agendas)} em agendas do CRM`
                      : 'Nenhum incidente deste recorte toca este risco'
                  }
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto 36px',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    minHeight: 44,
                    padding: '7px 10px',
                    boxSizing: 'border-box',
                    textAlign: 'left',
                    borderRadius: 'var(--r-btn)',
                    border: `1px solid ${aberto ? 'var(--azul-mar)' : temIncidente ? corDaSeveridade(risco.severidade) : 'var(--borda)'}`,
                    //: SEM INCIDENTE FICA BRANCO, e com incidente ganha o fundo
                    //: da severidade: a cor diz a gravidade do risco, a
                    //: intensidade diz se ele foi atingido.
                    background: temIncidente ? areaDaSeveridade(risco.severidade) : 'var(--branco)',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: 'var(--cinza-4)',
                  }}
                >
                  <span style={{ lineHeight: 1.3 }}>{risco.nome}</span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '2px 6px',
                      border: `1px solid ${corDaSeveridade(risco.severidade)}`,
                      borderRadius: 'var(--r-chip)',
                      background: 'var(--branco)',
                      fontSize: 11,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{ width: 7, height: 7, background: corDaSeveridade(risco.severidade) }}
                    />
                    {rotuloDaSeveridade(risco.severidade)}
                  </span>
                  <span
                    style={{
                      textAlign: 'right',
                      fontSize: 15,
                      fontWeight: temIncidente ? 800 : 400,
                      color: temIncidente ? 'var(--cinza-4)' : 'var(--cinza-2)',
                    }}
                  >
                    {temIncidente ? numero(risco.incidentes) : '—'}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px 20px',
          marginTop: 16,
          fontSize: 12,
          color: 'var(--cinza-3)',
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--cinza-2)',
          }}
        >
          Severidade do risco
        </span>
        {['critico', 'alto', 'moderado'].map((severidade) => (
          <span
            key={severidade}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 14,
                height: 14,
                background: areaDaSeveridade(severidade),
                border: `1px solid ${corDaSeveridade(severidade)}`,
              }}
            />
            {rotuloDaSeveridade(severidade)}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            aria-hidden="true"
            style={{ width: 14, height: 14, background: 'var(--branco)', border: '1px solid var(--borda)' }}
          />
          Sem incidente
        </span>
        <span style={{ color: 'var(--cinza-2)' }}>
          Um incidente pode tocar mais de um risco, por isso a soma da grade supera o total de
          incidentes
        </span>
      </div>
    </Secao>
  );
}
