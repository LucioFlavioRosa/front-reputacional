/** A garantia de sincronização, provada função por função.
 *
 *  O QUE ESTE ARQUIVO IMPEDE: um cadastro feito na Administração que não chega
 *  ao formulário de agenda, aos filtros ou à ficha. A regra mora no cliente da
 *  API — escrita bem-sucedida numa rota de catálogo avisa `catalogoMudou` —,
 *  e aqui cada função de escrita é chamada de verdade, com o `fetch` trocado
 *  por um dublê, para provar que o aviso sai.
 *
 *  E O QUE ELE IMPEDE NO FUTURO: a lista de funções exercitadas é conferida
 *  contra o PRÓPRIO CÓDIGO-FONTE do cliente (`cliente.varredura.ts`). Quem
 *  acrescentar `desativarTema` amanhã e não a puser aqui vê o teste falhar —
 *  antes de alguém descobrir na tela que o tema desativado continua sendo
 *  oferecido. E quem escrever a chamada numa forma que a varredura não lê vê
 *  o teste falhar do mesmo jeito: o que ela não entende é falha, não silêncio.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as cliente from './cliente';
// O FONTE DO CLIENTE, como texto. `?raw` é do Vite, e o vitest fala Vite: é o
// que permite varrer o código sem `node:fs` — que o `tsc` do build não conhece,
// porque o app é feito para o navegador e não deve enxergar o Node.
import fonte from './cliente.ts?raw';
import { varrerChamadas } from './cliente.varredura';
import { ROTAS_DO_CATALOGO, catalogoMudou } from '@/dominio/sincronizacao';

/* -- o dublê do servidor ---------------------------------------------------- */

type Chamada = { url: string; metodo: string };

let chamadas: Chamada[] = [];
let respostaPadrao = () => new Response('{}', { status: 200 });

function dubleDeFetch(url: string, opcoes: RequestInit = {}): Promise<Response> {
  chamadas.push({ url, metodo: (opcoes.method ?? 'GET').toUpperCase() });
  return Promise.resolve(respostaPadrao());
}

let avisos = 0;
let cancelarAssinatura = () => {};

beforeEach(() => {
  chamadas = [];
  avisos = 0;
  respostaPadrao = () => new Response('{}', { status: 200 });
  vi.stubGlobal('fetch', dubleDeFetch);
  cancelarAssinatura = catalogoMudou.assinar(() => {
    avisos += 1;
  });
});

afterEach(() => {
  cancelarAssinatura();
  vi.unstubAllGlobals();
});

const arquivo = () => new File([new Uint8Array([37, 80, 68, 70])], 'q.pdf', { type: 'application/pdf' });

/* -- TODAS as escritas de catálogo, uma a uma ------------------------------- */

const ESCRITAS_DE_CATALOGO: Record<string, () => Promise<unknown>> = {
  criarTema: () => cliente.criarTema({ nome: 'Tarifa', nivel: 'sensivel' }),
  editarTema: () => cliente.editarTema(7, { nome: 'Tarifa', nivel: 'sensivel', ativo: true }),
  criarInstituicao: () => cliente.criarInstituicao({ nome: 'Folha', tipo: 'veiculo', uf: 'SP', tier: 1 }),
  editarInstituicao: () =>
    cliente.editarInstituicao('id-1', { nome: 'Folha', tipo: 'veiculo', uf: 'SP', tier: 1 }),
  criarInterlocutor: () => cliente.criarInterlocutor({ nome: 'Ana', instituicao_id: 'id-1' }),
  editarInterlocutor: () => cliente.editarInterlocutor('id-2', { nome: 'Ana', instituicao_id: 'id-1' }),
  removerInterlocutor: () => cliente.removerInterlocutor('id-2'),
  removerInstituicao: () => cliente.removerInstituicao('id-1'),
  acrescentarNoDicionario: () => cliente.acrescentarNoDicionario('esferas', { nome: 'Distrital' }),
  editarNoDicionario: () => cliente.editarNoDicionario('esferas', 7, { nome: 'Distrital' }),
  criarPessoaAegea: () => cliente.criarPessoaAegea({ nome: 'Radamés' }),
  editarPessoaAegea: () => cliente.editarPessoaAegea('id-3', { nome: 'Radamés' }),
  criarReferencia: () =>
    cliente.criarReferencia(
      {
        titulo: 'Q&A',
        tipo: 'qa',
        tema_principal_id: 1,
        temas: [],
        resumo: 'O que responder.',
        conteudo: 'O texto desta versão.',
        atualizado_em: '2026-09-01',
      },
      arquivo(),
    ),
  editarReferencia: () =>
    cliente.editarReferencia('id-4', {
      titulo: 'Q&A',
      tipo: 'qa',
      resumo: 'O que responder.',
      tema_principal_id: 1,
      temas: [],
    }),
  subirVersaoDaReferencia: () =>
    cliente.subirVersaoDaReferencia('id-4', arquivo(), 'O texto da versão.', '2026-09-02'),
};

