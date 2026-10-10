// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConsultaEmProfundidade } from './ConsultaEmProfundidade';
import { DADOS } from './dados/dados';
import { atenderPedidoDeFoco, navegarNoDrill } from './useEnderecoDoDrill';

vi.mock('@/observabilidade/telemetria', () => ({ registrarErro: vi.fn() }));

const IMPRENSA = DADOS.lentes.find((l) => l.id === 'imprensa')!;
const EFICIENCIA = IMPRENSA.pilares.find((p) => p.id === 'eficiencia-operacional')!;
const ABASTECIMENTO = EFICIENCIA.filhos!.find((t) => t.id === 'abastecimento-agua')!;
const ADUTORA = ABASTECIMENTO.filhos!.find((s) => s.id === 'rompimento-adutora')!;

const CAMINHO_DA_PAGINA = '/score/lentes';

function irPara(hash: string) {
  window.history.replaceState(null, '', CAMINHO_DA_PAGINA + hash);
}

/** O cartão (`.cartao`) que contém o elemento. */
function cartaoDe(el: HTMLElement): HTMLElement {
  const cartao = el.closest<HTMLElement>('.cartao');
  if (!cartao) throw new Error('fora de um cartão');
  return cartao;
}

/** O cartão da tabela de impacto do nível, achado pelo título. */
function tabelaComTitulo(titulo: string): HTMLElement {
  return cartaoDe(screen.getByRole('heading', { name: titulo }));
}

function linhasDaLista(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-item]')];
}

function textoDoRodapeDaConta(cartao: HTMLElement): string {
  return within(cartao).getByText('A conta fecha').closest('p')!.textContent ?? '';
}

let rolar: ReturnType<typeof vi.fn>;

beforeEach(() => {
  irPara('');
  // Nenhum pedido de foco de outro teste fica pendente.
  atenderPedidoDeFoco();
  rolar = vi.fn();
  window.scrollTo = rolar as unknown as typeof window.scrollTo;
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.style.removeProperty('--altura-cabecalho');
});

