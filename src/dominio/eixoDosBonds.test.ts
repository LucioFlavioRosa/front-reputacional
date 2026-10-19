/** A terceira régua: o eixo da cotação de bonds e o do índice.
 *
 *  O cabeçalho de `eixoDaSerie.ts` deixou três perguntas formuladas para quem
 *  escrevesse esta régua. Este arquivo prende as três respostas — porque elas
 *  decidem o que a pessoa VÊ como tamanho da variação, e uma régua errada não
 *  quebra nada: só faz ruído parecer virada, ou o contrário.
 */

import { describe, expect, it } from 'vitest';

import {
  AMPLITUDE_MINIMA_DOS_BONDS,
  dominioDosBonds,
  FAIXA_FIXA_DO_PRECO,
  FAIXA_FIXA_DO_YIELD,
  faixaDoIndice,
  INDICE_MAXIMO,
  INDICE_MINIMO,
} from '@/dominio/eixoDaSerie';

describe('o eixo esquerdo: cotação de bonds', () => {
  it('não prende em 0–100 — preço acima do par é dado real', () => {
    /** Medido no export de 16/10/2026: o maior preço é 111,2048. Uma régua de
     *  0 a 100 como a do índice recusaria o papel que negocia com ágio. */
    const faixa = dominioDosBonds([108, 111.2048, 109.5]);

    expect(faixa.maximo).toBeGreaterThan(111.2048);
  });

  it('não força o par (100) dentro do eixo', () => {
    /** O OPOSTO DA RÉGUA DO NSS, onde o zero entra sempre.
     *
     *  O par é referência conceitual — acima é ágio, abaixo é deságio —, mas
     *  forçá-lo quando a série vive entre 95 e 97 achataria a variação a um
     *  traço. O que o gráfico responde é "quanto se moveu"; o nível está no
     *  painel de cotações ao lado. */
    const faixa = dominioDosBonds([95.2, 96.8, 95.9]);

    expect(faixa.maximo).toBeLessThan(100);
  });

  it('o piso de amplitude impede que ruído pareça virada', () => {
    /** O parâmetro que mais importa aqui.
     *
     *  Preço de bond se move centésimos num dia calmo. Sem piso, uma semana de
     *  ±0,05 preencheria o gráfico inteiro e a diretoria leria uma crise. */
    const faixa = dominioDosBonds([95.0, 95.05, 94.98]);

    expect(faixa.maximo - faixa.minimo).toBeGreaterThanOrEqual(
      AMPLITUDE_MINIMA_DOS_BONDS,
    );
  });

  it('o piso CENTRA a série em vez de esticar para um lado só', () => {
    /** Esticar por um lado deslocaria a curva na vertical sem o dado ter
     *  mudado — e duas cargas do mesmo período desenhariam a linha em alturas
     *  diferentes, que é o tipo de instabilidade que ninguém consegue explicar. */
    const faixa = dominioDosBonds([95.0, 95.2]);
    const centroDaSerie = (95.0 + 95.2) / 2;
    const centroDoEixo = (faixa.minimo + faixa.maximo) / 2;

    expect(Math.abs(centroDoEixo - centroDaSerie)).toBeLessThan(0.001);
  });

  it('a amplitude de verdade VENCE o piso quando é maior', () => {
    /** O controle negativo do piso: ele não pode comprimir uma variação real. */
    const faixa = dominioDosBonds([80, 100]);

    expect(faixa.maximo - faixa.minimo).toBeGreaterThan(20);
  });

  it('nunca desce abaixo de zero', () => {
    /** Preço e yield negativos não existem, e um eixo que começa em −1,2
     *  sugere que existam. */
    const faixa = dominioDosBonds([0.4, 0.5]);

    expect(faixa.minimo).toBeGreaterThanOrEqual(0);
  });

  it('série VAZIA devolve faixa utilizável, e não Infinity', () => {
    /** `Math.min()` sem argumento devolve `Infinity`, e isso vira um SVG com
     *  coordenadas `NaN`: um gráfico em branco SEM erro no console, que é o
     *  pior jeito de não funcionar. A tela renderiza o eixo antes de o dado
     *  chegar. */
    const faixa = dominioDosBonds([]);

    expect(Number.isFinite(faixa.minimo)).toBe(true);
    expect(Number.isFinite(faixa.maximo)).toBe(true);
    expect(faixa.maximo).toBeGreaterThan(faixa.minimo);
  });

  it('um ponto só também produz faixa, com o piso em volta dele', () => {
    const faixa = dominioDosBonds([95.5]);

    expect(faixa.maximo - faixa.minimo).toBeGreaterThanOrEqual(
      AMPLITUDE_MINIMA_DOS_BONDS,
    );
    expect(faixa.minimo).toBeLessThan(95.5);
    expect(faixa.maximo).toBeGreaterThan(95.5);
  });
});

