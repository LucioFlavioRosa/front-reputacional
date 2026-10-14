/** Gerenciamento de perfis — o que cada pessoa pode ver e fazer.
 *
 *  SUBSTITUI A TELA `Acessos`, e a substituição é o ponto. Aquela apresentava o
 *  acesso como ele é GUARDADO: um `select` com onze papéis de nome técnico, mais
 *  caixas de seleção para irrestrito, externo, frentes e unidades. Funcionava
 *  para quem conhecia a tabela `papel`. Quem libera uma pessoa não conhece, e
 *  não deveria precisar: pensa em "ela entra onde?", "faz o quê lá?" e "vê o que
 *  é sensível?".
 *
 *  As três camadas, aplicadas nesta ordem:
 *
 *      1. Nível      quais painéis           (as bandeiras `acessa_*`)
 *      2. Papel      o que faz neles         (`pode_criar`)
 *      3. Sensível   se vê o que é sensível  (`usuario.acesso_sensivel`, 0087)
 *
 *  Administrador é a exceção: tem tudo, e as camadas 2 e 3 não se aplicam.
 *
 *  O QUE ELA ABSORVEU, e por que não ficou de fora: prazo, marcação de externo
 *  e escopo por frente/unidade só existiam na tela antiga. Deixá-los sem tela
 *  os devolveria ao `UPDATE` manual no banco — que é exatamente o que a tela
 *  antiga existia para evitar, e ninguém audita `UPDATE` manual. Eles estão no
 *  quarto bloco, "Alcance e prazo", abaixo das três camadas porque são a
 *  exceção e não a regra: a maioria das concessões não os toca.
 *
 *  A TELA NÃO É A BARREIRA. Esconder e desabilitar é conveniência: quem decide é
 *  o backend, que responde 403. O que se evita aqui é oferecer uma porta que não
 *  abre — e oferecer um estado que o banco recusaria depois de a pessoa
 *  preencher tudo.
 *
 *  O PAPEL É O ÚNICO ESTADO. As camadas são projetadas do código do papel por
 *  `dominio/perfis.ts`, e um clique numa camada escolhe outro papel. Guardar
 *  nível e papel em paralelo criaria dois estados para a mesma coisa, e eles
 *  divergiriam no primeiro caso de borda.
 */

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import {
  concederAcesso,
  definirSituacaoDeAcesso,
  historicoDeAcesso,
  listarAcessos,
  listarPapeis,
} from '@/api/cliente';
import {
  Botao,
  Campo,
  Carregando,
  Chip,
  FaixaDeAtencao,
  FaixaDeErro,
  Modal,
  Secao,
  Vazio,
  estiloDeEntrada,
} from '@/componentes/basicos';
import {
  MODULOS,
  NIVEIS,
  ROTULO_DO_ESTADO,
  estadoDoModulo,
  niveisConcediveis,
  nivelDoPapel,
  papelParaNivel,
} from '@/dominio/perfis';
import type { EstadoDoModulo, Nivel, NivelId } from '@/dominio/perfis';
import { formularioDe, impedimento, listaDe, montarConcessao } from '@/dominio/concessao';
import type { Formulario } from '@/dominio/concessao';
import { dataCompleta, diasDesde } from '@/dominio/formato';
import type { Acesso, PapelDisponivel, TrilhaDeAcesso } from '@/dominio/tipos';

/** Abaixo disto o prazo aparece em vermelho: é hora de renovar ou encerrar. */
const DIAS_DE_ALERTA = 30;

