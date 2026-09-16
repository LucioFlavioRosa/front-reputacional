/** Tabela reduzida de interações, logo abaixo do Bloco 1 do Painel.
 *
 *  REDUZIDA DE PROPÓSITO: a Base já tem a tabela completa, com todas as
 *  colunas e seleção de quais mostrar. Aqui o objetivo é outro — um resumo de
 *  "quem apareceu por último e como foi" dentro do próprio Painel —, e por
 *  isso só as colunas mais lidas: Data, Instituição, Stakeholder, Pauta,
 *  Área(s), Relevância e Clima.
 *
 *  PAGINADA, e não com rolagem interna como a Base: dez linhas por página por
 *  padrão, com a quantidade ajustável — quem quiser ver mais de uma vez só
 *  aumenta o número, em vez de rolar por dentro de uma tela que já rola por
 *  fora.
 *
 *  MESMO RECORTE do resto do Painel — a lista vem de `interacoes`, que já é o
 *  recorte filtrado; esta tabela nunca busca dado próprio.
 */

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Botao,
  Chip,
  ChipDeFrente,
  Modal,
  Secao,
  Selo,
  Vazio,
  estiloDeEntrada,
} from '@/componentes/basicos';
import { celula } from '@/componentes/estilos';
import { Linha as LinhaDaTabela, Tabela } from '@/componentes/Tabela';
import { dataCompleta, tituloDaAgenda } from '@/dominio/formato';
import { rotuloDeAbrangencia } from '@/dominio/frentes';
import { alternarOrdenacao, ordenarPor } from '@/dominio/ordenacao';
import type { Ordenacao } from '@/dominio/ordenacao';
import {
  nomeDaInstituicao,
  nomesDosTemas,
  rotuloDeCodigo,
  rotuloDeRelevancia,
} from '@/dominio/derivacoes';
import type { Catalogo } from '@/dominio/derivacoes';
import type { Interacao } from '@/dominio/tipos';

const COLUNAS_COMPLETAS = ['Data', 'Instituição', 'Stakeholder', 'Pauta', 'Área(s)', 'Relevância', 'Clima'];

//: A VERSÃO REDUZIDA serve às três tabelas de área fixa do Painel: a área já
//: está no título do cartão (é fixa, não uma coluna), Stakeholder e
//: Relevância saem para a lista caber lado a lado com as outras duas sem
//: rolagem horizontal. CLIMA TAMBÉM SAI COMO COLUNA — a linha inteira já
//: pinta pela cor do clima (`FUNDO_DA_LINHA_POR_CLIMA`), então o selo
//: repetiria em texto uma informação que a cor já deu, só para ocupar um
//: espaço que as três tabelas lado a lado não sobram.
const COLUNAS_REDUZIDAS = ['Data', 'Instituição', 'Pauta'];

//: SÓ DATA E INSTITUIÇÃO, por pedido — mais antigo/mais novo e A-Z/Z-A. As
//: demais colunas continuam como cabeçalho simples, sem seta nem clique.
const COLUNAS_ORDENAVEIS = ['Data', 'Instituição'];

const PADRAO_POR_PAGINA = 10;

/** O clima tem TRÊS códigos hoje (Propositivo/Neutro/Tenso), não cinco — ver
 *  `catalogo.dicionarios.climas`. O selo usa as mesmas cores do resto do
 *  produto (`CORES_DE_CLIMA` em `dominio/frentes.ts`), com o par fundo/texto
 *  já conferido para contraste — turquesa só passa com texto escuro. */
const SELO_DO_CLIMA: Record<string, { fundo: string; texto: string }> = {
  propositivo: { fundo: 'var(--turquesa-rio)', texto: 'var(--sobre-turquesa)' },
  neutro: { fundo: 'var(--cinza-2)', texto: 'var(--branco)' },
  tenso: { fundo: 'var(--vermelho-pitanga)', texto: 'var(--branco)' },
};

