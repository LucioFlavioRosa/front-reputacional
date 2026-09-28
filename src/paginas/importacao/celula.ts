/** O que uma célula oferece para ser consertada, e quantas linhas isso resolve.
 *
 *  O BLOCO DE DECISÕES AGRUPADAS SAIU DA TELA, por pedido do dono do produto: três
 *  blocos gastavam espaço, e o modal tem de ser a planilha que acabou de subir. Mas
 *  a propriedade que aquele bloco carregava não podia sair com ele — "este órgão não
 *  existe" em doze linhas é UM clique, não doze, e é isso que faz a conferência
 *  escalar com 54 agendas. Sem ela, um dia de evento viraria doze cliques idênticos
 *  e a pessoa pararia de conferir para clicar.
 *
 *  A DECISÃO DESCEU PARA A CÉLULA, que é o lugar onde ela é verdade. A célula
 *  vermelha passa a dizer o que fazer e quantas linhas o mesmo conserto cobre — e a
 *  tela ganhou de volta o espaço de um bloco inteiro sem perder nada.
 */

import type { LinhaDaImportacao } from '@/api/cliente';
import type { Grupo } from '@/paginas/importacao/grupos';

/** A decisão disponível numa célula, com o alcance dela. */
export interface DecisaoDaCelula {
  /** O grupo do servidor — traz as sugestões e se dá para criar. */
  grupo: Grupo;
  /** Quantas OUTRAS linhas o mesmo conserto resolve. Zero quando é só esta.
   *
   *  É O NÚMERO QUE JUSTIFICA O CLIQUE: sem ele a pessoa não sabe se está
   *  consertando uma linha ou doze, e é justamente essa diferença que a decisão em
   *  grupo existe para aproveitar. */
  outrasLinhas: number;
}

/** A decisão que resolve esta célula, ou `null` se não houver uma.
 *
 *  CASA PELO CAMPO E PELO VALOR, não pela coluna: duas colunas alimentam o mesmo
 *  campo (`Área 1` e `Área 2`, `Tema 1` a `Tema 3`), então casar por coluna
 *  ofereceria dentro de `Tema 3` a decisão que é de `Tema 1`.
 */
export function decisaoDaCelula(
  linha: LinhaDaImportacao,
  coluna: string,
  grupos: Grupo[],
): DecisaoDaCelula | null {
  const daCelula = linha.divergencias.find(
    (divergencia) => divergencia.coluna === coluna && !divergencia.acao,
  );
  if (!daCelula) return null;

  const valor = linha.dados_brutos[coluna];
  const grupo = grupos.find(
    (candidato) =>
      candidato.campo === daCelula.campo &&
      candidato.valor === String(valor ?? daCelula.valor),
  );
  if (!grupo) return null;

  return { grupo, outrasLinhas: Math.max(grupo.linhas.length - 1, 0) };
}
