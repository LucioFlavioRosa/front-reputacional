/** O endereço do drill como estado de React (decisão A3).
 *
 *  A FONTE DA VERDADE É O PRÓPRIO `location.hash`, e não um `useState`: assim
 *  voltar e avançar do navegador, recarregar a página e navegar pelo código
 *  passam todos pelo mesmo caminho, e duas partes da tela que leem o endereço
 *  nunca discordam.
 *
 *  POR QUE `history` E NÃO `location.hash = …`: atribuir o hash faz o
 *  navegador rolar até uma âncora e sempre empilha uma entrada na história.
 *  `pushState`/`replaceState` não rolam, deixam escolher entre empilhar
 *  (descer ou subir de nível) e substituir (filtros, ordenação, correção de
 *  endereço inválido), e não disparam `popstate`; por isso toda navegação
 *  programática dispara o evento próprio `EVENTO_DO_ENDERECO`.
 *
 *  QUEM MAIS REGRAVA O ENDEREÇO (o recorte do CRM em `definirRecorte`, a
 *  navegação em `irPara`) precisa preservar `location.hash`: este hook só
 *  escuta `popstate` e `EVENTO_DO_ENDERECO`, e o hash apagado por fora levaria
 *  o drill ao Nível 1 na renderização seguinte, sem aviso (decisão A3).
 */

import { useMemo, useSyncExternalStore } from 'react';

import { escreverEndereco, lerEndereco } from './endereco';
import type { EnderecoDoDrill } from './endereco';

/** Disparado em `window` a cada navegação programática do drill. */
export const EVENTO_DO_ENDERECO = 'consulta:endereco';

// ---------------------------------------------------------------------------
// Pedido de foco (decisões A5 e A6)
// ---------------------------------------------------------------------------
//
// QUEM ESCOLHE UM NÓ FORA DO DRILL (a busca do cabeçalho) PEDE FOCO: a raiz
// rola até o topo do bloco e foca o título do nível MESMO QUANDO MONTA AGORA
// (o bloco estava fechado, ou a busca veio da Visão geral) ou quando a lente
// muda junto. Sem o pedido, a raiz não distingue essa montagem da de quem
// abriu o bloco à mão ou recarregou a página, e nesses casos não deve pular
// a tela.
//
// UM CONTADOR NO MÓDULO, e não uma marca no `history.state`: recarregar zera
// o módulo (recarregar não rola), voltar e avançar não pedem nada, e cada
// pedido é atendido uma vez só (`atenderPedidoDeFoco`). Pedir de novo o nó em
// que a pessoa já está também rola, porque o contador muda mesmo sem o hash
// mudar.

let pedidosDeFoco = 0;
let pedidosAtendidos = 0;

/** Leva o drill a `novo`, preservando caminho e consulta do endereço (a
 *  consulta é do recorte do CRM). `push` empilha na história; `replace`
 *  substitui a entrada atual. `focar` pede à raiz que role até o bloco e
 *  foque o título do nível, mesmo se ela montar agora ou a lente mudar. */
export function navegarNoDrill(
  novo: EnderecoDoDrill,
  modo: 'push' | 'replace',
  opcoes: { focar?: boolean } = {},
): void {
  const url = window.location.pathname + window.location.search + escreverEndereco(novo);
  if (modo === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
  if (opcoes.focar) pedidosDeFoco += 1;
  window.dispatchEvent(new CustomEvent(EVENTO_DO_ENDERECO));
}

/** Atende o pedido de foco pendente, se houver: devolve `true` uma vez por
 *  pedido. A raiz chama num efeito, com o nível já na tela. */
export function atenderPedidoDeFoco(): boolean {
  if (pedidosAtendidos === pedidosDeFoco) return false;
  pedidosAtendidos = pedidosDeFoco;
  return true;
}

function assinar(avisar: () => void): () => void {
  window.addEventListener('popstate', avisar);
  window.addEventListener(EVENTO_DO_ENDERECO, avisar);
  return () => {
    window.removeEventListener('popstate', avisar);
    window.removeEventListener(EVENTO_DO_ENDERECO, avisar);
  };
}

/** O SNAPSHOT É A STRING DO HASH, não o objeto lido: `useSyncExternalStore`
 *  compara snapshots por identidade, e um objeto novo a cada leitura faria a
 *  tela renderizar em laço. O objeto é derivado com `useMemo` sobre a string. */
function lerHash(): string {
  return window.location.hash;
}

function hashNoServidor(): string {
  return '';
}

export function useEnderecoDoDrill(): EnderecoDoDrill {
  const hash = useSyncExternalStore(assinar, lerHash, hashNoServidor);
  return useMemo(() => lerEndereco(hash), [hash]);
}

function lerPedidos(): number {
  return pedidosDeFoco;
}

function semPedidosNoServidor(): number {
  return 0;
}

/** O número do último pedido de foco: muda a cada `navegarNoDrill` com
 *  `focar`, mesmo quando o hash não muda, e faz a raiz renderizar e rodar o
 *  efeito que atende o pedido. */
export function usePedidoDeFoco(): number {
  return useSyncExternalStore(assinar, lerPedidos, semPedidosNoServidor);
}
