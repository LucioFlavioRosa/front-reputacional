/** Cadastro dos assuntos.
 *
 *  POR QUE ESTA TELA EXISTE
 *  ------------------------
 *  O assunto é o que o painel consegue somar. A pauta descreve uma agenda em
 *  palavras e não se agrega; o tema classifica, e é dele que saem "quantas
 *  agendas de reajuste tarifário este trimestre" e a lista do que cada
 *  porta-voz pode falar.
 *
 *  Os temas vinham da planilha e ficavam. Um assunto novo — uma pauta que
 *  surge no ano — não tinha como entrar.
 *
 *  DESATIVAR, E NÃO APAGAR. Um assunto pode estar em agendas antigas, e
 *  apagá-lo as deixaria sem classificação. Desativado, ele some do filtro e do
 *  formulário e continua nomeando o que já foi registrado.
 */

import { useEffect, useMemo, useState } from 'react';
import { criarTema, editarTema, listarTemas, obterDicionarios } from '@/api/cliente';
import type { TemaCadastrado } from '@/api/cliente';
import type { BlocoTema, MacroTema, Risco, RiskCluster } from '@/dominio/tipos';
import {
  Botao,
  Campo,
  Carregando,
  Cartao,
  FaixaDeErro,
  Secao,
  Selo,
  estiloDeEntrada,
} from '@/componentes/basicos';

/** Legitimidade / Credibilidade / Confiança / Não se aplica — a dimensão da
 *  taxonomia v4 que diz QUE TIPO de reputação o tema afeta: o direito de
 *  operar, o cumprir o que promete, ou a relação de longo prazo. Ver
 *  `migrations/0053`/`0058`. */
const LSO = [
  { valor: '', rotulo: '— sem classificação —' },
  { valor: 'legitimidade', rotulo: 'Legitimidade' },
  { valor: 'credibilidade', rotulo: 'Credibilidade' },
  { valor: 'confianca', rotulo: 'Confiança' },
  { valor: 'nao_se_aplica', rotulo: 'Não se aplica' },
];

//: Rótulo de cada severidade — a matriz da Aegea já vem com "Critico" sem
//: acento (ver migration 0059); o acento é só de exibição.
const SEVERIDADE_ROTULO: Record<string, string> = {
  critico: 'Crítico',
  alto: 'Alto',
  moderado: 'Moderado',
};

//: SELO EM VEZ DE TEXTO ENTRE PARÊNTESES: a severidade é o dado mais
//: importante pra quem está classificando um risco, e texto pequeno dentro
//: de um `<details>` fechado passava batido. Semáforo, com as cores da
//: marca: vermelho = crítico, laranja = alto, amarelo = moderado.
const SEVERIDADE_SELO: Record<string, { fundo: string; texto: string }> = {
  critico: { fundo: 'var(--vermelho-pitanga)', texto: 'var(--branco)' },
  alto: { fundo: 'var(--laranja-baia)', texto: 'var(--sobre-turquesa)' },
  moderado: { fundo: 'var(--amarelo-pequi)', texto: 'var(--sobre-turquesa)' },
};

/** Os três níveis, do mais restrito ao mais aberto.
 *
 *  O SENSÍVEL É O QUE A ÁREA USA PARA DECIDIR QUEM FALA. Sem ele, "reajuste
 *  tarifário" e "patrocínio de corrida" moram na mesma gaveta.
 *
 *  A ORDEM É A DO CUIDADO, e não a alfabética: quem abre a lista lê primeiro o
 *  que exige mais, e o que exige menos fica por último — que é também o padrão
 *  de quem cadastra sem pensar no campo.
 *
 *  `gerais` se chamava `livre` até a migração 0022, no rótulo e no código.
 */
const NIVEIS = [
  {
    valor: 'sensivel',
    rotulo: 'Sensível',
    ajuda: 'Exige alinhamento antes de alguém falar.',
  },
  { valor: 'estrategico', rotulo: 'Estratégico', ajuda: 'Prioridade estratégica da companhia.' },
  { valor: 'gerais', rotulo: 'Gerais', ajuda: 'O que aparece sem ter sido planejado.' },
];

