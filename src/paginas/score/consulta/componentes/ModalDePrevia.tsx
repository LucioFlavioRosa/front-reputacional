/** Modal de prévia de uma matéria ou de um post (spec F.8, decisão A8).
 *
 *  É O `Modal` DE `basicos.tsx`: foco preso, `Esc`, clique no fundo,
 *  `aria-modal`, `aria-labelledby` e foco devolvido a quem abriu já vêm de
 *  lá. O título da matéria (ou, no post, o do cartão em que ele aparece) vai
 *  no cabeçalho do `Modal`, que é o que nomeia o diálogo para o leitor de
 *  tela; repeti-lo no corpo seria ler a mesma frase duas vezes. Por isso o
 *  título sai no cabeçalho azul do `Modal` (h2 branco), e não no corpo em
 *  20px azul como na F.8 (registrado na decisão A8).
 *
 *  O FOCO VOLTA AO BOTÃO QUE ABRIU MESMO NO SAFARI: o `Modal` guarda
 *  `document.activeElement` ao montar, e no Safari/macOS clicar num botão
 *  não o foca (o ativo seria o `body`). Com `devolverFocoPara`, o botão
 *  recebe o foco num efeito de layout, que roda antes do efeito de montagem
 *  do `Modal`; ele então o guarda e o devolve ao fechar, como nos outros
 *  navegadores. Os cartões e a lista já entregam o botão (`aoAbrirItem(item,
 *  botao)`); quem monta o modal o repassa aqui.
 *
 *  NUNCA UM LINK INVENTADO: sem `url` (o caso da demonstração), no lugar do
 *  botão vai a frase da spec; endereço que não é http(s) conta como sem
 *  `url`.
 */

import { useLayoutEffect, useRef } from 'react';

import { Modal, Selo } from '@/componentes/basicos';

import { SELO_DE_PERFIL } from '../cores';
import { arred, corDoSinal, fmtDataLonga, fmtPtItem } from '../formatacao';
import { urlSegura } from './apoioDosCartoes';
import type { AlvoDaPrevia } from './apoioDosCartoes';
import { SeloDeSentimento } from './SeloDeSentimento';
import { SeloDeTier } from './SeloDeTier';

const LARGURA = 640;

export function ModalDePrevia({
  alvo,
  aoFechar,
  devolverFocoPara,
}: {
  alvo: AlvoDaPrevia;
  aoFechar: () => void;
  /** O botão que abriu a prévia: recebe o foco de volta ao fechar (F.8). */
  devolverFocoPara?: HTMLElement | null;
}) {
  // SÓ NA MONTAGEM: é o instante em que o `Modal` lê quem abriu. O botão vai
  // num ref para o efeito não rodar de novo (e roubar o foco do diálogo) se
  // quem monta passar outro elemento com o modal aberto.
  const botaoDeOrigem = useRef(devolverFocoPara);
  useLayoutEffect(() => {
    const botao = botaoDeOrigem.current;
    if (botao && document.activeElement !== botao) botao.focus();
  }, []);

  const ehItem = alvo.tipo === 'item';
  const titulo = ehItem ? alvo.item.titulo : alvo.titulo;
  const sentimento = ehItem ? alvo.item.sentimento : alvo.post.sentimento;
  const meta = ehItem
    ? `${alvo.item.veiculo} · ${alvo.item.jornalista} · ${fmtDataLonga(alvo.item.data)}`
    : `${alvo.post.rede} · ${alvo.post.perfil} · ${fmtDataLonga(alvo.post.data)}`;
  const trecho = ehItem ? alvo.item.trecho : `“${alvo.post.texto}”`;
  const local = ehItem
    ? `${alvo.item.concessionaria} · ${alvo.item.uf}`
    : `${alvo.post.concessionaria} · ${alvo.post.uf}`;
  const url = urlSegura(ehItem ? alvo.item.url : alvo.post.url);

  return (
    <Modal titulo={titulo} aoFechar={aoFechar} largura={LARGURA}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <SeloDeSentimento sentimento={sentimento} />
        {ehItem ? (
          <SeloDeTier tier={alvo.item.tier} />
        ) : (
          <Selo rotulo={alvo.post.perfil} fundo={SELO_DE_PERFIL.fundo} texto={SELO_DE_PERFIL.texto} />
        )}
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--cinza-3)' }}>{meta}</p>
      <p style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.6, color: 'var(--cinza-4)' }}>{trecho}</p>
      <p style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--cinza-3)' }}>{local}</p>
      {ehItem ? (
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--cinza-3)' }}>
          Impacto na nota:{' '}
          <strong className="tabular" style={{ color: corDoSinal(arred(alvo.item.impacto, 2)) }}>
            {fmtPtItem(alvo.item.impacto)} pt
          </strong>
        </p>
      ) : null}
      <div style={{ marginTop: 20 }}>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="consulta-botao-primario"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 40,
              padding: '0 16px',
              borderRadius: 'var(--r-btn)',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Abrir no site de origem <span aria-hidden>↗</span>
          </a>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--cinza-3)' }}>
            O link para a fonte original entra com a integração do clipping.
          </p>
        )}
      </div>
    </Modal>
  );
}
