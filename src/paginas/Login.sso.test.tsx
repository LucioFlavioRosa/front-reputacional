// @vitest-environment jsdom

/** O SSO devolve a pessoa à rota que ela pediu, não à home.
 *
 *  O DEFEITO QUE ISTO PEGA (revisão de 08/10/2026): o botão chamava
 *  `entrarNoPainel(aoEntrar, navegar)` sem destino, então valia o padrão. O
 *  padrão era `/painel` — errado de outra forma, e corrigido para `/` no PR #49
 *  — mas quem recebeu um link direto de uma tela e caiu no login continuava
 *  voltando para a raiz e tendo de procurar o caminho de novo.
 *
 *  POR QUE A URL SERVE DE FONTE: o `App` pinta o login SEM mexer no endereço
 *  (`if (!autenticado) return <Login …>`), então `window.location` ainda guarda
 *  o que a pessoa pediu. Este teste existe porque essa propriedade é do `App`,
 *  não do `Login` — se um dia o login passar a ter rota própria, o destino vira
 *  `/login` e o bug volta calado.
 */

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Login } from '@/paginas/Login';

/** `window.location.href = …` não navega no jsdom, mas também não é observável
 *  por padrão. Troco a propriedade por um espião para ler para onde o botão
 *  mandaria o navegador.
 */
function espiarNavegacao() {
  const ida: string[] = [];
  const original = window.location;
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...original,
      get pathname() {
        return window.__caminho ?? '/';
      },
      get search() {
        return window.__consulta ?? '';
      },
      set href(url: string) {
        ida.push(url);
      },
    },
  });
  return { ida, restaurar: () => Object.defineProperty(window, 'location', { configurable: true, value: original }) };
}

declare global {
  // eslint-disable-next-line no-var
  var __caminho: string | undefined;
  // eslint-disable-next-line no-var
  var __consulta: string | undefined;
}

let espiao: ReturnType<typeof espiarNavegacao>;

beforeEach(() => {
  espiao = espiarNavegacao();
});

afterEach(() => {
  espiao.restaurar();
  window.__caminho = undefined;
  window.__consulta = undefined;
  vi.unstubAllEnvs();
});

describe('o botão de SSO do Login', () => {
  it('leva como destino a rota que o navegador está mostrando', async () => {
    window.__caminho = '/score';
    window.__consulta = '?mes=2026-10';
    const usuario = userEvent.setup();

    render(<Login aoEntrar={async () => false} carregando={false} erro={null} />);
    await usuario.click(screen.getByRole('button', { name: 'Entrar com a conta Aegea' }));

    expect(espiao.ida).toHaveLength(1);
    // O destino vai ESCAPADO, porque viaja como valor de query string.
    expect(espiao.ida[0]).toContain(encodeURIComponent('/score?mes=2026-10'));
  });

  it('na raiz o destino é a própria raiz, como antes', async () => {
    window.__caminho = '/';
    const usuario = userEvent.setup();

    render(<Login aoEntrar={async () => false} carregando={false} erro={null} />);
    await usuario.click(screen.getByRole('button', { name: 'Entrar com a conta Aegea' }));

    expect(espiao.ida[0]).toContain(`redirect=${encodeURIComponent('/')}`);
  });
});
