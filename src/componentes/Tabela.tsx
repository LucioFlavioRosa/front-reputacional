/** A tabela de cabeçalho fixo que as três abas da Base usam.
 *
 *  ESCRITA UMA VEZ. As três listam coisas diferentes — agendas, materiais
 *  oficiais e documentos —, mas a moldura é a mesma: cabeçalho grudado no topo,
 *  rótulos em versalete, linha que acende ao passar o mouse. Repetir esses
 *  quarenta e poucos estilos por aba faria as três divergirem no primeiro
 *  ajuste, e a Base pareceria três telas coladas em vez de uma com abas.
 *
 *  O CABEÇALHO GRUDA porque a lista rola dentro de si mesma: sem isso, quem
 *  chega à trigésima linha não sabe mais o que cada coluna quer dizer.
 */

import type { ReactNode } from 'react';

export function Tabela({
  colunas,
  altura = 'calc(100vh - 340px)',
  children,
}: {
  colunas: string[];
  /** Até onde a lista cresce antes de rolar por dentro. */
  altura?: string;
  children: ReactNode;
}) {
  return (
    <div className="rolagem-interna" style={{ maxHeight: altura }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {colunas.map((coluna) => (
              <th
                key={coluna}
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                  background: 'var(--bg-trilho)',
                  textAlign: 'left',
                  padding: '10px 14px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: 'var(--cinza-2)',
                  whiteSpace: 'nowrap',
                  borderBottom: '1px solid var(--borda)',
                }}
              >
                {coluna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Uma linha clicável da tabela. O realce ao passar o mouse é o que diz que ela
 *  leva a algum lugar — o cursor sozinho só aparece depois de já estar em cima. */
export function Linha({
  aoClicar,
  titulo,
  children,
}: {
  aoClicar?: () => void;
  titulo?: string;
  children: ReactNode;
}) {
  return (
    <tr
      onClick={aoClicar}
      title={titulo}
      style={{
        cursor: aoClicar ? 'pointer' : undefined,
        borderBottom: '1px solid var(--borda)',
      }}
      onMouseEnter={(evento) => {
        if (aoClicar) evento.currentTarget.style.background = 'var(--bg-hover)';
      }}
      onMouseLeave={(evento) => {
        evento.currentTarget.style.background = '';
      }}
    >
      {children}
    </tr>
  );
}
