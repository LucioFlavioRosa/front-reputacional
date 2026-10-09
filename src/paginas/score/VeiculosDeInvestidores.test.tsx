// @vitest-environment jsdom

/** A lista que define a lente Mercado, e o que ela não pode deixar acontecer.
 *
 *  O CRITÉRIO MUDOU DE LUGAR: a lente Mercado se separava por uma coluna do
 *  fornecedor (`Público-alvo = Investidores`) e passou a se separar pela
 *  subcategoria de público do cadastro. Esta aba é o único jeito de manter a
 *  lista, então o que ela erra ninguém corrige — a conta do mês sai errada e
 *  parece mês ruim.
 *
 *  A ABA É SÓ DO MERCADO FINANCEIRO: ela mostra a lista, e não os 2.670
 *  veículos do cadastro. Acrescentar é um gesto à parte, e tem de servir aos
 *  dois casos — o veículo que já está no cadastro compartilhado e o que ainda
 *  não está (dos 81 da planilha, 9 existiam antes da primeira carga da Clipei
 *  e 72 nasceram dela).
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VeiculosDeInvestidores } from '@/paginas/score/VeiculosDeInvestidores';
import type { Instituicao } from '@/dominio/tipos';

vi.mock('@/api/cliente', () => ({
  definirVeiculosDeInvestidores: vi.fn(),
  criarInstituicao: vi.fn(),
}));

const { criarInstituicao, definirVeiculosDeInvestidores } = await import('@/api/cliente');

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
  ufs: [
    { codigo: 'SP', nome: 'São Paulo' },
    { codigo: 'NA', nome: 'Nacional' },
  ],
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
    uf: 'SP',
    esfera_id: null,
    tier: null,
    categoria_publico_id: tipo === 'veiculo' ? IMPRENSA : null,
    subcategoria_publico_id: subcategoria,
    ativo: true,
  };
}

let catalogoAtual: ReturnType<typeof catalogoCom> | null = null;

function catalogoCom(instituicoes: Instituicao[], dicionarios = DICIONARIOS) {
  return {
    instituicoes: new Map(instituicoes.map((i) => [i.id, i])),
    interlocutores: new Map(),
    pessoas: new Map(),
    referencias: [],
    alegacoes: [],
    dicionarios,
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
  veiculo('Estadão'),
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
  vi.mocked(criarInstituicao).mockResolvedValue({} as Instituicao);
});

/** Os nomes que a lista mostra. */
function naTela(): string[] {
  return screen
    .getAllByRole('listitem')
    .map((l) => l.textContent ?? '')
    .map((t) => t.replace(/SP|—|Remover|Desfazer|sai ao salvar|entra ao salvar/g, '').trim());
}

