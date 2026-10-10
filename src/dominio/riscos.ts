/** O rastreio de risco, como a tela o conhece.
 *
 *  AQUI NÃO SE CALCULA O ÍNDICE, pela mesma razão do Score: o Índice de
 *  Exposição a Risco é citado em reunião e precisa ser o mesmo para todo mundo,
 *  com a régua que o servidor aplica. Recalcular no navegador criaria uma
 *  segunda verdade, que divergiria no primeiro deploy que uma aba não recebeu.
 *
 *  O QUE A TELA DECIDE, e mora aqui: a cor de uma severidade, como se lê uma
 *  variação de risco, que meses a janela de análise marca, e o que escrever numa
 *  coluna que a fonte daquela linha não tem.
 *
 *  A ABA CRUZA CINCO FONTES — CRM, Clipei, Clipei investidores, Bites e
 *  Approach quando subir — porque todas falam a mesma língua: tema (N3) do
 *  cadastro → `tema_risco` → risco → severidade. SÓ CRUZA O QUE É PADRONIZADO,
 *  e é por isso que o que uma fonte só tem (tier, engajamento, veículo, link)
 *  aparece dizendo de quem é, em vez de aparecer vazio.
 */

import type { Janela } from '@/dominio/janelaDaJornada';

/* -- o que vem do servidor ----------------------------------------------------- */

/** Um mês da série do índice. */
export interface MesDoIndice {
  /** `AAAA-MM`. */
  mes: string;
  /** 0 a 100 na escala do pico da série. Nulo em mês sem incidente. */
  indice: number | null;
  incidentes: number;
  /** Incidentes por severidade, para a dica do mês dizer "2 incidentes". */
  por_severidade: Record<string, number>;
  /** OS MESMOS GRUPOS JÁ PELO PESO — é com isto que a barra se empilha.
   *
   *  A ALTURA DA BARRA É O ÍNDICE, que é ponderado: dividi-la pela CONTAGEM
   *  faria um mês de um crítico e três moderados aparecer 25/75 quando o peso é
   *  50/50, e as fatias não somariam a altura. Vem do servidor em vez de a tela
   *  guardar os pesos, que seria uma segunda régua. */
  pesado_por_severidade: Record<string, number>;
  /** A soma ponderada crua, antes de normalizar. */
  pesado: number;
  /** `critico` | `alto` | `moderado`, ou nulo sem incidente. */
  faixa: string | null;
  /** DENTRO DA JANELA ESCOLHIDA. A série vem INTEIRA e os meses de fora vêm
   *  marcados, porque o gráfico os esmaece em vez de os cortar: é o que deixa
   *  ver que o período escolhido é alto ou baixo em relação ao resto. */
  na_janela: boolean;
  /** As fontes que trouxeram incidente neste mês. */
  fontes: string[];
}

/** Um dos três números do topo. */
export interface KpiDoRisco {
  valor: number | null;
  /** O mês a que o número se refere, `AAAA-MM`. */
  mes: string | null;
}

export interface RiscoDaMatriz {
  codigo: string;
  nome: string;
  severidade: string;
  cluster: string;
  cluster_nome: string;
  incidentes: number;
  mencoes: number;
  agendas: number;
}

export interface PainelDeRisco {
  serie: MesDoIndice[];
  /** Quantos pontos ponderados valem 100 — o pico da série. */
  referencia: number;
  mes_do_pico: string | null;
  pico_do_periodo: KpiDoRisco;
  indice_atual: KpiDoRisco;
  variacao_no_mes: KpiDoRisco;
  matriz: RiscoDaMatriz[];
  /** Por severidade, CONTANDO INCIDENTE e não par (incidente, risco): os três
   *  números somam o total da tabela. */
  total_por_severidade: Record<string, number>;
  /** O piso de cada faixa do índice. */
  faixas: Record<string, number>;
}

export interface IncidenteNaTabela {
  /** `mencao` | `agenda`. */
  tipo: string;
  id: string;
  /** `AAAA-MM-DD`. */
  data: string;
  /** O veículo, na menção. Nulo na agenda — ver `alcanceDoIncidente`. */
  quem: string | null;
  /** O título da matéria. Nulo na agenda. */
  incidente: string | null;
  link: string | null;
  fonte: string;
  /** A LENTE da fonte — a dimensão padronizada. A tabela escreve "Imprensa ·
   *  Clipei": a lente diz de que ângulo se vê, a fonte diz de quem veio o dado,
   *  e quem confere uma planilha precisa da segunda. */
  lente: string;
  tema: string;
  tier: string | null;
  engajamento: number | null;
  severidade: string;
  /** Em quantos meses este assunto já teve incidente, na série inteira. */
  recorrencia: number;
  riscos: { codigo: string; nome: string }[];
}

