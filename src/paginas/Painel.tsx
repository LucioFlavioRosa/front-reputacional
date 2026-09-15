/** Painel — a visão consolidada do recorte. */

import { useMemo, useState } from 'react';
import { usePainel } from '@/estado/painel';
import { BarraDivergente } from '@/graficos/BarraDivergente';
import { BarrasEmpilhadas, Legenda } from '@/graficos/BarrasEmpilhadas';
import { MapaUf } from '@/graficos/MapaUf';
import { Ranking } from '@/graficos/Ranking';
import { Carregando, Chip, FaixaDeErro, Kpi, KpiHero, Secao, Vazio } from '@/componentes/basicos';
import { numero, percentual, rotuloDaSemana, rotuloDoMes, rotuloDoSemestre } from '@/dominio/formato';
import {
  CORES_DE_FRENTE,
  ROTULOS_DE_FRENTE,
  rotuloDeAbrangencia,
} from '@/dominio/frentes';
import { alternar, alternarTag } from '@/dominio/recorte';
import { FRENTES } from '@/dominio/tipos';
import type { Frente } from '@/dominio/tipos';
import {
  chaveDoPeriodo,
  completarPeriodos,
  distribuicaoPorUf,
  kpis as calcularKpis,
  nomesDosTemas,
  ranking,
  resumoDeClimaPorFrente,
  scorePorArea,
  scorePorTema,
  serieMensal,
  temasMaisRecorrentes,
} from '@/dominio/derivacoes';
import type { Granularidade } from '@/dominio/derivacoes';

//: DE VOLTA À TELA — saíram por um tempo ("tirar por enquanto, não apagar")
//: enquanto o conteúdo de cada card era repensado (termômetro por área,
//: destaque pro Tier 1). Continua uma constante, e não inline no JSX: tirar
//: de novo é só trocar `true` por `false`, sem mexer no bloco.
const EXIBIR_KPIS = false;

const ROTULOS_DE_GRANULARIDADE: Record<Granularidade, string> = {
  semana: 'Semana',
  mes: 'Mês',
  semestre: '6 meses',
};

const ADJETIVO_DE_GRANULARIDADE: Record<Granularidade, string> = {
  semana: 'semanal',
  mes: 'mensal',
  semestre: 'semestral',
};

/** Como ler a chave de cada coluna em texto, por granularidade — o mesmo par
 *  chave/rótulo que `formato.ts` já expõe para mês, só que escolhido em
 *  tempo de render em vez de fixo em `rotuloDoMes`. */
const FORMATADORES_DE_ROTULO: Record<Granularidade, (chave: string) => string> = {
  semana: rotuloDaSemana,
  mes: rotuloDoMes,
  semestre: rotuloDoSemestre,
};

