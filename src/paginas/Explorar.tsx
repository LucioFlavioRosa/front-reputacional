/** Explorar — o mesmo recorte, o eixo à escolha.
 *
 *  CINCO EIXOS, UM SELETOR.
 *
 *  Frente, situação, resultado, porta-voz e interlocutor são o MESMO recorte
 *  girado. Uma aba por eixo faria trocar de tela para trocar de pergunta, e
 *  quem lê perde o fio no caminho.
 *
 *  Aqui o recorte fica, a tela fica, e só o agrupamento muda. É o que a leitura
 *  de painel analítico pede: aprofundar e comparar, não navegar entre irmãos.
 *
 *  AS MESMAS QUATRO MEDIDAS EM TODO EIXO — volume, Tier 1, em aberto e taxa de
 *  avanço. Juntas numa linha, respondem "quanto", "quão importante", "quanto
 *  ficou pelo caminho" e
 *  "deu em quê".
 */

import { useMemo } from 'react';
import { usePainel } from '@/estado/painel';
import {
  Barra,
  Carregando,
  Cartao,
  Chip,
  FaixaDeErro,
  Kpi,
  Secao,
  Vazio,
} from '@/componentes/basicos';
import { numero } from '@/dominio/formato';
import { EIXOS_DE_MUITOS_VALORES, agrupar, panorama, porMes } from '@/dominio/agregacao';
import type { Eixo } from '@/navegacao/rota';
import { EIXOS } from '@/navegacao/rota';

