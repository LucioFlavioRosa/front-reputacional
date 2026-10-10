/** Selo "Dados ilustrativos" (`meta.aviso`), no estilo do selo neutro da
 *  E.1. Protege a apresentação contra comparação com as telas de dados reais
 *  logo acima do drill (E.3.4 e decisão A11): não remova. */

import { Selo } from '@/componentes/basicos';

import { SELO_NEUTRO } from '../cores';
import { DADOS } from '../dados/dados';

export function SeloIlustrativo({ aviso = DADOS.meta.aviso }: { aviso?: string }) {
  return <Selo rotulo={aviso} fundo={SELO_NEUTRO.fundo} texto={SELO_NEUTRO.texto} />;
}
