/** Os tipos do domínio, espelhando os contratos do backend.
 *
 *  Mesma linguagem ubíqua dos dois lados: `frente`, `tier`, `esfera`,
 *  `porta_voz`, `recorte`. Atravessar a fronteira não exige traduzir nada.
 */

export const FRENTES = [
  'imprensa',
  'governo',
  'parceiros',
  'eventos',
  'investidores',
  'legislativo',
  'interna',
  'bancos_credores',
] as const;

export type Frente = (typeof FRENTES)[number];

export type GrupoDeStatus = 'resolvido' | 'aberto' | 'declinado';

export type Papel = 'porta_voz' | 'equipe';

export interface Participacao {
  pessoa_aegea_id: string;
  papel: Papel;
  //: Nulo = não informado. Os MESMOS valores da outra parte: quem representa a
  //: Aegea também pode faltar a uma reunião que aconteceu.
  //:
  //: Viaja em toda gravação: mandar a participação sem ele apagaria a presença
  //: já registrada.
  presenca: string | null;
}

/** Alguém da outra parte numa agenda — o principal inclusive.
 *
 *  UMA lista, e não "o interlocutor" mais "os demais": fora dela, o principal
 *  seria o único sem lugar para ter presença.
 */
export interface ParticipanteDaOutraParte {
  interlocutor_id: string;
  /** `previsto`, `presente`, `ausente` — ou `null`, não informado. */
  presenca: string | null;
  /** Quem representa a outra parte. No máximo um por agenda. */
  principal: boolean;
}

/** O arquivo de um material, guardado no Blob.
 *
 *  Sem o caminho no contêiner: quem monta a tela não tem o que fazer com ele,
 *  e dizer onde o byte mora é contar como o armazenamento é organizado.
 */
export interface ArquivoDoMaterial {
  id: string;
  nome: string;
  tipo_conteudo: string;
  /** Em bytes. */
  tamanho: number;
}

/** Um documento da agenda: um link, ou um arquivo guardado aqui. */
export interface Material {
  /** Volta no salvamento para o servidor NÃO recriar o material. */
  id: string | null;
  /** `apoio` (antes da reunião), `obtido` ou `produzido` (depois). */
  momento: string;
  titulo: string;
  url: string | null;
  observacao: string | null;
  /** Nulo quando o material é um LINK. Os dois caminhos convivem. */
  arquivo: ArquivoDoMaterial | null;
  /** De qual referência da biblioteca este material veio. Nulo no que a pessoa
   *  escreveu à mão — que continua sendo a maioria. */
  referencia_id: string | null;
  /** De que assuntos o documento trata. É o que faz a busca por assunto ser a
   *  mesma nas duas procedências — o oficial e o que saiu da reunião. */
  temas: number[];
}

/** Campos específicos de frente. Só um conjunto vem preenchido por vez. */
export interface Extensao {
  // imprensa
  formato?: string | null;
  data_atendida?: string | null;
  data_publicacao?: string | null;
  link_materia?: string | null;
  mensagens_chave?: string[];
  // institucional (governo, parceiros, eventos)
  natureza_orgao?: string | null;
  cargo_interlocutor?: string | null;
  nome_evento?: string | null;
  // legislativo
  casa?: string | null;
  tramitacao?: string | null;
  prioridade?: string | null;
  ementa?: string | null;
  // investidores
  tipo_investidor?: string | null;
  // interna
  natureza?: string | null;
  cumprimento?: string | null;
  complexidade?: string | null;
  prazo_dias?: number | null;
  data_retorno?: string | null;
}

