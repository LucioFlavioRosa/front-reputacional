/** Selo "Dados ilustrativos" (`meta.aviso`), no estilo do selo neutro da
 *  E.1. Protege a apresentação contra comparação com as telas de dados reais
 *  logo acima do drill (E.3.4 e decisão A11): não remova.
 *
 *  SÓ APARECE QUANDO A FONTE É ILUSTRATIVA OU DE EXEMPLO (D5): quem chama
 *  passa `avisoDaConsulta(meta)`, vazio só para a carga real do mês, e aí o
 *  selo some do cabeçalho, do indicador de nível e da busca. */

import { Selo } from '@/componentes/basicos';

import { SELO_NEUTRO } from '../cores';

export function SeloIlustrativo({ aviso }: { aviso: string }) {
  if (!aviso.trim()) return null;
  return <Selo rotulo={aviso} fundo={SELO_NEUTRO.fundo} texto={SELO_NEUTRO.texto} />;
}
