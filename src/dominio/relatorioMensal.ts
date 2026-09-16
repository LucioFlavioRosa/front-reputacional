/** O Relatório de Reuniões — um mês, agrupado por dia, campo a campo.
 *
 *  DIFERENTE DA SÍNTESE EXECUTIVA PELA IA (`sinteseIA.ts`): aquela é um
 *  RESUMO analítico (números, comparação entre períodos); este é o
 *  REGISTRO em si — toda interação do mês, por extenso, na ordem em que
 *  aconteceu. Os dois compartilham as utilidades de mês (`calendarioMensal.ts`)
 *  porque os dois escolhem UM mês para olhar, mas nada além disso.
 *
 *  SÓ MENSAL, de propósito — não existe "semana" ou "trimestre" aqui: é um
 *  relatório de fechamento, o tipo de documento que se manda uma vez por mês,
 *  não uma janela que se ajusta.
 */

import type { Catalogo } from '@/dominio/derivacoes';
import { nomeDaInstituicao, nomeDoInterlocutor, nomesDosTemas, rotuloDeCodigo } from '@/dominio/derivacoes';
import { chaveDoMes, dataCompleta } from '@/dominio/formato';
import type { Interacao } from '@/dominio/tipos';

export interface EntradaDoRelatorioMensal {
  id: string;
  instituicao: string;
  /** O contato do lado de fora — o "stakeholder" que dá nome ao produto.
   *  Uma interação tem um único interlocutor hoje; ver o comentário de
   *  `gerarRelatorioMensal` sobre o que fazer se isso um dia deixar de
   *  valer. */
  stakeholder: string;
  temas: string;
  relato: string | null;
  encaminhamentos: string | null;
  pendencias: string | null;
  observacoes: string | null;
  clima: string;
}

export interface DiaDoRelatorioMensal {
  data: string;
  dataFormatada: string;
  entradas: EntradaDoRelatorioMensal[];
}

export interface RelatorioMensal {
  totalReunioes: number;
  totalInstituicoes: number;
  totalDias: number;
  dias: DiaDoRelatorioMensal[];
}

/** `null` só quando o mês não tem NENHUMA interação — a caixa mostra "sem
 *  reuniões neste mês" em vez de uma seção vazia sem explicação. */
export function gerarRelatorioMensal(
  interacoes: Interacao[],
  catalogo: Catalogo,
  mesChave: string,
): RelatorioMensal | null {
  const doMes = interacoes.filter((i) => chaveDoMes(i.data_interacao) === mesChave);
  if (!doMes.length) return null;

  const porDia = new Map<string, Interacao[]>();
  for (const interacao of doMes) {
    const lista = porDia.get(interacao.data_interacao) ?? [];
    lista.push(interacao);
    porDia.set(interacao.data_interacao, lista);
  }

  const dias: DiaDoRelatorioMensal[] = [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, lista]) => ({
      data,
      dataFormatada: dataCompleta(data),
      entradas: lista.map((interacao) => ({
        id: interacao.id,
        instituicao: nomeDaInstituicao(catalogo, interacao.instituicao_id),
        stakeholder: nomeDoInterlocutor(catalogo, interacao.interlocutor_id),
        temas: nomesDosTemas(catalogo, interacao.temas).join(', ') || '—',
        relato: interacao.relato,
        encaminhamentos: interacao.encaminhamentos,
        pendencias: interacao.pendencias,
        observacoes: interacao.observacoes,
        clima: rotuloDeCodigo(catalogo, 'climas', interacao.clima),
      })),
    }));

  return {
    totalReunioes: doMes.length,
    totalInstituicoes: new Set(doMes.map((i) => i.instituicao_id)).size,
    totalDias: dias.length,
    dias,
  };
}
