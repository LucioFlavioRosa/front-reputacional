// @vitest-environment jsdom

/** O ajuste de largura da tabela: padrão de saída, arraste, restaurar. */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { Linha, Tabela } from '@/componentes/Tabela';

const PADRAO = { Data: 100, Matéria: 400, Fonte: 120 };

function desenhar(extra: Partial<Parameters<typeof Tabela>[0]> = {}) {
  return render(
    <Tabela
      colunas={['Data', 'Matéria', 'Fonte']}
      chaveDeArmazenamento="teste"
      largurasPadrao={PADRAO}
      barraDeLargura
      {...extra}
    >
      <Linha>
        <td>12/08</td>
        <td>Rompimento de adutora</td>
        <td>Clipei</td>
      </Linha>
    </Tabela>,
  );
}

const larguras = (container: HTMLElement) =>
  [...container.querySelectorAll('col')].map((col) => (col as HTMLElement).style.width);

function arrastar(alca: Element, de: number, ate: number) {
  fireEvent.mouseDown(alca, { clientX: de });
  fireEvent.mouseMove(window, { clientX: ate });
  fireEvent.mouseUp(window);
}

describe('Tabela · largura das colunas', () => {
  beforeEach(() => window.localStorage.clear());

  it('abre com a largura de saída de CADA coluna, em layout fixo', () => {
    const { container } = desenhar();
    expect(larguras(container)).toEqual(['100px', '400px', '120px']);
    expect(container.querySelector('table')!.style.tableLayout).toBe('fixed');
  });

  it('mostra a dica de ajuste, e o botão de restaurar só depois que alguém mexe', () => {
    const { container } = desenhar();
    expect(screen.getByText(/Arraste a borda de um cabeçalho/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Restaurar layout' })).toBeNull();

    arrastar(container.querySelectorAll('.tabela-alca')[0], 100, 180);
    expect(larguras(container)[0]).toBe('180px');
    expect(screen.getByRole('button', { name: 'Restaurar layout' })).toBeTruthy();
  });

  it('a última coluna não tem alça (só as duas primeiras)', () => {
    const { container } = desenhar();
    expect(container.querySelectorAll('.tabela-alca')).toHaveLength(2);
  });

  it('dois cliques na alça devolvem só aquela coluna ao tamanho de saída', () => {
    const { container } = desenhar();
    const alcas = container.querySelectorAll('.tabela-alca');
    arrastar(alcas[0], 100, 220);
    arrastar(alcas[1], 500, 560);
    expect(larguras(container)).toEqual(['220px', '460px', '120px']);

    fireEvent.doubleClick(alcas[0]);
    expect(larguras(container)).toEqual(['100px', '460px', '120px']);
  });

  it('"Restaurar layout" volta tudo ao padrão e some', () => {
    const { container } = desenhar();
    const alcas = container.querySelectorAll('.tabela-alca');
    arrastar(alcas[0], 100, 220);
    arrastar(alcas[1], 500, 560);
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar layout' }));
    expect(larguras(container)).toEqual(['100px', '400px', '120px']);
    expect(screen.queryByRole('button', { name: 'Restaurar layout' })).toBeNull();
  });

  it('a largura escolhida sobrevive ao recarregar, e a alça acende durante o arraste', () => {
    const { container, unmount } = desenhar();
    const alca = container.querySelectorAll('.tabela-alca')[0];
    fireEvent.mouseDown(alca, { clientX: 100 });
    expect(alca.className).toContain('tabela-alca--ativa');
    expect(document.body.style.cursor).toBe('col-resize');
    fireEvent.mouseMove(window, { clientX: 160 });
    fireEvent.mouseUp(window);
    expect(alca.className).not.toContain('tabela-alca--ativa');
    expect(document.body.style.cursor).toBe('');
    unmount();

    const outra = desenhar();
    expect(larguras(outra.container)[0]).toBe('160px');
  });

  it('sem a barra, a tabela continua sem dica nem botão (as outras telas não mudam)', () => {
    desenhar({ barraDeLargura: false });
    expect(screen.queryByText(/Arraste a borda/)).toBeNull();
  });
});
