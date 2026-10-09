// @vitest-environment jsdom

/** "Comparar com" várias lentes: uma curva por lente, na cor dela no radar. */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { JornadaDoIndice } from '@/graficos/JornadaDoIndice';
import { dominioDaJornada, jornadaDoIndice } from '@/dominio/jornadaDoIndice';
import { CORES_DA_LENTE } from '@/dominio/score';
import type { PontoDaSerie } from '@/dominio/score';

const ponto = (mes: string, isr: number, notas: Record<string, number>): PontoDaSerie =>
  ({
    mes, isr, lentes: 5, tem_estimativa: false, delta: null, fatos: [], sustentou: null,
    pressionou: null, pontos_sem_tema: 0, maior_movimento: null, notas_das_lentes: notas,
    temas_das_lentes: {},
  }) as PontoDaSerie;

const SERIE = [
  ponto('2026-01', 60, { imprensa: 50, clientes: 90 }),
  ponto('2026-02', 62, { imprensa: 55, clientes: 92 }),
  ponto('2026-03', 64, { imprensa: 58 }),
];
const NOMES = { imprensa: 'Imprensa', clientes: 'Clientes' };

describe('várias lentes na Jornada', () => {
  it('uma curva por lente, na ordem escolhida, com o nome e a última nota', () => {
    const jornada = jornadaDoIndice(SERIE, '2026-03', ['clientes', 'imprensa'], NOMES);
    expect(jornada.curvasDasLentes.map((c) => c.codigo)).toEqual(['clientes', 'imprensa']);
    expect(jornada.curvasDasLentes[0].fim.texto).toBe('Clientes 92');
    expect(jornada.curvasDasLentes[1].pontos).toHaveLength(3);
  });

  it('o eixo cabe todas as lentes escolhidas', () => {
    const so = dominioDaJornada(SERIE, ['imprensa']);
    const duas = dominioDaJornada(SERIE, ['imprensa', 'clientes']);
    expect(duas.teto).toBeGreaterThanOrEqual(92);
    expect(duas.teto).toBeGreaterThan(so.teto);
  });

  it('uma lente só continua funcionando como antes', () => {
    const jornada = jornadaDoIndice(SERIE, '2026-03', 'imprensa', 'Imprensa');
    expect(jornada.curvaDaLente).not.toBe('');
    expect(jornada.fimDaLente?.texto).toBe('Imprensa 58');
    expect(jornada.curvasDasLentes).toHaveLength(1);
  });

  it('cada curva sai na cor da lente', () => {
    const { container } = render(
      <JornadaDoIndice serie={SERIE} mes="2026-03" comparada={['imprensa', 'clientes']} nomeDaComparada={NOMES} aoEscolherMes={() => {}} />,
    );
    expect(container.querySelector('[data-curva-da-lente="imprensa"]')?.getAttribute('stroke')).toBe(CORES_DA_LENTE.imprensa);
    expect(container.querySelector('[data-curva-da-lente="clientes"]')?.getAttribute('stroke')).toBe(CORES_DA_LENTE.clientes);
  });
});
