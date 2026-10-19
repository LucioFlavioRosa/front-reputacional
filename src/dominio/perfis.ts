/**
 * O acesso em TRÊS CAMADAS, que é como quem administra pensa nele.
 *
 *  O banco guarda onze bandeiras por papel. Quem libera uma pessoa não pensa em
 *  onze bandeiras: pensa em "ela entra onde?", "faz o quê lá?" e "vê o que é
 *  sensível?". Este módulo é a tradução entre as duas linguagens, e está fora do
 *  componente porque é onde os erros desta tela doem — um papel escolhido
 *  errado muda o que uma pessoa alcança, e isso não se descobre olhando a tela.
 *
 *      Nível    quais painéis       (as bandeiras `acessa_*`)
 *      Papel    o que faz neles     (`pode_criar`)
 *      Sensível se vê o que é sensível  (a coluna `acesso_sensivel`, de 0087)
 *
 *  Administrador é a exceção: tem tudo, e as camadas 2 e 3 não se aplicam.
 *
 *  DERIVADO DAS BANDEIRAS, NUNCA DO CÓDIGO DO PAPEL. `papel` é tabela no banco,
 *  e um papel novo é um `insert`: uma tela que reconhecesse `crm_edicao` pelo
 *  nome passaria a ignorar o papel seguinte em silêncio, e ninguém descobriria
 *  — a pessoa simplesmente não apareceria em nível nenhum. Por isso tudo aqui
 *  entra pelo catálogo que `GET /api/acessos/papeis` devolve.
 *
 *  OS NOMES DO PRODUTO E OS DO SISTEMA NÃO SE CORRESPONDEM, e é a armadilha
 *  desta tela. O descritivo de perfis fala em três painéis — CRM, KPIs
 *  Reputacionais e Painel de Inteligência de Mercado — e o banco tem três
 *  portais com outros nomes:
 *
 *      nível "CRM"      ← `acessa_crm`
 *      nível "KPIs"     ← `acessa_score`
 *      nível "Mercado"  ← `acessa_inteligencia_de_mercado`   (!)
 *
 *  O rótulo do segundo cartão da capa virou "KPIs Reputacionais" e "Painel de
 *  Inteligência de Mercado" foi para o cartão de `inteligencia_de_mercado`, que
 *  está em construção — está escrito em `paginas/Inicio.tsx`, junto do porquê.
 *  Até a migration 0095 esse portal se chamava `sintese`, e procurar
 *  um portal `mercado` não acha nada, e acreditar que ele falta leva a criá-lo:
 *  foi o que uma primeira versão desta mudança fez, com uma migration que
 *  acrescentava um quarto portal a um painel que já tinha o seu. O nível
 *  concederia uma bandeira que não guarda rota, o painel de verdade continuaria
 *  não concedido, e a tela pareceria certa.
 */

import { portaisDe } from '@/dominio/tipos';
import type { PapelDisponivel, Portal } from '@/dominio/tipos';

/** Os cinco níveis do descritivo, do mais amplo ao mais restrito. */
export type NivelId = 'admin' | 'exec' | 'crm' | 'kpi' | 'mercado';

export interface Nivel {
  id: NivelId;
  /** O que aparece na linha da lista, curto. */
  curto: string;
  /** O título da opção, por extenso. */
  nome: string;
  descricao: string;
  /** Uma etiqueta pequena ao lado do nome. */
  etiqueta: string;
  /** Verdadeiro no nível que depende de um painel ainda não lançado. */
  emConstrucao?: boolean;
}

