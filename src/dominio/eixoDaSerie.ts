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


/* ───────────────────────────────────────────────────────────────────────────
 * A TERCEIRA RÉGUA: a cotação de bonds.
 *
 * O cabeçalho deste arquivo deixou as três perguntas formuladas. As respostas:
 *
 *   1. LIMITE NATURAL? NÃO. Preço é % do valor de face e passa de 100 quando o
 *      papel negocia com ágio — medido no export de 16/10/2026: 111,2048. Yield
 *      não tem teto; o maior medido é 61,93 (papel em aflição). Prender o eixo
 *      em 0–100 como o do índice recusaria dado real.
 *
 *   2. REFERÊNCIA QUE NUNCA SAI DO EIXO? NÃO, e é o oposto da régua do NSS. O
 *      par (100) é referência conceitual — acima é ágio, abaixo é deságio —,
 *      mas forçá-lo no eixo quando a série inteira vive entre 95 e 97 achataria
 *      a variação a um traço. O que a tela responde é "quanto se moveu no
 *      período", não "está acima ou abaixo do par"; o painel de cotações ao
 *      lado dá o nível, o gráfico dá o movimento.
 *
 *   3. PISO DE AMPLITUDE? SIM, e é o parâmetro que mais importa aqui. Preço de
 *      bond se move centésimos num dia calmo, e sem piso uma semana de ±0,05
 *      preencheria o gráfico inteiro — ruído desenhado como virada. O piso é em
 *      PONTOS, não em fração: dois pontos de preço é a menor variação que vale
 *      um gráfico, e abaixo disso o eixo para de encolher.
 *
 * E A FOLGA É MENOR QUE A DO NSS (8% contra 25%), seguindo a especificação. O
 * NSS mostra o valor escrito em cima de cada bolinha e precisa de espaço para o
 * rótulo; aqui a etiqueta fica na borda direita, fora da área de plotagem.
 * ─────────────────────────────────────────────────────────────────────────── */

/** A folga do eixo dos bonds, em fração da amplitude. 8% é o da especificação. */
export const FOLGA_DOS_BONDS = 0.08;

/** A FAIXA FIXA DE CADA MÉTRICA, que só se expande quando o dado sai dela.
 *
 *  POR QUE ELA EXISTE, e é um conserto de raciocínio meu. Eu havia fixado só o
 *  eixo DIREITO (o índice) e descrito isso como "o que impede o gráfico de
 *  mentir". Uma revisão apontou que está incompleto: com o esquerdo automático,
 *  trocar o período de 3M para 6M ainda muda a FORMA da curva dos bonds, então
 *  a coincidência visual entre as duas curvas continua se mexendo com o
 *  recorte. Fixar um eixo só resolve metade e descreve o todo.
 *
 *  FIXA, MAS NÃO RÍGIDA. Uma faixa que ignora o dado esconderia um papel em
 *  colapso — e é exatamente nessa hora que alguém olha o gráfico. A régua é a
 *  UNIÃO da faixa fixa com o que o dado pede: no caso normal ela não se mexe
 *  entre recortes, e no caso extremo ela se abre e o extremo aparece.
 *
 *  OS NÚMEROS SÃO MEDIDOS no export de 16/10/2026, não escolhidos:
 *
 *    preço  os bonds da Aegea vivem entre 95 e 97; o maior preço de toda a
 *           base é 111,2048 (papel com ágio). A faixa 90–110 contém o caso
 *           normal e o par (100), que é a referência de leitura de quem é de RI;
 *    yield  os da Aegea ficam entre 7 e 9; o maior de toda a base é 61,93, de
 *           um par em aflição. A faixa 0–15 contém o caso normal, e o par em
 *           aflição a expande — que é o certo, porque é ele a notícia.
 */
export const FAIXA_FIXA_DO_PRECO: FaixaDoEixo = { minimo: 90, maximo: 110 };
export const FAIXA_FIXA_DO_YIELD: FaixaDoEixo = { minimo: 0, maximo: 15 };

/** O piso da amplitude do eixo dos bonds, EM PONTOS da métrica.
 *
 *  DIFERENTE DE `AMPLITUDE_MINIMA_DA_FOLGA`, que só entra no cálculo da folga:
 *  este é piso do EIXO. Uma série que varia 0,3 ponto recebe uma régua de 2
 *  pontos centrada nela, e a curva aparece como a oscilação pequena que é. */
