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

import { nomeDoMes } from '@/dominio/calendarioMensal';
import {
  COR_DO_EFEITO,
  corDaFaixa,
  corDeAreaDaFaixa,
  rotuloDaFaixa,
} from '@/dominio/score';
import type { PontoDaSerie } from '@/dominio/score';

/** O sistema de coordenadas do SVG, igual ao do protótipo. */
export const VB = { largura: 1000, altura: 330 } as const;
/** Folga no topo, e a faixa de baixo onde moram os nomes dos meses.
 *
 *  EXPORTADAS (com `ALTURA_DO_ROTULO`/`FAIXAS_DE_FUNDO` abaixo) para
 *  `dominio/jornadaDaLente.ts` — a jornada de UMA lente usa o mesmo sistema
 *  de coordenadas e as mesmas cinco faixas, e duas réguas diferentes para o
 *  mesmo desenho é o tipo de divergência que só aparece quando alguém já
 *  está comparando prints. */
export const PAD_TOPO = 14;

/** A folga EXTRA do lado em que o eixo bate no limite do índice.
 *
 *  O PEDIDO: "a faixa, se bater 0 ou 100, deve ter um extra". O índice não passa
 *  de 100 nem desce de 0, então o domínio para ali — e o mês de 100 fica com o
 *  ponto exatamente na borda de cima da área desenhada: metade da bolinha fora, a
 *  tag colada no topo. O mesmo embaixo, com o zero.
 *
 *  DE DESENHO, E NÃO DE ESCALA. Esticar o eixo até 105 escreveria no gráfico um
 *  valor de índice que não existe — e a marca de 105 seria uma mentira pequena no
 *  lugar onde a diretoria lê o número. O eixo continua terminando em 100; o que
 *  ganha ar é o espaço entre a última marca e a borda.
 *
 *  DEZESSEIS É O DOBRO DA BOLINHA (8px): menos que ela continuaria cortando o
 *  ponto, e o dobro dá para a bolinha caber inteira com uma folga do tamanho dela. */
export const FOLGA_NO_LIMITE = 16;
export const PAD_BASE = 34;
//: AS BORDAS DA FAIXA DESENHADA, em porcentagem da altura — que é a unidade em
//: que o ponto é posicionado em HTML sobre o SVG. É contra elas que um valor
//: fora do eixo encosta; contra as bordas do viewBox ele flutuaria na folga.
export const TOPO_DA_FAIXA = (PAD_TOPO / VB.altura) * 100;
export const BASE_DA_FAIXA = ((VB.altura - PAD_BASE) / VB.altura) * 100;
/** A altura que o rótulo de um ponto ocupa, em unidades do viewBox.
 *
 *  ESTA CONSTANTE SÓ VALE PORQUE O RÓTULO ENCOLHE JUNTO com o gráfico. Ela é
 *  medida no viewBox, que tem 330 de altura; o gráfico é desenhado de 260 a
 *  170px conforme a largura da tela. Com o rótulo em tamanho fixo, 72 unidades
 *  valeriam 57px no gráfico grande e 37px no pequeno — e no pequeno o rótulo
 *  era autorizado a descer e invadia a faixa dos meses.
 *
 *  Em `index.css`, `.jornada__rotulo` reduz fonte e afastamento nos mesmos
 *  breakpoints, mantendo a proporção. REFORÇAR A CONSTANTE ERA O CONSERTO
 *  ERRADO: com 96 quase nenhum rótulo passava a caber embaixo, e a regra de
 *  relevo — pico acima, vale abaixo — deixava de valer em qualquer tela. */
export const ALTURA_DO_ROTULO = 72;

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
  /** Medido por menos de quatro lentes — legítimo pela fórmula e enganoso na
   *  curva, porque é o score de uma lente desenhado como se fosse o da
   *  companhia. */
  parcial: boolean;
  /** "1 de 5 lentes" quando o mês foi medido por poucas; vazio quando não.
   *
   *  O NÚMERO FICA, E O RÓTULO VAI JUNTO — decisão de quem cuida do produto,
   *  tomada olhando a curva de desenvolvimento: quatro dos dez pontos vêm de
   *  UMA lente, e janeiro de 2025 sai como 100, faixa "Referência", a partir de
   *  uma única reunião de CRM. Sem o rótulo ao lado, "Referência: reputação é
   *  ativo de valor" é uma afirmação sobre a companhia que uma reunião não
   *  sustenta. Tirar o ponto da curva seria a outra saída, e foi recusada: o
   *  mês existe e o número é legítimo pela fórmula.
   *
   *  O TEXTO É O MESMO QUE `descricao` já dizia ao leitor de tela. Ele estava
   *  certo no nome acessível e ausente na tela — quem enxerga via só uma
   *  bolinha vazada e uma nota de rodapé no fim do cartão. */
  cobertura: string;
  /** O valor real ficou fora do eixo, que é regido pelos meses completos. */
  descricao: string;
}

