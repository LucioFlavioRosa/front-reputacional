/** Tabela de impacto (E.4.2), a mesma nos Níveis 1, 2 e 3: pilares, temas
 *  ou subtemas agrupados em "O que pressiona" e "O que sustenta".
 *
 *  ORDEM E SOMAS VÊM DE `agruparPorImpacto`, e a escala das barras de
 *  `escalaDeImpacto` com TODOS os nós da tabela: uma escala só, para a
 *  largura comparar linhas entre si (−7,4 tem de ser visivelmente maior que
 *  −3,1). Nunca uma escala por linha.
 *
 *  ACESSIBILIDADE: cada linha navegável é UM link (`<a>` com `display:
 *  grid`), como a spec pede, e por isso a tabela não usa `role="table"`: um
 *  `<a>` no papel de `row` deixaria de ser anunciado como link. A estrutura é
 *  de listas, uma por grupo, rotuladas pelo nome do grupo (`<ul
 *  aria-labelledby>`, e não `<section>` com nome, que viraria um landmark
 *  "região" por grupo); o cabeçalho de colunas é visual (`aria-hidden`),
 *  porque cada célula já se descreve ("214 · 42% matérias", a barra de
 *  sentimento e "Impacto na nota: −4,6 pt"; a barra de volume é decorativa,
 *  porque o número está escrito ao lado). O nome do link é o nome do nó (e o
 *  selo "Em destaque", se houver); os números entram como descrição
 *  (`aria-describedby`), para o link não virar uma frase de trinta palavras.
 *
 *  O TÍTULO PODE SER O DO NÍVEL (decisão A5): no Nível 1, sem o cartão da
 *  nota (D1), o título desta tabela é o único do nível, e quem monta passa
 *  `nivelDoTitulo="h2"`, `focavel` e o `ref` para receber o foco.
 *
 *  LINHA NÃO NAVEGÁVEL NUNCA PARECE CLICÁVEL (C.3): sem seta, sem cursor de
 *  mão, nome em texto comum e `title` explicando por quê.
 *
 *  O LINK TEM `href` REAL (o hash do nível de baixo): abrir em nova aba
 *  funciona; o clique simples navega por dentro (`aoAbrir`).
 */

import { useId, useState } from 'react';
import type { ReactNode, Ref } from 'react';

import { Selo } from '@/componentes/basicos';

import { COR_FUNDO_DESTAQUE, COR_LINHA_DESTACADA } from '../cores';
import { agruparPorImpacto, escalaDeImpacto, motivoSemDetalhamento, participacao } from '../dados/seletores';
import type { ColunaDaTabela } from '../dados/seletores';
import type { No } from '../dados/tipos';
import { escreverEndereco } from '../endereco';
import type { EnderecoDoDrill } from '../endereco';
import { arred, corDoSinal, fmtInt, fmtPct, fmtPt, fmtPtCurto } from '../formatacao';
import { BarraImpacto } from '../graficos/BarraImpacto';
import { BarraSentimento } from '../graficos/BarraSentimento';
import { BarraVolume } from '../graficos/BarraVolume';
import { CartaoDoDrill } from './CartaoDoDrill';
import { ehCliqueSimples } from './cliqueSimples';

const GRADE = 'minmax(0,2.3fr) minmax(0,1.25fr) minmax(0,1.8fr) minmax(0,2.1fr) 36px';
const ESTILO_DA_GRADE = {
  display: 'grid',
  gridTemplateColumns: GRADE,
  gap: 20,
  padding: '14px 20px',
  alignItems: 'center',
} as const;

// ---------------------------------------------------------------------------
// Rodapé "A conta fecha" (Níveis 2 e 3)
// ---------------------------------------------------------------------------

/** `pressiona −7,8 · sustenta +0,4 · = impacto do pilar −7,4 pt`.
 *
 *  O VALOR FINAL NUNCA É RECALCULADO: é o `impacto` do pilar ou do tema, como
 *  está no JSON, para o rodapé não divergir da trilha por arredondamento.
 *  `pressiona` e `sustenta` são as somas dos grupos (`agruparPorImpacto`).
 *
 *  OS TRÊS TERMOS FICAM SEMPRE, como na fórmula da spec (a conta fecha com
 *  "pressiona 0,0" quando nada pressiona). Mas a palavra só leva a cor do
 *  grupo quando o número escrito não é zero: "pressiona 0,0" em vermelho
 *  apontaria para um grupo que a tabela nem mostra. */
