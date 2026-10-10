/** A barra de filtros do Risk Tracking: a busca, a trilha e os cortes.
 *
 *  PADRONIZAÇÃO COM ESPAÇO PARA A PARTICULARIDADE, que é o pedido do dono do
 *  produto. A fileira tem duas partes, e elas não se misturam:
 *
 *    1. OS CORTES QUE CRUZAM TODAS AS FONTES — lente, os três níveis do tema
 *       (N1/N2/N3), cluster, risco e severidade. Eles existem porque a premissa
 *       da aba é que tudo chega a risco pelo tema do cadastro: não há fonte que
 *       não os tenha, então eles aparecem sempre, na mesma ordem, em todo
 *       recorte. É o que dá a visão cross.
 *
 *    2. AS PARTICULARIDADES DA BASE — tier e público-alvo na imprensa, cargo e
 *       autor nas redes, praça e concessionária nas duas. Essas vêm do servidor
 *       (`/opcoes`), que as oferece quando o dado tem valor: é o dado
 *       respondendo, e não uma lista fixa por fonte.
 *
 *  A DIMENSÃO QUE A FONTE TEM E O RECORTE ESVAZIOU CONTINUA NA FILEIRA,
 *  desabilitada e dizendo por quê. É a mesma régua da fileira de abas das
 *  Lentes, decidida pelo dono do produto em 05/10/2026: um filtro que aparece e
 *  desaparece a cada clique se lê como tela quebrada, e o filtro vazio diz algo
 *  acionável ("a Clipei não classificou relevância neste corte"). O que não vem
 *  é a dimensão que NENHUMA fonte do recorte classifica — aí a ausência é da
 *  fonte, e o filtro não existiria nem trocando o período.
 *
 *  OS TRÊS NÍVEIS SÃO UMA ESCADA: escolher N1 reduz a lista de N2, e escolher N2
 *  reduz a de N3. Oferecer os 104 temas de uma vez seria devolver a lista que a
 *  hierarquia existe para evitar. Cada opção traz a contagem do recorte, para a
 *  escolha não ser um chute.
 */

import { CampoSuspenso } from '@/componentes/CampoSuspenso';
import type { CampoDeFiltro } from '@/componentes/PainelDeFiltros';
import { Botao } from '@/componentes/basicos';
import {
  SEVERIDADES,
  nomesDoRecorte,
  porQueADimensaoEstaVazia,
  rotuloDaSeveridade,
  trilhaDoRecorte,
} from '@/dominio/riscos';
import type { FiltroDoRisco, OpcoesDoRisco } from '@/dominio/riscos';
import { numero } from '@/dominio/formato';

