/** Lê o fonte do cliente da API e diz, chamada por chamada, o que cada uma faz.
 *
 *  É TESTE, e mora fora dele só porque é testado por si: a rede que ele
 *  estende precisa provar que não tem furo, e um teste não testa a si mesmo.
 *  Nada daqui entra no bundle — quem importa é `cliente.test.ts`.
 *
 *  O QUE ELE DEFENDE. A garantia de sincronização mora em `requisitar`, e vale
 *  para qualquer chamada. O que a varredura garante é OUTRA coisa: que cada
 *  função de escrita de catálogo esteja exercitada no teste, hoje e amanhã. Uma
 *  regex que só reconhece uma forma de escrever a chamada deixa passar a forma
 *  que não reconhece — e "não reconheci" tem de ser falha, e não silêncio.
 *
 *  A REGRA: toda menção a `requisitar` no fonte é a definição ou uma chamada
 *  na FORMA CANÔNICA — caminho literal começando em `/api/`, `method` literal ou
 *  nenhum, e um terceiro argumento opcional (objeto literal) que diz como LER a
 *  resposta. Alias, verbo em variável, rota em constante: a varredura não
 *  classifica, e devolve o problema com o nome da função. É a forma canônica
 *  que faz o fonte legível para pessoas e para esta varredura ao mesmo tempo.
 */

import { escreveNoCatalogo } from '@/dominio/sincronizacao';

export type Chamada = {
  funcao: string;
  metodo: string;
  caminho: string;
  escreveNoCatalogo: boolean;
};

export type Varredura = {
  chamadas: Chamada[];
  problemas: string[];
};

const VERBOS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

/** `import { … requisitar … } from './nucleo';` — sem renomear, sem `type`.
 *
 *  `[^}]*` de propósito nos dois lados: aceita `requisitar` no meio de outros
 *  nomes, e NÃO atravessa a chave de fechamento. O `(?!\s+as\b)` é o que
 *  recusa `requisitar as r`, que era o escape. */
