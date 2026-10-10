/** Risk Tracking: os incidentes que tocam a matriz de risco corporativo.
 *
 *  O CAMINHO É UM SÓ, e é o que torna esta aba possível: tema (N3) do cadastro →
 *  `tema_risco` → risco → severidade. Tudo o que entra na plataforma por assunto
 *  chega a risco pelo mesmo vínculo, e por isso a aba cruza CRM, Clipei (nas duas
 *  lentes), Bites e Approach quando ela subir — sem uma linha de código por
 *  fornecedor. Fonte nova que mapeie tema aparece aqui sozinha.
 *
 *  O QUE É UM INCIDENTE, nas duas famílias que não se somam por acidente: menção
 *  NEGATIVA (imprensa, redes) e agenda de clima TENSO (CRM). A `interacao` não
 *  tem sentimento — tem clima, que é o Termômetro da tela do CRM —, e clima
 *  negativo é a única leitura de "incidente" que o CRM oferece sem inventar
 *  campo. As duas vão separadas na tabela, porque uma notícia e uma reunião não
 *  se leem do mesmo jeito.
 *
 *  A TELA DESCE DO MACRO AO MICRO, que é o pedido do dono do produto:
 *
 *    o índice mês a mês  →  a matriz dos 32 riscos  →  os registros
 *
 *  e em qualquer um desses pontos um clique ABRE O APROFUNDAMENTO — o modal que
 *  empilha degraus (lente, N1, N2, N3, cluster, risco, severidade) até os
 *  registros. CLICAR NÃO REFAZ ESTA TELA, e isso é regra do produto, fixada nas
 *  Lentes: "ao clicar em um dado temos que abrir um modal com o deep diving".
 *  Recortar a tela inteira faria quem clicou perder de vista de onde saiu.
 *
 *  O ÍNDICE É ESCALA DO PICO DA SÉRIE, não absoluto: 100 é o pior mês da série
 *  inteira, e a referência vai na resposta porque sem ela "índice 32" é número
 *  sem unidade. A JANELA NÃO ENTRA NO CÁLCULO — se entrasse, o mesmo mês mudaria
 *  de valor conforme o período escolhido na tela.
 */

import { useEffect, useState } from 'react';

import {
  listarIncidentesDeRisco,
  obterOpcoesDoRisco,
  obterPainelDeRisco,
} from '@/api/cliente';
import { Carregando, FaixaDeErro, Kpi, Secao } from '@/componentes/basicos';
import {
  SEVERIDADES,
  areaDaSeveridade,
  comoVariacao,
  corDaSeveridade,
  corDaVariacao,
  descendoEm,
  janelaDoRecorte,
  recorteDaJanela,
  rotuloDaSeveridade,
  setaDaVariacao,
  subindoDe,
  textoDaSeveridade,
} from '@/dominio/riscos';
import type {
  FiltroDoRisco,
  OpcoesDoRisco,
  PaginaDeIncidentes,
  PainelDeRisco,
} from '@/dominio/riscos';
import { numero } from '@/dominio/formato';
import { rotuloDoMesComAno } from '@/dominio/calendarioMensal';
import { IndiceDeExposicao } from '@/graficos/IndiceDeExposicao';
import { AprofundarNoRisco } from '@/paginas/score/AprofundarNoRisco';
import { FiltrosDoRisco } from '@/paginas/score/FiltrosDoRisco';
import { MatrizDeRisco } from '@/paginas/score/MatrizDeRisco';
import { RelatorioDeIncidentes } from '@/paginas/score/RelatorioDeIncidentes';

/** Quantos registros a tabela da tela mostra por página. */
const POR_PAGINA = 50;

/** Quanto tempo a busca espera antes de ir ao servidor.
 *
 *  SEM ISSO A TELA RECARREGA POR LETRA: "desabastecimento" são dezessete
 *  requisições, cada uma varrendo 28 mil menções, e as respostas voltam fora de
 *  ordem — a tela acaba mostrando o resultado de "desabast". */
const ESPERA_DA_BUSCA = 400;

