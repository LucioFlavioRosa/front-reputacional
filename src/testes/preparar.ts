/** O que toda rodada de teste precisa antes de começar.
 *
 *  OS MATCHERS DO `jest-dom` — `toBeVisible`, `toHaveAccessibleName` e os
 *  outros que descrevem o que a pessoa vê, em vez de descrever o DOM. Entram
 *  para todos os arquivos porque não custam nada a quem não os usa: sem DOM
 *  montado, nenhum deles é chamado.
 *
 *  A LIMPEZA ENTRE TESTES PRECISA SER REGISTRADA À MÃO. O
 *  `@testing-library/react` a registra sozinho SÓ quando encontra um `afterEach`
 *  global, e este projeto não liga `globals` do Vitest — cada teste importa
 *  `describe` e `it` explicitamente. Sem esta linha, o segundo teste de um
 *  arquivo encontra a tela do primeiro ainda montada, e toda busca por papel
 *  falha com "found multiple elements". Descobri isso do jeito mais direto:
 *  seis dos sete primeiros testes quebraram assim.
 *
 *  E UM `localStorage` DE MEMÓRIA, porque o do jsdom não chega funcionando
 *  neste par de versões — ver o bloco no fim do arquivo.
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

/** O `localStorage` do jsdom NÃO CHEGA FUNCIONANDO neste par de versões.
 *
 *  Medido com uma sonda (jsdom 29.1.1 + Vitest 4.1.11): `window.localStorage`
 *  existe, mas é um `Object` puro — sem `getItem`, sem `setItem`, sem `clear`.
 *  Quatro testes da Base de dados quebravam em "localStorage.clear is not a
 *  function", e isso foi conferido numa cópia limpa da `main`: não é defeito de
 *  um ramo, é do ambiente de teste.
 *
 *  UM STORAGE DE MEMÓRIA resolve, e a tela passa a ser testada com a mesma
 *  mecânica que ela encontra no navegador — guardar um filtro e reencontrá-lo.
 *  Sem isto, a alternativa era o teste não falar de `localStorage`, e aí o que
 *  a pessoa de fato vê (o filtro lembrado) ficaria sem prova nenhuma.
 *
 *  O `if` é a data de validade: no dia em que as versões se entenderem, o
 *  Storage de verdade está lá e este bloco não faz nada.
 */
if (typeof window !== 'undefined' && typeof window.localStorage?.clear !== 'function') {
  const guardado = new Map<string, string>();
  const daMemoria: Storage = {
    get length() {
      return guardado.size;
    },
    clear: () => guardado.clear(),
    getItem: (chave) => (guardado.has(chave) ? guardado.get(chave)! : null),
    key: (indice) => [...guardado.keys()][indice] ?? null,
    removeItem: (chave) => void guardado.delete(chave),
    setItem: (chave, valor) => void guardado.set(chave, String(valor)),
  };
  Object.defineProperty(window, 'localStorage', {
    value: daMemoria,
    configurable: true,
    writable: true,
  });
}
