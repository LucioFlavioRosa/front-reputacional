/** Os filtros de cada lente: quais são rápidos, quais vão para o avançado, e
 *  como cada dimensão se chama naquela lente.
 *
 *  UMA TABELA SÓ, LIDA POR DOIS LUGARES: a barra de filtros da aba Lentes e as
 *  sugestões da busca inteligente. Se a busca oferecesse "Veículo" e a barra
 *  chamasse a mesma coisa de "Rede", a pessoa acharia que são filtros
 *  diferentes.
 *
 *  O NOME MUDA DE LENTE PARA LENTE porque o dado muda: em Sociedade digital o
 *  "veículo" é a rede social, e o "autor" da Imprensa é o jornalista. O campo
 *  do servidor é o mesmo (`FiltroDaLente`); só o rótulo é da lente.
 *
 *  MERCADO E INSTITUCIONAL NÃO TÊM FILTROS AQUI: Mercado vem de estudos, e não
 *  de menções; Institucional lê o CRM, que tem os filtros dele. O servidor não
 *  aceita recorte para nenhum dos dois.
 */

import type { FiltroDaLente, OpcoesDeFiltroDaLente } from '@/api/cliente';

export interface DimensaoDaLente {
  chave: keyof FiltroDaLente;
  rotulo: string;
  /** De qual lista de `opcoes-de-filtro` saem os valores. */
  de: keyof OpcoesDeFiltroDaLente;
  rotulos?: Record<string, string>;
}

export const ROTULO_DO_TIER: Record<string, string> = {
  muito_relevante: 'Tier 1',
  relevante: 'Tier 2',
  menos_relevante: 'Tier 3',
};

const tier: DimensaoDaLente = { chave: 'tier', rotulo: 'Tier do veículo', de: 'tiers', rotulos: ROTULO_DO_TIER };
//: "TEMA" SEMPRE DIZ QUAL É, por pedido: Pilar (N1) e Tema estratégico (N2) são
//: a taxonomia do CRM; o que o fornecedor escreve leva "(fornecedor)" no nome.
const pilar: DimensaoDaLente = { chave: 'tema_n1', rotulo: 'Pilar (N1)', de: 'temas_n1' };
const temaEstrategico: DimensaoDaLente = { chave: 'tema_n2', rotulo: 'Tema estratégico (N2)', de: 'temas_n2' };
const subtemaN3: DimensaoDaLente = { chave: 'tema_n3', rotulo: 'Subtema (N3)', de: 'temas_n3' };
const temaDoFornecedor: DimensaoDaLente = { chave: 'tema', rotulo: 'Tema (fornecedor)', de: 'temas' };
const subtemaDoFornecedor: DimensaoDaLente = { chave: 'subtema', rotulo: 'Subtema (fornecedor)', de: 'subtemas' };
const uf: DimensaoDaLente = { chave: 'uf', rotulo: 'UF', de: 'ufs' };
const concessionaria: DimensaoDaLente = { chave: 'empresa', rotulo: 'Concessionária', de: 'empresas' };

//: PILAR (N1) E TEMA ESTRATÉGICO (N2) NOS RÁPIDOS DE TODA LENTE, por pedido —
//: logo depois da dimensão própria da lente. O servidor oferece a taxonomia
//: inteira dos dois, então eles aparecem mesmo antes de haver menção ligada.
//:
//: OS "AVANÇADOS" NÃO TÊM MAIS BARRA (saíram, por pedido): continuam aqui porque
//: a busca inteligente sugere os valores deles.
export const FILTROS_DAS_LENTES: Record<
  string,
  { rapidos: DimensaoDaLente[]; avancados: DimensaoDaLente[] }
> = {
  imprensa: {
    rapidos: [
      tier,
      { chave: 'veiculo', rotulo: 'Veículo', de: 'veiculos' },
      pilar,
      temaEstrategico,
      { chave: 'atributo', rotulo: 'Atributo', de: 'atributos' },
    ],
    avancados: [
      subtemaN3,
      temaDoFornecedor,
      uf,
      { chave: 'autor', rotulo: 'Jornalista', de: 'autores' },
      subtemaDoFornecedor,
      concessionaria,
    ],
  },
  sociedade: {
    rapidos: [
      { chave: 'veiculo', rotulo: 'Rede', de: 'veiculos' },
      pilar,
      temaEstrategico,
      subtemaN3,
      { chave: 'perfil_autor', rotulo: 'Perfil de quem fala', de: 'perfis' },
      concessionaria,
    ],
    avancados: [temaDoFornecedor, subtemaDoFornecedor, { chave: 'autor', rotulo: 'Autor', de: 'autores' }, uf],
  },
  clientes: {
    rapidos: [concessionaria, pilar, temaEstrategico],
    avancados: [subtemaN3, temaDoFornecedor, subtemaDoFornecedor, uf],
  },
};

/** As lentes que têm filtro — as únicas para as quais vale buscar opções. */
export const LENTES_COM_FILTRO = Object.keys(FILTROS_DAS_LENTES);

/** Todas as dimensões de uma lente, rápidas primeiro. */
export function dimensoesDaLente(lente: string): DimensaoDaLente[] {
  const filtros = FILTROS_DAS_LENTES[lente];
  return filtros ? [...filtros.rapidos, ...filtros.avancados] : [];
}

/** "Folha de S.Paulo" → o nome que a tela mostra para aquele valor ("Tier 1"
 *  para `muito_relevante`). */
export function rotuloDoValor(dimensao: DimensaoDaLente, valor: string): string {
  return dimensao.rotulos?.[valor] ?? valor;
}
