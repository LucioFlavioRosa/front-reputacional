/** A cor forte de cada lente passa de 4:1 sobre o branco — título e linha fina. */

import { describe, expect, it } from 'vitest';

import { CORES_FORTES_DA_LENTE, corForteDaLente } from '@/dominio/score';

const luminancia = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe('cores fortes das lentes', () => {
  it.each(Object.entries(CORES_FORTES_DA_LENTE))('%s tem contraste de pelo menos 4:1 no branco', (_lente, cor) => {
    expect(1.05 / (luminancia(cor) + 0.05)).toBeGreaterThanOrEqual(4);
  });

  it('lente desconhecida cai no azul da marca', () => {
    expect(corForteDaLente('outra')).toBe('var(--azul-mar)');
  });
});
