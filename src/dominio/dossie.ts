/** O dossiê de uma lente, como a tela o recebe.
 *
 *  AQUI NÃO SE CALCULA NADA. Nota, KPIs, séries, painéis e textos chegam
 *  prontos do servidor — a mesma razão do Score: é um número que a diretoria
 *  cita, e precisa ser o mesmo para todo mundo. O que mora neste arquivo é o
 *  que a TELA decide: a cor de um efeito, o rótulo de uma prioridade, como se
 *  lê um mês.
 */

import { numero as numeroBR } from '@/dominio/formato';

/** De onde o número veio. A distinção não é técnica, é de confiança. */
export type OrigemDoDado = 'planilha' | 'crm' | 'relatorio' | 'cadastro' | 'calculo';

export interface Conceito {
  termo: string;
  texto: string;
}

/** A procedência de um bloco — o que o "?" abre.
 *
 *  `lacunas` é o campo que esta ficha existe para carregar: o que o bloco NÃO
 *  tem hoje, dito no lugar onde a pessoa está olhando o número. */
export interface Ficha {
  origem: OrigemDoDado;
  fonte: string;
  colunas: string[];
  lacunas: string[];
  exemplo: boolean;
  conceitos: Conceito[];
}

export interface ColunaDoBloco {
  chave: string;
  titulo: string;
  alinhamento: 'esquerda' | 'direita';
}

export interface Bloco {
  tipo: string;
  /** Distingue duas tabelas que se desenham igual e se leem diferente:
   *  `rating` destaca rebaixamento, `teor` destaca reclamação acima de metade.
   *  Antes a tela decidia isso lendo o TÍTULO do bloco — e um título reescrito
   *  pela curadoria trocaria o schema da tabela em silêncio. */
  subtipo: string | null;
  titulo: string;
  /** A frase que o gráfico prova, escrita pela curadoria. */
  conclusao: string | null;
  dados: Record<string, unknown>[];
  /** Como se chamam as três faixas NESTE bloco: a lente institucional mede
   *  clima (propositivo/neutro/tenso) e as outras medem sentimento. Vem do
   *  servidor porque a tela não pode descobrir isso adivinhando pelo título. */
  legenda: string[];
  /** Só nas tabelas: quais colunas mostrar, na ordem em que se lê. */
  colunas: ColunaDoBloco[];
  ficha: Ficha;
}

export interface KpiDoDossie {
  rotulo: string;
  valor: string;
  detalhe: string | null;
}

export interface FatoDoDossie {
  mes: string;
  texto: string;
  efeito: string;
}

export interface Dossie {
  codigo: string;
  nome: string;
  stakeholder: string;
  mes: string;
  nota: number | null;
  ns: number | null;
  delta: number | null;
  peso: number;
  estimado: boolean;
  ausencia: string | null;
  fontes: string[];
  formula: string;
  kpis: KpiDoDossie[];
  ficha_do_destaque: Ficha;
  /** A frase que abre a lente — calculada dos dados, nunca salva. */
  manchete: string | null;
  evolucao: Bloco;
  fatos: FatoDoDossie[];
  paineis: Bloco[];
}

/** Como cada origem se apresenta no "?".
 *
 *  O TEXTO IMPORTA MAIS QUE O RÓTULO. "Planilha do fornecedor" e "transcrito
 *  de relatório" soam parecidos e são coisas muito diferentes: um é contagem
 *  que a ferramenta fez, o outro é número que alguém leu num PDF e digitou. */
export const ORIGEM: Record<OrigemDoDado, { rotulo: string; texto: string }> = {
  planilha: {
    rotulo: 'Medido na planilha',
    texto:
      'Contado pela ferramenta, uma menção por vez, a partir do arquivo que o fornecedor entregou.',
  },
  crm: {
    rotulo: 'Do CRM',
    texto:
      'Contado das agendas registradas neste painel. Corrigir um registro corrige o número na hora.',
  },
  relatorio: {
    rotulo: 'Transcrito de relatório',
    texto:
      'Número lido do relatório do cliente e digitado aqui. Não foi medido por esta ferramenta.',
  },
  cadastro: {
    rotulo: 'Cadastro',
    texto: 'Preenchido por pessoas desta casa, e não derivado de nenhuma base.',
  },
  calculo: {
    rotulo: 'Calculado',
    texto: 'Derivado dos números acima pela régua em vigor.',
  },
};

