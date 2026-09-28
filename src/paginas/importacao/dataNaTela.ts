/** A data, do jeito que a pessoa lê e escreve.
 *
 *  DUAS COISAS, E A MESMA RAZÃO: a planilha pede a data em `dd/mm/aaaa`, o campo de
 *  edição oferece `dd/mm/aaaa` como exemplo, e a grade mostrava `2026-09-30` — o formato
 *  em que o servidor a guarda. Três formatos para a mesma data na mesma tela, e a pessoa
 *  no meio decidindo qual deles vale.
 *
 *  A MÁSCARA FOI PEDIDO DIRETO: "não gostaria de ficar digitando `/` na data; se eu
 *  digitar apenas os números a formatação viria automaticamente, desde que os números
 *  fizerem sentido". Lançar 54 agendas de um evento são 54 datas, e cada barra digitada
 *  é uma tecla a mais numa mão que está lendo outra coisa.
 *
 *  O "DESDE QUE FIZER SENTIDO" É A METADE QUE PROTEGE. Uma máscara que formata qualquer
 *  coisa dá a `45` a aparência de dia — `45/` parece aceito. Aqui a barra é o sinal de
 *  que o número passou: dia fora de 1..31 e mês fora de 1..12 ficam crus, à vista, antes
 *  de a pessoa salvar. O julgamento fino continua no servidor, que é quem sabe que 31 de
 *  fevereiro não existe.
 */

/** Só os dígitos de um texto. */
function digitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

/** Se aqueles dígitos ainda podem ser um dia do mês.
 *
 *  INCOMPLETO NÃO É INVÁLIDO, e a diferença passou a importar quando o zero à esquerda
 *  deixou de ser automático: `3` é o começo de 3, 30 e 31, e um campo com um dígito só
 *  acontece a toda hora — enquanto a pessoa digita, e depois de ela apagar um dígito no
 *  meio de uma data formatada. Quem não pode passar é o dia FECHADO e impossível: 45,
 *  00, 32. */
function diaFazSentido(dia: string): boolean {
  const numero = Number(dia);
  return dia.length < 2 || (numero >= 1 && numero <= 31);
}

/** Se aqueles dígitos ainda podem ser um mês. Ver `diaFazSentido`. */
function mesFazSentido(mes: string): boolean {
  const numero = Number(mes);
  return mes.length < 2 || (numero >= 1 && numero <= 12);
}

/** A data do servidor no formato que a tela usa. Devolve o texto intacto quando ele
 *  não é uma data em ISO — a mesma função serve para qualquer célula.
 *
 *  O TEXTO TODO TEM DE SER A DATA, e era um achado da revisão: sem exigir o fim, o
 *  regex casava o começo de `2026-09-30 - reunião com a prefeitura` e a grade mostrava
 *  `30/09/2026`. O resto da frase desaparecia da tela, e a comparação de salvar ainda
 *  considerava as duas iguais — uma observação inteira escondida, sem nada avisando.
 *
 *  A HORA É ACEITA porque é como o servidor serializa um `datetime`, e ela não é
 *  informação que a pessoa escreveu: a coluna de data guarda o dia. */
export function paraTelaBr(valor: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ][\d:.+-]*)?$/.exec(valor);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : valor;
}

/** O que o campo de data mostra depois de cada tecla.
 *
 *  TRABALHA COM OS DÍGITOS e não com o texto, porque é isso que torna o caminho de volta
 *  natural: apagar um dígito tira a barra junto, em vez de a máscara recolocá-la e
 *  prender o cursor atrás dela.
 *
 *  A BARRA DIGITADA À MÃO É RESPEITADA como "este campo acabou": quem tem o hábito de
 *  digitar `1/2/2026` não vai perdê-lo por causa da máscara, e `1/` é primeiro dia —
 *  vira `01/`.
 */
export function mascaraDeData(digitado: string): string {
  //: Colar a data do servidor no campo é caso real — ela está na célula ao lado.
  const texto = paraTelaBr(digitado);

  let dia: string;
  let mes: string;
  let ano: string;
  let diaFechado: boolean;
  let mesFechado: boolean;

  if (texto.includes('/')) {
    const partes = texto.split('/');
    dia = digitos(partes[0] ?? '');
    mes = digitos(partes[1] ?? '');
    ano = digitos(partes.slice(2).join(''));

    //: O QUE PASSA DE UM CAMPO TRANSBORDA PARA O SEGUINTE, e era aqui o defeito que o
    //: dono do produto achou em dois minutos de uso: "digito o dia e o mês, mas o ano
    //: não aparece".
    //:
    //: NINGUÉM DIGITA A DATA DE UMA VEZ. Tecla por tecla, o campo já mostra `30/09`
    //: quando o quinto dígito chega, e o texto que entra aqui é `30/092` — o `2` é o
    //: começo do ANO, morando no pedaço do mês porque a barra ainda não foi escrita.
    //: Cortar em dois dígitos, como eu fazia, jogava fora cada tecla do ano: o campo
    //: ficava parado em `30/09` para sempre.
    if (dia.length > 2) {
      mes = dia.slice(2) + mes;
      dia = dia.slice(0, 2);
    }
    if (mes.length > 2) {
      ano = mes.slice(2) + ano;
      mes = mes.slice(0, 2);
    }
    ano = ano.slice(0, 4);

    //: A BARRA FECHA O CAMPO ANTERIOR, e é o que permite o zero à esquerda: `1/` é dia
    //: 01, e não um dia pela metade.
    diaFechado = true;
    mesFechado = partes.length > 2 || ano.length > 0;

    //: O ZERO SÓ ENTRA QUANDO O CAMPO SEGUINTE ESTÁ VAZIO, e este era um achado da
    //: revisão: eu completava sempre que havia uma barra, e isso desfazia a edição no
    //: meio. Apagar o `0` de `30/09/2026` devolve `30/9/2026` ao navegador, a máscara
    //: reescrevia `30/09/2026`, e o dígito voltava — trocar o mês exigia apagar o campo
    //: inteiro.
    //:
    //: CAMPO SEGUINTE VAZIO É QUEM ESTÁ DIGITANDO AGORA (`1/` acabou de fechar o dia);
    //: campo seguinte preenchido é quem está corrigindo o meio de uma data que já
    //: existe, e aí o que ela apagou fica apagado.
    if (dia.length === 1 && mes === '' && ano === '') dia = `0${dia}`;
    if (mes.length === 1 && ano === '' && mesFechado) mes = `0${mes}`;
  } else {
    const todos = digitos(texto).slice(0, 8);
    dia = todos.slice(0, 2);
    mes = todos.slice(2, 4);
    ano = todos.slice(4);
    //: SEM BARRA DIGITADA, o campo fecha pelo tamanho — e só quando o dígito SEGUINTE
    //: aparece. Fechar em `30` poria a barra antes de a pessoa pedir.
    diaFechado = mes.length > 0;
    mesFechado = ano.length > 0;
  }

  //: DIA SEM SENTIDO NÃO GANHA BARRA: os dígitos ficam crus para a pessoa ver o erro.
  if (!diaFazSentido(dia)) return `${dia}${mes}${ano}`;
  if (!diaFechado) return dia;

  //: MÊS SEM SENTIDO PERDE A SEGUNDA BARRA, e só ela: o dia passou, e a barra dele fica.
  if (!mesFazSentido(mes)) return `${dia}/${mes}${ano}`;
  if (!mesFechado) return `${dia}/${mes}`;

  return `${dia}/${mes}/${ano}`;
}
