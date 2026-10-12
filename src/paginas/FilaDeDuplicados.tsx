/**  O MESMO ATOR CADASTRADO DUAS VEZES — a fila, e as duas respostas.
 *
 *  O QUE O DONO DO PRODUTO PERGUNTOU: "o Valor Econômico é uma empresa grande
 *  que está na base de imprensa; caso tenhamos Valor Econômico no CRM, empresa
 *  e rede social, vamos consultar o mesmo perfil?" — e decidiu: "deveria ser um
 *  único cadastro que vem de Cadastro compartilhado".
 *
 *  O homônimo exato a migration `0076` fundiu sozinha, sem perguntar: nome igual
 *  não pede julgamento. O que chega aqui são os pares que só casam depois de
 *  tirar pontuação e espaço — `valoreconomico` ↔ `Valor Econômico` —, e ali
 *  semelhança NÃO é identidade: `Diário SM` e `Diários M` casam assim, e
 *  `bmc.news` casa com dois veículos. Quem conhece o ator decide.
 *
 *  A TELA É UMA FILA, e não um relatório: cada decisão tira uma linha, e a
 *  seção desaparece quando chega a zero. Por isso "Não é o mesmo" grava — sem
 *  isso o par recusado voltaria idêntico para sempre, e a fila que não anda é a
 *  que ninguém olha.
 *
 *  O NÚMERO DE MENÇÕES está em cada lado de propósito: é ele que diz qual é a
 *  linha com história (`Valor Econômico` tem 86 de clipping; o handle tem 2), e
 *  é sempre a linha com história que sobrevive.
 *
 *  A DECISÃO APARECE NA HORA, e a releitura vai para segundo plano.
 *
 *  O DONO DO PRODUTO (12/10/2026): "ao clicar em fundir ou não é o mesmo, demora
 *  a atualizar, parece que nada foi feito". MEDIDO: `GET
 *  /api/instituicoes/duplicados` leva 7,4 s na base real — a fila é recalculada
 *  comparando ~3.962 cadastros par a par com `difflib`, e o próprio caso de uso
 *  escreve que "`ratio()` é caro". A tela pagava isso A CADA decisão, e o
 *  `carregar()` não era aguardado: o `finally` reativava os botões na hora, e
 *  durante sete segundos a linha ficava ali, idêntica ao que era antes do clique.
 *
 *  O EFEITO DE CADA RESPOSTA É LOCAL E DETERMINADO, então a tela o aplica sem
 *  perguntar ao servidor: "não é o mesmo" tira UM par; fundir tira um CADASTRO
 *  (e com ele toda pergunta que o menciona) e PASSA AS MENÇÕES ao sobrevivente.
 *
 *  E A BUSCA RODA UMA VEZ, na abertura da tela.
 *
 *  O DONO DO PRODUTO: "realmente tem que fazer a busca sempre? não basta fazer
 *  uma vez quando expandi a tela e depois só atualizar a lista?". Não precisa, e
 *  ele está certo: as três linhas acima são a lista nova, inteira. Recalcular
 *  7,4 s para chegar ao mesmo resultado é trabalho que ninguém pediu — e eram 7,4
 *  s POR DECISÃO, com 209 pares a decidir.
 *
 *  O QUE SE PERDE, e por que o preço não paga: um par que OUTRA pessoa decidiu
 *  enquanto esta decidia continua na tela até a próxima abertura. Clicar nele
 *  falha com a mensagem do servidor, que é o que a faixa de erro mostra — uma
 *  mensagem rara contra sete segundos em cada clique.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  declararCadastroDistinto,
  duplicadosDeCadastro,
  fundirCadastro,
  type CadastroDuplicado,
  type CandidatoDeFusao,
} from '@/api/cliente';
import { Botao, Carregando, Cartao, FaixaDeErro, Secao } from '@/componentes/basicos';
import { Paginacao } from '@/componentes/Paginacao';
import { ROTULO_DO_TIPO_DE_INSTITUICAO } from '@/paginas/cadastroCompartilhado/formularios';

//: O RÓTULO DO TIPO VEM DO CADASTRO, com TRÊS EXCEÇÕES — e as três são
//: deliberadas, não sobra de cópia.
//:
//: ESTA TELA TINHA UMA SEGUNDA TABELA, com a mesma lista escrita à mão, e as
//: duas DIVERGIRAM: aqui "Veículo de imprensa" e "Órgão público", lá "Veículo"
//: e "Órgão". A descoberta foi ao unificá-las, e dois testes apontaram.
//:
//: E A DIFERENÇA TEM RAZÃO: quem lê uma linha daqui está decidindo se APAGA um
//: dos dois cadastros. "Veículo" serve num `<select>` onde a pessoa já sabe que
//: está cadastrando imprensa; aqui, ao lado de um perfil de rede e de um órgão,
//: o rótulo precisa dizer de que mundo o registro é. O cadastro escolhe o nome
//: curto porque o contexto já diz o resto; esta fila não tem contexto.
//:
//: EXPLÍCITO, E NÃO UMA TABELA PARALELA: três linhas que dizem "aqui é
//: diferente, e por isso" em vez de nove que precisam concordar com outras nove.
const MAIS_ESPECIFICO_AQUI: Record<string, string> = {
  veiculo: 'Veículo de imprensa',
  orgao: 'Órgão público',
  //: `credor` é "Banco/credor" no cadastro, onde a barra ajuda quem procura o
  //: tipo numa lista; aqui a linha já é curta e a barra só polui.
  credor: 'Credor',
};

function rotuloDoTipo(tipo: string): string {
  return (
    MAIS_ESPECIFICO_AQUI[tipo] ?? ROTULO_DO_TIPO_DE_INSTITUICAO[tipo] ?? tipo
  );
}

function mencoes(quantas: number): string {
  return quantas === 1 ? '1 menção' : `${quantas} menções`;
}

//: DEZ POR PÁGINA, a mesma régua dos outros dois blocos do cadastro.
//:
//: ESTA FILA NÃO PAGINAVA, e com 210 pares medidos na base real ela desenhava os
//: 210 de uma vez — cada um com o seu bloco de candidatos e dois botões. O
//: pedido do dono do produto é por acesso a todos os casos, e sem navegação a
//: lista longa é lida só até onde a paciência vai.
const POR_PAGINA = 10;

/** A fila sem o cadastro que SAIU — nem perguntando, nem como candidato.
 *
 *  FUNDIR NÃO TIRA UM PAR, TIRA UM CADASTRO: quem sai deixa de existir, então
 *  toda pergunta que o menciona morre com ele. Medido na base real, `bmc.news`
 *  casa com DOIS veículos — pergunta repetida sobre o mesmo cadastro não é
 *  hipótese. Sem isto a tela ofereceria fundir de novo algo que já não está no
 *  banco, e o segundo clique viria 404.
 *
 *  E A PERGUNTA QUE PERDE O ÚLTIMO CANDIDATO SAI: não há mais nada a decidir
 *  nela, e uma linha com dois botões sem efeito é pior que linha nenhuma.
 *
 *  AS MENÇÕES PASSAM PARA O SOBREVIVENTE, onde ele aparecer. É o que a fusão faz
 *  no banco, e aqui esse número é LOAD-BEARING: "é ele que diz qual é a linha com
 *  história, e é sempre a linha com história que sobrevive". Deixá-lo velho numa
 *  outra pergunta sobre o mesmo sobrevivente faria a próxima decisão ser tomada
 *  com o número errado — e a fusão não tem volta. */
