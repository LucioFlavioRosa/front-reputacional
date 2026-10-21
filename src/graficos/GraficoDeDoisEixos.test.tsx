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

import { GraficoDeDoisEixos, dataNoPixel, temCurva } from './GraficoDeDoisEixos';
import type { PontoMensal, SerieMensal } from './GraficoDeDoisEixos';

/** A curva mensal única que estes testes sempre tiveram.
 *
 *  A prop virou uma LISTA de séries quando o gráfico passou a poder mostrar o
 *  índice e as notas das lentes ao mesmo tempo. Estes testes são sobre o
 *  DESENHO de uma curva mensal — o degrau, o vão, a emenda, a régua —, e isso
 *  não mudou: o auxiliar os mantém falando de uma curva só, que é o assunto
 *  deles. Os testes de VÁRIAS curvas estão no fim do arquivo. */
function umIndice(pontos: PontoMensal[]): SerieMensal[] {
  return [{ chave: 'isr', rotulo: 'Índice', cor: 'var(--ok-fg)', pontos }];
}

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

/** Os traçados dos BONDS, sem as curvas mensais.
 *
 *  A EXCLUSÃO É EXPLÍCITA desde que o gráfico passou a desenhar várias curvas
 *  mensais: elas também moram num `<g>`, e `g path` sozinho passaria a contar
 *  o índice entre os bonds — este auxiliar mediria outra coisa sem avisar. */
function dosBonds(container: HTMLElement): string[] {
  return [...container.querySelectorAll('g:not([data-mensal]) path')].map(
    (p) => p.getAttribute('d') ?? '',
  );
}

/** As curvas mensais do eixo direito, por chave. */
function mensais(container: HTMLElement): { chave: string; cor: string }[] {
  return [...container.querySelectorAll('g[data-mensal]')].map((g) => ({
    chave: g.getAttribute('data-mensal') ?? '',
    cor: g.querySelector('path')?.getAttribute('stroke') ?? '',
  }));
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
        indice={umIndice([])}
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
        indice={umIndice([])}
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
        indice={umIndice([])}
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
        indice={umIndice([])}
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
        indice={umIndice([
          { mes: '2026-01-01', valor: 50 },
          { mes: '2026-03-01', valor: 60 },
        ])}
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
        indice={umIndice([
          { mes: '2026-01-01', valor: 50 },
          { mes: '2026-02-01', valor: 60 },
        ])}
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
        indice={umIndice([{ mes: '2026-01-01', valor: 50 }])}
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
        indice={umIndice([
          { mes: '2026-01-01', valor: 50 },
          { mes: '2026-02-01', valor: null },
        ])}
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
        indice={umIndice([
          { mes: '2025-12-01', valor: 50 },
          { mes: '2026-01-01', valor: 55 },
        ])}
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
        indice={umIndice([{ mes: '2026-01-01', valor: 50 }])}
      />,
    );
    const longo = render(
      <GraficoDeDoisEixos
        rotuloDaEsquerda="Preço (% do par)"
        bonds={[]}
        indice={umIndice([
          { mes: '2026-01-01', valor: 10 },
          { mes: '2026-02-01', valor: 90 },
        ])}
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
      <GraficoDeDoisEixos rotuloDaEsquerda="Preço (% do par)" bonds={[]} indice={umIndice([])} />,
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
        indice={umIndice([{ mes: '2026-01-01', valor: 50 }])}
      />,
    );

    expect(
      getByText(/não afirma que uma explica a outra/),
    ).toBeTruthy();
  });
});


