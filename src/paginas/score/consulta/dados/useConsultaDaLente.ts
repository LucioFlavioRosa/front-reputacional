/** Os dados reais da Consulta em profundidade de uma lente num mês (D5).
 *
 *  UM CACHE SÓ, NO MÓDULO, pela chave `lente|mes`: a raiz do drill e a busca
 *  do cabeçalho pedem a mesma árvore da Imprensa, e cada chave vira UMA
 *  requisição, quem quer que peça primeiro. Voltar a um mês já visto mostra a
 *  árvore na hora, sem "Carregando".
 *
 *  `useSyncExternalStore` SOBRE O CACHE, e não `useState` + efeito: o efeito
 *  só dispara a busca (não chama `setState`), e quem avisa a tela é o próprio
 *  cache quando a resposta chega. Trocar de mês ou de lente troca a chave e o
 *  retrato no mesmo render, então a tela nunca mostra, por um instante, a
 *  árvore do mês anterior como se fosse a do novo.
 *
 *  O CACHE ENVELHECE QUANDO OS DADOS MUDAM: toda escrita bem-sucedida no Score
 *  (subir a planilha do mês, gravar ou restaurar a calibração, os veículos do
 *  Mercado) e no catálogo (a taxonomia de temas) chega por `scoreMudou` /
 *  `catalogoMudou`, avisados pelo próprio cliente da API, nesta aba ou em
 *  outra. Aí toda chave fica obsoleta: a que está na tela é pedida de novo na
 *  hora, mostrando a árvore antiga até a nova chegar (sem "Carregando" e sem
 *  levar o drill ao Nível 1); as outras, na próxima vez que alguém as pedir.
 *  Sem isto, a árvore ficava velha a sessão inteira enquanto a Jornada, logo
 *  acima, já mostrava a nota nova.
 *
 *  ERRO NÃO FICA PRESO NO CACHE: a próxima montagem que pedir a mesma chave
 *  tenta de novo, e `tentarConsultaDeNovo` faz o mesmo a partir de um gesto
 *  (o botão da faixa de erro, o foco na busca).
 */

import { useEffect, useSyncExternalStore } from 'react';

import { obterConsultaDaLente } from '@/api/cliente';
import { catalogoMudou, scoreMudou } from '@/dominio/sincronizacao';

import type { Dados } from './tipos';

/** As lentes que têm o bloco "Drill down" no front (D2). Só elas são
 *  buscadas: o endpoint devolve 404 para as outras. */
export const LENTES_COM_DRILL: readonly string[] = ['imprensa', 'mercado'];

export interface EstadoDaConsulta {
  dados: Dados | null;
  erro: string | null;
  carregando: boolean;
}

// RETRATOS CONSTANTES: `useSyncExternalStore` compara por identidade, e um
// objeto novo a cada leitura faria a tela renderizar sem parar.
const CARREGANDO: EstadoDaConsulta = { dados: null, erro: null, carregando: true };
const SEM_CONSULTA: EstadoDaConsulta = { dados: null, erro: null, carregando: false };

const cache = new Map<string, EstadoDaConsulta>();
/** Chaves cujo retrato é de antes da última escrita no Score: continuam na
 *  tela, mas o próximo pedido busca de novo. */
const obsoletas = new Set<string>();
/** A requisição em voo de cada chave. O símbolo é a identidade do pedido: a
 *  resposta de um pedido esquecido (`esquecerConsultas`, ou em voo quando os
 *  dados mudaram) é descartada. */
const emVoo = new Map<string, symbol>();
/** Quantas telas montadas pedem cada chave: são as que uma mudança nos dados
 *  pede de novo na hora. */
const interessados = new Map<string, { lente: string; mes: string; telas: number }>();
const ouvintes = new Set<() => void>();

function avisar(): void {
  for (const ouvinte of ouvintes) ouvinte();
}

function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function chaveDaConsulta(lente: string, mes: string): string {
  return `${lente}|${mes}`;
}

