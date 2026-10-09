/** As sugestões da busca inteligente do Radar: lentes, e os valores de filtro
 *  de cada lente (veículos, redes, temas, concessionárias...).
 *
 *  TUDO VEM DO QUE O SERVIDOR JÁ DEVOLVE: o nome das lentes (`opcoes do Score`)
 *  e os valores de cada filtro no mês (`opcoes-de-filtro` de cada lente). Não há
 *  busca no texto das menções — isso pede uma rota nova, e fica para depois.
 *
 *  UM VALOR EM DUAS LENTES VIRA DUAS SUGESTÕES: "Tarifa social" pode ser tema da
 *  Sociedade digital e de Clientes, e escolher uma delas abre aquela lente. A
 *  linha de detalhe diz qual.
 */

import type { OpcoesDeFiltroDaLente } from '@/api/cliente';
import { normalizar } from '@/dominio/completar';
import { dimensoesDaLente, rotuloDoValor } from '@/dominio/filtrosDasLentes';
import type { DimensaoDaLente } from '@/dominio/filtrosDasLentes';

export interface LenteParaBusca {
  codigo: string;
  nome: string;
  stakeholder: string;
}

export interface SugestaoDoRadar {
  /** Única entre as sugestões — chave de lista e de foco. */
  id: string;
  lente: string;
  nomeDaLente: string;
  /** "Lente", "Veículo", "Rede", "Tema"... — o grupo que a lista mostra. */
  grupo: string;
  rotulo: string;
  /** Ausente quando a sugestão é a própria lente. */
  filtro?: { chave: DimensaoDaLente['chave']; valor: string };
  /** Texto extra que também casa na busca (o público, para a lente). */
  tambem?: string;
}

export function montarSugestoes(
  lentes: LenteParaBusca[],
  opcoesPorLente: Record<string, OpcoesDeFiltroDaLente | undefined>,
): SugestaoDoRadar[] {
  const sugestoes: SugestaoDoRadar[] = lentes.map((lente) => ({
    id: `lente:${lente.codigo}`,
    lente: lente.codigo,
    nomeDaLente: lente.nome,
    grupo: 'Lente',
    rotulo: lente.nome,
    tambem: lente.stakeholder,
  }));
  for (const lente of lentes) {
    const opcoes = opcoesPorLente[lente.codigo];
    if (!opcoes) continue;
    for (const dimensao of dimensoesDaLente(lente.codigo)) {
      for (const valor of opcoes[dimensao.de] ?? []) {
        sugestoes.push({
          id: `${lente.codigo}:${dimensao.chave}:${valor}`,
          lente: lente.codigo,
          nomeDaLente: lente.nome,
          grupo: dimensao.rotulo,
          rotulo: rotuloDoValor(dimensao, valor),
          filtro: { chave: dimensao.chave, valor },
        });
      }
    }
  }
  return sugestoes;
}

/** As sugestões que casam com o termo, as melhores primeiro.
 *
 *  SEM ACENTO E EM QUALQUER POSIÇÃO, como toda busca da plataforma ("folha"
 *  acha "Folha de S.Paulo", "agua" acha "Águas do Rio"). QUEM COMEÇA COM O TERMO
 *  VEM ANTES de quem só o contém, e a lente vem antes dos filtros: "imprensa"
 *  deve sugerir a lente primeiro, e não um veículo com "imprensa" no nome. */
export function filtrarSugestoes(
  sugestoes: SugestaoDoRadar[],
  termo: string,
  limite = 8,
): SugestaoDoRadar[] {
  const alvo = normalizar(termo);
  if (!alvo) return [];
  const pontos = (sugestao: SugestaoDoRadar): number => {
    const rotulo = normalizar(sugestao.rotulo);
    const extra = normalizar(sugestao.tambem ?? '');
    if (!rotulo.includes(alvo) && !extra.includes(alvo)) return -1;
    let nota = rotulo.startsWith(alvo) ? 2 : 1;
    if (!sugestao.filtro) nota += 2;
    return nota;
  };
  return sugestoes
    .map((sugestao) => ({ sugestao, nota: pontos(sugestao) }))
    .filter(({ nota }) => nota >= 0)
    .sort((a, b) => b.nota - a.nota || a.sugestao.rotulo.localeCompare(b.sugestao.rotulo, 'pt-BR'))
    .slice(0, limite)
    .map(({ sugestao }) => sugestao);
}
