/** Os limites dos detectores de sinal, como a Calibração os grava.
 *
 *  A REGRA QUE ESTE ARQUIVO TRAVA É A DO QUE *NÃO* SE GRAVA. O servidor manda
 *  os oito limites — os ajustados e os de fábrica — e a tela devolve só o que
 *  foi mexido. Gravar os oito sempre faria toda calibração parecer ajustada, e
 *  o chip "régua ajustada" ficaria aceso para sempre, inclusive depois de
 *  alguém restaurar tudo.
 */

import { describe, expect, it } from 'vitest';

import { comLimiteAjustado, comoLimite, limitesAjustados } from '@/dominio/score';
import type { LimiteDaCalibracao } from '@/dominio/score';

function limite(parcial: Partial<LimiteDaCalibracao>): LimiteDaCalibracao {
  return {
    chave: 'virada_pontos',
    rotulo: 'Virada · pontos de nota',
    explicacao: 'Quantos pontos a nota precisa andar de um mês para o outro.',
    valor: 10,
    padrao: 10,
    formato: 'inteiro',
    unidade: 'pontos',
    ...parcial,
  };
}

const REGUA = [
  limite({}),
  limite({ chave: 'pico_desvios', valor: 1.5, padrao: 1.5, formato: 'decimal' }),
];

describe('limitesAjustados', () => {
  it('não devolve nada quando a régua é a de fábrica', () => {
    expect(limitesAjustados(REGUA)).toEqual({});
  });

  it('devolve só o que foi mexido', () => {
    const mexido = [limite({ valor: 6 }), REGUA[1]];
    expect(limitesAjustados(mexido)).toEqual({ virada_pontos: 6 });
  });

  it('não devolve nada de uma lista vazia', () => {
    expect(limitesAjustados([])).toEqual({});
  });
});

describe('comLimiteAjustado', () => {
  it('acrescenta o limite mexido aos que já estavam', () => {
    const mexido = [limite({ valor: 6 }), REGUA[1]];
    expect(comLimiteAjustado(mexido, 'pico_desvios', 2)).toEqual({
      virada_pontos: 6,
      pico_desvios: 2,
    });
  });

  it('TIRA A CHAVE ao voltar para o valor de fábrica', () => {
    // Gravá-la igual ao padrão faria "restaurei este limite" e "nunca toquei
    // nele" serem estados diferentes no banco, dizendo a mesma coisa.
    const mexido = [limite({ valor: 6 }), REGUA[1]];
    expect(comLimiteAjustado(mexido, 'virada_pontos', 10)).toEqual({});
  });

  it('ignora uma chave que a régua não tem', () => {
    expect(comLimiteAjustado(REGUA, 'inventado', 3)).toEqual({});
  });
});

describe('comoLimite', () => {
  it('aceita a vírgula do teclado brasileiro', () => {
    // `<input type="number">` recusa "1,5" e devolve string vazia: o campo
    // apagaria sozinho enquanto a pessoa digita.
    expect(comoLimite('1,5', 'decimal')).toBe(1.5);
  });

  it('arredonda onde a casa decimal não significa nada', () => {
    // "3,5 meses seguidos" não é uma tendência de três meses e meio.
    expect(comoLimite('3,5', 'inteiro')).toBe(4);
  });

  it('recusa o que não é número', () => {
    expect(comoLimite('abc', 'decimal')).toBeNull();
    expect(comoLimite('', 'decimal')).toBeNull();
    expect(comoLimite('   ', 'decimal')).toBeNull();
  });

  it('recusa o que ARREDONDA para zero num campo inteiro', () => {
    // Validando antes de arredondar, "0,4" passaria daqui como 0,4, viraria 0
    // e o servidor o recusaria — deixando o campo preso num erro que a tela
    // tinha como evitar.
    expect(comoLimite('0,4', 'inteiro')).toBeNull();
    expect(comoLimite('0,4', 'decimal')).toBe(0.4);
  });

  it('recusa o zero e o negativo', () => {
    // TODO CORTE É DIVISOR de alguma intensidade: um zero gravado estouraria
    // horas depois, na tela de outra pessoa abrindo uma lente.
    expect(comoLimite('0', 'decimal')).toBeNull();
    expect(comoLimite('-2', 'decimal')).toBeNull();
  });
});
