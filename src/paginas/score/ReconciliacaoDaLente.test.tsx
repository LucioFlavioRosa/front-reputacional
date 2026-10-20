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

import { catalogoMudou } from '@/dominio/sincronizacao';
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
  //: AS CHAMADAS ANTERIORES SAEM DA CONTA. Sem isto, o teste que conta quantas
  //: vezes a prévia foi lida enxerga as leituras dos testes de cima — e passa
  //: ou falha por causa da ORDEM do arquivo, que é a pior razão possível.
  vi.clearAllMocks();
  vi.mocked(previaDaReconciliacao).mockResolvedValue([medida()]);
  //: A RESPOSTA DO APLICAR É A DO SERVIDOR DE VERDADE: `meses` descreve o
  //: estado DEPOIS (nenhum `mudou`), e `entram` continua dizendo o que ESTA
  //: aplicação moveu.
  //:
  //: A PRIMEIRA VERSÃO DESTE DUBLÊ ZERAVA `entram` E ERA O QUE FAZIA O TESTE
  //: PASSAR POR MOTIVO ERRADO: o servidor devolvia `mudou: true` nos meses que
  //: acabara de reescrever, a tela continuava mostrando o aviso, e aqui nada
  //: pegava porque o dublê fabricava a resposta que eu queria.
  vi.mocked(aplicarReconciliacao).mockResolvedValue([
    medida({
      aplicada: true,
      meses: [
        { mes: '2026-08-01', antes: 49, depois: 49, mudou: false },
        { mes: '2026-09-01', antes: 12, depois: 12, mudou: false },
      ],
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

it('depois de aplicar, o aviso SAI da tela', async () => {
  /** ACHADO ALTO DE REVISÃO, e o teste anterior passava por motivo errado.
   *
   *  O servidor devolvia a medida de ANTES — com `mudou: true` nos meses que
   *  acabara de reescrever —, e a tela, que pergunta "ainda há desvio?",
   *  continuava mostrando o aviso e o botão depois de aplicar com sucesso. O
   *  dublê daqui fabricava `mudou: false` e escondia isso.
   *
   *  Agora o dublê é a resposta real e o teste exige as duas coisas: a
   *  confirmação aparece, e o aviso some. */
  render(<ReconciliacaoDaLente />);
  await userEvent.click(
    await screen.findByRole('button', { name: /Aplicar a 1 mês/ }),
  );

  expect(await screen.findByText(/passou a contar/)).toBeTruthy();
  expect(screen.queryByText(/ainda não reflete esta lista/)).toBeNull();
  expect(screen.queryByRole('button', { name: /Aplicar/ })).toBeNull();
});

it('a previa e refeita quando a LISTA muda', async () => {
  /** ACHADO ALTO DE REVISÃO. A prévia é sobre a diferença entre o cadastro e a
   *  lente, e salvar a lista muda um dos dois lados. Lendo só na montagem, o
   *  painel mentia logo depois do gesto que mais o afeta — e era preciso
   *  recarregar a página, que é o que ninguém faz depois de ver "salvo". */
  vi.mocked(previaDaReconciliacao).mockResolvedValue([
    medida({ meses: [{ mes: '2026-08-01', antes: 7, depois: 7, mudou: false }], entram: [] }),
  ]);
  const { container } = render(<ReconciliacaoDaLente />);
  await waitFor(() => expect(previaDaReconciliacao).toHaveBeenCalledTimes(1));
  expect(container.textContent).toBe('');

  //: Alguém acrescenta um veículo à lista e salva: a rota é de catálogo, e o
  //: cliente da API avisa este barramento.
  vi.mocked(previaDaReconciliacao).mockResolvedValue([medida()]);
  catalogoMudou.avisar();

  expect(
    await screen.findByText(/A lente Mercado ainda não reflete esta lista/),
  ).toBeTruthy();
});

it('salvar a lista ABRE a janela com os numeros, no mesmo gesto', async () => {
  /** O PEDIDO, nas duas mensagens dele: "se eu disser que uma instituição
   *  pertence a essa categoria, todos seus registros devem ser movidos" e "deve
   *  acontecer no momento que clico em salvar; é um clique só".
   *
   *  A aba incrementa `confirmarApos` ao salvar, e o painel relê e pergunta. O
   *  salvamento da lista JÁ aconteceu — por isso o botão de recusa diz "Agora
   *  não", e não "Cancelar". */
  const { rerender } = render(<ReconciliacaoDaLente confirmarApos={0} />);
  await waitFor(() => expect(previaDaReconciliacao).toHaveBeenCalledTimes(1));

  rerender(<ReconciliacaoDaLente confirmarApos={1} />);

  expect(
    await screen.findByText(/Isto também reescreve os meses fechados/),
  ).toBeTruthy();
  //: OS NÚMEROS ESTÃO NA JANELA, e não só no painel: é ali que a decisão é
  //: tomada.
  expect(screen.getByTestId('meses-que-mudam').textContent).toContain(
    '08/2026: 0 → 49',
  );
  expect(screen.getByRole('button', { name: 'Agora não' })).toBeTruthy();
  expect(screen.getByRole('button', { name: /Aplicar a 1 mês/ })).toBeTruthy();
});

it('"Agora nao" fecha a janela e DEIXA o painel avisando', async () => {
  //: Adiar não é resolver: o desvio continua, e a tela continua dizendo isso.
  const { rerender } = render(<ReconciliacaoDaLente confirmarApos={0} />);
  await waitFor(() => expect(previaDaReconciliacao).toHaveBeenCalledTimes(1));
  rerender(<ReconciliacaoDaLente confirmarApos={1} />);
  await screen.findByText(/Isto também reescreve os meses fechados/);

  await userEvent.click(screen.getByRole('button', { name: 'Agora não' }));

  expect(screen.queryByText(/Isto também reescreve/)).toBeNull();
  expect(screen.getByText(/A lente Mercado ainda não reflete esta lista/)).toBeTruthy();
  expect(aplicarReconciliacao).not.toHaveBeenCalled();
});

it('salvar SEM desvio nao abre janela nenhuma', async () => {
  //: Um salvamento que não alcança nenhum mês já ingerido não tem o que
  //: confirmar — e uma janela ali seria ruído em cima de um gesto comum.
  vi.mocked(previaDaReconciliacao).mockResolvedValue([
    medida({ meses: [{ mes: '2026-08-01', antes: 7, depois: 7, mudou: false }], entram: [] }),
  ]);
  const { rerender, container } = render(<ReconciliacaoDaLente confirmarApos={0} />);
  await waitFor(() => expect(previaDaReconciliacao).toHaveBeenCalledTimes(1));

  rerender(<ReconciliacaoDaLente confirmarApos={1} />);
  await waitFor(() => expect(previaDaReconciliacao).toHaveBeenCalledTimes(2));

  expect(container.textContent).toBe('');
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

it('na aba do INSTITUCIONAL, o painel fala da lente dela', async () => {
  //: ACHADO DE REVISÃO: as frases diziam "lente Mercado" fixo. Na aba gêmea o
  //: painel reconciliava a lista CERTA afirmando a lente ERRADA — o pior tipo
  //: de texto, porque o número ao lado dele está certo e ninguém desconfia.
  vi.mocked(previaDaReconciliacao).mockResolvedValue([
    medida({ meses: [{ mes: '2026-08-01', antes: 0, depois: 4, mudou: true }] }),
  ]);

  render(
    <ReconciliacaoDaLente lista="imprensa_institucional" lente="Institucional" />,
  );

  expect(
    await screen.findByText(/A lente Institucional ainda não reflete esta lista/),
  ).toBeTruthy();
  //: E LÊ A LISTA DELA, não a do Mercado.
  expect(previaDaReconciliacao).toHaveBeenCalledWith('imprensa_institucional');
});
