import { defineConfig } from '@playwright/test';

import { BASE_DA_API } from './e2e/apiSimulada.ts';

// -------------------------------------------------------------------------
// TESTE DE PONTA A PONTA (decisão D4 de docs/consulta-profundidade/DECISOES.md)
//
// SÓ DEPENDÊNCIA DE DESENVOLVIMENTO: não entra no build nem no CI. Usa o Edge
// já instalado na máquina (`channel: 'msedge'`) e NÃO baixa navegador — não
// rode `npx playwright install`.
//
// O VITE É PRÓPRIO, numa porta só dele (5179, `strictPort`), e nunca é
// reaproveitado: o servidor de desenvolvimento de quem está editando (5175)
// aponta para a API de verdade, e o teste precisa de um que aponte para a base
// simulada. Reaproveitar um servidor já de pé faria o teste rodar contra o
// back real sem ninguém perceber.
//
// A API É SIMULADA no navegador (ver `e2e/apiSimulada.ts`): `VITE_API_URL`
// aponta para uma base onde nada responde, e toda chamada que não tem resposta
// gravada em `e2e/fixtures/` volta 400 e reprova o teste.
// -------------------------------------------------------------------------

const PORTA = 5179;

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,

  use: {
    baseURL: `http://localhost:${PORTA}`,
    channel: 'msedge',
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // AS BARRAS DE ROLAGEM VISÍVEIS, como no navegador de quem usa: o Edge
    // sem janela as esconde, e a página ganhava 17px de largura que ninguém
    // tem. Foi assim que a tabela de pilares transbordava em 1280px sem o
    // teste ver.
    launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] },
  },

  webServer: {
    command: `npx vite --port ${PORTA} --strictPort`,
    url: `http://localhost:${PORTA}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      // Variável já presente no processo vence o `.env.local` no Vite: é o que
      // garante que o teste nunca fale com a API de verdade nem envie telemetria.
      VITE_API_URL: BASE_DA_API,
      VITE_APPINSIGHTS_CONNECTION_STRING: '',
    },
  },
});
