/**
 * A montagem do que a tela manda ao servidor.
 *
 *  Está fora do componente de propósito. O payload é onde os erros desta tela
 *  doem: um campo esquecido apaga o alcance de alguém, e ninguém percebe — o
 *  acesso simplesmente volta a ser o de antes. Função pura é o que permite
 *  testar isso sem montar árvore de React.
 */

import type { Acesso, Concessao, PapelDisponivel } from '@/dominio/tipos';

/** O que o formulário tem preenchido no momento de salvar.
 *
 *  O PAPEL É A ÚNICA VERDADE sobre nível e papel-nos-painéis. A tela de perfis
 *  mostra os dois como camadas separadas, mas não os guarda: ela os PROJETA do
 *  código do papel (ver `dominio/perfis.ts`) e, ao clicar, escolhe outro papel.
 *  Guardar as camadas em paralelo criaria dois estados para a mesma coisa, e
 *  eles divergiriam no primeiro caso de borda.
 */
export interface Formulario {
  papel: string;
  irrestrito: boolean;
  /** A terceira camada: se a pessoa alcança os campos sensíveis. */
  sensivel: boolean;
  externo: boolean;
  expira: string;
  frentes: string;
  unidades: string;
}

export function formularioDe(pessoa: Acesso): Formulario {
  return {
    papel: pessoa.papel ?? '',
    irrestrito: pessoa.acesso_irrestrito,
    sensivel: pessoa.sensivel,
    externo: pessoa.externo,
    expira: pessoa.expira_em ?? '',
    frentes: pessoa.frentes.join(', '),
    unidades: pessoa.unidades.join(', '),
  };
}

/**
 * O que impede o formulário de ser salvo, ou nulo se está pronto.
 *
 *  Existe para não deixar montar um estado que o backend necessariamente
 *  recusa. Descobrir "acesso externo exige prazo" depois de preencher tudo é o
 *  tipo de coisa que faz alguém desistir da tela.
 */
export function impedimento(
  formulario: Formulario,
  catalogo: readonly PapelDisponivel[] = [],
): string | null {
  if (formulario.papel && formulario.externo && !formulario.expira) {
    return 'Acesso de quem é de fora exige prazo.';
  }
  if (formulario.externo && formulario.irrestrito) {
    return 'Acesso irrestrito não se combina com acesso de fora.';
  }

  //: NÃO SE MARCA SENSÍVEL ACIMA DO TETO DO PAPEL.
  //:
  //: O backend recusa (migration 0087), e a recusa não protege dado nenhum — a
  //: conjunção já tornaria o acesso falso. Ela protege a tela de dizer uma
  //: coisa e o sistema fazer outra: a pessoa apareceria "com acesso sensível",
  //: não veria o campo, e quem administra procuraria o defeito no lugar errado.
  //:
  //: `catalogo` tem padrão vazio para não quebrar quem chama só com o
  //: formulário — e, vazio, esta regra não opina: sem saber o teto do papel,
  //: inventar um impedimento seria pior do que deixar o backend responder.
  if (formulario.papel && formulario.sensivel) {
    const papel = catalogo.find((p) => p.codigo === formulario.papel);
    if (papel && !papel.ve_campos_sensiveis) {
      return `O papel ${papel.nome} não alcança informação sensível.`;
    }
  }
  return null;
}

export function montarConcessao(pessoa: Acesso, formulario: Formulario): Concessao {
  return {
    papel: formulario.papel || null,
    acesso_irrestrito: formulario.irrestrito,
    //: Sem papel, a camada sensível não existe — e o backend a zera de todo
    //: jeito, porque revogar é estado limpo. Mandar `true` aqui faria a tela
    //: afirmar uma coisa que o banco não guarda.
    sensivel: formulario.papel ? formulario.sensivel : false,
    externo: formulario.externo,
    expira_em: formulario.expira || null,
    frentes: listaDe(formulario.frentes),
    unidades: listaDe(formulario.unidades),
    // O que a tela viu ao abrir. Se o banco tiver outra versão, a função
    // recusa em vez de apagar a alteração de outra pessoa.
    versao_vista: pessoa.concedido_em,
  };
}

/** "imprensa, governo" -> ["imprensa", "governo"], sem entradas vazias. */
export function listaDe(bruto: string): string[] {
  return bruto
    .split(',')
    .map((valor) => valor.trim())
    .filter(Boolean);
}