export function GerenciamentoDePerfis({
  euId,
  mercadoLancado = false,
}: {
  euId: string | null;
  /** Vem de `GET /api/eu`. Decide se o módulo Mercado aparece como "Liberado ao
   *  lançar" em vez de prometer uma tela que não abre. */
  mercadoLancado?: boolean;
}) {
  const [pessoas, definirPessoas] = useState<Acesso[] | null>(null);
  const [catalogo, definirCatalogo] = useState<PapelDisponivel[]>([]);
  const [erro, definirErro] = useState<string | null>(null);

  const [selecionada, definirSelecionada] = useState<string | null>(null);
  const [busca, definirBusca] = useState('');
  const [filtro, definirFiltro] = useState<'todos' | 'sem' | NivelId>('todos');

  const [forma, definirForma] = useState<Formulario | null>(null);
  const [salvando, definirSalvando] = useState(false);
  const [confirmado, definirConfirmado] = useState<string | null>(null);
  const [erroDoSalvar, definirErroDoSalvar] = useState<string | null>(null);

  const [emHistorico, definirEmHistorico] = useState<Acesso | null>(null);
  const [aDesativar, definirADesativar] = useState<Acesso | null>(null);
  const [aDescartar, definirADescartar] = useState<string | null>(null);

  const carregar = async (manterSelecao = true) => {
    definirErro(null);
    try {
      const [lista, papeis] = await Promise.all([listarAcessos(), listarPapeis()]);
      definirPessoas(lista);
      definirCatalogo(papeis);
      if (!manterSelecao || !lista.some((p) => p.id === selecionada)) {
        //: ABRE NO PRIMEIRO SEM NÍVEL, e não no primeiro da lista. Quem não tem
        //: papel entrou pelo SSO e está esperando alguém liberar — é a única
        //: pessoa nesta tela com uma pendência de verdade.
        const esperando = lista.find((p) => !p.papel);
        definirSelecionada((esperando ?? lista[0])?.id ?? null);
      }
    } catch (falha) {
      definirErro(falha instanceof Error ? falha.message : 'Falha ao carregar perfis.');
      definirPessoas([]);
    }
  };

  useEffect(function carregarAoAbrir() {
    void carregar(false);
  }, []);

  const pessoa = useMemo(
    () => (pessoas ?? []).find((p) => p.id === selecionada) ?? null,
    [pessoas, selecionada],
  );

  //: O formulário renasce quando a pessoa muda. Não dá para derivá-lo a cada
  //: render: ele guarda a alteração PENDENTE, que é justamente o que não está
  //: no servidor ainda.
  useEffect(
    function recomecarOFormularioNaTrocaDePessoa() {
      definirForma(pessoa ? formularioDe(pessoa) : null);
      definirErroDoSalvar(null);
      definirConfirmado(null);
    },
    [pessoa?.id],
  );

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtradas = (pessoas ?? []).filter((p) => {
      if (filtro === 'sem' && p.papel) return false;
      if (filtro !== 'todos' && filtro !== 'sem') {
        const papel = catalogo.find((x) => x.codigo === p.papel);
        if (!papel || nivelDoPapel(papel) !== filtro) return false;
      }
      if (termo && !`${p.nome} ${p.email}`.toLowerCase().includes(termo)) return false;
      return true;
    });

    //: Sem nível primeiro, depois alfabético. A ordem é a prioridade: quem está
    //: esperando liberação encabeça, e deixá-lo no fim é deixá-lo esperando mais.
    return [...filtradas].sort((a, b) => {
      if (!a.papel !== !b.papel) return a.papel ? 1 : -1;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }, [pessoas, catalogo, busca, filtro]);

  const semNivel = (pessoas ?? []).filter((p) => !p.papel).length;
  const concediveis = useMemo(() => niveisConcediveis(catalogo), [catalogo]);

  if (erro) return <FaixaDeErro mensagem={erro} />;
  if (!pessoas || !pessoas.length) {
    if (!pessoas) return <Carregando rotulo="Carregando perfis…" />;
  }

  /* -- as camadas, projetadas do papel ------------------------------------- */

  const papelDoFormulario = forma
    ? (catalogo.find((p) => p.codigo === forma.papel) ?? null)
    : null;
  const nivelEscolhido = papelDoFormulario ? nivelDoPapel(papelDoFormulario) : null;
  const editorEscolhido = papelDoFormulario?.pode_criar ?? false;
  const ehAdmin = nivelEscolhido === 'admin';
  const semNivelEscolhido = nivelEscolhido === null;
  //: As camadas 2 e 3 não se aplicam a administrador (tem tudo) nem a quem não
  //: tem nível (não há onde aplicá-las).
  const camadasDesligadas = ehAdmin || semNivelEscolhido;

  /** Um papel que o catálogo tem e os cinco níveis não descrevem.
   *
   *  Acontece com os pares da Síntese. Avisar é obrigatório: sem o aviso, a
   *  tela mostraria todos os níveis desmarcados, quem administra concluiria que
   *  a pessoa não tem acesso, e salvaria um nível "para corrigir" — trocando o
   *  papel de alguém que estava certo.
   */
  const papelForaDosNiveis =
    forma?.papel && papelDoFormulario && nivelDoPapel(papelDoFormulario) === null
      ? papelDoFormulario
      : null;

  const ajustar = (mudanca: Partial<Formulario>) => {
    definirForma((atual) => (atual ? { ...atual, ...mudanca } : atual));
    definirConfirmado(null);
    definirErroDoSalvar(null);
  };

  const escolherNivel = (id: NivelId) => {
    const escolhido = papelParaNivel(id, editorEscolhido, catalogo);
    if (!escolhido) {
      definirErroDoSalvar(
        `Não há papel cadastrado para o nível ${nivelPor(id).curto}. ` +
          'Fale com quem administra o banco.',
      );
      return;
    }
    //: Administrador zera as camadas 2 e 3 — não por capricho da tela: o banco
    //: as ignora para quem administra, e deixar "sem sensível" marcado na tela
    //: afirmaria uma restrição que não existe.
    ajustar({
      papel: escolhido.codigo,
      sensivel: escolhido.administra_acessos ? true : (forma?.sensivel ?? false),
    });
  };

  const escolherPapel = (editor: boolean) => {
    if (camadasDesligadas || nivelEscolhido === null) return;
    const escolhido = papelParaNivel(nivelEscolhido, editor, catalogo);
    if (!escolhido) {
      definirErroDoSalvar(
        `O nível ${nivelPor(nivelEscolhido).curto} não tem papel de ` +
          `${editor ? 'Editor' : 'Usuário'} cadastrado.`,
      );
      return;
    }
    ajustar({ papel: escolhido.codigo });
  };

  const removerNivel = () => ajustar({ papel: '', sensivel: false });

  /* -- o que está pendente -------------------------------------------------- */

  const barreira = forma ? impedimento(forma, catalogo) : null;
  const souEu = Boolean(pessoa && euId && pessoa.id === euId);

  const resumo = (f: Formulario | null): string => {
    if (!f?.papel) return 'Sem nível';
    const papel = catalogo.find((p) => p.codigo === f.papel);
    const id = papel ? nivelDoPapel(papel) : null;
    if (!papel) return 'Sem nível';
    if (id === null) return papel.nome;
    if (id === 'admin') return 'Administrador · acesso total';
    return [
      nivelPor(id).curto,
      papel.pode_criar ? 'Editor' : 'Usuário',
      f.sensivel ? 'com sensível' : 'sem sensível',
    ].join(' · ');
  };

  const original = pessoa ? formularioDe(pessoa) : null;
  const mudou = Boolean(
    forma && original && JSON.stringify(forma) !== JSON.stringify(original),
  );

  const salvar = async () => {
    if (!pessoa || !forma || barreira) return;
    definirSalvando(true);
    definirErroDoSalvar(null);
    try {
      await concederAcesso(pessoa.id, montarConcessao(pessoa, forma));
      definirConfirmado(`Acesso de ${pessoa.nome} salvo: ${resumo(forma)}.`);
      await carregar();
    } catch (falha) {
      //: A MENSAGEM VEM DO BACKEND — "Acesso externo exige prazo", "Frente
      //: desconhecida: X", "O acesso desta pessoa mudou enquanto o formulário
      //: estava aberto". Escrever outra aqui esconderia a que explica.
      definirErroDoSalvar(
        falha instanceof Error ? falha.message : 'Falha ao salvar o acesso.',
      );
    } finally {
      definirSalvando(false);
    }
  };

  /** Trocar de pessoa com alteração pendente pergunta antes de descartar. */
  const irPara = (id: string) => {
    if (mudou && id !== selecionada) {
      definirADescartar(id);
      return;
    }
    definirSelecionada(id);
  };

  return (
    <>
      <Secao
        titulo="Gerenciamento de perfis"
        subtitulo="Quem entra, o que faz lá dentro, e o que enxerga dos registros."
        nivelDoTitulo={1}
      >
        <div style={grade}>
          {/* -- coluna esquerda: as pessoas ---------------------------------- */}
          <div style={cartao}>
            <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--borda)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Usuários</h2>
                <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
                  {lista.length} de {pessoas?.length ?? 0}
                </span>
              </div>

              <input
                style={{ ...estiloDeEntrada, marginTop: 10 }}
                value={busca}
                onChange={(e) => definirBusca(e.target.value)}
                placeholder="Buscar por nome ou e-mail…"
                aria-label="Buscar usuários"
              />

              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                <Chip
                  rotulo="Todos"
                  ativo={filtro === 'todos'}
                  aoClicar={() => definirFiltro('todos')}
                />
                <Chip
                  rotulo={semNivel ? `Sem nível ${semNivel}` : 'Sem nível'}
                  ativo={filtro === 'sem'}
                  aoClicar={() => definirFiltro('sem')}
                  //: Âmbar quando há alguém esperando. É a única informação
                  //: desta coluna que pede ação de quem abriu a tela.
                  fundo={semNivel && filtro !== 'sem' ? 'var(--atencao-bg)' : undefined}
                  texto={semNivel && filtro !== 'sem' ? 'var(--atencao-fg)' : undefined}
                />
                {NIVEIS.map((n) => (
                  <Chip
                    key={n.id}
                    rotulo={n.curto}
                    ativo={filtro === n.id}
                    aoClicar={() => definirFiltro(n.id)}
                  />
                ))}
              </div>
            </div>

            <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
              {lista.length === 0 ? (
                <Vazio
                  mensagem="Nenhum usuário com esse filtro."
                  acao={
                    <Botao
                      variante="secundario"
                      aoClicar={() => {
                        definirBusca('');
                        definirFiltro('todos');
                      }}
                    >
                      Limpar filtros
                    </Botao>
                  }
                />
              ) : (
                lista.map((p) => (
                  <LinhaDaPessoa
                    key={p.id}
                    pessoa={p}
                    catalogo={catalogo}
                    selecionada={p.id === selecionada}
                    aoClicar={() => irPara(p.id)}
                  />
                ))
              )}
            </div>

            <div style={rodapeDaLista}>
              Usuários entram pelo SSO corporativo (Microsoft Entra). Novos
              acessos aparecem aqui sem nível até serem classificados.
            </div>
          </div>

          {/* -- coluna direita: o perfil ------------------------------------- */}
          {!pessoa || !forma ? (
            <div style={cartao}>
              <Vazio mensagem="Escolha alguém na lista para ver e definir o acesso." />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Cabecalho pessoa={pessoa} catalogo={catalogo} />

              {!pessoa.ativo && (
                <FaixaDeAtencao
                  mensagem={
                    <span>
                      <strong>Conta desativada.</strong> Ela não entra, mesmo com
                      nível definido. Reative abaixo para o acesso voltar a valer.
                    </span>
                  }
                />
              )}

              {souEu && (
                <FaixaDeAtencao
                  mensagem="Ninguém altera o próprio acesso. Peça a outra pessoa da coordenação — o servidor recusa esta alteração."
                />
              )}

              {papelForaDosNiveis && (
                <FaixaDeAtencao
                  mensagem={
                    <span>
                      Esta pessoa tem o papel <strong>{papelForaDosNiveis.nome}</strong>,
                      que não corresponde a nenhum dos cinco níveis — nenhum deles
                      aparece marcado abaixo, e isso <strong>não</strong> quer dizer
                      que ela esteja sem acesso. Escolher um nível vai TROCAR o
                      papel dela.
                    </span>
                  }
                />
              )}

              {/* 1. NÍVEL */}
              <Bloco
                titulo="Nível de acesso"
                legenda="um nível por usuário · do mais amplo ao mais restrito"
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {NIVEIS.map((n) => (
                    <Opcao
                      key={n.id}
                      marcada={nivelEscolhido === n.id}
                      desabilitada={souEu || !concediveis.has(n.id)}
                      aoClicar={() => escolherNivel(n.id)}
                      titulo={n.nome}
                      etiqueta={n.etiqueta}
                      emConstrucao={n.emConstrucao && !mercadoLancado}
                      descricao={n.descricao}
                      aDireita={`${contarNoNivel(pessoas ?? [], catalogo, n.id)} ${
                        contarNoNivel(pessoas ?? [], catalogo, n.id) === 1
                          ? 'usuário'
                          : 'usuários'
                      }`}
                      indisponivel={
                        !concediveis.has(n.id)
                          ? 'Não há papel cadastrado para este nível.'
                          : undefined
                      }
                    />
                  ))}

                  <Opcao
                    marcada={semNivelEscolhido}
                    desabilitada={souEu}
                    aoClicar={removerNivel}
                    titulo="Sem nível"
                    etiqueta="Remove o acesso"
                    descricao="A pessoa continua existindo e o histórico dela permanece atribuído — mas não alcança painel nenhum. Prazo e escopo são apagados."
                  />
                </div>
              </Bloco>

              {/* 2. PAPEL */}
              <Bloco
                titulo="Papel nos painéis"
                legenda={
                  semNivelEscolhido
                    ? 'escolha um nível primeiro'
                    : ehAdmin
                      ? 'não se aplica a administradores'
                      : 'o que a pessoa pode fazer dentro dos painéis liberados'
                }
              >
                <div style={duasColunas}>
                  <Opcao
                    marcada={!camadasDesligadas && editorEscolhido}
                    desabilitada={camadasDesligadas || souEu}
                    aoClicar={() => escolherPapel(true)}
                    titulo="Editor"
                    descricao="Vê, cadastra, edita e exporta. Nos KPIs, também ajusta a calibração."
                  />
                  <Opcao
                    marcada={!camadasDesligadas && !editorEscolhido}
                    desabilitada={camadasDesligadas || souEu}
                    aoClicar={() => escolherPapel(false)}
                    titulo="Usuário"
                    descricao="Só consulta e exporta. Não cadastra, não edita, não calibra."
                  />
                </div>
                {ehAdmin && (
                  <p style={nota}>
                    Administradores podem tudo em todos os painéis — o papel não
                    se aplica.
                  </p>
                )}
              </Bloco>

              {/* 3. SENSÍVEL */}
              <Bloco
                titulo="Informação sensível"
                legenda={
                  semNivelEscolhido
                    ? 'escolha um nível primeiro'
                    : ehAdmin
                      ? 'não se aplica a administradores'
                      : 'terceira camada: vale para editores e usuários'
                }
              >
                <div style={duasColunas}>
                  <Opcao
                    marcada={!camadasDesligadas && forma.sensivel}
                    desabilitada={camadasDesligadas || souEu}
                    aoClicar={() => ajustar({ sensivel: true })}
                    titulo="Com acesso a informação sensível"
                    descricao="Vê relato, encaminhamentos, posicionamento interno, pendências e observações dos registros."
                  />
                  <Opcao
                    marcada={!camadasDesligadas && !forma.sensivel}
                    desabilitada={camadasDesligadas || souEu}
                    aoClicar={() => ajustar({ sensivel: false })}
                    titulo="Sem acesso a informação sensível"
                    descricao="Vê os registros com esses campos ocultos: só data, contraparte, pauta, situação, temas e indicadores."
                  />
                </div>
                <div style={notaAmbar}>
                  {semNivelEscolhido
                    ? 'Defina o nível de acesso acima para liberar esta camada.'
                    : ehAdmin
                      ? 'Administradores veem toda a informação sensível.'
                      : 'Campos sensíveis hoje: relato, encaminhamentos, posicionamento, pendências e observações — e, nas consultas recebidas, remetente, teor e motivo. Esconder o campo também o tira da busca livre: sem isso, o conteúdo seria descoberto por tentativa e erro.'}
                </div>
              </Bloco>

              {/* 4. ALCANCE E PRAZO — o que a tela antiga administrava */}
              <Bloco
                titulo="Alcance e prazo"
                legenda="a exceção, não a regra — a maioria das concessões não mexe aqui"
              >
                <AlcanceEPrazo
                  forma={forma}
                  desabilitado={souEu || semNivelEscolhido}
                  ajustar={ajustar}
                />
              </Bloco>

              {/* 5. O QUE O NÍVEL LIBERA */}
              <Bloco
                titulo="O que este nível libera"
                legenda="recalculado a cada clique, antes de salvar"
              >
                <div style={quatroColunas}>
                  {MODULOS.map((m) => {
                    const estado = estadoDoModulo(
                      m.id,
                      nivelEscolhido,
                      editorEscolhido,
                      mercadoLancado,
                    );
                    return (
                      <div key={m.id} style={cartaoDoModulo(estado)}>
                        <span style={chipDoEstado(estado)}>{ROTULO_DO_ESTADO[estado]}</span>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            marginTop: 8,
                            color:
                              estado === 'sem-acesso' ? 'var(--texto-placeholder)' : 'var(--cinza-4)',
                          }}
                        >
                          {m.nome}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--cinza-2)', marginTop: 4, lineHeight: 1.5 }}>
                          {m.descricao}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Bloco>

              {/* 6. BARRA DE AÇÃO */}
              <div style={barraDeAcao}>
                <div style={{ fontSize: 13, minWidth: 0 }}>
                  {erroDoSalvar ? (
                    <span style={{ color: 'var(--erro-fg)' }}>{erroDoSalvar}</span>
                  ) : barreira ? (
                    <span style={{ color: 'var(--erro-fg)' }}>{barreira}</span>
                  ) : confirmado ? (
                    <span style={{ color: 'var(--ok-fg)' }}>{confirmado}</span>
                  ) : mudou ? (
                    <span style={{ color: 'var(--atencao-fg)' }}>
                      Alteração pendente: {resumo(original)} → {resumo(forma)}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--cinza-2)' }}>Nenhuma alteração pendente</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Botao variante="fantasma" aoClicar={() => definirEmHistorico(pessoa)}>
                    Histórico
                  </Botao>
                  {pessoa.ativo ? (
                    <Botao
                      variante="secundario"
                      desabilitado={souEu}
                      titulo={souEu ? 'Ninguém desativa a própria conta.' : undefined}
                      aoClicar={() => definirADesativar(pessoa)}
                    >
                      Desativar
                    </Botao>
                  ) : (
                    <Botao
                      variante="secundario"
                      aoClicar={async () => {
                        try {
                          await definirSituacaoDeAcesso(pessoa.id, true);
                          await carregar();
                        } catch (falha) {
                          definirErroDoSalvar(
                            falha instanceof Error ? falha.message : 'Falha ao reativar.',
                          );
                        }
                      }}
                    >
                      Reativar
                    </Botao>
                  )}
                  <Botao
                    variante="secundario"
                    desabilitado={!mudou}
                    aoClicar={() => {
                      definirForma(formularioDe(pessoa));
                      definirErroDoSalvar(null);
                    }}
                  >
                    Desfazer
                  </Botao>
                  <Botao
                    aoClicar={salvar}
                    desabilitado={!mudou || salvando || Boolean(barreira) || souEu}
                    titulo={barreira ?? undefined}
                  >
                    {salvando ? 'Salvando…' : 'Salvar alteração'}
                  </Botao>
                </div>
              </div>
            </div>
          )}
        </div>
      </Secao>

      {emHistorico && (
        <Historico pessoa={emHistorico} aoFechar={() => definirEmHistorico(null)} />
      )}

      {aDesativar && (
        <ConfirmarDesativacao
          pessoa={aDesativar}
          aoFechar={() => definirADesativar(null)}
          aoConfirmar={async () => {
            definirADesativar(null);
            await carregar();
          }}
        />
      )}

      {aDescartar && (
        <Modal
          titulo="Descartar alteração?"
          aoFechar={() => definirADescartar(null)}
          largura={460}
          rodape={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Botao variante="secundario" aoClicar={() => definirADescartar(null)}>
                Continuar editando
              </Botao>
              <Botao
                aoClicar={() => {
                  definirSelecionada(aDescartar);
                  definirADescartar(null);
                }}
              >
                Descartar
              </Botao>
            </div>
          }
        >
          <p style={{ fontSize: 13, color: 'var(--cinza-3)', margin: 0 }}>
            A alteração pendente de <strong>{pessoa?.nome}</strong> não foi
            salva. Trocar de pessoa agora a descarta.
          </p>
        </Modal>
      )}
    </>
  );
}

/* -- as peças ------------------------------------------------------------- */

function nivelPor(id: NivelId): Nivel {
  return NIVEIS.find((n) => n.id === id) ?? NIVEIS[0];
}

function contarNoNivel(
  pessoas: readonly Acesso[],
  catalogo: readonly PapelDisponivel[],
  id: NivelId,
): number {
  return pessoas.filter((p) => {
    const papel = catalogo.find((x) => x.codigo === p.papel);
    return papel ? nivelDoPapel(papel) === id : false;
  }).length;
}

function iniciais(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase();
}

/** Como o acesso de alguém se lê numa linha. */
function descricaoCurta(
  pessoa: Acesso,
  catalogo: readonly PapelDisponivel[],
): { nivel: string; detalhe: string } {
  const papel = catalogo.find((x) => x.codigo === pessoa.papel);
  if (!papel) return { nivel: 'Sem nível', detalhe: '' };

  const id = nivelDoPapel(papel);
  if (id === null) return { nivel: papel.nome, detalhe: 'fora dos cinco níveis' };
  if (id === 'admin') return { nivel: 'Administrador', detalhe: 'acesso total' };

  return {
    nivel: nivelPor(id).curto,
    detalhe: `${papel.pode_criar ? 'editor' : 'usuário'} · ${
      pessoa.sensivel ? 'com sensível' : 'sem sensível'
    }`,
  };
}

function LinhaDaPessoa({
  pessoa,
  catalogo,
  selecionada,
  aoClicar,
}: {
  pessoa: Acesso;
  catalogo: readonly PapelDisponivel[];
  selecionada: boolean;
  aoClicar: () => void;
}) {
  const { nivel, detalhe } = descricaoCurta(pessoa, catalogo);
  const semPapel = !pessoa.papel;

  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-current={selecionada ? 'true' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        width: '100%',
        textAlign: 'left',
        border: 'none',
        borderBottom: '1px solid var(--bg-app)',
        cursor: 'pointer',
        background: selecionada ? 'var(--bg-trilho)' : 'var(--branco)',
        boxShadow: selecionada ? 'inset 3px 0 0 var(--azul-mar)' : undefined,
        //: Conta desativada fica legível e apagada. Esconder seria pior: é
        //: justamente quem alguém pode precisar reativar.
        opacity: pessoa.ativo ? 1 : 0.55,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
          background: selecionada ? 'var(--azul-mar)' : 'var(--bg-trilho)',
          color: selecionada ? 'var(--branco)' : 'var(--azul-mar)',
        }}
      >
        {iniciais(pessoa.nome)}
      </span>

      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 13, fontWeight: 700, ...cortaTexto }}>
          {pessoa.nome}
          {!pessoa.ativo && (
            <span style={{ fontWeight: 400, color: 'var(--cinza-2)' }}> · desativada</span>
          )}
        </span>
        <span style={{ fontSize: 12, color: 'var(--cinza-2)', ...cortaTexto }}>
          {pessoa.email}
        </span>
      </span>

      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 'var(--r-chip)',
            whiteSpace: 'nowrap',
            background: semPapel ? 'var(--atencao-bg)' : 'var(--bg-trilho)',
            color: semPapel ? 'var(--atencao-fg)' : 'var(--cinza-3)',
          }}
        >
          {nivel}
        </span>
        {detalhe && (
          <span style={{ fontSize: 10, color: 'var(--cinza-2)', whiteSpace: 'nowrap' }}>
            {detalhe}
          </span>
        )}
      </span>
    </button>
  );
}