export function RodapeDaConta({
  pressiona,
  sustenta,
  rotuloFinal,
  valorFinal,
}: {
  pressiona: number;
  sustenta: number;
  rotuloFinal: 'impacto do pilar' | 'impacto do tema';
  valorFinal: number;
}) {
  const separador = <span style={{ color: 'var(--cinza-2)' }}>·</span>;
  const corDoTermo = (valor: number, cor: string) => (arred(valor, 1) === 0 ? 'var(--cinza-3)' : cor);
  return (
    <p
      className="tabular"
      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 12px', margin: 0, fontSize: 13 }}
    >
      <span className="kicker" style={{ marginRight: 8 }}>
        A conta fecha
      </span>
      <span style={{ color: corDoTermo(pressiona, 'var(--erro-fg)') }}>
        pressiona <strong style={{ fontWeight: 700, color: corDoSinal(pressiona) }}>{fmtPtCurto(pressiona)}</strong>
      </span>
      {separador}
      <span style={{ color: corDoTermo(sustenta, 'var(--ok-fg)') }}>
        sustenta <strong style={{ fontWeight: 700, color: corDoSinal(sustenta) }}>{fmtPtCurto(sustenta)}</strong>
      </span>
      {separador}
      <span style={{ color: 'var(--cinza-3)' }}>
        = {rotuloFinal}{' '}
        <strong style={{ fontSize: 15, fontWeight: 800, color: corDoSinal(valorFinal) }}>{fmtPt(valorFinal)}</strong>
      </span>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Linhas
// ---------------------------------------------------------------------------

function SetaDaLinha() {
  return (
    <span
      aria-hidden="true"
      data-seta
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        color: 'var(--azul-mar)',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path d="M7 4l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

interface PropsDaLinha<T extends No> {
  no: T;
  unidade: string;
  volumeIrmaos: number;
  maiorVolume: number;
  escala: number;
  destaque: boolean;
  navegavel: boolean;
  endereco?: EnderecoDoDrill;
  aoAbrir: (no: T) => void;
  /** O `title` da linha que não abre (`motivoSemDetalhamento`). */
  motivoFixa: string;
}

function Linha<T extends No>({
  no,
  unidade,
  volumeIrmaos,
  maiorVolume,
  escala,
  destaque,
  navegavel,
  endereco,
  aoAbrir,
  motivoFixa,
}: PropsDaLinha<T>) {
  const [sobre, definirSobre] = useState(false);
  const id = useId();
  const idDoNome = `${id}-nome`;
  const idDoSelo = `${id}-selo`;
  const idDosNumeros = `${id}-numeros`;
  const clicavel = navegavel && endereco !== undefined;

  const corDoNome = destaque || (clicavel && sobre) ? 'var(--azul-mar)' : 'var(--cinza-4)';
  const fundo = destaque ? COR_FUNDO_DESTAQUE : clicavel && sobre ? 'var(--bg-hover)' : 'transparent';

  const celulas = (
    <>
      <div style={{ minWidth: 0 }}>
        <div id={idDoNome} style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35, color: corDoNome }}>
          {no.nome}
        </div>
        {destaque ? (
          <div id={idDoSelo} style={{ marginTop: 6 }}>
            <Selo rotulo="Em destaque" fundo={COR_LINHA_DESTACADA} texto="var(--azul-mar)" />
          </div>
        ) : null}
      </div>
      <div id={idDosNumeros} style={{ display: 'contents' }}>
        <div style={{ minWidth: 0 }}>
          <div className="tabular" style={{ whiteSpace: 'nowrap' }}>
            <strong style={{ fontSize: 14, fontWeight: 700, color: 'var(--cinza-4)' }}>{fmtInt(no.volume)}</strong>{' '}
            <span style={{ fontSize: 13, color: 'var(--cinza-2)' }}>· {fmtPct(participacao(no.volume, volumeIrmaos))}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--cinza-2)', marginBottom: 6 }}>{unidade}</div>
          <BarraVolume volume={no.volume} maximo={maiorVolume} decorativa />
        </div>
        <div style={{ minWidth: 0 }}>
          <BarraSentimento sentimento={no.sentimento} />
        </div>
        <div style={{ minWidth: 0 }}>
          <BarraImpacto valor={no.impacto} escala={escala} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>{clicavel ? <SetaDaLinha /> : null}</div>
    </>
  );

  const estiloComum = {
    ...ESTILO_DA_GRADE,
    background: fundo,
    borderTop: '1px solid var(--borda)',
    color: 'inherit',
    textDecoration: 'none',
  } as const;

  if (clicavel) {
    return (
      <li style={{ listStyle: 'none' }}>
        <a
          href={escreverEndereco(endereco)}
          aria-labelledby={destaque ? `${idDoNome} ${idDoSelo}` : idDoNome}
          aria-describedby={idDosNumeros}
          data-linha="navegavel"
          onClick={(evento) => {
            if (!ehCliqueSimples(evento)) return;
            evento.preventDefault();
            aoAbrir(no);
          }}
          onMouseEnter={() => definirSobre(true)}
          onMouseLeave={() => definirSobre(false)}
          // O ANEL DE FOCO VAI PARA DENTRO: a linha ocupa a largura toda de
          // uma área com rolagem horizontal, que cortaria o anel por fora.
          style={{ ...estiloComum, outlineOffset: -2, borderRadius: 0 }}
        >
          {celulas}
        </a>
      </li>
    );
  }

  return (
    <li style={{ listStyle: 'none' }}>
      <div title={motivoFixa} data-linha="fixa" style={{ ...estiloComum, cursor: 'default' }}>
        {celulas}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Grupo e tabela
// ---------------------------------------------------------------------------

function Grupo({ rotulo, cor, soma, children }: { rotulo: string; cor: string; soma: number; children: ReactNode }) {
  const id = useId();
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 20px',
          background: 'var(--bg-rodape-card)',
          borderTop: '1px solid var(--borda)',
        }}
      >
        <h4 id={id} className="kicker" style={{ margin: 0, color: cor }}>
          {rotulo}
        </h4>
        <span className="tabular" data-soma style={{ fontSize: 14, fontWeight: 800, color: corDoSinal(soma) }}>
          {fmtPt(soma)}
        </span>
      </div>
      <ul aria-labelledby={id} style={{ margin: 0, padding: 0 }}>
        {children}
      </ul>
    </div>
  );
}

