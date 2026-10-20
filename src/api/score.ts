/** Os KPIs Reputacionais: lentes, menÃ§Ãµes, riscos, planilha.
 *
 *  Saiu de `cliente.ts` em 17/10/2026, quando ele tinha 90 funÃ§Ãµes e 2.481
 *  linhas e trÃªs entregas sem relaÃ§Ã£o entre si disputavam o mesmo arquivo.
 *  `cliente.ts` continua existindo como barril de reexportaÃ§Ã£o: nenhum dos
 *  66 arquivos que o importam precisou mudar.
 */

import type { Bloco, Dossie } from '@/dominio/dossie';
import type { Dados as ConsultaDaLente } from '@/paginas/score/consulta/dados/tipos';
import type { FiltroDoRisco, OpcoesDoRisco, PaginaDeIncidentes, PainelDeRisco } from '@/dominio/riscos';
import type { Calibracao, CalibracaoEntrada, DriversDoScore, FatoDoMes, FonteDoScore, ImportacaoDoScore, IndiceDoScore, OpcoesDoScore, PontoDaSerie } from '@/dominio/score';
import { requisitar } from './nucleo';

/** O índice do mês, com as lentes que o formaram.
 *
 *  O CÁLCULO É DO SERVIDOR: o ISR é citado em reunião, e precisa ser o mesmo
 *  para todo mundo — calculado uma vez, com a régua que a coordenação gravou,
 *  e não recomputado em cada navegador. */
export function obterScore(mes: string): Promise<IndiceDoScore> {
  return requisitar<IndiceDoScore>(`/api/score?mes=${mes}`);
}

export function obterSerieDoScore(): Promise<PontoDaSerie[]> {
  return requisitar<PontoDaSerie[]>('/api/score/serie');
}

export function listarFontesDoScore(mes: string): Promise<FonteDoScore[]> {
  return requisitar<FonteDoScore[]>(`/api/score/fontes?mes=${mes}`);
}

/** Sobe o export do fornecedor. SUBSTITUI os meses que o arquivo traz — o
 *  fornecedor reenvia a planilha quando corrige uma classificação, e somar
 *  contaria o mesmo post duas vezes.
 *
 *  DEVOLVE UMA LINHA POR FONTE: um arquivo alimenta mais de uma. O export da
 *  Clipei atende Imprensa e, recortado por público investidor, Mercado; o da
 *  Approach traz Social Listening e Community Management em abas diferentes.
 *  Quem escolhe "Importar" numa das linhas alimenta todas as irmãs. */
/** A planilha a importar: o arquivo, ou a que a conferência já guardou.
 *
 *  OS BYTES SÓ SOBEM UMA VEZ quando a conferência pôde guardá-los. Medido em
 *  15/10/2026 no clipping real da Clipei (10,53 MB): mandar o arquivo de novo
 *  na confirmação são 21 MB para um trabalho que precisa de 10,53 — e a
 *  segunda subida acontece dentro do mesmo relógio de gateway que já estourou.
 *
 *  O ARQUIVO CONTINUA VALENDO, e não é legado: a Calibração importa SEM
 *  conferir, e um ambiente sem armazenamento devolve `planilha_id` nulo. Quem
 *  não tem identificador manda os bytes, como sempre. */
export type PlanilhaAImportar = File | { planilhaId: string };

export function importarPlanilhaDoScore(
  codigo: string,
  planilha: PlanilhaAImportar,
  veiculosACriar: string[] = [],
): Promise<ImportacaoDoScore[]> {
  const corpo = new FormData();
  // UM DOS DOIS, NUNCA OS DOIS: o servidor recusa o pedido que traz arquivo e
  // identificador juntos, em vez de escolher um em silêncio.
  if (planilha instanceof File) {
    corpo.append('arquivo', planilha);
  } else {
    corpo.append('planilha_id', planilha.planilhaId);
  }
  // UM CAMPO COM A LISTA EM JSON, e não um campo por nome.
  //
  // A primeira versão mandava `veiculos_a_criar` repetido, uma vez por veículo.
  // Com 2.628 veículos na primeira carga da Clipei, o parser multipart do
  // servidor recusou o pedido inteiro: "Too many fields. Maximum number of
  // fields is 1000". O limite é proteção do servidor e está certo — quem estava
  // errado era o formato.
  //
  // A LISTA VAZIA NÃO MANDA NADA: o padrão do servidor é não criar veículo
  // nenhum, e é esse padrão que protege o botão "Importar planilha" da
  // Calibração de criar 2.631 instituições sem ninguém ter visto.
  if (veiculosACriar.length) {
    corpo.append('veiculos_a_criar', JSON.stringify(veiculosACriar));
  }
  return requisitar<ImportacaoDoScore[]>(`/api/score/fontes/${codigo}/planilha`, {
    method: 'POST',
    body: corpo,
  });
}

/** Um veículo que a planilha traz e o cadastro compartilhado não tem. */
export interface VeiculoNovo {
  nome: string;
  /** A praça, como o fornecedor a manda — "Santa Catarina", não "SC". */
  uf: string | null;
  /** O alcance derivado da coluna `Abrangência`: Municipal, Regional,
   *  Nacional, Internacional. Nulo quando o fornecedor não disse. */
  esfera: string | null;
  /** Quantas menções da planilha o citam. É por aqui que a lista ordena. */
  mencoes: number;
  /** O cargo que o fornecedor informou, já com as grafias dobradas.
   *
   *  É ELE QUE DECIDE O PÚBLICO do perfil no cadastro — vereador entra em
   *  Poder Legislativo / Municipal, e não em Formadores de Opinião. Quem
   *  autoriza 1.108 criações precisa ver "Iriel Sachet — Vereador". */
  cargo?: string | null;
}

