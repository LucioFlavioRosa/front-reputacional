import { describe, expect, it } from 'vitest';

import { DADOS } from '../dados/dados';
import {
  DIARIO,
  diaDePico,
  dominioDasColunas,
  larguraDoDia,
  larguraPct,
  marcasDoDiario,
  mesDe,
  proporcao,
  rotuloDaColuna,
  rotuloDoDestaque,
  rotuloDoDia,
  somaDoIntervalo,
  xDaColuna,
  xDaFraseDoDestaque,
  yDaColuna,
  yMaxDoDiario,
} from './escalas';

const imprensa = DADOS.lentes.find((l) => l.id === 'imprensa')!;
const eficiencia = imprensa.pilares.find((p) => p.id === 'eficiencia-operacional')!;
const evolucao = eficiencia.nivel2!.destaque.evolucao;
const adutora = eficiencia.filhos!.flatMap((t) => t.filhos ?? []).find((s) => s.id === 'rompimento-adutora')!;
const porDia = adutora.nivel4!.porDia;

describe('proporcao e larguraPct', () => {
  it('é valor ÷ máximo, presa entre 0 e 1', () => {
    expect(proporcao(107, 214)).toBe(0.5);
    expect(proporcao(300, 214)).toBe(1);
    expect(proporcao(-3, 10)).toBe(0);
    expect(larguraPct(50, 200)).toBe('25%');
  });

  it('máximo zero não divide por zero', () => {
    expect(proporcao(5, 0)).toBe(0);
    expect(larguraPct(0, 0)).toBe('0%');
  });
});

describe('F.5 · colunas', () => {
  it('domínio é [min(0, menor) × 1,15 ; max(0, maior) × 1,15]', () => {
    const [min, max] = dominioDasColunas(evolucao.impactos);
    expect(min).toBeCloseTo(-4.6 * 1.15, 10);
    expect(max).toBe(0);
    expect(dominioDasColunas([0.5, 0.8])).toEqual([0, 0.8 * 1.15]);
    const [a, b] = dominioDasColunas([-2, 1]);
    expect(a).toBeCloseTo(-2.3, 10);
    expect(b).toBeCloseTo(1.15, 10);
  });

  it('tudo zero dá domínio de −1 a 1', () => {
    expect(dominioDasColunas([0, 0, 0])).toEqual([-1, 1]);
    expect(dominioDasColunas([])).toEqual([-1, 1]);
  });

  it('y vai de 40 (máximo) a 220 (mínimo) e x(i) = 80 + i × 88', () => {
    expect(yDaColuna(1, [-1, 1])).toBe(40);
    expect(yDaColuna(-1, [-1, 1])).toBe(220);
    expect(yDaColuna(0, [-1, 1])).toBe(130);
    expect(xDaColuna(0)).toBe(80);
    expect(xDaColuna(5)).toBe(520);
  });

  it('dica: "<mês> · <impacto> pt · <volume> matérias"', () => {
    expect(rotuloDaColuna('ago/26', -4.6, 214, 'matérias')).toBe('ago/26 · −4,6 pt · 214 matérias');
    expect(rotuloDaColuna('mar/26', 0.5, 1200, 'matérias')).toBe('mar/26 · +0,5 pt · 1.200 matérias');
  });
});

describe('F.7 · gráfico diário', () => {
  it('largura do dia é 608 ÷ dias e yMax é ceil(maior × 1,1)', () => {
    expect(larguraDoDia(31)).toBeCloseTo(608 / 31, 10);
    expect(yMaxDoDiario(porDia.total)).toBe(Math.ceil(16 * 1.1));
    expect(yMaxDoDiario([0, 0])).toBe(1);
  });

  it('marcas 1, 5, 10, 15, 20, 25 e o último dia', () => {
    expect(marcasDoDiario(31)).toEqual([1, 5, 10, 15, 20, 25, 31]);
    expect(marcasDoDiario(30)).toEqual([1, 5, 10, 15, 20, 25, 30]);
    expect(marcasDoDiario(0)).toEqual([]);
  });

  it('a soma da faixa sai dos dados (12 a 18 de agosto: 69)', () => {
    expect(somaDoIntervalo(porDia.total, 12, 18)).toBe(69);
    expect(somaDoIntervalo([1, 2, 3], 1, 3)).toBe(6);
    expect(somaDoIntervalo([1, 2, 3], 2, 2)).toBe(2);
  });

  it('frase da faixa com o mês vindo de quem chama', () => {
    expect(rotuloDoDestaque(porDia.total, porDia.destaque, mesDe(DADOS.meta.mesReferencia))).toBe(
      '12 a 18/08 · 69 matérias',
    );
    expect(rotuloDoDestaque([0, 0, 0, 0, 1, 0, 0, 0, 0, 0], { inicio: 5, fim: 9 }, '09')).toBe('05 a 09/09 · 1 matéria');
  });

  it('dica do dia: "14/08 · 12 matérias, 10 negativas"', () => {
    expect(rotuloDoDia(14, '08', porDia.total[13], porDia.negativas[13])).toBe('14/08 · 12 matérias, 10 negativas');
    expect(rotuloDoDia(2, '08', 1, 1)).toBe('02/08 · 1 matéria, 1 negativa');
    expect(rotuloDoDia(1, '08', 0, 0)).toBe('01/08 · 0 matérias, 0 negativas');
  });

  it('pico é o dia de maior total; sem matérias, não há pico', () => {
    expect(diaDePico(porDia.total)).toBe(13);
    expect(diaDePico([0, 0])).toBeUndefined();
  });

  it('a frase da faixa não sai pelas bordas', () => {
    const frase = '12 a 18/08 · 69 matérias';
    expect(xDaFraseDoDestaque(300, 100, frase)).toBe(350);
    expect(xDaFraseDoDestaque(DIARIO.esquerda, 10, frase)).toBeGreaterThan(DIARIO.esquerda + 60);
    expect(xDaFraseDoDestaque(620, 8, frase)).toBeLessThan(DIARIO.direita - 60);
  });

  it('mesDe tira o mês de "AAAA-MM"', () => {
    expect(mesDe('2026-08')).toBe('08');
  });
});
