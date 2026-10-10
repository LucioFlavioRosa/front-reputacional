// @vitest-environment jsdom

/** O cargo e a pessoa do perfil de rede, na tela de cadastro.
 *
 *  O QUE O DONO DO PRODUTO VIU. A deputada Stela Farias aparecia como "Poder
 *  Legislativo" — o público está certo, mas o CARGO não aparecia em lugar
 *  nenhum, e é ele que diz quem é o ator.
 *
 *  E O QUE ESTE ARQUIVO IMPEDE DE VOLTAR: a edição manda a ficha INTEIRA, e o
 *  backend substitui o que recebe. `cargo` e `interlocutor_id` fora do payload
 *  viravam nulo — corrigir o nome de um perfil APAGAVA o cargo e a pessoa, sem
 *  erro e sem ninguém notar. É a mesma classe de defeito que fez `ativo` ser
 *  escrito uma vez só, num lugar só.
 *
 *  A PESSOA É O QUE JUNTA OS PERFIS. São três da mesma deputada — `Stela
 *  Farias` com 121 menções, `Stela Farias RS` com 3 e `stelafariasrs` com 27 —
 *  e nenhuma normalização funde isso: são nomes diferentes de verdade. Só quem
 *  conhece o ator sabe que são a mesma pessoa, e é esse gesto que a tela
 *  oferece.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CadastroDeInstituicoes } from '@/paginas/CadastroDeInstituicoes';
import type { Instituicao, Interlocutor } from '@/dominio/tipos';

vi.mock('@/api/cliente', () => ({
  //: A tela mostra a fila de possiveis duplicados, que pede esta
  //: lista ao montar. Sem o duble, o componente chama undefined.
  duplicadosDeCadastro: vi.fn(async () => []),
  fundirCadastro: vi.fn(),
  declararCadastroDistinto: vi.fn(),
  criarInstituicao: vi.fn(),
  editarInstituicao: vi.fn(async () => ({})),
  criarInterlocutor: vi.fn(),
  editarInterlocutor: vi.fn(),
  obterDicionarios: vi.fn(async () => DICIONARIOS),
}));

const { editarInstituicao } = await import('@/api/cliente');

const DICIONARIOS = {
  esferas: [],
  relevancias: [],
  categorias_publico: [{ id: 3, codigo: 'legislativo', nome: 'Poder Legislativo', ordem: 1 }],
  subcategorias_publico: [
    { id: 9, codigo: 'municipal', nome: 'Municipal', ordem: 1, categoria_publico_id: 3 },
  ],
  ufs: [{ codigo: 'RS', nome: 'Rio Grande do Sul' }],
};

function perfil(nome: string, extra: Partial<Instituicao> = {}): Instituicao {
  return {
    id: `id-${nome}`,
    nome,
    tipo: 'perfil_rede',
    nome_completo: null,
    uf: 'RS',
    esfera_id: null,
    tier: null,
    categoria_publico_id: 3,
    subcategoria_publico_id: 9,
    cargo: 'Deputado estadual',
    interlocutor_id: null,
    ativo: true,
    ...extra,
  };
}

const STELA: Interlocutor = {
  id: 'pessoa-stela',
  nome: 'Stela Farias',
  instituicao_id: 'assembleia',
  cargo: 'Deputada estadual (RS)',
  area: null,
  email: null,
  redes_sociais: [],
  tipo: null,
  ativo: true,
} as unknown as Interlocutor;

let catalogoAtual: ReturnType<typeof catalogoCom>;

function catalogoCom(instituicoes: Instituicao[], pessoas: Interlocutor[] = [STELA]) {
  return {
    instituicoes: new Map(instituicoes.map((i) => [i.id, i])),
    interlocutores: new Map(pessoas.map((p) => [p.id, p])),
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

describe('o perfil de rede no Cadastro compartilhado', () => {
  beforeEach(() => {
    //: SEM ISTO A CONTAGEM ACUMULA entre os testes, e um `toHaveBeenCalledTimes(1)`
    //: falha no segundo teste por uma chamada que foi do primeiro.
    vi.clearAllMocks();
  });

  it('A LINHA MOSTRA O CARGO, e não só o público', () => {
    catalogoAtual = catalogoCom([perfil('Stela Farias')]);
    render(<CadastroDeInstituicoes />);

    expect(screen.getByText(/Deputado estadual/)).toBeTruthy();
  });

  it('EDITAR NÃO APAGA o cargo nem a pessoa', async () => {
    // O defeito que isto impede: a edição manda a ficha inteira, e o backend
    // substitui o que recebe. Sem `cargo` e `interlocutor_id` no payload,
    // corrigir o nome perdia os dois — sem erro e sem ninguém notar.
    catalogoAtual = catalogoCom([
      perfil('Stela Farias', { interlocutor_id: 'pessoa-stela' }),
    ]);
    const pessoa = userEvent.setup();
    render(<CadastroDeInstituicoes />);

    await pessoa.click(screen.getByText('Editar'));
    await pessoa.click(screen.getByText('Salvar'));

    await waitFor(() => expect(editarInstituicao).toHaveBeenCalledTimes(1));
    expect(vi.mocked(editarInstituicao).mock.calls[0][1]).toMatchObject({
      cargo: 'Deputado estadual',
      interlocutor_id: 'pessoa-stela',
    });
  });

  it('dá para dizer DE QUEM É o perfil, escolhendo entre as pessoas do CRM', async () => {
    catalogoAtual = catalogoCom([perfil('stelafariasrs', { cargo: null })]);
    const pessoa = userEvent.setup();
    render(<CadastroDeInstituicoes />);

    await pessoa.click(screen.getByText('Editar'));
    //: A LISTA INTEIRA DO CRM, e não as pessoas desta instituição: a deputada é
    //: interlocutora da Assembleia, e dizer "este perfil é dela" não a move de
    //: instituição.
    await pessoa.selectOptions(screen.getByLabelText(/Pessoa/), 'pessoa-stela');
    await pessoa.click(screen.getByText('Salvar'));

    await waitFor(() => expect(editarInstituicao).toHaveBeenCalledTimes(1));
    expect(vi.mocked(editarInstituicao).mock.calls[0][1]).toMatchObject({
      interlocutor_id: 'pessoa-stela',
    });
  });

  it('o cargo é CORRIGÍVEL, porque o fornecedor erra', async () => {
    //: Medido no arquivo real: `stelafariasrs` veio sem cargo e com UF TO,
    //: sendo a mesma deputada do RS.
    catalogoAtual = catalogoCom([perfil('stelafariasrs', { cargo: null })]);
    const pessoa = userEvent.setup();
    render(<CadastroDeInstituicoes />);

    await pessoa.click(screen.getByText('Editar'));
    await pessoa.type(screen.getByLabelText(/Cargo/), 'Deputado estadual');
    await pessoa.click(screen.getByText('Salvar'));

    await waitFor(() => expect(editarInstituicao).toHaveBeenCalledTimes(1));
    expect(vi.mocked(editarInstituicao).mock.calls[0][1]).toMatchObject({
      cargo: 'Deputado estadual',
    });
  });

  it('O VEÍCULO NÃO GANHA os campos de perfil', async () => {
    //: Um jornal não tem cargo nem "é de" alguém, e o backend recusa os dois
    //: nos outros tipos — oferecer na tela seria oferecer o que será negado.
    catalogoAtual = catalogoCom([
      perfil('Folha', { tipo: 'veiculo', cargo: null, interlocutor_id: null }),
    ]);
    const pessoa = userEvent.setup();
    render(<CadastroDeInstituicoes />);

    await pessoa.click(screen.getByText('Editar'));

    expect(screen.queryByLabelText(/Cargo/)).toBeNull();
    expect(screen.queryByLabelText(/Pessoa/)).toBeNull();
  });
});
