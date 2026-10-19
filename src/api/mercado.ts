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
