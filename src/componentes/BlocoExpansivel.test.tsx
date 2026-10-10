// @vitest-environment jsdom

/** O bloco abre e fecha pelo cabeçalho, e fechado não monta o conteúdo. */

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { BlocoExpansivel } from '@/componentes/BlocoExpansivel';

function Bloco() {
  const [aberto, definirAberto] = useState(false);
  return (
    <BlocoExpansivel titulo="Síntese executiva" aberto={aberto} aoAlternar={() => definirAberto(!aberto)}>
      <p>os gráficos</p>
    </BlocoExpansivel>
  );
}

describe('BlocoExpansivel', () => {
  it('nasce fechado, sem montar o conteúdo, e abre pelo cabeçalho', async () => {
    render(<Bloco />);
    const cabecalho = screen.getByRole('button', { name: /Síntese executiva/ });
    expect(cabecalho.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('os gráficos')).toBeNull();

    await userEvent.click(cabecalho);
    expect(cabecalho.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('os gráficos')).toBeTruthy();

    await userEvent.click(cabecalho);
    expect(screen.queryByText('os gráficos')).toBeNull();
  });
});