/** Quantas lentes um mês precisa ter para reger a escala. */
const LENTES_PARA_SER_COMPLETO = 4;
//: QUANTAS LENTES O MODELO TEM. Fechada por desenho — uma lente nova é mudança
//: de modelo, não de cadastro —, e escrita aqui para o rótulo não repetir o 5
//: à mão ao lado de uma regra que fala de 4.
const LENTES_NO_MODELO = 5;

/** "1 de 5 lentes" — ou vazio, quando o mês é comparável.
 *
 *  UMA FRASE, DUAS TELAS. A Jornada põe isto na etiqueta do ponto e a Visão
 *  geral ao lado da faixa, e as duas mostram o MESMO mês: se uma o chamasse de
 *  parcial e a outra não, quem lê as duas concluiria que uma está errada — e
 *  estaria. O corte também é um só; reescrever o `4` na página é como duas
 *  definições de "parcial" nascem.
 *
 *  POR QUE ELE EXISTE. O índice redistribui o peso das lentes que faltam, e
 *  isso foi desenhado para UMA faltando. Com quatro faltando, o número continua
 *  legítimo pela fórmula e passa a descrever outra coisa: no banco de
 *  desenvolvimento, janeiro de 2025 sai como 100 — faixa "Referência: reputação
 *  é ativo de valor" — a partir de uma única reunião de CRM registrada no mês.
 *  Tirar o ponto da curva seria a outra saída, e foi recusada por quem cuida do
 *  produto: o mês existe, e o que faltava era dizer do que ele é feito. */
/** A frase da legenda sobre os meses parciais — ou vazia, quando não há nenhum.
 *
 *  SAIU DO JSX porque ela tem três ramificações e uma concordância, e isso é
 *  exatamente o que não se revisa dentro de um ternário aninhado no meio de um
 *  `<span>`. A versão anterior dizia "1 mês medido por menos de 4 lentes — 1
 *  DELES está fora da escala": antecedente singular, pronome plural.
 *
 *  ERA UMA FRASE DE TRÊS RAMOS, e ficou de um: ela também dizia quantos meses
 *  estavam "fora da escala do eixo", e quando os parciais REGIAM o eixo por não
 *  haver mês completo. Os dois ramos morreram com o conceito: o eixo passou a
 *  acompanhar todo ponto desenhado, então não há mês fora dele e não há mais
 *  distinção sobre quem o rege — todos regem. Sobrou a conta que interessa, que é
 *  de quantos meses o número descreve menos do que parece. */
export function fraseDosParciais(parciais: number): string {
  if (!parciais) return '';
  return parciais === 1
    ? `1 mês medido por menos de ${LENTES_PARA_SER_COMPLETO} lentes`
    : `${parciais} meses medidos por menos de ${LENTES_PARA_SER_COMPLETO} lentes`;
}

export function coberturaDoMes(lentes: number): string {
  if (lentes >= LENTES_PARA_SER_COMPLETO) return '';
  return `${lentes} de ${LENTES_NO_MODELO} lentes`;
}

/** Uma linha da coluna do mês: escrita por gente, ou derivada da base.
 *
 *  AS DUAS NA MESMA LISTA, e a procedência dita: o fato diz o que aconteceu no
 *  mundo, o tema diz por onde aquilo entrou no número. Separá-las em dois
 *  blocos faria a pessoa ler duas listas para entender um mês. */
export interface LinhaDoMes {
  texto: string;
  /** `sustenta` | `pressiona` | `misto`, ou vazio. */
  efeito: string;
  /** De onde veio — é o que a tela marca, e não decora. */
  origem: 'cadastro' | 'base';
  /** "−1,9 pt" para o tema; vazio para o fato, que não tem número. */
  evidencia: string;
}

