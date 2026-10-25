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

import { DESCRICAO_DAS_LENTES } from '@/dominio/descricaoDasLentes';
import { useEffect, useState } from 'react';

import type { FiltroDaLente, OpcoesDeFiltroDaLente } from '@/api/cliente';
import { obterDossieDaLente, obterOpcoesDeFiltroDaLente } from '@/api/cliente';
import { Abas } from '@/componentes/Abas';
import { BarraDeFiltroDaLente } from '@/paginas/score/BarraDeFiltroDaLente';
import { RecorteDaLente } from '@/paginas/score/RecorteDaLente';
import { ConsultaEmProfundidade } from '@/paginas/score/consulta/ConsultaEmProfundidade';
import { LENTES_COM_DRILL } from '@/paginas/score/consulta/dados/useConsultaDaLente';
import { lerEndereco } from '@/paginas/score/consulta/endereco';
import { EVENTO_DO_ENDERECO } from '@/paginas/score/consulta/useEnderecoDoDrill';
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
import { mesesMedidos, serieDaLente } from '@/dominio/janelaDaJornada';
import type { Janela } from '@/dominio/janelaDaJornada';
import { ExploradorDaLente } from '@/paginas/score/ExploradorDaLente';
import { ExploradorDeVeiculos } from '@/paginas/score/ExploradorDeVeiculos';
import { PainelDaJornada } from '@/paginas/score/PainelDaJornada';
import { BlocoExpansivel } from '@/componentes/BlocoExpansivel';
import { FILTROS_DAS_LENTES, LENTES_COM_FILTRO } from '@/dominio/filtrosDasLentes';
import { corDaFaixa, corForteDaLente } from '@/dominio/score';
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

//: `de` É A CONTRAÇÃO DO TÍTULO DA JORNADA, que concorda com o nome da lente:
//: "Jornada da Imprensa", "do Mercado", "dos Clientes". Sem ela, um "da" fixo
//: escrevia "Jornada da Mercado".
const LENTES = [
  { id: 'imprensa', rotulo: 'Imprensa', de: 'da' },
  { id: 'mercado', rotulo: 'Mercado', de: 'do' },
  { id: 'sociedade', rotulo: 'Sociedade digital', de: 'da' },
  { id: 'clientes', rotulo: 'Clientes', de: 'dos' },
  { id: 'institucional', rotulo: 'Institucional', de: 'do' },
];

//: AS LENTES QUE TÊM DRILL DOWN (decisão D2 da Consulta em profundidade): a
//: Imprensa com os quatro níveis e o Mercado com o Nível 1. Nas outras três o
//: bloco "Drill down" NÃO APARECE, em vez de aparecer vazio ou "em
//: construção" — elas ficam para uma próxima rodada. A LISTA MORA COM O HOOK
//: DOS DADOS (`LENTES_COM_DRILL`), que só busca a consulta destas lentes.

//: DESLIGADO por pedido (2026-10-16): o bloco some da tela para Imprensa e
//: Mercado — as únicas com drill hoje —, sem mexer no resto do código (ver o
//: uso logo abaixo e o mesmo desligamento, pela mesma data, em
//: `DRILL_NA_BUSCA_LIGADO` em `Score.tsx`, para a busca inteligente). Virar
//: `true` religa as duas pontas.
const DRILL_LIGADO = false;

/** O endereço pede um nível abaixo do primeiro (há `pilar` no hash do drill).
 *  É o que faz o bloco abrir sozinho (decisão A6). */
