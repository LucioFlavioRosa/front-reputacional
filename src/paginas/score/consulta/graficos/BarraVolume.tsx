/** Barra de volume (spec F.3): trilho de 6px e preenchimento azul com a
 *  largura `volume ÷ maior volume entre os irmãos`.
 *
 *  DECORATIVA QUANDO O NÚMERO JÁ ESTÁ ESCRITO AO LADO (tabela de impacto,
 *  recorte por tier): o percentual da barra é sobre o MAIOR irmão, e o
 *  escrito é sobre a SOMA dos irmãos ou o subtema. Ler os dois daria dois
 *  percentuais para a mesma linha; a barra então sai da árvore acessível. */

import { fmtInt, fmtPct } from '../formatacao';
import { participacao } from '../dados/seletores';
import { larguraPct } from './escalas';

export function BarraVolume({
  volume,
  maximo,
  rotulo,
  decorativa = false,
}: {
  volume: number;
  /** O maior volume entre os irmãos (ou o volume do todo, na F.6). */
  maximo: number;
  /** Nome acessível; sem ele, "Volume 214, 100% do maior". */
  rotulo?: string;
  /** `aria-hidden`, sem `role="img"`: o número está escrito ao lado. */
  decorativa?: boolean;
}) {
  const acessivel = decorativa
    ? ({ 'aria-hidden': true } as const)
    : ({ role: 'img', 'aria-label': rotulo ?? `Volume ${fmtInt(volume)}, ${fmtPct(participacao(volume, maximo))} do maior` } as const);
  return (
    <div
      {...acessivel}
      style={{ height: 6, background: 'var(--bg-trilho)', overflow: 'hidden' }}
    >
      <span
        data-preenchimento
        style={{ display: 'block', height: '100%', width: larguraPct(volume, maximo), background: 'var(--azul-mar)' }}
      />
    </div>
  );
}
