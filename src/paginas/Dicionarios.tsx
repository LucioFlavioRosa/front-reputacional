/** Administração › Dicionários — todo vocabulário que a plataforma usa, num
 *  lugar só, dizendo o que se edita aqui e o que não.
 *
 *  POR QUE ESTA TELA EXISTE. Filtros e formulários oferecem esferas, unidades
 *  de negócio, formatos, tipos de investidor… e nenhum deles tinha lugar na
 *  Administração: acrescentar um valor era SQL. A regra que vale para a
 *  plataforma — tudo que se mostra tem de ter onde ser cadastrado — vale para
 *  o vocabulário também.
 *
 *  A FRONTEIRA VEM DO BACK (`app/api/dicionarios.py`): os ABERTOS
 *  (vocabulário da coordenação) ganham acrescentar/renomear/desativar; os
 *  FECHADOS (estrutura do modelo — frentes, status, clima, resultado,
 *  relevância, taxonomia de públicos) aparecem com o motivo no lugar do
 *  botão. Nada se apaga: há agenda apontando. Temas têm aba própria.
 */

import { useEffect, useState } from 'react';
import {
  acrescentarNoDicionario,
  editarNoDicionario,
  listarDicionariosParaAdministracao,
} from '@/api/cliente';
import type { DicionarioAdministravel, ItemAdministravel } from '@/api/cliente';
import {
  Botao,
  Campo,
  Carregando,
  Cartao,
  FaixaDeErro,
  Secao,
  estiloDeEntrada,
} from '@/componentes/basicos';

