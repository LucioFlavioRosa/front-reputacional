/** A conta dos gráficos N1 › N2 › N3 e do mapa por UF da Síntese executiva.
 *
 *  O SERVIDOR MANDA O MÊS EM GRUPOS (N1, N2, N3, UF) com contagem e peso por
 *  sentimento (`/explorador`), e tudo o mais é soma aqui — é o que deixa o
 *  clique ser instantâneo.
 *
 *  O FILTRO É CRUZADO: escolher um N1 refaz o N2, o N3 e o mapa; o gráfico do
 *  próprio N1 continua com todos (o escolhido em destaque), senão a pessoa não
 *  teria como trocar de N1 sem desfazer o clique antes.
 *
 *  O IMPACTO é a regra do produto: 50 × (P − N) ÷ D, com P e N ponderados e D o
 *  denominador do MÊS — por isso as barras de um nível somam o impacto do todo.
 */

import type { GrupoDoExplorador } from '@/api/cliente';
import type { ColunaDeSentimento } from '@/dominio/colunasEmpilhadas';
import { CORES_DE_CLIMA } from '@/dominio/frentes';

//: AS CORES DO TERMÔMETRO DO CRM — as mesmas da Evolução da Síntese executiva —
//: para as barras e colunas por sentimento dos cards da lente.
export const CORES_DO_SENTIMENTO: [string, string, string] = [
  CORES_DE_CLIMA.propositivo,
  CORES_DE_CLIMA.neutro,
  CORES_DE_CLIMA.tenso,
];

export type Nivel = 'n1' | 'n2' | 'n3';
export const NIVEIS: Nivel[] = ['n1', 'n2', 'n3'];
export type Selecao = Partial<Record<Nivel, string>>;

export interface BarraDoExplorador extends ColunaDeSentimento {
  /** Pontos que este item tira ou põe na nota da lente no mês. */
  impacto: number;
}

/** Os grupos que passam pelas escolhas — menos a do nível `exceto`. */
export function gruposNaSelecao(
  grupos: GrupoDoExplorador[],
  selecao: Selecao,
  exceto?: Nivel,
): GrupoDoExplorador[] {
  return grupos.filter((grupo) =>
    NIVEIS.every((nivel) => nivel === exceto || !selecao[nivel] || grupo[nivel] === selecao[nivel]),
  );
}

function impacto(pesoPositivo: number, pesoNegativo: number, denominador: number): number {
  return denominador ? (50 * (pesoPositivo - pesoNegativo)) / denominador : 0;
}

/** As barras de um nível, do maior para o menor volume. Menção sem o campo
 *  daquele nível fica fora DESTA barra, e continua valendo nas outras. */
export function barrasDoNivel(
  grupos: GrupoDoExplorador[],
  nivel: Nivel,
  selecao: Selecao,
  denominador: number,
): BarraDoExplorador[] {
  const somas = new Map<string, { pos: number; neu: number; neg: number; wPos: number; wNeg: number }>();
  for (const grupo of gruposNaSelecao(grupos, selecao, nivel)) {
    const chave = grupo[nivel];
    if (!chave) continue;
    const atual = somas.get(chave) ?? { pos: 0, neu: 0, neg: 0, wPos: 0, wNeg: 0 };
    atual.pos += grupo.positivo;
    atual.neu += grupo.neutro;
    atual.neg += grupo.negativo;
    atual.wPos += grupo.peso_positivo;
    atual.wNeg += grupo.peso_negativo;
    somas.set(chave, atual);
  }
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

export interface UfDoExplorador {
  uf: string;
  /** Menções da UF no recorte. */
  total: number;
  positivo: number;
  neutro: number;
  negativo: number;
  /** O termômetro do CRM: (positivas − negativas) ÷ total × 100, de −100 a 100. */
  nss: number;
  /** A nota da UF na régua da lente, de 0 a 100: (NS ponderado + 1) ÷ 2 × 100. */
  score: number;
}

/** Cada UF com o termômetro (NSS) e a nota, dentro das escolhas de N1/N2/N3. */
export function ufsDoExplorador(grupos: GrupoDoExplorador[], selecao: Selecao): UfDoExplorador[] {
  const somas = new Map<string, { pos: number; neu: number; neg: number; wPos: number; wNeu: number; wNeg: number }>();
  for (const grupo of gruposNaSelecao(grupos, selecao)) {
    if (!grupo.uf) continue;
    const atual = somas.get(grupo.uf) ?? { pos: 0, neu: 0, neg: 0, wPos: 0, wNeu: 0, wNeg: 0 };
    atual.pos += grupo.positivo;
    atual.neu += grupo.neutro;
    atual.neg += grupo.negativo;
    atual.wPos += grupo.peso_positivo;
    atual.wNeu += grupo.peso_neutro;
    atual.wNeg += grupo.peso_negativo;
    somas.set(grupo.uf, atual);
  }
  return [...somas.entries()]
    .map(([uf, s]) => {
      const total = s.pos + s.neu + s.neg;
      const peso = s.wPos + s.wNeu + s.wNeg;
      const ns = peso ? (s.wPos - s.wNeg) / peso : 0;
      return {
        uf,
        total,
        positivo: s.pos,
        neutro: s.neu,
        negativo: s.neg,
        nss: total ? Math.round(((s.pos - s.neg) / total) * 100) : 0,
        score: Math.round(((ns + 1) / 2) * 100),
      };
    })
    .sort((a, b) => b.score - a.score || a.uf.localeCompare(b.uf));
}

/** O impacto como a tela escreve: uma casa, com sinal, vírgula decimal. */
export function textoDoImpacto(valor: number): string {
  const arredondado = Math.round(valor * 10) / 10;
  if (Object.is(arredondado, -0) || arredondado === 0) return '0,0';
  const texto = Math.abs(arredondado).toFixed(1).replace('.', ',');
  return `${arredondado > 0 ? '+' : '−'}${texto}`;
}
