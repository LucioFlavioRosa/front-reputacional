// @vitest-environment jsdom

/** O "Tracking dos cargos dos autores" da Sociedade digital.
 *
 *  A CONTA TEM TESTE PRÓPRIO (`dominio/cargosDosAutores.test.ts`). Aqui se prova
 *  a TELA: o topo de 5 e o seletor de acompanhar, a nota das menções sem cargo,
 *  o popup que abre num cargo com a busca, os posts de um @ com o recorte certo,
 *  e o popup fechado para quem não vê o diretório.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CargosDosAutores, GrupoDeCargo } from '@/api/cliente';
import { TrackingDosCargos } from '@/paginas/score/TrackingDosCargos';

const obterCargosDosAutores = vi.fn();
const listarMencoesDaBase = vi.fn();

vi.mock('@/api/cliente', () => ({
  obterCargosDosAutores: (...argumentos: unknown[]) => obterCargosDosAutores(...argumentos),
  listarMencoesDaBase: (...argumentos: unknown[]) => listarMencoesDaBase(...argumentos),
}));

function grupo(parcial: Partial<GrupoDeCargo>): GrupoDeCargo {
  return {
    cargo: 'Vereador',
    autor: '@iriel',
    positivo: 0,
    neutro: 0,
    negativo: 0,
    peso_positivo: 0,
    peso_neutro: 0,
    peso_negativo: 0,
    ...parcial,
  };
}

//: SETE CARGOS COM VOLUME DECRESCENTE — "Cargo 6" e "Cargo 7" ficam fora do
//: topo —, dois autores no Cargo 1 e 40 menções sem cargo.
function dados(veAutores = true): CargosDosAutores {
  return {
    lente: 'sociedade',
    mes: '2026-09',
    denominador: 100,
    ve_autores: veAutores,
    grupos: [
      grupo({ cargo: 'Cargo 1', autor: veAutores ? '@iriel' : null, negativo: 8, peso_negativo: 16 }),
      grupo({ cargo: 'Cargo 1', autor: veAutores ? '@ana' : null, positivo: 2, peso_positivo: 2 }),
      ...[2, 3, 4, 5, 6, 7].map((n) =>
        grupo({ cargo: `Cargo ${n}`, autor: '@x', positivo: 10 - n, peso_positivo: 10 - n }),
      ),
      grupo({ cargo: null, autor: '@cidadao', neutro: 40, peso_neutro: 40 }),
    ],
  };
}

function montar(filtro = {}) {
  return render(<TrackingDosCargos codigo="sociedade" mes="2026-09" filtro={filtro} />);
}

function colunaDe(titulo: string): HTMLElement {
  return screen.getByRole('group', { name: titulo });
}

describe('o Tracking dos cargos dos autores', () => {
  beforeEach(() => {
    obterCargosDosAutores.mockReset();
    listarMencoesDaBase.mockReset();
  });

  it('abre no top 5 por volume e conta as menções sem cargo no rodapé', async () => {
    obterCargosDosAutores.mockResolvedValue(dados());
    montar();

    const volume = await waitFor(() => colunaDe('Volume por cargo × sentimento'));
    expect(within(volume).getByText('Cargo 1')).toBeTruthy();
    expect(within(volume).getByText('Cargo 5')).toBeTruthy();
    expect(within(volume).queryByText('Cargo 6')).toBeNull();
    expect(within(colunaDe('Termômetro por cargo')).queryByText('Cargo 6')).toBeNull();
    //: 10 + 7×… : o total do recorte inclui as 40 sem cargo.
    expect(screen.getByText(/40 de \d+ menções do recorte vieram sem cargo/)).toBeTruthy();
  });

  it('acompanhar outro cargo o acrescenta sem tirar ninguém do topo, e o chip o tira', async () => {
    obterCargosDosAutores.mockResolvedValue(dados());
    montar();

    const seletor = await screen.findByLabelText('Acompanhar outro cargo');
    await userEvent.selectOptions(seletor, 'Cargo 7');

    const volume = colunaDe('Volume por cargo × sentimento');
    expect(within(volume).getByText('Cargo 7')).toBeTruthy();
    expect(within(volume).getByText('Cargo 1')).toBeTruthy();
    expect(within(colunaDe('Termômetro por cargo')).getByText('Cargo 7')).toBeTruthy();

    await userEvent.click(screen.getByTitle('Deixar de acompanhar Cargo 7'));
    expect(within(colunaDe('Volume por cargo × sentimento')).queryByText('Cargo 7')).toBeNull();
  });

  it('clicar num cargo abre os autores do maior para o menor impacto, com busca', async () => {
    obterCargosDosAutores.mockResolvedValue(dados());
    montar();

    await waitFor(() => colunaDe('Termômetro por cargo'));
    await userEvent.click(within(colunaDe('Termômetro por cargo')).getByText('Cargo 1'));

    const popup = await screen.findByRole('dialog');
    const nomes = within(popup)
      .getAllByRole('button', { expanded: false })
      .map((botao) => botao.textContent ?? '');
    //: @iriel tira 8 pontos; @ana põe 1.
    expect(nomes[0]).toContain('@iriel');
    expect(nomes[1]).toContain('@ana');

    await userEvent.type(within(popup).getByLabelText('Buscar autor'), 'ANA');
    expect(within(popup).queryByText('@iriel')).toBeNull();
    expect(within(popup).getByText('@ana')).toBeTruthy();
  });

  it('abrir um @ busca os posts dele no mês, no cargo e no recorte da tela', async () => {
    obterCargosDosAutores.mockResolvedValue(dados());
    listarMencoesDaBase.mockResolvedValue({
      itens: [
        {
          id: '1',
          data: '2026-09-12',
          sentimento: 'neg',
          titulo: 'Falta água de novo no bairro',
          link: 'https://x.com/iriel/status/1',
        },
        { id: '2', data: '2026-09-13', sentimento: 'neg', titulo: 'Post malicioso', link: 'javascript:alert(1)' },
      ],
      total: 2,
      pagina: 1,
      tamanho: 20,
    });
    montar({ uf: 'Santa Catarina' });

    await waitFor(() => colunaDe('Termômetro por cargo'));
    await userEvent.click(within(colunaDe('Termômetro por cargo')).getByText('Cargo 1'));
    const popup = await screen.findByRole('dialog');
    await userEvent.click(within(popup).getByText('@iriel'));

    await within(popup).findByText('Falta água de novo no bairro');
    expect(listarMencoesDaBase).toHaveBeenCalledWith('sociedade', {
      de: '2026-09-01',
      ate: '2026-09-30',
      filtros: { uf: 'Santa Catarina', perfil_autor: 'Cargo 1', autor: '@iriel' },
      tamanho: 20,
      ordenacao: '-engajamento',
    });
    //: SÓ HTTP(S) VIRA LINK: o texto da fonte não executa nada no clique.
    const links = within(popup).getAllByRole('link', { name: 'Ver post ↗' });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('https://x.com/iriel/status/1');
  });

  it('quem não vê o diretório vê os cargos, mas não a lista de @', async () => {
    obterCargosDosAutores.mockResolvedValue(dados(false));
    montar();

    await waitFor(() => colunaDe('Termômetro por cargo'));
    await userEvent.click(within(colunaDe('Termômetro por cargo')).getByText('Cargo 1'));

    const popup = await screen.findByRole('dialog');
    expect(within(popup).getByText(/restrita a quem tem acesso ao diretório/)).toBeTruthy();
    expect(within(popup).queryByLabelText('Buscar autor')).toBeNull();
  });

  it('mostra o erro do servidor em vez de um cartão vazio', async () => {
    obterCargosDosAutores.mockRejectedValue(new Error('Falhou a leitura.'));
    montar();

    expect(await screen.findByText('Falhou a leitura.')).toBeTruthy();
  });
});
