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

import { useEffect, useState } from 'react';
import { criarTema, editarTema, listarTemas } from '@/api/cliente';
import type { TemaCadastrado } from '@/api/cliente';
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
import { usePainel } from '@/estado/painel';

/** Os três níveis, do mais restrito ao mais aberto.
 *
 *  ERAM DOIS, e faltava o que a área usa para decidir quem fala: o assunto
 *  SENSÍVEL. Sem ele, "reajuste tarifário" e "patrocínio de corrida" moravam
 *  na mesma gaveta.
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
  { valor: 'estrategico', rotulo: 'Estratégico', ajuda: 'Agenda da companhia.' },
  { valor: 'gerais', rotulo: 'Gerais', ajuda: 'O que aparece sem ter sido planejado.' },
];

export function CadastroDeAssuntos() {
  const { recarregar } = usePainel();
  const [temas, definirTemas] = useState<TemaCadastrado[] | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);
  const [novo, definirNovo] = useState({ nome: '', nivel: 'gerais' });
  const [emEdicao, definirEmEdicao] = useState<number | null>(null);
  const [rascunho, definirRascunho] = useState({ nome: '', nivel: 'gerais' });

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
  }, []);

  const executar = async (acao: () => Promise<unknown>, aoTerminar: () => void) => {
    definirSalvando(true);
    definirErro(null);
    try {
      await acao();
      await carregar();
      // O catálogo alimenta o formulário de agenda: sem recarregar, o assunto
      // novo só apareceria lá depois de um F5.
      await recarregar();
      aoTerminar();
    } catch (falha) {
      definirErro((falha as Error).message);
    } finally {
      definirSalvando(false);
    }
  };

  if (!temas) return <Carregando rotulo="Carregando os assuntos…" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      <Secao titulo="Cadastrar assunto">
        <Cartao>
          <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: '0 0 16px' }}>
            O assunto é o que o painel soma. É por ele que se responde "quantas
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
          <div style={{ marginTop: 14 }}>
            <Botao
              variante="primario"
              desabilitado={salvando || !novo.nome.trim()}
              aoClicar={() =>
                void executar(
                  () => criarTema({ nome: novo.nome, nivel: novo.nivel }),
                  () => definirNovo({ nome: '', nivel: 'gerais' }),
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
          {temas.map((tema) => (
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
                            }),
                          () => definirEmEdicao(null),
                        )
                      }
                    >
                      Salvar
                    </Botao>
                    <Botao aoClicar={() => definirEmEdicao(null)}>Cancelar</Botao>
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
                  {/* Estratégico ganha a cor da marca; livre fica neutro. A
                      diferença entre "agenda da companhia" e "o que apareceu"
                      é a leitura mais útil desta lista. */}
                  <Selo
                    rotulo={
                      NIVEIS.find((n) => n.valor === tema.nivel)?.rotulo ?? tema.nivel
                    }
                    fundo={
                      tema.nivel === 'estrategico'
                        ? 'var(--turquesa-rio)'
                        : 'var(--bg-trilho)'
                    }
                    texto={
                      tema.nivel === 'estrategico'
                        ? 'var(--sobre-turquesa)'
                        : 'var(--cinza-3)'
                    }
                  />
                  <Botao
                    variante="fantasma"
                    desabilitado={salvando}
                    aoClicar={() => {
                      definirEmEdicao(tema.id);
                      definirRascunho({ nome: tema.nome, nivel: tema.nivel });
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
