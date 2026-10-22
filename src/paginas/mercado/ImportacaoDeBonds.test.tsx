// @vitest-environment jsdom

/** A aba de importação de bonds.
 *
 *  O QUE ESTE ARQUIVO PROTEGE:
 *
 *  1. CONFERIR NÃO GRAVA, e gravar só acontece no segundo clique. É a forma que
 *     a importação de agendas registra no próprio código: "importação de
 *     planilha sem conferência humana cria duplicata em massa, e desfazer isso
 *     depois é pior que digitar de novo";
 *  2. que a conta na tela descreva O ARQUIVO QUE O BOTÃO VAI SUBIR — trocar de
 *     arquivo com uma conferência na tela é o jeito mais fácil de subir uma
 *     planilha achando que é outra;
 *  3. que o que NÃO vai entrar apareça, nas quatro listas separadas;
 *  4. que o resultado diga inseridas e atualizadas SEPARADAS: "33.294 gravadas"
 *     não distingue a primeira carga de uma recarga do mesmo arquivo, e é essa
 *     diferença que diz se a subida da semana trouxe dado novo.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConferenciaDeBonds } from '@/api/cliente';

const { conferirPlanilhaDeBonds, importarPlanilhaDeBonds } = vi.hoisted(() => ({
  conferirPlanilhaDeBonds: vi.fn(),
  importarPlanilhaDeBonds: vi.fn(),
}));

vi.mock('@/api/cliente', () => ({ conferirPlanilhaDeBonds, importarPlanilhaDeBonds }));

import { ImportacaoDeBonds } from './ImportacaoDeBonds';

function conferencia(parcial: Partial<ConferenciaDeBonds> = {}): ConferenciaDeBonds {
  return {
    primeira_data: '2022-01-01',
    ultima_data: '2026-10-16',
    cotacoes_no_arquivo: 33294,
    a_inserir: 120,
    a_atualizar: 33174,
    por_ticker: { AEGEBZ31: 1115, AEGEBZ36: 387 },
    tickers_desconhecidos: [],
    tickers_sem_valor: [],
    rotulos_ignorados: [],
    pares_repetidos: [],
    linha_que_encerrou: null,
    ...parcial,
  };
}

/** A resposta da conferência COMO A TELA A RECEBE desde 22/10/2026.
 *
 *  O IDENTIFICADOR VIAJA JUNTO: é ele que permite à importação ler o arquivo
 *  que já subiu em partes, em vez de mandar os bytes outra vez. Nulo é o
 *  caminho de uma vez só — arquivo pequeno ou ambiente sem armazenamento. */
function feita(parcial: Partial<ConferenciaDeBonds> = {}, subidaId: string | null = null) {
  return { conferencia: conferencia(parcial), subidaId };
}

