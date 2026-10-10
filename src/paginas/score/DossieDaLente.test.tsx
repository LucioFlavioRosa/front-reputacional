// @vitest-environment jsdom

/** O bloco "Drill down" da aba Lentes: só na Imprensa e no Mercado (decisão
 *  D2) e abre sozinho quando o endereço desce no drill (decisão A6). A raiz
 *  do drill é substituída por um marcador: aqui só importa ONDE e QUANDO ela
 *  é montada. */

import { act, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/cliente', () => ({
  // O dossiê não chega: a Síntese fica carregando, e o teste não depende dela.
  obterDossieDaLente: vi.fn(() => new Promise(() => {})),
  obterOpcoesDeFiltroDaLente: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('@/paginas/score/PainelDaJornada', () => ({
  PainelDaJornada: ({ titulo }: { titulo: string }) => <p>{titulo}</p>,
}));

vi.mock('@/paginas/score/consulta/ConsultaEmProfundidade', () => ({
  ConsultaEmProfundidade: ({ lente }: { lente: string }) => <p>raiz do drill: {lente}</p>,
}));

import { DossieDaLente } from '@/paginas/score/DossieDaLente';
import { navegarNoDrill } from '@/paginas/score/consulta/useEnderecoDoDrill';

function montar(lente: string) {
  return render(
    <DossieDaLente
      mes="2026-08"
      lente={lente}
      aoTrocarLente={vi.fn()}
      serie={[]}
      aoTrocarMes={vi.fn()}
      filtro={{}}
      definirFiltro={vi.fn()}
    />,
  );
}

const botaoDoDrill = () => screen.queryByRole('button', { name: /Drill down/ });

beforeEach(() => {
  window.history.replaceState(null, '', '/score/lentes');
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('DossieDaLente · bloco Drill down', () => {
  it.each(['imprensa', 'mercado'])('aparece na lente %s, fechado e sem montar a raiz', (lente) => {
    montar(lente);
    expect(botaoDoDrill()).toBeTruthy();
    expect(botaoDoDrill()?.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(/raiz do drill/)).toBeNull();
  });

  it.each(['sociedade', 'clientes', 'institucional'])('não aparece na lente %s (D2)', (lente) => {
    montar(lente);
    expect(botaoDoDrill()).toBeNull();
    // A Síntese executiva continua.
    expect(screen.getByRole('button', { name: /Síntese executiva/ })).toBeTruthy();
  });

  it('abrir monta a raiz com a lente da aba', async () => {
    montar('mercado');
    await userEvent.click(botaoDoDrill()!);
    expect(screen.getByText('raiz do drill: mercado')).toBeTruthy();
  });

  it('abre sozinho ao montar com o endereço num nível abaixo do primeiro', () => {
    window.history.replaceState(null, '', '/score/lentes#consulta&lente=imprensa&pilar=governanca');
    montar('imprensa');
    expect(botaoDoDrill()?.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('raiz do drill: imprensa')).toBeTruthy();
  });

  it('não abre sozinho com o endereço no Nível 1', () => {
    window.history.replaceState(null, '', '/score/lentes#consulta&lente=imprensa');
    montar('imprensa');
    expect(botaoDoDrill()?.getAttribute('aria-expanded')).toBe('false');
  });

  it('fechar à mão vale; uma navegação para um nível profundo reabre; subir ao Nível 1 não fecha', async () => {
    window.history.replaceState(null, '', '/score/lentes#consulta&lente=imprensa&pilar=governanca');
    montar('imprensa');

    await userEvent.click(botaoDoDrill()!);
    expect(botaoDoDrill()?.getAttribute('aria-expanded')).toBe('false');

    // A busca do cabeçalho leva a um subtema.
    act(() =>
      navegarNoDrill(
        { ativo: true, lente: 'imprensa', pilar: 'eficiencia-operacional', tema: 'abastecimento-agua' },
        'push',
      ),
    );
    expect(botaoDoDrill()?.getAttribute('aria-expanded')).toBe('true');

    // A trilha leva de volta ao Nível 1: o bloco continua aberto.
    act(() => navegarNoDrill({ ativo: true, lente: 'imprensa' }, 'push'));
    expect(botaoDoDrill()?.getAttribute('aria-expanded')).toBe('true');
  });

  it('voltar do navegador para um nível profundo reabre o bloco fechado', async () => {
    window.history.replaceState(null, '', '/score/lentes#consulta&lente=imprensa');
    montar('imprensa');
    expect(botaoDoDrill()?.getAttribute('aria-expanded')).toBe('false');

    act(() => {
      window.history.replaceState(null, '', '/score/lentes#consulta&lente=imprensa&pilar=governanca');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(botaoDoDrill()?.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('DossieDaLente · título da Jornada', () => {
  it.each([
    ['imprensa', 'Jornada da Imprensa'],
    ['mercado', 'Jornada do Mercado'],
    ['sociedade', 'Jornada da Sociedade digital'],
    ['clientes', 'Jornada dos Clientes'],
    ['institucional', 'Jornada do Institucional'],
  ])('na lente %s, o título concorda com o nome: %s', (lente, titulo) => {
    montar(lente);
    expect(screen.getByText(titulo)).toBeTruthy();
  });
});
