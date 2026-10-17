# Bonds e reputação: a especificação contra o que existe

**Para que serve este documento.** A `ESPEC_Bonds_e_Reputacao.md` foi escrita de
fora do repositório, e diz isso de si mesma: a seção 5 é "modelo de dados
sugerido (premissa, ajustar ao Foundation)". Guilherme pediu, ao entregá-la,
que se ajustasse "ao que já existe na base para não criarmos estrutura
paralela".

Isto aqui é esse ajuste, feito item por item e com o código na mão, **antes** de
escrever tela. O que está aqui não contesta a especificação: ela continua sendo
o documento de produto, validado com a Bia. O que muda é de onde cada peça vem.

Data: 16/10/2026. Base: `front-reputacional@f02667d`, `back-reputacional@ccbe084`.

---

## 1. Decisões já tomadas

Registradas aqui porque fecham dois dos sete pontos em aberto da seção 9 da
especificação.

| # | Pergunta | Decisão | Quem, quando |
|---|---|---|---|
| 2 | Fonte do preço dos bonds | **Planilha importada**, no formato de `base_cotacoes_exemplo.csv`. Não é feed de provedor. | Lúcio, 16/10/2026 |
| 3 / 4 | Índice de Mercado semanal × painel mensal | **A diferença de granularidade está aceita.** O índice da tela é semanal; o painel segue mensal. | Lúcio, 16/10/2026 |

A decisão 2 é a que destrava o bloco 3.2 — e muda a natureza do trabalho: o que
parecia integração com provedor de preço é **mais um importador de planilha**,
da mesma família do que o Score já tem.

---

## 2. O que a especificação assume, e o que existe

### 2.1 O portal — existe como permissão, não existe como tela

A especificação (§3.1) descreve o cabeçalho do módulo "Inteligência de Mercado"
com quatro abas como se o módulo existisse.

O que existe:

```
perfis.test.ts:47   `acessa_sintese` é o portal do painel que a capa chama de
                    Inteligência de Mercado
perfis.test.ts:84   papel({ codigo: 'sintese_leitura', acessa_sintese: true, ... })
App.tsx:353         mercadoLancado — o cartão aparece como "Liberado ao lançar"
                    enquanto o painel não responde
```

Não há pasta `src/paginas/sintese`. **Esta é a primeira tela do portal**, e as
outras três abas do cabeçalho (Indicadores por unidade, Papers e cases, Busca
por tema) também não existem.

Consequência prática: "implementar a aba Bonds" inclui criar o portal e a casca
de abas. Isso precisa estar no orçamento da tarefa, e a casca deve nascer
preparada para as outras três — não embutida na tela de bonds.

O portão `mercado_lancado` já existe e deve continuar valendo: a tela nasce
atrás dele.

### 2.2 Os componentes — a suposição está certa

Todos os que a §7 cita existem em `src/componentes/basicos.tsx`:

`Cartao`, `Secao`, `Chip`, `Selo`, `Kpi`, `KpiHero`, `Barra`, `Botao`,
`Vazio`, `Carregando`, `FaixaDeErro`, `Modal`.

Nada a ajustar aqui.

### 2.3 Os gráficos — existe mais do que a especificação sabe

A especificação não cita, e o mockup traz um gráfico próprio em `<script>`.
O repositório já tem `src/graficos/`:

| arquivo | o que é |
|---|---|
| `GraficoDeLinha.tsx` | múltiplas séries em SVG, eixo Y automático com folga, `valor: null` abre vão em vez de desenhar zero |
| `JornadaDoIndice.tsx` | índice no tempo com faixas, fita de meses e cartão que segue o mouse |
| `SeletorDeJanela.tsx` | janela de período arrastável, com teclado |
| `Rosca.tsx`, `MapaUf.tsx`, `GraficoDeArvore.tsx`, `RadialDasLentes.tsx` | — |

E há política explícita, no topo do `GraficoDeLinha`:

> *"SVG puro, como o resto do produto (`Rosca`, `MapaUf`, `GraficoDeArvore`):
> nenhuma biblioteca de gráfico entra por uma linha só."*

O `package.json` confirma: só `d3-scale` e `d3-geo`, nenhuma biblioteca de
gráfico.

**Consequência:** portar o `<script>` do mockup ao pé da letra duplicaria
código que já existe e furaria a política. O caminho é estender
`GraficoDeLinha` (eixo direito, linha em degraus, faixas de episódio) ou
escrever um gráfico novo ao lado dele, no mesmo estilo.

