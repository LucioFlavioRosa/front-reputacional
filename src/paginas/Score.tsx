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

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  gravarCalibracao,
  importarPlanilhaDoScore,
  obterDriversDoScore,
  listarFontesDoScore,
  obterLenteDoScore,
  obterOpcoesDoScore,
  obterScore,
  obterSerieDoScore,
  restaurarCalibracaoPadrao,
} from '@/api/cliente';
import { Abas } from '@/componentes/Abas';
import {
  Botao,
  Campo,
  Carregando,
  Cartao,
  Chip,
  FaixaDeErro,
  Secao,
  Vazio,
  estiloDeEntrada,
} from '@/componentes/basicos';
import { CampoQueCompleta } from '@/componentes/CampoQueCompleta';
import { BarraDivergentePorItem } from '@/graficos/BarraDivergentePorItem';
import { Legenda } from '@/graficos/BarrasEmpilhadas';
import { Ranking } from '@/graficos/Ranking';
import { Rosca } from '@/graficos/Rosca';
import { numero } from '@/dominio/formato';
import {
  ROTULO_DA_REGUA_DE_ENGAJAMENTO,
  ROTULO_DA_REGUA_DE_TIER,
  ROTULO_DO_AVISO,
  ROTULO_DO_DESCARTE,
  ROTULO_DO_EFEITO,
  pesoDaLente,
  colunasDaSerie,
  comoDelta,
  corDaFaixa,
  corDoDelta,
  lentesOrdenadas,
  segmentosDaComposicao,
} from '@/dominio/score';
import type {
  Calibracao,
  DriversDoScore,
  FonteDoScore,
  ImportacaoDoScore,
  IndiceDoScore,
  LenteDetalhada,
  OpcoesDoScore,
  PontoDaSerie,
} from '@/dominio/score';

const ABAS = [
  { id: 'geral' as const, rotulo: 'Visão geral' },
  { id: 'lentes' as const, rotulo: 'Lentes' },
  { id: 'drivers' as const, rotulo: 'Drivers e riscos' },
  { id: 'calibracao' as const, rotulo: 'Calibração' },
  { id: 'metodologia' as const, rotulo: 'Metodologia' },
];

type AbaDoScore = (typeof ABAS)[number]['id'];

export function Score() {
  const [mes, definirMes] = useState<string | null>(null);
  const [aba, definirAba] = useState<AbaDoScore>('geral');
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
        // O mês mais recente com dado: abrir num mês vazio faria a tela
        // parecer quebrada.
        definirMes((atual) => atual ?? carregadas.meses[carregadas.meses.length - 1] ?? null);
      })
      .catch((falha: unknown) => {
        if (!ativo) return;
        definirErro(falha instanceof Error ? falha.message : 'Não foi possível carregar.');
      });
    return () => {
      ativo = false;
    };
  }, []);

  const recarregar = useCallback(() => {
    if (!mes) return;
    Promise.all([obterScore(mes), obterSerieDoScore()])
      .then(([carregado, carregada]) => {
        definirIndice(carregado);
        definirSerie(carregada);
        definirErro(null);
      })
      .catch((falha: unknown) =>
        definirErro(falha instanceof Error ? falha.message : 'Não foi possível carregar.'),
      );
  }, [mes]);

  useEffect(recarregar, [recarregar]);

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
        acao={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {!indice.calibracao.padrao ? (
              <Chip
                rotulo="calibração ajustada"
                fundo="var(--atencao-bg)"
                texto="var(--atencao-fg)"
                titulo="A régua em vigor é diferente da de fábrica — ver a aba Calibração."
              />
            ) : null}
            <div style={{ minWidth: 150 }}>
              <CampoQueCompleta
                rotulo="Mês"
                valor={mes}
                aoEscolher={(valor) => valor && definirMes(valor)}
                opcoes={[...opcoes.meses].reverse().map((m) => ({ valor: m, rotulo: m }))}
              />
            </div>
          </div>
        }
      >
        <Abas
          abas={ABAS}
          ativa={aba}
          aoTrocar={definirAba}
          rotulo="O que o Score mostra"
          prefixo="score"
        />
      </Secao>

      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      {aba === 'geral' ? (
        <VisaoGeral
          indice={indice}
          serie={serie}
          aoAbrirLente={(codigo) => {
            definirLenteAberta(codigo);
            definirAba('lentes');
          }}
        />
      ) : null}

      {aba === 'lentes' ? (
        <Lentes
          indice={indice}
          mes={mes}
          aberta={lenteAberta}
          aoTrocar={definirLenteAberta}
        />
      ) : null}

      {aba === 'drivers' ? <DriversERiscos mes={mes} /> : null}

      {aba === 'calibracao' ? (
        <CalibracaoDoScore
          mes={mes}
          opcoes={opcoes}
          calibracao={indice.calibracao}
          aoMudar={recarregar}
        />
      ) : null}

      {aba === 'metodologia' ? <Metodologia /> : null}
    </div>
  );
}

