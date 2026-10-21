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
 *  3. que trocar métrica ou período devolva os eixos ao automático (a régua
 *     fixa saiu em 21/10/2026: os eixos se ajustam e aceitam zoom à mão);
 *  4. que o índice venha DESTA rota, e não de `/api/score/serie`.
 */

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImpactoNaJanela, SerieDeMercado } from '@/api/cliente';

const { obterSerieDeMercado, obterImpactoNaJanela, obterRegistrosDaJanela } = vi.hoisted(
  () => ({
    obterSerieDeMercado: vi.fn(),
    obterImpactoNaJanela: vi.fn(),
    obterRegistrosDaJanela: vi.fn(),
  }),
);

vi.mock('@/api/cliente', () => ({
  obterSerieDeMercado,
  obterImpactoNaJanela,
  obterRegistrosDaJanela,
}));

//: O GRÁFICO VIRA MARCADOR: ele tem os próprios 15 testes, e montá-lo aqui
//: traria o `ResizeObserver` e a aritmética do SVG para dentro de um teste que
//: é sobre a TELA. O que interessa é o que a tela PASSA para ele.
const recebido: {
  bonds?: unknown;
  indice?: unknown;
  chaveDaEscala?: string;
  inicioDoPeriodo?: string | null;
  rotulo?: string;
  dataEscolhida?: string | null;
  aoEscolherData?: (iso: string) => void;
  aoMudarJanela?: (janela: { de: string; ate: string }) => void;
  janela?: { de: string; ate: string };
} = {};

/** Escolhe uma data como o gráfico faria.
 *
 *  PELA FUNÇÃO QUE A TELA PASSOU, e não por um clique simulado no SVG: o
 *  componente real é dublado aqui (ele tem os próprios testes, incluindo os do
 *  clique e da conversão pixel→data).
 */
function escolherData(iso: string) {
  act(() => recebido.aoEscolherData?.(iso));
}

/** Arrasta a janela do navegador para `de`–`ate`, como a pessoa faria. */
function arrastarJanela(de: string, ate: string) {
  act(() => recebido.aoMudarJanela?.({ de, ate }));
}

function impacto(parcial: Partial<ImpactoNaJanela> = {}): ImpactoNaJanela {
  return {
    de: '2026-05-06',
    ate: '2026-05-20',
    mes: '2026-05-01',
    regua: 'contagem',
    positivos: [
      { id: 11, rotulo: 'Contratos e regulação', contexto: 'Governança', impacto: 1.5, mencoes: 10 },
      { id: 12, rotulo: 'Obras e investimentos', contexto: 'Crescimento', impacto: 0.8, mencoes: 6 },
    ],
    negativos: [
      { id: 21, rotulo: 'Abastecimento de água', contexto: 'Eficiência operacional', impacto: -2.3, mencoes: 14 },
      { id: 22, rotulo: 'Tarifa', contexto: 'Eficiência operacional', impacto: -0.9, mencoes: 5 },
    ],
    total_positivos: 2,
    total_negativos: 2,
    sem_grupo: 0,
    nivel: 'n2',
    sem_data: 0,
    mes_sem_base: false,
    lente: 'imprensa',
    dias: 15,
    ...parcial,
  };
}
//: SÓ O COMPONENTE É DUBLADO. `temCurva` vem do módulo DE VERDADE, de propósito:
//: é a regra que decide se uma série desenha curva, e a tela a usa para dizer
//: quais papéis voltaram mudos. Dublá-la faria este arquivo testar uma regra
//: inventada aqui em vez da que roda no navegador — e foi justamente a
//: divergência entre duas regras (`pontos.length` aqui, data válida lá) que a
//: revisão pegou.
//: O NAVEGADOR TAMBÉM VIRA MARCADOR: ele tem os próprios testes. Aqui interessa
//: a janela que a tela passa e a função que ela recebe de volta.
vi.mock('@/graficos/NavegadorDoPeriodo', async (importarOriginal) => ({
  ...(await importarOriginal<typeof import('@/graficos/NavegadorDoPeriodo')>()),
  NavegadorDoPeriodo: (props: {
    janela: { de: string; ate: string };
    aoMudar: (janela: { de: string; ate: string }) => void;
  }) => {
    recebido.aoMudarJanela = props.aoMudar;
    recebido.janela = props.janela;
    return <p>NAVEGADOR</p>;
  },
}));

vi.mock('@/graficos/GraficoDeDoisEixos', async (importarOriginal) => ({
  ...(await importarOriginal<typeof import('@/graficos/GraficoDeDoisEixos')>()),
  GraficoDeDoisEixos: (props: {
    bonds: unknown;
    indice: unknown;
    chaveDaEscala?: string;
    inicioDoPeriodo?: string | null;
    rotuloDaEsquerda: string;
    dataEscolhida?: string | null;
    aoEscolherData?: (iso: string) => void;
  }) => {
    recebido.bonds = props.bonds;
    recebido.indice = props.indice;
    recebido.chaveDaEscala = props.chaveDaEscala;
    recebido.inicioDoPeriodo = props.inicioDoPeriodo;
    recebido.rotulo = props.rotuloDaEsquerda;
    recebido.dataEscolhida = props.dataEscolhida;
    recebido.aoEscolherData = props.aoEscolherData;
    return <p>GRAFICO</p>;
  },
}));

import { mercadoMudou } from '@/dominio/sincronizacao';
import { InteligenciaDeMercado, TETO_DA_BUSCA } from './InteligenciaDeMercado';

const CATALOGO: SerieDeMercado['papeis'] = [
  { ticker: 'AEGEBZ29', descricao: null, emissor: 'Aegea', e_aegea: true },
  { ticker: 'AEGEBZ31', descricao: 'AEGEBZ 9 01/20/31', emissor: 'Aegea', e_aegea: true },
  { ticker: 'AEGEBZ36', descricao: null, emissor: 'Aegea', e_aegea: true },
  { ticker: 'PETBRA30', descricao: null, emissor: 'Petrobras', e_aegea: false },
];

function resposta(parcial: Partial<SerieDeMercado> = {}): SerieDeMercado {
  return {
    papeis: CATALOGO,
    bonds: [
      {
        ticker: 'AEGEBZ31',
        pontos: [
          { data: '2026-01-05', valor: 95.5 },
          { data: '2026-05-29', valor: 96 },
        ],
      },
    ],
    //: COM NOTA DA IMPRENSA EM MAIO, para os temas poderem terminar em maio
    //: (eles param no último mês com nota da imprensa).
    indice: [
      { mes: '2026-01-01', isr: 52 },
      { mes: '2026-05-01', isr: 54, lentes: { imprensa: 60 } },
    ],
    metrica: 'preco',
    ...parcial,
  };
}

