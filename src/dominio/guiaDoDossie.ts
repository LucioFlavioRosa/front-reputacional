/** O que cada gráfico do dossiê de uma lente está mostrando — para quem olha
 *  o "?" e tem dúvida sobre o que a tela quer dizer, e não sobre de onde o
 *  número veio (isso é o outro "?", `componentes/Procedencia.tsx`).
 *
 *  TEXTO ESTÁTICO DE PROPÓSITO, e não algo que o servidor manda: a pergunta
 *  aqui é "o que este tipo de gráfico significa", que não muda de mês para
 *  mês — diferente da ficha de procedência, que viaja com o dado porque a
 *  fonte pode mudar.
 *
 *  CADA FRASE FOI CONFERIDA CONTRA O CÓDIGO (repositorio_lentes.py,
 *  app/api/lentes.py) e `docs/handoff/SCORE.md` antes de entrar aqui — nada
 *  aqui é suposição sobre o que a tela "deveria" mostrar.
 */

/** Por código da lente — a seção 1 do dossiê (nota + manchete). */
export const GUIA_DO_DESTAQUE: Record<string, string> = {
  imprensa:
    'Nota de 0 a 100 com o saldo de sentimento das matérias de imprensa sobre a companhia — a voz de quem forma opinião. Quanto mais perto de 100, mais favorável o sentimento medido nas fontes desta lente.',
  mercado:
    'Nota de 0 a 100 com o saldo de sentimento das fontes desta lente — a cobertura de imprensa voltada a investidores e as ações das agências de rating.',
  sociedade:
    'Nota de 0 a 100 com o saldo de sentimento das conversas sobre a companhia nas redes sociais em aberto — não nos canais próprios da Aegea.',
  clientes:
    'Nota de 0 a 100 com o saldo de sentimento das mensagens recebidas nos canais próprios da Aegea (atendimento e redes oficiais).',
  institucional:
    'Nota de 0 a 100 com o saldo do termômetro das interações registradas com governo e entidades no CRM.',
};

/** Pelo título exato do bloco (`evolucao.titulo` ou `painel.titulo`) — os
 *  dois painéis e a evolução de cada lente. */
export const GUIA_DO_BLOCO: Record<string, string> = {
  'Evolução mensal':
    'Recorte com o volume de menções classificadas como positivo, neutro e negativo, mês a mês. Essa visão mostra como o sentimento medido nesta lente muda ao longo do tempo.',
  'Termômetro das agendas, mês a mês':
    'Recorte com os resultados das interações classificadas como positivo, neutro e negativo, mês a mês. Essa visão permite acompanhar como o termômetro das nossas interações evolui ao longo do tempo.',
  'Eventograma · mercado e rating':
    'Linha do tempo dos fatos de mercado e rating registrados mês a mês — não é uma contagem de menções, é a sequência de eventos e como cada um afeta a reputação: sustenta, pressiona ou é misto.',
  'Mensagens recebidas e respondidas':
    'Compara quantas mensagens de clientes chegaram e quantas foram respondidas, mês a mês. Essa visão mostra a capacidade de resposta da Aegea ao longo do tempo.',
  'Tier do veículo × sentimento':
    'Recorte com o sentimento das matérias do mês, agrupado pela relevância (tier) do veículo. Essa visão mostra se a cobertura mais influente está favorável ou desfavorável.',
  'Matriz de relacionamento com jornalistas':
    'Lista os jornalistas mais relevantes, com a prioridade de relacionamento calculada a partir de relevância, exposição e proximidade. Essa visão ajuda a decidir com quem a assessoria deve falar primeiro.',
  'Percepção do mercado financeiro':
    'Nota de 1 a 5 para os atributos avaliados no estudo de percepção mais recente do mercado financeiro. Essa visão mostra como investidores e analistas enxergam a companhia.',
  'Trajetória de rating':
    'Histórico das mudanças de rating de crédito feitas pelas agências, com a perspectiva de cada uma. Essa visão mostra a avaliação de crédito da Aegea ao longo do tempo.',
  'Sentimento por mês':
    'Recorte com o volume de mensagens de clientes classificadas como positivo, neutro e negativo, mês a mês. Essa visão mostra como está a satisfação dos clientes ao longo do tempo.',
  'Teor das mensagens':
    'Classifica as mensagens de clientes pelo motivo — reclamação, dúvida, elogio ou informação — mês a mês. Essa visão mostra o que os clientes mais procuram ao entrar em contato.',
  'Temas × termômetro':
    'Recorte com os resultados das interações classificadas como positivo, neutro e negativo, por tema. Essa visão nos permite enxergar como está o termômetro das nossas interações sobre cada tema.',
  'Temas × sentimento':
    'Recorte com o volume de menções classificadas como positivo, neutro e negativo, por tema debatido nas redes. Essa visão mostra qual tema concentra mais rejeição ou aprovação.',
  'Órgãos com mais interações':
    'Ranking dos órgãos e entidades com mais agendas registradas no período. Essa visão mostra com quem a Aegea mais interagiu.',
  'Concessionárias com maior repercussão':
    'Ranking das concessionárias/unidades com mais menções no período, somando positivas, neutras e negativas. Essa visão mostra onde a repercussão se concentra.',
  'Volume por tier':
    'Rosca com o volume de matérias do mês por tier do veículo (Tier 1, Tier 2, Tier 3). Ao lado, o Top 5 veículos com mais matérias no período. Essa visão mostra quem é a cobertura de imprensa do mês e em que faixa de relevância ela se concentra.',
  'Termômetro por veículos':
    'Para os veículos com mais matérias no mês, o saldo (positivas − negativas) ÷ total × 100, de −100 a 100 — mesmo cálculo do placar do termômetro por instituição do Painel. Essa visão mostra quais veículos estão favoráveis ou desfavoráveis à companhia, sem o peso de tier que a nota oficial usa.',
  'Drivers e riscos':
    'Ranking dos atributos reputacionais (qualidade do serviço, governança, solidez financeira...) classificados pela Clipei no mês, com o volume positivo, neutro e negativo de cada um. Essa visão mostra qual atributo está puxando a reputação para cima ou para baixo — não só o saldo final que a nota resume.',
  'Temas mais falados':
    'Ranking dos temas mais frequentes nas matérias do mês, no vocabulário da própria Clipei, com o volume positivo, neutro e negativo de cada um. Essa visão mostra sobre o que a imprensa mais falou e se o tom predominante foi favorável ou desfavorável.',
  'Últimas matérias':
    'As matérias mais recentes do mês, com veículo, data, classificação, tier, atributo e tema de cada uma. Essa visão é o drill-down até a linha: o detalhe concreto por trás dos números de cima.',
};
