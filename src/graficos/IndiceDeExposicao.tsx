/** O Índice de Exposição a Risco: uma barra por mês, empilhada por severidade.
 *
 *  NENHUMA CONTA DO ÍNDICE MORA AQUI. O valor de cada mês e o peso de cada
 *  severidade vêm prontos do servidor; este arquivo desenha. O que ele calcula é
 *  geometria: que fração da altura cada fatia ocupa.
 *
 *  A SÉRIE VEM INTEIRA E A JANELA ESMAECE, em vez de cortar. É o que responde
 *  "este período é alto?" — pergunta que a série cortada não deixa fazer. Quem
 *  escolhe 3M vendo só três barras não sabe se 32 é muito.
 *
 *  A BARRA É EMPILHADA PELO PESO, e não pela contagem: a altura dela é o índice,
 *  que é ponderado. Dividir pela contagem faria as fatias não somarem a altura —
 *  um mês de um crítico e três moderados apareceria 25/75 quando o peso é 50/50.
 *  A DICA, por sua vez, mostra a CONTAGEM, que é o que se diz em voz alta: "dois
 *  incidentes críticos", não "seis pontos".
 *
 *  CRÍTICO EMBAIXO, SEMPRE. A pilha segue a ordem da gravidade (`SEVERIDADES`),
 *  e não a ordem em que o mês trouxe os grupos: dois meses empilhados ao
 *  contrário um do outro fariam a comparação visual entre eles enganar.
 *
 *  A LINHA DO PICO É DO PERÍODO, e fica tracejada por cima de tudo: é a régua
 *  que dá sentido a "32" — sem ela, o número não tem unidade.
 *
 *  SEM MOUSE A DICA MOSTRA O ÚLTIMO MÊS DA JANELA, e não desaparece: uma dica
 *  que só existe sob o cursor não existe para quem navega por teclado, e faz o
 *  bloco abaixo subir e descer a cada passada do mouse.
 */

import { useState } from 'react';

import { SEVERIDADES, corDaSeveridade, rotuloDaSeveridade } from '@/dominio/riscos';
import type { MesDoIndice } from '@/dominio/riscos';
import { ATALHOS_DA_JANELA, atalhoDaJanela } from '@/dominio/janelaDaJornada';
import type { Janela } from '@/dominio/janelaDaJornada';
import { SeletorDeJanela } from '@/graficos/SeletorDeJanela';
import { rotuloDoMes } from '@/dominio/formato';
import { rotuloDoMesComAno } from '@/dominio/calendarioMensal';

/** A altura da área de plotagem. A mesma do protótipo. */
const ALTURA = 280;

/** As marcas do eixo. O índice é 0 a 100 por definição — a escala não se adapta
 *  ao dado, e é isso que deixa comparar dois recortes lado a lado. */
const MARCAS = [100, 75, 50, 25, 0];

