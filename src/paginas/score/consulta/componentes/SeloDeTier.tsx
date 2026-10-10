/** Selo do tier do veículo (F.9, F.8, recortes): "Tier 1" em azul claro,
 *  como no mockup (p. 3 e 5); "Tier 2" e "Tier 3" no selo neutro. O azul só
 *  no Tier 1 é o que faz a grande imprensa saltar numa lista de matérias. */

import { Selo } from '@/componentes/basicos';

import { SELO_DE_TIER_1, SELO_NEUTRO } from '../cores';
import type { Tier } from '../dados/tipos';

export function SeloDeTier({ tier }: { tier: Tier }) {
  const cores = tier === 'Tier 1' ? SELO_DE_TIER_1 : SELO_NEUTRO;
  return <Selo rotulo={tier} fundo={cores.fundo} texto={cores.texto} />;
}
