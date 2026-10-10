/** Barra de impacto divergente (spec F.4): eixo zero no meio, negativo para
 *  a esquerda em vermelho, positivo para a direita em turquesa, e o valor em
 *  pontos à direita na cor de TEXTO do sinal.
 *
 *  ESCALA DE QUEM CHAMA: todas as barras de uma tabela recebem a mesma
 *  `escala` (`escalaDeImpacto`, em `dados/seletores.ts`), para que a largura
 *  compare linhas entre si. Zero não desenha barra: só o eixo e "0,0 pt".
 *
 *  A BARRA SEGUE O NÚMERO ESCRITO, como a cor: −0,04 aparece "0,0 pt", e um
 *  filete vermelho ao lado de um zero cinza diria duas coisas diferentes.
 *
 *  O NOME ACESSÍVEL PADRÃO DIZ "Impacto na nota". Onde o valor é outra coisa
 *  (a variação do "O que mudou desde julho"), quem chama passa `rotulo`.
 */

import { arred, corDoSinal, fmtPt } from '../formatacao';
import { COR_EIXO, COR_NEGATIVO_GRAFICO, COR_POSITIVO_GRAFICO } from '../cores';
import { larguraPct } from './escalas';

export function BarraImpacto({
  valor,
  escala,
  compacta = false,
  rotulo,
}: {
  valor: number;
  escala: number;
  /** Cartões laterais e recortes: barra 10px, valor 13px, coluna 62px. */
  compacta?: boolean;
  /** Nome acessível; sem ele, "Impacto na nota: −7,4 pt". */
  rotulo?: string;
}) {
  const alturaDaBarra = compacta ? 10 : 14;
  const escrito = arred(valor, 1);
  const barra =
    escrito === 0 ? null : (
      <span
        data-barra={escrito < 0 ? 'negativa' : 'positiva'}
        style={{
          display: 'block',
          height: alturaDaBarra,
          width: larguraPct(Math.abs(valor), escala),
          background: escrito < 0 ? COR_NEGATIVO_GRAFICO : COR_POSITIVO_GRAFICO,
        }}
      />
    );
  const metade = { display: 'flex', alignItems: 'center', height: 24 } as const;

  return (
    <div
      role="img"
      aria-label={rotulo ?? `Impacto na nota: ${fmtPt(valor)}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `1fr 1fr ${compacta ? 62 : 72}px`,
        alignItems: 'center',
      }}
    >
      <div data-metade="negativa" style={{ ...metade, justifyContent: 'flex-end', borderRight: `1px solid ${COR_EIXO}` }}>
        {escrito < 0 ? barra : null}
      </div>
      <div data-metade="positiva" style={metade}>
        {escrito > 0 ? barra : null}
      </div>
      <span
        className="tabular"
        style={{
          textAlign: 'right',
          whiteSpace: 'nowrap',
          fontSize: compacta ? 13 : 15,
          fontWeight: 800,
          // A COR SEGUE O NÚMERO ESCRITO: −0,04 aparece "0,0 pt" e fica cinza.
          color: corDoSinal(escrito),
        }}
      >
        {fmtPt(valor)}
      </span>
    </div>
  );
}