export function Explorar({
  eixo,
  aoTrocarEixo,
}: {
  eixo: Eixo;
  aoTrocarEixo: (eixo: Eixo) => void;
}) {
  const { interacoes, catalogo, carregando, erro } = usePainel();

  const grupos = useMemo(
    () => (catalogo ? agrupar(interacoes, eixo, catalogo) : []),
    [interacoes, catalogo, eixo],
  );
  const medidas = useMemo(
    () => (catalogo ? panorama(interacoes, catalogo) : null),
    [interacoes, catalogo],
  );
  const meses = useMemo(() => porMes(interacoes), [interacoes]);

  if (erro) return <FaixaDeErro mensagem={erro} />;
  if (carregando || !catalogo || !medidas) return <Carregando />;

  const taxa = medidas.comDesfecho
    ? Math.round((medidas.avancou / medidas.comDesfecho) * 100)
    : null;
  const maior = Math.max(1, ...grupos.map((g) => g.total));
  const rotuloDoEixo = EIXOS.find((e) => e.eixo === eixo)?.rotulo ?? eixo;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 26 }}>Explorar</h1>
        <p style={{ fontSize: 13, color: 'var(--cinza-3)', marginTop: 4 }}>
          O recorte inteiro, agrupado pelo eixo que você escolher.
        </p>
      </div>

      {/* `grade grade--4`, e não uma classe inventada. `grade-kpis` não existe
          no CSS — e o efeito não foi erro nenhum: os quatro indicadores
          empilhavam em coluna, ocupando meia tela cada um. Estilo que não
          existe falha em silêncio. */}
      <div className="grade grade--4" style={{ gap: 14 }}>
        <Kpi rotulo="Agendas no recorte" valor={numero(medidas.total)} />
        <Kpi
          rotulo="Relevância Tier 1"
          valor={numero(medidas.tier1)}
          dica={
            medidas.total
              ? `${Math.round((medidas.tier1 / medidas.total) * 100)}% do recorte`
              : undefined
          }
        />
        <Kpi
          rotulo="Em aberto"
          valor={numero(medidas.emAberto)}
          cor="var(--grupo-aberto)"
        />
        <Kpi
          rotulo="Taxa de avanço"
          valor={taxa === null ? '—' : `${taxa}%`}
          // O DENOMINADOR À VISTA: 100% de dois casos não é o mesmo que 100%
          // de duzentos, e sem o denominador as duas coisas se leem igual.
          dica={
            medidas.comDesfecho
              ? `sobre ${numero(medidas.comDesfecho)} com desfecho informado`
              : 'nenhum desfecho informado'
          }
        />
      </div>

      <Cartao>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--cinza-2)',
            marginBottom: 10,
          }}
        >
          Ver por
        </div>
        <div
          role="group"
          aria-label="Eixo de agrupamento"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}
        >
          {EIXOS.map((opcao) => (
            <Chip
              key={opcao.eixo}
              rotulo={opcao.rotulo}
              ativo={opcao.eixo === eixo}
              fundo={opcao.eixo === eixo ? 'var(--azul-mar)' : 'var(--bg-trilho)'}
              texto={opcao.eixo === eixo ? 'var(--branco)' : 'var(--cinza-3)'}
              titulo={`Agrupar por ${opcao.rotulo.toLowerCase()}`}
              aoClicar={() => aoTrocarEixo(opcao.eixo)}
            />
          ))}
        </div>
      </Cartao>

      <Secao titulo={`Por ${rotuloDoEixo.toLowerCase()} — ${grupos.length} ${grupos.length === 1 ? 'grupo' : 'grupos'}`} estilo={{ padding: 0 }}>
        {!grupos.length ? (
          <div style={{ padding: 24 }}>
            <Vazio mensagem="Nenhum registro no recorte" dica="Ajuste os filtros." />
          </div>
        ) : (
          <div className="rolagem-interna" style={{ maxHeight: 'calc(100vh - 460px)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {[rotuloDoEixo, 'Agendas', 'Tier 1', 'Em aberto', 'Clima reativo', 'Avanço'].map(
                    (coluna, indice) => (
                      <th
                        key={coluna}
                        style={{
                          position: 'sticky',
                          top: 0,
                          zIndex: 1,
                          background: 'var(--bg-trilho)',
                          textAlign: indice === 0 ? 'left' : 'right',
                          padding: '10px 14px',
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          color: 'var(--cinza-2)',
                          whiteSpace: 'nowrap',
                          borderBottom: '1px solid var(--borda)',
                        }}
                      >
                        {coluna}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {grupos.map((grupo) => (
                  <tr key={grupo.chave} style={{ borderBottom: '1px solid var(--borda)' }}>
                    <td style={{ padding: '9px 14px', minWidth: 220 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          aria-hidden
                          style={{
                            width: 3,
                            alignSelf: 'stretch',
                            minHeight: 16,
                            background: grupo.cor ?? 'var(--borda-input)',
                            borderRadius: 2,
                          }}
                        />
                        <span style={{ fontWeight: 500, color: 'var(--cinza-4)' }}>
                          {grupo.rotulo}
                        </span>
                      </div>
                      <div style={{ marginTop: 5, marginLeft: 13 }}>
                        <Barra
                          valor={grupo.total}
                          maximo={maior}
                          cor={grupo.cor ?? 'var(--azul-mar)'}
                        />
                      </div>
                    </td>
                    <Celula valor={numero(grupo.total)} forte />
                    <Celula valor={grupo.tier1 ? numero(grupo.tier1) : '—'} />
                    <Celula
                      valor={grupo.emAberto ? numero(grupo.emAberto) : '—'}
                      cor={grupo.emAberto ? 'var(--grupo-aberto)' : undefined}
                    />
                    <Celula
                      valor={grupo.tenso ? numero(grupo.tenso) : '—'}
                      cor={grupo.tenso ? 'var(--clima-tenso)' : undefined}
                    />
                    <Celula
                      valor={
                        grupo.comDesfecho
                          ? `${Math.round((grupo.avancou / grupo.comDesfecho) * 100)}%`
                          : '—'
                      }
                      dica={
                        grupo.comDesfecho
                          ? `${grupo.avancou} de ${grupo.comDesfecho} com desfecho`
                          : 'sem desfecho informado'
                      }
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Secao>

      {EIXOS_DE_MUITOS_VALORES.has(eixo) ? (
        // A SOMA NÃO BATE COM O TOTAL, e é preciso dizer: uma agenda com dois
        // porta-vozes conta nos dois grupos. Quem soma a coluna e não bate
        // desconfia do número certo.
        <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: 0 }}>
          Uma agenda pode entrar em mais de um grupo: a soma passa do total.
        </p>
      ) : null}

      {meses.length > 1 ? (
        <Secao titulo="Volume por mês">
          <Cartao>
            <SerieMensal meses={meses} />
          </Cartao>
        </Secao>
      ) : null}
    </div>
  );
}

function Celula({
  valor,
  forte,
  cor,
  dica,
}: {
  valor: string;
  forte?: boolean;
  cor?: string;
  dica?: string;
}) {
  return (
    <td
      className="tabular"
      title={dica}
      style={{
        padding: '9px 14px',
        textAlign: 'right',
        whiteSpace: 'nowrap',
        verticalAlign: 'top',
        fontWeight: forte ? 700 : 400,
        color: cor ?? 'var(--cinza-3)',
      }}
    >
      {valor}
    </td>
  );
}

/** A série mensal, desenhada em barras.
 *
 *  Barras e não linha: os meses são categorias contíguas e discretas, e uma
 *  linha entre eles sugere continuidade que a contagem mensal não tem.
 */
function SerieMensal({ meses }: { meses: { mes: string; total: number; tier1: number }[] }) {
  const maior = Math.max(1, ...meses.map((m) => m.total));

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 6,
        height: 132,
        overflowX: 'auto',
      }}
    >
      {meses.map((m) => (
        <div
          key={m.mes}
          title={`${m.mes}: ${m.total} agendas, ${m.tier1} Tier 1`}
          style={{
            flex: '1 0 34px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 5,
            height: '100%',
            justifyContent: 'flex-end',
          }}
        >
          <span className="tabular" style={{ fontSize: 10, color: 'var(--cinza-2)' }}>
            {m.total || ''}
          </span>
          <span
            aria-hidden
            style={{
              width: '100%',
              height: `${(m.total / maior) * 88}px`,
              minHeight: m.total ? 2 : 0,
              background: 'var(--azul-mar)',
              borderRadius: '2px 2px 0 0',
              position: 'relative',
            }}
          >
            {m.tier1 ? (
              <span
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: `${(m.tier1 / Math.max(m.total, 1)) * 100}%`,
                  background: 'var(--turquesa-rio)',
                }}
              />
            ) : null}
          </span>
          <span style={{ fontSize: 9.5, color: 'var(--cinza-2)', whiteSpace: 'nowrap' }}>
            {m.mes.slice(5)}/{m.mes.slice(2, 4)}
          </span>
        </div>
      ))}
    </div>
  );
}
