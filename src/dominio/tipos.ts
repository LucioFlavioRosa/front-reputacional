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
] as const;

export type Frente = (typeof FRENTES)[number];

export type GrupoDeStatus = 'resolvido' | 'aberto' | 'declinado';

export type Papel = 'porta_voz' | 'equipe';

export interface Participacao {
  pessoa_aegea_id: string;
  papel: Papel;
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
  uf: string;
  tier: number | null;
  stakeholder_id: number | null;
  status: string;
  clima: string | null;
  resultado: string | null;
  iniciativa: string | null;
  pauta: string;
  posicionamento: string | null;
  relato: string | null;
  encaminhamentos: string | null;
  pendencias: string | null;
  observacoes: string | null;
  registro_url: string | null;
  extensao: Extensao | null;
  temas: number[];
  participacoes: Participacao[];
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

export interface Tema {
  id: number;
  nome: string;
  nivel: 'estrategico' | 'livre';
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
  unidades_negocio: UnidadeDeNegocio[];
  temas: Tema[];
}

/* -- stakeholders --------------------------------------------------------- */

export interface Instituicao {
  id: string;
  nome: string;
  tipo: string;
  uf: string | null;
}

export interface Interlocutor {
  id: string;
  nome: string;
  instituicao_id: string | null;
  cargo: string | null;
  tipo: string | null;
  ativo: boolean;
}

export interface PessoaAegea {
  id: string;
  nome: string;
  cargo: string | null;
  eh_porta_voz: boolean;
  ativo: boolean;
}

/* -- acesso --------------------------------------------------------------- */

/** Os papéis de partida, que são a divisão por PORTAL.
 *
 *  A lista pode crescer sem passar por aqui: `papel` é tabela no banco, e um
 *  papel novo é um `insert`. Por isso NADA na tela deve comparar contra estes
 *  códigos para decidir permissão — quem decide são as bandeiras de
 *  `PapelDeAcesso`, e no fim das contas o backend, que responde 403.
 */
export type Perfil = 'plataforma' | 'crm' | 'sintese' | 'score';

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

/** O que o servidor devolve ao registrar uma geração de relatório. */
export interface GeracaoDeRelatorio {
  id: string;
  criado_em: string;
  total_de_registros: number;
  /** O relatório inclui a tabela completa — é uma exportação com capa. */
  leva_registros: boolean;
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