beforeEach(() => {
  obterImpactoNaJanela.mockImplementation(() => Promise.resolve(impacto()));
  //: O DUBLÊ ECOA A MÉTRICA PEDIDA, como o servidor faz.
  //:
  //: Antes ele devolvia `metrica: 'preco'` SEMPRE, e isso fazia o teste do
  //: yield passar sem provar nada — achado de revisão. Agora que o rótulo do
  //: eixo sai da RESPOSTA e não do botão (para não dizer "Yield" sobre uma
  //: curva de preço), um dublê que mente sobre a métrica derruba o teste, que é
  //: o certo.
  obterSerieDeMercado.mockImplementation((opcoes?: { metrica?: 'preco' | 'yield' }) =>
    Promise.resolve(resposta({ metrica: opcoes?.metrica ?? 'preco' })),
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ao abrir', () => {
  it('pede a série SEM tickers — o servidor decide "os da Aegea"', async () => {
    /** Mandar os tickers da Aegea explicitamente duplicaria na tela uma
     *  decisão que já está no servidor, e as duas divergiriam no dia em que a
     *  companhia emitisse um papel novo. */
    render(<InteligenciaDeMercado comPares />);
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

    render(<InteligenciaDeMercado comPares />);

    await waitFor(() => expect(screen.getByText('AEGEBZ31')).toBeTruthy());
    expect(screen.getByText('Petrobras · PETBRA30')).toBeTruthy();
  });

  it('o índice vem DESTA rota, e nenhuma chamada ao Score é feita', async () => {
    /** `/api/score/serie` exige o portal do Score: quem tem só o de mercado
     *  receberia 403 e a linha do eixo direito sairia vazia POR PERMISSÃO —
     *  indistinguível de falta de dado. */
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    //: UMA CURVA, A DO ÍNDICE — é a única ligada ao abrir. As lentes entram
    //: por botão; ver os testes dos scores, no fim deste arquivo.
    expect(recebido.indice).toEqual([
      {
        chave: 'isr',
        rotulo: 'Índice geral',
        cor: expect.any(String),
        traco: expect.any(String),
        pontos: [
          { mes: '2026-01-01', valor: 52 },
          { mes: '2026-05-01', valor: 54 },
        ],
      },
    ]);
  });

  it('a série se chama pelo TICKER, e o card traduz a descrição Bloomberg', async () => {
    /** "AEGEBZ 9 01/20/31" era o nome da curva no tooltip, e é Bloomberg. O
     *  card mostra o ticker e, embaixo, cupom e vencimento em português. */
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    expect(recebido.bonds).toEqual([
      expect.objectContaining({ chave: 'AEGEBZ31', rotulo: 'AEGEBZ31' }),
    ]);
    expect(screen.getByText('Cupom 9% · vence em 20/01/2031')).toBeTruthy();
  });
});

describe('a métrica', () => {
  it('trocar para yield troca o rótulo e devolve os eixos ao automático', async () => {
    /** Um zoom escolhido à mão para o preço não serve para o yield: a chave
     *  da escala muda junto com a métrica, e o gráfico volta ao automático. */
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());
    expect(recebido.chaveDaEscala).toContain('preco');

    screen.getByRole('button', { name: 'Yield' }).click();

    await waitFor(() => expect(recebido.chaveDaEscala).toContain('yield'));
    expect(recebido.rotulo).toContain('Yield');
  });

  it('o botão da métrica ativa diz que está pressionado', async () => {
    render(<InteligenciaDeMercado comPares />);
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
    render(<InteligenciaDeMercado comPares />);
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
    render(<InteligenciaDeMercado comPares />);
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
    render(<InteligenciaDeMercado comPares />);
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

    render(<InteligenciaDeMercado comPares />);

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

    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(cores()).toHaveLength(3));

    //: O 2029 PASSOU DE LARANJA A VERDE-ÁGUA por pedido (21/10/2026).
    expect(cores().map((s) => s.cor)).toEqual(['#0FA392', '#0027BD', '#A11FFF']);
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
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(cores()).toHaveLength(3));
    const azulAntes = cores().find((s) => s.chave === 'AEGEBZ31')?.cor;

    //: desliga o PRIMEIRO, que numa alocação por posição faria o 2031 andar
    //: para o slot 0 e trocar de cor. O CARD é o botão desde 21/10/2026.
    screen.getByRole('button', { name: /AEGEBZ29/ }).click();

    //: SAI DO GRÁFICO, mas continua sendo PEDIDO: o card dele mostra o último
    //: fechamento com a curva desligada.
    await waitFor(() => expect(cores().map((s) => s.chave)).not.toContain('AEGEBZ29'));
    expect(obterSerieDeMercado.mock.calls.at(-1)?.[0]?.tickers).toContain('AEGEBZ29');
    expect(cores().find((s) => s.chave === 'AEGEBZ31')?.cor).toBe(azulAntes);
  });

  it('o par ligado recebe uma cor PRÓPRIA, e o chip mostra ela', async () => {
    /** O chip usava cinza fixo, então a legenda não dizia qual curva era a do
     *  par. Agora o quadradinho do chip tem a cor da linha. */
    render(<InteligenciaDeMercado comPares />);
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

    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('AEGEBZ31')).toBeTruthy());

    //: os três da Aegea já ocupam 3 slots; ligar cinco pares fecha os oito
    for (const i of [0, 1, 2, 3, 4]) {
      screen.getByRole('button', { name: new RegExp(`PAR${i}\\b`) }).click();
    }

    //: O LIMITE É DITO AO LADO DOS CHIPS, quando chega. O contador "N de 8"
    //: saiu por pedido (21/10/2026); a frase aparece no oitavo.
    await waitFor(() => expect(screen.getByTestId('limite-de-series')).toBeTruthy());
    const limite = screen.getByTestId('limite-de-series');
    expect(limite.textContent).toContain('8 séries');
    expect(limite.textContent).toContain('Desligue uma para ligar outra');
    //: e o nono chip fica DESABILITADO, dizendo o que fazer
    const nono = screen.getByRole('button', { name: /PAR5\b/ });
    expect(nono.hasAttribute('disabled')).toBe(true);
    expect(nono.getAttribute('title')).toContain('Desligue uma série');
  });

  it('longe do limite, a frase do limite NÃO aparece', async () => {
    /** O contador "3 de 8" saiu por pedido. O aviso só faz sentido quando
     *  acabaram as cores. */
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    expect(screen.queryByTestId('limite-de-series')).toBeNull();
  });
});

