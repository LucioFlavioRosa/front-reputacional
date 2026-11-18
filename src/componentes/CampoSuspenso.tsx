/** Um `CampoDeFiltro` (Área(s), Tipo de Interação, Tipo de Público — ver
 *  `PainelDeFiltros.tsx`) como BOTÃO FECHADO por padrão, que abre um painel
 *  com as pílulas ao clicar — em vez de mostrar a lista inteira sempre
 *  aberta. É o que permite os três campos caberem numa linha só, compacta,
 *  na faixa fixa do Painel — a versão anterior (pílulas sempre à mostra)
 *  ocupava altura demais na tela toda vez que rolava junto.
 *
 *  Continua MULTISSELEÇÃO por dentro do painel — só a exibição fechada
 *  mudou, não a regra de escolher vários valores ao mesmo tempo.
 *
 *  A CASCA (botão fechado + painel flutuante + fecha ao clicar fora) é
 *  `GatilhoSuspenso`, abaixo — extraída por pedido (18/11/2026) pro "Período"
 *  do Painel entrar na mesma linha dos outros filtros, com qualquer conteúdo
 *  dentro, em vez do acordeão cinza que empurrava o resto da tela.
 */

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { GrupoDeCampo } from '@/componentes/PainelDeFiltros';
import type { CampoDeFiltro } from '@/componentes/PainelDeFiltros';
import { normalizarBusca } from '@/dominio/texto';

//: ACIMA DISTO, a lista de pílulas vira "caça-palavras" — por pedido
//: (18/11/2026), especialmente em "Tema", que passa de 100 itens.
const LIMIAR_DA_BUSCA = 8;

export function CampoSuspenso({
  campo,
  aoLimpar,
}: {
  campo: CampoDeFiltro;
  /** Some do painel quando nada está selecionado — não faz sentido "Limpar"
   *  um campo que já está vazio. */
  aoLimpar?: () => void;
}) {
  const [busca, definirBusca] = useState('');
  const destaque = campo.destaque;
  const escolhido = campo.itens.find((item) => item.valor === campo.valorAtual)?.rotulo;

  //: SÓ FILTRA A LISTA DE ITENS — `aoEscolher`/`selecionados` continuam do
  //: `campo` original, então buscar não muda o que já está marcado.
  const buscaNormalizada = normalizarBusca(busca);
  const itensFiltrados = buscaNormalizada
    ? campo.itens.filter((item) => normalizarBusca(item.rotulo).includes(buscaNormalizada))
    : campo.itens;

  const quantidadeSelecionada = campo.multiplo
    ? (campo.selecionados?.length ?? 0)
    : campo.valorAtual != null
      ? 1
      : 0;

  return (
    <GatilhoSuspenso
      rotulo={campo.rotulo}
      destaque={destaque}
      // COM DESTAQUE, O NOME DO ESCOLHIDO no lugar do "· 1": a cor sozinha
      // não pode ser a única pista de qual clima está filtrado.
      resumo={
        (destaque || campo.mostrarEscolhido) && escolhido
          ? escolhido
          : quantidadeSelecionada
            ? String(quantidadeSelecionada)
            : undefined
      }
      // A BUSCA NÃO SOBREVIVE A UM FECHAR — reabrir mostrando só o que
      // sobrou da última vez esconderia item sem aviso nenhum.
      aoFechar={() => definirBusca('')}
    >
      {quantidadeSelecionada > 0 && aoLimpar ? (
        <button type="button" onClick={aoLimpar} style={ESTILO_DO_LIMPAR}>
          Limpar
        </button>
      ) : null}
      {campo.itens.length > LIMIAR_DA_BUSCA ? (
        <input
          type="text"
          value={busca}
          onChange={(evento) => definirBusca(evento.target.value)}
          placeholder={`Buscar em ${campo.rotulo.toLowerCase()}…`}
          aria-label={`Buscar em ${campo.rotulo}`}
          autoFocus
          style={ESTILO_DA_BUSCA}
        />
      ) : null}
      {buscaNormalizada && !itensFiltrados.length ? (
        <div style={{ fontSize: 12, color: 'var(--cinza-2)', padding: '4px 2px' }}>
          Nenhum item encontrado.
        </div>
      ) : (
        <GrupoDeCampo campo={{ ...campo, itens: itensFiltrados }} />
      )}
    </GatilhoSuspenso>
  );
}

