// @vitest-environment jsdom

/** A Base dos KPIs: subir a planilha do fornecedor, conferindo antes.
 *
 *  O QUE ESTES TESTES PROTEGEM é a promessa da tela: a conferência mostra o que
 *  vai acontecer ANTES de acontecer, e o que a pessoa desmarcou não é criado.
 *  Com 2.631 veículos numa primeira carga, o botão que diz "Confirmar" sem
 *  dizer quantos cadastros nascem é a diferença entre decidir e descobrir.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BaseDoScore } from '@/paginas/score/BaseDoScore';
import type { ConferenciaDaPlanilhaDoScore, VeiculoNovo } from '@/api/cliente';
import type { FonteDoScore, ImportacaoDoScore } from '@/dominio/score';

vi.mock('@/api/cliente', () => ({
  listarFontesDoScore: vi.fn(),
  conferirPlanilhaDoScore: vi.fn(),
  importarPlanilhaDoScore: vi.fn(),
}));

const { listarFontesDoScore, conferirPlanilhaDoScore, importarPlanilhaDoScore } =
  await import('@/api/cliente');

const FONTES = [
  { codigo: 'clipei', nome: 'Clipei', interna: false },
  { codigo: 'bites', nome: 'Bites', interna: false },
  // A INTERNA NÃO PODE APARECER: o dado dela já está neste banco, e o servidor
  // recusa o upload. Oferecer no seletor seria oferecer um caminho sem saída.
  { codigo: 'crm', nome: 'CRM', interna: true },
] as unknown as FonteDoScore[];

function resumo(parcial: Partial<ImportacaoDoScore> = {}): ImportacaoDoScore {
  return {
    fonte: 'clipei',
    nome: 'Clipei',
    linhas: 100,
    ingeridas: 95,
    antes: 0,
    descartes: {},
    avisos: {},
    meses: ['2026-08'],
    ...parcial,
  };
}

function veiculo(nome: string, mencoes = 1): VeiculoNovo {
  return { nome, uf: 'Santa Catarina', esfera: 'Municipal', mencoes };
}

function conferencia(
  parcial: Partial<ConferenciaDaPlanilhaDoScore> = {},
): ConferenciaDaPlanilhaDoScore {
  return {
    previsao: [resumo()],
    veiculos_novos: [],
    veiculos_reconhecidos: 0,
    ...parcial,
  };
}

const PLANILHA = new File([new Uint8Array([1, 2, 3])], 'clipei.xlsx', {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
});

/** Abre a tela e sobe a planilha — o estado de onde quase todo teste parte. */
async function subir(resposta: ConferenciaDaPlanilhaDoScore) {
  vi.mocked(listarFontesDoScore).mockResolvedValue(FONTES);
  vi.mocked(conferirPlanilhaDoScore).mockResolvedValue(resposta);
  const pessoa = userEvent.setup();
  render(<BaseDoScore />);
  await waitFor(() => expect(screen.getByLabelText('Planilha do fornecedor')).toBeTruthy());
  await pessoa.upload(screen.getByLabelText('Planilha do fornecedor'), PLANILHA);
  await waitFor(() => expect(conferirPlanilhaDoScore).toHaveBeenCalled());
  return pessoa;
}

