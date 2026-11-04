/**  O MESMO ATOR CADASTRADO DUAS VEZES — a fila, e as duas respostas.
 *
 *  O QUE O DONO DO PRODUTO PERGUNTOU: "o Valor Econômico é uma empresa grande
 *  que está na base de imprensa; caso tenhamos Valor Econômico no CRM, empresa
 *  e rede social, vamos consultar o mesmo perfil?" — e decidiu: "deveria ser um
 *  único cadastro que vem de Cadastro compartilhado".
 *
 *  O homônimo exato a migration `0077` fundiu sozinha, sem perguntar: nome igual
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
 *  linha com história — o veículo vem do clipping com anos de menções, o handle
 *  recém-criado com poucas —, e é sempre a linha com história que sobrevive.
 *
 *  A DECISÃO APARECE NA HORA, e a lista NÃO é relida — nem em segundo plano. O
 *  que se relê é só o estado do pareamento, quando o catálogo muda.
 *
 *  O DONO DO PRODUTO (12/10/2026): "ao clicar em fundir ou não é o mesmo, demora
 *  a atualizar, parece que nada foi feito". MEDIDO: `GET
 *  /api/instituicoes/duplicados` levava 7,4 s na base real — a fila era
 *  recalculada comparando ~3.962 cadastros par a par com `difflib`, e o próprio
 *  caso de uso escrevia que "`ratio()` é caro". A tela pagava isso A CADA
 *  decisão, e o `carregar()` não era aguardado: o `finally` reativava os botões
 *  na hora, e durante sete segundos a linha ficava ali, idêntica ao que era antes
 *  do clique.
 *
 *  A ROTA FICOU BARATA DEPOIS (migration `0118`): o pareamento passou a ser
 *  guardado, porque em 11.000 cadastros ele chegou a 102,7 s e virou 504. Mas o
 *  que esta tela faz não mudou — ela segue lendo UMA vez —, e por outra razão:
 *  o efeito de cada resposta é local e determinado, então a releitura chegaria
 *  ao mesmo resultado. O que o pareamento guardado trouxe para cá foi a
 *  obrigação de dizer QUANDO ele foi feito — ver `avisoDaFila`.
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

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  declararCadastroDistinto,
  duplicadosDeCadastro,
  estadoDaFilaDeDuplicados,
  fundirCadastro,
  type CadastroDuplicado,
  type CandidatoDeFusao,
  type EstadoDaFilaDeDuplicados,
} from '@/api/cliente';
import {
  Botao,
  Campo,
  Carregando,
  Cartao,
  FaixaDeAtencao,
  FaixaDeErro,
  Secao,
  estiloDeEntrada,
} from '@/componentes/basicos';
import { Paginacao } from '@/componentes/Paginacao';
import { quantoTempo } from '@/dominio/cargasDasBases';
import { catalogoMudou } from '@/dominio/sincronizacao';
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

//: DE ONDE VEM O REGISTRO, em palavra de gente.
//:
//: O SERVIDOR MANDA CÓDIGO DE LENTE (mais `crm`), e código de lente é vocabulário
//: de dentro: "sociedade" é a lente das redes em mar aberto, e quem lê a fila
//: pensa "rede social". O nome da lente aparece assim nos outros painéis.
//:
//: O CÓDIGO DESCONHECIDO PASSA DIRETO em vez de virar "outra": uma lente nova no
//: cadastro apareceria com o código dela, que é feio e verdadeiro — e não como
//: uma palavra que esconde que a tela não sabe o que é aquilo.
const ROTULO_DA_ORIGEM: Record<string, string> = {
  imprensa: 'imprensa',
  mercado: 'mercado',
  sociedade: 'redes sociais',
  clientes: 'clientes',
  institucional: 'institucional',
  crm: 'CRM',
};

/** "vem de CRM e imprensa" — ou nada, quando o cadastro não tem registro algum.
 *
 *  VAZIO É VAZIO, e não "sem origem": são as 4 duplicatas feitas por gente no CRM
 *  (ALMG, ANA, BNDES, Itaú BBA), que têm zero menções e zero interações. Escrever
 *  "sem origem" ao lado de "0 menções" seria dizer duas vezes a mesma coisa. */
