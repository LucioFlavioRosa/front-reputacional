/** Resumo do nível (E.5.2, E.6.2, E.7.2): kicker, título do nível, link de
 *  volta, métricas e, no rodapé, a "Leitura do nível".
 *
 *  AS MÉTRICAS CHEGAM PRONTAS, como texto: cada nível sabe quais mostra
 *  (Matérias, Peso na lente, Saldo, Negativas, Tier 1, Impacto, vs. julho) e
 *  como formata. O resumo só as dispõe, para não amarrar aqui a regra de
 *  nenhum nível.
 *
 *  O TÍTULO É O `h2` QUE RECEBE O FOCO ao trocar de nível (decisão A5): por
 *  isso `tabIndex={-1}` e o `ref` vindo de quem monta. A cor é a da lente
 *  (decisão A9).
 *
 *  COM `lateral` (o gráfico diário do Nível 4), as métricas descem para
 *  baixo do título e o lado direito fica com o gráfico, como no mockup (p. 5).
 *
 *  É UM `.cartao` COM BOTÃO PNG (decisão A12), como todo cartão do drill.
 */

import type { ReactNode, Ref } from 'react';

import { BaixarPng } from '@/componentes/BaixarPng';
import { Cartao } from '@/componentes/basicos';

import '../consulta.css';
import { escreverEndereco } from '../endereco';
import type { EnderecoDoDrill } from '../endereco';
import { ehCliqueSimples } from './cliqueSimples';

export interface MetricaDoResumo {
  rotulo: string;
  valor: string;
  /** Cor do valor; sem ela, o texto principal. */
  cor?: string;
}

function Metricas({ metricas, comBordas }: { metricas: MetricaDoResumo[]; comBordas: boolean }) {
  return (
    <dl style={{ display: 'flex', flexWrap: 'wrap', gap: comBordas ? '12px 0' : '12px 28px', margin: 0 }}>
      {metricas.map((m) => (
        <div
          key={m.rotulo}
          style={comBordas ? { padding: '2px 22px', borderLeft: '1px solid var(--borda)' } : undefined}
        >
          <dt className="kicker" style={{ fontSize: 11 }}>
            {m.rotulo}
          </dt>
          <dd
            className="tabular"
            style={{
              margin: '4px 0 0',
              fontSize: 22,
              fontWeight: 800,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              color: m.cor ?? 'var(--cinza-4)',
            }}
          >
            {m.valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ResumoDoNivel({
  kicker,
  titulo,
  refDoTitulo,
  idDoTitulo,
  rotuloDoVoltar,
  enderecoDoVoltar,
  aoVoltar,
  metricas,
  lateral,
  leitura,
}: {
  kicker: string;
  titulo: string;
  refDoTitulo?: Ref<HTMLHeadingElement>;
  idDoTitulo?: string;
  /** "Voltar aos pilares", "Voltar aos temas" ou "Voltar aos subtemas". */
  rotuloDoVoltar: string;
  /** O nível de cima: vira o `href` do link, para abrir em nova aba. */
  enderecoDoVoltar: EnderecoDoDrill;
  aoVoltar: () => void;
  metricas: MetricaDoResumo[];
  /** Conteúdo do lado direito no lugar das métricas (gráfico do Nível 4). */
  lateral?: ReactNode;
  leitura: string;
}) {
  const comLateral = lateral !== undefined && lateral !== null;

  return (
    <Cartao estilo={{ padding: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '20px 28px', padding: '20px 24px' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div className="kicker">{kicker}</div>
          <h2
            ref={refDoTitulo}
            id={idDoTitulo}
            tabIndex={-1}
            style={{
              margin: '6px 0 0',
              fontSize: 26,
              fontWeight: 800,
              lineHeight: 1.2,
              color: 'var(--cor-dos-titulos, var(--azul-mar))',
            }}
          >
            {titulo}
          </h2>
          <a
            href={escreverEndereco(enderecoDoVoltar)}
            onClick={(evento) => {
              if (!ehCliqueSimples(evento)) return;
              evento.preventDefault();
              aoVoltar();
            }}
            // A cor vem de `.consulta-link` (hover #111799, E.1).
            className="sem-png sem-impressao consulta-link"
            style={{
              display: 'inline-block',
              marginTop: 6,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            <span aria-hidden="true">‹ </span>
            {rotuloDoVoltar}
          </a>
          {comLateral ? (
            <div style={{ marginTop: 18 }}>
              <Metricas metricas={metricas} comBordas={false} />
            </div>
          ) : null}
        </div>
        {comLateral ? (
          <div style={{ flex: '1 1 560px', minWidth: 0 }}>{lateral}</div>
        ) : (
          <div style={{ flex: '0 1 auto', minWidth: 0 }}>
            <Metricas metricas={metricas} comBordas />
          </div>
        )}
        <div style={{ flex: '0 0 auto' }}>
          <BaixarPng titulo={titulo} />
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          gap: '8px 24px',
          padding: '16px 24px 18px',
          borderTop: '1px solid var(--borda)',
        }}
      >
        <div className="kicker" style={{ flex: '0 0 auto', color: 'var(--azul-mar)' }}>
          Leitura do nível
        </div>
        <p style={{ flex: '1 1 480px', margin: 0, fontSize: 16, lineHeight: 1.55, color: 'var(--cinza-4)' }}>{leitura}</p>
      </div>
    </Cartao>
  );
}
