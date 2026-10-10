import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Page, Route } from '@playwright/test';

// -------------------------------------------------------------------------
// A API SIMULADA DO TESTE DE PONTA A PONTA
//
// O teste roda sem login e sem o back. Cada resposta vem de um JSON em
// `e2e/fixtures/`, indexado por `e2e/fixtures/rotas.json` (método + caminho).
//
// A CONSULTA (`?…`) NÃO ENTRA NA CHAVE, de propósito: o front monta parâmetros
// a partir do mês e do recorte, e uma chave que dependesse deles quebraria o
// teste a cada virada de mês sem que nada tivesse mudado na tela.
//
// QUALQUER CHAMADA SEM RESPOSTA GRAVADA VOLTA 400 e fica anotada em
// `naoGravadas`, que o teste exige vazia. Deixar passar para a rede tornaria o
// teste dependente de um back de pé; abortar em silêncio esconderia a chamada
// nova que alguém acabou de acrescentar.
//
// AS RESPOSTAS DE HOJE SÃO SINTÉTICAS, e não gravadas do back: o usuário fixo
// do `AUTH_MOCK` não alcança o portal do Score (o e-mail dele já está
// provisionado com outro identificador, e o papel `crm_edicao` só abre o CRM).
// Foram escritas a partir dos tipos do front (`Eu`, `OpcoesDoScore`,
// `IndiceDoScore`, `PontoDaSerie`, `Dossie`, `OpcoesDeFiltroDaLente`) com o
// mínimo para a aba Lentes abrir. Quando houver um caminho autorizado, troque
// cada arquivo pela resposta gravada, mantendo os nomes de `rotas.json`.
//
// AS FONTES DO GOOGLE recebem uma folha vazia: o teste não depende de rede
// externa, e a tela cai na fonte reserva do `index.css`.
// -------------------------------------------------------------------------

/** Base que o Vite do teste recebe em `VITE_API_URL`. Nada responde nela. */
export const BASE_DA_API = 'http://localhost:8002';

interface RotaGravada {
  metodo: string;
  caminho: string;
  status?: number;
  arquivo: string;
}

const PASTA = join(import.meta.dirname, 'fixtures');

function carregarRotas(): Map<string, { status: number; corpo: string }> {
  const rotas = JSON.parse(readFileSync(join(PASTA, 'rotas.json'), 'utf-8')) as RotaGravada[];
  return new Map(
    rotas.map((r) => [
      `${r.metodo.toUpperCase()} ${r.caminho}`,
      { status: r.status ?? 200, corpo: readFileSync(join(PASTA, r.arquivo), 'utf-8') },
    ]),
  );
}

export interface ApiSimulada {
  /** Chamadas que o front fez e que não têm resposta gravada. */
  naoGravadas: string[];
}

/** `origemDoFront` é a do Vite do teste (o `baseURL`), e não `page.url()`: antes
 *  da primeira navegação a página está em `about:blank`. */
export async function simularApi(page: Page, origemDoFront: string): Promise<ApiSimulada> {
  const rotas = carregarRotas();
  const naoGravadas: string[] = [];

  // CORS: a chamada sai do Vite (5179) para outra origem e leva credencial, então
  // a resposta precisa devolver a origem exata e permitir credencial, como o
  // back faz.
  const cabecalhosCors = () => ({
    'access-control-allow-origin': origemDoFront,
    'access-control-allow-credentials': 'true',
    vary: 'Origin',
  });

  // A ORDEM IMPORTA: o Playwright consulta as rotas da ÚLTIMA registrada para a
  // primeira. A rota-curinga vem primeiro para ser a última consultada.
  await page.route('**/*', async (route: Route) => {
    const url = new URL(route.request().url());
    const local = url.origin === origemDoFront;
    if (local || url.protocol === 'data:' || url.protocol === 'blob:') {
      return route.fallback();
    }
    if (url.hostname === 'fonts.googleapis.com') {
      return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    }
    if (url.hostname === 'fonts.gstatic.com') {
      return route.fulfill({ status: 200, contentType: 'font/woff2', body: '' });
    }
    naoGravadas.push(`${route.request().method()} ${url.href}`);
    return route.abort('blockedbyclient');
  });

  await page.route(`${BASE_DA_API}/**`, async (route: Route) => {
    const pedido = route.request();
    const url = new URL(pedido.url());
    const metodo = pedido.method().toUpperCase();

    if (metodo === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          ...cabecalhosCors(),
          'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'access-control-allow-headers': 'Content-Type, Authorization, X-CSRF-Token',
        },
      });
    }

    const gravada = rotas.get(`${metodo} ${url.pathname}`);
    if (!gravada) {
      naoGravadas.push(`${metodo} ${url.pathname}${url.search}`);
      return route.fulfill({
        status: 400,
        headers: cabecalhosCors(),
        contentType: 'application/json',
        body: JSON.stringify({ detalhe: `Sem resposta gravada para ${metodo} ${url.pathname}` }),
      });
    }

    return route.fulfill({
      status: gravada.status,
      headers: cabecalhosCors(),
      contentType: 'application/json',
      body: gravada.corpo,
    });
  });

  return { naoGravadas };
}
