# front-reputacional

O front do **Painel Reputacional Aegea**. React 19 + TypeScript + Vite,
compilado num pacote estático que o nginx entrega. Não há Node em produção.

A API é o [`back-reputacional`](https://github.com/LucioFlavioRosa/back-reputacional).
O glossário do domínio — os nomes que as telas e a API usam, e os que evitam —
é o `CONTEXT.md` na raiz daquele repositório; vale para os dois.

## Só quero VER o produto rodando

Não é aqui. A pilha inteira — este front, a API, o Postgres e o emulador de
Blob — sobe com um `docker compose` do lado da API, sem instalar Node nem
Python. As instruções, as contas de acesso e o porquê de não existir dump do
banco estão no README do
[`back-reputacional`](https://github.com/LucioFlavioRosa/back-reputacional#rodando-a-pilha-inteira-com-docker).

Clone os dois repositórios **lado a lado**: o build do front é acionado de lá,
por caminho relativo.

## Desenvolvendo o front, em 3 passos

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
│   ├── painel/           as caixas do Painel que cresceram: tabela de interações,
│   │                     Relatório de Interações Mensais, Síntese Executiva pela IA
│   └── cadastro/         as partes do formulário de agenda
├── componentes/        o vocabulário visual reusado entre telas
├── graficos/           as visualizações (barras, mapa, ranking)
├── api/                tudo que fala com o backend
├── dominio/            TypeScript puro: tipos, regras e derivações
├── estado/             os contextos do React
└── observabilidade/    telemetria e o limite de erro
```

**`dominio/` não importa React.** É a regra que vale para o resto se orientar:
o que está ali é função pura, testável sem montar componente, e é onde moram
15 dos 20 arquivos de teste. Se um arquivo de `dominio/` precisar de `useState`,
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
PainelDeFiltros.tsx` (a caixa de filtros), `estado/painel.tsx` (o contexto que o guarda) e
`dominio/resumo-do-recorte.ts` (o texto que o descreve). São três pastas para um
conceito só, e é consequência de organizar por tipo.

A alternativa seria uma pasta `filtros/` com os três dentro, mas aí ela seria a
única pasta-por-assunto no meio de pastas-por-tipo, e a regra deixaria de ser
uma regra. Procure por `Recorte` para ver o conceito inteiro de uma vez.

**O período tem dois atalhos, um para cada lado.** `periodoPassado`
(`ultimos-30|60|90|180|360`) e `periodoFuturo` (`proximos-30|60|90|180|360`)
combinam num intervalo só; `dominio/recorte.ts` resolve os dois para `de`/`ate`
antes de mandar, e é só isso que o back recebe. A escala é a mesma para trás e
para a frente de propósito — "ano corrente" saiu porque não tinha espelho no
futuro.

**A base do recorte vem em lotes.** `api/cliente.ts › listarRecorteCompleto`
pede a primeira página, descobre o total e busca o resto em lotes de páginas —
nunca todas em paralelo —, até `TETO_DE_DERIVACAO` (5.000 registros). Passado o
teto, `truncado` chega `true` no contexto (`estado/painel.tsx`) e o Painel
abre com uma faixa dizendo sobre quantos registros está calculando — os
mais recentes, que é a ordem padrão da API.

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

Vitest, 346 testes em 20 arquivos. A maior parte cobre `dominio/` — as regras
puras, que é onde o teste rende —, e o resto cobre `api/`, `navegacao/`,
`observabilidade/` e o menu do usuário. Moram ao lado do arquivo que testam
(`formato.ts` e `formato.test.ts`), que é o costume do ecossistema — diferente
do back, onde os testes ficam numa pasta `tests/`, porque lá o costume é
outro.

**Não há teste de componente.** É lacuna conhecida, não decisão: as telas são
verificadas contra o protótipo a olho. Quem for acrescentar, o caminho é
Testing Library.

## O que este repositório NÃO faz

- **Não deriva os agregados no servidor.** O painel busca a base do escopo e
  calcula KPIs, séries e rankings no navegador (`dominio/derivacoes.ts`). A API
  tem rotas de métrica prontas (`/api/metricas/*`) que o front ainda não
  consome.
- **Não importa planilha.** A tela não existe; o schema do lado do back existe.
- **Não chama modelo nenhum.** A caixa "Síntese Executiva pela IA" do Painel
  (`paginas/painel/SinteseExecutivaPelaIA.tsx`) monta o texto no front, a
  partir dos mesmos números que o resto do Painel deriva
  (`dominio/sinteseIA.ts`). É o desenho da caixa, do abrir/fechar e do
  feedback bom/ruim com "porquê" que já vale fixar; o conteúdo troca de fonte
  (front → agente no back) sem trocar a caixa.
## CI

`.github/workflows/ci.yml`, quatro etapas em push para `main` e em todo PR:

| Etapa | O que roda |
|---|---|
| **Lint e tipos** | `npm ci`, `npm run lint`, `npx tsc -b --force` |
| **Testes** | `npm test` em Node 22 (produção) e 24 (LTS seguinte) |
| **Imagem Docker** | constrói e **sobe** a imagem, conferindo a página real |
| **CI** | agrega as três — é neste nome que a proteção de branch deve apontar |

A etapa da imagem faz o que o build sozinho não faz. O `Dockerfile` monta a CSP
por `sed` sobre o `nginx.conf`, e um marcador não substituído faria o navegador
bloquear toda chamada à API — tela vazia, sem erro no servidor. O CI constrói
com um `VITE_API_URL` **diferente do padrão** e confere que ele chegou à CSP da
resposta, que nenhum marcador sobreviveu, e que o HSTS está ausente (o padrão
é `off`).

`tsc -b` roda com `--force` de propósito: o cache incremental mora em
`node_modules/.tmp`, que o cache de npm do CI pode restaurar — sem `--force` o
typecheck passaria sem checar nada.
