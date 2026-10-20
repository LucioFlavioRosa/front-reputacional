import { describe, expect, it } from 'vitest';

import type { GrupoDoExplorador } from '@/api/cliente';
import { barrasDoNivel, gruposNaSelecao, textoDoImpacto, ufsDoExplorador } from '@/dominio/explorador';

function grupo(parcial: Partial<GrupoDoExplorador>): GrupoDoExplorador {
  return {
    n1: null,
    n2: null,
    n3: null,
    uf: null,
    positivo: 0,
    neutro: 0,
    negativo: 0,
    peso_positivo: 0,
    peso_neutro: 0,
    peso_negativo: 0,
    ...parcial,
  };
}

const GRUPOS = [
  grupo({ n1: 'Governança', n2: 'Ética', n3: 'Compliance', uf: 'RJ', positivo: 2, peso_positivo: 2 }),
  grupo({ n1: 'Governança', n2: 'Ética', n3: 'Auditoria', uf: 'SP', negativo: 1, peso_negativo: 3 }),
  grupo({ n1: 'Clientes', n2: 'Atendimento', n3: 'Tarifa', uf: 'RJ', negativo: 3, peso_negativo: 3 }),
  grupo({ n1: 'Clientes', n2: null, n3: null, uf: null, neutro: 4, peso_neutro: 4 }),
];
const D = 12; // soma de todos os pesos

describe('explorador N1 › N2 › N3', () => {
  it('ordena do maior para o menor volume e o impacto usa o denominador do mês', () => {
    const n1 = barrasDoNivel(GRUPOS, 'n1', {}, D);
    expect(n1.map((b) => b.rotulo)).toEqual(['Clientes', 'Governança']);
    expect(n1[0]).toMatchObject({ neutro: 4, negativo: 3 });
    expect(n1[0].impacto).toBeCloseTo((50 * -3) / 12);
    // OS IMPACTOS DO NÍVEL SOMAM O DO MÊS (todo grupo tem N1 aqui).
    const total = n1.reduce((soma, b) => soma + b.impacto, 0);
    expect(total).toBeCloseTo((50 * (2 - 6)) / 12);
  });

  it('o clique filtra os outros níveis, e o próprio nível continua inteiro', () => {
    const selecao = { n1: 'Governança' };
    expect(barrasDoNivel(GRUPOS, 'n1', selecao, D)).toHaveLength(2);
    expect(barrasDoNivel(GRUPOS, 'n3', selecao, D).map((b) => b.rotulo).sort()).toEqual([
      'Auditoria',
      'Compliance',
    ]);
    expect(gruposNaSelecao(GRUPOS, { n1: 'Clientes', n2: 'Atendimento' })).toHaveLength(1);
  });

  it('menção sem o campo fica fora só daquela barra', () => {
    expect(barrasDoNivel(GRUPOS, 'n2', {}, D).map((b) => b.rotulo)).toEqual(['Atendimento', 'Ética']);
  });

  it('a UF tem o termômetro (NSS) em contagem e a nota pelo peso', () => {
    const ufs = ufsDoExplorador(GRUPOS, {});
    const rj = ufs.find((u) => u.uf === 'RJ')!;
    expect(rj).toMatchObject({ total: 5, nss: -20, score: 40 });
    const sp = ufs.find((u) => u.uf === 'SP')!;
    expect(sp).toMatchObject({ total: 1, nss: -100, score: 0 });
    expect(ufs.map((u) => u.uf)).toEqual(['RJ', 'SP']);
    expect(ufsDoExplorador(GRUPOS, { n1: 'Clientes' }).map((u) => u.uf)).toEqual(['RJ']);
  });

  it('escreve o impacto com sinal e uma casa', () => {
    expect(textoDoImpacto(1.26)).toBe('+1,3');
    expect(textoDoImpacto(-12.5)).toBe('−12,5');
    expect(textoDoImpacto(-0.01)).toBe('0,0');
  });
});
