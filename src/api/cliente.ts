/** Acesso ao backend. Um lugar só monta URL, envia credencial e traduz erro. */

import { registrarErro } from '@/observabilidade/telemetria';
import { catalogoMudou, escreveNoCatalogo } from '@/dominio/sincronizacao';
import type { ArquivoDoMaterial } from '@/dominio/tipos';
import type { Recorte } from '@/dominio/recorte';
import { paraParametros } from '@/dominio/recorte';
import type {
  Acesso,
  Concessao,
  Dicionarios,
  Eu,
  Exportacao,
  DocumentoDaReuniao,
  Referencia,
  ReferenciaEdicao,
  VersaoDaReferencia,
  Instituicao,
  Interacao,
  Interlocutor,
  PaginaDeInteracoes,
  PapelDisponivel,
  PessoaAegea,
  TrilhaDeAcesso,
} from '@/dominio/tipos';

//: 8001, e nao 8000.
//:
//: A pilha de teste move a API para 8001 porque a 8000 esta ocupada por OUTRO
//: produto nesta maquina — e ele RESPONDE. `npm run dev` com o padrao antigo
//: falava com o servico errado e mostrava "nao foi possivel entrar", que se le
//: como backend fora do ar quando ele esta de pe respondendo tudo.
//:
//: A imagem do Docker passa `VITE_API_URL` no build e nao depende disto; quem
//: depende e quem roda o servidor de desenvolvimento.
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8001';

/** Erro com a mensagem que o backend escreveu — o domínio já explica o que
 *  houve em português, então não inventamos texto por cima. */
export class ErroDaApi extends Error {
  readonly status: number;

  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.name = 'ErroDaApi';
    this.status = status;
  }
}

/**
 * Token anti-CSRF da sessão corrente.
 *
 * Vem do corpo de `/api/eu` — e não de um cookie legível, de propósito: o
 * cookie de sessão é `httpOnly`, e é justamente por não ser legível que um site
 * de outra origem não consegue obter o token. Ele consegue disparar a
 * requisição; ler a resposta de `/api/eu`, não, porque o CORS impede.
 *
 * Guardado em memória, e não em `localStorage`: recarregar a página busca de
 * novo, e nada persiste num lugar que qualquer script leia.
 */
let tokenAntiCsrf = '';

export function guardarTokenAntiCsrf(token: string): void {
  tokenAntiCsrf = token;
}

/** `GET`, `HEAD` e `OPTIONS` não alteram estado e não levam token. */
const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

async function requisitar<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  let resposta: Response;
  const metodo = (opcoes.method ?? 'GET').toUpperCase();

  try {
    resposta = await fetch(`${BASE}${caminho}`, {
      ...opcoes,
      credentials: 'include',
      headers: {
        // JSON SÓ QUANDO O CORPO É JSON.
        //
        // Num upload o corpo é `FormData`, e quem precisa escrever o
        // `Content-Type` é o NAVEGADOR: ele acrescenta o `boundary` que separa
        // as partes. Escrevendo `application/json` aqui, o navegador não
        // sobrescreve, o boundary não vai, e o servidor recebe um multipart que
        // não consegue separar — 422 sobre um arquivo perfeitamente válido.
        ...(opcoes.body instanceof FormData
          ? {}
          : { 'Content-Type': 'application/json' }),
        // Sem isto, toda escrita volta 403 depois que o SSO real entrar. O
        // cabeçalho precisa estar também na allowlist do CORS do backend —
        // faltar em qualquer um dos dois lados quebra tudo igual.
        ...(METODOS_SEGUROS.has(metodo) || !tokenAntiCsrf
          ? {}
          : { 'X-CSRF-Token': tokenAntiCsrf }),
        ...opcoes.headers,
      },
    });
  } catch (falhaDeRede) {
    const erro = new ErroDaApi(
      0,
      'Não foi possível falar com o servidor. Verifique se o backend está no ar.',
    );
    // Falha de rede nunca chega ao servidor: se não for registrada aqui, não
    // existe em lugar nenhum.
    registrarErro(erro, {
      caminho,
      origem: 'rede',
      causa: String(falhaDeRede),
    });
    throw erro;
  }

  if (resposta.status === 204) {
    avisarSeMudouOCatalogo(metodo, caminho);
    return undefined as T;
  }

  const corpo = await resposta.text();
  const dados = corpo ? JSON.parse(corpo) : null;

  if (!resposta.ok) {
    const erro = new ErroDaApi(
      resposta.status,
      dados?.detalhe ?? dados?.detail ?? `Falha ${resposta.status} em ${caminho}.`,
    );

    // 5xx é defeito nosso e precisa aparecer. 4xx é o servidor recusando algo
    // esperado (filtro inválido, permissão) — registrar todos viraria ruído,
    // e o backend já os anota do lado dele.
    if (resposta.status >= 500) {
      registrarErro(erro, { caminho, status: resposta.status, metodo: opcoes.method ?? 'GET' });
    }
    throw erro;
  }
  avisarSeMudouOCatalogo(metodo, caminho);
  return dados as T;
}

