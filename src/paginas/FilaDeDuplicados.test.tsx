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
    tipo: 'perfil_rede',
    cargo: 'Imprensa',
    //: AS ORIGENS DOS DOIS LADOS, que é o que explica a duplicata: o handle
    //: chegou pelo social listening, o veículo pelo clipping.
    origens: ['sociedade'],
    mencoes: 11,
    candidatos: [
      {
        id: 'v1',
        nome: 'Valor Econômico',
        tipo: 'veiculo',
        mencoes: 88,
        origens: ['imprensa', 'mercado'],
      },
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
    name: 'Manter Valor Econômico e apagar valoreconomico',
  });

  await userEvent.click(botao);

  //: A ORDEM É A REGRA DE NEGÓCIO INTEIRA: trocada, o pedido apagaria o
  //: veículo curado dentro do handle do fornecedor. O servidor também recusa,
  //: mas a tela não deve nem pedir.
  //: E O TERCEIRO ARGUMENTO É `false`: este é o caminho PROPOSTO pelo servidor,
  //: e não a escolha contrária. Mandar `true` aqui desligaria a guarda que
  //: protege a linha curada em TODO clique — inclusive no que ninguém escolheu.
  await waitFor(() => expect(fundirCadastro).toHaveBeenCalledWith('p1', 'v1', false));
});

it('o OUTRO botao escolhe o cadastro CONTRARIO a proposta', async () => {
  /** O PEDIDO DO DONO DO PRODUTO: "não basta termos uma opção de dizer se são ou
   *  não o mesmo, além de mostrar quais podem se juntar temos que dizer qual é o
   *  real para ser considerado na unificação".
   *
   *  A TELA TINHA UM BOTÃO SÓ, e a direção vinha do servidor: sobrevive a linha
   *  com história. A proposta está certa quase sempre — e continua sendo a
   *  sugestão —, mas só quem conhece o ator sabe quando o cadastro certo é o
   *  outro.
   *
   *  TRÊS COISAS NUMA CHAMADA, e cada uma erraria sozinha: quem SAI é o
   *  candidato (`v1`), quem FICA é o perfil (`p1`), e o `true` diz ao servidor
   *  que a escolha é de propósito — sem ele a resposta é 422, porque é essa
   *  guarda que protege o clique errado. */
  render(<FilaDeDuplicados />);
  const botao = await screen.findByRole('button', {
    name: 'Manter valoreconomico e apagar Valor Econômico',
  });

  await userEvent.click(botao);

  await waitFor(() => expect(fundirCadastro).toHaveBeenCalledWith('v1', 'p1', true));
});

it('a linha diz DE ONDE vem cada lado', async () => {
  //: A EVIDÊNCIA DA DUPLICATA: "pode vir do crm, pode vir de mídias sociais,
  //: pode vir de mercado, pode ter várias fontes distintas, mas a instituição é
  //: a mesma". Dois nomes parecidos e duas contagens não dizem POR QUE existem
  //: dois cadastros; as origens dizem.
  //:
  //: E `sociedade` APARECE COMO "redes sociais": código de lente é vocabulário
  //: de dentro, e quem lê a fila pensa em rede social.
  render(<FilaDeDuplicados />);
  await screen.findByText('valoreconomico');

  expect(screen.getByText(/Perfil de rede · Imprensa · 11 menções · vem de redes sociais/))
    .toBeTruthy();
  expect(screen.getByText(/88 menções · vem de imprensa e mercado/)).toBeTruthy();
});

