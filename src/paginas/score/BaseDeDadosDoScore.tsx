/** A Base de dados dos KPIs: as menções de cada lente como chegaram da fonte.
 *
 *  PARA QUEM QUER ENTRAR NO DETALHE: o índice e os dossiês resumem; aqui estão
 *  as linhas — cada matéria, post ou mensagem, com o texto e o link quando a
 *  fonte os mandou. Mesmo desenho da Base do CRM dos Stakeholders: busca
 *  inteligente, período, colunas escolhíveis, exportação.
 *
 *  SEM FILTROS RÁPIDOS POR ENQUANTO, por pedido — a primeira versão é a busca e
 *  o período; os filtros por campo entram depois (o servidor já os aceita).
 *
 *  UMA SUBABA POR LENTE. Institucional não tem menções — ela lê o CRM, que tem
 *  a Base dele —, e a subaba diz isso em vez de mostrar uma tabela vazia.
 *
 *  TODA CONTA É DO SERVIDOR: filtro, busca, ordem e página. A tela só pede e
 *  desenha — com milhares de menções por mês, filtrar no navegador seria
 *  baixar a base inteira a cada visita.
 */

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

import { listarMencoesDaBase } from '@/api/cliente';
import type { ConsultaDaBase, PaginaDaBase } from '@/api/cliente';
import { Abas } from '@/componentes/Abas';
import { Botao, Cartao, FaixaDeErro, Secao, estiloDeEntrada } from '@/componentes/basicos';
import { SeletorDeColunas, useColunasVisiveis } from '@/componentes/SeletorDeColunas';
import { celula } from '@/componentes/estilos';
import { Linha, Tabela } from '@/componentes/Tabela';
import {
  COLUNAS_OCULTAS_POR_PADRAO,
  LENTES_DA_BASE,
  colunasDaBase,
  classeDasLinhasDaColuna,
  colunaQuebraLinha,
  csvDaBase,
  largurasPadraoDaBase,
  periodoDoAtalho,
} from '@/dominio/baseDasLentes';
import { corForteDaLente } from '@/dominio/score';
import { CORES_DE_CLIMA } from '@/dominio/frentes';

const TAMANHO_DA_PAGINA = 50;
//: QUANTO A EXPORTAÇÃO LEVA: dez páginas de 500. Mais que isso pede uma
//: exportação do servidor, e a tela diz quando cortou.
const TETO_DA_EXPORTACAO = 5000;

const ATALHOS = [
  { chave: 'tudo', rotulo: 'Tudo' },
  { chave: '30', rotulo: '30 dias' },
  { chave: '90', rotulo: '90 dias' },
  { chave: '180', rotulo: '6 meses' },
  { chave: '365', rotulo: '12 meses' },
];

//: O SENTIMENTO NAS CORES DE CLIMA da plataforma — positivo, neutro, negativo.
const COR_DO_SENTIMENTO: Record<string, string> = {
  pos: CORES_DE_CLIMA.propositivo,
  neu: CORES_DE_CLIMA.neutro,
  neg: CORES_DE_CLIMA.tenso,
};

type Ordem = { coluna: string; direcao: 'asc' | 'desc' };

