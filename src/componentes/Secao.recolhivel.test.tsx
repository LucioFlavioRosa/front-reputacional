// @vitest-environment jsdom

/** A seção que abre e fecha.
 *
 *  PEDIDO DO DONO DO PRODUTO (11/10/2026): "temos 3 blocos Esperando
 *  conferência, Possíveis duplicados e Cadastrados, quero que sejam blocos
 *  expansíveis".
 *
 *  AQUI, E NÃO EM CADA TELA: três implementações do mesmo recolher divergiriam
 *  no dia em que uma ganhasse teclado e as outras não. É o mesmo argumento do
 *  "Baixar PNG", que já mora na `Secao` por essa razão.
 *
 *  O QUE ESTES TESTES PROTEGEM:
 *
 *  * a seção comum NÃO ganha botão — `recolhivel` é opt-in, e um card de
 *    gráfico recolhível esconderia o número que a pessoa veio ver;
 *  * o título vira `<button>` de verdade, com `aria-expanded` — um `<h2>` com
 *    `onClick` não chega por teclado nem é anunciado como algo que se aperta;
 *  * o cabeçalho continua sendo `<h2>` por dentro, porque quem navega por
 *    cabeçalho precisa achar a seção;
 *  * e o corpo é DESMONTADO, não escondido: cada bloco do cadastro tem lista
 *    paginada e estado próprio.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';

import { Secao } from '@/componentes/basicos';

it('a secao COMUM nao ganha botao de recolher', () => {
  //: OPT-IN de propósito. Sem isto, toda `Secao` do produto — e são dezenas —
  //: ganharia um controle que ninguém pediu.
  render(
    <Secao titulo="Cadastrados">
      <p>o corpo</p>
    </Secao>,
  );

  expect(screen.getByText('o corpo')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Cadastrados/ })).toBeNull();
});

it('o titulo vira botao com aria-expanded, e o cabecalho continua cabecalho', () => {
  //: UM `<h2>` COM `onClick` não chega por teclado e o leitor de tela não o
  //: anuncia como algo que se aperta. E envolver o título num botão não pode
  //: custar o cabeçalho: quem navega por cabeçalho precisa achar a seção.
  render(
    <Secao recolhivel titulo="Esperando conferência (12)">
      <p>o corpo</p>
    </Secao>,
  );

  const botao = screen.getByRole('button', { name: /Esperando conferência/ });
  expect(botao.getAttribute('aria-expanded')).toBe('true');
  //: O CABEÇALHO POR DENTRO.
  expect(screen.getByRole('heading', { name: /Esperando conferência/ })).toBeTruthy();
});

it('clicar FECHA e abre de novo, desmontando o corpo', async () => {
  //: DESMONTADO, e não escondido com `display: none`: cada bloco do cadastro tem
  //: lista paginada e estado próprio, e mantê-los vivos atrás de um `hidden`
  //: custaria render em toda digitação na busca de outro bloco.
  render(
    <Secao recolhivel titulo="Possíveis duplicados (4)">
      <p>o corpo</p>
    </Secao>,
  );

  const botao = screen.getByRole('button', { name: /Possíveis duplicados/ });
  await userEvent.click(botao);

  expect(screen.queryByText('o corpo')).toBeNull();
  expect(botao.getAttribute('aria-expanded')).toBe('false');
  //: O TÍTULO FICA, que é o que permite abrir de novo — e é a razão de a
  //: contagem morar nele: fechada, a seção ainda diz quanto trabalho tem.
  expect(screen.getByRole('button', { name: /Possíveis duplicados \(4\)/ })).toBeTruthy();

  await userEvent.click(botao);
  expect(screen.getByText('o corpo')).toBeTruthy();
});

it('`comecaAberta` false abre fechada', () => {
  //: Existe para quem precisar, e o padrão é o contrário: um bloco que nasce
  //: fechado é um bloco que a pessoa não sabe que existe.
  render(
    <Secao recolhivel comecaAberta={false} titulo="Um bloco">
      <p>o corpo</p>
    </Secao>,
  );

  expect(screen.queryByText('o corpo')).toBeNull();
});

it('o botao APONTA para o corpo que governa', () => {
  //: `aria-controls` é o que liga os dois. Sem ele, quem ouve a tela sabe que
  //: algo expandiu e não sabe o quê.
  render(
    <Secao recolhivel titulo="Um bloco">
      <p>o corpo</p>
    </Secao>,
  );

  const botao = screen.getByRole('button', { name: /Um bloco/ });
  const alvo = botao.getAttribute('aria-controls');
  expect(alvo).toBeTruthy();
  expect(document.getElementById(alvo as string)?.textContent).toContain('o corpo');
});
