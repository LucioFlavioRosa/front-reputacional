// @vitest-environment jsdom

/** A primeira tela do Painel de Inteligência de Mercado.
 *
 *  O QUE ESTE ARQUIVO PROTEGE:
 *
 *  1. que a tela abra COM O CATÁLOGO e sem cotação nenhuma — é a lição da aba
 *     Base do Score: a tela que mostra o dado não pode exigir dado, senão o
 *     seletor nasce vazio e ninguém sabe o que escolher;
 *  2. que o seletor mande os tickers escolhidos, e que DESLIGAR O ÚLTIMO volte
 *     ao padrão em vez de pedir um gráfico sem série;
 *  3. que trocar métrica troque a FAIXA FIXA do eixo, não só o rótulo — é a
 *     faixa que faz o eixo não se reformar entre recortes;
 *  4. que o índice venha DESTA rota, e não de `/api/score/serie`.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SerieDeMercado } from '@/api/cliente';

const { obterSerieDeMercado } = vi.hoisted(() => ({ obterSerieDeMercado: vi.fn() }));

vi.mock('@/api/cliente', () => ({ obterSerieDeMercado }));

//: O GRÁFICO VIRA MARCADOR: ele tem os próprios 15 testes, e montá-lo aqui
//: traria o `ResizeObserver` e a aritmética do SVG para dentro de um teste que
//: é sobre a TELA. O que interessa é o que a tela PASSA para ele.
const recebido: { bonds?: unknown; indice?: unknown; faixaFixa?: unknown; rotulo?: string } = {};
vi.mock('@/graficos/GraficoDeDoisEixos', () => ({
  GraficoDeDoisEixos: (props: {
    bonds: unknown;
    indice: unknown;
    faixaFixa: unknown;
    rotuloDaEsquerda: string;
  }) => {
    recebido.bonds = props.bonds;
    recebido.indice = props.indice;
    recebido.faixaFixa = props.faixaFixa;
    recebido.rotulo = props.rotuloDaEsquerda;
    return <p>GRAFICO</p>;
  },
}));

import { FAIXA_FIXA_DO_PRECO, FAIXA_FIXA_DO_YIELD } from '@/dominio/eixoDaSerie';
import { InteligenciaDeMercado } from './InteligenciaDeMercado';

const CATALOGO: SerieDeMercado['papeis'] = [
  { ticker: 'AEGEBZ29', descricao: null, emissor: 'Aegea', e_aegea: true },
  { ticker: 'AEGEBZ31', descricao: 'AEGEBZ 9 01/20/31', emissor: 'Aegea', e_aegea: true },
  { ticker: 'AEGEBZ36', descricao: null, emissor: 'Aegea', e_aegea: true },
  { ticker: 'PETBRA30', descricao: null, emissor: 'Petrobras', e_aegea: false },
];

function resposta(parcial: Partial<SerieDeMercado> = {}): SerieDeMercado {
  return {
    papeis: CATALOGO,
    bonds: [{ ticker: 'AEGEBZ31', pontos: [{ data: '2026-01-05', valor: 95.5 }] }],
    indice: [{ mes: '2026-01-01', isr: 52 }],
    metrica: 'preco',
    ...parcial,
  };
}

beforeEach(() => {
  obterSerieDeMercado.mockImplementation(() => Promise.resolve(resposta()));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ao abrir', () => {
  it('pede a série SEM tickers — o servidor decide "os da Aegea"', async () => {
    /** Mandar os tickers da Aegea explicitamente duplicaria na tela uma
     *  decisão que já está no servidor, e as duas divergiriam no dia em que a
     *  companhia emitisse um papel novo. */
    render(<InteligenciaDeMercado />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    expect(obterSerieDeMercado).toHaveBeenCalledWith(
      expect.objectContaining({ tickers: undefined, metrica: 'preco' }),
    );
  });

  it('mostra o seletor mesmo SEM cotação nenhuma', async () => {
    /** A lição da aba Base do Score: a tela que mostra o dado não pode exigir
     *  dado. Sem isto o seletor nasceria vazio e ninguém saberia o que
     *  escolher — e é justamente antes da primeira subida que alguém abre. */
    obterSerieDeMercado.mockImplementation(() =>
      Promise.resolve(resposta({ bonds: [], indice: [] })),
    );

    render(<InteligenciaDeMercado />);

    await waitFor(() => expect(screen.getByText('AEGEBZ31')).toBeTruthy());
    expect(screen.getByText('Petrobras · PETBRA30')).toBeTruthy();
  });

  it('o índice vem DESTA rota, e nenhuma chamada ao Score é feita', async () => {
    /** `/api/score/serie` exige o portal do Score: quem tem só o de mercado
     *  receberia 403 e a linha do eixo direito sairia vazia POR PERMISSÃO —
     *  indistinguível de falta de dado. */
    render(<InteligenciaDeMercado />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    expect(recebido.indice).toEqual([{ mes: '2026-01-01', valor: 52 }]);
  });

  it('o rótulo da série sai da DESCRIÇÃO quando ela existe', async () => {
    /** A descrição vem da planilha e só existe depois da primeira subida.
     *  Usar sempre o ticker faria a legenda falar Bloomberg com quem lê
     *  português. */
    render(<InteligenciaDeMercado />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    expect(recebido.bonds).toEqual([
      expect.objectContaining({ chave: 'AEGEBZ31', rotulo: 'AEGEBZ 9 01/20/31' }),
    ]);
  });
});

