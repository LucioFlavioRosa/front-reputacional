// @vitest-environment jsdom

/** O painel que faz a lista valer para os meses já ingeridos.
 *
 *  O QUE ESTES TESTES PROTEGEM:
 *
 *  * sem desvio, o painel NÃO ocupa tela — nem enquanto carrega;
 *  * com desvio, ele diz quem entra, quem sai e QUAIS MESES mudam, antes de
 *    qualquer escrita;
 *  * os meses que mudam vêm do campo `mudou` do servidor, e não de
 *    `antes !== depois` — a tela não recalcula o que o servidor já decidiu;
 *  * aplicar usa o número da RESPOSTA, e não o que a prévia tinha dito;
 *  * a falha da prévia não derruba a aba: ela é acessória.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';

import { ReconciliacaoDaLente } from '@/paginas/score/ReconciliacaoDaLente';

vi.mock('@/api/cliente', () => ({
  previaDaReconciliacao: vi.fn(),
  aplicarReconciliacao: vi.fn(),
}));

const { previaDaReconciliacao, aplicarReconciliacao } = await import('@/api/cliente');

function medida(parcial = {}) {
  return {
    fonte: 'clipei_investidores',
    espelho: 'clipei',
    lista: 'imprensa_economica',
    meses: [
      { mes: '2026-08-01', antes: 0, depois: 49, mudou: true },
      { mes: '2026-09-01', antes: 12, depois: 12, mudou: false },
    ],
    entram: [{ nome: 'Valor Econômico', mencoes: 49 }],
    saem: [],
    aplicada: false,
    ...parcial,
  };
}

beforeEach(() => {
  vi.mocked(previaDaReconciliacao).mockResolvedValue([medida()]);
  vi.mocked(aplicarReconciliacao).mockResolvedValue([
    medida({
      aplicada: true,
      meses: [
        { mes: '2026-08-01', antes: 49, depois: 49, mudou: false },
        { mes: '2026-09-01', antes: 12, depois: 12, mudou: false },
      ],
      entram: [],
    }),
  ]);
});

it('sem desvio, o painel nao ocupa tela', async () => {
  //: Um cartão dizendo "está tudo certo" seria mais uma linha para ler em toda
  //: abertura. É a mesma regra da fila de duplicados, que some no zero.
  vi.mocked(previaDaReconciliacao).mockResolvedValue([
    medida({ meses: [{ mes: '2026-08-01', antes: 49, depois: 49, mudou: false }], entram: [] }),
  ]);
  const { container } = render(<ReconciliacaoDaLente />);

  await waitFor(() => expect(previaDaReconciliacao).toHaveBeenCalled());
  expect(container.textContent).toBe('');
});

it('com desvio, diz quem entra e QUAIS meses mudam', async () => {
  render(<ReconciliacaoDaLente />);

  expect(
    await screen.findByText(/A lente Mercado ainda não reflete esta lista/),
  ).toBeTruthy();
  expect(screen.getByText(/Valor Econômico/)).toBeTruthy();
  //: SÓ O MÊS QUE MUDA. Listar setembro (que não muda) faria a pessoa achar que
  //: a nota dele também seria reescrita.
  const meses = screen.getByTestId('meses-que-mudam');
  expect(meses.textContent).toContain('08/2026: 0 → 49');
  expect(meses.textContent).not.toContain('09/2026');
  //: E O BOTÃO DIZ QUANTOS.
  expect(screen.getByRole('button', { name: /Aplicar a 1 mês/ })).toBeTruthy();
});

it('o mes que MUDA vem do servidor, e nao de antes !== depois', async () => {
  /** O caso que a conta da tela erraria: um veículo de 3 menções sai da lista e
   *  outro de 3 entra no mesmo mês. O total não muda e o conjunto muda — o
   *  servidor diz `mudou: true`, e a tela não pode discordar.
   *
   *  Refazer a conta aqui seria a segunda definição de "este mês muda", livre
   *  para divergir da primeira. */
  vi.mocked(previaDaReconciliacao).mockResolvedValue([
    medida({
      meses: [{ mes: '2026-08-01', antes: 3, depois: 3, mudou: true }],
      entram: [{ nome: 'Entra', mencoes: 3 }],
      saem: [{ nome: 'Sai', mencoes: 3 }],
    }),
  ]);
  render(<ReconciliacaoDaLente />);

  expect(
    await screen.findByText(/A lente Mercado ainda não reflete esta lista/),
  ).toBeTruthy();
  expect(screen.getByTestId('meses-que-mudam').textContent).toContain(
    '08/2026: 3 → 3',
  );
  expect(screen.getByText(/Deixam de contar/)).toBeTruthy();
});

it('aplicar usa o numero da RESPOSTA, e nao o da previa', async () => {
  //: Entre ler a prévia e clicar, alguém pode ter mexido na lista. Repetir o
  //: número da prévia seria afirmar o que não foi medido.
  vi.mocked(aplicarReconciliacao).mockResolvedValue([
    medida({
      aplicada: true,
      meses: [{ mes: '2026-08-01', antes: 7, depois: 7, mudou: false }],
      entram: [],
    }),
  ]);
  render(<ReconciliacaoDaLente />);
  await userEvent.click(
    await screen.findByRole('button', { name: /Aplicar a 1 mês/ }),
  );

  expect(await screen.findByText(/passou a contar 7 menções/)).toBeTruthy();
});

it('a falha da previa NAO derruba a aba', async () => {
  //: O painel é acessório: a manutenção da lista não pode depender de uma
  //: leitura que é sobre outra coisa.
  vi.mocked(previaDaReconciliacao).mockRejectedValue(
    new Error('403 sem permissão'),
  );
  render(<ReconciliacaoDaLente />);

  expect(await screen.findByText(/403 sem permissão/)).toBeTruthy();
});