describe('BaseDoScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('o seletor NÃO oferece a fonte interna', async () => {
    vi.mocked(listarFontesDoScore).mockResolvedValue(FONTES);
    render(<BaseDoScore />);
    await waitFor(() => expect(screen.getByLabelText(/De qual fonte/)).toBeTruthy());

    const seletor = screen.getByLabelText(/De qual fonte/) as HTMLSelectElement;
    const codigos = [...seletor.options].map((o) => o.value);
    expect(codigos).toEqual(['clipei', 'bites']);
  });

  it('CONFERIR NÃO IMPORTA: escolher o arquivo só mostra o que mudaria', async () => {
    await subir(conferencia());
    expect(importarPlanilhaDoScore).not.toHaveBeenCalled();
  });

  it('mostra o que vai entrar, por fonte irmã', async () => {
    await subir(
      conferencia({
        previsao: [
          resumo({ fonte: 'clipei', nome: 'Clipei', ingeridas: 25457, linhas: 25597 }),
          resumo({
            fonte: 'clipei_investidores',
            nome: 'Clipei · público investidores',
            ingeridas: 80,
            linhas: 25597,
          }),
        ],
      }),
    );

    // PELOS ITENS DA LISTA: "Clipei" também é o rótulo da opção no seletor e
    // aparece em "Lê o export da Clipei" — uma busca global acharia três. Sem
    // veículo novo neste caso, os únicos `listitem` são os dois resumos.
    const linhas = screen.getAllByRole('listitem').map((l) => l.textContent ?? '');
    expect(linhas).toHaveLength(2);
    expect(linhas.some((l) => l.includes('25.457 de 25.597 linhas'))).toBe(true);
    expect(linhas.some((l) => l.includes('Clipei · público investidores'))).toBe(true);
  });

  it('AVISA QUANDO O MÊS VAI ENCOLHER', async () => {
    // A subida SUBSTITUI o mês, e um export baixado antes do fechamento troca
    // 300 menções por 80 sem avisar. É o aviso que transforma isso em decisão.
    await subir(conferencia({ previsao: [resumo({ ingeridas: 80, antes: 300 })] }));

    expect(screen.getByText(/este mês tinha 300 — vai encolher/)).toBeTruthy();
  });

  it('TODOS OS VEÍCULOS NASCEM MARCADOS', async () => {
    // Pedido do dono: o caso normal é querer todos, e desmarcar é a exceção.
    // A exceção não pode custar 2.600 cliques.
    await subir(
      conferencia({
        veiculos_novos: [veiculo('Rádio A', 100), veiculo('Rádio B', 50)],
      }),
    );

    const caixas = screen.getAllByRole('checkbox');
    expect(caixas).toHaveLength(2);
    expect(caixas.every((c) => (c as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByText(/2 de 2 marcados/)).toBeTruthy();
  });

  it('O BOTÃO DIZ QUANTOS CADASTROS VÃO NASCER', async () => {
    // "Confirmar" sozinho esconderia a criação de 2.631 cadastros atrás de uma
    // palavra. Este rótulo é onde o custo da criação automática se paga.
    await subir(conferencia({ veiculos_novos: [veiculo('Rádio A'), veiculo('Rádio B')] }));

    expect(screen.getByRole('button', { name: 'Subir e cadastrar 2 veículos' })).toBeTruthy();
  });

  it('desmarcar muda a conta E o rótulo do botão', async () => {
    const pessoa = await subir(
      conferencia({ veiculos_novos: [veiculo('Rádio A'), veiculo('Rádio B')] }),
    );

    await pessoa.click(screen.getByLabelText('Cadastrar Rádio A'));

    expect(screen.getByText(/1 de 2 marcados/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Subir e cadastrar 1 veículos' })).toBeTruthy();
  });

  it('O QUE FOI DESMARCADO NÃO VAI PARA O SERVIDOR', async () => {
    vi.mocked(importarPlanilhaDoScore).mockResolvedValue([resumo()]);
    const pessoa = await subir(
      conferencia({ veiculos_novos: [veiculo('Rádio A'), veiculo('Rádio B')] }),
    );

    await pessoa.click(screen.getByLabelText('Cadastrar Rádio A'));
    await pessoa.click(screen.getByRole('button', { name: /^Subir e cadastrar/ }));

    await waitFor(() =>
      expect(importarPlanilhaDoScore).toHaveBeenCalledWith('clipei', PLANILHA, ['Rádio B']),
    );
  });

  it('desmarcar TODOS sobe sem cadastrar nenhum', async () => {
    vi.mocked(importarPlanilhaDoScore).mockResolvedValue([resumo()]);
    const pessoa = await subir(
      conferencia({ veiculos_novos: [veiculo('Rádio A'), veiculo('Rádio B')] }),
    );

    await pessoa.click(screen.getByRole('button', { name: 'Desmarcar todos' }));
    expect(
      screen.getByRole('button', { name: 'Subir sem cadastrar veículo' }),
    ).toBeTruthy();

    await pessoa.click(screen.getByRole('button', { name: 'Subir sem cadastrar veículo' }));
    await waitFor(() =>
      expect(importarPlanilhaDoScore).toHaveBeenCalledWith('clipei', PLANILHA, []),
    );
  });

  it('PAGINA a lista, em vez de montar 2.631 caixas de uma vez', async () => {
    // 2.631 caixas de seleção travam o navegador — a grade de agendas já passou
    // por isso. Este teste cai se alguém tirar a paginação "para simplificar".
    const muitos = Array.from({ length: 120 }, (_, i) => veiculo(`Veículo ${i + 1}`, 120 - i));
    await subir(conferencia({ veiculos_novos: muitos }));

    expect(screen.getAllByRole('checkbox')).toHaveLength(50);
    // A conta fala dos 120, e não dos 50 visíveis.
    expect(screen.getByText(/120 de 120 marcados/)).toBeTruthy();
  });

  it('a busca acha um veículo sem percorrer as páginas', async () => {
    const muitos = Array.from({ length: 120 }, (_, i) => veiculo(`Veículo ${i + 1}`));
    const pessoa = await subir(conferencia({ veiculos_novos: muitos }));

    await pessoa.type(screen.getByLabelText('Buscar um veículo na lista'), 'Veículo 117');

    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.getByLabelText('Cadastrar Veículo 117')).toBeTruthy();
  });

  it('DESMARCAR NUMA PÁGINA VALE PARA A LISTA TODA', async () => {
    // O estado é por NOME, não por posição: sem isso, virar a página perderia o
    // que a pessoa desmarcou — e ela não teria como saber.
    vi.mocked(importarPlanilhaDoScore).mockResolvedValue([resumo()]);
    const muitos = Array.from({ length: 60 }, (_, i) => veiculo(`Veículo ${i + 1}`, 60 - i));
    const pessoa = await subir(conferencia({ veiculos_novos: muitos }));

    await pessoa.click(screen.getByLabelText('Cadastrar Veículo 1'));
    expect(screen.getByText(/59 de 60 marcados/)).toBeTruthy();

    await pessoa.click(screen.getByRole('button', { name: /^Subir e cadastrar/ }));
    await waitFor(() => expect(importarPlanilhaDoScore).toHaveBeenCalled());
    const [, , nomes] = vi.mocked(importarPlanilhaDoScore).mock.calls[0];
    expect(nomes).toHaveLength(59);
    expect(nomes).not.toContain('Veículo 1');
  });

  it('sem veículo novo, diz que o cadastro já cobre tudo', async () => {
    await subir(conferencia({ veiculos_novos: [], veiculos_reconhecidos: 39 }));

    expect(screen.getByText(/o cadastro já reconhece os 39 veículos/)).toBeTruthy();
  });

  it('o resultado mostra os veículos criados UMA vez, não a soma', async () => {
    // `veiculos_criados` vem repetido em cada fonte irmã com o mesmo valor:
    // somar diria 5.256 onde nasceram 2.628.
    vi.mocked(importarPlanilhaDoScore).mockResolvedValue([
      resumo({ fonte: 'clipei', nome: 'Clipei', ingeridas: 95, veiculos_criados: 2628 }),
      resumo({
        fonte: 'clipei_investidores',
        nome: 'Mercado',
        ingeridas: 80,
        veiculos_criados: 2628,
      }),
    ]);
    const pessoa = await subir(conferencia({ veiculos_novos: [veiculo('Rádio A')] }));

    await pessoa.click(screen.getByRole('button', { name: /^Subir e cadastrar/ }));

    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    const aviso = screen.getByRole('status').textContent ?? '';
    expect(aviso).toContain('2.628 veículos cadastrados');
    expect(aviso).not.toContain('5.256');
  });

  it('a falha ao ler a planilha aparece como erro, não como lista vazia', async () => {
    vi.mocked(listarFontesDoScore).mockResolvedValue(FONTES);
    vi.mocked(conferirPlanilhaDoScore).mockRejectedValue(
      new Error('A planilha não tem as colunas que o cadastro desta fonte espera: ID.'),
    );
    const pessoa = userEvent.setup();
    render(<BaseDoScore />);
    await waitFor(() => expect(screen.getByLabelText('Planilha do fornecedor')).toBeTruthy());

    await pessoa.upload(screen.getByLabelText('Planilha do fornecedor'), PLANILHA);

    await waitFor(() =>
      expect(screen.getByText(/não tem as colunas que o cadastro desta fonte espera/)).toBeTruthy(),
    );
  });

  it('a recusa ao aplicar APAGA a lista, para não convidar a repetir', async () => {
    vi.mocked(importarPlanilhaDoScore).mockRejectedValue(
      new Error('Nenhuma linha da planilha virou menção em Clipei.'),
    );
    const pessoa = await subir(conferencia({ veiculos_novos: [veiculo('Rádio A')] }));

    await pessoa.click(screen.getByRole('button', { name: /^Subir e cadastrar/ }));

    await waitFor(() =>
      expect(screen.getByText(/Nenhuma linha da planilha virou menção/)).toBeTruthy(),
    );
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Subir e cadastrar/ })).toBeNull();
  });

  it('trocar de fonte limpa a conferência da anterior', async () => {
    // Senão a tela mostraria a previsão da Clipei com a Bites selecionada, e o
    // botão aplicaria o arquivo de uma na outra.
    const pessoa = await subir(conferencia({ veiculos_novos: [veiculo('Rádio A')] }));
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);

    await pessoa.selectOptions(screen.getByLabelText(/De qual fonte/), 'bites');

    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