function deOndeVem(origens: string[]): string {
  if (origens.length === 0) return '';
  const nomes = origens.map((o) => ROTULO_DA_ORIGEM[o] ?? o);
  if (nomes.length === 1) return `vem de ${nomes[0]}`;
  return `vem de ${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
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
  //: AS ORIGENS DE QUEM SAIU, que passam a ser do sobrevivente junto com as
  //: menções — achado MÉDIA de revisão. A tela somava a contagem e deixava as
  //: origens antigas: fundir um cadastro que "vem de imprensa" dentro de um que
  //: "vem de CRM" deixava a linha dizendo só CRM, com a contagem dos dois. Uma
  //: afirmação falsa até a próxima recarga — e é a MESMA família do número de
  //: menções velho: a tela afirma de onde vem um dossiê que já mudou.
  origensQuePassam: string[] = [],
): CadastroDuplicado[] {
  const somar = (quantas: number, id: string) =>
    id === sobreviventeId ? quantas + mencoesQuePassam : quantas;
  //: ORDENADAS E SEM REPETIR, como o servidor as manda: a linha não deve trocar
  //: de ordem só porque a fusão aconteceu na sessão desta pessoa.
  const unir = (origens: string[], id: string) =>
    id === sobreviventeId
      ? [...new Set([...origens, ...origensQuePassam])].sort()
      : origens;
  return fila
    .filter((perfil) => perfil.id !== queSaiuId)
    .map((perfil) => ({
      ...perfil,
      mencoes: somar(perfil.mencoes, perfil.id),
      origens: unir(perfil.origens, perfil.id),
      candidatos: perfil.candidatos
        .filter((c) => c.id !== queSaiuId)
        .map((c) => ({
          ...c,
          mencoes: somar(c.mencoes, c.id),
          origens: unir(c.origens, c.id),
        })),
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

//: O ESTADO QUE NÃO CHEGOU, e ele NÃO é "calculado": é justamente o que impede a
//: tela de afirmar zero. A fila é acessória e não pode cair com ele — mas o
//: silêncio dele também não pode virar uma afirmação que ninguém conferiu.
const DESCONHECIDO = 'desconhecido';

type Estado = EstadoDaFilaDeDuplicados | typeof DESCONHECIDO;

/** A RESSALVA QUE A LISTA NÃO CARREGA — e, quando não há nenhuma, nada.
 *
 *  O PAREAMENTO É GUARDADO desde a `0118` (ver `estadoDaFilaDeDuplicados`), e
 *  isso parte o antigo "fila vazia = nenhum duplicado" em três verdades
 *  diferentes que o mesmo `(0)` esconderia:
 *
 *  * NUNCA PAREADA — tabela recém-criada, ou migration aplicada sem o comando de
 *    recálculo. Vazio aqui não diz nada sobre o cadastro;
 *  * PAREADA E VELHA — o cadastro mudou depois. A subida de planilha refaz o
 *    pareamento, cadastrar pela tela não, então este é o caso comum;
 *  * NÃO DEU PARA CONFERIR — a rota do estado falhou sozinha.
 *
 *  O QUARTO CASO É O SILÊNCIO: pareada e em dia não rende aviso, porque aí a
 *  lista fala por si.
 */
function avisoDaFila(estado: Estado): { texto: string; titulo?: string } | null {
  if (estado === DESCONHECIDO) {
    return {
      texto:
        'Não foi possível conferir quando esta fila foi pareada — o que ela ' +
        'mostra pode estar incompleto.',
    };
  }
  if (estado.calculado_em === null) {
    return {
      //: O ADMINISTRADOR, E NÃO "ESPERE A PRÓXIMA PLANILHA" — achado da revisão
      //: do Codex, e procedente: quem trabalha só no CRM não sobe planilha
      //: nenhuma, e mandar esperar uma deixaria a fila vazia para sempre. O back
      //: documenta o comando de recálculo como backfill OBRIGATÓRIO depois da
      //: `0118`, e este é o caso em que ele não rodou.
      texto:
        'Esta fila ainda não foi pareada: o vazio aqui é por isso, e não por não ' +
        'haver duplicado. Peça ao administrador para rodar o pareamento.',
    };
  }
  if (estado.desatualizado) {
    return {
      //: O QUANDO EM PALAVRA DE GENTE, com a data exata no `title`: a pergunta é
      //: "está velho?", e não "que dia foi". Mesmo rótulo da aba das cargas.
      texto:
        `O cadastro mudou depois do último pareamento (${quantoTempo(
          estado.calculado_em,
        )}): pode haver duplicado que ainda não está nesta lista. O pareamento se ` +
        'refaz na próxima subida de planilha que criar cadastro, ou pelo ' +
        'administrador.',
      titulo: `Pareado em ${new Date(estado.calculado_em).toLocaleString('pt-BR')}`,
    };
  }
  return null;
}

export function FilaDeDuplicados() {
  const [fila, definirFila] = useState<CadastroDuplicado[] | null>(null);
  //: NULO É "AINDA CARREGANDO", e não um estado: desenhar a fila antes de saber
  //: se ela foi pareada é a mentira que esta tela existe para não contar.
  const [estado, definirEstado] = useState<Estado | null>(null);
  const [pagina, definirPagina] = useState(1);
  const [erro, definirErro] = useState('');
  const [emCurso, definirEmCurso] = useState('');
  //: A BUSCA, pedida pelo dono do produto: "deve uma barra de busca para
  //: facilitar buscar de instituições chave".
  //:
  //: EM MEMÓRIA, E NÃO NO SERVIDOR: a fila inteira já está aqui — ela é lida UMA
  //: vez na abertura. Mandar a busca para o servidor pagaria uma ida à rede a
  //: cada tecla para filtrar uma lista que já está nesta função.
  const [busca, definirBusca] = useState('');
  const termo = busca.trim().toLowerCase();

  //: BUSCA NOVA VOLTA PARA A PÁGINA 1, ajustado no render — o mesmo padrão da
  //: lista "Cadastrados" (`CadastroDeInstituicoes`) e do `CampoDePeriodo`. Sem
  //: isto, buscar estando na página 15 mostraria uma lista vazia com navegação.
  //:
  //: AQUI E NÃO JUNTO DO FILTRO, onde ele seria lido melhor: abaixo há `return`
  //: antecipados (fila carregando, fila vazia), e um `useState` depois deles é
  //: hook condicional — React recusa com "Rendered more hooks than during the
  //: previous render" e a tela inteira deixa de desenhar. Medido: 13 dos 14
  //: testes desta tela caíram de uma vez.
  const [termoAnterior, definirTermoAnterior] = useState(termo);
  if (termo !== termoAnterior) {
    definirTermoAnterior(termo);
    definirPagina(1);
  }

  //: A GUARDA DE ORDEM, E AGORA ELA GUARDA ALGO.
  //:
  //: Ela saiu quando a releitura por decisão saiu: com um chamador só não havia
  //: corrida, e guarda que não guarda nada é comentário fingindo ser código. O
  //: comentário de então previu o que a traria de volta — "se um dia a tela
  //: ganhar um atualizar" —, e é o que aconteceu: o estado se relê a cada mudança
  //: de catálogo, duas mudanças seguidas deixam duas leituras no ar, e a primeira
  //: a voltar não é a mais nova. Vale também para a leitura da ABERTURA, que é a
  //: mais lenta e pode voltar depois de uma do barramento.
  //:
  //: PELA LISTA NÃO VALE: ela continua sendo lida UMA vez. O desenho é o da
  //: `FilaDeRevisao`.
  const leituraMaisNova = useRef(0);

  //: A LEITURA DO ESTADO, de todos os caminhos. NUNCA REJEITA: quem a chama já
  //: tem o que fazer com "não deu para conferir", e é ele que impede a tela de
  //: tratar silêncio como "em dia".
  //:
  //: O RETORNO DO `catch` É ANOTADO porque sem isso ele alarga a literal para
  //: `string`, e aí o estado deixa de ser os três casos de `avisoDaFila`.
  const lerOEstado = useCallback(async () => {
    const minha = (leituraMaisNova.current += 1);
    const agora = await estadoDaFilaDeDuplicados().catch(
      (): Estado => DESCONHECIDO,
    );
    if (minha === leituraMaisNova.current) definirEstado(agora);
  }, []);

  const carregar = useCallback(() => {
    //: AS DUAS NA MESMA IDA. A listagem é a fila; o estado é o que autoriza a
    //: tela a dizer "nenhum duplicado". Em série, a tela desenharia zero antes
    //: de saber se zero é verdade — e é esse instante que o aviso existe para
    //: não acontecer.
    //:
    //: O ESTADO FALHA SOZINHO SEM DERRUBAR A FILA: par para decidir vale mais
    //: que a ressalva sobre ele, e por isso `lerOEstado` não rejeita.
    Promise.all([duplicadosDeCadastro(), lerOEstado()])
      .then(([lista]) => {
        definirFila(lista);
        definirErro('');
      })
      .catch((falha: Error) => {
        //: A FILA É ACESSÓRIA: ela não pode derrubar o cadastro inteiro. O erro
        //: aparece no lugar dela e o resto da tela segue funcionando.
        //:
        //: E O ESTADO NÃO É TOCADO AQUI: só a lista falhou, `lerOEstado` já
        //: gravou o que achou, e sobrescrever seria disputar com ela.
        definirFila([]);
        definirErro(falha.message);
      });
  }, [lerOEstado]);

  useEffect(carregar, [carregar]);

  //: O AVISO ACOMPANHA O CADASTRO MUDANDO COM A TELA ABERTA — achado da revisão
  //: do Codex, e procedente: `CadastroDeInstituicoes` desenha o formulário de
  //: cadastro e esta fila na MESMA página, então criar um veículo aqui deixava o
  //: aviso velho até a próxima montagem. É justamente o caso que `desatualizado`
  //: existe para pegar.
  //:
  //: SÓ O ESTADO, E NUNCA A LISTA. Não é que reler ressuscitaria o par decidido —
  //: `listar` lê `ator_distinto` ao vivo e exclui na leitura. É que o barramento
  //: avisa em TODA escrita de catálogo, inclusive nas desta tela: reler a lista
  //: aqui devolveria uma requisição por decisão, que é o custo que saiu.
  //:
  //: O barramento esquece o cache antes dos ouvintes, então a leitura daqui é a de
  //: depois da escrita.
  useEffect(() => catalogoMudou.assinar(() => void lerOEstado()), [lerOEstado]);

  async function responder(
    perfil: CadastroDuplicado,
    candidato: CandidatoDeFusao,
    resposta: 'fundir' | 'distinto',
    //: QUEM FICA, quando a resposta é fundir. `candidato` é a proposta do
    //: servidor — a linha com história, ou a curada. `perfil` é a escolha
    //: contrária, e o pedido do dono do produto: "temos que dizer qual é o real
    //: para ser considerado na unificação".
    quemFica: 'candidato' | 'perfil' = 'candidato',
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
        //: QUEM SAI É O OUTRO LADO DE QUEM FICA, e as menções que passam são as
        //: de quem sai — era sempre `perfil.mencoes` porque a direção era fixa.
        //: Com a escolha aberta, usar o número errado faria a PRÓXIMA decisão
        //: sobre o mesmo sobrevivente ser tomada com a contagem errada, e esse
        //: número é o que diz qual é a linha com história.
        const fica = quemFica === 'candidato' ? candidato : perfil;
        const sai = quemFica === 'candidato' ? perfil : candidato;
        //: SEM AVISAR A TELA DE FORA: `/api/instituicoes/.../fundir` está sob
        //: uma rota de catálogo, e o barramento de sincronização recarrega o
        //: catálogo inteiro sozinho. Ver `dominio/sincronizacao.ts`.
        //:
        //: E O TERCEIRO ARGUMENTO É A ESCOLHA DITA DE PROPÓSITO: o servidor
        //: recusa a direção inversa sem ele, o que é o que protege o clique
        //: errado de quem não estava escolhendo nada.
        await fundirCadastro(sai.id, fica.id, quemFica === 'perfil');
        definirFila((antes) =>
          antes
            ? semOCadastro(antes, sai.id, fica.id, sai.mencoes, sai.origens)
            : antes,
        );
      } else {
        await declararCadastroDistinto(perfil.id, candidato.id);
        definirFila((antes) =>
          antes ? semOPar(antes, perfil.id, candidato.id) : antes,
        );
      }
      //: SEM RELEITURA AQUI. As duas funções acima são a lista nova, inteira — o
      //: servidor devolveria o mesmo, menos o que outra pessoa tenha decidido ou
      //: um recálculo tenha acrescentado nesse meio. Era o custo da releitura que
      //: pesava (7,4 s na base real, antes da `0118`); hoje o que a dispensa é o
      //: resultado, e a defasagem que sobra é a do estado, que o aviso cobre.
    } catch (falha) {
      definirErro((falha as Error).message);
    } finally {
      definirEmCurso('');
    }
  }

  if (fila === null || estado === null) {
    return (
      <Secao titulo="Possíveis duplicados">
        <Cartao>
          <Carregando rotulo="Procurando o mesmo ator cadastrado duas vezes…" />
        </Cartao>
      </Secao>
    );
  }

  //: O ERRO DA FILA JÁ EXPLICA O VAZIO, então a ressalva do estado cala: duas
  //: faixas sobre a mesma falha é uma a mais para ler.
  const aviso = erro ? null : avisoDaFila(estado);

  //: FILA VAZIA NÃO OCUPA TELA. Não há nada a fazer, e um cartão dizendo
  //: "nenhum duplicado" seria uma linha a mais para ler em toda abertura.
  //:
  //: E SÓ QUANDO O VAZIO É VERDADE — foi isto que mudou com o pareamento
  //: guardado. Sem a conferência do estado, a tela sumia calada nos dois casos em
  //: que ela mais precisa falar: pareamento que nunca rodou, e cadastro que
  //: mudou depois dele.
  if (fila.length === 0 && !erro && !aviso) return null;

  //: A BUSCA OLHA OS DOIS LADOS do par, e não só quem pergunta: procurar "valor"
  //: tem de achar a pergunta ancorada em `valoreconomico` tanto quanto a ancorada
  //: no `Valor Econômico`. Olhar só a âncora esconderia metade dos pares de uma
  //: instituição-chave — que é exatamente o caso que a busca existe para achar.
  const encontrados = termo
    ? fila.filter(
        (perfil) =>
          perfil.nome.toLowerCase().includes(termo) ||
          perfil.candidatos.some((c) => c.nome.toLowerCase().includes(termo)),
      )
    : fila;

  const totalDePaginas = Math.max(1, Math.ceil(encontrados.length / POR_PAGINA));
  //: CORRIGIDA NO RENDER, e não por efeito: cada decisão TIRA uma linha da
  //: fila, então a última página encolhe sob os pés de quem está nela. A busca
  //: encurta a lista do mesmo jeito, e cai na mesma correção.
  const paginaAgora = Math.min(pagina, totalDePaginas);
  const naTela = encontrados.slice(
    (paginaAgora - 1) * POR_PAGINA,
    paginaAgora * POR_PAGINA,
  );

  //: O NÚMERO SÓ APARECE SE HOUVER PAREAMENTO POR TRÁS DELE. "(0)" numa fila que
  //: nunca foi pareada é a mentira inteira em dois caracteres: zero par guardado
  //: não é zero duplicado no cadastro. Um par na tela já prova que pareou — é por
  //: isso que a lista cheia mantém o número mesmo com o estado desconhecido.
  const pareada =
    (estado !== DESCONHECIDO && estado.calculado_em !== null) || fila.length > 0;

  return (
    <Secao
      recolhivel
      titulo={
        pareada ? `Possíveis duplicados (${fila.length})` : 'Possíveis duplicados'
      }
      ajuda={
        'O mesmo ator cadastrado duas vezes: o fornecedor de redes manda o ' +
        'handle (valoreconomico) e o clipping manda o nome (Valor Econômico). ' +
        'Fundir junta as menções dos dois num cadastro só — e não tem volta.'
      }
    >
      <Cartao>
        {erro ? <FaixaDeErro mensagem={erro} /> : null}

        {/* A RESSALVA SOBRE O PAREAMENTO, quando existe uma — ver `avisoDaFila`.
            ACIMA DA BUSCA de propósito: ela muda o que a lista inteira significa,
            e quem já está filtrando não vai subir para descobrir isso. */}
        {aviso ? (
          <FaixaDeAtencao
            mensagem={<span title={aviso.titulo}>{aviso.texto}</span>}
          />
        ) : null}

        {/* A BUSCA, pedida pelo dono do produto: "deve uma barra de busca para
            facilitar buscar de instituições chave". Com 209 pares a decidir,
            chegar ao Valor Econômico pela paginação é folhear vinte páginas.

            NADA PARA BUSCAR NUMA FILA VAZIA: com o aviso do pareamento a seção
            passou a aparecer sem par nenhum, e um campo de busca ali é um
            convite a digitar num lugar onde nada pode ser achado. */}
        {fila.length > 0 ? (
          <div style={{ maxWidth: 360, marginBottom: 4 }}>
            <Campo rotulo="Buscar">
              <input
                style={estiloDeEntrada}
                value={busca}
                onChange={(e) => definirBusca(e.target.value)}
                placeholder="Parte do nome"
              />
            </Campo>
          </div>
        ) : null}

        {/* A BUSCA QUE NÃO ACHA NADA DIZ ISSO. Sem esta linha, o cartão fica com
            a barra de busca e um vazio embaixo — e quem digitou não sabe se
            errou o nome ou se não há par nenhum com ele.

            E SÓ ENQUANTO HÁ LISTA, pelo mesmo motivo do campo acima: `busca` é
            estado da tela e sobrevive às decisões que esvaziam a fila. Sem esta
            guarda, decidir o último par com algo digitado deixava um "Nenhum par
            com «valor»" sob o aviso do pareamento — citando um termo cujo campo
            já não está na tela. */}
        {fila.length > 0 && termo && encontrados.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: '10px 0 0' }}>
            {`Nenhum par com «${busca.trim()}» — a fila tem ${fila.length} ${
              fila.length === 1 ? 'par' : 'pares'
            } a decidir.`}
          </p>
        ) : null}

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
              {/* DE ONDE VEM O REGISTRO. É a evidência da duplicata: um lado
                  chegou pelo clipping e o outro pelo CRM — "pode ter várias
                  fontes distintas, mas a instituição é a mesma". */}
              {deOndeVem(perfil.origens) ? ` · ${deOndeVem(perfil.origens)}` : ''}
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
                    {deOndeVem(candidato.origens)
                      ? ` · ${deOndeVem(candidato.origens)}`
                      : ''}
                  </span>
                  {/* QUAL DOS DOIS É O REAL, e é o pedido do dono do produto:
                      "não basta termos uma opção de dizer se são ou não o mesmo,
                      além de mostrar quais podem se juntar temos que dizer qual
                      é o real para ser considerado na unificação".

                      ERA UM BOTÃO SÓ — "Fundir em «candidato»" —, e a direção
                      vinha do servidor: sobrevive a linha com história, ou a
                      curada. A proposta está certa quase sempre, e continua
                      marcada como `primario`; o que ela não pode é ter a última
                      palavra, porque só quem conhece o ator sabe quando o
                      cadastro certo é o outro.

                      O TÍTULO DIZ O QUE SE PERDE, e não é detalhe: o cadastro
                      que fica mantém o NOME dele. Escolher o handle como o real
                      deixa o cadastro chamado `valoreconomico` com as menções do
                      Valor Econômico dentro — e isso tem de estar na tela ANTES
                      do clique, porque fusão não tem volta. */}
                  <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                    <Botao
                      variante="primario"
                      desabilitado={ocupado}
                      aoClicar={() => void responder(perfil, candidato, 'fundir')}
                      rotuloAcessivel={`Manter ${candidato.nome} e apagar ${perfil.nome}`}
                      titulo={
                        `O cadastro fica chamado «${candidato.nome}». As ` +
                        `${mencoes(perfil.mencoes)} de ${perfil.nome} passam para ele, ` +
                        `e «${perfil.nome}» vira apelido — o fornecedor que mandar esse ` +
                        'nome continua caindo aqui. Não tem volta. É a sugestão: ' +
                        'tem mais menções, ou é o cadastro curado.'
                      }
                    >
                      {`Manter «${candidato.nome}»`}
                    </Botao>
                    <Botao
                      desabilitado={ocupado}
                      aoClicar={() =>
                        void responder(perfil, candidato, 'fundir', 'perfil')
                      }
                      rotuloAcessivel={`Manter ${perfil.nome} e apagar ${candidato.nome}`}
                      titulo={
                        `O cadastro fica chamado «${perfil.nome}». As ` +
                        `${mencoes(candidato.mencoes)} de ${candidato.nome} passam para ` +
                        `ele, e «${candidato.nome}» vira apelido — o fornecedor que ` +
                        'mandar esse nome continua caindo aqui. Não tem volta.'
                      }
                    >
                      {`Manter «${perfil.nome}»`}
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
        {encontrados.length > POR_PAGINA ? (
          <p
            style={{
              margin: '12px 0 0',
              paddingTop: 12,
              borderTop: '1px solid var(--cinza-0)',
              fontSize: 12,
              color: 'var(--cinza-2)',
            }}
          >
            {/* O NÚMERO É O DA LISTA NA TELA, e não o da fila inteira: durante
                uma busca, "209 pares a decidir" ao pé de uma lista de 3 diz que
                a navegação percorre 209 — e ela percorre os 3. O total da fila
                continua no título da seção, que é onde ele é verdade. */}
            {`Página ${paginaAgora} de ${totalDePaginas} — ${encontrados.length} ${
              encontrados.length === 1 ? 'par' : 'pares'
            }${termo ? ` com «${busca.trim()}»` : ''} a decidir.`}
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