export const AMPLITUDE_MINIMA_DOS_BONDS = 2;

/** A régua do eixo ESQUERDO: a faixa fixa da métrica, aberta pelo que o dado
 *  pedir.
 *
 *  `base` É A FAIXA FIXA (`FAIXA_FIXA_DO_PRECO` ou `FAIXA_FIXA_DO_YIELD`), e
 *  omiti-la volta ao comportamento puramente automático — o que serve a quem
 *  plote uma métrica nova sem faixa medida ainda.
 *
 *  `null` NÃO ENTRA, pela mesma razão do NSS: dia sem pregão abre vão, e
 *  contá-lo como zero puxaria a régua para um valor que não foi medido. A
 *  assinatura pede `number[]` para que o filtro fique visível na chamada.
 *
 *  SÉRIE VAZIA devolve a faixa fixa, ou uma simbólica sem ela: a tela pode
 *  renderizar o eixo antes de o dado chegar, e `Math.min()` sem argumento
 *  devolve `Infinity`, que vira um SVG com coordenadas `NaN` — um gráfico em
 *  branco sem erro no console, que é o pior jeito de não funcionar. */
export function dominioDosBonds(
  valores: readonly number[],
  base?: FaixaDoEixo,
): FaixaDoEixo {
  if (valores.length === 0) {
    return base ?? { minimo: 0, maximo: AMPLITUDE_MINIMA_DOS_BONDS };
  }

  const menor = Math.min(...valores);
  const maior = Math.max(...valores);
  const medido = maior - menor;

  //: O PISO AFASTA AS DUAS PONTAS em igual medida, para a curva não se deslocar
  //: na vertical quando a amplitude é pequena — duas cargas do mesmo período
  //: desenhariam alturas diferentes.
  //:
  //: "EM IGUAL MEDIDA" E NÃO "CENTRA", e esta frase é correção de uma revisão:
  //: o `Math.max(0, …)` abaixo vence perto de zero, e aí a série deixa de ficar
  //: no meio. Para `[0,4; 0,5]` o eixo sai 0–1,61 e o centro vai para 0,805,
  //: contra 0,45 da série. É compressão visual, não valor falso — e com a faixa
  //: fixa de cada métrica o caso deixou de aparecer na prática.
  const falta = Math.max(0, AMPLITUDE_MINIMA_DOS_BONDS - medido) / 2;
  const amplitude = Math.max(AMPLITUDE_MINIMA_DOS_BONDS, medido);
  const folga = amplitude * FOLGA_DOS_BONDS;

  //: NUNCA ABAIXO DE ZERO: preço e yield negativos não existem, e um eixo que
  //: começa em −1,2 sugere que existam.
  const pedido = {
    minimo: Math.max(0, menor - falta - folga),
    maximo: maior + falta + folga,
  };
  if (!base) return pedido;

  //: A UNIÃO: no caso normal a faixa fixa contém o pedido e o eixo NÃO SE MEXE
  //: entre recortes — que é o ponto. No caso extremo ela se abre, e o extremo
  //: aparece.
  return {
    minimo: Math.min(base.minimo, pedido.minimo),
    maximo: Math.max(base.maximo, pedido.maximo),
  };
}

/** A faixa do eixo DIREITO: o índice reputacional, FIXA em 0–100.
 *
 *  FIXA, E NÃO AUTOMÁTICA — e esta é a decisão que faz o gráfico de dois eixos
 *  não mentir. Com régua automática, trocar o período de 3M para 6M mudaria a
 *  FORMA da curva do índice sem o dado ter mudado, e a coincidência visual
 *  entre ela e a curva do bond passaria a ser artefato do recorte: dá para
 *  "criar" correlação só escolhendo os limites.
 *
 *  O dono do produto escolheu os dois eixos sabendo disso (a alternativa
 *  oferecida foi indexar tudo a uma base comum). Fixar a escala é o que resta
 *  para que a comparação signifique a mesma coisa em todo recorte.
 *
 *  0–100 E NÃO 40–80, que era a premissa do mockup: o índice é definido de 0 a
 *  100, e uma janela estreita escolhida por como os dados estão HOJE volta a
 *  ser uma régua que muda de significado quando eles mudarem. */
export const INDICE_MINIMO = 0;
export const INDICE_MAXIMO = 100;

export function faixaDoIndice(): FaixaDoEixo {
  return { minimo: INDICE_MINIMO, maximo: INDICE_MAXIMO };
}