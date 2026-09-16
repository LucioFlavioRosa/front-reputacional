/** Todos os agregados do painel, derivados do recorte filtrado.
 *
 *  ESTE É O ÚNICO LUGAR QUE CALCULA AGREGADO NO FRONT.
 *
 *  O painel busca o recorte inteiro em `GET /api/interacoes` e deriva aqui,
 *  com teto de `TETO_DE_DERIVACAO` (5.000) registros.
 *
 *  ⚠ AS ROTAS `GET /api/metricas/*` JÁ EXISTEM E ESTÃO TESTADAS no backend —
 *  este arquivo simplesmente não as consome ainda. As regras estão duplicadas
 *  nos dois lados de propósito enquanto isso, e é dívida conhecida: mudar uma
 *  regra aqui sem mudar em `app/banco/consultas_metricas.py` do `back-reputacional`
 *  faz os dois números divergirem.
 *
 *  Migrar é trocar a origem SÓ NESTE ARQUIVO: nenhuma tela conhece de onde os
 *  números vêm.
 */

import {
  chaveDaSemana,
  chaveDoMes,
  chaveDoSemestre,
  diasDesde,
  tituloDaAgenda,
} from '@/dominio/formato';
import { faixaDeRisco } from '@/dominio/frentes';
import type { FaixaDeRisco } from '@/dominio/frentes';
import type {
  Dicionarios,
  Frente,
  GrupoDeStatus,
  Instituicao,
  Interacao,
  Interlocutor,
  PessoaAegea,
  Referencia,
} from '@/dominio/tipos';

/** Os diretórios que resolvem chave estrangeira em nome legível. */
export interface Catalogo {
  dicionarios: Dicionarios;
  instituicoes: Map<string, Instituicao>;
  interlocutores: Map<string, Interlocutor>;
  pessoas: Map<string, PessoaAegea>;
  /** A biblioteca inteira, ATIVAS E INATIVAS: a Administração precisa das
   *  duas; quem oferece referência a uma agenda filtra as ativas. Mora no
   *  catálogo pelo mesmo motivo dos outros: é opção de formulário, e opção
   *  cadastrada precisa aparecer em toda tela sem ninguém apertar F5. */
  referencias: Referencia[];
}

export function montarCatalogo(
  dicionarios: Dicionarios,
  instituicoes: Instituicao[],
  interlocutores: Interlocutor[],
  pessoas: PessoaAegea[],
  referencias: Referencia[] = [],
): Catalogo {
  return {
    dicionarios,
    instituicoes: new Map(instituicoes.map((i) => [i.id, i])),
    interlocutores: new Map(interlocutores.map((i) => [i.id, i])),
    pessoas: new Map(pessoas.map((p) => [p.id, p])),
    referencias,
  };
}

/* -- utilidades ----------------------------------------------------------- */

export interface ItemContado {
  chave: string;
  rotulo: string;
  total: number;
  cor?: string;
}

function contar<T>(itens: T[], chave: (item: T) => string | null | undefined): Map<string, number> {
  const contagem = new Map<string, number>();
  for (const item of itens) {
    const k = chave(item);
    if (k == null || k === '') continue;
    contagem.set(k, (contagem.get(k) ?? 0) + 1);
  }
  return contagem;
}

function ordenarDecrescente(contagem: Map<string, number>): ItemContado[] {
  return [...contagem.entries()]
    .map(([chave, total]) => ({ chave, rotulo: chave, total }))
    .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
}

/* -- nomes ---------------------------------------------------------------- */

export function nomeDaInstituicao(catalogo: Catalogo, id: string): string {
  return catalogo.instituicoes.get(id)?.nome ?? '—';
}

export function nomeDoInterlocutor(catalogo: Catalogo, id: string | null): string {
  if (!id) return '—';
  return catalogo.interlocutores.get(id)?.nome ?? '—';
}

export function nomeDaPessoa(catalogo: Catalogo, id: string): string {
  return catalogo.pessoas.get(id)?.nome ?? '—';
}

export function nomeDaUnidade(catalogo: Catalogo, id: number | null): string {
  if (id == null) return '—';
  return catalogo.dicionarios.unidades_negocio.find((u) => u.id === id)?.nome ?? '—';
}

export function nomeDaEsfera(catalogo: Catalogo, id: number | null): string {
  if (id == null) return '—';
  return catalogo.dicionarios.esferas.find((e) => e.id === id)?.nome ?? '—';
}

export function rotuloDeCodigo(
  catalogo: Catalogo,
  dicionario: keyof Dicionarios,
  codigo: string | null,
): string {
  if (!codigo) return '—';
  const lista = catalogo.dicionarios[dicionario] as { codigo: string; nome: string }[];
  return lista.find((item) => item.codigo === codigo)?.nome ?? codigo;
}

/** O nome do nível de relevância, como está no banco.
 *
 *  NÃO monte `Tier ${n}` na tela. Os nomes vivem em `relevancia` e são
 *  editáveis por `update`: trocar 'Tier 4' por 'Regional' tem de mudar a Base,
 *  a Ficha e o resumo do recorte junto com o filtro. Enquanto quatro telas
 *  montavam o texto sozinhas, renomear mudava só o dropdown, e a mesma
 *  interação aparecia como "Regional" num lugar e "Tier 5" no outro.
 *
 *  O `?? \`Tier ${tier}\`` no fim cobre o registro cujo nível foi desativado:
 *  ele sai do dicionário, mas os registros que já o usavam continuam existindo
 *  e precisam mostrar alguma coisa.
 */
export function rotuloDeRelevancia(
  catalogo: Catalogo | null,
  tier: number | null,
): string {
  if (!tier) return '—';
  return catalogo?.dicionarios.relevancias.find((n) => n.id === tier)?.nome ?? `Tier ${tier}`;
}

export function nomesDosTemas(catalogo: Catalogo, ids: number[]): string[] {
  const porId = new Map(catalogo.dicionarios.temas.map((t) => [t.id, t.nome]));
  return ids.map((id) => porId.get(id)).filter((n): n is string => Boolean(n));
}

export function grupoDoStatus(catalogo: Catalogo, codigo: string): GrupoDeStatus | null {
  return catalogo.dicionarios.status.find((s) => s.codigo === codigo)?.grupo ?? null;
}

/* -- KPIs ----------------------------------------------------------------- */

export interface Kpis {
  institucionais: number;
  imprensa: { total: number; atendidas: number; taxa: number };
  eventos: number;
  investidores: { total: number; internacionais: number };
  legislativo: number;
  tier1: { total: number; percentual: number };
}

