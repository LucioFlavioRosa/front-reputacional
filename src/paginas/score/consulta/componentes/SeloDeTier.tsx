/** Selo do tier do veículo (F.9, F.8, recortes): "Tier 1" em azul claro,
 *  como no mockup (p. 3 e 5); "Tier 2" e "Tier 3" no selo neutro. O azul só
 *  no Tier 1 é o que faz a grande imprensa saltar numa lista de matérias. */

import { Selo } from '@/componentes/basicos';

import { SELO_DE_TIER_1, SELO_NEUTRO } from '../cores';
import type { Tier } from '../dados/tipos';

export function SeloDeTier({
  tier,
  sobreDestaque = false,
}: {
  tier: Tier;
  /** A linha em volta tem o fundo de destaque (F.9, `COR_LINHA_DESTACADA`),
   *  que é o mesmo azul claro do selo do Tier 1: ali o selo vai em branco,
   *  senão a pílula some na linha e sobra o texto solto. */
  sobreDestaque?: boolean;
}) {
  const cores = tier === 'Tier 1' ? SELO_DE_TIER_1 : SELO_NEUTRO;
  const fundo = sobreDestaque && tier === 'Tier 1' ? 'var(--branco)' : cores.fundo;
  return <Selo rotulo={tier} fundo={fundo} texto={cores.texto} />;
}