function Cabecalho({
  pessoa,
  catalogo,
}: {
  pessoa: Acesso;
  catalogo: readonly PapelDisponivel[];
}) {
  const { nivel, detalhe } = descricaoCurta(pessoa, catalogo);

  return (
    <div
      style={{
        background: 'var(--azul-mar)',
        color: 'var(--branco)',
        borderRadius: 'var(--r-card)',
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span
          aria-hidden
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: 'var(--turquesa-rio)',
            color: 'var(--sobre-turquesa)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {iniciais(pessoa.nome)}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{pessoa.nome}</div>
          <div style={{ fontSize: 12, color: 'var(--turquesa-sombra)', ...cortaTexto }}>
            {pessoa.email}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--turquesa-sombra)',
          }}
        >
          Nível atual
        </span>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{nivel}</span>
        {detalhe && (
          <span style={{ fontSize: 12, color: 'var(--turquesa-sombra)' }}>{detalhe}</span>
        )}
        {pessoa.concedido_em && (
          <span style={{ fontSize: 11, color: 'var(--turquesa-claro)' }}>
            definido em {dataCompleta(pessoa.concedido_em)}
            {pessoa.concedido_por ? ` por ${pessoa.concedido_por}` : ''}
          </span>
        )}
      </div>
    </div>
  );
}

