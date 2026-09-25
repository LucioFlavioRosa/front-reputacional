/** Preparar agenda — duas sub-abas, duas perguntas diferentes.
 *
 *  "PREPARAÇÃO POR TEMA": o que alguém precisa saber sobre um TEMA antes de
 *  entrar numa reunião — escolhe o tema e vê, numa tela só, o que a
 *  companhia já diz sobre ele e o que aconteceu nas últimas conversas.
 *
 *  O TEMA É UM FILTRO DO RECORTE — o mesmo `tags` que a gaveta de filtros
 *  usa. Escolher aqui é o mesmo que marcar o tema lá, e vice-versa; e todo
 *  outro filtro do recorte (período, área, tipo de interação, instituição,
 *  clima…) vale sobre os blocos, como vale no Painel e na Base. Quem quer
 *  "só as reuniões com a ANA sobre tarifa nos últimos 90 dias" marca isso
 *  na gaveta e a tela responde.
 *
 *  OS BLOCOS REAPROVEITAM O QUE JÁ EXISTE: as agendas são as `interacoes` do
 *  contexto (o recorte já aplicado — inclusive os filtros que só existem no
 *  cliente, como tipo de interação e categoria de público), os documentos
 *  são os `materiais` DESSAS agendas (nenhuma chamada a mais, e nunca um
 *  documento de agenda fora do recorte), e as referências vêm do catálogo (a
 *  biblioteca da Administração, só as ativas, filtradas pelos temas do
 *  recorte).
 *
 *  "CONSULTA DINÂMICA": a mesma pergunta, mas por INSTITUIÇÃO em vez de
 *  tema — "o que preciso saber sobre o Itaú antes de entrar na sala",
 *  independente de qual tema esteja marcado (por isso é uma aba à parte, e
 *  não um bloco dentro da de tema). Ver `ConsultaDinamicaDeInstituicao`.
 *
 *  AS DUAS ABAS SÓ ESCONDEM COM `display: none`, nunca desmontam — mesmo
 *  padrão do cadastro de agenda (`Cadastro.tsx`, ver `Abas.tsx`): trocar de
 *  aba não pode apagar a instituição já escolhida na Consulta dinâmica.
 */

import { useMemo, useState } from 'react';
import { urlDaVersao, urlDoArquivo } from '@/api/cliente';
import {
  Botao,
  Cartao,
  Carregando,
  ComFaixaDoTopo,
  FaixaDeErro,
  Secao,
  Vazio,
} from '@/componentes/basicos';
import { Abas } from '@/componentes/Abas';
import type { Aba } from '@/componentes/Abas';
import { CampoQueCompleta } from '@/componentes/CampoQueCompleta';
import { CampoSuspenso } from '@/componentes/CampoSuspenso';
import { FaixaDeFiltros } from '@/componentes/FaixaDeFiltros';
import {
  campoDeAreaPorCategoria,
  campoDeCategoriaPublico,
  campoDeFormatoInteracao,
  campoDeTema,
} from '@/componentes/PainelDeFiltros';
import {
  Bloco,
  ESTILO_DO_PARAGRAFO,
  FeedbackDoInsight,
  Num,
} from '@/paginas/painel/SinteseExecutivaPelaIA';
import { dataCompleta, numero, tituloDaAgenda } from '@/dominio/formato';
import {
  limparAreas,
  limparCategoriaPublico,
  limparFormatoInteracao,
  limparTags,
} from '@/dominio/recorte';
import {
  nomeDaInstituicao,
  nomeDaPessoa,
  nomeDoInterlocutor,
  nomesDosTemas,
  porArea,
  rotuloDeCodigo,
  rotuloDeRelevancia,
} from '@/dominio/derivacoes';
import type { Catalogo } from '@/dominio/derivacoes';
import type { Alegacao, Interacao, Referencia } from '@/dominio/tipos';
import {
  INSTITUICOES_PARA_CONVERGIR,
  alegacoesEmCirculacao,
  consultasDe,
} from '@/dominio/sinais';
import {
  documentosDasAgendas,
  portaVozesDe,
  rankingPorId,
} from '@/dominio/preparacao';
import type { DocumentoDaAgenda } from '@/dominio/preparacao';
import { usePainel } from '@/estado/painel';

