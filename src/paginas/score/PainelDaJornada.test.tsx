// @vitest-environment jsdom

/** A Jornada como bloco reutilizável: Visão geral (com "Comparar com") e lentes (sem). */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PainelDaJornada } from '@/paginas/score/PainelDaJornada';
import { fraseDaJanela, kpisDaJanela, serieDaLente } from '@/dominio/janelaDaJornada';
import type { PontoDaSerie } from '@/dominio/score';

const ponto = (mes: string, isr: number | null, notas: Record<string, number> = {}): PontoDaSerie =>
  ({
    mes, isr, lentes: 5, tem_estimativa: false, delta: null, fatos: [], sustentou: null,
    pressionou: null, pontos_sem_tema: 0, maior_movimento: null, notas_das_lentes: notas,
    temas_das_lentes: {},
  }) as PontoDaSerie;

const SERIE = [
  ponto('2026-01', 60, { imprensa: 40 }),
  ponto('2026-02', 70, { imprensa: 50 }),
  ponto('2026-03', 50, { imprensa: 45 }),
  ponto('2026-04', 64, { imprensa: 55 }),
];

describe('fraseDaJanela', () => {
  it('diz onde está, contra a média, o pico e o vale, e a variação', () => {
    const frase = fraseDaJanela(kpisDaJanela(SERIE));
    // média de 60, 70, 50, 64 = 61
    expect(frase).toBe(
      'O índice está em 64 em abril de 2026, 3 pontos acima da média da janela (61). ' +
        'O pico foi 70, em fevereiro de 2026, e o vale 50, em março de 2026. No período, subiu 4 pontos.',
    );
  });

  it('usa o sujeito pedido e diz "abaixo" e "caiu"', () => {
    const frase = fraseDaJanela(kpisDaJanela([ponto('2026-01', 70), ponto('2026-02', 60)]), 'A lente Imprensa');
    expect(frase).toMatch(/^A lente Imprensa está em 60 em fevereiro de 2026, 5 pontos abaixo da média da janela \(65\)\./);
    expect(frase).toMatch(/No período, caiu 10 pontos\.$/);
  });
});

describe('serieDaLente', () => {
  it('troca o ISR pela nota da lente e tira o que é do índice', () => {
    const daImprensa = serieDaLente([{ ...SERIE[0], lentes: 1, fatos: [{} as never] }], 'imprensa');
    expect(daImprensa[0]).toMatchObject({ isr: 40, lentes: 5, fatos: [] });
    expect(serieDaLente([ponto('2026-01', 60)], 'clientes')[0].isr).toBeNull();
  });
});

describe('PainelDaJornada', () => {
  it('na Visão geral mostra o "Comparar com", centralizado', () => {
    render(
      <PainelDaJornada
        titulo="Jornada do índice"
        sujeito="O índice"
        serie={SERIE}
        mes="2026-04"
        aoEscolherMes={() => {}}
        lentesParaComparar={[{ codigo: 'imprensa', nome: 'Imprensa' }]}
        dica="Clique num mês."
      />,
    );
    const rotulo = screen.getByText('Comparar com');
    expect((rotulo.parentElement as HTMLElement).style.justifyContent).toBe('center');
    expect(screen.getByText(/O índice está em 64/)).toBeTruthy();
  });

  it('na lente não há "Comparar com", e o cabeçalho fala da lente', () => {
    render(
      <PainelDaJornada
        titulo="Jornada da Imprensa"
        sujeito="A lente Imprensa"
        serie={serieDaLente(SERIE, 'imprensa')}
        mes="2026-04"
        aoEscolherMes={() => {}}
        dica="Clique num mês."
      />,
    );
    expect(screen.queryByText('Comparar com')).toBeNull();
    expect(screen.getByText(/A lente Imprensa está em 55/)).toBeTruthy();
  });
});

describe('índice geral pontilhado na Jornada da lente', () => {
  it('desenha o índice geral como curva pontilhada e põe na legenda', () => {
    const { container } = render(
      <PainelDaJornada
        titulo="Jornada da Imprensa"
        sujeito="A lente Imprensa"
        serie={serieDaLente(SERIE, 'imprensa')}
        mes="2026-04"
        aoEscolherMes={() => {}}
        comIndiceGeral
        dica="Clique num mês."
      />,
    );
    const curva = container.querySelector('[data-curva-da-lente="indice_geral"]');
    expect(curva?.getAttribute('stroke-dasharray')).toBe('1 5');
    expect(screen.getByText('Índice geral')).toBeTruthy();
  });
});
