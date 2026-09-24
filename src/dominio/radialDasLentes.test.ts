/** A geometria do radial — a regra, e não o pixel.
 *
 *  O QUE ESTES TESTES TRAVAM é o que o gráfico AFIRMA: que a largura da fatia
 *  é o peso, que o comprimento é a nota, que uma lente fora do cálculo não
 *  some do círculo, e que a ordem das lentes não muda quando uma delas melhora.
 *  Um print não prova nada disso — e é justamente onde um erro passaria
 *  despercebido, porque um gráfico errado continua parecendo um gráfico.
 */

import { describe, expect, it } from 'vitest';

import {
  ANEIS,
  R0,
  RMAX,
  VIEW_BOX,
  ancoraDe,
  fracoesDe,
  naTela,
  radialDasLentes,
  raioDa,
} from '@/dominio/radialDasLentes';
import type { LenteDoScore } from '@/dominio/score';

function lente(parcial: Partial<LenteDoScore>): LenteDoScore {
  return {
    codigo: 'imprensa',
    nome: 'Imprensa',
    stakeholder: 'Formadores de opinião',
    peso: 30,
    peso_efetivo: 30,
    score: 70,
    ns: 0.4,
    delta: 1,
    fontes: ['clipei'],
    estimado: false,
    ausencia: null,
    ...parcial,
  };
}

/** As cinco lentes de junho, com os números da §8. */
const JUNHO = [
  lente({}),
  lente({ codigo: 'mercado', nome: 'Mercado', peso: 20, peso_efetivo: 20, score: 67 }),
  lente({
    codigo: 'sociedade',
    nome: 'Sociedade digital',
    peso: 20,
    peso_efetivo: 20,
    score: 37,
  }),
  lente({ codigo: 'clientes', nome: 'Clientes', peso: 15, peso_efetivo: 15, score: 42 }),
  lente({
    codigo: 'institucional',
    nome: 'Institucional',
    peso: 15,
    peso_efetivo: 15,
    score: 65,
  }),
];

const grau = (fracao: number) => Math.round(fracao * 360);

describe('raioDa', () => {
  it('nota 0 encosta no anel interno e 100 no externo', () => {
    expect(raioDa(0)).toBe(R0);
    expect(raioDa(100)).toBe(RMAX);
  });

  it('cresce em linha reta com a nota', () => {
    expect(raioDa(50)).toBeCloseTo((R0 + RMAX) / 2, 5);
  });

  it('nota fora da escala encosta no limite, e não escapa do círculo', () => {
    // Um score inesperado não pode desenhar uma fatia por cima dos rótulos.
    expect(raioDa(-10)).toBe(R0);
    expect(raioDa(140)).toBe(RMAX);
  });
});