const QUANTAS_AGENDAS = 8;

/** Quantas consultas recebidas a preparação mostra. Menos que as agendas:
 *  aqui elas são contexto, e não o assunto da tela. */
const QUANTAS_CONSULTAS_NA_PREPARACAO = 5;

const ABAS_DA_PREPARACAO: readonly Aba<'tema' | 'instituicao'>[] = [
  { id: 'tema', rotulo: 'Preparação por tema' },
  { id: 'instituicao', rotulo: 'Consulta dinâmica' },
];

export function PrepararAgenda({ aoAbrirAgenda }: { aoAbrirAgenda: (id: string) => void }) {
  const { catalogo, recorte, definirRecorte, interacoes, carregando, atualizando, erro } =
    usePainel();
  const [aba, definirAba] = useState<'tema' | 'instituicao'>('tema');

  const temas = recorte.tags ?? [];
  const temTema = temas.length > 0;

  if (!catalogo) return <Carregando rotulo="Carregando o catálogo…" />;

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
        titulo="Briefing"
        subtitulo="Duas formas de chegar preparado: pelo tema da reunião ou pela instituição com quem ela é."
        nivelDoTitulo={1}
      >
        {/* A MESMA FAIXA DO PAINEL, com o Tema na frente: quem aprendeu a
            filtrar lá filtra igual aqui. Área(s), Tipo de Interação e Tipo de
            Público seguem ao lado porque valem sobre os blocos — ficar à
            vista é o que evita a pergunta "por que sumiu metade das
            agendas?". Vale para as duas abas — a Consulta dinâmica também
            lê `interacoes` já filtradas por eles, só some o Tema como
            filtro do recorte (ele não pinta a Consulta dinâmica, que
            escolhe a instituição por conta própria).

            O `marginTop: -28` de `FaixaDeFiltros` foi calibrado para colar
            direto no acordeão "Filtro avançado" do `Layout.tsx`, sem nada
            entre os dois (é assim no Painel). Aqui a faixa mora DENTRO de
            uma `Secao` com título e um traço embaixo dele — a mesma
            margem negativa colava a faixa perto demais desse traço. Este
            `paddingTop` (soma, não some com o negativo) é só para esta
            tela, por pedido. */}
        <div style={{ paddingTop: 18 }}>
          <FaixaDeFiltros>
          <CampoSuspenso
            campo={campoDeTema(recorte, definirRecorte, catalogo)}
            aoLimpar={() => definirRecorte(limparTags(recorte))}
          />
          <CampoSuspenso
            campo={campoDeAreaPorCategoria(recorte, definirRecorte, catalogo)}
            aoLimpar={() => definirRecorte(limparAreas(recorte))}
          />
          <CampoSuspenso
            campo={campoDeFormatoInteracao(recorte, definirRecorte, catalogo)}
            aoLimpar={() => definirRecorte(limparFormatoInteracao(recorte))}
          />
          <CampoSuspenso
            campo={campoDeCategoriaPublico(recorte, definirRecorte, catalogo)}
            aoLimpar={() => definirRecorte(limparCategoriaPublico(recorte))}
          />
          </FaixaDeFiltros>
        </div>
      </Secao>

      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      <Abas
        abas={ABAS_DA_PREPARACAO}
        ativa={aba}
        aoTrocar={definirAba}
        rotulo="Como preparar"
        prefixo="preparar-agenda"
      />

      {/* `display: none`, NUNCA DESMONTA — trocar de aba não pode apagar a
          instituição já escolhida na Consulta dinâmica (ver o comentário no
          topo do arquivo). */}
      <div style={{ display: aba === 'tema' ? 'contents' : 'none' }}>
        {!temTema ? (
          <Vazio mensagem="Nenhum tema escolhido" dica="Escolha um tema na faixa de filtros para montar a preparação." />
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
            <ComFaixaDoTopo>
              <BlocoDeReferencias
                tema={rotuloDosTemas}
                referencias={referencias}
                documentos={documentosDasAgendas(interacoes)}
                catalogo={catalogo}
              />
            </ComFaixaDoTopo>
            <ComFaixaDoTopo>
              <BlocoDeAgendas agendas={interacoes} catalogo={catalogo} aoAbrirAgenda={aoAbrirAgenda} />
            </ComFaixaDoTopo>
            <ComFaixaDoTopo>
              <BlocoDeConsultasDoTema
                consultas={consultasDe(interacoes)}
                alegacoes={catalogo.alegacoes}
                catalogo={catalogo}
                aoAbrirAgenda={aoAbrirAgenda}
              />
            </ComFaixaDoTopo>
          </div>
        )}
      </div>

      <div style={{ display: aba === 'instituicao' ? 'contents' : 'none' }}>
        <ConsultaDinamicaDeInstituicao
          interacoes={interacoes}
          catalogo={catalogo}
          aoAbrirAgenda={aoAbrirAgenda}
        />
      </div>
    </div>
  );
}

