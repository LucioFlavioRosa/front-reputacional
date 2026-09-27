/** Quanto espaço cada coluna recebe, e como o conteúdo se alinha nela.
 *
 *  A LARGURA VEM DO TIPO DO DADO, que o servidor manda junto com o nome da coluna.
 *  Não é estética: "Relato" guarda um parágrafo e "UF" guarda duas letras, e a mesma
 *  largura nas duas desperdiça a tela numa e trunca a outra. Com 22 ou 58 colunas, o
 *  desperdício de uma virou rolagem horizontal de todas.
 *
 *  ALINHAMENTO TAMBÉM É INFORMAÇÃO. O que tem tamanho fixo e curto — a marca de
 *  repetição, a sigla do estado — lê-se melhor centralizado, porque a coluna estreita
 *  faz a borda esquerda brigar com o texto. Tudo o que é nome ou frase fica à
 *  esquerda, onde o olho sempre começa.
 *
 *  A PROSA QUEBRA, o resto não. Um relato de três linhas numa célula que não quebra
 *  empurra a tabela para 2000px de largura; um nome de instituição quebrado no meio
 *  é mais difícil de reconhecer do que um nome cortado no fim.
 */

/** Como uma coluna se desenha na grade. */
export interface Medida {
  /** A largura da coluna, em pixels. Entra no `colgroup`. */
  largura: number;
  alinhamento: 'left' | 'center';
  /** `true` deixa o texto quebrar em várias linhas. */
  quebra: boolean;
}

/** Tipo de coluna → medida. As larguras são múltiplos de 4 e sobem com o conteúdo.
 *
 *  `texto` é o padrão e o meio-termo: cabe "Sede, sala 3" sem reservar o espaço de
 *  um parágrafo. */
const POR_TIPO: Record<string, Medida> = {
  // "sim" ou vazio. Estreita e centralizada — é uma marca, não um valor.
  marca: { largura: 92, alinhamento: 'center', quebra: false },
  // 25/09/2026 — dez caracteres, sempre os mesmos.
  data: { largura: 108, alinhamento: 'center', quebra: false },
  // Duas letras.
  sigla: { largura: 64, alinhamento: 'center', quebra: false },
  // Nome vindo de uma lista: "Prefeitura Municipal de Campinas" é o caso real.
  lista: { largura: 208, alinhamento: 'left', quebra: false },
  // Um parágrafo. A única que quebra.
  prosa: { largura: 288, alinhamento: 'left', quebra: true },
  texto: { largura: 168, alinhamento: 'left', quebra: false },
};

/** O padrão de quem não declarou tipo. Igual a `texto`: uma coluna nova aparece
 *  legível, e não invisível nem gigante. */
const PADRAO: Medida = POR_TIPO.texto;

/** A medida de uma coluna daquele tipo. */
export function medidaDaColuna(tipo: string): Medida {
  return POR_TIPO[tipo] ?? PADRAO;
}

/** A largura total das colunas de dados, para a grade saber se precisa rolar. */
export function larguraTotal(tipos: string[]): number {
  return tipos.reduce((soma, tipo) => soma + medidaDaColuna(tipo).largura, 0);
}
