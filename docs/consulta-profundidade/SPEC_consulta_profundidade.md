# Consulta em profundidade · KPIs Reputacionais
## Especificação de construção para o Claude Code

Versão 1.0 · 09/10/2026 · Peers Consulting + Technology para Aegea

Arquivos que acompanham esta especificação, a serem colocados em `docs/consulta-profundidade/` no repositório:

| Arquivo | Papel |
|---|---|
| `SPEC_consulta_profundidade.md` | Este documento. Fonte única de verdade para comportamento, layout e textos |
| `consulta-profundidade.dados.json` | Base de dados da demonstração. Todos os números e todas as frases da tela saem daqui |
| `validar_dados.py` | Validador de referência das invariantes numéricas (o teste em TypeScript deve reproduzir as mesmas regras) |
| `referencias/*.png` | Capturas das 8 telas do protótipo aprovado, em 1440 px. Referência visual, não pixel perfect |

---

## Parte A · Prompt de abertura (colar no Claude Code)

```
PAPEL
Você é um engenheiro front-end sênior especializado em React + TypeScript e em visualização
de dados executiva. Trabalha dentro do repositório front-reputacional da Aegea, respeitando
as convenções que já existem (nomes em português, tokens de src/index.css, primitivas de
src/componentes/basicos.tsx e estilos de src/componentes/estilos.ts).

CONTEXTO
Vamos construir a página "Consulta em profundidade" do módulo KPIs Reputacionais. Ela será
apresentada ao cliente amanhã. A página permite ao executivo sair da nota de uma lente
(ex.: Imprensa 42) até a matéria que causou a nota, em até quatro cliques, com uma trilha
de navegação que volta a qualquer nível. A demonstração usa dados ilustrativos de um
arquivo JSON local. Não existe backend para esta página.

OBJETIVO
Entregar a página funcionando de ponta a ponta, sem erro de console, sem tela em branco e
sem clique que não leve a lugar nenhum, seguindo docs/consulta-profundidade/SPEC_consulta_profundidade.md.

FUNDAMENTOS
- Especificação: docs/consulta-profundidade/SPEC_consulta_profundidade.md (fonte única de verdade)
- Dados: docs/consulta-profundidade/consulta-profundidade.dados.json (copiar para a pasta da página)
- Referência visual: docs/consulta-profundidade/referencias/*.png
- Boas práticas: WCAG 2.1 AA para contraste e teclado; IBCS para consistência de escala em gráficos

INSTRUÇÕES
1. Leia a especificação inteira antes de escrever qualquer código.
2. Execute a Fase 0 (reconhecimento do repositório) e me mostre o relatório. Espere meu ok.
3. Construa fase por fase (Fases 1 a 6). Ao final de cada fase, rode os testes da fase,
   faça commit e me mostre um resumo de até 10 linhas e as capturas de tela da fase.
4. Nenhum texto exibido na tela pode ser inventado ou reescrito por você. Títulos, leituras,
   rótulos e números vêm do JSON ou desta especificação, literalmente.
5. Não altere páginas, componentes ou estilos existentes, exceto para registrar a rota e o
   item de navegação. Componentes novos ficam na pasta da página.
6. Não adicione dependências novas. Gráficos em SVG próprio, conforme a seção D.
7. Na dúvida entre duas interpretações, escolha a mais conservadora (a que não pode quebrar),
   registre a decisão em docs/consulta-profundidade/DECISOES.md e siga.

SAÍDA ESPERADA
- Rota nova funcionando, com navegação por URL (voltar do navegador funciona)
- Testes de invariantes e de seletores passando
- Teste ponta a ponta (Playwright) do roteiro da seção G passando, com capturas em
  docs/consulta-profundidade/qa/
- Checklist da seção H preenchido em docs/consulta-profundidade/QA.md

RESTRIÇÕES
- Trabalhe na branch feature/consulta-profundidade
- Português do Brasil em toda a interface; sem travessão (—) em textos de tela; sem emoji
- Nada de chamadas de rede, lorem ipsum, número calculado à mão ou link externo inventado

CRITÉRIOS DE QUALIDADE
- Zero erro e zero warning de React no console durante o roteiro da seção G
- Nenhum nível pode renderizar vazio: URL inválida sempre cai no nível válido mais próximo
- Resoluções 1280×720, 1366×768, 1440×900 e 1920×1080 sem rolagem horizontal da página
- Todas as invariantes da seção C.4 verificadas em teste automatizado
```

---

## Parte B · Fases de trabalho e portões

Cada fase termina com commit, testes verdes e capturas. Não avance sem os testes da fase passando.

| Fase | Entrega | Prioridade para amanhã | Teste de saída |
|---|---|---|---|
| 0 | Relatório do repositório (seção B.1) | obrigatória | aprovação do Guilherme |
| 1 | Tipos, JSON, seletores, formatação, rota vazia | P0 | testes de invariantes e seletores |
| 2 | Moldura (seletor de lentes, faixa de filtros, trilha) + Nível 1 de todas as lentes | P0 | captura das 5 lentes |
| 3 | Níveis 2, 3 e 4 da Imprensa + modal de prévia | P0 | roteiro G passos 1 a 9 |
| 4 | Cartões laterais das 4 outras lentes | P0 | roteiro G passos 13 a 16 |
| 5 | Busca inteligente | P1 | roteiro G passos 10 a 12 |
| 6 | Filtros da lista, ordenação, tooltips, QA final | P1 (tooltips P2) | roteiro G completo + checklist H |

Se o tempo apertar, a ordem de corte é: tooltips, depois filtros da faixa superior no Nível 4, depois busca. Nunca corte: trilha, URL, modal de prévia, estados de linha não navegável.

### B.1 Fase 0 · Reconhecimento (antes de qualquer código)

Responda, com caminhos de arquivo:

1. Qual roteador a aplicação usa e como as rotas do módulo KPIs Reputacionais estão registradas
2. Onde ficam as abas "Radar reputacional" e "Jornada do índice", e como adicionar a aba "Consulta em profundidade" ao lado delas
3. Quais tokens existem em `src/index.css` (cores, raios, fonte) e quais primitivas de `basicos.tsx` servem aqui: `Cartao`, `Selo`, `Chip`, `Botao`, `Modal`, `Kpi`
4. Se `Modal` já tem foco preso, `Esc` e `aria-modal`. Se não tiver, a página usa um modal próprio na pasta da página
5. Qual executor de testes unitários existe (Vitest ou Jest) e se Playwright já está configurado
6. Como a aplicação carrega a fonte DM Sans
7. Se existe `ErrorBoundary` reutilizável

Proposta de estrutura de pastas (adapte ao padrão encontrado):

