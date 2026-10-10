/** A janela de meses da Jornada do índice, e o que se lê dentro dela.
 *
 *  NENHUM DESENHO AQUI, como em `jornadaDoIndice`: a mini linha do tempo, os
 *  cartões ao lado do gráfico e a linha do pico leem tudo deste módulo, e é por
 *  ele ser um só que os três ficam de acordo quando a janela anda.
 *
 *  A JANELA É POR ÍNDICE, e não por data: ela anda sobre os meses MEDIDOS da
 *  série (`isr` não nulo), que são exatamente os pontos que a curva desenha. Um
 *  mês sem índice não ocupa vaga — contá-lo faria "3M" mostrar dois pontos.
 */

import { coberturaDoMes, mesPorExtenso } from '@/dominio/jornadaDoIndice';
import type { PontoDaSerie } from '@/dominio/score';

/** Do primeiro ao último mês da janela, inclusive, em índices dos medidos. */
export interface Janela {
  inicio: number;
  fim: number;
}

/** Menos que isto não é jornada: com dois pontos, pico e vale são o começo e o
 *  fim, e a "variação no período" é a do mês. */
export const MESES_MINIMOS = 3;

export type AtalhoDaJanela = '3m' | '6m' | '12m' | 'ano' | 'tudo';

export const ATALHOS_DA_JANELA: { chave: AtalhoDaJanela; rotulo: string; descricao: string }[] = [
  { chave: '3m', rotulo: '3M', descricao: 'Últimos 3 meses' },
  { chave: '6m', rotulo: '6M', descricao: 'Últimos 6 meses' },
  { chave: '12m', rotulo: '12M', descricao: 'Últimos 12 meses' },
  { chave: 'ano', rotulo: 'Ano atual', descricao: 'Do primeiro mês do ano do último mês medido até ele' },
  { chave: 'tudo', rotulo: 'Tudo', descricao: 'Todo o histórico' },
];

/** Os meses que a janela percorre: só os medidos, na ordem da série. */
export function mesesMedidos(serie: PontoDaSerie[]): PontoDaSerie[] {
  return serie.filter((ponto) => ponto.isr !== null);
}

/** Uma janela dentro dos limites e com o tamanho mínimo — o último passo de
 *  toda operação abaixo, para nenhuma delas precisar lembrar das bordas. */
export function ajustar(janela: Janela, total: number): Janela {
  if (total <= 0) return { inicio: 0, fim: -1 };
  const minimo = Math.min(MESES_MINIMOS, total);
  let inicio = Math.max(0, Math.min(janela.inicio, total - 1));
  let fim = Math.max(0, Math.min(janela.fim, total - 1));
  if (fim < inicio) [inicio, fim] = [fim, inicio];
  if (fim - inicio + 1 < minimo) {
    // CRESCE PARA A FRENTE, e se não couber, para trás: quem encolheu a janela
    // contra o fim da série quer ver o fim, não ser empurrado para longe dele.
    fim = Math.min(total - 1, inicio + minimo - 1);
    inicio = Math.max(0, fim - minimo + 1);
  }
  return { inicio, fim };
}

/** A janela de um atalho. "Ano atual" é o ano do ÚLTIMO mês medido, e não o
 *  do relógio: em janeiro, sem o mês ingerido ainda, o ano do relógio seria
 *  uma janela vazia. Com menos de 3 meses no ano, `ajustar` completa com o fim
 *  do ano anterior — a regra do mínimo vale para todo atalho. */
export function janelaDoAtalho(atalho: AtalhoDaJanela, meses: PontoDaSerie[]): Janela {
  const total = meses.length;
  const fim = total - 1;
  switch (atalho) {
    case '3m':
      return ajustar({ inicio: fim - 2, fim }, total);
    case '6m':
      return ajustar({ inicio: fim - 5, fim }, total);
    case '12m':
      return ajustar({ inicio: fim - 11, fim }, total);
    case 'ano': {
      const ano = meses[fim]?.mes.slice(0, 4);
      const inicio = meses.findIndex((ponto) => ponto.mes.slice(0, 4) === ano);
      return ajustar({ inicio: Math.max(0, inicio), fim }, total);
    }
    case 'tudo':
      return ajustar({ inicio: 0, fim }, total);
  }
}

/** O atalho que a janela corresponde, se corresponder — é o que acende o botão. */
export function atalhoDaJanela(janela: Janela, meses: PontoDaSerie[]): AtalhoDaJanela | null {
  //: "TUDO" PRIMEIRO: com uma série curta, 12M e Tudo são a mesma janela, e o
  //: nome mais honesto para "a série inteira" é Tudo.
  const ordem: AtalhoDaJanela[] = ['tudo', '12m', 'ano', '6m', '3m'];
  return (
    ordem.find((atalho) => {
      const candidata = janelaDoAtalho(atalho, meses);
      return candidata.inicio === janela.inicio && candidata.fim === janela.fim;
    }) ?? null
  );
}