/** As cores do efeito de um fato. As mesmas do Score. */
export const COR_DO_EFEITO: Record<string, string> = {
  sustenta: 'var(--ok-fg)',
  pressiona: 'var(--erro-fg)',
  misto: 'var(--cinza-2)',
};

export const ROTULO_DO_EFEITO: Record<string, string> = {
  sustenta: 'Sustenta',
  pressiona: 'Pressiona',
  misto: 'Misto',
};

/** A cor de uma prioridade da matriz de jornalistas.
 *
 *  SÓ A P1 É SÓLIDA. Quatro níveis com quatro cores fortes viram um arco-íris
 *  em que nada se destaca — e a matriz existe para responder "com quem falar
 *  primeiro". */
export function corDaPrioridade(nivel: number): { fundo: string; texto: string } {
  if (nivel === 1) return { fundo: 'var(--azul-mar)', texto: 'var(--branco)' };
  if (nivel === 2) return { fundo: 'var(--azul-claro, #EEF1F8)', texto: 'var(--azul-mar)' };
  return { fundo: 'var(--cinza-0)', texto: 'var(--cinza-2)' };
}

/** "2026-06" → "jun/26". O eixo precisa caber em oito colunas. */
export function mesCurto(chave: string): string {
  const [ano, mes] = chave.split('-');
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const indice = Number(mes) - 1;
  if (!ano || Number.isNaN(indice) || !nomes[indice]) return chave;
  return `${nomes[indice]}/${ano.slice(2)}`;
}

/** Quantas das lacunas de um dossiê inteiro estão declaradas.
 *
 *  A tela mostra isso no cabeçalho: uma lente cujos dois painéis dependem de
 *  dado que não existe precisa dizer isso ANTES de quem lê tirar conclusão dos
 *  gráficos. */
export function lacunasDoDossie(dossie: Dossie): string[] {
  return [dossie.evolucao, ...dossie.paineis].flatMap((bloco) => bloco.ficha.lacunas);
}

/** Se algum bloco do dossiê mostra conteúdo de exemplo. */
export function temExemplo(dossie: Dossie): boolean {
  return [dossie.evolucao, ...dossie.paineis].some((bloco) => bloco.ficha.exemplo);
}

export interface AvisoDeExemplo {
  /** Os gráficos que mostram ilustração, pelo nome. */
  graficos: string[];
}

/** O que exatamente é ilustração nesta lente.
 *
 *  A PRIMEIRA VERSÃO DIZIA SÓ QUE HAVIA, e mandava procurar: "conteúdo de
 *  ilustração em pelo menos um bloco — o ? de cada gráfico diz qual é qual".
 *  Em duas das cinco lentes isso é falso de um jeito cruel: em Sociedade e
 *  Institucional TODOS os gráficos são medidos, e só o texto veio transcrito.
 *  A pessoa abria um "?" atrás do outro atrás de uma ilustração que não existe
 *  — e, pior, passava a desconfiar de números que estão certos.
 *
 *  Desde que as frases passaram a ser calculadas, texto não é mais exemplo de
 *  nada: ou o gráfico mostra ilustração, ou não mostra.
 */
export function avisoDeExemplo(dossie: Dossie): AvisoDeExemplo | null {
  const graficos = [dossie.evolucao, ...dossie.paineis]
    .filter((bloco) => bloco.ficha.exemplo)
    .map((bloco) => bloco.titulo);
  return graficos.length ? { graficos } : null;
}

