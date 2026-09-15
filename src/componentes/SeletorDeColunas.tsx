/** Escolher quais colunas aparecem numa tabela da Base — e lembrar da escolha.
 *
 *  A TABELA CONTINUA SEM SABER DISTO. `Tabela` só desenha as colunas que
 *  recebe; é quem chama que filtra `colunas` (para o cabeçalho) e cada
 *  `<td>` da linha (para o corpo) pela mesma lista de visíveis — as duas
 *  listas nascem do mesmo `visiveis`, então nunca ficam fora de sincronia.
 *
 *  GUARDADO NO LOCALSTORAGE, com o mesmo espírito da largura de coluna em
 *  `Tabela`: é preferência de tela, não dado do recorte, e sobrevive ao F5
 *  sem precisar de um campo novo no backend.
 */

import { useEffect, useRef, useState } from 'react';

export function useColunasVisiveis(
  chave: string,
  todasAsColunas: string[],
  /** Colunas que nascem escondidas na PRIMEIRA visita — antes de existir
   *  qualquer escolha salva. Existe para acrescentar uma coluna nova (ex.:
   *  "Modalidade") sem entupir a tabela de quem já usa a tela: sem isso, toda
   *  coluna nova chegaria visível por padrão, e a tabela ficaria cada vez mais
   *  larga a cada campo que o cadastro ganhasse. */
  ocultasPorPadrao: string[] = [],
) {
  const chaveLocal = `painel-reputacional:colunas-ocultas:${chave}`;

  const [ocultas, definirOcultas] = useState<Set<string>>(() => {
    try {
      const salvo = window.localStorage.getItem(chaveLocal);
      return salvo ? new Set(JSON.parse(salvo) as string[]) : new Set(ocultasPorPadrao);
    } catch {
      return new Set(ocultasPorPadrao);
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(chaveLocal, JSON.stringify([...ocultas]));
    } catch {
      /* modo privado ou quota cheia: a escolha só não sobrevive ao F5 */
    }
  }, [ocultas, chaveLocal]);

  function alternar(coluna: string) {
    definirOcultas((atuais) => {
      // NUNCA oculta a última coluna visível: uma tabela sem nenhuma coluna
      // não mostra "vazio", mostra um erro — não há onde clicar para trazer
      // as colunas de volta.
      if (!atuais.has(coluna) && todasAsColunas.length - atuais.size <= 1) return atuais;
      const proximas = new Set(atuais);
      if (proximas.has(coluna)) proximas.delete(coluna);
      else proximas.add(coluna);
      return proximas;
    });
  }

  const visiveis = todasAsColunas.filter((coluna) => !ocultas.has(coluna));
  return { ocultas, visiveis, alternar };
}

export function SeletorDeColunas({
  todasAsColunas,
  ocultas,
  aoAlternar,
}: {
  todasAsColunas: string[];
  ocultas: Set<string>;
  aoAlternar: (coluna: string) => void;
}) {
  const [aberto, definirAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function fecharAoClicarFora(evento: MouseEvent) {
      if (raiz.current && !raiz.current.contains(evento.target as Node)) definirAberto(false);
    }
    document.addEventListener('mousedown', fecharAoClicarFora);
    return () => document.removeEventListener('mousedown', fecharAoClicarFora);
  }, [aberto]);

  return (
    <div ref={raiz} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => definirAberto((atual) => !atual)}
        aria-expanded={aberto}
        aria-label="Escolher quais colunas aparecem na tabela"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          height: 36,
          padding: '0 14px',
          borderRadius: 'var(--r-btn)',
          border: '1px solid var(--borda-input)',
          background: 'var(--branco)',
          color: 'var(--cinza-3)',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        {/* Três traços horizontais — o desenho convencional de "colunas/filtros". */}
        <svg width={13} height={13} viewBox="0 0 13 13" aria-hidden focusable="false">
          <rect x="0" y="1.5" width="13" height="1.6" rx="0.8" fill="currentColor" />
          <rect x="0" y="5.7" width="9" height="1.6" rx="0.8" fill="currentColor" />
          <rect x="0" y="9.9" width="6" height="1.6" rx="0.8" fill="currentColor" />
        </svg>
        Colunas
      </button>

      {aberto ? (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 6,
            zIndex: 20,
            minWidth: 230,
            maxHeight: 320,
            overflowY: 'auto',
            background: 'var(--branco)',
            border: '1px solid var(--borda)',
            borderRadius: 'var(--r-card-int)',
            boxShadow: 'var(--sh-tooltip)',
            padding: 6,
          }}
        >
          {todasAsColunas.map((coluna) => (
            <label
              key={coluna}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '7px 8px',
                fontSize: 13,
                color: 'var(--cinza-4)',
                cursor: 'pointer',
                borderRadius: 'var(--r-chip)',
              }}
            >
              <input
                type="checkbox"
                checked={!ocultas.has(coluna)}
                onChange={() => aoAlternar(coluna)}
              />
              {coluna}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
