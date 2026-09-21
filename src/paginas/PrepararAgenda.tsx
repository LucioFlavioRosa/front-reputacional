/** Preparar agenda — o que alguém precisa saber sobre um tema antes de
 *  entrar numa reunião, com o menor esforço possível: escolhe o tema e vê,
 *  numa tela só, o que a companhia já diz sobre ele, o que aconteceu nas
 *  últimas conversas e como elas costumam terminar.
 *
 *  UM FILTRO SÓ, o tema. O Painel e a Base servem a quem analisa e quer
 *  cruzar; aqui quem chega tem uma reunião amanhã e uma pergunta: "o que eu
 *  preciso saber?". Cada filtro a mais é uma decisão a mais antes da
 *  resposta.
 *
 *  INDEPENDENTE DO RECORTE DO PAINEL, de propósito. Quem prepara uma reunião
 *  quer o histórico inteiro do tema, e não o recorte de período ou frente que
 *  ficou marcado no Painel — por isso a tela busca as agendas dela mesma
 *  (`listarRecorteCompleto` com só o tema), e não lê `interacoes` do contexto.
 *
 *  OS BLOCOS REAPROVEITAM O QUE JÁ EXISTE: as referências vêm do catálogo
 *  (a biblioteca da Administração, só as ativas), os documentos das reuniões
 *  da mesma rota da Base, e os gráficos são a `Rosca`, as `BarrasEmpilhadas`
 *  e o `Ranking` do Painel — a leitura visual é a mesma que a pessoa já
 *  conhece de lá.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  listarDocumentosDaReuniao,
  listarRecorteCompleto,
  urlDaVersao,
  urlDoArquivo,
} from '@/api/cliente';
import { Botao, Cartao, Carregando, FaixaDeErro, Secao, Vazio } from '@/componentes/basicos';
import { CampoQueCompleta } from '@/componentes/CampoQueCompleta';
import { BarrasEmpilhadas, Legenda } from '@/graficos/BarrasEmpilhadas';
import { Ranking } from '@/graficos/Ranking';
import { Rosca } from '@/graficos/Rosca';
import { dataCompleta, tituloDaAgenda } from '@/dominio/formato';
import {
  nomeDaInstituicao,
  nomeDaPessoa,
  nomesDosTemas,
  rotuloDeCodigo,
} from '@/dominio/derivacoes';
import type { Catalogo, ColunaMensal, ItemContado, Segmento } from '@/dominio/derivacoes';
import type { DocumentoDaReuniao, Interacao, Referencia } from '@/dominio/tipos';
import { usePainel } from '@/estado/painel';

const QUANTAS_AGENDAS = 8;
const QUANTAS_NO_RANKING = 5;

export function PrepararAgenda({ aoAbrirAgenda }: { aoAbrirAgenda: (id: string) => void }) {
  const { catalogo } = usePainel();
  const [temaId, definirTemaId] = useState('');
  //: O QUE FOI BUSCADO, E PARA QUAL TEMA. Guardar o tema ao lado do dado é o
  //: que diz se ele ainda vale: trocou o tema, o dado antigo passa a ser
  //: "carregando" sem precisar zerar estado dentro do efeito.
  const [dados, definirDados] = useState<{
    tema: number;
    agendas: Interacao[];
    documentos: DocumentoDaReuniao[];
  } | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  const tema = useMemo(
    () => catalogo?.dicionarios.temas.find((t) => String(t.id) === temaId) ?? null,
    [catalogo, temaId],
  );

  //: O TEMA MUDA: rebusca as agendas e os documentos, pelo NOME do tema —
  //: é assim que o filtro `tags` do servidor os identifica.
  useEffect(
    function buscarOTema() {
      if (!tema) return;
      let vivo = true;
      const recorte = { tags: [tema.nome] };
      Promise.all([listarRecorteCompleto(recorte), listarDocumentosDaReuniao(recorte)])
        .then(([resposta, docs]) => {
          if (vivo) definirDados({ tema: tema.id, agendas: resposta.itens, documentos: docs });
        })
        .catch((falha: Error) => {
          if (vivo) definirErro(falha.message);
        });
      return () => {
        vivo = false;
      };
    },
    [tema],
  );

  if (!catalogo) return <Carregando rotulo="Carregando o catálogo…" />;

  const carregado = tema && dados?.tema === tema.id ? dados : null;
  const referencias = tema
    ? catalogo.referencias.filter((r) => r.ativo && r.temas.includes(tema.id))
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Secao
        titulo="Preparar agenda"
        subtitulo="Escolha o tema: o que a companhia diz sobre ele, o que aconteceu nas últimas conversas e como elas terminam."
      >
        <Cartao>
          <div style={{ maxWidth: 520 }}>
            <CampoQueCompleta
              rotulo="Tema"
              valor={temaId}
              aoEscolher={(valor) => {
                definirErro(null);
                definirTemaId(valor);
              }}
              opcoes={catalogo.dicionarios.temas.map((t) => ({
                valor: String(t.id),
                rotulo: t.nome,
              }))}
            />
          </div>
        </Cartao>
      </Secao>

      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      {!tema ? (
        <Vazio mensagem="Nenhum tema escolhido" dica="Escolha um tema acima para montar a preparação." />
      ) : !carregado ? (
        erro ? null : <Carregando rotulo={`Reunindo o que há sobre ${tema.nome}…`} />
      ) : (
        <>
          <BlocoDeReferencias
            tema={tema.nome}
            referencias={referencias}
            documentos={carregado.documentos}
          />
          <BlocoDeAgendas
            agendas={carregado.agendas}
            catalogo={catalogo}
            aoAbrirAgenda={aoAbrirAgenda}
          />
          <BlocoDeGraficos agendas={carregado.agendas} catalogo={catalogo} />
        </>
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
}: {
  tema: string;
  referencias: Referencia[];
  documentos: DocumentoDaReuniao[];
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
              {documentos.slice(0, QUANTAS_AGENDAS).map((documento) => (
                <li
                  key={documento.id}
                  style={{ padding: '8px 0', borderTop: '1px solid var(--borda)' }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{documento.titulo}</span>
                    <span style={{ fontSize: 11, color: 'var(--cinza-2)', whiteSpace: 'nowrap' }}>
                      {dataCompleta(documento.data_interacao)}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--cinza-3)', margin: '2px 0 0' }}>
                    {documento.instituicao ?? '—'}
                    {' · '}
                    <a
                      href={urlDoArquivo(documento.interacao_id, documento.arquivo_id)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--azul-mar)' }}
                    >
                      {documento.arquivo_nome}
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
  //: `listarRecorteCompleto` já vem em `-data_interacao`; a ordenação aqui
  //: é só garantia, para a lista não depender do padrão do servidor.
  const ultimas = [...agendas]
    .sort((a, b) => b.data_interacao.localeCompare(a.data_interacao))
    .slice(0, QUANTAS_AGENDAS);

  return (
    <Secao
      titulo={`Últimas agendas (${agendas.length} no total)`}
      subtitulo="As mais recentes com este tema — clique para abrir a ficha."
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

//: Cada clima sempre aparece na rosca e na legenda, mesmo com zero — a
//: comparação "esperado × registrado" precisa das mesmas fatias dos dois
//: lados, e a rosca de desfecho segue a mesma regra para não mudar de forma
//: de um tema para outro.
function contarPorDicionario(
  agendas: Interacao[],
  itens: { codigo: string; nome: string; cor_hex: string }[],
  campo: (agenda: Interacao) => string | null,
): Segmento[] {
  const contagem = new Map<string, number>();
  for (const agenda of agendas) {
    const codigo = campo(agenda);
    if (codigo) contagem.set(codigo, (contagem.get(codigo) ?? 0) + 1);
  }
  return itens.map((item) => ({
    chave: item.codigo,
    rotulo: item.nome,
    total: contagem.get(item.codigo) ?? 0,
    cor: item.cor_hex,
  }));
}

function BlocoDeGraficos({ agendas, catalogo }: { agendas: Interacao[]; catalogo: Catalogo }) {
  const climas = catalogo.dicionarios.climas;
  const desfechos = contarPorDicionario(agendas, catalogo.dicionarios.resultados, (a) => a.resultado);
  const esperado = contarPorDicionario(agendas, climas, (a) => a.clima_esperado);
  const registrado = contarPorDicionario(agendas, climas, (a) => a.clima);

  //: DUAS COLUNAS, "Antes" e "Depois": o clima esperado ao marcar a reunião
  //: e o clima registrado depois dela. `BarrasEmpilhadas` lê `ColunaMensal`
  //: — a chave `mes` aqui é só o rótulo da coluna, e `formatarRotulo` a
  //: devolve como está.
  const antesEDepois: ColunaMensal[] = [
    { mes: 'Antes (esperado)', total: esperado.reduce((s, i) => s + i.total, 0), segmentos: esperado },
    { mes: 'Depois (registrado)', total: registrado.reduce((s, i) => s + i.total, 0), segmentos: registrado },
  ];

  const porInstituicao = ranking(
    agendas.map((a) => a.instituicao_id),
    (id) => nomeDaInstituicao(catalogo, id),
  );
  //: UMA CONTAGEM POR PARTICIPAÇÃO: a agenda com dois porta-vozes conta para
  //: os dois — a mesma regra do painel de exposição.
  const porPortaVoz = ranking(
    agendas.flatMap((a) =>
      a.participacoes.filter((p) => p.papel === 'porta_voz').map((p) => p.pessoa_aegea_id),
    ),
    (id) => nomeDaPessoa(catalogo, id),
  );

  return (
    <Secao
      titulo="Como as conversas sobre o tema terminam"
      subtitulo="Desfecho, clima esperado antes e registrado depois, e com quem se falou."
    >
      <div className="grade grade--2" style={{ gap: 16, alignItems: 'start' }}>
        <Cartao>
          <p className="kicker" style={{ marginBottom: 10 }}>
            Desfecho
          </p>
          <Rosca itens={desfechos} vazio="Nenhuma agenda com desfecho registrado." />
          <Legenda itens={desfechos} centralizada />
        </Cartao>

        <Cartao>
          <p className="kicker" style={{ marginBottom: 10 }}>
            Clima: antes e depois
          </p>
          <BarrasEmpilhadas colunas={antesEDepois} altura={150} formatarRotulo={(chave) => chave} />
          <Legenda itens={registrado} centralizada />
        </Cartao>

        <Cartao>
          <p className="kicker" style={{ marginBottom: 10 }}>
            Instituições mais frequentes
          </p>
          <Ranking itens={porInstituicao} vazio="Nenhuma agenda com este tema." />
        </Cartao>

        <Cartao>
          <p className="kicker" style={{ marginBottom: 10 }}>
            Porta-vozes que mais conduziram
          </p>
          <Ranking itens={porPortaVoz} cor="var(--turquesa-rio)" vazio="Nenhum porta-voz registrado." />
        </Cartao>
      </div>
    </Secao>
  );
}

function ranking(ids: (string | null)[], nome: (id: string) => string): ItemContado[] {
  const contagem = new Map<string, number>();
  for (const id of ids) {
    if (id) contagem.set(id, (contagem.get(id) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, QUANTAS_NO_RANKING)
    .map(([id, total]) => ({ chave: id, rotulo: nome(id), total }));
}