export const NIVEIS: readonly Nivel[] = [
  {
    id: 'admin',
    curto: 'Administrador',
    nome: 'Todos os painéis + gerenciamento de usuários',
    descricao:
      'Acesso aos painéis executivos e a esta tela de perfis. Para o time que opera a plataforma.',
    etiqueta: 'Administrador',
  },
  {
    id: 'exec',
    curto: 'Executivo',
    nome: 'Todos os painéis executivos',
    descricao:
      'CRM dos Stakeholders, KPIs Reputacionais e Inteligência de Mercado. Sem gerenciamento de usuários.',
    etiqueta: 'Diretoria',
  },
  {
    id: 'crm',
    curto: 'CRM',
    nome: 'CRM dos Stakeholders',
    descricao:
      'Só a base de interações institucionais e a síntese executiva que lê essa base.',
    etiqueta: 'Painel 1',
  },
  {
    id: 'kpi',
    curto: 'KPIs',
    nome: 'KPIs Reputacionais',
    descricao: 'Só o Índice de Saúde Reputacional e as lentes.',
    etiqueta: 'Painel 2',
  },
  {
    id: 'mercado',
    curto: 'Mercado',
    nome: 'Painel de Inteligência de Mercado',
    descricao:
      'Só o tracking da saúde reputacional traduzido em indicadores. Libera quando o painel entrar no ar.',
    etiqueta: 'Painel 3',
    emConstrucao: true,
  },
] as const;

export function nivel(id: NivelId): Nivel {
  // Não devolve `undefined`: `NivelId` só tem estes cinco valores, e um `find`
  // que pudesse falhar obrigaria cada chamador a tratar um caso impossível.
  return NIVEIS.find((n) => n.id === id) ?? NIVEIS[0];
}

/**
 * O nível de um papel do catálogo, ou nulo se ele não cai em nenhum.
 *
 *  NULO É UM RESULTADO LEGÍTIMO, e não um erro. Os pares da Síntese
 *  (`inteligencia_de_mercado_leitura` / `inteligencia_de_mercado_edicao`) abrem um painel que o descritivo não
 *  trata como nível próprio, e devolver `'crm'` para eles seria mentira com
 *  consequência: a tela mostraria "CRM", quem administra salvaria sem mudar
 *  nada de propósito, e o papel da pessoa trocaria para `crm_leitura` — uma
 *  alteração de acesso que ninguém pediu.
 *
 *  A ORDEM DOS TESTES IMPORTA. `admin` vem primeiro porque é definido pela
 *  bandeira, e não pelos portais; `exec` vem antes de `crm` porque quem alcança
 *  todos também alcança o CRM.
 */
export function nivelDoPapel(papel: PapelDisponivel): NivelId | null {
  if (papel.administra_acessos) return 'admin';

  const portais = portaisDe(papel);
  const abre = (p: Portal) => portais.has(p);

  if (abre('crm') && abre('score') && abre('inteligencia_de_mercado')) return 'exec';
  if (abre('crm') && !abre('score') && !abre('inteligencia_de_mercado')) return 'crm';
  if (abre('score') && !abre('crm') && !abre('inteligencia_de_mercado')) return 'kpi';
  //: O NÍVEL "MERCADO" É O PORTAL `inteligencia_de_mercado` — o nome interno
  //: passou a seguir o rótulo na migration 0095. O NÍVEL continua se chamando
  //: `mercado` porque é assim que o descritivo de perfis o nomeia; ele não é um
  //: portal. Ver o comentário de `NIVEIS`.
  if (abre('inteligencia_de_mercado') && !abre('crm') && !abre('score')) return 'mercado';
  return null;
}

/**
 * O papel a conceder para um nível e um papel escolhidos, ou nulo se o catálogo
 * não tem nenhum que sirva.
 *
 *  Nulo acontece de verdade: o nível Mercado só é concedível porque a migration
 *  0088 semeou `mercado_leitura` e `mercado_edicao`. Num banco sem eles, a tela
 *  precisa dizer "não há papel para isto" em vez de salvar o papel errado.
 */
export function papelParaNivel(
  id: NivelId,
  editor: boolean,
  catalogo: readonly PapelDisponivel[],
): PapelDisponivel | null {
  const candidatos = catalogo.filter((p) => nivelDoPapel(p) === id);

  // Administrador não tem a camada de papel: "pode tudo" é o que o nível
  // significa. Pegar o primeiro é correto porque administrar acessos é a
  // bandeira que DEFINE o nível, e não há dois graus disso.
  if (id === 'admin') return candidatos[0] ?? null;

  return candidatos.find((p) => p.pode_criar === editor) ?? null;
}

/** Os níveis que o catálogo consegue conceder de verdade.
 *
 *  Um nível sem papel no banco é uma opção que não salva, e oferecê-la é pior
 *  do que não tê-la: a pessoa escolhe, clica em salvar e recebe um erro que não
 *  é sobre nada que ela fez.
 */
