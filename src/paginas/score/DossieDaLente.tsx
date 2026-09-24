/** O dossiê de uma lente — a aba Lentes do Score Executivo.
 *
 *  AS CINCO LENTES TÊM A MESMA ESTRUTURA, e é isso que faz a tela ser um
 *  dossiê e não cinco relatórios: destaque com a nota e a manchete, evolução
 *  com os fatos do período, dois painéis, o que aquilo revela e o que se
 *  decidiu fazer. Quem aprende a ler a Imprensa lê as outras quatro.
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

import { obterDossieDaLente } from '@/api/cliente';
import { Abas } from '@/componentes/Abas';
import {
  Cartao,
  Carregando,
  Chip,
  FaixaDeAtencao,
  FaixaDeErro,
  Kpi,
  Secao,
} from '@/componentes/basicos';
import { CabecalhoDoBloco } from '@/componentes/Procedencia';
import { COR_DO_EFEITO, ROTULO_DO_EFEITO, ROTULO_DO_STATUS, mesCurto } from '@/dominio/dossie';
import type { Bloco, Dossie } from '@/dominio/dossie';
import { temExemplo } from '@/dominio/dossie';
import { corDaFaixa } from '@/dominio/score';
import { numero } from '@/dominio/formato';
import { BarrasEmpilhadas } from '@/graficos/BarrasEmpilhadas';
import {
  BarrasCemPorCento,
  BarrasPareadas,
  EscalaDeCinco,
  LinhaDoTempo,
  MatrizDePrioridade,
  TabelaDeLeitura,
} from '@/graficos/PecasDoDossie';
import type { ColunaDaTabela } from '@/graficos/PecasDoDossie';
import { Ranking } from '@/graficos/Ranking';

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
}: {
  mes: string;
  lente: string;
  aoTrocarLente: (codigo: string) => void;
}) {
  const [dossie, definirDossie] = useState<Dossie | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    definirDossie(null);
    definirErro(null);
    obterDossieDaLente(lente, mes)
      .then((carregado) => ativo && definirDossie(carregado))
      .catch((falha) => {
        if (ativo) definirErro(falha instanceof Error ? falha.message : 'Não foi possível ler.');
      });
    return () => {
      ativo = false;
    };
  }, [lente, mes]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Abas
        abas={LENTES}
        ativa={lente}
        aoTrocar={aoTrocarLente}
        rotulo="Lente do Score"
        prefixo="lente"
      />

      {erro ? <FaixaDeErro mensagem={erro} /> : null}
      {!dossie && !erro ? <Carregando /> : null}
      {dossie ? <Conteudo dossie={dossie} /> : null}
    </div>
  );
}

function Conteudo({ dossie }: { dossie: Dossie }) {
  return (
    <>
      <Destaque dossie={dossie} />
      <Evolucao dossie={dossie} />

      <div className="grade grade--2" style={{ gap: 16, alignItems: 'start' }}>
        {dossie.paineis.map((painel) => (
          <Cartao key={painel.titulo}>
            <CabecalhoDoBloco
              titulo={painel.titulo}
              conclusao={painel.conclusao}
              ficha={painel.ficha}
            />
            <Painel bloco={painel} />
          </Cartao>
        ))}
      </div>

      {dossie.curadoria.revela.length ? (
        <Secao titulo="O que isto revela">
          <div className="grade grade--2" style={{ gap: 16 }}>
            {dossie.curadoria.revela.map((item, indice) => (
              <Cartao key={item.titulo}>
                <span
                  className="tabular"
                  style={{ fontSize: 12, fontWeight: 700, color: 'var(--cinza-2)' }}
                >
                  {String(indice + 1).padStart(2, '0')}
                </span>
                <div style={{ fontSize: 15, fontWeight: 700, margin: '4px 0 6px' }}>
                  {item.titulo}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--cinza-2)', lineHeight: 1.6 }}>
                  {item.texto}
                </p>
              </Cartao>
            ))}
          </div>
        </Secao>
      ) : null}

      <Encaminhamentos dossie={dossie} />
    </>
  );
}

/* -- 1. o destaque ------------------------------------------------------------- */