describe('a métrica', () => {
  it('trocar para yield troca a FAIXA FIXA do eixo, e não só o rótulo', async () => {
    /** É a faixa que faz o eixo esquerdo não se reformar entre recortes.
     *  Trocar só o rótulo deixaria o yield desenhado na régua do preço. */
    render(<InteligenciaDeMercado />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());
    expect(recebido.faixaFixa).toEqual(FAIXA_FIXA_DO_PRECO);

    screen.getByRole('button', { name: 'Yield' }).click();

    await waitFor(() => expect(recebido.faixaFixa).toEqual(FAIXA_FIXA_DO_YIELD));
    expect(recebido.rotulo).toContain('Yield');
  });

  it('o botão da métrica ativa diz que está pressionado', async () => {
    render(<InteligenciaDeMercado />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    expect(screen.getByRole('button', { name: 'Preço' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'Yield' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });
});

describe('o seletor de papéis', () => {
  it('ligar um par pede a série com os tickers escolhidos', async () => {
    render(<InteligenciaDeMercado />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    screen.getByRole('button', { name: /PETBRA30/ }).click();

    await waitFor(() => {
      const ultima = obterSerieDeMercado.mock.calls.at(-1)?.[0];
      expect(ultima?.tickers).toContain('PETBRA30');
      //: E os da Aegea CONTINUAM: ligar par é acrescentar comparação, não
      //: trocar de assunto.
      expect(ultima?.tickers).toContain('AEGEBZ31');
    });
  });

  it('desligar o ÚLTIMO papel volta ao padrão, e não a um gráfico vazio', async () => {
    /** Desligar tudo deixaria a tela em branco sem nada explicando por quê. */
    render(<InteligenciaDeMercado />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    for (const ticker of ['AEGEBZ29', 'AEGEBZ31', 'AEGEBZ36']) {
      screen.getByRole('button', { name: new RegExp(ticker) }).click();
    }

    await waitFor(() => {
      const ultima = obterSerieDeMercado.mock.calls.at(-1)?.[0];
      expect(ultima?.tickers).toBeUndefined();
    });
  });

  it('o chip desligado continua VISÍVEL, para poder ser ligado', async () => {
    render(<InteligenciaDeMercado />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    const par = screen.getByRole('button', { name: /PETBRA30/ });
    expect(par.getAttribute('aria-pressed')).toBe('false');
    expect(par).toBeTruthy();
  });
});

describe('o erro', () => {
  it('a falha da rota aparece como faixa, e não como tela em branco', async () => {
    /** Com a bandeira `mercado_lancado` desligada no back, esta rota devolve
     *  403 — e é exatamente o que acontece hoje. A tela tem de DIZER isso. */
    obterSerieDeMercado.mockImplementation(() =>
      Promise.reject(new Error('O Painel de Inteligência de Mercado ainda não foi lançado.')),
    );

    render(<InteligenciaDeMercado />);

    await waitFor(() =>
      expect(screen.getByText(/ainda não foi lançado/)).toBeTruthy(),
    );
  });
});


describe('a cor das séries', () => {
  /** OS DOIS DEFEITOS QUE EU MESMO SUSPEITEI, antes de a revisão chegar.
   *
   *  A primeira versão escolhia a cor pela POSIÇÃO NO CATÁLOGO e repetia a
   *  última do oitavo papel em diante. Com dois pares de posição alta ligados,
   *  as duas linhas ficavam IDÊNTICAS — e duas linhas da mesma cor afirmam que
   *  são a mesma série. O chip do par, por cima, usava um cinza FIXO: ligar um
   *  par desenhava uma curva que a legenda não identificava.
   */

  const cores = () => (recebido.bonds as { chave: string; cor: string }[]) ?? [];

  it('a tela abre com as TRÊS cores da especificação', async () => {
    /** 2029 laranja, 2031 azul-mar, 2036 violeta — os slots 0, 1 e 2. Sem a
     *  semeadura, as três curvas nasceriam na primeira cor. */
    obterSerieDeMercado.mockImplementation(() =>
      Promise.resolve(
        resposta({
          bonds: [
            { ticker: 'AEGEBZ29', pontos: [{ data: '2026-01-05', valor: 95 }] },
            { ticker: 'AEGEBZ31', pontos: [{ data: '2026-01-05', valor: 96 }] },
            { ticker: 'AEGEBZ36', pontos: [{ data: '2026-01-05', valor: 97 }] },
          ],
        }),
      ),
    );

    render(<InteligenciaDeMercado />);
    await waitFor(() => expect(cores()).toHaveLength(3));

    expect(cores().map((s) => s.cor)).toEqual(['#FE952B', '#0027BD', '#A11FFF']);
  });

  it('DESLIGAR uma série não repinta as que ficaram', async () => {
    /** A REGRA DE QUALQUER GRÁFICO HONESTO: a cor acompanha a entidade, nunca a
     *  posição dela numa lista que muda. Quem está olhando a curva azul tem de
     *  continuar olhando a MESMA curva azul quando outra sai. */
    obterSerieDeMercado.mockImplementation(() =>
      Promise.resolve(
        resposta({
          bonds: [
            { ticker: 'AEGEBZ29', pontos: [{ data: '2026-01-05', valor: 95 }] },
            { ticker: 'AEGEBZ31', pontos: [{ data: '2026-01-05', valor: 96 }] },
            { ticker: 'AEGEBZ36', pontos: [{ data: '2026-01-05', valor: 97 }] },
          ],
        }),
      ),
    );
    render(<InteligenciaDeMercado />);
    await waitFor(() => expect(cores()).toHaveLength(3));
    const azulAntes = cores().find((s) => s.chave === 'AEGEBZ31')?.cor;

    //: desliga o PRIMEIRO, que numa alocação por posição faria o 2031 andar
    //: para o slot 0 e trocar de cor
    screen.getByRole('button', { name: /AEGEBZ29/ }).click();

    await waitFor(() => {
      const ultima = obterSerieDeMercado.mock.calls.at(-1)?.[0];
      expect(ultima?.tickers).not.toContain('AEGEBZ29');
    });
    expect(cores().find((s) => s.chave === 'AEGEBZ31')?.cor).toBe(azulAntes);
  });

  it('o par ligado recebe uma cor PRÓPRIA, e o chip mostra ela', async () => {
    /** O chip usava cinza fixo, então a legenda não dizia qual curva era a do
     *  par. Agora o quadradinho do chip tem a cor da linha. */
    render(<InteligenciaDeMercado />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    const chip = screen.getByRole('button', { name: /PETBRA30/ });
    chip.click();

    await waitFor(() => {
      const ultima = obterSerieDeMercado.mock.calls.at(-1)?.[0];
      expect(ultima?.tickers).toContain('PETBRA30');
    });
    //: o quadrado do chip deixou de ser transparente — ele tem cor de série
    const quadrado = chip.querySelector('span');
    expect(quadrado?.getAttribute('style')).toMatch(/background:/);
    expect(quadrado?.getAttribute('style')).not.toContain('transparent');
  });

  it('a nona série é RECUSADA, com o limite dito na tela', async () => {
    /** Repetir cor faria duas curvas afirmarem que são a mesma série. O limite
     *  dito em voz alta é melhor — clicar e nada acontecer é indistinguível de
     *  um botão quebrado. */
    const muitos = Array.from({ length: 12 }, (_, i) => ({
      ticker: `PAR${i}`,
      descricao: null,
      emissor: `Empresa ${i}`,
      e_aegea: false,
    }));
    obterSerieDeMercado.mockImplementation(() =>
      Promise.resolve(resposta({ papeis: [...CATALOGO, ...muitos], bonds: [] })),
    );

    render(<InteligenciaDeMercado />);
    await waitFor(() => expect(screen.getByText('AEGEBZ31')).toBeTruthy());

    //: os três da Aegea já ocupam 3 slots; ligar cinco pares fecha os oito
    for (const i of [0, 1, 2, 3, 4]) {
      screen.getByRole('button', { name: new RegExp(`PAR${i}\\b`) }).click();
    }

    await waitFor(() =>
      expect(screen.getByText(/máximo que o gráfico distingue por cor/)).toBeTruthy(),
    );
    //: e o nono chip fica DESABILITADO, dizendo o que fazer
    const nono = screen.getByRole('button', { name: /PAR5\b/ });
    expect(nono.hasAttribute('disabled')).toBe(true);
    expect(nono.getAttribute('title')).toContain('Desligue uma série');
  });
});