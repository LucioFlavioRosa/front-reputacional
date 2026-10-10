// @vitest-environment jsdom

/** O hook dos dados reais da Consulta em profundidade (D5): cache por
 *  `lente|mes`, uma requisição por chave, estados e nova tentativa. */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { consultaIlustrativa } from './fixtures/ilustrativo';
import type { Dados } from './tipos';
import { scoreMudou } from '@/dominio/sincronizacao';

import { esquecerConsultas, tentarConsultaDeNovo, useConsultaDaLente } from './useConsultaDaLente';

const { obterConsultaDaLente } = vi.hoisted(() => ({ obterConsultaDaLente: vi.fn() }));
vi.mock('@/api/cliente', () => ({ obterConsultaDaLente }));

beforeEach(() => {
  esquecerConsultas();
  obterConsultaDaLente.mockReset();
  obterConsultaDaLente.mockImplementation((lente: string) => Promise.resolve(consultaIlustrativa(lente)));
});

describe('useConsultaDaLente', () => {
  it('começa carregando e entrega os dados da lente no mês', async () => {
    const { result } = renderHook(() => useConsultaDaLente('imprensa', '2026-08'));
    expect(result.current).toEqual({ dados: null, erro: null, carregando: true });
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.erro).toBeNull();
    expect(result.current.dados?.lentes.map((l) => l.id)).toEqual(['imprensa']);
    expect(obterConsultaDaLente).toHaveBeenCalledWith('imprensa', '2026-08');
  });

  it('a raiz do drill e a busca dividem o cache: uma requisição por chave', async () => {
    const raiz = renderHook(() => useConsultaDaLente('imprensa', '2026-08'));
    const busca = renderHook(() => useConsultaDaLente('imprensa', '2026-08'));
    await waitFor(() => expect(raiz.result.current.dados).not.toBeNull());
    expect(busca.result.current.dados).toBe(raiz.result.current.dados);
    expect(obterConsultaDaLente).toHaveBeenCalledTimes(1);

    // Quem chega depois lê do cache, sem "Carregando" e sem nova requisição.
    const depois = renderHook(() => useConsultaDaLente('imprensa', '2026-08'));
    expect(depois.result.current.dados).toBe(raiz.result.current.dados);
    expect(obterConsultaDaLente).toHaveBeenCalledTimes(1);
  });

  it('trocar de mês troca o retrato no mesmo render: nunca a árvore do mês anterior', async () => {
    const { result, rerender } = renderHook(({ mes }) => useConsultaDaLente('imprensa', mes), {
      initialProps: { mes: '2026-08' },
    });
    await waitFor(() => expect(result.current.dados).not.toBeNull());
    rerender({ mes: '2026-09' });
    expect(result.current).toEqual({ dados: null, erro: null, carregando: true });
    await waitFor(() => expect(result.current.dados).not.toBeNull());
    expect(obterConsultaDaLente).toHaveBeenLastCalledWith('imprensa', '2026-09');
    // Voltar ao mês já visto mostra a árvore na hora.
    rerender({ mes: '2026-08' });
    expect(result.current.dados).not.toBeNull();
    expect(obterConsultaDaLente).toHaveBeenCalledTimes(2);
  });

  it('lente sem drill no front, ou nula, não busca nada', () => {
    const sociedade = renderHook(() => useConsultaDaLente('sociedade', '2026-08'));
    const nula = renderHook(() => useConsultaDaLente(null, '2026-08'));
    expect(sociedade.result.current).toEqual({ dados: null, erro: null, carregando: false });
    expect(nula.result.current).toEqual({ dados: null, erro: null, carregando: false });
    expect(obterConsultaDaLente).not.toHaveBeenCalled();
  });

  it('falha vira erro; a próxima montagem da mesma chave tenta de novo', async () => {
    obterConsultaDaLente.mockRejectedValueOnce(new Error('Serviço indisponível.'));
    const primeira = renderHook(() => useConsultaDaLente('mercado', '2026-08'));
    await waitFor(() => expect(primeira.result.current.erro).toBe('Serviço indisponível.'));
    expect(primeira.result.current).toMatchObject({ dados: null, carregando: false });
    primeira.unmount();

    const segunda = renderHook(() => useConsultaDaLente('mercado', '2026-08'));
    await waitFor(() => expect(segunda.result.current.dados).not.toBeNull());
    expect(segunda.result.current.erro).toBeNull();
    expect(obterConsultaDaLente).toHaveBeenCalledTimes(2);
  });

  it('resposta que chega depois de esquecer o cache é descartada', async () => {
    let entregar: (dados: Dados) => void = () => {};
    obterConsultaDaLente.mockImplementationOnce(
      () =>
        new Promise<Dados>((resolver) => {
          entregar = resolver;
        }),
    );
    const { result, unmount } = renderHook(() => useConsultaDaLente('imprensa', '2026-08'));
    expect(result.current.carregando).toBe(true);
    unmount();
    esquecerConsultas();
    entregar(consultaIlustrativa('imprensa'));
    await Promise.resolve();

    const nova = renderHook(() => useConsultaDaLente('imprensa', '2026-08'));
    expect(nova.result.current.carregando).toBe(true);
    await waitFor(() => expect(nova.result.current.dados).not.toBeNull());
    expect(obterConsultaDaLente).toHaveBeenCalledTimes(2);
  });

  it('escrita no Score (planilha, calibração): a chave na tela é pedida de novo, sem "Carregando"', async () => {
    const julho = consultaIlustrativa('imprensa');
    const novo = { ...julho, meta: { ...julho.meta, dataCorte: '2026-08-30' } };
    obterConsultaDaLente.mockResolvedValueOnce(julho).mockResolvedValueOnce(novo);
    const { result } = renderHook(() => useConsultaDaLente('imprensa', '2026-08'));
    await waitFor(() => expect(result.current.dados).toBe(julho));

    act(() => scoreMudou.avisar());
    // A ÁRVORE ANTIGA FICA até a nova chegar: o drill não volta ao Nível 1.
    expect(result.current.dados).toBe(julho);
    expect(result.current.carregando).toBe(false);
    await waitFor(() => expect(result.current.dados).toBe(novo));
    expect(obterConsultaDaLente).toHaveBeenCalledTimes(2);
  });

  it('escrita no Score com o drill fechado: a próxima montagem (voltar à aba Lentes) pede de novo', async () => {
    const primeira = renderHook(() => useConsultaDaLente('mercado', '2026-08'));
    await waitFor(() => expect(primeira.result.current.dados).not.toBeNull());
    primeira.unmount();

    scoreMudou.avisar();
    // Ninguém na tela: nada é pedido agora.
    expect(obterConsultaDaLente).toHaveBeenCalledTimes(1);

    const segunda = renderHook(() => useConsultaDaLente('mercado', '2026-08'));
    // O retrato antigo aparece na hora, e o novo é pedido.
    expect(segunda.result.current.dados).not.toBeNull();
    expect(obterConsultaDaLente).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(obterConsultaDaLente).toHaveBeenLastCalledWith('mercado', '2026-08'));
  });

  it('resposta em voo quando o Score muda é descartada e pedida de novo', async () => {
    let entregarVelha: (dados: Dados) => void = () => {};
    const velha = consultaIlustrativa('imprensa');
    const nova = { ...velha, meta: { ...velha.meta, dataCorte: '2026-08-29' } };
    obterConsultaDaLente
      .mockImplementationOnce(
        () =>
          new Promise<Dados>((resolver) => {
            entregarVelha = resolver;
          }),
      )
      .mockResolvedValueOnce(nova);
    const { result } = renderHook(() => useConsultaDaLente('imprensa', '2026-08'));
    act(() => scoreMudou.avisar());
    expect(obterConsultaDaLente).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.dados).toBe(nova));
    await act(async () => {
      entregarVelha(velha);
      await Promise.resolve();
    });
    expect(result.current.dados).toBe(nova);
  });

  it('tentarConsultaDeNovo (o botão da faixa de erro) refaz o pedido com a tela montada', async () => {
    obterConsultaDaLente.mockRejectedValueOnce(new Error('Serviço indisponível.'));
    const { result } = renderHook(() => useConsultaDaLente('imprensa', '2026-08'));
    await waitFor(() => expect(result.current.erro).toBe('Serviço indisponível.'));

    act(() => tentarConsultaDeNovo('imprensa', '2026-08'));
    expect(result.current).toEqual({ dados: null, erro: null, carregando: true });
    await waitFor(() => expect(result.current.dados).not.toBeNull());
    expect(obterConsultaDaLente).toHaveBeenCalledTimes(2);

    // Com dados atuais, não pede de novo.
    act(() => tentarConsultaDeNovo('imprensa', '2026-08'));
    expect(obterConsultaDaLente).toHaveBeenCalledTimes(2);
  });
});
