/** A leitura dos sinais de mercado — TypeScript puro, sem React.
 *
 *  O QUE ESTE MÓDULO EXISTE PARA RESPONDER
 *  ---------------------------------------
 *  Não é "quantos e-mails chegaram". É "a mesma premissa chegou de quantas
 *  INSTITUIÇÕES QUE NÃO SE FALAM, e em quanto tempo". Um banco perguntando é
 *  diligência; quatro perguntando o mesmo em duas semanas é um movimento — e
 *  esse movimento precede o efeito (juros, spread, rating) em semanas.
 *
 *  CONVERGÊNCIA NÃO É PROVA DE COMBINAÇÃO. Instituições diferentes podem
 *  chegar à mesma pergunta pela mesma notícia. O módulo conta e ordena; quem
 *  conclui é quem lê. É por isso que nada aqui se chama "conluio", e que o
 *  destaque (`convergente`) é um limiar explícito, e não um veredito.
 */

import type { Alegacao, Interacao } from '@/dominio/tipos';
import type { ItemContado, Segmento } from '@/dominio/derivacoes';

/** O código do tipo de interação que é uma consulta recebida.
 *
 *  O ÚNICO CÓDIGO DE DICIONÁRIO que esta funcionalidade conhece, e mora aqui
 *  porque o formulário precisa saber QUANDO oferecer o bloco da consulta —
 *  antes de existir qualquer consulta para reconhecer pelo bloco. Toda
 *  LEITURA depois disso vai pelo bloco (`consultasDe`), e não por este código. */
export const CODIGO_DA_CONSULTA = 'consulta_recebida';


/** A partir de quantas instituições distintas, dentro da janela, uma alegação
 *  merece destaque.
 *
 *  TRÊS, e não duas: duas instituições podem ter lido a mesma notícia no mesmo
 *  dia. Três já é um padrão que vale olhar — e o limiar é do produto, não uma
 *  descoberta estatística. */
export const INSTITUICOES_PARA_CONVERGIR = 3;

/** Em quantos dias. Quinze cobre o ciclo de uma notícia que circula e some;
 *  um mês diluiria a diferença entre "circulou" e "circula". */
export const DIAS_DA_JANELA = 15;

/** Uma alegação com o que as consultas do recorte dizem sobre ela. */
export interface AlegacaoEmCirculacao {
  alegacao: Alegacao;
  /** As consultas do recorte que a trouxeram, da mais recente para a mais antiga. */
  consultas: Interacao[];
  /** Quantas INSTITUIÇÕES distintas perguntaram. É o número que importa: duas
   *  consultas do mesmo banco são insistência, não circulação. */
  instituicoes: number;
  /** `2026-05-04` — a primeira e a última aparição no recorte. */
  primeira: string;
  ultima: string;
  /** Houve alguma janela de `DIAS_DA_JANELA` dias com `INSTITUICOES_PARA_CONVERGIR`
   *  instituições distintas. */
  convergente: boolean;
  /** QUANDO foi esse agrupamento — o mais recente, quando houve mais de um.
   *  Nulo quando não houve. */
  janela: { de: string; ate: string } | null;
}

/** Só as interações que são CONSULTA RECEBIDA.
 *
 *  Pelo bloco `consulta`, e não pelo id do tipo: o bloco só existe nesse tipo,
 *  e depender do id exigiria que a tela conhecesse o código do dicionário —
 *  que é exatamente o acoplamento que o catálogo existe para evitar.
 */
export function consultasDe(interacoes: Interacao[]): Interacao[] {
  return interacoes.filter((i) => i.consulta !== null);
}

/** Quantos dias separam duas datas ISO (`2026-05-04`). */
function diasEntre(inicio: string, fim: string): number {
  const um = Date.parse(`${inicio}T00:00:00Z`);
  const outro = Date.parse(`${fim}T00:00:00Z`);
  if (Number.isNaN(um) || Number.isNaN(outro)) return 0;
  return Math.round((outro - um) / 86_400_000);
}

/** EXISTE alguma janela de `DIAS_DA_JANELA` dias com instituições distintas
 *  o bastante?
 *
 *  JANELA DESLIZANTE, e não primeira × última aparição. Com o intervalo
 *  inteiro, três bancos perguntando em três dias deixariam de ser
 *  convergência assim que um quarto perguntasse seis meses depois — e o
 *  agrupamento curto, que é o sinal, desapareceria por causa de uma pergunta
 *  tardia. O que aconteceu não se desfaz.
 *
 *  Devolve também QUANDO foi o agrupamento, porque "está circulando agora" e
 *  "circulou em maio" são leituras diferentes.
 */
