/** Utilidades de mês ("YYYY-MM") compartilhadas por quem organiza dado por
 *  mês fora do gráfico de série temporal — hoje a Síntese Executiva pela IA
 *  (`sinteseIA.ts`) e o Relatório de Reuniões (`relatorioMensal.ts`).
 *  `chaveDoMes`/`serieMensal`/`completarPeriodos` (em `derivacoes.ts`) fazem
 *  o mesmo tipo de conta para os GRÁFICOS de série no tempo; este arquivo é
 *  a versão para quem escolhe UM mês (ou uma janela pequena de meses) para
 *  analisar, e não uma série inteira. */

import { chaveDoMes, titulo as capitalizar } from '@/dominio/formato';
import type { Interacao } from '@/dominio/tipos';

const MESES_POR_EXTENSO = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function nomeDoMes(chave: string): string {
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

/** O último dia (de calendário) do mês de `chave` — o "hoje" de uma análise
 *  que olha para um fechamento do passado: perguntar "há quanto tempo sem
 *  interação" faz sentido em relação ao FIM do mês em análise, não em
 *  relação ao dia de hoje de verdade. */
export function ultimoDiaDoMes(chave: string): Date {
  const [ano, mes] = chave.split('-').map(Number);
  return new Date(ano, mes, 0);
}

/** Todo mês ("YYYY-MM") com pelo menos uma interação no recorte, do mais
 *  recente ao mais antigo — a lista que alimenta um seletor "escolher um mês
 *  específico". */
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
