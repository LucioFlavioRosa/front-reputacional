/** A jornada do índice — as regras que o desenho afirma.
 *
 *  TRÊS DELAS SÃO REGRAS DE ESPAÇO, e as três já quebraram no protótipo: a
 *  variação em linha própria, o nome da faixa fora do gráfico e o rótulo que
 *  só desce se couber. As duas primeiras são de layout e se conferem na tela;
 *  a terceira é aritmética, e está travada aqui.
 */

import { describe, expect, it } from 'vitest';

import {
  VB,
  curvaPor,
  dominioDe,
  jornadaDoIndice,
  mesPorExtenso,
  resumoDa,
} from '@/dominio/jornadaDoIndice';
import type { PontoDaSerie } from '@/dominio/score';

function ponto(parcial: Partial<PontoDaSerie>): PontoDaSerie {
  return {
    mes: '2026-01',
    isr: 58,
    lentes: 5,
    tem_estimativa: false,
    delta: null,
    fato: null,
    maior_movimento: null,
    notas_das_lentes: {},
    ...parcial,
  };
}

/** Uma série de seis meses, com o vale em março e o pico em junho. */
const SEMESTRE = [
  ponto({ mes: '2026-01', isr: 46 }),
  ponto({ mes: '2026-02', isr: 42, delta: -4 }),
  ponto({ mes: '2026-03', isr: 36, delta: -6 }),
  ponto({ mes: '2026-04', isr: 45, delta: 9 }),
  ponto({ mes: '2026-05', isr: 52, delta: 7 }),
  ponto({ mes: '2026-06', isr: 58, delta: 6 }),
];

describe('mesPorExtenso', () => {
  it('traduz a chave do mês', () => {
    expect(mesPorExtenso('2026-06')).toBe('junho');
    expect(mesPorExtenso('2026-01')).toBe('janeiro');
  });

  it('devolve a própria chave quando não reconhece', () => {
    expect(mesPorExtenso('estranho')).toBe('estranho');
  });
});

describe('dominioDe', () => {
  it('se ajusta aos valores, e não fica preso em 0–100', () => {
    // Uma série entre 36 e 58 numa escala de 0 a 100 vira uma linha quase reta
    // no meio do gráfico, e o degrau de quinze pontos some.
    const { piso, teto } = dominioDe([36, 58]);
    expect(piso).toBe(25);
    expect(teto).toBe(70);
  });

  it('garante uma amplitude mínima numa série estável', () => {
    // Com quatro meses entre 56 e 58, o domínio teria três pontos de altura e
    // um passo de um ponto ocuparia meio gráfico.
    const { piso, teto } = dominioDe([56, 58]);
    expect(teto - piso).toBeGreaterThanOrEqual(30);
  });

  it('não escapa de 0 nem de 100', () => {
    expect(dominioDe([2]).piso).toBe(0);
    expect(dominioDe([99]).teto).toBe(100);
  });

  it('sem valor nenhum devolve um intervalo utilizável', () => {
    const { piso, teto } = dominioDe([]);
    expect(teto).toBeGreaterThan(piso);
  });
});

describe('curvaPor', () => {
  it('começa no primeiro ponto e fecha no último', () => {
    const caminho = curvaPor([
      [0, 10],
      [50, 20],
      [100, 5],
    ]);
    expect(caminho.startsWith('M0.0 10.0')).toBe(true);
    expect(caminho.endsWith('100.0 5.0')).toBe(true);
  });

  it('PASSA pelos pontos, e não perto deles', () => {
    // Numa curva de índice, um traço que corta o canto entre dois meses
    // desenha um valor que nunca existiu.
    const caminho = curvaPor([
      [0, 10],
      [50, 20],
      [100, 5],
    ]);
    expect(caminho).toContain('50.0 20.0');
  });

  it('um ponto só não vira curva', () => {
    expect(curvaPor([[10, 10]])).toBe('M10.0 10.0');
  });

  it('sem ponto nenhum devolve caminho vazio', () => {
    expect(curvaPor([])).toBe('');
  });
});

