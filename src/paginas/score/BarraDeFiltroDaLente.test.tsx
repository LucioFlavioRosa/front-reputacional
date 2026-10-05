// @vitest-environment jsdom

/** A barra de recorte da lente.
 *
 *  POR QUE ELA CRESCEU: a carga do padrão Aegea trouxe perfil do autor, UF,
 *  subtema e autor, e o servidor passou a aceitar recorte por qualquer uma delas
 *  — oito dimensões, contra as quatro de clipping que a barra tinha.
 *
 *  O QUE ESTE ARQUIVO TRAVA é o que a barra promete: só aparece o campo que a
 *  lente TEM no mês, os recortes se empilham em vez de se substituírem, e
 *  escolher de novo o que já está marcado desmarca.
 */

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BarraDeFiltroDaLente } from '@/paginas/score/BarraDeFiltroDaLente';
import type { OpcoesDeFiltroDaLente } from '@/api/cliente';

const DA_SOCIEDADE: OpcoesDeFiltroDaLente = {
  tiers: [],
  veiculos: ['Instagram', 'Facebook'],
  atributos: [],
  temas: ['Saneamento básico'],
  perfis: ['Cidadão', 'Figura pública'],
  ufs: ['RJ', 'SP'],
  subtemas: ['Falta de água'],
  autores: ['@vizinho'],
  empresas: ['Águas do Rio', 'Aegea Holding'],
};

const DA_IMPRENSA: OpcoesDeFiltroDaLente = {
  tiers: ['muito_relevante'],
  veiculos: ['Folha'],
  atributos: ['Qualidade'],
  temas: ['Tarifa'],
  perfis: [],
  ufs: [],
  subtemas: [],
  autores: [],
  empresas: [],
};

describe('BarraDeFiltroDaLente', () => {
  it('mostra as dimensões que a lente TEM, e esconde as que ela não tem', () => {
    /** CAMPO VAZIO É PIOR QUE CAMPO AUSENTE: um seletor que abre sem opção
     *  nenhuma faz a pessoa concluir que o dado sumiu, quando a verdade é que
     *  aquela fonte nunca mandou o campo. A Imprensa não tem perfil de autor. */
    render(
      <BarraDeFiltroDaLente filtro={{}} definirFiltro={vi.fn()} opcoes={DA_SOCIEDADE} />,
    );

    expect(screen.getByText('Perfil do autor')).toBeTruthy();
    expect(screen.getByText('UF')).toBeTruthy();
    expect(screen.getByText('Subtema')).toBeTruthy();
    expect(screen.getByText('Autor')).toBeTruthy();
    //: A Sociedade não tem tier nem atributo — os dois campos não aparecem.
    expect(screen.queryByText('Tier')).toBeNull();
    expect(screen.queryByText('Atributo')).toBeNull();
  });

  it('na Imprensa, as dimensões de clipping continuam lá', () => {
    render(
      <BarraDeFiltroDaLente filtro={{}} definirFiltro={vi.fn()} opcoes={DA_IMPRENSA} />,
    );

    expect(screen.getByText('Tier')).toBeTruthy();
    expect(screen.getByText('Atributo')).toBeTruthy();
    expect(screen.queryByText('Perfil do autor')).toBeNull();
  });

  it('escolher uma UF ACRESCENTA ao recorte, sem apagar o que já havia', async () => {
    /** É O EMPILHAMENTO do nível 3 do pacote: perfil E UF valem juntos. Uma barra
     *  que substituísse o filtro a cada escolha tornaria impossível perguntar
     *  "figuras públicas no Rio". */
    const definirFiltro = vi.fn();
    render(
      <BarraDeFiltroDaLente
        filtro={{ perfil_autor: 'Figura pública' }}
        definirFiltro={definirFiltro}
        opcoes={DA_SOCIEDADE}
      />,
    );

    await userEvent.click(screen.getByText('UF'));
    await userEvent.click(screen.getByText('RJ'));

    expect(definirFiltro).toHaveBeenCalledWith({ perfil_autor: 'Figura pública', uf: 'RJ' });
  });

  it('escolher de novo o que já está marcado DESMARCA', async () => {
    const definirFiltro = vi.fn();
    render(
      <BarraDeFiltroDaLente
        filtro={{ uf: 'RJ' }}
        definirFiltro={definirFiltro}
        opcoes={DA_SOCIEDADE}
      />,
    );

    //: COM VALOR ESCOLHIDO, o gatilho mostra "UF · 1" — o componente acrescenta
    //: a contagem ao rótulo. Por isso o matcher é por começo de texto, e não
    //: exato: um `getByText('UF')` aqui falharia por causa do sufixo.
    await userEvent.click(screen.getByText(/^UF/));
    await userEvent.click(screen.getByText('RJ'));

    expect(definirFiltro).toHaveBeenCalledWith({ uf: undefined });
  });

  it('o botão de limpar aparece quando QUALQUER dimensão está ativa', () => {
    const { rerender } = render(
      <BarraDeFiltroDaLente filtro={{}} definirFiltro={vi.fn()} opcoes={DA_SOCIEDADE} />,
    );
    expect(screen.queryByRole('button', { name: /limpar/i })).toBeNull();

    //: COM UMA DIMENSÃO NOVA, e não com uma das quatro antigas: o teste existe
    //: porque o "está ativo?" era uma lista escrita à mão, e uma lista assim
    //: esquece o campo que se acrescenta depois.
    rerender(
      <BarraDeFiltroDaLente
        filtro={{ subtema: 'Falta de água' }}
        definirFiltro={vi.fn()}
        opcoes={DA_SOCIEDADE}
      />,
    );
    expect(screen.getByRole('button', { name: /limpar/i })).toBeTruthy();
  });
});
