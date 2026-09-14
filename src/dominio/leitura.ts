/** A leitura do recorte, em palavras — a que a Situação abre.
 *
 *  POR QUE UMA FONTE SÓ
 *  --------------------
 *  Qualquer tela que resuma o recorte precisa dizer a MESMA coisa sobre ele.
 *  Escrita em dois lugares, a frase diverge no primeiro ajuste — e a liderança
 *  recebe uma conclusão que não bate com o que a equipe está vendo.
 *
 *  Havia uma tela de relatório que também consumia isto daqui; ela saiu do
 *  produto. A regra continua valendo para a próxima que precisar resumir.
 *
 *  O PRINCÍPIO DA PIRÂMIDE, APLICADO
 *  ---------------------------------
 *  Empilhar gráficos e pedir que quem lê chegue sozinho à conclusão é montar de
 *  baixo para cima. Aqui a ordem é a de Minto — Situação, Complicação,
 *  Pergunta, Resposta — e a resposta é a primeira coisa na tela. Os argumentos
 *  existem para sustentá-la, não para construí-la.
 *
 *  NADA AQUI É TEXTO FIXO: cada frase é montada dos números do recorte. Uma
 *  tese que não muda com o dado é decoração.
 */

import type { Catalogo } from '@/dominio/derivacoes';
import type { Interacao } from '@/dominio/tipos';
import { agrupar, panorama } from '@/dominio/agregacao';
import type { Excecao } from '@/dominio/excecoes';
import { numero } from '@/dominio/formato';

export interface Leitura {
  /** Onde estamos: volume e alcance. */
  situacao: string;
  /** O que fugiu do padrão. Uma frase por achado, no máximo três. */
  complicacoes: string[];
  /** A pergunta que a liderança precisa responder. */
  pergunta: string;
  /** A TESE. Uma frase, e é a primeira coisa que se lê. */
  resposta: string;
  /** Os argumentos que sustentam a tese, com a evidência de cada um. */
  argumentos: { afirmacao: string; evidencia: string }[];
}

export function lerRecorteEmPalavras(
  interacoes: Interacao[],
  catalogo: Catalogo,
  excecoesDoRecorte: Excecao[],
): Leitura {
  const p = panorama(interacoes, catalogo);
  const porFrente = agrupar(interacoes, 'frente', catalogo);
  const porVoz = agrupar(interacoes, 'porta-voz', catalogo).filter(
    (g) => g.chave !== 'sem-porta-voz',
  );
  const instituicoes = new Set(interacoes.map((i) => i.instituicao_id)).size;

  const taxa = p.comDesfecho ? Math.round((p.avancou / p.comDesfecho) * 100) : null;
  const concentracao = porVoz.length
    ? Math.round((porVoz[0].total / porVoz.reduce((s, g) => s + g.total, 0)) * 100)
    : null;

  const situacao =
    p.total === 0
      ? 'Nenhuma agenda neste recorte.'
      : `${numero(p.total)} ${p.total === 1 ? 'agenda' : 'agendas'} em ` +
        `${porFrente.length} ${porFrente.length === 1 ? 'frente' : 'frentes'}, ` +
        `com ${numero(instituicoes)} ${instituicoes === 1 ? 'instituição' : 'instituições'}` +
        (p.tier1 ? `. ${numero(p.tier1)} de relevância Tier 1.` : '.');

  const complicacoes: string[] = [];

  const paradas = excecoesDoRecorte.find((e) => e.chave === 'paradas');
  if (paradas?.agendas.length) {
    complicacoes.push(
      `${numero(paradas.agendas.length)} ${paradas.agendas.length === 1 ? 'pedido segue' : 'pedidos seguem'} ` +
        'em aberto há mais de um mês.',
    );
  }

  if (concentracao !== null && concentracao >= 30 && porVoz.length > 1) {
    complicacoes.push(
      `A exposição concentra-se em ${porVoz[0].rotulo}, que responde por ` +
        `${concentracao}% das aparições.`,
    );
  }

  const maisTensa = [...porFrente].sort((a, b) => b.tenso - a.tenso)[0];
  if (maisTensa?.tenso) {
    complicacoes.push(
      `O clima reativo concentra-se em ${maisTensa.rotulo}: ` +
        `${numero(maisTensa.tenso)} de ${numero(maisTensa.total)} agendas.`,
    );
  }

  const foraDoEscopo = excecoesDoRecorte.find((e) => e.chave === 'fora-do-escopo');
  if (foraDoEscopo?.agendas.length) {
    complicacoes.push(
      `${numero(foraDoEscopo.agendas.length)} ${foraDoEscopo.agendas.length === 1 ? 'agenda foi conduzida' : 'agendas foram conduzidas'} ` +
        'por quem não responde pelo tema tratado.',
    );
  }

  const resposta = montarTese(p, taxa, concentracao, porVoz[0]?.rotulo, complicacoes);

  const argumentos: { afirmacao: string; evidencia: string }[] = [];

  if (porFrente.length) {
    const maior = porFrente[0];
    argumentos.push({
      afirmacao: `A conversa se concentra em ${maior.rotulo}.`,
      evidencia:
        `${numero(maior.total)} de ${numero(p.total)} agendas ` +
        `(${Math.round((maior.total / p.total) * 100)}%), contra ` +
        `${numero(porFrente[1]?.total ?? 0)} da frente seguinte.`,
    });
  }

  if (taxa !== null) {
    argumentos.push({
      afirmacao:
        taxa >= 50
          ? 'O que teve desfecho registrado avançou mais do que recuou.'
          : 'O desfecho registrado avança menos do que se esperaria.',
      evidencia:
        `${taxa}% de avanço sobre ${numero(p.comDesfecho)} agendas com desfecho ` +
        `informado — de ${numero(p.total)} no recorte.`,
    });
  }

  if (p.emAberto) {
    argumentos.push({
      afirmacao: 'Parte do recorte ainda não fechou.',
      evidencia:
        `${numero(p.emAberto)} agendas em aberto, ` +
        `${Math.round((p.emAberto / p.total) * 100)}% do total.`,
    });
  }

  return {
    situacao,
    complicacoes: complicacoes.slice(0, 3),
    pergunta: 'O que muda na condução da comunicação no próximo ciclo?',
    resposta,
    argumentos,
  };
}

/** A tese: uma frase que junta o que os números dizem.
 *
 *  Sem número dentro. A tese é a leitura; a evidência vem logo abaixo, nos
 *  argumentos. Misturar as duas produz a frase que ninguém termina de ler.
 */
function montarTese(
  p: ReturnType<typeof panorama>,
  taxa: number | null,
  concentracao: number | null,
  primeiraVoz: string | undefined,
  complicacoes: string[],
): string {
  if (p.total === 0) {
    return 'Não há o que concluir: o recorte não tem agendas.';
  }

  const partes: string[] = [];

  partes.push(
    taxa !== null && taxa >= 50
      ? 'A pauta avançou onde houve desfecho registrado'
      : 'A pauta avançou pouco onde houve desfecho registrado',
  );

  if (concentracao !== null && concentracao >= 30 && primeiraVoz) {
    partes.push(`a exposição segue concentrada em ${primeiraVoz}`);
  }

  if (p.emAberto / p.total >= 0.15) {
    partes.push('e uma parte relevante do que foi pedido não fechou');
  } else if (complicacoes.length) {
    partes.push('e o que escapou do padrão está listado abaixo');
  }

  return `${partes.join(', ')}.`;
}
