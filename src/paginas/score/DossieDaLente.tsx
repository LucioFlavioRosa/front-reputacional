/** O dossiê de uma lente — a aba Lentes do Score Executivo.
 *
 *  AS CINCO LENTES TÊM A MESMA ESTRUTURA, e é isso que faz a tela ser um
 *  dossiê e não cinco relatórios: destaque com a nota e a manchete, evolução
 *  com os fatos do período, dois painéis e os sinais do período. Quem aprende
 *  a ler a Imprensa lê as outras quatro.
 *
 *  NENHUMA FRASE DESTA TELA FOI ESCRITA À MÃO. Manchete, título de gráfico,
 *  quadro da evolução e lista de sinais saem de detectores sobre os próprios
 *  dados, recalculados a cada leitura — é por isso que a frase nunca
 *  desencontra do número que está ao lado dela.
 *
 *  O SERVIDOR DIZ QUE GRÁFICO DESENHAR. Cada painel chega com um `tipo`
 *  (`barras_100`, `matriz_prioridade`, `tabela`…) e esta tela escolhe a peça
 *  correspondente. Uma lente nova, ou um painel que troque de formato, não
 *  custa componente novo — custa uma linha de configuração no back.
 *
 *  TODO BLOCO TEM "?", sem exceção. Metade do que se vê aqui não sai das
 *  planilhas, e a ficha de procedência viaja junto do dado justamente para que
 *  a explicação não se separe dele. Ver `componentes/Procedencia.tsx`.
 */

import { useEffect, useState } from 'react';

import type { FiltroDaLente, OpcoesDeFiltroDaLente } from '@/api/cliente';
import { obterDossieDaLente, obterOpcoesDeFiltroDaLente } from '@/api/cliente';
import { Abas } from '@/componentes/Abas';
import { BarraDeFiltroDaLente } from '@/paginas/score/BarraDeFiltroDaLente';
import { OndeEstaACausa } from '@/paginas/score/OndeEstaACausa';
import { RecorteDaLente } from '@/paginas/score/RecorteDaLente';
import {
  Cartao,
  Carregando,
  Chip,
  ComFaixaDoTopo,
  FaixaDeAtencao,
  FaixaDeErro,
  Kpi,
  Secao,
  Selo,
} from '@/componentes/basicos';
import { BotaoDeProcedencia, CabecalhoDoBloco, NotaDeFonte } from '@/componentes/Procedencia';
import {
  COR_DO_EFEITO,
  ROTULO_DO_EFEITO,
  colunasDaTabela,
  enderecoDaLinhaDo,
  comoNumero,
  comoTexto,
  corDoTom,
  mesCurto,
  quantosSinaisReais,
} from '@/dominio/dossie';
import type { Bloco, Dossie, SinalDoDossie } from '@/dominio/dossie';
import { avisoDeExemplo } from '@/dominio/dossie';
import { GUIA_DO_BLOCO, GUIA_DO_DESTAQUE } from '@/dominio/guiaDoDossie';
import { serieDaLente } from '@/dominio/janelaDaJornada';
import { PainelDaJornada } from '@/paginas/score/PainelDaJornada';
import { LENTES_COM_FILTRO } from '@/dominio/filtrosDasLentes';
import { corDaFaixa } from '@/dominio/score';
import type { PontoDaSerie } from '@/dominio/score';
import { BarraDivergentePorItem } from '@/graficos/BarraDivergentePorItem';
import { BarrasEmpilhadas } from '@/graficos/BarrasEmpilhadas';
import {
  BarrasCemPorCento,
  BarrasPareadas,
  EscalaDeCinco,
  LinhaDoTempo,
  MatrizDePrioridade,
  TabelaDeLeitura,
} from '@/graficos/PecasDoDossie';
import { Ranking } from '@/graficos/Ranking';
import { Rosca } from '@/graficos/Rosca';

const LENTES = [
  { id: 'imprensa', rotulo: 'Imprensa' },
  { id: 'mercado', rotulo: 'Mercado' },
  { id: 'sociedade', rotulo: 'Sociedade digital' },
  { id: 'clientes', rotulo: 'Clientes' },
  { id: 'institucional', rotulo: 'Institucional' },
];