//: Selo de cada nível, com cor PRÓPRIA — antes só "estratégico" tinha cor de
//: marca, e os outros dois dividiam o mesmo cinza claro, ficando idênticos
//: entre si e "menores" ao lado do turquesa sólido (mesmo tamanho de caixa,
//: mas o contraste fraco lia como menor). As três cores e seus textos vêm de
//: `frentes.ts`/`index.css` já com a razão de contraste WCAG conferida:
//: Amarelo Pequi e Turquesa Rio só passam com texto escuro (`--sobre-turquesa`,
//: medido para o turquesa e igualmente válido para o amarelo — os dois
//: exigem o mesmo tom); Roxo Açaí só passa com branco.
const SELO_DO_NIVEL: Record<string, { fundo: string; texto: string }> = {
  sensivel: { fundo: 'var(--amarelo-pequi)', texto: 'var(--sobre-turquesa)' },
  estrategico: { fundo: 'var(--turquesa-rio)', texto: 'var(--sobre-turquesa)' },
  gerais: { fundo: 'var(--roxo-acai)', texto: 'var(--branco)' },
};

/** Um rascunho de tema, no formulário de criar ou de editar.
 *
 *  `bloco_tema_id` É SÓ DA TELA, e nunca vai pro back: o banco guarda só
 *  `macro_tema_id` (nível 2) — o pilar (nível 1) é derivado dele via
 *  `macro_tema.bloco_tema_id`. Ele existe aqui só para filtrar a lista de
 *  temas estratégicos sem o usuário ter de procurar entre os 41.
 */
interface RascunhoDeTema {
  nome: string;
  nivel: string;
  e_risco: boolean;
  bloco_tema_id: number | null;
  macro_tema_id: number | null;
  camada_lso: string;
  riscos: number[];
}

const RASCUNHO_VAZIO: RascunhoDeTema = {
  nome: '',
  nivel: 'gerais',
  e_risco: false,
  bloco_tema_id: null,
  macro_tema_id: null,
  camada_lso: '',
  riscos: [],
};

/** Pilar (N1) → Tema estratégico (N2) → LSO, em cascata.
 *
 *  UMA ÚNICA VEZ, reaproveitado no formulário de criar e no de editar — a
 *  lógica de filtrar os 41 temas estratégicos pelo pilar escolhido não vale a
 *  pena duplicar.
 */