export interface PaginaDeIncidentes {
  itens: IncidenteNaTabela[];
  total: number;
  pagina: number;
  tamanho: number;
}

/** Uma dimensão que o recorte oferece como filtro.
 *
 *  `tipo: 'vazia'` É INFORMAÇÃO, e não um erro: a fonte classifica o campo e
 *  este corte não trouxe nenhum valor. Ela CONTINUA na fileira de filtros, como
 *  a aba vazia das Lentes — um filtro que aparece e desaparece a cada clique se
 *  lê como tela quebrada, e o filtro vazio diz algo acionável ("a Clipei não
 *  classificou relevância neste corte"). O que não vem é a dimensão que NENHUMA
 *  fonte do recorte classifica, porque aí a ausência é da fonte. */
export interface DimensaoDoFiltro {
  chave: string;
  rotulo: string;
  /** `lista` | `busca` | `vazia`. */
  tipo: string;
  valores: string[];
  quantos: number;
  /** De quais fontes é este campo. */
  fontes: string[];
  /** Quantas menções do recorte têm valor aqui. */
  preenchidas: number;
}

export interface ClusterDeRisco {
  codigo: string;
  nome: string;
  riscos: { codigo: string; nome: string; severidade: string }[];
}

/** Um nó da taxonomia de temas — N1 (bloco), N2 (macro tema), N3 (tema).
 *
 *  OS TRÊS NÍVEIS SÃO O CAMINHO DO APROFUNDAMENTO: escolher N1 reduz a lista de
 *  N2, e escolher N2 reduz a de N3. `incidentes` é quantos o nó tem no recorte
 *  atual — sem ele, descer um nível seria chutar.
 *
 *  A ÁRVORE VEM INTEIRA, com os zeros: é a régua da matriz dos 32 riscos, que
 *  mostra os riscos sem incidente. Um seletor que muda de tamanho a cada clique
 *  não deixa procurar. */
export interface NivelDoTema {
  codigo: string;
  nome: string;
  dentro: NivelDoTema[];
  incidentes: number;
}

export interface OpcoesDoRisco {
  clusters: ClusterDeRisco[];
  fontes: { codigo: string; nome: string }[];
  /** AS LENTES COM INCIDENTE no recorte — a dimensão padronizada do Score. */
  lentes: { codigo: string; nome: string }[];
  temas: NivelDoTema[];
  dimensoes: DimensaoDoFiltro[];
  meses: string[];
}

/** O recorte da tela. Tudo opcional: o campo some da consulta quando vazio. */
export interface FiltroDoRisco {
  cluster?: string | null;
  risco?: string | null;
  fontes?: string[];
  /** Códigos de `lente` — a dimensão PADRONIZADA, e não o fornecedor. */
  lentes?: string[];
  /** `critico` | `alto` | `moderado` — a PIOR severidade do incidente, que é a
   *  mesma régua que empilha a barra e preenche a coluna da tabela. */
  severidade?: string | null;
  /** Os três níveis do cadastro de temas: N1, N2 e N3. */
  bloco?: string | null;
  macro?: string | null;
  tema?: string | null;
  /** `AAAA-MM`. */
  de?: string | null;
  ate?: string | null;
  busca?: string | null;
  /** Por dimensão: `{ tier: 'relevante' }`. Elas se empilham. */
  dimensoes?: Record<string, string>;
}

/* -- a severidade -------------------------------------------------------------- */

/** AS TRÊS SEVERIDADES, da pior para a menos grave.
 *
 *  A ORDEM É A DA GRAVIDADE, e é a mesma do servidor (`app/dominio/riscos.py`):
 *  é ela que empilha as barras do gráfico, ordena os três números do topo e
 *  resolve a severidade de um incidente que toca dois riscos.
 *
 *  `forte` é a cor do traço e do quadrado da legenda; `area`, o preenchimento da
 *  etiqueta; `texto`, o que se escreve em cima da área. São exigências opostas —
 *  o amarelo pequi preenche bem e, escrito, some no branco. */
export const SEVERIDADES: {
  codigo: string;
  rotulo: string;
  forte: string;
  area: string;
  texto: string;
}[] = [
  {
    codigo: 'critico',
    rotulo: 'Crítico',
    forte: 'var(--vermelho-pitanga)',
    area: 'var(--erro-bg)',
    texto: 'var(--erro-fg)',
  },
  {
    codigo: 'alto',
    rotulo: 'Alto',
    forte: 'var(--laranja-baia)',
    area: 'var(--atencao-bg)',
    texto: 'var(--atencao-fg)',
  },
  {
    codigo: 'moderado',
    rotulo: 'Moderado',
    forte: 'var(--amarelo-pequi)',
    area: 'var(--moderado-bg)',
    texto: 'var(--moderado-fg)',
  },
];