export function DossieDaLente({
  mes,
  lente,
  aoTrocarLente,
  serie,
  aoTrocarMes,
  filtro,
  definirFiltro,
}: {
  mes: string;
  lente: string;
  aoTrocarLente: (codigo: string) => void;
  /** O recorte da lente. MORA NA TELA DO SCORE, e não aqui, para a busca
   *  inteligente do topo poder abrir uma lente já filtrada ("Imprensa ›
   *  Veículo = Folha"). Quem troca lente ou mês também zera o filtro, lá. */
  filtro: FiltroDaLente;
  definirFiltro: (filtro: FiltroDaLente) => void;
  /** A mesma série que alimenta a Jornada do índice na Visão geral — aqui só
   *  lida de outro jeito (a nota de UMA lente, não o ISR). Mesmo dado, sem
   *  segunda chamada de rede. */
  serie: PontoDaSerie[];
  aoTrocarMes: (mes: string) => void;
}) {
  const [dossie, definirDossie] = useState<Dossie | null>(null);
  const nomeDaLente = LENTES.find((item) => item.id === lente)?.rotulo ?? lente;
  const [erro, definirErro] = useState<string | null>(null);
  //: AS OPÇÕES COM A LENTE E O MÊS DE QUE SÃO: assim a tela usa só as que
  //: batem com a lente aberta, sem precisar zerá-las a cada troca — e nunca
  //: mostra, por um instante, os veículos da Imprensa na barra de Clientes.
  const [carregadas, definirCarregadas] = useState<{
    chave: string;
    opcoes: OpcoesDeFiltroDaLente | null;
  } | null>(null);
  const opcoes = carregadas?.chave === `${lente}|${mes}` ? carregadas.opcoes : null;

  // TROCAR DE LENTE OU DE MÊS ZERA O DOSSIÊ: é o que evita mostrar, por um
  // instante, o número da lente ANTERIOR como se já fosse da nova. O RECORTE
  // é zerado por quem troca (a tela do Score), e não aqui: zerar aqui apagaria
  // o filtro que a busca inteligente acabou de pôr junto com a lente.
  useEffect(() => {
    definirDossie(null);
  }, [lente, mes]);

  useEffect(() => {
    // SÓ AS LENTES QUE TÊM FILTRO (`FILTROS_DAS_LENTES`): Mercado e
    // Institucional não têm recorte, e buscar opções que a tela nem desenha
    // seria uma chamada de rede sem efeito nenhum.
    if (!LENTES_COM_FILTRO.includes(lente)) return;
    let ativo = true;
    const chave = `${lente}|${mes}`;
    obterOpcoesDeFiltroDaLente(lente, mes)
      .then((recebidas) => ativo && definirCarregadas({ chave, opcoes: recebidas }))
      .catch(() => ativo && definirCarregadas({ chave, opcoes: null }));
    return () => {
      ativo = false;
    };
  }, [lente, mes]);

  useEffect(() => {
    let ativo = true;
    definirErro(null);
    // NÃO ZERA `dossie` AQUI. Clicar numa fatia da rosca ou num veículo do
    // placar de clima muda `filtro`, que cai nesta mesma dependência — se a
    // tela sumisse inteira (virasse um `<Carregando />`) a cada clique, a
    // página encolheria de repente e o navegador perderia a posição de
    // rolagem, voltando pro topo. Mantendo o dossiê ANTERIOR na tela até o
    // novo chegar, a altura não muda e quem clicou continua vendo o mesmo
    // trecho da página — só os números é que trocam, no lugar.
    obterDossieDaLente(lente, mes, filtro)
      .then((carregado) => ativo && definirDossie(carregado))
      .catch((falha) => {
        if (ativo) definirErro(falha instanceof Error ? falha.message : 'Não foi possível ler.');
      });
    return () => {
      ativo = false;
    };
  }, [lente, mes, filtro]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Abas
        abas={LENTES}
        ativa={lente}
        aoTrocar={aoTrocarLente}
        rotulo="Lente do Score"
        prefixo="lente"
      />

      {/* A JORNADA DA LENTE ABRE A ABA, por pedido: o mesmo bloco da Visão
          geral (cartões, janela, pico e vale, frase de cabeçalho), sobre a
          nota DESTA lente — e sem "Comparar com": dentro da lente só se vê a
          jornada dela. Não segue os filtros abaixo: é a nota do mês da lente. */}
      <PainelDaJornada
        key={lente}
        titulo={`Jornada da ${nomeDaLente}`}
        sujeito={`A lente ${nomeDaLente}`}
        serie={serieDaLente(serie, lente)}
        mes={mes}
        aoEscolherMes={aoTrocarMes}
        comIndiceGeral
        dica="Clique num mês para ver a lente naquele mês."
      />

      {/* OS FILTROS DE CADA LENTE: Imprensa, Sociedade digital e Clientes,
          cada uma com os seus (`FILTROS_DAS_LENTES`). Mercado e Institucional
          não têm recorte, e a barra não aparece para elas. */}
      <BarraDeFiltroDaLente
        lente={lente}
        filtro={filtro}
        definirFiltro={definirFiltro}
        opcoes={opcoes}
      />

      {erro ? <FaixaDeErro mensagem={erro} /> : null}
      {!dossie && !erro ? <Carregando /> : null}
      {dossie ? (
        <Conteudo
          dossie={dossie}
          filtro={filtro}
          definirFiltro={definirFiltro}
          serie={serie}
        />
      ) : null}
    </div>
  );
}

