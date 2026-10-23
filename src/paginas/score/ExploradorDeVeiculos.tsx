/** UM cartão com três colunas que se filtram juntas, pela dimensão de veículo:
 *
 *  - "Tier do veículo × sentimento": o volume por relevância do veículo;
 *  - "Top veículos": quem mais publicou, com o sentimento dentro da barra;
 *  - "Termômetro por Veículos": o placar de −100 a +100 de cada um.
 *
 *  É O MOLDE DO `ExploradorDaLente` (N1 › N2 › N3), e de propósito: um pedido
 *  por mês e recorte, os grupos guardados, e o cruzamento somado no navegador.
 *  Daí as três propriedades que os três cartões de antes não tinham — clique
 *  instantâneo, o dossiê não se move, e a coluna do próprio item continua
 *  inteira com ele em destaque.
 *
 *  UM CARTÃO, TRÊS COLUNAS (23/10/2026, por pedido), e não três cartões
 *  empilhados: é o molde do bloco de Atributos, onde os três níveis ficam lado
 *  a lado. O que se ganha é a comparação de relance — e os chips de "Filtrando
 *  por" aparecem UMA vez, em vez de um por cartão.
 *
 *  ANTES ERAM TRÊS CARTÕES INDEPENDENTES que respondiam ao filtro da TELA
 *  (`definirFiltro`): cada clique ia ao servidor e movia nota, KPIs, evolução e
 *  últimas matérias; e o painel clicado ficava com uma barra só, então trocar
 *  de seleção exigia desfazer o clique antes. Aqui a seleção é LOCAL: nada
 *  fora deste cartão se mexe.
 *
 *  O FILTRO DA TELA (Concessionária, Tier, Sentimento) VALE AQUI: ele vai no
 *  pedido, como em todo o dossiê. São coisas diferentes — o filtro da tela
 *  recorta o mês; a seleção daqui cruza as colunas dentro do recorte.
 *
 *  SÃO DOIS EIXOS, E TRÊS COLUNAS: "Top veículos" e "Termômetro" são o MESMO
 *  eixo com medidas diferentes. A conta e o porquê moram em
 *  `dominio/exploradorDeVeiculos`.
 */

import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';

import type { ExploradorDeVeiculos as Dados, FiltroDaLente } from '@/api/cliente';
import { obterExploradorDeVeiculos } from '@/api/cliente';
import { Carregando, ComFaixaDoTopo, Secao } from '@/componentes/basicos';
import { CORES_DO_SENTIMENTO, textoDoImpacto } from '@/dominio/explorador';
import {
  EIXOS,
  barrasDoTier,
  barrasDoVeiculo,
  termometroDosVeiculos,
  tierDoRotulo,
} from '@/dominio/exploradorDeVeiculos';
import type { Eixo, SelecaoDeVeiculos } from '@/dominio/exploradorDeVeiculos';
import { ROTULO_DO_TIER } from '@/dominio/filtrosDasLentes';
import { GUIA_DO_BLOCO } from '@/dominio/guiaDoDossie';
import { BarraDivergentePorItem } from '@/graficos/BarraDivergentePorItem';
import { ColunasEmpilhadas } from '@/graficos/ColunasEmpilhadas';
import { useListaDeVeiculos } from '@/paginas/score/listaDeVeiculos';
import { RevelarVeiculos } from '@/paginas/score/revelarVeiculos';

//: OS NOMES DOS EIXOS COMO O PRODUTO OS CHAMA — os mesmos da barra de filtros.
const NOMES: Record<Eixo, string> = { tier: 'Tier', veiculo: 'Veículo' };

//: O TÍTULO DO CARTÃO: a lista das três colunas, como "Atributos, temas
//: estratégicos e subtemas" faz no bloco que é o molde deste.
const TITULO = 'Tier do veículo, top veículos e termômetro';

//: A ALTURA DAS LISTAS, a mesma das colunas do Explorador de taxonomia: a
//: rolagem interna segura o excesso, e o botão "Ver todos" é quem decide
//: quantas linhas existem para rolar.
const ALTURA_DA_LISTA = 360;

