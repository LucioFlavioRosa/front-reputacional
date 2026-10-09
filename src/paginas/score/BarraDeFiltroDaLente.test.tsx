// @vitest-environment jsdom

/** Os filtros da aba Lentes: rápidos na faixa, o resto no "Filtro avançado".
 *
 *  O QUE ESTE ARQUIVO TRAVA é o que a barra promete: cada lente com os seus
 *  filtros e os seus nomes, só aparece o campo que a lente TEM no mês, os
 *  recortes se empilham em vez de se substituírem, e escolher de novo o que já
 *  está marcado desmarca.
 */

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BarraDeFiltroDaLente } from '@/paginas/score/BarraDeFiltroDaLente';
import type { OpcoesDeFiltroDaLente } from '@/api/cliente';

const DA_SOCIEDADE: OpcoesDeFiltroDaLente = {
  tiers: [],
  veiculos: ['Instagram', 'Facebook'],
  atributos: [],
  temas: ['Saneamento básico'],
  perfis: ['Cidadão', 'Figura pública'],
  ufs: ['RJ', 'SP'],
  subtemas: ['Falta de água'],
  autores: ['@vizinho'],
  empresas: ['Águas do Rio', 'Aegea Holding'],
};

const DA_IMPRENSA: OpcoesDeFiltroDaLente = {
  tiers: ['muito_relevante'],
  veiculos: ['Folha'],
  atributos: ['Qualidade'],
  temas: ['Tarifa'],
  perfis: [],
  ufs: ['SP'],
  subtemas: [],
  autores: [],
  empresas: [],
};

describe('BarraDeFiltroDaLente', () => {
  it('Sociedade digital: rápidos com os nomes da lente ("Rede", "Perfil de quem fala")', () => {
    render(<BarraDeFiltroDaLente lente="sociedade" filtro={{}} definirFiltro={vi.fn()} opcoes={DA_SOCIEDADE} />);
    expect(screen.getByText('Rede')).toBeTruthy();
    expect(screen.getByText('Perfil de quem fala')).toBeTruthy();
    expect(screen.getByText('Concessionária')).toBeTruthy();
    // Subtema, Autor e UF ficam no avançado, que começa fechado.
    expect(screen.queryByText('Subtema')).toBeNull();
    expect(screen.getByRole('button', { name: /Filtro avançado/ })).toBeTruthy();
  });

  it('Imprensa: tier e veículo nos rápidos; campo sem opção não aparece', async () => {
    render(<BarraDeFiltroDaLente lente="imprensa" filtro={{}} definirFiltro={vi.fn()} opcoes={DA_IMPRENSA} />);
    expect(screen.getByText('Tier do veículo')).toBeTruthy();
    expect(screen.getByText('Veículo')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Filtro avançado/ }));
    expect(screen.getByText('UF')).toBeTruthy();
    // A Imprensa não mandou jornalista neste mês: o campo não é desenhado.
    expect(screen.queryByText('Jornalista')).toBeNull();
  });

  it('Mercado não tem filtros: a barra não aparece', () => {
    const { container } = render(
      <BarraDeFiltroDaLente lente="mercado" filtro={{}} definirFiltro={vi.fn()} opcoes={DA_IMPRENSA} />,
    );
    expect(container.textContent).toBe('');
  });

  it('escolher ACRESCENTA ao recorte, sem apagar o que já havia', async () => {
    const definirFiltro = vi.fn();
    render(
      <BarraDeFiltroDaLente
        lente="sociedade"
        filtro={{ perfil_autor: 'Figura pública' }}
        definirFiltro={definirFiltro}
        opcoes={DA_SOCIEDADE}
      />,
    );
    await userEvent.click(screen.getByText('Rede'));
    await userEvent.click(screen.getByText('Instagram'));
    expect(definirFiltro).toHaveBeenCalledWith({ perfil_autor: 'Figura pública', veiculo: 'Instagram' });
  });

  it('no avançado, escolher de novo o que já está marcado DESMARCA, e o contador aparece', async () => {
    const definirFiltro = vi.fn();
    render(
      <BarraDeFiltroDaLente lente="sociedade" filtro={{ uf: 'RJ' }} definirFiltro={definirFiltro} opcoes={DA_SOCIEDADE} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Filtro avançado · 1' }));
    await userEvent.click(screen.getByText('RJ'));
    expect(definirFiltro).toHaveBeenCalledWith({ uf: undefined });
  });

  it('o "Limpar recorte" aparece quando QUALQUER dimensão está ativa', () => {
    const { rerender } = render(
      <BarraDeFiltroDaLente lente="sociedade" filtro={{}} definirFiltro={vi.fn()} opcoes={DA_SOCIEDADE} />,
    );
    expect(screen.queryByRole('button', { name: /limpar/i })).toBeNull();
    rerender(
      <BarraDeFiltroDaLente
        lente="sociedade"
        filtro={{ subtema: 'Falta de água' }}
        definirFiltro={vi.fn()}
        opcoes={DA_SOCIEDADE}
      />,
    );
    expect(screen.getByRole('button', { name: /limpar/i })).toBeTruthy();
  });
});
