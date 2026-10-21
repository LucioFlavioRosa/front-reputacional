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
  /** A premissa do score, dita embaixo do título da Jornada da lente. */
  premissa?: string;
}

export const DESCRICAO_DAS_LENTES: Record<string, DescricaoDaLente> = {
  imprensa: {
    objetivo: 'Mostra como jornalistas e a mídia retratam a Aegea na imprensa.',
    fonteUtilizada: 'Clipei, ponderado pelo tier do veículo',
    proximasOndas:
      'Próximas ondas: somar as interações com essas instituições registradas no CRM dos Stakeholders.',
  },
  mercado: {
    objetivo: 'Mostra como investidores e agências de rating leem a companhia.',
    fonteUtilizada: 'Clipei, imprensa econômica de todos os tiers (proxy)',
    //: A REGRA DE VERDADE, conferida no back (21/10/2026): a fonte
    //: `clipei_investidores` recorta pela lista `imprensa_economica`, que é a
    //: subcategoria "Econômica e de negócios" da categoria Imprensa no Cadastro
    //: de Instituições. Sem filtro de tier nem de canal.
    premissa:
      'Premissa do score: matérias da Clipei de veículos classificados no Cadastro de Instituições como Imprensa › Econômica e de negócios, de todos os tiers e canais.',
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
    //: ERA O CRM ATÉ A `0107`/`0108`, e este texto ficou dizendo que ainda é.
    //: A lente trocou de fonte: deixou de ler o termômetro das interações e
    //: passou a recortar a imprensa pela lista de veículos, como o Mercado — o
    //: CRM foi aposentado por `ativo = false` e saiu do índice. A pessoa lia
    //: aqui que a fonte era o CRM e via matérias de jornal na Base de dados.
    objetivo: 'Mostra como a imprensa institucional retrata a Aegea.',
    fonteUtilizada: 'Clipei, imprensa institucional de todos os tiers',
    //: A REGRA DE VERDADE, conferida no back e no banco (21/10/2026): a fonte
    //: `clipei_institucional` ("Clipei · imprensa institucional") recorta pela
    //: lista `imprensa_institucional`, que é a subcategoria "Institucional" da
    //: categoria Imprensa no Cadastro de Instituições. Mesma mecânica do
    //: Mercado, e a `0107` tem um `do $$` que recusa a fonte se ela não
    //: espelhar a Clipei e não recortar por essa lista.
    premissa:
      'Premissa do score: matérias da Clipei de veículos classificados no Cadastro de Instituições como Imprensa › Institucional, de todos os tiers e canais.',
    proximasOndas:
      'Próximas ondas: somar as interações com essas instituições registradas no CRM dos Stakeholders.',
  },
};
