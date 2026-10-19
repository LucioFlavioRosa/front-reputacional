# Especificação: aba Bonds e reputação (Inteligência de Mercado)

Projeto: Aegea × Peers, Foundation + MVP, Painel de Inteligência de Mercado (MVP3)
Versão: 1.0, 16/10/2026
Status: mockup validado por Guilherme Trevisan (Peers). Pendente validação com Aegea (Market Intelligence e RI)
Referência visual: `aegea_bonds_reputacao_mockup.html` (abrir no navegador, é interativo, dados fictícios)

---

## 1. Objetivo

Mostrar, numa única tela, como as cotações dos bonds da Aegea se movem e quais episódios de imprensa de mercado coincidem com esses movimentos. A pergunta que a tela responde é: "o que aconteceu no período e quanto isso pesou no score reputacional de Mercado?".

A leitura é de coincidência no tempo, não de causalidade. Atribuição estatística do efeito notícia sobre o preço é escopo da Onda 2 e não entra aqui.

## 2. Escopo desta entrega

**Entra**

- Gráfico de cotação diária dos bonds Aegea 2029, 2031 e 2036 (USD, % do valor de face)
- Índice reputacional de Mercado financeiro, cálculo semanal, no mesmo gráfico (eixo direito)
- Painel de cotações ao lado do gráfico, com variação no dia/semana e contra o fechamento do mês anterior
- Episódios por subtema (N3), marcados no gráfico como faixas transparentes com número no topo
- Duas listas de episódios: impactam positivamente e impactam negativamente
- Tabela de notícias de imprensa de mercado, filtrada pelo episódio selecionado

**Não entra**

- Outros ativos (debêntures das concessionárias, pares, CDS, Treasury)
- Redes sociais
- Correlação, regressão ou qualquer modelo estatístico de atribuição (Onda 2)
- Alertas automáticos por e-mail ou push

## 3. Estrutura da tela

Ordem vertical, largura máxima de 1440 px, fundo `#F4F6FC`.

### 3.1 Cabeçalho do módulo
Igual aos demais módulos do front reputacional: logo, nome do módulo "Inteligência de Mercado", abas (Indicadores por unidade, **Bonds e reputação**, Papers e cases, Busca por tema) e data de corte à direita.

### 3.2 Bloco principal: gráfico + cotações (um único card)

**Coluna esquerda (gráfico), cerca de 70% da largura**

- Título em azul: "Bonds da Aegea e índice reputacional de Mercado"
- Síntese em uma linha logo abaixo, gerada a partir dos dados. Exemplo: "Desde o fechamento de setembro, o 2031 caiu 1,4 ponto e o 2036 caiu 1,8. O índice de Mercado recuou 1 ponto."
- Seletor de período: 1M, 3M, 6M (padrão 6M)
- Legenda clicável: cada série liga e desliga (2029, 2031, 2036, Índice de Mercado)
- Gráfico de linhas:
  - Eixo esquerdo: preço dos bonds (% do par), escala automática com folga de 8%
  - Eixo direito: índice de Mercado, escala fixa (40 a 80 no mockup; faixa final a definir com a área, ver seção 9)
  - Índice desenhado em linha tracejada e em degraus (valor semanal)
  - Etiqueta com o último valor de cada série na borda direita, sem sobreposição
  - Hover: linha vertical, pontos nas séries e tooltip com data e valores do dia
- Episódios (ver regra na seção 4.4):
  - Cada episódio é uma faixa vertical transparente cobrindo o período (vermelho para negativo, verde-água para positivo)
  - Número do episódio num círculo acima do gráfico, ligado à faixa por linha pontilhada
  - Quando dois números ficariam próximos, o segundo sobe uma linha (empilhamento sem sobreposição)
  - Clique no número seleciona o episódio: a faixa ganha borda tracejada e opacidade maior, as demais ficam quase apagadas

**Coluna direita (cotações), cerca de 30% da largura**

Quatro cartões empilhados, distribuídos para ocupar a altura do gráfico:

