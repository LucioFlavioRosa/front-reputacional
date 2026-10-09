/** O termômetro do clima do recorte: uma barra só, dividida em Negativo,
 *  Neutro e Positivo, com o saldo (positivas − negativas) em destaque.
 *
 *  UMA BARRA, E NÃO TRÊS. A pergunta é "como está a temperatura", e ela é uma
 *  parte-do-todo: as três fatias somam 100% das interações com clima. Três
 *  barras soltas mediriam cada uma contra o seu próprio máximo e esconderiam
 *  justamente a proporção.
 *
 *  NEGATIVO À ESQUERDA, POSITIVO À DIREITA — a mesma direção da
 *  `BarraDivergente` do Painel: frio de um lado, quente do outro, e quem lê um
 *  gráfico lê o outro sem reaprender.
 *
 *  O SALDO É A MESMA CONTA de todo placar de clima do Painel —
 *  (positivas − negativas) ÷ total com clima × 100, de −100 a +100.
 *
 *  Cada fatia diz o próprio rótulo e o percentual (com a contagem no `title`),
 *  então a cor nunca é a única pista de qual fatia é qual.
 */

import { CORES_DE_CLIMA } from '@/dominio/frentes';

export interface FatiaDeClima {
  chave: string;
  rotulo: string;
  total: number;
}

//: A ORDEM DO TERMÔMETRO, do frio ao quente — fixa, e não a do dicionário.
const ORDEM = ['tenso', 'neutro', 'propositivo'];

export function TermometroDeClima({
  fatias,
  ativo,
  aoClicar,
}: {
  fatias: FatiaDeClima[];
  /** O clima filtrado no recorte, se houver — a fatia dele fica marcada. */
  ativo?: string;
  /** Clicar numa fatia filtra o recorte por aquele clima, como no filtro rápido. */
  aoClicar?: (chave: string) => void;
}) {
  const ordenadas = ORDEM.map((codigo) => fatias.find((f) => f.chave === codigo)).filter(
    (f): f is FatiaDeClima => Boolean(f),
  );
  const total = ordenadas.reduce((soma, f) => soma + f.total, 0);

  if (!total) {
    return (
      <div style={{ fontSize: 13, color: 'var(--cinza-2)', padding: '8px 0' }}>
        Nenhuma interação com termômetro registrado neste recorte.
      </div>
    );
  }

  const de = (codigo: string) => ordenadas.find((f) => f.chave === codigo)?.total ?? 0;
  const saldo = Math.round(((de('propositivo') - de('tenso')) / total) * 100);
  const pct = (n: number) => Math.round((n / total) * 100);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span
          style={{ fontSize: 26, fontWeight: 800, color: 'var(--cinza-4)', lineHeight: 1 }}
          aria-label={`Saldo do termômetro ${saldo > 0 ? '+' : ''}${saldo}`}
        >
          {saldo > 0 ? '+' : ''}
          {saldo}
        </span>
        <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
          saldo do termômetro · {total} {total === 1 ? 'interação' : 'interações'} com termômetro
        </span>
      </div>

      <div
        role="img"
        aria-label={ordenadas.map((f) => `${f.rotulo} ${pct(f.total)}%`).join(', ')}
        style={{ display: 'flex', gap: 2, height: 14 }}
      >
        {ordenadas
          .filter((f) => f.total > 0)
          .map((fatia, indice, visiveis) => {
            const primeira = indice === 0;
            const ultima = indice === visiveis.length - 1;
            const marcada = ativo === fatia.chave;
            return (
              <button
                key={fatia.chave}
                type="button"
                onClick={aoClicar ? () => aoClicar(fatia.chave) : undefined}
                title={`${fatia.rotulo}: ${pct(fatia.total)}% (${fatia.total})${aoClicar ? ' — clique para filtrar' : ''}`}
                aria-pressed={aoClicar ? marcada : undefined}
                style={{
                  flex: `${fatia.total} 1 0`,
                  minWidth: 4,
                  padding: 0,
                  border: 'none',
                  background: CORES_DE_CLIMA[fatia.chave] ?? 'var(--cinza-1)',
                  borderRadius: `${primeira ? 4 : 0}px ${ultima ? 4 : 0}px ${ultima ? 4 : 0}px ${primeira ? 4 : 0}px`,
                  outline: marcada ? '2px solid var(--cinza-4)' : 'none',
                  outlineOffset: 1,
                  opacity: ativo && !marcada ? 0.45 : 1,
                  cursor: aoClicar ? 'pointer' : 'default',
                }}
              />
            );
          })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, gap: 8 }}>
        {ordenadas.map((fatia) => (
          <div key={fatia.chave} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: CORES_DE_CLIMA[fatia.chave] ?? 'var(--cinza-1)',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--cinza-3)' }}>
              {fatia.rotulo}{' '}
              <strong style={{ color: 'var(--cinza-4)' }}>{pct(fatia.total)}%</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
