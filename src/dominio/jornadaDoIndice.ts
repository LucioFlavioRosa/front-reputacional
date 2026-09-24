/** A jornada do índice — a curva, as faixas e as colunas, sem desenhar nada.
 *
 *  O QUE ESTE GRÁFICO RESPONDE não é "quanto é o índice", que o radial já diz:
 *  é "como chegamos aqui". A curva mostra o caminho; as faixas ao fundo dizem
 *  em que território cada trecho andou; a coluna de cada mês diz o que
 *  aconteceu no mundo e por qual lente aquilo entrou no número.
 *
 *  TRÊS REGRAS DE ESPAÇO moram aqui, e as três já quebraram no protótipo:
 *
 *      variação em linha própria     com seis colunas não há largura para o
 *                                    nome do mês e a variação lado a lado
 *      faixa rotulada FORA           dentro do gráfico o nome da faixa colide
 *                                    com o primeiro e o último ponto, que
 *                                    ficam a 1/(2n) da borda
 *      rótulo abaixo só se couber    embaixo do último ponto há o eixo dos
 *                                    meses, e o rótulo passava por cima dele
 *
 *  O NÚMERO NÃO É RECALCULADO AQUI. ISR, notas das lentes, variação e fato
 *  chegam do servidor; este arquivo decide onde cada um cai na tela.
 */

import { corDaFaixa, corDeAreaDaFaixa } from '@/dominio/score';
import type { PontoDaSerie } from '@/dominio/score';

/** O sistema de coordenadas do SVG, igual ao do protótipo. */
export const VB = { largura: 1000, altura: 330 } as const;
/** Folga no topo, e a faixa de baixo onde moram os nomes dos meses. */
const PAD_TOPO = 14;
const PAD_BASE = 34;
/** A altura que o rótulo de um ponto ocupa, em unidades do viewBox. */
const ALTURA_DO_ROTULO = 72;

/** A amplitude mínima do eixo.
 *
 *  SEM ELA, uma série estável vira uma montanha-russa: com quatro meses entre
 *  56 e 58, o domínio teria três pontos de altura e um passo de um ponto
 *  ocuparia meio gráfico. */
const AMPLITUDE_MINIMA = 30;

export interface FaixaDeFundo {
  rotulo: string;
  /** Topo e altura em unidades do viewBox. */
  y: number;
  altura: number;
  fundo: string;
  /** A cor do nome da faixa, escrito FORA do gráfico. */
  cor: string;
  /** O centro vertical da faixa, em % da altura — onde o nome se alinha. */
  centro: number;
}

export interface MarcaDoEixo {
  valor: number;
  /** Em % da altura do gráfico. */
  topo: number;
}

export interface PontoDaJornada {
  mes: string;
  /** Em % da largura e da altura — para o overlay HTML. */
  esquerda: number;
  topo: number;
  /** Em unidades do viewBox, para o SVG. */
  cx: number;
  cy: number;
  isr: number;
  cor: string;
  /** A cor legível do número, que não é a do preenchimento. */
  corDoTexto: string;
  /** "pressão" | "reforço" | "misto", ou vazio quando o mês não tem fato. */
  tag: string;
  corDaTag: string;
  /** O rótulo vai acima do ponto, ou abaixo. */
  acima: boolean;
  selecionado: boolean;
  descricao: string;
}

export interface ColunaDoMes {
  mes: string;
  /** "JUNHO" — o nome por extenso, em caixa alta. */
  nome: string;
  /** "+3 no mês" · "−15 no mês" · "ponto de partida". */
  variacao: string;
  fato: string;
  /** A cor do filete de 3px no topo da coluna. */
  filete: string;
  /** "Maior movimento: Clientes −12", ou vazio. */
  movimento: string;
  selecionada: boolean;
}

export interface Jornada {
  resumo: string;
  faixas: FaixaDeFundo[];
  marcas: MarcaDoEixo[];
  curva: string;
  pontos: PontoDaJornada[];
  colunas: ColunaDoMes[];
  /** A curva tracejada da lente comparada, e o rótulo no fim dela. */
  curvaDaLente: string;
  pontosDaLente: { cx: number; cy: number }[];
  fimDaLente: { esquerda: number; topo: number; texto: string } | null;
}

