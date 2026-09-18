/** `Recorte`: como os filtros viram um valor único, e como o período —
 *  Passado e Futuro, cada um com preset ou data customizada — se resolve
 *  num único `{ de, ate }`.
 */

import { describe, expect, it } from 'vitest';
import {
  alternarCategoriaDeArea,
  alternarCategoriaPublico,
  intervalo,
  limparAreas,
  limparCategoriaPublico,
  paraParametros,
  quantidadeDeFiltros,
} from '@/dominio/recorte';
import type { Recorte } from '@/dominio/recorte';

const HOJE = new Date(2026, 8, 15); // 15/09/2026, mês 0-indexado

describe('intervalo', () => {
  it('nenhum lado ativo devolve vazio', () => {
    expect(intervalo({}, HOJE)).toEqual({ de: undefined, ate: undefined });
  });

  it('só passado ativo (preset) termina hoje, igual sempre foi', () => {
    const recorte: Recorte = { periodoPassado: 'ultimos-30' };
    const resultado = intervalo(recorte, HOJE);
    expect(resultado.ate).toEqual(HOJE);
    expect(resultado.de).toEqual(new Date(2026, 7, 16)); // 30 dias antes
  });

  it('só futuro ativo (preset) começa hoje, igual sempre foi', () => {
    const recorte: Recorte = { periodoFuturo: 'proximos-90' };
    const resultado = intervalo(recorte, HOJE);
    expect(resultado.de).toEqual(HOJE);
    expect(resultado.ate).toEqual(new Date(2026, 11, 14)); // 90 dias depois
  });

  it('os dois ativos combinam num intervalo assimétrico só', () => {
    const recorte: Recorte = { periodoPassado: 'ultimos-30', periodoFuturo: 'proximos-90' };
    const resultado = intervalo(recorte, HOJE);
    expect(resultado.de).toEqual(new Date(2026, 7, 16));
    expect(resultado.ate).toEqual(new Date(2026, 11, 14));
  });

  it('data customizada em de/ate tem prioridade sobre o preset do mesmo lado', () => {
    const recorte: Recorte = { de: '2026-01-01', periodoPassado: 'ultimos-30' };
    const resultado = intervalo(recorte, HOJE);
    expect(resultado.de).toEqual(new Date(2026, 0, 1));
  });

  it('as duas pontas oferecem a mesma escala de dias (30/60/90/180/360)', () => {
    const recorte: Recorte = { periodoPassado: 'ultimos-60', periodoFuturo: 'proximos-360' };
    const resultado = intervalo(recorte, HOJE);
    expect(resultado.de).toEqual(new Date(2026, 6, 17)); // 60 dias antes
    expect(resultado.ate).toEqual(new Date(2027, 8, 10)); // 360 dias depois
  });

  it('de e ate customizados, um de cada lado, combinam sem preset nenhum', () => {
    const recorte: Recorte = { de: '2026-08-01', ate: '2026-11-01' };
    const resultado = intervalo(recorte, HOJE);
    expect(resultado.de).toEqual(new Date(2026, 7, 1));
    expect(resultado.ate).toEqual(new Date(2026, 10, 1));
  });
});

describe('quantidadeDeFiltros', () => {
  it('período conta como 1 filtro, mesmo com os dois lados ativos', () => {
    const soPassado: Recorte = { periodoPassado: 'ultimos-30' };
    const osDois: Recorte = { periodoPassado: 'ultimos-30', periodoFuturo: 'proximos-90' };
    expect(quantidadeDeFiltros(soPassado)).toBe(1);
    expect(quantidadeDeFiltros(osDois)).toBe(1);
  });

  it('recorte vazio não conta filtro nenhum', () => {
    expect(quantidadeDeFiltros({})).toBe(0);
  });
});

