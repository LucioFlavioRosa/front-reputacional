/** Nível 4 · Matérias do subtema (E.7, mockup p. 5).
 *
 *  O resumo traz as métricas embaixo do título e, à direita, o gráfico de
 *  matérias por dia com a legenda (Negativas, Demais); abaixo, a lista de
 *  matérias da amostra (F.9).
 *
 *  A LISTA NÃO GUARDA FILTRO: aba de sentimento, ordenação, Tier,
 *  Concessionária, UF e a linha destacada (`item`) moram no endereço. Cada
 *  mudança da lista vira `replaceState` (A3), e não `pushState`: o voltar do
 *  navegador sobe de nível, em vez de desfazer clique a clique os filtros.
 *
 *  "NEGATIVAS" E "TIER 1" SÃO DO SUBTEMA INTEIRO (`contagens`, `tier1`), não
 *  da amostra; sem o dado no JSON, a métrica não aparece.
 */

import type { Ref } from 'react';

import { nomeDoMes } from '../componentes/apoioDosCartoes';
import { LimiteDoBloco } from '../componentes/LimiteDoBloco';
import { ListaDeMaterias } from '../componentes/ListaDeMaterias';
import { ResumoDoNivel } from '../componentes/ResumoDoNivel';
import type { MetricaDoResumo } from '../componentes/ResumoDoNivel';
import type { Dados, Lente, Pilar, Subtema, Tema } from '../dados/tipos';
import type { EnderecoDoDrill } from '../endereco';
import { fmtInt } from '../formatacao';
import { mesDe } from '../graficos/escalas';
import { GraficoDiario, LegendaDoGraficoDiario } from '../graficos/GraficoDiario';
import { enderecoDoTema, metricaDeImpacto, nomeDaFonte } from './apoioDosNiveis';
import type { AcoesDoNivel } from './apoioDosNiveis';

export function NivelSubtema({
  lente,
  pilar,
  tema,
  subtema,
  endereco,
  refDoTitulo,
  chaveDeReinicio,
  aoIr,
  aoMudarLista,
  aoAbrirItem,
  meta,
}: Pick<AcoesDoNivel, 'aoIr' | 'aoAbrirItem'> & {
  lente: Lente;
  pilar: Pilar;
  tema: Tema;
  subtema: Subtema;
  /** O endereço canônico da tela: a lista lê dele os filtros. */
  endereco: EnderecoDoDrill;
  /** Escreve os filtros da lista no endereço (a raiz usa `replace`). */
  aoMudarLista: (parcial: Partial<EnderecoDoDrill>) => void;
  refDoTitulo: Ref<HTMLHeadingElement>;
  chaveDeReinicio: string;
  meta: Dados['meta'];
}) {
  const voltar = enderecoDoTema(lente, pilar, tema);
  const nivel4 = subtema.nivel4;
  const mes = nomeDoMes(meta.rotuloMes);

  const metricas: MetricaDoResumo[] = [{ rotulo: 'Matérias', valor: fmtInt(subtema.volume) }];
  if (subtema.contagens) {
    metricas.push({ rotulo: 'Negativas', valor: fmtInt(subtema.contagens.neg), cor: 'var(--erro-fg)' });
  }
  if (subtema.tier1 !== undefined) metricas.push({ rotulo: 'Tier 1', valor: fmtInt(subtema.tier1) });
  metricas.push(metricaDeImpacto(subtema));

  const lateral = nivel4 ? (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '6px 16px',
          marginBottom: 8,
        }}
      >
        <span className="kicker">{mes ? `Matérias por dia em ${mes}` : 'Matérias por dia'}</span>
        <LegendaDoGraficoDiario />
      </div>
      <GraficoDiario porDia={nivel4.porDia} mes={mesDe(meta.mesReferencia)} />
    </div>
  ) : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <LimiteDoBloco nome="Resumo do subtema" chaveDeReinicio={chaveDeReinicio}>
        <ResumoDoNivel
          kicker={`Subtema · ${tema.nome}`}
          titulo={subtema.nome}
          refDoTitulo={refDoTitulo}
          rotuloDoVoltar="Voltar aos subtemas"
          enderecoDoVoltar={voltar}
          aoVoltar={() => aoIr(voltar)}
          metricas={metricas}
          lateral={lateral}
          leitura={nivel4?.leitura ?? ''}
        />
      </LimiteDoBloco>

      <LimiteDoBloco nome="Lista de matérias" chaveDeReinicio={chaveDeReinicio}>
        <ListaDeMaterias
          subtema={subtema}
          unidade={lente.unidade}
          endereco={endereco}
          aoMudar={aoMudarLista}
          aoAbrirItem={aoAbrirItem}
          fonte={nomeDaFonte(lente.fonte)}
          dataCorte={meta.dataCorte}
        />
      </LimiteDoBloco>
    </div>
  );
}
