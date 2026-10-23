/** A conta dos três painéis do Explorador de veículos.
 *
 *  O SERVIDOR MANDA O MÊS EM GRUPOS `(tier, veículo)` com contagem e peso por
 *  sentimento (`/explorador-de-veiculos`), e tudo o mais é soma aqui — é o que
 *  deixa o clique ser instantâneo sem mover o dossiê.
 *
 *  SÃO DOIS EIXOS, E TRÊS COLUNAS. No Explorador de taxonomia (`explorador.ts`)
 *  N1 › N2 › N3 é uma hierarquia: cada coluna é um campo distinto. Aqui, tier é
 *  um eixo e veículo é o outro, e as colunas "Top veículos" e "Termômetro" são
 *  o MESMO eixo com medidas diferentes.
 *
 *  CADA COLUNA DIZ DE QUAL FILTRO ELA SE EXIME, e não há uma regra única:
 *
 *      Tier × sentimento   exime-se do tier    (continua com os três degraus)
 *      Top veículos        exime-se do veículo (continua com todos)
 *      Termômetro          NÃO SE EXIME DE NADA
 *
 *  O TERMÔMETRO MOSTRA SÓ O VEÍCULO ESCOLHIDO — decisão do dono do produto em
 *  23/10/2026, depois de ver as duas formas na tela. A primeira versão o
 *  deixava inteiro e apenas esmaecia os outros, pelo argumento de que uma barra
 *  só não se compara com nada; ele quis o recorte, e o argumento contra caiu
 *  por terra na parte que importava: como o TOP continua inteiro, é por ele que
 *  se troca de veículo, e trocar segue sendo UM clique.
 *
 *  E AS DUAS COLUNAS QUE SE EXIMEM precisam se eximir, pelo mesmo motivo
 *  invertido: se a coluna de tier estreitasse pelo tier escolhido, ela ficaria
 *  com um degrau só e ninguém trocaria de tier sem desfazer o clique antes.
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

/** As duas medidas de um veículo, e elas NÃO TÊM A MESMA UNIDADE.
 *
 *  O CAMPO SE CHAMA `nota` E NÃO `score` (renomeado em 23/10/2026) porque
 *  `score` é também o nome do campo do gráfico `ItemDivergente`, onde o valor
 *  esperado é o SALDO de −100 a +100. Com os dois chamados `score`, passar um
 *  no lugar do outro compila, desenha, e inverte o sinal da tela inteira — foi
 *  o que aconteceu: a "Rádio Spaço 100.9 FM", com mais negativas que
 *  positivas, aparecia como "+18" porque recebia a NOTA (18 de 100) onde se
 *  esperava o saldo (−64). O nome é a única defesa que resta depois de o
 *  `tsc` aceitar os dois. */
export interface VeiculoNoTermometro {
  veiculo: string;
  /** Matérias do veículo no recorte. */
  total: number;
  /** O termômetro do CRM: (positivas − negativas) ÷ total × 100, de −100 a 100.
   *  É ESTE que vai para o gráfico. */
  nss: number;
  /** A nota do veículo na régua da lente, de 0 a 100: (NS ponderado + 1) ÷ 2 ×
   *  100 — PONDERADA por tier, ao contrário do `nss`. Nenhuma coluna do bloco
   *  a desenha hoje; existe pela simetria com `ufsDoExplorador`, onde a nota
   *  dimensiona a bolha do mapa e o saldo a colore. */
  nota: number;
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
  exceto?: Eixo,
): Map<string, Soma> {
  const somas = new Map<string, Soma>();
  for (const grupo of gruposNaSelecao(grupos, selecao, exceto)) {
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
  const somas = somasDoEixo(grupos, 'tier', selecao, 'tier');
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
  const somas = somasDoEixo(grupos, 'veiculo', selecao, 'veiculo');
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

/** Cada veículo com o termômetro (NSS) e a nota, dentro das escolhas.
 *
 *  A ÚNICA DAS TRÊS COLUNAS QUE NÃO SE EXIME DE NADA (ver o cabeçalho): com um
 *  veículo escolhido, sobra só ele. Quem troca a escolha é a coluna "Top
 *  veículos", que continua inteira. */
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
        nota: Math.round(((ns + 1) / 2) * 100),
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
