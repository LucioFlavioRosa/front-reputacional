/** Resumo textual do recorte, exibido ao lado do botão Filtros.
 *
 *  Serve para o usuário saber o que está olhando sem abrir o drawer — e para
 *  a exportação da Base, que registra o recorte por escrito na trilha.
 */

import type { Catalogo } from '@/dominio/derivacoes';
import { rotuloDeCodigo, rotuloDeRelevancia } from '@/dominio/derivacoes';
import { ATALHOS_DE_PERIODO } from '@/dominio/recorte';
import type { Recorte } from '@/dominio/recorte';
import { ROTULOS_DE_FRENTE, ROTULOS_DE_GRUPO } from '@/dominio/frentes';
import { dataCompleta } from '@/dominio/formato';

/** Ids de área viram nome pelo mesmo dicionário que `PessoaAegea.area_id` usa.
 *  Um id sem correspondência (área desativada depois do filtro aplicado)
 *  mostra o próprio número, em vez de sumir da ficha sem explicação. */
function nomesDasAreas(ids: number[], catalogo: Catalogo | null): string[] {
  return ids.map((id) => {
    const area = catalogo?.dicionarios.areas_pessoa.find((a) => a.id === id);
    return area?.nome ?? String(id);
  });
}

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
  if (recorte.tier) partes.push(rotuloDeRelevancia(catalogo, recorte.tier));
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
  if (recorte.areas?.length) partes.push(nomesDasAreas(recorte.areas, catalogo).join(' ou '));
  if (recorte.q) partes.push(`“${recorte.q}”`);

  return partes.length ? partes.join(' · ') : 'Base completa, sem filtros';
}

/** O recorte como fichas removíveis, para a barra fixa.
 *
 *  A MESMA LEITURA DE `resumirRecorte`, quebrada por filtro. O recorte fica à
 *  vista porque quem vê uma queda precisa saber se ela é do mês ou do filtro
 *  que pôs dez minutos antes — e quebrado em fichas porque desfazer um filtro
 *  tem de ser um clique nele, e não uma busca dentro de uma gaveta.
 *
 *  `campo` é o que a ficha remove. Período é um caso especial: `de`/`ate` e o
 *  atalho são o MESMO filtro para quem lê, e removê-lo tem de limpar os três.
 */
export interface FichaDeFiltro {
  campo: keyof Recorte | 'periodo-inteiro';
  rotulo: string;
}

export function fichasDoRecorte(
  recorte: Recorte,
  catalogo: Catalogo | null,
): FichaDeFiltro[] {
  const fichas: FichaDeFiltro[] = [];
  const por = (campo: FichaDeFiltro['campo'], rotulo: string | undefined) => {
    if (rotulo) fichas.push({ campo, rotulo });
  };

  if (recorte.de || recorte.ate) {
    const de = recorte.de ? dataCompleta(recorte.de) : 'início';
    const ate = recorte.ate ? dataCompleta(recorte.ate) : 'hoje';
    por('periodo-inteiro', `${de} a ${ate}`);
  } else if (recorte.periodo) {
    por('periodo-inteiro', ATALHOS_DE_PERIODO[recorte.periodo]);
  }

  if (recorte.frente) por('frente', ROTULOS_DE_FRENTE[recorte.frente]);
  if (recorte.uf) {
    por(
      'uf',
      recorte.uf === 'NA' ? 'Nacional' : recorte.uf === 'IN' ? 'Internacional' : recorte.uf,
    );
  }
  if (recorte.tier) por('tier', rotuloDeRelevancia(catalogo, recorte.tier));
  if (recorte.grupo) por('grupo', ROTULOS_DE_GRUPO[recorte.grupo]);
  if (recorte.unidade) por('unidade', recorte.unidade);
  if (recorte.entidade) por('entidade', recorte.entidade);

  if (catalogo) {
    if (recorte.clima) por('clima', rotuloDeCodigo(catalogo, 'climas', recorte.clima));
    if (recorte.resultado) {
      por('resultado', rotuloDeCodigo(catalogo, 'resultados', recorte.resultado));
    }
    if (recorte.esfera) por('esfera', rotuloDeCodigo(catalogo, 'esferas', recorte.esfera));
    if (recorte.status) por('status', rotuloDeCodigo(catalogo, 'status', recorte.status));
    if (recorte.subtipo) {
      por('subtipo', rotuloDeCodigo(catalogo, 'tipos_investidor', recorte.subtipo));
    }
  }

  if (recorte.tags?.length) por('tags', recorte.tags.join(' ou '));
  if (recorte.areas?.length) por('areas', nomesDasAreas(recorte.areas, catalogo).join(' ou '));
  if (recorte.q) por('q', `“${recorte.q}”`);

  return fichas;
}

/** O recorte sem um filtro. Devolve um NOVO recorte — nada aqui muta. */
export function semOFiltro(
  recorte: Recorte,
  campo: FichaDeFiltro['campo'],
): Recorte {
  const novo = { ...recorte };
  if (campo === 'periodo-inteiro') {
    delete novo.periodo;
    delete novo.de;
    delete novo.ate;
    return novo;
  }
  delete novo[campo];
  return novo;
}
