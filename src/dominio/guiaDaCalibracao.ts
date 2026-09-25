/** O que cada parâmetro da Calibração faz, e o que ele muda no número.
 *
 *  ESTA TELA É A ÚNICA QUE MEXE NO QUE TODO MUNDO LÊ. Um peso ajustado aqui
 *  reescreve o índice de todos os meses, inclusive os já citados em reunião; um
 *  limite mexido reescreve as frases das cinco lentes. Quem abre a Calibração
 *  precisa saber, antes de tocar no campo, o que vai acontecer com o número — e
 *  "Régua de tier" não diz isso.
 *
 *  POR QUE O TEXTO MORA NO FRONT, e não no servidor que manda os limites: é
 *  redação de tela, e muda sem migration — a mesma razão que já põe
 *  `ROTULO_DA_REGUA_DE_TIER` aqui. O servidor manda o valor, o padrão e o
 *  formato; o significado é conversa com quem lê.
 *
 *  TRÊS PARTES, e cada uma responde a uma pergunta diferente:
 *
 *      oQueE      o que este número é, em português
 *      comoAfeta  o que muda NO RESULTADO quando ele sobe ou desce
 *      exemplo    um caso concreto, com números desta casa
 *
 *  `comoAfeta` é a que existe para esta tela. Um campo de calibração sem ela
 *  informa o que a pessoa já via no rótulo e esconde justamente o que ela
 *  precisa para decidir.
 */

export interface VerbeteDoParametro {
  titulo: string;
  oQueE: string;
  comoAfeta: string;
  exemplo?: string;
  /** O que a pessoa precisa saber ANTES de gravar — some do lugar da conversa
   *  e vira consequência. */
  aviso?: string;
}

/** Os parâmetros da régua de ponderação e da Visão geral. */
export const GUIA_DA_CALIBRACAO: Record<string, VerbeteDoParametro> = {
  regua_tier: {
    titulo: 'Relevância do veículo',
    oQueE:
      'Quanto vale uma matéria conforme o porte do veículo que a publicou. Cada menção de imprensa entra na conta multiplicada por este peso, e não como uma unidade.',
    comoAfeta:
      'Quanto mais forte a régua, mais o índice responde ao que sai nos grandes veículos e menos ao volume de publicações pequenas. Vale para Imprensa e Mercado; as outras três lentes não usam tier e não mudam. E só move o número quando a fonte MISTURA tiers: se as matérias do mês são todas do mesmo tier, o multiplicador aparece em cima e embaixo da razão e se cancela.',
    exemplo:
      'Com 10 · 5 · 1, uma negativa no Valor pesa dez vezes uma de blog local. Com 1 · 1 · 1, as duas valem igual — e um mês de muitas notas pequenas passa a mover o índice tanto quanto uma capa.',
    aviso:
      'Trocar a régua recalcula TODOS os meses, inclusive os que já foram citados. É de propósito: é o que mantém a curva comparável.',
  },
  regua_engajamento: {
    titulo: 'Engajamento',
    oQueE:
      'O que se soma de cada menção de rede social: uma unidade, o engajamento bruto, o logaritmo dele, ou o peso do cargo de quem postou.',
    comoAfeta:
      'Decide se um post que viralizou conta como um ou como dez mil. No bruto, um único post grande pode definir o mês sozinho; no logaritmo, ele pesa mais que os outros sem apagá-los; em "cada menção vale 1", só o número de vozes conta. Vale para Sociedade digital e Clientes: onde a fonte não tem engajamento — clipping de imprensa, interação de CRM — cada menção vale 1, e a lente continua no índice como estava.',
    exemplo:
      'Um post com 50 mil interações vale 1 na régua simples, cerca de 5,7 no logaritmo, e 50 mil no bruto — onde ele passa a valer mais que todo o resto do mês somado.',
    aviso:
      'A escolha é por fonte e por mês: uma fonte que não registrou engajamento naquele mês é contada por menções, e não zerada. Sem isso, escolher o bruto tirava quatro das cinco lentes do índice em junho de 2026 — e o número que sobrava era a Sociedade digital sozinha.',
  },
  pesos: {
    titulo: 'Peso de cada lente',
    oQueE:
      'Quanto cada família de stakeholder vale no Índice de Saúde Reputacional. Os cinco pesos somam 100.',
    comoAfeta:
      'É a declaração de quem a companhia considera que importa mais. Subir Imprensa faz o índice seguir a cobertura; subir Clientes o faz seguir o atendimento. O índice é a média ponderada por estes números — nada mais.',
    exemplo:
      'Com Imprensa em 30 e Clientes em 15, uma queda de 10 pontos na Imprensa derruba o índice 3 pontos; a mesma queda em Clientes derruba 1,5.',
    aviso:
      'Uma lente sem dado no mês SAI da conta, e os pesos se redistribuem entre as que sobraram. Por isso a tela mostra o peso efetivo ao lado do nominal: com uma lente fora, 30 de 70 valem 43%.',
  },
  fontes: {
    titulo: 'Ligar e desligar fontes',
    oQueE:
      'Quais fornecedores entram na leitura. Desligar uma fonte tira o dado dela do cálculo sem apagar o histórico — o arquivo continua importado.',
    comoAfeta:
      'Serve para responder "e se este fornecedor não existisse". Com todas as fontes de uma lente desligadas, a lente inteira sai do índice e o peso dela se redistribui.',
    aviso:
      'Desligar não é o mesmo que apagar: religar devolve o número na hora, sem reimportar nada.',
  },
  radial_por_peso: {
    titulo: 'Largura da fatia no gráfico radial',
    oQueE:
      'Se a fatia de cada lente no gráfico da Visão geral tem a largura do peso dela, ou se todas as fatias ficam iguais. O comprimento da fatia é sempre a nota.',
    comoAfeta:
      'Não muda número nenhum — muda o que o gráfico afirma. Com fatias iguais, uma lente de peso 15 ocupa tanto espaço quanto a de 30, e o desenho esconde a ponderação que a média aplicou.',
  },
};

