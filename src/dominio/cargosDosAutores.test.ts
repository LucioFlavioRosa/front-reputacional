import { describe, expect, it } from 'vitest';

import type { GrupoDeCargo } from '@/api/cliente';
import {
  autoresDoCargo,
  buscarAutores,
  cargosDoRecorte,
  cargosNaTela,
  cargosParaAcompanhar,
  mencoesSemCargo,
} from '@/dominio/cargosDosAutores';

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

const GRUPOS: GrupoDeCargo[] = [
  grupo({ autor: '@iriel', negativo: 2, peso_negativo: 4 }),
  grupo({ autor: '@ana', positivo: 1, peso_positivo: 2 }),
  grupo({ autor: '@Joaquim', positivo: 3, peso_positivo: 3 }),
  grupo({ cargo: 'Deputado estadual', autor: '@joao', positivo: 4, neutro: 2, peso_positivo: 12, peso_neutro: 6 }),
  grupo({ cargo: 'Imprensa', autor: '@jornal', neutro: 1, peso_neutro: 1 }),
  grupo({ cargo: null, autor: '@cidadao', negativo: 5, peso_negativo: 5 }),
  grupo({ cargo: 'Vereador', autor: null, positivo: 1, peso_positivo: 2 }),
];

describe('o tracking soma por cargo', () => {
  it('soma os autores de um cargo e ordena pelo volume', () => {
    const cargos = cargosDoRecorte(GRUPOS, 100);
    expect(cargos.map((c) => c.cargo)).toEqual(['Vereador', 'Deputado estadual', 'Imprensa']);
    const vereador = cargos[0];
    //: O GRUPO SEM AUTOR CONTA NO CARGO — ele só não aparece na lista de @.
    expect(vereador.total).toBe(7);
    expect(vereador.positivo).toBe(5);
    expect(vereador.negativo).toBe(2);
  });

  it('o termômetro é o saldo de −100 a +100, e o impacto é ponderado', () => {
    const [vereador] = cargosDoRecorte(GRUPOS, 100);
    //: (5 − 2) ÷ 7 × 100 = 42,8…
    expect(vereador.nss).toBe(43);
    //: 50 × (7 − 4) ÷ 100
    expect(vereador.impacto).toBeCloseTo(1.5);
  });

  it('a menção sem cargo fica fora do gráfico e vai para o rodapé', () => {
    expect(cargosDoRecorte(GRUPOS, 100).some((c) => c.cargo === null)).toBe(false);
    expect(mencoesSemCargo(GRUPOS)).toBe(5);
  });

  it('o denominador zero não divide por zero', () => {
    expect(cargosDoRecorte(GRUPOS, 0)[0].impacto).toBe(0);
  });
});

describe('o topo e os cargos acompanhados', () => {
  const muitos = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((cargo, posicao) =>
    grupo({ cargo, autor: '@x', positivo: 10 - posicao }),
  );
  const cargos = cargosDoRecorte(muitos, 100);

  it('abre no top 5', () => {
    expect(cargosNaTela(cargos, []).map((c) => c.cargo)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('o acompanhado entra depois do topo, sem tirar ninguém', () => {
    expect(cargosNaTela(cargos, ['G']).map((c) => c.cargo)).toEqual(['A', 'B', 'C', 'D', 'E', 'G']);
  });

  it('o acompanhado que já está no topo não repete, e o que sumiu do recorte some', () => {
    expect(cargosNaTela(cargos, ['B', 'Z']).map((c) => c.cargo)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('o seletor oferece só quem não está na tela', () => {
    const naTela = cargosNaTela(cargos, ['G']);
    expect(cargosParaAcompanhar(cargos, naTela).map((c) => c.cargo)).toEqual(['F']);
  });
});

describe('os autores de um cargo', () => {
  it('vêm do maior impacto em módulo para o menor, sem o grupo sem autor', () => {
    const autores = autoresDoCargo(GRUPOS, 'Vereador', 100);
    //: @iriel tira 2 pontos, @Joaquim põe 1,5 e @ana põe 1.
    expect(autores.map((a) => a.autor)).toEqual(['@iriel', '@Joaquim', '@ana']);
    expect(autores[0].impacto).toBeCloseTo(-2);
  });

  it('a busca ignora caixa, acento e o @', () => {
    const autores = autoresDoCargo(GRUPOS, 'Vereador', 100);
    expect(buscarAutores(autores, 'joa').map((a) => a.autor)).toEqual(['@Joaquim']);
    expect(buscarAutores(autores, '@IRIEL').map((a) => a.autor)).toEqual(['@iriel']);
    expect(buscarAutores(autores, '  ')).toHaveLength(3);
  });

  it('acha o autor pelo nome, como a Bites manda — sem acento e por um pedaço', () => {
    const autores = autoresDoCargo(
      [
        grupo({ cargo: 'Imprensa', autor: 'Jornal Integração Hortênsias', neutro: 1 }),
        grupo({ cargo: 'Imprensa', autor: 'Princesa Fm', positivo: 1 }),
      ],
      'Imprensa',
      100,
    );
    expect(buscarAutores(autores, 'hortensias').map((a) => a.autor)).toEqual([
      'Jornal Integração Hortênsias',
    ]);
    expect(buscarAutores(autores, 'princesa').map((a) => a.autor)).toEqual(['Princesa Fm']);
  });
});
