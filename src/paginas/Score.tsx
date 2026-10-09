/** KPIs Reputacionais — o Índice de Saúde Reputacional.
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
import type { ReactNode } from 'react';

import {
  obterDriversDoScore,
  obterOpcoesDoScore,
  obterScore,
  obterSerieDoScore,
} from '@/api/cliente';
import type { FiltroDaLente } from '@/api/cliente';
import { BaseDoScore } from '@/paginas/score/BaseDoScore';
import { BuscaDoRadar } from '@/paginas/score/BuscaDoRadar';
import {
  Carregando,
  Cartao,
  Chip,
  ComFaixaDoTopo,
  FaixaDeErro,
  Secao,
  Vazio,
} from '@/componentes/basicos';
import { SeletorDeMes } from '@/componentes/SeletorDeMes';
import { PainelDaJornada } from '@/paginas/score/PainelDaJornada';
import { DESCRICAO_DAS_LENTES } from '@/dominio/descricaoDasLentes';
import { DossieDaLente } from '@/paginas/score/DossieDaLente';
import { BarraDivergentePorItem } from '@/graficos/BarraDivergentePorItem';
import { RadialDasLentes } from '@/graficos/RadialDasLentes';
import { Ranking } from '@/graficos/Ranking';
import { numero } from '@/dominio/formato';
import {
  FAIXAS,
  comoDelta,
  corDaFaixa,
  corDaLente,
  corDoDelta,
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
  //: O RECORTE DA LENTE ABERTA. Mora aqui, e não no dossiê, para a busca
  //: inteligente abrir uma lente já filtrada. TROCAR DE LENTE OU DE MÊS O ZERA:
  //: um veículo da Imprensa não existe no vocabulário de Clientes, e as opções
  //: de filtro são do mês.
  const [filtroDaLente, definirFiltroDaLente] = useState<FiltroDaLente>({});
  const trocarLente = (codigo: string) => {
    definirLenteAberta(codigo);
    definirFiltroDaLente({});
  };
  const trocarMes = (novo: string) => {
    definirMes(novo);
    definirFiltroDaLente({});
  };

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

  //: O MÊS E O AVISO DE CALIBRAÇÃO, montados uma vez e postos onde a aba pede.
  const controlesDoMes = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      {!indice.calibracao.padrao ? (
        <Chip
          rotulo="calibração ajustada"
          fundo="var(--atencao-bg)"
          texto="var(--atencao-fg)"
          titulo="A régua em vigor é diferente da de fábrica — ver a engrenagem do Score."
        />
      ) : null}
      <SeletorDeMes
        meses={opcoes.meses}
        valor={mes}
        sugerido={opcoes.mes_sugerido}
        aoEscolher={trocarMes}
      />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* SEM O CARTÃO DE ABERTURA, por pedido: ele gastava a primeira dobra da
          tela com um título e um campo, e o que a pessoa veio ver — o radar —
          ficava para baixo. O título continua existindo para leitor de tela,
          que precisa do h1.

          O MÊS MORA NO CARD DO RADAR na Visão geral, por pedido; em Drivers
          ele fica aqui em cima; nas Lentes não aparece (ver abaixo). */}
      <h1 style={SO_PARA_LEITOR_DE_TELA}>KPIs Reputacionais</h1>
      {/* NAS LENTES, NADA ACIMA DA BUSCA, por pedido: sem o mês e sem o aviso
          de calibração — a busca inteligente fica colada no cabeçalho. O mês é
          o que foi escolhido na Visão geral (e a Jornada da lente troca de mês
          ao clicar). Em Drivers, que não tem outro lugar para escolher o mês,
          o seletor continua aqui. */}
      {aba === 'drivers' ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{controlesDoMes}</div>
      ) : null}

      {/* A BUSCA INTELIGENTE, no topo da Visão geral e das Lentes: na Visão
          geral ela leva para a lente certa; nas Lentes, também recorta a
          aberta. Escolher uma sugestão sempre abre a aba Lentes. */}
      {aba === 'geral' || aba === 'lentes' ? (
        <BuscaDoRadar
          mes={mes}
          lentes={opcoes.lentes}
          lenteAberta={lenteAberta}
          filtro={aba === 'lentes' ? filtroDaLente : {}}
          aoMudarFiltro={definirFiltroDaLente}
          aoEscolher={(sugestao) => {
            definirLenteAberta(sugestao.lente);
            definirFiltroDaLente(
              sugestao.filtro ? { [sugestao.filtro.chave]: sugestao.filtro.valor } : {},
            );
            aoTrocarAba('lentes');
          }}
        />
      ) : null}

      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      {aba === 'geral' ? (
        <VisaoGeral
          indice={indice}
          serie={serie}
          aoAbrirLente={(codigo) => {
            trocarLente(codigo);
            aoTrocarAba('lentes');
          }}
          aoTrocarMes={trocarMes}
          controlesDoMes={controlesDoMes}
        />
      ) : null}

      {aba === 'lentes' ? (
        <DossieDaLente
          mes={mes}
          lente={lenteAberta}
          aoTrocarLente={trocarLente}
          serie={serie}
          aoTrocarMes={trocarMes}
          filtro={filtroDaLente}
          definirFiltro={definirFiltroDaLente}
        />
      ) : null}

      {aba === 'drivers' ? <DriversERiscos mes={mes} /> : null}

      {aba === 'metodologia' ? <Metodologia /> : null}

      {/* A BASE E A PORTA DE ENTRADA DO DADO. O upload morava na Calibracao,
          que e a REGUA do indice — la se decide quanto o dado pesa, aqui ele
          entra. Ver o cabecalho de `BaseDoScore`. */}
      {aba === 'base' ? <BaseDoScore /> : null}
    </div>
  );
}

