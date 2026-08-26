/** Gerar relatório — seleção de seções e prévia impressa.
 *
 *  O PDF sai da impressão do navegador sobre um layout próprio: é o que o
 *  handoff pede ("Salvar PDF") sem depender de gerador no backend.
 *
 *  `POST /api/relatorios` JÁ existe, e não devolve documento: registra quem
 *  gerou, sobre qual recorte e quantas linhas saíram. É a trilha que responde
 *  "o que saiu daqui?" depois de um incidente — o documento continua sendo
 *  montado aqui.
 */

import { useMemo, useState } from 'react';
import { registrarRelatorio } from '@/api/cliente';
import { usePainel } from '@/estado/painel';
import { resumirRecorte } from '@/dominio/resumo-do-recorte';
import { Ranking } from '@/graficos/Ranking';
import { Botao, Carregando, FaixaDeErro, Modal } from '@/componentes/basicos';
import { dataCompleta, numero, percentual } from '@/dominio/formato';
import { ROTULOS_DE_FRENTE, ROTULOS_DE_GRUPO } from '@/dominio/frentes';
import {
  filaDePendencias,
  kpis as calcularKpis,
  nomeDaInstituicao,
  ranking,
  resolutividade,
  resultados,
} from '@/dominio/derivacoes';

const SECOES = [
  { id: 'resumo', rotulo: 'Resumo executivo', descricao: 'leitura do período e indicadores principais' },
  { id: 'volumetria', rotulo: 'Volumetria por frente', descricao: 'distribuição do recorte' },
  { id: 'status', rotulo: 'Status e resolutividade', descricao: 'grupos e taxa por frente' },
  { id: 'resultado', rotulo: 'Resultado das interações', descricao: 'avançou, manteve, recuou' },
  { id: 'rankings', rotulo: 'Rankings do período', descricao: 'veículos, temas, unidades, UF' },
  { id: 'interlocutores', rotulo: 'Interlocutores', descricao: 'pessoas com mais interações' },
  { id: 'pendencias', rotulo: 'Pendências em aberto', descricao: 'fila pelo tempo parado' },
  {
    id: 'base',
    rotulo: 'Base de registros',
    // Não é a tabela completa: o layout impresso corta em `LINHAS_IMPRESSAS`.
    // Dizer "completa" fazia a trilha registrar 6.000 quando saíam 80.
    descricao: 'amostra da base — as primeiras 80 linhas do recorte',
  },
] as const;

type IdDeSecao = (typeof SECOES)[number]['id'];

