// @vitest-environment jsdom

/** O termômetro de clima abaixo do Ranking por porta-voz. */

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TermometroDeClima } from '@/graficos/TermometroDeClima';

const FATIAS = [
  { chave: 'propositivo', rotulo: 'Positivo', total: 6 },
  { chave: 'neutro', rotulo: 'Neutro', total: 2 },
  { chave: 'tenso', rotulo: 'Negativo', total: 2 },
];

describe('TermometroDeClima', () => {
  it('mostra o saldo (positivas − negativas) ÷ total e o percentual de cada fatia', () => {
    render(<TermometroDeClima fatias={FATIAS} />);
    expect(screen.getByLabelText('Saldo de clima +40')).toBeTruthy();
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'Negativo 20%, Neutro 20%, Positivo 60%',
    );
  });

  it('clicar numa fatia filtra por aquele clima', async () => {
    const aoClicar = vi.fn();
    render(<TermometroDeClima fatias={FATIAS} aoClicar={aoClicar} />);
    await userEvent.click(screen.getByTitle(/^Negativo: 20%/));
    expect(aoClicar).toHaveBeenCalledWith('tenso');
  });

  it('sem clima registrado, diz isso em vez de desenhar uma barra vazia', () => {
    render(<TermometroDeClima fatias={FATIAS.map((f) => ({ ...f, total: 0 }))} />);
    expect(screen.getByText('Nenhuma interação com clima registrado neste recorte.')).toBeTruthy();
  });
});
