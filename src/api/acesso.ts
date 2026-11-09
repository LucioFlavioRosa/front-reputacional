/** Entrar, sair, e quem pode o quÃª.
 *
 *  Saiu de `cliente.ts` em 17/10/2026, quando ele tinha 90 funÃ§Ãµes e 2.481
 *  linhas e trÃªs entregas sem relaÃ§Ã£o entre si disputavam o mesmo arquivo.
 *  `cliente.ts` continua existindo como barril de reexportaÃ§Ã£o: nenhum dos
 *  66 arquivos que o importam precisou mudar.
 */

import type { Acesso, Concessao, Eu, PapelDisponivel, TrilhaDeAcesso } from '@/dominio/tipos';
import { BASE, guardarTokenAntiCsrf, requisitar } from './nucleo';

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

export function listarAcessos(): Promise<Acesso[]> {
  return requisitar<Acesso[]>('/api/acessos');
}

/**
 * Cadastra a pessoa e o acesso dela ANTES do primeiro login.
 *
 * O QUE ISTO CONSERTA: sem ele a pessoa só passava a existir depois de ser
 * RECUSADA — entrava pelo SSO, nascia sem papel, o servidor barrava, e só então
 * aparecia nesta lista para receber acesso. Numa estreia com diretores, isso é
 * um lote de "seu acesso ainda não foi liberado" antes de alguém poder agir.
 *
 * NADA É ENVIADO. Não há e-mail, link nem notificação: grava-se nome, e-mail e
 * papel. Quem avisa a pessoa é quem a cadastra no Entra ID.
 *
 * E NÃO SUBSTITUI O SSO: sem o grupo do Entra não há login, e a linha fica
 * parada. O pré-cadastro adianta o papel, nunca a autenticação.
 *
 * QUEM CASA OS DOIS É O E-MAIL QUE O TOKEN DO TENANT AFIRMA — não
 * `email_verified` do OIDC, e sim `preferred_username`/`email`/`upn` de um
 * `id_token` validado pelo back. Digitado diferente aqui, nunca casa, e a linha
 * fica na lista marcada como "nunca entrou".
 */
export function preCadastrarAcesso(
  email: string,
  nome: string,
  concessao: Concessao,
): Promise<{ id: string }> {
  return requisitar<{ id: string }>('/api/acessos', {
    method: 'POST',
    body: JSON.stringify({ ...concessao, email, nome }),
  });
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
