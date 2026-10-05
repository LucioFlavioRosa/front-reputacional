// @vitest-environment jsdom

/** O cartão "Onde está a causa" — as abas que ligam a nota ao item.
 *
 *  O DONO DO PRODUTO FOI À TELA E NÃO ACHOU COMO DESCER OS TRÊS NÍVEIS. Havia a
 *  nota (nível 1), havia a lista de itens (nível 3) e, no meio, dois painéis:
 *  tema e concessionária. As outras seis dimensões que o pacote prioriza só
 *  existiam no seletor da barra de filtros — e a barra serve a quem JÁ SABE o
 *  que procurar. Quem abre a lente com a nota caída não sabe.
 *
 *  ESTE ARQUIVO TRAVA A NAVEGAÇÃO, que é o que faltava: trocar de aba para
 *  perguntar de outro jeito, e clicar numa barra para descer nela.
 */

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OndeEstaACausa } from '@/paginas/score/OndeEstaACausa';
import type { Bloco } from '@/dominio/dossie';

const FICHA = {
  origem: 'planilha' as const,
  fonte: 'Bites',
  colunas: [],
  lacunas: [],
  exemplo: false,
  conceitos: [],
};

function aba(titulo: string, recorta: string, dados: Bloco['dados']): Bloco {
  return {
    tipo: 'barras_100',
    subtipo: null,
    titulo,
    conclusao: null,
    dados,
    legenda: ['Positivo', 'Neutro', 'Negativo'],
    cores: [],
    colunas: [],
    recorta,
    ficha: FICHA,
  };
}

const ABAS: Bloco[] = [
  aba('Tema', 'tema', [
    { rotulo: 'Abastecimento', positivo: 1, neutro: 0, negativo: 2 },
    { rotulo: 'Obras', positivo: 3, neutro: 0, negativo: 0 },
  ]),
  aba('UF', 'uf', [
    { rotulo: 'RJ', positivo: 1, neutro: 0, negativo: 2 },
    { rotulo: 'SP', positivo: 3, neutro: 0, negativo: 0 },
  ]),
];

describe('OndeEstaACausa', () => {
  it('não desenha nada quando a lente não tem dimensão que explique', () => {
    /** CARTÃO VAZIO É PIOR QUE CARTÃO AUSENTE: a moldura de um cartão sem
     *  conteúdo se lê como dado que sumiu. Mercado e Institucional não vêm de
     *  menção, e o servidor manda lista vazia para elas. */
    const { container } = render(
      <OndeEstaACausa abas={[]} filtro={{}} definirFiltro={vi.fn()} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('mostra uma aba por dimensão, e só o corte da aba ativa', async () => {
    render(<OndeEstaACausa abas={ABAS} filtro={{}} definirFiltro={vi.fn()} />);

    expect(screen.getByRole('tab', { name: 'Tema' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'UF' })).toBeTruthy();
    //: A PRIMEIRA ABA É A QUE ABRE, e a ordem vem do servidor: é a ordem em que
    //: a lente se explica, não a de maior volume.
    expect(screen.getByText('Abastecimento')).toBeTruthy();
    expect(screen.queryByText('RJ')).toBeNull();

    await userEvent.click(screen.getByRole('tab', { name: 'UF' }));

    expect(screen.getByText('RJ')).toBeTruthy();
    expect(screen.queryByText('Abastecimento')).toBeNull();
  });

  it('clicar numa barra APLICA o recorte daquela dimensão', async () => {
    /** É O CLIQUE QUE FALTAVA. Quem vê "Abastecimento · 67% negativo" tenta
     *  clicar NELE — e até agora tinha de procurar o mesmo nome num campo
     *  suspenso. A dimensão vem do servidor (`bloco.recorta`), e não de um
     *  palpite pelo título da aba. */
    const definirFiltro = vi.fn();
    render(<OndeEstaACausa abas={ABAS} filtro={{}} definirFiltro={definirFiltro} />);

    await userEvent.click(screen.getByText('Abastecimento'));

    expect(definirFiltro).toHaveBeenCalledWith({ tema: 'Abastecimento' });
  });

  it('o recorte se EMPILHA com o que já estava ativo', async () => {
    /** É o nível 3 do pacote: "Abastecimento no Rio" tem de ser uma pergunta
     *  possível. Um clique que substituísse o filtro a tornaria impossível. */
    const definirFiltro = vi.fn();
    render(
      <OndeEstaACausa abas={ABAS} filtro={{ uf: 'RJ' }} definirFiltro={definirFiltro} />,
    );

    //: TROCA DE ABA PRIMEIRO, como a pessoa faz: com `uf=RJ` ativo o cartão abre
    //: na aba de UF (é onde o recorte está), e perguntar "e por tema?" dentro do
    //: Rio é exatamente o movimento de descer um nível.
    await userEvent.click(screen.getByRole('tab', { name: 'Tema' }));
    await userEvent.click(screen.getByText('Abastecimento'));

    expect(definirFiltro).toHaveBeenCalledWith({ uf: 'RJ', tema: 'Abastecimento' });
  });

  it('clicar de novo no que já está recortado DESMARCA', async () => {
    const definirFiltro = vi.fn();
    render(
      <OndeEstaACausa
        abas={ABAS}
        filtro={{ tema: 'Abastecimento' }}
        definirFiltro={definirFiltro}
      />,
    );

    await userEvent.click(screen.getByText('Abastecimento'));

    expect(definirFiltro).toHaveBeenCalledWith({ tema: undefined });
  });

  it('a aba abre na dimensão que já está recortada', () => {
    /** SEM ISTO O CARTÃO SE CONTRADIZ: com `?uf=RJ` vindo de um link, a tela
     *  mostraria o selo "recorte filtrado" no topo e abriria o cartão na aba de
     *  tema — quem chega pelo link não vê onde o recorte foi aplicado. */
    render(<OndeEstaACausa abas={ABAS} filtro={{ uf: 'RJ' }} definirFiltro={vi.fn()} />);

    expect(screen.getByRole('tab', { name: 'UF' }).getAttribute('aria-selected')).toBe('true');
  });

  it('a barra recortada fica marcada, e se chega pelo teclado', async () => {
    const definirFiltro = vi.fn();
    render(
      <OndeEstaACausa
        abas={ABAS}
        filtro={{ tema: 'Abastecimento' }}
        definirFiltro={definirFiltro}
      />,
    );

    const barra = screen.getByRole('button', { name: /Abastecimento/ });
    expect(barra.getAttribute('aria-pressed')).toBe('true');

    barra.focus();
    await userEvent.keyboard('{Enter}');

    expect(definirFiltro).toHaveBeenCalledWith({ tema: undefined });
  });
});
