/** CLICAR NUMA LINHA DA FILA E EDITAR A FICHA INTEIRA DAQUELE REGISTRO.
 *
 *  PEDIDO DO DONO DO PRODUTO:
 *
 *    "posso fazer uma ação em massa como está feita hoje, mas gostaria de poder
 *     clicar em um registro específico e abrir um modal para poder editar todos
 *     os campos daquele registro em específico"
 *
 *  O LOTE E ESTE DIÁLOGO RESPONDEM PERGUNTAS DIFERENTES, e é por isso que os
 *  dois existem. O lote serve ao caso em que a resposta é a mesma para 178
 *  linhas — "são todas gestoras, a categoria é uma". Este serve ao caso em que
 *  ela não é: o registro tem nome errado, praça errada, ou é o único perfil de
 *  rede no meio de instituições.
 *
 *  OS DOIS BOTÕES, escolha do dono do produto: "Salvar" e "Salvar e dar como
 *  conferido". Editar não é afirmar que está certo — foi o princípio de toda a
 *  fila —, mas quem abriu a ficha e corrigiu normalmente quer tirar da fila no
 *  mesmo gesto. Separá-los deixa o segundo ser uma decisão, e não um efeito.
 *
 *  A FICHA VEM DO CATÁLOGO, não de uma busca por id: não há rota de um
 *  registro só, e o catálogo é a fonte que o resto da plataforma usa. Ele chega
 *  fresco depois de uma importação desde que a confirmação passou a avisar o
 *  barramento. O TEMA É A EXCEÇÃO — `catalogo.dicionarios.temas` não traz
 *  `riscos`, que é uma relação e não coluna —, então ele é buscado por
 *  `listarTemas` ao abrir.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  consolidarCadastro,
  editarInstituicao,
  editarInterlocutor,
  editarPessoaAegea,
  editarTema,
  listarTemas,
  mudarContatoDeCasa,
  type CadastroPendente,
  type MudancaDeCasa,
  type TemaCadastrado,
} from '@/api/cliente';
import {
  Botao,
  Campo,
  Carregando,
  FaixaDeErro,
  Modal,
  estiloDeEntrada,
} from '@/componentes/basicos';
import { usePainel } from '@/estado/painel';
import {
  EdicaoDaPessoa,
  LSO,
  ROTULO_DO_TIPO_DE_INSTITUICAO,
  SeletorDeHierarquia,
  SeletorDeRiscos,
  tiposCadastraveis,
} from '@/paginas/cadastroCompartilhado/formularios';
import {
  INSTITUICAO_VAZIA,
  INTERLOCUTOR_VAZIO,
  PESSOA_AEGEA_VAZIA,
  entradaDaInstituicao,
  entradaDaPessoaAegea,
  entradaDoInterlocutor,
  entradaDoTema,
  rascunhoDaInstituicao,
  rascunhoDaPessoaAegea,
  rascunhoDoInterlocutor,
  rascunhoDoTema,
  subcategoriasDe,
  type RascunhoDaInstituicao,
  type RascunhoDaPessoaAegea,
  type RascunhoDoInterlocutor,
  type RascunhoDoTema,
} from '@/paginas/cadastroCompartilhado/fichas';

const TIPOS = tiposCadastraveis();

//: Os níveis do tema, pelo rótulo que a tela de Temas usa.
const NIVEIS_DO_TEMA = [
  { valor: 'gerais', rotulo: 'Geral' },
  { valor: 'estrategico', rotulo: 'Estratégico' },
  { valor: 'sensivel', rotulo: 'Sensível' },
];

/** O esqueleto do diálogo: título, erro, e os dois botões no rodapé.
 *
 *  OS BOTÕES NO RODAPÉ, e não no fim do formulário: a ficha da instituição tem
 *  nove campos e rola: botões no fim do conteúdo saem da tela justo quando a
 *  pessoa terminou de preencher.
 */
