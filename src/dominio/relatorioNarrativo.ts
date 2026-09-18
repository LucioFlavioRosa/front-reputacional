/** O Relatório Executivo — um período (semana ou mês), agrupado por dia, em
 *  texto corrido.
 *
 *  DIFERENTE DA SÍNTESE EXECUTIVA PELA IA (`sinteseIA.ts`): aquela é um
 *  RESUMO analítico (números, comparação entre períodos); este é o REGISTRO
 *  em si — toda interação do período, por extenso, na ordem em que
 *  aconteceu.
 *
 *  TEXTO CORRIDO, DE PROPÓSITO — nada de "Relato:", "Encaminhamentos:" campo
 *  a campo: o objetivo é que alguém selecione o relatório inteiro e cole num
 *  e-mail ou numa apresentação, e um rótulo técnico por linha faz o texto
 *  colado parecer uma exportação de planilha, não um relato. Só o que tem
 *  conteúdo aparece — um campo vazio não vira linha "—", porque não existe
 *  "—" que soe natural no meio de um parágrafo.
 *
 *  PENDÊNCIAS FICA DE FORA: existe no cadastro da interação, mas não entra
 *  neste texto — é controle operacional, não parte do relato que se repassa.
 */

import type { Catalogo } from '@/dominio/derivacoes';
import { nomeDaInstituicao, nomeDoInterlocutor, nomesDosTemas, rotuloDeCodigo } from '@/dominio/derivacoes';
import { mesesDisponiveis, rotuloDoMesComAno } from '@/dominio/calendarioMensal';
import { rotuloDaSemanaComAno, semanasDisponiveis } from '@/dominio/calendarioSemanal';
import { chaveDaSemana, chaveDoMes, dataCompleta, listaComE } from '@/dominio/formato';
import type { Interacao } from '@/dominio/tipos';

export type GranularidadeDoRelatorio = 'semana' | 'mes';

export interface EntradaDoRelatorioNarrativo {
  id: string;
  /** "Igor Bastos, Juliane Silva e Anderson Juiz" — todo mundo de
   *  `outra_parte`, o principal primeiro. "" quando ninguém foi informado. */
  participantes: string;
  instituicao: string;
  /** `null` = não informado — a linha não leva "(Clima ...)" nesse caso. */
  clima: string | null;
  /** Já unidos com "e". `null` quando não há nenhum tema marcado. */
  temas: string | null;
  relato: string | null;
  encaminhamentos: string | null;
  observacoes: string | null;
}

export interface DiaDoRelatorioNarrativo {
  data: string;
  dataFormatada: string;
  entradas: EntradaDoRelatorioNarrativo[];
}

export interface RelatorioNarrativo {
  totalReunioes: number;
  totalInstituicoes: number;
  totalDias: number;
  dias: DiaDoRelatorioNarrativo[];
}

/** Todo mundo do outro lado, o principal primeiro — e não só `interlocutor_id`
 *  (que hoje é apenas a PROJEÇÃO de quem está marcado como principal em
 *  `outra_parte`; ver o comentário de `Interacao.outra_parte`). Cai para
 *  `interlocutor_id` sozinho só nos registros de planilha, de antes de
 *  `outra_parte` existir, que podem ter um sem o outro. */
function participantesDaInteracao(catalogo: Catalogo, interacao: Interacao): string {
  const nomes = interacao.outra_parte.length
    ? [...interacao.outra_parte]
        .sort((a, b) => Number(b.principal) - Number(a.principal))
        .map((p) => nomeDoInterlocutor(catalogo, p.interlocutor_id))
    : [nomeDoInterlocutor(catalogo, interacao.interlocutor_id)];
  return listaComE(nomes.filter((nome) => nome !== '—'));
}

/** Todo período (semana ou mês) com pelo menos uma interação no recorte, do
 *  mais recente ao mais antigo — a lista que alimenta o seletor. */
export function periodosDisponiveis(
  interacoes: Interacao[],
  granularidade: GranularidadeDoRelatorio,
): string[] {
  return granularidade === 'semana' ? semanasDisponiveis(interacoes) : mesesDisponiveis(interacoes);
}

export function rotuloDoPeriodo(chave: string, granularidade: GranularidadeDoRelatorio): string {
  return granularidade === 'semana' ? rotuloDaSemanaComAno(chave) : rotuloDoMesComAno(chave);
}

/** `null` só quando o período não tem NENHUMA interação — a tela mostra
 *  "sem reuniões neste período" em vez de uma seção vazia sem explicação. */
export function gerarRelatorioNarrativo(
  interacoes: Interacao[],
  catalogo: Catalogo,
  chave: string,
  granularidade: GranularidadeDoRelatorio,
): RelatorioNarrativo | null {
  const chaveDoPeriodo = granularidade === 'semana' ? chaveDaSemana : chaveDoMes;
  const doPeriodo = interacoes.filter((i) => chaveDoPeriodo(i.data_interacao) === chave);
  if (!doPeriodo.length) return null;

  const porDia = new Map<string, Interacao[]>();
  for (const interacao of doPeriodo) {
    const lista = porDia.get(interacao.data_interacao) ?? [];
    lista.push(interacao);
    porDia.set(interacao.data_interacao, lista);
  }

  const dias: DiaDoRelatorioNarrativo[] = [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, lista]) => ({
      data,
      dataFormatada: dataCompleta(data),
      entradas: lista.map((interacao): EntradaDoRelatorioNarrativo => {
        const temas = nomesDosTemas(catalogo, interacao.temas);
        return {
          id: interacao.id,
          participantes: participantesDaInteracao(catalogo, interacao),
          instituicao: nomeDaInstituicao(catalogo, interacao.instituicao_id),
          clima: interacao.clima ? rotuloDeCodigo(catalogo, 'climas', interacao.clima) : null,
          temas: temas.length ? listaComE(temas) : null,
          relato: interacao.relato?.trim() || null,
          encaminhamentos: interacao.encaminhamentos?.trim() || null,
          observacoes: interacao.observacoes?.trim() || null,
        };
      }),
    }));

  return {
    totalReunioes: doPeriodo.length,
    totalInstituicoes: new Set(doPeriodo.map((i) => i.instituicao_id)).size,
    totalDias: dias.length,
    dias,
  };
}