export interface Interacao {
  id: string;
  frente: Frente;
  data_interacao: string;
  instituicao_id: string;
  interlocutor_id: string | null;
  unidade_negocio_id: number | null;
  esfera_id: number | null;
  /** Que tipo de encontro foi (Mídia, Reunião, Evento...) — ortogonal a
   *  `frente` (quem é a contraparte), não substitui. `null` = não informado. */
  formato_interacao_id: number | null;
  uf: string;
  /** `presencial`, `online` ou `hibrida`. `null` = não informado. */
  modalidade: string | null;
  /** Onde a agenda acontece, em palavras: endereço, sala, ou o link. */
  local: string | null;
  tier: number | null;
  stakeholder_id: number | null;
  status: string;
  clima: string | null;
  resultado: string | null;
  iniciativa: string | null;
  /** O assunto em palavras. NULO no que foi criado pela tela depois da 0013 —
   *  ali quem diz o assunto sao `temas` e `expectativa`. Preenchida no que veio
   *  da planilha. Para exibir, use `tituloDaAgenda`. */
  pauta: string | null;
  posicionamento: string | null;
  relato: string | null;
  encaminhamentos: string | null;
  pendencias: string | null;
  observacoes: string | null;
  registro_url: string | null;
  extensao: Extensao | null;
  temas: number[];
  /** Áreas internas da Aegea que participaram da interação. Mesmo dicionário
   *  de `PessoaAegea.area_id` (`catalogo.dicionarios.areas_pessoa`). */
  areas: number[];
  participacoes: Participacao[];

  // -- o ciclo da agenda ----------------------------------------------------
  //
  // A interação é uma agenda inteira, e não o registro de um fato consumado:
  // pedida, planejada, confirmada ou declinada, realizada, e desdobrada em
  // outra.
  //
  // TODOS ANULÁVEIS, e `null` quer dizer NÃO INFORMADO — nunca "não". Os
  // registros que vieram de planilha não responderam nada disto, e tratá-los
  // como negativa inventaria decisões que ninguém tomou.
  /** O que se esperava, escrito ANTES. Compare com `relato`. */
  expectativa: string | null;
  /** O clima previsto, na MESMA escala de `clima` (o real). */
  clima_esperado: string | null;
  /** `aegea` ou `outra_parte`. Declinar é escolha; ser declinado, porta fechada. */
  declinado_por: string | null;
  motivo_declinio: string | null;
  /** Em que condições a agenda foi aceita. O outro lado é `motivo_declinio`. */
  nota_situacao: string | null;
  /** DE QUAIS agendas esta decorre. Vazio = nasceu sozinha.
   *
   *  Plural: duas reuniões podem levar juntas a uma terceira, e uma reunião
   *  pode abrir várias frentes. Com um pai só, o caso "a agência e a bancada
   *  levaram a esta" perderia uma das duas.
   */
  origens: string[];
  /** QUANTAS agendas decorrem desta. Só leitura — quem grava o elo é a que
   *  descende.
   *
   *  Vem do servidor, e não contada na tela: a descendente pode estar fora do
   *  recorte carregado, e contar só o que a tela vê diria "não faz parte de
   *  cadeia" para uma agenda que faz.
   */
  derivadas: number;
  /** Só a intenção de continuidade. `null` = não informado. */
  preve_desdobramento: boolean | null;
  outra_parte: ParticipanteDaOutraParte[];
  materiais: Material[];
  fonte: string;
  visivel: boolean;
  criado_por: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
}

export interface PaginaDeInteracoes {
  itens: Interacao[];
  total: number;
  pagina: number;
  tamanho: number;
  paginas: number;
  filtros_ativos: number;
}

/* -- dicionários ---------------------------------------------------------- */

export interface ItemDeDicionario {
  id: number;
  codigo: string;
  nome: string;
  ordem: number;
}

export interface FrenteDoDicionario extends ItemDeDicionario {
  cor_hex: string;
}

export interface StatusDoDicionario extends ItemDeDicionario {
  grupo: GrupoDeStatus;
}

export interface FormatoDoDicionario extends ItemDeDicionario {
  escopo: 'imprensa' | 'investidores' | 'geral';
}

