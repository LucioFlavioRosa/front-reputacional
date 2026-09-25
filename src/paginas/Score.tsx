/** Score Executivo — o Índice de Saúde Reputacional.
 *
 *  UMA NOTA DE 0 A 100 POR MÊS, média ponderada de cinco lentes: imprensa,
 *  mercado, sociedade digital, clientes e institucional. Cada lente lê o
 *  sentimento do que se falou da companhia, por uma ou mais fontes.
 *
 *  O CÁLCULO É DO SERVIDOR, e esta tela só exibe. O ISR é citado em reunião, e
 *  precisa ser o mesmo para todo mundo — com a régua que a coordenação gravou,
 *  e não a versão de código que cada navegador carregou.
 *
 *  O SCORE NÃO USA O RECORTE DO PAINEL, e é a única tela do produto assim. Ele
 *  é da organização inteira: um "ISR filtrado por imprensa" teria peso de
 *  lente sem significado. O que se escolhe aqui é o MÊS, e ele vale para as
 *  cinco abas.
 *
 *  Especificação: `docs/handoff/SCORE.md` no back-reputacional.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  obterDriversDoScore,
  obterOpcoesDoScore,
  obterScore,
  obterSerieDoScore,
} from '@/api/cliente';
import {
  Carregando,
  Cartao,
  Chip,
  FaixaDeErro,
  Secao,
  Vazio,
} from '@/componentes/basicos';
import { CampoQueCompleta } from '@/componentes/CampoQueCompleta';
import { DossieDaLente } from '@/paginas/score/DossieDaLente';
import { BarraDivergentePorItem } from '@/graficos/BarraDivergentePorItem';
import { JornadaDoIndice } from '@/graficos/JornadaDoIndice';
import { RadialDasLentes } from '@/graficos/RadialDasLentes';
import { Ranking } from '@/graficos/Ranking';
import { numero } from '@/dominio/formato';
import {
  coberturaDoMes,
  fraseDosParciais,
  jornadaDoIndice,
} from '@/dominio/jornadaDoIndice';
import {
  FAIXAS,
  comoDelta,
  corDaFaixa,
  corDeAreaDaFaixa,
  corDoDelta,
  lentesOrdenadas,
  pesoDaLente,
} from '@/dominio/score';
import type {
  DriversDoScore,
  LenteDoScore,
  IndiceDoScore,
  OpcoesDoScore,
  PontoDaSerie,
} from '@/dominio/score';


export function Score({
  aba = 'geral',
  aoTrocarAba,
}: {
  /** Vem do endereço: as telas do Score são a barra de cima da divisão. */
  aba?: string;
  aoTrocarAba: (aba: string) => void;
}) {
  const [mes, definirMes] = useState<string | null>(null);
  const [lenteAberta, definirLenteAberta] = useState<string>('imprensa');

  const [opcoes, definirOpcoes] = useState<OpcoesDoScore | null>(null);
  const [indice, definirIndice] = useState<IndiceDoScore | null>(null);
  const [serie, definirSerie] = useState<PontoDaSerie[]>([]);
  const [erro, definirErro] = useState<string | null>(null);

  //: O MÊS NÃO VAI PARA A URL de propósito: a consulta pertence ao recorte
  //: (`estado/painel.tsx` a reescreve a cada filtro), e um parâmetro estranho
  //: ali seria apagado no primeiro clique de qualquer outra tela.
  useEffect(() => {
    let ativo = true;
    obterOpcoesDoScore()
      .then((carregadas) => {
        if (!ativo) return;
        definirOpcoes(carregadas);
        // O MÊS MAIS COMPLETO, que o servidor escolhe — e não o mais
        // recente. O CRM põe um mês na lista a cada interação registrada, e
        // as planilhas dos fornecedores chegam com atraso: abrir no último
        // mostrava quatro lentes vazias e um ISR que era o score de uma só.
        definirMes(
          (atual) =>
            atual ??
            carregadas.mes_sugerido ??
            carregadas.meses[carregadas.meses.length - 1] ??
            null,
        );
      })
      .catch((falha: unknown) => {
        if (!ativo) return;
        definirErro(falha instanceof Error ? falha.message : 'Não foi possível carregar.');
      });
    return () => {
      ativo = false;
    };
  }, []);

  // DEVOLVE A PROMESSA, e quem grava a espera: sem isso, quem edita dois
  // campos em seguida manda o segundo com a régua ANTERIOR — e a primeira
  // alteração some sem aviso, porque o payload é montado das props.
  const recarregar = useCallback(() => {
    if (!mes) return Promise.resolve();
    return Promise.all([obterScore(mes), obterSerieDoScore()])
      .then(([carregado, carregada]) => {
        definirIndice(carregado);
        definirSerie(carregada);
        definirErro(null);
      })
      .catch((falha: unknown) =>
        definirErro(falha instanceof Error ? falha.message : 'Não foi possível carregar.'),
      );
  }, [mes]);

  // O `void` NÃO É DECORATIVO: `recarregar` agora devolve promessa, para quem
  // grava esperar a régua nova, e um efeito que devolve promessa faz o React
  // tratá-la como função de limpeza.
  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  if (erro && !indice) return <FaixaDeErro mensagem={erro} />;
  if (!opcoes) return <Carregando rotulo="Carregando o Score…" />;
  if (!opcoes.meses.length) {
    return (
      <Vazio
        mensagem="Nenhum mês com dado"
        dica="O índice nasce quando as planilhas dos fornecedores são ingeridas, ou quando há interação com clima registrado no CRM."
      />
    );
  }
  if (!indice || !mes) return <Carregando rotulo="Calculando o índice…" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Secao
        titulo="Score Executivo"
        subtitulo="O Índice de Saúde Reputacional: uma nota por mês, média ponderada de cinco lentes. Vale para a companhia inteira — não segue os filtros do Painel."
        nivelDoTitulo={1}
      >
        {/* O SELETOR DE MÊS DESCEU DE `acao` PARA O CORPO. A tira de abas que
            ficava aqui subiu para a barra do cabeçalho — sem ela, a seção
            ficaria com cabeçalho e nada embaixo. */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 150 }}>
            <CampoQueCompleta
              rotulo="Mês"
              valor={mes}
              aoEscolher={(valor) => valor && definirMes(valor)}
              opcoes={[...opcoes.meses].reverse().map((m) => ({ valor: m, rotulo: m }))}
            />
          </div>
          {!indice.calibracao.padrao ? (
            <Chip
              rotulo="calibração ajustada"
              fundo="var(--atencao-bg)"
              texto="var(--atencao-fg)"
              titulo="A régua em vigor é diferente da de fábrica — ver a engrenagem do Score."
            />
          ) : null}
        </div>
      </Secao>

      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      {aba === 'geral' ? (
        <VisaoGeral
          indice={indice}
          serie={serie}
          aoAbrirLente={(codigo) => {
            definirLenteAberta(codigo);
            aoTrocarAba('lentes');
          }}
          aoTrocarMes={definirMes}
        />
      ) : null}

      {aba === 'lentes' ? (
        <DossieDaLente
          mes={mes}
          lente={lenteAberta}
          aoTrocarLente={definirLenteAberta}
        />
      ) : null}

      {aba === 'drivers' ? <DriversERiscos mes={mes} /> : null}

      {aba === 'metodologia' ? <Metodologia /> : null}
    </div>
  );
}

