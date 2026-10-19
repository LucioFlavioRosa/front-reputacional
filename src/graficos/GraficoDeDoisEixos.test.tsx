// @vitest-environment jsdom

/** O gráfico de dois eixos: o que o traçado AFIRMA sobre o dado.
 *
 *  Um gráfico não quebra quando está errado — ele desenha. Por isso os testes
 *  aqui olham o `d` dos caminhos SVG em vez de só verificar que o componente
 *  montou: é no caminho que mora a afirmação "houve preço neste dia", "o índice
 *  valeu isto neste mês", "aqui não houve medida".
 *
 *  AS TRÊS AFIRMAÇÕES QUE PODEM MENTIR:
 *
 *  1. ligar dois pregões separados por meses desenha um preço que não existiu
 *     — é o papel que ainda não tinha sido emitido;
 *  2. esticar o degrau do índice por um mês sem medida desenha índice que não
 *     foi medido, indistinguível de medida real;
 *  3. a régua da direita mudar com o período faz a coincidência entre as duas
 *     curvas virar artefato do recorte — dá para "criar" correlação escolhendo
 *     os limites.
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GraficoDeDoisEixos } from './GraficoDeDoisEixos';

//: O `ResizeObserver` não existe no jsdom, e sem ele a largura fica em zero e
//: o SVG nem é renderizado. O dublê responde uma largura fixa, que é o que
//: torna as coordenadas do caminho previsíveis.
//: SEM PROPRIEDADE NO CONSTRUTOR: o projeto compila com `erasableSyntaxOnly`,
//: que proíbe `constructor(private x)` — é sintaxe que o TypeScript EXECUTA, e
//: não só apaga. O campo é declarado à parte.
class ObservadorFalso {
  chamar: ResizeObserverCallback;

  constructor(chamar: ResizeObserverCallback) {
    this.chamar = chamar;
  }

  observe() {
    this.chamar(
      [{ contentRect: { width: 800, height: 320 } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }

  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ObservadorFalso);

import { vi } from 'vitest';

function caminhos(container: HTMLElement): string[] {
  return [...container.querySelectorAll('path')].map((p) => p.getAttribute('d') ?? '');
}

const AZUL = '#0027BD';

describe('a linha do bond', () => {
  it('liga pregões vizinhos e QUEBRA num vão grande', () => {
    /** O papel emitido no meio do período.
     *
     *  Sem a quebra, uma reta atravessaria os meses em que ele não existia —
     *  desenhando cotação para dias em que não havia papel. É o caso real do
     *  `AEGEBZ36`, que só passa a ter valor em 25/09/2025. */
    const { container } = render(
      <GraficoDeDoisEixos
        rotuloDaEsquerda="Preço (% do par)"
        indice={[]}
        bonds={[
          {
            chave: 'A',
            rotulo: 'A',
            cor: AZUL,
            pontos: [
              { data: '2026-01-05', valor: 95 },
              { data: '2026-01-06', valor: 96 },
              { data: '2026-06-01', valor: 97 },
            ],
          },
        ]}
      />,
    );

    const doBond = caminhos(container).find((d) => d.startsWith('M'));
    //: DOIS `M` = dois pedaços. Um só significaria a reta atravessando.
    expect((doBond?.match(/M /g) ?? []).length).toBe(2);
  });

  it('fim de semana NÃO quebra a linha', () => {
    /** O controle negativo da regra acima: quebrar em todo intervalo picaria a
     *  linha em 52 pedaços por ano, e aí o vão deixaria de significar algo. */
    const { container } = render(
      <GraficoDeDoisEixos
        rotuloDaEsquerda="Preço (% do par)"
        indice={[]}
        bonds={[
          {
            chave: 'A',
            rotulo: 'A',
            cor: AZUL,
            pontos: [
              { data: '2026-01-02', valor: 95 },
              { data: '2026-01-05', valor: 96 },
            ],
          },
        ]}
      />,
    );

    const doBond = caminhos(container).find((d) => d.startsWith('M'));
    expect((doBond?.match(/M /g) ?? []).length).toBe(1);
  });
});