export function kpis(interacoes: Interacao[], catalogo: Catalogo): Kpis {
  const porFrente = (frente: Frente) => interacoes.filter((i) => i.frente === frente);

  const imprensa = porFrente('imprensa');
  const atendidas = imprensa.filter((i) => grupoDoStatus(catalogo, i.status) === 'resolvido');
  const investidores = porFrente('investidores');
  const tier1 = interacoes.filter((i) => i.tier === 1);

  return {
    institucionais: porFrente('governo').length + porFrente('parceiros').length,
    imprensa: {
      total: imprensa.length,
      atendidas: atendidas.length,
      taxa: imprensa.length ? atendidas.length / imprensa.length : 0,
    },
    eventos: porFrente('eventos').length,
    investidores: {
      total: investidores.length,
      internacionais: investidores.filter((i) => i.uf === 'IN').length,
    },
    legislativo: porFrente('legislativo').length,
    tier1: {
      total: tier1.length,
      percentual: interacoes.length ? tier1.length / interacoes.length : 0,
    },
  };
}

export interface ResumoDeClima {
  total: number;
  positivas: number;
  negativas: number;
}

/** Total e a quebra positivas/negativas por clima, para uma ou mais frentes
 *  somadas — sobre o recorte inteiro, a mesma base que os outros KPIs do
 *  cabeçalho usam (sem janela de data própria).
 *
 *  Positiva = clima `propositivo`; negativa = `tenso`. Sem clima registrado
 *  ou `neutro` não entram em nenhuma das duas — mesmo critério de
 *  `scorePorTema` e `BarraDivergente`.
 *
 *  Aceita mais de uma frente para o caso de soma (`institucionais` = governo
 *  + parceiros), sem duplicar o filtro em cada card. */
export function resumoDeClimaPorFrente(interacoes: Interacao[], frentes: Frente[]): ResumoDeClima {
  const doGrupo = interacoes.filter((i) => frentes.includes(i.frente));
  return {
    total: doGrupo.length,
    positivas: doGrupo.filter((i) => i.clima === 'propositivo').length,
    negativas: doGrupo.filter((i) => i.clima === 'tenso').length,
  };
}

/* -- painel: tier, área e público ------------------------------------------ */

//: Paleta da rosca de tier (e de outros gráficos do Painel que ainda usam
//: o arco-íris da marca). Temas ao lado da rosca de área NÃO reusam esta
//: lista — eles herdam `corDaArea`.
const PALETA_DO_PAINEL = ['#0027BD', '#17E3CB', '#A11FFF', '#FE952B', '#E12379', '#F8DC00'];

//: Paleta só de área (rosca, histórico e temas ligados a ela) — cinzas da
//: marca e os dois azuis-mar, na ordem do catálogo (`area.id`): Comunicação,
//: Relações Institucionais, Jurídico, Regulatório, Sustentabilidade, e o
//: cinza 1 para qualquer área extra. Não segue o volume do recorte: a mesma
//: área guarda a mesma cor ao lado do ranking de temas.
export const PALETA_DE_AREAS = [
  '#44495C', // cinza 3 — Comunicação
  '#0027BD', // azul mar — Relações Institucionais
  '#8C91A4', // cinza 2 — Jurídico
  '#111799', // azul mar sombra — Regulatório
  '#191B23', // cinza 4 — Sustentabilidade
  '#E2E5F0', // cinza 1 — extra / tema sem área
];

/** A cor estável da área — pelo `id` de cadastro, não pela fatia da rosca. */
export function corDaArea(catalogo: Catalogo, areaId: number): string {
  const ordenadas = [...catalogo.dicionarios.areas_pessoa].sort((a, b) => a.id - b.id);
  const indice = ordenadas.findIndex((area) => area.id === areaId);
  if (indice < 0) return PALETA_DE_AREAS[PALETA_DE_AREAS.length - 1];
  return PALETA_DE_AREAS[indice % PALETA_DE_AREAS.length];
}

/** Quantas interações em cada nível de relevância — sempre um item por
 *  tier cadastrado (`catalogo.dicionarios.relevancias`), mesmo os com zero
 *  neste recorte: é o que faz a rosca sempre ter o mesmo número de fatias,
 *  em vez de encolher quando um tier fica sem registro. */
export function porTier(interacoes: Interacao[], catalogo: Catalogo): ItemContado[] {
  const contagem = new Map<number, number>();
  for (const interacao of interacoes) {
    if (interacao.tier == null) continue;
    contagem.set(interacao.tier, (contagem.get(interacao.tier) ?? 0) + 1);
  }

  return [...catalogo.dicionarios.relevancias]
    .sort((a, b) => a.ordem - b.ordem)
    .map((nivel, indice) => ({
      chave: String(nivel.id),
      rotulo: nivel.nome,
      total: contagem.get(nivel.id) ?? 0,
      cor: PALETA_DO_PAINEL[indice % PALETA_DO_PAINEL.length],
    }));
}

/** O top instituições de CADA tier, à parte — é o que a rosca mostra no
 *  tooltip ao passar o mouse numa fatia, sem esperar o clique (que troca o
 *  recorte inteiro). Uma chave por tier presente neste recorte; tier sem
 *  nenhuma interação simplesmente não entra no mapa. */
export function topInstituicoesPorTier(
  interacoes: Interacao[],
  catalogo: Catalogo,
  quantos = 5,
): Record<string, ItemContado[]> {
  const porTierLocal = new Map<number, Interacao[]>();
  for (const interacao of interacoes) {
    if (interacao.tier == null) continue;
    const lista = porTierLocal.get(interacao.tier) ?? [];
    lista.push(interacao);
    porTierLocal.set(interacao.tier, lista);
  }

  const resultado: Record<string, ItemContado[]> = {};
  for (const [tier, lista] of porTierLocal.entries()) {
    resultado[String(tier)] = ranking(lista, catalogo, 'entidade', quantos);
  }
  return resultado;
}

/** As áreas internas mais presentes — MULTIVALORADO, como `temasMaisRecorrentes`:
 *  uma interação com duas áreas soma nas duas, e não escolhe uma.
 *
 *  `cor` vem de `corDaArea` — a mesma da fatia da rosca para aquela área,
 *  fixa no cadastro, para o ranking de temas ao lado repetir a cor da área
 *  a que o tema mais se liga. */
export function porArea(
  interacoes: Interacao[],
  catalogo: Catalogo,
  quantos = 5,
): ItemContado[] {
  const contagem = new Map<number, number>();
  for (const interacao of interacoes) {
    for (const areaId of interacao.areas) {
      contagem.set(areaId, (contagem.get(areaId) ?? 0) + 1);
    }
  }

  const nomePorId = new Map(catalogo.dicionarios.areas_pessoa.map((a) => [a.id, a.nome]));

  return [...contagem.entries()]
    .map(([id, total]) => ({ chave: String(id), rotulo: nomePorId.get(id) ?? String(id), total }))
    .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
    .slice(0, quantos)
    .map((item) => ({ ...item, cor: corDaArea(catalogo, Number(item.chave)) }));
}