export function TabelaDeImpacto<T extends No>({
  titulo,
  subtitulo,
  rotuloColuna,
  unidade,
  nos,
  destaqueId,
  navegavel,
  enderecoDe,
  aoAbrir,
  rodape,
  nivelDoTitulo,
  refDoTitulo,
  focavel,
  idDoTitulo,
  lenteComDrill = true,
}: {
  titulo: string;
  subtitulo: string;
  rotuloColuna: ColunaDaTabela;
  /** `lente.unidade`: "matérias", "menções"... */
  unidade: string;
  nos: T[];
  destaqueId?: string;
  navegavel: (no: T) => boolean;
  /** O endereço do nível de baixo, que vira o `href` da linha navegável. */
  enderecoDe: (no: T) => EnderecoDoDrill;
  aoAbrir: (no: T) => void;
  /** "A conta fecha", montado pelo nível (`RodapeDaConta`). */
  rodape?: ReactNode;
  /** Repassados ao `CartaoDoDrill`: no Nível 1 este é o título do nível (A5). */
  nivelDoTitulo?: 'h2' | 'h3';
  refDoTitulo?: Ref<HTMLHeadingElement>;
  focavel?: boolean;
  idDoTitulo?: string;
  /** `lente.drill`: no Mercado (D2) nenhuma linha abre, e o `title` diz por
   *  quê. */
  lenteComDrill?: boolean;
}) {
  const grupos = agruparPorImpacto(nos);
  const escala = escalaDeImpacto(nos.map((n) => n.impacto));
  const volumeIrmaos = nos.reduce((s, n) => s + n.volume, 0);
  const maiorVolume = nos.reduce((m, n) => Math.max(m, n.volume), 0);

  const linhas = (lista: T[]) =>
    lista.map((no) => {
      const vaiAbrir = navegavel(no);
      return (
        <Linha
          key={no.id}
          no={no}
          unidade={unidade}
          volumeIrmaos={volumeIrmaos}
          maiorVolume={maiorVolume}
          escala={escala}
          destaque={no.id === destaqueId}
          navegavel={vaiAbrir}
          endereco={vaiAbrir ? enderecoDe(no) : undefined}
          aoAbrir={aoAbrir}
          motivoFixa={vaiAbrir ? '' : motivoSemDetalhamento(no, rotuloColuna, lenteComDrill)}
        />
      );
    });

  return (
    <CartaoDoDrill
      titulo={titulo}
      subtitulo={subtitulo}
      nivelDoTitulo={nivelDoTitulo}
      refDoTitulo={refDoTitulo}
      focavel={focavel}
      idDoTitulo={idDoTitulo}
    >
      <div style={{ margin: '0 -20px -20px' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 820 }}>
            <div aria-hidden="true" className="kicker" style={{ ...ESTILO_DA_GRADE, borderTop: '1px solid var(--borda)' }}>
              <span>{rotuloColuna}</span>
              <span>Volume</span>
              <span>Sentimento</span>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span>Impacto na nota</span>
                <span style={{ fontSize: 12, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>pontos</span>
              </span>
              <span />
            </div>
            {grupos.pressiona.length > 0 ? (
              <Grupo rotulo="O que pressiona" cor="var(--erro-fg)" soma={grupos.somaPressiona}>
                {linhas(grupos.pressiona)}
              </Grupo>
            ) : null}
            {grupos.sustenta.length > 0 ? (
              <Grupo rotulo="O que sustenta" cor="var(--ok-fg)" soma={grupos.somaSustenta}>
                {linhas(grupos.sustenta)}
              </Grupo>
            ) : null}
          </div>
        </div>
        {rodape ? (
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--borda)' }}>{rodape}</div>
        ) : null}
      </div>
    </CartaoDoDrill>
  );
}