/* -- consulta dinâmica: visão executiva de uma instituição ------------------- */

interface ConsultaDaInstituicao {
  nome: string;
  tier: string | null;
  total: number;
  ultima: Interacao;
  ultimaPauta: string;
  comClima: number;
  positivas: number;
  neutras: number;
  negativas: number;
  nss: number | null;
  /** TODOS os temas discutidos com esta instituição, do mais ao menos
   *  frequente — "quais temas falamos", por pedido, não só os 3 primeiros. */
  temasDiscutidos: { nome: string; total: number }[];
  portaVozMaisFrequente: string | null;
  /** QUEM, do lado deles, participou de alguma agenda — `outra_parte` de
   *  cada interação, contado por interlocutor. */
  pessoasDoLadoDeles: { nome: string; total: number }[];
  /** QUAIS ÁREAS da Aegea falaram com eles — mesma categoria de área do
   *  resto do produto (`porArea`/`CATEGORIAS_DE_AREA`), só filtrando por
   *  esta instituição em vez do recorte inteiro. */
  areasEnvolvidas: { rotulo: string; total: number }[];
  ultimasAgendas: Interacao[];
}

/** Tudo que o texto da consulta precisa, derivado uma vez só — as mesmas
 *  interações que o resto da tela já usa (`interacoes`, o recorte
 *  aplicado), só filtradas por instituição em vez de por tema. */
function montarConsultaDaInstituicao(
  interacoes: Interacao[],
  catalogo: Catalogo,
  instituicaoId: string,
): ConsultaDaInstituicao | null {
  const daInstituicao = interacoes.filter((i) => i.instituicao_id === instituicaoId);
  if (!daInstituicao.length) return null;

  const ordenadas = [...daInstituicao].sort((a, b) => b.data_interacao.localeCompare(a.data_interacao));
  const ultima = ordenadas[0];

  const comClimaLista = daInstituicao.filter((i) => i.clima);
  const positivas = comClimaLista.filter((i) => i.clima === 'propositivo').length;
  const negativas = comClimaLista.filter((i) => i.clima === 'tenso').length;
  const neutras = comClimaLista.length - positivas - negativas;
  const nss =
    comClimaLista.length > 0
      ? Math.round(((positivas - negativas) / comClimaLista.length) * 100)
      : null;

  const contagemDeTemas = new Map<string, number>();
  for (const interacao of daInstituicao) {
    for (const nome of nomesDosTemas(catalogo, interacao.temas)) {
      contagemDeTemas.set(nome, (contagemDeTemas.get(nome) ?? 0) + 1);
    }
  }
  const temasDiscutidos = [...contagemDeTemas.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([nome, total]) => ({ nome, total }));

  const portaVozes = rankingPorId(portaVozesDe(daInstituicao), (id) => nomeDaPessoa(catalogo, id), 1);

  //: QUEM DO LADO DELES — `outra_parte` é uma lista por agenda (o principal
  //: incluído, ver `ParticipanteDaOutraParte`); achata e conta por
  //: interlocutor, do mais presente ao menos.
  const contagemDeInterlocutores = new Map<string, number>();
  for (const interacao of daInstituicao) {
    for (const participante of interacao.outra_parte) {
      const nome = nomeDoInterlocutor(catalogo, participante.interlocutor_id);
      contagemDeInterlocutores.set(nome, (contagemDeInterlocutores.get(nome) ?? 0) + 1);
    }
  }
  const pessoasDoLadoDeles = [...contagemDeInterlocutores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([nome, total]) => ({ nome, total }));

  const areasEnvolvidas = porArea(daInstituicao, catalogo).filter((a) => a.total > 0);

  const instituicao = catalogo.instituicoes.get(instituicaoId);

  return {
    nome: nomeDaInstituicao(catalogo, instituicaoId),
    tier: instituicao?.tier ? rotuloDeRelevancia(catalogo, instituicao.tier) : null,
    total: daInstituicao.length,
    ultima,
    ultimaPauta: tituloDaAgenda(ultima, (ids) => nomesDosTemas(catalogo, ids)),
    comClima: comClimaLista.length,
    positivas,
    neutras,
    negativas,
    nss,
    temasDiscutidos,
    portaVozMaisFrequente: portaVozes[0]?.rotulo ?? null,
    pessoasDoLadoDeles,
    areasEnvolvidas,
    ultimasAgendas: ordenadas,
  };
}