describe('toda escrita de catálogo avisa quem depende do catálogo', () => {
  it.each(Object.keys(ESCRITAS_DE_CATALOGO))('%s avisa uma vez, e só depois do sucesso', async (nome) => {
    // As remoções voltam 204 sem corpo: é o outro caminho de sucesso dentro
    // de `requisitar`, e precisa avisar igual.
    if (nome.startsWith('remover')) respostaPadrao = () => new Response(null, { status: 204 });

    await ESCRITAS_DE_CATALOGO[nome]();

    expect(avisos).toBe(1);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].metodo).not.toBe('GET');
    expect(
      ROTAS_DO_CATALOGO.some((rota) => chamadas[0].url.includes(rota)),
      `${nome} não escreveu numa rota de catálogo: ${chamadas[0].url}`,
    ).toBe(true);
  });

  it('a recusa do servidor NÃO avisa — nada mudou', async () => {
    respostaPadrao = () =>
      new Response(JSON.stringify({ detalhe: 'Já existe um tema com esse nome.' }), {
        status: 409,
      });

    await expect(cliente.criarTema({ nome: 'Tarifa', nivel: 'sensivel' })).rejects.toThrow(
      'Já existe',
    );

    expect(avisos).toBe(0);
  });

  it('ler o catálogo não avisa — senão cada leitura recarregaria a leitura', async () => {
    respostaPadrao = () => new Response('[]', { status: 200 });

    await cliente.listarTemas();
    await cliente.listarInstituicoes();
    await cliente.listarReferencias();

    expect(avisos).toBe(0);
  });

  it('salvar uma agenda não avisa — a agenda tem o próprio caminho', async () => {
    respostaPadrao = () => new Response('{}', { status: 200 });

    await cliente.editarInteracao('id-9', {});

    expect(avisos).toBe(0);
    expect(chamadas[0].url).toContain('/api/interacoes/');
  });
});

/* -- a rede contra a função de escrita que ninguém lembrou de testar -------- */