describe('resumoDa', () => {
  it('diz o saldo do período, o vale e o pico', () => {
    expect(resumoDa(SEMESTRE)).toBe(
      'O índice fecha o período 12 pontos acima de janeiro. ' +
        'O vale foi março (36) e o pico, junho (58).',
    );
  });

  it('diz "abaixo" quando o índice caiu', () => {
    const caindo = [ponto({ mes: '2026-01', isr: 60 }), ponto({ mes: '2026-02', isr: 45 })];
    expect(resumoDa(caindo)).toContain('15 pontos abaixo de janeiro');
  });

  it('o singular de um ponto', () => {
    const quase = [ponto({ mes: '2026-01', isr: 57 }), ponto({ mes: '2026-02', isr: 58 })];
    expect(resumoDa(quase)).toContain('1 ponto acima');
  });

  it('a segunda metade some quando vale e pico caem no mesmo mês', () => {
    // "o vale foi junho (58) e o pico, junho (58)" é uma frase que só um
    // programa escreve.
    const parada = [ponto({ mes: '2026-01', isr: 58 }), ponto({ mes: '2026-02', isr: 58 })];
    expect(resumoDa(parada)).not.toContain('e o pico');
  });

  it('NÃO diz "semestre"', () => {
    // A série cresce a cada mês ingerido; uma frase que afirma seis meses
    // passa a mentir no sétimo.
    const ano = Array.from({ length: 12 }, (_, i) =>
      ponto({ mes: `2026-${String(i + 1).padStart(2, '0')}`, isr: 40 + i }),
    );
    expect(resumoDa(ano)).not.toContain('semestre');
    expect(resumoDa(ano)).toContain('o período');
  });

  it('com um mês só não há jornada para ler', () => {
    expect(resumoDa([ponto({})])).toContain('ainda não há jornada');
  });

  it('ignora os meses sem índice', () => {
    const comBuraco = [ponto({ mes: '2026-01', isr: null }), ...SEMESTRE];
    expect(resumoDa(comBuraco)).toContain('de janeiro');
  });
});

