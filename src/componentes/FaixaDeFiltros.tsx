/** A FAIXA FIXA DE FILTROS — o mesmo degradê azul-mar do cabeçalho, "Filtros:"
 *  e os gatilhos fechados (`CampoSuspenso`) numa linha só. Nasceu no Painel
 *  (Área(s), Tipo de Interação, Tipo de Público); a Preparar agenda usa a
 *  MESMA faixa com o Tema na frente — quem aprendeu a filtrar numa tela
 *  filtra igual na outra.
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
        // PUXA PRA CIMA, só na posição de repouso (topo da página): sem
        // isto, o espaço em branco entre "Filtro avançado" (o acordeão
        // de `PainelDeFiltros`, em `Layout.tsx`) e esta faixa soma o
        // `marginBottom` daquele bloco (8px) com o `padding-top` de
        // `<main>` (28px) — 36px de vão. -28 deixa só uma respiração fina
        // (8px) entre os dois, sem colar. Não afeta o `position: sticky`:
        // o `top` continua sendo o que decide onde ela gruda ao rolar, a
        // margem só encurta a distância ANTES de rolar. Vale para as duas
        // telas que montam esta faixa (Painel e Preparar agenda), ambas
        // logo abaixo do mesmo acordeão.
        marginTop: -28,
        position: 'sticky',
        top: 'var(--altura-cabecalho)',
        zIndex: 25,
        borderRadius: 'var(--r-card)',
        boxShadow: '0 6px 18px rgba(0,25,120,0.22)',
      }}
    >
      <div
        style={{
          display: 'flex',
          // Quatro gatilhos de 150px de mínimo não cabem em tela estreita:
          // quebram linha, em vez de estourar a faixa na horizontal.
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          // TESTE: degradê reto azul-mar → turquesa-rio, esquerda pra
          // direita — referência trazida pelo usuário (pílula "Agosto de
          // 2026"), diferente do degradê do cabeçalho (aquele é azul-mar →
          // azul-mar-sombra, com brilho turquesa só no canto).
          background: 'linear-gradient(90deg, var(--azul-mar) 0%, var(--turquesa-rio) 100%)',
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
            // BRANCO, não `--sobre-turquesa`: o fundo virou o degradê escuro
            // do cabeçalho, e o par de texto escuro pensado para turquesa
            // sólida desapareceria aqui.
            color: 'var(--branco)',
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
