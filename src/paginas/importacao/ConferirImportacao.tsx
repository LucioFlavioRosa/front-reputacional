/** A conferência de uma importação de agendas.
 *
 *  POR QUE ESTA TELA EXISTE
 *  ------------------------
 *  O cliente tem dias com 54 reuniões, e preenchê-las uma a uma no formulário é
 *  inviável. A planilha resolve o volume e cria um problema novo: importar sem
 *  conferência humana cria duplicata de instituição em massa, e desfazer isso
 *  depois é pior do que digitar tudo de novo.
 *
 *  UMA DECISÃO, MUITAS LINHAS. A tela agrupa as divergências por valor, e não
 *  por linha: "Instituição não encontrada: 'Prefeitura de Campinas' — em 12
 *  linhas" é um clique, não doze. É o que faz a conferência escalar com o volume
 *  em vez de crescer junto com ele — sem o agrupamento, a pessoa pararia de
 *  conferir e passaria a clicar.
 *
 *  A TELA NÃO É A BARREIRA. O botão de confirmar apagado é conveniência: o
 *  servidor recusa a confirmação com pendência aberta por conta própria, e
 *  recusa a importação inteira a quem não administra cadastros. Esconder o que
 *  não se pode usar poupa a tentativa, não substitui o controle.
 *
 *  TRÊS BLOCOS, EM ORDEM DE URGÊNCIA: o que precisa de você, o que vou criar
 *  (recolhido, porque não pede nada), e as linhas do arquivo.
 */

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import {
  cancelarImportacao,
  confirmarImportacao,
  corrigirLinhaDaImportacao,
  obterImportacao,
  resolverDivergencia,
} from '@/api/cliente';
import type { Importacao } from '@/api/cliente';
import { Botao, Cartao, FaixaDeErro, Modal, Secao, Vazio } from '@/componentes/basicos';
import { cabecalho, podeConfirmar, porUrgencia } from '@/paginas/importacao/grupos';
import type { Grupo } from '@/paginas/importacao/grupos';
import { corDaCelula, linhaTemPendencia, resumoDeCores } from '@/paginas/importacao/grade';
import { celulasEditaveis } from '@/paginas/importacao/linhas';

interface Props {
  id: string;
  /** Chamado depois de confirmar, para a tela de origem recarregar. */
  aoConfirmar?: (criadas: number) => void;
  /** Fecha a conferência e volta para a tela de trás. */
  aoFechar?: () => void;
}