function Destaque({ dossie }: { dossie: Dossie }) {
  const delta =
    dossie.delta === null ? '—' : dossie.delta > 0 ? `+${dossie.delta}` : `${dossie.delta}`;

  return (
    <Secao
      titulo={`${dossie.nome} · ${dossie.stakeholder}`}
      subtitulo={dossie.fontes.length ? `Fontes no cálculo: ${dossie.fontes.join(' · ')}` : undefined}
    >
      {temExemplo(dossie) ? (
        // ANTES DOS NÚMEROS, e não depois: quem vê o gráfico primeiro já tirou
        // a conclusão quando chega no rodapé.
        <FaixaDeAtencao
          mensagem={
            <>
              Esta lente mostra <strong>conteúdo de ilustração</strong> em pelo menos um bloco —
              transcrito do relatório do cliente, não medido por esta ferramenta. O{' '}
              <strong>?</strong> de cada gráfico diz qual é qual.
            </>
          }
        />
      ) : null}

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
                {mesCurto(dossie.mes)} · vs. mês anterior{' '}
                <strong className="tabular">{delta}</strong>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <Chip rotulo={`peso ${dossie.peso}`} />
                {dossie.estimado ? <Chip rotulo="estimado" /> : null}
                {dossie.curadoria.automatica ? <Chip rotulo="texto automático" /> : null}
              </div>
            </div>
          </div>

          {dossie.ausencia ? (
            <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--atencao-fg)' }}>
              {dossie.ausencia}
            </p>
          ) : null}

          {dossie.curadoria.manchete ? (
            <p style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.55 }}>
              {dossie.curadoria.manchete}
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
  );
}

/* -- 2. a evolução, com os fatos do período ------------------------------------ */

function Evolucao({ dossie }: { dossie: Dossie }) {
  const { evolucao } = dossie;

  return (
    <Secao titulo="Evolução">
      <Cartao>
        <CabecalhoDoBloco
          titulo={evolucao.titulo}
          conclusao={evolucao.conclusao}
          ficha={evolucao.ficha}
        />
        <Painel bloco={evolucao} fatos={dossie.fatos} />

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

        {dossie.curadoria.leitura.length ? (
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--borda)' }}>
            <p className="kicker" style={{ marginBottom: 8 }}>
              Leitura
              {dossie.curadoria.automatica ? (
                <Chip rotulo="gerada dos números" estilo={{ marginLeft: 8 }} />
              ) : null}
            </p>
            {dossie.curadoria.leitura.map((paragrafo) => (
              <p key={paragrafo} style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.7 }}>
                {paragrafo}
              </p>
            ))}
          </div>
        ) : null}
      </Cartao>
    </Secao>
  );
}

/* -- o roteador de tipos ------------------------------------------------------- */

