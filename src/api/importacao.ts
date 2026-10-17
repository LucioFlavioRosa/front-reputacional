/** ImportaÃ§Ã£o de agendas e de subtemas.
 *
 *  Saiu de `cliente.ts` em 17/10/2026, quando ele tinha 90 funÃ§Ãµes e 2.481
 *  linhas e trÃªs entregas sem relaÃ§Ã£o entre si disputavam o mesmo arquivo.
 *  `cliente.ts` continua existindo como barril de reexportaÃ§Ã£o: nenhum dos
 *  66 arquivos que o importam precisou mudar.
 */

import type { ACriar, Grupo } from '@/paginas/importacao/grupos';
import { requisitar } from './nucleo';

/** Os dois recortes do MESMO formato que o download oferece.
 *
 *  Os nomes sao os do servidor (`MODELOS`, no dominio): um terceiro nome aqui
 *  viraria 422 no download, e a pessoa veria "nao consegui baixar o modelo" sem
 *  ninguem saber por que. */
export type ModeloDePlanilha = 'completo' | 'simplificado';

/** Uma coluna do arquivo, com o que a tela precisa para desenha-la.
 *
 *  O TIPO VEM DO SERVIDOR e nao de uma lista aqui: 59 nomes com o tipo de cada um,
 *  escritos deste lado, envelheceriam na primeira coluna nova — e o erro seria
 *  silencioso, porque a coluna sem tipo receberia a largura padrao. */
export interface ColunaDaImportacao {
  nome: string;
  /** `marca`, `data`, `sigla`, `lista`, `prosa` ou `texto`. Ver `medidas.ts`. */
  tipo: string;
}

/** Uma linha do arquivo, como a conferência a mostra. */
export interface LinhaDaImportacao {
  id: number;
  aba: string;
  linha_origem: number;
  decisao: string;
  interacao_id: string | null;
  dados_brutos: Record<string, unknown>;
  /** O que esta linha herdou da de cima por `idem`, coluna → valor.
   *
   *  A TELA MOSTRA ISTO porque a herança é invisível na planilha: a célula fica
   *  vazia, e sem ver o herdado a pessoa confirmaria 54 agendas confiando na
   *  memória do que havia acima. */
  herdado: Record<string, unknown>;
  /** O que a pessoa COMPLETOU nesta tela, coluna -> valor.
   *
   *  A TELA MARCA A CELULA, e e a contrapartida honesta de editar aqui: dali em
   *  diante o registro difere da planilha que ela guardou. Sem a marca, abrir o
   *  arquivo meses depois mostraria a celula vazia, sem nada explicando de onde
   *  veio o valor que esta no painel. */
  corrigido: Record<string, unknown>;
  proposta: Record<string, unknown> | null;
  divergencias: {
    campo: string;
    valor: string;
    mensagem: string;
    trava: boolean;
    /** A COLUNA DA PLANILHA de onde isto veio, quando ha uma. E por ela que a
     *  tela sabe onde oferecer o campo: `campo` e nome interno
     *  (`data_interacao`), e um campo de grupo corresponde a quatro colunas. */
    coluna: string;
    sugestoes: string[];
    acao: string | null;
    alvo: string | null;
  }[];
}

export interface Importacao {
  id: string;
  arquivo_nome: string;
  situacao: string;
  criado_em: string;
  confirmado_em: string | null;
  /** As colunas daquele arquivo, NA ORDEM — o cabecalho da grade.
   *
   *  Quem subiu o modelo simplificado ve as 22 dele, nao as 58 do completo. A
   *  ordem vem do servidor porque depender da ordem de um objeto JSON para
   *  montar o cabecalho de uma tabela e depender de algo que nenhum contrato
   *  promete. */
  colunas: ColunaDaImportacao[];
  grupos: Grupo[];
  a_criar: ACriar[];
  /** Quantas LINHAS seguram a confirmação. */
  pendencias: number;
  /** Quantas decisões resolvem essas linhas. */
  decisoes_pendentes: number;
  linhas: LinhaDaImportacao[];
}

export interface ConfirmacaoDaImportacao {
  criadas: number;
  cadastros: number;
  situacao: string;
}

