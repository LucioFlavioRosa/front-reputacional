import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Page, Route } from '@playwright/test';

import { LENTES_DA_CONSULTA, consultaIlustrativa } from './fixtures/consulta.ts';

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
// A CONSULTA EM PROFUNDIDADE (`/api/score/lentes/{codigo}/consulta`, D5) NÃO
// TEM ARQUIVO EM `rotas.json`: a resposta de cada lente é derivada do JSON
// ilustrativo do front (`fixtures/consulta.ts`), com o aviso "Dados
// ilustrativos", para qualquer `mes`. Um teste pode trocar a resposta de um
// caminho com `api.responder` (o de "dados reais sem selo" faz isso).
//
// AS FONTES DO GOOGLE PASSAM PARA A REDE, com tolerância a falha: as
// capturas de QA (`docs/consulta-profundidade/qa/`) precisam mostrar a DM Sans
// da aplicação, e não a Arial da fonte reserva, para servirem de comparação
// com o mockup. A rede aqui é só para a FONTE: nenhum dado da tela vem dela.
// O pedido sai pelo próprio Playwright (`route.fetch`), e não pelo navegador
// (`route.continue`), porque assim a falha fica do nosso lado: sem rede (ou
// com a rede lenta), a resposta vira uma folha vazia e a tela cai na fonte
// reserva do `index.css`, como antes. Deixar o navegador falhar sozinho poria
// um "Failed to load resource" no console, e o teste reprovaria por algo que
// não é defeito da aplicação.
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
  const mapa = new Map(
    rotas.map((r) => [
      `${r.metodo.toUpperCase()} ${r.caminho}`,
      { status: r.status ?? 200, corpo: readFileSync(join(PASTA, r.arquivo), 'utf-8') },
    ]),
  );
  for (const lente of LENTES_DA_CONSULTA) {
    mapa.set(`GET /api/score/lentes/${lente}/consulta`, {
      status: 200,
      corpo: JSON.stringify(consultaIlustrativa(lente)),
    });
  }
  return mapa;
}

/** Tempo máximo para a fonte chegar; passou disso, segue sem ela. */
const ESPERA_DA_FONTE = 10_000;

/** Fonte do Google pela rede; se a rede falhar, folha ou arquivo vazio (ver
 *  o comentário do topo). O `access-control-allow-origin` vai sempre: o
 *  arquivo da fonte é pedido com CORS pela folha do Google. */
async function entregarFonte(route: Route, ehFolha: boolean): Promise<void> {
  try {
    const resposta = await route.fetch({ timeout: ESPERA_DA_FONTE });
    if (resposta.ok()) {
      return await route.fulfill({
        response: resposta,
        headers: { ...resposta.headers(), 'access-control-allow-origin': '*' },
      });
    }
  } catch {
    // Sem rede: cai na resposta vazia abaixo.
  }
  return route.fulfill({
    status: 200,
    contentType: ehFolha ? 'text/css' : 'font/woff2',
    headers: { 'access-control-allow-origin': '*' },
    body: '',
  });
}

export interface ApiSimulada {
  /** Chamadas que o front fez e que não têm resposta gravada. */
  naoGravadas: string[];
  /** Troca a resposta de um `GET` (caminho sem a consulta) neste teste.
   *  Chame antes de abrir a página. */
  responder: (caminho: string, corpo: unknown) => void;
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
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
      return entregarFonte(route, url.hostname === 'fonts.googleapis.com');
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

  const responder = (caminho: string, corpo: unknown) => {
    rotas.set(`GET ${caminho}`, { status: 200, corpo: JSON.stringify(corpo) });
  };

  return { naoGravadas, responder };
}
