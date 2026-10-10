/** Nível 2 · Temas estratégicos do pilar (E.5, mockup p. 2).
 *
 *  De cima para baixo: o resumo do pilar, a tabela de impacto dos temas (com
 *  o tema em destaque marcado e o rodapé "A conta fecha") e, lado a lado, a
 *  evolução mês a mês e a concentração do tema em destaque.
 *
 *  TODO NÚMERO VEM DO JSON; a tela só deriva a participação do pilar na lente
 *  (`participacao`), o saldo, a diferença contra o mês anterior e as somas de
 *  "pressiona" e "sustenta". O valor final do rodapé é o `impacto` do pilar,
 *  como está no JSON, para nunca divergir da trilha por arredondamento.
 *
 *  O DESTAQUE PODE FALTAR: pilar sem `nivel2`, ou com `temaId` que não está
 *  entre os filhos, perde os cartões que dependem dele, e o resto do nível
 *  continua de pé (nunca um cartão pela metade nem um texto inventado).
 */

import type { Ref } from 'react';

import { nomeDoMes } from '../componentes/apoioDosCartoes';
import { CartaoDoDrill } from '../componentes/CartaoDoDrill';
import { LimiteDoBloco } from '../componentes/LimiteDoBloco';
import { ResumoDoNivel } from '../componentes/ResumoDoNivel';
import { RodapeDaConta, TabelaDeImpacto } from '../componentes/TabelaDeImpacto';
import { agruparPorImpacto, participacao, temaNavegavel } from '../dados/seletores';
import type { Dados, Lente, Pilar } from '../dados/tipos';
import { arred, corDoSinal, fmtInt, fmtPct, fmtSaldo } from '../formatacao';
import { GraficoColunasImpacto } from '../graficos/GraficoColunasImpacto';
import { ListaConcentracao } from '../graficos/ListaConcentracao';
import { enderecoDaLente, enderecoDoTema, metricaDeImpacto, metricaVsMesAnterior } from './apoioDosNiveis';
import type { AcoesDoNivel } from './apoioDosNiveis';

export function NivelPilar({
  lente,
  pilar,
  refDoTitulo,
  chaveDeReinicio,
  aoIr,
  meta,
}: Pick<AcoesDoNivel, 'aoIr'> & {
  lente: Lente;
  pilar: Pilar;
  refDoTitulo: Ref<HTMLHeadingElement>;
  chaveDeReinicio: string;
  meta: Dados['meta'];
}) {
  const temas = pilar.filhos ?? [];
  const nivel2 = pilar.nivel2;
  const destaque = nivel2?.destaque;
  const temaEmDestaque = destaque ? temas.find((t) => t.id === destaque.temaId) : undefined;
  const grupos = agruparPorImpacto(temas);
  const voltar = enderecoDaLente(lente);
  const { pos, neg } = pilar.sentimento;
  const mes = nomeDoMes(meta.rotuloMes);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <LimiteDoBloco nome="Resumo do pilar" chaveDeReinicio={chaveDeReinicio}>
        <ResumoDoNivel
          kicker={`Pilar · ${lente.nome}`}
          titulo={pilar.nome}
          refDoTitulo={refDoTitulo}
          rotuloDoVoltar="Voltar aos pilares"
          enderecoDoVoltar={voltar}
          aoVoltar={() => aoIr(voltar)}
          metricas={[
            { rotulo: 'Matérias', valor: fmtInt(pilar.volume) },
            { rotulo: 'Peso na lente', valor: fmtPct(participacao(pilar.volume, lente.volumeTotal)) },
            { rotulo: 'Saldo', valor: fmtSaldo(pos, neg), cor: corDoSinal(arred(pos - neg)) },
            metricaDeImpacto(pilar),
            ...metricaVsMesAnterior(pilar, meta.mesAnterior),
          ]}
          leitura={nivel2?.leitura ?? ''}
        />
      </LimiteDoBloco>

      <LimiteDoBloco nome="Tabela de temas" chaveDeReinicio={chaveDeReinicio}>
        <TabelaDeImpacto
          titulo={nivel2?.tituloTabela ?? pilar.nome}
          subtitulo={nivel2?.subtituloTabela ?? ''}
          rotuloColuna="Tema estratégico"
          unidade={lente.unidade}
          nos={temas}
          destaqueId={temaEmDestaque?.id}
          navegavel={temaNavegavel}
          enderecoDe={(tema) => enderecoDoTema(lente, pilar, tema)}
          aoAbrir={(tema) => aoIr(enderecoDoTema(lente, pilar, tema))}
          rodape={
            <RodapeDaConta
              pressiona={grupos.somaPressiona}
              sustenta={grupos.somaSustenta}
              rotuloFinal="impacto do pilar"
              valorFinal={pilar.impacto}
            />
          }
        />
      </LimiteDoBloco>

      {destaque && temaEmDestaque ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: 20 }}>
          <div style={{ flex: '1 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <LimiteDoBloco nome="Evolução mês a mês" chaveDeReinicio={chaveDeReinicio}>
              <CartaoDoDrill
                kicker={`Evolução mês a mês · ${temaEmDestaque.nome}`}
                titulo={destaque.evolucao.titulo}
                subtitulo={destaque.evolucao.subtitulo}
                estilo={{ flex: '1 1 auto' }}
              >
                <GraficoColunasImpacto
                  meses={destaque.evolucao.meses}
                  impactos={destaque.evolucao.impactos}
                  volumes={destaque.evolucao.volumes}
                  unidade={lente.unidade}
                />
              </CartaoDoDrill>
            </LimiteDoBloco>
          </div>
          <div style={{ flex: '1 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <LimiteDoBloco nome="Onde se concentra" chaveDeReinicio={chaveDeReinicio}>
              <CartaoDoDrill
                kicker={
                  mes
                    ? `Onde se concentra · ${temaEmDestaque.nome} em ${mes}`
                    : `Onde se concentra · ${temaEmDestaque.nome}`
                }
                titulo={destaque.concentracao.titulo}
                subtitulo={destaque.concentracao.subtitulo}
                estilo={{ flex: '1 1 auto' }}
              >
                {/* AS DUAS LISTAS EMPILHAM ANTES DE A COLUNA DO NOME SUMIR: com
                    a grade da F.6 (1,3fr do nome contra 1,6fr da barra e
                    144px fixos), duas listas lado a lado num cartão de
                    ~560px deixavam o nome com 41px, e "Águas do Pará" quebrava
                    em três linhas. Com 300px de mínimo, elas ficam lado a lado
                    só quando o cartão tem uns 630px úteis. */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
                    gap: '16px 28px',
                  }}
                >
                  <QuadroDeConcentracao
                    rotulo="Concessionária"
                    linhas={destaque.concentracao.concessionarias}
                    volumeTotal={temaEmDestaque.volume}
                  />
                  <QuadroDeConcentracao
                    rotulo="UF"
                    linhas={destaque.concentracao.ufs}
                    volumeTotal={temaEmDestaque.volume}
                  />
                </div>
              </CartaoDoDrill>
            </LimiteDoBloco>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Uma das duas listas da concentração, com o rótulo da spec em kicker. */
function QuadroDeConcentracao({
  rotulo,
  linhas,
  volumeTotal,
}: {
  rotulo: string;
  linhas: { nome: string; volume: number; impacto: number }[];
  volumeTotal: number;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="kicker" style={{ fontSize: 11, paddingBottom: 6 }}>
        {rotulo}
      </div>
      <ListaConcentracao linhas={linhas} volumeTotal={volumeTotal} rotulo={rotulo} />
    </div>
  );
}
