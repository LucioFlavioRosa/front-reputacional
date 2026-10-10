/** A mini linha do tempo abaixo da Jornada: todo o histórico numa linha fina,
 *  e a janela que o gráfico de cima mostra.
 *
 *  UMA LINHA, E NÃO BARRAS, por pedido: o trilho é um mapa para se achar no
 *  tempo, e a linha diz a forma do histórico sem disputar atenção com o
 *  gráfico de cima. A altura é relativa ao histórico inteiro.
 *
 *  A JANELA É A MOLDURA AMARELA do "cortar vídeo" do iPhone, por pedido:
 *  borda grossa em cima e embaixo, alças largas nas laterais com uma seta
 *  apontando para dentro. É um gesto que quase todo mundo já fez, e a moldura
 *  ensina sozinha que as laterais se puxam.
 *
 *  TRÊS GESTOS, os do padrão de mercado: arrastar o bloco desloca, arrastar uma
 *  alça redimensiona, clicar fora da janela a leva para lá. Pelo teclado, no
 *  bloco: setas deslocam, Shift + setas mexem no fim da janela; nas alças, as
 *  setas mexem só naquela borda. Home e End levam ao começo e ao fim.
 *
 *  NENHUMA REGRA DE BORDA AQUI: mínimo de 3 meses, limites e atalhos moram em
 *  `dominio/janelaDaJornada`. Este arquivo converte pixel em mês e desenha.
 */

import { useRef } from 'react';
import type { KeyboardEvent, PointerEvent as PointerDoReact } from 'react';

import {
  ATALHOS_DA_JANELA,
  atalhoDaJanela,
  janelaDoAtalho,
  mesComAno,
  moverJanela,
  redimensionarJanela,
} from '@/dominio/janelaDaJornada';
import type { Janela } from '@/dominio/janelaDaJornada';
import { mesCurto } from '@/dominio/dossie';

/** Um mês do trilho: o mês e a altura da linha naquele mês.
 *
 *  `valor` E NÃO `isr`: o trilho desenha a forma de QUALQUER série mensal — o
 *  índice do Score e o Índice de Exposição a Risco usam o mesmo controle, e
 *  pedir o tipo do Score era o que impedia o segundo de reusá-lo. */
export interface MesDoTrilho {
  mes: string;
  valor: number | null;
}

type Gesto = 'mover' | 'inicio' | 'fim';

