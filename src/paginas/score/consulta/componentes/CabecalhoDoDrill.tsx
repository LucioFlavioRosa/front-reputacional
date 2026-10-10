/** A linha do topo do drill (decisão A11): "Agosto de 2026 · corte em
 *  31/08/2026" e o selo "Dados ilustrativos".
 *
 *  POR QUE ESTA LINHA EXISTE: o drill fica colado a dados reais da aba Lentes
 *  (Jornada, Síntese executiva), e as frases do JSON falam de agosto e de
 *  julho qualquer que seja o mês escolhido na tela (A19). O mês e a data de
 *  corte escritos aqui, ao lado do selo, deixam isso explícito.
 */

import { DADOS } from '../dados/dados';
import type { Dados } from '../dados/tipos';
import { fmtDataLonga } from '../formatacao';
import { SeloIlustrativo } from './SeloIlustrativo';

export function CabecalhoDoDrill({ meta = DADOS.meta }: { meta?: Dados['meta'] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span className="tabular" style={{ fontSize: 13, color: 'var(--cinza-2)' }}>
        {meta.rotuloMes} · corte em {fmtDataLonga(meta.dataCorte)}
      </span>
      <SeloIlustrativo aviso={meta.aviso} />
    </div>
  );
}