/** Uma das 10 categorias da taxonomia de públicos — mora em
 *  `Instituicao.categoria_publico_id`, não em `Interacao`.
 *
 *  `padrao_de_quebra` descreve COMO esta categoria se subdivide — não é ela
 *  quem lista as subcategorias (isso vem de `subcategorias_publico`,
 *  filtrado por `categoria_publico_id`), só diz que tipo de eixo esperar
 *  quando `padrao_de_quebra !== 'sem_quebra'`.
 *
 *  `area_dona_id` é nulo só em "Parceiros e Cadeia de Valor": ali a área
 *  responsável é quem demandou a interação, variável por instituição — não
 *  fixa por categoria como nas outras nove. */
export interface CategoriaPublicoDoDicionario extends ItemDeDicionario {
  padrao_de_quebra:
    | 'esfera'
    | 'logica_de_relacao'
    | 'posicao_de_capital'
    | 'logica_editorial'
    | 'sem_quebra';
  area_dona_id: number | null;
}

/** A subdivisão dentro de uma categoria (Federal/Estadual/Municipal...).
 *  `codigo` se repete entre categorias diferentes de propósito ("federal"
 *  aparece em Poder Executivo, Poder Legislativo e Reguladores) — a chave
 *  real é `(categoria_publico_id, codigo)`, nunca `codigo` sozinho. */
export interface SubcategoriaPublicoDoDicionario extends ItemDeDicionario {
  categoria_publico_id: number;
}

export interface Tema {
  id: number;
  nome: string;
  /** Do mais restrito ao mais aberto. `gerais` se chamava `livre` até a
   *  migração 0022 — o código mudou junto com o rótulo. */
  nivel: 'sensivel' | 'estrategico' | 'gerais';
}

export interface UnidadeDeNegocio {
  id: number;
  nome: string;
  ordem: number;
}

/** Um nível de relevância — o que o painel chama de "tier".
 *
 *  O `id` é o PRÓPRIO número do tier, e não uma sequência interna: é ele que
 *  vai em `Interacao.tier`, aparece na tela e sai na exportação.
 */
export interface Relevancia {
  id: number;
  nome: string;
  ordem: number;
}

/** UF, ou um dos dois valores que o mapa trata à parte (`NA`, `IN`). */
export interface Abrangencia {
  codigo: string;
  nome: string;
}

/** Grupo de status: sustenta a taxa de resolutividade. */
export interface GrupoDeStatusDoDicionario {
  codigo: string;
  nome: string;
}

/** Tudo o que o filtro do painel oferece.
 *
 *  NENHUMA opção de filtro pode estar escrita no código desta pasta: toda lista
 *  sai daqui, e este objeto vem de `GET /api/dicionarios`. Uma linha nova num
 *  dicionário do banco aparece na próxima carga da tela, sem build nem deploy.
 */
export interface Dicionarios {
  frentes: FrenteDoDicionario[];
  relevancias: Relevancia[];
  ufs: Abrangencia[];
  grupos_de_status: GrupoDeStatusDoDicionario[];
  status: StatusDoDicionario[];
  /** Mídia, Agenda de mercado, Agenda pública... — ver
   *  `Interacao.formato_interacao_id`. NÃO é o mesmo dicionário que
   *  `formatos` (formato de atendimento de imprensa/RI, escopado por
   *  frente) — são conceitos diferentes, com nomes parecidos. */
  formatos_interacao: ItemDeDicionario[];
  esferas: ItemDeDicionario[];
  climas: (ItemDeDicionario & { cor_hex: string })[];
  resultados: (ItemDeDicionario & { cor_hex: string })[];
  iniciativas: ItemDeDicionario[];
  formatos: FormatoDoDicionario[];
  naturezas_orgao: ItemDeDicionario[];
  casas: ItemDeDicionario[];
  tramitacoes: ItemDeDicionario[];
  tipos_investidor: ItemDeDicionario[];
  stakeholders: ItemDeDicionario[];
  /** De onde quem representa a Aegea fala — Comunicação, Relações
   *  Institucionais etc. Ver `PessoaAegea.area_id`. */
  areas_pessoa: ItemDeDicionario[];
  unidades_negocio: UnidadeDeNegocio[];
  temas: Tema[];
  /** As 10 categorias da taxonomia de públicos. Ver `Instituicao.categoria_publico_id`. */
  categorias_publico: CategoriaPublicoDoDicionario[];
  /** As subcategorias, de todas as categorias juntas — filtre por
   *  `categoria_publico_id` para achar as de uma categoria específica. */
  subcategorias_publico: SubcategoriaPublicoDoDicionario[];
}