/* -- a visão geral ------------------------------------------------------------- */

function VisaoGeral({
  indice,
  serie,
  aoAbrirLente,
  aoTrocarMes,
}: {
  indice: IndiceDoScore;
  serie: PontoDaSerie[];
  aoAbrirLente: (codigo: string) => void;
  aoTrocarMes: (mes: string) => void;
}) {
  const ordenadas = lentesOrdenadas(indice.lentes);
  const sustenta = ordenadas[0];
  const corroi = ordenadas.filter((lente) => lente.score !== null).at(-1);
  // O DESTAQUE MORA AQUI, e não em cada metade: gráfico e lista são duas
  // vistas do mesmo conjunto, e cada um com o seu estado faria passar o mouse
  // na lista não acender a fatia — que é o único jeito de ligar a terceira
  // linha à segunda fatia, quando as larguras são diferentes.
  const [destacada, definirDestacada] = useState<string | null>(null);
  // A LENTE COMPARADA É ESTADO DE LEITURA, e não de calibração: ela não muda
  // número nenhum, só sobrepõe uma segunda curva. Guardá-la no servidor faria
  // duas pessoas olhando a mesma tela disputarem o gráfico uma da outra.
  const [comparada, definirComparada] = useState<string | null>(null);
  const jornada = jornadaDoIndice(serie, indice.mes, comparada);
  //: DUAS CONTAS, E NÃO UMA. "Medido por poucas lentes" e "fora da escala do
  //: eixo" eram ditos como se fossem a mesma coisa, e não são: um mês parcial
  //: costuma cair DENTRO do eixo, e quando não há nenhum mês completo são os
  //: parciais que REGEM o eixo. A frase antiga afirmava o oposto do desenho
  //: justamente na base nova — três meses, duas lentes cada —, que é a primeira
  //: coisa que um cliente vê.
  //:
  //: A CONTAGEM VEM DA JORNADA, e não de uma releitura da série com o `4`
  //: escrito à mão aqui: dois lugares decidindo o que é "parcial" é um a mais
  //: do que se consegue manter de acordo.
  const mesesParciais = jornada.pontos.filter((ponto) => ponto.parcial).length;
  const mesesForaDaEscala = jornada.pontos.filter((ponto) => ponto.foraDaEscala).length;
  //: O MESMO AVISO ONDE O NÚMERO É MAIOR. A Jornada já o carrega na etiqueta do
  //: ponto; aqui ele qualifica a faixa, que é a frase mais forte da tela —
  //: "Referência · reputação é ativo de valor" é uma afirmação sobre a
  //: companhia, e com quatro lentes sem medir ela descreve outra coisa.
  //: `coberturaDoMes` é a regra, e não um `< 4` reescrito: duas telas com
  //: cortes diferentes para o mesmo mês seria uma delas mentindo.
  const coberturaDoMesEmTela = coberturaDoMes(
    indice.lentes.filter((lente) => lente.score !== null).length,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Secao
        titulo="Cinco lentes, um índice"
        subtitulo={`Índice de Saúde Reputacional · ${indice.mes}`}
      >
        <Cartao>
          <div className="grade grade--mapa" style={{ gap: 24, alignItems: 'start' }}>
            <div>
              <RadialDasLentes
                lentes={indice.lentes}
                isr={indice.isr}
                faixa={indice.faixa}
                corDoIsr={corDaFaixa(indice.isr)}
                porPeso={indice.calibracao.radial_por_peso}
                destacada={destacada}
                aoDestacar={definirDestacada}
                aoAbrir={aoAbrirLente}
              />

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  marginTop: 14,
                }}
              >
                <ChipDeVariacao rotulo="vs. mês anterior" delta={indice.delta_mes} />
                <ChipDeVariacao rotulo="vs. início da série" delta={indice.delta_inicio} />
              </div>

              <LegendaDasFaixas />
            </div>

            <ListaDasLentes
              lentes={indice.lentes}
              destacada={destacada}
              aoDestacar={definirDestacada}
              aoAbrir={aoAbrirLente}
            />
          </div>
        </Cartao>
      </Secao>

      <Secao titulo="Leitura do período">
        <div className="grade grade--mapa" style={{ gap: 16, alignItems: 'start' }}>
          <Cartao>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{indice.leitura}</p>
            <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--cinza-2)' }}>
              {indice.faixa} · {indice.leitura_da_faixa}
            </p>
            {coberturaDoMesEmTela ? (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--atencao-fg)' }}>
                Medido por {coberturaDoMesEmTela} — a faixa acima descreve um mês
                que as outras não mediram.
              </p>
            ) : null}
          </Cartao>

          <div className="grade grade--2" style={{ gap: 16 }}>
            <Extremo rotulo="O que sustenta" lente={sustenta} />
            <Extremo rotulo="O que corrói" lente={corroi} />
          </div>
        </div>
      </Secao>

      <Secao
        titulo="Jornada do índice"
        subtitulo={jornada.resumo}
        acao={
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="kicker">Comparar com</span>
            <Chip
              rotulo="Só o índice"
              ativo={comparada === null}
              aoClicar={() => definirComparada(null)}
            />
            {indice.lentes
              .filter((lente) => lente.score !== null)
              .map((lente) => (
                <Chip
                  key={lente.codigo}
                  rotulo={lente.nome}
                  ativo={comparada === lente.codigo}
                  aoClicar={() =>
                    definirComparada(comparada === lente.codigo ? null : lente.codigo)
                  }
                />
              ))}
          </div>
        }
      >
        <Cartao>
          <JornadaDoIndice
            serie={serie}
            mes={indice.mes}
            comparada={comparada}
            nomeDaComparada={
              indice.lentes.find((lente) => lente.codigo === comparada)?.nome ?? ''
            }
            aoEscolherMes={aoTrocarMes}
          />
          <div
            style={{
              display: 'flex',
              gap: 14,
              flexWrap: 'wrap',
              alignItems: 'center',
              marginTop: 16,
              fontSize: 11.5,
              color: 'var(--cinza-2)',
            }}
          >
            {[
              ['Pressiona', 'var(--erro-fg)'],
              ['Sustenta', 'var(--turquesa-rio)'],
              ['Misto', 'var(--cinza-2)'],
              ['Sem fato', 'var(--borda)'],
            ].map(([rotulo, cor]) => (
              <span key={rotulo} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 16, height: 3, borderRadius: 2, background: cor }} />
                {rotulo}
              </span>
            ))}
            {mesesParciais ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: '50%',
                    border: '2px dashed var(--cinza-2)',
                  }}
                />
                {fraseDosParciais(
                  mesesParciais,
                  mesesForaDaEscala,
                  jornada.eixoRegidoPorParciais,
                )}
              </span>
            ) : null}
            {/* ENSINA O GESTO, porque ele deixou de ser só o clique: o detalhe
                do mês agora se pede apontando. Sem esta linha, quem abre a tela
                vê uma fita de cores e não descobre que há texto atrás dela. */}
            <span>
              Aponte um mês para ver o que aconteceu nele; clique para abrir a
              lente e o radial daquele mês.
            </span>
          </div>
        </Cartao>
      </Secao>
    </div>
  );
}

