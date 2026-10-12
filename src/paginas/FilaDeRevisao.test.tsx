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
 *
 *  E DEPOIS DE 11/10/2026, a busca e o LOTE:
 *
 *  * a busca casa nome, contexto E motivo, sem acento e em qualquer ordem — com
 *    499 linhas, "xp asset" e "duas instituições" são as buscas que servem;
 *  * só INSTITUIÇÃO entra no lote: as outras três tabelas não têm categoria de
 *    público, e oferecer seleção nelas seria oferecer o que o servidor recusa;
 *  * "Selecionar todas" pega o que a BUSCA encontrou, inclusive o que o teto de
 *    renderização não desenhou — o teto é de tela, a seleção é de dado;
 *  * trocar a categoria LIMPA a subcategoria, senão o par recusaria o lote
 *    inteiro antes de gravar nada;
 *  * e as recusadas aparecem uma a uma com o motivo, porque o lote não é
 *    tudo-ou-nada.
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
  enquadrarEmLote: vi.fn(),
}));

//: O CATÁLOGO DUBLADO porque o lote precisa das categorias de público, e elas
//: vêm do estado do painel — a mesma fonte que a tela de cadastro usa.
//: O CATÁLOGO É UMA VARIÁVEL, e não um literal dentro do dublê: a fila carrega
//: por rota própria e NÃO espera a primeira carga do painel, então "catálogo
//: nulo com a fila cheia" é um estado real — e é o que o teste da caixa órfã
//: precisa montar.
const COM_CATEGORIAS = {
  //: OS TRÊS MAPAS, porque a FICHA do registro sai deles: o modal lê a
  //: instituição, o contato e a pessoa da Aegea por id. Sem eles o diálogo
  //: estourava em `catalogo.interlocutores.get` — e foi assim que três testes
  //: apontaram que o modal tinha passado a ser montado por esta tela.
  instituicoes: new Map(),
  interlocutores: new Map(),
  pessoas: new Map(),
  dicionarios: {
    categorias_publico: [
      { id: 7, codigo: 'mercado_financeiro', nome: 'Mercado financeiro', ordem: 1 },
      { id: 2, codigo: 'poder_executivo', nome: 'Poder Executivo', ordem: 2 },
    ],
    subcategorias_publico: [
      { id: 71, categoria_publico_id: 7, nome: 'Gestoras', ordem: 1 },
      { id: 21, categoria_publico_id: 2, nome: 'Federal', ordem: 1 },
    ],
  },
};
let catalogoAtual: unknown = COM_CATEGORIAS;

vi.mock('@/estado/painel', () => ({
  usePainel: () => ({ catalogo: catalogoAtual }),
}));

const { filaDeRevisao, consolidarCadastro, enquadrarEmLote } =
  await import('@/api/cliente');

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
  catalogoAtual = COM_CATEGORIAS;
  vi.mocked(filaDeRevisao).mockResolvedValue(O_MESMO_NOME_DUAS_VEZES);
  vi.mocked(consolidarCadastro).mockResolvedValue({
    pendente: O_MESMO_NOME_DUAS_VEZES[0].pendentes[0],
    ja_estava_consolidado: false,
  });
  vi.mocked(enquadrarEmLote).mockResolvedValue({
    enquadradas: 2,
    consolidadas: 2,
    tipo: 'investidor',
    recusadas: [],
  });
});

//: TRÊS INSTITUIÇÕES E UM CONTATO: é o recorte mínimo que separa o que entra no
//: lote do que não entra, e dá nomes distinguíveis para a busca.
function umaFilaDeInstituicoes(): AbaDeRevisao[] {
  return [
    {
      id: 'instituicoes',
      rotulo: 'Instituições e Contatos',
      pendentes: [
        {
          id: 'a1',
          tipo: 'instituicao',
          nome: 'XP Asset',
          motivo: 'Entrou pela planilha sem categoria de público.',
          contexto: 'Entidade · SP',
          criado_em: '2026-10-11T12:00:00Z',
        },
        {
          id: 'a2',
          tipo: 'instituicao',
          nome: 'Itaú Asset',
          motivo: 'Entrou pela planilha sem categoria de público.',
          contexto: 'Entidade · SP',
          criado_em: '2026-10-11T12:00:00Z',
        },
        {
          id: 'a3',
          tipo: 'instituicao',
          nome: 'JGP Gestão',
          motivo: 'Entrou pela planilha sem categoria de público.',
          contexto: 'Entidade · RJ',
          criado_em: '2026-10-11T12:00:00Z',
        },
        {
          id: 'c1',
          tipo: 'interlocutor',
          nome: 'Artur Santa',
          motivo: 'Apareceu em 2 instituições na mesma planilha.',
          contexto: 'XP Asset',
          criado_em: '2026-10-11T12:00:00Z',
        },
      ],
    },
    { id: 'assuntos', rotulo: 'Temas', pendentes: [] },
    { id: 'porta_vozes', rotulo: 'Representantes Aegea', pendentes: [] },
  ];
}

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

  //: PELO RÓTULO DO BOTÃO QUE SE QUER, e não pelo nome do cadastro: a linha
  //: tem DOIS botões que falam de "Artur Santa" desde que o nome passou a abrir
  //: a ficha. Buscar pelo nome da pessoa casava os dois e clicava no primeiro.
  const botoes = screen.getAllByRole('button', {
    name: /Confirmar que o cadastro de Artur Santa/,
  });
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

  await userEvent.click(
    screen.getAllByRole('button', {
      name: /Confirmar que o cadastro de Artur Santa/,
    })[0],
  );

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

  await userEvent.click(
    screen.getAllByRole('button', {
      name: /Confirmar que o cadastro de Artur Santa/,
    })[0],
  );

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