/* -- stakeholders --------------------------------------------------------- */

export interface Instituicao {
  id: string;
  nome: string;
  tipo: string;
  /** O nome por extenso. `nome` guarda a forma curta, que é como se fala. */
  nome_completo: string | null;
  uf: string | null;
  esfera_id: number | null;
  /** Tier 1 a 4 — a relevância da instituição, e não a de uma agenda dela.
   *  `null` nas cadastradas antes de a coluna existir. */
  tier: number | null;
  /** A taxonomia de públicos (10 categorias) e sua subdivisão. `null` em quem
   *  ainda não foi reclassificado — ver `0036_categoria_de_publico.sql`. */
  categoria_publico_id: number | null;
  subcategoria_publico_id: number | null;
}

export interface Interlocutor {
  id: string;
  nome: string;
  instituicao_id: string | null;
  cargo: string | null;
  /** Como se chega na pessoa para marcar a agenda. */
  email: string | null;
  tipo: string | null;
  ativo: boolean;
}

export interface PessoaAegea {
  id: string;
  nome: string;
  cargo: string | null;
  /** Como se aciona a pessoa da casa para articular a agenda. */
  email: string | null;
  eh_porta_voz: boolean;
  /** De onde esta pessoa fala. `null` em quem foi cadastrado antes de o campo
   *  existir, ou em quem é equipe (o campo só faz sentido para porta-voz). */
  area_id: number | null;
  ativo: boolean;
  /** SOBRE O QUE ESTA PESSOA RESPONDE.
   *
   *  Sustenta a regra de "fora do escopo": agenda conduzida por quem não
   *  responde por aquele assunto. O vínculo existia no banco desde o começo e
   *  nenhuma tela o cruzava — doze pessoas cadastradas, zero assuntos ligados.
   */
  temas: number[];
}

/* -- acesso --------------------------------------------------------------- */

/** Os papéis de partida, que são a divisão por PORTAL.
 *
 *  A lista pode crescer sem passar por aqui: `papel` é tabela no banco, e um
 *  papel novo é um `insert`. Por isso NADA na tela deve comparar contra estes
 *  códigos para decidir permissão — quem decide são as bandeiras de
 *  `PapelDeAcesso`, e no fim das contas o backend, que responde 403.
 */
export type Perfil =
  | 'plataforma_leitura'
  | 'plataforma_edicao'
  | 'crm_leitura'
  | 'crm_edicao'
  | 'sintese_leitura'
  | 'sintese_edicao'
  | 'score_leitura'
  | 'score_edicao';

/** As três divisões da plataforma, como a capa as oferece. */
export type Portal = 'crm' | 'sintese' | 'score';

/**
 * O que o usuário pode fazer. Espelha a tabela `papel` do backend.
 *
 * `PapelDeAcesso`, e não `Papel`: este módulo já usa `Papel` para o papel da
 * pessoa NA interação (`porta_voz` | `equipe`), que é outra coisa inteiramente.
 *
 * A autorização vem do banco, e não de claim de grupo do Entra ID: o
 * diretório responde "quem é você", o banco responde "o que você pode". Ver
 * `seguranca/ARQUITETURA.md`.
 */
