/** As formas e as constantes do formulário de agenda.
 *
 *  SÓ AS FORMAS E OS VALORES INICIAIS. O que a tela mostra está em
 *  `Cadastro.tsx`; o que ela envia, em `montarCorpo`. Aqui é o que se consulta
 *  o tempo todo enquanto se lê os dois.
 */

import { hojeLocal } from '@/dominio/formato';
import type { ArquivoDoMaterial, Frente } from '@/dominio/tipos';

// As 27 UFs saíram daqui: vêm de `catalogo.dicionarios.ufs`, montado a
// partir do domínio `abrangencia` do Postgres — o mesmo que recusa uma UF
// inválida na escrita. O formulário passa a oferecer exatamente o que o
// banco aceita, nem mais nem menos.

/* O MAPA DE BLOCO POR FRENTE SAIU JUNTO com a seção que ele governava.
   Ele existia para escolher qual conjunto de campos condicionais mostrar; sem
   a seção, não resta escolha a fazer. `form.extensao` continua no estado e
   viaja nos dois sentidos — o dado não depende deste mapa. */

export interface Formulario {
  frente: Frente;
  data_interacao: string;
  instituicao_id: string;
  interlocutor_id: string;
  unidade_negocio_id: string;
  esfera_id: string;
  //: Que tipo de encontro foi (Mídia, Reunião, Evento...) — ortogonal a
  //: `frente` (quem é a contraparte), não substitui. '' = não informado.
  formato_interacao_id: string;
  uf: string;
  //: `presencial`, `online` ou `hibrida`. '' = nao informado, como nos demais.
  modalidade: string;
  //: Endereco, sala, ou o link da chamada. Texto livre.
  local: string;
  tier: string;
  status: string;
  clima: string;
  resultado: string;
  iniciativa: string;
  relato: string;
  encaminhamentos: string;
  pendencias: string;
  observacoes: string;
  temas: number[];
  areas: number[];
  aegea: ParticipanteAegeaNoForm[];
  extensao: Record<string, string>;

  // -- o ciclo da agenda ---------------------------------------------------
  //
  // O formulario acompanha a agenda inteira, e nao um fato consumado: pedida,
  // planejada, confirmada ou declinada, realizada, e desdobrada em outra. Os
  // campos abaixo sao a metade PREVISTA — e e a distancia entre ela e o relato
  // que mede se o que se promete acontece.
  expectativa: string;
  clima_esperado: string;
  declinado_por: string;
  motivo_declinio: string;
  nota_situacao: string;
  origens: string[];
  //: Tres estados, e nao dois: '' e NAO INFORMADO, e some da tela como tal.
  //: Um `boolean` faria toda agenda antiga afirmar "nao preve desdobramento",
  //: que e uma decisao que ninguem tomou.
  preve_desdobramento: '' | 'sim' | 'nao';
  outraParte: ParticipanteNoForm[];
  materiais: MaterialNoForm[];
}

/** Alguem da Aegea nesta agenda.
 *
 *  PAPEL E PRESENCA VIAJAM JUNTOS com a pessoa. O backend guarda os tres em
 *  `ParticipacaoAegea`; mandar so o id faria toda participacao chegar como
 *  `porta_voz` sem presenca, e o salvamento seguinte apagaria o que a tela
 *  mostra.
 */
export interface ParticipanteAegeaNoForm {
  pessoa_aegea_id: string;
  //: 'porta_voz' fala pela companhia e conta no painel de exposicao; 'equipe'
  //: esteve na sala e nao conta. Sao papeis diferentes, nao graus.
  papel: string;
  //: '' = nao informado. Ver `PRESENCAS` — as mesmas dos dois lados.
  presenca: string;
}

/** Alguem da outra parte nesta agenda. */
export interface ParticipanteNoForm {
  interlocutor_id: string;
  //: '' = nao informado. Ver `PRESENCAS`.
  presenca: string;
  principal: boolean;
}

/** Um documento da agenda. */
export interface MaterialNoForm {
  //: Volta no PATCH para o backend NAO recriar o material — e o que preserva
  //: a identidade entre salvamentos. Material novo nao tem.
  id?: string;
  momento: string;
  titulo: string;
  url: string;
  observacao: string;
  //: O arquivo JA SUBIDO. O upload acontece antes de salvar a agenda, entao
  //: quando esta linha chega ao `PATCH` o byte ja esta no blob e so falta
  //: amarrar os dois.
  arquivo_id: string | null;
  //: Nome, tipo e tamanho, para a tela mostrar sem outra ida ao servidor.
  arquivo: ArquivoDoMaterial | null;
  //: De qual REFERENCIA da biblioteca esta linha veio. Nula no que a pessoa
  //: escreveu a mao — que continua sendo a maioria.
  //:
  //: E ela que permite desmarcar um assunto tirar de volta o que ele trouxe,
  //: sem levar junto o que a pessoa acrescentou.
  referencia_id: string | null;
  //: DE QUE ASSUNTOS O DOCUMENTO TRATA.
  //:
  //: O que a biblioteca traz ja vem com os dela; o que a pessoa acrescenta
  //: nasce com os da AGENDA — um documento produzido numa reuniao sobre tarifa
  //: trata de tarifa, e pedir que alguem repita a escolha logo abaixo de onde
  //: acabou de faze-la e trabalho sem resposta nova.
  temas: number[];
}

/** As tres presencas, com o rotulo que a pessoa le.
 *
 *  `ausente` e a mais valiosa das tres: uma reuniao em que o decisor nao
 *  apareceu nao e a reuniao que foi pedida, ainda que conste como realizada.
 */
