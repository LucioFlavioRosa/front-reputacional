/** O resumo textual do período — Passado e Futuro como lados independentes,
 *  cada um por preset ou data customizada, combinados numa frase só quando
 *  os dois estão ativos.
 */

import { describe, expect, it } from 'vitest';
import { fichasDoRecorte, resumirRecorte, semOFiltro } from '@/dominio/resumo-do-recorte';
import type { Recorte } from '@/dominio/recorte';

describe('resumirRecorte — período', () => {
  it('sem período nenhum, não aparece no resumo', () => {
    expect(resumirRecorte({}, null)).toBe('Base completa, sem filtros');
  });

  it('só passado (preset)', () => {
    const recorte: Recorte = { periodoPassado: 'ultimos-30' };
    expect(resumirRecorte(recorte, null)).toBe('Últimos 30 dias');
  });

  it('só futuro (preset)', () => {
    const recorte: Recorte = { periodoFuturo: 'proximos-90' };
    expect(resumirRecorte(recorte, null)).toBe('Próximos 90 dias');
  });

  it('os dois juntos viram uma frase combinada', () => {
    const recorte: Recorte = { periodoPassado: 'ultimos-30', periodoFuturo: 'proximos-90' };
    expect(resumirRecorte(recorte, null)).toBe('Últimos 30 dias + Próximos 90 dias');
  });

  it('data customizada de um lado só', () => {
    const recorte: Recorte = { de: '2026-01-01' };
    expect(resumirRecorte(recorte, null)).toBe('desde 01/01/2026');
  });

  it('preset de um lado com data customizada do outro, combinados', () => {
    const recorte: Recorte = { periodoPassado: 'ultimos-30', ate: '2026-12-25' };
    expect(resumirRecorte(recorte, null)).toBe('Últimos 30 dias + até 25/12/2026');
  });
});

describe('fichasDoRecorte — período', () => {
  it('gera uma única ficha "periodo-inteiro" com os dois lados combinados', () => {
    const recorte: Recorte = { periodoPassado: 'ultimos-30', periodoFuturo: 'proximos-90' };
    const fichas = fichasDoRecorte(recorte, null);
    expect(fichas).toHaveLength(1);
    expect(fichas[0]).toEqual({
      campo: 'periodo-inteiro',
      rotulo: 'Últimos 30 dias + Próximos 90 dias',
    });
  });

  it('sem período, não gera ficha de período', () => {
    const fichas = fichasDoRecorte({}, null);
    expect(fichas).toHaveLength(0);
  });
});

describe('semOFiltro — período', () => {
  it('remove os quatro campos de período de uma vez', () => {
    const recorte: Recorte = {
      periodoPassado: 'ultimos-30',
      periodoFuturo: 'proximos-90',
      de: '2026-01-01',
      ate: '2026-12-31',
      frente: 'imprensa',
    };
    const resultado = semOFiltro(recorte, 'periodo-inteiro');
    expect(resultado).toEqual({ frente: 'imprensa' });
  });
});
