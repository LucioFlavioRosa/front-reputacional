// @vitest-environment jsdom

import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import FIXTURE from '@/paginas/fixtures/arvore.json';
//: `?raw` é do Vite (como em `nginx.limites-do-proxy.test.ts`): o código da
//: página como texto, para a busca por literais da taxonomia.
import CODIGO_DA_PAGINA from '@/paginas/ArvoreDaTaxonomia.tsx?raw';
import CODIGO_DO_DOMINIO from '@/dominio/arvoreDaTaxonomia.ts?raw';

const obterArvoreDaTaxonomia = vi.fn(() => Promise.resolve(structuredClone(FIXTURE)));
vi.mock('@/api/cliente', () => ({
  obterArvoreDaTaxonomia: () => obterArvoreDaTaxonomia(),
}));

import { ArvoreDaTaxonomia } from '@/paginas/ArvoreDaTaxonomia';
import { catalogoMudou } from '@/dominio/sincronizacao';

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => {};
});
//: A URL BASE AQUI É `/taxonomia` DESDE 20/10/2026 — a árvore saiu do Score e
//: ganhou endereço próprio (ver `Inicio.tsx`). O estado que a tela lê/escreve
//: na URL é só a QUERY STRING (`lerEstado`/`escreverEstado`), então o caminho
//: em si não muda nada do que este arquivo testa — só precisa bater com a
//: rota de verdade.
beforeEach(() => window.history.replaceState(null, '', '/taxonomia'));
afterEach(cleanup);

describe('Árvore da taxonomia: a tela', () => {
  it('abre na visão por atributo com os totais do cadastro', async () => {
    render(<ArvoreDaTaxonomia />);
    await screen.findByRole('tab', { name: /Por atributo reputacional/ });
    const numeros = document.querySelector('.arv-numeros')!.textContent;
    expect(numeros).toBe('7pilares41temas104subtemas');
    expect(document.querySelectorAll('.arv-cartao')).toHaveLength(7);
  });

  it('o subtema abre a ficha, vai para a outra árvore e tudo fica na URL', async () => {
    render(<ArvoreDaTaxonomia />);
    await userEvent.click(await screen.findByRole('button', { name: 'Expandir tudo' }));
    const item = document.querySelector<HTMLElement>('.arv-sub-item')!;
    const id = item.dataset.subtema;
    await userEvent.click(item);
    const ficha = screen.getByRole('dialog');
    expect(window.location.search).toContain(`subtema=${id}`);
    await userEvent.click(within(ficha).getByRole('button', { name: /mapa de risco|sem risco/ }));
    expect(window.location.search).toContain('arvore=risco');
    expect(screen.getByRole('tab', { name: /Por risco corporativo/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
    // O mesmo subtema, aberto e marcado na árvore de risco.
    expect(document.querySelector(`.arv-sub-item[data-subtema="${id}"]`)?.getAttribute('aria-current')).toBe(
      'true',
    );
  });

  it('o filtro de cor tem seleção múltipla e vai para a URL', async () => {
    render(<ArvoreDaTaxonomia />);
    await screen.findByRole('tab', { name: /Por atributo reputacional/ });
    const filtros = document.querySelectorAll<HTMLButtonElement>('.arv-filtro');
    await userEvent.click(filtros[0]);
    await userEvent.click(filtros[1]);
    expect(new URLSearchParams(window.location.search).getAll('filtro')).toHaveLength(2);
    expect(screen.getByText(/de 104 subtemas em destaque/)).toBeTruthy();
  });
});

describe('Árvore da taxonomia: o cadastro muda, a página acompanha', () => {
  it('relê ao gravar no Cadastro de Temas e ao voltar para a aba', async () => {
    const renomeada = structuredClone(FIXTURE);
    renomeada.pilares[0].nome = 'Pilar renomeado no cadastro';
    render(<ArvoreDaTaxonomia />);
    await screen.findByRole('tab', { name: /Por atributo reputacional/ });
    const leiturasAoAbrir = obterArvoreDaTaxonomia.mock.calls.length;

    // GRAVAR NO CADASTRO (aba Temas, planilha de subtemas…) avisa o catálogo.
    obterArvoreDaTaxonomia.mockImplementationOnce(() => Promise.resolve(renomeada));
    act(() => catalogoMudou.avisar());
    expect(await screen.findByText(/Pilar renomeado no cadastro/)).toBeTruthy();

    // VOLTAR PARA A ABA relê também: pega o que outra pessoa mudou.
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(obterArvoreDaTaxonomia.mock.calls.length).toBe(leiturasAoAbrir + 2);
  });
});

describe('Árvore da taxonomia: nenhum literal no código', () => {
  it('o código da página não contém nome nenhum da taxonomia', () => {
    //: O CSS fica de fora: não tem texto de tela, e o vitest não o entrega cru.
    const arquivos = [CODIGO_DA_PAGINA, CODIGO_DO_DOMINIO];
    expect(arquivos.every((texto) => texto.length > 1000)).toBe(true);
    const nomes = [
      ...FIXTURE.pilares,
      ...FIXTURE.temas,
      ...FIXTURE.subtemas,
      ...FIXTURE.clusters,
      ...FIXTURE.riscos,
      ...FIXTURE.cores.flatMap((d) => [...d.valores, d.vazio]),
    ].map((item) => item.nome);
    const achados = nomes.filter((nome) => arquivos.some((texto) => texto.includes(nome)));
    expect(achados).toEqual([]);
  });
});