describe('o código-fonte do cliente não tem escrita de catálogo fora desta lista', () => {
  it('todo fetch passa por `requisitar` — o único lugar que avisa', () => {
    // Uma segunda chamada a `fetch` seria um caminho que escreve sem avisar.
    expect(fonte.match(/\bfetch\(/g)).toHaveLength(1);
  });

  it('toda chamada a `requisitar` está na forma canônica — a varredura não deixa passar o que não entende', () => {
    const { problemas } = varrerChamadas(fonte);
    expect(problemas).toEqual([]);
  });

  it('cada função que escreve numa rota de catálogo está exercitada acima', () => {
    const { chamadas } = varrerChamadas(fonte);
    const escrevem = chamadas.filter((c) => c.escreveNoCatalogo).map((c) => c.funcao);

    expect(escrevem.length, 'a varredura precisa achar as escritas').toBeGreaterThanOrEqual(10);
    expect(new Set(escrevem)).toEqual(new Set(Object.keys(ESCRITAS_DE_CATALOGO)));
  });
});

/* -- a rede, provada com furos plantados ----------------------------------- */

describe('a varredura recusa o que não sabe classificar', () => {
  const definicao =
    'async function requisitar<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {}\n';

  it('lê a forma canônica: caminho literal, template com id, sem opções, com opções', () => {
    const { chamadas, problemas } = varrerChamadas(
      definicao +
        "export function a() { return requisitar<X>('/api/temas'); }\n" +
        'export function a2(p: string) {\n  return requisitar<X>(\n    `/api/temas/${p}`,\n  );\n}\n' +
        'export function b(id: number) { return requisitar<X>(`/api/temas/${id}`, { method: \'PUT\', body: JSON.stringify({ a: { b: 1 } }) }); }\n' +
        'export function c(p: string) { return requisitar<X>(`/api/exportacoes?${p}`, { method: \'POST\' }); }\n',
    );
    expect(problemas).toEqual([]);
    expect(chamadas).toEqual([
      { funcao: 'a', metodo: 'GET', caminho: '/api/temas', escreveNoCatalogo: false },
      { funcao: 'a2', metodo: 'GET', caminho: '/api/temas/X', escreveNoCatalogo: false },
      { funcao: 'b', metodo: 'PUT', caminho: '/api/temas/X', escreveNoCatalogo: true },
      { funcao: 'c', metodo: 'POST', caminho: '/api/exportacoes?X', escreveNoCatalogo: false },
    ]);
  });

  it.each([
    [
      'verbo numa variável',
      "export function f() { const m = 'POST'; return requisitar<X>('/api/temas', { method: m }); }",
    ],
    [
      'alias de requisitar',
      "const r = requisitar;\nexport function f() { return r<X>('/api/temas', { method: 'POST' }); }",
    ],
    [
      'rota numa constante',
      "const ROTA = '/api/temas';\nexport function f() { return requisitar<X>(ROTA, { method: 'POST' }); }",
    ],
    [
      'caminho montado por concatenação',
      "export function f() { return requisitar<X>('/api/' + 'temas', { method: 'POST' }); }",
    ],
    [
      'opções vindas de fora',
      "const o = { method: 'POST' };\nexport function f() { return requisitar<X>('/api/temas', o); }",
    ],
    [
      'tipo omitido',
      "export function f() { return requisitar('/api/temas', { method: 'POST' }); }",
    ],
    [
      'rota interpolada — chama /api/temas de verdade e a varredura veria /api/X',
      "export function f() { return requisitar<X>(`/api/${'temas'}`, { method: 'POST' }); }",
    ],
    [
      'rota interpolada pela metade',
      "export function f() { return requisitar<X>(`/api/tem${'as'}`, { method: 'POST' }); }",
    ],
    [
      'query grudada na rota sem o `?` literal',
      "export function f(p: string) { return requisitar<X>(`/api/temas${p}`, { method: 'POST' }); }",
    ],
  ])('%s é problema, e não silêncio', (_nome, corpo) => {
    const { problemas } = varrerChamadas(definicao + corpo);
    expect(problemas.length).toBeGreaterThanOrEqual(1);
    // O alias nasce fora de `f`, e é ali que a varredura o aponta.
    expect(problemas[0]).toMatch(/^(?:f|\(fora de função exportada\)): /);
  });

  it('a função nova que escreve em rota de catálogo aparece — sem ninguém lembrar de acrescentá-la', () => {
    const { chamadas } = varrerChamadas(
      definicao +
        "export function desativarTema(id: number) { return requisitar<void>(`/api/temas/${id}`, { method: 'DELETE' }); }",
    );
    expect(chamadas.map((c) => c.funcao)).toEqual(['desativarTema']);
    expect(chamadas[0].escreveNoCatalogo).toBe(true);
  });

  it('menção a requisitar num comentário não conta', () => {
    const { chamadas, problemas } = varrerChamadas(
      definicao + '// fica separada de `requisitar` porque\n/* e requisitar aqui também */\n',
    );
    expect(chamadas).toEqual([]);
    expect(problemas).toEqual([]);
  });

  it('sem a definição — ou com duas — é problema', () => {
    expect(varrerChamadas('').problemas).toEqual([
      'esperava uma definição de requisitar, achei 0',
    ]);
    expect(varrerChamadas(definicao + definicao).problemas).toHaveLength(1);
  });
});
