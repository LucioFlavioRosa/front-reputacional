import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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
})
