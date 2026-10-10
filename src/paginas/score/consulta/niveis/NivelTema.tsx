/** Nível 3 · Subtemas do tema (E.6, mockup p. 3 e 4).
 *
 *  De cima para baixo: o resumo do tema, a tabela de impacto dos subtemas
 *  (com o subtema em destaque marcado e o rodapé "A conta fecha", cujo valor
 *  final é o `impacto` do tema como está no JSON) e o cartão de recortes do
 *  subtema em destaque, com o botão "Ver as N matérias" que desce ao Nível 4.
 *
 *  "NEGATIVAS" EM VERMELHO DE TEXTO, como no mockup e como no Nível 4: é a
 *  parcela negativa do sentimento, e a cor diz isso antes do número.
 */

import type { Ref } from 'react';

import { enderecoDoPilar } from '../componentes/apoioDosCartoes';
import { CartaoDeRecortes } from '../componentes/CartaoDeRecortes';
import { LimiteDoBloco } from '../componentes/LimiteDoBloco';
import { ResumoDoNivel } from '../componentes/ResumoDoNivel';
import { RodapeDaConta, TabelaDeImpacto } from '../componentes/TabelaDeImpacto';
import { DADOS } from '../dados/dados';
import { agruparPorImpacto, subtemaNavegavel } from '../dados/seletores';
import type { Dados, Lente, Pilar, Tema } from '../dados/tipos';
import { fmtInt, fmtPct } from '../formatacao';
import { enderecoDoSubtema, metricaDeImpacto, metricaVsMesAnterior } from './apoioDosNiveis';
import type { AcoesDoNivel } from './apoioDosNiveis';

export function NivelTema({
  lente,
  pilar,
  tema,
  refDoTitulo,
  chaveDeReinicio,
  aoIr,
  meta = DADOS.meta,
}: Pick<AcoesDoNivel, 'aoIr'> & {
  lente: Lente;
  pilar: Pilar;
  tema: Tema;
  refDoTitulo: Ref<HTMLHeadingElement>;
  chaveDeReinicio: string;
  meta?: Dados['meta'];
}) {
  const subtemas = tema.filhos ?? [];
  const nivel3 = tema.nivel3;
  const grupos = agruparPorImpacto(subtemas);
  const voltar = enderecoDoPilar(lente, pilar);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <LimiteDoBloco nome="Resumo do tema" chaveDeReinicio={chaveDeReinicio}>
        <ResumoDoNivel
          kicker={`Tema estratégico · ${pilar.nome}`}
          titulo={tema.nome}
          refDoTitulo={refDoTitulo}
          rotuloDoVoltar="Voltar aos temas"
          enderecoDoVoltar={voltar}
          aoVoltar={() => aoIr(voltar)}
          metricas={[
            { rotulo: 'Matérias', valor: fmtInt(tema.volume) },
            { rotulo: 'Negativas', valor: fmtPct(tema.sentimento.neg), cor: 'var(--erro-fg)' },
            metricaDeImpacto(tema),
            ...metricaVsMesAnterior(tema, meta.mesAnterior),
          ]}
          leitura={nivel3?.leitura ?? ''}
        />
      </LimiteDoBloco>

      <LimiteDoBloco nome="Tabela de subtemas" chaveDeReinicio={chaveDeReinicio}>
        <TabelaDeImpacto
          titulo={nivel3?.tituloTabela ?? tema.nome}
          subtitulo={nivel3?.subtituloTabela ?? ''}
          rotuloColuna="Subtema"
          unidade={lente.unidade}
          nos={subtemas}
          destaqueId={nivel3?.destaque.subtemaId}
          navegavel={subtemaNavegavel}
          enderecoDe={(subtema) => enderecoDoSubtema(lente, pilar, tema, subtema)}
          aoAbrir={(subtema) => aoIr(enderecoDoSubtema(lente, pilar, tema, subtema))}
          rodape={
            <RodapeDaConta
              pressiona={grupos.somaPressiona}
              sustenta={grupos.somaSustenta}
              rotuloFinal="impacto do tema"
              valorFinal={tema.impacto}
            />
          }
        />
      </LimiteDoBloco>

      <LimiteDoBloco nome="Recortes" chaveDeReinicio={chaveDeReinicio}>
        <CartaoDeRecortes
          tema={tema}
          rotuloMes={meta.rotuloMes}
          aoVerMaterias={(subtema) => aoIr(enderecoDoSubtema(lente, pilar, tema, subtema))}
        />
      </LimiteDoBloco>
    </div>
  );
}