//: A LINHA INTEIRA das três tabelas de área fixa pinta pelo clima — mesma
//: técnica de `Barra` (`color-mix` com o branco, a uma fração baixa): a cor
//: crua do selo (feita para contraste de texto em cima dela) é forte demais
//: pra virar fundo de linha inteira; diluída, dá para ler o texto normal por
//: cima sem competir com o selo da própria linha.
//:
//: NEUTRO A 12%, NÃO 7% — `--cinza-2` é um cinza-azulado de saturação baixa;
//: na mesma fração das outras duas (que são cores vivas, turquesa/vermelho)
//: ele ficava quase imperceptível. 12% equilibra visualmente com os 10% de
//: propositivo/tenso sem comprometer a leitura do texto por cima.
const FUNDO_DA_LINHA_POR_CLIMA: Record<string, string> = {
  propositivo: 'color-mix(in srgb, var(--turquesa-rio) 10%, var(--branco))',
  neutro: 'color-mix(in srgb, var(--cinza-2) 12%, var(--branco))',
  tenso: 'color-mix(in srgb, var(--vermelho-pitanga) 10%, var(--branco))',
};

//: A ORDEM QUE A LEGENDA MOSTRA — sempre proativo/neutro/reativo, a mesma
//: leitura da esquerda-pra-direita do resto do produto (ver `BarraDivergente`).
const CODIGOS_DE_CLIMA_NA_LEGENDA = ['propositivo', 'neutro', 'tenso'] as const;

/** Explica o que a cor de fundo de cada linha das três tabelas de área
 *  significa — uma legenda só, acima das três, não uma por tabela.
 *
 *  O RÓTULO VEM DO DICIONÁRIO (`rotuloDeCodigo`), a mesma fonte que o selo de
 *  clima de cada linha já usa (`SeloDeClima` abaixo): "Proativo"/"Reativo",
 *  não "Positiva"/"Negativa" — uma segunda nomenclatura para o mesmo conceito
 *  só confundiria quem já lê o selo da própria linha. */
export function LegendaDeClimaPorArea({ catalogo }: { catalogo: Catalogo }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        fontSize: 12,
        color: 'var(--cinza-3)',
        marginTop: 14,
        paddingTop: 10,
        borderTop: '1px solid var(--borda)',
      }}
    >
      <span style={{ color: 'var(--cinza-2)' }}>Cor da linha:</span>
      {CODIGOS_DE_CLIMA_NA_LEGENDA.map((codigo) => (
        <span key={codigo} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            aria-hidden
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: FUNDO_DA_LINHA_POR_CLIMA[codigo],
              border: '1px solid var(--borda)',
            }}
          />
          {rotuloDeCodigo(catalogo, 'climas', codigo)}
        </span>
      ))}
    </div>
  );
}

//: CÉLULA MAIS APERTADA, só para a versão reduzida (as três tabelas lado a
//: lado) — a completa continua com o espaçamento de sempre.
const CELULA_COMPACTA = { padding: '6px 8px' };

//: A PAUTA DA VERSÃO REDUZIDA quebra em até DUAS linhas antes de truncar —
//: uma só (a versão completa, `overflow+ellipsis+nowrap` de sempre) cortava
//: pauta longa cedo demais nas três tabelas lado a lado, que já têm menos
//: largura. `minHeight` reserva o espaço das duas linhas mesmo numa pauta
//: curta: é o que deixa a ALTURA DA LINHA FIXA — sem isto, cada linha da
//: tabela teria uma altura diferente dependendo do tamanho da própria pauta.
const PAUTA_EM_DUAS_LINHAS = {
  whiteSpace: 'normal' as const,
  display: '-webkit-box' as const,
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical' as const,
  overflow: 'hidden',
  lineHeight: 1.35,
  minHeight: '2.7em',
};

function SeloDeClima({ codigo, catalogo }: { codigo: string | null; catalogo: Catalogo }) {
  if (!codigo) return <span style={{ color: 'var(--cinza-2)', fontSize: 13 }}>—</span>;
  const cores = SELO_DO_CLIMA[codigo];
  const rotulo = rotuloDeCodigo(catalogo, 'climas', codigo);
  if (!cores) return <span style={{ fontSize: 13 }}>{rotulo}</span>;
  return <Selo rotulo={rotulo} fundo={cores.fundo} texto={cores.texto} />;
}

