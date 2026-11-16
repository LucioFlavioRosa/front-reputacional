/** Indicadores de uso — login, upload de base e interação criada, por pessoa.
 *
 *  TRÊS CONTAGENS QUE JÁ EXISTIAM EM TABELAS SEPARADAS (`acesso_log`,
 *  `carga_de_base`, `interacao.criado_por`), cada uma pensada para outra
 *  pergunta — incidente de login, auditoria de carga, autoria de CRM. Esta
 *  tela é a primeira a juntar as três por pessoa, para responder "quem está
 *  usando a plataforma, e quanto" — ver `app/casos_de_uso/administrar_acessos.py::indicadores_de_uso`.
 *
 *  NÃO TEM "TEMPO NA TELA" NEM "PORTAL MAIS VISITADO": isso exigiria um
 *  evento de visualização de página que a plataforma não registra hoje —
 *  deliberadamente fora do escopo desta primeira versão, que só usa dado que
 *  já é confiável.
 */

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

import { detalheDeUso, listarAcessosPorDia, listarIndicadoresDeUso } from '@/api/cliente';
import { Carregando, Chip, FaixaDeErro, Modal, Vazio } from '@/componentes/basicos';
import { quantoTempo } from '@/dominio/cargasDasBases';
import type { ColunaMensal } from '@/dominio/derivacoes';
import type { AcessoNoDia, DetalheDeUso, IndicadorDeUso } from '@/dominio/tipos';
import { BarrasEmpilhadas } from '@/graficos/BarrasEmpilhadas';

type Periodo = '7' | '30' | '90' | 'tudo';

const OPCOES_DE_PERIODO: { id: Periodo; rotulo: string }[] = [
  { id: '7', rotulo: '7 dias' },
  { id: '30', rotulo: '30 dias' },
  { id: '90', rotulo: '90 dias' },
  { id: 'tudo', rotulo: 'Tudo' },
];

//: "TUDO" NÃO É LITERALMENTE SEM FILTRO — o backend sempre quer `de`/`ate`
//: explícitos aqui, então usa uma data âncora antes de a plataforma existir.
const INICIO_DA_PLATAFORMA = '2023-01-01';

function paraIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function intervaloDe(periodo: Periodo): { de: string; ate: string } {
  const hoje = new Date();
  if (periodo === 'tudo') return { de: INICIO_DA_PLATAFORMA, ate: paraIso(hoje) };

  const dias = Number(periodo);
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - (dias - 1));
  return { de: paraIso(inicio), ate: paraIso(hoje) };
}

function diasNoIntervalo(de: string, ate: string): number {
  const um_dia_em_ms = 86_400_000;
  return Math.round(
    (new Date(`${ate}T00:00:00`).getTime() - new Date(`${de}T00:00:00`).getTime()) / um_dia_em_ms,
  ) + 1;
}

//: ACIMA DISSO A BARRA VIRA UM RISCO FINO DEMAIS PRA LER — "Tudo" (anos de
//: histórico) mostra só a tabela por pessoa, sem o gráfico diário.
const TETO_DE_DIAS_NO_GRAFICO = 95;

function rotuloDoDia(chave: string): string {
  const [, mes, dia] = chave.split('-');
  return `${dia}/${mes}`;
}

/** Um dia sem login nenhum é 0, e não ausência — diferente de `semBase` em
 *  `ColunaMensal`, aqui todo dia do intervalo tem dado (o log existe desde
 *  sempre), só pode não ter tido acesso. */