```
src/paginas/ConsultaProfundidade/
  index.tsx                         página, lê a URL e escolhe o nível
  dados/consulta-profundidade.dados.json
  dados/tipos.ts
  dados/seletores.ts                resolverCaminho, irmãos, escalas, índice de busca
  dados/seletores.test.ts
  dados/invariantes.test.ts
  formatacao.ts / formatacao.test.ts
  componentes/  SeletorLentes, FaixaFiltros, Trilha, IndicadorNivel, CartaoNota,
                TabelaImpacto, ResumoNivel, Leitura, CartoesLaterais, ListaMaterias,
                ModalPrevia, Busca, LimiteDeErro
  graficos/     GraficoLinhaNota, BarraSentimento, BarraVolume, BarraImpacto,
                GraficoColunasImpacto, GraficoDiario
  niveis/       NivelLente.tsx, NivelPilar.tsx, NivelTema.tsx, NivelSubtema.tsx
e2e/consulta-profundidade.spec.ts
```

---

## Parte C · Dados

### C.1 Princípio

A página não calcula indicadores de negócio. Ela lê o JSON e só deriva o que é de apresentação: escalas de gráfico, ordenação, participação percentual, filtros da lista e índice de busca. Toda frase interpretativa (títulos, leituras, notas) já vem pronta no JSON.

### C.2 Tipos (TypeScript)

```ts
export type Sentimento = 'positivo' | 'neutro' | 'negativo';
export type Tier = 'Tier 1' | 'Tier 2' | 'Tier 3';
export type FaixaId = 'referencia' | 'solido' | 'estavel' | 'atencao' | 'critico';

export interface DistSentimento { pos: number; neu: number; neg: number } // inteiros, somam 100

export interface No {
  id: string;                 // slug estável, usado na URL
  nome: string;
  volume: number;             // matérias, menções, mensagens ou interações
  sentimento: DistSentimento;
  impacto: number;            // pontos na nota da lente, 1 casa decimal
  impactoMesAnterior?: number;
}

export interface Item {
  id: string; data: string;   // ISO 'AAAA-MM-DD'
  veiculo: string; jornalista: string; tier: Tier; sentimento: Sentimento;
  concessionaria: string; uf: string; titulo: string; trecho: string;
  url: string | null;         // null na demonstração: abre o modal de prévia
  impacto: number;            // 2 casas decimais
}

export interface Subtema extends No {
  contagens?: { pos: number; neu: number; neg: number }; // absolutos do subtema inteiro
  tier1?: number;
  nivel4?: {
    leitura: string; tituloLista: string; subtituloLista: string;
    porDia: { total: number[]; negativas: number[]; destaque: { inicio: number; fim: number } };
    itens: Item[];            // AMOSTRA ilustrativa, não o universo
  };
}

export interface LinhaRecorte { nome?: string; tier?: Tier; uf?: string; veiculo?: string;
  volume: number; negativas?: number; impacto: number }

export interface Tema extends No {
  filhos?: Subtema[];
  nivel3?: {
    leitura: string; tituloTabela: string; subtituloTabela: string;
    destaque: {
      subtemaId: string; titulo: string; subtitulo: string;
      tiers: { titulo: string; linhas: LinhaRecorte[] };
      concessionarias: { titulo: string; linhas: LinhaRecorte[] };
      veiculos: { titulo: string; linhas: LinhaRecorte[] };
      jornalistas: { titulo: string; linhas: LinhaRecorte[] };
    };
  };
}

export interface Pilar extends No {
  filhos?: Tema[];
  nivel2?: {
    leitura: string; tituloTabela: string; subtituloTabela: string;
    destaque: {
      temaId: string;
      evolucao: { titulo: string; subtitulo: string; meses: string[]; impactos: number[]; volumes: number[] };
      concentracao: { titulo: string; subtitulo: string;
        concessionarias: { nome: string; volume: number; impacto: number }[];
        ufs: { nome: string; volume: number; impacto: number }[] };
    };
  };
}

export interface FiltroProprio { id: string; rotulo: string; opcoes: string[] }

export interface Lente {
  id: 'imprensa' | 'mercado' | 'sociedade' | 'clientes' | 'institucional';
  nome: string; publico: string; cor: string; peso: number; nota: number;
  serie: number[];            // 6 meses, o último é a nota atual
  fonte: string; unidade: string; volumeTotal: number; totalPonderado?: number;
  drill: boolean;             // só a Imprensa desce além do Nível 1 nesta versão
  filtroProprio: FiltroProprio | FiltroProprio[];   // Sociedade digital tem dois
  kpis: { rotulo: string; valor: string; nota: string }[];
  leitura: string;
  tabelaPilares: { titulo: string; subtitulo: string };
  pilares: Pilar[];
  cartoesLaterais: CartaoLateral[];
}

export type CartaoLateral =
  | { tipo: 'oQueMudou'; rotulo: string; titulo: string; de: number; para: number;
      linhas: { rotulo: string; valor: number }[]; nota: string }
  | { tipo: 'historia'; rotulo: string; titulo: string; texto: string;
      metricas: { valor: string; rotulo: string; negativo?: boolean }[];
      itemId: string; destino: { lente: string; pilar: string; tema: string; subtema: string } }
  | { tipo: 'divergentes'; rotulo: string; titulo: string; subtitulo?: string;
      linhas: { rotulo: string; valor: number }[] }
  | { tipo: 'eventos'; rotulo: string; titulo: string;
      eventos: { sentimento: Sentimento; selo: string; meta: string; titulo: string; nota: string | null }[] }
  | { tipo: 'tabela'; rotulo: string; titulo: string; subtitulo?: string; colunas: string[];
      linhas: string[][]; linhaDestaque?: number;
      barras?: { rotulo: string; linhas: { rotulo: string; valor: number }[]; sufixo: string } }
  | { tipo: 'post'; rotulo: string; titulo: string; post: { sentimento: Sentimento; perfil: string;
      rede: string; data: string; concessionaria: string; uf: string; texto: string;
      metricas: { valor: string; rotulo: string }[]; url: string | null } }
  | { tipo: 'saldos'; rotulo: string; titulo: string; subtitulo?: string;
      linhas: { nome: string; interacoes: number; saldo: number }[] }
  | { tipo: 'contagens'; rotulo: string; titulo: string; subtitulo?: string;
      secoes: { rotulo: string; linhas: [string, string][] }[] };

export interface Dados {
  meta: { versao: string; mesReferencia: string; rotuloMes: string; mesAnterior: string;
          dataCorte: string; aviso: string; meses: string[] };
  faixas: { id: FaixaId; rotulo: string; min: number; max: number; fundo: string; texto: string; fundoGrafico: string }[];
  pesoTier: Record<Tier, number>;
  lentes: Lente[];
}
```

### C.3 O que existe na árvore (e o que não existe)

| Lente | Nível 1 (pilares) | Nível 2 (temas) | Nível 3 (subtemas) | Nível 4 (matérias) |
|---|---|---|---|---|
| Imprensa | 7 pilares | os 7 pilares têm temas | só Abastecimento de água e Contratos e Regulação | só Rompimento de adutora (11 itens de amostra) e Fiscalização regulatória (7 itens de amostra) |
| Mercado, Sociedade digital, Clientes, Institucional | 7 pilares | não navegável | não navegável | não navegável |

