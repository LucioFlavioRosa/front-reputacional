/** O filtro rápido dos quadros, na URL que sai de verdade.
 *
 *  POR QUE ESTE ARQUIVO EXISTE — achado de revisão. Os filtros de lente e tier
 *  chegaram à tela com testes que MOCKAM `obterImpactoNaJanela`: eles provam
 *  que a tela pede `{ lentes: ['mercado'] }`, e nada provava que isso vira
 *  `?lentes=mercado` na requisição. `comFiltros` não tinha teste nenhum.
 *
 *  E O MODO DE FALHAR É SILENCIOSO, que é o que torna a lacuna caro: um nome
 *  de parâmetro errado (`lente` em vez de `lentes`) passaria em todos os
 *  testes da tela, o servidor ignoraria o desconhecido e devolveria as três
 *  lentes — e a tela mostraria números NÃO filtrados com o botão "Mercado"
 *  aceso em cima. Ninguém vê um erro; vê o número errado.
 *
 *  AS DUAS ROTAS JUNTAS, porque é o par que tem de concordar: o quadro e o
 *  modal que cada linha dele abre. Se só uma levar o filtro, a lista do modal
 *  deixa de ser a da linha clicada.
 */

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { obterImpactoNaJanela, obterRegistrosDaJanela } from './mercado';

let urls: string[] = [];

beforeEach(() => {
  urls = [];
  vi.stubGlobal('fetch', (url: string) => {
    urls.push(url);
    return Promise.resolve(new Response('{}', { status: 200 }));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Os parâmetros da última requisição, para afirmar por nome e não por posição
 *  — a ordem na query string não é contrato. */
function parametros(): URLSearchParams {
  return new URL(urls[urls.length - 1], 'http://teste').searchParams;
}

it('o quadro manda as lentes separadas por vírgula, e o tier', async () => {
  await obterImpactoNaJanela('2026-05-20', 'n3', 15, {
    lentes: ['imprensa', 'mercado'],
    tier: 'muito_relevante',
  });

  const p = parametros();
  expect(p.get('lentes')).toBe('imprensa,mercado');
  expect(p.get('tier')).toBe('muito_relevante');
  //: E O RESTO CONTINUA INDO: o filtro não pode ter comido o dia nem a janela.
  expect(p.get('ate')).toBe('2026-05-20');
  expect(p.get('nivel')).toBe('n3');
  expect(p.get('dias')).toBe('15');
});

it('o modal da linha manda os MESMOS filtros do quadro', async () => {
  await obterRegistrosDaJanela('2026-05-20', 11, 'n2', 1, 15, {
    lentes: ['mercado'],
    tier: 'relevante',
  });

  const p = parametros();
  expect(p.get('lentes')).toBe('mercado');
  expect(p.get('tier')).toBe('relevante');
  expect(p.get('grupo')).toBe('11');
  expect(p.get('pagina')).toBe('1');
});

it('sem filtro, nenhum dos dois parâmetros aparece', async () => {
  //: VAZIO É "O QUADRO DE SEMPRE", e tem de ser a AUSÊNCIA do parâmetro: a
  //: rota recusa `lentes=` com 422, porque a regex dela exige pelo menos uma
  //: lente. Mandar a chave vazia transformaria "sem filtro" em erro.
  await obterImpactoNaJanela('2026-05-20', 'n3', 15);

  expect(parametros().has('lentes')).toBe(false);
  expect(parametros().has('tier')).toBe(false);
});

it('e lista de lentes vazia também não vira `lentes=`', async () => {
  await obterImpactoNaJanela('2026-05-20', 'n3', 15, { lentes: [], tier: undefined });

  expect(parametros().has('lentes')).toBe(false);
  expect(parametros().has('tier')).toBe(false);
});