function severidadeDe(codigo: string | null) {
  return SEVERIDADES.find((severidade) => severidade.codigo === codigo);
}

/** A cor do traço da severidade — barra do gráfico, quadrado da legenda. */
export function corDaSeveridade(codigo: string | null): string {
  return severidadeDe(codigo)?.forte ?? 'var(--cinza-1)';
}

/** A cor de PREENCHIMENTO da etiqueta de severidade. */
export function areaDaSeveridade(codigo: string | null): string {
  return severidadeDe(codigo)?.area ?? 'var(--branco)';
}

/** A cor do TEXTO escrito sobre a área. */
export function textoDaSeveridade(codigo: string | null): string {
  return severidadeDe(codigo)?.texto ?? 'var(--cinza-3)';
}

/** O nome da severidade. Severidade que o cadastro tenha e a tela não conheça
 *  volta como veio, em vez de virar um travessão: o nome do banco informa mais
 *  do que a ausência dele. */
export function rotuloDaSeveridade(codigo: string | null): string {
  if (!codigo) return '—';
  return severidadeDe(codigo)?.rotulo ?? codigo;
}

/* -- a variação ---------------------------------------------------------------- */

/** A variação do índice com o sinal explícito. */
export function comoVariacao(variacao: number | null): string {
  if (variacao === null) return '—';
  if (variacao > 0) return `+${variacao}`;
  //: O MENOS É O TIPOGRÁFICO (−, U+2212) e não o hífen: ao lado de um número
  //: de 44px o hífen fica curto e alto, e lê-se como um traço de separação.
  if (variacao < 0) return `−${Math.abs(variacao)}`;
  return '0';
}

/** A cor da variação — E ELA É INVERTIDA EM RELAÇÃO AO SCORE.
 *
 *  No Score, subir é bom: o índice é saúde reputacional. AQUI SUBIR É RUIM: o
 *  índice é exposição a risco, e o verde é a queda. Duas telas da mesma divisão
 *  com a mesma seta em cores opostas é exatamente o tipo de coisa que engana em
 *  silêncio, e por isso a tela escreve ao lado o que a cor quer dizer ("Risco em
 *  queda frente a ago/2026") em vez de deixar a cor sozinha. */
export function corDaVariacao(variacao: number | null): string {
  if (variacao === null || variacao === 0) return 'var(--cinza-3)';
  return variacao < 0 ? 'var(--ok-fg)' : 'var(--erro-fg)';
}

/** A seta que acompanha a variação, para quem não distingue as duas cores. */
export function setaDaVariacao(variacao: number | null): string {
  if (variacao === null || variacao === 0) return '';
  return variacao < 0 ? '▼' : '▲';
}

/* -- a janela de análise ------------------------------------------------------- */

/** A janela (índices na série) virando o recorte `de`/`ate` em meses.
 *
 *  OS ATALHOS, O MÍNIMO DE TRÊS MESES E O "ANO ATUAL" NÃO MORAM AQUI: são de
 *  `dominio/janelaDaJornada`, que o Score já usa. Eu havia escrito uma segunda
 *  cópia dos cinco atalhos neste arquivo — mesmos rótulos, mesma definição de
 *  ano — e o preço foi concreto: o `SeletorDeJanela`, a moldura arrastável com
 *  os três gestos e o teclado, existia e não era usada, porque pedia o tipo da
 *  série do Score. Achado de revisão. Aqui ficou só a conversão de índice para
 *  mês, que é o que esta aba tem de particular: o filtro do servidor fala em
 *  `AAAA-MM`, e a janela fala em posições da série.
 *
 *  A JANELA MARCA, NÃO CORTA: o servidor devolve a série toda com `na_janela`
 *  por mês, e o gráfico esmaece o que está fora. É o que responde "este período
 *  é alto?" — pergunta que a série cortada não deixa fazer. */
export function recorteDaJanela(
  meses: string[],
  janela: Janela,
): { de: string | null; ate: string | null } {
  if (meses.length === 0) return { de: null, ate: null };
  //: A SÉRIE INTEIRA VAI SEM RECORTE: mandar o primeiro e o último mês daria o
  //: mesmo resultado hoje e deixaria de dar quando um mês mais antigo entrasse
  //: na base — a janela ficaria presa no que existia quando se clicou.
  if (janela.inicio <= 0 && janela.fim >= meses.length - 1) {
    return { de: null, ate: null };
  }
  return {
    de: meses[Math.max(0, janela.inicio)] ?? null,
    ate: meses[Math.min(meses.length - 1, janela.fim)] ?? null,
  };
}

