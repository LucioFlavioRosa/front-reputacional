/** O navegador do período: um mini gráfico com a janela arrastável embaixo do
 *  gráfico de bonds.
 *
 *  O PEDIDO (21/10/2026): "navegador abaixo do gráfico, mini gráfico com janela
 *  arrastável e alças nas laterais, como na Jornada", sincronizado com os
 *  atalhos (1M, 3M...). O `SeletorDeJanela` da Jornada trabalha em MESES (os
 *  índices dos meses medidos) e não serve a uma série diária; este é o mesmo
 *  gesto em DIAS.
 *
 *  TRÊS GESTOS, todos com o ponteiro: arrastar o MEIO move a janela, arrastar
 *  uma ALÇA estica aquele lado, clicar FORA leva a janela até ali. E pelo
 *  teclado: setas movem uma semana; Shift + setas esticam o fim.
 */

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';

import {
  DIAS_MINIMOS_DA_JANELA,
  diasNaJanela,
  moverJanelaEmDias,
  prenderJanela,
  rotuloDaJanela,
  somarDias,
} from '@/dominio/cotacoesDosBonds';
import type { JanelaDoPeriodo } from '@/dominio/cotacoesDosBonds';

const ALTURA = 52;
const LARGURA_DA_ALCA = 8;
const UM_DIA = 24 * 60 * 60 * 1000;

export type { JanelaDoPeriodo };

function emMs(iso: string): number {
  return Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
}

function comoIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function NavegadorDoPeriodo({
  pontos,
  inicio,
  fim,
  janela,
  aoMudar,
  cor = 'var(--azul-mar)',
}: {
  /** A série do mini gráfico (a de um bond da Aegea), em `YYYY-MM-DD`. */
  pontos: { data: string; valor: number }[];
  /** O começo e o fim do eixo do navegador: todo o dado disponível. */
  inicio: string;
  fim: string;
  janela: JanelaDoPeriodo;
  aoMudar: (janela: JanelaDoPeriodo) => void;
  cor?: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, definirLargura] = useState(0);
  const arrasto = useRef<{
    modo: 'mover' | 'de' | 'ate';
    x: number;
    janela: JanelaDoPeriodo;
  } | null>(null);

  useEffect(() => {
    const alvo = caixa.current;
    if (!alvo) return;
    const observador = new ResizeObserver((entradas) => {
      const entrada = entradas[0];
      if (entrada) definirLargura(entrada.contentRect.width);
    });
    observador.observe(alvo);
    return () => observador.disconnect();
  }, []);

  const msInicio = emMs(inicio);
  const msFim = Math.max(emMs(fim), msInicio + UM_DIA);
  const x = (iso: string) => ((emMs(iso) - msInicio) / (msFim - msInicio)) * largura;
  const diasPorPixel = largura > 0 ? (msFim - msInicio) / UM_DIA / largura : 0;
  const dataNoPixel = (px: number) =>
    comoIso(msInicio + Math.round((Math.min(largura, Math.max(0, px)) / largura) * ((msFim - msInicio) / UM_DIA)) * UM_DIA);

  const valores = pontos.map((p) => p.valor);
  const minimo = valores.length ? Math.min(...valores) : 0;
  const maximo = valores.length ? Math.max(...valores) : 1;
  const y = (valor: number) =>
    4 + (ALTURA - 8) * (1 - (valor - minimo) / Math.max(1e-9, maximo - minimo));
  const caminho = pontos
    .filter((p) => p.data.slice(0, 10) >= inicio && p.data.slice(0, 10) <= fim)
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.data).toFixed(1)},${y(p.valor).toFixed(1)}`)
    .join(' ');

  const xDe = x(janela.de);
  const xAte = x(janela.ate);

  const pxDoEvento = (evento: { clientX: number }) =>
    evento.clientX - (caixa.current?.getBoundingClientRect().left ?? 0);

  const aoApertar = (evento: ReactPointerEvent<SVGSVGElement>) => {
    const px = pxDoEvento(evento);
    let modo: 'mover' | 'de' | 'ate';
    let base = janela;
    if (Math.abs(px - xDe) <= LARGURA_DA_ALCA) modo = 'de';
    else if (Math.abs(px - xAte) <= LARGURA_DA_ALCA) modo = 'ate';
    else if (px > xDe && px < xAte) modo = 'mover';
    else {
      //: CLICAR FORA LEVA A JANELA ATÉ ALI, centrada no clique, e o arrasto
      //: continua dali: é o gesto da Jornada.
      const meio = Math.round((diasNaJanela(janela.de, janela.ate) - 1) / 2);
      base = moverJanelaEmDias(
        { de: somarDias(dataNoPixel(px), -meio), ate: somarDias(dataNoPixel(px), -meio + diasNaJanela(janela.de, janela.ate) - 1) },
        0,
        inicio,
        fim,
      );
      aoMudar(base);
      modo = 'mover';
    }
    evento.currentTarget.setPointerCapture?.(evento.pointerId);
    arrasto.current = { modo, x: px, janela: base };
  };

  const aoMover = (evento: ReactPointerEvent<SVGSVGElement>) => {
    const atual = arrasto.current;
    if (!atual || diasPorPixel <= 0) return;
    const dias = Math.round((pxDoEvento(evento) - atual.x) * diasPorPixel);
    if (atual.modo === 'mover') {
      aoMudar(moverJanelaEmDias(atual.janela, dias, inicio, fim));
    } else if (atual.modo === 'de') {
      const de = somarDias(atual.janela.de, dias);
      const limite = somarDias(atual.janela.ate, -(DIAS_MINIMOS_DA_JANELA - 1));
      aoMudar(prenderJanela({ de: de > limite ? limite : de, ate: atual.janela.ate }, inicio, fim));
    } else {
      const ate = somarDias(atual.janela.ate, dias);
      const limite = somarDias(atual.janela.de, DIAS_MINIMOS_DA_JANELA - 1);
      aoMudar(prenderJanela({ de: atual.janela.de, ate: ate < limite ? limite : ate }, inicio, fim));
    }
  };

  const soltar = () => {
    arrasto.current = null;
  };

  const aoTeclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return;
    evento.preventDefault();
    const passo = evento.key === 'ArrowLeft' ? -7 : 7;
    if (evento.shiftKey) {
      aoMudar(prenderJanela({ de: janela.de, ate: somarDias(janela.ate, passo) }, inicio, fim));
    } else {
      aoMudar(moverJanelaEmDias(janela, passo, inicio, fim));
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
      <div
        ref={caixa}
        role="group"
        tabIndex={0}
        aria-label={`Período do gráfico: ${rotuloDaJanela(janela.de, janela.ate)}. Setas movem uma semana; Shift e setas esticam o fim.`}
        onKeyDown={aoTeclar}
        style={{ flex: 1, minWidth: 0, height: ALTURA, outlineOffset: 2 }}
      >
        {largura > 0 ? (
          <svg
            width={largura}
            height={ALTURA}
            data-testid="navegador-do-periodo"
            style={{ display: 'block', cursor: 'grab', touchAction: 'none' }}
            onPointerDown={aoApertar}
            onPointerMove={aoMover}
            onPointerUp={soltar}
            onPointerCancel={soltar}
          >
            <rect x={0} y={0} width={largura} height={ALTURA} fill="var(--bg-trilho)" />
            <path d={caminho} fill="none" stroke={cor} strokeWidth={1.5} strokeOpacity={0.55} />
            {/* O QUE FICA FORA DA JANELA, apagado. */}
            <rect x={0} y={0} width={Math.max(0, xDe)} height={ALTURA} fill="var(--branco)" opacity={0.6} />
            <rect x={xAte} y={0} width={Math.max(0, largura - xAte)} height={ALTURA} fill="var(--branco)" opacity={0.6} />
            <rect
              data-testid="janela-do-periodo"
              x={xDe}
              y={0.5}
              width={Math.max(2, xAte - xDe)}
              height={ALTURA - 1}
              fill="var(--azul-mar)"
              fillOpacity={0.06}
              stroke="var(--azul-mar)"
              strokeWidth={1}
              style={{ cursor: 'grab' }}
            />
            {[xDe, xAte].map((pos, i) => (
              <rect
                key={i}
                x={pos - LARGURA_DA_ALCA / 2}
                y={ALTURA / 2 - 12}
                width={LARGURA_DA_ALCA}
                height={24}
                rx={2}
                fill="var(--azul-mar)"
                style={{ cursor: 'ew-resize' }}
              />
            ))}
          </svg>
        ) : null}
      </div>
      <span
        data-testid="rotulo-da-janela"
        className="tabular"
        style={{ flex: '0 0 auto', fontSize: 13, fontWeight: 700, color: 'var(--cinza-3)' }}
      >
        {rotuloDaJanela(janela.de, janela.ate)}
      </span>
    </div>
  );
}
