/** Os números por trás da "Síntese Executiva pela IA" do Painel.
 *
 *  ILUSTRATIVO DE PROPÓSITO: não existe agente nenhum ainda — isto é o texto
 *  que um agente PODERIA escrever, montado com os mesmos dados que o resto
 *  do Painel já deriva (`derivacoes.ts`), comparando uma JANELA (mês ou
 *  trimestre) com a janela imediatamente anterior a ela. Quando o agente
 *  entrar de verdade no backend, esta função sai e o componente passa a
 *  mostrar o texto que a API devolver — o contrato (`SinteseExecutivaIA`) é
 *  o que fica.
 *
 *  A JANELA É INDEPENDENTE DO RECORTE GLOBAL DE PERÍODO, de propósito: se
 *  esta caixa usasse o filtro de período da tela para isolar "só agosto", a
 *  comparação com o mês anterior quebraria — julho sairia do recorte junto.
 *  Por isso `gerarSinteseExecutivaIA` sempre recebe o recorte JÁ FILTRADO
 *  (`interacoes`, sem filtro de período aplicado pensando nesta caixa) e
 *  escolhe a janela por dentro, sobre os meses que já vieram na consulta.
 */

import type { Catalogo } from '@/dominio/derivacoes';
import { nomesDosTemas, porArea, ranking, temasMaisRecorrentes } from '@/dominio/derivacoes';
import { chaveDoMes, diasDesde, titulo as capitalizar, variacao } from '@/dominio/formato';
import type { Interacao } from '@/dominio/tipos';

const MESES_POR_EXTENSO = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function nomeDoMes(chave: string): string {
  const mes = Number(chave.slice(5, 7));
  return MESES_POR_EXTENSO[mes - 1];
}

/** `chave` ("YYYY-MM") deslocada `deltaMeses` para frente (ou para trás, com
 *  um delta negativo) — a mesma conta de calendário, não a posição de `chave`
 *  numa lista de meses disponíveis: mês passado é o mês de calendário
 *  anterior, exista ou não interação registrada nele. */