| Cartão | Valor | Variação curta | Variação do mês |
|---|---|---|---|
| Aegea 2029 · USD | preço do último fechamento | no dia (vs. pregão anterior) | vs. último dia útil do mês anterior |
| Aegea 2031 · USD | idem | idem | idem |
| Aegea 2036 · USD | idem | idem | idem |
| Índice de Mercado financeiro | valor da última semana | na semana (vs. semana anterior) | vs. última semana fechada do mês anterior |

Cores das variações: verde `#0A6B60` quando melhora, vermelho `#B32328` quando piora, cinza `#44495C` quando zero após arredondamento. Para preço e índice, subir é melhora.

### 3.3 Listas de episódios (dois cards lado a lado)

- "Impactam positivamente": episódios com soma positiva, do maior para o menor
- "Impactam negativamente": episódios com soma negativa, do mais negativo para o menos negativo
- Título azul e síntese abaixo (exemplo: "7 subtemas somam −13,6 pt no score. Maior: Classificação de risco.")
- Cada linha mostra: número do episódio, nome do N3, linha secundária com N2, concessionária, período e quantidade de notícias, soma do impacto com barra proporcional e "2031 no período: ±x pts"
- Lista com rolagem interna (altura máxima de cerca de 380 px)
- Clique na linha seleciona o episódio (mesmo efeito do clique no número do gráfico). Novo clique na mesma linha limpa a seleção

### 3.4 Tabela de notícias de mercado

- Título azul: nome do N3 selecionado, ou "Notícias de mercado" sem seleção
- Síntese: "De 06/08 a 07/08, 2 notícias somaram −3,2 pt no score. O 2031 variou −3,2 pontos no mesmo intervalo."
- À direita: chip "N3: nome" com botão de limpar e link "Ver este subtema no período todo" (alterna entre só o episódio e todas as notícias daquele N3 no período)
- Colunas: Data, Veículo (nome e alcance), Matéria (selo de sentimento, selo de tier e manchete), Subtema N3 (com concessionária), Impacto, botão "Abrir matéria ↗" (link para a URL original)
- Ordenação por impacto absoluto, decrescente
- Cabeçalho fixo e rolagem interna (altura máxima de cerca de 440 px)

### 3.5 Rodapé
Fonte e data de corte, critério de veículos e regra de episódio, em texto pequeno.

## 4. Regras de negócio

### 4.1 Cotações
- Fonte: provedor de preço a definir (fonte 4 do Foundation, Mercado B3 / BI externo)
- Unidade: preço em % do valor de face, fechamento diário
- Dias sem pregão não aparecem no eixo
- Variação no dia: fechamento atual menos fechamento do pregão anterior, em pontos, uma casa decimal
- Fechamento do mês: último dia útil com cotação do mês anterior ao corte

### 4.2 Índice de Mercado financeiro
- É a lente "Mercado financeiro" do painel de KPIs Reputacionais, não o índice total
- Cálculo semanal, semana de segunda a sexta. O valor da semana é o calculado no fechamento de sexta (ou no último dia útil da semana)
- No gráfico, cada dia da semana mostra o valor da semana (linha em degraus)
- Variação na semana: semana atual menos semana anterior, em pontos inteiros
- Fechamento do mês: última semana inteira contida no mês anterior (premissa, ver seção 9)

### 4.3 Notícias elegíveis
- Apenas veículos de mercado financeiro e de capitais. Lista inicial: Valor Econômico, Bloomberg Línea, Brazil Journal, InfoMoney, Exame, NeoFeed. A lista deve ser configurável (tabela de veículos com flag `segmento = mercado`)
- Cada notícia já chega classificada pelo pipeline de clipping: pilar (N1), tema estratégico (N2), subtema (N3), concessionária, sentimento, tier e impacto no score (em pontos, com sinal)
- O impacto no score vem do painel de KPIs Reputacionais. Esta tela não recalcula impacto

### 4.4 Episódios
Um episódio é um conjunto de notícias do mesmo N3 próximas no tempo.

