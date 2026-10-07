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

import { useId, useState } from 'react';

import { Chip, Modal } from '@/componentes/basicos';
import { ORIGEM } from '@/dominio/dossie';
import type { Ficha } from '@/dominio/dossie';

export function BotaoDeProcedencia({
  ficha,
  titulo,
  ajuda,
}: {
  ficha: Ficha;
  titulo: string;
  /** O que este gráfico mostra, no hover — o "?" já existia; isto só troca o
   *  balão genérico pelo verbete certo de `dominio/guiaDoDossie.ts`, no
   *  mesmo balão estreito e com quebra de linha que `Ajuda` (basicos.tsx) já
   *  usa — um `title` nativo não dá conta de um parágrafo, só de uma linha.
   *  O clique continua abrindo a procedência (de onde vem o dado), sem
   *  mudança. Sem verbete ainda escrito, cai de volta no `title` simples. */
  ajuda?: string;
}) {
  const [aberto, definirAberto] = useState(false);
  const [emFoco, definirEmFoco] = useState(false);
  const id = useId();

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => definirAberto(true)}
        onMouseEnter={ajuda ? () => definirEmFoco(true) : undefined}
        onMouseLeave={ajuda ? () => definirEmFoco(false) : undefined}
        onFocus={ajuda ? () => definirEmFoco(true) : undefined}
        onBlur={ajuda ? () => definirEmFoco(false) : undefined}
        aria-label={`De onde vem: ${titulo}`}
        aria-describedby={ajuda && emFoco ? id : undefined}
        title={ajuda ? undefined : 'De onde vem este dado'}
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

      {/* MESMO BALÃO DE `Ajuda` (basicos.tsx): largura fixa e quebra de
          linha, em vez do `title` nativo — que vira uma faixa horizontal
          enorme quando o texto passa de poucas palavras. */}
      {ajuda && emFoco ? (
        <span
          id={id}
          role="tooltip"
          style={{
            position: 'absolute',
            zIndex: 40,
            top: 'calc(100% + 6px)',
            left: -6,
            width: 260,
            maxWidth: '70vw',
            padding: '9px 11px',
            background: 'var(--branco)',
            border: '1px solid var(--borda)',
            borderRadius: 'var(--r-card-int)',
            boxShadow: 'var(--sh-tooltip)',
            color: 'var(--cinza-3)',
            fontSize: 12,
            fontWeight: 400,
            lineHeight: 1.45,
            textAlign: 'left',
            whiteSpace: 'normal',
          }}
        >
          {ajuda}
        </span>
      ) : null}

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
    </span>
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
/** A fonte do bloco, abaixo do gráfico.
 *
 *  VISÍVEL, e não só dentro do "?": a §1 pede nota de fonte em cada painel, e
 *  uma fonte que só aparece a um clique de distância deixa o gráfico solto —
 *  quem bate o olho não sabe de onde saiu, e quem não clica nunca descobre.
 *
 *  AQUI, E NÃO NA TELA DO DOSSIÊ onde ela nasceu: o cartão "Onde está a causa"
 *  também a usa, e importá-la de lá criaria ciclo — a tela importa o cartão.
 *  Esta é a terceira peça que lê uma `Ficha`, junto do "?" e do cabeçalho. */
export function NotaDeFonte({ ficha }: { ficha: Ficha }) {
  return (
    <p style={{ margin: '12px 0 0', fontSize: 11, color: 'var(--cinza-2)', lineHeight: 1.5 }}>
      {ficha.fonte}
      {ficha.exemplo ? ' · conteúdo de ilustração' : ''}
    </p>
  );
}

/** O "?" que explica COMO A CONTA É FEITA — irmão do de procedência, e a
 *  distinção entre os dois é o que justifica existirem separados:
 *
 *      procedência   DE ONDE vem o dado (fonte, colunas, o que falta)
 *      conta         COMO o número é calculado, e o que ele quer dizer
 *
 *  O PEDIDO FOI PARA EXPLICAR A OUTRA PESSOA: "preciso explicar para meu usuário
 *  como isso é feito". Quem apresenta um número numa reunião precisa da frase
 *  pronta, não de uma fórmula para traduzir na hora — por isso cada trecho é um
 *  parágrafo em português, e não uma expressão.
 */
export function BotaoDaConta({
  titulo,
  trechos,
}: {
  titulo: string;
  trechos: { termo: string; texto: string }[];
}) {
  const [aberto, definirAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => definirAberto(true)}
        aria-label={`Como esta conta é feita: ${titulo}`}
        title="Como esta conta é feita"
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: '1px solid var(--borda)',
          background: 'var(--branco)',
          color: 'var(--cinza-2)',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        ?
      </button>

      {aberto ? (
        <Modal
          titulo="Como esta conta é feita"
          subtitulo={titulo}
          aoFechar={() => definirAberto(false)}
          largura={640}
        >
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {trechos.map((trecho) => (
              <div key={trecho.termo}>
                <h3 style={{ fontSize: 13, margin: '0 0 6px' }}>{trecho.termo}</h3>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--cinza-3)' }}>
                  {trecho.texto}
                </p>
              </div>
            ))}
          </div>
        </Modal>
      ) : null}
    </>
  );
}

export function CabecalhoDoBloco({
  titulo,
  conclusao,
  ficha,
  ajuda,
}: {
  titulo: string;
  conclusao: string | null;
  ficha: Ficha;
  /** O que este gráfico mostra, no hover do "?" que já existe — não é um
   *  ícone novo. Vem de `dominio/guiaDoDossie.ts`, texto fixo e não do
   *  servidor: o significado do gráfico não muda de mês para mês. */
  ajuda?: string;
}) {
  return (
    <header style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <p className="kicker" style={{ margin: 0 }}>
          {titulo}
        </p>
        <BotaoDeProcedencia ficha={ficha} titulo={titulo} ajuda={ajuda} />
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
