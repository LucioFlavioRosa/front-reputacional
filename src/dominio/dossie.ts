/** O dossiê de uma lente, como a tela o recebe.
 *
 *  AQUI NÃO SE CALCULA NADA. Nota, KPIs, séries, painéis e textos chegam
 *  prontos do servidor — a mesma razão do Score: é um número que a diretoria
 *  cita, e precisa ser o mesmo para todo mundo. O que mora neste arquivo é o
 *  que a TELA decide: a cor de um efeito, o rótulo de uma prioridade, como se
 *  lê um mês.
 */

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

export interface Bloco {
  tipo: string;
  titulo: string;
  /** A frase que o gráfico prova, escrita pela curadoria. */
  conclusao: string | null;
  dados: Record<string, unknown>[];
  /** Como se chamam as três faixas NESTE bloco: a lente institucional mede
   *  clima (propositivo/neutro/tenso) e as outras medem sentimento. Vem do
   *  servidor porque a tela não pode descobrir isso adivinhando pelo título. */
  legenda: string[];
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

export interface EncaminhamentoDoDossie {
  id: string;
  acao: string;
  responsavel: string | null;
  prazo: string | null;
  status: string;
  mes_origem: string;
  exemplo: boolean;
}

export interface CuradoriaDoDossie {
  manchete: string | null;
  leitura: string[];
  revela: { titulo: string; texto: string }[];
  status: string;
  /** O texto foi gerado dos números, e ninguém o escreveu. */
  automatica: boolean;
  exemplo: boolean;
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
  evolucao: Bloco;
  fatos: FatoDoDossie[];
  paineis: Bloco[];
  curadoria: CuradoriaDoDossie;
  encaminhamentos: EncaminhamentoDoDossie[];
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

export const ROTULO_DO_STATUS: Record<string, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
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
  return (
    dossie.curadoria.exemplo ||
    [dossie.evolucao, ...dossie.paineis].some((bloco) => bloco.ficha.exemplo)
  );
}