/* -- aba 1: a visão geral ----------------------------------------------------- */

function VisaoGeral({
  indice,
  serie,
  aoAbrirLente,
}: {
  indice: IndiceDoScore;
  serie: PontoDaSerie[];
  aoAbrirLente: (codigo: string) => void;
}) {
  const ordenadas = lentesOrdenadas(indice.lentes);
  const sustenta = ordenadas[0];
  const corroi = ordenadas.filter((lente) => lente.score !== null).at(-1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Secao titulo={`O índice em ${indice.mes}`} subtitulo={indice.leitura}>
        <div className="grade grade--mapa" style={{ gap: 16, alignItems: 'start' }}>
          <Cartao>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
              <span
                style={{
                  fontSize: 64,
                  fontWeight: 800,
                  lineHeight: 1,
                  color: corDaFaixa(indice.isr),
                }}
                className="tabular"
              >
                {indice.isr ?? '—'}
              </span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{indice.faixa}</div>
                <div style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
                  {indice.leitura_da_faixa}
                </div>
              </div>
            </div>

            <Regua score={indice.isr} />

            <div style={{ display: 'flex', gap: 18, marginTop: 14 }}>
              <Variacao rotulo="vs. mês anterior" delta={indice.delta_mes} />
              <Variacao rotulo="vs. início da série" delta={indice.delta_inicio} />
            </div>
          </Cartao>

          <div className="grade grade--2" style={{ gap: 16 }}>
            <Cartao>
              <p className="kicker" style={{ marginBottom: 6 }}>
                O que sustenta
              </p>
              {sustenta?.score != null ? (
                <>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{sustenta.nome}</div>
                  <div style={{ fontSize: 13, color: 'var(--cinza-2)' }}>
                    {sustenta.score} · peso {pesoDaLente(sustenta)}
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>
                  Nenhuma lente medida.
                </p>
              )}
            </Cartao>
            <Cartao>
              <p className="kicker" style={{ marginBottom: 6 }}>
                O que corrói
              </p>
              {corroi?.score != null ? (
                <>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{corroi.nome}</div>
                  <div style={{ fontSize: 13, color: 'var(--cinza-2)' }}>
                    {corroi.score} · peso {pesoDaLente(corroi)}
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>—</p>
              )}
            </Cartao>
          </div>
        </div>
      </Secao>

      <Secao
        titulo="As cinco lentes"
        subtitulo="Clique numa lente para ver a composição, a fórmula aplicada e os temas."
      >
        <div className="grade grade--3" style={{ gap: 14 }}>
          {indice.lentes.map((lente) => (
            // `Cartao` clicável, e não um `<button>` com `all: unset` por
            // dentro: o `unset` apagava junto o anel de foco, e o cartão
            // inteiro ficava inalcançável por teclado. O componente da casa já
            // trata `role`, `tabIndex` e Enter/Espaço.
            <Cartao
              key={lente.codigo}
              estilo={{ padding: 16 }}
              aoClicar={() => aoAbrirLente(lente.codigo)}
              titulo={`Abrir a lente ${lente.nome}`}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span
                    className="tabular"
                    style={{ fontSize: 30, fontWeight: 800, color: corDaFaixa(lente.score) }}
                  >
                    {lente.score ?? '—'}
                  </span>
                  <span style={{ fontSize: 12, color: corDoDelta(lente.delta) }}>
                    {comoDelta(lente.delta)}
                  </span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{lente.nome}</div>
                <div style={{ fontSize: 11.5, color: 'var(--cinza-2)', marginTop: 2 }}>
                  peso {pesoDaLente(lente)}
                  {lente.fontes.length ? ` · ${lente.fontes.join(', ')}` : ''}
                </div>
                {lente.estimado ? (
                  <Chip
                    rotulo="estimado"
                    fundo="var(--atencao-bg)"
                    texto="var(--atencao-fg)"
                    titulo="Sem export no mês: o número vem do resumo semestral."
                    estilo={{ marginTop: 8 }}
                  />
                ) : null}
                {lente.ausencia ? (
                  <p style={{ fontSize: 11.5, color: 'var(--atencao-fg)', margin: '8px 0 0' }}>
                    {lente.ausencia}
                  </p>
                ) : null}
              </div>
            </Cartao>
          ))}
        </div>
      </Secao>

      <Secao
        titulo="Evolução mensal"
        subtitulo="Todos os meses com a régua de hoje — é o que torna a curva comparável. Meses medidos por menos de quatro lentes ficam esmaecidos."
      >
        <div className="grade grade--mapa" style={{ gap: 16, alignItems: 'start' }}>
          <Cartao>
            <Ranking itens={colunasDaSerie(serie)} vazio="Sem série ainda." />
            <p style={{ fontSize: 11.5, color: 'var(--cinza-2)', margin: '10px 0 0' }}>
              {serie.filter((ponto) => ponto.lentes < 4).length} de {serie.length} meses têm
              menos de quatro lentes medidas.
            </p>
          </Cartao>

          <Cartao>
            <p className="kicker" style={{ marginBottom: 10 }}>
              O que aconteceu em {indice.mes}
            </p>
            {indice.fatos.length ? (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {indice.fatos.map((fato) => (
                  <li
                    key={fato.id}
                    style={{ padding: '8px 0', borderTop: '1px solid var(--borda)' }}
                  >
                    <Chip
                      rotulo={ROTULO_DO_EFEITO[fato.efeito] ?? fato.efeito}
                      fundo={
                        fato.efeito === 'sustenta'
                          ? 'var(--ok-bg)'
                          : fato.efeito === 'pressiona'
                            ? 'var(--erro-bg)'
                            : 'var(--bg-trilho)'
                      }
                      texto={
                        fato.efeito === 'sustenta'
                          ? 'var(--ok-fg)'
                          : fato.efeito === 'pressiona'
                            ? 'var(--erro-fg)'
                            : 'var(--cinza-3)'
                      }
                    />
                    <p style={{ fontSize: 13, margin: '4px 0 0' }}>{fato.texto}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>
                Nenhum fato registrado. É o que transforma a curva em explicação — "caiu em
                março porque saíram as demonstrações financeiras".
              </p>
            )}
          </Cartao>
        </div>
      </Secao>
    </div>
  );
}

/** A régua de 0 a 100 com o marcador onde o índice caiu. */
function Regua({ score }: { score: number | null }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          position: 'relative',
          height: 8,
          borderRadius: 4,
          background:
            'linear-gradient(90deg, var(--erro-fg) 0%, var(--atencao-fg) 40%, var(--azul-mar) 55%, var(--ok-fg) 70%)',
        }}
      >
        {score === null ? null : (
          <div
            style={{
              position: 'absolute',
              left: `calc(${Math.min(100, Math.max(0, score))}% - 6px)`,
              top: -4,
              width: 12,
              height: 16,
              borderRadius: 3,
              background: 'var(--branco)',
              border: '2px solid var(--cinza-4)',
            }}
          />
        )}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10.5,
          color: 'var(--cinza-2)',
          marginTop: 4,
        }}
      >
        <span>Crítico</span>
        <span>Atenção</span>
        <span>Estável</span>
        <span>Sólido</span>
        <span>Referência</span>
      </div>
    </div>
  );
}

