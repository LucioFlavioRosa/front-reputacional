/** Painel — a visão consolidada do recorte. */

import { useMemo, useState } from 'react';
import { usePainel } from '@/estado/painel';
import { BarraDivergente } from '@/graficos/BarraDivergente';
import { BarraDivergentePorItem } from '@/graficos/BarraDivergentePorItem';
import { BarrasEmpilhadas, Legenda } from '@/graficos/BarrasEmpilhadas';
import { LinhaEmpilhada } from '@/graficos/LinhaEmpilhada';
import { MapaUf } from '@/graficos/MapaUf';
import { Ranking } from '@/graficos/Ranking';
import { Rosca } from '@/graficos/Rosca';
import { Botao, Carregando, Chip, FaixaDeErro, Kpi, KpiHero, Modal, Secao, Vazio } from '@/componentes/basicos';
import {
  campoDeAreaPorCategoria,
  campoDeCategoriaPublico,
  campoDeFormatoInteracao,
} from '@/componentes/PainelDeFiltros';
import { CampoSuspenso, SetaSuspensa } from '@/componentes/CampoSuspenso';
import { FiltroDePeriodoArrastavel } from '@/componentes/FiltroDePeriodoArrastavel';
import { SinteseExecutivaPelaIA } from '@/paginas/painel/SinteseExecutivaPelaIA';
import { TabelaDeInteracoes } from '@/paginas/painel/TabelaDeInteracoes';
import { numero, percentual, rotuloDaSemana, rotuloDoMes, rotuloDoSemestre } from '@/dominio/formato';
import {
  CORES_DE_FRENTE,
  ROTULOS_DE_FRENTE,
  rotuloDeAbrangencia,
} from '@/dominio/frentes';
import {
  alternar,
  alternarCategoriaPublico,
  alternarTag,
  limparAreas,
  limparCategoriaPublico,
  limparFormatoInteracao,
} from '@/dominio/recorte';
import { FRENTES } from '@/dominio/tipos';
import type { Frente, Interacao } from '@/dominio/tipos';
import {
  CATEGORIAS_DE_AREA,
  categoriasPublicoMaisRecorrentes,
  chaveDoPeriodo,
  climaPorTema,
  completarPeriodos,
  distribuicaoPorUf,
  idsPorCategoriaDeArea,
  kpis as calcularKpis,
  nomeDaInstituicao,
  nomesDosTemas,
  porTier,
  ranking,
  rankingDePortaVozes,
  resumoDeClimaPorFrente,
  rotuloDeCodigo,
  scorePorCategoriaPublico,
  scorePorInstituicao,
  scorePorTema,
  serieMensal,
  temasMaisRecorrentes,
  temasPorPortaVoz,
  topInstituicoesPorTier,
} from '@/dominio/derivacoes';
import type { Catalogo, Granularidade } from '@/dominio/derivacoes';

//: A MESMA PALETA usada em `temasMaisRecorrentes` — reaproveitada aqui para
//: colorir as categorias do popup de histórico de tier/público, que não têm
//: cor própria (Ranking e a barra divergente por item não precisam de uma
//: cor por categoria, só o gráfico empilhado no tempo precisa). O histórico
//: de ÁREA não usa esta paleta — reaproveita a cor fixa de
//: `CATEGORIAS_DE_AREA`, a mesma da rosca ao lado.
//:
//: DEZ CORES, e não seis: `categoriasDePublico` colore por posição
//: (`indice % PALETA_DO_HISTORICO.length`) as 10 categorias da taxonomia de
//: públicos, e com seis cores a sétima categoria (índice 6) repetia a cor da
//: primeira — Imprensa e Formadores de Opinião saía idêntica a Poder
//: Executivo na "Volumetria total por Público", e a legenda era o único jeito
//: de distinguir duas fatias do mesmo tom. Dez cobre a taxonomia inteira sem
//: repetir nenhuma.
//:
//: TODAS AS DEZ SAEM DA PALETA OFICIAL DA AEGEA (principal + neutra +
//: secundária) — nenhuma inventada. As quatro últimas são Cinza 4, Cinza 2,
//: Marrom Claro Cacau e Vermelho Pitanga, na ordem do guia de marca.
const PALETA_DO_HISTORICO = [
  '#0027BD', // Azul Mar
  '#17E3CB', // Turquesa Rio
  '#A11FFF', // Roxo Açaí
  '#FE952B', // Laranja-da-Baía
  '#E12379', // Magenta Pitaia
  '#F8DC00', // Amarelo Pequi
  '#191B23', // Cinza 4
  '#8C91A4', // Cinza 2
  '#AD6547', // Marrom Claro Cacau
  '#FF5C60', // Vermelho Pitanga
];

/** Um pequeno botão-âncora, sempre no canto do card, para abrir o histórico
 *  sem disputar clique com as fatias/barras de dentro dele — a área
 *  clicável do gráfico filtra o recorte; este botão é o único jeito de abrir
 *  o avanço no tempo. */
