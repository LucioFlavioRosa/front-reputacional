// @vitest-environment jsdom

/** A ABA QUE CRIA O DADO NÃO PODE EXIGIR DADO.
 *
 *  O DEFEITO, relatado em 18/10/2026 num ambiente recém-limpo: "ao acessar a
 *  página de base não aparece nada para subir e tem essa mensagem: Nenhum mês
 *  com dado. Mesmo sem dado algum na base eu deveria poder subir base de
 *  dados". Estava certo.
 *
 *  `Score.tsx` tinha quatro guardas antes do despacho das abas, e uma delas é
 *  `if (!opcoes.meses.length) return <Vazio mensagem="Nenhum mês com dado" />`.
 *  A aba `base` — a PORTA DE ENTRADA do dado — ficava atrás dela. Sem subida não
 *  há mês; sem mês, a tela da subida não aparecia. A única saída era pelo banco.
 *
 *  A REGRA JÁ EXISTIA PARA UMA ABA SÓ. `riscos` tinha sido movida para antes das
 *  guardas com o comentário de que senão "morria no 'Nenhum mês com dado'". As
 *  outras três ficaram para trás, e o comentário do `Provider` já as declarava
 *  sem índice: `metodologia` é texto, `base-de-dados` é tabela, `base` é
 *  formulário.
 *
 *  ESTE ARQUIVO PRENDE AS DUAS METADES: as quatro abas aparecem com zero meses,
 *  e as que DEPENDEM do índice continuam mostrando o vazio. Sem a segunda
 *  metade, "mover tudo para antes das guardas" também passaria — e aí a Visão
 *  geral desenharia um radar sem dado.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { OpcoesDoScore } from '@/dominio/score';

/** O estado do ambiente recém-limpo: nenhuma planilha subida, nenhum mês. */
const SEM_MESES: OpcoesDoScore = {
  reguas_de_tier: [],
  reguas_de_engajamento: [],
  lentes: [
    { codigo: 'imprensa', nome: 'Imprensa', stakeholder: 'Formadores de opinião', peso_padrao: 30 },
  ],
  meses: [],
  mes_sugerido: null,
} as unknown as OpcoesDoScore;

vi.mock('@/api/cliente', () => ({
  obterOpcoesDoScore: vi.fn(() => Promise.resolve(SEM_MESES)),
  //: O ÍNDICE NUNCA RESPONDE, de propósito: com zero meses não há mês para
  //: pedir, e uma promessa pendurada garante que nada abaixo das guardas
  //: aconteceu quando o teste olha.
  obterScore: vi.fn(() => new Promise(() => {})),
  obterSerieDoScore: vi.fn(() => Promise.resolve([])),
  obterDriversDoScore: vi.fn(() => new Promise(() => {})),
  obterDossieDaLente: vi.fn(() => new Promise(() => {})),
  obterOpcoesDeFiltroDaLente: vi.fn(() => Promise.resolve(undefined)),
  obterConsultaDaLente: vi.fn(() => new Promise(() => {})),
}));

//: AS QUATRO ABAS VIRAM MARCADORES. O que se afirma aqui é o DESPACHO — se elas
//: aparecem com zero meses —, e montá-las de verdade traria a árvore de
//: dependências de cada uma para dentro de um teste que não é sobre elas.
vi.mock('@/paginas/score/BaseDoScore', () => ({
  BaseDoScore: () => <p>FORMULARIO DE SUBIDA</p>,
}));
vi.mock('@/paginas/score/BaseDeDadosDoScore', () => ({
  BaseDeDadosDoScore: () => <p>TABELA DA BASE</p>,
}));
vi.mock('@/paginas/score/RastreioDeRisco', () => ({
  RastreioDeRisco: () => <p>RASTREIO DE RISCO</p>,
}));
//: `Metodologia` NÃO É MOCKADA porque não é módulo: ela é função local de
//: `Score.tsx`. Então a asserção dela ancora no título de verdade — que é
//: texto estático, sem dado nenhum, e é exatamente o motivo de a aba poder
//: aparecer com a base vazia.
const TITULO_DA_METODOLOGIA = 'Como o índice é calculado';

import { Score } from '@/paginas/Score';

afterEach(() => {
  vi.clearAllMocks();
});

describe('com ZERO meses na base', () => {
  it('a aba `base` mostra o formulário de subida, e NÃO o "Nenhum mês com dado"', async () => {
    render(<Score aba="base" aoTrocarAba={() => {}} />);

    await waitFor(() => expect(screen.getByText('FORMULARIO DE SUBIDA')).toBeTruthy());
    //: A METADE QUE IMPORTA: a mensagem de vazio não pode estar na tela, senão
    //: a pessoa continua sem saber onde subir.
    expect(screen.queryByText('Nenhum mês com dado')).toBeNull();
  });

  it.each([
    ['base-de-dados', 'TABELA DA BASE'],
    ['riscos', 'RASTREIO DE RISCO'],
    ['metodologia', TITULO_DA_METODOLOGIA],
  ])('a aba `%s` também aparece sem mês nenhum', async (aba, marcador) => {
    render(<Score aba={aba} aoTrocarAba={() => {}} />);

    //: `getAllByText`: na Metodologia o título é também o nome da aba "Como o
    //: índice é calculado" (ao lado de "Árvore da taxonomia").
    await waitFor(() => expect(screen.getAllByText(marcador).length).toBeGreaterThan(0));
    expect(screen.queryByText('Nenhum mês com dado')).toBeNull();
  });

  it.each(['base', 'base-de-dados', 'riscos', 'metodologia'])(
    'a aba `%s` mantém o `h1` da página',
    async (aba) => {
      /** ACHADO DA REVISÃO DO CODEX. O `h1` oculto "KPIs Reputacionais" mora no
       *  `return` principal, e sair antes dele deixava estas abas com `h2` como
       *  título mais alto — uma página sem `h1`, que é defeito de acessibilidade
       *  e não detalhe. A aba `riscos` já saía antes e já tinha esse buraco: ele
       *  não era regressão desta mudança, mas as quatro o resolvem agora de uma
       *  vez, porque saem pelo mesmo `return`.
       */
      render(<Score aba={aba} aoTrocarAba={() => {}} />);

      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 1, name: 'KPIs Reputacionais' })).toBeTruthy(),
      );
    },
  );

  it.each(['geral', 'lentes', 'drivers'])(
    'a aba `%s` CONTINUA mostrando o vazio — ela depende do índice',
    async (aba) => {
      /** O CONTROLE QUE IMPEDE O CONSERTO DE VIRAR OUTRO DEFEITO. Estas três
       *  desenham o índice; mostrá-las sem mês seria um radar vazio, que se lê
       *  como "a reputação é zero" em vez de "não há dado". A mensagem de vazio
       *  é a resposta certa AQUI. */
      render(<Score aba={aba} aoTrocarAba={() => {}} />);

      await waitFor(() => expect(screen.getByText('Nenhum mês com dado')).toBeTruthy());
      expect(screen.queryByText('FORMULARIO DE SUBIDA')).toBeNull();
    },
  );
});