function Painel({ bloco, fatos = [] }: { bloco: Bloco; fatos?: Dossie['fatos'] }) {
  const dados = bloco.dados as Record<string, never>[];

  if (bloco.tipo === 'barras_empilhadas') {
    const porMes = new Map(fatos.map((fato) => [fato.mes, fato]));
    return (
      <BarrasEmpilhadas
        colunas={dados.map((linha) => {
          const semClassificacao = Number(linha.sem_classificacao ?? 0);
          const classificadas =
            Number(linha.positivo ?? 0) + Number(linha.neutro ?? 0) + Number(linha.negativo ?? 0);
          const [pos, neu, neg] = bloco.legenda.length
            ? bloco.legenda
            : ['Positivo', 'Neutro', 'Negativo'];
          return {
            mes: String(linha.mes),
            total: classificadas + semClassificacao,
            semBase: Boolean(linha.sem_base),
            segmentos: [
              { chave: 'pos', rotulo: pos, total: Number(linha.positivo ?? 0), cor: 'var(--ok-fg)' },
              { chave: 'neu', rotulo: neu, total: Number(linha.neutro ?? 0), cor: 'var(--cinza-1)' },
              { chave: 'neg', rotulo: neg, total: Number(linha.negativo ?? 0), cor: 'var(--erro-fg)' },
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
          mes: String(linha.mes),
          recebidas: Number(linha.recebidas ?? 0),
          respondidas: linha.respondidas === null || linha.respondidas === undefined
            ? null
            : Number(linha.respondidas),
          sem_base: Boolean(linha.sem_base),
        }))}
      />
    );
  }

  if (bloco.tipo === 'linha_do_tempo') {
    return (
      <LinhaDoTempo
        meses={dados.map((linha) => ({
          mes: String(linha.mes),
          eventos: (linha.eventos ?? []) as { texto: string; efeito: string }[],
        }))}
      />
    );
  }

  if (bloco.tipo === 'barras_100') {
    return (
      <BarrasCemPorCento
        itens={dados.map((linha) => ({
          rotulo: String(linha.rotulo),
          positivo: Number(linha.positivo ?? 0),
          neutro: Number(linha.neutro ?? 0),
          negativo: Number(linha.negativo ?? 0),
          sem_base: Boolean(linha.sem_base),
        }))}
        legenda={bloco.legenda.length ? bloco.legenda : undefined}
      />
    );
  }

  if (bloco.tipo === 'barras_horizontais') {
    return (
      <Ranking
        itens={dados.map((linha) => ({
          chave: String(linha.rotulo),
          rotulo: String(linha.rotulo),
          total: Number(linha.valor ?? 0),
          cor: 'var(--azul-mar)',
        }))}
        vazio="Nada registrado no período."
        detalheAoPassarMouse={(chave) => {
          const linha = dados.find((item) => String(item.rotulo) === chave);
          const detalhe = linha?.detalhe as string | undefined;
          return detalhe ? [{ rotulo: 'Pico', valor: detalhe }] : [];
        }}
      />
    );
  }

  if (bloco.tipo === 'escala_1a5') {
    return (
      <EscalaDeCinco
        itens={dados.map((linha) => ({
          rotulo: String(linha.rotulo),
          nota: Number(linha.nota ?? 0),
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
          nome: String(linha.nome),
          veiculo: (linha.veiculo as string | null) ?? null,
          relevancia: Number(linha.relevancia ?? 0),
          exposicao: Number(linha.exposicao ?? 0),
          proximidade: Number(linha.proximidade ?? 0),
          pontos: Number(linha.pontos ?? 0),
          prioridade: Number(linha.prioridade ?? 4),
          cadencia: String(linha.cadencia ?? ''),
        }))}
      />
    );
  }

  if (bloco.tipo === 'tabela') {
    return <TabelaDeLeitura colunas={colunasDaTabela(bloco)} linhas={dados} />;
  }

  // Um tipo que a tela não conhece é erro de contrato, e some sem avisar se
  // for tratado com `null`.
  return (
    <p style={{ fontSize: 13, color: 'var(--atencao-fg)', margin: 0 }}>
      Esta versão da tela não sabe desenhar &ldquo;{bloco.tipo}&rdquo;.
    </p>
  );
}

/** As colunas de cada tabela. O `tipo` é genérico; o que cada tabela mostra é
 *  decisão de leitura, e mora aqui. */
function colunasDaTabela(bloco: Bloco): ColunaDaTabela[] {
  if (bloco.titulo.toLowerCase().includes('rating')) {
    return [
      { chave: 'agencia', titulo: 'Agência' },
      { chave: 'data', titulo: 'Quando', formatar: (valor) => mesCurto(String(valor)) },
      { chave: 'de', titulo: 'De' },
      {
        chave: 'para',
        titulo: 'Para',
        // Rebaixamento em vermelho: o efeito já vem classificado do servidor,
        // e repetir a regra aqui criaria uma segunda definição de "piorou".
        destaque: (linha) => (linha.efeito === 'pressiona' ? 'alerta' : null),
      },
      {
        chave: 'perspectiva',
        titulo: 'Perspectiva',
        destaque: (linha) => (linha.perspectiva === 'negativa' ? 'alerta' : null),
      },
    ];
  }

  // Teor das mensagens: mês × categoria, com a reclamação destacada quando
  // passa de metade do que chegou.
  const categorias = new Set<string>();
  for (const linha of bloco.dados) {
    for (const chave of Object.keys(linha)) {
      if (!['mes', 'total', 'acionaveis'].includes(chave)) categorias.add(chave);
    }
  }
  const principais = ['Reclamação', 'Dúvida', 'Elogio', 'Informação'].filter((c) =>
    categorias.has(c),
  );

  return [
    { chave: 'mes', titulo: 'Mês', formatar: (valor) => mesCurto(String(valor)) },
    ...principais.map((categoria) => ({
      chave: categoria,
      titulo: categoria,
      alinhamento: 'direita' as const,
      formatar: (valor: unknown, linha: Record<string, unknown>) => {
        const total = Number(linha.total ?? 0);
        const numeroDaCelula = Number(valor ?? 0);
        if (!total) return String(numeroDaCelula);
        return `${numero(numeroDaCelula)} · ${Math.round((numeroDaCelula / total) * 100)}%`;
      },
      destaque: (linha: Record<string, unknown>) => {
        if (categoria !== 'Reclamação') return null;
        const total = Number(linha.total ?? 0);
        return total && Number(linha[categoria] ?? 0) / total >= 0.5 ? ('alerta' as const) : null;
      },
    })),
    {
      chave: 'sem_classificacao',
      titulo: 'Sem motivo',
      alinhamento: 'direita' as const,
      formatar: (valor: unknown) => (Number(valor ?? 0) ? numero(Number(valor)) : '—'),
    },
    {
      chave: 'acionaveis',
      titulo: 'Acionáveis',
      alinhamento: 'direita' as const,
      formatar: (valor, linha) => {
        const total = Number(linha.total ?? 0);
        return total ? `${numero(Number(valor ?? 0))} de ${numero(total)}` : '—';
      },
    },
  ];
}

/* -- 5. os encaminhamentos ------------------------------------------------------ */

function Encaminhamentos({ dossie }: { dossie: Dossie }) {
  if (!dossie.encaminhamentos.length) return null;

  return (
    <Secao
      titulo="Encaminhamentos"
      subtitulo="O que está aberto continua aqui, venha do mês que vier — some por conclusão, nunca por passagem do tempo."
    >
      <Cartao>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {dossie.encaminhamentos.map((item) => (
            <li
              key={item.id}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'baseline',
                padding: '10px 0',
                borderTop: '1px solid var(--borda)',
                opacity: item.status === 'concluido' ? 0.55 : 1,
              }}
            >
              <span style={{ fontSize: 13, flex: 1 }}>{item.acao}</span>
              {item.responsavel ? (
                <span style={{ fontSize: 11.5, color: 'var(--cinza-2)', whiteSpace: 'nowrap' }}>
                  {item.responsavel}
                </span>
              ) : null}
              {item.prazo ? <Chip rotulo={item.prazo} /> : null}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: item.status === 'concluido' ? 'var(--ok-fg)' : 'var(--cinza-2)',
                  whiteSpace: 'nowrap',
                  minWidth: 88,
                  textAlign: 'right',
                }}
              >
                {ROTULO_DO_STATUS[item.status] ?? item.status}
              </span>
            </li>
          ))}
        </ul>
      </Cartao>
    </Secao>
  );
}
