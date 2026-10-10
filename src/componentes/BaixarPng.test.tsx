// @vitest-environment jsdom

/** Todo card com título oferece "Baixar PNG"; o título da tela, não. */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { nomeDoArquivo } from '@/dominio/nomeDoArquivo';
import { Secao } from '@/componentes/basicos';

describe('Baixar PNG', () => {
  it('o arquivo leva o título do card, sem acento nem espaço', () => {
    expect(nomeDoArquivo('Termômetro por Instituições')).toBe('termometro-por-instituicoes.png');
    expect(nomeDoArquivo('Temas × termômetro')).toBe('temas-termometro.png');
    expect(nomeDoArquivo('  ')).toBe('card.png');
  });

  it('todo card com título tem o botão, que não entra na própria imagem', () => {
    render(<Secao titulo="Radar Reputacional">conteúdo</Secao>);
    const botao = screen.getByRole('button', { name: 'Baixar "Radar Reputacional" em PNG' });
    expect(botao.classList.contains('sem-png')).toBe(true);
  });

  it('o título da tela e a seção marcada com semPng não têm o botão', () => {
    render(
      <>
        <Secao titulo="Painel" nivelDoTitulo={1}>a</Secao>
        <Secao titulo="Formulário" semPng>b</Secao>
      </>,
    );
    expect(screen.queryByRole('button', { name: /PNG/ })).toBeNull();
  });
});