/** Os oito cortes dos detectores de sinal, por chave.
 *
 *  O SERVIDOR JÁ MANDA uma frase curta por limite, e ela continua embaixo do
 *  campo. O que está aqui é a outra metade: o que acontece com as FRASES DA
 *  LENTE quando o número sobe ou desce. */
export const GUIA_DOS_LIMITES: Record<string, VerbeteDoParametro> = {
  pico_desvios: {
    titulo: 'Pico · desvios',
    oQueE:
      'Quantos desvios-padrão acima da média um mês precisa ter de volume para ser chamado de pico.',
    comoAfeta:
      'Baixar faz mais meses virarem pico, e "o maior volume do período" aparece quase todo mês — o que esvazia a palavra. Subir deixa só o mês realmente fora da curva. Vale junto com a razão mínima: as duas condições precisam passar.',
    exemplo:
      'Em 1,5, junho com 8.358 menções sobre uma média de 2.700 dispara. Em 3,0, só um mês perto do triplo do normal disparia.',
  },
  pico_razao_minima: {
    titulo: 'Pico · razão mínima',
    oQueE: 'Quantas vezes a média mensal o maior mês precisa ser.',
    comoAfeta:
      'É a trava que impede uma série muito regular de produzir pico por qualquer solavanco. Numa lente estável, qualquer mês vira 1,5 desvio; esta condição exige que ele também seja grande em termos absolutos.',
  },
  virada_pontos: {
    titulo: 'Virada · pontos de nota',
    oQueE:
      'Quantos pontos a nota da lente precisa andar de um mês para o outro para virar manchete.',
    comoAfeta:
      'É o limite que mais mexe na manchete das lentes, porque a virada tem precedência sobre todo o resto. Baixar faz quase todo mês abrir com "a nota subiu/caiu"; subir deixa a manchete para os sinais de composição.',
    aviso:
      'A troca de lado do saldo dispara a virada mesmo abaixo deste limite: sair de saldo positivo para negativo é mudança de natureza, e não de grau.',
  },
  deslocamento_pp: {
    titulo: 'Deslocamento · pontos percentuais',
    oQueE:
      'Quanto a fatia negativa precisa recuar — ou subir — para virar sinal. O mesmo número serve à alta do negativo, ao recuo desde o pico, ao teor e à recuperação da taxa de resposta.',
    comoAfeta:
      'É o limite de maior alcance: ele rege quatro detectores de uma vez. Baixar enche a lista de movimentos pequenos; subir pode deixar a lente sem nenhum sinal de melhora, mesmo quando ela melhorou.',
  },
  tendencia_meses: {
    titulo: 'Tendência · meses seguidos',
    oQueE:
      'Quantos meses na mesma direção formam uma tendência. A sequência conta meses COM LEITURA: um mês sem base não interrompe nem preenche.',
    comoAfeta:
      'Em 3, três meses de queda já viram "o negativo cai há 3 meses seguidos". Em 4 ou 5, a frase fica rara e mais forte quando aparece — ao custo de demorar a reconhecer uma virada de rumo.',
  },
  concentracao_razao: {
    titulo: 'Concentração · razão',
    oQueE:
      'Quantas vezes o primeiro colocado de um ranking precisa valer o segundo para a concentração virar sinal.',
    comoAfeta:
      'Responde "uma unidade sozinha domina a conversa?". Quando não dispara, o detector cai na regra do topo — os três primeiros somados.',
    exemplo:
      'Em 3, a Corsan com 7,9× o volume da segunda dispara folgado. Em 8, a mesma concentração passaria a ser lida como normal.',
  },
  concentracao_top3: {
    titulo: 'Concentração · topo',
    oQueE:
      'Quanto do volume os três primeiros precisam somar, em porcento, quando a razão entre primeiro e segundo não dispara.',
    comoAfeta:
      'É a segunda forma de dizer "a conversa está concentrada". Baixar para 40% faz quase todo ranking disparar, porque três de seis itens costumam passar disso; subir para 70% deixa o sinal só para a concentração real.',
  },
  max_sinais: {
    titulo: 'Sinais na lista',
    oQueE:
      'Quantos sinais o bloco do fim de cada lente mostra. As lacunas de dado não ocupam vaga: elas entram sempre, no fim.',
    comoAfeta:
      'Não muda o que os detectores acham — muda quanto disso chega à tela. Cortar para 3 deixa só o mais intenso de cada lente; abrir para 8 mostra tudo, ao custo de a lista deixar de ser uma leitura e virar um inventário.',
  },
};

/** Todo parâmetro que a tela desenha tem verbete? É o que impede um campo novo
 *  de entrar sem explicação — e é exatamente o campo novo que ninguém entende. */
export function verbeteDe(chave: string): VerbeteDoParametro | null {
  return GUIA_DOS_LIMITES[chave] ?? GUIA_DA_CALIBRACAO[chave] ?? null;
}