export function GerarRelatorio({ aoFechar }: { aoFechar: () => void }) {
  const { interacoes, catalogo, recorte, carregando } = usePainel();
  const [selecionadas, definirSelecionadas] = useState<IdDeSecao[]>([
    'resumo',
    'volumetria',
    'status',
    'resultado',
    'rankings',
  ]);
  const [previa, definirPrevia] = useState(false);
  const [registrando, definirRegistrando] = useState(false);
  const [falha, definirFalha] = useState<string | null>(null);

  /**
   * Registra a geração ANTES de montar a prévia.
   *
   * O documento sai da impressão do navegador; o servidor não o produz nem o
   * guarda. O que fica é a trilha de quem gerou, sobre qual recorte e quantos
   * registros — a pergunta que ninguém consegue responder depois de um
   * incidente se ela não existir.
   *
   * Falhar em registrar NÃO impede a prévia: o relatório é trabalho legítimo, e
   * bloqueá-lo por causa da trilha inverteria a prioridade. A falha vai para a
   * telemetria pelo caminho normal de erro do cliente HTTP.
   */
  const verPrevia = async () => {
    definirRegistrando(true);
    definirFalha(null);
    try {
      await registrarRelatorio(recorte, [...selecionadas]);
      definirPrevia(true);
    } catch (erro) {
      // NÃO abre a prévia.
      //
      // Seguir mesmo assim, para "não bloquear trabalho legítimo", não salvaria
      // trabalho nenhum: os casos em que o registro falha são sessão expirada,
      // CSRF ausente ou backend fora, e em todos eles os dados na tela já estão
      // velhos. O que se ganharia era tornar a trilha opcional no fluxo
      // oficial.
      definirFalha(
        erro instanceof Error
          ? erro.message
          : 'Não foi possível preparar o relatório. Tente novamente.',
      );
    } finally {
      definirRegistrando(false);
    }
  };

  const dados = useMemo(() => {
    if (!catalogo) return null;
    return {
      kpis: calcularKpis(interacoes, catalogo),
      resolucao: resolutividade(interacoes, catalogo),
      desfecho: resultados(interacoes, catalogo),
      veiculos: ranking(interacoes, catalogo, 'entidade', 10),
      temas: ranking(interacoes, catalogo, 'tag', 10),
      pessoas: ranking(interacoes, catalogo, 'pessoa', 10),
      frentes: ranking(interacoes, catalogo, 'frente', 7),
      fila: filaDePendencias(interacoes, catalogo).slice(0, 15),
    };
  }, [interacoes, catalogo]);

  if (carregando || !dados || !catalogo) {
    return (
      <Modal titulo="Gerar relatório" aoFechar={aoFechar} largura={680}>
        <Carregando />
      </Modal>
    );
  }

  const alternarSecao = (id: IdDeSecao) => {
    definirSelecionadas((atuais) =>
      atuais.includes(id) ? atuais.filter((s) => s !== id) : [...atuais, id],
    );
  };

  const inclui = (id: IdDeSecao) => selecionadas.includes(id);
  const resumo = resumirRecorte(recorte, catalogo);

  if (!previa) {
    return (
      <Modal
        titulo="Gerar relatório"
        subtitulo={resumo}
        aoFechar={aoFechar}
        largura={680}
        rodape={
          <>
            <Botao aoClicar={() => definirSelecionadas(SECOES.map((s) => s.id))}>Todas</Botao>
            <Botao aoClicar={() => definirSelecionadas([])}>Nenhuma</Botao>
            <Botao
              variante="primario"
              aoClicar={verPrevia}
              desabilitado={!selecionadas.length || registrando}
            >
              {registrando ? 'Preparando…' : 'Ver prévia'}
            </Botao>
          </>
        }
      >
        {falha && <FaixaDeErro mensagem={falha} />}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {SECOES.map((secao) => (
            <label
              key={secao.id}
              style={{
                display: 'flex',
                gap: 11,
                alignItems: 'flex-start',
                padding: '12px 14px',
                border: `1px solid ${inclui(secao.id) ? 'var(--azul-mar)' : 'var(--borda)'}`,
                borderRadius: 'var(--r-card-int)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={inclui(secao.id)}
                onChange={() => alternarSecao(secao.id)}
                style={{ marginTop: 3 }}
              />
              <span>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>
                  {secao.rotulo}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--cinza-2)' }}>
                  {secao.descricao}
                </span>
              </span>
            </label>
          ))}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      titulo="Prévia do relatório"
      subtitulo={resumo}
      aoFechar={aoFechar}
      largura={1080}
      rodape={
        <>
          <Botao aoClicar={() => definirPrevia(false)}>Mudar seções</Botao>
          <Botao variante="primario" aoClicar={() => window.print()}>
            Salvar PDF
          </Botao>
        </>
      }
    >
      <article style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        <header style={{ borderBottom: '2px solid var(--azul-mar)', paddingBottom: 12 }}>
          <div className="kicker">Aegea · Painel Reputacional</div>
          <h1 style={{ fontSize: 26, marginTop: 6 }}>Relatório do período</h1>
          <p style={{ fontSize: 12, color: 'var(--cinza-2)', marginTop: 6 }}>
            Recorte: {resumo} · {numero(interacoes.length)}{' '}
            {interacoes.length === 1 ? 'registro' : 'registros'} · gerado em{' '}
            {new Date().toLocaleDateString('pt-BR')}
          </p>
        </header>

        {inclui('resumo') ? (
          <SecaoImpressa titulo="Resumo executivo">
            <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--cinza-3)' }}>
              O recorte reúne <strong>{numero(interacoes.length)}</strong>{' '}
              {interacoes.length === 1 ? 'interação' : 'interações'}, das quais{' '}
              <strong>{numero(dados.kpis.tier1.total)}</strong> em Tier 1 (
              {percentual(dados.kpis.tier1.total, interacoes.length)}). A taxa de resolutividade é
              de <strong>{percentual(dados.resolucao.taxa * 100, 100)}</strong> e a taxa de avanço,
              de <strong>{percentual(dados.desfecho.taxaDeAvanco * 100, 100)}</strong> sobre{' '}
              {numero(dados.desfecho.denominador)}{' '}
              {dados.desfecho.denominador === 1 ? 'registro' : 'registros'} com desfecho informado.
            </p>
          </SecaoImpressa>
        ) : null}

        {inclui('volumetria') ? (
          <SecaoImpressa titulo="Volumetria por frente">
            <Ranking
              itens={dados.frentes.map((item) => ({
                ...item,
                rotulo: ROTULOS_DE_FRENTE[item.chave as keyof typeof ROTULOS_DE_FRENTE] ?? item.rotulo,
              }))}
            />
          </SecaoImpressa>
        ) : null}

        {inclui('status') ? (
          <SecaoImpressa titulo="Status e resolutividade">
            <Ranking
              itens={dados.resolucao.grupos.map((grupo) => ({
                chave: grupo.grupo,
                rotulo: ROTULOS_DE_GRUPO[grupo.grupo],
                total: grupo.total,
              }))}
            />
          </SecaoImpressa>
        ) : null}

        {inclui('resultado') ? (
          <SecaoImpressa titulo="Resultado das interações">
            <Ranking
              itens={dados.desfecho.itens.map((item) => ({
                chave: item.chave,
                rotulo: item.rotulo,
                total: item.total,
                cor: item.cor,
              }))}
            />
          </SecaoImpressa>
        ) : null}

        {inclui('rankings') ? (
          <SecaoImpressa titulo="Rankings do período">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <div className="kicker" style={{ marginBottom: 10 }}>
                  Veículos e órgãos
                </div>
                <Ranking itens={dados.veiculos} />
              </div>
              <div>
                <div className="kicker" style={{ marginBottom: 10 }}>
                  Temas
                </div>
                <Ranking itens={dados.temas} cor="var(--turquesa-rio)" />
              </div>
            </div>
          </SecaoImpressa>
        ) : null}

        {inclui('interlocutores') ? (
          <SecaoImpressa titulo="Interlocutores">
            <Ranking itens={dados.pessoas} cor="var(--roxo-acai)" />
          </SecaoImpressa>
        ) : null}

        {inclui('pendencias') ? (
          <SecaoImpressa titulo="Pendências em aberto">
            {!dados.fila.length ? (
              <p style={{ fontSize: 13, color: 'var(--cinza-2)' }}>Nada em aberto no recorte.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <tbody>
                  {dados.fila.map(({ interacao, dias }) => (
                    <tr key={interacao.id} style={{ borderBottom: '1px solid var(--borda)' }}>
                      <td className="tabular" style={{ padding: '7px 4px', width: 60 }}>
                        {dias < 0 ? '—' : `${dias}d`}
                      </td>
                      <td style={{ padding: '7px 4px', fontWeight: 700 }}>
                        {nomeDaInstituicao(catalogo, interacao.instituicao_id)}
                      </td>
                      <td style={{ padding: '7px 4px', color: 'var(--cinza-3)' }}>
                        {interacao.pauta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SecaoImpressa>
        ) : null}

        {inclui('base') ? (
          <SecaoImpressa titulo="Base de registros">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <tbody>
                {interacoes.slice(0, 80).map((interacao) => (
                  <tr key={interacao.id} style={{ borderBottom: '1px solid var(--borda)' }}>
                    <td className="tabular" style={{ padding: '6px 4px', width: 72 }}>
                      {dataCompleta(interacao.data_interacao)}
                    </td>
                    <td style={{ padding: '6px 4px', width: 90 }}>
                      {ROTULOS_DE_FRENTE[interacao.frente]}
                    </td>
                    <td style={{ padding: '6px 4px' }}>
                      {nomeDaInstituicao(catalogo, interacao.instituicao_id)}
                    </td>
                    <td style={{ padding: '6px 4px', color: 'var(--cinza-3)' }}>
                      {interacao.pauta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {interacoes.length > 80 ? (
              <p style={{ fontSize: 11, color: 'var(--cinza-2)', marginTop: 8 }}>
                Mostrando os 80 primeiros de {numero(interacoes.length)} registros — use a
                exportação CSV da Base para o conjunto completo.
              </p>
            ) : null}
          </SecaoImpressa>
        ) : null}
      </article>
    </Modal>
  );
}

function SecaoImpressa({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ breakInside: 'avoid' }}>
      <h2 style={{ fontSize: 16, marginBottom: 12 }}>{titulo}</h2>
      {children}
    </section>
  );
}