export const PRESENCAS: { valor: string; rotulo: string }[] = [
  { valor: '', rotulo: 'Nao informado' },
  { valor: 'previsto', rotulo: 'Previsto' },
  { valor: 'presente', rotulo: 'Compareceu' },
  { valor: 'ausente', rotulo: 'Faltou' },
];

/** Os dois papeis de quem representa a Aegea.
 *
 *  So `porta_voz` conta no painel de exposicao (`interacao.py:326`). Marcar
 *  alguem como `equipe` nao e rebaixa-lo: e dizer que ele esteve na sala sem
 *  falar pela companhia, que e informacao diferente e igualmente util.
 */
export const PAPEIS: { valor: string; rotulo: string }[] = [
  { valor: 'porta_voz', rotulo: 'Porta-voz' },
  { valor: 'equipe', rotulo: 'Equipe' },
];

/** Os momentos do material, separados por SECAO da tela.
 *
 *  Uma lista so, com um seletor de momento em cada linha, poria numa caixa
 *  unica o que se leva e o que se traz — e quem preenche a agenda em dois
 *  instantes diferentes ficaria sem nada por perto que lembrasse qual e qual.
 *
 *  Sao os MESMOS tres valores do banco: a divisao e de tela, e nao inventa
 *  vocabulario nenhum.
 */
/** As duas etapas do formulário.
 *
 *  O CICLO DA AGENDA TEM DOIS MOMENTOS, e eles acontecem com dias ou semanas
 *  de distância. Quem abre o formulário de manhã para pedir uma reunião sabe
 *  com quem, quando e o que espera; não sabe o clima, o desfecho, nem o que
 *  ficou combinado. Numa tela só, metade dos campos pedia resposta para uma
 *  pergunta que ainda não tinha sido feita — e a pessoa rolava por eles duas
 *  vezes, na ida e na volta.
 *
 *  NÃO É UM ASSISTENTE de duas etapas: não há "próximo", e salvar de uma aba
 *  salva o registro inteiro. São duas vistas do mesmo formulário, e a pessoa
 *  troca quando quiser.
 *
 *  O QUE É OBRIGATÓRIO MORA TODO NA PRIMEIRA — data, instituição e UF. Nenhum
 *  campo da segunda impede salvar, que é o que permite criar a agenda antes de
 *  ela acontecer.
 */
export type Etapa = 'antes' | 'depois';

export const ABAS_DA_ETAPA: readonly { id: Etapa; rotulo: string }[] = [
  { id: 'antes', rotulo: 'Antes da reunião' },
  { id: 'depois', rotulo: 'Depois da reunião' },
];

//: A pilha de seções de uma aba. `display` é o que esconde, e não o atributo
//: `hidden`: um `display: flex` embutido venceria o `[hidden]` do navegador, e
//: a aba escondida apareceria assim mesmo.
export const COLUNA_DA_ETAPA = (visivel: boolean) =>
  ({
    display: visivel ? 'flex' : 'none',
    flexDirection: 'column',
    gap: 16,
  }) as const;

export const MOMENTOS_DE_PREPARACAO: { valor: string; rotulo: string }[] = [
  { valor: 'apoio', rotulo: 'Apoio' },
];

export const MOMENTOS_POS_REUNIAO: { valor: string; rotulo: string }[] = [
  { valor: 'obtido', rotulo: 'Obtido na reuniao' },
  { valor: 'produzido', rotulo: 'Produzido na reuniao' },
];


/** Os materiais de um conjunto de momentos, PRESERVANDO a ordem original.
 *
 *  Cada secao edita a sua fatia, e o salvamento remonta a lista inteira. Sem
 *  isto, salvar pela secao de preparacao mandaria uma lista sem os materiais
 *  pos-reuniao — e o repositorio, que remonta tudo, os apagaria.
 */
export function materiaisDe(
  materiais: MaterialNoForm[],
  momentos: { valor: string }[],
): MaterialNoForm[] {
  const conjunto = new Set(momentos.map((m) => m.valor));
  return materiais.filter((m) => conjunto.has(m.momento));
}

export const VAZIO: Formulario = {
  frente: 'imprensa',
  data_interacao: hojeLocal(),
  instituicao_id: '',
  interlocutor_id: '',
  unidade_negocio_id: '',
  esfera_id: '',
  formato_interacao_id: '',
  uf: '',
  modalidade: '',
  local: '',
  tier: '',
  //: SOLICITADO, e nao vazio nem `agendado`. Uma agenda recem-criada foi
  //: PEDIDA; dizer "agendado" afirmaria que existe data marcada com a outra
  //: parte, coisa que ninguem confirmou — e a distancia entre pedir e conseguir
  //: marcar e metade do que este painel existe para medir.
  status: 'solicitado',
  clima: '',
  resultado: '',
  iniciativa: '',
  relato: '',
  encaminhamentos: '',
  pendencias: '',
  observacoes: '',
  temas: [],
  areas: [],
  aegea: [],
  extensao: {},
  expectativa: '',
  clima_esperado: '',
  declinado_por: '',
  motivo_declinio: '',
  nota_situacao: '',
  origens: [],
  preve_desdobramento: '',
  outraParte: [],
  materiais: [],
};

//: O QUE O FORMULÁRIO OFERECE. Os outros códigos continuam válidos e
//: aparecem quando o registro já os tem — ver o campo "Situação".
export const SITUACOES_OFERECIDAS = ['solicitado', 'confirmada', 'declinado'];
