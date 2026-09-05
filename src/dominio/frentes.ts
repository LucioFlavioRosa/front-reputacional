/** Cor e rótulo de cada frente, e os demais vocabulários visuais.
 *
 *  As cores vêm do guia oficial da Aegea.
 *
 *  O CHIP É TEXTO DE 11px EM PESO 700, então o limiar de contraste que vale é
 *  4,5:1 — o de texto normal. "Texto grande", que se contenta com 3:1, começa
 *  em 18,66px negrito. Nenhum chip deste painel chega perto disso.
 *
 *  A escolha do texto sobre cada fundo está medida em `FUNDO_CLARO`, e não no
 *  olho: três frentes reprovavam, e uma delas — Eventos, laranja com texto
 *  branco — ficava em 2,20:1, menos da metade do exigido.
 */

import type { Extensao, Frente, GrupoDeStatus } from '@/dominio/tipos';

export const CORES_DE_FRENTE: Record<Frente, string> = {
  imprensa: '#0027BD',
  governo: '#17E3CB',
  parceiros: '#A11FFF',
  eventos: '#FE952B',
  // Magenta Pitaia do guia é `#E12379`, e com texto branco dá 4,45:1 — reprova
  // por 0,05. É o único caso em que trocar a cor do TEXTO não resolve: escuro
  // sobre ele dá 3,20, pior ainda.
  //
  // `#DF2378` é 1% mais escuro e fecha em 4,52:1. A diferença é indistinguível
  // a olho e mantém a leitura da marca; a alternativa seria deixar o rótulo
  // ilegível para quem enxerga menos.
  investidores: '#DF2378',
  legislativo: '#F8DC00',
  interna: '#8C91A4',
};

export const ROTULOS_DE_FRENTE: Record<Frente, string> = {
  imprensa: 'Imprensa',
  governo: 'Governo',
  parceiros: 'Parceiros',
  eventos: 'Eventos',
  investidores: 'Investidores',
  legislativo: 'Legislativo',
  interna: 'Interna',
};

/** Os campos de extensão que cada frente carrega — e os rótulos deles.
 *
 *  Vale para as duas pontas: a ficha lista aqui o "o que falta", e o cadastro
 *  usa a mesma lista para decidir o que sobrevive a uma troca de frente.
 *
 *  É por frente, não por classe de extensão, e a diferença importa. No backend
 *  Governo, Parceiros e Eventos compartilham `Institucional`, então trocar
 *  entre as três não precisa descartar `natureza_orgao` nem
 *  `cargo_interlocutor`. Mas `nome_evento` só faz sentido em Eventos: agrupar
 *  pela classe o preservaria em Governo, escondido — a ficha não o mostra
 *  fora de Eventos — e semanticamente errado.
 *
 *  Cada lista é um subconjunto do que o backend aceita para a frente. O
 *  servidor recusa campo fora da união (`extra="forbid"`), mas um campo válido
 *  na união e incoerente com a frente ele apenas ignora na conversão — some
 *  sem erro. É a tela que decide certo, então; não há rede de proteção lá.
 */
export const CAMPOS_DE_EXTENSAO: Record<
  Frente,
  { campo: keyof Extensao; rotulo: string }[]
> = {
  imprensa: [
    { campo: 'formato', rotulo: 'Formato' },
    { campo: 'data_atendida', rotulo: 'Data atendida' },
    { campo: 'data_publicacao', rotulo: 'Data de publicação' },
    { campo: 'link_materia', rotulo: 'Link da matéria' },
    { campo: 'mensagens_chave', rotulo: 'Mensagens-chave' },
  ],
  governo: [
    { campo: 'natureza_orgao', rotulo: 'Natureza do órgão' },
    { campo: 'cargo_interlocutor', rotulo: 'Cargo do interlocutor' },
  ],
  parceiros: [
    { campo: 'natureza_orgao', rotulo: 'Natureza do órgão' },
    { campo: 'cargo_interlocutor', rotulo: 'Cargo do interlocutor' },
  ],
  eventos: [
    { campo: 'natureza_orgao', rotulo: 'Natureza do órgão' },
    { campo: 'cargo_interlocutor', rotulo: 'Cargo do interlocutor' },
    { campo: 'nome_evento', rotulo: 'Nome do evento' },
  ],
  legislativo: [
    { campo: 'casa', rotulo: 'Casa' },
    { campo: 'tramitacao', rotulo: 'Tramitação' },
    { campo: 'prioridade', rotulo: 'Prioridade' },
    { campo: 'ementa', rotulo: 'Ementa' },
  ],
  investidores: [
    { campo: 'tipo_investidor', rotulo: 'Tipo de investidor' },
    { campo: 'formato', rotulo: 'Formato' },
  ],
  interna: [
    { campo: 'natureza', rotulo: 'Natureza' },
    { campo: 'cumprimento', rotulo: 'Cumprimento' },
    { campo: 'complexidade', rotulo: 'Complexidade' },
    { campo: 'prazo_dias', rotulo: 'Prazo em dias' },
    { campo: 'data_retorno', rotulo: 'Data de retorno' },
  ],
};

