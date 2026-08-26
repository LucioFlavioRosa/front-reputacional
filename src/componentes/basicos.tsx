/** Primitivas visuais do sistema Aegea.
 *
 *  Tudo aqui lê dos tokens de `index.css`. Nenhum componente de contexto
 *  escreve hex diretamente — cor nova entra no token, não na tela.
 */

import type { CSSProperties, ReactNode } from 'react';
import type { Frente } from '@/dominio/tipos';
import {
  CORES_DE_FRENTE,
  ROTULOS_DE_FRENTE,
  textoSobreFrente,
} from '@/dominio/frentes';

/* -- superfícies ---------------------------------------------------------- */

export function Cartao({
  children,
  estilo,
  aoClicar,
  destaque,
  titulo,
}: {
  children: ReactNode;
  estilo?: CSSProperties;
  aoClicar?: () => void;
  destaque?: boolean;
  titulo?: string;
}) {
  const clicavel = Boolean(aoClicar);
  return (
    <div
      role={clicavel ? 'button' : undefined}
      tabIndex={clicavel ? 0 : undefined}
      title={titulo}
      onClick={aoClicar}
      onKeyDown={(evento) => {
        if (!aoClicar) return;
        if (evento.key === 'Enter' || evento.key === ' ') {
          evento.preventDefault();
          aoClicar();
        }
      }}
      className={clicavel ? 'cartao cartao--clicavel' : 'cartao'}
      style={{
        background: 'var(--branco)',
        border: `1px solid ${destaque ? 'var(--azul-mar)' : 'var(--borda)'}`,
        borderRadius: 'var(--r-card)',
        padding: 20,
        transition: 'border-color .12s, box-shadow .12s',
        cursor: clicavel ? 'pointer' : undefined,
        ...estilo,
      }}
    >
      {children}
    </div>
  );
}

export function Secao({
  titulo,
  acao,
  children,
  estilo,
}: {
  titulo: string;
  acao?: ReactNode;
  children: ReactNode;
  estilo?: CSSProperties;
}) {
  return (
    <Cartao estilo={{ padding: 22, ...estilo }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 16 }}>{titulo}</h2>
        {acao}
      </div>
      {children}
    </Cartao>
  );
}

/* -- rótulos -------------------------------------------------------------- */

export function ChipDeFrente({
  frente,
  ativo,
  aoClicar,
}: {
  frente: Frente;
  ativo?: boolean;
  aoClicar?: () => void;
}) {
  return (
    <Chip
      rotulo={ROTULOS_DE_FRENTE[frente]}
      fundo={CORES_DE_FRENTE[frente]}
      texto={textoSobreFrente(frente)}
      ativo={ativo}
      aoClicar={aoClicar}
    />
  );
}

export function Chip({
  rotulo,
  fundo = 'var(--bg-trilho)',
  texto = 'var(--cinza-3)',
  ativo,
  aoClicar,
  titulo,
}: {
  rotulo: string;
  fundo?: string;
  texto?: string;
  ativo?: boolean;
  aoClicar?: () => void;
  titulo?: string;
}) {
  const conteudo = (
    <>
      {rotulo}
      {ativo ? <span aria-hidden style={{ marginLeft: 6, opacity: 0.75 }}>×</span> : null}
    </>
  );
  const estilo: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    height: 24,
    padding: '0 9px',
    borderRadius: 'var(--r-chip)',
    background: fundo,
    color: texto,
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1,
    border: ativo ? '1px solid var(--cinza-4)' : '1px solid transparent',
    whiteSpace: 'nowrap',
  };

  if (!aoClicar) return <span style={estilo} title={titulo}>{conteudo}</span>;
  return (
    <button
      type="button"
      onClick={aoClicar}
      title={titulo ?? (ativo ? 'Clique para remover o filtro' : 'Clique para filtrar')}
      style={{ ...estilo, cursor: 'pointer' }}
    >
      {conteudo}
    </button>
  );
}

export function Selo({
  rotulo,
  fundo,
  texto,
}: {
  rotulo: string;
  fundo: string;
  texto: string;
}) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 8px',
        borderRadius: 'var(--r-chip)',
        background: fundo,
        color: texto,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {rotulo}
    </span>
  );
}

/* -- números -------------------------------------------------------------- */

export function Kpi({
  rotulo,
  valor,
  dica,
  aoClicar,
  cor = 'var(--turquesa-rio)',
}: {
  rotulo: string;
  valor: ReactNode;
  dica?: ReactNode;
  aoClicar?: () => void;
  cor?: string;
}) {
  return (
    <Cartao estilo={{ padding: 0, overflow: 'hidden' }} aoClicar={aoClicar}>
      <div style={{ height: 3, background: cor }} />
      <div style={{ padding: '16px 18px 18px' }}>
        <div className="kicker">{rotulo}</div>
        {/* Figuras proporcionais: `tabular-nums` num número grande isolado
            deixa "121" frouxo. Tabular só onde dígitos alinham em coluna. */}
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 6 }}>
          {valor}
        </div>
        {dica ? (
          <div style={{ fontSize: 12, color: 'var(--cinza-2)', marginTop: 4 }}>
            {dica}
            {aoClicar ? <span aria-hidden style={{ marginLeft: 5 }}>→</span> : null}
          </div>
        ) : null}
      </div>
    </Cartao>
  );
}

