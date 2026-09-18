/** `rotuloDaSemanaComAno`: a data por extenso, inclusive quando a semana
 *  cruza o mês — é onde a matemática de calendário costuma errar.
 */

import { describe, expect, it } from 'vitest';
import { rotuloDaSemanaComAno, semanasDisponiveis } from '@/dominio/calendarioSemanal';
import type { Interacao } from '@/dominio/tipos';

describe('rotuloDaSemanaComAno', () => {
  it('semana inteira dentro do mesmo mês', () => {
    // 07/09/2026 é uma segunda-feira; a semana termina no domingo, 13/09.
    expect(rotuloDaSemanaComAno('2026-09-07')).toBe('07 a 13 de Setembro de 2026');
  });

  it('semana que cruza o mês mostra os dois meses', () => {
    // 31/08/2026 é segunda-feira; a semana termina no domingo, 06/09.
    expect(rotuloDaSemanaComAno('2026-08-31')).toBe('31 de Agosto a 06 de Setembro de 2026');
  });
});

describe('semanasDisponiveis', () => {
  const interacao = (data_interacao: string) => ({ data_interacao }) as Interacao;

  it('uma semana por chave, mais recente primeiro', () => {
    const semanas = semanasDisponiveis([
      interacao('2026-09-07'), // segunda-feira
      interacao('2026-09-10'), // mesma semana (quinta-feira)
      interacao('2026-09-14'), // semana seguinte
    ]);
    expect(semanas).toEqual(['2026-09-14', '2026-09-07']);
  });

  it('lista vazia sem nenhuma interação', () => {
    expect(semanasDisponiveis([])).toEqual([]);
  });
});
