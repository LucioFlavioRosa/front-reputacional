/** O que o cliente guarda, por quanto tempo, e quando esquece.
 *
 *  O PROBLEMA QUE ISTO CONSERTA, medido na telemetria da Azure em 36 h: as
 *  quatro rotas de catálogo com a MESMA contagem de chamadas — `dicionarios` 17,
 *  `referencias` 17, `pessoas-aegea` 17, `alegacoes` 17 —, uma por abertura de
 *  tela. As abas do painel são renderizadas por `{aba === 'x' ? <C/> : null}`:
 *  sair desmonta, voltar remonta, e o `useEffect` busca tudo outra vez. Com p95
 *  de 1,8 s na primeira busca, cada troca de aba parecia travada.
 *
 *  O QUE ESTES TESTES PRENDEM:
 *
 *  * dentro do prazo, não há rede — é isso que faz a aba abrir instantânea;
 *  * FORA do prazo há rede, e isso não é detalhe: devolver dado vencido pintaria
 *    rápido e mostraria número velho, porque o componente não tem como receber o
 *    valor novo depois (não há assinatura);
 *  * duas telas que montam juntas fazem UM pedido;
 *  * toda escrita esquece tudo — inclusive entrar e sair, para que a sessão
 *    seguinte não herde dado da anterior na mesma aba;
 *  * falha não é guardada, e download nunca é.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  criarInteracao,
  limparCacheDaApi,
  listarAcessos,
  obterDicionarios,
  baixarModeloDeSubtemas,
} from './cliente';

vi.mock('@/observabilidade/telemetria', async (original) => ({
  ...(await original<typeof import('@/observabilidade/telemetria')>()),
  registrarErro: vi.fn(),
}));

/** Um `fetch` que conta chamadas e responde JSON diferente a cada vez.
 *
 *  Responder diferente é o ponto: assim o teste distingue "veio do guardado" de
 *  "foi à rede e por acaso deu igual". */
function fetchQueConta(corpo: (n: number) => unknown, status = 200) {
  let n = 0;
  const espiao = vi.fn(() => {
    n += 1;
    return Promise.resolve(
      new Response(JSON.stringify(corpo(n)), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
  vi.stubGlobal('fetch', espiao);
  return espiao;
}

beforeEach(() => {
  limparCacheDaApi();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('o que já foi buscado', () => {
  it('a segunda leitura da mesma rota não vai à rede', async () => {
    const espiao = fetchQueConta((n) => [{ id: String(n) }]);

    const primeira = await listarAcessos();
    const segunda = await listarAcessos();

    expect(espiao).toHaveBeenCalledTimes(1);
    expect(segunda).toEqual(primeira);
  });

  it('depois do prazo, vai à rede de novo — e devolve o valor NOVO', async () => {
    const espiao = fetchQueConta((n) => [{ id: String(n) }]);

    const primeira = await listarAcessos();
    vi.advanceTimersByTime(20_001);
    const segunda = await listarAcessos();

    expect(espiao).toHaveBeenCalledTimes(2);
    expect(primeira).toEqual([{ id: '1' }]);
    expect(segunda).toEqual([{ id: '2' }]);
  });

  it('o catálogo tem prazo longo: um minuto depois ainda não vai à rede', async () => {
    const espiao = fetchQueConta(() => ({ temas: [] }));

    await obterDicionarios();
    vi.advanceTimersByTime(60_000);
    await obterDicionarios();

    expect(espiao).toHaveBeenCalledTimes(1);
  });

  it('e o catálogo também vence — cinco minutos não é para sempre', async () => {
    const espiao = fetchQueConta(() => ({ temas: [] }));

    await obterDicionarios();
    vi.advanceTimersByTime(5 * 60_000 + 1);
    await obterDicionarios();

    expect(espiao).toHaveBeenCalledTimes(2);
  });

  it('duas telas que pedem junto fazem UM pedido', async () => {
    const espiao = fetchQueConta((n) => [{ id: String(n) }]);

    const [a, b] = await Promise.all([listarAcessos(), listarAcessos()]);

    expect(espiao).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });
});

describe('o que faz esquecer', () => {
  it('uma escrita que deu certo limpa tudo', async () => {
    const espiao = fetchQueConta((n) => [{ id: String(n) }]);

    await listarAcessos();
    await criarInteracao({ assunto: 'qualquer' });
    const depois = await listarAcessos();

    // 1 leitura + 1 escrita + 1 releitura
    expect(espiao).toHaveBeenCalledTimes(3);
    expect(depois).toEqual([{ id: '3' }]);
  });

  it('o catálogo também é esquecido pela escrita, apesar do prazo longo', async () => {
    const espiao = fetchQueConta(() => ({ temas: [] }));

    await obterDicionarios();
    await criarInteracao({ assunto: 'qualquer' });
    await obterDicionarios();

    expect(espiao).toHaveBeenCalledTimes(3);
  });
});

describe('o que nunca é guardado', () => {
  it('a falha não fica guardada: a chamada seguinte tenta de novo', async () => {
    const espiao = fetchQueConta(() => ({ detalhe: 'não hoje' }), 500);

    await listarAcessos().catch(() => undefined);
    await listarAcessos().catch(() => undefined);

    expect(espiao).toHaveBeenCalledTimes(2);
  });

  it('download não é guardado — um `Blob` no mapa serviria arquivo velho', async () => {
    const espiao = vi.fn(() =>
      Promise.resolve(
        new Response(new Blob(['planilha']), {
          status: 200,
          headers: { 'content-type': 'application/vnd.ms-excel' },
        }),
      ),
    );
    vi.stubGlobal('fetch', espiao);

    await baixarModeloDeSubtemas();
    await baixarModeloDeSubtemas();

    expect(espiao).toHaveBeenCalledTimes(2);
  });
});