/** Um assunto que a planilha traz e o cadastro de temas não reconhece. */
export interface AssuntoNaoReconhecido {
  /** O texto como o fornecedor o escreveu — é o que se procura na planilha. */
  nome: string;
  /** Quantas linhas o citam. A lista vem ordenada por aqui. */
  mencoes: number;
  /** O NOME EXISTE NO CADASTRO, MAS ESTÁ DESATIVADO. São dois problemas com
   *  dois consertos: nome errado se arruma na planilha, tema desativado se
   *  arruma no cadastro — ou é a planilha que está na taxonomia antiga. */
  desativado: boolean;
}

/** Uma concessionária que a planilha traz e o cadastro central não resolve. */
export interface ConcessionariaNaoReconhecida {
  /** O texto como o fornecedor o escreveu — é o que se procura na planilha. */
  nome: string;
  /** Quantas linhas a citam. A lista vem ordenada por aqui. */
  mencoes: number;
  /** AS UNIDADES DO CADASTRO QUE ESTE NOME PODE SER, quando são mais de uma.
   *
   *  LISTA CHEIA E LISTA VAZIA SÃO PROBLEMAS DIFERENTES, e é por isso que o
   *  campo é uma lista e não um booleano. Cheia: o nome está CERTO e mesmo
   *  assim não liga — "Águas do Pará" são quatro blocos no cadastro, e o
   *  conserto é o fornecedor informar qual. Vazia: o cadastro não tem nada
   *  parecido, e o conserto é cadastrar a unidade. */
  opcoes?: string[];
}

export interface ConferenciaDaPlanilhaDoScore {
  /** Uma linha por fonte irmã — o que a subida FARIA. */
  previsao: ImportacaoDoScore[];
  /** O que nasceria no cadastro. Na primeira carga da Clipei, 2.631. */
  veiculos_novos: VeiculoNovo[];
  /** Quantos veículos da planilha o cadastro já reconhece. */
  veiculos_reconhecidos: number;
  /** Quantas linhas achariam assunto no cadastro de temas.
   *
   *  POR QUE ESTE NÚMERO IMPORTA: o dossiê recorta por Pilar (N1), Tema
   *  estratégico (N2) e Subtema (N3) pelo vínculo da menção com o tema. Sem
   *  vínculo, a linha não entra em recorte nenhum — subir planilha cujo
   *  assunto não casa é subir dado que nenhum filtro alcança. */
  mencoes_com_tema?: number;
  /** Quantas vieram SEM assunto. Não é erro: a planilha da Bites de 01–09/2026
   *  veio com 84% da coluna em branco, e o conteúdo vai ser refeito. */
  mencoes_sem_assunto?: number;
  /** Os nomes que o cadastro não reconhece, por volume — os 30 maiores. */
  assuntos_nao_reconhecidos?: AssuntoNaoReconhecido[];
  /** Quantas linhas achariam concessionária no cadastro central.
   *
   *  POR QUE ESTE NÚMERO IMPORTA: sem o vínculo, a dimensão "Concessionária"
   *  agrupa pelo texto do fornecedor, e a mesma operação em duas grafias vira
   *  duas barras no gráfico — a Corsan chega como "Corsan" e como "Companhia
   *  Riograndense de Saneamento (Corsan)". */
  mencoes_com_concessionaria?: number;
  /** Quantas vieram SEM concessionária. Hoje são 37 em 104.670 — o número
   *  aparece porque um export que a perca não deve passar em silêncio. */
  mencoes_sem_concessionaria?: number;
  /** As que o cadastro não resolve, por volume — as 30 maiores. */
  concessionarias_nao_reconhecidas?: ConcessionariaNaoReconhecida[];
  /** O arquivo JÁ ESTÁ GUARDADO no servidor, e a confirmação pode citá-lo em
   *  vez de subir os mesmos bytes de novo.
   *
   *  NULO QUANDO O AMBIENTE NÃO TEM ARMAZENAMENTO — e aí a tela manda o
   *  arquivo, como sempre fez. Nunca tratar a ausência como erro: a economia é
   *  uma economia, não um pré-requisito. */
  planilha_id?: string | null;
}

/** Lê o export do fornecedor e diz o que a subida faria. NADA É GRAVADO.
 *
 *  POR QUE ELA EXISTE. O veículo sem cadastro nasce junto com a subida, e a
 *  conta aparece antes — foi o pedido, nas duas metades. A segunda é o que
 *  torna a primeira segura: a importação de agendas tem escrito no próprio
 *  código que "importação de planilha sem conferência humana cria duplicata de
 *  instituição em massa, e desfazer isso depois é pior que digitar de novo".
 *
 *  O ARQUIVO SOBE DUAS VEZES — aqui e na confirmação. É o preço de não ter
 *  tabela de rascunho, e o mesmo desenho da revisão da taxonomia: guardar as
 *  propostas exigiria a tabela que este fluxo dispensa.
 */
export function conferirPlanilhaDoScore(
  codigo: string,
  arquivo: File,
): Promise<ConferenciaDaPlanilhaDoScore> {
  const corpo = new FormData();
  corpo.append('arquivo', arquivo);
  return requisitar<ConferenciaDaPlanilhaDoScore>(
    `/api/score/fontes/${codigo}/conferencia`,
    { method: 'POST', body: corpo },
  );
}

