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
 *  A PROSA QUEBRA, E ISTO É O PEDIDO DO DONO DO PRODUTO: "campo aberto deve ter uma
 *  largura máxima e depois o texto ir quebrando, para que possamos ler tudo". Antes ela
 *  cortava com reticências e o valor inteiro só existia no hover — passar o mouse em 54
 *  linhas para ler o relato de cada uma não é ler, é garimpar.
 *
 *  A QUEBRA TEM TETO, e é o que preserva a grade: duas linhas de texto, iguais em toda
 *  a tabela. A altura continua uniforme — é ela que faz a varredura com o olho
 *  funcionar, e é ela que sustenta a promessa de a célula não mudar de tamanho ao
 *  entrar em edição. O que passa de duas linhas corta, e a edição abre um campo de
 *  várias linhas com o texto inteiro dentro.
 */

/** Como uma coluna se desenha na grade. */
export interface Medida {
  /** A largura da coluna, em pixels. Entra no `colgroup`. */
  largura: number;
  alinhamento: 'left' | 'center';
  /** Se o texto quebra em mais de uma linha dentro da célula.
   *
   *  SÓ A PROSA QUEBRA. Uma sigla ou uma data quebrada em duas linhas seria ruído: elas
   *  têm tamanho conhecido e a coluna já cabe. Quem quebra é o campo aberto — Relato,
   *  Repercussão, Observações —, que é onde a pessoa escreve um parágrafo. */
  quebra?: boolean;
}

/** Tipo de coluna → medida. As larguras são múltiplos de 4 e sobem com o conteúdo.
 *
 *  `texto` é o padrão e o meio-termo: cabe "Sede, sala 3" sem reservar o espaço de
 *  um parágrafo. */
const POR_TIPO: Record<string, Medida> = {
  // "sim" ou vazio. Estreita e centralizada — é uma marca, não um valor.
  marca: { largura: 96, alinhamento: 'center' },
  // 25/09/2026, e o campo de edição mostra "dd/mm/aaaa" — dez caracteres nos dois, e a
  // largura tem de caber o CAMPO e não só o texto: foi onde a data ficou apertada.
  data: { largura: 120, alinhamento: 'center' },
  // Duas letras, mais o campo de edição em volta delas.
  sigla: { largura: 76, alinhamento: 'center' },
  // Nome vindo de uma lista: "Prefeitura Municipal de Campinas" tem 32 caracteres, e é
  // o caso real — a coluna cabe ele inteiro em vez de cortar no meio do nome.
  lista: { largura: 232, alinhamento: 'left' },
  // O campo aberto: a coluna mais larga, e o único tipo que QUEBRA o texto. A largura é
  // o máximo — daí em diante o texto desce de linha em vez de a coluna crescer, porque
  // uma coluna de 600px empurraria todas as outras para fora da tela.
  prosa: { largura: 328, alinhamento: 'left', quebra: true },
  texto: { largura: 184, alinhamento: 'left' },
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