export interface ColunaDoMes {
  mes: string;
  /** "JUNHO" — o nome por extenso, em caixa alta. */
  nome: string;
  /** "+3 no mês" · "−15 no mês" · "ponto de partida". */
  variacao: string;
  /** Comentários do especialista e temas derivados, na ordem em que se lê.
   *
   *  VAZIA É VAZIA, e não uma frase dizendo que está vazia. "Sem fato de
   *  destaque registrado" em dez colunas seguidas ocupa o lugar do que
   *  importa e não informa nada: a ausência de comentário já se vê. */
  linhas: LinhaDoMes[];
  /** A cor do filete de 3px no topo da coluna. */
  filete: string;
  /** "Maior movimento: Clientes −12", ou vazio. */
  movimento: string;
  /** "−1,5 pt sem tema", quando parte do mês não se explica. */
  semTema: string;
  selecionada: boolean;
}

export interface Jornada {
  resumo: string;
  /** O eixo foi regido por meses PARCIAIS, por não haver completos.
   *
   *  A tela precisa saber para parar de afirmar o contrário. A legenda dizia
   *  "medidos por menos de 4 lentes — fora da escala do eixo" sobre todo mês
   *  parcial, e numa base nova — três meses, duas lentes cada, que é
   *  exatamente o que um cliente vê primeiro — os três REGEM o eixo e caem
   *  dentro dele. A frase afirmava o oposto do desenho. */
  faixas: FaixaDeFundo[];
  marcas: MarcaDoEixo[];
  curva: string;
  pontos: PontoDaJornada[];
  colunas: ColunaDoMes[];
  /** A curva tracejada da lente comparada, e o rótulo no fim dela — a
   *  PRIMEIRA, quando há várias. Ficou para quem lê uma lente só. */
  curvaDaLente: string;
  pontosDaLente: { cx: number; cy: number }[];
  fimDaLente: { esquerda: number; topo: number; texto: string } | null;
  /** UMA CURVA POR LENTE COMPARADA, na ordem em que foram escolhidas. A Visão
   *  geral sobrepõe várias ao mesmo tempo, cada uma na cor da lente. */
  curvasDasLentes: CurvaDaLente[];
}

export interface CurvaDaLente {
  codigo: string;
  curva: string;
  pontos: { cx: number; cy: number }[];
  fim: { esquerda: number; topo: number; texto: string };
}

/** Uma lente ou várias, sempre como lista — a forma de dentro. */
function comoLista(comparada: string | string[] | null | undefined): string[] {
  if (!comparada) return [];
  return Array.isArray(comparada) ? comparada : [comparada];
}

/** Os meses que a lente TEM, cada um com o seu índice na série — o que a põe
 *  no x certo. Com menos de dois, não há curva, e a lente sai inteira. */
function notasDaLente(medidos: PontoDaSerie[], codigo: string): { i: number; nota: number }[] {
  const pares = medidos
    .map((ponto, i) => ({ i, nota: ponto.notas_das_lentes[codigo] }))
    .filter((par): par is { i: number; nota: number } => par.nota !== undefined);
  return pares.length >= 2 ? pares : [];
}

/** "2026-06" → "junho". Devolve a própria chave quando não reconhece.
 *
 *  A LISTA DE MESES NÃO MORA AQUI: `calendarioMensal` já a tinha, e uma segunda
 *  cópia é como "março" vira "marco" em uma tela só. O que este embrulho
 *  acrescenta é a saída para uma chave que não se lê — desenhar `undefined` no
 *  eixo é pior do que desenhar a chave crua. */
export function mesPorExtenso(chave: string): string {
  return nomeDoMes(chave) ?? chave;
}

