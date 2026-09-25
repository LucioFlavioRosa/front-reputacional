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
import { BotaoDeProcedencia, CabecalhoDoBloco } from '@/componentes/Procedencia';
import {
  COR_DO_EFEITO,
  ROTULO_DO_EFEITO,
  colunasDaTabela,
  comoNumero,
  comoTexto,
  corDoTom,
  mesCurto,
  quantosSinaisReais,
} from '@/dominio/dossie';
import type { Bloco, Dossie, SinalDoDossie } from '@/dominio/dossie';
import { avisoDeExemplo } from '@/dominio/dossie';
import { corDaFaixa } from '@/dominio/score';
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
        {dossie.paineis.map((painel, posicao) => (
          // A CHAVE INCLUI A POSIÇÃO: dois painéis com o mesmo título são
          // improváveis, mas `key` duplicada faz o React reaproveitar o estado
          // do componente errado — e o erro aparece como gráfico que não
          // atualiza, não como aviso.
          <Cartao key={`${posicao}-${painel.titulo}`}>
            <CabecalhoDoBloco
              titulo={painel.titulo}
              conclusao={painel.conclusao}
              ficha={painel.ficha}
            />
            <Painel bloco={painel} />
            <NotaDeFonte ficha={painel.ficha} />
          </Cartao>
        ))}
      </div>

      <SinaisDoPeriodo dossie={dossie} />
    </>
  );
}

/** O que desta lente é ilustração, pelo nome.
 *
 *  Dizer só que "há" ilustração manda a pessoa abrir um "?" atrás do outro —
 *  e, quando não há gráfico ilustrativo nenhum, a faz desconfiar de números
 *  que estão certos. */
function AvisoDeIlustracao({ dossie }: { dossie: Dossie }) {
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

/** A fonte do bloco, abaixo do gráfico.
 *
 *  VISÍVEL, e não só dentro do "?": a §1 pede nota de fonte em cada painel, e
 *  uma fonte que só aparece a um clique de distância deixa o gráfico solto —
 *  quem bate o olho não sabe de onde saiu, e quem não clica nunca descobre. */
function NotaDeFonte({ ficha }: { ficha: Dossie['evolucao']['ficha'] }) {
  return (
    <p style={{ margin: '12px 0 0', fontSize: 11, color: 'var(--cinza-2)', lineHeight: 1.5 }}>
      {ficha.fonte}
      {ficha.exemplo ? ' · conteúdo de ilustração' : ''}
    </p>
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
      acao={
        <BotaoDeProcedencia
          ficha={dossie.ficha_do_destaque}
          titulo={`Nota de ${dossie.nome}`}
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
                {mesCurto(dossie.mes)} · vs. mês anterior{' '}
                <strong className="tabular">{delta}</strong>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <Chip rotulo={`peso ${dossie.peso}`} />
                {dossie.estimado ? <Chip rotulo="estimado" /> : null}
              </div>
            </div>
          </div>

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
  );
}

/* -- o roteador de tipos ------------------------------------------------------- */

function Painel({ bloco, fatos = [] }: { bloco: Bloco; fatos?: Dossie['fatos'] }) {
  // `unknown`, e não `never`. O payload de cada tipo de gráfico tem um formato
  // diferente, e dizer ao TypeScript que campo nenhum existe (`never`) o faz
  // parar de conferir qualquer coisa — um `any` com outro nome. A conversão
  // acontece na fronteira, uma vez, com `comoNumero`/`comoTexto` à vista.
  const dados = bloco.dados;

  if (bloco.tipo === 'barras_empilhadas') {
    const porMes = new Map(fatos.map((fato) => [fato.mes, fato]));
    return (
      <BarrasEmpilhadas
        colunas={dados.map((linha) => {
          const semClassificacao = comoNumero(linha.sem_classificacao ?? 0);
          const classificadas =
            comoNumero(linha.positivo ?? 0) + comoNumero(linha.neutro ?? 0) + comoNumero(linha.negativo ?? 0);
          const [pos, neu, neg] = bloco.legenda.length
            ? bloco.legenda
            : ['Positivo', 'Neutro', 'Negativo'];
          return {
            mes: comoTexto(linha.mes),
            total: classificadas + semClassificacao,
            semBase: Boolean(linha.sem_base),
            segmentos: [
              { chave: 'pos', rotulo: pos, total: comoNumero(linha.positivo ?? 0), cor: 'var(--ok-fg)' },
              { chave: 'neu', rotulo: neu, total: comoNumero(linha.neutro ?? 0), cor: 'var(--cinza-1)' },
              { chave: 'neg', rotulo: neg, total: comoNumero(linha.negativo ?? 0), cor: 'var(--erro-fg)' },
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
          cor: 'var(--azul-mar)',
        }))}
        vazio="Nada registrado no período."
        detalheAoPassarMouse={(chave) => {
          const linha = dados.find((item) => comoTexto(item.rotulo) === chave);
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
          <p style={{ margin: 0, fontSize: 13, color: 'var(--cinza-2)' }}>
            Sem variação relevante no período pelas regras atuais.
          </p>
        )}
      </Cartao>
    </Secao>
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
        padding: '10px 0',
        borderTop: primeira ? undefined : '1px solid var(--borda)',
      }}
    >
      <Chip rotulo={sinal.tipo} fundo={cor.fundo} texto={cor.texto} />
      <span style={{ fontSize: 11.5, color: 'var(--cinza-2)', whiteSpace: 'nowrap' }}>
        {sinal.onde}
      </span>
      <span style={{ fontSize: 13.5, flex: 1, minWidth: 220, lineHeight: 1.55 }}>
        {sinal.frase}
      </span>
      <span
        className="tabular"
        style={{
          fontSize: 14,
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
