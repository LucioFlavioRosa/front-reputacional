/** O vocabulário e a ordem da conferência da importação.
 *
 *  FORA DO COMPONENTE PORQUE ERRAR AQUI CUSTA CARO: se a ordem errar, o
 *  botão acende com pendência aberta e alguém cria 54 agendas que não foram
 *  conferidas. O critério é o do README — não o tamanho do arquivo, mas "o que
 *  acontece se isto estiver errado?" —, e teste dentro de JSX é teste que não se
 *  escreve.
 *
 *  E FORA DA PASTA DA TELA, desde 17/10/2026. Era `paginas/importacao/grupos.ts`,
 *  e `api/importacao.ts` importava `Grupo` e `ACriar` de lá — o módulo do
 *  CONTRATO dependendo de uma pasta de tela. `Grupo` é a forma que
 *  `GET /api/importacoes/{id}` devolve: ela descreve a resposta, não o
 *  componente que a desenha. Aqui os três tipos ficam ao lado dos outros tipos
 *  de resposta do domínio, e a dependência corre no sentido certo —
 *  `paginas/importacao/` e `api/importacao.ts` leem daqui.
 */

/** Um grupo de divergência, como `GET /api/importacoes/{id}` o devolve. */
export interface Grupo {
  campo: string;
  valor: string;
  /** Os números de linha DO ARQUIVO que esta decisão destrava. */
  linhas: number[];
  /** `true` segura a confirmação; `false` apenas avisa. */
  trava: boolean;
  /** Nomes parecidos já cadastrados, para oferecer num clique.
   *
   *  CARREGA O ALVO junto do nome. O nome sozinho não servia: a tela o mandava
   *  como `alvo` e o servidor valida `alvo` como id — o atalho principal da
   *  conferência devolvia 422. */
  sugestoes: Sugestao[];
  /** Se a importação sabe criar cadastro para este campo. Quando `false`, o botão
   *  de cadastrar não aparece: oferecer o que o servidor recusa é pior que não
   *  oferecer. */
  pode_criar: boolean;
}

export interface Sugestao {
  nome: string;
  /** O id (ou código) que `apontar` aceita. */
  alvo: string;
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