function colunasPorDia(acessos: AcessoNoDia[], de: string, ate: string): ColunaMensal[] {
  const porDia = new Map(acessos.map((a) => [a.data, a.logins]));
  const colunas: ColunaMensal[] = [];
  const cursor = new Date(`${de}T00:00:00`);
  const fim = new Date(`${ate}T00:00:00`);
  while (cursor <= fim) {
    const chave = paraIso(cursor);
    const logins = porDia.get(chave) ?? 0;
    colunas.push({
      mes: chave,
      total: logins,
      segmentos:
        logins > 0 ? [{ chave: 'logins', rotulo: 'Logins', cor: 'var(--azul-mar)', total: logins }] : [],
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return colunas;
}

function GraficoDeAcessosPorDia({ de, ate }: { de: string; ate: string }) {
  const [acessos, definirAcessos] = useState<AcessoNoDia[] | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    definirAcessos(null);
    definirErro(null);
    listarAcessosPorDia(de, ate)
      .then((lista) => {
        if (vivo) definirAcessos(lista);
      })
      .catch((falha: unknown) => {
        if (vivo) definirErro(falha instanceof Error ? falha.message : String(falha));
      });
    return () => {
      vivo = false;
    };
  }, [de, ate]);

  if (erro) return <FaixaDeErro mensagem={`Não foi possível ler os acessos por dia: ${erro}`} />;
  if (!acessos) return <Carregando rotulo="Carregando acessos por dia…" />;
  if (diasNoIntervalo(de, ate) > TETO_DE_DIAS_NO_GRAFICO) {
    return (
      <p style={{ fontSize: 13, color: 'var(--cinza-2)' }}>
        Escolha um período de até {TETO_DE_DIAS_NO_GRAFICO} dias para ver o gráfico diário.
      </p>
    );
  }
  const pessoasPorDia = new Map(acessos.map((a) => [a.data, a.pessoas]));
  return (
    <BarrasEmpilhadas
      colunas={colunasPorDia(acessos, de, ate)}
      altura={140}
      formatarRotulo={rotuloDoDia}
      detalheDoMes={(coluna) =>
        (pessoasPorDia.get(coluna.mes) ?? [])
          .slice()
          .sort((a, b) => b.logins - a.logins)
          .map((pessoa) => ({ rotulo: pessoa.nome, valor: String(pessoa.logins) }))
      }
    />
  );
}

const estiloDoCabecalho: CSSProperties = {
  padding: '8px 8px',
  fontWeight: 600,
  fontSize: 12,
  color: 'var(--cinza-2)',
};

//: TABLE-LAYOUT FIXO + UMA LARGURA POR COLUNA, e não cada uma do tamanho do
//: próprio conteúdo: sem isto o cabeçalho "Interações criadas" — o rótulo
//: mais longo da linha — empurrava a coluna inteira, e o número alinhado à
//: direita sobrava longe da coluna anterior, com um vão vazio no meio. As
//: três colunas numéricas dividem a mesma largura entre si.
const LARGURA_NOME = '24%';
const LARGURA_EMAIL = '28%';
const LARGURA_NUMERO = '11%';
const LARGURA_ULTIMO_ACESSO = '14%';

const estiloDaCelula: CSSProperties = { padding: '8px 8px' };
const estiloDoNumero: CSSProperties = { ...estiloDaCelula, textAlign: 'right' };

export function IndicadoresDeUso() {
  const [periodo, definirPeriodo] = useState<Periodo>('30');
  const { de: periodoDe, ate: periodoAte } = intervaloDe(periodo);
  const [indicadores, definirIndicadores] = useState<IndicadorDeUso[] | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  //: QUEM ESTÁ ABERTO NO DETALHE — nulo é modal fechado. Guarda nome junto
  //: por conveniência: o modal precisa dele no título, e não vale fazer a
  //: pessoa reaparecer na lista só para ler o nome de novo.
  const [emDetalhe, definirEmDetalhe] = useState<{ id: string; nome: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    definirIndicadores(null);
    definirErro(null);
    const { de, ate } = intervaloDe(periodo);
    listarIndicadoresDeUso(de, ate)
      .then((lista) => {
        if (vivo) definirIndicadores(lista);
      })
      .catch((falha: unknown) => {
        if (vivo) definirErro(falha instanceof Error ? falha.message : String(falha));
      });
    return () => {
      vivo = false;
    };
  }, [periodo]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {OPCOES_DE_PERIODO.map((opcao) => (
          <Chip
            key={opcao.id}
            rotulo={opcao.rotulo}
            ativo={periodo === opcao.id}
            aoClicar={() => definirPeriodo(opcao.id)}
          />
        ))}
      </div>

      <div>
        <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>Acessos por dia</h3>
        <GraficoDeAcessosPorDia de={periodoDe} ate={periodoAte} />
      </div>

      {erro ? (
        <FaixaDeErro mensagem={`Não foi possível ler os indicadores: ${erro}`} />
      ) : !indicadores ? (
        <p style={{ fontSize: 14, color: 'var(--cinza-2)' }}>Carregando…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--borda)' }}>
                <th style={{ ...estiloDoCabecalho, width: LARGURA_NOME }}>Nome</th>
                <th style={{ ...estiloDoCabecalho, width: LARGURA_EMAIL }}>E-mail</th>
                <th style={{ ...estiloDoCabecalho, width: LARGURA_NUMERO, textAlign: 'right' }}>Logins</th>
                <th style={{ ...estiloDoCabecalho, width: LARGURA_NUMERO, textAlign: 'right' }}>Uploads</th>
                <th style={{ ...estiloDoCabecalho, width: LARGURA_NUMERO, textAlign: 'right' }}>
                  Interações criadas
                </th>
                <th style={{ ...estiloDoCabecalho, width: LARGURA_ULTIMO_ACESSO }}>Último acesso</th>
              </tr>
            </thead>
            <tbody>
              {indicadores.map((linha) => (
                <tr key={linha.id} style={{ borderBottom: '1px solid var(--borda)' }}>
                  <td style={estiloDaCelula}>
                    <button
                      type="button"
                      onClick={() => definirEmDetalhe({ id: linha.id, nome: linha.nome })}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        font: 'inherit',
                        color: 'var(--azul-mar)',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                      }}
                    >
                      {linha.nome}
                    </button>
                  </td>
                  <td style={{ ...estiloDaCelula, color: 'var(--cinza-2)' }}>{linha.email}</td>
                  <td style={estiloDoNumero}>{linha.logins}</td>
                  <td style={estiloDoNumero}>{linha.uploads}</td>
                  <td style={estiloDoNumero}>{linha.interacoes_criadas}</td>
                  <td
                    style={estiloDaCelula}
                    title={
                      linha.ultimo_acesso_em
                        ? new Date(linha.ultimo_acesso_em).toLocaleString('pt-BR')
                        : undefined
                    }
                  >
                    {linha.ultimo_acesso_em ? quantoTempo(linha.ultimo_acesso_em) : 'nunca'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {emDetalhe && (
        <DetalheDeUsoModal
          pessoa={emDetalhe}
          periodo={{ de: periodoDe, ate: periodoAte }}
          aoFechar={() => definirEmDetalhe(null)}
        />
      )}
    </div>
  );
}

/** O rótulo compacto de um filtro de `Recorte` — só os campos preenchidos,
 *  sem reproduzir a tela de filtros inteira dentro do modal. */
function rotuloDoFiltro(filtros: Record<string, unknown>): string {
  const partes = Object.entries(filtros)
    .filter(([, valor]) => valor !== null && valor !== undefined && valor !== '')
    .filter(([, valor]) => !(Array.isArray(valor) && valor.length === 0))
    .map(([chave, valor]) => `${chave}: ${Array.isArray(valor) ? valor.join(', ') : String(valor)}`);
  return partes.length > 0 ? partes.join(' · ') : 'sem filtro';
}

function DetalheDeUsoModal({
  pessoa,
  periodo,
  aoFechar,
}: {
  pessoa: { id: string; nome: string };
  periodo: { de: string; ate: string };
  aoFechar: () => void;
}) {
  const [detalhe, definirDetalhe] = useState<DetalheDeUso | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    definirDetalhe(null);
    definirErro(null);
    detalheDeUso(pessoa.id, periodo.de, periodo.ate)
      .then((resultado) => {
        if (vivo) definirDetalhe(resultado);
      })
      .catch((falha: unknown) => {
        if (vivo) definirErro(falha instanceof Error ? falha.message : String(falha));
      });
    return () => {
      vivo = false;
    };
  }, [pessoa.id, periodo.de, periodo.ate]);

  const totalDeLogins = detalhe ? detalhe.logins_por_dia.reduce((soma, dia) => soma + dia.logins, 0) : 0;
  const semNada =
    detalhe && detalhe.cargas.length === 0 && detalhe.exportacoes.length === 0 && totalDeLogins === 0;

  return (
    <Modal titulo={`Uso de ${pessoa.nome}`} aoFechar={aoFechar}>
      {erro && <FaixaDeErro mensagem={`Não foi possível ler o detalhe: ${erro}`} />}
      {!erro && !detalhe && <Carregando rotulo="Carregando detalhe…" />}
      {semNada && <Vazio mensagem="Nenhum acesso, carga ou exportação no período." />}

      {detalhe && totalDeLogins > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>
            Acessos por dia ({totalDeLogins})
          </h3>
          {diasNoIntervalo(periodo.de, periodo.ate) > TETO_DE_DIAS_NO_GRAFICO ? (
            <p style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
              Período longo demais para o gráfico diário — veja o total acima.
            </p>
          ) : (
            //: PADDING-TOP, não margem no `h3` acima: o modal corta
            //: (`overflow: hidden`) qualquer coisa que passe da própria borda, e
            //: o gráfico aqui é a primeira coisa do corpo — sem este respiro o
            //: balão, que abre PARA CIMA da barra, nascia cortado contra o
            //: cabeçalho do modal. 64px é mais do que o balão deste gráfico
            //: chega a precisar (ele não lista nomes, só "Logins: N").
            <div style={{ paddingTop: 64 }}>
              <BarrasEmpilhadas
                colunas={colunasPorDia(detalhe.logins_por_dia, periodo.de, periodo.ate)}
                altura={110}
                formatarRotulo={rotuloDoDia}
              />
            </div>
          )}
        </div>
      )}

      {detalhe && detalhe.cargas.length > 0 && (
        <div style={{ marginBottom: detalhe.exportacoes.length > 0 ? 20 : 0 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>
            Cargas de base ({detalhe.cargas.length})
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--borda)' }}>
                <th style={estiloDoCabecalho}>Base</th>
                <th style={estiloDoCabecalho}>Arquivo</th>
                <th style={{ ...estiloDoCabecalho, textAlign: 'right' }}>Linhas</th>
                <th style={estiloDoCabecalho}>Quando</th>
              </tr>
            </thead>
            <tbody>
              {detalhe.cargas.map((carga, indice) => (
                <tr key={`${carga.concluida_em}-${indice}`} style={{ borderBottom: '1px solid var(--borda)' }}>
                  <td style={estiloDaCelula}>{carga.base}</td>
                  <td style={estiloDaCelula}>{carga.arquivo ?? '—'}</td>
                  <td style={estiloDoNumero}>{carga.linhas}</td>
                  <td style={estiloDaCelula}>{new Date(carga.concluida_em).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detalhe && detalhe.exportacoes.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>
            Exportações da Base do CRM ({detalhe.exportacoes.length})
          </h3>
          <p style={{ fontSize: 12, color: 'var(--cinza-2)', margin: '0 0 8px' }}>
            Sem nome de arquivo: a exportação é montada no navegador, não gera arquivo no
            servidor.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--borda)' }}>
                <th style={estiloDoCabecalho}>Filtro</th>
                <th style={{ ...estiloDoCabecalho, textAlign: 'right' }}>Registros</th>
                <th style={estiloDoCabecalho}>Quando</th>
              </tr>
            </thead>
            <tbody>
              {detalhe.exportacoes.map((exportacao, indice) => (
                <tr key={`${exportacao.criado_em}-${indice}`} style={{ borderBottom: '1px solid var(--borda)' }}>
                  <td style={estiloDaCelula}>{rotuloDoFiltro(exportacao.filtros)}</td>
                  <td style={estiloDoNumero}>{exportacao.total_de_registros}</td>
                  <td style={estiloDaCelula}>
                    {new Date(exportacao.criado_em).toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
