/** A primeira tela do Painel de Inteligência de Mercado.
 *
 *  O cartão deste portal existe na capa desde o início, com `view: null` e
 *  `pronto: false`. Esta é a tela que ele passa a abrir.
 *
 *  O QUE ELA RESPONDE, e só isso: como as cotações dos bonds da Aegea se moveram
 *  e como o índice reputacional da companhia se moveu no mesmo tempo. A leitura
 *  é de COINCIDÊNCIA NO TEMPO — é o que a especificação afirma na seção 1, e o
 *  gráfico o diz em voz alta, porque dois eixos num gráfico são lidos como
 *  relação por quem não parar para pensar.
 *
 *  FORA DESTA ETAPA, por decisão do dono do produto: episódios de imprensa
 *  marcados no gráfico, as duas listas de impacto e a tabela de notícias. O que
 *  entra é o gráfico, o seletor de papéis, o de período e o de métrica.
 *
 *  UMA CHAMADA, DUAS SÉRIES. `obterSerieDeMercado` traz bonds, índice e
 *  catálogo juntos — e o índice vem por ela, não por `/api/score/serie`, porque
 *  aquela exige o portal do Score: quem tem só o de mercado receberia 403 e a
 *  linha do eixo direito sairia vazia POR PERMISSÃO, indistinguível de falta de
 *  dado.
 */

import { useEffect, useMemo, useState } from 'react';

import { obterImpactoNaJanela, obterSerieDeMercado } from '@/api/cliente';
import type {
  ImpactoNaJanela,
  MetricaDoBond,
  GrupoNaJanela,
  NivelDaJanela,
  SerieDeMercado,
} from '@/api/cliente';
import { Carregando, FaixaDeErro } from '@/componentes/basicos';
import { numero } from '@/dominio/formato';
import {
  ATALHOS_DO_PERIODO,
  corDaVariacao,
  descricaoLegivelDoBond,
  inicioDoPeriodo,
  prenderJanela,
  resumoDoBond,
  variacaoEmPontos,
} from '@/dominio/cotacoesDosBonds';
import type { AtalhoDoPeriodo } from '@/dominio/cotacoesDosBonds';
import { GraficoDeDoisEixos, temCurva } from '@/graficos/GraficoDeDoisEixos';
import { NavegadorDoPeriodo } from '@/graficos/NavegadorDoPeriodo';
import type { JanelaDoPeriodo } from '@/dominio/cotacoesDosBonds';
import { RegistrosDaJanela } from '@/paginas/RegistrosDaJanela';
import { mercadoMudou } from '@/dominio/sincronizacao';
import type { SerieDatada } from '@/graficos/GraficoDeDoisEixos';

/** As cores das séries. AS TRÊS PRIMEIRAS SÃO AS DA ESPECIFICAÇÃO (2029
 *  laranja, 2031 azul-mar, 2036 violeta); as cinco seguintes servem os pares.
 *
 *  ───────────────────────────────────────────────────────────────────────────
 *  A COR É UM SLOT, E O SLOT É ESTÁVEL ENQUANTO A LINHA ESTÁ NO GRÁFICO.
 *
 *  A primeira versão disto escolhia a cor pela POSIÇÃO NO CATÁLOGO e repetia a
 *  última da lista do oitavo papel em diante — e eu defendi isso dizendo que
 *  "repetir é melhor que ciclar". Está errado nas duas pontas, e eu mesmo
 *  levantei a suspeita antes de a revisão chegar:
 *
 *    * com dois pares de posição alta ligados, as duas linhas ficavam
 *      IDÊNTICAS no gráfico — e duas linhas da mesma cor afirmam que são a
 *      mesma série;
 *    * e o chip do par usava um cinza FIXO em vez da cor da linha, então
 *      ligar um par desenhava uma curva que a legenda não identificava.
 *
 *  A REGRA QUE ISTO PASSA A SEGUIR é a de qualquer gráfico honesto: a cor
 *  acompanha a ENTIDADE, nunca a posição dela numa lista que muda. Ligar ou
 *  desligar uma série não pode repintar as que ficaram — quem está olhando a
 *  curva azul tem de continuar olhando a mesma curva azul.
 *
 *  ENTÃO O SLOT É ALOCADO NA ATIVAÇÃO e devolvido na desativação: o papel novo
 *  pega a MENOR cor livre, e quem já estava desenhado não se move. Acabando os
 *  slots, o seletor recusa em vez de repetir cor — oito linhas já é mais do que
 *  um gráfico comporta, e o limite dito em voz alta é melhor que duas curvas
 *  indistinguíveis. */
const CORES = [
  //: VERDE-ÁGUA NO LUGAR DO LARANJA, por pedido (21/10/2026). Mais escuro que
  //: a Turquesa Rio (#17E3CB) da marca: numa linha de 2px e com texto branco
  //: na etiqueta da borda, o tom claro some.
  '#0FA392',
  '#0027BD',
  '#A11FFF',
  '#B32328',
  '#0A6B60',
  '#44495C',
  '#8E24AA',
  '#00897B',
] as const;

/** O menor slot de cor que ninguém está usando. `null` quando acabaram. */
function slotLivre(usados: Record<string, number>): number | null {
  const tomados = new Set(Object.values(usados));
  for (let i = 0; i < CORES.length; i++) {
    if (!tomados.has(i)) return i;
  }
  return null;
}

/** OS SCORES QUE O EIXO DIREITO PODE MOSTRAR, e os botões que os ligam.
 *
 *  O PEDIDO (20/10/2026): "hoje trazemos no gráfico o score geral, gostaria de
 *  adicionar o score das lentes imprensa, mercado e institucional, e temos que
 *  adicionar os botões para selecionar os scores".
 *
 *  SÓ O ÍNDICE LIGADO DE SAÍDA, que é como a tela sempre abriu. Com os quatro
 *  acesos, a primeira coisa que ela mostraria seriam quatro tracejados por
 *  cima das curvas dos bonds — e o assunto da tela é o bond.
 *
 *  AS CORES NÃO SE REPETEM COM AS DOS BONDS, e agora isso está MEDIDO — antes
 *  estava afirmado e errado, achado de revisão. A paleta `CORES` (acima) tem
 *  `#0A6B60`, que é exatamente o `--ok-fg` com que o índice sempre foi
 *  desenhado: com seis ou mais papéis ligados, a linha do ISR ficava
 *  indistinguível da de um bond. Nenhum dos quatro tons abaixo está naquela
 *  lista.
 *
 *  E ELAS SÃO ESCURAS DE PROPÓSITO. As duas primeiras que escolhi (#17E3CB e
 *  #F2B705) tinham contraste de 1,6:1 e 1,8:1 sobre o fundo claro — numa linha
 *  TRACEJADA e fina, isso é uma curva que some. Estas ficam acima de 4,5:1.
 *
 *  E A COR NÃO É A ÚNICA PISTA: cada score tem o seu tracejado. Quatro linhas
 *  no mesmo eixo, para quem não separa matiz (ou para quem imprime em preto e
 *  branco), seriam quatro curvas iguais — e o gráfico é o lugar onde isso mais
 *  custa.
 *
 *  O CÓDIGO DA LENTE É A CHAVE, e ele vem do servidor dentro de `lentes`:
 *  `isr` é o único que não é lente, e é o índice inteiro. */