it('a BUSCA acha o par pelos DOIS lados, e nao so pela ancora', async () => {
  /** O PEDIDO: "deve uma barra de busca para facilitar buscar de instituições
   *  chave". Com 209 pares, chegar ao Valor Econômico pela paginação é folhear
   *  vinte páginas.
   *
   *  PELOS DOIS LADOS, e é o ponto do teste: a pergunta está ancorada no handle
   *  `valoreconomico`, e quem procura digita "Econômico" — o nome do veículo, que
   *  está no OUTRO lado do par. Uma busca que olhasse só a âncora não acharia
   *  nada, e a tela diria que a instituição-chave não tem duplicata. */
  vi.mocked(duplicadosDeCadastro).mockResolvedValue([
    ...UM_PAR,
    {
      id: 'p9',
      nome: 'gazeta_de_piracicaba',
      tipo: 'perfil_rede',
      cargo: null,
      origens: [],
      mencoes: 1,
      candidatos: [
        { id: 'v9', nome: 'Gazeta de Piracicaba', tipo: 'veiculo', mencoes: 7, origens: [] },
      ],
    },
  ]);
  render(<FilaDeDuplicados />);
  await screen.findByText('valoreconomico');

  await userEvent.type(screen.getByLabelText('Buscar'), 'Econômico');

  //: O par do Valor fica — achado pelo nome do CANDIDATO.
  expect(screen.getByText('valoreconomico')).toBeTruthy();
  //: E o outro sai da lista.
  expect(screen.queryByText('gazeta_de_piracicaba')).toBeNull();
  //: O TOTAL DA FILA CONTINUA NO TÍTULO: a busca filtra a lista, não resolve
  //: trabalho. Um título que caísse para (1) diria que só há um par a decidir.
  expect(screen.getByRole('button', { name: /Possíveis duplicados \(2\)/ })).toBeTruthy();
});