function Conteudo({
  dossie,
  filtro,
  definirFiltro,
  serie,
}: {
  dossie: Dossie;
  filtro: FiltroDaLente;
  definirFiltro: (filtro: FiltroDaLente) => void;
  serie: PontoDaSerie[];
}) {
  //: O RECORTE ABERTO NO MODAL — nulo com o modal fechado. É um estado À PARTE
  //: do `filtro` da tela, e a separação é o ponto: a barra de filtros refaz a
  //: tela, o modal abre ao lado dela. Guardar os dois no mesmo lugar faria
  //: aprofundar num tema refazer o mês atrás do modal — exatamente o que o dono
  //: do produto pediu para deixar de acontecer.
  //:
  //: O MÊS VIAJA JUNTO porque o modal deixou de ser sempre do mês da tela:
  //: clicar numa barra da Evolução abre o mês DAQUELA barra, que é abril quando a
  //: tela está em junho. Sem o mês no estado, o painel mediria junho com o título
  //: de abril.
  const [aprofundando, definirAprofundando] = useState<{
    mes: string;
    filtro: FiltroDaLente;
    //: A DIMENSÃO QUE ABRIU O PAINEL, para o título dele dizer o degrau que a
    //: pessoa acabou de abrir — a trilha vem em ordem de domínio, não de descida.
    ultimo?: string;
    //: ABERTO POR UM MÊS (coluna da Evolução, ponto da Jornada): o título nomeia
    //: o mês, e não o recorte que veio junto da tela.
    peloMes?: boolean;
  } | null>(null);
  const aoAprofundar = (chave: string, valor: string) =>
    definirAprofundando({ mes: dossie.mes, filtro: { ...filtro, [chave]: valor }, ultimo: chave });
  //: O RECORTE DO MÊS, SEM DIMENSÃO NENHUMA: o endpoint já responde isso (trilha
  //: vazia, impacto do mês inteiro), e é o que a barra da Evolução pergunta.
  //:
  //: O FILTRO DA TELA VAI JUNTO, de propósito: com uma UF escolhida, o gráfico de
  //: Evolução já desenha só aquela UF — abrir o mês inteiro a partir de uma barra
  //: que mostra o Rio contaria outro número do que a barra que foi clicada.
  const aoAprofundarNoMes = (mes: string) =>
    //: `peloMes` É PARA O TÍTULO: a pessoa clicou num mês, e o painel tem de se
    //: chamar pelo mês — mesmo quando herda o recorte da tela. Achado de revisão.
    definirAprofundando({ mes, filtro, peloMes: true });

  return (
    <>
      <Destaque dossie={dossie} />
      <Evolucao dossie={dossie} aoAprofundarNoMes={aoAprofundarNoMes} />

      {/* SÓ NA IMPRENSA — POR HORA (pedido do Jones, 2026-10-02): o backend já
          devolve `volume_por_tier`/`top_veiculos`/`clima_por_veiculos` vazios
          para as outras lentes (ver `_volume_por_tier`/`_veiculos` em
          `app/api/lentes.py`), mas um card vazio ainda É um card — a tela
          também precisa não desenhar a moldura, e não só o conteúdo. */}
      {dossie.codigo === 'imprensa' ? (
        <div className="grade grade--2" style={{ gap: 16 }}>
          <VolumeETopVeiculos dossie={dossie} filtro={filtro} definirFiltro={definirFiltro} />
          <ClimaPorVeiculos dossie={dossie} filtro={filtro} definirFiltro={definirFiltro} />
        </div>
      ) : null}

      {/* LOGO ABAIXO DOS DOIS GRÁFICOS DE VEÍCULO, e não lá embaixo depois de
          Drivers/Temas: quem acabou de ver "InfoMoney tem 9 matérias e saldo
          +56" quer a lista dessas matérias na sequência da leitura, não
          depois de outros dois blocos no meio do caminho.

          SÓ NA IMPRENSA — mesma restrição de tela de cima: "matéria" com
          veículo e tier é um conceito de clipagem de imprensa. */}
      {dossie.codigo === 'imprensa' ? (
        <BlocoAmplo titulo="Últimas matérias" bloco={dossie.materias_recentes} />
      ) : null}

      <BlocoAmplo titulo="Drivers e riscos" bloco={dossie.drivers_e_riscos} />
      {/* CLICÁVEL: a barra de um tema abre o aprofundamento dele, e DENTRO do
          painel a primeira aba é o Subtema — que é onde "Saneamento básico"
          deixa de ser um rótulo e passa a dizer o que aconteceu. */}
      <BlocoAmplo
        titulo="Temas mais falados"
        bloco={dossie.temas_mais_falados}
        filtro={filtro}
        aoAprofundar={aoAprofundar}
      />

      {/* O APROFUNDAMENTO, por cima de tudo. Montado só quando há recorte
          aberto: um modal montado e invisível continua carregando dados. */}
      {aprofundando ? (
        <RecorteDaLente
          codigo={dossie.codigo}
          mes={aprofundando.mes}
          filtro={aprofundando.filtro}
          aoFechar={() => definirAprofundando(null)}
          //: DESCER EMPILHA no recorte já aberto, e não no filtro da tela: o
          //: caminho de dentro do painel é dele, e some quando o painel fecha.
          //: A tela de trás fica onde estava — é o que diferencia aprofundar de
          //: recortar.
          ultimoDegrau={aprofundando.ultimo}
          tituloPeloMes={aprofundando.peloMes}
          //: A NOTA OFICIAL DE CADA MÊS, da MESMA série que desenha a Jornada —
          //: `notas_das_lentes` é o número do ponto. Sem isto o painel abria sem
          //: nota e caía no impacto; ver `notaDoMes` em `RecorteDaLente`.
          notaDoMes={(mes) =>
            serie.find((ponto) => ponto.mes === mes)?.notas_das_lentes[dossie.codigo] ?? null
          }
          //: A FÓRMULA VIVA, que o servidor escreve com a régua em vigor — é o que
          //: o "?" do painel mostra na primeira seção.
          formula={dossie.formula}
          aoDescer={(chave, valor) =>
            definirAprofundando({
              ...aprofundando,
              filtro: { ...aprofundando.filtro, [chave]: valor },
              ultimo: chave,
              //: DESCER DENTRO DO PAINEL deixa de ser "o mês": o título passa a
              //: nomear o degrau que a pessoa abriu agora.
              peloMes: false,
            })
          }
          aoSubir={(chave) =>
            definirAprofundando({
              ...aprofundando,
              filtro: { ...aprofundando.filtro, [chave]: undefined },
              //: SUBIR NÃO DEIXA DEGRAU NOVO: o título cai no último da trilha
              //: que sobrou, que é o que a pessoa está vendo agora.
              ultimo: aprofundando.ultimo === chave ? undefined : aprofundando.ultimo,
            })
          }
        />
      ) : null}

      {/* ANTES DOS DOIS PAINÉIS, e a ordem é a da leitura: este cartão
          responde "onde está a causa" por seis cortes, e os painéis abaixo são
          os dois que a especificação fixou para a lente — eles aprofundam dois
          desses cortes. Ver o cartão primeiro e os painéis depois é descer; o
          contrário é ler a conclusão antes da pergunta. */}
      <OndeEstaACausa
        //: REMONTA AO TROCAR DE MÊS OU DE LENTE, e isto é achado de revisão: a
        //: aba escolhida é estado da tela, e o conjunto de abas muda com o mês
        //: (uma dimensão deixa de explicar e volta a explicar). Sem a chave, o
        //: estado antigo ressuscita: o cartão pulava de volta para "Autor" ao
        //: remover um recorte, mesmo que o último visível fosse "Tema".
        key={`${dossie.codigo}-${dossie.mes}`}
        abas={dossie.onde_esta_a_causa}
        filtro={filtro}
        //: PARTE DO RECORTE QUE JÁ ESTÁ NA TELA: aprofundar de dentro de um mês
        //: já filtrado por UF tem de significar "este tema, no Rio" — senão o
        //: número do painel e o número do modal discordam, e quem clicou não
        //: tem como saber por quê.
        aoAprofundar={aoAprofundar}
      />

      {/* `alignItems: 'stretch'` (o padrão do grid, por isso nem precisa
          declarar): os dois painéis crescem para a mesma altura, a do mais
          alto — sem isto, o cartão mais curto para no fim do próprio
          conteúdo e desalinha com o vizinho sempre que os dois tipos de
          gráfico não renderizam com a mesma altura por item. */}
      <div className="grade grade--2" style={{ gap: 16 }}>
        {dossie.paineis.map((painel, posicao) => (
          // A CHAVE INCLUI A POSIÇÃO: dois painéis com o mesmo título são
          // improváveis, mas `key` duplicada faz o React reaproveitar o estado
          // do componente errado — e o erro aparece como gráfico que não
          // atualiza, não como aviso.
          <ComFaixaDoTopo key={`${posicao}-${painel.titulo}`}>
            <Cartao estilo={{ height: '100%' }}>
              <CabecalhoDoBloco
                titulo={painel.titulo}
                conclusao={painel.conclusao}
                ficha={painel.ficha}
                ajuda={GUIA_DO_BLOCO[painel.titulo]}
              />
              {/* CLICÁVEL PELO QUE O SERVIDOR DIZ QUE ELE RECORTA, e não
                  por um palpite a partir do título: um clique em "Saneamento
                  básico" no painel de temas recorta a tela inteira por aquele
                  tema, igual à aba do cartão acima. Era isto que faltava para o
                  painel ser um degrau e não um quadro de leitura. */}
              <Painel bloco={painel} filtro={filtro} aoAprofundar={aoAprofundar} />
              <NotaDeFonte ficha={painel.ficha} />
            </Cartao>
          </ComFaixaDoTopo>
        ))}
      </div>

      <SinaisDoPeriodo dossie={dossie} />
    </>
  );
}

