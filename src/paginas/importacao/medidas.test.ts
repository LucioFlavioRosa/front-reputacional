/** A largura e o alinhamento de cada coluna vêm do TIPO do dado.
 *
 *  O PEDIDO: "divisão de células para ter alinhamento e espaço adequados para cada
 *  coluna". Com 22 colunas, uma largura chutada em uma vira rolagem horizontal em
 *  todas.
 */

import { describe, expect, it } from 'vitest';

import { larguraTotal, medidaDaColuna } from '@/paginas/importacao/medidas';

describe('medidaDaColuna', () => {
  it('a sigla do estado é a mais estreita — são duas letras', () => {
    const sigla = medidaDaColuna('sigla');
    const lista = medidaDaColuna('lista');

    expect(sigla.largura).toBeLessThan(lista.largura);
    // Centralizada: numa coluna de 64px, o texto à esquerda briga com a borda.
    expect(sigla.alinhamento).toBe('center');
  });

  it('a prosa é a mais larga, e é a única que quebra em várias linhas', () => {
    const prosa = medidaDaColuna('prosa');

    expect(prosa.quebra).toBe(true);
    for (const outro of ['marca', 'data', 'sigla', 'lista', 'texto']) {
      expect(medidaDaColuna(outro).quebra).toBe(false);
      expect(prosa.largura).toBeGreaterThan(medidaDaColuna(outro).largura);
    }
  });

  it('a data é centralizada e tem largura fixa — são sempre dez caracteres', () => {
    expect(medidaDaColuna('data').alinhamento).toBe('center');
  });

  it('nome e frase ficam à esquerda, onde o olho começa', () => {
    expect(medidaDaColuna('lista').alinhamento).toBe('left');
    expect(medidaDaColuna('texto').alinhamento).toBe('left');
    expect(medidaDaColuna('prosa').alinhamento).toBe('left');
  });

  it('um tipo que a tela não conhece recebe a medida de texto', () => {
    // UMA COLUNA NOVA APARECE LEGÍVEL, e não invisível nem gigante: o servidor pode
    // ganhar um tipo antes de a tela saber dele.
    expect(medidaDaColuna('tipo-que-ainda-nao-existe')).toEqual(medidaDaColuna('texto'));
  });
});

describe('larguraTotal', () => {
  it('soma as colunas para a grade saber se precisa rolar', () => {
    const total = larguraTotal(['sigla', 'data']);

    expect(total).toBe(medidaDaColuna('sigla').largura + medidaDaColuna('data').largura);
  });

  it('sem colunas, zero', () => {
    expect(larguraTotal([])).toBe(0);
  });
});