/** O caminho de volta: o recorte em meses virando a janela da moldura.
 *
 *  SEM RECORTE É A SÉRIE INTEIRA, e não uma janela vazia: é o estado em que a
 *  aba abre. */
export function janelaDoRecorte(
  meses: string[],
  de: string | null | undefined,
  ate: string | null | undefined,
): Janela {
  const ultimo = Math.max(0, meses.length - 1);
  const comecou = de ? meses.indexOf(de) : -1;
  const terminou = ate ? meses.indexOf(ate) : -1;
  return {
    inicio: comecou >= 0 ? comecou : 0,
    fim: terminou >= 0 ? terminou : ultimo,
  };
}

/* -- as colunas que uma fonte só tem ------------------------------------------- */

/** O ALCANCE, nas duas formas que as fontes mandam.
 *
 *  CRU, E NÃO TRADUZIDO: a imprensa manda `tier` ("muito relevante") e as redes
 *  mandam `engajamento` (1.243 interações). Inventar uma escala comum entre os
 *  dois seria inventar equivalência que ninguém mediu — e é o número que entraria
 *  na conversa como se fosse medido.
 *
 *  E A AGENDA NÃO TEM ALCANCE: não há veículo do outro lado de uma reunião. A
 *  célula diz isso, em vez de ficar vazia — célula vazia numa coluna que o resto
 *  da tabela preenche se lê como dado faltando, e manda a pessoa procurar o que
 *  cobrar do fornecedor. */
export function alcanceDoIncidente(
  incidente: IncidenteNaTabela,
): { valor: string; detalhe: string | null; ausente: boolean } {
  if (incidente.tier) {
    return { valor: incidente.tier, detalhe: 'relevância do veículo', ausente: false };
  }
  if (incidente.engajamento !== null && incidente.engajamento !== undefined) {
    return {
      valor: numeroCurto(incidente.engajamento),
      detalhe: 'interações',
      ausente: false,
    };
  }
  if (incidente.tipo === 'agenda') {
    return { valor: 'não se aplica', detalhe: 'agenda do CRM', ausente: true };
  }
  return { valor: 'não informado', detalhe: `pela ${incidente.fonte}`, ausente: true };
}