function BotaoDeHistorico({ aoClicar }: { aoClicar: () => void }) {
  return (
    <Botao
      variante="fantasma"
      aoClicar={aoClicar}
      estilo={{ border: '1px solid var(--borda-input)', whiteSpace: 'nowrap' }}
    >
      Ver histórico
    </Botao>
  );
}

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

  //: MESMA IDEIA DE `temasExtras`, para o Termômetro por público — "mostre
  //: também esta categoria" no gráfico, não um filtro do recorte.
  const [categoriaPublicoExtras, definirCategoriaPublicoExtras] = useState<string[]>([]);

  //: A faixa fixa de filtros abre fechada — só "Filtros:" e os três
  //: gatilhos, sem a trilha de período ocupando altura de cara.
  const [periodoAberto, definirPeriodoAberto] = useState(false);

  //: TAMBÉM SÓ DA TELA, não do Recorte — é "como eu quero ENXERGAR a série no
  //: tempo", não um filtro sobre quais interações entram na conta. Os três
  //: gráficos de série temporal compartilham a mesma escolha: lê-los em
  //: granularidades diferentes ao mesmo tempo confundiria mais do que ajudaria.
  const [granularidade, definirGranularidade] = useState<Granularidade>('mes');

  //: QUAL DOS TRÊS CARDS DO BLOCO 1 tem o popup de histórico aberto. Um só
  //: por vez, como o tema expandido de `BarraDivergente` — dois popups juntos
  //: disputariam a mesma atenção.
  const [historico, definirHistorico] = useState<'tier' | 'tema' | 'publico' | null>(null);

  const derivado = useMemo(() => {
    if (!catalogo) return null;

    //: Resolvido uma vez aqui, reaproveitado nas 3 tabelas fixas de área
    //: (abaixo) e no clique/destaque da rosca de área (na renderização).
    const idsPorRotulo = idsPorCategoriaDeArea(catalogo);

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

    //: MESMA IDEIA DE `categoriasDeFrente`, para "Volumetria total por
    //: Público" — TODAS as categorias da taxonomia (`catalogo.dicionarios.
    //: categorias_publico`), não só o Top 5 de `categoriasPublicoMaisRecorrentes`
    //: (aquele corta em 5 de propósito, para o ranking; aqui a pilha
    //: empilhada quer o total inteiro, categoria nenhuma escondida). Sem cor
    //: própria no dicionário (diferente de frente/clima) — reaproveita
    //: `PALETA_DO_HISTORICO`, por posição.
    const categoriaPublicoDoId = new Map(
      [...catalogo.instituicoes.values()].map((i) => [i.id, i.categoria_publico_id]),
    );
    const contagemCategoriasPublico = interacoes.reduce((acc, i) => {
      const categoriaId = categoriaPublicoDoId.get(i.instituicao_id);
      if (categoriaId != null) acc[categoriaId] = (acc[categoriaId] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const categoriasDePublico = catalogo.dicionarios.categorias_publico.map((categoria, indice) => {
      const tot = contagemCategoriasPublico[categoria.id] || 0;
      const pct = Math.round((tot / totalInteracoes) * 100);
      return {
        chave: String(categoria.id),
        rotulo: categoria.nome,
        cor: PALETA_DO_HISTORICO[indice % PALETA_DO_HISTORICO.length],
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
    const categoriasPublico = categoriasPublicoMaisRecorrentes(interacoes, catalogo, 5);

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
      categoriasPublico,
      categoriasDePublico,
      volumetriaPorPublico: completarPeriodos(
        serieMensal(
          interacoes,
          categoriasDePublico,
          (i) => {
            const categoriaId = categoriaPublicoDoId.get(i.instituicao_id);
            return categoriaId != null ? [String(categoriaId)] : [];
          },
          granularidade,
        ),
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
      geo,
      // NÃO TÊM CAPITAL PARA MARCAR NO MAPA — a pessoa podia estar em
      // qualquer UF, a reunião foi por chamada. Por isso o total entra à
      // parte, como uma bolha fora do contorno (ver `MapaUf`), e não some
      // do mapa como as interações "NA"/"IN" já somem hoje.
      totalInteracoesOnline: interacoes.filter((i) => i.modalidade === 'online').length,
      instituicoes: ranking(interacoes, catalogo, 'entidade'),
      esferas: ranking(interacoes, catalogo, 'esfera'),
      unidades: ranking(interacoes, catalogo, 'unidade'),
      portaVozes: rankingDePortaVozes(interacoes, catalogo),
      temasPorPortaVoz: temasPorPortaVoz(interacoes, catalogo, 3),
      porTier: porTier(interacoes, catalogo),
      climaPorTema: climaPorTema(interacoes, catalogo),
      scorePorCategoriaPublico: scorePorCategoriaPublico(interacoes, catalogo, 5, categoriaPublicoExtras),
      // UMA LISTA DE INTERAÇÕES POR CATEGORIA DE ÁREA, e não um id — a área é
      // multivalorada (`interacao.areas`), então a mesma interação pode
      // aparecer em mais de uma das três tabelas, exatamente como o filtro
      // "Área" do resto do Painel já trata OR entre áreas. Dentro de uma
      // categoria composta (RI & Oper. Financeiras) o critério também é OR:
      // basta a interação ter QUALQUER uma das áreas somadas para entrar.
      interacoesPorAreaFixa: CATEGORIAS_DE_AREA.map(({ rotulo }) => {
        const ids = idsPorRotulo.get(rotulo)!;
        return {
          nome: rotulo,
          interacoes: ids.size
            ? interacoes.filter((i) => i.areas.some((id) => ids.has(id)))
            : [],
        };
      }),
      climaPorPublico: scorePorInstituicao(interacoes, catalogo, 5),
      topInstituicoesPorTier: topInstituicoesPorTier(interacoes, catalogo, 5),
    };
  }, [interacoes, catalogo, temasExtras, categoriaPublicoExtras, granularidade]);

  if (erro) return <FaixaDeErro mensagem={erro} />;
  // `!catalogo` nunca é `true` aqui na prática — `derivado` só existe quando
  // `catalogo` existe —, mas o TypeScript não enxerga essa relação entre as
  // duas variáveis. O guarda serve só para destravar o tipo do resto da
  // função, que agora passa `catalogo` adiante para `HistoricoDoBloco`.
  if (carregando || !derivado || !catalogo) return <Carregando rotulo="Carregando o recorte…" />;
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

  //: MESMA IDEIA de `temasDisponiveis`, para "+ Ver outro público" do
  //: Termômetro por público.
  const categoriaPublicoDisponiveis = derivado.scorePorCategoriaPublico.todos.filter(
    (categoria) => !derivado.scorePorCategoriaPublico.itens.some((item) => item.chave === categoria.chave),
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

      {/* FAIXA FIXA DE FILTROS — ACIMA de "Síntese Executiva" de propósito:
          é o primeiro controle da tela, antes de qualquer número derivado
          dele. Versão COMPACTA: Área(s), Tipo de Interação
          e Tipo de Público viraram GATILHOS fechados numa linha só
          (`CampoSuspenso`), não mais três fileiras de pílulas sempre
          abertas — aquela versão crescia demais em altura e cobria a tela
          toda vez que descia junto. O painel com as pílulas de cada campo só
          existe enquanto aberto, sobrepondo o conteúdo abaixo (`position:
          absolute`) em vez de empurrá-lo.

          Período virou um segundo cabeçalho retrátil embaixo do primeiro,
          mesma ideia — fechado por padrão, abre só quando alguém quer
          arrastar. Referência: protótipo trazido pelo usuário (faixa
          turquesa "Filtros:" com três caixas + barra clara "Período").

          UM SÓ `position: sticky`, colado em `top: var(--altura-cabecalho)`
          (a altura real do `<header>` azul, medida e publicada por
          `Layout.tsx`) — desce com a página até encostar embaixo do
          cabeçalho, e daí em diante rola junto. `zIndex` abaixo do
          cabeçalho (30) para ele sempre vencer se os dois colidirem na
          borda. */}
      <div
        style={{
          position: 'sticky',
          top: 'var(--altura-cabecalho)',
          zIndex: 25,
          borderRadius: 'var(--r-card)',
          boxShadow: '0 6px 18px rgba(0,49,44,0.22)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            background: 'var(--turquesa-rio)',
            borderRadius: 'var(--r-card) var(--r-card) 0 0',
            padding: '10px 20px',
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
              color: 'var(--sobre-turquesa)',
              flexShrink: 0,
            }}
          >
            Filtros:
          </span>
          <CampoSuspenso
            campo={campoDeAreaPorCategoria(recorte, definirRecorte, catalogo)}
            aoLimpar={() => definirRecorte(limparAreas(recorte))}
          />
          {/* `formato_interacao` (Mídia/Agenda de mercado/Agenda pública/
              Manifestação formal/Evento/Visita/Reunião — `0038_formato_
              interacao.sql`), NÃO `frente`: responde "que tipo de encontro
              foi esse", pergunta ortogonal a "quem é a contraparte" —
              `frente` continua filtrável em "Filtros rápidos". SÓ NO
              CLIENTE, mesma lógica do Filtro Tipo de Público. */}
          <CampoSuspenso
            campo={campoDeFormatoInteracao(recorte, definirRecorte, catalogo)}
            aoLimpar={() => definirRecorte(limparFormatoInteracao(recorte))}
          />
          {/* SÓ NO CLIENTE (ver `Recorte.categoriaPublico`): filtra sobre o
              que já chegou da API, juntando pelo catálogo. */}
          <CampoSuspenso
            campo={campoDeCategoriaPublico(recorte, definirRecorte, catalogo)}
            aoLimpar={() => definirRecorte(limparCategoriaPublico(recorte))}
          />
        </div>

        {/* PERÍODO — retrátil, mesma lógica de "Filtros rápidos"
            (`PainelDeFiltros.tsx`): fechado por padrão, nasce sem ocupar
            espaço. Complementa os atalhos de "Filtros rápidos" (30/60/90...)
            para quem quer ajustar no olho — ver `FiltroDePeriodoArrastavel`. */}
        <button
          type="button"
          onClick={() => definirPeriodoAberto((v) => !v)}
          aria-expanded={periodoAberto}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '9px 20px',
            background: 'var(--bg-trilho)',
            border: 'none',
            borderRadius: periodoAberto ? 0 : '0 0 var(--r-card) var(--r-card)',
            cursor: 'pointer',
            fontSize: 12.5,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--cinza-3)',
          }}
        >
          <span>Período</span>
          <SetaSuspensa aberto={periodoAberto} />
        </button>
        {periodoAberto ? (
          <div
            style={{
              background: 'var(--branco)',
              border: '1px solid var(--borda)',
              borderTop: 'none',
              borderRadius: '0 0 var(--r-card) var(--r-card)',
              padding: '12px 20px 16px',
            }}
          >
            <FiltroDePeriodoArrastavel recorte={recorte} definirRecorte={definirRecorte} />
          </div>
        ) : null}
      </div>

      {/* O TÍTULO SAIU DE DENTRO DO BANNER — antes era um rótulo pequeno no
          canto esquerdo dele; agora é o título da seção inteira, centralizado
          e fora de qualquer cartão, no mesmo degradê azul-mar → turquesa-rio
          do título da caixa de IA (ver `SinteseExecutivaPelaIA`). */}
      <h2
        style={{
          textAlign: 'center',
          fontSize: 34,
          fontWeight: 800,
          margin: 0,
          backgroundImage: 'linear-gradient(120deg, var(--azul-mar) 0%, var(--turquesa-rio) 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Síntese Executiva
      </h2>

      {/* BANNER DE SÍNTESE EXECUTIVA — Fatos relevantes do recorte em destaque */}
      <ResumoExecutivoDoRecorte
        total={derivado.resumoExecutivo.total}
        frentePrincipal={derivado.resumoExecutivo.frentePrincipal}
        climaPrincipal={derivado.resumoExecutivo.climaPrincipal}
        topUf={derivado.resumoExecutivo.topUf}
      />

      {/* SÍNTESE EXECUTIVA PELA IA — ver o comentário no topo do arquivo do
          componente: hoje é o front montando o texto com dados reais, sem
          agente nenhum por trás; a caixa (abrir/fechar, feedback) é o que já
          vale fixar agora. */}
      <SinteseExecutivaPelaIA interacoes={interacoes} catalogo={catalogo} />

      {/* 2. TERMÔMETRO POR PÚBLICO — mesmo layout da "Barra divergente por
          tema" mais abaixo (mesmo componente `BarraDivergente`, mesmo botão
          "+ Ver outro público…"): os `quantos` públicos com mais volume
          entram primeiro, e o botão acrescenta mais um sem tirar do topo —
          ver `scorePorCategoriaPublico`. Era "Termômetro por área"
          (`scorePorArea`, removida): esta é a categoria nova da
          classificação de instituições, não mais as 5 áreas internas fixas. */}
      <Secao titulo="Termômetro por público" estilo={{ borderTop: '3px solid var(--azul-mar)' }}>
        <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ fontSize: 12, color: 'var(--cinza-3)', margin: 0 }}>
            {derivado.scorePorCategoriaPublico.totalDeCategorias >
            derivado.scorePorCategoriaPublico.itens.length
              ? `Os ${derivado.scorePorCategoriaPublico.itens.length} públicos com mais interações, de ${derivado.scorePorCategoriaPublico.totalDeCategorias} com clima registrado neste recorte — do pior para o melhor.`
              : `Os ${derivado.scorePorCategoriaPublico.itens.length} públicos com clima registrado neste recorte — do pior para o melhor.`}
          </p>
          <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: 0 }}>
            O número é o placar de clima do público: (proativas − reativas) ÷ total de interações
            × 100. Vai de −100 (só reativas) a +100 (só proativas); 0 é equilíbrio ou maioria
            neutra.
          </p>
        </div>

        {categoriaPublicoExtras.length || categoriaPublicoDisponiveis.length ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 6,
              marginBottom: 16,
            }}
          >
            {categoriaPublicoExtras.map((chave) => {
              const categoria = derivado.scorePorCategoriaPublico.todos.find((c) => c.chave === chave);
              return (
                <Chip
                  key={chave}
                  rotulo={categoria?.rotulo ?? chave}
                  ativo
                  fundo="var(--azul-mar)"
                  texto="var(--branco)"
                  titulo={`Tirar ${categoria?.rotulo ?? chave} do gráfico`}
                  aoClicar={() =>
                    definirCategoriaPublicoExtras(categoriaPublicoExtras.filter((c) => c !== chave))
                  }
                />
              );
            })}
            {categoriaPublicoDisponiveis.length ? (
              <select
                value=""
                onChange={(evento) => {
                  if (evento.target.value) {
                    definirCategoriaPublicoExtras([...categoriaPublicoExtras, evento.target.value]);
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
                <option value="">+ Ver outro público…</option>
                {categoriaPublicoDisponiveis.map((categoria) => (
                  <option key={categoria.chave} value={categoria.chave}>
                    {categoria.rotulo} ({categoria.total})
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        ) : null}

        <BarraDivergente
          itens={derivado.scorePorCategoriaPublico.itens}
          aoAbrirAgenda={aoAbrirAgenda}
          vazio="Nenhum público com clima registrado neste recorte."
        />
      </Secao>

      {/* 3. INTERAÇÕES MAIS RECENTES, POR ÁREA — três tabelas fixas lado a
          lado, uma por categoria de área (ver `CATEGORIAS_DE_AREA` em
          `dominio/derivacoes.ts`). MESMO CARTÃO de "Interações mais
          recentes" (`TabelaDeInteracoes`), só com menos colunas: a área já
          está dita no título, então Área(s) sairia repetindo o óbvio, e
          Stakeholder/Relevância saem para as três caberem lado a lado sem
          rolagem horizontal. */}
      <div className="grade grade--3" style={{ gap: 16 }}>
        {derivado.interacoesPorAreaFixa.map(({ nome, interacoes: interacoesDaArea }) => (
          <TabelaDeInteracoes
            key={nome}
            titulo={nome}
            interacoes={interacoesDaArea}
            catalogo={catalogo}
            aoAbrirFicha={aoAbrirAgenda}
            colunas="reduzidas"
          />
        ))}
      </div>

      {/* 4. BLOCO 1 — com quem estamos falando e como está a relação.
          Um clique por dentro (a fatia/barra filtra o recorte) e um clique
          por fora (o botão "Ver histórico" abre o avanço no tempo) — os dois
          convivem porque nunca disputam a mesma área.

          TIER E CLIMA POR INSTITUIÇÕES EM CIMA, lado a lado — são os dois
          cartões mais "densos" (rosca+ranking / barra divergente); TEMAS
          EMBAIXO, sozinho e esticado — a rosca de temas por si só não
          preenche uma coluna de grade--3 tão bem quanto um cartão largo, e
          "% de Interações por Temas" ganha mais espaço para o ranking ao
          lado dela respirar. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="grade grade--2" style={{ gap: 16 }}>
          <Secao
            titulo="% Interações por tier e Top instituições"
            subtitulo="Volume de agendas pela relevância da instituição de contato"
            acao={<BotaoDeHistorico aoClicar={() => definirHistorico('tier')} />}
          >
            {/* A ROSCA AO LADO DO TOP 5, e não sozinha no meio do cartão: a
                coluna de fatias+legenda não usa toda a largura do cartão, e o
                top 5 de instituições preenche esse vão em vez de deixá-lo em
                branco. MESMA IDEIA de "Distribuição geográfica" (mapa + ranking
                lado a lado) logo abaixo.

                É O MESMO RECORTE que filtra a rosca que também filtra este
                ranking: clicar numa fatia de tier estreita `interacoes` para
                aquele tier, e o top 5 abaixo passa a listar as instituições
                DENTRO dele, sem precisar de uma segunda consulta. */}
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 auto' }}>
                <Rosca
                  itens={derivado.porTier}
                  ativo={recorte.tier != null ? String(recorte.tier) : undefined}
                  aoClicar={(chave) => definirRecorte(alternar(recorte, 'tier', Number(chave)))}
                  rotuloCentral="interações"
                  detalheAoPassarMouse={(chave) =>
                    (derivado.topInstituicoesPorTier[chave] ?? []).map((item) => ({
                      rotulo: item.rotulo,
                      valor: numero(item.total),
                    }))
                  }
                />
              </div>
              <div style={{ flex: '1 1 180px', minWidth: 160 }}>
                <div className="kicker" style={{ marginBottom: 12 }}>
                  Top 5 instituições
                </div>
                <Ranking
                  itens={derivado.instituicoes.slice(0, 5)}
                  ativo={recorte.entidade}
                  aoClicar={(nome) => definirRecorte(alternar(recorte, 'entidade', nome))}
                  vazio="Nenhuma instituição neste recorte."
                />
              </div>
            </div>
          </Secao>

          <Secao
            titulo="Clima por Instituições"
            subtitulo="Placar de clima das instituições mais presentes no recorte"
            acao={<BotaoDeHistorico aoClicar={() => definirHistorico('publico')} />}
          >
            <BarraDivergentePorItem
              itens={derivado.climaPorPublico}
              ativo={recorte.entidade}
              aoClicar={(chave) => definirRecorte(alternar(recorte, 'entidade', chave))}
            />
            <p style={{ fontSize: 11, color: 'var(--cinza-2)', marginTop: 10 }}>
              [Proativas − Reativas] ÷ Total × 100 — de −100 (só reativas) a +100 (só
              proativas), 0 é equilíbrio ou maioria neutra.
            </p>
          </Secao>
        </div>

        <Secao
          titulo="% de Interações por Temas"
          subtitulo="Distribuição das interações pelos temas mais discutidos no recorte"
          acao={<BotaoDeHistorico aoClicar={() => definirHistorico('tema')} />}
        >
          {/* MESMO LAYOUT de "Interações por tier" acima, agora com a rosca
              MAIOR (220px, era 168 — o padrão de `Rosca` continua 168 nos
              outros usos, só este pede mais espaço) e TRÊS colunas em vez de
              duas: a rosca (com sua própria legenda, colorida por posição no
              ranking — mesma paleta de `temasMaisRecorrentes`), o top 5 dos
              mesmos temas ao lado, e o top 5 de categorias de público
              (`categoriasPublicoMaisRecorrentes`, mesma métrica de volume —
              não o score de clima do Termômetro por Público, que é outro
              cálculo). Era a rosca de "Interações por áreas" (`porArea`/
              `climaPorArea`, removidas): esta reaproveita `derivado.temas`,
              a MESMA base do ranking ao lado e de "Temas no tempo" mais
              abaixo — um tema em destaque aqui é o mesmo tema em destaque
              lá. */}
          <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: '0 0 auto' }}>
              <Rosca
                itens={derivado.temas}
                ativo={recorte.tags?.[0]}
                aoClicar={(chave) => definirRecorte(alternarTag(recorte, chave))}
                rotuloCentral="interações"
                vazio="Nenhum tema registrado neste recorte."
                tamanho={220}
                espessura={30}
                detalheAoPassarMouse={(chave) => {
                  const clima = derivado.climaPorTema[chave] ?? { propositivo: 0, neutro: 0, tenso: 0 };
                  return [
                    { rotulo: rotuloDeCodigo(catalogo, 'climas', 'propositivo'), valor: numero(clima.propositivo) },
                    { rotulo: rotuloDeCodigo(catalogo, 'climas', 'neutro'), valor: numero(clima.neutro) },
                    { rotulo: rotuloDeCodigo(catalogo, 'climas', 'tenso'), valor: numero(clima.tenso) },
                  ];
                }}
              />
            </div>
            <div style={{ flex: '1 1 180px', minWidth: 160 }}>
              <div className="kicker" style={{ marginBottom: 12 }}>
                Top 5 temas
              </div>
              <Ranking
                itens={derivado.temas}
                ativo={recorte.tags?.[0]}
                aoClicar={(chave) => definirRecorte(alternarTag(recorte, chave))}
                vazio="Nenhum tema neste recorte."
              />
            </div>
            <div style={{ flex: '1 1 180px', minWidth: 160 }}>
              <div className="kicker" style={{ marginBottom: 12 }}>
                Top 5 público
              </div>
              <Ranking
                itens={derivado.categoriasPublico}
                ativo={
                  recorte.categoriaPublico?.[0] != null ? String(recorte.categoriaPublico[0]) : undefined
                }
                aoClicar={(chave) => definirRecorte(alternarCategoriaPublico(recorte, Number(chave)))}
                vazio="Nenhuma categoria de público neste recorte."
              />
            </div>
          </div>
        </Secao>
      </div>

      {/* 5. INTERAÇÕES MAIS RECENTES — reaproveita o mesmo cartão de cima,
          agora sem filtro de área nenhum: todo o recorte, colunas completas. */}
      <TabelaDeInteracoes interacoes={interacoes} catalogo={catalogo} aoAbrirFicha={aoAbrirAgenda} />

      {/* BLOCO: SÉRIES TEMPORAIS — volumetria, clima e temas compartilham o
          mesmo seletor de granularidade e respondem juntos "o que aconteceu
          no tempo". Gap interno menor (12px) mostra que são do mesmo grupo. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="kicker" style={{ color: 'var(--cinza-2)', paddingLeft: 2 }}>
          Séries temporais
        </div>

        <Secao
          titulo="Volumetria total por Público"
          subtitulo="Distribuição temporal das agendas acumuladas pelas categorias da taxonomia de público"
          acao={
            <SeletorDeGranularidade
              valor={granularidade}
              aoEscolher={definirGranularidade}
            />
          }
        >
          <BarrasEmpilhadas
            colunas={derivado.volumetriaPorPublico}
            altura={220}
            formatarRotulo={FORMATADORES_DE_ROTULO[granularidade]}
            aoClicarSegmento={(chave) =>
              definirRecorte(alternarCategoriaPublico(recorte, Number(chave)))
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
            itens={derivado.categoriasDePublico}
            ativo={
              recorte.categoriaPublico?.[0] != null ? String(recorte.categoriaPublico[0]) : undefined
            }
            aoClicar={(chave) => definirRecorte(alternarCategoriaPublico(recorte, Number(chave)))}
          />
        </Secao>

        <Secao
          titulo="Clima das interações no tempo"
          subtitulo="Evolução da classificação de clima (Propositivo, Neutro e Tenso) no período"
        >
          <LinhaEmpilhada
            colunas={derivado.clima}
            altura={140}
            formatarRotulo={FORMATADORES_DE_ROTULO[granularidade]}
            // Reativo sempre na base da área — os códigos de clima não mudam
            // (só o nome exibido), então esta ordem não se perde num rename.
            ordem={['tenso', 'neutro', 'propositivo']}
          />
          <Legenda
            itens={derivado.categoriasDeClima}
            ativo={recorte.clima}
            aoClicar={(chave) => definirRecorte(alternar(recorte, 'clima', chave))}
            centralizada
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
            centralizada
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
          titulo="Distribuição geográfica das Interações e Porta-vozes"
          subtitulo="Concentração de presença física e impacto institucional por Estado (UF)"
        >
          <div className="grade grade--mapa" style={{ gap: 24 }}>
            <MapaUf
              pontos={derivado.geo}
              selecionada={recorte.uf}
              aoClicarUf={(uf) => definirRecorte(alternar(recorte, 'uf', uf))}
              totalOnline={derivado.totalInteracoesOnline}
            />
            <div>
              {/* PORTA-VOZ, e não UF, ao lado do mapa: a UF já está inteira
                  no mapa (bolha por estado + a de Online); o vão ao lado
                  responde outra pergunta — QUEM mais falou, e sobre o quê.
                  Mesma ideia de "Interações por tier" (rosca + Top 5 ao
                  lado): duas dimensões diferentes, um cartão só. */}
              <div className="kicker" style={{ marginBottom: 12 }}>
                Ranking por porta-voz
              </div>
              <Ranking
                itens={derivado.portaVozes}
                ativo={recorte.portaVoz}
                aoClicar={(nome) => definirRecorte(alternar(recorte, 'portaVoz', nome))}
                vazio="Nenhum porta-voz registrado neste recorte."
                detalheAoPassarMouse={(chave) =>
                  (derivado.temasPorPortaVoz[chave] ?? []).map((item) => ({
                    rotulo: item.rotulo,
                    valor: numero(item.total),
                  }))
                }
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

      {historico ? (
        <HistoricoDoBloco
          chave={historico}
          interacoes={interacoes}
          catalogo={catalogo}
          porTier={derivado.porTier}
          porTemas={derivado.temas}
          climaPorPublico={derivado.climaPorPublico}
          aoFechar={() => definirHistorico(null)}
        />
      ) : null}
    </div>
  );
}

/** O TÍTULO E AS CATEGORIAS DE CADA POPUP, uma função por chave — o card em
 *  si (Rosca/Ranking/BarraDivergentePorItem) já resume o recorte inteiro; o
 *  popup soma essa MESMA base ao longo do tempo, mês a mês, com a mesma
 *  pilha empilhada que "Volumetria por frente" já usa. Tier e tema
 *  reaproveitam a cor que `porTier`/`temasMaisRecorrentes` já calcularam;
 *  público ganha uma cor própria aqui, só para este gráfico — o outro
 *  (BarraDivergentePorItem) não precisa de uma cor por item. */
function HistoricoDoBloco({
  chave,
  interacoes,
  catalogo,
  porTier: itensDeTier,
  porTemas,
  climaPorPublico,
  aoFechar,
}: {
  chave: 'tier' | 'tema' | 'publico';
  interacoes: Interacao[];
  catalogo: Catalogo;
  porTier: ReturnType<typeof porTier>;
  /** Os mesmos temas da rosca "% de Interações por Temas" e do ranking ao
   *  lado dela (`derivado.temas`) — um tema em destaque num é o mesmo no
   *  outro. */
  porTemas: ReturnType<typeof temasMaisRecorrentes>;
  climaPorPublico: ReturnType<typeof scorePorInstituicao>;
  aoFechar: () => void;
}) {
  const [granularidade, definirGranularidade] = useState<Granularidade>('mes');

  const { titulo, categorias, categoriasDe } = useMemo(() => {
    if (chave === 'tier') {
      return {
        titulo: 'Interações por tier ao longo do tempo',
        // `cor` sempre vem preenchida de `porTier`, mas o tipo de
        // `ItemContado` a declara opcional (serve a rankings sem cor por
        // item) — o mapeamento reafirma o tipo para bater com as outras
        // duas chaves, que já nascem com `cor: string`.
        categorias: itensDeTier.map((item) => ({
          chave: item.chave,
          rotulo: item.rotulo,
          cor: item.cor ?? 'var(--azul-mar)',
        })),
        categoriasDe: (i: Interacao) => (i.tier != null ? [String(i.tier)] : []),
      };
    }
    if (chave === 'tema') {
      // MESMO CRITÉRIO de "Temas no tempo" (mais abaixo): uma interação com
      // três temas conta nos três, e só os temas do top 5 entram na pilha —
      // os demais ficariam ilegíveis num gráfico de 5 categorias.
      return {
        titulo: 'Interações por temas ao longo do tempo',
        categorias: porTemas,
        categoriasDe: (i: Interacao) =>
          nomesDosTemas(catalogo, i.temas).filter((nome) => porTemas.some((tema) => tema.chave === nome)),
      };
    }
    const categoriasDePublico = climaPorPublico.map((item, indice) => ({
      chave: item.chave,
      rotulo: item.rotulo,
      cor: PALETA_DO_HISTORICO[indice % PALETA_DO_HISTORICO.length],
    }));
    return {
      titulo: 'Volume por instituição ao longo do tempo',
      categorias: categoriasDePublico,
      categoriasDe: (i: Interacao) => {
        const nome = nomeDaInstituicao(catalogo, i.instituicao_id);
        return categoriasDePublico.some((c) => c.chave === nome) ? [nome] : [];
      },
    };
  }, [chave, itensDeTier, porTemas, climaPorPublico, catalogo]);

  const colunas = useMemo(
    () => completarPeriodos(serieMensal(interacoes, categorias, categoriasDe, granularidade), granularidade),
    [interacoes, categorias, categoriasDe, granularidade],
  );

  return (
    <Modal
      titulo={titulo}
      subtitulo="Consolidado no tempo, com o recorte atual"
      aoFechar={aoFechar}
      largura={860}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <SeletorDeGranularidade valor={granularidade} aoEscolher={definirGranularidade} />
      </div>
      {/* O TOOLTIP DE `BarrasEmpilhadas` DESENHA PARA CIMA da coluna
          (`position: absolute; bottom: 100%`), sem limite de altura próprio —
          e o corpo do Modal tem rolagem interna (`.rolagem-interna`,
          `overflow: auto`). Sem espaço reservado aqui, uma coluna alta (perto
          do topo do gráfico) não tem para onde o tooltip crescer, e o texto
          sai cortado pela borda da rolagem. 140px cobre o tooltip mais alto
          possível nesta tela — cabeçalho + até 5 linhas de segmento, sem
          bloco de detalhe (esta chamada não passa `detalheDoMes`). Consertar
          dentro de `BarrasEmpilhadas.tsx` mudaria todos os outros usos dele
          (`RaioXDaExcecao`, o Painel fora do popup), que não têm este
          problema — por isso o espaço é reservado só aqui.

          ATENÇÃO: com `detalheDoSegmento` abaixo, o tooltip de "tier" agora
          pode listar o top de instituições de cada fatia — potencialmente
          mais alto que os 140px acima cobrem. Reconferir visualmente depois
          deste merge. */}
      <div style={{ paddingTop: 140 }}>
        <BarrasEmpilhadas
          colunas={colunas}
          altura={220}
          formatarRotulo={FORMATADORES_DE_ROTULO[granularidade]}
          detalheDoSegmento={
            chave === 'tier'
              ? (coluna, chaveDoTier) => {
                  const doPeriodo = interacoes.filter(
                    (i) => chaveDoPeriodo(i.data_interacao, granularidade) === coluna.mes,
                  );
                  return (topInstituicoesPorTier(doPeriodo, catalogo, 5)[chaveDoTier] ?? []).map(
                    (item) => ({
                      rotulo: item.rotulo,
                      valor: numero(item.total),
                    }),
                  );
                }
              : undefined
          }
        />
      </div>
      <Legenda itens={categorias} centralizada />
    </Modal>
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
        // OS QUATRO ITENS DISTRIBUÍDOS pelo espaço inteiro da caixa, e não
        // um cluster à esquerda e três à direita: sem o rótulo "Síntese
        // Executiva" (virou o título grande, fora daqui), o total sozinho à
        // esquerda ficava desequilibrado contra os três do outro lado.
        justifyContent: 'space-evenly',
        gap: 16,
        padding: '14px 18px',
        background: 'var(--branco)',
        border: '1px solid var(--borda)',
        borderRadius: 'var(--r-card)',
        fontSize: 14.5,
        color: 'var(--cinza-3)',
      }}
    >
      <div>
        <span style={{ color: 'var(--cinza-2)' }}>Total de interações: </span>
        <strong className="tabular" style={{ color: 'var(--cinza-4)' }}>{total}</strong>{' '}
        <span style={{ color: 'var(--cinza-2)' }}>interações no filtro</span>
      </div>

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
  );
}
