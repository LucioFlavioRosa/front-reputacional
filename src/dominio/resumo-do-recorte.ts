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

/** MESMA IDEIA de `nomesDasAreas`, para `recorte.formatoInteracao` — sem
 *  isto a ficha desses dois filtros (bloco fixo do Painel, ver
 *  `campoDeFormatoInteracao`/`campoDeCategoriaPublico`) nunca aparecia na
 *  barra fixa do topo, e o botão "Limpar" dali não os reconhecia. */
function nomesDosFormatos(ids: number[], catalogo: Catalogo | null): string[] {
  return ids.map((id) => {
    const formato = catalogo?.dicionarios.formatos_interacao.find((f) => f.id === id);
    return formato?.nome ?? String(id);
  });
}

function nomesDasCategoriasPublico(ids: number[], catalogo: Catalogo | null): string[] {
  return ids.map((id) => {
    const categoria = catalogo?.dicionarios.categorias_publico.find((c) => c.id === id);
    return categoria?.nome ?? String(id);
  });
}

/** O período em palavras — Passado e Futuro são lados independentes do
 *  Recorte agora (`periodoPassado`/`periodoFuturo`, preset ou data
 *  customizada em `de`/`ate`), então esta função monta a frase de cada lado
 *  separadamente e as junta só se as duas existirem. Com só um lado ativo, o
 *  resumo fica idêntico ao que já era antes da divisão Passado/Futuro. */
function rotuloDoPeriodo(recorte: Recorte): string | undefined {
  const passado = recorte.de
    ? `desde ${dataCompleta(recorte.de)}`
    : recorte.periodoPassado
      ? ATALHOS_DE_PERIODO[recorte.periodoPassado]
      : undefined;

  const futuro = recorte.ate
    ? `até ${dataCompleta(recorte.ate)}`
    : recorte.periodoFuturo
      ? ATALHOS_DE_PERIODO[recorte.periodoFuturo]
      : undefined;

  if (passado && futuro) return `${passado} + ${futuro}`;
  return passado ?? futuro;
}

export function resumirRecorte(recorte: Recorte, catalogo: Catalogo | null): string {
  const partes: string[] = [];

  const periodo = rotuloDoPeriodo(recorte);
  if (periodo) partes.push(periodo);

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
 *  `campo` é o que a ficha remove. Período é um caso especial: Passado e
 *  Futuro (preset ou data customizada, quatro campos ao todo) são o MESMO
 *  filtro para quem lê, e removê-lo tem de limpar os quatro de uma vez.
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

  por('periodo-inteiro', rotuloDoPeriodo(recorte));

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
  if (recorte.formatoInteracao?.length) {
    por('formatoInteracao', nomesDosFormatos(recorte.formatoInteracao, catalogo).join(' ou '));
  }
  if (recorte.categoriaPublico?.length) {
    por('categoriaPublico', nomesDasCategoriasPublico(recorte.categoriaPublico, catalogo).join(' ou '));
  }
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
    delete novo.periodoPassado;
    delete novo.periodoFuturo;
    delete novo.de;
    delete novo.ate;
    return novo;
  }
  delete novo[campo];
  return novo;
}