function janelaConvergente(
  consultas: Interacao[],
): { de: string; ate: string } | null {
  // Da mais antiga para a mais recente: a janela anda para frente.
  const ordenadas = [...consultas].sort((a, b) =>
    a.data_interacao.localeCompare(b.data_interacao),
  );

  let achada: { de: string; ate: string } | null = null;
  let inicio = 0;
  for (let fim = 0; fim < ordenadas.length; fim += 1) {
    while (
      inicio < fim &&
      diasEntre(ordenadas[inicio].data_interacao, ordenadas[fim].data_interacao) >
        DIAS_DA_JANELA
    ) {
      inicio += 1;
    }
    const distintas = new Set(
      ordenadas.slice(inicio, fim + 1).map((c) => c.instituicao_id),
    ).size;
    if (distintas >= INSTITUICOES_PARA_CONVERGIR) {
      // A MAIS RECENTE fica: entre dois agrupamentos, o que interessa é o
      // que ainda pode estar em curso.
      achada = {
        de: ordenadas[inicio].data_interacao,
        ate: ordenadas[fim].data_interacao,
      };
    }
  }
  return achada;
}

/** O QUE ESTÁ CIRCULANDO, da mais convergente para a menos.
 *
 *  Ordena por instituições distintas e, no empate, pela aparição mais recente:
 *  entre duas alegações com quatro bancos cada, interessa a que ainda está
 *  chegando. Alegação sem nenhuma consulta no recorte não entra — a lista é a
 *  leitura DESTE período, e não o cadastro.
 */
export function alegacoesEmCirculacao(
  consultas: Interacao[],
  alegacoes: Alegacao[],
): AlegacaoEmCirculacao[] {
  const porAlegacao = new Map<string, Interacao[]>();
  for (const consulta of consultas) {
    for (const id of consulta.alegacoes) {
      const lista = porAlegacao.get(id);
      if (lista) lista.push(consulta);
      else porAlegacao.set(id, [consulta]);
    }
  }

  return alegacoes
    .filter((alegacao) => porAlegacao.has(alegacao.id))
    .map((alegacao) => {
      const daAlegacao = [...(porAlegacao.get(alegacao.id) ?? [])].sort((a, b) =>
        b.data_interacao.localeCompare(a.data_interacao),
      );
      const instituicoes = new Set(daAlegacao.map((c) => c.instituicao_id)).size;
      const ultima = daAlegacao[0].data_interacao;
      const primeira = daAlegacao[daAlegacao.length - 1].data_interacao;
      const janela = janelaConvergente(daAlegacao);
      return {
        alegacao,
        consultas: daAlegacao,
        instituicoes,
        primeira,
        ultima,
        convergente: janela !== null,
        janela,
      };
    })
    .sort(
      (a, b) =>
        b.instituicoes - a.instituicoes ||
        b.consultas.length - a.consultas.length ||
        b.ultima.localeCompare(a.ultima),
    );
}

/** O QUE PRECISA DE RESPOSTA, e é o único bloco acionável da aba.
 *
 *  Duas coisas diferentes, de propósito juntas: a consulta cujo prazo venceu
 *  sem resposta, e a alegação que circula sem posicionamento publicado. As
 *  duas são dívida da área, e separá-las em dois blocos faria a segunda ser
 *  lida como estatística.
 */
export function consultasVencidas(consultas: Interacao[], hoje: string): Interacao[] {
  return consultas
    .filter((c) => {
      const prazo = c.consulta?.prazo_resposta;
      return Boolean(prazo) && !c.consulta?.respondida_em && prazo! < hoje;
    })
    .sort((a, b) =>
      (a.consulta?.prazo_resposta ?? '').localeCompare(b.consulta?.prazo_resposta ?? ''),
    );
}

/** As que circulam e ninguém respondeu — sem referência amarrada. */
export function semPosicionamento(
  emCirculacao: AlegacaoEmCirculacao[],
): AlegacaoEmCirculacao[] {
  return emCirculacao.filter((item) => item.alegacao.referencia_id === null);
}

/** QUEM ESTÁ PERGUNTANDO — as instituições que mais mandaram consulta.
 *
 *  Separa "um banco insistindo" de "o mercado inteiro perguntando", que é a
 *  diferença entre uma relação a cuidar e um movimento a acompanhar.
 */
export function quemPergunta(
  consultas: Interacao[],
  nome: (id: string) => string,
  quantos = 5,
): ItemContado[] {
  const contagem = new Map<string, number>();
  for (const consulta of consultas) {
    contagem.set(consulta.instituicao_id, (contagem.get(consulta.instituicao_id) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, quantos)
    .map(([id, total]) => ({ chave: id, rotulo: nome(id), total }));
}

/** A composição das alegações por APURAÇÃO, na cor do dicionário.
 *
 *  Sempre um segmento por valor, mesmo com zero — a rosca não muda de forma de
 *  um recorte para outro. */
export function porApuracao(
  emCirculacao: AlegacaoEmCirculacao[],
  apuracoes: { id: number; codigo: string; nome: string; cor_hex: string }[],
): Segmento[] {
  const contagem = new Map<number, number>();
  for (const item of emCirculacao) {
    contagem.set(item.alegacao.apuracao_id, (contagem.get(item.alegacao.apuracao_id) ?? 0) + 1);
  }
  return apuracoes.map((apuracao) => ({
    chave: apuracao.codigo,
    rotulo: apuracao.nome,
    total: contagem.get(apuracao.id) ?? 0,
    cor: apuracao.cor_hex,
  }));
}
