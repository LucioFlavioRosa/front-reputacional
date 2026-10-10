/** O relatório de incidentes: o MICRO do caminho, os registros do recorte.
 *
 *  É O FIM DA DESCIDA. O gráfico diz quando, a matriz diz onde, e esta tabela diz
 *  o quê — a notícia e a reunião, uma por linha, com o link para a fonte.
 *
 *  DUAS FAMÍLIAS NA MESMA TABELA, e a coluna "Tipo" diz qual é qual: menção
 *  negativa da imprensa e das redes, e agenda de clima tenso do CRM. Elas se
 *  intercalam por data, e não uma lista depois da outra: a pergunta é "o que
 *  aconteceu neste período", e a resposta é cronológica.
 *
 *  AS COLUNAS QUE UMA FONTE SÓ TEM DIZEM ISSO. "Alcance" vem como tier na
 *  imprensa e como engajamento nas redes, cru nas duas formas — traduzir
 *  obrigaria a inventar equivalência entre "muito relevante" e 1.243 interações.
 *  Na agenda a célula escreve "não se aplica", e não fica vazia: célula vazia
 *  numa coluna que o resto da tabela preenche se lê como dado faltando, e manda
 *  a pessoa procurar o que cobrar do fornecedor.
 *
 *  A RECORRÊNCIA É SOBRE O ASSUNTO, NÃO SOBRE O PERÍODO: "este assunto já voltou
 *  em sete meses" conta a série inteira, mesmo com a janela em um mês. É o que
 *  separa o fato isolado do problema crônico, e é a coluna que faz alguém abrir
 *  uma frente de trabalho em vez de responder a uma notícia.
 */

import { Paginacao } from '@/componentes/Paginacao';
import { Botao, Vazio } from '@/componentes/basicos';
import {
  alcanceDoIncidente,
  areaDaSeveridade,
  corDaSeveridade,
  quemDoIncidente,
  rotuloDaSeveridade,
  textoDaSeveridade,
  tituloDoIncidente,
} from '@/dominio/riscos';
import type { IncidenteNaTabela, PaginaDeIncidentes } from '@/dominio/riscos';
import { dataCompleta, numero } from '@/dominio/formato';

const COLUNAS = '96px 86px 150px 108px 112px 100px minmax(300px, 2fr) minmax(220px, 1.2fr)';

export function RelatorioDeIncidentes({
  pagina,
  aoMudarPagina,
  aoAprofundarNoTema,
  aoExportar,
}: {
  pagina: PaginaDeIncidentes;
  aoMudarPagina: (pagina: number) => void;
  /** Clicar no assunto desce nele — o último degrau antes do registro. */
  aoAprofundarNoTema: (tema: string) => void;
  aoExportar?: () => void;
}) {
  const totalDePaginas = Math.max(1, Math.ceil(pagina.total / Math.max(1, pagina.tamanho)));

  return (
    <section
      aria-label="Incidentes"
      style={{
        background: 'var(--branco)',
        border: '1px solid var(--borda)',
        borderRadius: 'var(--r-card)',
      }}
    >
      <div
        style={{
          padding: '20px 24px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: '8px 24px',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--cinza-2)',
            }}
          >
            Relatório de incidentes
          </div>
          <h2 style={{ margin: '6px 0 0', fontSize: 20, fontWeight: 700 }}>
            {numero(pagina.total)}{' '}
            {pagina.total === 1 ? 'incidente no recorte' : 'incidentes no recorte'}
          </h2>
        </div>
        {aoExportar ? (
          <Botao variante="primario" aoClicar={aoExportar}>
            Exportar
          </Botao>
        ) : null}
      </div>

      {pagina.itens.length === 0 ? (
        <div style={{ padding: '8px 24px 24px' }}>
          <Vazio
            mensagem="Nenhum incidente neste recorte"
            dica="Remova um degrau da trilha, ou amplie a janela de análise."
          />
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <div role="table" aria-label="Lista de incidentes" style={{ minWidth: 1180 }}>
              <div role="row" style={{ ...LINHA, ...CABECALHO }}>
                <span role="columnheader">Data</span>
                <span role="columnheader">Tipo</span>
                <span role="columnheader">Quem</span>
                <span role="columnheader">Alcance</span>
                <span role="columnheader">Severidade</span>
                <span role="columnheader">Recorrência</span>
                <span role="columnheader">Incidente</span>
                <span role="columnheader">Riscos relacionados</span>
              </div>
              {pagina.itens.map((incidente) => (
                <LinhaDoIncidente
                  key={`${incidente.tipo}-${incidente.id}`}
                  incidente={incidente}
                  aoAprofundarNoTema={aoAprofundarNoTema}
                />
              ))}
            </div>
          </div>
          <div style={{ padding: '0 24px 16px' }}>
            <Paginacao
              pagina={pagina.pagina}
              totalDePaginas={totalDePaginas}
              aoMudarPagina={aoMudarPagina}
            />
          </div>
        </>
      )}
    </section>
  );
}