/** Uma consulta dinâmica sobre QUALQUER instituição, para responder "o que
 *  preciso saber antes de entrar na sala com o Itaú" sem precisar que um
 *  tema esteja marcado — por isso vive fora do bloco condicional a
 *  `temTema`. Mesma caixa turquesa da Síntese Executiva pela IA
 *  (`SinteseExecutivaPelaIA.tsx`, ver o comentário lá): o texto é montado no
 *  front com os dados que o recorte já carrega, sem chamada a modelo
 *  nenhum — o "agente de mentirinha" de novo, agora sobre uma instituição em
 *  vez de um mês.
 *
 *  A INSTITUIÇÃO É UM CAMPO PRÓPRIO desta caixa, e não um filtro do
 *  recorte — escolher aqui NÃO filtra a página inteira (diferente do tema,
 *  da área…): é só o assunto do texto que se lê dentro da caixa. */

//: FONTE MAIOR que `ESTILO_DO_PARAGRAFO` padrão — por pedido, só aqui: esta
//: caixa é a aba inteira (não divide espaço com mais nada, diferente da
//: Síntese Executiva no Painel), então sobra folga para um texto mais fácil
//: de ler à distância.
const ESTILO_DO_PARAGRAFO_DA_CONSULTA = { ...ESTILO_DO_PARAGRAFO, fontSize: 15 };

