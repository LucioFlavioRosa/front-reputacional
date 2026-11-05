// @vitest-environment jsdom

/** O BOTÃO QUE REFAZ O PAREAMENTO, e o beco sem saída que ele fecha.
 *
 *  A tela avisava "esta fila ainda não foi pareada: peça ao administrador para
 *  rodar o pareamento" — e não havia caminho nenhum. Nem rota, nem botão: só um
 *  comando que roda dentro da rede do banco, inalcançável por quem lê o aviso E
 *  por quem ele manda procurar.
 *
 *  ARQUIVO PRÓPRIO, como `CadastroDeInstituicoes.perfil` e `.contagem`: o
 *  `FilaDeDuplicados.test` já tem 25 testes sobre a fila em si, e este assunto
 *  tem montagem própria (a permissão e a função nova).
 *
 *  O QUE ESTES TESTES PRENDEM:
 *
 *  * o botão aparece para quem administra os cadastros, e NÃO para quem só lê —
 *    a tela não é barrada no front, então os dois leitores existem;
 *  * a frase "peça a quem administra" é o contrário do botão: uma OU a outra,
 *    nunca as duas na mesma faixa;
 *  * o aperto refaz o pareamento e RECARREGA A LISTA, não só o estado;
 *  * enquanto roda, o botão diz e não aceita segundo clique;
 *  * a recusa do servidor chega à pessoa;
 *  * e ele NÃO aparece quando o estado não deu para conferir, porque ali ninguém
 *    sabe se há pareamento a refazer.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';

import type { EstadoDaFilaDeDuplicados } from '@/api/cliente';
import { FilaDeDuplicados } from '@/paginas/FilaDeDuplicados';

vi.mock('@/api/cliente', () => ({
  duplicadosDeCadastro: vi.fn(),
  estadoDaFilaDeDuplicados: vi.fn(),
  pedirPareamento: vi.fn(),
  fundirCadastro: vi.fn(),
  declararCadastroDistinto: vi.fn(),
}));

const { duplicadosDeCadastro, estadoDaFilaDeDuplicados, pedirPareamento } =
  await import('@/api/cliente');

const NUNCA_PAREADA: EstadoDaFilaDeDuplicados = {
  calculado_em: null,
  desatualizado: true,
};

const PAREADA_E_EM_DIA: EstadoDaFilaDeDuplicados = {
  calculado_em: new Date().toISOString(),
  desatualizado: false,
};

const UM_PAR = [
  {
    id: 'p1',
    nome: 'valoreconomico',
    tipo: 'perfil_rede',
    cargo: 'Imprensa',
    origens: ['sociedade'],
    mencoes: 11,
    candidatos: [
      {
        id: 'v1',
        nome: 'Valor Econômico',
        tipo: 'veiculo',
        mencoes: 88,
        origens: ['imprensa'],
      },
    ],
  },
];

const BOTAO = { name: 'Rodar o pareamento' };

beforeEach(() => {
  vi.clearAllMocks();
  //: A FILA VAZIA PORQUE NUNCA PAREOU é a montagem de quase todos estes testes:
  //: é nela que o aviso aparece e o botão tem o que fazer.
  vi.mocked(duplicadosDeCadastro).mockResolvedValue([]);
  vi.mocked(estadoDaFilaDeDuplicados).mockResolvedValue(NUNCA_PAREADA);
  vi.mocked(pedirPareamento).mockResolvedValue({ pares: 0 });
});

it('o botao APARECE para quem administra, e a frase de pedir some', async () => {
  render(<FilaDeDuplicados administraCadastros />);

  expect(await screen.findByText(/ainda não foi pareada/)).toBeTruthy();
  expect(screen.getByRole('button', BOTAO)).toBeTruthy();
  //: AS DUAS COISAS NÃO CONVIVEM. Mandar procurar quem administra ao lado de um
  //: botão que a própria pessoa aperta é contradição na mesma faixa.
  expect(screen.queryByText(/Peça a quem administra/)).toBeNull();
});

it('o botao NAO aparece para quem so le, e ai a frase de pedir e a instrucao', async () => {
  /** OS DOIS LEITORES EXISTEM. `PortalDoCadastroCompartilhado` registra que esta
   *  tela não é barrada no front — "o endereço é público, e quem digitar
   *  /compartilhado sem `administra_dicionarios` chega aqui e recebe 403 do
   *  backend ao tentar salvar". Ler a fila pede só `ve_diretorio`.
   *
   *  ESCONDER NÃO É A BARREIRA, e este teste não finge que é: quem chamasse a
   *  rota sem a permissão receberia 403. O que o botão ausente evita é oferecer
   *  uma ação que vai falhar. */
  render(<FilaDeDuplicados />);

  expect(
    await screen.findByText(/Peça a quem administra os cadastros/),
  ).toBeTruthy();
  expect(screen.queryByRole('button', BOTAO)).toBeNull();
});

it('o aviso de CADASTRO MUDADO tambem oferece o botao', async () => {
  //: O SEGUNDO BECO SEM SAÍDA, e o mais comum dos dois: a subida de planilha
  //: refaz o pareamento, cadastrar pela tela não.
  vi.mocked(estadoDaFilaDeDuplicados).mockResolvedValue({
    calculado_em: new Date(Date.now() - 3_600_000).toISOString(),
    desatualizado: true,
  });
  vi.mocked(duplicadosDeCadastro).mockResolvedValue(UM_PAR);

  render(<FilaDeDuplicados administraCadastros />);

  expect(
    await screen.findByText(/O cadastro mudou depois do último pareamento/),
  ).toBeTruthy();
  expect(screen.getByRole('button', BOTAO)).toBeTruthy();
});

