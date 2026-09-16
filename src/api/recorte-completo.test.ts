/** O recorte inteiro chega em lotes de páginas — nunca mais que
 *  `TAMANHO_DO_LOTE` em voo ao mesmo tempo — e na ordem certa. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listarRecorteCompleto, TAMANHO_DO_LOTE } from './cliente';

type Pedido = { pagina: number; responder: () => void };

let pendentes: Pedido[] = [];
let totalDePaginas = 1;

/** Um servidor que só responde quando o teste manda — é o que deixa ver se a
 *  página 3 foi pedida antes de a 2 responder. */
function servidorQueSegura(url: string): Promise<Response> {
  const pagina = Number(new URL(url).searchParams.get('pagina'));
  return new Promise((resolver) => {
    pendentes.push({
      pagina,
      responder: () =>
        resolver(
          new Response(
            JSON.stringify({
              itens: [{ id: `p${pagina}` }],
              total: totalDePaginas,
              pagina,
              tamanho: 200,
              paginas: totalDePaginas,
              filtros_ativos: 0,
            }),
            { status: 200 },
          ),
        ),
    });
  });
}

beforeEach(() => {
  pendentes = [];
  vi.stubGlobal('fetch', servidorQueSegura);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const espera = () => new Promise((r) => setTimeout(r, 0));

/** Responde UM pedido pendente e o tira da lista — `.find()` sozinho deixa o
 *  pedido já respondido junto dos da próxima leva, e uma leitura de
 *  `pendentes` depois disso veria os dois lotes misturados. */
function responderPagina(pagina: number): void {
  const indice = pendentes.findIndex((p) => p.pagina === pagina);
  pendentes.splice(indice, 1)[0].responder();
}

describe('listarRecorteCompleto', () => {
  it('quando as restantes cabem num lote só, pede todas de uma vez', async () => {
    totalDePaginas = 4;
    const promessa = listarRecorteCompleto({});
    await espera();
    expect(pendentes.map((p) => p.pagina)).toEqual([1]);

    pendentes.shift()!.responder();
    await espera();
    // As três cabem no lote (TAMANHO_DO_LOTE é maior que 3) — de uma vez, e
    // não a 2, depois a 3, depois a 4.
    expect(pendentes.map((p) => p.pagina).sort((a, b) => a - b)).toEqual([2, 3, 4]);

    // Respondem fora de ordem; os itens chegam na ordem das páginas.
    for (const pagina of [4, 2, 3]) pendentes.find((p) => p.pagina === pagina)!.responder();
    const recorte = await promessa;
    expect(recorte.itens.map((i) => i.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(recorte.truncado).toBe(false);
  });

  it('com mais páginas que um lote, pede em lotes — nunca mais que TAMANHO_DO_LOTE de uma vez', async () => {
    // Um lote cheio (TAMANHO_DO_LOTE páginas) mais um lote parcial (2
    // páginas) — exercita tanto o lote completo quanto a sobra no fim.
    totalDePaginas = TAMANHO_DO_LOTE + 3;
    const promessa = listarRecorteCompleto({});
    await espera();
    expect(pendentes.map((p) => p.pagina)).toEqual([1]);

    pendentes.shift()!.responder();
    await espera();
    const primeiroLote = Array.from({ length: TAMANHO_DO_LOTE }, (_, i) => i + 2);
    expect(pendentes.map((p) => p.pagina).sort((a, b) => a - b)).toEqual(primeiroLote);

    // Responde o primeiro lote inteiro, fora de ordem — o segundo lote não
    // pode ter sido pedido ainda, mesmo que a maioria já tenha respondido.
    for (const pagina of [...primeiroLote].reverse()) responderPagina(pagina);
    await espera();

    const segundoLote = [TAMANHO_DO_LOTE + 2, TAMANHO_DO_LOTE + 3];
    expect(pendentes.map((p) => p.pagina).sort((a, b) => a - b)).toEqual(segundoLote);

    for (const pagina of segundoLote) responderPagina(pagina);

    const recorte = await promessa;
    expect(recorte.itens.map((i) => i.id)).toEqual(
      Array.from({ length: totalDePaginas }, (_, i) => `p${i + 1}`),
    );
    expect(recorte.truncado).toBe(false);
  });

  it('com uma página só, não pede mais nada', async () => {
    totalDePaginas = 1;
    const promessa = listarRecorteCompleto({});
    await espera();
    pendentes.shift()!.responder();
    const recorte = await promessa;
    expect(pendentes).toEqual([]);
    expect(recorte.itens.map((i) => i.id)).toEqual(['p1']);
  });
});
