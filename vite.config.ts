import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],

  resolve: {
    // `@/` aponta para `src/`. É o que permite `@/dominio/tipos` no lugar de
    // `../../../nucleo/tipos` — e o que faz um arquivo continuar importável
    // depois de mudar de pasta, sem editar quem o importa.
    //
    // Precisa estar declarado em DOIS lugares: aqui, para o Vite e o Vitest
    // resolverem em tempo de execução, e em `tsconfig.app.json`, para o
    // TypeScript resolver em tempo de checagem. Esquecer um dos dois dá erro
    // só em metade das ferramentas.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  // -------------------------------------------------------------------------
  // OS TESTES DE TELA, e por que o ambiente não é `jsdom` para todos
  //
  // A suíte é quase toda de lógica pura, e lógica pura não precisa de DOM:
  // ligar `jsdom` em tudo custaria segundos a cada rodada para montar um
  // navegador falso que 24 dos 25 arquivos ignoram.
  //
  // Quem precisa dele declara no topo do próprio arquivo:
  //
  //     // @vitest-environment jsdom
  //
  // `environmentMatchGlobs` faria o mesmo por pasta, mas está obsoleto no
  // Vitest 4 — e a anotação no arquivo diz a quem o abre por que ele é
  // diferente dos vizinhos.
  //
  // `setupFiles` roda para todos, e é barato: só acrescenta os matchers de
  // `jest-dom` quando há DOM, e não faz nada quando não há.
  // -------------------------------------------------------------------------
  test: {
    setupFiles: ['./src/testes/preparar.ts'],
  },
})