/** A lista das cinco lentes, ao lado do gráfico.
 *
 *  ABRE PELO STAKEHOLDER, e não pelo nome da lente: quem lê o índice pergunta
 *  "de quem é este 37?" antes de perguntar de que fonte ele saiu. O nome da
 *  lente é jargão da ferramenta; "Formadores de opinião" é gente.
 */
function ListaDasLentes({
  lentes,
  destacada,
  aoDestacar,
  aoAbrir,
}: {
  lentes: LenteDoScore[];
  destacada: string | null;
  aoDestacar: (codigo: string | null) => void;
  aoAbrir: (codigo: string) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lentes.map((lente) => (
          <button
            key={lente.codigo}
            type="button"
            onMouseEnter={() => aoDestacar(lente.codigo)}
            onMouseLeave={() => aoDestacar(null)}
            onFocus={() => aoDestacar(lente.codigo)}
            onBlur={() => aoDestacar(null)}
            onClick={() => aoAbrir(lente.codigo)}
            title={`Abrir a lente ${lente.nome}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '14px minmax(0, 1fr) auto',
              gap: 14,
              alignItems: 'center',
              padding: '12px 14px',
              borderRadius: 12,
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              font: 'inherit',
              background: destacada === lente.codigo ? 'var(--bg-trilho)' : 'var(--branco)',
              border: `1px solid ${
                destacada === lente.codigo ? 'var(--azul-mar)' : 'var(--borda)'
              }`,
              opacity: lente.score === null ? 0.55 : 1,
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 4,
                background: corDeAreaDaFaixa(lente.score),
              }}
            />
            <span style={{ minWidth: 0 }}>
              {/* EM LINHA PRÓPRIA, e com reticências: na mesma linha da fonte
                  ele cobria o texto ao lado quando o nome era comprido. */}
              <span
                className="kicker"
                style={{
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {lente.stakeholder}
              </span>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>
                {lente.nome}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: 11.5,
                  color: 'var(--cinza-2)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {pesoDaLente(lente)}
                {lente.fontes.length ? ` · ${lente.fontes.join(', ')}` : ''}
              </span>
            </span>
            <span style={{ textAlign: 'right' }}>
              <span
                className="tabular"
                style={{
                  display: 'block',
                  fontSize: 26,
                  fontWeight: 800,
                  lineHeight: 1,
                  color: corDaFaixa(lente.score),
                }}
              >
                {lente.score ?? '—'}
              </span>
              <span style={{ fontSize: 11.5, color: corDoDelta(lente.delta) }}>
                {comoDelta(lente.delta)}
              </span>
            </span>
          </button>
        ))}
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--cinza-2)', margin: '10px 0 0' }}>
        Passe o mouse para destacar a fatia; clique para abrir a lente.
      </p>
    </div>
  );
}

/** A legenda das cinco faixas, com a cor da fatia e o limite de cada uma. */
function LegendaDasFaixas() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginTop: 12,
      }}
    >
      {[...FAIXAS].reverse().map((faixa, posicao, todas) => (
        <span
          key={faixa.rotulo}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5 }}
        >
          <span
            style={{ width: 10, height: 10, borderRadius: 3, background: faixa.area }}
          />
          {faixa.rotulo}
          <span style={{ color: 'var(--cinza-2)' }}>
            {posicao === todas.length - 1
              ? `≥ ${faixa.minimo}`
              : `${faixa.minimo}–${todas[posicao + 1].minimo - 1}`}
          </span>
        </span>
      ))}
    </div>
  );
}

/** A variação do índice, num chip legível sobre fundo branco.
 *
 *  ERA TEXTO COLORIDO SOBRE O CARTÃO AZUL. No fundo branco do bloco novo o
 *  mesmo tom quase não aparecia — e uma variação que não se lê é uma variação
 *  que não existe. */
function ChipDeVariacao({ rotulo, delta }: { rotulo: string; delta: number | null }) {
  const sobe = delta !== null && delta > 0;
  const cai = delta !== null && delta < 0;
  return (
    <Chip
      rotulo={`${comoDelta(delta)} ${rotulo}`}
      fundo={sobe ? 'var(--ok-bg)' : cai ? 'var(--erro-bg)' : 'var(--bg-trilho)'}
      texto={sobe ? 'var(--ok-fg)' : cai ? 'var(--erro-fg)' : 'var(--cinza-3)'}
    />
  );
}

/** A lente que mais sustenta, ou a que mais corrói. */
function Extremo({ rotulo, lente }: { rotulo: string; lente: LenteDoScore | undefined }) {
  return (
    <Cartao>
      <p className="kicker" style={{ marginBottom: 6 }}>
        {rotulo}
      </p>
      {lente?.score != null ? (
        <>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{lente.nome}</div>
          <div style={{ fontSize: 13, color: 'var(--cinza-2)' }}>
            {lente.score} · peso {pesoDaLente(lente)}
          </div>
        </>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>
          Nenhuma lente medida.
        </p>
      )}
    </Cartao>
  );
}

/* -- drivers e riscos ---------------------------------------------------------- */

function DriversERiscos({ mes }: { mes: string }) {
  const [drivers, definirDrivers] = useState<DriversDoScore | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    definirDrivers(null);
    definirErro(null);
    obterDriversDoScore(mes)
      .then((carregado) => ativo && definirDrivers(carregado))
      .catch((falha) => {
        if (ativo) {
          definirErro(falha instanceof Error ? falha.message : 'Não foi possível ler.');
        }
      });
    return () => {
      ativo = false;
    };
  }, [mes]);

  if (erro) return <FaixaDeErro mensagem={erro} />;
  if (!drivers) return <Carregando />;

  // SEM MENÇÃO INDIVIDUAL, NENHUMA DAS TRÊS LEITURAS EXISTE — e o motivo não é
  // "não houve nada": é que a planilha do mês não foi importada. Dizer isso é o
  // que separa um mês tranquilo de um mês sem dado.
  if (!drivers.mencoes_no_mes) {
    // DOIS MOTIVOS PARA A MESMA TELA VAZIA, e mandar importar uma planilha que
    // já está no banco faria a pessoa procurar o problema no lugar errado.
    const tudoDesligado = drivers.fontes_ligadas === 0;
    return (
      <Secao titulo="Drivers e riscos">
        <Vazio
          mensagem={
            tudoDesligado
              ? `Todas as fontes de planilha estão desligadas na calibração`
              : `Sem menções individuais em ${mes}`
          }
          dica={
            tudoDesligado
              ? 'Religue ao menos uma fonte na aba Calibração para ver de que se falou no mês.'
              : 'Atributo, unidade e perpetuação se calculam menção a menção. Importe a planilha do mês na aba Calibração — o índice e as lentes já funcionam com os totais, e estas três leituras acendem com o detalhe.'
          }
        />
      </Secao>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Secao
        titulo="O que se repete"
        subtitulo={`Temas negativos presentes em ${drivers.regra_da_perpetuacao.meses_para_perpetuar} meses ou mais da janela de ${drivers.regra_da_perpetuacao.meses_da_janela}, e ainda vivos em ${mes}. Um assunto que explode e some é ruído; o que volta todo mês é posição consolidada.`}
      >
        <Cartao>
          {drivers.perpetuacao.length ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {drivers.perpetuacao.map((tema) => (
                <li
                  key={tema.tema}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 12,
                    padding: '10px 0',
                    borderTop: '1px solid var(--borda)',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{tema.tema}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--cinza-2)' }}>
                    {tema.lentes.join(' · ')}
                  </span>
                  <Chip rotulo={`${tema.meses} meses`} />
                  <span
                    className="tabular"
                    style={{ fontSize: 12, color: 'var(--erro-fg)', minWidth: 72, textAlign: 'right' }}
                  >
                    −{numero(tema.negativas)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>
              Nenhum tema negativo atravessou{' '}
              {drivers.regra_da_perpetuacao.meses_para_perpetuar} meses até aqui. É uma boa
              notícia — e some da tela quando deixar de ser verdade.
            </p>
          )}
        </Cartao>
      </Secao>

      <Secao
        titulo="O que atribuem à companhia"
        subtitulo="O atributo reputacional que a clipagem marca em cada matéria ou post. Contagem simples: aqui a pergunta é o tom, e não quanto a menção pesou no índice."
      >
        <Cartao>
          <BarraDivergentePorItem
            itens={drivers.atributos.map((atributo) => ({
              chave: atributo.nome,
              rotulo: atributo.nome,
              total: atributo.positivo + atributo.neutro + atributo.negativo,
              // A BARRA FALA EM SALDO, de −100 a +100, e não no score de 0 a
              // 100: o que ela mostra é de que lado o atributo está, e o zero
              // precisa cair no eixo. `score` (50 no equilíbrio) desenharia
              // tudo à direita.
              score: Math.round(atributo.ns * 100),
            }))}
            unidade={{ singular: 'menção', plural: 'menções' }}
            vazio="Nenhuma menção do mês traz atributo classificado."
          />
          <p style={{ fontSize: 11.5, color: 'var(--cinza-2)', margin: '10px 0 0' }}>
            Só Clipei e Bites classificam atributo. As outras fontes não entram nesta leitura —
            e não entram como zero, que seria dizer que elas acharam neutro.
          </p>
        </Cartao>
      </Secao>

      <Secao
        titulo="Onde a pressão se concentra"
        subtitulo="Menções negativas por concessionária. Ordenado pelo negativo, e não pelo volume: a pergunta é onde está o problema."
      >
        <Cartao>
          <Ranking
            itens={drivers.unidades.map((unidade) => ({
              chave: unidade.nome,
              rotulo: unidade.nome,
              total: unidade.negativas,
              cor: 'var(--erro-fg)',
            }))}
            cor="var(--erro-fg)"
            vazio="Nenhuma menção do mês identifica a unidade."
            detalheAoPassarMouse={(chave) => {
              const unidade = drivers.unidades.find((u) => u.nome === chave);
              if (!unidade) return [];
              return [
                { rotulo: 'Negativas', valor: numero(unidade.negativas) },
                { rotulo: 'Menções no mês', valor: numero(unidade.mencoes) },
                { rotulo: 'Do negativo total', valor: `${unidade.participacao}%` },
              ];
            }}
          />
          <p style={{ fontSize: 11.5, color: 'var(--cinza-2)', margin: '10px 0 0' }}>
            Só as fontes que identificam a concessionária entram: as redes e os canais
            próprios. A clipagem de imprensa marca a companhia inteira em toda matéria, e
            somá-la aqui criaria uma barra chamada &ldquo;Aegea&rdquo; maior que todas as
            outras sem dizer nada. Cada fornecedor nomeia a unidade do seu jeito, e o cadastro
            da fonte reconcilia o que dá — prefixo e apelido. Onde um agrupa duas
            concessionárias e o outro as separa, elas ficam em linhas distintas: juntar seria
            inventar um número que ninguém mediu.
          </p>
        </Cartao>
      </Secao>
    </div>
  );
}


/* -- a metodologia -------------------------------------------------------------- */

//: A COBERTURA É DECLARADA, e não calculada: ela diz o que ESTE índice cumpre
//: do que se espera de um índice reputacional, e quem responde por isso é quem
//: o construiu — não uma consulta. Muda com o produto, e por isso mora na tela.
const COBERTURA: { criterio: string; status: string; fundo: string; cor: string }[] = [
  {
    criterio: 'Múltiplos stakeholders — imprensa, mercado, sociedade, clientes, governo',
    status: 'Coberto',
    fundo: 'var(--ok-bg)',
    cor: 'var(--ok-fg)',
  },
  {
    criterio: 'Agregação de várias fontes na mesma lente',
    status: 'Coberto',
    fundo: 'var(--ok-bg)',
    cor: 'var(--ok-fg)',
  },
  {
    criterio: 'Série histórica comparável — a régua de hoje vale para todos os meses',
    status: 'Coberto',
    fundo: 'var(--ok-bg)',
    cor: 'var(--ok-fg)',
  },
  {
    criterio: 'Sentimento com drivers: atributo, tema e unidade',
    status: 'Coberto',
    fundo: 'var(--ok-bg)',
    cor: 'var(--ok-fg)',
  },
  {
    criterio: 'Temas em perpetuação — o risco que atravessa meses',
    status: 'Coberto',
    fundo: 'var(--ok-bg)',
    cor: 'var(--ok-fg)',
  },
  {
    criterio: 'Alerta automático quando um tema muda de patamar',
    status: 'A integrar',
    fundo: 'var(--cinza-0)',
    cor: 'var(--cinza-2)',
  },
  {
    criterio: 'Comparação com pares do setor (share of voice)',
    status: 'A integrar',
    fundo: 'var(--cinza-0)',
    cor: 'var(--cinza-2)',
  },
  {
    criterio: 'Ligação com resultado de negócio — rating, spread, valor',
    status: 'A integrar',
    fundo: 'var(--cinza-0)',
    cor: 'var(--cinza-2)',
  },
];

function Metodologia() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Secao titulo="Como o índice é calculado">
        <Cartao>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
            <li>
              Para cada lente e cada mês, somam-se as menções positivas, neutras e negativas —
              já ponderadas pela régua em vigor.
            </li>
            <li>
              <strong>NS = (positivas − negativas) ÷ total.</strong> Total zero é{' '}
              <em>sem dado</em>, e não zero: uma lente que ninguém mediu não é uma lente
              neutra.
            </li>
            <li>
              <strong>score = (NS + 1) ÷ 2 × 100</strong>, de 0 a 100.
            </li>
            <li>
              Com mais de uma fonte na mesma lente, o score é a <strong>média simples dos
              NS</strong> das fontes ligadas — a que classifica mais posts não decide a lente
              sozinha.
            </li>
            <li>
              <strong>ISR = Σ (score × peso) ÷ Σ peso</strong>, sobre as lentes com dado. Lente
              sem dado sai do numerador <em>e</em> do denominador: o índice não pode cair por
              falta de medição.
            </li>
          </ol>
        </Cartao>
      </Secao>

      <Secao
        titulo="Cobertura do framework"
        subtitulo="Os critérios que se espera de um índice de saúde reputacional, e onde este está."
      >
        <Cartao>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {COBERTURA.map((item) => (
              <li
                key={item.criterio}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 12,
                  padding: '9px 0',
                  borderTop: '1px solid var(--borda)',
                }}
              >
                <span style={{ fontSize: 13, flex: 1 }}>{item.criterio}</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: 5,
                    whiteSpace: 'nowrap',
                    background: item.fundo,
                    color: item.cor,
                  }}
                >
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
        </Cartao>
      </Secao>

      <Secao
        titulo="O que ainda não está integrado"
        subtitulo="Declarado na tela de propósito: um índice que esconde as próprias lacunas é pior do que um índice incompleto."
      >
        <Cartao>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
            <li>
              <strong>O vocabulário dos fornecedores</strong> ainda não foi casado com o
              dicionário de temas e unidades do CRM. A tela mostra o rótulo como cada um o
              escreve, reconciliado só onde o cadastro da fonte declara.
            </li>
            <li>
              <strong>Meses sem export</strong> usam a estimativa do resumo semestral, marcada
              com o selo <em>estimado</em> na lente.
            </li>
            <li>
              <strong>Mercado é proxy</strong> — a imprensa econômica de Tier 1 — até integrar
              rating e spread de debêntures.
            </li>
            <li>
              <strong>Pendentes:</strong> share of voice de pares, Reclame Aqui,
              Consumidor.gov e Google.
            </li>
          </ul>
        </Cartao>
      </Secao>
    </div>
  );
}
