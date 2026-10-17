/** O intervalo do eixo Y de uma série temporal, por métrica.
 *
 *  POR QUE ISTO MORA NO DOMÍNIO. A régua saía de seis linhas de aritmética
 *  dentro de `graficos/GraficoDeLinha.tsx`, e a regra da casa é a que
 *  `dominioSuave.ts` escreve: "aritmética dentro de JSX é aritmética que
 *  ninguém revisa". Esta em particular decide o que a pessoa VÊ como tamanho da
 *  variação — uma régua errada não quebra nada, só faz um degrau de quinze
 *  pontos parecer uma linha reta, ou o contrário.
 *
 *  ───────────────────────────────────────────────────────────────────────────
 *  SÃO DUAS RÉGUAS NO PRODUTO, E ELAS SÃO DIFERENTES DE PROPÓSITO
 *
 *  Quem for desenhar a próxima série temporal vai achar duas regras e precisa
 *  saber por que não são uma:
 *
 *  | regra                      | métrica             | limites  | zero        |
 *  |----------------------------|---------------------|----------|-------------|
 *  | `dominioDoNss` (aqui)      | Net Sentiment Score | −100/+100| SEMPRE dentro |
 *  | `jornadaDoIndice.dominioDe`| Índice (ISR)        | 0/100    | não se aplica |
 *
 *  A diferença não é estilo, é a métrica. O NSS é um SALDO: ele cruza o zero, e
 *  o zero é a referência de equilíbrio — tirá-lo do eixo esconderia de que lado
 *  da linha o saldo está. O índice não tem saldo nem zero significativo: ele
 *  vive entre 36 e 58 e prender o eixo em 0–100 apaga o degrau que a diretoria
 *  precisa ler. Unificá-las pioraria as duas.
 *
 *  O QUE A TERCEIRA TERÁ DE DECIDIR. A aba de bonds plota preço e yield, que
 *  não são 0–100 nem −100/+100: a faixa é arbitrária e positiva (preço perto de
 *  100 por coincidência; yield perto de 7). Então ela não reusa nenhuma das
 *  duas, e as três perguntas que ela tem de responder são estas — as mesmas que
 *  as duas acima responderam:
 *
 *    1. a métrica tem LIMITE natural? (NSS: ±100. Índice: 0–100. Yield: não.)
 *    2. existe um valor de REFERÊNCIA que nunca pode sair do eixo? (NSS: o
 *       zero. Índice: nenhum. Bonds: talvez o par, talvez o yield de emissão.)
 *    3. qual o PISO de amplitude, para ruído não parecer virada?
 *
 *  Este arquivo é o lugar da terceira. Acrescentá-la aqui, ao lado destas, é o
 *  que impede o quarto gráfico de recomeçar dentro de um componente — que foi
 *  exatamente o que aconteceu com esta.
 *
 *  JÁ CUSTOU UMA VEZ, e está registrado em `dominio/jornadaDoIndice.ts`: "a
 *  Jornada do índice e a jornada de UMA lente são o mesmo gráfico com dados
 *  diferentes, e cada uma montava a sua conta de `y` com as mesmas constantes.
 *  Corrigi a folga no limite e o lado do rótulo em uma delas; a outra continuou
 *  como estava."
 */

/** As duas pontas do eixo Y. */
export interface FaixaDoEixo {
  minimo: number;
  maximo: number;
}

/** O LIMITE NATURAL DO NSS. O saldo é uma fração de −1 a 1 vezes 100: não
 *  existe valor fora disto, e o eixo não deve sugerir que exista. */
export const NSS_MINIMO = -100;
export const NSS_MAXIMO = 100;

/** Quanto de folga acima do maior valor e abaixo do menor, em FRAÇÃO da
 *  amplitude — sem isto, o ponto mais alto encostaria na borda do gráfico,
 *  junto do próprio rótulo de valor dele. */
export const FRACAO_DE_FOLGA = 0.25;

/** O piso da amplitude usada para calcular a folga.
 *
 *  ATENÇÃO AO NOME, que promete mais do que a conta entrega: ele NÃO é um piso
 *  do eixo. Ele entra só no cálculo da folga, então uma série inteira em zero
 *  dá eixo de −3 a +3 (folga = round(10 × 0,25)), e não uma régua de 10 pontos.
 *
 *  ESTÁ ASSIM DESDE QUE O GRÁFICO EXISTE, e a conta foi movida para cá sem
 *  mudar um caractere: mexer nela mudaria a altura da curva em toda tela que
 *  mostra NSS, e isso é decisão de produto, não limpeza de refatoração. Fica
 *  registrado porque o nome, sozinho, enganaria quem for escrever a terceira
 *  régua. `eixoDaSerie.test.ts` fixa o comportamento REAL. */
export const AMPLITUDE_MINIMA_DA_FOLGA = 10;

export interface OpcoesDoEixoDoNss {
  /** Um valor que nunca pode ficar fora do eixo — a linha de referência
   *  tracejada ("este período contra a média do recorte inteiro"). Sem ela na
   *  conta, a linha sairia da régua visível e o comparativo desapareceria. */
  referencia?: number;
  /** Força a ponta de baixo, desligando a régua automática daquele lado. Serve
   *  para comparar dois gráficos lado a lado na mesma escala. */
  minimo?: number;
  /** Idem, para a ponta de cima. */
  maximo?: number;
}

/** A régua automática do NSS: nasce dos valores, sempre inclui o zero, nunca
 *  passa de −100/+100.
 *
 *  `null` NÃO ENTRA. Um período sem dado abre vão na linha; contá-lo como zero
 *  puxaria a régua para um valor que não foi medido. Quem chama já filtra, e a
 *  assinatura pede `number[]` para que isso seja visível na chamada. */
export function dominioDoNss(
  valores: readonly number[],
  opcoes: OpcoesDoEixoDoNss = {},
): FaixaDoEixo {
  const { referencia, minimo, maximo } = opcoes;
  const naConta = referencia == null ? valores : [...valores, referencia];

  //: O ZERO ENTRA SEMPRE, e é a diferença mais importante em relação à régua do
  //: índice: o NSS é saldo, e um eixo que não mostra o zero não diz de que lado
  //: o saldo está.
  const menor = Math.min(0, ...naConta);
  const maior = Math.max(0, ...naConta);

  const amplitude = Math.max(AMPLITUDE_MINIMA_DA_FOLGA, maior - menor);
  const folga = Math.round(amplitude * FRACAO_DE_FOLGA);

  return {
    minimo: minimo ?? Math.max(NSS_MINIMO, menor - folga),
    maximo: maximo ?? Math.min(NSS_MAXIMO, maior + folga),
  };
}