const SCORES_DO_GRAFICO = [
  { chave: 'isr', rotulo: 'Índice geral', cor: '#0B3C49', traco: '6 4' },
  { chave: 'imprensa', rotulo: 'Imprensa', cor: '#0E6E8C', traco: '2 3' },
  { chave: 'mercado', rotulo: 'Mercado', cor: '#9A6700', traco: '10 4' },
  { chave: 'institucional', rotulo: 'Institucional', cor: '#B5157C', traco: '6 3 2 3' },
] as const;

const SCORES_AO_ABRIR = ['isr'];


/** Quanto a tela espera antes de desistir de uma busca, em milissegundos.
 *
 *  VINTE SEGUNDOS porque esta leitura é curta: o servidor responde em 60–95ms
 *  no ambiente, então vinte segundos sem resposta não é lentidão, é algo
 *  perdido no caminho. Exportado para o teste não precisar esperar de verdade.
 */
export const TETO_DA_BUSCA = 20_000;

/** Quantos dias a janela dos temas cobre, contados para trás do dia clicado.
 *
 *  QUINZE, por pedido ("pega a data e subtrai 15 dias"). O CLIQUE VOLTOU em
 *  21/10/2026: o navegador e os atalhos escolhem o que se VÊ no gráfico, e o
 *  clique escolhe o recorte dos temas. */
export const DIAS_DA_JANELA = 15;

const METRICAS: { codigo: MetricaDoBond; rotulo: string; eixo: string }[] = [
  { codigo: 'preco', rotulo: 'Preço', eixo: 'Preço (% do par)' },
  { codigo: 'yield', rotulo: 'Yield', eixo: 'Yield (%)' },
];