/** A casca: botão fechado + painel flutuante que abre por cima do conteúdo
 *  (`position: absolute`, não empurra nada abaixo) + fecha ao clicar fora.
 *  `CampoSuspenso` é o uso de sempre (pílulas, não controlado); "Período" do
 *  Painel usa esta função direto, CONTROLADO (`aberto`/`aoAlternar`) — o
 *  calendário arrastável de dentro precisa poder fechar o painel sozinho ao
 *  soltar qualquer um dos dois cabos, não só ao clicar fora. */
export function GatilhoSuspenso({
  rotulo,
  resumo,
  destaque,
  larguraDoPainel = 340,
  aberto: abertoControlado,
  aoAlternar,
  aoFechar,
  children,
}: {
  rotulo: string;
  /** Mostrado como "· resumo" ao lado do rótulo, no botão fechado. */
  resumo?: string;
  destaque?: { fundo: string; texto: string };
  /** O painel por padrão vai até 340px — o suficiente pra pílulas. Um
   *  conteúdo mais largo (o calendário de Período) pede mais espaço. */
  larguraDoPainel?: number;
  /** Os dois juntos tornam o aberto/fechado CONTROLADO por quem chama — sem
   *  eles, o estado é só desta função (o caso de `CampoSuspenso`). */
  aberto?: boolean;
  aoAlternar?: (aberto: boolean) => void;
  /** Chamado toda vez que o painel fecha, por clique no próprio botão, fora
   *  dele ou por `aoAlternar` externo — nunca ao abrir. */
  aoFechar?: () => void;
  children: ReactNode;
}) {
  const [abertoProprio, definirAbertoProprio] = useState(false);
  const aberto = abertoControlado ?? abertoProprio;
  const refDoContainer = useRef<HTMLDivElement>(null);

  function mudarAberto(proximo: boolean) {
    if (!proximo) aoFechar?.();
    if (aoAlternar) aoAlternar(proximo);
    else definirAbertoProprio(proximo);
  }

  //: FECHA AO CLICAR FORA — o padrão de qualquer dropdown. Só ouve enquanto
  //: está aberto, para não pendurar um listener global o tempo todo.
  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(evento: MouseEvent) {
      if (refDoContainer.current && !refDoContainer.current.contains(evento.target as Node)) {
        mudarAberto(false);
      }
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  return (
    <div ref={refDoContainer} style={{ position: 'relative', flex: '1 1 180px', minWidth: 150 }}>
      <button
        type="button"
        onClick={() => mudarAberto(!aberto)}
        aria-expanded={aberto}
        style={
          destaque
            ? { ...ESTILO_DO_GATILHO, background: destaque.fundo, color: destaque.texto }
            : ESTILO_DO_GATILHO
        }
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {rotulo}
          {resumo ? ` · ${resumo}` : ''}
        </span>
        <SetaSuspensa aberto={aberto} />
      </button>

      {aberto ? (
        <div style={{ ...ESTILO_DO_PAINEL, minWidth: larguraDoPainel, maxWidth: Math.max(340, larguraDoPainel) }}>
          {children}
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

//: UM POUCO MAIS DE PESO que o botão fino de "Filtro avançado" acima (peso
//: 600, não 500) — o bastante para não competir em pé de igualdade com ele
//: —, mas COMPACTO: a versão anterior (38px, 14px, peso 700) ocupava altura
//: e largura demais na faixa fixa, por pedido.
const ESTILO_DO_GATILHO: CSSProperties = {
  width: '100%',
  height: 32,
  padding: '0 12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
  background: 'var(--branco)',
  border: '1px solid transparent',
  borderRadius: 'var(--r-btn)',
  color: 'var(--cinza-4)',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
};

const ESTILO_DA_BUSCA: CSSProperties = {
  width: '100%',
  height: 28,
  padding: '0 8px',
  marginBottom: 8,
  border: '1px solid var(--borda-input)',
  borderRadius: 'var(--r-chip)',
  fontSize: 12.5,
  color: 'var(--cinza-4)',
  boxSizing: 'border-box',
};

const ESTILO_DO_PAINEL: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  left: 0,
  zIndex: 26,
  minWidth: 260,
  maxWidth: 340,
  background: 'var(--branco)',
  border: '1px solid var(--borda)',
  borderRadius: 'var(--r-card-int)',
  boxShadow: 'var(--sh-tooltip)',
  padding: '10px 12px',
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
