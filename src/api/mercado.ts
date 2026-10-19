/** O Painel de Inteligência de Mercado: cotação de bonds e o índice ao lado.
 *
 *  ARQUIVO PRÓPRIO, como `score.ts` e `crm.ts`: é outro portal, com outra
 *  permissão. O que os dois domínios compartilham é esta TELA, que lê as duas
 *  séries de uma vez.
 *
 *  O ÍNDICE VEM NESTA ROTA, e não de `/api/score/serie`. Aquela está atrás de
 *  `exigir_portal_score` no back, e quem tem só `acessa_inteligencia_de_mercado`
 *  recebe 403 dela: a linha do eixo direito sairia vazia POR PERMISSÃO, e na
 *  tela isso se lê como "o score não tem número neste período". O número é o
 *  mesmo do painel de KPIs — o back chama as mesmas funções para calculá-lo.
 */

import { requisitar } from './nucleo';

/** Uma métrica do papel. `yield` SUBINDO É PIORA, ao contrário do preço — é a
 *  tela que pinta a variação, mas quem escolhe a métrica precisa saber disso. */
export type MetricaDoBond = 'preco' | 'yield';

export interface PapelDeMercado {
  ticker: string;
  descricao: string | null;
  emissor: string;
  /** A companhia, marcada por coluna e não pelo nome — ver `emissor.e_aegea`. */
  e_aegea: boolean;
}

export interface PontoDoBond {
  /** `YYYY-MM-DD`: o PREGÃO. Dia sem negócio não vem. */
  data: string;
  valor: number;
}

export interface SerieDoBond {
  ticker: string;
  pontos: PontoDoBond[];
}

export interface PontoDoIndice {
  /** `YYYY-MM-DD`, sempre dia 1 — o nome do campo é o que diz que a medida é
   *  MENSAL enquanto a do bond é diária. */
  mes: string;
  isr: number | null;
}

export interface SerieDeMercado {
  /** Os 31 papéis com a empresa de cada um, SEMPRE — é o que o seletor
   *  oferece, e ele precisa existir antes da primeira subida. */
  papeis: PapelDeMercado[];
  bonds: SerieDoBond[];
  indice: PontoDoIndice[];
  metrica: MetricaDoBond;
}

/** As duas séries no período, mais o catálogo.
 *
 *  `tickers` VAZIO SIGNIFICA "OS DA AEGEA", decidido no servidor: 31 linhas num
 *  gráfico não se lê, e a tela abre na companhia. Ticker que não existe é
 *  ignorado em silêncio — não é erro, a série dele simplesmente não existe.
 *
 *  SEM `de`/`ate` VEM A SÉRIE INTEIRA. O seletor de período da tela é quem
 *  recorta; um padrão de "últimos N dias" aqui faria a regra viver em dois
 *  lugares.
 */
export function obterSerieDeMercado(opcoes: {
  tickers?: string[];
  de?: string;
  ate?: string;
  metrica?: MetricaDoBond;
} = {}): Promise<SerieDeMercado> {
  const parametros = new URLSearchParams();
  if (opcoes.tickers?.length) parametros.set('tickers', opcoes.tickers.join(','));
  if (opcoes.de) parametros.set('de', opcoes.de);
  if (opcoes.ate) parametros.set('ate', opcoes.ate);
  if (opcoes.metrica) parametros.set('metrica', opcoes.metrica);
  const consulta = parametros.toString();
  return requisitar<SerieDeMercado>(
    `/api/mercado/bonds/serie${consulta ? `?${consulta}` : ''}`,
  );
}


/* -- a subida da planilha de bonds ------------------------------------------
 *
 * MESMO IDIOMA DA PLANILHA DO SCORE (`conferirPlanilhaDoScore`): `FormData` com
 * um campo `arquivo`, e o transporte de `nucleo.ts` por baixo — ele é quem
 * manda o `X-CSRF-Token`, esquece o cache depois da escrita e traduz a falha de
 * upload numa frase legível.
 *
 * SEM SUBIDA EM PARTES AQUI, e é medição e não esquecimento: o export tem 1,05
 * MB e o limiar do front para fatiar é 1.258.291 bytes (1,2 MB), então ele já
 * cabe numa requisição. A montagem por partes de `planilha_do_score` é por
 * FONTE DO SCORE e generalizá-la para outro domínio exigiria rota nova no
 * servidor — seria código sem usuário enquanto o arquivo cresce ~3 KB por
 * semana (cinco pregões × 31 tickers), o que põe a travessia do limiar a anos.
 *
 * CONFERIR ANTES DE GRAVAR, as duas em requisições separadas. A conferência não
 * escreve nada; é ela que mostra a conta antes de a pessoa decidir. A razão
 * está escrita na importação de agendas: "importação de planilha sem
 * conferência humana cria duplicata em massa, e desfazer isso depois é pior que
 * digitar de novo".
 */

/** O que a subida FARIA — nada é gravado por esta chamada. */
export interface ConferenciaDeBonds {
  primeira_data: string | null;
  ultima_data: string | null;
  /** Todas as cotações lidas, inclusive de papel que o cadastro não tem. */
  cotacoes_no_arquivo: number;
  a_inserir: number;
  /** A subida semanal é um `upsert`: o arquivo é cumulativo, então quase tudo
   *  dele cai aqui. É este número que diz que subir de novo é inofensivo. */
  a_atualizar: number;
  por_ticker: Record<string, number>;
  /** O QUE NÃO VAI ENTRAR, em quatro listas separadas de propósito — cada uma
   *  pede uma decisão diferente de quem lê. */
  tickers_desconhecidos: string[];
  tickers_sem_valor: string[];
  rotulos_ignorados: [string, string][];
  pares_repetidos: [string, string][];
  /** A linha com conteúdo e sem data que encerrou a leitura, quando houve. */
  linha_que_encerrou: number | null;
}

export interface ImportacaoDeBonds {
  inseridas: number;
  atualizadas: number;
  /** Papéis cujo catálogo (descrição, id Bloomberg, montante) foi completado. */
  papeis_completados: number;
}

/** Lê o export e diz o que a subida faria. NÃO grava. */
export function conferirPlanilhaDeBonds(arquivo: File): Promise<ConferenciaDeBonds> {
  const corpo = new FormData();
  corpo.append('arquivo', arquivo);
  return requisitar<ConferenciaDeBonds>('/api/mercado/bonds/conferencia', {
    method: 'POST',
    body: corpo,
  });
}

/** Grava as cotações, por `upsert` na chave `(ticker, data)`.
 *
 *  REENVIA O ARQUIVO, e não um identificador do que a conferência leu: a
 *  conferência não guarda bytes (ela não escreve nada). Subir o mesmo arquivo
 *  duas vezes é inofensivo — é propriedade da chave composta, não gentileza
 *  desta função. */
export function importarPlanilhaDeBonds(arquivo: File): Promise<ImportacaoDeBonds> {
  const corpo = new FormData();
  corpo.append('arquivo', arquivo);
  return requisitar<ImportacaoDeBonds>('/api/mercado/bonds/importar', {
    method: 'POST',
    body: corpo,
  });
}