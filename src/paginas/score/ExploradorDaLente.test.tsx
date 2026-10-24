// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { GrupoDoExplorador } from '@/api/cliente';

function grupo(parcial: Partial<GrupoDoExplorador>): GrupoDoExplorador {
  return {
    n1: null,
    n2: null,
    n3: null,
    uf: null,
    positivo: 0,
    neutro: 0,
    negativo: 0,
    peso_positivo: 0,
    peso_neutro: 0,
    peso_negativo: 0,
    ...parcial,
  };
}

const obterExploradorDaLente = vi.fn((..._argumentos: unknown[]) =>
  Promise.resolve({
    lente: 'imprensa',
    mes: '2026-08',
    denominador: 10,
    grupos: [
      grupo({ n1: 'Governança', n2: 'Ética', n3: 'Compliance', uf: 'RJ', positivo: 2, peso_positivo: 2 }),
      grupo({ n1: 'Clientes', n2: 'Atendimento', n3: 'Tarifa', uf: 'SP', negativo: 3, peso_negativo: 3 }),
      grupo({ n1: 'Clientes', n2: 'Atendimento', n3: 'Fila', uf: 'SP', neutro: 5, peso_neutro: 5 }),
    ],
  }),
);

vi.mock('@/api/cliente', () => ({
  obterExploradorDaLente: (...argumentos: unknown[]) => obterExploradorDaLente(...argumentos),
}));

import { ExploradorDaLente } from '@/paginas/score/ExploradorDaLente';

beforeAll(() => {
  //: O MAPA MEDE A PRÓPRIA LARGURA; o jsdom não tem ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

function coluna(titulo: string) {
  return screen.getByRole('heading', { name: titulo }).parentElement!.parentElement as HTMLElement;
}

describe('N1 › N2 › N3 e o mapa por UF', () => {
  it('pede com o filtro da tela e ordena do maior para o menor, com o impacto', async () => {
    render(<ExploradorDaLente codigo="imprensa" mes="2026-08" filtro={{ tier: 'relevante' }} aoAprofundar={() => {}} />);
    await screen.findByRole('heading', { name: 'Atributo (N1)' });
    expect(obterExploradorDaLente).toHaveBeenCalledWith('imprensa', '2026-08', { tier: 'relevante' });
    const n1 = within(coluna('Atributo (N1)')).getAllByRole('button');
    expect(n1.map((b) => b.getAttribute('aria-label')?.split(':')[0])).toEqual(['Clientes', 'Governança']);
    // Clientes: −3 negativo ponderado sobre D = 10 → −15 pontos.
    expect(n1[0].getAttribute('aria-label')).toContain('−15,0 pts');
  });

  it('o ranking por UF vai da que tem MAIS matérias para a que tem menos', async () => {
    render(<ExploradorDaLente codigo="imprensa" mes="2026-08" filtro={{}} aoAprofundar={() => {}} />);
    await screen.findByText('UF · matérias');
    const ranking = screen.getByText('UF · matérias').parentElement!.parentElement!;
    const texto = ranking.textContent ?? '';
    // SP tem 8 matérias, RJ tem 2: SP vem antes, mesmo com score menor.
    expect(texto.indexOf('São Paulo')).toBeLessThan(texto.indexOf('Rio de Janeiro'));
  });

  it('clicar num N1 filtra o N3 e o mapa, e clicar de novo desfaz', async () => {
    render(<ExploradorDaLente codigo="imprensa" mes="2026-08" filtro={{}} aoAprofundar={() => {}} />);
    await screen.findByRole('heading', { name: 'Subtema (N3)' });
    expect(within(coluna('Subtema (N3)')).getAllByRole('button')).toHaveLength(3);

    await userEvent.click(screen.getByRole('button', { name: /^Governança:/ }));
    expect(within(coluna('Subtema (N3)')).getAllByRole('button')).toHaveLength(1);
    // O próprio N1 continua inteiro, com o escolhido marcado.
    expect(within(coluna('Atributo (N1)')).getAllByRole('button')).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: /^Governança:/ }).getAttribute('aria-pressed'),
    ).toBe('true');
    // O RANKING ao lado do mapa só com o RJ (score 100: tudo propositivo).
    const ranking = screen.getByText('UF · matérias').parentElement!.parentElement!;
    expect(ranking.textContent).toContain('Rio de Janeiro');
    expect(ranking.textContent).toContain('100');
    expect(ranking.textContent).not.toContain('São Paulo');

    await userEvent.click(screen.getByRole('button', { name: /^Governança:/ }));
    expect(within(coluna('Subtema (N3)')).getAllByRole('button')).toHaveLength(3);
  });
});

