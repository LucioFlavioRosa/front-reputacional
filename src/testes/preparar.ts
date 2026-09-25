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
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);
