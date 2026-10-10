import { describe, expect, it } from 'vitest';

import { DADOS } from './dados/fixtures/ilustrativo';
import {
  MENOS,
  arred,
  corDoSinal,
  faixaDe,
  fmtDataCurta,
  fmtDataLonga,
  fmtDelta,
  fmtInt,
  fmtPct,
  fmtPt,
  fmtPtCurto,
  fmtPtItem,
  fmtSaldo,
} from './formatacao';

describe('MENOS', () => {
  it('é o caractere U+2212, nunca o hífen', () => {
    expect(MENOS).toBe('−');
    expect(MENOS).not.toBe('-');
  });
});

describe('arred (C.5)', () => {
  it('arredonda meio para cima', () => {
    expect(arred(62.5)).toBe(63);
    expect(arred(0.5)).toBe(1);
    expect(arred(1.005, 2)).toBe(1.01);
    expect(arred(-7.44, 1)).toBe(-7.4);
    expect(arred(2.25, 1)).toBe(2.3);
  });

  it('o índice geral das 5 lentes dá [55, 63, 53, 49, 51, 49]', () => {
    const isr = [0, 1, 2, 3, 4, 5].map((m) =>
      arred(DADOS.lentes.reduce((s, l) => s + l.peso * (l.serie[m] ?? 0), 0)),
    );
    expect(DADOS.lentes).toHaveLength(5);
    expect(isr).toEqual([55, 63, 53, 49, 51, 49]);
  });
});

describe('fmtPt', () => {
  it('segue a tabela E.2', () => {
    expect(fmtPt(-7.4)).toBe('−7,4 pt');
    expect(fmtPt(1.2)).toBe('+1,2 pt');
    expect(fmtPt(0)).toBe('0,0 pt');
  });

  it('valor que arredonda para zero não leva sinal', () => {
    expect(fmtPt(-0.04)).toBe('0,0 pt');
    expect(fmtPt(0.04)).toBe('0,0 pt');
    expect(fmtPt(-0)).toBe('0,0 pt');
  });

  it('nunca usa hífen', () => {
    expect(fmtPt(-11.1)).not.toContain('-');
  });
});

describe('fmtPtItem', () => {
  it('segue a tabela E.2', () => {
    expect(fmtPtItem(-0.12)).toBe('−0,12');
    expect(fmtPtItem(0.12)).toBe('+0,12');
    expect(fmtPtItem(0)).toBe('0,00');
  });

  it('valor que arredonda para zero mostra 0,00', () => {
    expect(fmtPtItem(-0.004)).toBe('0,00');
  });
});

describe('fmtPtCurto', () => {
  it('1 casa, sem unidade', () => {
    expect(fmtPtCurto(-3.4)).toBe('−3,4');
    expect(fmtPtCurto(0.7)).toBe('+0,7');
    expect(fmtPtCurto(0)).toBe('0,0');
  });
});

describe('fmtInt e fmtPct', () => {
  it('segue a tabela E.2', () => {
    expect(fmtInt(18420)).toBe('18.420');
    expect(fmtPct(61)).toBe('61%');
  });

  it('milhar em números maiores e menos com U+2212', () => {
    expect(fmtInt(1234567)).toBe('1.234.567');
    expect(fmtInt(96)).toBe('96');
    expect(fmtInt(0)).toBe('0');
    expect(fmtInt(-1284)).toBe('−1.284');
  });
});

describe('fmtSaldo', () => {
  it('segue a tabela E.2', () => {
    expect(fmtSaldo(14, 50)).toBe('−36');
  });

  it('positivo leva +, zero não leva sinal', () => {
    expect(fmtSaldo(50, 27)).toBe('+23');
    expect(fmtSaldo(20, 20)).toBe('0');
  });
});

describe('fmtDelta', () => {
  it('segue a tabela E.2', () => {
    expect(fmtDelta(-6)).toEqual({ texto: '▼ 6 pt', cor: 'var(--erro-fg)' });
    expect(fmtDelta(4)).toEqual({ texto: '▲ 4 pt', cor: 'var(--ok-fg)' });
  });

  it('zero não tem seta', () => {
    expect(fmtDelta(0)).toEqual({ texto: '0 pt', cor: 'var(--cinza-3)' });
  });
});

describe('datas', () => {
  it('segue a tabela E.2', () => {
    expect(fmtDataCurta('2026-08-12')).toBe('12/08');
    expect(fmtDataLonga('2026-08-12')).toBe('12/08/2026');
  });
});

describe('corDoSinal', () => {
  it('vermelho, verde ou cinza de texto', () => {
    expect(corDoSinal(-0.1)).toBe('var(--erro-fg)');
    expect(corDoSinal(0.1)).toBe('var(--ok-fg)');
    expect(corDoSinal(0)).toBe('var(--cinza-3)');
  });
});

describe('faixaDe (E.1)', () => {
  const casos: [number, string][] = [
    [39, 'critico'],
    [40, 'atencao'],
    [54, 'atencao'],
    [55, 'estavel'],
    [69, 'estavel'],
    [70, 'solido'],
    [84, 'solido'],
    [85, 'referencia'],
  ];

  it.each(casos)('nota %i está na faixa %s', (nota, id) => {
    expect(faixaDe(nota, DADOS.faixas).id).toBe(id);
  });

  it('extremos e nota fracionária', () => {
    expect(faixaDe(0, DADOS.faixas).id).toBe('critico');
    expect(faixaDe(100, DADOS.faixas).id).toBe('referencia');
    expect(faixaDe(54.5, DADOS.faixas).id).toBe('atencao');
  });

  it('rótulos vêm do JSON', () => {
    expect(faixaDe(42, DADOS.faixas).rotulo).toBe('Atenção');
  });
});
