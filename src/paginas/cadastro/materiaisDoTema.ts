/** Os materiais que a biblioteca traz quando um tema é marcado — e quais deles
 *  podem voltar sozinhos quando ele é desmarcado.
 *
 *  DESMARCAR LEVAVA TODA LINHA COM `referencia_id`, e a linha guarda esse
 *  vínculo a vida inteira, independentemente do que a pessoa tenha feito com
 *  ela depois. O dano concreto: trocar o anexo por um PDF mais novo (o upload
 *  grava o byte no servidor na hora), escrever um resumo, perceber que o tema
 *  certo era outro e desmarcar o primeiro — a linha some sem aviso, o resumo vai
 *  junto, e o arquivo fica órfão no blob, fora da varredura de órfãos, que "só
 *  alcança arquivo que já esteve ligado a um material".
 *
 *  A CONSTRUÇÃO E A COMPARAÇÃO SÃO O MESMO CÓDIGO, e é a razão de este módulo
 *  existir. "Esta linha ainda é a que a biblioteca trouxe?" só se responde
 *  sabendo o que a biblioteca traz — e se as duas respostas morarem em lugares
 *  diferentes, elas divergem no dia em que um campo for acrescentado à linha: a
 *  comparação continuaria dizendo "intocada" sobre uma linha já editada naquele
 *  campo novo, e o apagamento silencioso voltaria por uma porta nova.
 */

import { novoUid } from '@/paginas/cadastro/formulario';
import type { MaterialNoForm } from '@/paginas/cadastro/formulario';

/** O mínimo que este módulo precisa saber de uma referência da biblioteca. */
export interface ReferenciaDaBiblioteca {
  id: string;
  titulo: string;
  resumo?: string | null;
  temas: number[];
  versao?: { id: string } | null;
}

/** Como o endereço da versão é montado. Entra por parâmetro para o módulo não
 *  depender do cliente da API — e para o teste não precisar de rede. */
type UrlDaVersao = (referenciaId: string, versaoId: string) => string;

/** A linha como a biblioteca a entrega. */
export function linhaDaBiblioteca(
  referencia: ReferenciaDaBiblioteca,
  urlDaVersao: UrlDaVersao,
): MaterialNoForm {
  return {
    uid: novoUid(),
    momento: 'apoio',
    titulo: referencia.titulo,
    // O LINK DA VERSÃO ATUAL, e não "da referência". Uma versão nova depois
    // desta agenda NÃO muda este endereço, e é o certo: o material registra o
    // que circulou naquela reunião. Quem quiser a versão de hoje abre a
    // biblioteca.
    url: referencia.versao ? urlDaVersao(referencia.id, referencia.versao.id) : '',
    // O RESUMO VEM JUNTO. É o que a biblioteca guarda para quem está decidindo
    // se abre o arquivo, e chegar vazio aqui obrigaria a pessoa a abrir a
    // Administração para ler o que já estava escrito.
    observacao: referencia.resumo ?? '',
    arquivo_id: null,
    arquivo: null,
    referencia_id: referencia.id,
    // OS ASSUNTOS DA REFERÊNCIA, e não os da agenda: é a biblioteca que sabe do
    // que aquele documento trata, e ela pode cobrir assunto que esta reunião
    // não trata.
    temas: [...referencia.temas],
  };
}

/** Esta linha ainda é exatamente a que a biblioteca trouxe?
 *
 *  SÓ A INTOCADA PODE SAIR SOZINHA. Qualquer edição — título, resumo, link,
 *  arquivo, ou o momento da reunião em que ela entra — faz a linha passar a ser
 *  da pessoa, e o que é da pessoa não some porque um tema foi desmarcado.
 *
 *  SEM A REFERÊNCIA, A RESPOSTA É NÃO. Ela pode ter saído da biblioteca entre
 *  trazer e desmarcar; sem com o que comparar, o seguro é preservar. Apagar o
 *  que não se consegue conferir é exatamente o defeito que isto conserta.
 */
export function intocado(
  material: MaterialNoForm,
  referencia: ReferenciaDaBiblioteca | undefined,
  urlDaVersao: UrlDaVersao,
): boolean {
  if (!referencia) return false;
  const original = linhaDaBiblioteca(referencia, urlDaVersao);
  return (
    material.momento === original.momento &&
    material.titulo === original.titulo &&
    material.url === original.url &&
    material.observacao === original.observacao &&
    !material.arquivo_id
  );
}
