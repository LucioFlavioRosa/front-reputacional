/** O Relatório de Reuniões — registro mensal, por dia, campo a campo.
 *
 *  MESMA CAIXA RETRÁTIL da "Síntese Executiva pela IA" (borda, botão com
 *  seta que gira 180°) — mas em azul-mar, não turquesa: aquela caixa é um
 *  INSIGHT (texto que um agente escreveria); esta é o REGISTRO em si, sem
 *  interpretação nenhuma por cima. A cor é a mesma diferença de propósito.
 *
 *  OS NÚMEROS GRANDES FICAM SEMPRE À VISTA, aberto ou fechado — é o que dá
 *  para saber "quantas reuniões teve agosto" sem precisar expandir nada.
 *  Expandir só é necessário para ler o relatório inteiro, dia a dia.
 */

import { useMemo, useState } from 'react';
import type { Catalogo } from '@/dominio/derivacoes';
import { mesesDisponiveis, rotuloDoMesComAno } from '@/dominio/calendarioMensal';
import { numero } from '@/dominio/formato';
import { gerarRelatorioMensal } from '@/dominio/relatorioMensal';
import type { EntradaDoRelatorioMensal } from '@/dominio/relatorioMensal';
import type { Interacao } from '@/dominio/tipos';

export function RelatorioDeReunioes({
  interacoes,
  catalogo,
}: {
  interacoes: Interacao[];
  catalogo: Catalogo;
}) {
  const [aberto, definirAberto] = useState(false);
  const [mesEscolhido, definirMesEscolhido] = useState('');

  const meses = useMemo(() => mesesDisponiveis(interacoes), [interacoes]);
  const mes = mesEscolhido || meses[0];

  const relatorio = useMemo(
    () => (mes ? gerarRelatorioMensal(interacoes, catalogo, mes) : null),
    [interacoes, catalogo, mes],
  );

  if (!meses.length) return null;

  return (
    <div
      className="sem-impressao"
      style={{
        border: '1px solid var(--azul-mar)',
        borderRadius: 'var(--r-card-int)',
        background: 'color-mix(in srgb, var(--azul-mar) 3%, var(--branco))',
      }}
    >
      <button
        type="button"
        onClick={() => definirAberto((v) => !v)}
        aria-expanded={aberto}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '13px 16px 0',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--azul-mar)' }}>
          Relatório de Reuniões
        </span>
        <SetaDoRelatorio aberto={aberto} />
      </button>

      {/* OS NÚMEROS E O SELETOR DE MÊS, fora do `{aberto ? ... : null}` de
          propósito — ver o comentário no topo do arquivo. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          padding: '10px 16px 16px',
        }}
      >
        <div style={{ display: 'flex', gap: 22 }}>
          <NumeroGrande valor={relatorio?.totalReunioes ?? 0} rotulo="Reuniões" />
          <NumeroGrande valor={relatorio?.totalInstituicoes ?? 0} rotulo="Instituições" />
          <NumeroGrande valor={relatorio?.totalDias ?? 0} rotulo="Dias com reunião" />
        </div>

        {meses.length > 1 ? (
          <select
            value={mes}
            onChange={(evento) => definirMesEscolhido(evento.target.value)}
            aria-label="Mês do relatório"
            style={{
              height: 28,
              padding: '0 10px',
              borderRadius: 'var(--r-chip)',
              border: '1px solid var(--azul-mar)',
              background: 'var(--branco)',
              color: 'var(--cinza-4)',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {meses.map((chave) => (
              <option key={chave} value={chave}>
                {rotuloDoMesComAno(chave)}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {aberto ? (
        <div
          style={{
            padding: '0 18px 20px',
            borderTop: '1px solid color-mix(in srgb, var(--azul-mar) 20%, var(--branco))',
            paddingTop: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {!relatorio ? (
            <p style={{ fontSize: 13, color: 'var(--cinza-2)', margin: 0 }}>
              Nenhuma reunião registrada em {rotuloDoMesComAno(mes).toLowerCase()}.
            </p>
          ) : (
            relatorio.dias.map((dia) => (
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
                    <EntradaDoDia key={entrada.id} entrada={entrada} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

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

const CAMPOS: { campo: keyof EntradaDoRelatorioMensal; rotulo: string }[] = [
  { campo: 'instituicao', rotulo: 'Instituição participante' },
  { campo: 'stakeholder', rotulo: 'Stakeholders participantes' },
  { campo: 'temas', rotulo: 'Temas abordados' },
  { campo: 'relato', rotulo: 'Relatos' },
  { campo: 'encaminhamentos', rotulo: 'Repercussão e encaminhamentos' },
  { campo: 'pendencias', rotulo: 'Pendências' },
  { campo: 'observacoes', rotulo: 'Observações' },
  { campo: 'clima', rotulo: 'Clima percebido' },
];

function EntradaDoDia({ entrada }: { entrada: EntradaDoRelatorioMensal }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        border: '1px solid var(--borda)',
        borderRadius: 'var(--r-card-int)',
        background: 'var(--branco)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {CAMPOS.map(({ campo, rotulo }) => (
          <Campo key={campo} rotulo={rotulo} valor={entrada[campo]} />
        ))}
      </div>
    </div>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.5 }}>
      <span style={{ fontWeight: 700, color: 'var(--cinza-4)' }}>{rotulo}: </span>
      <span style={{ color: 'var(--cinza-3)' }}>{valor?.trim() || '—'}</span>
    </div>
  );
}

function SetaDoRelatorio({ aberto }: { aberto: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: 'color-mix(in srgb, var(--azul-mar) 12%, var(--branco))',
        flexShrink: 0,
        transform: aberto ? 'rotate(180deg)' : 'none',
        transition: 'transform .18s',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M3.2 6 8 10.4 12.8 6"
          stroke="var(--azul-mar)"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
