/** A base ilustrativa, já com o tipo da spec C.2. */

import type { Dados } from './tipos';
import json from './consulta-profundidade.dados.json';

/** AFIRMAÇÃO DE TIPO, E NÃO CONVERSÃO. O TypeScript infere o JSON com tipos
 *  largos (`string` onde a spec tem uniões como `'Tier 1' | 'Tier 2'`), e por
 *  isso a atribuição direta a `Dados` não passa; a afirmação passa porque as
 *  duas formas são compatíveis. A forma real é conferida em tempo de teste:
 *  `invariantes.test.ts` percorre cada nó e cada item. */
export const DADOS: Dados = json as Dados;
