/** A lista de veículos vai num campo só, e é aqui que o defeito morava.
 *
 *  O QUE A PESSOA VIU NA TELA, subindo a primeira planilha da Clipei:
 *
 *      Too many fields. Maximum number of fields is 1000
 *
 *  A primeira versão fazia `corpo.append('veiculos_a_criar', nome)` dentro de
 *  um laço — um campo de formulário por veículo, que é como o FastAPI lê
 *  `Form(list[str])`. Com 2.628 veículos na primeira carga, o parser multipart
 *  do servidor recusou o pedido inteiro.
 *
 *  O LIMITE ESTÁ CERTO: é proteção do servidor, e afrouxá-lo trocaria um
 *  defeito desta tela por uma porta aberta em todas as outras. Quem estava
 *  errado era o formato.
 *
 *  POR QUE O TESTE É AQUI, e não no servidor: eu tentei reproduzir o erro
 *  original pelo terminal e não consegui — o `TestClient` monta o multipart de
 *  outra forma que o navegador, e os 2.000 campos que eu mandei atravessaram.
 *  O que é reproduzível, e é onde o defeito de fato vivia, é a FORMA do corpo
 *  que o cliente monta. Este arquivo conta os campos.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { importarPlanilhaDoScore } from './cliente';

let corpos: FormData[] = [];

beforeEach(() => {
  corpos = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, opcoes: RequestInit) => {
      if (opcoes.body instanceof FormData) corpos.push(opcoes.body);
      return new Response(JSON.stringify([]), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const PLANILHA = new File([new Uint8Array([1, 2, 3])], 'clipei.xlsx');

describe('importarPlanilhaDoScore', () => {
  it('MANDA UM CAMPO SÓ, mesmo com milhares de veículos', async () => {
    const nomes = Array.from({ length: 2628 }, (_, i) => `Veículo ${i}`);

    await importarPlanilhaDoScore('clipei', PLANILHA, nomes);

    const [corpo] = corpos;
    // O NÚMERO É O TESTE: 2.628 campos estouravam o limite de 1.000 do parser.
    expect(corpo.getAll('veiculos_a_criar')).toHaveLength(1);
    // E o arquivo continua sendo o outro campo — dois no total, sempre.
    expect([...corpo.keys()]).toEqual(['arquivo', 'veiculos_a_criar']);
  });

  it('o campo leva a lista inteira, em JSON', async () => {
    await importarPlanilhaDoScore('clipei', PLANILHA, ['Rádio A', 'Jornal B']);

    const bruto = corpos[0].get('veiculos_a_criar');
    expect(JSON.parse(String(bruto))).toEqual(['Rádio A', 'Jornal B']);
  });

  it('SEM VEÍCULO MARCADO, o campo não vai', async () => {
    // O padrão do servidor é não criar veículo nenhum, e é esse padrão que
    // protege o botão "Importar planilha" da Calibração de criar 2.631
    // instituições sem ninguém ter visto. Mandar `[]` seria equivalente, mas
    // não mandar deixa o contrato explícito: quem quer criação pede.
    await importarPlanilhaDoScore('clipei', PLANILHA);

    expect(corpos[0].has('veiculos_a_criar')).toBe(false);
    expect([...corpos[0].keys()]).toEqual(['arquivo']);
  });

  it('COM A PLANILHA JÁ GUARDADA, manda o identificador e NÃO o arquivo', async () => {
    // É a funcionalidade inteira: no clipping real da Clipei são 10,53 MB que
    // deixam de subir pela segunda vez — e a segunda subida acontecia dentro
    // do mesmo relógio de gateway que já estourou uma vez, em 15/10/2026.
    await importarPlanilhaDoScore('clipei', { planilhaId: 'abc-123' }, ['Rádio A']);

    const [corpo] = corpos;
    expect(corpo.get('planilha_id')).toBe('abc-123');
    expect(corpo.has('arquivo')).toBe(false);
  });

  it('NUNCA manda os dois, porque o servidor recusa o pedido que traz ambos', async () => {
    // Escolher um em silêncio gravaria o arquivo que a pessoa não quis, no mês
    // de todo mundo, e a resposta pareceria certa.
    await importarPlanilhaDoScore('clipei', { planilhaId: 'abc-123' });
    await importarPlanilhaDoScore('clipei', PLANILHA);

    for (const corpo of corpos) {
      expect(corpo.has('arquivo') && corpo.has('planilha_id')).toBe(false);
    }
  });

  it('nome com acento, vírgula e barra sobrevive ao JSON', async () => {
    // "Rádio Betel 87.9 FM | São Francisco do Sul" é um nome de verdade da
    // planilha: tem acento, ponto e barra vertical. Uma serialização por
    // vírgula o quebraria em dois veículos.
    const complicado = 'Rádio Betel 87.9 FM | São Francisco do Sul, SC';

    await importarPlanilhaDoScore('clipei', PLANILHA, [complicado]);

    expect(JSON.parse(String(corpos[0].get('veiculos_a_criar')))).toEqual([complicado]);
  });
});