function semOCadastro(
  fila: CadastroDuplicado[],
  queSaiuId: string,
  sobreviventeId: string,
  mencoesQuePassam: number,
): CadastroDuplicado[] {
  const somar = (quantas: number, id: string) =>
    id === sobreviventeId ? quantas + mencoesQuePassam : quantas;
  return fila
    .filter((perfil) => perfil.id !== queSaiuId)
    .map((perfil) => ({
      ...perfil,
      mencoes: somar(perfil.mencoes, perfil.id),
      candidatos: perfil.candidatos
        .filter((c) => c.id !== queSaiuId)
        .map((c) => ({ ...c, mencoes: somar(c.mencoes, c.id) })),
    }))
    .filter((perfil) => perfil.candidatos.length > 0);
}

/** A fila sem UM par: "não é o mesmo" vale para aquele par e só para ele.
 *
 *  OS DOIS CADASTROS CONTINUAM NO BANCO — a decisão é sobre a relação entre
 *  eles, e cada um pode seguir sendo pergunta contra outro candidato. */
function semOPar(
  fila: CadastroDuplicado[],
  perfilId: string,
  candidatoId: string,
): CadastroDuplicado[] {
  return fila
    .map((perfil) =>
      perfil.id === perfilId
        ? {
            ...perfil,
            candidatos: perfil.candidatos.filter((c) => c.id !== candidatoId),
          }
        : perfil,
    )
    .filter((perfil) => perfil.candidatos.length > 0);
}

