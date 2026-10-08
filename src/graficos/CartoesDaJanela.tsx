/** Os quatro cartões ao lado da Jornada: Índice atual, Pico, Vale e Variação
 *  no período — todos da janela escolhida na mini linha do tempo.
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
import type { ExtremoParcial, KpisDaJanela, ValorDoMes } from '@/dominio/janelaDaJornada';

const COR_DO_SENTIDO = {
  alta: { texto: 'var(--ok-fg)', fundo: 'var(--ok-bg)', seta: '▲', palavra: 'alta' },
  queda: { texto: 'var(--erro-fg)', fundo: 'var(--erro-bg)', seta: '▼', palavra: 'queda' },
  estavel: { texto: 'var(--cinza-3)', fundo: 'var(--bg-trilho)', seta: '▬', palavra: 'estável' },
} as const;

export function CartoesDaJanela({ kpis }: { kpis: KpisDaJanela }) {
  return (
    <div
      role="list"
      aria-label="Indicadores da janela"
      style={{
        display: 'grid',
        //: EMPILHADOS AO LADO DO GRÁFICO, e lado a lado quando a tela estreita e
        //: o painel desce para baixo dele: a mesma grade decide os dois casos.
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 10,
        alignContent: 'start',
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
        parcial={kpis.picoParcial}
        vazio="Nenhum mês medido por 4 lentes ou mais"
      />
      <Cartao
        rotulo="Vale"
        ajuda="O menor valor da janela, entre os meses medidos por 4 lentes ou mais. Um mês com menos lentes tem número legítimo pela fórmula, mas não se compara com os outros."
        valor={kpis.vale}
        parcial={kpis.valeParcial}
        vazio="Nenhum mês medido por 4 lentes ou mais"
      />
      <CartaoDaVariacao kpis={kpis} />
    </div>
  );
}

function Moldura({ children }: { children: ReactNode }) {
  return (
    <div
      role="listitem"
      style={{
        padding: '12px 14px',
        borderRadius: 'var(--r-card-int)',
        border: '1px solid var(--borda)',
        background: 'var(--branco)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

function Rotulo({ texto, ajuda }: { texto: string; ajuda: string }) {
  return (
    <span className="kicker" style={{ display: 'flex', alignItems: 'center', color: 'var(--cinza-2)' }}>
      {texto}
      <Ajuda texto={ajuda} />
    </span>
  );
}

function Cartao({
  rotulo,
  ajuda,
  valor,
  parcial = null,
  vazio = '—',
}: {
  rotulo: string;
  ajuda: string;
  valor: ValorDoMes | null;
  parcial?: ExtremoParcial | null;
  vazio?: string;
}) {
  return (
    <Moldura>
      <Rotulo texto={rotulo} ajuda={ajuda} />
      {valor ? (
        <>
          <span className="tabular" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1, color: 'var(--cinza-4)' }}>
            {valor.valor}
          </span>
          <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>{valor.rotuloDoMes}</span>
        </>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>{vazio}</span>
      )}
      {/* O EXTREMO QUE FICOU DE FORA, dito com discrição: quem olha a curva vê
          aquele ponto mais alto (ou mais baixo), e precisa saber por que o
          cartão não o escolheu. */}
      {parcial ? (
        <span style={{ fontSize: 11, color: 'var(--atencao-fg)', lineHeight: 1.4 }}>
          {parcial.valor} em {parcial.rotuloDoMes} não entra: medido por {parcial.cobertura}
        </span>
      ) : null}
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
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="tabular" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1, color: cor.texto }}>
          {sinal}
          {Math.abs(variacao.pontos)}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 'var(--r-chip)',
            background: cor.fundo,
            color: cor.texto,
            fontSize: 11.5,
            fontWeight: 700,
          }}
        >
          <span aria-hidden>{cor.seta}</span>
          {cor.palavra}
        </span>
      </span>
      <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
        {variacao.de.rotuloDoMes} → {variacao.ate.rotuloDoMes}
      </span>
    </Moldura>
  );
}
