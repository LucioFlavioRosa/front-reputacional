/** A conferência da importação: o modal É a planilha que acabou de subir.
 *
 *  ERAM TRÊS BLOCOS — as pendências agrupadas, "o que já está decidido" e a grade
 *  das linhas. O dono do produto olhou e disse o que é verdade: espaço demais para
 *  pouca informação, e três lugares olhando as mesmas 54 linhas obrigavam a pessoa a
 *  cruzar as três para entender uma pendência.
 *
 *  UMA SUPERFÍCIE SÓ, e ela é a planilha. O que os blocos diziam foi para onde é
 *  verdade:
 *
 *  - a CONTAGEM subiu para o cabeçalho, numa linha — é o que responde "tenho tempo
 *    de conferir isto agora?" antes de rolar;
 *  - a DECISÃO desceu para a célula vermelha, dizendo quantas linhas ela resolve.
 *    Era a única coisa que o bloco agrupado tinha de insubstituível: "este órgão não
 *    existe" em doze linhas é um clique, não doze, e é isso que faz a conferência
 *    escalar com um dia de evento. Ver `celula.ts`;
 *  - o "o que já está decidido" não voltou em lugar nenhum. Era um painel de
 *    prestação de contas que ninguém pediu: o que ele listava está dito na própria
 *    frase do botão de subir.
 *
 *  DOIS BOTÕES POR LINHA e dois no modal, como pedido. Excluir é reversível até a
 *  confirmação — a linha fica marcada e volta com um clique —, porque errar numa tela
 *  de 54 linhas é fácil e a planilha não é o caminho de volta: o arquivo não é
 *  guardado.
 */

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import {
  cancelarImportacao,
  confirmarImportacao,
  corrigirLinhaDaImportacao,
  excluirLinhaDaImportacao,
  obterImportacao,
  resolverDivergencia,
} from '@/api/cliente';
import type { ColunaDaImportacao, Importacao, LinhaDaImportacao } from '@/api/cliente';
import { Botao, FaixaDeErro, Modal, Vazio } from '@/componentes/basicos';
import { decisaoDaCelula } from '@/paginas/importacao/celula';
import { corDaCelula, linhaTemPendencia, resumoDeCores } from '@/paginas/importacao/grade';
import { medidaDaColuna } from '@/paginas/importacao/medidas';
import { porUrgencia } from '@/paginas/importacao/grupos';

interface Props {
  id: string;
  /** Chamado depois de confirmar, para a tela de origem recarregar. */
  aoConfirmar?: (criadas: number) => void;
  /** Fecha a conferência e volta para a tela de trás. */
  aoFechar?: () => void;
}

/** A borda de cada peça. UM PIXEL do cinza do sistema, e não uma cor nova. */
const REGUA = '1px solid var(--borda)';

/** O espaço ENTRE as peças. É ele que divide as colunas agora: com cantos
 *  arredondados não há régua compartilhada, e o vão faz o mesmo trabalho com menos
 *  tinta. Dois pixels — o suficiente para separar, pouco para não afrouxar a grade. */
const VAO = '2px';

/** A ALTURA DE TODA LINHA, e ela não muda nunca.
 *
 *  É o pedido, e é o que faz a grade ser varrível: 54 linhas de alturas diferentes
 *  não se leem de cima a baixo. Ao entrar em edição o campo ocupa exatamente esta
 *  altura, com `box-sizing: border-box`, então a borda dele cabe DENTRO do espaço que
 *  o texto ocupava — a linha não se move um pixel.
 *
 *  ERA AQUI O DEFEITO que expandia a célula: o campo levava `className="entrada"`, e
 *  essa classe existe no projeto — é o layout da tela de LOGIN, com
 *  `min-height: 100vh`. O campo estava recebendo altura mínima de uma tela inteira. */
const ALTURA_DA_LINHA = 30;

/** O recheio de toda célula, cabeçalho incluído. Um número só, num lugar só:
 *  cabeçalho e corpo com recheios diferentes desalinham a coluna inteira. */
const RECHEIO = '6px 10px';

