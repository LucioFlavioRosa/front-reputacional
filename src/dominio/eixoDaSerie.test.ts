/** A régua do NSS, que saiu de dentro de `GraficoDeLinha`.
 *
 *  O QUE ESTE ARQUIVO PROTEGE: o que a pessoa lê como TAMANHO da variação. Uma
 *  régua errada não quebra nada — ela faz um degrau de quinze pontos parecer
 *  linha reta, ou faz ruído de dois pontos parecer virada. Não há exceção para
 *  acusar, então só teste pega.
 *
 *  OS VALORES ESPERADOS FORAM CALCULADOS À MÃO a partir da conta que já estava
 *  no componente, e não lidos da saída da função: um teste que afirma o que a
 *  implementação devolveu não prova que ela está certa, só que não mudou.
 */

import { describe, expect, it } from 'vitest';

import {
  AMPLITUDE_MINIMA_DA_FOLGA,
  FRACAO_DE_FOLGA,
  NSS_MAXIMO,
  NSS_MINIMO,
  dominioDoNss,
} from '@/dominio/eixoDaSerie';

describe('dominioDoNss', () => {
  it('a régua nasce dos valores, com 25% de folga nas duas pontas', () => {
    /* 20..60: amplitude 60 (porque o zero entra), folga round(60 × 0,25) = 15.
       Piso = 0 − 15 = −15. Teto = 60 + 15 = 75. */
    expect(dominioDoNss([20, 40, 60])).toEqual({ minimo: -15, maximo: 75 });
  });

  it('o ZERO entra sempre, mesmo numa série inteiramente positiva', () => {
    /* É a diferença que separa esta régua da do índice: o NSS é SALDO, e um
       eixo que não mostra o zero não diz de que lado o saldo está. Se o zero
       não entrasse, o piso sairia de 40 e não de 0. */
    const faixa = dominioDoNss([40, 45, 50]);
    expect(faixa.minimo).toBeLessThanOrEqual(0);
    expect(faixa.minimo).toBe(-13); // amplitude 50, folga round(12,5) = 13
  });

  it('o zero entra também numa série inteiramente negativa', () => {
    expect(dominioDoNss([-40, -45, -50])).toEqual({ minimo: -63, maximo: 13 });
  });

  it('nunca passa de −100/+100, que é o limite natural do saldo', () => {
    /* Com a série nos extremos, a folga empurraria o eixo para fora da escala
       do NSS e sugeriria um valor que não pode existir. */
    expect(dominioDoNss([-100, 100])).toEqual({ minimo: NSS_MINIMO, maximo: NSS_MAXIMO });
    expect(dominioDoNss([-95, 98]).minimo).toBe(NSS_MINIMO);
    expect(dominioDoNss([-95, 98]).maximo).toBe(NSS_MAXIMO);
  });

  it('a linha de referência entra na conta e nunca fica fora do eixo', () => {
    /* A tracejada é o comparativo "este período contra a média do recorte". Se
       ela não entrasse na régua, sairia da área visível e o comparativo
       desapareceria sem aviso. */
    const sem = dominioDoNss([10, 12]);
    const com = dominioDoNss([10, 12], { referencia: 80 });
    expect(sem.maximo).toBeLessThan(80);
    expect(com.maximo).toBeGreaterThanOrEqual(80);
  });

  it('a referência negativa também abre o eixo para baixo', () => {
    expect(dominioDoNss([10, 12], { referencia: -70 }).minimo).toBeLessThanOrEqual(-70);
  });

  it('minimo e maximo explícitos vencem a régua automática, um lado por vez', () => {
    /* Serve para comparar dois gráficos lado a lado na mesma escala. */
    expect(dominioDoNss([20, 60], { minimo: -100 })).toEqual({ minimo: -100, maximo: 75 });
    expect(dominioDoNss([20, 60], { maximo: 100 })).toEqual({ minimo: -15, maximo: 100 });
  });

  it('zero explícito é respeitado, e não confundido com ausência', () => {
    /* `minimo ?? …`, e não `minimo || …`: com `||`, um zero pedido de
       propósito cairia na régua automática. */
    expect(dominioDoNss([20, 60], { minimo: 0 }).minimo).toBe(0);
    expect(dominioDoNss([-20, -60], { maximo: 0 }).maximo).toBe(0);
  });

  it('referência igual a zero entra na conta em vez de ser ignorada', () => {
    /* Mesma armadilha do caso acima, do outro lado: `referencia == null` e não
       `!referencia`. Com uma série positiva o resultado é o mesmo (o zero já
       entra sempre), então o caso que prova é a função não estourar. */
    expect(dominioDoNss([20, 60], { referencia: 0 })).toEqual({ minimo: -15, maximo: 75 });
  });

  it('série vazia devolve uma faixa válida em volta do zero, e não NaN', () => {
    /* `Math.min(0, ...[])` é 0 — o eixo fica simétrico na folga mínima. Um NaN
       aqui propagaria para toda posição de ponto e o gráfico sairia em branco
       sem erro. */
    const faixa = dominioDoNss([]);
    expect(faixa).toEqual({ minimo: -3, maximo: 3 });
    expect(Number.isNaN(faixa.minimo)).toBe(false);
    expect(Number.isNaN(faixa.maximo)).toBe(false);
  });

  it('o piso de amplitude entra na FOLGA, e não na altura do eixo', () => {
    /* A DISCREPÂNCIA REGISTRADA: a constante se chama "amplitude mínima" e o
       comentário original dizia "amplitude mínima do eixo", mas ela entra só no
       cálculo da folga. Série inteira em zero dá eixo de −3 a +3 (6 pontos de
       altura), e NÃO os 10 que o nome promete.

       ESTE TESTE FIXA O COMPORTAMENTO REAL, não o prometido: a conta veio do
       componente sem mudar um caractere, e alterá-la mudaria a altura da curva
       em toda tela que mostra NSS — decisão de produto, não de refatoração. Se
       alguém decidir mudar, é aqui que o teste falha e pede a decisão. */
    expect(AMPLITUDE_MINIMA_DA_FOLGA).toBe(10);
    const folgaEsperada = Math.round(AMPLITUDE_MINIMA_DA_FOLGA * FRACAO_DE_FOLGA);
    expect(folgaEsperada).toBe(3);
    expect(dominioDoNss([0, 0, 0])).toEqual({ minimo: -3, maximo: 3 });
    expect(dominioDoNss([2, 3])).toEqual({ minimo: -3, maximo: 6 });
  });

  it('o piso vem antes do teto em qualquer entrada', () => {
    /* Um eixo invertido desenha a curva de cabeça para baixo. */
    const casos: number[][] = [[], [0], [-100], [100], [-100, 100], [5, 5], [-1, 1], [99, -99]];
    for (const valores of casos) {
      const { minimo, maximo } = dominioDoNss(valores);
      expect(minimo).toBeLessThan(maximo);
    }
  });
});