export function IndiceDeExposicao({
  serie,
  pico,
  mesDoPico,
  aoEscolherMes,
  janela,
  aoMudarJanela,
}: {
  serie: MesDoIndice[];
  /** O pico DO PERÍODO, para a linha tracejada. */
  pico: number | null;
  mesDoPico: string | null;
  /** Clicar numa barra abre o aprofundamento daquele mês. */
  aoEscolherMes?: (mes: string) => void;
  /** A JANELA DE ANÁLISE MORA AQUI, e não na barra de filtros: é o único
   *  controle cujo efeito é visual nesta mesma seção — as barras de fora
   *  esmaecem. Longe das barras, quem mexe no atalho não vê o que mudou. */
  janela?: Janela;
  aoMudarJanela?: (janela: Janela) => void;
}) {
  const [apontado, definirApontado] = useState<string | null>(null);

  //: O MÊS EM FOCO: o apontado, ou o último da janela. Ver o cabeçalho.
  const naJanela = serie.filter((mes) => mes.na_janela);
  const emFoco =
    serie.find((mes) => mes.mes === apontado) ??
    naJanela[naJanela.length - 1] ??
    serie[serie.length - 1] ??
    null;

  if (serie.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 14, color: 'var(--cinza-3)' }}>
        Nenhum mês da base tem incidente que toque um risco da matriz.
      </p>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        {/* AS MARCAS DO EIXO, fora da área de plotagem para a barra poder ir
            até a borda esquerda. */}
        <div
          aria-hidden="true"
          style={{ position: 'relative', width: 28, height: ALTURA, flex: 'none' }}
        >
          {MARCAS.map((marca) => (
            <span
              key={marca}
              style={{
                position: 'absolute',
                right: 0,
                bottom: `${marca}%`,
                transform: 'translateY(50%)',
                fontSize: 11,
                color: 'var(--cinza-2)',
              }}
            >
              {marca}
            </span>
          ))}
        </div>

        <div
          style={{
            position: 'relative',
            flex: 1,
            minWidth: 0,
            height: ALTURA,
            borderBottom: '1px solid var(--borda-input)',
          }}
        >
          {MARCAS.filter((marca) => marca > 0).map((marca) => (
            <div
              key={marca}
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: `${marca}%`,
                borderTop: '1px solid var(--bg-trilho)',
              }}
            />
          ))}

          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'flex-end',
              gap: 4,
              padding: '0 2px',
            }}
          >
            {serie.map((mes) => (
              <BarraDoMes
                key={mes.mes}
                mes={mes}
                apontada={emFoco?.mes === mes.mes}
                aoApontar={() => definirApontado(mes.mes)}
                aoClicar={aoEscolherMes ? () => aoEscolherMes(mes.mes) : undefined}
              />
            ))}
          </div>

          {pico !== null && pico > 0 ? (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: `${pico}%`,
                borderTop: '2px dashed var(--vermelho-pitanga)',
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 4,
                  top: -24,
                  padding: '1px 6px',
                  background: 'var(--branco)',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--erro-fg)',
                }}
              >
                Pico {pico}
                {mesDoPico ? ` · ${rotuloDoMes(mesDoPico)}` : ''}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* OS NOMES DOS MESES, na mesma grade das barras para o terceiro rótulo
          não apontar para a segunda barra. */}
      <div
        aria-hidden="true"
        style={{ display: 'flex', gap: 4, padding: '6px 2px 0 36px' }}
      >
        {serie.map((mes) => (
          <div
            key={mes.mes}
            style={{
              flex: '1 1 0',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              fontSize: 11,
              color: 'var(--cinza-2)',
              whiteSpace: 'nowrap',
              opacity: mes.na_janela ? 1 : 0.45,
            }}
          >
            <span>{rotuloDoMes(mes.mes)}</span>
            <span style={{ fontWeight: 700, color: 'var(--cinza-3)' }}>
              {mes.mes.slice(2, 4)}
            </span>
          </div>
        ))}
      </div>

      {janela && aoMudarJanela ? (
        <div style={{ marginTop: 6, paddingLeft: 36 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--cinza-2)',
            }}
          >
            Janela de análise
            {rotuloDoAtalho(janela, serie) ? ` · ${rotuloDoAtalho(janela, serie)}` : ''}
          </div>
          {/* OS ATALHOS E A MOLDURA VÊM DO MESMO CONTROLE do Score — ele já
              desenha os cinco botões, os três gestos de arraste e o teclado.
              Escrever os botões aqui, como eu havia feito, dava duas fileiras
              com os mesmos rótulos na mesma seção. */}
          <SeletorDeJanela
            meses={serie.map((mes) => ({ mes: mes.mes, valor: mes.indice }))}
            janela={janela}
            aoMudar={aoMudarJanela}
          />
        </div>
      ) : null}

      {emFoco ? <FichaDoMes mes={emFoco} apontado={apontado !== null} /> : null}
    </div>
  );
}

