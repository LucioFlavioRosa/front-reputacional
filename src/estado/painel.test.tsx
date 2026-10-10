// @vitest-environment jsdom

/** O recorte no endereço convive com o hash do drill da aba Lentes (decisão
 *  A3 da Consulta em profundidade): regravar a consulta não apaga o hash, e
 *  voltar dentro do drill (que só mexe no hash) não rebusca a base do CRM. */

import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/cliente', () => ({
  listarInstituicoes: vi.fn(() => Promise.resolve([])),
  listarAlegacoes: vi.fn(() => Promise.resolve([])),
  listarInterlocutores: vi.fn(() => Promise.resolve([])),
  listarPessoasAegea: vi.fn(() => Promise.resolve([])),
  listarReferencias: vi.fn(() => Promise.resolve([])),
  obterDicionarios: vi.fn(() => Promise.resolve({})),
  listarRecorteCompleto: vi.fn(() => Promise.resolve({ itens: [], total: 0, truncado: false })),
}));

import { listarRecorteCompleto } from '@/api/cliente';
import { ProvedorDoPainel, usePainel } from '@/estado/painel';

type Painel = ReturnType<typeof usePainel>;

function Espiao({ aoVer }: { aoVer: (painel: Painel) => void }) {
  aoVer(usePainel());
  return null;
}

function montar(): { atual: () => Painel } {
  const vistos: Painel[] = [];
  render(
    <ProvedorDoPainel alcancaOCrm carregaCatalogo={false}>
      <Espiao aoVer={(painel) => vistos.push(painel)} />
    </ProvedorDoPainel>,
  );
  return { atual: () => vistos[vistos.length - 1] };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/score/lentes?uf=RJ#consulta&lente=imprensa&pilar=governanca');
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('ProvedorDoPainel e o hash do drill', () => {
  it('definirRecorte regrava a consulta e preserva o hash', async () => {
    const painel = montar();
    await waitFor(() => expect(vi.mocked(listarRecorteCompleto)).toHaveBeenCalledTimes(1));

    act(() => painel.atual().definirRecorte({ uf: 'SP' }));

    expect(window.location.pathname).toBe('/score/lentes');
    expect(window.location.search).toBe('?uf=SP');
    expect(window.location.hash).toBe('#consulta&lente=imprensa&pilar=governanca');
    expect(painel.atual().recorte).toEqual({ uf: 'SP' });
  });

  it('voltar sem mudar a consulta não troca o recorte nem rebusca a base', async () => {
    const painel = montar();
    await waitFor(() => expect(vi.mocked(listarRecorteCompleto)).toHaveBeenCalledTimes(1));
    const antes = painel.atual().recorte;

    // Só o hash muda, como voltar de um nível do drill para outro.
    act(() => {
      window.history.pushState(null, '', '/score/lentes?uf=RJ#consulta&lente=imprensa');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(painel.atual().recorte).toBe(antes);
    expect(vi.mocked(listarRecorteCompleto)).toHaveBeenCalledTimes(1);
  });

  it('voltar com a consulta mudada relê o recorte', async () => {
    const painel = montar();
    await waitFor(() => expect(vi.mocked(listarRecorteCompleto)).toHaveBeenCalledTimes(1));

    act(() => {
      window.history.pushState(null, '', '/score/lentes?uf=MS');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(painel.atual().recorte).toEqual({ uf: 'MS' });
    await waitFor(() => expect(vi.mocked(listarRecorteCompleto)).toHaveBeenCalledTimes(2));
  });
});