export interface PapelDeAcesso {
  codigo: Perfil;
  nome: string;
  pode_criar: boolean;
  pode_editar_proprio: boolean;
  pode_editar_tudo: boolean;
  administra_dicionarios: boolean;
  administra_acessos: boolean;
  ve_campos_sensiveis: boolean;
  ve_diretorio: boolean;
  pode_exportar: boolean;

  /** ONDE a pessoa entra — dimensão separada do que ela faz lá dentro.
   *
   *  Sem essa separação a lista de papéis multiplicaria: "lê a Síntese" e "lê a
   *  Síntese e o Score" seriam papéis diferentes, e cada portal novo dobraria a
   *  tabela.
   */
  acessa_crm: boolean;
  acessa_sintese: boolean;
  acessa_score: boolean;
}

/** Os portais que este papel abre.
 *
 *  Esconder um portal é conveniência de tela, nunca controle: quem decide é o
 *  backend. Uma pessoa que force a navegação para um portal fechado leva 403 do
 *  mesmo jeito — o que se evita aqui é oferecer uma porta que não abre.
 */
export function portaisDe(papel: PapelDeAcesso | null): Set<Portal> {
  const abertos = new Set<Portal>();
  if (!papel) return abertos;
  if (papel.acessa_crm) abertos.add('crm');
  if (papel.acessa_sintese) abertos.add('sintese');
  if (papel.acessa_score) abertos.add('score');
  return abertos;
}

/**
 * AINDA NÃO SERVIDO por nenhuma rota — não há `/api/eu`. O tipo existe para
 * quem for ligar a tela de administração de acessos, e para deixar registrado
 * que `papel` pode ser nulo: é assim que o convidado B2B nasce, autenticado
 * pelo diretório e autorizado a nada.
 *
 * Esconder botão pelo papel é conveniência de tela, nunca controle: quem
 * decide é o backend, que responde 403.
 */
export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: PapelDeAcesso | null;
  externo: boolean;
  acesso_expira_em: string | null;
}

/** O que o servidor devolve ao registrar uma exportação da Base.
 *
 *  `total_de_registros` é contado NO SERVIDOR: receber do cliente seria aceitar
 *  que quem exporta declare quanto exportou.
 */
export interface Exportacao {
  id: string;
  criado_em: string;
  total_de_registros: number;
}

/** Uma linha da tela de administração de acessos. */
export interface Acesso {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  papel: string | null;
  acesso_irrestrito: boolean;
  externo: boolean;
  expira_em: string | null;
  frentes: string[];
  unidades: string[];
  concedido_por: string | null;
  concedido_em: string | null;
}

/** O que se quer que a pessoa passe a alcançar. Estado completo, não diferença. */
export interface Concessao {
  papel: string | null;
  acesso_irrestrito: boolean;
  externo: boolean;
  expira_em: string | null;
  frentes: string[];
  unidades: string[];
  /**
   * O `concedido_em` que a tela viu ao abrir o formulário.
   *
   * Sem isso, dois administradores editando a mesma pessoa fazem o segundo
   * apagar o primeiro — sem conflito, sem aviso, e sem ninguém perceber,
   * porque o acesso simplesmente volta a ser o de antes.
   */
  versao_vista: string | null;
}

export interface PapelDisponivel {
  codigo: string;
  nome: string;
  administra_acessos: boolean;
  ve_campos_sensiveis: boolean;
  ve_diretorio: boolean;
}

/**
 * Uma alteração de autorização.
 *
 * `concedido_por` nulo significa alteração feita FORA da aplicação — e `origem`
 * diz por qual conta de banco. A distinção é o ponto da trilha: nulo ali é
 * sinal de incidente, não de dado faltando.
 */
export interface TrilhaDeAcesso {
  ocorrido_em: string;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  concedido_por: string | null;
  origem: string | null;
}