/** A GARANTIA DE SINCRONIZAÇÃO, num lugar só.
 *
 *  Toda escrita que deu certo numa rota de catálogo avisa `catalogoMudou`, e o
 *  estado do painel — que escuta — recarrega dicionários, instituições,
 *  interlocutores, pessoas e referências. É por isso que uma tela de cadastro
 *  NÃO precisa lembrar de recarregar nada depois de salvar, e uma função de
 *  escrita nova entra na garantia sem que quem a escreveu saiba dela: a regra
 *  é a rota, não a função.
 *
 *  SÓ DEPOIS DO SUCESSO. Um 4xx não mudou nada, e avisar faria a tela piscar
 *  por um cadastro que não aconteceu. */
function avisarSeMudouOCatalogo(metodo: string, caminho: string): void {
  if (escreveNoCatalogo(metodo, caminho)) catalogoMudou.avisar();
}

/* -- interações ----------------------------------------------------------- */

export interface OpcoesDeListagem {
  pagina?: number;
  tamanho?: number;
  ordenacao?: string;
}

export function listarInteracoes(
  recorte: Recorte,
  opcoes: OpcoesDeListagem = {},
): Promise<PaginaDeInteracoes> {
  const parametros = paraParametros(recorte);
  if (opcoes.pagina) parametros.set('pagina', String(opcoes.pagina));
  if (opcoes.tamanho) parametros.set('tamanho', String(opcoes.tamanho));
  if (opcoes.ordenacao) parametros.set('ordenacao', opcoes.ordenacao);
  return requisitar<PaginaDeInteracoes>(`/api/interacoes?${parametros}`);
}

/** Tamanho máximo aceito por página no backend. */
const TAMANHO_MAXIMO = 200;

/** Limite de segurança: acima disso, derivar no navegador deixa de fazer
 *  sentido e as agregações precisam ir para o backend. */
export const TETO_DE_DERIVACAO = 5000;

export interface RecorteCompleto {
  itens: Interacao[];
  total: number;
  truncado: boolean;
  filtrosAtivos: number;
}

/** Busca o recorte inteiro: a primeira página diz quantas há, e as outras
 *  vêm TODAS DE UMA VEZ.
 *
 *  As telas de análise derivam os agregados do conjunto completo, então
 *  precisam dele inteiro — não da primeira página. Uma página atrás da outra
 *  somava as latências; em paralelo, o recorte chega no tempo da mais lenta. */
export async function listarRecorteCompleto(recorte: Recorte): Promise<RecorteCompleto> {
  const primeira = await listarInteracoes(recorte, { pagina: 1, tamanho: TAMANHO_MAXIMO });

  const paginasNecessarias = Math.min(
    primeira.paginas,
    Math.ceil(TETO_DE_DERIVACAO / TAMANHO_MAXIMO),
  );
  const restantes = await Promise.all(
    Array.from({ length: Math.max(0, paginasNecessarias - 1) }, (_, i) =>
      listarInteracoes(recorte, { pagina: i + 2, tamanho: TAMANHO_MAXIMO }),
    ),
  );
  const itens = [primeira, ...restantes].flatMap((pagina) => pagina.itens);

  return {
    itens,
    total: primeira.total,
    truncado: itens.length < primeira.total,
    filtrosAtivos: primeira.filtros_ativos,
  };
}

/**
 * Quem está logado, o que pode, e o token anti-CSRF.
 *
 * Guarda o token como efeito colateral, de propósito: esquecer de guardá-lo faz
 * toda escrita voltar 403 depois que o SSO real entrar, e o erro apareceria
 * longe daqui — na tela de cadastro, sem relação óbvia com o login.
 */
export async function obterEu(): Promise<Eu> {
  const eu = await requisitar<Eu>('/api/eu');
  guardarTokenAntiCsrf(eu.csrf_token);
  return eu;
}