/* -- a visão geral ------------------------------------------------------------- */

function VisaoGeral({
  indice,
  serie,
  aoAbrirLente,
  aoTrocarMes,
  controlesDoMes,
}: {
  indice: IndiceDoScore;
  serie: PontoDaSerie[];
  aoAbrirLente: (codigo: string) => void;
  aoTrocarMes: (mes: string) => void;
  /** O seletor de mês (e o aviso de calibração), para o cabeçalho do radar. */
  controlesDoMes: ReactNode;
}) {
  // O DESTAQUE MORA AQUI, e não em cada metade: gráfico e lista são duas
  // vistas do mesmo conjunto, e cada um com o seu estado faria passar o mouse
  // na lista não acender a fatia — que é o único jeito de ligar a terceira
  // linha à segunda fatia, quando as larguras são diferentes.
  const [destacada, definirDestacada] = useState<string | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* A JORNADA DO ÍNDICE ABRE A TELA, por pedido: a pergunta de quem chega
          é "para onde o índice está indo", e o radar do mês vem logo depois
          para explicar de que lentes o número é feito. */}
      <PainelDaJornada
        titulo="Jornada do índice"
        sujeito="O índice"
        serie={serie}
        mes={indice.mes}
        aoEscolherMes={aoTrocarMes}
        lentesParaComparar={indice.lentes
          .filter((lente) => lente.score !== null)
          .map((lente) => ({ codigo: lente.codigo, nome: lente.nome }))}
        dica="Clique num mês para abrir a lente e o radial daquele mês."
      />

      <ComFaixaDoTopo>
      <Secao
        titulo="Radar Reputacional"
        subtitulo="Como a companhia é vista por imprensa, mercado, sociedade digital, clientes e parceiros institucionais. Vale para a companhia inteira — não segue os filtros do CRM."
        acao={controlesDoMes}
      >
        <Cartao>
          {/* `stretch`: a coluna das lentes acompanha a altura do radar, e os
              cartões dividem essa altura entre si — por pedido, do mesmo
              tamanho do radar. */}
          <div className="grade grade--mapa" style={{ gap: 24, alignItems: 'stretch' }}>
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
      </ComFaixaDoTopo>

    </div>
  );
}

//: O PADRÃO "VISUALMENTE OCULTO": fora da tela, mas na árvore de
//: acessibilidade. `display: none` tiraria o h1 de quem precisa dele.
const SO_PARA_LEITOR_DE_TELA = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