export function Dicionarios() {
  const [dicionarios, definirDicionarios] = useState<DicionarioAdministravel[] | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const [feito, definirFeito] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);
  //: Qual dicionário está aberto (um por vez — são 18, e todos abertos é uma
  //: parede de linhas), e o rascunho do "Acrescentar" de cada um.
  const [aberto, definirAberto] = useState<string | null>(null);
  const [novo, definirNovo] = useState<Record<string, string>>({});
  const [emEdicao, definirEmEdicao] = useState<{ dicionario: string; id: number } | null>(null);
  const [rascunho, definirRascunho] = useState('');

  //: PROPAGA A FALHA: quem chama decide o que ela significa. Na primeira
  //: carga é a tela vazia com a mensagem; depois de uma escrita é "gravou,
  //: mas não consegui reler" — e nesse caso o aviso de sucesso NÃO aparece,
  //: porque a lista na tela pode não ser a do banco.
  const carregar = async () => definirDicionarios(await listarDicionariosParaAdministracao());

  useEffect(function carregarDicionarios() {
    carregar().catch((falha: Error) => definirErro(falha.message));
  }, []);

  const executar = async (acao: () => Promise<unknown>, aoTerminar: () => void, aviso: string) => {
    definirSalvando(true);
    definirErro(null);
    definirFeito(null);
    try {
      await acao();
      // O CATÁLOGO RECARREGA SOZINHO — `/api/dicionarios` é rota de catálogo
      // em `dominio/sincronizacao.ts`, então filtros e formulários veem o
      // valor novo sem F5. Esta tela relê a lista completa (com inativos).
      await carregar();
      aoTerminar();
      definirFeito(aviso);
    } catch (falha) {
      definirErro((falha as Error).message);
    } finally {
      definirSalvando(false);
    }
  };

  if (!dicionarios) return <Carregando rotulo="Carregando os dicionários…" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {erro ? <FaixaDeErro mensagem={erro} /> : null}
      {feito ? (
        <div
          role="status"
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

      <Secao titulo={`Vocabulários (${dicionarios.length})`}>
        <Cartao>
          <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: '0 0 14px' }}>
            Tudo que filtros e formulários oferecem sai daqui. O que é vocabulário da
            coordenação se edita nesta tela; o que é estrutura do modelo aparece com o
            motivo. Nada se apaga — há agenda apontando —, desativar tira das listas e
            mantém o histórico.
          </p>

          {dicionarios.map((dicionario) => {
            const estaAberto = aberto === dicionario.nome;
            const ativos = dicionario.itens.filter((i) => i.ativo).length;
            return (
              <div
                key={dicionario.nome}
                style={{ borderTop: '1px solid var(--borda)', padding: '10px 0' }}
              >
                <button
                  type="button"
                  aria-expanded={estaAberto}
                  onClick={() => definirAberto(estaAberto ? null : dicionario.nome)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    background: 'none',
                    border: 0,
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                    font: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{dicionario.rotulo}</span>
                  <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
                    {ativos} {ativos === 1 ? 'ativo' : 'ativos'}
                    {dicionario.itens.length > ativos
                      ? ` · ${dicionario.itens.length - ativos} desativado(s)`
                      : ''}
                    {dicionario.editavel ? '' : ' · só leitura'}
                  </span>
                  <span aria-hidden style={{ color: 'var(--cinza-2)' }}>
                    {estaAberto ? '▴' : '▾'}
                  </span>
                </button>

                {estaAberto ? (
                  <div style={{ marginTop: 10 }}>
                    {dicionario.editavel ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 10 }}>
                        <div style={{ flex: 1, maxWidth: 420 }}>
                          <Campo rotulo="Acrescentar">
                            <input
                              style={estiloDeEntrada}
                              value={novo[dicionario.nome] ?? ''}
                              onChange={(e) =>
                                definirNovo({ ...novo, [dicionario.nome]: e.target.value })
                              }
                              placeholder="Nome do novo valor"
                            />
                          </Campo>
                        </div>
                        <Botao
                          variante="primario"
                          desabilitado={salvando || !(novo[dicionario.nome] ?? '').trim()}
                          aoClicar={() =>
                            void executar(
                              () =>
                                acrescentarNoDicionario(dicionario.nome, {
                                  nome: (novo[dicionario.nome] ?? '').trim(),
                                }),
                              () => definirNovo({ ...novo, [dicionario.nome]: '' }),
                              `Acrescentado em ${dicionario.rotulo}.`,
                            )
                          }
                        >
                          Acrescentar
                        </Botao>
                      </div>
                    ) : (
                      <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '0 0 10px' }}>
                        Não se edita pela tela: {dicionario.motivo}
                      </p>
                    )}

                    {dicionario.itens.map((item) => (
                      <LinhaDoItem
                        key={item.id}
                        item={item}
                        editavel={dicionario.editavel}
                        salvando={salvando}
                        emEdicao={
                          emEdicao?.dicionario === dicionario.nome && emEdicao.id === item.id
                        }
                        rascunho={rascunho}
                        aoRascunhar={definirRascunho}
                        aoEditar={() => {
                          definirEmEdicao({ dicionario: dicionario.nome, id: item.id });
                          definirRascunho(item.nome);
                        }}
                        aoCancelar={() => definirEmEdicao(null)}
                        aoSalvar={() =>
                          void executar(
                            () =>
                              editarNoDicionario(dicionario.nome, item.id, {
                                nome: rascunho.trim(),
                                ativo: item.ativo,
                              }),
                            () => definirEmEdicao(null),
                            'Renomeado.',
                          )
                        }
                        aoAlternarAtivo={() =>
                          void executar(
                            () =>
                              editarNoDicionario(dicionario.nome, item.id, {
                                nome: item.nome,
                                ativo: !item.ativo,
                              }),
                            () => undefined,
                            `${item.nome} ${item.ativo ? 'desativado' : 'reativado'}.`,
                          )
                        }
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </Cartao>
      </Secao>
    </div>
  );
}

function LinhaDoItem({
  item,
  editavel,
  salvando,
  emEdicao,
  rascunho,
  aoRascunhar,
  aoEditar,
  aoCancelar,
  aoSalvar,
  aoAlternarAtivo,
}: {
  item: ItemAdministravel;
  editavel: boolean;
  salvando: boolean;
  emEdicao: boolean;
  rascunho: string;
  aoRascunhar: (valor: string) => void;
  aoEditar: () => void;
  aoCancelar: () => void;
  aoSalvar: () => void;
  aoAlternarAtivo: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        padding: '5px 0',
      }}
    >
      {emEdicao ? (
        <input
          style={{ ...estiloDeEntrada, flex: 1, minWidth: 200 }}
          value={rascunho}
          onChange={(e) => aoRascunhar(e.target.value)}
          aria-label={`Novo nome para ${item.nome}`}
        />
      ) : (
        <span
          style={{
            fontSize: 13,
            flex: 1,
            minWidth: 0,
            color: item.ativo ? 'var(--cinza-4)' : 'var(--cinza-2)',
            textDecoration: item.ativo ? 'none' : 'line-through',
          }}
        >
          {item.nome}
          {item.codigo ? (
            <span style={{ color: 'var(--cinza-2)' }}>
              {' · '}
              <code style={{ fontSize: 11 }}>{item.codigo}</code>
            </span>
          ) : null}
        </span>
      )}
      {editavel ? (
        emEdicao ? (
          <>
            <Botao
              variante="primario"
              desabilitado={salvando || !rascunho.trim()}
              aoClicar={aoSalvar}
            >
              Salvar
            </Botao>
            <Botao estilo={{ height: 40 }} aoClicar={aoCancelar}>
              Cancelar
            </Botao>
          </>
        ) : (
          <>
            <Botao variante="fantasma" desabilitado={salvando} aoClicar={aoEditar}>
              Renomear
            </Botao>
            <Botao
              variante="fantasma"
              desabilitado={salvando}
              aoClicar={aoAlternarAtivo}
              rotuloAcessivel={`${item.ativo ? 'Desativar' : 'Reativar'} ${item.nome}`}
            >
              {item.ativo ? 'Desativar' : 'Reativar'}
            </Botao>
          </>
        )
      ) : null}
    </div>
  );
}