export function RastreioDeRisco() {
  const [filtro, definirFiltro] = useState<FiltroDoRisco>({});
  const [busca, definirBusca] = useState('');
  const [buscaAplicada, definirBuscaAplicada] = useState('');
  //: A PÁGINA GUARDA O RECORTE A QUE ELA PERTENCE, e a página em uso é DERIVADA
  //: na renderização: recorte diferente vale 1.
  //:
  //: ERA UM EFEITO QUE ZERAVA A PÁGINA, e isso disparava DOIS carregamentos ao
  //: trocar de filtro estando na página 3 — o primeiro pedindo a página 3 de um
  //: recorte que pode ter uma só, e devolvendo tabela vazia por um instante.
  //: Achado de revisão. Derivar resolve na mesma renderização, sem efeito.
  const [paginaEscolhida, definirPaginaEscolhida] = useState({ caminho: '', pagina: 1 });

  const [opcoes, definirOpcoes] = useState<OpcoesDoRisco | null>(null);
  const [painel, definirPainel] = useState<PainelDeRisco | null>(null);
  const [registros, definirRegistros] = useState<PaginaDeIncidentes | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  //: O APROFUNDAMENTO ABERTO: o recorte DELE, que começa no da tela e empilha
  //: por dentro. O caminho de dentro do painel é dele, e some quando ele fecha —
  //: é o que diferencia aprofundar de recortar.
  const [aprofundando, definirAprofundando] = useState<{
    filtro: FiltroDoRisco;
    ultimo?: string;
  } | null>(null);

  useEffect(() => {
    const relogio = setTimeout(() => definirBuscaAplicada(busca), ESPERA_DA_BUSCA);
    return () => clearTimeout(relogio);
  }, [busca]);

  const recorte: FiltroDoRisco = { ...filtro, busca: buscaAplicada || null };
  const caminho = JSON.stringify(recorte);
  const pagina = paginaEscolhida.caminho === caminho ? paginaEscolhida.pagina : 1;
  const trocarPagina = (nova: number) => definirPaginaEscolhida({ caminho, pagina: nova });

  useEffect(() => {
    let ativo = true;
    definirErro(null);
    const atual = JSON.parse(caminho) as FiltroDoRisco;
    Promise.all([
      obterPainelDeRisco(atual),
      obterOpcoesDoRisco(atual),
      listarIncidentesDeRisco(atual, pagina, POR_PAGINA),
    ])
      .then(([doPainel, dasOpcoes, daPagina]) => {
        if (!ativo) return;
        definirPainel(doPainel);
        definirOpcoes(dasOpcoes);
        definirRegistros(daPagina);
      })
      .catch((falha: unknown) => {
        if (!ativo) return;
        //: OS DADOS VELHOS SAEM JUNTO COM O ERRO. Mantê-los deixava a tela com
        //: os chips do recorte NOVO e os números do ANTIGO embaixo — e quem
        //: olha de longe lê os números, não a faixa vermelha. Achado de
        //: revisão.
        definirPainel(null);
        definirOpcoes(null);
        definirRegistros(null);
        definirErro(falha instanceof Error ? falha.message : 'Não foi possível carregar.');
      });
    return () => {
      ativo = false;
    };
  }, [caminho, pagina]);

  if (erro && !painel) return <FaixaDeErro mensagem={erro} />;
  if (!painel || !opcoes || !registros) return <Carregando rotulo="Carregando o rastreio…" />;

  const abrir = (chave: string, valor: string) =>
    definirAprofundando({ filtro: descendoEm(recorte, chave, valor), ultimo: chave });

  //: OS MESES DA SÉRIE, e não `opcoes.meses`: a moldura indexa posições da série
  //: que ela desenha, e duas listas diferentes fariam a moldura marcar um mês ao
  //: lado do que o recorte diz.
  const mesesDaSerie = painel.serie.map((mes) => mes.mes);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '8px 24px',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Risk Tracking
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--cinza-3)' }}>
            Notícias negativas e reuniões de clima tenso que tocam riscos da matriz de risco
            corporativo
          </p>
        </div>
        {/* AS FONTES QUE ALIMENTARAM O RECORTE, e não uma fonte fixa: o
            protótipo dizia "Fonte: Clipei" porque nasceu de um clipping só. */}
        <p style={{ margin: 0, fontSize: 12, color: 'var(--cinza-2)' }}>
          {opcoes.lentes.length > 0
            ? `Lentes no recorte: ${opcoes.lentes.map((lente) => lente.nome).join(' · ')}`
            : 'Nenhuma fonte trouxe incidente neste recorte'}
        </p>
      </div>

      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      <FiltrosDoRisco
        opcoes={opcoes}
        filtro={filtro}
        definirFiltro={definirFiltro}
        busca={busca}
        definirBusca={definirBusca}
      />

      <Secao
        titulo="Índice de Exposição a Risco"
        subtitulo={`Escala 0 a 100 · mensal · 100 = o pior mês da série (${numero(painel.referencia)} pontos${painel.mes_do_pico ? `, em ${rotuloDoMesComAno(painel.mes_do_pico)}` : ''})`}
        ajuda={
          'Soma dos incidentes pelo peso da severidade (crítico 3, alto 2, moderado 1), ' +
          'com cada incidente contado uma vez, pela pior severidade que ele toca. ' +
          'O resultado é posto na escala do pior mês da série inteira — a janela de ' +
          'análise não entra na conta, para o mesmo mês não mudar de valor conforme o ' +
          'período escolhido.'
        }
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
          <div style={{ flex: '999 1 640px', minWidth: 0 }}>
            <IndiceDeExposicao
              serie={painel.serie}
              pico={painel.pico_do_periodo.valor}
              mesDoPico={painel.pico_do_periodo.mes}
              //: CLICAR NUM MÊS ABRE O APROFUNDAMENTO DELE — o primeiro degrau
              //: da descida, e o que o dono do produto pediu ao dizer que o
              //: gráfico tem de levar do macro ao registro.
              aoEscolherMes={(mes) =>
                definirAprofundando({
                  filtro: { ...recorte, de: mes, ate: mes },
                  ultimo: 'de',
                })
              }
              janela={janelaDoRecorte(mesesDaSerie, filtro.de, filtro.ate)}
              aoMudarJanela={(nova) =>
                definirFiltro({ ...filtro, ...recorteDaJanela(mesesDaSerie, nova) })
              }
            />
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px 20px',
                marginTop: 18,
                paddingLeft: 36,
                fontSize: 12,
                color: 'var(--cinza-3)',
              }}
            >
              {SEVERIDADES.map((severidade) => (
                <span
                  key={severidade.codigo}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <span
                    aria-hidden="true"
                    style={{ width: 12, height: 12, background: severidade.forte }}
                  />
                  {severidade.rotulo}
                </span>
              ))}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span
                  aria-hidden="true"
                  style={{ width: 18, borderTop: '2px dashed var(--vermelho-pitanga)' }}
                />
                Pico do período
              </span>
              <span style={{ color: 'var(--cinza-2)' }}>
                Barras esmaecidas ficam fora da janela · clique num mês para aprofundar ·
                arraste a moldura para mudar o período
              </span>
            </div>
          </div>

          <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Kpi
              rotulo="Pico do período"
              valor={painel.pico_do_periodo.valor === null ? '—' : numero(painel.pico_do_periodo.valor)}
              dica={
                painel.pico_do_periodo.mes
                  ? rotuloDoMesComAno(painel.pico_do_periodo.mes)
                  : 'Sem incidente na janela'
              }
            />
            <Kpi
              rotulo="Índice atual"
              valor={painel.indice_atual.valor === null ? '—' : numero(painel.indice_atual.valor)}
              dica={
                painel.indice_atual.mes
                  ? rotuloDoMesComAno(painel.indice_atual.mes)
                  : 'Sem mês com incidente'
              }
            />
            <Kpi
              rotulo="Variação no mês"
              valor={`${comoVariacao(painel.variacao_no_mes.valor)} ${setaDaVariacao(painel.variacao_no_mes.valor)}`}
              cor={corDaVariacao(painel.variacao_no_mes.valor)}
              //: O TEXTO DIZ O QUE A COR QUER DIZER. Aqui o índice é EXPOSIÇÃO:
              //: cair é bom, ao contrário do Score, onde subir é bom. Duas telas
              //: da mesma divisão com a seta em cores opostas enganam em
              //: silêncio se a cor estiver sozinha.
              dica={
                painel.variacao_no_mes.valor === null
                  ? 'Sem dois meses para comparar'
                  : painel.variacao_no_mes.valor < 0
                    ? `Risco em queda frente a ${painel.variacao_no_mes.mes ? rotuloDoMesComAno(painel.variacao_no_mes.mes) : 'o mês anterior'}`
                    : painel.variacao_no_mes.valor > 0
                      ? `Risco em alta frente a ${painel.variacao_no_mes.mes ? rotuloDoMesComAno(painel.variacao_no_mes.mes) : 'o mês anterior'}`
                      : 'Estável frente ao mês anterior'
              }
            />
          </div>
        </div>
      </Secao>

      <MatrizDeRisco
        matriz={painel.matriz}
        riscoAberto={filtro.risco}
        aoAprofundar={(codigo) => abrir('risco', codigo)}
      />

      {/* OS TRÊS NÚMEROS DO TOPO DA TABELA. Eles contam o INCIDENTE pela pior
          severidade dele, e por isso somam o total — ao contrário da matriz, que
          conta o fato em cada risco que ele toca. */}
      <section
        aria-label="Total de incidentes"
        style={{
          background: 'var(--branco)',
          border: '1px solid var(--borda)',
          borderRadius: 'var(--r-card)',
          padding: '16px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '16px 32px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--cinza-2)',
            }}
          >
            Total de incidentes
          </span>
          <span style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>
            {numero(registros.total)}
          </span>
        </div>
        <span aria-hidden="true" style={{ width: 1, height: 32, background: 'var(--borda)' }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 24px' }}>
          {SEVERIDADES.map((severidade) => (
            <button
              key={severidade.codigo}
              type="button"
              //: O NOME DIZ O QUE O CLIQUE FAZ, e não só o rótulo da etiqueta:
              //: "Crítico 1" lido em voz alta não diz que clicar abre os
              //: incidentes, e casa com o nome do botão do risco na matriz.
              aria-label={`Aprofundar nos ${numero(painel.total_por_severidade[severidade.codigo] ?? 0)} incidentes de severidade ${rotuloDaSeveridade(severidade.codigo)}`}
              onClick={() => abrir('severidade', severidade.codigo)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                border: 0,
                background: 'transparent',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 8px',
                  border: `1px solid ${corDaSeveridade(severidade.codigo)}`,
                  background: areaDaSeveridade(severidade.codigo),
                  borderRadius: 'var(--r-chip)',
                  fontSize: 12,
                  fontWeight: 700,
                  color: textoDaSeveridade(severidade.codigo),
                }}
              >
                <span
                  aria-hidden="true"
                  style={{ width: 8, height: 8, background: corDaSeveridade(severidade.codigo) }}
                />
                {rotuloDaSeveridade(severidade.codigo)}
              </span>
              <span style={{ fontSize: 24, fontWeight: 800 }}>
                {numero(painel.total_por_severidade[severidade.codigo] ?? 0)}
              </span>
            </button>
          ))}
        </div>
      </section>

      <RelatorioDeIncidentes
        pagina={registros}
        aoMudarPagina={trocarPagina}
        aoAprofundarNoTema={(tema) => abrir('tema', tema)}
      />

      {aprofundando ? (
        <AprofundarNoRisco
          filtro={aprofundando.filtro}
          arvore={opcoes.temas}
          clusters={opcoes.clusters}
          ultimoDegrau={aprofundando.ultimo}
          aoFechar={() => definirAprofundando(null)}
          //: DESCER EMPILHA NO RECORTE DO PAINEL, e não no da tela: a tela de
          //: trás fica onde estava.
          aoDescer={(chave, valor) =>
            definirAprofundando({
              filtro: descendoEm(aprofundando.filtro, chave, valor),
              ultimo: chave,
            })
          }
          aoSubir={(chave) =>
            definirAprofundando({
              filtro: subindoDe(aprofundando.filtro, chave),
              ultimo: undefined,
            })
          }
        />
      ) : null}
    </div>
  );
}