Regra de navegabilidade, aplicada em todas as tabelas:

- Pilar é navegável se `lente.drill === true` e `pilar.filhos?.length > 0`
- Tema é navegável se `tema.filhos?.length > 0` e `tema.nivel3` existe
- Subtema é navegável se `subtema.nivel4` existe

Linha não navegável: sem seta, sem cursor de mão, nome em texto comum (não link), e `title="Detalhamento disponível com a carga completa de dados"` na linha. Ela nunca pode parecer clicável e não fazer nada.

### C.4 Invariantes (teste automatizado obrigatório)

Reproduza em `invariantes.test.ts` as regras de `validar_dados.py`. O JSON entregue passa em todas. Se algum teste falhar, o problema é no código de leitura, não no JSON.

1. Pesos das lentes somam 1
2. Para cada lente: `serie[5] === nota` e `|50 + Σ impacto dos pilares − nota| ≤ 0,5`
3. Para cada lente: Σ volume dos pilares `=== volumeTotal`; sempre 7 pilares
4. Toda distribuição de sentimento soma 100
5. Para cada nó com filhos: Σ volume dos filhos `===` volume do pai e `|Σ impacto dos filhos − impacto do pai| ≤ 0,05`
6. Ids únicos entre irmãos
7. Tema em destaque do Nível 2 é o de maior `|impacto|` (desempate por maior volume); sua evolução termina no impacto e no volume do tema; a concentração por concessionária e por UF soma o volume e o impacto do tema
8. Recortes do Nível 3 (tiers e concessionárias) somam volume e impacto do subtema em destaque
9. Subtema com `nivel4`: `contagens` somam o volume; `porDia` tem 31 posições, total soma o volume, negativas somam `contagens.neg`, e nenhum dia tem mais negativas que total
10. Impacto de cada item: `sinal × pesoTier × 50 ÷ totalPonderado`, arredondado em 2 casas (Tier 1 negativo = −0,12)
11. A amostra de itens tem pelo menos um item de cada sentimento (nenhuma aba fica vazia)
12. Cartão "O que mudou": `de + Σ linhas = para`, `de === serie[4]`, e cada linha é igual a `impacto − impactoMesAnterior` do pilar de mesmo nome

### C.5 Índice geral

Calculado, nunca digitado: `ISR[m] = arredonda(Σ peso × serie[m])`. Resultado esperado: `[55, 63, 53, 49, 51, 49]`.

Atenção ao arredondamento: use meio para cima (`Math.round`). O mês de abril dá 62,5 e precisa virar 63. Não use `toFixed`, que tem erro de ponto flutuante em casos de meio. Função padrão:

```ts
export const arred = (x: number, casas = 0) => {
  const f = 10 ** casas;
  return Math.round((x + Number.EPSILON) * f) / f;
};
```

---

## Parte D · Navegação, URL e estados

### D.1 Rota e parâmetros

Rota: dentro do módulo KPIs Reputacionais, por exemplo `/kpis-reputacionais/consulta`. Use o padrão de rota que a Fase 0 encontrar.

| Parâmetro | Valores | Efeito |
|---|---|---|
| `lente` | `imprensa`, `mercado`, `sociedade`, `clientes`, `institucional` | lente ativa; ausente = `imprensa` |
| `pilar` | id do pilar | Nível 2 |
| `tema` | id do tema | Nível 3 (exige `pilar`) |
| `subtema` | id do subtema | Nível 4 (exige `pilar` e `tema`) |
| `sent` | `todas`, `negativas`, `neutras`, `positivas` | aba da lista no Nível 4; padrão `todas` |
| `ordem` | `impacto`, `data` | ordenação da lista; padrão `impacto` |
| `tier`, `conc`, `uf` | valor da opção | filtros da lista no Nível 4 |
| `item` | id do item | destaca a linha no Nível 4 e rola até ela |

O nível é derivado dos parâmetros presentes: só `lente` = Nível 1; `pilar` = Nível 2; `tema` = Nível 3; `subtema` = Nível 4.

### D.2 `resolverCaminho` (função pura, com teste)

```ts
resolverCaminho(dados, params) => { lente, pilar?, tema?, subtema?, nivel: 1|2|3|4, urlCorrigida?: string }
```

1. Lente inexistente: usa `imprensa`
2. Desce na árvore parâmetro por parâmetro. No primeiro id inexistente ou não navegável (regra C.3), para no nível anterior
3. Se parou antes do que a URL pedia, devolve `urlCorrigida` e a página faz `replace` (não `push`) para ela
4. Parâmetros de nível maior sem os de nível menor (ex.: `tema` sem `pilar`) são descartados
5. Lente com `drill: false` ignora `pilar`, `tema` e `subtema`

Casos de teste mínimos: URL vazia; cada nível válido; `pilar` inválido; `tema` válido com `pilar` errado; `subtema` sem `nivel4`; `lente=mercado&pilar=governanca`; `lente=xyz`.

### D.3 Comportamento de navegação

- Cada descida de nível faz `push` na história do navegador. Voltar e avançar do navegador funcionam.
- Trocar de lente vai para o Nível 1 da lente nova e descarta os demais parâmetros.
- Ao mudar de nível: rolar para o topo (`window.scrollTo({ top: 0 })`, sem animação) e mover o foco para o título principal do nível (`h1` com `tabIndex={-1}`).
- Recarregar a página em qualquer URL válida reabre exatamente a mesma tela.
- Nenhuma animação de transição entre níveis. Só os estados de hover descritos.
- Cada bloco grande da página fica dentro de um `LimiteDeErro` (ErrorBoundary). Se um gráfico falhar, aparece no lugar um cartão com o texto "Não foi possível exibir este bloco." e o restante da página continua de pé.

---

## Parte E · Layout e componentes

### E.1 Tokens

Use os tokens existentes em `src/index.css` quando houver equivalente. Valores de referência:

| Uso | Valor |
|---|---|
| Fundo da página | `#F4F6FC` |
| Cartão | fundo `#FFFFFF`, borda `1px #E2E5F0`, raio `4px`, sem sombra; no hover `0 6px 18px rgba(17,23,153,.08)` só em cartões clicáveis |
| Texto principal / secundário / apoio | `#191B23` / `#44495C` / `#6B7186` |
| Azul Mar (marca, títulos, links, curva principal) | `#0027BD`; hover de link e botão `#111799` |
| Turquesa (acento) | `#17E3CB` |
| Sentimento em gráficos | positivo `#17E3CB`, neutro `#B0B9C8`, negativo `#FF5C60` |
| Sentimento em selos (texto sobre fundo) | positivo `#0A6B60` sobre `#DFFAF6`; neutro `#44495C` sobre `#EEF1F8`; negativo `#B32328` sobre `#FFE7E8` |
| Número negativo / positivo em texto | `#B32328` / `#0A6B60` (nunca o vermelho ou turquesa de gráfico em texto, por contraste) |
| Cores das lentes (só filete superior do seletor e marcadores) | Imprensa `#17E3CB`, Mercado `#0027BD`, Sociedade digital `#FE952B`, Clientes `#E12379`, Institucional `#A11FFF` |
| Trilho de barras | `#EEF1F8` |
| Eixo zero das barras divergentes | `1px #8C91A4` |
| Fonte | DM Sans 400, 500, 700, 800; números com `font-variant-numeric: tabular-nums` |
| Rótulo pequeno (kicker) | 12px, 700, caixa alta, `letter-spacing: .06em`, `#6B7186` |
| Título de cartão | 20px, 700, `#0027BD`, `line-height 1.3` |
| Subtítulo de cartão | 14px, `#44495C`, `line-height 1.5` |
| Espaçamento | página `24px 32px 56px`, máx. 1440px centralizado; entre blocos 20px; dentro do cartão 20px |
| Foco | `outline: 2px solid #0027BD; outline-offset: 2px` em todo elemento interativo |

Faixas da nota (vêm de `dados.faixas`): Referência 85 ou mais, Sólido 70 a 84, Estável 55 a 69, Atenção 40 a 54, Crítico abaixo de 40. Função `faixaDe(nota)` com teste para 39, 40, 54, 55, 69, 70, 84 e 85.

### E.2 Formatação (`formatacao.ts`, com teste)

Sinal de menos é sempre o caractere `−` (U+2212), nunca hífen.

| Função | Entrada | Saída |
|---|---|---|
| `fmtPt(x)` | −7.4 / 1.2 / 0 | `−7,4 pt` / `+1,2 pt` / `0,0 pt` |
| `fmtPtItem(x)` | −0.12 / 0.12 / 0 | `−0,12` / `+0,12` / `0,00` |
| `fmtInt(n)` | 18420 | `18.420` |
| `fmtPct(n)` | 61 | `61%` |
| `fmtSaldo(pos, neg)` | 14, 50 | `−36` |
| `fmtDelta(d)` | −6 / 4 | `▼ 6 pt` em `#B32328` / `▲ 4 pt` em `#0A6B60` |
| `fmtDataCurta(iso)` | 2026-08-12 | `12/08` |
| `fmtDataLonga(iso)` | 2026-08-12 | `12/08/2026` |

Zero exato não leva sinal. Valor que arredonda para zero também mostra `0,0`.

### E.3 Moldura comum a todos os níveis (de cima para baixo)

**1. Cabeçalho do módulo.** Use o cabeçalho e as abas existentes do módulo KPIs Reputacionais. Acrescente a aba "Consulta em profundidade" como ativa. Não recrie o cabeçalho.

**2. Seletor de lentes.** Grade de 6 cartões, `repeat(auto-fit, minmax(190px, 1fr))`, gap 12px.

- Primeiro cartão: "Índice geral", rótulo "Média das 5 lentes", nota calculada (C.5), faixa e variação contra o mês anterior. Fundo `#FAFBFE`, filete superior `#191B23`. Se a rota do Radar existir, é link para ela; senão, não é clicável.
- Demais cartões: um por lente, na ordem Imprensa, Mercado, Sociedade digital, Clientes, Institucional. Conteúdo: público (kicker 11px), nome (15px 700), nota (26px 800), selo da faixa, variação `nota − serie[4]`.
- Filete superior de 3px na cor da lente. Cartão ativo: borda `#0027BD` mais `box-shadow: 0 0 0 1px #0027BD` e `aria-current="page"`.
- Cada cartão é um link para `?lente=<id>`.

**3. Faixa de filtros.** Barra com `linear-gradient(90deg, #0027BD 0%, #0027BD 35%, #17E3CB 100%)`, raio 4px, padding `8px 10px 8px 16px`, quebra de linha permitida.

- Rótulo "Filtros:" em branco, 14px 700. Texto branco só sobre o trecho azul.
- Botões brancos de 40px de altura: `Período: Ago/26`, `Concessionária: Todas`, `UF: Todas`, `Sentimento: Todos`, mais o filtro próprio da lente (`filtroProprio`; na Sociedade digital são dois botões: Rede e Perfil de quem fala). Formato do texto: rótulo em `#44495C`, valor em 700 `#191B23`, seta para baixo em SVG.
- À direita, campo de busca branco (seção E.9), largura até 340px.
- Comportamento dos filtros (para não haver promessa que a demonstração não cumpre):
  - Todos os botões abrem uma lista de opções com o valor atual marcado.
  - Período: só `Ago/26` disponível.
  - Nos Níveis 1, 2 e 3: as opções além do padrão aparecem desabilitadas, com a nota no rodapé da lista "Na demonstração, este recorte se aplica à lista de matérias."
  - No Nível 4: Concessionária, UF, Sentimento e Tier filtram a lista de matérias (parâmetros `conc`, `uf`, `sent`, `tier`). As opções mostradas são só as presentes na amostra. O botão Sentimento e as abas da lista usam o mesmo parâmetro `sent` e ficam sempre sincronizados.
  - Fecha com `Esc`, clique fora ou seleção.

**4. Trilha e indicador de nível.** Linha com `justify-content: space-between`, quebra permitida.

- Trilha: um item por nível percorrido, separados por seta cinza `#A6ABBD`. Cada item mostra nome e um chip numérico: na lente, a nota (fundo `#EEF1F8`); nos demais, o impacto em pontos (`fmtPt`), fundo `#FFE7E8` e texto `#B32328` se negativo, `#DFFAF6` e `#0A6B60` se positivo.
- Itens anteriores: links brancos com borda `#E2E5F0`, 36px de altura, texto `#0027BD` 700.
- Item atual: fundo `#0027BD`, texto branco, `aria-current="page"`, não clicável.
- Indicador à direita: 5 segmentos de 22×4px (preenchidos `#0027BD` até o nível atual, demais `#D5DAEA`) e o texto "Nível N de 4 · <nome do nível>". Nomes: 1 Lente e pilares, 2 Temas estratégicos, 3 Subtemas, 4 Matérias.
- Selo fixo "Dados ilustrativos" (`meta.aviso`) ao lado do indicador, estilo selo neutro. Não remova: protege a apresentação contra comparação com telas de dados reais.

### E.4 Nível 1 · Lente e pilares

Ordem: moldura, cartão da nota, e abaixo uma linha com a tabela de pilares à esquerda (`flex: 999 1 760px`) e a coluna de cartões laterais à direita (`flex: 1 1 380px`, gap 20px). Abaixo de cerca de 1180px, a coluna lateral desce para baixo da tabela.

#### E.4.1 Cartão da nota

Três colunas em flex com quebra, padding `24px 24px 18px`, gap `28px 36px`:

