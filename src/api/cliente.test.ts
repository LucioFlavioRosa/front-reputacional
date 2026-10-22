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
//
// SÃO CINCO ARQUIVOS DESDE 17/10/2026, e não mais um. `cliente.ts` virou barril
// de reexportação; varrer só ele passou a varrer nada, e estes três testes
// caíram na mesma hora — que é exatamente o que eles existem para fazer.
//
// A PASTA SE DESCOBRE SOZINHA, e a primeira versão disto era uma LISTA ESCRITA
// À MÃO. A revisão apontou o buraco: um sexto arquivo em `src/api/` que fizesse
// chamada e não entrasse na lista ficaria fora da varredura, e a garantia
// viraria falsa em silêncio — sem nada quebrar.
//
// O QUE FICA DE FORA, e por quê: os testes (não são produto), `cliente.ts` (é
// só barril, e varrê-lo duplicaria tudo) e `cliente.varredura.ts` (é a própria
// varredura; ela fala de `requisitar` sem chamá-lo).
const BRUTOS = import.meta.glob(
  ['./*.ts', '!./*.test.ts', '!./cliente.ts', '!./cliente.varredura.ts'],
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>;

const ARQUIVOS: ReadonlyArray<readonly [string, string]> = Object.entries(BRUTOS)
  .map(([caminho, texto]) => [caminho.replace('./', ''), texto] as const)
  .sort(([a], [b]) => a.localeCompare(b));

/** Os cinco colados. Serve para o que é contagem global — `fetch` é um só no
 *  produto inteiro —, e NÃO para o que depende de atribuir código a função. */
const fonte = ARQUIVOS.map(([, texto]) => texto).join('\n');
import { varrerChamadas } from './cliente.varredura';
import { ROTAS_DO_CATALOGO, catalogoMudou, scoreMudou } from '@/dominio/sincronizacao';

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
  //: A CONFIRMAÇÃO DA PLANILHA DE SUBTEMAS, que "aplica o que foi conferido" —
  //: cria e altera TEMAS. Mesmo defeito da confirmação da importação, numa
  //: segunda rota, e esta âncora foi quem apontou as duas.
  confirmarPlanilhaDeSubtemas: () =>
    cliente.confirmarPlanilhaDeSubtemas(arquivo(), 'impressao-1'),
  //: A CONFIRMAÇÃO DA IMPORTAÇÃO, e o docstring dela é a prova: "Cria os
  //: cadastros e as agendas". Ela estava só na lista das AGENDAS, então as 502
  //: instituições, contatos, temas e pessoas que uma confirmação cria não
  //: chegavam ao catálogo — a lista do Cadastro compartilhado e as opções de
  //: todo filtro seguiam as de antes até um F5.
  confirmarImportacao: () => cliente.confirmarImportacao('imp-1'),
  //: O LOTE DA FILA DE REVISÃO. Está aqui porque enquadrar GRAVA o tipo da
  //: instituição, e o tipo é o que `derivar_frente` usa para dizer de que frente
  //: é cada agenda dela — um lote de 499 reclassifica as agendas de todas. A
  //: irmã dele, a consolidação, NÃO escreve no catálogo e não entra.
  enquadrarEmLote: () =>
    cliente.enquadrarEmLote({ ids: ['id-1'], categoria_publico_id: 7 }),
  editarInstituicao: () =>
    cliente.editarInstituicao('id-1', { nome: 'Folha', tipo: 'veiculo', uf: 'SP', tier: 1 }),
  criarInterlocutor: () => cliente.criarInterlocutor({ nome: 'Ana', instituicao_id: 'id-1' }),
  editarInterlocutor: () => cliente.editarInterlocutor('id-2', { nome: 'Ana', instituicao_id: 'id-1' }),
  removerInterlocutor: () => cliente.removerInterlocutor('id-2'),
  //: A MUDANÇA DE CASA de um contato. Escreve em `/api/interlocutores`, que
  //: é rota de catálogo — e a casa de um contato aparece em toda tela que o
  //: oferece, então o aviso tem de sair. Esta âncora apontou a função no
  //: instante em que ela nasceu, como fez com as duas confirmações.
  mudarContatoDeCasa: () => cliente.mudarContatoDeCasa('id-2', 'id-1'),
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
  definirVeiculosDeInvestidores: () =>
    cliente.definirVeiculosDeInvestidores(['id-6', 'id-7'], ['id-6']),
  // A reconciliacao mora sob o mesmo caminho da lista, entao o barramento a
  // trata como escrita de catalogo. Ela NAO escreve em `instituicao` — escreve
  // em `mencao` e no agregado —, e recarregar o catalogo depois dela e trabalho
  // a mais numa operacao rara. Manter o aviso custa um pedido; inventar uma
  // excecao de caminho custa uma regra nova em `sincronizacao`, que e onde as
  // regras deste tipo divergem.
  aplicarReconciliacao: () => cliente.aplicarReconciliacao(),
  // Fundir apaga uma linha do catalogo e move as mencoes dela: o Cadastro
  // compartilhado precisa ver isso sem F5. Ja `declararCadastroDistinto` NAO
  // esta aqui de proposito — ela nao escreve em rota de catalogo, porque a
  // decisao "sao atores diferentes" nao muda cadastro nenhum.
  fundirCadastro: () => cliente.fundirCadastro('id-8', 'id-9'),
  criarAlegacao: () =>
    cliente.criarAlegacao({ texto: 'O Banco X não renegociaria a dívida', temas: [] }),
  editarAlegacao: () =>
    cliente.editarAlegacao('id-5', {
      texto: 'O Banco X não renegociaria a dívida',
      temas: [],
      apuracao_id: 2,
    }),
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
    //: A CONFIRMAÇÃO DA IMPORTAÇÃO é a ÚNICA escrita de catálogo que não é um
    //: prefixo da lista — o id fica no MEIO do endereço
    //: (`/api/importacoes/<uuid>/confirmacao`), então ela tem predicado próprio
    //: em `sincronizacao.ts`.
    //:
    //: NOMEADA AQUI, e não escondida atrás de `escreveNoCatalogo`: chamar a
    //: própria função que o cliente chama tornaria esta asserção CIRCULAR com o
    //: `avisos === 1` acima, que já é a regra aplicada. Esta linha existe para
    //: dizer, por fora, que o endereço avisado é um que muda o catálogo.
    const ehDeCatalogo =
      ROTAS_DO_CATALOGO.some((rota) => chamadas[0].url.includes(rota)) ||
      /\/api\/importacoes\/[^/]+\/confirmacao$/.test(chamadas[0].url);
    expect(
      ehDeCatalogo,
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

/* -- as escritas no Score avisam o cache da Consulta em profundidade -------- */

describe('escrita no Score avisa `scoreMudou`', () => {
  let avisosDoScore = 0;
  let cancelar = () => {};
  beforeEach(() => {
    avisosDoScore = 0;
    cancelar = scoreMudou.assinar(() => {
      avisosDoScore += 1;
    });
  });
  afterEach(() => cancelar());

  // O DEFEITO: subir a planilha do mês (aba Base) ou mudar a calibração
  // deixava o drill da aba Lentes mostrando a árvore antiga a sessão inteira.
  it.each([
    ['importarPlanilhaDoScore', () => cliente.importarPlanilhaDoScore('clipei', arquivo())],
    [
      'gravarCalibracao',
      () => cliente.gravarCalibracao({} as Parameters<typeof cliente.gravarCalibracao>[0]),
    ],
    ['restaurarCalibracaoPadrao', () => cliente.restaurarCalibracaoPadrao()],
  ])('%s avisa uma vez', async (_nome, escrever) => {
    await escrever();
    expect(avisosDoScore).toBe(1);
  });

  it('ler a consulta não avisa, e a recusa do servidor também não', async () => {
    await cliente.obterConsultaDaLente('imprensa', '2026-08');
    respostaPadrao = () => new Response(JSON.stringify({ detalhe: 'Régua inválida.' }), { status: 422 });
    await expect(cliente.restaurarCalibracaoPadrao()).rejects.toThrow('Régua inválida.');
    expect(avisosDoScore).toBe(0);
  });
});

/* -- a rede contra a função de escrita que ninguém lembrou de testar -------- */

describe('o código-fonte do cliente não tem escrita de catálogo fora desta lista', () => {
  it('todo fetch passa por `requisitar` — o único lugar que avisa', () => {
    // Uma segunda chamada a `fetch` seria um caminho que escreve sem avisar.
    expect(fonte.match(/\bfetch\(/g)).toHaveLength(1);
  });

  it('toda chamada a `requisitar` está na forma canônica — a varredura não deixa passar o que não entende', () => {
    // UM ARQUIVO DE CADA VEZ, e não os cinco colados. `funcaoQueContem` atribui
    // cada menção à última `export function` ANTES dela; concatenando, a última
    // função de um arquivo adota o que o arquivo seguinte menciona. Deu três
    // problemas fantasmas — `historicoDeAcesso`, `listarDocumentosDaReuniao` e
    // `obterOpcoesDoRisco` acusadas pelo que vinha depois delas, noutro arquivo.
    // O ARQUIVO QUE NÃO CHAMA `requisitar` SAI DA VARREDURA, e isto é regra e
    // não lista: `subirEmPartes.ts` é o mecanismo da subida em pedaços (o laço,
    // a repetição da parte que falhou, o progresso) e recebe de quem o chama as
    // funções que falam com o servidor — ele nunca menciona `requisitar`.
    //
    // POR QUE POR REGRA: a primeira versão desta varredura usava uma LISTA
    // ESCRITA À MÃO e a revisão apontou o buraco — um arquivo esquecido ficaria
    // fora e a garantia viraria falsa em silêncio. Pular por "não menciona"
    // mantém a garantia: quem não menciona não chama, e quem chamar volta a ser
    // varrido no mesmo instante.
    for (const [nome, texto] of ARQUIVOS) {
      if (!texto.includes('requisitar')) continue;
      const { problemas } = varrerChamadas(texto);
      expect(problemas, `em ${nome}`).toEqual([]);
    }
  });

  it('cada função que escreve numa rota de catálogo está exercitada acima', () => {
    const chamadas = ARQUIVOS.flatMap(([, texto]) => varrerChamadas(texto).chamadas);
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

  it('sem origem — ou com duas — é problema', () => {
    expect(varrerChamadas('').problemas).toEqual([
      'esperava UMA origem de requisitar (definição ou import), achei 0',
    ]);
    expect(varrerChamadas(definicao + definicao).problemas).toHaveLength(1);
  });

  it('a varredura cobre TODO arquivo de produto da pasta, e não uma lista', () => {
    //: A LISTA ESCRITA À MÃO era o buraco: um sexto arquivo com chamada ficaria
    //: fora, e a garantia viraria falsa sem nada quebrar. Achado da revisão.
    //:
    //: Afirma o PISO e o conteúdo, e não a lista exata — acrescentar um arquivo
    //: de domínio novo (a Inteligência de Mercado vem aí) não deve derrubar
    //: este teste, mas tirar um deve.
    const nomes = ARQUIVOS.map(([nome]) => nome);
    expect(nomes.length).toBeGreaterThanOrEqual(5);
    for (const esperado of ['nucleo.ts', 'acesso.ts', 'crm.ts', 'score.ts', 'importacao.ts']) {
      expect(nomes).toContain(esperado);
    }
    expect(nomes).not.toContain('cliente.ts');
    expect(nomes.filter((n) => n.includes('.test.'))).toEqual([]);
  });

  it('`requisitar` RENOMEADA no import é problema, e não origem', () => {
    //: O ESCAPE QUE A REVISÃO ACHOU: `import { requisitar as r } from './outro'`
    //: passava como origem, e as chamadas por `r` não eram varridas por nada —
    //: um segundo caminho de rede entrando sem ninguém ver.
    const renomeada = "import { requisitar as r } from './outro';\n";
    expect(varrerChamadas(renomeada).problemas.length).toBeGreaterThan(0);

    //: E de OUTRO MÓDULO também não vale, mesmo sem renomear.
    const deOutroLugar = "import { requisitar } from './outro';\n";
    expect(varrerChamadas(deOutroLugar).problemas.length).toBeGreaterThan(0);

    //: Nem `import type` — tipo não traz função nenhuma em runtime.
    const soTipo = "import type { requisitar } from './nucleo';\n";
    expect(varrerChamadas(soTipo).problemas.length).toBeGreaterThan(0);
  });

  it('o IMPORT vale como origem, e dois imports continuam sendo problema', () => {
    //: Entrou com a divisão de `cliente.ts` em cinco arquivos (17/10/2026):
    //: `nucleo.ts` define `requisitar`, os outros quatro o importam. Sem isto a
    //: varredura acusava os quatro de não ter definição — e, de quebra, tratava
    //: a própria linha do import como chamada mal formada.
    const vindoDeFora = "import { requisitar } from './nucleo';\n";
    expect(varrerChamadas(vindoDeFora).problemas).toEqual([]);

    //: E A GARANTIA NÃO AFROUXOU: definir E importar continua sendo problema,
    //: porque seriam dois caminhos de rede no mesmo arquivo.
    expect(varrerChamadas(vindoDeFora + definicao).problemas).toHaveLength(1);
  });
});
