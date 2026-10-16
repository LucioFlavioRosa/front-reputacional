import { describe, expect, it } from 'vitest';

import { ordenarPeloTotal, topoDaEscala, totalDa } from '@/dominio/colunasEmpilhadas';

const coluna = (rotulo: string, positivo: number, neutro: number, negativo: number) => ({
  rotulo,
  positivo,
  neutro,
  negativo,
});

describe('colunas empilhadas', () => {
  it('ordena pelo total, do maior para o menor; no empate, pelo nome', () => {
    const ordem = ordenarPeloTotal([
      coluna('Inovação', 1, 0, 0),
      coluna('Governança', 2, 3, 5),
      coluna('Ambiental', 0, 0, 1),
      coluna('Social', 4, 0, 6),
    ]).map((c) => c.rotulo);
    expect(ordem).toEqual(['Governança', 'Social', 'Ambiental', 'Inovação']);
  });

  it('o topo da escala é o maior total, e nunca zero', () => {
    expect(topoDaEscala([coluna('a', 1, 2, 3), coluna('b', 0, 0, 1)])).toBe(6);
    expect(topoDaEscala([])).toBe(1);
    expect(totalDa(coluna('a', 1, 2, 3))).toBe(6);
  });
});
