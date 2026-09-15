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
 *
 *  ORDENAR E REDIMENSIONAR MORAM AQUI, e não em cada página: é a mesma moldura
 *  que já sabe desenhar o cabeçalho. Quem chama só diz QUAIS colunas aceitam
 *  clique (`colunasOrdenaveis`) e ordena a própria lista de linhas — a tabela
 *  não conhece o formato de nenhuma delas, só desenha o `<th>` e avisa do
 *  clique. Redimensionar não precisa de aviso a quem chama: a largura vive
 *  aqui, num `<colgroup>`, e por isso funciona com `<td>` que a página já
 *  escreve do jeito que sempre escreveu.
 */

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Ordenacao } from '@/dominio/ordenacao';

const LARGURA_MINIMA = 60;

export function Tabela({
  colunas,
  colunasOrdenaveis = [],
  ordenacao = null,
  aoOrdenar,
  chaveDeArmazenamento,
  altura = 'calc(100vh - 340px)',
  compacta = false,
  largurasPadrao,
  children,
}: {
  colunas: string[];
  /** Rótulos (de `colunas`) que aceitam clique para ordenar. As demais
   *  continuam como cabeçalho simples, sem botão nem seta. */
  colunasOrdenaveis?: string[];
  ordenacao?: Ordenacao | null;
  aoOrdenar?: (coluna: string) => void;
  /** Chave própria desta tabela: guarda a largura das colunas redimensionadas
   *  no localStorage, para o ajuste sobreviver ao F5. Sem ela, a largura vale
   *  só para esta sessão de navegação. */
  chaveDeArmazenamento?: string;
  /** Até onde a lista cresce antes de rolar por dentro. */
  altura?: string;
  /** Cabeçalho mais baixo e fonte um pouco menor — para tabelas que dividem
   *  a largura do cartão com outras, lado a lado (as três tabelas de área
   *  fixa do Painel). As células continuam com o padrão de sempre; quem
   *  chama ajusta o próprio `<td>` se precisar do mesmo aperto. */
  compacta?: boolean;
  /** Largura inicial (px) de uma ou mais colunas, PELO NOME — a coluna que
   *  não está aqui absorve o espaço que sobrar. Diferente de `larguras` (o
   *  ajuste que o próprio usuário arrasta): isto entra ANTES de qualquer
   *  arraste, e é o que já deixa `table-layout: fixed` desde o primeiro
   *  render, em vez de só depois do primeiro arraste.
   *
   *  SEM ISTO, uma tabela em `table-layout: auto` (o padrão) cresce pelo
   *  CONTEÚDO — um nome de instituição comprido empurra a coluna, a tabela, e
   *  o cartão inteiro além da largura que o layout reservou para ele. Numa
   *  tabela sozinha isso só rola por dentro (`.rolagem-interna`); lado a lado
   *  com outras num grid (as três tabelas de área fixa do Painel), o cartão
   *  que cresce pelo conteúdo aperta a largura dos vizinhos — arrastar uma
   *  coluna parecia "mexer no tamanho das outras tabelas", mas o problema
   *  era a tabela em `auto` nunca ter tido uma largura própria, com ou sem
   *  arraste. `largurasPadrao` fixa a largura de saída, e o cartão para de
   *  negociar espaço com os vizinhos pelo conteúdo de dentro. */
  largurasPadrao?: Record<string, number>;
  children: ReactNode;
}) {
  const chaveLocal = chaveDeArmazenamento
    ? `painel-reputacional:largura-de-coluna:${chaveDeArmazenamento}`
    : null;

  const [larguras, definirLarguras] = useState<Record<string, number>>(() => {
    if (!chaveLocal) return {};
    try {
      const salvo = window.localStorage.getItem(chaveLocal);
      return salvo ? (JSON.parse(salvo) as Record<string, number>) : {};
    } catch {
      // Modo privado, quota cheia ou JSON corrompido: começa do zero em vez
      // de quebrar a tabela por causa de uma preferência de layout.
      return {};
    }
  });

  useEffect(() => {
    if (!chaveLocal) return;
    try {
      window.localStorage.setItem(chaveLocal, JSON.stringify(larguras));
    } catch {
      /* a largura só não sobrevive ao F5; a tabela continua funcionando */
    }
  }, [larguras, chaveLocal]);

  //: O ARRASTE EM ANDAMENTO, fora do estado do React.
  //:
  //: Cada `mousemove` do arraste não precisa provocar nova renderização de
  //: tudo — só a largura da coluna que está mudando. `ref` guarda o ponto de
  //: partida sem re-render a cada pixel.
  const redimensionando = useRef<{
    coluna: string;
    inicioX: number;
    larguraInicial: number;
  } | null>(null);

  useEffect(() => {
    function mover(evento: MouseEvent) {
      const estado = redimensionando.current;
      if (!estado) return;
      const largura = Math.max(
        LARGURA_MINIMA,
        estado.larguraInicial + (evento.clientX - estado.inicioX),
      );
      definirLarguras((atuais) => ({ ...atuais, [estado.coluna]: largura }));
    }
    function soltar() {
      redimensionando.current = null;
    }
    window.addEventListener('mousemove', mover);
    window.addEventListener('mouseup', soltar);
    return () => {
      window.removeEventListener('mousemove', mover);
      window.removeEventListener('mouseup', soltar);
    };
  }, []);

  function iniciarRedimensionamento(
    evento: React.MouseEvent<HTMLSpanElement>,
    coluna: string,
  ) {
    // NÃO é clique de ordenar: sem isto, arrastar a borda também dispararia
    // o `aoOrdenar` do cabeçalho por baixo.
    evento.preventDefault();
    evento.stopPropagation();
    const th = evento.currentTarget.closest('th');
    const larguraAtual = larguras[coluna] ?? th?.getBoundingClientRect().width ?? 120;
    redimensionando.current = { coluna, inicioX: evento.clientX, larguraInicial: larguraAtual };
  }

  // `table-layout: fixed` entra assim que existir QUALQUER largura definida —
  // do usuário (`larguras`, depois de um arraste) ou de quem chama
  // (`largurasPadrao`, antes de qualquer arraste). Sem nenhuma das duas, a
  // tabela continua com o comportamento de sempre — largura pelo conteúdo —,
  // que é o que as páginas sem largura própria já contam com (`minWidth` por
  // célula, texto que quebra, etc.).
  const temLarguraDefinida =
    Object.keys(larguras).length > 0 || Boolean(largurasPadrao && Object.keys(largurasPadrao).length);

  return (
    <div className="rolagem-interna" style={{ maxHeight: altura }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: compacta ? 12 : 13,
          tableLayout: temLarguraDefinida ? 'fixed' : 'auto',
        }}
      >
        <colgroup>
          {colunas.map((coluna) => {
            const largura = larguras[coluna] ?? largurasPadrao?.[coluna];
            return <col key={coluna} style={largura ? { width: largura } : undefined} />;
          })}
        </colgroup>
        <thead>
          <tr>
            {colunas.map((coluna, indice) => {
              const ordenavel = colunasOrdenaveis.includes(coluna);
              const ativa = ordenacao?.coluna === coluna;
              return (
                <th
                  key={coluna}
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                    background: 'var(--bg-trilho)',
                    textAlign: 'left',
                    padding: 0,
                    fontSize: compacta ? 11 : 13,
                    fontWeight: 700,
                    letterSpacing: compacta ? '0.02em' : '0.05em',
                    textTransform: 'uppercase',
                    // Azul da marca, e não o cinza neutro de antes: é o que
                    // distingue o cabeçalho do resto da tabela à primeira
                    // vista, sem depender só do fundo (`--bg-trilho`).
                    color: 'var(--azul-mar-sombra)',
                    whiteSpace: 'nowrap',
                    borderBottom: '1px solid var(--borda)',
                  }}
                >
                  {ordenavel ? (
                    <button
                      type="button"
                      onClick={() => aoOrdenar?.(coluna)}
                      title={`Ordenar por ${coluna}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        width: '100%',
                        padding: compacta ? '6px 8px' : '10px 14px',
                        border: 'none',
                        background: 'transparent',
                        font: 'inherit',
                        fontWeight: 700,
                        letterSpacing: 'inherit',
                        textTransform: 'inherit',
                        color: ativa ? 'var(--azul-mar)' : 'inherit',
                        cursor: 'pointer',
                      }}
                    >
                      {coluna}
                      <span aria-hidden style={{ fontSize: 10, opacity: ativa ? 1 : 0.4 }}>
                        {ativa ? (ordenacao!.direcao === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  ) : (
                    <div style={{ padding: compacta ? '6px 8px' : '10px 14px' }}>{coluna}</div>
                  )}

                  {/* A ÚLTIMA COLUNA NÃO GANHA ALÇA: não há o que redimensionar
                      à direita dela — só a rolagem interna da tabela. */}
                  {indice < colunas.length - 1 ? (
                    <span
                      onMouseDown={(evento) => iniciarRedimensionamento(evento, coluna)}
                      title="Arrastar para redimensionar a coluna"
                      aria-hidden
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: -3,
                        bottom: 0,
                        width: 7,
                        cursor: 'col-resize',
                        userSelect: 'none',
                        touchAction: 'none',
                      }}
                    />
                  ) : null}
                </th>
              );
            })}
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
  estilo,
  children,
}: {
  aoClicar?: () => void;
  titulo?: string;
  /** Fundo próprio da linha — as três tabelas de área fixa do Painel pintam
   *  a linha inteira pelo clima. O hover continua por cima (`bg-hover`);
   *  tirar o mouse RESTAURA este fundo, e não o branco de sempre. */
  estilo?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <tr
      onClick={aoClicar}
      title={titulo}
      style={{
        cursor: aoClicar ? 'pointer' : undefined,
        borderBottom: '1px solid var(--borda)',
        ...estilo,
      }}
      onMouseEnter={(evento) => {
        if (aoClicar) evento.currentTarget.style.background = 'var(--bg-hover)';
      }}
      onMouseLeave={(evento) => {
        evento.currentTarget.style.background = (estilo?.background as string) ?? '';
      }}
    >
      {children}
    </tr>
  );
}