/** ACIMA DISTO A PLANILHA SOBE EM PARTES, e o número sai de medição.
 *
 *  MEDIDO NO AMBIENTE em 16/10/2026, pela telemetria do navegador — o mesmo
 *  arquivo, a mesma máquina, a mesma hora:
 *
 *      1,42 MB  ->    4,1 s  -> 200
 *      1,33 MB  ->   73,2 s  -> 200
 *      3,27 MB  ->   ~240 s  -> 403   (a planilha da Approach, em produção)
 *     10,53 MB  ->  212,4 s  -> 403
 *     10,53 MB  ->  227,4 s  -> 403
 *
 *  Os 403 param em ~212–240 s porque o ingress do Container Apps encerra a
 *  requisição por volta de 240 s, e isso não é configurável. A banda de subida
 *  variou de ~18 KB/s a ~350 KB/s na MESMA hora.
 *
 *  ESTE NÚMERO JÁ ESTEVE ERRADO, e a linha de 3,27 MB é o preço. Ele era 4 MB,
 *  e o comentário que o justificava dizia, com estes mesmos dados, que "a
 *  18 KB/s 4 MB levam ~230 s e NÃO caberiam" — e escolhia 4 MB de todo jeito,
 *  apostando que a banda ruim não voltaria. Voltou: a planilha da Approach tem
 *  3,27 MB, passou por baixo do limiar, foi numa requisição só e morreu no
 *  ingress. Quem usava leu um 403 em HTML.
 *
 *  O LIMIAR AGORA FICA ABAIXO DO ÚNICO ARQUIVO GRANDE QUE SE VIU COMPLETAR no
 *  pior momento de banda: 1,33 MB em 73,2 s. A 1,2 MB o caminho de uma vez só
 *  guarda mais de 3x de margem contra os 240 s, contando a leitura por cima —
 *  que, medida, é da ordem de 11 s para a Approach e 7 s para a Clipei. O teto
 *  não adivinha banda: ele garante que o caso ruim ainda caiba.
 *
 *  POR QUE NÃO SEMPRE EM PARTES: o caminho de uma vez é uma requisição em vez
 *  de três, e não depende de armazenamento. Arquivo pequeno não paga por uma
 *  máquina de estados que não precisa.
 *
 *  O QUE ISSO CUSTA: o mês da Clipei (1,3 a 2,1 MB) passa a subir em partes —
 *  abertura, duas ou três partes, conferência. Medido no ambiente, cada parte
 *  custa ~0,5 s, então são ~2 s a mais no caso bom para não ter 4 minutos e um
 *  403 no caso ruim.
 *
 *  `Math.round` PORQUE 1,2 MiB NÃO É INTEIRO: 1,2 × 1024 × 1024 = 1.258.291,2,
 *  e um limiar fracionário compara certo mas não serve de tamanho de arquivo —
 *  o teste da borda exata criaria um `File` de 1.258.291,2 bytes. */
export const TAMANHO_PARA_SUBIR_EM_PARTES = Math.round(1.2 * 1024 * 1024);

interface SubidaAberta {
  /** NULO SIGNIFICA "AQUI NÃO DÁ, MANDE DE UMA VEZ" — ambiente sem
   *  armazenamento não tem onde montar as partes. É a mesma convenção que a
   *  conferência de uma vez só usa para dizer que não guardou o arquivo. */
  planilha_id: string | null;
  tamanho_da_parte: number;
}

/** Confere uma planilha GRANDE, subindo-a em pedaços.
 *
 *  POR QUE ESTE CAMINHO EXISTE: ver `TAMANHO_PARA_SUBIR_EM_PARTES`. O problema
 *  não é o processamento — a conferência leva ~7 s para 10,53 MB — é a
 *  requisição longa, que o ingress encerra.
 *
 *  `aoProgresso` NÃO É ENFEITE. Onze requisições levam minutos, e uma tela
 *  parada por minutos se lê como travada: foi exatamente assim que este defeito
 *  apareceu para quem usava ("está demorando", sem erro nenhum). Quem chama
 *  precisa poder dizer em que parte está.
 *
 *  NÃO SUBSTITUI `conferirPlanilhaDoScore`: devolve a MESMA resposta, porque é
 *  a mesma montagem no servidor. A tela não distingue os dois depois daqui. */