1. **Nota** (`flex: 0 1 240px`): kicker com o público; `h1` com o nome da lente (26px 800 `#0027BD`); nota em 112px 800, `letter-spacing −.04em`, `line-height .95`; linha com selo da faixa (13px) e variação "▼ 6 pt vs. julho" (`meta.mesAnterior`); bloco 13px com "Peso no índice geral: 30%", "Média do semestre: 51" (média aritmética da série, arredondada) e "Fonte: ...".
2. **Gráfico** (`flex: 1 1 460px`): kicker "Nota nos últimos 6 meses", legenda à direita, gráfico da seção F.1 e, abaixo, a legenda das faixas.
3. **Indicadores** (`flex: 0 1 250px`, borda esquerda `#E2E5F0`, padding-left 24px): os 4 `kpis` em pilha, cada um com rótulo (kicker 11px), valor (22px 800) e nota (12px `#44495C`), separados por linha `#EEF1F8`.

Rodapé do cartão, com borda superior: kicker "Leitura do mês" em `#0027BD` e o texto `lente.leitura` em 17px, `line-height 1.55`, ocupando a largura do cartão.

#### E.4.2 Tabela de impacto (componente reutilizado nos Níveis 1, 2 e 3)

Cabeçalho do cartão: título (`tabelaPilares.titulo`, `nivel2.tituloTabela` ou `nivel3.tituloTabela`) e subtítulo correspondente. Na lente sem `drill`, remova do subtítulo qualquer convite a clicar (os subtítulos do JSON dessas lentes já não convidam).

Corpo dentro de `overflow-x: auto` com `min-width: 820px`. Grade de colunas, igual em cabeçalho e linhas:

```
grid-template-columns: minmax(0,2.3fr) minmax(0,1.25fr) minmax(0,1.8fr) minmax(0,2.1fr) 36px;
gap: 20px; padding: 14px 20px;
```

| Coluna | Cabeçalho | Conteúdo |
|---|---|---|
| 1 | Pilar / Tema estratégico / Subtema | nome, 15px 700; se for o destaque, selo "Em destaque" abaixo |
| 2 | Volume | linha 1: volume (14px 700) e, em `#6B7186`, a participação `round(volume ÷ Σ volumes irmãos × 100)%`; linha 2: a unidade (`matérias`, `menções`...) em 12px; barra de volume (F.3) |
| 3 | Sentimento | barra de sentimento (F.2) e, abaixo, `14% pos · 50% neg · saldo −36` em 12px com o saldo colorido |
| 4 | Impacto na nota (à direita do rótulo, "pontos" em 12px) | barra de impacto (F.4) com o valor |
| 5 | vazio | seta para a direita em `#0027BD`, alvo de 36×36px, só se a linha for navegável |

Agrupamento:

- Faixa "O que pressiona" (kicker em `#B32328`) com a soma dos impactos negativos à direita; linhas negativas ordenadas do mais negativo para o menos negativo.
- Faixa "O que sustenta" (kicker em `#0A6B60`) com a soma; linhas com impacto maior ou igual a zero, ordenadas do maior para o menor. Zero fica por último.
- Faixas de grupo com fundo `#FAFBFE` e borda superior. Grupo sem linhas não aparece.

Escala: a barra de impacto usa a mesma escala para todas as linhas da tabela, `escala = max(|impacto|) × 1,05`. Nunca escala por linha.

Rodapé "A conta fecha", 13px:

- Nível 1: `Neutro 50 · pressiona −11,1 · sustenta +3,1 · = nota 42`
- Níveis 2 e 3: `pressiona −7,8 · sustenta +0,4 · = impacto do pilar −7,4 pt` (ou "do tema")

Os valores de "pressiona" e "sustenta" vêm da soma das linhas, com 1 casa. O valor final nunca é recalculado: no Nível 1 é `lente.nota`; nos Níveis 2 e 3 é o `impacto` do pilar ou do tema. Assim o rodapé nunca diverge da trilha por arredondamento.

Linha navegável: a linha inteira é um único link (`<a>` do roteador com `display: grid`), hover `#F8FAFF`, nome em `#191B23` que vira `#0027BD` no hover. Linha em destaque: fundo `#F1F4FD`, nome em `#0027BD`.

#### E.4.3 Cartões laterais da Imprensa

**oQueMudou**: kicker, título, linha grande "48 → 42" (de em 34px 800 `#6B7186` com "julho" em 13px, seta cinza, para em 34px 800 `#191B23` com "agosto"), linhas com barras divergentes compactas (F.4, versão compacta, escala `max(|valor|) × 1,15`) na ordem do JSON, e a `nota` em 13px no fim.

**historia**: kicker, título, texto; três métricas em caixas `#F4F6FC` (a marcada `negativo` em `#FFE7E8` com texto `#B32328`); bloco com borda mostrando o item `itemId` (selo de sentimento, selo de tier, "O Globo · 12/08/2026", título em 15px 700); botão "Abrir matéria ↗" (abre o modal F.8) e link "Ver as 96 matérias" que navega para `destino` (Nível 4). O número "96" vem do volume do subtema de destino.

### E.5 Nível 2 · Temas estratégicos do pilar

1. Moldura (trilha: Imprensa › pilar)
2. **Resumo do nível** (componente `ResumoNivel`): à esquerda kicker "Pilar · Imprensa", `h1` com o nome do pilar, link "‹ Voltar aos pilares"; à direita, métricas separadas por borda vertical: Matérias (volume), Peso na lente (participação do pilar no `volumeTotal`), Saldo (pos − neg), Impacto (`fmtPt`), vs. julho (`impacto − impactoMesAnterior`, só se existir). Rodapé: kicker "Leitura do nível" e `nivel2.leitura` em 16px.
3. **Tabela de impacto** dos temas, com o tema `destaque.temaId` marcado.
4. Linha com dois cartões lado a lado (`flex: 1 1 560px` cada):
   - **Evolução**: kicker "Evolução mês a mês · <nome do tema>", título e subtítulo do JSON, gráfico F.5.
   - **Concentração**: kicker "Onde se concentra · <nome do tema> em agosto", título e subtítulo, duas listas lado a lado ("Concessionária" e "UF") no formato F.6.

### E.6 Nível 3 · Subtemas do tema

