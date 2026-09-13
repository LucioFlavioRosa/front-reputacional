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
  // Rosa Goiaba do guia — a única das oito cores de frente que ainda não
  // estava em uso em lugar nenhum (clima, resultado, tier). Com texto escuro
  // dá 6,96:1; com branco, só 2,05 — por isso entra em `FUNDO_CLARO`.
  bancos_credores: '#FF8FE1',
};

export const ROTULOS_DE_FRENTE: Record<Frente, string> = {
  imprensa: 'Imprensa',
  // O CÓDIGO CONTINUA 'governo' — só o rótulo mudou (ver
  // `0031_frente_bancos_credores.sql`). Renomear o código quebraria toda
  // comparação `frente === 'governo'` no código, sem ganho nenhum: quem lê a
  // tela só vê "Entidades".
  governo: 'Entidades',
  parceiros: 'Parceiros',
  eventos: 'Eventos',
  investidores: 'Investidores',
  legislativo: 'Agentes Públicos',
  interna: 'Interna',
  bancos_credores: 'Bancos/Credores',
};

/** O que cada frente cobre — vira o `title` do chip, para quem esquece a
 *  diferença entre "Entidades" e "Parceiros", ou não sabe o que "Interna"
 *  guarda, não precisar abrir o registro pra descobrir. */
export const DESCRICAO_DE_FRENTE: Record<Frente, string> = {
  imprensa: 'Jornalistas e veículos de imprensa — entrevista, matéria, resposta a pauta.',
  governo: 'Órgãos públicos e representantes do governo.',
  parceiros: 'Entidades parceiras da Aegea — associações, ONGs, institutos.',
  eventos: 'Participação ou promoção de eventos institucionais.',
  investidores: 'Investidores e o mercado financeiro.',
  legislativo: 'Proposições em tramitação no Legislativo.',
  interna: 'Demanda interna da Aegea, sem interlocutor de fora.',
  bancos_credores: 'Bancos e credores — relação de crédito e dívida, não de mercado de capitais.',
};

/** Que TIPO de instituição cada frente conversa.
 *
 *  Espelha `TIPO_DE_INSTITUICAO` do backend. O mapa existia so dentro do
 *  seeder — um script de desenvolvimento — e a regra e de dominio: uma agenda
 *  de imprensa fala com veiculo, uma de legislativo com proposicao.
 *
 *  `eventos` e `parceiros` compartilham `entidade`: quem promove um evento e a
 *  mesma classe de instituicao com quem se faz parceria.
 */
export const TIPO_DE_INSTITUICAO: Record<Frente, string> = {
  imprensa: 'veiculo',
  governo: 'orgao',
  parceiros: 'entidade',
  eventos: 'entidade',
  investidores: 'investidor',
  legislativo: 'proposicao',
  interna: 'area_interna',
  // NÃO é 'investidor': a relação com um banco credor é de dívida, não de
  // mercado de capitais — misturar as duas ofereceria bancos de crédito no
  // filtro de instituições de Investidores, e vice-versa.
  bancos_credores: 'credor',
};

/** As instituições que a frente escolhida oferece — MAIS a já gravada.
 *
 *  O acréscimo não é gentileza: medido no banco, DUAS agendas de imprensa
 *  apontam para instituição do tipo `entidade`, e não `veiculo`. Filtrando sem
 *  ressalva, o campo dessas agendas abriria em branco ao editar — e campo
 *  obrigatório em branco num registro que existe se lê como dado corrompido,
 *  não como filtro fazendo efeito.
 *
 *  Mesma solução da lista de agenda de origem, pelo mesmo motivo.
 */
export function instituicoesDaFrente<
  T extends { id: string; tipo: string },
>(instituicoes: T[], frente: Frente, jaEscolhida: string): T[] {
  const tipo = TIPO_DE_INSTITUICAO[frente];
  return instituicoes.filter((i) => i.tipo === tipo || i.id === jaEscolhida);
}

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
  // MESMOS CAMPOS DE GOVERNO/PARCEIROS/EVENTOS: reaproveita `Institucional`
  // no backend em vez de ganhar extensão própria (ver `app/dominio/
  // frentes.py`). `nome_evento` fica de fora — só faz sentido em Eventos.
  bancos_credores: [
    { campo: 'natureza_orgao', rotulo: 'Natureza do órgão' },
    { campo: 'cargo_interlocutor', rotulo: 'Cargo do interlocutor' },
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
export function extensaoAoTrocarDeFrente<T extends object>(
  extensao: T,
  frente: Frente,
): T {
  // GENÉRICA porque as duas pontas guardam a extensão de formas diferentes: a
  // ficha usa `Extensao` (com datas, números e listas), e o formulário guarda
  // `Record<string, string>`, que é o que sai de um `<input>`. Fixar `Extensao`
  // aqui compilava no `tsc --noEmit` da raiz — que não compila nada — e
  // quebrava no `tsc -b` do build.
  const carrega = new Set<string>(
    CAMPOS_DE_EXTENSAO[frente].map((c) => c.campo),
  );
  return Object.fromEntries(
    Object.entries(extensao).filter(([campo]) => carrega.has(campo)),
  ) as T;
}

/** Frentes cujo chip precisa de texto escuro para o contraste fechar.
 *
 *  Medido contra `#00312C` (o escuro) e `#FFFFFF`, em razão WCAG:
 *
 *    governo           #17E3CB   escuro 8,73   branco 1,63
 *    legislativo       #F8DC00   escuro 10,32  branco 1,38
 *    eventos           #FE952B   escuro 6,47   branco 2,20
 *    interna           #8C91A4   escuro 4,54   branco 3,13
 *    bancos_credores   #FF8FE1   escuro 6,96   branco 2,05
 *
 *  As cinco só passam com texto escuro. As outras três — Imprensa (10,37),
 *  Parceiros (5,05) e Investidores (4,52 depois do ajuste acima) — passam com
 *  branco, e só com branco.
 */
const FUNDO_CLARO: ReadonlySet<Frente> = new Set<Frente>([
  'governo',
  'legislativo',
  'eventos',
  'interna',
  'bancos_credores',
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

/** Quem pode representar a instituição escolhida — MAIS quem já está na agenda.
 *
 *  Escolher a instituição já disse com quem se conversa; oferecer as 55 pessoas
 *  da base convida a registrar alguém do órgão errado, e esse erro não tem como
 *  ser percebido depois — o nome fica lá, plausível.
 *
 *  Quem já foi acrescentado entra sempre, pelo mesmo motivo da instituição: uma
 *  agenda antiga pode ter pessoa de outra instituição, e o campo abrindo em
 *  branco pareceria dado perdido.
 *
 *  Sem instituição escolhida devolve VAZIO, e não tudo. É a ordem em que se
 *  preenche, e a lista vazia com sua mensagem diz isso melhor do que uma lista
 *  de 55 nomes sem relação com nada.
 */
export function interlocutoresDaInstituicao<
  T extends { id: string; instituicao_id: string | null },
>(interlocutores: T[], instituicaoId: string, jaNaAgenda: string[]): T[] {
  if (!instituicaoId) {
    return interlocutores.filter((i) => jaNaAgenda.includes(i.id));
  }
  return interlocutores.filter(
    (i) => i.instituicao_id === instituicaoId || jaNaAgenda.includes(i.id),
  );
}
