/** O Recorte — os filtros do painel como um valor único.
 *
 *  Espelho do value object do backend (`app/dominio/recorte.py` do `back-reputacional`). Toda tela lê o
 *  mesmo Recorte e toda chamada de API o serializa da mesma forma, então o
 *  número do KPI e o da tabela vêm sempre do mesmo conjunto de registros.
 *
 *  É imutável: as telas produzem um Recorte novo em vez de mutar o corrente.
 */

import type { Frente, GrupoDeStatus } from '@/dominio/tipos';

export const ATALHOS_DE_PERIODO = {
  'ano-corrente': 'Ano corrente',
  'ultimos-30': 'Últimos 30 dias',
  'ultimos-90': 'Últimos 90 dias',
  'ultimos-180': 'Últimos 180 dias',
} as const;

export type AtalhoDePeriodo = keyof typeof ATALHOS_DE_PERIODO;

export interface Recorte {
  periodo?: AtalhoDePeriodo;
  de?: string;
  ate?: string;
  frente?: Frente;
  unidade?: string;
  uf?: string;
  esfera?: string;
  tier?: number;
  clima?: string;
  resultado?: string;
  status?: string;
  grupo?: GrupoDeStatus;
  entidade?: string;
  subtipo?: string;
  portaVoz?: string;
  pessoa?: string;
  tags?: string[];
  q?: string;
}

export const RECORTE_VAZIO: Recorte = {};

/** Campos que contam como "um filtro" no contador do botão Filtros. */
const CAMPOS_CONTAVEIS: (keyof Recorte)[] = [
  'frente', 'unidade', 'uf', 'esfera', 'tier', 'clima', 'resultado',
  'status', 'grupo', 'entidade', 'subtipo', 'portaVoz', 'pessoa', 'q',
];

export function quantidadeDeFiltros(recorte: Recorte): number {
  let ativos = CAMPOS_CONTAVEIS.filter((campo) => recorte[campo] != null).length;
  if (recorte.periodo || recorte.de || recorte.ate) ativos += 1;
  if (recorte.tags?.length) ativos += 1;
  return ativos;
}

export function estaVazio(recorte: Recorte): boolean {
  return quantidadeDeFiltros(recorte) === 0;
}

/** Liga ou desliga um filtro. Clicar de novo no mesmo item remove o filtro —
 *  é o comportamento de toda barra, chip, bolha do mapa e item de ranking. */
export function alternar<C extends keyof Recorte>(
  recorte: Recorte,
  campo: C,
  valor: Recorte[C],
): Recorte {
  const igual = recorte[campo] === valor;
  const proximo = { ...recorte };
  if (igual) delete proximo[campo];
  else proximo[campo] = valor;
  return proximo;
}

/** Tags são multisseleção com OR entre elas. */
export function alternarTag(recorte: Recorte, tag: string): Recorte {
  const atuais = new Set(recorte.tags ?? []);
  if (atuais.has(tag)) atuais.delete(tag);
  else atuais.add(tag);
  const tags = [...atuais].sort();
  const proximo = { ...recorte };
  if (tags.length) proximo.tags = tags;
  else delete proximo.tags;
  return proximo;
}

export function limpar(): Recorte {
  return { ...RECORTE_VAZIO };
}

/** Serializa para query string — a mesma que o backend sabe ler. */
export function paraParametros(recorte: Recorte): URLSearchParams {
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries(recorte)) {
    if (valor == null || valor === '') continue;
    if (Array.isArray(valor)) {
      if (valor.length) parametros.set(chave, valor.join(','));
    } else {
      parametros.set(chave, String(valor));
    }
  }
  return parametros;
}

/** Resolve o atalho de período em datas, para as derivações do cliente. */
export function intervalo(recorte: Recorte, hoje = new Date()): { de?: Date; ate?: Date } {
  if (recorte.de || recorte.ate) {
    return {
      de: recorte.de ? new Date(`${recorte.de}T00:00:00`) : undefined,
      ate: recorte.ate ? new Date(`${recorte.ate}T00:00:00`) : undefined,
    };
  }
  if (!recorte.periodo) return {};

  const dias = { 'ultimos-30': 30, 'ultimos-90': 90, 'ultimos-180': 180 } as const;
  if (recorte.periodo === 'ano-corrente') {
    return { de: new Date(hoje.getFullYear(), 0, 1), ate: hoje };
  }
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - dias[recorte.periodo]);
  return { de: inicio, ate: hoje };
}
