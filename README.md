# front-reputacional

O front do **Painel Reputacional Aegea**. React 19 + TypeScript + Vite,
compilado num pacote estático que o nginx entrega. Não há Node em produção.

A API é o [`back-reputacional`](https://github.com/LucioFlavioRosa/back-reputacional).

## Subindo em 3 passos

```bash
npm install
cp .env.example .env.local     # ajuste VITE_API_URL se a API não estiver na 8000
npm run dev
```

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento com HMR |
| `npm run build` | **`tsc -b` e depois `vite build`** |
| `npm test` | Vitest |
| `npm run lint` | oxlint |
| `npm run preview` | serve o `dist/` já compilado |

⚠ **Use `npm run build`, nunca `vite build` direto.** O script roda o typecheck
antes; `vite build` sozinho não faz nenhum, e erro de tipo passaria para o
bundle sem ninguém notar.

## Como o repositório é organizado

Uma pasta por **tipo de coisa**, e não por assunto. Quem chega procurando "a
tela de cadastro" abre `paginas/`; quem procura "a regra que decide o rótulo"
abre `dominio/`. Não é preciso saber a que contexto de negócio o arquivo
pertence para achá-lo.

```
src/
├── main.tsx            monta o React na página
├── App.tsx             o mapa de rotas — a lista do que existe
├── index.css
│
├── paginas/            UMA por tela. É o índice do produto.
├── componentes/        o vocabulário visual reusado entre telas
├── graficos/           as visualizações (barras, mapa, ranking)
├── api/                tudo que fala com o backend
├── dominio/            TypeScript puro: tipos, regras e derivações
├── estado/             os contextos do React
└── observabilidade/    telemetria e o limite de erro
```

**`dominio/` não importa React.** É a regra que vale para o resto se orientar:
o que está ali é função pura, testável sem montar componente, e é onde moram os
quatro arquivos de teste. Se um arquivo de `dominio/` precisar de `useState`,
ele está na pasta errada.

**Hook começa com `use`, mesmo em código português.** `usePainel`, e não
`usarPainel`. O prefixo é como o React IDENTIFICA um hook: a regra
`react/rules-of-hooks` (marcada como `error` no `.oxlintrc.json`) e o React
Compiler reconhecem pelo nome. Com o nome errado, uma chamada dentro de `if`
passa batida e o compilador deixa de otimizar o componente. É a única palavra
em inglês que o código deve ter, e tem motivo.

**`@/` aponta para `src/`.** `@/dominio/tipos`, nunca `../../../nucleo/tipos`.
Além de legível, é o que faz um arquivo continuar importável depois de mudar de
pasta. O alias está declarado em **dois** lugares que precisam concordar:
`resolve.alias` no `vite.config.ts` (execução) e `paths` no `tsconfig.app.json`
(checagem).

### Onde os filtros moram, e por quê em três lugares

O recorte — o conjunto de filtros do painel — aparece em `componentes/
FiltrosDrawer.tsx` (a gaveta), `estado/painel.tsx` (o contexto que o guarda) e
`dominio/resumo-do-recorte.ts` (o texto que o descreve). São três pastas para um
conceito só, e é consequência de organizar por tipo.

A alternativa seria uma pasta `filtros/` com os três dentro, mas aí ela seria a
única pasta-por-assunto no meio de pastas-por-tipo, e a regra deixaria de ser
uma regra. Procure por `Recorte` para ver o conceito inteiro de uma vez.

## O que é decidido em tempo de BUILD

`import.meta.env` do Vite é substituído na compilação, e não lido em execução.
**Variável de ambiente no `docker run` ou no App Service não tem efeito** — é
preciso reconstruir a imagem.

| Variável | Efeito |
|---|---|
| `VITE_API_URL` | endereço da API no bundle **e** no `connect-src` da CSP |
| `VITE_APPINSIGHTS_CONNECTION_STRING` | liga a telemetria **e** entra na CSP |

A mesma propriedade é o que permite eliminar código morto: sem a connection
string, o SDK do Application Insights sai inteiro do bundle.

## Testes

Vitest, 72 testes em 4 arquivos, todos sobre `dominio/`. Moram ao lado do
arquivo que testam (`formato.ts` e `formato.test.ts`), que é o costume do
ecossistema — diferente do back, onde os testes ficam numa pasta `tests/`,
porque lá o costume é outro.

**Não há teste de componente.** É lacuna conhecida, não decisão: as telas são
verificadas contra o protótipo a olho. Quem for acrescentar, o caminho é
Testing Library.

## O que este repositório NÃO faz

- **Não deriva os agregados no servidor.** O painel busca a base do escopo e
  calcula KPIs, séries e rankings no navegador (`dominio/derivacoes.ts`). A API
  tem rotas de métrica prontas (`/api/metricas/*`) que o front ainda não
  consome.
- **Não importa planilha.** A tela não existe; o schema do lado do back existe.
- **Não tem CI.** Nenhum workflow neste repositório ainda.
