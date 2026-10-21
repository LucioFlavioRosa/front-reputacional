import { describe, expect, it } from 'vitest';

import {
  aproximar,
  corDaVariacao,
  dataPorExtensoCurto,
  descricaoLegivelDoBond,
  diasNaJanela,
  rotuloDaJanela,
  deslocar,
  escalaAutomatica,
  escalaDaFaixa,
  escalaDoScore,
  espalharEtiquetas,
  inicioDoPeriodo,
  passoRedondo,
  prender,
  resumoDoBond,
  rotuloDaMarca,
  rotulosDoTempo,
  segundaDaSemana,
  variacaoEmPontos,
} from './cotacoesDosBonds';

//: O CALENDÁRIO DOS TESTES: 12/10/2026 é segunda; 09/10 é sexta; 30/09 é quarta.
const p = (data: string, valor: number) => ({ data, valor });

describe('a semana', () => {
  it('a segunda-feira da semana, inclusive a partir do domingo', () => {
    expect(segundaDaSemana('2026-10-14')).toBe('2026-10-12');
    expect(segundaDaSemana('2026-10-12')).toBe('2026-10-12');
    expect(segundaDaSemana('2026-10-18')).toBe('2026-10-12');
  });
});

describe('as variações do card', () => {
  it('semanal contra o ÚLTIMO PREGÃO da semana anterior, mensal contra o do mês anterior', () => {
    const resumo = resumoDoBond([
      p('2026-09-29', 90),
      p('2026-09-30', 91),
      p('2026-10-08', 92),
      p('2026-10-09', 93),
      p('2026-10-13', 94.5),
    ]);
    expect(resumo?.ultimo).toEqual(p('2026-10-13', 94.5));
    expect(resumo?.baseSemanal?.data).toBe('2026-10-09');
    expect(resumo?.semanal).toBeCloseTo(1.5);
    expect(resumo?.baseMensal?.data).toBe('2026-09-30');
    expect(resumo?.mensal).toBeCloseTo(3.5);
  });

  it('SEMANA COM FERIADO: sexta sem pregão, a base é a quinta', () => {
    const resumo = resumoDoBond([p('2026-10-08', 92), p('2026-10-12', 93)]);
    expect(resumo?.baseSemanal?.data).toBe('2026-10-08');
    expect(resumo?.semanal).toBeCloseTo(1);
  });

  it('SEMANA ATUAL INCOMPLETA: na quarta, a base continua sendo a semana anterior', () => {
    const resumo = resumoDoBond([
      p('2026-10-09', 90),
      p('2026-10-12', 91),
      p('2026-10-13', 92),
      p('2026-10-14', 93),
    ]);
    expect(resumo?.baseSemanal?.data).toBe('2026-10-09');
    expect(resumo?.semanal).toBeCloseTo(3);
  });

  it('MÊS SEM PREGÃO NO ÚLTIMO DIA ÚTIL: a base é o último pregão que houve', () => {
    //: 30/09 (quarta, último dia útil) sem cotação: vale o 28/09.
    const resumo = resumoDoBond([p('2026-09-28', 88), p('2026-10-05', 90)]);
    expect(resumo?.baseMensal?.data).toBe('2026-09-28');
    expect(resumo?.mensal).toBeCloseTo(2);
  });

  it('sem pregão antes, a variação é null e não zero', () => {
    const resumo = resumoDoBond([p('2026-10-13', 94)]);
    expect(resumo?.semanal).toBeNull();
    expect(resumo?.mensal).toBeNull();
  });

  it('a ordem de chegada não importa, e série vazia não tem resumo', () => {
    expect(resumoDoBond([p('2026-10-13', 2), p('2026-10-09', 1)])?.ultimo.valor).toBe(2);
    expect(resumoDoBond([])).toBeNull();
  });

  it('o texto e a cor da variação seguem o valor ARREDONDADO', () => {
    expect(variacaoEmPontos(0.44)).toBe('+0,4');
    expect(variacaoEmPontos(-1.26)).toBe('−1,3');
    expect(variacaoEmPontos(0.04)).toBe('0,0');
    expect(corDaVariacao(0.04)).toBe('#44495C');
    expect(corDaVariacao(0.2)).toBe('#0A6B60');
    expect(corDaVariacao(-0.2)).toBe('#B32328');
  });

  it('NO YIELD É AO CONTRÁRIO: subir é custo de dívida maior para a Aegea', () => {
    expect(corDaVariacao(0.2, false)).toBe('#B32328');
    expect(corDaVariacao(-0.2, false)).toBe('#0A6B60');
    expect(corDaVariacao(0.04, false)).toBe('#44495C');
  });

  it('a descrição Bloomberg vira cupom e vencimento em português', () => {
    expect(descricaoLegivelDoBond('AEGEBZ 6 3/4 05/20/29')).toBe('Cupom 6,75% · vence em 20/05/2029');
    expect(descricaoLegivelDoBond('AEGEBZ 6 ¾ 05/20/29')).toBe('Cupom 6,75% · vence em 20/05/2029');
    expect(descricaoLegivelDoBond('AEGEBZ 9 01/20/31')).toBe('Cupom 9% · vence em 20/01/2031');
    expect(descricaoLegivelDoBond('AEGEBZ 7 7/8 01/20/36')).toBe('Cupom 7,875% · vence em 20/01/2036');
    expect(descricaoLegivelDoBond('qualquer coisa')).toBeNull();
    expect(descricaoLegivelDoBond(null)).toBeNull();
  });
});