describe('VeiculosDeInvestidores', () => {
  it('MOSTRA SÓ OS DA LENTE MERCADO: a aba é sobre eles, não sobre o cadastro', () => {
    render(<VeiculosDeInvestidores />);

    expect(screen.getByText(/Veículos de investidores \(2\)/)).toBeTruthy();
    expect(naTela()).toEqual(['InfoMoney', 'Valor Econômico']);
  });

  it('A SUBCATEGORIA É ACHADA PELO PAR (categoria, subcategoria)', () => {
    // O Valor Econômico está na subcategoria 12 — a "Econômica e de negócios"
    // DA IMPRENSA. A de id 7 tem o mesmo nome noutra categoria; se o código
    // casasse só pelo nome, acharia a 7 e a lista sairia vazia.
    render(<VeiculosDeInvestidores />);

    expect(screen.getByText(/Veículos de investidores \(2\)/)).toBeTruthy();
  });

  it('REMOVER RISCA A LINHA e dá como desfazer — tirar o errado de 81 é fácil', async () => {
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.click(screen.getAllByText('Remover')[0]);

    expect(screen.getByText('sai ao salvar')).toBeTruthy();
    expect(screen.getByText(/Veículos de investidores \(1\)/)).toBeTruthy();
    // A LINHA CONTINUA EM TELA: quem remove e vê o nome desaparecer não tem
    // como saber qual removeu.
    expect(naTela()).toEqual(['InfoMoney', 'Valor Econômico']);

    await pessoa.click(screen.getByText('Desfazer'));
    expect(screen.getByText(/Veículos de investidores \(2\)/)).toBeTruthy();
  });

  it('salva a lista INTEIRA, e não só o que mudou', async () => {
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.click(screen.getAllByText('Remover')[0]);
    await pessoa.click(screen.getByText(/Salvar a lista/));

    await waitFor(() => expect(definirVeiculosDeInvestidores).toHaveBeenCalledTimes(1));
    // A lista sai SEM o InfoMoney — é o que a rota declarativa entende por
    // "saiu". Mandar só o que mudou apagaria os outros 80.
    expect(vi.mocked(definirVeiculosDeInvestidores).mock.calls[0][0]).toEqual([
      'id-Valor Econômico',
    ]);
  });

  it('ACRESCENTAR acha no cadastro compartilhado quem está fora da lista', async () => {
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.click(screen.getByText('Acrescentar veículo'));
    await pessoa.type(screen.getByLabelText('Nome do veículo'), 'estadao');

    // SEM ACENTO E SEM CAIXA: quem digita "estadao" tem de achar "Estadão".
    await pessoa.click(screen.getByText('Acrescentar'));

    expect(screen.getByText('acrescentado')).toBeTruthy();
    await pessoa.click(screen.getByText('Fechar'));
    expect(screen.getByText(/Veículos de investidores \(3\)/)).toBeTruthy();
    expect(screen.getByText('entra ao salvar')).toBeTruthy();
  });

  it('a busca do acrescentar NÃO oferece quem já está na lista', async () => {
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.click(screen.getByText('Acrescentar veículo'));
    await pessoa.type(screen.getByLabelText('Nome do veículo'), 'infomoney');

    expect(screen.getByText(/Nenhum veículo com esse nome fora da lista/)).toBeTruthy();
  });

  it('não oferece quem não é veículo: a lente lê menção, e menção vem de veículo', async () => {
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.click(screen.getByText('Acrescentar veículo'));
    await pessoa.type(screen.getByLabelText('Nome do veículo'), 'Ministério');

    expect(screen.getByText(/Nenhum veículo com esse nome fora da lista/)).toBeTruthy();
  });

  it('CADASTRA O QUE NÃO EXISTE já como imprensa econômica', async () => {
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.click(screen.getByText('Acrescentar veículo'));
    await pessoa.type(screen.getByLabelText('Nome do veículo'), 'Expert XP');
    await pessoa.selectOptions(screen.getByLabelText('Abrangência'), 'NA');
    await pessoa.click(screen.getByText(/Cadastrar "Expert XP" como veículo/));

    await waitFor(() => expect(criarInstituicao).toHaveBeenCalledTimes(1));
    // JÁ COM A SUBCATEGORIA DO MERCADO: foi isto que a pessoa pediu ao
    // cadastrar um veículo AQUI. Nascer sem ela obrigaria a marcar depois.
    expect(vi.mocked(criarInstituicao).mock.calls[0][0]).toEqual({
      nome: 'Expert XP',
      tipo: 'veiculo',
      uf: 'NA',
      categoria_publico_id: IMPRENSA,
      subcategoria_publico_id: MERCADO,
    });
  });

  it('DEPOIS DE CADASTRAR, diz que a menção vem da planilha', async () => {
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.click(screen.getByText('Acrescentar veículo'));
    await pessoa.type(screen.getByLabelText('Nome do veículo'), 'Expert XP');
    await pessoa.click(screen.getByText(/Cadastrar "Expert XP" como veículo/));

    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.getByRole('status').textContent).toContain(
      'passa a contar quando uma planilha da Clipei o mencionar',
    );
  });

  it('O RODAPÉ FECHA, e não é um "Concluir" que descarta o que foi digitado', async () => {
    // O QUE ISTO PEGOU: o rodapé tinha um "Concluir" primário — o botão mais
    // visível da janela — que só fechava. Quem preencheu nome e abrangência
    // clicou nele, e o veículo nunca foi cadastrado, sem erro em tela.
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.click(screen.getByText('Acrescentar veículo'));

    expect(screen.queryByText('Concluir')).toBeNull();
    expect(screen.getByText('Fechar')).toBeTruthy();
  });

  it('ENTER no nome cadastra, que é o gesto de quem está cadastrando', async () => {
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.click(screen.getByText('Acrescentar veículo'));
    await pessoa.type(
      screen.getByLabelText('Nome do veículo'),
      'Revista do Lúcio{Enter}',
    );

    await waitFor(() => expect(criarInstituicao).toHaveBeenCalledTimes(1));
    expect(vi.mocked(criarInstituicao).mock.calls[0][0]).toMatchObject({
      nome: 'Revista do Lúcio',
      tipo: 'veiculo',
    });
  });

  it('ENTER não cadastra de novo o nome que já existe', async () => {
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.click(screen.getByText('Acrescentar veículo'));
    await pessoa.type(screen.getByLabelText('Nome do veículo'), 'Estadão{Enter}');

    expect(criarInstituicao).not.toHaveBeenCalled();
  });

  it('o veículo pode nascer SEM abrangência', async () => {
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.click(screen.getByText('Acrescentar veículo'));
    await pessoa.type(screen.getByLabelText('Nome do veículo'), 'Times Brasil');
    await pessoa.click(screen.getByText(/Cadastrar "Times Brasil" como veículo/));

    await waitFor(() => expect(criarInstituicao).toHaveBeenCalledTimes(1));
    expect(vi.mocked(criarInstituicao).mock.calls[0][0]).toMatchObject({ uf: null });
  });

  it('NÃO OFERECE CADASTRAR o nome que já existe — o índice único recusaria', async () => {
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.click(screen.getByText('Acrescentar veículo'));
    await pessoa.type(screen.getByLabelText('Nome do veículo'), 'Estadão');

    expect(screen.queryByText(/Cadastrar "Estadão" como veículo/)).toBeNull();
    expect(screen.getByText('Acrescentar')).toBeTruthy();
  });

  it('a recusa do cadastro aparece na janela', async () => {
    vi.mocked(criarInstituicao).mockRejectedValue(
      new Error('Já existe uma instituição com esse nome.'),
    );
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.click(screen.getByText('Acrescentar veículo'));
    await pessoa.type(screen.getByLabelText('Nome do veículo'), 'Expert XP');
    await pessoa.click(screen.getByText(/Cadastrar "Expert XP" como veículo/));

    await waitFor(() => expect(screen.getByText(/Já existe uma instituição/)).toBeTruthy());
  });

  it('DIZ QUE HÁ ALTERAÇÃO SEM SALVAR, e o botão só liga quando há', async () => {
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    expect(screen.getByText(/Salvar a lista/).closest('button')?.disabled).toBe(true);

    await pessoa.click(screen.getAllByText('Remover')[0]);

    expect(screen.getByText('1 alteração sem salvar')).toBeTruthy();
    expect(screen.getByText(/Salvar a lista/).closest('button')?.disabled).toBe(false);
  });

  it('DESCARTAR volta ao que o catálogo diz', async () => {
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.click(screen.getAllByText('Remover')[0]);
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

    await pessoa.click(screen.getAllByText('Remover')[0]);
    await pessoa.click(screen.getByText(/Salvar a lista/));

    await waitFor(() => expect(screen.getByText('3 entraram, 1 saíram.')).toBeTruthy());
  });

  it('a recusa do servidor aparece, e a edição NÃO é descartada', async () => {
    vi.mocked(definirVeiculosDeInvestidores).mockRejectedValue(
      new Error('A subcategoria "Econômica e de negócios" da Imprensa não está cadastrada.'),
    );
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.click(screen.getAllByText('Remover')[0]);
    await pessoa.click(screen.getByText(/Salvar a lista/));

    await waitFor(() => expect(screen.getByText(/não está cadastrada/)).toBeTruthy());
    // A EDIÇÃO CONTINUA EM TELA: perdê-la obrigaria a pessoa a refazer a
    // conferência de 81 nomes por causa de um erro do servidor.
    expect(screen.getByText('1 alteração sem salvar')).toBeTruthy();
  });

  it('a busca filtra DENTRO da lista', async () => {
    const pessoa = userEvent.setup();
    render(<VeiculosDeInvestidores />);

    await pessoa.type(screen.getByLabelText('Buscar nesta lista'), 'valor');

    expect(naTela()).toEqual(['Valor Econômico']);
    expect(screen.getByText('1 de 2')).toBeTruthy();
  });

  it('SEM A SUBCATEGORIA CADASTRADA, a tela diz o que falta em vez de mostrar lista vazia', () => {
    catalogoAtual = catalogoCom(CADASTRO, {
      ...DICIONARIOS,
      subcategorias_publico: DICIONARIOS.subcategorias_publico.filter(
        (s) => s.id !== MERCADO,
      ),
    });

    render(<VeiculosDeInvestidores />);

    expect(screen.getByText(/não está cadastrada/)).toBeTruthy();
    expect(screen.queryByText(/Salvar a lista/)).toBeNull();
  });
});
