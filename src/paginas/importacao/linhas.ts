/** O que a tabela de linhas mostra, e onde ela deixa completar.
 *
 *  O DEFEITO QUE ESTE MÓDULO CORRIGE: a conferência sabia resolver o valor ERRADO
 *  — "este órgão não existe, aponte ou crie" — e não o AUSENTE. A linha sem data
 *  gerava um grupo sem valor nenhum: nada para apontar, nada para criar. As saídas
 *  eram corrigir a planilha e subir tudo de novo, ou descartar a linha.
 *
 *  FORA DO COMPONENTE porque é uma decisão testável: quais células oferecer. O que
 *  MOSTRAR de cada linha deixou de morar aqui quando a grade passou a mostrar
 *  todas as colunas do arquivo — ver `grade.ts`.
 */

import type { LinhaDaImportacao } from '@/api/cliente';

/** As colunas que esta linha oferece para a pessoa completar.
 *
 *  SÓ O QUE TRAVA, e só o que a divergência sabe apontar como coluna:
 *
 *  - o aviso brando não precisa de conserto, e oferecer um campo transformaria
 *    todo aviso em tarefa — o oposto do que a severidade branda quer dizer;
 *  - a divergência sem coluna é da LINHA inteira (uma duplicata de agenda, por
 *    exemplo). Uma caixa de texto ali convidaria a pessoa a "consertar" o que não
 *    é erro de célula.
 */
export function celulasEditaveis(linha: LinhaDaImportacao): string[] {
  const colunas = linha.divergencias
    .filter((divergencia) => divergencia.trava && divergencia.coluna)
    .map((divergencia) => divergencia.coluna);
  return [...new Set(colunas)];
}