Vale também a disciplina do `JornadaDoIndice`, que é a boa prática da casa:

> *"NENHUMA CONTA MORA AQUI. Domínio do eixo, faixas recortadas, caminho da
> curva e posição de cada rótulo saem de `dominio/jornadaDoIndice`, testado
> linha a linha. Este arquivo desenha."*

A regra de episódios (§4.4) deve nascer assim: função pura em `dominio/`, com
teste, e o componente só desenha.

### 2.4 A lente "mercado" e a tabela `evento_mercado` já existem

A §5 sugere criar `noticia`, `veiculo` e `indice_reputacional`. O back já tem
tudo isso sob outros nomes, e com mais coisa:

```
base_das_lentes.py:55    LENTES_DA_BASE = ("imprensa", "mercado", "sociedade", "clientes")
lentes.py:1153           LENTES_COM_VEICULO_E_TIER = ("imprensa", "mercado")
lentes.py:697            if lente.codigo == "mercado": ... eventos_de_mercado(sessao, meses)
lentes.py:715            "Percepção do mercado financeiro"
consulta_profundidade.py:66   a consulta em profundidade existe só para Imprensa e Mercado
```

E, em `lentes.py:549`:

> *"`evento_mercado` continua no banco, intacta."*

Essa tabela alimentava um eventograma que foi removido. **O "episódio" da §4.4 é
muito próximo do que ela guarda.** Antes de escrever um motor de episódios novo,
é obrigatório olhar o que `evento_mercado` tem e por que o eventograma saiu —
pode ser a mesma coisa com outro nome, pode ser deliberadamente diferente, e as
duas respostas mudam o trabalho.

**Tradução do modelo da §5 para o que existe:**

| §5 sugere | já existe como | observação |
|---|---|---|
| `noticia(... pilar_n1, tema_n2, subtema_n3, impacto_score)` | `Mencao` + taxonomia | a tela **não recalcula** impacto, e nisso a especificação está certa (§4.3) |
| `veiculo(segmento='mercado')` | a lente `mercado` já filtra veículo | criar `segmento` seria uma segunda régua para a mesma coisa — **conferir** qual manda |
| `indice_reputacional(semana, lente, valor)` | índice por lente, hoje mensal | granularidade semanal é novidade, e está aceita (§1 acima) |
| `bond_quote(data, codigo, preco_pct_par, ...)` | **não existe** | é o que a planilha vai alimentar |

### 2.5 A taxonomia do mockup confere

Os seis pilares N1 que o mockup fixa — Crescimento e Solidez Financeira,
Eficiência Operacional e Qualidade, Governança, Responsabilidade Ambiental,
Responsabilidade Social, Prosperidade Compartilhada — **todos aparecem no
back**. Um risco a menos.

---

## 3. O que a base de exemplo ensina, e a especificação não previu

`base_cotacoes_exemplo.csv` tem 47 linhas de dado e 42 colunas. Ela é agora o
**contrato da planilha de importação**, então o que está nela é regra.

### 3.1 Ela é uma amostra de esquema, não um histórico

Datas presentes: **30/09, 09/10, 13/10 e 14/10 de 2026**. Para os três bonds da
Aegea há **três pontos cada** (30/09, 13/10, 14/10).

A §4.5 quer 6M desde 01/05/2026. Com a decisão 1, isso deixa de ser bloqueio —
mas define o tamanho do que precisa ser carregado antes de a tela ter gráfico.

As três datas não são acaso: são exatamente as que os **cartões** da §3.2 pedem
(último fechamento, pregão anterior, fechamento do mês anterior).

### 3.2 A procedência dos preços da Aegea é um print

| campo | valor |
|---|---|
| `fonte` | "Derivado da tela (exemplo)" / "Tela atual (print 15/10/2026)" |
| `metodo_coleta` | `Manual` |
| `observacao` | "Exemplo: preço derivado da **Var. Mês exibida**" |

O preço de 30/09 foi calculado de trás para frente a partir da variação mensal
exibida num print. **Os números da amostra não servem de verdade de teste** — só
de forma. Um critério de aceite que compare a tela contra esses valores estaria
comparando contra uma reconstrução.

### 3.3 `flag_qualidade` — a especificação não a menciona, e ela muda conta

Valores na amostra: `ok`, `repetido`, `pendente`.

A observação do `repetido` diz o que fazer:

> *"Preço, taxa e negócios idênticos ao dia anterior: valor repetido pela fonte,
> **fora do cálculo**."*

