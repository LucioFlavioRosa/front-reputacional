/** O que a Base de dados de cada lente filtra e mostra.
 *
 *  UMA DIMENSÃO, NOMES DIFERENTES POR LENTE, como nos filtros do dossiê: o
 *  "veículo" é a rede na Sociedade digital e o canal em Clientes; o "autor" é o
 *  jornalista na Imprensa e no Mercado. O campo do servidor é o mesmo.
 *
 *  TODOS OS CAMPOS FILTRAM, por pedido — e o campo sem nenhum valor no período
 *  não é desenhado (a Imprensa não tem perfil de quem fala; Clientes não tem
 *  tier). Cada lente mostra só os seus sem precisar de uma regra por lente.
 */

import type { MencaoDaBase, OpcoesDaBase } from '@/api/cliente';
import { ROTULO_DO_SENTIMENTO, ROTULO_DO_TIER } from '@/dominio/filtrosDasLentes';

export const LENTES_DA_BASE = [
  { id: 'imprensa', rotulo: 'Imprensa' },
  { id: 'mercado', rotulo: 'Mercado' },
  { id: 'sociedade', rotulo: 'Sociedade digital' },
  { id: 'clientes', rotulo: 'Clientes' },
  { id: 'institucional', rotulo: 'Institucional' },
] as const;

export { ROTULO_DO_SENTIMENTO };

/** Como a "fonte" de cada linha se chama nesta lente. */
export function rotuloDoVeiculo(lente: string): string {
  if (lente === 'sociedade') return 'Rede';
  if (lente === 'clientes') return 'Canal';
  return 'Veículo';
}

/** As três lentes de clipping chamam o autor de "Jornalista"; as outras, de
 *  "Autor" — nelas ele não é jornalista: na Sociedade é o perfil que a
 *  Approach manda dentro da linha da planilha.
 *
 *  Tem de bater com a dimensão `autor` do dossiê e do cartão "Onde está a
 *  causa", senão o mesmo dado ganha dois nomes em duas telas da mesma lente. */
export function rotuloDoAutor(lente: string): string {
  return lente === 'imprensa' || lente === 'mercado' || lente === 'institucional'
    ? 'Jornalista'
    : 'Autor';
}

export interface CampoDaBase {
  /** O parâmetro do servidor. */
  chave: string;
  rotulo: string;
  de: keyof OpcoesDaBase;
  rotulos?: Record<string, string>;
}

/** Os filtros da Base, na ordem da faixa. */
export function camposDaBase(lente: string): CampoDaBase[] {
  return [
    //: PILAR E TEMA ESTRATÉGICO PRIMEIRO, por pedido: são os filtros de tema
    //: que valem em todo o painel, e o nome diz o nível.
    //:
    //: "ATRIBUTO (N1)" AQUI É O N1 (`tema_n1`), não o campo `atributo` do
    //: fornecedor — por pedido (2026-10-16), depois de olhar o dado real e
    //: ver que os dois sempre coincidem (o `atributo` é o N1 com um número
    //: na frente, tipo "2. Eficiência Operacional e Qualidade"). O filtro de
    //: `atributo` saiu daqui por ser redundante com este. O "(N1)" tirado e
    //: devolvido no mesmo dia: tirado junto da palavra "Pilar", devolvido
    //: depois para ficar em paridade visual com "(N2)" e "(N3)" ao lado.
    { chave: 'tema_n1', rotulo: 'Atributo (N1)', de: 'temas_n1' },
    { chave: 'tema_n2', rotulo: 'Tema estratégico (N2)', de: 'temas_n2' },
    { chave: 'sentimento', rotulo: 'Sentimento', de: 'sentimentos', rotulos: ROTULO_DO_SENTIMENTO },
    { chave: 'fonte', rotulo: 'Fonte', de: 'fontes' },
    { chave: 'tier', rotulo: 'Tier do veículo', de: 'tiers', rotulos: ROTULO_DO_TIER },
    { chave: 'veiculo', rotulo: rotuloDoVeiculo(lente), de: 'veiculos' },
    //: "SUBTEMA (N3)" AQUI É O N3 (`tema_n3`) do cadastro. O qualificador saiu
    //: e voltou no mesmo dia (2026-10-16), pelo mesmo motivo do Atributo acima
    //: — e ainda distingue de "Subtema (fornecedor)" logo abaixo, que é outra
    //: coisa.
    { chave: 'tema_n3', rotulo: 'Subtema (N3)', de: 'temas_n3' },
    { chave: 'subtema', rotulo: 'Subtema (fornecedor)', de: 'subtemas' },
    { chave: 'empresa', rotulo: 'Concessionária', de: 'empresas' },
    { chave: 'uf', rotulo: 'UF', de: 'ufs' },
    { chave: 'autor', rotulo: rotuloDoAutor(lente), de: 'autores' },
    { chave: 'perfil_autor', rotulo: 'Perfil de quem fala', de: 'perfis' },
  ];
}