export async function conferirPlanilhaDoScoreEmPartes(
  codigo: string,
  arquivo: File,
  aoProgresso?: (enviadas: number, total: number) => void,
): Promise<ConferenciaDaPlanilhaDoScore> {
  const abertura = new FormData();
  abertura.append('tamanho', String(arquivo.size));
  // O NOME VEM AGORA, e não no fim: a linha da subida nasce na abertura (ver a
  // migration 0094), e `nome` é coluna obrigatória dela. Mandá-lo nos dois
  // lugares convidaria os dois a divergirem.
  abertura.append('nome', arquivo.name);
  const { planilha_id, tamanho_da_parte } = await requisitar<SubidaAberta>(
    `/api/score/fontes/${codigo}/planilha/upload`,
    { method: 'POST', body: abertura },
  );

  // SEM ARMAZENAMENTO, O CAMINHO DE SEMPRE. O servidor diz isso com
  // `planilha_id` nulo, e aqui é o único lugar que precisa saber: a tela chama
  // `conferirPlanilhaDoScoreComoCouber` e recebe a mesma resposta nos dois
  // casos.
  //
  // ESTE RETORNO É O QUE FAZ O LIMIAR MENOR SER SEGURO. Antes o servidor
  // recusava com 422 e esta função repassava a recusa — a pessoa lia "este
  // ambiente não guarda arquivos" sem ter pedido nada sobre armazenamento. Com
  // o limiar em 4 MB isso era raro; com 1,2 MB seria quase toda planilha em
  // ambiente sem blob.
  //
  // E NÃO SE DETECTA POR ERRO: o envelope do back é `{detalhe, referencia}` e
  // não traz código, então capturar o 422 confundiria esta causa com "fonte
  // inativa" e "passa de 80 MB" — e cairia no caminho de uma vez só justamente
  // nos dois casos em que ele também vai falhar, depois de subir o arquivo
  // inteiro.
  if (planilha_id === null) return conferirPlanilhaDoScore(codigo, arquivo);

  // O TAMANHO DA PARTE VEM DO SERVIDOR, e não daqui: é ele que conhece o teto
  // do ingress e a margem que escolheu. Um número nosso divergiria do dele na
  // primeira mudança, e a divergência só apareceria como parte recusada.
  const total = Math.ceil(arquivo.size / tamanho_da_parte);
  aoProgresso?.(0, total);

  // UMA POR VEZ, e não em paralelo. O servidor aceita qualquer ordem — o teste
  // dele cobra isso —, mas em paralelo as partes disputam a MESMA banda que
  // acabou de se mostrar o gargalo, e o progresso deixaria de significar
  // "quanto subiu". Sequencial é mais lento em rede boa e mais legível em rede
  // ruim, que é onde este caminho é usado.
  for (let indice = 0; indice < total; indice += 1) {
    const inicio = indice * tamanho_da_parte;
    const pedaco = arquivo.slice(inicio, inicio + tamanho_da_parte);
    const corpo = new FormData();
    // O NOME DO ARQUIVO NÃO IMPORTA AQUI: o servidor lê os bytes da parte, e o
    // nome de verdade foi na abertura. Mandar um fixo evita que um nome com
    // caractere estranho quebre a parte.
    corpo.append('parte', pedaco, `parte-${indice}`);
    await comTentativas(() =>
      requisitar<void>(
        `/api/score/fontes/${codigo}/planilha/${planilha_id}/parte/${indice}`,
        { method: 'PUT', body: corpo },
      ),
    );
    aoProgresso?.(indice + 1, total);
  }

  const fechamento = new FormData();
  fechamento.append('partes', String(total));
  return requisitar<ConferenciaDaPlanilhaDoScore>(
    `/api/score/fontes/${codigo}/planilha/${planilha_id}/conferencia`,
    { method: 'POST', body: fechamento },
  );
}

/** Quantas vezes uma parte é tentada antes de desistir. */
const TENTATIVAS_POR_PARTE = 3;

/** Repete a parte que falhou por motivo TRANSITÓRIO.
 *
 *  POR QUE EXISTE: o servidor fez o `PUT` idempotente por índice justamente
 *  para permitir repetir — e a primeira versão deste cliente abortava na
 *  primeira falha, desperdiçando a garantia. Numa rede ruim, que é o caso de
 *  uso inteiro, uma parte falha e a pessoa recomeçava o arquivo de dez
 *  megabytes. Achado da revisão do Codex em 16/10/2026.
 *
 *  SÓ O QUE PODE DAR CERTO NA SEGUNDA: falha de rede, 408, 429 e 5xx. Um 4xx
 *  determinístico — parte fora de faixa, tamanho errado, subida que não é sua —
 *  dá o mesmo resultado três vezes, e repetir só atrasa a mensagem que a pessoa
 *  precisa ler.
 *
 *  ESPERA CRESCENTE COM RUÍDO: 400 ms, 800 ms, e o ruído evita que dez partes
 *  que falharam juntas voltem todas no mesmo instante. Sem o teto de três, uma
 *  rede caída viraria laço infinito com a tela dizendo que está subindo.
 */
async function comTentativas<T>(fazer: () => Promise<T>): Promise<T> {
  for (let tentativa = 1; ; tentativa += 1) {
    try {
      return await fazer();
    } catch (falha) {
      if (tentativa >= TENTATIVAS_POR_PARTE || !valeTentarDeNovo(falha)) throw falha;
      const espera = 400 * 2 ** (tentativa - 1) * (1 + Math.random() * 0.3);
      await new Promise((pronto) => setTimeout(pronto, espera));
    }
  }
}

/** A falha é do tipo que pode dar certo na próxima? */
function valeTentarDeNovo(falha: unknown): boolean {
  // SEM `status` É FALHA DE REDE: o `fetch` rejeita antes de haver resposta, e
  // é o caso mais comum numa conexão instável — o que este caminho existe para
  // atender.
  const status = (falha as { status?: number } | null)?.status;
  if (status === undefined) return true;
  return status === 408 || status === 429 || status >= 500;
}

/** Confere a planilha pelo caminho que o tamanho dela pede.
 *
 *  É ESTA QUE A TELA CHAMA, e é a única que ela precisa conhecer: a escolha
 *  entre uma requisição e onze é de transporte, não de produto. Deixá-la na tela
 *  espalharia a decisão por cada lugar que confere planilha — e hoje são dois,
 *  a Base e a Calibração. */
