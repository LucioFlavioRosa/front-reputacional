// @vitest-environment jsdom

/** SUBIR PLANILHA ATUALIZA A TELA, SEM F5.
 *
 *  O DEFEITO, relatado em 18/10/2026: "quando eu subo uma planilha com dados
 *  novos eu não vejo o resultado se refletir na lente correspondente; preciso
 *  atualizar a página. Eu quero clicar na lente e já ver o resultado sem
 *  precisar dar F5".
 *
 *  A CAUSA. O barramento já existia e já disparava certo: toda escrita sob
 *  `/api/score` chama `scoreMudou.avisar()` e esquece o cache da API
 *  (`api/nucleo.ts`). Só que ele tinha UM ÚNICO ouvinte — o cache da Consulta
 *  em profundidade (`useConsultaDaLente`). `Score.tsx` guarda as opções (a
 *  LISTA DE MESES), o índice e a série em estado de componente, carregados na
 *  montagem, e não escutava nada. Esquecer o cache não faz ninguém buscar de
 *  novo: só garante que a próxima busca seja de verdade.
 *
 *  E `BaseDoScore` não avisa ninguém — não tem sequer props. Então a subida
 *  acontecia na aba ao lado e a tela inteira continuava com os números de
 *  antes, a sessão inteira.
 *
 *  O MÊS ESCOLHIDO NÃO SE MEXE, e é decisão, não esquecimento: `definirMes`
 *  mantém o atual (`atual ?? …`). A regra "o mês mais completo, e não o mais
 *  recente" existe porque o mês recém-subido costuma estar pela metade; trocar
 *  o mês de quem está olhando seria pior que a espera de um clique. Quando NÃO
 *  há mês — base recém-limpa, a primeira subida — o `??` o define, e é aí que
 *  a tela nasce povoada.
 */

import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { scoreMudou } from '@/dominio/sincronizacao';
import type { OpcoesDoScore } from '@/dominio/score';

const UM_MES: OpcoesDoScore = {
  reguas_de_tier: [],
  reguas_de_engajamento: [],
  lentes: [
    { codigo: 'imprensa', nome: 'Imprensa', stakeholder: 'Formadores de opinião', peso_padrao: 30 },
  ],
  meses: ['2026-08-01'],
  mes_sugerido: '2026-08-01',
} as unknown as OpcoesDoScore;

const { obterOpcoesDoScore, obterScore, obterSerieDoScore } = vi.hoisted(() => ({
  obterOpcoesDoScore: vi.fn(),
  obterScore: vi.fn(),
  obterSerieDoScore: vi.fn(),
}));

vi.mock('@/api/cliente', () => ({
  obterOpcoesDoScore,
  obterScore,
  obterSerieDoScore,
  obterDriversDoScore: vi.fn(() => new Promise(() => {})),
  obterDossieDaLente: vi.fn(() => new Promise(() => {})),
  obterOpcoesDeFiltroDaLente: vi.fn(() => Promise.resolve(undefined)),
  obterConsultaDaLente: vi.fn(() => new Promise(() => {})),
}));

import { Score } from '@/paginas/Score';

beforeEach(() => {
  obterOpcoesDoScore.mockImplementation(() => Promise.resolve(UM_MES));
  obterScore.mockImplementation(() => new Promise(() => {}));
  obterSerieDoScore.mockImplementation(() => Promise.resolve([]));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('depois de uma escrita no Score', () => {
  it('a tela busca de novo as opções, o índice e a série', async () => {
    render(<Score aba="geral" aoTrocarAba={() => {}} />);
    await waitFor(() => expect(obterScore).toHaveBeenCalled());

    const antes = {
      opcoes: obterOpcoesDoScore.mock.calls.length,
      indice: obterScore.mock.calls.length,
      serie: obterSerieDoScore.mock.calls.length,
    };

    //: O QUE A SUBIDA FAZ, exatamente: `api/nucleo.ts` chama isto depois de
    //: qualquer POST sob `/api/score` que tenha dado certo.
    scoreMudou.avisar();

    await waitFor(() =>
      expect(obterOpcoesDoScore.mock.calls.length).toBeGreaterThan(antes.opcoes),
    );
    //: AS TRÊS, e não só as opções: a lista de meses ganha o mês novo, mas o
    //: número da lente vem do índice e o gráfico vem da série. Recarregar uma
    //: só deixaria a tela misturando dado novo com dado velho, que é pior que
    //: o F5 — porque não se vê.
    expect(obterScore.mock.calls.length).toBeGreaterThan(antes.indice);
    expect(obterSerieDoScore.mock.calls.length).toBeGreaterThan(antes.serie);
  });

  it('a lista de meses passa a incluir o mês que a planilha trouxe', async () => {
    render(<Score aba="geral" aoTrocarAba={() => {}} />);
    await waitFor(() => expect(obterScore).toHaveBeenCalled());

    const antes = obterOpcoesDoScore.mock.calls.length;
    const COM_SETEMBRO = { ...UM_MES, meses: ['2026-08-01', '2026-09-01'] };
    obterOpcoesDoScore.mockImplementation(() => Promise.resolve(COM_SETEMBRO));

    scoreMudou.avisar();

    await waitFor(() =>
      expect(obterOpcoesDoScore.mock.calls.length).toBeGreaterThan(antes),
    );
    //: O MÊS ESCOLHIDO CONTINUA SENDO AGOSTO. Setembro entra na lista; quem
    //: está olhando decide quando ir para lá — e este `expect` é a guarda
    //: contra o conserto "fácil" de saltar para o mês mais recente, que a
    //: regra do `mes_sugerido` existe justamente para não fazer.
    expect(obterScore).not.toHaveBeenCalledWith('2026-09-01');
  });

  it('SEM aviso nenhum, a tela não fica rebuscando sozinha', async () => {
    /** O CONTROLE NEGATIVO que impede o conserto de virar um laço.
     *
     *  Pôr um contador nas dependências de três efeitos é a forma mais fácil
     *  de criar uma tela que busca para sempre. Se as buscas se repetirem sem
     *  aviso, este teste cai. */
    render(<Score aba="geral" aoTrocarAba={() => {}} />);
    await waitFor(() => expect(obterScore).toHaveBeenCalled());

    const depoisDeAssentar = obterOpcoesDoScore.mock.calls.length;
    await new Promise((resolver) => setTimeout(resolver, 50));

    expect(obterOpcoesDoScore.mock.calls.length).toBe(depoisDeAssentar);
  });
});