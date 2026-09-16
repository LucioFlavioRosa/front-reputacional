/** Os números por trás da "Síntese Executiva pela IA" do Painel.
 *
 *  ILUSTRATIVO DE PROPÓSITO: não existe agente nenhum ainda — isto é o texto
 *  que um agente PODERIA escrever, montado com os mesmos dados que o resto
 *  do Painel já deriva (`derivacoes.ts`), comparando o mês mais recente do
 *  recorte com o mês anterior a ele. Quando o agente entrar de verdade no
 *  backend, esta função sai e o componente passa a mostrar o texto que a
 *  API devolver — o contrato (`SinteseExecutivaIA`) é o que fica.
 *
 *  MÊS MAIS RECENTE DO RECORTE, e não o mês corrente do calendário: o
 *  recorte pode estar filtrado por período, e "setembro" só faz sentido se
 *  for de fato o mês mais recente com dado dentro do filtro aplicado.
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

export interface SinteseExecutivaIA {
  /** Há um mês anterior, com dado, para comparar — sem isto, as frases de
   *  variação ("X% acima de...") não têm com o que comparar e o componente
   *  as omite, mostrando só os números absolutos do mês. */
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
  /** A área com o pior placar de clima no RECORTE INTEIRO (não só no mês) —
   *  com um piso de 3 interações com clima para não acusar alerta em cima de
   *  amostra pequena demais. */
  areaAlerta: { nome: string; score: number; total: number } | null;
  /** Instituições que já tiveram alguma interação Tier 1 neste recorte e
   *  estão sem NENHUM registro, de qualquer tier, há mais de 90 dias. */
  instituicoesTier1Inativas: string[];
  semTemaClassificado: { total: number; pct: number };
}

export function gerarSinteseExecutivaIA(
  interacoes: Interacao[],
  catalogo: Catalogo,
): SinteseExecutivaIA | null {
  if (!interacoes.length) return null;

  const meses = [...new Set(interacoes.map((i) => chaveDoMes(i.data_interacao)))].sort((a, b) =>
    b.localeCompare(a),
  );
  const [mesAtualChave, mesAnteriorChave] = meses;

  const doMes = (chave: string) => interacoes.filter((i) => chaveDoMes(i.data_interacao) === chave);
  const atual = doMes(mesAtualChave);
  const anterior = mesAnteriorChave ? doMes(mesAnteriorChave) : [];
  const temHistorico = anterior.length > 0;

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
    const doArea = interacoes.filter((i) => i.areas.includes(area.id) && i.clima);
    if (doArea.length < 3) continue;
    const score = scoreDeClima(doArea);
    if (score < 0 && (!areaAlerta || score < areaAlerta.score)) {
      areaAlerta = { nome: area.nome, score, total: doArea.length };
    }
  }

  const porInstituicao = new Map<string, Interacao[]>();
  for (const interacao of interacoes) {
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
    if (diasDesde(ultima) > 90) {
      instituicoesTier1Inativas.push(catalogo.instituicoes.get(id)?.nome ?? id);
    }
  }

  const semTema = atual.filter((i) => i.temas.length === 0).length;

  return {
    temHistorico,
    mesAtual: capitalizar(nomeDoMes(mesAtualChave)),
    mesAnterior: mesAnteriorChave ? nomeDoMes(mesAnteriorChave) : '',
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