export function FilaDeDuplicados() {
  const [fila, definirFila] = useState<CadastroDuplicado[] | null>(null);
  const [pagina, definirPagina] = useState(1);
  const [erro, definirErro] = useState('');
  const [emCurso, definirEmCurso] = useState('');

  //: A GUARDA DE ORDEM SAIU JUNTO COM A RELEITURA POR DECISÃO.
  //:
  //: Ela existia porque três decisões seguidas deixavam três cargas no ar, e a
  //: primeira a voltar ressuscitaria o que as outras resolveram. Com a busca
  //: rodando UMA VEZ, há um chamador só e não há corrida — e guarda que não
  //: guarda nada é comentário fingindo ser código. Se um dia a tela ganhar um
  //: "atualizar", a guarda volta com ele; o desenho está na `FilaDeRevisao`.
  const carregar = useCallback(() => {
    duplicadosDeCadastro()
      .then((lista) => {
        definirFila(lista);
        definirErro('');
      })
      .catch((falha: Error) => {
        //: A FILA É ACESSÓRIA: ela não pode derrubar o cadastro inteiro. O erro
        //: aparece no lugar dela e o resto da tela segue funcionando.
        definirFila([]);
        definirErro(falha.message);
      });
  }, []);

  useEffect(carregar, [carregar]);

  async function responder(
    perfil: CadastroDuplicado,
    candidato: CandidatoDeFusao,
    resposta: 'fundir' | 'distinto',
  ) {
    //: A TRAVA É DA PERGUNTA, e não do par — achado MÉDIA de revisão.
    //:
    //: ERA `${perfil.id}:${candidato.id}`, e então uma pergunta com DOIS
    //: candidatos deixava o segundo botão clicável enquanto a primeira decisão
    //: estava em voo. Para "fundir" isso é pior que uma corrida: o cadastro de
    //: `perfil.id` está SAINDO, então o segundo pedido fala de um registro que
    //: já não existe — volta 404 depois de a linha ter desaparecido, e a pessoa
    //: lê uma faixa de erro sobre algo que ela viu dar certo.
    //:
    //: E `bmc.news` CASA COM DOIS VEÍCULOS na base real: pergunta com dois
    //: candidatos não é hipótese.
    definirEmCurso(perfil.id);
    definirErro('');
    try {
      if (resposta === 'fundir') {
        //: SEM AVISAR A TELA DE FORA: `/api/instituicoes/.../fundir` está sob
        //: uma rota de catálogo, e o barramento de sincronização recarrega o
        //: catálogo inteiro sozinho. Ver `dominio/sincronizacao.ts`.
        await fundirCadastro(perfil.id, candidato.id);
        definirFila((antes) =>
          antes
            ? semOCadastro(antes, perfil.id, candidato.id, perfil.mencoes)
            : antes,
        );
      } else {
        await declararCadastroDistinto(perfil.id, candidato.id);
        definirFila((antes) =>
          antes ? semOPar(antes, perfil.id, candidato.id) : antes,
        );
      }
      //: SEM RELEITURA AQUI. As duas funções acima são a lista nova, inteira; o
      //: servidor devolveria a mesma coisa depois de 7,4 s de recálculo.
    } catch (falha) {
      definirErro((falha as Error).message);
    } finally {
      definirEmCurso('');
    }
  }

  if (fila === null) {
    return (
      <Secao titulo="Possíveis duplicados">
        <Cartao>
          <Carregando rotulo="Procurando o mesmo ator cadastrado duas vezes…" />
        </Cartao>
      </Secao>
    );
  }

  //: FILA VAZIA NÃO OCUPA TELA. Não há nada a fazer, e um cartão dizendo
  //: "nenhum duplicado" seria uma linha a mais para ler em toda abertura.
  if (fila.length === 0 && !erro) return null;

  const totalDePaginas = Math.max(1, Math.ceil(fila.length / POR_PAGINA));
  //: CORRIGIDA NO RENDER, e não por efeito: cada decisão TIRA uma linha da
  //: fila, então a última página encolhe sob os pés de quem está nela.
  const paginaAgora = Math.min(pagina, totalDePaginas);
  const naTela = fila.slice(
    (paginaAgora - 1) * POR_PAGINA,
    paginaAgora * POR_PAGINA,
  );

  return (
    <Secao
      recolhivel
      titulo={`Possíveis duplicados (${fila.length})`}
      ajuda={
        'O mesmo ator cadastrado duas vezes: o fornecedor de redes manda o ' +
        'handle (valoreconomico) e o clipping manda o nome (Valor Econômico). ' +
        'Fundir junta as menções dos dois num cadastro só — e não tem volta.'
      }
    >
      <Cartao>
        {erro ? <FaixaDeErro mensagem={erro} /> : null}

        {naTela.map((perfil) => (
          <div
            key={perfil.id}
            style={{
              padding: '14px 0',
              borderTop: '1px solid var(--cinza-0)',
            }}
          >
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{perfil.nome}</p>
            {/* A MESMA GRAMÁTICA DA LINHA DO CADASTRO: "Perfil de rede ·
                Imprensa · 2 menções", na ordem em que se lê o ator.

                O TIPO VEM DO SERVIDOR, e era fixo em `perfil_rede` — verdade
                enquanto a fila só perguntava sobre perfis de rede, mentira desde
                11/10/2026: 4 dos pares que ela pergunta são instituições do CRM,
                e apareciam rotuladas "Perfil de rede" a quem ia decidir se apaga
                uma delas. */}
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--cinza-2)' }}>
              {rotuloDoTipo(perfil.tipo)}
              {perfil.cargo ? ` · ${perfil.cargo}` : ''}
              {` · ${mencoes(perfil.mencoes)}`}
            </p>

            {perfil.candidatos.map((candidato) => {
              const ocupado = emCurso === perfil.id;
              return (
                <div
                  key={candidato.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                    marginTop: 8,
                    paddingLeft: 14,
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--cinza-3)' }}>
                    é o mesmo que
                  </span>
                  <strong style={{ fontSize: 14 }}>{candidato.nome}</strong>
                  <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
                    {`${rotuloDoTipo(candidato.tipo)} · ${mencoes(
                      candidato.mencoes,
                    )}`}
                  </span>
                  <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                    <Botao
                      variante="primario"
                      desabilitado={ocupado}
                      aoClicar={() => void responder(perfil, candidato, 'fundir')}
                      rotuloAcessivel={`Fundir ${perfil.nome} em ${candidato.nome}`}
                      titulo={
                        `As ${mencoes(perfil.mencoes)} de ${perfil.nome} passam para ` +
                        `${candidato.nome}, e o perfil sai do cadastro. Não tem volta.`
                      }
                    >
                      {`Fundir em «${candidato.nome}»`}
                    </Botao>
                    <Botao
                      desabilitado={ocupado}
                      aoClicar={() => void responder(perfil, candidato, 'distinto')}
                      rotuloAcessivel={`${perfil.nome} não é ${candidato.nome}`}
                      titulo="Guarda a decisão: o par não volta a aparecer aqui."
                    >
                      Não é o mesmo
                    </Botao>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* A CONTAGEM E A NAVEGAÇÃO. A fila encurta a cada decisão, e é por isso
            que o número total fica no título: ele é o que diz se o trabalho está
            andando. */}
        {fila.length > POR_PAGINA ? (
          <p
            style={{
              margin: '12px 0 0',
              paddingTop: 12,
              borderTop: '1px solid var(--cinza-0)',
              fontSize: 12,
              color: 'var(--cinza-2)',
            }}
          >
            {`Página ${paginaAgora} de ${totalDePaginas} — ${fila.length} pares a decidir.`}
          </p>
        ) : null}

        <Paginacao
          pagina={paginaAgora}
          totalDePaginas={totalDePaginas}
          aoMudarPagina={definirPagina}
        />
      </Cartao>
    </Secao>
  );
}