export function conferirPlanilhaDoScoreComoCouber(
  codigo: string,
  arquivo: File,
  aoProgresso?: (enviadas: number, total: number) => void,
): Promise<ConferenciaDaPlanilhaDoScore> {
  if (arquivo.size > TAMANHO_PARA_SUBIR_EM_PARTES) {
    return conferirPlanilhaDoScoreEmPartes(codigo, arquivo, aoProgresso);
  }
  return conferirPlanilhaDoScore(codigo, arquivo);
}

/** O que a gravação da lista de veículos de investidores mudou. */
export interface VeiculosDeInvestidoresSalvos {
  /** Quantos entraram na lente Mercado agora. */
  marcados: number;
  /** Quantos saíram. É o número que a tela repete de volta: remover é a
   *  operação que a pessoa quer ver confirmada. */
  desmarcados: number;
  /** OS QUE NÃO ENTRARAM, pelo nome, por já terem outra classificação de
   *  público. O servidor não sobrescreve classificação feita à mão — e antes
   *  disto a recusa era muda: a tela dizia "Nada mudou" e limpava a edição. */
  recusados?: string[];
}

/** Define QUAIS veículos a lente Mercado considera — a lista inteira.
 *
 *  DECLARATIVA, e não um alternador por veículo. `editarInstituicao` exige o
 *  cadastro inteiro, e reenviar nome, tipo, UF e tier para mudar um campo
 *  apagaria o que a tela esquecesse. E é assim que a pessoa pensa: ela tem uma
 *  lista de veículos de mercado, mantida numa planilha, e quer que o sistema a
 *  reflita.
 *
 *  ESCREVE NO CATÁLOGO: muda `instituicao.subcategoria_publico_id`. Por isso o
 *  caminho está em `ROTAS_DO_CATALOGO` — é o que faz o Cadastro compartilhado,
 *  os filtros e as fichas verem a mudança sem F5.
 *
 *  `conhecidos` É A LISTA QUE A TELA TINHA EM MÃO quando a pessoa começou a
 *  editar, e o servidor recusa com 409 se ela mudou. Sem isso, duas pessoas
 *  editando a mesma lista se destroem em silêncio: A abre a aba de manhã, B
 *  acrescenta um veículo à tarde, A remove outro e salva — e o pedido de A, que
 *  afirma a lista INTEIRA, desmarca o veículo de B.
 */
export function definirVeiculosDeInvestidores(
  ids: string[],
  conhecidos: string[],
): Promise<VeiculosDeInvestidoresSalvos> {
  return requisitar<VeiculosDeInvestidoresSalvos>('/api/score/veiculos-de-investidores', {
    method: 'PUT',
    body: JSON.stringify({ ids, conhecidos }),
  });
}

/** Um veículo que passa a contar na lente, ou que deixa de contar. */
export interface VeiculoDaReconciliacao {
  nome: string;
  mencoes: number;
}

export interface MesDaReconciliacao {
  mes: string;
  antes: number;
  depois: number;
  /** SE O MÊS SERÁ REESCRITO, e NÃO é `antes !== depois`: um veículo que sai e
   *  outro que entra com a mesma contagem deixam o total igual e o conjunto
   *  diferente. Quem decide é o servidor; a tela não recalcula. */
  mudou: boolean;
}

/** O que muda — ou o que mudou — quando a lista passa a valer para os meses já
 *  ingeridos. */
export interface Reconciliacao {
  fonte: string;
  espelho: string;
  lista: string;
  meses: MesDaReconciliacao[];
  entram: VeiculoDaReconciliacao[];
  saem: VeiculoDaReconciliacao[];
  aplicada: boolean;
}

/** O que mudaria se a lista de AGORA valesse para trás. NÃO escreve.
 *
 *  POR QUE A PRÉVIA EXISTE: aplicar reescreve o agregado de meses FECHADOS, e o
 *  índice daqueles meses muda — o número que já foi citado em reunião. */
export function previaDaReconciliacao(): Promise<Reconciliacao[]> {
  return requisitar<Reconciliacao[]>(
    '/api/score/veiculos-de-investidores/reconciliacao',
  );
}

/** Faz a lista de agora valer para TODOS os meses já ingeridos, nos dois
 *  sentidos: o que entrou na lista passa a contar, o que saiu deixa. */
export function aplicarReconciliacao(): Promise<Reconciliacao[]> {
  return requisitar<Reconciliacao[]>(
    '/api/score/veiculos-de-investidores/reconciliacao',
    { method: 'POST' },
  );
}

/** A aba de Drivers e riscos. Lê as menções uma a uma — ver `DriversDoScore`. */
export function obterDriversDoScore(mes: string): Promise<DriversDoScore> {
  return requisitar<DriversDoScore>(`/api/score/drivers?mes=${mes}`);
}

/** O recorte de tela que a aba Lentes oferece.
 *
 *  OITO DIMENSÕES, e as quatro últimas vieram do padrão Aegea: perfil do autor,
 *  UF, subtema e autor. Nenhuma é obrigatória; o campo some da URL quando vazio.
 *
 *  ELAS SE EMPILHAM — `{ uf: 'RJ', perfil_autor: 'Figura pública' }` é "figuras
 *  públicas no Rio", e não uma coisa OU a outra. É o nível 3 do pacote, e é o que
 *  faz um link reproduzir o ponto exato do caminho. */