```
para cada N3:
  ordenar notícias por data
  abrir episódio com a primeira notícia
  para cada notícia seguinte:
    se data - data_fim_do_episodio_atual <= 7 dias corridos:
      adicionar ao episódio e atualizar data_fim
    senão:
      fechar episódio e abrir outro com esta notícia
para cada episódio:
  soma = soma do impacto das notícias
  manter apenas se |soma| >= 0,8 pt
numerar episódios em ordem cronológica de início (1, 2, 3...)
```

- O mesmo N3 pode gerar mais de um episódio e aparecer nas duas listas. Exemplo: "Divulgação de resultados" negativo em agosto (adiamento) e positivo em setembro (publicação). Somar o N3 no período inteiro esconderia os dois movimentos
- Sinal do episódio = sinal da soma
- Episódio entra no período selecionado (1M/3M/6M) se a data de fim estiver dentro do período
- Variação do bond no episódio: preço do 2031 no último pregão do episódio menos preço no pregão anterior ao início
- Seleção padrão ao abrir a tela: episódio de maior impacto negativo do período. Configurável

### 4.5 Períodos
- 1M = últimos 22 pregões, 3M = últimos 64 pregões, 6M = desde o início da série disponível (no mockup, 01/05/2026)

## 5. Modelo de dados sugerido (premissa, ajustar ao Foundation)

```
bond_quote          (data, codigo_bond, isin, moeda, preco_pct_par, fonte, carregado_em)
indice_reputacional (semana_inicio, semana_fim, lente, valor, versao_metodologia)
noticia             (id, publicada_em, veiculo_id, manchete, url, alcance, tier, concessionaria,
                     pilar_n1, tema_n2, subtema_n3, sentimento, impacto_score)
veiculo             (id, nome, segmento, tier)          -- segmento = 'mercado' habilita a notícia nesta tela
```

Endpoints sugeridos:

```
GET /api/bonds/cotacoes?bonds=AEGEA29,AEGEA31,AEGEA36&de=AAAA-MM-DD&ate=AAAA-MM-DD
GET /api/reputacao/indice?lente=mercado_financeiro&granularidade=semanal&de=...&ate=...
GET /api/noticias?segmento=mercado&de=...&ate=...
GET /api/bonds/episodios?de=...&ate=...         -- recomendado calcular no back para manter a regra única
```

## 6. Interações e estados

| Ação | Resultado |
|---|---|
| Trocar período | Recalcula eixo, síntese, episódios, listas e tabela |
| Clicar na legenda | Liga/desliga a série. Eixo esquerdo reescala com os bonds visíveis |
| Hover no gráfico | Tooltip com data e valores. Some ao sair do gráfico |
| Clicar no número ou na linha de episódio | Seleciona; faixa destacada; tabela filtra por N3 e período do episódio |
| Clicar de novo no mesmo episódio | Limpa a seleção |
| "Ver este subtema no período todo" | Tabela mostra todas as notícias do N3 no período; o texto do link vira "Ver só o episódio" |
| Botão limpar do chip | Remove filtro; tabela mostra todas as notícias de mercado do período |
| Lista ou tabela vazia | Mensagem curta ("Nenhum episódio no período.", "Nenhum item para o filtro atual.") |
| Carregando / erro | Seguir os componentes `Carregando` e `FaixaDeErro` do front reputacional |

## 7. Layout e identidade

Seguir o design system "Aegea — CRM dos Stakeholders" (tokens extraídos do repositório front-reputacional) e reaproveitar os componentes existentes (`Cartao`, `Secao`, `Selo`, `Chip`, `Kpi`).