export function Painel({
  aoAbrirFrente,
  aoAbrirAgenda,
}: {
  aoAbrirFrente: (frente: Frente) => void;
  /** Abre a Ficha de uma agenda específica — usado pela lista que se abre ao
   *  clicar num tema na barra divergente. */
  aoAbrirAgenda: (id: string) => void;
}) {
  const { interacoes, recorte, definirRecorte, catalogo, carregando, erro } = usePainel();

  //: SÓ DESTE GRÁFICO, e não do Recorte. É "mostre também este tema", não
  //: "filtre a base por este tema" — por isso vive aqui, e não na URL: um
  //: link copiado não precisa carregar qual tema extra alguém espiou.
  const [temasExtras, definirTemasExtras] = useState<string[]>([]);

  //: TAMBÉM SÓ DA TELA, não do Recorte — é "como eu quero ENXERGAR a série no
  //: tempo", não um filtro sobre quais interações entram na conta. Os três
  //: gráficos de série temporal compartilham a mesma escolha: lê-los em
  //: granularidades diferentes ao mesmo tempo confundiria mais do que ajudaria.
  const [granularidade, definirGranularidade] = useState<Granularidade>('mes');

  const derivado = useMemo(() => {
    if (!catalogo) return null;

    const totalInteracoes = interacoes.length || 1;

    const contagemFrentes = interacoes.reduce((acc, i) => {
      acc[i.frente] = (acc[i.frente] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const categoriasDeFrente = FRENTES.map((frente) => {
      const tot = contagemFrentes[frente] || 0;
      const pct = Math.round((tot / totalInteracoes) * 100);
      return {
        chave: frente,
        rotulo: ROTULOS_DE_FRENTE[frente],
        cor: CORES_DE_FRENTE[frente],
        detalhe: `${pct}% · ${tot}`,
        total: tot,
        pct,
      };
    });

    const interacoesComClima = interacoes.filter((i) => i.clima);
    const totalClima = interacoesComClima.length || 1;
    const contagemClimas = interacoesComClima.reduce((acc, i) => {
      if (i.clima) acc[i.clima] = (acc[i.clima] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const categoriasDeClima = catalogo.dicionarios.climas.map((clima) => {
      const tot = contagemClimas[clima.codigo] || 0;
      const pct = Math.round((tot / totalClima) * 100);
      return {
        chave: clima.codigo,
        rotulo: clima.nome,
        cor: clima.cor_hex,
        detalhe: `${pct}% · ${tot}`,
        total: tot,
        pct,
      };
    });

    const temas = temasMaisRecorrentes(interacoes, catalogo, 5);

    const geo = distribuicaoPorUf(interacoes);

    // Destaques para o banner analítico executivo
    const frenteLider = [...categoriasDeFrente].sort((a, b) => b.total - a.total)[0];
    const climaLider = [...categoriasDeClima].sort((a, b) => b.total - a.total)[0];
    const topUfPonto = geo[0];

    return {
      kpis: calcularKpis(interacoes, catalogo),
      resumoExecutivo: {
        total: interacoes.length,
        frentePrincipal: frenteLider?.total ? { rotulo: frenteLider.rotulo, pct: frenteLider.pct } : undefined,
        climaPrincipal: climaLider?.total ? { rotulo: climaLider.rotulo, pct: climaLider.pct } : undefined,
        topUf: topUfPonto ? { rotulo: rotuloDeAbrangencia(topUfPonto.uf), total: topUfPonto.total } : undefined,
      },
      resumoDeClima: {
        eventos: resumoDeClimaPorFrente(interacoes, ['eventos']),
        legislativo: resumoDeClimaPorFrente(interacoes, ['legislativo']),
        institucionais: resumoDeClimaPorFrente(interacoes, ['governo', 'parceiros']),
        bancosCredores: resumoDeClimaPorFrente(interacoes, ['bancos_credores']),
      },
      categoriasDeFrente,
      categoriasDeClima,
      temas,
      volumetria: completarPeriodos(
        serieMensal(interacoes, categoriasDeFrente, (i) => [i.frente], granularidade),
        granularidade,
      ),
      clima: completarPeriodos(
        serieMensal(interacoes, categoriasDeClima, (i) => (i.clima ? [i.clima] : []), granularidade),
        granularidade,
      ),
      porTema: completarPeriodos(
        serieMensal(
          interacoes,
          temas,
          (i) => nomesDosTemas(catalogo, i.temas).filter((nome) => temas.some((tema) => tema.chave === nome)),
          granularidade,
        ),
        granularidade,
      ),
      scorePorTema: scorePorTema(interacoes, catalogo, 8, temasExtras),
      scorePorArea: scorePorArea(interacoes, catalogo),
      geo,
      instituicoes: ranking(interacoes, catalogo, 'entidade'),
      esferas: ranking(interacoes, catalogo, 'esfera'),
      unidades: ranking(interacoes, catalogo, 'unidade'),
    };
  }, [interacoes, catalogo, temasExtras, granularidade]);

  if (erro) return <FaixaDeErro mensagem={erro} />;
  if (carregando || !derivado) return <Carregando rotulo="Carregando o recorte…" />;
  if (!interacoes.length) {
    return (
      <Vazio
        mensagem="Nenhum registro no recorte"
        dica="Ajuste os filtros ou cadastre a primeira interação."
      />
    );
  }

  const { kpis } = derivado;

  //: Só oferece um tema que TEM clima registrado neste recorte — um sem dado
  //: nenhum entraria na lista de "+ Ver outro tema" e mostraria uma barra
  //: vazia. Por isso vem de `todos` (já filtrado por `scorePorTema`), e não
  //: do catálogo cru.
  const temasDisponiveis = derivado.scorePorTema.todos.filter(
    (tema) => !derivado.scorePorTema.itens.some((item) => item.chave === tema.chave),
  );

  return (
    // 24px entre blocos principais — degrau único de respiro entre seções distintas.
    // Blocos relacionados (clima + temas) usam gap menor internamente (12px).
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* UM herói, seis quietos — de propósito.
          Imprensa é a frente mais lida como "reputação" no dia a dia, e é a
          única com uma meta de qualidade (aproveitamento) e não só volume: as
          duas coisas juntas a tornam a manchete natural da tela. Um segundo
          card do mesmo tamanho disputaria a mesma atenção e anularia a
          hierarquia que o destaque existe para criar.

          Os secundários usam a cor REAL da frente (`CORES_DE_FRENTE`) — a
          mesma da legenda de "Volumetria mensal por frente" logo abaixo — em
          vez de uma cor default sem relação com o número. "Institucionais"
          soma governo + parceiros e por isso não leva a cor de nenhum dos
          dois sozinho: dois pontos dizem que é uma soma. "Tier 1" é sinal de
          qualidade, não uma frente, e por isso fica no azul-mar da marca em
          vez de competir pela paleta das frentes. */}
      {EXIBIR_KPIS ? (
        <div className="grade--kpis-painel">
          <KpiHero
            rotulo="Demandas de imprensa"
            valor={numero(kpis.imprensa.total)}
            selo="Frente · Imprensa"
            progresso={{
              fracao: kpis.imprensa.taxa,
              rotulo: `${percentual(kpis.imprensa.atendidas, kpis.imprensa.total)} de aproveitamento`,
            }}
            aoClicar={() => aoAbrirFrente('imprensa')}
          />
          <Kpi
            rotulo="Eventos e participações"
            valor={numero(kpis.eventos)}
            dica={`${derivado.resumoDeClima.eventos.positivas} pos, ${derivado.resumoDeClima.eventos.negativas} neg`}
            cor={CORES_DE_FRENTE.eventos}
            aoClicar={() => aoAbrirFrente('eventos')}
          />
          <Kpi
            rotulo="Interações com investidores"
            valor={numero(kpis.investidores.total)}
            dica={`${kpis.investidores.internacionais} internacionais`}
            cor={CORES_DE_FRENTE.investidores}
            aoClicar={() => aoAbrirFrente('investidores')}
          />
          <Kpi
            rotulo="Proposições legislativas"
            valor={numero(kpis.legislativo)}
            dica={`${derivado.resumoDeClima.legislativo.positivas} pos, ${derivado.resumoDeClima.legislativo.negativas} neg`}
            cor={CORES_DE_FRENTE.legislativo}
            aoClicar={() => aoAbrirFrente('legislativo')}
          />
          <Kpi
            rotulo="Interações institucionais"
            valor={numero(kpis.institucionais)}
            dica={`${derivado.resumoDeClima.institucionais.positivas} pos, ${derivado.resumoDeClima.institucionais.negativas} neg`}
            cor={CORES_DE_FRENTE.governo}
            aoClicar={() => aoAbrirFrente('governo')}
          />
          <Kpi
            rotulo={ROTULOS_DE_FRENTE.bancos_credores}
            valor={numero(derivado.resumoDeClima.bancosCredores.total)}
            dica={`${derivado.resumoDeClima.bancosCredores.positivas} pos, ${derivado.resumoDeClima.bancosCredores.negativas} neg`}
            cor={CORES_DE_FRENTE.bancos_credores}
            aoClicar={() => aoAbrirFrente('bancos_credores')}
          />
          <Kpi
            rotulo="Relevância Tier 1"
            valor={numero(kpis.tier1.total)}
            dica={`${percentual(kpis.tier1.total, interacoes.length)} da amostra`}
            cor="var(--azul-mar)"
            aoClicar={() => definirRecorte(alternar(recorte, 'tier', 1))}
          />
        </div>
      ) : null}

      {/* BANNER DE SÍNTESE EXECUTIVA — Fatos relevantes do recorte em destaque */}
      <ResumoExecutivoDoRecorte
        total={derivado.resumoExecutivo.total}
        frentePrincipal={derivado.resumoExecutivo.frentePrincipal}
        climaPrincipal={derivado.resumoExecutivo.climaPrincipal}
        topUf={derivado.resumoExecutivo.topUf}
      />

      {/* NO LUGAR DOS KPIS, enquanto EXIBIR_KPIS estiver false — é o
          conteúdo que o comentário de `EXIBIR_KPIS` já previa para esse
          espaço. Sempre TODAS as áreas ativas do dicionário (mesmo sem
          nenhuma agenda ainda), porque é um termômetro para comparar todas de
          uma vez, não um ranking recortado como a barra por tema logo abaixo.
          A contagem não é fixa em código — `area_pessoa` pode aposentar ou
          ganhar linha (ver 0033_area_performance_e_dados_desativada.sql), e o
          texto abaixo lê o tamanho de verdade em vez de repetir um número. */}
      <Secao titulo="Termômetro por área" estilo={{ borderTop: '3px solid var(--azul-mar)' }}>
        <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '-10px 0 4px' }}>
          {derivado.scorePorArea.length === 1
            ? 'A única área interna ativa'
            : `As ${derivado.scorePorArea.length} áreas internas ativas`}
          , com o clima das interações em que participaram — do pior para o melhor.
        </p>
        <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '0 0 14px' }}>
          O número é o placar de clima da área: (proativas − reativas) ÷ total de interações ×
          100. Vai de −100 (só reativas) a +100 (só proativas); 0 é equilíbrio, maioria
          neutra, ou nenhuma interação com clima ainda.
        </p>
        <BarraDivergente itens={derivado.scorePorArea} aoAbrirAgenda={aoAbrirAgenda} />
      </Secao>


      {/* BLOCO: SÉRIES TEMPORAIS — volumetria, clima e temas compartilham o
          mesmo seletor de granularidade e respondem juntos "o que aconteceu
          no tempo". Gap interno menor (12px) mostra que são do mesmo grupo. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="kicker" style={{ color: 'var(--cinza-2)', paddingLeft: 2 }}>
          Séries temporais
        </div>

        <Secao
          titulo={`Volumetria ${ADJETIVO_DE_GRANULARIDADE[granularidade]} por frente`}
          subtitulo="Distribuição temporal das agendas acumuladas pelas 7 frentes institucionais"
          acao={
            <SeletorDeGranularidade
              valor={granularidade}
              aoEscolher={definirGranularidade}
            />
          }
        >
          <BarrasEmpilhadas
            colunas={derivado.volumetria}
            altura={220}
            formatarRotulo={FORMATADORES_DE_ROTULO[granularidade]}
            aoClicarSegmento={(chave) =>
              definirRecorte(alternar(recorte, 'frente', chave as Frente))
            }
            detalheDoMes={(coluna) => {
              const registrosDoPeriodo = interacoes.filter(
                (i) => chaveDoPeriodo(i.data_interacao, granularidade) === coluna.mes,
              );
              const tier1 = registrosDoPeriodo.filter((i) => i.tier === 1).length;
              const temas = catalogo ? temasMaisRecorrentes(registrosDoPeriodo, catalogo, 1) : [];
              return [
                { rotulo: 'Tier 1', valor: String(tier1) },
                { rotulo: 'Tema principal', valor: temas[0]?.rotulo ?? '—' },
              ];
            }}
          />
          <Legenda
            itens={derivado.categoriasDeFrente}
            ativo={recorte.frente}
            aoClicar={(chave) => definirRecorte(alternar(recorte, 'frente', chave as Frente))}
          />
        </Secao>

        <Secao
          titulo="Clima da interação no tempo"
          subtitulo="Evolução da classificação de clima (Propositivo, Neutro e Tenso) no período"
        >
          <BarrasEmpilhadas
            colunas={derivado.clima}
            altura={140}
            formatarRotulo={FORMATADORES_DE_ROTULO[granularidade]}
          />
          <Legenda
            itens={derivado.categoriasDeClima}
            ativo={recorte.clima}
            aoClicar={(chave) => definirRecorte(alternar(recorte, 'clima', chave))}
          />
        </Secao>

        <Secao
          titulo="Temas no tempo"
          subtitulo="Recorrência das pautas institucionais mais debatidas ao longo do tempo"
        >
          <BarrasEmpilhadas
            colunas={derivado.porTema}
            altura={140}
            formatarRotulo={FORMATADORES_DE_ROTULO[granularidade]}
          />
          <Legenda
            itens={derivado.temas}
            ativo={recorte.tags?.[0]}
            aoClicar={(chave) => definirRecorte(alternarTag(recorte, chave))}
          />
          <p style={{ fontSize: 11, color: 'var(--cinza-2)', marginTop: 10 }}>
            Uma interação com três temas conta nos três.
          </p>
        </Secao>
      </div>

      <Secao
        titulo="Barra divergente por tema"
        subtitulo="Desempenho comparativo de clima por pauta (do pior ao melhor placar)"
      >
        <div
          style={{
            marginBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <p style={{ fontSize: 12, color: 'var(--cinza-3)', margin: 0 }}>
            {derivado.scorePorTema.totalDeTemas > derivado.scorePorTema.itens.length
              ? `Os ${derivado.scorePorTema.itens.length} temas mais discutidos, de ${derivado.scorePorTema.totalDeTemas} com clima registrado neste recorte — do pior para o melhor.`
              : `Os ${derivado.scorePorTema.itens.length} temas com clima registrado neste recorte — do pior para o melhor.`}
          </p>
          <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: 0 }}>
            Placar de clima: (proativas − reativas) ÷ total × 100.
            Varia de −100 (só reativas) a +100 (só proativas); 0 é equilíbrio.
          </p>
        </div>

        {temasExtras.length || temasDisponiveis.length ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 6,
              marginBottom: 16,
            }}
          >
            {temasExtras.map((nome) => (
              <Chip
                key={nome}
                rotulo={nome}
                ativo
                fundo="var(--azul-mar)"
                texto="var(--branco)"
                titulo={`Tirar ${nome} do gráfico`}
                aoClicar={() => definirTemasExtras(temasExtras.filter((t) => t !== nome))}
              />
            ))}
            {temasDisponiveis.length ? (
              <select
                value=""
                onChange={(evento) => {
                  if (evento.target.value) {
                    definirTemasExtras([...temasExtras, evento.target.value]);
                  }
                }}
                style={{
                  height: 26,
                  padding: '0 8px',
                  border: '1px dashed var(--borda-input)',
                  borderRadius: 'var(--r-chip)',
                  background: 'transparent',
                  color: 'var(--cinza-2)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <option value="">+ Ver outro tema…</option>
                {temasDisponiveis.map((tema) => (
                  <option key={tema.chave} value={tema.chave}>
                    {tema.rotulo} ({tema.total})
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        ) : null}

        <BarraDivergente itens={derivado.scorePorTema.itens} aoAbrirAgenda={aoAbrirAgenda} />
      </Secao>

      {/* BLOCO: DISTRIBUIÇÃO E RANKINGS — mapa + três rankings respondem juntos
          "onde está e com quem". Gap interno de 12px mostra que são do mesmo grupo. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="kicker" style={{ color: 'var(--cinza-2)', paddingLeft: 2 }}>
          Distribuição e rankings
        </div>

        <Secao
          titulo="Distribuição geográfica"
          subtitulo="Concentração de presença física e impacto institucional por Estado (UF)"
        >
          <div className="grade grade--mapa" style={{ gap: 24 }}>
            <MapaUf
              pontos={derivado.geo}
              selecionada={recorte.uf}
              aoClicarUf={(uf) => definirRecorte(alternar(recorte, 'uf', uf))}
            />
            <div>
              <div className="kicker" style={{ marginBottom: 12 }}>
                Ranking por UF
              </div>
              <Ranking
                itens={derivado.geo.map((ponto) => ({
                  chave: ponto.uf,
                  rotulo: rotuloDeAbrangencia(ponto.uf),
                  total: ponto.total,
                }))}
                ativo={recorte.uf}
                aoClicar={(uf) => definirRecorte(alternar(recorte, 'uf', uf))}
              />
            </div>
          </div>
        </Secao>

        <div className="grade grade--3" style={{ gap: 12 }}>
          <Secao titulo="Instituições" subtitulo="Principais entidades e parceiras">
            <Ranking
              itens={derivado.instituicoes}
              ativo={recorte.entidade}
              aoClicar={(nome) => definirRecorte(alternar(recorte, 'entidade', nome))}
            />
          </Secao>

          <Secao titulo="Esfera e abrangência" subtitulo="Divisão por nível de governo">
            <Ranking itens={derivado.esferas} cor="var(--turquesa-rio)" />
          </Secao>

          <Secao titulo="Unidades de negócio" subtitulo="Volume por unidade operacional Aegea">
            <Ranking
              itens={derivado.unidades}
              ativo={recorte.unidade}
              aoClicar={(nome) => definirRecorte(alternar(recorte, 'unidade', nome))}
              cor="var(--roxo-acai)"
            />
          </Secao>
        </div>
      </div>
    </div>
  );
}

/** Semana / Mês / 6 meses — a granularidade dos três gráficos de série
 *  temporal do Painel, todos amarrados na mesma escolha (ver o comentário
 *  onde `granularidade` nasce, acima). Pílulas, no mesmo estilo do resto da
 *  tela, e não um `<select>`: são só três opções, sempre a mesma pergunta, e
 *  o valor ativo precisa estar visível sem abrir nada. */
function SeletorDeGranularidade({
  valor,
  aoEscolher,
}: {
  valor: Granularidade;
  aoEscolher: (granularidade: Granularidade) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {(Object.keys(ROTULOS_DE_GRANULARIDADE) as Granularidade[]).map((chave) => {
        const ativo = chave === valor;
        return (
          <button
            key={chave}
            type="button"
            onClick={() => aoEscolher(chave)}
            aria-pressed={ativo}
            style={{
              height: 26,
              padding: '0 11px',
              borderRadius: 'var(--r-chip)',
              border: ativo ? '1px solid var(--azul-mar)' : '1px solid var(--borda-input)',
              background: ativo ? 'var(--azul-mar)' : 'var(--branco)',
              color: ativo ? 'var(--branco)' : 'var(--cinza-3)',
              fontSize: 11.5,
              fontWeight: ativo ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            {ROTULOS_DE_GRANULARIDADE[chave]}
          </button>
        );
      })}
    </div>
  );
}

function ResumoExecutivoDoRecorte({
  total,
  frentePrincipal,
  climaPrincipal,
  topUf,
}: {
  total: number;
  frentePrincipal?: { rotulo: string; pct: number };
  climaPrincipal?: { rotulo: string; pct: number };
  topUf?: { rotulo: string; total: number };
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 18px',
        background: 'var(--branco)',
        border: '1px solid var(--borda)',
        borderRadius: 'var(--r-card)',
        fontSize: 12.5,
        color: 'var(--cinza-3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="kicker" style={{ color: 'var(--azul-mar)' }}>
          Síntese Executiva
        </span>
        <span style={{ color: 'var(--borda-input)' }}>|</span>
        <span>
          Amostra: <strong className="tabular" style={{ color: 'var(--cinza-4)' }}>{total}</strong> agendas no recorte
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        {frentePrincipal ? (
          <div>
            <span style={{ color: 'var(--cinza-2)' }}>Frente principal: </span>
            <strong style={{ color: 'var(--cinza-4)' }}>{frentePrincipal.rotulo}</strong>{' '}
            <span className="tabular" style={{ color: 'var(--cinza-2)' }}>({frentePrincipal.pct}%)</span>
          </div>
        ) : null}

        {climaPrincipal ? (
          <div>
            <span style={{ color: 'var(--cinza-2)' }}>Clima predominante: </span>
            <strong style={{ color: 'var(--cinza-4)' }}>{climaPrincipal.rotulo}</strong>{' '}
            <span className="tabular" style={{ color: 'var(--cinza-2)' }}>({climaPrincipal.pct}%)</span>
          </div>
        ) : null}

        {topUf ? (
          <div>
            <span style={{ color: 'var(--cinza-2)' }}>Maior volume: </span>
            <strong style={{ color: 'var(--cinza-4)' }}>{topUf.rotulo}</strong>{' '}
            <span className="tabular" style={{ color: 'var(--cinza-2)' }}>({topUf.total} agendas)</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