it('a BUSCA que nao acha nada DIZ isso', async () => {
  //: Sem esta linha o cartão fica com a barra de busca e um vazio embaixo, e
  //: quem digitou não sabe se errou o nome ou se não há par nenhum com ele.
  render(<FilaDeDuplicados />);
  await screen.findByText('valoreconomico');

  await userEvent.type(screen.getByLabelText('Buscar'), 'infomoney');

  expect(screen.getByText(/Nenhum par com «infomoney»/)).toBeTruthy();
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

it('depois de responder, a fila NAO e relida', async () => {
  //: ESTE TESTE INVERTEU, e a inversão é o pedido do dono do produto: "realmente
  //: tem que fazer a busca sempre? não basta fazer uma vez quando expandi a tela
  //: e depois só atualizar a lista?".
  //:
  //: NÃO PRECISA. O efeito de cada decisão é local e determinado, então a lista
  //: nova sai de `semOCadastro`/`semOPar` — o servidor devolveria a mesma coisa
  //: depois de 7,4 s de recálculo (medido: ~3.962 cadastros comparados par a par
  //: com `difflib`), e eram 7,4 s POR DECISÃO, com 209 pares a decidir.
  //:
  //: A VERSÃO ANTERIOR DESTE TESTE exigia a segunda chamada. Ela estava certa
  //: para o desenho de ontem e virou o oposto do que se quer: cada chamada aqui é
  //: trabalho que ninguém pediu.
  render(<FilaDeDuplicados />);
  const botao = await screen.findByRole('button', {
    name: 'valoreconomico não é Valor Econômico',
  });
  expect(duplicadosDeCadastro).toHaveBeenCalledTimes(1);

  await userEvent.click(botao);

  await waitFor(() => expect(declararCadastroDistinto).toHaveBeenCalled());
  //: A LINHA SAIU (medido em "a linha SAI NA HORA") e a busca NÃO rodou de novo.
  expect(duplicadosDeCadastro).toHaveBeenCalledTimes(1);
});

it('a falha de carga NAO derruba a tela', async () => {
  vi.mocked(duplicadosDeCadastro).mockRejectedValue(new Error('403 sem permissão'));

  render(<FilaDeDuplicados />);

  //: A fila é acessória: o cadastro inteiro não pode cair com ela.
  expect(await screen.findByText(/403 sem permissão/)).toBeTruthy();
});

it('o tipo de quem vai sair vem do SERVIDOR, e nao fixo em perfil de rede', async () => {
  //: O DEFEITO QUE ISTO PRENDE. A linha escrevia `ROTULO_DO_TIPO.perfil_rede`
  //: fixo — verdade enquanto a fila só perguntava sobre perfis de rede. Deixou
  //: de ser em 11/10/2026, quando a fila passou a olhar qualquer tipo: dos 4
  //: pares que restam na base real, TODOS são instituições feitas à mão no CRM,
  //: e apareciam rotuladas "Perfil de rede".
  //:
  //: E O ROTULO ERRADO AQUI É CARO: quem lê a linha está decidindo se APAGA um
  //: dos dois cadastros. "Perfil de rede" sugere um registro automático de
  //: fornecedor, descartável; "Órgão público" é uma linha que alguém curou.
  vi.mocked(duplicadosDeCadastro).mockResolvedValue([
    {
      id: 'o1',
      nome: 'Prefeitura de Campinas',
      tipo: 'orgao',
      cargo: null,
      origens: [],
      mencoes: 2,
      candidatos: [
        {
          id: 'o2',
          nome: 'Prefeitura Municipal de Campinas',
          tipo: 'orgao',
          mencoes: 9,
          origens: [],
        },
      ],
    },
  ]);

  render(<FilaDeDuplicados />);

  expect(await screen.findByText('Prefeitura de Campinas')).toBeTruthy();
  expect(screen.getByText(/Órgão público · 2 menções/)).toBeTruthy();
  expect(screen.queryByText(/Perfil de rede/)).toBeNull();
});

it('a fila de duplicados PAGINA em 10', async () => {
  //: PEDIDO DO DONO DO PRODUTO: 10 por página nos três blocos.
  //:
  //: ESTA FILA NÃO PAGINAVA, e com 210 pares medidos na base real ela desenhava
  //: os 210 de uma vez — cada um com o seu bloco de candidatos e dois botões.
  vi.mocked(duplicadosDeCadastro).mockResolvedValue(
    Array.from({ length: 12 }, (_, n) => ({
      id: `p${n}`,
      nome: `perfil${String(n).padStart(2, '0')}`,
      tipo: 'perfil_rede',
      cargo: null,
      origens: [],
      mencoes: 2,
      candidatos: [
        { id: `v${n}`, nome: `Veiculo ${n}`, tipo: 'veiculo', mencoes: 9, origens: [] },
      ],
    })),
  );

  render(<FilaDeDuplicados />);
  expect(await screen.findByText('perfil00')).toBeTruthy();

  expect(screen.getByText('perfil09')).toBeTruthy();
  expect(screen.queryByText('perfil10')).toBeNull();
  expect(screen.getByText(/Página 1 de 2 — 12 pares a decidir/)).toBeTruthy();

  await userEvent.click(screen.getByRole('button', { name: /Última/ }));
  expect(screen.getByText('perfil11')).toBeTruthy();
  expect(screen.queryByText('perfil00')).toBeNull();
});

it('o TOTAL fica no titulo, e e ele que diz se o trabalho anda', async () => {
  //: A fila encurta a cada decisão. Com a contagem só no rodapé da página, a
  //: pessoa veria "10 de 10" para sempre enquanto resolve os 210.
  vi.mocked(duplicadosDeCadastro).mockResolvedValue(
    Array.from({ length: 12 }, (_, n) => ({
      id: `p${n}`,
      nome: `perfil${n}`,
      tipo: 'perfil_rede',
      cargo: null,
      origens: [],
      mencoes: 2,
      candidatos: [
        { id: `v${n}`, nome: `V ${n}`, tipo: 'veiculo', mencoes: 9, origens: [] },
      ],
    })),
  );

  render(<FilaDeDuplicados />);
  await screen.findByText('perfil0');

  expect(screen.getByRole('button', { name: /Possíveis duplicados \(12\)/ })).toBeTruthy();
});

it('a linha SAI NA HORA, sem esperar a releitura', async () => {
  //: O DEFEITO QUE ISTO PRENDE, relatado pelo dono do produto (12/10/2026): "ao
  //: clicar em fundir ou não é o mesmo, demora a atualizar, parece que nada foi
  //: feito".
  //:
  //: MEDIDO: `GET /api/instituicoes/duplicados` leva 7,4 s na base real — a fila
  //: é recalculada comparando ~3.962 cadastros par a par com `difflib`. A tela
  //: pagava isso A CADA decisão, e durante os 7,4 s a linha ficava ali, com os
  //: botões reativados, idêntica ao que era antes do clique.
  //:
  //: POR QUE O TESTE ANTIGO NÃO PEGAVA: ele devolvia `[]` num mock que resolve no
  //: mesmo tick, então provava "a linha sai depois da releitura" — que é verdade
  //: e não é a pergunta. Aqui a releitura NUNCA resolve, que é o que mede o que a
  //: pessoa vê enquanto o servidor recalcula.
  render(<FilaDeDuplicados />);
  const botao = await screen.findByRole('button', {
    name: 'valoreconomico não é Valor Econômico',
  });

  vi.mocked(duplicadosDeCadastro).mockReturnValue(new Promise(() => {}));

  await userEvent.click(botao);

  await waitFor(() => expect(screen.queryByText('valoreconomico')).toBeNull());
});

it('a CONTAGEM do titulo cai na hora, junto com a linha', async () => {
  //: O NÚMERO É O QUE DIZ SE O TRABALHO ESTÁ ANDANDO — está no título por isso.
  //: Um título que continua "(2)" depois de uma decisão desmente a tela.
  vi.mocked(duplicadosDeCadastro).mockResolvedValue([
    ...UM_PAR,
    {
      id: 'p2',
      nome: 'outro handle',
      tipo: 'perfil_rede',
      cargo: null,
      origens: [],
      mencoes: 1,
      candidatos: [
        { id: 'v2', nome: 'Outro Veículo', tipo: 'veiculo', mencoes: 40, origens: [] },
      ],
    },
  ]);

  render(<FilaDeDuplicados />);
  const botao = await screen.findByRole('button', {
    name: 'valoreconomico não é Valor Econômico',
  });
  expect(screen.getByRole('button', { name: /Possíveis duplicados \(2\)/ })).toBeTruthy();

  vi.mocked(duplicadosDeCadastro).mockReturnValue(new Promise(() => {}));
  await userEvent.click(botao);

  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Possíveis duplicados \(1\)/ })).toBeTruthy(),
  );
});

