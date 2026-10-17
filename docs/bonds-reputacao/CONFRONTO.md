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

**`evento_mercado` NÃO é o episódio da §4.4, e a primeira versão deste documento
dizia que era "muito próximo".** Era chute, e a revisão o derrubou. O que a
tabela é, pela `0049_lentes_v2.sql:60` e pelo cabeçalho de `tabelas_lentes.py`:

```sql
create table if not exists evento_mercado (
  tipo text check (tipo in ('resultado','rating','operacao','governanca','outro')),
  agencia text, nota_anterior text, nota_nova text, perspectiva text,
  texto text not null,
  efeito text check (efeito in ('sustenta','pressiona','misto')),
  exemplo boolean, criado_por uuid references usuario(id)
);
```

> *"O dossiê de cada lente tem duas metades. Uma é CALCULADA das menções que a
> ingestão já grava. A outra **não sai de planilha nenhuma**: `evento_mercado` —
> o que aconteceu: resultados, rating, operações."*

São conceitos opostos: `evento_mercado` é **fato editorial curado, digitado por
uma pessoa** (tem `criado_por`, tem `exemplo`); o episódio é **agregação
derivada** de `Mencao` por N3 numa janela de 7 dias, sem ninguém digitar nada.

O que sobra de verdadeiro, e vale: as duas respondem "o que aconteceu no
mercado", e `efeito` (`sustenta`/`pressiona`/`misto`) é o mesmo vocabulário do
sinal do episódio. Elas vão conviver na mesma tela e **não podem se
contradizer** — mas uma não implementa a outra.

**Tradução do modelo da §5 para o que existe:**

| §5 sugere | já existe como | observação |
|---|---|---|
| `noticia(... pilar_n1, tema_n2, subtema_n3, impacto_score)` | `Mencao` + taxonomia | a tela **não recalcula** impacto, e nisso a especificação está certa (§4.3) |
| `veiculo(segmento='mercado')` | **a pertinência à lente vem da FONTE**, não do veículo | ver §2.5 — `segmento` seria uma segunda régua, em outra granularidade |
| `indice_reputacional(semana, lente, valor)` | índice por lente, hoje mensal | granularidade semanal é novidade, e está aceita (§1 acima) |
| `bond_quote(data, codigo, preco_pct_par, ...)` | **não existe** | é o que a planilha vai alimentar |

### 2.5 A régua de "notícia de mercado" já existe, e é a FONTE

A §4.3 propõe `veiculo.segmento = 'mercado'` para habilitar a notícia na tela.
Não existe coluna de segmento em veículo — `segmento` no back é outra coisa
(`frente | clima | tema`, do painel de métricas, `consultas_metricas.py:223`).

A régua que existe é outra, e é mais simples:

```
base_das_lentes.py:136   condicoes = [ScoreFonte.lente_id == lente_id]
repositorio_lentes.py:86 def fontes_da_lente(sessao, lente_id) -> list[ScoreFonte]
```

**Uma menção é "de mercado" porque a FONTE pela qual ela foi importada está
ligada à lente `mercado`** — não por um atributo do veículo. Criar
`veiculo.segmento` seria a estrutura paralela que o Guilherme pediu para evitar,
e numa granularidade diferente da que o sistema usa.

Isso **não encerra** a questão, só a estreita. A lista da §4.3 — Valor
Econômico, Bloomberg Línea, Brazil Journal, InfoMoney, Exame, NeoFeed — é mais
estreita que "tudo o que entra pela lente mercado". A pergunta que sobra é se
essa lista é um **filtro adicional** sobre a lente (e aí é uma lista
configurável de nomes de veículo, sem coluna nova) ou se é a própria definição
da lente (e aí é conversa de cadastro de fonte, não de código novo).

### 2.6 A taxonomia do mockup confere

Os seis pilares N1 que o mockup fixa — Crescimento e Solidez Financeira,
Eficiência Operacional e Qualidade, Governança, Responsabilidade Ambiental,
Responsabilidade Social, Prosperidade Compartilhada — **todos aparecem no
back**. Um risco a menos.

---

## 3. O que a base de exemplo ensina, e a especificação não previu

Ela é agora o **contrato da planilha de importação**, então o que está nela é
regra — e o primeiro problema é o arquivo em si.

### 3.0 O arquivo entregue NÃO é um CSV válido

Achado da revisão, e é o mais sério deste documento. Medido com o leitor CSV da
biblioteca padrão do Python:

```
registros: 48
colunas na 1a linha: 1
colunas na 2a linha: 1
distintas contagens de coluna: [1]
```

**Um leitor CSV comum vê UMA coluna em todos os 48 registros.** Duas causas:

1. **Cada linha inteira está entre aspas.** O registro vira um campo único, e os
   42 campos ficam escondidos dentro dele como texto.
