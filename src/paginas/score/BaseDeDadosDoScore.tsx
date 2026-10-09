/** A Base de dados dos KPIs: as menções de cada lente como chegaram da fonte.
 *
 *  PARA QUEM QUER ENTRAR NO DETALHE: o índice e os dossiês resumem; aqui estão
 *  as linhas — cada matéria, post ou mensagem, com o texto e o link quando a
 *  fonte os mandou. Mesmo desenho da Base do CRM dos Stakeholders: busca
 *  inteligente, faixa de filtros congelada, colunas escolhíveis, exportação.
 *
 *  UMA SUBABA POR LENTE. Institucional não tem menções — ela lê o CRM, que tem
 *  a Base dele —, e a subaba diz isso em vez de mostrar uma tabela vazia.
 *
 *  TODA CONTA É DO SERVIDOR: filtro, busca, ordem e página. A tela só pede e
 *  desenha — com milhares de menções por mês, filtrar no navegador seria
 *  baixar a base inteira a cada visita.
 */

import { useEffect, useMemo, useState } from 'react';

import { listarMencoesDaBase, obterOpcoesDaBase } from '@/api/cliente';
import type { ConsultaDaBase, OpcoesDaBase, PaginaDaBase } from '@/api/cliente';
import { Abas } from '@/componentes/Abas';
import { Botao, Cartao, Chip, FaixaDeErro, Secao, estiloDeEntrada } from '@/componentes/basicos';
import { CampoSuspenso } from '@/componentes/CampoSuspenso';
import { FaixaDeFiltros } from '@/componentes/FaixaDeFiltros';
import type { CampoDeFiltro } from '@/componentes/PainelDeFiltros';
import { SeletorDeColunas, useColunasVisiveis } from '@/componentes/SeletorDeColunas';
import { celula } from '@/componentes/estilos';
import { Linha, Tabela } from '@/componentes/Tabela';
import {
  COLUNAS_OCULTAS_POR_PADRAO,
  LENTES_DA_BASE,
  camposDaBase,
  colunasDaBase,
  csvDaBase,
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

export function BaseDeDadosDoScore() {
  const [lente, definirLente] = useState<string>('imprensa');
  const [atalho, definirAtalho] = useState('tudo');
  const [deManual, definirDeManual] = useState('');
  const [ateManual, definirAteManual] = useState('');
  const [texto, definirTexto] = useState('');
  const [busca, definirBusca] = useState('');
  const [filtros, definirFiltros] = useState<Record<string, string | undefined>>({});
  const [pagina, definirPagina] = useState(1);
  const [ordem, definirOrdem] = useState<Ordem>({ coluna: 'Data', direcao: 'desc' });
  const [resposta, definirResposta] = useState<{ chave: string; dados: PaginaDaBase } | null>(null);
  const [opcoes, definirOpcoes] = useState<{ chave: string; dados: OpcoesDaBase } | null>(null);
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
    filtros,
    pagina,
    tamanho: TAMANHO_DA_PAGINA,
    ordenacao,
  };
  const chaveDaConsulta = `${lente}|${JSON.stringify(consulta)}`;
  const chaveDasOpcoes = `${lente}|${periodo.de ?? ''}|${periodo.ate ?? ''}`;
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

  useEffect(() => {
    if (!ehMencoes) return;
    let ativo = true;
    obterOpcoesDaBase(lente, periodo.de, periodo.ate)
      .then((dados) => ativo && definirOpcoes({ chave: chaveDasOpcoes, dados }))
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveDasOpcoes, ehMencoes]);

  const dados = resposta?.chave.startsWith(`${lente}|`) ? resposta.dados : null;
  const atualizando = resposta?.chave !== chaveDaConsulta;
  const opcoesDaLente = opcoes?.chave === chaveDasOpcoes ? opcoes.dados : null;

  const trocarLente = (nova: string) => {
    definirLente(nova);
    definirFiltros({});
    definirPagina(1);
  };
  const mudarFiltro = (chave: string, valor: string | undefined) => {
    definirFiltros((atuais) => ({ ...atuais, [chave]: valor }));
    definirPagina(1);
  };
  const limparTudo = () => {
    definirFiltros({});
    definirTexto('');
    definirBusca('');
    definirPagina(1);
  };

  const campos = camposDaBase(lente)
    .map((campo) => ({ campo, valores: opcoesDaLente?.[campo.de] ?? [] }))
    .filter(({ valores }) => valores.length > 0);
  const ativos = camposDaBase(lente).filter((campo) => filtros[campo.chave]);

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
            <strong>CRM dos Stakeholders</strong> (reuniões, audiências e eventos, com o clima
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
            {ativos.map((campo) => (
              <Chip
                key={campo.chave}
                rotulo={`${campo.rotulo}: ${campo.rotulos?.[filtros[campo.chave] as string] ?? filtros[campo.chave]}`}
                ativo
                fundo="var(--branco)"
                texto="var(--cinza-3)"
                titulo={`Remover o filtro ${campo.rotulo}`}
                aoClicar={() => mudarFiltro(campo.chave, undefined)}
              />
            ))}
            <span className="tabular" style={{ fontSize: 12, color: 'var(--cinza-2)' }} aria-live="polite">
              {atualizando ? 'atualizando…' : `${total.toLocaleString('pt-BR')} ${total === 1 ? 'menção' : 'menções'}`}
            </span>
            {ativos.length || busca ? (
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

          {/* OS FILTROS NA FAIXA DO CRM, congelada sob o cabeçalho ao rolar.
              Um por campo, escolha única; o campo sem valor no período não
              aparece. */}
          {campos.length ? (
            <FaixaDeFiltros colada={false}>
              {campos.map(({ campo, valores }) => {
                const valorAtual = filtros[campo.chave];
                const campoDeFiltro: CampoDeFiltro = {
                  chave: campo.chave,
                  rotulo: campo.rotulo,
                  itens: valores.map((valor) => ({ valor, rotulo: campo.rotulos?.[valor] ?? valor })),
                  valorAtual,
                  aoEscolher: (valor) => mudarFiltro(campo.chave, valorAtual === valor ? undefined : valor),
                };
                return (
                  <CampoSuspenso
                    key={campo.chave}
                    campo={campoDeFiltro}
                    aoLimpar={valorAtual ? () => mudarFiltro(campo.chave, undefined) : undefined}
                  />
                );
              })}
            </FaixaDeFiltros>
          ) : null}

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
              chaveDeArmazenamento={`score-base-${lente}`}
              altura="calc(100vh - 360px)"
              largurasPadrao={{ 'Matéria / post': 420 }}
            >
              {(dados?.itens ?? []).map((mencao) => (
                <Linha key={mencao.id}>
                  {colunasVisiveis.map((coluna) => {
                    if (coluna.rotulo === 'Matéria / post') {
                      return (
                        <td key={coluna.rotulo} style={{ ...celula, whiteSpace: 'normal' }}>
                          <span style={{ display: 'block', color: 'var(--cinza-4)', lineHeight: 1.4 }}>
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
                        <td key={coluna.rotulo} style={celula}>
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
                        <td key={coluna.rotulo} style={celula}>
                          {mencao.fonte}
                          {!mencao.fonte_no_calculo ? (
                            <span title="Fonte desligada na calibração: a linha existe, mas não entra na nota." style={{ display: 'block', fontSize: 11, color: 'var(--atencao-fg)' }}>
                              fora do cálculo
                            </span>
                          ) : null}
                        </td>
                      );
                    }
                    return (
                      <td key={coluna.rotulo} style={celula}>
                        {coluna.valor(mencao)}
                      </td>
                    );
                  })}
                </Linha>
              ))}
            </Tabela>
            {dados && !dados.itens.length ? (
              <p style={{ fontSize: 13, color: 'var(--cinza-2)', padding: '16px 4px' }}>
                Nenhuma menção com esses filtros no período.
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
