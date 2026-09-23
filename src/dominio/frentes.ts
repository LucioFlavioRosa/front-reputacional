/** Cor e rótulo de cada frente, e os demais vocabulários visuais.
 *
 *  As cores vêm do guia oficial da Aegea.
 *
 *  A FRENTE NÃO APARECE MAIS EM TELA NENHUMA — a tela pergunta e mostra
 *  Formato da interação e Categoria de público; Frente continua existindo
 *  por baixo (deriva a extensão que a interação carrega, o controle de
 *  acesso por escopo), só não é mais exibida. `CORES_DE_FRENTE`/
 *  `ROTULOS_DE_FRENTE` sobrevivem aqui só pelo que ainda depende deles
 *  internamente: os KPIs do Painel (hoje atrás de uma flag desligada) e a
 *  ficha removível de um link antigo com `?frente=` na URL.
 */

import type { Extensao, Frente, GrupoDeStatus } from '@/dominio/tipos';

export const CORES_DE_FRENTE: Record<Frente, string> = {
  imprensa: '#0027BD',
  governo: '#17E3CB',
  parceiros: '#A11FFF',
  eventos: '#FE952B',
  investidores: '#DF2378',
  legislativo: '#F8DC00',
  interna: '#B0B9C8',
  bancos_credores: '#A85E40',
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

/** O inverso de `TIPO_DE_INSTITUICAO` — a frente que o TIPO da instituição já
 *  basta para decidir sozinho, sem perguntar mais nada. "entidade" fica de
 *  fora de propósito: é o único tipo que duas frentes conversam (Parceiros e
 *  Eventos), então não tem frente única — quem decide entre as duas é o
 *  Formato da interação, em `frenteDerivada`.
 *
 *  ESPELHA `FRENTE_UNICA_DO_TIPO` do backend (`app/dominio/frentes.py`) —
 *  mesma regra, dos dois lados, pelo mesmo motivo de `TIPO_DE_INSTITUICAO`. */
const FRENTE_UNICA_DO_TIPO: Partial<Record<string, Frente>> = Object.fromEntries(
  (Object.entries(TIPO_DE_INSTITUICAO) as [Frente, string][])
    .filter(([, tipo]) => tipo !== 'entidade')
    .map(([frente, tipo]) => [tipo, frente]),
);

/** A frente desta interação — SEM perguntar. A tela não escolhe frente
 *  diretamente: escolhe a instituição e o formato, e a frente sai daí, pela
 *  MESMA regra que `derivar_frente` aplica no backend ao salvar (ver
 *  `app/casos_de_uso/derivar_frente.py`):
 *
 *    1. O tipo da instituição decide sozinho, para todo tipo menos
 *       "entidade" — inclusive área interna (sempre Interna), proposição
 *       (sempre Legislativo) e credor (sempre Bancos/Credores).
 *    2. "entidade" é o único tipo ambíguo: Formato "Evento" decide Eventos;
 *       qualquer outro formato (ou nenhum) decide Parceiros.
 *
 *  Sem instituição escolhida, não há o que derivar — devolve `null`. Isto é
 *  ESPELHO, não fonte da verdade: quem decide de fato é o backend ao salvar,
 *  porque o formulário não manda mais `frente` nenhuma no corpo. Existe aqui
 *  só para a tela SE ORIENTAR — o rótulo "Instituição"/"Proposição", a poda
 *  da extensão ao trocar de instituição, e o campo de leitura que mostra a
 *  frente calculada antes de salvar.
 */
export function frenteDerivada(
  instituicao: { tipo: string } | undefined,
  formatoCodigo: string | undefined,
): Frente | null {
  if (!instituicao) return null;
  const frenteUnica = FRENTE_UNICA_DO_TIPO[instituicao.tipo];
  if (frenteUnica) return frenteUnica;
  if (instituicao.tipo !== 'entidade') return null;
  return formatoCodigo === 'evento' ? 'eventos' : 'parceiros';
}

/** Os campos de extensão que cada frente carrega — e os rótulos deles.
 *
 *  Vale para as duas pontas: a ficha lista aqui o "o que falta", e o cadastro
 *  usa a mesma lista para decidir o que sobrevive a uma troca de frente.
 *
 *  É por frente, não por classe de extensão, e a diferença importa. No backend
 *  Governo, Parceiros e Eventos compartilham `Institucional`, então trocar
 *  entre as três não precisa descartar `cargo_interlocutor`. Mas
 *  `nome_evento` só faz sentido em Eventos: agrupar
 *  pela classe o preservaria em Governo, escondido — a ficha não o mostra
 *  fora de Eventos — e semanticamente errado.
 *
 *  `natureza_orgao` não está em lista nenhuma de propósito: foi aposentada
 *  pela categoria de público da instituição (`0036`), o servidor ignora o
 *  campo em interação nova, e a tela nem pede nem mostra.
 *
 *  Cada lista é um subconjunto do que o backend aceita para a frente. O
 *  servidor recusa campo fora da união (`extra="forbid"`), mas um campo válido
 *  na união e incoerente com a frente ele apenas ignora na conversão — some
 *  sem erro. É a tela que decide certo, então; não há rede de proteção lá.
 */
/** As listas FECHADAS das extensões — enumerações do back (`PRIORIDADES`,
 *  `NATUREZAS`, `CUMPRIMENTOS`, `COMPLEXIDADES` em `app/dominio/frentes.py`),
 *  não dicionários: o servidor recusa qualquer outro valor. Espelhadas aqui
 *  com o rótulo que a tela mostra. */
export const ENUMERACOES_DA_EXTENSAO = {
  prioridade: [
    { codigo: 'alta', nome: 'Alta' },
    { codigo: 'media', nome: 'Média' },
    { codigo: 'baixa', nome: 'Baixa' },
    { codigo: 'monitoramento', nome: 'Monitoramento' },
  ],
  natureza: [
    { codigo: 'demanda', nome: 'Demanda' },
    { codigo: 'entrega', nome: 'Entrega' },
  ],
  cumprimento: [
    { codigo: 'interno', nome: 'Interno' },
    { codigo: 'externo', nome: 'Externo' },
    { codigo: 'misto', nome: 'Misto' },
  ],
  complexidade: [
    { codigo: 'baixa', nome: 'Baixa' },
    { codigo: 'media', nome: 'Média' },
    { codigo: 'alta', nome: 'Alta' },
  ],
} as const;

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
    { campo: 'cargo_interlocutor', rotulo: 'Cargo do interlocutor' },
  ],
  parceiros: [
    { campo: 'cargo_interlocutor', rotulo: 'Cargo do interlocutor' },
  ],
  eventos: [
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

export const CORES_DE_CLIMA: Record<string, string> = {
  propositivo: '#17E3CB',
  neutro: '#B0B9C8',
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
  T extends { id: string; instituicao_id: string | null; ativo?: boolean },
>(
  interlocutores: T[],
  instituicaoId: string,
  jaNaAgenda: string[],
  //: DISPONÍVEL = pessoa ativa E instituição ativa. O seletor de instituição
  //: só lista ativas, mas uma agenda ANTIGA pode apontar para uma desativada
  //: — e aí ninguém novo dela pode ser oferecido, só quem já estava.
  //: SEM VALOR PADRÃO, de propósito: um chamador que esqueça o argumento
  //: não compila, em vez de passar por "ativa" em silêncio.
  instituicaoAtiva: boolean,
): T[] {
  // QUEM JÁ ESTÁ NA AGENDA FICA, desligada ou não: editar uma agenda antiga
  // não pode perder quem esteve na sala.
  if (!instituicaoId || !instituicaoAtiva) {
    return interlocutores.filter((i) => jaNaAgenda.includes(i.id));
  }
  return interlocutores.filter(
    (i) =>
      jaNaAgenda.includes(i.id) || (i.instituicao_id === instituicaoId && i.ativo !== false),
  );
}