function Dialogo({
  pendente,
  salvando,
  erro,
  podeSalvar,
  aoFechar,
  aoSalvar,
  children,
}: {
  pendente: CadastroPendente;
  salvando: boolean;
  erro: string;
  podeSalvar: boolean;
  aoFechar: () => void;
  aoSalvar: (consolidar: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Modal
      titulo={pendente.nome}
      subtitulo={
        //: O MOTIVO NO SUBTÍTULO, e é a razão de a pessoa estar aqui: ela
        //: clicou na linha porque a fila disse que havia algo a conferir. Sem
        //: ele, o diálogo abriria sem dizer o que se espera dela.
        pendente.motivo ??
        'Entrou por planilha e ninguém conferiu o enquadramento ainda.'
      }
      aoFechar={aoFechar}
      largura={760}
      rodape={
        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <Botao estilo={{ height: 40 }} aoClicar={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            desabilitado={salvando || !podeSalvar}
            aoClicar={() => aoSalvar(false)}
            titulo={
              'Grava as correções e DEIXA na fila. Para quando outra pessoa ' +
              'ainda precisa conferir.'
            }
          >
            Salvar
          </Botao>
          <Botao
            variante="primario"
            desabilitado={salvando || !podeSalvar}
            aoClicar={() => aoSalvar(true)}
            titulo="Grava as correções e tira este cadastro da fila."
          >
            {salvando ? 'Salvando…' : 'Salvar e dar como conferido'}
          </Botao>
        </div>
      }
    >
      {erro ? <FaixaDeErro mensagem={erro} /> : null}
      {children}
    </Modal>
  );
}

/** Grava, e só então consolida. A ORDEM IMPORTA.
 *
 *  Se a consolidação falhasse primeiro, a correção estaria perdida. Nesta ordem
 *  o pior caso é "salvou e continuou na fila" — visível, e recuperável com um
 *  clique em "Está certo". O inverso seria "saiu da fila sem a correção", que é
 *  silencioso.
 */
async function gravar(
  pendente: CadastroPendente,
  salvar: () => Promise<unknown>,
  consolidar: boolean,
): Promise<void> {
  await salvar();
  if (consolidar) await consolidarCadastro(pendente.tipo, pendente.id);
}

export function FichaDoPendente({
  pendente,
  aoFechar,
}: {
  pendente: CadastroPendente;
  aoFechar: () => void;
}) {
  const { catalogo } = usePainel();
  const [salvando, definirSalvando] = useState(false);
  const [erro, definirErro] = useState('');

  async function executar(
    salvar: () => Promise<unknown>,
    consolidar: boolean,
  ): Promise<void> {
    definirSalvando(true);
    definirErro('');
    try {
      await gravar(pendente, salvar, consolidar);
      //: FECHA SÓ NO SUCESSO. Fechar antes de o servidor responder esconderia a
      //: recusa — e as recusas daqui são informativas: "já existe outra
      //: instituição chamada X deste mesmo tipo" é o que a pessoa precisa ler.
      aoFechar();
    } catch (falha) {
      definirErro((falha as Error).message);
    } finally {
      definirSalvando(false);
    }
  }

  //: O CATÁLOGO PODE NÃO TER CHEGADO: a fila carrega por rota própria e não
  //: espera a carga do painel. Sem ele não há ficha para mostrar.
  if (catalogo === null) {
    return (
      <Modal titulo={pendente.nome} aoFechar={aoFechar} largura={760}>
        <Carregando rotulo="Buscando a ficha deste cadastro…" />
      </Modal>
    );
  }

  const comum = { pendente, salvando, erro, aoFechar, executar, catalogo };
  if (pendente.tipo === 'instituicao') return <DaInstituicao {...comum} />;
  if (pendente.tipo === 'interlocutor') return <DoInterlocutor {...comum} />;
  if (pendente.tipo === 'pessoa_aegea') return <DaPessoaAegea {...comum} />;
  if (pendente.tipo === 'tema') return <DoTema {...comum} />;

  //: TIPO QUE A TELA NÃO CONHECE. Não deve acontecer — a fila serve quatro —, e
  //: dizer isso é melhor que um diálogo vazio: a pessoa clicou e algo tem de
  //: responder.
  return (
    <Modal titulo={pendente.nome} aoFechar={aoFechar} largura={520}>
      <p style={{ margin: 0, fontSize: 13 }}>
        {`Esta tela não sabe editar um cadastro do tipo ${pendente.tipo}. ` +
          'Edite-o pela lista de cadastro.'}
      </p>
    </Modal>
  );
}

type Comum = {
  pendente: CadastroPendente;
  salvando: boolean;
  erro: string;
  aoFechar: () => void;
  executar: (salvar: () => Promise<unknown>, consolidar: boolean) => Promise<void>;
  catalogo: NonNullable<ReturnType<typeof usePainel>['catalogo']>;
};

/** NÃO ESTÁ MAIS NO CATÁLOGO: outra pessoa apagou, ou a fila está velha. */
function Sumiu({ pendente, aoFechar }: { pendente: CadastroPendente; aoFechar: () => void }) {
  return (
    <Modal titulo={pendente.nome} aoFechar={aoFechar} largura={520}>
      <p style={{ margin: 0, fontSize: 13 }}>
        Este cadastro não está mais na base — outra pessoa pode tê-lo removido. A
        fila se atualiza ao fechar.
      </p>
    </Modal>
  );
}

function DaInstituicao({ pendente, salvando, erro, aoFechar, executar, catalogo }: Comum) {
  const registro = catalogo.instituicoes.get(pendente.id);
  //: O RASCUNHO NASCE PRONTO, e não por efeito.
  //:
  //: O DIÁLOGO REMONTA A CADA LINHA — a `key` na fila garante isso, para o
  //: rascunho de uma não vazar no formulário da seguinte —, então o valor
  //: inicial é tudo de que ele precisa. Um `useEffect` que chamava
  //: `definirRascunho` fazia uma renderização a mais por abertura e era
  //: exatamente o que a regra `set-state-in-effect` aponta: "derive o valor
  //: durante o render, ou inicialize o estado direto".
  const [rascunho, definirRascunho] = useState<RascunhoDaInstituicao>(() =>
    registro ? rascunhoDaInstituicao(registro) : INSTITUICAO_VAZIA,
  );

  if (!registro) return <Sumiu pendente={pendente} aoFechar={aoFechar} />;

  const mexer = (parte: Partial<RascunhoDaInstituicao>) =>
    definirRascunho({ ...rascunho, ...parte });
  const subcategorias = subcategoriasDe(catalogo, rascunho.categoria_publico_id);
  //: SÓ PERFIL DE REDE tem cargo e "é de quem" — o banco tem CHECK dos dois, e
  //: oferecê-los nos outros tipos seria oferecer o que será recusado.
  const ePerfil = rascunho.tipo === 'perfil_rede';

  return (
    <Dialogo
      pendente={pendente}
      salvando={salvando}
      erro={erro}
      podeSalvar={rascunho.nome.trim().length > 0}
      aoFechar={aoFechar}
      aoSalvar={(consolidar) =>
        void executar(
          () => editarInstituicao(registro.id, entradaDaInstituicao(rascunho, registro.ativo)),
          consolidar,
        )
      }
    >
      <div className="grade grade--2" style={{ gap: 12 }}>
        <Campo rotulo="Nome" obrigatorio>
          <input
            style={estiloDeEntrada}
            value={rascunho.nome}
            onChange={(e) => mexer({ nome: e.target.value })}
          />
        </Campo>
        <Campo rotulo="Nome completo" dica="Como aparece em documento oficial.">
          <input
            style={estiloDeEntrada}
            value={rascunho.nome_completo}
            onChange={(e) => mexer({ nome_completo: e.target.value })}
          />
        </Campo>
      </div>

      <div className="grade grade--3" style={{ gap: 12, marginTop: 12 }}>
        <Campo
          rotulo="Tipo"
          ajuda={
            'O tipo decide de que FRENTE é cada agenda desta instituição. Quem ' +
            'entra por planilha sem categoria de público nasce "Entidade", que ' +
            'é o único tipo que não crava uma frente.'
          }
        >
          <select
            style={estiloDeEntrada}
            value={rascunho.tipo}
            onChange={(e) => {
              const tipo = e.target.value;
              //: SAIR DE PERFIL DE REDE LIMPA O CARGO E A PESSOA.
              //:
              //: ACHADO DE REVISÃO COM SEVERIDADE MÉDIA, e o defeito era meu por
              //: ignorar o que a tela principal já fazia: os dois campos
              //: DESAPARECEM quando o tipo muda, mas continuavam no rascunho e
              //: iam no PUT. O banco tem CHECK de que eles só existem em
              //: `perfil_rede`, então salvar era recusado por causa de um campo
              //: que a pessoa não conseguia mais ver — o pior tipo de recusa,
              //: porque ela não tem o que corrigir.
              //:
              //: LIMPAR, E NÃO SÓ ESCONDER: é a diferença entre a tela afirmar o
              //: que mostra e a tela mandar o que escondeu.
              mexer(
                tipo === 'perfil_rede'
                  ? { tipo }
                  : { tipo, cargo: '', pessoa: '' },
              );
            }}
          >
            {TIPOS.map((t) => (
              <option key={t.tipo} value={t.tipo}>
                {t.rotulo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Praça (UF)">
          <select
            style={estiloDeEntrada}
            value={rascunho.uf}
            onChange={(e) => mexer({ uf: e.target.value })}
          >
            <option value="">— sem praça —</option>
            {catalogo.dicionarios.ufs.map((uf) => (
              <option key={uf.codigo} value={uf.codigo}>
                {uf.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Relevância (tier)">
          <select
            style={estiloDeEntrada}
            value={rascunho.tier}
            onChange={(e) => mexer({ tier: e.target.value })}
          >
            <option value="">— sem relevância —</option>
            {catalogo.dicionarios.relevancias.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <div className="grade grade--3" style={{ gap: 12, marginTop: 12 }}>
        <Campo
          rotulo="Categoria de público"
          ajuda={
            'É dela que sai o tipo quando ele não é informado, e é ela que põe a ' +
            'instituição na taxonomia de públicos do Score.'
          }
        >
          <select
            style={estiloDeEntrada}
            value={rascunho.categoria_publico_id}
            onChange={(e) =>
              //: TROCAR A CATEGORIA LIMPA A SUBCATEGORIA: uma subcategoria de
              //: outra categoria ficaria escolhida sem aparecer mais na lista, e
              //: o servidor recusa o par.
              mexer({ categoria_publico_id: e.target.value, subcategoria_publico_id: '' })
            }
          >
            <option value="">— sem categoria —</option>
            {catalogo.dicionarios.categorias_publico.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Campo>
        {subcategorias.length > 0 ? (
          <Campo rotulo="Subcategoria">
            <select
              style={estiloDeEntrada}
              value={rascunho.subcategoria_publico_id}
              onChange={(e) => mexer({ subcategoria_publico_id: e.target.value })}
            >
              <option value="">— sem subcategoria —</option>
              {subcategorias.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </Campo>
        ) : null}
        <Campo rotulo="Esfera">
          <select
            style={estiloDeEntrada}
            value={rascunho.esfera}
            onChange={(e) => mexer({ esfera: e.target.value })}
          >
            <option value="">— sem esfera —</option>
            {catalogo.dicionarios.esferas.map((es) => (
              <option key={es.id} value={es.id}>
                {es.nome}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      {ePerfil ? (
        <div className="grade grade--2" style={{ gap: 12, marginTop: 12 }}>
          <Campo
            rotulo="Cargo"
            dica="O que a fonte informou — e ela erra."
          >
            <input
              style={estiloDeEntrada}
              value={rascunho.cargo}
              onChange={(e) => mexer({ cargo: e.target.value })}
            />
          </Campo>
          <Campo
            rotulo="De quem é este perfil"
            ajuda={
              'Liga o perfil à pessoa do CRM. É o que faz três perfis da mesma ' +
              'deputada virarem uma pessoa — nenhuma normalização funde esses ' +
              'nomes.'
            }
          >
            <select
              style={estiloDeEntrada}
              value={rascunho.pessoa}
              onChange={(e) => mexer({ pessoa: e.target.value })}
            >
              <option value="">— não ligado —</option>
              {[...catalogo.interlocutores.values()]
                .sort((a, b) => a.nome.localeCompare(b.nome))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
            </select>
          </Campo>
        </div>
      ) : (
        <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--cinza-2)' }}>
          {`Cargo e "de quem é" existem só em ${ROTULO_DO_TIPO_DE_INSTITUICAO.perfil_rede}.`}
        </p>
      )}
    </Dialogo>
  );
}

function DoInterlocutor({ pendente, salvando, erro, aoFechar, executar, catalogo }: Comum) {
  const registro = catalogo.interlocutores.get(pendente.id);
  const [rascunho, definirRascunho] = useState<RascunhoDoInterlocutor>(() =>
    registro ? rascunhoDoInterlocutor(registro) : INTERLOCUTOR_VAZIO,
  );

  if (!registro) return <Sumiu pendente={pendente} aoFechar={aoFechar} />;

  const mexer = (parte: Partial<RascunhoDoInterlocutor>) =>
    definirRascunho({ ...rascunho, ...parte });
  const casa = registro.instituicao_id
    ? catalogo.instituicoes.get(registro.instituicao_id)
    : undefined;

  return (
    <Dialogo
      pendente={pendente}
      salvando={salvando}
      erro={erro}
      podeSalvar={rascunho.nome.trim().length > 0}
      aoFechar={aoFechar}
      aoSalvar={(consolidar) =>
        void executar(
          () =>
            editarInterlocutor(
              registro.id,
              entradaDoInterlocutor(rascunho, {
                instituicao_id: registro.instituicao_id,
                tipo: registro.tipo,
                ativo: registro.ativo,
              }),
            ),
          consolidar,
        )
      }
    >
      <div className="grade grade--2" style={{ gap: 12 }}>
        <Campo rotulo="Nome" obrigatorio>
          <input
            style={estiloDeEntrada}
            value={rascunho.nome}
            onChange={(e) => mexer({ nome: e.target.value })}
          />
        </Campo>
        <Campo rotulo="E-mail">
          <input
            type="email"
            style={estiloDeEntrada}
            value={rascunho.email}
            onChange={(e) => mexer({ email: e.target.value })}
          />
        </Campo>
      </div>

      <div className="grade grade--2" style={{ gap: 12, marginTop: 12 }}>
        <Campo rotulo="Cargo">
          <input
            style={estiloDeEntrada}
            value={rascunho.cargo}
            onChange={(e) => mexer({ cargo: e.target.value })}
          />
        </Campo>
        <Campo rotulo="Área" dica="A área DENTRO da instituição dele.">
          <input
            style={estiloDeEntrada}
            value={rascunho.area}
            onChange={(e) => mexer({ area: e.target.value })}
          />
        </Campo>
      </div>

      {/* A MUDANÇA DE CASA, e ela NÃO é um campo do formulário.
          "Mesmo nome em instituições diferentes são pessoas diferentes", diz a
          `0002`: a instituição é parte da IDENTIDADE do contato neste modelo.
          Num `<select>` ao lado do cargo, ela teria o mesmo peso de corrigir um
          e-mail — então é um gesto à parte, com confirmação, e salvar a ficha
          NÃO a inclui. */}
      <MudarDeCasa
        contato={registro}
        casaAtual={casa?.nome ?? null}
        catalogo={catalogo}
        aoMudar={aoFechar}
      />
    </Dialogo>
  );
}

/** Mover o contato para outra instituição — escolher, confirmar, e ler o que
 *  ficou atrás.
 *
 *  TRÊS PASSOS, e não um `<select>` que grava: escolher a casa, LER o que vai
 *  acontecer, e confirmar. O meio é a razão de existir — é ali que a tela diz
 *  quantas agendas ficam na casa antiga, que é a frase que distingue "mudou de
 *  casa" de "eu errei a instituição no cadastro".
 *
 *  FORA DOS BOTÕES DO DIÁLOGO de propósito: "Salvar" grava a ficha e não mexe na
 *  casa. Se a mudança fosse junto, quem abriu para corrigir um e-mail levaria o
 *  contato de instituição sem ter pedido.
 */
function MudarDeCasa({
  contato,
  casaAtual,
  catalogo,
  aoMudar,
}: {
  contato: { id: string; nome: string };
  casaAtual: string | null;
  catalogo: Comum['catalogo'];
  aoMudar: () => void;
}) {
  const [escolhida, definirEscolhida] = useState('');
  const [movendo, definirMovendo] = useState(false);
  const [erro, definirErro] = useState('');
  const [feito, definirFeito] = useState<MudancaDeCasa | null>(null);

  const casas = useMemo(
    () =>
      [...catalogo.instituicoes.values()]
        //: SÓ AS ATIVAS: o servidor recusa mover para casa desativada, porque a
        //: listagem de contatos aplica os dois níveis e a pessoa ficaria
        //: invisível. Oferecer aqui seria oferecer o que será recusado.
        .filter((i) => i.ativo)
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    [catalogo],
  );

  if (feito) {
    return (
      <div
        role="status"
        style={{
          marginTop: 14,
          padding: 12,
          borderRadius: 8,
          background: 'var(--cinza-0)',
          fontSize: 12,
        }}
      >
        {`${feito.nome} passou a falar por ${feito.para}. ` +
          (feito.agendas_que_ficam === 0
            ? 'Não havia agenda nenhuma na casa anterior.'
            : `${feito.agendas_que_ficam} ${
                feito.agendas_que_ficam === 1 ? 'agenda continua' : 'agendas continuam'
              } registradas em ${feito.de} — o histórico não muda.`)}
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 14,
        borderTop: '1px solid var(--cinza-0)',
      }}
    >
      <p style={{ margin: 0, fontSize: 12, color: 'var(--cinza-2)' }}>
        {`Fala por: ${casaAtual ?? '— sem instituição —'}.`}
      </p>

      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 10,
          flexWrap: 'wrap',
          marginTop: 8,
        }}
      >
        <Campo
          rotulo="Mudar de casa"
          ajuda={
            'A instituição de um contato é parte da identidade dele: "mesmo nome ' +
            'em instituições diferentes são pessoas diferentes". Por isso a ' +
            'mudança é um gesto à parte, e salvar a ficha não a inclui.'
          }
        >
          <select
            style={estiloDeEntrada}
            value={escolhida}
            onChange={(e) => {
              definirEscolhida(e.target.value);
              definirErro('');
            }}
          >
            <option value="">Escolha a nova instituição</option>
            {casas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Botao
          desabilitado={!escolhida || movendo}
          aoClicar={() => {
            definirMovendo(true);
            definirErro('');
            mudarContatoDeCasa(contato.id, escolhida)
              .then((m) => {
                definirFeito(m);
                //: AVISA QUEM MONTOU: a fila relê, e a linha deste contato passa
                //: a mostrar a casa nova no `contexto`.
                aoMudar();
              })
              .catch((f: Error) => definirErro(f.message))
              .finally(() => definirMovendo(false));
          }}
          titulo={
            'Passa o contato para a instituição escolhida. As agendas antigas ' +
            'continuam registradas na casa anterior — o histórico não muda.'
          }
        >
          {movendo ? 'Movendo…' : 'Mover'}
        </Botao>
      </div>

      {/* A CONFIRMAÇÃO É O TEXTO, e aparece só depois de escolher: um aviso
          permanente seria lido como enfeite, e este precisa ser lido. */}
      {escolhida ? (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--cinza-3)' }}>
          {`${contato.nome} passará a falar por ` +
            `${casas.find((c) => c.id === escolhida)?.nome}. As agendas em que ` +
            `ele participou continuam registradas em ${casaAtual ?? 'nenhuma casa'} — ` +
            'mover não reescreve o histórico.'}
        </p>
      ) : null}
    </div>
  );
}

function DaPessoaAegea({ pendente, salvando, erro, aoFechar, executar, catalogo }: Comum) {
  const registro = catalogo.pessoas.get(pendente.id);
  const [rascunho, definirRascunho] = useState<RascunhoDaPessoaAegea>(() =>
    registro ? rascunhoDaPessoaAegea(registro) : PESSOA_AEGEA_VAZIA,
  );

  const assuntos = catalogo.dicionarios.temas;
  const assuntosInativos = catalogo.dicionarios.temas_inativos ?? [];

  if (!registro) return <Sumiu pendente={pendente} aoFechar={aoFechar} />;

  const salvar = () =>
    editarPessoaAegea(registro.id, entradaDaPessoaAegea(rascunho, registro.ativo));

  return (
    <Dialogo
      pendente={pendente}
      salvando={salvando}
      erro={erro}
      podeSalvar={rascunho.nome.trim().length > 0}
      aoFechar={aoFechar}
      aoSalvar={(consolidar) => void executar(salvar, consolidar)}
    >
      {/* O FORMULÁRIO DA TELA DE REPRESENTANTES, O MESMO. `acoes` vazio porque
          os botões deste diálogo estão no rodapé — ver `Dialogo`. */}
      <EdicaoDaPessoa
        rascunho={rascunho}
        assuntos={assuntos}
        assuntosInativos={assuntosInativos}
        areas={catalogo.dicionarios.areas_pessoa}
        salvando={salvando}
        aoRascunhar={definirRascunho}
        aoAlternarTema={(id) =>
          definirRascunho({
            ...rascunho,
            temas: rascunho.temas.includes(id)
              ? rascunho.temas.filter((t) => t !== id)
              : [...rascunho.temas, id],
          })
        }
        aoEscolherPapel={(ehPortaVoz) =>
          definirRascunho({ ...rascunho, eh_porta_voz: ehPortaVoz })
        }
        aoCancelar={aoFechar}
        aoSalvar={() => void executar(salvar, true)}
        acoes={null}
      />
    </Dialogo>
  );
}

function DoTema({ pendente, salvando, erro, aoFechar, executar, catalogo }: Comum) {
  //: O TEMA É BUSCADO, e não lido do catálogo: `dicionarios.temas` não traz
  //: `riscos`, que é uma RELAÇÃO e não coluna. Sem eles, salvar a ficha mandaria
  //: `riscos: []` e apagaria a ligação com a matriz corporativa — a armadilha
  //: desta tabela, pela quarta vez.
  const [tema, definirTema] = useState<TemaCadastrado | null>(null);
  const [rascunho, definirRascunho] = useState<RascunhoDoTema | null>(null);
  const [buscando, definirBuscando] = useState(true);
  const [falhou, definirFalhou] = useState('');
  //: OS MACRO TEMAS NUMA REF, e não numa dependência do efeito.
  //:
  //: ACHADO DE REVISÃO COM SEVERIDADE MÉDIA: `macros` saía de `catalogo`, e
  //: QUALQUER escrita em rota de catálogo troca aquele objeto. O efeito então
  //: rodava de novo, buscava os temas de novo, e REESCREVIA O RASCUNHO com os
  //: valores do servidor — apagando o que a pessoa estava digitando, no meio da
  //: edição, por causa de uma mudança que não tem nada a ver com este tema.
  //:
  //: E O MODAL TEM UM GATILHO PRÓPRIO PARA ISSO: salvar aqui avisa o catálogo.
  //: Com duas fichas abertas em abas diferentes, ou com outra pessoa editando,
  //: a edição em curso era descartada em silêncio.
  //: O VALOR PARA O RENDER, e a ref SÓ para dentro do efeito.
  //:
  //: A primeira versão escrevia `macros.current = ...` no corpo e lia `.current`
  //: no JSX — e o lint apontou: "acessar uma ref durante o render pode fazer o
  //: componente não atualizar como esperado". Ele está certo, e a ref ali era
  //: cinto: o que conserta a reidratação é o `antes ?? ...` abaixo.
  //:
  //: ENTÃO SÃO DOIS: o valor simples, que o JSX usa e que atualiza o seletor em
  //: cascata quando o dicionário muda; e a ref, atualizada por efeito, que o
  //: efeito da busca lê sem precisar depender dela.
  const macros = catalogo.dicionarios.macro_temas;
  const macrosAgora = useRef(macros);
  useEffect(() => {
    macrosAgora.current = macros;
  }, [macros]);

  useEffect(() => {
    let atual = true;
    listarTemas()
      .then((todos) => {
        if (!atual) return;
        const achado = todos.find((t) => String(t.id) === pendente.id) ?? null;
        definirTema(achado);
        //: `antes ?? ...`: SÓ A PRIMEIRA CARGA monta o rascunho. Se este efeito
        //: rodar de novo por qualquer razão, o que a pessoa digitou fica.
        if (achado) {
          definirRascunho((antes) => antes ?? rascunhoDoTema(achado, macrosAgora.current));
        }
      })
      .catch((e: Error) => atual && definirFalhou(e.message))
      .finally(() => atual && definirBuscando(false));
    return () => {
      atual = false;
    };
  }, [pendente.id]);

  if (buscando) {
    return (
      <Modal titulo={pendente.nome} aoFechar={aoFechar} largura={760}>
        <Carregando rotulo="Buscando a ficha deste tema…" />
      </Modal>
    );
  }
  if (falhou) {
    return (
      <Modal titulo={pendente.nome} aoFechar={aoFechar} largura={520}>
        <FaixaDeErro mensagem={falhou} />
      </Modal>
    );
  }
  //: O TEMA CONTINUA COM EFEITO, e aqui ele é legítimo: a ficha vem de uma
  //: requisição, que é o "sistema externo" com que a regra diz para
  //: sincronizar. O `definirRascunho` acontece no `.then`, não no corpo do
  //: efeito.
  if (!tema || !rascunho) return <Sumiu pendente={pendente} aoFechar={aoFechar} />;

  const mexer = (parte: Partial<RascunhoDoTema>) =>
    definirRascunho({ ...rascunho, ...parte });

  return (
    <Dialogo
      pendente={pendente}
      salvando={salvando}
      erro={erro}
      podeSalvar={rascunho.nome.trim().length > 0}
      aoFechar={aoFechar}
      aoSalvar={(consolidar) =>
        void executar(() => editarTema(tema.id, entradaDoTema(rascunho, tema.ativo)), consolidar)
      }
    >
      <div className="grade grade--2" style={{ gap: 12 }}>
        <Campo rotulo="Nome" obrigatorio>
          <input
            style={estiloDeEntrada}
            value={rascunho.nome}
            onChange={(e) => mexer({ nome: e.target.value })}
          />
        </Campo>
        <Campo
          rotulo="Nível"
          ajuda={
            'Sensível exige alinhamento antes de falar; estratégico é agenda da ' +
            'companhia; geral é o que aparece sem ter sido planejado. Quem nasce ' +
            'de planilha entra como geral.'
          }
        >
          <select
            style={estiloDeEntrada}
            value={rascunho.nivel}
            onChange={(e) => mexer({ nivel: e.target.value })}
          >
            {NIVEIS_DO_TEMA.map((n) => (
              <option key={n.valor} value={n.valor}>
                {n.rotulo}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <div style={{ marginTop: 12 }}>
        <SeletorDeHierarquia
          blocos={catalogo.dicionarios.blocos_tema}
          macros={macros}
          rascunho={rascunho}
          aoMudar={definirRascunho}
        />
      </div>

      <div style={{ marginTop: 12 }}>
      <Campo rotulo="Camada LSO" ajuda="Que tipo de reputação o tema afeta.">
        <select
          style={estiloDeEntrada}
          value={rascunho.camada_lso}
          onChange={(e) => mexer({ camada_lso: e.target.value })}
        >
          {LSO.map((l) => (
            <option key={l.valor} value={l.valor}>
              {l.rotulo}
            </option>
          ))}
        </select>
      </Campo>
      </div>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 14,
          fontSize: 13,
        }}
      >
        <input
          type="checkbox"
          checked={rascunho.e_risco}
          onChange={(e) => mexer({ e_risco: e.target.checked })}
        />
        É um tema de risco
      </label>

      {/* OS RISCOS APARECEM SEMPRE QUE HOUVER ALGUM, e não só com a caixa
          marcada: gatear pelo checkbox esconderia o enquadramento de quem tem
          risco associado e a binária marcada como falsa — e salvar MANTÉM os
          riscos. O painel afirmando o que a pessoa não viu. É o mesmo conserto
          que `mostrarRiscos` já faz na tela de Temas. */}
      {rascunho.e_risco || rascunho.riscos.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          <SeletorDeRiscos
            clusters={catalogo.dicionarios.risk_clusters}
            riscos={catalogo.dicionarios.riscos}
            selecionados={rascunho.riscos}
            aoMudar={(novos) => mexer({ riscos: novos })}
          />
        </div>
      ) : null}
    </Dialogo>
  );
}