describe('o eixo direito: o índice', () => {
  it('é FIXO, e não nasce dos valores', () => {
    /** A DECISÃO QUE FAZ O GRÁFICO DE DOIS EIXOS NÃO MENTIR.
     *
     *  Com régua automática, trocar o período de 3M para 6M mudaria a FORMA da
     *  curva do índice sem o dado ter mudado — e a coincidência visual entre
     *  ela e a curva do bond passaria a ser artefato do recorte. Dá para
     *  "criar" correlação só escolhendo os limites, e é por isso que misturar
     *  duas escalas é o erro de leitura mais comum em dataviz.
     *
     *  O dono do produto escolheu os dois eixos sabendo disso; a alternativa
     *  oferecida foi indexar tudo a uma base comum. Fixar a escala é o que
     *  resta para a comparação significar a mesma coisa em todo recorte. */
    expect(faixaDoIndice()).toEqual({ minimo: 0, maximo: 100 });
  });

  it('a faixa é 0–100, e não a janela estreita do mockup', () => {
    /** O mockup usava 40–80, escolhido por como os dados estavam na época.
     *  Uma janela assim volta a ser uma régua que muda de significado quando
     *  os dados mudarem — e aí ninguém lembra por que ela era aquela. */
    expect(INDICE_MINIMO).toBe(0);
    expect(INDICE_MAXIMO).toBe(100);
  });

  it('a mesma faixa para qualquer período — é o ponto', () => {
    expect(faixaDoIndice()).toEqual(faixaDoIndice());
  });
});


describe('a faixa fixa da métrica: o eixo esquerdo também para de se reformar', () => {
  /** O CONSERTO DE UM RACIOCÍNIO MEU, apontado por revisão.
   *
   *  Eu havia fixado só o eixo DIREITO e descrito isso como "o que impede o
   *  gráfico de mentir". Está incompleto: com o esquerdo automático, trocar o
   *  período de 3M para 6M ainda muda a FORMA da curva dos bonds, então a
   *  coincidência visual entre as duas curvas continua sendo artefato do
   *  recorte. Fixar um eixo resolve metade e descreve o todo.
   */

  it('dois recortes diferentes dão o MESMO eixo quando o dado cabe na faixa', () => {
    const tresMeses = dominioDosBonds([95.2, 96.1], FAIXA_FIXA_DO_PRECO);
    const seisMeses = dominioDosBonds([94.8, 97.4, 95.0, 96.9], FAIXA_FIXA_DO_PRECO);

    expect(tresMeses).toEqual(seisMeses);
    expect(tresMeses).toEqual(FAIXA_FIXA_DO_PRECO);
  });

  it('a faixa SE ABRE quando o dado sai dela', () => {
    /** FIXA, MAS NÃO RÍGIDA: uma faixa que ignora o dado esconderia um papel em
     *  colapso — e é exatamente nessa hora que alguém olha o gráfico. */
    const faixa = dominioDosBonds([111.2048], FAIXA_FIXA_DO_PRECO);

    expect(faixa.maximo).toBeGreaterThan(111.2048);
    expect(faixa.minimo).toBe(FAIXA_FIXA_DO_PRECO.minimo);
  });

  it('o colapso aparece: um papel a 40 abre a ponta de baixo', () => {
    const faixa = dominioDosBonds([40, 42], FAIXA_FIXA_DO_PRECO);

    expect(faixa.minimo).toBeLessThan(40);
    expect(faixa.maximo).toBe(FAIXA_FIXA_DO_PRECO.maximo);
  });

  it('a faixa do yield contém o caso normal da Aegea', () => {
    /** Medido: os bonds da Aegea têm yield entre 7 e 9. */
    const faixa = dominioDosBonds([7.2, 9.1], FAIXA_FIXA_DO_YIELD);

    expect(faixa).toEqual(FAIXA_FIXA_DO_YIELD);
  });

  it('o par em aflição abre a faixa do yield, que é o certo', () => {
    /** Medido: o maior yield de toda a base é 61,93 — e é ele a notícia. */
    const faixa = dominioDosBonds([61.93], FAIXA_FIXA_DO_YIELD);

    expect(faixa.maximo).toBeGreaterThan(61.93);
  });

  it('SEM faixa fixa volta ao automático — quem plota métrica nova', () => {
    const comFaixa = dominioDosBonds([95.2, 96.1], FAIXA_FIXA_DO_PRECO);
    const semFaixa = dominioDosBonds([95.2, 96.1]);

    expect(semFaixa).not.toEqual(comFaixa);
    expect(semFaixa.maximo).toBeLessThan(FAIXA_FIXA_DO_PRECO.maximo);
  });

  it('série vazia devolve a faixa fixa, e não a simbólica', () => {
    /** A tela renderiza o eixo antes de o dado chegar, e o eixo tem de nascer
     *  na régua que vai valer — senão a curva "salta" quando o dado entra. */
    expect(dominioDosBonds([], FAIXA_FIXA_DO_PRECO)).toEqual(FAIXA_FIXA_DO_PRECO);
  });
});