/** Desloca a janela inteira, sem mudar o tamanho. Para na borda. */
export function moverJanela(janela: Janela, passo: number, total: number): Janela {
  const tamanho = janela.fim - janela.inicio;
  const inicio = Math.max(0, Math.min(janela.inicio + passo, total - 1 - tamanho));
  return ajustar({ inicio, fim: inicio + tamanho }, total);
}

/** Move uma das bordas. Nunca deixa a janela abaixo do mínimo nem atravessa a
 *  outra borda — a borda arrastada é que para, e não a outra que é empurrada. */
export function redimensionarJanela(
  janela: Janela,
  borda: 'inicio' | 'fim',
  passo: number,
  total: number,
): Janela {
  const minimo = Math.min(MESES_MINIMOS, total);
  if (borda === 'inicio') {
    const inicio = Math.max(0, Math.min(janela.inicio + passo, janela.fim - minimo + 1));
    return ajustar({ inicio, fim: janela.fim }, total);
  }
  const fim = Math.min(total - 1, Math.max(janela.fim + passo, janela.inicio + minimo - 1));
  return ajustar({ inicio: janela.inicio, fim }, total);
}

/** Os pontos da série que caem na janela — o que gráfico e subtítulo recebem.
 *
 *  Corta a SÉRIE INTEIRA pelos meses-limite, e não os medidos: um mês sem índice
 *  no meio da janela continua na série que vai ao gráfico, como sempre foi. */
export function serieDaJanela(serie: PontoDaSerie[], janela: Janela): PontoDaSerie[] {
  const meses = mesesMedidos(serie);
  const primeiro = meses[janela.inicio]?.mes;
  const ultimo = meses[janela.fim]?.mes;
  if (!primeiro || !ultimo) return serie;
  return serie.filter((ponto) => ponto.mes >= primeiro && ponto.mes <= ultimo);
}

/** Um valor de cartão: o número e o mês dele. */
export interface ValorDoMes {
  valor: number;
  mes: string;
  /** "junho de 2026" — o mês como a tela escreve. */
  rotuloDoMes: string;
}

/** O extremo que a regra de qualidade deixou de fora, para o aviso. */
export interface ExtremoParcial extends ValorDoMes {
  /** "1 de 5 lentes". */
  cobertura: string;
}

export interface KpisDaJanela {
  atual: ValorDoMes | null;
  /** Só entre meses medidos por 4 lentes ou mais. Nulo quando não há nenhum. */
  pico: ValorDoMes | null;
  vale: ValorDoMes | null;
  /** O pico ABSOLUTO, quando ele veio de um mês parcial e por isso não é o
   *  `pico` acima. É o que vira o aviso "medido por 1 de 5 lentes". */
  picoParcial: ExtremoParcial | null;
  valeParcial: ExtremoParcial | null;
  /** A média da janela, arredondada — só dos meses medidos por 4 lentes ou
   *  mais, pela mesma regra do pico e do vale; sem nenhum, de todos. */
  media: number | null;
  /** Último menos primeiro mês da janela, em pontos. */
  variacao: { pontos: number; sentido: 'alta' | 'queda' | 'estavel'; de: ValorDoMes; ate: ValorDoMes } | null;
}

const doMes = (ponto: PontoDaSerie): ValorDoMes => ({
  valor: ponto.isr as number,
  mes: ponto.mes,
  rotuloDoMes: mesComAno(ponto.mes),
});

/** "2026-06" → "junho de 2026". O ano entra aqui, e não no subtítulo: o cartão
 *  fica sozinho, sem o resto da frase dizendo de que período se fala. */
export function mesComAno(chave: string): string {
  const ano = chave.slice(0, 4);
  return `${mesPorExtenso(chave)} de ${ano}`;
}

/** Os quatro cartões ao lado do gráfico, para a série já recortada.
 *
 *  A REGRA DE QUALIDADE é a mesma do resto da Jornada (`coberturaDoMes`): um mês
 *  medido por menos de 4 lentes tem um número legítimo pela fórmula que não se
 *  compara com os outros. Ele não pode ser o Pico nem o Vale — mas, quando o
 *  extremo absoluto é dele, a tela avisa, em vez de esconder que existiu.
 *
 *  O EMPATE FICA COM O MÊS MAIS RECENTE: "o pico foi junho" diz mais do que
 *  "o pico foi janeiro" quando os dois valem o mesmo — é a notícia mais nova. */