describe('fracoesDe', () => {
  it('a largura da fatia é o peso efetivo', () => {
    const fracoes = fracoesDe(JUNHO, true);
    expect(grau(fracoes.get('imprensa') ?? 0)).toBe(108); // 30% de 360
    expect(grau(fracoes.get('mercado') ?? 0)).toBe(72);
    expect(grau(fracoes.get('clientes') ?? 0)).toBe(54);
  });

  it('as fatias somam o círculo inteiro', () => {
    const total = [...fracoesDe(JUNHO, true).values()].reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('sem ponderação, todas ficam iguais', () => {
    const fracoes = fracoesDe(JUNHO, false);
    expect([...fracoes.values()].map(grau)).toEqual([72, 72, 72, 72, 72]);
  });

  it('a lente fora do cálculo fica com uma fatia fixa, e as outras dividem o resto', () => {
    // SUMIR COM ELA faria o círculo mentir sobre quantas lentes existem: quem
    // visse quatro fatias acharia que a companhia tem quatro famílias de
    // stakeholder.
    const comUmaFora = [
      ...JUNHO.slice(0, 4),
      lente({ codigo: 'institucional', nome: 'Institucional', score: null, peso_efetivo: 0 }),
    ];
    const fracoes = fracoesDe(comUmaFora, true);

    expect(fracoes.get('institucional')).toBeCloseTo(0.06, 10);
    const total = [...fracoes.values()].reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
    // Imprensa vale 30 de 85 do que sobrou, sobre 94% do círculo.
    expect(fracoes.get('imprensa')).toBeCloseTo((30 / 85) * 0.94, 10);
  });

  it('com todos os pesos zerados cai nas fatias iguais, e não em divisão por zero', () => {
    const semPeso = JUNHO.map((l) => ({ ...l, peso_efetivo: 0 }));
    expect([...fracoesDe(semPeso, true).values()].map(grau)).toEqual([72, 72, 72, 72, 72]);
  });

  it('com todas as lentes fora, ninguém estoura', () => {
    const todasFora = JUNHO.map((l) => ({ ...l, score: null }));
    expect([...fracoesDe(todasFora, true).values()]).toEqual([0.06, 0.06, 0.06, 0.06, 0.06]);
  });
});

describe('ancoraDe', () => {
  it('centraliza perto da vertical', () => {
    expect(ancoraDe(-Math.PI / 2)).toBe('centro'); // 12h
    expect(ancoraDe(Math.PI / 2)).toBe('centro'); // 6h
  });

  it('encosta à esquerda no lado direito do círculo', () => {
    // Centralizar às 3h invadiria o gráfico com metade do texto.
    expect(ancoraDe(0)).toBe('inicio');
  });

  it('encosta à direita no lado esquerdo', () => {
    expect(ancoraDe(Math.PI)).toBe('fim');
  });
});

describe('naTela', () => {
  it('o centro do círculo cai onde o viewBox o põe', () => {
    const centro = naTela(230, 230);
    expect(centro.esquerda).toBeCloseTo(50, 5); // (230 + 60) / 580
    expect(centro.topo).toBeCloseTo(50, 5); // (230 + 20) / 500
  });

  it('a origem do viewBox é o canto', () => {
    expect(naTela(VIEW_BOX.x, VIEW_BOX.y)).toEqual({ esquerda: 0, topo: 0 });
  });
});

describe('radialDasLentes', () => {
  it('mantém a ordem do servidor, e não a da nota', () => {
    // Um gráfico que reordena as fatias quando uma lente melhora impede a
    // comparação entre dois meses — que é a única coisa que se faz com ele.
    const radial = radialDasLentes(JUNHO);
    expect(radial.setores.map((setor) => setor.codigo)).toEqual([
      'imprensa',
      'mercado',
      'sociedade',
      'clientes',
      'institucional',
    ]);
  });

  it('a fatia é pintada com a cor de ÁREA, e a nota com a de texto', () => {
    // São exigências opostas: a fatia preenche, o número se lê sobre branco.
    // Sólido pinta em turquesa e escreve em verde escuro — escrever em
    // turquesa sumiria no fundo.
    const solido = radialDasLentes([lente({ score: 72 })]).setores[0];
    expect(solido.cor).toBe('var(--turquesa-rio)');
    expect(solido.corDoTexto).toBe('var(--ok-fg)');
  });

  it('cada faixa tem a sua cor de fatia, e a legenda mostra cinco', () => {
    // Com Sólido e Referência na mesma cor, a legenda de cinco faixas
    // desenharia quatro quadrados distintos e um repetido.
    const cores = [95, 72, 60, 45, 20].map(
      (nota) => radialDasLentes([lente({ score: nota })]).setores[0].cor,
    );
    expect(new Set(cores).size).toBe(5);
  });

  it('a nota vai escrita, e não só na cor', () => {
    // A §7: a informação nunca depende só da cor, porque cor não se lê em voz
    // alta nem se distingue com daltonismo.
    const radial = radialDasLentes(JUNHO);
    expect(radial.setores.map((setor) => setor.notaEscrita)).toEqual([
      '70',
      '67',
      '37',
      '42',
      '65',
    ]);
  });

  it('a lente fora do cálculo tem fundo, mas não tem fatia', () => {
    const radial = radialDasLentes([
      ...JUNHO.slice(0, 4),
      lente({ codigo: 'institucional', score: null, peso_efetivo: 0 }),
    ]);
    const fora = radial.setores.at(-1);

    expect(fora?.fundo).not.toBe('');
    expect(fora?.fatia).toBe('');
    expect(fora?.notaEscrita).toBe('fora');
    expect(fora?.descricao).toContain('fora do cálculo');
  });

  it('a descrição diz nota e peso, para quem ouve a tela', () => {
    const radial = radialDasLentes(JUNHO);
    expect(radial.setores[0].descricao).toBe('Imprensa: nota 70, peso 30%');
  });

  it('desenha os quatro anéis e escreve só dois', () => {
    // Quatro números empilhados no eixo vertical deixavam o gráfico apertado;
    // 40 e 70 são os limites que a leitura usa.
    const radial = radialDasLentes(JUNHO);
    expect(radial.aneis.map((anel) => anel.valor)).toEqual([...ANEIS]);
    expect(radial.aneis.filter((anel) => anel.rotulo).map((anel) => anel.valor)).toEqual([
      40, 70,
    ]);
  });

  it('a legenda muda quando as fatias ficam iguais', () => {
    expect(radialDasLentes(JUNHO, true).legenda).toContain('peso da lente');
    expect(radialDasLentes(JUNHO, false).legenda).toContain('fatias iguais');
  });

  it('a primeira fatia nasce às 12h', () => {
    // O zero do círculo trigonométrico é às 3h. Um gráfico que começa ali faz
    // a lente de maior peso aparecer na lateral, e não no topo.
    const [primeiro] = radialDasLentes(JUNHO).setores;
    // O caminho começa no raio interno, no ângulo inicial: x ≈ centro, y < centro.
    const [, x, y] = /^M([\d.]+) ([\d.]+)/.exec(primeiro.fundo) ?? [];
    // Não exatamente 230: o vão de ~1° afasta a borda do eixo.
    expect(Math.abs(Number(x) - 230)).toBeLessThan(3);
    expect(Number(y)).toBeLessThan(230);
  });

  it('a fatia de nota maior chega mais longe que a de nota menor', () => {
    const radial = radialDasLentes(JUNHO);
    const raioDo = (codigo: string) => {
      const setor = radial.setores.find((s) => s.codigo === codigo);
      return Number(/A([\d.]+) /.exec(setor?.fatia ?? '')?.[1] ?? 0);
    };
    expect(raioDo('imprensa')).toBeGreaterThan(raioDo('sociedade'));
  });

  it('não desenha nada sem lente nenhuma', () => {
    const radial = radialDasLentes([]);
    expect(radial.setores).toEqual([]);
    expect(radial.aneis).toHaveLength(4);
  });
});