describe('ConsultaEmProfundidade · roteiro G (Imprensa)', () => {
  it('passos 1 a 9: desce até a matéria, filtra, abre a prévia, volta pela trilha e pelo navegador', async () => {
    const usuario = userEvent.setup();
    render(<ConsultaEmProfundidade lente="imprensa" />);

    // 1-2 · Nível 1, sem a nota da lente (D1) e com os cartões laterais.
    expect(screen.getByText(/Nível 1 de 4/)).toBeInTheDocument();
    const tabelaDePilares = tabelaComTitulo(IMPRENSA.tabelaPilares.titulo);
    expect(within(tabelaDePilares).getByRole('heading', { level: 2 })).toHaveAttribute('tabindex', '-1');
    expect(screen.queryByText('42')).toBeNull();
    expect(screen.queryByText(/nota 42/)).toBeNull();
    expect(screen.queryByText('A conta fecha')).toBeNull();
    expect(screen.queryByText('Leitura do mês')).toBeNull();
    expect(screen.getByText('Rompimento de adutora na Zona Norte do Rio')).toBeInTheDocument();
    // Abrir o bloco não escreve hash nem rola.
    expect(window.location.hash).toBe('');
    expect(rolar).not.toHaveBeenCalled();

    // 3 · Eficiência → Nível 2.
    const comprimentoAntes = window.history.length;
    await usuario.click(within(tabelaDePilares).getByRole('link', { name: EFICIENCIA.nome }));
    expect(window.location.hash).toBe('#consulta&lente=imprensa&pilar=eficiencia-operacional');
    expect(window.history.length).toBe(comprimentoAntes + 1);
    expect(screen.getByText(/Nível 2 de 4/)).toBeInTheDocument();
    const trilha = screen.getByRole('navigation', { name: 'Trilha da consulta' });
    expect(within(trilha).getAllByRole('listitem')).toHaveLength(2);
    const tituloDoPilar = screen.getByRole('heading', { level: 2, name: EFICIENCIA.nome });
    expect(tituloDoPilar).toHaveFocus();
    expect(rolar).toHaveBeenCalledTimes(1);
    const tabelaDeTemas = tabelaComTitulo(EFICIENCIA.nivel2!.tituloTabela);
    const linhaAbastecimento = within(tabelaDeTemas).getByRole('link', { name: /^Abastecimento de água/ });
    expect(linhaAbastecimento).toHaveAccessibleName('Abastecimento de água Em destaque');
    expect(textoDoRodapeDaConta(tabelaDeTemas)).toContain('= impacto do pilar −7,4 pt');
    expect(screen.getByText('Evolução mês a mês · Abastecimento de água')).toBeInTheDocument();
    expect(screen.getByText('Onde se concentra · Abastecimento de água em agosto')).toBeInTheDocument();

    // 4 · Abastecimento → Nível 3.
    await usuario.click(linhaAbastecimento);
    expect(window.location.hash).toBe(
      '#consulta&lente=imprensa&pilar=eficiencia-operacional&tema=abastecimento-agua',
    );
    expect(screen.getByText(/Nível 3 de 4/)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Rompimento de adutora responde por dois terços da perda do tema' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: ABASTECIMENTO.nome })).toHaveFocus();

    // 5 · "Ver as 96 matérias" → Nível 4 com as 11 matérias da amostra.
    await usuario.click(screen.getByRole('button', { name: 'Ver as 96 matérias' }));
    expect(window.location.hash).toBe(
      '#consulta&lente=imprensa&pilar=eficiencia-operacional&tema=abastecimento-agua&subtema=rompimento-adutora',
    );
    expect(screen.getByText(/Nível 4 de 4/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: ADUTORA.nome })).toHaveFocus();
    expect(linhasDaLista()).toHaveLength(11);
    expect(linhasDaLista()[0].textContent).toContain('Rompimento de adutora deixa 14 bairros');

    // 6 · Negativas + Data: 9 linhas, a primeira de 19/08 (Zero Hora), por
    // `replace` (a história não cresce) e sem rolar nem mover o foco.
    const comprimentoNoNivel4 = window.history.length;
    const rolagensAntes = rolar.mock.calls.length;
    await usuario.click(screen.getByRole('button', { name: 'Negativas 71' }));
    await usuario.click(screen.getByRole('button', { name: 'Data' }));
    expect(window.location.hash).toContain('&sent=negativas&ordem=data');
    expect(window.history.length).toBe(comprimentoNoNivel4);
    expect(rolar.mock.calls.length).toBe(rolagensAntes);
    expect(linhasDaLista()).toHaveLength(9);
    expect(linhasDaLista()[0].textContent).toContain('19/08');
    expect(linhasDaLista()[0].textContent).toContain('Zero Hora');

    // 7 · Abrir matéria → modal; Esc fecha e o foco volta ao botão.
    const botao = within(linhasDaLista()[0]).getByRole('button', { name: 'Abrir matéria' });
    const tituloDaMateria = linhasDaLista()[0].querySelector('[id]')!.textContent!;
    await usuario.click(botao);
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByRole('heading', { name: tituloDaMateria })).toBeInTheDocument();
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(botao).toHaveFocus();

    // 8 · Trilha "Imprensa" → Nível 1.
    const trilhaNoNivel4 = screen.getByRole('navigation', { name: 'Trilha da consulta' });
    await usuario.click(within(trilhaNoNivel4).getByRole('link', { name: 'Imprensa' }));
    expect(window.location.hash).toBe('#consulta&lente=imprensa');
    expect(screen.getByText(/Nível 1 de 4/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: IMPRENSA.tabelaPilares.titulo })).toHaveFocus();

    // 9 · Voltar do navegador → Nível 4 com Negativas e Data preservadas.
    await act(async () => {
      window.history.back();
    });
    await waitFor(() => expect(screen.getByText(/Nível 4 de 4/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Negativas 71' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Data' })).toHaveAttribute('aria-pressed', 'true');
    expect(linhasDaLista()).toHaveLength(9);
    // O ROTEIRO INTEIRO NUM TESTE SÓ passa dos 5s padrão na suíte cheia (o
    // jsdom divide a máquina com os outros arquivos): tempo próprio, como os
    // outros testes longos do repositório.
  }, 20_000);

  it('passo 17: endereço profundo direto abre o Nível 4 de Fiscalização regulatória com 7 linhas, sem rolar', () => {
    irPara('#consulta&lente=imprensa&pilar=governanca&tema=contratos-regulacao&subtema=fiscalizacao-regulatoria');
    const substituir = vi.spyOn(window.history, 'replaceState');
    render(<ConsultaEmProfundidade lente="imprensa" />);
    expect(screen.getByText(/Nível 4 de 4/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Fiscalização regulatória' })).toBeInTheDocument();
    expect(linhasDaLista()).toHaveLength(7);
    // Endereço já canônico: nada a corrigir, e o primeiro render não rola.
    expect(substituir).not.toHaveBeenCalled();
    expect(rolar).not.toHaveBeenCalled();
  });

  it('passo 18: pilar=xyz cai no Nível 1 e o endereço é corrigido com replaceState', () => {
    irPara('#consulta&lente=imprensa&pilar=xyz&tema=abc');
    const substituir = vi.spyOn(window.history, 'replaceState');
    const empilhar = vi.spyOn(window.history, 'pushState');
    render(<ConsultaEmProfundidade lente="imprensa" />);
    expect(screen.getByText(/Nível 1 de 4/)).toBeInTheDocument();
    expect(window.location.hash).toBe('#consulta&lente=imprensa');
    expect(substituir).toHaveBeenCalledTimes(1);
    expect(empilhar).not.toHaveBeenCalled();
    expect(rolar).not.toHaveBeenCalled();
  });

  it('filtro de outro nível é descartado do endereço (A20) sem laço de correção', () => {
    irPara('#consulta&lente=imprensa&pilar=governanca&sent=negativas&item=x');
    const substituir = vi.spyOn(window.history, 'replaceState');
    render(<ConsultaEmProfundidade lente="imprensa" />);
    expect(screen.getByText(/Nível 2 de 4/)).toBeInTheDocument();
    expect(window.location.hash).toBe('#consulta&lente=imprensa&pilar=governanca');
    expect(substituir).toHaveBeenCalledTimes(1);
  });

  it('com item no endereço não rola ao topo do bloco (a lista rola até a linha)', () => {
    render(<ConsultaEmProfundidade lente="imprensa" />);
    const item = ADUTORA.nivel4!.itens[3];
    act(() => {
      navegarNoDrill(
        {
          ativo: true,
          lente: 'imprensa',
          pilar: 'eficiencia-operacional',
          tema: 'abastecimento-agua',
          subtema: 'rompimento-adutora',
          item: item.id,
        },
        'push',
      );
    });
    expect(screen.getByText(/Nível 4 de 4/)).toBeInTheDocument();
    expect(document.querySelector(`[data-item="${item.id}"]`)).toHaveAttribute('aria-current', 'true');
    expect(rolar).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 2, name: ADUTORA.nome })).toHaveFocus();
  });

  it('a rolagem desconta o cabeçalho e a faixa de filtros fixos acima do bloco (A5)', async () => {
    document.documentElement.style.setProperty('--altura-cabecalho', '132px');
    const faixa = document.createElement('div');
    faixa.setAttribute('style', 'position: sticky; top: var(--altura-cabecalho)');
    faixa.getBoundingClientRect = () => ({ height: 54 }) as DOMRect;
    document.body.appendChild(faixa);
    try {
      const { container } = render(<ConsultaEmProfundidade lente="imprensa" />);
      const bloco = container.querySelector<HTMLElement>('[data-consulta-profundidade]')!;
      bloco.getBoundingClientRect = () => ({ top: 900, height: 2000 }) as DOMRect;
      const tabela = tabelaComTitulo(IMPRENSA.tabelaPilares.titulo);
      await userEvent.click(within(tabela).getByRole('link', { name: 'Governança' }));
      // 900 (topo do bloco) − 132 (cabeçalho) − 54 (faixa) − 12 (folga).
      expect(rolar).toHaveBeenCalledWith({ top: 702, behavior: 'auto' });
    } finally {
      faixa.remove();
    }
  });

  it('montar com pedido de foco da busca (A6) rola até o bloco e foca o título do nível', () => {
    navegarNoDrill(
      { ativo: true, lente: 'imprensa', pilar: 'governanca', tema: 'contratos-regulacao', subtema: 'fiscalizacao-regulatoria' },
      'replace',
      { focar: true },
    );
    render(<ConsultaEmProfundidade lente="imprensa" />);
    expect(rolar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { level: 2, name: 'Fiscalização regulatória' })).toHaveFocus();
  });

  it('trocar de lente sem pedido não rola; com o pedido da busca (Mercado → Imprensa), rola e foca', () => {
    irPara('#consulta&lente=mercado');
    const { rerender } = render(<ConsultaEmProfundidade lente="mercado" />);
    // HASH E PROP NO MESMO RENDER, como o Score faz (a lente sai do hash):
    // separados, a raiz veria um hash de outra lente e o corrigiria.
    const navegar = (lente: string, endereco: Parameters<typeof navegarNoDrill>[0], focar = false) =>
      act(() => {
        navegarNoDrill(endereco, focar ? 'push' : 'replace', { focar });
        rerender(<ConsultaEmProfundidade lente={lente} />);
      });
    // A aba da lente: sem pedido.
    navegar('imprensa', { ativo: true, lente: 'imprensa' });
    expect(rolar).not.toHaveBeenCalled();
    // A busca: do Mercado para um nível profundo da Imprensa.
    navegar('mercado', { ativo: true, lente: 'mercado' });
    navegar('imprensa', { ativo: true, lente: 'imprensa', pilar: 'governanca' }, true);
    expect(screen.getByText(/Nível 2 de 4/)).toBeInTheDocument();
    expect(rolar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { level: 2, name: 'Governança' })).toHaveFocus();
  });

  it('pedir de novo a tela que já está aberta também rola e foca', () => {
    irPara('#consulta&lente=imprensa&pilar=governanca');
    render(<ConsultaEmProfundidade lente="imprensa" />);
    expect(rolar).not.toHaveBeenCalled();
    act(() => navegarNoDrill({ ativo: true, lente: 'imprensa', pilar: 'governanca' }, 'replace', { focar: true }));
    expect(rolar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { level: 2, name: 'Governança' })).toHaveFocus();
  });

  it('restauração de rolagem manual enquanto o drill está montado, e a anterior volta ao desmontar', () => {
    window.history.scrollRestoration = 'auto';
    const { unmount } = render(<ConsultaEmProfundidade lente="imprensa" />);
    expect(window.history.scrollRestoration).toBe('manual');
    unmount();
    expect(window.history.scrollRestoration).toBe('auto');
  });

  it('voltar do navegador com a prévia aberta descarta a prévia', async () => {
    const usuario = userEvent.setup();
    irPara('#consulta&lente=imprensa');
    render(<ConsultaEmProfundidade lente="imprensa" />);
    await usuario.click(
      within(tabelaComTitulo(IMPRENSA.tabelaPilares.titulo)).getByRole('link', { name: EFICIENCIA.nome }),
    );
    expect(screen.getByText(/Nível 2 de 4/)).toBeInTheDocument();
    await act(async () => {
      window.history.back();
    });
    await waitFor(() => expect(screen.getByText(/Nível 1 de 4/)).toBeInTheDocument());
    await usuario.click(screen.getByRole('button', { name: 'Abrir matéria' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => {
      window.history.forward();
    });
    await waitFor(() => expect(screen.getByText(/Nível 2 de 4/)).toBeInTheDocument());
    expect(screen.queryByRole('dialog')).toBeNull();
    await act(async () => {
      window.history.back();
    });
    await waitFor(() => expect(screen.getByText(/Nível 1 de 4/)).toBeInTheDocument());
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ConsultaEmProfundidade · Mercado (D2: só o Nível 1)', () => {
  it('passo 19: pilar=governanca fica no Nível 1, a tabela não tem setas e o endereço é corrigido', () => {
    irPara('#consulta&lente=mercado&pilar=governanca');
    render(<ConsultaEmProfundidade lente="mercado" />);
    expect(screen.getByText(/Nível 1 de 4/)).toBeInTheDocument();
    expect(window.location.hash).toBe('#consulta&lente=mercado');
    const mercado = DADOS.lentes.find((l) => l.id === 'mercado')!;
    const tabela = tabelaComTitulo(mercado.tabelaPilares.titulo);
    expect(tabela.querySelector('[data-seta]')).toBeNull();
    expect(within(tabela).queryAllByRole('link')).toHaveLength(0);
    expect(tabela.querySelectorAll('[data-linha="fixa"]')).toHaveLength(mercado.pilares.length);
  });

  it('Nível 1 com os cartões "Temas financeiros" e "Sinais do mercado no mês"', () => {
    render(<ConsultaEmProfundidade lente="mercado" />);
    expect(screen.getByText('Temas financeiros')).toBeInTheDocument();
    expect(screen.getByText('Sinais do mercado no mês')).toBeInTheDocument();
    expect(screen.queryByText('A conta fecha')).toBeNull();
    expect(screen.queryByText(String(DADOS.lentes.find((l) => l.id === 'mercado')!.nota))).toBeNull();
  });
});
