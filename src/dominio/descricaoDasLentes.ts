/** O que cada lente quer dizer, para quem lê o Radar sem conhecer o modelo.
 *
 *  O TEXTO VEM DO MATERIAL DO MODELO (a lâmina "O ISR combina cinco lentes,
 *  cada uma com público, fonte e peso"), e não do banco: é a explicação do
 *  desenho, que muda quando o modelo muda — e o modelo é fechado por desenho
 *  (`LENTES_NO_MODELO`). O PESO NÃO MORA AQUI: ele é da calibração, que pode
 *  ser ajustada, e vem do servidor em cada cálculo.
 *
 *  `proximasOndas` é o que a lente ganha nas próximas ondas do projeto. NÃO
 *  APARECE NA TELA hoje — o "?" que o mostrava saiu do cartão, por pedido —,
 *  e fica aqui registrado, junto do resto da lâmina, para quando voltar.
 */

export interface DescricaoDaLente {
  /** Uma frase: o que esta lente responde. */
  objetivo: string;
  /** A fonte em uso hoje ("Utilizada:" da lâmina). */
  fonteUtilizada: string;
  proximasOndas: string;
}

export const DESCRICAO_DAS_LENTES: Record<string, DescricaoDaLente> = {
  imprensa: {
    objetivo: 'Mostra como os formadores de opinião retratam a Aegea na imprensa.',
    fonteUtilizada: 'Clipei, ponderado pelo tier do veículo',
    proximasOndas:
      'Próximas ondas: somar as interações com essas instituições registradas no CRM dos Stakeholders.',
  },
  mercado: {
    objetivo: 'Mostra como investidores e agências de rating leem a companhia.',
    fonteUtilizada: 'Clipei Tier 1 econômico (proxy) + SOV',
    proximasOndas:
      'Próximas ondas: somar as interações com essas instituições registradas no CRM dos Stakeholders.',
  },
  sociedade: {
    objetivo: 'Mostra o que se fala da Aegea nas redes, em mar aberto.',
    fonteUtilizada: 'Approach SL + Bites',
    proximasOndas:
      'Próximas ondas: nenhuma fonte nova prevista até aqui — a lente segue com a escuta das redes.',
  },
  clientes: {
    objetivo: 'Mostra a experiência de quem usa os serviços, pelos canais próprios.',
    fonteUtilizada: 'CM (canais próprios)',
    proximasOndas: 'Próximas ondas: SAC, Reclame Aqui e pesquisas com clientes.',
  },
  institucional: {
    objetivo: 'Mostra o clima da relação com governo, eventos e entidades.',
    fonteUtilizada: 'CRM — clima das interações com governo e entidades',
    proximasOndas:
      'Próximas ondas: nenhuma fonte nova prevista até aqui — a lente segue lendo o CRM dos Stakeholders.',
  },
};