describe('o degrau do índice', () => {
  it('NÃO estica por um mês sem medida', () => {
    /** Janeiro e março medidos, fevereiro sem dado.
     *
     *  "Até o próximo ponto" esticaria janeiro por fevereiro inteiro: índice
     *  desenhado para um mês que não foi medido, indistinguível de medida
     *  real. O degrau termina no fim de janeiro e o de março começa do zero. */
    const { container } = render(
      <GraficoDeDoisEixos
        rotuloDaEsquerda="Preço (% do par)"
        bonds={[]}
        indice={[
          { mes: '2026-01-01', valor: 50 },
          { mes: '2026-03-01', valor: 60 },
        ]}
      />,
    );

    const doIndice = caminhos(container).find((d) => d.includes('M'));
    //: DOIS `M` = dois degraus soltos, com o vão de fevereiro entre eles.
    expect((doIndice?.match(/M /g) ?? []).length).toBe(2);
  });

  it('meses CONSECUTIVOS emendam, formando o degrau', () => {
    /** A emenda vertical é o que faz disto um degrau em vez de traços soltos:
     *  ela mostra o salto de um mês para o outro, que é a grandeza medida. */
    const { container } = render(
      <GraficoDeDoisEixos
        rotuloDaEsquerda="Preço (% do par)"
        bonds={[]}
        indice={[
          { mes: '2026-01-01', valor: 50 },
          { mes: '2026-02-01', valor: 60 },
        ]}
      />,
    );

    const doIndice = caminhos(container).find((d) => d.includes('M'));
    expect((doIndice?.match(/M /g) ?? []).length).toBe(1);
  });

  it('o mês sem valor é descartado, e não desenhado como zero', () => {
    const { container } = render(
      <GraficoDeDoisEixos
        rotuloDaEsquerda="Preço (% do par)"
        bonds={[]}
        indice={[
          { mes: '2026-01-01', valor: 50 },
          { mes: '2026-02-01', valor: null },
        ]}
      />,
    );

    const doIndice = caminhos(container).find((d) => d.includes('M'));
    expect((doIndice?.match(/M /g) ?? []).length).toBe(1);
  });

  it('a virada do ano funciona', () => {
    /** Dezembro para janeiro: o mês seguinte muda o ANO, e uma conta ingênua
     *  de `mes + 1` produziria o mês 13 — `Date.parse` devolveria `NaN` e o
     *  caminho sairia com coordenada `NaN`, que o SVG ignora em silêncio. */
    const { container } = render(
      <GraficoDeDoisEixos
        rotuloDaEsquerda="Preço (% do par)"
        bonds={[]}
        indice={[
          { mes: '2025-12-01', valor: 50 },
          { mes: '2026-01-01', valor: 55 },
        ]}
      />,
    );

    const doIndice = caminhos(container).find((d) => d.includes('M'));
    expect(doIndice).not.toContain('NaN');
    expect((doIndice?.match(/M /g) ?? []).length).toBe(1);
  });
});

describe('a régua da direita', () => {
  it('mostra 0, 50 e 100 seja qual for o período', () => {
    /** A DECISÃO QUE IMPEDE O GRÁFICO DE MENTIR.
     *
     *  Com régua automática, trocar de 3M para 6M mudaria a forma da curva do
     *  índice sem o dado ter mudado, e a coincidência com a curva do bond
     *  passaria a ser artefato do recorte. */
    const curto = render(
      <GraficoDeDoisEixos
        rotuloDaEsquerda="Preço (% do par)"
        bonds={[]}
        indice={[{ mes: '2026-01-01', valor: 50 }]}
      />,
    );
    const longo = render(
      <GraficoDeDoisEixos
        rotuloDaEsquerda="Preço (% do par)"
        bonds={[]}
        indice={[
          { mes: '2026-01-01', valor: 10 },
          { mes: '2026-02-01', valor: 90 },
        ]}
      />,
    );

    const rotulos = (r: ReturnType<typeof render>) =>
      [...r.container.querySelectorAll('text')]
        .map((t) => t.textContent)
        .filter((t) => t === '0' || t === '50' || t === '100');

    expect(rotulos(curto)).toEqual(['0', '50', '100']);
    expect(rotulos(longo)).toEqual(['0', '50', '100']);
  });
});

describe('o estado vazio e o aviso', () => {
  it('sem série nenhuma mostra a frase, e não um SVG em branco', () => {
    const { container, getByText } = render(
      <GraficoDeDoisEixos rotuloDaEsquerda="Preço (% do par)" bonds={[]} indice={[]} />,
    );

    expect(getByText('Sem cotação no período.')).toBeTruthy();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('a tela diz que a leitura é de COINCIDÊNCIA, não de causalidade', () => {
    /** É o que a especificação afirma na seção 1, e dizê-lo na tela é o que
     *  impede o gráfico de dois eixos de ser lido como prova de relação. */
    const { getByText } = render(
      <GraficoDeDoisEixos
        rotuloDaEsquerda="Preço (% do par)"
        bonds={[]}
        indice={[{ mes: '2026-01-01', valor: 50 }]}
      />,
    );

    expect(
      getByText(/não afirma que uma explica a outra/),
    ).toBeTruthy();
  });
});