describe('o período e os cards de cotação (21/10/2026)', () => {
  const serieLonga = () =>
    resposta({
      bonds: [
        {
          ticker: 'AEGEBZ31',
          pontos: [
            //: UM PREGÃO ANTIGO, para o 6M não ficar preso no primeiro dado.
            { data: '2026-01-02', valor: 88 },
            { data: '2026-08-31', valor: 90 },
            { data: '2026-09-18', valor: 91 },
            { data: '2026-09-21', valor: 91.6 },
          ],
        },
      ],
    });

  it('trocar o período NÃO busca de novo: o corte vai ao gráfico, contado do último dado', async () => {
    obterSerieDeMercado.mockImplementation(() => Promise.resolve(serieLonga()));
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(recebido.inicioDoPeriodo).toBe('2026-03-21'));
    const chamadas = obterSerieDeMercado.mock.calls.length;

    screen.getByRole('button', { name: '1M' }).click();

    await waitFor(() => expect(recebido.inicioDoPeriodo).toBe('2026-08-21'));
    expect(obterSerieDeMercado.mock.calls.length).toBe(chamadas);
    expect(obterSerieDeMercado.mock.calls.at(-1)?.[0]?.de).toBeUndefined();
  });

  it('os atalhos são 1M, 3M, 6M, 12M, Ano atual e Tudo', async () => {
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());
    for (const rotulo of ['1M', '3M', '6M', '12M', 'Ano atual', 'Tudo']) {
      expect(screen.getByRole('button', { name: rotulo })).toBeTruthy();
    }
  });

  it('o card mostra o último fechamento e as variações da semana e do mês', async () => {
    obterSerieDeMercado.mockImplementation(() => Promise.resolve(serieLonga()));
    render(<InteligenciaDeMercado comPares />);
    const card = await screen.findByRole('button', { name: /AEGEBZ31: tirar do gráfico/ });

    expect(card.textContent).toContain('91,6');
    expect(card.textContent).toContain('21/09/2026');
    //: semana: 91,6 − 91 (sexta, 18/09); mês: 91,6 − 90 (31/08)
    expect(card.textContent).toContain('+0,6 pts');
    expect(card.textContent).toContain('+1,6 pts');
  });

  it('o card desligado continua mostrando a cotação', async () => {
    obterSerieDeMercado.mockImplementation(() => Promise.resolve(serieLonga()));
    render(<InteligenciaDeMercado comPares />);
    const card = await screen.findByRole('button', { name: /AEGEBZ31: tirar do gráfico/ });

    card.click();

    const desligado = await screen.findByRole('button', { name: /AEGEBZ31: mostrar no gráfico/ });
    expect(desligado.getAttribute('aria-pressed')).toBe('false');
    expect(desligado.textContent).toContain('91,6');
  });
});

describe('enquanto a resposta nova não chega', () => {
  /** O ACHADO MAIS GRAVE DA REVISÃO: trocar de preço para yield mudava o rótulo
   *  do eixo e a faixa fixa NA HORA, enquanto os pontos continuavam sendo os de
   *  preço até a resposta chegar. O gráfico dizia "Yield (%)" sobre uma curva
   *  de preço — dado falso, com aparência de certo.
   */

  it('o rótulo do eixo NÃO muda antes dos pontos', async () => {
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());
    expect(recebido.rotulo).toContain('Preço');

    //: a segunda busca NUNCA responde: é a janela que o defeito ocupava
    obterSerieDeMercado.mockImplementation(() => new Promise(() => {}));
    screen.getByRole('button', { name: 'Yield' }).click();

    await waitFor(() => expect(screen.getByText('Atualizando…')).toBeTruthy());
    //: o rótulo e a escala continuam os do dado DESENHADO
    expect(recebido.rotulo).toContain('Preço');
    expect(recebido.chaveDaEscala).toContain('preco');
  });

  it('o botão JÁ mostra a escolha, para o clique não parecer perdido', async () => {
    /** As duas coisas convivem: o botão diz o que a pessoa pediu, o gráfico diz
     *  o que está desenhado, e o "Atualizando…" liga os dois. */
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    obterSerieDeMercado.mockImplementation(() => new Promise(() => {}));
    screen.getByRole('button', { name: 'Yield' }).click();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Yield' }).getAttribute('aria-pressed')).toBe(
        'true',
      ),
    );
  });

  it('o gráfico NÃO fica com cara de desabilitado enquanto busca', async () => {
    /** `opacity: 0.5` foi achado da passada de UX: meia opacidade é o idioma de
     *  "este controle está desligado", e numa tela que a pessoa já suspeitava de
     *  travada isso confirmava a suspeita errada. O recado é "estou trabalhando",
     *  e quem o dá é o selo "Atualizando…" sobre o gráfico — não o apagamento.
     *
     *  A CURVA ANTIGA CONTINUA LEGÍVEL, que é o ponto: ela é o melhor dado
     *  disponível até a resposta nova chegar, e some só se estiver errada. */
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    obterSerieDeMercado.mockImplementation(() => new Promise(() => {}));
    screen.getByRole('button', { name: 'Yield' }).click();

    await waitFor(() => expect(screen.getByText('Atualizando…')).toBeTruthy());
    const moldura = screen.getByText('GRAFICO').closest('[aria-busy]') as HTMLElement;
    const opacidade = Number(moldura.style.opacity || '1');
    expect(opacidade).toBeGreaterThanOrEqual(0.85);
  });

  it('o gráfico fica com `aria-busy`, para o leitor de tela saber', async () => {
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    obterSerieDeMercado.mockImplementation(() => new Promise(() => {}));
    screen.getByRole('button', { name: 'Yield' }).click();

    await waitFor(() => {
      const moldura = screen.getByText('GRAFICO').closest('[aria-busy]');
      expect(moldura?.getAttribute('aria-busy')).toBe('true');
    });
  });
});