/** O cabeçalho: fixo no topo da rolagem, no azul da marca sobre o trilho. É a mesma
 *  linguagem das outras tabelas do produto (`componentes/Tabela.tsx`) — inventar
 *  outra aqui faria esta tela parecer de outro sistema. */
const CABECALHO = {
  position: 'sticky' as const,
  top: 0,
  zIndex: 3,
  background: 'var(--bg-trilho)',
  color: 'var(--azul-mar-sombra)',
  textAlign: 'left' as const,
  padding: RECHEIO,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.02em',
  textTransform: 'uppercase' as const,
  whiteSpace: 'nowrap' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  border: REGUA,
  borderRadius: 'var(--r-destaque)',
};

/** A célula de dados: a régua à direita é o que divide as colunas, e o recheio é o
 *  mesmo do cabeçalho — recheios diferentes desalinham a coluna inteira. */
const CELULA = {
  padding: RECHEIO,
  border: REGUA,
  borderRadius: 'var(--r-destaque)',
  background: 'var(--branco)',
  height: ALTURA_DA_LINHA,
  //: `middle` e não `top`: com altura fixa, o texto centrado verticalmente é o que
  //: faz a peça parecer uma célula e não um bloco com o conteúdo empurrado para cima.
  verticalAlign: 'middle' as const,
  //: NADA CRESCE. O valor comprido corta com reticências e o inteiro está no hover —
  //: é o que uma planilha faz, e é o que mantém a linha na mesma altura.
  whiteSpace: 'nowrap' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

/** O campo de edição, que ocupa a célula sem mudá-la de tamanho.
 *
 *  `height: 100%` com `box-sizing: border-box` é o par que faz a borda do campo caber
 *  DENTRO da altura da célula. Sem o `box-sizing`, a borda somaria dois pixels e a
 *  linha inteira desceria. */
const CAMPO = {
  width: '100%',
  height: '100%',
  boxSizing: 'border-box' as const,
  margin: 0,
  padding: '0 6px',
  border: '1px solid var(--azul-mar)',
  borderRadius: 'var(--r-btn)',
  background: 'var(--branco)',
  color: 'var(--cinza-4)',
  font: 'inherit',
  fontSize: 12,
};

/** A primeira coluna congelada: a grade rola para os lados, e sem isto a pessoa
 *  perde de vista de qual linha da planilha ela está falando. */
const CONGELADA = {
  position: 'sticky' as const,
  left: 0,
  zIndex: 2,
  background: 'var(--branco)',
};

/** O fundo da célula com problema. OS TOKENS DO PRODUTO — e isto era um defeito meu:
 *  eu havia escrito `--erro-fundo` e `--atencao-fundo`, que não existem no sistema, e
 *  as células vinham caindo nos hex que eu inventei no fallback, fora da paleta. */
const FUNDO_DA_CELULA: Record<string, string | undefined> = {
  trava: 'var(--erro-bg)',
  aviso: 'var(--atencao-bg)',
};

export function ConferirImportacao({ id, aoConfirmar, aoFechar }: Props) {
  const [importacao, setImportacao] = useState<Importacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [soPendentes, setSoPendentes] = useState(true);
  //: A LINHA EM EDIÇÃO, uma de cada vez. Duas linhas abertas ao mesmo tempo
  //: convidariam a pessoa a preencher uma e salvar a outra sem perceber.
  const [editando, setEditando] = useState<number | null>(null);
  const [rascunho, setRascunho] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    try {
      setImportacao(await obterImportacao(id));
      setErro(null);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não consegui abrir a conferência.');
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const agir = async (gesto: () => Promise<void>) => {
    setOcupado(true);
    setErro(null);
    try {
      await gesto();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não consegui completar a ação.');
    } finally {
      setOcupado(false);
    }
  };

  const abrirEdicao = (linha: LinhaDaImportacao, colunas: ColunaDaImportacao[]) => {
    setEditando(linha.id);
    //: O RASCUNHO COMEÇA COM O QUE ESTÁ NA CÉLULA, e não vazio: a pessoa clicou em
    //: editar para CORRIGIR um valor, e um campo vazio a obrigaria a redigitar o que
    //: já estava certo.
    const inicial: Record<string, string> = {};
    for (const { nome } of colunas) {
      const valor = linha.dados_brutos[nome];
      inicial[`${linha.id}|${nome}`] = valor === null || valor === undefined ? '' : String(valor);
    }
    setRascunho((atual) => ({ ...atual, ...inicial }));
  };

  const fecharEdicao = () => setEditando(null);

  const salvarLinha = (linha: LinhaDaImportacao, colunas: ColunaDaImportacao[]) => {
    const celulas: Record<string, string> = {};
    for (const { nome } of colunas) {
      const escrito = rascunho[`${linha.id}|${nome}`] ?? '';
      const antes = linha.dados_brutos[nome];
      const comoEstava = antes === null || antes === undefined ? '' : String(antes);
      //: SÓ O QUE MUDOU vai para o servidor: mandar a linha inteira marcaria como
      //: "editado na conferência" toda célula que a pessoa nem tocou.
      if (escrito !== comoEstava) celulas[nome] = escrito;
    }
    if (Object.keys(celulas).length === 0) {
      fecharEdicao();
      return;
    }
    void agir(async () => {
      setImportacao(await corrigirLinhaDaImportacao(id, linha.id, celulas));
      fecharEdicao();
    });
  };

  const excluirLinha = (linha: LinhaDaImportacao, excluir: boolean) =>
    void agir(async () => {
      setImportacao(await excluirLinhaDaImportacao(id, linha.id, excluir));
      if (editando === linha.id) fecharEdicao();
    });

  const decidir = (campo: string, valor: string, decisao: string, alvo?: string) =>
    void agir(async () => {
      setImportacao(await resolverDivergencia(id, { campo, valor, decisao, alvo }));
    });

  const moldura = (conteudo: ReactNode, rodape?: ReactNode) => (
    <Modal
      titulo={importacao?.arquivo_nome ?? 'Confira a planilha'}
      subtitulo="Nada foi criado ainda. Confira as linhas e suba quando estiver certo."
      aoFechar={aoFechar ?? (() => {})}
      largura={1240}
      rodape={rodape}
    >
      {conteudo}
    </Modal>
  );

  if (erro && !importacao) return moldura(<FaixaDeErro mensagem={erro} />);
  if (!importacao) return moldura(<Vazio mensagem="Abrindo a conferência…" />);

  const fechada = importacao.situacao !== 'aguardando_conferencia';
  const grupos = porUrgencia(importacao.grupos);
  const cores = resumoDeCores(importacao.linhas);
  const daPlanilha = importacao.linhas.filter((linha) => linha.aba === 'Agendas');
  const aCriar = daPlanilha.filter((linha) => linha.decisao !== 'descartada').length;
  const excluidas = daPlanilha.length - aCriar;
  const visiveis = daPlanilha.filter(
    (linha) => !soPendentes || linhaTemPendencia(linha) || linha.decisao === 'descartada',
  );

  const rodape = fechada ? (
    <span className="etiqueta">{importacao.situacao}</span>
  ) : (
    <div className="linha linha--entre">
      <Botao
        variante="secundario"
        desabilitado={ocupado}
        aoClicar={() => void agir(async () => setImportacao(await cancelarImportacao(id)))}
      >
        Cancelar a importação
      </Botao>
      {/* A FRASE DO BOTÃO É A PRESTAÇÃO DE CONTAS que o bloco recolhido dava: ela
          diz quantas agendas entram, e é a última coisa que a pessoa lê antes de
          decidir. "Subir" é a palavra que o dono usa para este gesto. */}
      <Botao
        desabilitado={ocupado || importacao.pendencias > 0 || aCriar === 0}
        aoClicar={() =>
          void agir(async () => {
            const feito = await confirmarImportacao(id);
            aoConfirmar?.(feito.criadas);
          })
        }
      >
        {importacao.pendencias > 0
          ? `Resolva ${importacao.pendencias} ${
              importacao.pendencias === 1 ? 'linha' : 'linhas'
            } para subir`
          : `Subir ${aCriar} ${aCriar === 1 ? 'agenda' : 'agendas'}`}
      </Botao>
    </div>
  );

  return moldura(
    <div className="pilha pilha--curta">
      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      {/* O CABEÇALHO EM UMA LINHA: contar CÉLULAS e não linhas, porque uma linha com
          três buracos dá três coisas a preencher. */}
      <div className="linha linha--entre">
        <p className="texto--secundario">
          {aCriar} {aCriar === 1 ? 'agenda' : 'agendas'}
          {cores.trava > 0
            ? ` · ${cores.trava} ${cores.trava === 1 ? 'célula' : 'células'} a preencher`
            : ' · nada a preencher'}
          {cores.aviso > 0 ? ` · ${cores.aviso} com aviso` : ''}
          {excluidas > 0 ? ` · ${excluidas} excluída${excluidas === 1 ? '' : 's'}` : ''}
        </p>
        <Botao variante="secundario" aoClicar={() => setSoPendentes(!soPendentes)}>
          {soPendentes ? 'Ver todas as linhas' : 'Só as que precisam de você'}
        </Botao>
      </div>

      <div className="rolagem-interna" style={{ maxHeight: '62vh', overflowX: 'auto' }}>
        <table
          style={{
            //: SEPARADO E NÃO COLAPSADO: é o que permite canto arredondado por
            //: célula. Com as bordas colapsadas, duas células vizinhas dividem a
            //: mesma linha e o raio não tem onde existir.
            borderCollapse: 'separate',
            borderSpacing: VAO,
            fontSize: 12,
            // FIXO, e é o que faz a largura por tipo valer: em `auto` o navegador
            // redistribui tudo pelo conteúdo, e um relato comprido numa linha
            // esticaria a coluna em TODAS as outras.
            tableLayout: 'fixed',
          }}
        >
          {/* A LARGURA DE CADA COLUNA VEM DO TIPO DO DADO, que o servidor manda.
              Ver `medidas.ts`: a sigla do estado tem 64px e o relato tem 288. */}
          <colgroup>
            <col style={{ width: 64 }} />
            {importacao.colunas.map((coluna) => (
              <col key={coluna.nome} style={{ width: medidaDaColuna(coluna.tipo).largura }} />
            ))}
            <col style={{ width: 168 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...CABECALHO, ...CONGELADA, top: 0 }}>Linha</th>
              {importacao.colunas.map((coluna) => (
                <th
                  key={coluna.nome}
                  title={coluna.nome}
                  style={{
                    ...CABECALHO,
                    textAlign: medidaDaColuna(coluna.tipo).alinhamento,
                  }}
                >
                  {coluna.nome}
                </th>
              ))}
              <th style={CABECALHO}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((linha) => {
              const excluida = linha.decisao === 'descartada';
              const emEdicao = editando === linha.id;
              return (
                <tr
                  key={linha.id}
                  style={{ opacity: excluida ? 0.45 : undefined }}
                >
                  {/* A PENDÊNCIA MARCA A PEÇA DO NÚMERO, e não um contorno em
                      volta da linha: com as peças separadas, um contorno na linha
                      cortaria os vãos e brigaria com os cantos. Aqui ele vira uma
                      faixa na primeira peça — que é justamente a que fica congelada
                      quando a grade rola para os lados, então continua visível. */}
                  <td
                    style={{
                      ...CELULA,
                      ...CONGELADA,
                      textAlign: 'center',
                      fontWeight: 600,
                      borderLeft:
                        !excluida && linhaTemPendencia(linha)
                          ? '4px solid var(--erro-fg)'
                          : REGUA,
                    }}
                  >
                    {linha.linha_origem}
                  </td>
                  {importacao.colunas.map(({ nome: coluna, tipo }) => {
                    const cor = corDaCelula(linha, coluna);
                    const valor = linha.dados_brutos[coluna];
                    const decisao = decisaoDaCelula(linha, coluna, grupos);
                    const medida = medidaDaColuna(tipo);
                    return (
                      <td
                        key={coluna}
                        title={[
                          ...linha.divergencias
                            .filter((d) => d.coluna === coluna)
                            .map((d) => d.mensagem),
                          ...(coluna in linha.herdado ? ['Repetido da linha de cima.'] : []),
                          String(valor ?? ''),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                        style={{
                          ...CELULA,
                          textAlign: medida.alinhamento,
                          background: excluida
                            ? undefined
                            : (FUNDO_DA_CELULA[cor ?? ''] ?? 'var(--branco)'),
                        }}
                      >
                        {emEdicao ? (
                          /* O CAMPO CABE NA CÉLULA, e isto era um pedido: editar não
                             pode abrir espaço nem empurrar a tabela. Com a largura
                             fixa da coluna e `width: 100%`, a linha em edição ocupa
                             exatamente o mesmo lugar que ocupava antes — a pessoa
                             digita onde estava lendo. */
                          <input
                            style={{ ...CAMPO, textAlign: medida.alinhamento }}
                            value={rascunho[`${linha.id}|${coluna}`] ?? ''}
                            placeholder={tipo === 'data' ? 'dd/mm/aaaa' : ''}
                            onChange={(evento) =>
                              setRascunho((atual) => ({
                                ...atual,
                                [`${linha.id}|${coluna}`]: evento.target.value,
                              }))
                            }
                          />
                        ) : (
                          <>
                            {valor === null || valor === undefined || valor === ''
                              ? '—'
                              : String(valor)}
                            {coluna in linha.corrigido ? (
                              <span className="etiqueta"> editado aqui</span>
                            ) : null}
                          </>
                        )}

                        {/* A DECISÃO NA CÉLULA, e o número que justifica o clique.
                            É o que substituiu o bloco de pendências agrupadas: sem
                            ele, consertar um órgão errado em doze linhas seriam doze
                            consertos iguais. */}
                        {decisao && !excluida && !fechada ? (
                          <div className="pilha pilha--curta" style={{ marginTop: 4 }}>
                            {decisao.outrasLinhas > 0 ? (
                              <span className="texto--secundario">
                                e em {decisao.outrasLinhas}{' '}
                                {decisao.outrasLinhas === 1 ? 'outra linha' : 'outras linhas'}
                              </span>
                            ) : null}
                            <div className="linha linha--quebra">
                              {decisao.grupo.sugestoes.map((sugestao) => (
                                <Botao
                                  key={sugestao.alvo}
                                  variante="secundario"
                                  desabilitado={ocupado}
                                  aoClicar={() =>
                                    decidir(
                                      decisao.grupo.campo,
                                      decisao.grupo.valor,
                                      'apontar',
                                      sugestao.alvo,
                                    )
                                  }
                                >
                                  É “{sugestao.nome}”
                                </Botao>
                              ))}
                              {decisao.grupo.pode_criar ? (
                                <Botao
                                  variante="secundario"
                                  desabilitado={ocupado}
                                  aoClicar={() =>
                                    decidir(decisao.grupo.campo, decisao.grupo.valor, 'criar')
                                  }
                                >
                                  Cadastrar como novo
                                </Botao>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </td>
                    );
                  })}

                  <td style={{ ...CELULA, padding: '3px 6px' }}>
                    {fechada ? null : excluida ? (
                      <Botao
                        variante="secundario"
                        desabilitado={ocupado}
                        aoClicar={() => excluirLinha(linha, false)}
                      >
                        Restaurar
                      </Botao>
                    ) : emEdicao ? (
                      <div className="linha">
                        <Botao
                          desabilitado={ocupado}
                          aoClicar={() => salvarLinha(linha, importacao.colunas)}
                        >
                          Salvar
                        </Botao>
                        <Botao variante="secundario" aoClicar={fecharEdicao}>
                          Cancelar
                        </Botao>
                      </div>
                    ) : (
                      <div className="linha">
                        <Botao
                          variante="secundario"
                          desabilitado={ocupado}
                          aoClicar={() => abrirEdicao(linha, importacao.colunas)}
                        >
                          Editar
                        </Botao>
                        <Botao
                          variante="secundario"
                          desabilitado={ocupado}
                          aoClicar={() => excluirLinha(linha, true)}
                        >
                          Excluir
                        </Botao>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visiveis.length === 0 ? (
          <Vazio mensagem="Nenhuma linha precisa de você. Pode subir." />
        ) : null}
      </div>
    </div>,
    rodape,
  );
}
