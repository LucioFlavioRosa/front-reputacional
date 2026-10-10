import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test as testeBase } from '@playwright/test';
import type { Page } from '@playwright/test';

import { simularApi } from './apiSimulada.ts';
import type { ApiSimulada } from './apiSimulada.ts';

// -------------------------------------------------------------------------
// CONSULTA EM PROFUNDIDADE · ponta a ponta
//
// Por enquanto, só a FUMAÇA: a aba Lentes abre na Imprensa com a API simulada,
// o bloco "Drill down" existe e abre. O roteiro da Parte G da spec entra aqui
// quando o drill existir.
//
// QUALQUER `console.error`, `pageerror` ou aviso do React reprova, como pede a
// Parte G: um aviso de chave (`key`) passa despercebido na tela e só aparece
// no console. O mesmo vale para chamada sem resposta gravada.
// -------------------------------------------------------------------------

const CAPTURAS = join(import.meta.dirname, '..', 'docs', 'consulta-profundidade', 'qa');

//: Avisos do React que chegam como `console.warn` (os de desenvolvimento do
//: React 19 vêm quase todos por `console.error`, já coberto acima).
const AVISO_DO_REACT = /react|warning:|\bkey\b/i;

interface Vigias {
  /** Respostas simuladas; `naoGravadas` lista o que o front pediu sem resposta. */
  api: ApiSimulada;
  /** Erros de console, `pageerror` e avisos do React. */
  problemas: string[];
}

// AS DUAS VIGIAS SÃO CONFERIDAS TAMBÉM NO CAMINHO DE FALHA, na desmontagem do
// fixture: se faltar uma resposta inicial (`/api/eu`, por exemplo), a tela nem
// abre e o teste cai num tempo esgotado de localizador que não cita a rota. A
// desmontagem anexa a lista ao relatório e reprova com ela, ao lado do erro
// original.
//
// `entregar`, e não `use`, no 2º parâmetro do fixture (é posicional): o lint
// trata `use` como o hook do React e acusa `rules-of-hooks`.
const test = testeBase.extend<Vigias>({
  problemas: async ({ page }, entregar, testInfo) => {
    const problemas: string[] = [];
    page.on('console', (mensagem) => {
      const tipo = mensagem.type();
      if (tipo === 'error') problemas.push(`console.error: ${mensagem.text()}`);
      if (tipo === 'warning' && AVISO_DO_REACT.test(mensagem.text())) {
        problemas.push(`console.warn: ${mensagem.text()}`);
      }
    });
    page.on('pageerror', (erro) => problemas.push(`pageerror: ${erro.message}`));

    await entregar(problemas);

    if (problemas.length > 0) {
      await testInfo.attach('console', { body: problemas.join('\n'), contentType: 'text/plain' });
    }
    expect(problemas, 'console limpo').toEqual([]);
  },

  api: async ({ page, baseURL }, entregar, testInfo) => {
    const api = await simularApi(page, new URL(baseURL!).origin);

    await entregar(api);

    if (api.naoGravadas.length > 0) {
      await testInfo.attach('chamadas sem resposta gravada', {
        body: api.naoGravadas.join('\n'),
        contentType: 'text/plain',
      });
    }
    expect(api.naoGravadas, 'chamadas sem resposta gravada em e2e/fixtures').toEqual([]);
  },
});

/** Captura de QA em `docs/consulta-profundidade/qa/<nome>.png`.
 *
 *  A EVIDÊNCIA SÓ É GRAVADA DEPOIS DAS CONFERÊNCIAS: a imagem é tirada para a
 *  memória, as vigias são conferidas e só então o arquivo versionado é
 *  sobrescrito. Uma execução que reprova não troca a captura boa por uma tela
 *  quebrada.
 *
 *  CAPTURA DA PÁGINA INTEIRA A PARTIR DO TOPO: com a página rolada, o cabeçalho
 *  fixo sai desenhado no meio da imagem. */
async function capturar(page: Page, nome: string, { api, problemas }: Vigias): Promise<void> {
  // A REDE PARADA ANTES DE CONFERIR: uma chamada sem resposta gravada que saísse
  // depois da conferência passaria.
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.scrollTo(0, 0));
  const imagem = await page.screenshot({ fullPage: true });

  expect(api.naoGravadas, 'chamadas sem resposta gravada em e2e/fixtures').toEqual([]);
  expect(problemas, 'console limpo').toEqual([]);

  mkdirSync(CAPTURAS, { recursive: true });
  writeFileSync(join(CAPTURAS, `${nome}.png`), imagem);
}

test('fumaça: aba Lentes na Imprensa, bloco Drill down abre', async ({ page, api, problemas }) => {
  // DATA FIXA: o mês da tela vem de `mes_sugerido` (fixture), mas qualquer texto
  // relativo a "hoje" mudaria a captura de um dia para o outro.
  await page.clock.setFixedTime(new Date('2026-09-15T12:00:00-03:00'));

  await page.goto('/score/lentes');

  await expect(page.getByRole('tab', { name: /Imprensa/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  const drill = page.getByRole('button', { name: /^Drill down/ });
  await expect(drill).toHaveAttribute('aria-expanded', 'false');
  await drill.click();
  await expect(drill).toHaveAttribute('aria-expanded', 'true');

  await capturar(page, '00-fumaca', { api, problemas });
});