/**
 * Para onde o NAVEGADOR vai quando alguém clica em entrar.
 *
 * Não é uma chamada de API, e é por isso que fica separada de `requisitar`: o
 * fluxo OIDC é uma sequência de redirecionamentos entre três partes — painel,
 * provedor de identidade, painel de novo. Só o navegador sabe percorrê-la, e
 * `fetch` não serve nem em princípio: a tela de senha do provedor precisa
 * aparecer para uma pessoa.
 *
 * `destino` é para onde voltar DEPOIS de autenticar. Vai como caminho relativo
 * porque o backend recusa qualquer coisa que pareça absoluta — endereço externo
 * aqui seria um redirecionamento aberto, e o `_destino_seguro` da rota já
 * derruba `//outro.site` e esquema explícito.
 */
/**
 * Entrada por e-mail e senha, para quem não está no Entra ID.
 *
 * Responde 204 e a sessão vem no cookie — nada do usuário volta no corpo. Quem
 * precisa saber quem entrou chama `obterEu()` em seguida, que é a rota que já
 * existe para essa pergunta.
 *
 * A senha NÃO é guardada, nem em memória além da chamada, nem em
 * `localStorage`. O que persiste é o cookie de sessão, que é `httpOnly` e o
 * JavaScript não lê.
 */
export function entrarPorSenha(email: string, senha: string): Promise<void> {
  return requisitar<void>('/api/auth/senha', {
    method: 'POST',
    body: JSON.stringify({ email, senha }),
  });
}

/**
 * Encerra a sessão.
 *
 * O cookie é `httpOnly`, então o JavaScript não consegue apagá-lo: quem apaga é
 * o servidor, no `Set-Cookie` da resposta. Por isso sair é uma CHAMADA, e não
 * uma linha de `document.cookie`.
 *
 * LEVANTA se falhar, em vez de recarregar a página de qualquer jeito. Engolir
 * a exceção pareceria defensivo e seria o contrário: um logout com token
 * anti-CSRF vencido devolve 403 e a SESSÃO SOBREVIVE. A pessoa clicaria em
 * Sair, a página recarregaria, e ela voltaria logada sem nenhum sinal de que
 * não tinha saído.
 *
 * Achar que saiu e não ter saído é pior do que ver um erro — especialmente num
 * computador compartilhado, que é justamente quando alguém clica em Sair.
 */
export function sair(): Promise<void> {
  return requisitar<void>('/api/auth/logout', { method: 'POST' });
}

export function urlDeLogin(destino = '/painel'): string {
  return `${BASE}/api/auth/login?redirect=${encodeURIComponent(destino)}`;
}

/**
 * Registra que a Base foi exportada.
 *
 * O recorte vai na QUERY STRING, e não no corpo: é a mesma dependência que a
 * listagem usa, e mandar os filtros no corpo abriria a porta para o registro
 * dizer um recorte e o servidor contar outro.
 *
 * O CSV leva TUDO que o recorte alcança — é o caminho mais curto para tirar
 * dados daqui, e ficava sem evento nenhum: um botão, um arquivo, e nada no log.
 *
 * Trilha, não barreira: um cliente modificado baixa a listagem e monta o
 * arquivo sem chamar isto. Serve para responsabilização entre pessoas da casa
 * e como insumo de alerta.
 */
export function registrarExportacao(recorte: Recorte): Promise<Exportacao> {
  const parametros = paraParametros(recorte).toString();
  return requisitar<Exportacao>(`/api/exportacoes?${parametros}`, { method: 'POST' });
}

export function listarAcessos(): Promise<Acesso[]> {
  return requisitar<Acesso[]>('/api/acessos');
}

export function listarPapeis(): Promise<PapelDisponivel[]> {
  return requisitar<PapelDisponivel[]>('/api/acessos/papeis');
}

/**
 * `PUT`, e não `PATCH`: a concessão é o estado completo do que alguém alcança.
 *
 * Aplicar diferença abriria a porta para "acrescentei uma frente e esqueci que
 * ele já tinha alcance total" — e o erro só apareceria depois.
 */
