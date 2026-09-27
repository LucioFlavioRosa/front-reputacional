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

import {
  cancelarImportacao,
  confirmarImportacao,
  corrigirLinhaDaImportacao,
  obterImportacao,
  resolverDivergencia,
} from '@/api/cliente';
import type { Importacao } from '@/api/cliente';
import { Botao, Cartao, FaixaDeErro, Secao, Vazio } from '@/componentes/basicos';
import { cabecalho, podeConfirmar, porUrgencia } from '@/paginas/importacao/grupos';
import type { Grupo } from '@/paginas/importacao/grupos';
import { celulasEditaveis, resumoDaLinha } from '@/paginas/importacao/linhas';

interface Props {
  id: string;
  /** Chamado depois de confirmar, para a tela de origem recarregar. */
  aoConfirmar?: (criadas: number) => void;
}

export function ConferirImportacao({ id, aoConfirmar }: Props) {
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

  if (erro && !importacao) return <FaixaDeErro mensagem={erro} />;
  if (!importacao) return <Vazio mensagem="Abrindo a conferência…" />;

  const numeros = cabecalho({
    agendas: importacao.linhas.filter((linha) => linha.aba === 'Agendas').length,
    pendencias: importacao.pendencias,
    decisoesPendentes: importacao.decisoes_pendentes,
    aCriar: importacao.a_criar,
  });
  const grupos = porUrgencia(importacao.grupos);
  const fechada = importacao.situacao === 'confirmada' || importacao.situacao === 'cancelada';

  const decidir = (grupo: Grupo, decisao: string, alvo?: string) =>
    agir(() =>
      resolverDivergencia(id, { campo: grupo.campo, valor: grupo.valor, decisao, alvo }),
    );

  return (
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

      {/* -- as linhas do arquivo -------------------------------------------- */}
      <Secao titulo="As linhas do arquivo">
        <Botao variante="secundario" aoClicar={() => setSoPendentes(!soPendentes)}>
          {soPendentes ? 'Ver todas as linhas' : 'Só as que têm pendência'}
        </Botao>
        <table className="tabela">
          <thead>
            <tr>
              <th>Linha</th>
              {/* O CONTEÚDO DA LINHA, e ele faltava: sem estas colunas a pessoa
                  lia "linha 3 · falta a Data" sem saber de que agenda se tratava —
                  e a planilha tem 500 linhas para procurar à mão. */}
              <th>A agenda</th>
              <th>Situação</th>
              <th>Herdado da linha de cima</th>
              <th>O que falta</th>
            </tr>
          </thead>
          <tbody>
            {importacao.linhas
              .filter((linha) => !soPendentes || linha.divergencias.some((d) => d.trava))
              .map((linha) => {
                const editaveis = celulasEditaveis(linha);
                return (
                <tr key={linha.id}>
                  <td>{linha.linha_origem}</td>
                  <td>
                    <div className="pilha pilha--curta">
                      {resumoDaLinha(linha).map((celula) => (
                        <span key={celula.coluna}>
                          <span className="texto--secundario">{celula.coluna}: </span>
                          {celula.valor}
                          {/* A MARCA DO QUE FOI EDITADO AQUI: dali em diante o
                              registro difere da planilha que a pessoa guardou. */}
                          {celula.coluna in linha.corrigido ? (
                            <span className="etiqueta"> editado na conferência</span>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{linha.decisao}</td>
                  {/* O QUE A HERANÇA FEZ, e é o único lugar onde ela aparece: na
                      planilha a célula fica vazia, e sem isto a pessoa confirmaria
                      54 agendas confiando na memória do que havia acima. */}
                  <td>
                    {Object.keys(linha.herdado).length === 0 ? (
                      <span className="texto--secundario">—</span>
                    ) : (
                      Object.entries(linha.herdado)
                        .map(([coluna, valor]) => `${coluna}: ${String(valor)}`)
                        .join(' · ')
                    )}
                  </td>
                  <td>
                    {linha.divergencias.length === 0 ? (
                      <span className="texto--secundario">nada</span>
                    ) : (
                      <div className="pilha pilha--curta">
                        <span>{linha.divergencias.map((d) => d.mensagem).join(' · ')}</span>
                        {/* ONDE SE COMPLETA. A ausência não tem valor para
                            apontar nem cadastro para criar: o único conserto é
                            escrever o que falta, e antes disto era preciso
                            corrigir a planilha e subir tudo de novo. */}
                        {editaveis.length > 0 && !fechada ? (
                          <div className="linha linha--quebra">
                            {editaveis.map((coluna) => (
                              <label key={coluna} className="campo">
                                <span className="texto--secundario">{coluna}</span>
                                <input
                                  className="entrada"
                                  value={rascunho[`${linha.id}|${coluna}`] ?? ''}
                                  placeholder={coluna === 'Data' ? 'dd/mm/aaaa' : ''}
                                  onChange={(evento) =>
                                    escrever(linha.id, coluna, evento.target.value)
                                  }
                                />
                              </label>
                            ))}
                            <Botao
                              variante="secundario"
                              desabilitado={ocupado}
                              aoClicar={() => salvarLinha(linha.id, editaveis)}
                            >
                              Salvar
                            </Botao>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
                );
              })}
          </tbody>
        </table>
      </Secao>
    </div>
  );
}
