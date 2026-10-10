/** NENHUM `display` EM LINHA NUM ELEMENTO COM LIMITE DE LINHAS.
 *
 *  POR QUE ESTE ARQUIVO EXISTE: este defeito já aconteceu, e passou por uma
 *  revisão inteira sem ser visto.
 *
 *  O embrulho do título da Base de dados tinha `style={{ display: 'block' }}`
 *  junto da classe `tres-linhas`. Estilo em linha vence classe, então aquele
 *  `display` desligava o `display: -webkit-box` de que o `-webkit-line-clamp`
 *  depende — e o limite de três linhas NÃO AGIA. A célula de 2.169 caracteres
 *  (~39 linhas em 380px) continuava esticando a linha inteira da tabela, com a
 *  classe certa, no elemento certo, e nada no código denunciando.
 *
 *  E NENHUM TESTE DE TELA PEGA ISSO FORA DA TELA QUE ELE RENDERIZA: o jsdom não
 *  carrega a folha de estilo, então o conflito só existe no navegador. O teste
 *  da Base de dados cobre a Base de dados; esta guarda cobre o front todo, que é
 *  onde a regra vale.
 *
 *  O `display` dessas duas classes vem SÓ do `index.css`, e o CSS gerado por
 *  `npm run build` preserva o valor (conferido):
 *
 *    .tres-linhas,.duas-linhas{-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden}
 */

import { describe, expect, it } from 'vitest';

const FONTES = import.meta.glob('@/**/*.tsx', {
  query: '?raw',
  eager: true,
  import: 'default',
}) as Record<string, string>;

/** As marcas de que o elemento carrega limite de linhas. A terceira é a função
 *  que devolve a classe por rótulo de coluna — onde o defeito estava. */
const MARCAS = ['tres-linhas', 'duas-linhas', 'classeDasLinhasDaColuna'];

/** A etiqueta JSX de abertura em volta de uma posição: do `<` anterior ao `>`
 *  seguinte. É o recorte certo porque `display` só briga com a classe quando os
 *  dois estão NO MESMO elemento. */
function etiquetaEmVolta(fonte: string, posicao: number): string {
  const abre = fonte.lastIndexOf('<', posicao);
  const fecha = fonte.indexOf('>', posicao);
  if (abre < 0 || fecha < 0) return '';
  return fonte.slice(abre, fecha + 1);
}

describe('o limite de linhas não é desligado por estilo em linha', () => {
  it('nenhum elemento com `tres-linhas`/`duas-linhas` declara `display` em linha', () => {
    const culpados: string[] = [];

    for (const [caminho, fonte] of Object.entries(FONTES)) {
      //: O próprio comentário desta regra cita as classes; só interessa o que
      //: está dentro de uma etiqueta JSX.
      for (const marca of MARCAS) {
        let de = fonte.indexOf(marca);
        while (de >= 0) {
          const etiqueta = etiquetaEmVolta(fonte, de);
          if (etiqueta.includes('className') && /\bdisplay\s*:/.test(etiqueta)) {
            culpados.push(`${caminho} — ${etiqueta.slice(0, 160).replace(/\s+/g, ' ')}`);
          }
          de = fonte.indexOf(marca, de + 1);
        }
      }
    }

    expect(culpados).toEqual([]);
  });

  it('e a guarda está olhando para algum arquivo de verdade', () => {
    //: Sem isto, um glob que deixasse de casar faria a guarda passar vazia para
    //: sempre — e ela é o único lugar que vê este defeito.
    const comLimite = Object.entries(FONTES).filter(([, fonte]) =>
      MARCAS.some((marca) => fonte.includes(marca)),
    );
    expect(Object.keys(FONTES).length).toBeGreaterThan(50);
    expect(comLimite.length).toBeGreaterThanOrEqual(3);
  });
});
