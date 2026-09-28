/** Quanto espaço cada coluna recebe, e como o conteúdo se alinha nela.
 *
 *  A LARGURA VEM DO TIPO DO DADO, que o servidor manda junto com o nome da coluna.
 *  Não é estética: "Relato" guarda um parágrafo e "UF" guarda duas letras, e a mesma
 *  largura nas duas desperdiça a tela numa e trunca a outra. Com 22 ou 58 colunas, o
 *  desperdício de uma virou rolagem horizontal de todas.
 *
 *  ALINHAMENTO TAMBÉM É INFORMAÇÃO. O que tem tamanho fixo e curto — a marca de
 *  repetição, a sigla do estado — lê-se melhor centralizado, porque a coluna estreita
 *  faz a borda esquerda brigar com o texto. Tudo o que é nome ou frase fica à
 *  esquerda, onde o olho sempre começa.
 *
 *  A PROSA QUEBRA, E ISTO É O PEDIDO DO DONO DO PRODUTO: "campo aberto deve ter uma
 *  largura máxima e depois o texto ir quebrando, para que possamos ler tudo". Antes ela
 *  cortava com reticências e o valor inteiro só existia no hover — passar o mouse em 54
 *  linhas para ler o relato de cada uma não é ler, é garimpar.
 *
 *  A QUEBRA TEM TETO, e é o que preserva a grade: duas linhas de texto, iguais em toda
 *  a tabela. A altura continua uniforme — é ela que faz a varredura com o olho
 *  funcionar, e é ela que sustenta a promessa de a célula não mudar de tamanho ao
 *  entrar em edição. O que passa de duas linhas corta, e a edição abre um campo de
 *  várias linhas com o texto inteiro dentro.
 */

/** Como uma coluna se desenha na grade. */
export interface Medida {
  /** A largura da coluna, em pixels. Entra no `colgroup`. */
  largura: number;
  alinhamento: 'left' | 'center';
  /** Se o texto quebra em mais de uma linha dentro da célula.
   *
   *  SÓ A PROSA QUEBRA. Uma sigla ou uma data quebrada em duas linhas seria ruído: elas
   *  têm tamanho conhecido e a coluna já cabe. Quem quebra é o campo aberto — Relato,
   *  Repercussão, Observações —, que é onde a pessoa escreve um parágrafo. */
  quebra?: boolean;
}

/** Tipo de coluna → medida. As larguras são múltiplos de 4 e sobem com o conteúdo.
 *
 *  `texto` é o padrão e o meio-termo: cabe "Sede, sala 3" sem reservar o espaço de
 *  um parágrafo. */
const POR_TIPO: Record<string, Medida> = {
  // "sim" ou vazio. Estreita e centralizada — é uma marca, não um valor.
  marca: { largura: 96, alinhamento: 'center' },
  // 25/09/2026, e o campo de edição mostra "dd/mm/aaaa" — dez caracteres nos dois, e a
  // largura tem de caber o CAMPO e não só o texto: foi onde a data ficou apertada.
  data: { largura: 120, alinhamento: 'center' },
  // Duas letras, mais o campo de edição em volta delas.
  sigla: { largura: 76, alinhamento: 'center' },
  // Nome vindo de uma lista: "Prefeitura Municipal de Campinas" tem 32 caracteres, e é
  // o caso real — a coluna cabe ele inteiro em vez de cortar no meio do nome.
  lista: { largura: 232, alinhamento: 'left' },
  // O campo aberto: a coluna mais larga, e o único tipo que QUEBRA o texto. A largura é
  // o máximo — daí em diante o texto desce de linha em vez de a coluna crescer, porque
  // uma coluna de 600px empurraria todas as outras para fora da tela.
  prosa: { largura: 328, alinhamento: 'left', quebra: true },
  texto: { largura: 184, alinhamento: 'left' },
};

/** O padrão de quem não declarou tipo. Igual a `texto`: uma coluna nova aparece
 *  legível, e não invisível nem gigante. */
const PADRAO: Medida = POR_TIPO.texto;

/** Até onde uma coluna pode crescer para caber o conteúdo dela, por tipo.
 *
 *  O PISO É `POR_TIPO` E O TETO É AQUI, e os dois existem por razões opostas: sem piso,
 *  uma coluna cujo arquivo veio todo vazio ficaria fina demais para a pessoa clicar e
 *  digitar; sem teto, um relato de 900 caracteres daria uma coluna de seis mil pixels e
 *  a rolagem horizontal deixaria de ter fim.
 *
 *  A DATA E A SIGLA TÊM TETO PRÓXIMO DO PISO de propósito: o conteúdo delas tem tamanho
 *  conhecido — dez caracteres e duas letras —, e o que elas precisam é caber o CAMPO de
 *  edição em volta desse conteúdo, não crescer. */
