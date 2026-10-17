/** `normalizarBusca`, agora no domínio.
 *
 *  Os três primeiros casos vieram de `seletores.test.ts`, de onde a função
 *  saiu. Os de baixo são novos, e cobrem o que a diferença entre as quatro
 *  normalizações do front depende: ela COLAPSA espaço interno, e as outras
 *  três não fazem a mesma coisa de propósito (ver o cabeçalho de `texto.ts`).
 */

import { describe, expect, it } from 'vitest';

import { normalizarBusca } from '@/dominio/texto';

describe('normalizarBusca', () => {
  it('minúsculas, sem acento, espaços colapsados', () => {
    expect(normalizarBusca('  Fiscalização   REGULATÓRIA ')).toBe('fiscalizacao regulatoria');
    expect(normalizarBusca('Águas do Rio')).toBe('aguas do rio');
    expect(normalizarBusca('Crédito\te\nrating')).toBe('credito e rating');
  });

  it('colapsa espaço INTERNO, e é nisto que ela difere da do cadastro', () => {
    /* `completar.normalizar` espelha a deduplicação do backend e NÃO colapsa
       espaço interno. Este caso é o que separa as duas — se alguém "unificar"
       as normalizações do front, ele quebra aqui, que é melhor do que a fila de
       duplicados passar a discordar do servidor em silêncio. */
    expect(normalizarBusca('Águas   do    Rio')).toBe('aguas do rio');
  });

  it('texto vazio e só espaço viram vazio, e não quebram', () => {
    expect(normalizarBusca('')).toBe('');
    expect(normalizarBusca('   \t\n ')).toBe('');
  });

  it('o ç perde a cedilha, que é diacrítico separável', () => {
    /* Não é óbvio: `ç` é uma letra em português, mas o NFD a separa em `c` +
       cedilha, e por isso "conciliacao" acha "conciliação". */
    expect(normalizarBusca('Conciliação')).toBe('conciliacao');
  });

  it('dígito, hífen e barra passam intactos', () => {
    /* A busca do Radar casa nome de veículo e de tema, que trazem os três. */
    expect(normalizarBusca('Tarifa 2026/27 — pós-revisão')).toBe('tarifa 2026/27 — pos-revisao');
  });
});
