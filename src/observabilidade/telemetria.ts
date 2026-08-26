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
 *
 *  O SDK É CARREGADO SOB DEMANDA, e a razão é medida: importado estaticamente,
 *  ele acrescenta 193 KB ao pacote inicial — 55% a mais que os 354 KB do resto
 *  do painel. Em desenvolvimento isso não aparece, porque sem a connection
 *  string o Vite elimina o SDK inteiro por código morto; o custo existe só em
 *  produção, que é justamente onde ninguém está olhando o tamanho do bundle.
 *
 *  Telemetria não é necessária para a primeira pintura. O `import()` a tira do
 *  caminho crítico e a deixa chegar quando chegar.
 *
 *  O QUE ACONTECE NO INTERVALO: o que for registrado antes de o SDK carregar
 *  entra numa fila e é enviado quando ele chega. Não é refinamento — o caso que
 *  mais importa é o erro durante a primeira renderização, que é o motivo de a
 *  telemetria existir e aconteceria justamente nesse intervalo.
 */

// `import type`, e não `import`: tipo é apagado na compilação, então isto NÃO
// traz o SDK para o pacote. Trocar por um import normal desfaz tudo o que está
// escrito acima, e nada além do tamanho do arquivo denuncia.
import type { ApplicationInsights, SeverityLevel } from '@microsoft/applicationinsights-web';

const CONEXAO = import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING as string | undefined;
const API = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

let cliente: ApplicationInsights | null = null;

/** Estado do carregamento, para não tentar de novo nem enfileirar à toa. */
let situacao: 'parado' | 'carregando' | 'pronto' | 'falhou' = 'parado';

interface Registro {
  acao: (c: ApplicationInsights) => void;
  /** O que fazer se o SDK NUNCA chegar. Ver `iniciarTelemetria`. */
  aoDesistir?: () => void;
}

/** O que foi registrado antes de o SDK chegar. */
const fila: Registro[] = [];

/** Teto da fila.
 *
 *  Um laço de erro — componente que quebra, tenta de novo e quebra outra vez —
 *  encheria a memória enquanto o SDK ainda carrega. Trinta cabe qualquer
 *  rajada de partida; o que passar disso é repetição, e repetição não informa
 *  nada que os trinta primeiros já não digam.
 */
const TETO_DA_FILA = 30;

/** Executa agora, ou enfileira. Devolve `false` quando não fez nem uma coisa
 *  nem outra — fila cheia, SDK que não carregou, telemetria não configurada.
 *
 *  O retorno existe por causa de `registrarErro`: para view e evento, perder um
 *  registro é perder um número. Para erro, perder é perder a única notícia de
 *  que algo quebrou, e aí o console tem de receber.
 */
