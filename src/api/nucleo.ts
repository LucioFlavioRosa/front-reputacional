/** O transporte: uma requisiÃ§Ã£o, um erro, um cache.
 *
 *  Saiu de `cliente.ts` em 17/10/2026, quando ele tinha 90 funÃ§Ãµes e 2.481
 *  linhas e trÃªs entregas sem relaÃ§Ã£o entre si disputavam o mesmo arquivo.
 *  `cliente.ts` continua existindo como barril de reexportaÃ§Ã£o: nenhum dos
 *  66 arquivos que o importam precisou mudar.
 */

import { registrarErro } from '@/observabilidade/telemetria';
import { Sincronizador, agendasMudaram, catalogoMudou, escreveAgendas, escreveNoCatalogo, escreveNoScore, scoreMudou } from '@/dominio/sincronizacao';

export const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8001';

/** Erro com a mensagem que o backend escreveu — o domínio já explica o que
 *  houve em português, então não inventamos texto por cima. */
export class ErroDaApi extends Error {
  readonly status: number;

  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.name = 'ErroDaApi';
    this.status = status;
  }
}

/** A mensagem de uma falha — e ela NUNCA fala de sintaxe de JSON.
 *
 *  Três casos, do mais preciso ao menos:
 *
 *  1. O BACK EXPLICOU: `detalhe` (nosso) ou `detail` (do FastAPI). O domínio
 *     já escreve em português, e não inventamos texto por cima.
 *  2. O CORPO NÃO ERA JSON: alguém entre o navegador e a API respondeu no
 *     lugar dela. O que importa dizer é o status, a rota e o tipo que veio —
 *     é o trio que localiza a camada, e é o que faltava na tela quando isto
 *     aconteceu na Azure.
 *  3. FALHOU SEM CORPO: o status e a rota, que é tudo que existe.
 */
//: O `<title>` é o que nomeia o autor de uma página de erro: "Application
//: Error" é ingress, "Sign in" é Entra, "Request blocked" é WAF. Ele é a
//: pergunta que ficou sem resposta no episódio da Azure, e é barato de guardar.
const TITULO_DA_PAGINA = /<title[^>]*>([^<]{0,200})<\/title>/i;

/** O rótulo de um corpo que não era JSON — o autor da página, e nada além.
 *
 *  ACHADO MÉDIA DE REVISÃO, e ele estava certo: guardar os primeiros caracteres
 *  crus podia levar dado de pessoa à telemetria. Uma tela de login traz
 *  `redirect=` com a URL que a pessoa pediu; uma página de erro de proxy pode
 *  ecoar a requisição inteira.
 *
 *  Três podas, na ordem que importa:
 *
 *  1. o `<title>`, quando existe — é só o nome do autor, e corta o resto da
 *     página junto;
 *  2. QUERY STRING FORA, antes do e-mail, porque é dentro dela que o dado mora
 *     (`?busca=alguem@x.com`). Isto come um "?" de texto legítimo, e é um
 *     preço que eu pago de boa vontade;
 *  3. e-mail fora, para o que sobrou do lado de fora de uma query.
 */
