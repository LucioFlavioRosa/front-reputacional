/** A lógica da tela de conferência da importação.
 *
 *  FORA DO COMPONENTE PORQUE ERRAR AQUI CUSTA CARO: se `podeConfirmar` errar, o
 *  botão acende com pendência aberta e alguém cria 54 agendas que não foram
 *  conferidas. O critério é o do README — não o tamanho do arquivo, mas "o que
 *  acontece se isto estiver errado?" —, e teste dentro de JSX é teste que não se
 *  escreve.
 */

/** Um grupo de divergência, como `GET /api/importacoes/{id}` o devolve. */
export interface Grupo {
  campo: string;
  valor: string;
  /** Os números de linha DO ARQUIVO que esta decisão destrava. */
  linhas: number[];
  /** `true` segura a confirmação; `false` apenas avisa. */
  trava: boolean;
  /** Nomes parecidos já cadastrados, para oferecer num clique. */
  sugestoes: string[];
}

/** Uma decisão já tomada — o bloco "o que vou criar". */
export interface ACriar {
  campo: string;
  valor: string;
  /** `criar` um cadastro novo, ou `apontar` para um existente. */
  acao: string;
  alvo: string | null;
  linhas: number[];
}

/** O botão de confirmar só acende quando nada mais segura a importação.
 *
 *  ESCONDER O BOTÃO É CONVENIÊNCIA, NUNCA CONTROLE: o servidor recusa a
 *  confirmação com pendência aberta por conta própria. Isto existe para a pessoa
 *  não tentar, não para impedi-la.
 */
export function podeConfirmar(grupos: Grupo[]): boolean {
  return !grupos.some((grupo) => grupo.trava);
}

/** Quantas DECISÕES a pessoa tem pela frente.
 *
 *  Decisões, e não linhas: quem conta linhas é o servidor, em `pendencias`. A
 *  tela mostra os dois porque juntos é que contam a história — "12 linhas presas
 *  por 2 decisões" diz o tamanho do trabalho; cada número sozinho engana.
 */
export function pendencias(grupos: Grupo[]): number {
  return grupos.filter((grupo) => grupo.trava).length;
}

/** Os grupos na ordem em que a tela os lista: o que trava primeiro, e dentro de
 *  cada severidade o que destrava mais linhas.
 *
 *  NÃO ORDENA A LISTA QUE RECEBEU. `sort` ordena no lugar, e a lista vem do
 *  estado do React — reordenar a original faria a tela se remexer por baixo de
 *  quem a estava lendo.
 */
export function porUrgencia(grupos: Grupo[]): Grupo[] {
  return [...grupos].sort((a, b) => {
    if (a.trava !== b.trava) return a.trava ? -1 : 1;
    if (a.linhas.length !== b.linhas.length) return b.linhas.length - a.linhas.length;
    return a.valor.localeCompare(b.valor, 'pt-BR');
  });
}

interface Estado {
  agendas: number;
  /** Quantas LINHAS o servidor diz que estão presas. */
  pendencias: number;
  /** Quantas decisões resolvem essas linhas. */
  decisoesPendentes: number;
  aCriar: ACriar[];
}

/** Os números do cabeçalho: "54 agendas · 12 pendências em 2 decisões · 3 cadastros novos".
 *
 *  É A PRIMEIRA COISA QUE A PESSOA LÊ para decidir se tem tempo de conferir
 *  agora, e por isso responde "quanto falta" e não "o que há".
 */
export function cabecalho(estado: Estado): {
  agendas: number;
  pendencias: number;
  decisoes: number;
  cadastrosNovos: number;
} {
  return {
    agendas: estado.agendas,
    pendencias: estado.pendencias,
    decisoes: estado.decisoesPendentes,
    // SÓ O QUE VAI SER CRIADO. Apontar para um cadastro existente é decisão
    // tomada e aparece no mesmo bloco, mas não cria nada — somá-lo diria à
    // pessoa que a importação vai criar registros que ela escolheu não criar.
    cadastrosNovos: estado.aCriar.filter((item) => item.acao === 'criar').length,
  };
}
