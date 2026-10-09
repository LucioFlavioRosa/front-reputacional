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
import { CORES_DE_CLIMA } from '@/dominio/frentes';

export interface DimensaoDaLente {
  chave: keyof FiltroDaLente;
  rotulo: string;
  /** De qual lista de `opcoes-de-filtro` saem os valores. */
  de: keyof OpcoesDeFiltroDaLente;
  rotulos?: Record<string, string>;
  /** A ordem fixa dos valores (Tier 1, 2, 3; Positivo, Neutro, Negativo). Sem
   *  ela, vale a ordem do servidor. */
  ordem?: string[];
  /** A cor do gatilho conforme o valor escolhido — o termômetro do CRM. */
  destaques?: Record<string, { fundo: string; texto: string }>;
}

export const ROTULO_DO_TIER: Record<string, string> = {
  muito_relevante: 'Tier 1',
  relevante: 'Tier 2',
  menos_relevante: 'Tier 3',
};

export const ROTULO_DO_SENTIMENTO: Record<string, string> = {
  pos: 'Positivo',
  neu: 'Neutro',
  neg: 'Negativo',
};

const tier: DimensaoDaLente = {
  chave: 'tier',
  rotulo: 'Tier do veículo',
  de: 'tiers',
  rotulos: ROTULO_DO_TIER,
  ordem: ['muito_relevante', 'relevante', 'menos_relevante'],
};
//: O SENTIMENTO COM A COR DO TERMÔMETRO DO CRM, por pedido: Positivo verde,
//: Neutro cinza, Negativo vermelho — as mesmas cores (`CORES_DE_CLIMA`) e o
//: mesmo texto escuro, que é o que dá contraste sobre o vermelho.
const sentimento: DimensaoDaLente = {
  chave: 'sentimento',
  rotulo: 'Sentimento',
  de: 'sentimentos',
  rotulos: ROTULO_DO_SENTIMENTO,
  ordem: ['pos', 'neu', 'neg'],
  destaques: {
    pos: { fundo: CORES_DE_CLIMA.propositivo, texto: 'var(--sobre-turquesa)' },
    neu: { fundo: CORES_DE_CLIMA.neutro, texto: 'var(--cinza-4)' },
    neg: { fundo: CORES_DE_CLIMA.tenso, texto: 'var(--cinza-4)' },
  },
};
//: "TEMA" SEMPRE DIZ QUAL É, por pedido. O TEMA QUE O FORNECEDOR ESCREVE É O
//: PILAR (N1): o filtro de Pilar o encontra (o servidor casa os dois). O
//: subtema do fornecedor é o N3, e fica "(fornecedor)" até o de-para entrar.
const pilar: DimensaoDaLente = { chave: 'tema_n1', rotulo: 'Pilar (N1)', de: 'temas_n1' };
const temaEstrategico: DimensaoDaLente = { chave: 'tema_n2', rotulo: 'Tema estratégico (N2)', de: 'temas_n2' };
const subtemaN3: DimensaoDaLente = { chave: 'tema_n3', rotulo: 'Subtema (N3)', de: 'temas_n3' };
const subtemaDoFornecedor: DimensaoDaLente = { chave: 'subtema', rotulo: 'Subtema (fornecedor)', de: 'subtemas' };
const uf: DimensaoDaLente = { chave: 'uf', rotulo: 'UF', de: 'ufs' };
const concessionaria: DimensaoDaLente = { chave: 'empresa', rotulo: 'Concessionária', de: 'empresas' };

//: PILAR (N1) E TEMA ESTRATÉGICO (N2) NOS RÁPIDOS DE SOCIEDADE E CLIENTES, por
//: pedido — logo depois da dimensão própria da lente. A IMPRENSA FICOU ENXUTA,
//: também por pedido: Concessionária, Tier e Sentimento, nessa ordem; veículo e
//: temas seguem alcançáveis pela busca inteligente. O servidor oferece a taxonomia
//: inteira dos dois, então eles aparecem mesmo antes de haver menção ligada.
//:
//: OS "AVANÇADOS" NÃO TÊM MAIS BARRA (saíram, por pedido): continuam aqui porque
//: a busca inteligente sugere os valores deles.
export const FILTROS_DAS_LENTES: Record<
  string,
  { rapidos: DimensaoDaLente[]; avancados: DimensaoDaLente[] }
> = {
  imprensa: {
    rapidos: [concessionaria, tier, sentimento],
    avancados: [
      { chave: 'veiculo', rotulo: 'Veículo', de: 'veiculos' },
      pilar,
      temaEstrategico,
      subtemaN3,
      uf,
      { chave: 'autor', rotulo: 'Jornalista', de: 'autores' },
      subtemaDoFornecedor,
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
    avancados: [subtemaDoFornecedor, { chave: 'autor', rotulo: 'Autor', de: 'autores' }, uf],
  },
  clientes: {
    rapidos: [concessionaria, pilar, temaEstrategico],
    avancados: [subtemaN3, subtemaDoFornecedor, uf],
  },
};

/** As lentes que têm filtro — as únicas para as quais vale buscar opções. */
export const LENTES_COM_FILTRO = Object.keys(FILTROS_DAS_LENTES);

/** Todas as dimensões de uma lente, rápidas primeiro. */
export function dimensoesDaLente(lente: string): DimensaoDaLente[] {
  const filtros = FILTROS_DAS_LENTES[lente];
  return filtros ? [...filtros.rapidos, ...filtros.avancados] : [];
}

/** Os valores na ordem fixa da dimensão, quando ela tem uma; os desconhecidos
 *  vão para o fim, na ordem em que vieram. */
export function ordenarValores(dimensao: DimensaoDaLente, valores: string[]): string[] {
  const ordem = dimensao.ordem;
  if (!ordem) return valores;
  const posicao = (valor: string) => {
    const i = ordem.indexOf(valor);
    return i < 0 ? ordem.length : i;
  };
  return [...valores].sort((a, b) => posicao(a) - posicao(b));
}

/** "Folha de S.Paulo" → o nome que a tela mostra para aquele valor ("Tier 1"
 *  para `muito_relevante`). */
export function rotuloDoValor(dimensao: DimensaoDaLente, valor: string): string {
  return dimensao.rotulos?.[valor] ?? valor;
}