function rotuloDoCorpoEstranho(corpo: string): string {
  const casado = TITULO_DA_PAGINA.exec(corpo);
  //: Sem título, o corpo sem marcação — uma página de erro de texto puro ainda
  //: diz quem a escreveu na primeira linha.
  const bruto = casado ? casado[1] : corpo.replace(/<[^>]*>/g, ' ');
  return bruto
    .replace(/\s+/g, ' ')
    .replace(/\?\S*/g, '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]{2,}/g, '[e-mail]')
    .trim()
    .slice(0, 80);
}

function mensagemDaFalha(
  resposta: Response,
  caminho: string,
  dados: { detalhe?: string; detail?: string } | null,
  eraJson: boolean,
): string {
  if (dados?.detalhe) return dados.detalhe;
  if (dados?.detail) return dados.detail;
  if (!eraJson) {
    const tipo = resposta.headers.get('content-type') ?? 'tipo não declarado';
    return (
      `Falha ${resposta.status} em ${caminho}: o servidor respondeu ${tipo} em vez de JSON. ` +
      `Isso costuma ser a infraestrutura respondendo no lugar da API — sessão expirada, ` +
      `tempo esgotado no gateway, ou o serviço fora do ar.`
    );
  }
  return `Falha ${resposta.status} em ${caminho}.`;
}

/**
 * Token anti-CSRF da sessão corrente.
 *
 * Vem do corpo de `/api/eu` — e não de um cookie legível, de propósito: o
 * cookie de sessão é `httpOnly`, e é justamente por não ser legível que um site
 * de outra origem não consegue obter o token. Ele consegue disparar a
 * requisição; ler a resposta de `/api/eu`, não, porque o CORS impede.
 *
 * Guardado em memória, e não em `localStorage`: recarregar a página busca de
 * novo, e nada persiste num lugar que qualquer script leia.
 */
let tokenAntiCsrf = '';

export function guardarTokenAntiCsrf(token: string): void {
  tokenAntiCsrf = token;
}

/** `GET`, `HEAD` e `OPTIONS` não alteram estado e não levam token. */
const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Opções que não são do `fetch`: mudam como a RESPOSTA é lida, não o pedido. */
interface ComoLer {
  /** Devolve o corpo como `Blob`, para download de arquivo.
   *
   *  ESTÁ AQUI E NÃO NUM SEGUNDO `fetch` porque `requisitar` é o único lugar que
   *  avisa — erro de rede, 5xx na telemetria, mudança de catálogo. Um `fetch`
   *  paralelo seria um caminho que falha sem ninguém saber, e o teste que conta
   *  as chamadas a `fetch` neste arquivo existe justamente para impedir isso. */
  comoBlob?: boolean;
  /** Vai à rede sempre, sem olhar nem alimentar o que está guardado.
   *
   *  Para o que mede o AGORA — sonda de saúde, contagem que a tela mostra como
   *  "neste instante". */
  semGuardar?: boolean;
}

// ---------------------------------------------------------------------------
// O QUE JÁ FOI BUSCADO, GUARDADO AQUI — e por que aqui, e não nas telas.
//
// O PROBLEMA MEDIDO (12/10/2026). O painel não tinha camada de dado nenhuma, e
// as abas são renderizadas por `{aba === 'x' ? <Componente/> : null}`: sair da
// aba DESMONTA o componente, voltar REMONTA, e o `useEffect` dele busca tudo de
// novo. Na telemetria da Azure, em 36 h, as quatro rotas de dado de referência
// apareceram com a MESMA contagem — `dicionarios` 17, `referencias` 17,
// `pessoas-aegea` 17, `alegacoes` 17 —, uma por abertura de tela, com p95 de
// 1,8 s na primeira. Era isso que fazia cada troca de aba parecer travada.
//
// POR QUE NA CAMADA HTTP. Aqui a correção serve TODAS as telas de uma vez, sem
// componente nenhum precisar saber — e as telas já ficaram prontas: uma função
// nova de leitura entra no cache sem quem a escreveu pensar nisso. A alternativa
// (uma biblioteca de dados) mexeria em todos os componentes e traria dependência
// nova; isto é um mapa e um relógio.
//
// NÃO SERVE DADO VENCIDO. Devolver o velho e revalidar atrás pintaria a tela
// instantânea sempre — mas sem assinatura o componente nunca receberia o valor
// novo, e a pessoa leria número velho sem saber. Então: dentro do prazo, não vai
// à rede; fora do prazo, vai e espera. O prazo é escolhido pelo que o dado é.
//
// A CHAVE É O CAMINHO, e isso vale enquanto a resposta depender só dele. Hoje
// depende: o caminho já carrega a query string, e nenhum GET de JSON deste
// cliente varia por cabeçalho ou por corpo (os GET com `RequestInit` são
// downloads, que saem do cache). Um GET novo cuja resposta mude por cabeçalho
// precisa de `semGuardar` — ou de chave composta. Achado de revisão, anotado
// aqui porque é armadilha futura, não defeito de hoje.
// ---------------------------------------------------------------------------

/** O prazo do dado que muda a cada registro — a janela que cobre trocar de aba
 *  e voltar, sem cobrir uma pausa de café. */
const PRAZO_PADRAO_MS = 20_000;

/** O prazo do CATÁLOGO: dicionários, opções, pessoas, referências, papéis.
 *
 *  Pode ser longo porque não depende do relógio para se corrigir — toda escrita
 *  de catálogo limpa o guardado (ver `requisitar`), que é a mesma regra do
 *  `catalogoMudou` logo abaixo. O prazo só existe para o caso de alguém mudar o
 *  cadastro em OUTRA aba do navegador. */
const PRAZO_DE_CATALOGO_MS = 5 * 60_000;

//: AS ROTAS QUE O PAINEL TRATA COMO CATÁLOGO — as mesmas que `estado/painel.tsx`
//: recarrega quando `catalogoMudou` avisa. Achado MÉDIO de revisão: a primeira
//: versão desta lista deixava `alegacoes`, `instituicoes` e `interlocutores` no
//: prazo curto, embora o painel as carregue como referência igual às outras.
//:
//: O prazo longo aqui é REDE DE SEGURANÇA, e não o mecanismo: o que mantém estas
//: rotas corretas é a invalidação por aviso (local ou de outra aba). Os 5 min
//: cobrem só o caso de alguém mudar o cadastro fora do painel.
const ROTAS_DE_CATALOGO = [
  '/api/dicionarios',
  '/api/referencias',
  '/api/pessoas-aegea',
  '/api/alegacoes',
  '/api/instituicoes',
  '/api/interlocutores',
  '/api/acessos/papeis',
  '/api/score/opcoes',
  '/api/score/riscos/opcoes',
];

function prazoDe(caminho: string): number {
  return ROTAS_DE_CATALOGO.some((rota) => caminho.startsWith(rota))
    ? PRAZO_DE_CATALOGO_MS
    : PRAZO_PADRAO_MS;
}

interface Guardado {
  quando: number;
  dados: unknown;
}

const GUARDADO = new Map<string, Guardado>();

/** Em que geração do cache estamos. Cada esquecimento começa uma nova.
 *
 *  ACHADO ALTA DE REVISÃO, e era corrida de verdade: uma leitura já EM VOO
 *  quando a escrita esquece tudo voltava depois e gravava o dado PRÉ-ESCRITA,
 *  que então valia pelo prazo inteiro. Cenário medido no desenho: a tela começa
 *  `GET /api/interacoes`, a pessoa salva uma interação, o `POST` esquece tudo, e
 *  o GET antigo termina e guarda a lista de antes.
 *
 *  A geração resolve sem cancelar nada: quem voltar de uma geração vencida
 *  entrega o dado a quem pediu (a tela não fica sem resposta) e NÃO o guarda. */
let geracao = 0;

/** As buscas em voo, para que duas telas que montam juntas façam UM pedido.
 *
 *  Não é refinamento: ao abrir o painel, componentes irmãos pedem a mesma rota
 *  no mesmo tique, e sem isto são dois `fetch` idênticos esperando a mesma
 *  resposta. */
const EM_VOO = new Map<string, Promise<unknown>>();

/** Esquece tudo o que foi guardado.
 *
 *  Chamado por toda escrita que deu certo, e exportado para os testes — um mapa
 *  de módulo sobrevive entre testes do mesmo arquivo, e um teste que herda a
 *  resposta de outro é um teste que mente. */
export function limparCacheDaApi(): void {
  GUARDADO.clear();
  EM_VOO.clear();
  geracao += 1;
}

//: ESQUECE TAMBÉM QUANDO O AVISO VEM DE FORA — achado ALTA de revisão.
//:
//: `catalogoMudou`, `agendasMudaram` e `scoreMudou` atravessam o
//: `BroadcastChannel`: a outra aba salva, esta recebe o aviso e recarrega. Sem
//: isto a recarga leria o guardado, e a pessoa veria o estado de antes da
//: escrita da outra aba por até o prazo inteiro — 5 min no catálogo.
//:
//: `antesDeEspalhar` roda antes dos ouvintes, de propósito: o ouvinte da tela
//: pode estar inscrito primeiro, e aí ele leria o guardado antes de alguém o
//: esquecer. Cobre os três sincronizadores com uma inscrição só.
Sincronizador.antesDeEspalhar(limparCacheDaApi);

export async function requisitar<T>(
  caminho: string,
  opcoes: RequestInit = {},
  como: ComoLer = {},
): Promise<T> {
  const metodo = (opcoes.method ?? 'GET').toUpperCase();
  const guardavel = metodo === 'GET' && !como.comoBlob && !como.semGuardar;

  // A ESCRITA ESQUECE O GUARDADO DENTRO DE `sincronizarAposSucesso`, e não
  // aqui: lá o esquecimento acontece ANTES de os ouvintes recarregarem, que é a
  // ordem que importa. Ver o comentário daquela função.
  if (!guardavel) return buscarNaRede<T>(caminho, opcoes, como);

  const guardado = GUARDADO.get(caminho);
  if (guardado && Date.now() - guardado.quando < prazoDe(caminho)) {
    return guardado.dados as T;
  }

  const emVoo = EM_VOO.get(caminho);
  if (emVoo) return emVoo as Promise<T>;

  // FALHA NÃO É GUARDADA: o `.then` só grava no caminho de sucesso, e o
  // `finally` tira o pedido de voo em qualquer caso. Guardar um erro faria uma
  // falha momentânea de rede durar o prazo inteiro.
  const minhaGeracao = geracao;
  const promessa = buscarNaRede<T>(caminho, opcoes, como)
    .then((dados) => {
      // A GERAÇÃO É A GUARDA DA CORRIDA: se alguém esqueceu tudo enquanto esta
      // busca estava em voo, o que ela traz é de antes — entrega a quem pediu,
      // mas não guarda.
      if (minhaGeracao === geracao) GUARDADO.set(caminho, { quando: Date.now(), dados });
      return dados;
    })
    .finally(() => {
      EM_VOO.delete(caminho);
    });

  EM_VOO.set(caminho, promessa as Promise<unknown>);
  return promessa;
}

async function buscarNaRede<T>(
  caminho: string,
  opcoes: RequestInit = {},
  como: ComoLer = {},
): Promise<T> {
  let resposta: Response;
  const metodo = (opcoes.method ?? 'GET').toUpperCase();

  try {
    resposta = await fetch(`${BASE}${caminho}`, {
      ...opcoes,
      credentials: 'include',
      headers: {
        // JSON SÓ QUANDO O CORPO É JSON.
        //
        // Num upload o corpo é `FormData`, e quem precisa escrever o
        // `Content-Type` é o NAVEGADOR: ele acrescenta o `boundary` que separa
        // as partes. Escrevendo `application/json` aqui, o navegador não
        // sobrescreve, o boundary não vai, e o servidor recebe um multipart que
        // não consegue separar — 422 sobre um arquivo perfeitamente válido.
        ...(opcoes.body instanceof FormData
          ? {}
          : { 'Content-Type': 'application/json' }),
        // Sem isto, toda escrita volta 403 depois que o SSO real entrar. O
        // cabeçalho precisa estar também na allowlist do CORS do backend —
        // faltar em qualquer um dos dois lados quebra tudo igual.
        ...(METODOS_SEGUROS.has(metodo) || !tokenAntiCsrf
          ? {}
          : { 'X-CSRF-Token': tokenAntiCsrf }),
        ...opcoes.headers,
      },
    });
  } catch (falhaDeRede) {
    const erro = new ErroDaApi(
      0,
      'Não foi possível falar com o servidor. Verifique se o backend está no ar.',
    );
    // Falha de rede nunca chega ao servidor: se não for registrada aqui, não
    // existe em lugar nenhum.
    registrarErro(erro, {
      caminho,
      origem: 'rede',
      causa: String(falhaDeRede),
    });
    throw erro;
  }

  if (resposta.status === 204) {
    sincronizarAposSucesso(metodo, caminho);
    return undefined as T;
  }

  // O BINÁRIO SAI ANTES DA LEITURA COMO TEXTO, porque um `.xlsx` lido como
  // texto e passado ao `JSON.parse` estoura — e o erro falaria de sintaxe JSON
  // sobre um arquivo perfeitamente válido. O caminho de erro continua o mesmo:
  // um 4xx/5xx aqui ainda traz corpo de texto, e é ele que explica o problema.
  if (como.comoBlob && resposta.ok) {
    sincronizarAposSucesso(metodo, caminho);
    return (await resposta.blob()) as T;
  }

  const corpo = await resposta.text();

  // O `JSON.parse` NÃO VEM ANTES DA CONFERÊNCIA DO STATUS — e vinha.
  //
  // Quando uma camada de infraestrutura responde no lugar da API, o corpo é
  // HTML. MEDIDO no ambiente da Azure em 12/10/2026, subindo planilha: o back
  // devolveu `400`, este nginx repassou com ZERO byte de corpo, e o ingress do
  // Container Apps preencheu o vazio com a página de erro dele. O `JSON.parse`
  // estourava antes da linha que diz o status, e a tela mostrava
  //
  //     Unexpected token '<', "<!DOCTYPE "... is not valid JSON
  //
  // — uma reclamação de sintaxe no lugar de "falha 400 ao subir a planilha".
  //
  // E LOCALMENTE NUNCA APARECEU, o que não é sorte: sem ingress no caminho, o
  // 400 chega com corpo vazio, `dados` fica nulo e a mensagem abaixo sai certa.
  // O defeito só existia onde ninguém depura.
  let dados: { detalhe?: string; detail?: string } | null = null;
  let eraJson = true;
  if (corpo) {
    try {
      dados = JSON.parse(corpo);
    } catch {
      eraJson = false;
    }
  }

  // CORPO QUE NÃO É JSON É FALHA, INCLUSIVE COM 200. Um 200 com HTML é a API
  // não tendo respondido — roteamento, ou tela de login no lugar dela. Seguir
  // com `dados` nulo empurraria o erro para a tela, longe da causa.
  if (!resposta.ok || !eraJson) {
    const erro = new ErroDaApi(resposta.status, mensagemDaFalha(resposta, caminho, dados, eraJson));

    // 5xx é defeito nosso e precisa aparecer. 4xx é o servidor recusando algo
    // esperado (filtro inválido, permissão) — registrar todos viraria ruído,
    // e o backend já os anota do lado dele.
    //
    // CORPO NÃO-JSON ENTRA SEMPRE, seja qual for o status: é a API não tendo
    // respondido, e o backend não registra o que não chegou nele. Era
    // justamente o caso da Azure, que não deixou rastro na telemetria.
    if (resposta.status >= 500 || !eraJson) {
      registrarErro(erro, {
        caminho,
        status: resposta.status,
        metodo: opcoes.method ?? 'GET',
        // O RÓTULO, E NÃO O CORPO — achado MÉDIA de revisão, contra o meu
        // próprio argumento. Eu tinha escrito que o começo de um corpo
        // não-JSON não carrega dado de ninguém "porque não é resposta da nossa
        // API". Não se sustenta: uma tela de login traz `redirect=` com a URL
        // que a pessoa pediu, e uma página de erro de proxy pode ecoar a
        // requisição. `rotuloDoCorpoEstranho` guarda só o que identifica o
        // autor da página, sem query string e sem e-mail.
        ...(eraJson ? {} : { corpoNaoEraJson: true, autorDaPagina: rotuloDoCorpoEstranho(corpo) }),
      });
    }
    throw erro;
  }
  sincronizarAposSucesso(metodo, caminho);
  return dados as T;
}

/** A GARANTIA DE SINCRONIZAÇÃO, num lugar só: esquece o guardado e avisa quem
 *  escuta.
 *
 *  Toda escrita que deu certo numa rota de catálogo avisa `catalogoMudou`, e o
 *  estado do painel — que escuta — recarrega dicionários, instituições,
 *  interlocutores, pessoas e referências. É por isso que uma tela de cadastro
 *  NÃO precisa lembrar de recarregar nada depois de salvar, e uma função de
 *  escrita nova entra na garantia sem que quem a escreveu saiba dela: a regra
 *  é a rota, não a função.
 *
 *  O NOME MUDOU (era `avisarSeMudouOCatalogo`), e por achado de revisão: desde
 *  que o esquecimento do cache passou a morar aqui, "avisar" descrevia metade do
 *  que a função faz.
 *
 *  SÓ DEPOIS DO SUCESSO. Um 4xx não mudou nada, e avisar faria a tela piscar
 *  por um cadastro que não aconteceu. */
function sincronizarAposSucesso(metodo: string, caminho: string): void {
  // ESQUECE O GUARDADO ANTES DE AVISAR, e a ordem é o ponto: o aviso faz as
  // telas recarregarem, e uma tela que recarregue com o cache ainda cheio
  // receberia o estado de antes da escrita.
  //
  // E ESQUECE TUDO, de propósito grosso: uma interação gravada muda a série
  // mensal, os KPIs, o dossiê e as contagens das lentes. Invalidar por rota
  // exigiria uma segunda fonte de verdade sobre quem depende de quem, e ela
  // divergiria em silêncio. O custo de limpar tudo é uma busca a mais depois de
  // gravar — que é exatamente o que se quer depois de gravar.
  //
  // ENTRAR E SAIR SÃO ESCRITAS (`POST /api/auth/...`), então a sessão seguinte
  // não herda nada da anterior na mesma aba.
  if (!METODOS_SEGUROS.has(metodo)) limparCacheDaApi();

  //: PENDÊNCIA CONHECIDA, achado MÉDIO de revisão e anterior a este cache: uma
  //: rota pode casar DOIS barramentos. `/api/score/veiculos-de-investidores`
  //: está em `ROTAS_DO_CATALOGO` e também casa o prefixo de
  //: `ROTAS_DO_SCORE`, então a mesma escrita avisa catálogo E score. Quem
  //: assina os dois — `useConsultaDaLente` — dispara duas buscas e descarta a
  //: primeira. Não corrompe dado; paga rede dobrada numa recarga pós-escrita.
  //: O conserto é no desenho daquele hook (ou em juntar avisos do mesmo tique),
  //: e não aqui — fica registrado para não voltar a ser invisível.
  if (escreveNoCatalogo(metodo, caminho)) catalogoMudou.avisar();
  // AS AGENDAS TÊM O SEU PRÓPRIO AVISO: confirmar uma importação ou salvar uma
  // interação recarrega a Base sozinho, em todas as abas abertas. Antes disto a
  // pessoa confirmava 54 agendas e precisava de um F5 para vê-las.
  if (escreveAgendas(metodo, caminho)) agendasMudaram.avisar();
  // O SCORE TAMBÉM: subir a planilha ou mudar a calibração invalida o cache da
  // Consulta em profundidade, que senão mostraria a árvore antiga ao lado da
  // Jornada já atualizada.
  if (escreveNoScore(metodo, caminho)) scoreMudou.avisar();
}

/* -- interações ----------------------------------------------------------- */
