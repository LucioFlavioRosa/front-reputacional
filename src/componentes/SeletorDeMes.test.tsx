// @vitest-environment jsdom

/** O seletor de mês do Score: setas, calendário e o mês sugerido. */

import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SeletorDeMes } from '@/componentes/SeletorDeMes';

const MESES = ['2025-11', '2025-12', '2026-01', '2026-03'];

function ComEstado({ inicial }: { inicial: string }) {
  const [mes, definir] = useState(inicial);
  return <SeletorDeMes meses={MESES} valor={mes} sugerido="2025-12" aoEscolher={definir} />;
}

describe('SeletorDeMes', () => {
  it('as setas andam pelos meses com dado, pulando os buracos', async () => {
    render(<ComEstado inicial="2026-01" />);
    await userEvent.click(screen.getByRole('button', { name: /Mês seguinte: março de 2026/ }));
    expect(screen.getByText('março de 2026')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Não há mês seguinte' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('o calendário apaga o mês sem dado e escolhe o clicado', async () => {
    render(<ComEstado inicial="2026-03" />);
    await userEvent.click(screen.getByRole('button', { name: 'março de 2026' }));
    expect((screen.getByRole('button', { name: 'fevereiro de 2026, sem dado' }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'novembro de 2025' }));
    expect(screen.getByText('novembro de 2025')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('oferece voltar ao mês mais completo', async () => {
    render(<ComEstado inicial="2026-03" />);
    await userEvent.click(screen.getByRole('button', { name: 'março de 2026' }));
    await userEvent.click(screen.getByRole('button', { name: /Voltar ao mês mais completo/ }));
    expect(screen.getByText('dezembro de 2025')).toBeTruthy();
  });
});