export interface FiltroDaLente {
  tier?: string;
  veiculo?: string;
  atributo?: string;
  tema?: string;
  perfil_autor?: string;
  uf?: string;
  subtema?: string;
  autor?: string;
  /** A concessionária citada, como o fornecedor a nomeia. É a terceira dimensão
   *  prioritária do pacote, e era a única dos dois painéis da lente sem lugar
   *  aqui: clicar na barra de uma concessionária não tinha para onde ir. */
  empresa?: string;
  /** A taxonomia de temas do CRM, pelo nome de cada nível: Pilar (N1), Tema
   *  estratégico (N2) e Subtema (N3). Casam pela menção ligada a um tema do
   *  cadastro — a que só traz o texto do fornecedor não entra. */
  tema_n1?: string;
  tema_n2?: string;
  tema_n3?: string;
  /** O sentimento da menção: `pos`, `neu` ou `neg`. */
  sentimento?: string;
}

/** Os valores de tier/veículo/atributo/tema que existem NESTE mês desta
 *  lente — não é dicionário fechado, é o que `GET .../opcoes-de-filtro`
 *  encontrou em `mencao`. */
export interface OpcoesDeFiltroDaLente {
  tiers: string[];
  veiculos: string[];
  atributos: string[];
  temas: string[];
  //: As do padrão Aegea. VAZIAS na lente que não tem o campo — a Imprensa não
  //: manda perfil do autor —, e é por isso que a barra esconde o campo em vez de
  //: abrir um seletor sem opção nenhuma.
  perfis: string[];
  ufs: string[];
  subtemas: string[];
  autores: string[];
  empresas: string[];
  //: A taxonomia do CRM que as menções ligadas a ela alcançam no mês. VAZIAS
  //: enquanto as menções só trazem o texto do fornecedor — e aí a barra não
  //: oferece os três filtros. Opcionais: um back anterior não as manda.
  temas_n1?: string[];
  temas_n2?: string[];
  temas_n3?: string[];
  /** Os sentimentos do mês (pos/neu/neg). Opcional: um back anterior não o manda. */
  sentimentos?: string[];
}

/** Um degrau do caminho até um recorte. */
export interface PassoDaTrilha {
  /** A chave do parâmetro (`uf`) — é o que a tela remove para subir um nível. */
  chave: string;
  /** O nome da dimensão como se lê na aba (`UF`). */
  dimensao: string;
  valor: string;
}

/** O nível 3 do pacote: um pedaço do mês, medido e decomposto — o que o modal
 *  de aprofundamento mostra quando alguém clica num dado.
 *
 *  UM PEDIDO SÓ. O modal abre com tudo ou abre mentindo; cinco chamadas dariam
 *  cinco estados de carregamento dentro do mesmo painel. */
export interface RecorteDaLente {
  lente: string;
  mes: string;
  /** O caminho até aqui. Vazio quando o recorte é o mês inteiro. */
  trilha: PassoDaTrilha[];
  /** A nota que este pedaço teria se fosse o mês. */
  nota: number | null;
  /** Quantos pontos ele tira (negativo) ou põe na nota da lente. O denominador
   *  é o do MÊS, e é isso que faz a soma dos pedaços fechar em `nota − 50`. */
  impacto: number;
  composicao: { positivo: number; neutro: number; negativo: number };
  itens: number;
  /** O total do mês, para "4 de 6 itens" em vez de "4 itens". */
  itens_no_mes: number;
  frase: string;
  ausencia: string | null;
  /** Uma célula por mês do período: o mesmo recorte medido mês a mês. */
  historico: {
    mes: string;
    impacto: number;
    itens: number;
    sem_base: boolean;
    /** A nota DO RECORTE naquele mês — medida no servidor, porque a nota de um
     *  pedaço não existe em lugar nenhum senão medindo. Nula sem recorte: ali
     *  quem tem o número certo é a série que desenha a Jornada. */
    nota: number | null;
  }[];
  /** As dimensões AINDA NÃO usadas, cortadas dentro deste recorte: clicar numa
   *  linha empilha mais um degrau, sem sair do painel. */
  dentro: Bloco[];
  itens_do_recorte: Bloco;
}

function paraConsultaDoFiltro(mes: string, filtro?: FiltroDaLente): string {
  const parametros = new URLSearchParams({ mes });
  //: PERCORRE O OBJETO em vez de listar campo por campo: a lista escrita à mão
  //: era o lugar onde uma dimensão nova se esquecia — a tela mandaria o recorte,
  //: o servidor devolveria o mês inteiro, e nada reclamaria.
  for (const [chave, valor] of Object.entries(filtro ?? {})) {
    if (valor) parametros.set(chave, valor);
  }
  return parametros.toString();
}

/** O dossiê de uma lente: a tela inteira num pedido só.
 *
 *  UM ENDPOINT, UMA TELA — o front não calcula nada disto. Cada bloco vem com
 *  a ficha de procedência junto, que é o conteúdo do "?". `filtro` é o
 *  recorte da barra acima do destaque — ver `FiltroDaLente`. */
export function obterDossieDaLente(
  codigo: string,
  mes: string,
  filtro?: FiltroDaLente,
): Promise<Dossie> {
  return requisitar<Dossie>(`/api/score/lentes/${codigo}/dossie?${paraConsultaDoFiltro(mes, filtro)}`);
}

/** O recorte: o aprofundamento de um dado, num pedido só.
 *
 *  POR QUE ELE EXISTE em vez de o clique filtrar a tela: aplicar o filtro na
 *  tela inteira REFAZ o mês — a nota muda, os painéis se refazem, e quem clicou
 *  perde de vista o mês de onde saiu. É recortar, não aprofundar. O modal põe o
 *  pedaço AO LADO do mês, com a trilha de volta. */