/** O que desta lente é ilustração, pelo nome.
 *
 *  Dizer só que "há" ilustração manda a pessoa abrir um "?" atrás do outro —
 *  e, quando não há gráfico ilustrativo nenhum, a faz desconfiar de números
 *  que estão certos. */
// DESLIGADO A PEDIDO DO JONES (2026-09-29): o banner confundia mais do que
// explicava. Fica fora da tela, sem tirar do código, até decidirmos uma
// forma mais clara de avisar sobre conteúdo transcrito do relatório.
const AVISO_DE_ILUSTRACAO_HABILITADO = false;

function AvisoDeIlustracao({ dossie }: { dossie: Dossie }) {
  if (!AVISO_DE_ILUSTRACAO_HABILITADO) return null;

  const aviso = avisoDeExemplo(dossie);
  if (!aviso?.graficos.length) return null;

  return (
    <FaixaDeAtencao
      mensagem={
        <>
          <strong>
            {aviso.graficos.length === 1
              ? `"${aviso.graficos[0]}" mostra`
              : `${aviso.graficos.map((titulo) => `"${titulo}"`).join(' e ')} mostram`}
          </strong>{' '}
          conteúdo de ilustração — transcrito do relatório do cliente, não medido por esta
          ferramenta. O <strong>?</strong> de cada um explica por quê.
        </>
      }
    />
  );
}

/* -- 1. o destaque ------------------------------------------------------------- */

function Destaque({ dossie }: { dossie: Dossie }) {
  const delta =
    dossie.delta === null ? '—' : dossie.delta > 0 ? `+${dossie.delta}` : `${dossie.delta}`;
  // "VS. MÊS ANTERIOR" SÓ FAZ SENTIDO SEM RECORTE: com um filtro ativo, o mês
  // passado não tem o mesmo tier/veículo/atributo/tema, e comparar os dois
  // seria maçã com laranja — por isso o servidor já manda outra base de
  // comparação (`sem_filtro`, a nota do mês inteiro) junto com outra legenda.
  const legendaDoDelta =
    dossie.delta_versus === 'sem_filtro' ? 'vs. sem recorte' : 'vs. mês anterior';

  return (
    <ComFaixaDoTopo>
    <Secao
      titulo={`${dossie.nome} · ${dossie.stakeholder}`}
      subtitulo={dossie.fontes.length ? `Fontes no cálculo: ${dossie.fontes.join(' · ')}` : undefined}
      acao={
        <BotaoDeProcedencia
          ficha={dossie.ficha_do_destaque}
          titulo={`Nota de ${dossie.nome}`}
          ajuda={GUIA_DO_DESTAQUE[dossie.codigo]}
        />
      }
    >
      {/* ANTES DOS NÚMEROS, e não depois: quem vê o gráfico primeiro já tirou
          a conclusão quando chega no rodapé. E NOMEANDO o que é ilustração —
          dizer só que "há" manda a pessoa abrir um "?" atrás do outro, e em
          duas lentes ela não acharia nada, porque ali só o texto é transcrito. */}
      <AvisoDeIlustracao dossie={dossie} />

      <div className="grade grade--mapa" style={{ gap: 16, alignItems: 'start' }}>
        <Cartao>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <span
              className="tabular"
              style={{ fontSize: 56, fontWeight: 800, lineHeight: 1, color: corDaFaixa(dossie.nota) }}
            >
              {dossie.nota ?? '—'}
            </span>
            <div>
              <div style={{ fontSize: 13, color: 'var(--cinza-2)' }}>
                {mesCurto(dossie.mes)} · {legendaDoDelta}{' '}
                <strong className="tabular">{delta}</strong>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <Chip rotulo={`peso ${dossie.peso}`} />
                {dossie.estimado ? <Chip rotulo="estimado" /> : null}
              </div>
            </div>
          </div>

          {dossie.recorte_filtrado ? (
            <div style={{ margin: '12px 0 0' }}>
              <Selo
                rotulo="Recorte filtrado — não é a nota oficial do mês"
                fundo="var(--atencao-bg)"
                texto="var(--atencao-fg)"
              />
            </div>
          ) : null}

          {dossie.ausencia ? (
            <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--atencao-fg)' }}>
              {dossie.ausencia}
            </p>
          ) : null}

          {dossie.manchete ? (
            <p style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.55 }}>
              {dossie.manchete}
            </p>
          ) : null}

          <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--cinza-2)', lineHeight: 1.6 }}>
            {dossie.formula}
          </p>
        </Cartao>

        <div className="grade grade--2" style={{ gap: 12 }}>
          {dossie.kpis.map((kpi) => (
            <Kpi key={kpi.rotulo} rotulo={kpi.rotulo} valor={kpi.valor} dica={kpi.detalhe} />
          ))}
        </div>
      </div>
    </Secao>
    </ComFaixaDoTopo>
  );
}

