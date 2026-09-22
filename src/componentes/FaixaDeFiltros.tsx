/** A FAIXA FIXA DE FILTROS — turquesa, "Filtros:" e os gatilhos fechados
 *  (`CampoSuspenso`) numa linha só. Nasceu no Painel (Área(s), Tipo de
 *  Interação, Tipo de Público); a Preparar agenda usa a MESMA faixa com o
 *  Tema na frente — quem aprendeu a filtrar numa tela filtra igual na outra.
 *
 *  UM SÓ `position: sticky`, colado em `top: var(--altura-cabecalho)` (a
 *  altura real do `<header>` azul, medida e publicada por `Layout.tsx`) —
 *  desce com a página até encostar embaixo do cabeçalho, e daí em diante
 *  rola junto. `zIndex` abaixo do cabeçalho (30) para ele sempre vencer se
 *  os dois colidirem na borda.
 *
 *  `rodape` é o segundo cabeçalho retrátil que o Painel pendura embaixo
 *  ("Período"); sem ele a faixa fecha os quatro cantos.
 */

import type { ReactNode } from 'react';

export function FaixaDeFiltros({ children, rodape }: { children: ReactNode; rodape?: ReactNode }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 'var(--altura-cabecalho)',
        zIndex: 25,
        borderRadius: 'var(--r-card)',
        boxShadow: '0 6px 18px rgba(0,49,44,0.22)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          background: 'var(--turquesa-rio)',
          borderRadius: rodape ? 'var(--r-card) var(--r-card) 0 0' : 'var(--r-card)',
          padding: '10px 20px',
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
            color: 'var(--sobre-turquesa)',
            flexShrink: 0,
          }}
        >
          Filtros:
        </span>
        {children}
      </div>
      {rodape}
    </div>
  );
}
