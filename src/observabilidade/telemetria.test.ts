/** A fila da telemetria: o que acontece antes de o SDK chegar.
 *
 *  O SDK do Application Insights é carregado sob demanda, para tirar 192 KB do
 *  pacote inicial. A consequência é uma janela entre a página abrir e o SDK
 *  responder, e o registro mais valioso do painel — o erro da primeira
 *  renderização — cai exatamente nela.
 *
 *  Este arquivo existe porque essa fila já perdeu erro de duas maneiras
 *  diferentes durante a revisão: quando o SDK falhava ao carregar, e quando uma
 *  ação enfileirada levantava exceção. Nenhuma das duas era visível lendo o
 *  código.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CONEXAO = 'InstrumentationKey=00000000-0000-0000-0000-000000000000';

/** Uma instância de mentira do SDK, que registra o que recebeu.
 *
 *  O construtor é `function`, e NUNCA arrow: `montar()` chama
 *  `new ApplicationInsights(...)`, e arrow function não pode ser construída —
 *  o erro seria "is not a constructor", engolido pelo `catch` do `import()`, e
 *  o teste falharia dizendo que o SDK não carregou.
 */
function sdkFalso() {
  const excecoes: unknown[] = [];
  const instancia = {
    loadAppInsights: vi.fn(),
    addTelemetryInitializer: vi.fn(),
    trackPageView: vi.fn(),
    trackEvent: vi.fn(),
    setAuthenticatedUserContext: vi.fn(),
    trackException: vi.fn((x: unknown) => excecoes.push(x)),
    flush: vi.fn(),
  };
  return { instancia, excecoes };
}

/** Carrega o módulo do zero, com o SDK trocado pelo que for passado. */
async function carregarModulo(sdk: { ApplicationInsights: unknown } | Error) {
  vi.resetModules();
  vi.stubEnv('VITE_APPINSIGHTS_CONNECTION_STRING', CONEXAO);
  vi.doMock('@microsoft/applicationinsights-web', () =>
    sdk instanceof Error ? Promise.reject(sdk) : sdk,
  );
  return import('@/observabilidade/telemetria');
}

let console_erro: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  console_erro = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock('@microsoft/applicationinsights-web');
  console_erro.mockRestore();
});

describe('erro registrado antes de o SDK chegar', () => {
  it('chega ao SDK quando ele carrega', async () => {
    const { instancia, excecoes } = sdkFalso();
    const telemetria = await carregarModulo({
      ApplicationInsights: vi.fn(function () {
        return instancia;
      }),
    });

    telemetria.iniciarTelemetria();
    // Ainda carregando: o erro entra na fila, não no SDK.
    telemetria.registrarErro(new Error('quebrou no primeiro render'));
    expect(excecoes).toHaveLength(0);

    // Deixa o `import()` resolver.
    await vi.waitFor(() => expect(excecoes).toHaveLength(1));

    const registrado = excecoes[0] as { exception: Error };
    expect(registrado.exception.message).toBe('quebrou no primeiro render');
  });

  it('vai para o console se o SDK NUNCA carregar', async () => {
    const telemetria = await carregarModulo(new Error('rede caiu'));

    telemetria.iniciarTelemetria();
    const erro = new Error('quebrou e a telemetria também');
    telemetria.registrarErro(erro);

    // Descartar a fila calada faria a falha de CARREGAMENTO apagar também os
    // erros que ela deveria ajudar a explicar.
    await vi.waitFor(() => {
      expect(console_erro).toHaveBeenCalledWith('[painel]', erro, {});
    });
  });
});

describe('o SDK levantando não pode derrubar quem o chamou', () => {
  it('erro cai no console quando trackException levanta', async () => {
    const { instancia } = sdkFalso();
    instancia.trackException = vi.fn(() => {
      throw new Error('SDK em mau estado');
    });
    const telemetria = await carregarModulo({
      ApplicationInsights: vi.fn(function () {
        return instancia;
      }),
    });

    telemetria.iniciarTelemetria();
    await vi.waitFor(() => expect(instancia.loadAppInsights).toHaveBeenCalled());

    const erro = new Error('o erro de verdade');
    // Não pode levantar: isto é chamado de dentro de `componentDidCatch`, e uma
    // exceção aqui seria uma SEGUNDA falha durante o tratamento da primeira.
    expect(() => telemetria.registrarErro(erro)).not.toThrow();
    expect(console_erro).toHaveBeenCalledWith('[painel]', erro, {});
  });
});

describe('sem connection string', () => {
  it('nada é carregado e o erro vai para o console', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_APPINSIGHTS_CONNECTION_STRING', '');
    const carregou = vi.fn();
    vi.doMock('@microsoft/applicationinsights-web', () => {
      carregou();
      return { ApplicationInsights: vi.fn(function () { return {}; }) };
    });

    const telemetria = await import('@/observabilidade/telemetria');
    telemetria.iniciarTelemetria();

    const erro = new Error('em desenvolvimento');
    telemetria.registrarErro(erro);

    expect(carregou).not.toHaveBeenCalled();
    expect(console_erro).toHaveBeenCalledWith('[painel]', erro, {});
  });
});
