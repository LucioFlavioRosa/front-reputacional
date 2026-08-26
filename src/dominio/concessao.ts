/**
 * A montagem do que a tela manda ao servidor.
 *
 *  Está fora do componente de propósito. O payload é onde os erros desta tela
 *  doem: um campo esquecido apaga o alcance de alguém, e ninguém percebe — o
 *  acesso simplesmente volta a ser o de antes. Função pura é o que permite
 *  testar isso sem montar árvore de React.
 */

import type { Acesso, Concessao } from '@/dominio/tipos';

/** O que o formulário tem preenchido no momento de salvar. */
export interface Formulario {
  papel: string;
  irrestrito: boolean;
  externo: boolean;
  expira: string;
  frentes: string;
  unidades: string;
}

export function formularioDe(pessoa: Acesso): Formulario {
  return {
    papel: pessoa.papel ?? '',
    irrestrito: pessoa.acesso_irrestrito,
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
export function impedimento(formulario: Formulario): string | null {
  if (formulario.papel && formulario.externo && !formulario.expira) {
    return 'Acesso de quem é de fora exige prazo.';
  }
  if (formulario.externo && formulario.irrestrito) {
    return 'Acesso irrestrito não se combina com acesso de fora.';
  }
  return null;
}

export function montarConcessao(pessoa: Acesso, formulario: Formulario): Concessao {
  return {
    papel: formulario.papel || null,
    acesso_irrestrito: formulario.irrestrito,
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
