/** Ordenação genérica de listas por coluna — usada pelas três tabelas da Base.
 *
 *  UM EXTRATOR POR COLUNA, e não um campo fixo: cada tabela lista um tipo
 *  diferente de linha (agenda, referência, documento), e é o extrator —
 *  passado por quem chama — que sabe converter o rótulo da coluna clicada
 *  num valor comparável daquele tipo.
 */

export interface Ordenacao {
  coluna: string;
  direcao: 'asc' | 'desc';
}

/** Primeiro clique numa coluna nova ordena crescente; clicar de novo inverte.
 *  Mesmo gesto em qualquer tabela, para não precisar reaprender a cada uma. */
export function alternarOrdenacao(atual: Ordenacao | null, coluna: string): Ordenacao {
  if (atual?.coluna !== coluna) return { coluna, direcao: 'asc' };
  return { coluna, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' };
}

export function ordenarPor<T>(
  linhas: T[],
  ordenacao: Ordenacao | null,
  extratores: Record<string, (linha: T) => string | number>,
): T[] {
  if (!ordenacao) return linhas;
  const extrair = extratores[ordenacao.coluna];
  if (!extrair) return linhas;

  // Datas em ISO (AAAA-MM-DD) comparam certo como texto — mais antigo/mais
  // novo é a mesma ordem que A-Z, sem precisar converter para `Date`.
  const sinal = ordenacao.direcao === 'asc' ? 1 : -1;
  return [...linhas].sort((a, b) => {
    const va = extrair(a);
    const vb = extrair(b);
    const comparado =
      typeof va === 'string' && typeof vb === 'string'
        ? va.localeCompare(vb, 'pt-BR')
        : (va as number) - (vb as number);
    return comparado * sinal;
  });
}
