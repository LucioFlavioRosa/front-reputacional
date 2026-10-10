// @vitest-environment jsdom

/** A lista diz QUANTAS instituições existem, e dá para ver só um tipo.
 *
 *  O QUE ACONTECEU. A importação da Clipei cadastrou 2.631 veículos de uma vez.
 *  A pessoa que autorizou a criação abriu o Cadastro compartilhado para ver o
 *  que criou, encontrou dez nomes e concluiu que os outros não tinham entrado.
 *
 *  Estavam todos lá: a API devolvia 2.730, o banco tinha 2.670 veículos. A
 *  tela mostrava 10 por página e o título dizia só "Cadastrados" — sem número,
 *  sem corte por tipo, e com os veículos espalhados entre órgãos e entidades
 *  numa ordenação por nome de 273 páginas.
 *
 *  Não era defeito de dado nem de rota: a tela não dizia a verdade que tinha
 *  em mão. Estes testes são sobre ela dizer.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CadastroDeInstituicoes } from '@/paginas/CadastroDeInstituicoes';
import type { Instituicao } from '@/dominio/tipos';

vi.mock('@/api/cliente', () => ({
  //: A tela mostra a fila de possiveis duplicados, que pede esta
  //: lista ao montar. Sem o duble, o componente chama undefined.
  duplicadosDeCadastro: vi.fn(async () => []),
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

/** O catálogo como o estado do painel o entrega: um Map por id. */
function catalogoCom(instituicoes: Instituicao[]) {
  return {
    instituicoes: new Map(instituicoes.map((i) => [i.id, i])),
    interlocutores: new Map(),
    dicionarios: {
      esferas: [],
      relevancias: [],
      categorias_publico: [],
      subcategorias_publico: [],
      ufs: [],
    },
  };
}

