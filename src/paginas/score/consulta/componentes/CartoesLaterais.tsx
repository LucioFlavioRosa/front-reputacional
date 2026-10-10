/** Cartões laterais do Nível 1 (spec E.4.3 e E.8), um por item de
 *  `lente.cartoesLaterais`, desenhados conforme o `tipo`.
 *
 *  NESTA RODADA (decisão D2) só aparecem os da Imprensa (`oQueMudou`,
 *  `historia`) e os do Mercado (`divergentes`, `eventos`). Os das outras
 *  lentes (`tabela`, `post`, `saldos`, `contagens`) já estão desenhados pela
 *  E.8, porque são simples e vêm prontos do JSON; tipo desconhecido não
 *  desenha nada, nunca quebra.
 *
 *  O "O QUE MUDOU" NÃO AFIRMA A NOTA (decisão D1): sem o título "A nota
 *  caiu…" e sem o par "48 → 42". A Jornada da lente, logo acima do drill,
 *  já mostra a nota real; dois números para a mesma lente confundiriam.
 *  O nome de cada pilar navegável leva ao Nível 2 dele (decisão A16).
 *
 *  TODO CARTÃO É UM `CartaoDoDrill`, com o botão PNG (decisão A12).
 */

import type { CSSProperties, MouseEvent, ReactNode } from 'react';

import { Selo } from '@/componentes/basicos';

import {
  COR_DE_SENTIMENTO_NO_GRAFICO,
  COR_EIXO,
  COR_NEGATIVO_GRAFICO,
  COR_POSITIVO_GRAFICO,
  SELO_DE_PERFIL,
  SELO_DE_SENTIMENTO,
} from '../cores';
import type { EnderecoDoDrill } from '../endereco';
import { escalaDeImpacto } from '../dados/seletores';
import type { CartaoLateral, Item, Lente, Sentimento } from '../dados/tipos';
import '../consulta.css';
import { corDoSinal, fmtDataCurta, fmtDataLonga, fmtInt, fmtPt, fmtSaldo } from '../formatacao';
import { BarraImpacto } from '../graficos/BarraImpacto';
import { BarraVolume } from '../graficos/BarraVolume';
import { larguraPct } from '../graficos/escalas';
import {
  acharItem,
  acharSubtemaDoDestino,
  enderecoDoDestino,
  enderecoDoPilar,
  hrefDoDrill,
  pilarNavegavelPeloNome,
} from './apoioDosCartoes';
import type { PostLateral } from './apoioDosCartoes';
import { CartaoDoDrill } from './CartaoDoDrill';
import { ehCliqueSimples } from './cliqueSimples';
import { SeloDeSentimento } from './SeloDeSentimento';
import { SeloDeTier } from './SeloDeTier';

type Props = {
  lente: Lente;
  aoIr: (e: EnderecoDoDrill) => void;
  aoAbrirItem: (item: Item, botao: HTMLElement) => void;
  /** Sem ele, o post aparece sem o botão "Ver post ↗" (nunca um botão que
   *  não faz nada). */
  aoAbrirPost?: (post: PostLateral, titulo: string, botao: HTMLElement) => void;
};

type De<T extends CartaoLateral['tipo']> = Extract<CartaoLateral, { tipo: T }>;

// ---------------------------------------------------------------------------
// Peças comuns
// ---------------------------------------------------------------------------

const LINHA: CSSProperties = { borderTop: '1px solid var(--bg-trilho)', padding: '8px 0' };

/** A cor vem de `.consulta-link` (hover #111799, E.1): inline venceria o
 *  `:hover`. */
const ESTILO_DO_LINK: CSSProperties = {
  fontWeight: 700,
  textDecoration: 'underline',
  textUnderlineOffset: 2,
};

/** Cores e borda em `.consulta-botao-contornado` (hover #111799, E.1). */
const ESTILO_DO_BOTAO_SECUNDARIO: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 40,
  padding: '0 14px',
  borderRadius: 'var(--r-btn)',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

/** Link do drill: `href` com o hash (Ctrl+clique abre noutra aba) e, no
 *  clique comum, a navegação do próprio drill (push, rolagem e foco). */
