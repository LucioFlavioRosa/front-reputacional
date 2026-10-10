/** Cartão de recortes do Nível 3 (spec E.6.4): o subtema em destaque do tema
 *  aberto em quatro quadros (tier, concessionária e UF, veículos,
 *  jornalistas), e o botão que desce ao Nível 4 dele.
 *
 *  TODA FRASE VEM DO JSON (`tema.nivel3.destaque`); os títulos dos quadros e
 *  das colunas são os da spec. A tela só deriva escala de barra e
 *  participação no subtema.
 *
 *  SEM DESTAQUE, SEM CARTÃO: tema sem `nivel3` ou com `subtemaId` que não
 *  existe nos filhos não desenha nada (nunca um cartão pela metade).
 */

import type { CSSProperties, ReactNode } from 'react';

import '../consulta.css';
import { DADOS } from '../dados/dados';
import { escalaDeImpacto, participacao } from '../dados/seletores';
import type { LinhaRecorte, Subtema, Tema } from '../dados/tipos';
import { arred, corDoSinal, fmtInt, fmtPct, fmtPtCurto } from '../formatacao';
import { BarraImpacto } from '../graficos/BarraImpacto';
import { BarraVolume } from '../graficos/BarraVolume';
import { maiorVolume, nomeDoMes } from './apoioDosCartoes';
import { CartaoDoDrill } from './CartaoDoDrill';
import { SeloDeTier } from './SeloDeTier';

const LINHA: CSSProperties = { borderTop: '1px solid var(--bg-trilho)', padding: '8px 0' };

const CABECALHO: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--cinza-2)',
  padding: '0 0 6px',
};

const LISTA: CSSProperties = { listStyle: 'none', margin: 0, padding: 0 };

function Quadro({ kicker, titulo, children }: { kicker: string; titulo: string; children: ReactNode }) {
  return (
    <section
      style={{ border: '1px solid var(--borda)', borderRadius: 'var(--r-card-int)', padding: 16, minWidth: 0 }}
    >
      <div className="kicker" style={{ marginBottom: 4 }}>
        {kicker}
      </div>
      <h4
        style={{
          margin: '0 0 12px',
          fontSize: 15,
          fontWeight: 700,
          lineHeight: 1.4,
          letterSpacing: 'normal',
          color: 'var(--cinza-4)',
        }}
      >
        {titulo}
      </h4>
      {children}
    </section>
  );
}

/** Impacto com 1 casa, sem "pt", na cor do número ESCRITO (−0,04 sai
 *  "0,0" e fica cinza), como na `BarraImpacto`. */
function Impacto({ valor }: { valor: number }) {
  return (
    <span className="tabular" style={{ fontSize: 13, fontWeight: 800, color: corDoSinal(arred(valor, 1)) }}>
      {fmtPtCurto(valor)}
    </span>
  );
}

