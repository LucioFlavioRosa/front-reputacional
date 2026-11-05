// @vitest-environment jsdom

/** A PERMISSÃO ATRAVESSA TRÊS COMPONENTES, e este arquivo é o que prende a
 *  travessia.
 *
 *  `administra_dicionarios` nasce no `App`, desce para este portal, dele para
 *  `CadastroDeInstituicoes` e dele para `FilaDeDuplicados`, que é quem a usa —
 *  para decidir se oferece o botão "Rodar o pareamento".
 *
 *  O QUE ISTO IMPEDE. Nenhum desses saltos tinha cobertura, e dois deles passam a
 *  prop por nome: deixar cair `administraCadastros={administraCadastros}` em
 *  qualquer um faria o botão simplesmente NÃO APARECER — sem erro de tipo (a prop
 *  da ponta tem padrão `false`), sem teste vermelho, e sem ninguém saber por que
 *  a tela voltou a mandar "peça a quem administra".
 *
 *  O SALTO DE CIMA (`App` -> este portal) o `tsc` cobre, porque aqui a prop é
 *  OBRIGATÓRIA. Os dois de baixo são estes dois testes.
 *
 *  UM TESTE QUE ATRAVESSA, e não três que conferem props: prop passada é detalhe
 *  de implementação — o que importa é o botão chegar à tela de quem administra, e
 *  não chegar à de quem só lê.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import { PortalDoCadastroCompartilhado } from '@/paginas/PortalDoCadastroCompartilhado';

vi.mock('@/api/cliente', () => ({
  //: A ABA DE INSTITUIÇÕES É A QUE ABRE, então o conjunto de dublês é o do
  //: `CadastroDeInstituicoes` — as outras duas abas não montam.
  filaDeRevisao: vi.fn(async () => []),
  consolidarCadastro: vi.fn(),
  //: A FILA VAZIA E NUNCA PAREADA: é o estado em que o aviso aparece e o botão
  //: tem o que fazer. Pareada e em dia faria a seção desaparecer, e o teste
  //: passaria sem provar nada.
  duplicadosDeCadastro: vi.fn(async () => []),
  estadoDaFilaDeDuplicados: vi.fn(async () => ({
    calculado_em: null,
    desatualizado: true,
  })),
  pedirPareamento: vi.fn(async () => ({ pares: 0 })),
  fundirCadastro: vi.fn(),
  declararCadastroDistinto: vi.fn(),
  criarInstituicao: vi.fn(),
  editarInstituicao: vi.fn(),
  criarInterlocutor: vi.fn(),
  editarInterlocutor: vi.fn(),
  obterDicionarios: vi.fn(async () => ({
    esferas: [],
    relevancias: [],
    categorias_publico: [],
    subcategorias_publico: [],
    ufs: [],
  })),
}));

//: O CATÁLOGO VEM DO CONTEXTO DO PAINEL, e `CadastroDeInstituicoes` o exige —
//: `usePainel` levanta fora do provedor. Dublar o estado é o que os testes
//: vizinhos já fazem (`CadastroDeInstituicoes.perfil`), e aqui o catálogo pode
//: ser vazio: o que está sob teste é a travessia da permissão, não a lista.
vi.mock('@/estado/painel', () => ({
  usePainel: () => ({
    catalogo: {
      instituicoes: new Map(),
      interlocutores: new Map(),
      pessoas: new Map(),
      referencias: [],
      alegacoes: [],
      dicionarios: {
        esferas: [],
        relevancias: [],
        categorias_publico: [],
        subcategorias_publico: [],
        ufs: [],
      },
    },
    recorte: {},
    definirRecorte: vi.fn(),
    limparRecorte: vi.fn(),
    interacoes: [],
    total: 0,
    truncado: false,
    carregando: false,
    atualizando: false,
    erro: null,
    recarregar: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

it('a permissao CHEGA ao botao do pareamento, tres niveis abaixo', async () => {
  render(<PortalDoCadastroCompartilhado administraCadastros />);

  expect(
    await screen.findByRole('button', { name: 'Rodar o pareamento' }),
  ).toBeTruthy();
});

it('e sem ela o botao NAO chega, e a tela manda pedir', async () => {
  //: O CONTROLE NEGATIVO. Sem ele, o teste de cima passaria com um botão que
  //: aparece para todo mundo — que é o defeito oposto, e pior: oferece a quem
  //: receberia 403.
  render(<PortalDoCadastroCompartilhado administraCadastros={false} />);

  expect(
    await screen.findByText(/Peça a quem administra os cadastros/),
  ).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: 'Rodar o pareamento' }),
  ).toBeNull();
});