it('o aperto PAREIA e a fila enche', async () => {
  /** A SEQUÊNCIA INTEIRA que a pessoa vive: fila vazia com o aviso, aperta,
   *  pares aparecem e o aviso sai.
   *
   *  A LISTA É RELIDA, E NÃO SÓ O ESTADO. Reler só o estado tiraria o aviso e
   *  deixaria a fila vazia desenhada — o pior dos dois mundos, porque aí o vazio
   *  volta a não ter explicação nenhuma. */
  vi.mocked(duplicadosDeCadastro).mockResolvedValueOnce([]);
  vi.mocked(estadoDaFilaDeDuplicados).mockResolvedValueOnce(NUNCA_PAREADA);
  vi.mocked(pedirPareamento).mockResolvedValue({ pares: 1 });
  vi.mocked(duplicadosDeCadastro).mockResolvedValue(UM_PAR);
  vi.mocked(estadoDaFilaDeDuplicados).mockResolvedValue(PAREADA_E_EM_DIA);

  render(<FilaDeDuplicados administraCadastros />);

  await userEvent.click(await screen.findByRole('button', BOTAO));

  expect(pedirPareamento).toHaveBeenCalledTimes(1);
  //: O NÚMERO NO TÍTULO É A PROVA, e não o nome de um par: ele só aparece quando
  //: há pareamento por trás dele — "(0)" numa fila nunca pareada é a mentira que
  //: esta tela existe para não contar.
  expect(
    await screen.findByRole('button', { name: /Possíveis duplicados \(1\)/ }),
  ).toBeTruthy();
  expect(screen.queryByText(/ainda não foi pareada/)).toBeNull();
});

it('enquanto pareia o botao DIZ, e um segundo clique nao vira segunda moagem', async () => {
  /** DESABILITADO É O QUE IMPEDE A SEGUNDA MOAGEM, e o servidor é a rede de
   *  segurança: ele recusa a concorrente com 409 em vez de enfileirar. Depender
   *  só dele faria a tela mostrar erro por um clique que ela própria convidou.
   *
   *  E O RÓTULO MUDA porque a espera é longa: 22,4 s medidos em ~5.800 cadastros
   *  ativos. Botão que fica igual por vinte segundos é botão que a pessoa aperta
   *  de novo. */
  let terminar!: (resultado: { pares: number }) => void;
  vi.mocked(pedirPareamento).mockReturnValue(
    new Promise((resolver) => {
      terminar = resolver;
    }),
  );

  render(<FilaDeDuplicados administraCadastros />);
  await userEvent.click(await screen.findByRole('button', BOTAO));

  const pareando = await screen.findByRole('button', { name: 'Pareando…' });
  expect(pareando).toBeDisabled();

  await userEvent.click(pareando);
  expect(pedirPareamento).toHaveBeenCalledTimes(1);

  //: DENTRO DE `act`, para a atualização de estado que a resolução dispara não
  //: escapar do teste e aparecer como aviso no seguinte.
  await act(async () => {
    terminar({ pares: 0 });
  });
  await waitFor(() => expect(screen.getByRole('button', BOTAO)).toBeTruthy());
});

it('a RECUSA DO SERVIDOR aparece, e o BOTAO FICA para tentar de novo', async () => {
  /** AS DUAS RECUSAS SÃO 409 e trazem a instrução no texto: o teto diz para
   *  rodar o comando fora da aplicação, e a concorrente diz para esperar. A tela
   *  mostra o texto do servidor em vez de reescrevê-lo — duas versões da mesma
   *  frase divergiriam.
   *
   *  O BOTÃO CONTINUAR ALI É A SEGUNDA METADE, e era um defeito de verdade que a
   *  revisão achou: a falha ia para `erro`, e `erro` apaga o aviso — e o botão
   *  com ele. No 409 de "já está sendo refeito agora" a tela mandava esperar e
   *  não deixava onde tentar de novo; recarregar a página era a única saída.
   *  Agora a falha do pareamento tem estado próprio.
   */
  vi.mocked(pedirPareamento).mockRejectedValue(
    new Error(
      'O pareamento já está sendo refeito agora. Espere ele terminar e ' +
        'recarregue a fila.',
    ),
  );

  render(<FilaDeDuplicados administraCadastros />);
  await userEvent.click(await screen.findByRole('button', BOTAO));

  expect(await screen.findByText(/já está sendo refeito agora/)).toBeTruthy();
  //: E DÁ PARA TENTAR DE NOVO: o aviso que explica o vazio continua, e o botão
  //: está habilitado.
  expect(await screen.findByText(/ainda não foi pareada/)).toBeTruthy();
  const outraVez = screen.getByRole('button', BOTAO);
  expect(outraVez).toBeEnabled();

  await userEvent.click(outraVez);
  expect(pedirPareamento).toHaveBeenCalledTimes(2);
});

it('o botao NAO aparece quando o estado NAO DEU PARA CONFERIR', async () => {
  /** `acionavel` FALSO, e é a única ressalva das três que não ganha botão: aqui a
   *  rota do estado falhou, e ninguém sabe se há pareamento a refazer. Oferecer
   *  vinte segundos de moagem contra "não deu para conferir" é oferecer trabalho
   *  no escuro. */
  vi.mocked(estadoDaFilaDeDuplicados).mockRejectedValue(new Error('500'));

  render(<FilaDeDuplicados administraCadastros />);

  expect(await screen.findByText(/Não foi possível conferir/)).toBeTruthy();
  expect(screen.queryByRole('button', BOTAO)).toBeNull();
});