function Variacao({ rotulo, delta }: { rotulo: string; delta: number | null }) {
  return (
    <div>
      <div className="kicker">{rotulo}</div>
      <div
        className="tabular"
        style={{ fontSize: 18, fontWeight: 700, color: corDoDelta(delta) }}
      >
        {comoDelta(delta)}
      </div>
    </div>
  );
}

/* -- aba 2: as lentes por dentro ---------------------------------------------- */

function Lentes({
  indice,
  mes,
  aberta,
  aoTrocar,
}: {
  indice: IndiceDoScore;
  mes: string;
  aberta: string;
  aoTrocar: (codigo: string) => void;
}) {
  const [detalhe, definirDetalhe] = useState<LenteDetalhada | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    definirDetalhe(null);
    obterLenteDoScore(aberta, mes)
      .then((carregado) => ativo && definirDetalhe(carregado))
      .catch((falha: unknown) => {
        if (!ativo) return;
        definirErro(falha instanceof Error ? falha.message : 'Não foi possível carregar.');
      });
    return () => {
      ativo = false;
    };
  }, [aberta, mes]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Abas
        abas={indice.lentes.map((lente) => ({ id: lente.codigo, rotulo: lente.nome }))}
        ativa={aberta}
        aoTrocar={aoTrocar}
        rotulo="Qual lente"
        prefixo="lente"
      />

      {erro ? <FaixaDeErro mensagem={erro} /> : null}
      {!detalhe ? (
        <Carregando rotulo="Abrindo a lente…" />
      ) : (
        <Secao
          titulo={`${detalhe.nome} · ${detalhe.stakeholder}`}
          subtitulo={detalhe.formula}
        >
          <div className="grade grade--2" style={{ gap: 16, alignItems: 'start' }}>
            <Cartao>
              <p className="kicker" style={{ marginBottom: 10 }}>
                Composição do mês, já ponderada
              </p>
              <Rosca
                itens={segmentosDaComposicao(detalhe.composicao)}
                rotuloCentral={detalhe.score !== null ? 'score' : undefined}
                vazio="Sem menção classificada neste mês."
              />
              <Legenda itens={segmentosDaComposicao(detalhe.composicao)} centralizada />
              {detalhe.ausencia ? (
                <p style={{ fontSize: 12, color: 'var(--atencao-fg)', margin: '10px 0 0' }}>
                  {detalhe.ausencia}
                </p>
              ) : null}
            </Cartao>

            <Cartao>
              <p className="kicker" style={{ marginBottom: 10 }}>
                Fontes desta lente
              </p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {detalhe.fontes.map((fonte) => (
                  <li
                    key={fonte.codigo}
                    style={{
                      padding: '8px 0',
                      borderTop: '1px solid var(--borda)',
                      opacity: fonte.ligada ? 1 : 0.5,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
                        {fonte.nome}
                      </span>
                      <span className="tabular" style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
                        {fonte.ns === null ? 'sem dado' : `NS ${fonte.ns.toFixed(2)}`}
                        {fonte.mencoes ? ` · ${numero(fonte.mencoes)}` : ''}
                      </span>
                    </div>
                    {!fonte.ligada ? (
                      <span style={{ fontSize: 11.5, color: 'var(--atencao-fg)' }}>
                        desligada na calibração
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p style={{ fontSize: 11.5, color: 'var(--cinza-2)', margin: '10px 0 0' }}>
                Com mais de uma fonte, a lente é a <strong>média simples dos NS</strong> — e
                não a soma das contagens: a fonte que classifica mais posts decidiria a lente
                sozinha.
              </p>
            </Cartao>
          </div>

          <div style={{ marginTop: 16 }}>
            <Cartao>
              <p className="kicker" style={{ marginBottom: 10 }}>
                Temas mais falados
              </p>
              {detalhe.temas.length ? (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {detalhe.temas.map((tema) => (
                    <li
                      key={tema.nome}
                      style={{ padding: '8px 0', borderTop: '1px solid var(--borda)' }}
                    >
                      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
                          {tema.nome}
                        </span>
                        {tema.tipo ? (
                          <Chip
                            rotulo={tema.tipo === 'estruturante' ? 'Estruturante' : 'Operacional'}
                          />
                        ) : null}
                        <span className="tabular" style={{ fontSize: 12 }}>
                          <span style={{ color: 'var(--ok-fg)' }}>+{tema.positivo}</span>
                          {' · '}
                          <span style={{ color: 'var(--erro-fg)' }}>−{tema.negativo}</span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>
                  Os temas saem das menções, uma a uma — e elas chegam com a ingestão das
                  planilhas dos fornecedores. O índice já funciona sem elas, porque lê os
                  totais do mês; a leitura por tema é o que ainda falta.
                </p>
              )}
            </Cartao>
          </div>
        </Secao>
      )}
    </div>
  );
}

/* -- aba 3: drivers e riscos --------------------------------------------------- */

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


/* -- aba 4: a calibração -------------------------------------------------------- */

//: A RÉGUA É CONFIGURAÇÃO DA ORGANIZAÇÃO, e não preferência de quem olha:
//: mudar aqui muda o número que todo mundo lê. Por isso é versionada e só
//: quem administra cadastros grava — o servidor recusa o resto.
function CalibracaoDoScore({
  mes,
  opcoes,
  calibracao,
  aoMudar,
}: {
  mes: string;
  opcoes: OpcoesDoScore;
  calibracao: Calibracao;
  aoMudar: () => void;
}) {
  const [fontes, definirFontes] = useState<FonteDoScore[]>([]);
  const [erro, definirErro] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);
  const [importando, definirImportando] = useState<string | null>(null);
  const entradaDePlanilha = useRef<HTMLInputElement>(null);
  //: Qual fonte pediu o arquivo. Em `ref`, e não em estado: ele é lido no
  //: `change` do input e não precisa redesenhar nada ao mudar.
  const fonteEscolhida = useRef<string | null>(null);
  const [importado, definirImportado] = useState<ImportacaoDoScore[] | null>(null);

  useEffect(() => {
    let ativo = true;
    listarFontesDoScore(mes)
      .then((carregadas) => ativo && definirFontes(carregadas))
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [mes, calibracao]);

  async function gravar(mudanca: Partial<Calibracao>) {
    definirSalvando(true);
    definirErro(null);
    try {
      await gravarCalibracao({
        pesos: mudanca.pesos ?? calibracao.pesos,
        regua_tier: mudanca.regua_tier ?? calibracao.regua_tier,
        regua_engajamento: mudanca.regua_engajamento ?? calibracao.regua_engajamento,
        fontes_desligadas: mudanca.fontes_desligadas ?? calibracao.fontes_desligadas,
      });
      aoMudar();
    } catch (falha) {
      definirErro(falha instanceof Error ? falha.message : 'Não foi possível gravar.');
    } finally {
      definirSalvando(false);
    }
  }

  function escolherPlanilha(codigo: string) {
    fonteEscolhida.current = codigo;
    entradaDePlanilha.current?.click();
  }

  async function importar(codigo: string, arquivo: File) {
    definirImportando(codigo);
    definirErro(null);
    definirImportado(null);
    try {
      definirImportado(await importarPlanilhaDoScore(codigo, arquivo));
      // O índice do mês muda com o arquivo: recarregar a página inteira é o
      // que impede a tela de mostrar o número velho ao lado do resumo novo.
      aoMudar();
    } catch (falha) {
      definirErro(
        falha instanceof Error ? falha.message : 'Não foi possível ler a planilha.',
      );
    } finally {
      definirImportando(null);
    }
  }

  const alternarFonte = (codigo: string) =>
    gravar({
      fontes_desligadas: calibracao.fontes_desligadas.includes(codigo)
        ? calibracao.fontes_desligadas.filter((f) => f !== codigo)
        : [...calibracao.fontes_desligadas, codigo],
    });

  const mudarPeso = (lente: string, passo: number) => {
    const atual = calibracao.pesos[lente] ?? 0;
    const proximo = Math.min(60, Math.max(0, atual + passo));
    if (proximo === atual) return;
    gravar({ pesos: { ...calibracao.pesos, [lente]: proximo } });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      <Secao
        titulo="Régua de ponderação"
        subtitulo="Mudar aqui recalcula o índice inteiro, de todos os meses — e fica gravado como uma versão nova, com autor e data."
        acao={
          <Botao
            variante="secundario"
            aoClicar={() =>
              restaurarCalibracaoPadrao()
                .then(aoMudar)
                .catch((falha: unknown) =>
                  definirErro(
                    falha instanceof Error ? falha.message : 'Não foi possível restaurar.',
                  ),
                )
            }
            desabilitado={salvando || calibracao.padrao}
          >
            Restaurar padrão
          </Botao>
        }
      >
        <div className="grade grade--2" style={{ gap: 16, alignItems: 'start' }}>
          <Cartao>
            <Campo
              rotulo="Relevância do veículo"
              dica="Quanto vale uma matéria conforme o tier do veículo. Vale para Imprensa e Mercado."
            >
              <select
                value={calibracao.regua_tier}
                onChange={(evento) => gravar({ regua_tier: evento.target.value })}
                disabled={salvando}
                style={estiloDeEntrada}
              >
                {opcoes.reguas_de_tier.map((regua) => (
                  <option key={regua.codigo} value={regua.codigo}>
                    {ROTULO_DA_REGUA_DE_TIER[regua.codigo] ?? regua.codigo}
                  </option>
                ))}
              </select>
            </Campo>
            <p style={{ fontSize: 11.5, color: 'var(--cinza-2)', margin: '10px 0 0' }}>
              <strong>Muito Relevante</strong> = grande imprensa nacional, econômica e trade.{' '}
              <strong>Relevante</strong> = regionais com influência.{' '}
              <strong>Menos Relevante</strong> = locais e blogs de nicho. A classificação é da
              própria clipagem, e não desta tela. As lentes de redes não têm tier: nelas esta
              régua não muda nada.
            </p>
          </Cartao>

          <Cartao>
            <Campo
              rotulo="Peso de cada menção nas redes"
              dica="Vale para Sociedade digital e Clientes."
            >
              <select
                value={calibracao.regua_engajamento}
                onChange={(evento) => gravar({ regua_engajamento: evento.target.value })}
                disabled={salvando}
                style={estiloDeEntrada}
              >
                {opcoes.reguas_de_engajamento.map((codigo) => (
                  <option key={codigo} value={codigo}>
                    {ROTULO_DA_REGUA_DE_ENGAJAMENTO[codigo] ?? codigo}
                  </option>
                ))}
              </select>
            </Campo>
            <p style={{ fontSize: 11.5, color: 'var(--cinza-2)', margin: '10px 0 0' }}>
              Approach e Bites trazem o engajamento de cada menção; só a Bites traz o cargo de
              autores políticos — nas outras fontes a régua <em>cargo</em> cai na contagem.
              Nenhuma das duas traz alcance ou número de seguidores.
            </p>
          </Cartao>
        </div>
      </Secao>

      <Secao
        titulo="Peso das lentes"
        subtitulo="De 0 a 60, de 5 em 5. Peso 0 tira a lente do índice — as outras redistribuem."
      >
        <Cartao>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {opcoes.lentes.map((lente) => (
              <li
                key={lente.codigo}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0',
                  borderTop: '1px solid var(--borda)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{lente.nome}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--cinza-2)' }}>
                    {lente.stakeholder} · padrão {lente.peso_padrao}
                  </div>
                </div>
                <Botao
                  variante="fantasma"
                  aoClicar={() => mudarPeso(lente.codigo, -5)}
                  desabilitado={salvando}
                  rotuloAcessivel={`Diminuir o peso de ${lente.nome}`}
                >
                  −
                </Botao>
                <span
                  className="tabular"
                  style={{ fontSize: 16, fontWeight: 700, minWidth: 28, textAlign: 'center' }}
                >
                  {calibracao.pesos[lente.codigo] ?? lente.peso_padrao}
                </span>
                <Botao
                  variante="fantasma"
                  aoClicar={() => mudarPeso(lente.codigo, 5)}
                  desabilitado={salvando}
                  rotuloAcessivel={`Aumentar o peso de ${lente.nome}`}
                >
                  +
                </Botao>
              </li>
            ))}
          </ul>
        </Cartao>
      </Secao>

      <Secao
        titulo="Fontes"
        subtitulo="Importar substitui os meses que a planilha traz — o mês que ela não traz fica intacto. Desligar uma fonte tira o dado dela do índice sem apagar o histórico; com todas as fontes de uma lente desligadas, a lente sai do cálculo e os pesos redistribuem."
      >
        <Cartao>
          {/* UM `<input type="file">` PARA A SEÇÃO, acionado pelo botão da
              linha. Antes era um por fonte, escondido com `display: none`
              dentro de um `<label>` — o que tira o elemento da ordem de foco e
              deixava "Importar planilha" inalcançável por teclado. Um `Botao`
              de verdade resolve isso e ainda usa o estilo da casa; o input
              fica só como mecanismo, sem receber foco. */}
          <input
            ref={entradaDePlanilha}
            type="file"
            accept=".xlsx"
            tabIndex={-1}
            aria-hidden
            style={{ display: 'none' }}
            onChange={(evento) => {
              const arquivo = evento.target.files?.[0];
              // O input é limpo SEMPRE: sem isto, escolher o mesmo arquivo de
              // novo (depois de corrigi-lo) não dispara `change`, e a tela
              // parece travada.
              evento.target.value = '';
              const codigo = fonteEscolhida.current;
              if (arquivo && codigo) void importar(codigo, arquivo);
            }}
          />

          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {fontes.map((fonte) => (
              <li
                key={fonte.codigo}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0',
                  borderTop: '1px solid var(--borda)',
                  opacity: fonte.ligada ? 1 : 0.55,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {fonte.nome}
                    {fonte.interna ? (
                      <Chip rotulo="interna" estilo={{ marginLeft: 8 }} />
                    ) : null}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--cinza-2)' }}>
                    {fonte.lente} · {fonte.meses_com_dado}{' '}
                    {fonte.meses_com_dado === 1 ? 'mês com dado' : 'meses com dado'}
                    {fonte.mencoes_no_mes
                      ? ` · ${numero(fonte.mencoes_no_mes)} no mês`
                      : ' · sem dado no mês'}
                  </div>
                  {fonte.observacao ? (
                    <div style={{ fontSize: 11.5, color: 'var(--cinza-2)' }}>
                      {fonte.observacao}
                    </div>
                  ) : null}
                </div>
                {/* A FONTE INTERNA NÃO TEM BOTÃO DE IMPORTAR: o CRM é este
                    banco, e oferecer o upload sugeriria que existe uma
                    planilha dele em algum lugar. */}
                {fonte.interna ? null : (
                  <Botao
                    variante="fantasma"
                    aoClicar={() => escolherPlanilha(fonte.codigo)}
                    desabilitado={importando !== null}
                  >
                    {importando === fonte.codigo ? 'Lendo…' : 'Importar planilha'}
                  </Botao>
                )}
                <Botao
                  variante="fantasma"
                  aoClicar={() => alternarFonte(fonte.codigo)}
                  desabilitado={salvando}
                >
                  {fonte.ligada ? 'Desligar' : 'Ligar'}
                </Botao>
              </li>
            ))}
          </ul>

          {importado?.map((resumo) => (
            <ResumoDaImportacao key={resumo.fonte} resumo={resumo} />
          ))}
        </Cartao>
      </Secao>
    </div>
  );
}

/** O que a planilha rendeu numa fonte — com os descartes, e não só o que entrou.
 *
 *  UM RESUMO POR FONTE, porque um arquivo alimenta mais de uma. É aqui que
 *  quem subiu o export da Clipei descobre que Mercado também foi atualizado. */
function ResumoDaImportacao({ resumo }: { resumo: ImportacaoDoScore }) {
  const descartados = Object.entries(resumo.descartes).filter(([, total]) => total > 0);
  const avisados = Object.entries(resumo.avisos).filter(([, total]) => total > 0);
  // O mês encolheu: o arquivo trouxe menos do que já havia. Pode ser
  // reclassificação do fornecedor, pode ser export baixado antes do
  // fechamento — a tela não adivinha, mas não deixa passar em branco.
  const encolheu = resumo.antes > resumo.ingeridas;

  return (
    <div
      style={{
        marginTop: 12,
        padding: '10px 12px',
        borderRadius: 6,
        background: encolheu ? 'var(--atencao-bg)' : 'var(--ok-bg)',
        fontSize: 12,
        lineHeight: 1.6,
      }}
    >
      <strong>{resumo.nome}:</strong> {numero(resumo.ingeridas)} de{' '}
      {numero(resumo.linhas)} linhas entraram em {resumo.meses.join(', ')}.
      {encolheu ? (
        <>
          {' '}
          <strong>
            O mês tinha {numero(resumo.antes)} — confira se o arquivo é o
            fechado.
          </strong>
        </>
      ) : null}
      {descartados.length ? (
        <>
          {' '}
          Fora:{' '}
          {descartados
            .map(
              ([motivo, total]) =>
                `${numero(total)} ${ROTULO_DO_DESCARTE[motivo] ?? motivo}`,
            )
            .join('; ')}
          .
        </>
      ) : null}
      {avisados.length ? (
        <>
          {' '}
          Entraram com ressalva:{' '}
          {avisados
            .map(
              ([motivo, total]) => `${numero(total)} ${ROTULO_DO_AVISO[motivo] ?? motivo}`,
            )
            .join('; ')}
          .
        </>
      ) : null}
    </div>
  );
}

/* -- aba 5: a metodologia ------------------------------------------------------- */

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