function LinhaDoIncidente({
  incidente,
  aoAprofundarNoTema,
}: {
  incidente: IncidenteNaTabela;
  aoAprofundarNoTema: (tema: string) => void;
}) {
  const alcance = alcanceDoIncidente(incidente);
  const titulo = tituloDoIncidente(incidente);

  return (
    <div role="row" style={{ ...LINHA, ...CELULAS }}>
      <span role="cell" style={{ fontWeight: 500, paddingTop: 2, whiteSpace: 'nowrap' }}>
        {dataCompleta(incidente.data)}
      </span>

      <span role="cell" style={{ paddingTop: 2 }}>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 7px',
            borderRadius: 'var(--r-chip)',
            background: 'var(--bg-trilho)',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--cinza-3)',
          }}
        >
          {incidente.tipo === 'agenda' ? 'Agenda' : 'Menção'}
        </span>
      </span>

      <span
        role="cell"
        style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 2 }}
      >
        <span style={{ fontWeight: 500, lineHeight: 1.35 }}>{quemDoIncidente(incidente)}</span>
        {/* A LENTE E A FONTE JUNTAS: a lente diz de que ângulo se vê, a fonte
            diz de quem veio o dado — e quem confere uma planilha precisa da
            segunda. */}
        <span style={{ fontSize: 11, color: 'var(--cinza-2)' }}>
          {incidente.lente} · {incidente.fonte}
        </span>
      </span>

      <span
        role="cell"
        style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 2 }}
      >
        <span
          style={{
            fontWeight: alcance.ausente ? 400 : 700,
            //: "NÃO SE APLICA" EM CINZA: ele não é um valor, é a ausência
            //: explicada. Na mesma cor do tier, concorreria com o dado.
            color: alcance.ausente ? 'var(--cinza-2)' : 'var(--cinza-4)',
            fontStyle: alcance.ausente ? 'italic' : 'normal',
          }}
        >
          {alcance.valor}
        </span>
        {alcance.detalhe ? (
          <span style={{ fontSize: 11, color: 'var(--cinza-2)' }}>{alcance.detalhe}</span>
        ) : null}
      </span>

      <span role="cell" style={{ paddingTop: 2 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 8px',
            border: `1px solid ${corDaSeveridade(incidente.severidade)}`,
            background: areaDaSeveridade(incidente.severidade),
            borderRadius: 'var(--r-chip)',
            fontSize: 12,
            fontWeight: 700,
            color: textoDaSeveridade(incidente.severidade),
            whiteSpace: 'nowrap',
          }}
        >
          <span
            aria-hidden="true"
            style={{ width: 8, height: 8, background: corDaSeveridade(incidente.severidade) }}
          />
          {rotuloDaSeveridade(incidente.severidade)}
        </span>
      </span>

      <span
        role="cell"
        style={{ paddingTop: 2, fontWeight: incidente.recorrencia > 2 ? 700 : 400 }}
        title={
          incidente.recorrencia > 1
            ? `Este assunto teve incidente em ${incidente.recorrencia} meses da série`
            : 'Primeira vez que este assunto aparece na série'
        }
      >
        {incidente.recorrencia > 1 ? `${incidente.recorrencia} meses` : '1º mês'}
      </span>

      <span role="cell" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {incidente.link ? (
          <a
            href={incidente.link}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 14,
              fontWeight: 700,
              lineHeight: 1.35,
              color: 'var(--azul-mar)',
            }}
          >
            {titulo}
          </a>
        ) : (
          <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}>{titulo}</span>
        )}
        {/* O ASSUNTO É CLICÁVEL: é o último degrau antes do registro, e daqui
            se desce para ver tudo o que aquele assunto produziu. */}
        <button
          type="button"
          onClick={() => aoAprofundarNoTema(incidente.tema)}
          style={{
            alignSelf: 'flex-start',
            border: 0,
            padding: 0,
            background: 'transparent',
            fontSize: 12,
            color: 'var(--azul-mar)',
            textAlign: 'left',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          {incidente.tema}
        </button>
      </span>

      <span role="cell" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {incidente.riscos.map((risco) => (
          <span
            key={risco.codigo}
            style={{
              display: 'inline-block',
              padding: '3px 8px',
              background: 'var(--branco)',
              border: '1px solid var(--borda)',
              borderRadius: 'var(--r-chip)',
              fontSize: 12,
              color: 'var(--cinza-3)',
              lineHeight: 1.35,
            }}
          >
            {risco.nome}
          </span>
        ))}
      </span>
    </div>
  );
}

const LINHA = {
  display: 'grid',
  gridTemplateColumns: COLUNAS,
  gap: 16,
  padding: '10px 24px',
} as const;

const CABECALHO = {
  borderTop: '1px solid var(--borda)',
  borderBottom: '1px solid var(--borda)',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--cinza-2)',
} as const;

const CELULAS = {
  alignItems: 'start',
  padding: '16px 24px',
  borderBottom: '1px solid var(--bg-trilho)',
  fontSize: 13,
} as const;
