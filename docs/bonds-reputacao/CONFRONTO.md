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
| 2 | Fonte do preço dos bonds | **Planilha importada**, não feed de provedor. | Lúcio, 16/10/2026 |
| 2b | Qual planilha | **`BASE DE DADOS_HISTORICO BONDS_Yieldv1.xlsx`** — ver §3. Substitui o `base_cotacoes_exemplo.csv` como contrato. | Lúcio, 16/10/2026 |
| 3 / 4 | Índice de Mercado semanal × painel mensal | **A diferença de granularidade está aceita.** O índice da tela é semanal; o painel segue mensal. | Lúcio, 16/10/2026 |

A decisão 2 muda a natureza do trabalho: o que parecia integração com provedor
de preço é **mais um importador de planilha**, da mesma família do que o Score já
tem.

A 2b é a que destrava o bloco 3.2 de verdade — a base definitiva tem **cinco
anos** de série diária, e 184 pontos por papel na janela de seis meses que a tela
usa. O que a decisão 2 **não** resolve é a licença: a base é export do Bloomberg.
Ver a pendência A da §5.

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

## 3. A base definitiva: `BASE DE DADOS_HISTORICO BONDS_Yieldv1.xlsx`

**Esta é a base que vamos usar** (decisão de 16/10/2026), e ela **substitui o
`base_cotacoes_exemplo.csv` como contrato.** O CSV fica no repositório como
registro do que se sabia antes; a §4 adiante é a leitura dele, e vale só como
história.

Isso resolve de graça a pendência mais séria da versão anterior deste documento:
sendo `.xlsx`, **o problema de CSV inválido desaparece**.

Tudo abaixo foi medido no arquivo, não inferido.

> **O ARQUIVO NÃO ESTÁ NESTE REPOSITÓRIO, de propósito.** Ele vive em
> `OneDrive - Peers Consulting/aegea/painel reputacional/`. Commitá-lo seria
> redistribuir dado de terminal Bloomberg — exatamente a pendência A — e o
> repositório não é o lugar para resolver isso. O que entra aqui é a **medição**
> dele, que é o que a decisão precisa.
>
> O importador não vai precisar do arquivo para ser testado: os dois laços da
> §3.2 se reproduzem numa planilha sintética de poucas linhas (uma coluna com
> `number_format='mm-dd-yy'`, uma célula com o texto `'0'`), que é o que deve
> entrar como fixture.

### 3.1 O histórico existe, e é bem maior do que a tela pede

| | |
|---|---|
| aba | `Planilha2 (2)`, única |
| linhas declaradas | 54.254 — mas só **1.755 têm valor** (o resto é linha formatada e vazia) |
| coluna de data | **col 6**, 1.750 datas, de **2022-01-01 a 2026-10-16** |
| papéis | **31**, em pares `(Preço, Yield)` nas colunas 7 a 68 |
| série começa | linha 6 do arquivo |

Os três da Aegea, medidos:

| papel | pontos | período | preço min/max |
|---|---|---|---|
| AEGEBZ29 | 1.632 | 2022-04-29 → 2026-10-16 | 83,87 / 102,11 |
| AEGEBZ31 | 1.115 | 2023-09-28 → 2026-10-16 | 84,06 / 108,60 |
| AEGEBZ36 | **387** | **2025-09-25** → 2026-10-16 | 72,81 / 100,08 |

**Na janela de 6 meses que a tela usa (16/04 → 16/10/2026): 184 pontos para cada
um dos três, maior vão de 1 dia, zero vãos acima de 4 dias.** O gráfico da §3.2
tem dado para ser construído e validado de verdade.

O 2036 só existe desde 25/09/2025 porque é papel novo. 6M funciona; uma janela de
três anos mostraria a série dele começando no meio, e isso é do dado, não defeito.

### 3.2 Dois laços de importador, os dois medidos

**O primeiro: as colunas do 2029 estão formatadas como DATA.**

```
col  7 AEGEBZ29 Preço: number_format='mm-dd-yy'  -> openpyxl devolve datetime
col  8 AEGEBZ29 Yield: number_format='mm-dd-yy'  -> openpyxl devolve datetime
col  9 AEGEBZ31 Preço: number_format='General'   -> devolve float
col 11 AEGEBZ36 Preço: number_format='General'   -> devolve float
```

Contagem de tipos nas 1.750 linhas de série: col 7 devolve `datetime` em 1.111
células; col 9 devolve `float` em 1.110.

