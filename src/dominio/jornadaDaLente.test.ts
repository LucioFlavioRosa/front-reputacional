/** A jornada de uma lente — só o que é dela, e não repete o que
 *  `jornadaDoIndice.test.ts` já trava sobre faixas, curva e regras de
 *  espaço (esta função reaproveita a mesma matemática). */

import { describe, expect, it } from 'vitest';

import { jornadaDaLente } from '@/dominio/jornadaDaLente';
import type { PontoDaSerie } from '@/dominio/score';

function ponto(parcial: Partial<PontoDaSerie>): PontoDaSerie {
  return {
    mes: '2026-01',
    isr: 58,
    lentes: 5,
    tem_estimativa: false,
    delta: null,
    fatos: [],
    sustentou: null,
    pressionou: null,
    pontos_sem_tema: 0,
    maior_movimento: null,
    notas_das_lentes: {},
    temas_das_lentes: {},
    ...parcial,
  };
}

const SEMESTRE = [
  ponto({ mes: '2026-01', notas_das_lentes: { imprensa: 46 } }),
  ponto({ mes: '2026-02', notas_das_lentes: { imprensa: 42 } }),
  ponto({ mes: '2026-03', notas_das_lentes: { imprensa: 36 } }),
  ponto({ mes: '2026-04', notas_das_lentes: { imprensa: 45 } }),
  ponto({ mes: '2026-05', notas_das_lentes: { imprensa: 52 } }),
  ponto({ mes: '2026-06', notas_das_lentes: { imprensa: 58 } }),
];

describe('jornadaDaLente', () => {
  it('lê a nota da própria lente, e não o ISR do mês', () => {
    const jornada = jornadaDaLente(SEMESTRE, 'imprensa', 'Imprensa', '2026-06');
    expect(jornada.pontos.map((p) => p.isr)).toEqual([46, 42, 36, 45, 52, 58]);
  });

  it('ignora os meses em que a lente não mediu', () => {
    const comBuraco = [
      ponto({ mes: '2026-01', notas_das_lentes: {} }),
      ...SEMESTRE,
    ];
    const jornada = jornadaDaLente(comBuraco, 'imprensa', 'Imprensa', '2026-06');
    expect(jornada.pontos).toHaveLength(6);
  });

  it('resume o saldo do período, o vale e o pico, com o nome da lente', () => {
    const jornada = jornadaDaLente(SEMESTRE, 'imprensa', 'Imprensa', '2026-06');
    expect(jornada.resumo).toBe(
      'Imprensa fecha o período 12 pontos acima de janeiro. ' +
        'O vale foi março (36) e o pico, junho (58).',
    );
  });

  it('marca o mês selecionado no ponto e na coluna', () => {
    const jornada = jornadaDaLente(SEMESTRE, 'imprensa', 'Imprensa', '2026-04');
    expect(jornada.pontos.find((p) => p.selecionado)?.mes).toBe('2026-04');
    expect(jornada.colunas.filter((c) => c.selecionada)).toHaveLength(1);
  });

  it('sem temas_das_lentes no mês: linhas e semTema ficam vazios, igual tag e movimento', () => {
    const jornada = jornadaDaLente(SEMESTRE, 'imprensa', 'Imprensa', '2026-06');
    expect(jornada.pontos.every((p) => p.tag === '')).toBe(true);
    expect(jornada.colunas.every((c) => c.linhas.length === 0 && c.movimento === '' && c.semTema === '')).toBe(
      true,
    );
    expect(jornada.curvaDaLente).toBe('');
    expect(jornada.pontosDaLente).toEqual([]);
    expect(jornada.fimDaLente).toBeNull();
    expect(jornada.eixoRegidoPorParciais).toBe(false);
  });

  it('o que sustentou e o que pressionou a lente entram na coluna do mês', () => {
    const comTemas = SEMESTRE.map((p, i) =>
      i === 2
        ? {
            ...p,
            temas_das_lentes: {
              imprensa: {
                sustentou: {
                  tema: 'Transparência tarifária', lente: 'imprensa',
                  pontos: 9.1, efeito: 'sustenta', positivas: 40, negativas: 5,
                },
                pressionou: {
                  tema: 'Falha no abastecimento', lente: 'imprensa',
                  pontos: -3.2, efeito: 'pressiona', positivas: 2, negativas: 30,
                },
                pontos_sem_tema: -1.5,
              },
            },
          }
        : p,
    );
    const linhas = jornadaDaLente(comTemas, 'imprensa', 'Imprensa', '2026-06').colunas[2].linhas;

    expect(linhas.map((l) => l.texto)).toEqual(['Transparência tarifária', 'Falha no abastecimento']);
    expect(linhas.every((l) => l.origem === 'base')).toBe(true);
    expect(linhas[0].evidencia).toBe('+9,1 pt');
    expect(linhas[1].evidencia).toBe('−3,2 pt');
    expect(jornadaDaLente(comTemas, 'imprensa', 'Imprensa', '2026-06').colunas[2].semTema).toBe(
      '−1,5 pt sem tema',
    );
  });

  it('um lado só (sem o que pressionou, por exemplo) não inventa o outro', () => {
    const soSustentou = SEMESTRE.map((p, i) =>
      i === 2
        ? {
            ...p,
            temas_das_lentes: {
              imprensa: {
                sustentou: {
                  tema: 'Patrocínio', lente: 'imprensa',
                  pontos: 4.0, efeito: 'sustenta', positivas: 10, negativas: 0,
                },
                pressionou: null,
                pontos_sem_tema: 0,
              },
            },
          }
        : p,
    );
    const linhas = jornadaDaLente(soSustentou, 'imprensa', 'Imprensa', '2026-06').colunas[2].linhas;
    expect(linhas).toHaveLength(1);
    expect(linhas[0].texto).toBe('Patrocínio');
  });

  it('a primeira coluna é ponto de partida, as demais trazem a variação do mês', () => {
    const jornada = jornadaDaLente(SEMESTRE, 'imprensa', 'Imprensa', '2026-06');
    expect(jornada.colunas[0].variacao).toBe('ponto de partida');
    expect(jornada.colunas[1].variacao).toBe('−4 no mês');
    expect(jornada.colunas[3].variacao).toBe('+9 no mês');
  });

  it('a descrição do ponto diz o nome da lente e a faixa', () => {
    const jornada = jornadaDaLente(SEMESTRE, 'imprensa', 'Imprensa', '2026-06');
    expect(jornada.pontos[2].descricao).toBe('março: Imprensa 36, faixa Crítico');
  });

  it('um mês só não vira jornada para ler', () => {
    const umMes = [ponto({ mes: '2026-01', notas_das_lentes: { imprensa: 58 } })];
    const jornada = jornadaDaLente(umMes, 'imprensa', 'Imprensa', '2026-01');
    expect(jornada.resumo).toContain('ainda não há jornada');
    expect(jornada.pontos).toHaveLength(1);
  });

  it('série sem nenhum mês da lente não estoura', () => {
    const jornada = jornadaDaLente(
      [ponto({ mes: '2026-01', notas_das_lentes: {} })],
      'imprensa',
      'Imprensa',
      '2026-01',
    );
    expect(jornada.pontos).toEqual([]);
    expect(jornada.colunas).toEqual([]);
    expect(jornada.curva).toBe('');
  });

  it('série vazia não estoura', () => {
    const jornada = jornadaDaLente([], 'imprensa', 'Imprensa', '2026-01');
    expect(jornada.pontos).toEqual([]);
  });
});
