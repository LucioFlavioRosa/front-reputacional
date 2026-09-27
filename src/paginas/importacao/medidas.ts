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
 *  NADA QUEBRA EM VÁRIAS LINHAS, e isto é uma decisão que eu revi: a prosa quebrava
 *  antes. Com 54 linhas de alturas diferentes, a varredura com o olho para de
 *  funcionar — e a altura variável torna impossível a promessa de a célula não mudar
 *  de tamanho ao entrar em edição, que é o que o dono do produto pediu. A prosa
 *  continua ganhando a coluna mais LARGA, corta com reticências, e o valor inteiro
 *  fica no hover. É o que uma planilha faz.
 */

/** Como uma coluna se desenha na grade. */
export interface Medida {
  /** A largura da coluna, em pixels. Entra no `colgroup`. */
  largura: number;
  alinhamento: 'left' | 'center';
}

/** Tipo de coluna → medida. As larguras são múltiplos de 4 e sobem com o conteúdo.
 *
 *  `texto` é o padrão e o meio-termo: cabe "Sede, sala 3" sem reservar o espaço de
 *  um parágrafo. */
const POR_TIPO: Record<string, Medida> = {
  // "sim" ou vazio. Estreita e centralizada — é uma marca, não um valor.
  marca: { largura: 92, alinhamento: 'center' },
  // 25/09/2026 — dez caracteres, sempre os mesmos.
  data: { largura: 108, alinhamento: 'center' },
  // Duas letras.
  sigla: { largura: 64, alinhamento: 'center' },
  // Nome vindo de uma lista: "Prefeitura Municipal de Campinas" é o caso real.
  lista: { largura: 208, alinhamento: 'left' },
  // Um parágrafo: a coluna mais larga, e ainda assim cortada. Ver o cabeçalho.
  prosa: { largura: 288, alinhamento: 'left' },
  texto: { largura: 168, alinhamento: 'left' },
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
