/** Funções puras dos cartões laterais, do cartão de recortes e do modal de
 *  prévia (E.4.3, E.6.4, E.8, F.8).
 *
 *  FICAM FORA DOS `.tsx` porque o lint exige que arquivo de componente
 *  exporte só componente, e porque assim a regra de cada busca (achar o item
 *  da história, o subtema de destino, o pilar pelo nome) tem teste próprio
 *  sem montar tela.
 *
 *  NADA AQUI LANÇA: id que não existe na base devolve `undefined`, e o
 *  componente simplesmente não desenha aquele pedaço. Um JSON incompleto não
 *  pode derrubar o bloco.
 */

import { escreverEndereco } from '../endereco';
import type { EnderecoDoDrill } from '../endereco';
import { pilarNavegavel } from '../dados/seletores';
import type { CartaoLateral, Item, Lente, Pilar, Subtema } from '../dados/tipos';

/** O post da Sociedade digital (cartão `post`). */
export type PostLateral = Extract<CartaoLateral, { tipo: 'post' }>['post'];

/** O que o modal de prévia mostra: uma matéria, ou um post com o título do
 *  cartão em que ele aparece (o post não tem título próprio). */
export type AlvoDaPrevia = { tipo: 'item'; item: Item } | { tipo: 'post'; post: PostLateral; titulo: string };

/** `'Agosto de 2026'` → `'agosto'`. Sem o " de ", usa o rótulo inteiro em
 *  minúsculas; rótulo vazio dá `''` (o kicker sai sem o mês, nunca quebra). */
export function nomeDoMes(rotuloMes: string): string {
  const [mes] = rotuloMes.trim().split(/\s+de\s+/i);
  return (mes ?? '').trim().toLocaleLowerCase('pt-BR');
}

/** Todos os subtemas da lente, em qualquer pilar e tema. */
function subtemasDa(lente: Lente): Subtema[] {
  return lente.pilares.flatMap((p) => (p.filhos ?? []).flatMap((t) => t.filhos ?? []));
}

/** O item da amostra com este id, procurado nos subtemas da lente. */
export function acharItem(lente: Lente, itemId: string): Item | undefined {
  for (const s of subtemasDa(lente)) {
    const item = s.nivel4?.itens.find((i) => i.id === itemId);
    if (item) return item;
  }
  return undefined;
}

/** O subtema do `destino` da história, descendo pilar → tema → subtema. */
export function acharSubtemaDoDestino(
  lente: Lente,
  destino: { pilar: string; tema: string; subtema: string },
): Subtema | undefined {
  const pilar = lente.pilares.find((p) => p.id === destino.pilar);
  const tema = pilar?.filhos?.find((t) => t.id === destino.tema);
  return tema?.filhos?.find((s) => s.id === destino.subtema);
}

/** O pilar da lente com este nome, SÓ SE FOR NAVEGÁVEL (regra C.3, decisão
 *  A16). As linhas do "O que mudou" trazem o nome, não o id. */
export function pilarNavegavelPeloNome(lente: Lente, nome: string): Pilar | undefined {
  const pilar = lente.pilares.find((p) => p.nome === nome);
  return pilar && pilarNavegavel(lente, pilar) ? pilar : undefined;
}

/** O endereço do Nível 2 de um pilar. */
export function enderecoDoPilar(lente: Lente, pilar: Pilar): EnderecoDoDrill {
  return { ativo: true, lente: lente.id, pilar: pilar.id };
}

/** O endereço do Nível 4 do destino da história. */
export function enderecoDoDestino(destino: { lente: string; pilar: string; tema: string; subtema: string }): EnderecoDoDrill {
  return { ativo: true, lente: destino.lente, pilar: destino.pilar, tema: destino.tema, subtema: destino.subtema };
}

/** O `href` de um link do drill: só o hash, que o navegador resolve sobre o
 *  endereço atual (caminho e consulta do CRM ficam como estão). */
export function hrefDoDrill(e: EnderecoDoDrill): string {
  return escreverEndereco(e);
}

/** Só endereço http(s) vira link de saída. Qualquer outra coisa (vazio,
 *  `javascript:`, `#`) é tratada como "sem link". */
export function urlSegura(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\/\S+$/i.test(url.trim()) ? url.trim() : null;
}

/** O maior volume entre as linhas (a barra dele ocupa 100%). Lista vazia dá
 *  0, e a barra (via `larguraPct`) não divide por zero. */
export function maiorVolume(linhas: readonly { volume: number }[]): number {
  return linhas.reduce((m, l) => Math.max(m, l.volume), 0);
}
