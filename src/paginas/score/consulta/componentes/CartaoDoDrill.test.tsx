// @vitest-environment jsdom
import { createRef } from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CartaoDoDrill } from './CartaoDoDrill';
import { SeloDeSentimento } from './SeloDeSentimento';
import { SeloDeTier } from './SeloDeTier';
import { SeloIlustrativo } from './SeloIlustrativo';

describe('CartaoDoDrill', () => {
  it('é um .cartao com kicker, título h3 na cor da lente e subtítulo', () => {
    const { container } = render(
      <CartaoDoDrill kicker="Pilar · Imprensa" titulo="Eficiência Operacional e Qualidade" subtitulo="Leitura">
        <p>conteúdo</p>
      </CartaoDoDrill>,
    );
    const cartao = container.querySelector('.cartao');
    expect(cartao).not.toBeNull();
    expect(within(cartao as HTMLElement).getByText('Pilar · Imprensa')).toHaveClass('kicker');
    const titulo = screen.getByRole('heading', { level: 3, name: 'Eficiência Operacional e Qualidade' });
    expect(titulo.getAttribute('style')).toContain('var(--cor-dos-titulos, var(--azul-mar))');
    expect(titulo.style.fontSize).toBe('20px');
    expect(titulo.style.fontWeight).toBe('700');
    expect(titulo.style.lineHeight).toBe('1.3');
    expect(titulo).not.toHaveAttribute('tabindex');
    const subtitulo = screen.getByText('Leitura');
    expect(subtitulo.style.fontSize).toBe('14px');
    expect(subtitulo.getAttribute('style')).toContain('var(--cinza-3)');
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });

  it('sempre tem o botão PNG dentro do .cartao, fora da imagem', () => {
    render(<CartaoDoDrill titulo="Abastecimento de água" />);
    const botao = screen.getByRole('button', { name: 'Baixar "Abastecimento de água" em PNG' });
    expect(botao.closest('.cartao')).not.toBeNull();
    expect(botao).toHaveClass('sem-png', 'sem-impressao');
  });

  it('sem título, o PNG leva o nome do kicker, e o kicker é o cabeçalho (h3 com cara de kicker)', () => {
    render(<CartaoDoDrill kicker="Recortes" />);
    expect(screen.getByRole('button', { name: 'Baixar "Recortes" em PNG' })).toBeInTheDocument();
    const cabecalho = screen.getByRole('heading', { level: 3, name: 'Recortes' });
    expect(cabecalho).toHaveClass('kicker');
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });

  it('com título, o kicker não é cabeçalho', () => {
    render(<CartaoDoDrill kicker="Recortes" titulo="T" />);
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.getByText('Recortes').tagName).toBe('DIV');
  });

  it('título do nível: h2 focável por script, com ref e id', () => {
    const ref = createRef<HTMLHeadingElement>();
    render(<CartaoDoDrill titulo="Rompimento de adutora" nivelDoTitulo="h2" refDoTitulo={ref} focavel idDoTitulo="t1" />);
    const titulo = screen.getByRole('heading', { level: 2, name: 'Rompimento de adutora' });
    expect(titulo).toHaveAttribute('tabindex', '-1');
    expect(titulo).toHaveAttribute('id', 't1');
    expect(ref.current).toBe(titulo);
  });

  it('kicker com cor própria e ação antes do botão PNG', () => {
    render(
      <CartaoDoDrill kicker="Leitura do nível" corDoKicker="var(--azul-mar)" titulo="T" acao={<button type="button">Ação</button>} />,
    );
    expect(screen.getByText('Leitura do nível').getAttribute('style')).toContain('var(--azul-mar)');
    const botoes = screen.getAllByRole('button');
    expect(botoes.map((b) => b.textContent)).toEqual(['Ação', 'PNG']);
  });
});

describe('selos', () => {
  it('SeloIlustrativo mostra meta.aviso no selo neutro', () => {
    render(<SeloIlustrativo />);
    const selo = screen.getByText('Dados ilustrativos');
    expect(selo.getAttribute('style')).toContain('var(--bg-trilho)');
    expect(selo.getAttribute('style')).toContain('var(--cinza-3)');
  });

  it('SeloDeSentimento: rótulo e bolinha na cor de gráfico', () => {
    const { container } = render(
      <>
        <SeloDeSentimento sentimento="negativo" />
        <SeloDeSentimento sentimento="neutro" />
        <SeloDeSentimento sentimento="positivo" />
      </>,
    );
    const negativo = screen.getByText('Negativo');
    expect(negativo.getAttribute('style')).toContain('var(--erro-bg)');
    expect(negativo.getAttribute('style')).toContain('var(--erro-fg)');
    expect(screen.getByText('Positivo').getAttribute('style')).toContain('var(--ok-bg)');
    expect(screen.getByText('Neutro').getAttribute('style')).toContain('var(--bg-trilho)');
    const bolinhas = [...container.querySelectorAll('[data-bolinha]')];
    expect(bolinhas).toHaveLength(3);
    expect(bolinhas.every((b) => b.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(bolinhas[0].getAttribute('style')).toContain('var(--vermelho-pitanga)');
  });

  it('SeloDeTier: Tier 1 em azul claro, os demais no neutro', () => {
    render(
      <>
        <SeloDeTier tier="Tier 1" />
        <SeloDeTier tier="Tier 2" />
      </>,
    );
    expect(screen.getByText('Tier 1').getAttribute('style')).toContain('var(--azul-mar)');
    expect(screen.getByText('Tier 1').getAttribute('style')).toMatch(/#E6EAFB|rgb\(230, 234, 251\)/i);
    expect(screen.getByText('Tier 2').getAttribute('style')).toContain('var(--bg-trilho)');
  });
});