export interface ColunaDaBase {
  rotulo: string;
  valor: (mencao: MencaoDaBase) => string;
  /** O campo de ordenação do servidor, quando a coluna ordena. */
  ordena?: string;
}

const dataBr = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');

/** As colunas da tabela. "Matéria / post" é desenhada à parte (tem o link). */
export function colunasDaBase(lente: string): ColunaDaBase[] {
  return [
    { rotulo: 'Data', valor: (m) => dataBr(m.data) || m.mes, ordena: 'data' },
    { rotulo: 'Fonte', valor: (m) => m.fonte },
    { rotulo: rotuloDoVeiculo(lente), valor: (m) => m.veiculo ?? '', ordena: 'veiculo' },
    { rotulo: 'Tier', valor: (m) => (m.tier ? (ROTULO_DO_TIER[m.tier] ?? m.tier) : ''), ordena: 'tier' },
    {
      rotulo: 'Sentimento',
      valor: (m) => (m.sentimento ? (ROTULO_DO_SENTIMENTO[m.sentimento] ?? m.sentimento) : ''),
      ordena: 'sentimento',
    },
    { rotulo: 'Matéria / post', valor: (m) => m.titulo ?? '' },
    //: "ATRIBUTO (N1)" É O PILAR/N1 (`tema_n1`) — ver o comentário de `camposDaBase`.
    //: A coluna antiga do campo `atributo` saiu por duplicar este valor.
    { rotulo: 'Atributo (N1)', valor: (m) => m.tema_n1 ?? '' },
    { rotulo: 'Tema estratégico (N2)', valor: (m) => m.tema_n2 ?? '' },
    //: "SUBTEMA (N3)" É O N3 (`tema_n3`) — ver o comentário de `camposDaBase`.
    { rotulo: 'Subtema (N3)', valor: (m) => m.tema_n3 ?? '' },
    { rotulo: 'Subtema (fornecedor)', valor: (m) => m.subtema ?? '' },
    { rotulo: 'Concessionária', valor: (m) => m.empresa ?? '', ordena: 'empresa' },
    { rotulo: 'UF', valor: (m) => m.uf ?? '', ordena: 'uf' },
    { rotulo: rotuloDoAutor(lente), valor: (m) => m.autor ?? '', ordena: 'autor' },
    { rotulo: 'Perfil de quem fala', valor: (m) => m.perfil_autor ?? '' },
    {
      rotulo: 'Engajamento',
      valor: (m) => (m.engajamento === null ? '' : m.engajamento.toLocaleString('pt-BR')),
      ordena: 'engajamento',
    },
    { rotulo: 'Link', valor: (m) => m.link ?? '' },
  ];
}

/** As colunas que nascem escondidas — dá para ligar no seletor de colunas. */
export const COLUNAS_OCULTAS_POR_PADRAO = [
  //: "Tema estratégico (N2)" saiu daqui por pedido (2026-10-16): com "Atributo
  //: (N1)" e "Subtema (N3)" já visíveis por padrão, faltava o N2 no meio.
  'Subtema (fornecedor)',
  'Perfil de quem fala',
  'Link',
];

//: O LAYOUT DE SAÍDA DA TABELA, coluna a coluna. Antes só "Matéria / post" tinha
//: largura: com `table-layout: fixed`, as outras dezesseis dividiam o que
//: sobrava, se espremiam, e o texto invadia a vizinha. Agora TODA coluna nasce
//: com a largura que o conteúdo dela pede, e quem quiser ajusta (arrastar a
//: borda do cabeçalho; dois cliques voltam ao padrão).
const LARGURA_PADRAO: Record<string, number> = {
  Data: 112,
  Fonte: 120,
  Veículo: 140,
  Rede: 120,
  Canal: 120,
  Tier: 80,
  Sentimento: 124,
  'Matéria / post': 380,
  'Atributo (N1)': 180,
  'Tema estratégico (N2)': 190,
  'Subtema (N3)': 190,
  'Subtema (fornecedor)': 190,
  Concessionária: 140,
  UF: 70,
  Jornalista: 140,
  Autor: 140,
  'Perfil de quem fala': 150,
  Engajamento: 110,
  Link: 220,
};
const LARGURA_DAS_DEMAIS = 150;

