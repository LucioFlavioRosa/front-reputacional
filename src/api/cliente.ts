/** Acesso ao backend. Um lugar só monta URL, envia credencial e traduz erro. */

import { registrarErro } from '@/observabilidade/telemetria';
import {
  agendasMudaram,
  catalogoMudou,
  escreveAgendas,
  escreveNoCatalogo,
  escreveNoScore,
  scoreMudou,
} from '@/dominio/sincronizacao';
import type { Alegacao, ArquivoDoMaterial } from '@/dominio/tipos';
import type { Bloco, Dossie } from '@/dominio/dossie';
import type { ACriar, Grupo } from '@/paginas/importacao/grupos';
import type { Dados as ConsultaDaLente } from '@/paginas/score/consulta/dados/tipos';
import type { Recorte } from '@/dominio/recorte';
import type {
  FiltroDoRisco,
  OpcoesDoRisco,
  PaginaDeIncidentes,
  PainelDeRisco,
} from '@/dominio/riscos';
import type {
  Calibracao,
  CalibracaoEntrada,
  DriversDoScore,
  FatoDoMes,
  FonteDoScore,
  ImportacaoDoScore,
  IndiceDoScore,
  OpcoesDoScore,
  PontoDaSerie,
} from '@/dominio/score';
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

/** Opções que não são do `fetch`: mudam como a RESPOSTA é lida, não o pedido. */
interface ComoLer {
  /** Devolve o corpo como `Blob`, para download de arquivo.
   *
   *  ESTÁ AQUI E NÃO NUM SEGUNDO `fetch` porque `requisitar` é o único lugar que
   *  avisa — erro de rede, 5xx na telemetria, mudança de catálogo. Um `fetch`
   *  paralelo seria um caminho que falha sem ninguém saber, e o teste que conta
   *  as chamadas a `fetch` neste arquivo existe justamente para impedir isso. */
  comoBlob?: boolean;
}