export function obterRecorteDaLente(
  codigo: string,
  mes: string,
  filtro?: FiltroDaLente,
): Promise<RecorteDaLente> {
  return requisitar<RecorteDaLente>(
    `/api/score/lentes/${codigo}/recorte?${paraConsultaDoFiltro(mes, filtro)}`,
  );
}

/** As opções que o filtro desta lente pode oferecer neste mês. */
export function obterOpcoesDeFiltroDaLente(
  codigo: string,
  mes: string,
): Promise<OpcoesDeFiltroDaLente> {
  return requisitar<OpcoesDeFiltroDaLente>(
    `/api/score/lentes/${codigo}/dossie/opcoes-de-filtro?mes=${mes}`,
  );
}

/** A Consulta em profundidade (bloco "Drill down" da aba Lentes) de uma lente
 *  no mês: pilares, temas, subtemas e a amostra de matérias, já com as frases.
 *
 *  A RESPOSTA É O PRÓPRIO `Dados` DO DRILL, com UMA lente em `lentes`: assim
 *  `resolverCaminho` e os quatro níveis leem o mês real sem mudar de forma.
 *  Só a Imprensa e o Mercado respondem; outra lente volta 404. */
export function obterConsultaDaLente(codigo: string, mes: string): Promise<ConsultaDaLente> {
  return requisitar<ConsultaDaLente>(
    `/api/score/lentes/${codigo}/consulta?${new URLSearchParams({ mes })}`,
  );
}

// -- a Base de dados das lentes ----------------------------------------------

/** Uma menção como chegou da fonte — uma linha da Base de dados do Score. */
export interface MencaoDaBase {
  id: string;
  data: string | null;
  mes: string;
  fonte: string;
  /** A fonte está ligada na calibração? Desligada, a linha existe mas não
   *  entra na nota. */
  fonte_no_calculo: boolean;
  veiculo: string | null;
  /** O veículo no CADASTRO COMPARTILHADO, pelo id — nulo quando a menção não
   *  bateu com nenhum veículo cadastrado. É o que delimita quais interlocutores
   *  (jornalistas) podem ser vinculados a ela. */
  instituicao_id: string | null;
  tier: string | null;
  sentimento: string | null;
  atributo: string | null;
  tema: string | null;
  tema_n1: string | null;
  tema_n2: string | null;
  tema_n3: string | null;
  subtema: string | null;
  empresa: string | null;
  uf: string | null;
  /** Nulo na Imprensa para quem não vê o diretório (é o jornalista). */
  autor: string | null;
  perfil_autor: string | null;
  engajamento: number | null;
  publico_alvo: string | null;
  titulo: string | null;
  link: string | null;
}

export interface PaginaDaBase {
  itens: MencaoDaBase[];
  total: number;
  pagina: number;
  tamanho: number;
}

/** Os valores de cada campo que aparecem nas menções da lente no período. */
export interface OpcoesDaBase {
  fontes: string[];
  sentimentos: string[];
  tiers: string[];
  veiculos: string[];
  atributos: string[];
  temas: string[];
  temas_n1: string[];
  temas_n2: string[];
  temas_n3: string[];
  subtemas: string[];
  empresas: string[];
  ufs: string[];
  autores: string[];
  perfis: string[];
}

/** O que a Base pede ao servidor: período, busca, filtros, página e ordem. */
export interface ConsultaDaBase {
  de?: string;
  ate?: string;
  q?: string;
  filtros?: Record<string, string | undefined>;
  pagina?: number;
  tamanho?: number;
  /** Campo, com "-" na frente para descendente ("-data"). */
  ordenacao?: string;
}

function paraConsultaDaBase(consulta: ConsultaDaBase): string {
  const parametros = new URLSearchParams();
  if (consulta.de) parametros.set('de', consulta.de);
  if (consulta.ate) parametros.set('ate', consulta.ate);
  if (consulta.q?.trim()) parametros.set('q', consulta.q.trim());
  for (const [chave, valor] of Object.entries(consulta.filtros ?? {})) {
    if (valor) parametros.set(chave, valor);
  }
  if (consulta.pagina) parametros.set('pagina', String(consulta.pagina));
  if (consulta.tamanho) parametros.set('tamanho', String(consulta.tamanho));
  if (consulta.ordenacao) parametros.set('ordenacao', consulta.ordenacao);
  return parametros.toString();
}

export function listarMencoesDaBase(lente: string, consulta: ConsultaDaBase): Promise<PaginaDaBase> {
  return requisitar<PaginaDaBase>(`/api/score/base/${lente}/mencoes?${paraConsultaDaBase(consulta)}`);
}

/** As opções de filtro da Base, para uma lente e um período.
 *
 *  ⚠ SEM CONSUMIDOR DE PRODUÇÃO. Conferido em 16/10/2026: nenhuma tela a
 *  chama. O único uso é um `vi.fn()` em `BaseDeDadosDoScore.test.tsx:30`, que
 *  mocka a função e depois não a exercita — o mock está tão órfão quanto ela.
 *
 *  A ROTA DO BACK TAMBÉM ESTÁ ÓRFÃ (`app/api/base_das_lentes.py:297`), e é isso
 *  que distingue este caso de um descuido do front: as duas pontas foram
 *  escritas e nenhuma foi ligada. É um filtro que o produto desenhou para a
 *  Base e não chegou à tela.
 *
 *  FICA ATÉ ALGUÉM DECIDIR, e a decisão é de produto: ou a Base ganha o filtro
 *  por opções, ou saem as duas pontas juntas — esta função, o mock e a rota.
 *  Remover só um lado deixaria o outro parecendo em uso.
 */
