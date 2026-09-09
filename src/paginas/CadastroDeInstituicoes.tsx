/** Cadastro de instituições e de quem fala por elas.
 *
 *  POR QUE ESTA TELA EXISTE
 *  ------------------------
 *  Duas decisões do formulário de agenda dependem destes cadastros: a frente
 *  escolhida filtra as instituições pelo TIPO, e a instituição escolhida filtra
 *  quem pode representar a outra parte. Sem um lugar para cadastrar, as duas
 *  listas teriam só o que a planilha trouxe — e uma agenda com um órgão novo
 *  não teria como ser registrada.
 *
 *  O TIPO NÃO É DETALHE. É ele que decide em qual frente a instituição aparece:
 *  `veiculo` só em Imprensa, `proposicao` só em Legislativo. Cadastrar com o
 *  tipo errado cria uma instituição que existe e nunca aparece — por isso o
 *  campo diz, ao lado de cada opção, em que frente ela vai surgir.
 *
 *  A tela NÃO é a barreira: quem decide é o backend, que responde 403 a quem
 *  não administra os cadastros. Esconder o que não se pode usar é conveniência.
 */

import { useMemo, useState } from 'react';
import {
  criarInstituicao,
  criarInterlocutor,
  editarInstituicao,
  editarInterlocutor,
  removerInterlocutor,
} from '@/api/cliente';
import {
  Botao,
  Campo,
  Cartao,
  FaixaDeErro,
  Secao,
  Vazio,
  estiloDeEntrada,
} from '@/componentes/basicos';
import { usePainel } from '@/estado/painel';
import { ROTULOS_DE_FRENTE, TIPO_DE_INSTITUICAO } from '@/dominio/frentes';
import type { Frente, Instituicao, Interlocutor } from '@/dominio/tipos';

/** Cada tipo, e em que frentes ele aparece.
 *
 *  Derivado de `TIPO_DE_INSTITUICAO`, e não escrito à mão: uma lista própria
 *  divergiria do mapa, e a tela passaria a prometer uma frente que o filtro do
 *  formulário não cumpre.
 *
 *  `entidade` sai com duas frentes — Parceiros e Eventos dividem o tipo —, e é
 *  exatamente o que a pessoa precisa saber antes de escolher.
 */
function tiposComSuasFrentes(): { tipo: string; onde: string }[] {
  const porTipo = new Map<string, Frente[]>();
  for (const [frente, tipo] of Object.entries(TIPO_DE_INSTITUICAO)) {
    porTipo.set(tipo, [...(porTipo.get(tipo) ?? []), frente as Frente]);
  }
  return [...porTipo.entries()].map(([tipo, frentes]) => ({
    tipo,
    onde: frentes.map((f) => ROTULOS_DE_FRENTE[f]).join(' e '),
  }));
}

const TIPOS = tiposComSuasFrentes();

const VAZIA = {
  nome: '',
  nome_completo: '',
  tipo: 'orgao',
  uf: '',
  //: SEM PADRAO, e e por isso que e string vazia e nao 3.
  //:
  //: Um padrao aqui viraria o valor da maioria: quem cadastra com pressa
  //: aceita o que ja esta na tela, e a base inteira acaba num tier so — o
  //: campo passa a existir sem significar nada. Vazio obriga a escolher,
  //: enquanto quem cadastra ainda sabe por que aquela instituicao importa.
  tier: '',
  //: O primeiro representante, cadastrado JUNTO. Uma instituicao sem ninguem
  //: nao serve para nada: o formulario de agenda so oferece pessoas depois de
  //: escolhe-la, e a lista sairia vazia.
  rep_nome: '',
  rep_email: '',
  rep_cargo: '',
};
const SEM_PESSOA = { nome: '', email: '', cargo: '' };