function nomesDasAreas(interacao: Interacao, catalogo: Catalogo): string {
  if (!interacao.areas.length) return '—';
  return interacao.areas
    .map((id) => catalogo.dicionarios.areas_pessoa.find((a) => a.id === id)?.nome ?? String(id))
    .join(', ');
}

/** O STAKEHOLDER É UM ID, não um código — diferente dos outros dicionários
 *  desta tela, que resolvem por `codigo` (ver `rotuloDeCodigo`). Mesmo campo
 *  que hoje só é lido e gravado (nada mais no app filtra ou soma por ele);
 *  aqui ele aparece pela primeira vez numa tela. */
function nomeDoStakeholder(catalogo: Catalogo, id: number | null): string {
  if (id == null) return '—';
  return catalogo.dicionarios.stakeholders.find((s) => s.id === id)?.nome ?? '—';
}

export function TabelaDeInteracoes({
  interacoes,
  catalogo,
  aoAbrirFicha,
  titulo = 'Interações mais recentes',
  colunas = 'completas',
}: {
  interacoes: Interacao[];
  catalogo: Catalogo;
  /** Abre a Ficha completa de uma interação específica — a mesma usada pela
   *  Base. A linha do tempo, dentro do popup, leva até ela quando alguém
   *  clica numa das outras interações do mesmo ente público. */
  aoAbrirFicha: (id: string) => void;
  /** Título do cartão — as três tabelas de área fixa usam o nome da área. */
  titulo?: string;
  /** 'reduzidas' tira Stakeholder e Relevância — usado pelas três tabelas de
   *  área fixa, lado a lado, onde a área já está dita no título do cartão. */
  colunas?: 'completas' | 'reduzidas';
}) {
  const reduzida = colunas === 'reduzidas';
  const colunasDaTabela = reduzida ? COLUNAS_REDUZIDAS : COLUNAS_COMPLETAS;
  //: SÓ AS TRÊS TABELAS DE ÁREA (`reduzida`) têm teto: lado a lado, sem
  //: rolagem horizontal, uma delas crescendo sem limite quebra o layout das
  //: outras duas. A tabela completa ("Interações mais recentes") continua
  //: sem teto — ela é a única na tela, e crescer não atrapalha ninguém.
  const maxPorPagina = reduzida ? 10 : undefined;
  const [pagina, definirPagina] = useState(1);
  const [porPagina, definirPorPagina] = useState(reduzida ? 5 : PADRAO_POR_PAGINA);
  const [ordenacao, definirOrdenacao] = useState<Ordenacao | null>({
    coluna: 'Data',
    direcao: 'desc',
  });
  const [aberta, definirAberta] = useState<Interacao | null>(null);

  const ordenadas = useMemo(() => {
    const extratores: Record<string, (i: Interacao) => string | number> = {
      Data: (i) => i.data_interacao,
      Instituição: (i) => nomeDaInstituicao(catalogo, i.instituicao_id),
    };
    return ordenarPor(interacoes, ordenacao, extratores);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interacoes, ordenacao, catalogo]);

  const totalDePaginas = Math.max(1, Math.ceil(ordenadas.length / porPagina));
  // Clampa sozinho quando o recorte (ou o tamanho da página) muda e a página
  // guardada deixa de existir — sem isto, filtrar para um recorte menor podia
  // deixar a tabela "na página 4 de 2", em branco, sem dizer por quê.
  const paginaAtual = Math.min(pagina, totalDePaginas);
  const daPagina = ordenadas.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);

  return (
    <Secao titulo={titulo}>
      {!ordenadas.length ? (
        <Vazio
          mensagem={`Nenhuma interação em ${titulo} neste recorte`}
          dica="Ajuste os filtros para ver resultados."
        />
      ) : (
        <>
          <Tabela
            colunas={colunasDaTabela}
            altura="none"
            colunasOrdenaveis={COLUNAS_ORDENAVEIS}
            ordenacao={ordenacao}
            compacta={reduzida}
            // AS TRÊS TABELAS DE ÁREA FIXA (`reduzida`) ganham largura fixa
            // desde o primeiro render — Data e Instituição enxutas, Pauta
            // (fora do mapa) leva o resto. Sem isto a tabela cresce pelo
            // CONTEÚDO (uma instituição de nome comprido, por exemplo) e
            // aperta a largura das outras duas tabelas ao lado no grid — ver
            // o comentário de `largurasPadrao` em `Tabela.tsx`.
            largurasPadrao={reduzida ? { Data: 76, Instituição: 84 } : undefined}
            aoOrdenar={(coluna) => {
              definirOrdenacao((atual) => alternarOrdenacao(atual, coluna));
              definirPagina(1);
            }}
          >
            {daPagina.map((interacao) => {
              const celulaAtual = reduzida ? { ...celula, ...CELULA_COMPACTA } : celula;
              return (
                <LinhaDaTabela
                  key={interacao.id}
                  aoClicar={() => definirAberta(interacao)}
                  titulo="Ver a ficha e a linha do tempo desta instituição"
                  estilo={
                    reduzida && interacao.clima
                      ? { background: FUNDO_DA_LINHA_POR_CLIMA[interacao.clima] }
                      : undefined
                  }
                >
                  <td style={{ ...celulaAtual, whiteSpace: 'nowrap' }} className="tabular">
                    {dataCompleta(interacao.data_interacao)}
                  </td>
                  <td
                    style={
                      reduzida
                        ? { ...celulaAtual, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                        : { ...celulaAtual, minWidth: 160 }
                    }
                  >
                    {nomeDaInstituicao(catalogo, interacao.instituicao_id)}
                  </td>
                  {reduzida ? null : (
                    <td style={{ ...celulaAtual, whiteSpace: 'nowrap', color: 'var(--cinza-2)' }}>
                      {nomeDoStakeholder(catalogo, interacao.stakeholder_id)}
                    </td>
                  )}
                  <td
                    style={
                      reduzida
                        ? { ...celulaAtual, ...PAUTA_EM_DUAS_LINHAS }
                        : {
                            ...celulaAtual,
                            maxWidth: 280,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }
                    }
                  >
                    {tituloDaAgenda(interacao, (ids) => nomesDosTemas(catalogo, ids))}
                  </td>
                  {reduzida ? null : (
                    <td style={{ ...celulaAtual, color: 'var(--cinza-2)' }}>
                      {nomesDasAreas(interacao, catalogo)}
                    </td>
                  )}
                  {reduzida ? null : (
                    <td style={{ ...celulaAtual, whiteSpace: 'nowrap' }}>
                      {rotuloDeRelevancia(catalogo, interacao.tier)}
                    </td>
                  )}
                  {reduzida ? null : (
                    <td style={celulaAtual}>
                      <SeloDeClima codigo={interacao.clima} catalogo={catalogo} />
                    </td>
                  )}
                </LinhaDaTabela>
              );
            })}
          </Tabela>

          <RodapeDePaginacao
            pagina={paginaAtual}
            totalDePaginas={totalDePaginas}
            porPagina={porPagina}
            maxPorPagina={maxPorPagina}
            aoMudarPagina={definirPagina}
            aoMudarPorPagina={(novo) => {
              definirPorPagina(novo);
              definirPagina(1);
            }}
          />

          {/* NO RODAPÉ DE CADA UMA DAS TRÊS TABELAS, e não uma legenda só
              acima do grid: quem olha só uma das três (a maioria das vezes)
              não deveria precisar rolar pra cima pra achar o que a cor da
              linha significa. */}
          {reduzida ? <LegendaDeClimaPorArea catalogo={catalogo} /> : null}
        </>
      )}

      {aberta ? (
        <PopupDaInteracao
          interacao={aberta}
          interacoes={interacoes}
          catalogo={catalogo}
          aoFechar={() => definirAberta(null)}
          aoAbrirFicha={(id) => {
            // FECHA ESTE POPUP ANTES DE ABRIR A FICHA — os dois são
            // overlays por cima da tela; um por cima do outro deixaria dois
            // fundos escurecidos empilhados, e fechar só a Ficha devolveria
            // a alguém um popup que ele não lembra ter deixado aberto.
            definirAberta(null);
            aoAbrirFicha(id);
          }}
        />
      ) : null}
    </Secao>
  );
}

