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

import { ErroDaApi, listarAcessos } from './cliente';
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
    //: O COMEÇO DO CORPO IDENTIFICA O AUTOR: o `<title>` diz se foi ingress,
    //: WAF ou tela de login. É a pergunta que ficou sem resposta no episódio.
    expect(contexto.inicioDoCorpo).toContain('Application Error');
  });

  it('o inicio do corpo registrado e CURTO — nao vai a pagina inteira', async () => {
    responder('<!DOCTYPE html>' + 'x'.repeat(5000), 500, 'text/html');

    await listarAcessos().catch(() => {});

    expect((contextoRegistrado().inicioDoCorpo as string).length).toBeLessThanOrEqual(120);
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

  it('5xx com JSON segue registrado, e UMA vez', async () => {
    responder(JSON.stringify({ detalhe: 'Erro interno.' }), 500);

    await listarAcessos().catch(() => {});

    expect(registrarErro).toHaveBeenCalledTimes(1);
    //: SEM os campos do corpo estranho: este corpo era JSON.
    expect(contextoRegistrado().corpoNaoEraJson).toBeUndefined();
  });
});
