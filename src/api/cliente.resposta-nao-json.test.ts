/** A resposta que não é JSON, e a mensagem que ela produz.
 *
 *  O QUE ESTE ARQUIVO IMPEDE: uma hora de investigação por causa da mensagem
 *  errada. Em 12/10/2026, subindo planilha no ambiente da Azure, a tela mostrou
 *
 *      Unexpected token '<', "<!DOCTYPE "... is not valid JSON
 *
 *  O servidor tinha respondido `400`, e o `400` estava nos registros do back e
 *  do nginx desde o primeiro segundo. A tela não disse nada disso porque o
 *  cliente chamava `JSON.parse` ANTES de olhar o status: o parse estourava, e a
 *  mensagem que diz o status — que já existia, escrita — nunca era alcançada.
 *
 *  E NÃO APARECIA LOCALMENTE. Sem o ingress da Azure no caminho, o `400` chega
 *  com corpo vazio, e aí o cliente acertava a mensagem. O HTML só existe porque
 *  o ingress preenche um 4xx de corpo vazio com a página de erro dele. Era um
 *  defeito que só o ambiente de verdade mostrava — e por isso ele tem teste.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ErroDaApi,
  baixarModeloDeSubtemas,
  conferirPlanilhaDoScore,
  conferirPlanilhaDoScoreEmPartes,
  limparCacheDaApi,
  listarAcessos,
  requisitar,
} from './cliente';
import { registrarErro } from '@/observabilidade/telemetria';

//: SÓ `registrarErro` É DUBLÊ. Trocar o módulo inteiro obrigaria a repetir
//: todos os seus nomes aqui, e esquecer um daria erro de import — que se lê
//: como defeito do cliente, e não é.
vi.mock('@/observabilidade/telemetria', async (original) => ({
  ...(await original<typeof import('@/observabilidade/telemetria')>()),
  registrarErro: vi.fn(),
}));

/** A página de erro de um ingress — com o DOCTYPE maiúsculo, como a da Azure. */
const PAGINA_DO_INGRESS =
  '<!DOCTYPE html><html><head><title>Application Error</title></head><body>502</body></html>';

function responder(corpo: string | null, status: number, tipo?: string): void {
  vi.stubGlobal('fetch', () =>
    Promise.resolve(
      new Response(corpo, { status, headers: tipo ? { 'content-type': tipo } : undefined }),
    ),
  );
}

async function falhaDe(): Promise<ErroDaApi> {
  return (await listarAcessos().catch((e) => e)) as ErroDaApi;
}

function contextoRegistrado(): Record<string, unknown> {
  return vi.mocked(registrarErro).mock.calls[0][1] as unknown as Record<string, unknown>;
}

