/** O que preencher em cada campo da agenda, um exemplo, e por que a
 *  plataforma pergunta — para quem abre "Nova interação" pela primeira vez e
 *  não quer sair da tela para descobrir o que cada campo espera.
 *
 *  TRÊS PARTES, e cada uma responde a uma pergunta diferente (mesmo desenho
 *  de `guiaDaCalibracao.ts`):
 *
 *      oQuePreencher   o que vai naquele campo, em português simples
 *      exemplo         um caso concreto, com nomes e números desta casa
 *      porQue          por que a plataforma pede isto — o que ele alimenta
 *
 *  `script` é a exceção: só os quatro campos de "Depois da reunião" que se
 *  preenchem a partir de uma transcrição ganham um texto pronto para colar
 *  numa IA, com botão de copiar.
 */

export interface VerbeteDoCampo {
  oQuePreencher: string;
  exemplo?: string;
  porQue?: string;
  /** Um script pronto para colar numa IA junto da transcrição da reunião. */
  script?: string;
}

/** Os campos do formulário de interação, por chave — a mesma chave passada a
 *  `AjudaDoCampo`. */
export const GUIA_DO_CADASTRO: Record<string, VerbeteDoCampo> = {
  area: {
    oQuePreencher:
      'Uma ou mais áreas da Aegea que esta interação envolve. Marque mais de uma quando a conversa atravessa mais de uma frente.',
    exemplo:
      'Uma reunião com o regulador que também trata de tarifa para investidores marca Governo e Investidores.',
    porQue:
      'É por área que o Painel soma exposição e o Base filtra a lista — sem nenhuma marcada, a interação não aparece em recorte nenhum por frente.',
  },
  data_interacao: {
    oQuePreencher: 'A data em que a interação aconteceu, ou está marcada para acontecer.',
    exemplo: '12/03/2026, mesmo que a reunião ainda não tenha sido confirmada.',
    porQue: 'É o eixo de tempo de toda a plataforma: Painel, Roadmap e Base agrupam por mês a partir dela.',
  },
  instituicao: {
    oQuePreencher:
      'Com quem a interação é. Comece a digitar o nome — a busca acha mesmo sem acento e por qualquer parte dele.',
    exemplo: 'Digite "ana" para achar a Agência Nacional de Águas, ou "folha" para a Folha de S.Paulo.',
    porQue:
      'É dela que vêm Categoria e Subcategoria do Público e a Relevância mostradas logo abaixo — e é ela, junto do Tipo de interação, que decide sozinha qual é a frente do registro.',
  },
  unidade_negocio: {
    oQuePreencher: 'A operação da Aegea envolvida nesta agenda.',
    exemplo: 'Aegea Rio, Prolagos, Saneago…',
    porQue:
      'Se o assunto é da holding, sem unidade específica, deixe em "Holding / corporativo" — não force uma unidade que não é dona do tema.',
  },
  uf_interacao: {
    oQuePreencher: 'O estado onde a interação acontece.',
    exemplo: 'SP para uma reunião em São Paulo; NA para um assunto nacional; IN para um investidor internacional.',
    porQue:
      'É por UF que o Painel e o Base recortam geograficamente — sem ela, a interação não aparece em nenhum filtro de estado.',
  },
  temas: {
    oQuePreencher: 'Um ou mais temas que descrevem o assunto da interação.',
    exemplo: 'Uma reunião sobre reajuste tarifário e obras de expansão marca Tarifa e Investimentos.',
    porQue:
      'É por tema que a Base e a busca de materiais encontram esta interação depois. Se nenhum tema existente encaixa, dá para criar um novo na Administração.',
  },
  participantes_aegea: {
    oQuePreencher:
      'Quem da Aegea esteve ou vai estar na conversa, o papel de cada um (porta-voz ou equipe) e se de fato compareceu.',
    exemplo: 'O diretor de Relações institucionais como porta-voz, e um analista como equipe de apoio.',
    porQue:
      'Só quem está marcado como porta-voz conta no painel de exposição — a equipe de apoio participa, mas não fala pela companhia.',
  },
  participantes_outra_parte: {
    oQuePreencher:
      'Quem representa a outra parte nesta conversa, com presença, e qual dessas pessoas é a principal.',
    exemplo: 'O secretário de meio ambiente como principal, e dois assessores como acompanhantes.',
    porQue:
      'Só aparecem aqui pessoas já cadastradas como interlocutoras desta instituição. Se faltar alguém, cadastre o contato primeiro, na Administração.',
  },
  modalidade: {
    oQuePreencher: 'Se a interação foi (ou será) presencial, online, ou híbrida.',
    exemplo: 'Híbrida quando parte da mesa está na sala e parte entra por chamada.',
    porQue:
      'É um dado próprio, e não dedução do endereço — sem ele, uma reunião pelo Teams e uma reunião numa sala de verdade pareceriam a mesma coisa nos números.',
  },
  local: {
    oQuePreencher:
      'Onde a interação acontece: o endereço e a sala, ou o link/plataforma quando é online.',
    exemplo: '"Ministério das Cidades, bloco A, 5º andar", ou "Teams".',
    porQue: 'Na híbrida, registre onde fica quem vai presencialmente.',
  },
  iniciativa: {
    oQuePreencher: 'Quem pediu esta agenda.',
    exemplo: 'A Aegea, quando é a companhia que busca a conversa; a outra parte, quando o convite vem de fora.',
    porQue:
      'Mede quem está puxando a relação — uma instituição que só aparece por iniciativa da Aegea é um sinal diferente de uma que também procura a companhia.',
  },
  situacao: {
    oQuePreencher: 'Em que pé está o convite: Solicitado, Aceito ou Negado.',
    exemplo: 'Solicitado logo que o pedido é feito; Aceito assim que a outra parte confirma.',
    porQue:
      'O que de fato aconteceu na reunião — se ela ocorreu como planejado, ou virou outra coisa — se registra depois, na aba "Depois". Misturar as duas perguntas aqui faria este campo virar uma lista de onze opções.',
  },
  nota_aceite: {
    oQuePreencher: 'Em que termos o convite foi aceito, quando isso importa.',
    exemplo: '"Só para março"; "com o diretor"; "condicionado à presença do regulador".',
  },
  quem_negou: {
    oQuePreencher: 'Quem recusou o convite: a Aegea ou a outra parte.',
  },
  motivo_declinio: {
    oQuePreencher: 'Por que o convite foi negado.',
    exemplo: '"Agenda do secretário lotada até o fim do trimestre."',
    porQue:
      'É o motivo que faltava nas planilhas antigas — 4 de 23 recusas tinham explicação registrada. Sem ele, uma recusa vira só um número.',
  },
  relevancia: {
    oQuePreencher: 'Não se escolhe aqui — vem pronta do cadastro da instituição.',
    porQue:
      'A relevância vale para toda interação com esta instituição, e não muda de uma reunião para outra. Para corrigi-la, altere o cadastro da instituição, não esta tela.',
  },
  clima_esperado: {
    oQuePreencher: 'Como você acha que a conversa vai ser, antes dela acontecer.',
    exemplo: 'Positivo, se a pauta é favorável à instituição; tenso, se envolve uma cobrança.',
    porQue:
      'É a previsão — o clima real, depois de a reunião acontecer, se registra na aba "Depois". Comparar os dois mostra se a expectativa bateu com o resultado.',
  },
  origens: {
    oQuePreencher: 'Marque quando esta agenda é desdobramento de outra que já aconteceu.',
    exemplo: 'Uma reunião de follow-up que nasceu de um pedido feito numa reunião anterior com o mesmo órgão.',
    porQue:
      'É o que liga o histórico de uma relação — sem essa marca, o Roadmap mostra duas conversas soltas em vez de uma sequência.',
  },
  expectativa: {
    oQuePreencher: 'O que precisa sair desta reunião para ela ter valido a pena.',
    exemplo: '"Confirmar o cronograma da obra e alinhar a nota à imprensa."',
    porQue:
      'É o que dá para comparar com o Desfecho depois — sem uma expectativa registrada antes, não dá para dizer se a reunião entregou o que se esperava dela.',
  },
  materiais_preparacao: {
    oQuePreencher: 'O material que se leva para a reunião: apresentação, nota técnica, dossiê.',
    exemplo: 'A apresentação institucional e a nota técnica sobre o reajuste.',
    porQue:
      'Fica separado do material de depois porque são momentos diferentes: o que se leva se junta antes de a reunião acontecer, e não muda depois dela.',
  },
  materiais_pos: {
    oQuePreencher:
      'O que saiu da reunião: o que a outra parte entregou (obtido) e o que a Aegea escreveu depois (produzido).',
    exemplo: 'A ata assinada pelo órgão (obtido) e o resumo executivo interno (produzido).',
    porQue:
      'Separado do material de preparação pelo mesmo motivo: um documento datado de antes da reunião conta uma história diferente de um datado de depois.',
  },

  /* -- consulta recebida ---------------------------------------------------- */

  consulta_canal: {
    oQuePreencher: 'Por onde a consulta chegou.',
    exemplo: 'E-mail, ofício, telefone…',
  },
  consulta_prazo: {
    oQuePreencher: 'Até quando a resposta precisa ser enviada, quando há prazo definido.',
  },
  consulta_respondida: {
    oQuePreencher: 'A data em que a resposta foi de fato enviada.',
    porQue: 'É o que permite medir o tempo de resposta, comparado ao prazo.',
  },
  consulta_remetente: {
    oQuePreencher: 'Quem mandou a consulta — nome ou e-mail, quando a pessoa ainda não é um contato cadastrado.',
  },
  consulta_teor: {
    oQuePreencher: 'Cole o texto da pergunta, como veio no e-mail ou ofício.',
    porQue:
      'É o registro literal do que foi perguntado — a interpretação e a premissa entram nos dois campos seguintes, separadas do fato.',
  },
  consulta_motivo: {
    oQuePreencher:
      'Sua hipótese sobre por que perguntaram isso — não é um fato, é a leitura de quem recebeu.',
    exemplo: '"Quer justificar revisão de spread"; "está montando relatório setorial".',
    porQue:
      'Fica separado da alegação porque uma é suposição e a outra é o que a pergunta de fato diz — misturar as duas apresentaria a suposição com a mesma autoridade de um fato registrado.',
  },
  consulta_alegacao: {
    oQuePreencher:
      'A premissa que a pergunta dá como fato, na voz de quem pergunta — marque uma já existente ou cadastre uma nova.',
    exemplo: '"O Banco X não renegociaria a dívida…"',
    porQue:
      'É a mesma alegação que se repete de remetente para remetente, e é ela que mostra o movimento — um texto novo a cada consulta faria o mesmo boato parecer três fatos diferentes.',
  },

  /* -- detalhes por frente --------------------------------------------------- */

  formato_atendimento_imprensa: {
    oQuePreencher: 'Que tipo de atendimento de imprensa foi este.',
    exemplo: 'Entrevista individual, coletiva, resposta a pauta, release…',
    porQue:
      'Diferente do "Tipo de interação" lá em cima: ali é a natureza do encontro (Mídia, Reunião…); aqui é o formato específico do atendimento à imprensa.',
  },
  data_atendida: {
    oQuePreencher: 'Quando o atendimento ao jornalista de fato aconteceu.',
  },
  data_publicacao: {
    oQuePreencher: 'Quando a matéria saiu publicada, se já saiu.',
  },
  link_materia: {
    oQuePreencher: 'O link da matéria publicada.',
  },
  mensagens_chave: {
    oQuePreencher: 'As mensagens que a Aegea levou para este atendimento, separadas por ponto e vírgula.',
    exemplo: '"Investimento recorde em 2026; Redução de perdas na região X."',
  },
  cargo_interlocutor: {
    oQuePreencher: 'O cargo de quem representou a instituição — além do nome, já registrado em "Quem participou".',
    exemplo: 'Secretário-executivo, assessor de imprensa…',
  },
  nome_evento: {
    oQuePreencher: 'O nome do evento em que esta participação aconteceu.',
    exemplo: '"Fórum Nacional de Saneamento 2026".',
  },
  casa_legislativa: {
    oQuePreencher: 'A casa legislativa de onde vem a proposição.',
    exemplo: 'Câmara dos Deputados, Senado, uma assembleia estadual…',
  },
  tramitacao: {
    oQuePreencher: 'Em que fase de tramitação a proposição está.',
    exemplo: 'Em comissão, aguardando pauta no plenário, aprovada…',
  },
  prioridade_legislativa: {
    oQuePreencher: 'O quanto esta proposição importa acompanhar de perto.',
    exemplo: 'Alta para um projeto que muda a regra tarifária; monitoramento para algo distante do negócio.',
  },
  ementa: {
    oQuePreencher: 'O resumo oficial da proposição.',
  },
  tipo_investidor: {
    oQuePreencher: 'Que tipo de investidor é a outra parte desta conversa.',
    exemplo: 'Institucional, pessoa física, fundo…',
  },
  formato_atendimento_investidores: {
    oQuePreencher: 'Que tipo de encontro foi este, dentro do relacionamento com investidores.',
    exemplo: 'Call de resultados, roadshow, reunião individual…',
  },
  natureza_interna: {
    oQuePreencher: 'A natureza desta demanda interna.',
    exemplo: 'Interno, externo ou misto.',
  },
  cumprimento_interna: {
    oQuePreencher: 'Se esta demanda é um pedido ainda em aberto ou uma entrega já feita.',
  },
  complexidade_interna: {
    oQuePreencher: 'O quanto esta demanda interna é complexa de resolver.',
  },
  prazo_dias: {
    oQuePreencher: 'Em quantos dias esta demanda precisa ser respondida.',
  },

  /* -- depois da reunião ------------------------------------------------------ */

  relato: {
    oQuePreencher: 'O que foi dito na reunião — os principais pontos abordados e o tom geral da conversa, sem opinião.',
    exemplo: '"A secretária confirmou que o projeto de lei entra em pauta em abril e pediu dados sobre o impacto tarifário."',
    porQue: 'É o registro objetivo do que aconteceu — a leitura e o desdobramento entram nos campos ao lado, separados do fato.',
    script:
      'A partir da transcrição da reunião abaixo, escreva um RELATO objetivo do que foi discutido: os principais pontos abordados, o que cada parte disse e o tom geral da conversa. Sem opinião — só o que de fato foi dito.\n\nTranscrição:\n[colar aqui]',
  },
  encaminhamentos: {
    oQuePreencher:
      'O que ficou combinado como próximo passo: quem é responsável por cada ação, até quando, e qualquer repercussão relevante.',
    exemplo: '"Enviar a nota técnica até 20/03 — responsável: Jurídico. O secretário se comprometeu a agendar nova reunião em abril."',
    porQue: 'É o que vira cobrança depois — sem este registro, um compromisso feito em reunião se perde na memória de quem estava lá.',
    script:
      'A partir da transcrição da reunião abaixo, liste os ENCAMINHAMENTOS combinados: o que ficou definido como próximo passo, quem ficou responsável por cada ação e até quando. Inclua também qualquer repercussão relevante (reações, compromissos assumidos).\n\nTranscrição:\n[colar aqui]',
  },
  pendencias: {
    oQuePreencher: 'O que ficou em aberto, sem resposta definitiva, ou que depende de uma ação futura de qualquer uma das partes.',
    exemplo: '"Aguardando posição da diretoria sobre o pedido de prazo."',
    porQue: 'Diferente de um encaminhamento: aqui ainda não há combinado, só uma questão sem resposta.',
    script:
      'A partir da transcrição da reunião abaixo, liste as PENDÊNCIAS: o que ficou em aberto, sem resposta definitiva, ou que depende de uma ação futura de qualquer uma das partes.\n\nTranscrição:\n[colar aqui]',
  },
  observacoes: {
    oQuePreencher:
      'Contexto informal, sinais do clima da conversa, ou alertas para quem for ler o registro depois — o que não cabe num relato formal.',
    exemplo: '"O assessor comentou, fora de pauta, que há pressão política para acelerar a obra."',
    porQue: 'É espaço para o que não é fato registrável no relato, mas ajuda quem ler depois a entender o contexto.',
    script:
      'A partir da transcrição da reunião abaixo, escreva OBSERVAÇÕES gerais que não caibam num relato formal: contexto informal, sinais do clima da conversa, alertas para quem for ler o registro depois.\n\nTranscrição:\n[colar aqui]',
  },
  clima_desfecho: {
    oQuePreencher: 'Como a conversa de fato foi, depois de ela acontecer.',
    porQue: 'É o par do "Clima esperado", registrado antes — comparar os dois mostra se a expectativa bateu com a realidade.',
  },
  desfecho_resultado: {
    oQuePreencher: 'Como esta interação terminou, em relação ao objetivo dela.',
    exemplo: 'Atendido, parcialmente atendido, sem avanço…',
  },
  desdobramento: {
    oQuePreencher:
      'Se esta interação prevê continuidade — uma próxima conversa, um compromisso que ainda vai gerar outro encontro.',
    porQue: 'É o que faz uma futura agenda poder ser marcada como vinda desta, em "Veio de outras interações?".',
  },
};