/** A largura de saída de uma coluna, em px. */
export function larguraPadraoDaColuna(rotulo: string): number {
  return LARGURA_PADRAO[rotulo] ?? LARGURA_DAS_DEMAIS;
}

/** As larguras de saída das colunas à mostra — o que a `Tabela` recebe. */
export function largurasPadraoDaBase(rotulos: string[]): Record<string, number> {
  return Object.fromEntries(rotulos.map((rotulo) => [rotulo, larguraPadraoDaColuna(rotulo)]));
}

//: AS COLUNAS DE TEXTO LONGO QUEBRAM LINHA (o nome do tema e da matéria é uma
//: frase); as curtas e o link ficam numa linha só, com reticências, e o valor
//: inteiro aparece ao passar o mouse.
//:
//: E QUEBRAR LIVRE NÃO BASTA PARA DUAS DELAS, medido na base de 28.617 menções:
//: o título mais longo tem 2.169 caracteres, que em 380px são ~39 linhas numa
//: célula — e 25% dos títulos passam de três linhas. A célula gigante estica a
//: linha inteira da tabela. Essas duas param em N linhas
//: (`colunaLimitaLinhas`), com o valor completo no `title`.
const COLUNAS_QUE_QUEBRAM = new Set([
  'Matéria / post',
  'Atributo (N1)',
  'Tema estratégico (N2)',
  'Subtema (N3)',
  'Subtema (fornecedor)',
  'Concessionária',
  'Fonte',
]);

export function colunaQuebraLinha(rotulo: string): boolean {
  return COLUNAS_QUE_QUEBRAM.has(rotulo) || rotulo in LINHAS_DA_COLUNA;
}

//: QUANTAS LINHAS CADA COLUNA DE TEXTO LONGO OCUPA, no máximo.
//:
//: "MATÉRIA / POST" EM TRÊS: o título mais longo da base tem 2.169 caracteres —
//: ~39 linhas em 380px. Três linhas mostram ~165 caracteres, mais que a média
//: (131), então a maioria aparece inteira.
//:
//: "VEÍCULO" EM DUAS, e aqui o motivo é perda de informação: a coluna tem 140px
//: e não quebrava, então cabiam ~20 caracteres. 918 dos 3.729 veículos passam
//: disso, e 42 veículos DIFERENTES começam com "Prefeitura Municipal" — nos
//: vinte primeiros caracteres eles aparecem idênticos. Duas linhas mostram ~40
//: caracteres, que é onde esses nomes se separam.
//:
//: O RÓTULO DO VEÍCULO MUDA POR LENTE (`rotuloDoVeiculo`): nas redes ele é
//: "Rede", nos canais próprios "Canal". Os três entram, porque é a mesma coluna.
const LINHAS_DA_COLUNA: Record<string, 2 | 3> = {
  'Matéria / post': 3,
  Veículo: 2,
  Rede: 2,
  Canal: 2,
};

/** A classe que para o texto em N linhas, ou `undefined` para quebrar livre. */
export function classeDasLinhasDaColuna(rotulo: string): string | undefined {
  const linhas = LINHAS_DA_COLUNA[rotulo];
  if (linhas === 3) return 'tres-linhas';
  if (linhas === 2) return 'duas-linhas';
  return undefined;
}

/** "Últimos 30 dias" etc. → `de` e `ate` em AAAA-MM-DD; "tudo" → nenhum. */
export function periodoDoAtalho(atalho: string, hoje = new Date()): { de?: string; ate?: string } {
  const dias = { '30': 30, '90': 90, '180': 180, '365': 365 }[atalho];
  if (!dias) return {};
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - dias);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { de: iso(inicio), ate: iso(hoje) };
}

/** O CSV da Base, com as colunas visíveis, separado por ";" (o Excel em
 *  português abre direto). */
export function csvDaBase(mencoes: MencaoDaBase[], colunas: ColunaDaBase[]): string {
  const escapar = (valor: string) => `"${valor.replace(/"/g, '""')}"`;
  return [
    colunas.map((c) => escapar(c.rotulo)).join(';'),
    ...mencoes.map((m) => colunas.map((c) => escapar(c.valor(m))).join(';')),
  ].join('\r\n');
}
