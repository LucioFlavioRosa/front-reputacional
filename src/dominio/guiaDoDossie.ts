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
  //: ERA O TERMÔMETRO DO CRM, e este balão ficou dizendo que ainda é. A lente
  //: trocou de fonte na `0107`/`0108` (hoje `0111`/`0112`): passou a recortar a
  //: imprensa pela lista de veículos, como o Mercado, e o CRM saiu do índice.
  //: TERCEIRA CÓPIA da mesma premissa velha a aparecer — as outras duas eram o
  //: cartão da lente e o cartão dos KPIs na Início. Esta só apareceu quando eu
  //: cacei a frase no BUNDLE SERVIDO depois de implantar as outras duas; a
  //: varredura que eu tinha feito no código não a tinha achado.
  institucional:
    'Nota de 0 a 100 com o saldo de sentimento das fontes desta lente — a cobertura dos veículos de imprensa classificados como institucionais.',
};

/** Pelo título exato do bloco (`evolucao.titulo` ou `painel.titulo`) — os
 *  dois painéis e a evolução de cada lente. */
export const GUIA_DO_BLOCO: Record<string, string> = {
  'Evolução mensal':
    'Recorte com o volume de menções classificadas como positivo, neutro e negativo, mês a mês. Essa visão mostra como o sentimento medido nesta lente muda ao longo do tempo.',
  //: Os três verbetes de agenda ficam. Os painéis que eles explicam só nascem
  //: da fonte interna, que hoje está fora dos KPIs, e voltam a ser alcançados
  //: quando a política do back voltar a admiti-la.
  'Termômetro das agendas, mês a mês':
    'Recorte com os resultados das interações classificadas como propositivo, neutro e reativo, mês a mês. Essa visão permite acompanhar como o termômetro das nossas interações evolui ao longo do tempo.',
  'Eventograma · mercado e rating':
    'Linha do tempo dos fatos de mercado e rating registrados mês a mês — não é uma contagem de menções, é a sequência de eventos e como cada um afeta a reputação: sustenta, pressiona ou é misto.',
  'Mensagens recebidas e respondidas':
    'Compara quantas mensagens de clientes chegaram e quantas foram respondidas, mês a mês. Essa visão mostra a capacidade de resposta da Aegea ao longo do tempo.',
  'Tier do veículo × sentimento':
    'Recorte com o sentimento das matérias do mês, agrupado pela relevância (tier) do veículo. Essa visão mostra se a cobertura mais influente está favorável ou desfavorável.',
  'Tier do veículo, top veículos e termômetro':
    'Três leituras da mesma cobertura, lado a lado, que se filtram entre si: o volume por relevância (tier) do veículo; os veículos que mais publicaram, com o sentimento de cada um; e o termômetro de cada veículo, o saldo (positivas − negativas) ÷ total × 100, de −100 a 100 — o mesmo cálculo do termômetro por instituição do Painel, sem o peso de tier que a nota oficial usa. Clicar num tier estreita as duas colunas de veículo; clicar num veículo estreita a de tier. A coluna do item escolhido continua inteira, para ser possível trocar de escolha sem desfazer o clique antes — e o resto do dossiê não se mexe.',
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
    'Recorte com os resultados das interações classificadas como propositivo, neutro e reativo, por tema. Essa visão nos permite enxergar como está o termômetro das nossas interações sobre cada tema.',
  'Temas × sentimento':
    'Recorte com o volume de menções classificadas como positivo, neutro e negativo, por tema debatido nas redes. Essa visão mostra qual tema concentra mais rejeição ou aprovação.',
  'Órgãos com mais interações':
    'Ranking dos órgãos e entidades com mais agendas registradas no período. Essa visão mostra com quem a Aegea mais interagiu.',
  'Concessionárias com maior repercussão':
    'Ranking das concessionárias/unidades com mais menções no período, somando positivas, neutras e negativas. Essa visão mostra onde a repercussão se concentra.',
  /* 'Volume por tier' e 'Termômetro por veículos' (com v minúsculo, os títulos
     que o SERVIDOR mandava) saíram em 23/10/2026 com os blocos que eles
     explicavam. Não confundir com 'Termômetro por Veículos', com V maiúsculo,
     que é a coluna do Explorador de veículos e tem a entrada dela mais abaixo:
     as duas chaves são parecidas e só uma existe na tela. */
  'Drivers e riscos':
    'Ranking dos atributos reputacionais (qualidade do serviço, governança, solidez financeira...) classificados pela Clipei no mês, com o volume positivo, neutro e negativo de cada um. Essa visão mostra qual atributo está puxando a reputação para cima ou para baixo — não só o saldo final que a nota resume.',
  'Temas mais falados':
    'Ranking dos temas mais frequentes nas matérias do mês, no vocabulário da própria Clipei, com o volume positivo, neutro e negativo de cada um. Essa visão mostra sobre o que a imprensa mais falou e se o tom predominante foi favorável ou desfavorável.',
  /* 'Últimas matérias' saiu em 23/10/2026 com o bloco que ela explicava. A
     lista continua viva no MODAL de aprofundamento, mas lá o título vem do
     servidor e o cabeçalho não tem "?" — `RecorteDaLente` desenha
     `itens_do_recorte` direto, sem consultar este guia. */
};
