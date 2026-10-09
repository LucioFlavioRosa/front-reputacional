/** O mês do Score: uma pílula com ‹ mês › e, ao clicar no nome, um calendário
 *  de meses por ano.
 *
 *  POR QUE NÃO O CAMPO QUE COMPLETA. Para mês, digitar "2026-06" é o gesto
 *  errado: o que se quer é "o anterior", "o seguinte" ou "aquele de março". As
 *  setas resolvem os dois primeiros com um clique, e o calendário o terceiro —
 *  com os meses sem dado apagados, em vez de uma lista que só tem os que
 *  existem e não mostra onde estão os buracos.
 *
 *  O MÊS SUGERIDO (o de mais lentes medidas) GANHA UM PONTO no calendário: é
 *  onde a tela abre, e quem navegou para longe precisa achar o caminho de volta.
 */

import { useEffect, useId, useRef, useState } from 'react';

import { mesComAno } from '@/dominio/janelaDaJornada';

const NOMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function SeletorDeMes({
  meses,
  valor,
  sugerido = null,
  aoEscolher,
}: {
  /** Os meses com dado, em ordem crescente ("2026-06"). */
  meses: string[];
  valor: string;
  sugerido?: string | null;
  aoEscolher: (mes: string) => void;
}) {
  const id = useId();
  const [aberto, definirAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const indice = meses.indexOf(valor);
  const anterior = indice > 0 ? meses[indice - 1] : null;
  const seguinte = indice >= 0 && indice < meses.length - 1 ? meses[indice + 1] : null;
  const anos = [...new Set(meses.map((m) => m.slice(0, 4)))].sort().reverse();
  const disponiveis = new Set(meses);

  useEffect(() => {
    if (!aberto) return;
    const fora = (evento: MouseEvent) => {
      if (!caixa.current?.contains(evento.target as Node)) definirAberto(false);
    };
    const esc = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') definirAberto(false);
    };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  const escolher = (mes: string) => {
    aoEscolher(mes);
    definirAberto(false);
  };

  return (
    <div ref={caixa} style={{ position: 'relative', display: 'inline-flex' }}>
      <div
        role="group"
        aria-label="Mês do índice"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          height: 38,
          borderRadius: 999,
          border: '1px solid var(--borda)',
          background: 'var(--branco)',
          boxShadow: '0 1px 2px rgba(17, 23, 153, 0.06)',
          overflow: 'hidden',
        }}
      >
        <BotaoDeSeta
          rotulo={anterior ? `Mês anterior: ${mesComAno(anterior)}` : 'Não há mês anterior'}
          desabilitado={!anterior}
          aoClicar={() => anterior && aoEscolher(anterior)}
          direcao="esquerda"
        />
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={aberto}
          aria-controls={`${id}-calendario`}
          onClick={() => definirAberto((v) => !v)}
          style={{
            height: '100%',
            padding: '0 14px',
            border: 'none',
            borderLeft: '1px solid var(--borda)',
            borderRight: '1px solid var(--borda)',
            background: aberto ? 'var(--bg-trilho)' : 'transparent',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            minWidth: 168,
            justifyContent: 'center',
          }}
        >
          <IconeDeCalendario />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--cinza-4)', textTransform: 'capitalize' }}>
            {mesComAno(valor)}
          </span>
        </button>
        <BotaoDeSeta
          rotulo={seguinte ? `Mês seguinte: ${mesComAno(seguinte)}` : 'Não há mês seguinte'}
          desabilitado={!seguinte}
          aoClicar={() => seguinte && aoEscolher(seguinte)}
          direcao="direita"
        />
      </div>

      {aberto ? (
        <div
          id={`${id}-calendario`}
          role="dialog"
          aria-label="Escolher o mês"
          style={{
            position: 'absolute',
            zIndex: 40,
            top: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 288,
            padding: 12,
            background: 'var(--branco)',
            border: '1px solid var(--borda)',
            borderRadius: 14,
            boxShadow: 'var(--sh-tooltip)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            maxHeight: 360,
            overflowY: 'auto',
          }}
        >
          {anos.map((ano) => (
            <div key={ano}>
              <div className="kicker" style={{ marginBottom: 6, color: 'var(--cinza-2)' }}>
                {ano}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                {NOMES.map((nome, i) => {
                  const chave = `${ano}-${String(i + 1).padStart(2, '0')}`;
                  const existe = disponiveis.has(chave);
                  const escolhido = chave === valor;
                  return (
                    <button
                      key={chave}
                      type="button"
                      disabled={!existe}
                      aria-pressed={escolhido}
                      aria-label={existe ? mesComAno(chave) : `${mesComAno(chave)}, sem dado`}
                      onClick={() => escolher(chave)}
                      style={{
                        position: 'relative',
                        height: 32,
                        borderRadius: 8,
                        border: 'none',
                        background: escolhido ? 'var(--azul-mar)' : 'transparent',
                        color: escolhido ? 'var(--branco)' : existe ? 'var(--cinza-4)' : 'var(--texto-placeholder)',
                        fontSize: 12.5,
                        fontWeight: escolhido ? 700 : 500,
                        cursor: existe ? 'pointer' : 'default',
                      }}
                    >
                      {nome}
                      {chave === sugerido && !escolhido ? (
                        <span
                          aria-hidden
                          title="Mês com mais lentes medidas"
                          style={{
                            position: 'absolute',
                            top: 5,
                            right: 7,
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: 'var(--turquesa-rio)',
                          }}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {sugerido && sugerido !== valor ? (
            <button
              type="button"
              onClick={() => escolher(sugerido)}
              style={{
                alignSelf: 'flex-start',
                border: 'none',
                background: 'transparent',
                color: 'var(--azul-mar)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Voltar ao mês mais completo ({mesComAno(sugerido)})
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function BotaoDeSeta({
  rotulo,
  desabilitado,
  aoClicar,
  direcao,
}: {
  rotulo: string;
  desabilitado: boolean;
  aoClicar: () => void;
  direcao: 'esquerda' | 'direita';
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      disabled={desabilitado}
      onClick={aoClicar}
      style={{
        width: 38,
        height: '100%',
        border: 'none',
        background: 'transparent',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: desabilitado ? 'default' : 'pointer',
        opacity: desabilitado ? 0.3 : 1,
      }}
    >
      <svg aria-hidden width="8" height="12" viewBox="0 0 8 12">
        <path
          d={direcao === 'esquerda' ? 'M6 1.5 1.5 6 6 10.5' : 'M2 1.5 6.5 6 2 10.5'}
          fill="none"
          stroke="var(--cinza-3)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function IconeDeCalendario() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="11" rx="2.5" stroke="var(--azul-mar)" strokeWidth="1.6" />
      <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="var(--azul-mar)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