O back já lê planilha com openpyxl, então **o importador vai receber o preço do
Aegea 2029 como data**: 89,01 chega como `1900-03-29` (serial 89). Só nesse
papel, só nessas duas colunas. Recupera-se pelo serial
(`(valor − 1899-12-30).days`), mas **tem de ser feito de propósito** — e um
importador que confie no tipo da célula vai gravar data em coluna de preço ou
estourar.

**O segundo: ausência é o TEXTO `'0'`, não célula vazia.**

| coluna | células com texto | com número |
|---|---|---|
| AEGEBZ29 Preço | 639 | 1.111 |
| AEGEBZ31 Preço | 639 | 1.111 |
| AEGEBZ36 Preço | **1.363** | 387 |

As primeiras linhas de toda coluna trazem `'0'` como **string**. É o período em
que o papel ainda não existia. Convertido ingenuamente para número, vira **preço
zero** — e um zero no meio de uma série de 80 a 100 destrói qualquer escala.

Isso casa com uma decisão que o repositório já tomou, e é bom sinal. Do
`GraficoDeLinha.tsx`:

> *"`valor: null` ABRE UM VÃO na linha, não desenha um ponto em zero — a
> diferença entre 'não houve dado nesse período' e 'o placar empatou' importa
> demais para as duas caírem no mesmo desenho."*

O importador deve traduzir `'0'` para **ausência**, nunca para zero.

### 3.3 Tem `Yield`, e a especificação não usa

Cada papel tem duas colunas: `Preço` e `Yield`. O nome do arquivo diz
"Yieldv1". A especificação e o mockup usam **só preço** — o eixo esquerdo é
"% do par" (§4.1), e os cartões mostram preço.

**Decisão pendente:** o yield entra na tela? Ele é o que o mercado de fato olha
num papel de crédito, e está pronto na base. Não inventar: ou entra por pedido,
ou fica guardado para outra aba.

### 3.4 A base é de comparação setorial, e a tela não é

São **31 papéis**, dos quais 3 da Aegea. Os outros 28:

- **saneamento:** SBSPAB31, SBSPAB36, SABESP30
- **fora do setor:** Eletrobras (2), Light, Simpar, Movida (3), Vamos, Rumo (2),
  Hidrovias, Ultrapar, Açu Petróleo, Braskem (4), Rede D'Or (3), Minerva (3),
  Petrobras (2)

A §2 da especificação diz que pares **não entram** nesta aba. Mas eles estão aqui
de propósito — uma base com Braskem e Petrobras foi montada para comparar. O
importador deve **gravar os 31**, e a tela de bonds filtrar os três. Descartar na
importação jogaria fora o que as outras abas do portal vão querer.

### 3.5 É export do Bloomberg, e isso é o risco que sobrou

Os identificadores são tickers do Bloomberg: `BW191153 Corp` (2029),
`ZH164262 Corp` (2031), `YK449959 Corp` (2036).

O ponto em aberto nº 2 da especificação era "fonte e licença do preço", com a
observação de que *"feeds tipo Bloomberg costumam restringir exibição em outro
sistema"*. A decisão de trazer por planilha resolve o **como**; não resolve o
**pode**. Exibir preço de terminal Bloomberg num painel próprio é, tipicamente,
o uso que o contrato de terminal proíbe.

**Isto não é questão técnica e não se resolve no código.** É a única coisa
levantada aqui que pode inviabilizar o bloco 3.2 depois de pronto, e por isso
está na §5 como pendência.

### 3.6 Uma divergência com o CSV, a conferir

| papel | descrição Bloomberg | `taxa_emissao` no CSV |
|---|---|---|
| AEGEBZ29 | `AEGEBZ 6 ¾ 05/20/29` → 6,75 | 6,75 ✓ |
| AEGEBZ31 | `AEGEBZ 9 01/20/31` → 9,00 | 9,0 ✓ |
| AEGEBZ36 | `AEGEBZ 7 ⅝ 01/20/36` → **7,625** | **7,27** ✗ |

Duas de três batem. A do 2036 não. Como o cupom não entra em nenhuma conta desta
tela, não bloqueia — mas é sinal de que uma das duas planilhas foi digitada, e
vale saber qual antes de usar `taxa_emissao` para qualquer coisa.

---

## 4. O que o CSV de exemplo ensinou (registro histórico)

> A partir de 16/10/2026 o contrato é o `.xlsx` da §3. Esta seção fica porque
> três das regras que ela levantou — `flag_qualidade`, `papel_monitoramento` e
> unidade por classe — **não existem no `.xlsx`**, e alguém vai ter de decidir se
> elas se perderam ou se precisam voltar.

