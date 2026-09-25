/** O período como uma trilha arrastável — DOIS cabos, um para cada lado de
 *  "hoje": arrastar o esquerdo encurta/alonga o passado, o direito faz o
 *  mesmo com o futuro. Complementa (não substitui) os atalhos de "Período"
 *  dentro de "Filtro avançado" — aquele é para quem já sabe o número (30/60/
 *  90...), este é para quem quer "mais um pouco" ou "bem menos", olhando o
 *  resultado mudar em tempo real.
 *
 *  ESCALA FIXA DE -360 A +360 DIAS, a mesma de `ATALHOS_DE_PERIODO`
 *  (`dominio/recorte.ts`) — arrastar até a ponta cobre o mesmo alcance do
 *  atalho "Últimos/Próximos 360 dias".
 *
 *  SÓ ESCREVE `recorte.de`/`recorte.ate` (datas customizadas), nunca
 *  `periodoPassado`/`periodoFuturo`: arrastar é sempre "este dia exato", não
 *  "este atalho". Ver `intervalo()` em `dominio/recorte.ts`, que já resolve
 *  os dois jeitos (atalho OU data customizada) num só par de datas — é dali
 *  que este componente parte para desenhar a posição inicial dos cabos.
 *
 *  DESENHADO PARA A FAIXA TURQUESA fixa do Painel (`--turquesa-rio` por
 *  trás) — as cores do cabo e da trilha partem desse fundo, não são
 *  genéricas o bastante para outro lugar ainda.
 */

import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { dataCompleta, dataCurta, paraIso } from '@/dominio/formato';
import { intervalo } from '@/dominio/recorte';
import type { Recorte } from '@/dominio/recorte';

const LIMITE_EM_DIAS = 360;

function meiaNoiteDeHoje(): Date {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
}

function deHaDias(dias: number): string {
  const data = meiaNoiteDeHoje();
  data.setDate(data.getDate() - dias);
  return paraIso(data);
}

function ateEmDias(dias: number): string {
  const data = meiaNoiteDeHoje();
  data.setDate(data.getDate() + dias);
  return paraIso(data);
}

/** Dias atrás de `hoje`, como número NEGATIVO (ou zero) — a mesma
 *  convenção do eixo da trilha, onde a ponta esquerda é `-LIMITE_EM_DIAS`.
 *  Sem `de` no recorte, o cabo nasce na ponta: nada arrastado ainda não é
 *  "hoje", é "o alcance inteiro à disposição". */
function offsetDoInicio(de: Date | undefined, hoje: Date): number {
  if (!de) return -LIMITE_EM_DIAS;
  const dias = Math.round((hoje.getTime() - de.getTime()) / 86_400_000);
  return Math.max(-LIMITE_EM_DIAS, Math.min(0, -dias));
}

/** Espelho de `offsetDoInicio`, para o lado do futuro. */
function offsetDoFim(ate: Date | undefined, hoje: Date): number {
  if (!ate) return LIMITE_EM_DIAS;
  const dias = Math.round((ate.getTime() - hoje.getTime()) / 86_400_000);
  return Math.min(LIMITE_EM_DIAS, Math.max(0, dias));
}

/** Dias em texto — "1 ano" só no valor redondo de `LIMITE_EM_DIAS`, "N meses"
 *  em múltiplos de 30, dia a dia no resto. Só para a legenda ao lado do
 *  título; a trilha e as pílulas de atalho continuam contando em dias. */
function descreverDias(dias: number): string {
  if (dias === LIMITE_EM_DIAS) return '1 ano';
  if (dias > 0 && dias % 30 === 0) {
    const meses = dias / 30;
    return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  }
  return `${dias} ${dias === 1 ? 'dia' : 'dias'}`;
}

