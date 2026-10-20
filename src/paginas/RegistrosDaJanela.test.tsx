// @vitest-environment jsdom

/** O modal dos registros de um grupo do quadro da janela.
 *
 *  O QUE ESTE ARQUIVO PROTEGE: A ORDEM DAS RESPOSTAS.
 *
 *  A tela mantém de propósito a lista antiga enquanto a nova não chega — e é
 *  justamente isso que torna esta corrida visível: se a leitura de uma página
 *  pousar DEPOIS da leitura de outra pedida mais tarde, a tabela passa a mostrar
 *  uma página enquanto a navegação logo abaixo dela diz outra. Achado de
 *  revisão; a guarda é um contador de versão, e `vivo` não cobre este caso
 *  porque o componente continua montado.
 *
 *  O resto do modal (as cinco colunas, o cabeçalho com o recorte, o clique que
 *  o abre) é coberto pelo arquivo da tela, que o monta pelo caminho real.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GrupoNaJanela, RegistrosDaJanela as Pagina } from '@/api/cliente';
import { RegistrosDaJanela } from '@/paginas/RegistrosDaJanela';

const { obterRegistrosDaJanela } = vi.hoisted(() => ({
  obterRegistrosDaJanela: vi.fn(),
}));

vi.mock('@/api/cliente', () => ({ obterRegistrosDaJanela }));

const GRUPO: GrupoNaJanela = {
  id: 11,
  rotulo: 'Contratos e regulação',
  contexto: 'Governança',
  impacto: 1.5,
  mencoes: 120,
};

/** Uma página com um único registro, cujo título diz de qual página ela é.
 *  120 em páginas de 50 são TRÊS páginas — a navegação precisa de um terceiro
 *  número para que a corrida tenha duas trocas. */
function pagina(numero: number): Pagina {
  return {
    itens: [
      {
        id: `m${numero}`,
        data: '2026-05-18',
        veiculo: 'Valor Econômico',
        titulo: `A matéria da página ${numero}`,
        link: null,
        sentimento: 'pos',
        tier: 'muito_relevante',
      },
    ],
    total: 120,
    pagina: numero,
    tamanho: 50,
  };
}

/** Uma leitura que fica em voo até alguém soltá-la. */
function presa(): { promessa: Promise<Pagina>; soltar: (p: Pagina) => void; recusar: (f: Error) => void } {
  let soltar: (p: Pagina) => void = () => {};
  let recusar: (f: Error) => void = () => {};
  const promessa = new Promise<Pagina>((resolver, rejeitar) => {
    soltar = resolver;
    recusar = rejeitar;
  });
  return { promessa, soltar, recusar };
}

function montar() {
  return render(
    <RegistrosDaJanela
      grupo={GRUPO}
      ate="2026-05-20"
      de="2026-05-06"
      nivel="n2"
      aoFechar={() => {}}
    />,
  );
}

describe('os registros da janela', () => {
  beforeEach(() => {
    obterRegistrosDaJanela.mockReset();
  });

  it('a resposta ATRASADA de uma página antiga não pousa sobre a atual', async () => {
    obterRegistrosDaJanela.mockImplementationOnce(() => Promise.resolve(pagina(1)));
    montar();
    expect(await screen.findByText('A matéria da página 1')).toBeTruthy();

    //: A SEGUNDA LEITURA FICA EM VOO. A lista continua na página 1, de propósito.
    const segunda = presa();
    obterRegistrosDaJanela.mockImplementationOnce(() => segunda.promessa);
    await userEvent.click(screen.getByRole('button', { name: /^2$/ }));
    expect(screen.getByText('A matéria da página 1')).toBeTruthy();

    //: A TERCEIRA É PEDIDA DEPOIS e responde PRIMEIRO — é ela que vale.
    obterRegistrosDaJanela.mockImplementationOnce(() => Promise.resolve(pagina(3)));
    await userEvent.click(screen.getByRole('button', { name: /^3$/ }));
    expect(await screen.findByText('A matéria da página 3')).toBeTruthy();

    //: AGORA A PÁGINA 2 CHEGA, atrasada. Sem a guarda de versão ela venceria,
    //: e a tabela mostraria a página 2 sob o rótulo "Página 3 de 3".
    await act(async () => {
      segunda.soltar(pagina(2));
    });
    await waitFor(() => expect(screen.getByText('A matéria da página 3')).toBeTruthy());
    expect(screen.queryByText('A matéria da página 2')).toBeNull();
    expect(screen.getByText(/Página 3 de 3/)).toBeTruthy();
  });

  it('a FALHA atrasada de uma página antiga não mancha a página atual', async () => {
    //: MESMA CORRIDA, PELO OUTRO RAMO. Sem a guarda, a faixa de erro apareceria
    //: sobre uma lista correta, e quem lê não teria como saber qual das duas
    //: afirmações vale — a lista ou o aviso de que a leitura falhou.
    obterRegistrosDaJanela.mockImplementationOnce(() => Promise.resolve(pagina(1)));
    montar();
    expect(await screen.findByText('A matéria da página 1')).toBeTruthy();

    const segunda = presa();
    obterRegistrosDaJanela.mockImplementationOnce(() => segunda.promessa);
    await userEvent.click(screen.getByRole('button', { name: /^2$/ }));

    obterRegistrosDaJanela.mockImplementationOnce(() => Promise.resolve(pagina(3)));
    await userEvent.click(screen.getByRole('button', { name: /^3$/ }));
    expect(await screen.findByText('A matéria da página 3')).toBeTruthy();

    await act(async () => {
      segunda.recusar(new Error('não foi possível falar com o servidor'));
    });
    expect(screen.queryByText(/não foi possível falar com o servidor/)).toBeNull();
    expect(screen.getByText('A matéria da página 3')).toBeTruthy();
  });
});
