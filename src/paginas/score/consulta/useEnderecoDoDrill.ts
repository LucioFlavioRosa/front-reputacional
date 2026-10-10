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

/** Leva o drill a `novo`, preservando caminho e consulta do endereço (a
 *  consulta é do recorte do CRM). `push` empilha na história; `replace`
 *  substitui a entrada atual. */
export function navegarNoDrill(novo: EnderecoDoDrill, modo: 'push' | 'replace'): void {
  const url = window.location.pathname + window.location.search + escreverEndereco(novo);
  if (modo === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
  window.dispatchEvent(new CustomEvent(EVENTO_DO_ENDERECO));
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