/** Baixa o modelo `.xlsx` com o cadastro atual nas listas suspensas.
 *
 *  PASSA POR `requisitar` como todo o resto, com `comoBlob`. Um `fetch` próprio
 *  seria um caminho de rede que falha sem avisar ninguém — sem telemetria de
 *  5xx, sem a tradução de erro de rede —, e há um teste neste projeto contando
 *  as chamadas a `fetch` exatamente para impedir que apareça um segundo.
 */
export async function baixarModeloDeImportacao(modelo: ModeloDePlanilha): Promise<Blob> {
  return requisitar<Blob>(
    `/api/importacoes/modelo?modelo=${modelo}`,
    { method: 'GET' },
    { comoBlob: true },
  );
}

/** Sobe a planilha preenchida e recebe a conferência.
 *
 *  O CORPO É `FormData` e o `Content-Type` fica para o navegador escrever — ele
 *  acrescenta o `boundary` que separa as partes, e escrevê-lo à mão faz o
 *  servidor receber um multipart que não consegue separar.
 */
export async function subirPlanilhaDeAgendas(arquivo: File): Promise<Importacao> {
  const corpo = new FormData();
  corpo.append('arquivo', arquivo);
  return requisitar<Importacao>('/api/importacoes', { method: 'POST', body: corpo });
}

/** A conferência de onde ela parou. */
export async function obterImportacao(id: string): Promise<Importacao> {
  return requisitar<Importacao>(`/api/importacoes/${id}`);
}

/** Uma decisão, todas as linhas que aquele valor segurava. */
export async function resolverDivergencia(
  id: string,
  decisao: { campo: string; valor: string; decisao: string; alvo?: string },
): Promise<Importacao> {
  return requisitar<Importacao>(`/api/importacoes/${id}/resolucoes`, {
    method: 'PATCH',
    body: JSON.stringify(decisao),
  });
}

/** Completa celulas de UMA linha e recebe a conferencia reproposta.
 *
 *  A CONFERENCIA SABIA RESOLVER O VALOR ERRADO e nao o AUSENTE: "este orgao nao
 *  existe" vem com apontar e criar, mas a data em branco vinha com um grupo sem
 *  valor nenhum, sem nada para clicar.
 */
export async function corrigirLinhaDaImportacao(
  id: string,
  linhaId: number,
  celulas: Record<string, string>,
): Promise<Importacao> {
  return requisitar<Importacao>(`/api/importacoes/${id}/linhas/${linhaId}`, {
    method: 'PATCH',
    body: JSON.stringify({ celulas }),
  });
}

/** Exclui uma linha da importacao, ou a restaura.
 *
 *  REVERSIVEL ATE A CONFIRMACAO, e precisa ser: errar numa tela de 54 linhas e
 *  facil, e a planilha nao e o caminho de volta — o arquivo nao fica guardado. A
 *  linha continua na grade, marcada, e volta com um clique.
 */
export async function excluirLinhaDaImportacao(
  id: string,
  linhaId: number,
  excluir: boolean,
): Promise<Importacao> {
  return requisitar<Importacao>(`/api/importacoes/${id}/linhas/${linhaId}`, {
    method: 'PATCH',
    body: JSON.stringify({ descartada: excluir }),
  });
}

/** Cria os cadastros e as agendas — tudo, ou nada. */
export async function confirmarImportacao(id: string): Promise<ConfirmacaoDaImportacao> {
  return requisitar<ConfirmacaoDaImportacao>(`/api/importacoes/${id}/confirmacao`, {
    method: 'POST',
  });
}

/** Desiste da importação. Nada foi criado, então nada há para desfazer. */
export async function cancelarImportacao(id: string): Promise<Importacao> {
  return requisitar<Importacao>(`/api/importacoes/${id}/cancelamento`, { method: 'POST' });
}