1. Moldura (trilha: Imprensa › pilar › tema)
2. Resumo do nível: kicker "Tema estratégico · <pilar>", `h1` tema, link "‹ Voltar aos temas"; métricas Matérias, Negativas (`sentimento.neg%`), Impacto, vs. julho (se houver). Leitura: `nivel3.leitura`.
3. Tabela de impacto dos subtemas, com `destaque.subtemaId` marcado.
4. **Cartão de recortes**: cabeçalho com kicker "Recortes · <subtema> em agosto", título e subtítulo do destaque, e à direita o botão primário "Ver as N matérias" (fundo `#0027BD`, texto branco, 44px, seta) que navega ao Nível 4 do subtema em destaque. Corpo em grade `repeat(auto-fit, minmax(min(100%,400px),1fr))`, gap 16px, com quatro quadros (borda `#E2E5F0`, raio 4px, padding 16px), cada um com kicker, frase-título (15px 700, do JSON) e conteúdo:
   - **Por tier**: uma linha por tier: selo do tier (70px), barra de volume (largura proporcional ao maior volume entre os tiers) com "34 matérias · 35%" abaixo, e barra de impacto compacta (escala `max × 1,1`)
   - **Concessionária e UF**: nome (700), UF, barra de participação no subtema, impacto
   - **Veículos que mais puxaram o negativo**: tabela Veículo (nome + selo do tier) | Matérias | Negat. | pt
   - **Jornalistas**: tabela Jornalista (nome e veículo abaixo em 12px) | Matérias | Negat. | pt. O subtítulo do cartão já informa que os nomes são fictícios.

### E.7 Nível 4 · Matérias do subtema

1. Moldura (trilha completa: Imprensa › pilar › tema › subtema)
2. **Resumo com gráfico diário**: à esquerda kicker "Subtema · <tema>", `h1`, link "‹ Voltar aos subtemas", métricas Matérias, Negativas (`contagens.neg`, em `#B32328`), Tier 1 (`tier1`), Impacto. À direita (`flex: 1 1 560px`) kicker "Matérias por dia em agosto", legenda (Negativas, Demais) e gráfico F.7. Rodapé com "Leitura do nível".
3. **Lista** (F.9).

### E.8 Nível 1 das demais lentes

Mesma estrutura do E.4: cartão da nota, tabela de pilares (não navegável, sem setas) e cartões laterais conforme `tipo`:

| tipo | Renderização |
|---|---|
| `divergentes` | kicker, título, subtítulo, linhas `rótulo | barra de impacto compacta` com escala `max(|valor|) × 1,1` |
| `eventos` | um bloco com borda por evento: selo de sentimento com o texto `selo`, `meta` à direita em 12px, título 14px 700, `nota` em 12px se houver |
| `tabela` | grade com cabeçalho kicker 11px (primeira coluna à esquerda, demais à direita) e linhas separadas por `#EEF1F8`. A `linhaDestaque` mostra os números em `#B32328` 800. Se houver `barras`, abaixo vem um kicker e barras horizontais azuis com o valor e o `sufixo` |
| `post` | bloco com borda: selo de sentimento, selo do perfil (fundo `#FFF1DC`, texto `#8A4E00`), "Instagram · 14/08 · Águas do Pará · PA"; texto entre aspas curvas em 14px; métricas em negrito; botão "Ver post ↗" que abre o modal F.8 |
| `saldos` | cabeçalho Instituição | Inter. | Saldo de clima; barra divergente com escala fixa 60 e valor sem casas decimais, sem "pt" |
| `contagens` | seções com kicker e linhas `texto | valor em negrito` |

### E.9 Busca inteligente

Campo com ícone de lupa, placeholder "Buscar veículo, tema, concessionária…", `aria-label` igual.

Índice (montado uma vez com `useMemo`):

| Tipo | Origem | Destino |
|---|---|---|
| Lente | as 5 lentes | Nível 1 da lente |
| Pilar | pilares da Imprensa | Nível 2 |
| Tema | temas da Imprensa | Nível 3 se o tema for navegável; se não, Nível 2 do pilar ao qual pertence |
| Subtema | subtemas existentes | Nível 4 se tiver `nivel4`; se não, Nível 3 do tema |
| Matéria | itens das amostras; busca em título, veículo, jornalista e concessionária | Nível 4 do subtema com `item=<id>` |

Regras:

- Normalização: minúsculas, sem acento (`normalize('NFD').replace(/\p{Diacritic}/gu, '')`), espaços colapsados
- Dispara com 2 caracteres ou mais; cada palavra digitada precisa aparecer no texto buscado
- Ordem: Subtema, Tema, Pilar, Lente, Matéria; dentro do tipo, primeiro quem começa com o termo, depois maior `|impacto|`
- Máximo de 8 resultados, no máximo 3 matérias; resultados agrupados por tipo com kicker do grupo
- Cada resultado mostra nome (trecho buscado em 700 `#0027BD`), impacto à direita quando houver, e o caminho em 12px (`Imprensa › Eficiência Operacional e Qualidade › Abastecimento de água · 96 matérias`)
- Teclado: setas sobem e descem, `Enter` abre o resultado ativo (o primeiro, se nenhum foi escolhido), `Esc` fecha e limpa o destaque. Mouse: clique abre. Clique fora fecha.
- Sem resultado: "Nenhum resultado para "<termo>". Tente um tema, um subtema ou um veículo."
- Lista com `role="listbox"`, opções `role="option"` com `aria-selected`; campo com `aria-expanded` e `aria-controls`
- Painel flutuante: cartão branco com sombra `0 14px 34px rgba(17,23,153,.18)`, largura 460px alinhado à direita do campo, sobre o conteúdo (`z-index` acima dos cartões)

Exemplos que precisam funcionar: `adutora`, `agua` (sem acento), `O Globo`, `fiscalizacao`, `Corsan`, `rating`.

---

## Parte F · Gráficos

Todos em SVG ou HTML próprio, sem biblioteca. SVG com `viewBox` fixo, `width="100%"`, `height` automático, `role="img"` e `aria-label` descritivo em português. Fonte herdada da página.

### F.1 Linha da nota, 6 meses (`GraficoLinhaNota`)

- `viewBox="0 0 600 236"`
- Área de plotagem: x de 56 a 548; y de 16 a 196
- Domínio y padrão: 35 a 80. Se algum valor da lente ou do índice ficar abaixo de 37 ou acima de 78, estenda o domínio em múltiplos de 5 até haver 2 pontos de folga
- `y(v) = 16 + (yMax − v) × 180 ÷ (yMax − yMin)`
- `x(i) = 76 + i × 90,4` para i de 0 a 5
- Faixas de fundo: retângulos de x 56 a 548, um por faixa recortada ao domínio, cor `fundoGrafico`, limites nos valores mínimos de cada faixa (40, 55, 70, 85)
- Marcas do eixo y: 40, 55 e 70 (e 85 se estiver no domínio), texto 11px `#6B7186`, `text-anchor="end"` em x 48
- Índice geral: polilinha tracejada `#6B7186`, 1,6px, `stroke-dasharray="4 4"`; pontos de raio 2,5; rótulo só no último mês, 11px 700 `#44495C`, em x+10 do último ponto
- Lente: polilinha `#0027BD`, 2,6px, `stroke-linejoin="round"`; pontos de raio 4 com contorno branco de 2px; último ponto com raio 6
- Rótulo de valor da lente em cada ponto, 12px 700 `#0027BD` (último 15px 800): acima do ponto (y − 11) quando a lente está maior ou igual ao índice no mês, abaixo (y + 20) quando está menor. Isso evita sobrepor a linha tracejada.
- Meses em y 222, 12px, `#6B7186`; o mês atual em 700 `#191B23`
- Não escreva nomes de faixa dentro do gráfico (no protótipo eles colidiam com o último ponto). Abaixo do SVG, legenda das faixas em 12px: quadrado 10px da cor `fundoGrafico` com borda `#D5DAEA`, e "Crítico <40 · Atenção 40–54 · Estável 55–69 · Sólido 70–84"
- Legenda das séries acima, à direita: segmento sólido azul + nome da lente; segmento tracejado cinza + "Índice geral"
- Tooltip (P2): coluna invisível por mês; ao passar o mouse, caixa com "ago/26 · Imprensa 42 · Índice geral 49"