export function deslocarMes(chave: string, deltaMeses: number): string {
  const [ano, mes] = chave.split('-').map(Number);
  const data = new Date(ano, mes - 1 + deltaMeses, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

/** O último dia (de calendário) do mês de `chave` — o "hoje" que os alertas
 *  usam quando a janela escolhida é um fechamento do passado: perguntar "há
 *  quanto tempo sem interação" faz sentido em relação ao FIM da janela em
 *  análise, não em relação ao dia de hoje de verdade. */
function ultimoDiaDoMes(chave: string): Date {
  const [ano, mes] = chave.split('-').map(Number);
  return new Date(ano, mes, 0);
}

/** As `tamanho` chaves de mês que terminam em `referencia`, em ordem
 *  crescente — `['2026-07','2026-08','2026-09']` para `referencia='2026-09'`
 *  e `tamanho=3`. */
function mesesDaJanela(referencia: string, tamanho: number): string[] {
  return Array.from({ length: tamanho }, (_, i) => deslocarMes(referencia, -i)).reverse();
}

/** "Setembro" (tamanho 1) ou "jul–set" (tamanho 3, o intervalo da janela). */
function rotuloDaJanela(referencia: string, tamanho: number): string {
  if (tamanho === 1) return nomeDoMes(referencia);
  const primeiro = deslocarMes(referencia, -(tamanho - 1));
  return `${nomeDoMes(primeiro).slice(0, 3)}–${nomeDoMes(referencia).slice(0, 3)}`;
}

/** (proativas − reativas) ÷ interações com clima, em pontos de −100 a 100 —
 *  o MESMO cálculo de `scorePorTema`/`scorePorArea`, só que sobre uma lista
 *  qualquer em vez de agrupar por dimensão. */
function scoreDeClima(lista: Interacao[]): number {
  const comClima = lista.filter((i) => i.clima);
  if (!comClima.length) return 0;
  const positivas = comClima.filter((i) => i.clima === 'propositivo').length;
  const negativas = comClima.filter((i) => i.clima === 'tenso').length;
  return Math.round(((positivas - negativas) / comClima.length) * 100);
}

/** Todo mês ("YYYY-MM") com pelo menos uma interação no recorte, do mais
 *  recente ao mais antigo — a lista que alimenta o seletor "escolher um mês
 *  específico" da caixa. */
export function mesesDisponiveis(interacoes: Interacao[]): string[] {
  return [...new Set(interacoes.map((i) => chaveDoMes(i.data_interacao)))].sort((a, b) =>
    b.localeCompare(a),
  );
}

/** "Agosto de 2026" — rótulo com ano, para quando o mês por si só é
 *  ambíguo (o seletor lista meses de anos possivelmente diferentes). */
export function rotuloDoMesComAno(chave: string): string {
  return `${capitalizar(nomeDoMes(chave))} de ${chave.slice(0, 4)}`;
}

/** A janela que a caixa está analisando: `referencia` é o ÚLTIMO mês dela
 *  (o mês escolhido, ou o mês final do trimestre) e `tamanho` é 1 (mês) ou 3
 *  (trimestre, como os 3 meses terminando em `referencia`). */
export interface JanelaDaSinteseIA {
  referencia: string;
  tamanho: 1 | 3;
}

export interface SinteseExecutivaIA {
  /** Há uma janela anterior, com dado, para comparar — sem isto, as frases
   *  de variação ("X% acima de...") não têm com o que comparar e o
   *  componente as omite, mostrando só os números absolutos da janela. */
  temHistorico: boolean;
  mesAtual: string;
  mesAnterior: string;
  totalAtual: number;
  totalAnterior: number;
  variacaoTotal: string;
  tier1Atual: number;
  tier1Anterior: number;
  topInstituicoes: { nome: string; total: number }[];
  pctTopInstituicoes: number;
  areaDestaque: { nome: string; pct: number } | null;
  areaEmQueda: { nome: string; pctAtual: number; pctAnterior: number } | null;
  temaDestaque: { nome: string; pctAtual: number; pctAnterior: number } | null;
  scoreClimaAtual: number;
  scoreClimaAnterior: number;
  /** A área com o pior placar de clima até o FIM da janela em análise (não
   *  só dentro dela) — com um piso de 3 interações com clima para não
   *  acusar alerta em cima de amostra pequena demais. */
  areaAlerta: { nome: string; score: number; total: number } | null;
  /** Instituições que já tiveram alguma interação Tier 1 até o fim da
   *  janela e estão sem NENHUM registro, de qualquer tier, há mais de 90
   *  dias — contados a partir do ÚLTIMO DIA DA JANELA, não do dia de hoje:
   *  analisar o fechamento de um mês passado não deveria acusar alerta com
   *  base em interação que só aconteceu depois dele. */
  instituicoesTier1Inativas: string[];
  semTemaClassificado: { total: number; pct: number };
}

export function gerarSinteseExecutivaIA(
  interacoes: Interacao[],
  catalogo: Catalogo,
  janela?: JanelaDaSinteseIA,
): SinteseExecutivaIA | null {
  if (!interacoes.length) return null;

  const resolvida = janela ?? { referencia: mesesDisponiveis(interacoes)[0], tamanho: 1 as const };
  if (!resolvida.referencia) return null;
  const { referencia, tamanho } = resolvida;

  const chavesAtuais = new Set(mesesDaJanela(referencia, tamanho));
  const chavesAnteriores = new Set(mesesDaJanela(deslocarMes(referencia, -tamanho), tamanho));

  const atual = interacoes.filter((i) => chavesAtuais.has(chaveDoMes(i.data_interacao)));
  const anterior = interacoes.filter((i) => chavesAnteriores.has(chaveDoMes(i.data_interacao)));
  const temHistorico = anterior.length > 0;

  // SÓ O QUE JÁ TINHA ACONTECIDO até o fim da janela em análise — os
  // alertas (área em queda de clima, instituição inativa) não devem usar
  // dado que só existiu DEPOIS do fechamento sendo analisado.
  const ateOFimDaJanela = interacoes.filter((i) => chaveDoMes(i.data_interacao) <= referencia);
  const hojeDaAnalise = ultimoDiaDoMes(referencia);

  const topInstituicoes = ranking(atual, catalogo, 'entidade', 3).map((item) => ({
    nome: item.rotulo,
    total: item.total,
  }));
  const pctTopInstituicoes = atual.length
    ? Math.round((topInstituicoes.reduce((soma, i) => soma + i.total, 0) / atual.length) * 100)
    : 0;

  const totalDeAreas = catalogo.dicionarios.areas_pessoa.length;
  const areasDoMes = porArea(atual, catalogo, totalDeAreas);
  const areaDestaque =
    areasDoMes.length && atual.length
      ? { nome: areasDoMes[0].rotulo, pct: Math.round((areasDoMes[0].total / atual.length) * 100) }
      : null;

  let areaEmQueda: SinteseExecutivaIA['areaEmQueda'] = null;
  if (temHistorico) {
    const areasDoMesAnterior = porArea(anterior, catalogo, totalDeAreas);
    const pctPorNome = (lista: typeof areasDoMes, total: number) =>
      new Map(lista.map((item) => [item.rotulo, total ? (item.total / total) * 100 : 0]));
    const pctAtualPorArea = pctPorNome(areasDoMes, atual.length);
    const pctAnteriorPorArea = pctPorNome(areasDoMesAnterior, anterior.length);

    let piorQueda: { nome: string; pctAtual: number; pctAnterior: number; delta: number } | null = null;
    for (const area of catalogo.dicionarios.areas_pessoa) {
      const pctAtualArea = pctAtualPorArea.get(area.nome) ?? 0;
      const pctAnteriorArea = pctAnteriorPorArea.get(area.nome) ?? 0;
      const delta = pctAtualArea - pctAnteriorArea;
      if (pctAnteriorArea > 0 && (!piorQueda || delta < piorQueda.delta)) {
        piorQueda = {
          nome: area.nome,
          pctAtual: Math.round(pctAtualArea),
          pctAnterior: Math.round(pctAnteriorArea),
          delta,
        };
      }
    }
    if (piorQueda && piorQueda.delta < 0) areaEmQueda = piorQueda;
  }

  const [temaTopDoMes] = temasMaisRecorrentes(atual, catalogo, 1);
  let temaDestaque: SinteseExecutivaIA['temaDestaque'] = null;
  if (temaTopDoMes && atual.length) {
    const pctAtual = Math.round((temaTopDoMes.total / atual.length) * 100);
    const totalAnteriorDoTema = anterior.filter((i) =>
      nomesDosTemas(catalogo, i.temas).includes(temaTopDoMes.rotulo),
    ).length;
    const pctAnterior = anterior.length ? Math.round((totalAnteriorDoTema / anterior.length) * 100) : 0;
    temaDestaque = { nome: temaTopDoMes.rotulo, pctAtual, pctAnterior };
  }

  let areaAlerta: SinteseExecutivaIA['areaAlerta'] = null;
  for (const area of catalogo.dicionarios.areas_pessoa) {
    const doArea = ateOFimDaJanela.filter((i) => i.areas.includes(area.id) && i.clima);
    if (doArea.length < 3) continue;
    const score = scoreDeClima(doArea);
    if (score < 0 && (!areaAlerta || score < areaAlerta.score)) {
      areaAlerta = { nome: area.nome, score, total: doArea.length };
    }
  }

  const porInstituicao = new Map<string, Interacao[]>();
  for (const interacao of ateOFimDaJanela) {
    const lista = porInstituicao.get(interacao.instituicao_id) ?? [];
    lista.push(interacao);
    porInstituicao.set(interacao.instituicao_id, lista);
  }
  const instituicoesTier1Inativas: string[] = [];
  for (const [id, lista] of porInstituicao) {
    if (!lista.some((i) => i.tier === 1)) continue;
    const ultima = lista.reduce(
      (maisRecente, i) => (i.data_interacao > maisRecente ? i.data_interacao : maisRecente),
      lista[0].data_interacao,
    );
    if (diasDesde(ultima, hojeDaAnalise) > 90) {
      instituicoesTier1Inativas.push(catalogo.instituicoes.get(id)?.nome ?? id);
    }
  }

  const semTema = atual.filter((i) => i.temas.length === 0).length;

  return {
    temHistorico,
    mesAtual: capitalizar(rotuloDaJanela(referencia, tamanho)),
    mesAnterior: rotuloDaJanela(deslocarMes(referencia, -tamanho), tamanho),
    totalAtual: atual.length,
    totalAnterior: anterior.length,
    variacaoTotal: variacao(atual.length, anterior.length),
    tier1Atual: atual.filter((i) => i.tier === 1).length,
    tier1Anterior: anterior.filter((i) => i.tier === 1).length,
    topInstituicoes,
    pctTopInstituicoes,
    areaDestaque,
    areaEmQueda,
    temaDestaque,
    scoreClimaAtual: scoreDeClima(atual),
    scoreClimaAnterior: scoreDeClima(anterior),
    areaAlerta,
    instituicoesTier1Inativas,
    semTemaClassificado: {
      total: semTema,
      pct: atual.length ? Math.round((semTema / atual.length) * 100) : 0,
    },
  };
}
