/** Primitivas visuais do sistema Aegea.
 *
 *  Tudo aqui lê dos tokens de `index.css`. Nenhum componente de contexto
 *  escreve hex diretamente — cor nova entra no token, não na tela.
 */

import { useId } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import type { Frente } from '@/dominio/tipos';
import {
  CORES_DE_FRENTE,
  DESCRICAO_DE_FRENTE,
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
  estiloDoTitulo,
  nivelDoTitulo = 2,
}: {
  titulo: string;
  acao?: ReactNode;
  children: ReactNode;
  estilo?: CSSProperties;
  /** Ajuste pontual do título, por cima do padrão da marca abaixo — para o
   *  raro caso em que uma tela precisa de algo diferente do resto do produto. */
  estiloDoTitulo?: CSSProperties;
  /** `1` quando esta seção é o título DA TELA. Leitor de tela navega por
   *  cabeçalho, e uma tela cujo maior título é `h2` parece um pedaço de outra
   *  página. */
  nivelDoTitulo?: 1 | 2;
}) {
  // O PADRÃO DE TÍTULO DA MARCA: azul-mar, maior que o corpo do texto, e
  // colado ao canto — é a mesma régua para toda `Secao` do produto, de
  // propósito. Um título por tela com um valor diferente faria a mesma
  // etiqueta ("título da seção") significar coisas visualmente diferentes de
  // uma tela para outra.
  const estiloDaMarca: CSSProperties = {
    fontSize: nivelDoTitulo === 1 ? 26 : 21,
    color: 'var(--azul-mar)',
    marginTop: 0,
    marginLeft: 0,
  };

  return (
    <Cartao estilo={{ padding: 22, ...estilo }}>
      {/* A LINHA CINZA FECHA O ENQUADRAMENTO: sem ela, o título flutuava
          sobre o conteúdo sem uma borda que dissesse "isto é o cabeçalho do
          cartão, o resto é o corpo". */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '1px solid var(--borda)',
        }}
      >
        {nivelDoTitulo === 1 ? (
          <h1 style={{ ...estiloDaMarca, ...estiloDoTitulo }}>{titulo}</h1>
        ) : (
          <h2 style={{ ...estiloDaMarca, ...estiloDoTitulo }}>{titulo}</h2>
        )}
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
  estilo,
}: {
  frente: Frente;
  ativo?: boolean;
  aoClicar?: () => void;
  /** Sobrepõe o tamanho padrão — o cadastro usa um chip maior que o resto do
   *  produto, sem precisar de um segundo componente para isso. */
  estilo?: CSSProperties;
}) {
  return (
    <Chip
      rotulo={ROTULOS_DE_FRENTE[frente]}
      fundo={CORES_DE_FRENTE[frente]}
      texto={textoSobreFrente(frente)}
      ativo={ativo}
      aoClicar={aoClicar}
      titulo={DESCRICAO_DE_FRENTE[frente]}
      estilo={estilo}
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
  estilo,
}: {
  rotulo: string;
  fundo?: string;
  texto?: string;
  ativo?: boolean;
  aoClicar?: () => void;
  titulo?: string;
  /** Sobrepõe o tamanho padrão (altura, recuo, fonte) — usado onde um chip
   *  precisa de mais destaque do que o de sempre, ex.: o cadastro. */
  estilo?: CSSProperties;
}) {
  const conteudo = (
    <>
      {rotulo}
      {ativo ? <span aria-hidden style={{ marginLeft: 6, opacity: 0.75 }}>×</span> : null}
    </>
  );
  const estiloBase: CSSProperties = {
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
    ...estilo,
  };

  if (!aoClicar) return <span style={estiloBase} title={titulo}>{conteudo}</span>;
  return (
    <button
      type="button"
      onClick={aoClicar}
      title={titulo ?? (ativo ? 'Clique para remover o filtro' : 'Clique para filtrar')}
      style={{ ...estiloBase, cursor: 'pointer' }}
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
  coresCompostas,
}: {
  rotulo: string;
  valor: ReactNode;
  dica?: ReactNode;
  aoClicar?: () => void;
  cor?: string;
  /**
   * Para um KPI que SOMA mais de uma frente (ex.: "institucionais" = governo +
   * parceiros). Duas cores pequenas ao lado do rótulo dizem "isto é uma soma",
   * em vez de pintar a barra de topo com a cor de uma das duas — o que
   * mentiria sobre qual frente o número representa.
   */
  coresCompostas?: readonly [string, string];
}) {
  // Secundário não é sinônimo de branco e plano — só de mais quieto que o
  // herói. Um lavado de 6% da própria cor no corpo do cartão (via
  // `color-mix`, que aceita tanto hex quanto `var(--token)`) dá identidade sem
  // brigar com o número, que continua em tinta neutra por cima dele.
  const fundo = coresCompostas
    ? 'color-mix(in srgb, var(--cinza-1) 45%, var(--branco))'
    : `color-mix(in srgb, ${cor} 6%, var(--branco))`;

  return (
    <Cartao estilo={{ padding: 0, overflow: 'hidden', background: fundo }} aoClicar={aoClicar}>
      <div style={{ height: 3, background: coresCompostas ? 'var(--borda-input)' : cor }} />
      <div style={{ padding: '16px 18px 18px' }}>
        {/* Os dois pontinhos que indicavam "isto soma duas frentes" saíram:
            sem legenda nenhuma na tela, liam como decoração sem propósito. A
            dica abaixo ("Governo e parceiros") já conta a mesma história em
            palavras — não precisa de dois canais dizendo a mesma coisa. */}
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

/**
 * O KPI-manchete do Painel: um destaque só, com o gradiente do hero de login
 * (`--azul-mar` → `--azul-mar-sombra`) e uma barra de progresso de verdade em
 * vez de uma dica de texto pequena.
 *
 * Existe UM herói porque a ousadia gasta em um lugar só é o que faz o resto da
 * grade parecer disciplinado, e não apagado — dois ou mais competiriam entre
 * si pela mesma atenção. Ver a nota de design em `Painel.tsx`.
 */
export function KpiHero({
  rotulo,
  valor,
  selo,
  progresso,
  aoClicar,
}: {
  rotulo: string;
  valor: ReactNode;
  /** Rótulo curto no canto — hoje sempre a frente que o número representa. */
  selo?: string;
  progresso?: { fracao: number; rotulo: string };
  aoClicar?: () => void;
}) {
  const clicavel = Boolean(aoClicar);
  return (
    <div
      role={clicavel ? 'button' : undefined}
      tabIndex={clicavel ? 0 : undefined}
      onClick={aoClicar}
      onKeyDown={(evento) => {
        if (!aoClicar) return;
        if (evento.key === 'Enter' || evento.key === ' ') {
          evento.preventDefault();
          aoClicar();
        }
      }}
      className={clicavel ? 'kpi-hero kpi-hero--clicavel' : 'kpi-hero'}
      style={{
        borderRadius: 'var(--r-card)',
        padding: '22px 24px 24px',
        background:
          'radial-gradient(120% 140% at 100% 0%, rgba(23,227,203,0.55) 0%, rgba(23,227,203,0) 46%),' +
          'linear-gradient(155deg, var(--azul-mar) 0%, var(--azul-mar-sombra) 100%)',
        color: 'var(--branco)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        cursor: clicavel ? 'pointer' : undefined,
        minHeight: '100%',
        // Uma sombra na COR do próprio gradiente, não um cinza genérico — o
        // card já se separa do fundo pela cor; a sombra só aprofunda esse
        // relevo em vez de competir com ele.
        boxShadow: '0 8px 24px rgba(0, 39, 189, 0.22)',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span
            className="kicker"
            style={{ color: 'rgba(255,255,255,0.78)' }}
          >
            {rotulo}
          </span>
          {selo ? (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.16)',
                color: '#EFFFFC',
                whiteSpace: 'nowrap',
              }}
            >
              {selo}
            </span>
          ) : null}
        </div>
        <div
          className="tabular"
          style={{ fontSize: 56, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 14 }}
        >
          {valor}
        </div>
      </div>

      {progresso ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                background: 'rgba(255,255,255,0.22)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.round(Math.min(1, Math.max(0, progresso.fracao)) * 100)}%`,
                  height: '100%',
                  background: 'var(--turquesa-rio)',
                  borderRadius: 3,
                }}
              />
            </div>
            <span
              style={{
                fontFamily: 'var(--font-destaque)',
                fontStyle: 'italic',
                fontSize: 17,
                whiteSpace: 'nowrap',
              }}
            >
              {Math.round(progresso.fracao * 100)}%
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 6 }}>
            {progresso.rotulo}
            {aoClicar ? <span aria-hidden style={{ marginLeft: 5 }}>→</span> : null}
          </div>
        </div>
      ) : null}
    </div>
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
    // O trilho era sempre o mesmo cinza `--bg-trilho`, não importa a cor do
    // dado — dez rankings de cores diferentes liam como o mesmo cinza com
    // pontas trocadas. Um trilho na PRÓPRIA cor, bem clara, é o que o guia da
    // skill de dataviz chama de "mesma rampa, um degrau mais claro": o estado
    // (preenchido vs. vazio) continua lendo na barra inteira, não só na ponta.
    <div
      style={{
        height: altura,
        background: `color-mix(in srgb, ${cor} 12%, var(--branco))`,
        borderRadius: 4,
      }}
    >
      {/* Ponta arredondada no fim do dado, reta na linha de base: a barra
          cresce de uma base só e o arredondamento marca onde ela termina. O
          gradiente é a MESMA cor em dois tons — nunca uma segunda cor —, só
          para dar um relevo sutil em vez de uma chapa lisa. */}
      <div
        style={{
          width: `${largura}%`,
          height: '100%',
          background: `linear-gradient(90deg, color-mix(in srgb, ${cor} 78%, var(--branco)), ${cor})`,
          borderRadius: 4,
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
  rotuloAcessivel,
  titulo,
}: {
  children: ReactNode;
  aoClicar?: () => void;
  variante?: 'primario' | 'secundario' | 'fantasma';
  tipo?: 'button' | 'submit';
  desabilitado?: boolean;
  estilo?: CSSProperties;
  /** Nome para leitor de tela, quando o texto visível se repete.
   *
   *  Seis botões "Remover" numa lista dizem a mesma coisa em voz alta e não
   *  distinguem o que cada um remove. Aqui vira "Remover a pessoa 2".
   */
  rotuloAcessivel?: string;
  titulo?: string;
}) {
  const variantes: Record<string, CSSProperties> = {
    primario: {
      height: 40,
      // O gradiente turquesa → azul-mar da marca, e não a cor chapada de
      // antes — mesmo par de cores em todo botão primário do produto, do
      // "Nova interação" no cabeçalho ao "Exportar CSV" da Base.
      background: 'linear-gradient(135deg, var(--turquesa-rio) 0%, var(--azul-mar) 100%)',
      color: 'var(--branco)',
      border: 'none',
      fontWeight: 700,
      // Leve de propósito: a versão anterior (0 6px 16px) pesava demais para
      // um botão de 40px de altura.
      boxShadow: '0 2px 6px rgba(0, 39, 189, 0.18)',
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
      aria-label={rotuloAcessivel}
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

/**
 * O seletor de arquivo do sistema — nunca o `<input type="file">` cru.
 *
 * O CONTROLE NATIVO NÃO SE ESTILIZA. O botão e o texto "Nenhum arquivo
 * escolhido" são desenhados pelo sistema operacional; aplicar `estiloDeEntrada`
 * nele só bordava uma caixa ao redor de um controle que continuava com a cara
 * do Windows por dentro — nem o botão nem a fonte respondiam.
 *
 * O `<input>` de verdade continua no DOM, focável e funcional — só fica
 * visualmente do tamanho de 1px (a técnica padrão de "visualmente oculto"),
 * dentro de um `<label>` que É o botão que se vê. Clicar no rótulo abre o
 * seletor nativo, porque é para isso que a associação label→input serve.
 *
 * O anel de foco vai no `<label>`, via `:has(:focus-visible)` no CSS — o
 * input escondido não pode receber o anel diretamente, porque ele é
 * invisível. `:has()` é o que faz a tela navegada por teclado saber onde o
 * foco está sem precisar de estado do React só para isso.
 */
export function CampoDeArquivo({
  valor,
  aoEscolher,
  desabilitado,
  ariaLabel,
  rotuloDoBotao = 'Escolher arquivo',
  textoVazio = 'Nenhum arquivo selecionado',
  aceitar,
  entradaRef,
}: {
  valor: File | null;
  aoEscolher: (arquivo: File | null) => void;
  desabilitado?: boolean;
  ariaLabel?: string;
  rotuloDoBotao?: string;
  textoVazio?: string;
  aceitar?: string;
  /** Para quem precisa limpar o valor do `<input>` nativo depois de salvar —
   *  ele é não controlado, então `aoEscolher(null)` sozinho não apaga a
   *  seleção que o navegador mostraria ao reabrir o seletor. */
  entradaRef?: RefObject<HTMLInputElement | null>;
}) {
  return (
    <label
      className="campo-arquivo"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 38,
        padding: '0 6px',
        border: '1px solid var(--borda-input)',
        borderRadius: 'var(--r-btn)',
        background: desabilitado ? 'var(--bg-trilho)' : 'var(--branco)',
        cursor: desabilitado ? 'not-allowed' : 'pointer',
        opacity: desabilitado ? 0.6 : 1,
        transition: 'border-color .12s',
      }}
    >
      <input
        ref={entradaRef}
        type="file"
        accept={aceitar}
        disabled={desabilitado}
        aria-label={ariaLabel ?? rotuloDoBotao}
        onChange={(evento) => {
          const escolhido = evento.target.files?.[0] ?? null;
          // LIMPO NA HORA, sempre — o que se vê vem de `valor`, nunca do
          // valor nativo do `<input>` (que fica invisível de qualquer jeito).
          // Sem isto, escolher O MESMO arquivo duas vezes seguidas — para
          // tentar de novo depois de um erro, por exemplo — não dispara
          // `change` na segunda vez, e a tela parece travada.
          evento.target.value = '';
          aoEscolher(escolhido);
        }}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      />

      <span
        aria-hidden
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 26,
          padding: '0 10px',
          borderRadius: 'calc(var(--r-btn) - 2px)',
          background: 'var(--bg-trilho)',
          color: 'var(--cinza-3)',
          fontSize: 12.5,
          fontWeight: 700,
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        <IconeDeAnexo />
        {rotuloDoBotao}
      </span>

      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 13,
          color: valor ? 'var(--cinza-4)' : 'var(--texto-placeholder)',
        }}
      >
        {valor ? valor.name : textoVazio}
      </span>

      {valor && !desabilitado ? (
        <button
          type="button"
          onClick={(evento) => {
            // NÃO DEIXA O CLIQUE CHEGAR NO `<label>`: sem isto, remover o
            // arquivo reabriria o seletor no mesmo gesto, e a pessoa veria a
            // janela do sistema operacional abrir sozinha depois de "limpar".
            evento.preventDefault();
            evento.stopPropagation();
            aoEscolher(null);
            if (entradaRef?.current) entradaRef.current.value = '';
          }}
          aria-label="Remover arquivo escolhido"
          style={{
            flexShrink: 0,
            width: 22,
            height: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            borderRadius: '50%',
            background: 'transparent',
            color: 'var(--cinza-2)',
            fontSize: 15,
            lineHeight: 1,
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      ) : null}
    </label>
  );
}

/** Seta subindo para uma bandeja — o glifo universal de upload. Três formas
 *  simples, e não um ícone de biblioteca: a única cor que ele veste é
 *  `currentColor`, herdada do texto do botão ao redor. */
function IconeDeAnexo() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden focusable="false">
      <path d="M8 2.2v7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M4.6 5.6 8 2.2l3.4 3.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 10.6v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

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
  //: O NOME DO DIALOGO, para quem ouve a tela.
  //:
  //: `role="dialog"` sem `aria-labelledby` abre como "diálogo" e mais nada: o
  //: titulo esta visivel no cabecalho e o leitor de tela nao o recebe como
  //: nome. `useId` porque pode haver mais de um modal montado, e dois `id`
  //: iguais fazem o segundo apontar para o cabecalho do primeiro.
  const idDoTitulo = useId();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={idDoTitulo}
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
            {/* O h2 global nasce azul-mar — este cabeçalho JÁ é azul-mar,
                então o título precisa do branco de volta. */}
            <h2 id={idDoTitulo} style={{ fontSize: 21, color: 'var(--branco)' }}>{titulo}</h2>
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
