/** O que escapou do padrão, e por que isso importa.
 *
 *  O QUE ISTO RESPONDE
 *  -------------------
 *  "O que precisa de mim" — a pergunta de quem abre o sistema todo dia, e que
 *  a contagem de volume não responde. Cada regra aqui é um cruzamento que a
 *  base permite fazer: agenda sem material, porta-voz fora do escopo do
 *  assunto, desdobramento previsto e não cobrado.
 *
 *  DOIS GRUPOS, E NÃO UMA FILA SÓ. Numa fila única, mais da metade da base
 *  aparece sinalizada — e uma fila que aponta metade de tudo não é fila, é
 *  lista: o que precisa de decisão hoje se perde no meio do que é registro por
 *  preencher. São problemas de natureza diferente, com urgência diferente, e
 *  por isso se leem separados.
 *
 *  NEM TODA EXCEÇÃO É UM ERRO. Uma agenda sem material pode ser uma conversa
 *  de corredor; um porta-voz fora do escopo pode ser uma decisão. A tela diz o
 *  que fugiu do padrão e quem lê decide — por isso o texto de cada regra
 *  explica a leitura, e não acusa.
 *
 *  Funções puras: nada aqui busca dado nem monta tela.
 */

import type { Catalogo } from '@/dominio/derivacoes';
import type { Interacao } from '@/dominio/tipos';
import { jaAconteceu } from '@/dominio/agregacao';

/** DECISÃO pede que alguém escolha o que fazer; REGISTRO pede que alguém
 *  complete o que ficou pela metade. Misturar os dois faz o urgente sumir. */
export type NaturezaDaExcecao = 'decisao' | 'registro';

export interface Excecao {
  chave: string;
  natureza: NaturezaDaExcecao;
  titulo: string;
  /** O que fazer com isto, ou por que olhar. Uma frase. */
  porque: string;
  /** As agendas que caem na regra, da mais antiga para a mais nova. */
  agendas: Interacao[];
  /** Nomes, quando a exceção é sobre AUSÊNCIA e não sobre registros. */
  itens?: string[];
  /** Quanto pesa: usado só para ordenar a fila. */
  peso: number;
}

/** Há quantos dias uma agenda pode ficar em aberto antes de virar exceção.
 *
 *  Trinta porque é o ciclo de fechamento mensal: o que atravessa um mês
 *  inteiro sem sair do lugar já não é "em andamento", é parado.
 */
export const DIAS_PARA_PARADA = 30;