function Bloco({
  titulo,
  legenda,
  children,
}: {
  titulo: string;
  legenda: string;
  children: ReactNode;
}) {
  return (
    <div style={{ ...cartao, padding: '16px 18px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{titulo}</h2>
        <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>{legenda}</span>
      </div>
      {children}
    </div>
  );
}

/** Uma escolha única, no formato do protótipo: marca, título, descrição.
 *
 *  `button` e não `input[type=radio]`: o alvo de clique é o cartão inteiro, e
 *  `aria-pressed` diz o estado a quem usa leitor de tela. Um radio de verdade
 *  exigiria `fieldset`/`legend` por grupo — o que seria melhor, e fica anotado;
 *  o que não dá é um alvo de 18px no canto.
 */
function Opcao({
  marcada,
  desabilitada,
  aoClicar,
  titulo,
  etiqueta,
  descricao,
  aDireita,
  emConstrucao,
  indisponivel,
}: {
  marcada: boolean;
  desabilitada?: boolean;
  aoClicar: () => void;
  titulo: string;
  etiqueta?: string;
  descricao: string;
  aDireita?: string;
  emConstrucao?: boolean;
  indisponivel?: string;
}) {
  return (
    <button
      type="button"
      onClick={desabilitada ? undefined : aoClicar}
      aria-pressed={marcada}
      disabled={desabilitada}
      title={indisponivel}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '11px 12px',
        width: '100%',
        textAlign: 'left',
        borderRadius: 'var(--r-card-int)',
        background: 'var(--branco)',
        border: `1px solid ${marcada ? 'var(--azul-mar)' : 'var(--borda)'}`,
        boxShadow: marcada ? '0 0 0 2px rgba(0, 39, 189, 0.12)' : undefined,
        cursor: desabilitada ? 'default' : 'pointer',
        opacity: desabilitada ? 0.45 : 1,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          flexShrink: 0,
          marginTop: 2,
          border: `2px solid ${marcada ? 'var(--azul-mar)' : 'var(--borda-input)'}`,
          background: marcada ? 'var(--azul-mar)' : 'var(--branco)',
          boxShadow: marcada ? 'inset 0 0 0 2.5px var(--branco)' : undefined,
        }}
      />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cinza-4)' }}>{titulo}</span>
          {etiqueta && <span style={etiquetaPequena}>{etiqueta}</span>}
          {emConstrucao && (
            <span style={{ ...etiquetaPequena, background: 'var(--atencao-bg)', color: 'var(--atencao-fg)' }}>
              em construção
            </span>
          )}
        </span>
        <span style={{ fontSize: 12, color: 'var(--cinza-2)', lineHeight: 1.5 }}>{descricao}</span>
        {indisponivel && (
          <span style={{ fontSize: 12, color: 'var(--erro-fg)' }}>{indisponivel}</span>
        )}
      </span>
      {aDireita && (
        <span style={{ fontSize: 12, color: 'var(--cinza-2)', whiteSpace: 'nowrap' }}>
          {aDireita}
        </span>
      )}
    </button>
  );
}

