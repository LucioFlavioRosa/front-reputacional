// @vitest-environment jsdom

/** O cartão "Onde está a causa" — as abas que ligam a nota ao item.
 *
 *  O DONO DO PRODUTO FOI À TELA E NÃO ACHOU COMO DESCER OS TRÊS NÍVEIS. Havia a
 *  nota (nível 1), havia a lista de itens (nível 3) e, no meio, dois painéis:
 *  tema e concessionária. As outras seis dimensões que o pacote prioriza só
 *  existiam no seletor da barra de filtros — e a barra serve a quem JÁ SABE o
 *  que procurar. Quem abre a lente com a nota caída não sabe.
 *
 *  E O CLIQUE APROFUNDA, NÃO FILTRA — segunda correção do mesmo dono, nas
 *  palavras dele: "ao clicar em um dado temos que abrir um modal com o deep
 *  diving, e não como é feito hoje". Filtrar a tela REFAZ o mês: a nota muda, os
 *  painéis se refazem, e quem clicou perde de vista o mês de onde saiu.
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
    coluna_do_link: null,
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
      <OndeEstaACausa abas={[]} filtro={{}} aoAprofundar={vi.fn()} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('mostra uma aba por dimensão, e só o corte da aba ativa', async () => {
    render(<OndeEstaACausa abas={ABAS} filtro={{}} aoAprofundar={vi.fn()} />);

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

  it('clicar numa barra APROFUNDA naquela dimensão', async () => {
    /** É O CLIQUE QUE FALTAVA, e ele ABRE em vez de filtrar. Quem vê
     *  "Abastecimento · 67% negativo" tenta clicar NELE — e o que tem de
     *  acontecer é o painel do pedaço, não a tela inteira virar outra. A
     *  dimensão vem do servidor (`bloco.recorta`), e não de um palpite pelo
     *  título da aba. */
    const aoAprofundar = vi.fn();
    render(<OndeEstaACausa abas={ABAS} filtro={{}} aoAprofundar={aoAprofundar} />);

    await userEvent.click(screen.getByText('Abastecimento'));

    expect(aoAprofundar).toHaveBeenCalledWith('tema', 'Abastecimento');
  });

  it('a aba abre na dimensão que já está recortada na tela', () => {
    /** SEM ISTO O CARTÃO SE CONTRADIZ: com `?uf=RJ` vindo de um link, a tela
     *  mostraria o selo "recorte filtrado" no topo e abriria o cartão na aba de
     *  tema — quem chega pelo link não vê onde o recorte foi aplicado. */
    render(<OndeEstaACausa abas={ABAS} filtro={{ uf: 'RJ' }} aoAprofundar={vi.fn()} />);

    expect(screen.getByRole('tab', { name: 'UF' }).getAttribute('aria-selected')).toBe('true');
  });

  it('a linha do recorte ativo fica marcada, e se alcança pelo teclado', async () => {
    /** MARCADA PELO FILTRO DA TELA, que continua existindo: a barra de filtros é
     *  o seletor de quem já sabe o que quer ver, e a marca aqui diz "esta linha
     *  é aquele recorte". O clique, ainda assim, aprofunda. */
    const aoAprofundar = vi.fn();
    render(
      <OndeEstaACausa
        abas={ABAS}
        filtro={{ tema: 'Abastecimento' }}
        aoAprofundar={aoAprofundar}
      />,
    );

    const barra = screen.getByRole('button', { name: /Abastecimento/ });
    expect(barra.getAttribute('aria-pressed')).toBe('true');

    barra.focus();
    await userEvent.keyboard('{Enter}');

    expect(aoAprofundar).toHaveBeenCalledWith('tema', 'Abastecimento');
  });

  it('a lista continua sendo LISTA, com o botão dentro de cada item', () => {
    /** ACHADO DE REVISÃO (baixa): `role="button"` posto no próprio `li` tira
     *  dele o papel de `listitem`, e quem ouve a tela perde a estrutura "lista
     *  com N itens" — justamente no gráfico em que a quantidade de linhas é
     *  parte da leitura. */
    render(<OndeEstaACausa abas={ABAS} filtro={{}} aoAprofundar={vi.fn()} />);

    const itens = screen.getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(itens[0].querySelector('button')).toBeTruthy();
  });

  it('a aba SEM DADO existe e diz por quê', () => {
    /** A FILEIRA DE ABAS É A MESMA EM TODO MÊS — decisão do dono do produto, depois
     *  de abrir junho pela Jornada e reparar que o tema não estava lá "como
     *  aparece nos demais meses". Até maio só a Approach entregava (tema em 97% a
     *  100% dos itens); em junho a Bites entra com 4.973 posts sem tema, e a aba
     *  sumia.
     *
     *  O PREÇO É A ABA VAZIA, e ela não pode ser um quadro em branco. */
    render(
      <OndeEstaACausa
        abas={[aba('Subtema', 'subtema', [])]}
        filtro={{}}
        aoAprofundar={vi.fn()}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Subtema' })).toBeTruthy();
    expect(screen.getByText('Nenhuma menção deste mês traz subtema.')).toBeTruthy();
  });

  it('o título do clique fala de APROFUNDAR, e não de filtrar', () => {
    /** A PALAVRA ENSINA O QUE VAI ACONTECER. Quem lê "filtrar" espera a tela
     *  mudar; aqui a tela de trás fica exatamente onde estava. */
    render(<OndeEstaACausa abas={ABAS} filtro={{}} aoAprofundar={vi.fn()} />);

    const barra = screen.getByRole('button', { name: /Abastecimento/ });
    expect(barra.getAttribute('title')).toBe('Aprofundar em Abastecimento');
  });
});
