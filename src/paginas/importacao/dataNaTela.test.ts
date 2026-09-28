/** A data se escreve só com números, e a tela põe as barras.
 *
 *  O PEDIDO: "não gostaria de ficar digitando `/` na data; se eu digitar apenas os
 *  números a formatação viria automaticamente, desde que os números fizerem sentido".
 *
 *  O "DESDE QUE FIZER SENTIDO" É A PARTE INTERESSANTE, e é o que separa uma máscara útil
 *  de uma que atrapalha: `45` não é dia nenhum, e pôr uma barra depois dele — `45/` —
 *  daria a aparência de que a tela aceitou. Quando o número não faz sentido, a barra não
 *  vem: os dígitos ficam crus, à vista, e a pessoa corrige antes de salvar.
 */

import { describe, expect, it } from 'vitest';

import { mascaraDeData, paraTelaBr } from '@/paginas/importacao/dataNaTela';

describe('mascaraDeData', () => {
  it('põe a primeira barra quando o dia está completo e o mês começa', () => {
    expect(mascaraDeData('3')).toBe('3');
    expect(mascaraDeData('30')).toBe('30');
    //: A BARRA SÓ ENTRA COM O DÍGITO SEGUINTE, e não no instante em que o dia fecha:
    //: se ela entrasse em `30`, apagar o próximo dígito devolveria `30/` e o cursor
    //: ficaria preso atrás de uma barra que a pessoa está tentando apagar.
    expect(mascaraDeData('309')).toBe('30/9');
    expect(mascaraDeData('3009')).toBe('30/09');
  });

  it('completa a data inteira a partir de oito dígitos', () => {
    expect(mascaraDeData('30092026')).toBe('30/09/2026');
    expect(mascaraDeData('01012026')).toBe('01/01/2026');
  });

  it('ignora o que passa de oito dígitos — uma data não tem nono dígito', () => {
    expect(mascaraDeData('300920267')).toBe('30/09/2026');
  });

  it('apagar desfaz a barra junto com o dígito', () => {
    //: O CAMINHO DE VOLTA. O campo tinha `30/09`, ela apaga o `9`: o texto que chega é
    //: `30/0`, e o que tem de sair é `30/0` — não `30/09` de novo, nem `3009`.
    expect(mascaraDeData('30/0')).toBe('30/0');
    expect(mascaraDeData('30/')).toBe('30/');
    expect(mascaraDeData('3')).toBe('3');
    expect(mascaraDeData('')).toBe('');
  });

  it('NÃO põe barra quando o dia não faz sentido', () => {
    //: Nenhum mês tem dia 45, e nenhum tem dia 0. Sem barra, o número errado fica
    //: à vista em vez de parecer aceito.
    expect(mascaraDeData('45')).toBe('45');
    expect(mascaraDeData('451')).toBe('451');
    expect(mascaraDeData('00')).toBe('00');
  });

  it('NÃO põe a segunda barra quando o mês não faz sentido', () => {
    //: O dia faz sentido e continua com a barra dele; o mês 13 não ganha a sua.
    expect(mascaraDeData('3013')).toBe('30/13');
    expect(mascaraDeData('30132026')).toBe('30/132026');
  });

  it('aceita a barra digitada por hábito, e completa o zero que falta', () => {
    //: Quem tem o hábito não vai parar de digitar a barra por causa da máscara. `1/`
    //: significa "o dia acabou": é primeiro, e vira `01/`.
    expect(mascaraDeData('1/')).toBe('01/');
    expect(mascaraDeData('1/2/2026')).toBe('01/02/2026');
    expect(mascaraDeData('30/09/2026')).toBe('30/09/2026');
  });

  it('descarta letra e pontuação — o campo é numérico', () => {
    expect(mascaraDeData('30a09b2026')).toBe('30/09/2026');
    expect(mascaraDeData('30.09.2026')).toBe('30/09/2026');
  });
});

describe('paraTelaBr', () => {
  it('traduz a data do servidor para o formato que a pessoa lê e digita', () => {
    /** O SERVIDOR GUARDA EM ISO, e a planilha inteira fala português: a coluna da
     *  planilha pede `dd/mm/aaaa`, o campo de edição oferece `dd/mm/aaaa` como exemplo,
     *  e a grade mostrava `2026-09-30`. Três formatos para a mesma data, na mesma tela. */
    expect(paraTelaBr('2026-09-30')).toBe('30/09/2026');
    expect(paraTelaBr('2026-09-30T00:00:00')).toBe('30/09/2026');
  });

  it('deixa em paz o que já está em português, e o que não é data', () => {
    expect(paraTelaBr('30/09/2026')).toBe('30/09/2026');
    expect(paraTelaBr('Sede administrativa')).toBe('Sede administrativa');
    expect(paraTelaBr('')).toBe('');
  });
});