export function niveisConcediveis(
  catalogo: readonly PapelDisponivel[],
): Set<NivelId> {
  const prontos = new Set<NivelId>();
  for (const n of NIVEIS) {
    const temUsuario = papelParaNivel(n.id, false, catalogo);
    const temEditor = papelParaNivel(n.id, true, catalogo);
    if (n.id === 'admin' ? temUsuario : temUsuario && temEditor) prontos.add(n.id);
  }
  return prontos;
}

/* -- os módulos que cada nível libera -------------------------------------- */

export type ModuloId = 'crm' | 'kpi' | 'mercado' | 'usuarios';

export interface Modulo {
  id: ModuloId;
  nome: string;
  descricao: string;
}

export const MODULOS: readonly Modulo[] = [
  {
    id: 'crm',
    nome: 'CRM dos Stakeholders',
    descricao: 'Registro e análise das interações institucionais.',
  },
  {
    id: 'kpi',
    nome: 'KPIs Reputacionais',
    descricao: 'Índice de Saúde Reputacional e lentes.',
  },
  {
    id: 'mercado',
    nome: 'Inteligência de Mercado',
    descricao: 'Em construção — sem acesso até o lançamento.',
  },
  {
    id: 'usuarios',
    nome: 'Gerenciamento de usuários',
    descricao: 'Esta tela: níveis, papéis e informação sensível.',
  },
] as const;

/** Que módulos cada nível libera. É a tabela do descritivo, escrita.
 *
 *  Escrita, e não derivada das bandeiras do papel, porque a pergunta é outra:
 *  `acessa_*` responde "que PORTAL o papel abre", e módulo é o que a CAPA
 *  oferece — `usuarios` não é portal nenhum, e `kpi` é o nome que o produto dá
 *  ao portal `score`. Derivar um do outro embaralharia os dois vocabulários.
 */
const LIBERA: Record<Exclude<NivelId, 'admin'>, readonly ModuloId[]> = {
  exec: ['crm', 'kpi', 'mercado'],
  crm: ['crm'],
  kpi: ['kpi'],
  mercado: ['mercado'],
};

/** Em que estado um módulo fica, para o nível e o papel escolhidos.
 *
 *  É o que o quadro "O que este nível libera" mostra, e ele recalcula a cada
 *  clique — ANTES de salvar. Quem está decidindo precisa ver o efeito da
 *  decisão enquanto ainda pode mudá-la; ver depois é descobrir.
 */
export type EstadoDoModulo =
  | 'sem-acesso'
  | 'ao-lancar'
  | 'consulta'
  | 'editor'
  | 'total';

export function estadoDoModulo(
  modulo: ModuloId,
  id: NivelId | null,
  editor: boolean,
  mercadoLancado: boolean,
): EstadoDoModulo {
  if (id === null) return 'sem-acesso';

  //: A PORTA VEM ANTES DO ALCANCE, inclusive para administrador.
  //:
  //: Esta linha estava DEPOIS do atalho de `admin`, e por isso o Executivo via
  //: "Liberado ao lançar" no Mercado e o administrador via "Acesso total" — no
  //: mesmo painel, no mesmo instante, com o mesmo painel fechado. Administrar
  //: acessos não abre uma tela que não existe; "acesso total" ali prometia uma
  //: porta pelo motivo errado. Achado de revisão.
  //:
  //: Quem tem o nível alcança o painel; o painel é que não responde até a
  //: bandeira virar. São perguntas diferentes, e esta é a da porta.
  if (modulo === 'mercado' && !mercadoLancado) {
    return id === 'admin' || LIBERA[id].includes('mercado')
      ? 'ao-lancar'
      : 'sem-acesso';
  }

  if (id === 'admin') return 'total';

  if (!LIBERA[id].includes(modulo)) return 'sem-acesso';
  return editor ? 'editor' : 'consulta';
}

export const ROTULO_DO_ESTADO: Record<EstadoDoModulo, string> = {
  'sem-acesso': 'Sem acesso',
  'ao-lancar': 'Liberado ao lançar',
  consulta: 'Consulta',
  editor: 'Editor',
  total: 'Acesso total',
};