export interface ClimaDaArea {
  propositivo: number;
  neutro: number;
  tenso: number;
}

/** A quebra de clima de cada área — o que o tooltip de "Volume por área"
 *  mostra ao passar o mouse. MULTIVALORADO como `porArea`: uma interação com
 *  duas áreas soma clima nas duas. Sem clima registrado não entra em
 *  nenhuma das três contagens, mesmo critério de `scorePorTema`. */
export function climaPorArea(
  interacoes: Interacao[],
  catalogo: Catalogo,
): Record<string, ClimaDaArea> {
  const contagem: Record<string, ClimaDaArea> = {};

  for (const interacao of interacoes) {
    if (!interacao.clima) continue;
    for (const areaId of interacao.areas) {
      const chave = String(areaId);
      const atual = contagem[chave] ?? { propositivo: 0, neutro: 0, tenso: 0 };
      if (interacao.clima === 'propositivo') atual.propositivo += 1;
      else if (interacao.clima === 'neutro') atual.neutro += 1;
      else if (interacao.clima === 'tenso') atual.tenso += 1;
      contagem[chave] = atual;
    }
  }

  // Mantém as áreas sem clima nenhum no mapa, com zeros — evita `undefined`
  // em quem consulta uma área que existe em `porArea` mas ainda não tem
  // nenhuma interação com clima registrado.
  for (const area of catalogo.dicionarios.areas_pessoa) {
    const chave = String(area.id);
    if (!contagem[chave]) contagem[chave] = { propositivo: 0, neutro: 0, tenso: 0 };
  }

  return contagem;
}

export interface ScoreDeInstituicao {
  chave: string;
  rotulo: string;
  total: number;
  positivas: number;
  negativas: number;
  score: number;
}

/** O placar de clima por instituição ("público"): só quem tem clima
 *  registrado entra na conta, o score é (proativas − reativas) ÷ total em
 *  pontos de −100 a 100. Os `quantos` com MAIS interações entram primeiro —
 *  e a ordem final é a mesma, da maior para a menor quantidade: é "com quem
 *  falamos mais, e como está indo", não um ranking de pior para melhor
 *  score (esse já existe em `scorePorTema`/`scorePorArea`). */
export function scorePorInstituicao(
  interacoes: Interacao[],
  catalogo: Catalogo,
  quantos = 5,
): ScoreDeInstituicao[] {
  const contagem = new Map<string, { total: number; positivas: number; negativas: number }>();

  for (const interacao of interacoes) {
    if (!interacao.clima) continue;
    const nome = nomeDaInstituicao(catalogo, interacao.instituicao_id);
    if (nome === '—') continue;
    const atual = contagem.get(nome) ?? { total: 0, positivas: 0, negativas: 0 };
    atual.total += 1;
    if (interacao.clima === 'propositivo') atual.positivas += 1;
    if (interacao.clima === 'tenso') atual.negativas += 1;
    contagem.set(nome, atual);
  }

  const todos: ScoreDeInstituicao[] = [...contagem.entries()].map(([nome, c]) => ({
    chave: nome,
    rotulo: nome,
    total: c.total,
    positivas: c.positivas,
    negativas: c.negativas,
    score: Math.round(((c.positivas - c.negativas) / c.total) * 100),
  }));

  return todos
    .sort((a, b) => b.total - a.total)
    .slice(0, quantos);
}

/* -- séries mensais ------------------------------------------------------- */

export interface Segmento {
  chave: string;
  rotulo: string;
  cor: string;
  total: number;
}

export interface ColunaMensal {
  /** A chave do período agrupado — "2026-05" quando `granularidade` é `mes`
   *  (o caso original, e o único que `RaioXDaExcecao` usa), mas também
   *  "2026-05-04" (segunda-feira da semana) ou "2026-S1" quando é `semana` ou
   *  `semestre`. O campo continua `mes` de propósito: renomeá-lo obrigaria a
   *  mudar `BarrasEmpilhadas` e `RaioXDaExcecao` também, e nenhum dos dois
   *  precisa saber COMO a chave foi montada — só que ela ordena por
   *  `localeCompare` e que existe um rótulo pronto para exibir por cima dela. */
  mes: string;
  total: number;
  segmentos: Segmento[];
}

export type Granularidade = 'semana' | 'mes' | 'semestre';

/** Exportada para quem precisa saber a QUE período uma data pertence depois
 *  que a coluna já existe — ex.: `Painel` filtrando as interações de uma
 *  coluna do gráfico para o tooltip. Reusar esta função em vez de comparar
 *  `data_interacao.startsWith(coluna.mes)` é o que faz o filtro funcionar
 *  também em semana e semestre, onde a chave não é um prefixo da data. */
export function chaveDoPeriodo(iso: string, granularidade: Granularidade): string {
  if (granularidade === 'semana') return chaveDaSemana(iso);
  if (granularidade === 'semestre') return chaveDoSemestre(iso);
  return chaveDoMes(iso);
}

/** Série empilhada por período. `categorias` define a ordem e as cores da
 *  pilha; `categoriasDe` diz a que categorias cada interação pertence — uma
 *  só, no caso de frente e clima, várias no caso de tema.
 *
 *  `granularidade` default `'mes'` DE PROPÓSITO: é o único valor que
 *  `RaioXDaExcecao` conhece, e assim a chamada de três argumentos que ele já
 *  faz continua se comportando exatamente como antes. */
export function serieMensal(
  interacoes: Interacao[],
  categorias: { chave: string; rotulo: string; cor: string }[],
  categoriasDe: (interacao: Interacao) => string[],
  granularidade: Granularidade = 'mes',
): ColunaMensal[] {
  const periodos = new Map<string, Map<string, number>>();

  for (const interacao of interacoes) {
    const periodo = chaveDoPeriodo(interacao.data_interacao, granularidade);
    if (!periodos.has(periodo)) periodos.set(periodo, new Map());
    const contagem = periodos.get(periodo)!;
    for (const categoria of categoriasDe(interacao)) {
      contagem.set(categoria, (contagem.get(categoria) ?? 0) + 1);
    }
  }

  return [...periodos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, contagem]) => {
      const segmentos = categorias
        .map((categoria) => ({ ...categoria, total: contagem.get(categoria.chave) ?? 0 }))
        .filter((segmento) => segmento.total > 0);
      return {
        mes,
        // Em temas o total é a soma das ocorrências de tag, não de registros:
        // uma interação com três temas conta três vezes na pilha.
        total: segmentos.reduce((soma, s) => soma + s.total, 0),
        segmentos,
      };
    });
}