export function InteligenciaDeMercado({
  comPares = false,
}: {
  /** OS PARES SAÍRAM "NESTE MOMENTO", por pedido (21/10/2026): a tela vai ao
   *  CFO com os bonds da Aegea só. O código fica, e volta ligando esta prop. */
  comPares?: boolean;
} = {}) {
  //: O PERÍODO É RECORTADO NA TELA, e não no servidor (21/10/2026): os cards de
  //: cotação mostram SEMPRE o último fechamento e as variações da semana e do
  //: mês, e para isso precisam da série inteira, seja qual for o período do
  //: gráfico. E o período passa a contar do ÚLTIMO DADO (`inicioDoPeriodo`),
  //: porque a base chega com atraso: contado de hoje, "1M" eram dois pregões.
  const [periodo, definirPeriodo] = useState<AtalhoDoPeriodo>('6M');
  const [metrica, definirMetrica] = useState<MetricaDoBond>('preco');
  //: UM ESTADO SÓ PARA A SELEÇÃO: quais papéis estão ligados E com qual cor.
  //:
  //: `null` = "os da Aegea", que é o que o servidor decide quando a tela não
  //: manda lista — mandar os tickers da companhia explicitamente duplicaria
  //: aqui uma decisão que já está lá.
  //:
  //: ERAM DOIS ESTADOS, e um teste me mostrou o buraco: `escolhidos` (quem está
  //: ligado) e `slots` (a cor de cada um) podiam discordar, porque `alternar`
  //: lia os dois do fechamento da renderização. Cinco cliques seguidos sem
  //: re-renderização no meio calculavam o slot todos sobre o MESMO estado
  //: antigo, e o último vencia — os quatro primeiros se perdiam.
  //:
  //: Com um mapa só, "quem está ligado" são as CHAVES e a cor é o VALOR: as
  //: duas informações não têm como divergir, e a atualização usa a forma
  //: funcional, que sempre vê o estado mais recente.
  const [slots, definirSlots] = useState<Record<string, number> | null>(null);
  const [dados, definirDados] = useState<SerieDeMercado | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  //: BUSCANDO. Enquanto a resposta nova não chega, o gráfico continua com a
  //: anterior — e sem dizer isso ele AFIRMA ser a resposta da pergunta nova.
  //: Ver `naMetrica` e o aviso de atualização abaixo.
  const [buscando, definirBuscando] = useState(true);
  //: A TELA ESCUTA O BARRAMENTO DO MERCADO, pelo mesmo motivo que a do Score
  //: passou a escutar o dela: subir a planilha na aba Importação tem de
  //: aparecer AQUI sem F5. `api/nucleo.ts` avisa depois de qualquer escrita
  //: bem-sucedida sob `/api/mercado` e já esqueceu o cache — mas esquecer o
  //: cache não faz ninguém buscar de novo, só garante que a próxima busca seja
  //: de verdade. Este contador é quem busca.
  //:
  //: ATRAVESSA ABAS DO NAVEGADOR de graça (`BroadcastChannel`): subir numa aba
  //: atualiza o gráfico na outra.
  const [versao, definirVersao] = useState(0);
  useEffect(() => mercadoMudou.assinar(() => definirVersao((v) => v + 1)), []);

  //: A JANELA DOS TEMAS: o dia clicado, o que o servidor respondeu, e a falha
  //: dela — SEPARADA da falha do gráfico, porque são dois pedaços independentes
  //: da tela. A janela falhar não pode levar o gráfico, que é a lição do beco
  //: sem saída que esta tela já teve.
  //: QUAIS SCORES ESTÃO NO GRÁFICO. Lista, e não um só: o pedido é poder
  //: comparar — ver o índice e uma lente ao mesmo tempo é o gesto inteiro.
  const [scoresLigados, definirScoresLigados] = useState<string[]>(SCORES_AO_ABRIR);

  //: A JANELA ARRASTADA NO NAVEGADOR. `null` = a do atalho (1M, 3M...).
  //: Clicar num atalho a apaga; arrastar a cria, e aí nenhum atalho fica aceso.
  const [janelaManual, definirJanelaManual] = useState<JanelaDoPeriodo | null>(null);
  //: O DIA CLICADO NO GRÁFICO: é ele que define o recorte dos temas.
  const [diaEscolhido, definirDiaEscolhido] = useState<string | null>(null);
  //: A CHAVE ENTRE OS DOIS NÍVEIS, por pedido dele depois de ver os dois no ar.
  //:
  //: O PILAR TEM COBERTURA (~98% na Clipei) e diz "a imprensa está amplamente
  //: positiva" sobre o TODO. O TEMA tem sete vezes mais grupos e acha o bolsão
  //: negativo, mas sobre o quarto que está classificado — a migration 0098 mede
  //: 72.590 menções com pilar e sem tema. Escolher um perderia uma pergunta.
  //:
  //: ABRE NO TEMA, que é o que ele pediu primeiro; o pilar fica a um clique. E a
  //: cobertura do tema MELHORA com o tempo: depende de o fornecedor mandar o N3
  //: que o cadastro reconhece, trabalho em curso com eles.
  //: ABRE NO SUBTEMA (N3) desde 21/10/2026, por pedido: "vamos utilizar aqui o
  //: N3". O tema estratégico e o atributo ficam a um clique.
  const [nivel, definirNivel] = useState<NivelDaJanela>('n3');
  const [janela, definirJanela] = useState<ImpactoNaJanela | null>(null);
  const [erroDaJanela, definirErroDaJanela] = useState<string | null>(null);


  //: A LISTA QUE VAI AO SERVIDOR sai das CHAVES do mapa, e a ordem é fixada
  //: para o efeito não redisparar por um array reordenado com os mesmos itens.
  //:
  //: OS PAPÉIS DA AEGEA VÃO SEMPRE, mesmo desligados: o card de cada um mostra
  //: o último fechamento com a curva fora do gráfico, e sem a série não haveria
  //: o que mostrar. Quem decide o que se DESENHA é `emVigor`, mais abaixo.
  const daAegeaNoCatalogo = (dados?.papeis ?? [])
    .filter((p) => p.e_aegea)
    .map((p) => p.ticker)
    .join(',');
  const pedidos =
    slots === null
      ? null
      : [...new Set([...Object.keys(slots), ...daAegeaNoCatalogo.split(',').filter(Boolean)])]
          .sort()
          .join(',');

  useEffect(() => {
    let ativo = true;
    definirErro(null);
    definirBuscando(true);
    //: O TETO DA ESPERA. A guarda `ativo` descarta resposta velha, mas nada
    //: protegia contra uma promessa que NUNCA resolve nem rejeita: `buscando`
    //: ficava `true` eternamente, o gráfico em `opacity: 0.5` e o "Atualizando…"
    //: não saía — que é exatamente o que ele descreveu como travar, com o F5
    //: como única saída. Achado de revisão.
    //:
    //: AQUI, E NÃO NO `requisitar`: pôr um teto no transporte mudaria o
    //: comportamento de toda a plataforma, inclusive das subidas de planilha,
    //: que demoram de propósito. Esta tela faz leitura curta — o servidor
    //: responde em 60-95ms no ambiente — então vinte segundos sem resposta é
    //: sinal de que algo se perdeu no caminho, não de lentidão.
    const relogio = setTimeout(() => {
      if (!ativo) return;
      definirErro(
        'A busca demorou demais e foi interrompida. O servidor pode estar fora do ar.',
      );
      definirBuscando(false);
    }, TETO_DA_BUSCA);
    obterSerieDeMercado({
      tickers: pedidos ? pedidos.split(',') : undefined,
      metrica,
    })
      .then((lida) => {
        if (!ativo) return;
        clearTimeout(relogio);
        definirDados(lida);
        definirBuscando(false);
      })
      .catch((falha: unknown) => {
        if (!ativo) return;
        clearTimeout(relogio);
        definirErro(falha instanceof Error ? falha.message : 'Não foi possível carregar.');
        definirBuscando(false);
      });
    return () => {
      ativo = false;
      //: O RELÓGIO MORRE COM O EFEITO, senão um teto de uma busca já superada
      //: dispararia sobre a busca nova e diria "demorou demais" sobre uma
      //: pergunta que acabou de sair.
      clearTimeout(relogio);
    };
    //: pedidos É STRING, e não o array: um array novo a cada renderização
    //: faria este efeito rodar em todas elas, e a tela buscaria sem parar.
  }, [metrica, pedidos, versao]);

  /** Os slots EM VIGOR: os escolhidos, ou os do padrão deduzidos na hora.
   *
   *  DEDUZIDOS, E NÃO SEMEADOS EM ESTADO. Um efeito que semeasse criaria um
   *  instante em que a tela já tem dado e ainda não tem cor — e nesse instante
   *  as três curvas da Aegea apareciam todas na MESMA cor. Foi um teste que me
   *  mostrou, ao capturar a cor antes da semeadura.
   *
   *  OS TRÊS DA AEGEA PEGAM 0, 1 E 2, que são as cores da especificação: 2029
   *  laranja, 2031 azul-mar, 2036 violeta. */
  const emVigor = useMemo((): Record<string, number> => {
    if (slots !== null) return slots;
    const doPadrao = (dados?.papeis ?? [])
      .filter((p) => p.e_aegea)
      .slice(0, CORES.length);
    return Object.fromEntries(doPadrao.map((p, i) => [p.ticker, i]));
  }, [slots, dados]);

  /** A métrica QUE ESTÁ DESENHADA, e não a que o botão mostra selecionado.
   *
   *  ACHADO DE REVISÃO, e era o mais grave da tela: trocar de preço para yield
   *  mudava o rótulo do eixo e a faixa fixa NA HORA, enquanto os pontos
   *  continuavam sendo os de preço até a resposta chegar. O gráfico dizia
   *  "Yield (%)" sobre uma curva de preço — dado falso, com aparência de certo.
   *
   *  A ROTA DEVOLVE `metrica` NA RESPOSTA, e é dela que o rótulo sai: o que a
   *  tela afirma passa a vir do MESMO lugar que os pontos, e os dois não têm
   *  como discordar. O botão continua mostrando a escolha da pessoa — é o
   *  `buscando` que diz que ela ainda não chegou. */
  const naMetrica =
    METRICAS.find((m) => m.codigo === (dados?.metrica ?? metrica)) ?? METRICAS[0];

  /** As séries no formato do gráfico, com cor e rótulo (o ticker). */
  const series: SerieDatada[] = useMemo(() => {
    if (!dados) return [];
    //: SÓ OS LIGADOS SE DESENHAM. Os da Aegea desligados continuam vindo do
    //: servidor (para os cards), e não podem virar curva por isso.
    return dados.bonds.filter((serie) => serie.ticker in emVigor).map((serie) => ({
      chave: serie.ticker,
      //: O TICKER, e não a descrição Bloomberg ("AEGEBZ 6 3/4 05/20/29"): é o
      //: nome que o card mostra, e o tooltip tem de falar a mesma língua. O
      //: cupom e o vencimento ficam no card, em português.
      rotulo: serie.ticker,
      //: A COR VEM DO SLOT EM VIGOR. O `?? 0` cobre o papel que o servidor
      //: devolveu e a seleção não contém — não deveria acontecer, e cair numa
      //: cor válida é melhor que `undefined` virar `stroke="undefined"`.
      cor: CORES[emVigor[serie.ticker] ?? 0],
      pontos: serie.pontos,
    }));
  }, [dados, emVigor]);

  const indice = useMemo(() => {
    const pontos = dados?.indice ?? [];
    return SCORES_DO_GRAFICO.filter((score) => scoresLigados.includes(score.chave)).map(
      (score) => ({
        chave: score.chave,
        rotulo: score.rotulo,
        cor: score.cor,
        traco: score.traco,
        //: O NULO ATRAVESSA, e é o que faz o mês sem medição virar VÃO no
        //: degrau em vez de um ponto no chão. Zero ali diria que a reputação
        //: daquele mês foi péssima; a lente sem dado simplesmente não foi
        //: medida — e é assim que ela sai do índice também.
        pontos: pontos.map((p) => ({
          mes: p.mes,
          valor: score.chave === 'isr' ? p.isr : (p.lentes?.[score.chave] ?? null),
        })),
      }),
    );
  }, [dados, scoresLigados]);

  /** Repete a busca. É o contador do barramento que serve: ele já está nas
   *  dependências do efeito, e uma segunda via faria duas portas para a mesma
   *  coisa. */
  const tentarDeNovo = () => definirVersao((v) => v + 1);

  //: A FALHA NÃO ENGOLE A TELA. Isto era `if (erro) return <FaixaDeErro/>`, e
  //: trocava a tela INTEIRA pela faixa: período, métrica e os chips sumiam
  //: junto. Quem pegasse uma falha de rede num clique não tinha mais nada para
  //: clicar, e a única saída era o F5 — a faixa dizia o que aconteceu e tirava
  //: da pessoa a capacidade de reagir.
  //:
  //: SEM CATÁLOGO NÃO HÁ CONTROLE PARA MANTER, e aí a faixa é a tela toda
  //: mesmo: é a primeira busca que falhou, não existe seletor nem gráfico
  //: anteriores. O que faltava era a saída, e é o botão.
  //: O PERÍODO EM VIGOR, calculado ANTES do retorno antecipado de "sem dados"
  //: porque os efeitos abaixo dependem dele (a ordem dos hooks não muda).
  const datasDesenhadas = series.flatMap((s) => s.pontos.map((ponto) => ponto.data.slice(0, 10)));
  const primeiraData = datasDesenhadas.reduce<string | null>(
    (menor, data) => (menor === null || data < menor ? data : menor),
    null,
  );
  //: O ÚLTIMO DADO DO QUE ESTÁ NO GRÁFICO, de onde o período é contado.
  const ultimaData = datasDesenhadas.reduce<string | null>(
    (maior, data) => (maior === null || data > maior ? data : maior),
    null,
  );
  const janelaEmVigor: JanelaDoPeriodo | null =
    primeiraData && ultimaData
      ? janelaManual
        ? prenderJanela(janelaManual, primeiraData, ultimaData)
        : {
            de: (() => {
              const corte = inicioDoPeriodo(periodo, ultimaData);
              return corte && corte > primeiraData ? corte : primeiraData;
            })(),
            ate: ultimaData,
          }
      : null;
  useEffect(() => {
    if (diaEscolhido === null) {
      definirJanela(null);
      definirErroDaJanela(null);
      return;
    }
    let ativo = true;
    definirErroDaJanela(null);
    //: A JANELA ANTIGA SAI JÁ, e não quando a nova chega — achado de revisão, do
    //: mesmo tipo que o rótulo do eixo que mentia sobre a métrica: os quadros
    //: antigos ficavam na tela com o cabeçalho do dia anterior.
    definirJanela(null);
    obterImpactoNaJanela(diaEscolhido, nivel, DIAS_DA_JANELA)
      .then((lida) => {
        if (ativo) definirJanela(lida);
      })
      .catch((falha: unknown) => {
        if (!ativo) return;
        definirJanela(null);
        definirErroDaJanela(
          falha instanceof Error ? falha.message : 'Não foi possível ler a janela.',
        );
      });
    return () => {
      ativo = false;
    };
    //: `versao` ENTRA AQUI TAMBÉM: subir planilha nova muda as menções do mês.
    //: O NÍVEL também: trocar a chave é uma pergunta nova sobre o MESMO dia.
  }, [diaEscolhido, nivel, versao]);

  if (!dados) {
    return erro ? (
      <section style={{ maxWidth: 1440, margin: '0 auto', padding: '0 16px' }}>
        <FaixaDeErro mensagem={erro} />
        <button type="button" onClick={tentarDeNovo} style={{ ...botao(false), marginTop: 12 }}>
          Tentar de novo
        </button>
      </section>
    ) : (
      <Carregando />
    );
  }

  const daAegea = dados.papeis.filter((p) => p.e_aegea);
  const pares = dados.papeis.filter((p) => !p.e_aegea);
  const selecionados = new Set(Object.keys(emVigor));

  /** Liga ou desliga um papel.
   *
   *  FORMA FUNCIONAL, e não um objeto montado do fechamento: cliques seguidos
   *  sem re-renderização no meio calculariam o slot todos sobre o MESMO estado
   *  antigo, e o último venceria — os anteriores se perderiam. Foi um teste que
   *  me mostrou, clicando cinco chips em sequência.
   */
  const alternar = (ticker: string) => {
    definirSlots((anterior) => {
      const atual = anterior ?? emVigor;
      if (ticker in atual) {
        const seguinte = { ...atual };
        //: DEVOLVE O SLOT, para a próxima série poder usá-lo. Quem ficou mantém
        //: o seu: nenhuma curva desenhada muda de cor porque outra saiu.
        delete seguinte[ticker];
        //: VAZIO VOLTA PARA O PADRÃO em vez de pedir um gráfico sem série:
        //: desligar o último papel deixaria a tela em branco sem nada
        //: explicando por quê.
        return Object.keys(seguinte).length ? seguinte : null;
      }
      const livre = slotLivre(atual);
      //: ACABANDO AS CORES, RECUSA — ver o comentário de `CORES`. Repetir cor
      //: faria duas curvas afirmarem que são a mesma série.
      if (livre === null) return atual;
      return { ...atual, [ticker]: livre };
    });
  };

  const semCorLivre = slotLivre(emVigor) === null;

  /** Os papéis LIGADOS que voltaram sem cotação nenhuma no período.
   *
   *  O CLIQUE SEM EFEITO VISÍVEL ERA O PIOR DEFEITO DESTA TELA, e foi relatado
   *  como travamento: "a tela trava quando eu mudo alguma fonte de dados ou
   *  métrica, daí preciso dar F5". O servidor respondia 200 em 60ms, e a tela
   *  engolia a resposta — o chip acendia com cor e curva nenhuma aparecia.
   *
   *  O BACK DEVOLVE A SÉRIE VAZIA DE PROPÓSITO (semeia `por_ticker` com cada
   *  ticker pedido), e o gráfico descarta quem não tem ponto. Nenhum dos dois
   *  está errado; faltava alguém DIZER.
   *
   *  ACONTECE DE DOIS JEITOS: o papel que não negociou na janela escolhida — ou
   *  foi emitido depois dela —, e o papel que tem preço e não tem yield, que
   *  desaparece só ao trocar a métrica. */
  //: `temCurva`, E NÃO `pontos.length`: a regra é a do gráfico, e as duas
  //: divergiam numa série com pontos de DATA TORTA — ela não desenhava curva e
  //: não entrava no aviso, que é o estado silencioso que este aviso existe para
  //: acabar. Achado de revisão, dentro desta própria correção.
  const comPonto = new Set(dados.bonds.filter((s) => temCurva(s.pontos)).map((s) => s.ticker));
  const mudos = Object.keys(emVigor).filter((t) => !comPonto.has(t));

  const eYield = naMetrica.codigo === 'yield';
  //: A SÉRIE DO MINI GRÁFICO DO NAVEGADOR: a desenhada com mais pregões.
  const doNavegador = [...series].sort((a, b) => b.pontos.length - a.pontos.length)[0];

  return (
    <section style={{ maxWidth: 1440, margin: '0 auto', padding: '0 16px' }}>
      <h1 style={{ color: 'var(--azul-mar)', fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>
        Bonds da Aegea e índice reputacional
      </h1>
      <p style={{ color: 'var(--cinza-4)', fontSize: 15, margin: '0 0 16px' }}>
        Cotação diária dos bonds da Aegea e o score reputacional no mesmo período.
      </p>

      {/* OS CARDS DE COTAÇÃO, um por bond da Aegea, acima do gráfico. Sempre o
          ÚLTIMO fechamento, seja qual for o período. Clicar liga e desliga a
          curva: o card É a legenda dos bonds da Aegea. */}
      <div
        role="group"
        aria-label="Bonds da Aegea no gráfico"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {daAegea.map((papel, i) => (
          <CardDoBond
            key={papel.ticker}
            ticker={papel.ticker}
            descricao={papel.descricao}
            cor={CORES[emVigor[papel.ticker] ?? i] ?? CORES[0]}
            ligado={selecionados.has(papel.ticker)}
            semCorLivre={semCorLivre}
            pontos={dados.bonds.find((b) => b.ticker === papel.ticker)?.pontos ?? []}
            eYield={eYield}
            aoClicar={() => alternar(papel.ticker)}
          />
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 24,
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 12, color: 'var(--cinza-2)' }}>Período</legend>
          <div style={{ display: 'flex', gap: 4 }}>
            {ATALHOS_DO_PERIODO.map((p) => (
              <button
                key={p.codigo}
                type="button"
                aria-pressed={!janelaManual && periodo === p.codigo}
                onClick={() => {
                  definirPeriodo(p.codigo);
                  definirJanelaManual(null);
                }}
                style={botao(!janelaManual && periodo === p.codigo)}
              >
                {p.rotulo}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 12, color: 'var(--cinza-2)' }}>Métrica</legend>
          <div style={{ display: 'flex', gap: 4 }}>
            {METRICAS.map((m) => (
              <button
                key={m.codigo}
                type="button"
                aria-pressed={metrica === m.codigo}
                onClick={() => definirMetrica(m.codigo)}
                style={botao(metrica === m.codigo)}
              >
                {m.rotulo}
              </button>
            ))}
          </div>
        </fieldset>

        {/* OS SCORES, e eles ligam e desligam INDEPENDENTES — não são um
            seletor de um só, como período e métrica. O gesto é comparar: ver o
            índice e uma lente lado a lado é a pergunta inteira.

            O QUADRADINHO DE COR não é enfeite: com quatro tracejados possíveis
            no mesmo eixo, é ele que liga o botão à curva. */}
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
            Score no eixo direito
          </legend>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {SCORES_DO_GRAFICO.map((s) => {
              const ligado = scoresLigados.includes(s.chave);
              return (
                <button
                  key={s.chave}
                  type="button"
                  aria-pressed={ligado}
                  onClick={() =>
                    definirScoresLigados((atuais) =>
                      atuais.includes(s.chave)
                        ? atuais.filter((c) => c !== s.chave)
                        : [...atuais, s.chave],
                    )
                  }
                  style={{
                    ...botao(ligado),
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: s.cor,
                      //: APAGADO QUANDO DESLIGADO, para o quadradinho não
                      //: prometer uma curva que não está na tela.
                      opacity: ligado ? 1 : 0.35,
                    }}
                  />
                  {s.rotulo}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      {/* A FALHA FICA AO LADO DO QUE CONTINUA FUNCIONANDO, e não no lugar dele:
          a curva anterior segue na tela (apagá-la perderia o que a pessoa
          estava lendo por causa de uma falha que pode durar um segundo), os
          controles seguem de pé, e o botão repete a busca sem recarregar a
          página. */}
      {erro ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 12px', flexWrap: 'wrap' }}>
          <FaixaDeErro mensagem={erro} />
          <button type="button" onClick={tentarDeNovo} style={botao(false)}>
            Tentar de novo
          </button>
        </div>
      ) : null}

      {/* "ESTOU TRABALHANDO", E NÃO "ESTOU DESLIGADO". Era `opacity: 0.5`, e meia
          opacidade é o idioma de controle desabilitado: numa tela que já se
          suspeitava travada, o apagamento confirmava a suspeita errada — achado
          da passada de UX.

          Quem dá o recado agora é o selo sobre o gráfico. A curva antiga fica
          legível de propósito: ela é o melhor dado disponível até a resposta
          nova chegar, e o selo é o que a impede de se apresentar como a resposta
          da pergunta nova. `aria-busy` diz o mesmo a quem usa leitor de tela. */}
      <div
        aria-busy={buscando}
        style={{
          position: 'relative',
          opacity: buscando ? 0.92 : 1,
          background: 'var(--branco)',
          border: '1px solid var(--borda)',
          borderRadius: 4,
          padding: '16px 20px',
        }}
      >
        <GraficoDeDoisEixos
          altura={440}
          bonds={series}
          indice={indice}
          rotuloDaEsquerda={naMetrica.eixo}
          rotuloDaDireita="Score"
          inicioDoPeriodo={janelaEmVigor?.de ?? null}
          fimDoPeriodo={janelaEmVigor?.ate ?? null}
          chaveDaEscala={`${janelaEmVigor?.de}|${janelaEmVigor?.ate}|${naMetrica.codigo}`}
          aoEscolherData={definirDiaEscolhido}
          dataEscolhida={diaEscolhido}
          diasDaJanela={DIAS_DA_JANELA}
          formatarValor={(valor) =>
            eYield ? `${valor.toFixed(2).replace('.', ',')}%` : valor.toFixed(1).replace('.', ',')
          }
          apoio={
            eYield
              ? 'Yield em % ao ano, fechamento diário. Score de 0 a 100. Coincidência no tempo não indica causa.'
              : 'Preço em % do valor de face, fechamento diário. Score de 0 a 100. Coincidência no tempo não indica causa.'
          }
        />
        {/* O NAVEGADOR DO PERÍODO, colado no gráfico: arrastar a janela muda o
            período do gráfico e dos eixos, e apaga o atalho aceso. Os temas
            seguem o CLIQUE no gráfico, e não o navegador. */}
        {janelaEmVigor && primeiraData && ultimaData && doNavegador ? (
          <NavegadorDoPeriodo
            pontos={doNavegador.pontos}
            cor={doNavegador.cor}
            inicio={primeiraData}
            fim={ultimaData}
            janela={janelaEmVigor}
            aoMudar={definirJanelaManual}
          />
        ) : null}
        {buscando ? (
          <p
            role="status"
            style={{
              position: 'absolute',
              top: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              margin: 0,
              padding: '3px 10px',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--azul-mar)',
              background: 'var(--branco)',
              border: '1px solid var(--borda)',
              borderRadius: 999,
            }}
          >
            Atualizando…
          </p>
        ) : null}
      </div>

      {/* O PAPEL ESCOLHIDO QUE NÃO TEM CURVA DIZ POR QUÊ. Sem esta linha, ligar
          um papel sem cotação no período é indistinguível de a tela ter parado
          de responder — e a saída que sobra para quem está usando é o F5.
          `role="status"` porque a frase aparece como RESPOSTA a um clique: quem
          usa leitor de tela precisa ouvi-la sem ir procurar. */}
      {mudos.length ? (
        <p
          data-testid="sem-cotacao"
          role="status"
          //: 13px E NÃO 12: a 12 ela ficava do tamanho das legendas dos eixos e
          //: se lia como ornamento do gráfico. É a frase que explica por que uma
          //: curva pedida não apareceu — achado da passada de UX.
          style={{
            fontSize: 13,
            color: 'var(--atencao-fg)',
            background: 'var(--atencao-bg)',
            borderRadius: 'var(--r-card-int)',
            padding: '8px 12px',
            margin: '10px 0 0',
          }}
        >
          {mudos.length === 1
            ? `${mudos[0]} não tem cotação de ${naMetrica.rotulo.toLowerCase()} neste período, por isso não há curva dele no gráfico.`
            : `${mudos.join(', ')} não têm cotação de ${naMetrica.rotulo.toLowerCase()} neste período, por isso não há curva delas no gráfico.`}{' '}
          Experimente um período maior ou a outra métrica.
        </p>
      ) : null}

      {/* OS TEMAS DA JANELA, logo abaixo do gráfico — onde ele pediu.

          A JANELA É UM PEDAÇO INDEPENDENTE DA TELA: a falha dela mostra a faixa
          aqui e não leva o gráfico nem os controles junto. */}
      <JanelaDosTemas
        dia={diaEscolhido}
        aoFechar={() => definirDiaEscolhido(null)}
        janela={janela}
        erro={erroDaJanela}
        nivel={nivel}
        aoTrocarNivel={definirNivel}
      />

      {/* OS PARES, para comparar. Os bonds da Aegea ligam e desligam nos cards,
          acima do gráfico; o contador "N de 8 séries" saiu por pedido, e o
          limite só aparece quando chega. */}
      {comPares ? (
      <div style={{ marginTop: 16 }}>
        <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '0 0 4px' }}>
          Comparar com pares
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {pares.map((papel) => (
            <ChipDeSerie
              key={papel.ticker}
              papel={papel}
              slot={emVigor[papel.ticker]}
              ligado={selecionados.has(papel.ticker)}
              semCorLivre={semCorLivre}
              aoClicar={() => alternar(papel.ticker)}
            />
          ))}
        </div>
        {semCorLivre ? (
          <p
            data-testid="limite-de-series"
            style={{ fontSize: 13, color: 'var(--atencao-fg)', fontWeight: 500, margin: '8px 0 0' }}
          >
            O gráfico já tem {CORES.length} séries. Desligue uma para ligar outra.
          </p>
        ) : null}
      </div>
      ) : null}
    </section>
  );
}

/** O card de cotação de um bond da Aegea: último fechamento, variação na
 *  semana e no mês. É também o botão que liga e desliga a curva dele.
 *
 *  O RESUMO VEM DA SÉRIE INTEIRA, e não do período do gráfico: o card responde
 *  "como está o papel agora", que não muda porque alguém olhou só 1M. */
function CardDoBond({
  ticker,
  descricao,
  cor,
  ligado,
  semCorLivre,
  pontos,
  eYield,
  aoClicar,
}: {
  ticker: string;
  descricao: string | null;
  cor: string;
  ligado: boolean;
  semCorLivre: boolean;
  pontos: { data: string; valor: number }[];
  eYield: boolean;
  aoClicar: () => void;
}) {
  const resumo = resumoDoBond(pontos);
  const unidade = eYield ? 'p.p.' : 'pts';
  const recusado = !ligado && semCorLivre;
  const data = resumo
    ? `${resumo.ultimo.data.slice(8, 10)}/${resumo.ultimo.data.slice(5, 7)}/${resumo.ultimo.data.slice(0, 4)}`
    : null;
  return (
    <button
      type="button"
      aria-pressed={ligado}
      aria-label={`${ticker}: ${ligado ? 'tirar do gráfico' : 'mostrar no gráfico'}`}
      disabled={recusado}
      title={recusado ? 'O gráfico já tem o máximo de séries. Desligue uma para ligar esta.' : undefined}
      onClick={aoClicar}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '14px 16px',
        textAlign: 'left',
        background: ligado ? 'var(--branco)' : 'var(--bg-rodape-card)',
        //: BORDA NEUTRA, SEM FAIXA COLORIDA NA LATERAL (pedido de 21/10/2026):
        //: a cor da série fica só no ponto ao lado do nome, como na legenda.
        border: `1px solid ${ligado ? 'var(--borda-input)' : 'var(--borda)'}`,
        borderRadius: 4,
        cursor: recusado ? 'not-allowed' : 'pointer',
        font: 'inherit',
        color: 'var(--cinza-4)',
        opacity: ligado ? 1 : 0.72,
      }}
    >
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
          <span
            aria-hidden
            style={{ width: 10, height: 10, borderRadius: '50%', background: cor, opacity: ligado ? 1 : 0.4 }}
          />
          {ticker}
        </span>
        <span style={{ fontSize: 11, color: 'var(--cinza-2)' }}>
          {ligado ? 'no gráfico' : 'fora do gráfico'}
        </span>
      </span>
      {resumo ? (
        <>
          <span style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <span>
              <span className="tabular" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>
                {eYield
                  ? `${resumo.ultimo.valor.toFixed(2).replace('.', ',')}%`
                  : resumo.ultimo.valor.toFixed(1).replace('.', ',')}
              </span>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--cinza-2)', marginTop: 4 }}>
                {eYield ? 'yield' : '% do par'} · fechamento de {data}
              </span>
            </span>
            <span style={{ display: 'flex', gap: 14, textAlign: 'right' }}>
              <Variacao rotulo="Semana" valor={resumo.semanal} unidade={unidade} subirEBom={!eYield} />
              <Variacao rotulo="Mês" valor={resumo.mensal} unidade={unidade} subirEBom={!eYield} />
            </span>
          </span>
          {descricaoLegivelDoBond(descricao) ? (
            <span style={{ fontSize: 12, color: 'var(--cinza-3)' }}>
              {descricaoLegivelDoBond(descricao)}
            </span>
          ) : null}
        </>
      ) : (
        <span style={{ fontSize: 13, color: 'var(--cinza-2)' }}>Sem cotação nesta métrica.</span>
      )}
    </button>
  );
}

function Variacao({
  rotulo,
  valor,
  unidade,
  subirEBom,
}: {
  rotulo: string;
  valor: number | null;
  unidade: string;
  /** No preço, subir é bom; no yield (custo da dívida), subir é ruim. */
  subirEBom: boolean;
}) {
  return (
    <span>
      <span style={{ display: 'block', fontSize: 11, color: 'var(--cinza-2)' }}>{rotulo}</span>
      <span
        className="tabular"
        title={valor === null ? 'Sem pregão anterior para comparar' : undefined}
        style={{
          display: 'block',
          fontSize: 15,
          fontWeight: 800,
          color: valor === null ? 'var(--cinza-2)' : corDaVariacao(valor, subirEBom),
        }}
      >
        {valor === null ? 'sem base' : `${variacaoEmPontos(valor)} ${unidade}`}
      </span>
    </span>
  );
}

/** Os dois quadros dos temas, e o convite que os antecede.
 *
 *  O CONVITE EXISTE porque dois quadros vazios na abertura seriam ruído — e
 *  pior, pareceriam dado que não carregou. É ele que liga o gráfico aos quadros:
 *  sem uma frase dizendo que a data é clicável, a interação não se descobre.
 *
 *  A LENTE E A JANELA SAEM DA RESPOSTA, nunca do que a tela pediu: os dois
 *  divergem enquanto a resposta não chega, e foi assim que o rótulo do eixo
 *  mentiu sobre a métrica — achado de revisão daquele bloco.
 */
function JanelaDosTemas({
  dia,
  aoFechar,
  janela,
  erro,
  nivel,
  aoTrocarNivel,
}: {
  /** O dia clicado no gráfico; os temas são os quinze dias até ele. */
  dia: string | null;
  aoFechar: () => void;
  janela: ImpactoNaJanela | null;
  erro: string | null;
  nivel: NivelDaJanela;
  aoTrocarNivel: (nivel: NivelDaJanela) => void;
}) {
  //: O GRUPO ABERTO NO MODAL. Mora aqui, e não na página: ele só existe
  //: enquanto esta janela existe, e fechar a janela tem de levar o modal com
  //: ela — foi o defeito do "segundo clique" que deixava a janela antiga na
  //: tela, uma camada acima.
  //: O MODAL PERTENCE AO DIA CLICADO: clicar outro dia o fecha, senão ele
  //: mostraria registros de uma janela que já não é a da tela.
  const chave = dia ?? '';
  const [abertoEm, definirAbertoEm] = useState<{ chave: string; grupo: GrupoNaJanela } | null>(null);
  const aberto = abertoEm && abertoEm.chave === chave ? abertoEm.grupo : null;
  const definirAberto = (grupo: GrupoNaJanela | null) =>
    definirAbertoEm(grupo ? { chave, grupo } : null);

  if (dia === null) {
    return (
      <p style={{ fontSize: 13, color: 'var(--cinza-3)', margin: '12px 0 0' }}>
        Clique numa data do gráfico ou num rótulo do eixo para ver o que mais
        empurrou a nota da imprensa nos {DIAS_DA_JANELA} dias anteriores.
      </p>
    );
  }

  if (erro) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '12px 0 0', flexWrap: 'wrap' }}>
        <FaixaDeErro mensagem={erro} />
        <button type="button" onClick={aoFechar} style={botao(false)}>
          Fechar a janela
        </button>
      </div>
    );
  }

  if (!janela) {
    return (
      <p role="status" style={{ fontSize: 13, color: 'var(--cinza-2)', margin: '12px 0 0' }}>
        Lendo {NIVEIS_DOS_QUADROS.find((n) => n.codigo === nivel)?.plural ?? 'os grupos'} de{' '}
        {porExtenso(dia)}…
      </p>
    );
  }

  return (
    <div style={{ margin: '14px 0 0' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 8,
        }}
      >
        <p data-testid="cabecalho-da-janela" style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
          Lente {janela.lente}: {porExtenso(janela.de)} a {porExtenso(janela.ate)}
        </p>

        {/* A CHAVE ENTRE OS DOIS NÍVEIS, dentro da janela e não na barra de cima:
            ela só faz sentido com uma data escolhida, e um controle que fica
            desabilitado a maior parte do tempo é ruído na tela.

            O RÓTULO DIZ O NÍVEL E O QUE ELE DÁ, porque é essa a escolha: o pilar
            cobre quase tudo e agrupa grosso, o tema é fino e só alcança o que
            está classificado. Sem isso, "N1" e "N2" não dizem nada a quem não
            conhece a taxonomia por dentro. */}
        <div role="group" aria-label="Nível do agrupamento" style={{ display: 'flex', gap: 4 }}>
          {NIVEIS_DOS_QUADROS.map(({ codigo, rotulo, ajuda }) => (
            <button
              key={codigo}
              type="button"
              aria-pressed={nivel === codigo}
              title={ajuda}
              onClick={() => aoTrocarNivel(codigo)}
              style={botao(nivel === codigo)}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <button type="button" onClick={aoFechar} style={botao(false)}>
          Fechar a janela
        </button>
      </div>

      {/* DE QUAL MÊS SÃO OS PONTOS, E COM QUE RÉGUA. Achado de revisão: a
          resposta trazia as duas coisas e a tela mostrava só lente e datas —
          e aí "−2,3 pt" não diz pontos DE QUÊ.

          IMPORTA MAIS QUANDO A JANELA ATRAVESSA A VIRADA: o numerador tem
          menções de dois meses e o denominador é de um, então o número pode
          passar do que aquele mês inteiro movimentou. A ORDEM dos temas
          continua exata — todos dividem pelo mesmo denominador —, a escala não.
          Quem lê precisa saber qual das duas coisas está olhando.

          E DE QUAL NOTA, que é a pergunta que ele fez depois de ver no ar:
          "esse desconto de pontos de cada pilar ou tema é em relação à
          pontuação total? ou só da lente?". É da LENTE — o denominador é
          `denominador_do_mes(lente_id, ...)`, só as fontes ligadas dela. Mas a
          LINHA DO GRÁFICO, dez centímetros acima, é o ÍNDICE: a média
          ponderada das cinco lentes, em que a imprensa pesa 30 de 100 por
          padrão. Dois números na mesma tela em réguas diferentes, e nada
          dizendo isso — era convite à subtração errada. "A nota da lente X" diz
          a lente da RESPOSTA, não a palavra "imprensa" fixa aqui: quando a
          segunda lente chegar, esta linha continua verdadeira. */}
      <p
        data-testid="regua-da-janela"
        style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '0 0 8px' }}
      >
        Pontos da nota da lente {janela.lente} em {porExtenso(janela.mes).slice(3)},
        medida pela régua de {janela.regua}
        {janela.de.slice(0, 7) !== janela.ate.slice(0, 7)
          ? '. A janela atravessa a virada do mês: a ordem é exata e a escala é a daquele mês'
          : null}
        . Não são pontos do índice da linha acima: a lente é uma parte dele.
      </p>

      {/* "NÃO HÁ COMO MEDIR" NÃO É "NADA IMPACTOU", e os dois quadros vazios
          parecem iguais. O mês sem base não tem denominador: sem ele não há
          pergunta a responder, e mostrar quadros vazios afirmaria que os grupos
          daquela janela não impactaram nada — o que é falso, porque as menções
          estão lá. */}
      {janela.mes_sem_base ? (
        <p style={{ fontSize: 13, color: 'var(--atencao-fg)', background: 'var(--atencao-bg)', borderRadius: 'var(--r-card-int)', padding: '8px 12px', margin: 0 }}>
          O mês de {porExtenso(janela.mes).slice(3)} não tem base medida na lente{' '}
          {janela.lente}, então não há como calcular quanto cada grupo empurrou a
          nota. Não é que nada impactou: a régua do mês ainda não existe.
        </p>
      ) : (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <QuadroDeTemas
            testId="quadro-positivos"
            titulo="Mais empurraram para CIMA"
            grupos={janela.positivos}
            total={janela.total_positivos}
            cor="var(--sucesso-fg)"
            aoAbrir={definirAberto}
          />
          <QuadroDeTemas
            testId="quadro-negativos"
            titulo="Mais empurraram para BAIXO"
            grupos={janela.negativos}
            total={janela.total_negativos}
            cor="var(--erro-fg)"
            aoAbrir={definirAberto}
          />
        </div>
      )}

      {/* OS REGISTROS DO GRUPO CLICADO. O modal lê do servidor com o MESMO
          `ate` e o MESMO `nivel` que produziram este quadro — é isso que faz o
          total dele ser o número da linha. */}
      {aberto ? (
        <RegistrosDaJanela
          grupo={aberto}
          ate={janela.ate}
          de={janela.de}
          nivel={janela.nivel}
          dias={janela.dias}
          aoFechar={() => definirAberto(null)}
        />
      ) : null}

      {/* O QUE FICOU DE FORA DA CONTA. As duas formas de uma menção existir,
          pesar no índice e não aparecer aqui. Sem esta linha os quadros parecem
          o todo, e a soma deles não fecharia com o impacto do período. */}
      {janela.sem_grupo || janela.sem_data ? (
        <p
          data-testid="fora-da-conta"
          style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '8px 0 0' }}
        >
          Fora desta conta:{' '}
          {/* A PALAVRA SEGUE O NÍVEL, e vem da RESPOSTA e não do botão: enquanto
              a busca nova não chega, o botão já mudou e os números são os do
              nível anterior — dizer "sem pilar" sobre uma contagem de temas
              seria o mesmo defeito do eixo que mentia sobre a métrica. */}
          {janela.sem_grupo
            ? `${numero(janela.sem_grupo)} menções da janela sem ${
                NIVEIS_DOS_QUADROS.find((n) => n.codigo === janela.nivel)?.sem ?? 'grupo'
              }`
            : null}
          {janela.sem_grupo && janela.sem_data ? '; ' : null}
          {janela.sem_data
            ? //: "DOS MESES DA JANELA", e não "do mês": o número passou a contar
              //: todos os meses que a janela atravessa — achado de revisão, ele
              //: contava só o da ponta e omitia as do mês anterior.
              `${numero(janela.sem_data)} menções sem data nos meses da janela, que pertencem ao mês e não a um dia`
            : null}
          .
        </p>
      ) : null}
    </div>
  );
}