export const TETO_POR_TIPO: Record<string, number> = {
  marca: 128,
  data: 152,
  sigla: 104,
  lista: 360,
  prosa: 328,
  texto: 300,
};

/** Quanto ocupa um caractere, em pixels, na fonte da grade (12px).
 *
 *  MEDIDA GROSSEIRA E DE PROPÓSITO: a alternativa é medir o texto no navegador com
 *  `canvas.measureText`, e isso custa uma medição por célula — 29 mil delas no arquivo
 *  cheio — para ganhar precisão que a grade não usa. Sete pixels é a largura de um
 *  dígito com folga; letras minúsculas são mais estreitas, então a conta erra para o
 *  lado seguro. */
const PIXEIS_POR_CARACTERE = 7;

/** A moldura que o conteúdo NÃO usa: o recheio da célula (10px de cada lado), a borda
 *  dela, e o recheio e a borda do campo de edição por dentro.
 *
 *  ELA É O MOTIVO DE A DATA NÃO SER LEGÍVEL com a largura do texto puro: `2026-09-30`
 *  tem 70px de texto, mas dentro de um campo de edição são 70 mais esta moldura. */
const MOLDURA = 44;

/** A medida de uma coluna daquele tipo, ajustada ao conteúdo que ela tem.
 *
 *  O PEDIDO DO DONO DO PRODUTO: "a largura da célula com o dado nunca deve ser menor
 *  que o conteúdo (...) deve ter um ajuste dinâmico até um valor máximo, mas pelo menos
 *  data e UF temos que ser capazes de ler completamente".
 *
 *  O TIPO NÃO SABE O SUFICIENTE. Ele diz que "lista" cabe um nome de órgão; não sabe
 *  que NESTE arquivo o nome mais longo tem sessenta caracteres, nem que aquela coluna
 *  veio inteira vazia. Quem sabe é o conteúdo, e é ele que decide entre o piso e o teto.
 *
 *  O CABEÇALHO CONTA porque também é lido — uma coluna estreita com o nome cortado
 *  obriga a pessoa a adivinhar o que está preenchendo. */
export function medidaPeloConteudo(
  tipo: string,
  valores: readonly (string | null | undefined)[],
  cabecalho = '',
): Medida {
  const base = medidaDaColuna(tipo);
  const teto = TETO_POR_TIPO[tipo] ?? TETO_POR_TIPO.texto;

  let maior = cabecalho.length;
  for (const valor of valores) {
    if (!valor) continue;
    //: O TETO CORTA A CONTA ANTES DE ELA CRESCER: um relato de 900 caracteres e um de
    //: 9000 dão a mesma coluna, e percorrer o texto inteiro para descobrir isso seria
    //: trabalho jogado fora em 500 linhas.
    if (valor.length >= maior) maior = Math.min(valor.length, 80);
  }

  const pedida = maior * PIXEIS_POR_CARACTERE + MOLDURA;
  return { ...base, largura: Math.min(Math.max(base.largura, pedida), teto) };
}

/** A medida de uma coluna daquele tipo. */
export function medidaDaColuna(tipo: string): Medida {
  return POR_TIPO[tipo] ?? PADRAO;
}

/** A largura total das colunas de dados, para a grade saber se precisa rolar. */
export function larguraTotal(tipos: string[]): number {
  return tipos.reduce((soma, tipo) => soma + medidaDaColuna(tipo).largura, 0);
}

/** A soma de um conjunto de medidas já calculadas — é a largura que a TABELA declara.
 *
 *  SEM ESTA DECLARAÇÃO NADA DISTO VALE, e era o defeito que o dono do produto viu como
 *  "não consigo ler a data nem a UF": com `table-layout: fixed` e sem `width`, a tabela
 *  assume a largura do container e REDUZ PROPORCIONALMENTE todas as colunas para caber.
 *  Cinquenta e nove colunas pedindo onze mil pixels dentro de 1200 dão cada coluna com
 *  um vigésimo do que pediu — a Data de 120px vira 13px, e aumentar a largura por tipo
 *  não muda nada, porque o vigésimo continua o mesmo.
 *
 *  DECLARADA, a tabela transborda o container e a rolagem horizontal mostra cada coluna
 *  no tamanho que ela pediu. */
export function larguraDaGrade(medidas: readonly Medida[], extras: readonly number[] = []): number {
  const colunas = medidas.reduce((soma, medida) => soma + medida.largura, 0);
  return colunas + extras.reduce((soma, largura) => soma + largura, 0);
}
