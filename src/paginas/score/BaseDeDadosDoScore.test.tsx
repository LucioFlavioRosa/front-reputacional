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

  it('não tem faixa de filtros rápidos (por enquanto): só busca e período', async () => {
    const { BaseDeDadosDoScore } = await import('@/paginas/score/BaseDeDadosDoScore');
    render(<BaseDeDadosDoScore />);
    await waitFor(() => expect(screen.getByText('Falta d’água em São Gonçalo')).toBeTruthy());
    expect(screen.queryByText('Filtros:')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Buscar nas menções' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '90 dias' })).toBeTruthy();
  });

  it('abre com o layout ajustado: TODA coluna tem largura, e o texto longo não invade a vizinha', async () => {
    const { BaseDeDadosDoScore } = await import('@/paginas/score/BaseDeDadosDoScore');
    const { container } = render(<BaseDeDadosDoScore />);
    await waitFor(() => expect(screen.getByText('Falta d’água em São Gonçalo')).toBeTruthy());
    const colunas = [...container.querySelectorAll('col')] as HTMLElement[];
    expect(colunas.length).toBeGreaterThan(5);
    expect(colunas.every((col) => Number.parseInt(col.style.width, 10) >= 60)).toBe(true);
    // O VEÍCULO PASSOU DE UMA LINHA PARA DUAS, e isto reverte uma decisão que
    // estava escrita aqui ("o veículo é de uma linha só, cortado com reticências
    // dentro da própria coluna"). O que mudou foi a MEDIDA, na base de 28.617
    // menções: a coluna tem 140px e cabiam ~20 caracteres; 918 dos 3.729
    // veículos passam disso, e QUARENTA E DOIS veículos diferentes começam com
    // "Prefeitura Municipal" — nos vinte primeiros caracteres os 42 apareciam
    // idênticos, e a pessoa via 42 linhas que pareciam o mesmo veículo. As
    // reticências estavam no pior lugar possível, porque o que distingue esses
    // nomes é o FIM.
    //
    // DUAS LINHAS mostram ~40 caracteres, que é onde eles se separam. O `title`
    // continua com o valor inteiro, e a coluna continua arrastável para quem
    // quiser mais.
    //
    // PARA VOLTAR: tire `Veículo`, `Rede` e `Canal` de `LINHAS_DA_COLUNA`, em
    // `dominio/baseDasLentes.ts`. É uma linha.
    const celulaDoVeiculo = screen.getByText('Folha de S.Paulo').closest('td')!;
    expect(celulaDoVeiculo.getAttribute('title')).toBe('Folha de S.Paulo');
    // E O TEXTO NÃO INVADE A VIZINHA, que é o que a asserção antiga protegia: o
    // `overflow: hidden` agora vem da classe, junto do limite de duas linhas.
    expect(celulaDoVeiculo.style.whiteSpace).toBe('normal');

    // O LIMITE VIVE NUM EMBRULHO DENTRO DA CÉLULA, nunca na célula.
    //
    // `-webkit-line-clamp` só age com `display: -webkit-box`, e esse `display`
    // num `<td>` substitui o `table-cell`: a célula sai do modelo nativo da
    // tabela e passa a brigar com o `<colgroup>` e o `table-layout: fixed`.
    // Achado de revisão, e esta asserção é o que impede a volta — se a classe
    // reaparecer no `td`, as duas linhas abaixo caem.
    expect(celulaDoVeiculo.className).toBe('');
    const embrulho = screen.getByText('Folha de S.Paulo');
    expect(embrulho.tagName).toBe('SPAN');
    expect(embrulho.className).toBe('duas-linhas');
    // A dica de como ajustar está à vista.
    expect(screen.getByText(/Arraste a borda de um cabeçalho/)).toBeTruthy();
  });

  it('a busca vai ao servidor depois que a pessoa para de digitar', async () => {
    const { BaseDeDadosDoScore } = await import('@/paginas/score/BaseDeDadosDoScore');
    render(<BaseDeDadosDoScore />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar nas menções' }), 'agua');
    await waitFor(() =>
      expect(listar).toHaveBeenLastCalledWith('imprensa', expect.objectContaining({ q: 'agua', pagina: 1 })),
    );
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
