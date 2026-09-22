/** O recorte agrupado por um eixo, com as mesmas medidas em cada grupo.
 *
 *  UMA CONTAGEM SÓ, E O EIXO É PARÂMETRO. Volume, Tier 1, em aberto, tenso e
 *  taxa de avanço respondem, juntas, "quanto", "quão importante", "quanto
 *  ficou pelo caminho" e "deu em quê". Quem consome é a leitura em palavras
 *  da Situação (`dominio/leitura.ts`), por frente e por porta-voz — os eixos
 *  que sobraram quando a tela Explorar saiu (22/09/2026).
 *
 *  Função pura: nada aqui busca dado nem monta tela.
 */

import type { Interacao } from '@/dominio/tipos';
import type { Catalogo } from '@/dominio/derivacoes';
import { nomeDaPessoa } from '@/dominio/derivacoes';
import { CORES_DE_FRENTE, ROTULOS_DE_FRENTE } from '@/dominio/frentes';

/** Por qual eixo agrupar. */
export type Eixo = 'frente' | 'porta-voz';

export interface Grupo {
  chave: string;
  rotulo: string;
  cor?: string;
  /** Quantas agendas caem neste grupo. */
  total: number;
  tier1: number;
  emAberto: number;
  tenso: number;
  /** Numerador e denominador da taxa de avanço, separados: sem o denominador
   *  à vista, 100% de um caso só se lê como sucesso absoluto. */
  avancou: number;
  comDesfecho: number;
}

/** Os grupos de um eixo, do maior para o menor.
 *
 *  PORTA-VOZ É LISTA: uma agenda com dois porta-vozes conta nos dois grupos,
 *  e a soma dos grupos passa do total do recorte. Isso é correto — a pergunta
 *  é "quanto cada um apareceu".
 */
export function agrupar(
  interacoes: Interacao[],
  eixo: Eixo,
  catalogo: Catalogo,
): Grupo[] {
  const grupos = new Map<string, Grupo>();

  const acumular = (chave: string, rotulo: string, cor: string | undefined, i: Interacao) => {
    const atual =
      grupos.get(chave) ??
      { chave, rotulo, cor, total: 0, tier1: 0, emAberto: 0, tenso: 0, avancou: 0, comDesfecho: 0 };

    atual.total += 1;
    if (i.tier === 1) atual.tier1 += 1;
    // EM ABERTO É O QUE NÃO ACONTECEU E NÃO FOI NEGADO — e não o grupo
    // `aberto` do status: "aceito" também é `aberto`, e contar por ali
    // incluiria toda agenda que já houve.
    if (!jaAconteceu(i) && i.status !== 'declinado') atual.emAberto += 1;
    if (i.clima === 'tenso') atual.tenso += 1;
    if (i.resultado && i.resultado !== 'sem_definicao') {
      atual.comDesfecho += 1;
      if (i.resultado === 'avancou') atual.avancou += 1;
    }

    grupos.set(chave, atual);
  };

  for (const i of interacoes) {
    for (const { chave, rotulo, cor } of chavesDe(i, eixo, catalogo)) {
      acumular(chave, rotulo, cor, i);
    }
  }

  return [...grupos.values()].sort(
    (a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo),
  );
}

/** Em quais grupos esta agenda entra, neste eixo. */
function chavesDe(
  i: Interacao,
  eixo: Eixo,
  catalogo: Catalogo,
): { chave: string; rotulo: string; cor?: string }[] {
  switch (eixo) {
    case 'frente':
      return [
        {
          chave: i.frente,
          rotulo: ROTULOS_DE_FRENTE[i.frente],
          cor: CORES_DE_FRENTE[i.frente],
        },
      ];

    case 'porta-voz': {
      const vozes = (i.participacoes ?? []).filter((p) => p.papel === 'porta_voz');
      if (!vozes.length) return [{ chave: 'sem-porta-voz', rotulo: 'Sem porta-voz definido' }];
      return vozes.map((p) => ({
        chave: p.pessoa_aegea_id,
        rotulo: nomeDaPessoa(catalogo, p.pessoa_aegea_id),
      }));
    }
  }
}

/** A agenda já aconteceu?
 *
 *  VEM DO RELATO, e não da situação. As três situações — Solicitado, Aceito,
 *  Negado — respondem ao PEDIDO, e nenhuma delas diz se a reunião houve:
 *  "aceito" é a resposta, não o fato.
 *
 *  O relato é o marcador certo porque não depende de alguém lembrar de mudar
 *  um campo depois da reunião: ele aparece quando a pessoa escreve o que
 *  aconteceu, que é o gesto que ela já faz. Só se escreve o relato de uma
 *  reunião que houve.
 *
 *  EXIGE AS DUAS COISAS: relato escrito E situação `Aceito`. A negada fica de
 *  fora mesmo tendo relato — o texto ali conta a recusa, e recusa não é
 *  reunião. A solicitada também: um pedido sem resposta não produziu reunião,
 *  e se tem relato é inconsistência do registro, não um fato a propagar.
 */
export function jaAconteceu(interacao: Interacao): boolean {
  return interacao.status === 'confirmada' && Boolean((interacao.relato ?? '').trim());
}

/* ----------------------------------------------------- as medidas do topo */

export interface Panorama {
  total: number;
  tier1: number;
  emAberto: number;
  tenso: number;
  avancou: number;
  comDesfecho: number;
}

/** As quatro medidas do recorte inteiro, para a faixa de cima. */
export function panorama(interacoes: Interacao[], catalogo: Catalogo): Panorama {
  const um = agrupar(interacoes, 'frente', catalogo);
  return um.reduce<Panorama>(
    (soma, g) => ({
      total: soma.total + g.total,
      tier1: soma.tier1 + g.tier1,
      emAberto: soma.emAberto + g.emAberto,
      tenso: soma.tenso + g.tenso,
      avancou: soma.avancou + g.avancou,
      comDesfecho: soma.comDesfecho + g.comDesfecho,
    }),
    { total: 0, tier1: 0, emAberto: 0, tenso: 0, avancou: 0, comDesfecho: 0 },
  );
}