/** O que a edição de uma instituição mexe.
 *
 *  ESCRITO UMA VEZ. A forma estava em três lugares — o estado, a prop da linha
 *  e a assinatura do callback — e ao acrescentar `tier` os três divergiram na
 *  mesma hora, com o compilador apontando dois deles.
 *
 *  `tier` é string porque vem de um `<select>`, e vira número só na hora de
 *  enviar: guardar número aqui obrigaria a representar "nada escolhido" como
 *  0 ou NaN, que são valores e não ausências.
 */
interface RascunhoDaInstituicao {
  nome: string;
  nome_completo: string;
  tipo: string;
  uf: string;
  tier: string;
}

export function CadastroDeInstituicoes() {
  const { catalogo, recarregar } = usePainel();
  const [erro, definirErro] = useState<string | null>(null);
  //: O que acabou de dar certo. Sem isto, salvar era SILENCIOSO: o formulário
  //: limpava e nada dizia que a gravação aconteceu — e quem não confia fica
  //: cadastrando duas vezes.
  const [feito, definirFeito] = useState<string | null>(null);
  //: Qual pessoa está com a remoção pendente de confirmação. Duas etapas na
  //: própria linha, e não um modal: o modal tira o contexto de QUAL linha, que
  //: é a informação que importa quando há dez pessoas na lista.
  const [aRemover, definirARemover] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);
  const [busca, definirBusca] = useState('');

  //: Qual instituição está aberta para edição, e qual está com a lista de
  //: pessoas expandida. Duas coisas diferentes: dá para ver quem representa uma
  //: instituição sem entrar no modo de edição dela.
  const [emEdicao, definirEmEdicao] = useState<string | null>(null);
  const [aberta, definirAberta] = useState<string | null>(null);
  const [nova, definirNova] = useState(VAZIA);
  //: O rascunho da EDICAO nao carrega representante: editar a instituicao nao
  //: e o lugar de acrescentar gente — para isso existe "Quem representa". O
  //: backend ignora `representante` no PUT pelo mesmo motivo.
  const [rascunho, definirRascunho] = useState<RascunhoDaInstituicao>({
    nome: '',
    nome_completo: '',
    tipo: 'orgao',
    uf: '',
    tier: '',
  });
  const [pessoaNova, definirPessoaNova] = useState(SEM_PESSOA);
  //: Qual PESSOA esta aberta para edicao, e o rascunho dela. Separado do
  //: rascunho da instituicao: dá para editar uma pessoa sem entrar no modo de
  //: edicao da instituicao que a abriga.
  const [pessoaEmEdicao, definirPessoaEmEdicao] = useState<string | null>(null);
  const [rascunhoDaPessoa, definirRascunhoDaPessoa] = useState(SEM_PESSOA);

  const instituicoes = useMemo(() => {
    const todas = [...(catalogo?.instituicoes.values() ?? [])];
    const termo = busca.trim().toLowerCase();
    return todas
      .filter((i) => !termo || i.nome.toLowerCase().includes(termo))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [catalogo, busca]);

  const pessoasDe = (instituicaoId: string): Interlocutor[] =>
    [...(catalogo?.interlocutores.values() ?? [])]
      .filter((p) => p.instituicao_id === instituicaoId)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  /** Toda escrita passa por aqui, e recarrega o catálogo.
   *
   *  O catálogo é o que alimenta o formulário de agenda. Sem recarregar, a
   *  instituição recém-cadastrada só apareceria lá depois de um F5 — e quem
   *  acabou de cadastrar concluiria que não funcionou.
   */
  const executar = async (
    acao: () => Promise<unknown>,
    aoTerminar: () => void,
    aviso = 'Salvo.',
  ) => {
    definirSalvando(true);
    definirErro(null);
    definirFeito(null);
    try {
      await acao();
      await recarregar();
      aoTerminar();
      definirFeito(aviso);
    } catch (falha) {
      definirErro((falha as Error).message);
    } finally {
      definirSalvando(false);
    }
  };

  if (!catalogo) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {erro ? <FaixaDeErro mensagem={erro} /> : null}
      {feito ? (
        <div
          style={{
            background: 'var(--ok-bg)',
            color: 'var(--ok-fg)',
            padding: '11px 14px',
            borderRadius: 'var(--r-card-int)',
            fontSize: 13,
          }}
        >
          {feito}
        </div>
      ) : null}

      <Secao titulo="Cadastrar instituição">
        <Cartao>
          <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: '0 0 16px' }}>
            O tipo decide em qual frente ela aparece no cadastro de agenda.
          </p>
          <div className="grade grade--3" style={{ gap: 16 }}>
            <Campo
              rotulo="Nome curto"
              obrigatorio
              dica="Como se fala: ANA, ABCON, CNI."
            >
              <input
                style={estiloDeEntrada}
                value={nova.nome}
                onChange={(e) => definirNova({ ...nova, nome: e.target.value })}
                placeholder="ANA"
              />
            </Campo>

            <Campo rotulo="Nome completo">
              <input
                style={estiloDeEntrada}
                value={nova.nome_completo}
                onChange={(e) =>
                  definirNova({ ...nova, nome_completo: e.target.value })
                }
                placeholder="Agência Nacional de Águas e Saneamento Básico"
              />
            </Campo>

            <Campo rotulo="Tipo" obrigatorio>
              <select
                style={estiloDeEntrada}
                value={nova.tipo}
                onChange={(e) => definirNova({ ...nova, tipo: e.target.value })}
              >
                {TIPOS.map(({ tipo, onde }) => (
                  <option key={tipo} value={tipo}>
                    {tipo} — aparece em {onde}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo rotulo="Abrangência" dica="UF, NA (nacional) ou IN (internacional).">
              <select
                style={estiloDeEntrada}
                value={nova.uf}
                onChange={(e) => definirNova({ ...nova, uf: e.target.value })}
              >
                <option value="">Não informada</option>
                {catalogo.dicionarios.ufs.map((uf) => (
                  <option key={uf.codigo} value={uf.codigo}>
                    {uf.nome}
                  </option>
                ))}
              </select>
            </Campo>

            {/* A RELEVÂNCIA É DA INSTITUIÇÃO, e não do encontro.
                A agenda tem o seu próprio tier, e são coisas diferentes: a
                Folha é Tier 1 sempre, e uma nota de rodapé com a Folha pode
                ser Tier 3. Sem este campo, a pergunta era refeita a cada
                reunião — e respondida diferente. */}
            <Campo
              rotulo="Relevância"
              obrigatorio
              dica="A da instituição. Cada agenda tem a sua."
            >
              <select
                style={estiloDeEntrada}
                value={nova.tier}
                onChange={(e) => definirNova({ ...nova, tier: e.target.value })}
              >
                <option value="">Selecione…</option>
                {catalogo.dicionarios.relevancias.map((nivel) => (
                  <option key={nivel.id} value={nivel.id}>
                    {nivel.nome}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          {/* O REPRESENTANTE ENTRA NO MESMO GESTO. Cadastrar a instituicao e
              depois abrir a edicao para dizer quem fala por ela sao dois passos
              para uma decisao so — e o segundo e o que costuma nao acontecer.

              Opcional: nem toda instituicao tem contato conhecido no dia em que
              entra na base. Preenchido, vai na MESMA requisicao, e as duas
              escritas caem ou passam juntas. */}
          <p
            style={{
              fontSize: 13,
              fontWeight: 700,
              margin: '18px 0 4px',
            }}
          >
            Quem representa
          </p>
          <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '0 0 12px' }}>
            É esta pessoa que o formulário de agenda vai oferecer em "Pela outra
            parte". Dá para deixar em branco e cadastrar depois.
          </p>
          <div className="grade grade--3" style={{ gap: 16 }}>
            <Campo rotulo="Nome">
              <input
                style={estiloDeEntrada}
                value={nova.rep_nome}
                onChange={(e) => definirNova({ ...nova, rep_nome: e.target.value })}
                placeholder="Maria Souza"
              />
            </Campo>
            <Campo rotulo="E-mail">
              <input
                type="email"
                style={estiloDeEntrada}
                value={nova.rep_email}
                onChange={(e) => definirNova({ ...nova, rep_email: e.target.value })}
                placeholder="maria.souza@ana.gov.br"
              />
            </Campo>
            <Campo rotulo="Cargo">
              <input
                style={estiloDeEntrada}
                value={nova.rep_cargo}
                onChange={(e) => definirNova({ ...nova, rep_cargo: e.target.value })}
                placeholder="Diretora de Regulação"
              />
            </Campo>
          </div>

          <div style={{ marginTop: 14 }}>
            <Botao
              variante="primario"
              desabilitado={salvando || !nova.nome.trim() || !nova.tier}
              aoClicar={() =>
                void executar(
                  () =>
                    criarInstituicao({
                      nome: nova.nome,
                      nome_completo: nova.nome_completo || null,
                      tipo: nova.tipo,
                      uf: nova.uf || null,
                      tier: Number(nova.tier),
                      // SO QUANDO HA NOME. Mandar `{nome: ''}` seria recusado
                      // pelo `min_length`, e a instituicao nao entraria por
                      // causa de um campo que a pessoa deixou em branco de
                      // proposito.
                      representante: nova.rep_nome.trim()
                        ? {
                            nome: nova.rep_nome,
                            email: nova.rep_email || null,
                            cargo: nova.rep_cargo || null,
                          }
                        : null,
                    }),
                  () => definirNova(VAZIA),
                )
              }
            >
              {salvando ? 'Salvando…' : 'Cadastrar'}
            </Botao>
          </div>
        </Cartao>
      </Secao>

      <Secao titulo="Cadastrados">
        <Cartao>
          <Campo rotulo="Buscar">
            <input
              style={estiloDeEntrada}
              value={busca}
              onChange={(e) => definirBusca(e.target.value)}
              placeholder="Parte do nome"
            />
          </Campo>

          {instituicoes.length === 0 ? (
            <div style={{ marginTop: 14 }}>
              <Vazio mensagem="Nenhuma instituição com esse nome." />
            </div>
          ) : null}

          {instituicoes.map((instituicao) => (
            <LinhaDeInstituicao
              key={instituicao.id}
              instituicao={instituicao}
              pessoas={pessoasDe(instituicao.id)}
              ufs={catalogo.dicionarios.ufs}
              relevancias={catalogo.dicionarios.relevancias}
              emEdicao={emEdicao === instituicao.id}
              aberta={aberta === instituicao.id}
              salvando={salvando}
              rascunho={rascunho}
              pessoaNova={pessoaNova}
              aoRascunhar={definirRascunho}
              aoRascunharPessoa={definirPessoaNova}
              aoAbrir={() =>
                definirAberta(aberta === instituicao.id ? null : instituicao.id)
              }
              aoEditar={() => {
                definirEmEdicao(instituicao.id);
                definirRascunho({
                  nome: instituicao.nome,
                  nome_completo: instituicao.nome_completo ?? '',
                  tipo: instituicao.tipo,
                  uf: instituicao.uf ?? '',
                  tier: instituicao.tier ? String(instituicao.tier) : '',
                });
              }}
              aoCancelar={() => definirEmEdicao(null)}
              aoSalvar={() =>
                void executar(
                  () =>
                    editarInstituicao(instituicao.id, {
                      nome: rascunho.nome,
                      nome_completo: rascunho.nome_completo || null,
                      tipo: rascunho.tipo,
                      uf: rascunho.uf || null,
                      // VAZIO VIRA `null`, e nao 0: as 98 instituicoes
                      // anteriores a coluna nao tem tier, e corrigir o nome de
                      // uma delas nao pode obrigar a classifica-la primeiro.
                      tier: rascunho.tier ? Number(rascunho.tier) : null,
                    }),
                  () => definirEmEdicao(null),
                )
              }
              aoAcrescentarPessoa={() =>
                void executar(
                  () =>
                    criarInterlocutor({
                      nome: pessoaNova.nome,
                      instituicao_id: instituicao.id,
                      email: pessoaNova.email || null,
                      cargo: pessoaNova.cargo || null,
                    }),
                  () => definirPessoaNova(SEM_PESSOA),
                )
              }
              pessoaEmEdicao={pessoaEmEdicao}
              rascunhoDaPessoa={rascunhoDaPessoa}
              aoRascunharEdicaoDaPessoa={definirRascunhoDaPessoa}
              aoEditarPessoa={(pessoa) => {
                definirPessoaEmEdicao(pessoa.id);
                definirRascunhoDaPessoa({
                  nome: pessoa.nome,
                  email: pessoa.email ?? '',
                  cargo: pessoa.cargo ?? '',
                });
              }}
              aoCancelarPessoa={() => definirPessoaEmEdicao(null)}
              aoSalvarPessoa={(pessoa) =>
                void executar(
                  () =>
                    editarInterlocutor(pessoa.id, {
                      nome: rascunhoDaPessoa.nome,
                      instituicao_id: pessoa.instituicao_id,
                      email: rascunhoDaPessoa.email || null,
                      cargo: rascunhoDaPessoa.cargo || null,
                      tipo: pessoa.tipo,
                      ativo: pessoa.ativo,
                    }),
                  () => definirPessoaEmEdicao(null),
                )
              }
              aRemover={aRemover}
              aoPedirRemocao={(pessoa) => definirARemover(pessoa.id)}
              aoDesistirDaRemocao={() => definirARemover(null)}
              aoRemoverPessoa={(pessoa) =>
                void executar(
                  // A CONFIRMACAO E DA TELA, e nao do servidor.
                  //
                  // O servidor recusa apagar quem ja esteve numa agenda — mas
                  // quem NAO esteve some para sempre, na hora, sem desfazer. Eu
                  // tinha dispensado a confirmacao com o argumento que vale
                  // para os materiais, onde nada vai ao banco antes de salvar;
                  // aqui a remocao e imediata e definitiva, e o argumento nao
                  // se aplica.
                  () => removerInterlocutor(pessoa.id),
                  () => {
                    definirARemover(null);
                    definirPessoaEmEdicao(null);
                  },
                  `${pessoa.nome} foi removida.`,
                )
              }
              aoDesligarPessoa={(pessoa) =>
                void executar(
                  () =>
                    editarInterlocutor(pessoa.id, {
                      nome: pessoa.nome,
                      instituicao_id: pessoa.instituicao_id,
                      email: pessoa.email,
                      cargo: pessoa.cargo,
                      tipo: pessoa.tipo,
                      ativo: !pessoa.ativo,
                    }),
                  () => undefined,
                )
              }
            />
          ))}
        </Cartao>
      </Secao>
    </div>
  );
}

function LinhaDeInstituicao({
  instituicao,
  pessoas,
  ufs,
  relevancias,
  emEdicao,
  aberta,
  salvando,
  rascunho,
  pessoaNova,
  aoRascunhar,
  aoRascunharPessoa,
  aoAbrir,
  aoEditar,
  aoCancelar,
  aoSalvar,
  aoAcrescentarPessoa,
  pessoaEmEdicao,
  rascunhoDaPessoa,
  aoRascunharEdicaoDaPessoa,
  aoEditarPessoa,
  aoCancelarPessoa,
  aoSalvarPessoa,
  aRemover,
  aoPedirRemocao,
  aoDesistirDaRemocao,
  aoRemoverPessoa,
  aoDesligarPessoa,
}: {
  instituicao: Instituicao;
  pessoas: Interlocutor[];
  ufs: { codigo: string; nome: string }[];
  relevancias: { id: number; nome: string }[];
  emEdicao: boolean;
  aberta: boolean;
  salvando: boolean;
  rascunho: RascunhoDaInstituicao;
  pessoaNova: { nome: string; email: string; cargo: string };
  aoRascunhar: (r: RascunhoDaInstituicao) => void;
  aoRascunharPessoa: (p: { nome: string; email: string; cargo: string }) => void;
  aoAbrir: () => void;
  aoEditar: () => void;
  aoCancelar: () => void;
  aoSalvar: () => void;
  aoAcrescentarPessoa: () => void;
  pessoaEmEdicao: string | null;
  rascunhoDaPessoa: { nome: string; email: string; cargo: string };
  aoRascunharEdicaoDaPessoa: (p: {
    nome: string;
    email: string;
    cargo: string;
  }) => void;
  aoEditarPessoa: (pessoa: Interlocutor) => void;
  aoCancelarPessoa: () => void;
  aoSalvarPessoa: (pessoa: Interlocutor) => void;
  aRemover: string | null;
  aoPedirRemocao: (pessoa: Interlocutor) => void;
  aoDesistirDaRemocao: () => void;
  aoRemoverPessoa: (pessoa: Interlocutor) => void;
  aoDesligarPessoa: (pessoa: Interlocutor) => void;
}) {
  const onde = TIPOS.find((t) => t.tipo === instituicao.tipo)?.onde ?? '—';

  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 14,
        borderTop: '1px solid var(--borda)',
      }}
    >
      {emEdicao ? (
        <div className="grade grade--3" style={{ gap: 16 }}>
          <Campo rotulo="Nome curto">
            <input
              style={estiloDeEntrada}
              value={rascunho.nome}
              onChange={(e) => aoRascunhar({ ...rascunho, nome: e.target.value })}
            />
          </Campo>
          <Campo rotulo="Nome completo">
            <input
              style={estiloDeEntrada}
              value={rascunho.nome_completo}
              onChange={(e) =>
                aoRascunhar({ ...rascunho, nome_completo: e.target.value })
              }
            />
          </Campo>
          <Campo rotulo="Tipo">
            <select
              style={estiloDeEntrada}
              value={rascunho.tipo}
              onChange={(e) => aoRascunhar({ ...rascunho, tipo: e.target.value })}
            >
              {TIPOS.map(({ tipo, onde: aonde }) => (
                <option key={tipo} value={tipo}>
                  {tipo} — {aonde}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Relevância">
            <select
              style={estiloDeEntrada}
              value={rascunho.tier}
              onChange={(e) => aoRascunhar({ ...rascunho, tier: e.target.value })}
            >
              {/* SEM ASTERISCO AQUI, e com asterisco no cadastro. As
                  instituições anteriores à coluna não têm tier, e exigi-lo na
                  edição trancaria a correção de um nome atrás de uma
                  classificação que ninguém pediu naquele momento. */}
              <option value="">Não informada</option>
              {relevancias.map((nivel) => (
                <option key={nivel.id} value={nivel.id}>
                  {nivel.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Abrangência">
            <select
              style={estiloDeEntrada}
              value={rascunho.uf}
              onChange={(e) => aoRascunhar({ ...rascunho, uf: e.target.value })}
            >
              <option value="">Não informada</option>
              {ufs.map((uf) => (
                <option key={uf.codigo} value={uf.codigo}>
                  {uf.nome}
                </option>
              ))}
            </select>
          </Campo>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 500 }}>
              {instituicao.nome}
              {instituicao.nome_completo ? (
                <span style={{ fontWeight: 400, color: 'var(--cinza-3)' }}>
                  {' · '}
                  {instituicao.nome_completo}
                </span>
              ) : null}
            </p>
            <p style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
              {instituicao.tipo} · aparece em {onde}
              {instituicao.uf ? ` · ${instituicao.uf}` : ''} ·{' '}
              {pessoas.length === 0
                ? 'ninguém cadastrado'
                : `${pessoas.length} ${pessoas.length === 1 ? 'pessoa' : 'pessoas'}`}
            </p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {emEdicao ? (
          <>
            <Botao variante="primario" desabilitado={salvando} aoClicar={aoSalvar}>
              Salvar
            </Botao>
            <Botao aoClicar={aoCancelar}>Cancelar</Botao>
          </>
        ) : (
          <>
            <Botao aoClicar={aoEditar}>Editar</Botao>
            <Botao variante="fantasma" aoClicar={aoAbrir}>
              {aberta ? 'Fechar' : 'Quem representa'}
            </Botao>
          </>
        )}
      </div>

      {aberta && !emEdicao ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: 'var(--bg-trilho)',
            borderRadius: 'var(--r-card-int)',
          }}
        >
          {/* QUEM APARECE EM "PELA OUTRA PARTE" desta instituição. É a razão de
              a lista existir: o formulário de agenda só oferece estas pessoas
              depois que a instituição é escolhida. */}
          {pessoas.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--cinza-3)', margin: '0 0 12px' }}>
              Ninguém cadastrado. Enquanto não houver, nenhuma agenda desta
              instituição consegue registrar quem participou pela outra parte.
            </p>
          ) : (
            pessoas.map((pessoa) =>
              pessoaEmEdicao === pessoa.id ? (
                <div
                  key={pessoa.id}
                  className="grade grade--3"
                  style={{ gap: 10, padding: '8px 0', alignItems: 'end' }}
                >
                  <Campo rotulo="Nome">
                    <input
                      style={estiloDeEntrada}
                      value={rascunhoDaPessoa.nome}
                      onChange={(e) =>
                        aoRascunharEdicaoDaPessoa({
                          ...rascunhoDaPessoa,
                          nome: e.target.value,
                        })
                      }
                    />
                  </Campo>
                  <Campo rotulo="E-mail">
                    <input
                      type="email"
                      style={estiloDeEntrada}
                      value={rascunhoDaPessoa.email}
                      onChange={(e) =>
                        aoRascunharEdicaoDaPessoa({
                          ...rascunhoDaPessoa,
                          email: e.target.value,
                        })
                      }
                    />
                  </Campo>
                  <Campo rotulo="Cargo">
                    <input
                      style={estiloDeEntrada}
                      value={rascunhoDaPessoa.cargo}
                      onChange={(e) =>
                        aoRascunharEdicaoDaPessoa({
                          ...rascunhoDaPessoa,
                          cargo: e.target.value,
                        })
                      }
                    />
                  </Campo>
                  <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1' }}>
                    <Botao
                      variante="primario"
                      desabilitado={salvando}
                      aoClicar={() => aoSalvarPessoa(pessoa)}
                    >
                      Salvar
                    </Botao>
                    <Botao aoClicar={aoCancelarPessoa}>Cancelar</Botao>
                  </div>
                </div>
              ) : (
                <div
                  key={pessoa.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '5px 0',
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      flex: 1,
                      minWidth: 0,
                      color: pessoa.ativo ? 'var(--cinza-4)' : 'var(--cinza-2)',
                      textDecoration: pessoa.ativo ? 'none' : 'line-through',
                    }}
                  >
                    {pessoa.nome}
                    {pessoa.cargo ? ` · ${pessoa.cargo}` : ''}
                    {/* O E-MAIL E O MOTIVO DE A PESSOA ESTAR AQUI: marcar
                        agenda comeca por escrever para alguem. Como link, para
                        nao exigir copiar e colar. */}
                    {pessoa.email ? (
                      <>
                        {' · '}
                        <a
                          href={`mailto:${pessoa.email}`}
                          style={{ color: 'var(--azul-mar)' }}
                        >
                          {pessoa.email}
                        </a>
                      </>
                    ) : (
                      <span style={{ color: 'var(--cinza-2)' }}> · sem e-mail</span>
                    )}
                  </span>

                  <Botao
                    variante="fantasma"
                    desabilitado={salvando}
                    aoClicar={() => aoEditarPessoa(pessoa)}
                    rotuloAcessivel={`Editar ${pessoa.nome}`}
                  >
                    Editar
                  </Botao>

                  {/* DESLIGAR E REMOVER SAO GESTOS DIFERENTES, e a diferenca e
                      o historico. Desligar tira das listas e mantem o nome nas
                      agendas em que a pessoa esteve; remover so vale para quem
                      entrou por engano — e o servidor recusa o resto, dizendo
                      quantas agendas dependem dela. */}
                  <Botao
                    variante="fantasma"
                    desabilitado={salvando}
                    aoClicar={() => aoDesligarPessoa(pessoa)}
                    rotuloAcessivel={`${pessoa.ativo ? 'Desligar' : 'Reativar'} ${pessoa.nome}`}
                  >
                    {pessoa.ativo ? 'Desligar' : 'Reativar'}
                  </Botao>

                  {/* DUAS ETAPAS NA PROPRIA LINHA. Um modal tiraria o
                      contexto de QUAL pessoa esta sendo removida, que e a
                      informacao que importa numa lista de dez. */}
                  {aRemover === pessoa.id ? (
                    <>
                      <span style={{ fontSize: 12, color: 'var(--erro-fg)' }}>
                        Remover de vez?
                      </span>
                      <Botao
                        variante="fantasma"
                        desabilitado={salvando}
                        aoClicar={() => aoRemoverPessoa(pessoa)}
                        rotuloAcessivel={`Confirmar a remocao de ${pessoa.nome}`}
                        estilo={{ color: 'var(--erro-fg)', fontWeight: 700 }}
                      >
                        Sim, remover
                      </Botao>
                      <Botao variante="fantasma" aoClicar={aoDesistirDaRemocao}>
                        Cancelar
                      </Botao>
                    </>
                  ) : (
                    <Botao
                      variante="fantasma"
                      desabilitado={salvando}
                      aoClicar={() => aoPedirRemocao(pessoa)}
                      rotuloAcessivel={`Remover ${pessoa.nome}`}
                      estilo={{ color: 'var(--erro-fg)' }}
                    >
                      Remover
                    </Botao>
                  )}
                </div>
              ),
            )
          )}

          <div
            className="grade grade--3"
            style={{ gap: 10, marginTop: 12, alignItems: 'end' }}
          >
            <Campo rotulo="Nome">
              <input
                style={estiloDeEntrada}
                value={pessoaNova.nome}
                onChange={(e) =>
                  aoRascunharPessoa({ ...pessoaNova, nome: e.target.value })
                }
                placeholder="Maria Souza"
              />
            </Campo>
            <Campo rotulo="E-mail">
              <input
                type="email"
                style={estiloDeEntrada}
                value={pessoaNova.email}
                onChange={(e) =>
                  aoRascunharPessoa({ ...pessoaNova, email: e.target.value })
                }
                placeholder="maria.souza@ana.gov.br"
              />
            </Campo>
            <Campo rotulo="Cargo">
              <input
                style={estiloDeEntrada}
                value={pessoaNova.cargo}
                onChange={(e) =>
                  aoRascunharPessoa({ ...pessoaNova, cargo: e.target.value })
                }
                placeholder="Secretária de Saneamento"
              />
            </Campo>
          </div>
          <div style={{ marginTop: 10 }}>
            <Botao
              desabilitado={salvando || !pessoaNova.nome.trim()}
              aoClicar={aoAcrescentarPessoa}
            >
              Acrescentar pessoa
            </Botao>
          </div>
        </div>
      ) : null}
    </div>
  );
}
