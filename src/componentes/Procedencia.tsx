/** O "?" que abre a procedência de um bloco.
 *
 *  POR QUE ISTO EXISTE. Metade do que o dossiê de uma lente mostra não sai das
 *  planilhas: a matriz de jornalistas foi montada à mão pela agência, a
 *  trajetória de rating e o estudo de percepção vieram de um relatório
 *  transcrito, e quantas mensagens foram respondidas ninguém mede — o
 *  fornecedor não manda a coluna.
 *
 *  Apresentar tudo com a mesma cara é o jeito mais barato de perder a
 *  confiança de quem lê: basta a pessoa descobrir sozinha, uma vez, que um
 *  número que ela citou numa reunião era ilustração. O "?" põe essa informação
 *  a um clique do gráfico — e o selo de exemplo, sem clique nenhum.
 *
 *  A FICHA VEM DO SERVIDOR, junto do dado. Não é texto de tela: se a fonte de
 *  um bloco mudar, a explicação muda com ela, porque as duas viajam no mesmo
 *  payload.
 */

import { useState } from 'react';

import { Chip, Modal } from '@/componentes/basicos';
import { ORIGEM } from '@/dominio/dossie';
import type { Ficha } from '@/dominio/dossie';

export function BotaoDeProcedencia({ ficha, titulo }: { ficha: Ficha; titulo: string }) {
  const [aberto, definirAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => definirAberto(true)}
        aria-label={`De onde vem: ${titulo}`}
        title="De onde vem este dado"
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: '1px solid var(--borda)',
          background: 'var(--branco)',
          color: 'var(--cinza-2)',
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 1,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        ?
      </button>

      {aberto ? (
        <Modal
          titulo={titulo}
          subtitulo="De onde vem este dado"
          aoFechar={() => definirAberto(false)}
          largura={640}
        >
          <Conteudo ficha={ficha} />
        </Modal>
      ) : null}
    </>
  );
}

function Conteudo({ ficha }: { ficha: Ficha }) {
  const origem = ORIGEM[ficha.origem];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontSize: 13 }}>
      <section>
        <p className="kicker" style={{ marginBottom: 6 }}>
          Procedência
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <strong>{origem?.rotulo ?? ficha.origem}</strong>
          {ficha.exemplo ? <Chip rotulo="conteúdo de exemplo" /> : null}
        </div>
        <p style={{ margin: 0, color: 'var(--cinza-2)', lineHeight: 1.6 }}>
          {origem?.texto}
        </p>
        <p style={{ margin: '6px 0 0', lineHeight: 1.6 }}>{ficha.fonte}</p>
      </section>

      {ficha.exemplo ? (
        // O SELO NÃO BASTA. Quem abriu o "?" quer saber o que fazer com a
        // informação, e "é exemplo" sem o porquê deixa a pessoa sem saber se
        // pode usar o número ou não.
        <section
          style={{
            padding: '12px 14px',
            borderRadius: 8,
            background: 'var(--atencao-bg)',
            color: 'var(--atencao-fg)',
            lineHeight: 1.6,
          }}
        >
          <strong>Este bloco mostra conteúdo de ilustração.</strong> Os números vieram do
          relatório do cliente, transcritos — não foram medidos por esta ferramenta. Servem
          para avaliar a tela, e não para citar como medição. Somem sozinhos quando houver
          cadastro ou base de verdade.
        </section>
      ) : null}

      {ficha.lacunas.length ? (
        <section>
          <p className="kicker" style={{ marginBottom: 6 }}>
            O que falta hoje
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            {ficha.lacunas.map((lacuna) => (
              <li key={lacuna}>{lacuna}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {ficha.colunas.length ? (
        <section>
          <p className="kicker" style={{ marginBottom: 6 }}>
            Colunas que alimentam este bloco
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ficha.colunas.map((coluna) => (
              <Chip key={coluna} rotulo={coluna} />
            ))}
          </div>
        </section>
      ) : null}

      {ficha.conceitos.length ? (
        <section>
          <p className="kicker" style={{ marginBottom: 6 }}>
            Conceitos
          </p>
          <dl style={{ margin: 0 }}>
            {ficha.conceitos.map((conceito) => (
              <div key={conceito.termo} style={{ marginBottom: 10 }}>
                <dt style={{ fontWeight: 700 }}>{conceito.termo}</dt>
                <dd style={{ margin: '2px 0 0', color: 'var(--cinza-2)', lineHeight: 1.6 }}>
                  {conceito.texto}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}

/** O cabeçalho que todo bloco do dossiê repete: rótulo, "?" e a conclusão.
 *
 *  A REGRA DE DESIGN DA ESPECIFICAÇÃO: todo gráfico abre com a frase que ele
 *  prova. Quando a curadoria ainda não escreveu a frase, o bloco mostra só o
 *  título — nunca uma frase inventada, que é o que transformaria um gráfico
 *  honesto numa afirmação sem dono. */
export function CabecalhoDoBloco({
  titulo,
  conclusao,
  ficha,
}: {
  titulo: string;
  conclusao: string | null;
  ficha: Ficha;
}) {
  return (
    <header style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <p className="kicker" style={{ margin: 0 }}>
          {titulo}
        </p>
        <BotaoDeProcedencia ficha={ficha} titulo={titulo} />
        {ficha.exemplo ? <Chip rotulo="exemplo" /> : null}
      </div>
      {conclusao ? (
        <p style={{ margin: '6px 0 0', fontSize: 15, fontWeight: 600, lineHeight: 1.45 }}>
          {conclusao}
        </p>
      ) : null}
    </header>
  );
}
