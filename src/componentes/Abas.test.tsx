// @vitest-environment jsdom

/** A régua de abas: o `id` do DOM e a relação aba ↔ painel.
 *
 *  O QUE ESTA SUÍTE EXISTE PARA IMPEDIR: `aria-controls` e `aria-labelledby`
 *  são LISTAS de ids separadas por espaço. Uma aba cujo id tenha espaço —
 *  "N2 Temas estratégicos", o caso do painel de aprofundamento da Imprensa —
 *  produzia três referências, nenhuma existente. Com o mouse funciona; a
 *  relação quebra só para quem ouve a tela, e ninguém vê isso olhando.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Abas, idDeAba } from './Abas';

describe('idDeAba', () => {
  it('não deixa espaço no id, porque espaço separa referências de ARIA', () => {
    expect(idDeAba('painel', 'N2 Temas estratégicos')).not.toContain(' ');
  });

  it('mantém a letra acentuada, para dois rótulos não colidirem no mesmo id', () => {
    // `id` com Unicode é válido em HTML5. Trocar acento por `_` aproximaria
    // "Eficiência" de "Eficiencia".
    expect(idDeAba('painel', 'Eficiência')).toBe('painel-Eficiência');
  });

  it('é estável: o mesmo texto dá o mesmo id nas duas pontas', () => {
    expect(idDeAba('dentro', 'N3 Subtemas')).toBe(idDeAba('dentro', 'N3 Subtemas'));
  });

  it('não devolve id vazio para um rótulo só de pontuação', () => {
    expect(idDeAba('aba', '— —')).toBe('aba-_');
  });
});

describe('Abas', () => {
  const abas = [
    { id: 'N1 Atributo Reputacional', rotulo: 'N1 Atributo Reputacional' },
    { id: 'N2 Temas estratégicos', rotulo: 'N2 Temas estratégicos' },
  ] as const;

  it('o aria-controls aponta para UM id, e sem espaço', () => {
    render(
      <Abas
        abas={abas}
        ativa="N1 Atributo Reputacional"
        aoTrocar={vi.fn()}
        rotulo="Sub-dimensão"
        prefixo="dentro"
      />,
    );

    for (const aba of screen.getAllByRole('tab')) {
      const controla = aba.getAttribute('aria-controls') ?? '';
      expect(controla).not.toBe('');
      // UMA referência: `aria-controls` separa por espaço, então um espaço
      // aqui são duas referências e o painel inteiro deixa de ser resolvido.
      expect(controla.trim().split(/\s+/)).toHaveLength(1);
      expect(aba.id).not.toContain(' ');
    }
  });

  it('a aba e o painel se acham pelo mesmo id', () => {
    const titulo = 'N2 Temas estratégicos';
    render(
      <div>
        <Abas
          abas={abas}
          ativa={titulo}
          aoTrocar={vi.fn()}
          rotulo="Sub-dimensão"
          prefixo="dentro"
        />
        <div role="tabpanel" id={idDeAba('painel', titulo)} aria-labelledby={idDeAba('dentro', titulo)}>
          conteúdo
        </div>
      </div>,
    );

    const aba = screen.getByRole('tab', { selected: true });
    const painel = screen.getByRole('tabpanel');

    // RESOLVIDO COMO ARIA RESOLVE, e não com `getElementById` no atributo
    // inteiro. Esta é a correção de um teste meu que passava por motivo errado:
    // `getElementById("painel-N2 Temas estratégicos")` ACHA o elemento, porque
    // casa exato e tolera espaço — então o teste ficava verde com o defeito no
    // lugar. Um leitor de tela trata o atributo como LISTA de ids, e é a lista
    // que tem de resolver.
    const resolver = (elemento: Element, atributo: string) =>
      (elemento.getAttribute(atributo) ?? '')
        .trim()
        .split(/\s+/)
        .map((umId) => document.getElementById(umId));

    expect(resolver(aba, 'aria-controls')).toEqual([painel]);
    expect(resolver(painel, 'aria-labelledby')).toEqual([aba]);
  });
});
