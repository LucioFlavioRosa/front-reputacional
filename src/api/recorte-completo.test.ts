/** O recorte inteiro chega no tempo da página mais lenta — e na ordem certa. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listarRecorteCompleto } from './cliente';

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

describe('listarRecorteCompleto', () => {
  it('pede as páginas restantes de uma vez, depois que a primeira diz quantas há', async () => {
    totalDePaginas = 4;
    const promessa = listarRecorteCompleto({});
    await espera();
    expect(pendentes.map((p) => p.pagina)).toEqual([1]);

    pendentes.shift()!.responder();
    await espera();
    // As três de uma vez — e não a 2, depois a 3, depois a 4.
    expect(pendentes.map((p) => p.pagina).sort()).toEqual([2, 3, 4]);

    // Respondem fora de ordem; os itens chegam na ordem das páginas.
    for (const pagina of [4, 2, 3]) pendentes.find((p) => p.pagina === pagina)!.responder();
    const recorte = await promessa;
    expect(recorte.itens.map((i) => i.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
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