Seis papéis têm 14/10 marcado assim — RSAN26, RISP24, GSTS24, RSAN34, CYAR11 e
AEGPA8. Se o importador ou a tela ignorarem essa coluna, **um dia em que a fonte
repetiu vira um dia sem variação de verdade** — e pior, vira o "último
fechamento" do cartão.

`pendente` é o caso do PTAX: linha existe, valor não.

**Regra a implementar:** `repetido` e `pendente` não entram em série nem em
variação. Se entram em alguma lista, entram marcados.

### 3.4 `papel_monitoramento` — é aqui que mora o "não entra" da especificação

Valores: `Próprio`, `Par setorial`, `Referência`.

A §2 diz que não entram "debêntures das concessionárias, pares". Na prática isso
é um filtro nesta coluna, e a base **já traz os pares**: SABESP 2030, BRK
(BRKPA2, BRKPA4), Copasa (CSMGA7, CSMGA9), Orizon (ORMA16), Sabesp (SBSPD7,
SBSPI8, SBSPM8).

A tela de bonds mostra `classe = Bond` **e** `papel_monitoramento = Próprio` —
três papéis: AEGEA2029, AEGEA2031, AEGEA2036. O resto fica na base para as
outras abas do portal, e não deve ser descartado na importação.

### 3.5 Unidades diferentes na mesma tabela

| classe | onde está o preço | unidade |
|---|---|---|
| `Bond` | `preco` | % do valor de face |
| `Debênture` | `pu_par`, `vna`, `pu_ref` + `taxa_indic`/`compra`/`venda` | PU em R$, taxa em % |
| `Benchmark` | `valor` | `unidade_medida` diz (ex.: `R$/US$`) |

"Preço em % do par" (§4.1) só vale para `classe = Bond`. O importador precisa
saber disso, ou vai ler PU de debênture como se fosse percentual.

### 3.6 O mockup gera os preços

No `<script>`: `noise(i, s)` sobre `Math.sin(i*12.9898 + s*78.233)*43758.5453`,
e `interp(anch, amp, seed)` entre pontos âncora. As curvas do mockup são
**sintéticas**. Ele é referência de comportamento e de layout, nunca de número.

---

## 4. O que continua em aberto

Dos sete pontos da §9, sobram cinco — e acrescento dois que vieram da base.

| # | Pendência | Quem decide |
|---|---|---|
| 1 | Quais bonds estão em circulação e seus códigos | RI |
| 5 | Janela de 7 dias e corte de 0,8 pt do episódio | Peers + Market Intelligence |
| 6 | Lista final de veículos de mercado | Peers + Market Intelligence |
| 7 | Escala do eixo direito do índice (mockup usa 40 a 80) | Peers |
| — | Metodologia do índice **semanal** (janela, ponderação) | Peers + Market Intelligence |
| **A** | **`evento_mercado` serve de episódio, ou o episódio é coisa nova?** | time técnico, olhando a tabela |
| **B** | **`veiculo.segmento` ou a régua da lente `mercado`?** Duas não podem mandar. | time técnico |

A e B são as que travam código. As outras travam número, e dá para construir
com valor parametrizado enquanto não vêm.

---

## 5. Ordem de construção proposta

Em fatias que entregam algo utilizável, cada uma com revisão antes da próxima.
A ordem segue o que a base **de verdade** sustenta hoje, e não a ordem visual da
tela.

1. **Responder A e B** — leitura de `evento_mercado` e da régua de veículo de
   mercado. Sem código. É o que impede estrutura paralela.
2. **O importador da planilha de cotações** — contrato pelo CSV, com
   `flag_qualidade`, `papel_monitoramento` e unidade por classe. É o que faz
   existir histórico.
3. **Os cartões de cotação (§3.2, coluna direita)** — a única parte que a base
   de hoje já sustenta de ponta a ponta.
4. **A regra de episódios (§4.4)** como função pura em `dominio/`, com teste:
   janela de 7 dias, corte de 0,8 pt, mesmo N3 em dois episódios, ordenação e
   numeração.
5. **As duas listas de episódios (§3.3) e a tabela de notícias (§3.4)** — saem
   do que já está no banco.
6. **O gráfico (§3.2, coluna esquerda)** — por último, porque depende do item 2
   ter rodado com histórico de verdade.

O item 6 ser o último é de propósito: é o maior bloco da tela e o único que não
pode ser validado sem dado carregado.
