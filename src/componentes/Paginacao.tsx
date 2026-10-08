/** Navegação de página genérica — primeira, anterior, números (com
 *  reticências quando a lista é longa), próxima, última.
 *
 *  NASCEU DE `RodapeDePaginacao` (`painel/TabelaDeInteracoes.tsx`), que só
 *  tinha Anterior/Próxima: listas que só crescem (Instituições, Contatos)
 *  precisam também de "ir direto pro fim" e de pular várias páginas de uma
 *  vez, sem clicar "Próxima" dezenas de vezes — ver o pedido do usuário.
 *
 *  PAGINA AQUI SEMPRE NO CLIENTE: estas listas vêm inteiras da API hoje (o
 *  catálogo do app inteiro depende disso), então a janela visível é um
 *  `.slice()` sobre o array já carregado — quem chama este componente é quem
 *  faz o `.slice()`, este componente só desenha a navegação.
 */

import { Botao } from '@/componentes/basicos';

/** Os números a mostrar ao redor da página atual, mais primeira e última
 *  sempre visíveis — com `null` marcando onde entra uma reticência. Raio 2:
 *  "11" numa lista de 50 instituições (porPagina=10) já cobre o caso comum
 *  sem precisar reticência nenhuma; páginas bem no meio de uma lista grande
 *  é que ganham as reticências dos dois lados. */
function janelaDePaginas(atual: number, total: number, raio = 2): (number | null)[] {
  const paginas: (number | null)[] = [];
  for (let p = 1; p <= total; p += 1) {
    const pertoDaAtual = Math.abs(p - atual) <= raio;
    const extremidade = p === 1 || p === total;
    if (pertoDaAtual || extremidade) {
      paginas.push(p);
    } else if (paginas[paginas.length - 1] !== null) {
      paginas.push(null);
    }
  }
  return paginas;
}

export function Paginacao({
  pagina,
  totalDePaginas,
  aoMudarPagina,
}: {
  /** 1-indexada — a mesma convenção de `RodapeDePaginacao`. */
  pagina: number;
  totalDePaginas: number;
  aoMudarPagina: (pagina: number) => void;
}) {
  if (totalDePaginas <= 1) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 16,
      }}
    >
      <Botao
        variante="fantasma"
        desabilitado={pagina <= 1}
        aoClicar={() => aoMudarPagina(1)}
        estilo={{ padding: '0 10px' }}
      >
        « Primeira
      </Botao>
      <Botao
        variante="fantasma"
        desabilitado={pagina <= 1}
        aoClicar={() => aoMudarPagina(pagina - 1)}
        estilo={{ padding: '0 10px' }}
      >
        ‹ Anterior
      </Botao>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '0 4px' }}>
        {janelaDePaginas(pagina, totalDePaginas).map((p, indice) =>
          p === null ? (
            <span
              key={`reticencias-${indice}`}
              aria-hidden
              style={{ padding: '0 2px', color: 'var(--cinza-2)', fontSize: 12 }}
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === pagina ? 'page' : undefined}
              title={p === pagina ? undefined : `Ir para a página ${p}`}
              disabled={p === pagina}
              onClick={() => aoMudarPagina(p)}
              style={{
                minWidth: 26,
                height: 26,
                padding: '0 7px',
                borderRadius: 'var(--r-chip)',
                border: p === pagina ? '1px solid var(--azul-mar)' : '1px solid transparent',
                background: p === pagina ? 'var(--azul-mar)' : 'var(--bg-trilho)',
                color: p === pagina ? 'var(--branco)' : 'var(--cinza-3)',
                fontSize: 12,
                fontWeight: p === pagina ? 700 : 500,
                cursor: p === pagina ? 'default' : 'pointer',
              }}
            >
              {p}
            </button>
          ),
        )}
      </div>

      <Botao
        variante="fantasma"
        desabilitado={pagina >= totalDePaginas}
        aoClicar={() => aoMudarPagina(pagina + 1)}
        estilo={{ padding: '0 10px' }}
      >
        Próxima ›
      </Botao>
      <Botao
        variante="fantasma"
        desabilitado={pagina >= totalDePaginas}
        aoClicar={() => aoMudarPagina(totalDePaginas)}
        estilo={{ padding: '0 10px' }}
      >
        Última »
      </Botao>
    </div>
  );
}
