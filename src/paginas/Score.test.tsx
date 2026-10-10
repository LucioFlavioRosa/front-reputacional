// @vitest-environment jsdom

/** O Score e o hash do drill da aba Lentes (decisões A3, A4 e D3 da Consulta
 *  em profundidade): a lente nasce do hash, trocar de lente o reescreve, e a
 *  busca do cabeçalho leva ao drill sem que a troca de aba apague o destino.
 *
 *  A raiz do drill, a Jornada e a comparação de radares viram marcadores:
 *  aqui só importa o endereço, a lente aberta e o bloco "Drill down". */

import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IndiceDoScore, OpcoesDoScore } from '@/dominio/score';

const OPCOES_DO_SCORE: OpcoesDoScore = {
  reguas_de_tier: [],
  reguas_de_engajamento: [],
  lentes: [
    { codigo: 'imprensa', nome: 'Imprensa', stakeholder: 'Formadores de opinião', peso_padrao: 30 },
    { codigo: 'mercado', nome: 'Mercado', stakeholder: 'Investidores e rating', peso_padrao: 20 },
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

vi.mock('@/api/cliente', () => ({
  obterOpcoesDoScore: vi.fn(() => Promise.resolve(OPCOES_DO_SCORE)),
  obterScore: vi.fn(() => Promise.resolve(INDICE)),
  obterSerieDoScore: vi.fn(() => Promise.resolve([])),
  obterDriversDoScore: vi.fn(() => new Promise(() => {})),
  obterDossieDaLente: vi.fn(() => new Promise(() => {})),
  obterOpcoesDeFiltroDaLente: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock('@/paginas/score/PainelDaJornada', () => ({
  PainelDaJornada: ({ titulo }: { titulo: string }) => <p>{titulo}</p>,
}));

vi.mock('@/paginas/score/ComparacaoDeRadares', () => ({
  ComparacaoDeRadares: () => null,
}));

vi.mock('@/paginas/score/consulta/ConsultaEmProfundidade', () => ({
  ConsultaEmProfundidade: ({ lente }: { lente: string }) => <p>raiz do drill: {lente}</p>,
}));

import { obterDossieDaLente } from '@/api/cliente';
import { Score } from '@/paginas/Score';

/** A aba no endereço, como o `irPara` da navegação: empilha caminho e
 *  consulta, SEM o hash (é o comportamento real que a busca precisa
 *  respeitar). */
function Casca({ abaInicial }: { abaInicial: string }) {
  const [aba, definirAba] = useState(abaInicial);
  return (
    <Score
      aba={aba}
      aoTrocarAba={(nova) => {
        window.history.pushState(null, '', `/score/${nova}${window.location.search}`);
        definirAba(nova);
      }}
    />
  );
}

async function montar(aba: string) {
  render(<Casca abaInicial={aba} />);
  await waitFor(() => expect(screen.getByRole('combobox')).toBeTruthy());
}

const abaDaLente = (nome: string) => screen.getByRole('tab', { name: nome });
const botaoDoDrill = () => screen.queryByRole('button', { name: /Drill down/ });

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('Score · lente pelo hash (A4)', () => {
  it('a lente aberta nasce da lente do hash', async () => {
    window.history.replaceState(null, '', '/score/lentes#consulta&lente=mercado');
    await montar('lentes');
    expect(abaDaLente('Mercado').getAttribute('aria-selected')).toBe('true');
  });

  it('lente inválida no hash cai na Imprensa', async () => {
    window.history.replaceState(null, '', '/score/lentes#consulta&lente=xyz');
    await montar('lentes');
    expect(abaDaLente('Imprensa').getAttribute('aria-selected')).toBe('true');
  });

  it('trocar de lente reescreve o hash com a lente nova e sem níveis, com replace', async () => {
    window.history.replaceState(null, '', '/score/lentes?uf=RJ#consulta&lente=imprensa&pilar=governanca');
    await montar('lentes');
    const antes = window.history.length;

    await userEvent.click(abaDaLente('Mercado'));

    expect(abaDaLente('Mercado').getAttribute('aria-selected')).toBe('true');
    expect(window.location.hash).toBe('#consulta&lente=mercado');
    expect(window.location.search).toBe('?uf=RJ');
    expect(window.history.length).toBe(antes);
  });

  it('sem hash do drill, trocar de lente não escreve hash', async () => {
    window.history.replaceState(null, '', '/score/lentes');
    await montar('lentes');
    await userEvent.click(abaDaLente('Mercado'));
    expect(window.location.hash).toBe('');
  });

  it('voltar do navegador para um hash de outra lente reabre aquela lente', async () => {
    window.history.replaceState(null, '', '/score/lentes#consulta&lente=imprensa');
    await montar('lentes');
    window.history.replaceState(null, '', '/score/lentes#consulta&lente=mercado');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await waitFor(() => expect(abaDaLente('Mercado').getAttribute('aria-selected')).toBe('true'));
  });

  it('voltar para uma entrada de outra lente não regrava o hash: a lente sai do próprio hash', async () => {
    window.history.replaceState(null, '', '/score/lentes#consulta&lente=imprensa&pilar=governanca');
    await montar('lentes');
    const replace = vi.spyOn(window.history, 'replaceState');
    window.history.pushState(null, '', '/score/lentes#consulta&lente=mercado');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await waitFor(() => expect(abaDaLente('Mercado').getAttribute('aria-selected')).toBe('true'));
    expect(window.location.hash).toBe('#consulta&lente=mercado');
    expect(replace).not.toHaveBeenCalled();
    replace.mockRestore();
  });

  it('clicar na aba da lente que já está aberta não mexe no hash nem na história', async () => {
    const profundo =
      '#consulta&lente=imprensa&pilar=eficiencia-operacional&tema=abastecimento-agua&subtema=rompimento-adutora&sent=negativas';
    window.history.replaceState(null, '', `/score/lentes${profundo}`);
    await montar('lentes');
    const replace = vi.spyOn(window.history, 'replaceState');
    await userEvent.click(abaDaLente('Imprensa'));
    expect(window.location.hash).toBe(profundo);
    expect(replace).not.toHaveBeenCalled();
    replace.mockRestore();
  });
});

describe('Score · busca do cabeçalho leva ao drill (D3)', () => {
  it('da Visão geral: abre Lentes, Imprensa e o bloco, e a entrada final tem o hash', async () => {
    window.history.replaceState(null, '', '/score/geral?uf=RJ');
    await montar('geral');
    const antes = window.history.length;

    await userEvent.type(screen.getByRole('combobox'), 'adutora');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => expect(screen.getByText('raiz do drill: imprensa')).toBeTruthy());
    expect(window.location.pathname).toBe('/score/lentes');
    expect(window.location.search).toBe('?uf=RJ');
    expect(window.location.hash).toMatch(/^#consulta&lente=imprensa&pilar=[^&]+&tema=[^&]+&subtema=[^&]+$/);
    // Uma escolha, uma entrada: a da aba Lentes, já com o hash.
    expect(window.history.length).toBe(antes + 1);
    expect(abaDaLente('Imprensa').getAttribute('aria-selected')).toBe('true');
    expect(botaoDoDrill()?.getAttribute('aria-expanded')).toBe('true');
  });

  it('já nas Lentes, no Mercado: vai para a Imprensa com o filtro zerado e empilha o destino', async () => {
    window.history.replaceState(null, '', '/score/lentes#consulta&lente=mercado');
    await montar('lentes');
    expect(abaDaLente('Mercado').getAttribute('aria-selected')).toBe('true');
    const antes = window.history.length;

    await userEvent.type(screen.getByRole('combobox'), 'fiscalizacao');
    const subtemas = screen.getByRole('group', { name: 'Consulta em profundidade · Subtema' });
    const [opcao] = Array.from(subtemas.querySelectorAll('[role="option"]'));
    await userEvent.click(opcao);

    await waitFor(() => expect(abaDaLente('Imprensa').getAttribute('aria-selected')).toBe('true'));
    expect(window.location.hash).toContain('subtema=fiscalizacao-regulatoria');
    expect(window.history.length).toBe(antes + 1);
    expect(botaoDoDrill()?.getAttribute('aria-expanded')).toBe('true');
    expect(vi.mocked(obterDossieDaLente)).toHaveBeenLastCalledWith('imprensa', '2026-08', {});
  });

  it('uma sugestão real de outra lente, já nas Lentes, leva o hash para a lente nova sem empilhar', async () => {
    window.history.replaceState(null, '', '/score/lentes#consulta&lente=imprensa&pilar=governanca');
    await montar('lentes');
    const antes = window.history.length;

    await userEvent.type(screen.getByRole('combobox'), 'Mercado');
    await userEvent.click(await screen.findByRole('option', { name: /^Lente\s*Mercado/ }));

    expect(abaDaLente('Mercado').getAttribute('aria-selected')).toBe('true');
    expect(window.location.pathname).toBe('/score/lentes');
    expect(window.location.hash).toBe('#consulta&lente=mercado');
    expect(window.history.length).toBe(antes);
  });

  it('escolher o nó em que a pessoa já está não empilha uma entrada igual', async () => {
    const destino =
      '#consulta&lente=imprensa&pilar=eficiencia-operacional&tema=abastecimento-agua&subtema=rompimento-adutora';
    window.history.replaceState(null, '', `/score/lentes${destino}`);
    await montar('lentes');
    const antes = window.history.length;

    await userEvent.type(screen.getByRole('combobox'), 'adutora');
    await userEvent.keyboard('{Enter}');

    expect(window.location.hash).toBe(destino);
    expect(window.history.length).toBe(antes);
  });
});
