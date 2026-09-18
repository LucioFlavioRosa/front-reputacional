/** O Recorte — os filtros do painel como um valor único.
 *
 *  Espelho do value object do backend (`app/dominio/recorte.py` do `back-reputacional`). Toda tela lê o
 *  mesmo Recorte e toda chamada de API o serializa da mesma forma, então o
 *  número do KPI e o da tabela vêm sempre do mesmo conjunto de registros.
 *
 *  É imutável: as telas produzem um Recorte novo em vez de mutar o corrente.
 */

import { paraIso } from '@/dominio/formato';
import type { Frente, GrupoDeStatus } from '@/dominio/tipos';

//: PASSADO E FUTURO NA MESMA ESCALA, de propósito: 30/60/90/180/360 dias dos
//: dois lados do calendário. "Ano corrente" saiu daqui — não tinha um espelho
//: para a frente, e a barra de filtros passou a tratar as duas direções de
//: forma simétrica. Espelha `AtalhoDePeriodo` do backend (`app/dominio/periodo.py`).
export const ATALHOS_DE_PERIODO = {
  'ultimos-360': 'Últimos 360 dias',
  'ultimos-180': 'Últimos 180 dias',
  'ultimos-90': 'Últimos 90 dias',
  'ultimos-60': 'Últimos 60 dias',
  'ultimos-30': 'Últimos 30 dias',
  'proximos-360': 'Próximos 360 dias',
  'proximos-180': 'Próximos 180 dias',
  'proximos-90': 'Próximos 90 dias',
  'proximos-60': 'Próximos 60 dias',
  'proximos-30': 'Próximos 30 dias',
} as const;

export type AtalhoDePeriodo = keyof typeof ATALHOS_DE_PERIODO;

//: Os mesmos atalhos de sempre, particionados por tipo — sem duplicar
//: `ATALHOS_DE_PERIODO` (que continua sendo a única fonte de rótulos).
//: `PainelDeFiltros` usa a mesma partição em tempo de execução, pelo prefixo
//: `proximos-`.
export type AtalhoDoFuturo = Extract<AtalhoDePeriodo, `proximos-${string}`>;
export type AtalhoDoPassado = Exclude<AtalhoDePeriodo, AtalhoDoFuturo>;

