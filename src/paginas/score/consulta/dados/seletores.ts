/** Seletores puros da Consulta em profundidade: navegabilidade, caminho do
 *  endereço, agrupamento das tabelas, escalas, lista de matérias e busca.
 *
 *  A PÁGINA NÃO CALCULA INDICADORES DE NEGÓCIO (spec C.1). Tudo aqui é de
 *  apresentação: em que nível a tela está, em que ordem as linhas aparecem,
 *  qual a escala das barras, o que a busca encontra. Números de nota e de
 *  impacto vêm prontos do JSON e só são somados para os rodapés de grupo.
 */

import { arred, fmtDataCurta, fmtInt } from '../formatacao';
import { escreverEndereco } from '../endereco';
import type { EnderecoDoDrill } from '../endereco';
import type { Dados, Item, Lente, No, Pilar, Sentimento, Subtema, Tema } from './tipos';

// ---------------------------------------------------------------------------
// Níveis e navegabilidade (C.3)
// ---------------------------------------------------------------------------

export type Nivel = 1 | 2 | 3 | 4;

export const NOMES_DOS_NIVEIS: Record<Nivel, string> = {
  1: 'Lente e pilares',
  2: 'Temas estratégicos',
  3: 'Subtemas',
  4: 'Matérias',
};

export function lenteDoDrill(dados: Dados, id: string): Lente | undefined {
  return dados.lentes.find((l) => l.id === id);
}

/** Prefixo dos NÓS DE FECHAMENTO que o back acrescenta com os dados reais
 *  (D5): 'sem-pilar', 'sem-tema' e 'sem-subtema' ("Sem pilar identificado"…).
 *  Entram como irmãos comuns, para Σ filhos = pai e Σ pilares fecharem com a
 *  nota, mas NUNCA são navegáveis nem entram na busca. O hífen não colide com
 *  os códigos da taxonomia, que usam '_'. */
const PREFIXO_DE_FECHAMENTO = 'sem-';

export function ehNoDeFechamento(no: { id: string }): boolean {
  return no.id.startsWith(PREFIXO_DE_FECHAMENTO);
}

/** O texto do selo quando a fonte é ilustrativa ou de exemplo. */
export const AVISO_DE_EXEMPLO = 'Dados de exemplo';

/** O texto do selo da consulta: o `meta.aviso` quando vem preenchido (a base
 *  ilustrativa) e, com ele vazio, "Dados de exemplo" quando o back diz que o
 *  mês do banco é de demonstração (`meta.origem === 'exemplo'`). Vazio só
 *  para a carga real: sem isto, os números de exemplo apareciam como reais.
 */
export function avisoDaConsulta(meta: Dados['meta']): string {
  if (meta.aviso.trim()) return meta.aviso;
  return meta.origem === 'exemplo' ? AVISO_DE_EXEMPLO : '';
}

/** A coluna da tabela de impacto: diz de que nível é a linha. */
export type ColunaDaTabela = 'Pilar' | 'Tema estratégico' | 'Subtema';

/** O `title` de uma linha que não abre o nível de baixo, PELO MOTIVO.
 *
 *  COM OS DADOS REAIS (D5) não há "carga completa" por vir: a linha não abre
 *  porque é um nó de fechamento (sem vínculo com a taxonomia), porque a lente
 *  ainda não desce além do Nível 1 (Mercado, D2), ou porque nenhuma matéria
 *  daquele item chegou ao nível de baixo. */
export function motivoSemDetalhamento(
  no: { id: string },
  coluna: ColunaDaTabela,
  lenteComDrill: boolean,
): string {
  if (ehNoDeFechamento(no)) return 'Sem vínculo com a taxonomia de temas';
  if (!lenteComDrill) return 'O detalhamento desta lente ainda não está disponível';
  if (coluna === 'Pilar') return 'Nenhuma matéria deste pilar tem tema identificado';
  if (coluna === 'Tema estratégico') return 'Nenhuma matéria deste tema tem subtema identificado';
  return 'Nenhuma matéria deste subtema no mês';
}

// A REGRA C.3 JÁ DEIXA OS NÓS DE FECHAMENTO SEM SETA, porque o back nunca lhes
// dá filhos, `nivel3` ou `nivel4`. A checagem explícita é a garantia de que
// um endereço `pilar=sem-pilar` ou um link da busca nunca abre um nível vazio,
// mesmo que a resposta venha diferente do contrato.
export function pilarNavegavel(lente: Lente, pilar: Pilar): boolean {
  return lente.drill && !ehNoDeFechamento(pilar) && (pilar.filhos?.length ?? 0) > 0;
}