function aoCarregar(
  acao: (c: ApplicationInsights) => void,
  aoDesistir?: () => void,
): boolean {
  if (cliente) {
    try {
      acao(cliente);
      return true;
    } catch (falha) {
      // O SDK levantando é raro, mas o lugar onde acontece é o pior possível:
      // `registrarErro` é chamado de dentro de `componentDidCatch`, então uma
      // exceção aqui seria uma SEGUNDA falha durante o tratamento da primeira.
      //
      // Devolver `false` faz o chamador cair no console, que é o que resta.
      console.error('[painel] telemetria falhou ao registrar', falha);
      return false;
    }
  }
  if (situacao === 'carregando' && fila.length < TETO_DA_FILA) {
    fila.push({ acao, aoDesistir });
    return true;
  }
  return false;
}

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
  if (situacao !== 'parado' || !CONEXAO) return;
  situacao = 'carregando';

  void import('@microsoft/applicationinsights-web')
    .then(({ ApplicationInsights }) => {
      // `montar` DEVOLVE a instância em vez de só atribuir: é o que dá ao
      // TypeScript um valor comprovadamente não-nulo para o esvaziamento
      // abaixo, sem `!`.
      const pronto = montar(ApplicationInsights);
      cliente = pronto;
      situacao = 'pronto';

      // A fila é esvaziada UMA vez: `aoCarregar` já enxerga `cliente` daqui em
      // diante e executa direto.
      //
      // Cada ação vai em `try` PRÓPRIO. Sem isso, uma que levantasse — telemetria
      // com propriedade que não serializa, por exemplo — interromperia o laço,
      // levaria junto as que ainda não saíram, e a exceção cairia no `catch` de
      // baixo marcando como FALHO um SDK que carregou bem. Telemetria quebrando
      // o que ela observa é o pior desfecho possível.
      for (const { acao } of fila.splice(0)) {
        try {
          acao(pronto);
        } catch (falha) {
          console.error('[painel] registro enfileirado falhou', falha);
        }
      }
    })
    .catch((falha: unknown) => {
      situacao = 'falhou';
      console.error('[painel] telemetria não carregou', falha);

      // A fila precisa sair por algum lugar. Descartá-la calada faria a falha
      // de CARREGAMENTO apagar também os erros que ela deveria ajudar a
      // explicar — e o erro da primeira renderização, o mais valioso de todos,
      // é exatamente um dos que estariam aqui.
      //
      // Só `registrarErro` fornece `aoDesistir`: view e evento perdidos são um
      // número a menos, e não vale sujar o console com eles.
      for (const { aoDesistir } of fila.splice(0)) {
        try {
          aoDesistir?.();
        } catch {
          /* Um fallback que quebra não pode derrubar os outros. */
        }
      }
    });
}

function montar(
  ApplicationInsights: typeof import('@microsoft/applicationinsights-web').ApplicationInsights,
): ApplicationInsights {
  const instancia = new ApplicationInsights({
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

  instancia.loadAppInsights();

  // `cloud_RoleName` é o que separa este serviço do backend quando os dois
  // mandam para o mesmo recurso — e o que faz o Application Map desenhar a
  // seta de um para o outro.
  instancia.addTelemetryInitializer((item) => {
    item.tags = item.tags ?? {};
    item.tags['ai.cloud.role'] = 'painel-reputacional-web';
  });

  instancia.trackPageView();
  return instancia;
}

/** Marca a troca de view. A nav é por estado, então isto é manual. */
export function registrarView(view: string): void {
  aoCarregar((c) => c.trackPageView({ name: view, uri: `/${view}` }));
}

/** Erro de verdade — vai para `exceptions` no App Insights. */
export function registrarErro(
  erro: Error,
  contexto: Record<string, unknown> = {},
): void {
  const noConsole = () => console.error('[painel]', erro, contexto);

  const registrado = aoCarregar(
    (c) =>
      c.trackException({
        exception: erro,
        severityLevel: 3 as SeverityLevel, // Error
        properties: contexto,
      }),
    // Se o SDK nunca chegar, este erro ainda precisa aparecer em algum lugar.
    noConsole,
  );

  // Quando não há para onde mandar, o console é o que resta — e é melhor do que
  // engolir. Cobre os três casos de uma vez: telemetria não configurada (o
  // desenvolvimento, onde o programador está olhando o console), SDK que não
  // carregou, e fila cheia.
  if (!registrado) noConsole();
}

/** Evento de negócio — para responder "quantas pessoas exportaram CSV". */
export function registrarEvento(
  nome: string,
  propriedades: Record<string, unknown> = {},
): void {
  aoCarregar((c) => c.trackEvent({ name: nome }, propriedades));
}

/** Quem está usando. Permite filtrar erros por pessoa no portal. */
export function identificarUsuario(id: string): void {
  aoCarregar((c) => c.setAuthenticatedUserContext(id));
}

/** Garante o envio antes de a aba fechar.
 *
 *  NÃO passa pela fila, de propósito: se o SDK ainda não carregou quando a aba
 *  fecha, não há para onde descarregar, e enfileirar seria guardar trabalho
 *  para um momento que não vem.
 */
export function descarregarTelemetria(): void {
  cliente?.flush();
}
