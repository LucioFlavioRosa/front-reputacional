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

  it('aceita a barra digitada por hábito, e completa o zero de quem está digitando', () => {
    //: Quem tem o hábito não vai parar de digitar a barra por causa da máscara. `1/`
    //: significa "o dia acabou": é primeiro, e vira `01/`.
    expect(mascaraDeData('1/')).toBe('01/');
    expect(mascaraDeData('30/09/2026')).toBe('30/09/2026');

    //: UMA DATA JÁ ESCRITA NÃO É REESCRITA, e é o preço de deixar a edição no meio
    //: funcionar: `1/2/2026` colado de algum lugar fica como está, em vez de virar
    //: `01/02/2026`. Textualmente ele é idêntico a `30/9/2026` — uma data da qual a
    //: pessoa acabou de apagar um dígito para trocar o mês —, e não há como distinguir
    //: os dois sem saber de onde o texto veio.
    //:
    //: O PREÇO É ZERO, e isso decidiu a escolha: o servidor lê `1/2/2026`, `30/9/2026` e
    //: `3/09/2026` como as datas que são (conferido em `data_de_celula`). O zero à
    //: esquerda é conforto de leitura, não requisito — e quem DIGITA continua recebendo
    //: ele, porque aí o campo seguinte está vazio (ver o bloco de digitação).
    expect(mascaraDeData('1/2/2026')).toBe('1/2/2026');
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

describe('a máscara, digitada tecla por tecla', () => {
  /** O DEFEITO QUE ESTE BLOCO EXISTE PARA PEGAR, e o dono do produto o achou em dois
   *  minutos de uso: "na coluna data não está aceitando eu digitar o ano; digito o dia e
   *  o mês, mas o ano não aparece".
   *
   *  MEUS TESTES PASSAVAM TODOS, e nenhum deles digitava: eu chamava a máscara com
   *  valores isolados — `'30092026'` de uma vez —, e ninguém digita assim. Tecla por
   *  tecla, o campo já tem `30/09` quando o quinto dígito chega, e o texto que entra na
   *  máscara é `30/092`: o ramo que trata a barra cortava o dígito que passava do mês em
   *  vez de deixá-lo transbordar para o ano. O ano nunca começava.
   *
   *  A LIÇÃO É SOBRE O TESTE, não sobre a máscara: uma máscara se usa em sequência, e
   *  testá-la fora de sequência é testar outra coisa. */

  function digitando(teclas: string): string {
    let campo = '';
    for (const tecla of teclas) campo = mascaraDeData(campo + tecla);
    return campo;
  }

  it('oito dígitos seguidos dão a data inteira', () => {
    expect(digitando('30092026')).toBe('30/09/2026');
    expect(digitando('01012026')).toBe('01/01/2026');
  });

  it('mostra o progresso a cada tecla, sem perder nenhuma', () => {
    expect(digitando('3')).toBe('3');
    expect(digitando('30')).toBe('30');
    expect(digitando('300')).toBe('30/0');
    expect(digitando('3009')).toBe('30/09');
    expect(digitando('30092')).toBe('30/09/2');
    expect(digitando('300920')).toBe('30/09/20');
    expect(digitando('3009202')).toBe('30/09/202');
  });

  it('quem digita as barras chega no mesmo lugar', () => {
    expect(digitando('30/09/2026')).toBe('30/09/2026');
    expect(digitando('1/2/2026')).toBe('01/02/2026');
  });
});

describe('os achados da revisão', () => {
  it('NÃO traduz um texto que só COMEÇA com data — esconderia o resto', () => {
    /** ACHADO DA REVISÃO, e é perda de informação visível: `paraTelaBr` roda em toda
     *  célula da grade, e o meu regex não exigia o fim do texto. Uma observação escrita
     *  como `2026-09-30 - reunião com a prefeitura` aparecia na tela como `30/09/2026`
     *  — o resto da frase desaparecia, e a comparação de salvar ainda a considerava
     *  igual ao original. */
    expect(paraTelaBr('2026-09-30 - reunião com a prefeitura')).toBe(
      '2026-09-30 - reunião com a prefeitura',
    );
    expect(paraTelaBr('2026-09-30, sede')).toBe('2026-09-30, sede');
    //: A data pura, com ou sem hora, continua traduzida.
    expect(paraTelaBr('2026-09-30')).toBe('30/09/2026');
    expect(paraTelaBr('2026-09-30T00:00:00')).toBe('30/09/2026');
  });

  it('apagar um dígito no MEIO da data não o traz de volta', () => {
    /** ACHADO DA REVISÃO. O zero à esquerda é o que faz `1/` virar `01/`, e eu o punha
     *  sempre que havia uma barra: apagar o `0` de `30/09/2026` devolvia `30/9/2026` ao
     *  navegador, e a máscara reescrevia `30/09/2026`. O dígito voltava, e a pessoa não
     *  conseguia trocar o mês sem apagar o campo inteiro.
     *
     *  O ZERO SÓ ENTRA QUANDO O CAMPO SEGUINTE ESTÁ VAZIO — que é o caso de quem está
     *  digitando (`1/` é o fim do dia) e não o de quem está corrigindo o meio. */
    expect(mascaraDeData('30/9/2026')).toBe('30/9/2026');
    expect(mascaraDeData('3/09/2026')).toBe('3/09/2026');
    //: E continua completando quem está digitando agora.
    expect(mascaraDeData('1/')).toBe('01/');
    expect(mascaraDeData('01/2/')).toBe('01/02/');
  });
});
