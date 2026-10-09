// @vitest-environment jsdom

/** A lista que define a lente Mercado, e o que ela não pode deixar acontecer.
 *
 *  O CRITÉRIO MUDOU DE LUGAR: a lente Mercado se separava por uma coluna do
 *  fornecedor (`Público-alvo = Investidores`) e passou a se separar pela
 *  subcategoria de público do cadastro. Esta tela é o único jeito de manter a
 *  lista, então o que ela erra ninguém corrige — a conta do mês sai errada e
 *  parece mês ruim.
 *
 *  OS TRÊS ERROS QUE OS TESTES PEGAM: salvar a lista errada (manda os ids de
 *  quem está marcado, e não a página visível), deixar marcar quem o servidor
 *  não vai aceitar (veículo já classificado em outra subcategoria) e perder a
 *  edição em silêncio (sem dizer que há alteração sem salvar).
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VeiculosDeInvestidores } from '@/paginas/score/VeiculosDeInvestidores';
import type { Instituicao } from '@/dominio/tipos';

vi.mock('@/api/cliente', () => ({
  definirVeiculosDeInvestidores: vi.fn(),
}));

const { definirVeiculosDeInvestidores } = await import('@/api/cliente');

//: A IMPRENSA É A CATEGORIA 4 e o Mercado a SUBCATEGORIA 12 nesta fixture —
//: números quaisquer, de propósito: o componente tem de achá-los pelo NOME, e
//: um teste com id 1 passaria mesmo se o código usasse o primeiro da lista.
const IMPRENSA = 4;
const MERCADO = 12;

const DICIONARIOS = {
  esferas: [],
  relevancias: [],
  categorias_publico: [
    { id: 9, codigo: 'orgaos', nome: 'Órgãos públicos', ordem: 1 },
    { id: IMPRENSA, codigo: 'imprensa', nome: 'Imprensa', ordem: 2 },
  ],
  subcategorias_publico: [
    //: O MESMO NOME EM OUTRA CATEGORIA, porque `subcategoria_publico` repete
    //: nome de propósito: achar só pelo nome pegaria esta.
    {
      id: 7,
      codigo: 'economica',
      nome: 'Econômica e de negócios',
      ordem: 1,
      categoria_publico_id: 9,
    },
    {
      id: MERCADO,
      codigo: 'economica',
      nome: 'Econômica e de negócios',
      ordem: 1,
      categoria_publico_id: IMPRENSA,
    },
    {
      id: 13,
      codigo: 'geral_nacional',
      nome: 'Geral nacional',
      ordem: 2,
      categoria_publico_id: IMPRENSA,
    },
  ],
  ufs: [],
};

function veiculo(
  nome: string,
  subcategoria: number | null = null,
  tipo = 'veiculo',
): Instituicao {
  return {
    id: `id-${nome}`,
    nome,
    tipo,
    nome_completo: null,
    uf: 'São Paulo',
    esfera_id: null,
    tier: null,
    categoria_publico_id: tipo === 'veiculo' ? IMPRENSA : null,
    subcategoria_publico_id: subcategoria,
    ativo: true,
  };
}

let catalogoAtual: {
  instituicoes: Map<string, Instituicao>;
  dicionarios: typeof DICIONARIOS;
} | null = null;

function catalogoCom(instituicoes: Instituicao[]) {
  return {
    instituicoes: new Map(instituicoes.map((i) => [i.id, i])),
    interlocutores: new Map(),
    pessoas: new Map(),
    referencias: [],
    alegacoes: [],
    dicionarios: DICIONARIOS,
  };
}

vi.mock('@/estado/painel', () => ({
  usePainel: () => ({
    catalogo: catalogoAtual,
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

const CADASTRO = [
  veiculo('Valor Econômico', MERCADO),
  veiculo('InfoMoney', MERCADO),
  veiculo('Folha de S.Paulo'),
  veiculo('Jornal do Bairro', 13),
  veiculo('Ministério das Cidades', null, 'orgao'),
];

beforeEach(() => {
  vi.clearAllMocks();
  catalogoAtual = catalogoCom(CADASTRO);
  vi.mocked(definirVeiculosDeInvestidores).mockResolvedValue({
    marcados: 0,
    desmarcados: 0,
  });
});

describe('VeiculosDeInvestidores', () => {
  it('ABRE MOSTRANDO SÓ A LISTA: são 81 contra 2.670 veículos', () => {
    render(<VeiculosDeInvestidores />);

    expect(screen.getByText(/Veículos de investidores \(2\)/)).toBeTruthy();
    expect(screen.getByLabelText('Valor Econômico conta na lente Mercado')).toBeTruthy();
    // A Folha está cadastrada e NÃO está na lista: não aparece até a pessoa
    // pedir para ver todos.
    expect(screen.queryByLabelText('Folha de S.Paulo conta na lente Mercado')).toBeNull();
  });

  it('não oferece quem não é veículo: a lente lê menção, e menção vem de veículo', async () => {
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.click(screen.getByLabelText('Mostrar só os da lista'));

    expect(screen.getByLabelText('Folha de S.Paulo conta na lente Mercado')).toBeTruthy();
    expect(
      screen.queryByLabelText('Ministério das Cidades conta na lente Mercado'),
    ).toBeNull();
  });

  it('A SUBCATEGORIA É ACHADA PELO PAR (categoria, subcategoria)', () => {
    // O Valor Econômico está na subcategoria 12 — a "Econômica e de negócios"
    // DA IMPRENSA. A de id 7 tem o mesmo nome noutra categoria; se o código
    // casasse só pelo nome, acharia a 7 e a lista sairia vazia.
    render(<VeiculosDeInvestidores />);

    expect(screen.getByText(/Veículos de investidores \(2\)/)).toBeTruthy();
  });

  it('salva a lista INTEIRA, e não a página visível', async () => {
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.click(screen.getByLabelText('InfoMoney conta na lente Mercado'));
    await pessoa.click(screen.getByText(/Salvar a lista/));

    await waitFor(() => expect(definirVeiculosDeInvestidores).toHaveBeenCalledTimes(1));
    // DESMARCAR O INFOMONEY manda a lista SEM ele — é o que a rota declarativa
    // entende por "saiu". Mandar só o que mudou apagaria os outros 80.
    expect(vi.mocked(definirVeiculosDeInvestidores).mock.calls[0][0]).toEqual([
      'id-Valor Econômico',
    ]);
  });

  it('acrescentar um veículo manda o id dele junto', async () => {
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.click(screen.getByLabelText('Mostrar só os da lista'));
    await pessoa.click(screen.getByLabelText('Folha de S.Paulo conta na lente Mercado'));
    await pessoa.click(screen.getByText(/Salvar a lista/));

    await waitFor(() => expect(definirVeiculosDeInvestidores).toHaveBeenCalledTimes(1));
    expect(vi.mocked(definirVeiculosDeInvestidores).mock.calls[0][0]).toEqual([
      'id-Folha de S.Paulo',
      'id-InfoMoney',
      'id-Valor Econômico',
    ]);
  });

  it('NÃO DEIXA MARCAR quem já tem outra subcategoria — o servidor não sobrescreve', async () => {
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.click(screen.getByLabelText('Mostrar só os da lista'));

    const caixa = screen.getByLabelText(
      'Jornal do Bairro conta na lente Mercado',
    ) as HTMLInputElement;
    expect(caixa.disabled).toBe(true);
    expect(screen.getByText('já classificado em outra subcategoria')).toBeTruthy();
  });

  it('DIZ QUE HÁ ALTERAÇÃO SEM SALVAR, e o botão só liga quando há', async () => {
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    const botao = screen.getByText(/Salvar a lista/).closest('button');
    expect(botao?.disabled).toBe(true);

    await pessoa.click(screen.getByLabelText('InfoMoney conta na lente Mercado'));

    expect(screen.getByText('1 alteração sem salvar')).toBeTruthy();
    expect(screen.getByText(/Salvar a lista/).closest('button')?.disabled).toBe(false);
  });

  it('DESCARTAR volta ao que o catálogo diz', async () => {
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.click(screen.getByLabelText('InfoMoney conta na lente Mercado'));
    await pessoa.click(screen.getByText('Descartar'));

    expect(screen.getByText(/Veículos de investidores \(2\)/)).toBeTruthy();
    expect(screen.queryByText(/sem salvar/)).toBeNull();
  });

  it('repete o que mudou: quantos entraram e quantos saíram', async () => {
    vi.mocked(definirVeiculosDeInvestidores).mockResolvedValue({
      marcados: 3,
      desmarcados: 1,
    });
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.click(screen.getByLabelText('InfoMoney conta na lente Mercado'));
    await pessoa.click(screen.getByText(/Salvar a lista/));

    await waitFor(() =>
      expect(screen.getByText('3 entraram, 1 saíram.')).toBeTruthy(),
    );
  });

  it('a recusa do servidor aparece, e a edição NÃO é descartada', async () => {
    vi.mocked(definirVeiculosDeInvestidores).mockRejectedValue(
      new Error('A subcategoria "Econômica e de negócios" da Imprensa não está cadastrada.'),
    );
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.click(screen.getByLabelText('InfoMoney conta na lente Mercado'));
    await pessoa.click(screen.getByText(/Salvar a lista/));

    await waitFor(() => expect(screen.getByText(/não está cadastrada/)).toBeTruthy());
    // A EDIÇÃO CONTINUA EM TELA: perdê-la obrigaria a pessoa a refazer a
    // conferência de 81 nomes por causa de um erro do servidor.
    expect(screen.getByText('1 alteração sem salvar')).toBeTruthy();
  });

  it('a busca procura no cadastro inteiro, e não só na lista', async () => {
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.click(screen.getByLabelText('Mostrar só os da lista'));
    await pessoa.type(screen.getByLabelText('Buscar um veículo'), 'folha');

    expect(screen.getByLabelText('Folha de S.Paulo conta na lente Mercado')).toBeTruthy();
    expect(screen.queryByLabelText('InfoMoney conta na lente Mercado')).toBeNull();
  });

  it('SEM A SUBCATEGORIA CADASTRADA, a tela diz o que falta em vez de mostrar lista vazia', () => {
    catalogoAtual = {
      instituicoes: new Map(CADASTRO.map((i) => [i.id, i])),
      dicionarios: {
        ...DICIONARIOS,
        subcategorias_publico: DICIONARIOS.subcategorias_publico.filter(
          (s) => s.id !== MERCADO,
        ),
      },
    };

    render(<VeiculosDeInvestidores />);

    expect(screen.getByText(/não está cadastrada/)).toBeTruthy();
    expect(screen.queryByText(/Salvar a lista/)).toBeNull();
  });
});