function planilha(nome = 'bonds.xlsx'): File {
  return new File([new Uint8Array([0x50, 0x4b, 3, 4])], nome, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function escolher(arquivo: File) {
  const entrada = document.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(entrada, 'files', { value: [arquivo], configurable: true });
  entrada.dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(() => {
  conferirPlanilhaDeBonds.mockImplementation(() => Promise.resolve(feita()));
  importarPlanilhaDeBonds.mockImplementation(() =>
    Promise.resolve({ inseridas: 120, atualizadas: 33174, papeis_completados: 2 }),
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('a forma: conferir, depois gravar', () => {
  it('sem arquivo, o botão de conferir está desabilitado', () => {
    render(<ImportacaoDeBonds />);

    const botao = screen.getByRole('button', { name: /Conferir antes de subir/ });
    expect(botao.hasAttribute('disabled')).toBe(true);
  });

  it('conferir NÃO grava, e mostra a conta', async () => {
    render(<ImportacaoDeBonds />);
    escolher(planilha());

    screen.getByRole('button', { name: /Conferir antes de subir/ }).click();

    await waitFor(() => expect(screen.getByText('O que esta subida faria')).toBeTruthy());
    expect(importarPlanilhaDeBonds).not.toHaveBeenCalled();
    expect(screen.getByText('33.294')).toBeTruthy();
    expect(screen.getByText('01/01/2022 a 16/10/2026')).toBeTruthy();
  });

  it('o botão de subir diz as DUAS coisas que vão acontecer', async () => {
    /** Inserir e atualizar são operações diferentes, e um "Confirmar" sozinho
     *  esconderia a segunda — que, num arquivo cumulativo, é quase tudo. */
    render(<ImportacaoDeBonds />);
    escolher(planilha());
    screen.getByRole('button', { name: /Conferir antes de subir/ }).click();

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Subir 120 novas e atualizar 33.174' }),
      ).toBeTruthy(),
    );
  });

  it('o segundo clique grava e mostra os números SEPARADOS', async () => {
    render(<ImportacaoDeBonds />);
    escolher(planilha());
    screen.getByRole('button', { name: /Conferir antes de subir/ }).click();
    await waitFor(() => expect(screen.getByText('O que esta subida faria')).toBeTruthy());

    screen.getByRole('button', { name: /^Subir 120 novas/ }).click();

    await waitFor(() =>
      expect(
        screen.getByText(/120 cotações novas, 33\.174 atualizadas/),
      ).toBeTruthy(),
    );
    expect(importarPlanilhaDeBonds).toHaveBeenCalledTimes(1);
  });

  it('o export que subiu EM PARTES é importado pelo identificador, sem reenviar', async () => {
    /** A mudança de 22/10/2026, e a razão de tudo isto.
     *
     *  Até aqui a tela mandava o arquivo INTEIRO duas vezes — uma para conferir
     *  e outra para importar — e cada uma tinha de caber nos 240 s em que o
     *  ingress do Container Apps encerra a requisição. O export de bonds é
     *  cumulativo e cresce toda semana.
     *
     *  SEM ESTA ASSERÇÃO o identificador poderia parar de ser repassado e nada
     *  quebraria na aparência: a importação voltaria a mandar os bytes e só
     *  falharia na semana em que o arquivo ficasse grande demais — longe da
     *  causa. */
    conferirPlanilhaDeBonds.mockImplementation(() =>
      Promise.resolve(feita({}, 'e8b1c2d3-0000-4000-8000-000000000001')),
    );
    render(<ImportacaoDeBonds />);
    const arquivo = planilha();
    escolher(arquivo);
    screen.getByRole('button', { name: /Conferir antes de subir/ }).click();
    await waitFor(() => expect(screen.getByText('O que esta subida faria')).toBeTruthy());

    screen.getByRole('button', { name: /^Subir 120 novas/ }).click();

    await waitFor(() => expect(importarPlanilhaDeBonds).toHaveBeenCalledTimes(1));
    expect(importarPlanilhaDeBonds).toHaveBeenCalledWith(
      arquivo,
      'e8b1c2d3-0000-4000-8000-000000000001',
    );
  });

  it('o export pequeno continua sendo reenviado, com identificador NULO', async () => {
    /** O controle do teste acima. Arquivo pequeno e ambiente sem armazenamento
     *  caem no caminho de sempre, e ali não há o que referenciar — a tela tem
     *  de mandar os bytes. Sem esta asserção, um identificador vazando como
     *  string vazia faria a importação pedir um arquivo que não existe. */
    render(<ImportacaoDeBonds />);
    const arquivo = planilha();
    escolher(arquivo);
    screen.getByRole('button', { name: /Conferir antes de subir/ }).click();
    await waitFor(() => expect(screen.getByText('O que esta subida faria')).toBeTruthy());

    screen.getByRole('button', { name: /^Subir 120 novas/ }).click();

    await waitFor(() => expect(importarPlanilhaDeBonds).toHaveBeenCalledTimes(1));
    expect(importarPlanilhaDeBonds).toHaveBeenCalledWith(arquivo, null);
  });

  it('depois de trocar o arquivo NÃO HÁ como importar a subida anterior', async () => {
    /** O defeito plausível desta tela: conferir um export grande (que sobe em
     *  partes e deixa um identificador), trocar o arquivo e subir gravaria o
     *  export ANTERIOR com o nome do novo na tela. Impossível de notar.
     *
     *  O QUE DE FATO O IMPEDE é o botão sumir, e não o identificador ser
     *  zerado: `aoEscolher` descarta a conferência, e sem conferência na tela
     *  não existe "Subir". `definirSubidaId(null)` ali é cinto de segurança —
     *  correto, mas não é a guarda.
     *
     *  ESTA VERSÃO VEIO DE REVISÃO, e a anterior passava por motivo errado:
     *  ela conferia de novo o arquivo novo (que devolve identificador nulo) e
     *  afirmava que a importação recebeu nulo — o que continuaria verdade com
     *  o `definirSubidaId(null)` removido, porque o `.then` da segunda
     *  conferência zera o estado de qualquer forma. Afirmar o que o teste
     *  realmente protege vale mais do que afirmar a linha que eu escrevi. */
    conferirPlanilhaDeBonds.mockImplementation(() =>
      Promise.resolve(feita({}, 'e8b1c2d3-0000-4000-8000-000000000001')),
    );
    render(<ImportacaoDeBonds />);
    escolher(planilha('setembro.xlsx'));
    screen.getByRole('button', { name: /Conferir antes de subir/ }).click();
    await waitFor(() => expect(screen.getByText('O que esta subida faria')).toBeTruthy());

    escolher(planilha('outubro.xlsx'));

    expect(screen.queryByRole('button', { name: /^Subir/ })).toBeNull();
    expect(screen.queryByText('O que esta subida faria')).toBeNull();
    expect(importarPlanilhaDeBonds).not.toHaveBeenCalled();
  });

  it('o progresso da subida é ANUNCIÁVEL, e não só visível no botão', async () => {
    /** ACHADO DE REVISÃO DE ACESSIBILIDADE. O texto do botão muda a cada parte
     *  ("Subindo 3 de 11…"), mas o botão fica DESABILITADO enquanto sobe — e
     *  leitor de tela não anuncia mudança em elemento desabilitado de forma
     *  confiável. Numa subida de minutos, quem não vê a tela ficaria sem
     *  nenhum sinal de que algo acontece.
     *
     *  O `role="status"` É O QUE SE AFIRMA AQUI, e não o texto do botão: é ele
     *  que carrega a informação para quem não enxerga. */
    let avisar: ((enviadas: number, total: number) => void) | undefined;
    conferirPlanilhaDeBonds.mockImplementation(
      (_arquivo: File, aoProgresso?: (enviadas: number, total: number) => void) => {
        avisar = aoProgresso;
        return new Promise(() => {});
      },
    );
    render(<ImportacaoDeBonds />);
    escolher(planilha());
    screen.getByRole('button', { name: /Conferir antes de subir/ }).click();

    await waitFor(() => expect(avisar).toBeDefined());
    act(() => avisar?.(3, 11));

    const aviso = await screen.findByRole('status');
    expect(aviso.textContent).toMatch(/parte 3 de 11/);
  });

  it('cancelar descarta a conferência', async () => {
    render(<ImportacaoDeBonds />);
    escolher(planilha());
    screen.getByRole('button', { name: /Conferir antes de subir/ }).click();
    await waitFor(() => expect(screen.getByText('O que esta subida faria')).toBeTruthy());

    screen.getAllByRole('button', { name: 'Cancelar' })[0].click();

    await waitFor(() => expect(screen.queryByText('O que esta subida faria')).toBeNull());
    expect(importarPlanilhaDeBonds).not.toHaveBeenCalled();
  });
});

describe('a conta descreve o arquivo que o botão vai subir', () => {
  it('trocar de arquivo DESCARTA a conferência anterior', async () => {
    /** O jeito mais fácil de subir uma planilha achando que é outra: conferir
     *  a de setembro, trocar para a de outubro, e clicar em "Subir 120 novas"
     *  — um número que descreve a primeira. */
    render(<ImportacaoDeBonds />);
    escolher(planilha('setembro.xlsx'));
    screen.getByRole('button', { name: /Conferir antes de subir/ }).click();
    await waitFor(() => expect(screen.getByText('O que esta subida faria')).toBeTruthy());

    escolher(planilha('outubro.xlsx'));

    await waitFor(() => expect(screen.queryByText('O que esta subida faria')).toBeNull());
    expect(screen.queryByRole('button', { name: /^Subir/ })).toBeNull();
  });
});

describe('o que NÃO vai entrar', () => {
  it('o ticker fora do cadastro aparece, com o que fazer', async () => {
    conferirPlanilhaDeBonds.mockImplementation(() =>
      Promise.resolve(feita({ tickers_desconhecidos: ['NOVOBZ30'] })),
    );
    render(<ImportacaoDeBonds />);
    escolher(planilha());
    screen.getByRole('button', { name: /Conferir antes de subir/ }).click();

    await waitFor(() => expect(screen.getByText('NOVOBZ30')).toBeTruthy());
    expect(screen.getByText(/pede uma linha no cadastro de bonds/)).toBeTruthy();
  });

  it('o rótulo de coluna ignorado aparece com o nome da coluna', async () => {
    /** É o caso de a origem renomear `Yield` para `PX_LAST`: sem esta lista a
     *  coluna desapareceria e a conferência diria um número menor sem dizer
     *  por quê. */
    conferirPlanilhaDeBonds.mockImplementation(() =>
      Promise.resolve(feita({ rotulos_ignorados: [['AEGEBZ31', 'observacao']] })),
    );
    render(<ImportacaoDeBonds />);
    escolher(planilha());
    screen.getByRole('button', { name: /Conferir antes de subir/ }).click();

    await waitFor(() =>
      expect(screen.getByText('AEGEBZ31 — coluna "observacao"')).toBeTruthy(),
    );
  });

  it('as listas vazias NÃO aparecem', async () => {
    /** Quatro cabeçalhos dizendo "(0)" transformariam a conferência numa
     *  parede de nada. */
    render(<ImportacaoDeBonds />);
    escolher(planilha());
    screen.getByRole('button', { name: /Conferir antes de subir/ }).click();
    await waitFor(() => expect(screen.getByText('O que esta subida faria')).toBeTruthy());

    expect(screen.queryByText(/Ficam de fora/)).toBeNull();
    expect(screen.queryByText(/Sem valor nenhum/)).toBeNull();
  });

  it('a linha que encerrou a leitura é dita, com o número', async () => {
    conferirPlanilhaDeBonds.mockImplementation(() =>
      Promise.resolve(feita({ linha_que_encerrou: 1203 })),
    );
    render(<ImportacaoDeBonds />);
    escolher(planilha());
    screen.getByRole('button', { name: /Conferir antes de subir/ }).click();

    await waitFor(() =>
      expect(screen.getByText(/parou na linha 1\.203/)).toBeTruthy(),
    );
  });
});

describe('a falha', () => {
  it('a recusa do servidor aparece como faixa, com a frase dele', async () => {
    conferirPlanilhaDeBonds.mockImplementation(() =>
      Promise.reject(new Error('O arquivo não é um .xlsx — os primeiros bytes não são de ZIP.')),
    );
    render(<ImportacaoDeBonds />);
    escolher(planilha('errado.pdf'));

    screen.getByRole('button', { name: /Conferir antes de subir/ }).click();

    await waitFor(() => expect(screen.getByText(/não é um \.xlsx/)).toBeTruthy());
    expect(screen.queryByText('O que esta subida faria')).toBeNull();
  });
});