describe('escolher uma data no gráfico', () => {
  /** O PEDIDO: "quero poder clicar em alguma data seja no gráfico ou seja no
   *  eixo, que você pega a data e subtrai 15 dias".
   *
   *  A MATEMÁTICA FICA NUMA FUNÇÃO PURA porque é ela que erra: converter pixel
   *  em data é a inversa da escala do eixo, e um erro de meia tela aqui aponta
   *  uma janela inteira errada sem nada parecer quebrado. Testada direto, sem
   *  DOM no meio.
   */
  const INICIO = Date.UTC(2026, 0, 1);
  const FIM = Date.UTC(2026, 0, 31);

  it('a borda esquerda é o começo e a direita é o fim', () => {
    expect(dataNoPixel(0, INICIO, FIM, 100)).toBe('2026-01-01');
    expect(dataNoPixel(100, INICIO, FIM, 100)).toBe('2026-01-31');
  });

  it('o meio é o meio', () => {
    expect(dataNoPixel(50, INICIO, FIM, 100)).toBe('2026-01-16');
  });

  it('fora da área, PRENDE nas pontas em vez de inventar data', () => {
    //: Arrastar o clique para fora não deve pedir uma janela que o gráfico não
    //: mostra — nem uma data negativa, que o servidor recusaria.
    expect(dataNoPixel(-40, INICIO, FIM, 100)).toBe('2026-01-01');
    expect(dataNoPixel(500, INICIO, FIM, 100)).toBe('2026-01-31');
  });

  it('largura zero não produz NaN', () => {
    //: Um quadro antes de o `ResizeObserver` responder, a largura é zero. A
    //: divisão daria `NaN` e o `toISOString` lançaria `RangeError` — fora da
    //: renderização, onde o limite de erro não alcança.
    expect(dataNoPixel(10, INICIO, FIM, 0)).toBe('2026-01-01');
  });

  function comClique(aoEscolher: (iso: string) => void) {
    return render(
      <GraficoDeDoisEixos
        rotuloDaEsquerda="Preço (% do par)"
        indice={umIndice([
          { mes: '2026-01-01', valor: 50 },
          { mes: '2026-02-01', valor: 55 },
        ])}
        bonds={[
          {
            chave: 'A',
            rotulo: 'Aegea 2031',
            cor: AZUL,
            pontos: [
              { data: '2026-01-05', valor: 95 },
              { data: '2026-02-20', valor: 97 },
            ],
          },
        ]}
        aoEscolherData={aoEscolher}
      />,
    );
  }

  it('clicar na área do gráfico escolhe EXATAMENTE a data daquele ponto', () => {
    /** ACHADO DE REVISÃO: este teste só conferia que a função foi chamada com
     *  ALGUMA data no formato ISO. Com `getBoundingClientRect` zerado no jsdom,
     *  um erro na margem ou na escala continuaria passando — e é justamente a
     *  conta que erra sem nada parecer quebrado.
     *
     *  A CONTA, À MÃO: o dublê do `ResizeObserver` responde 800 de largura, as
     *  margens são 44 de cada lado, então o plot tem 712. Clicar em 400 dá
     *  400 − 44 = 356 pixels dentro do plot, que é a METADE exata. O eixo vai de
     *  01/01 a 31/01 (trinta dias), então a metade é 16/01. */
    const escolhida: string[] = [];
    const { container } = render(
      <GraficoDeDoisEixos
        rotuloDaEsquerda="Preço (% do par)"
        indice={umIndice([])}
        bonds={[
          {
            chave: 'A',
            rotulo: 'Aegea 2031',
            cor: AZUL,
            pontos: [
              { data: '2026-01-01', valor: 95 },
              { data: '2026-01-31', valor: 97 },
            ],
          },
        ]}
        aoEscolherData={(iso) => escolhida.push(iso)}
      />,
    );

    const svg = container.querySelector('svg') as Element;
    svg.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 400 }));

    expect(escolhida).toEqual(['2026-01-16']);
  });

  it('clicar FORA da área do plot não escolhe data nenhuma', () => {
    /** A régua da esquerda ocupa 44 pixels, e clicar nela pedia a data presa na
     *  ponta — um recorte que a pessoa não pediu, a partir de um clique que não
     *  era no gráfico. */
    const escolhida: string[] = [];
    const { container } = comClique((iso) => escolhida.push(iso));

    const svg = container.querySelector('svg') as Element;
    svg.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10 }));
    svg.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 790 }));

    expect(escolhida).toEqual([]);
  });

  it('a área de clique NÃO cobre as curvas, para o hover delas sobreviver', () => {
    /** ACHADO DE REVISÃO, e era real: a área de clique era um `<rect>`
     *  transparente desenhado POR CIMA de tudo. Em SVG a ordem do documento é a
     *  ordem de pintura e também a de alvo do ponteiro, então ela virava o alvo
     *  sobre as curvas e impedia o `<title>` de cada série de aparecer no hover
     *  nativo — o único jeito de identificar uma curva com o mouse.
     *
     *  A SOLUÇÃO FOI TIRAR O `rect`: o clique mora no próprio `<svg>`, que é o
     *  ancestral de tudo. Recebe o clique das curvas por propagação, e não
     *  cobre nada. */
    const { container } = comClique(() => {});

    expect(container.querySelector('[data-testid="area-de-clique"]')).toBeNull();
    //: E OS `title` DAS SÉRIES CONTINUAM LÁ, alcançáveis.
    expect(container.querySelectorAll('g > title').length).toBeGreaterThan(0);
  });

  it('clicar no RÓTULO DO MÊS escolhe o último dia dele dentro do gráfico', () => {
    /** "ou seja no eixo". O rótulo é um mês, e a janela precisa de um DIA: o
     *  último do mês é o que faz os quinze dias caírem DENTRO do mês clicado —
     *  pegar o dia 1º jogaria a janela quase toda para o mês anterior, que não é
     *  o que alguém clicando em "jan" quer ver. */
    const escolhida: string[] = [];
    const { container } = comClique((iso) => escolhida.push(iso));

    const rotulo = container.querySelector('[data-mes="2026-01-01"]') as Element;
    rotulo.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(escolhida).toEqual(['2026-01-31']);
  });

  it('o rótulo do mês responde ao TECLADO', () => {
    const escolhida: string[] = [];
    const { container } = comClique((iso) => escolhida.push(iso));

    const rotulo = container.querySelector('[data-mes="2026-01-01"]') as Element;
    expect(rotulo.getAttribute('role')).toBe('button');
    expect(rotulo.getAttribute('tabindex')).toBe('0');
    rotulo.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));

    expect(escolhida).toEqual(['2026-01-31']);
  });

  it('SEM o `aoEscolherData`, o gráfico não fica clicável', () => {
    /** As outras telas montam este gráfico sem a função. Elas não devem ganhar
     *  um cursor prometendo interação que não existe, nem rótulos de eixo que
     *  parecem botões. */
    const { container } = render(
      <GraficoDeDoisEixos
        rotuloDaEsquerda="Preço (% do par)"
        indice={umIndice([{ mes: '2026-01-01', valor: 50 }])}
        bonds={[{ chave: 'A', rotulo: 'A', cor: AZUL, pontos: [{ data: '2026-01-05', valor: 95 }] }]}
      />,
    );

    expect(container.querySelector('[data-mes]')?.getAttribute('role')).not.toBe('button');
    expect((container.querySelector('svg') as SVGSVGElement).style.cursor).toBe('');
  });

  it('a data escolhida é MARCADA, com a janela sombreada', () => {
    /** Sem a marca, o clique muda os quadros embaixo e o gráfico fica igual —
     *  e aí não há como saber qual janela está sendo mostrada. */
    const { container } = render(
      <GraficoDeDoisEixos
        rotuloDaEsquerda="Preço (% do par)"
        indice={umIndice([{ mes: '2026-01-01', valor: 50 }])}
        bonds={[
          {
            chave: 'A',
            rotulo: 'A',
            cor: AZUL,
            pontos: [
              { data: '2026-01-05', valor: 95 },
              { data: '2026-01-25', valor: 96 },
            ],
          },
        ]}
        dataEscolhida="2026-01-20"
        diasDaJanela={15}
      />,
    );

    expect(container.querySelector('[data-testid="marca-da-data"]')).not.toBeNull();
    const faixa = container.querySelector('[data-testid="faixa-da-janela"]');
    expect(faixa).not.toBeNull();
    //: A FAIXA TEM LARGURA: uma de largura zero é indistinguível de não existir.
    expect(Number(faixa?.getAttribute('width'))).toBeGreaterThan(0);
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
        indice={umIndice([{ mes: '2026-01-01', valor: 52 }])}
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
        indice={umIndice([])}
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
          indice={umIndice([{ mes: '2026-01-01', valor: 52 }])}
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
        indice={umIndice([{ mes: '2026-01-01', valor: 52 }])}
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
        indice={umIndice([])}
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

describe('várias curvas mensais', () => {
  /** O gráfico mostrava só o índice. Desde 20/10/2026 ele mostra também a nota
   *  de cada lente, uma a uma, conforme os botões da tela. */

  it('desenha UMA CURVA POR SÉRIE, cada uma com a sua cor', () => {
    const { container } = render(
      <GraficoDeDoisEixos
        rotuloDaEsquerda="Preço (% do par)"
        bonds={[]}
        indice={[
          {
            chave: 'isr',
            rotulo: 'Índice geral',
            cor: '#111111',
            pontos: [{ mes: '2026-01-01', valor: 50 }],
          },
          {
            chave: 'imprensa',
            rotulo: 'Imprensa',
            cor: '#222222',
            pontos: [{ mes: '2026-01-01', valor: 70 }],
          },
        ]}
      />,
    );

    expect(mensais(container)).toEqual([
      { chave: 'isr', cor: '#111111' },
      { chave: 'imprensa', cor: '#222222' },
    ]);
    //: E AS DUAS ESTÃO EM ALTURAS DIFERENTES: 50 e 70 na mesma régua 0–100.
    //: Sem isto, duas curvas com a mesma cor e o mesmo traçado passariam.
    const alturas = [...container.querySelectorAll('g[data-mensal] path')].map((p) =>
      (p.getAttribute('d') ?? '').match(/,([\d.]+)/)?.[1],
    );
    expect(alturas[0]).not.toBe(alturas[1]);
  });

  it('o EIXO X cobre os meses de TODAS as curvas, e não os da primeira', () => {
    //: Duas lentes podem ter meses diferentes — uma sem dado num mês que a
    //: outra tem. Recortando pela primeira, o degrau da segunda sairia da
    //: tela: a curva existiria no dado e não no desenho.
    const { container } = render(
      <GraficoDeDoisEixos
        rotuloDaEsquerda="Preço (% do par)"
        bonds={[]}
        indice={[
          {
            chave: 'isr',
            rotulo: 'Índice geral',
            cor: '#111111',
            pontos: [{ mes: '2026-01-01', valor: 50 }],
          },
          {
            chave: 'imprensa',
            rotulo: 'Imprensa',
            cor: '#222222',
            pontos: [{ mes: '2026-06-01', valor: 70 }],
          },
        ]}
      />,
    );

    const traçados = [...container.querySelectorAll('g[data-mensal] path')].map(
      (p) => p.getAttribute('d') ?? '',
    );
    expect(traçados).toHaveLength(2);
    //: Os dois começam em X diferentes — junho não foi espremido em cima de
    //: janeiro, que é o que aconteceria se o eixo só conhecesse a primeira.
    const xDe = (d: string) => Number(d.match(/M ([\d.]+)/)?.[1] ?? 0);
    expect(xDe(traçados[1])).toBeGreaterThan(xDe(traçados[0]));
  });

  it('a lista VAZIA não desenha curva mensal nenhuma', () => {
    //: É o caso de quem desligou todos os botões: o eixo direito continua
    //: existindo (ele é fixo em 0–100), e nenhuma linha é desenhada.
    const { container } = render(
      <GraficoDeDoisEixos rotuloDaEsquerda="Preço (% do par)" bonds={[]} indice={[]} />,
    );

    expect(mensais(container)).toEqual([]);
  });
});