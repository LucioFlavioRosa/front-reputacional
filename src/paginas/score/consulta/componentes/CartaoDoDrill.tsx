/** Cartão base da Consulta em profundidade.
 *
 *  É UM `Cartao` DE `basicos.tsx`, e não uma moldura nova: é a classe
 *  `.cartao` que o `BaixarPng` procura para saber o que fotografar, e é ela
 *  que dá ao drill a mesma borda, raio e padding dos demais cards da tela.
 *
 *  SEMPRE COM O BOTÃO PNG (decisão A12), como todo card da plataforma. O nome
 *  do arquivo é o título do cartão ou, sem título, o kicker.
 *
 *  O TÍTULO SEGUE A COR DA LENTE (decisão A9): `--cor-dos-titulos`, com o
 *  azul Mar quando a aba não define a variável. Quando o cartão abre um
 *  nível, o título é o `h2` que recebe o foco ao trocar de nível (decisão
 *  A5): por isso o nível do cabeçalho, o `ref` e o `tabIndex` são props.
 *
 *  SEM TÍTULO, O KICKER É O CABEÇALHO: o "O que mudou desde julho" perdeu o
 *  título com a decisão D1 e ficaria fora da navegação por títulos do leitor
 *  de tela. O kicker vira o `h3` (com a aparência de kicker), sem texto novo.
 */

import type { CSSProperties, ReactNode, Ref } from 'react';

import { BaixarPng } from '@/componentes/BaixarPng';
import { Cartao } from '@/componentes/basicos';

export function CartaoDoDrill({
  kicker,
  corDoKicker,
  titulo,
  subtitulo,
  acao,
  children,
  estilo,
  nivelDoTitulo = 'h3',
  refDoTitulo,
  focavel = false,
  idDoTitulo,
}: {
  kicker?: string;
  /** Cor do kicker; sem ela, a da classe `.kicker` (cinza). */
  corDoKicker?: string;
  titulo?: string;
  subtitulo?: ReactNode;
  /** Controles à direita do cabeçalho, antes do botão PNG. */
  acao?: ReactNode;
  children?: ReactNode;
  estilo?: CSSProperties;
  nivelDoTitulo?: 'h2' | 'h3';
  refDoTitulo?: Ref<HTMLHeadingElement>;
  /** `tabIndex={-1}` no título: recebe foco por script, fora da ordem do Tab. */
  focavel?: boolean;
  idDoTitulo?: string;
}) {
  const Titulo = nivelDoTitulo;
  const nomeDoPng = titulo ?? kicker ?? 'Consulta em profundidade';
  const estiloDoKicker: CSSProperties = { marginBottom: 6, ...(corDoKicker ? { color: corDoKicker } : {}) };

  return (
    <Cartao estilo={estilo}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: children ? 16 : 0,
        }}
      >
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          {kicker && titulo ? (
            <div className="kicker" style={estiloDoKicker}>
              {kicker}
            </div>
          ) : null}
          {kicker && !titulo ? (
            <Titulo
              ref={refDoTitulo}
              id={idDoTitulo}
              tabIndex={focavel ? -1 : undefined}
              className="kicker"
              style={{ ...estiloDoKicker, margin: 0, lineHeight: 1.4 }}
            >
              {kicker}
            </Titulo>
          ) : null}
          {titulo ? (
            <Titulo
              ref={refDoTitulo}
              id={idDoTitulo}
              tabIndex={focavel ? -1 : undefined}
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                lineHeight: 1.3,
                color: 'var(--cor-dos-titulos, var(--azul-mar))',
              }}
            >
              {titulo}
            </Titulo>
          ) : null}
          {subtitulo ? (
            <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--cinza-3)' }}>{subtitulo}</p>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: '0 0 auto' }}>
          {acao}
          <BaixarPng titulo={nomeDoPng} />
        </div>
      </div>
      {children}
    </Cartao>
  );
}