function enderecoProfundo(): boolean {
  const endereco = lerEndereco(window.location.hash);
  return endereco.ativo && Boolean(endereco.pilar);
}

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
  const daLente = LENTES.find((item) => item.id === lente);
  const nomeDaLente = daLente?.rotulo ?? lente;
  const contracao = daLente?.de ?? 'da';
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

  //: A JANELA DA JORNADA MORA AQUI, com a lente junto: trocar de lente volta ao
  //: padrão, como a Jornada fazia ao remontar (`key={lente}`). O filtro rápido
  //: deixou de mexer nela (21/10/2026): ele escolhe o MÊS da Síntese.
  const [janelaDaLente, definirJanelaDaLente] = useState<{ lente: string; janela: Janela | null }>({
    lente,
    janela: null,
  });
  const janelaEscolhida = janelaDaLente.lente === lente ? janelaDaLente.janela : null;
  const definirJanela = (janela: Janela | null) => definirJanelaDaLente({ lente, janela });
  const serieDestaLente = serieDaLente(serie, lente);
  const mesesDaJornada = mesesMedidos(serieDestaLente);

  useEffect(() => {
    // SÓ AS LENTES QUE TÊM FILTRO (`FILTROS_DAS_LENTES`): a Institucional não
    // tem recorte, e buscar opções que a tela nem desenha
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

  //: OS DOIS BLOCOS EXPANSÍVEIS, por pedido: a Jornada fica sempre à mostra, e
  //: o resto da lente se divide em "Síntese executiva" (os gráficos de sempre)
  //: e "Drill down". AQUI, E NÃO DENTRO DE CADA BLOCO, para o que a pessoa abriu
  //: continuar aberto quando ela troca de lente ou de mês.
  //:
  //: O DRILL ABRE SOZINHO QUANDO O ENDEREÇO DESCE NELE (decisão A6), e fechar
  //: à mão continua valendo. Duas entradas, nenhuma delas `setState` no corpo
  //: de um efeito:
  //:  - AO MONTAR (recarregar a página, voltar de outra aba), o estado já
  //:    nasce aberto se o hash tem `pilar` (inicialização preguiçosa).
  //:  - DEPOIS, ASSINANDO OS EVENTOS do endereço (`popstate` e
  //:    `EVENTO_DO_ENDERECO`, que toda navegação programática dispara, como a
  //:    da busca do cabeçalho): o handler abre o bloco se o novo endereço é
  //:    profundo. O efeito só assina; quem muda o estado é o handler.
  //: POR QUE NÃO DERIVAR DO ENDEREÇO (aberto = nível > 1): subir pela trilha
  //: até o Nível 1 fecharia o bloco debaixo do clique, e depois de fechar à
  //: mão uma busca nova não o reabriria. É a NAVEGAÇÃO que abre, não o nível.
  const [abertos, definirAbertos] = useState(() => ({
    drill: enderecoProfundo(),
  }));
  const alternar = (bloco: 'drill') =>
    definirAbertos((atual) => ({ ...atual, [bloco]: !atual[bloco] }));

  useEffect(() => {
    const aoNavegar = () => {
      if (!enderecoProfundo()) return;
      definirAbertos((atual) => (atual.drill ? atual : { ...atual, drill: true }));
    };
    window.addEventListener('popstate', aoNavegar);
    window.addEventListener(EVENTO_DO_ENDERECO, aoNavegar);
    return () => {
      window.removeEventListener('popstate', aoNavegar);
      window.removeEventListener(EVENTO_DO_ENDERECO, aoNavegar);
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        //: A COR DA LENTE VALE PARA A ABA INTEIRA, por pedido: títulos das
        //: seções ("Jornada do Mercado"), curva da Jornada e barras dos
        //: rankings. Variáveis, e não uma prop em cada gráfico, para o que for
        //: acrescentado depois já nascer na cor certa.
        ['--cor-da-lente' as string]: corForteDaLente(lente),
        ['--cor-dos-titulos' as string]: corForteDaLente(lente),
      }}
    >
      <Abas
        abas={LENTES}
        ativa={lente}
        aoTrocar={aoTrocarLente}
        rotulo="Lente do Score"
        prefixo="lente"
        corDaAba={corForteDaLente}
      />

      {/* A JORNADA DA LENTE ABRE A ABA, por pedido: o mesmo bloco da Visão
          geral (cartões, janela, pico e vale, frase de cabeçalho), sobre a
          nota DESTA lente — e sem "Comparar com": dentro da lente só se vê a
          jornada dela. Não segue os filtros acima: é a nota do mês da lente. */}
      <PainelDaJornada
        key={lente}
        titulo={`Jornada ${contracao} ${nomeDaLente}`}
        sujeito={`A lente ${nomeDaLente}`}
        serie={serieDestaLente}
        mes={mes}
        aoEscolherMes={aoTrocarMes}
        janela={janelaEscolhida}
        aoMudarJanela={definirJanela}
        comIndiceGeral
        dica="Clique num mês para ver a lente naquele mês."
        //: A PREMISSA DO SCORE DA LENTE, quando ela tem uma a dizer (pedido de
        //: 21/10/2026, para o Mercado): o que entra na conta e o que fica fora.
        subtitulo={DESCRICAO_DAS_LENTES[lente]?.premissa}
      />


      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      {/* "SÍNTESE EXECUTIVA" COMO NO CRM DOS STAKEHOLDERS, por pedido: um
          título grande e centralizado, no degradê da marca, e os gráficos
          sempre à mostra — deixou de ser um bloco que se abre num botão. */}
      <h2
        style={{
          textAlign: 'center',
          fontSize: 34,
          fontWeight: 800,
          margin: '8px 0 0',
          backgroundImage: 'linear-gradient(120deg, var(--azul-mar) 0%, var(--turquesa-rio) 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Síntese Executiva
      </h2>

      {/* OS FILTROS RÁPIDOS SÓ A PARTIR DAQUI, por pedido (21/10/2026): eles
          valem para a Síntese executiva, e não para a Jornada acima. Logo
          embaixo do título, e congelados sob o cabeçalho ao rolar: a faixa é
          `sticky` e o pai dela é a coluna da aba inteira (`display: contents`
          na barra), então ela acompanha a rolagem até o fim da lente.

          O PRIMEIRO CAMPO É O MÊS, e não mais "Últimos 3 meses": a Síntese é de
          um mês, e escolher outro aqui é o mesmo gesto de clicar no mês da
          Jornada. A Institucional não tem recorte, e mostra só o mês. */}
      <BarraDeFiltroDaLente
        lente={lente}
        filtro={filtro}
        definirFiltro={definirFiltro}
        opcoes={opcoes}
        mesDaSintese={{
          meses: mesesDaJornada.map((ponto) => ponto.mes),
          mes,
          aoEscolher: aoTrocarMes,
        }}
      />
      {!dossie && !erro ? <Carregando /> : null}
      {/* O CORPO NÃO RECEBE MAIS `definirFiltro` (23/10/2026): os três cartões
          de veículo eram os únicos blocos dele que mexiam no filtro da TELA, e
          deram lugar ao Explorador de veículos, cuja seleção é local. Quem
          muda o recorte agora é só a barra de filtros acima. */}
      {dossie ? (
        <Conteudo dossie={dossie} filtro={filtro} serie={serie} opcoes={opcoes} />
      ) : null}

      {DRILL_LIGADO && LENTES_COM_DRILL.includes(lente) ? (
        <BlocoExpansivel
          titulo="Drill down"
          descricao="Do pilar ao tema e ao subtema, descendo até a menção."
          aberto={abertos.drill}
          aoAlternar={() => alternar('drill')}
        >
          <ConsultaEmProfundidade lente={lente} mes={mes} />
        </BlocoExpansivel>
      ) : null}
    </div>
  );
}

function Conteudo({
  dossie,
  filtro,
  serie,
  opcoes,
}: {
  dossie: Dossie;
  filtro: FiltroDaLente;
  serie: PontoDaSerie[];
  /** Os valores dos filtros no mês — para o painel de aprofundamento oferecer
   *  o refino (Concessionária, Tier, Sentimento). */
  opcoes: OpcoesDeFiltroDaLente | null;
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
  //: `extras` É O RECORTE QUE SÓ O BLOCO CONHECE, e existe por um bloco só: o
  //: Explorador de veículos filtra por tier DENTRO dele, sem mexer na barra de
  //: filtros da tela. A barra que a pessoa clica no Termômetro conta a fatia
  //: `tier ∩ veículo`, e mandar só o veículo abriria o modal com o veículo
  //: inteiro — outro número que o da barra clicada. Achado da revisão do Codex
  //: (23/10/2026).
  //:
  //: É A MESMA REGRA DE `aoAprofundarNoMes`, logo abaixo: o modal conta o que a
  //: barra contou. Opcional porque os outros blocos não têm recorte próprio —
  //: o deles JÁ é o filtro da tela.
  const aoAprofundar = (chave: string, valor: string, extras?: Partial<FiltroDaLente>) =>
    definirAprofundando({
      mes: dossie.mes,
      filtro: { ...filtro, ...extras, [chave]: valor },
      ultimo: chave,
    });
  //: "TIER DO VEÍCULO × SENTIMENTO" GANHOU LUGAR PRÓPRIO (21/10/2026), fora
  //: da grade genérica de `dossie.paineis` — ver o comentário mais abaixo,
  //: onde ele é desenhado. O que sobra na grade segue genérico, por pedido do
  //: cabeçalho deste arquivo: "o servidor diz que gráfico desenhar".
  const painelDeTier1 = dossie.paineis.find((p) => p.titulo === 'Tier do veículo × sentimento');
  const outrosPaineis = dossie.paineis.filter((p) => p !== painelDeTier1);
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
      {/* SEM O CARTÃO DA NOTA NAS LENTES DE CLIPPING, por pedido: a Jornada
          do índice, logo acima, já mostra a nota e a variação da lente. */}
      {LENTES_DE_CLIPPING.includes(dossie.codigo) ? null : <Destaque dossie={dossie} />}
      <Evolucao dossie={dossie} aoAprofundarNoMes={aoAprofundarNoMes} />

      {/* A DIMENSÃO DE VEÍCULO EM UM BLOCO SÓ (23/10/2026, por pedido), no
          molde do Explorador de taxonomia: três painéis que se filtram entre
          si somando no navegador.

          ANTES ERAM TRÊS CARTÕES INDEPENDENTES que respondiam ao filtro da
          TELA — cada clique ia ao servidor e movia o dossiê inteiro (nota,
          KPIs, evolução, últimas matérias), e o painel clicado ficava com uma
          barra só, então era preciso desfazer o clique antes de trocar de
          seleção. Ver `LENTES_DE_CLIPPING` para as medidas que trouxeram o
          Mercado e a Institucional. */}
      {LENTES_DE_CLIPPING.includes(dossie.codigo) ? (
        <ExploradorDeVeiculos
          key={`veiculos-${dossie.codigo}-${dossie.mes}`}
          codigo={dossie.codigo}
          mes={dossie.mes}
          filtro={filtro}
          //: O MESMO MODAL DA EVOLUÇÃO, noutro recorte: clicar num veículo do
          //: Termômetro abre o aprofundamento daquele veículo. Foi o que
          //: substituiu o bloco "Últimas matérias", que saiu logo abaixo.
          aoAprofundar={aoAprofundar}
        />
      ) : null}

      {/* "Tier do veículo × sentimento" saiu da grade de baixo em 21/10/2026
          (onde dividia a largura com "Matriz de relacionamento com
          jornalistas") e ganhou lugar fixo aqui, na largura inteira.

          E SÓ APARECE ONDE NÃO HÁ O EXPLORADOR DE VEÍCULOS (23/10/2026):
          a PRIMEIRA COLUNA dele é esta mesma leitura, e desenhar os dois punha
          tier duas vezes na tela. Achado da revisão do Codex — nenhum teste
          pegava, porque o fixture manda `paineis: []` e em produção aquela
          lista traz o painel.

          A LENTE QUE NÃO TEM O BLOCO continua com o cartão: o servidor manda
          o painel para quem tem tier, e não é só as de clipping que o
          recebem. */}
      {painelDeTier1 && !LENTES_DE_CLIPPING.includes(dossie.codigo) ? (
        <CartaoDoPainel painel={painelDeTier1} filtro={filtro} aoAprofundar={aoAprofundar} />
      ) : null}

      {/* SEM DRIVERS E RISCOS NAS LENTES DE CLIPPING, por pedido: o popup da
          Evolução (N1 › N2 › N3) já responde de onde vem o sentimento do mês. */}
      {LENTES_DE_CLIPPING.includes(dossie.codigo) ? null : (
        <BlocoAmplo titulo="Drivers e riscos" bloco={dossie.drivers_e_riscos} />
      )}
      {/* N1 › N2 › N3 E O MAPA POR UF, por pedido, no lugar de "Drivers e
          riscos" e "Temas mais falados": os três níveis da taxonomia lado a
          lado, que se filtram com um clique, e o termômetro por estado. */}
      {LENTES_DE_CLIPPING.includes(dossie.codigo) ? (
        <ExploradorDaLente
          key={`explorador-${dossie.codigo}-${dossie.mes}`}
          codigo={dossie.codigo}
          mes={dossie.mes}
          filtro={filtro}
          aoAprofundar={aoAprofundar}
        />
      ) : null}
      {/* CLICÁVEL: a barra de um tema abre o aprofundamento dele, e DENTRO do
          painel a primeira aba é o Subtema — que é onde "Saneamento básico"
          deixa de ser um rótulo e passa a dizer o que aconteceu. */}
      {LENTES_DE_CLIPPING.includes(dossie.codigo) ? null : (
        <BlocoAmplo
          titulo="Temas mais falados"
          bloco={dossie.temas_mais_falados}
          filtro={filtro}
          aoAprofundar={aoAprofundar}
        />
      )}

      {/* O APROFUNDAMENTO, por cima de tudo. Montado só quando há recorte
          aberto: um modal montado e invisível continua carregando dados. */}
      {aprofundando ? (
        <RecorteDaLente
          codigo={dossie.codigo}
          nomeDaLente={dossie.nome}
          filtrosRapidos={FILTROS_DAS_LENTES[dossie.codigo]?.rapidos}
          //: AS OPÇÕES SÃO DO MÊS DA TELA, e o painel pode estar num mês
          //: ANTERIOR — é o que acontece ao clicar numa coluna da Evolução. Sem
          //: esta comparação o refinamento oferecia os valores de junho dentro
          //: do painel de abril: escolher uma concessionária que só existe em
          //: junho devolvia "nenhum item", e as que existem só em abril não
          //: apareciam. Achado da revisão do Codex em 16/10/2026.
          //:
          //: `null` ESCONDE O REFINAMENTO em vez de oferecê-lo errado:
          //: `FaixaDoRecorte` filtra as dimensões sem valores. Oferecer nada é
          //: honesto; oferecer o mês errado parece certo e não é. Buscar as
          //: opções do mês do painel é a versão melhor disto, e é outro pedido —
          //: uma requisição a mais e um estado a mais, que não entram num
          //: conserto.
          opcoes={aprofundando.mes === dossie.mes ? opcoes : null}
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

      {/* "ONDE ESTÁ A CAUSA" SAIU por pedido (21/10/2026): não vamos mais
          utilizá-lo. O componente continua no código (`OndeEstaACausa`). */}

      {/* O QUE SOBRA DE `dossie.paineis` DEPOIS DO TIER × SENTIMENTO (que já
          saiu daqui, ver acima): hoje é só "Matriz de relacionamento com
          jornalistas" na Imprensa, sozinho — por isso a largura inteira, e
          não mais a `grade--2` que ele dividia com o Tier × Sentimento.
          `alignItems: 'stretch'` NA GRADE (quando há 2+ painéis, caso de
          outra lente que venha a ter mais de um aqui): os painéis crescem
          para a mesma altura, a do mais alto — sem isto, o cartão mais curto
          para no fim do próprio conteúdo e desalinha com o vizinho sempre
          que os dois tipos de gráfico não renderizam com a mesma altura por
          item. */}
      {outrosPaineis.length > 1 ? (
        <div className="grade grade--2" style={{ gap: 16 }}>
          {outrosPaineis.map((painel, posicao) => (
            <CartaoDoPainel
              key={`${posicao}-${painel.titulo}`}
              painel={painel}
              filtro={filtro}
              aoAprofundar={aoAprofundar}
            />
          ))}
        </div>
      ) : (
        outrosPaineis.map((painel, posicao) => (
          <CartaoDoPainel
            key={`${posicao}-${painel.titulo}`}
            painel={painel}
            filtro={filtro}
            aoAprofundar={aoAprofundar}
          />
        ))
      )}

      <SinaisDoPeriodo dossie={dossie} />
    </>
  );
}

/** Um cartão de `dossie.paineis` — extraído de `Conteudo` (21/10/2026) para
 *  servir aos DOIS lugares que agora desenham um painel: o Tier × Sentimento,
 *  que ganhou posição fixa logo após os gráficos de veículo, e o que sobra da
 *  grade genérica (hoje só "Matriz de relacionamento com jornalistas" na
 *  Imprensa). A MOLDURA É A MESMA NOS DOIS: duplicá-la deixaria os dois
 *  lugares divergirem no dia em que alguém mudasse um sem lembrar do outro. */
function CartaoDoPainel({
  painel,
  filtro,
  aoAprofundar,
}: {
  painel: Bloco;
  filtro: FiltroDaLente;
  aoAprofundar: (chave: string, valor: string) => void;
}) {
  //: A CHAVE (com a posição, não só o título) fica em quem chama — dois
  //: painéis com o mesmo título são improváveis, mas `key` duplicada faz o
  //: React reaproveitar o estado do componente errado, e o erro aparece como
  //: gráfico que não atualiza, não como aviso.
  return (
    <ComFaixaDoTopo>
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

/** AS TRÊS LENTES DE CLIPPING — e é UMA lista, de propósito.
 *
 *  ERAM CINCO, nomeadas pelo que escondiam: `LENTES_COM_BLOCOS_DE_VEICULO`,
 *  `LENTES_SEM_DRIVERS`, `LENTES_SEM_TEMAS_MAIS_FALADOS`,
 *  `LENTES_SEM_CARTAO_DA_NOTA` e `LENTES_COM_EXPLORADOR`. Quatro diziam
 *  `['imprensa', 'mercado']` e a quinta `['imprensa', 'mercado',
 *  'institucional']` — e essa divergência de UM item não era desenho de
 *  ninguém: era o rastro de três decisões em dias diferentes. O que a tela
 *  mostrava para a Institucional, por causa dela, era um híbrido: o Explorador
 *  novo E os três blocos que o Explorador tinha substituído.
 *
 *  O CRITÉRIO É UM SÓ, e agora está escrito uma vez: lente de clipping ganha os
 *  dois Exploradores (o de veículos e o de N1 › N2 › N3) e dispensa o cartão da
 *  nota, Drivers e riscos e Temas mais falados — porque os Exploradores
 *  respondem o que aqueles três respondiam, e melhor.
 *
 *  SOCIEDADE E CLIENTES NÃO ENTRAM, e não é esquecimento. Clientes não tem
 *  menção na carga; a Sociedade tem `veiculo`, mas o que ela guarda ali é
 *  perfil e rede ("deolhoemesteio"), não veículo de imprensa — ranquear isso
 *  como "Top veículos", ao lado de tier, diria algo errado sobre o dado. As
 *  duas seguem com o cartão da nota, Drivers e Temas, como sempre tiveram.
 *
 *  POR QUE A TELA TEM CONDIÇÃO PRÓPRIA, e não só o servidor: um card vazio
 *  ainda É um card. O back já devolve esses blocos vazios para quem não tem o
 *  campo (`LENTES_COM_VEICULO_E_TIER`, em `casos_de_uso/leitura_das_lentes`),
 *  mas a tela também precisa não desenhar a MOLDURA, e não só o conteúdo. OS
 *  DOIS LADOS ANDAM JUNTOS: só aqui esconde a moldura e deixa o servidor
 *  calculando de graça; só lá deixa a moldura na tela com o bloco vazio dentro.
 *
 *  POR QUE AS DUAS ÚLTIMAS ENTRARAM, que é o que faz esta lista ser esta:
 *
 *  O MERCADO (20/10/2026) tinha contra si o pedido do Jones (2026-10-02) de não
 *  ver "os mesmos veículos e tiers repetidos nas duas lentes". A medida desfez a
 *  premissa: ZERO dos 10 maiores veículos do Mercado estão no top 10 da Imprensa
 *  (o Valor Econômico é 1º no Mercado e 95º na Imprensa), o top da Imprensa é
 *  rádio local e o do Mercado é imprensa econômica inteiro, e o tier quase se
 *  inverte — 46,2% Tier 1 no Mercado contra 10,7% na Imprensa.
 *
 *  A INSTITUCIONAL tinha contra si "lê o CRM e volta vazia dali", e isso morreu
 *  na `0107`/`0108`: ela espelha a Clipei recortada pela subcategoria
 *  Institucional, o CRM dela foi aposentado com `ativo = false`, e
 *  `lente_e_interna` responde `false`. Ela entrou no Explorador em 21/10 e
 *  ficou de fora das outras quatro listas até aqui.
 *
 *  O VOLUME DE MATÉRIA AINDA É BAIXO nas duas, e isso é cadastro de veículo por
 *  fazer (dono do produto, 24/10/2026) — não lente sem dado, e não razão para a
 *  tela ser diferente.
 */
const LENTES_DE_CLIPPING = ['imprensa', 'mercado', 'institucional'];

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
        {/* O CONVITE ESCRITO, por pedido: a coluna já abria o mês, mas nada
            dizia isso — e o clique é a porta para o N1 › N2 › N3. */}
        <p className="sem-png sem-impressao" style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--cinza-2)' }}>
          Clique numa coluna para aprofundar o mês.
        </p>
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
/* -- 1.6. do amplo ao específico: drivers, temas e matérias --------------------- */

/** Um bloco autônomo abaixo da Evolução, no mesmo molde dela (faixa, seção,
 *  cabeçalho, ficha) — mas sem o extra de fatos/sinais, que é só da Evolução.
 *
 *  OS DOIS (Drivers e riscos, Temas mais falados) REAGEM AO MESMO RECORTE da
 *  barra de filtro lá em cima: o servidor já aplica tier/veículo/atributo/tema
 *  em cada consulta, então os dois estreitam juntos quando alguém filtra — é a
 *  mesma régua "do amplo ao específico", não dois drill-downs independentes.
 *
 *  ERAM TRÊS até 23/10/2026: "Últimas matérias" fechava a régua levando-a até
 *  a linha. Ela saiu do corpo do dossiê e virou o modal de aprofundamento. */
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
          // A COR, QUANDO O SERVIDOR MANDA, VENCE o tom genérico — ver
          // `BlocoSaida.cores` em `app/api/lentes.py`. Sem ela, cai nos tons de
          // positivo/neutro/negativo do design system.
          //
          // HOJE NENHUMA LENTE MANDA, e esta linha dizia "hoje só a
          // institucional": o servidor só manda o cor_hex do dicionário de
          // clima para lente INTERNA (`lente_e_interna`), e a Institucional
          // deixou de ser uma na `0107`/`0108`. O ramo fica porque a decisão é
          // do servidor, não da tela — e volta sozinho se alguma lente voltar
          // a ler o CRM.
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
          cor: 'var(--cor-da-lente, var(--azul-mar))',
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
          <p style={{ margin: 0, fontSize: 15, color: 'var(--cinza-2)' }}>
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
        padding: '13px 0',
        borderTop: primeira ? undefined : '1px solid var(--borda)',
      }}
    >
      {/* FONTE MAIOR, por pedido: o card é leitura de frase, e a 13,5px ele
          era o texto mais miúdo da Síntese. */}
      <Chip
        rotulo={sinal.tipo}
        fundo={cor.fundo}
        texto={cor.texto}
        estilo={{ fontSize: 13, padding: '4px 11px' }}
      />
      <span style={{ fontSize: 13.5, color: 'var(--cinza-2)', whiteSpace: 'nowrap' }}>
        {sinal.onde}
      </span>
      <span style={{ fontSize: 16, flex: 1, minWidth: 240, lineHeight: 1.55 }}>
        {sinal.frase}
      </span>
      <span
        className="tabular"
        style={{
          fontSize: 17,
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
