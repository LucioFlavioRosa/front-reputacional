/** Tokens de estilo compartilhados entre telas.
 *
 *  UM ARQUIVO SEM COMPONENTES, e é essa a razão de ele existir. A regra
 *  `only-export-components` do lint acusa todo arquivo que exporta componente E
 *  outra coisa — e com razão: é o que quebra o recarregamento rápido no
 *  desenvolvimento. Deixar `celula` em `Tabela.tsx` ou em `basicos.tsx` só
 *  mudava o aviso de lugar.
 */

import type { CSSProperties } from 'react';

/** O estilo de toda célula de tabela.
 *
 *  Exportado porque cada tela ajusta o que precisa: `whiteSpace: nowrap` numa
 *  data, `minWidth` numa pauta longa.
 */
export const celula: CSSProperties = {
  padding: '10px 14px',
  verticalAlign: 'top',
  color: 'var(--cinza-3)',
};