/** O corpo de `GET /api/eu`. */
export interface Eu extends Usuario {
  /**
   * Token anti-CSRF da sessão.
   *
   * Chega por AQUI, e não por um cookie legível: o cookie de sessão é
   * `httpOnly`, e é por não ser legível que um site de outra origem não obtém o
   * token. Disparar a requisição ele consegue; ler esta resposta, não.
   */
  csrf_token: string;
}

/** Uma referência da biblioteca.
 *
 *  A Aegea mantém o acervo lá; aqui ficam o link e os metadados que permitem
 *  encontrá-lo POR ASSUNTO — que é o gesto que quem marca uma reunião já faz.
 *  O arquivo não é copiado: duplicar o byte criaria uma segunda verdade que
 *  envelhece em silêncio.
 */
/** Uma versão de uma referência: o arquivo, a data dele e quem subiu. */
export interface VersaoDaReferencia {
  id: string;
  /** 1, 2, 3… na ordem em que entraram. É o "v3" da tela. */
  numero: number;
  /** A data DO DOCUMENTO, e não a do upload. */
  atualizado_em: string;
  /** O que mudou nesta versão. */
  nota: string | null;
  /** O texto desta versão. Nulo nas versões de antes deste campo existir. */
  conteudo: string | null;
  //: O arquivo é opcional desde que o Conteúdo passou a poder segurar a
  //: versão sozinho — os quatro nulos juntos, nunca separados.
  arquivo_id: string | null;
  arquivo_nome: string | null;
  arquivo_tipo: string | null;
  arquivo_tamanho: number | null;
  criado_em: string;
  criado_por: string | null;
}

/** Uma referência da biblioteca.
 *
 *  O ARQUIVO MORA NO BLOB, numa árvore por assunto e tipo, e a referência tem
 *  VERSÕES: a tela mostra a mais recente, e o histórico responde o que
 *  circulou numa reunião passada.
 */
export interface Referencia {
  id: string;
  titulo: string;
  /** `posicionamento` | `qa` | `release` | `apresentacao` | `dados` | `nota_tecnica` */
  tipo: string;
  resumo: string | null;
  /** O assunto que define a PASTA no blob. */
  tema_principal_id: number | null;
  /** Todos os assuntos, o principal incluído. É por eles que a agenda a acha. */
  temas: number[];
  ativo: boolean;
  /** A versão que a tela mostra — a mais recente. */
  versao: VersaoDaReferencia | null;
  quantas_versoes: number;
}

/** Os METADADOS de uma referência. O arquivo entra pelas rotas de versão. */
export interface ReferenciaEdicao {
  titulo: string;
  tipo: string;
  //: Continua aceitando `null` aqui — não trava a ação de Desativar/Reativar
  //: numa referência antiga sem resumo, que reenvia os metadados como estão.
  //: A obrigatoriedade do Resumo é imposta na TELA (o botão Salvar do
  //: formulário de edição), não no tipo desta chamada.
  resumo: string | null;
  tema_principal_id: number;
  /** Os demais assuntos. O principal entra sozinho. */
  temas: number[];
  ativo?: boolean;
}


/** Um documento com arquivo, saído de uma reunião.
 *
 *  Mora em `interacoes/…` no blob, e não em `referencias/…`: a biblioteca é o
 *  que se leva PARA a reunião; isto é o que volta dela — a ata que a outra
 *  parte entregou, o material que a equipe produziu depois.
 */
export interface DocumentoDaReuniao {
  id: string;
  momento: string;
  titulo: string;
  resumo: string | null;
  interacao_id: string;
  data_interacao: string;
  frente: string;
  instituicao: string | null;
  arquivo_id: string;
  arquivo_nome: string;
  arquivo_tipo: string;
  arquivo_tamanho: number;
  /** De que assuntos o documento trata. */
  temas: number[];
  criado_em: string;
  criado_por: string | null;
}
