/** A conta das colunas empilhadas por sentimento — o gráfico das abas do painel
 *  de aprofundamento (N1 Atributo Reputacional, N2 Temas estratégicos, N3
 *  Subtemas…).
 *
 *  QUANTIDADES, E NÃO 100%, por pedido do dono do produto: a barra de 100%
 *  respondia "como se divide cada atributo", e a pergunta do painel é "qual
 *  atributo pesa mais no mês" — numa barra de 100% o atributo de 2 menções e o
 *  de 200 têm o mesmo tamanho.
 *
 *  DO MAIOR PARA O MENOR, pelo total, para a primeira coluna ser a resposta.
 */

export interface ColunaDeSentimento {
  rotulo: string;
  positivo: number;
  neutro: number;
  negativo: number;
}

export function totalDa(coluna: ColunaDeSentimento): number {
  return coluna.positivo + coluna.neutro + coluna.negativo;
}

/** Maior total primeiro; no empate, ordem alfabética (estável entre recargas). */
export function ordenarPeloTotal(colunas: ColunaDeSentimento[]): ColunaDeSentimento[] {
  return [...colunas].sort(
    (a, b) => totalDa(b) - totalDa(a) || a.rotulo.localeCompare(b.rotulo, 'pt-BR'),
  );
}

/** O topo da escala: o maior total (1 quando não há nada, para não dividir por zero). */
export function topoDaEscala(colunas: ColunaDeSentimento[]): number {
  return Math.max(1, ...colunas.map(totalDa));
}