describe('depois de subir a planilha, sem F5', () => {
  /** O PEDIDO, nas palavras dele: "ao subir os dados eu gostaria de ver
   *  automaticamente os dados no gráfico sem ficar dando F5, como já feito em
   *  lentes do score".
   *
   *  O MECANISMO É O MESMO do Score, e a lição também: o `Sincronizador` avisa
   *  depois de qualquer escrita bem-sucedida sob `/api/mercado` e já esqueceu o
   *  cache da API — mas **esquecer o cache não faz ninguém buscar de novo**, só
   *  garante que a próxima busca seja de verdade. Quem busca é este contador.
   *
   *  BARRAMENTO PRÓPRIO, e não o do Score: `ROTAS_DO_SCORE` é `/api/score`, e
   *  a subida de bonds não casa com ele. Um barramento só faria toda subida de
   *  planilha de fornecedor rebuscar a série de bonds.
   */

  it('o aviso do barramento faz a tela buscar de novo', async () => {
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());
    const antes = obterSerieDeMercado.mock.calls.length;

    //: O QUE A SUBIDA FAZ, exatamente: `api/nucleo.ts` chama isto depois do
    //: POST em `/api/mercado/bonds/importar`.
    mercadoMudou.avisar();

    await waitFor(() =>
      expect(obterSerieDeMercado.mock.calls.length).toBeGreaterThan(antes),
    );
  });

  it('a série nova aparece no gráfico', async () => {
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());
    //: OS DOIS PREGÕES DA RESPOSTA PADRÃO (janeiro e maio).
    expect((recebido.bonds as { pontos: unknown[] }[])[0].pontos).toHaveLength(2);

    obterSerieDeMercado.mockImplementation(() =>
      Promise.resolve(
        resposta({
          bonds: [
            {
              ticker: 'AEGEBZ31',
              pontos: [
                { data: '2026-01-05', valor: 95.5 },
                { data: '2026-01-06', valor: 96.1 },
                { data: '2026-01-07', valor: 96.4 },
              ],
            },
          ],
        }),
      ),
    );
    mercadoMudou.avisar();

    await waitFor(() =>
      expect((recebido.bonds as { pontos: unknown[] }[])[0].pontos).toHaveLength(3),
    );
  });

  it('o papel LIGADO que voltou SEM COTAÇÃO é dito pelo nome', async () => {
    /** RELATADO EM 19/10/2026: "em alguns momentos a tela trava quando eu mudo
     *  alguma fonte de dados ou métrica, daí preciso dar F5".
     *
     *  NÃO ERA O SERVIDOR: os logs do ambiente mostram 200 em 60–95ms para
     *  TODAS as requisições daquela sessão, inclusive `tickers=AEGEBZ29` — que é
     *  o papel sem cotação na planilha. O back semeia a série vazia e a devolve
     *  de propósito (`serie_de_mercado.py:153` e `:168`), e o gráfico descarta
     *  quem não tem ponto (`GraficoDeDoisEixos.tsx:263`).
     *
     *  O RESULTADO ERA UM CLIQUE SEM EFEITO VISÍVEL: o chip acende, ganha cor, e
     *  curva nenhuma aparece. Nada na tela distinguia "este papel não negociou
     *  neste período" de "a tela parou de responder" — e a saída que sobra é o
     *  F5. Vale para a troca de métrica também: um papel com preço e sem yield
     *  desaparece ao trocar para yield.
     *
     *  O DUBLÊ JÁ ERA ASSIM desde o primeiro teste deste arquivo: o catálogo tem
     *  três papéis da Aegea (todos ligados por padrão) e a resposta traz série de
     *  UM. Os outros dois já estavam acesos e mudos aqui, e ninguém viu. */
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    const aviso = screen.getByTestId('sem-cotacao');
    expect(aviso.textContent).toContain('AEGEBZ29');
    expect(aviso.textContent).toContain('AEGEBZ36');
    //: O QUE TEM DADO NÃO ENTRA NA LISTA, senão o aviso não informa nada.
    expect(aviso.textContent).not.toContain('AEGEBZ31');
    //: NEM O QUE ESTÁ DESLIGADO: PETBRA30 não foi escolhido, e dizer que ele não
    //: tem cotação seria reclamar de uma pergunta que ninguém fez.
    expect(aviso.textContent).not.toContain('PETBRA30');
  });

  it('com TODAS as séries cheias o aviso NÃO aparece', async () => {
    /** O controle: um aviso que está sempre na tela é ruído, e deixa de ser
     *  lido justamente quando passa a importar. */
    obterSerieDeMercado.mockImplementation(() =>
      Promise.resolve(
        resposta({
          bonds: [
            { ticker: 'AEGEBZ29', pontos: [{ data: '2026-01-05', valor: 99 }] },
            { ticker: 'AEGEBZ31', pontos: [{ data: '2026-01-05', valor: 95.5 }] },
            { ticker: 'AEGEBZ36', pontos: [{ data: '2026-01-05', valor: 97 }] },
          ],
        }),
      ),
    );
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    expect(screen.queryByTestId('sem-cotacao')).toBeNull();
  });

  it('a falha NÃO engole os controles, e dá para tentar de novo', async () => {
    /** O BECO SEM SAÍDA: `if (erro) return <FaixaDeErro/>` trocava a tela
     *  INTEIRA pela faixa — período, métrica e os chips sumiam junto. Quem
     *  pegasse uma falha de rede num clique não tinha mais nada para clicar, e a
     *  única saída era o F5. A faixa dizia o que aconteceu e tirava da pessoa a
     *  capacidade de reagir.
     *
     *  A FORMA CERTA É A QUE O `buscando` JÁ USAVA: a curva anterior continua na
     *  tela, os controles continuam de pé, e a falha aparece como faixa ao lado
     *  — com um botão que repete a busca. */
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    obterSerieDeMercado.mockImplementation(() =>
      Promise.reject(new Error('Não foi possível falar com o servidor.')),
    );
    screen.getByRole('button', { name: 'Yield' }).click();

    await waitFor(() => expect(screen.getByText(/não foi possível falar/i)).toBeTruthy());
    //: OS CONTROLES CONTINUAM LÁ.
    expect(screen.getByRole('button', { name: 'Yield' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '6M' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /AEGEBZ31/ })).toBeTruthy();
    //: E O GRÁFICO ANTERIOR TAMBÉM: apagá-lo perderia o que a pessoa estava
    //: lendo por causa de uma falha que pode ser de um segundo.
    expect(screen.getByText('GRAFICO')).toBeTruthy();

    //: TENTAR DE NOVO BUSCA DE NOVO, e volta ao normal quando dá certo.
    obterSerieDeMercado.mockImplementation(() => Promise.resolve(resposta()));
    const antesDoRetry = obterSerieDeMercado.mock.calls.length;
    screen.getByRole('button', { name: 'Tentar de novo' }).click();

    //: A CHAMADA NOVA É O QUE PROVA O BOTÃO — achado de revisão: sem esta
    //: asserção, um botão que só limpasse o erro sem rebuscar passaria no teste.
    await waitFor(() =>
      expect(obterSerieDeMercado.mock.calls.length).toBeGreaterThan(antesDoRetry),
    );
    await waitFor(() => expect(screen.queryByText(/não foi possível falar/i)).toBeNull());
  });

  it('a busca que NUNCA responde não deixa a tela em "Atualizando…" para sempre', async () => {
    /** O ÚNICO MECANISMO QUE AINDA SOBRAVA para a tela ficar visualmente presa.
     *
     *  A revisão foi clara: a guarda `ativo` está correta e descarta resposta
     *  velha, mas nada protege contra uma promessa que NUNCA resolve nem
     *  rejeita. Nesse caso `buscando` fica `true` eternamente, o gráfico fica em
     *  `opacity: 0.5` e o "Atualizando…" não sai — que é exatamente o que ele
     *  descreveu como travar, e aí só o F5 resolve.
     *
     *  NÃO APARECEU NOS LOGS daquela sessão (todas as respostas vieram em
     *  60–95ms), mas a lacuna é real e o conserto é o mesmo que a falha já tem:
     *  dizer o que houve e oferecer saída. */
    vi.useFakeTimers();
    try {
      obterSerieDeMercado.mockImplementation(() => new Promise(() => {}));
      render(<InteligenciaDeMercado comPares />);

      //: DENTRO DE `act`: o relógio muda estado FORA de um evento do React, e
      //: sem isto a renderização não é aplicada antes da asserção — o teste
      //: falharia dizendo que a frase não existe, com a correção no lugar.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(TETO_DA_BUSCA + 100);
      });

      expect(screen.getByText(/demorou demais/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy();
      expect(screen.queryByText('Atualizando…')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('SEM aviso nenhum a tela não fica rebuscando sozinha', async () => {
    /** O controle negativo que impede o conserto de virar um laço — o mesmo
     *  que o da tela do Score tem. */
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());
    const assentado = obterSerieDeMercado.mock.calls.length;

    await new Promise((resolver) => setTimeout(resolver, 60));

    expect(obterSerieDeMercado.mock.calls.length).toBe(assentado);
  });
});

describe('os temas da janela, ao clicar numa data', () => {
  /** O PEDIDO: "quero poder clicar em alguma data seja no gráfico ou seja no
   *  eixo, que você pega a data e subtrai 15 dias, pega esse recorte de data e
   *  me traga dois quadros logo abaixo do gráfico, um quadro com os 5 N2 que
   *  mais impactaram positivamente o score e 5 N1 que mais impactaram (os quadros
   *  passaram para o N2 depois, por pedido dele: ver somas_por_n2_na_janela)
   *  negativamente, mas para isso considere nesse momento somente dados da
   *  lente de impressa".
   */

  it('ANTES do clique não há quadro nenhum, e a tela convida', async () => {
    /** O CLIQUE VOLTOU (21/10/2026): o navegador escolhe o que se VÊ, o clique
     *  escolhe o recorte dos temas. Dois quadros vazios na abertura seriam
     *  ruído, e pareceriam dado que não carregou. */
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    expect(screen.queryByTestId('quadro-positivos')).toBeNull();
    expect(obterImpactoNaJanela).not.toHaveBeenCalled();
    expect(screen.getByText(/clique numa data/i)).toBeTruthy();
  });

  it('ARRASTAR O NAVEGADOR não busca temas: ele só muda o que se vê', async () => {
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('NAVEGADOR')).toBeTruthy());

    arrastarJanela('2026-05-06', '2026-05-20');

    await waitFor(() => expect(recebido.inicioDoPeriodo).toBe('2026-05-06'));
    expect(obterImpactoNaJanela).not.toHaveBeenCalled();
  });

  it('o clique busca a janela e desenha os DOIS quadros', async () => {
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    escolherData('2026-05-20');

    await waitFor(() => expect(obterImpactoNaJanela).toHaveBeenCalledWith('2026-05-20', 'n3', 15));
    await waitFor(() => expect(screen.getByTestId('quadro-positivos')).toBeTruthy());

    const positivos = screen.getByTestId('quadro-positivos');
    expect(positivos.textContent).toContain('Contratos e regulação');
    //: E O PILAR COMO CONTEXTO, que é o que mantém a lista legível com 41 temas.
    expect(positivos.textContent).toContain('Governança');
    expect(positivos.textContent).toContain('+1,5');
    const negativos = screen.getByTestId('quadro-negativos');
    expect(negativos.textContent).toContain('Abastecimento');
    expect(negativos.textContent).toContain('−2,3');
  });

  it('a tela diz A JANELA e A LENTE que o servidor devolveu', async () => {
    /** Não as que a tela pediu: os dois divergem enquanto a resposta não chega,
     *  e foi assim que o rótulo do eixo mentiu sobre a métrica — achado da
     *  revisão daquele bloco. */
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    escolherData('2026-05-20');

    await waitFor(() => expect(screen.getByTestId('quadro-positivos')).toBeTruthy());
    const cabecalho = screen.getByTestId('cabecalho-da-janela');
    expect(cabecalho.textContent).toContain('06/05/2026');
    expect(cabecalho.textContent).toContain('20/05/2026');
    expect(cabecalho.textContent?.toLowerCase()).toContain('imprensa');
  });

  it('o quadro com MENOS de cinco diz o tamanho real', async () => {
    obterImpactoNaJanela.mockImplementation(() =>
      Promise.resolve(
        impacto({
          positivos: [{ id: 11, rotulo: 'Contratos e regulação', contexto: 'Governança', impacto: 1.5, mencoes: 10 }],
          total_positivos: 1,
        }),
      ),
    );
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    escolherData('2026-05-20');

    await waitFor(() => expect(screen.getByTestId('quadro-positivos')).toBeTruthy());
    expect(screen.getByTestId('quadro-positivos').textContent).toContain('1 de 1');
  });

  it('o quadro VAZIO diz que não houve, em vez de ficar em branco', async () => {
    obterImpactoNaJanela.mockImplementation(() =>
      Promise.resolve(impacto({ negativos: [], total_negativos: 0 })),
    );
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    escolherData('2026-05-20');

    await waitFor(() => expect(screen.getByTestId('quadro-negativos')).toBeTruthy());
    expect(screen.getByTestId('quadro-negativos').textContent).toMatch(/nada empurrou/i);
  });

  it('o MÊS SEM BASE diz outra coisa que não "nada impactou"', async () => {
    /** "Não há como medir" e "nada impactou" são diferentes, e os dois quadros
     *  vazios parecem iguais. */
    obterImpactoNaJanela.mockImplementation(() =>
      Promise.resolve(
        impacto({ positivos: [], negativos: [], total_positivos: 0, total_negativos: 0, mes_sem_base: true }),
      ),
    );
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    escolherData('2026-05-20');

    await waitFor(() => expect(screen.getByText(/não tem base/i)).toBeTruthy());
    expect(screen.queryByTestId('quadro-positivos')).toBeNull();
  });

  it('o que ficou de FORA da conta é dito', async () => {
    /** Menção sem N1 e menção sem data: as duas existem, pesam no índice e não
     *  aparecem nos quadros. Engoli-las faria os quadros parecerem o todo. */
    obterImpactoNaJanela.mockImplementation(() =>
      Promise.resolve(impacto({ sem_grupo: 7, sem_data: 12 })),
    );
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    escolherData('2026-05-20');

    await waitFor(() => expect(screen.getByTestId('fora-da-conta')).toBeTruthy());
    const fora = screen.getByTestId('fora-da-conta');
    expect(fora.textContent).toContain('7');
    expect(fora.textContent).toContain('12');
  });

  it('dá para FECHAR a janela e voltar ao convite', async () => {
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());
    escolherData('2026-05-20');
    await waitFor(() => expect(screen.getByTestId('quadro-positivos')).toBeTruthy());

    screen.getByRole('button', { name: /fechar a janela/i }).click();

    await waitFor(() => expect(screen.queryByTestId('quadro-positivos')).toBeNull());
    expect(screen.getByText(/clique numa data/i)).toBeTruthy();
  });

  it('arrastar a janela apaga o atalho aceso', async () => {
    /** O atalho e a janela ficam sincronizados: com a janela arrastada, nenhum
     *  atalho afirma o período; clicar num atalho volta a ele. */
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('NAVEGADOR')).toBeTruthy());
    expect(screen.getByRole('button', { name: '6M' }).getAttribute('aria-pressed')).toBe('true');

    arrastarJanela('2026-05-06', '2026-05-20');

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '6M' }).getAttribute('aria-pressed')).toBe('false'),
    );
    expect(recebido.janela).toEqual({ de: '2026-05-06', ate: '2026-05-20' });

    screen.getByRole('button', { name: '1M' }).click();
    await waitFor(() => expect(recebido.janela).toEqual({ de: '2026-04-29', ate: '2026-05-29' }));
  });

  it('a falha da janela NÃO engole o gráfico', async () => {
    /** A mesma lição do beco sem saída de hoje: a janela é um pedaço da tela, e
     *  a falha dela não pode levar o resto. */
    obterImpactoNaJanela.mockImplementation(() =>
      Promise.reject(new Error('Não foi possível ler a janela.')),
    );
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    escolherData('2026-05-20');

    await waitFor(() => expect(screen.getByText(/não foi possível ler a janela/i)).toBeTruthy());
    expect(screen.getByText('GRAFICO')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Yield' })).toBeTruthy();
  });

  it('o SEGUNDO clique não deixa a janela ANTIGA na tela', async () => {
    /** ACHADO DE REVISÃO, e é do mesmo tipo que o rótulo do eixo que mentia
     *  sobre a métrica: ao clicar numa data nova, o código limpava o erro e NÃO
     *  a janela. Até a resposta chegar, os quadros antigos continuavam na tela —
     *  com o cabeçalho do período anterior — enquanto a marca do gráfico já
     *  apontava para a data nova. Os números afirmavam uma janela, e o gráfico
     *  afirmava outra.
     *
     *  O teste de antes cobria UM clique só, e por isso não via nada. */
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());
    escolherData('2026-05-20');
    await waitFor(() =>
      expect(screen.getByTestId('cabecalho-da-janela').textContent).toContain('20/05/2026'),
    );

    //: a segunda resposta NUNCA chega: é a janela que o defeito ocupava
    obterImpactoNaJanela.mockImplementation(() => new Promise(() => {}));
    escolherData('2026-04-10');

    //: OS QUADROS ANTIGOS SAEM, e a tela diz que está lendo a data nova.
    await waitFor(() => expect(screen.queryByTestId('quadro-positivos')).toBeNull());
    expect(screen.getByText(/lendo os subtemas de 10\/04\/2026/i)).toBeTruthy();
  });

  it('a tela diz DE QUAL MÊS são os pontos, e com que régua', async () => {
    /** ACHADO DE REVISÃO: a resposta trazia `mes` e `regua` e a tela mostrava só
     *  lente e datas. Sem isso, "−2,3 pt" não diz pontos DE QUÊ — e o contrato
     *  da conta é justamente que o denominador é o do mês do clique.
     *
     *  IMPORTA MAIS QUANDO A JANELA ATRAVESSA A VIRADA: aí o numerador tem
     *  menções de dois meses e o denominador é de um, então o número pode passar
     *  do que aquele mês inteiro movimentou. A ordem dos pilares continua exata;
     *  a escala, não — e quem lê precisa saber disso. */
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    escolherData('2026-05-20');

    await waitFor(() => expect(screen.getByTestId('cabecalho-da-janela')).toBeTruthy());
    const regua = screen.getByTestId('regua-da-janela');
    expect(regua.textContent).toContain('05/2026');
    expect(regua.textContent?.toLowerCase()).toContain('contagem');
  });

  it('CLICAR num tema do quadro abre os registros dele', async () => {
  /** O PEDIDO: "se eu clicar em alguma dessas opções quero que abra um modal
   *  com os registros do tema ou pilar, assim como fazemos nas lentes no KPI".
   *
   *  O QUE O TESTE AMARRA, e é a razão de a rota ser própria: o modal pede o
   *  grupo pelo **id** e repassa o MESMO `ate` e o MESMO `nivel` do quadro. Pelo
   *  rótulo, dois temas homônimos sob pilares diferentes trariam a lista um do
   *  outro; por datas montadas na tela, a janela do modal poderia divergir da
   *  que produziu o número. */
  obterRegistrosDaJanela.mockImplementation(() =>
    Promise.resolve({
      itens: [
        {
          id: 'm1',
          data: '2026-05-18',
          veiculo: 'Valor Econômico',
          titulo: 'A matéria que empurrou',
          link: 'https://exemplo/materia',
          sentimento: 'pos',
          tier: 'muito_relevante',
        },
      ],
      total: 1,
      pagina: 1,
      tamanho: 50,
    }),
  );
  render(<InteligenciaDeMercado comPares />);
  await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());
  escolherData('2026-05-20');
  await waitFor(() => expect(screen.getByTestId('quadro-positivos')).toBeTruthy());

  const linha = within(screen.getByTestId('quadro-positivos')).getByRole('button', {
    name: /Governança/,
  });
  await userEvent.click(linha);

  expect(await screen.findByText('A matéria que empurrou')).toBeTruthy();
  //: O ID DO GRUPO, O DIA CLICADO, O NÍVEL DO QUADRO E OS DIAS DA JANELA.
  expect(obterRegistrosDaJanela).toHaveBeenCalledWith('2026-05-20', 11, 'n2', 1, 15);
  //: E AS CINCO COLUNAS, com o título servindo de link para a matéria.
  expect(screen.getByText('Valor Econômico')).toBeTruthy();
  expect(screen.getByText('Propositiva')).toBeTruthy();
  expect(screen.getByText('Tier 1')).toBeTruthy();
  expect(
    screen.getByRole('link', { name: 'A matéria que empurrou' }).getAttribute('href'),
  ).toBe('https://exemplo/materia');
});

