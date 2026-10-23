import { describe, expect, it } from 'vitest';

import type { GrupoDeVeiculo } from '@/api/cliente';
import {
  barrasDoTier,
  barrasDoVeiculo,
  termometroDosVeiculos,
} from '@/dominio/exploradorDeVeiculos';

function grupo(parcial: Partial<GrupoDeVeiculo>): GrupoDeVeiculo {
  return {
    tier: 'muito_relevante',
    veiculo: 'Folha',
    positivo: 0,
    neutro: 0,
    negativo: 0,
    peso_positivo: 0,
    peso_neutro: 0,
    peso_negativo: 0,
    ...parcial,
  };
}

//: "FOLHA" EM DOIS TIERS, que é o caso que a rota produz e a tela tem de somar.
const GRUPOS: GrupoDeVeiculo[] = [
  grupo({ tier: 'muito_relevante', veiculo: 'Folha', positivo: 3, peso_positivo: 30 }),
  grupo({ tier: 'relevante', veiculo: 'Folha', negativo: 1, peso_negativo: 5 }),
  grupo({ tier: 'muito_relevante', veiculo: 'Valor', negativo: 2, peso_negativo: 20 }),
  grupo({ tier: 'menos_relevante', veiculo: 'Estadão', neutro: 4, peso_neutro: 4 }),
];

