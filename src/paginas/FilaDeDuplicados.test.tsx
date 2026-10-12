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

import type { CadastroDuplicado } from '@/api/cliente';
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
  //: ESTE TESTE MUDOU DE PREMISSA, e a antiga provava menos do que o nome dizia.
  //: Ele devolvia `[]` num mock que resolve no mesmo tick e checava que a linha
  //: saiu — o que passa hoje pelo EFEITO LOCAL, sem releitura nenhuma. A linha
  //: que sai é medida em "a linha SAI NA HORA"; aqui se mede a RELEITURA, que é
  //: o que o nome promete.
  //:
  //: E SÓ A CHAMADA, de propósito — achado BAIXA de revisão, respondido e não
  //: consertado: este teste passaria se a resposta da releitura fosse ignorada.
  //: Quem mede o EFEITO dela é "a releitura em segundo plano RECONCILIA", e quem
  //: mede o descarte da velha é "a releitura VELHA ... é DESCARTADA". Repetir a
  //: asserção aqui faria três testes caírem juntos pelo mesmo motivo, e um teste
  //: que cai junto com outro não diz onde está o defeito.
  render(<FilaDeDuplicados />);
  const botao = await screen.findByRole('button', {
    name: 'valoreconomico não é Valor Econômico',
  });
  expect(duplicadosDeCadastro).toHaveBeenCalledTimes(1);

  await userEvent.click(botao);

  await waitFor(() => expect(duplicadosDeCadastro).toHaveBeenCalledTimes(2));
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
      mencoes: 2,
      candidatos: [
        { id: 'o2', nome: 'Prefeitura Municipal de Campinas', tipo: 'orgao', mencoes: 9 },
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
      mencoes: 2,
      candidatos: [
        { id: `v${n}`, nome: `Veiculo ${n}`, tipo: 'veiculo', mencoes: 9 },
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
      mencoes: 2,
      candidatos: [{ id: `v${n}`, nome: `V ${n}`, tipo: 'veiculo', mencoes: 9 }],
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
      mencoes: 1,
      candidatos: [{ id: 'v2', nome: 'Outro Veículo', tipo: 'veiculo', mencoes: 40 }],
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
      mencoes: 3,
      candidatos: [
        { id: 'v1', nome: 'BMC News', tipo: 'veiculo', mencoes: 50 },
        { id: 'v9', nome: 'BMC Notícias', tipo: 'veiculo', mencoes: 20 },
      ],
    },
    {
      id: 'p3',
      nome: 'bmcnews',
      tipo: 'perfil_rede',
      cargo: null,
      mencoes: 1,
      //: O MESMO `v1` aparece aqui como candidato. Fundir `bmc.news` em `v1` NÃO
      //: apaga `v1` — ele é o sobrevivente —, então esta pergunta FICA.
      candidatos: [{ id: 'v1', nome: 'BMC News', tipo: 'veiculo', mencoes: 50 }],
    },
  ]);

  render(<FilaDeDuplicados />);
  const botao = await screen.findByRole('button', {
    name: 'Fundir bmc.news em BMC News',
  });

  vi.mocked(duplicadosDeCadastro).mockReturnValue(new Promise(() => {}));
  await userEvent.click(botao);

  //: QUEM SAIU: `bmc.news`, e com ele a segunda pergunta dele (sobre `v9`).
  await waitFor(() => expect(screen.queryByText('bmc.news')).toBeNull());
  expect(screen.queryByText('BMC Notícias')).toBeNull();
  //: QUEM FICOU: o sobrevivente continua sendo candidato de outra pergunta.
  expect(screen.getByText('bmcnews')).toBeTruthy();
});

