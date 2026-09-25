/** Limpar o formulário sem que isso seja um caminho sem volta.
 *
 *  "Limpar" fica imediatamente à esquerda de "Salvar interação", num rodapé
 *  alinhado à direita. No caminho de EDIÇÃO ele já era seguro — ali o botão
 *  chama-se "Desfazer alterações" e restaura o que veio do servidor. No de
 *  CRIAÇÃO não há registro carregado, e ele caía no formulário vazio: quinze
 *  minutos de preenchimento, duas listas de participantes e três materiais iam
 *  embora num clique 10px fora do alvo, sem diálogo e sem volta.
 *
 *  DESFAZER, E NÃO CONFIRMAR — decisão de quem cuida do produto. Um diálogo de
 *  confirmação cobra um gesto de TODAS as vezes para proteger o acidente de
 *  uma, e é exatamente o controle que se aprende a clicar sem ler. O desfazer
 *  não cobra nada de quem quis limpar, e devolve tudo a quem não quis.
 *
 *  POR QUE UM MÓDULO PARA TRÊS LINHAS DE ESTADO. Porque a regra não é o
 *  `useState` — é "não oferecer desfazer quando não havia o que perder" e "o
 *  desfazer vale por um gesto", e nenhuma das duas se alcança de um teste
 *  enquanto viverem dentro do componente. É a mesma razão de `dominio/` existir:
 *  o que decide fica onde dá para provar.
 */

import type { Formulario } from '@/paginas/cadastro/formulario';

export interface Limpeza {
  /** O formulário como ele fica depois do gesto. */
  form: Formulario;
  /** O que dá para restaurar — nulo quando não há nada a devolver. */
  desfazer: Formulario | null;
}

/** Esvazia o formulário, guardando o que estava lá.
 *
 *  `vazio` chega por parâmetro, e não é importado aqui: `VAZIO` carrega a data
 *  de hoje, e um módulo que a fixasse no carregamento devolveria a data de
 *  ontem numa aba deixada aberta durante a noite.
 */
export function limpar(form: Formulario, vazio: Formulario): Limpeza {
  //: NÃO OFERECER O QUE NÃO SE PODE DEVOLVER. Um "Desfazer limpeza" depois de
  //: limpar o que já estava vazio promete restaurar algo que não existe — e um
  //: aviso que mente uma vez deixa de ser lido quando importar.
  const havia = JSON.stringify(form) !== JSON.stringify(vazio);
  return { form: vazio, desfazer: havia ? form : null };
}

/** O formulário de volta, ou `null` quando já não há o que restaurar. */
export function desfazerLimpeza(limpeza: Limpeza): Formulario | null {
  return limpeza.desfazer;
}