function RodapeDePaginacao({
  pagina,
  totalDePaginas,
  porPagina,
  maxPorPagina,
  aoMudarPagina,
  aoMudarPorPagina,
}: {
  pagina: number;
  totalDePaginas: number;
  porPagina: number;
  /** Teto de registros por página — as três tabelas de área fixa o usam
   *  (lado a lado, sem rolagem horizontal); a tabela completa não tem. */
  maxPorPagina?: number;
  aoMudarPagina: (pagina: number) => void;
  aoMudarPorPagina: (porPagina: number) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 14,
      }}
    >
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--cinza-3)' }}>
        Mostrar
        <input
          type="number"
          min={1}
          max={maxPorPagina}
          inputMode="numeric"
          value={porPagina}
          onChange={(evento) => {
            const numero = Number(evento.target.value);
            // O `max` do HTML só afasta as setinhas do spinner — digitar ou
            // colar um número maior ainda passa. O teto de verdade é aqui.
            const inteiro = Number.isFinite(numero) && numero > 0 ? Math.floor(numero) : 1;
            aoMudarPorPagina(maxPorPagina ? Math.min(inteiro, maxPorPagina) : inteiro);
          }}
          style={{ ...estiloDeEntrada, width: 60, height: 30, padding: '0 8px', textAlign: 'center' }}
          aria-label="Quantos registros mostrar por página"
        />
        registros por página
      </label>

      {totalDePaginas > 1 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Botao variante="fantasma" desabilitado={pagina <= 1} aoClicar={() => aoMudarPagina(pagina - 1)}>
            ← Anterior
          </Botao>
          <span className="tabular" style={{ fontSize: 12.5, color: 'var(--cinza-3)' }}>
            Página {pagina} de {totalDePaginas}
          </span>
          <Botao
            variante="fantasma"
            desabilitado={pagina >= totalDePaginas}
            aoClicar={() => aoMudarPagina(pagina + 1)}
          >
            Próxima →
          </Botao>
        </div>
      ) : null}
    </div>
  );
}