//: A CÉLULA DE CADA COLUNA: texto longo quebra linha; o curto e o link ficam
//: numa linha só, cortados com reticências DENTRO da própria coluna (o texto
//: nunca invade a vizinha, em qualquer largura que a pessoa escolha).
const CELULA_QUE_QUEBRA: CSSProperties = { ...celula, whiteSpace: 'normal', overflowWrap: 'anywhere' };
const CELULA_DE_UMA_LINHA: CSSProperties = {
  ...celula,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const celulaDaColuna = (rotulo: string): CSSProperties =>
  colunaQuebraLinha(rotulo) ? CELULA_QUE_QUEBRA : CELULA_DE_UMA_LINHA;

export function BaseDeDadosDoScore() {
  const [lente, definirLente] = useState<string>('imprensa');
  const [atalho, definirAtalho] = useState('tudo');
  const [deManual, definirDeManual] = useState('');
  const [ateManual, definirAteManual] = useState('');
  const [texto, definirTexto] = useState('');
  const [busca, definirBusca] = useState('');
  const [pagina, definirPagina] = useState(1);
  const [ordem, definirOrdem] = useState<Ordem>({ coluna: 'Data', direcao: 'desc' });
  const [resposta, definirResposta] = useState<{ chave: string; dados: PaginaDaBase } | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const [exportando, definirExportando] = useState(false);

  //: O PERÍODO: as datas digitadas vencem o atalho.
  const periodo =
    deManual || ateManual ? { de: deManual || undefined, ate: ateManual || undefined } : periodoDoAtalho(atalho);

  const colunas = useMemo(() => colunasDaBase(lente), [lente]);
  const { ocultas, visiveis, alternar } = useColunasVisiveis(
    `score-base-${lente}`,
    colunas.map((c) => c.rotulo),
    COLUNAS_OCULTAS_POR_PADRAO,
  );
  const colunasVisiveis = colunas.filter((c) => visiveis.includes(c.rotulo));

  //: A BUSCA ESPERA A PESSOA PARAR DE DIGITAR (350ms): sem isto, cada letra seria
  //: uma consulta, e a lista piscaria a cada tecla.
  useEffect(() => {
    const espera = setTimeout(() => {
      definirBusca(texto);
      definirPagina(1);
    }, 350);
    return () => clearTimeout(espera);
  }, [texto]);

  const ordenacao = (() => {
    const campo = colunas.find((c) => c.rotulo === ordem.coluna)?.ordena ?? 'data';
    return ordem.direcao === 'desc' ? `-${campo}` : campo;
  })();
  const consulta: ConsultaDaBase = {
    ...periodo,
    q: busca,
    pagina,
    tamanho: TAMANHO_DA_PAGINA,
    ordenacao,
  };
  const chaveDaConsulta = `${lente}|${JSON.stringify(consulta)}`;
  const ehMencoes = lente !== 'institucional';

  useEffect(() => {
    if (!ehMencoes) return;
    let ativo = true;
    listarMencoesDaBase(lente, consulta)
      .then((dados) => {
        if (!ativo) return;
        definirResposta({ chave: chaveDaConsulta, dados });
        definirErro(null);
      })
      .catch((falha: unknown) => ativo && definirErro(falha instanceof Error ? falha.message : 'Não foi possível ler.'));
    return () => {
      ativo = false;
    };
    // A consulta inteira está em `chaveDaConsulta`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveDaConsulta, ehMencoes]);


  const dados = resposta?.chave.startsWith(`${lente}|`) ? resposta.dados : null;
  const atualizando = resposta?.chave !== chaveDaConsulta;

  const trocarLente = (nova: string) => {
    definirLente(nova);
    definirPagina(1);
  };
  const limparTudo = () => {
    definirTexto('');
    definirBusca('');
    definirPagina(1);
  };


  const exportar = async () => {
    definirExportando(true);
    try {
      const todas = [];
      for (let p = 1; todas.length < TETO_DA_EXPORTACAO; p += 1) {
        const lote = await listarMencoesDaBase(lente, { ...consulta, pagina: p, tamanho: 500 });
        todas.push(...lote.itens);
        if (todas.length >= lote.total || !lote.itens.length) break;
      }
      const conteudo = csvDaBase(todas.slice(0, TETO_DA_EXPORTACAO), colunasVisiveis);
      const arquivo = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8' });
      const endereco = URL.createObjectURL(arquivo);
      const ancora = document.createElement('a');
      ancora.href = endereco;
      ancora.download = `base-${lente}.csv`;
      ancora.click();
      URL.revokeObjectURL(endereco);
    } finally {
      definirExportando(false);
    }
  };

  const total = dados?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / TAMANHO_DA_PAGINA));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, ['--cor-dos-titulos' as string]: corForteDaLente(lente) }}>
      <Secao
        titulo="Base de dados"
        subtitulo="As menções como chegaram de cada fonte. Filtre por qualquer campo, busque por qualquer palavra e abra a matéria ou o post original."
      >
        <Abas
          abas={LENTES_DA_BASE}
          ativa={lente as (typeof LENTES_DA_BASE)[number]['id']}
          aoTrocar={trocarLente}
          rotulo="Base de dados por lente"
          prefixo="base-lente"
          corDaAba={corForteDaLente}
        />
      </Secao>

      {!ehMencoes ? (
        <Cartao>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--cinza-3)' }}>
            A lente Institucional não vem de menções: ela lê as interações do{' '}
            <strong>CRM dos Stakeholders</strong> (reuniões, audiências e eventos, com o termômetro
            registrado). A consulta dessas interações, com todos os filtros, está na{' '}
            <strong>Base do CRM</strong> — menu CRM dos Stakeholders › Base.
          </p>
        </Cartao>
      ) : (
        <>
          {/* A BUSCA INTELIGENTE, no desenho da do CRM: campo, chips dos filtros
              ativos com ×, a contagem e "Limpar". */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              padding: '10px 14px',
              background: 'var(--bg-trilho)',
              border: '1px solid var(--borda)',
              borderRadius: 'var(--r-card-int)',
            }}
          >
            <span
              style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--cinza-2)' }}
            >
              Busca inteligente
            </span>
            <input
              aria-label="Buscar nas menções"
              value={texto}
              onChange={(evento) => definirTexto(evento.target.value)}
              placeholder="Buscar no texto, veículo, jornalista, tema, concessionária, UF…"
              style={{ ...estiloDeEntrada, height: 30, flex: '1 1 300px', minWidth: 220, fontSize: 12.5 }}
            />
            <span className="tabular" style={{ fontSize: 12, color: 'var(--cinza-2)' }} aria-live="polite">
              {atualizando ? 'atualizando…' : `${total.toLocaleString('pt-BR')} ${total === 1 ? 'menção' : 'menções'}`}
            </span>
            {busca ? (
              <span style={{ marginLeft: 'auto' }}>
                <Botao variante="fantasma" aoClicar={limparTudo}>
                  Limpar
                </Botao>
              </span>
            ) : null}
          </div>

          {/* O PERÍODO: atalhos e datas. As datas digitadas vencem o atalho. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="kicker">Período</span>
            {ATALHOS.map((item) => {
              const marcado = !deManual && !ateManual && atalho === item.chave;
              return (
                <button
                  key={item.chave}
                  type="button"
                  aria-pressed={marcado}
                  onClick={() => {
                    definirAtalho(item.chave);
                    definirDeManual('');
                    definirAteManual('');
                    definirPagina(1);
                  }}
                  style={{
                    height: 26,
                    padding: '0 11px',
                    borderRadius: 'var(--r-chip)',
                    border: marcado ? '1px solid var(--azul-mar)' : '1px solid var(--borda-input)',
                    background: marcado ? 'var(--azul-mar)' : 'var(--branco)',
                    color: marcado ? 'var(--branco)' : 'var(--cinza-3)',
                    fontSize: 11.5,
                    fontWeight: marcado ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {item.rotulo}
                </button>
              );
            })}
            <label style={{ fontSize: 12, color: 'var(--cinza-2)', display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
              de
              <input
                type="date"
                value={deManual}
                onChange={(evento) => {
                  definirDeManual(evento.target.value);
                  definirPagina(1);
                }}
                style={{ ...estiloDeEntrada, height: 28, width: 150, fontSize: 12.5 }}
              />
            </label>
            <label style={{ fontSize: 12, color: 'var(--cinza-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              até
              <input
                type="date"
                value={ateManual}
                onChange={(evento) => {
                  definirAteManual(evento.target.value);
                  definirPagina(1);
                }}
                style={{ ...estiloDeEntrada, height: 28, width: 150, fontSize: 12.5 }}
              />
            </label>
          </div>


          {erro ? <FaixaDeErro mensagem={erro} /> : null}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
            <SeletorDeColunas todasAsColunas={colunas.map((c) => c.rotulo)} ocultas={ocultas} aoAlternar={alternar} />
            <Botao variante="primario" desabilitado={exportando || !total} aoClicar={exportar}>
              {exportando ? 'Exportando…' : 'Exportar CSV'}
            </Botao>
          </div>

          <div style={{ opacity: atualizando ? 0.6 : 1, transition: 'opacity 120ms ease' }}>
            <Tabela
              colunas={visiveis}
              colunasOrdenaveis={colunas.filter((c) => c.ordena && visiveis.includes(c.rotulo)).map((c) => c.rotulo)}
              ordenacao={ordem}
              aoOrdenar={(coluna) => {
                definirOrdem((atual) =>
                  atual.coluna === coluna
                    ? { coluna, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' }
                    : { coluna, direcao: coluna === 'Data' || coluna === 'Engajamento' ? 'desc' : 'asc' },
                );
                definirPagina(1);
              }}
              //: v2: as larguras que alguém arrastou no layout antigo (espremido)
              //: não valem mais — todo mundo recomeça do padrão novo.
              chaveDeArmazenamento={`score-base-v2-${lente}`}
              altura="calc(100vh - 360px)"
              largurasPadrao={largurasPadraoDaBase(visiveis)}
              barraDeLargura
            >
              {(dados?.itens ?? []).map((mencao) => (
                <Linha key={mencao.id}>
                  {colunasVisiveis.map((coluna) => {
                    if (coluna.rotulo === 'Matéria / post') {
                      return (
                        <td key={coluna.rotulo} style={celulaDaColuna(coluna.rotulo)}>
                          {/* PARA EM TRÊS LINHAS: o título mais longo da base
                              tem 2.169 caracteres, que em 380px são ~39 linhas
                              — e a célula gigante esticava a linha inteira da
                              tabela. O valor completo vai no `title`.

                              E NENHUM `display` EM LINHA AQUI. Havia um
                              `display: 'block'`, e estilo em linha vence a
                              classe: ele desligava o `display: -webkit-box` de
                              que o `-webkit-line-clamp` depende, e o limite
                              nunca agia — a célula de 39 linhas continuava
                              inteira. Achado de revisão. A classe já é de
                              nível de bloco, então o link segue embaixo. */}
                          <span
                            className={classeDasLinhasDaColuna(coluna.rotulo)}
                            title={mencao.titulo ?? undefined}
                            style={{ color: 'var(--cinza-4)', lineHeight: 1.4 }}
                          >
                            {mencao.titulo ?? <span style={{ color: 'var(--cinza-2)' }}>sem texto na fonte</span>}
                          </span>
                          {mencao.link ? (
                            <a
                              href={mencao.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: 12, fontWeight: 700, color: 'var(--azul-mar)' }}
                            >
                              {lente === 'sociedade' ? 'Ver post ↗' : 'Abrir matéria ↗'}
                            </a>
                          ) : null}
                        </td>
                      );
                    }
                    if (coluna.rotulo === 'Sentimento' && mencao.sentimento) {
                      return (
                        <td key={coluna.rotulo} style={celulaDaColuna(coluna.rotulo)}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span
                              aria-hidden
                              style={{ width: 8, height: 8, borderRadius: '50%', background: COR_DO_SENTIMENTO[mencao.sentimento] ?? 'var(--cinza-2)' }}
                            />
                            {coluna.valor(mencao)}
                          </span>
                        </td>
                      );
                    }
                    if (coluna.rotulo === 'Fonte') {
                      return (
                        <td key={coluna.rotulo} style={celulaDaColuna(coluna.rotulo)}>
                          {mencao.fonte}
                          {!mencao.fonte_no_calculo ? (
                            <span title="Fonte desligada na calibração: a linha existe, mas não entra na nota." style={{ display: 'block', fontSize: 11, color: 'var(--atencao-fg)' }}>
                              fora do cálculo
                            </span>
                          ) : null}
                        </td>
                      );
                    }
                    const limite = classeDasLinhasDaColuna(coluna.rotulo);
                    return (
                      <td
                        key={coluna.rotulo}
                        style={celulaDaColuna(coluna.rotulo)}
                        title={coluna.valor(mencao) || undefined}
                      >
                        {/* O LIMITE DE LINHAS VAI NUM EMBRULHO, nunca no `td`:
                            `-webkit-line-clamp` exige `display: -webkit-box`, e
                            isso num `td` substitui o `display: table-cell` — a
                            célula para de participar da grade e briga com o
                            `<colgroup>` e o `table-layout: fixed`. Achado de
                            revisão. */}
                        {limite ? (
                          <span className={limite}>{coluna.valor(mencao)}</span>
                        ) : (
                          coluna.valor(mencao)
                        )}
                      </td>
                    );
                  })}
                </Linha>
              ))}
            </Tabela>
            {dados && !dados.itens.length ? (
              <p style={{ fontSize: 13, color: 'var(--cinza-2)', padding: '16px 4px' }}>
                Nenhuma menção com essa busca no período.
              </p>
            ) : null}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
            <Botao variante="fantasma" desabilitado={pagina <= 1} aoClicar={() => definirPagina((p) => p - 1)}>
              ‹ Anterior
            </Botao>
            <span className="tabular" style={{ fontSize: 12.5, color: 'var(--cinza-2)' }}>
              Página {pagina} de {paginas}
            </span>
            <Botao variante="fantasma" desabilitado={pagina >= paginas} aoClicar={() => definirPagina((p) => p + 1)}>
              Próxima ›
            </Botao>
          </div>
        </>
      )}
    </div>
  );
}