function BarraDoMes({
  mes,
  apontada,
  aoApontar,
  aoClicar,
}: {
  mes: MesDoIndice;
  apontada: boolean;
  aoApontar: () => void;
  aoClicar?: () => void;
}) {
  const indice = mes.indice ?? 0;
  const pesado = mes.pesado || 1;
  return (
    <button
      type="button"
      onMouseEnter={aoApontar}
      onFocus={aoApontar}
      onClick={aoClicar}
      //: O NOME DIZ O QUE O CLIQUE FAZ quando há para onde clicar: a barra é o
      //: primeiro degrau do aprofundamento, e "set/2026: índice 32" descreve o
      //: mês sem dizer que dali se desce. Achado de revisão.
      aria-label={`${aoClicar ? 'Aprofundar em ' : ''}${rotuloDoMesComAno(mes.mes)}: índice ${indice}, ${mes.incidentes} ${
        mes.incidentes === 1 ? 'incidente' : 'incidentes'
      }${mes.na_janela ? '' : ' (fora da janela)'}`}
      style={{
        flex: '1 1 0',
        minWidth: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: 0,
        border: 0,
        background: apontada ? 'var(--bg-hover)' : 'transparent',
        //: ESMAECIDA FORA DA JANELA — ela continua lá, para o período escolhido
        //: ter contexto. Ver o cabeçalho.
        opacity: mes.na_janela ? 1 : 0.35,
        cursor: aoClicar ? 'pointer' : 'default',
      }}
    >
      {/* DE CIMA PARA BAIXO O MENOS GRAVE PRIMEIRO, para o crítico encostar na
          base: a pilha é `column`, e o primeiro filho fica em cima. */}
      {[...SEVERIDADES].reverse().map((severidade) => {
        const peso = mes.pesado_por_severidade[severidade.codigo] ?? 0;
        if (!peso) return null;
        return (
          <span
            key={severidade.codigo}
            style={{
              display: 'block',
              width: '100%',
              height: `${(indice * peso) / pesado}%`,
              background: severidade.forte,
            }}
          />
        );
      })}
    </button>
  );
}

/** A ficha do mês em foco: o índice, a divisão por severidade e as fontes.
 *
 *  AS FONTES ESTÃO AQUI PORQUE A BASE AINDA ESTÁ INCOMPLETA: medido em
 *  10/10/2026, jan a jul têm índice entre 0 e 9 e agosto e setembro 75 e 100 — e
 *  a razão não é o risco ter explodido, é que a Clipei (25 mil menções) começa em
 *  agosto. É um AVISO, e não uma correção: compensar a fonte que falta
 *  inventaria incidente que ninguém mediu. Quando todo mês tiver todas as
 *  fontes, esta linha passa a dizer sempre a mesma coisa.
 */
function FichaDoMes({ mes, apontado }: { mes: MesDoIndice; apontado: boolean }) {
  return (
    <div
      style={{
        marginTop: 14,
        marginLeft: 36,
        padding: '12px 14px',
        background: 'var(--bg-app)',
        borderRadius: 'var(--r-card-int)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px 20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--cinza-2)',
          }}
        >
          {rotuloDoMesComAno(mes.mes)}
        </span>
        <span style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>
          {mes.indice ?? 0}
        </span>
        <span style={{ fontSize: 12, color: 'var(--cinza-2)' }}>
          índice{apontado ? '' : ' · passe o mouse num mês'}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 12 }}>
        {SEVERIDADES.map((severidade) => {
          const quantos = mes.por_severidade[severidade.codigo] ?? 0;
          if (!quantos) return null;
          return (
            <span
              key={severidade.codigo}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span
                aria-hidden="true"
                style={{ width: 8, height: 8, background: corDaSeveridade(severidade.codigo) }}
              />
              {rotuloDaSeveridade(severidade.codigo)}
              <strong>
                {quantos} {quantos === 1 ? 'incidente' : 'incidentes'}
              </strong>
            </span>
          );
        })}
        {mes.incidentes === 0 ? (
          <span style={{ color: 'var(--cinza-2)' }}>Nenhum incidente neste mês.</span>
        ) : null}
      </div>

      {mes.fontes.length > 0 ? (
        <span style={{ fontSize: 12, color: 'var(--cinza-2)', marginLeft: 'auto' }}>
          Fontes do mês: {mes.fontes.join(', ')}
        </span>
      ) : null}
    </div>
  );
}

/** O rótulo do atalho que a janela corresponde, ou vazio se foi escolhida à mão.
 *
 *  À MÃO NÃO ACENDE NENHUM BOTÃO, em vez de acender o mais parecido: quem
 *  arrastou a moldura escolheu um período que nenhum atalho descreve, e acender
 *  "6M" diria que ela está em seis meses quando não está.
 */
function rotuloDoAtalho(janela: Janela, serie: MesDoIndice[]): string {
  const chave = atalhoDaJanela(janela, serie);
  return ATALHOS_DA_JANELA.find((atalho) => atalho.chave === chave)?.rotulo ?? '';
}
