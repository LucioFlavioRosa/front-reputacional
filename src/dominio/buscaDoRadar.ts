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
import { normalizarBusca } from '@/paginas/score/consulta/dados/seletores';
import type {
  ResultadoDeBusca,
  TipoDeResultado,
} from '@/paginas/score/consulta/dados/seletores';

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

/* -- o grupo da Consulta em profundidade (decisões D3 e A15, spec E.9) ------- */

/** Uma linha navegável da lista: uma sugestão real (lente ou filtro de lente)
 *  ou um resultado do drill ilustrativo.
 *
 *  UMA LISTA SÓ PARA O TECLADO: as setas atravessam os dois grupos e o `Enter`
 *  abre a ativa, então a tela precisa de um índice único sobre as duas
 *  origens, na ordem em que aparecem (as reais primeiro). */
export type OpcaoDaBusca =
  | { origem: 'radar'; sugestao: SugestaoDoRadar }
  | { origem: 'drill'; resultado: ResultadoDeBusca };

export function opcoesDaBusca(
  reais: SugestaoDoRadar[],
  doDrill: ResultadoDeBusca[],
): OpcaoDaBusca[] {
  return [
    ...reais.map((sugestao) => ({ origem: 'radar' as const, sugestao })),
    ...doDrill.map((resultado) => ({ origem: 'drill' as const, resultado })),
  ];
}

export interface GrupoDoDrill {
  tipo: TipoDeResultado;
  /** Posição do primeiro resultado do grupo em `doDrill`. */
  inicio: number;
  resultados: ResultadoDeBusca[];
}

/** Os resultados do drill em subgrupos por tipo, na ordem em que
 *  `buscarNoDrill` os devolve (ela já ordena por tipo: Subtema, Tema, Pilar,
 *  Matéria). */
export function agruparResultadosDoDrill(doDrill: ResultadoDeBusca[]): GrupoDoDrill[] {
  const grupos: GrupoDoDrill[] = [];
  doDrill.forEach((resultado, i) => {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.tipo === resultado.tipo) ultimo.resultados.push(resultado);
    else grupos.push({ tipo: resultado.tipo, inicio: i, resultados: [resultado] });
  });
  return grupos;
}

export interface TrechoDoNome {
  texto: string;
  realce: boolean;
}

/** O nome partido em trechos, com o que foi buscado marcado (E.9: "trecho
 *  buscado em 700 azul").
 *
 *  SEM ACENTO, como a própria busca (`normalizarBusca`): "agua" marca o
 *  "água" de "Abastecimento de água". A marcação volta para as letras ORIGINAIS
 *  (com acento e caixa), porque a comparação é feita letra a letra sobre a
 *  forma normalizada de cada uma. */
export function realcarTrecho(texto: string, termo: string): TrechoDoNome[] {
  const palavras = normalizarBusca(termo).split(' ').filter(Boolean);
  if (!texto || !palavras.length) return texto ? [{ texto, realce: false }] : [];

  // Cada letra normalizada aponta para a letra original de onde saiu.
  let normalizado = '';
  const origem: number[] = [];
  Array.from(texto).forEach((letra, i) => {
    const forma = letra
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
    for (const parte of forma) {
      normalizado += parte;
      origem.push(i);
    }
  });

  // O TERMO INTEIRO PRIMEIRO; só se ele não aparecer, cada palavra de duas
  // letras ou mais. Sem isso, "o globo" achado pelo veículo de uma matéria
  // marcaria cada "o" solto do título dela.
  const inteiro = palavras.join(' ');
  const alvos = normalizado.includes(inteiro) ? [inteiro] : palavras.filter((p) => p.length >= 2);

  const letras = Array.from(texto);
  const marcadas = new Array<boolean>(letras.length).fill(false);
  for (const palavra of alvos) {
    let de = normalizado.indexOf(palavra);
    while (de >= 0) {
      for (let k = de; k < de + palavra.length; k += 1) marcadas[origem[k]] = true;
      de = normalizado.indexOf(palavra, de + palavra.length);
    }
  }

  const trechos: TrechoDoNome[] = [];
  letras.forEach((letra, i) => {
    const ultimo = trechos[trechos.length - 1];
    if (ultimo && ultimo.realce === marcadas[i]) ultimo.texto += letra;
    else trechos.push({ texto: letra, realce: marcadas[i] });
  });
  return trechos;
}
