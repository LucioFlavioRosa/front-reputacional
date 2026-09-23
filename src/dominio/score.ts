/** O Score Executivo, como a tela o conhece.
 *
 *  AQUI NÃO SE CALCULA NADA DO ÍNDICE. O NS, o score de cada lente e o ISR
 *  vêm prontos do servidor — é um número que a diretoria cita em reunião, e
 *  ele precisa ser o mesmo para todo mundo, com a régua que a coordenação
 *  gravou. Recalcular no navegador criaria uma segunda verdade, que divergiria
 *  no primeiro deploy que uma aba não recebeu.
 *
 *  O que mora neste arquivo é o que a TELA precisa decidir: a cor de uma
 *  faixa, o rótulo de uma régua, como se lê um delta.
 */

import type { ItemContado, Segmento } from '@/dominio/derivacoes';

export interface LenteDoScore {
  codigo: string;
  nome: string;
  peso: number;
  /** Nulo quando a lente ficou de fora do cálculo. */
  score: number | null;
  ns: number | null;
  /** Contra o mês anterior. Nulo quando não há os dois meses. */
  delta: number | null;
  fontes: string[];
  /** O número veio do resumo semestral, e não de medição. */
  estimado: boolean;
  /** Por que ficou de fora, quando ficou. */
  ausencia: string | null;
}

export interface FatoDoMes {
  id: string;
  mes: string;
  texto: string;
  /** `sustenta` | `pressiona` | `misto` */
  efeito: string;
}

export interface Calibracao {
  pesos: Record<string, number>;
  regua_tier: string;
  regua_engajamento: string;
  fontes_desligadas: string[];
  /** Falso quando alguém ajustou a régua — a tela mostra o chip. */
  padrao: boolean;
}

export interface CalibracaoEntrada {
  pesos?: Record<string, number>;
  regua_tier?: string;
  regua_engajamento?: string;
  fontes_desligadas?: string[];
}

export interface IndiceDoScore {
  mes: string;
  isr: number | null;
  faixa: string;
  leitura_da_faixa: string;
  delta_mes: number | null;
  delta_inicio: number | null;
  lentes: LenteDoScore[];
  calibracao: Calibracao;
  fatos: FatoDoMes[];
  /** A frase gerada: o que sustenta e o que corrói. */
  leitura: string;
}

export interface PontoDaSerie {
  mes: string;
  isr: number | null;
  /** Quantas das cinco lentes formaram o ponto. */
  lentes: number;
  tem_estimativa: boolean;
}

export interface FonteDoScore {
  codigo: string;
  nome: string;
  fornecedor: string;
  lente: string;
  interna: boolean;
  ativo: boolean;
  ligada: boolean;
  observacao: string | null;
  meses_com_dado: number;
  mencoes_no_mes: number;
}

export interface LenteDetalhada {
  codigo: string;
  nome: string;
  stakeholder: string;
  score: number | null;
  ns: number | null;
  peso: number;
  estimado: boolean;
  ausencia: string | null;
  composicao: { positivo: number; neutro: number; negativo: number };
  formula: string;
  fontes: { codigo: string; nome: string; ns: number | null; mencoes: number; ligada: boolean }[];
  temas: { nome: string; positivo: number; negativo: number; tipo: string | null }[];
}

/** O que a importação de uma planilha rendeu.
 *
 *  OS DESCARTES APARECEM NA TELA. Um resumo que diz só "4.973 menções" esconde
 *  que 1.426 posts vieram sem classificação de sentimento — e quem for
 *  conferir o número do mês precisa saber que a diferença entre o que o
 *  fornecedor mandou e o que entrou é recusa declarada, e não perda. */
export interface ImportacaoDoScore {
  fonte: string;
  linhas: number;
  ingeridas: number;
  /** Por motivo: `fora_do_filtro`, `sem_data`, `sem_sentimento`. */
  descartes: Record<string, number>;
  meses: string[];
}

export const ROTULO_DO_DESCARTE: Record<string, string> = {
  fora_do_filtro: 'fora do recorte desta fonte',
  sem_data: 'sem data',
  sem_sentimento: 'sem classificação de sentimento',
};

export interface OpcoesDoScore {
  reguas_de_tier: { codigo: string; pesos: Record<string, number> }[];
  reguas_de_engajamento: string[];
  lentes: { codigo: string; nome: string; stakeholder: string; peso_padrao: number }[];
  meses: string[];
}

