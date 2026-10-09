// @vitest-environment jsdom

/** A Base de dados dos KPIs: as menções na fonte, para consulta. */

import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MencaoDaBase, OpcoesDaBase } from '@/api/cliente';
import { colunasDaBase, csvDaBase, periodoDoAtalho } from '@/dominio/baseDasLentes';

const mencao = (extra: Partial<MencaoDaBase>): MencaoDaBase => ({
  id: 'm1', data: '2026-08-20', mes: '2026-08', fonte: 'Clipei', fonte_no_calculo: true,
  veiculo: 'Folha de S.Paulo', tier: 'muito_relevante', sentimento: 'neg', atributo: null,
  tema: 'Abastecimento', tema_n1: null, tema_n2: null, tema_n3: null, subtema: null,
  empresa: 'Águas do Rio', uf: 'RJ', autor: 'Ana Lima', perfil_autor: null, engajamento: null,
  publico_alvo: null, titulo: 'Falta d’água em São Gonçalo', link: 'https://folha.com/x',
  ...extra,
});

const OPCOES: OpcoesDaBase = {
  fontes: ['Clipei'], sentimentos: ['neg', 'pos'], tiers: ['muito_relevante'], veiculos: ['Folha de S.Paulo'],
  atributos: [], temas: ['Abastecimento'], temas_n1: [], temas_n2: [], temas_n3: [], subtemas: [],
  empresas: ['Águas do Rio'], ufs: ['RJ'], autores: ['Ana Lima'], perfis: [],
};

const listar = vi.fn();
vi.mock('@/api/cliente', () => ({
  listarMencoesDaBase: (...args: unknown[]) => listar(...args),
  obterOpcoesDaBase: vi.fn(() => Promise.resolve(OPCOES)),
}));

describe('BaseDeDadosDoScore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    listar.mockReset();
    listar.mockResolvedValue({ itens: [mencao({})], total: 1, pagina: 1, tamanho: 50 });
  });

  it('lista as menções da lente com o link para a matéria', async () => {
    const { BaseDeDadosDoScore } = await import('@/paginas/score/BaseDeDadosDoScore');
    render(<BaseDeDadosDoScore />);
    await waitFor(() => expect(screen.getByText('Falta d’água em São Gonçalo')).toBeTruthy());
    const link = screen.getByRole('link', { name: 'Abrir matéria ↗' });
    expect(link.getAttribute('href')).toBe('https://folha.com/x');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(screen.getByText('1 menção')).toBeTruthy();
  });

  it('mostra só os filtros que têm valor, e escolher vira chip e filtra no servidor', async () => {
    const { BaseDeDadosDoScore } = await import('@/paginas/score/BaseDeDadosDoScore');
    render(<BaseDeDadosDoScore />);
    //: O CABEÇALHO DA COLUNA também é um botão (ordena): o da faixa vem antes.
    const gatilho = () => screen.getAllByRole('button', { name: /^Concessionária/ })[0];
    await waitFor(() => expect(gatilho()).toBeTruthy());
    expect(screen.queryAllByRole('button', { name: /Perfil de quem fala/ })).toHaveLength(0);
    await userEvent.click(gatilho());
    await userEvent.click(screen.getByText('Águas do Rio', { selector: 'button' }));
    await waitFor(() =>
      expect(listar).toHaveBeenLastCalledWith('imprensa', expect.objectContaining({ filtros: { empresa: 'Águas do Rio' } })),
    );
    expect(screen.getByText('Concessionária: Águas do Rio')).toBeTruthy();
  });

  it('Institucional explica que a consulta está na Base do CRM', async () => {
    const { BaseDeDadosDoScore } = await import('@/paginas/score/BaseDeDadosDoScore');
    render(<BaseDeDadosDoScore />);
    await userEvent.click(screen.getByRole('tab', { name: 'Institucional' }));
    expect(screen.getByText(/está na/)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('domínio da Base', () => {
  it('o CSV leva as colunas pedidas, com aspas e ";"', () => {
    const colunas = colunasDaBase('imprensa').filter((c) => ['Data', 'Veículo', 'Sentimento'].includes(c.rotulo));
    expect(csvDaBase([mencao({})], colunas)).toBe('"Data";"Veículo";"Sentimento"\r\n"20/08/2026";"Folha de S.Paulo";"Negativo"');
  });

  it('o nome da coluna de fonte muda por lente', () => {
    expect(colunasDaBase('sociedade').map((c) => c.rotulo)).toContain('Rede');
    expect(colunasDaBase('imprensa').map((c) => c.rotulo)).toContain('Jornalista');
  });

  it('o atalho de período vira datas; "tudo" não limita', () => {
    expect(periodoDoAtalho('tudo')).toEqual({});
    expect(periodoDoAtalho('30', new Date('2026-10-09T12:00:00Z'))).toEqual({ de: '2026-09-09', ate: '2026-10-09' });
  });
});