export function ConferirImportacao({ id, aoConfirmar, aoFechar }: Props) {
  const [importacao, setImportacao] = useState<Importacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [soPendentes, setSoPendentes] = useState(true);
  const [mostrarACriar, setMostrarACriar] = useState(false);
  //: O que a pessoa está digitando, por linha e por coluna, antes de salvar.
  //:
  //: RASCUNHO LOCAL de propósito: salvar a cada tecla mandaria uma reproposição
  //: por caractere, e cada uma devolve a conferência inteira — a tela piscaria
  //: enquanto ela digita a data.
  const [rascunho, setRascunho] = useState<Record<string, string>>({});

  const escrever = (linhaId: number, coluna: string, valor: string) =>
    setRascunho((atual) => ({ ...atual, [`${linhaId}|${coluna}`]: valor }));

  const salvarLinha = (linhaId: number, colunas: string[]) => {
    const celulas: Record<string, string> = {};
    for (const coluna of colunas) {
      const escrito = rascunho[`${linhaId}|${coluna}`];
      if (escrito !== undefined && escrito !== '') celulas[coluna] = escrito;
    }
    if (Object.keys(celulas).length === 0) return;
    void agir(async () => {
      setImportacao(await corrigirLinhaDaImportacao(id, linhaId, celulas));
      //: O rascunho SAI depois de salvo: mantê-lo faria a caixa continuar
      //: mostrando o texto antigo ao lado do valor que o servidor já aceitou.
      setRascunho((atual) => {
        const limpo = { ...atual };
        for (const coluna of colunas) delete limpo[`${linhaId}|${coluna}`];
        return limpo;
      });
    });
  };

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

  /** Toda ação passa por aqui: o servidor devolve o estado inteiro, então a tela
   *  não tenta adivinhar o efeito da decisão — ela mostra o que voltou.
   *
   *  ISSO IMPORTA na reconferência: a confirmação pode recusar com 409 porque o
   *  cadastro mudou desde que a tela abriu, e nesse caso o que a pessoa vê tem
   *  de ser o estado NOVO, não o que ela tinha na frente. */
  const agir = useCallback(
    async (acao: () => Promise<unknown>) => {
      setOcupado(true);
      setErro(null);
      try {
        await acao();
        await carregar();
      } catch (falha) {
        setErro(falha instanceof Error ? falha.message : 'Não consegui aplicar a decisão.');
        await carregar();
      } finally {
        setOcupado(false);
      }
    },
    [carregar],
  );

  //: O MODAL É A MOLDURA, e o conteúdo é o mesmo de antes. Envolver aqui e não
  //: no `App` mantém junto o estado de carregando e de erro: um modal vazio
  //: enquanto a conferência abre é melhor que a tela de trás piscando.
  const moldura = (conteudo: ReactNode) => (
    <Modal
      titulo="Confira a planilha"
      subtitulo="Nada foi criado ainda. Corrija o que está em vermelho e confirme."
      aoFechar={aoFechar ?? (() => {})}
      largura={1240}
    >
      {conteudo}
    </Modal>
  );

  if (erro && !importacao) return moldura(<FaixaDeErro mensagem={erro} />);
  if (!importacao) return moldura(<Vazio mensagem="Abrindo a conferência…" />);

  const numeros = cabecalho({
    agendas: importacao.linhas.filter((linha) => linha.aba === 'Agendas').length,
    pendencias: importacao.pendencias,
    decisoesPendentes: importacao.decisoes_pendentes,
    aCriar: importacao.a_criar,
  });
  const grupos = porUrgencia(importacao.grupos);
  const cores = resumoDeCores(importacao.linhas);
  const visiveis = importacao.linhas.filter(
    (linha) => !soPendentes || linhaTemPendencia(linha),
  );
  //: As células editáveis por linha, uma vez: chamar `celulasEditaveis` dentro do
  //: laço das colunas a recalcularia 22 vezes por linha.
  const editaveisPorLinha: Record<number, string[]> = {};
  for (const linha of importacao.linhas) editaveisPorLinha[linha.id] = celulasEditaveis(linha);
  const fechada = importacao.situacao === 'confirmada' || importacao.situacao === 'cancelada';

  const decidir = (grupo: Grupo, decisao: string, alvo?: string) =>
    agir(() =>
      resolverDivergencia(id, { campo: grupo.campo, valor: grupo.valor, decisao, alvo }),
    );

  return moldura(
    <div className="pilha">
      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      <Cartao>
        <div className="linha linha--entre">
          <div>
            <h2>{importacao.arquivo_nome}</h2>
            {/* O CABEÇALHO RESPONDE "QUANTO FALTA", e é a primeira coisa que a
                pessoa lê para decidir se tem tempo de conferir agora. Os dois
                números de pendência vão juntos porque cada um sozinho engana:
                "12 linhas" não diz quantos cliques, "2 decisões" não diz o
                tamanho do estrago. */}
            <p className="texto--secundario">
              {numeros.agendas} agendas
              {numeros.pendencias > 0
                ? ` · ${numeros.pendencias} linhas presas por ${numeros.decisoes} ${
                    numeros.decisoes === 1 ? 'decisão' : 'decisões'
                  }`
                : ' · nada pendente'}
              {numeros.cadastrosNovos > 0
                ? ` · ${numeros.cadastrosNovos} ${
                    numeros.cadastrosNovos === 1 ? 'cadastro novo' : 'cadastros novos'
                  }`
                : ''}
            </p>
          </div>
          {fechada ? (
            <span className="etiqueta">{importacao.situacao}</span>
          ) : (
            <div className="linha">
              <Botao
                variante="secundario"
                desabilitado={ocupado}
                aoClicar={() => void agir(() => cancelarImportacao(id))}
              >
                Cancelar importação
              </Botao>
              <Botao
                desabilitado={ocupado || !podeConfirmar(importacao.grupos)}
                aoClicar={() =>
                  void agir(async () => {
                    const feito = await confirmarImportacao(id);
                    aoConfirmar?.(feito.criadas);
                  })
                }
              >
                Confirmar e criar {numeros.agendas} agendas
              </Botao>
            </div>
          )}
        </div>
      </Cartao>

      {/* -- o que precisa de você ------------------------------------------- */}
      {grupos.length > 0 ? (
        <Secao titulo="O que precisa de você">
          <div className="pilha">
            {grupos.map((grupo) => (
              <Cartao key={`${grupo.campo}|${grupo.valor}`}>
                <div className="pilha pilha--curta">
                  <div className="linha linha--entre">
                    <strong>{grupo.valor}</strong>
                    <span className="texto--secundario">
                      em {grupo.linhas.length}{' '}
                      {grupo.linhas.length === 1 ? 'linha' : 'linhas'}
                      {grupo.trava ? '' : ' · só aviso'}
                    </span>
                  </div>
                  <p className="texto--secundario">linhas {grupo.linhas.join(', ')}</p>

                  {/* AS SUGESTÕES SÃO O ATALHO: transformam "não existe" num
                      clique. Vazias quando não há nada parecido — oferecer o
                      menos-ruim faria a pessoa apontar para o errado por
                      confiar na sugestão. */}
                  {grupo.sugestoes.length > 0 ? (
                    <div className="linha linha--quebra">
                      {grupo.sugestoes.map((sugestao) => (
                        <Botao
                          key={sugestao.alvo}
                          variante="secundario"
                          desabilitado={ocupado || fechada}
                          // MANDA O `alvo`, e não o nome: o servidor valida o alvo
                          // como id. Mandar o nome fazia este atalho — o principal
                          // da conferência — devolver 422.
                          aoClicar={() => void decidir(grupo, 'apontar', sugestao.alvo)}
                        >
                          É “{sugestao.nome}”
                        </Botao>
                      ))}
                    </div>
                  ) : null}

                  <div className="linha linha--quebra">
                    {/* SÓ ONDE A IMPORTAÇÃO CRIA. Dicionário administrado e campo
                        sem vocabulário não têm cadastro a criar, e oferecer o botão
                        fazia a pendência sumir da tela para voltar como conflito na
                        confirmação, depois de a pessoa ter conferido tudo. */}
                    {grupo.pode_criar ? (
                      <Botao
                        variante="secundario"
                        desabilitado={ocupado || fechada}
                        aoClicar={() => void decidir(grupo, 'criar')}
                      >
                        Cadastrar como novo
                      </Botao>
                    ) : null}
                    <Botao
                      variante="secundario"
                      desabilitado={ocupado || fechada}
                      aoClicar={() => void decidir(grupo, 'descartar')}
                    >
                      Descartar {grupo.linhas.length}{' '}
                      {grupo.linhas.length === 1 ? 'linha' : 'linhas'}
                    </Botao>
                  </div>
                </div>
              </Cartao>
            ))}
          </div>
        </Secao>
      ) : null}

      {/* -- o que vou criar: recolhido, porque não pede nada ---------------- */}
      {importacao.a_criar.length > 0 ? (
        <Secao titulo={`O que vou criar (${importacao.a_criar.length})`}>
          <Botao variante="secundario" aoClicar={() => setMostrarACriar(!mostrarACriar)}>
            {mostrarACriar ? 'Recolher' : 'Ver o que já está decidido'}
          </Botao>
          {mostrarACriar ? (
            <ul>
              {importacao.a_criar.map((item) => (
                <li key={`${item.campo}|${item.valor}|${item.acao}`}>
                  {item.acao === 'criar' ? 'Cadastrar' : 'Apontar'} <strong>{item.valor}</strong>{' '}
                  <span className="texto--secundario">
                    ({item.linhas.length} {item.linhas.length === 1 ? 'linha' : 'linhas'})
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Secao>
      ) : null}

      {/* -- a planilha como a pessoa a preencheu ---------------------------- */}
      <Secao titulo="Confira a planilha">
        {/* O CABEÇALHO RESPONDE "TENHO TEMPO DE CONFERIR AGORA?" antes de a pessoa
            rolar 500 linhas. Contar CÉLULAS e não linhas: uma linha com três
            buracos dá três coisas a preencher, e dizer "1 linha" a subestima. */}
        <div className="linha linha--entre">
          <p className="texto--secundario">
            {cores.trava > 0
              ? `${cores.trava} ${cores.trava === 1 ? 'célula' : 'células'} a preencher`
              : 'nenhuma célula a preencher'}
            {cores.aviso > 0 ? ` · ${cores.aviso} com aviso` : ''}
          </p>
          <Botao variante="secundario" aoClicar={() => setSoPendentes(!soPendentes)}>
            {soPendentes ? 'Ver todas as linhas' : 'Só as que têm pendência'}
          </Botao>
        </div>

        {/* A ROLAGEM É HORIZONTAL E FICA AQUI, não na página: são 22 ou 58
            colunas, e deixar a página inteira rolar para os lados tira o
            cabeçalho e os botões de confirmar do alcance. */}
        <div style={{ overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }}>
          <table className="tabela">
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: 'var(--fundo, #fff)' }}>
                  Linha
                </th>
                {importacao.colunas.map((coluna) => (
                  <th key={coluna} style={{ whiteSpace: 'nowrap' }}>
                    {coluna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visiveis.map((linha) => (
                <tr
                  key={linha.id}
                  /* O DESTAQUE NA LINHA, além do da célula: com 22 colunas a
                     célula vermelha pode estar fora da tela, e é ele que faz a
                     pessoa rolar até ela. */
                  style={
                    linhaTemPendencia(linha)
                      ? { outline: '2px solid var(--erro, #c0392b)' }
                      : undefined
                  }
                >
                  <td
                    style={{
                      position: 'sticky',
                      left: 0,
                      background: 'var(--fundo, #fff)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {linha.linha_origem}
                    {linha.decisao === 'descartada' ? (
                      <span className="etiqueta"> descartada</span>
                    ) : null}
                  </td>
                  {importacao.colunas.map((coluna) => {
                    const cor = corDaCelula(linha, coluna);
                    const editavel = editaveisPorLinha[linha.id]?.includes(coluna);
                    const valor = linha.dados_brutos[coluna];
                    return (
                      <td
                        key={coluna}
                        /* O HOVER CARREGA O QUE NÃO CABE NA CÉLULA: as
                           mensagens de divergência e o fato de o valor ter sido
                           repetido da linha de cima.
                           O "(repetido)" era texto na célula e o dono do produto
                           pediu para sair — com 22 colunas, uma palavra a mais por
                           célula herdada polui a grade inteira. A informação não
                           podia simplesmente desaparecer: a herança é invisível na
                           planilha (a célula está vazia lá), e foi ele mesmo quem
                           pediu para poder vê-la antes de confirmar. No hover ela
                           continua ao alcance de quem tiver dúvida sobre uma
                           célula, sem cobrar nada de quem não tiver. */
                        title={[
                          ...linha.divergencias
                            .filter((d) => d.coluna === coluna)
                            .map((d) => d.mensagem),
                          ...(coluna in linha.herdado ? ['Repetido da linha de cima.'] : []),
                        ].join(' · ')}
                        style={{
                          background:
                            cor === 'trava'
                              ? 'var(--erro-fundo, #fdecea)'
                              : cor === 'aviso'
                                ? 'var(--atencao-fundo, #fdf6e3)'
                                : undefined,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {editavel && !fechada ? (
                          <input
                            className="entrada"
                            style={{ minWidth: 120 }}
                            value={rascunho[`${linha.id}|${coluna}`] ?? ''}
                            placeholder={coluna === 'Data' ? 'dd/mm/aaaa' : 'preencher'}
                            onChange={(evento) =>
                              escrever(linha.id, coluna, evento.target.value)
                            }
                            onBlur={() => salvarLinha(linha.id, [coluna])}
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
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>
    </div>,
  );
}