/** A lista das cinco lentes, ao lado do radar.
 *
 *  ABRE PELO STAKEHOLDER, e não pelo nome da lente: quem lê o índice pergunta
 *  "de quem é este 37?" antes de perguntar de que fonte ele saiu.
 *
 *  CADA CARTÃO SE EXPLICA SOZINHO: o peso ao lado do nome, o objetivo da lente
 *  numa frase e a fonte em uso hoje. Textos em `DESCRICAO_DAS_LENTES`; peso e
 *  nota, do cálculo.
 *
 *  CONTORNO CINZA, sem faixa colorida: a ligação com a fatia do radar fica
 *  por conta do número do peso, na cor da lente.
 *
 *  COMPACTOS E DIVIDINDO A ALTURA DO RADAR (`flex: 1`), por pedido: a coluna
 *  inteira tem a altura do radar ao lado, em vez de passar dele.
 *
 *  O CLIQUE NO CARTÃO ABRE A LENTE; para o teclado, o nome da lente é o botão.
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      {lentes.map((lente) => {
        const descricao = DESCRICAO_DAS_LENTES[lente.codigo];
        const acesa = destacada === lente.codigo;
        const fora = lente.score === null;
        const cor = corDaLente(lente.codigo);
        return (
          <div
            key={lente.codigo}
            onMouseEnter={() => aoDestacar(lente.codigo)}
            onMouseLeave={() => aoDestacar(null)}
            onClick={() => aoAbrir(lente.codigo)}
            style={{
              flex: '1 1 auto',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              alignContent: 'center',
              gap: '3px 14px',
              padding: '9px 12px',
              borderRadius: 6,
              //: CONTORNO CINZA, por pedido (o da cor da lente não agradou); aceso,
              //: ele fica azul, como nos outros controles da tela.
              border: `1px solid ${acesa ? 'var(--azul-mar)' : 'var(--borda)'}`,
              background: acesa ? 'var(--bg-trilho)' : 'var(--branco)',
              cursor: 'pointer',
              opacity: fora ? 0.6 : 1,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <span className="kicker" style={{ display: 'block', fontSize: 10.5 }}>
                {lente.stakeholder}
              </span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={(evento) => {
                    evento.stopPropagation();
                    aoAbrir(lente.codigo);
                  }}
                  onFocus={() => aoDestacar(lente.codigo)}
                  onBlur={() => aoDestacar(null)}
                  title={`Abrir a lente ${lente.nome}`}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    fontSize: 15.5,
                    fontWeight: 800,
                    color: 'var(--cinza-4)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {lente.nome}
                </button>
                {/* O PESO NA FRENTE DO TÍTULO, por pedido. */}
                <span style={{ fontSize: 12, color: 'var(--cinza-2)', whiteSpace: 'nowrap' }}>
                  Peso{' '}
                  <strong className="tabular" style={{ fontSize: 14, fontWeight: 800, color: cor }}>
                    {fora ? '—' : `${lente.peso_efetivo}%`}
                  </strong>
                </span>
              </span>
            </div>
            <div style={{ textAlign: 'right', alignSelf: 'center' }}>
              <span
                className="tabular"
                style={{
                  display: 'block',
                  fontSize: 24,
                  fontWeight: 800,
                  lineHeight: 1,
                  color: corDaFaixa(lente.score),
                }}
              >
                {lente.score ?? '—'}
              </span>
              <span style={{ fontSize: 11, color: corDoDelta(lente.delta) }}>
                {fora ? 'fora do mês' : comoDelta(lente.delta)}
              </span>
            </div>

            {descricao ? (
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--cinza-3)' }}>
                  {descricao.objetivo}
                </span>
                <span
                  style={{
                    fontSize: 11.5,
                    color: 'var(--cinza-2)',
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <strong style={{ fontWeight: 700, marginRight: 4, color: 'var(--cinza-3)' }}>
                    Fonte utilizada:
                  </strong>
                  {descricao.fonteUtilizada}
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
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
      <ComFaixaDoTopo>
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
      </ComFaixaDoTopo>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ComFaixaDoTopo>
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
      </ComFaixaDoTopo>

      <ComFaixaDoTopo>
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
      </ComFaixaDoTopo>

      <ComFaixaDoTopo>
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
      </ComFaixaDoTopo>
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
      <ComFaixaDoTopo>
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
              Com mais de uma fonte na mesma lente, as menções das duas entram na{' '}
              <strong>mesma conta</strong> — um denominador só. É o que faz a soma dos
              recortes fechar com a nota: o impacto de qualquer conjunto de menções é
              medido sobre o total do mês na lente.
            </li>
            <li>
              <strong>ISR = Σ (score × peso) ÷ Σ peso</strong>, sobre as lentes com dado. Lente
              sem dado sai do numerador <em>e</em> do denominador: o índice não pode cair por
              falta de medição.
            </li>
          </ol>
        </Cartao>
      </Secao>
      </ComFaixaDoTopo>

      <ComFaixaDoTopo>
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
      </ComFaixaDoTopo>

      <ComFaixaDoTopo>
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
              <strong>Mercado é proxy</strong> — a imprensa econômica (matérias para
              investidores), de todos os tiers, cada matéria ponderada pelo tier — até
              integrar rating e spread de debêntures.
            </li>
            <li>
              <strong>Pendentes:</strong> share of voice de pares, Reclame Aqui,
              Consumidor.gov e Google.
            </li>
          </ul>
        </Cartao>
      </Secao>
      </ComFaixaDoTopo>
    </div>
  );
}