/** Quantos passos de `granularidade` separam duas chaves — "2" entre dois
 *  meses vizinhos, "0" para a mesma chave. Mesma conta de passo que os três
 *  laços de `completarPeriodos` já fazem; existe em separado só para medir a
 *  distância sem precisar percorrê-la. */
function distanciaEntrePeriodos(a: string, b: string, granularidade: Granularidade): number {
  if (granularidade === 'semana') {
    const milissegundosPorSemana = 7 * 24 * 60 * 60 * 1000;
    return Math.round(
      (new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) /
        milissegundosPorSemana,
    );
  }
  if (granularidade === 'semestre') {
    const [anoA, semestreA] = a.split('-S').map(Number);
    const [anoB, semestreB] = b.split('-S').map(Number);
    return (anoB - anoA) * 2 + (semestreB - semestreA);
  }
  const [anoA, mesA] = a.split('-').map(Number);
  const [anoB, mesB] = b.split('-').map(Number);
  return (anoB - anoA) * 12 + (mesB - mesA);
}

//: Em períodos (meses, semanas ou semestres — o que a granularidade atual
//: usa), não em tempo absoluto. Três parece pouco para "isto é um outlier",
//: mas o objetivo não é detectar outlier em geral — é impedir que um vão maior
//: que isto force o eixo inteiro a se esticar para trás. Ajustar aqui é ajustar
//: só o quão longe um buraco pode ir antes de a coluna do outro lado dele
//: deixar de entrar no preenchimento.
const LIMITE_DE_VAO_ANTES_DE_CORTAR = 3;

/** Descarta colunas isoladas do INÍCIO da série quando o vão até a próxima
 *  coluna com dado é maior que `LIMITE_DE_VAO_ANTES_DE_CORTAR` períodos.
 *
 *  SEM ISTO, um único registro muito antigo — um lançamento retroativo, um
 *  dado de teste fora da janela normal — vira o primeiro ponto da série, e
 *  `completarPeriodos` preenche cada período vazio entre ele e o resto: dezenas
 *  de colunas zeradas empurrando os dados de verdade para uma faixa estreita à
 *  direita. O registro em si não é descartado — ele continua contando nos
 *  KPIs e em qualquer tela que não seja este gráfico; só não força o eixo
 *  deste componente a se esticar até ele.
 *
 *  Só corta do INÍCIO, e um de cada vez: um vão grande no MEIO ou no FIM da
 *  série continua sendo preenchido normalmente — é o comportamento que já
 *  existia, e que faz sentido para atividade que para e recomeça dentro do
 *  período em curso. */
function cortarVaoInicial(
  colunas: ColunaMensal[],
  granularidade: Granularidade,
): ColunaMensal[] {
  let inicio = 0;
  while (
    inicio < colunas.length - 1 &&
    distanciaEntrePeriodos(colunas[inicio].mes, colunas[inicio + 1].mes, granularidade) >
      LIMITE_DE_VAO_ANTES_DE_CORTAR
  ) {
    inicio += 1;
  }
  return colunas.slice(inicio);
}

/** Preenche períodos sem registro, para o eixo não pular buracos — em
 *  qualquer granularidade, cada uma com sua própria forma de "andar um passo"
 *  entre a primeira e a última chave. */
