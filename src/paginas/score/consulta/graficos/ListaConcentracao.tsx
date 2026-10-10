/** Lista de concentração (spec F.6): por concessionária ou por UF, o nome, a
 *  barra azul do volume sobre o volume do tema, `131 · 61%` e o impacto com
 *  1 casa, sem "pt", na cor do sinal.
 *
 *  É UMA LISTA, E NÃO UMA IMAGEM: os números já estão escritos em cada linha,
 *  e `role="img"` no conjunto os esconderia do leitor de tela. A imagem é só
 *  a barra de cada linha (`BarraVolume`, com nome acessível próprio).
 */

import { participacao } from '../dados/seletores';
import { arred, corDoSinal, fmtInt, fmtPct, fmtPtCurto } from '../formatacao';
import { BarraVolume } from './BarraVolume';

export function ListaConcentracao({
  linhas,
  volumeTotal,
  rotulo,
}: {
  linhas: { nome: string; volume: number; impacto: number }[];
  /** Volume do tema: a régua das barras e a base do percentual. */
  volumeTotal: number;
  /** Nome acessível da lista (ex.: o kicker "Concessionária" do quadro). */
  rotulo?: string;
}) {
  return (
    <ul aria-label={rotulo} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {linhas.map((l) => {
        const parte = `${fmtInt(l.volume)} · ${fmtPct(participacao(l.volume, volumeTotal))}`;
        return (
          <li
            key={l.nome}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1.6fr) 80px 64px',
              alignItems: 'center',
              // A F.6 NÃO PEDE ESPAÇO ENTRE AS COLUNAS: com duas listas lado a
              // lado, cada pixel de vão sai da coluna do nome, que já quebra
              // ("Águas do / Rio"). 8px só para o nome não encostar na barra.
              columnGap: 8,
              padding: '8px 0',
              borderTop: '1px solid var(--bg-trilho)',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cinza-4)' }}>{l.nome}</span>
            <BarraVolume volume={l.volume} maximo={volumeTotal} rotulo={`${l.nome}: ${parte}`} />
            <span
              className="tabular"
              style={{ fontSize: 13, color: 'var(--cinza-3)', textAlign: 'right', whiteSpace: 'nowrap' }}
            >
              {parte}
            </span>
            <span
              className="tabular"
              style={{
                fontSize: 13,
                fontWeight: 800,
                textAlign: 'right',
                whiteSpace: 'nowrap',
                color: corDoSinal(arred(l.impacto, 1)),
              }}
            >
              {fmtPtCurto(l.impacto)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
