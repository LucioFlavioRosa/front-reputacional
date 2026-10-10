/** Trilha da consulta (E.3.4): um item por nível percorrido, da lente ao
 *  nível atual, separados por uma seta cinza.
 *
 *  A LENTE NÃO TEM CHIP DE NOTA (decisão D1): a Jornada logo acima já mostra
 *  a nota real da lente, e um segundo número para a mesma lente faria o
 *  cliente comparar os dois. Pilar, tema e subtema mostram o impacto em
 *  pontos, que não existe em outro lugar da tela.
 *
 *  OS ANTERIORES SÃO LINKS COM `href` REAL (o hash do nível), e não `#`: abrir
 *  em nova aba e copiar o endereço funcionam. O clique simples navega por
 *  dentro (`aoIr`), sem recarregar. O item atual não é link: é a página em
 *  que a pessoa está (`aria-current="page"`).
 */

import type { ReactNode } from 'react';

import '../consulta.css';
import { SELO_NEUTRO } from '../cores';
import type { Caminho } from '../dados/seletores';
import { escreverEndereco } from '../endereco';
import type { EnderecoDoDrill } from '../endereco';
import { arred, fmtPt } from '../formatacao';
import { ehCliqueSimples } from './cliqueSimples';

interface ItemDaTrilha {
  chave: string;
  nome: string;
  impacto?: number;
  endereco: EnderecoDoDrill;
}

function itensDaTrilha(caminho: Caminho): ItemDaTrilha[] {
  const { lente, pilar, tema, subtema } = caminho;
  const base: EnderecoDoDrill = { ativo: true, lente: lente.id };
  const itens: ItemDaTrilha[] = [{ chave: 'lente', nome: lente.nome, endereco: base }];
  if (!pilar) return itens;
  const noPilar = { ...base, pilar: pilar.id };
  itens.push({ chave: 'pilar', nome: pilar.nome, impacto: pilar.impacto, endereco: noPilar });
  if (!tema) return itens;
  const noTema = { ...noPilar, tema: tema.id };
  itens.push({ chave: 'tema', nome: tema.nome, impacto: tema.impacto, endereco: noTema });
  if (!subtema) return itens;
  itens.push({ chave: 'subtema', nome: subtema.nome, impacto: subtema.impacto, endereco: { ...noTema, subtema: subtema.id } });
  return itens;
}

function ChipDeImpacto({ impacto }: { impacto: number }) {
  // A COR SEGUE O NÚMERO ESCRITO: um valor que arredonda para "0,0 pt" fica
  // no chip neutro, e não vermelho ou verde.
  const escrito = arred(impacto, 1);
  const cores = escrito < 0
    ? { fundo: 'var(--erro-bg)', texto: 'var(--erro-fg)' }
    : escrito > 0
      ? { fundo: 'var(--ok-bg)', texto: 'var(--ok-fg)' }
      : SELO_NEUTRO;
  return (
    <span
      className="tabular"
      data-chip
      style={{
        display: 'inline-block',
        padding: '2px 7px',
        borderRadius: 'var(--r-chip)',
        background: cores.fundo,
        color: cores.texto,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {fmtPt(impacto)}
    </span>
  );
}

function Seta() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      style={{ flex: '0 0 auto', color: 'var(--texto-placeholder)' }}
    >
      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ESTILO_DO_ITEM = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  height: 36,
  padding: '0 12px',
  borderRadius: 'var(--r-btn)',
  fontSize: 14,
  fontWeight: 700,
  whiteSpace: 'nowrap',
} as const;

export function Trilha({ caminho, aoIr }: { caminho: Caminho; aoIr: (endereco: EnderecoDoDrill) => void }) {
  const itens = itensDaTrilha(caminho);

  return (
    <nav aria-label="Trilha da consulta">
      <ol
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          margin: 0,
          padding: 0,
          listStyle: 'none',
        }}
      >
        {itens.map((item, i) => {
          const atual = i === itens.length - 1;
          const conteudo: ReactNode = (
            <>
              {item.nome}
              {item.impacto !== undefined ? <ChipDeImpacto impacto={item.impacto} /> : null}
            </>
          );
          return (
            <li key={item.chave} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {i > 0 ? <Seta /> : null}
              {atual ? (
                <span
                  aria-current="page"
                  style={{ ...ESTILO_DO_ITEM, background: 'var(--azul-mar)', color: 'var(--branco)' }}
                >
                  {conteudo}
                </span>
              ) : (
                <a
                  href={escreverEndereco(item.endereco)}
                  onClick={(evento) => {
                    if (!ehCliqueSimples(evento)) return;
                    evento.preventDefault();
                    aoIr(item.endereco);
                  }}
                  // A cor do texto vem de `.consulta-link` (hover #111799, E.1).
                  className="consulta-link"
                  style={{
                    ...ESTILO_DO_ITEM,
                    background: 'var(--branco)',
                    border: '1px solid var(--borda)',
                    textDecoration: 'none',
                  }}
                >
                  {conteudo}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
