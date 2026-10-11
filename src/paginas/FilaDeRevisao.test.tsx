// @vitest-environment jsdom

/** A fila de cadastros que entraram por planilha e ninguém conferiu.
 *
 *  PEDIDO DO DONO DO PRODUTO, cobrado duas vezes: "pedi também por uma aba
 *  extra somente para conferência de novos registros e não vi". A coluna
 *  `pendente_de_revisao` existia no banco desde a `0085` e nenhuma tela a lia —
 *  o pior estado possível, porque a importação PAROU DE TRAVAR contando com uma
 *  revisão que não acontecia.
 *
 *  O QUE ESTES TESTES PROTEGEM:
 *
 *  * a fila VAZIA não ocupa tela: nada a fazer, nada a ler;
 *  * cada aba mostra SÓ a sua fila — a de temas não lista instituições;
 *  * o `contexto` aparece ao lado do nome, e é ele que distingue dois cadastros
 *    homônimos criados de propósito (o caso que fez a fila existir);
 *  * "Está certo" manda o TIPO e o ID do registro, e relê a fila;
 *  * o que outra pessoa já consolidou é dito, e não comemorado como se fosse
 *    desta vez;
 *  * e a falha de carga NÃO derruba a tela do cadastro: a fila é acessória, e
 *    um 403 de quem não administra cadastros chega por aqui.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';

import { FilaDeRevisao } from '@/paginas/FilaDeRevisao';
import type { AbaDeRevisao } from '@/api/cliente';
//: O SINCRONIZADOR DE VERDADE, e não um dublê: ele é uma classe sem React e sem
//: `fetch`, feita para ser usada em teste — e o que se mede aqui é justamente a
//: ligação entre ele e a fila.
import { catalogoMudou } from '@/dominio/sincronizacao';

vi.mock('@/api/cliente', () => ({
  filaDeRevisao: vi.fn(),
  consolidarCadastro: vi.fn(),
}));

const { filaDeRevisao, consolidarCadastro } = await import('@/api/cliente');

//: A PESSOA EM DUAS INSTITUIÇÕES, que é o caso real: quatro nomes da planilha de
//: RI aparecem em duas casas cada, e cada um nasce DUAS VEZES, de propósito — a
//: `0002` diz que "mesmo nome em instituições diferentes são pessoas diferentes".
const O_MESMO_NOME_DUAS_VEZES = [
  {
    id: 'instituicoes',
    rotulo: 'Instituições e Contatos',
    pendentes: [
      {
        id: 'i1',
        tipo: 'interlocutor',
        nome: 'Artur Santa',
        motivo:
          'Apareceu em 2 instituições na mesma planilha — confirme se são a ' +
          'mesma pessoa, se ela mudou de casa, ou se são homônimas.',
        contexto: 'Banco XP',
        criado_em: '2026-10-11T12:00:00Z',
      },
      {
        id: 'i2',
        tipo: 'interlocutor',
        nome: 'Artur Santa',
        motivo:
          'Apareceu em 2 instituições na mesma planilha — confirme se são a ' +
          'mesma pessoa, se ela mudou de casa, ou se são homônimas.',
        contexto: 'XP Asset',
        criado_em: '2026-10-11T12:00:00Z',
      },
    ],
  },
  { id: 'assuntos', rotulo: 'Temas', pendentes: [] },
  { id: 'porta_vozes', rotulo: 'Representantes Aegea', pendentes: [] },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(filaDeRevisao).mockResolvedValue(O_MESMO_NOME_DUAS_VEZES);
  vi.mocked(consolidarCadastro).mockResolvedValue({
    pendente: O_MESMO_NOME_DUAS_VEZES[0].pendentes[0],
    ja_estava_consolidado: false,
  });
});

it('a fila VAZIA nao ocupa tela', async () => {
  //: O "MENOR IMPACTO" DO PEDIDO. Um cartão dizendo "nada pendente" seria uma
  //: linha a mais para ler em toda abertura do cadastro — e é o cadastro, não a
  //: fila, que a pessoa veio ver.
  const { container } = render(<FilaDeRevisao aba="assuntos" />);

  await waitFor(() => expect(filaDeRevisao).toHaveBeenCalled());
  await waitFor(() => expect(container.textContent).toBe(''));
});

it('cada aba mostra SO a sua fila', async () => {
  //: A ABA DE TEMAS NÃO LISTA INSTITUIÇÕES, e sem esta asserção o filtro por
  //: `aba` poderia cair e a mesma fila apareceria três vezes — cada aba
  //: oferecendo consolidar cadastros que não são dela.
  render(<FilaDeRevisao aba="assuntos" />);

  await waitFor(() => expect(filaDeRevisao).toHaveBeenCalled());
  expect(screen.queryByText('Artur Santa')).toBeNull();
});

it('o CONTEXTO distingue os dois cadastros do mesmo nome', async () => {
  //: A LINHA MAIS IMPORTANTE DA TELA. Os dois "Artur Santa" nascem de propósito,
  //: com o MESMO motivo. Sem a instituição ao lado, quem revisa vê duas linhas
  //: idênticas e não tem como saber qual é qual — e a fila fica ilegível
  //: justamente no caso que a fez existir.
  render(<FilaDeRevisao aba="instituicoes" />);

  const os_dois = await screen.findAllByText('Artur Santa');
  expect(os_dois).toHaveLength(2);
  expect(screen.getByText(/Contato · Banco XP/)).toBeTruthy();
  expect(screen.getByText(/Contato · XP Asset/)).toBeTruthy();
});

it('Esta certo manda o TIPO e o ID, e rele a fila', async () => {
  //: O TIPO VAI NA URL junto com o id, e não é redundância: `tema` tem chave
  //: inteira e os outros três têm UUID, então o servidor precisa do tipo para
  //: saber o que converter.
  render(<FilaDeRevisao aba="instituicoes" />);
  await screen.findAllByText('Artur Santa');

  const botoes = screen.getAllByRole('button', { name: /Artur Santa/ });
  await userEvent.click(botoes[0]);

  expect(consolidarCadastro).toHaveBeenCalledWith('interlocutor', 'i1');
  //: RELÊ A FILA INTEIRA, e não remove a linha na mão: outra pessoa pode ter
  //: consolidado três enquanto esta tela estava aberta.
  await waitFor(() => expect(filaDeRevisao).toHaveBeenCalledTimes(2));
});

it('o que OUTRA PESSOA ja consolidou e dito, nao comemorado', async () => {
  //: "INCLUSIVE PODE SER TRABALHO DE OUTRA PESSOA" é parte do pedido, então duas
  //: pessoas na mesma aba é o caso normal. O servidor responde 200 com
  //: `ja_estava_consolidado`, e a tela precisa dizer isso — piscar a mesma
  //: confirmação faria a pessoa acreditar que a decisão foi dela.
  vi.mocked(consolidarCadastro).mockResolvedValue({
    pendente: O_MESMO_NOME_DUAS_VEZES[0].pendentes[0],
    ja_estava_consolidado: true,
  });
  render(<FilaDeRevisao aba="instituicoes" />);
  await screen.findAllByText('Artur Santa');

  await userEvent.click(screen.getAllByRole('button', { name: /Artur Santa/ })[0]);

  expect(
    await screen.findByText(/Outra pessoa já havia conferido 1 cadastro: Artur Santa/),
  ).toBeTruthy();
});

it('a falha de carga NAO derruba a tela do cadastro', async () => {
  //: A FILA É ACESSÓRIA. E o caso concreto não é hipotético: a rota exige
  //: `administra_dicionarios`, então quem abre o Cadastro compartilhado sem essa
  //: permissão recebe 403 aqui — e o cadastro inteiro não pode sumir por isso.
  vi.mocked(filaDeRevisao).mockRejectedValue(new Error('Perfil não administra os cadastros.'));

  render(<FilaDeRevisao aba="instituicoes" />);

  expect(await screen.findByText(/Perfil não administra os cadastros/)).toBeTruthy();
  expect(screen.queryByText('Artur Santa')).toBeNull();
});

it('CORRIGIR o cadastro abaixo faz a fila reler', async () => {
  //: O ACHADO DE REVISÃO COM SEVERIDADE MÉDIA, e o defeito era no fluxo que a
  //: PRÓPRIA TELA manda seguir: o botão diz "se ele estiver errado, corrija na
  //: lista abaixo primeiro".
  //:
  //: Essa correção vai por `/api/instituicoes` — rota de catálogo —, então ela
  //: recarregava o catálogo e NÃO esta fila. A linha continuava mostrando o nome
  //: velho e oferecendo "Está certo" sobre uma versão que não existe mais. Pior
  //: no caso de REMOVER: a linha ficava na tela e o botão daria 404.
  render(<FilaDeRevisao aba="instituicoes" />);
  await screen.findAllByText('Artur Santa');
  expect(filaDeRevisao).toHaveBeenCalledTimes(1);

  //: O QUE A EDIÇÃO LÁ EMBAIXO FAZ, pelo barramento que já existia.
  catalogoMudou.avisar();

  await waitFor(() => expect(filaDeRevisao).toHaveBeenCalledTimes(2));
});

it('a secao DESAPARECE quando a fila esvazia, aviso e tudo', async () => {
  //: O OUTRO ACHADO. `deOutraPessoa` acumulava e mantinha a seção viva, então
  //: depois da última linha a tela ficava com "Esperando conferência (0)" e um
  //: aviso permanente até alguém trocar de aba — ocupando espaço para dizer que
  //: não há nada a fazer.
  vi.mocked(consolidarCadastro).mockResolvedValue({
    pendente: O_MESMO_NOME_DUAS_VEZES[0].pendentes[0],
    ja_estava_consolidado: true,
  });
  vi.mocked(filaDeRevisao)
    .mockResolvedValueOnce(O_MESMO_NOME_DUAS_VEZES)
    //: A SEGUNDA CARGA VEM VAZIA: outra pessoa consolidou as duas.
    .mockResolvedValue([
      { id: 'instituicoes', rotulo: 'Instituições e Contatos', pendentes: [] },
    ]);

  const { container } = render(<FilaDeRevisao aba="instituicoes" />);
  await screen.findAllByText('Artur Santa');

  await userEvent.click(screen.getAllByRole('button', { name: /Artur Santa/ })[0]);

  await waitFor(() => expect(container.textContent).toBe(''));
});

it('a carga VELHA que chega depois da nova NAO sobrescreve a fila', async () => {
  //: ACHADO DE REVISÃO COM SEVERIDADE MÉDIA, e o mais fino dos quatro: o
  //: conserto de reler ao mudar o cadastro TORNOU ESTA CORRIDA MAIS PROVÁVEL.
  //:
  //: A carga A começa. Alguém corrige um cadastro na lista abaixo. O barramento
  //: dispara a carga B. B volta com o dado novo; A volta DEPOIS, com o dado
  //: velho, e sobrescreve — recriando a mesma UI velha que o conserto existia
  //: para matar, e numa rede lenta, que é onde ela mais dói.
  //:
  //: AS DUAS PROMESSAS SÃO RESOLVIDAS À MÃO, na ordem invertida de propósito:
  //: é a única forma de afirmar a ordem de CHEGADA em vez de confiar na sorte
  //: do agendador.
  let soltarAVelha: (abas: AbaDeRevisao[]) => void = () => {};
  const aVelha = new Promise<AbaDeRevisao[]>((ok) => {
    soltarAVelha = ok;
  });
  let soltarANova: (abas: AbaDeRevisao[]) => void = () => {};
  const aNova = new Promise<AbaDeRevisao[]>((ok) => {
    soltarANova = ok;
  });

  vi.mocked(filaDeRevisao)
    .mockReturnValueOnce(aVelha)
    .mockReturnValueOnce(aNova);

  render(<FilaDeRevisao aba="instituicoes" />);
  //: A SEGUNDA CARGA COMEÇA ANTES DE A PRIMEIRA VOLTAR.
  catalogoMudou.avisar();
  await waitFor(() => expect(filaDeRevisao).toHaveBeenCalledTimes(2));

  //: A NOVA CHEGA PRIMEIRO, com a fila já consolidada por outra pessoa.
  soltarANova([
    { id: 'instituicoes', rotulo: 'Instituições e Contatos', pendentes: [] },
  ]);
  await waitFor(() => expect(screen.queryByText('Artur Santa')).toBeNull());

  //: E A VELHA CHEGA DEPOIS, trazendo os dois cadastros que já não existem.
  soltarAVelha(O_MESMO_NOME_DUAS_VEZES);
  await new Promise((pronto) => setTimeout(pronto, 0));

  //: NÃO RESSUSCITOU. Sem o conserto, "Artur Santa" volta para a tela — com o
  //: botão "Está certo" apontando para um id que outra pessoa já tirou da fila.
  expect(screen.queryByText('Artur Santa')).toBeNull();
});
