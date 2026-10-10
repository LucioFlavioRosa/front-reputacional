/** Selo de sentimento (E.1, F.8, F.9): texto sobre fundo claro e uma
 *  bolinha na cor de gráfico do sentimento, como no mockup.
 *
 *  A BOLINHA NÃO CARREGA SENTIDO SOZINHA: o rótulo escrito ("Negativo",
 *  "Neutro", "Positivo") diz o mesmo, e é ele que o leitor de tela lê. Por
 *  isso a bolinha é `aria-hidden`.
 */

import { COR_DE_SENTIMENTO_NO_GRAFICO, SELO_DE_SENTIMENTO } from '../cores';
import type { Sentimento } from '../dados/tipos';

const ROTULO: Record<Sentimento, string> = {
  positivo: 'Positivo',
  neutro: 'Neutro',
  negativo: 'Negativo',
};

export function SeloDeSentimento({ sentimento }: { sentimento: Sentimento }) {
  const cores = SELO_DE_SENTIMENTO[sentimento];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px',
        borderRadius: 'var(--r-chip)',
        background: cores.fundo,
        color: cores.texto,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden
        data-bolinha
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: COR_DE_SENTIMENTO_NO_GRAFICO[sentimento],
          flex: '0 0 auto',
        }}
      />
      {ROTULO[sentimento]}
    </span>
  );
}