/** O valor de uma célula, sem fingir que o payload é tipado.
 *
 *  Os blocos chegam como `Record<string, unknown>` porque cada tipo de gráfico
 *  tem um formato — e a alternativa honesta a uma união discriminada de oito
 *  membros é converter na fronteira, uma vez, com o padrão à vista. Um `as
 *  Record<string, never>` seria pior: diria ao TypeScript que campo nenhum
 *  existe, e ele pararia de conferir qualquer coisa. */
export function comoNumero(valor: unknown, padrao = 0): number {
  // `null` e `''` ANTES da conversão: `Number(null)` é 0 e `Number('')` também,
  // os dois finitos — e um campo ausente entraria como zero medido, que é a
  // confusão que este arquivo inteiro existe para evitar.
  if (valor === null || valor === undefined || valor === '') return padrao;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : padrao;
}

export function comoTexto(valor: unknown, padrao = ''): string {
  return valor === null || valor === undefined ? padrao : String(valor);
}

/* -- as colunas de uma tabela do dossiê --------------------------------------- */

export interface ColunaMontada {
  chave: string;
  titulo: string;
  alinhamento: 'esquerda' | 'direita';
  formatar?: (valor: unknown, linha: Record<string, unknown>) => string;
  destaque?: (linha: Record<string, unknown>) => 'alerta' | 'bom' | null;
}

/** As colunas que o servidor mandou, com a regra de destaque desta leitura.
 *
 *  O QUE MOSTRAR É DO SERVIDOR; COMO DESTACAR é da tela. A primeira versão
 *  decidia as duas coisas aqui, e escolhia o schema procurando a palavra
 *  "rating" no título do bloco — um título reescrito pela curadoria trocaria a
 *  tabela inteira em silêncio. Agora o `subtipo` diz qual leitura é, e ele não
 *  muda quando alguém melhora um texto.
 */
export function colunasDaTabela(bloco: Bloco): ColunaMontada[] {
  return bloco.colunas.map((coluna) => ({
    chave: coluna.chave,
    titulo: coluna.titulo,
    alinhamento: coluna.alinhamento,
    formatar: formatadorDa(bloco, coluna.chave),
    destaque: destaqueDe(bloco, coluna.chave),
  }));
}

function formatadorDa(bloco: Bloco, chave: string) {
  if (chave === 'mes' || chave === 'data') {
    return (valor: unknown) => mesCurto(comoTexto(valor));
  }
  if (bloco.subtipo !== 'teor') return undefined;
  if (chave === 'acionaveis') {
    return (valor: unknown, linha: Record<string, unknown>) => {
      const total = comoNumero(linha.total);
      return total ? `${numeroBR(comoNumero(valor))} de ${numeroBR(total)}` : '—';
    };
  }
  if (chave === 'sem_classificacao') {
    return (valor: unknown) => (comoNumero(valor) ? numeroBR(comoNumero(valor)) : '—');
  }
  // As categorias de teor mostram volume E proporção: 288 reclamações num mês
  // de 886 e num de 400 são situações diferentes.
  return (valor: unknown, linha: Record<string, unknown>) => {
    const total = comoNumero(linha.total);
    const celula = comoNumero(valor);
    if (!total) return String(celula);
    return `${numeroBR(celula)} · ${Math.round((celula / total) * 100)}%`;
  };
}

function destaqueDe(bloco: Bloco, chave: string) {
  if (bloco.subtipo === 'rating') {
    if (chave === 'para') {
      // O efeito já vem classificado do servidor; repetir a regra de "piorou"
      // aqui criaria uma segunda definição, livre para divergir.
      return (linha: Record<string, unknown>) =>
        linha.efeito === 'pressiona' ? ('alerta' as const) : null;
    }
    if (chave === 'perspectiva') {
      return (linha: Record<string, unknown>) =>
        linha.perspectiva === 'negativa' ? ('alerta' as const) : null;
    }
    return undefined;
  }
  if (bloco.subtipo === 'teor' && chave === 'Reclamação') {
    return (linha: Record<string, unknown>) => {
      const total = comoNumero(linha.total);
      return total && comoNumero(linha['Reclamação']) / total >= 0.5
        ? ('alerta' as const)
        : null;
    };
  }
  return undefined;
}
