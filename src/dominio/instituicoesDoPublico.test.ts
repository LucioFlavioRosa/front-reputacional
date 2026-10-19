import { describe, expect, it } from 'vitest';

import { instituicoesDoPublico } from '@/dominio/derivacoes';
import type { Catalogo } from '@/dominio/derivacoes';
import type { Interacao } from '@/dominio/tipos';

const catalogo = {
  instituicoes: new Map([
    ['a', { id: 'a', nome: 'Banco A', categoria_publico_id: 1 }],
    ['b', { id: 'b', nome: 'Banco B', categoria_publico_id: 1 }],
    ['c', { id: 'c', nome: 'Câmara C', categoria_publico_id: 2 }],
  ]),
} as unknown as Catalogo;

const interacao = (instituicao_id: string, clima: string | null) =>
  ({ instituicao_id, clima }) as unknown as Interacao;

describe('instituicoesDoPublico (Termômetro por público)', () => {
  it('lista as instituições do público, da que mais se falou para a que menos, com o placar', () => {
    const lista = instituicoesDoPublico(
      [
        interacao('a', 'propositivo'),
        interacao('b', 'tenso'),
        interacao('b', null),
        interacao('b', 'tenso'),
        interacao('c', 'propositivo'),
      ],
      catalogo,
      1,
    );
    expect(lista).toEqual([
      // O volume conta toda interação; o placar, só as com termômetro.
      { nome: 'Banco B', total: 3, score: -100 },
      { nome: 'Banco A', total: 1, score: 100 },
    ]);
  });

  it('para no teto pedido, e sem termômetro o placar é nulo', () => {
    const lista = instituicoesDoPublico([interacao('a', null), interacao('b', null)], catalogo, 1, 1);
    expect(lista).toEqual([{ nome: 'Banco A', total: 1, score: null }]);
  });
});
