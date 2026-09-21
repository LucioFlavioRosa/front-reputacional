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
 *  `veiculo` só em Imprensa, `proposicao` só em Legislativo. O cadastro não o
 *  pergunta: ele nasce da categoria de público (`TIPO_DA_CATEGORIA_DE_PUBLICO`,
 *  no back), que a tela já obriga. A EDIÇÃO ainda o mostra, ao lado da frente
 *  em que ele faz a instituição surgir, porque duas coisas a taxonomia não
 *  distingue — banco credor de investidor, e área interna de qualquer público —
 *  e é lá que se corrige.
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
  removerInstituicao,
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
import { Abas } from '@/componentes/Abas';
import type { Aba } from '@/componentes/Abas';
import { CampoQueCompleta } from '@/componentes/CampoQueCompleta';
import { usePainel } from '@/estado/painel';
import { ROTULOS_DE_FRENTE, TIPO_DE_INSTITUICAO } from '@/dominio/frentes';
import type {
  CategoriaPublicoDoDicionario,
  Frente,
  Instituicao,
  Interlocutor,
  SubcategoriaPublicoDoDicionario,
} from '@/dominio/tipos';
import type { Catalogo } from '@/dominio/derivacoes';

/** O que este gesto de cadastro cria.
 *
 *  Dois caminhos, nomeados aqui em cima: a instituição sozinha, e a pessoa
 *  avulsa (o mesmo "Acrescentar pessoa" que existe dentro de cada linha da
 *  lista, só que como primeira opção, sem exigir abrir a instituição certa
 *  lá embaixo antes). Cadastrar os dois de uma vez já foi um terceiro modo
 *  e saiu: quem representa a instituição se cadastra em "Contatos" depois
 *  que ela existe — um gesto por decisão.
 */
const MODOS_DE_CADASTRO: readonly Aba<'instituicao' | 'pessoa'>[] = [
  { id: 'instituicao', rotulo: 'Instituição' },
  { id: 'pessoa', rotulo: 'Contatos' },
];

const PESSOA_AVULSA_VAZIA = { instituicao_id: '', nome: '', email: '', cargo: '' };

//: O código que o banco grava (`orgao`, `area_interna`...) não é o que se lê
//: numa tela. Escrito à mão, e não derivado: são seis valores fixos, do
//: mesmo jeito que o dicionário de UF já tem código E nome escritos à parte.
const ROTULO_DO_TIPO: Record<string, string> = {
  orgao: 'Órgão',
  veiculo: 'Veículo',
  entidade: 'Entidade',
  investidor: 'Investidor',
  proposicao: 'Proposição',
  area_interna: 'Área interna',
  credor: 'Banco/credor',
};

/** Cada tipo, e em que frentes ele aparece.
 *
 *  Derivado de `TIPO_DE_INSTITUICAO`, e não escrito à mão: uma lista própria
 *  divergiria do mapa, e a tela passaria a prometer uma frente que o filtro do
 *  formulário não cumpre.
 *
 *  `entidade` sai com duas frentes — Parceiros e Eventos dividem o tipo —, e é
 *  exatamente o que a pessoa precisa saber antes de escolher.
 */
function tiposComSuasFrentes(): { tipo: string; rotulo: string; onde: string }[] {
  const porTipo = new Map<string, Frente[]>();
  for (const [frente, tipo] of Object.entries(TIPO_DE_INSTITUICAO)) {
    porTipo.set(tipo, [...(porTipo.get(tipo) ?? []), frente as Frente]);
  }
  return [...porTipo.entries()].map(([tipo, frentes]) => ({
    tipo,
    rotulo: ROTULO_DO_TIPO[tipo] ?? tipo,
    onde: frentes.map((f) => ROTULOS_DE_FRENTE[f]).join(' e '),
  }));
}

const TIPOS = tiposComSuasFrentes();