export function concederAcesso(id: string, concessao: Concessao): Promise<void> {
  return requisitar<void>(`/api/acessos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(concessao),
  });
}

/**
 * Desliga ou religa uma conta — a REMOÇÃO do produto.
 *
 * `PATCH` e não `DELETE`: ninguém é apagado. Dez chaves estrangeiras apontam
 * para `usuario`, e `interacao.criado_por` é obrigatória — apagar a pessoa
 * apagaria a autoria dos registros que ela criou. Desligar preserva o
 * histórico e tira o acesso.
 *
 * O efeito é imediato: o backend descarta a permissão em cache no ato, então
 * a pessoa cai na requisição seguinte, e não ao fim da sessão.
 */
export function definirSituacaoDeAcesso(id: string, ativo: boolean): Promise<void> {
  return requisitar<void>(`/api/acessos/${id}/situacao`, {
    method: 'PATCH',
    body: JSON.stringify({ ativo }),
  });
}

export function historicoDeAcesso(id: string): Promise<TrilhaDeAcesso[]> {
  return requisitar<TrilhaDeAcesso[]>(`/api/acessos/${id}/historico`);
}

export function obterInteracao(id: string): Promise<Interacao> {
  return requisitar<Interacao>(`/api/interacoes/${id}`);
}

export function criarInteracao(dados: unknown): Promise<Interacao> {
  return requisitar<Interacao>('/api/interacoes', {
    method: 'POST',
    body: JSON.stringify(dados),
  });
}

export function editarInteracao(id: string, alteracoes: unknown): Promise<Interacao> {
  return requisitar<Interacao>(`/api/interacoes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(alteracoes),
  });
}

/** Sobe o arquivo de um material e devolve o `arquivo_id` a citar no salvamento.
 *
 *  ANTES DO MATERIAL EXISTIR, de propósito: quem preenche acrescenta a linha,
 *  escolhe o arquivo e só depois salva a agenda. Nesse instante o material
 *  ainda não tem `id` no servidor.
 *
 *  Mas a AGENDA precisa existir — o arquivo mora na pasta dela. Numa agenda
 *  nova, a tela pede para salvar primeiro.
 */
export function subirArquivoDeMaterial(
  interacaoId: string,
  momento: string,
  arquivo: File,
): Promise<ArquivoDoMaterial> {
  const corpo = new FormData();
  corpo.append('momento', momento);
  corpo.append('arquivo', arquivo);
  return requisitar<ArquivoDoMaterial>(
    `/api/interacoes/${interacaoId}/materiais/arquivo`,
    { method: 'POST', body: corpo },
  );
}

/** O endereço de download. Passa pela API, e não direto pelo blob.
 *
 *  Um link direto continuaria valendo depois de a pessoa perder o acesso —
 *  e material de agenda com governo e investidores é o conteúdo mais
 *  sensível deste painel.
 */
export function urlDoArquivo(interacaoId: string, arquivoId: string): string {
  return `${BASE}/api/interacoes/${interacaoId}/materiais/arquivo/${arquivoId}`;
}

export function arquivarInteracao(id: string): Promise<void> {
  return requisitar<void>(`/api/interacoes/${id}`, { method: 'DELETE' });
}

/* -- dicionários ---------------------------------------------------------- */

export function obterDicionarios(): Promise<Dicionarios> {
  return requisitar<Dicionarios>('/api/dicionarios');
}

/* -- stakeholders --------------------------------------------------------- */

export function listarInstituicoes(): Promise<Instituicao[]> {
  return requisitar<Instituicao[]>('/api/instituicoes');
}

export function listarInterlocutores(): Promise<Interlocutor[]> {
  return requisitar<Interlocutor[]>('/api/interlocutores');
}

export function listarPessoasAegea(): Promise<PessoaAegea[]> {
  return requisitar<PessoaAegea[]>('/api/pessoas-aegea');
}

/* -- cadastros de stakeholders -------------------------------------------- */
//
// Escrever aqui exige `administra_dicionarios`, e não `escrita`. Quem cadastra
// agenda LÊ estes nomes o tempo todo e não deve reescrevê-los: renomear uma
// instituição muda o que aparece em toda agenda que aponta para ela.

/** A primeira pessoa da instituição, cadastrada JUNTO com ela.
 *
 *  Vai no mesmo corpo, e não numa segunda chamada: as duas escritas caem ou
 *  passam juntas. Separadas, uma falha na segunda deixaria a instituição criada
 *  e sem representante — e uma instituição sem ninguém não serve para nada,
 *  porque o formulário de agenda só oferece pessoas depois de escolhê-la.
 */
export interface RepresentanteInicial {
  nome: string;
  email?: string | null;
  cargo?: string | null;
}

