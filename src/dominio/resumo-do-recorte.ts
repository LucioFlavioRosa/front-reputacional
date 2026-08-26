/** Resumo textual do recorte, exibido ao lado do botão Filtros.
 *
 *  Serve para o usuário saber o que está olhando sem abrir o drawer — e para
 *  o cabeçalho do relatório, que precisa imprimir o recorte por escrito.
 */

import type { Catalogo } from '@/dominio/derivacoes';
import { rotuloDeCodigo } from '@/dominio/derivacoes';
import { ATALHOS_DE_PERIODO } from '@/dominio/recorte';
import type { Recorte } from '@/dominio/recorte';
import { ROTULOS_DE_FRENTE, ROTULOS_DE_GRUPO } from '@/dominio/frentes';
import { dataCompleta } from '@/dominio/formato';

export function resumirRecorte(recorte: Recorte, catalogo: Catalogo | null): string {
  const partes: string[] = [];

  if (recorte.de || recorte.ate) {
    const de = recorte.de ? dataCompleta(recorte.de) : 'início';
    const ate = recorte.ate ? dataCompleta(recorte.ate) : 'hoje';
    partes.push(`${de} a ${ate}`);
  } else if (recorte.periodo) {
    partes.push(ATALHOS_DE_PERIODO[recorte.periodo]);
  }

  if (recorte.frente) partes.push(ROTULOS_DE_FRENTE[recorte.frente]);
  if (recorte.uf) {
    partes.push(recorte.uf === 'NA' ? 'Nacional' : recorte.uf === 'IN' ? 'Internacional' : recorte.uf);
  }
  if (recorte.tier) partes.push(`Tier ${recorte.tier}`);
  if (recorte.grupo) partes.push(ROTULOS_DE_GRUPO[recorte.grupo]);
  if (recorte.unidade) partes.push(recorte.unidade);
  if (recorte.entidade) partes.push(recorte.entidade);

  if (catalogo) {
    if (recorte.clima) partes.push(rotuloDeCodigo(catalogo, 'climas', recorte.clima));
    if (recorte.resultado) partes.push(rotuloDeCodigo(catalogo, 'resultados', recorte.resultado));
    if (recorte.esfera) partes.push(rotuloDeCodigo(catalogo, 'esferas', recorte.esfera));
    if (recorte.status) partes.push(rotuloDeCodigo(catalogo, 'status', recorte.status));
    if (recorte.subtipo) {
      partes.push(rotuloDeCodigo(catalogo, 'tipos_investidor', recorte.subtipo));
    }
  }

  if (recorte.tags?.length) partes.push(recorte.tags.join(' ou '));
  if (recorte.q) partes.push(`“${recorte.q}”`);

  return partes.length ? partes.join(' · ') : 'Base completa, sem filtros';
}