const MES_POR_EXTENSO = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** "2026-06" → "junho". Devolve a própria chave quando não reconhece. */
export function mesPorExtenso(chave: string): string {
  const indice = Number(chave.split('-')[1]) - 1;
  return MES_POR_EXTENSO[indice] ?? chave;
}

/** As cinco faixas de fundo, com a cor clara e a escura do nome. */
const FAIXAS_DE_FUNDO: {
  de: number;
  ate: number;
  fundo: string;
  cor: string;
  rotulo: string;
}[] = [
  { de: 0, ate: 40, fundo: 'var(--erro-bg)', cor: 'var(--erro-fg)', rotulo: 'Crítico' },
  {
    de: 40,
    ate: 55,
    fundo: 'var(--atencao-bg)',
    cor: 'var(--atencao-fg)',
    rotulo: 'Atenção',
  },
  { de: 55, ate: 70, fundo: 'var(--bg-trilho)', cor: 'var(--azul-mar)', rotulo: 'Estável' },
  { de: 70, ate: 85, fundo: 'var(--ok-bg)', cor: 'var(--ok-fg)', rotulo: 'Sólido' },
  { de: 85, ate: 100, fundo: 'var(--turquesa-claro)', cor: 'var(--ok-fg)', rotulo: 'Referência' },
];

const ROTULO_DO_EFEITO: Record<string, string> = {
  pressiona: 'pressão',
  sustenta: 'reforço',
  misto: 'misto',
};

const COR_DO_EFEITO: Record<string, string> = {
  pressiona: 'var(--erro-fg)',
  sustenta: 'var(--ok-fg)',
  misto: 'var(--cinza-3)',
};

const FILETE_DO_EFEITO: Record<string, string> = {
  pressiona: 'var(--erro-fg)',
  sustenta: 'var(--turquesa-rio)',
  misto: 'var(--cinza-2)',
};

/** O intervalo do eixo Y, ajustado aos valores.
 *
 *  ADAPTATIVO, E NÃO 0–100: uma série que vive entre 36 e 58 desenhada numa
 *  escala de 0 a 100 vira uma linha quase reta no meio do gráfico, e o degrau
 *  de quinze pontos que a diretoria precisa ver some. */
export function dominioDe(valores: number[]): { piso: number; teto: number } {
  if (!valores.length) return { piso: 0, teto: AMPLITUDE_MINIMA };
  let piso = Math.max(0, Math.floor((Math.min(...valores) - 8) / 5) * 5);
  let teto = Math.min(100, Math.ceil((Math.max(...valores) + 8) / 5) * 5);
  if (teto - piso < AMPLITUDE_MINIMA) {
    const centro = (teto + piso) / 2;
    piso = Math.max(0, Math.round(centro - AMPLITUDE_MINIMA / 2));
    teto = Math.min(100, piso + AMPLITUDE_MINIMA);
  }
  return { piso, teto };
}

/** A curva suave que passa por todos os pontos.
 *
 *  CATMULL-ROM CONVERTIDA EM BÉZIER: é a spline que passa EXATAMENTE pelos
 *  pontos, e não perto deles. Numa curva de índice, um traço que corta o canto
 *  entre dois meses desenha um valor que nunca existiu. */
