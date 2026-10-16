/** A planilha grande sobe em pedaços, e a escolha entre os dois caminhos.
 *
 *  POR QUE ESTE CAMINHO EXISTE, medido no ambiente em 16/10/2026 pela
 *  telemetria do navegador — o mesmo arquivo, a mesma máquina, a mesma hora:
 *
 *      1,42 MB  ->    4,1 s  -> 200
 *      1,33 MB  ->   73,2 s  -> 200
 *     10,53 MB  ->  212,4 s  -> 403
 *     10,53 MB  ->  227,4 s  -> 403
 *
 *  Os 403 param em ~212–227 s porque o ingress do Container Apps encerra a
 *  requisição por volta de 240 s, e isso não é configurável.
 *
 *  O QUE SE AFIRMA AQUI é o contrato do cliente: que o arquivo é cortado sem
 *  perder nem repetir byte, que o tamanho da parte vem do SERVIDOR, que a
 *  escolha entre um caminho e outro é por tamanho, e que o progresso conta o
 *  que de fato subiu. O tempo não se testa aqui — ele se mede no ambiente.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TAMANHO_PARA_SUBIR_EM_PARTES,
  conferirPlanilhaDoScoreComoCouber,
  conferirPlanilhaDoScoreEmPartes,
} from './cliente';

const CONFERENCIA = {
  planilha_id: 'aa11bb22-cc33-dd44-ee55-ff6677889900',
  previsao: [],
  veiculos_novos: [],
  veiculos_reconhecidos: 0,
  mencoes_com_tema: 0,
  mencoes_sem_assunto: 0,
  assuntos_nao_reconhecidos: [],
};

/** As chamadas que o cliente fez, na ordem, com o corpo já desempacotado. */
interface Chamada {
  url: string;
  metodo: string;
  corpo: FormData;
}

let chamadas: Chamada[];

/** Um `fetch` de mentira que responde como o servidor responde.
 *
 *  PRECISA DISTINGUIR AS TRÊS ROTAS, e não só contar chamadas: o que se afirma
 *  é a conversa — abertura, partes, fechamento — e um mock que respondesse
 *  igual a tudo deixaria passar um cliente que chamasse a rota errada.
 */