### F.2 Barra de sentimento (`BarraSentimento`)

HTML. Trilho `#EEF1F8`, altura 10px, raio 2px, `overflow: hidden`, `display: flex`. Três segmentos na ordem positivo, neutro, negativo, com `width` igual ao percentual. `role="img"` e `aria-label="14% positivas, 36% neutras, 50% negativas"`. Texto abaixo, 12px: `14% pos · 50% neg · saldo −36`.

### F.3 Barra de volume (`BarraVolume`)

Trilho `#EEF1F8`, altura 6px; preenchimento `#0027BD` com largura `volume ÷ maior volume entre os irmãos × 100%`.

### F.4 Barra de impacto divergente (`BarraImpacto`)

HTML em grade `1fr 1fr <larguraValor>`:

- Metade esquerda: `display: flex; justify-content: flex-end`, borda direita `1px #8C91A4` (é o eixo zero), altura 24px
- Metade direita: `display: flex`, altura 24px
- Negativo: barra `#FF5C60` na metade esquerda; positivo: barra `#17E3CB` na metade direita
- Largura da barra: `min(|valor| ÷ escala, 1) × 100%` da metade
- Valor à direita, alinhado à direita, 800, cor de texto do sinal (`#B32328`, `#0A6B60`, ou `#44495C` para zero)
- Versão padrão: barra de 14px, valor 15px, coluna de valor 72px
- Versão compacta (cartões laterais e recortes): barra de 10px, valor 13px, coluna 62px
- Zero: nenhuma barra, só o eixo e "0,0 pt"

### F.5 Colunas de impacto mês a mês (`GraficoColunasImpacto`)

- `viewBox="0 0 600 270"`
- Linha de volumes no topo: rótulo "matérias" em x 10, y 18, 11px `#6B7186`; o volume de cada mês centralizado sobre a coluna, 12px 700 `#44495C`
- Área de plotagem: y de 40 a 220
- Domínio: `[min(0, menor) × 1,15 ; max(0, maior) × 1,15]`. Se todos os valores forem zero, domínio de −1 a 1
- Linha de base em `y(0)`, de x 30 a 570, `1px #8C91A4`, com "0" em 11px à esquerda
- Seis colunas de 46px centradas em `x(i) = 80 + i × 88`; cada coluna vai da linha de base até o valor (para baixo se negativo, para cima se positivo)
- Cor: mês atual `#FF5C60` (negativo) ou `#17E3CB` (positivo); meses anteriores `#FFB8BA` ou `#A2F1E8`
- Valor no fim da coluna, 12px 800 (mês atual 14px), cor de texto do sinal; abaixo da coluna se negativo (y + 16), acima se positivo (y − 6)
- Meses em y 258
- Funciona para temas positivos (Crédito e rating) e mistos sem ajuste manual

### F.6 Lista de concentração

Linhas em grade `minmax(0,1.3fr) minmax(0,1.6fr) 80px 64px`, padding 8px 0, borda superior `#EEF1F8`: nome (13px 700) | barra azul com largura `volume ÷ volume do tema` | `131 · 61%` | impacto com 1 casa, sem "pt", na cor do sinal.

### F.7 Matérias por dia (`GraficoDiario`)

- `viewBox="0 0 640 150"`
- Área: x de 20 a 628, base em y 120, altura útil 100
- `larguraDia = 608 ÷ 31`; barra com 68% da largura do dia, alinhada à esquerda da célula com 16% de recuo
- `yMax = ceil(maior total × 1,1)`; altura de cada unidade `100 ÷ yMax`
- Cada dia: barra empilhada, negativas embaixo (`#FF5C60`) e demais em cima (`#B0B9C8`, valor `total − negativas`)
- Faixa de destaque atrás das barras, do dia `inicio` ao dia `fim`, retângulo `#F1F4FD` de y 4 a 120, e texto 11px 700 `#0027BD` no topo: "12 a 18/08 · 69 matérias" (soma calculada dos totais do intervalo)
- Marcas de dia em y 138, 11px `#6B7186`: 1, 5, 10, 15, 20, 25 e 31
- Linha de base `#8C91A4`
- Tooltip por dia (P2): "14/08 · 12 matérias, 10 negativas"

### F.8 Modal de prévia (`ModalPrevia`)

Abre a partir de "Abrir matéria ↗", "Ver post ↗" e do cartão "A história do mês".

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` no título, foco preso, foco inicial no botão fechar, `Esc` e clique no fundo fecham, foco volta para o botão que abriu
- Fundo `rgba(25,27,35,.45)`; caixa branca, raio 6px, largura até 640px, padding 24px
- Conteúdo: selo de sentimento, selo de tier (ou perfil, no post), linha "O Globo · Renata Moura · 12/08/2026" (no post: "Instagram · Figura pública · 14/08/2026"), título (20px 700 `#0027BD`), trecho (15px, `line-height 1.6`), linha "Águas do Rio · RJ", "Impacto na nota: −0,12 pt"
- Se `url` existir: botão "Abrir no site de origem ↗" com `target="_blank"` e `rel="noopener noreferrer"`
- Se `url` for nulo (caso da demonstração): no lugar do botão, texto 13px `#44495C`: "O link para a fonte original entra com a integração do clipping." Nunca gerar URL inventada nem link para `#`.

### F.9 Lista de matérias (`ListaMaterias`)

Cabeçalho do cartão: título e subtítulo de `nivel4`. À direita, dois grupos de botões segmentados (40px de altura, borda `#D5DAEA`, ativo com fundo `#0027BD` e texto branco):

- Sentimento: "Todas 96", "Negativas 71", "Neutras 17", "Positivas 8", com os números de `contagens` do subtema inteiro
- "Ordenar por": "Maior impacto", "Data"

Tabela dentro de `overflow-x: auto` com `min-width: 1000px`. Grade:

```
grid-template-columns: 62px minmax(0,1.25fr) minmax(0,3.2fr) minmax(0,1fr) 76px 156px; gap: 16px;
```

| Coluna | Conteúdo |
|---|---|
| Data | `12/08`, 13px 700 |
| Veículo | veículo 14px 700; jornalista 12px `#6B7186` |
| Matéria | selos (sentimento com bolinha, tier) e título 15px `line-height 1.4` |
| Concessionária | nome em 700 e UF abaixo, 13px |
| Impacto | `fmtPtItem`, 15px 800, cor do sinal, alinhado à direita |
| Ação | botão contornado "Abrir matéria ↗", 40px |

