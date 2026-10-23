/** Três painéis da Síntese executiva que se filtram juntos, pela dimensão de
 *  veículo:
 *
 *  - "Tier do veículo × sentimento": o volume por relevância do veículo;
 *  - "Top veículos": quem mais publicou, com o sentimento dentro da barra;
 *  - "Termômetro por Veículos": o placar de −100 a +100 de cada um.
 *
 *  É O MOLDE DO `ExploradorDaLente` (N1 › N2 › N3), e de propósito: um pedido
 *  por mês e recorte, os grupos guardados, e o cruzamento somado no navegador.
 *  Daí as três propriedades que os três cartões de antes não tinham — clique
 *  instantâneo, o dossiê não se move, e o painel do próprio item continua
 *  inteiro com ele em destaque.
 *
 *  ANTES ERAM TRÊS CARTÕES INDEPENDENTES que respondiam ao filtro da TELA
 *  (`definirFiltro`): cada clique ia ao servidor e movia nota, KPIs, evolução e
 *  últimas matérias; e o painel clicado ficava com uma barra só, então trocar
 *  de seleção exigia desfazer o clique antes. Aqui a seleção é LOCAL: nada
 *  fora destes três painéis se mexe.
 *
 *  O FILTRO DA TELA (Concessionária, Tier, Sentimento) VALE AQUI: ele vai no
 *  pedido, como em todo o dossiê. São coisas diferentes — o filtro da tela
 *  recorta o mês; a seleção daqui cruza os painéis dentro do recorte.
 *
 *  SÃO DOIS EIXOS, E TRÊS PAINÉIS: "Top veículos" e "Termômetro" são o MESMO
 *  eixo com medidas diferentes. A conta e o porquê moram em
 *  `dominio/exploradorDeVeiculos`.
 */

import { useEffect, useState } from 'react';

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
  const [selecao, definirSelecao] = useState<SelecaoDeVeiculos>({});

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
    definirSelecao((atual) => ({ ...atual, [eixo]: atual[eixo] === valor ? undefined : valor }));

  const tiers = barrasDoTier(grupos, selecao, denominador);
  const veiculos = barrasDoVeiculo(grupos, selecao, denominador);
  const termometro = termometroDosVeiculos(grupos, selecao);

  //: UMA LISTA POR PAINEL, independentes: cada um abre e fecha sozinho, como
  //: os cartões de antes faziam. Os hooks ficam aqui no topo, fora de
  //: condicional, e recebem 0 enquanto não há resposta.
  const listaDoTopo = useListaDeVeiculos(veiculos.length);
  const listaDoTermometro = useListaDeVeiculos(termometro.length);

  const escolhidos = EIXOS.filter((eixo) => selecao[eixo]);
  //: O CHIP MOSTRA O RÓTULO, não a chave: a seleção guarda `muito_relevante`,
  //: e quem lê a tela viu "Tier 1".
  const naTela = (eixo: Eixo, valor: string) =>
    eixo === 'tier' ? (ROTULO_DO_TIER[valor] ?? valor) : valor;

  const filtrando = escolhidos.length ? (
    <div
      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 14 }}
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
        onClick={() => definirSelecao({})}
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
  ) : null;

  const aviso = !atuais ? <Carregando /> : null;
  const erro = atuais?.erro ? (
    <p style={{ color: 'var(--erro-fg)', fontSize: 13 }}>{atuais.erro}</p>
  ) : null;

  return (
    <>
      <ComFaixaDoTopo>
        <Secao
          titulo="Tier do veículo × sentimento"
          subtitulo="O volume de matérias por relevância (tier) do veículo, com o sentimento dentro da barra e o impacto na nota da lente (pontos). Clique num tier para filtrar os dois painéis abaixo."
          ajuda={GUIA_DO_BLOCO['Tier do veículo × sentimento']}
        >
          {aviso}
          {erro}
          {atuais?.dados ? (
            <>
              <Legenda />
              {filtrando}
              <ColunasEmpilhadas
                semLegenda
                rotuloEmCima
                espessura={8}
                alturaMaxima={ALTURA_DA_LISTA}
                cores={CORES_DO_SENTIMENTO}
                dica="Clique para filtrar os outros painéis"
                vazio="Nenhuma matéria com tier do veículo neste recorte."
                ativo={selecao.tier ? naTela('tier', selecao.tier) : undefined}
                //: O `ColunasEmpilhadas` FALA POR RÓTULO, e a seleção guarda a
                //: chave — `tierDoRotulo` faz a volta, e mora no domínio com
                //: teste em vez de embutida aqui.
                aoClicar={(rotulo) => {
                  const tier = tierDoRotulo(rotulo);
                  if (tier) alternar('tier', tier);
                }}
                itens={tiers.map((barra) => ({
                  ...barra,
                  detalhe: `${textoDoImpacto(barra.impacto)} pts`,
                }))}
              />
            </>
          ) : null}
        </Secao>
      </ComFaixaDoTopo>

      <ComFaixaDoTopo>
        <Secao
          titulo="Top veículos"
          subtitulo="Os veículos que mais publicaram no recorte, com o sentimento dentro da barra e o impacto na nota (pontos). Clique num veículo para filtrar o painel de tier."
          ajuda={GUIA_DO_BLOCO['Top veículos']}
        >
          {aviso}
          {erro}
          {atuais?.dados ? (
            <>
              {filtrando}
              {/* O `id` ENVOLVE SÓ AS LINHAS, e não o cartão: é o alvo do
                  `aria-controls` do botão, e um alvo que contivesse o próprio
                  botão se referenciaria a si mesmo. */}
              <div id={listaDoTopo.idDaLista}>
                <ColunasEmpilhadas
                  semLegenda
                  rotuloEmCima
                  espessura={8}
                  alturaMaxima={ALTURA_DA_LISTA}
                  cores={CORES_DO_SENTIMENTO}
                  dica="Clique para filtrar os outros painéis"
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
            </>
          ) : null}
        </Secao>
      </ComFaixaDoTopo>

      <ComFaixaDoTopo>
        <Secao
          titulo="Termômetro por Veículos"
          subtitulo="O placar de cada veículo do recorte, de −100 a +100: (positivas − negativas) ÷ total. Segue a seleção de tier e de veículo acima."
          ajuda={GUIA_DO_BLOCO['Termômetro por Veículos']}
        >
          {aviso}
          {erro}
          {atuais?.dados ? (
            <>
              {filtrando}
              <div id={listaDoTermometro.idDaLista}>
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
                centralizado
              />
            </>
          ) : null}
        </Secao>
      </ComFaixaDoTopo>
    </>
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