function servidorDeMentira(tamanhoDaParte: number) {
  return vi.fn(async (url: string, opcoes: RequestInit) => {
    chamadas.push({
      url,
      metodo: String(opcoes.method),
      corpo: opcoes.body as FormData,
    });
    if (url.endsWith('/planilha/upload')) {
      return new Response(
        JSON.stringify({ planilha_id: CONFERENCIA.planilha_id, tamanho_da_parte: tamanhoDaParte }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (url.includes('/parte/')) {
      return new Response(null, { status: 204 });
    }
    return new Response(JSON.stringify(CONFERENCIA), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
}

function arquivoDe(bytes: number, nome = 'clipping.xlsx'): File {
  // CONTEÚDO RECONHECÍVEL por posição: é o que permite afirmar que o pedaço 2
  // é o pedaço 2, e não só que foram enviados três pedaços.
  const conteudo = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i += 1) conteudo[i] = i % 251;
  return new File([conteudo], nome, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

beforeEach(() => {
  chamadas = [];
});

describe('a escolha entre um caminho e outro', () => {
  it('arquivo PEQUENO vai numa requisição só', async () => {
    vi.stubGlobal('fetch', servidorDeMentira(1024));

    await conferirPlanilhaDoScoreComoCouber('clipei', arquivoDe(2048));

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].url).toContain('/fontes/clipei/conferencia');
    expect(chamadas[0].corpo.get('arquivo')).toBeTruthy();
  });

  it('arquivo GRANDE vai em partes', async () => {
    vi.stubGlobal('fetch', servidorDeMentira(1024 * 1024));

    await conferirPlanilhaDoScoreComoCouber(
      'clipei',
      arquivoDe(TAMANHO_PARA_SUBIR_EM_PARTES + 1),
    );

    expect(chamadas[0].url).toContain('/planilha/upload');
    expect(chamadas.some((c) => c.url.includes('/parte/'))).toBe(true);
  });

  it('o teto é EXCLUSIVO: exatamente no limite ainda vai numa requisição', async () => {
    //: Um `>=` aqui partiria sem necessidade o arquivo que cabe. É a diferença
    //: de um byte, e é o tipo de borda que ninguém revisa duas vezes.
    vi.stubGlobal('fetch', servidorDeMentira(1024));

    await conferirPlanilhaDoScoreComoCouber(
      'clipei',
      arquivoDe(TAMANHO_PARA_SUBIR_EM_PARTES),
    );

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].url).toContain('/fontes/clipei/conferencia');
  });
});

describe('o corte do arquivo', () => {
  it('as partes remontam o arquivo SEM perder nem repetir byte', async () => {
    //: A GUARDA QUE MAIS IMPORTA. Um `.xlsx` é um zip: um byte a menos ou
    //: repetido não dá erro de upload, dá "não consegui abrir a planilha" —
    //: longe da causa.
    vi.stubGlobal('fetch', servidorDeMentira(1000));
    const arquivo = arquivoDe(3500);

    await conferirPlanilhaDoScoreEmPartes('clipei', arquivo);

    const partes = chamadas.filter((c) => c.url.includes('/parte/'));
    const pedacos = await Promise.all(
      partes.map((c) => (c.corpo.get('parte') as Blob).arrayBuffer()),
    );
    const remontado = new Uint8Array(pedacos.reduce((soma, p) => soma + p.byteLength, 0));
    let onde = 0;
    for (const pedaco of pedacos) {
      remontado.set(new Uint8Array(pedaco), onde);
      onde += pedaco.byteLength;
    }

    expect(remontado).toEqual(new Uint8Array(await arquivo.arrayBuffer()));
  });

  it('o índice da parte vai na URL, em ordem, a partir de ZERO', async () => {
    vi.stubGlobal('fetch', servidorDeMentira(1000));

    await conferirPlanilhaDoScoreEmPartes('clipei', arquivoDe(3500));

    const indices = chamadas
      .filter((c) => c.url.includes('/parte/'))
      .map((c) => Number(c.url.split('/parte/')[1]));
    expect(indices).toEqual([0, 1, 2, 3]);
  });

  it('o TAMANHO DA PARTE vem do servidor, não do cliente', async () => {
    //: É o servidor que conhece o teto do ingress e a margem que escolheu. Um
    //: número nosso divergiria do dele na primeira mudança, e a divergência só
    //: apareceria como parte recusada.
    vi.stubGlobal('fetch', servidorDeMentira(700));

    await conferirPlanilhaDoScoreEmPartes('clipei', arquivoDe(2100));

    const partes = chamadas.filter((c) => c.url.includes('/parte/'));
    expect(partes).toHaveLength(3);
    for (const parte of partes) {
      expect((parte.corpo.get('parte') as Blob).size).toBeLessThanOrEqual(700);
    }
  });

  it('a parte vai por PUT, e a abertura e o fechamento por POST', async () => {
    //: `PUT` é a promessa de idempotência por índice — é o que deixa repetir a
    //: parte que falhou sem recomeçar a subida.
    vi.stubGlobal('fetch', servidorDeMentira(1000));

    await conferirPlanilhaDoScoreEmPartes('clipei', arquivoDe(2500));

    const porUrl = (trecho: string) => chamadas.filter((c) => c.url.includes(trecho));
    expect(porUrl('/planilha/upload')[0].metodo).toBe('POST');
    for (const parte of porUrl('/parte/')) expect(parte.metodo).toBe('PUT');
    expect(porUrl('/conferencia')[0].metodo).toBe('POST');
  });
});

describe('o fechamento', () => {
  it('manda a CONTAGEM de partes e o NOME do arquivo', async () => {
    //: O nome não entra no caminho do armazenamento durante a montagem — ele
    //: vem aqui, no último passo, e é de onde a tela o lê depois.
    vi.stubGlobal('fetch', servidorDeMentira(1000));

    await conferirPlanilhaDoScoreEmPartes('clipei', arquivoDe(2500, 'julho.xlsx'));

    const fechamento = chamadas.at(-1)!;
    expect(fechamento.url).toContain(`/planilha/${CONFERENCIA.planilha_id}/conferencia`);
    expect(fechamento.corpo.get('partes')).toBe('3');
    expect(fechamento.corpo.get('nome')).toBe('julho.xlsx');
  });

  it('devolve a MESMA resposta do caminho de uma vez só', async () => {
    vi.stubGlobal('fetch', servidorDeMentira(1000));

    const resposta = await conferirPlanilhaDoScoreEmPartes('clipei', arquivoDe(2500));

    expect(resposta.planilha_id).toBe(CONFERENCIA.planilha_id);
  });
});

describe('o progresso', () => {
  it('conta o que JÁ SUBIU, começando em zero e terminando no total', async () => {
    //: Uma tela parada por minutos se lê como travada — foi assim que o defeito
    //: do arquivo grande apareceu para quem usava ("está demorando", sem erro).
    vi.stubGlobal('fetch', servidorDeMentira(1000));
    const passos: [number, number][] = [];

    await conferirPlanilhaDoScoreEmPartes('clipei', arquivoDe(2500), (e, t) =>
      passos.push([e, t]),
    );

    expect(passos).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('o caminho de uma vez só NÃO chama o progresso', async () => {
    //: Com uma requisição não há parte, e "parte 1 de 1" é ruído que faz a
    //: pessoa procurar significado onde não há.
    vi.stubGlobal('fetch', servidorDeMentira(1024));
    const aoProgresso = vi.fn();

    await conferirPlanilhaDoScoreComoCouber('clipei', arquivoDe(2048), aoProgresso);

    expect(aoProgresso).not.toHaveBeenCalled();
  });
});

describe('quando uma parte falha', () => {
  it('a falha sobe, e as partes seguintes NÃO são enviadas', async () => {
    //: Insistir depois de uma parte falhar gastaria a banda que acabou de se
    //: mostrar o gargalo — e montaria um arquivo incompleto no fim.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, opcoes: RequestInit) => {
        chamadas.push({ url, metodo: String(opcoes.method), corpo: opcoes.body as FormData });
        if (url.endsWith('/planilha/upload')) {
          return new Response(
            JSON.stringify({ planilha_id: CONFERENCIA.planilha_id, tamanho_da_parte: 1000 }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        if (url.endsWith('/parte/1')) {
          return new Response(JSON.stringify({ detalhe: 'a rede caiu' }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response(null, { status: 204 });
      }),
    );

    await expect(
      conferirPlanilhaDoScoreEmPartes('clipei', arquivoDe(3500)),
    ).rejects.toThrow();

    const indices = chamadas
      .filter((c) => c.url.includes('/parte/'))
      .map((c) => Number(c.url.split('/parte/')[1]));
    expect(indices).toEqual([0, 1]);
    //: E NÃO FECHOU: montar com uma parte a menos daria um zip truncado.
    expect(chamadas.some((c) => c.url.endsWith('/conferencia'))).toBe(false);
  });
});
