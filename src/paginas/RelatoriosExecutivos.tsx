/** Relatórios Executivos — o registro das interações em si, em texto
 *  corrido, por semana ou por mês.
 *
 *  SAIU DO PAINEL DE PROPÓSITO: lá vivia apertado (uma caixa retrátil no meio
 *  de gráficos, só mensal) — aqui tem tela própria, com espaço para ler (ou
 *  copiar) o relatório inteiro sem abrir nada. Ver o comentário no topo de
 *  `dominio/relatorioNarrativo.ts` sobre por que o texto é corrido, sem
 *  rótulo de campo.
 *
 *  "EDITAR" ABRE A FICHA DA INTERAÇÃO (o mesmo popout que Painel/Base/
 *  Situação já usam, com o botão "Editar interação" dela) — não um editor
 *  novo: a tela de edição completa já existe, e duplicá-la aqui divergiria
 *  cedo ou tarde.
 */

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { usePainel } from '@/estado/painel';
import { Carregando, FaixaDeErro, Secao, Vazio } from '@/componentes/basicos';
import { numero } from '@/dominio/formato';
import {
  gerarRelatorioNarrativo,
  periodosDisponiveis,
  rotuloDoPeriodo,
} from '@/dominio/relatorioNarrativo';
import type {
  EntradaDoRelatorioNarrativo,
  GranularidadeDoRelatorio,
} from '@/dominio/relatorioNarrativo';

