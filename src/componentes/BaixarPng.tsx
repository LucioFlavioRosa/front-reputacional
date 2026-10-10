/** "Baixar PNG": a imagem do card em que o botão está, para levar a uma
 *  apresentação ou a um e-mail sem recortar a tela à mão.
 *
 *  O CARD INTEIRO, E NÃO SÓ O GRÁFICO: título, subtítulo, legenda e números
 *  vão juntos — um gráfico sem o título não diz o que mede quando sai daqui.
 *
 *  SEM OS BOTÕES NA IMAGEM: tudo o que tem `sem-png` ou `sem-impressao` (o
 *  próprio botão, o "?" de procedência, a faixa de filtros) fica de fora. É a
 *  mesma régua da impressão: o que é controle da tela não é conteúdo.
 *
 *  O DOBRO DA RESOLUÇÃO (`pixelRatio: 2`), para a imagem não borrar num slide.
 *
 *  A BIBLIOTECA CARREGA SÓ NO CLIQUE: quem nunca baixa uma imagem não paga o
 *  peso dela ao abrir a tela.
 */

import { useRef, useState } from 'react';

import { nomeDoArquivo } from '@/dominio/nomeDoArquivo';

function ficaNaImagem(no: HTMLElement): boolean {
  const classes = no.classList;
  return !classes || !(classes.contains('sem-png') || classes.contains('sem-impressao'));
}

export function BaixarPng({ titulo }: { titulo: string }) {
  const botao = useRef<HTMLButtonElement>(null);
  const [gerando, definirGerando] = useState(false);

  const baixar = async () => {
    const card = botao.current?.closest<HTMLElement>('.cartao');
    if (!card || gerando) return;
    definirGerando(true);
    try {
      const { toPng } = await import('html-to-image');
      const opcoes = { pixelRatio: 2, backgroundColor: '#FFFFFF', filter: ficaNaImagem };
      //: FONTE DE OUTRO DOMÍNIO pode recusar a leitura; aí a imagem sai com a
      //: fonte do sistema em vez de não sair.
      const imagem = await toPng(card, opcoes).catch(() => toPng(card, { ...opcoes, skipFonts: true }));
      const link = document.createElement('a');
      link.download = nomeDoArquivo(titulo);
      link.href = imagem;
      link.click();
    } finally {
      definirGerando(false);
    }
  };

  return (
    <button
      ref={botao}
      type="button"
      className="sem-png sem-impressao"
      onClick={baixar}
      disabled={gerando}
      aria-label={`Baixar "${titulo}" em PNG`}
      title="Baixar este card em PNG"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: 'transparent',
        border: '1px solid var(--borda)',
        borderRadius: 999,
        padding: '4px 10px',
        fontSize: 11.5,
        fontWeight: 700,
        color: 'var(--cinza-2)',
        cursor: gerando ? 'progress' : 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M2.5 13.5h11" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {gerando ? 'Gerando…' : 'PNG'}
    </button>
  );
}