/* -- 2. a evolução, com os fatos do período ------------------------------------ */

function Evolucao({
  dossie,
  aoAprofundarNoMes,
}: {
  dossie: Dossie;
  /** Clicar numa barra abre o aprofundamento DAQUELE mês — o mesmo painel dos
   *  outros gráficos, com a conta do mês inteiro em vez de um recorte. */
  aoAprofundarNoMes: (mes: string) => void;
}) {
  const { evolucao } = dossie;

  return (
    <ComFaixaDoTopo>
    <Secao titulo="Evolução">
      <Cartao>
        <CabecalhoDoBloco
          titulo={evolucao.titulo}
          conclusao={evolucao.conclusao}
          ficha={evolucao.ficha}
          ajuda={GUIA_DO_BLOCO[evolucao.titulo]}
        />
        <Painel bloco={evolucao} fatos={dossie.fatos} aoAprofundarNoMes={aoAprofundarNoMes} />
        <QuadroDaEvolucao linhas={dossie.sinais_da_evolucao} />
        <NotaDeFonte ficha={evolucao.ficha} />

        {dossie.fatos.length ? (
          <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0 }}>
            {dossie.fatos.map((fato) => (
              <li
                key={`${fato.mes}-${fato.texto}`}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'baseline',
                  padding: '8px 0',
                  borderTop: '1px solid var(--borda)',
                }}
              >
                <span
                  className="tabular"
                  style={{ fontSize: 11, fontWeight: 700, color: 'var(--cinza-2)', minWidth: 48 }}
                >
                  {mesCurto(fato.mes)}
                </span>
                <span style={{ fontSize: 13, flex: 1 }}>{fato.texto}</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 5,
                    whiteSpace: 'nowrap',
                    color: COR_DO_EFEITO[fato.efeito],
                  }}
                >
                  {ROTULO_DO_EFEITO[fato.efeito] ?? fato.efeito}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

      </Cartao>
    </Secao>
    </ComFaixaDoTopo>
  );
}

/* -- 1.5. quem é a cobertura, e como está o clima dela -------------------------- */

/** Mesmo desenho de "% Interações por tier e Top instituições" do Painel
 *  (CRM) — rosca de volume por tier ao lado do Top 5 — só que por VEÍCULO em
 *  vez de instituição: o cadastro do CRM é da Aegea, mas um veículo de
 *  imprensa é terceiro, sem `id`, só o nome que a Clipei manda. Por isso os
 *  dois blocos (`volume_por_tier`, `top_veiculos`) vêm prontos do servidor,
 *  em vez de calculados no navegador como no Painel.
 *
 *  A ROSCA É CLICÁVEL, E O CLIQUE É O MESMO FILTRO DA BARRA DE CIMA: clicar
 *  numa fatia de tier chama `definirFiltro` com aquele tier — a mesma
 *  chamada que o campo "Tier" da `BarraDeFiltroDaLente` já faz. Não existe
 *  um segundo mecanismo de recorte: a tela inteira (nota, KPIs, evolução, o
 *  Top 5 ao lado) já reage a `filtro.tier` porque o servidor filtra tudo por
 *  ele — clicar na rosca só economiza abrir o campo lá em cima. */
function VolumeETopVeiculos({
  dossie,
  filtro,
  definirFiltro,
}: {
  dossie: Dossie;
  filtro: FiltroDaLente;
  definirFiltro: (filtro: FiltroDaLente) => void;
}) {
  const { volume_por_tier: rosca, top_veiculos: ranking } = dossie;
  const itensDaRosca = rosca.dados.map((linha) => ({
    chave: comoTexto(linha.chave),
    rotulo: comoTexto(linha.rotulo),
    total: comoNumero(linha.total ?? 0),
    cor: linha.cor ? comoTexto(linha.cor) : undefined,
  }));

  return (
    <ComFaixaDoTopo>
    <Secao
      titulo="% Matérias por tier e Top veículos"
      subtitulo="Volume de matérias pela relevância (tier) do veículo"
      ajuda={GUIA_DO_BLOCO[rosca.titulo]}
      estilo={{ height: '100%' }}
    >
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 auto' }}>
          <Rosca
            itens={itensDaRosca}
            ativo={filtro.tier}
            aoClicar={(tier) =>
              definirFiltro({ ...filtro, tier: filtro.tier === tier ? undefined : tier })
            }
            rotuloCentral="matérias"
          />
        </div>
        <div style={{ flex: '1 1 180px', minWidth: 160 }}>
          <div className="kicker" style={{ marginBottom: 12 }}>
            Top 5 veículos
          </div>
          {/* CLICÁVEL PELO MESMO MOTIVO DA ROSCA: clicar num veículo filtra
              a tela inteira por ele — inclusive "Últimas matérias" mais
              abaixo, que vira a lista de matérias DAQUELE veículo sem
              precisar de um modal à parte. */}
          <Ranking
            itens={ranking.dados.map((linha) => ({
              chave: comoTexto(linha.rotulo),
              rotulo: comoTexto(linha.rotulo),
              total: comoNumero(linha.valor ?? 0),
              // CINZA ESCURO, não azul-mar — mesmo ajuste do Painel (CRM): o
              // azul já é a cor do Tier 1 na rosca ao lado, e
              // as duas barras do mesmo tom confundiam "isto é sobre tier"
              // com "isto é o ranking de veículos".
              cor: 'var(--cinza-4)',
            }))}
            ativo={filtro.veiculo}
            aoClicar={(veiculo) =>
              definirFiltro({
                ...filtro,
                veiculo: filtro.veiculo === veiculo ? undefined : veiculo,
              })
            }
            vazio="Nada registrado no período."
          />
        </div>
      </div>
      <NotaDeFonte ficha={rosca.ficha} />
    </Secao>
    </ComFaixaDoTopo>
  );
}

