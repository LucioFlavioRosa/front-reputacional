/** O limite de linhas das colunas de texto longo.
 *
 *  POR QUE ESTE ARQUIVO EXISTE: a tabela da Base de dados tem vinte colunas com
 *  largura fixa, e duas delas recebem texto que não cabe. Medido na base de
 *  28.617 menções:
 *
 *    "Matéria / post" (380px, quebra linha)
 *        o título mais longo tem 2.169 caracteres — ~39 LINHAS numa célula
 *        7.234 menções (25%) passam de três linhas
 *          287 passam de seis
 *           43 passam de vinte
 *        uma célula de 39 linhas estica a linha inteira da tabela, e quem lê as
 *        outras dezenove colunas perde o alinhamento
 *
 *    "Veículo" (140px, UMA linha com reticências)
 *        cabiam ~20 caracteres, e 918 dos 3.729 veículos passam disso
 *        QUARENTA E DOIS veículos diferentes começam com "Prefeitura Municipal"
 *        nos vinte primeiros caracteres os 42 apareciam IDÊNTICOS na tela
 *        e as reticências estavam no pior lugar: o que distingue esses nomes é
 *        o FIM
 *
 *  O SEGUNDO É PERDA DE INFORMAÇÃO, não estética — é o que fez a decisão
 *  anterior ("o veículo é de uma linha só") ser revertida, com a medida escrita
 *  no teste que a afirmava.
 */

import { describe, expect, it } from 'vitest';

import { classeDasLinhasDaColuna, colunaQuebraLinha } from '@/dominio/baseDasLentes';

describe('o limite de linhas das colunas de texto longo', () => {
  it('a MATÉRIA para em três linhas, que é mais que a média dos títulos', () => {
    //: Três linhas em 380px mostram ~165 caracteres; a média da base é 131.
    //: Então a maioria dos títulos aparece inteira, e o resto tem o valor
    //: completo no `title` e o link para a matéria ao lado.
    expect(classeDasLinhasDaColuna('Matéria / post')).toBe('tres-linhas');
  });

  it('o VEÍCULO para em duas, que é onde "Prefeitura Municipal de X" se separa', () => {
    expect(classeDasLinhasDaColuna('Veículo')).toBe('duas-linhas');
    //: O RÓTULO MUDA POR LENTE: nas redes a coluna se chama "Rede"; nos canais
    //: próprios, "Canal". É a mesma coluna, e o limite tem de valer nos três.
    expect(classeDasLinhasDaColuna('Rede')).toBe('duas-linhas');
    expect(classeDasLinhasDaColuna('Canal')).toBe('duas-linhas');
  });

  it('e as colunas limitadas também QUEBRAM LINHA, senão o limite não faz nada', () => {
    //: `-webkit-line-clamp` só age sobre texto que quebra. Uma coluna limitada e
    //: com `white-space: nowrap` continuaria numa linha só — o limite seria
    //: decorativo, e o defeito voltaria inteiro.
    for (const rotulo of ['Matéria / post', 'Veículo', 'Rede', 'Canal']) {
      expect(colunaQuebraLinha(rotulo)).toBe(true);
    }
  });

  it('as colunas curtas NÃO são limitadas, porque elas já cabem', () => {
    //: Limitar o que cabe só acrescenta uma classe que não faz nada — e esconde
    //: de quem lê o código quais colunas têm o problema de verdade.
    expect(classeDasLinhasDaColuna('Data')).toBeUndefined();
    expect(classeDasLinhasDaColuna('Tier')).toBeUndefined();
    expect(classeDasLinhasDaColuna('UF')).toBeUndefined();
    //: O LINK TAMBÉM NÃO: ele não se lê, se clica — uma linha com reticências é
    //: o certo para ele, e é o que ele já tinha.
    expect(classeDasLinhasDaColuna('Link')).toBeUndefined();
    expect(colunaQuebraLinha('Link')).toBe(false);
  });
});
