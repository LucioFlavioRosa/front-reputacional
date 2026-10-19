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

/** As cores das séries, na ordem do catálogo (Aegea primeiro).
 *
 *  AS TRÊS PRIMEIRAS SÃO AS DA ESPECIFICAÇÃO (2029 laranja, 2031 azul-mar, 2036
 *  violeta); as seguintes servem os pares. A cor vem da POSIÇÃO no catálogo, e
 *  não do ticker: a alternativa seria um mapa ticker→cor que precisaria de uma
 *  linha nova a cada papel emitido.
 *
 *  NÃO SE CICLA A LISTA. Com mais papéis que cores, a última se repete — e
 *  repetir cor é pior que empatar, porque duas linhas iguais afirmam que são a
 *  mesma série. Oito é mais papéis do que um gráfico comporta de qualquer
 *  forma; o seletor é o que mantém o número baixo. */
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
  //: `null` = "os da Aegea", que é o que o servidor decide. A tela só manda
  //: lista quando a pessoa escolhe — mandar os tickers da Aegea explicitamente
  //: duplicaria essa decisão aqui.
  const [escolhidos, definirEscolhidos] = useState<string[] | null>(null);
  const [dados, definirDados] = useState<SerieDeMercado | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  const dias = PERIODOS.find((p) => p.codigo === periodo)?.dias ?? null;

  useEffect(() => {
    let ativo = true;
    definirErro(null);
    obterSerieDeMercado({
      tickers: escolhidos ?? undefined,
      de: dias === null ? undefined : diasAtras(dias),
      metrica,
    })
      .then((lida) => {
        if (ativo) definirDados(lida);
      })
      .catch((falha: unknown) => {
        if (ativo) {
          definirErro(falha instanceof Error ? falha.message : 'Não foi possível carregar.');
        }
      });
    return () => {
      ativo = false;
    };
  }, [dias, metrica, escolhidos]);

  const naMetrica = METRICAS.find((m) => m.codigo === metrica) ?? METRICAS[0];

  /** As séries no formato do gráfico, com cor e rótulo.
   *
   *  O RÓTULO SAI DA DESCRIÇÃO DO CATÁLOGO quando ela existe ("AEGEBZ 9
   *  01/20/31"), e do ticker quando não — a descrição vem da planilha e só
   *  existe depois da primeira subida. Usar sempre o ticker faria a legenda
   *  falar Bloomberg com quem lê português. */
  const series: SerieDatada[] = useMemo(() => {
    if (!dados) return [];
    const porTicker = new Map(dados.papeis.map((p, i) => [p.ticker, { papel: p, i }]));
    return dados.bonds.map((serie) => {
      const achado = porTicker.get(serie.ticker);
      const papel = achado?.papel;
      return {
        chave: serie.ticker,
        rotulo: papel?.descricao ?? serie.ticker,
        //: A ÚLTIMA COR SE REPETE em vez de a lista ciclar — ver `CORES`.
        cor: CORES[Math.min(achado?.i ?? 0, CORES.length - 1)],
        pontos: serie.pontos,
      };
    });
  }, [dados]);

  const indice = useMemo(
    () => (dados?.indice ?? []).map((p) => ({ mes: p.mes, valor: p.isr })),
    [dados],
  );

  if (erro) return <FaixaDeErro mensagem={erro} />;
  if (!dados) return <Carregando />;

  const daAegea = dados.papeis.filter((p) => p.e_aegea);
  const pares = dados.papeis.filter((p) => !p.e_aegea);
  const selecionados = new Set(escolhidos ?? daAegea.map((p) => p.ticker));

  const alternar = (ticker: string) => {
    const proximo = new Set(selecionados);
    if (proximo.has(ticker)) proximo.delete(ticker);
    else proximo.add(ticker);
    //: VAZIO VOLTA PARA O PADRÃO em vez de pedir um gráfico sem série: desligar
    //: o último papel deixaria a tela em branco sem nada explicando por quê.
    definirEscolhidos(proximo.size ? [...proximo] : null);
  };

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

      <GraficoDeDoisEixos
        bonds={series}
        indice={indice}
        rotuloDaEsquerda={naMetrica.eixo}
        faixaFixa={metrica === 'preco' ? FAIXA_FIXA_DO_PRECO : FAIXA_FIXA_DO_YIELD}
      />

      {/* A LEGENDA É TAMBÉM O SELETOR, como no mockup: clicar liga e desliga a
          série. Duas listas separadas — a companhia e os pares — porque são
          decisões diferentes: ver o próprio papel é o padrão, comparar com par
          é uma escolha. */}
      <div style={{ marginTop: 16 }}>
        <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '0 0 4px' }}>Aegea</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {daAegea.map((papel, i) => (
            <ChipDeSerie
              key={papel.ticker}
              papel={papel}
              cor={CORES[Math.min(i, CORES.length - 1)]}
              ligado={selecionados.has(papel.ticker)}
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
              cor="var(--cinza-3)"
              ligado={selecionados.has(papel.ticker)}
              aoClicar={() => alternar(papel.ticker)}
            />
          ))}
        </div>
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
  cor,
  ligado,
  aoClicar,
}: {
  papel: { ticker: string; emissor: string; descricao: string | null };
  cor: string;
  ligado: boolean;
  aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={ligado}
      onClick={aoClicar}
      title={papel.descricao ?? papel.ticker}
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
        opacity: ligado ? 1 : 0.45,
        cursor: 'pointer',
      }}
    >
      {/* A COR NÃO É A ÚNICA MARCA de qual série é qual: o nome está ao lado,
          e o estado ligado/desligado vai em `aria-pressed`. */}
      <span
        aria-hidden
        style={{ width: 10, height: 10, borderRadius: 2, background: cor, flexShrink: 0 }}
      />
      {papel.emissor === 'Aegea' ? papel.ticker : `${papel.emissor} · ${papel.ticker}`}
    </button>
  );
}
