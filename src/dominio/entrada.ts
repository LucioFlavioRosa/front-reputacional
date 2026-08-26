/**
 * O que acontece quando alguém clica em "Entrar".
 *
 *  Está fora do componente pelo mesmo motivo que `concessao.ts`: é aqui que o
 *  erro dói, e função pura é o que permite testar sem montar árvore de React —
 *  este projeto não tem jsdom nem testing-library.
 *
 *  O erro que dói é específico: com `AUTH_MOCK=true` basta buscar `/api/eu`,
 *  porque o backend responde por um usuário fixo. Com SSO de verdade, `/api/eu`
 *  devolve 401 e é preciso MANDAR o navegador para `/api/auth/login`. Uma
 *  implementação que só cubra o primeiro caso funciona em desenvolvimento e
 *  deixa a tela de login parada em produção, sem erro visível.
 */

import { urlDeLogin } from '@/api/cliente';

/**
 * Tenta entrar e, se não houver sessão, manda o navegador para o SSO.
 *
 * As duas dependências entram por parâmetro, e não é ginástica de teste: são
 * genuinamente duas coisas diferentes que o componente sabe e esta função não.
 *
 * @param confirmarSessao  pergunta ao backend quem somos. `true` se já há
 *                         sessão — o que também cobre `AUTH_MOCK=true`, onde o
 *                         backend responde por um usuário fixo e não há para
 *                         onde redirecionar.
 * @param navegar          sai da aplicação. Precisa ser navegação do NAVEGADOR,
 *                         nunca `fetch`: o fluxo OIDC é uma sequência de
 *                         redirecionamentos entre painel, provedor e painel de
 *                         novo, e a tela de senha do provedor tem de aparecer
 *                         para uma pessoa.
 * @param destino          para onde voltar depois de autenticar. Relativo,
 *                         porque o backend recusa endereço absoluto — seria um
 *                         redirecionamento aberto.
 */
export async function entrarNoPainel(
  confirmarSessao: () => Promise<boolean>,
  navegar: (url: string) => void,
  destino = '/painel',
): Promise<void> {
  if (await confirmarSessao()) return;
  navegar(urlDeLogin(destino));
}
