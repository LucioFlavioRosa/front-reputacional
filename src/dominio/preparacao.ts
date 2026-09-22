/** As derivações da tela Preparar agenda — TypeScript puro, sem React.
 *
 *  Moram aqui, e não na página, pela regra de `dominio/`: é onde o teste
 *  rende. A página recebe listas prontas e só desenha; o que pode dar errado
 *  (uma fatia que soma errado, um documento sem arquivo que aparece, um
 *  porta-voz contado uma vez quando conduziu duas) se prova sem montar tela.
 */

import type { ColunaMensal, ItemContado, Segmento } from '@/dominio/derivacoes';
import type { Interacao, Material } from '@/dominio/tipos';

export const QUANTAS_NO_RANKING = 5;

/** Os rótulos das duas colunas de clima — exportados porque o clique numa
 *  faixa da coluna "Antes" filtra por `climaEsperado`, e na "Depois" por
 *  `clima`: a página decide pelo rótulo que o gráfico devolve. */
export const COLUNA_ANTES = 'Antes (esperado)';
export const COLUNA_DEPOIS = 'Depois (registrado)';

/** Um documento de reunião, já com a agenda de onde saiu. */
export interface DocumentoDaAgenda {
  chave: string;
  material: Material;
  agenda: Interacao;
}

/** OS MATERIAIS DAS AGENDAS DO RECORTE, mais recentes primeiro. Só os que
 *  têm arquivo ou link — um material sem os dois não tem o que abrir. A
 *  chave alterna para `agenda:índice` quando o material ainda não tem id. */
export function documentosDasAgendas(agendas: Interacao[]): DocumentoDaAgenda[] {
  return [...agendas]
    .sort((a, b) => b.data_interacao.localeCompare(a.data_interacao))
    .flatMap((agenda) =>
      agenda.materiais
        .filter((material) => material.arquivo || material.url)
        .map((material, indice) => ({
          chave: material.id ?? `${agenda.id}:${indice}`,
          material,
          agenda,
        })),
    );
}

/** Quantas agendas em cada valor de um dicionário — SEMPRE um segmento por
 *  valor, mesmo com zero: a rosca não muda de forma de um tema para outro, e
 *  "esperado × registrado" precisa das mesmas fatias dos dois lados. A cor é
 *  a do dicionário. */
export function contagemPorDicionario(
  agendas: Interacao[],
  itens: { codigo: string; nome: string; cor_hex: string }[],
  campo: (agenda: Interacao) => string | null,
): Segmento[] {
  const contagem = new Map<string, number>();
  for (const agenda of agendas) {
    const codigo = campo(agenda);
    if (codigo) contagem.set(codigo, (contagem.get(codigo) ?? 0) + 1);
  }
  return itens.map((item) => ({
    chave: item.codigo,
    rotulo: item.nome,
    total: contagem.get(item.codigo) ?? 0,
    cor: item.cor_hex,
  }));
}

/** DUAS COLUNAS, "Antes" e "Depois": o clima esperado ao marcar a reunião e
 *  o registrado depois dela. `BarrasEmpilhadas` lê `ColunaMensal` — a chave
 *  `mes` é só o rótulo da coluna. Devolve também os dois lados soltos, para
 *  a legenda de cada um. */
export function climaAntesEDepois(
  agendas: Interacao[],
  climas: { codigo: string; nome: string; cor_hex: string }[],
): { colunas: ColunaMensal[]; esperado: Segmento[]; registrado: Segmento[] } {
  const esperado = contagemPorDicionario(agendas, climas, (a) => a.clima_esperado);
  const registrado = contagemPorDicionario(agendas, climas, (a) => a.clima);
  const soma = (segmentos: Segmento[]) => segmentos.reduce((s, i) => s + i.total, 0);
  return {
    colunas: [
      { mes: COLUNA_ANTES, total: soma(esperado), segmentos: esperado },
      { mes: COLUNA_DEPOIS, total: soma(registrado), segmentos: registrado },
    ],
    esperado,
    registrado,
  };
}

/** Os mais frequentes, por id, com o nome resolvido por quem chama. Ids
 *  nulos não contam. UMA CONTAGEM POR OCORRÊNCIA na lista de entrada: quem
 *  quer "uma por participação" passa a lista já achatada. */
export function rankingPorId(
  ids: (string | null)[],
  nome: (id: string) => string,
  quantos = QUANTAS_NO_RANKING,
): ItemContado[] {
  const contagem = new Map<string, number>();
  for (const id of ids) {
    if (id) contagem.set(id, (contagem.get(id) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, quantos)
    .map(([id, total]) => ({ chave: id, rotulo: nome(id), total }));
}

/** Os porta-vozes de cada agenda, achatados — a agenda com dois conta para
 *  os dois, a mesma regra do painel de exposição. */
export function portaVozesDe(agendas: Interacao[]): string[] {
  return agendas.flatMap((a) =>
    a.participacoes.filter((p) => p.papel === 'porta_voz').map((p) => p.pessoa_aegea_id),
  );
}