/** Barra de proporção usada em todos os rankings. */
export function Barra({
  valor,
  maximo,
  cor = 'var(--azul-mar)',
  altura = 8,
}: {
  valor: number;
  maximo: number;
  cor?: string;
  altura?: number;
}) {
  const largura = maximo > 0 ? Math.max(2, (valor / maximo) * 100) : 0;
  return (
    <div style={{ height: altura, background: 'var(--bg-trilho)', borderRadius: 4 }}>
      {/* Ponta arredondada no fim do dado, reta na linha de base: a barra
          cresce de uma base só e o arredondamento marca onde ela termina. */}
      <div
        style={{
          width: `${largura}%`,
          height: '100%',
          background: cor,
          borderRadius: '4px 4px 4px 4px',
        }}
      />
    </div>
  );
}

/* -- controles ------------------------------------------------------------ */

export function Botao({
  children,
  aoClicar,
  variante = 'secundario',
  tipo = 'button',
  desabilitado,
  estilo,
  titulo,
}: {
  children: ReactNode;
  aoClicar?: () => void;
  variante?: 'primario' | 'secundario' | 'fantasma';
  tipo?: 'button' | 'submit';
  desabilitado?: boolean;
  estilo?: CSSProperties;
  titulo?: string;
}) {
  const variantes: Record<string, CSSProperties> = {
    primario: {
      height: 40,
      background: 'var(--azul-mar)',
      color: 'var(--branco)',
      border: 'none',
      fontWeight: 700,
    },
    secundario: {
      height: 36,
      background: 'var(--branco)',
      color: 'var(--cinza-3)',
      border: '1px solid var(--borda-input)',
    },
    fantasma: {
      height: 36,
      background: 'transparent',
      color: 'var(--cinza-3)',
      border: 'none',
    },
  };
  return (
    <button
      type={tipo}
      onClick={aoClicar}
      disabled={desabilitado}
      title={titulo}
      style={{
        padding: '0 16px',
        borderRadius: 'var(--r-btn)',
        fontSize: 13,
        cursor: desabilitado ? 'not-allowed' : 'pointer',
        opacity: desabilitado ? 0.5 : 1,
        transition: 'border-color .12s, box-shadow .12s, background .12s',
        ...variantes[variante],
        ...estilo,
      }}
    >
      {children}
    </button>
  );
}

export function Campo({
  rotulo,
  children,
  dica,
  obrigatorio,
}: {
  rotulo: string;
  children: ReactNode;
  dica?: string;
  obrigatorio?: boolean;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--cinza-3)',
          marginBottom: 5,
        }}
      >
        {rotulo}
        {obrigatorio ? <span style={{ color: 'var(--erro-fg)' }}> *</span> : null}
      </span>
      {children}
      {dica ? (
        <span
          style={{ display: 'block', fontSize: 11, color: 'var(--cinza-2)', marginTop: 4 }}
        >
          {dica}
        </span>
      ) : null}
    </label>
  );
}

export const estiloDeEntrada: CSSProperties = {
  width: '100%',
  height: 38,
  padding: '0 11px',
  border: '1px solid var(--borda-input)',
  borderRadius: 'var(--r-btn)',
  background: 'var(--branco)',
  color: 'var(--cinza-4)',
};

/* -- estados -------------------------------------------------------------- */

export function Vazio({ mensagem, dica }: { mensagem: string; dica?: string }) {
  return (
    <div style={{ padding: '32px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--cinza-3)' }}>{mensagem}</div>
      {dica ? (
        <div style={{ fontSize: 13, color: 'var(--cinza-2)', marginTop: 5 }}>{dica}</div>
      ) : null}
    </div>
  );
}

export function Carregando({ rotulo = 'Carregando…' }: { rotulo?: string }) {
  return (
    <div
      role="status"
      style={{
        padding: '32px 20px',
        textAlign: 'center',
        fontSize: 13,
        color: 'var(--cinza-2)',
      }}
    >
      {rotulo}
    </div>
  );
}

export function FaixaDeErro({ mensagem }: { mensagem: string }) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        background: 'var(--erro-bg)',
        color: 'var(--erro-fg)',
        borderRadius: 'var(--r-card-int)',
        padding: '11px 14px',
        fontSize: 13,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 9,
          height: 9,
          background: 'currentColor',
          transform: 'rotate(45deg)',
          flexShrink: 0,
        }}
      />
      {mensagem}
    </div>
  );
}

/* -- modal ---------------------------------------------------------------- */

export function Modal({
  titulo,
  subtitulo,
  aoFechar,
  children,
  rodape,
  largura = 820,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  aoFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: number;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={aoFechar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(25,27,35,0.55)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 28,
      }}
    >
      <div
        onClick={(evento) => evento.stopPropagation()}
        style={{
          background: 'var(--branco)',
          borderRadius: 'var(--r-destaque)',
          width: '100%',
          maxWidth: largura,
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: 'var(--sh-modal)',
        }}
      >
        <header
          style={{
            background: 'var(--azul-mar)',
            color: 'var(--branco)',
            padding: '18px 24px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div>
            <h2 style={{ fontSize: 21 }}>{titulo}</h2>
            {subtitulo ? (
              <div style={{ fontSize: 12, color: 'var(--turquesa-sombra)', marginTop: 4 }}>
                {subtitulo}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            style={{
              width: 34,
              height: 34,
              flexShrink: 0,
              borderRadius: 'var(--r-btn)',
              border: '1px solid rgba(255,255,255,0.4)',
              background: 'transparent',
              color: 'var(--branco)',
              fontSize: 17,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </header>

        <div className="rolagem-interna" style={{ padding: 24, flex: 1 }}>
          {children}
        </div>

        {rodape ? (
          <footer
            style={{
              borderTop: '1px solid var(--borda)',
              background: 'var(--bg-rodape-card)',
              padding: '14px 24px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
            }}
          >
            {rodape}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