export function kpisDaJanela(serieRecortada: PontoDaSerie[]): KpisDaJanela {
  const medidos = mesesMedidos(serieRecortada);
  if (!medidos.length) {
    return { atual: null, pico: null, vale: null, picoParcial: null, valeParcial: null, media: null, variacao: null };
  }

  const completos = medidos.filter((ponto) => !coberturaDoMes(ponto.lentes));
  const extremo = (lista: PontoDaSerie[], melhor: (a: number, b: number) => boolean) =>
    lista.reduce<PontoDaSerie | null>(
      (achado, ponto) =>
        !achado || melhor(ponto.isr as number, achado.isr as number) ||
        (ponto.isr === achado.isr && ponto.mes > achado.mes)
          ? ponto
          : achado,
      null,
    );

  const pico = extremo(completos, (a, b) => a > b);
  const vale = extremo(completos, (a, b) => a < b);
  const picoAbsoluto = extremo(medidos, (a, b) => a > b);
  const valeAbsoluto = extremo(medidos, (a, b) => a < b);

  //: O AVISO SÓ QUANDO O EXTREMO ABSOLUTO É PARCIAL E PASSA DO CONSIDERADO — um
  //: mês parcial que empata com o pico não muda nada que valha uma linha a mais.
  const parcial = (
    absoluto: PontoDaSerie | null,
    considerado: PontoDaSerie | null,
    passa: (a: number, b: number) => boolean,
  ): ExtremoParcial | null => {
    if (!absoluto || !coberturaDoMes(absoluto.lentes)) return null;
    if (considerado && !passa(absoluto.isr as number, considerado.isr as number)) return null;
    return { ...doMes(absoluto), cobertura: coberturaDoMes(absoluto.lentes) };
  };

  const primeiro = medidos[0];
  const ultimo = medidos[medidos.length - 1];
  const pontos = (ultimo.isr as number) - (primeiro.isr as number);
  const daMedia = completos.length ? completos : medidos;
  const media = Math.round(
    daMedia.reduce((soma, ponto) => soma + (ponto.isr as number), 0) / daMedia.length,
  );

  return {
    atual: doMes(ultimo),
    pico: pico ? doMes(pico) : null,
    vale: vale ? doMes(vale) : null,
    picoParcial: parcial(picoAbsoluto, pico, (a, b) => a > b),
    valeParcial: parcial(valeAbsoluto, vale, (a, b) => a < b),
    media,
    variacao:
      medidos.length < 2
        ? null
        : {
            pontos,
            sentido: pontos > 0 ? 'alta' : pontos < 0 ? 'queda' : 'estavel',
            de: doMes(primeiro),
            ate: doMes(ultimo),
          },
  };
}

const pontosEmTexto = (n: number) => `${n} ${n === 1 ? 'ponto' : 'pontos'}`;

/** A frase do cabeçalho da Jornada: em que pé o índice está, comparado com a
 *  média, o pico e o vale da janela, e quanto andou no período.
 *
 *  `sujeito` é quem a frase descreve — "O índice" na Visão geral, "A lente
 *  Imprensa" dentro da lente. A frase muda com a janela, junto dos cartões. */
export function fraseDaJanela(kpis: KpisDaJanela, sujeito = 'O índice'): string {
  const { atual, media, pico, vale, variacao } = kpis;
  if (!atual) return 'Sem mês medido nesta janela.';

  let frase = `${sujeito} está em ${atual.valor} em ${atual.rotuloDoMes}`;
  if (media !== null) {
    const diferenca = atual.valor - media;
    frase +=
      diferenca === 0
        ? `, exatamente na média da janela (${media})`
        : `, ${pontosEmTexto(Math.abs(diferenca))} ${diferenca > 0 ? 'acima' : 'abaixo'} da média da janela (${media})`;
  }
  const partes = [`${frase}.`];

  if (pico && vale && pico.mes !== vale.mes) {
    partes.push(`O pico foi ${pico.valor}, em ${pico.rotuloDoMes}, e o vale ${vale.valor}, em ${vale.rotuloDoMes}.`);
  } else if (pico) {
    partes.push(`O pico foi ${pico.valor}, em ${pico.rotuloDoMes}.`);
  }

  if (variacao) {
    partes.push(
      variacao.sentido === 'estavel'
        ? 'No período, ficou estável.'
        : `No período, ${variacao.sentido === 'alta' ? 'subiu' : 'caiu'} ${pontosEmTexto(Math.abs(variacao.pontos))}.`,
    );
  }
  return partes.join(' ');
}

/** O código com que o índice geral entra na série de uma lente, para ser
 *  desenhado como curva de comparação. Não é lente nenhuma do modelo. */
export const CODIGO_DO_INDICE = 'indice_geral';

/** A série de UMA lente no formato da série do índice: `isr` passa a ser a
 *  nota da lente no mês. É o que deixa a Jornada da lente usar o mesmo gráfico,
 *  os mesmos cartões e a mesma janela da Visão geral.
 *
 *  O QUE É DO ÍNDICE SAI: os fatos do mês e a cobertura por lentes descrevem o
 *  ISR, e não esta lente — um ponto marcado "1 de 5 lentes" na curva da
 *  Imprensa diria algo que não é sobre ela. */
export function serieDaLente(serie: PontoDaSerie[], codigo: string): PontoDaSerie[] {
  return serie.map((ponto) => ({
    ...ponto,
    isr: ponto.notas_das_lentes[codigo] ?? null,
    //: O ÍNDICE GERAL VIAJA COMO MAIS UMA "LENTE" (`CODIGO_DO_INDICE`), para a
    //: Jornada da lente desenhá-lo como curva de comparação, pontilhada.
    notas_das_lentes:
      ponto.isr === null
        ? ponto.notas_das_lentes
        : { ...ponto.notas_das_lentes, [CODIGO_DO_INDICE]: ponto.isr },
    lentes: 5,
    fatos: [],
    delta: null,
    maior_movimento: null,
    pontos_sem_tema: 0,
  }));
}
