/** Preparar agenda — o que alguém precisa saber sobre um tema antes de
 *  entrar numa reunião, com o menor esforço possível: escolhe o tema e vê,
 *  numa tela só, o que a companhia já diz sobre ele, o que aconteceu nas
 *  últimas conversas e como elas costumam terminar.
 *
 *  O TEMA É UM FILTRO DO RECORTE — o mesmo `tags` que a gaveta de filtros
 *  usa. Escolher aqui é o mesmo que marcar o tema lá, e vice-versa; e todo
 *  outro filtro do recorte (período, área, tipo de interação, instituição,
 *  clima…) vale sobre os três blocos, como vale no Painel e na Base. Quem
 *  quer "só as reuniões com a ANA sobre tarifa nos últimos 90 dias" marca
 *  isso na gaveta e a tela responde.
 *
 *  OS BLOCOS REAPROVEITAM O QUE JÁ EXISTE: as agendas são as `interacoes` do
 *  contexto (o recorte já aplicado — inclusive os filtros que só existem no
 *  cliente, como tipo de interação e categoria de público), os documentos
 *  são os `materiais` DESSAS agendas (nenhuma chamada a mais, e nunca um
 *  documento de agenda fora do recorte), as referências vêm do catálogo (a
 *  biblioteca da Administração, só as ativas, filtradas pelos temas do
 *  recorte), e os gráficos são a `Rosca`, as `BarrasEmpilhadas` e o
 *  `Ranking` do Painel — a leitura visual é a mesma que a pessoa já conhece.
 */

import { urlDaVersao, urlDoArquivo } from '@/api/cliente';
import { Botao, Cartao, Carregando, FaixaDeErro, Secao, Vazio } from '@/componentes/basicos';
import { CampoQueCompleta } from '@/componentes/CampoQueCompleta';
import { BarrasEmpilhadas, Legenda } from '@/graficos/BarrasEmpilhadas';
import { Ranking } from '@/graficos/Ranking';
import { Rosca } from '@/graficos/Rosca';
import { dataCompleta, tituloDaAgenda } from '@/dominio/formato';
import { alternar } from '@/dominio/recorte';
import type { Recorte } from '@/dominio/recorte';
import {
  nomeDaInstituicao,
  nomeDaPessoa,
  nomesDosTemas,
  rotuloDeCodigo,
} from '@/dominio/derivacoes';
import type { Catalogo } from '@/dominio/derivacoes';
import type { Interacao, Referencia } from '@/dominio/tipos';
import {
  climaAntesEDepois,
  contagemPorDicionario,
  documentosDasAgendas,
  portaVozesDe,
  rankingPorId,
} from '@/dominio/preparacao';
import type { DocumentoDaAgenda } from '@/dominio/preparacao';
import { usePainel } from '@/estado/painel';

const QUANTAS_AGENDAS = 8;

export function PrepararAgenda({ aoAbrirAgenda }: { aoAbrirAgenda: (id: string) => void }) {
  const { catalogo, recorte, definirRecorte, interacoes, carregando, atualizando, erro } =
    usePainel();

  const temas = recorte.tags ?? [];
  const temTema = temas.length > 0;

  if (!catalogo) return <Carregando rotulo="Carregando o catálogo…" />;

  const escolherTema = (nome: string) => {
    const proximo = { ...recorte };
    if (nome) proximo.tags = [nome];
    else delete proximo.tags;
    definirRecorte(proximo);
  };

  const idsDosTemas = new Set(
    catalogo.dicionarios.temas.filter((t) => temas.includes(t.nome)).map((t) => t.id),
  );
  const referencias = catalogo.referencias.filter(
    (r) => r.ativo && r.temas.some((id) => idsDosTemas.has(id)),
  );
  const rotuloDosTemas = temas.join(', ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Secao
        titulo="Preparar agenda"
        subtitulo="Escolha o tema: o que a companhia diz sobre ele, o que aconteceu nas últimas conversas e como elas terminam. Os demais filtros do recorte valem aqui."
      >
        <Cartao>
          <div style={{ maxWidth: 520 }}>
            <CampoQueCompleta
              rotulo="Tema"
              valor={temas.length === 1 ? temas[0] : ''}
              aoEscolher={escolherTema}
              opcoes={catalogo.dicionarios.temas.map((t) => ({ valor: t.nome, rotulo: t.nome }))}
            />
            {temas.length > 1 ? (
              <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '6px 0 0' }}>
                Vários temas marcados na gaveta de filtros: {rotuloDosTemas}. Escolher um aqui
                substitui todos.
              </p>
            ) : null}
          </div>
        </Cartao>
      </Secao>

      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      {!temTema ? (
        <Vazio mensagem="Nenhum tema escolhido" dica="Escolha um tema acima para montar a preparação." />
      ) : carregando ? (
        <Carregando rotulo={`Reunindo o que há sobre ${rotuloDosTemas}…`} />
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            opacity: atualizando ? 0.6 : 1,
          }}
        >
          <BlocoDeReferencias
            tema={rotuloDosTemas}
            referencias={referencias}
            documentos={documentosDasAgendas(interacoes)}
            catalogo={catalogo}
          />
          <BlocoDeAgendas agendas={interacoes} catalogo={catalogo} aoAbrirAgenda={aoAbrirAgenda} />
          <BlocoDeGraficos
            agendas={interacoes}
            catalogo={catalogo}
            recorte={recorte}
            definirRecorte={definirRecorte}
          />
        </div>
      )}
    </div>
  );
}

