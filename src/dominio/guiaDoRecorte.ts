/** Como a conta do painel de aprofundamento é feita — para quem precisa EXPLICAR
 *  o número a outra pessoa.
 *
 *  O PEDIDO FOI ASSIM: "está mostrando uma nota do recorte que varia mês a mês, e
 *  fala o quanto aquele recorte tirou de nota da lente. Preciso explicar para meu
 *  usuário como isso é feito." Ou seja: o painel passou a mostrar DOIS números de
 *  naturezas diferentes (uma nota de 0 a 100 e uma contribuição em pontos), e
 *  quem apresenta precisa de uma frase pronta para cada um.
 *
 *  TEXTO ESTÁTICO, pela mesma razão de `guiaDoDossie.ts`: a pergunta é "o que esta
 *  conta significa", que não muda de mês para mês. A ÚNICA PARTE VIVA é a fórmula
 *  da nota, que o servidor gera (`DossieSaida.formula`) porque ela muda com a
 *  régua da calibração — um texto escrito à mão passaria a mentir no primeiro
 *  ajuste.
 *
 *  CADA FRASE FOI CONFERIDA NO CÓDIGO antes de entrar aqui: `ponderar` e
 *  `para_score` (app/dominio/score.py), `impacto_do_recorte` e
 *  `denominador_do_mes` (app/banco/repositorio_score.py), e o histórico em
 *  `obter_recorte` (app/api/lentes.py). Nada aqui é suposição sobre o que a conta
 *  "deveria" ser.
 */

export interface TrechoDoGuia {
  termo: string;
  texto: string;
}

/** As seções da explicação, na ordem em que a pessoa encontra os números no
 *  painel: primeiro o número grande do topo, depois a coluna, depois os casos em
 *  que a célula não tem número.
 *
 *  `formula` é a do servidor, que já nomeia a régua em vigor; `temRecorte` troca
 *  a explicação da coluna, porque com um pedaço escolhido ela mostra a nota DELE e
 *  sem recorte mostra a da lente. */
export function guiaDoRecorte(formula: string, temRecorte: boolean): TrechoDoGuia[] {
  return [
    {
      termo: 'A nota, de 0 a 100',
      texto:
        `${formula} 50 é o neutro: tanto positivo quanto negativo. ` +
        'Abaixo de 50, o negativo pesou mais; acima, o positivo.',
    },
    {
      termo: 'O impacto, em pontos (o número grande deste painel)',
      texto:
        'Quanto este recorte tira (−) ou põe (+) na nota da lente no mês: ' +
        '50 × (positivas − negativas deste recorte) ÷ peso de TODOS os itens do mês ' +
        'na lente. O denominador é o do mês inteiro, e não o do recorte — é isso que ' +
        'faz as partes somarem o todo: somando o impacto de todos os pedaços de uma ' +
        'dimensão (todas as UFs, por exemplo) chega-se à distância entre a nota do ' +
        'mês e 50.',
    },
    {
      termo: temRecorte ? 'A coluna mês a mês (a nota deste recorte)' : 'A coluna mês a mês',
      texto: temRecorte
        ? 'Cada célula é a nota DESTE recorte naquele mês, medida só com as menções ' +
          'dele, pela mesma fórmula da nota da lente. É por isso que ela pode subir ' +
          'enquanto a nota da lente cai: são universos diferentes. NÃO é a variação ' +
          'de um mês para o outro.'
        : 'Cada célula é a nota da lente naquele mês — a mesma que o gráfico de ' +
          'Jornada desenha, estimativa incluída. NÃO é a variação de um mês para o ' +
          'outro.',
    },
    {
      termo: 'O número embaixo da nota',
      texto:
        'Quantas menções entraram na conta daquele mês. Serve para dar tamanho à ' +
        'nota: 100 com três menções e 100 com trezentas são coisas diferentes.',
    },
    {
      termo: 'Quando a célula mostra "—"',
      texto:
        'Ou o mês não tem menção deste recorte (e a célula diz "sem base"), ou as ' +
        'menções que existem não entram na régua em vigor — a régua "só Tier 1", por ' +
        'exemplo, zera as matérias de Tier 2 e 3. Nos dois casos não há nota a ' +
        'mostrar, e o traço é mais honesto que um zero.',
    },
  ];
}
