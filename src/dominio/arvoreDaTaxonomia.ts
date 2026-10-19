/** A conta da Árvore da taxonomia (Metodologia), sem tela.
 *
 *  NENHUM NOME DA TAXONOMIA MORA AQUI. Pilares, temas, subtemas, clusters,
 *  riscos e as classificações de cor chegam do Cadastro de Temas pela rota
 *  `/api/taxonomia/arvore`, e tudo se liga pelos IDS. Esta camada só ordena,
 *  numera (a numeração 1, 1.2 sai da ordem, nunca é gravada), conta, pinta,
 *  filtra e busca.
 *
 *  SÓ O RISCO PRIMÁRIO CONTA, e é o único que a rota manda. Severidade e
 *  cluster saem SEMPRE do risco primário, nunca de um campo do subtema.
 */

import type {
  ArvoreDaTaxonomia,
  DimensaoDeCorDaArvore,
  RiscoDaArvore,
  SubtemaDaArvore,
  ValorDeCorDaArvore,
} from '@/api/score';

export type VisaoDaArvore = 'atributo' | 'risco';

export interface GrupoDaArvore {
  /** Chave estável do grupo aberto ou fechado (`t12`, `r7`, `sem`). */
  chave: string;
  /** "1.2" na visão por atributo; vazio na de risco. */
  numero: string;
  nome: string;
  subtemas: SubtemaDaArvore[];
  /** Na visão por risco: o risco do grupo (para a severidade e a lacuna). */
  risco?: RiscoDaArvore;
}

export interface ColunaDaArvore {
  chave: string;
  nome: string;
  grupos: GrupoDaArvore[];
  /** O bloco "Sem enquadramento de risco", desenhado à parte. */
  semEnquadramento?: boolean;
}

/** Busca sem acento e sem caixa. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const porOrdem = <T extends { ordem: number; id: number }>(a: T, b: T) =>
  a.ordem - b.ordem || a.id - b.id;
//: O SUBTEMA NÃO TEM ORDEM NO CADASTRO: dentro do tema, sai pelo nome.
const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, 'pt-BR');

/** Os índices de consulta, montados uma vez por resposta da rota. */
export interface IndiceDaArvore {
  arvore: ArvoreDaTaxonomia;
  temaPorId: Map<number, ArvoreDaTaxonomia['temas'][number]>;
  pilarPorId: Map<number, ArvoreDaTaxonomia['pilares'][number]>;
  riscoPorId: Map<number, RiscoDaArvore>;
  clusterPorId: Map<number, ArvoreDaTaxonomia['clusters'][number]>;
  /** "1.2" de cada tema. */
  numeroDoTema: Map<number, string>;
  colunasPorAtributo: ColunaDaArvore[];
  colunasPorRisco: ColunaDaArvore[];
}

export function indexar(arvore: ArvoreDaTaxonomia): IndiceDaArvore {
  const pilares = [...arvore.pilares].sort(porOrdem);
  const temas = [...arvore.temas].sort(porOrdem);
  const clusters = [...arvore.clusters].sort(porOrdem);
  const riscos = [...arvore.riscos].sort(porOrdem);
  const subtemas = [...arvore.subtemas].sort(porNome);

  const numeroDoTema = new Map<number, string>();
  const colunasPorAtributo: ColunaDaArvore[] = pilares.map((pilar, ip) => {
    const doPilar = temas.filter((tema) => tema.pilar_id === pilar.id);
    return {
      chave: `p${pilar.id}`,
      nome: `${ip + 1}. ${pilar.nome}`,
      grupos: doPilar.map((tema, it) => {
        const numero = `${ip + 1}.${it + 1}`;
        numeroDoTema.set(tema.id, numero);
        return {
          chave: `t${tema.id}`,
          numero,
          nome: tema.nome,
          subtemas: subtemas.filter((s) => s.tema_id === tema.id),
        };
      }),
    };
  });

  const riscoPorId = new Map(riscos.map((risco) => [risco.id, risco]));
  const colunasPorRisco: ColunaDaArvore[] = clusters.map((cluster) => ({
    chave: `c${cluster.id}`,
    nome: cluster.nome,
    grupos: riscos
      .filter((risco) => risco.cluster_id === cluster.id)
      .map((risco) => ({
        chave: `r${risco.id}`,
        numero: '',
        nome: risco.nome,
        risco,
        subtemas: subtemas.filter((s) => s.risco_id === risco.id),
      })),
  }));
  //: O SUBTEMA SEM RISCO (ou com um risco que não está mais ativo) vai para um
  //: bloco à parte, e não some.
  const semRisco = subtemas.filter((s) => s.risco_id == null || !riscoPorId.has(s.risco_id));
  if (semRisco.length) {
    colunasPorRisco.push({
      chave: 'sem',
      nome: 'Sem enquadramento de risco',
      semEnquadramento: true,
      grupos: [
        {
          chave: 'sem',
          numero: '',
          nome: 'Notícia negativa tem outro destino na taxonomia',
          subtemas: semRisco,
        },
      ],
    });
  }

  return {
    arvore,
    temaPorId: new Map(temas.map((tema) => [tema.id, tema])),
    pilarPorId: new Map(pilares.map((pilar) => [pilar.id, pilar])),
    riscoPorId,
    clusterPorId: new Map(clusters.map((cluster) => [cluster.id, cluster])),
    numeroDoTema,
    colunasPorAtributo,
    colunasPorRisco,
  };
}