export interface Recorte {
  periodoPassado?: AtalhoDoPassado;
  periodoFuturo?: AtalhoDoFuturo;
  //: `de` pertence só ao lado PASSADO agora (data customizada de início);
  //: `ate`, só ao lado FUTURO (data customizada de fim). Antes da divisão
  //: Passado/Futuro os dois eram um par escrito junto; agora cada um é
  //: escrito por um lado só, e os dois podem conviver — é o que permite
  //: combinar "últimos 30 dias" com "próximos 60 dias" num intervalo só.
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
  /** Áreas internas da Aegea envolvidas — ids de `catalogo.dicionarios.areas_pessoa`.
   *  Multisseleção com OR entre elas, mesmo comportamento de `tags`. */
  areas?: number[];
  /** Categorias da taxonomia de públicos — ids de
   *  `catalogo.dicionarios.categorias_publico`. Multisseleção com OR entre
   *  elas, mesmo comportamento de `tags`/`areas`.
   *
   *  SÓ NO CLIENTE — nunca viaja para o backend (ver o `continue` dedicado
   *  em `paraParametros`): `categoria_publico_id` mora na Instituição, não
   *  na Interação, e a API de interações não tem esse filtro. O front junta
   *  pelo catálogo (`catalogo.instituicoes`) — ver `filtrarPorCategoriaPublico`
   *  em `dominio/derivacoes.ts`. */
  categoriaPublico?: number[];
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
  if (recorte.periodoPassado || recorte.periodoFuturo || recorte.de || recorte.ate) ativos += 1;
  if (recorte.tags?.length) ativos += 1;
  if (recorte.areas?.length) ativos += 1;
  if (recorte.categoriaPublico?.length) ativos += 1;
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

/** Só o campo Frente, sem afastar o resto do recorte — o "Limpar" ao lado
 *  das pílulas de tipo de interação é local a elas, mesma ideia de
 *  `limparAreas`. */
export function limparFrente(recorte: Recorte): Recorte {
  const proximo = { ...recorte };
  delete proximo.frente;
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

/** Uma CATEGORIA de área (uma ou mais áreas somadas — ver `CATEGORIAS_DE_AREA`
 *  em `dominio/derivacoes.ts`) liga/desliga como um grupo só: se todas as
 *  áreas do grupo já estão selecionadas, o clique desliga todas; senão, liga
 *  as que faltam. Um grupo de um id só cobre o caso de alternar uma única
 *  área. Áreas são multisseleção com OR entre elas — mesma regra de
 *  `alternarTag`. */
export function alternarCategoriaDeArea(recorte: Recorte, ids: Iterable<number>): Recorte {
  const grupo = [...ids];
  const atuais = new Set(recorte.areas ?? []);
  const todasLigadas = grupo.length > 0 && grupo.every((id) => atuais.has(id));
  for (const id of grupo) {
    if (todasLigadas) atuais.delete(id);
    else atuais.add(id);
  }
  const areas = [...atuais].sort((a, b) => a - b);
  const proximo = { ...recorte };
  if (areas.length) proximo.areas = areas;
  else delete proximo.areas;
  return proximo;
}

/** Só o campo Área(s), sem afastar o resto do recorte — o "Limpar" ao lado
 *  das pílulas de área é local a elas, não o reset geral da barra. */
export function limparAreas(recorte: Recorte): Recorte {
  const proximo = { ...recorte };
  delete proximo.areas;
  return proximo;
}

/** Uma categoria de público liga/desliga sozinha — multisseleção com OR
 *  entre elas, mesma regra de `alternarTag`. */
export function alternarCategoriaPublico(recorte: Recorte, id: number): Recorte {
  const atuais = new Set(recorte.categoriaPublico ?? []);
  if (atuais.has(id)) atuais.delete(id);
  else atuais.add(id);
  const categoriaPublico = [...atuais].sort((a, b) => a - b);
  const proximo = { ...recorte };
  if (categoriaPublico.length) proximo.categoriaPublico = categoriaPublico;
  else delete proximo.categoriaPublico;
  return proximo;
}

/** Só o campo Categoria de público, sem afastar o resto do recorte — mesma
 *  ideia de `limparAreas`. */
export function limparCategoriaPublico(recorte: Recorte): Recorte {
  const proximo = { ...recorte };
  delete proximo.categoriaPublico;
  return proximo;
}

export function limpar(): Recorte {
  return { ...RECORTE_VAZIO };
}

//: São 4 campos, mas o backend só entende `de`/`ate` — ver `intervalo()` e o
//: comentário dentro de `paraParametros`.
const CAMPOS_DE_PERIODO = new Set(['periodoPassado', 'periodoFuturo', 'de', 'ate']);

/** Serializa para query string — a mesma que o backend sabe ler. */
export function paraParametros(recorte: Recorte): URLSearchParams {
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries(recorte)) {
    if (CAMPOS_DE_PERIODO.has(chave)) continue; // tratamento próprio, abaixo
    // `categoriaPublico` é só do cliente — o backend não tem esse filtro,
    // e não junta Interação com Instituição para aplicá-lo. Ver o comentário
    // no campo, em `Recorte`.
    if (chave === 'categoriaPublico') continue;
    if (valor == null || valor === '') continue;
    if (Array.isArray(valor)) {
      if (valor.length) parametros.set(chave, valor.join(','));
    } else {
      parametros.set(chave, String(valor));
    }
  }

  // O BACKEND SÓ CONHECE OS ATALHOS DE PASSADO (`app/dominio/periodo.py`
  // do back-reputacional-novo) — nenhum `proximos-*`. Mandar um preset de
  // futuro cru (`periodo=proximos-30`) devolve 422. Resolver os dois lados
  // aqui, sempre, é o que evita isso E o que permite combinar passado com
  // futuro num intervalo só: o backend só vê `de`/`ate`, nunca precisa saber
  // que vieram de dois presets diferentes.
  const { de, ate } = intervalo(recorte);
  if (de) parametros.set('de', paraIso(de));
  if (ate) parametros.set('ate', paraIso(ate));

  return parametros;
}

//: DIAS SIMÉTRICOS dos dois lados — 30/60/90/180/360, a mesma escala de
//: `ATALHOS_DE_PERIODO`. "Ano corrente" saiu (ver o comentário lá em cima):
//: não tinha espelho no futuro.
const DIAS_NO_PASSADO = {
  'ultimos-30': 30,
  'ultimos-60': 60,
  'ultimos-90': 90,
  'ultimos-180': 180,
  'ultimos-360': 360,
} as const;

const DIAS_NO_FUTURO = {
  'proximos-30': 30,
  'proximos-60': 60,
  'proximos-90': 90,
  'proximos-180': 180,
  'proximos-360': 360,
} as const;

function inicioDoPassado(atalho: AtalhoDoPassado, hoje: Date): Date {
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - DIAS_NO_PASSADO[atalho]);
  return inicio;
}

function fimDoFuturo(atalho: AtalhoDoFuturo, hoje: Date): Date {
  const fim = new Date(hoje);
  fim.setDate(fim.getDate() + DIAS_NO_FUTURO[atalho]);
  return fim;
}

/** Resolve os dois lados do período (Passado/Futuro) — preset ou data
 *  customizada, em cada lado — num único `{ de, ate }`.
 *
 *  QUATRO CASOS: só passado ativo (`ate` vira hoje, igual sempre foi); só
 *  futuro ativo (`de` vira hoje, igual sempre foi); os dois ativos (as duas
 *  pontas resolvidas juntas, o intervalo assimétrico); nenhum ativo (`{}`,
 *  sem filtro de data). O primeiro e o segundo caso são exatamente o
 *  comportamento de antes da divisão Passado/Futuro — só o terceiro é novo. */
export function intervalo(recorte: Recorte, hoje = new Date()): { de?: Date; ate?: Date } {
  const de = recorte.de
    ? new Date(`${recorte.de}T00:00:00`)
    : recorte.periodoPassado
      ? inicioDoPassado(recorte.periodoPassado, hoje)
      : undefined;

  const ate = recorte.ate
    ? new Date(`${recorte.ate}T00:00:00`)
    : recorte.periodoFuturo
      ? fimDoFuturo(recorte.periodoFuturo, hoje)
      : undefined;

  if (de && !ate) return { de, ate: hoje };
  if (ate && !de) return { de: hoje, ate };
  return { de, ate };
}
