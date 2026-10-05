/** O eixo que se move em vez de saltar.
 *
 *  O PEDIDO: "preciso que (...) tenha transições suaves e estáveis mês a mês". O
 *  eixo da Jornada é adaptativo, então ele MUDA — quando um mês novo entra na
 *  base, e quando se escolhe uma lente para comparar. Hoje essa mudança é um
 *  corte: a curva inteira aparece noutro lugar, e quem estava lendo um degrau
 *  perde a referência do que mudou, o dado ou a régua.
 *
 *  A CONTA FICA AQUI, fora do componente, pelo mesmo motivo que o resto da
 *  jornada: interpolação com amortecimento é aritmética, e aritmética dentro de
 *  JSX é aritmética que ninguém revisa.
 */

import { describe, expect, it } from 'vitest';

import { DURACAO_DA_TRANSICAO, entre, suavidade } from '@/dominio/dominioSuave';

describe('suavidade', () => {
  it('começa e termina parada', () => {
    //: É O QUE SEPARA "SUAVE" DE "RÁPIDO". Uma interpolação linear chega ao fim
    //: na mesma velocidade com que saiu, e o olho lê isso como um corte no fim.
    expect(suavidade(0)).toBe(0);
    expect(suavidade(1)).toBe(1);
    expect(suavidade(0.5)).toBeCloseTo(0.5, 6);
  });

  it('acelera no começo e freia no fim', () => {
    const inicio = suavidade(0.1) - suavidade(0);
    const meio = suavidade(0.55) - suavidade(0.45);
    const fim = suavidade(1) - suavidade(0.9);

    expect(meio).toBeGreaterThan(inicio);
    expect(meio).toBeGreaterThan(fim);
    //: SIMÉTRICA: o freio no fim espelha a largada.
    expect(inicio).toBeCloseTo(fim, 6);
  });

  it('nunca escapa de 0..1, mesmo recebendo lixo', () => {
    expect(suavidade(-1)).toBe(0);
    expect(suavidade(2)).toBe(1);
  });
});

describe('entre', () => {
  it('no começo é o domínio de onde se sai; no fim, o de chegada', () => {
    const de = { piso: 25, teto: 70 };
    const para = { piso: 45, teto: 100 };

    expect(entre(de, para, 0)).toEqual(de);
    expect(entre(de, para, 1)).toEqual(para);
  });

  it('no meio do caminho, está no meio dos dois', () => {
    const meio = entre({ piso: 0, teto: 100 }, { piso: 20, teto: 60 }, 0.5);

    expect(meio.piso).toBeCloseTo(10, 6);
    expect(meio.teto).toBeCloseTo(80, 6);
  });

  it('a amplitude nunca colapsa no caminho', () => {
    //: O QUE ISTO TRAVA: um piso que ultrapassa o teto no meio da transição
    //: inverte o eixo, e a curva aparece de cabeça para baixo por um quadro.
    //: Interpolando os dois juntos isso não acontece, e o teste é o que garante
    //: que continue não acontecendo.
    const de = { piso: 0, teto: 100 };
    const para = { piso: 60, teto: 65 };

    for (let t = 0; t <= 1; t += 0.05) {
      const passo = entre(de, para, t);
      expect(passo.teto).toBeGreaterThan(passo.piso);
    }
  });
});

describe('DURACAO_DA_TRANSICAO', () => {
  it('é curta o suficiente para não atrasar a leitura', () => {
    //: ACIMA DE MEIO SEGUNDO a transição deixa de ser ajuda e passa a ser espera:
    //: quem clicou numa lente para comparar fica olhando o eixo se mexer antes de
    //: poder ler. Abaixo de 200ms ela não é percebida como movimento, e volta a
    //: ser o corte que ela existe para evitar.
    expect(DURACAO_DA_TRANSICAO).toBeGreaterThanOrEqual(200);
    expect(DURACAO_DA_TRANSICAO).toBeLessThanOrEqual(500);
  });
});
