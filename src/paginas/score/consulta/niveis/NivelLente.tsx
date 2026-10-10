/** Nível 1 · Lente e pilares (E.4, E.8), da Imprensa e do Mercado (D2).
 *
 *  SEM O CARTÃO DA NOTA E SEM A "LEITURA DO MÊS" (decisão D1): a Jornada da
 *  lente, logo acima do drill, já mostra a nota real, e dois números para a
 *  mesma lente fariam o cliente compará-los. Pelo mesmo motivo a tabela de
 *  pilares não tem o rodapé "A conta fecha", que termina em "= nota 42".
 *
 *  O TÍTULO DA TABELA É O TÍTULO DO NÍVEL (A5): sem o cartão da nota, ele é o
 *  único título do Nível 1, e por isso é o `h2` focável que recebe o foco ao
 *  voltar para cá.
 *
 *  A LATERAL DESCE SOZINHA abaixo de ~1180px: tabela `flex: 999 1 760px` e
 *  coluna `flex: 1 1 380px` numa linha com quebra (760 + 20 + 380 = 1160px
 *  de mínimo), sem media query.
 *
 *  NO MERCADO (`drill: false`) nenhum pilar é navegável (C.3): a tabela sai
 *  sem setas e sem link, e os cartões são os do JSON (`divergentes`,
 *  `eventos`).
 */

import type { Ref } from 'react';

import { enderecoDoPilar } from '../componentes/apoioDosCartoes';
import { CartoesLaterais } from '../componentes/CartoesLaterais';
import { LimiteDoBloco } from '../componentes/LimiteDoBloco';
import { TabelaDeImpacto } from '../componentes/TabelaDeImpacto';
import { pilarNavegavel } from '../dados/seletores';
import type { Lente } from '../dados/tipos';
import type { AcoesDoNivel } from './apoioDosNiveis';

export function NivelLente({
  lente,
  refDoTitulo,
  chaveDeReinicio,
  aoIr,
  aoAbrirItem,
  aoAbrirPost,
}: AcoesDoNivel & {
  lente: Lente;
  refDoTitulo: Ref<HTMLHeadingElement>;
  chaveDeReinicio: string;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 20 }}>
      <div style={{ flex: '999 1 760px', minWidth: 0 }}>
        <LimiteDoBloco nome="Tabela de pilares" chaveDeReinicio={chaveDeReinicio}>
          <TabelaDeImpacto
            titulo={lente.tabelaPilares.titulo}
            subtitulo={lente.tabelaPilares.subtitulo}
            rotuloColuna="Pilar"
            unidade={lente.unidade}
            nos={lente.pilares}
            navegavel={(pilar) => pilarNavegavel(lente, pilar)}
            enderecoDe={(pilar) => enderecoDoPilar(lente, pilar)}
            aoAbrir={(pilar) => aoIr(enderecoDoPilar(lente, pilar))}
            nivelDoTitulo="h2"
            focavel
            refDoTitulo={refDoTitulo}
          />
        </LimiteDoBloco>
      </div>
      <div style={{ flex: '1 1 380px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <LimiteDoBloco nome="Cartões laterais" chaveDeReinicio={chaveDeReinicio}>
          <CartoesLaterais lente={lente} aoIr={aoIr} aoAbrirItem={aoAbrirItem} aoAbrirPost={aoAbrirPost} />
        </LimiteDoBloco>
      </div>
    </div>
  );
}
