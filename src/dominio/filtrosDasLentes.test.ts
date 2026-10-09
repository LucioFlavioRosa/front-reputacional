/** Os filtros de tema dizem sempre qual é o nível. */

import { describe, expect, it } from 'vitest';

import { camposDaBase } from '@/dominio/baseDasLentes';
import { FILTROS_DAS_LENTES } from '@/dominio/filtrosDasLentes';

describe('filtros de tema no painel de KPIs', () => {
  //: A Imprensa ficou enxuta por pedido (Concessionária, Tier, Sentimento).
  it.each(['sociedade', 'clientes'])('%s tem Pilar (N1) e Tema estratégico (N2) nos rápidos', (lente) => {
    const rotulos = FILTROS_DAS_LENTES[lente].rapidos.map((d) => d.rotulo);
    expect(rotulos).toContain('Pilar (N1)');
    expect(rotulos).toContain('Tema estratégico (N2)');
  });

  it('nenhum filtro se chama só "Tema" ou "Subtema"', () => {
    const todos = [
      ...Object.values(FILTROS_DAS_LENTES).flatMap((f) => [...f.rapidos, ...f.avancados]),
      ...camposDaBase('imprensa'),
    ].map((d) => d.rotulo);
    expect(todos).not.toContain('Tema');
    expect(todos).not.toContain('Subtema');
  });

  it('na Base de dados, Pilar e Tema estratégico vêm primeiro', () => {
    expect(camposDaBase('sociedade').slice(0, 2).map((c) => c.rotulo)).toEqual(['Pilar (N1)', 'Tema estratégico (N2)']);
  });
});