export function curvaPor(pontos: [number, number][]): string {
  if (!pontos.length) return '';
  const n = (valor: number) => valor.toFixed(1);
  let caminho = `M${n(pontos[0][0])} ${n(pontos[0][1])}`;
  for (let i = 0; i < pontos.length - 1; i += 1) {
    const p0 = pontos[i - 1] ?? pontos[i];
    const p1 = pontos[i];
    const p2 = pontos[i + 1];
    const p3 = pontos[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    caminho += `C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p2[0])} ${n(p2[1])}`;
  }
  return caminho;
}

/** A frase que abre o bloco, calculada da série.
 *
 *  "O PERÍODO", E NÃO "O SEMESTRE" como pede a especificação: a série cresce a
 *  cada mês ingerido, e uma frase que afirma seis meses passa a mentir no
 *  sétimo — exatamente o tipo de texto que envelhece em silêncio. */
export function resumoDa(serie: PontoDaSerie[]): string {
  const medidos = serie.filter((ponto) => ponto.isr !== null);
  if (medidos.length < 2) return 'Um mês só de série — ainda não há jornada para ler.';

  const notas = medidos.map((ponto) => ponto.isr as number);
  const inicio = notas[0];
  const fim = notas[notas.length - 1];
  const diferenca = Math.abs(fim - inicio);
  const sentido = fim >= inicio ? 'acima' : 'abaixo';
  const pontos = diferenca === 1 ? 'ponto' : 'pontos';

  const minimo = Math.min(...notas);
  const maximo = Math.max(...notas);
  const doVale = medidos[notas.indexOf(minimo)];
  const doPico = medidos[notas.indexOf(maximo)];

  const abertura =
    `O índice fecha o período ${diferenca} ${pontos} ${sentido} de ` +
    `${mesPorExtenso(medidos[0].mes)}.`;
  const vale = `O vale foi ${mesPorExtenso(doVale.mes)} (${minimo})`;
  // A SEGUNDA METADE SOME quando vale e pico caem no mesmo mês: "o vale foi
  // junho (58) e o pico, junho (58)" é uma frase que só um programa escreve.
  return doPico.mes === doVale.mes
    ? `${abertura} ${vale}.`
    : `${abertura} ${vale} e o pico, ${mesPorExtenso(doPico.mes)} (${maximo}).`;
}

/** Tudo o que a jornada desenha, já posicionado.
 *
 *  `comparada` é o código da lente cuja curva acompanha a do índice, ou nulo.
 */
export function jornadaDoIndice(
  serie: PontoDaSerie[],
  mesSelecionado: string,
  comparada: string | null = null,
): Jornada {
  const medidos = serie.filter((ponto) => ponto.isr !== null);
  const total = medidos.length;
  const vazia: Jornada = {
    resumo: resumoDa(serie),
    faixas: [],
    marcas: [],
    curva: '',
    pontos: [],
    colunas: [],
    curvaDaLente: '',
    pontosDaLente: [],
    fimDaLente: null,
  };
  if (!total) return vazia;

  const notas = medidos.map((ponto) => ponto.isr as number);
  // OS MESES QUE A LENTE TEM, e não todos — cada um guardando o seu índice na
  // série, que é o que a põe no x certo.
  //
  // EXIGIR A SÉRIE INTEIRA ERA UM ERRO, e um erro mudo: basta um mês sem a
  // lente para a curva não aparecer, e na base real só a institucional cobre
  // todos os meses. Selecionar qualquer outra não desenhava nada, sem dizer por
  // quê. Uma curva que começa depois ou termina antes mostra na hora até onde a
  // lente foi medida.
  const daLente = comparada
    ? medidos
        .map((ponto, i) => ({ i, nota: ponto.notas_das_lentes[comparada] }))
        .filter((par): par is { i: number; nota: number } => par.nota !== undefined)
    : [];
  // DOIS PONTOS É O MÍNIMO para existir curva. Com um só, o traço seria um
  // ponto solto que ninguém liga a lente nenhuma.
  const temLente = daLente.length >= 2;

  const { piso, teto } = dominioDe([
    ...notas,
    ...(temLente ? daLente.map((par) => par.nota) : []),
  ]);
  const alturaUtil = VB.altura - PAD_TOPO - PAD_BASE;
  const y = (valor: number) => PAD_TOPO + alturaUtil * (1 - (valor - piso) / (teto - piso));
  // O CENTRO DA COLUNA, e não a borda: é o que faz o ponto cair exatamente
  // sobre a coluna do mês, que é a única forma de ligar um ao outro.
  const x = (i: number) => ((i + 0.5) / total) * VB.largura;

  const faixas = FAIXAS_DE_FUNDO.filter(
    (faixa) => faixa.ate > piso && faixa.de < teto,
  ).map((faixa): FaixaDeFundo => {
    const baixo = Math.max(faixa.de, piso);
    const alto = Math.min(faixa.ate, teto);
    return {
      rotulo: faixa.rotulo,
      y: y(alto),
      altura: y(baixo) - y(alto),
      fundo: faixa.fundo,
      cor: faixa.cor,
      centro: (((y(alto) + y(baixo)) / 2) / VB.altura) * 100,
    };
  });

  const marcas: MarcaDoEixo[] = [];
  for (let valor = Math.ceil(piso / 10) * 10; valor <= teto; valor += 10) {
    marcas.push({ valor, topo: (y(valor) / VB.altura) * 100 });
  }

  const pontos = medidos.map((ponto, i): PontoDaJornada => {
    const isr = ponto.isr as number;
    const anterior = notas[i - 1] ?? isr;
    const seguinte = notas[i + 1] ?? isr;
    // PICO LOCAL VAI PARA CIMA: o rótulo acompanha o relevo, e não uma regra
    // fixa — abaixo de um pico ele cairia dentro da própria curva.
    const preferaAcima = isr >= (anterior + seguinte) / 2;
    const cabeAbaixo = y(isr) + ALTURA_DO_ROTULO <= VB.altura - PAD_BASE;
    const cabeAcima = y(isr) - ALTURA_DO_ROTULO >= 0;
    const efeito = ponto.fato?.efeito ?? '';
    return {
      mes: ponto.mes,
      esquerda: (x(i) / VB.largura) * 100,
      topo: (y(isr) / VB.altura) * 100,
      cx: x(i),
      cy: y(isr),
      isr,
      // O PREENCHIMENTO E O NÚMERO NÃO USAM A MESMA COR: o ponto é uma
      // bolinha de 8px que precisa saltar do fundo, o número é texto que
      // precisa ser lido. Ver `FAIXAS` em `dominio/score`.
      cor: corDeAreaDaFaixa(isr),
      corDoTexto: corDaFaixa(isr),
      tag: ROTULO_DO_EFEITO[efeito] ?? '',
      corDaTag: COR_DO_EFEITO[efeito] ?? 'transparent',
      acima: preferaAcima ? cabeAcima || !cabeAbaixo : !cabeAbaixo,
      selecionado: ponto.mes === mesSelecionado,
      descricao:
        `${mesPorExtenso(ponto.mes)}: índice ${isr}` +
        (ponto.fato ? `. ${ponto.fato.texto}` : '. Sem fato de destaque registrado.'),
    };
  });

  const colunas = medidos.map((ponto, i): ColunaDoMes => {
    const movimento = ponto.maior_movimento;
    return {
      mes: ponto.mes,
      nome: mesPorExtenso(ponto.mes),
      // PONTO DE PARTIDA, e não "0 no mês": zero afirmaria que o índice não se
      // moveu, e no primeiro mês não há de onde se mover.
      variacao:
        i === 0 || ponto.delta === null
          ? 'ponto de partida'
          : `${ponto.delta > 0 ? '+' : '−'}${Math.abs(ponto.delta)} no mês`,
      fato: ponto.fato?.texto ?? 'Sem fato de destaque registrado.',
      filete: FILETE_DO_EFEITO[ponto.fato?.efeito ?? ''] ?? 'var(--borda)',
      movimento: movimento
        ? `Maior movimento: ${movimento.lente} ${movimento.delta > 0 ? '+' : '−'}${Math.abs(movimento.delta)}`
        : '',
      selecionada: ponto.mes === mesSelecionado,
    };
  });

  return {
    resumo: resumoDa(serie),
    faixas,
    marcas,
    curva: curvaPor(notas.map((nota, i) => [x(i), y(nota)])),
    pontos,
    colunas,
    curvaDaLente: temLente
      ? curvaPor(daLente.map((par) => [x(par.i), y(par.nota)]))
      : '',
    pontosDaLente: temLente
      ? daLente.map((par) => ({ cx: x(par.i), cy: y(par.nota) }))
      : [],
    fimDaLente: temLente
      ? {
          esquerda: (x(daLente[daLente.length - 1].i) / VB.largura) * 100,
          topo: (y(daLente[daLente.length - 1].nota) / VB.altura) * 100,
          texto: String(daLente[daLente.length - 1].nota),
        }
      : null,
  };
}