beforeEach(() => {
  vi.mocked(registrarErro).mockClear();
  // O CLIENTE GUARDA LEITURA QUE DEU CERTO, num mapa de módulo. Um teste que
  // responde 200 deixa a rota guardada para o seguinte, que então recebe o
  // corpo do anterior em vez do que acabou de dublar.
  limparCacheDaApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('corpo que não é JSON', () => {
  it('um 400 com pagina HTML diz O STATUS, e nao fala de sintaxe', async () => {
    //: O CASO EXATO DA AZURE. A mensagem precisa conter o número que permite
    //: procurar no lugar certo, e não pode mencionar JSON malformado — que
    //: mandaria procurar defeito no servidor da API, onde não havia nenhum.
    responder(PAGINA_DO_INGRESS, 400, 'text/html');

    const falha = await falhaDe();

    expect(falha).toBeInstanceOf(ErroDaApi);
    expect(falha.status).toBe(400);
    expect(falha.message).toContain('400');
    expect(falha.message).toContain('/api/acessos');
    expect(falha.message).toContain('text/html');
    expect(falha.message).not.toMatch(/Unexpected token|is not valid JSON/);
  });

  it('um 200 com pagina HTML TAMBEM falha', async () => {
    //: 200 com HTML é a API não tendo respondido — roteamento, ou tela de login
    //: no lugar dela. Seguir com `dados` nulo empurraria o erro para dentro da
    //: tela, longe da causa, e o próximo a investigar começaria errado.
    responder(PAGINA_DO_INGRESS, 200, 'text/html');

    const falha = await falhaDe();

    expect(falha).toBeInstanceOf(ErroDaApi);
    expect(falha.message).toContain('em vez de JSON');
  });

  it('corpo nao-JSON e REGISTRADO na telemetria, mesmo sendo 4xx', async () => {
    //: 4xx comum não se registra, porque o backend já o anota. Mas um corpo
    //: não-JSON é a API NÃO tendo respondido: o backend não registra o que não
    //: chegou nele, e na Azure o episódio não deixou rastro em lugar nenhum.
    responder(PAGINA_DO_INGRESS, 400, 'text/html');

    await listarAcessos().catch(() => {});

    expect(registrarErro).toHaveBeenCalledTimes(1);
    const contexto = contextoRegistrado();
    expect(contexto.corpoNaoEraJson).toBe(true);
    //: O `<title>` IDENTIFICA O AUTOR: diz se foi ingress, WAF ou tela de
    //: login. É a pergunta que ficou sem resposta no episódio da Azure.
    expect(contexto.autorDaPagina).toBe('Application Error');
  });

  it('o rotulo NAO leva query string nem e-mail para a telemetria', async () => {
    //: ACHADO MÉDIA DE REVISÃO, contra o meu próprio argumento. Eu havia dito
    //: que um corpo não-JSON não carrega dado de pessoa "porque não é resposta
    //: da nossa API". Uma tela de login desmente: ela traz `redirect=` com a
    //: URL que a pessoa pediu.
    responder(
      '<!DOCTYPE html><html><head><title>Sign in — ?redirect=/ficha/alguem@aegea.com.br</title>' +
        '</head><body>contato@aegea.com.br</body></html>',
      401,
      'text/html',
    );

    await listarAcessos().catch(() => {});

    const autor = contextoRegistrado().autorDaPagina as string;
    expect(autor).toContain('Sign in');
    expect(autor).not.toContain('redirect');
    expect(autor).not.toContain('@aegea.com.br');
  });

  it('o rotulo e CURTO — nao vai a pagina inteira', async () => {
    //: Sem `<title>`, sobra o corpo sem marcação: a primeira linha de uma
    //: página de texto puro ainda nomeia quem a escreveu.
    responder('<!DOCTYPE html>' + 'x'.repeat(5000), 500, 'text/html');

    await listarAcessos().catch(() => {});

    expect((contextoRegistrado().autorDaPagina as string).length).toBeLessThanOrEqual(80);
  });
});

describe('o que já funcionava continua funcionando', () => {
  it('a mensagem do BACK tem precedencia sobre a nossa', async () => {
    //: O domínio escreve em português e explica melhor que qualquer texto
    //: genérico. Este é o caso comum, e ele não pode ter regredido.
    responder(
      JSON.stringify({ detalhe: 'A planilha não tem as colunas que o cadastro espera.' }),
      422,
    );

    expect((await falhaDe()).message).toBe(
      'A planilha não tem as colunas que o cadastro espera.',
    );
  });

  it('o `detail` do FastAPI tambem', async () => {
    responder(JSON.stringify({ detail: 'Not authenticated' }), 401);

    expect((await falhaDe()).message).toBe('Not authenticated');
  });

  it('falha SEM corpo diz o status e a rota', async () => {
    //: Era o que acontecia localmente, e estava certo. Continua.
    responder('', 400);

    expect((await falhaDe()).message).toBe('Falha 400 em /api/acessos.');
  });

  it('JSON valido com 200 devolve os dados', async () => {
    responder('[]', 200);

    await expect(listarAcessos()).resolves.toEqual([]);
  });

  it('um DOWNLOAD que falha com HTML nao tenta virar blob', async () => {
    //: SUGESTÃO DA REVISÃO. O caminho `comoBlob` sai antes da leitura como
    //: texto, mas SÓ quando `resposta.ok`. Com 4xx ele cai no fluxo de erro
    //: comum, e é isso que precisa estar fixado: um download que falhou tem de
    //: dizer o status, e não devolver uma página HTML embrulhada em `Blob` —
    //: que o navegador salvaria como se fosse a planilha.
    responder(PAGINA_DO_INGRESS, 502, 'text/html');

    const falha = (await baixarModeloDeSubtemas().catch((e) => e)) as ErroDaApi;

    expect(falha).toBeInstanceOf(ErroDaApi);
    expect(falha.status).toBe(502);
    expect(falha.message).toContain('text/html');
  });

  it('JSON valido que NAO e objeto cai na mensagem genérica', async () => {
    //: SUGESTÃO DA REVISÃO. `JSON.parse` aceita `"texto"` e `123`, então
    //: `eraJson` fica verdadeiro e `dados?.detalhe` fica indefinido. O que
    //: importa é que isso não quebre: a mensagem genérica, com o status, é a
    //: resposta certa para um corpo que o servidor mandou mas não explica.
    responder('123', 500);

    expect((await falhaDe()).message).toBe('Falha 500 em /api/acessos.');
  });

  it('5xx com JSON segue registrado, e UMA vez', async () => {
    responder(JSON.stringify({ detalhe: 'Erro interno.' }), 500);

    await listarAcessos().catch(() => {});

    expect(registrarErro).toHaveBeenCalledTimes(1);
    //: SEM os campos do corpo estranho: este corpo era JSON.
    expect(contextoRegistrado().corpoNaoEraJson).toBeUndefined();
  });
});

describe('a subida de arquivo tem causa provável PRÓPRIA', () => {
  /** POR QUE ISTO É TESTE, com data.
   *
   *  Em 18/10/2026, subindo a planilha da Bites no ambiente implantado, a tela
   *  disse "sessão expirada, tempo esgotado no gateway, ou o serviço fora do
   *  ar". NENHUMA DAS TRÊS ERA VERDADE: o nginx registrou `400` com zero byte
   *  de corpo, duas vezes, a API não recebeu requisição nenhuma, e a causa era
   *  local — o arquivo estava no OneDrive como "disponível quando online" e o
   *  navegador não conseguiu lê-lo até o fim. A mesma planilha, copiada para
   *  uma pasta local, subiu de primeira.
   *
   *  A mensagem mandou duas pessoas procurar no servidor por uma hora. É o
   *  mesmo tipo de custo que o episódio de 12/10 cobrou, e que o cabeçalho
   *  deste arquivo registra.
   */
  function arquivo(): File {
    return new File([new Uint8Array([1, 2, 3])], 'bites.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  async function falhaDaSubida(): Promise<ErroDaApi> {
    return (await conferirPlanilhaDoScore('bites', arquivo()).catch((e) => e)) as ErroDaApi;
  }

  it('um 400 com HTML numa SUBIDA fala do ARQUIVO, e não de sessão expirada', async () => {
    responder(PAGINA_DO_INGRESS, 400, 'text/html');

    const falha = await falhaDaSubida();

    expect(falha.message).toContain('não ter conseguido LER');
    expect(falha.message).toContain('OneDrive');
    //: O TRIO QUE LOCALIZA A CAMADA CONTINUA: status, rota e tipo. A causa nova
    //: entra ANTES dele, não no lugar dele.
    expect(falha.message).toContain('400');
    expect(falha.message).toContain('text/html');
    //: E A INFRAESTRUTURA SEGUE CITADA, como alternativa — só deixou de abrir a
    //: frase, porque abrir era o que fazia procurar no lugar errado.
    expect(falha.message).toContain('infraestrutura');
    expect(falha.message).not.toContain('sessão expirada');
  });

  it('o MESMO 400 num GET mantém a leitura antiga — ali a infra É a causa', async () => {
    //: O CONTROLE QUE IMPEDE A TROCA DE UM PALPITE POR OUTRO. Num GET que volta
    //: HTML não há arquivo nenhum, e dizer "confira seu arquivo" seria errar na
    //: direção oposta. Foi o episódio de 12/10 que escreveu a frase antiga.
    responder(PAGINA_DO_INGRESS, 400, 'text/html');

    const falha = await falhaDe();

    expect(falha.message).toContain('sessão expirada');
    expect(falha.message).not.toContain('OneDrive');
  });

  it('falha de REDE numa subida não manda conferir o backend', async () => {
    //: `fetch` que carrega um `File` ilegível falha exatamente como servidor
    //: fora do ar. Mandar conferir o backend por causa de arquivo que só existe
    //: na nuvem é a mesma investigação perdida, noutro galho do código.
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));

    const falha = await falhaDaSubida();

    expect(falha.message).toContain('interrompida antes de chegar ao servidor');
    expect(falha.message).toContain('OneDrive');
    expect(falha.message).not.toContain('backend está no ar');
  });

  it('falha de REDE num GET continua mandando conferir o backend', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));

    const falha = await falhaDe();

    expect(falha.message).toContain('backend está no ar');
    expect(falha.message).not.toContain('OneDrive');
  });
});