export function FiltroDePeriodoArrastavel({
  recorte,
  definirRecorte,
  aoConcluir,
}: {
  recorte: Recorte;
  definirRecorte: (recorte: Recorte) => void;
  /** Chamado depois de soltar QUALQUER um dos dois cabos — por pedido, para
   *  quem chama poder recolher o painel de "Período" assim que uma seleção
   *  termina, em vez de esperar um clique manual na seta. */
  aoConcluir?: () => void;
}) {
  const refDaTrilha = useRef<HTMLDivElement>(null);
  //: UMA VEZ SÓ POR MONTAGEM — a tela não fica aberta dias a fio, e recalcular
  //: a cada render só para pegar a virada da meia-noite não vale a
  //: complexidade de um `useEffect` com temporizador.
  const [hoje] = useState(meiaNoiteDeHoje);

  const { de, ate } = intervalo(recorte, hoje);
  const derivadoInicio = offsetDoInicio(de, hoje);
  const derivadoFim = offsetDoFim(ate, hoje);

  //: MESMO PADRÃO de `CampoDePeriodo` (`PainelDeFiltros.tsx`): o valor
  //: "oficial" vem do recorte, mas arrastar precisa de um estado local que
  //: acompanha o dedo/mouse a cada pixel, sem disparar `definirRecorte` (e a
  //: rebusca que vem junto) a cada um deles — só ao soltar. Comparar com o
  //: valor anterior a cada render é o que resincroniza quando o recorte muda
  //: por fora (um atalho, o botão Limpar), sem apagar um arraste em curso.
  const [anteriorInicio, definirAnteriorInicio] = useState(derivadoInicio);
  const [inicio, definirInicio] = useState(derivadoInicio);
  if (derivadoInicio !== anteriorInicio) {
    definirAnteriorInicio(derivadoInicio);
    definirInicio(derivadoInicio);
  }

  const [anteriorFim, definirAnteriorFim] = useState(derivadoFim);
  const [fim, definirFim] = useState(derivadoFim);
  if (derivadoFim !== anteriorFim) {
    definirAnteriorFim(derivadoFim);
    definirFim(derivadoFim);
  }

  function offsetNoPonteiro(clientX: number): number {
    const trilha = refDaTrilha.current;
    if (!trilha) return 0;
    const retangulo = trilha.getBoundingClientRect();
    const fracao = Math.min(1, Math.max(0, (clientX - retangulo.left) / retangulo.width));
    return Math.round(fracao * 2 * LIMITE_EM_DIAS - LIMITE_EM_DIAS);
  }

  function commitInicio(offset: number) {
    const proximo = { ...recorte, de: deHaDias(-offset) };
    delete proximo.periodoPassado;
    definirRecorte(proximo);
    aoConcluir?.();
  }

  function commitFim(offset: number) {
    const proximo = { ...recorte, ate: ateEmDias(offset) };
    delete proximo.periodoFuturo;
    definirRecorte(proximo);
    aoConcluir?.();
  }

  const percentualInicio = ((inicio + LIMITE_EM_DIAS) / (2 * LIMITE_EM_DIAS)) * 100;
  const percentualFim = ((fim + LIMITE_EM_DIAS) / (2 * LIMITE_EM_DIAS)) * 100;
  const percentualDeHoje = 50;

  //: A LEGENDA AO LADO DO TÍTULO diz o que já está pré-selecionado — "Filtro
  //: padrão" só quando os dois cabos ainda estão nas pontas (ninguém
  //: arrastou nada); depois de um arraste, o texto descreve o alcance atual
  //: sem chamá-lo de "padrão".
  const noPadrao = inicio === -LIMITE_EM_DIAS && fim === LIMITE_EM_DIAS;
  const descricaoDoPeriodo = noPadrao
    ? `filtro padrão de ${descreverDias(LIMITE_EM_DIAS)} atrás até ${descreverDias(LIMITE_EM_DIAS)} para frente`
    : `${descreverDias(Math.abs(inicio))} atrás até ${descreverDias(fim)} para frente`;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <div style={ESTILO_DO_ROTULO}>Arraste o período</div>
        <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--cinza-2)' }}>
          {descricaoDoPeriodo}
        </span>
      </div>
      <div
        ref={refDaTrilha}
        style={{
          position: 'relative',
          height: 24,
          margin: '4px 8px 0',
        }}
      >
        {/* A TRILHA — fina, atrás dos cabos. */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: 4,
            borderRadius: 2,
            background: 'rgba(0,49,44,0.18)',
            transform: 'translateY(-50%)',
          }}
        />
        {/* A FAIXA ATIVA — entre os dois cabos, o trecho que o filtro cobre. */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: `${percentualInicio}%`,
            width: `${Math.max(0, percentualFim - percentualInicio)}%`,
            height: 4,
            borderRadius: 2,
            background: 'var(--azul-mar)',
            transform: 'translateY(-50%)',
          }}
        />
        {/* "HOJE" — marca fixa no meio, o pino de onde os dois cabos partem. */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            left: `${percentualDeHoje}%`,
            width: 2,
            height: 11,
            background: 'var(--sobre-turquesa)',
            opacity: 0.5,
            transform: 'translate(-50%, -50%)',
          }}
        />

        <CaboDaTrilha
          rotulo="Início do período"
          posicaoPercentual={percentualInicio}
          valorMinimo={-LIMITE_EM_DIAS}
          valorMaximo={0}
          valorAtual={inicio}
          aoArrastar={(offset) => definirInicio(Math.min(0, Math.max(-LIMITE_EM_DIAS, offset)))}
          aoSoltar={commitInicio}
          offsetNoPonteiro={offsetNoPonteiro}
        />
        <CaboDaTrilha
          rotulo="Fim do período"
          posicaoPercentual={percentualFim}
          valorMinimo={0}
          valorMaximo={LIMITE_EM_DIAS}
          valorAtual={fim}
          aoArrastar={(offset) => definirFim(Math.max(0, Math.min(LIMITE_EM_DIAS, offset)))}
          aoSoltar={commitFim}
          offsetNoPonteiro={offsetNoPonteiro}
        />
      </div>

      {/* "HOJE" — logo abaixo da marca central da trilha (o traço em
          `percentualDeHoje`), e não dentro da faixa de 32px da trilha: ali
          não sobra altura para um rótulo sem disputar espaço com os
          triângulos dos cabos quando algum deles passa perto do meio. */}
      <div style={{ textAlign: 'center', marginTop: 2 }}>
        <span
          className="tabular"
          style={{ fontSize: 11, fontWeight: 700, color: 'var(--sobre-turquesa)' }}
        >
          Hoje {dataCompleta(paraIso(hoje))}
        </span>
      </div>

      <div
        className="tabular"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
          fontSize: 11.5,
          fontWeight: 600,
          color: 'var(--sobre-turquesa)',
        }}
      >
        <span>{dataCurta(deHaDias(-inicio))} · {Math.abs(inicio)} {Math.abs(inicio) === 1 ? 'dia atrás' : 'dias atrás'}</span>
        <span>{dataCurta(ateEmDias(fim))} · {fim === 0 ? 'hoje' : `${fim} ${fim === 1 ? 'dia à frente' : 'dias à frente'}`}</span>
      </div>
    </div>
  );
}

