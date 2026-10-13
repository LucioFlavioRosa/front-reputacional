// @vitest-environment jsdom

/** O que a abertura do Score pede, e em que ordem.
 *
 *  O PROBLEMA MEDIDO (12/10/2026). A série não depende do mês —
 *  `obterSerieDoScore()` não recebe parâmetro —, mas vinha dentro do
 *  `recarregar`, que só roda depois de `mes` existir, e `mes` só existe depois de
 *  as OPÇÕES responderem. Eram duas idas ao servidor em fila antes de a tela
 *  mostrar qualquer coisa: na telemetria da Azure, `score/opcoes` com p95 de
 *  993 ms e `score/serie` com 679 ms, somados em vez de sobrepostos.
 *
 *  O QUE ESTE TESTE PRENDE: a série é pedida na MONTAGEM, sem esperar as opções.
 *  Se alguém devolver a série para dentro do `recarregar` e tirá-la daqui, o
 *  teste cai — e cai pelo motivo certo, porque ele deixa as opções penduradas de
 *  propósito.
 */

import { render, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IndiceDoScore, OpcoesDoScore } from '@/dominio/score';

const OPCOES: OpcoesDoScore = {
  reguas_de_tier: [],
  reguas_de_engajamento: [],
  lentes: [
    { codigo: 'imprensa', nome: 'Imprensa', stakeholder: 'Formadores de opinião', peso_padrao: 30 },
  ],
  meses: ['2026-08'],
  mes_sugerido: '2026-08',
};

const INDICE = {
  mes: '2026-08',
  isr: 50,
  faixa: 'Atenção',
  leitura_da_faixa: '',
  delta_mes: null,
  delta_inicio: null,
  lentes: [],
  calibracao: { padrao: true, radial_por_peso: false },
  fatos: [],
  leitura: '',
} as unknown as IndiceDoScore;

/** As opções ficam PENDURADAS, e é esse o experimento: nada que dependa delas
 *  pode ter acontecido quando o teste olha. */
let soltarAsOpcoes: (o: OpcoesDoScore) => void = () => {};

vi.mock('@/api/cliente', () => ({
  obterOpcoesDoScore: vi.fn(
    () =>
      new Promise<OpcoesDoScore>((resolver) => {
        soltarAsOpcoes = resolver;
      }),
  ),
  obterScore: vi.fn(() => Promise.resolve(INDICE)),
  obterSerieDoScore: vi.fn(() => Promise.resolve([])),
  obterDriversDoScore: vi.fn(() => new Promise(() => {})),
  obterDossieDaLente: vi.fn(() => new Promise(() => {})),
  obterOpcoesDeFiltroDaLente: vi.fn(() => Promise.resolve(undefined)),
  obterConsultaDaLente: vi.fn(() => new Promise(() => {})),
}));

vi.mock('@/paginas/score/PainelDaJornada', () => ({
  PainelDaJornada: () => null,
}));

vi.mock('@/paginas/score/ComparacaoDeRadares', () => ({
  ComparacaoDeRadares: () => null,
}));

vi.mock('@/paginas/score/consulta/ConsultaEmProfundidade', () => ({
  ConsultaEmProfundidade: () => null,
}));

import { obterScore, obterSerieDoScore } from '@/api/cliente';
import { Score } from '@/paginas/Score';

function Casca() {
  const [aba, definirAba] = useState('geral');
  return <Score aba={aba} aoTrocarAba={definirAba} />;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('a abertura do Score', () => {
  it('pede a série sem esperar as opções', async () => {
    render(<Casca />);

    await waitFor(() => {
      expect(vi.mocked(obterSerieDoScore)).toHaveBeenCalled();
    });

    // A PROVA DE QUE A FILA MORREU: as opções nunca responderam, então o mês
    // não existe — e o índice, que depende dele, não foi pedido. Se a série
    // estivesse na mesma corrente, ela também não teria sido.
    expect(vi.mocked(obterScore)).not.toHaveBeenCalled();
  });

  it('o índice vem depois, quando as opções dizem o mês', async () => {
    render(<Casca />);
    soltarAsOpcoes(OPCOES);

    await waitFor(() => {
      expect(vi.mocked(obterScore)).toHaveBeenCalledWith('2026-08');
    });
  });
});