export function temaNavegavel(tema: Tema): boolean {
  return !ehNoDeFechamento(tema) && (tema.filhos?.length ?? 0) > 0 && tema.nivel3 !== undefined;
}

export function subtemaNavegavel(subtema: Subtema): boolean {
  return !ehNoDeFechamento(subtema) && subtema.nivel4 !== undefined;
}

// ---------------------------------------------------------------------------
// Caminho a partir do endereço (D.2 adaptada)
// ---------------------------------------------------------------------------

export interface Caminho {
  lente: Lente;
  pilar?: Pilar;
  tema?: Tema;
  subtema?: Subtema;
  nivel: Nivel;
  /** Presente só quando o endereço não é o canônico do caminho resolvido: é
   *  o endereço para o qual a página faz `replace`. */
  corrigido?: EnderecoDoDrill;
}

const LENTE_PADRAO = 'imprensa';

/** Desce na árvore da lente parâmetro por parâmetro e para no primeiro id
 *  ausente, inexistente ou não navegável. */
function descer(lente: Lente, e: EnderecoDoDrill): Omit<Caminho, 'lente' | 'corrigido'> {
  const pilar = e.pilar ? lente.pilares.find((p) => p.id === e.pilar) : undefined;
  if (!pilar || !pilarNavegavel(lente, pilar)) return { nivel: 1 };

  const tema = e.tema ? pilar.filhos?.find((t) => t.id === e.tema) : undefined;
  if (!tema || !temaNavegavel(tema)) return { pilar, nivel: 2 };

  const subtema = e.subtema ? tema.filhos?.find((s) => s.id === e.subtema) : undefined;
  if (!subtema || !subtemaNavegavel(subtema)) return { pilar, tema, nivel: 3 };

  return { pilar, tema, subtema, nivel: 4 };
}

/** O endereço que descreve EXATAMENTE a tela do caminho: a lente resolvida,
 *  só os níveis alcançados e, no Nível 4, só os filtros que a lista daquele
 *  subtema consegue mostrar (`tier`, `conc` e `uf` entre as opções da amostra,
 *  `item` entre os itens dela). Fora do Nível 4 não há lista, então não há
 *  filtro. */
function enderecoCanonico(c: Omit<Caminho, 'corrigido'>, e: EnderecoDoDrill): EnderecoDoDrill {
  const canonico: EnderecoDoDrill = { ativo: true, lente: c.lente.id };
  if (c.pilar) canonico.pilar = c.pilar.id;
  if (c.tema) canonico.tema = c.tema.id;
  const itens = c.subtema?.nivel4?.itens;
  if (!c.subtema || !itens) return canonico;

  canonico.subtema = c.subtema.id;
  const opcoes = opcoesDaAmostra(itens);
  if (e.sent) canonico.sent = e.sent;
  if (e.ordem) canonico.ordem = e.ordem;
  if (e.tier && opcoes.tiers.includes(e.tier)) canonico.tier = e.tier;
  if (e.conc && opcoes.concessionarias.includes(e.conc)) canonico.conc = e.conc;
  if (e.uf && opcoes.ufs.includes(e.uf)) canonico.uf = e.uf;
  if (e.item && itens.some((i) => i.id === e.item)) canonico.item = e.item;
  return canonico;
}

/** Resolve o endereço em nós da árvore (D.2), com a LENTE VINDA DA ABA
 *  (decisão A4), não do endereço:
 *
 *  1. Lente inexistente usa `imprensa`.
 *  2. Desce parâmetro por parâmetro; no primeiro id inexistente ou não
 *     navegável (C.3), para no nível anterior.
 *  3. Se o endereço não é o canônico do caminho resolvido, devolve
 *     `corrigido` (decisão A20). Isso cobre o que a D.2 pede (parou antes do
 *     nível pedido) e também: `lente` do endereço diferente da lente
 *     resolvida (ou ausente), filtros da lista fora do Nível 4, `item` que não
 *     está na amostra do subtema e `tier`/`conc`/`uf` fora das opções dela.
 *     Sem isso, recarregar não reabriria a mesma tela (D.3) e um filtro velho
 *     sobreviveria à troca de subtema.
 *  4. Chave de nível sem a de cima (`tema` sem `pilar`) é descartada: a
 *     descida para no primeiro nível que falta.
 *  5. Lente com `drill: false` ignora `pilar`, `tema` e `subtema`, porque
 *     nenhum pilar dela é navegável.
 *
 *  Endereço inativo (sem o marcador) não é corrigido: abrir o bloco não
 *  escreve hash. */