/** Os formatos de "Tipo de interação" (`catalogo.dicionarios.formatos_interacao`),
 *  por nome — a tabela que a Aegea usa para explicar a diferença entre eles. */
export const GUIA_DOS_FORMATOS: Record<string, VerbeteDoCampo> = {
  Mídia: {
    oQuePreencher: 'Qualquer contato cuja contraparte é veículo ou jornalista, com potencial de publicação.',
    exemplo: 'Entrevista individual, coletiva, resposta a demanda de pauta, encontro de relacionamento com jornalista.',
  },
  'Agenda de mercado': {
    oQuePreencher: 'Formatos regidos por calendário societário ou por estrutura da operação financeira.',
    exemplo: 'Call de resultados, roadshow, conference, processo de rating, assembleia de credores.',
  },
  'Agenda pública': {
    oQuePreencher: 'Instância formal com registro público ou plateia institucional.',
    exemplo: 'Audiência pública, consulta pública, sessão legislativa, comissão.',
  },
  'Manifestação formal': {
    oQuePreencher: 'Interação documental, sem encontro.',
    exemplo: 'Ofício, carta institucional, nota, resposta a requerimento, envio de material técnico.',
  },
  Evento: {
    oQuePreencher: 'Participação em evento de terceiro ou evento próprio.',
    exemplo: 'Palestra, painel, congresso, inauguração, presença institucional.',
  },
  Visita: {
    oQuePreencher: 'Deslocamento a unidade, obra ou operação.',
    exemplo: 'Visita de investidor a ativo, visita de autoridade a obra, visita de imprensa a estação.',
  },
  Reunião: {
    oQuePreencher: 'Encontro bilateral ou multilateral com pauta definida, e contato informal com conteúdo relevante.',
    exemplo: 'Reunião com regulador, reunião com investidor, grupo de trabalho, café de relacionamento.',
  },
  'Consulta recebida': {
    oQuePreencher: 'Uma pergunta que chegou de fora — imprensa, investidor, órgão — pedindo uma resposta da Aegea.',
    exemplo: 'E-mail de jornalista pedindo posicionamento; ofício de órgão pedindo esclarecimento.',
    porQue: 'Escolher este tipo abre um bloco próprio mais abaixo, para registrar o que perguntaram e a premissa por trás da pergunta.',
  },
};

export function verbeteDoCadastro(chave: string): VerbeteDoCampo | null {
  return GUIA_DO_CADASTRO[chave] ?? null;
}

export function verbeteDoFormato(nome: string): VerbeteDoCampo | null {
  return GUIA_DOS_FORMATOS[nome] ?? null;
}