export interface InstituicaoEntrada {
  nome: string;
  /** O nome por extenso. `nome` é a forma curta, que é como se fala. */
  nome_completo?: string | null;
  /** `veiculo`, `orgao`, `entidade`, `investidor`, `proposicao`, `area_interna`.
   *  É o que liga a instituição a uma frente. */
  tipo: string;
  esfera_id?: number | null;
  uf?: string | null;
  /** A relevância da INSTITUIÇÃO — Tier 1 a 4. Não confundir com o tier da
   *  agenda: a Folha é Tier 1 sempre, e uma nota de rodapé com a Folha pode
   *  ser Tier 3. `null` nas cadastradas antes de a coluna existir. */
  tier?: number | null;
  ativo?: boolean;
  representante?: RepresentanteInicial | null;
}

export interface InterlocutorEntrada {
  nome: string;
  /** DE QUEM esta pessoa fala. É o que a faz aparecer — ou não — em
   *  "Pela outra parte". */
  instituicao_id?: string | null;
  cargo?: string | null;
  /** Como se chega na pessoa para marcar a agenda. */
  email?: string | null;
  tipo?: string | null;
  ativo?: boolean;
}

export function criarInstituicao(entrada: InstituicaoEntrada): Promise<Instituicao> {
  return requisitar<Instituicao>('/api/instituicoes', {
    method: 'POST',
    body: JSON.stringify(entrada),
  });
}

export function editarInstituicao(
  id: string,
  entrada: InstituicaoEntrada,
): Promise<Instituicao> {
  return requisitar<Instituicao>(`/api/instituicoes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(entrada),
  });
}

export function criarInterlocutor(
  entrada: InterlocutorEntrada,
): Promise<Interlocutor> {
  return requisitar<Interlocutor>('/api/interlocutores', {
    method: 'POST',
    body: JSON.stringify(entrada),
  });
}

export function editarInterlocutor(
  id: string,
  entrada: InterlocutorEntrada,
): Promise<Interlocutor> {
  return requisitar<Interlocutor>(`/api/interlocutores/${id}`, {
    method: 'PUT',
    body: JSON.stringify(entrada),
  });
}

/** Apaga a pessoa. O servidor recusa quem já esteve numa agenda.
 *
 *  Apagar e desligar são coisas diferentes, e a diferença é o histórico: quem
 *  entrou por engano é lixo, e quem participou de uma reunião é um fato. A
 *  recusa vem com a contagem de agendas e o gesto certo na mensagem.
 */
export function removerInterlocutor(id: string): Promise<void> {
  return requisitar<void>(`/api/interlocutores/${id}`, { method: 'DELETE' });
}

export interface PessoaAegeaEntrada {
  nome: string;
  cargo?: string | null;
  email?: string | null;
  eh_porta_voz?: boolean;
  area_id?: number | null;
  ativo?: boolean;
  /** Sobre o que esta pessoa pode falar. A lista inteira substitui a anterior. */
  temas?: number[];
}

export function criarPessoaAegea(
  entrada: PessoaAegeaEntrada,
): Promise<PessoaAegea> {
  return requisitar<PessoaAegea>('/api/pessoas-aegea', {
    method: 'POST',
    body: JSON.stringify(entrada),
  });
}

export function editarPessoaAegea(
  id: string,
  entrada: PessoaAegeaEntrada,
): Promise<PessoaAegea> {
  return requisitar<PessoaAegea>(`/api/pessoas-aegea/${id}`, {
    method: 'PUT',
    body: JSON.stringify(entrada),
  });
}

/** Os assuntos de UMA pessoa.
 *
 *  Rota separada de propósito: a listagem de pessoas alimenta o formulário de
 *  agenda, que não usa os temas, e carregá-los ali seria uma consulta por
 *  pessoa em toda abertura de tela.
 */
export function temasDoPortaVoz(id: string): Promise<number[]> {
  return requisitar<number[]>(`/api/pessoas-aegea/${id}/temas`);
}

export interface TemaCadastrado {
  id: number;
  nome: string;
  /** `sensivel` (exige alinhamento antes de falar), `estrategico` (agenda
   *  da companhia) ou `gerais` (o que aparece sem ter sido planejado). */
  nivel: string;
  ativo: boolean;
}

export interface TemaEntrada {
  nome: string;
  nivel?: string;
  ativo?: boolean;
}

/** A lista COMPLETA, inclusive os inativos.
 *
 *  `/api/dicionarios` devolve só os ativos, porque alimenta filtro e
 *  formulário. Quem administra precisa ver o que desativou — senão o assunto
 *  some da tela e reaparece como "já existe" na próxima tentativa de criar.
 */
export function listarTemas(): Promise<TemaCadastrado[]> {
  return requisitar<TemaCadastrado[]>('/api/temas');
}

export function criarTema(entrada: TemaEntrada): Promise<TemaCadastrado> {
  return requisitar<TemaCadastrado>('/api/temas', {
    method: 'POST',
    body: JSON.stringify(entrada),
  });
}

export function editarTema(
  id: number,
  entrada: TemaEntrada,
): Promise<TemaCadastrado> {
  return requisitar<TemaCadastrado>(`/api/temas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(entrada),
  });
}

