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

import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { JornadaDoIndice } from '@/graficos/JornadaDoIndice';
import { dominioDaJornada } from '@/dominio/jornadaDoIndice';
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
    temas_das_lentes: {},
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
    //
    // MEDE VISIBILIDADE, E NÃO PRESENÇA NO DOM, desde que a janela passou a
    // reservar a altura do mês mais cheio: os outros meses são montados fora de
    // vista (`visibility: hidden` + `aria-hidden`) para segurar a altura, e é só
    // por isso que o texto deles existe no documento. A propriedade que este
    // teste protege — uma janela por vez, sem parede de texto — é sobre o que se
    // VÊ e sobre o que o leitor de tela anuncia, e as duas continuam de pé.
    montar();
    expect(screen.getByText('Atraso das demonstrações financeiras')).toBeVisible();
    expect(screen.queryByText('Aporte anunciado na Brazil Week')).not.toBeVisible();
    expect(screen.queryByText('Acordo com a agência reguladora')).not.toBeVisible();
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
    //: VISIBILIDADE, pelo mesmo motivo do teste acima: os meses fora de foco
    //: continuam montados, fora de vista, para a janela não encurtar.
    expect(screen.getByText('Aporte anunciado na Brazil Week')).toBeVisible();
    expect(screen.queryByText('Atraso das demonstrações financeiras')).not.toBeVisible();
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

describe('o eixo se move em vez de saltar', () => {
  /** O PEDIDO: "preciso que (...) tenha transições suaves e estáveis mês a mês".
   *
   *  O QUE MUDA O EIXO: ele é adaptativo, então escolher uma lente para comparar
   *  acrescenta as notas dela à conta do domínio — e o eixo inteiro se move. Até
   *  aqui isso era um corte seco, e um corte de régua lê-se como mudança de dado:
   *  a curva aparece noutra altura e quem estava olhando um degrau não sabe se
   *  mudou o degrau ou a régua debaixo dele.
   *
   *  ESTE BLOCO TRAVA AS BORDAS DO MOVIMENTO — onde ele começa e onde termina —,
   *  não os quadros do meio. Os quadros são aritmética, e estão travados em
   *  `dominio/dominioSuave.test.ts`. */

  /** Uma lente que puxa o eixo para cima: notas 30 pontos acima do índice. */
  const COM_LENTE = SERIE.map((p) => ({
    ...p,
    notas_das_lentes: { imprensa: (p.isr as number) + 30 },
  }));

  const marcasDoEixo = () =>
    [...document.querySelectorAll('[data-marca-do-eixo]')].map((no) =>
      Number(no.getAttribute('data-marca-do-eixo')),
    );

  it('o primeiro desenho JÁ está no lugar certo, sem animar da estaca zero', () => {
    //: ANIMAR NA ABERTURA seria o pior dos dois mundos: a tela nasceria com o
    //: eixo errado e o consertaria na frente de quem abriu. A transição existe
    //: para a MUDANÇA, e na primeira vez não houve mudança nenhuma.
    const alvo = dominioDaJornada(SERIE, null);

    render(
      <JornadaDoIndice serie={SERIE} mes="2026-02" comparada={null} aoEscolherMes={vi.fn()} />,
    );

    const marcas = marcasDoEixo();
    expect(marcas.length).toBeGreaterThan(0);
    expect(Math.min(...marcas)).toBeGreaterThanOrEqual(alvo.piso);
    expect(Math.max(...marcas)).toBeLessThanOrEqual(alvo.teto);
  });

  it('termina exatamente no eixo que a jornada desenharia', async () => {
    //: SEM ISTO A ANIMAÇÃO É UM DEFEITO: um eixo que para a meio caminho desenha
    //: uma escala que ninguém calculou, e os números do eixo deixam de bater com
    //: a altura dos pontos.
    const semLente = dominioDaJornada(SERIE, null);
    const comLente = dominioDaJornada(COM_LENTE, 'imprensa');
    //: A premissa do teste: a lente MUDA o eixo. Sem isso não há transição para
    //: medir, e o teste passaria sem exercitar nada.
    expect(comLente.teto).toBeGreaterThan(semLente.teto);

    const { rerender } = render(
      <JornadaDoIndice
        serie={COM_LENTE}
        mes="2026-02"
        comparada={null}
        aoEscolherMes={vi.fn()}
      />,
    );
    rerender(
      <JornadaDoIndice
        serie={COM_LENTE}
        mes="2026-02"
        comparada="imprensa"
        nomeDaComparada="Imprensa"
        aoEscolherMes={vi.fn()}
      />,
    );

    await waitFor(() => {
      const marcas = marcasDoEixo();
      expect(Math.max(...marcas)).toBeGreaterThan(semLente.teto - 10);
      expect(Math.min(...marcas)).toBeGreaterThanOrEqual(comLente.piso);
      expect(Math.max(...marcas)).toBeLessThanOrEqual(comLente.teto);
    });
  });
});

