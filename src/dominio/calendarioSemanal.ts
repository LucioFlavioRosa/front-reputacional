/** Utilidades de semana para quem escolhe UMA semana para analisar — irmã de
 *  `calendarioMensal.ts`, mesma ideia (`semanasDisponiveis` para popular um
 *  seletor, `rotuloDaSemanaComAno` para rotulá-lo), só que a chave é a
 *  segunda-feira da semana (`chaveDaSemana`, em `formato.ts`) em vez do mês.
 *
 *  Existe por causa do Relatório Executivo (`relatorioNarrativo.ts`), que lê
 *  um período — semana OU mês — por vez.
 */

import { MESES_POR_EXTENSO } from '@/dominio/calendarioMensal';
import { chaveDaSemana, titulo as capitalizar } from '@/dominio/formato';
import type { Interacao } from '@/dominio/tipos';

/** Toda semana (segunda-feira, "YYYY-MM-DD") com pelo menos uma interação no
 *  recorte, da mais recente à mais antiga — mesma ideia de `mesesDisponiveis`. */
export function semanasDisponiveis(interacoes: Interacao[]): string[] {
  return [...new Set(interacoes.map((i) => chaveDaSemana(i.data_interacao)))].sort((a, b) =>
    b.localeCompare(a),
  );
}

const DIA_EM_MS = 86_400_000;

/** "04 a 10 de setembro de 2026" — a semana inteira (segunda a domingo), por
 *  extenso: um "04/09" sozinho não diz o ano, e "semana 35" não diz nada pra
 *  quem não vive de calendário ISO. Quando a semana cruza o mês, os dois
 *  meses aparecem («28 de agosto a 03 de setembro de 2026»). */
export function rotuloDaSemanaComAno(chave: string): string {
  const inicio = new Date(`${chave}T00:00:00`);
  const fim = new Date(inicio.getTime() + 6 * DIA_EM_MS);
  const de = String(inicio.getDate()).padStart(2, '0');
  const ate = String(fim.getDate()).padStart(2, '0');
  const mesFinal = `${capitalizar(MESES_POR_EXTENSO[fim.getMonth()])} de ${fim.getFullYear()}`;
  if (inicio.getMonth() === fim.getMonth()) return `${de} a ${ate} de ${mesFinal}`;
  return `${de} de ${capitalizar(MESES_POR_EXTENSO[inicio.getMonth()])} a ${ate} de ${mesFinal}`;
}