/** Um dos dois cabos da trilha — mesmo comportamento dos dois lados, só o
 *  alcance (`valorMinimo`/`valorMaximo`) muda entre "Início" e "Fim".
 *
 *  `setPointerCapture` é o que permite arrastar o mouse para FORA do cabo
 *  sem perder o gesto no meio do caminho — o elemento continua recebendo
 *  `pointermove`/`pointerup` até o dedo/botão soltar, não só enquanto o
 *  cursor sobrevoa ele. */
function CaboDaTrilha({
  rotulo,
  posicaoPercentual,
  valorMinimo,
  valorMaximo,
  valorAtual,
  aoArrastar,
  aoSoltar,
  offsetNoPonteiro,
}: {
  rotulo: string;
  posicaoPercentual: number;
  valorMinimo: number;
  valorMaximo: number;
  valorAtual: number;
  aoArrastar: (offset: number) => void;
  aoSoltar: (offset: number) => void;
  offsetNoPonteiro: (clientX: number) => number;
}) {
  function mover(evento: ReactPointerEvent<HTMLDivElement>) {
    if (evento.buttons !== 1) return;
    aoArrastar(offsetNoPonteiro(evento.clientX));
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={rotulo}
      aria-valuemin={valorMinimo}
      aria-valuemax={valorMaximo}
      aria-valuenow={valorAtual}
      onPointerDown={(evento) => evento.currentTarget.setPointerCapture(evento.pointerId)}
      onPointerMove={mover}
      onPointerUp={() => aoSoltar(valorAtual)}
      onLostPointerCapture={() => aoSoltar(valorAtual)}
      onKeyDown={(evento) => {
        if (evento.key === 'ArrowLeft' || evento.key === 'ArrowDown') {
          const novo = Math.max(valorMinimo, valorAtual - 1);
          aoArrastar(novo);
          aoSoltar(novo);
        } else if (evento.key === 'ArrowRight' || evento.key === 'ArrowUp') {
          const novo = Math.min(valorMaximo, valorAtual + 1);
          aoArrastar(novo);
          aoSoltar(novo);
        }
      }}
      style={{
        // TRIÂNGULO, não bolinha — a ponta toca exatamente a trilha (por
        // isso `translate(-50%, -100%)`, e não `-50%`: a base fica acima da
        // linha, e só a ponta encosta nela, como um pino apontando a data).
        position: 'absolute',
        top: '50%',
        left: `${posicaoPercentual}%`,
        width: 15,
        height: 13,
        clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
        background: 'var(--azul-mar)',
        filter: 'drop-shadow(0 1px 3px rgba(0,25,120,0.4))',
        transform: 'translate(-50%, -100%)',
        cursor: 'grab',
        touchAction: 'none',
      }}
    />
  );
}

const ESTILO_DO_ROTULO = {
  fontSize: 12.5,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  color: 'var(--sobre-turquesa)',
  marginBottom: 4,
};