export function obterOpcoesDaBase(lente: string, de?: string, ate?: string): Promise<OpcoesDaBase> {
  return requisitar<OpcoesDaBase>(
    `/api/score/base/${lente}/mencoes/opcoes?${paraConsultaDaBase({ de, ate })}`,
  );
}

export function obterOpcoesDoScore(): Promise<OpcoesDoScore> {
  return requisitar<OpcoesDoScore>('/api/score/opcoes');
}

/** Vincula — ou, com `null`, desvincula — o jornalista da menção a um
 *  interlocutor do cadastro compartilhado. O servidor confere que o
 *  interlocutor pertence à mesma instituição da matéria; aqui só se manda a
 *  escolha. */
export function editarJornalistaDaMencao(
  id: string,
  interlocutorId: string | null,
): Promise<{ autor: string | null }> {
  return requisitar<{ autor: string | null }>(`/api/score/base/mencoes/${id}/jornalista`, {
    method: 'PATCH',
    body: JSON.stringify({ interlocutor_id: interlocutorId }),
  });
}

/** Grava uma VERSÃO NOVA da régua — a tabela só cresce, para saber com que
 *  critério um número foi lido no mês passado. */
export function gravarCalibracao(entrada: CalibracaoEntrada): Promise<Calibracao> {
  return requisitar<Calibracao>('/api/score/calibracao', {
    method: 'PUT',
    body: JSON.stringify(entrada),
  });
}

/** "Restaurar padrão": volta à régua de fábrica GRAVANDO, e não apagando. */
export function restaurarCalibracaoPadrao(): Promise<Calibracao> {
  return requisitar<Calibracao>('/api/score/calibracao', { method: 'DELETE' });
}

export function criarFatoDoScore(entrada: {
  mes: string;
  texto: string;
  efeito: string;
}): Promise<FatoDoMes> {
  return requisitar<FatoDoMes>('/api/score/fatos', {
    method: 'POST',
    body: JSON.stringify(entrada),
  });
}

export function removerFatoDoScore(id: string): Promise<void> {
  return requisitar<void>(`/api/score/fatos/${id}`, { method: 'DELETE' });
}

/** O recorte da aba de risco virando consulta.
 *
 *  AS DIMENSÕES VÃO COMO PARÂMETRO REPETIDO (`dimensao=tier:relevante`), e não
 *  um parâmetro por dimensão: as dimensões que existem saem do DADO, e um campo
 *  fixo por dimensão obrigaria a mexer aqui a cada base nova — exatamente a
 *  rigidez que a tela deixou de ter. O servidor recusa chave que não conhece,
 *  com a lista das válidas, em vez de ignorar em silêncio.
 *
 *  E AS FONTES VÃO REPETIDAS TAMBÉM (`fonte=clipei&fonte=bites`): são várias ao
 *  mesmo tempo, não uma escolha.
 */
function paraConsultaDoRisco(filtro: FiltroDoRisco = {}): string {
  const parametros = new URLSearchParams();
  if (filtro.cluster) parametros.set('cluster', filtro.cluster);
  if (filtro.risco) parametros.set('risco', filtro.risco);
  for (const fonte of filtro.fontes ?? []) parametros.append('fonte', fonte);
  for (const lente of filtro.lentes ?? []) parametros.append('lente', lente);
  if (filtro.severidade) parametros.set('severidade', filtro.severidade);
  if (filtro.bloco) parametros.set('bloco', filtro.bloco);
  if (filtro.macro) parametros.set('macro', filtro.macro);
  if (filtro.tema) parametros.set('tema', filtro.tema);
  if (filtro.de) parametros.set('de', filtro.de);
  if (filtro.ate) parametros.set('ate', filtro.ate);
  if (filtro.busca?.trim()) parametros.set('busca', filtro.busca.trim());
  for (const [chave, valor] of Object.entries(filtro.dimensoes ?? {})) {
    if (valor) parametros.append('dimensao', `${chave}:${valor}`);
  }
  return parametros.toString();
}

/** A tela inteira num pedido: série do índice, três KPIs, matriz e totais. */
export function obterPainelDeRisco(filtro?: FiltroDoRisco): Promise<PainelDeRisco> {
  return requisitar<PainelDeRisco>(`/api/score/riscos?${paraConsultaDoRisco(filtro)}`);
}

/** O "Relatório de incidentes", paginado. */
export function listarIncidentesDeRisco(
  filtro: FiltroDoRisco,
  pagina = 1,
  tamanho = 50,
): Promise<PaginaDeIncidentes> {
  const parametros = new URLSearchParams(paraConsultaDoRisco(filtro));
  parametros.set('pagina', String(pagina));
  parametros.set('tamanho', String(tamanho));
  return requisitar<PaginaDeIncidentes>(
    `/api/score/riscos/incidentes?${parametros.toString()}`,
  );
}

/** O que a tela pode oferecer como filtro NESTE recorte.
 *
 *  PEDIDO A CADA MUDANÇA DE RECORTE de propósito: a lista de dimensões e de
 *  fontes é o dado respondendo, e não uma lista fixa — fonte sem incidente no
 *  recorte é filtro que volta vazio.
 */
export function obterOpcoesDoRisco(filtro?: FiltroDoRisco): Promise<OpcoesDoRisco> {
  return requisitar<OpcoesDoRisco>(`/api/score/riscos/opcoes?${paraConsultaDoRisco(filtro)}`);
}