it('a releitura VELHA que volta depois de uma decisao nova e DESCARTADA', async () => {
  //: ACHADO BAIXA DE REVISÃO, e ele estava certo: os testes provavam que uma
  //: releitura pendente consegue escrever, e NÃO provavam a parte arriscada da
  //: mudança — descartar a releitura velha que volta depois de uma decisão mais
  //: nova. Sem este teste, uma regressão na guarda de ordem ressuscitaria linhas
  //: já resolvidas sem nada acusar.
  //:
  //: E A JANELA AQUI É DE SETE SEGUNDOS: decidir dois pares seguidos deixa duas
  //: releituras no ar, e a primeira carrega a fila de ANTES da segunda decisão.
  const PAR2 = {
    id: 'p2',
    nome: 'outro handle',
    tipo: 'perfil_rede',
    cargo: null,
    mencoes: 1,
    candidatos: [{ id: 'v2', nome: 'Outro Veículo', tipo: 'veiculo', mencoes: 40 }],
  };
  vi.mocked(duplicadosDeCadastro).mockResolvedValue([...UM_PAR, PAR2]);

  render(<FilaDeDuplicados />);
  await screen.findByText('valoreconomico');

  const resolvers: ((valor: CadastroDuplicado[]) => void)[] = [];
  vi.mocked(duplicadosDeCadastro).mockImplementation(
    () =>
      new Promise((ok) => {
        resolvers.push(ok);
      }),
  );

  await userEvent.click(
    screen.getByRole('button', { name: 'valoreconomico não é Valor Econômico' }),
  );
  await waitFor(() => expect(screen.queryByText('valoreconomico')).toBeNull());

  await userEvent.click(
    screen.getByRole('button', { name: 'outro handle não é Outro Veículo' }),
  );
  await waitFor(() => expect(screen.queryByText('outro handle')).toBeNull());

  expect(resolvers.length).toBe(2);

  //: A PRIMEIRA releitura volta agora, com a fila de ANTES da segunda decisão.
  resolvers[0]([PAR2]);
  //: Dois ticks para o `.then` do mock rodar. Se a guarda falhar, há escrita de
  //: estado aqui — e `outro handle` volta à tela.
  await Promise.resolve();
  await Promise.resolve();
  expect(screen.queryByText('outro handle')).toBeNull();

  //: E A MAIS NOVA ESCREVE: descartar a velha não pode significar descartar
  //: todas, senão a tela nunca mais se reconcilia com o servidor.
  resolvers[1]([
    {
      id: 'p9',
      nome: 'chegou do servidor',
      tipo: 'perfil_rede',
      cargo: null,
      mencoes: 1,
      candidatos: [{ id: 'v9', nome: 'Veículo Nove', tipo: 'veiculo', mencoes: 7 }],
    },
  ]);
  expect(await screen.findByText('chegou do servidor')).toBeTruthy();
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
      mencoes: 3,
      candidatos: [
        { id: 'v1', nome: 'BMC News', tipo: 'veiculo', mencoes: 50 },
        { id: 'v9', nome: 'BMC Notícias', tipo: 'veiculo', mencoes: 20 },
      ],
    },
  ]);
  //: A fusão fica EM VOO: é durante ela que o segundo botão tem de estar travado.
  vi.mocked(fundirCadastro).mockReturnValue(new Promise(() => {}));

  render(<FilaDeDuplicados />);
  const primeiro = await screen.findByRole('button', {
    name: 'Fundir bmc.news em BMC News',
  });

  await userEvent.click(primeiro);

  await waitFor(() =>
    expect(
      screen
        .getByRole('button', { name: 'Fundir bmc.news em BMC Notícias' })
        .hasAttribute('disabled'),
    ).toBe(true),
  );
  expect(
    screen.getByRole('button', { name: 'bmc.news não é BMC Notícias' }).hasAttribute('disabled'),
  ).toBe(true);
});

it('a releitura em segundo plano RECONCILIA, sem travar a tela', async () => {
  //: O OTIMISMO NÃO DISPENSA A VERDADE DO SERVIDOR. A tela responde na hora pelo
  //: efeito local, e a releitura chega depois para corrigir o que o efeito local
  //: não sabe — por exemplo um par que outra pessoa decidiu enquanto esta decidia.
  let resolver: (valor: CadastroDuplicado[]) => void = () => {};
  render(<FilaDeDuplicados />);
  const botao = await screen.findByRole('button', {
    name: 'valoreconomico não é Valor Econômico',
  });

  vi.mocked(duplicadosDeCadastro).mockReturnValue(
    new Promise((ok) => {
      resolver = ok;
    }),
  );
  await userEvent.click(botao);
  await waitFor(() => expect(screen.queryByText('valoreconomico')).toBeNull());

  //: O servidor devolve uma pergunta que a tela não tinha.
  resolver([
    {
      id: 'p9',
      nome: 'apareceu depois',
      tipo: 'perfil_rede',
      cargo: null,
      mencoes: 1,
      candidatos: [{ id: 'v9', nome: 'Veículo Nove', tipo: 'veiculo', mencoes: 7 }],
    },
  ]);

  expect(await screen.findByText('apareceu depois')).toBeTruthy();
});
