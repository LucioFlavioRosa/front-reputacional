// @vitest-environment jsdom

/** O cartão do mês, montado de verdade.
 *
 *  O QUE ESTE ARQUIVO TRAVA é a troca de "tudo aberto" por "aberto sob demanda".
 *  Enquanto as dez colunas de texto ficavam todas na tela, nada podia sumir por
 *  erro de ligação: o texto estava lá. Agora um mês só aparece quando alguém o
 *  aponta — e uma ligação frouxa entre apontar e mostrar não quebra o build, não
 *  aparece em teste de lógica, e simplesmente esconde a informação.
 *
 *  O DOMÍNIO NÃO É TESTADO AQUI. Variação, filete, linhas e rodapé saem de
 *  `dominio/jornadaDoIndice`, que tem os próprios testes. Isto confere o que só
 *  se vê montando: quem manda no cartão, e quando ele troca de mês.
 */

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { JornadaDoIndice } from '@/graficos/JornadaDoIndice';
import type { PontoDaSerie } from '@/dominio/score';

function ponto(parcial: Partial<PontoDaSerie>): PontoDaSerie {
  return {
    mes: '2026-01',
    isr: 58,
    lentes: 5,
    tem_estimativa: false,
    delta: null,
    fatos: [],
    sustentou: null,
    pressionou: null,
    pontos_sem_tema: 0,
    maior_movimento: null,
    notas_das_lentes: {},
    ...parcial,
  };
}

/** Três meses, cada um com um fato que só existe nele: é o que permite dizer
 *  QUAL mês o cartão está mostrando, sem depender de nome de classe. */
const SERIE = [
  ponto({
    mes: '2026-01',
    isr: 46,
    fatos: [{ id: 'f1', texto: 'Aporte anunciado na Brazil Week', efeito: 'sustenta' }],
  }),
  ponto({
    mes: '2026-02',
    isr: 42,
    delta: -4,
    fatos: [{ id: 'f2', texto: 'Atraso das demonstrações financeiras', efeito: 'pressiona' }],
  }),
  ponto({
    mes: '2026-03',
    isr: 51,
    delta: 9,
    fatos: [{ id: 'f3', texto: 'Acordo com a agência reguladora', efeito: 'sustenta' }],
  }),
];

/** A célula do mês na fita — o controle que aponta e escolhe.
 *
 *  ANCORADO NO COMEÇO, e com a vírgula: o ponto da curva também se chama pelo
 *  mês ("março: índice 51, faixa Atenção"), e um `/março/` acharia os dois. A
 *  célula da fita diz o mês e a variação ("março, +9 no mês"). */
const naFita = (nome: string) => screen.getByRole('button', { name: new RegExp(`^${nome},`) });

const montar = (mes = '2026-02', aoEscolherMes = vi.fn()) => {
  render(
    <JornadaDoIndice serie={SERIE} mes={mes} comparada={null} aoEscolherMes={aoEscolherMes} />,
  );
  return aoEscolherMes;
};

describe('a jornada do índice', () => {
  it('não abre os três meses de uma vez', () => {
    // O PONTO DA MUDANÇA. Eram dez colunas de texto simultâneas; agora há um
    // cartão. Se este teste falhar porque os três fatos voltaram à tela, a
    // parede de letra miúda voltou com eles.
    montar();
    expect(screen.getByText('Atraso das demonstrações financeiras')).toBeInTheDocument();
    expect(screen.queryByText('Aporte anunciado na Brazil Week')).toBeNull();
    expect(screen.queryByText('Acordo com a agência reguladora')).toBeNull();
  });

  it('sem mouse nenhum, mostra o mês escolhido', () => {
    // É o que sobra para quem não tem mouse — no telefone, e em quem navega por
    // teclado antes de focar qualquer coisa. Um cartão que só existe sob o
    // cursor não existiria para eles.
    montar('2026-03');
    expect(screen.getByText('Acordo com a agência reguladora')).toBeInTheDocument();
  });

  it('troca de mês quando o mouse passa pela fita', async () => {
    montar('2026-02');
    await userEvent.hover(naFita('janeiro'));
    expect(screen.getByText('Aporte anunciado na Brazil Week')).toBeInTheDocument();
    expect(screen.queryByText('Atraso das demonstrações financeiras')).toBeNull();
  });

  it('volta ao mês escolhido quando o mouse sai', async () => {
    // A PRÉVIA SAI SOZINHA: apontar não escolhe, e o cartão não fica preso no
    // último mês por onde o mouse passou.
    montar('2026-02');
    await userEvent.hover(naFita('janeiro'));
    await userEvent.unhover(naFita('janeiro'));
    expect(screen.getByText('Atraso das demonstrações financeiras')).toBeInTheDocument();
  });

  it('escolhe o mês no clique da fita', async () => {
    const aoEscolherMes = montar('2026-02');
    await userEvent.click(naFita('março'));
    expect(aoEscolherMes).toHaveBeenCalledWith('2026-03');
  });

  it('o cartão não é um controle', () => {
    // Um botão anuncia como nome tudo o que tem dentro, e este tem o mês, a
    // variação, o fato e o rodapé. Quem escolhe o mês é a fita: três células,
    // três pontos na curva, e nada mais.
    montar();
    const fato = screen.getByText('Atraso das demonstrações financeiras');
    expect(fato.closest('button')).toBeNull();
  });
});