export function RelatoriosExecutivos({
  aoAbrirAgenda,
}: {
  aoAbrirAgenda: (id: string) => void;
}) {
  const { interacoes, catalogo, carregando, erro } = usePainel();
  const [granularidade, definirGranularidade] = useState<GranularidadeDoRelatorio>('mes');
  const [periodoEscolhido, definirPeriodoEscolhido] = useState('');

  const periodos = useMemo(
    () => periodosDisponiveis(interacoes, granularidade),
    [interacoes, granularidade],
  );
  // O período escolhido pode ter saído da lista (trocou de granularidade, ou
  // o recorte mudou e aquela semana não tem mais interação nenhuma) — cai
  // sempre no mais recente disponível, nunca numa tela em branco silenciosa.
  const periodo = periodos.includes(periodoEscolhido) ? periodoEscolhido : (periodos[0] ?? '');

  const relatorio = useMemo(
    () => (catalogo && periodo ? gerarRelatorioNarrativo(interacoes, catalogo, periodo, granularidade) : null),
    [interacoes, catalogo, periodo, granularidade],
  );

  if (carregando) return <Carregando />;
  if (erro) return <FaixaDeErro mensagem={erro} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1
        style={{
          fontSize: 26,
          color: 'var(--azul-mar)',
          margin: 0,
        }}
      >
        Relatórios Executivos
      </h1>

      <Secao
        titulo="Registro do período"
        subtitulo="Pronto para selecionar, copiar e colar em outro lugar."
        nivelDoTitulo={2}
        acao={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <SeletorDeGranularidade
              valor={granularidade}
              aoEscolher={(g) => {
                definirGranularidade(g);
                definirPeriodoEscolhido('');
              }}
            />
            {periodos.length > 1 ? (
              <select
                value={periodo}
                onChange={(evento) => definirPeriodoEscolhido(evento.target.value)}
                aria-label={granularidade === 'semana' ? 'Semana do relatório' : 'Mês do relatório'}
                style={ESTILO_DO_SELETOR}
              >
                {periodos.map((chave) => (
                  <option key={chave} value={chave}>
                    {rotuloDoPeriodo(chave, granularidade)}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        }
      >
        {!periodo || !relatorio ? (
          <Vazio
            mensagem="Nenhuma interação registrada"
            dica={
              periodo
                ? `Nada em ${rotuloDoPeriodo(periodo, granularidade).toLowerCase()} — ajuste os filtros ou escolha outro período.`
                : 'Ajuste os filtros para ver algum período com interações.'
            }
          />
        ) : (
          <>
            <div className="sem-impressao" style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
              <NumeroGrande valor={relatorio.totalReunioes} rotulo="Interações" />
              <NumeroGrande valor={relatorio.totalInstituicoes} rotulo="Instituições" />
              <NumeroGrande valor={relatorio.totalDias} rotulo="Dias com reunião" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
              {relatorio.dias.map((dia) => (
                <div key={dia.data}>
                  <div
                    className="kicker"
                    style={{
                      color: 'var(--branco)',
                      background: 'var(--azul-mar)',
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: 'var(--r-chip)',
                      marginBottom: 10,
                    }}
                  >
                    {dia.dataFormatada}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {dia.entradas.map((entrada) => (
                      <EntradaNarrativa
                        key={entrada.id}
                        entrada={entrada}
                        aoAbrir={() => aoAbrirAgenda(entrada.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Secao>
    </div>
  );
}

const ESTILO_DO_SELETOR: CSSProperties = {
  height: 28,
  padding: '0 10px',
  borderRadius: 'var(--r-chip)',
  border: '1px solid var(--azul-mar)',
  background: 'var(--branco)',
  color: 'var(--cinza-4)',
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
};

function NumeroGrande({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div>
      <div className="tabular" style={{ fontSize: 22, fontWeight: 800, color: 'var(--azul-mar)', lineHeight: 1.1 }}>
        {numero(valor)}
      </div>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: 'var(--cinza-2)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginTop: 2,
        }}
      >
        {rotulo}
      </div>
    </div>
  );
}

/** Semana / Mês — só as duas, ao contrário do `SeletorDeGranularidade` dos
 *  gráficos de série do Painel (que também tem "6 meses"): aqui não é um
 *  agrupamento de vários pontos numa série, é a escolha de UM período para
 *  ler por extenso — "6 meses" de registro corrido não se lê, se rola. */
function SeletorDeGranularidade({
  valor,
  aoEscolher,
}: {
  valor: GranularidadeDoRelatorio;
  aoEscolher: (granularidade: GranularidadeDoRelatorio) => void;
}) {
  const OPCOES: { chave: GranularidadeDoRelatorio; rotulo: string }[] = [
    { chave: 'semana', rotulo: 'Semana' },
    { chave: 'mes', rotulo: 'Mês' },
  ];
  return (
    <div className="sem-impressao" style={{ display: 'flex', gap: 4 }}>
      {OPCOES.map(({ chave, rotulo }) => {
        const ativo = chave === valor;
        return (
          <button
            key={chave}
            type="button"
            onClick={() => aoEscolher(chave)}
            aria-pressed={ativo}
            style={{
              height: 26,
              padding: '0 11px',
              borderRadius: 'var(--r-chip)',
              border: ativo ? '1px solid var(--azul-mar)' : '1px solid var(--borda-input)',
              background: ativo ? 'var(--azul-mar)' : 'var(--branco)',
              color: ativo ? 'var(--branco)' : 'var(--cinza-3)',
              fontSize: 11.5,
              fontWeight: ativo ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            {rotulo}
          </button>
        );
      })}
    </div>
  );
}

/** Uma interação, em texto corrido — ver o comentário no topo de
 *  `dominio/relatorioNarrativo.ts`. O botão "Editar" fica fora do fluxo do
 *  texto (canto do cartão), de propósito: quem seleciona tudo para copiar não
 *  pode levar "Editar" junto para o e-mail. */
function EntradaNarrativa({
  entrada,
  aoAbrir,
}: {
  entrada: EntradaDoRelatorioNarrativo;
  aoAbrir: () => void;
}) {
  const cabecalho = [entrada.participantes, entrada.instituicao].filter(Boolean).join(' - ');

  return (
    <div
      style={{
        position: 'relative',
        padding: '14px 76px 14px 16px',
        border: '1px solid var(--borda)',
        borderRadius: 'var(--r-card-int)',
        background: 'var(--branco)',
      }}
    >
      <button
        type="button"
        onClick={aoAbrir}
        className="sem-impressao"
        style={{
          position: 'absolute',
          top: 10,
          right: 12,
          height: 26,
          padding: '0 10px',
          borderRadius: 'var(--r-chip)',
          border: '1px solid var(--borda-input)',
          background: 'var(--branco)',
          color: 'var(--azul-mar)',
          fontSize: 11.5,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Editar
      </button>

      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--cinza-4)', fontWeight: 700 }}>
        {cabecalho}
        {entrada.clima ? ` (Clima ${entrada.clima})` : ''}
      </p>
      {entrada.temas ? (
        <p style={{ margin: '4px 0 0', fontSize: 13.5, lineHeight: 1.6, color: 'var(--cinza-3)' }}>
          Temas relacionados: {entrada.temas}
        </p>
      ) : null}
      {entrada.relato ? (
        <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.6, color: 'var(--cinza-3)' }}>
          {entrada.relato}
        </p>
      ) : null}
      {entrada.encaminhamentos ? (
        <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.6, color: 'var(--cinza-3)' }}>
          {entrada.encaminhamentos}
        </p>
      ) : null}
      {entrada.observacoes ? (
        <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.6, color: 'var(--cinza-3)' }}>
          *{entrada.observacoes}
        </p>
      ) : null}
    </div>
  );
}
