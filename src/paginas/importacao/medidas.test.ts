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

  it('a prosa é a coluna mais larga de todas', () => {
    const prosa = medidaDaColuna('prosa');

    for (const outro of ['marca', 'data', 'sigla', 'lista', 'texto']) {
      expect(prosa.largura).toBeGreaterThan(medidaDaColuna(outro).largura);
    }
  });

  it('só o campo aberto quebra o texto — o resto vive numa linha', () => {
    /** DECISÃO DO DONO DO PRODUTO: "campo aberto deve ter uma largura máxima e depois o
     *  texto ir quebrando, para que possamos ler tudo". Antes nada quebrava, e o relato
     *  inteiro existia só no hover — passar o mouse em 54 linhas para ler o relato de
     *  cada uma não é ler.
     *
     *  A QUEBRA É SÓ DELE. Uma sigla ou uma data em duas linhas seria ruído: têm
     *  tamanho conhecido, e a coluna já cabe. E a altura da linha continua a MESMA em
     *  toda a grade — a quebra tem teto de duas linhas, não altura livre. */
    expect(medidaDaColuna('prosa').quebra).toBe(true);

    for (const tipo of ['marca', 'data', 'sigla', 'lista', 'texto']) {
      expect(medidaDaColuna(tipo).quebra).toBeFalsy();
    }
  });

  it('a coluna cabe o conteúdo dela, campo de edição incluído', () => {
    /** O OUTRO PEDIDO DO MESMO RELATO: "a largura das colunas deve ser compatível com o
     *  conteúdo para que seja possível ler". A largura tem de caber o CAMPO e não só o
     *  texto — a Data guarda dez caracteres, mas em edição mostra `dd/mm/aaaa` dentro de
     *  um campo com borda e recheio, e era aí que ela ficava apertada. */
    expect(medidaDaColuna('data').largura).toBeGreaterThanOrEqual(120);
    expect(medidaDaColuna('sigla').largura).toBeGreaterThanOrEqual(72);
    // "Prefeitura Municipal de Campinas" tem 32 caracteres: ~7px por caractere.
    expect(medidaDaColuna('lista').largura).toBeGreaterThanOrEqual(224);
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