vi.mock('@/estado/painel', () => ({
  // `usePainel`, e nao `usarPainel`: o nome do hook e esse, e errar o nome no
  // duble faz o componente receber `undefined` e estourar no proprio render.
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

let catalogoAtual: ReturnType<typeof catalogoCom>;

function instituicao(nome: string, tipo: string): Instituicao {
  return {
    id: `${tipo}-${nome}`,
    nome,
    tipo,
    ativo: true,
    uf: null,
    tier: null,
    esfera_id: null,
    categoria_publico_id: null,
    subcategoria_publico_id: null,
  } as unknown as Instituicao;
}

/** Um catálogo do tamanho do real depois da carga da Clipei. */
function catalogoDepoisDaClipei() {
  const veiculos = Array.from({ length: 2631 }, (_, i) =>
    instituicao(`Rádio ${String(i).padStart(4, '0')}`, 'veiculo'),
  );
  const outros = [
    instituicao('Agência Nacional de Águas', 'orgao'),
    instituicao('Associação Brasileira', 'entidade'),
  ];
  return catalogoCom([...veiculos, ...outros]);
}

describe('Cadastro de Instituições: a contagem e o corte por tipo', () => {
  it('O TÍTULO DIZ QUANTAS EXISTEM, não quantas a página mostra', () => {
    catalogoAtual = catalogoDepoisDaClipei();
    render(<CadastroDeInstituicoes />);

    // 2.633 no catálogo; a página mostra 10. Sem o número, quem acabou de
    // autorizar 2.631 criações conclui que elas não entraram.
    expect(screen.getByText(/^Cadastrados \(2\.633\)/)).toBeTruthy();
  });

  it('a lista segue mostrando 10 por página — o número é que faltava', () => {
    catalogoAtual = catalogoDepoisDaClipei();
    render(<CadastroDeInstituicoes />);

    // A paginação não é o defeito: montar 2.633 linhas de uma vez travaria a
    // tela. O defeito era não dizer que havia mais.
    expect(screen.getByText('Rádio 0000')).toBeTruthy();
    expect(screen.queryByText('Rádio 0010')).toBeNull();
  });

  it('O SELETOR DE TIPO DIZ O TAMANHO DE CADA CORTE', async () => {
    // "Veículo (2.631)" responde a pergunta da pessoa sem ela precisar
    // filtrar para descobrir.
    catalogoAtual = catalogoDepoisDaClipei();
    render(<CadastroDeInstituicoes />);

    const seletor = screen.getByLabelText('Tipo') as HTMLSelectElement;
    const rotulos = [...seletor.options].map((o) => o.textContent);
    expect(rotulos[0]).toBe('Todos os tipos');
    expect(rotulos.some((r) => r?.includes('2.631'))).toBe(true);
  });

  it('O PERFIL DE REDE tem rótulo e entra no filtro', async () => {
    // `perfil_rede` nasce da ingestão do social listening e NÃO é frente do
    // CRM — não existe agenda com um perfil de Instagram —, então ele não está
    // em `TIPO_DE_INSTITUICAO`. Sem rótulo, o filtro mostrava o código cru; e
    // sem a opção no `<select>` de Tipo, abrir um perfil para editar exibia
    // "Órgão" (a primeira opção) para um registro que é perfil de rede, com um
    // clique trocando o tipo de verdade.
    catalogoAtual = catalogoCom([
      instituicao('Folha', 'veiculo'),
      instituicao('deolhoemesteio', 'perfil_rede'),
    ]);
    const pessoa = userEvent.setup();
    render(<CadastroDeInstituicoes />);

    const seletor = screen.getByLabelText('Tipo') as HTMLSelectElement;
    const rotulos = [...seletor.options].map((o) => o.textContent);
    expect(rotulos).toContain('Perfil de rede (1)');

    await pessoa.selectOptions(seletor, 'perfil_rede');

    expect(screen.getByText('deolhoemesteio')).toBeTruthy();
    expect(screen.queryByText('Folha')).toBeNull();
  });

  it('filtrar por tipo mostra o recorte E o total', async () => {
    catalogoAtual = catalogoDepoisDaClipei();
    const pessoa = userEvent.setup();
    render(<CadastroDeInstituicoes />);

    await pessoa.selectOptions(screen.getByLabelText('Tipo'), 'orgao');

    expect(screen.getByText(/^Cadastrados \(1 de 2\.633\)/)).toBeTruthy();
    expect(screen.getByText('Agência Nacional de Águas')).toBeTruthy();
    expect(screen.queryByText('Rádio 0000')).toBeNull();
  });

  it('a busca e o tipo valem JUNTOS', async () => {
    catalogoAtual = catalogoDepoisDaClipei();
    const pessoa = userEvent.setup();
    render(<CadastroDeInstituicoes />);

    await pessoa.selectOptions(screen.getByLabelText('Tipo'), 'veiculo');
    await pessoa.type(screen.getByPlaceholderText('Parte do nome'), 'Rádio 0007');

    expect(screen.getByText(/^Cadastrados \(1 de 2\.633\)/)).toBeTruthy();
    expect(screen.getByText('Rádio 0007')).toBeTruthy();
  });

  it('sem nada no recorte, a mensagem diz que o TIPO não tem nada', async () => {
    catalogoAtual = catalogoDepoisDaClipei();
    const pessoa = userEvent.setup();
    render(<CadastroDeInstituicoes />);

    await pessoa.selectOptions(screen.getByLabelText('Tipo'), 'orgao');
    await pessoa.type(screen.getByPlaceholderText('Parte do nome'), 'Rádio');

    expect(screen.getByText(/Nenhuma instituição desse tipo com esse nome/)).toBeTruthy();
  });

  it('com o catálogo vazio o título não mente', () => {
    catalogoAtual = catalogoCom([]);
    render(<CadastroDeInstituicoes />);

    expect(screen.getByText(/^Cadastrados \(0\)/)).toBeTruthy();
  });

  it('trocar o tipo volta para a primeira página', async () => {
    // Sem isto, trocar o corte na página 200 deixaria a tela numa página que
    // não existe mais para o resultado novo — e ela pareceria vazia.
    catalogoAtual = catalogoDepoisDaClipei();
    const pessoa = userEvent.setup();
    render(<CadastroDeInstituicoes />);

    // O botao leva o chevron no texto ("Proxima >"), e `Paginacao` nao envolve
    // tudo num `<nav>` rotulado — por isso a busca e pelo nome do botao.
    await pessoa.click(screen.getByRole('button', { name: /Próxima/ }));
    expect(screen.getByText('Rádio 0010')).toBeTruthy();

    await pessoa.selectOptions(screen.getByLabelText('Tipo'), 'veiculo');

    expect(screen.getByText('Rádio 0000')).toBeTruthy();
  });
});