export function resolverCaminho(dados: Dados, lenteId: string, e: EnderecoDoDrill): Caminho {
  const lente = lenteDoDrill(dados, lenteId) ?? lenteDoDrill(dados, LENTE_PADRAO);
  if (!lente) throw new Error(`resolverCaminho: a base não tem a lente "${LENTE_PADRAO}"`);

  if (!e.ativo) return { lente, nivel: 1 };

  const caminho: Caminho = { lente, ...descer(lente, e) };
  const canonico = enderecoCanonico(caminho, e);
  // COMPARAR PELA ESCRITA, e não campo a campo: `escreverEndereco` já omite
  // vazios e padrões (`sent=todas`, `ordem=impacto`), que não mudam a tela.
  if (escreverEndereco(canonico) !== escreverEndereco(e)) caminho.corrigido = canonico;
  return caminho;
}

// ---------------------------------------------------------------------------
// Tabela de impacto (E.4.2)
// ---------------------------------------------------------------------------

export interface GruposDeImpacto<T> {
  pressiona: T[];
  sustenta: T[];
  somaPressiona: number;
  somaSustenta: number;
}

function somaDeImpacto(nos: readonly No[]): number {
  return arred(
    nos.reduce((s, n) => s + n.impacto, 0),
    1,
  );
}

/** "O que pressiona": negativos, do mais negativo ao menos negativo.
 *  "O que sustenta": maiores ou iguais a zero, do maior ao menor (zero fica
 *  por último). Empates mantêm a ordem do JSON. Somas com 1 casa. */
export function agruparPorImpacto<T extends No>(nos: T[]): GruposDeImpacto<T> {
  const pressiona = nos.filter((n) => n.impacto < 0).sort((a, b) => a.impacto - b.impacto);
  const sustenta = nos.filter((n) => n.impacto >= 0).sort((a, b) => b.impacto - a.impacto);
  return {
    pressiona,
    sustenta,
    somaPressiona: somaDeImpacto(pressiona),
    somaSustenta: somaDeImpacto(sustenta),
  };
}

/** Uma escala para todas as barras da tabela: `max(|v|) × folga`. Tudo zero
 *  (ou nada) dá 1, para a barra nunca dividir por zero. */
export function escalaDeImpacto(valores: number[], folga = 1.05): number {
  const maximo = valores.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  return maximo === 0 ? 1 : maximo * folga;
}

/** Participação inteira: `round(volume ÷ total × 100)`. Total zero dá 0. */
export function participacao(volume: number, total: number): number {
  if (total <= 0) return 0;
  return arred((volume / total) * 100);
}

/** Média inteira (meio para cima). Lista vazia dá 0. */
export function mediaArredondada(valores: number[]): number {
  if (valores.length === 0) return 0;
  return arred(valores.reduce((s, v) => s + v, 0) / valores.length);
}

// ---------------------------------------------------------------------------
// Lista de matérias (F.9)
// ---------------------------------------------------------------------------

function porId(a: Item, b: Item): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function porData(a: Item, b: Item): number {
  return a.data < b.data ? -1 : a.data > b.data ? 1 : 0;
}

/** Devolve uma cópia ordenada.
 *  - `impacto`: |impacto| decrescente; empate, negativo antes de positivo;
 *    depois data crescente; depois id.
 *  - `data`: data decrescente; empate, |impacto| decrescente; depois id. */
export function ordenarItens(itens: Item[], ordem: 'impacto' | 'data'): Item[] {
  const copia = [...itens];
  if (ordem === 'impacto') {
    return copia.sort(
      (a, b) =>
        Math.abs(b.impacto) - Math.abs(a.impacto) ||
        Number(b.impacto < 0) - Number(a.impacto < 0) ||
        porData(a, b) ||
        porId(a, b),
    );
  }
  return copia.sort((a, b) => porData(b, a) || Math.abs(b.impacto) - Math.abs(a.impacto) || porId(a, b));
}

/** `Map`, e não objeto literal: num objeto, `'constructor'` ou `'toString'`
 *  achariam o protótipo e esvaziariam a lista em vez de não filtrar. */
