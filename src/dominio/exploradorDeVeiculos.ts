/** A conta dos três painéis do Explorador de veículos.
 *
 *  O SERVIDOR MANDA O MÊS EM GRUPOS `(tier, veículo)` com contagem e peso por
 *  sentimento (`/explorador-de-veiculos`), e tudo o mais é soma aqui — é o que
 *  deixa o clique ser instantâneo sem mover o dossiê.
 *
 *  SÃO DOIS EIXOS, E TRÊS PAINÉIS. No Explorador de taxonomia (`explorador.ts`)
 *  N1 › N2 › N3 é uma hierarquia: cada coluna é um campo distinto. Aqui, tier é
 *  um eixo e veículo é o outro, e os painéis "Top veículos" e "Termômetro" são
 *  o MESMO eixo com medidas diferentes. Por isso o `exceto` é o EIXO do painel
 *  que se desenha, e não o painel: escolher um veículo deixa os DOIS painéis de
 *  veículo inteiros. Estreitar o termômetro pelo veículo escolhido no Top o
 *  deixaria com uma barra só — o modo de falha que o molde existe para evitar.
 *
 *  O FILTRO É CRUZADO, como lá: escolher um tier refaz os dois painéis de
 *  veículo; o painel de tier continua com os três (o escolhido em destaque),
 *  senão a pessoa não teria como trocar de tier sem desfazer o clique antes.
 */

import type { GrupoDeVeiculo } from '@/api/cliente';
import type { BarraDoExplorador } from '@/dominio/explorador';
import { ROTULO_DO_TIER } from '@/dominio/filtrosDasLentes';

export type Eixo = 'tier' | 'veiculo';
export const EIXOS: Eixo[] = ['tier', 'veiculo'];
export type SelecaoDeVeiculos = Partial<Record<Eixo, string>>;

//: A ORDEM DO PRODUTO, e não a do volume: Tier 1, 2, 3. O painel de tier é uma
//: régua de relevância, e reordená-la por volume faria "Tier 3" aparecer em
//: cima num mês ruim — a mesma ordem fixa que o filtro da tela usa.
const ORDEM_DO_TIER = ['muito_relevante', 'relevante', 'menos_relevante'];

export interface VeiculoNoTermometro {
  veiculo: string;
  /** Matérias do veículo no recorte. */
  total: number;
  /** O termômetro do CRM: (positivas − negativas) ÷ total × 100, de −100 a 100. */
  nss: number;
  /** A nota do veículo na régua da lente, de 0 a 100: (NS ponderado + 1) ÷ 2 × 100. */
  score: number;
}

/** Os grupos que passam pelas escolhas — menos a do eixo `exceto`. */
export function gruposNaSelecao(
  grupos: GrupoDeVeiculo[],
  selecao: SelecaoDeVeiculos,
  exceto?: Eixo,
): GrupoDeVeiculo[] {
  return grupos.filter((grupo) =>
    EIXOS.every((eixo) => eixo === exceto || !selecao[eixo] || grupo[eixo] === selecao[eixo]),
  );
}

function impacto(pesoPositivo: number, pesoNegativo: number, denominador: number): number {
  return denominador ? (50 * (pesoPositivo - pesoNegativo)) / denominador : 0;
}

interface Soma {
  pos: number;
  neu: number;
  neg: number;
  wPos: number;
  wNeu: number;
  wNeg: number;
}

function vazia(): Soma {
  return { pos: 0, neu: 0, neg: 0, wPos: 0, wNeu: 0, wNeg: 0 };
}

function somar(alvo: Soma, grupo: GrupoDeVeiculo): void {
  alvo.pos += grupo.positivo;
  alvo.neu += grupo.neutro;
  alvo.neg += grupo.negativo;
  alvo.wPos += grupo.peso_positivo;
  alvo.wNeu += grupo.peso_neutro;
  alvo.wNeg += grupo.peso_negativo;
}

