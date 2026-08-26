/** Cor e rótulo de cada frente, e os demais vocabulários visuais.
 *
 *  As cores vêm do guia oficial da Aegea. Governo e Legislativo usam texto
 *  escuro sobre o próprio fundo — turquesa e amarelo não sustentam texto
 *  branco com contraste suficiente.
 */

import type { Frente, GrupoDeStatus } from '@/dominio/tipos';

export const CORES_DE_FRENTE: Record<Frente, string> = {
  imprensa: '#0027BD',
  governo: '#17E3CB',
  parceiros: '#A11FFF',
  eventos: '#FE952B',
  investidores: '#E12379',
  legislativo: '#F8DC00',
  interna: '#8C91A4',
};

export const ROTULOS_DE_FRENTE: Record<Frente, string> = {
  imprensa: 'Imprensa',
  governo: 'Governo',
  parceiros: 'Parceiros',
  eventos: 'Eventos',
  investidores: 'Investidores',
  legislativo: 'Legislativo',
  interna: 'Interna',
};

/** Frentes cujo chip precisa de texto escuro para o contraste fechar. */
const FUNDO_CLARO: ReadonlySet<Frente> = new Set<Frente>(['governo', 'legislativo']);

export function textoSobreFrente(frente: Frente): string {
  return FUNDO_CLARO.has(frente) ? '#00312C' : '#FFFFFF';
}

export const CORES_DE_CLIMA: Record<string, string> = {
  propositivo: '#17E3CB',
  neutro: '#8C91A4',
  tenso: '#FF5C60',
};

export const CORES_DE_RESULTADO: Record<string, string> = {
  avancou: '#17E3CB',
  mantido: '#0027BD',
  recuou: '#FF5C60',
  sem_definicao: '#D5DAEA',
};

export const CORES_DE_GRUPO: Record<GrupoDeStatus, string> = {
  resolvido: '#17E3CB',
  aberto: '#FE952B',
  declinado: '#FF5C60',
};

export const ROTULOS_DE_GRUPO: Record<GrupoDeStatus, string> = {
  resolvido: 'Resolvidos',
  aberto: 'Em aberto',
  declinado: 'Declinados',
};

/** Faixas de risco da fila de pendências, em dias desde a interação. */
export type FaixaDeRisco = 'no-prazo' | 'atencao' | 'critico';

export function faixaDeRisco(dias: number): FaixaDeRisco {
  if (dias > 60) return 'critico';
  if (dias > 30) return 'atencao';
  return 'no-prazo';
}

export const ROTULOS_DE_RISCO: Record<FaixaDeRisco, string> = {
  'no-prazo': 'No prazo',
  atencao: 'Atenção',
  critico: 'Crítico',
};

export const CORES_DE_RISCO: Record<FaixaDeRisco, { fundo: string; texto: string }> = {
  'no-prazo': { fundo: '#DFFAF6', texto: '#0A6B60' },
  atencao: { fundo: '#FFF1DC', texto: '#8A4E00' },
  critico: { fundo: '#FFE7E8', texto: '#B32328' },
};

export const CORES_DE_TIER: Record<number, string> = {
  1: '#0027BD',
  2: '#8C91A4',
  3: '#D5DAEA',
};

/** Rótulo humano da abrangência.
 *
 *  `NA` e `IN` são códigos de banco. Fora do ranking do mapa eles estavam
 *  vazando crus para a tela — a Base mostrava "NA" em vez de "Nacional". */
export function rotuloDeAbrangencia(uf: string): string {
  if (uf === 'NA') return 'Nacional';
  if (uf === 'IN') return 'Internacional';
  return uf;
}
