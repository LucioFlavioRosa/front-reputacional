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
  /** O peso gravado na calibração. */
  peso: number;
  /** O que ele valeu de fato, em %, depois de as lentes sem dado saírem do
   *  denominador. Com uma lente fora, Imprensa vale 30 de 70 — 43%. */
  peso_efetivo: number;
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

/** Um corte de detector de sinal, como a Calibração o mostra.
 *
 *  O PADRÃO VEM DO SERVIDOR, e não daqui: guardá-lo na tela seria uma segunda
 *  cópia dos números, que envelheceria na primeira vez que alguém mudasse um
 *  padrão no back. */
export interface LimiteDaCalibracao {
  chave: string;
  rotulo: string;
  /** O que muda quando este número muda, em uma frase. */
  explicacao: string;
  valor: number;
  padrao: number;
  /** `inteiro` não aceita vírgula: "3,5 meses seguidos" não significa nada. */
  formato: 'decimal' | 'inteiro';
  unidade: string | null;
}

export interface Calibracao {
  pesos: Record<string, number>;
  regua_tier: string;
  regua_engajamento: string;
  fontes_desligadas: string[];
  /** Os oito cortes dos detectores de sinal, com o de fábrica ao lado. */
  limites: LimiteDaCalibracao[];
  /** Falso quando alguém ajustou a régua — a tela mostra o chip. */
  padrao: boolean;
}

export interface CalibracaoEntrada {
  pesos?: Record<string, number>;
  regua_tier?: string;
  regua_engajamento?: string;
  fontes_desligadas?: string[];
  limites?: Record<string, number>;
}

/** O que desta régua foi mexido, e só isso.
 *
 *  GRAVAR OS OITO SEMPRE faria toda calibração parecer ajustada, e "voltar ao
 *  padrão" deixaria de ser distinguível de "gravei os mesmos números" — o chip
 *  de régua ajustada ficaria aceso para sempre. */
export function limitesAjustados(limites: LimiteDaCalibracao[]): Record<string, number> {
  const ajustados: Record<string, number> = {};
  for (const limite of limites) {
    if (limite.valor !== limite.padrao) ajustados[limite.chave] = limite.valor;
  }
  return ajustados;
}

/** A régua que vai para o servidor depois de mexer num campo.
 *
 *  VOLTAR AO VALOR DE FÁBRICA TIRA A CHAVE, em vez de gravá-la igual ao
 *  padrão: é o que faz "restaurei este limite" e "nunca toquei nele" virarem a
 *  mesma coisa, que é o que a pessoa quis dizer. */
export function comLimiteAjustado(
  limites: LimiteDaCalibracao[],
  chave: string,
  valor: number,
): Record<string, number> {
  const alvo = limites.find((limite) => limite.chave === chave);
  const ajustados = limitesAjustados(limites);
  if (!alvo) return ajustados;
  if (valor === alvo.padrao) delete ajustados[chave];
  else ajustados[chave] = valor;
  return ajustados;
}

/** O que a pessoa digitou, virado número — ou nulo quando não é um.
 *
 *  O CAMPO É DE TEXTO PORQUE ELE PRECISA ACEITAR VÍRGULA: `<input
 *  type="number">` recusa "1,5" em teclado brasileiro e devolve string vazia,
 *  e a pessoa vê o campo apagar sozinho enquanto digita. */
export function comoLimite(texto: string, formato: 'decimal' | 'inteiro'): number | null {
  const limpo = texto.trim().replace(',', '.');
  if (!limpo) return null;
  const bruto = Number(limpo);
  if (!Number.isFinite(bruto)) return null;
  // ARREDONDA ANTES DE RECUSAR O ZERO, e não depois: "0,4" num campo inteiro
  // vira 0, que é um divisor inválido. Validando primeiro, ele passaria daqui
  // como 0,4, seria arredondado para 0, e o servidor o recusaria — deixando o
  // campo preso num erro que a tela tinha como evitar.
  const numero = formato === 'inteiro' ? Math.round(bruto) : bruto;
  if (numero <= 0) return null;
  return numero;
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
  nome: string;
  linhas: number;
  ingeridas: number;
  /** Quantas menções esta fonte tinha nestes meses ANTES da substituição.
   *  É o que deixa um export parcial — baixado antes do fechamento — aparecer
   *  como o que é: um mês que encolheu. */
  antes: number;
  /** Por motivo: `fora_do_filtro`, `sem_data`, `sem_sentimento`. */
  descartes: Record<string, number>;
  /** O que entrou, mas merece um olhar: `tier_nao_reconhecido`. */
  avisos: Record<string, number>;
  meses: string[];
}

export const ROTULO_DO_DESCARTE: Record<string, string> = {
  fora_do_filtro: 'fora do recorte desta fonte',
  sem_data: 'sem data',
  sem_sentimento: 'sem classificação de sentimento',
};

export const ROTULO_DO_AVISO: Record<string, string> = {
  tier_nao_reconhecido: 'com relevância que não é da escala da Clipei',
};

/** A aba de Drivers e riscos: o porquê do número.
 *
 *  As três listas vêm das menções uma a uma — não do agregado mensal, que já
 *  perdeu o atributo, o tema e a unidade ao somar. `mencoes_no_mes` distingue
 *  "não houve nada a dizer" de "a planilha ainda não foi importada": duas
 *  situações que dariam a mesma tela vazia. */
export interface DriversDoScore {
  mes: string;
  atributos: AtributoDoScore[];
  unidades: UnidadeDoScore[];
  perpetuacao: TemaEmPerpetuacao[];
  /** Os números que definem "em perpetuação" — ditos por quem aplica a regra,
   *  para a tela não explicar a lista com uma constante que envelheceu. */
  regra_da_perpetuacao: { meses_da_janela: number; meses_para_perpetuar: number };
  mencoes_no_mes: number;
  /** Quantas fontes de planilha estão no cálculo. Zero com menção no banco
   *  significa "você desligou tudo", e não "falta importar". */
  fontes_ligadas: number;
}

export interface AtributoDoScore {
  nome: string;
  positivo: number;
  neutro: number;
  negativo: number;
  score: number;
  ns: number;
}

export interface UnidadeDoScore {
  nome: string;
  negativas: number;
  mencoes: number;
  /** Quanto do negativo do mês inteiro está nesta unidade. */
  participacao: number;
}

export interface TemaEmPerpetuacao {
  tema: string;
  meses: number;
  primeiro_mes: string;
  ultimo_mes: string;
  negativas: number;
  lentes: string[];
}

export interface OpcoesDoScore {
  reguas_de_tier: { codigo: string; pesos: Record<string, number> }[];
  reguas_de_engajamento: string[];
  lentes: { codigo: string; nome: string; stakeholder: string; peso_padrao: number }[];
  meses: string[];
  /** Em que mês abrir — o de mais lentes medidas, e não o último. Nulo quando
   *  não há mês nenhum com dado. */
  mes_sugerido: string | null;
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

/** O peso de uma lente como a tela o diz.
 *
 *  UM NÚMERO SÓ QUANDO OS DOIS BATEM, e dois quando não batem: "30%" com as
 *  cinco lentes medidas, "43% (de 30%)" quando uma saiu e as outras
 *  redistribuíram. Dizer sempre os dois viraria ruído; dizer só o nominal
 *  esconderia que a lente pesou mais do que a calibração mandou. */
export function pesoDaLente(lente: LenteDoScore): string {
  if (lente.score === null) return 'fora do cálculo';
  if (lente.peso_efetivo === lente.peso) return `${lente.peso}%`;
  return `${lente.peso_efetivo}% (de ${lente.peso}%)`;
}

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