/** Garante a requisição da chave: não repete a que já chegou (e não está
 *  obsoleta) nem a que está em voo; a que falhou é refeita.
 *
 *  `deDentroDeEfeito`: a nova tentativa depois de um erro troca o retrato
 *  para "Carregando". Vinda de um efeito, a notificação vai para a próxima
 *  microtarefa, para não renderizar em cascata no meio do commit (o
 *  equivalente a um `setState` síncrono no efeito); vinda de um gesto, sai
 *  na hora. */
function buscar(lente: string, mes: string, deDentroDeEfeito: boolean): void {
  const chave = chaveDaConsulta(lente, mes);
  if (emVoo.has(chave)) return;
  const atual = cache.get(chave);
  if (atual && atual.erro === null && !obsoletas.has(chave)) return;

  const pedido = Symbol(chave);
  emVoo.set(chave, pedido);
  obsoletas.delete(chave);
  if (atual && atual.erro !== null) {
    // ERA ERRO: a faixa vira "Carregando" enquanto a nova tentativa corre.
    // (OBSOLETA COM DADOS fica como está: a árvore antiga até a nova chegar.)
    cache.delete(chave);
    if (deDentroDeEfeito) queueMicrotask(avisar);
    else avisar();
  }

  const concluir = (estado: EstadoDaConsulta) => {
    if (emVoo.get(chave) !== pedido) return;
    emVoo.delete(chave);
    cache.set(chave, estado);
    avisar();
  };
  obterConsultaDaLente(lente, mes).then(
    (dados) => concluir({ dados, erro: null, carregando: false }),
    (falha: unknown) =>
      concluir({
        dados: null,
        erro: falha instanceof Error && falha.message ? falha.message : 'Não foi possível ler a consulta do mês.',
        carregando: false,
      }),
  );
}

/** Tenta de novo a consulta que falhou, a partir de um gesto (o botão da
 *  faixa de erro, o foco na busca). Não faz nada se a chave já tem dados
 *  atuais ou está em voo. */
export function tentarConsultaDeNovo(lente: string, mes: string): void {
  if (!LENTES_COM_DRILL.includes(lente) || !mes) return;
  buscar(lente, mes, false);
}

/** Os dados do Score mudaram: todo retrato fica obsoleto, a resposta em voo
 *  (que pode ser de antes da escrita) é descartada, e as chaves que estão na
 *  tela são pedidas de novo. */
export function invalidarConsultas(): void {
  for (const chave of cache.keys()) obsoletas.add(chave);
  emVoo.clear();
  for (const { lente, mes } of interessados.values()) buscar(lente, mes, false);
}

scoreMudou.assinar(invalidarConsultas);
catalogoMudou.assinar(invalidarConsultas);

/** Esvazia o cache e descarta as respostas em voo. Para os testes: cada um
 *  começa sem nada carregado. */
export function esquecerConsultas(): void {
  cache.clear();
  obsoletas.clear();
  emVoo.clear();
  avisar();
}

/** A consulta da lente no mês. `lente` nula (ou sem drill no front) não busca
 *  nada e devolve `{ dados: null, erro: null, carregando: false }`. */
export function useConsultaDaLente(lente: string | null, mes: string): EstadoDaConsulta {
  const busca = lente && mes && LENTES_COM_DRILL.includes(lente) ? lente : null;
  const chave = busca ? chaveDaConsulta(busca, mes) : null;

  const estado = useSyncExternalStore(assinar, () =>
    chave ? (cache.get(chave) ?? CARREGANDO) : SEM_CONSULTA,
  );

  useEffect(() => {
    if (!busca) return undefined;
    const minha = chaveDaConsulta(busca, mes);
    const antes = interessados.get(minha);
    interessados.set(minha, { lente: busca, mes, telas: (antes?.telas ?? 0) + 1 });
    buscar(busca, mes, true);
    return () => {
      const agora = interessados.get(minha);
      if (!agora || agora.telas <= 1) interessados.delete(minha);
      else interessados.set(minha, { ...agora, telas: agora.telas - 1 });
    };
  }, [busca, mes]);

  return estado;
}
