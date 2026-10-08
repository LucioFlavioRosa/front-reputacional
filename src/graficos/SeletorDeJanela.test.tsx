// @vitest-environment jsdom

/** A mini linha do tempo da Jornada e os cartões da janela. */

import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CartoesDaJanela } from '@/graficos/CartoesDaJanela';
import { JornadaDoIndice } from '@/graficos/JornadaDoIndice';
import { SeletorDeJanela } from '@/graficos/SeletorDeJanela';
import { janelaDoAtalho, kpisDaJanela } from '@/dominio/janelaDaJornada';
import type { Janela } from '@/dominio/janelaDaJornada';
import type { PontoDaSerie } from '@/dominio/score';

const ponto = (mes: string, isr: number, lentes = 5): PontoDaSerie =>
  ({
    mes,
    isr,
    lentes,
    tem_estimativa: false,
    delta: null,
    fatos: [],
    sustentou: null,
    pressionou: null,
    pontos_sem_tema: 0,
    maior_movimento: null,
    notas_das_lentes: {},
    temas_das_lentes: {},
  }) as PontoDaSerie;

const MESES = Array.from({ length: 8 }, (_, i) => ponto(`2026-0${i + 1}`, 60 + i));

function ComEstado({ inicial }: { inicial: Janela }) {
  const [janela, definir] = useState(inicial);
  return (
    <>
      <SeletorDeJanela meses={MESES} janela={janela} aoMudar={definir} />
      <output data-testid="janela">{`${janela.inicio}-${janela.fim}`}</output>
    </>
  );
}

const janelaAtual = () => screen.getByTestId('janela').textContent;

describe('SeletorDeJanela', () => {
  it('setas deslocam a janela; Shift + setas mudam o fim', () => {
    render(<ComEstado inicial={{ inicio: 2, fim: 5 }} />);
    const bloco = screen.getByRole('slider', { name: /Janela do gráfico/ });
    fireEvent.keyDown(bloco, { key: 'ArrowRight' });
    expect(janelaAtual()).toBe('3-6');
    fireEvent.keyDown(bloco, { key: 'ArrowRight', shiftKey: true });
    expect(janelaAtual()).toBe('3-7');
    fireEvent.keyDown(bloco, { key: 'ArrowLeft', shiftKey: true });
    fireEvent.keyDown(bloco, { key: 'ArrowLeft', shiftKey: true });
    // Mínimo de 3 meses: a terceira redução não passa de 3-5.
    fireEvent.keyDown(bloco, { key: 'ArrowLeft', shiftKey: true });
    expect(janelaAtual()).toBe('3-5');
  });

  it('a alça do início mexe só no início, e diz o mês', () => {
    render(<ComEstado inicial={{ inicio: 2, fim: 5 }} />);
    const alca = screen.getByRole('slider', { name: 'Início da janela' });
    expect(alca.getAttribute('aria-valuetext')).toBe('março de 2026');
    fireEvent.keyDown(alca, { key: 'ArrowLeft' });
    expect(janelaAtual()).toBe('1-5');
  });

  it('os atalhos trocam a janela e o escolhido fica pressionado', async () => {
    render(<ComEstado inicial={janelaDoAtalho('tudo', MESES)} />);
    expect(screen.getByRole('button', { name: 'Tudo' }).getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(screen.getByRole('button', { name: '3M' }));
    expect(janelaAtual()).toBe('5-7');
    expect(screen.getByRole('button', { name: '3M' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('CartoesDaJanela', () => {
  it('mostra os quatro cartões; o pico ignora o mês parcial, sem texto de aviso', () => {
    const kpis = kpisDaJanela([ponto('2026-01', 70), ponto('2026-02', 95, 1), ponto('2026-03', 80)]);
    render(<CartoesDaJanela kpis={kpis} />);
    const cartoes = screen.getAllByRole('listitem');
    expect(cartoes).toHaveLength(4);
    expect(within(cartoes[0]).getByText('80')).toBeTruthy();
    expect(within(cartoes[1]).getByText('80')).toBeTruthy(); // o pico considerado
    expect(within(cartoes[1]).queryByText(/não entra/)).toBeNull();
    expect(within(cartoes[3]).getByText('alta')).toBeTruthy();
  });
});

describe('JornadaDoIndice com linha de referência', () => {
  it('desenha a linha do pico quando pedida, e some quando não', () => {
    const { container, rerender } = render(
      <JornadaDoIndice
        serie={MESES}
        mes="2026-08"
        comparada={null}
        aoEscolherMes={() => {}}
        linhaDeReferencia={{ valor: 67, rotulo: 'Pico 67' }}
      />,
    );
    expect(container.querySelector('[data-linha-de-referencia="67"]')).toBeTruthy();
    expect(screen.getByText('Pico 67')).toBeTruthy();
    rerender(<JornadaDoIndice serie={MESES} mes="2026-08" comparada={null} aoEscolherMes={() => {}} />);
    expect(container.querySelector('[data-linha-de-referencia]')).toBeNull();
  });
  it('sem o cartão do mês quando pedido; com ele, como na tela da lente', () => {
    const { container, rerender } = render(
      <JornadaDoIndice serie={MESES} mes="2026-08" comparada={null} aoEscolherMes={() => {}} semDetalheDoMes />,
    );
    expect(container.querySelector('.jornada__detalhe')).toBeNull();
    rerender(<JornadaDoIndice serie={MESES} mes="2026-08" comparada={null} aoEscolherMes={() => {}} />);
    expect(container.querySelector('.jornada__detalhe')).toBeTruthy();
  });
});
