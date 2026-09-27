/** O que a tabela de linhas mostra, e onde ela deixa completar.
 *
 *  O DEFEITO QUE ESTE MÓDULO CORRIGE: a tabela mostrava linha, aba, situação,
 *  herdado e "o que falta" — e nada do CONTEÚDO da linha. Diante de "linha 3 ·
 *  falta a Data" a pessoa não sabia nem de que agenda se tratava, e não tinha onde
 *  digitar a data. As saídas eram corrigir a planilha e subir tudo de novo, ou
 *  descartar a linha e perder a agenda.
 *
 *  FORA DO COMPONENTE porque são decisões testáveis: quais células oferecer e o
 *  que mostrar de uma linha de 59 colunas. Dentro do JSX elas só se testariam
 *  montando a tela inteira.
 */

import type { LinhaDaImportacao } from '@/api/cliente';

/** As colunas que identificam uma agenda para quem preencheu a planilha.
 *
 *  A LINHA TEM 59 COLUNAS, e despejar todas na tabela é a mesma coisa que não
 *  mostrar nenhuma: a pessoa procura a agenda pelo código, pela data, pelo órgão e
 *  por quem estava na sala. O resto ela confere na ficha, depois de confirmar.
 */
const COLUNAS_QUE_IDENTIFICAM = ['Código', 'Data', 'Instituição', 'Interlocutor 1'] as const;

/** O que aparece no lugar de uma célula vazia.
 *
 *  Um travessão, e não `null` nem string vazia: `null` é palavra de programador, e
 *  a célula em branco some da tabela sem dizer que estava em branco — que é
 *  justamente a informação que a pessoa foi ali buscar.
 */
const VAZIO = '—';

/** Uma coluna da linha, pronta para a tabela. */
export interface CelulaDaLinha {
  coluna: string;
  valor: string;
}

/** As colunas que identificam esta linha, na ordem da planilha. */
export function resumoDaLinha(linha: LinhaDaImportacao): CelulaDaLinha[] {
  return COLUNAS_QUE_IDENTIFICAM.filter((coluna) => coluna in linha.dados_brutos).map(
    (coluna) => {
      const valor = linha.dados_brutos[coluna];
      return {
        coluna,
        valor: valor === null || valor === undefined || valor === '' ? VAZIO : String(valor),
      };
    },
  );
}

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