describe('`FormData` NAO e sinonimo de upload de arquivo', () => {
  /** ACHADO DA REVISAO DO CODEX, e procedente — o pior caso era justo o caminho
   *  dos arquivos grandes.
   *
   *  A primeira versao perguntava `opcoes.body instanceof FormData`, e isso e
   *  mais largo que "upload": a ABERTURA da subida em partes manda so `tamanho`
   *  e `nome`, e o FECHAMENTO manda so `partes`. Nenhum dos dois leva arquivo.
   *  Entao uma falha de infraestrutura na abertura passaria a dizer "confira se
   *  o arquivo esta disponivel neste dispositivo" — a inversao exata do defeito
   *  que a mudanca existe para consertar, e na subida que mais importa.
   *
   *  Outros tres caminhos sao multipart sem arquivo: a confirmacao por
   *  `planilha_id`, e as duas de referencia do CRM, onde o anexo e opcional.
   */
  function arquivo(): File {
    return new File([new Uint8Array(4096)], 'clipei.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  it('a ABERTURA da subida em partes nao fala do arquivo — ela nao leva arquivo', async () => {
    //: Ela manda `tamanho` e `nome`, dois campos de texto. Se ela falhar com
    //: HTML, a causa E a infraestrutura, e a mensagem antiga esta certa.
    responder(PAGINA_DO_INGRESS, 400, 'text/html');

    const falha = (await conferirPlanilhaDoScoreEmPartes('clipei', arquivo()).catch(
      (e) => e,
    )) as ErroDaApi;

    expect(falha.message).toContain('infraestrutura');
    expect(falha.message).not.toContain('OneDrive');
    expect(falha.message).not.toContain('conseguido LER');
  });

  it('mas a PARTE, que leva um Blob fatiado, fala do arquivo', async () => {
    /** O CONTROLE QUE PROVA O DETECTOR. A parte de uma subida em pedacos e
     *  `arquivo.slice(...)` — um `Blob`, nao um `File`, e sem nome de arquivo.
     *  Um detector que procurasse `File` deixaria de fora exatamente as onze
     *  requisicoes que carregam os bytes.
     */
    const corpo = new FormData();
    corpo.append('parte', arquivo().slice(0, 1024), 'parte-0');
    responder(PAGINA_DO_INGRESS, 400, 'text/html');

    const falha = (await requisitar('/api/qualquer', { method: 'PUT', body: corpo }).catch(
      (e) => e,
    )) as ErroDaApi;

    expect(falha.message).toContain('conseguido LER');
    expect(falha.message).toContain('OneDrive');
  });

  it('multipart com anexo OPCIONAL ausente nao fala do arquivo', async () => {
    //: `crm.ts` monta `if (arquivo) corpo.append('arquivo', arquivo)` em duas
    //: funcoes de referencia. Sem anexo, nao ha arquivo para culpar.
    const corpo = new FormData();
    corpo.append('titulo', 'Uma referencia sem anexo');
    corpo.append('conteudo', 'texto');
    responder(PAGINA_DO_INGRESS, 400, 'text/html');

    const falha = (await requisitar('/api/referencias', { method: 'POST', body: corpo }).catch(
      (e) => e,
    )) as ErroDaApi;

    expect(falha.message).toContain('infraestrutura');
    expect(falha.message).not.toContain('OneDrive');
  });

  it('e o galho de REDE segue a mesma regra', async () => {
    //: O `catch` do `fetch` tinha a mesma classificacao larga.
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    const semArquivo = new FormData();
    semArquivo.append('partes', '11');

    const falha = (await requisitar('/api/fecha', { method: 'POST', body: semArquivo }).catch(
      (e) => e,
    )) as ErroDaApi;

    expect(falha.message).toContain('backend está no ar');
    expect(falha.message).not.toContain('OneDrive');
  });
});