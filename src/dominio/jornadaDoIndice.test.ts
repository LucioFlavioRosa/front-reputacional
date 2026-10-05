/** A jornada do índice — as regras que o desenho afirma.
 *
 *  TRÊS DELAS SÃO REGRAS DE ESPAÇO, e as três já quebraram no protótipo: a
 *  variação em linha própria, o nome da faixa fora do gráfico e o rótulo que
 *  só desce se couber. As duas primeiras são de layout e se conferem na tela;
 *  a terceira é aritmética, e está travada aqui.
 */

import { describe, expect, it } from 'vitest';

import {
  FOLGA_NO_LIMITE,
  PAD_TOPO,
  VB,
  curvaPor,
  dominioDe,
  coberturaDoMes,
  fraseDosParciais,
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

  it('os controles da Bézier saem da tangente do vizinho', () => {
    // As asserções de início e fim passariam com QUALQUER fórmula que emitisse
    // um C por trecho. O que faz a curva ser suave, e não um zigue-zague
    // arredondado, é o controle sair a um sexto da distância entre os vizinhos
    // do ponto — e é isso que este teste trava.
    const caminho = curvaPor([
      [0, 0],
      [60, 0],
      [120, 0],
    ]);
    // Numa reta horizontal todo controle fica na mesma altura, e a distância
    // dele sai da DIFERENÇA ENTRE OS VIZINHOS do ponto — por isso o controle
    // que olha para um extremo espelhado (10 de 60) é mais curto que o que
    // olha para dois vizinhos reais (20 de 120).
    expect(caminho).toBe('M0.0 0.0C10.0 0.0 40.0 0.0 60.0 0.0C80.0 0.0 110.0 0.0 120.0 0.0');
  });

  it('a ponta repete o próprio ponto, e não inventa um vizinho', () => {
    // Sem vizinho de fora, o Catmull-Rom espelha a ponta. Inventar um ponto
    // além dela faria a curva sair da tela antes do primeiro mês.
    const caminho = curvaPor([
      [0, 100],
      [60, 0],
    ]);
    expect(caminho).toBe('M0.0 100.0C10.0 83.3 50.0 16.7 60.0 0.0');
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

  it('as pontas seguem a MESMA regra do meio, com um vizinho só', () => {
    // O protótipo compara o primeiro ponto com o sinal trocado em relação ao
    // último: lá, um primeiro ponto mais ALTO que o vizinho manda o rótulo para
    // baixo, para dentro da curva que desce. Aqui, mais alto sobe — nas duas
    // pontas, como no meio.
    const comeceAlto = [
      ponto({ mes: '2026-01', isr: 65 }),
      ponto({ mes: '2026-02', isr: 55 }),
      ponto({ mes: '2026-03', isr: 60 }),
    ];
    expect(jornadaDoIndice(comeceAlto, '2026-01').pontos[0].acima).toBe(true);

    const comeceBaixo = [
      ponto({ mes: '2026-01', isr: 55 }),
      ponto({ mes: '2026-02', isr: 65 }),
      ponto({ mes: '2026-03', isr: 60 }),
    ];
    expect(jornadaDoIndice(comeceBaixo, '2026-01').pontos[0].acima).toBe(false);

    // E a última ponta, espelhada.
    const termineBaixo = [
      ponto({ mes: '2026-01', isr: 60 }),
      ponto({ mes: '2026-02', isr: 65 }),
      ponto({ mes: '2026-03', isr: 55 }),
    ];
    expect(jornadaDoIndice(termineBaixo, '2026-01').pontos[2].acima).toBe(false);
  });

  it('a descrição diz a faixa, e não só o número', () => {
    // A §6 pede mês, índice, faixa e fato: quem ouve a tela não vê a cor que
    // diria em que território aquele 36 caiu.
    const jornada = jornadaDoIndice(SEMESTRE, '2026-06');
    expect(jornada.pontos[5].descricao).toContain('faixa Estável');
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

  it('o mês sem fato nem tema tem filete neutro e texto padrão', () => {
    const jornada = jornadaDoIndice(SEMESTRE, '2026-06');
    // VAZIA É VAZIA: a ausência de comentário já se vê, e uma frase dizendo
    // isso em dez colunas ocupa o lugar do que importa.
    expect(jornada.colunas[0].linhas).toEqual([]);
    expect(jornada.colunas[0].filete).toBe('var(--borda)');
    expect(jornada.pontos[0].tag).toBe('');
  });

  it('o mês com fato leva o filete do efeito e a tag no ponto', () => {
    const comFato = SEMESTRE.map((p, i) =>
      i === 2
        ? {
            ...p,
            fatos: [
              { id: '1', texto: 'Rebaixamentos de rating', efeito: 'pressiona' },
            ],
          }
        : p,
    );
    const jornada = jornadaDoIndice(comFato, '2026-06');
    expect(jornada.colunas[2].filete).toBe('var(--erro-fg)');
    expect(jornada.colunas[2].linhas[0].texto).toBe('Rebaixamentos de rating');
    expect(jornada.pontos[2].tag).toBe('pressão');
  });

  it('TODOS os fatos do mês entram na coluna', () => {
    // Escolher um faria o segundo motivo sumir do painel, e é justamente o
    // segundo que costuma explicar o resto do degrau.
    const comDois = SEMESTRE.map((p, i) =>
      i === 2
        ? {
            ...p,
            fatos: [
              { id: '1', texto: 'Atraso das DFs', efeito: 'pressiona' },
              { id: '2', texto: 'Aporte anunciado', efeito: 'sustenta' },
            ],
          }
        : p,
    );
    const linhas = jornadaDoIndice(comDois, '2026-06').colunas[2].linhas;
    expect(linhas.map((l) => l.texto)).toEqual(['Atraso das DFs', 'Aporte anunciado']);
    // O FILETE SEGUE O PRIMEIRO: o destaque do mês não pode mudar quando
    // alguém acrescenta uma nota de rodapé depois.
    expect(jornadaDoIndice(comDois, '2026-06').colunas[2].filete).toBe('var(--erro-fg)');
  });

  it('o tema derivado entra junto, marcado como da base', () => {
    const comAssunto = SEMESTRE.map((p, i) =>
      i === 2
        ? {
            ...p,
            fatos: [{ id: '1', texto: 'Atraso das DFs', efeito: 'pressiona' }],
            pressionou: {
              tema: 'Saneamento básico',
              lente: 'sociedade',
              pontos: -1.9,
              efeito: 'pressiona',
              positivas: 125,
              negativas: 759,
            },
          }
        : p,
    );
    const linhas = jornadaDoIndice(comAssunto, '2026-06').colunas[2].linhas;

    // O fato primeiro — é o que alguém achou digno de registrar.
    expect(linhas.map((l) => l.origem)).toEqual(['cadastro', 'base']);
    expect(linhas[1].texto).toBe('Saneamento básico');
    // E o tema traz o número; o fato não tem número a trazer.
    expect(linhas[1].evidencia).toBe('−1,9 pt');
    expect(linhas[0].evidencia).toBe('');
  });

  it('o que nenhum tema explica é dito, e não calado', () => {
    // Mostrar os temas e calar sobre o pedaço que sobra faria a coluna
    // afirmar mais do que sabe.
    const comLacuna = SEMESTRE.map((p, i) =>
      i === 2 ? { ...p, pontos_sem_tema: -1.5 } : p,
    );
    expect(jornadaDoIndice(comLacuna, '2026-06').colunas[2].semTema).toBe(
      '−1,5 pt sem tema',
    );
    expect(jornadaDoIndice(SEMESTRE, '2026-06').colunas[2].semTema).toBe('');
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
      i === 2
        ? { ...p, fatos: [{ id: '1', texto: 'Atraso das DFs', efeito: 'pressiona' }] }
        : p,
    );
    const jornada = jornadaDoIndice(comFato, '2026-06');
    expect(jornada.pontos[2].descricao).toBe(
      'março: índice 36, faixa Crítico. Atraso das DFs',
    );
    // E o mês sem comentário não anuncia a falta dele.
    expect(jornada.pontos[0].descricao).toBe('janeiro: índice 46, faixa Atenção');
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

  it('desenha a lente nos meses que ela tem, e não exige a série inteira', () => {
    // EXIGIR TODOS OS MESES era um erro mudo: na base real só a institucional
    // cobre o período inteiro, e selecionar qualquer outra lente não desenhava
    // nada — sem dizer por quê.
    const soNoMeio = SEMESTRE.map((p, i) => ({
      ...p,
      notas_das_lentes: (i >= 1 && i <= 4 ? { imprensa: 70 + i } : {}) as Record<
        string,
        number
      >,
    }));
    const jornada = jornadaDoIndice(soNoMeio, '2026-06', 'imprensa');

    expect(jornada.curvaDaLente).not.toBe('');
    expect(jornada.pontosDaLente).toHaveLength(4);
    // O último ponto da lente é o de maio, e não o de junho.
    expect(jornada.fimDaLente?.texto).toBe('74');
  });

  it('a lente fica no x do mês dela, e não no começo do gráfico', () => {
    // Uma curva que começa depois precisa começar NO MÊS em que a medição
    // começou; empurrá-la para a esquerda alinharia a lente com o mês errado.
    const soNoFim = SEMESTRE.map((p, i) => ({
      ...p,
      notas_das_lentes: (i >= 4 ? { imprensa: 70 } : {}) as Record<string, number>,
    }));
    const jornada = jornadaDoIndice(soNoFim, '2026-06', 'imprensa');
    const doIndice = jornada.pontos[4];

    expect(jornada.pontosDaLente[0].cx).toBeCloseTo(doIndice.cx, 5);
  });

  it('um mês só de lente não vira curva', () => {
    // O traço seria um ponto solto que ninguém liga a lente nenhuma.
    const umMes = SEMESTRE.map((p, i) => ({
      ...p,
      notas_das_lentes: (i === 3 ? { imprensa: 70 } : {}) as Record<string, number>,
    }));
    expect(jornadaDoIndice(umMes, '2026-06', 'imprensa').curvaDaLente).toBe('');
  });

  it('a lente entra no domínio mesmo cobrindo poucos meses', () => {
    const alta = SEMESTRE.map((p, i) => ({
      ...p,
      notas_das_lentes: (i >= 4 ? { imprensa: 92 } : {}) as Record<string, number>,
    }));
    const jornada = jornadaDoIndice(alta, '2026-06', 'imprensa');
    expect(jornada.faixas.map((f) => f.rotulo)).toContain('Referência');
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

/* -- o mês parcial diz o que é ------------------------------------------------
 *
 * NENHUMA DESTAS REGRAS TINHA TESTE. O fixture `ponto()` sempre disse cinco
 * lentes, então `parcial`, `foraDaEscala`, a exclusão do eixo e o que acontece
 * quando TODOS os meses são parciais nunca foram exercitados — justamente as
 * regras que a reescrita do gráfico introduziu.
 *
 * E o que está em jogo é concreto: no banco de desenvolvimento, quatro dos dez
 * pontos da curva vêm de UMA lente, e janeiro de 2025 sai como ISR 100, faixa
 * "Referência", a partir de uma única reunião de CRM registrada naquele mês. */

/** Seis meses completos entre 55 e 70 — domínio 45..80 por `dominioDe`. */
const COMPLETOS = [
  ponto({ mes: '2026-01', isr: 55 }),
  ponto({ mes: '2026-02', isr: 58 }),
  ponto({ mes: '2026-03', isr: 60 }),
  ponto({ mes: '2026-04', isr: 62 }),
  ponto({ mes: '2026-05', isr: 65 }),
  ponto({ mes: '2026-06', isr: 70 }),
];

describe('coberturaDoMes', () => {
  it('nomeia quantas lentes mediram, quando foram poucas', () => {
    expect(coberturaDoMes(1)).toBe('1 de 5 lentes');
    expect(coberturaDoMes(3)).toBe('3 de 5 lentes');
  });

  it('cala quando o mês é comparável', () => {
    // Quatro já é comparável — é o corte de `LENTES_PARA_SER_COMPLETO`. Um
    // rótulo em todo mês vira ruído e deixa de avisar.
    expect(coberturaDoMes(4)).toBe('');
    expect(coberturaDoMes(5)).toBe('');
  });

  it('é a MESMA frase que o ponto da curva carrega', () => {
    // O QUE ESTE TESTE TRAVA: duas telas dizendo a mesma coisa com palavras
    // diferentes, ou com cortes diferentes. A Visão geral e a Jornada mostram o
    // mesmo mês; se uma chamá-lo de parcial e a outra não, quem lê as duas
    // conclui que uma delas está errada — e estará.
    const serie = [ponto({ mes: '2026-01', isr: 80, lentes: 2 })];
    const unico = jornadaDoIndice(serie, '2026-01', null).pontos[0];

    expect(unico.cobertura).toBe(coberturaDoMes(2));
  });
});

/* -- POR QUE OITO TESTES SAÍRAM DAQUI ----------------------------------------
 *
 * Eles travavam a decisão ANTERIOR do dono do produto: o eixo regido só pelos
 * meses comparáveis, o mês de poucas lentes preso à borda quando não cabia, e a
 * tela avisando que ele estava "fora da escala". Cada um deles passava, e cada um
 * descrevia um comportamento que ele pediu para inverter depois de ver a tela:
 * "preciso que a escala em y seja mais dinâmica para não ter pontos fantasmas
 * como é hoje".
 *
 * O QUE ESTÁ NO LUGAR DELES é o bloco "o eixo acompanha todo ponto desenhado",
 * no fim do arquivo. Não é teste a menos: são as mesmas regras com o sinal
 * trocado — teto que sobe até o parcial, ponto sempre no seu valor, e o aviso de
 * cobertura preservado, que é a parte da decisão antiga que continua valendo.
 *
 * O CONCEITO DE "FORA DA ESCALA" DEIXOU DE EXISTIR no código, e é por isso que
 * os testes dele não foram reescritos: com o eixo acompanhando todo ponto, não há
 * ponto fora para marcar. `eixoRegidoPorParciais` saiu pelo mesmo motivo — ele
 * distinguia quem regia o eixo, e agora todos regem.
 */

describe('o mês medido por poucas lentes', () => {
  it('diz quantas lentes o mediram, para ler junto do número', () => {
    // A decisão do dono do produto: o número aparece, com o rótulo ao lado.
    // Sem ele, 100 se lê como "Referência: reputação é ativo de valor".
    const serie = [...COMPLETOS, ponto({ mes: '2026-07', isr: 100, lentes: 1 })];

    const julho = jornadaDoIndice(serie, '2026-07', null).pontos.at(-1);

    expect(julho?.cobertura).toBe('1 de 5 lentes');
  });

  it('o mês completo não carrega rótulo nenhum', () => {
    // O contrapeso: um rótulo em todo mês vira ruído e deixa de avisar.
    const junho = jornadaDoIndice(COMPLETOS, '2026-06', null).pontos.at(-1);

    expect(junho?.cobertura).toBe('');
  });
});

/* O bloco "o ponto que sai do eixo" morava aqui, e saiu inteiro: não existe mais
 * ponto que saia do eixo. Ver o registro acima e o bloco novo no fim do arquivo. */

describe('fraseDosParciais', () => {
  /** ELA TINHA TRÊS RAMOS E FICOU COM UM, e os outros dois morreram com o
   *  conceito e não por simplificação: a frase também contava quantos meses
   *  estavam "fora da escala do eixo", e avisava quando os parciais REGIAM o
   *  eixo por não haver mês completo. Com o eixo acompanhando todo ponto
   *  desenhado, nenhum mês fica fora dele e todos o regem — as duas frases
   *  passariam a afirmar coisas que não existem mais. */

  it('conta quantos meses o número descreve menos do que parece', () => {
    expect(fraseDosParciais(3)).toBe('3 meses medidos por menos de 4 lentes');
  });

  it('no singular, concorda', () => {
    expect(fraseDosParciais(1)).toBe('1 mês medido por menos de 4 lentes');
  });

  it('sem mês parcial nenhum, não há frase', () => {
    expect(fraseDosParciais(0)).toBe('');
  });
});

/* -- a escala acompanha todos os pontos, e os rótulos não pulam --------------
 *
 * O PEDIDO DO DONO DO PRODUTO, depois de olhar a Jornada: "o gráfico está fixo e
 * tem pontos fora do gráfico (...) preciso que a escala em y seja mais dinâmica
 * para não ter pontos fantasmas como é hoje, e tenha transições suaves e
 * estáveis mês a mês".
 *
 * ELE INVERTEU UMA DECISÃO DELE MESMO, e sabendo o preço: antes o eixo ignorava
 * os meses de poucas lentes para um janeiro de 100 não achatar o ano, e o efeito
 * colateral era o ponto preso na borda — o "fantasma". Perguntei com as três
 * opções na mesa, e ele escolheu o eixo que acompanha todo ponto desenhado.
 */

describe('o eixo acompanha todo ponto desenhado', () => {
  it('o teto sobe até o mês de poucas lentes, em vez de deixá-lo fora', () => {
    const serie = [...COMPLETOS, ponto({ mes: '2026-07', isr: 100, lentes: 1 })];

    const { marcas, pontos } = jornadaDoIndice(serie, '2026-06', null);

    //: O ponto de 100 passa a reger o teto junto com os outros.
    expect(Math.max(...marcas.map((m) => m.valor))).toBe(100);
    //: E O QUE ISSO COMPRA: nenhum ponto preso na borda, em nenhuma série.
    expect(pontos.every((p) => p.cy >= 0 && p.cy <= VB.altura)).toBe(true);
  });

  it('o ponto desenhado está SEMPRE no seu valor, nunca encostado na borda', () => {
    //: O QUE ERA O FANTASMA: `topo` era cortado na faixa, então o ponto aparecia
    //: encostado na borda de cima dizendo um valor que não era o dele. Agora o
    //: `topo` é o lugar do valor, sempre.
    const serie = [...COMPLETOS, ponto({ mes: '2026-07', isr: 100, lentes: 1 })];

    const { pontos } = jornadaDoIndice(serie, '2026-06', null);

    for (const p of pontos) {
      expect(p.topo).toBeCloseTo((p.cy / VB.altura) * 100, 6);
    }
  });

  it('o mês de poucas lentes continua dizendo que é parcial', () => {
    //: A escala mudou; o aviso não. Quem lê 100 precisa saber que veio de uma
    //: lente — é a decisão anterior do dono do produto, e ela continua valendo.
    const serie = [...COMPLETOS, ponto({ mes: '2026-07', isr: 100, lentes: 1 })];

    const julho = jornadaDoIndice(serie, '2026-06', null).pontos.at(-1);

    expect(julho?.parcial).toBe(true);
    expect(julho?.cobertura).toBe('1 de 5 lentes');
  });
});

describe('os rótulos não pulam de lado', () => {
  it('um mês NOVO no fim não troca o lado dos rótulos que já existiam', () => {
    /** "AS JANELAS COM PONTOS MAIS RELEVANTES ESTÃO PULANDO MUITO QUANDO
     *  PASSAMOS DE UM MÊS PARA O OUTRO" — é este teste.
     *
     *  A CAUSA: o lado de cada rótulo saía da comparação com a MÉDIA DOS DOIS
     *  VIZINHOS, e o último ponto da série usava a regra de ponta. Quando o mês
     *  seguinte entrava na base, o que era ponta ganhava um vizinho à direita,
     *  a média mudava, e o rótulo saltava de cima para baixo — junto com todos
     *  os outros que estavam perto do empate. */
    const antes = jornadaDoIndice(SEMESTRE, '2026-06', null);
    const depois = jornadaDoIndice(
      [...SEMESTRE, ponto({ mes: '2026-07', isr: 54, delta: -4 })],
      '2026-07',
      null,
    );

    const ladosAntes = antes.pontos.map((p) => p.acima);
    const ladosDepois = depois.pontos.slice(0, antes.pontos.length).map((p) => p.acima);

    expect(ladosDepois).toEqual(ladosAntes);
  });

  it('o relevo de verdade continua mandando: o pico sobe, o vale desce', () => {
    //: O CONTRAPESO. Estabilidade não pode virar "todos do mesmo lado sempre" —
    //: aí o rótulo do vale cairia dentro da curva que sobe, que é o que a regra
    //: do relevo existe para evitar.
    //: UMA SÉRIE COM O VALE NO MEIO DO EIXO, de propósito: no `SEMESTRE` o vale
    //: é 36 e encosta na base, então ele sobe por não CABER embaixo — regra
    //: antiga e legítima (ver "o vale que não cabe embaixo sobe"). Para medir o
    //: relevo é preciso um vale que tenha espaço dos dois lados.
    const comVale = [
      ponto({ mes: '2026-01', isr: 50 }),
      ponto({ mes: '2026-02', isr: 45 }),
      ponto({ mes: '2026-03', isr: 40 }),
      ponto({ mes: '2026-04', isr: 45 }),
      ponto({ mes: '2026-05', isr: 50 }),
      ponto({ mes: '2026-06', isr: 55 }),
    ];

    const { pontos } = jornadaDoIndice(comVale, '2026-06', null);
    const porMes = Object.fromEntries(pontos.map((p) => [p.mes, p]));

    expect(porMes['2026-03'].acima).toBe(false);
    expect(porMes['2026-06'].acima).toBe(true);
  });

  it('um degrau pequeno NÃO troca o lado, só um relevo que se enxerga', () => {
    //: Uma série que oscila um ponto para cada lado não tem relevo nenhum: com
    //: a regra antiga, cada mês alternava o lado do rótulo e a leitura virava
    //: um zigue-zague de etiquetas.
    const serrote = [
      ponto({ mes: '2026-01', isr: 50 }),
      ponto({ mes: '2026-02', isr: 51 }),
      ponto({ mes: '2026-03', isr: 50 }),
      ponto({ mes: '2026-04', isr: 51 }),
      ponto({ mes: '2026-05', isr: 50 }),
      ponto({ mes: '2026-06', isr: 51 }),
    ];

    const lados = jornadaDoIndice(serrote, '2026-06', null).pontos.map((p) => p.acima);

    expect(new Set(lados).size).toBe(1);
  });
});

describe('quando o eixo bate em 0 ou em 100', () => {
  /** O PEDIDO: "a faixa, se bater 0 ou 100, deve ter um extra".
   *
   *  POR QUE ELE PRECISA DISSO: o índice não passa de 100 nem desce de 0, então
   *  `dominioDe` para ali — e um mês de 100 fica com o ponto exatamente na borda
   *  de cima da área desenhada, metade da bolinha fora, a tag colada no topo do
   *  cartão. O mesmo embaixo, com o zero.
   *
   *  A FOLGA É DE DESENHO, E NÃO DE ESCALA, e a diferença é o que impede um
   *  engano: esticar o eixo até 105 escreveria no gráfico um valor de índice que
   *  não existe. O eixo continua terminando em 100; o que ganha ar é o espaço
   *  entre a última marca e a borda. */

  const noTeto = [
    ponto({ mes: '2026-01', isr: 90 }),
    ponto({ mes: '2026-02', isr: 95 }),
    ponto({ mes: '2026-03', isr: 100 }),
  ];
  const noPiso = [
    ponto({ mes: '2026-01', isr: 10 }),
    ponto({ mes: '2026-02', isr: 5 }),
    ponto({ mes: '2026-03', isr: 0 }),
  ];

  it('o eixo continua terminando em 100 — a folga não inventa índice', () => {
    const { marcas } = jornadaDoIndice(noTeto, '2026-03', null);

    expect(Math.max(...marcas.map((m) => m.valor))).toBe(100);
  });

  it('o ponto de 100 ganha ar acima dele, em vez de encostar na borda', () => {
    const encostado = jornadaDoIndice(noTeto, '2026-03', null).pontos.at(-1);

    //: O AR MEDIDO CONTRA A BORDA: sem a folga, o valor igual ao teto cai em
    //: `PAD_TOPO` — a bolinha de 8px fica metade para fora do desenho.
    expect(encostado!.cy).toBeCloseTo(PAD_TOPO + FOLGA_NO_LIMITE, 6);
  });

  it('a série que NÃO encosta no limite não ganha folga nenhuma', () => {
    //: O CONTRAPESO, e ele importa: a folga existe para o caso em que o índice
    //: acabou e `dominioDe` não teve onde pôr a folga dele. Numa série que vive
    //: longe das pontas, dar o mesmo ar seria desperdiçar altura de desenho —
    //: aqui o valor do teto cai exatamente em `PAD_TOPO`, como sempre caiu.
    const longe = [
      ponto({ mes: '2026-01', isr: 60 }),
      ponto({ mes: '2026-02', isr: 70 }),
      ponto({ mes: '2026-03', isr: 80 }),
    ];

    const { marcas } = jornadaDoIndice(longe, '2026-03', null);
    const doTeto = marcas.reduce((alta, m) => (m.valor > alta.valor ? m : alta));

    expect(doTeto.valor).toBe(90);
    expect(doTeto.topo).toBeCloseTo((PAD_TOPO / VB.altura) * 100, 6);
  });

  it('o ponto de 0 ganha ar abaixo dele', () => {
    const encostado = jornadaDoIndice(noPiso, '2026-03', null).pontos.at(-1);

    expect(encostado!.cy).toBeLessThanOrEqual(VB.altura - 8);
  });

  it('a faixa de fundo acompanha a folga, e não vaza por cima dela', () => {
    //: SE A FAIXA NÃO ACOMPANHA, o ar vira um defeito visível: uma tira colorida
    //: terminando antes do ponto mais alto, ou passando por cima da folga.
    const { faixas, pontos } = jornadaDoIndice(noTeto, '2026-03', null);
    const maisAlta = Math.min(...faixas.map((f) => f.y));
    const pontoMaisAlto = Math.min(...pontos.map((p) => p.cy));

    expect(maisAlta).toBeLessThanOrEqual(pontoMaisAlto);
    expect(maisAlta).toBeGreaterThan(0);
  });
});
