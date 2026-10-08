/** A mini linha do tempo abaixo da Jornada: todo o histórico em barras finas,
 *  e a janela que o gráfico de cima mostra.
 *
 *  UMA BARRA POR MÊS MEDIDO, e não uma sparkline: com poucos meses (a base
 *  nova tem três), uma linha vira um traço sem forma, e a barra continua
 *  dizendo "aqui há um mês, e ele foi alto ou baixo". A altura é relativa ao
 *  histórico inteiro — é um mapa para se achar, não uma régua para medir.
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
import { coberturaDoMes } from '@/dominio/jornadaDoIndice';
import { mesCurto } from '@/dominio/dossie';
import type { PontoDaSerie } from '@/dominio/score';

type Gesto = 'mover' | 'inicio' | 'fim';

export function SeletorDeJanela({
  meses,
  janela,
  aoMudar,
}: {
  /** Só os meses medidos, na ordem — os mesmos que a curva desenha. */
  meses: PontoDaSerie[];
  janela: Janela;
  aoMudar: (janela: Janela) => void;
}) {
  const trilho = useRef<HTMLDivElement>(null);
  //: O ARRASTE EM ANDAMENTO, numa ref: ele é lido a cada movimento do ponteiro,
  //: e no estado cada pixel re-renderizaria o painel inteiro duas vezes.
  const arraste = useRef<{ gesto: Gesto; x: number; janela: Janela } | null>(null);

  const total = meses.length;
  if (total < 2) return null;

  const valores = meses.map((ponto) => ponto.isr as number);
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  const altura = (valor: number) =>
    maximo === minimo ? 60 : 20 + ((valor - minimo) / (maximo - minimo)) * 80;

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
          height: 44,
          display: 'grid',
          gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))`,
          alignItems: 'end',
          padding: '0',
          background: 'var(--bg-trilho)',
          borderRadius: 6,
          cursor: 'pointer',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {meses.map((ponto) => (
          <span
            key={ponto.mes}
            aria-hidden
            title={`${mesComAno(ponto.mes)}: ${ponto.isr}${coberturaDoMes(ponto.lentes) ? ` (${coberturaDoMes(ponto.lentes)})` : ''}`}
            style={{
              justifySelf: 'center',
              width: 'min(70%, 10px)',
              height: `${altura(ponto.isr as number) * 0.36}px`,
              borderRadius: '2px 2px 0 0',
              background: 'var(--azul-mar)',
              //: O MÊS PARCIAL É MAIS CLARO, como o ponto oco no gráfico: o
              //: mesmo aviso, na mesma linguagem, nas duas vistas.
              opacity: coberturaDoMes(ponto.lentes) ? 0.35 : 0.8,
              marginBottom: 4,
            }}
          />
        ))}

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
            top: 0,
            bottom: 0,
            left: `${esquerda}%`,
            width: `${largura}%`,
            border: '2px solid var(--azul-mar)',
            borderRadius: 6,
            background: 'rgba(0, 39, 189, 0.06)',
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

const VEU = {
  position: 'absolute' as const,
  top: 0,
  bottom: 0,
  background: 'rgba(244, 246, 252, 0.72)',
  pointerEvents: 'none' as const,
};

/** Uma borda da janela, com alvo de 14px — a borda desenhada tem 2px, e
 *  acertá-la seria pontaria. */
function Alca({
  borda,
  meses,
  janela,
  total,
  aoComecar,
  aoTeclar,
}: {
  borda: 'inicio' | 'fim';
  meses: PontoDaSerie[];
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
        top: '50%',
        [borda === 'inicio' ? 'left' : 'right']: -8,
        transform: 'translateY(-50%)',
        width: 14,
        height: 26,
        borderRadius: 4,
        background: 'var(--branco)',
        border: '2px solid var(--azul-mar)',
        cursor: 'ew-resize',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span aria-hidden style={{ width: 2, height: 10, borderRadius: 1, background: 'var(--azul-mar)' }} />
    </span>
  );
}