/** Somas por valor de um eixo, já dentro das escolhas dos OUTROS eixos.
 *
 *  GRUPO SEM O CAMPO DESTE EIXO FICA DE FORA — e continua valendo no outro, que
 *  é a regra do molde: a menção sem veículo não entra na lista de veículos, e
 *  continua contando no tier dela. */
function somasDoEixo(
  grupos: GrupoDeVeiculo[],
  eixo: Eixo,
  selecao: SelecaoDeVeiculos,
): Map<string, Soma> {
  const somas = new Map<string, Soma>();
  for (const grupo of gruposNaSelecao(grupos, selecao, eixo)) {
    const chave = grupo[eixo];
    if (!chave) continue;
    const atual = somas.get(chave) ?? vazia();
    somar(atual, grupo);
    somas.set(chave, atual);
  }
  return somas;
}

/** As três barras de tier, na ordem do produto.
 *
 *  O TIER SEM MATÉRIA NO RECORTE CONTINUA DESENHADO, em zero: a régua tem três
 *  degraus sempre, e um degrau que desaparece faz a lista pular de tamanho a
 *  cada clique. */
export function barrasDoTier(
  grupos: GrupoDeVeiculo[],
  selecao: SelecaoDeVeiculos,
  denominador: number,
): BarraDoExplorador[] {
  const somas = somasDoEixo(grupos, 'tier', selecao);
  return ORDEM_DO_TIER.map((tier) => {
    const s = somas.get(tier) ?? vazia();
    return {
      rotulo: ROTULO_DO_TIER[tier] ?? tier,
      positivo: s.pos,
      neutro: s.neu,
      negativo: s.neg,
      impacto: impacto(s.wPos, s.wNeg, denominador),
    };
  });
}

/** Os veículos do recorte, do maior volume para o menor. */
export function barrasDoVeiculo(
  grupos: GrupoDeVeiculo[],
  selecao: SelecaoDeVeiculos,
  denominador: number,
): BarraDoExplorador[] {
  const somas = somasDoEixo(grupos, 'veiculo', selecao);
  return [...somas.entries()]
    .map(([rotulo, s]) => ({
      rotulo,
      positivo: s.pos,
      neutro: s.neu,
      negativo: s.neg,
      impacto: impacto(s.wPos, s.wNeg, denominador),
    }))
    .sort(
      (a, b) =>
        b.positivo + b.neutro + b.negativo - (a.positivo + a.neutro + a.negativo) ||
        a.rotulo.localeCompare(b.rotulo, 'pt-BR'),
    );
}

/** Cada veículo com o termômetro (NSS) e a nota, dentro das escolhas. */
export function termometroDosVeiculos(
  grupos: GrupoDeVeiculo[],
  selecao: SelecaoDeVeiculos,
): VeiculoNoTermometro[] {
  const somas = somasDoEixo(grupos, 'veiculo', selecao);
  return [...somas.entries()]
    .map(([veiculo, s]) => {
      const total = s.pos + s.neu + s.neg;
      const peso = s.wPos + s.wNeu + s.wNeg;
      const ns = peso ? (s.wPos - s.wNeg) / peso : 0;
      return {
        veiculo,
        total,
        nss: total ? Math.round(((s.pos - s.neg) / total) * 100) : 0,
        score: Math.round(((ns + 1) / 2) * 100),
      };
    })
    .sort((a, b) => b.total - a.total || a.veiculo.localeCompare(b.veiculo, 'pt-BR'));
}

/** O tier (a chave) a partir do rótulo que a barra mostra ("Tier 1").
 *
 *  O `ColunasEmpilhadas` FALA POR RÓTULO, não por chave: `aoClicar` devolve o
 *  texto desenhado. A seleção guarda a chave (`muito_relevante`), que é o que o
 *  dado tem — então a tradução acontece nas duas pontas, e é melhor aqui, com
 *  teste, que embutida na tela. */
export function tierDoRotulo(rotulo: string): string | undefined {
  return Object.keys(ROTULO_DO_TIER).find((chave) => ROTULO_DO_TIER[chave] === rotulo);
}
