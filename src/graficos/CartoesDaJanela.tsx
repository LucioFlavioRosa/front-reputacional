/** Os quatro cartões acima da Jornada: Índice atual, Pico, Vale e Variação
 *  no período — todos da janela escolhida na mini linha do tempo.
 *
 *  COMPACTOS, NUMA FAIXA SÓ: eles abrem o gráfico como um resumo, e não podem
 *  pesar mais do que ele. Quatro lado a lado; dois a dois no telefone.
 *
 *  O NÚMERO GRANDE, O RESTO MIÚDO: o cartão existe para o valor ser lido de
 *  longe, e rótulo e mês são o contexto que se lê de perto.
 *
 *  A COR SÓ NA VARIAÇÃO, e com seta e palavra junto: alta verde, queda
 *  vermelha, estável neutra. Nos outros três a cor não diria nada que o rótulo
 *  já não diga — Pico não é "bom", é o mais alto.
 *
 *  NENHUMA CONTA AQUI: pico, vale e a regra das 4 lentes estão em
 *  `kpisDaJanela`. Este arquivo escreve.
 */

import type { ReactNode } from 'react';

import { Ajuda } from '@/componentes/basicos';
import type { KpisDaJanela, ValorDoMes } from '@/dominio/janelaDaJornada';

const COR_DO_SENTIDO = {
  alta: { texto: 'var(--ok-fg)', seta: '▲', palavra: 'alta' },
  queda: { texto: 'var(--erro-fg)', seta: '▼', palavra: 'queda' },
  estavel: { texto: 'var(--cinza-3)', seta: '▬', palavra: 'estável' },
} as const;

export function CartoesDaJanela({ kpis }: { kpis: KpisDaJanela }) {
  return (
    <div
      role="list"
      aria-label="Indicadores da janela"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 10,
      }}
    >
      <Cartao
        rotulo="Índice atual"
        ajuda="O valor do último mês da janela escolhida na linha do tempo abaixo do gráfico."
        valor={kpis.atual}
      />
      <Cartao
        rotulo="Pico"
        ajuda="O maior valor da janela, entre os meses medidos por 4 lentes ou mais. Um mês com menos lentes tem número legítimo pela fórmula, mas não se compara com os outros."
        valor={kpis.pico}
        vazio="Nenhum mês medido por 4 lentes ou mais"
      />
      <Cartao
        rotulo="Vale"
        ajuda="O menor valor da janela, entre os meses medidos por 4 lentes ou mais. Um mês com menos lentes tem número legítimo pela fórmula, mas não se compara com os outros."
        valor={kpis.vale}
        vazio="Nenhum mês medido por 4 lentes ou mais"
      />
      <CartaoDaVariacao kpis={kpis} />
    </div>
  );
}

const NUMERO = {
  fontSize: 30,
  fontWeight: 800,
  lineHeight: 1,
  letterSpacing: '-0.01em',
  color: 'var(--cinza-4)',
  margin: '3px 0 2px',
} as const;

function Moldura({ children }: { children: ReactNode }) {
  return (
    <div
      role="listitem"
      style={{
        padding: '6px 12px 7px',
        borderRadius: 'var(--r-card-int)',
        border: '1px solid var(--borda)',
        background: 'var(--branco)',
        display: 'flex',
        flexDirection: 'column',
        //: CENTRALIZADO, por pedido: o número é o assunto do cartão, e no
        //: centro ele se lê como um placar, não como um formulário.
        alignItems: 'center',
        textAlign: 'center',
        gap: 0,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

function Rotulo({ texto, ajuda }: { texto: string; ajuda: string }) {
  return (
    <span
      className="kicker"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cinza-2)' }}
    >
      {texto}
      <Ajuda texto={ajuda} />
    </span>
  );
}

function Cartao({
  rotulo,
  ajuda,
  valor,
  vazio = '—',
}: {
  rotulo: string;
  ajuda: string;
  valor: ValorDoMes | null;
  vazio?: string;
}) {
  return (
    <Moldura>
      <Rotulo texto={rotulo} ajuda={ajuda} />
      {valor ? (
        <>
          <span className="tabular" style={NUMERO}>
            {valor.valor}
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--cinza-2)' }}>{valor.rotuloDoMes}</span>
        </>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>{vazio}</span>
      )}
    </Moldura>
  );
}

function CartaoDaVariacao({ kpis }: { kpis: KpisDaJanela }) {
  const variacao = kpis.variacao;
  const ajuda =
    'O último mês da janela menos o primeiro, em pontos do índice. Alta em verde, queda em vermelho, sem mudança em cinza.';
  if (!variacao) {
    return (
      <Moldura>
        <Rotulo texto="Variação no período" ajuda={ajuda} />
        <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>Um mês só na janela</span>
      </Moldura>
    );
  }
  const cor = COR_DO_SENTIDO[variacao.sentido];
  const sinal = variacao.pontos > 0 ? '+' : variacao.pontos < 0 ? '−' : '';
  return (
    <Moldura>
      <Rotulo texto="Variação no período" ajuda={ajuda} />
      {/* A SETA JUNTO DO NÚMERO, na cor dele, em vez de uma etiqueta à parte;
          a palavra (alta, queda, estável) vai na linha de baixo — a cor nunca
          é a única pista. */}
      <span className="tabular" style={{ ...NUMERO, color: cor.texto }}>
        <span aria-hidden style={{ fontSize: 18, marginRight: 6, verticalAlign: '0.25em' }}>
          {cor.seta}
        </span>
        {sinal}
        {Math.abs(variacao.pontos)}
      </span>
      <span style={{ fontSize: 11.5, color: 'var(--cinza-2)' }}>
        <strong style={{ color: cor.texto, fontWeight: 700 }}>{cor.palavra}</strong> ·{' '}
        {variacao.de.rotuloDoMes} → {variacao.ate.rotuloDoMes}
      </span>
    </Moldura>
  );
}