/* -- o comportamento padrão, vindo do bloco de veículos (24/10/2026) --------- */

/** Um mês com SETE subtemas e um atributo só, para a lista ter o que revelar.
 *
 *  SETE, E NÃO SEIS: com seis, revelar acrescenta uma linha e um teste que
 *  conte "antes 5, depois 6" passa igual se o botão revelasse só mais uma. */
function mesComSeteSubtemas() {
  return {
    lente: 'imprensa',
    mes: '2026-08',
    denominador: 10,
    grupos: Array.from({ length: 7 }, (_, i) =>
      grupo({
        n1: 'Governança',
        n2: 'Ética',
        n3: `Subtema ${i + 1}`,
        uf: 'RJ',
        negativo: 7 - i,
        peso_negativo: 7 - i,
      }),
    ),
  };
}

describe('o revelador e o modal, iguais aos do bloco de veículos', () => {
  it('a coluna abre em 5 e o botão revela o resto, com a unidade do nível', async () => {
    //: PEDIDO (24/10/2026): "quero que os mesmos elementos sejam aplicados no
    //: bloco Atributos, temas estratégicos e subtemas — quero deixar um
    //: comportamento padrão". Antes, as três colunas despejavam a lista
    //: inteira no rolador; o N2 tem 41 temas no mês real.
    obterExploradorDaLente.mockImplementationOnce(() => Promise.resolve(mesComSeteSubtemas()));
    render(<ExploradorDaLente codigo="imprensa" mes="2026-08" filtro={{}} aoAprofundar={() => {}} />);
    await screen.findByRole('heading', { name: 'Subtema (N3)' });

    const n3 = () => within(coluna('Subtema (N3)'));
    //: CINCO LINHAS MAIS O BOTÃO.
    expect(n3().getAllByRole('button')).toHaveLength(6);
    expect(n3().queryByRole('button', { name: /^Subtema 6:/ })).toBeNull();

    //: O RÓTULO DIZ A UNIDADE DO NÍVEL, e o total de verdade.
    const revelar = n3().getByRole('button', { name: 'Ver todos os 7 subtemas' });
    await userEvent.click(revelar);

    expect(n3().getByRole('button', { name: /^Subtema 7:/ })).toBeTruthy();
    expect(n3().getByRole('button', { name: 'Recolher' })).toBeTruthy();
  });

  it('e cada coluna abre a SUA: revelar o N3 deixa o N2 fechado', async () => {
    //: A PROVA PRECISA DE DUAS COLUNAS COM BOTÃO — achado da revisão do Codex:
    //: a primeira versão deste teste comparava o N3 com o N1, que tinha um
    //: item só e portanto botão nenhum. Provava que o N1 não tinha o que
    //: abrir, não que ele ficou fechado.
    obterExploradorDaLente.mockImplementationOnce(() =>
      Promise.resolve({
        lente: 'imprensa',
        mes: '2026-08',
        denominador: 10,
        grupos: Array.from({ length: 7 }, (_, i) =>
          grupo({
            n1: 'Governança',
            n2: `Tema ${i + 1}`,
            n3: `Subtema ${i + 1}`,
            uf: 'RJ',
            negativo: 7 - i,
            peso_negativo: 7 - i,
          }),
        ),
      }),
    );
    render(<ExploradorDaLente codigo="imprensa" mes="2026-08" filtro={{}} aoAprofundar={() => {}} />);
    await screen.findByRole('heading', { name: 'Subtema (N3)' });

    const n2 = () => within(coluna('Tema estratégico (N2)'));
    const n3 = () => within(coluna('Subtema (N3)'));
    //: AS DUAS COMEÇAM CORTADAS, cada uma com o seu botão.
    expect(n2().getByRole('button', { name: 'Ver todos os 7 temas' })).toBeTruthy();
    expect(n3().getByRole('button', { name: 'Ver todos os 7 subtemas' })).toBeTruthy();

    await userEvent.click(n3().getByRole('button', { name: 'Ver todos os 7 subtemas' }));

    //: O N3 ABRIU...
    expect(n3().getByRole('button', { name: /^Subtema 7:/ })).toBeTruthy();
    //: ...E O N2 CONTINUA FECHADO, com o botão dele intacto.
    expect(n2().queryByRole('button', { name: /^Tema 6:/ })).toBeNull();
    expect(n2().getByRole('button', { name: 'Ver todos os 7 temas' })).toBeTruthy();
  });

  it('o N3 ABRE O MODAL no recorte da barra, levando o N1 e o N2 escolhidos', async () => {
    //: A TRADUÇÃO DO BLOCO DE VEÍCULOS: a última coluna abre, as de cima
    //: escolhem. E o recorte vai inteiro — a barra do N3 conta a INTERSEÇÃO
    //: com o que está escolhido acima, e mandar só o subtema abriria o modal
    //: num recorte mais largo que a barra clicada. Mesmo defeito que o tier
    //: teve no bloco de veículos.
    //:
    //: AS CHAVES SÃO AS DO SERVIDOR, e não as do nome do nível: o N2 e o N3
    //: saem do CADASTRO (`MacroTema.nome` e `Tema.nome`), então casam por
    //: `tema_n2`/`tema_n3`. `subtema` é outra coluna — a da Sociedade.
    const aoAprofundar = vi.fn();
    render(<ExploradorDaLente codigo="imprensa" mes="2026-08" filtro={{ tier: 'relevante' }} aoAprofundar={aoAprofundar} />);
    await screen.findByRole('heading', { name: 'Subtema (N3)' });

    await userEvent.click(screen.getByRole('button', { name: /^Clientes:/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Atendimento:/ }));
    await userEvent.click(within(coluna('Subtema (N3)')).getByRole('button', { name: /^Tarifa:/ }));

    expect(aoAprofundar).toHaveBeenCalledWith('tema_n3', 'Tarifa', {
      atributo: 'Clientes',
      tema_n2: 'Atendimento',
    });
  });

  it('e o N1 e o N2 continuam ESCOLHENDO, sem abrir modal', async () => {
    //: A CONTRAPROVA: se as três abrissem, nada recortaria o N3.
    const aoAprofundar = vi.fn();
    render(<ExploradorDaLente codigo="imprensa" mes="2026-08" filtro={{}} aoAprofundar={aoAprofundar} />);
    await screen.findByRole('heading', { name: 'Atributo (N1)' });

    await userEvent.click(screen.getByRole('button', { name: /^Governança:/ }));

    expect(aoAprofundar).not.toHaveBeenCalled();
    //: `getAllByText` PORQUE O CHIP APARECE DUAS VEZES: a mesma linha de
    //: filtro é desenhada na seção das colunas e de novo no mapa por UF.
    expect(screen.getAllByText('Filtrando por').length).toBeGreaterThan(0);
  });

  it('a seleção não sobrevive à troca do filtro da TELA', async () => {
    //: O MESMO DEFEITO QUE O CODEX ACHOU no bloco de veículos, e que o molde
    //: ainda tinha. Sem isto o chip mente — e com o modal é pior: a seleção
    //: velha viaja em `extras` e o modal abre num recorte que a tela não
    //: mostra mais.
    const { rerender } = render(
      <ExploradorDaLente codigo="imprensa" mes="2026-08" filtro={{}} aoAprofundar={() => {}} />,
    );
    await screen.findByRole('heading', { name: 'Atributo (N1)' });
    await userEvent.click(screen.getByRole('button', { name: /^Governança:/ }));
    expect(screen.getAllByText('Filtrando por').length).toBeGreaterThan(0);

    rerender(
      <ExploradorDaLente
        codigo="imprensa"
        mes="2026-08"
        filtro={{ tier: 'relevante' }}
        aoAprofundar={() => {}}
      />,
    );
    await screen.findByRole('heading', { name: 'Atributo (N1)' });

    expect(screen.queryAllByText('Filtrando por')).toHaveLength(0);
  });

  it('e os textos da tela dizem o que cada coluna FAZ, agora que o N3 abre', async () => {
    //: ACHADO DA REVISÃO DO CODEX (24/10/2026), e era meu: o subtítulo prometia
    //: "clique num item para filtrar os outros gráficos e o mapa", e o do mapa
    //: dizia "segue o filtro de N1, N2 e N3 acima". As duas frases deixaram de
    //: ser verdade no mesmo commit em que o N3 virou gatilho de modal — e são
    //: a única explicação que a pessoa tem do que o clique faz.
    render(<ExploradorDaLente codigo="imprensa" mes="2026-08" filtro={{}} aoAprofundar={() => {}} />);
    await screen.findByRole('heading', { name: 'Subtema (N3)' });

    //: O SUBTÍTULO DAS COLUNAS nomeia o gesto de cada uma.
    expect(screen.getByText(/Clique num atributo ou tema para filtrar/)).toBeTruthy();
    expect(screen.getByText(/o subtema abre o detalhe das matérias/)).toBeTruthy();

    //: E O DO MAPA não promete mais o N3.
    expect(screen.getByText(/Segue o filtro de N1 e N2 acima/)).toBeTruthy();
    //: A AUSÊNCIA SE AFIRMA NO TEXTO INTEIRO DA PÁGINA, e não com
    //: `queryByText` — achado da segunda revisão do Codex. O `queryByText`
    //: casa dentro de UM nó: se alguém quebrasse a frase antiga em dois spans,
    //: ele devolveria `null` e o teste passaria sem a frase ter saído.
    expect(document.body.textContent).not.toContain('N1, N2 e N3');
  });
});

