/** O recorte agrupado por qualquer eixo.
 *
 *  POR QUE ISTO EXISTE
 *  -------------------
 *  Havia cinco telas — Frentes, Status, Resultado, Porta-vozes, Interlocutores
 *  — lendo o MESMO recorte e girando-o num eixo diferente. Cada uma repetia a
 *  contagem à mão, e nenhuma respondia nada de ponta a ponta: para saber se a
 *  agenda de imprensa Tier 1 de agosto acabou bem, era preciso passar por três.
 *
 *  Aqui a contagem é uma só e o eixo é parâmetro. As cinco telas viram um
 *  seletor.
 *
 *  AS MESMAS QUATRO MEDIDAS EM TODO EIXO. Volume, Tier 1, em aberto e taxa de
 *  avanço respondem, juntas, "quanto", "quão importante", "quanto ficou pelo
 *  caminho" e "deu em quê" — que é o conjunto que cada uma das cinco telas
 *  mostrava de um jeito diferente.
 *
 *  Função pura: nada aqui busca dado nem monta tela.
 */

import type { Eixo } from '@/navegacao/rota';
import type { Interacao } from '@/dominio/tipos';
import type { Catalogo } from '@/dominio/derivacoes';
import {
  nomeDaPessoa,
  nomeDoInterlocutor,
  nomesDosTemas,
  rotuloDeCodigo,
} from '@/dominio/derivacoes';
import { CORES_DE_FRENTE, ROTULOS_DE_FRENTE, rotuloDeAbrangencia } from '@/dominio/frentes';

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
 *  EIXOS DE MUITOS VALORES. Porta-voz e assunto são listas: uma agenda com dois
 *  porta-vozes conta nos dois grupos, e a soma dos grupos passa do total do
 *  recorte. Isso é correto — a pergunta é "quanto cada um apareceu" — e a tela
 *  precisa dizer, porque um leitor que soma a coluna e não bate desconfia do
 *  número certo.
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
    // EM ABERTO É O QUE NÃO ACONTECEU E NÃO FOI NEGADO. Antes era o grupo
    // `aberto` do status; com três situações, "aceito" também é `aberto`, e a
    // conta passaria a incluir toda agenda que já houve.
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

    case 'situacao':
      return [{ chave: i.status, rotulo: rotuloDeCodigo(catalogo, 'status', i.status) }];

    case 'desfecho':
      return [
        i.resultado
          ? {
              chave: i.resultado,
              rotulo: rotuloDeCodigo(catalogo, 'resultados', i.resultado),
              cor: corDoResultado(i.resultado),
            }
          : // NÃO INFORMADO É UM GRUPO, e não uma linha ausente: agenda sem
            // desfecho registrado é o achado, e escondê-la faria a taxa de
            // avanço parecer melhor do que é.
            { chave: 'sem_definicao', rotulo: 'Sem desfecho informado' },
      ];

    case 'porta-voz': {
      const vozes = (i.participacoes ?? []).filter((p) => p.papel === 'porta_voz');
      if (!vozes.length) return [{ chave: 'sem-porta-voz', rotulo: 'Sem porta-voz definido' }];
      return vozes.map((p) => ({
        chave: p.pessoa_aegea_id,
        rotulo: nomeDaPessoa(catalogo, p.pessoa_aegea_id),
      }));
    }

    case 'interlocutor': {
      const principal =
        (i.outra_parte ?? []).find((p) => p.principal)?.interlocutor_id ??
        i.interlocutor_id;
      if (!principal) return [{ chave: 'sem-interlocutor', rotulo: 'Sem interlocutor informado' }];
      return [{ chave: principal, rotulo: nomeDoInterlocutor(catalogo, principal) }];
    }

    case 'assunto': {
      const temas = i.temas ?? [];
      if (!temas.length) return [{ chave: 'sem-assunto', rotulo: 'Sem assunto classificado' }];
      return temas.map((tema) => ({
        chave: String(tema),
        rotulo: nomesDosTemas(catalogo, [tema])[0] ?? `Assunto ${tema}`,
      }));
    }

    case 'uf':
      return [{ chave: i.uf, rotulo: rotuloDeAbrangencia(i.uf) }];
  }
}

/** Eixos em que uma agenda pode entrar em mais de um grupo. */
export const EIXOS_DE_MUITOS_VALORES: ReadonlySet<Eixo> = new Set<Eixo>([
  'porta-voz',
  'assunto',
]);

function corDoResultado(codigo: string): string | undefined {
  return {
    avancou: 'var(--res-avancou)',
    mantido: 'var(--res-mantido)',
    recuou: 'var(--res-recuou)',
    sem_definicao: 'var(--res-sem-definicao)',
  }[codigo];
}