describe('a janela de detalhes não salta de altura', () => {
  /** O RELATO: "a janela que mostra os detalhes dos pontos mês a mês piorou muito
   *  a instabilidade".
   *
   *  A CAUSA: o cartão tem altura livre e conteúdo variável — um mês com três
   *  fatos e rodapé é alto, o mês seguinte sem fato nenhum é baixo. Passar o mouse
   *  pela fita trocava o conteúdo, a altura mudava, e tudo o que está abaixo do
   *  gráfico subia e descia. Pior: o próprio cartão encurtava embaixo do ponteiro,
   *  então o mouse saía dele sozinho e o destaque se desfazia.
   *
   *  A CORREÇÃO É RESERVAR O MAIOR: todos os meses são montados no mesmo lugar da
   *  grade, e só o apontado fica visível. A altura passa a ser a do mês mais cheio
   *  da série, sempre — medida pelo navegador, e não estimada por contagem de
   *  linhas, que erraria no texto que quebra em duas. */

  const CHEIO_E_VAZIO = [
    ponto({
      mes: '2026-01',
      isr: 46,
      fatos: [
        { id: 'a', texto: 'Aporte anunciado na Brazil Week', efeito: 'sustenta' },
        { id: 'b', texto: 'Reunião com a agência reguladora do estado', efeito: 'sustenta' },
        { id: 'c', texto: 'Audiência pública sobre a tarifa de esgoto', efeito: 'pressiona' },
      ],
      maior_movimento: { lente: 'Imprensa', delta: 7 },
      pontos_sem_tema: 3,
    }),
    ponto({ mes: '2026-02', isr: 42, delta: -4 }),
  ];

  it('reserva a altura do mês mais cheio, e não a do que está à vista', () => {
    render(
      <JornadaDoIndice
        serie={CHEIO_E_VAZIO}
        mes="2026-02"
        comparada={null}
        aoEscolherMes={vi.fn()}
      />,
    );

    //: O MÊS VAZIO ESTÁ EM FOCO e o conteúdo do mês cheio continua montado, fora
    //: de vista, segurando a altura. É isso que o teste prova: o texto do mês
    //: cheio existe no documento mesmo com fevereiro selecionado.
    const naJanela = document.querySelector('.jornada__detalhe') as HTMLElement;
    expect(naJanela.textContent).toContain('Audiência pública sobre a tarifa de esgoto');
  });

  it('o que está fora de vista não é lido por quem ouve a tela, nem pega o mouse', () => {
    //: O PREÇO DE MONTAR TODOS seria dobrar o que o leitor de tela anuncia e criar
    //: alvos de mouse invisíveis — o cartão escondido roubaria o `mouseenter` do
    //: visível e o destaque pularia de mês sozinho.
    render(
      <JornadaDoIndice
        serie={CHEIO_E_VAZIO}
        mes="2026-02"
        comparada={null}
        aoEscolherMes={vi.fn()}
      />,
    );

    const escondidos = [...document.querySelectorAll('.jornada__cartao--reserva')];
    expect(escondidos.length).toBeGreaterThan(0);
    for (const cartao of escondidos) {
      expect(cartao.getAttribute('aria-hidden')).toBe('true');
      expect((cartao as HTMLElement).style.pointerEvents).toBe('none');
    }
  });
});
