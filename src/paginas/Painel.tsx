/** Painel — a visão consolidada do recorte. */

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { usePainel } from '@/estado/painel';
import { BarraDivergente } from '@/graficos/BarraDivergente';
import { BarraDivergentePorItem } from '@/graficos/BarraDivergentePorItem';
import { BarrasEmpilhadas, Legenda } from '@/graficos/BarrasEmpilhadas';
import { GraficoDeArvore } from '@/graficos/GraficoDeArvore';
import { GraficoDeLinha } from '@/graficos/GraficoDeLinha';
import { MapaUf } from '@/graficos/MapaUf';
import { Ranking } from '@/graficos/Ranking';
import { Rosca } from '@/graficos/Rosca';
import { Botao, Carregando, Chip, FaixaDeAtencao, FaixaDeErro, Kpi, KpiHero, Modal, Secao, Vazio } from '@/componentes/basicos';
import {
  campoDeAreaPorCategoria,
  campoDeCategoriaPublico,
  campoDeFormatoInteracao,
  campoDeTema,
} from '@/componentes/PainelDeFiltros';
import { CampoSuspenso, SetaSuspensa } from '@/componentes/CampoSuspenso';
import { FaixaDeFiltros } from '@/componentes/FaixaDeFiltros';
import { FiltroDePeriodoArrastavel } from '@/componentes/FiltroDePeriodoArrastavel';
import { SinteseExecutivaPelaIA } from '@/paginas/painel/SinteseExecutivaPelaIA';
import { TabelaDeInteracoes } from '@/paginas/painel/TabelaDeInteracoes';
import {
  dataCurta,
  numero,
  paraIso,
  percentual,
  rotuloDaSemana,
  rotuloDoMes,
  rotuloDoSemestre,
} from '@/dominio/formato';
import {
  CORES_DE_FRENTE,
  ROTULOS_DE_FRENTE,
} from '@/dominio/frentes';
import {
  alternar,
  alternarCategoriaPublico,
  alternarTag,
  intervalo,
  limparAreas,
  limparCategoriaPublico,
  limparFormatoInteracao,
  limparTags,
} from '@/dominio/recorte';
import type { Interacao } from '@/dominio/tipos';
import {
  categoriasDeArea,
  comReativoNaBase,
  categoriasPublicoMaisRecorrentes,
  chaveDoPeriodo,
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
//: secundária) — nenhuma inventada.
//:
//: ÍNDICE 6 (Imprensa e Formadores de Opinião) NÃO É MAIS CINZA 4: o popup
//: de detalhe do mês (`DetalheDoMes`, mais abaixo) usa `var(--cinza-4)` como
//: FUNDO — com Cinza 4 também na paleta, o quadradinho da legenda dessa
//: categoria ficava cor-sobre-cor, invisível dentro do próprio popup que
//: deveria mostrá-lo.
//:
//: VERMELHO PITANGA E ROSA GOIABA TROCARAM DE LUGAR (índices 6 e 9) na
//: revisão seguinte, a pedido — mesmas dez cores, só a categoria que cada
//: uma veste mudou.
const PALETA_DO_HISTORICO = [
  '#0027BD', // Azul Mar
  '#17E3CB', // Turquesa Rio
  '#A11FFF', // Roxo Açaí
  '#FE952B', // Laranja-da-Baía
  '#E12379', // Magenta Pitaia
  '#F8DC00', // Amarelo Pequi
  '#FF5C60', // Vermelho Pitanga
  '#8C91A4', // Cinza 2
  '#AD6547', // Marrom Claro Cacau
  '#FF8FE1', // Rosa Goiaba
];

//: TRÊS TONS DE AZUL para o `GraficoDeArvore` de "% de Interações por
//: Temas" colorir cada célula pela classificação (`Tema.nivel`, ver
//: `dominio/tipos.ts`) — sem agrupar as células por nível, só pintar. Do
//: mais restrito (Sensível) ao mais aberto (Geral), o tom vai do mais
//: escuro (mais atenção) ao mais claro — os três dentro da mesma família de
//: matiz de `--azul-mar` (#0027BD), não uma cor nova por classe.
const NIVEIS_DE_TEMA: { nivel: string; cor: string; rotulo: string }[] = [
  { nivel: 'sensivel', cor: '#0027BD', rotulo: 'Sensível' }, // Azul Mar
  { nivel: 'estrategico', cor: '#667EDA', rotulo: 'Estratégico' }, // Azul médio
  { nivel: 'gerais', cor: '#CBD4F6', rotulo: 'Geral' }, // Azul claro
];

//: "TOP 5 TEMAS" E "TOP 5 PÚBLICO" ficam lado a lado em "% de Interações por
//: Temas", e os dois vinham de `PALETA_DO_PAINEL` (a mesma paleta
//: multicolor) — a cor do 1º tema saía igual à do 1º público, confundindo
//: qual ranking era qual. Por pedido: cada ranking ganha a PRÓPRIA escala,
//: do mais escuro (1º colocado) ao mais claro (5º) — temas em azul (mesma
//: família de `--azul-mar`), público em verde-água (mesma família de
//: `--turquesa-rio`). Só pinta estes dois rankings — o resto que usa
//: `derivado.temas`/`.categoriasPublico` (a Legenda de "Temas no tempo", por
//: exemplo) continua com a paleta original, sem mudar.
const ESCALA_AZUL_TOP5 = ['#0027BD', '#3352CB', '#667EDA', '#98A9E9', '#CBD4F6'];
const ESCALA_VERDE_TOP5 = ['#095D53', '#2E8178', '#53A69D', '#78CAC2', '#9DEEE7'];

function comEscalaDeCor<T extends { cor?: string }>(itens: T[], escala: string[]): T[] {
  return itens.map((item, indice) => ({ ...item, cor: escala[indice % escala.length] }));
}

//: CADA PÚBLICO ADICIONADO ao "Net Sentiment Score no tempo" ganha uma cor
//: própria, nesta ordem — todas escuras/saturadas o bastante para o texto
//: branco do chip (`Chip` com `texto="var(--branco)"`, mesmo padrão de
//: `temasExtras`/`categoriaPublicoExtras`) continuar legível. Sem
//: `--turquesa-rio` nem `--amarelo-pequi` de propósito: as duas são claras
//: demais para texto branco em cima. Sem `--azul-mar`: essa é a linha
//: "Geral", que já está sempre no gráfico.
const PALETA_DE_LINHAS_EXTRAS = ['#A11FFF', '#E12379', '#FE952B', '#AD6547', '#FF5C60'];

/** NSS por período — (propositivas − tensas) ÷ total com clima registrado ×
 *  100 —, reaproveitada tanto pela linha "Geral" (todo o recorte) quanto
 *  por cada público adicionado ao gráfico (o mesmo cálculo, só filtrando
 *  `interacoes` antes de chamar). `null` (não 0) num período sem nenhuma
 *  interação com clima registrado ali. */
function calcularNssPorPeriodo(
  interacoes: Interacao[],
  categoriasDeClima: { chave: string; rotulo: string; cor: string }[],
  granularidade: Granularidade,
): { chave: string; valor: number | null }[] {
  const porPeriodo = completarPeriodos(
    serieMensal(interacoes, categoriasDeClima, (i) => (i.clima ? [i.clima] : []), granularidade),
    granularidade,
  );
  return porPeriodo.map((coluna) => {
    const positivas = coluna.segmentos.find((s) => s.chave === 'propositivo')?.total ?? 0;
    const negativas = coluna.segmentos.find((s) => s.chave === 'tenso')?.total ?? 0;
    return {
      chave: coluna.mes,
      valor: coluna.total > 0 ? Math.round(((positivas - negativas) / coluna.total) * 100) : null,
    };
  });
}

/** Envolve um `<Secao>` de gráfico com uma faixa de 3px no topo, no mesmo
 *  degradê azul→turquesa da faixa fixa de filtros (`FaixaDeFiltros`) — por
 *  pedido, para o layout de todo gráfico do Painel carregar a identidade da
 *  marca, não só a faixa de filtros lá em cima.
 *
 *  `border` não aceita gradiente como cor, então em vez de um `borderTop`
 *  (que só pinta sólido) isto embrulha o card num `div` que RECORTA
 *  (`overflow: hidden`) no mesmo raio de canto do `Cartao` por baixo
 *  (`var(--r-card)`) e desenha a faixa como uma barra absoluta colada no
 *  topo — os cantos da barra saem arredondados porque o recorte do
 *  contêiner os corta, não porque a barra em si tem raio próprio. */
function ComFaixaDoTopo({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      {/* SEM `overflow: hidden` no contêiner — cortava o balão do "?" (Ajuda)
          toda vez que ele estourava a borda do card. O arredondado dos
          cantos da faixa agora é raio PRÓPRIO da faixa, não recorte do
          contêiner por cima dela. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          borderRadius: 'var(--r-card) var(--r-card) 0 0',
          background: 'linear-gradient(90deg, var(--azul-mar) 0%, var(--turquesa-rio) 100%)',
        }}
      />
      {children}
    </div>
  );
}

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
  aoAbrirAgenda,
}: {
  /** Abre a Ficha de uma agenda específica — usado pela lista que se abre ao
   *  clicar num tema na barra divergente. */
  aoAbrirAgenda: (id: string) => void;
}) {
  const {
    interacoes,
    recorte,
    definirRecorte,
    limparRecorte,
    catalogo,
    carregando,
    erro,
    total,
    truncado,
  } = usePainel();

  //: SÓ DESTE GRÁFICO, e não do Recorte. É "mostre também este tema", não
  //: "filtre a base por este tema" — por isso vive aqui, e não na URL: um
  //: link copiado não precisa carregar qual tema extra alguém espiou.
  const [temasExtras, definirTemasExtras] = useState<string[]>([]);

  //: MESMA IDEIA DE `temasExtras`, para o Termômetro por público — "mostre
  //: também esta categoria" no gráfico, não um filtro do recorte.
  const [categoriaPublicoExtras, definirCategoriaPublicoExtras] = useState<string[]>([]);

  //: MESMA IDEIA, para o Net Sentiment Score no tempo — cada categoria
  //: adicionada ganha a própria linha no gráfico (`PALETA_DE_LINHAS_EXTRAS`),
  //: ao lado da linha "Geral". Guarda o id da categoria como string, mesmo
  //: formato de `categoriaPublicoExtras`.
  const [nssPublicosExtras, definirNssPublicosExtras] = useState<string[]>([]);

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

    //: Resolvido uma vez aqui, reaproveitado nas 4 tabelas fixas de área
    //: (abaixo) e no clique/destaque da rosca de área (na renderização).
    const idsPorRotulo = idsPorCategoriaDeArea(catalogo);

    const totalInteracoes = interacoes.length || 1;

    //: TOTAL POR CATEGORIA DE PÚBLICO, para "Volumetria total por
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
    // O GRÁFICO DE ÁRVORE quer TODOS os temas do dicionário, não só o Top 5
    // de `temas` (que continua servindo "Top 5 temas" e "Temas no tempo",
    // sem mudar) — por pedido, para o treemap mostrar a distribuição
    // completa. `catalogo.dicionarios.temas.length` em vez de um número
    // fixo: acompanha o dicionário se um tema for cadastrado ou desativado.
    const todosOsTemas = temasMaisRecorrentes(
      interacoes,
      catalogo,
      catalogo.dicionarios.temas.length,
    );
    const categoriasPublico = categoriasPublicoMaisRecorrentes(interacoes, catalogo, 5);

    const geo = distribuicaoPorUf(interacoes);

    // Destaques para o banner analítico executivo
    const climaLider = [...categoriasDeClima].sort((a, b) => b.total - a.total)[0];
    // TIER E PÚBLICO, no lugar de "Maior volume" (UF) — por pedido: a
    // síntese volta a quatro itens, e os dois novos respondem "com quem
    // estamos falando" (relevância e público), a mesma pergunta que Frente
    // respondia antes de sair da tela. UF continua no mapa logo abaixo.
    const porTierCalculado = porTier(interacoes, catalogo);
    const tierLider = [...porTierCalculado].sort((a, b) => b.total - a.total)[0];
    const totalComTier = interacoes.filter((i) => i.tier != null).length || 1;
    const publicoLider = [...categoriasDePublico].sort((a, b) => b.total - a.total)[0];

    //: EXTRAÍDO para servir tanto `clima` (a pilha empilhada) quanto `nss`
    //: (a linha) — os dois leem a MESMA contagem de propositivo/neutro/tenso
    //: por período, só a leitura final é diferente.
    const climaPorPeriodo = completarPeriodos(
      serieMensal(interacoes, categoriasDeClima, (i) => (i.clima ? [i.clima] : []), granularidade),
      granularidade,
    );

    //: NET SENTIMENT SCORE por período — `calcularNssPorPeriodo` (mesma
    //: fórmula do "placar de clima" usado em Termômetro por
    //: público/Clima por Instituições/Barra divergente por tema, só que ao
    //: longo do tempo em vez de por item), reaproveitada aqui e por cada
    //: público extra que o gráfico adicionar (na renderização, mais abaixo).
    const nssPorPeriodo = calcularNssPorPeriodo(interacoes, categoriasDeClima, granularidade);

    //: O MESMO NSS, mas do RECORTE INTEIRO — a linha de referência que diz
    //: "aqui é a média geral", para comparar contra a oscilação período a
    //: período. `categoriasDeClima` já soma o recorte inteiro (não filtra
    //: por período), então a conta é a mesma fórmula, sem passar por
    //: `serieMensal`.
    const totalComClima = categoriasDeClima.reduce((soma, c) => soma + c.total, 0);
    const nssGeral =
      totalComClima > 0
        ? Math.round(
            (((categoriasDeClima.find((c) => c.chave === 'propositivo')?.total ?? 0) -
              (categoriasDeClima.find((c) => c.chave === 'tenso')?.total ?? 0)) /
              totalComClima) *
              100,
          )
        : 0;

    return {
      kpis: calcularKpis(interacoes, catalogo),
      resumoExecutivo: {
        total: interacoes.length,
        climaPrincipal: climaLider?.total ? { rotulo: climaLider.rotulo, pct: climaLider.pct } : undefined,
        tierPrincipal: tierLider?.total
          ? { rotulo: tierLider.rotulo, pct: Math.round((tierLider.total / totalComTier) * 100) }
          : undefined,
        publicoPrincipal: publicoLider?.total
          ? { rotulo: publicoLider.rotulo, pct: publicoLider.pct }
          : undefined,
      },
      resumoDeClima: {
        eventos: resumoDeClimaPorFrente(interacoes, ['eventos']),
        legislativo: resumoDeClimaPorFrente(interacoes, ['legislativo']),
        institucionais: resumoDeClimaPorFrente(interacoes, ['governo', 'parceiros']),
        bancosCredores: resumoDeClimaPorFrente(interacoes, ['bancos_credores']),
      },
      categoriasDeClima,
      temas,
      todosOsTemas,
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
      clima: climaPorPeriodo,
      nss: nssPorPeriodo,
      nssGeral,
      // EXPOSTO para o gráfico de NSS filtrar por categoria de público
      // extra na renderização (fora deste `useMemo`) — mesmo mapa que
      // `volumetriaPorPublico` já usa aqui dentro.
      categoriaPublicoDoId,
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
      porTier: porTierCalculado,
      scorePorCategoriaPublico: scorePorCategoriaPublico(interacoes, catalogo, 5, categoriaPublicoExtras),
      // UMA LISTA DE INTERAÇÕES POR CATEGORIA DE ÁREA, e não um id — a área é
      // multivalorada (`interacao.areas`), então a mesma interação pode
      // aparecer em mais de uma das quatro tabelas, exatamente como o filtro
      // "Área" do resto do Painel já trata OR entre áreas. Se uma categoria
      // algum dia voltar a somar mais de uma área real, o critério continua
      // OR: basta a interação ter QUALQUER uma das áreas dela para entrar.
      interacoesPorAreaFixa: categoriasDeArea(catalogo).map(({ rotulo }) => {
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
  // SEM RETORNO ANTECIPADO PARA RECORTE VAZIO, de propósito: um `return`
  // aqui trocaria a página INTEIRA por `<Vazio>` — inclusive a própria
  // faixa fixa de filtros (Áreas/Tipo de Interação/Tipo de Público +
  // Período), que é onde mora o filtro que zerou o resultado. Quem
  // filtrasse "Mídia" sem nenhuma interação com esse formato perdia o
  // único jeito de ver ou desfazer o que tinha acabado de escolher. Em vez
  // disso, os filtros sempre renderizam, e só a área de KPIs/gráficos vira
  // `<Vazio>` — mesmo padrão da Base (`Base.tsx`), que nunca esconde a
  // própria barra de filtros.
  const semResultado = !interacoes.length;

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

  //: O RESUMO AO LADO DE "Período", quando o painel está fechado — por
  //: pedido. `null` sem NENHUM filtro de período ativo (recorte inteiro,
  //: sem data/atalho nenhum): "Período" sozinho já diz isso.
  const temFiltroDePeriodo = Boolean(
    recorte.de || recorte.ate || recorte.periodoPassado || recorte.periodoFuturo,
  );
  const { de: inicioDoPeriodo, ate: fimDoPeriodo } = intervalo(recorte);
  const resumoDoPeriodo =
    temFiltroDePeriodo && inicioDoPeriodo && fimDoPeriodo
      ? `${dataCurta(paraIso(inicioDoPeriodo))} – ${dataCurta(paraIso(fimDoPeriodo))}`
      : null;

  //: "+ ADICIONAR PÚBLICO" do Net Sentiment Score no tempo — TODA a
  //: taxonomia (não só quem já tem clima registrado, diferente de
  //: `categoriaPublicoDisponiveis`): aqui a pergunta é "qual público eu
  //: quero comparar", não "quais já aparecem no ranking".
  const nssPublicosDisponiveis = catalogo.dicionarios.categorias_publico.filter(
    (categoria) => !nssPublicosExtras.includes(String(categoria.id)),
  );

  //: UMA SÉRIE POR LINHA DO GRÁFICO — "Geral" (todo o recorte, sempre
  //: presente) mais uma por público adicionado, cada uma com sua cor
  //: (`PALETA_DE_LINHAS_EXTRAS`) e filtrando `interacoes` pela categoria
  //: antes de recalcular o NSS por período (`calcularNssPorPeriodo`, a
  //: mesma função da linha Geral).
  const seriesDeNss = [
    { chave: 'Geral', cor: 'var(--azul-mar)', pontos: derivado.nss },
    ...nssPublicosExtras.map((idComoTexto, indice) => {
      const categoria = catalogo.dicionarios.categorias_publico.find(
        (c) => String(c.id) === idComoTexto,
      );
      const interacoesDoPublico = interacoes.filter(
        (i) => String(derivado.categoriaPublicoDoId.get(i.instituicao_id) ?? '') === idComoTexto,
      );
      return {
        chave: categoria?.nome ?? idComoTexto,
        cor: PALETA_DE_LINHAS_EXTRAS[indice % PALETA_DE_LINHAS_EXTRAS.length],
        pontos: calcularNssPorPeriodo(interacoesDoPublico, derivado.categoriasDeClima, granularidade),
      };
    }),
  ];

  //: NOME → NÍVEL (`Tema.nivel`, ver `dominio/tipos.ts`) — só para o
  //: `GraficoDeArvore` de "% de Interações por Temas" colorir por
  //: Sensível/Estratégico/Geral, por pedido (sem agrupar as células por
  //: nível, só a cor muda). `temasMaisRecorrentes` devolve a chave como o
  //: NOME do tema, então o lookup é por nome.
  const nivelPorNomeDoTema = new Map(catalogo.dicionarios.temas.map((tema) => [tema.nome, tema.nivel]));
  const corPorNivel = new Map(NIVEIS_DE_TEMA.map((n) => [n.nivel, n.cor]));

  return (
    // 24px entre blocos principais — degrau único de respiro entre seções distintas.
    // Blocos relacionados (clima + temas) usam gap menor internamente (12px).
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* A base do recorte vem em lotes até `TETO_DE_DERIVACAO`
          (`api/cliente.ts`). Passado o teto, tudo abaixo é calculado sobre
          uma PARTE — e um número parcial sem aviso é pior do que nenhum. */}
      {truncado ? (
        <FaixaDeAtencao
          mensagem={
            <>
              O recorte tem <strong>{numero(total)}</strong> registros e o Painel calcula sobre
              os <strong>{numero(interacoes.length)}</strong> mais recentes. Refine o período ou
              os filtros para ver os números completos.
            </>
          }
        />
      ) : null}
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
      {EXIBIR_KPIS && !semResultado ? (
        <div className="grade--kpis-painel">
          <KpiHero
            rotulo="Demandas de imprensa"
            valor={numero(kpis.imprensa.total)}
            selo="Imprensa"
            progresso={{
              fracao: kpis.imprensa.taxa,
              rotulo: `${percentual(kpis.imprensa.atendidas, kpis.imprensa.total)} de aproveitamento`,
            }}
            aoClicar={() => definirRecorte(alternar(recorte, 'frente', 'imprensa'))}
          />
          <Kpi
            rotulo="Eventos e participações"
            valor={numero(kpis.eventos)}
            dica={`${derivado.resumoDeClima.eventos.positivas} pos, ${derivado.resumoDeClima.eventos.negativas} neg`}
            cor={CORES_DE_FRENTE.eventos}
            aoClicar={() => definirRecorte(alternar(recorte, 'frente', 'eventos'))}
          />
          <Kpi
            rotulo="Interações com investidores"
            valor={numero(kpis.investidores.total)}
            dica={`${kpis.investidores.internacionais} internacionais`}
            cor={CORES_DE_FRENTE.investidores}
            aoClicar={() => definirRecorte(alternar(recorte, 'frente', 'investidores'))}
          />
          <Kpi
            rotulo="Proposições legislativas"
            valor={numero(kpis.legislativo)}
            dica={`${derivado.resumoDeClima.legislativo.positivas} pos, ${derivado.resumoDeClima.legislativo.negativas} neg`}
            cor={CORES_DE_FRENTE.legislativo}
            aoClicar={() => definirRecorte(alternar(recorte, 'frente', 'legislativo'))}
          />
          {/* SEM CLIQUE, de propósito: este número soma DUAS frentes (governo +
              parceiros) e o recorte filtra UMA. Clicar abriria um recorte menor
              que o número clicado — os outros cinco batem 1:1 com a frente. */}
          <Kpi
            rotulo="Interações institucionais"
            valor={numero(kpis.institucionais)}
            dica={`${derivado.resumoDeClima.institucionais.positivas} pos, ${derivado.resumoDeClima.institucionais.negativas} neg`}
            cor={CORES_DE_FRENTE.governo}
          />
          <Kpi
            rotulo={ROTULOS_DE_FRENTE.bancos_credores}
            valor={numero(derivado.resumoDeClima.bancosCredores.total)}
            dica={`${derivado.resumoDeClima.bancosCredores.positivas} pos, ${derivado.resumoDeClima.bancosCredores.negativas} neg`}
            cor={CORES_DE_FRENTE.bancos_credores}
            aoClicar={() => definirRecorte(alternar(recorte, 'frente', 'bancos_credores'))}
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
          dele. Versão COMPACTA: Área(s), Tipo de Interação, Tipo de
          Público e Tema viraram GATILHOS fechados numa linha só
          (`CampoSuspenso`), não mais fileiras de pílulas sempre
          abertas — aquela versão crescia demais em altura e cobria a tela
          toda vez que descia junto. O painel com as pílulas de cada campo só
          existe enquanto aberto, sobrepondo o conteúdo abaixo (`position:
          absolute`) em vez de empurrá-lo.

          Período virou um segundo cabeçalho retrátil embaixo do primeiro,
          mesma ideia — fechado por padrão, abre só quando alguém quer
          arrastar. Referência original: protótipo trazido pelo usuário
          (faixa turquesa "Filtros:" com caixas + barra clara "Período").
          A faixa em si é `FaixaDeFiltros`, compartilhada com a Preparar
          agenda. */}
      <FaixaDeFiltros
        rodape={
          <>
            {/* PERÍODO — retrátil, mesma lógica de "Filtro avançado"
                (`PainelDeFiltros.tsx`): fechado por padrão, nasce sem ocupar
                espaço. Complementa os atalhos de "Filtro avançado" (30/60/90...)
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
                gap: 6,
                padding: '6px 16px',
                background: 'var(--bg-trilho)',
                border: 'none',
                borderRadius: periodoAberto ? 0 : '0 0 var(--r-card) var(--r-card)',
                cursor: 'pointer',
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--cinza-3)',
              }}
            >
              {/* O INTERVALO SELECIONADO aparece aqui só FECHADO — por pedido,
                  para não repetir a mesma informação que já está por extenso
                  dentro do painel aberto (`FiltroDePeriodoArrastavel`). */}
              <span>
                Período
                {!periodoAberto && resumoDoPeriodo ? ` · ${resumoDoPeriodo}` : ''}
              </span>
              <SetaSuspensa aberto={periodoAberto} />
            </button>
            {periodoAberto ? (
              <div
                style={{
                  background: 'var(--branco)',
                  border: '1px solid var(--borda)',
                  borderTop: 'none',
                  borderRadius: '0 0 var(--r-card) var(--r-card)',
                  padding: '8px 14px 10px',
                }}
              >
                {/* RECOLHE SOZINHO ao soltar qualquer um dos dois cabos — por
                    pedido. O intervalo escolhido continua visível depois,
                    escrito ao lado de "Período" (acima). */}
                <FiltroDePeriodoArrastavel
                  recorte={recorte}
                  definirRecorte={definirRecorte}
                  aoConcluir={() => definirPeriodoAberto(false)}
                />
              </div>
            ) : null}
          </>
        }
      >
        <CampoSuspenso
          campo={campoDeAreaPorCategoria(recorte, definirRecorte, catalogo)}
          aoLimpar={() => definirRecorte(limparAreas(recorte))}
        />
        {/* `formato_interacao` (Mídia/Agenda de mercado/Agenda pública/
            Manifestação formal/Evento/Visita/Reunião — `0038_formato_
            interacao.sql`), NÃO `frente`: responde "que tipo de encontro
            foi esse", pergunta ortogonal a "quem é a contraparte" —
            `frente` continua filtrável em "Filtro avançado". */}
        <CampoSuspenso
          campo={campoDeFormatoInteracao(recorte, definirRecorte, catalogo)}
          aoLimpar={() => definirRecorte(limparFormatoInteracao(recorte))}
        />
        <CampoSuspenso
          campo={campoDeCategoriaPublico(recorte, definirRecorte, catalogo)}
          aoLimpar={() => definirRecorte(limparCategoriaPublico(recorte))}
        />
        {/* QUARTO GATILHO — `campoDeTema` é o mesmo usado pela faixa da
            Preparar agenda; só o rótulo muda aqui (era "Temas", por pedido
            vira "Filtrar por Tema"), o campo do recorte é o mesmo (`tags`). */}
        <CampoSuspenso
          campo={{ ...campoDeTema(recorte, definirRecorte, catalogo), rotulo: 'Filtrar por Tema' }}
          aoLimpar={() => definirRecorte(limparTags(recorte))}
        />
      </FaixaDeFiltros>

      {semResultado ? (
        <Vazio
          mensagem="Nenhum registro no recorte"
          dica="Ajuste os filtros acima ou cadastre a primeira interação."
          acao={
            <Botao variante="fantasma" aoClicar={limparRecorte}>
              Limpar todos os filtros
            </Botao>
          }
        />
      ) : (
        <>
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
        climaPrincipal={derivado.resumoExecutivo.climaPrincipal}
        tierPrincipal={derivado.resumoExecutivo.tierPrincipal}
        publicoPrincipal={derivado.resumoExecutivo.publicoPrincipal}
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
      <ComFaixaDoTopo>
      <Secao
        titulo="Termômetro por público"
        subtitulo="Volume de interações por público e o clima percebido em cada um"
        ajuda="Placar de clima por categoria de público: (interações propositivas − tensas) ÷ total × 100, de −100 (só tensas) a +100 (só propositivas). Considera só interações com clima registrado no recorte; mostra as 5 categorias com mais interações, com opção de ver outras."
      >
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
          variante="termometro"
        />
      </Secao>
      </ComFaixaDoTopo>

      {/* 3. INTERAÇÕES MAIS RECENTES, POR ÁREA — quatro tabelas fixas, 2×2
          (duas em cima, duas embaixo — `grade--2`, não `grade--3`: eram três
          categorias, agora são quatro), uma por categoria de área (ver
          `CATEGORIAS_DE_AREA` em `dominio/derivacoes.ts`, que já define a
          ordem: Comunicação/Mercado de Capitais na primeira linha, Relações
          com Investidores/Relações Institucionais na segunda). MESMO CARTÃO
          de "Interações mais recentes" (`TabelaDeInteracoes`), só com menos
          colunas: a área já está dita no título, então Área(s) sairia
          repetindo o óbvio, e Stakeholder/Relevância saem para as quatro
          caberem em duas colunas sem rolagem horizontal. */}
      <div className="grade grade--2" style={{ gap: 16 }}>
        {derivado.interacoesPorAreaFixa.map(({ nome, interacoes: interacoesDaArea }) => (
          <ComFaixaDoTopo key={nome}>
            <TabelaDeInteracoes
              titulo={nome}
              subtitulo="Últimas interações registradas nesta área, da mais recente para a mais antiga"
              ajuda="As interações mais recentes desta área, com data, instituição e pauta — clique numa linha para abrir a ficha completa."
              interacoes={interacoesDaArea}
              catalogo={catalogo}
              aoAbrirFicha={aoAbrirAgenda}
              colunas="reduzidas"
            />
          </ComFaixaDoTopo>
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
          <ComFaixaDoTopo>
          <Secao
            titulo="% Interações por tier e Top instituições"
            subtitulo="Volume de agendas pela relevância da instituição de contato"
            ajuda="A rosca soma as interações do recorte por Tier de relevância da instituição (1 a 4, do dicionário Relevância). O ranking ao lado lista as 5 instituições com mais interações; passe o mouse numa fatia para ver as instituições daquele tier."
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
                  // CINZA ESCURO, não o azul-mar padrão — por pedido: o azul
                  // já é a cor do Tier 1 na rosca ao lado, e as duas barras
                  // do mesmo tom confundiam "isto é sobre tier" com "isto é
                  // o ranking de instituições", que são dimensões diferentes.
                  cor="var(--cinza-4)"
                />
              </div>
            </div>
          </Secao>
          </ComFaixaDoTopo>

          <ComFaixaDoTopo>
          <Secao
            titulo="Clima por Instituições"
            subtitulo="Placar de clima das instituições mais presentes no recorte"
            ajuda="Cada barra é (interações propositivas − tensas) ÷ total × 100, de −100 a +100, calculado só com interações com clima registrado. Lista as instituições com mais interações no recorte, do pior para o melhor placar."
            acao={<BotaoDeHistorico aoClicar={() => definirHistorico('publico')} />}
          >
            <BarraDivergentePorItem
              itens={derivado.climaPorPublico}
              ativo={recorte.entidade}
              aoClicar={(chave) => definirRecorte(alternar(recorte, 'entidade', chave))}
              variante="termometro"
            />
          </Secao>
          </ComFaixaDoTopo>
        </div>

        <ComFaixaDoTopo>
        <Secao
          titulo="% de Interações por Temas"
          subtitulo="Distribuição das interações pelos temas mais discutidos no recorte"
          ajuda="Cada retângulo é um tema, com a área proporcional ao total de interações com aquele tema no recorte — quanto maior o bloco, mais interações. A cor mostra a classificação do tema (Sensível, Estratégico ou Geral)."
          acao={<BotaoDeHistorico aoClicar={() => definirHistorico('tema')} />}
        >
          {/* GRÁFICO DE ÁRVORE (treemap), não rosca — por pedido: a área de
              cada retângulo entrega de cara "qual tema pesa mais", sem
              precisar ler a legenda ao lado. USA `derivado.todosOsTemas`
              (TODOS os temas do dicionário, não só o Top 5) — o ranking ao
              lado e "Temas no tempo" mais abaixo continuam em
              `derivado.temas` (Top 5), sem mudar: são leituras diferentes,
              "os 5 mais discutidos" vs. "a distribuição completa". O CLIMA
              POR TEMA (que a rosca mostrava no tooltip) saiu:
              `GraficoDeArvore` não tem hover com detalhe extra ainda — ver o
              comentário no próprio componente.

              COR POR NÍVEL (`corDeItem`), sem agrupar as células — Sensível /
              Estratégico / Geral em três tons de azul, via
              `nivelPorNomeDoTema`/`corPorNivel` acima; a legenda embaixo do
              gráfico (`legenda`) decodifica qual tom é qual nível. */}
          <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: '3 1 420px', minWidth: 320 }}>
              <GraficoDeArvore
                itens={derivado.todosOsTemas}
                ativo={recorte.tags?.[0]}
                aoClicar={(chave) => definirRecorte(alternarTag(recorte, chave))}
                vazio="Nenhum tema registrado neste recorte."
                corDeItem={(chave) => corPorNivel.get(nivelPorNomeDoTema.get(chave) ?? 'gerais') ?? NIVEIS_DE_TEMA[2].cor}
                legenda={NIVEIS_DE_TEMA.map(({ cor, rotulo }) => ({ cor, rotulo }))}
                // MAIS ALTO que antes (era 240): com TODOS os temas em vez
                // do Top 5, cada célula fica menor — a altura extra é o que
                // mantém espaço pra maioria mostrar rótulo.
                altura={300}
              />
            </div>
            <div style={{ flex: '1 1 180px', minWidth: 160 }}>
              <div className="kicker" style={{ marginBottom: 12 }}>
                Top 5 temas
              </div>
              <Ranking
                itens={comEscalaDeCor(derivado.temas, ESCALA_AZUL_TOP5)}
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
                itens={comEscalaDeCor(derivado.categoriasPublico, ESCALA_VERDE_TOP5)}
                ativo={
                  recorte.categoriaPublico?.[0] != null ? String(recorte.categoriaPublico[0]) : undefined
                }
                aoClicar={(chave) => definirRecorte(alternarCategoriaPublico(recorte, Number(chave)))}
                vazio="Nenhuma categoria de público neste recorte."
              />
            </div>
          </div>
        </Secao>
        </ComFaixaDoTopo>
      </div>

      {/* 5. INTERAÇÕES MAIS RECENTES — reaproveita o mesmo cartão de cima,
          agora sem filtro de área nenhum: todo o recorte, colunas completas. */}
      <ComFaixaDoTopo>
        <TabelaDeInteracoes interacoes={interacoes} catalogo={catalogo} aoAbrirFicha={aoAbrirAgenda} />
      </ComFaixaDoTopo>

      {/* BLOCO: SÉRIES TEMPORAIS — volumetria, clima e temas compartilham o
          mesmo seletor de granularidade e respondem juntos "o que aconteceu
          no tempo". Gap interno menor (12px) mostra que são do mesmo grupo. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="kicker" style={{ color: 'var(--cinza-2)', paddingLeft: 2 }}>
          Séries temporais
        </div>

        <ComFaixaDoTopo>
        <Secao
          titulo="Volumetria total por Público"
          subtitulo="Distribuição temporal das agendas acumuladas pelas categorias da taxonomia de público"
          ajuda="Total de interações por período (mês, semana ou semestre — ver o seletor de granularidade), empilhadas pela categoria de público da instituição. A altura da coluna é o volume total daquele período."
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
            centralizada
          />
        </Secao>
        </ComFaixaDoTopo>

        <ComFaixaDoTopo>
        <Secao
          titulo="Clima das interações no tempo"
          subtitulo="Evolução da classificação de clima (Propositivo, Neutro e Tenso) no período"
          ajuda="Cada coluna soma 100% das interações com clima registrado naquele período, divididas entre Propositivo, Neutro e Tenso — mostra como a PROPORÇÃO de clima muda no tempo, não o volume total de interações."
        >
          {/* BARRAS DE 100%: toda coluna com registro tem a mesma altura, e o
              que varia é a fatia de cada clima — a pergunta aqui é "como o
              clima se compõe mês a mês", não "quantas reuniões houve" (isso
              a Volumetria acima já responde). O total continua no topo de
              cada coluna e no tooltip, com a % ao lado de cada fatia. */}
          <BarrasEmpilhadas
            colunas={comReativoNaBase(derivado.clima)}
            altura={150}
            escala="percentual"
            formatarRotulo={FORMATADORES_DE_ROTULO[granularidade]}
            aoClicarSegmento={(chave) => definirRecorte(alternar(recorte, 'clima', chave))}
          />
          <Legenda
            itens={derivado.categoriasDeClima}
            ativo={recorte.clima}
            aoClicar={(chave) => definirRecorte(alternar(recorte, 'clima', chave))}
            centralizada
          />
        </Secao>
        </ComFaixaDoTopo>

        <ComFaixaDoTopo>
        <Secao
          titulo="Net Sentiment Score no tempo"
          subtitulo="Placar de clima do recorte, período a período, contra a média geral"
          ajuda="NSS = (interações propositivas − tensas) ÷ total com clima registrado × 100, de −100 a +100 — a mesma fórmula do placar de clima usado nos outros gráficos, aqui ao longo do tempo. A linha tracejada é o NSS do recorte inteiro, para comparar cada período contra a média geral. Adicione um público para comparar a linha dele com a linha Geral. Sem clima registrado, o período fica sem ponto."
        >
          {nssPublicosExtras.length || nssPublicosDisponiveis.length ? (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 6,
                marginBottom: 12,
              }}
            >
              {nssPublicosExtras.map((idComoTexto, indice) => {
                const categoria = catalogo.dicionarios.categorias_publico.find(
                  (c) => String(c.id) === idComoTexto,
                );
                return (
                  <Chip
                    key={idComoTexto}
                    rotulo={categoria?.nome ?? idComoTexto}
                    ativo
                    fundo={PALETA_DE_LINHAS_EXTRAS[indice % PALETA_DE_LINHAS_EXTRAS.length]}
                    texto="var(--branco)"
                    titulo={`Tirar ${categoria?.nome ?? idComoTexto} do gráfico`}
                    aoClicar={() =>
                      definirNssPublicosExtras(nssPublicosExtras.filter((c) => c !== idComoTexto))
                    }
                  />
                );
              })}
              {nssPublicosDisponiveis.length ? (
                <select
                  value=""
                  onChange={(evento) => {
                    if (evento.target.value) {
                      definirNssPublicosExtras([...nssPublicosExtras, evento.target.value]);
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
                  <option value="">+ Adicionar público…</option>
                  {nssPublicosDisponiveis.map((categoria) => (
                    <option key={categoria.id} value={String(categoria.id)}>
                      {categoria.nome}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          ) : null}

          <GraficoDeLinha
            series={seriesDeNss}
            altura={220}
            formatarRotulo={FORMATADORES_DE_ROTULO[granularidade]}
            linhaDeReferencia={{ valor: derivado.nssGeral, rotulo: 'NSS geral' }}
          />
          {seriesDeNss.length > 1 ? (
            <Legenda
              itens={seriesDeNss.map((serie) => ({ chave: serie.chave, rotulo: serie.chave, cor: serie.cor }))}
              centralizada
            />
          ) : null}
        </Secao>
        </ComFaixaDoTopo>

        <ComFaixaDoTopo>
        <Secao
          titulo="Temas no tempo"
          subtitulo="Recorrência das pautas institucionais mais debatidas ao longo do tempo"
          ajuda="Interações por período para os 5 temas mais recorrentes do recorte (mesmos do ranking Top 5 temas). Uma interação com mais de um tema conta em cada um deles."
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
        </Secao>
        </ComFaixaDoTopo>
      </div>

      <ComFaixaDoTopo>
      <Secao
        titulo="Barra divergente por tema"
        subtitulo="Desempenho comparativo de clima por pauta (do pior ao melhor placar)"
        ajuda="Cada barra é (interações propositivas − tensas) ÷ total × 100, de −100 a +100, calculado só com interações com clima registrado. Lista os temas com mais interações no recorte, do pior para o melhor placar."
      >
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

        <BarraDivergente
          itens={derivado.scorePorTema.itens}
          aoAbrirAgenda={aoAbrirAgenda}
          variante="termometro"
        />
      </Secao>
      </ComFaixaDoTopo>

      {/* BLOCO: DISTRIBUIÇÃO E RANKINGS — mapa + três rankings respondem juntos
          "onde está e com quem". Gap interno de 12px mostra que são do mesmo grupo. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="kicker" style={{ color: 'var(--cinza-2)', paddingLeft: 2 }}>
          Distribuição e rankings
        </div>

        <ComFaixaDoTopo>
        <Secao
          titulo="Distribuição geográfica das Interações e Porta-vozes"
          subtitulo="Concentração de presença física e impacto institucional por Estado (UF)"
          ajuda="O mapa soma as interações por UF da instituição, com uma bolha à parte para as On-line (sem localização física). O ranking ao lado lista os porta-vozes da Aegea com mais participações no recorte."
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
        </ComFaixaDoTopo>

        <div className="grade grade--3" style={{ gap: 12 }}>
          <ComFaixaDoTopo>
          <Secao
            titulo="Instituições"
            subtitulo="Principais entidades e parceiras"
            ajuda="Ranking das instituições com mais interações registradas no recorte atual, da maior para a menor."
          >
            <Ranking
              itens={derivado.instituicoes}
              ativo={recorte.entidade}
              aoClicar={(nome) => definirRecorte(alternar(recorte, 'entidade', nome))}
            />
          </Secao>
          </ComFaixaDoTopo>

          <ComFaixaDoTopo>
          <Secao
            titulo="Esfera e abrangência"
            subtitulo="Divisão por nível de governo"
            ajuda="Interações agrupadas pelo nível de governo da instituição (Federal, Estadual, Municipal etc.), do maior para o menor volume."
          >
            <Ranking itens={derivado.esferas} cor="var(--turquesa-rio)" />
          </Secao>
          </ComFaixaDoTopo>

          <ComFaixaDoTopo>
          <Secao
            titulo="Unidades de negócio"
            subtitulo="Volume por unidade operacional Aegea"
            ajuda="Interações agrupadas pela unidade de negócio operacional da Aegea envolvida no recorte, da maior para a menor."
          >
            <Ranking
              itens={derivado.unidades}
              ativo={recorte.unidade}
              aoClicar={(nome) => definirRecorte(alternar(recorte, 'unidade', nome))}
              cor="var(--roxo-acai)"
            />
          </Secao>
          </ComFaixaDoTopo>
        </div>
      </div>
        </>
      )}

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
          (o Painel fora do popup, a Preparar agenda), que não têm este
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
  climaPrincipal,
  tierPrincipal,
  publicoPrincipal,
}: {
  total: number;
  climaPrincipal?: { rotulo: string; pct: number };
  tierPrincipal?: { rotulo: string; pct: number };
  publicoPrincipal?: { rotulo: string; pct: number };
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        // OS QUATRO ITENS DISTRIBUÍDOS pelo espaço inteiro da caixa, e não
        // um cluster à esquerda e dois à direita: sem o rótulo "Síntese
        // Executiva" (virou o título grande, fora daqui), o total sozinho à
        // esquerda ficava desequilibrado contra o resto do outro lado.
        //
        // TIER E PÚBLICO no lugar de "Maior volume" (UF) — por pedido: a
        // pergunta que este banner responde é "com quem estamos falando",
        // e relevância/público respondem isso mais diretamente que UF, que
        // continua logo abaixo, no mapa.
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

      {climaPrincipal ? (
        <div>
          <span style={{ color: 'var(--cinza-2)' }}>Clima predominante: </span>
          <strong style={{ color: 'var(--cinza-4)' }}>{climaPrincipal.rotulo}</strong>{' '}
          <span className="tabular" style={{ color: 'var(--cinza-2)' }}>({climaPrincipal.pct}%)</span>
        </div>
      ) : null}

      {tierPrincipal ? (
        <div>
          <span style={{ color: 'var(--cinza-2)' }}>Relevância predominante: </span>
          <strong style={{ color: 'var(--cinza-4)' }}>{tierPrincipal.rotulo}</strong>{' '}
          <span className="tabular" style={{ color: 'var(--cinza-2)' }}>({tierPrincipal.pct}%)</span>
        </div>
      ) : null}

      {publicoPrincipal ? (
        <div>
          <span style={{ color: 'var(--cinza-2)' }}>Principal público: </span>
          <strong style={{ color: 'var(--cinza-4)' }}>{publicoPrincipal.rotulo}</strong>{' '}
          <span className="tabular" style={{ color: 'var(--cinza-2)' }}>({publicoPrincipal.pct}%)</span>
        </div>
      ) : null}
    </div>
  );
}