describe('o período', () => {
  it('conta a partir do ÚLTIMO DADO, e não de hoje', () => {
    expect(inicioDoPeriodo('1M', '2026-09-21')).toBe('2026-08-21');
    expect(inicioDoPeriodo('6M', '2026-09-21')).toBe('2026-03-21');
    expect(inicioDoPeriodo('12M', '2026-09-21')).toBe('2025-09-21');
    expect(inicioDoPeriodo('ano', '2026-09-21')).toBe('2026-01-01');
    expect(inicioDoPeriodo('tudo', '2026-09-21')).toBeNull();
  });

  it('31 de março menos um mês é o fim de fevereiro', () => {
    expect(inicioDoPeriodo('1M', '2026-03-31')).toBe('2026-02-28');
  });
});

describe('as escalas', () => {
  it('o passo é sempre redondo', () => {
    expect(passoRedondo(19.5)).toBe(5);
    expect(passoRedondo(8)).toBe(2);
    expect(passoRedondo(12)).toBe(2.5);
    expect(passoRedondo(0.8)).toBe(0.2);
  });

  it('a escala do preço usa só os valores, com folga e pontas redondas', () => {
    //: Era 71,0 / 90,5 / 110,0 com a faixa fixa. Agora as marcas caem em
    //: números redondos e a faixa abraça os dados.
    const escala = escalaAutomatica([88.7, 97.4]);
    expect(escala).not.toBeNull();
    expect(escala!.minimo).toBeLessThanOrEqual(88.7);
    expect(escala!.maximo).toBeGreaterThanOrEqual(97.4);
    expect(escala!.maximo - escala!.minimo).toBeLessThan(15);
    for (const marca of escala!.marcas) expect((marca / escala!.passo) % 1).toBeCloseTo(0);
  });

  it('um valor só não divide por zero', () => {
    const escala = escalaAutomatica([95]);
    expect(escala!.maximo).toBeGreaterThan(escala!.minimo);
    expect(escalaAutomatica([])).toBeNull();
  });

  it('a do score anda de 10 em 10 e não sai de 0 a 100', () => {
    const escala = escalaDoScore([56, 71]);
    expect(escala.minimo % 10).toBe(0);
    expect(escala.maximo % 10).toBe(0);
    expect(escala.minimo).toBeGreaterThanOrEqual(0);
    expect(escala.maximo).toBeLessThanOrEqual(100);
    expect(escalaDoScore([2, 98])).toMatchObject({ minimo: 0, maximo: 100 });
    expect(escalaDoScore([]).maximo).toBe(100);
  });

  it('o score parado não ocupa o gráfico inteiro: amplitude mínima de 20', () => {
    const escala = escalaDoScore([62]);
    expect(escala.maximo - escala.minimo).toBeGreaterThanOrEqual(20);
  });

  it('o rótulo da marca é pt-BR, com as casas do passo', () => {
    expect(rotuloDaMarca(92.5, 2.5)).toBe('92,5');
    expect(rotuloDaMarca(90, 5)).toBe('90');
    expect(rotuloDaMarca(-1, 1)).toBe('−1');
  });
});

