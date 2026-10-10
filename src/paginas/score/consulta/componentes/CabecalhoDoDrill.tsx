/** A linha do topo do drill (decisão A11): "Agosto de 2026 · corte em
 *  31/08/2026" e, quando a fonte é ilustrativa, o selo "Dados ilustrativos".
 *
 *  POR QUE ESTA LINHA EXISTE: o drill fica colado à Jornada e à Síntese
 *  executiva da aba Lentes, e diz de que mês são os números e até que dia a
 *  carga chegou (`meta.dataCorte`, a data da última matéria do mês). Sem data
 *  de corte (mês sem matéria), a linha fica só com o mês.
 */

import { avisoDaConsulta } from '../dados/seletores';
import type { Dados } from '../dados/tipos';
import { fmtDataLonga } from '../formatacao';
import { SeloIlustrativo } from './SeloIlustrativo';

export function CabecalhoDoDrill({ meta }: { meta: Dados['meta'] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span className="tabular" style={{ fontSize: 13, color: 'var(--cinza-2)' }}>
        {meta.dataCorte ? `${meta.rotuloMes} · corte em ${fmtDataLonga(meta.dataCorte)}` : meta.rotuloMes}
      </span>
      <SeloIlustrativo aviso={avisoDaConsulta(meta)} />
    </div>
  );
}