describe('paraParametros', () => {
  it('nunca manda periodoPassado/periodoFuturo crus — sempre de/ate resolvidos', () => {
    const recorte: Recorte = { periodoPassado: 'ultimos-30', periodoFuturo: 'proximos-90' };
    const parametros = paraParametros(recorte);
    expect(parametros.has('periodoPassado')).toBe(false);
    expect(parametros.has('periodoFuturo')).toBe(false);
    expect(parametros.has('de')).toBe(true);
    expect(parametros.has('ate')).toBe(true);
  });

  it('sem período nenhum, não manda de/ate', () => {
    const parametros = paraParametros({ frente: 'imprensa' });
    expect(parametros.has('de')).toBe(false);
    expect(parametros.has('ate')).toBe(false);
    expect(parametros.get('frente')).toBe('imprensa');
  });
});

describe('alternarCategoriaDeArea', () => {
  it('liga todas as áreas do grupo de uma vez, quando nenhuma está ligada', () => {
    const resultado = alternarCategoriaDeArea({}, [3, 5]);
    expect(resultado.areas).toEqual([3, 5]);
  });

  it('desliga todas as áreas do grupo de uma vez, quando todas já estão ligadas', () => {
    const resultado = alternarCategoriaDeArea({ areas: [3, 5] }, [3, 5]);
    expect(resultado.areas).toBeUndefined();
  });

  it('uma área do grupo já ligada por fora (ex: filtro manual) não impede ligar o resto', () => {
    const resultado = alternarCategoriaDeArea({ areas: [3] }, [3, 5]);
    expect(resultado.areas).toEqual([3, 5]);
  });

  it('preserva áreas fora do grupo, ao ligar ou desligar', () => {
    const ligando = alternarCategoriaDeArea({ areas: [1] }, [3, 5]);
    expect(ligando.areas).toEqual([1, 3, 5]);

    const desligando = alternarCategoriaDeArea({ areas: [1, 3, 5] }, [3, 5]);
    expect(desligando.areas).toEqual([1]);
  });

  it('um grupo de uma área só liga/desliga só ela, como uma seleção simples', () => {
    const ligado = alternarCategoriaDeArea({}, [1]);
    expect(ligado.areas).toEqual([1]);
    const desligado = alternarCategoriaDeArea(ligado, [1]);
    expect(desligado.areas).toBeUndefined();
  });
});

describe('limparAreas', () => {
  it('remove só o campo areas, preservando o resto do recorte', () => {
    const resultado = limparAreas({ areas: [1, 3], frente: 'imprensa' });
    expect(resultado.areas).toBeUndefined();
    expect(resultado.frente).toEqual('imprensa');
  });

  it('não falha quando já não há areas no recorte', () => {
    expect(limparAreas({ frente: 'imprensa' })).toEqual({ frente: 'imprensa' });
  });
});

describe('alternarCategoriaPublico', () => {
  it('liga a categoria quando ainda não está no recorte', () => {
    expect(alternarCategoriaPublico({}, 3).categoriaPublico).toEqual([3]);
  });

  it('desliga a categoria quando já está no recorte', () => {
    expect(alternarCategoriaPublico({ categoriaPublico: [3] }, 3).categoriaPublico).toBeUndefined();
  });

  it('multisseleção com OR entre elas, preservando as demais', () => {
    const resultado = alternarCategoriaPublico({ categoriaPublico: [1] }, 3);
    expect(resultado.categoriaPublico).toEqual([1, 3]);
  });
});

describe('limparCategoriaPublico', () => {
  it('remove só o campo categoriaPublico, preservando o resto do recorte', () => {
    const resultado = limparCategoriaPublico({ categoriaPublico: [1, 3], frente: 'imprensa' });
    expect(resultado.categoriaPublico).toBeUndefined();
    expect(resultado.frente).toEqual('imprensa');
  });
});

describe('paraParametros', () => {
  it('nunca manda categoriaPublico ao backend — é filtro só do cliente', () => {
    const parametros = paraParametros({ categoriaPublico: [1, 3], areas: [2] });
    expect(parametros.has('categoriaPublico')).toBe(false);
    expect(parametros.get('areas')).toEqual('2');
  });
});