/* -- o estado abre o modal (24/10/2026) -------------------------------------- */

describe('clicar num estado', () => {
  function oMapa() {
    return screen.getByLabelText('Termômetro e score das matérias por unidade da federação');
  }

  it('a LINHA da lista abre o modal no recorte daquela UF', async () => {
    const aoAprofundar = vi.fn();
    render(<ExploradorDaLente codigo="imprensa" mes="2026-08" filtro={{}} aoAprofundar={aoAprofundar} />);
    await screen.findByText('UF · matérias');

    const linha = screen.getByRole('button', {
      name: /^Abrir as 8 matérias de São Paulo \(SP\)/,
    });
    //: O RÓTULO NOMEIA O GESTO *E* CARREGA OS DADOS DA LINHA — achado da
    //: revisão do Codex (24/10/2026): `aria-label` em botão substitui o
    //: conteúdo dele, e a primeira versão deste rótulo apagava a sigla, o
    //: termômetro e o score de quem não vê a tela.
    expect(linha.getAttribute('aria-label')).toBe(
      'Abrir as 8 matérias de São Paulo (SP): termômetro -37, score 31',
    );
    await userEvent.click(linha);

    //: A SIGLA, que é o que a lista mostra — e o que o recorte do back casa nas
    //: duas formas (a coluna guarda "São Paulo").
    expect(aoAprofundar).toHaveBeenCalledWith('uf', 'SP', {});
  });

  it('a BOLHA do mapa abre o mesmo modal da linha', async () => {
    const aoAprofundar = vi.fn();
    render(<ExploradorDaLente codigo="imprensa" mes="2026-08" filtro={{}} aoAprofundar={aoAprofundar} />);
    await screen.findByText('UF · matérias');

    //: A BOLHA DO RJ é a que tem score 100 (tudo propositivo); o rótulo dentro
    //: dela é o score, e o grupo é o alvo do clique. Procurado DENTRO do
    //: `<svg>`: "100" também aparece na legenda da escala e no ranking.
    const rotulo = [...oMapa().querySelectorAll('text')].find((no) => no.textContent === '100');
    expect(rotulo, 'a bolha do RJ não foi desenhada').toBeTruthy();
    await userEvent.click(rotulo!.closest('g')!);

    expect(aoAprofundar).toHaveBeenCalledWith('uf', 'RJ', {});
  });

  it('e o recorte LOCAL de N1/N2 viaja junto, porque a lista é somada dentro dele', async () => {
    //: A MESMA REGRA DO N3: a linha "Rio de Janeiro" dentro de "Governança"
    //: conta a interseção das duas, e o modal tem de contar essa fatia. Sem
    //: isto ele abriria o estado INTEIRO — outro número que o da linha clicada.
    const aoAprofundar = vi.fn();
    render(<ExploradorDaLente codigo="imprensa" mes="2026-08" filtro={{}} aoAprofundar={aoAprofundar} />);
    await screen.findByRole('heading', { name: 'Atributo (N1)' });

    await userEvent.click(screen.getByRole('button', { name: /^Governança:/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Ética:/ }));
    await userEvent.click(
      screen.getByRole('button', { name: /^Abrir as 2 matérias de Rio de Janeiro \(RJ\)/ }),
    );

    expect(aoAprofundar).toHaveBeenCalledWith('uf', 'RJ', {
      atributo: 'Governança',
      tema_n2: 'Ética',
    });
  });

  it('e o cartão do mapa DIZ que o estado abre o detalhe', async () => {
    render(<ExploradorDaLente codigo="imprensa" mes="2026-08" filtro={{}} aoAprofundar={() => {}} />);
    await screen.findByText('UF · matérias');
    expect(screen.getByText(/clicar num estado .* abre o detalhe das matérias/)).toBeTruthy();
  });
});
