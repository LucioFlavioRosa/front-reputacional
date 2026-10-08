// @vitest-environment jsdom

/** O balão do "?" é texto corrido, mesmo dentro de um rótulo em caixa alta. */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Ajuda } from '@/componentes/basicos';

describe('Ajuda', () => {
  it('não herda a caixa alta do rótulo onde mora', () => {
    render(
      <span className="kicker" style={{ textTransform: 'uppercase' }}>
        Pico
        <Ajuda texto="O maior valor da janela." />
      </span>,
    );
    fireEvent.mouseEnter(screen.getByRole('img', { name: 'Ajuda' }));
    const balao = screen.getByRole('tooltip');
    expect(balao.style.textTransform).toBe('none');
    expect(balao.style.letterSpacing).toBe('normal');
  });
});