- Fonte: DM Sans (corpo), números com `font-variant-numeric: tabular-nums`
- Títulos de seção em azul-mar `#0027BD`, 20 px, peso 700. Síntese em `#191B23`, 15 px
- Cartões: fundo branco, borda `#E2E5F0`, raio 4 px
- Cores das séries: 2029 `#FE952B`, 2031 `#0027BD`, 2036 `#A11FFF`, Índice de Mercado `#0A6B60` tracejado
- Faixas de episódio: negativo `rgba(255,92,96,.12)`, positivo `rgba(23,227,203,.16)`. Selecionado: opacidade maior e borda tracejada. Não selecionados com seleção ativa: opacidade .05
- Número do episódio: círculo de 24 px, vermelho `#B32328` ou verde `#0A6B60`, texto branco
- Selos de sentimento: positivo `#DFFAF6`/`#0A6B60`, negativo `#FFE7E8`/`#B32328`, neutro `#EEF1F8`/`#44495C`
- Números em formato pt-BR (vírgula decimal, sinal de menos "−")
- Responsivo: abaixo de cerca de 1100 px a coluna de cotações desce para baixo do gráfico; as duas listas empilham; a tabela rola na horizontal

## 8. Acessibilidade

- Contraste mínimo 4,5:1 em texto
- Números de episódio, linhas das listas, legenda e botões são `<button>` com `aria-pressed` quando alternam estado
- Cada número de episódio tem `aria-label` com N3 e impacto
- Foco visível com anel de 2 px em `#0027BD`

## 9. Pontos em aberto (validar antes de fechar o build)

1. Quais bonds estão em circulação e seus códigos (2029, 2031, 2036 são premissa do mockup). Responsável: RI
2. Fonte e licença do preço dos bonds. Feeds tipo Bloomberg costumam restringir exibição em outro sistema. Responsável: Aegea (fonte 4)
3. Metodologia do índice de Mercado semanal (janela, ponderação). Responsável: Peers + Market Intelligence
4. Definição de "fechamento do mês" do índice semanal (última semana inteira do mês, premissa atual)
5. Janela de 7 dias e corte de 0,8 pt da regra de episódio
6. Lista final de veículos de mercado financeiro e de capitais
7. Escala do eixo direito do índice (mockup usa 40 a 80)

Registrar cada decisão no log de decisões do projeto.

## 10. Critérios de aceite

- [ ] Gráfico mostra as três séries de bonds e o índice semanal com eixos e etiquetas corretos para 1M, 3M e 6M
- [ ] Cartões de cotação batem com a base: último fechamento, variação no dia e contra o fechamento do mês anterior
- [ ] Episódios gerados exatamente pela regra 4.4, numerados em ordem cronológica e sem sobreposição visual dos números
- [ ] Listas ordenadas corretamente e somas iguais à soma do impacto das notícias do episódio
- [ ] Clique em episódio filtra a tabela por N3 e período; limpar volta ao estado completo
- [ ] Apenas veículos com `segmento = mercado` aparecem
- [ ] Links "Abrir matéria" abrem a URL original em nova aba
- [ ] Textos de síntese gerados a partir dos dados, sem frase fixa
- [ ] Tela legível em 1280 px e 1440 px e utilizável em tablet

## 11. Prompt sugerido para o Claude Code

```
Contexto: repositório do front reputacional da Aegea. Leia ESPEC_Bonds_e_Reputacao.md
e abra aegea_bonds_reputacao_mockup.html como referência visual e de comportamento
(dados fictícios, a lógica de cálculo está no <script> do mockup).

Tarefa: implementar a aba "Bonds e reputação" do módulo Inteligência de Mercado
seguindo a especificação, reaproveitando os componentes e tokens existentes do repositório.

Passos:
1. Mapear os componentes existentes (Cartao, Secao, Selo, Chip, Kpi) e o padrão de gráficos já usado.
2. Criar tipos e um serviço de dados com os endpoints da seção 5, com mock local enquanto a API não existe.
3. Implementar a regra de episódios (4.4) como função pura, com testes unitários cobrindo:
   janela de 7 dias, corte de 0,8 pt, mesmo N3 em dois episódios, ordenação e numeração.
4. Implementar a tela por blocos (3.2, 3.3, 3.4) e as interações da seção 6.
5. Validar contra os critérios de aceite da seção 10 e listar o que ficou pendente da seção 9.

Não incluir redes sociais, outros ativos nem cálculo de correlação.
```