/** As faixas do índice, da pior para a melhor.
 *
 *  AS CORES SÃO AS DA PLATAFORMA, e não as do protótipo: o mesmo vermelho que
 *  marca clima Reativo e prazo vencido marca aqui o Crítico. Um verde só desta
 *  tela ensinaria uma segunda escala de cor a quem já aprendeu a primeira. */
export const FAIXAS: { minimo: number; rotulo: string; cor: string }[] = [
  { minimo: 85, rotulo: 'Referência', cor: 'var(--ok-fg)' },
  { minimo: 70, rotulo: 'Sólido', cor: 'var(--ok-fg)' },
  { minimo: 55, rotulo: 'Estável', cor: 'var(--azul-mar)' },
  { minimo: 40, rotulo: 'Atenção', cor: 'var(--atencao-fg)' },
  { minimo: 0, rotulo: 'Crítico', cor: 'var(--erro-fg)' },
];

export function corDaFaixa(score: number | null): string {
  if (score === null) return 'var(--cinza-2)';
  return (FAIXAS.find((faixa) => score >= faixa.minimo) ?? FAIXAS[FAIXAS.length - 1]).cor;
}

/** Os rótulos das réguas, em português de gente.
 *
 *  O servidor manda o CÓDIGO (`so_tier1`), porque é ele que se grava; o nome
 *  é decisão de tela, e muda sem migration. */
export const ROTULO_DA_REGUA_DE_TIER: Record<string, string> = {
  aegea: '10 · 5 · 1 — rascunho da Aegea',
  suave: '5 · 3 · 1 — relevância atenuada',
  forte: '20 · 5 · 1 — Tier 1 domina',
  igual: '1 · 1 · 1 — sem ponderação',
  so_tier1: 'só Tier 1 — ignora regionais e locais',
};

export const ROTULO_DA_REGUA_DE_ENGAJAMENTO: Record<string, string> = {
  n: 'contagem — cada menção vale 1',
  log: 'log do engajamento — 1 + log₁₀(1 + interações)',
  bruto: 'engajamento bruto — um viral domina o mês',
  cargo: 'cargo do autor — influência institucional (só Bites)',
};

export const ROTULO_DO_EFEITO: Record<string, string> = {
  sustenta: 'Sustenta',
  pressiona: 'Pressiona',
  misto: 'Misto',
};

/** "+3" / "−2" / "—". O sinal explícito é o que faz o número ser lido como
 *  variação, e não como valor. */
export function comoDelta(delta: number | null): string {
  if (delta === null) return '—';
  if (delta === 0) return 'estável';
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}

export function corDoDelta(delta: number | null): string {
  if (delta === null || delta === 0) return 'var(--cinza-2)';
  return delta > 0 ? 'var(--ok-fg)' : 'var(--erro-fg)';
}

/** As cinco lentes como itens de ranking, da melhor para a pior.
 *
 *  As que ficaram de fora vão para o fim: elas não têm score para comparar, e
 *  no meio da lista pareceriam zero. */
export function lentesOrdenadas(lentes: LenteDoScore[]): LenteDoScore[] {
  const comDado = lentes.filter((lente) => lente.score !== null);
  const sem = lentes.filter((lente) => lente.score === null);
  return [...comDado.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)), ...sem];
}

/** A composição de uma lente como os segmentos que a barra desenha. */
export function segmentosDaComposicao(
  composicao: { positivo: number; neutro: number; negativo: number },
): Segmento[] {
  return [
    { chave: 'pos', rotulo: 'Positivo', total: composicao.positivo, cor: 'var(--ok-fg)' },
    { chave: 'neu', rotulo: 'Neutro', total: composicao.neutro, cor: 'var(--cinza-2)' },
    { chave: 'neg', rotulo: 'Negativo', total: composicao.negativo, cor: 'var(--erro-fg)' },
  ];
}

/** A série mensal como colunas de barra — a evolução do índice.
 *
 *  UM PONTO PARCIAL NÃO SE DESENHA IGUAL A UM COMPLETO: um mês medido por uma
 *  lente só produz um ISR legítimo pela fórmula e enganoso na curva. A cor
 *  esmaecida e o rótulo dizem quantas lentes entraram. */
export function colunasDaSerie(serie: PontoDaSerie[]): ItemContado[] {
  return serie.map((ponto) => ({
    chave: ponto.mes,
    rotulo: ponto.mes,
    total: ponto.isr ?? 0,
    cor: ponto.lentes >= 4 ? corDaFaixa(ponto.isr) : 'var(--cinza-1)',
  }));
}
