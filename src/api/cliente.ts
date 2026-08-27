/** Acesso ao backend. Um lugar só monta URL, envia credencial e traduz erro. */

import { registrarErro } from '@/observabilidade/telemetria';
import type { Recorte } from '@/dominio/recorte';
import { paraParametros } from '@/dominio/recorte';
import type {
  Acesso,
  Concessao,
  Dicionarios,
  Eu,
  GeracaoDeRelatorio,
  Instituicao,
  Interacao,
  Interlocutor,
  PaginaDeInteracoes,
  PapelDisponivel,
  PessoaAegea,
  TrilhaDeAcesso,
} from '@/dominio/tipos';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

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
        'Content-Type': 'application/json',
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

  if (resposta.status === 204) return undefined as T;

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
  return dados as T;
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

/** Busca o recorte inteiro, página a página.
 *
 *  As telas de análise derivam os agregados do conjunto completo, então
 *  precisam dele inteiro — não da primeira página. */
export async function listarRecorteCompleto(recorte: Recorte): Promise<RecorteCompleto> {
  const primeira = await listarInteracoes(recorte, { pagina: 1, tamanho: TAMANHO_MAXIMO });
  const itens = [...primeira.itens];

  const paginasNecessarias = Math.min(
    primeira.paginas,
    Math.ceil(TETO_DE_DERIVACAO / TAMANHO_MAXIMO),
  );

  for (let pagina = 2; pagina <= paginasNecessarias; pagina += 1) {
    const proxima = await listarInteracoes(recorte, { pagina, tamanho: TAMANHO_MAXIMO });
    itens.push(...proxima.itens);
  }

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
 * LEVANTA se falhar, e a primeira versão não levantava — engolia a exceção e
 * recarregava a página de qualquer jeito. Parecia defensivo e era o contrário:
 * medido, um logout com token anti-CSRF vencido devolve 403 e a SESSÃO
 * SOBREVIVE. A pessoa clicava em Sair, a página recarregava, e ela voltava
 * logada sem nenhum sinal de que não tinha saído.
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
 * Registra que um relatório foi gerado.
 *
 * O recorte vai na QUERY STRING, e não no corpo: é a mesma dependência que a
 * listagem usa, e mandar os filtros no corpo abriria a porta para o registro
 * dizer um recorte e o servidor contar outro.
 *
 * É trilha, não permissão. Um cliente modificado simplesmente não chama, e nada
 * é registrado — serve para responsabilização entre pessoas da casa e como
 * insumo de alerta, não como barreira.
 */
export function registrarRelatorio(
  recorte: Recorte,
  secoes: string[],
): Promise<GeracaoDeRelatorio> {
  const parametros = paraParametros(recorte).toString();
  return requisitar<GeracaoDeRelatorio>(
    `/api/relatorios${parametros ? `?${parametros}` : ''}`,
    { method: 'POST', body: JSON.stringify({ secoes }) },
  );
}

/**
 * Registra uma exportação CSV.
 *
 * Diferente do relatório impresso, o CSV NÃO corta: leva tudo que o recorte
 * alcança. É o caminho mais curto para tirar dados daqui, e ficava sem evento
 * nenhum — um botão, um arquivo, e nada no log.
 *
 * Trilha, não barreira: um cliente modificado baixa a listagem e monta o
 * arquivo sem chamar isto.
 */
export function registrarExportacao(recorte: Recorte): Promise<GeracaoDeRelatorio> {
  const parametros = paraParametros(recorte).toString();
  return requisitar<GeracaoDeRelatorio>(
    `/api/relatorios/exportacoes${parametros ? `?${parametros}` : ''}`,
    { method: 'POST' },
  );
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