/** As subcategorias de UMA categoria, na ordem — `subcategorias_publico` vem
 *  do dicionário inteiro, de todas as categorias juntas (ver
 *  `Dicionarios.subcategorias_publico`), então quem monta o `<select>`
 *  dependente sempre filtra por `categoria_publico_id` primeiro. */
function subcategoriasDe(
  catalogo: Catalogo,
  categoriaPublicoId: string,
): SubcategoriaPublicoDoDicionario[] {
  const id = Number(categoriaPublicoId);
  return catalogo.dicionarios.subcategorias_publico
    .filter((s) => s.categoria_publico_id === id)
    .sort((a, b) => a.ordem - b.ordem);
}

const VAZIA = {
  nome: '',
  nome_completo: '',
  uf: '',
  esfera: '',
  //: SEM PADRAO, e e por isso que e string vazia e nao 3.
  //:
  //: Um padrao aqui viraria o valor da maioria: quem cadastra com pressa
  //: aceita o que ja esta na tela, e a base inteira acaba num tier so — o
  //: campo passa a existir sem significar nada. Vazio obriga a escolher,
  //: enquanto quem cadastra ainda sabe por que aquela instituicao importa.
  tier: '',
  //: MESMO RACIOCINIO DO TIER: sem padrao, para obrigar a escolha. Ao
  //: contrario do tier, aqui o backend aceita nulo mesmo em instituicao nova
  //: — as ~99 que ja existiam ficam sem categoria ate o backfill, e o mesmo
  //: formulario serve para corrigi-las. `obrigatorio` na tela é só para
  //: instituição CRIADA daqui pra frente não nascer sem classificação.
  categoria_publico_id: '',
  //: SÓ FAZ SENTIDO junto de uma categoria com `padrao_de_quebra !==
  //: 'sem_quebra'` — o campo de subcategoria só aparece nesse caso.
  subcategoria_publico_id: '',
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
  esfera: string;
  tier: string;
  categoria_publico_id: string;
  subcategoria_publico_id: string;
}