describe('o zoom à mão (think-cell)', () => {
  it('aproximar encolhe em volta do centro, afastar alarga', () => {
    expect(aproximar({ minimo: 80, maximo: 100 }, 0.5)).toEqual({ minimo: 85, maximo: 95 });
    expect(aproximar({ minimo: 80, maximo: 100 }, 2)).toEqual({ minimo: 70, maximo: 110 });
    //: Em volta do PONTO DO MOUSE, que fica parado na tela.
    expect(aproximar({ minimo: 80, maximo: 100 }, 0.5, 80)).toEqual({ minimo: 80, maximo: 90 });
  });

  it('deslocar move a faixa inteira, e prender a mantém dentro de 0 a 100', () => {
    expect(deslocar({ minimo: 80, maximo: 100 }, 5)).toEqual({ minimo: 85, maximo: 105 });
    expect(prender({ minimo: 90, maximo: 110 }, 0, 100)).toEqual({ minimo: 80, maximo: 100 });
    expect(prender({ minimo: -20, maximo: 200 }, 0, 100)).toEqual({ minimo: 0, maximo: 100 });
  });

  it('a faixa escolhida fica EXATA; só as marcas são redondas', () => {
    const escala = escalaDaFaixa({ minimo: 87.3, maximo: 93.9 });
    expect(escala.minimo).toBe(87.3);
    expect(escala.maximo).toBe(93.9);
    expect(escala.marcas[0]).toBeGreaterThanOrEqual(87.3);
    expect(escala.marcas.at(-1)).toBeLessThanOrEqual(93.9);
  });
});

describe('o eixo do tempo', () => {
  const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

  it('até dois meses, o rótulo é o DIA', () => {
    const rotulos = rotulosDoTempo(ms('2026-08-21'), ms('2026-09-21'));
    expect(rotulos[0].texto).toBe('21/08');
    expect(rotulos.every((r) => !r.mensal)).toBe(true);
    expect(rotulos.length).toBeLessThanOrEqual(8);
  });

  it('acima de dois meses, o rótulo é o MÊS, só dentro do período', () => {
    const rotulos = rotulosDoTempo(ms('2026-03-21'), ms('2026-09-21'));
    expect(rotulos.map((r) => r.texto)).toEqual([
      'abr/26',
      'mai/26',
      'jun/26',
      'jul/26',
      'ago/26',
      'set/26',
    ]);
  });

  it('anos inteiros saltam meses para caber', () => {
    const rotulos = rotulosDoTempo(ms('2022-04-29'), ms('2026-09-21'));
    expect(rotulos.length).toBeLessThanOrEqual(8);
    expect(rotulos.every((r) => r.mensal)).toBe(true);
  });

  it('a data do hover por extenso curto', () => {
    expect(dataPorExtensoCurto('2026-08-06')).toBe('qui, 06/08/2026');
  });
});

describe('as etiquetas da borda', () => {
  it('etiquetas próximas se afastam sem trocar de ordem', () => {
    const ys = espalharEtiquetas([100, 104, 300], 16, 0, 400);
    expect(ys[1] - ys[0]).toBeGreaterThanOrEqual(16);
    expect(ys[2]).toBe(300);
  });

  it('não passam da base', () => {
    const ys = espalharEtiquetas([395, 398], 16, 0, 400);
    expect(Math.max(...ys)).toBeLessThanOrEqual(400);
    expect(ys[1] - ys[0]).toBeGreaterThanOrEqual(16);
  });
});

describe('a janela do navegador', () => {
  it('o texto do intervalo: dias até dois meses, meses acima', () => {
    expect(rotuloDaJanela('2026-08-21', '2026-09-21')).toBe('21/08 a 21/09 · 32 dias');
    expect(rotuloDaJanela('2026-03-21', '2026-09-21')).toBe('mar/26 a set/26 · 6 meses');
  });

  it('os dias da janela contam as duas pontas', () => {
    expect(diasNaJanela('2026-05-06', '2026-05-20')).toBe(15);
  });

});