it('CLICAR OUTRA DATA leva o modal dos registros com ela', async () => {
  //: O modal é uma camada acima da janela, e viver mais que ela mostraria
  //: registros de um dia que já não é o da tela.
  obterRegistrosDaJanela.mockImplementation(() =>
    Promise.resolve({ itens: [], total: 0, pagina: 1, tamanho: 50 }),
  );
  render(<InteligenciaDeMercado comPares />);
  await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());
  escolherData('2026-05-20');
  await waitFor(() => expect(screen.getByTestId('quadro-positivos')).toBeTruthy());
  await userEvent.click(
    within(screen.getByTestId('quadro-positivos')).getByRole('button', {
      name: /Governança/,
    }),
  );
  expect(await screen.findByText(/Nenhuma menção neste recorte/)).toBeTruthy();

  escolherData('2026-05-25');

  await waitFor(() => expect(screen.queryByText(/Nenhuma menção neste recorte/)).toBeNull());
});

it('ESC fecha o modal dos registros e deixa a janela no lugar', async () => {
  /** O CAMINHO QUE A PESSOA TEM. Com o modal aberto, o overlay cobre a janela:
   *  o único gesto disponível é fechar o modal — Esc, ou o X do diálogo. Ele
   *  tem de levar só a si mesmo: levar a janela junto obrigaria a pessoa a
   *  clicar a data no gráfico outra vez para ver o quadro de que ela acabou de
   *  sair, e o quadro é o lugar de onde se abre o tema seguinte.
   */
  obterRegistrosDaJanela.mockImplementation(() =>
    Promise.resolve({ itens: [], total: 0, pagina: 1, tamanho: 50 }),
  );
  render(<InteligenciaDeMercado comPares />);
  await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());
  escolherData('2026-05-20');
  await waitFor(() => expect(screen.getByTestId('quadro-positivos')).toBeTruthy());
  await userEvent.click(
    within(screen.getByTestId('quadro-positivos')).getByRole('button', {
      name: /Governança/,
    }),
  );
  expect(await screen.findByText(/Nenhuma menção neste recorte/)).toBeTruthy();

  await userEvent.keyboard('{Escape}');

  //: O MODAL FOI, O QUADRO FICOU.
  await waitFor(() =>
    expect(screen.queryByText(/Nenhuma menção neste recorte/)).toBeNull(),
  );
  expect(screen.getByTestId('quadro-positivos')).toBeTruthy();

  //: E O SEGUNDO TEMA ABRE, sem passar pelo gráfico outra vez.
  await userEvent.click(
    within(screen.getByTestId('quadro-positivos')).getByRole('button', {
      name: /Crescimento/,
    }),
  );
  expect(await screen.findByText(/Nenhuma menção neste recorte/)).toBeTruthy();
});