/** Prazo, externo e escopo — o que só a tela antiga administrava. */
function AlcanceEPrazo({
  forma,
  desabilitado,
  ajustar,
}: {
  forma: Formulario;
  desabilitado: boolean;
  ajustar: (mudanca: Partial<Formulario>) => void;
}) {
  if (desabilitado && !forma.papel) {
    return (
      <p style={nota}>
        Sem nível não há alcance a definir. Prazo e escopo são apagados quando o
        nível é removido — guardar o alcance de quem não tem acesso é guardar uma
        surpresa para quem conceder nível depois.
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <label style={caixaDeSelecao}>
        <input
          type="checkbox"
          checked={forma.externo}
          disabled={desabilitado}
          onChange={(e) =>
            //: Externo e irrestrito não se combinam — o banco recusa. Desmarcar
            //: junto evita preencher o resto para descobrir isso no fim.
            ajustar({ externo: e.target.checked, irrestrito: false })
          }
        />
        <span>
          <strong>É de fora da Aegea</strong>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--cinza-2)' }}>
            Exige prazo. O esquecimento de revogar vira expiração, em vez de
            acesso eterno.
          </span>
        </span>
      </label>

      {forma.externo && (
        <Campo rotulo="Vence em" dica="Obrigatório para quem é de fora.">
          <input
            type="date"
            value={forma.expira}
            disabled={desabilitado}
            onChange={(e) => ajustar({ expira: e.target.value })}
            style={estiloDeEntrada}
          />
          <Prazo ate={forma.expira || null} />
        </Campo>
      )}

      {!forma.externo && (
        <label style={caixaDeSelecao}>
          <input
            type="checkbox"
            checked={forma.irrestrito}
            disabled={desabilitado}
            onChange={(e) => ajustar({ irrestrito: e.target.checked })}
          />
          <span>
            <strong>Alcança todos os registros</strong>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--cinza-2)' }}>
              Desmarcado, a pessoa só vê as frentes e unidades listadas abaixo.
            </span>
          </span>
        </label>
      )}

      {!forma.irrestrito && (
        <>
          <Campo
            rotulo="Frentes"
            dica="Separadas por vírgula. Vazias e sem alcance total: não vê nada."
          >
            <input
              value={forma.frentes}
              disabled={desabilitado}
              onChange={(e) => ajustar({ frentes: e.target.value })}
              placeholder="imprensa, governo"
              style={estiloDeEntrada}
            />
          </Campo>

          {/* As unidades são editáveis, e não só reenviadas: o formulário manda
              o estado COMPLETO do alcance, então esconder metade dele faria a
              tela parecer definir uma coisa e definir outra. */}
          <Campo rotulo="Unidades de negócio" dica="Separadas por vírgula.">
            <input
              value={forma.unidades}
              disabled={desabilitado}
              onChange={(e) => ajustar({ unidades: e.target.value })}
              placeholder="Prolagos, Águas de Timon"
              style={estiloDeEntrada}
            />
          </Campo>

          {listaDe(forma.frentes).length === 0 &&
            listaDe(forma.unidades).length === 0 && (
              <div style={notaAmbar}>
                Sem alcance total e sem nenhuma frente ou unidade, a pessoa tem
                nível e <strong>não vê registro nenhum</strong>. É o estado que
                mais confunde quem recebe o acesso.
              </div>
            )}
        </>
      )}
    </div>
  );
}

