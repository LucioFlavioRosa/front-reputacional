/** Que telas a barra de cima mostra, em cada divisão da plataforma.
 *
 *  ELA LISTAVA A PLATAFORMA INTEIRA, em qualquer tela. Quem abria o Score
 *  levava no topo quatro entradas de CRM que não tinham nada a ver com o que
 *  estava lendo — e as telas do Score, que são o que ele de fato tem, ficavam
 *  escondidas numa tira de abas por baixo.
 *
 *  A CAPA É QUEM TROCA DE DIVISÃO, e ela já existia: a marca no canto leva de
 *  volta a ela, e lá estão CRM dos Stakeholders, KPIs Reputacionais e o
 *  Painel de Inteligência de Mercado. Não precisou de controle novo —
 *  precisou de a barra parar de fazer o trabalho da capa.
 *
 *  POR QUE ISTO NÃO MORA NO `Layout`: o componente depende do contexto do
 *  painel e não se monta sem ele, e esta é a regra que mais erra em silêncio —
 *  uma entrada no lugar errado não quebra nada, só confunde todo dia.
 */

import type { Destino } from '@/navegacao/rota';

interface ItemDoMenu {
  view: Destino;
  rotulo: string;
  /** A aba, para as áreas cujas telas moram todas na mesma rota. */
  aba?: string;
}

const DO_CRM: ItemDoMenu[] = [
  { view: 'painel', rotulo: 'Painel' },
  { view: 'base', rotulo: 'Base' },
  { view: 'preparar', rotulo: 'Briefing' },
  { view: 'relatorios', rotulo: 'Relatórios Executivos' },
];

const DO_SCORE: ItemDoMenu[] = [
  { view: 'score', rotulo: 'Visão geral', aba: 'geral' },
  { view: 'score', rotulo: 'Lentes', aba: 'lentes' },
  { view: 'score', rotulo: 'Drivers e riscos', aba: 'drivers' },
  { view: 'score', rotulo: 'Metodologia', aba: 'metodologia' },
  //: A BASE DE DADOS É A CONSULTA: as menções de cada lente como chegaram da
  //: fonte, para quem quer entrar no detalhe. Não confundir com a Importação,
  //: logo ao lado, que é por onde as planilhas entram.
  { view: 'score', rotulo: 'Base de dados', aba: 'base-de-dados' },
  //: A BASE VEM POR ÚLTIMO, e é de propósito: ela é a porta de entrada do dado,
  //: e quem abre os KPIs quer LER o índice. Quem sobe planilha vai atrás dela.
  //:
  //: O CRM também tem uma "Base", e as duas convivem porque os menus são de
  //: divisões diferentes: lá é a lista de agendas, aqui são as planilhas dos
  //: fornecedores. O título da tela diz qual é qual.
  //: ERA "Base"; virou "Importação" quando a Base de dados (a consulta)
  //: chegou — duas abas chamadas "Base" lado a lado seriam a mesma coisa para
  //: quem lê o menu. A rota (`aba: 'base'`) continua a mesma.
  { view: 'score', rotulo: 'Importação', aba: 'base' },
];

/** Em que divisão esta tela está. A configuração conta como a área que ela
 *  configura: quem ajusta a régua do Score continua no Score. */
export function areaDe(view: Destino): ItemDoMenu[] {
  if (view === 'score' || view === 'config-score') return DO_SCORE;
  // NEM CRM NEM SCORE: ganhou cartão próprio na Início exatamente para não
  // parecer dono de nenhum dos dois — ver `Inicio.tsx`.
  if (view === 'plataforma' || view === 'compartilhado') return [];
  return DO_CRM;
}

/** A configuração da divisão em que se está, ou `null` se ela não tem uma.
 *
 *  ERA UMA POR ITEM DA BARRA, e isso errava nas duas pontas: no CRM dava três
 *  engrenagens apontando para a mesma tela, e no Score não dava nenhuma — as
 *  quatro telas dele entraram na barra sem herdar a engrenagem que a aba antiga
 *  carregava, e a régua do índice ficou sem porta de entrada. O cadastro de
 *  comentários do especialista foi junto, que mora na mesma tela.
 *
 *  A CONFIGURAÇÃO É DA DIVISÃO, não da tela: a barra mostra uma divisão de cada
 *  vez, então uma engrenagem no fim dela é exatamente "uma por área".
 *
 *  A PLATAFORMA NÃO TEM: quem entra, e com que papel, é a própria tela de
 *  configuração — ela não se configura a si mesma.
 */
export function configuracaoDe(view: Destino): Destino | null {
  if (view === 'score' || view === 'config-score') return 'config-score';
  if (view === 'plataforma' || view === 'compartilhado') return null;
  return 'admin';
}

export type { ItemDoMenu };