it('a busca casa nome, CONTEXTO e MOTIVO, sem acento', async () => {
  //: COM 499 LINHAS as buscas que servem não são pelo nome. "xp" casa a
  //: instituição E o contato dela (pelo contexto); "duas instituições" casa pelo
  //: MOTIVO e junta os quatro casos do dia. Buscar só no nome deixaria a segunda
  //: impossível.
  vi.mocked(filaDeRevisao).mockResolvedValue(umaFilaDeInstituicoes());
  render(<FilaDeRevisao aba="instituicoes" />);
  await screen.findByText('XP Asset');

  const campo = screen.getByLabelText(/Buscar na fila/);

  //: PELO CONTEXTO: o contato "Artur Santa" casa por estar na XP Asset.
  await userEvent.clear(campo);
  await userEvent.type(campo, 'xp');
  expect(screen.getByText('XP Asset')).toBeTruthy();
  expect(screen.getByText('Artur Santa')).toBeTruthy();
  expect(screen.queryByText('JGP Gestão')).toBeNull();

  //: SEM ACENTO: quem digita "itau" espera achar "Itaú", e a fila é cheia de
  //: nome acentuado.
  await userEvent.clear(campo);
  await userEvent.type(campo, 'itau');
  expect(screen.getByText('Itaú Asset')).toBeTruthy();
  expect(screen.queryByText('XP Asset')).toBeNull();

  //: PELO MOTIVO.
  await userEvent.clear(campo);
  //: '2 instituicoes' E NAO 'duas': o motivo gravado diz "Apareceu em 2
  //: instituições", e a busca casa o texto que está na tela — não um sinônimo
  //: dele. Meu primeiro teste buscou 'duas' e falhou; a busca estava certa, o
  //: teste é que pedia o que ninguém escreveu.
  await userEvent.type(campo, '2 instituicoes');
  expect(screen.getByText('Artur Santa')).toBeTruthy();
  expect(screen.queryByText('XP Asset')).toBeNull();
});

it('SO instituicao entra no lote', async () => {
  //: `interlocutor`, `tema` e `pessoa_aegea` não têm categoria de público.
  //: Oferecer a seleção neles seria oferecer o que o servidor vai recusar — e o
  //: contato está na MESMA aba das instituições, então o caso é real, não
  //: hipotético.
  vi.mocked(filaDeRevisao).mockResolvedValue(umaFilaDeInstituicoes());
  render(<FilaDeRevisao aba="instituicoes" />);
  await screen.findByText('XP Asset');

  expect(screen.getByLabelText('Selecionar XP Asset para enquadrar')).toBeTruthy();
  expect(screen.queryByLabelText('Selecionar Artur Santa para enquadrar')).toBeNull();
  //: E O BOTÃO CONTA AS TRÊS INSTITUIÇÕES, não as quatro linhas.
  expect(screen.getByRole('button', { name: /Selecionar as 3 instituições/ })).toBeTruthy();
});

it('o LOTE manda os ids escolhidos e a categoria', async () => {
  vi.mocked(filaDeRevisao).mockResolvedValue(umaFilaDeInstituicoes());
  render(<FilaDeRevisao aba="instituicoes" />);
  await screen.findByText('XP Asset');

  await userEvent.click(screen.getByLabelText('Selecionar XP Asset para enquadrar'));
  await userEvent.click(screen.getByLabelText('Selecionar Itaú Asset para enquadrar'));
  await userEvent.selectOptions(
    screen.getByLabelText(/Enquadrar as selecionadas como/),
    '7',
  );
  await userEvent.click(screen.getByRole('button', { name: /Enquadrar 2 instituições/ }));

  expect(enquadrarEmLote).toHaveBeenCalledWith({
    ids: ['a1', 'a2'],
    categoria_publico_id: 7,
    subcategoria_publico_id: null,
  });
  expect(await screen.findByText(/2 cadastros enquadrados/)).toBeTruthy();
});

