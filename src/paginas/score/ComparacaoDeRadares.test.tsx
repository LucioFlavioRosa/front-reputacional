// @vitest-environment jsdom

/** Dois radares, cada um com o seu mês: por padrão o escolhido e o anterior. */

import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { IndiceDoScore } from '@/dominio/score';

const NOTAS: Record<string, number> = { '2026-07': 60, '2026-08': 64 };

vi.mock('@/api/cliente', () => ({
  obterScore: vi.fn((mes: string) =>
    Promise.resolve({
      mes,
      isr: NOTAS[mes],
      faixa: 'Estável',
      calibracao: { radial_por_peso: false },
      lentes: [
        {
          codigo: 'imprensa',
          nome: 'Imprensa',
          stakeholder: 'Formadores de opinião',
          peso: 30,
          peso_efetivo: 100,
          score: NOTAS[mes],
          ns: null,
          delta: null,
          fontes: [],
          estimado: false,
          ausencia: null,
        },
      ],
    } as unknown as IndiceDoScore),
  ),
}));

import { obterScore } from '@/api/cliente';
import { ComparacaoDeRadares } from '@/paginas/score/ComparacaoDeRadares';

describe('ComparacaoDeRadares', () => {
  it('à direita o mês escolhido, à esquerda o anterior, e a variação entre os dois', async () => {
    render(
      <ComparacaoDeRadares
        meses={['2026-06', '2026-07', '2026-08']}
        sugerido={null}
        mesAtual="2026-08"
        aoAbrirLente={() => {}}
      />,
    );
    //: NASCE ESCONDIDA, e fechada não busca nada.
    expect(vi.mocked(obterScore)).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /Comparação de períodos/ }));
    await waitFor(() => expect(screen.getByText(/no índice vs\. o período/)).toBeTruthy());
    expect(vi.mocked(obterScore).mock.calls.map(([mes]) => mes).sort()).toEqual(['2026-07', '2026-08']);
    expect(screen.getAllByRole('group', { name: 'Mês do índice' })).toHaveLength(2);
    expect(screen.getAllByText('+4').length).toBeGreaterThan(0);
  });
});
