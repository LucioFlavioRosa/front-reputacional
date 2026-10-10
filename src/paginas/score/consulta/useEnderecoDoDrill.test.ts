// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EVENTO_DO_ENDERECO, navegarNoDrill, useEnderecoDoDrill } from './useEnderecoDoDrill';

beforeEach(() => {
  window.history.replaceState(null, '', '/score/lentes?inicio=2026-08-01&fim=2026-08-31');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('navegarNoDrill', () => {
  it('push empilha uma entrada e preserva caminho e consulta', () => {
    const antes = window.history.length;
    navegarNoDrill({ ativo: true, lente: 'imprensa', pilar: 'governanca' }, 'push');
    expect(window.history.length).toBe(antes + 1);
    expect(window.location.pathname).toBe('/score/lentes');
    expect(window.location.search).toBe('?inicio=2026-08-01&fim=2026-08-31');
    expect(window.location.hash).toBe('#consulta&lente=imprensa&pilar=governanca');
  });

  it('replace troca a entrada atual sem empilhar', () => {
    const antes = window.history.length;
    navegarNoDrill({ ativo: true, lente: 'imprensa', tier: 'Tier 1' }, 'replace');
    expect(window.history.length).toBe(antes);
    expect(window.location.hash).toBe('#consulta&lente=imprensa&tier=Tier%201');
    expect(window.location.search).toBe('?inicio=2026-08-01&fim=2026-08-31');
  });

  it('usa history, nunca atribui location.hash', () => {
    // A PROVA: com `pushState`/`replaceState` neutralizados, o endereço não
    // pode mudar. Se mudar, foi outra via (`location.hash = …`, `location.href`).
    // Contar as chamadas de `history` não bastaria, e ouvir `hashchange`
    // também não: depois do `pushState`, atribuir o MESMO hash não o dispara.
    const push = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
    const replace = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    const antes = window.location.href;
    navegarNoDrill({ ativo: true, lente: 'imprensa' }, 'push');
    navegarNoDrill({ ativo: true, lente: 'mercado' }, 'replace');
    navegarNoDrill({ ativo: true, lente: 'imprensa', pilar: 'governanca' }, 'push');
    expect(window.location.href).toBe(antes);
    expect(push).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenLastCalledWith(
      null,
      '',
      '/score/lentes?inicio=2026-08-01&fim=2026-08-31#consulta&lente=imprensa&pilar=governanca',
    );
  });

  it('dispara EVENTO_DO_ENDERECO a cada navegação', () => {
    const ouvinte = vi.fn();
    window.addEventListener(EVENTO_DO_ENDERECO, ouvinte);
    navegarNoDrill({ ativo: true }, 'push');
    navegarNoDrill({ ativo: true }, 'replace');
    window.removeEventListener(EVENTO_DO_ENDERECO, ouvinte);
    expect(ouvinte).toHaveBeenCalledTimes(2);
  });

  it('endereço inativo remove o hash', () => {
    navegarNoDrill({ ativo: true, pilar: 'x' }, 'replace');
    navegarNoDrill({ ativo: false }, 'replace');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname + window.location.search).toBe('/score/lentes?inicio=2026-08-01&fim=2026-08-31');
  });
});

describe('useEnderecoDoDrill', () => {
  it('lê o hash atual', () => {
    window.history.replaceState(null, '', '/score/lentes#consulta&lente=imprensa&pilar=governanca');
    const { result } = renderHook(() => useEnderecoDoDrill());
    expect(result.current).toEqual({ ativo: true, lente: 'imprensa', pilar: 'governanca' });
  });

  it('sem hash do drill, fica inativo', () => {
    const { result } = renderHook(() => useEnderecoDoDrill());
    expect(result.current).toEqual({ ativo: false });
  });

  it('acompanha push e replace', () => {
    const { result } = renderHook(() => useEnderecoDoDrill());
    act(() => navegarNoDrill({ ativo: true, lente: 'imprensa', pilar: 'governanca' }, 'push'));
    expect(result.current).toEqual({ ativo: true, lente: 'imprensa', pilar: 'governanca' });
    act(() => navegarNoDrill({ ativo: true, lente: 'imprensa', pilar: 'governanca', sent: 'negativas' }, 'replace'));
    expect(result.current.sent).toBe('negativas');
  });

  it('acompanha voltar e avançar do navegador (popstate)', async () => {
    const { result } = renderHook(() => useEnderecoDoDrill());
    act(() => navegarNoDrill({ ativo: true, lente: 'imprensa' }, 'push'));
    act(() => navegarNoDrill({ ativo: true, lente: 'imprensa', pilar: 'governanca' }, 'push'));
    expect(result.current.pilar).toBe('governanca');

    act(() => window.history.back());
    await waitFor(() => expect(result.current).toEqual({ ativo: true, lente: 'imprensa' }));

    act(() => window.history.forward());
    await waitFor(() => expect(result.current.pilar).toBe('governanca'));
  });

  it('popstate disparado à mão também atualiza', () => {
    const { result } = renderHook(() => useEnderecoDoDrill());
    act(() => {
      window.history.replaceState(null, '', '/score/lentes#consulta&lente=mercado');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current).toEqual({ ativo: true, lente: 'mercado' });
  });

  it('o objeto é o mesmo enquanto o hash não muda', () => {
    window.history.replaceState(null, '', '/score/lentes#consulta&lente=imprensa');
    const { result, rerender } = renderHook(() => useEnderecoDoDrill());
    const primeiro = result.current;
    rerender();
    act(() => {
      window.dispatchEvent(new CustomEvent(EVENTO_DO_ENDERECO));
    });
    expect(result.current).toBe(primeiro);
  });

  it('desassina, ao desmontar, o MESMO ouvinte que assinou', () => {
    const adicionar = vi.spyOn(window, 'addEventListener');
    const remover = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useEnderecoDoDrill());
    const ouvinteDe = (chamadas: unknown[][], tipo: string) =>
      chamadas.filter((c) => c[0] === tipo).map((c) => c[1]);

    for (const tipo of ['popstate', EVENTO_DO_ENDERECO]) {
      expect(ouvinteDe(adicionar.mock.calls, tipo), tipo).toHaveLength(1);
      expect(ouvinteDe(remover.mock.calls, tipo), tipo).toHaveLength(0);
    }
    unmount();
    for (const tipo of ['popstate', EVENTO_DO_ENDERECO]) {
      const [assinado] = ouvinteDe(adicionar.mock.calls, tipo);
      const removidos = ouvinteDe(remover.mock.calls, tipo);
      expect(removidos, tipo).toHaveLength(1);
      expect(removidos[0], tipo).toBe(assinado);
    }
  });

  it('depois de desmontar, navegar não renderiza mais', () => {
    let renders = 0;
    const { unmount } = renderHook(() => {
      renders += 1;
      return useEnderecoDoDrill();
    });
    unmount();
    const antes = renders;
    act(() => {
      navegarNoDrill({ ativo: true, lente: 'imprensa', pilar: 'governanca' }, 'push');
      window.history.replaceState(null, '', '/score/lentes#consulta&lente=mercado');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(renders).toBe(antes);
  });
});
