/** Telemetria do navegador.
 *
 *  O que só se enxerga daqui — e nunca do backend:
 *   - erro de runtime do React, que produz tela branca e **zero** requisição;
 *   - falha de rede: o usuário sem conexão nunca chega ao servidor;
 *   - lentidão percebida, que inclui render, e não só o tempo de resposta.
 *
 *  A peça que amarra os dois lados é a correlação distribuída. Como front e
 *  back ficam em App Services diferentes (origens diferentes), o cabeçalho
 *  `traceparent` só é enviado se o domínio da API estiver declarado em
 *  `correlationHeaderDomains`. Com ele, o clique do usuário e o 500 no
 *  servidor compartilham o mesmo `operation_Id`.
 *
 *  Sem connection string nada é inicializado e todas as funções viram no-op —
 *  é o que permite desenvolver sem recurso provisionado no Azure.
 */

import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import type { SeverityLevel } from '@microsoft/applicationinsights-web';

const CONEXAO = import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING as string | undefined;
const API = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

let cliente: ApplicationInsights | null = null;

/** Domínio da API, para o SDK saber a quem enviar o cabeçalho de correlação. */
function dominioDaApi(): string[] {
  if (!API) return [];
  try {
    return [new URL(API).host];
  } catch {
    return [];
  }
}

export function iniciarTelemetria(): void {
  if (cliente || !CONEXAO) return;

  cliente = new ApplicationInsights({
    config: {
      connectionString: CONEXAO,

      // Correlação com o backend. Sem `enableCorsCorrelation`, o navegador não
      // manda `traceparent` para outra origem, e as duas pontas ficam soltas.
      enableCorsCorrelation: true,
      correlationHeaderDomains: dominioDaApi(),
      distributedTracingMode: 2, // W3C traceparent

      // Erro não capturado e promessa rejeitada — as duas formas de tela branca.
      disableExceptionTracking: false,
      enableUnhandledPromiseRejectionTracking: true,

      // Falha de fetch vira dependência com o status, o que dá para cruzar com
      // o log do backend pelo mesmo operation_Id.
      disableFetchTracking: false,
      enableAjaxErrorStatusText: true,

      // `enableRequestHeaderTracking` fica DESLIGADO, e isso é sobre segurança,
      // não sobre volume de telemetria.
      //
      // Ligado, o SDK copia os cabeçalhos de `init.headers` de cada `fetch` e
      // os grava em `requestHeaders` da dependência
      // (`ajax.js` → `ajaxRecord.js`). Toda escrita deste painel manda
      // `X-CSRF-Token` — ver `@/api/cliente` —, e o token de
      // CSRF é justamente o segredo que o esquema de duplo envio protege.
      //
      // Ou seja: o painel mandaria o segredo anti-CSRF de cada pessoa para
      // dentro do Application Insights, onde ele fica meses, acessível a quem
      // tiver leitura de telemetria — que é muito mais gente do que quem
      // deveria poder agir como aquela pessoa.
      //
      // Nada se perde. `traceparent` é cabeçalho de TRANSPORTE: a correlação
      // com o backend acontece porque ele é ENVIADO, e não porque é registrado
      // como propriedade.
      enableRequestHeaderTracking: false,

      // O de RESPOSTA fica ligado: o navegador não expõe `Set-Cookie` a
      // JavaScript, e o que sobra (`Retry-After` num 429, por exemplo) é
      // exatamente o que se quer olhar quando o limite de taxa aperta.
      enableResponseHeaderTracking: true,

      // A navegação aqui é por estado, não por URL: o rastreio automático de
      // rota depende do history API e nunca dispararia. Quem marca a mudança
      // de view é `registrarView`, chamada pelo app.
      enableAutoRouteTracking: false,

      autoTrackPageVisitTime: true,
      disableCookiesUsage: false,

      // Desliga a busca de configuração REMOTA do SDK.
      //
      // Por padrão o SKU do `applicationinsights-web` embute o `CfgSyncPlugin`
      // apontando para `https://js.monitor.azure.com/scripts/b/ai.config.1.cfg.json`,
      // e ele faz `fetch` na inicialização — `CfgSyncPlugin.js:165` busca
      // sempre que houver `cfgUrl` e `blkCdnCfg` for falso.
      //
      // Duas razões para desligar, e a segunda é a que decide:
      //
      //   1. A CSP do painel bloquearia essa chamada, porque
      //      `js.monitor.azure.com` não está no `connect-src` — e não deveria
      //      estar. A alternativa seria abrir o domínio na CSP; abrir origem
      //      externa para NÃO usar o recurso é o pior dos dois mundos.
      //
      //   2. É configuração vinda de fora, buscada em tempo de execução, capaz
      //      de alterar o comportamento do SDK sem passar por build nem por
      //      revisão. Um painel que trata dados de relacionamento
      //      institucional não precisa desse acoplamento.
      //
      // Para conferir: com a telemetria ligada, `ai.config.1.cfg.json` aparece
      // dentro do bundle, e `blkCdnCfg:!0` ao lado é o que impede a busca.
      extensionConfig: {
        AppInsightsCfgSyncPlugin: {
          blkCdnCfg: true,
          cfgUrl: '',
        },
      },
    },
  });

  cliente.loadAppInsights();

  // `cloud_RoleName` é o que separa este serviço do backend quando os dois
  // mandam para o mesmo recurso — e o que faz o Application Map desenhar a
  // seta de um para o outro.
  cliente.addTelemetryInitializer((item) => {
    item.tags = item.tags ?? {};
    item.tags['ai.cloud.role'] = 'painel-reputacional-web';
  });

  cliente.trackPageView();
}

/** Marca a troca de view. A nav é por estado, então isto é manual. */
export function registrarView(view: string): void {
  cliente?.trackPageView({ name: view, uri: `/${view}` });
}

/** Erro de verdade — vai para `exceptions` no App Insights. */
export function registrarErro(
  erro: Error,
  contexto: Record<string, unknown> = {},
): void {
  if (!cliente) {
    // Sem telemetria configurada, o console é o único lugar que resta. Melhor
    // do que engolir: em desenvolvimento é onde o programador vai olhar.
    console.error('[painel]', erro, contexto);
    return;
  }
  cliente.trackException({
    exception: erro,
    severityLevel: 3 as SeverityLevel, // Error
    properties: contexto,
  });
}

/** Evento de negócio — para responder "quantas pessoas exportaram CSV". */
export function registrarEvento(
  nome: string,
  propriedades: Record<string, unknown> = {},
): void {
  cliente?.trackEvent({ name: nome }, propriedades);
}

/** Quem está usando. Permite filtrar erros por pessoa no portal. */
export function identificarUsuario(id: string): void {
  cliente?.setAuthenticatedUserContext(id);
}

/** Garante o envio antes de a aba fechar. */
export function descarregarTelemetria(): void {
  cliente?.flush();
}
