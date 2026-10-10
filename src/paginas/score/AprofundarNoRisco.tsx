/** O aprofundamento: o modal que abre quando alguém clica num dado da aba.
 *
 *  POR QUE ELE EXISTE, e é a mesma razão das Lentes, nas palavras do dono do
 *  produto: "ao clicar em um dado temos que abrir um modal com o deep diving, e
 *  não como é feito hoje". Clicar aplicando o recorte na TELA INTEIRA refaz o
 *  gráfico, a matriz e os números, e quem clicou perde de vista de onde saiu. É
 *  recortar, não aprofundar. O modal põe o pedaço AO LADO, com a trilha de volta.
 *
 *  QUATRO PARTES, na ordem da descida:
 *
 *    1. a trilha — o caminho percorrido, cada degrau removível
 *    2. os números do recorte: incidentes e a divisão por severidade
 *    3. "dentro deste recorte": o próximo degrau, com quanto cada opção tem —
 *       clicar EMPILHA, sem fechar o painel
 *    4. os registros: as notícias e as reuniões, que é onde a descida termina
 *
 *  A ESCADA É A DO CADASTRO: N1 > N2 > N3 e cluster > risco. Sem N1 escolhido
 *  oferece os N1; com N1, os N2 daquele N1. Oferecer os 104 temas de uma vez
 *  seria devolver a lista que a hierarquia existe para evitar.
 *
 *  E O QUE RESTA DEPOIS DO N3 É A SEVERIDADE: ela é corte transversal, não
 *  nível, e por isso aparece quando a taxonomia acabou — a pergunta "e disto,
 *  quanto é crítico" vale em qualquer ponto da descida.
 *
 *  DOIS PEDIDOS, E NÃO UM. As Lentes resolvem o painel num endpoint só; aqui os
 *  dois que a tela já usa respondem exatamente isto — o painel dá os números e a
 *  matriz do recorte, a página dá os registros. Um terceiro endpoint seria uma
 *  terceira definição de incidente para manter em pé.
 */

import { useEffect, useState } from 'react';

import { listarIncidentesDeRisco, obterPainelDeRisco } from '@/api/cliente';
import { Carregando, FaixaDeErro, Modal } from '@/componentes/basicos';
import {
  SEVERIDADES,
  areaDaSeveridade,
  corDaSeveridade,
  proximoNivelDoTema,
  rotuloDaSeveridade,
  textoDaSeveridade,
  trilhaDoRecorte,
} from '@/dominio/riscos';
import type {
  FiltroDoRisco,
  NivelDoTema,
  PaginaDeIncidentes,
  PainelDeRisco,
} from '@/dominio/riscos';
import { dataCompleta, numero } from '@/dominio/formato';
import { RelatorioDeIncidentes } from '@/paginas/score/RelatorioDeIncidentes';

/** Quantos registros o painel mostra por página. Menos que a tela de trás: aqui
 *  o recorte já é estreito, e vinte linhas cabem sem rolagem interminável. */
const POR_PAGINA = 20;