/** O risco primário do subtema, se ativo. */
export function riscoDo(indice: IndiceDaArvore, subtema: SubtemaDaArvore): RiscoDaArvore | undefined {
  return subtema.risco_id == null ? undefined : indice.riscoPorId.get(subtema.risco_id);
}

/** O valor de cor do subtema numa dimensão: o do risco primário ou o próprio,
 *  pelo campo que a dimensão diz. Sem valor conhecido, o balde do vazio. */
export function valorDeCor(
  indice: IndiceDaArvore,
  dimensao: DimensaoDeCorDaArvore,
  subtema: SubtemaDaArvore,
): ValorDeCorDaArvore {
  const fonte = dimensao.alvo === 'risco' ? riscoDo(indice, subtema) : subtema;
  const codigo = fonte ? fonte[dimensao.campo] : null;
  return dimensao.valores.find((valor) => valor.codigo === codigo) ?? dimensao.vazio;
}

/** Os valores da dimensão na ordem da legenda: os cadastrados e, por último, o vazio. */
export function valoresDaLegenda(dimensao: DimensaoDeCorDaArvore): ValorDeCorDaArvore[] {
  return [...dimensao.valores, dimensao.vazio];
}

/** Quantos subtemas de cada valor, na ordem da legenda (só os que aparecem). */
export function composicao(
  indice: IndiceDaArvore,
  dimensao: DimensaoDeCorDaArvore,
  subtemas: SubtemaDaArvore[],
): { valor: ValorDeCorDaArvore; quantos: number }[] {
  const conta = new Map<string, number>();
  for (const subtema of subtemas) {
    const valor = valorDeCor(indice, dimensao, subtema);
    conta.set(valor.codigo, (conta.get(valor.codigo) ?? 0) + 1);
  }
  return valoresDaLegenda(dimensao)
    .filter((valor) => conta.has(valor.codigo))
    .map((valor) => ({ valor, quantos: conta.get(valor.codigo) ?? 0 }));
}

/** O texto em que a busca procura: subtema, tema, pilar e risco primário. */
export function textoDeBusca(indice: IndiceDaArvore, subtema: SubtemaDaArvore): string {
  const tema = indice.temaPorId.get(subtema.tema_id);
  const pilar = tema ? indice.pilarPorId.get(tema.pilar_id) : undefined;
  const risco = riscoDo(indice, subtema);
  return normalizar([subtema.nome, tema?.nome, pilar?.nome, risco?.nome].filter(Boolean).join(' '));
}

/** O subtema passa pela busca e pelo filtro de cor? */
export function passa(
  indice: IndiceDaArvore,
  dimensao: DimensaoDeCorDaArvore,
  subtema: SubtemaDaArvore,
  busca: string,
  filtro: ReadonlySet<string>,
): boolean {
  const termo = normalizar(busca);
  if (termo && !textoDeBusca(indice, subtema).includes(termo)) return false;
  if (filtro.size && !filtro.has(valorDeCor(indice, dimensao, subtema).codigo)) return false;
  return true;
}

/** Os números da faixa-resumo da visão ativa. */
export function totais(indice: IndiceDaArvore, visao: VisaoDaArvore): { valor: number; rotulo: string }[] {
  const { arvore } = indice;
  if (visao === 'atributo') {
    return [
      { valor: arvore.pilares.length, rotulo: 'pilares' },
      { valor: arvore.temas.length, rotulo: 'temas' },
      { valor: arvore.subtemas.length, rotulo: 'subtemas' },
    ];
  }
  const comRisco = arvore.subtemas.filter((s) => riscoDo(indice, s)).length;
  const lacunas = arvore.riscos.filter((risco) => !arvore.subtemas.some((s) => s.risco_id === risco.id)).length;
  return [
    { valor: arvore.riscos.length, rotulo: 'riscos' },
    { valor: comRisco, rotulo: 'subtemas com risco' },
    { valor: lacunas, rotulo: 'riscos sem subtema' },
  ];
}

/* -- o estado na URL ------------------------------------------------------------ */

export interface EstadoDaArvore {
  visao: VisaoDaArvore;
  /** A chave da dimensão de cor; vazio = a primeira que o servidor manda. */
  cor: string;
  filtro: string[];
  busca: string;
  subtema: number | null;
}

export const PARAMETROS_DA_ARVORE = ['arvore', 'cor', 'filtro', 'busca', 'subtema'] as const;

export function lerEstado(consulta: string): EstadoDaArvore {
  const p = new URLSearchParams(consulta);
  const subtema = Number(p.get('subtema'));
  return {
    visao: p.get('arvore') === 'risco' ? 'risco' : 'atributo',
    cor: p.get('cor') ?? '',
    filtro: p.getAll('filtro').filter(Boolean),
    busca: p.get('busca') ?? '',
    subtema: Number.isInteger(subtema) && subtema > 0 ? subtema : null,
  };
}

/** Escreve o estado na consulta, preservando os parâmetros que não são dela. */
export function escreverEstado(consulta: string, estado: EstadoDaArvore): string {
  const p = new URLSearchParams(consulta);
  for (const nome of PARAMETROS_DA_ARVORE) p.delete(nome);
  if (estado.visao === 'risco') p.set('arvore', 'risco');
  if (estado.cor) p.set('cor', estado.cor);
  for (const valor of estado.filtro) p.append('filtro', valor);
  if (estado.busca) p.set('busca', estado.busca);
  if (estado.subtema != null) p.set('subtema', String(estado.subtema));
  const texto = p.toString();
  return texto ? `?${texto}` : '';
}
