/** Indicador de nível (E.3.4): cinco segmentos de 22×4px, o texto
 *  "Nível N de 4 · <nome do nível>" e o selo "Dados ilustrativos".
 *
 *  CINCO SEGMENTOS PARA QUATRO NÍVEIS, como a spec pede. O primeiro segmento
 *  é a escolha da lente (sempre feita, pela aba) e os outros quatro são os
 *  níveis: no Nível 1 há dois preenchidos e no Nível 4 a barra está cheia,
 *  como no mockup (p. 3 e 5), em vez de terminar a descida com um segmento
 *  vazio que sugeriria um nível a mais.
 *
 *  OS SEGMENTOS SÃO DECORAÇÃO: o texto diz o mesmo, e é ele que o leitor de
 *  tela lê.
 */

import { DADOS } from '../dados/dados';
import { NOMES_DOS_NIVEIS } from '../dados/seletores';
import type { Nivel } from '../dados/seletores';
import { SeloIlustrativo } from './SeloIlustrativo';

const SEGMENTOS = [0, 1, 2, 3, 4] as const;

export function IndicadorDeNivel({ nivel, aviso = DADOS.meta.aviso }: { nivel: Nivel; aviso?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span aria-hidden="true" style={{ display: 'inline-flex', gap: 4 }}>
        {SEGMENTOS.map((s) => (
          <span
            key={s}
            data-segmento={s <= nivel ? 'cheio' : 'vazio'}
            style={{
              display: 'block',
              width: 22,
              height: 4,
              borderRadius: 2,
              background: s <= nivel ? 'var(--azul-mar)' : 'var(--borda-input)',
            }}
          />
        ))}
      </span>
      <span style={{ fontSize: 13, color: 'var(--cinza-2)' }}>
        Nível {nivel} de 4 · <strong style={{ fontWeight: 700, color: 'var(--cinza-4)' }}>{NOMES_DOS_NIVEIS[nivel]}</strong>
      </span>
      <SeloIlustrativo aviso={aviso} />
    </div>
  );
}