export function AprofundarNoRisco({
  filtro,
  arvore,
  clusters,
  ultimoDegrau,
  aoFechar,
  aoDescer,
  aoSubir,
}: {
  /** O recorte aberto: o caminho inteiro, não só o último degrau. */
  filtro: FiltroDoRisco;
  arvore: NivelDoTema[];
  clusters: { codigo: string; nome: string; riscos: { codigo: string; nome: string }[] }[];
  /** O degrau que a pessoa ACABOU de abrir, para o título.
   *
   *  PARA O TÍTULO, e não o último da trilha: a trilha vem na ordem do DOMÍNIO
   *  (para dois links do mesmo recorte se lerem igual), não na da descida. Quem
   *  abre "Risco: barragem" e desce em "Crítico" veria o título voltar para a
   *  severidade, porque ela vem depois na ordem. */
  ultimoDegrau?: string;
  aoFechar: () => void;
  aoDescer: (chave: string, valor: string) => void;
  aoSubir: (chave: string) => void;
}) {
  const [painel, definirPainel] = useState<PainelDeRisco | null>(null);
  const [registros, definirRegistros] = useState<PaginaDeIncidentes | null>(null);
  //: A MESMA DERIVAÇÃO DA TELA DE TRÁS: a página pertence a um recorte, e
  //: descer um degrau já começa na primeira. Ver `RastreioDeRisco`.
  const [paginaEscolhida, definirPaginaEscolhida] = useState({ caminho: '', pagina: 1 });
  const [erro, definirErro] = useState<string | null>(null);

  //: O FILTRO SERIALIZADO É A CHAVE DO EFEITO, e não o objeto: a tela monta um
  //: objeto novo a cada render, e um efeito que dependesse dele recarregaria em
  //: laço. Extraído para variável porque a lista de dependências só se verifica
  //: estática — a expressão em linha passa sem checagem nenhuma.
  const caminho = JSON.stringify(filtro);
  const pagina = paginaEscolhida.caminho === caminho ? paginaEscolhida.pagina : 1;
  const trocarPagina = (nova: number) => definirPaginaEscolhida({ caminho, pagina: nova });

  useEffect(() => {
    let ativo = true;
    definirErro(null);
    const recorte = JSON.parse(caminho) as FiltroDoRisco;
    Promise.all([
      obterPainelDeRisco(recorte),
      listarIncidentesDeRisco(recorte, pagina, POR_PAGINA),
    ])
      .then(([doPainel, daPagina]) => {
        if (!ativo) return;
        definirPainel(doPainel);
        definirRegistros(daPagina);
      })
      .catch((falha: unknown) => {
        if (!ativo) return;
        definirPainel(null);
        definirRegistros(null);
        definirErro(falha instanceof Error ? falha.message : 'Não foi possível carregar.');
      });
    return () => {
      ativo = false;
    };
  }, [caminho, pagina]);

  const trilha = trilhaDoRecorte(filtro);
  const nivel = proximoNivelDoTema(arvore, filtro);
  const noCluster = clusters.find((cluster) => cluster.codigo === filtro.cluster);

  return (
    <Modal titulo={tituloDoPainel(filtro, ultimoDegrau)} aoFechar={aoFechar} largura={720}>
      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      {/* 1. A TRILHA. Cada degrau sai pelo seu ×, e tirar o pai tira os filhos:
          um N2 sem o N1 dele seria recorte impossível. */}
      {trilha.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            paddingBottom: 14,
            borderBottom: '1px solid var(--borda)',
          }}
        >
          {trilha.map((degrau) => (
            <span
              key={degrau.chave}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                padding: '3px 4px 3px 10px',
                border: '1px solid var(--borda)',
                borderRadius: 'var(--r-chip)',
                background: 'var(--bg-trilho)',
                fontSize: 12,
                color: 'var(--cinza-3)',
              }}
            >
              <strong style={{ fontWeight: 700 }}>{degrau.rotulo}:</strong> {degrau.valor}
              <button
                type="button"
                aria-label={`Subir um nível — remover ${degrau.rotulo}: ${degrau.valor}`}
                onClick={() => aoSubir(degrau.chave)}
                style={{
                  width: 22,
                  height: 22,
                  border: 0,
                  background: 'transparent',
                  color: 'var(--cinza-2)',
                  fontSize: 15,
                  lineHeight: 1,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {painel === null || registros === null ? (
        <Carregando rotulo="Abrindo o recorte…" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 16 }}>
          {/* 2. OS NÚMEROS DO RECORTE. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>
                {numero(registros.total)}
              </span>
              <span style={{ fontSize: 13, color: 'var(--cinza-3)' }}>
                {registros.total === 1 ? 'incidente' : 'incidentes'}
              </span>
            </div>
            {SEVERIDADES.map((severidade) => {
              const quantos = painel.total_por_severidade[severidade.codigo] ?? 0;
              if (!quantos) return null;
              return (
                <button
                  key={severidade.codigo}
                  type="button"
                  //: OS TRÊS NÚMEROS SÃO DEGRAUS: clicar em "Crítico 6" desce
                  //: nos seis. É a pior severidade do incidente, a mesma régua
                  //: da coluna da tabela — por isso os três somam o total.
                  aria-label={`Aprofundar nos ${numero(quantos)} incidentes de severidade ${rotuloDaSeveridade(severidade.codigo)}`}
                  onClick={() => aoDescer('severidade', severidade.codigo)}
                  disabled={filtro.severidade === severidade.codigo}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 10px',
                    border: `1px solid ${corDaSeveridade(severidade.codigo)}`,
                    borderRadius: 'var(--r-chip)',
                    background: areaDaSeveridade(severidade.codigo),
                    color: textoDaSeveridade(severidade.codigo),
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: filtro.severidade === severidade.codigo ? 'default' : 'pointer',
                  }}
                >
                  {rotuloDaSeveridade(severidade.codigo)}
                  <span style={{ fontSize: 18, fontWeight: 800 }}>{numero(quantos)}</span>
                </button>
              );
            })}
          </div>

          {/* 3. DENTRO DESTE RECORTE: o próximo degrau, com quanto cada opção
              tem. Sem a contagem, escolher seria chute. */}
          {nivel ? (
            <Degrau
              titulo={
                nivel.chave === 'bloco'
                  ? 'Dentro deste recorte · por pilar (N1)'
                  : nivel.chave === 'macro'
                    ? 'Dentro deste recorte · por macro tema (N2)'
                    : 'Dentro deste recorte · por tema (N3)'
              }
              opcoes={nivel.opcoes.map((um) => ({
                codigo: um.codigo,
                nome: um.nome,
                quantos: um.incidentes,
              }))}
              aoDescer={(valor) => aoDescer(nivel.chave, valor)}
            />
          ) : null}

          {!filtro.risco && noCluster ? (
            <Degrau
              titulo="Dentro deste recorte · por risco"
              opcoes={painel.matriz
                .filter((risco) => risco.cluster === noCluster.codigo && risco.incidentes > 0)
                .map((risco) => ({
                  codigo: risco.codigo,
                  nome: risco.nome,
                  quantos: risco.incidentes,
                }))}
              aoDescer={(valor) => aoDescer('risco', valor)}
            />
          ) : null}

          {!filtro.cluster ? (
            <Degrau
              titulo="Dentro deste recorte · por cluster de risco"
              opcoes={clustersComIncidente(painel)}
              aoDescer={(valor) => aoDescer('cluster', valor)}
            />
          ) : null}

          {/* 4. OS REGISTROS — o fim da descida. */}
          <RelatorioDeIncidentes
            pagina={registros}
            aoMudarPagina={trocarPagina}
            aoAprofundarNoTema={(tema) => aoDescer('tema', tema)}
          />
        </div>
      )}
    </Modal>
  );
}