/* -- bloco 1: o que a companhia diz sobre o tema ----------------------------- */

const ROTULO_DO_TIPO_DE_REFERENCIA: Record<string, string> = {
  posicionamento: 'Posicionamento oficial',
  qa: 'Q&A',
  release: 'Release',
};

function BlocoDeReferencias({
  tema,
  referencias,
  documentos,
  catalogo,
}: {
  tema: string;
  referencias: Referencia[];
  documentos: DocumentoDaAgenda[];
  catalogo: Catalogo;
}) {
  return (
    <Secao
      titulo="Materiais de referência"
      subtitulo={`Posicionamentos, Q&As e releases sobre ${tema} — e os documentos que saíram das reuniões.`}
    >
      <div className="grade grade--2" style={{ gap: 16, alignItems: 'start' }}>
        <Cartao>
          <p className="kicker" style={{ marginBottom: 10 }}>
            Biblioteca ({referencias.length})
          </p>
          {referencias.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>
              Nenhum posicionamento cadastrado para este tema.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {referencias.map((referencia) => (
                <li
                  key={referencia.id}
                  style={{ padding: '8px 0', borderTop: '1px solid var(--borda)' }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{referencia.titulo}</span>
                    <span style={{ fontSize: 11, color: 'var(--cinza-2)', whiteSpace: 'nowrap' }}>
                      {ROTULO_DO_TIPO_DE_REFERENCIA[referencia.tipo] ?? referencia.tipo}
                      {referencia.versao
                        ? ` · v${referencia.versao.numero} · ${dataCompleta(referencia.versao.atualizado_em)}`
                        : ''}
                    </span>
                  </div>
                  {referencia.resumo ? (
                    <p style={{ fontSize: 12, color: 'var(--cinza-3)', margin: '4px 0 0' }}>
                      {referencia.resumo}
                    </p>
                  ) : null}
                  {referencia.versao?.arquivo_id ? (
                    <a
                      href={urlDaVersao(referencia.id, referencia.versao.id)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12, color: 'var(--azul-mar)' }}
                    >
                      Abrir o arquivo
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao>
          <p className="kicker" style={{ marginBottom: 10 }}>
            Documentos das reuniões ({documentos.length})
          </p>
          {documentos.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>
              Nenhum documento de reunião com este tema.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {documentos.slice(0, QUANTAS_AGENDAS).map(({ chave, material, agenda }) => (
                <li key={chave} style={{ padding: '8px 0', borderTop: '1px solid var(--borda)' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{material.titulo}</span>
                    <span style={{ fontSize: 11, color: 'var(--cinza-2)', whiteSpace: 'nowrap' }}>
                      {dataCompleta(agenda.data_interacao)}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--cinza-3)', margin: '2px 0 0' }}>
                    {nomeDaInstituicao(catalogo, agenda.instituicao_id)}
                    {' · '}
                    <a
                      href={
                        material.arquivo
                          ? urlDoArquivo(agenda.id, material.arquivo.id)
                          : (material.url ?? '#')
                      }
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--azul-mar)' }}
                    >
                      {material.arquivo?.nome ?? 'abrir o link'}
                    </a>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </Secao>
  );
}

/* -- bloco 2: as últimas agendas do tema -------------------------------------- */

function BlocoDeAgendas({
  agendas,
  catalogo,
  aoAbrirAgenda,
}: {
  agendas: Interacao[];
  catalogo: Catalogo;
  aoAbrirAgenda: (id: string) => void;
}) {
  //: O contexto já vem em `-data_interacao`; a ordenação aqui é só garantia,
  //: para a lista não depender do padrão do servidor.
  const ultimas = [...agendas]
    .sort((a, b) => b.data_interacao.localeCompare(a.data_interacao))
    .slice(0, QUANTAS_AGENDAS);

  return (
    <Secao
      titulo={`Últimas agendas (${agendas.length} no total)`}
      subtitulo="As mais recentes no recorte — clique para abrir a ficha."
    >
      <Cartao>
        {ultimas.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>
            Nenhuma agenda registrada com este tema.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {ultimas.map((agenda) => (
              <li
                key={agenda.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px 14px',
                  alignItems: 'baseline',
                  padding: '8px 0',
                  borderTop: '1px solid var(--borda)',
                }}
              >
                <span className="tabular" style={{ fontSize: 12, color: 'var(--cinza-2)', minWidth: 90 }}>
                  {dataCompleta(agenda.data_interacao)}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {nomeDaInstituicao(catalogo, agenda.instituicao_id)}
                </span>
                <span style={{ fontSize: 13, flex: 1, minWidth: 200 }}>
                  {tituloDaAgenda(agenda, (ids) => nomesDosTemas(catalogo, ids))}
                </span>
                <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
                  {rotuloDeCodigo(catalogo, 'climas', agenda.clima)}
                  {' · '}
                  {rotuloDeCodigo(catalogo, 'resultados', agenda.resultado)}
                </span>
                <Botao variante="fantasma" aoClicar={() => aoAbrirAgenda(agenda.id)}>
                  Ficha
                </Botao>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </Secao>
  );
}

/* -- bloco 3: como as conversas sobre o tema terminam ------------------------ */

//: CLICAR NUM GRÁFICO FILTRA A PÁGINA INTEIRA — o mesmo gesto do Painel: a
//: fatia, a coluna ou a linha clicada vira filtro do recorte, e materiais,
//: agendas e os outros gráficos respondem. Clicar de novo desfaz
//: (`alternar`), e o que está ativo fica marcado no gráfico.
function BlocoDeGraficos({
  agendas,
  catalogo,
  recorte,
  definirRecorte,
}: {
  agendas: Interacao[];
  catalogo: Catalogo;
  recorte: Recorte;
  definirRecorte: (recorte: Recorte) => void;
}) {
  const filtrar = <C extends keyof Recorte>(campo: C, valor: Recorte[C]) =>
    definirRecorte(alternar(recorte, campo, valor));
  const desfechos = contagemPorDicionario(
    agendas,
    catalogo.dicionarios.resultados,
    (a) => a.resultado,
  );
  const clima = climaAntesEDepois(agendas, catalogo.dicionarios.climas);
  const porInstituicao = rankingPorId(
    agendas.map((a) => a.instituicao_id),
    (id) => nomeDaInstituicao(catalogo, id),
  );
  const porPortaVoz = rankingPorId(portaVozesDe(agendas), (id) => nomeDaPessoa(catalogo, id));

  return (
    <Secao
      titulo="Como as conversas sobre o tema terminam"
      subtitulo="Desfecho, clima esperado antes e registrado depois, e com quem se falou. Clique numa fatia, coluna ou linha para filtrar a página; clique de novo para desfazer."
    >
      <div className="grade grade--2" style={{ gap: 16, alignItems: 'start' }}>
        <Cartao>
          <p className="kicker" style={{ marginBottom: 10 }}>
            Desfecho
          </p>
          <Rosca
            itens={desfechos}
            ativo={recorte.resultado}
            aoClicar={(chave) => filtrar('resultado', chave)}
            vazio="Nenhuma agenda com desfecho registrado."
          />
          <Legenda
            itens={desfechos}
            ativo={recorte.resultado}
            aoClicar={(chave) => filtrar('resultado', chave)}
            centralizada
          />
        </Cartao>

        <Cartao>
          <p className="kicker" style={{ marginBottom: 10 }}>
            Clima: antes e depois
          </p>
          {/* A fatia clicada filtra pelo CLIMA REGISTRADO, nas duas colunas:
              o recorte não tem filtro de clima esperado, e "o que se esperava
              tenso" e "o que foi tenso" se olham lado a lado no mesmo filtro. */}
          <BarrasEmpilhadas
            colunas={clima.colunas}
            altura={150}
            formatarRotulo={(chave) => chave}
            aoClicarSegmento={(chave) => filtrar('clima', chave)}
          />
          <Legenda
            itens={clima.registrado}
            ativo={recorte.clima}
            aoClicar={(chave) => filtrar('clima', chave)}
            centralizada
          />
        </Cartao>

        <Cartao>
          <p className="kicker" style={{ marginBottom: 10 }}>
            Instituições mais frequentes
          </p>
          <Ranking
            itens={porInstituicao}
            ativo={recorte.entidade}
            aoClicar={(chave) => filtrar('entidade', chave)}
            vazio="Nenhuma agenda com este tema."
          />
        </Cartao>

        <Cartao>
          <p className="kicker" style={{ marginBottom: 10 }}>
            Porta-vozes que mais conduziram
          </p>
          <Ranking
            itens={porPortaVoz}
            ativo={recorte.portaVoz}
            aoClicar={(chave) => filtrar('portaVoz', chave)}
            cor="var(--turquesa-rio)"
            vazio="Nenhum porta-voz registrado."
          />
        </Cartao>
      </div>
    </Secao>
  );
}
