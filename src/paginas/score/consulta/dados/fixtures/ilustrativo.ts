/** A base ilustrativa da Consulta em profundidade, já com o tipo da spec C.2.
 *
 *  SÓ PARA TESTES (decisão D5). A tela lê os dados reais do mês pelo
 *  endpoint `/api/score/lentes/{codigo}/consulta` (`useConsultaDaLente`); este
 *  JSON é a fixture que os testes do drill devolvem no lugar da API e o
 *  arquivo que `invariantes.test.ts` valida. Nenhum código de produção pode
 *  importá-lo: entraria no pacote e voltaria a mostrar agosto em todo mês.
 */

import type { Dados } from '../tipos';
import json from './consulta-profundidade.dados.json';

/** AFIRMAÇÃO DE TIPO, E NÃO CONVERSÃO. O TypeScript infere o JSON com tipos
 *  largos (`string` onde a spec tem uniões como `'Tier 1' | 'Tier 2'`), e por
 *  isso a atribuição direta a `Dados` não passa; a afirmação passa porque as
 *  duas formas são compatíveis. A forma real é conferida em tempo de teste:
 *  `invariantes.test.ts` percorre cada nó e cada item. */
export const DADOS: Dados = json as Dados;

/** O aviso que a fonte ilustrativa traz em `meta.aviso`. */
export const AVISO_ILUSTRATIVO = 'Dados ilustrativos';

/** A resposta que o endpoint `/consulta` daria com a base ilustrativa: o
 *  mesmo `Dados`, com UMA lente em `lentes` e o aviso do selo. É o que os
 *  testes do drill devolvem no lugar de `obterConsultaDaLente`. */
export function consultaIlustrativa(lente: string): Dados {
  return {
    ...DADOS,
    meta: { ...DADOS.meta, aviso: AVISO_ILUSTRATIVO },
    lentes: DADOS.lentes.filter((l) => l.id === lente),
  };
}