Ordenação:

- **Maior impacto**: `|impacto|` decrescente; empate, negativo antes de positivo; depois data crescente; depois `id`
- **Data**: data decrescente; empate por `|impacto|` decrescente; depois `id`

Filtros: aba de sentimento e os filtros `tier`, `conc`, `uf` da faixa superior combinam com E lógico.

Linha com `item` da URL: fundo `#E6EAFB` e `scrollIntoView({ block: 'center' })` após a renderização.

Rodapé: "Amostra de 11 matérias de um total de 96 no subtema · fonte Clipei, corte em 31/08/2026". Com filtro ativo: "Mostrando 3 de 11 matérias da amostra · 96 no subtema". Não exiba "Carregar mais" nem "Exportar" (não há o que carregar na demonstração).

Vazio após filtros: mensagem "Nenhuma matéria da amostra com esses filtros." e botão "Limpar filtros" que remove `sent`, `tier`, `conc` e `uf` da URL.

---

## Parte G · Roteiro de demonstração (também é o teste ponta a ponta)

O teste Playwright percorre exatamente estes passos em 1440×900, captura uma imagem por passo em `docs/consulta-profundidade/qa/` e falha se houver qualquer `console.error`, `console.warn` de React ou `pageerror`. Em cada passo, verifique também que `document.documentElement.scrollWidth <= window.innerWidth`.

| # | Ação | Verificação |
|---|---|---|
| 1 | Abrir a rota sem parâmetros | cartão Imprensa ativo; nota "42"; selo "Atenção"; "▼ 6 pt vs. julho"; rodapé "= nota 42" |
| 2 | Conferir cartões laterais | "48" e "42" no cartão O que mudou; "Rompimento de adutora na Zona Norte do Rio" |
| 3 | Clicar na linha "Eficiência Operacional e Qualidade" | URL com `pilar=eficiencia-operacional`; trilha com 2 itens; "Nível 2 de 4"; "Abastecimento de água" com selo "Em destaque"; rodapé "−7,4 pt" |
| 4 | Clicar na linha "Abastecimento de água" | URL com `tema=abastecimento-agua`; título "Rompimento de adutora responde por dois terços da perda do tema"; botão "Ver as 96 matérias" |
| 5 | Clicar em "Ver as 96 matérias" | Nível 4; 11 linhas; primeira linha "Rompimento de adutora deixa 14 bairros..." |
| 6 | Clicar na aba "Negativas 71", depois em "Data" | 9 linhas; primeira com data 19/08 (Zero Hora) |
| 7 | Clicar em "Abrir matéria ↗" da primeira linha, depois `Esc` | modal abre com o título; fecha; foco volta ao botão |
| 8 | Clicar no item "Imprensa" da trilha | Nível 1 |
| 9 | Botão voltar do navegador | volta ao Nível 4 com a aba Negativas e ordem Data preservadas |
| 10 | Digitar "adutora" na busca | grupo Subtema com "Rompimento de adutora" e "−3,1 pt" |
| 11 | `Enter` | Nível 4 de Rompimento de adutora |
| 12 | Buscar "fiscalizacao" e clicar no subtema | Nível 4 de Fiscalização regulatória; 7 linhas |
| 13 | Clicar no cartão "Sociedade digital" | nota 38, "Crítico"; botões "Rede" e "Perfil de quem fala" na faixa; tabela sem setas |
| 14 | Clicar em "Ver post ↗" | modal com o texto do post e a nota sobre o link |
| 15 | Clicar nos cartões Mercado, Clientes e Institucional | notas 73, 49 e 44; cartões laterais com títulos do JSON |
| 16 | Clicar numa linha de pilar do Mercado | nada navega; a linha não tem seta nem cursor de mão |
| 17 | Abrir direto `?lente=imprensa&pilar=governanca&tema=contratos-regulacao&subtema=fiscalizacao-regulatoria` e recarregar | mesma tela após o recarregamento |
| 18 | Abrir `?lente=imprensa&pilar=xyz&tema=abc` | cai no Nível 1 da Imprensa, URL corrigida com `replace`, sem erro |
| 19 | Abrir `?lente=mercado&pilar=governanca` | Nível 1 do Mercado |
| 20 | Navegar só com teclado do passo 1 ao 5 | todos os elementos alcançáveis com Tab, foco visível, `Enter` ativa |

Repetir os passos 1, 3, 5 e 13 em 1280×720, 1366×768 e 1920×1080, só com captura e checagem de rolagem horizontal.

---

## Parte H · Checklist de aceite (preencher em QA.md)

- [ ] Fase 0 aprovada e decisões registradas em DECISOES.md
- [ ] Testes de invariantes (C.4), `resolverCaminho` (D.2), `faixaDe` (E.1), formatação (E.2), ordenação (F.9) e busca (E.9) passando
- [ ] Roteiro G completo passando, com capturas
- [ ] Zero erro de console, zero warning de chave (`key`) de React
- [ ] Nenhum texto de tela diferente do JSON ou desta especificação (conferir títulos dos 8 cenários contra as referências)
- [ ] Nenhum travessão (—) nem emoji em texto de tela; sinal de menos é `−`
- [ ] Nenhum link para `#` ou URL inventada
- [ ] Selo "Dados ilustrativos" visível em todos os níveis
- [ ] Barras de uma mesma tabela com a mesma escala (verificar visualmente Eficiência −7,4 com barra maior que Governança −3,1)
- [ ] Rótulos do gráfico de linha sem sobreposição em todas as 5 lentes
- [ ] Contraste: nenhum texto em `#17E3CB` ou `#FF5C60` sobre branco
- [ ] Rolagem horizontal ausente nas 4 resoluções
- [ ] Páginas existentes do módulo continuam funcionando (abrir Radar e Jornada)
- [ ] Build de produção (`npm run build` ou equivalente) sem erro

---

## Parte I · Diferenças intencionais em relação ao protótipo do canvas

O protótipo é a referência visual, mas esta especificação prevalece nos pontos abaixo:

1. Nomes de faixa saem de dentro do gráfico de linha e viram legenda abaixo dele (no protótipo colidiam com o último ponto)
2. A coluna Volume mostra a unidade em linha própria para não quebrar o número (no protótipo "512 matérias · 40%" quebrava em duas linhas)
3. A busca por subtema leva ao Nível 4 (no protótipo levava ao Nível 3)
4. A lista de matérias não tem "Carregar mais" nem "Exportar lista"; o rodapé explica que é amostra
5. "Abrir matéria" abre o modal de prévia em vez de link externo
6. O item "Em outras lentes" da busca foi retirado: a demonstração não tem base de menções por termo
7. Selo "Dados ilustrativos" fixo ao lado do indicador de nível