/** As cinco faixas de fundo, com a cor clara e a escura do nome. */
export const FAIXAS_DE_FUNDO: {
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

/** A etiqueta curta sob o ponto — e NÃO o rótulo do chip.
 *
 *  São dois textos para o mesmo campo, e a diferença é de lugar: o chip do
 *  dossiê tem largura e diz "Pressiona"; aqui cabem seis caracteres embaixo de
 *  um ponto, e o substantivo — "pressão" — diz a mesma coisa em menos espaço.
 *  O nome deste mapa diz isso, para ninguém o confundir com `ROTULO_DO_EFEITO`
 *  e acabar com dois vocabulários para o mesmo dado. */
const TAG_DO_EFEITO: Record<string, string> = {
  pressiona: 'pressão',
  sustenta: 'reforço',
  misto: 'misto',
};

/** "−1,9 pt" — com vírgula, e com o sinal explícito.
 *
 *  O SINAL É O QUE FAZ O NÚMERO SER LIDO COMO CONTRIBUIÇÃO, e não como valor.
 *  "1,9 pt" ao lado de um tema não diz se ele ajudou ou atrapalhou. */
export function emPontos(pontos: number): string {
  const sinal = pontos > 0 ? '+' : '−';
  return `${sinal}${Math.abs(pontos).toFixed(1).replace('.', ',')} pt`;
}

/** As linhas da coluna de um mês: o que se escreveu e o que a base derivou.
 *
 *  OS FATOS VÊM PRIMEIRO porque são o que alguém achou digno de registrar; o
 *  tema vem depois e explica por onde aquilo entrou no número. Um mês com
 *  os dois lê-se de cima para baixo como uma frase só. */
function linhasDoMes(ponto: PontoDaSerie): LinhaDoMes[] {
  const doCadastro: LinhaDoMes[] = ponto.fatos.map((fato) => ({
    texto: fato.texto,
    efeito: fato.efeito,
    origem: 'cadastro',
    evidencia: '',
  }));

  const daBase: LinhaDoMes[] = [ponto.sustentou, ponto.pressionou]
    .filter((tema) => tema !== null)
    .map((tema) => ({
      texto: tema.tema,
      efeito: tema.efeito,
      origem: 'base' as const,
      evidencia: emPontos(tema.pontos),
    }));

  return [...doCadastro, ...daBase];
}

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

//: O DEGRAU QUE CONTA COMO RELEVO, em pontos do índice. Abaixo disto, o mês
//: continua do lado do anterior.
//:
//: TRÊS PONTOS é o degrau que se enxerga na curva. O valor existe por causa de
//: uma série que oscila um ponto para cada lado: pela comparação crua com os
//: vizinhos, cada mês desses é "pico" ou "vale" e o rótulo alterna de lado a
//: cada coluna — o dono do produto viu isso como "as janelas pulando muito".
const RELEVO_QUE_SE_ENXERGA = 3;

/** De que lado da curva fica o rótulo de cada mês: `true` acima.
 *
 *  O RELEVO MANDA, A HISTERESE SEGURA. Um pico de verdade leva o rótulo para
 *  cima e um vale de verdade para baixo — abaixo de um pico o rótulo cairia
 *  dentro da própria curva. Mas quando o mês não é nem um nem outro, ele
 *  acompanha o lado do anterior em vez de decidir sozinho: é o que faz as
 *  etiquetas formarem blocos legíveis em vez de um zigue-zague.
 *
 *  VARRE DA ESQUERDA PARA A DIREITA, e isso é o que dá a estabilidade mês a mês:
 *  cada lado depende só do que vem ANTES, então o mês novo que entra no fim da
 *  série não mexe em nenhum dos que já estavam desenhados.
 *
 *  A PRIMEIRA PONTA olha para o único vizinho que tem. Aqui eu divirjo da
 *  referência, de propósito: o `evolVals` do protótipo usa `v <= serie[1]` no
 *  primeiro ponto e `v >= serie[n-2]` no último — as duas pontas com o sinal
 *  trocado entre si, e a primeira contra a regra do meio. Numa série que só cai,
 *  aquilo manda o rótulo do primeiro ponto para baixo, para dentro da curva que
 *  desce.
 */
export function ladosDosRotulos(notas: number[]): boolean[] {
  const lados: boolean[] = [];
  for (let i = 0; i < notas.length; i += 1) {
    const atual = notas[i];
    const anterior = notas[i - 1];
    const seguinte = notas[i + 1];
    //: A RÉGUA DO RELEVO: contra a média dos vizinhos no meio, contra o único
    //: vizinho nas pontas. É a mesma pergunta — "este mês está acima ou abaixo
    //: do caminho?" — com os dados que cada posição tem.
    const referencia =
      anterior === undefined
        ? seguinte
        : seguinte === undefined
          ? anterior
          : (anterior + seguinte) / 2;

    if (referencia === undefined) {
      //: Um mês só: não há caminho, e para cima é onde o rótulo não disputa
      //: espaço com a coluna do mês.
      lados.push(true);
      continue;
    }
    const degrau = atual - referencia;
    if (degrau >= RELEVO_QUE_SE_ENXERGA) lados.push(true);
    else if (degrau <= -RELEVO_QUE_SE_ENXERGA) lados.push(false);
    //: SEM RELEVO, SEGUE O ANTERIOR — e o primeiro de todos, que não tem quem
    //: seguir, vai para cima pelo mesmo motivo do mês único.
    else lados.push(lados[i - 1] ?? true);
  }
  return lados;
}

/** Quanto de folga extra cada lado do desenho ganha, por o eixo ter batido no
 *  limite do índice.
 *
 *  SÓ NO LADO QUE ENCOSTOU: um gráfico que vive entre 36 e 58 não precisa de ar
 *  nenhum, porque o domínio dele já tem a folga de `dominioDe` nas duas pontas. A
 *  folga daqui é para o caso em que essa folga não pôde existir — o índice acabou. */
function folgasDoLimite(piso: number, teto: number): { topo: number; base: number } {
  return {
    topo: teto >= 100 ? FOLGA_NO_LIMITE : 0,
    base: piso <= 0 ? FOLGA_NO_LIMITE : 0,
  };
}

/** A escala vertical do desenho: onde cada valor do índice cai, em unidades do
 *  viewBox, e quanto de folga sobrou embaixo.
 *
 *  EXPORTADA PORQUE SÃO DUAS JORNADAS, e foi por não existir que eu deixei um
 *  defeito atrás: a Jornada do índice e a jornada de UMA lente (Dossiê da Lente)
 *  são o mesmo gráfico com dados diferentes, e cada uma montava a sua conta de `y`
 *  com as mesmas constantes. Corrigi a folga no limite e o lado do rótulo em uma
 *  delas; a outra continuou como estava, e quem abrisse as duas telas veria o
 *  mesmo gráfico se comportar de dois jeitos.
 *
 *  DEVOLVE A FOLGA DA BASE junto com o `y` porque quem desenha o rótulo precisa
 *  saber onde o desenho termina — é contra esse fim que se mede se o rótulo cabe
 *  abaixo do ponto. */
export function escalaDoEixo(
  piso: number,
  teto: number,
): { y: (valor: number) => number; folgaDaBase: number } {
  const folgas = folgasDoLimite(piso, teto);
  const alturaUtil = VB.altura - PAD_TOPO - folgas.topo - PAD_BASE - folgas.base;
  return {
    y: (valor: number) =>
      PAD_TOPO + folgas.topo + alturaUtil * (1 - (valor - piso) / (teto - piso)),
    folgaDaBase: folgas.base,
  };
}

/** Todos os valores que o eixo precisa conter: o índice de cada mês medido, e a
 *  nota da lente comparada quando há uma.
 *
 *  SEPARADO PARA SER CHAMADO DE FORA (ver `dominioDaJornada`): a tela precisa
 *  saber para onde o eixo vai ANTES de desenhar, para animar até lá. Com a conta
 *  em dois lugares, um dia um deles aprenderia algo e o outro não — e o eixo
 *  animaria para um lugar diferente do que a jornada desenha. */
function valoresDoEixo(
  medidos: PontoDaSerie[],
  daLente: { i: number; nota: number }[],
): number[] {
  return [
    ...medidos.map((ponto) => ponto.isr as number),
    ...daLente.map((par) => par.nota),
  ];
}

/** Para onde o eixo da jornada vai, com esta série e esta lente comparada.
 *
 *  A TELA PERGUNTA ISTO E ANIMA ATÉ AQUI. É a MESMA conta que `jornadaDoIndice`
 *  faz quando desenha sem domínio injetado — ela chama as mesmas duas funções, na
 *  mesma ordem, e é isso que garante que o fim da animação coincida exatamente
 *  com o desenho. */
export function dominioDaJornada(
  serie: PontoDaSerie[],
  comparada: string | string[] | null = null,
): { piso: number; teto: number } {
  const medidos = serie.filter((ponto) => ponto.isr !== null);
  if (!medidos.length) return dominioDe([]);
  //: DOIS PONTOS É O MÍNIMO para existir curva da lente — o mesmo corte que
  //: `jornadaDoIndice` usa (`notasDaLente`). Com um só, a nota não é desenhada,
  //: então ela também não pode mandar no eixo. Com várias lentes, o eixo cabe
  //: todas.
  const dasLentes = comoLista(comparada).flatMap((codigo) => notasDaLente(medidos, codigo));
  return dominioDe(valoresDoEixo(medidos, dasLentes));
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
  comparada: string | string[] | null = null,
  //: O NOME DA LENTE para o rótulo no fim da curva: um texto quando há uma
  //: lente, ou um mapa código → nome quando há várias.
  nomeDaComparada: string | Record<string, string> = '',
  //: O EIXO VINDO DE FORA, para a tela poder animá-lo. Quando não vem, é
  //: calculado aqui como sempre — nenhum chamador precisou mudar.
  //:
  //: POR QUE A TELA PRECISA DISSO: o eixo é adaptativo, então ele muda quando um
  //: mês novo entra ou quando se escolhe uma lente para comparar, e a mudança
  //: seca lê-se como mudança de DADO. Quem anima é o componente, que é quem tem o
  //: relógio; a conta de onde o eixo deve chegar é `dominioDaJornada`, abaixo.
  dominioAnimado?: { piso: number; teto: number },
): Jornada {
  const medidos = serie.filter((ponto) => ponto.isr !== null);
  const total = medidos.length;
  const vazia: Jornada = {
    resumo: resumoDa(serie),
    // Sem mês nenhum não há eixo para ser regido: `false` é a ausência da
    // afirmação, e não a afirmação contrária.
    faixas: [],
    marcas: [],
    curva: '',
    pontos: [],
    colunas: [],
    curvaDaLente: '',
    pontosDaLente: [],
    fimDaLente: null,
    curvasDasLentes: [],
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
  //: DOIS PONTOS É O MÍNIMO para existir curva (`notasDaLente`). Com um só, o
  //: traço seria um ponto solto que ninguém liga a lente nenhuma.
  const comparadas = comoLista(comparada)
    .map((codigo) => ({ codigo, notas: notasDaLente(medidos, codigo) }))
    .filter(({ notas }) => notas.length);
  const daLente = comparadas[0]?.notas ?? [];
  const temLente = daLente.length >= 2;
  const nomeDe = (codigo: string) =>
    typeof nomeDaComparada === 'string' ? nomeDaComparada : (nomeDaComparada[codigo] ?? '');

  // O EIXO ACOMPANHA TODO PONTO DESENHADO, e isto é uma inversão de decisão do
  // dono do produto — a anterior era dele também.
  //
  // ANTES o eixo era regido só pelos meses comparáveis: um mês medido por uma
  // lente produz um ISR legítimo pela fórmula e enganoso na curva, e deixá-lo
  // mandar na escala espremia o período inteiro. Um janeiro com 100 esticava o
  // teto em vinte pontos e achatava o ano num terço da altura.
  //
  // O PREÇO ERA O PONTO FANTASMA: o que não cabia no eixo ia preso na borda,
  // desenhado num lugar que não era o seu valor. Ele olhou a tela e trocou: "não
  // ter pontos fantasmas como é hoje". Perguntei com as três saídas na mesa — o
  // eixo que acompanha tudo, o extremo que sai do desenho, e o eixo que se
  // estica até um limite — e esta foi a escolhida, com o achatamento aceito.
  //
  // O AVISO NÃO MUDOU: o mês de poucas lentes continua marcado como parcial e
  // continua dizendo "1 de 5 lentes" ao lado do número. O que mudou é onde ele
  // é desenhado: no lugar dele.
  const { piso, teto } =
    dominioAnimado ??
    dominioDe(valoresDoEixo(medidos, comparadas.flatMap(({ notas }) => notas)));
  //: A ESCALA É A MESMA DAS DUAS JORNADAS (ver `escalaDoEixo`), e nela mora a
  //: folga extra de cada lado em que o eixo encostou no limite do índice.
  const { y, folgaDaBase } = escalaDoEixo(piso, teto);
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

  //: O LADO DE CADA RÓTULO, decidido de uma vez para a série inteira.
  //:
  //: VARRIDO E NÃO PONTO A PONTO porque a decisão de um depende do lado do
  //: anterior — é o que dá a estabilidade que o dono do produto pediu ("as
  //: janelas (...) estão pulando muito quando passamos de um mês para o outro").
  const ladoDeCada = ladosDosRotulos(notas);

  const pontos = medidos.map((ponto, i): PontoDaJornada => {
    const isr = ponto.isr as number;
    const preferaAcima = ladoDeCada[i];
    const cabeAbaixo = y(isr) + ALTURA_DO_ROTULO <= VB.altura - PAD_BASE - folgaDaBase;
    const cabeAcima = y(isr) - ALTURA_DO_ROTULO >= 0;
    // O FILETE E A ETIQUETA SEGUEM O PRIMEIRO FATO CADASTRADO. Com vários, é
    // o mais antigo que abre a coluna, e é ele que dá a cor: o destaque do mês
    // não pode mudar quando alguém acrescenta uma nota de rodapé depois.
    const efeito = ponto.fatos[0]?.efeito ?? '';
    const parcial = ponto.lentes < LENTES_PARA_SER_COMPLETO;
    return {
      mes: ponto.mes,
      esquerda: (x(i) / VB.largura) * 100,
      // NO LUGAR DO VALOR, SEMPRE. Havia um corte aqui — o ponto que saía do
      // eixo era preso na borda da faixa —, e era ele que desenhava o fantasma:
      // uma bolinha encostada no topo afirmando uma altura que não era a do
      // número escrito ao lado dela. Com o eixo acompanhando todo ponto (ver o
      // domínio, acima), não existe mais ponto fora para prender.
      topo: (y(isr) / VB.altura) * 100,
      cx: x(i),
      cy: y(isr),
      isr,
      // O PREENCHIMENTO E O NÚMERO NÃO USAM A MESMA COR: o ponto é uma
      // bolinha de 8px que precisa saltar do fundo, o número é texto que
      // precisa ser lido. Ver `FAIXAS` em `dominio/score`.
      cor: corDeAreaDaFaixa(isr),
      corDoTexto: corDaFaixa(isr),
      tag: TAG_DO_EFEITO[efeito] ?? '',
      corDaTag: COR_DO_EFEITO[efeito] ?? 'transparent',
      acima: preferaAcima ? cabeAcima || !cabeAbaixo : !cabeAbaixo,
      selecionado: ponto.mes === mesSelecionado,
      parcial,
      cobertura: coberturaDoMes(ponto.lentes),
      descricao:
        `${mesPorExtenso(ponto.mes)}: índice ${isr}, faixa ${rotuloDaFaixa(isr)}` +
        (parcial ? `, medido por ${ponto.lentes} de 5 lentes` : '') +
        (ponto.fatos.length ? `. ${ponto.fatos.map((f) => f.texto).join('. ')}` : ''),
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
      linhas: linhasDoMes(ponto),
      filete: FILETE_DO_EFEITO[ponto.fatos[0]?.efeito ?? ''] ?? 'var(--borda)',
      semTema: ponto.pontos_sem_tema
        ? `${emPontos(ponto.pontos_sem_tema)} sem tema`
        : '',
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
          // O NOME JUNTO DA NOTA: um número solto no fim de uma curva
          // tracejada não diz de quem ele é, e com cinco lentes possíveis a
          // pessoa teria de lembrar qual chip apertou.
          texto: `${nomeDe(comparadas[0].codigo)} ${daLente[daLente.length - 1].nota}`.trim(),
        }
      : null,
    curvasDasLentes: comparadas.map(({ codigo, notas }) => {
      const ultima = notas[notas.length - 1];
      return {
        codigo,
        curva: curvaPor(notas.map((par) => [x(par.i), y(par.nota)])),
        pontos: notas.map((par) => ({ cx: x(par.i), cy: y(par.nota) })),
        fim: {
          esquerda: (x(ultima.i) / VB.largura) * 100,
          topo: (y(ultima.nota) / VB.altura) * 100,
          texto: `${nomeDe(codigo)} ${ultima.nota}`.trim(),
        },
      };
    }),
  };
}