it('a tela diz DE QUAL NOTA são os pontos: a da lente, e não o índice', async () => {
    /** A PERGUNTA DELE, depois de ver a janela no ar: "esse desconto de pontos de
     *  cada pilar ou tema é em relação à pontuação total? ou só da lente?".
     *
     *  É DA LENTE: o denominador do back é `denominador_do_mes(lente_id, ...)`,
     *  só as fontes ligadas dela. Mas a LINHA do gráfico, logo acima, é o
     *  ÍNDICE — a média ponderada das cinco lentes, em que a imprensa pesa 30 de
     *  100. A tela dizia "Pontos da nota de 05/2026" e deixava os dois números em
     *  réguas diferentes sem avisar: quem lê subtrai um do outro e erra.
     *
     *  A LENTE VEM DA RESPOSTA, e é por isso que o teste a troca: uma linha com
     *  "imprensa" escrito à mão passaria neste arquivo e mentiria no dia em que a
     *  segunda lente chegasse. */
    obterImpactoNaJanela.mockImplementation(() =>
      Promise.resolve(impacto({ lente: 'mercado' })),
    );
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    escolherData('2026-05-20');

    await waitFor(() => expect(screen.getByTestId('regua-da-janela')).toBeTruthy());
    const regua = screen.getByTestId('regua-da-janela');
    expect(regua.textContent).toContain('nota da lente mercado');
    //: e que NÃO são pontos do índice, que é a confusão que a linha desfaz
    expect(regua.textContent?.toLowerCase()).toContain('não são pontos do índice');
  });

  it('a CHAVE troca o nível e busca de novo o MESMO dia', async () => {
    /** O PEDIDO: "você sugere que que haja uma chave para mostrar o n1 ou n2
     *  para aquele recorte de data?" — sim, e por medição: o pilar cobre ~98%
     *  da Clipei e agrupa grosso; o tema tem sete vezes mais grupos e alcança o
     *  quarto que está classificado (a migration 0098 mede 72.590 menções com
     *  pilar e sem tema). Nenhum dos dois responde sozinho.
     *
     *  ABRE NO SUBTEMA (N3) desde 21/10/2026, por pedido. */
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());
    escolherData('2026-05-20');
    await waitFor(() => expect(obterImpactoNaJanela).toHaveBeenCalledWith('2026-05-20', 'n3', 15));

    screen.getByRole('button', { name: 'N1 · Atributo' }).click();

    //: O MESMO DIA, O NÍVEL NOVO.
    await waitFor(() =>
      expect(obterImpactoNaJanela).toHaveBeenCalledWith('2026-05-20', 'n1', 15),
    );
  });

  it('a palavra do "fora da conta" segue a RESPOSTA, não o botão', async () => {
    /** Enquanto a busca nova não chega, o botão já mudou e os números são os do
     *  nível anterior: dizer "sem pilar" sobre uma contagem de temas seria o
     *  mesmo defeito do eixo que mentia sobre a métrica. */
    obterImpactoNaJanela.mockImplementation(() =>
      Promise.resolve(impacto({ sem_grupo: 9, nivel: 'n1' })),
    );
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    escolherData('2026-05-20');

    await waitFor(() => expect(screen.getByTestId('fora-da-conta')).toBeTruthy());
    const fora = screen.getByTestId('fora-da-conta');
    expect(fora.textContent).toContain('sem atributo (N1) atribuído');
    expect(fora.textContent).not.toContain('tema estratégico');
  });

  it('no PILAR a linha não mostra contexto, porque ele é o topo', async () => {
    obterImpactoNaJanela.mockImplementation(() =>
      Promise.resolve(
        impacto({
          nivel: 'n1',
          positivos: [{ id: 3, rotulo: 'Governança', contexto: null, impacto: 1.2, mencoes: 8 }],
          total_positivos: 1,
        }),
      ),
    );
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    escolherData('2026-05-20');

    await waitFor(() => expect(screen.getByTestId('quadro-positivos')).toBeTruthy());
    const linha = screen.getByTestId('quadro-positivos').querySelector('li');
    //: NA LINHA, E NÃO NO QUADRO: o `·` também aparece no contador ("1 de 1") e
    //: na contagem de menções ("pt · 8") — olhar o quadro inteiro faria a
    //: asserção falhar por texto que não é o contexto. Foi o que aconteceu.
    //:
    //: O RÓTULO COLADO NO SINAL é o que prova a ausência: no tema a linha lê
    //: "Tarifa · Eficiência operacional−0,9 pt", e no pilar "Governança+1,2 pt".
    expect(linha?.textContent).toBe('Governança+1,2 pt · 8');
  });

  it('a data escolhida chega ao GRÁFICO, para ele marcá-la', async () => {
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    escolherData('2026-05-20');

    await waitFor(() => expect(recebido.dataEscolhida).toBe('2026-05-20'));
  });
});