function LinkDoDrill({
  destino,
  aoIr,
  children,
  estilo,
  className,
}: {
  destino: EnderecoDoDrill;
  aoIr: (e: EnderecoDoDrill) => void;
  children: ReactNode;
  estilo?: CSSProperties;
  className?: string;
}) {
  return (
    <a
      href={hrefDoDrill(destino)}
      className={className ? `consulta-link ${className}` : 'consulta-link'}
      style={{ ...ESTILO_DO_LINK, ...estilo }}
      onClick={(evento: MouseEvent<HTMLAnchorElement>) => {
        if (!ehCliqueSimples(evento)) return;
        evento.preventDefault();
        aoIr(destino);
      }}
    >
      {children}
    </a>
  );
}

/** Selo de sentimento com texto livre (o `selo` dos eventos do Mercado, como
 *  "Sem nova leitura"): mesmas cores e bolinha do `SeloDeSentimento`. */
function SeloComTexto({ sentimento, texto }: { sentimento: Sentimento; texto: string }) {
  const cores = SELO_DE_SENTIMENTO[sentimento];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px',
        borderRadius: 'var(--r-chip)',
        background: cores.fundo,
        color: cores.texto,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden
        style={{ width: 6, height: 6, borderRadius: '50%', background: COR_DE_SENTIMENTO_NO_GRAFICO[sentimento], flex: '0 0 auto' }}
      />
      {texto}
    </span>
  );
}

/** Linha "rótulo | barra de impacto compacta" (oQueMudou e divergentes).
 *  `nomeDaBarra` troca o nome acessível padrão da barra ("Impacto na nota"). */
function LinhaDeImpacto({
  rotulo,
  valor,
  escala,
  nomeDaBarra,
}: {
  rotulo: ReactNode;
  valor: number;
  escala: number;
  nomeDaBarra?: string;
}) {
  return (
    <li
      style={{
        ...LINHA,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1.35, color: 'var(--cinza-4)' }}>{rotulo}</span>
      <BarraImpacto valor={valor} escala={escala} compacta rotulo={nomeDaBarra} />
    </li>
  );
}

const LISTA: CSSProperties = { listStyle: 'none', margin: 0, padding: 0 };

// ---------------------------------------------------------------------------
// Um componente por tipo
// ---------------------------------------------------------------------------

function OQueMudou({ cartao, lente, aoIr }: { cartao: De<'oQueMudou'>; lente: Lente; aoIr: Props['aoIr'] }) {
  const escala = escalaDeImpacto(
    cartao.linhas.map((l) => l.valor),
    1.15,
  );
  return (
    <CartaoDoDrill kicker={cartao.rotulo}>
      <ul style={LISTA}>
        {cartao.linhas.map((linha) => {
          const pilar = pilarNavegavelPeloNome(lente, linha.rotulo);
          const rotulo = pilar ? (
            <LinkDoDrill destino={enderecoDoPilar(lente, pilar)} aoIr={aoIr} estilo={{ fontWeight: 500 }}>
              {linha.rotulo}
            </LinkDoDrill>
          ) : (
            linha.rotulo
          );
          // A BARRA NÃO DIZ "IMPACTO NA NOTA": aqui o valor é a VARIAÇÃO desde
          // julho (Eficiência mudou −2,8; o impacto dela, na tabela, é −7,4).
          // O nome usa só o que está escrito na linha, sob o kicker do cartão.
          return (
            <LinhaDeImpacto
              key={linha.rotulo}
              rotulo={rotulo}
              valor={linha.valor}
              escala={escala}
              nomeDaBarra={`${linha.rotulo}: ${fmtPt(linha.valor)}`}
            />
          );
        })}
      </ul>
      <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--cinza-3)' }}>{cartao.nota}</p>
    </CartaoDoDrill>
  );
}