2. **Há vírgula sem escape dentro de `observacao`** — por exemplo *"Data de corte
   da tela não identificada, 14/10/2026 usada como exemplo."* — e, em seis
   linhas, aspas duplicadas (`""Preço, taxa e negócios…""`) que são escape de
   CSV *dentro* do campo já aspado.

A primeira versão deste documento afirmava "42 colunas". Eu havia medido
**tirando as aspas à mão** (`.Trim('"')`) antes de contar — ou seja, medi a
*intenção* do arquivo, não o arquivo. São 42 campos por registro **na intenção**;
como CSV entregue, é 1.

**Consequência para o trabalho:** o contrato da planilha tem de ser acertado
antes do importador, não durante. Enquanto o formato não for corrigido na
origem, qualquer parser nosso estaria adivinhando onde o campo começa — e
`observacao` com vírgula é exatamente o caso em que a adivinhação erra.

### 3.1 Ela é uma amostra de esquema, não um histórico

Datas presentes: **30/09, 09/10, 13/10 e 14/10 de 2026**. Para os três bonds da
Aegea há **três pontos cada** (30/09, 13/10, 14/10).

A §4.5 quer 6M desde 01/05/2026. Com a decisão 1, isso deixa de ser bloqueio —
mas define o tamanho do que precisa ser carregado antes de a tela ter gráfico.

As três datas não são acaso: são exatamente as que os **cartões** da §3.2 pedem
(último fechamento, pregão anterior, fechamento do mês anterior).

Mas isso vale para os **três cartões de bond**, não para os quatro. O quarto é o
índice de Mercado financeiro, e **a amostra não traz índice nenhum** — o único
`classe = Benchmark` é o `PTAX`, com `flag_qualidade = pendente` e sem valor.
Pendência C da §4.

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
| **A** | **O formato da planilha de cotações** — o arquivo entregue não é CSV válido (§3.0). Precisa de contrato acertado na origem. | Lúcio + quem gera a base |
| **B** | **A lista de veículos da §4.3 é filtro sobre a lente, ou é a definição dela?** (§2.5) | Peers + Market Intelligence |
| **C** | **De onde vem o índice de Mercado semanal.** A amostra não o tem — só `PTAX`, e `pendente`. Sem ele, o quarto cartão da §3.2 não tem fonte. | Peers + Market Intelligence |

**As duas que eu listava aqui antes saíram, porque a revisão as respondeu:**

- *"`evento_mercado` serve de episódio?"* — **não.** É fato editorial curado,
  digitado; o episódio é agregação derivada de `Mencao`. Ver §2.4.
- *"`veiculo.segmento` ou a régua da lente?"* — **a régua existe e é a FONTE**
  (`ScoreFonte.lente_id`). `segmento` seria paralelo. Ver §2.5. O que sobrou
  dessa pergunta está em B, mais estreito.

A trava código. B e C travam número, e dá para construir com valor
parametrizado e fixture enquanto não vêm.

---

## 5. Ordem de construção proposta

Em fatias que entregam algo utilizável, cada uma com revisão antes da próxima.
A ordem segue o que a base **de verdade** sustenta hoje, e não a ordem visual da
tela.

1. **Acertar o formato da planilha (A)** — sem código. O arquivo entregue não é
   CSV válido (§3.0), e um importador escrito contra ele estaria adivinhando
   onde o campo começa.
2. **O importador das cotações** — contrato pelo CSV corrigido, com
   `flag_qualidade` (`repetido` e `pendente` fora do cálculo),
   `papel_monitoramento` e unidade por classe. É o que faz existir histórico.
3. **A casca do portal `sintese`** — rota, permissão `acessa_sintese`, portão
   `mercado_lancado` e as quatro abas da §3.1, com três vazias. Vem cedo, e não
   no fim, porque é onde a tela mora: deixá-la para depois obriga a construir a
   aba solta e realojá-la. E é pequena.
4. **Os três cartões dos bonds (§3.2, coluna direita)** — a parte que a base
   sustenta de ponta a ponta. **O quarto cartão, do índice de Mercado, não
   entra aqui**: a amostra não traz índice semanal nenhum (pendência C).
5. **A regra de episódios (§4.4)** como função pura em `dominio/`, com teste:
   janela de 7 dias, corte de 0,8 pt, mesmo N3 em dois episódios, ordenação e
   numeração. **Não depende do histórico de preço** — roda sobre `Mencao`, que
   já está no banco, e se testa com fixture.
6. **As duas listas de episódios (§3.3) e a tabela de notícias (§3.4)**.
7. **O gráfico (§3.2, coluna esquerda)** — por último para a validação de ponta
   a ponta, porque a amostra tem três pontos por bond e não sustenta os seis
   meses. O componente em si pode ser construído antes, com dado de teste; o
   que fica para o fim é ligá-lo ao histórico.

**O que mudou nesta ordem depois da revisão:** a casca do portal subiu (era
implícita e tardia), o quarto cartão saiu do item dos cartões, e ficou explícito
que os episódios não esperam o preço — antes a ordem sugeria que esperavam.