it('FUNDIR tira TODAS as perguntas sobre o cadastro que saiu', async () => {
  //: FUNDIR NÃO TIRA UM PAR, TIRA UM CADASTRO. O perfil fundido deixa de existir,
  //: então toda pergunta que o menciona — como quem sai OU como candidato — morre
  //: com ele. Sem isto, a tela ofereceria fundir de novo algo que já não está no
  //: banco, e o segundo clique viria 404.
  //:
  //: MEDIDO NA BASE REAL: `bmc.news` casa com DOIS veículos, então pergunta
  //: repetida sobre o mesmo cadastro não é hipótese.
  vi.mocked(duplicadosDeCadastro).mockResolvedValue([
    {
      id: 'p1',
      nome: 'bmc.news',
      tipo: 'perfil_rede',
      cargo: null,
      origens: [],
      mencoes: 3,
      candidatos: [
        { id: 'v1', nome: 'BMC News', tipo: 'veiculo', mencoes: 50, origens: [] },
        { id: 'v9', nome: 'BMC Notícias', tipo: 'veiculo', mencoes: 20, origens: [] },
      ],
    },
    {
      id: 'p3',
      nome: 'bmcnews',
      tipo: 'perfil_rede',
      cargo: null,
      origens: [],
      mencoes: 1,
      //: O MESMO `v1` aparece aqui como candidato. Fundir `bmc.news` em `v1` NÃO
      //: apaga `v1` — ele é o sobrevivente —, então esta pergunta FICA.
      candidatos: [
        { id: 'v1', nome: 'BMC News', tipo: 'veiculo', mencoes: 50, origens: [] },
      ],
    },
  ]);

  render(<FilaDeDuplicados />);
  const botao = await screen.findByRole('button', {
    name: 'Manter BMC News e apagar bmc.news',
  });

  vi.mocked(duplicadosDeCadastro).mockReturnValue(new Promise(() => {}));
  await userEvent.click(botao);

  //: QUEM SAIU: `bmc.news`, e com ele a segunda pergunta dele (sobre `v9`).
  await waitFor(() => expect(screen.queryByText('bmc.news')).toBeNull());
  expect(screen.queryByText('BMC Notícias')).toBeNull();
  //: QUEM FICOU: o sobrevivente continua sendo candidato de outra pergunta.
  expect(screen.getByText('bmcnews')).toBeTruthy();
});