describe('jornadaDoIndice', () => {
  it('põe o ponto no centro da coluna do mês', () => {
    // É a única forma de ligar um ao outro: fora do centro, a terceira coluna
    // aponta para o segundo ponto.
    const jornada = jornadaDoIndice(SEMESTRE, '2026-06');
    expect(jornada.pontos[0].esquerda).toBeCloseTo((0.5 / 6) * 100, 5);
    expect(jornada.pontos[5].esquerda).toBeCloseTo((5.5 / 6) * 100, 5);
  });

  it('desenha só as faixas que cruzam o domínio', () => {
    // A série vive entre 36 e 58: Sólido e Referência não aparecem, porque
    // pintá-las afirmaria um território que a curva nunca visitou.
    const jornada = jornadaDoIndice(SEMESTRE, '2026-06');
    expect(jornada.faixas.map((faixa) => faixa.rotulo)).toEqual([
      'Crítico',
      'Atenção',
      'Estável',
    ]);
  });

  it('recorta a faixa no domínio, e não a desenha inteira', () => {
    const jornada = jornadaDoIndice(SEMESTRE, '2026-06');
    const somaDasAlturas = jornada.faixas.reduce((total, faixa) => total + faixa.altura, 0);
    expect(somaDasAlturas).toBeCloseTo(VB.altura - 14 - 34, 1);
  });

  it('o rótulo do pico vai para cima e o do vale, para baixo', () => {
    // O rótulo acompanha o relevo: abaixo de um pico ele cairia dentro da
    // própria curva.
    const vaiEVolta = [
      ponto({ mes: '2026-01', isr: 60 }),
      ponto({ mes: '2026-02', isr: 50 }),
      ponto({ mes: '2026-03', isr: 60 }),
    ];
    const jornada = jornadaDoIndice(vaiEVolta, '2026-01');
    expect(jornada.pontos[0].acima).toBe(true);
    expect(jornada.pontos[1].acima).toBe(false);
  });

  it('o vale que não cabe embaixo sobe, mesmo sendo vale', () => {
    // Março (36) é o fundo do semestre, e o rótulo dele encostaria na faixa
    // dos meses: a regra de espaço vence a do relevo.
    const jornada = jornadaDoIndice(SEMESTRE, '2026-06');
    expect(jornada.pontos[2].acima).toBe(true);
  });

  it('o rótulo NÃO desce quando não cabe antes do eixo', () => {
    // Embaixo do ponto há a faixa dos meses, e o rótulo passava por cima dela.
    // Um vale colado no piso do domínio é o caso que quebrava.
    const noPiso = [
      ponto({ mes: '2026-01', isr: 80 }),
      ponto({ mes: '2026-02', isr: 20 }),
      ponto({ mes: '2026-03', isr: 80 }),
    ];
    const fundo = jornadaDoIndice(noPiso, '2026-01').pontos[1];
    expect(fundo.acima).toBe(true);
  });

  it('o primeiro mês é ponto de partida, e não variação zero', () => {
    // "0 no mês" afirmaria que o índice não se moveu, e não há de onde.
    const jornada = jornadaDoIndice(SEMESTRE, '2026-06');
    expect(jornada.colunas[0].variacao).toBe('ponto de partida');
    expect(jornada.colunas[1].variacao).toBe('−4 no mês');
    expect(jornada.colunas[3].variacao).toBe('+9 no mês');
  });

  it('o mês sem fato tem filete neutro e texto padrão', () => {
    const jornada = jornadaDoIndice(SEMESTRE, '2026-06');
    expect(jornada.colunas[0].fato).toBe('Sem fato de destaque registrado.');
    expect(jornada.colunas[0].filete).toBe('var(--borda)');
    expect(jornada.pontos[0].tag).toBe('');
  });

  it('o mês com fato leva o filete do efeito e a tag no ponto', () => {
    const comFato = SEMESTRE.map((p, i) =>
      i === 2 ? { ...p, fato: { texto: 'Rebaixamentos de rating', efeito: 'pressiona' } } : p,
    );
    const jornada = jornadaDoIndice(comFato, '2026-06');
    expect(jornada.colunas[2].filete).toBe('var(--erro-fg)');
    expect(jornada.colunas[2].fato).toBe('Rebaixamentos de rating');
    expect(jornada.pontos[2].tag).toBe('pressão');
  });

  it('escreve o maior movimento do mês, com sinal', () => {
    const comMovimento = SEMESTRE.map((p, i) =>
      i === 3 ? { ...p, maior_movimento: { lente: 'Clientes', delta: -12 } } : p,
    );
    const jornada = jornadaDoIndice(comMovimento, '2026-06');
    expect(jornada.colunas[3].movimento).toBe('Maior movimento: Clientes −12');
    expect(jornada.colunas[0].movimento).toBe('');
  });

  it('marca o mês selecionado na coluna e no ponto', () => {
    const jornada = jornadaDoIndice(SEMESTRE, '2026-04');
    expect(jornada.colunas.filter((coluna) => coluna.selecionada)).toHaveLength(1);
    expect(jornada.pontos.find((p) => p.selecionado)?.mes).toBe('2026-04');
  });

  it('a descrição do ponto diz o mês, o índice e o fato', () => {
    const comFato = SEMESTRE.map((p, i) =>
      i === 2 ? { ...p, fato: { texto: 'Atraso das DFs', efeito: 'pressiona' } } : p,
    );
    const jornada = jornadaDoIndice(comFato, '2026-06');
    expect(jornada.pontos[2].descricao).toBe('março: índice 36. Atraso das DFs');
  });

  it('sem lente comparada não desenha a curva tracejada', () => {
    const jornada = jornadaDoIndice(SEMESTRE, '2026-06');
    expect(jornada.curvaDaLente).toBe('');
    expect(jornada.fimDaLente).toBeNull();
  });

  it('a lente comparada entra no domínio do eixo', () => {
    // Sem isso a curva tracejada sai do gráfico: a lente pode estar muito
    // acima ou abaixo do índice, e o eixo foi calculado só com o índice.
    const comLente = SEMESTRE.map((p, i) => ({
      ...p,
      notas_das_lentes: { imprensa: 70 + i },
    }));
    const jornada = jornadaDoIndice(comLente, '2026-06', 'imprensa');

    expect(jornada.curvaDaLente).not.toBe('');
    expect(jornada.pontosDaLente).toHaveLength(6);
    expect(jornada.fimDaLente?.texto).toBe('75');
    // O topo do eixo subiu para caber a lente.
    expect(jornada.faixas.map((f) => f.rotulo)).toContain('Sólido');
  });

  it('ignora a comparação quando algum mês não tem a lente', () => {
    // Uma curva com buracos mentiria sobre a continuidade da série.
    const incompleta = SEMESTRE.map((p, i) => ({
      ...p,
      notas_das_lentes: (i === 2 ? {} : { imprensa: 70 }) as Record<string, number>,
    }));
    expect(jornadaDoIndice(incompleta, '2026-06', 'imprensa').curvaDaLente).toBe('');
  });

  it('série vazia não estoura', () => {
    const jornada = jornadaDoIndice([], '2026-06');
    expect(jornada.pontos).toEqual([]);
    expect(jornada.colunas).toEqual([]);
    expect(jornada.curva).toBe('');
  });

  it('série só com meses sem índice não estoura', () => {
    const jornada = jornadaDoIndice([ponto({ isr: null })], '2026-06');
    expect(jornada.pontos).toEqual([]);
  });
});