/** Um degrau oferecido: as opções com quanto cada uma tem, em barra.
 *
 *  EM BARRA E NÃO EM LISTA: a pergunta é "onde está a massa", e a proporção se
 *  lê de relance enquanto o número exige ler cada linha. */
function Degrau({
  titulo,
  opcoes,
  aoDescer,
}: {
  titulo: string;
  opcoes: { codigo: string; nome: string; quantos: number }[];
  aoDescer: (valor: string) => void;
}) {
  const comAlgo = opcoes.filter((opcao) => opcao.quantos > 0);
  if (comAlgo.length === 0) return null;
  const maior = Math.max(...comAlgo.map((opcao) => opcao.quantos));

  return (
    <div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--cinza-2)',
          marginBottom: 8,
        }}
      >
        {titulo}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[...comAlgo]
          .sort((a, b) => b.quantos - a.quantos)
          .map((opcao) => (
            <button
              key={opcao.codigo || 'sem-classificacao'}
              type="button"
              //: O NÓ SEM CÓDIGO NÃO DESCE: é o assunto sem classificação na
              //: taxonomia, e não há nível por onde entrar nele. A linha fica,
              //: desabilitada e com o motivo, porque a contagem é informação.
              //: Achado de revisão.
              disabled={!opcao.codigo}
              title={
                opcao.codigo
                  ? undefined
                  : 'Assunto sem classificação na taxonomia — não há nível por onde descer'
              }
              onClick={() => aoDescer(opcao.codigo)}
              style={{
                position: 'relative',
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                minHeight: 34,
                padding: '6px 10px',
                boxSizing: 'border-box',
                textAlign: 'left',
                border: '1px solid var(--borda)',
                borderRadius: 'var(--r-btn)',
                background: `linear-gradient(90deg, var(--bg-trilho) ${(100 * opcao.quantos) / maior}%, var(--branco) ${(100 * opcao.quantos) / maior}%)`,
                fontSize: 13,
                color: opcao.codigo ? 'var(--cinza-4)' : 'var(--cinza-2)',
                cursor: opcao.codigo ? 'pointer' : 'default',
              }}
            >
              <span style={{ lineHeight: 1.3 }}>{opcao.nome}</span>
              <span style={{ fontWeight: 700 }}>{numero(opcao.quantos)}</span>
            </button>
          ))}
      </div>
    </div>
  );
}

function clustersComIncidente(painel: PainelDeRisco) {
  const por: Map<string, { codigo: string; nome: string; quantos: number }> = new Map();
  for (const risco of painel.matriz) {
    const atual = por.get(risco.cluster) ?? {
      codigo: risco.cluster,
      nome: risco.cluster_nome,
      quantos: 0,
    };
    atual.quantos += risco.incidentes;
    por.set(risco.cluster, atual);
  }
  return [...por.values()];
}

/** O TÍTULO DIZ O DEGRAU QUE A PESSOA ACABOU DE ABRIR.
 *
 *  E não o último da trilha: a trilha está na ordem do domínio, e quem clicou
 *  num risco e desceu numa severidade veria o título voltar ao risco. */
function tituloDoPainel(filtro: FiltroDoRisco, ultimo?: string): string {
  if (ultimo === 'de' || ultimo === 'ate') {
    return `Incidentes de ${filtro.de === filtro.ate && filtro.de ? mesLegivel(filtro.de) : 'do período'}`;
  }
  const trilha = trilhaDoRecorte(filtro);
  const degrau = trilha.find((um) => um.chave === ultimo) ?? trilha[trilha.length - 1];
  if (!degrau) return 'Aprofundamento do risco';
  return `${degrau.rotulo}: ${degrau.valor}`;
}

function mesLegivel(mes: string): string {
  return dataCompleta(`${mes}-01`).slice(3);
}