function Prazo({ ate }: { ate: string | null }) {
  if (!ate) return null;

  const faltam = -diasDesde(ate);
  const vencido = faltam < 0;
  const perto = faltam >= 0 && faltam <= DIAS_DE_ALERTA;

  return (
    <span
      style={{
        fontSize: 12,
        color: vencido || perto ? 'var(--erro-fg)' : 'var(--cinza-2)',
      }}
    >
      {vencido ? 'já vencido' : `faltam ${faltam} dias`}
    </span>
  );
}

function Historico({ pessoa, aoFechar }: { pessoa: Acesso; aoFechar: () => void }) {
  const [linhas, definirLinhas] = useState<TrilhaDeAcesso[] | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  //: FALHA NÃO É VAZIO. Dizer "nenhuma alteração registrada" a partir de uma
  //: requisição que não voltou é uma afirmação sobre a trilha de auditoria de
  //: uma pessoa. Num histórico de acesso, "não houve mudança" e "não consegui
  //: ler" são respostas opostas.
  useEffect(
    function carregarHistoricoDaPessoa() {
      definirErro(null);
      historicoDeAcesso(pessoa.id)
        .then(definirLinhas)
        .catch((falha) =>
          definirErro(
            falha instanceof Error ? falha.message : 'Falha ao carregar o histórico.',
          ),
        );
    },
    [pessoa.id],
  );

  return (
    <Modal titulo={`Histórico de ${pessoa.nome}`} aoFechar={aoFechar}>
      {erro && <FaixaDeErro mensagem={erro} />}
      {!erro && !linhas && <Carregando rotulo="Carregando histórico…" />}
      {linhas?.length === 0 && <Vazio mensagem="Nenhuma alteração registrada." />}
      {linhas && linhas.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Quando', 'Campo', 'De', 'Para', 'Quem', 'Origem'].map((t) => (
                <th key={t} style={celulaDeCabecalho}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, indice) => (
              <tr key={`${linha.ocorrido_em}-${linha.campo}-${indice}`}>
                <td style={celula}>{dataCompleta(linha.ocorrido_em)}</td>
                <td style={celula}>{linha.campo}</td>
                <td style={celula}>{linha.valor_anterior ?? '—'}</td>
                <td style={celula}>{linha.valor_novo ?? '—'}</td>
                <td style={celula}>
                  {/* Nulo aqui significa alteração feita FORA da aplicação, e
                      `origem` diz por qual conta de banco. A distinção é o
                      ponto da trilha: nulo é sinal de incidente, não de dado
                      faltando. */}
                  {linha.concedido_por ?? (
                    <span style={{ color: 'var(--erro-fg)' }}>fora da aplicação</span>
                  )}
                </td>
                <td style={celula}>{linha.origem ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

/** A confirmação de desativar, com o nome digitado.
 *
 *  Religar é reversível e vai direto. Desligar tira o acesso de alguém no meio
 *  do expediente, e digitar o nome é o que separa "cliquei na linha errada" de
 *  "decidi desativar esta pessoa".
 */
function ConfirmarDesativacao({
  pessoa,
  aoFechar,
  aoConfirmar,
}: {
  pessoa: Acesso;
  aoFechar: () => void;
  aoConfirmar: () => void | Promise<void>;
}) {
  const [digitado, definirDigitado] = useState('');
  const [erro, definirErro] = useState<string | null>(null);
  const [emCurso, definirEmCurso] = useState(false);

  const confere = digitado.trim().toLocaleLowerCase('pt-BR') === pessoa.nome.toLocaleLowerCase('pt-BR');

  return (
    <Modal
      titulo={`Desativar ${pessoa.nome}?`}
      aoFechar={aoFechar}
      largura={520}
      rodape={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Botao variante="secundario" aoClicar={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            desabilitado={!confere || emCurso}
            aoClicar={async () => {
              definirEmCurso(true);
              definirErro(null);
              try {
                await definirSituacaoDeAcesso(pessoa.id, false);
                await aoConfirmar();
              } catch (falha) {
                definirErro(falha instanceof Error ? falha.message : 'Falha ao desativar.');
                definirEmCurso(false);
              }
            }}
          >
            {emCurso ? 'Desativando…' : 'Desativar'}
          </Botao>
        </div>
      }
    >
      {erro && <FaixaDeErro mensagem={erro} />}
      <p style={{ fontSize: 13, color: 'var(--cinza-3)', lineHeight: 1.6 }}>
        A pessoa deixa de entrar imediatamente. Ninguém é apagado: o histórico
        dela continua atribuído, e reativar devolve o acesso que ela tinha.
      </p>
      <Campo rotulo={`Digite o nome para confirmar`} dica={pessoa.nome}>
        <input
          value={digitado}
          onChange={(e) => definirDigitado(e.target.value)}
          style={estiloDeEntrada}
          autoComplete="off"
        />
      </Campo>
    </Modal>
  );
}

/* -- estilos -------------------------------------------------------------- */

const grade: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(260px, 0.85fr) minmax(360px, 1.35fr)',
  gap: 14,
  alignItems: 'start',
};

const cartao: CSSProperties = {
  background: 'var(--branco)',
  border: '1px solid var(--borda)',
  borderRadius: 'var(--r-card)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const rodapeDaLista: CSSProperties = {
  padding: '10px 14px',
  borderTop: '1px solid var(--borda)',
  background: 'var(--bg-rodape-card)',
  fontSize: 12,
  color: 'var(--cinza-2)',
  lineHeight: 1.5,
};

const duasColunas: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
  gap: 8,
};

const quatroColunas: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: 8,
};

const barraDeAcao: CSSProperties = {
  ...cartao,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  padding: '12px 18px',
};

const nota: CSSProperties = {
  margin: '10px 0 0',
  padding: '10px 12px',
  background: 'var(--bg-trilho)',
  borderRadius: 'var(--r-card-int)',
  fontSize: 12,
  color: 'var(--azul-mar)',
  lineHeight: 1.5,
};

const notaAmbar: CSSProperties = {
  marginTop: 10,
  padding: '10px 12px',
  background: 'var(--atencao-bg)',
  borderRadius: 'var(--r-card-int)',
  fontSize: 12,
  color: 'var(--atencao-fg)',
  lineHeight: 1.5,
};

const etiquetaPequena: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  padding: '2px 6px',
  borderRadius: 'var(--r-chip)',
  background: 'var(--bg-trilho)',
  color: 'var(--azul-mar)',
};

const caixaDeSelecao: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 9,
  fontSize: 13,
  color: 'var(--cinza-3)',
  cursor: 'pointer',
};