describe('os scores no eixo direito', () => {
  /** O PEDIDO (20/10/2026): "hoje trazemos no gráfico o score geral, gostaria
   *  de adicionar o score das lentes imprensa, mercado e institucional, e
   *  temos que adicionar os botões para selecionar os scores". */

  const COM_LENTES = {
    indice: [
      {
        mes: '2026-01-01',
        isr: 52,
        lentes: { imprensa: 61, mercado: 48, institucional: null },
      },
    ],
  };

  it('ABRE COM O ÍNDICE, e só com ele', async () => {
    //: É como a tela sempre abriu. Com os quatro acesos, a primeira coisa
    //: visível seriam quatro tracejados por cima das curvas dos bonds.
    obterSerieDeMercado.mockImplementation(() => Promise.resolve(resposta(COM_LENTES)));
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    expect(recebido.indice).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Índice geral/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /^Imprensa/ }).getAttribute('aria-pressed')).toBe('false');
  });

  it('LIGAR UMA LENTE acrescenta a curva dela, sem tirar o índice', async () => {
    obterSerieDeMercado.mockImplementation(() => Promise.resolve(resposta(COM_LENTES)));
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    await userEvent.click(screen.getByRole('button', { name: /^Imprensa/ }));

    await waitFor(() => expect(recebido.indice).toHaveLength(2));
    const curvas = recebido.indice as { chave: string; pontos: { valor: number | null }[] }[];
    expect(curvas.map((c) => c.chave)).toEqual(['isr', 'imprensa']);
    //: O VALOR É O DA LENTE, e não o do índice: é a conferência que pega a
    //: troca de chave — as duas curvas teriam o mesmo formato com o ISR nas
    //: duas, e ninguém veria.
    expect(curvas[1].pontos).toEqual([{ mes: '2026-01-01', valor: 61 }]);
  });

  it('A LENTE SEM MEDIÇÃO no mês vira VÃO, e não zero', async () => {
    //: Zero no eixo 0–100 diz "a reputação foi péssima". A Institucional sem
    //: veículo classificado não foi MEDIDA — ela nem entra no índice daquele
    //: mês. O nulo atravessa até o gráfico, que quebra o degrau.
    obterSerieDeMercado.mockImplementation(() => Promise.resolve(resposta(COM_LENTES)));
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    await userEvent.click(screen.getByRole('button', { name: /^Institucional/ }));

    await waitFor(() => expect(recebido.indice).toHaveLength(2));
    const curvas = recebido.indice as { chave: string; pontos: { valor: number | null }[] }[];
    expect(curvas[1].pontos).toEqual([{ mes: '2026-01-01', valor: null }]);
  });

  it('DESLIGAR O ÍNDICE tira só ele', async () => {
    obterSerieDeMercado.mockImplementation(() => Promise.resolve(resposta(COM_LENTES)));
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    await userEvent.click(screen.getByRole('button', { name: /^Mercado/ }));
    await userEvent.click(screen.getByRole('button', { name: /Índice geral/ }));

    await waitFor(() => {
      const curvas = recebido.indice as { chave: string }[];
      expect(curvas.map((c) => c.chave)).toEqual(['mercado']);
    });
  });

  it('a lente que o servidor NÃO mandou não quebra a tela', async () => {
    //: Uma base antiga (ou uma lente aposentada) devolve `lentes` sem a chave.
    //: A curva fica vazia de valores, e a tela continua de pé.
    obterSerieDeMercado.mockImplementation(() =>
      Promise.resolve(resposta({ indice: [{ mes: '2026-01-01', isr: 52 }] })),
    );
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    await userEvent.click(screen.getByRole('button', { name: /^Imprensa/ }));

    await waitFor(() => expect(recebido.indice).toHaveLength(2));
    const curvas = recebido.indice as { pontos: { valor: number | null }[] }[];
    expect(curvas[1].pontos).toEqual([{ mes: '2026-01-01', valor: null }]);
  });
});

describe('o laço que não existe', () => {
  it('a série não é buscada de novo sozinha', async () => {
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());
    const assentado = obterSerieDeMercado.mock.calls.length;

    await new Promise((resolver) => setTimeout(resolver, 60));

    expect(obterSerieDeMercado.mock.calls.length).toBe(assentado);
  });

  it('SEM clique nenhum os temas não são buscados sozinhos', async () => {
    render(<InteligenciaDeMercado comPares />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());

    await new Promise((resolver) => setTimeout(resolver, 100));

    expect(obterImpactoNaJanela).not.toHaveBeenCalled();
  });
});
describe('os pares saem neste momento', () => {
  it('sem `comPares`, a tela não mostra "Comparar com pares"', async () => {
    render(<InteligenciaDeMercado />);
    await waitFor(() => expect(screen.getByText('GRAFICO')).toBeTruthy());
    expect(screen.queryByText('Comparar com pares')).toBeNull();
    expect(screen.queryByRole('button', { name: /PETBRA30/ })).toBeNull();
  });
});
