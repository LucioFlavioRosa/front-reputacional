/** Barra de sentimento (spec F.2): três segmentos na ordem positivo, neutro,
 *  negativo, cada um com a largura do próprio percentual, e a linha
 *  `14% pos · 50% neg · saldo −36` abaixo.
 *
 *  A LINHA DE TEXTO FICA FORA DO `role="img"`: dentro dele o leitor de tela
 *  ignoraria o saldo, que é o número que a pessoa mais procura.
 */

import type { DistSentimento } from '../dados/tipos';
import { corDoSinal, fmtPct, fmtSaldo } from '../formatacao';
import { COR_DE_SENTIMENTO_NO_GRAFICO } from '../cores';

export function BarraSentimento({ sentimento }: { sentimento: DistSentimento }) {
  const { pos, neu, neg } = sentimento;
  const segmentos = [
    { chave: 'positivo', valor: pos, cor: COR_DE_SENTIMENTO_NO_GRAFICO.positivo },
    { chave: 'neutro', valor: neu, cor: COR_DE_SENTIMENTO_NO_GRAFICO.neutro },
    { chave: 'negativo', valor: neg, cor: COR_DE_SENTIMENTO_NO_GRAFICO.negativo },
  ];

  return (
    <div>
      <div
        role="img"
        aria-label={`${fmtPct(pos)} positivas, ${fmtPct(neu)} neutras, ${fmtPct(neg)} negativas`}
        style={{
          display: 'flex',
          height: 10,
          borderRadius: 2,
          overflow: 'hidden',
          background: 'var(--bg-trilho)',
        }}
      >
        {segmentos.map((s) =>
          s.valor > 0 ? (
            <span
              key={s.chave}
              data-segmento={s.chave}
              style={{ display: 'block', width: `${s.valor}%`, background: s.cor }}
            />
          ) : null,
        )}
      </div>
      <div className="tabular" style={{ marginTop: 6, fontSize: 12, color: 'var(--cinza-3)' }}>
        {fmtPct(pos)} pos · {fmtPct(neg)} neg · saldo{' '}
        <strong style={{ fontWeight: 700, color: corDoSinal(pos - neg) }}>{fmtSaldo(pos, neg)}</strong>
      </div>
    </div>
  );
}