/** O placar de clima por veículo — mesmo desenho de "Clima por Instituições"
 *  do Painel (CRM), incluindo a interação: clicar num veículo (ex.:
 *  InfoMoney) filtra a tela inteira por ele, igual à rosca e ao Top 5 ao
 *  lado. "Ver as matérias daquele veículo" é abrir "Últimas matérias" logo
 *  abaixo já filtrada — não um modal à parte. */
function ClimaPorVeiculos({
  dossie,
  filtro,
  definirFiltro,
}: {
  dossie: Dossie;
  filtro: FiltroDaLente;
  definirFiltro: (filtro: FiltroDaLente) => void;
}) {
  const bloco = dossie.clima_por_veiculos;

  return (
    <ComFaixaDoTopo>
    <Secao titulo="Clima por Veículos" ajuda={GUIA_DO_BLOCO[bloco.titulo]}>
      <Cartao>
        <BarraDivergentePorItem
          itens={bloco.dados.map((linha) => ({
            chave: comoTexto(linha.chave),
            rotulo: comoTexto(linha.rotulo),
            total: comoNumero(linha.total ?? 0),
            score: comoNumero(linha.score ?? 0),
          }))}
          ativo={filtro.veiculo}
          aoClicar={(veiculo) =>
            definirFiltro({
              ...filtro,
              veiculo: filtro.veiculo === veiculo ? undefined : veiculo,
            })
          }
          unidade={{ singular: 'matéria', plural: 'matérias' }}
          variante="termometro"
        />
        <NotaDeFonte ficha={bloco.ficha} />
      </Cartao>
    </Secao>
    </ComFaixaDoTopo>
  );
}

/* -- 1.6. do amplo ao específico: drivers, temas e matérias --------------------- */

/** Um bloco autônomo abaixo da Evolução, no mesmo molde dela (faixa, seção,
 *  cabeçalho, ficha) — mas sem o extra de fatos/sinais, que é só da Evolução.
 *
 *  OS TRÊS (Drivers e riscos, Temas mais falados, Últimas matérias) REAGEM
 *  AO MESMO RECORTE da barra de filtro lá em cima: o servidor já aplica
 *  tier/veículo/atributo/tema em cada consulta, então os três estreitam
 *  juntos quando alguém filtra — é a mesma régua "do amplo ao específico"
 *  levada até a linha, não três drill-downs independentes. */
function BlocoAmplo({
  titulo,
  bloco,
  filtro,
  aoAprofundar,
}: {
  titulo: string;
  bloco: Bloco;
  /** OS DOIS JUNTOS, OU NENHUM — mesmo contrato de `Painel`: o bloco só fica
   *  clicável quando a tela sabe onde levar o clique, e só quando o servidor diz
   *  o que ele recorta (`bloco.recorta`). */
  filtro?: FiltroDaLente;
  aoAprofundar?: (chave: string, valor: string) => void;
}) {
  return (
    <ComFaixaDoTopo>
    <Secao titulo={titulo}>
      <Cartao>
        <CabecalhoDoBloco
          titulo={bloco.titulo}
          conclusao={bloco.conclusao}
          ficha={bloco.ficha}
          ajuda={GUIA_DO_BLOCO[bloco.titulo]}
        />
        <Painel bloco={bloco} filtro={filtro} aoAprofundar={aoAprofundar} />
        <NotaDeFonte ficha={bloco.ficha} />
      </Cartao>
    </Secao>
    </ComFaixaDoTopo>
  );
}

/* -- o roteador de tipos ------------------------------------------------------- */