export function ExploradorDeVeiculos({
  codigo,
  mes,
  filtro,
}: {
  codigo: string;
  mes: string;
  filtro: FiltroDaLente;
}) {
  //: OS DADOS COM A CHAVE DO PEDIDO de que são: a tela usa só os que batem
  //: com o mês e o filtro atuais, sem zerar nada dentro do efeito. Sem isto, a
  //: resposta atrasada de um recorte pousaria sobre o recorte seguinte.
  const chave = `${codigo}|${mes}|${JSON.stringify(filtro)}`;
  const [carregados, definirCarregados] = useState<{
    chave: string;
    dados: Dados | null;
    erro?: string;
  } | null>(null);
  //: A SELEÇÃO TAMBÉM LEVA A CHAVE DO RECORTE, pelo mesmo motivo dos dados —
  //: achado da revisão do Codex (23/10/2026). Sem isto: escolher "Tier 1"
  //: aqui, trocar o filtro da TELA para Tier 2, e o chip continuava dizendo
  //: "Tier 1" sobre um recorte que não tem Tier 1 nenhum — as duas colunas de
  //: veículo ficavam vazias por filtrar por algo que o recorte novo não
  //: contém, com um chip mentindo em cima.
  //:
  //: GUARDADA COM A CHAVE em vez de zerada num efeito: `definirSelecao({})`
  //: dentro de `useEffect` dispararia outra renderização (e o lint cobra isso,
  //: `set-state-in-effect`); comparar a chave na leitura não dispara nada.
  const [escolha, definirEscolha] = useState<{ chave: string; selecao: SelecaoDeVeiculos }>({
    chave,
    selecao: {},
  });
  const selecao = escolha.chave === chave ? escolha.selecao : {};

  useEffect(() => {
    let ativo = true;
    obterExploradorDeVeiculos(codigo, mes, filtro)
      .then((dados) => ativo && definirCarregados({ chave, dados }))
      .catch((falha) =>
        ativo &&
        definirCarregados({
          chave,
          dados: null,
          erro: falha instanceof Error ? falha.message : 'Não foi possível ler.',
        }),
      );
    return () => {
      ativo = false;
    };
  }, [codigo, mes, filtro, chave]);

  const atuais = carregados?.chave === chave ? carregados : null;
  const grupos = atuais?.dados?.grupos ?? [];
  const denominador = atuais?.dados?.denominador ?? 0;

  const alternar = (eixo: Eixo, valor: string) =>
    definirEscolha(() => ({
      chave,
      selecao: { ...selecao, [eixo]: selecao[eixo] === valor ? undefined : valor },
    }));
  const limpar = () => definirEscolha({ chave, selecao: {} });

  const tiers = barrasDoTier(grupos, selecao, denominador);
  const veiculos = barrasDoVeiculo(grupos, selecao, denominador);
  const termometro = termometroDosVeiculos(grupos, selecao);

  //: UMA LISTA POR COLUNA DE VEÍCULO, independentes: cada uma abre e fecha
  //: sozinha. Os hooks ficam aqui no topo, fora de condicional, e recebem 0
  //: enquanto não há resposta.
  const listaDoTopo = useListaDeVeiculos(veiculos.length);
  const listaDoTermometro = useListaDeVeiculos(termometro.length);

  const escolhidos = EIXOS.filter((eixo) => selecao[eixo]);
  //: O CHIP MOSTRA O RÓTULO, não a chave: a seleção guarda `muito_relevante`,
  //: e quem lê a tela viu "Tier 1".
  const naTela = (eixo: Eixo, valor: string) =>
    eixo === 'tier' ? (ROTULO_DO_TIER[valor] ?? valor) : valor;

  return (
    <ComFaixaDoTopo>
      <Secao
        titulo={TITULO}
        subtitulo="Matérias por sentimento, da maior para a menor, com o impacto na nota da lente (pontos). Clique num item para filtrar as outras colunas — o resto do dossiê não se mexe."
        ajuda={GUIA_DO_BLOCO[TITULO]}
      >
        {!atuais ? <Carregando /> : null}
        {atuais?.erro ? (
          <p style={{ color: 'var(--erro-fg)', fontSize: 13 }}>{atuais.erro}</p>
        ) : null}
        {atuais?.dados ? (
          <>
            <Legenda />
            {escolhidos.length ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                <span className="kicker">Filtrando por</span>
                {escolhidos.map((eixo) => (
                  <button
                    key={eixo}
                    type="button"
                    className="chip"
                    onClick={() => alternar(eixo, selecao[eixo] as string)}
                    aria-label={`Tirar o filtro ${NOMES[eixo]}: ${naTela(eixo, selecao[eixo] as string)}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '3px 10px',
                      border: '1px solid var(--cor-da-lente, var(--azul-mar))',
                      borderRadius: 'var(--r-chip)',
                      background: 'var(--branco)',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ color: 'var(--cinza-2)' }}>{NOMES[eixo]}</span>
                    <strong>{naTela(eixo, selecao[eixo] as string)}</strong>
                    <span aria-hidden>×</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={limpar}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--cinza-3)',
                    fontSize: 12,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  Limpar
                </button>
              </div>
            ) : null}

            <div className="grade grade--3" style={{ gap: 20 }}>
              <Coluna titulo="Tier do veículo × sentimento" quantos={tiers.length}>
                <ColunasEmpilhadas
                  semLegenda
                  rotuloEmCima
                  espessura={8}
                  alturaMaxima={ALTURA_DA_LISTA}
                  cores={CORES_DO_SENTIMENTO}
                  dica="Clique para filtrar as outras colunas"
                  vazio="Nenhuma matéria com tier do veículo neste recorte."
                  ativo={selecao.tier ? naTela('tier', selecao.tier) : undefined}
                  //: O `ColunasEmpilhadas` FALA POR RÓTULO, e a seleção guarda
                  //: a chave — `tierDoRotulo` faz a volta, e mora no domínio
                  //: com teste em vez de embutida aqui.
                  aoClicar={(rotulo) => {
                    const tier = tierDoRotulo(rotulo);
                    if (tier) alternar('tier', tier);
                  }}
                  itens={tiers.map((barra) => ({
                    ...barra,
                    detalhe: `${textoDoImpacto(barra.impacto)} pts`,
                  }))}
                />
              </Coluna>

              <Coluna titulo="Top veículos" quantos={veiculos.length}>
                {/* O `id` ENVOLVE SÓ AS LINHAS, e não a coluna inteira: é o
                    alvo do `aria-controls` do botão, e um alvo que contivesse
                    o próprio botão se referenciaria a si mesmo. */}
                <div id={listaDoTopo.idDaLista}>
                  <ColunasEmpilhadas
                    semLegenda
                    rotuloEmCima
                    espessura={8}
                    alturaMaxima={ALTURA_DA_LISTA}
                    cores={CORES_DO_SENTIMENTO}
                    dica="Clique para filtrar as outras colunas"
                    vazio="Nenhuma matéria com veículo neste recorte."
                    ativo={selecao.veiculo}
                    aoClicar={(valor) => alternar('veiculo', valor)}
                    itens={veiculos.slice(0, listaDoTopo.quantidade).map((barra) => ({
                      ...barra,
                      detalhe: `${textoDoImpacto(barra.impacto)} pts`,
                    }))}
                  />
                </div>
                <RevelarVeiculos
                  teto={listaDoTopo.teto}
                  podeAbrir={listaDoTopo.podeAbrir}
                  aberta={listaDoTopo.aberta}
                  aoAlternar={listaDoTopo.alternar}
                  controla={listaDoTopo.idDaLista}
                />
              </Coluna>

              <Coluna titulo="Termômetro por Veículos" quantos={termometro.length}>
                {/* A ROLAGEM É DAQUI, por pedido (23/10/2026): a
                    `ColunasEmpilhadas` da coluna ao lado tem rolagem interna
                    própria, e a `BarraDivergentePorItem` não tem nenhuma —
                    expandir esta coluna crescia o cartão e fazia a PÁGINA
                    rolar, enquanto a vizinha rolava por dentro. Dois
                    comportamentos para o mesmo gesto, lado a lado.

                    A CLASSE É A MESMA (`rolagem-interna`), e não um
                    `overflow` solto: ela traz a barra fina de 10px com o
                    polegar em `--cinza-1`, que é o que faz as duas colunas
                    rolarem IGUAL e não só rolarem.

                    `paddingRight` PARA A BARRA NÃO SENTAR NO DADO — o mesmo
                    que a `ColunasEmpilhadas` faz no scroller dela.

                    E OS DOIS EIXOS EXPLÍCITOS, não só a classe. Dois motivos,
                    os dois achados da revisão do Codex (23/10/2026):

                    `overflowX: 'hidden'` porque as linhas da
                    `BarraDivergentePorItem` têm `margin: 0 -6px` — o realce
                    sangra 6px além do texto de propósito —, e isso transborda
                    ~2px do `padding` deste container. Com o `overflow: auto`
                    da classe, aparecia uma barra HORIZONTAL inclusive com a
                    lista fechada; ela come altura e desalinha esta coluna das
                    outras duas.

                    `overflowY: 'auto'` porque herdar a rolagem da classe
                    deixava alguém mantê-la e tirar o comportamento sem nenhum
                    teste ver — o estilo aqui é o que o teste pode afirmar. */}
                <div
                  id={listaDoTermometro.idDaLista}
                  className="rolagem-interna"
                  style={{
                    maxHeight: ALTURA_DA_LISTA,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    paddingRight: 4,
                  }}
                >
                  <BarraDivergentePorItem
                    itens={termometro.slice(0, listaDoTermometro.quantidade).map((item) => ({
                      chave: item.veiculo,
                      rotulo: item.veiculo,
                      total: item.total,
                      score: item.score,
                    }))}
                    ativo={selecao.veiculo}
                    aoClicar={(veiculo) => alternar('veiculo', veiculo)}
                    vazio="Nenhuma matéria com veículo neste recorte."
                    unidade={{ singular: 'matéria', plural: 'matérias' }}
                    variante="termometro"
                  />
                </div>
                <RevelarVeiculos
                  teto={listaDoTermometro.teto}
                  podeAbrir={listaDoTermometro.podeAbrir}
                  aberta={listaDoTermometro.aberta}
                  aoAlternar={listaDoTermometro.alternar}
                  controla={listaDoTermometro.idDaLista}
                />
              </Coluna>
            </div>
          </>
        ) : null}
      </Secao>
    </ComFaixaDoTopo>
  );
}

/** Uma coluna do cartão: o cabeçalho com o nome e a contagem, e o gráfico.
 *
 *  O MESMO DESENHO DAS COLUNAS DO EXPLORADOR DE TAXONOMIA (`ExploradorDaLente`,
 *  o bloco que é o molde deste): `h3` à esquerda, a contagem à direita, e uma
 *  régua de 1px embaixo separando o cabeçalho das barras.
 *
 *  `role="group"` COM `aria-labelledby` NO `h3`: as três colunas passaram a
 *  viver num cartão só, e sem o grupo o leitor de tela lê uma fila de barras
 *  sem dizer de qual coluna cada uma é — "Folha, 12 matérias" aparece duas
 *  vezes (no Top e no Termômetro) e nada as distingue.
 *
 *  A CONTAGEM É DA LISTA INTEIRA, e não das cinco visíveis: ela é a resposta a
 *  "quanto existe aqui", que é outra pergunta que "quanto estou vendo" — essa o
 *  botão "Ver todos os N" responde. */
function Coluna({
  titulo,
  quantos,
  children,
}: {
  titulo: string;
  quantos: number;
  children: ReactNode;
}) {
  const idDoTitulo = useId();
  return (
    <div role="group" aria-labelledby={idDoTitulo} style={{ minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
          paddingBottom: 8,
          marginBottom: 8,
          borderBottom: '1px solid var(--borda)',
        }}
      >
        <h3
          id={idDoTitulo}
          style={{ margin: 0, fontSize: 14, color: 'var(--cor-dos-titulos, var(--azul-mar))' }}
        >
          {titulo}
        </h3>
        <span style={{ fontSize: 11.5, color: 'var(--cinza-2)' }}>
          {quantos} {quantos === 1 ? 'item' : 'itens'}
        </span>
      </div>
      {children}
    </div>
  );
}

function Legenda() {
  return (
    <div
      style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--cinza-3)', marginBottom: 12 }}
    >
      {[
        ['Positivo', CORES_DO_SENTIMENTO[0]],
        ['Neutro', CORES_DO_SENTIMENTO[1]],
        ['Negativo', CORES_DO_SENTIMENTO[2]],
      ].map(([rotulo, cor]) => (
        <span key={rotulo} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 2, background: cor }} />
          {rotulo}
        </span>
      ))}
      <span style={{ marginLeft: 'auto', color: 'var(--cinza-2)' }}>
        Na ponta: matérias · impacto na nota
      </span>
    </div>
  );
}