/* ------------------------------------------------ a biblioteca de referências */

/**
 * O acervo oficial, por assunto — com a versão mais recente de cada referência.
 *
 * Traz ATIVAS E INATIVAS, ao contrário do catálogo que alimenta o formulário:
 * sem as inativas, a referência desativada some da tela de administração e
 * reaparece como "já existe" na próxima tentativa de cadastrar o mesmo título.
 */
export function listarReferencias(): Promise<Referencia[]> {
  return requisitar<Referencia[]>('/api/referencias');
}

/**
 * Cadastra a referência COM a primeira versão, numa requisição só.
 *
 * Multipart, e não JSON: o arquivo é obrigatório. Uma referência sem ele é um
 * título que não leva a lugar nenhum.
 */
export function criarReferencia(
  metadados: {
    titulo: string;
    tipo: string;
    tema_principal_id: number;
    /** Os demais assuntos. O principal entra sozinho. */
    temas: number[];
    resumo?: string | null;
    atualizado_em: string;
    nota?: string | null;
  },
  arquivo: File,
): Promise<Referencia> {
  const corpo = new FormData();
  corpo.append('titulo', metadados.titulo);
  corpo.append('tipo', metadados.tipo);
  corpo.append('tema_principal_id', String(metadados.tema_principal_id));
  corpo.append('atualizado_em', metadados.atualizado_em);
  // Lista vira texto separado por vírgula: multipart não carrega array, e um
  // campo repetido complicaria o cliente mais do que resolve.
  corpo.append('temas', metadados.temas.join(','));
  if (metadados.resumo) corpo.append('resumo', metadados.resumo);
  if (metadados.nota) corpo.append('nota', metadados.nota);
  corpo.append('arquivo', arquivo);
  return requisitar<Referencia>('/api/referencias', { method: 'POST', body: corpo });
}

/** Só os metadados. Arquivo novo é VERSÃO nova, e entra pela outra rota. */
export function editarReferencia(
  id: string,
  entrada: ReferenciaEdicao,
): Promise<Referencia> {
  return requisitar<Referencia>(`/api/referencias/${id}`, {
    method: 'PUT',
    body: JSON.stringify(entrada),
  });
}

/**
 * Acrescenta uma versão. A anterior CONTINUA — é o histórico.
 *
 * É ele que responde "qual Q&A a gente levou naquela reunião de março", e é
 * por isso que subir a versão de agosto não apaga a de março.
 */
export function subirVersaoDaReferencia(
  id: string,
  arquivo: File,
  atualizado_em: string,
  nota?: string,
): Promise<Referencia> {
  const corpo = new FormData();
  corpo.append('atualizado_em', atualizado_em);
  if (nota) corpo.append('nota', nota);
  corpo.append('arquivo', arquivo);
  return requisitar<Referencia>(`/api/referencias/${id}/versoes`, {
    method: 'POST',
    body: corpo,
  });
}

export function listarVersoesDaReferencia(id: string): Promise<VersaoDaReferencia[]> {
  return requisitar<VersaoDaReferencia[]>(`/api/referencias/${id}/versoes`);
}

/** O endereço de download de uma versão. Passa pela API, e não pelo blob.
 *
 *  Um link direto continuaria valendo depois de a pessoa perder o acesso — e o
 *  acervo diz o que a companhia fala publicamente.
 */
export function urlDaVersao(referenciaId: string, versaoId: string): string {
  return `${BASE}/api/referencias/${referenciaId}/versoes/${versaoId}/arquivo`;
}

/**
 * Os documentos com ARQUIVO das agendas alcançadas pelo recorte.
 *
 * O recorte vai junto porque esta lista mora dentro da Base, e o cabeçalho da
 * Base diz o recorte em vigor: uma aba que ignorasse os filtros mostraria
 * documentos de agendas que a tela ao lado não lista.
 */
export function listarDocumentosDaReuniao(recorte: Recorte): Promise<DocumentoDaReuniao[]> {
  const parametros = paraParametros(recorte).toString();
  return requisitar<DocumentoDaReuniao[]>(`/api/materiais?${parametros}`);
}