const SENTIMENTO_DA_ABA: ReadonlyMap<string, Sentimento> = new Map([
  ['negativas', 'negativo'],
  ['neutras', 'neutro'],
  ['positivas', 'positivo'],
]);

/** Aba de sentimento e filtros `tier`, `conc` e `uf` combinados com E.
 *  `todas`, ausente ou valor desconhecido não filtram por sentimento. */
export function filtrarItens(
  itens: Item[],
  f: { sent?: string; tier?: string; conc?: string; uf?: string },
): Item[] {
  const sentimento = f.sent ? SENTIMENTO_DA_ABA.get(f.sent) : undefined;
  return itens.filter(
    (i) =>
      (!sentimento || i.sentimento === sentimento) &&
      (!f.tier || i.tier === f.tier) &&
      (!f.conc || i.concessionaria === f.conc) &&
      (!f.uf || i.uf === f.uf),
  );
}

function unicosOrdenados(valores: string[]): string[] {
  return [...new Set(valores)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Opções dos filtros da lista: só o que existe na amostra, em ordem
 *  alfabética (que também põe os tiers em ordem: Tier 1, 2, 3). */
export function opcoesDaAmostra(itens: Item[]): { tiers: string[]; concessionarias: string[]; ufs: string[] } {
  return {
    tiers: unicosOrdenados(itens.map((i) => i.tier)),
    concessionarias: unicosOrdenados(itens.map((i) => i.concessionaria)),
    ufs: unicosOrdenados(itens.map((i) => i.uf)),
  };
}

// ---------------------------------------------------------------------------
// Busca (E.9, sem o tipo "Lente" — decisão A15)
// ---------------------------------------------------------------------------

export type TipoDeResultado = 'Subtema' | 'Tema' | 'Pilar' | 'Matéria';

export interface ResultadoDeBusca {
  id: string;
  tipo: TipoDeResultado;
  nome: string;
  impacto?: number;
  caminho: string;
  destino: EnderecoDoDrill;
}

const ORDEM_DOS_TIPOS: readonly TipoDeResultado[] = ['Subtema', 'Tema', 'Pilar', 'Matéria'];
const MAXIMO_DE_RESULTADOS = 8;
const MAXIMO_DE_MATERIAS = 3;
const MINIMO_DE_CARACTERES = 2;
const SEPARADOR = ' › ';

/** Minúsculas, sem acento, espaços colapsados e sem espaço nas pontas. */
export function normalizarBusca(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Uma entrada do índice: o resultado exibido e os TEXTOS PESQUISÁVEIS, que
 *  ficam ao lado do resultado e não dentro dele, para o resultado manter a
 *  forma do contrato (a matéria é buscada em título, veículo, jornalista e
 *  concessionária, mas só o título aparece).
 *
 *  OS TEXTOS MORAM NO PRÓPRIO DADO, e não num `WeakMap` preso à identidade do
 *  objeto: uma cópia do índice (spread, `structuredClone`, HMR) continua
 *  encontrando a matéria pelo veículo. Vão crus, como estão na base;
 *  `buscarNoDrill` normaliza na hora (são poucas centenas de textos). */
export interface EntradaDoIndice {
  resultado: ResultadoDeBusca;
  textos: readonly string[];
}

export type IndiceDeBusca = readonly EntradaDoIndice[];

function indexar(indice: EntradaDoIndice[], resultado: ResultadoDeBusca, textos: string[]): void {
  indice.push({ resultado, textos });
}

function contagem(volume: number, unidade: string): string {
  return `${fmtInt(volume)} ${unidade}`;
}

/** Índice de busca das lentes com drill (na base, só a Imprensa). Os nós de
 *  fechamento ('sem-*') não entram, nem o que estiver abaixo deles. Destinos:
 *  - Pilar: Nível 2 (Nível 1 se o pilar não for navegável);
 *  - Tema: Nível 3 se navegável; senão, Nível 2 do pilar;
 *  - Subtema: Nível 4 se tiver `nivel4`; senão, Nível 3 do tema (ou Nível 2,
 *    se nem o tema for navegável);
 *  - Matéria: Nível 4 do subtema, com `item`. */
export function montarIndiceDeBusca(dados: Dados): IndiceDeBusca {
  const indice: EntradaDoIndice[] = [];

  for (const lente of dados.lentes) {
    if (!lente.drill) continue;
    const base: EnderecoDoDrill = { ativo: true, lente: lente.id };

    for (const pilar of lente.pilares) {
      if (ehNoDeFechamento(pilar)) continue;
      const noPilar: EnderecoDoDrill = pilarNavegavel(lente, pilar) ? { ...base, pilar: pilar.id } : base;
      indexar(
        indice,
        {
          id: `pilar:${pilar.id}`,
          tipo: 'Pilar',
          nome: pilar.nome,
          impacto: pilar.impacto,
          caminho: `${lente.nome} · ${contagem(pilar.volume, lente.unidade)}`,
          destino: noPilar,
        },
        [pilar.nome],
      );

      for (const tema of pilar.filhos ?? []) {
        if (ehNoDeFechamento(tema)) continue;
        const noTema: EnderecoDoDrill = temaNavegavel(tema) ? { ...noPilar, tema: tema.id } : noPilar;
        const acimaDoTema = [lente.nome, pilar.nome].join(SEPARADOR);
        indexar(
          indice,
          {
            id: `tema:${pilar.id}/${tema.id}`,
            tipo: 'Tema',
            nome: tema.nome,
            impacto: tema.impacto,
            caminho: `${acimaDoTema} · ${contagem(tema.volume, lente.unidade)}`,
            destino: noTema,
          },
          [tema.nome],
        );

        for (const subtema of tema.filhos ?? []) {
          if (ehNoDeFechamento(subtema)) continue;
          const noSubtema: EnderecoDoDrill =
            temaNavegavel(tema) && subtemaNavegavel(subtema) ? { ...noTema, subtema: subtema.id } : noTema;
          const acimaDoSubtema = [lente.nome, pilar.nome, tema.nome].join(SEPARADOR);
          indexar(
            indice,
            {
              id: `subtema:${pilar.id}/${tema.id}/${subtema.id}`,
              tipo: 'Subtema',
              nome: subtema.nome,
              impacto: subtema.impacto,
              caminho: `${acimaDoSubtema} · ${contagem(subtema.volume, lente.unidade)}`,
              destino: noSubtema,
            },
            [subtema.nome],
          );

          if (!subtema.nivel4 || noSubtema.subtema === undefined) continue;
          const acimaDaMateria = [lente.nome, pilar.nome, tema.nome, subtema.nome].join(SEPARADOR);
          for (const item of subtema.nivel4.itens) {
            indexar(
              indice,
              {
                id: `materia:${pilar.id}/${tema.id}/${subtema.id}/${item.id}`,
                tipo: 'Matéria',
                nome: item.titulo,
                impacto: item.impacto,
                caminho: `${acimaDaMateria} · ${item.veiculo} · ${fmtDataCurta(item.data)}`,
                destino: { ...noSubtema, item: item.id },
              },
              [item.titulo, item.veiculo, item.jornalista, item.concessionaria],
            );
          }
        }
      }
    }
  }
  return indice;
}

/** Busca no índice (E.9):
 *  - dispara com 2 caracteres ou mais (depois de normalizar);
 *  - cada palavra digitada precisa aparecer em algum campo pesquisável;
 *  - ordem por tipo: Subtema, Tema, Pilar, Matéria; dentro do tipo, primeiro
 *    quem começa com o termo (em qualquer campo), depois maior |impacto|;
 *    empate final mantém a ordem do índice;
 *  - no máximo 8 resultados, dos quais no máximo 3 matérias. */
export function buscarNoDrill(indice: IndiceDeBusca, termo: string): ResultadoDeBusca[] {
  const t = normalizarBusca(termo);
  if (t.length < MINIMO_DE_CARACTERES) return [];
  const palavras = t.split(' ');

  const achados = indice.flatMap(({ resultado: r, textos }, posicao) => {
    const campos = textos.map(normalizarBusca);
    const texto = campos.join(' ');
    if (!palavras.every((p) => texto.includes(p))) return [];
    return [{ r, posicao, comeca: campos.some((c) => c.startsWith(t)) }];
  });

  const ordenados = ORDEM_DOS_TIPOS.flatMap((tipo) => {
    const doTipo = achados
      .filter((a) => a.r.tipo === tipo)
      .sort(
        (a, b) =>
          Number(b.comeca) - Number(a.comeca) ||
          Math.abs(b.r.impacto ?? 0) - Math.abs(a.r.impacto ?? 0) ||
          a.posicao - b.posicao,
      )
      .map((a) => a.r);
    return tipo === 'Matéria' ? doTipo.slice(0, MAXIMO_DE_MATERIAS) : doTipo;
  });

  return ordenados.slice(0, MAXIMO_DE_RESULTADOS);
}