/** OS TRÊS NÍVEIS DOS QUADROS, com os nomes da taxonomia que o CRM já usa
 *  (N1 · Atributo, N2 · Tema estratégico, N3 · Subtema). O SUBTEMA PRIMEIRO,
 *  porque é com ele que a tela abre. */
const NIVEIS_DOS_QUADROS: {
  codigo: NivelDaJanela;
  rotulo: string;
  ajuda: string;
  plural: string;
  sem: string;
}[] = [
  { codigo: 'n3', rotulo: 'N3 · Subtema', ajuda: 'o mais fino: só o que tem subtema classificado', plural: 'os subtemas', sem: 'subtema (N3) atribuído' },
  { codigo: 'n2', rotulo: 'N2 · Tema estratégico', ajuda: 'intermediário', plural: 'os temas', sem: 'tema estratégico (N2) atribuído' },
  { codigo: 'n1', rotulo: 'N1 · Atributo', ajuda: 'o mais grosso: cobre quase tudo', plural: 'os atributos', sem: 'atributo (N1) atribuído' },
];

/** Um quadro: até cinco grupos, do que mais empurrou para o que menos. */
function QuadroDeTemas({
  testId,
  titulo,
  grupos,
  total,
  cor,
  aoAbrir,
}: {
  testId: string;
  titulo: string;
  grupos: GrupoNaJanela[];
  total: number;
  cor: string;
  /** O que fazer quando a pessoa clica numa linha: abrir os registros dela. */
  aoAbrir: (grupo: GrupoNaJanela) => void;
}) {
  return (
    <div
      data-testid={testId}
      style={{
        flex: '1 1 300px',
        border: '1px solid var(--borda)',
        borderRadius: 'var(--r-card-int)',
        padding: '10px 12px',
      }}
    >
      <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '0 0 8px' }}>
        {titulo}
        {/* O TAMANHO REAL, por decisão dele: "mostra os que houver e diz o
            total". Com três grupos aparecem três, e a tela diz "3 de 3" em vez
            de completar com linha vazia — linha vazia é indistinguível de dado
            que não carregou. */}
        {total ? ` · ${numero(grupos.length)} de ${numero(total)}` : null}
      </p>
      {grupos.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>
          Nada empurrou a nota para este lado nesta janela.
        </p>
      ) : (
        <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {grupos.map((grupo) => (
            <li
              //: A CHAVE É O id, e não o nome — achado de revisão: dois temas
              //: homônimos sob pilares diferentes dariam a MESMA chave, e o
              //: React desenharia uma linha só.
              key={grupo.id}
              style={{
                borderTop: '1px solid var(--borda-fraca, var(--borda))',
              }}
            >
              {/* A LINHA INTEIRA É O BOTÃO, e não um ícone ao lado: o alvo é o
                  tema, e quem quer ver as matérias dele clica no nome. Um
                  `<button>` de verdade, e não um `onClick` no `<li>`, porque é
                  assim que ele chega pelo teclado e se anuncia como clicável.

                  O PEDIDO: "se eu clicar em alguma dessas opções quero que abra
                  um modal com os registros do tema ou pilar". */}
              <button
                type="button"
                onClick={() => aoAbrir(grupo)}
                title={`Ver as ${numero(grupo.mencoes)} menções de ${grupo.rotulo} nesta janela`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 10,
                  padding: '4px 0',
                  fontSize: 13,
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'inherit',
                  font: 'inherit',
                }}
              >
              {/* O TEMA É O RÓTULO E O PILAR É O CONTEXTO. São 41 temas contra
                  7 pilares: a lista ganhou granularidade — que é a razão da
                  troca — e perderia legibilidade sem dizer de qual pilar cada
                  um vem, ainda mais para quem estava lendo os pilares até
                  ontem. O pilar pode faltar quando o cadastro não resolve o
                  pai; aí só o tema aparece, em vez de um travessão solto. */}
              <span>
                {grupo.rotulo}
                {grupo.contexto ? (
                  <span style={{ color: 'var(--cinza-2)' }}> · {grupo.contexto}</span>
                ) : null}
              </span>
              <span style={{ whiteSpace: 'nowrap' }}>
                <strong style={{ color: cor }}>{comSinal(grupo.impacto)}</strong>{' '}
                <span style={{ color: 'var(--cinza-2)' }}>pt · {numero(grupo.mencoes)}</span>
              </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** `2026-05-20` como `20/05/2026`. */
function porExtenso(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** O impacto com sinal e uma decimal, no padrão de casa (vírgula, menos real).
 *
 *  O SINAL É A INFORMAÇÃO, e não enfeite: `1,5` e `−1,5` são o grupo que
 *  sustentou e o que derrubou. O `+` explícito é o que torna a leitura simétrica.
 *  O menos é `−` (U+2212), não hífen — é o que o resto da plataforma usa. */
function comSinal(valor: number): string {
  const absoluto = Math.abs(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${valor < 0 ? '−' : '+'}${absoluto}`;
}

function botao(ativo: boolean) {
  return {
    padding: '4px 10px',
    fontSize: 13,
    borderRadius: 'var(--r-card-int)',
    border: `1px solid ${ativo ? 'var(--azul-mar)' : 'var(--borda)'}`,
    background: ativo ? 'var(--azul-mar)' : 'var(--branco)',
    color: ativo ? 'var(--branco)' : 'var(--cinza-3)',
    cursor: 'pointer',
  } as const;
}

function ChipDeSerie({
  papel,
  slot,
  ligado,
  semCorLivre,
  aoClicar,
}: {
  papel: { ticker: string; emissor: string; descricao: string | null };
  /** O slot de cor alocado, ou `undefined` quando a série está desligada. */
  slot: number | undefined;
  ligado: boolean;
  /** Acabaram as cores: ligar mais uma série é recusado. */
  semCorLivre: boolean;
  aoClicar: () => void;
}) {
  //: A COR DO CHIP É A COR DA LINHA, e isto é conserto: o chip do par usava um
  //: cinza FIXO, então ligar um par desenhava uma curva que a legenda não
  //: identificava. Desligado não tem cor porque não tem linha — e aí o quadrado
  //: fica com a borda da casa, dizendo "existe e está fora".
  const cor = ligado && slot !== undefined ? CORES[slot] : 'transparent';
  const bloqueado = !ligado && semCorLivre;
  return (
    <button
      type="button"
      aria-pressed={ligado}
      onClick={aoClicar}
      disabled={bloqueado}
      title={
        bloqueado
          ? `Desligue uma série para ligar ${papel.ticker}`
          : (papel.descricao ?? papel.ticker)
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        fontSize: 13,
        borderRadius: 'var(--r-card-int)',
        border: '1px solid var(--borda)',
        background: 'var(--branco)',
        //: DESLIGADO FICA APAGADO, não escondido: a pessoa precisa ver o que
        //: existe para poder ligar.
        //:
        //: SEM `opacity` NO BOTÃO, e isto é conserto de achado: opacidade de
        //: 0,45 no botão inteiro derrubava o contraste do TEXTO abaixo do
        //: mínimo, e um chip operável que não se lê é pior que um escondido. O
        //: apagado agora é o token de texto secundário, que passa contraste por
        //: construção, e a diferença visual real fica no quadrado da cor.
        color: ligado ? 'var(--cinza-3)' : 'var(--cinza-2)',
        cursor: bloqueado ? 'not-allowed' : 'pointer',
      }}
    >
      {/* A COR NÃO É A ÚNICA MARCA de qual série é qual: o nome está ao lado, e
          o estado ligado/desligado vai em `aria-pressed`. Desligado, o quadrado
          fica vazio com a borda da casa — "existe e está fora do gráfico". */}
      <span
        aria-hidden
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          background: cor,
          border: ligado ? 'none' : '1px solid var(--borda)',
          flexShrink: 0,
        }}
      />
      {papel.emissor === 'Aegea' ? papel.ticker : `${papel.emissor} · ${papel.ticker}`}
    </button>
  );
}