it('a mesma PERGUNTA nao aceita duas decisoes em voo', async () => {
  //: ACHADO MÉDIA DE REVISÃO. A trava era do PAR, então uma pergunta com dois
  //: candidatos deixava o segundo botão clicável durante a primeira decisão —
  //: e, numa fusão, o segundo pedido fala de um cadastro que está saindo.
  vi.mocked(duplicadosDeCadastro).mockResolvedValue([
    {
      id: 'p1',
      nome: 'bmc.news',
      tipo: 'perfil_rede',
      cargo: null,
      origens: [],
      mencoes: 3,
      candidatos: [
        { id: 'v1', nome: 'BMC News', tipo: 'veiculo', mencoes: 50, origens: [] },
        { id: 'v9', nome: 'BMC Notícias', tipo: 'veiculo', mencoes: 20, origens: [] },
      ],
    },
  ]);
  //: A fusão fica EM VOO: é durante ela que o segundo botão tem de estar travado.
  vi.mocked(fundirCadastro).mockReturnValue(new Promise(() => {}));

  render(<FilaDeDuplicados />);
  const primeiro = await screen.findByRole('button', {
    name: 'Manter BMC News e apagar bmc.news',
  });

  await userEvent.click(primeiro);

  await waitFor(() =>
    expect(
      screen
        .getByRole('button', { name: 'Manter BMC Notícias e apagar bmc.news' })
        .hasAttribute('disabled'),
    ).toBe(true),
  );
  expect(
    screen.getByRole('button', { name: 'bmc.news não é BMC Notícias' }).hasAttribute('disabled'),
  ).toBe(true);
});

it('FUNDIR passa as mencoes ao sobrevivente, onde ele aparecer', async () => {
  //: O NÚMERO É LOAD-BEARING NESTA TELA: "é ele que diz qual é a linha com
  //: história, e é sempre a linha com história que sobrevive". Sem releitura,
  //: quem tem de passar as menções é o efeito local — e deixá-las velhas numa
  //: outra pergunta sobre o MESMO sobrevivente faria a decisão seguinte ser
  //: tomada com o número errado. A fusão não tem volta.
  vi.mocked(duplicadosDeCadastro).mockResolvedValue([
    {
      id: 'p1',
      nome: 'bmc.news',
      tipo: 'perfil_rede',
      cargo: null,
      origens: [],
      mencoes: 3,
      candidatos: [
        { id: 'v1', nome: 'BMC News', tipo: 'veiculo', mencoes: 50, origens: [] },
      ],
    },
    {
      id: 'p3',
      nome: 'bmcnews',
      tipo: 'perfil_rede',
      cargo: null,
      origens: [],
      mencoes: 1,
      //: O MESMO sobrevivente, em outra pergunta.
      candidatos: [
        { id: 'v1', nome: 'BMC News', tipo: 'veiculo', mencoes: 50, origens: [] },
      ],
    },
  ]);

  render(<FilaDeDuplicados />);
  const botao = await screen.findByRole('button', {
    name: 'Manter BMC News e apagar bmc.news',
  });

  await userEvent.click(botao);

  //: 50 + as 3 de quem saiu.
  await waitFor(() =>
    expect(screen.getByText(/Veículo de imprensa · 53 menções/)).toBeTruthy(),
  );
  expect(screen.queryByText(/50 menções/)).toBeNull();
});