/** A agenda já aconteceu?
 *
 *  VEM DO RELATO, e não do status. A situação passou a ter três valores —
 *  Solicitado, Aceito, Negado — e nenhum deles diz se a reunião houve: "aceito"
 *  é a resposta ao pedido, não o fato.
 *
 *  MEDIDO na base ao fazer a troca: as 208 agendas que estavam como atendida,
 *  realizada ou elaborada tinham relato, todas as 208; e nenhuma solicitada ou
 *  aceita tinha. Não é coincidência — só se escreve o relato de uma reunião que
 *  houve.
 *
 *  É um marcador melhor do que o status era, porque não depende de alguém
 *  lembrar de mudar um campo depois da reunião: ele aparece quando a pessoa
 *  escreve o que aconteceu, que é o gesto que ela já faz.
 *
 *  EXIGE AS DUAS COISAS: relato escrito E situação `Aceito`. A negada fica de
 *  fora mesmo tendo relato — o texto ali conta a recusa, e recusa não é
 *  reunião. A solicitada também: um pedido sem resposta não produziu reunião,
 *  e se tem relato é inconsistência do registro, não um fato a propagar.
 *
 *  Medido: 9 registros da amostra de handoff estão exatamente assim.
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

/* ---------------------------------------------------------- a série no tempo */

export interface Mes {
  /** `2026-03` — ordenável como texto, que é o que a série precisa. */
  mes: string;
  total: number;
  tier1: number;
}

/** Quantos meses a série mostra, no máximo.
 *
 *  Quinze é um ano mais três, que é a comparação que se faz: o mês corrente
 *  contra o mesmo mês do ano passado, com folga.
 */
export const MESES_NA_SERIE = 15;

/** A partir de quantos meses vazios seguidos a série é considerada INTERROMPIDA.
 *
 *  Um ou dois meses sem agenda é o verão, o recesso, um mês fraco — e mostrar
 *  o buraco é a informação. Três ou mais seguidos não são um vale: são o
 *  intervalo entre duas fases distintas da operação, e desenhá-los gasta metade
 *  do gráfico com nada.
 */
const VAZIOS_QUE_INTERROMPEM = 3;

/** Volume por mês, sem buracos entre o primeiro e o último.
 *
 *  Mês sem agenda vira zero em vez de sumir: uma série que pula de março para
 *  maio desenha uma linha reta por cima de um mês vazio, e some justamente o
 *  fato que interessa.
 *
 *  MAS A SÉRIE NÃO SE ESTICA SEM FIM. Uma única agenda antiga — a raiz de 2025
 *  que a base de demonstração tem de propósito — puxava o início vinte meses
 *  para trás, e o gráfico saía com doze colunas vazias ocupando metade da
 *  largura. Preencher buraco é honesto; desenhar um ano inteiro de nada para
 *  acomodar um ponto isolado é desperdiçar a tela.
 */
export function porMes(interacoes: Interacao[]): Mes[] {
  const contagem = new Map<string, Mes>();
  for (const i of interacoes) {
    const mes = (i.data_interacao ?? '').slice(0, 7);
    if (mes.length !== 7) continue;
    const atual = contagem.get(mes) ?? { mes, total: 0, tier1: 0 };
    atual.total += 1;
    if (i.tier === 1) atual.tier1 += 1;
    contagem.set(mes, atual);
  }

  const meses = [...contagem.keys()].sort();
  if (!meses.length) return [];

  const cheia: Mes[] = [];
  let corrente = meses[0];
  const ultimo = meses[meses.length - 1];
  while (corrente <= ultimo) {
    cheia.push(contagem.get(corrente) ?? { mes: corrente, total: 0, tier1: 0 });
    corrente = proximoMes(corrente);
  }
  return cheia.slice(inicioDoTrechoCorrente(cheia)).slice(-MESES_NA_SERIE);
}

/** Onde começa o trecho mais recente da série.
 *
 *  MEDIDO: a base tem uma agenda de janeiro de 2025, de propósito, e todo o
 *  resto em 2026. A série ia de 01/25 a 09/26 com doze colunas vazias no meio
 *  — metade do gráfico gasta com nada, e o mês cheio espremido no canto.
 *
 *  Cortar por quantidade não resolvia: o buraco é no MEIO, e qualquer teto de
 *  meses ainda deixava parte dele. O que resolve é reconhecer que a série
 *  recomeçou depois do último intervalo longo.
 */
function inicioDoTrechoCorrente(meses: Mes[]): number {
  let vazios = 0;
  let inicio = 0;

  meses.forEach((mes, indice) => {
    if (mes.total === 0) {
      vazios += 1;
      return;
    }
    if (vazios >= VAZIOS_QUE_INTERROMPEM) inicio = indice;
    vazios = 0;
  });

  return inicio;
}

function proximoMes(mes: string): string {
  const [ano, m] = mes.split('-').map(Number);
  return m === 12
    ? `${ano + 1}-01`
    : `${ano}-${String(m + 1).padStart(2, '0')}`;
}
