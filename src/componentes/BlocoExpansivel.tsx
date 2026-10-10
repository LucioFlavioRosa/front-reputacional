/** Um bloco que abre e fecha pelo cabeçalho — a "Síntese executiva" e o "Drill
 *  down" de cada lente.
 *
 *  O CABEÇALHO É UM BOTÃO DE VERDADE (`aria-expanded`), e não um div clicável:
 *  quem navega pelo teclado abre com Enter, e o leitor de tela anuncia se o
 *  bloco está aberto.
 *
 *  FECHADO, O CONTEÚDO NÃO É MONTADO: um gráfico escondido que continua
 *  montado continua medindo e redesenhando à toa.
 */

import { useId } from 'react';
import type { ReactNode } from 'react';

export function BlocoExpansivel({
  titulo,
  descricao,
  aberto,
  aoAlternar,
  children,
}: {
  titulo: string;
  /** Uma linha sobre o que há dentro, para decidir abrir sem abrir. */
  descricao?: string;
  aberto: boolean;
  aoAlternar: () => void;
  children: ReactNode;
}) {
  const idDoConteudo = useId();

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: aberto ? 20 : 0 }}>
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={idDoConteudo}
        onClick={aoAlternar}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          width: '100%',
          textAlign: 'left',
          background: 'var(--branco)',
          border: '1px solid var(--borda)',
          borderLeft: '4px solid var(--cor-dos-titulos, var(--azul-mar))',
          borderRadius: 'var(--r-card)',
          padding: '16px 20px',
          cursor: 'pointer',
        }}
      >
        <span style={{ minWidth: 0 }}>
          <span
            style={{
              display: 'block',
              fontSize: 19,
              fontWeight: 700,
              color: 'var(--cor-dos-titulos, var(--azul-mar))',
            }}
          >
            {titulo}
          </span>
          {descricao ? (
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--cinza-2)', marginTop: 3 }}>
              {descricao}
            </span>
          ) : null}
        </span>
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--cinza-2)',
          }}
        >
          {aberto ? 'Recolher' : 'Expandir'}
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease' }}
          >
            <path d="M3.5 6 8 10.5 12.5 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {aberto ? (
        <div id={idDoConteudo} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
