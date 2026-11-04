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
  /** A SOMA das linhas do lote: é quanto o arquivo trouxe ao todo.
   *
   *  SOMAR É LEGÍTIMO porque a partição entre as irmãs é EXCLUSIVA: a fonte que
   *  declara lista de veículos fica com os dela, e a irmã que não declara fica
   *  com todo o resto (ver `_recorte_por_lista` no back). Nenhuma menção entra
   *  nas duas, então 25.000 de Imprensa mais 320 de Mercado são 25.320 linhas
   *  distintas — o total do arquivo, e não um número inventado. No dia em que o
   *  recorte voltar a ser sobreposto, esta soma passa a contar em dobro. */
  linhas: number;
  meses: string[];
  quando: string;
}

/** Agrupa preservando a ordem recebida.
 *
 *  A ORDEM FINAL CONTINUA DESCENDENTE POR TEMPO sem precisar reordenar: o back
 *  manda por `concluida_em desc`, e cada grupo ocupa a posição da sua PRIMEIRA
 *  ocorrência — que, numa lista descendente, é a mais recente do lote. Uma carga
 *  de outra base que caia no meio de duas irmãs fica depois do grupo, porque é
 *  mais antiga que a primeira irmã. Por isso o `Map` basta e não é preciso
 *  exigir que as irmãs venham adjacentes.
 */
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

/** O estado de cada base, do endpoint de resumo. */
export interface ResumoDaBase {
  base: string;
  /** Quantas cargas a base já teve, SEM TETO. */
  cargas: number;
  /** A mais recente, ou nula quando `cargas` é zero. */
  ultima_em: string | null;
}

/** Quais bases nunca receberam carga, pelo RESUMO e não pela lista.
 *
 *  POR QUE NÃO DÁ PARA CONTAR PELA LISTA, e é conserto de um defeito real: a
 *  listagem é histórico com teto de 200. Uma base com cargas só antigas,
 *  empurradas para fora do teto por 200 eventos mais recentes de outra,
 *  apareceria como nunca carregada — e a tela afirmaria isso em texto. O resumo
 *  é agregado e não tem teto, então a contagem é a de verdade.
 */
export function basesSemRegistro(resumo: ResumoDaBase[]): string[] {
  return resumo.filter((linha) => linha.cargas === 0).map((linha) => linha.base);
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

  //: DATA NO FUTURO NÃO É "HÁ INSTANTES", que afirmaria passado. Acontece com
  //: relógio de servidor adiantado, e o honesto é dizer que o carimbo está
  //: adiante — quem vê isso tem um problema de infraestrutura, não de carga.
  if (data.getTime() > agora.getTime()) return 'com data futura';

  //: POR DATA LOCAL e não por blocos de 24 h: uma carga de ontem às 23h está a
  //: duas horas de distância e diria "hoje", que é a única coisa que a pessoa
  //: não pode ler errado nesta tela.
  const dias = diasDeCalendarioEntre(data, agora);
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 30) return `há ${dias} dias`;

  //: MESES DE 30 DIAS, aproximação declarada: o rótulo é grosseiro de propósito
  //: ("está velha?"), e a data exata fica ao lado para quem precisa dela.
  const meses = Math.floor(dias / 30);
  if (meses === 1) return 'há 1 mês';
  if (meses < 12) return `há ${meses} meses`;

  const anos = Math.floor(dias / 365);
  return anos === 1 ? 'há 1 ano' : `há ${anos} anos`;
}

function diasDeCalendarioEntre(antes: Date, depois: Date): number {
  const meiaNoite = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((meiaNoite(depois) - meiaNoite(antes)) / 86_400_000);
}

/** O que a aba mostra sobre quem carregou, e o detalhe técnico separado.
 *
 *  DOIS CAMPOS E NÃO UM, e é conserto de jargão vazando para a tela: `origem`
 *  tem valores como `api:planilha` e `carga_do_pacote`, que são nomes de código
 *  e não rótulos operacionais. O `rotulo` é o que a pessoa lê; o `detalhe` fica
 *  no `title`, para quem está investigando.
 *
 *  NULO NÃO É DADO FALTANDO: é carga feita fora da tela, por rotina. Escrever
 *  "desconhecido" afirmaria que ninguém sabe, quando a origem diz exatamente
 *  qual rotina foi.
 */
export function rotuloDeQuem(carga: {
  quem: string | null;
  quem_enviou_o_arquivo: boolean;
  origem: string | null;
}): { rotulo: string; detalhe?: string } {
  if (!carga.quem) {
    return {
      rotulo: 'rotina automática',
      detalhe: carga.origem ? `origem: ${carga.origem}` : undefined,
    };
  }
  if (carga.quem_enviou_o_arquivo) {
    return {
      rotulo: carga.quem,
      //: O VERBO MUDA porque aqui o nome é de quem ENVIOU, e a hora é de quem
      //: confirmou — ver `quem_enviou_o_arquivo`.
      detalhe: 'enviou o arquivo; quem confirmou não foi registrado',
    };
  }
  return { rotulo: carga.quem };
}