/** Os mesmos campos de texto livre que a Ficha mostra — pauta, o
 *  posicionamento levado, e o que ficou registrado depois da reunião. Só os
 *  preenchidos entram, a mesma regra de `Ficha.tsx`. */
const CONTEUDO: { campo: keyof Interacao; rotulo: string }[] = [
  { campo: 'pauta', rotulo: 'Pauta' },
  { campo: 'posicionamento', rotulo: 'Posicionamento da companhia' },
  { campo: 'relato', rotulo: 'Relato' },
  { campo: 'encaminhamentos', rotulo: 'Repercussão e encaminhamentos' },
  { campo: 'pendencias', rotulo: 'Pendências' },
  { campo: 'observacoes', rotulo: 'Observações' },
];

const COLUNAS_DA_LINHA_DO_TEMPO = ['Data', 'Pauta', 'Área(s)', 'Clima'];

function PopupDaInteracao({
  interacao,
  interacoes,
  catalogo,
  aoFechar,
  aoAbrirFicha,
}: {
  interacao: Interacao;
  interacoes: Interacao[];
  catalogo: Catalogo;
  aoFechar: () => void;
  aoAbrirFicha: (id: string) => void;
}) {
  const nomeInstituicao = nomeDaInstituicao(catalogo, interacao.instituicao_id);

  // A LINHA DO TEMPO VEM DO MESMO `interacoes` do Painel — o recorte
  // filtrado, não a história inteira da instituição fora dele. É a mesma
  // regra da tabela ("respeitando o filtro global"), estendida para dentro
  // do popup: nenhum dos dois busca dado que os filtros já excluíram.
  const linhaDoTempo = useMemo(
    () =>
      interacoes
        .filter((i) => i.instituicao_id === interacao.instituicao_id && i.id !== interacao.id)
        .sort((a, b) => b.data_interacao.localeCompare(a.data_interacao)),
    [interacoes, interacao],
  );

  const conteudo = CONTEUDO.filter(({ campo }) => Boolean(interacao[campo]));

  return (
    <Modal
      titulo={nomeInstituicao}
      subtitulo={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <ChipDeFrente frente={interacao.frente} />
          {dataCompleta(interacao.data_interacao)}
        </span>
      }
      aoFechar={aoFechar}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <section>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--cinza-4)', margin: '0 0 14px' }}>
            {tituloDaAgenda(interacao, (ids) => nomesDosTemas(catalogo, ids))}
          </p>

          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 14,
              margin: 0,
            }}
          >
            <Metadado rotulo="Stakeholder" valor={nomeDoStakeholder(catalogo, interacao.stakeholder_id)} />
            <Metadado rotulo="Relevância" valor={rotuloDeRelevancia(catalogo, interacao.tier)} />
            <Metadado rotulo="Clima" valor={<SeloDeClima codigo={interacao.clima} catalogo={catalogo} />} />
            <Metadado rotulo="UF" valor={rotuloDeAbrangencia(interacao.uf)} />
            <Metadado rotulo="Situação" valor={rotuloDeCodigo(catalogo, 'status', interacao.status)} />
            <Metadado rotulo="Área(s)" valor={nomesDasAreas(interacao, catalogo)} />
          </dl>

          {interacao.temas.length ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cinza-2)', marginBottom: 6 }}>
                Temas
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {nomesDosTemas(catalogo, interacao.temas).map((tema) => (
                  <Chip key={tema} rotulo={tema} />
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {conteudo.length ? (
          <section>
            <div className="kicker" style={{ marginBottom: 10 }}>
              Conteúdo
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {conteudo.map(({ campo, rotulo }) => (
                <div key={campo}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cinza-2)' }}>
                    {rotulo}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--cinza-3)', marginTop: 3, lineHeight: 1.5 }}>
                    {String(interacao[campo])}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <div className="kicker" style={{ marginBottom: 10 }}>
            Linha do tempo com {nomeInstituicao}
          </div>
          {linhaDoTempo.length ? (
            <>
              <Tabela colunas={COLUNAS_DA_LINHA_DO_TEMPO} altura="none">
                {linhaDoTempo.map((item) => (
                  <LinhaDaTabela
                    key={item.id}
                    aoClicar={() => aoAbrirFicha(item.id)}
                    titulo="Abrir esta interação na Base"
                  >
                    <td style={{ ...celula, whiteSpace: 'nowrap' }} className="tabular">
                      {dataCompleta(item.data_interacao)}
                    </td>
                    <td
                      style={{
                        ...celula,
                        maxWidth: 320,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {tituloDaAgenda(item, (ids) => nomesDosTemas(catalogo, ids))}
                    </td>
                    <td style={{ ...celula, color: 'var(--cinza-2)' }}>
                      {nomesDasAreas(item, catalogo)}
                    </td>
                    <td style={celula}>
                      <SeloDeClima codigo={item.clima} catalogo={catalogo} />
                    </td>
                  </LinhaDaTabela>
                ))}
              </Tabela>
              <p style={{ fontSize: 11, color: 'var(--cinza-2)', marginTop: 8 }}>
                Clique numa interação para abrir a ficha completa na Base.
              </p>
            </>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--cinza-2)' }}>
              Nenhuma outra interação com esta instituição neste recorte.
            </p>
          )}
        </section>
      </div>
    </Modal>
  );
}

function Metadado({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div>
      <dt style={{ fontSize: 11, fontWeight: 700, color: 'var(--cinza-2)' }}>{rotulo}</dt>
      <dd style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--cinza-3)' }}>{valor}</dd>
    </div>
  );
}