export function completarPeriodos(
  colunas: ColunaMensal[],
  granularidade: Granularidade = 'mes',
): ColunaMensal[] {
  if (colunas.length < 2) return colunas;

  const porChave = new Map(colunas.map((c) => [c.mes, c]));
  const [primeira] = cortarVaoInicial(colunas, granularidade);
  const ultima = colunas[colunas.length - 1];
  const vazia = (chave: string): ColunaMensal => ({ mes: chave, total: 0, segmentos: [] });
  const completas: ColunaMensal[] = [];

  if (granularidade === 'semana') {
    const cursor = new Date(`${primeira.mes}T00:00:00`);
    const fim = new Date(`${ultima.mes}T00:00:00`);
    while (cursor <= fim) {
      const chave = cursor.toISOString().slice(0, 10);
      completas.push(porChave.get(chave) ?? vazia(chave));
      cursor.setDate(cursor.getDate() + 7);
    }
    return completas;
  }

  if (granularidade === 'semestre') {
    let [ano, semestre] = primeira.mes.split('-S').map(Number);
    const [anoFim, semestreFim] = ultima.mes.split('-S').map(Number);
    while (ano < anoFim || (ano === anoFim && semestre <= semestreFim)) {
      const chave = `${ano}-S${semestre}`;
      completas.push(porChave.get(chave) ?? vazia(chave));
      semestre += 1;
      if (semestre > 2) {
        semestre = 1;
        ano += 1;
      }
    }
    return completas;
  }

  const cursor = new Date(`${primeira.mes}-01T00:00:00`);
  const fim = new Date(`${ultima.mes}-01T00:00:00`);
  while (cursor <= fim) {
    const chave = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    completas.push(porChave.get(chave) ?? vazia(chave));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return completas;
}

/** Nome antigo, só para `mes` — `RaioXDaExcecao` chama assim, e não precisa
 *  saber que a função por baixo hoje aceita outras granularidades. */
export function completarMeses(colunas: ColunaMensal[]): ColunaMensal[] {
  return completarPeriodos(colunas, 'mes');
}

/** Os temas mais recorrentes do recorte, já com a contagem.
 *
 *  Serve tanto como categorias da série empilhada quanto como ranking, e por
 *  isso devolve `total`: jogar a contagem fora obrigaria quem monta o ranking a
 *  recontar, e duas contagens da mesma base são duas chances de divergir. */
/** Os temas mais recorrentes do recorte, já com a contagem.
 *
 *  Serve tanto como categorias da série empilhada quanto como ranking, e por
 *  isso devolve `total`: jogar a contagem fora obrigaria quem monta o ranking a
 *  recontar, e duas contagens da mesma base são duas chances de divergir.
 *
 *  A COR É A DA ÁREA DOMINANTE do tema neste recorte — a área que mais aparece
 *  nas agendas que carregam aquele tema —, a mesma de `corDaArea` / da rosca
 *  de "Interações por áreas". Sem área registrada, cai no cinza 1. */
export function temasMaisRecorrentes(
  interacoes: Interacao[],
  catalogo: Catalogo,
  quantos = 5,
): { chave: string; rotulo: string; cor: string; total: number }[] {
  const contagem = new Map<string, number>();
  const votosPorTema = new Map<string, Map<number, number>>();

  for (const interacao of interacoes) {
    for (const nome of nomesDosTemas(catalogo, interacao.temas)) {
      contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
      if (!interacao.areas.length) continue;
      let votos = votosPorTema.get(nome);
      if (!votos) {
        votos = new Map();
        votosPorTema.set(nome, votos);
      }
      for (const areaId of interacao.areas) {
        votos.set(areaId, (votos.get(areaId) ?? 0) + 1);
      }
    }
  }

  function areaDominante(nome: string): number | null {
    const votos = votosPorTema.get(nome);
    if (!votos?.size) return null;
    let escolhida = Number.POSITIVE_INFINITY;
    let max = -1;
    for (const [areaId, n] of votos) {
      if (n > max || (n === max && areaId < escolhida)) {
        max = n;
        escolhida = areaId;
      }
    }
    return Number.isFinite(escolhida) ? escolhida : null;
  }

  return ordenarDecrescente(contagem)
    .slice(0, quantos)
    .map((item) => {
      const areaId = areaDominante(item.chave);
      return {
        chave: item.chave,
        rotulo: item.rotulo,
        total: item.total,
        cor: areaId != null ? corDaArea(catalogo, areaId) : PALETA_DE_AREAS[PALETA_DE_AREAS.length - 1],
      };
    });
}

/** Uma linha da lista que abre ao clicar num tema — só o que basta para
 *  reconhecer a agenda e navegar até ela; o resto mora na própria Ficha. */
export interface AgendaDoTema {
  id: string;
  titulo: string;
  data: string;
  clima: string;
}

/** Uma linha de placar de clima — por tema, por área, por qualquer dimensão
 *  que se queira somar positivas/negativas e mostrar numa `BarraDivergente`.
 *  Nasceu como "ScoreDeTema"; o nome mudou quando área passou a usar o mesmo
 *  formato, mas o cálculo é o mesmo de sempre. */
export interface ScoreDivergente {
  chave: string;
  rotulo: string;
  /** Só conta quem tem `clima` registrado — é o denominador do score, e
   *  "8 agendas" ao lado de um score calculado sobre 8 é o que faz o número
   *  fazer sentido. Uma agenda sem clima registrado não entra em lugar
   *  nenhum desta conta, nem no total. */
  total: number;
  positivas: number;
  negativas: number;
  /** (positivas − negativas) ÷ total, em pontos de −100 a 100. POR
   *  OCORRÊNCIA: cada agenda vale um voto, nunca um peso — é a versão mais
   *  barata de calcular (só precisa do clima já registrado) e a mais fácil
   *  de explicar em uma reunião. Uma versão ponderada por tier ou por
   *  recência é conversa para depois que isto provar que serve. */
  score: number;
  /** AS MESMAS agendas que compõem `total` — nunca um recálculo à parte, ou
   *  as duas listas divergem no primeiro filtro novo que uma delas esquecer. */
  agendas: AgendaDoTema[];
}

export interface ScorePorTema {
  itens: ScoreDivergente[];
  /** Quantos temas TINHAM clima suficiente para entrar na conta, antes do
   *  corte de `quantos` — sem isto, a tela não tem como dizer "isto é um
   *  recorte" quando de fato é um. `itens.length < totalDeTemas` é
   *  exatamente a pergunta "sobrou alguém de fora?". */
  totalDeTemas: number;
  /** TODOS os temas com clima registrado, do mais discutido ao menos — não só
   *  os que entraram em `itens`. É desta lista que a tela monta "adicionar
   *  outro tema": sem ela, não haveria como oferecer um tema que ficou de
   *  fora do corte por `quantos` sem recalcular tudo de novo na tela. */
  todos: ScoreDivergente[];
}

/** O tema em palavras já existe (`temasMaisRecorrentes`); o que faltava era
 *  a MESMA contagem separada por clima, para responder "este tema está indo
 *  bem ou mal", não só "quanto se fala dele".
 *
 *  Os `quantos` mais discutidos entram primeiro — um tema com uma agenda só
 *  não deveria disputar o topo do "pior" com um que tem quinze —, e SÓ DEPOIS
 *  a ordenação vira a do score: pior primeiro, porque é a leitura de uma
 *  reunião de diretoria, e quem abre a tela quer ver onde dói antes de ver
 *  onde vai bem.
 *
 *  `temasForcados` ACRESCENTA à lista de `quantos`, e não substitui um deles —
 *  é o que faz o botão "adicionar outro tema" da tela mostrar de fato mais um
 *  tema, em vez de trocar um dos mais discutidos pelo escolhido. Um tema
 *  forçado que já estaria entre os `quantos` por volume não duplica: some da
 *  lista por volume e sobra uma vaga para o próximo. */
export function scorePorTema(
  interacoes: Interacao[],
  catalogo: Catalogo,
  quantos = 8,
  temasForcados: string[] = [],
): ScorePorTema {
  const contagem = new Map<
    string,
    { total: number; positivas: number; negativas: number; agendas: AgendaDoTema[] }
  >();

  for (const interacao of interacoes) {
    // SEM CLIMA REGISTRADO NÃO CONTA. Contar como neutro inventaria uma
    // opinião que ninguém registrou — e infla o total sem mexer no score,
    // fazendo um tema parecer mais "morno" do que os dados de verdade dizem.
    if (!interacao.clima) continue;

    for (const nome of nomesDosTemas(catalogo, interacao.temas)) {
      const atual = contagem.get(nome) ?? {
        total: 0,
        positivas: 0,
        negativas: 0,
        agendas: [],
      };
      atual.total += 1;
      if (interacao.clima === 'propositivo') atual.positivas += 1;
      if (interacao.clima === 'tenso') atual.negativas += 1;
      atual.agendas.push({
        id: interacao.id,
        titulo: tituloDaAgenda(interacao, (ids) => nomesDosTemas(catalogo, ids)),
        data: interacao.data_interacao,
        clima: interacao.clima,
      });
      contagem.set(nome, atual);
    }
  }

  const todos: ScoreDivergente[] = [...contagem.entries()].map(([nome, c]) => ({
    chave: nome,
    rotulo: nome,
    total: c.total,
    positivas: c.positivas,
    negativas: c.negativas,
    score: Math.round(((c.positivas - c.negativas) / c.total) * 100),
    agendas: c.agendas,
  }));

  const porVolume = [...todos].sort((a, b) => b.total - a.total);

  const forcadosSet = new Set(temasForcados);
  const forcados = porVolume.filter((tema) => forcadosSet.has(tema.chave));
  const resto = porVolume.filter((tema) => !forcadosSet.has(tema.chave));

  const itens = [...forcados, ...resto.slice(0, quantos)].sort((a, b) => a.score - b.score);

  return { itens, totalDeTemas: todos.length, todos: porVolume };
}

/** O placar de clima de cada área interna — SEMPRE as 5 de
 *  `catalogo.dicionarios.areas_pessoa`, mesmo a que ainda não tem nenhuma
 *  agenda vinculada. Diferente de `scorePorTema`: área é um dicionário
 *  fixo e pequeno (5 hoje), então não há corte por volume nem "forçar mais
 *  uma" — é um termômetro das 5, não um ranking recortado.
 *
 *  `interacao.areas ?? []`: durante a transição para este vínculo (backend
 *  sem a feature publicada, ou dado anterior à migration que criou
 *  `interacao_area`), o campo pode nem vir no payload. Uma interação sem
 *  área (ou com `areas` ausente) simplesmente não entra em nenhum balde —
 *  não conta a mais em área nenhuma, e não quebra a conta. */
export function scorePorArea(interacoes: Interacao[], catalogo: Catalogo): ScoreDivergente[] {
  const contagem = new Map<
    number,
    { total: number; positivas: number; negativas: number; agendas: AgendaDoTema[] }
  >();

  for (const interacao of interacoes) {
    // Mesmo critério de scorePorTema: sem clima registrado não entra em
    // lugar nenhum desta conta, nem no total.
    if (!interacao.clima) continue;

    for (const areaId of interacao.areas ?? []) {
      const atual = contagem.get(areaId) ?? {
        total: 0,
        positivas: 0,
        negativas: 0,
        agendas: [],
      };
      atual.total += 1;
      if (interacao.clima === 'propositivo') atual.positivas += 1;
      if (interacao.clima === 'tenso') atual.negativas += 1;
      atual.agendas.push({
        id: interacao.id,
        titulo: tituloDaAgenda(interacao, (ids) => nomesDosTemas(catalogo, ids)),
        data: interacao.data_interacao,
        clima: interacao.clima,
      });
      contagem.set(areaId, atual);
    }
  }

  return catalogo.dicionarios.areas_pessoa
    .map((area) => {
      const c = contagem.get(area.id) ?? { total: 0, positivas: 0, negativas: 0, agendas: [] };
      return {
        chave: String(area.id),
        rotulo: area.nome,
        total: c.total,
        positivas: c.positivas,
        negativas: c.negativas,
        // Guarda contra divisão por zero: área sem nenhuma agenda com clima
        // fica em 0 (o centro do trilho), não em erro nem em NaN.
        score: c.total ? Math.round(((c.positivas - c.negativas) / c.total) * 100) : 0,
        agendas: c.agendas,
      };
    })
    .sort((a, b) => a.score - b.score);
}

/* -- geografia ------------------------------------------------------------ */

export interface PontoNoMapa {
  uf: string;
  total: number;
}

export function distribuicaoPorUf(interacoes: Interacao[]): PontoNoMapa[] {
  // 'NA' (nacional) e 'IN' (internacional) não têm capital: entram no ranking
  // ao lado, nunca como bolha no mapa.
  const contagem = contar(interacoes, (i) => i.uf);
  return [...contagem.entries()]
    .map(([uf, total]) => ({ uf, total }))
    .sort((a, b) => b.total - a.total);
}

/* -- rankings ------------------------------------------------------------- */

export type DimensaoDeRanking =
  | 'entidade'
  | 'pessoa'
  | 'unidade'
  | 'esfera'
  | 'uf'
  | 'tag'
  | 'status'
  | 'frente';

export function ranking(
  interacoes: Interacao[],
  catalogo: Catalogo,
  dimensao: DimensaoDeRanking,
  limite = 8,
): ItemContado[] {
  const contagem = new Map<string, number>();
  const somar = (chave: string) => contagem.set(chave, (contagem.get(chave) ?? 0) + 1);

  for (const interacao of interacoes) {
    switch (dimensao) {
      case 'entidade':
        somar(nomeDaInstituicao(catalogo, interacao.instituicao_id));
        break;
      case 'pessoa': {
        const nome = nomeDoInterlocutor(catalogo, interacao.interlocutor_id);
        if (nome !== '—') somar(nome);
        break;
      }
      case 'unidade': {
        const nome = nomeDaUnidade(catalogo, interacao.unidade_negocio_id);
        if (nome !== '—') somar(nome);
        break;
      }
      case 'esfera': {
        const nome = nomeDaEsfera(catalogo, interacao.esfera_id);
        if (nome !== '—') somar(nome);
        break;
      }
      case 'uf':
        somar(interacao.uf);
        break;
      case 'tag':
        for (const tema of nomesDosTemas(catalogo, interacao.temas)) somar(tema);
        break;
      case 'status':
        somar(rotuloDeCodigo(catalogo, 'status', interacao.status));
        break;
      case 'frente':
        somar(interacao.frente);
        break;
    }
  }

  return ordenarDecrescente(contagem).slice(0, limite);
}

/* -- status e resolutividade ---------------------------------------------- */

export interface GrupoDeResolucao {
  grupo: GrupoDeStatus;
  total: number;
  percentual: number;
  statusQueCompoem: { codigo: string; nome: string; total: number }[];
}

export interface Resolutividade {
  taxa: number;
  grupos: GrupoDeResolucao[];
  porFrente: {
    frente: Frente;
    total: number;
    /** Total da frente menos os declinados — o mesmo critério da taxa geral. */
    denominador: number;
    resolvidos: number;
    taxa: number;
  }[];
}

export function resolutividade(interacoes: Interacao[], catalogo: Catalogo): Resolutividade {
  const grupos: GrupoDeStatus[] = ['resolvido', 'aberto', 'declinado'];
  const total = interacoes.length;

  const porGrupo = grupos.map((grupo) => {
    const doGrupo = interacoes.filter((i) => grupoDoStatus(catalogo, i.status) === grupo);
    const contagemPorStatus = contar(doGrupo, (i) => i.status);

    return {
      grupo,
      total: doGrupo.length,
      percentual: total ? doGrupo.length / total : 0,
      statusQueCompoem: [...contagemPorStatus.entries()]
        .map(([codigo, quantos]) => ({
          codigo,
          nome: rotuloDeCodigo(catalogo, 'status', codigo),
          total: quantos,
        }))
        .sort((a, b) => b.total - a.total),
    };
  });

  const resolvidos = porGrupo.find((g) => g.grupo === 'resolvido')?.total ?? 0;

  // A taxa exclui os declinados do denominador: recusar uma demanda não é
  // deixá-la pendente, e contá-la como não resolvida distorceria o indicador.
  const declinados = porGrupo.find((g) => g.grupo === 'declinado')?.total ?? 0;
  const denominador = total - declinados;

  const frentes = [...new Set(interacoes.map((i) => i.frente))];

  return {
    taxa: denominador ? resolvidos / denominador : 0,
    grupos: porGrupo,
    porFrente: frentes
      .map((frente) => {
        const daFrente = interacoes.filter((i) => i.frente === frente);
        const resolvidosDaFrente = daFrente.filter(
          (i) => grupoDoStatus(catalogo, i.status) === 'resolvido',
        ).length;
        // Mesmo denominador da taxa geral: sem os declinados. Usar o total da
        // frente aqui faria a barra contradizer o número grande da tela.
        const declinadosDaFrente = daFrente.filter(
          (i) => grupoDoStatus(catalogo, i.status) === 'declinado',
        ).length;
        const denominadorDaFrente = daFrente.length - declinadosDaFrente;

        return {
          frente,
          total: daFrente.length,
          denominador: denominadorDaFrente,
          resolvidos: resolvidosDaFrente,
          taxa: denominadorDaFrente ? resolvidosDaFrente / denominadorDaFrente : 0,
        };
      })
      .sort((a, b) => b.total - a.total),
  };
}

export interface ItemDaFila {
  interacao: Interacao;
  dias: number;
  risco: FaixaDeRisco;
}

export function filaDePendencias(
  interacoes: Interacao[],
  catalogo: Catalogo,
  hoje = new Date(),
): ItemDaFila[] {
  return interacoes
    .filter((i) => grupoDoStatus(catalogo, i.status) === 'aberto')
    .map((interacao) => {
      const dias = diasDesde(interacao.data_interacao, hoje);
      return { interacao, dias, risco: faixaDeRisco(dias) };
    })
    // Agenda futura ainda não está parada: dias negativos vão para o fim.
    .sort((a, b) => b.dias - a.dias);
}

/* -- resultado ------------------------------------------------------------ */

export interface Resultados {
  itens: ItemContado[];
  taxaDeAvanco: number;
  denominador: number;
  porFrente: {
    frente: Frente;
    total: number;
    /** Total da frente menos os sem definição — o mesmo critério da taxa geral. */
    denominador: number;
    avancou: number;
    taxa: number;
  }[];
  recuaram: number;
  semResultado: number;
}

export function resultados(interacoes: Interacao[], catalogo: Catalogo): Resultados {
  const cores: Record<string, string> = {
    avancou: '#17E3CB',
    mantido: '#0027BD',
    recuou: '#FF5C60',
    sem_definicao: '#D5DAEA',
  };

  const codigo = (i: Interacao) => i.resultado ?? 'sem_definicao';
  const contagem = contar(interacoes, codigo);

  const itens = catalogo.dicionarios.resultados.map((resultado) => ({
    chave: resultado.codigo,
    rotulo: resultado.nome,
    total: contagem.get(resultado.codigo) ?? 0,
    cor: cores[resultado.codigo] ?? 'var(--cinza-2)',
  }));

  const avancou = contagem.get('avancou') ?? 0;
  const semDefinicao = contagem.get('sem_definicao') ?? 0;

  // Denominador explícito: só entram os registros com desfecho informado.
  const denominador = interacoes.length - semDefinicao;
  const frentes = [...new Set(interacoes.map((i) => i.frente))];

  return {
    itens,
    taxaDeAvanco: denominador ? avancou / denominador : 0,
    denominador,
    porFrente: frentes
      .map((frente) => {
        const daFrente = interacoes.filter((i) => i.frente === frente);
        const avancouNaFrente = daFrente.filter((i) => i.resultado === 'avancou').length;
        // Mesmo denominador da taxa geral: só os registros com desfecho
        // informado. Incluir os sem definição puniria a frente por falta de
        // preenchimento, e não por resultado ruim.
        const semDefinicaoNaFrente = daFrente.filter(
          (i) => (i.resultado ?? 'sem_definicao') === 'sem_definicao',
        ).length;
        const denominadorDaFrente = daFrente.length - semDefinicaoNaFrente;

        return {
          frente,
          total: daFrente.length,
          denominador: denominadorDaFrente,
          avancou: avancouNaFrente,
          taxa: denominadorDaFrente ? avancouNaFrente / denominadorDaFrente : 0,
        };
      })
      .sort((a, b) => b.total - a.total),
    recuaram: contagem.get('recuou') ?? 0,
    semResultado: semDefinicao,
  };
}

/* -- porta-vozes ---------------------------------------------------------- */

export interface ExposicaoDePortaVoz {
  id: string;
  nome: string;
  cargo: string | null;
  total: number;
  porFrente: ItemContado[];
  temas: string[];
  ultimaAparicao: string | null;
  emTier1: number;
}

export interface Exposicao {
  /** Soma das aparições — maior que o número de registros quando há mais de um
   *  porta-voz na mesma interação. É este o denominador da concentração. */
  aparicoes: number;
  acionados: number;
  concentracaoNoPrimeiro: number;
  mediaPorPortaVoz: number;
  emTier1: number;
  pessoas: ExposicaoDePortaVoz[];
}

export function exposicaoDePortaVozes(
  interacoes: Interacao[],
  catalogo: Catalogo,
): Exposicao {
  const porPessoa = new Map<string, Interacao[]>();

  for (const interacao of interacoes) {
    for (const participacao of interacao.participacoes) {
      if (participacao.papel !== 'porta_voz') continue;
      const lista = porPessoa.get(participacao.pessoa_aegea_id) ?? [];
      lista.push(interacao);
      porPessoa.set(participacao.pessoa_aegea_id, lista);
    }
  }

  const pessoas: ExposicaoDePortaVoz[] = [...porPessoa.entries()]
    .map(([id, registros]) => {
      const cadastro = catalogo.pessoas.get(id);
      const temas = new Set<string>();
      for (const registro of registros) {
        for (const tema of nomesDosTemas(catalogo, registro.temas)) temas.add(tema);
      }
      const datas = registros.map((r) => r.data_interacao).sort();

      return {
        id,
        nome: cadastro?.nome ?? '—',
        cargo: cadastro?.cargo ?? null,
        total: registros.length,
        porFrente: ordenarDecrescente(contar(registros, (r) => r.frente)),
        temas: [...temas].sort((a, b) => a.localeCompare(b, 'pt-BR')),
        ultimaAparicao: datas.length ? datas[datas.length - 1] : null,
        emTier1: registros.filter((r) => r.tier === 1).length,
      };
    })
    .sort((a, b) => b.total - a.total);

  const aparicoes = pessoas.reduce((soma, p) => soma + p.total, 0);

  return {
    aparicoes,
    acionados: pessoas.length,
    concentracaoNoPrimeiro: aparicoes ? (pessoas[0]?.total ?? 0) / aparicoes : 0,
    mediaPorPortaVoz: pessoas.length ? aparicoes / pessoas.length : 0,
    emTier1: pessoas.reduce((soma, p) => soma + p.emTier1, 0),
    pessoas,
  };
}

/** O ranking por porta-voz do Painel — À PARTE de `ranking()` porque a
 *  chave PRECISA SER O ID (`pessoa_aegea_id`), não o nome: é assim que o
 *  filtro por porta-voz existe no backend (`recorte.porta_voz` compara
 *  contra o id da pessoa, diferente de `entidade`/`unidade`, que comparam
 *  contra o nome — ver `app/banco/filtros_sql.py::_teve_porta_voz`).
 *  Chavear pelo nome aqui faria o clique mandar um filtro que nunca bate
 *  com nenhum registro. */
export function rankingDePortaVozes(
  interacoes: Interacao[],
  catalogo: Catalogo,
  limite = 8,
): ItemContado[] {
  const contagem = new Map<string, number>();
  for (const interacao of interacoes) {
    // O registro conta para cada porta-voz: "Radamés e André" soma nos dois.
    for (const participacao of interacao.participacoes) {
      if (participacao.papel !== 'porta_voz') continue;
      const id = participacao.pessoa_aegea_id;
      contagem.set(id, (contagem.get(id) ?? 0) + 1);
    }
  }

  return [...contagem.entries()]
    .map(([id, total]) => ({ chave: id, rotulo: nomeDaPessoa(catalogo, id), total }))
    .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
    .slice(0, limite);
}

/** Os temas mais falados por CADA porta-voz — é o que o "Ranking por
 *  porta-voz" do Painel mostra no tooltip ao passar o mouse, sem esperar o
 *  clique. Chaveado pelo MESMO id de `rankingDePortaVozes`, e não pelo nome:
 *  o `chave` que o hover recebe é o que veio do ranking. */
export function temasPorPortaVoz(
  interacoes: Interacao[],
  catalogo: Catalogo,
  quantos = 3,
): Record<string, ItemContado[]> {
  const porPessoa = new Map<string, Interacao[]>();

  for (const interacao of interacoes) {
    for (const participacao of interacao.participacoes) {
      if (participacao.papel !== 'porta_voz') continue;
      const id = participacao.pessoa_aegea_id;
      const lista = porPessoa.get(id) ?? [];
      lista.push(interacao);
      porPessoa.set(id, lista);
    }
  }

  const resultado: Record<string, ItemContado[]> = {};
  for (const [id, registros] of porPessoa.entries()) {
    resultado[id] = temasMaisRecorrentes(registros, catalogo, quantos);
  }
  return resultado;
}

/** Fora do escopo: registro cujo tema não está entre os temas autorizados do
 *  porta-voz que o conduziu. Depende de `pessoa_aegea_tema`, que ainda não é
 *  exposto pela API — por isso a função recebe os temas autorizados de fora. */
export function aderenciaAoEscopo(
  exposicao: ExposicaoDePortaVoz,
  temasAutorizados: string[] | undefined,
): { dentro: number; fora: number; semCadastro: boolean } {
  if (!temasAutorizados?.length) {
    return { dentro: 0, fora: 0, semCadastro: true };
  }
  const autorizados = new Set(temasAutorizados);
  const dentro = exposicao.temas.filter((t) => autorizados.has(t)).length;
  return { dentro, fora: exposicao.temas.length - dentro, semCadastro: false };
}

/* -- interlocutores ------------------------------------------------------- */

export interface PanoramaDeInterlocutor {
  id: string;
  nome: string;
  instituicao: string;
  frente: Frente;
  ultima: string;
  total: number;
}

export function panoramaDeInterlocutores(
  interacoes: Interacao[],
  catalogo: Catalogo,
): PanoramaDeInterlocutor[] {
  const porPessoa = new Map<string, Interacao[]>();

  for (const interacao of interacoes) {
    if (!interacao.interlocutor_id) continue;
    const lista = porPessoa.get(interacao.interlocutor_id) ?? [];
    lista.push(interacao);
    porPessoa.set(interacao.interlocutor_id, lista);
  }

  return [...porPessoa.entries()]
    .map(([id, registros]) => {
      const datas = registros.map((r) => r.data_interacao).sort();
      const maisRecente = registros.reduce((a, b) =>
        a.data_interacao > b.data_interacao ? a : b,
      );
      return {
        id,
        nome: nomeDoInterlocutor(catalogo, id),
        instituicao: nomeDaInstituicao(catalogo, maisRecente.instituicao_id),
        frente: maisRecente.frente,
        ultima: datas[datas.length - 1],
        total: registros.length,
      };
    })
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/* -- comparativo entre períodos ------------------------------------------- */

export type Janela = 'semestre' | 'trimestre' | '90d';

export const ROTULOS_DE_JANELA: Record<Janela, string> = {
  semestre: 'Semestres',
  trimestre: 'Trimestres',
  '90d': 'Últimos 90 dias',
};

export interface Comparativo<T> {
  atual: T[];
  anterior: T[];
  inicioAtual: Date;
  inicioAnterior: Date;
}

/** Divide o conjunto em dois períodos consecutivos do mesmo tamanho. */
export function dividirEmJanelas(
  interacoes: Interacao[],
  janela: Janela,
  hoje = new Date(),
): Comparativo<Interacao> {
  const dias = { semestre: 182, trimestre: 91, '90d': 90 }[janela];

  const inicioAtual = new Date(hoje);
  inicioAtual.setDate(inicioAtual.getDate() - dias);
  const inicioAnterior = new Date(inicioAtual);
  inicioAnterior.setDate(inicioAnterior.getDate() - dias);

  const entre = (interacao: Interacao, de: Date, ate: Date) => {
    const data = new Date(`${interacao.data_interacao}T00:00:00`);
    return data >= de && data < ate;
  };

  return {
    atual: interacoes.filter((i) => entre(i, inicioAtual, hoje)),
    anterior: interacoes.filter((i) => entre(i, inicioAnterior, inicioAtual)),
    inicioAtual,
    inicioAnterior,
  };
}

/** Contatos que aparecem no período atual e não apareciam no anterior. */
export function novosContatos(comparativo: Comparativo<Interacao>): number {
  const antes = new Set(comparativo.anterior.map((i) => i.interlocutor_id).filter(Boolean));
  const agora = new Set(comparativo.atual.map((i) => i.interlocutor_id).filter(Boolean));
  return [...agora].filter((id) => !antes.has(id)).length;
}

export function semContatoNoPeriodo(comparativo: Comparativo<Interacao>): number {
  const antes = new Set(comparativo.anterior.map((i) => i.interlocutor_id).filter(Boolean));
  const agora = new Set(comparativo.atual.map((i) => i.interlocutor_id).filter(Boolean));
  return [...antes].filter((id) => !agora.has(id)).length;
}
