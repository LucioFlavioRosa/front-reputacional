/** A entrada no painel: quando seguir, e quando sair para o SSO. */

import { describe, expect, it, vi } from 'vitest';
import { urlDeLogin } from '@/api/cliente';
import { entrarNoPainel } from '@/dominio/entrada';

describe('entrarNoPainel', () => {
  it('manda o navegador para o SSO quando não há sessão', async () => {
    /* O caminho de produção. Sem ele a pessoa clica, vê o botão girar e volta
       para o mesmo login — sem erro nenhum no servidor, porque nada foi
       pedido. */
    const navegar = vi.fn();

    await entrarNoPainel(async () => false, navegar);

    expect(navegar).toHaveBeenCalledTimes(1);
    expect(navegar.mock.calls[0][0]).toContain('/api/auth/login');
  });

  it('NÃO redireciona quando a sessão já existe', async () => {
    /* O outro lado, e não é caso de borda: é o modo de desenvolvimento
       (`AUTH_MOCK=true`), em que o backend responde por um usuário fixo. Sair
       para o SSO aqui jogaria fora a sessão que acabou de ser confirmada. */
    const navegar = vi.fn();

    await entrarNoPainel(async () => true, navegar);

    expect(navegar).not.toHaveBeenCalled();
  });

  it('só navega DEPOIS de a confirmação responder', async () => {
    /* Ordem importa: redirecionar antes de saber se há sessão faria toda visita
       sair para o provedor, inclusive a de quem já está autenticado. */
    const ordem: string[] = [];
    const confirmar = async () => {
      ordem.push('confirmou');
      return false;
    };

    await entrarNoPainel(confirmar, () => ordem.push('navegou'));

    expect(ordem).toEqual(['confirmou', 'navegou']);
  });

  it('leva o destino pedido, escapado', async () => {
    const navegar = vi.fn();

    await entrarNoPainel(async () => false, navegar, '/base?frente=imprensa');

    /* Escapado porque o destino vai como VALOR de query string. Sem escapar, o
       `?` e o `=` de dentro dele viram separadores da query externa, e o
       backend receberia `redirect=/base` mais um parâmetro solto. */
    expect(navegar.mock.calls[0][0]).toContain(
      `redirect=${encodeURIComponent('/base?frente=imprensa')}`,
    );
  });
});

describe('urlDeLogin', () => {
  it('aponta para a rota que começa o fluxo OIDC', () => {
    expect(urlDeLogin('/painel')).toMatch(/\/api\/auth\/login\?redirect=/);
  });

  it('recusa levar destino absoluto sem escapar', () => {
    /* O backend já derruba destino externo (`_destino_seguro` na rota), e este
       teste guarda o lado de cá: o valor vai escapado, então não há como ele se
       transformar em outro parâmetro no caminho. */
    const url = urlDeLogin('https://malicioso.example');
    expect(url).not.toContain('redirect=https://');
    expect(url).toContain(encodeURIComponent('https://malicioso.example'));
  });
});
