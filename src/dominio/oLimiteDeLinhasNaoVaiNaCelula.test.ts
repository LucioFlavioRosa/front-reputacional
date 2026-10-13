/** NENHUM LIMITE DE LINHAS NO PRÓPRIO `<td>`.
 *
 *  POR QUE ESTE ARQUIVO EXISTE: este defeito chegou à tela, em produção.
 *
 *  `-webkit-line-clamp` só age com `display: -webkit-box`, e esse `display`
 *  num `<td>` SUBSTITUI o `display: table-cell` — a célula para de participar
 *  da grade da tabela. Com UMA célula só fora da grade o navegador ainda
 *  embrulha ela sozinha numa célula anônima, e a tabela parece inteira; foi
 *  por isso que a coluna Pauta das quatro tabelas de área do Painel conviveu
 *  meses com o estilo no `<td>` sem ninguém ver.
 *
 *  QUANDO A SEGUNDA CÉLULA ENTROU, quebrou: Instituição e Pauta, as duas fora
 *  da grade e vizinhas, foram embrulhadas numa célula anônima SÓ — a pauta
 *  passou a aparecer empilhada debaixo do nome, DENTRO da coluna de
 *  Instituição, e a coluna de Pauta ficou vazia. Quem olhava o quadro
 *  "Relações com Investidores" via instituição e pauta na mesma coluna.
 *
 *  O CONSERTO É SEMPRE O MESMO: o limite vai num EMBRULHO (`<span
 *  className="duas-linhas">`) dentro da célula, nunca na célula. É o que
 *  `ConsultasRecebidas` e `BaseDeDadosDoScore` já fazem, cada um com o
 *  comentário explicando — e o que nenhum teste cobria.
 *
 *  E NENHUM TESTE DE TELA PEGA ISSO: o jsdom não faz layout de tabela, então
 *  o `<td>` continua um `<td>` no DOM e a asserção passaria dos dois jeitos.
 *  O defeito só existe no navegador. Por isso a guarda é na FONTE, irmã de
 *  `oLimiteDeLinhasNaoEDesligado` — mesma família, outra metade da regra:
 *  aquela proíbe `display` em linha JUNTO da classe, esta proíbe o limite
 *  dentro da etiqueta `<td>`.
 */

import { describe, expect, it } from 'vitest';

const FONTES = import.meta.glob('@/**/*.tsx', {
  query: '?raw',
  eager: true,
  import: 'default',
}) as Record<string, string>;

/** O que denuncia um limite de linhas escrito em estilo de objeto. */
const MARCAS_DO_LIMITE = ['WebkitLineClamp', '-webkit-box'];

/** A etiqueta JSX de abertura que começa em `posicao`, até o `>` que a fecha.
 *
 *  CONTA CHAVES: um `<td>` costuma trazer `style={{ ... }}` e `onClick={() =>
 *  ...}`, e o `>` da seta não fecha etiqueta nenhuma. Parar no primeiro `>`
 *  cortaria a etiqueta no meio e deixaria o defeito passar. */
function etiquetaDeAbertura(fonte: string, posicao: number): string {
  let chaves = 0;
  for (let i = posicao; i < fonte.length; i += 1) {
    const c = fonte[i];
    if (c === '{') chaves += 1;
    else if (c === '}') chaves -= 1;
    else if (c === '>' && chaves === 0) return fonte.slice(posicao, i + 1);
  }
  return fonte.slice(posicao);
}

/** O objeto que abre na `{` de `posicao`, até a `}` que o fecha. */
function corpoDoObjeto(fonte: string, posicao: number): string {
  let chaves = 0;
  for (let i = posicao; i < fonte.length; i += 1) {
    if (fonte[i] === '{') chaves += 1;
    else if (fonte[i] === '}') {
      chaves -= 1;
      if (chaves === 0) return fonte.slice(posicao, i + 1);
    }
  }
  return fonte.slice(posicao);
}

/** Os nomes das constantes do arquivo cujo objeto carrega limite de linhas —
 *  o estilo quase nunca está escrito dentro da etiqueta, e sim espalhado dela
 *  (`style={{ ...TRUNCAR_EM_DUAS_LINHAS }}`). Sem resolver o nome, a guarda
 *  olharia para uma etiqueta limpa e aprovaria o defeito. */
function constantesComLimite(fonte: string): string[] {
  const nomes: string[] = [];
  const declaracao = /const\s+([A-Za-z0-9_$]+)\s*=\s*\{/g;
  let achado: RegExpExecArray | null;
  while ((achado = declaracao.exec(fonte))) {
    const corpo = corpoDoObjeto(fonte, achado.index + achado[0].length - 1);
    if (MARCAS_DO_LIMITE.some((marca) => corpo.includes(marca))) nomes.push(achado[1]);
  }
  return nomes;
}

describe('o limite de linhas não vai na célula da tabela', () => {
  it('nenhuma etiqueta `<td` carrega `-webkit-line-clamp`, nem direto nem por constante', () => {
    const culpados: string[] = [];

    for (const [caminho, fonte] of Object.entries(FONTES)) {
      const espalhadas = constantesComLimite(fonte).map((nome) => `...${nome}`);
      const proibidos = [...MARCAS_DO_LIMITE, ...espalhadas];

      let de = fonte.indexOf('<td');
      while (de >= 0) {
        const etiqueta = etiquetaDeAbertura(fonte, de);
        const achou = proibidos.find((proibido) => etiqueta.includes(proibido));
        if (achou) {
          culpados.push(`${caminho} — ${achou} em ${etiqueta.slice(0, 160).replace(/\s+/g, ' ')}`);
        }
        de = fonte.indexOf('<td', de + 1);
      }
    }

    expect(culpados).toEqual([]);
  });

  it('e a guarda sabe reconhecer o defeito que ela existe para pegar', () => {
    //: Uma guarda de fonte que nunca viu um positivo é uma guarda que pode ter
    //: parado de casar sem ninguém notar. Este é o código EXATO que foi para
    //: produção no quadro de Relações com Investidores.
    const defeito = [
      'const TRUNCAR_EM_DUAS_LINHAS = {',
      "  display: '-webkit-box' as const,",
      '  WebkitLineClamp: 2,',
      '};',
      '<td style={{ ...celulaAtual, ...TRUNCAR_EM_DUAS_LINHAS }} title={nome}>',
    ].join('\n');

    expect(constantesComLimite(defeito)).toContain('TRUNCAR_EM_DUAS_LINHAS');

    const etiqueta = etiquetaDeAbertura(defeito, defeito.indexOf('<td'));
    expect(etiqueta).toContain('...TRUNCAR_EM_DUAS_LINHAS');
    expect(etiqueta.endsWith('>')).toBe(true);
  });

  it('e está olhando para os arquivos de verdade', () => {
    const comCelula = Object.values(FONTES).filter((fonte) => fonte.includes('<td'));
    expect(Object.keys(FONTES).length).toBeGreaterThan(50);
    expect(comCelula.length).toBeGreaterThanOrEqual(5);
  });
});
