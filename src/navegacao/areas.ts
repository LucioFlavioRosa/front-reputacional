/** Que telas a barra de cima mostra, em cada divisão da plataforma.
 *
 *  ELA LISTAVA A PLATAFORMA INTEIRA, em qualquer tela. Quem abria o Score
 *  levava no topo quatro entradas de CRM que não tinham nada a ver com o que
 *  estava lendo — e as telas do Score, que são o que ele de fato tem, ficavam
 *  escondidas numa tira de abas por baixo.
 *
 *  A CAPA É QUEM TROCA DE DIVISÃO, e ela já existia: a marca no canto leva de
 *  volta a ela, e lá estão CRM dos Stakeholders, KPIs Reputacionais e Score
 *  Executivo. Não precisou de controle novo — precisou de a barra parar de
 *  fazer o trabalho da capa.
 *
 *  POR QUE ISTO NÃO MORA NO `Layout`: o componente depende do contexto do
 *  painel e não se monta sem ele, e esta é a regra que mais erra em silêncio —
 *  uma entrada no lugar errado não quebra nada, só confunde todo dia.
 */

import type { Destino } from '@/navegacao/rota';

interface ItemDoMenu {
  view: Destino;
  rotulo: string;
  /** A tela de configuração desta área, quando há uma. */
  configura?: Destino;
  /** A aba, para as áreas cujas telas moram todas na mesma rota. */
  aba?: string;
}

const DO_CRM: ItemDoMenu[] = [
  { view: 'painel', rotulo: 'Painel', configura: 'admin' },
  { view: 'base', rotulo: 'Base', configura: 'admin' },
  { view: 'preparar', rotulo: 'Preparar agenda', configura: 'admin' },
  { view: 'relatorios', rotulo: 'Relatórios Executivos' },
];

const DO_SCORE: ItemDoMenu[] = [
  { view: 'score', rotulo: 'Visão geral', aba: 'geral' },
  { view: 'score', rotulo: 'Lentes', aba: 'lentes' },
  { view: 'score', rotulo: 'Drivers e riscos', aba: 'drivers' },
  { view: 'score', rotulo: 'Metodologia', aba: 'metodologia' },
];

/** Em que divisão esta tela está. A configuração conta como a área que ela
 *  configura: quem ajusta a régua do Score continua no Score. */
export function areaDe(view: Destino): ItemDoMenu[] {
  if (view === 'score' || view === 'config-score') return DO_SCORE;
  if (view === 'plataforma') return [];
  return DO_CRM;
}

/** A entrada de quem administra a plataforma, fora das duas divisões. */
export const NAVEGACAO_ADMINISTRATIVA: ItemDoMenu[] = [
  { view: 'plataforma', rotulo: 'Plataforma' },
];

export type { ItemDoMenu };