function Historia({
  cartao,
  lente,
  aoIr,
  aoAbrirItem,
}: {
  cartao: De<'historia'>;
  lente: Lente;
  aoIr: Props['aoIr'];
  aoAbrirItem: Props['aoAbrirItem'];
}) {
  const item = acharItem(lente, cartao.itemId);
  const subtema = acharSubtemaDoDestino(lente, cartao.destino);
  return (
    <CartaoDoDrill kicker={cartao.rotulo} titulo={cartao.titulo}>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--cinza-3)' }}>{cartao.texto}</p>

      <ul
        style={{
          ...LISTA,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(84px, 1fr))',
          gap: 8,
          margin: '16px 0',
        }}
      >
        {cartao.metricas.map((m) => (
          <li
            key={`${m.valor}-${m.rotulo}`}
            style={{
              background: m.negativo ? 'var(--erro-bg)' : 'var(--bg-app)',
              color: m.negativo ? 'var(--erro-fg)' : 'var(--cinza-4)',
              borderRadius: 'var(--r-card-int)',
              padding: '10px 12px',
            }}
          >
            <div className="tabular" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>
              {m.valor}
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.35, color: m.negativo ? 'var(--erro-fg)' : 'var(--cinza-3)' }}>
              {m.rotulo}
            </div>
          </li>
        ))}
      </ul>

      {item || subtema ? (
        <div style={{ border: '1px solid var(--borda)', borderRadius: 'var(--r-card-int)', padding: 14 }}>
          {item ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <SeloDeSentimento sentimento={item.sentimento} />
                <SeloDeTier tier={item.tier} />
                <span style={{ fontSize: 12, color: 'var(--cinza-3)' }}>
                  {item.veiculo} · {fmtDataLonga(item.data)}
                </span>
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 15, fontWeight: 700, lineHeight: 1.4, color: 'var(--cinza-4)' }}>
                {item.titulo}
              </p>
            </>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: item ? 14 : 0 }}>
            {item ? (
              <button
                type="button"
                className="sem-png sem-impressao consulta-botao-contornado"
                style={ESTILO_DO_BOTAO_SECUNDARIO}
                onClick={(evento) => aoAbrirItem(item, evento.currentTarget)}
              >
                Abrir matéria <span aria-hidden>↗</span>
              </button>
            ) : null}
            {subtema ? (
              <LinkDoDrill
                destino={enderecoDoDestino(cartao.destino)}
                aoIr={aoIr}
                className="sem-png sem-impressao"
                estilo={{ fontSize: 13, textDecoration: 'none' }}
              >
                Ver as {fmtInt(subtema.volume)} matérias
              </LinkDoDrill>
            ) : null}
          </div>
        </div>
      ) : null}
    </CartaoDoDrill>
  );
}

function Divergentes({ cartao }: { cartao: De<'divergentes'> }) {
  const escala = escalaDeImpacto(
    cartao.linhas.map((l) => l.valor),
    1.1,
  );
  return (
    <CartaoDoDrill kicker={cartao.rotulo} titulo={cartao.titulo} subtitulo={cartao.subtitulo}>
      <ul style={LISTA}>
        {cartao.linhas.map((l) => (
          <LinhaDeImpacto key={l.rotulo} rotulo={l.rotulo} valor={l.valor} escala={escala} />
        ))}
      </ul>
    </CartaoDoDrill>
  );
}

