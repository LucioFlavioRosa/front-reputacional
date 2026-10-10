/** Tipos da base ilustrativa da Consulta em profundidade.
 *
 *  ESPELHAM A SEÇÃO C.2 DA SPEC, campo por campo. O JSON é a fonte de todos
 *  os números e frases da tela; estes tipos só descrevem a forma dele. Se o
 *  JSON mudar de forma, o lugar de corrigir é aqui, e o teste de invariantes
 *  (`invariantes.test.ts`) aponta o que deixou de fechar.
 */

export type Sentimento = 'positivo' | 'neutro' | 'negativo';
export type Tier = 'Tier 1' | 'Tier 2' | 'Tier 3';
export type FaixaId = 'referencia' | 'solido' | 'estavel' | 'atencao' | 'critico';

/** Inteiros que somam 100. */
export interface DistSentimento { pos: number; neu: number; neg: number }

export interface No {
  /** Slug estável, usado no endereço. */
  id: string;
  nome: string;
  /** Matérias, menções, mensagens ou interações. */
  volume: number;
  sentimento: DistSentimento;
  /** Pontos na nota da lente, 1 casa decimal. */
  impacto: number;
  impactoMesAnterior?: number;
}

export interface Item {
  id: string;
  /** ISO 'AAAA-MM-DD'. */
  data: string;
  veiculo: string;
  jornalista: string;
  tier: Tier;
  sentimento: Sentimento;
  concessionaria: string;
  uf: string;
  titulo: string;
  trecho: string;
  /** Nulo na demonstração: abre o modal de prévia. */
  url: string | null;
  /** 2 casas decimais. */
  impacto: number;
}

export interface Subtema extends No {
  /** Absolutos do subtema inteiro (não da amostra). */
  contagens?: { pos: number; neu: number; neg: number };
  tier1?: number;
  nivel4?: {
    leitura: string;
    tituloLista: string;
    subtituloLista: string;
    porDia: { total: number[]; negativas: number[]; destaque: { inicio: number; fim: number } };
    /** AMOSTRA ilustrativa, não o universo. */
    itens: Item[];
  };
}

export interface LinhaRecorte {
  nome?: string;
  tier?: Tier;
  uf?: string;
  veiculo?: string;
  volume: number;
  negativas?: number;
  impacto: number;
}

export interface Tema extends No {
  filhos?: Subtema[];
  nivel3?: {
    leitura: string;
    tituloTabela: string;
    subtituloTabela: string;
    destaque: {
      subtemaId: string;
      titulo: string;
      subtitulo: string;
      tiers: { titulo: string; linhas: LinhaRecorte[] };
      concessionarias: { titulo: string; linhas: LinhaRecorte[] };
      veiculos: { titulo: string; linhas: LinhaRecorte[] };
      jornalistas: { titulo: string; linhas: LinhaRecorte[] };
    };
  };
}

export interface Pilar extends No {
  filhos?: Tema[];
  nivel2?: {
    leitura: string;
    tituloTabela: string;
    subtituloTabela: string;
    destaque: {
      temaId: string;
      evolucao: { titulo: string; subtitulo: string; meses: string[]; impactos: number[]; volumes: number[] };
      concentracao: {
        titulo: string;
        subtitulo: string;
        concessionarias: { nome: string; volume: number; impacto: number }[];
        ufs: { nome: string; volume: number; impacto: number }[];
      };
    };
  };
}

export interface FiltroProprio { id: string; rotulo: string; opcoes: string[] }

export type LenteId = 'imprensa' | 'mercado' | 'sociedade' | 'clientes' | 'institucional';

export interface Lente {
  id: LenteId;
  nome: string;
  publico: string;
  cor: string;
  peso: number;
  nota: number;
  /** 6 meses; o último é a nota atual. */
  serie: number[];
  fonte: string;
  unidade: string;
  volumeTotal: number;
  totalPonderado?: number;
  /** Só a Imprensa desce além do Nível 1 nesta versão. */
  drill: boolean;
  /** Sociedade digital tem dois. */
  filtroProprio: FiltroProprio | FiltroProprio[];
  kpis: { rotulo: string; valor: string; nota: string }[];
  leitura: string;
  tabelaPilares: { titulo: string; subtitulo: string };
  pilares: Pilar[];
  cartoesLaterais: CartaoLateral[];
}

export type CartaoLateral =
  | {
      tipo: 'oQueMudou'; rotulo: string; titulo: string; de: number; para: number;
      linhas: { rotulo: string; valor: number }[]; nota: string;
    }
  | {
      tipo: 'historia'; rotulo: string; titulo: string; texto: string;
      metricas: { valor: string; rotulo: string; negativo?: boolean }[];
      itemId: string; destino: { lente: string; pilar: string; tema: string; subtema: string };
    }
  | {
      tipo: 'divergentes'; rotulo: string; titulo: string; subtitulo?: string;
      linhas: { rotulo: string; valor: number }[];
    }
  | {
      tipo: 'eventos'; rotulo: string; titulo: string;
      eventos: { sentimento: Sentimento; selo: string; meta: string; titulo: string; nota: string | null }[];
    }
  | {
      tipo: 'tabela'; rotulo: string; titulo: string; subtitulo?: string; colunas: string[];
      linhas: string[][]; linhaDestaque?: number;
      barras?: { rotulo: string; linhas: { rotulo: string; valor: number }[]; sufixo: string };
    }
  | {
      tipo: 'post'; rotulo: string; titulo: string;
      post: {
        sentimento: Sentimento; perfil: string; rede: string; data: string; concessionaria: string;
        uf: string; texto: string; metricas: { valor: string; rotulo: string }[]; url: string | null;
      };
    }
  | {
      tipo: 'saldos'; rotulo: string; titulo: string; subtitulo?: string;
      linhas: { nome: string; interacoes: number; saldo: number }[];
    }
  | {
      tipo: 'contagens'; rotulo: string; titulo: string; subtitulo?: string;
      secoes: { rotulo: string; linhas: [string, string][] }[];
    };

export interface Faixa {
  id: FaixaId;
  rotulo: string;
  min: number;
  max: number;
  fundo: string;
  texto: string;
  fundoGrafico: string;
}

export interface Dados {
  meta: {
    versao: string; mesReferencia: string; rotuloMes: string; mesAnterior: string;
    dataCorte: string; aviso: string; meses: string[];
  };
  faixas: Faixa[];
  pesoTier: Record<Tier, number>;
  lentes: Lente[];
}
