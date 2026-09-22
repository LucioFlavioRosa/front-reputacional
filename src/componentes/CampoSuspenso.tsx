/** Um `CampoDeFiltro` (Área(s), Tipo de Interação, Tipo de Público — ver
 *  `PainelDeFiltros.tsx`) como BOTÃO FECHADO por padrão, que abre um painel
 *  com as pílulas ao clicar — em vez de mostrar a lista inteira sempre
 *  aberta. É o que permite os três campos caberem numa linha só, compacta,
 *  na faixa fixa do Painel — a versão anterior (pílulas sempre à mostra)
 *  ocupava altura demais na tela toda vez que rolava junto.
 *
 *  Continua MULTISSELEÇÃO por dentro do painel — só a exibição fechada
 *  mudou, não a regra de escolher vários valores ao mesmo tempo.
 */

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { GrupoDeCampo } from '@/componentes/PainelDeFiltros';
import type { CampoDeFiltro } from '@/componentes/PainelDeFiltros';

export function CampoSuspenso({
  campo,
  aoLimpar,
}: {
  campo: CampoDeFiltro;
  /** Some do painel quando nada está selecionado — não faz sentido "Limpar"
   *  um campo que já está vazio. */
  aoLimpar?: () => void;
}) {
  const [aberto, definirAberto] = useState(false);
  const refDoContainer = useRef<HTMLDivElement>(null);

  const quantidadeSelecionada = campo.multiplo
    ? (campo.selecionados?.length ?? 0)
    : campo.valorAtual != null
      ? 1
      : 0;

  //: FECHA AO CLICAR FORA — o padrão de qualquer dropdown. Só ouve enquanto
  //: está aberto, para não pendurar um listener global o tempo todo.
  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(evento: MouseEvent) {
      if (refDoContainer.current && !refDoContainer.current.contains(evento.target as Node)) {
        definirAberto(false);
      }
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [aberto]);

  return (
    <div ref={refDoContainer} style={{ position: 'relative', flex: '1 1 180px', minWidth: 150 }}>
      <button
        type="button"
        onClick={() => definirAberto((v) => !v)}
        aria-expanded={aberto}
        style={ESTILO_DO_GATILHO}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {campo.rotulo}
          {quantidadeSelecionada ? ` · ${quantidadeSelecionada}` : ''}
        </span>
        <SetaSuspensa aberto={aberto} />
      </button>

      {aberto ? (
        <div style={ESTILO_DO_PAINEL}>
          {quantidadeSelecionada > 0 && aoLimpar ? (
            <button type="button" onClick={aoLimpar} style={ESTILO_DO_LIMPAR}>
              Limpar
            </button>
          ) : null}
          <GrupoDeCampo campo={campo} />
        </div>
      ) : null}
    </div>
  );
}

/** Exportada — `Painel.tsx` reaproveita para o cabeçalho retrátil de
 *  "Período", pela mesma lógica visual: mesma seta, mesmo giro de 180°. */
export function SetaSuspensa({ aberto }: { aberto: boolean }) {
  return (
    <svg
      aria-hidden
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      style={{ flexShrink: 0, transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
    >
      <path
        d="M3.2 6 8 10.4 12.8 6"
        stroke="var(--cinza-3)"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

//: MAIOR ÊNFASE que o resto da faixa de propósito — são os filtros que mais
//: amarram com o Painel (ver `campoDeAreaPorCategoria`), e precisavam se
//: destacar mais do botão fino de "Filtro avançado" acima, não competir em
//: pé de igualdade com ele.
const ESTILO_DO_GATILHO: CSSProperties = {
  width: '100%',
  height: 38,
  padding: '0 14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  background: 'var(--branco)',
  border: '1px solid transparent',
  borderRadius: 'var(--r-btn)',
  color: 'var(--cinza-4)',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};

const ESTILO_DO_PAINEL: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  left: 0,
  zIndex: 26,
  minWidth: 280,
  maxWidth: 360,
  background: 'var(--branco)',
  border: '1px solid var(--borda)',
  borderRadius: 'var(--r-card-int)',
  boxShadow: 'var(--sh-tooltip)',
  padding: '12px 14px',
};

const ESTILO_DO_LIMPAR: CSSProperties = {
  display: 'block',
  marginLeft: 'auto',
  marginBottom: 8,
  background: 'transparent',
  border: 'none',
  color: 'var(--azul-mar)',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  padding: 0,
};
