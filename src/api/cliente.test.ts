/** A garantia de sincronização, provada função por função.
 *
 *  O QUE ESTE ARQUIVO IMPEDE: um cadastro feito na Administração que não chega
 *  ao formulário de agenda, aos filtros ou à ficha. A regra mora no cliente da
 *  API — escrita bem-sucedida numa rota de catálogo avisa `catalogoMudou` —,
 *  e aqui cada função de escrita é chamada de verdade, com o `fetch` trocado
 *  por um dublê, para provar que o aviso sai.
 *
 *  E O QUE ELE IMPEDE NO FUTURO: a lista de funções exercitadas é conferida
 *  contra o PRÓPRIO CÓDIGO-FONTE do cliente. Quem acrescentar `desativarTema`
 *  amanhã e não a puser aqui vê o teste falhar — antes de alguém descobrir
 *  na tela que o tema desativado continua sendo oferecido.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as cliente from './cliente';
// O FONTE DO CLIENTE, como texto. `?raw` é do Vite, e o vitest fala Vite: é o
// que permite varrer o código sem `node:fs` — que o `tsc` do build não conhece,
// porque o app é feito para o navegador e não deve enxergar o Node.
import fonte from './cliente.ts?raw';
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
  criarPessoaAegea: () => cliente.criarPessoaAegea({ nome: 'Radamés' }),
  editarPessoaAegea: () => cliente.editarPessoaAegea('id-3', { nome: 'Radamés' }),
  criarReferencia: () =>
    cliente.criarReferencia(
      { titulo: 'Q&A', tipo: 'qa', tema_principal_id: 1, temas: [], atualizado_em: '2026-09-01' },
      arquivo(),
    ),
  editarReferencia: () =>
    cliente.editarReferencia('id-4', { titulo: 'Q&A', tipo: 'qa', tema_principal_id: 1, temas: [] }),
  subirVersaoDaReferencia: () =>
    cliente.subirVersaoDaReferencia('id-4', arquivo(), '2026-09-02'),
};

describe('toda escrita de catálogo avisa quem depende do catálogo', () => {
  it.each(Object.keys(ESCRITAS_DE_CATALOGO))('%s avisa uma vez, e só depois do sucesso', async (nome) => {
    // `removerInterlocutor` volta 204 sem corpo: é o outro caminho de sucesso
    // dentro de `requisitar`, e precisa avisar igual.
    if (nome === 'removerInterlocutor') respostaPadrao = () => new Response(null, { status: 204 });

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

  it('cada função exportada que escreve numa rota de catálogo está exercitada acima', () => {
    // Varre o fonte: para cada `export function NOME(`, olha o corpo até a
    // próxima exportação e pergunta se ele chama `requisitar` numa rota de
    // catálogo com verbo de escrita.
    const blocos = fonte.split(/^export (?:async )?function /m).slice(1);
    const rotas = ROTAS_DO_CATALOGO.map((r) => r.replace('/api/', '')).join('|');
    const escreveNoCatalogo = new RegExp(
      `requisitar<[^>]*>\\(\\s*\`?'?/api/(?:${rotas})[^,]*,\\s*\\{[^}]*method:\\s*'(?:POST|PUT|PATCH|DELETE)'`,
      's',
    );
    const encontradas = blocos
      .filter((bloco: string) => escreveNoCatalogo.test(bloco))
      .map((bloco: string) => bloco.split('(')[0].trim());

    expect(encontradas.length, 'a varredura precisa achar as escritas').toBeGreaterThanOrEqual(10);
    expect(new Set(encontradas)).toEqual(new Set(Object.keys(ESCRITAS_DE_CATALOGO)));
  });
});