describe('o explorador de veículos soma por dois eixos', () => {
  it('soma o mesmo veículo que aparece em mais de um tier', () => {
    const barras = barrasDoVeiculo(GRUPOS, {}, 100);
    const folha = barras.find((barra) => barra.rotulo === 'Folha');
    //: SEM A SOMA, "Folha" apareceria DUAS vezes na lista — uma por tier.
    expect(barras.filter((barra) => barra.rotulo === 'Folha')).toHaveLength(1);
    expect(folha?.positivo).toBe(3);
    expect(folha?.negativo).toBe(1);
  });

  it('escolher um TIER estreita os veículos e deixa o painel de tier inteiro', () => {
    const selecao = { tier: 'muito_relevante' };
    //: O EIXO CLICADO CONTINUA INTEIRO: os três tiers seguem na barra, senão
    //: ninguém troca de tier sem desfazer o clique antes.
    expect(barrasDoTier(GRUPOS, selecao, 100).map((b) => b.rotulo)).toEqual([
      'Tier 1',
      'Tier 2',
      'Tier 3',
    ]);
    //: E OS DOIS PAINÉIS DE VEÍCULO ESTREITAM.
    expect(barrasDoVeiculo(GRUPOS, selecao, 100).map((b) => b.rotulo)).toEqual([
      'Folha',
      'Valor',
    ]);
    expect(termometroDosVeiculos(GRUPOS, selecao).map((v) => v.veiculo)).toEqual([
      'Folha',
      'Valor',
    ]);
  });

  it('escolher um VEÍCULO deixa o Top inteiro e reduz o Termômetro a ele', () => {
    const selecao = { veiculo: 'Folha' };
    //: O TOP CONTINUA INTEIRO, e é ele quem troca a escolha: sem isso, trocar
    //: de veículo exigiria desfazer o clique antes.
    //
    //: A ORDEM É VOLUME DECRESCENTE e, no empate, o nome em pt-BR: Estadão e
    //: Folha têm 4 matérias cada, e "Estadão" vem antes.
    expect(barrasDoVeiculo(GRUPOS, selecao, 100).map((b) => b.rotulo)).toEqual([
      'Estadão',
      'Folha',
      'Valor',
    ]);

    //: O TERMÔMETRO MOSTRA SÓ O ESCOLHIDO — mudança de 23/10/2026, por pedido,
    //: depois de o dono ver na tela as duas formas. A versão anterior o deixava
    //: inteiro e só esmaecia os outros; ele quis o recorte.
    expect(termometroDosVeiculos(GRUPOS, selecao).map((v) => v.veiculo)).toEqual(['Folha']);

    //: E O PAINEL DE TIER ESTREITA para os tiers em que a Folha publicou.
    const tiers = barrasDoTier(GRUPOS, selecao, 100).filter(
      (barra) => barra.positivo + barra.neutro + barra.negativo > 0,
    );
    expect(tiers.map((barra) => barra.rotulo)).toEqual(['Tier 1', 'Tier 2']);
  });

  it('e o Termômetro segue o tier escolhido, como antes', () => {
    //: A CONTRAPROVA de que só o eixo do VEÍCULO mudou: escolher um tier
    //: continua estreitando o termômetro para os veículos daquele tier.
    expect(
      termometroDosVeiculos(GRUPOS, { tier: 'muito_relevante' }).map((v) => v.veiculo),
    ).toEqual(['Folha', 'Valor']);
  });

  it('deixa de fora a menção sem o campo do próprio eixo, e a mantém no outro', () => {
    const grupos = [
      ...GRUPOS,
      grupo({ tier: null, veiculo: 'Metrópoles', positivo: 5, peso_positivo: 50 }),
      grupo({ tier: 'relevante', veiculo: null, positivo: 7, peso_positivo: 70 }),
    ];
    //: SEM TIER sai da barra de tier, mas o veículo continua na lista.
    expect(barrasDoVeiculo(grupos, {}, 100).map((b) => b.rotulo)).toContain('Metrópoles');
    //: SEM VEÍCULO sai da lista de veículos, mas continua contando no tier.
    expect(barrasDoVeiculo(grupos, {}, 100).map((b) => b.rotulo)).not.toContain('');
    const tier2 = barrasDoTier(grupos, {}, 100).find((b) => b.rotulo === 'Tier 2');
    //: Tier 2 tem a negativa da Folha (1) mais as 7 positivas sem veículo.
    expect(tier2?.positivo).toBe(7);
    expect(tier2?.negativo).toBe(1);
    //: E O TIER NULO NÃO VIRA UMA QUARTA BARRA.
    expect(barrasDoTier(grupos, {}, 100)).toHaveLength(3);
  });

  it('com denominador zero o impacto é zero, e não Infinity', () => {
    const barras = barrasDoVeiculo(GRUPOS, {}, 0);
    expect(barras.every((barra) => Number.isFinite(barra.impacto))).toBe(true);
    expect(barras.every((barra) => barra.impacto === 0)).toBe(true);
  });

  it('o termômetro e a nota saem pela conta do produto', () => {
    //: 3 positivas e 1 negativa: nss = (3 − 1) ÷ 4 × 100 = 50.
    //: NS ponderado = (30 − 5) ÷ 35; nota = (NS + 1) ÷ 2 × 100 = 86.
    const folha = termometroDosVeiculos(GRUPOS, {}).find((v) => v.veiculo === 'Folha');
    expect(folha?.total).toBe(4);
    //: AS DUAS MEDIDAS, com unidades diferentes — `nss` é o saldo de −100 a
    //: +100 (por contagem) e `nota` é de 0 a 100 (ponderada por tier). O campo
    //: se chamava `score` e foi renomeado em 23/10/2026: o gráfico também tem
    //: um `score`, que é o SALDO, e os dois nomes iguais com unidades
    //: diferentes inverteram o sinal da tela inteira.
    expect(folha?.nss).toBe(50);
    expect(folha?.nota).toBe(86);
  });

  it('o tier sem matéria no recorte continua desenhado, em zero', () => {
    //: A RÉGUA TEM TRÊS DEGRAUS SEMPRE: um degrau que desaparece faria a lista
    //: pular de tamanho a cada clique.
    const so_t1 = [grupo({ tier: 'muito_relevante', veiculo: 'Folha', positivo: 1 })];
    const barras = barrasDoTier(so_t1, {}, 100);
    expect(barras.map((b) => b.rotulo)).toEqual(['Tier 1', 'Tier 2', 'Tier 3']);
    expect(barras[1].positivo + barras[1].neutro + barras[1].negativo).toBe(0);
  });
});
