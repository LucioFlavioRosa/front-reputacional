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
  tiers: ['menos_relevante', 'muito_relevante', 'relevante'],
  veiculos: ['Folha'],
  atributos: ['Qualidade'],
  temas: ['Tarifa'],
  perfis: [],
  ufs: ['SP'],
  subtemas: [],
  autores: [],
  empresas: ['Águas do Rio', 'Aegea Holding'],
  sentimentos: ['neg', 'pos', 'neu'],
  temas_n1: ['Governança'],
  temas_n2: ['Ética'],
};

describe('BarraDeFiltroDaLente', () => {
  it('Sociedade digital: rápidos com os nomes da lente, e sem "Filtro avançado"', () => {
    render(<BarraDeFiltroDaLente lente="sociedade" filtro={{}} definirFiltro={vi.fn()} opcoes={DA_SOCIEDADE} />);
    expect(screen.getByText('Rede')).toBeTruthy();
    expect(screen.getByText('Perfil de quem fala')).toBeTruthy();
    expect(screen.getByText('Concessionária')).toBeTruthy();
    // O que era do avançado não aparece mais na barra.
    expect(screen.queryByText('Subtema (fornecedor)')).toBeNull();
    expect(screen.queryByRole('button', { name: /Filtro avançado/ })).toBeNull();
  });

  it('Sociedade digital: Pilar (N1), Tema estratégico (N2) e Subtema (N3) quando as menções estão ligadas', async () => {
    const definirFiltro = vi.fn();
    render(
      <BarraDeFiltroDaLente
        lente="sociedade"
        filtro={{}}
        definirFiltro={definirFiltro}
        opcoes={{ ...DA_SOCIEDADE, temas_n1: ['Governança'], temas_n2: ['Ética'], temas_n3: ['Compliance'] }}
      />,
    );
    expect(screen.getByText('Pilar (N1)')).toBeTruthy();
    expect(screen.getByText('Tema estratégico (N2)')).toBeTruthy();
    expect(screen.getByText('Subtema (N3)')).toBeTruthy();
    await userEvent.click(screen.getByText('Pilar (N1)'));
    await userEvent.click(screen.getByText('Governança'));
    expect(definirFiltro).toHaveBeenCalledWith({ tema_n1: 'Governança' });
  });

  it('Sociedade digital sem menção ligada: os três níveis não aparecem', () => {
    render(<BarraDeFiltroDaLente lente="sociedade" filtro={{}} definirFiltro={vi.fn()} opcoes={DA_SOCIEDADE} />);
    expect(screen.queryByText('Pilar (N1)')).toBeNull();
    expect(screen.queryByText('Subtema (N3)')).toBeNull();
  });

  it('Imprensa: Concessionária, Tier e Sentimento, nessa ordem — sem veículo, temas nem atributo', () => {
    const { container } = render(
      <BarraDeFiltroDaLente lente="imprensa" filtro={{}} definirFiltro={vi.fn()} opcoes={DA_IMPRENSA} />,
    );
    const texto = container.textContent ?? '';
    expect(texto.indexOf('Concessionária')).toBeGreaterThanOrEqual(0);
    expect(texto.indexOf('Concessionária')).toBeLessThan(texto.indexOf('Tier do veículo'));
    expect(texto.indexOf('Tier do veículo')).toBeLessThan(texto.indexOf('Sentimento'));
    for (const fora of ['Veículo', 'Atributo', 'Pilar (N1)', 'Tema estratégico (N2)', 'UF']) {
      expect(screen.queryByText(fora)).toBeNull();
    }
  });

  it('Imprensa: os tiers em ordem — Tier 1, Tier 2, Tier 3', async () => {
    render(<BarraDeFiltroDaLente lente="imprensa" filtro={{}} definirFiltro={vi.fn()} opcoes={DA_IMPRENSA} />);
    await userEvent.click(screen.getByText('Tier do veículo'));
    const tiers = screen.getAllByText(/^Tier \d$/).map((item) => item.textContent);
    expect(tiers).toEqual(['Tier 1', 'Tier 2', 'Tier 3']);
  });

  it('Imprensa: o sentimento escolhido pinta o gatilho, como o termômetro do CRM', async () => {
    const definirFiltro = vi.fn();
    const { rerender } = render(
      <BarraDeFiltroDaLente lente="imprensa" filtro={{}} definirFiltro={definirFiltro} opcoes={DA_IMPRENSA} />,
    );
    await userEvent.click(screen.getByText('Sentimento'));
    expect(screen.getAllByText(/^(Positivo|Neutro|Negativo)$/).map((item) => item.textContent)).toEqual([
      'Positivo',
      'Neutro',
      'Negativo',
    ]);
    await userEvent.click(screen.getByText('Negativo'));
    expect(definirFiltro).toHaveBeenCalledWith({ sentimento: 'neg' });

    rerender(
      <BarraDeFiltroDaLente lente="imprensa" filtro={{ sentimento: 'neg' }} definirFiltro={definirFiltro} opcoes={DA_IMPRENSA} />,
    );
    const gatilho = screen.getByRole('button', { name: /Sentimento/ });
    expect(gatilho.style.background).toBe('rgb(255, 92, 96)');
    expect(gatilho.textContent).toContain('Negativo');
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

  it('escolher de novo o que já está marcado DESMARCA', async () => {
    const definirFiltro = vi.fn();
    render(
      <BarraDeFiltroDaLente lente="sociedade" filtro={{ veiculo: 'Instagram' }} definirFiltro={definirFiltro} opcoes={DA_SOCIEDADE} />,
    );
    await userEvent.click(screen.getByText(/^Rede/));
    await userEvent.click(screen.getByText('Instagram'));
    expect(definirFiltro).toHaveBeenCalledWith({ veiculo: undefined });
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
