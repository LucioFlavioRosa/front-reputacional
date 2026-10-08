/** A janela da Jornada do índice: atalhos, arrastes e os quatro cartões. */

import { describe, expect, it } from 'vitest';

import {
  ajustar,
  atalhoDaJanela,
  janelaDoAtalho,
  kpisDaJanela,
  moverJanela,
  redimensionarJanela,
  serieDaJanela,
} from '@/dominio/janelaDaJornada';
import type { PontoDaSerie } from '@/dominio/score';

const ponto = (mes: string, isr: number | null, lentes = 5): PontoDaSerie =>
  ({
    mes,
    isr,
    lentes,
    tem_estimativa: false,
    delta: null,
    fatos: [],
    sustentou: null,
    pressionou: null,
    pontos_sem_tema: 0,
    maior_movimento: null,
    notas_das_lentes: {},
    temas_das_lentes: {},
  }) as PontoDaSerie;

//: 2025-11 a 2026-08: dez meses medidos.
const MESES = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
const SERIE = MESES.map((mes, i) => ponto(mes, 60 + i));

describe('atalhos', () => {
  it('3M, 6M e Tudo contam do último mês medido para trás', () => {
    expect(janelaDoAtalho('3m', SERIE)).toEqual({ inicio: 7, fim: 9 });
    expect(janelaDoAtalho('6m', SERIE)).toEqual({ inicio: 4, fim: 9 });
    expect(janelaDoAtalho('tudo', SERIE)).toEqual({ inicio: 0, fim: 9 });
  });

  it('12M numa série de 10 meses é a série inteira, e acende "Tudo"', () => {
    const doze = janelaDoAtalho('12m', SERIE);
    expect(doze).toEqual({ inicio: 0, fim: 9 });
    expect(atalhoDaJanela(doze, SERIE)).toBe('tudo');
  });

  it('"Ano atual" é o ano do último mês medido', () => {
    expect(janelaDoAtalho('ano', SERIE)).toEqual({ inicio: 2, fim: 9 });
    expect(atalhoDaJanela({ inicio: 2, fim: 9 }, SERIE)).toBe('ano');
  });

  it('janela que não bate com atalho nenhum não acende nenhum', () => {
    expect(atalhoDaJanela({ inicio: 1, fim: 5 }, SERIE)).toBeNull();
  });
});

describe('arrastar e redimensionar', () => {
  it('mover desloca sem mudar o tamanho e para na borda', () => {
    expect(moverJanela({ inicio: 2, fim: 5 }, 1, 10)).toEqual({ inicio: 3, fim: 6 });
    expect(moverJanela({ inicio: 2, fim: 5 }, 99, 10)).toEqual({ inicio: 6, fim: 9 });
    expect(moverJanela({ inicio: 2, fim: 5 }, -99, 10)).toEqual({ inicio: 0, fim: 3 });
  });

  it('redimensionar nunca deixa a janela com menos de 3 meses', () => {
    expect(redimensionarJanela({ inicio: 2, fim: 5 }, 'fim', -5, 10)).toEqual({ inicio: 2, fim: 4 });
    expect(redimensionarJanela({ inicio: 2, fim: 5 }, 'inicio', 5, 10)).toEqual({ inicio: 3, fim: 5 });
    expect(redimensionarJanela({ inicio: 2, fim: 5 }, 'fim', 1, 10)).toEqual({ inicio: 2, fim: 6 });
  });

  it('ajustar completa até o mínimo, crescendo para trás quando encosta no fim', () => {
    expect(ajustar({ inicio: 9, fim: 9 }, 10)).toEqual({ inicio: 7, fim: 9 });
    expect(ajustar({ inicio: 0, fim: 0 }, 2)).toEqual({ inicio: 0, fim: 1 });
  });
});

describe('serieDaJanela', () => {
  it('corta pelos meses medidos e mantém um mês sem índice que caia dentro', () => {
    const comBuraco = [ponto('2026-01', 70), ponto('2026-02', null), ponto('2026-03', 72), ponto('2026-04', 73)];
    expect(serieDaJanela(comBuraco, { inicio: 0, fim: 1 }).map((p) => p.mes)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
    ]);
  });
});

describe('kpisDaJanela', () => {
  it('atual, pico, vale e variação do primeiro ao último mês', () => {
    const kpis = kpisDaJanela([ponto('2026-01', 70), ponto('2026-02', 82), ponto('2026-03', 64), ponto('2026-04', 75)]);
    expect(kpis.atual).toMatchObject({ valor: 75, mes: '2026-04', rotuloDoMes: 'abril de 2026' });
    expect(kpis.pico).toMatchObject({ valor: 82, mes: '2026-02' });
    expect(kpis.vale).toMatchObject({ valor: 64, mes: '2026-03' });
    expect(kpis.variacao).toMatchObject({ pontos: 5, sentido: 'alta' });
  });

  it('pico e vale ignoram mês com menos de 4 lentes, e avisam quando o extremo era dele', () => {
    const kpis = kpisDaJanela([
      ponto('2026-01', 100, 1), // o "pico" absoluto, medido por uma lente só
      ponto('2026-02', 80),
      ponto('2026-03', 30, 2), // o "vale" absoluto, parcial
      ponto('2026-04', 70),
    ]);
    expect(kpis.pico).toMatchObject({ valor: 80, mes: '2026-02' });
    expect(kpis.vale).toMatchObject({ valor: 70, mes: '2026-04' });
    expect(kpis.picoParcial).toMatchObject({ valor: 100, cobertura: '1 de 5 lentes' });
    expect(kpis.valeParcial).toMatchObject({ valor: 30, cobertura: '2 de 5 lentes' });
  });

  it('sem extremo parcial, sem aviso', () => {
    const kpis = kpisDaJanela([ponto('2026-01', 70), ponto('2026-02', 60, 3), ponto('2026-03', 65)]);
    expect(kpis.picoParcial).toBeNull();
    expect(kpis.vale).toMatchObject({ valor: 65 });
    expect(kpis.valeParcial).toMatchObject({ valor: 60 });
  });

  it('queda e estável têm o sentido certo; empate fica com o mês mais recente', () => {
    expect(kpisDaJanela([ponto('2026-01', 70), ponto('2026-02', 60)]).variacao?.sentido).toBe('queda');
    const estavel = kpisDaJanela([ponto('2026-01', 70), ponto('2026-02', 80), ponto('2026-03', 70)]);
    expect(estavel.variacao?.sentido).toBe('estavel');
    expect(estavel.vale?.mes).toBe('2026-03');
  });
});