function Eventos({ cartao }: { cartao: De<'eventos'> }) {
  return (
    <CartaoDoDrill kicker={cartao.rotulo} titulo={cartao.titulo}>
      <ul style={{ ...LISTA, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cartao.eventos.map((ev) => (
          <li
            key={`${ev.meta}-${ev.titulo}`}
            style={{ border: '1px solid var(--borda)', borderRadius: 'var(--r-card-int)', padding: 14 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <SeloComTexto sentimento={ev.sentimento} texto={ev.selo} />
              <span style={{ fontSize: 12, color: 'var(--cinza-3)', textAlign: 'right' }}>{ev.meta}</span>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 14, fontWeight: 700, lineHeight: 1.4, color: 'var(--cinza-4)' }}>
              {ev.titulo}
            </p>
            {ev.nota ? (
              <p style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.45, color: 'var(--cinza-3)' }}>{ev.nota}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </CartaoDoDrill>
  );
}

const CABECALHO_DE_TABELA: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--cinza-2)',
  padding: '0 0 6px',
};

function Tabela({ cartao }: { cartao: De<'tabela'> }) {
  const maximo = cartao.barras ? Math.max(0, ...cartao.barras.linhas.map((l) => l.valor)) : 0;
  return (
    <CartaoDoDrill kicker={cartao.rotulo} titulo={cartao.titulo} subtitulo={cartao.subtitulo}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {cartao.colunas.map((c, i) => (
              <th key={c} scope="col" style={{ ...CABECALHO_DE_TABELA, textAlign: i === 0 ? 'left' : 'right' }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cartao.linhas.map((linha, l) => {
            const destaque = l === cartao.linhaDestaque;
            return (
              <tr key={linha.join('|')}>
                {linha.map((celula, i) => {
                  const estilo: CSSProperties = {
                    ...LINHA,
                    fontSize: 13,
                    textAlign: i === 0 ? 'left' : 'right',
                    color: destaque && i > 0 ? 'var(--erro-fg)' : 'var(--cinza-4)',
                    fontWeight: destaque && i > 0 ? 800 : i === 0 ? 500 : 400,
                  };
                  return i === 0 ? (
                    <th key={i} scope="row" style={estilo}>
                      {celula}
                    </th>
                  ) : (
                    <td key={i} className="tabular" style={estilo}>
                      {celula}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {cartao.barras ? (
        <div style={{ marginTop: 16 }}>
          <div className="kicker" style={{ marginBottom: 8 }}>
            {cartao.barras.rotulo}
          </div>
          <ul style={{ ...LISTA, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cartao.barras.linhas.map((b) => (
              <li
                key={b.rotulo}
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 90px) minmax(0, 1fr) 48px', alignItems: 'center', gap: 10 }}
              >
                <span style={{ fontSize: 13 }}>{b.rotulo}</span>
                <BarraVolume volume={b.valor} maximo={maximo} rotulo={`${b.rotulo}: ${b.valor}${cartao.barras?.sufixo ?? ''}`} />
                <span className="tabular" style={{ fontSize: 13, fontWeight: 700, textAlign: 'right' }}>
                  {b.valor}
                  {cartao.barras?.sufixo}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </CartaoDoDrill>
  );
}

function Post({ cartao, aoAbrirPost }: { cartao: De<'post'>; aoAbrirPost: Props['aoAbrirPost'] }) {
  const { post } = cartao;
  return (
    <CartaoDoDrill kicker={cartao.rotulo} titulo={cartao.titulo}>
      <div style={{ border: '1px solid var(--borda)', borderRadius: 'var(--r-card-int)', padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SeloDeSentimento sentimento={post.sentimento} />
          <Selo rotulo={post.perfil} fundo={SELO_DE_PERFIL.fundo} texto={SELO_DE_PERFIL.texto} />
          <span style={{ fontSize: 12, color: 'var(--cinza-3)' }}>
            {post.rede} · {fmtDataCurta(post.data)} · {post.concessionaria} · {post.uf}
          </span>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--cinza-4)' }}>“{post.texto}”</p>
        <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--cinza-3)' }}>
          {post.metricas.map((m, i) => (
            <span key={m.rotulo}>
              {i > 0 ? ' · ' : null}
              <strong style={{ color: 'var(--cinza-4)' }}>{m.valor}</strong> {m.rotulo}
            </span>
          ))}
        </p>
        {aoAbrirPost ? (
          <button
            type="button"
            className="sem-png sem-impressao consulta-botao-contornado"
            style={{ ...ESTILO_DO_BOTAO_SECUNDARIO, marginTop: 14 }}
            onClick={(evento) => aoAbrirPost(post, cartao.titulo, evento.currentTarget)}
          >
            Ver post <span aria-hidden>↗</span>
          </button>
        ) : null}
      </div>
    </CartaoDoDrill>
  );
}

/** Barra divergente do saldo de clima (E.8): escala fixa 60, valor inteiro,
 *  sem "pt" (por isso não é a `BarraImpacto`, que escreve pontos). */
const ESCALA_DO_SALDO = 60;

function BarraDeSaldo({ saldo }: { saldo: number }) {
  const texto = fmtSaldo(saldo, 0);
  const barra =
    saldo === 0 ? null : (
      <span
        style={{
          display: 'block',
          height: 10,
          width: larguraPct(Math.abs(saldo), ESCALA_DO_SALDO),
          background: saldo < 0 ? COR_NEGATIVO_GRAFICO : COR_POSITIVO_GRAFICO,
        }}
      />
    );
  const metade: CSSProperties = { display: 'flex', alignItems: 'center', height: 24 };
  return (
    <div role="img" aria-label={`Saldo de clima ${texto}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 48px', alignItems: 'center' }}>
      <div style={{ ...metade, justifyContent: 'flex-end', borderRight: `1px solid ${COR_EIXO}` }}>{saldo < 0 ? barra : null}</div>
      <div style={metade}>{saldo > 0 ? barra : null}</div>
      <span className="tabular" style={{ textAlign: 'right', fontSize: 13, fontWeight: 800, color: corDoSinal(saldo) }}>
        {texto}
      </span>
    </div>
  );
}

function Saldos({ cartao }: { cartao: De<'saldos'> }) {
  return (
    <CartaoDoDrill kicker={cartao.rotulo} titulo={cartao.titulo} subtitulo={cartao.subtitulo}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th scope="col" style={{ ...CABECALHO_DE_TABELA, textAlign: 'left' }}>
              Instituição
            </th>
            <th scope="col" style={{ ...CABECALHO_DE_TABELA, textAlign: 'right' }}>
              Inter.
            </th>
            <th scope="col" style={{ ...CABECALHO_DE_TABELA, textAlign: 'right', width: '50%' }}>
              Saldo de clima
            </th>
          </tr>
        </thead>
        <tbody>
          {cartao.linhas.map((l) => (
            <tr key={l.nome}>
              <th scope="row" style={{ ...LINHA, textAlign: 'left', fontSize: 13, fontWeight: 500 }}>
                {l.nome}
              </th>
              <td className="tabular" style={{ ...LINHA, textAlign: 'right', fontSize: 13, paddingRight: 12 }}>
                {fmtInt(l.interacoes)}
              </td>
              <td style={LINHA}>
                <BarraDeSaldo saldo={l.saldo} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </CartaoDoDrill>
  );
}

function Contagens({ cartao }: { cartao: De<'contagens'> }) {
  return (
    <CartaoDoDrill kicker={cartao.rotulo} titulo={cartao.titulo} subtitulo={cartao.subtitulo}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {cartao.secoes.map((s) => (
          <section key={s.rotulo}>
            <div className="kicker" style={{ marginBottom: 6 }}>
              {s.rotulo}
            </div>
            <ul style={LISTA}>
              {s.linhas.map(([texto, valor]) => (
                <li key={texto} style={{ ...LINHA, display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                  <span>{texto}</span>
                  <strong className="tabular" style={{ whiteSpace: 'nowrap' }}>
                    {valor}
                  </strong>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </CartaoDoDrill>
  );
}

// ---------------------------------------------------------------------------
// A coluna
// ---------------------------------------------------------------------------

function CartaoLateralDoTipo({ cartao, lente, aoIr, aoAbrirItem, aoAbrirPost }: Props & { cartao: CartaoLateral }) {
  switch (cartao.tipo) {
    case 'oQueMudou':
      return <OQueMudou cartao={cartao} lente={lente} aoIr={aoIr} />;
    case 'historia':
      return <Historia cartao={cartao} lente={lente} aoIr={aoIr} aoAbrirItem={aoAbrirItem} />;
    case 'divergentes':
      return <Divergentes cartao={cartao} />;
    case 'eventos':
      return <Eventos cartao={cartao} />;
    case 'tabela':
      return <Tabela cartao={cartao} />;
    case 'post':
      return <Post cartao={cartao} aoAbrirPost={aoAbrirPost} />;
    case 'saldos':
      return <Saldos cartao={cartao} />;
    case 'contagens':
      return <Contagens cartao={cartao} />;
    default:
      // TIPO QUE O JSON AINDA NÃO TINHA: não desenha, não quebra.
      return null;
  }
}

export function CartoesLaterais(props: Props) {
  const { lente } = props;
  if (lente.cartoesLaterais.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
      {lente.cartoesLaterais.map((cartao, i) => (
        <CartaoLateralDoTipo key={`${cartao.tipo}-${i}`} {...props} cartao={cartao} />
      ))}
    </div>
  );
}
