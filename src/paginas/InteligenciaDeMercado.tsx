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

import { obterSerieDeMercado } from '@/api/cliente';
import type { MetricaDoBond, SerieDeMercado } from '@/api/cliente';
import { Carregando, FaixaDeErro } from '@/componentes/basicos';
import { FAIXA_FIXA_DO_PRECO, FAIXA_FIXA_DO_YIELD } from '@/dominio/eixoDaSerie';
import { GraficoDeDoisEixos } from '@/graficos/GraficoDeDoisEixos';
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
  '#FE952B',
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

const PERIODOS = [
  { codigo: '1M', rotulo: '1 mês', dias: 30 },
  { codigo: '3M', rotulo: '3 meses', dias: 90 },
  { codigo: '6M', rotulo: '6 meses', dias: 180 },
  { codigo: 'tudo', rotulo: 'Tudo', dias: null },
] as const;

const METRICAS: { codigo: MetricaDoBond; rotulo: string; eixo: string }[] = [
  { codigo: 'preco', rotulo: 'Preço', eixo: 'Preço (% do par)' },
  { codigo: 'yield', rotulo: 'Yield', eixo: 'Yield (%)' },
];

/** `YYYY-MM-DD` de hoje menos `dias`, no fuso UTC.
 *
 *  UTC DE PROPÓSITO: a rota recorta por data, e usar o fuso local faria o
 *  período mudar de tamanho conforme quem abre a tela — um dia a mais ou a
 *  menos de pregão, dependendo do horário. */
function diasAtras(dias: number): string {
  const agora = Date.now();
  return new Date(agora - dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function InteligenciaDeMercado() {
  const [periodo, definirPeriodo] = useState<string>('6M');
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

  const dias = PERIODOS.find((p) => p.codigo === periodo)?.dias ?? null;
  //: A LISTA QUE VAI AO SERVIDOR sai das CHAVES do mapa, e a ordem é fixada
  //: para o efeito não redisparar por um array reordenado com os mesmos itens.
  const pedidos = slots === null ? null : Object.keys(slots).sort().join(',');

  useEffect(() => {
    let ativo = true;
    definirErro(null);
    definirBuscando(true);
    obterSerieDeMercado({
      tickers: pedidos ? pedidos.split(',') : undefined,
      de: dias === null ? undefined : diasAtras(dias),
      metrica,
    })
      .then((lida) => {
        if (!ativo) return;
        definirDados(lida);
        definirBuscando(false);
      })
      .catch((falha: unknown) => {
        if (!ativo) return;
        definirErro(falha instanceof Error ? falha.message : 'Não foi possível carregar.');
        definirBuscando(false);
      });
    return () => {
      ativo = false;
    };
    //: pedidos É STRING, e não o array: um array novo a cada renderização
    //: faria este efeito rodar em todas elas, e a tela buscaria sem parar.
  }, [dias, metrica, pedidos]);

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

  /** As séries no formato do gráfico, com cor e rótulo.
   *
   *  O RÓTULO SAI DA DESCRIÇÃO DO CATÁLOGO quando ela existe ("AEGEBZ 9
   *  01/20/31"), e do ticker quando não — a descrição vem da planilha e só
   *  existe depois da primeira subida. Usar sempre o ticker faria a legenda
   *  falar Bloomberg com quem lê português. */
  const series: SerieDatada[] = useMemo(() => {
    if (!dados) return [];
    const porTicker = new Map(dados.papeis.map((p) => [p.ticker, p]));
    return dados.bonds.map((serie) => ({
      chave: serie.ticker,
      rotulo: porTicker.get(serie.ticker)?.descricao ?? serie.ticker,
      //: A COR VEM DO SLOT EM VIGOR. O `?? 0` cobre o papel que o servidor
      //: devolveu e a seleção não contém — não deveria acontecer, e cair numa
      //: cor válida é melhor que `undefined` virar `stroke="undefined"`.
      cor: CORES[emVigor[serie.ticker] ?? 0],
      pontos: serie.pontos,
    }));
  }, [dados, emVigor]);

  const indice = useMemo(
    () => (dados?.indice ?? []).map((p) => ({ mes: p.mes, valor: p.isr })),
    [dados],
  );

  if (erro) return <FaixaDeErro mensagem={erro} />;
  if (!dados) return <Carregando />;

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

  return (
    <section style={{ maxWidth: 1440, margin: '0 auto', padding: '0 16px' }}>
      <h1 style={{ color: 'var(--azul-mar)', fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>
        Bonds da Aegea e índice reputacional
      </h1>
      <p style={{ color: 'var(--cinza-3)', fontSize: 15, margin: '0 0 16px' }}>
        Como as cotações se moveram e como o índice da companhia se moveu no
        mesmo período.
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 12, color: 'var(--cinza-2)' }}>Período</legend>
          <div style={{ display: 'flex', gap: 4 }}>
            {PERIODOS.map((p) => (
              <button
                key={p.codigo}
                type="button"
                aria-pressed={periodo === p.codigo}
                onClick={() => definirPeriodo(p.codigo)}
                style={botao(periodo === p.codigo)}
              >
                {p.codigo}
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
      </div>

      {/* O GRÁFICO FICA ESMAECIDO ENQUANTO BUSCA, e com `aria-busy`: a curva
          antiga continua visível (sumir com ela a cada clique faria a tela
          piscar), mas deixa de se apresentar como a resposta da pergunta nova.
          `aria-busy` é o que diz o mesmo a quem usa leitor de tela. */}
      <div aria-busy={buscando} style={{ opacity: buscando ? 0.5 : 1 }}>
        <GraficoDeDoisEixos
          bonds={series}
          indice={indice}
          rotuloDaEsquerda={naMetrica.eixo}
          faixaFixa={naMetrica.codigo === 'preco' ? FAIXA_FIXA_DO_PRECO : FAIXA_FIXA_DO_YIELD}
        />
      </div>
      {buscando ? (
        <p role="status" style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '4px 0 0' }}>
          Atualizando…
        </p>
      ) : null}

      {/* A LEGENDA É TAMBÉM O SELETOR, como no mockup: clicar liga e desliga a
          série. Duas listas separadas — a companhia e os pares — porque são
          decisões diferentes: ver o próprio papel é o padrão, comparar com par
          é uma escolha. */}
      <div style={{ marginTop: 16 }}>
        <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '0 0 4px' }}>Aegea</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {daAegea.map((papel) => (
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

        <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '12px 0 4px' }}>
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

        {/* O LIMITE DITO EM VOZ ALTA. Sem esta linha, clicar num chip e nada
            acontecer é indistinguível de um botão quebrado. */}
        {semCorLivre ? (
          <p style={{ fontSize: 12, color: 'var(--atencao-fg)', margin: '12px 0 0' }}>
            {CORES.length} séries é o máximo que o gráfico distingue por cor.
            Desligue uma para ligar outra.
          </p>
        ) : null}
      </div>
    </section>
  );
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