function PorTier({ linhas, total }: { linhas: LinhaRecorte[]; total: number }) {
  const maximo = maiorVolume(linhas);
  const escala = escalaDeImpacto(
    linhas.map((l) => l.impacto),
    1.1,
  );
  return (
    <ul style={LISTA}>
      {linhas.map((l, i) => (
        <li
          key={l.tier ?? i}
          style={{
            ...LINHA,
            display: 'grid',
            gridTemplateColumns: '70px minmax(0, 1fr) minmax(0, 1.1fr)',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span>{l.tier ? <SeloDeTier tier={l.tier} /> : null}</span>
          <span style={{ minWidth: 0 }}>
            {/* Decorativa: "34 matérias · 35%" está escrito logo abaixo. */}
            <BarraVolume volume={l.volume} maximo={maximo} decorativa />
            <span className="tabular" style={{ display: 'block', marginTop: 4, fontSize: 12, color: 'var(--cinza-3)' }}>
              {fmtInt(l.volume)} matérias · {fmtPct(participacao(l.volume, total))}
            </span>
          </span>
          <BarraImpacto valor={l.impacto} escala={escala} compacta />
        </li>
      ))}
    </ul>
  );
}

function PorConcessionaria({ linhas, total }: { linhas: LinhaRecorte[]; total: number }) {
  return (
    <ul style={LISTA}>
      {linhas.map((l, i) => (
        <li
          key={`${l.nome ?? ''}-${l.uf ?? ''}-${i}`}
          style={{
            ...LINHA,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.3fr) 32px minmax(0, 1fr) 48px',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cinza-4)' }}>{l.nome}</span>
          <span style={{ fontSize: 12, color: 'var(--cinza-3)' }}>{l.uf}</span>
          <BarraVolume
            volume={l.volume}
            maximo={total}
            rotulo={`${l.nome ?? ''}: ${fmtInt(l.volume)} matérias, ${fmtPct(participacao(l.volume, total))} do subtema`}
          />
          <span style={{ textAlign: 'right' }}>
            <Impacto valor={l.impacto} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function TabelaDeRecorte({
  primeiraColuna,
  linhas,
  celulaDoNome,
}: {
  primeiraColuna: string;
  linhas: LinhaRecorte[];
  celulaDoNome: (l: LinhaRecorte) => ReactNode;
}) {
  const numero: CSSProperties = { ...LINHA, textAlign: 'right', fontSize: 13, color: 'var(--cinza-3)' };
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th scope="col" style={{ ...CABECALHO, textAlign: 'left' }}>
            {primeiraColuna}
          </th>
          <th scope="col" style={{ ...CABECALHO, textAlign: 'right' }}>
            Matérias
          </th>
          <th scope="col" style={{ ...CABECALHO, textAlign: 'right' }}>
            Negat.
          </th>
          <th scope="col" style={{ ...CABECALHO, textAlign: 'right' }}>
            pt
          </th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((l, i) => (
          <tr key={`${l.nome ?? ''}-${i}`}>
            <th scope="row" style={{ ...LINHA, textAlign: 'left', fontWeight: 400 }}>
              {celulaDoNome(l)}
            </th>
            <td className="tabular" style={numero}>
              {fmtInt(l.volume)}
            </td>
            <td className="tabular" style={numero}>
              {l.negativas === undefined ? null : fmtInt(l.negativas)}
            </td>
            <td style={{ ...LINHA, textAlign: 'right' }}>
              <Impacto valor={l.impacto} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SetaParaDireita() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" focusable="false">
      <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CartaoDeRecortes({
  tema,
  aoVerMaterias,
  rotuloMes = DADOS.meta.rotuloMes,
}: {
  tema: Tema;
  /** Desce ao Nível 4 do subtema em destaque. */
  aoVerMaterias: (subtema: Subtema) => void;
  /** `meta.rotuloMes` ('Agosto de 2026'); o kicker usa só o mês. */
  rotuloMes?: string;
}) {
  const destaque = tema.nivel3?.destaque;
  const subtema = destaque ? tema.filhos?.find((s) => s.id === destaque.subtemaId) : undefined;
  if (!destaque || !subtema) return null;

  const mes = nomeDoMes(rotuloMes);
  const kicker = mes ? `Recortes · ${subtema.nome} em ${mes}` : `Recortes · ${subtema.nome}`;

  const botao = (
    <button
      type="button"
      className="sem-png sem-impressao consulta-botao-primario"
      onClick={() => aoVerMaterias(subtema)}
      // Fundo e cor em `.consulta-botao-primario` (hover #111799, E.1).
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        height: 44,
        padding: '0 18px',
        borderRadius: 'var(--r-btn)',
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      Ver as {fmtInt(subtema.volume)} matérias
      <SetaParaDireita />
    </button>
  );

  return (
    <CartaoDoDrill kicker={kicker} titulo={destaque.titulo} subtitulo={destaque.subtitulo} acao={botao}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))',
          gap: 16,
        }}
      >
        <Quadro kicker="Por tier" titulo={destaque.tiers.titulo}>
          <PorTier linhas={destaque.tiers.linhas} total={subtema.volume} />
        </Quadro>
        <Quadro kicker="Concessionária e UF" titulo={destaque.concessionarias.titulo}>
          <PorConcessionaria linhas={destaque.concessionarias.linhas} total={subtema.volume} />
        </Quadro>
        <Quadro kicker="Veículos que mais puxaram o negativo" titulo={destaque.veiculos.titulo}>
          <TabelaDeRecorte
            primeiraColuna="Veículo"
            linhas={destaque.veiculos.linhas}
            celulaDoNome={(l) => (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cinza-4)' }}>{l.nome}</span>
                {l.tier ? <SeloDeTier tier={l.tier} /> : null}
              </span>
            )}
          />
        </Quadro>
        <Quadro kicker="Jornalistas" titulo={destaque.jornalistas.titulo}>
          <TabelaDeRecorte
            primeiraColuna="Jornalista"
            linhas={destaque.jornalistas.linhas}
            celulaDoNome={(l) => (
              <>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--cinza-4)' }}>{l.nome}</span>
                {l.veiculo ? (
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--cinza-3)' }}>{l.veiculo}</span>
                ) : null}
              </>
            )}
          />
        </Quadro>
      </div>
    </CartaoDoDrill>
  );
}