Ela é agora o **contrato da planilha de importação**, então o que está nela é
regra — e o primeiro problema é o arquivo em si.

### 4.1 O arquivo entregue NÃO é um CSV válido

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

### 4.2 Ela é uma amostra de esquema, não um histórico

Datas presentes: **30/09, 09/10, 13/10 e 14/10 de 2026**. Para os três bonds da
Aegea há **três pontos cada** (30/09, 13/10, 14/10).

A §4.5 quer 6M desde 01/05/2026. Com a decisão 1, isso deixa de ser bloqueio —
mas define o tamanho do que precisa ser carregado antes de a tela ter gráfico.

As três datas não são acaso: são exatamente as que os **cartões** da §3.2 pedem
(último fechamento, pregão anterior, fechamento do mês anterior).

Mas isso vale para os **três cartões de bond**, não para os quatro. O quarto é o
índice de Mercado financeiro, e **a amostra não traz índice nenhum** — o único
`classe = Benchmark` é o `PTAX`, com `flag_qualidade = pendente` e sem valor.
Pendência B da §5.

### 4.3 A procedência dos preços da Aegea é um print

| campo | valor |
|---|---|
| `fonte` | "Derivado da tela (exemplo)" / "Tela atual (print 15/10/2026)" |
| `metodo_coleta` | `Manual` |
| `observacao` | "Exemplo: preço derivado da **Var. Mês exibida**" |

O preço de 30/09 foi calculado de trás para frente a partir da variação mensal
exibida num print. **Os números da amostra não servem de verdade de teste** — só
de forma. Um critério de aceite que compare a tela contra esses valores estaria
comparando contra uma reconstrução.

### 4.4 `flag_qualidade` — a especificação não a menciona, e ela muda conta

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

### 4.5 `papel_monitoramento` — é aqui que mora o "não entra" da especificação

Valores: `Próprio`, `Par setorial`, `Referência`.

A §2 diz que não entram "debêntures das concessionárias, pares". Na prática isso
é um filtro nesta coluna, e a base **já traz os pares**: SABESP 2030, BRK
(BRKPA2, BRKPA4), Copasa (CSMGA7, CSMGA9), Orizon (ORMA16), Sabesp (SBSPD7,
SBSPI8, SBSPM8).

A tela de bonds mostra `classe = Bond` **e** `papel_monitoramento = Próprio` —
três papéis: AEGEA2029, AEGEA2031, AEGEA2036. O resto fica na base para as
outras abas do portal, e não deve ser descartado na importação.

### 4.6 Unidades diferentes na mesma tabela

| classe | onde está o preço | unidade |
|---|---|---|
| `Bond` | `preco` | % do valor de face |
| `Debênture` | `pu_par`, `vna`, `pu_ref` + `taxa_indic`/`compra`/`venda` | PU em R$, taxa em % |
| `Benchmark` | `valor` | `unidade_medida` diz (ex.: `R$/US$`) |

"Preço em % do par" (§4.1) só vale para `classe = Bond`. O importador precisa
saber disso, ou vai ler PU de debênture como se fosse percentual.

### 4.7 O mockup gera os preços

No `<script>`: `noise(i, s)` sobre `Math.sin(i*12.9898 + s*78.233)*43758.5453`,
e `interp(anch, amp, seed)` entre pontos âncora. As curvas do mockup são
**sintéticas**. Ele é referência de comportamento e de layout, nunca de número.

---

## 5. O que continua em aberto

| # | Pendência | Quem decide | Trava |
|---|---|---|---|
| **A** | **A licença do preço.** A base é export do Bloomberg (§3.5). Exibir preço de terminal em painel próprio é tipicamente o que o contrato proíbe. | Aegea (RI / jurídico) | o bloco 3.2 inteiro, **depois de pronto** |
| **B** | **De onde vem o índice de Mercado semanal.** A base de cotações não o traz, e o painel de hoje é mensal. Sem ele, o quarto cartão e o eixo direito não têm fonte. | Peers + Market Intelligence | o 4º cartão e a 2ª série do gráfico |
| **C** | **O `Yield` entra na tela?** Está pronto na base e a especificação não o usa (§3.3). | produto (Bia / Guilherme) | nada; é escopo a mais |
| **D** | A lista de seis veículos da §4.3 **da especificação** é filtro sobre a lente, ou é a definição dela? (ver §2.5 aqui) | Peers + Market Intelligence | a tabela de notícias |
| **E** | `flag_qualidade`, `papel_monitoramento` e unidade por classe **existiam no CSV e não existem no `.xlsx`** (§4). Perderam-se ou precisam voltar? | Lúcio + quem gera a base | o importador |
| 1 | Quais bonds estão em circulação e seus códigos | RI | — (a base já traz 31, e os 3 da Aegea batem) |
| 5 | Janela de 7 dias e corte de 0,8 pt do episódio | Peers + Market Intelligence | nada; parametrizável |
| 7 | Escala do eixo direito do índice (mockup usa 40 a 80) | Peers | nada |

