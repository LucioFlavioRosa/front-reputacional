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
        lente: 'imprensa',
        lente_nome: 'Imprensa',
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

function montar(grupo: GrupoNaJanela = GRUPO) {
  return render(
    <RegistrosDaJanela
      grupo={grupo}
      ate="2026-05-20"
      de="2026-05-06"
      nivel="n2"
      aoFechar={() => {}}
    />,
  );
}

/** Uma página com registros de lentes diferentes — o caso que a coluna existe
 *  para explicar. */
function deTresLentes(): Pagina {
  const lentes: [string, string][] = [
    ['imprensa', 'Imprensa'],
    ['mercado', 'Mercado'],
    ['institucional', 'Institucional'],
  ];
  return {
    itens: lentes.map(([lente, lente_nome], i) => ({
      id: `m${i}`,
      data: '2026-05-18',
      veiculo: `Veículo ${lente}`,
      titulo: `Matéria de ${lente_nome}`,
      link: null,
      sentimento: 'pos',
      tier: 'muito_relevante',
      lente,
      lente_nome,
    })),
    total: 3,
    pagina: 1,
    tamanho: 50,
  };
}

describe('a coluna da lente', () => {
  /** O PEDIDO (21/10/2026): "deve ter uma coluna extra no modal para
   *  identificar de qual lente vem o registro". */

  beforeEach(() => {
    obterRegistrosDaJanela.mockReset();
  });

  it('DIZ A LENTE de cada registro, pelo nome que o servidor mandou', async () => {
    obterRegistrosDaJanela.mockResolvedValue(deTresLentes());
    montar();

    expect(await screen.findByText('Matéria de Mercado')).toBeTruthy();
    const cabecalhos = screen.getAllByRole('columnheader').map((c) => c.textContent);
    expect(cabecalhos).toEqual([
      'Data',
      'Lente',
      'Veículo',
      'Título',
      'Sentimento',
      'Tier',
    ]);
    //: QUAL LENTE EM QUAL LINHA, e não só que os três nomes aparecem na tela:
    //: conferir os nomes soltos deixaria passar justamente o defeito plausível
    //: de uma coluna nova — os rótulos trocados de linha. Cada linha é lida
    //: inteira, pelo par (título, lente).
    const linhas = screen
      .getAllByRole('row')
      .slice(1)
      .map((linha) => Array.from(linha.querySelectorAll('td')).map((c) => c.textContent));
    expect(linhas.map(([, lente, , titulo]) => [titulo, lente])).toEqual([
      ['Matéria de Imprensa', 'Imprensa'],
      ['Matéria de Mercado', 'Mercado'],
      ['Matéria de Institucional', 'Institucional'],
    ]);
  });

  it('o CABEÇALHO nomeia OS DOIS números quando eles diferem', async () => {
    //: ACHADO DE REVISÃO contra a minha primeira tentativa. Eu havia tirado do
    //: cabeçalho o número da linha do quadro e escrito "em 3 lentes" no lugar.
    //: Mas quem abre o modal está conferindo a linha que clicou: sem o número
    //: dela, a divergência fica sem explicação — e "em 3 lentes" era contado na
    //: PÁGINA, então uma primeira página só de Imprensa mostrava 120 registros
    //: de três lentes sem dizer nada sobre lente.
    //:
    //: E A FRASE PERDEU O "SÓ DA IMPRENSA" em 21/10/2026: o quadro passou a
    //: somar as mesmas três lentes desta lista (o impacto virou ponto do score
    //: geral), então a diferença deixou de ser de universo. Quando os números
    //: diferem agora, é porque o quadro deixa de fora a lente sem base de mês —
    //: sem denominador ela não contribui em ponto do índice, e a lista mostra as
    //: menções dela de qualquer forma.
    obterRegistrosDaJanela.mockResolvedValue(deTresLentes());
    montar({ ...GRUPO, mencoes: 1 });

    expect(await screen.findByText(/3 registros; o quadro conta 1$/)).toBeTruthy();
    expect(screen.queryByText(/só da Imprensa/)).toBeNull();
  });

  it('com os números IGUAIS, o cabeçalho diz um só', async () => {
    //: É o caso da maioria dos temas: matéria só na Imprensa. Repetir o mesmo
    //: número duas vezes seria ruído. (`pagina(1)` é a fixture das corridas, e
    //: o total dela é justamente o do grupo: 120.)
    obterRegistrosDaJanela.mockResolvedValue(pagina(1));
    montar();

    expect(await screen.findByText(/120 registros$/)).toBeTruthy();
    expect(screen.queryByText(/o quadro conta/)).toBeNull();
  });

  it('enquanto a leitura NÃO chega, o cabeçalho não arrisca número', async () => {
    //: Antes ele mostrava o número do grupo nesse intervalo, sozinho — e aquele
    //: número passou a ser de outra conta. Melhor não dizer do que dizer sem
    //: saber com o que comparar.
    const emVoo = presa();
    obterRegistrosDaJanela.mockImplementation(() => emVoo.promessa);
    montar();

    expect(await screen.findByText(/Lendo as menções/)).toBeTruthy();
    expect(screen.queryByText(/registro/)).toBeNull();
    expect(screen.queryByText(/120/)).toBeNull();

    await act(async () => {
      emVoo.soltar(pagina(1));
    });
    expect(await screen.findByText(/120 registros/)).toBeTruthy();
  });
});

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
