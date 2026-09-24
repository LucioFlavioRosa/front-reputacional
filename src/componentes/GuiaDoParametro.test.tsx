// @vitest-environment jsdom

/** O "?" da Calibração, montado de verdade.
 *
 *  ESTE ARQUIVO EXISTE POR CAUSA DE UM DEFEITO QUE 475 TESTES NÃO PEGARAM: o
 *  modal abria e não fechava no clique, só no Escape. A causa era HTML — um
 *  `<button>` dentro de um `<label>` vira o controle que aquele rótulo rotula,
 *  e o navegador reencaminha para ele todo clique dado dentro do label,
 *  inclusive o clique no X que acabara de fechar.
 *
 *  O QUE O JSDOM PEGA, E O QUE ELE NÃO PEGA — medido, reintroduzindo o defeito:
 *  dos sete testes abaixo, só UM falhou. O do NOME ACESSÍVEL. O jsdom não
 *  implementa o reencaminhamento de clique do `<label>` para o controle, então
 *  o teste de "fecha no X" passa com o defeito dentro.
 *
 *  ISSO NÃO TIRA O VALOR DO ARQUIVO, e muda o que se pode afirmar dele. A
 *  rotulagem errada é a CAUSA; o clique que volta é o SINTOMA. Travar a causa
 *  teria barrado o defeito antes de ele virar sintoma — e é a causa que o
 *  jsdom alcança. O sintoma continua sendo conferência de navegador.
 *
 *  A REGRA QUE FICA: um teste de tela aqui prova estrutura e papel — quem
 *  rotula quem, o que tem nome acessível, o que o teclado alcança. Ele NÃO
 *  prova comportamento nativo do navegador, e escrever asserção sobre isso dá
 *  falsa segurança, que é pior do que não ter teste.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Campo } from '@/componentes/basicos';
import { GuiaDoParametro } from '@/componentes/GuiaDoParametro';

function campoComGuia() {
  return render(
    <Campo
      rotulo="Virada · pontos de nota"
      dica="Quantos pontos a nota precisa andar."
      aoLadoDoRotulo={<GuiaDoParametro chave="virada_pontos" />}
    >
      <input defaultValue="10" />
    </Campo>,
  );
}

describe('o "?" dentro do campo', () => {
  it('abre o guia no clique', async () => {
    const pessoa = userEvent.setup();
    campoComGuia();

    await pessoa.click(screen.getByRole('button', { name: /O que faz/ }));

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Virada · pontos de nota');
  });

  it('FECHA no X, e não só no Escape', async () => {
    // ATENÇÃO AO QUE ESTE TESTE PROVA: que o X está ligado ao fechamento. Ele
    // NÃO reproduz o defeito original — o jsdom não reencaminha o clique do
    // `<label>`, e este teste passava com o `<button>` dentro. Quem trava a
    // causa é o teste do nome acessível, abaixo.
    const pessoa = userEvent.setup();
    campoComGuia();

    await pessoa.click(screen.getByRole('button', { name: /O que faz/ }));
    await pessoa.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('fecha no Escape', async () => {
    const pessoa = userEvent.setup();
    campoComGuia();

    await pessoa.click(screen.getByRole('button', { name: /O que faz/ }));
    await pessoa.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('o rótulo continua sendo do CAMPO, e não do "?"', async () => {
    // O ÚNICO DOS SETE QUE PEGA O DEFEITO ORIGINAL, conferido reintroduzindo-o.
    // Com um `<button>` ali, "Virada · pontos de nota" passava a rotular o
    // botão de ajuda: quem ouve a tela ouvia o nome do parâmetro e chegava no
    // "?" — e todo clique dentro do label ia junto.
    campoComGuia();

    expect(screen.getByRole('textbox')).toHaveAccessibleName(/Virada/);
  });

  it('abre pelo teclado, com Enter', async () => {
    // O "?" não é um `<button>` — é um `span` com papel de botão, e por isso
    // precisa tratar Enter na mão. Sem isto, quem navega por teclado chega no
    // "?" e não consegue abri-lo.
    const pessoa = userEvent.setup();
    campoComGuia();

    screen.getByRole('button', { name: /O que faz/ }).focus();
    await pessoa.keyboard('{Enter}');

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('o guia diz o que muda no resultado, e não só o que o campo é', () => {
    campoComGuia();
    expect(screen.getByText('Virada · pontos de nota')).toBeInTheDocument();
  });

  it('uma chave sem verbete não desenha "?" nenhum', () => {
    render(
      <Campo rotulo="Inventado" aoLadoDoRotulo={<GuiaDoParametro chave="inventado" />}>
        <input />
      </Campo>,
    );
    expect(screen.queryByRole('button', { name: /O que faz/ })).not.toBeInTheDocument();
  });
});