/** O que resta da extensão quando a agenda muda de frente.
 *
 *  Guarda os campos que a nova frente também carrega, e descarta o resto. Nada
 *  aqui inventa valor: o que sai, sai porque a nova frente não tem onde
 *  guardá-lo.
 */
export function extensaoAoTrocarDeFrente(
  extensao: Extensao,
  frente: Frente,
): Extensao {
  const carrega = new Set<string>(
    CAMPOS_DE_EXTENSAO[frente].map((c) => c.campo),
  );
  return Object.fromEntries(
    Object.entries(extensao).filter(([campo]) => carrega.has(campo)),
  ) as Extensao;
}

/** Frentes cujo chip precisa de texto escuro para o contraste fechar.
 *
 *  Medido contra `#00312C` (o escuro) e `#FFFFFF`, em razão WCAG:
 *
 *    governo      #17E3CB   escuro 8,73   branco 1,63
 *    legislativo  #F8DC00   escuro 10,32  branco 1,38
 *    eventos      #FE952B   escuro 6,47   branco 2,20
 *    interna      #8C91A4   escuro 4,54   branco 3,13
 *
 *  As quatro só passam com texto escuro. As outras três — Imprensa (10,37),
 *  Parceiros (5,05) e Investidores (4,52 depois do ajuste acima) — passam com
 *  branco, e só com branco.
 */
const FUNDO_CLARO: ReadonlySet<Frente> = new Set<Frente>([
  'governo',
  'legislativo',
  'eventos',
  'interna',
]);

export function textoSobreFrente(frente: Frente): string {
  return FUNDO_CLARO.has(frente) ? '#00312C' : '#FFFFFF';
}

export const CORES_DE_CLIMA: Record<string, string> = {
  propositivo: '#17E3CB',
  neutro: '#8C91A4',
  tenso: '#FF5C60',
};

export const CORES_DE_RESULTADO: Record<string, string> = {
  avancou: '#17E3CB',
  mantido: '#0027BD',
  recuou: '#FF5C60',
  sem_definicao: '#D5DAEA',
};

export const CORES_DE_GRUPO: Record<GrupoDeStatus, string> = {
  resolvido: '#17E3CB',
  aberto: '#FE952B',
  declinado: '#FF5C60',
};

export const ROTULOS_DE_GRUPO: Record<GrupoDeStatus, string> = {
  resolvido: 'Resolvidos',
  aberto: 'Em aberto',
  declinado: 'Declinados',
};

/** Faixas de risco da fila de pendências, em dias desde a interação. */
export type FaixaDeRisco = 'no-prazo' | 'atencao' | 'critico';

export function faixaDeRisco(dias: number): FaixaDeRisco {
  if (dias > 60) return 'critico';
  if (dias > 30) return 'atencao';
  return 'no-prazo';
}

export const ROTULOS_DE_RISCO: Record<FaixaDeRisco, string> = {
  'no-prazo': 'No prazo',
  atencao: 'Atenção',
  critico: 'Crítico',
};

export const CORES_DE_RISCO: Record<FaixaDeRisco, { fundo: string; texto: string }> = {
  'no-prazo': { fundo: '#DFFAF6', texto: '#0A6B60' },
  atencao: { fundo: '#FFF1DC', texto: '#8A4E00' },
  critico: { fundo: '#FFE7E8', texto: '#B32328' },
};

export const CORES_DE_TIER: Record<number, string> = {
  1: '#0027BD',
  2: '#8C91A4',
  3: '#D5DAEA',
};

/** Rótulo humano da abrangência.
 *
 *  `NA` e `IN` são códigos de banco. Fora do ranking do mapa eles estavam
 *  vazando crus para a tela — a Base mostrava "NA" em vez de "Nacional". */
export function rotuloDeAbrangencia(uf: string): string {
  if (uf === 'NA') return 'Nacional';
  if (uf === 'IN') return 'Internacional';
  return uf;
}