function Painel({
  bloco,
  fatos = [],
  filtro,
  aoAprofundar,
  aoAprofundarNoMes,
}: {
  bloco: Bloco;
  fatos?: Dossie['fatos'];
  /** OS DOIS JUNTOS, OU NENHUM: o painel só fica clicável quando a tela sabe
   *  onde levar o clique. Os blocos amplos (Drivers, Temas mais falados, Últimas
   *  matérias) desenham sem eles, e continuam só de leitura. */
  filtro?: FiltroDaLente;
  aoAprofundar?: (chave: string, valor: string) => void;
  /** Só a Evolução usa: clicar na COLUNA de um mês abre o aprofundamento dele. */
  aoAprofundarNoMes?: (mes: string) => void;
}) {
  // A DIMENSÃO VEM DO SERVIDOR (`bloco.recorta`). Sem ela — ou sem quem receba
  // o clique — não há clique: uma barra que parece clicável e não é custa mais
  // do que uma que não parece.
  const chave =
    bloco.recorta && aoAprofundar ? (bloco.recorta as keyof FiltroDaLente) : undefined;
  const recortado = chave && filtro ? filtro[chave] : undefined;
  const aoRecortar =
    chave && aoAprofundar ? (rotulo: string) => aoAprofundar(chave, rotulo) : undefined;

  // `unknown`, e não `never`. O payload de cada tipo de gráfico tem um formato
  // diferente, e dizer ao TypeScript que campo nenhum existe (`never`) o faz
  // parar de conferir qualquer coisa — um `any` com outro nome. A conversão
  // acontece na fronteira, uma vez, com `comoNumero`/`comoTexto` à vista.
  const dados = bloco.dados;

  if (bloco.tipo === 'barras_empilhadas') {
    const porMes = new Map(fatos.map((fato) => [fato.mes, fato]));
    return (
      <BarrasEmpilhadas
        //: A COLUNA INTEIRA ABRE O MÊS. A faixa colorida não: ela recortaria por
        //: sentimento, que não é dimensão de recorte desta tela — e um clique que
        //: às vezes abre o mês e às vezes não faz a pessoa parar de clicar.
        aoClicarMes={aoAprofundarNoMes}
        colunas={dados.map((linha) => {
          const semClassificacao = comoNumero(linha.sem_classificacao ?? 0);
          const classificadas =
            comoNumero(linha.positivo ?? 0) + comoNumero(linha.neutro ?? 0) + comoNumero(linha.negativo ?? 0);
          const [pos, neu, neg] = bloco.legenda.length
            ? bloco.legenda
            : ['Positivo', 'Neutro', 'Negativo'];
          // A COR, QUANDO O SERVIDOR MANDA (hoje só a institucional, com o
          // mesmo cor_hex do dicionário de clima que pinta o Painel), VENCE o
          // tom genérico — ver `BlocoSaida.cores` em `app/api/lentes.py`. Sem
          // ela, cai nos tons de positivo/neutro/negativo do design system.
          const [corPos, corNeu, corNeg] = bloco.cores.length
            ? bloco.cores
            : ['var(--ok-fg)', 'var(--cinza-1)', 'var(--erro-fg)'];
          return {
            mes: comoTexto(linha.mes),
            total: classificadas + semClassificacao,
            semBase: Boolean(linha.sem_base),
            segmentos: [
              { chave: 'pos', rotulo: pos, total: comoNumero(linha.positivo ?? 0), cor: corPos },
              { chave: 'neu', rotulo: neu, total: comoNumero(linha.neutro ?? 0), cor: corNeu },
              { chave: 'neg', rotulo: neg, total: comoNumero(linha.negativo ?? 0), cor: corNeg },
              // O VOLUME QUE NINGUÉM LEU. Uma faixa cinza-azulada, distinta do
              // neutro: neutro é leitura, isto é ausência de leitura. Some
              // sozinha quando o total é zero.
              {
                chave: 'sem',
                rotulo: 'Sem classificação',
                total: semClassificacao,
                cor: 'var(--cinza-2)',
              },
            ],
          };
        })}
        formatarRotulo={mesCurto}
        detalheDoMes={(coluna) => {
          const fato = porMes.get(coluna.mes);
          return fato ? [{ rotulo: ROTULO_DO_EFEITO[fato.efeito] ?? 'Fato', valor: fato.texto }] : [];
        }}
      />
    );
  }

  if (bloco.tipo === 'barras_pareadas') {
    return (
      <BarrasPareadas
        meses={dados.map((linha) => ({
          mes: comoTexto(linha.mes),
          recebidas: comoNumero(linha.recebidas ?? 0),
          respondidas: linha.respondidas === null || linha.respondidas === undefined
            ? null
            : comoNumero(linha.respondidas),
          sem_base: Boolean(linha.sem_base),
        }))}
        fatos={Object.fromEntries(
          fatos.map((fato) => [fato.mes, { texto: fato.texto, efeito: fato.efeito }]),
        )}
      />
    );
  }

  if (bloco.tipo === 'linha_do_tempo') {
    return (
      <LinhaDoTempo
        meses={dados.map((linha) => ({
          mes: comoTexto(linha.mes),
          eventos: (linha.eventos ?? []) as { texto: string; efeito: string }[],
        }))}
      />
    );
  }

  if (bloco.tipo === 'barras_100') {
    return (
      <BarrasCemPorCento
        itens={dados.map((linha) => ({
          rotulo: comoTexto(linha.rotulo),
          positivo: comoNumero(linha.positivo ?? 0),
          neutro: comoNumero(linha.neutro ?? 0),
          negativo: comoNumero(linha.negativo ?? 0),
          sem_classificacao: comoNumero(linha.sem_classificacao ?? 0),
          sem_base: Boolean(linha.sem_base),
        }))}
        legenda={bloco.legenda.length ? bloco.legenda : undefined}
        cores={bloco.cores.length ? bloco.cores : undefined}
        ativo={recortado}
        aoClicar={aoRecortar}
      />
    );
  }

  if (bloco.tipo === 'barras_horizontais') {
    return (
      <Ranking
        itens={dados.map((linha) => ({
          chave: comoTexto(linha.rotulo),
          rotulo: comoTexto(linha.rotulo),
          total: comoNumero(linha.valor ?? 0),
          cor: 'var(--azul-mar)',
        }))}
        vazio="Nada registrado no período."
        ativo={recortado}
        aoClicar={aoRecortar}
        detalheAoPassarMouse={(chave) => {
          const linha = dados.find((item) => comoTexto(item.rotulo) === chave);
          const detalhe = linha?.detalhe as string | undefined;
          return detalhe ? [{ rotulo: 'Pico', valor: detalhe }] : [];
        }}
      />
    );
  }

  if (bloco.tipo === 'rosca') {
    return (
      <Rosca
        itens={dados.map((linha) => ({
          chave: comoTexto(linha.chave),
          rotulo: comoTexto(linha.rotulo),
          total: comoNumero(linha.total ?? 0),
          cor: linha.cor ? comoTexto(linha.cor) : undefined,
        }))}
        rotuloCentral="matérias"
      />
    );
  }

  if (bloco.tipo === 'divergente_por_item') {
    return (
      <BarraDivergentePorItem
        itens={dados.map((linha) => ({
          chave: comoTexto(linha.chave),
          rotulo: comoTexto(linha.rotulo),
          total: comoNumero(linha.total ?? 0),
          score: comoNumero(linha.score ?? 0),
        }))}
        unidade={{ singular: 'matéria', plural: 'matérias' }}
        variante="termometro"
      />
    );
  }

  if (bloco.tipo === 'escala_1a5') {
    return (
      <EscalaDeCinco
        itens={dados.map((linha) => ({
          rotulo: comoTexto(linha.rotulo),
          nota: comoNumero(linha.nota ?? 0),
          detalhe: (linha.detalhe as string | null) ?? null,
        }))}
        vazio="Nenhum estudo de percepção cobre este mês."
      />
    );
  }

  if (bloco.tipo === 'matriz_prioridade') {
    return (
      <MatrizDePrioridade
        linhas={dados.map((linha) => ({
          nome: comoTexto(linha.nome),
          veiculo: (linha.veiculo as string | null) ?? null,
          relevancia: comoNumero(linha.relevancia ?? 0),
          exposicao: comoNumero(linha.exposicao ?? 0),
          proximidade: comoNumero(linha.proximidade ?? 0),
          pontos: comoNumero(linha.pontos ?? 0),
          prioridade: comoNumero(linha.prioridade ?? 4),
          cadencia: comoTexto(linha.cadencia ?? ''),
        }))}
      />
    );
  }

  if (bloco.tipo === 'tabela') {
    return (
      <TabelaDeLeitura
        colunas={colunasDaTabela(bloco)}
        linhas={dados}
        enderecoDaLinha={enderecoDaLinhaDo(bloco)}
      />
    );
  }

  // Um tipo que a tela não conhece é erro de contrato, e some sem avisar se
  // for tratado com `null`.
  return (
    <p style={{ fontSize: 13, color: 'var(--atencao-fg)', margin: 0 }}>
      Esta versão da tela não sabe desenhar &ldquo;{bloco.tipo}&rdquo;.
    </p>
  );
}