export function excecoes(
  interacoes: Interacao[],
  catalogo: Catalogo,
  hoje: Date = new Date(),
): Excecao[] {
  const vivas = interacoes.filter((i) => i.visivel !== false);
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() - DIAS_PARA_PARADA);
  const corte = limite.toISOString().slice(0, 10);

  // SOLICITADA E SEM RELATO. "Solicitada" sozinha não basta: uma agenda cujo
  // relato conta a reunião seria cobrada como "sem resposta há 30 dias", com o
  // texto do encontro logo ao lado. Ela tem problema, mas é outro — e está
  // logo abaixo, em `situacaoDesatualizada`.
  const semResposta = vivas.filter(
    (i) => i.status === 'solicitado' && !(i.relato ?? '').trim(),
  );
  // A REUNIÃO ACONTECEU E A SITUAÇÃO NÃO ACOMPANHOU. Alguém escreveu o relato
  // e não voltou ao topo do formulário para trocar Solicitado por Aceito.
  // É o caso que o relato como marcador de "aconteceu" torna visível: o
  // registro se contradiz, e quem o corrige são dois cliques.
  const situacaoDesatualizada = vivas.filter(
    (i) => i.status === 'solicitado' && Boolean((i.relato ?? '').trim()),
  );
  const aconteceram = vivas.filter(jaAconteceu);
  // Aceita, a data passou e ninguém escreveu o que houve: o registro não diz
  // se a reunião aconteceu.
  const aceitasSemRelato = vivas.filter(
    (i) =>
      i.status === 'confirmada' &&
      !jaAconteceu(i) &&
      i.data_interacao <= hoje.toISOString().slice(0, 10),
  );

  const encontradas: Excecao[] = [
    {
      chave: 'paradas',
      natureza: 'decisao',
      titulo: `Solicitadas há mais de ${DIAS_PARA_PARADA} dias`,
      porque:
        'O pedido entrou e não foi aceito nem negado. Atravessou o ciclo de ' +
        'fechamento sem resposta.',
      agendas: semResposta.filter((i) => i.data_interacao < corte),
      peso: 5,
    },
    {
      chave: 'sem-encaminhamento',
      natureza: 'registro',
      titulo: 'Realizadas sem encaminhamento registrado',
      porque:
        'É o campo que diz o que ficou combinado — e é dele que sai a agenda ' +
        'seguinte. Sem ele, a reunião acaba e a conversa some.',
      agendas: aconteceram.filter((i) => !(i.encaminhamentos ?? '').trim()),
      peso: 4,
    },
    {
      chave: 'tier1-sem-material',
      natureza: 'registro',
      titulo: 'Relevância Tier 1 sem nenhum material',
      porque:
        'As agendas de maior relevância são as que alguém vai querer reler. ' +
        'Sem documento de apoio nem registro, sobra só a memória de quem foi.',
      agendas: vivas.filter((i) => i.tier === 1 && !(i.materiais ?? []).length),
      peso: 3,
    },
    {
      chave: 'desdobramento-nao-cobrado',
      natureza: 'decisao',
      titulo: 'Previram desdobramento e não geraram agenda',
      porque:
        'Alguém marcou, no fechamento, que aquela reunião pedia outra. ' +
        'A outra não existe — nem marcada, nem solicitada.',
      agendas: vivas.filter((i) => i.preve_desdobramento === true && !i.derivadas),
      peso: 5,
    },
    {
      chave: 'situacao-desatualizada',
      natureza: 'registro',
      titulo: 'Solicitadas, mas com relato escrito',
      porque:
        'O relato conta uma reunião que aconteceu e a situação continua ' +
        'Solicitado. Enquanto estiver assim, a agenda não entra nas cadeias.',
      agendas: situacaoDesatualizada,
      peso: 4,
    },
    {
      chave: 'aceitas-sem-relato',
      natureza: 'registro',
      titulo: 'Aceitas, a data passou e ninguém escreveu o relato',
      porque:
        'O registro não diz se a reunião aconteceu. É pelo relato que a ' +
        'agenda entra nas cadeias e no histórico.',
      agendas: aceitasSemRelato,
      peso: 4,
    },
    {
      chave: 'fora-do-escopo',
      natureza: 'decisao',
      titulo: 'Conduzidas por quem não responde pelo tema',
      porque:
        'O porta-voz da agenda não tem, no cadastro, nenhum dos temas ' +
        'tratados. Pode ser decisão consciente — mas precisa ser vista.',
      agendas: vivas.filter((i) => foraDoEscopo(i, catalogo)),
      peso: 4,
    },
    {
      chave: 'tier1-sem-porta-voz',
      natureza: 'registro',
      titulo: 'Relevância Tier 1 sem porta-voz definido',
      porque:
        'A agenda mais importante do recorte não tem quem responda por ela ' +
        'no registro.',
      agendas: vivas.filter(
        (i) =>
          i.tier === 1 &&
          !(i.participacoes ?? []).some((p) => p.papel === 'porta_voz'),
      ),
      peso: 3,
    },
    {
      chave: 'assunto-sem-agenda',
      natureza: 'decisao',
      titulo: 'Temas estratégicos sem nenhuma agenda',
      porque:
        'Estão no cadastro como pauta da companhia e não apareceram em ' +
        'conversa nenhuma neste recorte.',
      agendas: [],
      itens: assuntosSemAgenda(vivas, catalogo),
      peso: 2,
    },
  ];

  return encontradas
    .filter((e) => e.agendas.length > 0 || (e.itens?.length ?? 0) > 0)
    .map((e) => ({
      ...e,
      // Da mais ANTIGA para a mais nova: o que está parado há mais tempo é o
      // que mais precisa de decisão.
      agendas: [...e.agendas].sort((a, b) =>
        a.data_interacao.localeCompare(b.data_interacao),
      ),
    }))
    .sort((a, b) => b.peso - a.peso || tamanho(b) - tamanho(a));
}

function tamanho(e: Excecao): number {
  return e.agendas.length + (e.itens?.length ?? 0);
}

/** O porta-voz da agenda responde por algum dos assuntos tratados?
 *
 *  Só vale a pergunta quando há OS DOIS lados: agenda com assunto e porta-voz
 *  com assunto cadastrado. Sem isso a regra acusaria falta de cadastro, e não
 *  desvio de escopo — que é outro problema, e tem outra linha nesta fila.
 */
export function foraDoEscopo(i: Interacao, catalogo: Catalogo): boolean {
  const assuntos = i.temas ?? [];
  if (!assuntos.length) return false;

  const vozes = (i.participacoes ?? []).filter((p) => p.papel === 'porta_voz');
  if (!vozes.length) return false;

  const responde = vozes.some((p) => {
    const pessoa = catalogo.pessoas.get(p.pessoa_aegea_id);
    const dela = pessoa?.temas ?? [];
    if (!dela.length) return true; // sem cadastro, não se acusa
    return dela.some((tema) => assuntos.includes(tema));
  });

  return !responde;
}

/** Assuntos cadastrados que não apareceram em agenda nenhuma do recorte. */
function assuntosSemAgenda(interacoes: Interacao[], catalogo: Catalogo): string[] {
  const tratados = new Set<number>();
  for (const i of interacoes) for (const t of i.temas ?? []) tratados.add(t);

  return catalogo.dicionarios.temas
    .filter((t) => !tratados.has(t.id))
    .map((t) => t.nome)
    .sort((a, b) => a.localeCompare(b));
}

/** Quantas agendas a fila inteira aponta, sem contar a mesma duas vezes.
 *
 *  A soma das linhas passa disto: uma agenda Tier 1 sem material e sem
 *  porta-voz aparece em duas. O número honesto de "quantas precisam de você" é
 *  o de agendas DISTINTAS.
 */
export function agendasApontadas(lista: Excecao[]): number {
  const ids = new Set<string>();
  for (const e of lista) for (const a of e.agendas) ids.add(a.id);
  return ids.size;
}