/** O número do engajamento curto, para caber numa coluna de 84px. */
function numeroCurto(valor: number): string {
  if (valor >= 1000) return `${(valor / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

/** QUEM ESTÁ DO OUTRO LADO — o veículo, na menção.
 *
 *  Na agenda é a instituição, e ela mora na tela do CRM: esta aba conta a reunião
 *  como incidente, e quem precisa do detalhe a abre lá, onde ela vive com a pauta
 *  e os participantes. */
export function quemDoIncidente(incidente: IncidenteNaTabela): string {
  if (incidente.quem) return incidente.quem;
  return incidente.tipo === 'agenda' ? 'Agenda do CRM' : '—';
}

/** O TEXTO DO INCIDENTE: o título da matéria, ou o que descreve a reunião.
 *
 *  A agenda não tem título livre — o assunto e o clima descrevem a reunião, e a
 *  pauta é registro do CRM. A tabela escreve o assunto, que é o que esta tela
 *  tem a dizer sobre ela. */
export function tituloDoIncidente(incidente: IncidenteNaTabela): string {
  if (incidente.incidente) return incidente.incidente;
  return `Reunião de clima tenso sobre ${incidente.tema}`;
}

/** O que escrever num filtro que a fonte tem e o recorte esvaziou. */
export function porQueADimensaoEstaVazia(dimensao: DimensaoDoFiltro): string {
  const de = dimensao.fontes.join(', ');
  return `${dimensao.rotulo} vem da ${de}, e neste recorte não há nenhum valor preenchido.`;
}

/* -- a trilha do aprofundamento ------------------------------------------------ */

/** O NOME DE CADA DEGRAU, para a trilha do modal dizer o caminho percorrido.
 *
 *  EM UM LUGAR SÓ porque a trilha aparece em dois (o chip do filtro e o título
 *  do painel), e dois mapas divergiriam no primeiro rótulo que alguém ajustasse.
 *  `tema` é "Tema (N3)" e não "Tema": a planilha da Bites e o cadastro falam em
 *  N1/N2/N3, e é assim que a equipe se refere a eles em reunião. */
export const ROTULO_DO_DEGRAU: Record<string, string> = {
  lentes: 'Lente',
  fontes: 'Fonte',
  bloco: 'Pilar (N1)',
  macro: 'Macro tema (N2)',
  tema: 'Tema (N3)',
  cluster: 'Cluster de risco',
  risco: 'Risco',
  severidade: 'Severidade',
  de: 'De',
  ate: 'Até',
  busca: 'Busca',
};

/** A ORDEM EM QUE OS DEGRAUS SE OFERECEM, do macro ao micro.
 *
 *  É a ordem do aprofundamento que o dono do produto pediu: sair do macro e
 *  chegar ao registro. Lente primeiro (de que ângulo se olha), depois a
 *  taxonomia descendo, depois o risco, e a severidade por último — ela é um
 *  corte transversal, não um nível.
 *
 *  A ORDEM É DO DOMÍNIO, e não da descida: dois links do mesmo recorte têm de se
 *  ler igual. É o mesmo cuidado que `RecorteDaLente` documenta. */
export const ORDEM_DOS_DEGRAUS = [
  'lentes',
  'fontes',
  'bloco',
  'macro',
  'tema',
  'cluster',
  'risco',
  'severidade',
] as const;

/** Os degraus ativos de um recorte, na ordem do domínio, para a trilha. */
export function trilhaDoRecorte(
  filtro: FiltroDoRisco,
): { chave: string; rotulo: string; valor: string }[] {
  const degraus: { chave: string; rotulo: string; valor: string }[] = [];
  for (const chave of ORDEM_DOS_DEGRAUS) {
    const bruto = filtro[chave as keyof FiltroDoRisco];
    const valor = Array.isArray(bruto) ? bruto.join(', ') : bruto;
    if (valor) {
      degraus.push({ chave, rotulo: ROTULO_DO_DEGRAU[chave] ?? chave, valor: String(valor) });
    }
  }
  return degraus;
}

/** O PRÓXIMO DEGRAU DA TAXONOMIA, e as opções dele no recorte.
 *
 *  A ESCADA É A DO CADASTRO: sem N1 escolhido, oferece os N1; com N1, os N2
 *  daquele N1; com N2, os N3 daquele N2. Oferecer os 104 temas de uma vez seria
 *  devolver a lista que a hierarquia existe para evitar.
 *
 *  `null` quando não há mais por onde descer na taxonomia — aí o que resta é o
 *  risco, a severidade e os registros. */
export function proximoNivelDoTema(
  arvore: NivelDoTema[],
  filtro: FiltroDoRisco,
): { chave: 'bloco' | 'macro' | 'tema'; opcoes: NivelDoTema[] } | null {
  if (!filtro.bloco) return { chave: 'bloco', opcoes: arvore };
  const bloco = arvore.find((um) => um.codigo === filtro.bloco);
  if (!bloco) return null;
  if (!filtro.macro) return { chave: 'macro', opcoes: bloco.dentro };
  const macro = bloco.dentro.find((um) => um.codigo === filtro.macro);
  if (!macro) return null;
  if (!filtro.tema) return { chave: 'tema', opcoes: macro.dentro };
  return null;
}

/** Descer um degrau: o recorte de cima mais o novo.
 *
 *  DESCER UM NÍVEL DA TAXONOMIA LIMPA OS DE BAIXO: trocar de N1 com um N2 do
 *  outro N1 ainda escolhido daria recorte impossível — e a tela mostraria zero
 *  sem dizer por quê. */
export function descendoEm(
  filtro: FiltroDoRisco,
  chave: string,
  valor: string,
): FiltroDoRisco {
  const descido: FiltroDoRisco = { ...filtro };
  if (chave === 'bloco') {
    descido.macro = null;
    descido.tema = null;
  }
  if (chave === 'macro') descido.tema = null;
  if (chave === 'cluster') descido.risco = null;
  if (chave === 'lentes' || chave === 'fontes') {
    descido[chave] = [valor];
    return descido;
  }
  return { ...descido, [chave]: valor };
}

/** Subir um degrau: tirar ele e os que dependem dele. */
export function subindoDe(filtro: FiltroDoRisco, chave: string): FiltroDoRisco {
  const subido: FiltroDoRisco = { ...filtro };
  if (chave === 'lentes' || chave === 'fontes') {
    subido[chave] = [];
  } else {
    (subido as Record<string, unknown>)[chave] = null;
  }
  //: TIRAR O PAI TIRA OS FILHOS, pela mesma razão que descer os limpa.
  if (chave === 'bloco') {
    subido.macro = null;
    subido.tema = null;
  }
  if (chave === 'macro') subido.tema = null;
  if (chave === 'cluster') subido.risco = null;
  return subido;
}