async function requisitar<T>(
  caminho: string,
  opcoes: RequestInit = {},
  como: ComoLer = {},
): Promise<T> {
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

  // O BINÁRIO SAI ANTES DA LEITURA COMO TEXTO, porque um `.xlsx` lido como
  // texto e passado ao `JSON.parse` estoura — e o erro falaria de sintaxe JSON
  // sobre um arquivo perfeitamente válido. O caminho de erro continua o mesmo:
  // um 4xx/5xx aqui ainda traz corpo de texto, e é ele que explica o problema.
  if (como.comoBlob && resposta.ok) {
    avisarSeMudouOCatalogo(metodo, caminho);
    return (await resposta.blob()) as T;
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
  // AS AGENDAS TÊM O SEU PRÓPRIO AVISO: confirmar uma importação ou salvar uma
  // interação recarrega a Base sozinho, em todas as abas abertas. Antes disto a
  // pessoa confirmava 54 agendas e precisava de um F5 para vê-las.
  if (escreveAgendas(metodo, caminho)) agendasMudaram.avisar();
  // O SCORE TAMBÉM: subir a planilha ou mudar a calibração invalida o cache da
  // Consulta em profundidade, que senão mostraria a árvore antiga ao lado da
  // Jornada já atualizada.
  if (escreveNoScore(metodo, caminho)) scoreMudou.avisar();
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

/** Quantas páginas restantes pedir de cada vez, e não todas de uma vez.
 *
 *  CADA PÁGINA CUSTA MAIS DE UMA CONSULTA NO BACKEND — a principal, mais uma
 *  por relacionamento carregado à parte (temas, áreas, participações…). Um
 *  recorte de 25 páginas em paralelo somava dezenas de consultas simultâneas
 *  no banco, de uma vez só, a cada troca de filtro. Em lotes pequenos, nunca
 *  há mais que `TAMANHO_DO_LOTE` páginas deste recorte em voo ao mesmo tempo. */
export const TAMANHO_DO_LOTE = 5;

export interface RecorteCompleto {
  itens: Interacao[];
  total: number;
  truncado: boolean;
  filtrosAtivos: number;
}

/** Busca o recorte inteiro: a primeira página diz quantas há, e as outras
 *  vêm em LOTES de `TAMANHO_DO_LOTE`, um lote de cada vez.
 *
 *  As telas de análise derivam os agregados do conjunto completo, então
 *  precisam dele inteiro — não da primeira página. Um lote por vez, e não
 *  todas de uma vez, é o meio-termo entre "uma página atrás da outra" (soma
 *  as latências) e "todas em paralelo" (multiplica a carga no backend pelo
 *  número de páginas). O RESULTADO FINAL não muda — mesmos itens, mesma
 *  ordem —, só o RITMO das requisições. */
export async function listarRecorteCompleto(recorte: Recorte): Promise<RecorteCompleto> {
  const primeira = await listarInteracoes(recorte, { pagina: 1, tamanho: TAMANHO_MAXIMO });

  const paginasNecessarias = Math.min(
    primeira.paginas,
    Math.ceil(TETO_DE_DERIVACAO / TAMANHO_MAXIMO),
  );

  const restantes: PaginaDeInteracoes[] = [];
  for (let inicio = 2; inicio <= paginasNecessarias; inicio += TAMANHO_DO_LOTE) {
    const fim = Math.min(inicio + TAMANHO_DO_LOTE - 1, paginasNecessarias);
    const lote = await Promise.all(
      Array.from({ length: fim - inicio + 1 }, (_, i) =>
        listarInteracoes(recorte, { pagina: inicio + i, tamanho: TAMANHO_MAXIMO }),
      ),
    );
    restantes.push(...lote);
  }

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

export function urlDeLogin(destino = '/'): string {
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

/** COM AS DESATIVADAS. Sem elas o catálogo não resolveria o nome de uma
 *  instituição que já esteve numa agenda, e a Administração não teria como
 *  reativá-la — o mesmo motivo pelo qual temas e referências vêm inteiros.
 *  Quem oferece escolha filtra por `ativo` (formulário de agenda, cadastro
 *  de pessoa); quem só mostra, mostra. */
export function listarInstituicoes(): Promise<Instituicao[]> {
  return requisitar<Instituicao[]>('/api/instituicoes?incluir_inativos=1');
}

/** COM AS DESLIGADAS, pelo mesmo motivo de `listarInstituicoes`: sem elas o
 *  Reativar da Administração não tem em quem clicar. Quem oferece escolha
 *  filtra — `interlocutoresDaInstituicao` só devolve quem está disponível. */
export function listarInterlocutores(): Promise<Interlocutor[]> {
  return requisitar<Interlocutor[]>('/api/interlocutores?incluir_inativos=1');
}

export function listarPessoasAegea(): Promise<PessoaAegea[]> {
  return requisitar<PessoaAegea[]>('/api/pessoas-aegea');
}

/* -- cadastros de stakeholders -------------------------------------------- */
//
// Escrever aqui exige `administra_dicionarios`, e não `escrita`. Quem cadastra
// agenda LÊ estes nomes o tempo todo e não deve reescrevê-los: renomear uma
// instituição muda o que aparece em toda agenda que aponta para ela.

export interface InstituicaoEntrada {
  nome: string;
  /** O nome por extenso. `nome` é a forma curta, que é como se fala. */
  nome_completo?: string | null;
  /** `veiculo`, `orgao`, `entidade`, `investidor`, `proposicao`, `area_interna`,
   *  `credor`. É o que liga a instituição a uma frente. Opcional: sem ele, o
   *  back deriva da categoria de público (a tela de cadastro não pergunta
   *  mais); na edição, ausente, o gravado fica. */
  tipo?: string;
  esfera_id?: number | null;
  uf?: string | null;
  /** A relevância da INSTITUIÇÃO — Tier 1 a 4. Não confundir com o tier da
   *  agenda: a Folha é Tier 1 sempre, e uma nota de rodapé com a Folha pode
   *  ser Tier 3. `null` nas cadastradas antes de a coluna existir. */
  tier?: number | null;
  /** A taxonomia de públicos (10 categorias) e sua subdivisão. `null` nas
   *  cadastradas antes de a coluna existir — ver `0036_categoria_de_publico.sql`. */
  categoria_publico_id?: number | null;
  subcategoria_publico_id?: number | null;
  /** O cargo do perfil de rede, pelo rótulo — "Deputado estadual". Só em
   *  `tipo === 'perfil_rede'`; o backend recusa nos outros. */
  cargo?: string | null;
  /** A pessoa do CRM de quem este perfil é. Só em perfil de rede.
   *
   *  VAI SEMPRE NA EDIÇÃO, mesmo nula: o PUT substitui a ficha inteira, e
   *  omitir apagaria o vínculo de quem corrigisse só o nome do perfil. */
  interlocutor_id?: string | null;
  ativo?: boolean;
}

export interface InterlocutorEntrada {
  nome: string;
  /** DE QUEM esta pessoa fala. É o que a faz aparecer — ou não — em
   *  "Pela outra parte". */
  instituicao_id?: string | null;
  cargo?: string | null;
  /** A área do contato DENTRO da instituição dele (ex.: "Research") — texto
   *  livre, não o dicionário `area_pessoa` (a área da Aegea). */
  area?: string | null;
  /** Como se chega na pessoa para marcar a agenda. */
  email?: string | null;
  /** Links/handles de redes sociais, texto livre, zero ou mais — não
   *  identifica a rede nem valida formato. */
  redes_sociais?: string[];
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

/** Um cadastro que PODE ser o mesmo ator do perfil. `mencoes` é o número que
 *  diz qual dos dois é a linha com história — e, por isso, qual sobrevive. */
export interface CandidatoDeFusao {
  id: string;
  nome: string;
  tipo: string;
  mencoes: number;
}

export interface CadastroDuplicado {
  id: string;
  nome: string;
  cargo: string | null;
  mencoes: number;
  candidatos: CandidatoDeFusao[];
}

/** Os perfis de rede que se parecem com outro cadastro já existente.
 *
 *  POR QUE EXISTE: o fornecedor de redes manda o handle (`valoreconomico`) e o
 *  clipping manda o nome (`Valor Econômico`). O homônimo exato a migration
 *  `0076` já fundiu sozinha; estes só casam depois de tirar pontuação, e ali
 *  semelhança não é identidade — `Diário SM` e `Diários M` casam assim. Quem
 *  conhece o ator decide, e o que decidir fica guardado.
 */
export function duplicadosDeCadastro(): Promise<CadastroDuplicado[]> {
  return requisitar<CadastroDuplicado[]>('/api/instituicoes/duplicados');
}

/** Funde o perfil de rede no cadastro que fica, com as menções dele.
 *
 *  QUEM SAI É SEMPRE O PERFIL: o cadastro que sobrevive é a linha curada, com
 *  categoria, UF e frente. O servidor recusa (422) o caminho inverso. Não tem
 *  volta. */
export function fundirCadastro(
  perfilId: string,
  sobreviventeId: string,
): Promise<{ id: string; nome: string }> {
  return requisitar<{ id: string; nome: string }>(
    `/api/instituicoes/${perfilId}/fundir`,
    { method: 'POST', body: JSON.stringify({ sobrevivente_id: sobreviventeId }) },
  );
}

/** "São atores diferentes" — tira o par da fila, para sempre.
 *
 *  FORA DE `/api/instituicoes/`: esta decisão não muda cadastro nenhum, e as
 *  rotas de catálogo disparam a recarga do catálogo inteiro por prefixo. */
export function declararCadastroDistinto(
  id: string,
  outroId: string,
  motivo?: string,
): Promise<{ guardado: boolean }> {
  return requisitar<{ guardado: boolean }>('/api/atores-distintos', {
    method: 'POST',
    body: JSON.stringify({ um_id: id, outro_id: outroId, motivo: motivo ?? null }),
  });
}

/** Apaga a instituição que entrou por engano — e as pessoas dela junto. O
 *  servidor recusa (422, contando as agendas) a que já esteve numa reunião:
 *  para essa o caminho é Desativar (`editarInstituicao` com `ativo: false`). */
export function removerInstituicao(id: string): Promise<void> {
  return requisitar<void>(`/api/instituicoes/${id}`, { method: 'DELETE' });
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
  /** Classificação binária Risco/Outros da taxonomia v3. `null` em quem não
   *  foi reconciliado com a taxonomia v4. */
  e_risco: boolean | null;
  /** O tema estratégico (nível 2) da taxonomia v4. `null` em quem não foi
   *  reconciliado com ela. Ver `dicionarios.macro_temas` para a lista e o
   *  pilar (nível 1) de cada um. */
  macro_tema_id: number | null;
  /** `legitimidade` | `credibilidade` | `confianca` | `nao_se_aplica`. */
  camada_lso: string | null;
  /** Os ids dos riscos da matriz corporativa (`dicionarios.riscos`) que este
   *  tema toca. Pode ser mais de um. Ver `migrations/0059`. */
  riscos: number[];
}

export interface TemaEntrada {
  nome: string;
  nivel?: string;
  ativo?: boolean;
  e_risco?: boolean | null;
  macro_tema_id?: number | null;
  camada_lso?: string | null;
  riscos?: number[];
}

/** A lista COMPLETA, inclusive os inativos.
 *
 *  `/api/dicionarios` devolve só os ativos, porque alimenta filtro e
 *  formulário. Quem administra precisa ver o que desativou — senão o assunto
 *  some da tela e reaparece como "já existe" na próxima tentativa de criar.
 */
/* -- dicionários ---------------------------------------------------------- */
//
// A Administração dos vocabulários. `GET /api/dicionarios` (o catálogo) traz
// só os ativos; aqui vem tudo, com a fronteira que o back define: os ABERTOS
// (vocabulário da coordenação) se editam, os FECHADOS (estrutura do modelo)
// vêm com o motivo. Ver `app/api/dicionarios.py`.

export interface ItemAdministravel {
  id: number;
  codigo?: string | null;
  nome: string;
  ordem?: number;
  ativo: boolean;
}

export interface DicionarioAdministravel {
  nome: string;
  rotulo: string;
  editavel: boolean;
  motivo: string | null;
  itens: ItemAdministravel[];
}

export interface ItemDeDicionarioEntrada {
  nome: string;
  ativo?: boolean;
}

export function listarDicionariosParaAdministracao(): Promise<DicionarioAdministravel[]> {
  return requisitar<DicionarioAdministravel[]>('/api/dicionarios/administracao');
}

export function acrescentarNoDicionario(
  dicionario: string,
  entrada: ItemDeDicionarioEntrada,
): Promise<ItemAdministravel> {
  return requisitar<ItemAdministravel>(`/api/dicionarios/${dicionario}`, {
    method: 'POST',
    body: JSON.stringify(entrada),
  });
}

/** Renomeia, desativa ou reativa. O `codigo` não muda: é ele que as agendas
 *  guardam — renomear é mudar o rótulo, não a identidade. */
export function editarNoDicionario(
  dicionario: string,
  id: number,
  entrada: ItemDeDicionarioEntrada,
): Promise<ItemAdministravel> {
  return requisitar<ItemAdministravel>(`/api/dicionarios/${dicionario}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(entrada),
  });
}

/* ------------------------------------------------------------- alegações */

/** O QUE ESTÁ CIRCULANDO — só as ativas, e sem a nota de apuração.
 *
 *  É o que o catálogo carrega para todo mundo: a lista que o formulário
 *  oferece e que a aba de Sinais usa para resolver o texto de cada premissa.
 *  O servidor decide o que sai pelo papel de quem pede. */
export function listarAlegacoes(): Promise<Alegacao[]> {
  return requisitar<Alegacao[]>('/api/alegacoes');
}

/** A LISTA INTEIRA, inclusive as fora de circulação e com a nota de apuração.
 *
 *  Só para a Administração, e o servidor recusa a quem não administra
 *  cadastros: sem as inativas, a alegação desativada some da tela e volta
 *  como "já está cadastrada" na tentativa seguinte — o índice único é sobre o
 *  texto normalizado, e não sobre o que a pessoa vê. */
export function listarAlegacoesParaAdministracao(): Promise<Alegacao[]> {
  return requisitar<Alegacao[]>('/api/alegacoes?incluir_inativas=1');
}

export interface AlegacaoEntrada {
  texto: string;
  temas: number[];
  apuracao_id?: number | null;
  referencia_id?: string | null;
  nota?: string | null;
  ativo?: boolean;
}

/** Quem REGISTRA a consulta cadastra a alegação que ela trouxe — a alegação
 *  nasce do registro, e não da administração. */
export function criarAlegacao(entrada: AlegacaoEntrada): Promise<Alegacao> {
  return requisitar<Alegacao>('/api/alegacoes', {
    method: 'POST',
    body: JSON.stringify(entrada),
  });
}

/** Apurar é da área: muda o status, amarra o posicionamento que responde,
 *  tira de circulação. */
export function editarAlegacao(id: string, entrada: AlegacaoEntrada): Promise<Alegacao> {
  return requisitar<Alegacao>(`/api/alegacoes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(entrada),
  });
}

/* ---------------------------------------------------------------- score */

/** O índice do mês, com as lentes que o formaram.
 *
 *  O CÁLCULO É DO SERVIDOR: o ISR é citado em reunião, e precisa ser o mesmo
 *  para todo mundo — calculado uma vez, com a régua que a coordenação gravou,
 *  e não recomputado em cada navegador. */
export function obterScore(mes: string): Promise<IndiceDoScore> {
  return requisitar<IndiceDoScore>(`/api/score?mes=${mes}`);
}

export function obterSerieDoScore(): Promise<PontoDaSerie[]> {
  return requisitar<PontoDaSerie[]>('/api/score/serie');
}

export function listarFontesDoScore(mes: string): Promise<FonteDoScore[]> {
  return requisitar<FonteDoScore[]>(`/api/score/fontes?mes=${mes}`);
}

/** Sobe o export do fornecedor. SUBSTITUI os meses que o arquivo traz — o
 *  fornecedor reenvia a planilha quando corrige uma classificação, e somar
 *  contaria o mesmo post duas vezes.
 *
 *  DEVOLVE UMA LINHA POR FONTE: um arquivo alimenta mais de uma. O export da
 *  Clipei atende Imprensa e, recortado por público investidor, Mercado; o da
 *  Approach traz Social Listening e Community Management em abas diferentes.
 *  Quem escolhe "Importar" numa das linhas alimenta todas as irmãs. */
export function importarPlanilhaDoScore(
  codigo: string,
  arquivo: File,
  veiculosACriar: string[] = [],
): Promise<ImportacaoDoScore[]> {
  const corpo = new FormData();
  corpo.append('arquivo', arquivo);
  // UM CAMPO COM A LISTA EM JSON, e não um campo por nome.
  //
  // A primeira versão mandava `veiculos_a_criar` repetido, uma vez por veículo.
  // Com 2.628 veículos na primeira carga da Clipei, o parser multipart do
  // servidor recusou o pedido inteiro: "Too many fields. Maximum number of
  // fields is 1000". O limite é proteção do servidor e está certo — quem estava
  // errado era o formato.
  //
  // A LISTA VAZIA NÃO MANDA NADA: o padrão do servidor é não criar veículo
  // nenhum, e é esse padrão que protege o botão "Importar planilha" da
  // Calibração de criar 2.631 instituições sem ninguém ter visto.
  if (veiculosACriar.length) {
    corpo.append('veiculos_a_criar', JSON.stringify(veiculosACriar));
  }
  return requisitar<ImportacaoDoScore[]>(`/api/score/fontes/${codigo}/planilha`, {
    method: 'POST',
    body: corpo,
  });
}

/** Um veículo que a planilha traz e o cadastro compartilhado não tem. */
export interface VeiculoNovo {
  nome: string;
  /** A praça, como o fornecedor a manda — "Santa Catarina", não "SC". */
  uf: string | null;
  /** O alcance derivado da coluna `Abrangência`: Municipal, Regional,
   *  Nacional, Internacional. Nulo quando o fornecedor não disse. */
  esfera: string | null;
  /** Quantas menções da planilha o citam. É por aqui que a lista ordena. */
  mencoes: number;
  /** O cargo que o fornecedor informou, já com as grafias dobradas.
   *
   *  É ELE QUE DECIDE O PÚBLICO do perfil no cadastro — vereador entra em
   *  Poder Legislativo / Municipal, e não em Formadores de Opinião. Quem
   *  autoriza 1.108 criações precisa ver "Iriel Sachet — Vereador". */
  cargo?: string | null;
}

/** Um assunto que a planilha traz e o cadastro de temas não reconhece. */
export interface AssuntoNaoReconhecido {
  /** O texto como o fornecedor o escreveu — é o que se procura na planilha. */
  nome: string;
  /** Quantas linhas o citam. A lista vem ordenada por aqui. */
  mencoes: number;
  /** O NOME EXISTE NO CADASTRO, MAS ESTÁ DESATIVADO. São dois problemas com
   *  dois consertos: nome errado se arruma na planilha, tema desativado se
   *  arruma no cadastro — ou é a planilha que está na taxonomia antiga. */
  desativado: boolean;
}

export interface ConferenciaDaPlanilhaDoScore {
  /** Uma linha por fonte irmã — o que a subida FARIA. */
  previsao: ImportacaoDoScore[];
  /** O que nasceria no cadastro. Na primeira carga da Clipei, 2.631. */
  veiculos_novos: VeiculoNovo[];
  /** Quantos veículos da planilha o cadastro já reconhece. */
  veiculos_reconhecidos: number;
  /** Quantas linhas achariam assunto no cadastro de temas.
   *
   *  POR QUE ESTE NÚMERO IMPORTA: o dossiê recorta por Pilar (N1), Tema
   *  estratégico (N2) e Subtema (N3) pelo vínculo da menção com o tema. Sem
   *  vínculo, a linha não entra em recorte nenhum — subir planilha cujo
   *  assunto não casa é subir dado que nenhum filtro alcança. */
  mencoes_com_tema?: number;
  /** Quantas vieram SEM assunto. Não é erro: a planilha da Bites de 01–09/2026
   *  veio com 84% da coluna em branco, e o conteúdo vai ser refeito. */
  mencoes_sem_assunto?: number;
  /** Os nomes que o cadastro não reconhece, por volume — os 30 maiores. */
  assuntos_nao_reconhecidos?: AssuntoNaoReconhecido[];
}

/** Lê o export do fornecedor e diz o que a subida faria. NADA É GRAVADO.
 *
 *  POR QUE ELA EXISTE. O veículo sem cadastro nasce junto com a subida, e a
 *  conta aparece antes — foi o pedido, nas duas metades. A segunda é o que
 *  torna a primeira segura: a importação de agendas tem escrito no próprio
 *  código que "importação de planilha sem conferência humana cria duplicata de
 *  instituição em massa, e desfazer isso depois é pior que digitar de novo".
 *
 *  O ARQUIVO SOBE DUAS VEZES — aqui e na confirmação. É o preço de não ter
 *  tabela de rascunho, e o mesmo desenho da revisão da taxonomia: guardar as
 *  propostas exigiria a tabela que este fluxo dispensa.
 */
export function conferirPlanilhaDoScore(
  codigo: string,
  arquivo: File,
): Promise<ConferenciaDaPlanilhaDoScore> {
  const corpo = new FormData();
  corpo.append('arquivo', arquivo);
  return requisitar<ConferenciaDaPlanilhaDoScore>(
    `/api/score/fontes/${codigo}/conferencia`,
    { method: 'POST', body: corpo },
  );
}

/** O que a gravação da lista de veículos de investidores mudou. */
export interface VeiculosDeInvestidoresSalvos {
  /** Quantos entraram na lente Mercado agora. */
  marcados: number;
  /** Quantos saíram. É o número que a tela repete de volta: remover é a
   *  operação que a pessoa quer ver confirmada. */
  desmarcados: number;
  /** OS QUE NÃO ENTRARAM, pelo nome, por já terem outra classificação de
   *  público. O servidor não sobrescreve classificação feita à mão — e antes
   *  disto a recusa era muda: a tela dizia "Nada mudou" e limpava a edição. */
  recusados?: string[];
}

/** Define QUAIS veículos a lente Mercado considera — a lista inteira.
 *
 *  DECLARATIVA, e não um alternador por veículo. `editarInstituicao` exige o
 *  cadastro inteiro, e reenviar nome, tipo, UF e tier para mudar um campo
 *  apagaria o que a tela esquecesse. E é assim que a pessoa pensa: ela tem uma
 *  lista de veículos de mercado, mantida numa planilha, e quer que o sistema a
 *  reflita.
 *
 *  ESCREVE NO CATÁLOGO: muda `instituicao.subcategoria_publico_id`. Por isso o
 *  caminho está em `ROTAS_DO_CATALOGO` — é o que faz o Cadastro compartilhado,
 *  os filtros e as fichas verem a mudança sem F5.
 *
 *  `conhecidos` É A LISTA QUE A TELA TINHA EM MÃO quando a pessoa começou a
 *  editar, e o servidor recusa com 409 se ela mudou. Sem isso, duas pessoas
 *  editando a mesma lista se destroem em silêncio: A abre a aba de manhã, B
 *  acrescenta um veículo à tarde, A remove outro e salva — e o pedido de A, que
 *  afirma a lista INTEIRA, desmarca o veículo de B.
 */
export function definirVeiculosDeInvestidores(
  ids: string[],
  conhecidos: string[],
): Promise<VeiculosDeInvestidoresSalvos> {
  return requisitar<VeiculosDeInvestidoresSalvos>('/api/score/veiculos-de-investidores', {
    method: 'PUT',
    body: JSON.stringify({ ids, conhecidos }),
  });
}

/** A aba de Drivers e riscos. Lê as menções uma a uma — ver `DriversDoScore`. */
export function obterDriversDoScore(mes: string): Promise<DriversDoScore> {
  return requisitar<DriversDoScore>(`/api/score/drivers?mes=${mes}`);
}

/** O recorte de tela que a aba Lentes oferece.
 *
 *  OITO DIMENSÕES, e as quatro últimas vieram do padrão Aegea: perfil do autor,
 *  UF, subtema e autor. Nenhuma é obrigatória; o campo some da URL quando vazio.
 *
 *  ELAS SE EMPILHAM — `{ uf: 'RJ', perfil_autor: 'Figura pública' }` é "figuras
 *  públicas no Rio", e não uma coisa OU a outra. É o nível 3 do pacote, e é o que
 *  faz um link reproduzir o ponto exato do caminho. */
export interface FiltroDaLente {
  tier?: string;
  veiculo?: string;
  atributo?: string;
  tema?: string;
  perfil_autor?: string;
  uf?: string;
  subtema?: string;
  autor?: string;
  /** A concessionária citada, como o fornecedor a nomeia. É a terceira dimensão
   *  prioritária do pacote, e era a única dos dois painéis da lente sem lugar
   *  aqui: clicar na barra de uma concessionária não tinha para onde ir. */
  empresa?: string;
  /** A taxonomia de temas do CRM, pelo nome de cada nível: Pilar (N1), Tema
   *  estratégico (N2) e Subtema (N3). Casam pela menção ligada a um tema do
   *  cadastro — a que só traz o texto do fornecedor não entra. */
  tema_n1?: string;
  tema_n2?: string;
  tema_n3?: string;
  /** O sentimento da menção: `pos`, `neu` ou `neg`. */
  sentimento?: string;
}

/** Os valores de tier/veículo/atributo/tema que existem NESTE mês desta
 *  lente — não é dicionário fechado, é o que `GET .../opcoes-de-filtro`
 *  encontrou em `mencao`. */
export interface OpcoesDeFiltroDaLente {
  tiers: string[];
  veiculos: string[];
  atributos: string[];
  temas: string[];
  //: As do padrão Aegea. VAZIAS na lente que não tem o campo — a Imprensa não
  //: manda perfil do autor —, e é por isso que a barra esconde o campo em vez de
  //: abrir um seletor sem opção nenhuma.
  perfis: string[];
  ufs: string[];
  subtemas: string[];
  autores: string[];
  empresas: string[];
  //: A taxonomia do CRM que as menções ligadas a ela alcançam no mês. VAZIAS
  //: enquanto as menções só trazem o texto do fornecedor — e aí a barra não
  //: oferece os três filtros. Opcionais: um back anterior não as manda.
  temas_n1?: string[];
  temas_n2?: string[];
  temas_n3?: string[];
  /** Os sentimentos do mês (pos/neu/neg). Opcional: um back anterior não o manda. */
  sentimentos?: string[];
}

/** Um degrau do caminho até um recorte. */
export interface PassoDaTrilha {
  /** A chave do parâmetro (`uf`) — é o que a tela remove para subir um nível. */
  chave: string;
  /** O nome da dimensão como se lê na aba (`UF`). */
  dimensao: string;
  valor: string;
}

/** O nível 3 do pacote: um pedaço do mês, medido e decomposto — o que o modal
 *  de aprofundamento mostra quando alguém clica num dado.
 *
 *  UM PEDIDO SÓ. O modal abre com tudo ou abre mentindo; cinco chamadas dariam
 *  cinco estados de carregamento dentro do mesmo painel. */
export interface RecorteDaLente {
  lente: string;
  mes: string;
  /** O caminho até aqui. Vazio quando o recorte é o mês inteiro. */
  trilha: PassoDaTrilha[];
  /** A nota que este pedaço teria se fosse o mês. */
  nota: number | null;
  /** Quantos pontos ele tira (negativo) ou põe na nota da lente. O denominador
   *  é o do MÊS, e é isso que faz a soma dos pedaços fechar em `nota − 50`. */
  impacto: number;
  composicao: { positivo: number; neutro: number; negativo: number };
  itens: number;
  /** O total do mês, para "4 de 6 itens" em vez de "4 itens". */
  itens_no_mes: number;
  frase: string;
  ausencia: string | null;
  /** Uma célula por mês do período: o mesmo recorte medido mês a mês. */
  historico: {
    mes: string;
    impacto: number;
    itens: number;
    sem_base: boolean;
    /** A nota DO RECORTE naquele mês — medida no servidor, porque a nota de um
     *  pedaço não existe em lugar nenhum senão medindo. Nula sem recorte: ali
     *  quem tem o número certo é a série que desenha a Jornada. */
    nota: number | null;
  }[];
  /** As dimensões AINDA NÃO usadas, cortadas dentro deste recorte: clicar numa
   *  linha empilha mais um degrau, sem sair do painel. */
  dentro: Bloco[];
  itens_do_recorte: Bloco;
}

function paraConsultaDoFiltro(mes: string, filtro?: FiltroDaLente): string {
  const parametros = new URLSearchParams({ mes });
  //: PERCORRE O OBJETO em vez de listar campo por campo: a lista escrita à mão
  //: era o lugar onde uma dimensão nova se esquecia — a tela mandaria o recorte,
  //: o servidor devolveria o mês inteiro, e nada reclamaria.
  for (const [chave, valor] of Object.entries(filtro ?? {})) {
    if (valor) parametros.set(chave, valor);
  }
  return parametros.toString();
}

/** O dossiê de uma lente: a tela inteira num pedido só.
 *
 *  UM ENDPOINT, UMA TELA — o front não calcula nada disto. Cada bloco vem com
 *  a ficha de procedência junto, que é o conteúdo do "?". `filtro` é o
 *  recorte da barra acima do destaque — ver `FiltroDaLente`. */
export function obterDossieDaLente(
  codigo: string,
  mes: string,
  filtro?: FiltroDaLente,
): Promise<Dossie> {
  return requisitar<Dossie>(`/api/score/lentes/${codigo}/dossie?${paraConsultaDoFiltro(mes, filtro)}`);
}

/** O recorte: o aprofundamento de um dado, num pedido só.
 *
 *  POR QUE ELE EXISTE em vez de o clique filtrar a tela: aplicar o filtro na
 *  tela inteira REFAZ o mês — a nota muda, os painéis se refazem, e quem clicou
 *  perde de vista o mês de onde saiu. É recortar, não aprofundar. O modal põe o
 *  pedaço AO LADO do mês, com a trilha de volta. */
export function obterRecorteDaLente(
  codigo: string,
  mes: string,
  filtro?: FiltroDaLente,
): Promise<RecorteDaLente> {
  return requisitar<RecorteDaLente>(
    `/api/score/lentes/${codigo}/recorte?${paraConsultaDoFiltro(mes, filtro)}`,
  );
}

/** As opções que o filtro desta lente pode oferecer neste mês. */
export function obterOpcoesDeFiltroDaLente(
  codigo: string,
  mes: string,
): Promise<OpcoesDeFiltroDaLente> {
  return requisitar<OpcoesDeFiltroDaLente>(
    `/api/score/lentes/${codigo}/dossie/opcoes-de-filtro?mes=${mes}`,
  );
}

/** A Consulta em profundidade (bloco "Drill down" da aba Lentes) de uma lente
 *  no mês: pilares, temas, subtemas e a amostra de matérias, já com as frases.
 *
 *  A RESPOSTA É O PRÓPRIO `Dados` DO DRILL, com UMA lente em `lentes`: assim
 *  `resolverCaminho` e os quatro níveis leem o mês real sem mudar de forma.
 *  Só a Imprensa e o Mercado respondem; outra lente volta 404. */
export function obterConsultaDaLente(codigo: string, mes: string): Promise<ConsultaDaLente> {
  return requisitar<ConsultaDaLente>(
    `/api/score/lentes/${codigo}/consulta?${new URLSearchParams({ mes })}`,
  );
}

// -- a Base de dados das lentes ----------------------------------------------

/** Uma menção como chegou da fonte — uma linha da Base de dados do Score. */
export interface MencaoDaBase {
  id: string;
  data: string | null;
  mes: string;
  fonte: string;
  /** A fonte está ligada na calibração? Desligada, a linha existe mas não
   *  entra na nota. */
  fonte_no_calculo: boolean;
  veiculo: string | null;
  tier: string | null;
  sentimento: string | null;
  atributo: string | null;
  tema: string | null;
  tema_n1: string | null;
  tema_n2: string | null;
  tema_n3: string | null;
  subtema: string | null;
  empresa: string | null;
  uf: string | null;
  /** Nulo na Imprensa para quem não vê o diretório (é o jornalista). */
  autor: string | null;
  perfil_autor: string | null;
  engajamento: number | null;
  publico_alvo: string | null;
  titulo: string | null;
  link: string | null;
}

export interface PaginaDaBase {
  itens: MencaoDaBase[];
  total: number;
  pagina: number;
  tamanho: number;
}

/** Os valores de cada campo que aparecem nas menções da lente no período. */
export interface OpcoesDaBase {
  fontes: string[];
  sentimentos: string[];
  tiers: string[];
  veiculos: string[];
  atributos: string[];
  temas: string[];
  temas_n1: string[];
  temas_n2: string[];
  temas_n3: string[];
  subtemas: string[];
  empresas: string[];
  ufs: string[];
  autores: string[];
  perfis: string[];
}

/** O que a Base pede ao servidor: período, busca, filtros, página e ordem. */
export interface ConsultaDaBase {
  de?: string;
  ate?: string;
  q?: string;
  filtros?: Record<string, string | undefined>;
  pagina?: number;
  tamanho?: number;
  /** Campo, com "-" na frente para descendente ("-data"). */
  ordenacao?: string;
}

function paraConsultaDaBase(consulta: ConsultaDaBase): string {
  const parametros = new URLSearchParams();
  if (consulta.de) parametros.set('de', consulta.de);
  if (consulta.ate) parametros.set('ate', consulta.ate);
  if (consulta.q?.trim()) parametros.set('q', consulta.q.trim());
  for (const [chave, valor] of Object.entries(consulta.filtros ?? {})) {
    if (valor) parametros.set(chave, valor);
  }
  if (consulta.pagina) parametros.set('pagina', String(consulta.pagina));
  if (consulta.tamanho) parametros.set('tamanho', String(consulta.tamanho));
  if (consulta.ordenacao) parametros.set('ordenacao', consulta.ordenacao);
  return parametros.toString();
}

export function listarMencoesDaBase(lente: string, consulta: ConsultaDaBase): Promise<PaginaDaBase> {
  return requisitar<PaginaDaBase>(`/api/score/base/${lente}/mencoes?${paraConsultaDaBase(consulta)}`);
}

export function obterOpcoesDaBase(lente: string, de?: string, ate?: string): Promise<OpcoesDaBase> {
  return requisitar<OpcoesDaBase>(
    `/api/score/base/${lente}/mencoes/opcoes?${paraConsultaDaBase({ de, ate })}`,
  );
}

export function obterOpcoesDoScore(): Promise<OpcoesDoScore> {
  return requisitar<OpcoesDoScore>('/api/score/opcoes');
}

/** Grava uma VERSÃO NOVA da régua — a tabela só cresce, para saber com que
 *  critério um número foi lido no mês passado. */
export function gravarCalibracao(entrada: CalibracaoEntrada): Promise<Calibracao> {
  return requisitar<Calibracao>('/api/score/calibracao', {
    method: 'PUT',
    body: JSON.stringify(entrada),
  });
}

/** "Restaurar padrão": volta à régua de fábrica GRAVANDO, e não apagando. */
export function restaurarCalibracaoPadrao(): Promise<Calibracao> {
  return requisitar<Calibracao>('/api/score/calibracao', { method: 'DELETE' });
}

export function criarFatoDoScore(entrada: {
  mes: string;
  texto: string;
  efeito: string;
}): Promise<FatoDoMes> {
  return requisitar<FatoDoMes>('/api/score/fatos', {
    method: 'POST',
    body: JSON.stringify(entrada),
  });
}

export function removerFatoDoScore(id: string): Promise<void> {
  return requisitar<void>(`/api/score/fatos/${id}`, { method: 'DELETE' });
}

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
 * Multipart, e não JSON: tem arquivo. Mas ele é OPCIONAL agora — a versão
 * pode viver só do Conteúdo, que por sua vez é obrigatório.
 */
export function criarReferencia(
  metadados: {
    titulo: string;
    tipo: string;
    tema_principal_id: number;
    /** Os demais assuntos. O principal entra sozinho. */
    temas: number[];
    resumo: string;
    conteudo: string;
    atualizado_em: string;
    nota?: string | null;
  },
  arquivo: File | null,
): Promise<Referencia> {
  const corpo = new FormData();
  corpo.append('titulo', metadados.titulo);
  corpo.append('tipo', metadados.tipo);
  corpo.append('tema_principal_id', String(metadados.tema_principal_id));
  corpo.append('atualizado_em', metadados.atualizado_em);
  // Lista vira texto separado por vírgula: multipart não carrega array, e um
  // campo repetido complicaria o cliente mais do que resolve.
  corpo.append('temas', metadados.temas.join(','));
  corpo.append('resumo', metadados.resumo);
  corpo.append('conteudo', metadados.conteudo);
  if (metadados.nota) corpo.append('nota', metadados.nota);
  if (arquivo) corpo.append('arquivo', arquivo);
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
 * por isso que subir a versão de agosto não apaga a de março. O arquivo é
 * opcional, igual na criação; o conteúdo, obrigatório.
 */
export function subirVersaoDaReferencia(
  id: string,
  arquivo: File | null,
  conteudo: string,
  atualizado_em: string,
  nota?: string,
): Promise<Referencia> {
  const corpo = new FormData();
  corpo.append('atualizado_em', atualizado_em);
  corpo.append('conteudo', conteudo);
  if (nota) corpo.append('nota', nota);
  if (arquivo) corpo.append('arquivo', arquivo);
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

// -- importação de agendas por planilha ---------------------------------------

/** Os dois recortes do MESMO formato que o download oferece.
 *
 *  Os nomes sao os do servidor (`MODELOS`, no dominio): um terceiro nome aqui
 *  viraria 422 no download, e a pessoa veria "nao consegui baixar o modelo" sem
 *  ninguem saber por que. */
export type ModeloDePlanilha = 'completo' | 'simplificado';

/** Uma coluna do arquivo, com o que a tela precisa para desenha-la.
 *
 *  O TIPO VEM DO SERVIDOR e nao de uma lista aqui: 59 nomes com o tipo de cada um,
 *  escritos deste lado, envelheceriam na primeira coluna nova — e o erro seria
 *  silencioso, porque a coluna sem tipo receberia a largura padrao. */
export interface ColunaDaImportacao {
  nome: string;
  /** `marca`, `data`, `sigla`, `lista`, `prosa` ou `texto`. Ver `medidas.ts`. */
  tipo: string;
}

/** Uma linha do arquivo, como a conferência a mostra. */
export interface LinhaDaImportacao {
  id: number;
  aba: string;
  linha_origem: number;
  decisao: string;
  interacao_id: string | null;
  dados_brutos: Record<string, unknown>;
  /** O que esta linha herdou da de cima por `idem`, coluna → valor.
   *
   *  A TELA MOSTRA ISTO porque a herança é invisível na planilha: a célula fica
   *  vazia, e sem ver o herdado a pessoa confirmaria 54 agendas confiando na
   *  memória do que havia acima. */
  herdado: Record<string, unknown>;
  /** O que a pessoa COMPLETOU nesta tela, coluna -> valor.
   *
   *  A TELA MARCA A CELULA, e e a contrapartida honesta de editar aqui: dali em
   *  diante o registro difere da planilha que ela guardou. Sem a marca, abrir o
   *  arquivo meses depois mostraria a celula vazia, sem nada explicando de onde
   *  veio o valor que esta no painel. */
  corrigido: Record<string, unknown>;
  proposta: Record<string, unknown> | null;
  divergencias: {
    campo: string;
    valor: string;
    mensagem: string;
    trava: boolean;
    /** A COLUNA DA PLANILHA de onde isto veio, quando ha uma. E por ela que a
     *  tela sabe onde oferecer o campo: `campo` e nome interno
     *  (`data_interacao`), e um campo de grupo corresponde a quatro colunas. */
    coluna: string;
    sugestoes: string[];
    acao: string | null;
    alvo: string | null;
  }[];
}

export interface Importacao {
  id: string;
  arquivo_nome: string;
  situacao: string;
  criado_em: string;
  confirmado_em: string | null;
  /** As colunas daquele arquivo, NA ORDEM — o cabecalho da grade.
   *
   *  Quem subiu o modelo simplificado ve as 22 dele, nao as 58 do completo. A
   *  ordem vem do servidor porque depender da ordem de um objeto JSON para
   *  montar o cabecalho de uma tabela e depender de algo que nenhum contrato
   *  promete. */
  colunas: ColunaDaImportacao[];
  grupos: Grupo[];
  a_criar: ACriar[];
  /** Quantas LINHAS seguram a confirmação. */
  pendencias: number;
  /** Quantas decisões resolvem essas linhas. */
  decisoes_pendentes: number;
  linhas: LinhaDaImportacao[];
}

export interface ConfirmacaoDaImportacao {
  criadas: number;
  cadastros: number;
  situacao: string;
}

/** Baixa o modelo `.xlsx` com o cadastro atual nas listas suspensas.
 *
 *  PASSA POR `requisitar` como todo o resto, com `comoBlob`. Um `fetch` próprio
 *  seria um caminho de rede que falha sem avisar ninguém — sem telemetria de
 *  5xx, sem a tradução de erro de rede —, e há um teste neste projeto contando
 *  as chamadas a `fetch` exatamente para impedir que apareça um segundo.
 */
export async function baixarModeloDeImportacao(modelo: ModeloDePlanilha): Promise<Blob> {
  return requisitar<Blob>(
    `/api/importacoes/modelo?modelo=${modelo}`,
    { method: 'GET' },
    { comoBlob: true },
  );
}

/** Sobe a planilha preenchida e recebe a conferência.
 *
 *  O CORPO É `FormData` e o `Content-Type` fica para o navegador escrever — ele
 *  acrescenta o `boundary` que separa as partes, e escrevê-lo à mão faz o
 *  servidor receber um multipart que não consegue separar.
 */
export async function subirPlanilhaDeAgendas(arquivo: File): Promise<Importacao> {
  const corpo = new FormData();
  corpo.append('arquivo', arquivo);
  return requisitar<Importacao>('/api/importacoes', { method: 'POST', body: corpo });
}

/** A conferência de onde ela parou. */
export async function obterImportacao(id: string): Promise<Importacao> {
  return requisitar<Importacao>(`/api/importacoes/${id}`);
}

/** Uma decisão, todas as linhas que aquele valor segurava. */
export async function resolverDivergencia(
  id: string,
  decisao: { campo: string; valor: string; decisao: string; alvo?: string },
): Promise<Importacao> {
  return requisitar<Importacao>(`/api/importacoes/${id}/resolucoes`, {
    method: 'PATCH',
    body: JSON.stringify(decisao),
  });
}

/** Completa celulas de UMA linha e recebe a conferencia reproposta.
 *
 *  A CONFERENCIA SABIA RESOLVER O VALOR ERRADO e nao o AUSENTE: "este orgao nao
 *  existe" vem com apontar e criar, mas a data em branco vinha com um grupo sem
 *  valor nenhum, sem nada para clicar.
 */
export async function corrigirLinhaDaImportacao(
  id: string,
  linhaId: number,
  celulas: Record<string, string>,
): Promise<Importacao> {
  return requisitar<Importacao>(`/api/importacoes/${id}/linhas/${linhaId}`, {
    method: 'PATCH',
    body: JSON.stringify({ celulas }),
  });
}

/** Exclui uma linha da importacao, ou a restaura.
 *
 *  REVERSIVEL ATE A CONFIRMACAO, e precisa ser: errar numa tela de 54 linhas e
 *  facil, e a planilha nao e o caminho de volta — o arquivo nao fica guardado. A
 *  linha continua na grade, marcada, e volta com um clique.
 */
export async function excluirLinhaDaImportacao(
  id: string,
  linhaId: number,
  excluir: boolean,
): Promise<Importacao> {
  return requisitar<Importacao>(`/api/importacoes/${id}/linhas/${linhaId}`, {
    method: 'PATCH',
    body: JSON.stringify({ descartada: excluir }),
  });
}

/** Cria os cadastros e as agendas — tudo, ou nada. */
export async function confirmarImportacao(id: string): Promise<ConfirmacaoDaImportacao> {
  return requisitar<ConfirmacaoDaImportacao>(`/api/importacoes/${id}/confirmacao`, {
    method: 'POST',
  });
}

/** Desiste da importação. Nada foi criado, então nada há para desfazer. */
export async function cancelarImportacao(id: string): Promise<Importacao> {
  return requisitar<Importacao>(`/api/importacoes/${id}/cancelamento`, { method: 'POST' });
}

// ===========================================================================
// A REVISÃO DA TAXONOMIA DE SUBTEMAS PELA PLANILHA
// ===========================================================================
//
// TRÊS CHAMADAS, e não as dez da importação de agendas. Lá o rascunho vive no
// banco (`importacao_linha`) e a pessoa trabalha nele por dias, com rota para
// resolver divergência, corrigir linha, cancelar e retomar. Aqui nada é
// gravado entre conferir e confirmar: a pessoa corrige a PLANILHA e sobe de
// novo, então não há o que cancelar — fechar o modal já é o cancelamento.
//
// O PREÇO DISSO É A `impressao`, e ela não é detalhe de implementação que o
// front possa ignorar: é o que a conferência devolve e a confirmação exige de
// volta. Sem ela o servidor recusa, porque entre os dois passos alguém pode ter
// editado um subtema pelo próprio Cadastro de Assuntos — e aí a pessoa teria
// aprovado uma mudança e aplicado outra.

/** O que a importação faria com uma linha da planilha. */
export type DecisaoDeSubtema = 'novo' | 'igual' | 'altera' | 'recusada';

/** Por que uma linha foi recusada, na coluna em que a pessoa pode consertar. */
export interface DivergenciaDeSubtema {
  coluna: string;
  valor: string;
  motivo: string;
}

/** O estado de um subtema, como o servidor o compara.
 *
 *  SÃO IDS E NÃO NOMES, porque é o que o banco guarda — a tela resolve os
 *  nomes pelo catálogo que ela já tem em mão. Pedir nomes aqui faria o servidor
 *  repetir, em 149 linhas, o dicionário que a tela carrega uma vez.
 */
export interface EstadoDoSubtema {
  macro_tema_id: number | null;
  camada_lso: string | null;
  e_risco: boolean | null;
  riscos: number[];
}

export interface PropostaDeSubtema {
  /** A linha na PLANILHA, para a pessoa achar a célula — não a ordem na lista. */
  linha: number;
  nome: string;
  decisao: DecisaoDeSubtema;
  /** Preenchidos só em `altera`: é o que permite mostrar o que muda. */
  antes: EstadoDoSubtema | null;
  depois: EstadoDoSubtema | null;
  divergencias: DivergenciaDeSubtema[];
}

export interface ConferenciaDeSubtemas {
  /** Uma chave por decisão, sempre as quatro — zero inclusive. */
  totais: Record<DecisaoDeSubtema, number>;
  propostas: PropostaDeSubtema[];
  /** Devolver isto na confirmação é o que prova que se aplica o que foi visto. */
  impressao: string;
}

export interface ConfirmacaoDeSubtemas {
  criados: number;
  alterados: number;
  iguais: number;
  recusadas: number;
}

/** Baixa a taxonomia atual num `.xlsx`, pronta para editar.
 *
 *  O ARQUIVO VEM PREENCHIDO com os subtemas de hoje, e é isso que o torna útil:
 *  o trabalho não é cadastrar 149 subtemas, é mexer em três. Um modelo vazio
 *  obrigaria a redigitar 146 linhas certas.
 */
export async function baixarModeloDeSubtemas(): Promise<Blob> {
  return requisitar<Blob>(
    '/api/taxonomia/subtemas/modelo',
    { method: 'GET' },
    { comoBlob: true },
  );
}

/** Sobe a planilha e recebe o que mudaria. NADA É GRAVADO. */
export async function conferirPlanilhaDeSubtemas(
  arquivo: File,
): Promise<ConferenciaDeSubtemas> {
  const corpo = new FormData();
  corpo.append('arquivo', arquivo);
  return requisitar<ConferenciaDeSubtemas>('/api/taxonomia/subtemas/conferencia', {
    method: 'POST',
    body: corpo,
  });
}

/** Aplica o que foi conferido — tudo, ou nada.
 *
 *  O ARQUIVO VAI DE NOVO, e não é desperdício: o servidor relê e reconfere
 *  contra o banco daquele instante. Mandar só a `impressao` exigiria guardar as
 *  propostas em algum lugar, que é exatamente a tabela de rascunho que este
 *  desenho dispensa.
 */
export async function confirmarPlanilhaDeSubtemas(
  arquivo: File,
  impressao: string,
): Promise<ConfirmacaoDeSubtemas> {
  const corpo = new FormData();
  corpo.append('arquivo', arquivo);
  corpo.append('impressao', impressao);
  return requisitar<ConfirmacaoDeSubtemas>('/api/taxonomia/subtemas/confirmacao', {
    method: 'POST',
    body: corpo,
  });
}

/* -- o rastreio de risco ------------------------------------------------------- */

/** O recorte da aba de risco virando consulta.
 *
 *  AS DIMENSÕES VÃO COMO PARÂMETRO REPETIDO (`dimensao=tier:relevante`), e não
 *  um parâmetro por dimensão: as dimensões que existem saem do DADO, e um campo
 *  fixo por dimensão obrigaria a mexer aqui a cada base nova — exatamente a
 *  rigidez que a tela deixou de ter. O servidor recusa chave que não conhece,
 *  com a lista das válidas, em vez de ignorar em silêncio.
 *
 *  E AS FONTES VÃO REPETIDAS TAMBÉM (`fonte=clipei&fonte=bites`): são várias ao
 *  mesmo tempo, não uma escolha.
 */
function paraConsultaDoRisco(filtro: FiltroDoRisco = {}): string {
  const parametros = new URLSearchParams();
  if (filtro.cluster) parametros.set('cluster', filtro.cluster);
  if (filtro.risco) parametros.set('risco', filtro.risco);
  for (const fonte of filtro.fontes ?? []) parametros.append('fonte', fonte);
  for (const lente of filtro.lentes ?? []) parametros.append('lente', lente);
  if (filtro.severidade) parametros.set('severidade', filtro.severidade);
  if (filtro.bloco) parametros.set('bloco', filtro.bloco);
  if (filtro.macro) parametros.set('macro', filtro.macro);
  if (filtro.tema) parametros.set('tema', filtro.tema);
  if (filtro.de) parametros.set('de', filtro.de);
  if (filtro.ate) parametros.set('ate', filtro.ate);
  if (filtro.busca?.trim()) parametros.set('busca', filtro.busca.trim());
  for (const [chave, valor] of Object.entries(filtro.dimensoes ?? {})) {
    if (valor) parametros.append('dimensao', `${chave}:${valor}`);
  }
  return parametros.toString();
}

/** A tela inteira num pedido: série do índice, três KPIs, matriz e totais. */
export function obterPainelDeRisco(filtro?: FiltroDoRisco): Promise<PainelDeRisco> {
  return requisitar<PainelDeRisco>(`/api/score/riscos?${paraConsultaDoRisco(filtro)}`);
}

/** O "Relatório de incidentes", paginado. */
export function listarIncidentesDeRisco(
  filtro: FiltroDoRisco,
  pagina = 1,
  tamanho = 50,
): Promise<PaginaDeIncidentes> {
  const parametros = new URLSearchParams(paraConsultaDoRisco(filtro));
  parametros.set('pagina', String(pagina));
  parametros.set('tamanho', String(tamanho));
  return requisitar<PaginaDeIncidentes>(
    `/api/score/riscos/incidentes?${parametros.toString()}`,
  );
}

/** O que a tela pode oferecer como filtro NESTE recorte.
 *
 *  PEDIDO A CADA MUDANÇA DE RECORTE de propósito: a lista de dimensões e de
 *  fontes é o dado respondendo, e não uma lista fixa — fonte sem incidente no
 *  recorte é filtro que volta vazio.
 */
export function obterOpcoesDoRisco(filtro?: FiltroDoRisco): Promise<OpcoesDoRisco> {
  return requisitar<OpcoesDoRisco>(`/api/score/riscos/opcoes?${paraConsultaDoRisco(filtro)}`);
}