// ===========================================================================
// A REVISÃO DA TAXONOMIA DE SUBTEMAS PELA PLANILHA
// ===========================================================================
//
// TRÊS CHAMADAS, e não as dez da importação de agendas. Lá o rascunho vive no
// banco (`importacao_linha`) e a pessoa trabalha nele por dias, com rota para
// resolver divergência, corrigir linha, cancelar e retomar. Aqui nada é
// gravado entre conferir e confirmar: a pessoa corrige a PLANILHA e sobe de
// novo, então não há o que cancelar — fechar o modal já é o cancelamento.
//
// O PREÇO DISSO É A `impressao`, e ela não é detalhe de implementação que o
// front possa ignorar: é o que a conferência devolve e a confirmação exige de
// volta. Sem ela o servidor recusa, porque entre os dois passos alguém pode ter
// editado um subtema pelo próprio Cadastro de Assuntos — e aí a pessoa teria
// aprovado uma mudança e aplicado outra.

/** O que a importação faria com uma linha da planilha. */
export type DecisaoDeSubtema = 'novo' | 'igual' | 'altera' | 'recusada';

/** Por que uma linha foi recusada, na coluna em que a pessoa pode consertar. */
export interface DivergenciaDeSubtema {
  coluna: string;
  valor: string;
  motivo: string;
}

/** O estado de um subtema, como o servidor o compara.
 *
 *  SÃO IDS E NÃO NOMES, porque é o que o banco guarda — a tela resolve os
 *  nomes pelo catálogo que ela já tem em mão. Pedir nomes aqui faria o servidor
 *  repetir, em 149 linhas, o dicionário que a tela carrega uma vez.
 */
export interface EstadoDoSubtema {
  macro_tema_id: number | null;
  camada_lso: string | null;
  e_risco: boolean | null;
  riscos: number[];
}

export interface PropostaDeSubtema {
  /** A linha na PLANILHA, para a pessoa achar a célula — não a ordem na lista. */
  linha: number;
  nome: string;
  decisao: DecisaoDeSubtema;
  /** Preenchidos só em `altera`: é o que permite mostrar o que muda. */
  antes: EstadoDoSubtema | null;
  depois: EstadoDoSubtema | null;
  divergencias: DivergenciaDeSubtema[];
}

export interface ConferenciaDeSubtemas {
  /** Uma chave por decisão, sempre as quatro — zero inclusive. */
  totais: Record<DecisaoDeSubtema, number>;
  propostas: PropostaDeSubtema[];
  /** Devolver isto na confirmação é o que prova que se aplica o que foi visto. */
  impressao: string;
}

export interface ConfirmacaoDeSubtemas {
  criados: number;
  alterados: number;
  iguais: number;
  recusadas: number;
}

/** Baixa a taxonomia atual num `.xlsx`, pronta para editar.
 *
 *  O ARQUIVO VEM PREENCHIDO com os subtemas de hoje, e é isso que o torna útil:
 *  o trabalho não é cadastrar 149 subtemas, é mexer em três. Um modelo vazio
 *  obrigaria a redigitar 146 linhas certas.
 */
export async function baixarModeloDeSubtemas(): Promise<Blob> {
  return requisitar<Blob>(
    '/api/taxonomia/subtemas/modelo',
    { method: 'GET' },
    { comoBlob: true },
  );
}

/** Sobe a planilha e recebe o que mudaria. NADA É GRAVADO. */
export async function conferirPlanilhaDeSubtemas(
  arquivo: File,
): Promise<ConferenciaDeSubtemas> {
  const corpo = new FormData();
  corpo.append('arquivo', arquivo);
  return requisitar<ConferenciaDeSubtemas>('/api/taxonomia/subtemas/conferencia', {
    method: 'POST',
    body: corpo,
  });
}

/** Aplica o que foi conferido — tudo, ou nada.
 *
 *  O ARQUIVO VAI DE NOVO, e não é desperdício: o servidor relê e reconfere
 *  contra o banco daquele instante. Mandar só a `impressao` exigiria guardar as
 *  propostas em algum lugar, que é exatamente a tabela de rascunho que este
 *  desenho dispensa.
 */
export async function confirmarPlanilhaDeSubtemas(
  arquivo: File,
  impressao: string,
): Promise<ConfirmacaoDeSubtemas> {
  const corpo = new FormData();
  corpo.append('arquivo', arquivo);
  corpo.append('impressao', impressao);
  return requisitar<ConfirmacaoDeSubtemas>('/api/taxonomia/subtemas/confirmacao', {
    method: 'POST',
    body: corpo,
  });
}

/* -- o rastreio de risco ------------------------------------------------------- */