it('Selecionar todas pega o que a BUSCA encontrou', async () => {
  //: O TETO DE RENDERIZAÇÃO É DE TELA; a seleção é de dado. É a divisão que
  //: permite enquadrar 499 sem desenhar 499 — e é o que a linha "Mostrando N de
  //: M" promete.
  vi.mocked(filaDeRevisao).mockResolvedValue(umaFilaDeInstituicoes());
  render(<FilaDeRevisao aba="instituicoes" />);
  await screen.findByText('XP Asset');

  await userEvent.type(screen.getByLabelText(/Buscar na fila/), 'asset');
  //: DUAS das três instituições casam "asset".
  await userEvent.click(
    screen.getByRole('button', { name: /Selecionar as 2 instituições/ }),
  );
  await userEvent.selectOptions(
    screen.getByLabelText(/Enquadrar as selecionadas como/),
    '7',
  );
  await userEvent.click(screen.getByRole('button', { name: /Enquadrar 2 instituições/ }));

  expect(vi.mocked(enquadrarEmLote).mock.calls[0][0].ids).toEqual(['a1', 'a2']);
});

it('trocar a categoria LIMPA a subcategoria', async () => {
  //: SENÃO O PAR RECUSARIA O LOTE INTEIRO, antes de gravar nada: o servidor
  //: confere categoria × subcategoria e levanta 422. É a conferência que pesa
  //: mais aqui do que no cadastro um a um, porque o par errado iria para até 500
  //: linhas de uma vez.
  vi.mocked(filaDeRevisao).mockResolvedValue(umaFilaDeInstituicoes());
  render(<FilaDeRevisao aba="instituicoes" />);
  await screen.findByText('XP Asset');

  const categoria = screen.getByLabelText(/Enquadrar as selecionadas como/);
  await userEvent.selectOptions(categoria, '7');
  await userEvent.selectOptions(screen.getByLabelText(/Subcategoria/), '71');

  //: TROCA A CATEGORIA: a subcategoria "Gestoras" não pertence a Poder Executivo.
  await userEvent.selectOptions(categoria, '2');
  await userEvent.click(screen.getByLabelText('Selecionar XP Asset para enquadrar'));
  await userEvent.click(screen.getByRole('button', { name: /Enquadrar 1 instituições/ }));

  expect(vi.mocked(enquadrarEmLote).mock.calls[0][0].subcategoria_publico_id).toBeNull();
});

it('as RECUSADAS aparecem uma a uma com o motivo', async () => {
  //: O LOTE NÃO É TUDO-OU-NADA, e é a decisão de desenho mais importante dele:
  //: com 499 linhas, uma colisão de nome faria o lote inteiro falhar e a pessoa
  //: não teria como saber qual das 499.
  vi.mocked(filaDeRevisao).mockResolvedValue(umaFilaDeInstituicoes());
  vi.mocked(enquadrarEmLote).mockResolvedValue({
    enquadradas: 1,
    consolidadas: 1,
    tipo: 'investidor',
    recusadas: [
      {
        id: 'a2',
        nome: 'Itaú Asset',
        motivo:
          "Já existe outra instituição com este nome do tipo 'Investidor' — é " +
          "possível duplicata. Resolva em 'Possíveis duplicados'.",
      },
    ],
  });
  render(<FilaDeRevisao aba="instituicoes" />);
  await screen.findByText('XP Asset');

  await userEvent.click(screen.getByLabelText('Selecionar XP Asset para enquadrar'));
  await userEvent.selectOptions(
    screen.getByLabelText(/Enquadrar as selecionadas como/),
    '7',
  );
  await userEvent.click(screen.getByRole('button', { name: /Enquadrar 1 instituições/ }));

  expect(await screen.findByText(/1 cadastro não pôde ser enquadrado/)).toBeTruthy();
  expect(screen.getByText(/possível duplicata/)).toBeTruthy();
});

it('SEM CATALOGO nao ha painel de lote NEM caixa de selecao', async () => {
  //: ACHADO DE REVISÃO: as duas condições estavam separadas, e sem catálogo o
  //: painel desaparecia e as CAIXAS FICAVAM — um controle órfão. Dava para
  //: marcar linhas "para enquadrar" e não havia ação nenhuma a tomar.
  //:
  //: OFERECER UMA ESCOLHA QUE NÃO LEVA A LUGAR é pior do que não oferecer: quem
  //: marca 40 linhas e depois procura o botão conclui que a tela está quebrada.
  //:
  //: E O ESTADO É REAL, não hipotético: a fila carrega por rota própria e não
  //: espera a primeira carga do painel, então "catálogo nulo com a fila cheia" é
  //: o que acontece nos primeiros instantes de toda abertura da tela.
  catalogoAtual = null;
  vi.mocked(filaDeRevisao).mockResolvedValue(umaFilaDeInstituicoes());

  render(<FilaDeRevisao aba="instituicoes" />);
  await screen.findByText('XP Asset');

  //: A LISTA E O "ESTÁ CERTO" FUNCIONAM — a fila não depende do catálogo.
  expect(screen.getAllByRole('button', { name: /está certo/i }).length).toBeGreaterThan(0);
  //: MAS NÃO HÁ LOTE, E NÃO HÁ SELEÇÃO.
  expect(screen.queryByLabelText(/Enquadrar as selecionadas como/)).toBeNull();
  expect(screen.queryByLabelText('Selecionar XP Asset para enquadrar')).toBeNull();
});
