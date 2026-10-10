// @vitest-environment jsdom

/** A fila do mesmo ator cadastrado duas vezes.
 *
 *  O homônimo exato a migration `0076` fundiu sozinha. O que chega a esta tela
 *  são os pares que só casam depois de tirar pontuação — `valoreconomico` ↔
 *  `Valor Econômico` —, e ali semelhança NÃO é identidade: `Diário SM` e
 *  `Diários M` casam assim, e `bmc.news` casa com dois veículos.
 *
 *  O QUE ESTES TESTES PROTEGEM:
 *
 *  * a fila VAZIA não ocupa tela: nada a fazer, nada a ler;
 *  * cada lado mostra quantas menções carrega — é o número que diz qual é a
 *    linha com história, e é ela que sobrevive;
 *  * "Fundir" manda o perfil como quem SAI (a ordem dos argumentos é a regra
 *    de negócio inteira: trocada, apagaria o veículo curado);
 *  * "Não é o mesmo" grava a decisão — sem isso o par recusado voltaria
 *    idêntico para sempre, e a fila que não anda é a que ninguém olha;
 *  * depois de responder, a fila é relida: a linha respondida sai;
 *  * e a falha de carga NÃO derruba a tela do cadastro: a fila é acessória.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';

import { FilaDeDuplicados } from '@/paginas/FilaDeDuplicados';

vi.mock('@/api/cliente', () => ({
  duplicadosDeCadastro: vi.fn(),
  fundirCadastro: vi.fn(async () => ({ id: 'v1', nome: 'Valor Econômico' })),
  declararCadastroDistinto: vi.fn(async () => ({ guardado: true })),
}));

const { duplicadosDeCadastro, fundirCadastro, declararCadastroDistinto } =
  await import('@/api/cliente');

const UM_PAR = [
  {
    id: 'p1',
    nome: 'valoreconomico',
    cargo: 'Imprensa',
    mencoes: 11,
    candidatos: [
      { id: 'v1', nome: 'Valor Econômico', tipo: 'veiculo', mencoes: 88 },
    ],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(duplicadosDeCadastro).mockResolvedValue(UM_PAR);
  vi.mocked(fundirCadastro).mockResolvedValue({ id: 'v1', nome: 'Valor Econômico' });
  vi.mocked(declararCadastroDistinto).mockResolvedValue({ guardado: true });
});

it('a fila VAZIA nao ocupa tela', async () => {
  vi.mocked(duplicadosDeCadastro).mockResolvedValue([]);

  const { container } = render(<FilaDeDuplicados />);

  await waitFor(() => expect(duplicadosDeCadastro).toHaveBeenCalled());
  await waitFor(() => expect(container.textContent).toBe(''));
});

it('mostra os dois lados com as mencoes de cada um', async () => {
  render(<FilaDeDuplicados />);

  expect(await screen.findByText('valoreconomico')).toBeTruthy();
  expect(screen.getByText(/Perfil de rede · Imprensa · 11 menções/)).toBeTruthy();
  expect(screen.getByText('Valor Econômico')).toBeTruthy();
  //: 88 CONTRA 11 é o que diz qual é a linha com história.
  expect(screen.getByText(/Veículo de imprensa · 88 menções/)).toBeTruthy();
});

it('Fundir manda o PERFIL como quem sai', async () => {
  render(<FilaDeDuplicados />);
  const botao = await screen.findByRole('button', {
    name: 'Fundir valoreconomico em Valor Econômico',
  });

  await userEvent.click(botao);

  //: A ORDEM É A REGRA DE NEGÓCIO INTEIRA: trocada, o pedido apagaria o
  //: veículo curado dentro do handle do fornecedor. O servidor também recusa,
  //: mas a tela não deve nem pedir.
  await waitFor(() => expect(fundirCadastro).toHaveBeenCalledWith('p1', 'v1'));
});

it('Nao e o mesmo GRAVA a decisao, e nao funde', async () => {
  render(<FilaDeDuplicados />);
  const botao = await screen.findByRole('button', {
    name: 'valoreconomico não é Valor Econômico',
  });

  await userEvent.click(botao);

  await waitFor(() => expect(declararCadastroDistinto).toHaveBeenCalledWith('p1', 'v1'));
  expect(fundirCadastro).not.toHaveBeenCalled();
});

it('depois de responder, a fila e relida', async () => {
  render(<FilaDeDuplicados />);
  const botao = await screen.findByRole('button', {
    name: 'valoreconomico não é Valor Econômico',
  });
  vi.mocked(duplicadosDeCadastro).mockResolvedValue([]);

  await userEvent.click(botao);

  //: A LINHA RESPONDIDA SAI. Sem a releitura, ela ficaria na tela com dois
  //: botões que não têm mais o que fazer.
  await waitFor(() => expect(screen.queryByText('valoreconomico')).toBeNull());
});

it('a falha de carga NAO derruba a tela', async () => {
  vi.mocked(duplicadosDeCadastro).mockRejectedValue(new Error('403 sem permissão'));

  render(<FilaDeDuplicados />);

  //: A fila é acessória: o cadastro inteiro não pode cair com ela.
  expect(await screen.findByText(/403 sem permissão/)).toBeTruthy();
});
