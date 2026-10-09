// @vitest-environment jsdom

/** A busca inteligente do Radar: sugestões de lentes e de filtros de lente. */

import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OpcoesDeFiltroDaLente } from '@/api/cliente';
import { filtrarSugestoes, montarSugestoes } from '@/dominio/buscaDoRadar';

const vazio: OpcoesDeFiltroDaLente = {
  tiers: [], veiculos: [], atributos: [], temas: [], perfis: [], ufs: [], subtemas: [], autores: [], empresas: [],
};
const OPCOES: Record<string, OpcoesDeFiltroDaLente> = {
  imprensa: { ...vazio, veiculos: ['Folha de S.Paulo', 'Valor'], tiers: ['muito_relevante'], temas: ['Tarifa social'] },
  sociedade: { ...vazio, veiculos: ['Instagram'], temas: ['Tarifa social'] },
  clientes: { ...vazio, empresas: ['Águas do Rio'] },
};

vi.mock('@/api/cliente', () => ({
  obterOpcoesDeFiltroDaLente: vi.fn((lente: string) => Promise.resolve(OPCOES[lente])),
}));

const LENTES = [
  { codigo: 'imprensa', nome: 'Imprensa', stakeholder: 'Formadores de opinião' },
  { codigo: 'mercado', nome: 'Mercado', stakeholder: 'Investidores e rating' },
  { codigo: 'sociedade', nome: 'Sociedade digital', stakeholder: 'Redes em mar aberto' },
  { codigo: 'clientes', nome: 'Clientes', stakeholder: 'Canais próprios' },
];

describe('sugestões do Radar', () => {
  const todas = montarSugestoes(LENTES, OPCOES);

  it('acha sem acento e diz de que lente é', () => {
    const [aguas] = filtrarSugestoes(todas, 'aguas');
    expect(aguas).toMatchObject({ rotulo: 'Águas do Rio', grupo: 'Concessionária', lente: 'clientes' });
  });

  it('o mesmo tema em duas lentes vira duas sugestões', () => {
    const tarifa = filtrarSugestoes(todas, 'tarifa');
    expect(tarifa.map((s) => s.lente).sort()).toEqual(['imprensa', 'sociedade']);
  });

  it('a lente vem antes dos filtros, e acha pelo público', () => {
    expect(filtrarSugestoes(todas, 'investidores')[0]).toMatchObject({ grupo: 'Lente', lente: 'mercado' });
    expect(filtrarSugestoes(todas, 'Rede')[0].grupo).toBe('Lente'); // "Redes em mar aberto"
  });

  it('usa o nome da lente para a dimensão ("Rede" na Sociedade) e o rótulo do tier', () => {
    expect(filtrarSugestoes(todas, 'insta')[0]).toMatchObject({ grupo: 'Rede' });
    expect(filtrarSugestoes(todas, 'tier 1')[0]).toMatchObject({ grupo: 'Tier do veículo', rotulo: 'Tier 1' });
  });
});

describe('BuscaDoRadar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('digitar e escolher devolve a lente e o filtro', async () => {
    const { BuscaDoRadar } = await import('@/paginas/score/BuscaDoRadar');
    const aoEscolher = vi.fn();
    render(
      <BuscaDoRadar mes="2026-06" lentes={LENTES} lenteAberta="imprensa" filtro={{}} aoEscolher={aoEscolher} aoMudarFiltro={vi.fn()} />,
    );
    const campo = screen.getByRole('combobox');
    await userEvent.click(campo);
    await userEvent.type(campo, 'folha');
    await waitFor(() => expect(screen.getByRole('option', { name: /Folha de S.Paulo/ })).toBeTruthy());
    await userEvent.keyboard('{Enter}');
    expect(aoEscolher).toHaveBeenCalledWith(
      expect.objectContaining({ lente: 'imprensa', filtro: { chave: 'veiculo', valor: 'Folha de S.Paulo' } }),
    );
  });

  it('mostra o filtro ativo como chip e o "Limpar" zera', async () => {
    const { BuscaDoRadar } = await import('@/paginas/score/BuscaDoRadar');
    const aoMudarFiltro = vi.fn();
    render(
      <BuscaDoRadar
        mes="2026-06"
        lentes={LENTES}
        lenteAberta="imprensa"
        filtro={{ veiculo: 'Valor' }}
        aoEscolher={vi.fn()}
        aoMudarFiltro={aoMudarFiltro}
      />,
    );
    expect(screen.getByText(/Imprensa · Veículo: Valor/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(aoMudarFiltro).toHaveBeenCalledWith({});
  });
});
