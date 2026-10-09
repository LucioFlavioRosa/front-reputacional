// @vitest-environment jsdom

/** O upload leva à conferência, e o download oferece os dois modelos.
 *
 *  O DEFEITO QUE ISTO PEGA: `BotaoDeImportar` chamava `useNavegacao()` por conta
 *  própria. O hook guarda o lugar num `useState` PRÓPRIO de cada chamador — então
 *  `irPara` empurrava a URL, atualizava o estado do botão (que ninguém lê) e o
 *  `App`, que tem a sua própria instância do hook, nunca sabia que a rota mudou.
 *
 *  Para a pessoa: ela subia a planilha, nada acontecia, e a conferência só
 *  aparecia se ela atualizasse a página — que era exatamente a queixa.
 *
 *  A CORREÇÃO É A DO RESTO DA TELA: quem navega recebe o `irPara` de cima. Este
 *  arquivo é o único lugar do projeto que fugia desse padrão.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BotaoDeImportar } from '@/paginas/importacao/BotaoDeImportar';

vi.mock('@/api/cliente', () => ({
  baixarModeloDeImportacao: vi.fn(async () => new Blob(['x'])),
  subirPlanilhaDeAgendas: vi.fn(async () => ({ id: 'imp-1' })),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('BotaoDeImportar', () => {
  it('avisa quem montou a tela para abrir a conferência da importação', async () => {
    const aoSubir = vi.fn();
    render(<BotaoDeImportar podeAdministrar aoSubir={aoSubir} />);

    const entrada = document.querySelector('input[type="file"]') as HTMLInputElement;
    const arquivo = new File(['x'], 'agendas.xlsx');
    fireEvent.change(entrada, { target: { files: [arquivo] } });

    await waitFor(() => expect(aoSubir).toHaveBeenCalledWith('imp-1'));
  });

  it('o download abre o modal com os DOIS modelos', () => {
    render(<BotaoDeImportar podeAdministrar aoSubir={() => {}} />);

    fireEvent.click(screen.getByText('Baixar modelo de planilha'));

    expect(screen.getByText('Completo')).toBeTruthy();
    expect(screen.getByText('Simplificado')).toBeTruthy();
    // Cada um diz para quem serve: só o nome faria a pessoa escolher pelo que soa
    // mais seguro, que é sempre o primeiro.
    expect(screen.getByText(/74 colunas/)).toBeTruthy();
    expect(screen.getByText(/22 colunas/)).toBeTruthy();
  });

  it('não aparece para quem não administra cadastros', () => {
    const { container } = render(<BotaoDeImportar podeAdministrar={false} aoSubir={() => {}} />);

    expect(container.textContent).toBe('');
  });
});
