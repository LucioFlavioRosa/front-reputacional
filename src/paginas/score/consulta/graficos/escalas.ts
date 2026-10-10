/** Contas de desenho dos gráficos da Consulta em profundidade (Parte F).
 *
 *  SÓ GEOMETRIA E RÓTULO: nenhum número de negócio nasce aqui. O que a tela
 *  mostra vem do JSON; estas funções dizem que largura uma barra tem, onde
 *  uma coluna começa e como a frase do destaque é montada. Ficam num `.ts`
 *  porque arquivo `.tsx` exporta só componentes (regra do lint).
 */

import { fmtInt, fmtPt } from '../formatacao';

/** Fração `valor ÷ maximo`, presa entre 0 e 1. Máximo zero ou negativo dá 0
 *  (nada a desenhar, e nunca divisão por zero). */
export function proporcao(valor: number, maximo: number): number {
  if (!(maximo > 0) || !(valor > 0)) return 0;
  return Math.min(valor / maximo, 1);
}

/** A mesma fração como largura CSS: `'42%'`. */
export function larguraPct(valor: number, maximo: number): string {
  return `${proporcao(valor, maximo) * 100}%`;
}

// ---------------------------------------------------------------------------
// F.5 · Colunas de impacto mês a mês
// ---------------------------------------------------------------------------

export const COLUNAS = {
  topo: 40,
  base: 220,
  /** Centro da coluna i: `80 + i × 88`. */
  x0: 80,
  passo: 88,
  largura: 46,
} as const;

/** Domínio `[min(0, menor) × 1,15 ; max(0, maior) × 1,15]`; tudo zero (ou
 *  nada) dá `[−1, 1]`. */
export function dominioDasColunas(valores: readonly number[]): [number, number] {
  const menor = Math.min(0, ...valores);
  const maior = Math.max(0, ...valores);
  if (menor === 0 && maior === 0) return [-1, 1];
  return [menor * 1.15, maior * 1.15];
}

/** `y(v)` da área de plotagem de 40 a 220. */
export function yDaColuna(v: number, [minimo, maximo]: [number, number]): number {
  return COLUNAS.topo + ((maximo - v) * (COLUNAS.base - COLUNAS.topo)) / (maximo - minimo);
}

export function xDaColuna(i: number): number {
  return COLUNAS.x0 + i * COLUNAS.passo;
}

/** Dica de cada coluna: `ago/26 · −4,6 pt · 214 matérias`. */
export function rotuloDaColuna(mes: string, impacto: number, volume: number, unidade: string): string {
  return `${mes} · ${fmtPt(impacto)} · ${fmtInt(volume)} ${unidade}`;
}

// ---------------------------------------------------------------------------
// F.7 · Matérias por dia
// ---------------------------------------------------------------------------

export const DIARIO = {
  esquerda: 20,
  direita: 628,
  base: 120,
  alturaUtil: 100,
  topoDaFaixa: 4,
} as const;

/** `608 ÷ dias` (31 em agosto). */
export function larguraDoDia(dias: number): number {
  return (DIARIO.direita - DIARIO.esquerda) / Math.max(dias, 1);
}

/** `ceil(maior total × 1,1)`; nunca menos que 1, para a escala não dividir
 *  por zero num mês sem matérias. */
export function yMaxDoDiario(totais: readonly number[]): number {
  return Math.max(1, Math.ceil(Math.max(0, ...totais) * 1.1));
}

/** Marcas 1, 5, 10, 15, 20, 25 e o último dia do mês (31 em agosto). */
export function marcasDoDiario(dias: number): number[] {
  const marcas = [1, 5, 10, 15, 20, 25].filter((d) => d < dias);
  return dias >= 1 ? [...marcas, dias] : [];
}

/** Soma dos totais do dia `inicio` ao dia `fim`, inclusive (dias contados de
 *  1, como no JSON). */
export function somaDoIntervalo(totais: readonly number[], inicio: number, fim: number): number {
  return totais.slice(Math.max(inicio - 1, 0), Math.max(fim, 0)).reduce((s, n) => s + n, 0);
}

function dd(dia: number): string {
  return String(dia).padStart(2, '0');
}

function contagem(n: number, singular: string, plural: string): string {
  return `${fmtInt(n)} ${n === 1 ? singular : plural}`;
}

/** Texto da faixa de destaque: `12 a 18/08 · 69 matérias`. O mês vem de
 *  quem chama (do JSON), nunca fixo. */
export function rotuloDoDestaque(
  totais: readonly number[],
  destaque: { inicio: number; fim: number },
  mes: string,
): string {
  const soma = somaDoIntervalo(totais, destaque.inicio, destaque.fim);
  return `${dd(destaque.inicio)} a ${dd(destaque.fim)}/${mes} · ${contagem(soma, 'matéria', 'matérias')}`;
}

/** Dica de cada dia: `14/08 · 12 matérias, 10 negativas`. */
export function rotuloDoDia(dia: number, mes: string, total: number, negativas: number): string {
  return `${dd(dia)}/${mes} · ${contagem(total, 'matéria', 'matérias')}, ${contagem(negativas, 'negativa', 'negativas')}`;
}

/** Dia (contado de 1) com o maior total; empate fica com o primeiro. Mês
 *  vazio ou só de zeros não tem pico. */
export function diaDePico(totais: readonly number[]): number | undefined {
  let pico: number | undefined;
  totais.forEach((t, i) => {
    if (t > 0 && (pico === undefined || t > totais[pico - 1])) pico = i + 1;
  });
  return pico;
}

/** Largura aproximada de um caractere de 11px em DM Sans 700, em unidades do
 *  `viewBox`. Serve só para a frase da faixa não sair pela borda. */
const LARGURA_DO_CARACTERE = 6.2;

/** Centro da frase da faixa: o meio da faixa, puxado para dentro quando a
 *  faixa encosta numa borda e a frase sairia do gráfico. */
export function xDaFraseDoDestaque(faixaX: number, faixaLargura: number, frase: string): number {
  const meia = (frase.length * LARGURA_DO_CARACTERE) / 2;
  const centro = faixaX + faixaLargura / 2;
  return Math.min(Math.max(centro, DIARIO.esquerda + meia), DIARIO.direita - meia);
}

/** Mês de dois dígitos de um `AAAA-MM` (`meta.mesReferencia`). */
export function mesDe(mesReferencia: string): string {
  return mesReferencia.slice(5, 7);
}