const cortaTexto: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const celulaDeCabecalho: CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid var(--borda)',
  fontSize: 12,
  color: 'var(--cinza-2)',
  fontWeight: 700,
};

const celula: CSSProperties = { padding: '8px 10px', verticalAlign: 'top' };

function cartaoDoModulo(estado: EstadoDoModulo): CSSProperties {
  const fechado = estado === 'sem-acesso';
  return {
    borderRadius: 'var(--r-card-int)',
    padding: 12,
    border: `1px solid ${fechado ? 'var(--bg-trilho)' : 'var(--borda)'}`,
    background: fechado ? 'var(--bg-rodape-card)' : 'var(--branco)',
  };
}

function chipDoEstado(estado: EstadoDoModulo): CSSProperties {
  const cores: Record<EstadoDoModulo, [string, string]> = {
    'sem-acesso': ['var(--bg-app)', 'var(--cinza-2)'],
    'ao-lancar': ['var(--atencao-bg)', 'var(--atencao-fg)'],
    consulta: ['var(--ok-bg)', 'var(--ok-fg)'],
    editor: ['var(--ok-bg)', 'var(--ok-fg)'],
    total: ['var(--azul-mar)', 'var(--branco)'],
  };
  const [fundo, texto] = cores[estado];
  return {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    padding: '2px 6px',
    borderRadius: 'var(--r-chip)',
    whiteSpace: 'nowrap',
    background: fundo,
    color: texto,
  };
}
