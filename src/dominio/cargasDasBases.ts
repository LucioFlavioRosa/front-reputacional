/** Quando cada base foi carregada, e por quem — a aba da plataforma.
 *
 *  DIZ "CARGA" E NÃO "ATUALIZAÇÃO", e isto é contrato e não estilo: a trilha do
 *  back (migrations 0115/0116) registra a CARGA de arquivo. Reconciliação da
 *  lista de veículos, edição de jornalista e fusão de atores alteram menção por
 *  fora da ingestão e não aparecem lá. Escrever "última atualização" na tela
 *  faria o painel afirmar o que o back não sabe.
 */

/** As bases que a aba conhece.
 *
 *  LISTA DAQUI E NÃO DA RESPOSTA, de propósito. A rota é histórico de EVENTOS:
 *  uma base que nunca foi carregada não devolve linha nenhuma, e sem esta lista
 *  a tela não teria como dizer "sem registro" — ela mostraria três bases e
 *  esconderia a quarta justamente no caso em que avisar importa mais.
 *
 *  `agendas` não vem da mesma tabela que as outras: o CRM já tinha trilha
 *  própria (`importacao`, com quem subiu e quem confirmou), e o back une as
 *  duas na leitura em vez de copiar uma para a outra.
 */
export const BASES = ['score', 'bonds', 'subtemas', 'agendas'] as const;

export type Base = (typeof BASES)[number];

/** O nome que a pessoa reconhece. */
export const NOME_DA_BASE: Record<Base, string> = {
  score: 'Menções',
  bonds: 'Cotações dos bonds',
  subtemas: 'Taxonomia de subtemas',
  agendas: 'Agendas do CRM',
};

export interface CargaDaBase {
  base: string;
  /** O nome da fonte, SÓ no Score — é a única base que tem fonte. */
  fonte: string | null;
  arquivo: string | null;
  /** Quem carregou. Nulo é informação: carga feita fora da tela. */
  quem: string | null;
  /** Verdadeiro quando `quem` é o remetente do arquivo e não quem confirmou.
   *
   *  Só nas agendas confirmadas antes da migration 0117, que não guardava
   *  `confirmado_por`. A tela troca o verbo em vez de errar: "enviado por" no
   *  lugar de "carregado por". */
  quem_enviou_o_arquivo: boolean;
  origem: string | null;
  /** Quantas linhas entraram. ZERO É RESULTADO VÁLIDO, e é a razão de a trilha
   *  existir: a ingestão apaga o período e pode não inserir nada, e aí nenhum
   *  carimbo das tabelas de dado anda. */
  linhas: number;
  /** Os meses cobertos, em `AAAA-MM-DD`. Vazio onde a base não é mensal. */
  meses: string[];
  quando: string;
  /** Liga as fontes irmãs do mesmo arquivo. Nulo nas agendas, que não têm. */
  lote_id: string | null;
}

/** Uma carga por LOTE, com as fontes que ela alimentou juntas.
 *
 *  POR QUE AGRUPAR. Uma subida da Clipei alimenta Imprensa e Mercado e rende
 *  DUAS linhas na trilha — é assim que o back registra, e está certo, porque
 *  cada fonte foi atualizada. Mas foi UMA carga, e listar duas faria a aba
 *  contar o trabalho duas vezes e sugerir que alguém subiu o arquivo de novo.
 *
 *  SEM LOTE, CADA LINHA É SEU PRÓPRIO GRUPO: `lote_id` é nulo nas agendas, e
 *  agrupar por nulo juntaria importações sem relação nenhuma.
 */
export interface CargaAgrupada {
  chave: string;
  base: string;
  /** As fontes alimentadas, na ordem em que vieram. Vazio fora do Score. */
  fontes: string[];
  arquivo: string | null;
  quem: string | null;
  quem_enviou_o_arquivo: boolean;
  origem: string | null;
  /** A SOMA das linhas do lote: é quanto o arquivo trouxe ao todo. */
  linhas: number;
  meses: string[];
  quando: string;
}

export function agruparPorLote(cargas: CargaDaBase[]): CargaAgrupada[] {
  const grupos: CargaAgrupada[] = [];
  const porLote = new Map<string, CargaAgrupada>();

  for (const carga of cargas) {
    const anterior = carga.lote_id ? porLote.get(carga.lote_id) : undefined;
    if (anterior) {
      if (carga.fonte) anterior.fontes.push(carga.fonte);
      anterior.linhas += carga.linhas;
      //: OS MESES SE UNEM porque as irmãs cobrem o mesmo período, mas uma pode
      //: ter recortado para zero num mês que a outra traz.
      for (const mes of carga.meses) {
        if (!anterior.meses.includes(mes)) anterior.meses.push(mes);
      }
      anterior.meses.sort();
      continue;
    }
    const grupo: CargaAgrupada = {
      //: A CHAVE É O LOTE quando existe; sem ele, a própria posição. Agrupar por
      //: nulo juntaria agendas que não têm relação.
      chave: carga.lote_id ?? `${carga.base}-${carga.quando}-${grupos.length}`,
      base: carga.base,
      fontes: carga.fonte ? [carga.fonte] : [],
      arquivo: carga.arquivo,
      quem: carga.quem,
      quem_enviou_o_arquivo: carga.quem_enviou_o_arquivo,
      origem: carga.origem,
      linhas: carga.linhas,
      meses: [...carga.meses],
      quando: carga.quando,
    };
    grupos.push(grupo);
    if (carga.lote_id) porLote.set(carga.lote_id, grupo);
  }

  return grupos;
}

/** Quais bases nunca apareceram na trilha.
 *
 *  É O QUE PERMITE DIZER "SEM REGISTRO". A rota devolve eventos, não status, e
 *  uma base sem carga simplesmente não vem — sem esta conta a tela ficaria
 *  calada exatamente onde o aviso importa.
 */
export function basesSemRegistro(cargas: CargaDaBase[]): Base[] {
  const vistas = new Set(cargas.map((carga) => carga.base));
  return BASES.filter((base) => !vistas.has(base));
}

/** "há 3 dias", "hoje", "há 2 meses" — a pergunta da tela é "está velha?".
 *
 *  RELATIVO E NÃO ABSOLUTO no rótulo principal porque ninguém olha esta aba para
 *  saber a data: olha para saber se a base está velha. A data exata vai no
 *  `title`, para quem precisar dela.
 */
export function quantoTempo(quando: string, agora: Date = new Date()): string {
  const data = new Date(quando);
  if (Number.isNaN(data.getTime())) return '—';

  const dias = Math.floor((agora.getTime() - data.getTime()) / 86_400_000);
  if (dias < 0) return 'há instantes';
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 30) return `há ${dias} dias`;

  const meses = Math.floor(dias / 30);
  if (meses === 1) return 'há 1 mês';
  if (meses < 12) return `há ${meses} meses`;

  const anos = Math.floor(meses / 12);
  return anos === 1 ? 'há 1 ano' : `há ${anos} anos`;
}

/** O verbo certo para a autoria, que depende do que o back pôde guardar. */
export function rotuloDeQuem(carga: {
  quem: string | null;
  quem_enviou_o_arquivo: boolean;
  origem: string | null;
}): string {
  if (!carga.quem) {
    //: NULO NÃO É DADO FALTANDO: é carga feita fora da tela, e a origem diz qual
    //: comando foi. Escrever "desconhecido" esconderia justamente essa
    //: informação.
    return carga.origem ? `fora da tela (${carga.origem})` : 'fora da tela';
  }
  return carga.quem_enviou_o_arquivo ? `${carga.quem} (enviou o arquivo)` : carga.quem;
}