export function SeletorDeJanela({
  meses,
  janela,
  aoMudar,
}: {
  /** Só os meses medidos, na ordem — os mesmos que a curva desenha. */
  meses: MesDoTrilho[];
  janela: Janela;
  aoMudar: (janela: Janela) => void;
}) {
  const trilho = useRef<HTMLDivElement>(null);
  //: O ARRASTE EM ANDAMENTO, numa ref: ele é lido a cada movimento do ponteiro,
  //: e no estado cada pixel re-renderizaria o painel inteiro duas vezes.
  const arraste = useRef<{ gesto: Gesto; x: number; janela: Janela } | null>(null);

  const total = meses.length;
  if (total < 2) return null;

  const valores = meses.map((ponto) => ponto.valor ?? 0);
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  //: A LINHA NO CENTRO DE CADA MÊS — o mesmo (i + 0,5)/n do gráfico de cima —,
  //: com folga em cima e embaixo para a moldura não cobrir o traço.
  const linha = valores
    .map((valor, i) => {
      const x = ((i + 0.5) / total) * 1000;
      const y = maximo === minimo ? 50 : 80 - ((valor - minimo) / (maximo - minimo)) * 60;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const ativo = atalhoDaJanela(janela, meses);
  const tamanho = janela.fim - janela.inicio + 1;
  const esquerda = (janela.inicio / total) * 100;
  const largura = (tamanho / total) * 100;
  const descricao = `${mesComAno(meses[janela.inicio].mes)} a ${mesComAno(meses[janela.fim].mes)}, ${tamanho} meses`;

  const aplicar = (gesto: Gesto, passo: number, base: Janela) =>
    gesto === 'mover'
      ? moverJanela(base, passo, total)
      : redimensionarJanela(base, gesto, passo, total);

  const comecar = (gesto: Gesto) => (evento: PointerDoReact<HTMLElement>) => {
    evento.stopPropagation();
    evento.preventDefault();
    (evento.currentTarget as HTMLElement).setPointerCapture?.(evento.pointerId);
    arraste.current = { gesto, x: evento.clientX, janela };
  };

  const mover = (evento: PointerDoReact<HTMLElement>) => {
    const atual = arraste.current;
    const caixa = trilho.current?.getBoundingClientRect();
    if (!atual || !caixa?.width) return;
    //: EM MESES INTEIROS, a partir de onde o arraste começou — e não somando
    //: o passo de cada movimento: somar arredondamentos faria a janela andar
    //: mais devagar que o ponteiro e "escorregar" no fim do gesto.
    const passo = Math.round(((evento.clientX - atual.x) / caixa.width) * total);
    const proxima = aplicar(atual.gesto, passo, atual.janela);
    if (proxima.inicio !== janela.inicio || proxima.fim !== janela.fim) aoMudar(proxima);
  };

  const soltar = () => {
    arraste.current = null;
  };

  //: CLICAR FORA DA JANELA LEVA A JANELA PARA LÁ, centrada no mês clicado.
  const pularPara = (evento: PointerDoReact<HTMLDivElement>) => {
    const caixa = trilho.current?.getBoundingClientRect();
    if (!caixa?.width) return;
    const mes = Math.floor(((evento.clientX - caixa.left) / caixa.width) * total);
    const centro = janela.inicio + Math.floor((tamanho - 1) / 2);
    aoMudar(moverJanela(janela, mes - centro, total));
  };

  const teclado = (gesto: Gesto) => (evento: KeyboardEvent<HTMLElement>) => {
    const passo = evento.key === 'ArrowRight' || evento.key === 'ArrowUp' ? 1
      : evento.key === 'ArrowLeft' || evento.key === 'ArrowDown' ? -1
      : 0;
    if (evento.key === 'Home' || evento.key === 'End') {
      evento.preventDefault();
      const longe = evento.key === 'Home' ? -total : total;
      aoMudar(aplicar(gesto, longe, janela));
      return;
    }
    if (!passo) return;
    evento.preventDefault();
    //: NO BLOCO, SHIFT TROCA "DESLOCAR" POR "REDIMENSIONAR": Shift + → estende o
    //: fim, Shift + ← encolhe. Nas alças o Shift não muda nada — elas já são
    //: uma borda só.
    const efetivo: Gesto = gesto === 'mover' && evento.shiftKey ? 'fim' : gesto;
    aoMudar(aplicar(efetivo, passo, janela));
  };

  return (
    <div className="seletor-de-janela" style={{ marginTop: 14 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 6,
        }}
      >
        <div role="group" aria-label="Atalhos de período" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {ATALHOS_DA_JANELA.map((atalho) => {
            const marcado = ativo === atalho.chave;
            return (
              <button
                key={atalho.chave}
                type="button"
                aria-pressed={marcado}
                title={atalho.descricao}
                onClick={() => aoMudar(janelaDoAtalho(atalho.chave, meses))}
                style={{
                  height: 24,
                  padding: '0 10px',
                  borderRadius: 'var(--r-chip)',
                  border: marcado ? '1px solid var(--azul-mar)' : '1px solid var(--borda-input)',
                  background: marcado ? 'var(--azul-mar)' : 'var(--branco)',
                  color: marcado ? 'var(--branco)' : 'var(--cinza-3)',
                  fontSize: 11.5,
                  fontWeight: marcado ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                {atalho.rotulo}
              </button>
            );
          })}
        </div>
        <span className="tabular" style={{ fontSize: 11.5, color: 'var(--cinza-2)' }} aria-live="polite">
          {mesCurto(meses[janela.inicio].mes)} – {mesCurto(meses[janela.fim].mes)} · {tamanho} meses
        </span>
      </div>

      <div
        ref={trilho}
        onPointerDown={pularPara}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        style={{
          position: 'relative',
          height: 40,
          background: 'var(--branco)',
          border: '1px solid var(--borda)',
          borderRadius: 8,
          cursor: 'pointer',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        <svg
          aria-hidden
          viewBox="0 0 1000 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          <polyline
            points={linha}
            fill="none"
            stroke="var(--azul-mar)"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* FORA DA JANELA, ESMAECIDO: dois véus, um de cada lado. */}
        <span aria-hidden style={{ ...VEU, left: 0, width: `${esquerda}%` }} />
        <span aria-hidden style={{ ...VEU, left: `${esquerda + largura}%`, right: 0 }} />

        <div
          role="slider"
          tabIndex={0}
          aria-roledescription="janela de período"
          aria-label="Janela do gráfico. Setas deslocam; Shift e setas mudam o fim."
          aria-valuemin={0}
          aria-valuemax={total - tamanho}
          aria-valuenow={janela.inicio}
          aria-valuetext={descricao}
          onPointerDown={comecar('mover')}
          onKeyDown={teclado('mover')}
          style={{
            position: 'absolute',
            //: UM PIXEL PARA FORA do trilho, como no iPhone: a moldura abraça a
            //: faixa em vez de ficar dentro dela.
            top: -1,
            bottom: -1,
            left: `${esquerda}%`,
            width: `${largura}%`,
            borderTop: `3px solid ${AMARELO}`,
            borderBottom: `3px solid ${AMARELO}`,
            borderRadius: 8,
            background: 'transparent',
            cursor: 'grab',
            boxSizing: 'border-box',
          }}
        >
          <Alca borda="inicio" meses={meses} janela={janela} total={total} aoComecar={comecar('inicio')} aoTeclar={teclado('inicio')} />
          <Alca borda="fim" meses={meses} janela={janela} total={total} aoComecar={comecar('fim')} aoTeclar={teclado('fim')} />
        </div>
      </div>
    </div>
  );
}

//: O AMARELO DA MARCA (Pequi), que é também o do "cortar vídeo" do iPhone.
const AMARELO = 'var(--amarelo-pequi)';

const VEU = {
  position: 'absolute' as const,
  top: 0,
  bottom: 0,
  background: 'rgba(244, 246, 252, 0.78)',
  pointerEvents: 'none' as const,
};

/** Uma lateral da moldura: a alça amarela larga, com a seta para dentro. É o
 *  alvo grande que a borda fina não seria. */
function Alca({
  borda,
  meses,
  janela,
  total,
  aoComecar,
  aoTeclar,
}: {
  borda: 'inicio' | 'fim';
  meses: MesDoTrilho[];
  janela: Janela;
  total: number;
  aoComecar: (evento: PointerDoReact<HTMLElement>) => void;
  aoTeclar: (evento: KeyboardEvent<HTMLElement>) => void;
}) {
  const indice = borda === 'inicio' ? janela.inicio : janela.fim;
  return (
    <span
      role="slider"
      tabIndex={0}
      aria-label={borda === 'inicio' ? 'Início da janela' : 'Fim da janela'}
      aria-valuemin={0}
      aria-valuemax={total - 1}
      aria-valuenow={indice}
      aria-valuetext={mesComAno(meses[indice].mes)}
      onPointerDown={aoComecar}
      onKeyDown={(evento) => {
        // A TECLA NÃO SOBE AO BLOCO: lá ela deslocaria a janela inteira.
        evento.stopPropagation();
        aoTeclar(evento);
      }}
      style={{
        position: 'absolute',
        //: POR CIMA DAS BORDAS DE CIMA E DE BAIXO, para a moldura fechar sem
        //: emenda nos cantos.
        top: -3,
        bottom: -3,
        [borda === 'inicio' ? 'left' : 'right']: 0,
        width: 14,
        borderRadius: borda === 'inicio' ? '8px 0 0 8px' : '0 8px 8px 0',
        background: AMARELO,
        cursor: 'ew-resize',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg aria-hidden width="7" height="12" viewBox="0 0 7 12">
        <path
          d={borda === 'inicio' ? 'M5.5 1.5 1.5 6l4 4.5' : 'M1.5 1.5 5.5 6l-4 4.5'}
          fill="none"
          stroke="var(--cinza-4)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
