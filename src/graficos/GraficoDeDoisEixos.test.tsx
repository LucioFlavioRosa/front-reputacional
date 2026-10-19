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

import { GraficoDeDoisEixos, temCurva } from './GraficoDeDoisEixos';

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

/** Os traçados dos bonds (dentro do `<g>` de série), sem o do índice. */
function dosBonds(container: HTMLElement): string[] {
  return [...container.querySelectorAll('g path')].map((p) => p.getAttribute('d') ?? '');
}

function circulos(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('circle')];
}

/** O `d` como lista de comandos, para afirmar a FORMA e não só contar letras.
 *
 *  CONTAR `M` NÃO BASTA — é achado da revisão: uma reta simples passaria no
 *  teste de "meses consecutivos emendam", porque ela também tem um `M` só. O
 *  degrau tem forma própria: horizontal, vertical, horizontal. */
function comandos(d: string): { tipo: string; x: number; y: number }[] {
  return [...d.matchAll(/([ML]) (-?[\d.]+),(-?[\d.]+)/g)].map((m) => ({
    tipo: m[1],
    x: Number(m[2]),
    y: Number(m[3]),
  }));
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

    //: UM TRAÇADO (os dois pregões de janeiro) MAIS UM CÍRCULO (o pregão
    //: isolado de junho). Um traçado só significaria a reta atravessando os
    //: cinco meses em que o papel não negociou.
    expect(dosBonds(container)).toHaveLength(1);
    expect(circulos(container)).toHaveLength(1);
    expect(comandos(dosBonds(container)[0])).toHaveLength(2);
  });

  it('um pregão ISOLADO recebe marcador, e não desaparece', () => {
    /** ACHADO DA REVISÃO, e era defeito real: um `M x,y` sem segmento não
     *  desenha NADA. A série de um pregão único — um papel emitido na véspera
     *  do corte — ficava invisível, e nada na tela dizia que ela existia. */
    const { container } = render(
      <GraficoDeDoisEixos
        rotuloDaEsquerda="Preço (% do par)"
        indice={[]}
        bonds={[
          { chave: 'A', rotulo: 'A', cor: AZUL, pontos: [{ data: '2026-01-05', valor: 95 }] },
        ]}
      />,
    );

    expect(circulos(container)).toHaveLength(1);
    expect(dosBonds(container)).toHaveLength(0);
  });

  it('data com timestamp NÃO contamina o eixo inteiro', () => {
    /** ACHADO DA REVISÃO. A versão anterior concatenava `T00:00:00Z`, então
     *  `2026-01-05T00:00:00` virava string dupla, `Date.parse` devolvia `NaN`,
     *  e como `inicio`/`fim` saem de `Math.min`/`max` UM ponto ruim apagava
     *  TODAS as coordenadas — gráfico vazio, sem mensagem.
     *
     *  Agora o ponto torto é descartado e os bons continuam. */
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
              { data: 'nao e data', valor: 96 },
              { data: '2026-01-06T00:00:00', valor: 97 },
            ],
          },
        ]}
      />,
    );

    const d = dosBonds(container)[0] ?? '';
    expect(d).not.toContain('NaN');
    //: `2026-01-05` e `2026-01-06T00:00:00` (recortado) entram; `nao e data` sai.
    expect(comandos(d)).toHaveLength(2);
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

    expect(dosBonds(container)).toHaveLength(1);
    expect(circulos(container)).toHaveLength(0);
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

    //: A FORMA, e não a contagem de `M` — achado da revisão: contar `M` deixava
    //: uma reta simples passar, porque ela também tem um `M` só. O degrau é
    //: horizontal, salta na vertical, e segue horizontal.
    const passos = comandos(caminhos(container)[0]);
    expect(passos.map((p) => p.tipo)).toEqual(['M', 'L', 'L', 'L']);
    //: o primeiro trecho é HORIZONTAL (mesmo y, x cresce)
    expect(passos[1].y).toBe(passos[0].y);
    expect(passos[1].x).toBeGreaterThan(passos[0].x);
    //: o salto é VERTICAL (mesmo x, y muda) — é o degrau
    expect(passos[2].x).toBe(passos[1].x);
    expect(passos[2].y).not.toBe(passos[1].y);
    //: e o segundo trecho é horizontal de novo
    expect(passos[3].y).toBe(passos[2].y);
    expect(passos[3].x).toBeGreaterThan(passos[2].x);
  });

  it('UM MÊS SÓ desenha um degrau com largura', () => {
    /** ACHADO DA REVISÃO, e era defeito real: o último degrau terminava em
     *  `max(fimDoEixo, comeca)`, e com um mês só (sem bonds) `fimDoEixo` era
     *  igual a `comeca` — o traçado saía com comprimento ZERO e não desenhava
     *  nada. O meu teste da régua direita renderizava exatamente este caso e
     *  passava, porque só olhava os rótulos do eixo. */
    const { container } = render(
      <GraficoDeDoisEixos
        rotuloDaEsquerda="Preço (% do par)"
        bonds={[]}
        indice={[{ mes: '2026-01-01', valor: 50 }]}
      />,
    );

    const passos = comandos(caminhos(container)[0]);
    expect(passos).toHaveLength(2);
    expect(passos[1].x).toBeGreaterThan(passos[0].x);
    expect(passos[1].y).toBe(passos[0].y);
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


describe('a acessibilidade', () => {
  it('o rótulo diz QUAIS séries, com valores e datas', () => {
    /** ACHADO DA REVISÃO, e era divergência da casa: `GraficoDeLinha` põe os
     *  pontos no `aria-label`, e o meu dava só "Preço dos bonds e índice
     *  reputacional, no período" — que não diz quais papéis, nem quanto, nem
     *  quando. E o campo `rotulo` da série não era usado em lugar nenhum.
     *
     *  PARA SÉRIE LONGA VÃO AS PONTAS: ler 1.100 pregões em voz alta não é
     *  acesso, é ruído. */
    const { container } = render(
      <GraficoDeDoisEixos
        rotuloDaEsquerda="Preço (% do par)"
        indice={[{ mes: '2026-01-01', valor: 52 }]}
        bonds={[
          {
            chave: 'AEGEBZ31',
            rotulo: 'Aegea 2031',
            cor: AZUL,
            pontos: [
              { data: '2026-01-05', valor: 95 },
              { data: '2026-01-06', valor: 96.4 },
            ],
          },
        ]}
      />,
    );

    const rotulo = container.querySelector('svg')?.getAttribute('aria-label') ?? '';
    expect(rotulo).toContain('Aegea 2031');
    expect(rotulo).toContain('95');
    expect(rotulo).toContain('96.4');
    expect(rotulo).toContain('2026-01-05');
    expect(rotulo).toContain('2026-01-06');
    expect(rotulo).toContain('52');
  });

  it('a série de um ponto é descrita sem "de X a X"', () => {
    const { container } = render(
      <GraficoDeDoisEixos
        rotuloDaEsquerda="Preço (% do par)"
        indice={[]}
        bonds={[
          {
            chave: 'A',
            rotulo: 'Aegea 2036',
            cor: AZUL,
            pontos: [{ data: '2026-01-05', valor: 95 }],
          },
        ]}
      />,
    );

    const rotulo = container.querySelector('svg')?.getAttribute('aria-label') ?? '';
    expect(rotulo).toContain('Aegea 2036: 95 em 2026-01-05');
    expect(rotulo).not.toContain('pregões');
  });

  it('a série SEM PONTO NENHUM não derruba a tela, e é dita', () => {
    /** O DEFEITO QUE TRAVAVA A TELA, relatado em 19/10/2026: "em alguns
     *  momentos a tela trava quando eu mudo alguma fonte de dados ou métrica,
     *  daí preciso dar F5".
     *
     *  O servidor nunca falhou — os logs mostram 200 em 60ms para todas as
     *  requisições, inclusive `tickers=AEGEBZ29`, que é o papel SEM COTAÇÃO na
     *  planilha. O back semeia a série com lista vazia e a devolve assim
     *  (`serie_de_mercado.py:153` e `:168`), de propósito: o papel pedido
     *  aparece na resposta mesmo sem dado.
     *
     *  Aqui, `pontos.length === 1` era falso, o ternário caía no outro lado e
     *  lia `primeiro.valor` com `primeiro === undefined`. O TypeError acontecia
     *  DURANTE A RENDERIZAÇÃO, o `LimiteDeErro` de `App.tsx` o capturava, e um
     *  limite de erro do React não se recupera sozinho: a única saída era
     *  remontar — o F5.
     *
     *  O caso de UM ponto tem teste desde o começo (logo acima). O de ZERO
     *  não tinha. */
    const renderizar = () =>
      render(
        <GraficoDeDoisEixos
          rotuloDaEsquerda="Preço (% do par)"
          indice={[{ mes: '2026-01-01', valor: 52 }]}
          bonds={[
            {
              chave: 'AEGEBZ31',
              rotulo: 'Aegea 2031',
              cor: AZUL,
              pontos: [{ data: '2026-01-05', valor: 95 }],
            },
            { chave: 'AEGEBZ29', rotulo: 'Aegea 2029', cor: AZUL, pontos: [] },
          ]}
        />,
      );

    expect(renderizar).not.toThrow();

    const { container } = renderizar();
    const rotulo = container.querySelector('svg')?.getAttribute('aria-label') ?? '';
    //: DITA, e não omitida: a curva que não aparece precisa de explicação, ou
    //: quem ligou o papel conclui que a tela está quebrada.
    expect(rotulo).toContain('Aegea 2029: sem cotação no período');
    //: E a série que TEM dado continua descrita.
    expect(rotulo).toContain('Aegea 2031: 95 em 2026-01-05');
  });

  it('a série de pontos com DATA TORTA conta como sem cotação', () => {
    /** ACHADO DE REVISÃO, e dentro da MINHA correção: o aviso da tela olhava
     *  `pontos.length` e o gráfico olha os pontos com DATA VÁLIDA (`datados()`
     *  descarta o resto). Uma série com pontos e datas tortas não desenhava
     *  curva E não disparava o aviso — o pior dos dois mundos, que é o estado
     *  silencioso que esta mudança existe para acabar.
     *
     *  `temCurva` passou a ser a regra ÚNICA, e é a mesma que o filtro do
     *  desenho usa. */
    expect(temCurva([{ data: '2026-01-05', valor: 95 }])).toBe(true);
    expect(temCurva([])).toBe(false);
    expect(temCurva([{ data: 'ontem', valor: 95 }])).toBe(false);
    expect(temCurva([{ data: '2026-13-45', valor: 95 }])).toBe(false);

    const { container } = render(
      <GraficoDeDoisEixos
        rotuloDaEsquerda="Preço (% do par)"
        indice={[{ mes: '2026-01-01', valor: 52 }]}
        bonds={[
          {
            chave: 'AEGEBZ31',
            rotulo: 'Aegea 2031',
            cor: AZUL,
            pontos: [{ data: '2026-01-05', valor: 95 }],
          },
          { chave: 'X', rotulo: 'Torto', cor: AZUL, pontos: [{ data: 'ontem', valor: 9 }] },
        ]}
      />,
    );

    const rotulo = container.querySelector('svg')?.getAttribute('aria-label') ?? '';
    expect(rotulo).toContain('Torto: sem cotação no período');
  });

  it('cada série tem `title`, para o nome aparecer no hover nativo', () => {
    /** Enquanto a legenda da tela (bloco 6) não existe, é o que torna a linha
     *  identificável — sem isto ninguém sabe qual curva é 2031 e qual é 2036. */
    const { container } = render(
      <GraficoDeDoisEixos
        rotuloDaEsquerda="Preço (% do par)"
        indice={[]}
        bonds={[
          {
            chave: 'A',
            rotulo: 'Aegea 2031',
            cor: AZUL,
            pontos: [
              { data: '2026-01-05', valor: 95 },
              { data: '2026-01-06', valor: 96 },
            ],
          },
        ]}
      />,
    );

    expect([...container.querySelectorAll('title')].map((t) => t.textContent)).toEqual([
      'Aegea 2031',
    ]);
  });
});