/* -- 5. os sinais do período --------------------------------------------------- */

/** O que a série mensal diz, ao lado do gráfico que a prova.
 *
 *  ERA UM QUADRO DE PARÁGRAFOS ESCRITOS À MÃO, todo mês, e envelhecia em
 *  silêncio: a leitura de junho continuava na tela em setembro, com a mesma
 *  cara de atual. Agora são as frases dos detectores sobre a própria série —
 *  mudar um dado muda o quadro na próxima leitura.
 */
function QuadroDaEvolucao({ linhas }: { linhas: string[] }) {
  if (!linhas.length) return null;
  return (
    <div
      style={{
        marginTop: 16,
        padding: '12px 14px',
        borderRadius: 10,
        background: 'var(--bg-trilho)',
      }}
    >
      <h4
        style={{
          margin: '0 0 8px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: 'var(--cinza-2)',
        }}
      >
        Sinais da evolução
      </h4>
      <ul style={{ margin: 0, padding: '0 0 0 18px' }}>
        {linhas.map((linha) => (
          <li key={linha} style={{ fontSize: 13, lineHeight: 1.6 }}>
            {linha}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** O bloco que fecha a tela: o que mudou no período, por intensidade.
 *
 *  CADA LINHA DIZ ONDE CONFERIR. Sem isso a lista vira cinco afirmações
 *  soltas, e quem duvida de uma não sabe em que gráfico olhar — que é
 *  exatamente o que faz alguém parar de confiar no painel inteiro.
 */
function SinaisDoPeriodo({ dossie }: { dossie: Dossie }) {
  const reais = quantosSinaisReais(dossie.sinais);
  const lacunas = dossie.sinais.length - reais;

  return (
    <ComFaixaDoTopo>
    <Secao
      titulo="Sinais do período"
      subtitulo={
        dossie.sinais.length
          ? `${reais} ${reais === 1 ? 'sinal' : 'sinais'} acima dos limites` +
            (lacunas ? ` · ${lacunas} ${lacunas === 1 ? 'lacuna' : 'lacunas'} de dado` : '')
          : undefined
      }
      ajuda={
        'Cada frase sai de uma regra determinística sobre os próprios dados — ' +
        'nunca de texto escrito à mão, e nunca de um modelo de linguagem. Os ' +
        'limites de cada regra ficam na Calibração.'
      }
    >
      <Cartao>
        {dossie.sinais.length ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {dossie.sinais.map((sinal, posicao) => (
              <LinhaDeSinal
                key={`${posicao}-${sinal.frase}`}
                sinal={sinal}
                primeira={posicao === 0}
              />
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--cinza-2)' }}>
            Sem variação relevante no período pelas regras atuais.
          </p>
        )}
      </Cartao>
    </Secao>
    </ComFaixaDoTopo>
  );
}

function LinhaDeSinal({ sinal, primeira }: { sinal: SinalDoDossie; primeira: boolean }) {
  const cor = corDoTom(sinal.tom);
  return (
    <li
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'baseline',
        flexWrap: 'wrap',
        padding: '10px 0',
        borderTop: primeira ? undefined : '1px solid var(--borda)',
      }}
    >
      <Chip rotulo={sinal.tipo} fundo={cor.fundo} texto={cor.texto} />
      <span style={{ fontSize: 11.5, color: 'var(--cinza-2)', whiteSpace: 'nowrap' }}>
        {sinal.onde}
      </span>
      <span style={{ fontSize: 13.5, flex: 1, minWidth: 220, lineHeight: 1.55 }}>
        {sinal.frase}
      </span>
      <span
        className="tabular"
        style={{
          fontSize: 14,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          color: sinal.tom === 'neu' ? 'var(--tinta)' : cor.texto,
        }}
      >
        {sinal.evidencia}
      </span>
    </li>
  );
}
