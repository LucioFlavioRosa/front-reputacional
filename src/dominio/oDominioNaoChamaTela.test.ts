/** O domínio e o cliente da API não chamam tela. Medido a cada execução.
 *
 *  A DIREÇÃO QUE ESTE TESTE DEFENDE. `paginas/`, `componentes/` e `graficos/`
 *  leem de `dominio/` e de `api/`. O contrário é inversão: uma tela servindo de
 *  biblioteca para a regra, o que significa que a regra deixou de poder ser
 *  lida (e testada) sem a tela.
 *
 *  POR QUE VALOR E TIPO SÃO TRATADOS DIFERENTE, e não é frouxidão. `import type`
 *  não existe depois da compilação: não cria dependência de execução, não cria
 *  ciclo em runtime e não arrasta código para o bundle. Importar uma FUNÇÃO de
 *  dentro de uma pasta de tela é outra coisa — é a regra passando a depender do
 *  que a tela faz. Então:
 *
 *    * import de VALOR de `paginas`/`componentes`/`graficos`: recusado, sem
 *      exceção. Hoje são ZERO;
 *    * import de TIPO: permitido só para as entradas nomeadas abaixo, uma por
 *      uma, com o motivo.
 *
 *  A LISTA É TETO, NÃO PISO: uma entrada nova falha, e uma que deixou de
 *  acontecer também falha — senão a lista vira cemitério e deixa de dizer qual
 *  é a dívida de hoje.
 */

import { describe, expect, it } from 'vitest';

/** O fonte de `src/dominio/` e `src/api/`, sem os testes. */
const FONTES = import.meta.glob(
  ['/src/dominio/**/*.ts', '/src/api/**/*.ts', '!/src/**/*.test.ts'],
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>;

/** As pastas de apresentação: o que o domínio não pode chamar. */
const TELA = ['paginas', 'componentes', 'graficos'] as const;

/** `import ... from '@/pasta/...'` e `export ... from '@/pasta/...'`.
 *
 *  O grupo `tipo` casa o `type` de `import type {...}`. A forma embutida
 *  (`import { type X }`) NÃO é reconhecida como tipo aqui de propósito: ela
 *  seria contada como valor e falharia, o que é o lado seguro do erro — pede
 *  que se escreva `import type`, que é a forma que o resto do projeto usa.
 */
//:
//: O `alvo` captura o caminho INTEIRO, e não só a pasta: a primeira versão
//: parava no nome da pasta, e como `m[0]` termina onde a captura termina, o
//: alvo saía como `@/paginas` em vez de `@/paginas/score/...`. A dívida
//: registrada nunca casava com o que a varredura achava, e os dois lados do
//: teto falhavam ao mesmo tempo — que foi o sintoma que entregou o erro.
const DE_FORA =
  /^[ \t]*(?:import|export)[ \t]+(?<tipo>type[ \t]+)?[^;]*?from[ \t]*['"](?<alvo>@\/(?<pasta>[^/'"]+)[^'"]*)/gm;

type Achado = { arquivo: string; linha: number; pasta: string; tipo: boolean; alvo: string };

function achados(): Achado[] {
  const saida: Achado[] = [];
  for (const [caminho, fonte] of Object.entries(FONTES)) {
    for (const m of fonte.matchAll(DE_FORA)) {
      const pasta = m.groups!.pasta;
      if (!TELA.includes(pasta as (typeof TELA)[number])) continue;
      const alvo = m.groups!.alvo;
      saida.push({
        arquivo: caminho.replace('/src/', ''),
        linha: fonte.slice(0, m.index).split('\n').length,
        pasta,
        tipo: Boolean(m.groups!.tipo),
        alvo,
      });
    }
  }
  return saida;
}

/** A DÍVIDA CONHECIDA: import de TIPO de dentro de uma pasta de tela.
 *
 *  Chave `arquivo -> alvo`, e o valor é o motivo de ainda estar aqui. Nenhuma
 *  destas é import de valor; nenhuma existe em runtime.
 */
const TIPOS_CONHECIDOS: Record<string, string> = {
  "dominio/buscaDoRadar.ts -> @/paginas/score/consulta/dados/seletores":
    'ResultadoDeBusca carrega um EnderecoDoDrill — endereço de navegação da ' +
    'Consulta. Trazê-lo para o domínio arrasta a cadeia, e resolver de verdade ' +
    'é decidir se o endereço do drill é vocabulário de domínio: decisão de ' +
    'estrutura, não troca de import.',
  "api/score.ts -> @/paginas/score/consulta/dados/tipos":
    'É o tipo da resposta de GET /api/score/lentes/{id}/consulta, 185 linhas ' +
    'de vocabulário da própria tela (No, Item, Pilar, CartaoLateral...) com 28 ' +
    'importadores dentro dela. Levá-las para src/dominio/, que é plano e já ' +
    'está perto do limiar de 40 arquivos, tornaria o domínio MENOS navegável — ' +
    'o oposto do objetivo. Ver docs/ESTRUTURA_E_EXPANSAO.md §4.4 (back).',
};

const chave = (a: Achado) => `${a.arquivo} -> ${a.alvo}`;

describe('o domínio e o cliente da API não chamam tela', () => {
  it('a varredura está lendo os arquivos de verdade', () => {
    /* SEM ESTE CASO os três seguintes passam por vazio e a garantia é falsa
       sem ninguém notar — o glob quebra silenciosamente se a pasta mudar. */
    const nomes = Object.keys(FONTES);
    expect(nomes.length).toBeGreaterThan(40);
    expect(nomes).toContain('/src/dominio/buscaDoRadar.ts');
    expect(nomes).toContain('/src/api/score.ts');
    expect(nomes.filter((n) => n.includes('.test.'))).toEqual([]);
  });

  it('nenhum import de VALOR de paginas, componentes ou graficos', () => {
    const valores = achados()
      .filter((a) => !a.tipo)
      .map((a) => `${a.arquivo}:${a.linha} -> ${a.alvo}`);
    expect(valores).toEqual([]);
  });

  it('nenhum import de TIPO fora da dívida registrada', () => {
    const novos = achados()
      .filter((a) => a.tipo && !(chave(a) in TIPOS_CONHECIDOS))
      .map((a) => `${a.arquivo}:${a.linha} -> ${a.alvo}`);
    expect(novos).toEqual([]);
  });

  it('toda dívida registrada ainda existe', () => {
    /* O outro lado do teto: uma entrada que foi paga sai da lista. */
    const vivas = new Set(achados().filter((a) => a.tipo).map(chave));
    const mortas = Object.keys(TIPOS_CONHECIDOS).filter((k) => !vivas.has(k));
    expect(mortas).toEqual([]);
  });
});
