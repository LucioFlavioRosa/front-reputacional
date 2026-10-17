// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { GrupoDoExplorador } from '@/api/cliente';

function grupo(parcial: Partial<GrupoDoExplorador>): GrupoDoExplorador {
  return {
    n1: null,
    n2: null,
    n3: null,
    uf: null,
    positivo: 0,
    neutro: 0,
    negativo: 0,
    peso_positivo: 0,
    peso_neutro: 0,
    peso_negativo: 0,
    ...parcial,
  };
}

const obterExploradorDaLente = vi.fn((..._argumentos: unknown[]) =>
  Promise.resolve({
    lente: 'imprensa',
    mes: '2026-08',
    denominador: 10,
    grupos: [
      grupo({ n1: 'Governança', n2: 'Ética', n3: 'Compliance', uf: 'RJ', positivo: 2, peso_positivo: 2 }),
      grupo({ n1: 'Clientes', n2: 'Atendimento', n3: 'Tarifa', uf: 'SP', negativo: 3, peso_negativo: 3 }),
      grupo({ n1: 'Clientes', n2: 'Atendimento', n3: 'Fila', uf: 'SP', neutro: 5, peso_neutro: 5 }),
    ],
  }),
);

vi.mock('@/api/cliente', () => ({
  obterExploradorDaLente: (...argumentos: unknown[]) => obterExploradorDaLente(...argumentos),
}));

import { ExploradorDaLente } from '@/paginas/score/ExploradorDaLente';

beforeAll(() => {
  //: O MAPA MEDE A PRÓPRIA LARGURA; o jsdom não tem ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

function coluna(titulo: string) {
  return screen.getByRole('heading', { name: titulo }).parentElement!.parentElement as HTMLElement;
}

describe('N1 › N2 › N3 e o mapa por UF', () => {
  it('pede com o filtro da tela e ordena do maior para o menor, com o impacto', async () => {
    render(<ExploradorDaLente codigo="imprensa" mes="2026-08" filtro={{ tier: 'relevante' }} />);
    await screen.findByRole('heading', { name: 'Atributo (N1)' });
    expect(obterExploradorDaLente).toHaveBeenCalledWith('imprensa', '2026-08', { tier: 'relevante' });
    const n1 = within(coluna('Atributo (N1)')).getAllByRole('button');
    expect(n1.map((b) => b.getAttribute('aria-label')?.split(':')[0])).toEqual(['Clientes', 'Governança']);
    // Clientes: −3 negativo ponderado sobre D = 10 → −15 pontos.
    expect(n1[0].getAttribute('aria-label')).toContain('−15,0 pts');
  });

  it('o ranking por UF vai da que tem MAIS matérias para a que tem menos', async () => {
    render(<ExploradorDaLente codigo="imprensa" mes="2026-08" filtro={{}} />);
    await screen.findByText('UF · matérias');
    const ranking = screen.getByText('UF · matérias').parentElement!.parentElement!;
    const texto = ranking.textContent ?? '';
    // SP tem 8 matérias, RJ tem 2: SP vem antes, mesmo com score menor.
    expect(texto.indexOf('São Paulo')).toBeLessThan(texto.indexOf('Rio de Janeiro'));
  });

  it('clicar num N1 filtra o N3 e o mapa, e clicar de novo desfaz', async () => {
    render(<ExploradorDaLente codigo="imprensa" mes="2026-08" filtro={{}} />);
    await screen.findByRole('heading', { name: 'Subtema (N3)' });
    expect(within(coluna('Subtema (N3)')).getAllByRole('button')).toHaveLength(3);

    await userEvent.click(screen.getByRole('button', { name: /^Governança:/ }));
    expect(within(coluna('Subtema (N3)')).getAllByRole('button')).toHaveLength(1);
    // O próprio N1 continua inteiro, com o escolhido marcado.
    expect(within(coluna('Atributo (N1)')).getAllByRole('button')).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: /^Governança:/ }).getAttribute('aria-pressed'),
    ).toBe('true');
    // O RANKING ao lado do mapa só com o RJ (score 100: tudo propositivo).
    const ranking = screen.getByText('UF · matérias').parentElement!.parentElement!;
    expect(ranking.textContent).toContain('Rio de Janeiro');
    expect(ranking.textContent).toContain('100');
    expect(ranking.textContent).not.toContain('São Paulo');

    await userEvent.click(screen.getByRole('button', { name: /^Governança:/ }));
    expect(within(coluna('Subtema (N3)')).getAllByRole('button')).toHaveLength(3);
  });
});