**Três pendências anteriores saíram, e vale dizer por quê:**

- *"O formato da planilha"* — **resolvida pela base nova.** Sendo `.xlsx`, o
  problema de CSV inválido deixou de existir. Ver §3 e §4.1.
- *"`evento_mercado` serve de episódio?"* — **não.** É fato editorial curado,
  digitado; o episódio é agregação derivada de `Mencao`. Ver §2.4.
- *"`veiculo.segmento` ou a régua da lente?"* — **a régua existe e é a FONTE**
  (`ScoreFonte.lente_id`). Ver §2.5. O que sobrou dela está em D.

**Nenhuma delas trava o começo.** A única que pode custar caro é a **A**, e
custa justamente porque não aparece em teste nenhum: o gráfico vai funcionar, e
o problema é contratual. Vale perguntar **antes** de construir o bloco 3.2, não
depois.

---

## 6. Ordem de construção proposta

Em fatias que entregam algo utilizável, cada uma com revisão antes da próxima.
A ordem segue o que a base **de verdade** sustenta hoje, e não a ordem visual da
tela.

1. **Perguntar a licença (pendência A)** — uma pergunta, nenhum código. A base é
   export do Bloomberg, e essa é a única coisa levantada aqui que inviabiliza o
   gráfico **depois** de ele estar pronto. Não impede começar pelos itens 2 e 3.
2. **O importador das cotações** — contrato pelo `.xlsx` da §3, e os dois laços
   medidos são requisito, não detalhe: desfazer o serial das colunas do 2029
   (`number_format='mm-dd-yy'`) e traduzir o texto `'0'` para **ausência**, nunca
   para zero. Grava os **31** papéis; a tela filtra os três.
3. **A casca do portal `sintese`** — rota, permissão `acessa_sintese`, portão
   `mercado_lancado` e as quatro abas da §3.1, com três vazias. Vem cedo, e não
   no fim, porque é onde a tela mora: deixá-la para depois obriga a construir a
   aba solta e realojá-la. E é pequena.
4. **Os três cartões dos bonds (§3.2, coluna direita)** — último fechamento,
   variação no dia e contra o fechamento do mês anterior. **O quarto cartão, do
   índice de Mercado, não entra aqui**: a base de cotações não traz índice
   nenhum (pendência B).
5. **A regra de episódios (§4.4)** como função pura em `dominio/`, com teste:
   janela de 7 dias, corte de 0,8 pt, mesmo N3 em dois episódios, ordenação e
   numeração. **Não depende do histórico de preço** — roda sobre `Mencao`, que
   já está no banco, e se testa com fixture.
6. **As duas listas de episódios (§3.3) e a tabela de notícias (§3.4)**.
7. **O gráfico (§3.2, coluna esquerda)** — a série dos bonds, com as faixas de
   episódio. Fica para depois do item 2 porque é dele que vem o dado, e é o
   maior bloco da tela; não porque falte histórico. **Com a base nova ele pode
   ser validado com dado de verdade**: 184 pontos por papel na janela de 6
   meses, maior vão de 1 dia. A segunda série, do índice, depende da
   pendência B.

**O que mudou nesta ordem, e por quê:**

- **a casca do portal subiu para o item 3** — era implícita e tardia, e deixá-la
  para o fim obrigaria a construir a aba solta e realojá-la (achado da revisão);
- **o quarto cartão saiu** do item dos cartões — não tem fonte;
- **ficou explícito que os episódios não esperam o preço** — a ordem anterior
  sugeria que esperavam (achado da revisão);
- **a justificativa do item 7 mudou.** A versão anterior dizia que o gráfico
  vinha por último "porque a amostra tem três pontos por bond e não sustenta os
  seis meses". Com a base definitiva **isso é falso**: sustenta. O gráfico segue
  por último por dependência e por tamanho, não por falta de dado.