function ConsultaDinamicaDeInstituicao({
  interacoes,
  catalogo,
  aoAbrirAgenda,
}: {
  interacoes: Interacao[];
  catalogo: Catalogo;
  aoAbrirAgenda: (id: string) => void;
}) {
  const [instituicaoId, definirInstituicaoId] = useState('');

  const consulta = useMemo(
    () => (instituicaoId ? montarConsultaDaInstituicao(interacoes, catalogo, instituicaoId) : null),
    [interacoes, catalogo, instituicaoId],
  );

  return (
    <div
      className="sem-impressao"
      style={{
        border: '1px solid var(--turquesa-rio)',
        borderRadius: 'var(--r-card-int)',
        background: 'color-mix(in srgb, var(--turquesa-rio) 4%, var(--branco))',
      }}
    >
      {/* SEM BOTÃO DE EXPANSÃO — por pedido: esta caixa é a própria aba
          "Consulta dinâmica" (ver `ABAS_DA_PREPARACAO`), diferente da
          Síntese Executiva pela IA (que divide espaço com outros blocos no
          Painel e por isso começa fechada). Aqui não há nada para esconder
          embaixo dela: o card já entra aberto. */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '13px 16px',
        }}
      >
        <span
          style={{
            fontSize: 18,
            fontWeight: 800,
            backgroundImage: 'linear-gradient(120deg, var(--azul-mar) 0%, var(--turquesa-rio) 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Consulta dinâmica por instituição
        </span>

        <span style={{ minWidth: 240 }}>
          <CampoQueCompleta
            ariaLabel="Instituição da consulta"
            placeholder="Buscar instituição — ex.: Itaú"
            valor={instituicaoId}
            aoEscolher={definirInstituicaoId}
            opcoes={[...catalogo.instituicoes.values()]
              .filter((i) => i.ativo)
              .map((i) => ({
                valor: i.id,
                rotulo: i.nome,
                detalhe: i.nome_completo ?? undefined,
              }))}
          />
        </span>
      </div>

      <div
        style={{
          padding: '4px 18px 20px',
          borderTop: '1px solid color-mix(in srgb, var(--turquesa-rio) 25%, var(--branco))',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {!instituicaoId ? (
            <p style={{ ...ESTILO_DO_PARAGRAFO_DA_CONSULTA, color: 'var(--cinza-2)' }}>
              Escolha uma instituição acima para montar o resumo.
            </p>
          ) : !consulta ? (
            <p style={{ ...ESTILO_DO_PARAGRAFO_DA_CONSULTA, color: 'var(--cinza-2)' }}>
              Nenhuma interação registrada com esta instituição no recorte atual — ajuste os filtros
              (período, área…) ou confirme se ela já teve alguma agenda.
            </p>
          ) : (
            <>
              <Bloco titulo="Visão geral">
                <p style={ESTILO_DO_PARAGRAFO_DA_CONSULTA}>
                  <strong>{consulta.nome}</strong>
                  {consulta.tier ? <> é <Num>{consulta.tier}</Num></> : null} e soma{' '}
                  <Num>{numero(consulta.total)}</Num>{' '}
                  {consulta.total === 1 ? 'interação registrada' : 'interações registradas'} no recorte
                  atual. A mais recente foi em <Num>{dataCompleta(consulta.ultima.data_interacao)}</Num>,
                  sobre {consulta.ultimaPauta}.
                  {consulta.temasDiscutidos.length ? (
                    <>
                      {' '}
                      Os temas mais discutidos foram{' '}
                      {consulta.temasDiscutidos
                        .slice(0, 3)
                        .map((t) => t.nome)
                        .join(', ')}
                      .
                    </>
                  ) : null}
                  {consulta.portaVozMaisFrequente ? (
                    <>
                      {' '}
                      Quem mais conduziu foi <strong>{consulta.portaVozMaisFrequente}</strong>.
                    </>
                  ) : null}
                </p>
              </Bloco>

              <Bloco titulo="Temas discutidos">
                {consulta.temasDiscutidos.length ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {consulta.temasDiscutidos.map((tema) => (
                      <span
                        key={tema.nome}
                        className="tabular"
                        style={{
                          fontSize: 13.5,
                          padding: '4px 11px',
                          borderRadius: 'var(--r-chip)',
                          background: 'color-mix(in srgb, var(--turquesa-rio) 12%, var(--branco))',
                          color: 'var(--sobre-turquesa)',
                        }}
                      >
                        {tema.nome} · {tema.total}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p style={ESTILO_DO_PARAGRAFO_DA_CONSULTA}>
                    Nenhuma interação com tema classificado ainda.
                  </p>
                )}
              </Bloco>

              {/* QUEM PARTICIPOU, DOS DOIS LADOS — por pedido: quem, do lado
                  deles, esteve nas agendas (`outra_parte`), e quais áreas da
                  Aegea falaram com eles (`porArea`, a mesma categoria de área
                  do resto do produto). Duas colunas, uma pergunta cada. */}
              <Bloco titulo="Quem participou">
                <div className="grade grade--2" style={{ gap: 16 }}>
                  <div>
                    <p className="kicker" style={{ marginBottom: 6, color: 'var(--turquesa-rio)' }}>
                      Do lado deles
                    </p>
                    {consulta.pessoasDoLadoDeles.length ? (
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {consulta.pessoasDoLadoDeles.map((pessoa) => (
                          <li
                            key={pessoa.nome}
                            style={{ ...ESTILO_DO_PARAGRAFO_DA_CONSULTA, padding: '2px 0' }}
                          >
                            {pessoa.nome}{' '}
                            <span className="tabular" style={{ color: 'var(--cinza-2)' }}>
                              · {pessoa.total}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={ESTILO_DO_PARAGRAFO_DA_CONSULTA}>
                        Nenhum interlocutor registrado ainda.
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="kicker" style={{ marginBottom: 6, color: 'var(--turquesa-rio)' }}>
                      Nossas áreas
                    </p>
                    {consulta.areasEnvolvidas.length ? (
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {consulta.areasEnvolvidas.map((area) => (
                          <li
                            key={area.rotulo}
                            style={{ ...ESTILO_DO_PARAGRAFO_DA_CONSULTA, padding: '2px 0' }}
                          >
                            {area.rotulo}{' '}
                            <span className="tabular" style={{ color: 'var(--cinza-2)' }}>
                              · {area.total}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={ESTILO_DO_PARAGRAFO_DA_CONSULTA}>
                        Nenhuma área classificada ainda.
                      </p>
                    )}
                  </div>
                </div>
              </Bloco>

              <Bloco titulo="Temperatura da relação">
                <p style={ESTILO_DO_PARAGRAFO_DA_CONSULTA}>
                  {consulta.comClima > 0 ? (
                    <>
                      Das <Num>{numero(consulta.comClima)}</Num> interações com clima registrado,{' '}
                      <Num>{consulta.positivas}</Num> foram propositivas, <Num>{consulta.neutras}</Num>{' '}
                      neutras e <Num>{consulta.negativas}</Num> tensas — placar de{' '}
                      <Num>
                        {(consulta.nss ?? 0) > 0 ? '+' : ''}
                        {consulta.nss}
                      </Num>{' '}
                      pontos (de −100 a +100).
                    </>
                  ) : (
                    'Nenhuma interação com esta instituição tem clima registrado ainda.'
                  )}
                </p>
              </Bloco>

              <Bloco titulo={`Últimas agendas (${consulta.total} no total)`}>
                <div className="rolagem-interna" style={{ maxHeight: 260 }}>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {consulta.ultimasAgendas.map((agenda) => (
                      <li
                        key={agenda.id}
                        style={{ padding: '6px 0', borderTop: '1px solid var(--borda)' }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            gap: 10,
                            alignItems: 'baseline',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span className="tabular" style={{ fontSize: 13, color: 'var(--cinza-2)' }}>
                            {dataCompleta(agenda.data_interacao)}
                          </span>
                          <span style={{ fontSize: 14, flex: 1, minWidth: 160 }}>
                            {tituloDaAgenda(agenda, (ids) => nomesDosTemas(catalogo, ids))}
                          </span>
                          <span style={{ fontSize: 13, color: 'var(--cinza-2)' }}>
                            {rotuloDeCodigo(catalogo, 'climas', agenda.clima)}
                          </span>
                          <Botao
                            variante="fantasma"
                            estilo={{ height: 28, fontSize: 13 }}
                            aoClicar={() => aoAbrirAgenda(agenda.id)}
                          >
                            Ficha
                          </Botao>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </Bloco>

              <FeedbackDoInsight />
            </>
          )}
      </div>
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

//: ALTURA DO SCROLL DAS AGENDAS — por pedido, para dar pra ver TODAS as
//: agendas do recorte (a lista não é mais cortada em `QUANTAS_AGENDAS`,
//: como era antes: `.rolagem-interna` deixa o cartão rolar por dentro em vez
//: de esconder o resto atrás de um corte silencioso).
const ALTURA_DAS_AGENDAS = 420;

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
  const ordenadas = [...agendas].sort((a, b) => b.data_interacao.localeCompare(a.data_interacao));

  return (
    <Secao
      titulo={`Últimas agendas (${agendas.length} no total)`}
      subtitulo="Todas as agendas do recorte, da mais recente para a mais antiga — role para ver as demais. Clique para abrir a ficha."
    >
      <Cartao>
        {ordenadas.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>
            Nenhuma agenda registrada com este tema.
          </p>
        ) : (
          <div className="rolagem-interna" style={{ maxHeight: ALTURA_DAS_AGENDAS }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {ordenadas.map((agenda) => (
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
          </div>
        )}
      </Cartao>
    </Secao>
  );
}

/* -- bloco 2b: o que o mercado andou perguntando sobre o tema ---------------- */

//: ANTES DE ENTRAR NA REUNIÃO, saber o que o mercado perguntou sobre este
//: tema muda o que se leva: se três bancos sondaram a mesma premissa nas
//: últimas semanas, ela vai aparecer na sala. O bloco some quando não há
//: consulta no recorte — a maioria dos temas não tem, e um cartão vazio em
//: toda preparação treina a pessoa a ignorar a tela.
function BlocoDeConsultasDoTema({
  consultas,
  alegacoes,
  catalogo,
  aoAbrirAgenda,
}: {
  consultas: Interacao[];
  alegacoes: Alegacao[];
  catalogo: Catalogo;
  aoAbrirAgenda: (id: string) => void;
}) {
  if (!consultas.length) return null;

  const emCirculacao = alegacoesEmCirculacao(consultas, alegacoes);

  return (
    <Secao
      titulo="O que andaram perguntando sobre o tema"
      subtitulo="Consultas recebidas de investidores, bancos e plataformas de rating no recorte — e o que as perguntas deram como fato."
    >
      <Cartao>
        {emCirculacao.length ? (
          <ul style={{ listStyle: 'none', margin: '0 0 12px', padding: 0 }}>
            {emCirculacao.map((item) => (
              <li
                key={item.alegacao.id}
                style={{ padding: '8px 0', borderTop: '1px solid var(--borda)' }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{item.alegacao.texto}</div>
                <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '2px 0 0' }}>
                  {item.instituicoes} {item.instituicoes === 1 ? 'instituição' : 'instituições'}
                  {' · '}
                  {item.consultas.length}{' '}
                  {item.consultas.length === 1 ? 'consulta' : 'consultas'}
                  {item.janela ? (
                    <strong style={{ color: 'var(--atencao-fg)' }}>
                      {` · ${INSTITUICOES_PARA_CONVERGIR}+ em ${dataCompleta(item.janela.de)}–${dataCompleta(item.janela.ate)}`}
                    </strong>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        ) : null}

        {/* OS ÚLTIMOS REGISTROS, e não só a contagem: antes de entrar na
            reunião interessa ler o que de fato perguntaram, com as palavras
            de quem perguntou. A lista agregada acima responde "o que está
            circulando"; esta responde "o que chegou". */}
        <p className="kicker" style={{ margin: '0 0 8px' }}>
          Últimas consultas recebidas ({consultas.length} no recorte)
        </p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {[...consultas]
            .sort((a, b) => b.data_interacao.localeCompare(a.data_interacao))
            .slice(0, QUANTAS_CONSULTAS_NA_PREPARACAO)
            .map((consulta) => (
              <li
                key={consulta.id}
                style={{ padding: '8px 0', borderTop: '1px solid var(--borda)' }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
                    {nomeDaInstituicao(catalogo, consulta.instituicao_id)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--cinza-2)', whiteSpace: 'nowrap' }}>
                    {dataCompleta(consulta.data_interacao)}
                  </span>
                  <Botao variante="fantasma" aoClicar={() => aoAbrirAgenda(consulta.id)}>
                    Abrir
                  </Botao>
                </div>
                {consulta.consulta?.teor ? (
                  <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '2px 0 0' }}>
                    {consulta.consulta.teor}
                  </p>
                ) : null}
              </li>
            ))}
        </ul>
      </Cartao>
    </Secao>
  );
}