export function FiltrosDoRisco({
  opcoes,
  filtro,
  definirFiltro,
  busca,
  definirBusca,
}: {
  opcoes: OpcoesDoRisco;
  filtro: FiltroDoRisco;
  definirFiltro: (filtro: FiltroDoRisco) => void;
  /** A busca mora fora do filtro porque ela é digitada: aplicá-la a cada tecla
   *  recarregaria a tela por letra. Ver `RastreioDeRisco`. */
  busca: string;
  definirBusca: (busca: string) => void;
}) {
  const trilha = trilhaDoRecorte(filtro, nomesDoRecorte(opcoes));

  //: OS CORTES CROSS, na ordem do macro ao micro.
  const cruzados: CampoDeFiltro[] = [];

  if (opcoes.lentes.length > 0) {
    cruzados.push({
      chave: 'lente',
      rotulo: 'Lente',
      valorAtual: filtro.lentes?.[0],
      itens: opcoes.lentes.map((lente) => ({ valor: lente.codigo, rotulo: lente.nome })),
      aoEscolher: (valor) =>
        definirFiltro({ ...filtro, lentes: valor ? [valor] : [] }),
    });
  }

  //: O NÓ SEM CLASSIFICAÇÃO FICA FORA DOS SELETORES: ele vem do servidor com
  //: código vazio porque não há o que filtrar (é o tema que não tem macro tema
  //: no cadastro), e uma opção que não recorta faz a pessoa clicar, nada mudar e
  //: concluir que a tela quebrou. A contagem dele aparece na nota abaixo da
  //: fileira, que é onde ela informa sem se passar por controle. Achado de
  //: revisão.
  const blocos = opcoes.temas.filter((bloco) => bloco.codigo);
  const semClassificacao = opcoes.temas
    .filter((bloco) => !bloco.codigo)
    .reduce((soma, bloco) => soma + bloco.incidentes, 0);
  cruzados.push({
    chave: 'bloco',
    rotulo: 'Pilar (N1)',
    valorAtual: filtro.bloco ?? undefined,
    itens: blocos.map((bloco) => ({
      valor: bloco.codigo,
      rotulo: `${bloco.nome} (${numero(bloco.incidentes)})`,
    })),
    //: TROCAR DE N1 LIMPA N2 E N3: um N2 do outro N1 daria recorte impossível,
    //: e a tela mostraria zero sem dizer por quê.
    aoEscolher: (valor) =>
      definirFiltro({ ...filtro, bloco: valor || null, macro: null, tema: null }),
  });

  const noBloco = blocos.find((bloco) => bloco.codigo === filtro.bloco);
  if (noBloco) {
    cruzados.push({
      chave: 'macro',
      rotulo: 'Tema estratégico (N2)',
      valorAtual: filtro.macro ?? undefined,
      itens: noBloco.dentro
        .filter((macro) => macro.codigo)
        .map((macro) => ({
          valor: macro.codigo,
          rotulo: `${macro.nome} (${numero(macro.incidentes)})`,
        })),
      aoEscolher: (valor) =>
        definirFiltro({ ...filtro, macro: valor || null, tema: null }),
    });
  }

  const noMacro = noBloco?.dentro.find((macro) => macro.codigo === filtro.macro);
  if (noMacro) {
    cruzados.push({
      chave: 'tema',
      rotulo: 'Tema (N3)',
      valorAtual: filtro.tema ?? undefined,
      itens: noMacro.dentro
        .filter((tema) => tema.codigo)
        .map((tema) => ({
          valor: tema.codigo,
          rotulo: `${tema.nome} (${numero(tema.incidentes)})`,
        })),
      aoEscolher: (valor) => definirFiltro({ ...filtro, tema: valor || null }),
    });
  }

  cruzados.push({
    chave: 'cluster',
    rotulo: 'Cluster de risco',
    valorAtual: filtro.cluster ?? undefined,
    itens: opcoes.clusters.map((cluster) => ({
      valor: cluster.codigo,
      rotulo: cluster.nome,
    })),
    aoEscolher: (valor) =>
      definirFiltro({ ...filtro, cluster: valor || null, risco: null }),
  });

  //: O RISCO SÓ DENTRO DO CLUSTER ESCOLHIDO, pela mesma razão da escada dos
  //: temas — e são 32 riscos em 8 clusters.
  const doCluster = opcoes.clusters.find((cluster) => cluster.codigo === filtro.cluster);
  if (doCluster) {
    cruzados.push({
      chave: 'risco',
      rotulo: 'Risco',
      valorAtual: filtro.risco ?? undefined,
      itens: doCluster.riscos.map((risco) => ({
        valor: risco.codigo,
        rotulo: risco.nome,
      })),
      aoEscolher: (valor) => definirFiltro({ ...filtro, risco: valor || null }),
    });
  }

  cruzados.push({
    chave: 'severidade',
    rotulo: 'Severidade',
    valorAtual: filtro.severidade ?? undefined,
    itens: SEVERIDADES.map((severidade) => ({
      valor: severidade.codigo,
      rotulo: rotuloDaSeveridade(severidade.codigo),
    })),
    aoEscolher: (valor) => definirFiltro({ ...filtro, severidade: valor || null }),
  });

  if (opcoes.fontes.length > 1) {
    //: A FONTE É A SEGUNDA PERGUNTA, e por isso vem depois: "como está a
    //: imprensa" é lente; "esta planilha está certa" é fonte. Só aparece quando
    //: há mais de uma — com uma só, o filtro não recorta nada.
    cruzados.push({
      chave: 'fonte',
      rotulo: 'Fonte',
      valorAtual: filtro.fontes?.[0],
      itens: opcoes.fontes.map((fonte) => ({ valor: fonte.codigo, rotulo: fonte.nome })),
      aoEscolher: (valor) => definirFiltro({ ...filtro, fontes: valor ? [valor] : [] }),
    });
  }

  return (
    <section
      aria-label="Busca e filtros"
      style={{
        background: 'var(--branco)',
        border: '1px solid var(--borda)',
        borderRadius: 'var(--r-card)',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label htmlFor="busca-do-risco" style={ETIQUETA}>
          Busca inteligente
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <input
            id="busca-do-risco"
            type="search"
            value={busca}
            onChange={(evento) => definirBusca(evento.target.value)}
            placeholder="Buscar incidente, veículo, assunto ou concessionária…"
            style={{
              flex: '1 1 420px',
              minWidth: 0,
              height: 44,
              padding: '0 14px',
              border: '1px solid var(--borda-input)',
              borderRadius: 'var(--r-btn)',
              background: 'var(--branco)',
              boxSizing: 'border-box',
              fontSize: 14,
              color: 'var(--cinza-4)',
            }}
          />

          {/* A TRILHA DO RECORTE, na ordem do domínio: dois links do mesmo
              recorte têm de se ler igual. Cada chip tira o seu degrau. */}
          {trilha.map((degrau) => (
            <span
              key={degrau.chave}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                height: 34,
                padding: '0 4px 0 12px',
                border: '1px solid #C9D2F5',
                background: '#EEF1FC',
                borderRadius: 'var(--r-btn)',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--azul-mar)',
              }}
            >
              {degrau.rotulo}: {degrau.valor}
              <button
                type="button"
                aria-label={`Remover o filtro ${degrau.rotulo}: ${degrau.valor}`}
                onClick={() => definirFiltro(semODegrau(filtro, degrau.chave))}
                style={{
                  width: 28,
                  height: 28,
                  border: 0,
                  background: 'transparent',
                  color: 'var(--azul-mar)',
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: 'pointer',
                  borderRadius: 'var(--r-btn)',
                }}
              >
                ×
              </button>
            </span>
          ))}

          {trilha.length > 0 || busca ? (
            <Botao
              variante="fantasma"
              aoClicar={() => {
                definirBusca('');
                definirFiltro({ de: filtro.de, ate: filtro.ate });
              }}
            >
              Limpar
            </Botao>
          ) : null}
        </div>
      </div>

      {/* A FILEIRA DOS CORTES, sobre o gradiente da marca — é o lugar da tela
          onde se escolhe o ângulo, e ele se distingue do conteúdo. */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderRadius: 'var(--r-btn)',
          background: 'linear-gradient(90deg, var(--azul-mar) 0%, var(--turquesa-rio) 100%)',
        }}
      >
        <span style={{ color: 'var(--branco)', fontSize: 14, fontWeight: 700, marginRight: 6 }}>
          Filtros:
        </span>
        {cruzados.map((campo) => (
          <CampoSuspenso key={campo.chave} campo={campo} />
        ))}
      </div>

      {semClassificacao > 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--cinza-2)' }}>
          {numero(semClassificacao)}{' '}
          {semClassificacao === 1 ? 'incidente' : 'incidentes'} de assunto ainda sem
          classificação na taxonomia de três níveis — ele entra nos totais e no gráfico,
          e não é alcançável pelos filtros de pilar e tema estratégico.
        </p>
      ) : null}

      {/* AS PARTICULARIDADES DA BASE, separadas das que cruzam: elas mudam com
          o recorte, e misturá-las faria a fileira de cima mudar de tamanho. */}
      {opcoes.dimensoes.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={ETIQUETA}>Desta base</span>
          {opcoes.dimensoes.map((dimensao) =>
            dimensao.tipo === 'vazia' ? (
              <span
                key={dimensao.chave}
                title={porQueADimensaoEstaVazia(dimensao)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 40,
                  padding: '0 12px',
                  borderRadius: 'var(--r-btn)',
                  border: '1px dashed var(--borda-input)',
                  background: 'var(--bg-trilho)',
                  fontSize: 13,
                  color: 'var(--cinza-2)',
                }}
              >
                {dimensao.rotulo}
                <em style={{ fontStyle: 'normal', fontSize: 12 }}>sem valor neste corte</em>
              </span>
            ) : (
              <CampoSuspenso
                key={dimensao.chave}
                campo={{
                  chave: dimensao.chave,
                  rotulo: dimensao.rotulo,
                  valorAtual: filtro.dimensoes?.[dimensao.chave],
                  itens: dimensao.valores.map((valor) => ({ valor, rotulo: valor })),
                  aoEscolher: (valor) =>
                    definirFiltro({
                      ...filtro,
                      dimensoes: semVazios({
                        ...(filtro.dimensoes ?? {}),
                        [dimensao.chave]: valor,
                      }),
                    }),
                }}
              />
            ),
          )}
        </div>
      ) : null}

    </section>
  );
}

const ETIQUETA = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--cinza-2)',
} as const;

/** Tira um degrau do recorte — e os que dependem dele.
 *
 *  AQUI E NÃO NO DOMÍNIO porque a chave do chip é a do filtro (`lentes`,
 *  `fontes` são listas), e `subindoDe` já resolve isso. Esta função só traduz os
 *  nomes que a fileira usa (`lente`, `fonte`, no singular do rótulo). */
function semODegrau(filtro: FiltroDoRisco, chave: string): FiltroDoRisco {
  if (chave === 'lentes' || chave === 'lente') return { ...filtro, lentes: [] };
  if (chave === 'fontes' || chave === 'fonte') return { ...filtro, fontes: [] };
  if (chave === 'bloco') return { ...filtro, bloco: null, macro: null, tema: null };
  if (chave === 'macro') return { ...filtro, macro: null, tema: null };
  if (chave === 'cluster') return { ...filtro, cluster: null, risco: null };
  return { ...filtro, [chave]: null };
}

/** O mapa de dimensões sem as chaves vazias — chave sem valor viraria
 *  `dimensao=tier:` na consulta, que o servidor recusa com razão. */
function semVazios(dimensoes: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(dimensoes).filter(([, valor]) => valor));
}