export function CadastroDeInstituicoes() {
  const { catalogo } = usePainel();
  const [erro, definirErro] = useState<string | null>(null);
  //: O que acabou de dar certo. Sem isto, salvar é SILENCIOSO: o formulário
  //: limpa e nada diz que a gravação foi feita — e quem não confia cadastra
  //: duas vezes.
  const [feito, definirFeito] = useState<string | null>(null);
  //: Qual pessoa está com a remoção pendente de confirmação. Duas etapas na
  //: própria linha, e não um modal: o modal tira o contexto de QUAL linha, que
  //: é a informação que importa quando há dez pessoas na lista.
  const [aRemover, definirARemover] = useState<string | null>(null);
  //: A mesma coisa, para a INSTITUIÇÃO: qual linha de "Cadastrados" está
  //: com "Excluir de vez?" aberto. Um id só — pedir a exclusão de uma fecha a
  //: pergunta da outra.
  const [aExcluir, definirAExcluir] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);
  const [busca, definirBusca] = useState('');

  //: Qual instituição está aberta para edição, e qual está com a lista de
  //: pessoas expandida. Duas coisas diferentes: dá para ver quem representa uma
  //: instituição sem entrar no modo de edição dela.
  const [emEdicao, definirEmEdicao] = useState<string | null>(null);
  const [aberta, definirAberta] = useState<string | null>(null);
  //: Qual das duas formas o gesto de cadastro do topo está fazendo agora.
  const [modo, definirModo] = useState<'instituicao' | 'pessoa'>('instituicao');
  const [nova, definirNova] = useState(VAZIA);
  //: O rascunho do modo "Só a pessoa" — vive separado de `nova` porque os
  //: dois modos podem ser preenchidos e abandonados de forma independente:
  //: trocar de aba não deveria apagar o que já foi digitado no outro modo.
  const [pessoaAvulsa, definirPessoaAvulsa] = useState(PESSOA_AVULSA_VAZIA);
  //: O rascunho da EDICAO nao carrega pessoa: editar a instituicao nao e o
  //: lugar de acrescentar gente — para isso existe "Quem representa".
  const [rascunho, definirRascunho] = useState<RascunhoDaInstituicao>({
    nome: '',
    nome_completo: '',
    tipo: 'orgao',
    uf: '',
    esfera: '',
    tier: '',
    categoria_publico_id: '',
    subcategoria_publico_id: '',
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

  //: Todas, sem o filtro de busca da lista "Cadastrados" — o rótulo de opção
  //: leva o nome completo na busca pelo mesmo motivo do formulário de agenda:
  //: quem digita "agencia nacional" precisa achar "ANA".
  const opcoesDeInstituicao = useMemo(
    () =>
      [...(catalogo?.instituicoes.values() ?? [])]
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        .map((instituicao) => ({
          valor: instituicao.id,
          rotulo: instituicao.nome,
          detalhe: instituicao.nome_completo ?? undefined,
        })),
    [catalogo],
  );

  const pessoasDe = (instituicaoId: string): Interlocutor[] =>
    [...(catalogo?.interlocutores.values() ?? [])]
      .filter((p) => p.instituicao_id === instituicaoId)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  /** Toda escrita passa por aqui.
   *
   *  O catálogo — que alimenta o formulário de agenda, os filtros e a ficha —
   *  recarrega sozinho: o cliente da API avisa a cada escrita bem-sucedida
   *  numa rota de catálogo, e o estado do painel escuta. Ver
   *  `dominio/sincronizacao.ts`. Esta tela não precisa lembrar de nada.
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
      aoTerminar();
      definirFeito(aviso);
    } catch (falha) {
      definirErro((falha as Error).message);
    } finally {
      definirSalvando(false);
    }
  };

  if (!catalogo) return null;

  //: A SUBCATEGORIA SÓ APARECE quando a categoria escolhida tem
  //: `padrao_de_quebra !== 'sem_quebra'` — Poder Judiciário, Entidades
  //: Setoriais e Parceiros e Cadeia de Valor não têm subdivisão nenhuma.
  //: (O rascunho de EDIÇÃO tem o mesmo cálculo dentro de `LinhaDeInstituicao`,
  //: que é onde ele é usado — este aqui serve só o formulário "nova".)
  const categoriaDaNova = catalogo.dicionarios.categorias_publico.find(
    (c) => c.id === Number(nova.categoria_publico_id),
  );

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

      <Secao titulo="Cadastrar">
        <Cartao>
          <div style={{ marginBottom: 18 }}>
            <Abas
              abas={MODOS_DE_CADASTRO}
              ativa={modo}
              aoTrocar={definirModo}
              rotulo="O que cadastrar"
              prefixo="cadastro-tipo"
            />
          </div>

          {modo === 'pessoa' ? (
            <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: '0 0 16px' }}>
              A instituição já está cadastrada — aqui você escolhe qual, e
              cadastra só a pessoa nova que passou a representá-la.
            </p>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: '0 0 16px' }}>
              A categoria de público é o que faz esta instituição aparecer nas
              interações certas — Poder Executivo em Governo, Imprensa em
              Imprensa, e assim por diante.
            </p>
          )}

          {modo === 'pessoa' ? null : (
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
                ser Tier 3. Sem este campo, a pergunta se refaz a cada reunião
                — e é respondida diferente. */}
            <Campo
              rotulo="Relevância"
              obrigatorio
              dica="O quanto esta instituição importa em geral — cada agenda pode ter uma relevância diferente da dela."
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

            {/* A CATEGORIA DE PÚBLICO é atributo da instituição, igual à
                relevância acima — não da agenda. Ver
                0036_categoria_de_publico.sql. Obrigatória aqui: o backend
                aceita nulo (para não travar a edição das ~99 instituições que
                existiam antes desta coluna), mas instituição CRIADA daqui pra
                frente não deveria nascer sem classificação. */}
            <Campo
              rotulo="Categoria de público"
              obrigatorio
              dica="A nova taxonomia de públicos — de que tipo de ator esta instituição é."
            >
              <select
                style={estiloDeEntrada}
                value={nova.categoria_publico_id}
                onChange={(e) =>
                  definirNova({
                    ...nova,
                    categoria_publico_id: e.target.value,
                    // TROCAR A CATEGORIA LIMPA A SUBCATEGORIA: uma escolhida
                    // antes pode não pertencer mais à categoria nova.
                    subcategoria_publico_id: '',
                  })
                }
              >
                <option value="">Selecione…</option>
                {catalogo.dicionarios.categorias_publico.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nome}
                  </option>
                ))}
              </select>
            </Campo>

            {categoriaDaNova && categoriaDaNova.padrao_de_quebra !== 'sem_quebra' ? (
              <Campo rotulo="Subcategoria" obrigatorio>
                <select
                  style={estiloDeEntrada}
                  value={nova.subcategoria_publico_id}
                  onChange={(e) =>
                    definirNova({ ...nova, subcategoria_publico_id: e.target.value })
                  }
                >
                  <option value="">Selecione…</option>
                  {subcategoriasDe(catalogo, nova.categoria_publico_id).map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.nome}
                    </option>
                  ))}
                </select>
              </Campo>
            ) : null}
          </div>
          )}

          {/* MODO "SÓ A PESSOA": a mesma escrita que já existia dentro de cada
              linha de "Cadastrados" (`criarInterlocutor` com `instituicao_id`
              de uma instituição JÁ existente) — só que aqui em cima, como
              primeira opção, em vez de exigir abrir a instituição certa lá
              embaixo primeiro. */}
          {modo === 'pessoa' ? (
            <div className="grade grade--3" style={{ gap: 16 }}>
              <CampoQueCompleta
                rotulo="Instituição"
                obrigatorio
                valor={pessoaAvulsa.instituicao_id}
                aoEscolher={(v) =>
                  definirPessoaAvulsa({ ...pessoaAvulsa, instituicao_id: v })
                }
                opcoes={opcoesDeInstituicao}
                placeholder="Digite para buscar…"
              />
              <Campo rotulo="Nome" obrigatorio>
                <input
                  style={estiloDeEntrada}
                  value={pessoaAvulsa.nome}
                  onChange={(e) =>
                    definirPessoaAvulsa({ ...pessoaAvulsa, nome: e.target.value })
                  }
                  placeholder="Maria Souza"
                />
              </Campo>
              <Campo rotulo="Cargo">
                <input
                  style={estiloDeEntrada}
                  value={pessoaAvulsa.cargo}
                  onChange={(e) =>
                    definirPessoaAvulsa({ ...pessoaAvulsa, cargo: e.target.value })
                  }
                  placeholder="Diretora de Regulação"
                />
              </Campo>
              <Campo rotulo="E-mail">
                <input
                  type="email"
                  style={estiloDeEntrada}
                  value={pessoaAvulsa.email}
                  onChange={(e) =>
                    definirPessoaAvulsa({ ...pessoaAvulsa, email: e.target.value })
                  }
                  placeholder="maria.souza@ana.gov.br"
                />
              </Campo>
            </div>
          ) : null}

          <div style={{ marginTop: 14 }}>
            <Botao
              variante="primario"
              desabilitado={
                salvando ||
                (modo === 'pessoa'
                  ? !pessoaAvulsa.instituicao_id || !pessoaAvulsa.nome.trim()
                  : !nova.nome.trim() ||
                    !nova.tier ||
                    // INSTITUIÇÃO NOVA NÃO NASCE SEM CATEGORIA — diferente da
                    // edição, que aceita nulo para não travar a correção das
                    // ~99 que existiam antes desta coluna (ver backfill).
                    !nova.categoria_publico_id ||
                    (categoriaDaNova?.padrao_de_quebra !== 'sem_quebra' &&
                      !nova.subcategoria_publico_id))
              }
              aoClicar={() =>
                modo === 'pessoa'
                  ? void executar(
                      () =>
                        criarInterlocutor({
                          nome: pessoaAvulsa.nome,
                          instituicao_id: pessoaAvulsa.instituicao_id,
                          email: pessoaAvulsa.email || null,
                          cargo: pessoaAvulsa.cargo || null,
                        }),
                      () => definirPessoaAvulsa(PESSOA_AVULSA_VAZIA),
                      `${pessoaAvulsa.nome} cadastrada.`,
                    )
                  : void executar(
                      () =>
                        criarInstituicao({
                          nome: nova.nome,
                          nome_completo: nova.nome_completo || null,
                          // SEM `tipo`, de propósito: o back o deriva da
                          // categoria de público, obrigatória logo abaixo.
                          uf: nova.uf || null,
                          esfera_id: nova.esfera ? Number(nova.esfera) : null,
                          tier: Number(nova.tier),
                          categoria_publico_id: nova.categoria_publico_id
                            ? Number(nova.categoria_publico_id)
                            : null,
                          subcategoria_publico_id: nova.subcategoria_publico_id
                            ? Number(nova.subcategoria_publico_id)
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
              categoriasPublico={catalogo.dicionarios.categorias_publico}
              subcategoriasPublico={catalogo.dicionarios.subcategorias_publico}
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
                  esfera: instituicao.esfera_id ? String(instituicao.esfera_id) : '',
                  tier: instituicao.tier ? String(instituicao.tier) : '',
                  categoria_publico_id: instituicao.categoria_publico_id
                    ? String(instituicao.categoria_publico_id)
                    : '',
                  subcategoria_publico_id: instituicao.subcategoria_publico_id
                    ? String(instituicao.subcategoria_publico_id)
                    : '',
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
                      esfera_id: rascunho.esfera ? Number(rascunho.esfera) : null,
                      // VAZIO VIRA `null`, e nao 0: as 98 instituicoes
                      // anteriores a coluna nao tem tier, e corrigir o nome de
                      // uma delas nao pode obrigar a classifica-la primeiro.
                      tier: rascunho.tier ? Number(rascunho.tier) : null,
                      // MESMO RACIOCINIO: as ~99 instituicoes anteriores a
                      // categoria de publico tambem nao tem uma, e o PUT nao
                      // pode travar a edicao delas por causa disso.
                      categoria_publico_id: rascunho.categoria_publico_id
                        ? Number(rascunho.categoria_publico_id)
                        : null,
                      subcategoria_publico_id: rascunho.subcategoria_publico_id
                        ? Number(rascunho.subcategoria_publico_id)
                        : null,
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
              aExcluir={aExcluir === instituicao.id}
              aoPedirExclusao={() => definirAExcluir(instituicao.id)}
              aoDesistirDaExclusao={() => definirAExcluir(null)}
              aoExcluir={() =>
                void executar(
                  // Confirmação em duas etapas, como na pessoa: o servidor
                  // recusa a que já esteve numa agenda, mas a que não esteve
                  // some na hora, com as pessoas dela, sem desfazer.
                  () => removerInstituicao(instituicao.id),
                  () => {
                    definirAExcluir(null);
                    if (aberta === instituicao.id) definirAberta(null);
                    if (emEdicao === instituicao.id) definirEmEdicao(null);
                  },
                  `${instituicao.nome} foi excluída.`,
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
  categoriasPublico,
  subcategoriasPublico,
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
  aExcluir,
  aoPedirExclusao,
  aoDesistirDaExclusao,
  aoExcluir,
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
  categoriasPublico: CategoriaPublicoDoDicionario[];
  subcategoriasPublico: SubcategoriaPublicoDoDicionario[];
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
  aExcluir: boolean;
  aoPedirExclusao: () => void;
  aoDesistirDaExclusao: () => void;
  aoExcluir: () => void;
  aRemover: string | null;
  aoPedirRemocao: (pessoa: Interlocutor) => void;
  aoDesistirDaRemocao: () => void;
  aoRemoverPessoa: (pessoa: Interlocutor) => void;
  aoDesligarPessoa: (pessoa: Interlocutor) => void;
}) {
  const onde = TIPOS.find((t) => t.tipo === instituicao.tipo)?.onde ?? '—';
  const rotuloDoTipo = ROTULO_DO_TIPO[instituicao.tipo] ?? instituicao.tipo;
  const categoriaDoRascunho = categoriasPublico.find(
    (c) => c.id === Number(rascunho.categoria_publico_id),
  );

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
              {TIPOS.map(({ tipo, rotulo, onde: aonde }) => (
                <option key={tipo} value={tipo}>
                  {rotulo} — {aonde}
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
          <Campo rotulo="Categoria de público">
            <select
              style={estiloDeEntrada}
              value={rascunho.categoria_publico_id}
              onChange={(e) =>
                aoRascunhar({
                  ...rascunho,
                  categoria_publico_id: e.target.value,
                  subcategoria_publico_id: '',
                })
              }
            >
              {/* SEM ASTERISCO, mesmo motivo da Relevância: as ~99
                  instituições anteriores a esta coluna não têm categoria, e
                  exigi-la aqui trancaria a correção de um nome atrás de uma
                  classificação que é trabalho do backfill, não deste campo. */}
              <option value="">Não informada</option>
              {categoriasPublico.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                </option>
              ))}
            </select>
          </Campo>
          {categoriaDoRascunho && categoriaDoRascunho.padrao_de_quebra !== 'sem_quebra' ? (
            <Campo rotulo="Subcategoria">
              <select
                style={estiloDeEntrada}
                value={rascunho.subcategoria_publico_id}
                onChange={(e) =>
                  aoRascunhar({ ...rascunho, subcategoria_publico_id: e.target.value })
                }
              >
                <option value="">Não informada</option>
                {subcategoriasPublico
                  .filter((s) => s.categoria_publico_id === categoriaDoRascunho.id)
                  .sort((a, b) => a.ordem - b.ordem)
                  .map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.nome}
                    </option>
                  ))}
              </select>
            </Campo>
          ) : null}
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
              {rotuloDoTipo} · aparece em {onde}
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
            {/* DUAS ETAPAS NA PRÓPRIA LINHA, como na remoção de pessoa: um
                modal tiraria o contexto de QUAL instituição está saindo. O
                servidor recusa a que já esteve numa agenda — a mensagem dele
                aparece na faixa de erro, com a contagem. */}
            {aExcluir ? (
              <>
                <span style={{ fontSize: 12, color: 'var(--erro-fg)', alignSelf: 'center' }}>
                  Excluir de vez, com as pessoas dela?
                </span>
                <Botao
                  variante="fantasma"
                  desabilitado={salvando}
                  aoClicar={aoExcluir}
                  rotuloAcessivel={`Confirmar a exclusão de ${instituicao.nome}`}
                  estilo={{ color: 'var(--erro-fg)', fontWeight: 700 }}
                >
                  Sim, excluir
                </Botao>
                <Botao variante="fantasma" aoClicar={aoDesistirDaExclusao}>
                  Cancelar
                </Botao>
              </>
            ) : (
              <Botao
                variante="fantasma"
                desabilitado={salvando}
                aoClicar={aoPedirExclusao}
                rotuloAcessivel={`Excluir ${instituicao.nome}`}
                estilo={{ color: 'var(--erro-fg)' }}
              >
                Excluir
              </Botao>
            )}
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
