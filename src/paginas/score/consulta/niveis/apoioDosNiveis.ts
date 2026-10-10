/** Apoio dos quatro níveis e da raiz da Consulta em profundidade: os
 *  endereços de cada nível, as métricas de impacto dos resumos e a rolagem
 *  até o topo do bloco ao trocar de nível (decisão A5).
 *
 *  FICA NUM `.ts` porque o lint exige que arquivo de componente exporte só
 *  componente, e porque assim a conta da rolagem (cabeçalho fixo + faixa de
 *  filtros fixa) tem teste próprio sem montar a tela.
 */

import { enderecoDoPilar } from '../componentes/apoioDosCartoes';
import type { PostLateral } from '../componentes/apoioDosCartoes';
import type { MetricaDoResumo } from '../componentes/ResumoDoNivel';
import type { Caminho } from '../dados/seletores';
import type { Item, Lente, No, Pilar, Subtema, Tema } from '../dados/tipos';
import type { EnderecoDoDrill } from '../endereco';
import { arred, corDoSinal, fmtPt } from '../formatacao';

// ---------------------------------------------------------------------------
// O que todo nível recebe da raiz
// ---------------------------------------------------------------------------

/** Ações que a raiz entrega aos níveis. A raiz é dona do endereço (desce e
 *  sobe com `push`) e do modal de prévia; o nível só diz para onde ir e o
 *  que abrir. */
export interface AcoesDoNivel {
  /** Desce ou sobe de nível (`pushState`). */
  aoIr: (endereco: EnderecoDoDrill) => void;
  /** Abre a prévia de uma matéria; `botao` recebe o foco de volta (F.8). */
  aoAbrirItem: (item: Item, botao: HTMLElement) => void;
  aoAbrirPost: (post: PostLateral, titulo: string, botao: HTMLElement) => void;
}

// ---------------------------------------------------------------------------
// Endereços dos níveis
// ---------------------------------------------------------------------------

/** "Clipei, ponderado pelo tier do veículo" → "Clipei": o nome da fonte da
 *  lente, sem o complemento depois da vírgula (rodapé da lista, F.9). */
export function nomeDaFonte(fonte: string): string {
  return (fonte.split(',')[0] ?? '').trim();
}

/** Nível 1 da lente: só a lente, sem níveis e sem filtros. */
export function enderecoDaLente(lente: Lente): EnderecoDoDrill {
  return { ativo: true, lente: lente.id };
}

/** Nível 3: a lente, o pilar e o tema. O Nível 2 é `enderecoDoPilar`, de
 *  `apoioDosCartoes` (o mesmo que os cartões laterais usam). */
export function enderecoDoTema(lente: Lente, pilar: Pilar, tema: Tema): EnderecoDoDrill {
  return { ...enderecoDoPilar(lente, pilar), tema: tema.id };
}

/** Nível 4: a descida completa, sem filtros da lista (ela começa limpa). */
export function enderecoDoSubtema(lente: Lente, pilar: Pilar, tema: Tema, subtema: Subtema): EnderecoDoDrill {
  return { ...enderecoDoTema(lente, pilar, tema), subtema: subtema.id };
}

/** O endereço do NÍVEL do caminho, sem filtros da lista: é a chave que diz
 *  "a tela mudou de nível ou de nó". Trocar `sent`, `ordem`, `tier`, `conc`,
 *  `uf` ou `item` não a muda, e por isso não rola nem move o foco (A5). */
export function enderecoDoNivel(caminho: Caminho): EnderecoDoDrill {
  const { lente, pilar, tema, subtema } = caminho;
  const e = enderecoDaLente(lente);
  if (pilar) e.pilar = pilar.id;
  if (pilar && tema) e.tema = tema.id;
  if (pilar && tema && subtema) e.subtema = subtema.id;
  return e;
}

// ---------------------------------------------------------------------------
// Métricas dos resumos
// ---------------------------------------------------------------------------

/** "Impacto" de um pilar, tema ou subtema, colorido pelo número ESCRITO (um
 *  valor que arredonda para "0,0 pt" fica cinza, não vermelho). */
export function metricaDeImpacto(no: No): MetricaDoResumo {
  return { rotulo: 'Impacto', valor: fmtPt(no.impacto), cor: corDoSinal(arred(no.impacto, 1)) };
}

/** "vs. julho" = `impacto − impactoMesAnterior` (E.5.2, E.6.2), SÓ SE O MÊS
 *  ANTERIOR EXISTIR no JSON: sem ele, a métrica não aparece (nunca um zero
 *  inventado). O rótulo usa `meta.mesAnterior`. */
export function metricaVsMesAnterior(no: No, mesAnterior: string): MetricaDoResumo[] {
  if (no.impactoMesAnterior === undefined) return [];
  const diferenca = no.impacto - no.impactoMesAnterior;
  return [{ rotulo: `vs. ${mesAnterior}`, valor: fmtPt(diferenca), cor: corDoSinal(arred(diferenca, 1)) }];
}

// ---------------------------------------------------------------------------
// Rolagem ao trocar de nível (decisão A5)
// ---------------------------------------------------------------------------

/** Folga entre a faixa fixa e o topo do bloco, para o bloco não encostar. */
const FOLGA_DA_ROLAGEM = 12;

/** Altura do que fica FIXO NO TOPO da janela acima do drill: o cabeçalho
 *  (`--altura-cabecalho`, medida e publicada por `Layout.tsx`) e a faixa de
 *  filtros da lente, que gruda logo abaixo dele.
 *
 *  A FAIXA É ACHADA PELO QUE ELA É, e não por uma classe que ninguém põe:
 *  `FaixaDeFiltros` é `position: sticky` com `top: var(--altura-cabecalho)`,
 *  em estilo inline. Vale só a que vem ANTES do bloco no documento e fora
 *  dele (uma faixa depois do drill nunca o cobre); com mais de uma, a mais
 *  alta. Sem faixa na tela, conta só o cabeçalho. */
export function alturaFixaAcima(bloco: HTMLElement): number {
  const raiz = document.documentElement;
  const cabecalho = Number.parseFloat(getComputedStyle(raiz).getPropertyValue('--altura-cabecalho')) || 0;

  let faixa = 0;
  const fixos = document.querySelectorAll<HTMLElement>('[style*="sticky"][style*="--altura-cabecalho"]');
  fixos.forEach((el) => {
    if (bloco.contains(el)) return;
    if (!(bloco.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING)) return;
    faixa = Math.max(faixa, el.getBoundingClientRect().height);
  });
  return cabecalho + faixa;
}

/** Rola a janela até o topo do bloco do drill, logo abaixo do cabeçalho e da
 *  faixa fixos. SEM ANIMAÇÃO (D.3): `behavior: 'auto'`. Nunca rola para
 *  antes do topo da página. */
export function rolarAteOTopoDoBloco(bloco: HTMLElement): void {
  const topoNoDocumento = bloco.getBoundingClientRect().top + window.scrollY;
  const top = Math.max(0, Math.round(topoNoDocumento - alturaFixaAcima(bloco) - FOLGA_DA_ROLAGEM));
  window.scrollTo({ top, behavior: 'auto' });
}
