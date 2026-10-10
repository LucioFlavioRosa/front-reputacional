// @vitest-environment jsdom

/** O gatilho "Filtrar por Termômetro" assume a cor do termômetro escolhido. */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CampoSuspenso } from '@/componentes/CampoSuspenso';
import { campoDeClima } from '@/componentes/PainelDeFiltros';
import type { Catalogo } from '@/dominio/derivacoes';
import type { Recorte } from '@/dominio/recorte';

const CATALOGO = {
  dicionarios: {
    climas: [
      { id: 1, codigo: 'propositivo', nome: 'Positivo', ordem: 1, cor_hex: '#17E3CB' },
      { id: 2, codigo: 'neutro', nome: 'Neutro', ordem: 2, cor_hex: '#B0B9C8' },
      { id: 3, codigo: 'tenso', nome: 'Negativo', ordem: 3, cor_hex: '#FF5C60' },
    ],
  },
} as unknown as Catalogo;

function gatilho(recorte: Recorte) {
  render(<CampoSuspenso campo={campoDeClima(recorte, () => {}, CATALOGO)} />);
  return screen.getByRole('button', { name: /Filtrar por Termômetro/ });
}

describe('Filtrar por Termômetro', () => {
  it.each([
    ['propositivo', 'Positivo', 'rgb(23, 227, 203)'], // verde (turquesa Aegea)
    ['tenso', 'Negativo', 'rgb(255, 92, 96)'], // vermelho
    ['neutro', 'Neutro', 'rgb(176, 185, 200)'], // cinza
  ])('com %s escolhido, fica na cor dele e diz qual é', (codigo, rotulo, cor) => {
    const botao = gatilho({ clima: codigo });
    expect(botao.style.background).toBe(cor);
    expect(botao.textContent).toContain(`Filtrar por Termômetro · ${rotulo}`);
  });

  it('sem termômetro escolhido, fica no branco de sempre', () => {
    const botao = gatilho({});
    expect(botao.style.background).toBe('var(--branco)');
  });
});