function SeletorDeHierarquia({
  blocos,
  macros,
  rascunho,
  aoMudar,
}: {
  blocos: BlocoTema[];
  macros: MacroTema[];
  rascunho: RascunhoDeTema;
  aoMudar: (novo: RascunhoDeTema) => void;
}) {
  const macrosDoPilar = macros.filter((m) => m.bloco_tema_id === rascunho.bloco_tema_id);
  return (
    <>
      <Campo rotulo="Pilar (N1)" obrigatorio>
        <select
          style={estiloDeEntrada}
          value={rascunho.bloco_tema_id ?? ''}
          onChange={(e) =>
            aoMudar({
              ...rascunho,
              bloco_tema_id: e.target.value ? Number(e.target.value) : null,
              // TROCAR O PILAR DESMARCA O TEMA ESTRATÉGICO: um tema
              // estratégico de outro pilar ficaria selecionado sem aparecer
              // mais na lista — o `<select>` mostraria o id errado como se
              // fosse o primeiro da lista nova, calado.
              macro_tema_id: null,
            })
          }
        >
          <option value="">— selecione —</option>
          {blocos.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nome}
            </option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Tema estratégico (N2)" obrigatorio>
        <select
          style={estiloDeEntrada}
          value={rascunho.macro_tema_id ?? ''}
          disabled={rascunho.bloco_tema_id === null}
          onChange={(e) =>
            aoMudar({
              ...rascunho,
              macro_tema_id: e.target.value ? Number(e.target.value) : null,
            })
          }
        >
          <option value="">— selecione —</option>
          {macrosDoPilar.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="LSO" obrigatorio>
        <select
          style={estiloDeEntrada}
          value={rascunho.camada_lso}
          onChange={(e) => aoMudar({ ...rascunho, camada_lso: e.target.value })}
        >
          {LSO.map((l) => (
            <option key={l.valor} value={l.valor}>
              {l.rotulo}
            </option>
          ))}
        </select>
      </Campo>
    </>
  );
}

/** Quais riscos da matriz corporativa este tema toca — zero, um ou vários.
 *
 *  AGRUPADO POR CLUSTER, e recolhível: 32 riscos numa lista só, sempre
 *  aberta, seria maior que o resto do formulário inteiro. `<details>` nativo,
 *  sem estado próprio — o navegador já lembra o que a pessoa abriu.
 */
function SeletorDeRiscos({
  clusters,
  riscos,
  selecionados,
  aoMudar,
}: {
  clusters: RiskCluster[];
  riscos: Risco[];
  selecionados: number[];
  aoMudar: (novos: number[]) => void;
}) {
  const alternar = (riscoId: number) => {
    aoMudar(
      selecionados.includes(riscoId)
        ? selecionados.filter((id) => id !== riscoId)
        : [...selecionados, riscoId],
    );
  };
  return (
    <Campo rotulo="Risco(s) associado(s)" obrigatorio>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {clusters.map((cluster) => {
          const riscosDoCluster = riscos.filter((r) => r.risk_cluster_id === cluster.id);
          // ABRE SOZINHO QUANDO JÁ TEM ALGO MARCADO: ao editar um tema que
          // já tem risco associado, esconder o cluster escondia a própria
          // resposta de "o que está marcado" atrás de um clique.
          const temSelecionado = riscosDoCluster.some((r) => selecionados.includes(r.id));
          return (
            <details key={cluster.id} open={temSelecionado}>
              <summary style={{ cursor: 'pointer', fontSize: 13, padding: '4px 0' }}>
                {cluster.nome}
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 16 }}>
                {riscosDoCluster.map((risco) => (
                  <label
                    key={risco.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
                  >
                    <input
                      type="checkbox"
                      checked={selecionados.includes(risco.id)}
                      onChange={() => alternar(risco.id)}
                    />
                    <span>{risco.nome}</span>
                    <Selo
                      rotulo={SEVERIDADE_ROTULO[risco.severidade] ?? risco.severidade}
                      fundo={SEVERIDADE_SELO[risco.severidade]?.fundo ?? 'var(--bg-trilho)'}
                      texto={SEVERIDADE_SELO[risco.severidade]?.texto ?? 'var(--cinza-3)'}
                    />
                  </label>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </Campo>
  );
}

export function CadastroDeAssuntos() {
  const [temas, definirTemas] = useState<TemaCadastrado[] | null>(null);
  const [blocos, definirBlocos] = useState<BlocoTema[]>([]);
  const [macros, definirMacros] = useState<MacroTema[]>([]);
  const [clusters, definirClusters] = useState<RiskCluster[]>([]);
  const [riscos, definirRiscos] = useState<Risco[]>([]);
  const [erro, definirErro] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);
  const [novo, definirNovo] = useState<RascunhoDeTema>(RASCUNHO_VAZIO);
  const [emEdicao, definirEmEdicao] = useState<number | null>(null);
  const [rascunho, definirRascunho] = useState<RascunhoDeTema>(RASCUNHO_VAZIO);
  const [busca, definirBusca] = useState('');

  //: A LISTA COMPLETA, e não a do catálogo. O catálogo traz só os ativos,
  //: porque alimenta filtro e formulário; aqui é preciso ver o que foi
  //: desativado — senão o assunto some da tela e reaparece como "já existe" na
  //: próxima tentativa de criar.
  const carregar = () =>
    listarTemas()
      .then(definirTemas)
      .catch((falha: Error) => definirErro(falha.message));

  useEffect(function carregarAssuntos() {
    void carregar();
    // PILARES E TEMAS ESTRATÉGICOS NÃO MUDAM PELA TELA: `/api/dicionarios` é
    // só para preencher o seletor em cascata — não há cadastro de pilar/tema
    // estratégico, só de subtema (a tabela `tema` em si).
    void obterDicionarios().then((d) => {
      definirBlocos(d.blocos_tema);
      definirMacros(d.macro_temas);
      definirClusters(d.risk_clusters);
      definirRiscos(d.riscos);
    });
  }, []);

  const executar = async (acao: () => Promise<unknown>, aoTerminar: () => void) => {
    definirSalvando(true);
    definirErro(null);
    try {
      await acao();
      await carregar();
      // O CATÁLOGO RECARREGA SOZINHO: o cliente da API avisa a cada escrita
      // bem-sucedida numa rota de catálogo, e o estado do painel escuta. Ver
      // `dominio/sincronizacao.ts` — é o que faz o cadastro aparecer no
      // formulário de agenda, nos filtros e na ficha sem esta tela lembrar.
      aoTerminar();
    } catch (falha) {
      definirErro((falha as Error).message);
    } finally {
      definirSalvando(false);
    }
  };

  const temasFiltrados = useMemo(() => {
    if (!temas) return [];
    const termo = busca.trim().toLowerCase();
    if (!termo) return temas;
    return temas.filter((tema) => tema.nome.toLowerCase().includes(termo));
  }, [temas, busca]);

  if (!temas) return <Carregando rotulo="Carregando os temas…" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      <Secao titulo="Cadastrar tema">
        <Cartao>
          <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: '0 0 16px' }}>
            O tema é o que o painel soma. É por ele que se responde "quantas
            agendas sobre reajuste tarifário", e é ele que define o que cada
            porta-voz pode falar.
          </p>
          <div className="grade grade--2" style={{ gap: 16 }}>
            <Campo rotulo="Nome" obrigatorio>
              <input
                style={estiloDeEntrada}
                value={novo.nome}
                onChange={(e) => definirNovo({ ...novo, nome: e.target.value })}
                placeholder="Reajuste tarifário"
              />
            </Campo>
            <Campo
              rotulo="Nível"
              dica={NIVEIS.find((n) => n.valor === novo.nivel)?.ajuda}
            >
              <select
                style={estiloDeEntrada}
                value={novo.nivel}
                onChange={(e) => definirNovo({ ...novo, nivel: e.target.value })}
              >
                {NIVEIS.map((n) => (
                  <option key={n.valor} value={n.valor}>
                    {n.rotulo}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <div className="grade grade--3" style={{ gap: 16, marginTop: 14 }}>
            <SeletorDeHierarquia blocos={blocos} macros={macros} rascunho={novo} aoMudar={definirNovo} />
          </div>
          <div style={{ marginTop: 14 }}>
            <Campo rotulo="Este é um tema de risco?" obrigatorio>
              <input
                type="checkbox"
                checked={novo.e_risco}
                onChange={(e) =>
                  definirNovo({
                    ...novo,
                    e_risco: e.target.checked,
                    // SEM RISCO MARCADO, NÃO FAZ SENTIDO TER RISCO
                    // ASSOCIADO: desmarcar some com o seletor e limpa o que
                    // já tinha sido escolhido, pra não mandar risco escondido.
                    riscos: e.target.checked ? novo.riscos : [],
                  })
                }
              />
            </Campo>
          </div>
          {novo.e_risco ? (
            <div style={{ marginTop: 14 }}>
              <SeletorDeRiscos
                clusters={clusters}
                riscos={riscos}
                selecionados={novo.riscos}
                aoMudar={(riscosNovos) => definirNovo({ ...novo, riscos: riscosNovos })}
              />
            </div>
          ) : null}
          <div style={{ marginTop: 14 }}>
            <Botao
              variante="primario"
              desabilitado={salvando || !novo.nome.trim()}
              aoClicar={() =>
                void executar(
                  () =>
                    criarTema({
                      nome: novo.nome,
                      nivel: novo.nivel,
                      e_risco: novo.e_risco,
                      macro_tema_id: novo.macro_tema_id,
                      camada_lso: novo.camada_lso || null,
                      riscos: novo.riscos,
                    }),
                  () => definirNovo(RASCUNHO_VAZIO),
                )
              }
            >
              {salvando ? 'Salvando…' : 'Cadastrar'}
            </Botao>
          </div>
        </Cartao>
      </Secao>

      <Secao titulo={`Cadastrados (${temas.length})`}>
        <Cartao>
          <input
            style={{ ...estiloDeEntrada, marginBottom: 14 }}
            value={busca}
            onChange={(e) => definirBusca(e.target.value)}
            placeholder="Buscar por nome…"
          />

          {temasFiltrados.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--cinza-2)' }}>
              {busca ? 'Nada com esse termo.' : 'Nenhum tema cadastrado ainda.'}
            </p>
          ) : null}

          {temasFiltrados.map((tema) => (
            <div
              key={tema.id}
              style={{
                paddingTop: 12,
                marginTop: 12,
                borderTop: '1px solid var(--borda)',
              }}
            >
              {emEdicao === tema.id ? (
                <div className="grade grade--2" style={{ gap: 10, alignItems: 'end' }}>
                  <Campo rotulo="Nome">
                    <input
                      style={estiloDeEntrada}
                      value={rascunho.nome}
                      onChange={(e) =>
                        definirRascunho({ ...rascunho, nome: e.target.value })
                      }
                    />
                  </Campo>
                  <Campo rotulo="Nível">
                    <select
                      style={estiloDeEntrada}
                      value={rascunho.nivel}
                      onChange={(e) =>
                        definirRascunho({ ...rascunho, nivel: e.target.value })
                      }
                    >
                      {NIVEIS.map((n) => (
                        <option key={n.valor} value={n.valor}>
                          {n.rotulo}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <SeletorDeHierarquia
                    blocos={blocos}
                    macros={macros}
                    rascunho={rascunho}
                    aoMudar={definirRascunho}
                  />
                  <Campo rotulo="Este é um tema de risco?" obrigatorio>
                    <input
                      type="checkbox"
                      checked={rascunho.e_risco}
                      onChange={(e) =>
                        definirRascunho({
                          ...rascunho,
                          e_risco: e.target.checked,
                          riscos: e.target.checked ? rascunho.riscos : [],
                        })
                      }
                    />
                  </Campo>
                  {rascunho.e_risco ? (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <SeletorDeRiscos
                        clusters={clusters}
                        riscos={riscos}
                        selecionados={rascunho.riscos}
                        aoMudar={(riscosNovos) =>
                          definirRascunho({ ...rascunho, riscos: riscosNovos })
                        }
                      />
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1' }}>
                    <Botao
                      variante="primario"
                      desabilitado={salvando}
                      aoClicar={() =>
                        void executar(
                          () =>
                            editarTema(tema.id, {
                              nome: rascunho.nome,
                              nivel: rascunho.nivel,
                              ativo: tema.ativo,
                              e_risco: rascunho.e_risco,
                              macro_tema_id: rascunho.macro_tema_id,
                              camada_lso: rascunho.camada_lso || null,
                              riscos: rascunho.riscos,
                            }),
                          () => definirEmEdicao(null),
                        )
                      }
                    >
                      Salvar
                    </Botao>
                    <Botao estilo={{ height: 40 }} aoClicar={() => definirEmEdicao(null)}>
                      Cancelar
                    </Botao>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontSize: 14,
                      flex: 1,
                      minWidth: 0,
                      color: tema.ativo ? 'var(--cinza-4)' : 'var(--cinza-2)',
                      textDecoration: tema.ativo ? 'none' : 'line-through',
                    }}
                  >
                    {tema.nome}
                  </span>
                  {/* Cada nível com a própria cor — ver `SELO_DO_NIVEL`. A
                      diferença entre "exige alinhamento", "agenda da
                      companhia" e "o que apareceu" é a leitura mais útil
                      desta lista, e as três precisam se distinguir à
                      primeira vista, não só no hover. */}
                  <Selo
                    rotulo={
                      NIVEIS.find((n) => n.valor === tema.nivel)?.rotulo ?? tema.nivel
                    }
                    fundo={SELO_DO_NIVEL[tema.nivel]?.fundo ?? 'var(--bg-trilho)'}
                    texto={SELO_DO_NIVEL[tema.nivel]?.texto ?? 'var(--cinza-3)'}
                  />
                  {/* SÓ QUANDO É RISCO: `null` (não reconciliado com a
                      taxonomia v4) e `false` (reconciliado, mas não é risco)
                      não precisam de selo — só o `true` muda o que a
                      pessoa faz com o tema. */}
                  {tema.e_risco ? (
                    <Selo rotulo="Risco" fundo="var(--vermelho-pitanga)" texto="var(--branco)" />
                  ) : null}
                  <Botao
                    variante="fantasma"
                    desabilitado={salvando}
                    aoClicar={() => {
                      definirEmEdicao(tema.id);
                      // O PILAR NÃO VEM DO BACK: só `macro_tema_id` é
                      // guardado em `tema`. Pra pré-marcar o seletor em
                      // cascata, acha o tema estratégico pelo id e lê o
                      // `bloco_tema_id` dele.
                      const macro = macros.find((m) => m.id === tema.macro_tema_id);
                      definirRascunho({
                        nome: tema.nome,
                        nivel: tema.nivel,
                        e_risco: tema.e_risco ?? false,
                        bloco_tema_id: macro?.bloco_tema_id ?? null,
                        macro_tema_id: tema.macro_tema_id,
                        camada_lso: tema.camada_lso ?? '',
                        riscos: tema.riscos,
                      });
                    }}
                    rotuloAcessivel={`Editar ${tema.nome}`}
                  >
                    Editar
                  </Botao>
                  {/* DESATIVAR, E NÃO APAGAR. O assunto pode estar em agendas
                      antigas, e apagá-lo as deixaria sem classificação — ou
                      seja, fora de toda contagem que o painel faz. */}
                  <Botao
                    variante="fantasma"
                    desabilitado={salvando}
                    aoClicar={() =>
                      void executar(
                        () =>
                          editarTema(tema.id, {
                            nome: tema.nome,
                            nivel: tema.nivel,
                            ativo: !tema.ativo,
                            e_risco: tema.e_risco,
                          }),
                        () => undefined,
                      )
                    }
                    rotuloAcessivel={`${tema.ativo ? 'Desativar' : 'Reativar'} ${tema.nome}`}
                  >
                    {tema.ativo ? 'Desativar' : 'Reativar'}
                  </Botao>
                </div>
              )}
            </div>
          ))}
        </Cartao>
      </Secao>
    </div>
  );
}
