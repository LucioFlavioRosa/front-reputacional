/** Formatação da Consulta em profundidade (spec E.2, C.5 e E.1).
 *
 *  POR QUE NÃO REUSAR `src/dominio/formato.ts` (decisão A13): as funções de lá
 *  usam hífen como sinal de menos e `toFixed`, e a spec proíbe os dois. O
 *  hífen quebra a leitura dos números com sinal; `toFixed` erra casos de meio
 *  por ponto flutuante (`(1.005).toFixed(2)` dá `'1.00'`; `arred(1.005, 2)`
 *  dá `1,01`).
 *
 *  REGRA DE SINAL, igual em todas as funções: zero exato não leva sinal, e um
 *  valor que arredonda para zero também mostra zero sem sinal (`0,0`, nunca
 *  `−0,0`). O sinal de menos é sempre `−` (U+2212).
 */

import type { Dados } from './dados/tipos';

export const MENOS = '−';

/** Meio para cima, como `Math.round` (C.5). O `EPSILON` compensa a
 *  representação binária de valores como 1,005, que de outro modo cairiam
 *  para baixo. */
export function arred(x: number, casas = 0): number {
  const f = 10 ** casas;
  return Math.round((x + Number.EPSILON) * f) / f;
}

/** Milhar com ponto. Recebe um inteiro não negativo. */
function milhar(inteiro: number): string {
  return String(inteiro).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Valor absoluto já arredondado, com vírgula decimal e `casas` dígitos,
 *  SEM `toFixed`: separa a parte inteira e a fração à mão. */
function absolutoComCasas(x: number, casas: number): string {
  const v = Math.abs(arred(x, casas));
  const inteiro = Math.floor(v);
  if (casas === 0) return milhar(inteiro);
  const fracao = Math.round((v - inteiro) * 10 ** casas);
  return `${milhar(inteiro)},${String(fracao).padStart(casas, '0')}`;
}

/** Sinal do valor arredondado: '' para zero (inclusive `−0`), `−` ou `+`. */
function sinal(x: number, casas: number): string {
  const r = arred(x, casas);
  if (r === 0) return '';
  return r < 0 ? MENOS : '+';
}

function comSinal(x: number, casas: number): string {
  return sinal(x, casas) + absolutoComCasas(x, casas);
}

/** Pontos na nota, 1 casa: `−7,4 pt` | `+1,2 pt` | `0,0 pt`. */
export function fmtPt(x: number): string {
  return `${comSinal(x, 1)} pt`;
}

/** Impacto de um item, 2 casas, sem unidade: `−0,12` | `+0,12` | `0,00`. */
export function fmtPtItem(x: number): string {
  return comSinal(x, 2);
}

/** Pontos com 1 casa e sem unidade (listas de concentração e recortes):
 *  `−3,4` | `+0,7` | `0,0`. */
export function fmtPtCurto(x: number): string {
  return comSinal(x, 1);
}

/** Inteiro com milhar: `18.420`. Negativo leva `−`, positivo não leva sinal. */
export function fmtInt(n: number): string {
  const r = arred(n);
  return (r < 0 ? MENOS : '') + absolutoComCasas(r, 0);
}

/** Percentual inteiro: `61%`. */
export function fmtPct(n: number): string {
  return `${fmtInt(n)}%`;
}

/** Saldo pos − neg em pontos percentuais: `−36` | `+23` | `0`. */
export function fmtSaldo(pos: number, neg: number): string {
  return comSinal(pos - neg, 0);
}

/** Variação da nota: `▼ 6 pt` em vermelho de texto, `▲ 4 pt` em verde de
 *  texto. Zero (ou o que arredonda para zero) vira `0 pt` em cinza, sem seta:
 *  a spec não define o caso, e uma seta para um número nulo afirmaria uma
 *  direção que não existe. */
export function fmtDelta(d: number): { texto: string; cor: string } {
  const r = arred(d);
  if (r === 0) return { texto: '0 pt', cor: 'var(--cinza-3)' };
  const texto = `${r < 0 ? '▼' : '▲'} ${absolutoComCasas(r, 0)} pt`;
  return { texto, cor: corDoSinal(r) };
}

/** `2026-08-12` → `12/08`. Corta a string em vez de passar por `Date`, o que
 *  evita o deslocamento de um dia por fuso. */
export function fmtDataCurta(iso: string): string {
  const [, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}`;
}

/** `2026-08-12` → `12/08/2026`. */
export function fmtDataLonga(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Cor de TEXTO para um número com sinal (nunca as cores de gráfico, por
 *  contraste — E.1). */
export function corDoSinal(x: number): string {
  if (x < 0) return 'var(--erro-fg)';
  if (x > 0) return 'var(--ok-fg)';
  return 'var(--cinza-3)';
}

/** Faixa da nota, lida de `dados.faixas` (E.1, decisão A14). Escolhe a faixa
 *  de maior `min` que a nota alcança, o que também cobre nota fracionária
 *  entre duas faixas (54,5 continua em Atenção) e nota abaixo de todas (cai
 *  na mais baixa). */
export function faixaDe(nota: number, faixas: Dados['faixas']): Dados['faixas'][number] {
  if (faixas.length === 0) throw new Error('faixaDe: lista de faixas vazia');
  const ordenadas = [...faixas].sort((a, b) => b.min - a.min);
  return ordenadas.find((f) => nota >= f.min) ?? ordenadas[ordenadas.length - 1];
}
