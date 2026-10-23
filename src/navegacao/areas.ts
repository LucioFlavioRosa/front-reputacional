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

/** As abas do Painel de Inteligência de Mercado.
 *
 *  MESMA FORMA DO SCORE: as duas telas moram na rota `/mercado` e se distinguem
 *  pela `aba`, que vai para o endereço — é o que faz a barra de cima ter itens
 *  que se compartilham, voltam no histórico e recarregam onde estavam.
 *
 *  A IMPORTAÇÃO VEM POR ÚLTIMO, e é a mesma decisão que o Score tomou: ela é a
 *  porta de entrada do dado, e quem abre o painel quer LER o gráfico. Quem sobe
 *  planilha vai atrás dela.
 *
 *  AS OUTRAS ABAS DA ESPECIFICAÇÃO (Indicadores por unidade, Papers e cases,
 *  Busca por tema) entram aqui quando chegarem. */
const DO_MERCADO: ItemDoMenu[] = [
  //: O NOME NOVO, por pedido (22/10/2026).
  { view: 'mercado', rotulo: 'Bonds X Score Reputacional Mercado', aba: 'bonds' },
  { view: 'mercado', rotulo: 'Importação', aba: 'importacao' },
];

//: DESLIGADA por pedido (2026-10-20): a aba "Drivers e riscos" sai da barra do
//: Score, sem sair do código — a tela (`aba === 'drivers'` em `Score.tsx`) e a
//: rota continuam existindo, só não aparecem mais no menu. Virar `true`
//: religa, sem mexer em mais nada.
const DRIVERS_E_RISCOS_NO_MENU = false;

const ITEM_DRIVERS_E_RISCOS: ItemDoMenu = {
  view: 'score',
  rotulo: 'Drivers e riscos',
  aba: 'drivers',
};

const DO_SCORE: ItemDoMenu[] = [
  { view: 'score', rotulo: 'Visão geral', aba: 'geral' },
  { view: 'score', rotulo: 'Lentes', aba: 'lentes' },
  //: DEPOIS DE LENTES, por pedido: a aba desce do índice para os incidentes que
  //: tocam a matriz de risco corporativo, e quem acabou de ler uma lente é
  //: quem pergunta "e disto, o que é risco".
  //:
  //: NÃO CONFUNDIR COM "Drivers e riscos", logo ao lado (quando ligada): lá são
  //: os drivers do ÍNDICE (o que empurra a nota), aqui são os RISCOS DA MATRIZ
  //: corporativa — 32 riscos em 8 clusters, com severidade atribuída pela
  //: companhia.
  { view: 'score', rotulo: 'Risk Tracking', aba: 'riscos' },
  ...(DRIVERS_E_RISCOS_NO_MENU ? [ITEM_DRIVERS_E_RISCOS] : []),
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
  // parecer dono de nenhum dos dois — ver `Inicio.tsx`. A Árvore da
  // taxonomia entrou na mesma regra (20/10/2026): sem portal, sem divisão.
  if (view === 'plataforma' || view === 'compartilhado' || view === 'taxonomia') return [];
  // O PAINEL DE INTELIGÊNCIA DE MERCADO É O TERCEIRO PORTAL, e cair no `return`
  // abaixo o vestia de CRM: o cabeçalho dizia "CRM dos Stakeholders", com o
  // menu, a busca e a engrenagem de outra divisão. Achado de revisão, e era
  // exatamente o tipo de esquecimento que um `if/else` deixa passar e um
  // `switch` exaustivo pegaria.
  //
  if (view === 'mercado') return DO_MERCADO;
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
  if (view === 'plataforma' || view === 'compartilhado' || view === 'taxonomia') return null;
  //: O PAINEL DE MERCADO AINDA NÃO TEM CONFIGURAÇÃO, e cair no `admin` abaixo
  //: punha no cabeçalho dele a engrenagem da administração do CRM — uma porta
  //: para outra divisão, oferecida de dentro desta.
  if (view === 'mercado') return null;
  return 'admin';
}

export type { ItemDoMenu };
