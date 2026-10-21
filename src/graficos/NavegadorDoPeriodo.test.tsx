// @vitest-environment jsdom

/** O navegador do período: o gesto em DIAS, e a conta que prende a janela. */

import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { moverJanelaEmDias, prenderJanela } from '@/dominio/cotacoesDosBonds';
import { NavegadorDoPeriodo } from './NavegadorDoPeriodo';

class ObservadorFalso {
  chamar: ResizeObserverCallback;
  constructor(chamar: ResizeObserverCallback) {
    this.chamar = chamar;
  }
  observe() {
    this.chamar(
      [{ contentRect: { width: 1000, height: 52 } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ObservadorFalso);

describe('a conta da janela', () => {
  it('mover não muda o tamanho e não sai do eixo', () => {
    const janela = { de: '2026-08-01', ate: '2026-08-31' };
    expect(moverJanelaEmDias(janela, 7, '2026-01-01', '2026-09-21')).toEqual({
      de: '2026-08-08',
      ate: '2026-09-07',
    });
    //: Encostou no fim: a janela para ali, inteira.
    expect(moverJanelaEmDias(janela, 60, '2026-01-01', '2026-09-21')).toEqual({
      de: '2026-08-22',
      ate: '2026-09-21',
    });
  });

  it('prender corta nas pontas e garante o tamanho mínimo de cinco dias', () => {
    expect(prenderJanela({ de: '2025-01-01', ate: '2026-12-31' }, '2026-01-01', '2026-09-21')).toEqual({
      de: '2026-01-01',
      ate: '2026-09-21',
    });
    expect(prenderJanela({ de: '2026-05-10', ate: '2026-05-11' }, '2026-01-01', '2026-09-21')).toEqual({
      de: '2026-05-10',
      ate: '2026-05-14',
    });
  });
});

describe('o componente', () => {
  const pontos = [
    { data: '2026-01-02', valor: 90 },
    { data: '2026-09-21', valor: 92 },
  ];

  it('mostra o intervalo em texto ao lado', () => {
    const { getByTestId } = render(
      <NavegadorDoPeriodo
        pontos={pontos}
        inicio="2026-01-02"
        fim="2026-09-21"
        janela={{ de: '2026-03-21', ate: '2026-09-21' }}
        aoMudar={() => {}}
      />,
    );
    expect(getByTestId('rotulo-da-janela').textContent).toBe('mar/26 a set/26 · 6 meses');
  });

  it('as setas movem a janela uma semana; Shift + seta estica o fim', () => {
    const mudou: { de: string; ate: string }[] = [];
    const { getByRole } = render(
      <NavegadorDoPeriodo
        pontos={pontos}
        inicio="2026-01-02"
        fim="2026-09-21"
        janela={{ de: '2026-05-01', ate: '2026-05-31' }}
        aoMudar={(j) => mudou.push(j)}
      />,
    );
    const grupo = getByRole('group');
    fireEvent.keyDown(grupo, { key: 'ArrowRight' });
    fireEvent.keyDown(grupo, { key: 'ArrowLeft', shiftKey: true });
    expect(mudou).toEqual([
      { de: '2026-05-08', ate: '2026-06-07' },
      { de: '2026-05-01', ate: '2026-05-24' },
    ]);
  });
});