const IMPORT_DO_NUCLEO =
  /^\s*import\s*\{[^}]*\brequisitar\b(?!\s+as\b)[^}]*\}\s*from\s*['"]\.\/nucleo['"];/;

/** Fora comentários — uma menção a `requisitar` num comentário não é chamada. */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

/** A função exportada que contém a posição. */
function funcaoQueContem(fonte: string, posicao: number): string {
  const antes = fonte.slice(0, posicao);
  const nomes = [...antes.matchAll(/^export (?:async )?function (\w+)/gm)];
  return nomes.length ? nomes[nomes.length - 1][1] : '(fora de função exportada)';
}

/** Lê um literal de string a partir da aspa de abertura. Devolve o texto com
 *  cada `${…}` trocado por `X`, e a posição logo depois da aspa de fechamento —
 *  ou `null` se não há literal ali. */
function lerLiteral(fonte: string, inicio: number): { texto: string; fim: number } | null {
  const aspa = fonte[inicio];
  if (aspa === "'" || aspa === '"') {
    const fim = fonte.indexOf(aspa, inicio + 1);
    return fim === -1 ? null : { texto: fonte.slice(inicio + 1, fim), fim: fim + 1 };
  }
  if (aspa !== '`') return null;

  let texto = '';
  let i = inicio + 1;
  while (i < fonte.length) {
    const c = fonte[i];
    if (c === '\\') {
      texto += fonte[i + 1] ?? '';
      i += 2;
    } else if (c === '`') {
      return { texto, fim: i + 1 };
    } else if (c === '$' && fonte[i + 1] === '{') {
      // Pula a expressão inteira, inclusive um template aninhado dentro dela.
      let profundidade = 1;
      i += 2;
      while (i < fonte.length && profundidade > 0) {
        if (fonte[i] === '`') {
          const aninhado = lerLiteral(fonte, i);
          if (!aninhado) return null;
          i = aninhado.fim;
          continue;
        }
        if (fonte[i] === '{') profundidade += 1;
        if (fonte[i] === '}') profundidade -= 1;
        i += 1;
      }
      texto += 'X';
    } else {
      texto += c;
      i += 1;
    }
  }
  return null;
}

/** Lê um objeto `{ … }` a partir da chave de abertura, contando chaves. */
function lerObjeto(fonte: string, inicio: number): { texto: string; fim: number } | null {
  if (fonte[inicio] !== '{') return null;
  let profundidade = 0;
  for (let i = inicio; i < fonte.length; i += 1) {
    if (fonte[i] === '{') profundidade += 1;
    if (fonte[i] === '}') profundidade -= 1;
    if (profundidade === 0) return { texto: fonte.slice(inicio + 1, i), fim: i + 1 };
  }
  return null;
}

function pularEspaco(fonte: string, i: number): number {
  while (i < fonte.length && /\s/.test(fonte[i])) i += 1;
  return i;
}

/** Varre o fonte: cada menção a `requisitar` vira uma chamada classificada ou
 *  um problema. Uma ORIGEM, e só uma, é esperada.
 *
 *  ORIGEM É DEFINIÇÃO **OU** IMPORT, e era só definição até 17/10/2026. Naquele
 *  dia `cliente.ts` se dividiu em cinco: `nucleo.ts` DEFINE `requisitar`, e os
 *  outros quatro o IMPORTAM. A varredura, que assumia o monólito, acusou os
 *  quatro de duas coisas ao mesmo tempo — "mencionada sem ser chamada" (a linha
 *  do import) e "esperava uma definição, achei 0".
 *
 *  A GARANTIA NÃO AFROUXOU: continua sendo exatamente uma origem por arquivo.
 *  Um arquivo que definisse E importasse, ou que importasse de dois lugares,
 *  continua sendo problema — e é isso que impede um segundo caminho de rede
 *  entrar sem ninguém ver. */
export function varrerChamadas(fonteBruto: string): Varredura {
  const fonte = semComentarios(fonteBruto);
  const chamadas: Chamada[] = [];
  const problemas: string[] = [];
  let origens = 0;

  for (const mencao of fonte.matchAll(/\brequisitar\b/g)) {
    const inicio = mencao.index;
    const funcao = funcaoQueContem(fonte, inicio);
    const problema = (motivo: string) => problemas.push(`${funcao}: ${motivo}`);

    if (/(?:async )?function $/.test(fonte.slice(Math.max(0, inicio - 16), inicio))) {
      origens += 1;
      continue;
    }

    // O IMPORT DO NÚCLEO, e só ele.
    //
    // A PRIMEIRA VERSÃO DISTO ACEITAVA QUALQUER LINHA QUE PARECESSE IMPORT, e
    // era um buraco: `import { requisitar as r } from './outro'` passava como
    // origem, e as chamadas por `r` não eram varridas por nada. Um segundo
    // caminho de rede entrava sem ninguém ver — exatamente o que este arquivo
    // existe para impedir. Achado da revisão em 17/10/2026.
    //
    // AS TRÊS EXIGÊNCIAS, e cada uma fecha um jeito de escapar:
    //   * o módulo é `./nucleo` — não qualquer um;
    //   * o nome NÃO é renomeado — `requisitar as r` deixaria `r` invisível;
    //   * não é `import type` — tipo não traz função nenhuma em runtime.
    const comecoDaLinha = fonte.lastIndexOf('\n', inicio) + 1;
    const fimDaDeclaracao = fonte.indexOf(';', inicio);
    const declaracao = fonte.slice(
      comecoDaLinha,
      fimDaDeclaracao === -1 ? inicio : fimDaDeclaracao + 1,
    );
    if (/^\s*import\b/.test(declaracao)) {
      if (IMPORT_DO_NUCLEO.test(declaracao)) {
        origens += 1;
      } else {
        problema(
          '`requisitar` importada de um jeito que a varredura não acompanha ' +
            "(renomeada? `import type`? de outro módulo que não `./nucleo`?)",
        );
      }
      continue;
    }

    const cabeca = /^<[^>]*>\(/.exec(fonte.slice(inicio + 'requisitar'.length));
    if (!cabeca) {
      problema('`requisitar` mencionada sem ser chamada na forma canônica (alias? tipo omitido?)');
      continue;
    }

    let i = pularEspaco(fonte, inicio + 'requisitar'.length + cabeca[0].length);
    const caminho = lerLiteral(fonte, i);
    if (!caminho || !caminho.texto.startsWith('/api/')) {
      problema('o caminho não é um literal começando em `/api/`');
      continue;
    }
    // A ROTA — o segmento logo depois de `/api/` — tem de estar escrita por
    // extenso, até a barra, o `?` ou o fim. `/api/${'temas'}` chama `/api/temas`
    // de verdade e a varredura veria `/api/X`: seria um furo silencioso.
    if (!/^\/api\/[a-z-]+(?:[/?]|$)/.test(caminho.texto)) {
      problema('a rota depois de `/api/` precisa ser literal até a barra, o `?` ou o fim');
      continue;
    }

    i = pularEspaco(fonte, caminho.fim);
    let metodo = 'GET';
    // A vírgula pode ser a que separa as opções ou a que sobra antes do `)`
    // numa chamada quebrada em linhas — o formatador deixa as duas.
    if (fonte[i] === ',') i = pularEspaco(fonte, i + 1);
    if (fonte[i] === '{') {
      const opcoes = lerObjeto(fonte, i);
      if (!opcoes) {
        problema('as opções não são um objeto literal');
        continue;
      }
      const verbos = [...opcoes.texto.matchAll(/\bmethod:\s*'([A-Z]+)'/g)].map((m) => m[1]);
      if (verbos.length !== 1 || !VERBOS.has(verbos[0])) {
        problema('`method` não é um literal entre GET, POST, PUT, PATCH e DELETE');
        continue;
      }
      metodo = verbos[0];
      i = pularEspaco(fonte, opcoes.fim);
      if (fonte[i] === ',') i = pularEspaco(fonte, i + 1);

      // O TERCEIRO ARGUMENTO diz como LER a resposta, não o que pedir — hoje só
      // `comoBlob`, para download de arquivo. Aceitá-lo aqui é o que permite o
      // download passar por `requisitar` em vez de abrir um segundo `fetch`, que
      // seria um caminho de rede falhando sem avisar ninguém. Continua tendo de
      // ser objeto literal: a varredura não classifica o que não entende.
      if (fonte[i] === '{') {
        const comoLer = lerObjeto(fonte, i);
        if (!comoLer) {
          problema('o terceiro argumento não é um objeto literal');
          continue;
        }
        i = pularEspaco(fonte, comoLer.fim);
        if (fonte[i] === ',') i = pularEspaco(fonte, i + 1);
      }
    }
    if (fonte[i] !== ')') {
      problema('a chamada não fecha logo depois do caminho ou das opções');
      continue;
    }

    chamadas.push({
      funcao,
      metodo,
      caminho: caminho.texto,
      escreveNoCatalogo: escreveNoCatalogo(metodo, caminho.texto),
    });
  }

  if (origens !== 1) {
    problemas.push(
      `esperava UMA origem de requisitar (definição ou import), achei ${origens}`,
    );
  }
  return { chamadas, problemas };
}
